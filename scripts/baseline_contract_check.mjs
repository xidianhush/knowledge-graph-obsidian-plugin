import assert from 'node:assert/strict';
import { validateBaselineRecord } from './baseline-contract.mjs';
const value = {
  experience: 'a'.repeat(40),
  recovery: 'b'.repeat(40),
  published: 'c'.repeat(40),
  activeBranch: 'codex/baseline-convergence',
  runtimeVersion: '0.0.17',
  syncMode: 'one-switch',
};
assert.doesNotThrow(() => validateBaselineRecord(value));
for (const change of [
  { experience: 'HEAD' },
  { syncMode: 'manual' },
  { runtimeVersion: '0.0.16' },
  { activeBranch: 'main' },
])
  assert.throws(() => validateBaselineRecord({ ...value, ...change }));
console.log('Baseline identity contract passed');
