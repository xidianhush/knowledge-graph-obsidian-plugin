// Characterize FB-005 on the frozen 0.0.6 build; these are baseline expectations,
// not acceptance tests for the future continuity implementation. Synthetic only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildGraph } from '../dist/pipeline.mjs';
import { createLayoutModel } from '../dist/graph-core.mjs';

const text = '# Alpha\n## One\nbody\n## Two\nbody\n# Beta\n## Three\nbody\n## Four\nbody';
const files = ['A', 'B'].map(name => ({path: `Demo/${name}.md`, text}));
const build = input => buildGraph({files: input, config: {include: ['**']}});
const before = build(files);
const model = createLayoutModel(before.nodes, before.meta.layout_root_radius);
const records = {};
// Rotate a complete sibling group and translate each child's subtree with it.
// This preserves containment and sibling distances without invoking UI input.
function rotateGroup(parentId) {
  const parent = before.nodes.find(n => n.id === parentId);
  assert.ok(parent, parentId);
  const children = before.nodes.filter(n => n.parent === parentId);
  const translate = (node, dx, dy) => {
    node.x += dx; node.y += dy;
    before.nodes.filter(n => n.parent === node.id).forEach(n => translate(n, dx, dy));
  };
  for (const child of children) {
    const x = child.x - parent.x, y = child.y - parent.y, angle = 0.31;
    translate(child, parent.x + x * Math.cos(angle) - y * Math.sin(angle) - child.x,
      parent.y + x * Math.sin(angle) + y * Math.cos(angle) - child.y);
  }
  const key = model.groupKey(children[0].id);
  records[key] = model.capture(key);
  assert.ok(records[key]);
}
['Demo/A', 'Demo/A#Alpha', 'Demo/A#Beta', 'Demo/B#Alpha'].forEach(rotateGroup);
assert.deepEqual(model.apply(records), {restored: 4, skipped: 0});

const scenarios = [
  ['unchanged', text, 4],
  ['body-insertion', text.replace('body', 'body\nextra prose'), 4],
  ['leaf-rename', text.replace('## One', '## Renamed'), 1],
  ['ancestor-rename', text.replace('# Alpha', '# Renamed Alpha'), 1],
  ['leaf-insertion', text + '\n## Five\nbody', null],
  ['leaf-deletion', text.replace('## One\nbody\n', ''), null],
];
const results = scenarios.map(([name, edited, expectedRestored]) => {
  const after = build(files.map((f, i) => i ? f : {...f, text: edited}));
  const next = createLayoutModel(after.nodes, after.meta.layout_root_radius);
  const result = next.apply(records);
  const missingGroupKeys = Object.keys(records).filter(key => !next.keys().includes(key));
  if (expectedRestored !== null) assert.equal(result.restored, expectedRestored, name);
  const unrelated = next.capture(next.groupKey('Demo/B#Alpha/One'));
  if (expectedRestored !== null) assert.deepEqual(unrelated, records[model.groupKey('Demo/B#Alpha/One')], `${name}: other note`);
  const ratio = (graph, id) => {
    const n = graph.nodes.find(n => n.id === id), parent = graph.nodes.find(p => p.id === n.parent);
    return +(n.r / parent.r).toFixed(8);
  };
  return {name, ...result, missingGroupKeys, otherNoteGroupRestored: unrelated !== null,
    otherNoteRadiusRatio: {before: ratio(before, 'Demo/B#Alpha/One'), after: ratio(after, 'Demo/B#Alpha/One')},
    savedGroupsNotRestored: Object.keys(records).length - result.restored};
});
const evidence = {version: '0.0.6', kind: 'baseline-characterization', syntheticOnly: true,
  savedGroups: 4, results};
fs.mkdirSync('.local/evidence/layout-continuity', {recursive: true});
fs.writeFileSync('.local/evidence/layout-continuity/baseline-0.0.6.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
