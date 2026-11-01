// Independent verification helpers for 47-A3 (schema3 note-level structure sharing).
// Scope: read-only against src/, tests/, scripts/, dist/. New files only.
// Tolerates the 0.0.10 contract (reconcile -> plain groups map) and the schema3
// contract (reconcile -> {groups, structures}); apply() must still accept plain groups.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {buildGraph} from '../dist/pipeline.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const EVIDENCE = path.join(ROOT, '.local', 'evidence', 'schema3');
export const DIST_CORE = path.join(ROOT, 'dist', 'graph-core.mjs');
export const FROZEN_010 = path.join(ROOT, 'tests', 'fixtures', 'graph-core-0.0.10.mjs');
export const FROZEN_009 = path.join(ROOT, 'tests', 'fixtures', 'graph-core-0.0.9.mjs');
export const TOL = 1e-7;

// Published 0.0.10 / 0.0.9 max record bytes (MB, decimal) and layout+json p50 ms
// from LAYOUT_SCALE_RESULT.md; used only to validate this harness' conventions.
export const PUBLISHED = {
  '1000/1/1': {mb009: 0.677, mb010: 0.226, ms010: 6.0},
  '1000/1/10': {mb009: 6.772, mb010: 2.264, ms010: 41.8},
  '5000/1/1': {mb009: 3.469, mb010: 1.150, ms010: 31.0},
  '5000/1/10': {mb009: 34.693, mb010: 11.497, ms010: 234.2},
  '5000/50/50': {mb009: 3.403, mb010: 1.190, ms010: 28.3},
};

export function sha256File(file) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); } catch { return null; }
}
export function exists(file) { return fs.existsSync(file); }
export async function importFile(file) {
  if (!fs.existsSync(file)) return null;
  return import(pathToFileURL(file).href);
}
export function graphOf(files, include = ['**']) { return buildGraph({files, config: {include}}); }
export function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}
export function ratio(a, b) { return b === 0 ? (a === 0 ? 1 : Infinity) : +(a / b).toFixed(4); }
export function round9(value) { return Math.round(value * 1e9) / 1e9; }
export function geometryOf(nodes) { return nodes.map(n => [round9(n.x), round9(n.y)]); }
export function bytesOf(value) { return Buffer.byteLength(JSON.stringify(value)); }
export function bytesMB(bytes) { return +(bytes / 1e6).toFixed(3); }

// ---------- reconcile / apply adapters (0.0.10 plain map OR schema3 container) ----------
export function validGroupKeys(groups) {
  if (!groups || typeof groups !== 'object' || Array.isArray(groups)) return false;
  return Object.keys(groups).every(key => key.startsWith('['));
}
export function normalizeReconcile(result) {
  if (result && typeof result === 'object' && !Array.isArray(result) &&
      Object.hasOwn(result, 'groups') && result.groups && typeof result.groups === 'object' &&
      !Array.isArray(result.groups)) {
    return {form: 'container', container: result, groups: result.groups, structures: result.structures ?? null};
  }
  return {form: 'plain', container: null, groups: result, structures: null};
}
// previous: {form, container, groups, structures}; the output form is fed back in
// the same shape it was emitted in (persistable data), with a guarded fallback.
export function reconcileWith(model, previous) {
  const input = previous.form === 'container'
    ? (previous.container ?? {groups: previous.groups, structures: previous.structures})
    : previous.groups;
  let next = normalizeReconcile(model.reconcile(input));
  let inputFallback = null;
  if (previous.form === 'container' && !validGroupKeys(next.groups)) {
    const retry = normalizeReconcile(model.reconcile(previous.groups));
    if (validGroupKeys(retry.groups)) { next = retry; inputFallback = 'groups'; }
  }
  return {...next, inputFallback};
}
// Contract under test: apply() accepts the persisted groups map on its own.
export function applyWith(model, view) {
  const groups = view?.groups ?? view ?? {};
  const structures = view?.structures ?? null;
  if (typeof model.apply !== 'function') throw new Error('layout model has no apply()');
  let result = model.apply(groups) ?? {};
  let fallback = null;
  if ((result.restored ?? 0) === 0 && structures && Object.keys(groups).length) {
    for (const [name, call] of [
      ['apply(groups, structures)', () => model.apply(groups, structures)],
      ['apply({groups, structures})', () => model.apply({groups, structures})],
    ]) {
      try {
        const alt = call();
        if (alt && alt.restored > 0) { result = alt; fallback = name; break; }
      } catch {}
    }
  }
  return {restored: result.restored ?? 0, skipped: result.skipped ?? 0, applyFallback: fallback};
}

// ---------- persisted data helpers ----------
const RESERVED_FIELDS = new Set(['schemaVersion', 'revision', 'groups', 'busy', 'locked', 'canUndo', 'canRedo', 'message', 'unsupported']);
// Finds the shared structure table in a reconciled container or a persisted object
// without assuming the field name chosen by the implementation.
export function structureTable(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (data.structures && typeof data.structures === 'object' && !Array.isArray(data.structures)) {
    return {field: 'structures', table: data.structures};
  }
  for (const [field, value] of Object.entries(data)) {
    if (RESERVED_FIELDS.has(field)) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const entries = Object.entries(value);
    if (entries.length && entries.every(([, entry]) => entry && typeof entry === 'object')) {
      return {field, table: value};
    }
  }
  return null;
}
export function storeView(state, disk) {
  const table = structureTable(disk)?.table ?? structureTable(state)?.table ?? null;
  return {groups: state.groups, structures: table};
}
// Persistable shape a store would write for this reconcile output.
export function persistedOf(norm) {
  if (norm.form === 'container') return norm.container ?? {groups: norm.groups, structures: norm.structures};
  return {groups: norm.groups};
}
export function makeStore(api, initial) {
  const record = {writes: 0, disk: null, fail: false, failedWrites: 0};
  const store = api.createLayoutStore(initial, async data => {
    if (record.fail) { record.failedWrites++; throw new Error('disk full'); }
    record.writes++;
    record.disk = structuredClone(data);
  });
  return {store, record};
}

// ---------- comparison ----------
// Numbers compare with absolute tolerance 1e-7 (counts/ints are >=1 apart when they
// differ, so integer regressions are still caught); everything else is exact.
export function deepDiff(expected, actual, path = 'root', diffs = []) {
  if (typeof expected === 'number' && typeof actual === 'number') {
    if (!Number.isFinite(expected) || !Number.isFinite(actual)) {
      if (!Object.is(expected, actual)) diffs.push({path, baseline: expected, schema3: actual});
    } else if (Math.abs(expected - actual) > TOL) {
      diffs.push({path, baseline: expected, schema3: actual, delta: expected - actual});
    }
    return diffs;
  }
  if (expected === null || actual === null || typeof expected !== 'object' || typeof actual !== 'object') {
    if (!Object.is(expected, actual)) diffs.push({path, baseline: expected, schema3: actual});
    return diffs;
  }
  if (Array.isArray(expected) !== Array.isArray(actual)) {
    diffs.push({path, baseline: expected, schema3: actual});
    return diffs;
  }
  if (Array.isArray(expected)) {
    if (expected.length !== actual.length) {
      diffs.push({path, baseline: `length ${expected.length}`, schema3: `length ${actual.length}`});
    }
    for (let i = 0; i < Math.min(expected.length, actual.length); i++) deepDiff(expected[i], actual[i], `${path}[${i}]`, diffs);
    return diffs;
  }
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const key of keys) {
    const inExpected = Object.hasOwn(expected, key), inActual = Object.hasOwn(actual, key);
    if (!inExpected || !inActual) {
      diffs.push({path: `${path}.${key}`, baseline: expected[key], schema3: actual[key], missing: inExpected ? 'schema3' : 'baseline'});
      continue;
    }
    deepDiff(expected[key], actual[key], `${path}.${key}`, diffs);
  }
  return diffs;
}
export function sameJson(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
export function positionsByTitle(nodes) {
  const map = {};
  for (const node of nodes) {
    if (!node.title) continue;
    const base = String(node.title);
    let key = base;
    for (let i = 2; Object.hasOwn(map, key); i++) key = `${base}#${i}`;
    map[key] = [round9(node.x), round9(node.y)];
  }
  return map;
}

// ---------- core probe ----------
export function probeCore(api) {
  const graph = graphOf([{path: 'Probe/A.md', text: '# A\n## B\nbody b\n# C\nbody c'}]);
  const nodes = graph.nodes;
  const model = api.createLayoutModel(nodes, graph.meta.layout_root_radius);
  const editor = api.createLayoutEditor(nodes, graph.meta.layout_root_radius);
  const target = nodes.find(node => node.title === 'A');
  const beginError = editor.begin(target.id);
  editor.move(target.x + 5, target.y + 3);
  editor.commit();
  const key = model.groupKey(target.id);
  const record = model.capture(key);
  const norm = normalizeReconcile(model.reconcile({[key]: record}));
  const sample = norm.groups?.[key] ?? record ?? {};
  const table = structureTable(norm.container) ?? null;
  const structureKeys = table ? Object.keys(table.table) : [];
  const firstStructure = structureKeys.length ? table.table[structureKeys[0]] : null;
  const firstStructureKeys = firstStructure && typeof firstStructure === 'object' ? Object.keys(firstStructure).sort() : [];
  const applied = applyWith(model, {groups: norm.groups ?? {}, structures: table?.table ?? null});
  return {
    groupReturnForm: norm.form,
    reconcileOutputKeys: Object.keys(norm.groups ?? {}).length,
    modelMethods: Object.keys(model).sort(),
    recordKeys: Object.keys(sample).sort(),
    recordHasInlineIdentity: Object.hasOwn(sample, 'identity'),
    recordHasInlineOutline: Object.hasOwn(sample, 'outline'),
    structureTableField: table?.field ?? null,
    structureCount: structureKeys.length,
    structureKeys: structureKeys.slice(0, 4),
    structureEntryKeys: firstStructureKeys,
    structureValueTypes: firstStructureKeys.map(name => typeof firstStructure[name]),
    applyPure: applied,
    beginError,
  };
}
export function isSchema3Probe(probe) {
  return probe.groupReturnForm === 'container' || probe.structureCount > 0;
}

// ---------- evidence IO ----------
export function writeEvidence(name, data) {
  fs.mkdirSync(EVIDENCE, {recursive: true});
  fs.writeFileSync(path.join(EVIDENCE, name), JSON.stringify(data, null, 2));
  return path.join(EVIDENCE, name);
}
export function readEvidence(name) {
  try { return JSON.parse(fs.readFileSync(path.join(EVIDENCE, name), 'utf8')); } catch { return null; }
}
export function runtimeInfo() {
  return {node: process.version, platform: `${process.platform}/${process.arch}`,
    execArgv: process.execArgv, gcExposed: typeof global.gc === 'function'};
}
export function memorySnapshot() {
  const usage = process.memoryUsage();
  return {heapUsed: usage.heapUsed, heapTotal: usage.heapTotal, rss: usage.rss, external: usage.external};
}
