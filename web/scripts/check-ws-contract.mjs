// Checks that docs/websocket-api.yaml covers every WebSocket message type used by the
// firmware (src/display) and the web UI (web/src), and documents nothing that is gone.
// Message types are collected from string literals, so a type built at runtime (a prefix
// literal concatenated, interpolated or formatted into a type) is invisible here and is an
// error. Matching on a prefix with startsWith() is allowed, and so is building res:<x> from
// a req:<x> reply, since a res:<x> counts as used when req:<x> is.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const contractPath = join(root, 'docs/websocket-api.yaml');

function walk(dir, exts) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path, exts);
    return exts.includes(extname(entry.name)) ? [path] : [];
  });
}

// Collects message types from string literals, mapped to the first file using each.
// Literals that start a type without being a whole one are recorded in `built`.
function collect(files, literal, built) {
  const types = new Map();
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(literal)) {
      const [whole, quote, type, next] = match;
      const before = source.slice(0, match.index);
      const lineStart = before.slice(before.lastIndexOf('\n') + 1);
      if (/^\s*(\/\/|\/?\*)/.test(lineStart) || /startsWith\(\s*$/.test(before)) continue;
      const after = source.slice(match.index + whole.length);
      const isWhole = next === quote && !type.endsWith(':') && !/^\s*\+/.test(after);
      if (isWhole) {
        if (!types.has(type)) types.set(type, relative(root, file));
      } else if (type !== 'res:') {
        built.push(`${relative(root, file)}:${before.split('\n').length}`);
      }
    }
  }
  return types;
}

const contract = readFileSync(contractPath, 'utf8');
const documented = new Set(
  [...contract.matchAll(/(['"])((?:req|res|evt):[a-z0-9:-]+)\1/g)].map(match => match[2]),
);
const built = [];
const firmware = collect(
  walk(join(root, 'src/display'), ['.cpp', '.h']),
  /(")((?:req|res|evt):[a-z0-9:-]*)(.)/g,
  built,
);
const web = collect(
  walk(join(root, 'web/src'), ['.js', '.jsx']),
  /(['`])((?:req|res|evt):[a-z0-9:-]*)(.)/g,
  built,
);

const usedByFirmware = type =>
  firmware.has(type) || (type.startsWith('res:') && firmware.has(`req:${type.slice(4)}`));

const errors = built.map(
  location =>
    `${location} builds a message type at runtime; spell out each type as a full string literal`,
);
for (const [type, file] of firmware) {
  if (!documented.has(type)) errors.push(`${type} (used in ${file}) is not documented`);
}
for (const [type, file] of web) {
  if (!documented.has(type)) errors.push(`${type} (used in ${file}) is not documented`);
  if (!usedByFirmware(type))
    errors.push(`${type} (used in ${file}) is not sent or handled by the firmware`);
}
for (const type of documented) {
  if (!usedByFirmware(type)) errors.push(`${type} is documented but not used by the firmware`);
}

// Every message definition must be listed in a channel, and every listed one defined.
const defined = new Set(
  [...contract.split(/^ {2}messages:$/m)[1].matchAll(/^ {4}(\w+):$/gm)].map(match => match[1]),
);
const referenced = new Set(
  [...contract.matchAll(/\$ref: ['"]#\/components\/messages\/(\w+)['"]/g)].map(match => match[1]),
);
for (const name of defined) {
  if (!referenced.has(name)) errors.push(`message ${name} is defined but not listed in a channel`);
}
for (const name of referenced) {
  if (!defined.has(name)) errors.push(`message ${name} is listed in a channel but not defined`);
}

if (errors.length) {
  console.error(`WebSocket contract (docs/websocket-api.yaml) is out of sync:\n`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(
  `WebSocket contract OK: ${documented.size} message types, ${firmware.size} in firmware, ${web.size} in web UI.`,
);
