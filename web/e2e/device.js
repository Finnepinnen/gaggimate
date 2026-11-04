// A fake GaggiMate device for the e2e tests. It answers the web UI's WebSocket and REST calls
// with data recorded from the simulator (fixtures/device/, see scripts/record-device-fixtures.mjs)
// and mimics the firmware's handling of the common requests. Every message in either direction
// is checked against docs/websocket-api.yaml; a mismatch, an unknown message or an unmocked REST
// call is recorded in `violations`, which fails the test.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkMessage } from './contract.js';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/device');
const readJson = name => JSON.parse(readFileSync(join(fixtureDir, name), 'utf8'));
const readBinary = name => readFileSync(join(fixtureDir, name));
const clone = value => structuredClone(value);

/** Recorded device data, shared by all tests. Use clone() before changing it. */
export const recorded = {
  settings: readJson('settings.json'),
  state: readJson('status-state.json'),
  idle: readJson('status-idle.json'),
  brewing: readJson('status-brewing.json'),
  finished: readJson('status-finished.json'),
  profiles: readJson('profiles.json'),
  otaSettings: readJson('ota-settings.json'),
  shotFinishedStats: readJson('shot-finished-stats.json'),
  scales: readJson('scales-list.json'),
  scaleInfo: readJson('scales-info.json'),
};

export class FakeDevice {
  /** Contract violations and unmocked calls seen so far. */
  violations = [];
  /** Every message the UI sent, in order. */
  received = [];

  constructor(page) {
    this.page = page;
    this.sockets = new Set();
    this.settings = clone(recorded.settings);
    this.profiles = clone(recorded.profiles);
    // evt:status is split into the slow state and the fast telemetry, as on the device.
    this.state = clone(recorded.state);
    this.telemetry = clone(recorded.idle);
    this.notes = new Map();
  }

  async attach() {
    await this.page.routeWebSocket('**/ws', socket => this.#connect(socket));
    await this.page.route('**/api/**', route => this.#rest(route));
  }

  /** Sends a message to the UI (checked against the contract). */
  push(message) {
    this.#check('fromDevice', message);
    const text = JSON.stringify(message);
    for (const socket of this.sockets) socket.send(text);
  }

  /** Changes the slow status state (mode, profile, warnings, ...) and pushes it. */
  setState(patch) {
    Object.assign(this.state, patch);
    this.push(this.state);
  }

  /** Changes the telemetry (temperatures, pressure, process, ...) and pushes it. */
  setTelemetry(patch) {
    Object.assign(this.telemetry, patch);
    this.push(this.telemetry);
  }

  /** Messages of one type the UI has sent so far. */
  sent(type) {
    return this.received.filter(message => message.tp === type);
  }

  #check(direction, message) {
    const violation = checkMessage(direction, message);
    if (violation) this.violations.push(violation);
  }

  #connect(socket) {
    this.sockets.add(socket);
    socket.onClose(() => this.sockets.delete(socket));
    socket.onMessage(data => this.#onMessage(socket, data));
    // Like the firmware: the full state first, then telemetry.
    for (const message of [this.state, this.telemetry]) {
      this.#check('fromDevice', message);
      socket.send(JSON.stringify(message));
    }
  }

  #reply(socket, request, body) {
    const message = { tp: `res:${request.tp.slice(4)}`, rid: request.rid, ...body };
    this.#check('fromDevice', message);
    socket.send(JSON.stringify(message));
  }

  #onMessage(socket, data) {
    let message;
    try {
      message = JSON.parse(data);
    } catch {
      this.violations.push(`UI -> device: invalid JSON: ${data}`);
      return;
    }
    this.received.push(message);
    this.#check('toDevice', message);
    this.#handle(socket, message);
  }

  #findProfile(id) {
    return this.profiles.find(profile => profile.id === id);
  }

  // Mirrors the firmware's handlers in WebSocketHandler.cpp / ShotHistoryPlugin.cpp.
  #handle(socket, message) {
    switch (message.tp) {
      case 'req:profiles:list': {
        const profiles = message.minimal
          ? this.profiles.map(({ id, label }) => ({ id, label }))
          : this.profiles;
        return this.#reply(socket, message, { profiles });
      }
      case 'req:profiles:load': {
        const profile = this.#findProfile(message.id);
        return this.#reply(socket, message, profile ? { profile } : { error: 'Profile not found' });
      }
      case 'req:profiles:save': {
        const profile = { ...message.profile, id: message.profile.id || `p${Date.now()}` };
        const index = this.profiles.findIndex(p => p.id === profile.id);
        if (index >= 0) this.profiles[index] = profile;
        else this.profiles.push(profile);
        return this.#reply(socket, message, { profile });
      }
      case 'req:profiles:delete': {
        const before = this.profiles.length;
        this.profiles = this.profiles.filter(profile => profile.id !== message.id);
        const deleted = this.profiles.length < before;
        return this.#reply(socket, message, deleted ? {} : { error: 'Delete failed' });
      }
      case 'req:profiles:select': {
        const profile = this.#findProfile(message.id);
        for (const p of this.profiles) p.selected = p === profile;
        this.#reply(socket, message, {});
        if (profile) this.setState({ p: profile.label, puid: profile.id });
        return;
      }
      case 'req:profiles:favorite':
      case 'req:profiles:unfavorite': {
        const profile = this.#findProfile(message.id);
        if (profile) profile.favorite = message.tp === 'req:profiles:favorite';
        return this.#reply(socket, message, {});
      }
      case 'req:profiles:reorder': {
        const order = new Map(message.order.map((id, index) => [id, index]));
        this.profiles.sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
        return this.#reply(socket, message, {});
      }
      case 'req:ota-settings':
        // A broadcast without rid on the device.
        return this.push(clone(recorded.otaSettings));
      case 'req:change-mode':
        this.setTelemetry({ process: null });
        return this.setState({ m: message.mode });
      case 'req:process:activate':
        return this.setTelemetry({ ...clone(recorded.brewing) });
      case 'req:process:deactivate':
      case 'req:process:clear':
        return this.setTelemetry({ ...clone(recorded.idle) });
      case 'req:flush:start':
      case 'req:flush:stop':
        return this.#reply(socket, message, { success: true });
      case 'req:history:notes:get':
        return this.#reply(socket, message, { notes: this.notes.get(String(message.id)) ?? null });
      case 'req:history:notes:save':
        this.notes.set(String(message.id), message.notes);
        return this.#reply(socket, message, { msg: 'Ok' });
      case 'req:history:delete':
        return this.#reply(socket, message, { msg: 'Ok' });
      case 'req:history:rebuild':
        return this.#reply(socket, message, { msg: 'Rebuild started' });
      default:
        // Commands without a reply (raise-temp, scale:tare, ...) are only recorded. Tests
        // that need a reaction push it themselves.
        return;
    }
  }

  async #rest(route) {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const binary = name =>
      route.fulfill({ contentType: 'application/octet-stream', body: readBinary(name) });

    if (path === '/api/settings') {
      if (request.method() === 'POST') {
        // The UI posts multipart FormData; values arrive as strings, like on the device.
        const form = await new Response(request.postDataBuffer(), {
          headers: { 'content-type': request.headers()['content-type'] },
        }).formData();
        for (const [key, value] of form) {
          if (key in this.settings) this.settings[key] = value;
        }
      }
      return route.fulfill({ json: this.settings });
    }
    if (path === '/api/history/index.bin') return binary('history-index.bin');
    if (path === '/api/history/recent.bin') return binary('history-recent.bin');
    if (path === '/api/history/000000.slog') return binary('shot.slog');
    if (path === '/api/profiles/image') return route.fulfill({ status: 404 });
    if (path === '/api/scales/list') return route.fulfill({ json: recorded.scales });
    if (path === '/api/scales/info') return route.fulfill({ json: recorded.scaleInfo });

    this.violations.push(`unmocked REST call: ${request.method()} ${path}${url.search}`);
    return route.fulfill({ status: 404 });
  }
}
