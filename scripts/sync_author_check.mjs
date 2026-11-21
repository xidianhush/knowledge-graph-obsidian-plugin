import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
import {planSchema3Transactions as plan} from '../src/sync/layout-prototype.mjs';
import {createLayoutActionAuthor,randomSyncOperationId} from '../src/sync/author-prototype.mjs';
import {packSchema3Operation} from '../src/sync/wire-prototype.mjs';
const vault='a'.repeat(32),ID=n=>n.toString(16).padStart(32,'0'),clone=x=>structuredClone(x);
const files=['A','B','C'].map(n=>({path:`Demo/${n}.md`,text:'# First\n## Child\nbody\n# Second\ntext'}));
const makeModel=()=>{const g=buildGraph({files,config:{include:['**']}});return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
const empty={schemaVersion:3,revision:9,groups:{},structures:{}};
async function capture(path,title='Second',dx=20){
  const g=buildGraph({files,config:{include:['**']}}),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius);
  const n=g.nodes.find(n=>n.path===path&&n.title===title);assert.equal(e.begin(n.id),null);e.move(n.x+dx,n.y+3);e.commit();
  const group=m.groupKey(n.id);let disk;const s=createLayoutStore(null,async d=>disk=clone(d));
  await s.command({},'edit',group,m.capture(group));return {group,value:{schemaVersion:3,record:disk.groups[group],structures:disk.structures}};
}
const A=await capture('Demo/A.md'),A2=await capture('Demo/A.md','Second',-20),B=await capture('Demo/B.md'),C=await capture('Demo/C.md');
const child=await capture('Demo/A.md','Child',2);
const op=(n,parents,changes)=>({protocol:1,vault,id:ID(n),parents:parents.map(ID),changes:clone(changes)});
function project(records){const r=plan(records,{vault,baseline:empty,createModel:makeModel});assert.equal(r.status,'candidate');return r.proposal;}
function ctx(records=[],appliedIds=records.map(o=>o.id),localBaseline){return {vault,sharedScanComplete:true,records:clone(records),appliedIds:[...appliedIds],localBaseline:localBaseline||project(records.filter(o=>appliedIds.includes(o.id)))};}
function author(options={}){let i=100;return createLayoutActionAuthor({vault,createModel:makeModel,nextId:()=>ID(i++),...options});}
function commit(a,c,d){const next={...c,records:[...c.records,clone(d.operation)],appliedIds:[...d.appliedIds],localBaseline:clone(d.proposal)};
 return {ctx:next,ack:a.confirmPublished(next)};}
const checks=[];function test(name,fn){fn();checks.push(name);}
test('Initial shared scan is required before normal edits and joins',()=>{
  const a=author(),c={...ctx(),sharedScanComplete:false};assert.throws(()=>a.prepareEdit(c,[A]),/scan-required/);
  assert.throws(()=>a.prepareJoin(c,{choice:'import'}),/scan-required/);assert.equal(a.state().pendingId,null);
});
test('Parents acknowledge only applied heads, never merely received records',()=>{
  const a=author(),c=ctx([op(1,[],[A]),op(2,[1],[B])],[ID(1)]),d=a.prepareEdit(c,[A2]);
  assert.deepEqual(d.operation.parents,[ID(1)]);assert.ok(!d.operation.parents.includes(ID(2)));
  assert.equal(Object.hasOwn(d.proposal.groups,B.group),false);
});
test('Applied receipt must be causal-closed and match actual local snapshot',()=>{
  const records=[op(1,[],[A]),op(2,[1],[B])],a=author();
  assert.throws(()=>a.prepareEdit({...ctx(),records,appliedIds:[ID(2)]},[C]),/applied-not-closed/);
  assert.throws(()=>a.prepareEdit({...ctx(records),localBaseline:empty},[C]),/applied-state-mismatch/);
});
test('Group reset emits a tombstone and preserves other groups',()=>{
  const a=author(),d=a.prepareResetGroup(ctx([op(1,[],[A,B])]),A.group);
  assert.deepEqual(d.operation.changes,[{group:A.group,value:null}]);assert.ok(d.proposal.groups[B.group]);assert.ok(!d.proposal.groups[A.group]);
});
test('Reset-all covers applied groups but preserves concurrent unseen additions',()=>{
  const a=author(),records=[op(1,[],[A,B]),op(2,[1],[C])],c=ctx(records,[ID(1)]),d=a.prepareResetAll(c);
  assert.deepEqual(d.operation.changes.map(x=>x.group).sort(),[A.group,B.group].sort());
  const merged=plan([...records,d.operation],{vault,baseline:empty,createModel:makeModel});
  assert.equal(merged.status,'candidate');assert.deepEqual(Object.keys(merged.proposal.groups),[C.group]);
});
test('Empty reset and unchanged edit never create a clearing record or allocate ID',()=>{
  const a=author({nextId:()=>{throw Error('must not allocate')}});
  assert.equal(a.prepareResetAll(ctx([op(1,[],[A])],[])).operation,null);
  assert.equal(a.prepareResetGroup(ctx(),A.group).operation,null);
  assert.equal(a.prepareEdit(ctx([op(1,[],[A])]),[A]).operation,null);
});
test('Publication failure leaves history unadvanced; retry keeps exact ID/content',()=>{
  const a=author(),c=ctx(),d=a.prepareEdit(c,[A]);assert.equal(a.state().historyEntries,0);
  assert.throws(()=>a.confirmPublished(c),/not-published-and-applied/);
  assert.deepEqual(a.retry(),d);assert.equal(a.state().historyEntries,0);
  const done=commit(a,c,a.retry());assert.ok(done.ack.historyToken);assert.equal(a.state().historyEntries,1);
});
test('Pending publication blocks a second action, and unpublished cancel is safe',()=>{
  const a=author(),c=ctx();a.prepareEdit(c,[A]);assert.throws(()=>a.prepareEdit(c,[B]),/pending-publication/);
  a.cancel(c);assert.equal(a.state().pendingId,null);assert.equal(a.state().historyEntries,0);assert.ok(a.prepareEdit(c,[B]).operation);
});
test('Already published operation cannot be cancelled as if it never happened',()=>{
  const a=author(),c=ctx(),d=a.prepareEdit(c,[A]);const published={...c,records:[d.operation],appliedIds:d.appliedIds,localBaseline:d.proposal};
  assert.throws(()=>a.cancel(published),/already-published/);assert.equal(a.state().pendingId,d.operation.id);
});
test('Undo/redo publish new causal records and retain original history',()=>{
  const a=author(),c=ctx(),first=commit(a,c,a.prepareEdit(c,[A]));
  const undo=a.prepareUndo(first.ctx,first.ack.historyToken);assert.deepEqual(undo.operation.parents,[first.ctx.records[0].id]);
  assert.deepEqual(undo.operation.changes,[{group:A.group,value:null}]);
  const undone=commit(a,first.ctx,undo),redo=a.prepareRedo(undone.ctx,undone.ack.historyToken),redone=commit(a,undone.ctx,redo);
  assert.equal(new Set(redone.ctx.records.map(o=>o.id)).size,3);assert.deepEqual(redone.ctx.localBaseline.groups,first.ctx.localBaseline.groups);
});
test('Two consecutive undos and redos traverse local history through new record IDs',()=>{
  const a=author(),first=commit(a,ctx(),a.prepareEdit(ctx(),[A])),second=commit(a,first.ctx,a.prepareEdit(first.ctx,[A2]));
  const u2=commit(a,second.ctx,a.prepareUndo(second.ctx,second.ack.historyToken));
  const u1=commit(a,u2.ctx,a.prepareUndo(u2.ctx,first.ack.historyToken));assert.deepEqual(u1.ctx.localBaseline.groups,{});
  const r1=commit(a,u1.ctx,a.prepareRedo(u1.ctx,u1.ack.historyToken));
  const r2=commit(a,r1.ctx,a.prepareRedo(r1.ctx,u2.ack.historyToken));
  assert.deepEqual(r2.ctx.localBaseline.groups,second.ctx.localBaseline.groups);assert.equal(r2.ctx.records.length,6);
});
test('Undo rebasing never revives a token made stale by a remote equal-value write',()=>{
  const a=author(),first=commit(a,ctx(),a.prepareEdit(ctx(),[A]));
  const remote=op(2,[100],[A]),withRemote=ctx([...first.ctx.records,remote]);
  const second=commit(a,withRemote,a.prepareEdit(withRemote,[A2]));
  const undone=commit(a,second.ctx,a.prepareUndo(second.ctx,second.ack.historyToken));
  assert.deepEqual(undone.ctx.localBaseline.groups,first.ctx.localBaseline.groups);
  assert.throws(()=>a.prepareUndo(undone.ctx,first.ack.historyToken),/history-stale/);
});
test('Structure changes reject history without changing pending publication or baseline',()=>{
  let changed=false;const factory=()=>{const g=buildGraph({files:changed?files.map(f=>({...f,text:f.text.replace('First','Changed')})):files,config:{include:['**']}});
    return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
  const a=author({createModel:factory}),first=commit(a,ctx(),a.prepareEdit(ctx(),[A])),before=clone(first.ctx.localBaseline);changed=true;
  assert.throws(()=>a.prepareUndo(first.ctx,first.ack.historyToken),/baseline-incompatible/);
  assert.deepEqual(first.ctx.localBaseline,before);assert.equal(a.state().pendingId,null);
});
test('Undo after a reset restores the complete pre-reset multi-group snapshot',()=>{
  const a=author(),c=ctx([op(1,[],[A,B])]),reset=commit(a,c,a.prepareResetAll(c));
  const undo=a.prepareUndo(reset.ctx,reset.ack.historyToken);assert.deepEqual(undo.proposal.groups,c.localBaseline.groups);
});
test('Remote same-group applied change invalidates stale local undo',()=>{
  const a=author(),first=commit(a,ctx(),a.prepareEdit(ctx(),[A]));
  const remote=op(2,[100],[A2]),current=ctx([...first.ctx.records,remote]);
  assert.throws(()=>a.prepareUndo(current,first.ack.historyToken),/history-stale/);assert.equal(a.state().pendingId,null);
});
test('Received but unapplied remote same-group change also blocks stale undo',()=>{
  const a=author(),first=commit(a,ctx(),a.prepareEdit(ctx(),[A]));
  const current=ctx([...first.ctx.records,op(2,[100],[A2])],[ID(100)]);
  assert.throws(()=>a.prepareUndo(current,first.ack.historyToken),/history-stale/);
});
test('Independent received changes do not invalidate undo or become causal parents',()=>{
  const a=author(),first=commit(a,ctx(),a.prepareEdit(ctx(),[A]));
  const current=ctx([...first.ctx.records,op(2,[100],[B])],[ID(100)]),undo=a.prepareUndo(current,first.ack.historyToken);
  assert.deepEqual(undo.operation.parents,[ID(100)]);
  const merged=plan([...current.records,undo.operation],{vault,baseline:empty,createModel:makeModel});
  assert.deepEqual(Object.keys(merged.proposal.groups),[B.group]);
});
test('Related note/transaction domain changes conservatively block old undo',()=>{
  const a=author(),first=commit(a,ctx(),a.prepareEdit(ctx(),[A]));
  const current=ctx([...first.ctx.records,op(2,[100],[child])],[ID(100)]);
  assert.throws(()=>a.prepareUndo(current,first.ack.historyToken),/history-stale/);
});
test('Remote-only history, forged tokens, and tokens after author reload are refused',()=>{
  const c=ctx([op(1,[],[A])]),a=author();assert.throws(()=>a.prepareUndo(c,{source:ID(1)}),/history-token/);
  const first=commit(a,c,a.prepareEdit(c,[A2]));assert.throws(()=>author().prepareUndo(first.ctx,first.ack.historyToken),/history-token/);
});
test('A history token is bound to exact original content, not only the operation ID',()=>{
  const a=author(),first=commit(a,ctx(),a.prepareEdit(ctx(),[A]));
  const replaced=packSchema3Operation({...first.ctx.records[0],changes:[clone(A2)]});
  const current=ctx([replaced]);assert.throws(()=>a.prepareUndo(current,first.ack.historyToken),/history-source-changed/);
});
test('Consumed history tokens cannot be replayed or used with the wrong action',()=>{
  const a=author(),first=commit(a,ctx(),a.prepareEdit(ctx(),[A]));
  assert.throws(()=>a.prepareRedo(first.ctx,first.ack.historyToken),/history-token/);
  const undo=commit(a,first.ctx,a.prepareUndo(first.ctx,first.ack.historyToken));
  assert.throws(()=>a.prepareUndo(undo.ctx,first.ack.historyToken),/history-token/);
});
test('New edits clear redo only after publication confirmation',()=>{
  const a=author(),first=commit(a,ctx(),a.prepareEdit(ctx(),[A]));
  const undo=commit(a,first.ctx,a.prepareUndo(first.ctx,first.ack.historyToken));
  a.prepareEdit(undo.ctx,[B]);a.cancel(undo.ctx);
  const redo=a.prepareRedo(undo.ctx,undo.ack.historyToken);a.cancel(undo.ctx);assert.ok(redo.operation);
  const edited=commit(a,undo.ctx,a.prepareEdit(undo.ctx,[B]));
  assert.throws(()=>a.prepareRedo(edited.ctx,undo.ack.historyToken),/history-token/);
});
test('Only 50 acknowledged session history tokens are retained',()=>{
  const a=author();let c=ctx();const saved=[];
  for(let i=0;i<51;i++){const next=commit(a,c,a.prepareEdit(c,[i%2?A2:A]));c=next.ctx;saved.push(next.ack.historyToken);}
  assert.equal(a.state().historyEntries,50);assert.throws(()=>a.prepareUndo(c,saved[0]),/history-token/);
  assert.ok(a.prepareUndo(c,saved.at(-1)).operation);
});
test('Empty new device adopts existing shared layout without publishing empty reset',()=>{
  const a=author(),c=ctx([op(1,[],[A])],[]),join=a.prepareJoin(c,{choice:'import'});
  assert.equal(join.kind,'adopt-shared');assert.equal(join.operation,null);assert.ok(join.proposal.groups[A.group]);assert.deepEqual(join.appliedIds,[ID(1)]);
  assert.deepEqual(join.backup,empty);
});
test('Local-only import preserves backup and mints receipt only after publication',()=>{
  const a=author(),local=project([op(1,[],[A,B])]),c=ctx([],[],local),d=a.prepareJoin(c,{choice:'import'});
  assert.deepEqual(d.operation.parents,[]);assert.deepEqual(d.backup,local);assert.equal(a.state().historyEntries,0);
  assert.throws(()=>a.confirmPublished(c),/applied-state-mismatch/);
  const done=commit(a,c,d);assert.ok(done.ack.importReceipt);assert.equal(done.ack.historyToken,null);
});
test('Import preview backup is isolated from retained migration state',()=>{
  const a=author(),local=project([op(1,[],[A])]),c=ctx([],[],local),d=a.prepareJoin(c,{choice:'import'});
  d.backup.groups[A.group].points[0].x=99;
  assert.deepEqual(a.retry().backup,local);assert.deepEqual(c.localBaseline,local);
});
test('Both old layouts import as independent roots and preserve same-group conflict',()=>{
  const a=author(),local=project([op(2,[],[A2])]),c=ctx([op(1,[],[A])],[],local),d=a.prepareJoin(c,{choice:'import'});
  assert.deepEqual(d.operation.parents,[]);assert.equal(d.sharedStatus,'blocked');assert.deepEqual(d.proposal.groups,local.groups);
  const done=commit(a,c,d);assert.deepEqual(done.ctx.appliedIds,[d.operation.id]);
  const all=plan(done.ctx.records,{vault,baseline:local,createModel:makeModel});assert.equal(all.index.conflicts.length,1);
});
test('Import receipt prevents repeat publication after author reload, even with conflict',()=>{
  const a=author(),local=project([op(2,[],[A2])]),c=ctx([op(1,[],[A])],[],local),d=a.prepareJoin(c,{choice:'import'}),done=commit(a,c,d);
  const fresh=author({nextId:()=>{throw Error('must not allocate')}}),again=fresh.prepareJoin(done.ctx,{choice:'import',receipt:done.ack.importReceipt});
  assert.equal(again.kind,'already-imported');assert.equal(again.operation,null);assert.equal(again.sharedStatus,'blocked');assert.deepEqual(again.appliedIds,[d.operation.id]);
});
test('Missing import record requests review instead of repeating the migration',()=>{
  const a=author(),local=project([op(1,[],[A])]),c=ctx([],[],local),d=a.prepareJoin(c,{choice:'import'}),done=commit(a,c,d);
  const review=author().prepareJoin(c,{choice:'import',receipt:done.ack.importReceipt});
  assert.equal(review.operation,null);assert.equal(review.reason,'import-record-not-yet-available');
});
test('Foreign, changed, or stale-snapshot import receipt never clears local backup',()=>{
  const a=author(),local=project([op(1,[],[A])]),c=ctx([],[],local),d=a.prepareJoin(c,{choice:'import'}),done=commit(a,c,d);
  const bad=clone(done.ack.importReceipt);bad.vault='b'.repeat(32);
  assert.throws(()=>author().prepareJoin(done.ctx,{choice:'import',receipt:bad}),/import-receipt/);
  const changed=clone(done.ack.importReceipt);changed.operation.changes[0].value.points[0].x=99;
  assert.throws(()=>author().prepareJoin(done.ctx,{choice:'import',receipt:changed}),/import-receipt-content/);
  const other=project([op(2,[],[B])]);assert.throws(()=>author().prepareJoin({...done.ctx,localBaseline:other},{choice:'import',receipt:done.ack.importReceipt}),/import-receipt-snapshot/);
  assert.deepEqual(c.localBaseline,local);
});
test('Shared-only join keeps backup and does not silently adopt unresolved conflicts',()=>{
  const a=author(),local=project([op(3,[],[B])]),records=[op(1,[],[A]),op(2,[],[A2])],d=a.prepareJoin(ctx(records,[],local));
  assert.equal(d.kind,'review-required');assert.equal(d.operation,null);assert.deepEqual(d.proposal,local);assert.deepEqual(d.backup,local);
});
test('Different existing local layout requires explicit join choice even without shared conflicts',()=>{
  const local=project([op(2,[],[B])]),c=ctx([op(1,[],[A])],[],local),a=author();
  const d=a.prepareJoin(c);assert.equal(d.reason,'join-choice-required');assert.deepEqual(d.proposal,local);assert.equal(d.operation,null);
  const accepted=a.prepareJoin(c,{choice:'shared'});assert.ok(accepted.proposal.groups[A.group]);assert.deepEqual(accepted.backup,local);
});
test('Foreign vault, missing dependency, and unknown protocol stop publication',()=>{
  const a=author();assert.throws(()=>a.prepareEdit({...ctx(),vault:'b'.repeat(32)},[A]),/foreign-context/);
  for(const bad of [op(2,[1],[A]),{...op(1,[],[A]),protocol:3}]){
    assert.throws(()=>a.prepareJoin(ctx([bad],[],empty),{choice:'import'}),/shared-input-unresolved/);
  }
  assert.equal(a.state().pendingId,null);
});
test('Secure random IDs do not reuse device configuration counters; collisions fail closed',()=>{
  const c=ctx(),a=createLayoutActionAuthor({vault,createModel:makeModel}),b=createLayoutActionAuthor({vault,createModel:makeModel});
  const da=a.prepareEdit(c,[A]),db=b.prepareEdit(c,[A]);assert.match(da.operation.id,/^[a-f0-9]{32}$/);assert.notEqual(da.operation.id,db.operation.id);
  const colliding=author({nextId:()=>ID(1)});assert.throws(()=>colliding.prepareEdit(ctx([op(1,[],[A])]),[A2]),/id-collision/);
  assert.equal(colliding.state().pendingId,null);assert.throws(()=>randomSyncOperationId({}),/secure-random-unavailable/);
});
test('Inputs, retry outputs and publication history remain isolated',()=>{
  const a=author(),c=ctx(),input=clone(A),before=clone(c),d=a.prepareEdit(c,[input]);
  d.operation.changes[0].value.points[0].x=99;d.proposal.groups[A.group].points[0].x=99;
  const retry=a.retry();assert.notEqual(retry.operation.changes[0].value.points[0].x,99);
  assert.deepEqual(c,before);assert.deepEqual(input,A);assert.equal(a.state().historyEntries,0);
});
const report={passed:checks.length,checks,scope:'A2 in-memory author/confirm/import prototype; no actual durable writes, device sessions or runtime history integration'};
fs.mkdirSync('.local/sync-016/a2',{recursive:true});fs.writeFileSync('.local/sync-016/a2/author-check.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
