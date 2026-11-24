// Isolated A4 transport experiment. The v2 runtime continues to use its existing contract.
import {CAUSAL_PROTOTYPE_LIMITS as limits, cloneBoundedSyncJson} from '../src/sync/causal-prototype.mjs';
import {inspectSchema3History} from '../src/sync/layout-prototype.mjs';

const idPattern = /^[a-f0-9]{32}$/;
const filenamePattern = /^([a-f0-9]{32})\.([a-f0-9]{64})\.([a-f0-9]{32})\.json$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true});

function canonicalBytes(operation) {
  return encoder.encode(JSON.stringify(cloneBoundedSyncJson(operation, {maxBytes: limits.recordBytes})));
}

async function digest(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

function isPrefix(prefix, full) {
  return prefix.length <= full.length && prefix.every((byte, i) => byte === full[i]);
}

export function attemptDirectory(vault) {
  if (typeof vault !== 'string' || !idPattern.test(vault)) throw Error('attempt-vault');
  return 'Knowledge Map Sync/a4-attempt-probe/' + vault;
}

function isEnvelope(operation, vault) {
  return operation?.protocol === 2 && operation.layoutSchema === 3 && operation.vault === vault &&
    typeof operation.id === 'string' && idPattern.test(operation.id);
}

export async function makeAttempt(vault, operation, nonce) {
  const directory = attemptDirectory(vault);
  if (!isEnvelope(operation, vault) || typeof nonce !== 'string' || !idPattern.test(nonce)) {
    throw Error('attempt-envelope');
  }
  const bytes = canonicalBytes(operation);
  const hash = await digest(bytes);
  return {name: directory + '/' + operation.id + '.' + hash + '.' + nonce + '.json', bytes};
}

export async function inspectAttempts(store, vault) {
  const directory = attemptDirectory(vault);
  const prefix = directory + '/';
  const names = await store.list(directory);
  if (names.length > limits.operations) throw Error('attempt-file-budget');
  if (new Set(names).size !== names.length) throw Error('attempt-duplicate-listing');
  const records = [];
  const incomplete = [];
  const blockers = [];
  const completeBodies = new Map();
  let total = 0;
  for (const name of [...names].sort()) {
    const match = typeof name === 'string' && name.startsWith(prefix) && filenamePattern.exec(name.slice(prefix.length));
    if (!match) {
      blockers.push({name, reason: 'unknown-file-name'});
      continue;
    }
    const [, id, expected] = match;
    const bytes = await store.read(name, Math.min(limits.recordBytes, limits.totalBytes - total));
    if (bytes === null) {
      blockers.push({name, reason: 'file-vanished'});
      continue;
    }
    if (!(bytes instanceof Uint8Array) || bytes.length > limits.recordBytes) throw Error('attempt-record-budget');
    total += bytes.length;
    if (total > limits.totalBytes) throw Error('attempt-total-budget');
    const key = id + '.' + expected;
    if (await digest(bytes) !== expected) {
      incomplete.push({name, bytes, key});
      continue;
    }
    let operation;
    try {
      operation = JSON.parse(decoder.decode(bytes));
      const canonical = canonicalBytes(operation);
      if (operation?.id !== id || !isEnvelope(operation, vault) ||
          canonical.length !== bytes.length || !isPrefix(bytes, canonical)) throw Error('body');
    } catch {
      blockers.push({name, reason: 'invalid-complete-body'});
      continue;
    }
    records.push(operation);
    completeBodies.set(key, bytes);
  }
  const superseded = [];
  for (const entry of incomplete) {
    const full = completeBodies.get(entry.key);
    if (full && isPrefix(entry.bytes, full)) superseded.push(entry.name);
    else blockers.push({name: entry.name, reason: 'unverified-bytes'});
  }
  return {
    transportReady: blockers.length === 0,
    index: inspectSchema3History(records, {vault}).index,
    blockers,
    superseded,
  };
}
