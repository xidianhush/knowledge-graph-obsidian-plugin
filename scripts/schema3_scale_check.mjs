// Independent schema-3 scale/memory check (47-A3).
// Mirrors scripts/layout_scale_ab.mjs conventions exactly for the 0.0.10 baseline gate:
// same synthetic notes, same seed drags, same 12 alternating steps, 4 warmup + 8 measured.
// Adds schema3 persisted-byte accounting (groups + shared structures table), retained
// heap probes (needs --expose-gc) and the 5000/1/10 structure-sharing boundary checks.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {buildGraph} from '../dist/pipeline.mjs';
import * as candidate from '../dist/graph-core.mjs';
import * as baseline from '../tests/fixtures/graph-core-0.0.10.mjs';
import {
  PUBLISHED, EVIDENCE, DIST_CORE, FROZEN_010, sha256File, percentile, bytesMB,
} from './schema3_common.mjs';

const TOL = 1e-7;
const scenarios = [
  {headings: 1000, notes: 1, groups: 1},
  {headings: 1000, notes: 1, groups: 10},
  {headings: 5000, notes: 1, groups: 1},
  {headings: 5000, notes: 1, groups: 10},
  {headings: 5000, notes: 50, groups: 50},
];
const scenarioKey = s => `${s.headings}/${s.notes}/${s.groups}`;
const now = () => performance.now();
const clone = value => structuredClone(value);
const gcAvailable = typeof global.gc === 'function';

const candidateSha = sha256File(DIST_CORE);
const frozenSha = sha256File(FROZEN_010);
const schema3Available = !!candidateSha && candidateSha !== frozenSha;
const mode = schema3Available ? 'schema3-vs-0.0.10' : 'baseline-only (dist still 0.0.10)';

fs.mkdirSync(EVIDENCE, {recursive: true});

// ---------- seeding ----------
// Lift the transient capture record into the persisted schema-3 container exactly like
// layoutPutRecord(): identity goes into the per-note structures table, the group record
// keeps shape/points/note/structure. trim() drops tables no group references.
function persistCaptured(entries) {
  const groups = {}, structures = {};
  for (const [key, record] of entries) {
    const clean = {shape: record.shape};
    if (Array.isArray(record.points)) clean.points = record.points;
    if (record.repair) clean.repair = record.repair;
    if (record.note) {
      if (Array.isArray(record.identity)) structures[record.note] = clone(record.identity);
      clean.note = record.note;
      if (record.structure != null) clean.structure = record.structure;
    } else if (Array.isArray(record.identity)) {
      clean.identity = record.identity;
    }
    groups[key] = clean;
  }
  return {groups, structures};
}

function seedDrag(api, nodes, radius, scenario, include) {
  const model = api.createLayoutModel(nodes, radius);
  const editor = api.createLayoutEditor(nodes, radius);
  const entries = [];
  for (let i = 0; i < scenario.groups; i++) {
    const note = i % scenario.notes;
    const heading = Math.floor(i / scenario.notes) * 10 + 1;
    const node = nodes.find(n => n.id === `Scale/Note${note}#H${heading - 1}/H${heading}`);
    assert.ok(node, `seed node missing for group ${i}`);
    assert.equal(editor.begin(node.id), null);
    editor.move(node.x + 1, node.y + 1);
    editor.commit();
    const key = model.groupKey(node.id);
    const record = model.capture(key);
    assert.ok(record, 'fixture must contain a real adjustment');
    entries.push([key, record]);
  }
  return entries;
}

// ---------- retained heap probe ----------
function probeMemory(build, bytesValue) {
  if (!gcAvailable) return null;
  global.gc();
  const before = process.memoryUsage().heapUsed;
  const keep = build();
  const bytes = Buffer.byteLength(JSON.stringify(bytesValue === undefined ? keep : bytesValue));
  global.gc();
  const after = process.memoryUsage().heapUsed;
  return {bytes, heapDeltaBytes: after - before, keep};
}
function retainedHeap(build) {
  if (!gcAvailable) return null;
  global.gc();
  const before = process.memoryUsage().heapUsed;
  const keep = build();
  global.gc();
  const after = process.memoryUsage().heapUsed;
  // keep is returned so the caller holds it alive while `after` is sampled.
  return {heapUsedBefore: before, heapUsedAfter: after, deltaBytes: after - before, keep};
}

function summarise(samples) {
  const measured = samples.filter(s => !s.warmup);
  return {
    samples: measured.length,
    maxGroupsBytes: Math.max(...measured.map(s => s.groupsBytes)),
    maxStructuresBytes: Math.max(...measured.map(s => s.structuresBytes)),
    maxPersistedBytes: Math.max(...measured.map(s => s.persistedBytes)),
    medianModelMs: percentile(measured.map(s => s.modelMs), .5),
    medianReconcileApplyMs: percentile(measured.map(s => s.reconcileApplyMs), .5),
    medianJsonRoundtripMs: percentile(measured.map(s => s.jsonRoundtripMs), .5),
    medianLayoutAndJsonMs: percentile(measured.map(s => s.modelMs + s.reconcileApplyMs + s.jsonRoundtripMs), .5),
    p95ModelMs: percentile(measured.map(s => s.modelMs), .95),
    p95ReconcileApplyMs: percentile(measured.map(s => s.reconcileApplyMs), .95),
    p95JsonRoundtripMs: percentile(measured.map(s => s.jsonRoundtripMs), .95),
    p95LayoutAndJsonMs: percentile(measured.map(s => s.modelMs + s.reconcileApplyMs + s.jsonRoundtripMs), .95),
    maxRestored: Math.max(...measured.map(s => s.restored)),
    maxSkipped: Math.max(...measured.map(s => s.skipped)),
  };
}

const rows = [];
const output = {
  date: new Date().toISOString(),
  runtime: process.version,
  mode,
  distSha256: candidateSha,
  frozen010Sha256: frozenSha,
  schema3Available,
  gcAvailable,
  scope: 'Core only (layoutModel + reconcile + apply + JSON roundtrip). Same generator/seed/steps as '
    + 'scripts/layout_scale_ab.mjs; 4 warmup + 8 measured per version/scenario; no Worker, UI, store or disk IO. '
    + 'groupsBytes excludes the persisted envelope; persistedBytes includes {schemaVersion,revision,groups[,structures]}. '
    + 'Heap delta = gc()-separated heapUsed difference of retaining the cloned persisted state.',
  scenarios: rows,
};

for (const scenario of scenarios) {
  const key = scenarioKey(scenario);
  const perNote = scenario.headings / scenario.notes;
  const text = Array.from({length: perNote}, (_, i) => `${i % 10 ? '##' : '#'} H${i}\nbody ${i}`).join('\n');
  const files = Array.from({length: scenario.notes}, (_, i) => ({path: `Scale/Note${i}.md`, text}));
  const build = list => buildGraph({files: list, config: {include: ['Scale/**']}});
  const initial = build(files);
  const radius = initial.meta.layout_root_radius;
  const pristine = initial.nodes.map(n => clone(n));

  const baselineEntries = seedDrag(baseline, pristine.map(n => clone(n)), radius, scenario);
  let baselineRecords = Object.fromEntries(baselineEntries);
  let candidateRecords = null;
  if (schema3Available) {
    candidateRecords = persistCaptured(seedDrag(candidate, pristine.map(n => clone(n)), radius, scenario));
    assert.ok(Object.keys(candidateRecords.groups).length === scenario.groups);
    assert.ok(Object.keys(candidateRecords.structures).length >= 1);
  }

  const samples = [];
  const geometries = {};
  for (let step = 0; step < 12; step++) {
    const edited = step % 4 === 0 ? text.replace('H1\n', 'Renamed\n') : step % 4 === 2 ? text + '\n# Added\nextra' : text;
    const started = now();
    const graph = build(files.map((f, i) => (i === 0 ? {...f, text: edited} : f)));
    const buildMs = now() - started;
    const versions = step % 2 ? ['schema3', 'baseline'] : ['baseline', 'schema3'];
    for (const version of versions) {
      if (version === 'schema3' && !schema3Available) continue;
      const data = clone(graph);
      let at = now();
      const model = (version === 'baseline' ? baseline : candidate).createLayoutModel(data.nodes, data.meta.layout_root_radius);
      const modelMs = now() - at;

      at = now();
      let applied;
      if (version === 'baseline') {
        baselineRecords = model.reconcile(baselineRecords);
        applied = model.apply(baselineRecords);
      } else {
        candidateRecords = model.reconcile(candidateRecords);
        applied = model.apply(candidateRecords);
      }
      const reconcileApplyMs = now() - at;

      // JSON roundtrip is measured separately, matching scripts/layout_scale_ab.mjs.
      at = now();
      const encoded = JSON.stringify(version === 'baseline' ? baselineRecords : candidateRecords);
      const parsed = JSON.parse(encoded);
      const jsonRoundtripMs = now() - at;
      let pureApplied = null, groupsBytes, structuresBytes, persistedBytes;
      if (version === 'baseline') {
        baselineRecords = parsed;
        groupsBytes = Buffer.byteLength(encoded);
        structuresBytes = 0;
        persistedBytes = Buffer.byteLength(JSON.stringify({schemaVersion: 2, revision: 1, groups: parsed}));
        assert.equal(applied.skipped, 0);
        assert.equal(applied.restored, scenario.groups);
        assert.equal(Object.keys(parsed).length, scenario.groups);
      } else {
        candidateRecords = parsed;
        // Contract: plain persisted groups must also restore, without the structures table.
        pureApplied = model.apply({groups: parsed.groups});
        groupsBytes = Buffer.byteLength(JSON.stringify(parsed.groups));
        structuresBytes = Buffer.byteLength(JSON.stringify(parsed.structures));
        persistedBytes = Buffer.byteLength(JSON.stringify({schemaVersion: 3, revision: 1, ...parsed}));
        assert.equal(applied.skipped, 0);
        assert.equal(applied.restored, scenario.groups);
        assert.equal(Object.keys(parsed.groups).length, scenario.groups);
        assert.equal(pureApplied.skipped, 0, `schema3 pure-groups apply skipped in ${key}`);
        assert.equal(pureApplied.restored, scenario.groups, `schema3 pure-groups apply restored in ${key}`);
        const notes = new Set();
        for (const record of Object.values(parsed.groups)) {
          assert.equal(typeof record.note, 'string');
          notes.add(record.note);
          assert.ok(Array.isArray(parsed.structures[record.note]), `missing structures entry for ${record.note}`);
        }
        for (const note of notes) assert.ok(parsed.structures[note], `unreferenced note ${note}`);
      }
      assert.ok(data.nodes.every(n => Number.isFinite(n.x + n.y + n.r)));
      geometries[version] = data.nodes.map(n => [n.x, n.y]);
      samples.push({
        step, operation: ['rename', 'restore', 'add', 'delete'][step % 4], warmup: step < 4,
        version, buildMs, modelMs, reconcileApplyMs, jsonRoundtripMs,
        groupsBytes, structuresBytes, persistedBytes, restored: applied.restored, skipped: applied.skipped,
        ...(version === 'schema3' ? {pureRestore: pureApplied.restored} : {}),
      });
    }
    if (schema3Available) {
      assert.equal(geometries.schema3.length, geometries.baseline.length);
      geometries.baseline.forEach((p, i) => assert.ok(
        Math.hypot(p[0] - geometries.schema3[i][0], p[1] - geometries.schema3[i][1]) < TOL,
        `schema3/baseline geometry differs in ${key} step ${step}`,
      ));
    }
  }

  const baselineSummary = summarise(samples.filter(s => s.version === 'baseline'));
  const candidateSummary = schema3Available ? summarise(samples.filter(s => s.version === 'schema3')) : null;
  const published = PUBLISHED[key];

  const boundary = {};
  if (schema3Available) {
    const finalGroups = candidateRecords.groups;
    const notes = [...new Set(Object.values(finalGroups).map(r => r.note))];
    const tokens = [...new Set(Object.values(finalGroups).map(r => r.structure))];
    boundary.schema3 = {
      groups: Object.keys(finalGroups).length,
      notes,
      structuresEntries: Object.keys(candidateRecords.structures).length,
      distinctStructureTokens: tokens.length,
      structureTokenSamples: tokens.slice(0, 3),
      structureTokenLengths: [...new Set(tokens.map(t => String(t).length))],
    };
    if (key === '5000/1/10') {
      // 10 groups of the same note must share exactly one structure entry + one token.
      assert.equal(notes.length, 1, '5000/1/10 groups must live in one note');
      assert.equal(Object.keys(candidateRecords.structures).length, 1, '5000/1/10 must keep one shared structure');
      assert.equal(tokens.length, 1, '5000/1/10 groups must share the same structure token');
      boundary.schema3.sharedByAllGroups = true;
    }
    if (key === '5000/50/50') {
      assert.equal(notes.length, 50, '5000/50/50 should span 50 notes');
      assert.equal(Object.keys(candidateRecords.structures).length, 50);
    }
    // Structure digest collision note: a digest/token mismatch degrades to the repair path
    // (skipped group or local repair), never silent geometry reuse for a different outline.
    boundary.collisionNote = 'structure token = 32-bit FNV-1a + 32-bit mix over JSON(relative heading keys,'
      + ' duplicate lines, heading count); a collision makes the guard reject/repair (safe), and tables are'
      + ' per-note so the birthday bound applies per note, not vault-wide.';
  }

  const heap = {
    baseline: retainedHeap(() => clone(baselineRecords)),
    schema3: schema3Available ? retainedHeap(() => clone(candidateRecords)) : null,
  };
  // Drop retained references so the next scenario starts clean.
  for (const probe of [heap.baseline, heap.schema3]) if (probe) delete probe.keep;

  // Store-level retained-memory probes: reconciled persisted view, disk envelope,
  // store.state() snapshot and the store's own retained data. Reports both JSON bytes
  // and gc()-separated heapUsed delta; ratios are schema3 / 0.0.10.
  let memory = null;
  if (schema3Available) {
    const noop = async () => {};
    const baselineDisk = {schemaVersion: 2, revision: 1, groups: baselineRecords};
    const candidateDisk = {schemaVersion: 3, revision: 1, ...candidateRecords};
    const baselineStore = baseline.createLayoutStore(clone(baselineDisk), noop);
    const candidateStore = candidate.createLayoutStore(clone(candidateDisk), noop);
    const baselineState = baselineStore.state();
    const candidateState = candidateStore.state();
    const run = (buildBaseline, buildCandidate, bytesBaseline, bytesCandidate) => {
      const b = probeMemory(buildBaseline, bytesBaseline);
      const c = probeMemory(buildCandidate, bytesCandidate);
      const pair = {
        baseline: b && {bytes: b.bytes, heapDeltaBytes: b.heapDeltaBytes},
        schema3: c && {bytes: c.bytes, heapDeltaBytes: c.heapDeltaBytes},
        bytesRatio: b && c && b.bytes > 0 ? +(c.bytes / b.bytes).toFixed(4) : null,
        heapRatio: b && c && b.heapDeltaBytes > 0 ? +(c.heapDeltaBytes / b.heapDeltaBytes).toFixed(4) : null,
      };
      if (b) delete b.keep;
      if (c) delete c.keep;
      return pair;
    };
    memory = {
      note: 'bytes = JSON of probe value; heapDeltaBytes = gc()-separated heapUsed growth of retaining it',
      view: run(() => clone(baselineRecords), () => clone(candidateRecords)),
      disk: run(() => clone(baselineDisk), () => clone(candidateDisk)),
      storeState: run(() => clone(baselineState), () => clone(candidateState)),
      store: run(() => baseline.createLayoutStore(clone(baselineDisk), noop),
        () => candidate.createLayoutStore(clone(candidateDisk), noop), baselineDisk, candidateDisk),
    };
  }

  const baselinePersistedBytes = baselineSummary.maxPersistedBytes;
  const ratioTable = schema3Available && candidateSummary ? {
    persistedBytesRatio: +(candidateSummary.maxPersistedBytes / baselinePersistedBytes).toFixed(4),
    groupsBytesRatio: +(candidateSummary.maxGroupsBytes / baselineSummary.maxGroupsBytes).toFixed(4),
    structuresBytes: candidateSummary.maxStructuresBytes,
    medianLayoutAndJsonRatio: +(candidateSummary.medianLayoutAndJsonMs / baselineSummary.medianLayoutAndJsonMs).toFixed(4),
    p95LayoutAndJsonRatio: +(candidateSummary.p95LayoutAndJsonMs / baselineSummary.p95LayoutAndJsonMs).toFixed(4),
    heapRatio: heap.schema3 && heap.baseline && heap.baseline.deltaBytes > 0
      ? +(heap.schema3.deltaBytes / heap.baseline.deltaBytes).toFixed(4) : null,
    storeHeapRatio: null,
  } : null;
  if (ratioTable && memory && memory.store && memory.store.heapRatio != null) ratioTable.storeHeapRatio = memory.store.heapRatio;

  const row = {
    ...scenario,
    nodes: initial.nodes.length,
    baseline: baselineSummary,
    schema3: candidateSummary,
    baselinePublished: {maxRecordMB010: published.mb010, medianLayoutAndJsonMs010: published.ms010},
    baselineFidelity: {
      observedMaxGroupsMB: bytesMB(baselineSummary.maxGroupsBytes),
      publishedMB010: published.mb010,
      mbRatio: +(bytesMB(baselineSummary.maxGroupsBytes) / published.mb010).toFixed(4),
      observedMedianMs: +baselineSummary.medianLayoutAndJsonMs.toFixed(1),
      publishedMs010: published.ms010,
    },
    heap: {baseline: heap.baseline && {deltaBytes: heap.baseline.deltaBytes},
      schema3: heap.schema3 && {deltaBytes: heap.schema3.deltaBytes},
      ...(memory ? {
        view: memory.view, disk: memory.disk, storeState: memory.storeState, store: memory.store,
      } : {})},
    boundary,
    ratio: ratioTable,
    samples,
  };
  rows.push(row);
  output.scenarios = rows;
  fs.writeFileSync(`${EVIDENCE}/scale.json`, JSON.stringify(output, null, 2));

  const fmt = n => (typeof n === 'number' ? n.toFixed(3) : n);
  console.log(`[scale] ${key} baseMB=${fmt(bytesMB(baselineSummary.maxGroupsBytes))}`
    + ` publishedMB010=${published.mb010} baseMs=${baselineSummary.medianLayoutAndJsonMs.toFixed(1)}`
    + (candidateSummary
      ? ` | schema3MB=${fmt(bytesMB(candidateSummary.maxPersistedBytes))}`
        + ` schema3Ms=${candidateSummary.medianLayoutAndJsonMs.toFixed(1)}`
        + ` bytesRatio=${ratioTable.persistedBytesRatio} timeRatio=${ratioTable.medianLayoutAndJsonRatio}`
      : ' | schema3 not built (baseline-only)')
    + (memory ? ` mem(view/disk/state/store heap)=${memory.view.heapRatio}/${memory.disk.heapRatio}/${memory.storeState.heapRatio}/${memory.store.heapRatio}` : ''));
}

// ---------- report flags ----------
const flags = [];
for (const row of rows) {
  if (!row.ratio) continue;
  const key = scenarioKey(row);
  if (row.ratio.persistedBytesRatio > 1.05) flags.push(`${key}: persisted bytes regression x${row.ratio.persistedBytesRatio} (>1.05)`);
  if (row.ratio.medianLayoutAndJsonRatio > 1.05) flags.push(`${key}: core+json p50 regression x${row.ratio.medianLayoutAndJsonRatio} (>1.05)`);
  if (row.ratio.heapRatio != null && row.ratio.heapRatio > 1.05) flags.push(`${key}: retained heap regression x${row.ratio.heapRatio} (>1.05)`);
  for (const [probeName, probe] of Object.entries(row.heap || {})) {
    if (!probe || typeof probe !== 'object' || probe.heapRatio == null) continue;
    if (probe.heapRatio > 1.05) flags.push(`${key}: ${probeName} retained heap regression x${probe.heapRatio} (>1.05)`);
    if (probe.bytesRatio != null && probe.bytesRatio > 1.05) flags.push(`${key}: ${probeName} bytes regression x${probe.bytesRatio} (>1.05)`);
  }
}
const fidelity = rows.map(row => ({
  key: scenarioKey(row),
  observedMaxGroupsMB: row.baselineFidelity.observedMaxGroupsMB,
  publishedMB010: row.baselineFidelity.publishedMB010,
  mbRatio: row.baselineFidelity.mbRatio,
}));
output.conclusion = {
  mode,
  schema3Available,
  baselineHarnessMatchesPublished: fidelity.every(r => Math.abs(r.mbRatio - 1) < 0.02),
  fidelity,
  flags,
  regressions: flags.length,
};
output.scenarios = rows;
fs.writeFileSync(`${EVIDENCE}/scale.json`, JSON.stringify(output, null, 2));
console.log(`[scale] mode=${mode} schema3Available=${schema3Available} gcAvailable=${gcAvailable}`);
console.log(`[scale] flags=${flags.length ? flags.join('; ') : 'none'}`);
console.log(`[scale] wrote ${EVIDENCE}\\scale.json`);
