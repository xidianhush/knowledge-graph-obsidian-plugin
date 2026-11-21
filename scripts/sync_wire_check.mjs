// Wire compatibility and optimized-index checks against independent references.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
import {analyzeSyncCausality,buildSyncReachability,cloneBoundedSyncJson,CAUSAL_PROTOTYPE_LIMITS as limits} from '../src/sync/causal-prototype.mjs';
import {packSchema3Operation,schema3Changes} from '../src/sync/wire-prototype.mjs';
import {planSchema3Transactions as plan} from '../src/sync/layout-prototype.mjs';
const vault='a'.repeat(32),id=n=>n.toString(16).padStart(32,'0'),checks=[];
function test(name,fn){fn();checks.push(name);}
const files=[{path:'Synthetic/测试.md',text:'# First\n## Child\nbody\n# Second\ntext'}];
const graph=()=>buildGraph({files,config:{include:['**']}});
const model=()=>{const g=graph();return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
const g=graph(),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius);
let disk;const store=createLayoutStore(null,async value=>{disk=structuredClone(value);});
for(const [title,dx]of [['Second',20],['Child',2]]){
  const n=g.nodes.find(n=>n.title===title);assert.equal(e.begin(n.id),null);e.move(n.x+dx,n.y+1);e.commit();
  const key=m.groupKey(n.id);await store.command({},'edit',key,m.capture(key));
}
const changes=Object.entries(disk.groups).map(([group,record])=>({group,value:{schemaVersion:3,record,structures:{[record.note]:disk.structures[record.note]}}}));
const empty={schemaVersion:3,revision:0,groups:{},structures:{}};
const packed=(n=1,parents=[],value=changes)=>packSchema3Operation({vault,id:id(n),parents:parents.map(id),changes:value});
const legacy=(n=1,parents=[],value=changes)=>({protocol:1,vault,id:id(n),parents:parents.map(id),changes:structuredClone(value)});
const run=records=>plan(records,{vault,baseline:empty,createModel:model});
const copy=x=>structuredClone(x);
test('v2 carries one identity table and preserves real schema3/world coordinates',()=>{
  const op=packed();assert.equal(op.protocol,2);assert.equal(op.layoutSchema,3);
  assert.equal(Object.keys(op.structures).length,1);assert.equal(op.changes.length,2);
  assert.ok(op.changes.every(c=>!Object.hasOwn(c.value,'structures')));
  assert.deepEqual(schema3Changes(op),changes);assert.ok(Buffer.byteLength(JSON.stringify(op))<Buffer.byteLength(JSON.stringify(legacy())));
  const r=run([op]);assert.equal(r.status,'candidate');
  const fresh=graph(),applier=createLayoutModel(fresh.nodes,fresh.meta.layout_root_radius);applier.apply(r.proposal);
  fresh.nodes.forEach((n,i)=>{assert.ok(Math.abs(n.x-g.nodes[i].x)<1e-7);assert.ok(Math.abs(n.y-g.nodes[i].y)<1e-7);});
});
test('Legacy and deduplicated wire produce identical proposals through mixed history',()=>{
  assert.deepEqual(run([legacy()]).proposal,run([packed()]).proposal);
  const reset=[{group:changes[0].group,value:null}];
  assert.deepEqual(run([legacy(),packed(2,[1],reset)]).proposal,run([packed(),legacy(2,[1],reset)]).proposal);
});
test('Missing, unused, malformed or unknown-version identity tables quarantine whole transactions',()=>{
  const variants=[];let op=packed();op.structures={};variants.push(op);
  op=packed();op.structures.unused=[];variants.push(op);
  op=packed();op.layoutSchema=4;variants.push(op);
  op=packed();op.protocol=3;variants.push(op);
  op=packed();op.structures[Object.keys(op.structures)[0]][0].parent='wrong';variants.push(op);
  for(const value of variants){const r=run([value,packed(2,[1])]);assert.deepEqual(r.index.quarantined,[id(1)]);assert.equal(r.index.ready.length,0);assert.equal(r.index.pending.length,1);assert.deepEqual(r.proposal,empty);}
});
test('Conflicting same-ID wire bodies taint both copies and keep descendants pending',()=>{
  const altered=packed();altered.structures[Object.keys(altered.structures)[0]][0].title+=' changed';
  const r=run([packed(),altered,packed(2,[1])]);assert.deepEqual(r.index.quarantined,[id(1)]);assert.equal(r.index.pending.length,1);
  // Even equivalent v1/v2 projections are different immutable record bodies.
  assert.deepEqual(run([legacy(),packed()]).index.quarantined,[id(1)]);
});
test('Canonical key order deduplicates equivalent bodies without aliasing callers',()=>{
  const op=packed(),reverse=Object.fromEntries(Object.entries(op).reverse());
  const r=run([op,reverse]);assert.equal(r.index.ready.length,1);assert.equal(r.status,'candidate');
  op.structures[Object.keys(op.structures)[0]][0].title='mutated';
  assert.notEqual(r.index.ready[0].structures[Object.keys(op.structures)[0]][0].title,'mutated');
  const source=copy(changes),encoded=packed(3,[],source);encoded.changes[0].value.points[0].x+=1;assert.deepEqual(source,changes);
});
test('Writer rejects conflicting structures and getters without evaluating them',()=>{
  const bad=changes.map(copy);bad[1].value.structures[Object.keys(bad[1].value.structures)[0]][0].title='different';
  assert.throws(()=>packed(1,[],bad),/structure-conflict/);
  let reads=0;const getter={...changes[0]};Object.defineProperty(getter,'value',{enumerable:true,get(){reads++;return changes[0].value;}});
  assert.throws(()=>packed(1,[],[getter]),/wire-value/);assert.equal(reads,0);
});
test('UTF8 and escaping budgets use bytes rather than JS string length',()=>{
  for(const value of ['测试😀','\n"\\','ASCII']){const bytes=Buffer.byteLength(JSON.stringify(value));
    assert.equal(cloneBoundedSyncJson(value,{maxBytes:bytes}),value);
    assert.throws(()=>cloneBoundedSyncJson(value,{maxBytes:bytes-1}),/byte-budget/);}
});
test('Snapshots can exceed record budget but an oversized operation is retained as quarantined',()=>{
  const payload={parts:Array.from({length:300},()=> 'x'.repeat(8192))};
  assert.deepEqual(cloneBoundedSyncJson(payload),payload);
  const op={protocol:1,vault,id:id(1),parents:[],changes:[{group:'root',value:payload}]};const before=copy(op);
  const r=analyzeSyncCausality([op],{vault});assert.ok(r.issues.some(x=>x.reason==='record-byte-budget'));assert.deepEqual(op,before);assert.deepEqual(r.quarantined,[id(1)]);
  assert.equal(limits.recordBytes,2*1024*1024);assert.equal(limits.snapshotBytes,8*1024*1024);
});
test('Bit reachability and group frontiers match a slow Set reference across deterministic DAGs',()=>{
  for(let seed=1;seed<=12;seed++){
    let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
    const records=[],ancestors=new Map();
    for(let i=1;i<=96;i++){
      const parents=[...new Set(Array.from({length:i===1?0:random()%4},()=>1+random()%(i-1)))];
      const before=new Set();for(const p of parents){before.add(id(p));for(const a of ancestors.get(id(p)))before.add(a);}ancestors.set(id(i),before);
      records.push({protocol:1,vault,id:id(i),parents:parents.map(id),changes:[{group:'g'+random()%7,value:{seed}}]});
    }
    const index=analyzeSyncCausality([...records].reverse(),{vault}),reach=buildSyncReachability(index.ready);
    for(const op of records){assert.deepEqual([...reach.before(op.id)].sort(),[...ancestors.get(op.id)].sort());
      for(const other of records)assert.equal(reach.has(op.id,other.id),ancestors.get(op.id).has(other.id));}
    for(const frontier of index.frontiers){const writers=records.filter(o=>o.changes[0].group===frontier.group);
      assert.deepEqual(frontier.heads,writers.filter(o=>!writers.some(other=>ancestors.get(other.id).has(o.id))).map(o=>o.id).sort());}
  }
});
test('1024 causal layout operations succeed at the bound; 1025 pauses without mutation',()=>{
  const records=Array.from({length:1024},(_,i)=>packed(i+1,i?[i]:[],[changes[0]]));
  const r=run([...records].reverse());assert.equal(r.status,'candidate');assert.equal(r.index.ready.length,1024);
  assert.deepEqual(r.proposal,run([packed(1,[],[changes[0]])]).proposal);
  const extra=packed(1025,[1024],[changes[0]]);assert.throws(()=>run([...records,extra]),/operation-budget/);assert.equal(records.length,1024);
});
test('Long fork/merge preserves transaction conflict closure and rejects partial resolution',()=>{
  const records=[packed(1),packed(2,[],[{group:changes[0].group,value:null}])];
  for(let i=3;i<70;i++)records.push(packed(i,[i===3?1:i-1],[changes[1]]));
  const partial=packed(70,[69,2],[changes[0]]),descendant=packed(71,[70]);
  let r=run([...records,partial,descendant]);assert.ok(r.index.quarantined.includes(id(70)));assert.ok(r.index.pending.some(x=>x.id===id(71)));
  r=run([...records,packed(70,[69,2])]);assert.equal(r.status,'candidate');assert.deepEqual(r.proposal,run([packed()]).proposal);
});
const result={passed:checks.length,checks,scope:'Synthetic wire/optimized algorithm checks; no filesystem synchronization, iPad or service performance claim'};
fs.mkdirSync('.local/sync-016/a2',{recursive:true});fs.writeFileSync('.local/sync-016/a2/wire-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
