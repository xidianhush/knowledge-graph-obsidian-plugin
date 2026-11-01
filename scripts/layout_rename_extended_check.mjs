import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
const results=[];
async function scenario(name,before,after,accept){
  const build=text=>buildGraph({files:[{path:'Demo/A.md',text},{path:'Demo/B.md',text:'# Other\nbody'}],config:{include:['**']}});
  const graph=build(before),m=createLayoutModel(graph.nodes,graph.meta.layout_root_radius);
  const editor=createLayoutEditor(graph.nodes,graph.meta.layout_root_radius),records={};
  for(const key of m.keys()){
    const n=graph.nodes.find(n=>n.kind==='heading' && m.groupKey(n.id)===key);if(!n)continue;
    assert.equal(editor.begin(n.id),null);editor.move(n.x+7,n.y+3);editor.commit();
    const record=m.capture(key);if(record)records[key]=record;
  }
  assert.ok(Object.keys(records).length);
  const coords=graph.nodes.map(n=>[n.x,n.y]);
  const rebuilt=build(after),next=createLayoutModel(rebuilt.nodes,rebuilt.meta.layout_root_radius);
  let disk;const store=createLayoutStore(JSON.parse(JSON.stringify({schemaVersion:1,revision:1,groups:records})),async v=>disk=v);
  await store.reconcile(next);
  const report=next.apply(store.state().groups);
  if(accept){
    assert.equal(report.restored,Object.keys(records).length,name);
    rebuilt.nodes.forEach((n,i)=>assert.ok(Math.hypot(n.x-coords[i][0],n.y-coords[i][1])<1e-7,name));
    const reload=build(after),cold=createLayoutModel(reload.nodes,reload.meta.layout_root_radius);
    assert.equal(cold.apply(JSON.parse(JSON.stringify(disk||store.state())).groups).skipped,0);
  }else assert.ok(report.skipped>0 || report.restored<Object.keys(records).length,name);
  results.push({name,accepted:accept,report});
}
await scenario('Single heading with body','# Only\nbody','# Renamed\nbody',true);
await scenario('Single empty heading','# Only','# Renamed',false);
await scenario('Duplicate siblings with distinct body','# P\n## Same\nfirst\n## Same\nsecond','# P\n## New\nfirst\n## Same\nsecond',true);
await scenario('Second duplicate renamed','# P\n## Same\nfirst\n## Same\nsecond','# P\n## Same\nfirst\n## New\nsecond',true);
await scenario('Identical duplicate bodies refuse inference','# P\n## Same\nsame\n## Same\nsame','# P\n## New\nsame\n## Same\nsame',false);
await scenario('Empty duplicates refuse inference','# P\n## Same\n## Same','# P\n## New\n## Same',false);
await scenario('Duplicate reordering plus rename refuses inference','# P\n## Same\nfirst\n## Same\nsecond','# P\n## New\nsecond\n## Same\nfirst',false);
await scenario('Duplicate parent migrates child groups','# P\nfirst\n## Child\nchild one\n# P\nsecond\n## Child\nchild two','# New\nfirst\n## Child\nchild one\n# P\nsecond\n## Child\nchild two',true);
await scenario('Changed renamed section refuses inference','# A\nfirst\n# B\nsecond','# New\nchanged\n# B\nsecond',false);
await scenario('Rename with unrelated body insertion','# A\nfirst\n# B\nsecond','# New\nfirst\n# B\nsecond\nextra',true);
fs.mkdirSync('.local/evidence/layout-rename-008',{recursive:true});
fs.writeFileSync('.local/evidence/layout-rename-008/core.json',JSON.stringify(results,null,2));
console.log(JSON.stringify({passed:results.length,results}));
