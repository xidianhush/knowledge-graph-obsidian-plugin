import fs from 'node:fs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor} from '../dist/graph-core.mjs';
const stats=a=>{const s=[...a].sort((a,b)=>a-b);return{p50:s[Math.floor(s.length*.5)],p95:s[Math.min(s.length-1,Math.floor(s.length*.95))],max:s.at(-1)}};
const version=JSON.parse(fs.readFileSync(new URL('../manifest.json',import.meta.url))).version;
const output='.local/evidence/continuous-'+version.replaceAll('.','');
const rows=[];
for(const count of [100,1000,5000]){
 const original=Array.from({length:count},(_,i)=>`${i%10===0?'#':'##'} H${i}\nbody ${i}`).join('\n');
 const build=text=>buildGraph({files:[{path:'Bench/A.md',text},{path:'Bench/B.md',text:'# Other\nbody'}],config:{include:['**']}});
 const initial=build(original),model=createLayoutModel(initial.nodes,initial.meta.layout_root_radius),editor=createLayoutEditor(initial.nodes,initial.meta.layout_root_radius);
 const n=initial.nodes.find(n=>n.title==='H1');assert.equal(editor.begin(n.id),null);editor.move(n.x+1,n.y+1);editor.commit();
 let records={[model.groupKey(n.id)]:model.capture(model.groupKey(n.id))};assert.ok(Object.values(records)[0]);
 const buildTimes=[],modelTimes=[],reconcileTimes=[],writeTimes=[],bytes=[],restored=[],heap=[];
 for(let i=0;i<12;i++){
  const text=i%4===0?original.replace('H1\n','Renamed\n'):i%4===2?original+'\n# Added\nextra':original;
  let at=performance.now();const g=build(text);buildTimes.push(performance.now()-at);
  at=performance.now();const m=createLayoutModel(g.nodes,g.meta.layout_root_radius);modelTimes.push(performance.now()-at);
  at=performance.now();records=m.reconcile(records);const applied=m.apply(records);reconcileTimes.push(performance.now()-at);restored.push(applied);
  at=performance.now();const encoded=JSON.stringify(records);JSON.parse(encoded);writeTimes.push(performance.now()-at);bytes.push(Buffer.byteLength(encoded));
  assert.ok(g.nodes.every(n=>Number.isFinite(n.x+n.y+n.r)));assert.equal(applied.skipped,0);
  heap.push(process.memoryUsage().heapUsed);
 }
 rows.push({headings:count,nodes:initial.nodes.length,iterations:12,buildMs:stats(buildTimes),modelMs:stats(modelTimes),reconcileApplyMs:stats(reconcileTimes),serializationRoundtripMs:stats(writeTimes),maxRecordBytes:Math.max(...bytes),heapSamples:heap,restored});
}
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(output+'/node.json',JSON.stringify({version,runtime:process.version,measurement:'Node single-process synthetic; serialization is not filesystem IO',rows},null,2));
console.log(JSON.stringify(rows.map(({heapSamples,restored,...r})=>r)));
