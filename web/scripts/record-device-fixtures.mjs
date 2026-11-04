// Records the fake device's data for the e2e tests (web/e2e/fixtures/device/) from a running
// simulator or real machine, and checks every WebSocket message it sees against the contract.
//
//   node scripts/record-device-fixtures.mjs [baseUrl] [--brew]
//
// baseUrl defaults to the simulator (http://localhost:8080). --brew also pulls a shot,
// recording the brew telemetry and the resulting shot history; only use it on a real
// machine when it is safe to run a brew. Start the simulator with fresh state (empty
// sim_data/) so the recording is reproducible.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkMessage } from '../e2e/contract.js';

const args = process.argv.slice(2);
const brew = args.includes('--brew');
const baseUrl = (args.find(arg => !arg.startsWith('--')) ?? 'http://localhost:8080').replace(
  /\/$/,
  '',
);
const outDir = join(dirname(fileURLToPath(import.meta.url)), '../e2e/fixtures/device');

// Settings that identify the user's network or accounts are replaced in the recording.
const SECRET_SETTINGS = [
  'wifiSsid',
  'wifiPassword',
  'apPassword',
  'haUser',
  'haPassword',
  'haIP',
  'deviceIp',
  'smartGrindIp',
  'savedScale',
];

const violations = [];
const save = (name, data) => {
  const path = join(outDir, name);
  writeFileSync(path, data instanceof Uint8Array ? data : `${JSON.stringify(data, null, 2)}\n`);
  console.log(`  wrote ${name}`);
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchOk(path) {
  const response = await fetch(baseUrl + path);
  if (!response.ok) throw new Error(`GET ${path} failed: ${response.status}`);
  return response;
}

function connect() {
  const socket = new WebSocket(`${baseUrl.replace(/^http/, 'ws')}/ws`);
  const messages = [];
  const waiters = new Set();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const violation = checkMessage('fromDevice', message);
    if (violation) violations.push(violation);
    messages.push(message);
    for (const waiter of waiters) {
      if (waiter.match(message)) waiter.resolve(message);
    }
  });
  const client = {
    messages,
    send(message) {
      const violation = checkMessage('toDevice', message);
      if (violation) violations.push(violation);
      socket.send(JSON.stringify(message));
    },
    // Resolves with the first message (already received or upcoming) that matches.
    waitFor(match, timeoutMs = 10000, description = 'message') {
      const seen = messages.find(match);
      if (seen) return Promise.resolve(seen);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiters.delete(waiter);
          reject(new Error(`Timed out waiting for ${description}`));
        }, timeoutMs);
        const waiter = {
          match,
          resolve: message => {
            clearTimeout(timer);
            waiters.delete(waiter);
            resolve(message);
          },
        };
        waiters.add(waiter);
      });
    },
    async request(message) {
      const rid = `rec-${message.tp}`;
      const type = `res:${message.tp.slice(4)}`;
      client.send({ ...message, rid });
      return client.waitFor(m => m.tp === type && m.rid === rid, 10000, type);
    },
    close: () => socket.close(),
  };
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve(client));
    socket.addEventListener('error', () => reject(new Error(`Cannot connect to ${baseUrl}/ws`)));
  });
}

const isStatus = key => m => m.tp === 'evt:status' && key in m;

mkdirSync(outDir, { recursive: true });
console.log(`Recording from ${baseUrl}`);

const settings = await (await fetchOk('/api/settings')).json();
for (const key of SECRET_SETTINGS) {
  if (typeof settings[key] === 'string' && settings[key]) settings[key] = `<${key}>`;
}
save('settings.json', settings);
save('scales-list.json', await (await fetchOk('/api/scales/list')).json());
const scaleInfo = await (await fetchOk('/api/scales/info')).json();
for (const key of ['uuid', 'saved']) if (scaleInfo[key]) scaleInfo[key] = `<${key}>`;
save('scales-info.json', scaleInfo);

const device = await connect();
// On connect the device sends the full slow state, then telemetry follows every 500 ms.
const state = await device.waitFor(isStatus('sys'), 10000, 'status state frame');
const telemetry = await device.waitFor(isStatus('ct'), 10000, 'status telemetry frame');
if (state.sys.s !== 'ready') throw new Error(`Device is not ready (state: ${state.sys.s})`);
save('status-state.json', state);
save('status-idle.json', telemetry);

const { profiles } = await device.request({ tp: 'req:profiles:list' });
save('profiles.json', profiles);
// Answered as a broadcast without rid.
device.send({ tp: 'req:ota-settings' });
save(
  'ota-settings.json',
  await device.waitFor(m => m.tp === 'res:ota-settings', 10000, 'OTA settings'),
);

if (brew) {
  device.send({ tp: 'req:change-mode', mode: 1 });
  await device.waitFor(m => isStatus('m')(m) && m.m === 1, 10000, 'brew mode');
  device.send({ tp: 'req:process:activate' });
  const brewing = await device.waitFor(
    m => isStatus('ct')(m) && m.process?.a === 1 && m.process.e > 5000,
    20000,
    'brew telemetry',
  );
  save('status-brewing.json', brewing);
  const finished = await device.waitFor(
    m => isStatus('ct')(m) && m.process?.a === 0,
    180000,
    'brew to finish',
  );
  save('status-finished.json', finished);
  save(
    'shot-finished-stats.json',
    await device.waitFor(m => m.tp === 'evt:shot-finished-stats', 30000, 'shot stats'),
  );
  const { id } = await device.waitFor(m => m.tp === 'evt:history-shot-saved', 30000, 'shot save');
  const slog = await fetchOk(`/api/history/${String(id).padStart(6, '0')}.slog`);
  save('shot.slog', new Uint8Array(await slog.arrayBuffer()));
  save(
    'history-index.bin',
    new Uint8Array(await (await fetchOk('/api/history/index.bin')).arrayBuffer()),
  );
  const recent = await fetchOk('/api/history/recent.bin?limit=5');
  save('history-recent.bin', new Uint8Array(await recent.arrayBuffer()));
  device.send({ tp: 'req:process:clear' });
  device.send({ tp: 'req:change-mode', mode: 0 });
  await sleep(1000);
}
device.close();

if (violations.length) {
  console.error(`\n${violations.length} contract violation(s):`);
  for (const violation of new Set(violations)) console.error(`  - ${violation}`);
  process.exit(1);
}
console.log('\nAll recorded messages match the contract.');
// The simulator doesn't complete the WebSocket close handshake, which would keep node running.
process.exit(0);
