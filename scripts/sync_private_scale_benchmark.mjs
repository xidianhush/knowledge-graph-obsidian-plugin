// Explicit opt-in. Uses only synthetic data in an isolated directory.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {fixture, vault} from './sync-local-work-test-helpers.mjs';
import {testLocalApp} from './sync-host-test-helpers.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';
import {syncContentHash} from '../src/sync/persistence-prototype.mjs';
import {cloneBoundedSyncJson} from '../src/sync/causal-prototype.mjs';
import {PRIVATE_STORE_BUDGET as limits} from '../src/sync/private-store-budget-prototype.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = path.join(root, '.local/sync-016/a3/private-scale');
await fs.mkdir(base, {recursive:true});
const run = await fs.mkdtemp(path.join(base, 'sample-'));
const directory = path.join(run, 'private');
const backend = createNodeSyncStore(directory);
const realInventory = backend.inventory;
const realRead = backend.read;
let scans = 0, inventoryMs = 0;
let timings = {};
function count(name, started) {
  const entry = timings[name] ??= {calls:0, ms:0};
  entry.calls++;
  entry.ms += performance.now() - started;
}
backend.read = async (name, budget) => {
  const start = performance.now();
  try { return await realRead(name, budget); }
  finally { count('read:' + name.split('/')[0], start); }
};
for (const method of ['verify', 'digest']) {
  const original = crypto.subtle[method].bind(crypto.subtle);
  crypto.subtle[method] = async (...args) => {
    const start = performance.now();
    try { return await original(...args); }
    finally { count('crypto:' + method, start); }
  };
}
backend.inventory = async options => {
  scans++;
  const start = performance.now();
  try { return await realInventory(options); }
  finally { inventoryMs += performance.now() - start; }
};
const app = testLocalApp();
for (const method of ['loadLocalStorage','saveLocalStorage']) {
  const original = app[method];
  app[method] = (...args) => {
    const start = performance.now();
    try { return original(...args); }
    finally { count('app:' + method, start); }
  };
}
const test = await fixture({backend: () => backend, app});
const snapshot = test.current().session.state();
await test.controller.disable();

// Construct a valid synthetic journal offline so setup is independent of the
// quota implementation being measured. Replay still checks every event and blob.
const installation = test.base.state().installation;
const body = JSON.stringify(cloneBoundedSyncJson({
  version:1, settingsDraft:null, layoutDraft:null, uiPending:{}, pendingSave:null,
}));
const hash = await syncContentHash(body);
const blob = 'blobs/' + hash + '.json';
await fs.writeFile(path.join(directory, blob), await test.base.seal(vault, blob, body), {flag:'wx'});
let previous = snapshot.head;
for (let sequence = snapshot.sequence + 1; sequence < limits.softEvents; sequence++) {
  const name = 'events/' + String(sequence).padStart(12, '0') + '.json';
  const record = JSON.stringify(cloneBoundedSyncJson({
    version:1, installation, vault, sequence, previous, kind:'local-state', data:{hash},
  }));
  await fs.writeFile(path.join(directory, name), await test.base.seal(vault, name, record), {flag:'wx'});
  previous = await syncContentHash(record);
}
const seeded = await realInventory();
const fillers = limits.softFiles - seeded.files.length - 1;
let remaining = limits.softBytes - seeded.bytes - 512;
await fs.mkdir(path.join(directory, 'orphan'));
for (let i = 0; i < fillers; i++) {
  const size = Math.floor(remaining / (fillers - i));
  const name = 'orphan/' + String(i).padStart(4, '0');
  await fs.writeFile(path.join(directory, name), Buffer.alloc(size, 120), {flag:'wx'});
  remaining -= size;
}
const stages = {};
async function measure(name, work) {
  scans = 0;
  inventoryMs = 0;
  timings = {};
  const start = performance.now();
  const value = await work();
  stages[name] = {
    ms:Math.round(performance.now() - start), inventoryCalls:scans,
    inventoryMs:Math.round(inventoryMs),
    timings:Object.fromEntries(Object.entries(timings).map(([key, item]) =>
      [key, {calls:item.calls, ms:Math.round(item.ms)}])),
  };
  return value;
}
const before = await realInventory();
assert.equal(before.bytes, limits.softBytes - 512);
assert.equal(before.files.length, limits.softFiles - 1);
const cold = await test.make();
await measure('open', () => cold.host.open());
assert.equal(cold.controller.state().status, 'local-ready');
assert.equal(cold.current().session.state().sequence, limits.softEvents - 1);
const saved = await measure('saveUi', () => cold.host.saveUi('legend', true));
assert.equal(saved.value?.kind, 'saved');
assert.equal(saved.status.paused, true);
assert.equal((await cold.host.saveUi('legend', false)).kind, 'held');
assert.equal((await cold.host.view()).data.ui.legend, 'true');
await cold.controller.disable();
const reopened = await test.make();
await measure('reopenPaused', () => reopened.host.open());
assert.equal(reopened.controller.state().status, 'local-paused');
assert.equal((await reopened.host.view()).data.ui.legend, 'true');
assert.equal(test.sharedCalls(), 0);
await reopened.controller.disable();
const report = {
  date:'2026-11-09 Asia/Shanghai', label:process.argv[2] || 'sample',
  node:process.version, platform:process.platform,
  initial:{bytes:before.bytes, files:before.files.length, events:limits.softEvents - 1},
  stages, processMaxRssKiB:process.resourceUsage().maxRSS,
  scope:'Node disk and signed journal, synthetic filler files, App storage and locks are test substitutes',
};
await fs.writeFile(path.join(run, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({run, ...report}));
