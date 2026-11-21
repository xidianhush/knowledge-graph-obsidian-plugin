import assert from 'node:assert/strict';
import fs from 'node:fs';
import {analyzeSyncCausality as analyze, CAUSAL_PROTOTYPE_LIMITS} from '../src/sync/causal-prototype.mjs';
const vault = 'a'.repeat(32), ID = n => n.toString(16).padStart(32,'0');
const op = (n, parents=[], changes=[{group:'root',value:{x:n}}]) => ({protocol:1,vault,id:ID(n),parents:parents.map(ID),changes});
const run = records => analyze(records,{vault});
const a=op(1),b=op(2,[1]),c=op(3,[1]),d=op(4,[2,3]);
const checks=[];
function test(name, fn) { fn(); checks.push(name); }
test('Empty set never creates a reset/import operation',()=>assert.equal(run([]).ready.length,0));
test('Causal descendant wins frontier regardless of arrival order',()=>{
  assert.deepEqual(run([b,a]).frontiers,[{group:'root',heads:[b.id]}]);
});
test('Repeated records and JSON property order do not duplicate operations',()=>{
  assert.equal(run([a,JSON.parse(JSON.stringify(a)),{changes:a.changes,parents:[],id:a.id,vault,protocol:1}]).ready.length,1);
});
test('Missing predecessor remains pending and is reconsidered with full input',()=>{
  assert.equal(run([b]).pending.length,1); assert.equal(run([b,a]).pending.length,0);
});
test('Independent groups coexist',()=>{
  const z=op(5,[],[{group:'other',value:{x:1}}]);
  const r=run([a,z]);assert.equal(r.frontiers.length,2);assert.equal(r.conflicts.length,0);
});
test('Concurrent same-group versions are both retained',()=>{
  const r=run([a,b,c]);assert.deepEqual(r.conflicts,[{group:'root',heads:[b.id,c.id]}]);
});
test('Resolution must acknowledge both conflict heads',()=>{
  assert.equal(run([a,b,c,d]).conflicts.length,0);
  assert.deepEqual(run([a,b,c,op(6,[2])]).conflicts[0].heads,[c.id,ID(6)]);
});
test('Multi-group transaction stays whole; analyzer does not auto-apply a fragment',()=>{
  const z=op(5,[1],[{group:'root',value:{x:2}},{group:'child',value:{x:3}}]);
  const r=run([a,z,c]);assert.equal(r.conflicts.length,1);
  assert.deepEqual(r.ready.find(x=>x.id===z.id).changes,z.changes);
  assert.equal(Object.hasOwn(r,'applied'),false);
});
test('Reset tombstone does not revive ancestor; concurrent edits remain conflicts',()=>{
  const z=op(5,[1],[{group:'root',value:null}]);
  assert.deepEqual(run([z,a]).frontiers[0].heads,[z.id]);
  assert.equal(run([a,z,b]).conflicts.length,1);
});
test('Duplicate ID with different content quarantines both and blocks descendants',()=>{
  const r=run([a,{...a,changes:[{group:'root',value:{x:99}}]},b]);
  assert.deepEqual(r.quarantined,[a.id]);assert.equal(r.ready.length,0);assert.equal(r.pending.length,1);
});
test('Unknown protocol does not apply or authorize descendants',()=>{
  const r=run([{...a,protocol:3},b]);assert.equal(r.ready.length,0);assert.equal(r.pending.length,1);
  assert.equal(r.issues[0].reason,'unknown-protocol');
});
test('Foreign vault is isolated',()=>{
  const r=run([{...a,vault:'b'.repeat(32)}]);assert.equal(r.ready.length,0);assert.equal(r.issues[0].reason,'foreign-vault');
});
test('Dependency cycle and descendants remain pending',()=>{
  const r=run([op(1,[2]),op(2,[1]),op(3,[2])]);assert.equal(r.ready.length,0);assert.equal(r.pending.length,3);
});
test('Malformed metadata, duplicate groups and non-finite/deep payloads rejected',()=>{
  let deep={};for(let i=0;i<20;i++)deep={deep};
  for(const x of [{...a,parents:[a.id]}, {...a,parents:[b.id,b.id]}, {...a,id:'../bad'},
    {...a,changes:[...a.changes,...a.changes]}, op(4,[],[{group:'root',value:{x:Infinity}}]),op(4,[],[{group:'root',value:deep}]),
    {...a,id:[a.id]}, {...a,extra:true}]) assert.equal(run([x]).ready.length,0);
});
test('JSON cycles and getters are refused',()=>{
  const cycle={};cycle.self=cycle;
  assert.equal(run([op(8,[],[{group:'root',value:cycle}])]).ready.length,0);
  const value={};Object.defineProperty(value,'x',{enumerable:true,get(){throw Error('getter executed')}});
  assert.equal(run([op(9,[],[{group:'root',value}])]).issues[0].reason,'not-json');
});
test('Inputs and outputs are isolated; no clock or revision preference',()=>{
  const records=[a,b,c];const before=structuredClone(records),r=run(records);
  r.ready[0].changes[0].value.x=100;assert.deepEqual(records,before);
  assert.deepEqual(run(records).conflicts[0].heads,[b.id,c.id]);
});
test('All permutations of a resolving DAG converge',()=>{
  function* permutations(xs){if(!xs.length){yield [];return;}for(let i=0;i<xs.length;i++)for(const rest of permutations(xs.filter((_,j)=>i!==j)))yield [xs[i],...rest];}
  const expected=run([a,b,c,d]);for(const p of permutations([a,b,c,d]))assert.deepEqual(run(p),expected);
});
test('Operation budget pauses analysis without modifying retained input',()=>{
  const input=Array.from({length:CAUSAL_PROTOTYPE_LIMITS.operations+1},()=>a);
  assert.throws(()=>run(input),/operation-budget/);assert.equal(input.length,CAUSAL_PROTOTYPE_LIMITS.operations+1);
});
test('Huge sparse arrays are refused before iteration/allocation',()=>{
  const sparse=[];sparse.length=100000000;
  assert.equal(run([op(8,[],[{group:'root',value:{sparse}}])]).issues[0].reason,'not-json-array');
});
test('Oversize same-ID copy quarantines known record and blocks its children',()=>{
  const large={...a,changes:[{group:'root',value:{parts:Array.from({length:Math.ceil(CAUSAL_PROTOTYPE_LIMITS.recordBytes/8192)+1},()=> 'x'.repeat(8192))}}]};
  const r=run([a,large,b]);assert.deepEqual(r.quarantined,[a.id]);assert.equal(r.ready.length,0);
  assert.ok(r.issues.some(x=>x.reason==='record-byte-budget'));
});
test('Aggregate byte budget fails the snapshot instead of returning partial success',()=>{
  const big=Array.from({length:100},(_,i)=>op(i+10,[],[{group:'root',value:{parts:Array.from({length:64},()=> 'x'.repeat(8192))}}]));
  assert.throws(()=>run(big),/total-byte-budget/);
});
const result={passed:checks.length,checks,scope:'Experimental causal metadata index only; not layout merge or sync-service verification'};
fs.mkdirSync('.local/sync-016/a2',{recursive:true});
fs.writeFileSync('.local/sync-016/a2/causal-check.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
