// Validators for the WebSocket messages documented in docs/websocket-api.yaml.
// The contract and the JSON schemas it references (schema/*.json) are loaded under one
// base URL so their relative $refs resolve.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { load } from 'js-yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const base = 'https://gaggimate.local/';
const contractId = `${base}docs/websocket-api.yaml`;

// The shared schemas carry their own $id; re-home them at their repo path so the contract's
// relative $refs find them and their internal #/definitions refs resolve inside them.
function loadSchema(file) {
  const { $schema, ...schema } = JSON.parse(readFileSync(join(root, file), 'utf8'));
  return { ...schema, $id: base + file };
}

const contract = load(readFileSync(join(root, 'docs/websocket-api.yaml'), 'utf8'));

// strict: false because AsyncAPI schema objects allow keywords JSON Schema doesn't (examples, readOnly, ...).
const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(contract, contractId);
for (const file of ['schema/profile.json', 'schema/shot_notes.json']) {
  ajv.addSchema(loadSchema(file));
}

function messageNames(operation) {
  return contract.channels['/ws'][operation].message.oneOf.map(ref => ref.$ref.split('/').pop());
}

// Maps each message type to its validator, for one direction.
function validators(operation) {
  const byType = new Map();
  for (const name of messageNames(operation)) {
    const validate = ajv.compile({ $ref: `${contractId}#/components/messages/${name}/payload` });
    let { payload } = contract.components.messages[name];
    if (payload.$ref) payload = contract.components.schemas[payload.$ref.split('/').pop()];
    for (const type of payload.properties.tp.enum) {
      byType.set(type, validate);
    }
  }
  return byType;
}

const fromDevice = validators('subscribe');
const toDevice = validators('publish');

/**
 * Checks a message against the contract.
 * @param {'fromDevice' | 'toDevice'} direction
 * @param {any} message Parsed JSON message.
 * @returns {string | null} A description of the violation, or null when valid.
 */
export function checkMessage(direction, message) {
  const validate = (direction === 'fromDevice' ? fromDevice : toDevice).get(message?.tp);
  const label = direction === 'fromDevice' ? 'device -> UI' : 'UI -> device';
  if (!validate) return `${label}: ${message?.tp} is not in the contract`;
  if (validate(message)) return null;
  const details = validate.errors.map(e => `${e.instancePath || '/'} ${e.message}`).join('; ');
  return `${label}: ${message.tp} does not match the contract: ${details}`;
}
