// 47-A3 differential check: schema3 core (dist/graph-core.mjs) vs frozen 0.0.10.
// Independent verification of semantic equivalence for layout persistence:
// cold start, JSON roundtrip, write failure, rename (note/folder/duplicate title),
// local repair (add/delete heading), reset/undo/redo, legacy schema1/schema2 migration,
// partial restore and corrupt geometry.
//
// Contract under test (from HANDOFF_NEXT.md 47-A3 + layout_state_check.mjs):
//  - reconcile may return {groups, structures} (schema3) or a plain groups map (0.0.10),
//    but must preserve 0.0.10 layout semantics.
//  - apply() must still accept the persisted groups map on its own.
//  - the store's rebuild path is store.reconcile(model), which feeds the persisted
//    {groups, structures} container to model.reconcile (plugin.js path).
//  - schemaVersion bumps and the structure/identity split are expected; 0.0.10 data must
//    keep restoring and a 0.0.10 runtime must reject newer data as unsupported.
//
// Read-only: only writes .local/evidence/schema3/*. Dist may still be the frozen 0.0.10
// build; in that case the script emits the 0.0.10 baseline and marks the mode clearly.
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  DIST_CORE, FROZEN_010, FROZEN_009, TOL, sha256File, exists, importFile, graphOf,
  geometryOf, deepDiff, sameJson, positionsByTitle, normalizeReconcile, applyWith,
  structureTable, storeView, makeStore, writeEvidence, runtimeInfo, probeCore,
  isSchema3Probe, validGroupKeys,
} from './schema3_common.mjs';
import * as frozen010 from '../tests/fixtures/graph-core-0.0.10.mjs';
import * as frozen009 from '../tests/fixtures/graph-core-0.0.9.mjs';

// ---------------------------------------------------------------------------
// harness
// ---------------------------------------------------------------------------
function prepare(api, files) {
  const graph = graphOf(files);
  const nodes = graph.nodes;
  const rootRadius = graph.meta?.layout_root_radius;
  return {
    api, files, graph, nodes,
    model: api.createLayoutModel(nodes, rootRadius),
    editor: api.createLayoutEditor(nodes, rootRadius),
  };
}
function findNode(side, title, notePath = null) {
  const noteId = notePath == null ? null : String(notePath).replace(/\.md$/i, '');
  const matches = side.nodes.filter(n => n.title === title &&
    (notePath == null || n.path === notePath || n.note === notePath || n.note === noteId));
  assert.equal(matches.length, 1,
    `expected exactly one node titled "${title}"${notePath ? ` in ${notePath}` : ''}, got ${matches.length}`);
  return matches[0];
}
function dragNode(side, node, dx = 37, dy = 19) {
  assert.equal(side.editor.begin(node.id), null, `layout editor begin(${node.id})`);
  side.editor.move(node.x + dx, node.y + dy);
  side.editor.commit();
  const key = side.model.groupKey(node.id);
  const record = side.model.capture(key);
  assert.ok(record && typeof record === 'object', `capture(${key}) must return a record after a drag`);
  return {key, record};
}
function drag(side, title, notePath = null, dx = 37, dy = 19) {
  return dragNode(side, findNode(side, title, notePath), dx, dy);
}
// Persist records through the real store write path (one acquire/command per group).
// This is also what promotes a transient record identity into the shared structures table.
async function save(api, records, initial = null) {
  const {store, record} = makeStore(api, initial);
  const owner = {};
  for (const [key, value] of Object.entries(records)) {
    assert.equal(store.acquire(owner), true, 'store.acquire(owner) before edit');
    await store.command(owner, 'edit', key, value);
  }
  return {store, record, owner};
}
function durable(record, store) { return record.disk ?? store.state(); }
function structuresOf(record, store) {
  const disk = durable(record, store);
  return structureTable(disk)?.table ?? structureTable(store.state())?.table ?? null;
}
// Plugin rebuild path: load persisted data into the store, run store.reconcile(model)
// (which feeds {groups, structures} to model.reconcile), settle, then apply the state.
async function rebuild(api, disk, files) {
  const side = prepare(api, files);
  const loaded = makeStore(api, JSON.parse(JSON.stringify(disk)));
  await loaded.store.reconcile(side.model);
  await loaded.store.settled();
  const state = loaded.store.state();
  const structures = structureTable(loaded.record.disk)?.table ?? structureTable(state)?.table ?? null;
  const applied = applyWith(side.model, {groups: state.groups, structures});
  return {
    side, store: loaded.store, record: loaded.record, state, structures,
    applied, geometry: geometryOf(side.nodes),
    titles: positionsByTitle(side.nodes),
    form: structureTable(loaded.record.disk) ? 'container' : 'plain',
    history: stageOf(loaded.store),
    groups: sortKeys(state.groups),
  };
}
function applyState(side, store, record) {
  const result = applyWith(side.model, storeView(store.state(), durable(record, store)));
  return {restored: result.restored, skipped: result.skipped, applyFallback: result.applyFallback};
}
const clone = value => JSON.parse(JSON.stringify(value));
function allFinite(nodes) { return nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y)); }
// 布局状态文案由 core 按界面语言生成（Node 默认 en），而 0.0.10 基线固定是中文。
// 差分只关心"哪一类状态 + 文案里的变量部分"，所以把已知中英文前缀归一成稳定
// 的 kind，前缀之后的部分（例如写失败时的底层 error.message）原样保留。未知文案
// 原样带前缀返回，这样新文案仍会被差分检出，而不是被静默放过。
const LAYOUT_MESSAGE_KINDS = [
  ['save-failed', ['布局保存失败，已恢复上次保存的位置：', 'Could not save the layout; restored the last saved positions: ']],
  ['saved-repaired', ['布局已保存；已局部适配结构变化，撤销记录已清空', 'Layout saved; structure changes partly adapted and undo history cleared']],
  ['invalidated', ['笔记结构已更新；撤销记录已清空', 'Note structure updated; undo history cleared']],
  ['saved', ['布局已保存', 'Layout saved']],
  ['graph-changed', ['图谱结构已变化；撤销记录已清空', 'Graph structure changed; undo history cleared']],
  ['busy-other-view', ['另一视图正在调整或保存布局，请稍后重试', 'Another view is adjusting or saving the layout. Try again in a moment.']],
  ['busy-saving', ['布局正在保存，请稍后重试', 'The layout is being saved. Try again in a moment.']],
  ['unsupported', ['布局数据版本不受支持，调整已禁用；原数据保留', 'Layout data version not supported; adjusting is disabled and the original data is preserved']],
  ['saving', ['正在保存布局…', 'Saving layout…']],
  ['unchanged', ['布局未改变', 'Layout unchanged']],
  ['idle', ['拖动后自动保存', 'Auto-saves after dragging']],
];
function messageKind(message) {
  const text = String(message ?? '');
  for (const [kind, prefixes] of LAYOUT_MESSAGE_KINDS) {
    for (const prefix of prefixes) {
      if (text.startsWith(prefix)) return kind + ':' + text.slice(prefix.length);
    }
  }
  return 'unknown:' + text;
}
// `messageKey` 是 0.0.14 i18n 新增的语言无关状态标记（0.0.10 没有），比较
// "i18n 之前的状态字段集合"仍然有效，其它字段的增减照旧会被差分检出。
const stateTopKeys = state => sortKeys(state).filter(key => key !== 'messageKey');
function stageOf(store) {
  const state = store.state();
  return {
    revision: state.revision, canUndo: !!state.canUndo, canRedo: !!state.canRedo,
    groups: Object.keys(state.groups ?? {}).length, busy: state.busy, locked: state.locked,
    message: messageKind(state.message), unsupported: !!state.unsupported,
  };
}
function sortKeys(object) { return Object.keys(object ?? {}).sort(); }
// Direct model.reconcile call. 0.0.10 takes a plain groups map; schema3 prefers the
// persisted {groups, structures} container (legacy records with inline identity work).
const CAPS = new WeakMap();
function caps(api) {
  if (!CAPS.has(api)) {
    let probe = null;
    try { probe = probeCore(api); } catch {}
    CAPS.set(api, {schema3: !!probe && isSchema3Probe(probe), probe});
  }
  return CAPS.get(api);
}
function reconcileDirect(api, model, groups, structures = null) {
  const input = caps(api).schema3
    ? {groups: clone(groups), structures: clone(structures ?? {})}
    : clone(groups);
  const norm = normalizeReconcile(model.reconcile(input));
  if (!validGroupKeys(norm.groups)) throw new Error('direct reconcile returned an invalid groups map');
  return norm;
}
function applyNorm(model, norm) {
  return applyWith(model, {groups: norm.groups, structures: norm.structures});
}

// ---------------------------------------------------------------------------
// S1: cold start + JSON roundtrip + write failure
// ---------------------------------------------------------------------------
const S1_FILES = [
  {path: 'Demo/A.md', text: '# A\n## One\nbody one\n## Two\nbody two\n# B\nbody b'},
  {path: 'Demo/B.md', text: '# Root\n## Kid\nbody kid'},
];
async function sceneColdStart(api) {
  const side = prepare(api, S1_FILES);
  const auto = geometryOf(side.nodes);
  const drags = [
    drag(side, 'A', 'Demo/A.md'),
    drag(side, 'One', 'Demo/A.md'),
    drag(side, 'Root', 'Demo/B.md'),
  ];
  const records = Object.fromEntries(drags.map(d => [d.key, d.record]));
  assert.equal(new Set(Object.keys(records)).size, 3, 'three distinct persisted groups');
  const {store, record} = await save(api, records);
  const liveState = store.state();
  // Pure-groups apply contract: no structures table given.
  const live = applyWith(side.model, {groups: liveState.groups});
  const liveGeometry = geometryOf(side.nodes);
  const liveGroups = sortKeys(liveState.groups);

  // Cold start: JSON roundtrip through a fresh store, apply its plain groups map.
  const cold = makeStore(api, clone(durable(record, store)));
  const coldState = cold.store.state();
  const fresh = prepare(api, S1_FILES);
  const coldApply = applyWith(fresh.model, {groups: coldState.groups});
  const coldGeometry = geometryOf(fresh.nodes);

  // Write failure must reject, keep durable data and release the store.
  // The token object has to be the *same* one for acquire/command, otherwise the store
  // rejects with busy-other-view before the writer runs and this scene silently stops
  // covering the save-failure path (the assertion below keeps that from regressing).
  record.fail = true;
  const failingOwner = {};
  const failure = {rejected: false, message: null};
  try {
    assert.equal(store.acquire(failingOwner), true, 'store.acquire before failing reset-all');
    await store.command(failingOwner, 'reset-all');
  } catch (error) {
    failure.rejected = true;
    failure.message = messageKind(String(error?.message ?? error));
  }
  record.fail = false;
  const failedState = store.state();
  const failed = {
    ...failure,
    state: stageOf(store),
    groupsPreserved: sameJson(failedState.groups, liveState.groups),
    failedWrites: record.failedWrites,
    messageFlagged: messageKind(failedState.message).startsWith('save-failed'),
  };
  assert.equal(failed.rejected, true, 'S1 write failure must reject');
  assert.ok(failed.failedWrites >= 1, 'S1 write failure must reach the throwing writer');
  assert.equal(failed.messageFlagged, true, 'S1 write failure must surface as save-failed');

  // Plugin rebuild path.
  const re = await rebuild(api, durable(record, store), S1_FILES);

  return {
    compare: {
      groupKeys: sortKeys(records),
      autoGeometry: auto,
      live: {...live, groups: liveGroups, geometry: liveGeometry},
      cold: {restored: coldApply.restored, skipped: coldApply.skipped, applyFallback: coldApply.applyFallback,
        groups: sortKeys(coldState.groups), geometry: coldGeometry,
        geometryMatchesLive: deepDiff(liveGeometry, coldGeometry).length === 0},
      writeFailure: failed,
      reconciled: {restored: re.applied.restored, skipped: re.applied.skipped,
        applyFallback: re.applied.applyFallback, groups: re.groups, geometry: re.geometry},
    },
    context: {
      schemaVersion: durable(record, store)?.schemaVersion,
      persistedTopKeys: sortKeys(durable(record, store) ?? {}),
      recordKeys: sortKeys(drags[0].record),
      structureTableField: structureTable(durable(record, store))?.field ?? null,
      structureCount: Object.keys(structuresOf(record, store) ?? {}).length,
      reconcileForm: re.form,
    },
  };
}

// ---------------------------------------------------------------------------
// S2: note rename + folder rename, direct apply and store-reconcile paths
// ---------------------------------------------------------------------------
async function sceneRename(api) {
  const files = clone(S1_FILES);
  const side = prepare(api, files);
  const drags = [
    drag(side, 'A', 'Demo/A.md'),
    drag(side, 'One', 'Demo/A.md'),
    drag(side, 'Root', 'Demo/B.md'),
  ];
  const records = Object.fromEntries(drags.map(d => [d.key, d.record]));
  const {store, record} = await save(api, records);
  const live = applyState(side, store, record);
  const beforeTitles = positionsByTitle(side.nodes);
  const beforeGroups = sortKeys(store.state().groups);

  // A) explicit note rename, persisted groups applied directly (layout_state_check.mjs contract).
  await store.changePath('Demo/A.md', 'Demo/Renamed.md', false);
  const noteState = store.state();
  const noteGroups = clone(noteState.groups);
  const noteFiles = files.map(f => f.path === 'Demo/A.md' ? {...f, path: 'Demo/Renamed.md'} : f);
  const noteSide = prepare(api, noteFiles);
  const noteApply = applyWith(noteSide.model, {groups: noteState.groups});
  const noteTitles = positionsByTitle(noteSide.nodes);
  const noteHistory = stageOf(store);
  const noteRe = await rebuild(api, durable(record, store), noteFiles);

  // B) folder rename.
  await store.changePath('Demo', 'RenamedFolder', true);
  const folderState = store.state();
  const folderGroups = clone(folderState.groups);
  const folderFiles = noteFiles.map(f => ({...f, path: `RenamedFolder/${f.path.slice('Demo/'.length)}`}));
  const folderSide = prepare(api, folderFiles);
  const folderApply = applyWith(folderSide.model, {groups: folderState.groups});
  const folderTitles = positionsByTitle(folderSide.nodes);
  const folderRe = await rebuild(api, durable(record, store), folderFiles);

  const movedKeys = sortKeys(noteGroups).filter(key => key.includes('Renamed.md'));
  return {
    compare: {
      live: {restored: live.restored, skipped: live.skipped},
      beforeGroups,
      note: {
        restored: noteApply.restored, skipped: noteApply.skipped, applyFallback: noteApply.applyFallback,
        titlesContinuity: deepDiff(beforeTitles, noteTitles).length === 0,
        geometry: geometryOf(noteSide.nodes),
        keysMoved: movedKeys.length,
        oldKeysGone: sortKeys(noteGroups).every(key => !key.includes('Demo/A.md')),
        canUndo: noteHistory.canUndo, canRedo: noteHistory.canRedo,
        reconciled: {restored: noteRe.applied.restored, skipped: noteRe.applied.skipped,
          applyFallback: noteRe.applied.applyFallback, groups: noteRe.groups, geometry: noteRe.geometry},
      },
      folder: {
        restored: folderApply.restored, skipped: folderApply.skipped, applyFallback: folderApply.applyFallback,
        titlesContinuity: deepDiff(noteTitles, folderTitles).length === 0,
        geometry: geometryOf(folderSide.nodes),
        keysMoved: sortKeys(folderGroups).filter(key => key.includes('RenamedFolder')).length,
        keysClean: sortKeys(folderGroups).every(key => !key.includes('"/Demo')),
        reconciled: {restored: folderRe.applied.restored, skipped: folderRe.applied.skipped,
          groups: folderRe.groups, geometry: folderRe.geometry},
      },
    },
    context: {
      noteSchemaVersion: noteState.schemaVersion,
      folderSchemaVersion: folderState.schemaVersion,
      noteForm: noteRe.form, folderForm: folderRe.form,
      noteTopKeys: stateTopKeys(noteState),
      folderTopKeys: stateTopKeys(folderState),
      structureCount: Object.keys(structuresOf(record, store) ?? {}).length,
    },
  };
}

// ---------------------------------------------------------------------------
// S3: duplicate-title rename, distinguishable vs ambiguous evidence
// ---------------------------------------------------------------------------
const DUP_TEXT = '# Top\n## Dup\nbody one\n## Dup\nbody two\n# Tail\nbody tail';
async function sceneDuplicateRename(api) {
  const files = [{path: 'Dup/Note.md', text: DUP_TEXT}];
  const side = prepare(api, files);
  const firstDup = side.nodes.filter(n => n.title === 'Dup')[0];
  const d = dragNode(side, firstDup);
  const {store, record} = await save(api, {[d.key]: d.record});
  const saved = applyState(side, store, record);
  const savedGroups = clone(store.state().groups);
  const savedPointIds = (savedGroups[d.key]?.points ?? []).map(p => p.id).sort();
  const disk = durable(record, store);

  // A) distinct bodies: renaming the second duplicate must follow the heading.
  const renamedText = DUP_TEXT.replace('## Dup\nbody two', '## Dup B\nbody two');
  const distinctFiles = [{path: 'Dup/Note.md', text: renamedText}];
  const distinct = await rebuild(api, disk, distinctFiles);
  const distinctRecord = distinct.state.groups[d.key] ?? null;
  const distinctPointIds = (distinctRecord?.points ?? []).map(p => p.id).sort();

  // B) identical bodies: second duplicate is not distinguishable, rename must be rejected.
  const sameText = '# Top\n## Dup\nsame body\n## Dup\nsame body\n# Tail\nbody tail';
  const sameSide = prepare(api, [{path: 'Dup/Note.md', text: sameText}]);
  const sameFirst = sameSide.nodes.filter(n => n.title === 'Dup')[0];
  const sd = dragNode(sameSide, sameFirst, 17, 9);
  const sameStore = await save(api, {[sd.key]: sd.record});
  applyState(sameSide, sameStore.store, sameStore.record);
  const sameRenamedText = sameText.replace('## Dup\nsame body\n# Tail', '## Dup B\nsame body\n# Tail');
  const ambiguousFiles = [{path: 'Dup/Note.md', text: sameRenamedText}];
  const ambiguous = await rebuild(api, durable(sameStore.record, sameStore.store), ambiguousFiles);

  return {
    compare: {
      saved: {...saved, pointIds: savedPointIds},
      distinctRename: {
        restored: distinct.applied.restored, skipped: distinct.applied.skipped,
        applyFallback: distinct.applied.applyFallback,
        recordPresent: !!distinctRecord,
        pointIds: distinctPointIds,
        groups: distinct.groups,
        geometry: distinct.geometry,
      },
      ambiguousRename: {
        restored: ambiguous.applied.restored, skipped: ambiguous.applied.skipped,
        groups: ambiguous.groups,
        geometry: ambiguous.geometry,
      },
    },
    context: {
      schemaVersion: disk?.schemaVersion,
      distinctForm: distinct.form, ambiguousForm: ambiguous.form,
      structureCount: Object.keys(structuresOf(record, store) ?? {}).length,
      dims: {saved: savedPointIds.length, distinct: distinctPointIds.length},
    },
  };
}

// ---------------------------------------------------------------------------
// S4: local repair (add / delete headings) and conservative rejection
// ---------------------------------------------------------------------------
const UNIQUE_TEXT = '# P\n## A\nbody a\n## B\nbody b\n# Q\nbody q';
async function sceneRepair(api) {
  const files = [{path: 'Repair/Note.md', text: UNIQUE_TEXT}];
  const side = prepare(api, files);
  const d = drag(side, 'A', 'Repair/Note.md');
  const {store, record} = await save(api, {[d.key]: d.record});
  const saved = applyState(side, store, record);
  const savedGroups = clone(store.state().groups);
  const disk = durable(record, store);
  const structures = structuresOf(record, store);

  async function variant(text, label) {
    const variantFiles = [{path: 'Repair/Note.md', text}];
    const re = await rebuild(api, disk, variantFiles);
    const recordAfter = re.state.groups[d.key] ?? null;
    return {label, restored: re.applied.restored, skipped: re.applied.skipped,
      repair: recordAfter?.repair ?? null, geometry: re.geometry, groups: re.groups, form: re.form};
  }
  const added = await variant(UNIQUE_TEXT.replace('# Q', '## Added\nbody added\n# Q'), 'add');
  const deleted = await variant(UNIQUE_TEXT.replace('## B\nbody b\n', ''), 'delete');
  // Plain-groups direct reconcile (legacy caller shape, informational only).
  const plainModel = prepare(api, files);
  const plainAdd = reconcileDirect(api, plainModel.model, savedGroups, null);

  // duplicate titles: deleting one changes duplicate bookkeeping -> conservative reject
  const dupSide = prepare(api, [{path: 'Dup/Note.md', text: DUP_TEXT}]);
  const firstDup = dupSide.nodes.filter(n => n.title === 'Dup')[0];
  const dd = dragNode(dupSide, firstDup, 11, 13);
  const dupStore = await save(api, {[dd.key]: dd.record});
  applyState(dupSide, dupStore.store, dupStore.record);
  const dupDeletedText = DUP_TEXT.replace('## Dup\nbody one\n', '');
  const dupVariant = await rebuild(api, durable(dupStore.record, dupStore.store),
    [{path: 'Dup/Note.md', text: dupDeletedText}]);
  const dupRecord = dupVariant.state.groups[dd.key] ?? null;

  return {
    compare: {
      saved: {...saved, repair: savedGroups[d.key]?.repair ?? null},
      add: {restored: added.restored, skipped: added.skipped, repair: added.repair,
        geometry: added.geometry, groups: added.groups},
      delete: {restored: deleted.restored, skipped: deleted.skipped, repair: deleted.repair,
        geometry: deleted.geometry, groups: deleted.groups},
      duplicateDelete: {restored: dupVariant.applied.restored, skipped: dupVariant.applied.skipped,
        repair: dupRecord?.repair ?? null, geometry: dupVariant.geometry, groups: dupVariant.groups},
    },
    context: {
      schemaVersion: disk?.schemaVersion,
      addForm: added.form, deleteForm: deleted.form,
      dupSchemaVersion: durable(dupStore.record, dupStore.store)?.schemaVersion,
      structureCount: Object.keys(structures ?? {}).length,
      plainGroupsDirect: {repair: plainAdd.groups?.[d.key]?.repair ?? null,
        recordKeys: sortKeys(plainAdd.groups?.[d.key] ?? {})},
    },
  };
}

// ---------------------------------------------------------------------------
// S5: reset-all / undo / redo
// ---------------------------------------------------------------------------
async function sceneHistory(api) {
  const files = clone(S1_FILES);
  const side = prepare(api, files);
  const autoGeometry = geometryOf(side.nodes);
  const drags = [drag(side, 'A', 'Demo/A.md'), drag(side, 'One', 'Demo/A.md')];
  const {store, record} = await save(api, Object.fromEntries(drags.map(d => [d.key, d.record])));
  const owner = {};
  const stages = [];
  async function stage(name, action = null) {
    if (action) await action();
    const applied = applyState(side, store, record);
    stages.push({name, stage: stageOf(store), restored: applied.restored, skipped: applied.skipped,
      geometry: geometryOf(side.nodes)});
  }
  await stage('afterEdits');
  await stage('resetAll', async () => { assert.equal(store.acquire(owner), true); await store.command(owner, 'reset-all'); });
  await stage('undoReset', async () => { assert.equal(store.acquire(owner), true); await store.command(owner, 'undo'); });
  await stage('redoReset', async () => { assert.equal(store.acquire(owner), true); await store.command(owner, 'redo'); });

  const byName = Object.fromEntries(stages.map(s => [s.name, s]));
  return {
    compare: {
      autoGeometry,
      stages: stages.map(({name, stage, restored, skipped}) => ({name, stage, restored, skipped})),
      resetEqualsAuto: deepDiff(autoGeometry, byName.resetAll.geometry).length === 0,
      undoEqualsEdits: deepDiff(byName.afterEdits.geometry, byName.undoReset.geometry).length === 0,
      afterEditsGeometry: byName.afterEdits.geometry,
      resetGeometry: byName.resetAll.geometry,
      undoGeometry: byName.undoReset.geometry,
      redoGeometry: byName.redoReset.geometry,
      resetRestored: byName.resetAll.restored,
      resetSkipped: byName.resetAll.skipped,
    },
    context: {
      schemaVersion: durable(record, store)?.schemaVersion,
      revisionTrace: stages.map(s => s.stage.revision),
    },
  };
}

// ---------------------------------------------------------------------------
// S6: legacy schema1 (0.0.9) and schema2 (0.0.10) migration, conflicts, write failure
// ---------------------------------------------------------------------------
const LEGACY_FILES = [{path: 'Legacy/Note.md', text: '# N\n## H1\nbody one\n## H2\nbody two\n# M\nbody m'}];
function legacyDrag(core, files, title, dx, dy) {
  const graph = graphOf(files);
  const model = core.createLayoutModel(graph.nodes, graph.meta.layout_root_radius);
  const editor = core.createLayoutEditor(graph.nodes, graph.meta.layout_root_radius);
  const node = graph.nodes.find(n => n.title === title);
  assert.equal(editor.begin(node.id), null, `legacy begin(${node.id})`);
  editor.move(node.x + dx, node.y + dy);
  editor.commit();
  const key = model.groupKey(node.id);
  const record = model.capture(key);
  assert.ok(record, `legacy capture(${key})`);
  return {graph, model, node, key, record};
}
function runtimeOpensData(core, disk, model) {
  const store = core.createLayoutStore(clone(disk), async () => {});
  const state = store.state();
  const applied = applyWith(model, {groups: state.groups, structures: null});
  return {unsupported: state.unsupported === true, schemaVersion: state.schemaVersion,
    restored: applied.restored, skipped: applied.skipped,
    message: typeof state.message === 'string' && state.message.length > 0};
}
async function sceneLegacy(api) {
  const flat = legacyDrag(frozen009, LEGACY_FILES, 'H1', 13, 7);
  const key9 = flat.key;
  const schema1 = {schemaVersion: 1, revision: 7, groups: {[key9]: clone(flat.record)}};

  // migrate schema1 through the store, then cold-apply the migrated data
  const side = prepare(api, LEGACY_FILES);
  const {store, record} = makeStore(api, clone(schema1));
  await store.reconcile(side.model);
  await store.settled();
  const migratedDisk = durable(record, store);
  const migratedGroups = clone(store.state().groups);
  const fresh = prepare(api, LEGACY_FILES);
  const migratedApply = applyWith(fresh.model, {groups: migratedGroups});
  const migratedRecord = migratedGroups[key9] ?? null;
  const shapeInlineOutline = (migratedRecord?.shape ?? []).some(entry => Object.hasOwn(entry ?? {}, 'outline'));
  const migrated = {
    restored: migratedApply.restored, skipped: migratedApply.skipped,
    applyFallback: migratedApply.applyFallback,
    geometry: geometryOf(fresh.nodes),
    groups: sortKeys(migratedGroups),
    pointsPreserved: sameJson(migratedRecord?.points, flat.record.points),
    shapeInlineOutlineRemoved: !shapeInlineOutline,
    writeCount: record.writes,
  };

  // conflicting legacy outline: apply skips, reconcile keeps the old record verbatim
  const corruptGroups = clone(schema1.groups);
  corruptGroups[key9].shape[0].outline = [];
  const corruptSide = prepare(api, LEGACY_FILES);
  const corruptApply = applyWith(corruptSide.model, {groups: corruptGroups, structures: null});
  const corruptRe = reconcileDirect(api, corruptSide.model, corruptGroups, {});
  const corrupt = {
    applyRestored: corruptApply.restored, applySkipped: corruptApply.skipped,
    reconcilePreserved: sameJson(corruptRe.groups, corruptGroups),
  };

  // migration write failure: schemaVersion and groups must survive untouched
  const failing = makeStore(api, clone(schema1));
  failing.record.fail = true;
  const failingSide = prepare(api, LEGACY_FILES);
  const failure = {rejected: false, message: null};
  try { await failing.store.reconcile(failingSide.model); }
  catch (error) { failure.rejected = true; failure.message = messageKind(String(error?.message ?? error)); }
  const failingState = failing.store.state();
  const writeFailure = {
    ...failure,
    failedWrites: failing.record.failedWrites,
    schemaVersionStable: failingState.schemaVersion === 1,
    groupsPreserved: sameJson(failingState.groups, schema1.groups),
    busy: failingState.busy, locked: failingState.locked,
    messageFlagged: messageKind(failingState.message).startsWith('save-failed'),
  };
  assert.equal(writeFailure.rejected, true, 'legacy migration write failure must reject');
  assert.ok(writeFailure.failedWrites >= 1, 'legacy migration write failure must reach the throwing writer');
  assert.equal(writeFailure.messageFlagged, true, 'legacy migration write failure must surface as save-failed');

  // schema2 (0.0.10) input upgrade through the store
  const flat2 = legacyDrag(frozen010, LEGACY_FILES, 'H1', 13, 7);
  const schema2 = {schemaVersion: 2, revision: 3, groups: {[flat2.key]: clone(flat2.record)}};
  const up = makeStore(api, clone(schema2));
  const upSide = prepare(api, LEGACY_FILES);
  await up.store.reconcile(upSide.model);
  await up.store.settled();
  const upDisk = durable(up.record, up.store);
  const upFresh = prepare(api, LEGACY_FILES);
  const upApply = applyWith(upFresh.model, {groups: up.store.state().groups});
  const schema2Upgrade = {
    restored: upApply.restored, skipped: upApply.skipped, applyFallback: upApply.applyFallback,
    geometry: geometryOf(upFresh.nodes),
    groups: sortKeys(up.store.state().groups),
    pointsPreserved: sameJson((up.store.state().groups[flat2.key] ?? {}).points, flat2.record.points),
  };

  // 0.0.10 runtime opening the produced data (downgrade protection).
  const legacyOpens = runtimeOpensData(frozen010, durable(record, store), prepare(api, LEGACY_FILES).model);

  return {
    compare: {
      migrate: migrated,
      conflict: corrupt,
      writeFailure,
      schema2Upgrade: {
        restored: schema2Upgrade.restored, skipped: schema2Upgrade.skipped,
        applyFallback: schema2Upgrade.applyFallback,
        geometry: schema2Upgrade.geometry, groups: schema2Upgrade.groups,
        pointsPreserved: schema2Upgrade.pointsPreserved,
      },
    },
    context: {
      migratedSchemaVersion: migratedDisk?.schemaVersion,
      migratedTopKeys: sortKeys(migratedDisk ?? {}),
      migratedOutlineInRecord: Array.isArray(migratedRecord?.outline),
      schema2UpgradeVersion: upDisk?.schemaVersion,
      schema2UpgradeTopKeys: sortKeys(upDisk ?? {}),
      legacyOpenSchemaVersion: legacyOpens.schemaVersion,
      // 0.0.10 runtime opening the data produced by this side (downgrade protection).
      oldRuntimeOnOwnData: {unsupported: legacyOpens.unsupported, message: legacyOpens.message,
        restored: legacyOpens.restored, skipped: legacyOpens.skipped},
    },
  };
}

// ---------------------------------------------------------------------------
// S7: partial restore (mixed compatible/incompatible) and corrupt geometry
// ---------------------------------------------------------------------------
async function scenePartial(api) {
  const files = clone(S1_FILES);
  const side = prepare(api, files);
  const aDrag = drag(side, 'A', 'Demo/A.md');
  const rDrag = drag(side, 'Root', 'Demo/B.md');
  const {store, record} = await save(api, {[aDrag.key]: aDrag.record, [rDrag.key]: rDrag.record});
  const saved = applyState(side, store, record);
  const savedGroups = clone(store.state().groups);
  const structures = structuresOf(record, store);
  const disk = durable(record, store);

  // B note changed so its saved group no longer matches; A note untouched.
  const changedFiles = files.map(f => f.path === 'Demo/B.md' ? {...f, text: '# Root\nbody changed'} : f);
  const mixed = await rebuild(api, disk, changedFiles);

  const subsetGroups = Object.fromEntries(
    Object.entries(savedGroups).filter(([key]) => key.includes('Demo/A.md')));
  const subsetSide = prepare(api, changedFiles);
  const subsetApply = applyWith(subsetSide.model, {groups: subsetGroups, structures});

  // corrupt geometry in one record: it must be skipped without touching other groups
  const corruptGroups = clone(savedGroups);
  const corruptKey = Object.keys(corruptGroups).find(key => key.includes('Demo/A.md'));
  corruptGroups[corruptKey].points[0].x = NaN;
  const corruptSide = prepare(api, files);
  const corruptApply = applyWith(corruptSide.model, {groups: corruptGroups, structures});
  const corruptNodesFinite = allFinite(corruptSide.nodes);

  return {
    compare: {
      saved: {...saved, keys: sortKeys(savedGroups)},
      mixed: {restored: mixed.applied.restored, skipped: mixed.applied.skipped,
        applyFallback: mixed.applied.applyFallback, geometry: mixed.geometry, groups: mixed.groups},
      subset: {restored: subsetApply.restored, skipped: subsetApply.skipped,
        geometry: geometryOf(subsetSide.nodes)},
      corrupt: {restored: corruptApply.restored, skipped: corruptApply.skipped,
        nodesFinite: corruptNodesFinite},
    },
    context: {
      schemaVersion: disk?.schemaVersion,
      mixedForm: mixed.form,
      structureCount: Object.keys(structures ?? {}).length,
      keys: sortKeys(savedGroups),
    },
  };
}

// ---------------------------------------------------------------------------
// runner
// ---------------------------------------------------------------------------
const SCENES = [
  ['cold-start-json-roundtrip', 'cold start / JSON roundtrip / write failure', sceneColdStart],
  ['rename-note-folder', 'note + folder rename (direct and store-reconcile paths)', sceneRename],
  ['duplicate-titles-rename', 'duplicate-title rename: distinguishable vs ambiguous', sceneDuplicateRename],
  ['local-repair-add-delete', 'local repair: add/delete headings', sceneRepair],
  ['reset-undo-redo', 'reset-all / undo / redo', sceneHistory],
  ['legacy-schema1-schema2-migration', 'schema1/schema2 migration, conflict, write failure', sceneLegacy],
  ['partial-restore-skipped', 'partial restore, subset restore, corrupt geometry', scenePartial],
];

async function runSide(api, label) {
  const scenes = {};
  for (const [name, description, fn] of SCENES) {
    const startedAt = performance.now();
    try {
      const result = await fn(api);
      scenes[name] = {name, description, ok: true, ms: +(performance.now() - startedAt).toFixed(1),
        compare: result?.compare ?? null, context: result?.context ?? null};
    } catch (error) {
      scenes[name] = {name, description, ok: false, ms: +(performance.now() - startedAt).toFixed(1),
        error: {name: error?.name ?? 'Error', message: String(error?.message ?? error)},
        stack: String(error?.stack ?? '').split('\n').slice(0, 8)};
    }
  }
  return {label, scenes};
}

const distCore = await importFile(DIST_CORE);
const distSha = sha256File(DIST_CORE);
const frozenSha = sha256File(FROZEN_010);
const frozenProbe = probeCore(frozen010);
const distProbe = distCore ? probeCore(distCore) : null;
const distIsFrozen = !!distCore && distSha === frozenSha;
const schema3Signature = !!distProbe && isSchema3Probe(distProbe);
const mode = !distCore ? 'baseline-only (dist/graph-core.mjs missing)'
  : distIsFrozen ? 'baseline-only (dist equals frozen 0.0.10)'
  : schema3Signature ? 'schema3-vs-0.0.10'
  : 'dist-differs-without-schema3-signature';

const baseline = await runSide(frozen010, '0.0.10');
const candidate = distCore ? await runSide(distCore, 'dist') : null;

// Compare baseline against the candidate. In baseline-only mode the candidate is the
// same build, so any diff is harness nondeterminism and is reported separately.
const comparisons = [];
const findings = [];
const contextDiffs = [];
for (const [name] of SCENES) {
  const left = baseline.scenes[name];
  const right = candidate?.scenes[name] ?? null;
  if (!left.ok) {
    findings.push({scene: name, kind: 'baseline-harness-error', detail: left.error});
    comparisons.push({name, status: 'baseline-error'});
    continue;
  }
  if (!right) { comparisons.push({name, status: 'baseline-only'}); continue; }
  if (!right.ok) {
    findings.push({scene: name, kind: 'candidate-error', detail: right.error});
    comparisons.push({name, status: 'candidate-error'});
    continue;
  }
  const diffs = deepDiff(left.compare, right.compare);
  const ctxDiffs = deepDiff(left.context, right.context);
  comparisons.push({name, status: diffs.length ? (distIsFrozen ? 'sanity-diff' : 'semantic-diff') : 'equal',
    diffs: distIsFrozen ? [] : diffs, sanityDiffs: distIsFrozen ? diffs : [], contextDiffs: ctxDiffs});
  if (diffs.length) {
    if (distIsFrozen) findings.push({scene: name, kind: 'sanity-nondeterminism', diffs});
    else findings.push({scene: name, kind: 'semantic-diff', diffs});
  }
  if (ctxDiffs.length) contextDiffs.push({scene: name, diffs: ctxDiffs});
}

// schema3 contract checks on the probe (only meaningful when the signature is present)
const contract = distProbe ? {
  reconcileContainerOrStructures: schema3Signature,
  applyAcceptsPlainGroups: (distProbe.applyPure?.restored ?? 0) >= 1,
  recordDropsInlineIdentity: distProbe.recordHasInlineIdentity === false || !schema3Signature,
  recordDropsInlineOutline: distProbe.recordHasInlineOutline === false || !schema3Signature,
  structuresShared: !schema3Signature || distProbe.structureCount >= 1,
  probe: distProbe,
} : null;

const timing = Object.fromEntries(SCENES.map(([name]) => [name, {
  baseline: baseline.scenes[name].ms,
  candidate: candidate?.scenes[name]?.ms ?? null,
}]));

const report = {
  kind: '47-A3-differential',
  generatedAt: new Date().toISOString(),
  runtime: runtimeInfo(),
  command: 'node scripts/schema3_differential_check.mjs',
  cwd: process.cwd(),
  tolerance: TOL,
  mode,
  dist: {path: path.relative(process.cwd(), DIST_CORE), sha256: distSha,
    equalsFrozen010: distIsFrozen, exists: exists(DIST_CORE)},
  frozen: {path: 'tests/fixtures/graph-core-0.0.10.mjs', sha256: frozenSha,
    probe: frozenProbe, legacy009: {path: path.relative(process.cwd(), FROZEN_009), sha256: sha256File(FROZEN_009)}},
  candidateProbe: distProbe,
  contract,
  baseline,
  candidate,
  comparisons,
  contextDiffs,
  findings,
  timing,
  verdict: {
    semantics: findings.some(f => f.kind === 'semantic-diff' || f.kind === 'candidate-error')
      ? 'DIFFERENCES' : (mode === 'schema3-vs-0.0.10' ? 'EQUIVALENT' : 'BASELINE-ONLY'),
    detail: findings.length === 0
      ? (mode === 'schema3-vs-0.0.10'
        ? 'All 7 scenarios match 0.0.10 within 1e-7 on geometry, restore counts, skipped counts, history and failure handling.'
        : 'Baseline captured; no semantic comparison available until the schema3 build lands in dist/.')
      : `${findings.length} finding(s); see findings[].`,
  },
};

const outPath = writeEvidence('differential.json', report);
console.log(`[differential] mode=${mode}`);
console.log(`[differential] dist sha256=${distSha ?? 'missing'} frozen010=${frozenSha}`);
if (distIsFrozen) console.log('[differential] dist is still the frozen 0.0.10 build: baseline-only run.');
console.log(`[differential] scene timings baseline/candidate ms: ` +
  SCENES.map(([name]) => `${name}=${timing[name].baseline}/${timing[name].candidate ?? '-'}`).join(', '));
console.log(`[differential] verdict=${report.verdict.semantics} findings=${findings.length}`);
for (const finding of findings) {
  console.log(`[differential] FINDING ${finding.scene} ${finding.kind}`);
  for (const diff of (finding.diffs ?? []).slice(0, 8)) console.log(`  ${JSON.stringify(diff)}`);
  if (finding.detail) console.log(`  detail=${JSON.stringify(finding.detail)}`);
}
console.log(`[differential] wrote ${outPath}`);
process.exitCode = findings.length ? 1 : 0;
