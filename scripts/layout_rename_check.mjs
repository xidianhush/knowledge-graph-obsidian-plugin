import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutStore,createLayoutEditor} from '../dist/graph-core.mjs';
const original='# Alpha\nalpha body\n## One\none body\n## Two\ntwo body\n# Beta\nbeta body\n## Three\nthree body\n## Four\nfour body';
const build=text=>buildGraph({files:['A','B'].map(n=>({path:`Demo/${n}.md`,text:n==='A'?text:original})),config:{include:['**']}});
const model=g=>createLayoutModel(g.nodes,g.meta.layout_root_radius);
const graph=build(original),m=model(graph),editor=createLayoutEditor(graph.nodes,graph.meta.layout_root_radius);
let disk;const store=createLayoutStore(null,async v=>{disk=structuredClone(v);}), owner={};
for(const id of ['Demo/A#Alpha/One','Demo/A#Beta/Three','Demo/A#Beta','Demo/B#Alpha/One']){
  assert.equal(editor.begin(id),null);const n=graph.nodes.find(n=>n.id===id);
  editor.move(n.x+9,n.y+5);editor.commit();const k=m.groupKey(id),value=m.capture(k);assert.ok(value);
  await store.command(owner,'edit',k,value);
}
const initial=structuredClone(disk),coords=graph.nodes.map(n=>[n.x,n.y]),results=[];
const near=g=>g.nodes.forEach((n,i)=>assert.ok(Math.hypot(n.x-coords[i][0],n.y-coords[i][1])<1e-7));
async function rename(text,name,source=initial){
  const g=build(text),next=model(g);let persisted;
  const cold=createLayoutStore(JSON.parse(JSON.stringify(source)),async v=>{persisted=v;});
  await cold.reconcile(next);const r=next.apply(cold.state().groups);
  assert.equal(r.restored,4);assert.equal(r.skipped,0);near(g);
  results.push(name);return persisted||cold.state();
}
const leaf=await rename(original.replace('## One','## Renamed'),'Leaf rename after cold JSON load');
await rename(original.replace('## One','## Again'),'Second rename follows persisted alias',leaf);
await rename(original.replace('# Alpha','# Renamed Parent'),'Parent rename preserves descendants and all sibling groups');
await rename(original.replace('## One','## Two'),'Rename into a distinct-body duplicate title');
await rename(original.replace('## One','## Renamed').replace('beta body','edited unrelated prose'),'Unrelated section body edits do not invalidate rename');
const enriched=model(build(original)).reconcile(Object.fromEntries(Object.entries(initial.groups).map(([k,v])=>{const c=structuredClone(v);delete c.identity;return[k,c];})));
await rename(original.replace('## One','## Renamed'),'Legacy records enriched on compatible build',{...initial,groups:enriched});
for(const [name,text] of [
  ['Rename plus body change',original.replace('## One\none body','## New\nnew body')],
  ['Multiple renames',original.replace('## One','## New').replace('## Two','## Other')],
]){
  const next=model(build(text)),records=next.reconcile(initial.groups);
  assert.equal(next.apply(records).restored<4,true,name);results.push(name+' declines uncertain migration');
}
const damaged=structuredClone(initial.groups);Object.values(damaged).forEach(r=>r.identity=[null]);assert.doesNotThrow(()=>model(build(original)).reconcile(damaged));results.push('Malformed identity metadata does not crash rebuild');
const failed=createLayoutStore(initial,async()=>{throw Error('disk full');});
await assert.rejects(failed.reconcile(model(build(original.replace('## One','## New')))),/disk full/);
assert.deepEqual(failed.state().groups,initial.groups);results.push('Migration write failure preserves saved records');
await store.reconcile(model(build(original)),()=>false);assert.deepEqual(store.state().groups,initial.groups);results.push('Stale rebuild cannot migrate');
const canUndo=store.state().canUndo;await store.reconcile(model(build(original)));assert.equal(store.state().canUndo,canUndo);results.push('Unchanged rebuild preserves undo');
fs.mkdirSync('.local/evidence/layout-rename',{recursive:true});
fs.writeFileSync('.local/evidence/layout-rename/checks.json',JSON.stringify({passed:results.length,results},null,2));
console.log(JSON.stringify({passed:results.length,results}));
