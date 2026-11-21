import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
import {createLayoutActionAuthor} from '../src/sync/author-prototype.mjs';
import {packSchema3Operation} from '../src/sync/wire-prototype.mjs';
import {planSchema3Transactions as plan,projectAcceptedSchema3History} from '../src/sync/layout-prototype.mjs';
import {remapAcceptedSchema3Paths} from '../src/sync/reconcile-prototype.mjs';
const vault='a'.repeat(32),id=n=>n.toString(16).padStart(32,'0'),clone=x=>structuredClone(x),checks=[];
const text='# Alpha\nalpha body\n## One\none body\n## Two\ntwo body\n# Beta\nbeta body\n## Three\nthree body\n## Four\nfour body';
const files=['A','B','C'].map(n=>({path:`Demo/${n}.md`,text}));
const graph=items=>buildGraph({files:items,config:{include:['**']}});
const make=items=>()=>{const g=graph(items);return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
const empty={schemaVersion:3,revision:9,groups:{},structures:{}};
async function fixture(items=files,shift=1){
  const g=graph(items),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius);
  let disk;const s=createLayoutStore(null,async d=>disk=clone(d));
  for(const [path,title,dx]of [[items[0].path,'One',7],[items[0].path,'Three',5],[items[0].path,'Beta',9],[items[0].path,null,3],[items[1]?.path,'One',4]]){
    if(!path)continue;const n=g.nodes.find(n=>n.path===path&&(title?n.title===title:n.kind==='note'));if(!n)continue;
    assert.equal(e.begin(n.id),null);e.move(n.x+dx*shift,n.y+2);e.commit();const key=m.groupKey(n.id),record=m.capture(key);
    assert.ok(record);await s.command({},'edit',key,record);
  }
  return {...disk,revision:9};
}
const source=await fixture(),alternative=await fixture(files,-1);
function changes(snapshot){return Object.entries(snapshot.groups).map(([group,record])=>({group,value:{schemaVersion:3,record,structures:record.note?{[record.note]:snapshot.structures[record.note]}:{}}}));}
const op=(n,snapshot=source,parents=[])=>packSchema3Operation({vault,id:id(n),parents:parents.map(id),changes:changes(snapshot)});
const initial=op(1);
const ctx=(records=[initial],appliedIds=[id(1)],localBaseline=source)=>({vault,sharedScanComplete:true,records:clone(records),appliedIds:[...appliedIds],localBaseline:clone(localBaseline)});
function author(items=files,options={}){let n=100;return createLayoutActionAuthor({vault,createModel:make(items),nextId:()=>id(n++),...options});}
function commit(a,c,d){const next={...c,records:[...c.records,clone(d.operation)],appliedIds:[...d.appliedIds],localBaseline:clone(d.proposal)};
  return {ctx:next,ack:a.confirmPublished(next)};}
function apply(snapshot,items){const g=graph(items),m=createLayoutModel(g.nodes,g.meta.layout_root_radius);const report=m.apply(snapshot);assert.equal(report.skipped,0);assert.equal(report.restored,Object.keys(snapshot.groups).length);return g;}
async function reference(items,pathChanges=[],baseline=source){
  // Independent existing local-store lifecycle, not the new wire author.
  let disk=clone(baseline);const store=createLayoutStore(disk,async d=>disk=clone(d));
  for(const p of pathChanges)await store.changePath(p.oldPath,p.newPath,p.folder);
  await store.reconcile(make(items)());return disk;
}
function equivalent(actual,expected,items){
  assert.deepEqual(actual.groups,expected.groups);assert.deepEqual(actual.structures,expected.structures);
  const a=apply(actual,items),b=apply(expected,items);a.nodes.forEach((n,i)=>{assert.ok(Math.hypot(n.x-b.nodes[i].x,n.y-b.nodes[i].y)<1e-7);});
}
async function test(name,fn){await fn();checks.push(name);}
const renamed=files.map((f,i)=>i?f:{...f,text:f.text.replace('# Alpha','# Renamed')});
await test('Heading-parent rename matches existing local lifecycle and original world positions',async()=>{
  const c=ctx(),before=clone(c),a=author(renamed),d=a.prepareReconcile(c);assert.equal(d.kind,'publish');
  assert.deepEqual(d.operation.parents,[id(1)]);assert.equal(d.operation.protocol,2);assert.deepEqual(d.backup,source);
  equivalent(d.proposal,await reference(renamed),renamed);
  const old=apply(source,files),now=apply(d.proposal,renamed);old.nodes.forEach((n,i)=>assert.ok(Math.hypot(n.x-now.nodes[i].x,n.y-now.nodes[i].y)<1e-7));
  const removed=Object.keys(source.groups).filter(k=>!Object.hasOwn(d.proposal.groups,k));assert.equal(removed.length,1);
  for(const group of removed)assert.deepEqual(d.operation.changes.find(c=>c.group===group),{group,value:null});
  const affected=Object.keys(source.groups).filter(k=>source.groups[k].note===JSON.stringify(['note','Demo/A.md','']));
  assert.ok(affected.every(group=>d.operation.changes.some(c=>c.group===group)),'all groups sharing changed identity must travel together');
  assert.deepEqual(c,before);const done=commit(a,c,d);assert.equal(done.ack.historyToken,null);assert.equal(a.state().pendingId,null);
  assert.equal(a.prepareReconcile(done.ctx).operation,null);
});
await test('Incremental sibling addition preserves existing local repair and untouched note positions',async()=>{
  const items=files.map((f,i)=>i?f:{...f,text:f.text.replace('## Two','## Added\nnew body\n## Two')});
  const d=author(items).prepareReconcile(ctx());assert.ok(d.operation);equivalent(d.proposal,await reference(items),items);
  assert.ok(Object.values(d.proposal.groups).some(r=>r.repair?.added>0));
  for(const [key,value]of Object.entries(source.groups))if(value.note===JSON.stringify(['note','Demo/B.md','']))assert.deepEqual(d.proposal.groups[key].points,value.points);
});
await test('Incremental sibling deletion retains a feasible repaired group instead of emitting reset',async()=>{
  const items=files.map((f,i)=>i?f:{...f,text:f.text.replace('## Two\ntwo body\n','')});
  const d=author(items).prepareReconcile(ctx());assert.ok(d.operation);equivalent(d.proposal,await reference(items),items);
  assert.equal(Object.keys(d.proposal.groups).length,Object.keys(source.groups).length);
});
await test('Explicit file rename rewrites keys, note identities and parent-group children atomically',async()=>{
  const events=[{oldPath:'Demo/A.md',newPath:'Demo/改名.md',folder:false}],items=files.map((f,i)=>i?f:{...f,path:events[0].newPath});
  const a=author(items),d=a.prepareReconcile(ctx(),{pathChanges:events});assert.ok(d.operation);equivalent(d.proposal,await reference(items,events),items);
  assert.ok(!JSON.stringify(d.proposal).includes('Demo/A.md'));assert.ok(d.operation.changes.some(c=>c.value===null));
  commit(a,ctx(),d);
});
await test('Folder rename and sequential Unicode file rename match the existing store',async()=>{
  const events=[{oldPath:'Demo',newPath:'研究',folder:true},{oldPath:'研究/A.md',newPath:'研究/A-新.md',folder:false}];
  const items=files.map((f,i)=>({...f,path:i?'研究/'+f.path.slice(5):'研究/A-新.md'}));
  const a=author(items),d=a.prepareReconcile(ctx(),{pathChanges:events});assert.ok(d.operation);equivalent(d.proposal,await reference(items,events),items);commit(a,ctx(),d);
});
await test('No rename is inferred merely because a similar new path exists',()=>{
  const items=files.map((f,i)=>i?f:{...f,path:'Demo/Other.md'}),a=author(items),c=ctx(),r=a.prepareReconcile(c);
  assert.equal(r.kind,'review-required');assert.equal(r.operation,null);assert.deepEqual(r.proposal,source);assert.deepEqual(r.backup,source);assert.equal(a.state().pendingId,null);
});
await test('An incompatible note retains all old records and independently repaired groups in the preview',()=>{
  const items=renamed.map(f=>f.path==='Demo/B.md'?{...f,text:f.text.replace('Alpha','New A').replace('Beta','New B')}:f),a=author(items),c=ctx(),before=clone(c),r=a.prepareReconcile(c);
  assert.equal(r.kind,'review-required');assert.deepEqual(r.proposal,source);assert.equal(Object.keys(r.reconciliationPreview.groups).length,Object.keys(source.groups).length);
  assert.ok(r.reconciliationPreview.groups[JSON.stringify(['heading','Demo/A.md','#Renamed'])],JSON.stringify(Object.keys(r.reconciliationPreview.groups)));
  assert.deepEqual(c,before);assert.equal(a.state().pendingId,null);
});
await test('Missing content never drops its saved groups or marks a repair as published',()=>{
  const a=author(files.filter(f=>f.path!=='Demo/B.md')),c=ctx(),r=a.prepareReconcile(c);
  assert.equal(r.kind,'review-required');assert.deepEqual(r.proposal,source);
  const oldKey=JSON.stringify(['heading','Demo/B.md','#Alpha']);assert.deepEqual(r.reconciliationPreview.groups[oldKey],source.groups[oldKey]);assert.equal(a.state().pendingId,null);
});
await test('Ambiguous title replacements never publish inferred resets or migrations',async()=>{
  const items=files.map((f,i)=>i?f:{...f,text:f.text.replace('Alpha','New A').replace('Beta','New B')});
  const a=author(items),r=a.prepareReconcile(ctx());assert.equal(r.kind,'review-required');assert.deepEqual(r.proposal,source);assert.equal(a.state().pendingId,null);
});
await test('An unchanged accepted layout allocates no ID and publishes no file',()=>{
  const a=author(files,{nextId:()=>{throw Error('unexpected ID');}});assert.equal(a.prepareReconcile(ctx()).kind,'noop');
  assert.equal(a.prepareReconcile(ctx(),{pathChanges:[{oldPath:'Other',newPath:'Else',folder:true}]}).operation,null);
});
await test('Received but unapplied versions are never acknowledged by a repair',()=>{
  const remote=op(2,alternative,[1]),c=ctx([initial,remote]),a=author(renamed),d=a.prepareReconcile(c);
  assert.deepEqual(d.operation.parents,[id(1)]);assert.ok(!d.appliedIds.includes(id(2)));assert.equal(d.sharedStatus,'blocked');
  const r=plan([...c.records,d.operation],{vault,baseline:empty,createModel:make(renamed)});assert.equal(r.status,'blocked');assert.ok(r.index.conflicts.length);assert.equal(r.index.ready.length,3);
  commit(a,c,d);
});
await test('Two devices repairing the same old baseline keep concurrent records even with equal values',()=>{
  const a=author(renamed,{nextId:()=>id(100)}),b=author(renamed,{nextId:()=>id(101)}),x=a.prepareReconcile(ctx()),y=b.prepareReconcile(ctx());
  assert.deepEqual(x.proposal,y.proposal);const r=plan([y.operation,initial,x.operation],{vault,baseline:empty,createModel:make(renamed)});
  assert.equal(r.status,'blocked');assert.ok(r.index.conflicts.length);assert.equal(r.index.ready.length,3);
});
await test('Repair input waits for notes; later content permits applying the same immutable operation',()=>{
  const d=author(renamed).prepareReconcile(ctx()),records=[initial,d.operation],before=clone(records);
  assert.equal(plan(records,{vault,baseline:empty,createModel:make(files)}).status,'blocked');
  assert.equal(plan(records,{vault,baseline:empty,createModel:make(renamed)}).status,'candidate');assert.deepEqual(records,before);
});
await test('Applied receipts must be present, causal-closed, conflict-free and match the old baseline',()=>{
  const a=author(renamed),second=op(2,source,[1]);
  for(const c of [ctx([initial],[],source),ctx([initial],[id(99)]),ctx([initial,second],[id(2)]),ctx([initial,op(2,alternative)],[id(1),id(2)]),ctx([initial],[id(1)],empty)])assert.throws(()=>a.prepareReconcile(c));
  assert.equal(a.state().pendingId,null);
});
await test('Malformed, foreign, unknown or missing-dependency shared inputs stop repair publication',()=>{
  const future=op(2);future.protocol=99;const bad=op(2);bad.structures={};const foreign=op(2);foreign.vault='b'.repeat(32);
  for(const record of [future,bad,foreign,op(2,source,[99])]){
    const a=author(renamed),c=ctx([initial,record]),before=clone(c);assert.throws(()=>a.prepareReconcile(c),/shared-input-unresolved/);assert.deepEqual(c,before);assert.equal(a.state().pendingId,null);
  }
  const c={...ctx(),sharedScanComplete:false};assert.throws(()=>author(renamed).prepareReconcile(c),/scan-required/);
});
await test('Rename collisions, traversal, deletes and excessive path events fail without overwriting',()=>{
  const events=[{oldPath:'Demo/A.md',newPath:'Demo/B.md',folder:false},{oldPath:'Demo/A.md',newPath:'../Escape.md',folder:false},
    {oldPath:'Demo/A.md',newPath:null,folder:false},{oldPath:'Demo',newPath:'Demo/Nested',folder:true}];
  for(const event of events){const a=author(),c=ctx(),before=clone(c);assert.throws(()=>a.prepareReconcile(c,{pathChanges:[event]}));assert.deepEqual(c,before);assert.equal(a.state().pendingId,null);}
  assert.throws(()=>author().prepareReconcile(ctx(),{pathChanges:Array(65).fill(events[0])}),/path-budget/);
});
await test('Folder path matching respects segment boundaries and touches identities, not heading prose',()=>{
  const c=clone(source),note=Object.keys(c.structures)[0];c.structures[note][0].title=JSON.stringify(['note','Demo/A.md','']);
  const mapped=remapAcceptedSchema3Paths(c,[{oldPath:'Demo',newPath:'Research',folder:true}]);
  assert.equal(Object.values(mapped.structures)[0][0].title,c.structures[note][0].title);
  assert.deepEqual(remapAcceptedSchema3Paths(source,[{oldPath:'Dem',newPath:'Other',folder:true}]),source);
});
await test('A repair cannot silently turn a dropped source group into a reset',()=>{
  const factory=make(renamed);const a=author(renamed,{createModel:()=>({...factory(),reconcile:()=>({groups:{},structures:{}})})});
  assert.throws(()=>a.prepareReconcile(ctx()),/group-loss/);assert.equal(a.state().pendingId,null);
});
await test('Failed publication retries the same ID/body and can cancel against the old structural state',()=>{
  const a=author(renamed),c=ctx(),d=a.prepareReconcile(c);assert.throws(()=>a.confirmPublished(c));assert.deepEqual(a.retry(),d);
  assert.throws(()=>a.prepareReconcile(c),/pending-publication/);a.cancel(c);assert.equal(a.state().pendingId,null);
  const next=a.prepareReconcile(c);assert.notEqual(next.operation.id,d.operation.id);commit(a,c,next);
});
await test('Published repair cannot be cancelled and structural history clears only after confirmation',()=>{
  let current=files;const a=author(files,{createModel:()=>make(current)()});
  const first=a.prepareEdit(ctx([] ,[],empty),changes(source)),saved=commit(a,ctx([],[],empty),first);assert.equal(a.state().historyEntries,1);
  current=renamed;const d=a.prepareReconcile(saved.ctx);assert.equal(a.state().historyEntries,1);
  const published={...saved.ctx,records:[...saved.ctx.records,d.operation],appliedIds:d.appliedIds,localBaseline:d.proposal};
  assert.throws(()=>a.cancel(published),/already-published/);const ack=a.confirmPublished(published);assert.equal(ack.historyToken,null);assert.equal(a.state().historyEntries,0);
  assert.throws(()=>a.prepareUndo(published,saved.ack.historyToken),/history-token/);
  assert.ok(a.prepareResetAll(published).operation,'ordinary authors can proceed after structural acceptance');
});
await test('Inputs, backup, retry and historical projections are isolated from each other',()=>{
  const c=ctx(),before=clone(c),a=author(renamed),d=a.prepareReconcile(c),expected=a.retry();
  d.backup.groups[Object.keys(d.backup.groups)[0]].points[0].x=999;d.operation.changes[0].value=null;
  assert.deepEqual(a.retry(),expected);assert.deepEqual(c,before);
  const p=projectAcceptedSchema3History(c.records,{vault,revision:9});p.snapshot.groups[Object.keys(p.snapshot.groups)[0]].points[0].x=999;assert.deepEqual(c,before);
});
await test('Changed graph at confirmation keeps the pending record recoverable',()=>{
  let current=renamed;const a=author(renamed,{createModel:()=>make(current)()}),c=ctx(),d=a.prepareReconcile(c);
  current=files;const next={...c,records:[...c.records,d.operation],appliedIds:d.appliedIds,localBaseline:d.proposal};
  assert.throws(()=>a.confirmPublished(next));assert.deepEqual(a.retry(),d);assert.equal(a.state().pendingId,d.operation.id);
  current=renamed;a.confirmPublished(next);assert.equal(a.state().pendingId,null);
});
await test('A restarted author can reconcile from its local accepted snapshot and closed IDs',()=>{
  const a=author(renamed),d=a.prepareReconcile(JSON.parse(JSON.stringify(ctx())));assert.ok(d.operation);
  const done=commit(a,ctx(),d),reloaded=author(renamed);assert.equal(reloaded.prepareReconcile(JSON.parse(JSON.stringify(done.ctx))).operation,null);
});
await test('Unknown or duplicate input cannot be hidden by the historical projection helper',()=>{
  const changed=op(1,alternative);assert.throws(()=>projectAcceptedSchema3History([initial,changed],{vault}),/unresolved/);
  const missing=op(2,source,[99]);assert.throws(()=>projectAcceptedSchema3History([missing],{vault}),/unresolved/);
});
const result={passed:checks.length,checks,scope:'Synthetic reconciliation author and existing-core/store coordinate references; no durable acceptance ledger, native app or sync-service claim'};
fs.mkdirSync('.local/sync-016/a2',{recursive:true});fs.writeFileSync('.local/sync-016/a2/reconcile-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
