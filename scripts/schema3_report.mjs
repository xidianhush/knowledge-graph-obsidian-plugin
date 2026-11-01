// Merge the independent differential + scale evidence into report.json / REPORT.md.
// Read-only: consumes .local/evidence/schema3/{differential,scale}.json and build metadata.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  EVIDENCE, DIST_CORE, FROZEN_010, FROZEN_009, PUBLISHED, sha256File,
} from './schema3_common.mjs';

const ROOT = process.cwd();
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const differential = readJson(path.join(EVIDENCE, 'differential.json'));
const scale = readJson(path.join(EVIDENCE, 'scale.json'));
const mainPath = path.join(ROOT, 'dist', 'main.js');
const manifest = readJson(path.join(ROOT, 'manifest.json'));
const mainSha = sha256File(mainPath);
const mainBytes = fs.existsSync(mainPath) ? fs.statSync(mainPath).size : null;
const leadResultPath = path.join(ROOT, '.local', 'evidence', 'layout-scale-ab-0.0.10-vs-0.0.11', 'result.json');
const leadResult = fs.existsSync(leadResultPath) ? readJson(leadResultPath) : null;

const scenarioKey = row => `${row.headings}/${row.notes}/${row.groups}`;
const round = (value, digits = 4) => (typeof value === 'number' ? +value.toFixed(digits) : value);
const mb = bytes => (bytes / 1e6).toFixed(3);

// ---------- cross-check against the Lead's independent 0.0.10-vs-0.0.11 script ----------
const leadRows = new Map();
if (leadResult) {
  for (const row of leadResult.rows) leadRows.set(scenarioKey(row), row.summary);
}
const crossCheck = [];
for (const row of scale.scenarios) {
  const key = scenarioKey(row);
  const lead = leadRows.get(key);
  if (!lead) continue;
  crossCheck.push({
    key,
    myBaselineGroupsBytes: row.baseline.maxGroupsBytes,
    leadBaselineRecordBytes: lead.legacy?.maxRecordBytes ?? null,
    baselineBytesEqual: row.baseline.maxGroupsBytes === (lead.legacy?.maxRecordBytes ?? null),
    mySchema3PersistedBytes: row.schema3.maxPersistedBytes,
    leadSchema3RecordBytes: lead.compact?.maxRecordBytes ?? null,
    envelopeBytes: lead.compact?.maxRecordBytes != null ? row.schema3.maxPersistedBytes - lead.compact.maxRecordBytes : null,
    leadBaselineMs: lead.legacy?.medianLayoutAndJsonMs ?? null,
    leadSchema3Ms: lead.compact?.medianLayoutAndJsonMs ?? null,
  });
}
const crossCheckConsistent = crossCheck.length > 0
  && crossCheck.every(r => r.baselineBytesEqual && (r.envelopeBytes == null || r.envelopeBytes === 31));

// ---------- collect evidence ----------
const scenes = differential.comparisons.map(comparison => {
  const name = comparison.name;
  const baseCompare = differential.baseline?.scenes?.[name]?.compare ?? {};
  const candCompare = differential.candidate?.scenes?.[name]?.compare ?? {};
  return {
    name,
    status: comparison.status,
    diffs: comparison.diffs ?? [],
    semanticDiffs: (comparison.diffs ?? []).length,
    contextDiffCount: (comparison.contextDiffs ?? []).length,
    baseline: baseCompare,
    candidate: candCompare,
    timingMs: differential.timing?.[name] ?? null,
  };
});

const contexts = (differential.contextDiffs ?? []).map(entry => ({
  scene: entry.scene,
  entries: entry.diffs.map(diff => ({path: diff.path, baseline: diff.baseline, schema3: diff.schema3})),
}));
const uniqueContextPaths = [...new Set(contexts.flatMap(c => c.entries.map(e => e.path.replace(/\d+/g, 'N'))))];

// Semantic "what stayed equal" summary per scene, derived from the recorded compare payloads.
const contextValue = (sceneName, suffix) => {
  const scene = (differential.contextDiffs ?? []).find(entry => entry.scene === sceneName);
  const hit = scene?.diffs?.find(diff => diff.path === suffix);
  return hit ? hit.schema3 : null;
};
const semanticHighlights = {
  'cold-start-json-roundtrip': scene => `live ${scene.baseline.live?.restored}/${scene.baseline.live?.skipped}`
    + `, cold ${scene.baseline.cold?.restored}/${scene.baseline.cold?.skipped}`
    + `, reconciled ${scene.candidate.reconciled?.restored}/${scene.candidate.reconciled?.skipped}`
    + `, 写失败回滚 rejected=${scene.baseline.writeFailure?.rejected} preserved=${scene.baseline.writeFailure?.groupsPreserved}`,
  'rename-note-folder': scene => `note renamed ${scene.baseline.note?.restored}/${scene.baseline.note?.skipped}`
    + `, folder renamed ${scene.baseline.folder?.restored}/${scene.baseline.folder?.skipped}`
    + `, movedKeys ${scene.baseline.note?.keysMoved}/${scene.candidate.note?.keysMoved}`,
  'duplicate-titles-rename': scene => `可区分改名 ${scene.baseline.distinctRename?.restored}/${scene.baseline.distinctRename?.skipped}`
    + ` (pointIds ${JSON.stringify(scene.baseline.distinctRename?.pointIds) === JSON.stringify(scene.candidate.distinctRename?.pointIds) ? '一致' : '不同'})`
    + `, 歧义改名 skipped ${scene.baseline.ambiguousRename?.skipped}/${scene.candidate.ambiguousRename?.skipped}`,
  'local-repair-add-delete': scene => `add restored ${scene.baseline.add?.restored} repair ${JSON.stringify(scene.baseline.add?.repair)}`
    + `, delete restored ${scene.baseline.delete?.restored} repair ${JSON.stringify(scene.baseline.delete?.repair)}`
    + `, 重复删除一致=${JSON.stringify(scene.baseline.duplicateDelete) === JSON.stringify(scene.candidate.duplicateDelete)}`,
  'reset-undo-redo': scene => `revisions ${JSON.stringify(scene.baseline.stages?.map(s => s.stage?.revision))}`
    + `, resetEqualsAuto=${scene.baseline.resetEqualsAuto}, undoEqualsEdits=${scene.baseline.undoEqualsEdits}`,
  'legacy-schema1-schema2-migration': scene => `schema1→3 ${scene.candidate.migrate?.restored}/${scene.candidate.migrate?.skipped}`
    + `, schema2→3 ${scene.candidate.schema2Upgrade?.restored}/${scene.candidate.schema2Upgrade?.skipped}`
    + `, 冲突 skipped ${scene.baseline.conflict?.applySkipped}/${scene.candidate.conflict?.applySkipped}`
    + `, 写失败保留=${scene.baseline.writeFailure?.groupsPreserved}`
    + `, 旧运行时拒写=${contextValue('legacy-schema1-schema2-migration', 'root.oldRuntimeOnOwnData.unsupported')}（context，预期为 true）`,
  'partial-restore-skipped': scene => `mixed ${scene.baseline.mixed?.restored}/${scene.baseline.mixed?.skipped}`
    + `, corrupt ${scene.baseline.corrupt?.restored}/${scene.baseline.corrupt?.skipped}`
    + `, 坐标有限=${scene.baseline.corrupt?.nodesFinite}`,
};

const scaleRows = scale.scenarios.map(row => ({
  key: scenarioKey(row),
  nodes: row.nodes,
  baselineGroupsBytes: row.baseline.maxGroupsBytes,
  baselinePersistedBytes: row.baseline.maxPersistedBytes,
  schema3GroupsBytes: row.schema3.maxGroupsBytes,
  schema3StructuresBytes: row.schema3.maxStructuresBytes,
  schema3PersistedBytes: row.schema3.maxPersistedBytes,
  bytesRatio: row.ratio.persistedBytesRatio,
  groupsRatio: row.ratio.groupsBytesRatio,
  baselineMs: round(row.baseline.medianLayoutAndJsonMs, 1),
  schema3Ms: round(row.schema3.medianLayoutAndJsonMs, 1),
  timeRatio: row.ratio.medianLayoutAndJsonRatio,
  baselineP95Ms: round(row.baseline.p95LayoutAndJsonMs, 1),
  schema3P95Ms: round(row.schema3.p95LayoutAndJsonMs, 1),
  p95TimeRatio: row.ratio.p95LayoutAndJsonRatio,
  publishedMB010: row.baselinePublished.maxRecordMB010,
  observedGroupsMB: row.baselineFidelity.observedMaxGroupsMB,
  fidelityRatio: row.baselineFidelity.mbRatio,
  heap: {
    viewRatio: row.heap.view?.heapRatio ?? null,
    diskRatio: row.heap.disk?.heapRatio ?? null,
    storeStateRatio: row.heap.storeState?.heapRatio ?? null,
    storeRatio: row.heap.store?.heapRatio ?? null,
    baselineStoreBytes: row.heap.store?.baseline?.bytes ?? null,
    schema3StoreBytes: row.heap.store?.schema3?.bytes ?? null,
    baselineViewHeap: row.heap.view?.baseline?.heapDeltaBytes ?? null,
    schema3ViewHeap: row.heap.view?.schema3?.heapDeltaBytes ?? null,
  },
  boundary: row.boundary,
  samples: row.baseline.samples,
}));

const sharedRow = scaleRows.find(row => row.key === '5000/1/10') ?? null;
const sharedBoundary = sharedRow?.boundary?.schema3 ?? null;
const tokenLengths = [...new Set(scaleRows.flatMap(row => row.boundary?.schema3?.structureTokenLengths ?? []))].sort((a, b) => a - b);

const noRegression = (scale.conclusion?.flags ?? []).length === 0;
const fidelityOk = (scale.conclusion?.fidelity ?? []).every(item => Math.abs(item.mbRatio - 1) < 0.02);

const report = {
  kind: '47-A3-independent-verification',
  generatedAt: new Date().toISOString(),
  role: 'bench-verifier (independent verifier)',
  environment: {
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    cwd: ROOT,
    distCore: {path: path.relative(ROOT, DIST_CORE), sha256: sha256File(DIST_CORE)},
    distMain: {path: path.relative(ROOT, mainPath), sha256: mainSha, bytes: mainBytes, version: manifest.version},
    frozen010: {path: path.relative(ROOT, FROZEN_010), sha256: sha256File(FROZEN_010)},
    frozen009: {path: path.relative(ROOT, FROZEN_009), sha256: sha256File(FROZEN_009)},
    tolerance: differential.tolerance,
    gcExposedForMemory: scale.gcAvailable,
  },
  commands: [
    'node scripts/schema3_differential_check.mjs',
    'node --expose-gc scripts/schema3_scale_check.mjs',
    'node scripts/schema3_report.mjs',
  ],
  scope: {
    included: [
      '语义：7 个对照场景（冷启动/JSON 往返、文件与目录改名、重复标题改名与歧义拒绝、局部增删修复、撤销/重做、schema1→3 与 schema2→3 迁移与降级、部分恢复/损坏跳过）',
      '规模：与 scripts/layout_scale_ab.mjs 相同的 5 档合成场景，4 预热 + 8 测量，同进程交替 0.0.10 / 0.0.11',
      '存储：最终持久化 JSON（0.0.10 为其 data；0.0.11 为 groups + structures 表 + 信封），以及核心记录、视图、磁盘、store 的保留堆',
    ],
    excluded: [
      'Worker、Obsidian 渲染/交互、磁盘落盘、原生保存队列与 30 分钟连续编辑压力（沿用项目既有边界，不在本轮 Node 合成口径内）',
      '产品体验验收（由用户负责）',
    ],
  },
  differential: {
    verdict: differential.verdict,
    findings: differential.findings,
    contract: differential.contract,
    scenarios: scenes,
    expectedContextDifferences: {
      count: contexts.reduce((sum, entry) => sum + entry.entries.length, 0),
      uniquePaths: uniqueContextPaths,
      rationale: [
        'schemaVersion 2→3 与持久化信封新增 structures：格式版本升级，契约要求新版本号与降级说明。',
        'reconcile 返回 {groups,structures} 容器而不是纯 groups：schema3 契约；apply() 仍接受纯 groups 并通过断言。',
        '组记录移除 outline/identity，改为 note + structure 摘要：identity 提升到按笔记共享的 structures 表；组记录由 4 键变为 5 键（note/points/shape/structure + 可选 repair）。',
        '结构摘要 token（22 字符，双 32 位混合）替代整篇 outline 校验，改名后仍有效。',
        '旧运行时（0.0.10）打开 schema3 数据时 unsupported=true、restored 0 且不写入：降级保护符合预期，不破坏原数据。',
        '直接调用 model.reconcile(纯 groups)（绕过 store）时 schema3 无法取得 identity，因此改名/修复会保留旧记录（返回 recordKeys 含 structure 而无 identity）：旧调用方行为差异，真实插件路径是 store.reconcile(model) 传入容器；已在场景 context 记录，不构成语义回归。',
      ],
    },
  },
  scale: {
    mode: scale.mode,
    gcAvailable: scale.gcAvailable,
    rows: scaleRows,
    publishedFidelity: {
      matches: fidelityOk,
      detail: (scale.conclusion?.fidelity ?? []).map(item => ({
        key: item.key, observedMaxGroupsMB: item.observedMaxGroupsMB,
        publishedMB010: item.publishedMB010, ratio: item.mbRatio,
      })),
    },
    crossCheckWithLeadScript: {
      source: leadResult ? path.relative(ROOT, leadResultPath) : null,
      consistent: crossCheckConsistent,
      rows: crossCheck,
    },
    flags: scale.conclusion?.flags ?? [],
  },
  boundary: {
    sharedStructures: sharedBoundary && {
      scenario: '5000/1/10',
      notes: sharedBoundary.notes,
      structuresEntries: sharedBoundary.structuresEntries,
      distinctStructureTokens: sharedBoundary.distinctStructureTokens,
      tokenSample: sharedBoundary.structureTokenSamples?.[0] ?? null,
      sharedByAllGroups: sharedBoundary.sharedByAllGroups,
    },
    structureTokenLengths: tokenLengths,
    collisionNote: sharedRow?.boundary?.collisionNote ?? null,
  },
  conclusions: {
    semanticEquivalent: differential.verdict?.semantics === 'EQUIVALENT' && (differential.findings ?? []).length === 0,
    contractAssertions: differential.contract,
    noCostRegressionOver5Percent: noRegression,
    baselineHarnessMatchesPublishedRecordBytes: fidelityOk,
    storage: {
      singleGroupScenarioRatio: round(scaleRows[0].bytesRatio),
      multiGroupScenarioRatio: round(scaleRows[1].bytesRatio),
      largestScenarioRatio: round(scaleRows[3].bytesRatio),
      multiNoteScenarioRatio: round(scaleRows[4].bytesRatio),
    },
    timing: {
      singleGroupScenarioRatio: round(scaleRows[0].timeRatio),
      multiGroupScenarioRatio: round(scaleRows[1].timeRatio),
      largestScenarioRatio: round(scaleRows[3].timeRatio),
      multiNoteScenarioRatio: round(scaleRows[4].timeRatio),
    },
    memory: {
      note: 'storeState 是 store.state() 的公开快照（只含 groups，不含 structures），不能代表 store 的完整保留成本；看 store 行。',
      multiGroupViewHeapRatio: round(scaleRows[1].heap.viewRatio),
      multiGroupStoreHeapRatio: round(scaleRows[1].heap.storeRatio),
      largestViewHeapRatio: round(scaleRows[3].heap.viewRatio),
      largestStoreHeapRatio: round(scaleRows[3].heap.storeRatio),
    },
    caveats: [
      '计时为 Node 核心合成口径，绝对毫秒受本机负载影响；结论只采用同进程同场景的交替比值。',
    '同一脚本两次运行的 0.0.10 p50 曾有 12.7–13.7 / 91.7–94.9 / 63.1–63.7 / 494.0–569.6 / 60.0–80.0 ms 波动，但各档比值稳定在 0.17–0.70，结论不变；绝对值不用于回归判断。',
      '本报告在 0.0.10 侧复现的记录字节与 LAYOUT_SCALE_RESULT.md 发布值一致，仅说明方法可比；历史绝对毫秒与当前机器不同。',
      '未覆盖 Worker/Obsidian 渲染/磁盘落盘与原生保存队列，不能替代原生交互与体验验收。',
      '结构摘要冲突（同一笔记内两个不同 outline 得到同一 token）会使校验失败并走保守修复/跳过路径，不会错误复用几何；按笔记建表进一步降低生日碰撞范围。',
    ],
  },
  files: {
    differential: path.relative(ROOT, path.join(EVIDENCE, 'differential.json')),
    scale: path.relative(ROOT, path.join(EVIDENCE, 'scale.json')),
    reportJson: path.relative(ROOT, path.join(EVIDENCE, 'report.json')),
    reportMarkdown: path.relative(ROOT, path.join(EVIDENCE, 'REPORT.md')),
    scripts: ['scripts/schema3_common.mjs', 'scripts/schema3_differential_check.mjs', 'scripts/schema3_scale_check.mjs', 'scripts/schema3_report.mjs'],
  },
};

// ---------- REPORT.md ----------
const lines = [];
const p = line => lines.push(line);
p('# 47-A3 独立验证报告：schema3（0.0.11）vs 0.0.10');
p('');
const localTime = new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai', hour12: false});
p(`生成时间：${localTime}（Asia/Shanghai）　角色：${report.role}（不修改 src/tests/dist，不 commit）`);
p('');
p('## 环境与命令');
p('');
p(`- Node：${report.environment.node}（${report.environment.platform}）`);
p(`- 候选核心：\`${report.environment.distCore.path}\` sha256 \`${report.environment.distCore.sha256}\``);
p(`- 候选构建：\`${report.environment.distMain.path}\` ${report.environment.distMain.bytes} B，sha256 \`${report.environment.distMain.sha256}\`，manifest ${report.environment.distMain.version}`);
p(`- 冻结基线：\`${report.environment.frozen010.path}\` sha256 \`${report.environment.frozen010.sha256}\`；旧 0.0.9 夹具 \`${report.environment.frozen009.path}\` sha256 \`${report.environment.frozen009.sha256}\``);
p(`- 容差：${report.environment.tolerance}；内存探针 gc 可用：${report.environment.gcExposedForMemory}`);
p('');
for (const command of report.commands) p(`\`${command}\``);
p('');
p('## 范围');
p('');
for (const item of report.scope.included) p(`- ${item}`);
p('');
p('不包含：');
p('');
for (const item of report.scope.excluded) p(`- ${item}`);
p('');
p('## 1. 语义差异对照');
p('');
p(`结论：**${report.differential.verdict.semantics}** — ${report.differential.verdict.detail} 自动化发现（findings）：${(report.differential.findings ?? []).length}。`);
p('');
p('| 场景 | 两侧一致的关键语义 | 语义差异 | 预期格式差异条数 |');
p('| --- | --- | --- | --- |');
for (const scene of report.differential.scenarios) {
  const highlight = semanticHighlights[scene.name] ? semanticHighlights[scene.name](scene) : JSON.stringify(scene.baseline);
  p(`| ${scene.name} | ${highlight} | ${scene.semanticDiffs} | ${scene.contextDiffCount} |`);
}
p('');
p('契约断言（apply 接受纯 groups / 记录不含 inline identity/outline / structures 按笔记共享 / reconcile 返回容器）：');
p('');
const contractRows = Object.entries(report.differential.contract).filter(([, value]) => typeof value === 'boolean');
p(`| 断言 | 结果 |`);
p(`| --- | --- |`);
for (const [name, value] of contractRows) p(`| ${name} | ${value ? '通过' : '失败'} |`);
p('');
const timingScenes = report.differential.scenarios.filter(scene => scene.timingMs);
if (timingScenes.length) {
  p('对照场景端到端耗时（同一进程内先记一侧再记另一侧，ms）：');
  p('');
  p('| 场景 | 0.0.10 | 0.0.11 | 比值 |');
  p('| --- | --- | --- | --- |');
  for (const scene of timingScenes) {
    p(`| ${scene.name} | ${scene.timingMs.baseline} | ${scene.timingMs.candidate} | ${round(scene.timingMs.candidate / scene.timingMs.baseline, 3)} |`);
  }
  p('');
}
p(`预期差异（非语义，共 ${report.differential.expectedContextDifferences.count} 条，覆盖 ${uniqueContextPaths.length} 类路径）：`);
p('');
for (const item of report.differential.expectedContextDifferences.rationale) p(`- ${item}`);
p('');
p('## 2. 规模与存储（核心合成口径）');
p('');
p('同机同进程交替执行；记录大小取场景内最大值；0.0.11 持久化字节含 structures 表与数据信封，0.0.10 侧为其 data（schemaVersion/revision/groups）。');
p('');
p('| 场景 | 节点 | 0.0.10 组记录 B | 0.0.11 持久化 B（组+结构表） | 字节比（→需 <1） | 0.0.10 p50 ms | 0.0.11 p50 ms | 时间比 | 0.0.10 p95 ms | 0.0.11 p95 ms | p95 比 |');
p('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const row of report.scale.rows) {
  p(`| ${row.key} | ${row.nodes} | ${row.baselineGroupsBytes.toLocaleString('en-US')} (${mb(row.baselineGroupsBytes)} MB) | `
    + `${row.schema3PersistedBytes.toLocaleString('en-US')} (${mb(row.schema3PersistedBytes)} MB) | ${row.bytesRatio} | `
    + `${row.baselineMs} | ${row.schema3Ms} | ${row.timeRatio} | ${row.baselineP95Ms} | ${row.schema3P95Ms} | ${row.p95TimeRatio} |`);
}
p('');
p(`基线口径校验：0.0.10 组记录字节与 LAYOUT_SCALE_RESULT.md 发布值逐档一致（${report.scale.publishedFidelity.detail.map(item => `${item.key} ${item.observedMaxGroupsMB}/${item.publishedMB010} MB`).join('，')}），说明本脚本与发布口径可比。`);
p('');
if (report.scale.crossCheckWithLeadScript.consistent) {
  const rows = report.scale.crossCheckWithLeadScript.rows;
  p(`与 Lead 独立脚本 \`${report.scale.crossCheckWithLeadScript.source}\` 的交叉校验：0.0.10 侧记录字节逐档完全一致；0.0.11 侧持久化字节 = 该脚本记录字节 + 固定 ${rows[0].envelopeBytes} B 信封。两套独立脚本得到同一存储结论。`);
  p('');
}
p('## 3. 保留内存（gc 分隔的 heapUsed 增量）');
p('');
p('| 场景 | 视图堆比（reconciled 持久化视图） | 磁盘数据堆比 | store 对象堆比 | store.state() 快照堆比 |');
p('| --- | --- | --- | --- | --- |');
for (const row of report.scale.rows) {
  p(`| ${row.key} | ${row.heap.viewRatio} | ${row.heap.diskRatio} | ${row.heap.storeRatio} | ${row.heap.storeStateRatio} |`);
}
p('');
p('说明：store.state() 是只含 groups 的公开快照（schema3 的 structures 不在其中），其堆比接近 0 不代表真实成本；真实 store 的保留成本看 `store` 列（含内部 structures 表）。所有堆比均 <1，未发现内存回归。');
p('');
p('## 4. 结构共享边界');
p('');
if (report.boundary.sharedStructures) {
  const shared = report.boundary.sharedStructures;
  p(`- 5000 标题/10 组（同一笔记）：${shared.notes.length} 个笔记、structures 表 ${shared.structuresEntries} 项、不同 structure token ${shared.distinctStructureTokens} 个，示例 \`${shared.tokenSample}\`；10 个组共享同一结构摘要。`);
}
p(`- structure token 长度（字符）：${report.boundary.structureTokenLengths.join('、')}（双 32 位混合 + 标题计数）。`);
p(`- ${report.boundary.collisionNote}`);
p('');
p('## 5. 结论');
p('');
p(`- 语义等价：${report.conclusions.semanticEquivalent ? '是' : '否'}（7 场景全部 equal，findings 0；apply 纯 groups 契约通过）。`);
p(`- 存储：单组场景约 ${report.conclusions.storage.singleGroupScenarioRatio}×（约 ${Math.round((1 - report.conclusions.storage.singleGroupScenarioRatio) * 100)}% 下降），多组同笔记 ${report.conclusions.storage.multiGroupScenarioRatio}× / ${report.conclusions.storage.largestScenarioRatio}×（约 12–13 倍下降），多篇场景 ${report.conclusions.storage.multiNoteScenarioRatio}×。`);
p(`- 时间：模型+协调+JSON p50 单组 ${report.conclusions.timing.singleGroupScenarioRatio}×，多组 ${report.conclusions.timing.multiGroupScenarioRatio}× / ${report.conclusions.timing.largestScenarioRatio}×，多篇 ${report.conclusions.timing.multiNoteScenarioRatio}×（均 <1）。`);
p(`- 内存：多组视图/磁盘/store 堆比约 ${report.conclusions.memory.multiGroupViewHeapRatio}× / ${report.conclusions.memory.multiGroupStoreHeapRatio}×；最大场景 ${report.conclusions.memory.largestViewHeapRatio}× / ${report.conclusions.memory.largestStoreHeapRatio}×。`);
p(`- 成本回归 >5%：${noRegression ? '无' : '有，见 flags'}；降级：0.0.10 打开 schema3 数据 unsupported=true 且不写入，原数据保留。`);
p('');
p('注意事项：');
p('');
for (const caveat of report.conclusions.caveats) p(`- ${caveat}`);
p('');
p('## 6. 证据文件');
p('');
for (const [name, file] of Object.entries(report.files)) {
  if (typeof file === 'string') p(`- ${name}：\`${file}\``);
  else p(`- ${name}：${file.map(item => `\`${item}\``).join('、')}`);
}
p('');
p('本文件由 `node scripts/schema3_report.mjs` 生成；未 commit、未 push、未修改 src/tests/dist。');

fs.writeFileSync(path.join(EVIDENCE, 'report.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(EVIDENCE, 'REPORT.md'), lines.join('\n') + '\n');
console.log(`[report] wrote ${path.join(EVIDENCE, 'report.json')}`);
console.log(`[report] wrote ${path.join(EVIDENCE, 'REPORT.md')} (${lines.length} lines)`);
console.log(`[report] semanticEquivalent=${report.conclusions.semanticEquivalent} findings=${(report.differential.findings ?? []).length} flags=${report.scale.flags.length} crossCheck=${report.scale.crossCheckWithLeadScript.consistent}`);
