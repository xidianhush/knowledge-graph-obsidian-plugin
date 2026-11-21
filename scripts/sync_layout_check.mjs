import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
import {planSchema3Transactions as plan,validateSchema3Change,probeSchema3Snapshot} from '../src/sync/layout-prototype.mjs';
const vault='a'.repeat(32),ID=n=>n.toString(16).padStart(32,'0');
const files=['A','B','C'].map(n=>({path:`Demo/${n}.md`,text:'# First\n## Child\nbody\n# Second\ntext'}));
const graph=()=>buildGraph({files,config:{include:['**']}});
const makeModel=()=>{const g=graph();return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
const empty={schemaVersion:3,revision:7,groups:{},structures:{}};
const checks=[];function test(name,fn){fn();checks.push(name);}
async function capture(path,title,dx=20,dy=10){
  const g=graph(),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius);
  const n=g.nodes.find(x=>x.path===path&&(title?x.title===title:x.kind==='note'));
  assert.ok(n);assert.equal(e.begin(n.id),null);e.move(n.x+dx,n.y+dy);e.commit();
  const group=m.groupKey(n.id),record=m.capture(group);assert.ok(record);
  let disk;const store=createLayoutStore(null,async d=>{disk=structuredClone(d);});
  await store.command({},'edit',group,record);
  return {group,value:{schemaVersion:3,record:disk.groups[group],structures:disk.structures}};
}
const A=await capture('Demo/A.md','Second'),A2=await capture('Demo/A.md','Second',-20,-10);
const B=await capture('Demo/B.md','Second'),C=await capture('Demo/C.md','Second');
const child=await capture('Demo/A.md','Child',2,1);
// Capture a real sequence of nested local edits, retaining editor-produced world
// coordinates as the independent reference (not a second call to model.apply).
const ng=graph(),nm=createLayoutModel(ng.nodes,ng.meta.layout_root_radius),ne=createLayoutEditor(ng.nodes,ng.meta.layout_root_radius);
let nestedDisk;const ns=createLayoutStore(null,async d=>{nestedDisk=clone(d);});
for(const [title,dx,dy]of [['Second',20,10],['Child',2,1],[null,8,4]]){
  const n=ng.nodes.find(x=>x.path==='Demo/A.md'&&(title?x.title===title:x.kind==='note'));
  assert.equal(ne.begin(n.id),null);ne.move(n.x+dx,n.y+dy);ne.commit();
  const k=nm.groupKey(n.id);await ns.command({},'edit',k,nm.capture(k));
}
const nestedChanges=Object.entries(nestedDisk.groups).map(([group,record])=>({group,value:{schemaVersion:3,record,
 structures:record.note?{[record.note]:nestedDisk.structures[record.note]}:{}}}));
const nestedPositions=ng.nodes.map(n=>[n.x,n.y]);
const op=(id,parents,changes)=>({protocol:1,vault,id:ID(id),parents:parents.map(ID),changes:structuredClone(changes)});
const run=(ops,baseline=empty,createModel=makeModel)=>plan(ops,{vault,baseline,createModel});
const snapshot=(changes)=>({schemaVersion:3,revision:7,groups:Object.fromEntries(changes.filter(c=>c.value).map(c=>[c.group,c.value.record])),
 structures:Object.assign({},...changes.filter(c=>c.value).map(c=>c.value.structures))});
function clone(x){return structuredClone(x);}
test('Actual capture/store schema3 record passes exact identity and geometry',()=>{
  assert.deepEqual(validateSchema3Change(A),A);
  const r=run([op(1,[],[A])]);assert.equal(r.status,'candidate');assert.equal(probeSchema3Snapshot(r.proposal,makeModel).ok,true);
  assert.equal(r.proposal.revision,7);
});
test('Independent note groups merge without changing either snapshot',()=>{
  const r=run([op(1,[],[A]),op(2,[],[B])]);assert.equal(r.status,'candidate');
  assert.deepEqual(r.proposal,snapshot([A,B]));
});
test('Parent-local child and parent changes compose through existing apply',()=>{
  const r=run([op(1,[],nestedChanges)]);assert.equal(r.status,'candidate');
  const g=graph(),m=createLayoutModel(g.nodes,g.meta.layout_root_radius);
  assert.deepEqual(m.apply(r.proposal),{restored:3,skipped:0});
  g.nodes.forEach((n,i)=>{assert.ok(Math.abs(n.x-nestedPositions[i][0])<1e-7);assert.ok(Math.abs(n.y-nestedPositions[i][1])<1e-7);});
});
test('One conflicting group blocks the whole A+B transaction but not independent C',()=>{
  const r=run([op(1,[],[A,B]),op(2,[],[A2]),op(3,[],[C])]);
  assert.equal(r.status,'blocked');assert.deepEqual(r.proposal,snapshot([C]));
  assert.ok(r.decisions.some(d=>d.status==='conflict'&&d.groups.includes(A.group)&&d.groups.includes(B.group)));
});
test('Conflict closure follows historical A+B and B+C transactions',()=>{
  const r=run([op(1,[],[A,B]),op(2,[],[B,C]),op(3,[],[A2])]);
  assert.deepEqual(r.proposal,empty);assert.ok(r.decisions.some(d=>d.groups.length===3&&d.status==='conflict'));
});
test('Blocked domain retains the complete caller baseline',()=>{
  const base=snapshot([A,B]);const r=run([op(1,[],[A,B]),op(2,[],[A2])],base);
  assert.deepEqual(r.proposal,base);
});
test('Full-domain resolution includes both heads and both groups',()=>{
  const r=run([op(1,[],[A,B]),op(2,[],[A2]),op(3,[1,2],[A2,B])]);
  assert.equal(r.status,'candidate');assert.deepEqual(r.proposal,snapshot([A2,B]));
});
test('Partial resolution is quarantined; its descendants cannot legitimize it',()=>{
  const r=run([op(1,[],[A,B]),op(2,[],[A2]),op(3,[1,2],[A2]),op(4,[3],[C])]);
  assert.ok(r.index.quarantined.includes(ID(3)));assert.ok(r.index.pending.some(x=>x.id===ID(4)));
  assert.deepEqual(r.proposal,empty);
});
test('Referencing one conflict branch never hides the other branch',()=>{
  const r=run([op(1,[],[A,B]),op(2,[],[A2]),op(3,[1],[A])]);
  assert.equal(r.status,'blocked');assert.deepEqual(r.proposal,empty);
});
test('Reset tombstone deletes only the addressed group and remains in causal heads',()=>{
  const r=run([op(1,[],[A,B]),op(2,[1],[{group:A.group,value:null}])]);
  assert.equal(r.status,'candidate');assert.deepEqual(r.proposal,snapshot([B]));
  assert.deepEqual(r.index.frontiers.find(f=>f.group===A.group).heads,[ID(2)]);
});
test('Concurrent reset/edit preserves baseline and conflict',()=>{
  const r=run([op(1,[],[A]),op(2,[1],[{group:A.group,value:null}]),op(3,[1],[A2])],snapshot([A]));
  assert.equal(r.status,'blocked');assert.deepEqual(r.proposal,snapshot([A]));
});
test('Reset-all-shaped transaction keeps concurrent unrelated new group',()=>{
  const r=run([op(1,[],[A,B]),op(2,[1],[{group:A.group,value:null},{group:B.group,value:null}]),op(3,[1],[C])]);
  assert.equal(r.status,'candidate');assert.deepEqual(r.proposal,snapshot([C]));
});
test('One malformed change rejects its entire transaction and causal descendants',()=>{
  const bad=clone(B);bad.value.record.points[0].id=bad.value.record.points[1].id;
  const r=run([op(1,[],[A,bad]),op(2,[1],[C])]);
  assert.equal(r.index.ready.length,0);assert.equal(r.index.pending.length,1);assert.deepEqual(r.proposal,empty);
});
test('Invalid schema copy of an existing ID quarantines both without choosing an arrival winner',()=>{
  const a=op(1,[],[A]),bad=clone(a);bad.changes[0].value.schemaVersion=4;
  for(const input of [[a,bad,op(2,[1],[B])],[bad,a,op(2,[1],[B])]]){
    const r=run(input);assert.deepEqual(r.proposal,empty);assert.ok(r.index.quarantined.includes(ID(1)));assert.equal(r.index.pending.length,1);
  }
});
test('Schema/identity/path/coordinate/repair corruptions are refused',()=>{
  const edits=[x=>x.value.schemaVersion=4,x=>delete x.value.structures[x.value.record.note],
    x=>x.value.record.note='wrong',x=>x.value.record.structure='bad',x=>x.value.record.points[0].x=Infinity,
    x=>x.value.record.shape[1].id=x.value.record.shape[0].id,
    x=>x.value.structures[x.value.record.note][0].parent=x.value.structures[x.value.record.note][1].key,
    x=>x.value.record.repair={moved:-1,added:0},x=>x.group=JSON.stringify(['note','../A.md',''])];
  for(const edit of edits){const x=clone(A);edit(x);const r=run([op(1,[],[x])]);assert.equal(r.index.ready.length,0);assert.deepEqual(r.proposal,empty);}
});
test('Finite overlapping geometry is held as incompatible, with other groups unfragmented',()=>{
  const bad=clone(A);bad.value.record.points[1].x=bad.value.record.points[0].x;bad.value.record.points[1].y=bad.value.record.points[0].y;
  const r=run([op(1,[],[bad,B])]);assert.equal(r.status,'blocked');assert.deepEqual(r.proposal,empty);
  assert.ok(r.decisions.some(d=>d.status==='incompatible'));
});
test('Unknown model group is held for later content arrival, not dropped from index',()=>{
  const missing=clone(A);const replace=s=>s.replaceAll('Demo/A.md','Demo/Later.md');
  const raw=JSON.stringify(missing);const value=JSON.parse(replace(raw));
  const r=run([op(1,[],[value,B])]);assert.equal(r.index.ready.length,1);assert.deepEqual(r.proposal,empty);
  assert.equal(r.decisions[0].reason,'missing-group');
});
test('Forged but syntactically valid identity cannot bypass current model context',()=>{
  const bad=clone(A);bad.value.structures[bad.value.record.note][0].evidence='8:1:2';
  const r=run([op(1,[],[bad,B])]);assert.equal(r.status,'blocked');assert.deepEqual(r.proposal,empty);
  assert.equal(r.decisions[0].reason,'identity-context');
});
test('Different structure snapshots of the same note are not last-writer merged',()=>{
  const bad=clone(child);bad.value.structures[bad.value.record.note][0].evidence='8:1:2';
  const r=run([op(1,[],[A]),op(2,[],[bad])]);assert.equal(r.status,'blocked');assert.deepEqual(r.proposal,empty);
  assert.ok(r.decisions.some(d=>d.reason==='layout-structure-conflict'));
});
test('Same-note conflict blocks coupled child group while independent B progresses',()=>{
  const r=run([op(1,[],[A]),op(2,[],[A2]),op(3,[],[child]),op(4,[],[B])]);
  assert.equal(r.status,'blocked');assert.deepEqual(r.proposal,snapshot([B]));
});
test('Conflict resolution must explicitly cover all historically coupled note groups',()=>{
  const r=run([op(1,[],[A]),op(2,[],[A2]),op(3,[],[child]),op(4,[1,2,3],[A])]);
  assert.ok(r.index.quarantined.includes(ID(4)));assert.deepEqual(r.proposal,empty);
});
test('No-op/empty new-device input does not clear existing local baseline',()=>{
  const base=snapshot([A,B]);assert.deepEqual(run([],base).proposal,base);
});
test('Candidate planning never mutates local baseline, operations, or fixture graph',()=>{
  const input=[op(1,[],[A,B])],base=clone(empty),copy=clone(input),g=graph(),before=JSON.stringify(g);
  const r=run(input,base,()=>createLayoutModel(clone(g.nodes),g.meta.layout_root_radius));
  const indexed=clone(r.index.ready);
  r.proposal.groups[A.group].points[0].x=999;
  assert.deepEqual(input,copy);assert.deepEqual(base,empty);assert.equal(JSON.stringify(g),before);
  assert.deepEqual(r.index.ready,indexed);
});
test('All 24 arrival orders and duplicate records yield identical proposal and decisions',()=>{
  const input=[op(1,[],[A,B]),op(2,[],[A2]),op(3,[1,2],[A2,B]),op(4,[],[C])];
  const expected=run(input);
  function* permutations(xs){if(!xs.length){yield [];return;}for(let i=0;i<xs.length;i++)for(const rest of permutations(xs.filter((_,j)=>i!==j)))yield [xs[i],...rest];}
  for(const seq of [...permutations(input),[input[2],input[0],input[3],input[1],input[2]]]){
    const r=run(seq);assert.deepEqual(r.proposal,expected.proposal);assert.deepEqual(r.decisions,expected.decisions);
  }
});
test('Unsafe baseline and planner operation budget fail without a partial proposal',()=>{
  const bad=snapshot([A]);bad.groups[A.group].points[0].x=999;
  assert.throws(()=>run([],bad),/baseline-incompatible/);
  assert.throws(()=>run(Array.from({length:1025},()=>op(1,[],[A]))),/layout-operation-budget/);
  const many=Array.from({length:3},(_,i)=>op(i+1,[],Array.from({length:100},(_,j)=>({group:JSON.stringify(['folder',`Missing/${i}-${j}`,'']),value:null}))));
  assert.throws(()=>run(many),/layout-group-budget/);
});
const report={passed:checks.length,checks,scope:'Schema3 and isolated candidate planning only; no persistence, migration, undo authorization or true-device rerun'};
fs.mkdirSync('.local/sync-016/a2',{recursive:true});fs.writeFileSync('.local/sync-016/a2/layout-check.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
