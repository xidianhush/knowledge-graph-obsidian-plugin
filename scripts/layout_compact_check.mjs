import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
import * as old from '../tests/fixtures/graph-core-0.0.9.mjs';
const results=[];
const files=[{path:'Demo/A.md',text:'# A\n## One\nbody\n## Two\nother\n# B\nbody'}];
const build=()=>buildGraph({files,config:{include:['**']}});
const g=build(),m=old.createLayoutModel(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius);
const n=g.nodes.find(n=>n.title==='One');assert.equal(e.begin(n.id),null);e.move(n.x+4,n.y+2);e.commit();
const key=m.groupKey(n.id),legacy={[key]:m.capture(key)},positions=g.nodes.map(n=>[n.x,n.y]);
const next=build(),nm=createLayoutModel(next.nodes,next.meta.layout_root_radius);
assert.equal(nm.apply(legacy).restored,1);next.nodes.forEach((n,i)=>assert.ok(Math.hypot(n.x-positions[i][0],n.y-positions[i][1])<1e-9));results.push('Actual 0.0.9 record reads without changing geometry');
let disk;const store=createLayoutStore({schemaVersion:1,revision:7,groups:legacy},async d=>{disk=structuredClone(d)});
await store.reconcile(nm);assert.equal(disk.schemaVersion,2);assert.ok(Object.hasOwn(disk.groups[key],'outline'));
assert.ok(disk.groups[key].shape.every(n=>!Object.hasOwn(n,'outline')));assert.deepEqual(disk.groups[key].points,legacy[key].points);
results.push('Migration writes compact schema 2 and keeps positions');
const cold=createLayoutStore(JSON.parse(JSON.stringify(disk)),async()=>{});assert.equal(nm.apply(cold.state().groups).skipped,0);results.push('Schema 2 JSON cold load');
assert.equal(old.createLayoutStore(disk,async()=>{throw Error('must not write')}).state().unsupported,true);results.push('Old runtime refuses writes to new schema');
const failed=createLayoutStore({schemaVersion:1,revision:7,groups:legacy},async()=>{throw Error('disk full')});
await assert.rejects(failed.reconcile(nm),/disk full/);assert.equal(failed.state().schemaVersion,1);assert.deepEqual(failed.state().groups,legacy);results.push('Migration failure preserves legacy data');
const corrupt=structuredClone(legacy);corrupt[key].shape[0].outline=[];
assert.equal(nm.apply(corrupt).skipped,1);assert.deepEqual(nm.reconcile(corrupt),corrupt);results.push('Conflicting legacy outlines remain rejected');
await store.command({},'reset-all');await store.command({},'undo');assert.equal(nm.apply(store.state().groups).restored,1);results.push('Reset and undo retain compact migrated arrangement');
// Paired timings use the same pipeline graph and alternating implementations.
const text=Array.from({length:5000},(_,i)=>`${i%10?'##':'#'} H${i}\nbody ${i}`).join('\n');
const graph=buildGraph({files:[{path:'Bench/A.md',text}],config:{include:['**']}}),samples={old:[],compact:[]},sizes={};
for(let round=0;round<8;round++)for(const type of round%2?['compact','old']:['old','compact']){
 const data=structuredClone(graph),api=type==='old'?old:{createLayoutModel},model=api.createLayoutModel(data.nodes,data.meta.layout_root_radius);
 const node=data.nodes.find(n=>n.title==='H1'),editor=createLayoutEditor(data.nodes,data.meta.layout_root_radius);editor.begin(node.id);editor.move(node.x+1,node.y+1);editor.commit();
 const record=model.capture(model.groupKey(node.id)),records={[model.groupKey(node.id)]:record};sizes[type]=Buffer.byteLength(JSON.stringify(records));
 const start=performance.now();const reconciled=model.reconcile(records);model.apply(reconciled);JSON.parse(JSON.stringify(reconciled));samples[type].push(performance.now()-start);
}
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
const report={passed:results.length,results,paired:{sizes,medianMs:{old:median(samples.old),compact:median(samples.compact)},samples},timingScope:'reconcile + apply + JSON roundtrip; paired single process, 8 alternating samples each'};
fs.mkdirSync('.local/evidence/continuous-010',{recursive:true});
fs.writeFileSync('.local/evidence/continuous-010/compact.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
