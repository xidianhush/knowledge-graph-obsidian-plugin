import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutStore} from '../dist/graph-core.mjs';
const version=JSON.parse(fs.readFileSync(new URL('../manifest.json',import.meta.url))).version;
const output=new URL('../.local/evidence/layout-performance/',import.meta.url);fs.mkdirSync(output,{recursive:true});
const source=fs.readFileSync(new URL('../src/core/layout-edit.js',import.meta.url),'utf8');
// Count actual projection iterations in a test-only instrumented copy.
assert.ok(source.includes('for(const n of candidate)'));
const perf={iterations:0};
const createEditor=vm.runInNewContext(source.replace('for(const n of candidate)','perf.iterations++;for(const n of candidate)')+'\ncreateLayoutEditor',{perf});
function stats(samples){const a=[...samples].sort((a,b)=>a-b);return{samples:a.length,p50:a[Math.floor(a.length*.5)]||0,p95:a[Math.min(a.length-1,Math.floor(a.length*.95))]||0,max:a.at(-1)||0};}
function fixture(siblings,branch){
  return buildGraph({files:Array.from({length:siblings},(_,i)=>({path:`Group/Note${i}.md`,text:branch===1?'body':Array.from({length:branch-1},(_,j)=>`${j%10===0?'#':'##'} Heading ${j}\nbody`).join('\n')})),config:{include:['**']}});
}
const results=[];
for(const [siblings,branch]of [[10,1],[50,1],[128,1],[200,1],[10,10],[10,100],[10,500],[10,501]]){
  const graph=fixture(siblings,branch),nodes=graph.nodes,id='Group/Note0';
  const init=performance.now(),model=createLayoutModel(nodes,graph.meta.layout_root_radius),modelMs=performance.now()-init;
  const edit=createEditor(nodes,graph.meta.layout_root_radius),before=nodes.map(n=>[n.x,n.y]),n=nodes.find(n=>n.id===id),parent=nodes.find(n=>n.id===n.parent);
  const at=performance.now(),error=edit.begin(id),beginMs=performance.now()-at;
  const row={siblings,branch,affected:siblings*branch,nodes:nodes.length,modelMs,beginMs,error};
  if(error){assert.equal(edit.active,false);assert.deepEqual(nodes.map(n=>[n.x,n.y]),before);row.rejectedSafely=true;results.push(row);continue;}
  const moves=[],iterations=[];let blocked=0;
  for(let i=0;i<90;i++){
    perf.iterations=0;const t=performance.now();
    const limit=nodes.find(a=>a.id==='Group').r;
    blocked+=Number(edit.move(n.x+Math.cos(i*.16)*limit*.04,n.y+Math.sin(i*.16)*limit*.04));
    moves.push(performance.now()-t);iterations.push(perf.iterations);
  }
  row.moveMs=stats(moves);row.iterations=stats(iterations);row.blocked=blocked;
  row.moved=nodes.some((n,i)=>Math.hypot(n.x-before[i][0],n.y-before[i][1])>1e-6);
  const key=model.groupKey(id),captureAt=performance.now(),record=model.capture(key);row.captureMs=performance.now()-captureAt;
  row.recordBytes=Buffer.byteLength(JSON.stringify(record));
  const restoreAt=performance.now();if(record)assert.equal(model.apply({[key]:record}).restored,1);row.restoreMs=performance.now()-restoreAt;
  const end=performance.now();edit.cancel();row.cancelMs=performance.now()-end;
  assert.deepEqual(nodes.map(n=>[n.x,n.y]),before);
  results.push(row);
}
// A wide outline can dominate serialization even though only ten headings move.
const heavy=fixture(1,1001),heavyModel=createLayoutModel(heavy.nodes,heavy.meta.layout_root_radius),he=heavy.nodes.find(n=>n.kind==='heading'&&n.parent.includes('#'));
const hedit=createEditor(heavy.nodes,heavy.meta.layout_root_radius);assert.equal(hedit.begin(he.id),null);hedit.move(he.x+1,he.y+1);hedit.commit();
const captureStart=performance.now(),record=heavyModel.capture(heavyModel.groupKey(he.id)),captureMs=performance.now()-captureStart;
let writeBytes=0;const store=createLayoutStore(null,async d=>{writeBytes=Buffer.byteLength(JSON.stringify(d));});
const commitStart=performance.now();await store.command({},'edit',heavyModel.groupKey(he.id),record);const commitMs=performance.now()-commitStart;
const report={version,runtime:process.version,measurement:'Node wall time; test-only projection counters; not renderer frame time',results,wideOutline:{headings:1000,captureMs,commitMs,writeBytes}};
fs.writeFileSync(new URL(`node-${version}.json`,output),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
