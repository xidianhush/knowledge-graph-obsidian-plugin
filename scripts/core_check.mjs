import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GraphCore, decodeGraphPayload } from '../dist/graph-core.mjs';
import { buildGraph, encodeGraphPayload } from '../dist/pipeline.mjs';
// Clean clones use public synthetic input; private snapshot regression is opt-in.
const encoded = process.argv.includes('--private-snapshot')
  ? JSON.parse(fs.readFileSync(new URL('../.local/smoke-payload.json', import.meta.url)))
  : encodeGraphPayload(buildGraph({files:[
      {path:'Demo/One.md',text:'# Parent\n## Child\nbody [[Two]]'},
      {path:'Demo/Two.md',text:'# Target\nbody'},
    ],config:{include:['Demo/**']}}));
const source = JSON.stringify(encoded);
const decoded = decodeGraphPayload(encoded);
assert.equal(JSON.stringify(encoded), source);
assert.deepEqual(decodeGraphPayload(decoded), decoded);
assert.equal(decoded.nodes.length, encoded.nodes.length);
assert.equal(decoded.edges.length, encoded.edges.length);
assert.ok(decoded.nodes.some(n => typeof n.parent === 'string'));
assert.ok(decoded.edges.some(e => typeof e.s === 'string' && typeof e.type === 'string'));
assert.throws(() => decodeGraphPayload({}), /nodes/);
assert.throws(() => decodeGraphPayload({nodes:[], edges:[], meta:{codec:'unknown'}}), /Unsupported/);

// Deterministic scheduler: pause must cancel native callbacks, retain pending work,
// resume exactly once, and refuse new work after disposal.
let sequence = 0, now = 0, calls = 0;
const scheduled = new Map();
const platform = { requestFrame(fn) { const id = ++sequence; scheduled.set(id, fn); return id; },
  cancelFrame(id) { scheduled.delete(id); }, now: () => now };
const core = new GraphCore({canvas: {}, payload: encoded, platform});
core.requestFrame(() => calls++);
assert.equal(scheduled.size, 1);
core.pause(); core.pause(); assert.equal(scheduled.size, 0);
core.resume(); core.resume(); assert.equal(scheduled.size, 1);
for (const [id, fn] of scheduled) { scheduled.delete(id); fn(++now); }
assert.equal(calls, 1); assert.equal(core.diagnostics().frames, 0);
core.requestFrame(() => calls++);
core.dispose(); core.dispose(); core.resume(); core.resize();
assert.equal(scheduled.size, 0); assert.equal(core.requestFrame(() => calls++), 0);
assert.equal(core.data, null); assert.equal(core.canvas, null);
assert.equal(core.diagnostics().active, false);
assert.throws(() => core.mount(), /only once/);
let ownedListeners = 0;
const failingPlatform = { ...platform,
  listenCanvas() { ownedListeners++; return () => ownedListeners--; },
  listenGlobal() { throw new Error('Simulated host subscription failure'); },
};
const failedCore = new GraphCore({ canvas: { getContext: () => ({}), style: {} }, payload: encoded, platform: failingPlatform });
assert.throws(() => failedCore.mount(), /Simulated host/);
assert.equal(ownedListeners, 0);
assert.equal(failedCore.diagnostics().disposed, true);
assert.equal(failedCore.diagnostics().frames, 0);
console.log('CORE_CHECK: codec immutability/idempotence, validation, scheduler lifecycle passed');
