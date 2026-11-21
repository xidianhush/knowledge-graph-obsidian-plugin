import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fixture,layout,id,empty,vault,model} from './sync-auto-publish-test-helpers.mjs';
import {createAutoPublishQueue} from '../src/sync/auto-publish-queue.mjs';
import {testMemoryStore} from './sync-host-test-helpers.mjs';
const left=await layout(-20),right=await layout(20),checks=[];
async function test(name,fn){await fn();checks.push(name);}
const same=(a,b)=>{assert.deepEqual(a.groups,b.groups);assert.deepEqual(a.structures,b.structures);};
async function copyShared(from,to){await to.adapter.mkdir(to.history.directory);for(const row of (await from.history.scan()).inventory)await to.adapter.writeBinary(row.name,await from.adapter.readBinary(row.name));}
await test('Only a successfully durable saved draft notification starts automatic publication',async()=>{
 const f=await fixture();await assert.rejects(f.save({...left,schemaVersion:99}));await f.queue.settled();assert.equal((await f.history.scan()).count,0);
 await f.save(left);await f.queue.settled();assert.equal((await f.history.scan()).count,1);same(f.session.state().accepted.snapshot,left);assert.equal(f.session.state().localState.layoutDraft,null);await f.close();
});
await test('Duplicate saved notifications and unchanged layouts do not create duplicate operations',async()=>{
 const f=await fixture(),d=await f.save(left);f.queue.notifySaved(d.id);f.queue.notifySaved(d.id);await f.queue.settled();await f.save(left);await f.queue.settled();assert.equal((await f.history.scan()).count,1);await f.close();
});
await test('Hidden or disabled gates keep durable drafts without shared writes',async()=>{
 const f=await fixture();f.setHidden(true);await f.save(left);await f.queue.settled();assert.equal((await f.history.scan()).count,0);same(f.session.state().localState.layoutDraft.value,left);
 f.setHidden(false);await f.queue.resume();assert.equal((await f.history.scan()).count,1);f.setEnabled(false);await f.save(right);await f.queue.settled();assert.equal((await f.history.scan()).count,1);await f.close();
});
await test('Newer draft cannot change pending ID/body and is rebased only over its own accepted publication',async()=>{
 const f=await fixture();await f.coordinator.stageLayoutDraft(left);const pending=await f.stage(left);await f.coordinator.stageLayoutDraft(right);
 await f.queue.resume({confirmed:true});const current=f.session.state(),scan=await f.history.scan();assert.equal(scan.canonicalFiles.size,2);same(current.accepted.snapshot,right);assert.equal(current.localState.layoutDraft,null);
 const first=current.accepted.operations.find(op=>op.id===pending.id);assert.deepEqual(first,pending.operation);const second=current.accepted.operations.find(op=>op.id!==pending.id);assert.deepEqual(second.parents,[pending.id]);await f.close();
});
await test('Write failure pauses without a hot retry loop; explicit retry preserves the pending ID',async()=>{
 let fail=true,calls=0;const f=await fixture({write:async()=>{calls++;if(fail)throw Error('write failed');}});await f.save(left);await f.queue.settled();const pending=f.session.state().pending;assert.ok(pending);assert.equal(calls,1);
 await f.save(right);await f.queue.settled();assert.equal(calls,1);assert.deepEqual(f.session.state().pending.operation,pending.operation);fail=false;await f.queue.resume();assert.equal((await f.history.scan()).canonicalFiles.size,2);same(f.session.state().accepted.snapshot,right);await f.close();
});
await test('A fresh queue never publishes restored work without explicit confirmation',async()=>{
 const f=await fixture();await f.coordinator.stageLayoutDraft(left);assert.equal((await f.queue.resume()).reason,'publication-review-required');assert.equal((await f.history.scan()).count,0);await f.queue.resume({confirmed:true});assert.equal((await f.history.scan()).count,1);await f.close();
});
await test('A new save cannot implicitly authorize a pending operation restored at queue construction',async()=>{
 const f=await fixture();await f.stage(left);await f.queue.close();
 const q=createAutoPublishQueue({readLocal:()=>f.session.state(),publish:f.publisher.publish});const d=await f.coordinator.stageLayoutDraft(right);
 assert.equal((await q.notifySaved(d.id)).reason,'publication-review-required');assert.equal((await f.history.scan()).count,0);
 await q.resume({confirmed:true});assert.equal((await f.history.scan()).canonicalFiles.size,2);same(f.session.state().accepted.snapshot,right);await q.close();await f.close();
});
await test('A multi-note saved layout packs structures in the owning domain only',async()=>{
 const f=await fixture(),b=await layout(10,'B'),both={...left,groups:{...left.groups,...b.groups},structures:{...left.structures,...b.structures}};
 await f.save(both);await f.queue.settled();assert.equal((await f.history.scan()).count,1);same(f.session.state().accepted.snapshot,both);await f.close();
});
await test('Foreign acceptance cannot authorize rebasing even an identical restored draft',async()=>{
 const remote=await fixture();await remote.save(left);await remote.queue.settled();const f=await fixture();await f.coordinator.stageLayoutDraft(left);
 const scan=await remote.history.scan();await f.adapter.mkdir(f.history.directory);for(const row of scan.inventory)await f.adapter.writeBinary(row.name,await remote.adapter.readBinary(row.name));
 assert.equal((await f.session.acceptExternal()).kind,'accepted');assert.equal((await f.coordinator.settlePublishedLayoutDraft()).reason,'layout-draft-review');
 assert.ok(f.session.state().localState.layoutDraft);await f.close();await remote.close();
});
await test('Atomic local-state settling refuses stale acceptance or stale complete local state',async()=>{
 const f=await fixture();await f.coordinator.stageLayoutDraft(left);const before=f.session.state(),settings=await f.coordinator.beginSettingsDraft();
 assert.equal((await f.session.compareAndSetLocalState(before.localState,{...before.localState,layoutDraft:null},{acceptedFingerprint:before.accepted.fingerprint})).ok,false);
 assert.equal((await f.session.compareAndSetLocalState(f.session.state().localState,before.localState,{acceptedFingerprint:'0'.repeat(64)})).ok,false);
 assert.equal(f.session.state().localState.settingsDraft.id,settings.id);assert.ok(f.session.state().localState.layoutDraft);assert.equal(f.session.state().faulted,false);await f.close();
});
await test('An explicitly confirmed legacy local-state v1 draft uses the existing v2 read mapping',async()=>{
 const f=await fixture();await f.coordinator.stageLayoutDraft(left);const legacy=f.session.state().localState;delete legacy.restoreSource;legacy.version=1;await f.session.saveLocalState(legacy);await f.close();
 const reopened=await fixture({privateStore:f.backing});await reopened.queue.resume({confirmed:true});same(reopened.session.state().accepted.snapshot,left);assert.equal(reopened.session.state().localState.layoutDraft,null);await reopened.close();
});
await test('Durable save failure creates neither a notification nor a shared write',async()=>{
 const base=testMemoryStore();let fail=false;const store={...base,create:async(...args)=>{if(fail)throw Error('quota');return base.create(...args);}};
 const f=await fixture({privateStore:store});fail=true;await assert.rejects(f.save(left),/quota/);await f.queue.settled();assert.equal((await f.history.scan()).count,0);assert.equal(f.queue.state().armed,false);await f.close();
});
await test('A live reservation blocks publication while editing; releasing it allows explicit retry',async()=>{
 const f=await fixture(),g=f.store.reserveExternal(x=>x);await f.save(left);await f.queue.settled();assert.equal((await f.history.scan()).count,0);assert.equal(f.queue.state().lastResult.reason,'layout-busy');
 g.release();await f.queue.resume();assert.equal((await f.history.scan()).count,1);await f.close();
});
await test('Unknown shared files and directory budgets pause without staging or retry on later saves',async()=>{
 for(const budget of [false,true]){
  const f=await fixture();await f.adapter.mkdir(f.history.directory);
  if(budget)for(let n=0;n<1025;n++)await f.adapter.writeBinary(f.history.directory+'/'+n+'.json',new ArrayBuffer(0));
  else await f.adapter.writeBinary(f.history.directory+'/unknown.json',new TextEncoder().encode('{}').buffer);
  await f.save(left);await f.queue.settled();assert.equal(f.queue.state().paused,true);assert.equal(f.session.state().pending,null);assert.equal(f.session.state().accepted.operations.length,0);
  await f.save(right);await f.queue.settled();assert.equal(f.session.state().pending,null);same(f.session.state().localState.layoutDraft.value,right);await f.close();
 }
});
await test('A known shared conflict blocks ordinary publication before allocating a pending operation',async()=>{
 const one=await fixture({nextId:()=>id(81)}),two=await fixture({nextId:()=>id(82)}),f=await fixture();await one.save(left);await two.save(right);await Promise.all([one.queue.settled(),two.queue.settled()]);await copyShared(one,f);await copyShared(two,f);
 await f.save(left);await f.queue.settled();assert.equal(f.queue.state().lastResult.reason,'shared-candidate-blocked');assert.equal(f.session.state().pending,null);assert.equal((await f.history.scan()).count,2);assert.equal(f.session.state().accepted.operations.length,0);await f.close();await one.close();await two.close();
});
await test('A new draft saved while an old write is in flight survives and follows the accepted operation',async()=>{
 let f,newSave,once=true;f=await fixture({write:async()=>{if(once){once=false;newSave=f.save(right);}}});await f.save(left);await f.queue.settled();await newSave;await f.queue.settled();
 assert.equal(f.session.state().accepted.operations.length,2);same(f.session.state().accepted.snapshot,right);assert.equal(f.session.state().localState.layoutDraft,null);assert.deepEqual(f.store.state().groups,{});await f.close();
});
await test('Close waits for an active shared write and never starts the newer saved draft',async()=>{
 let unblock,started;const signal=new Promise(resolve=>started=resolve),wait=new Promise(resolve=>unblock=resolve);let writes=0;
 const f=await fixture({write:async()=>{writes++;started();await wait;}});await f.save(left);await signal;
 const newer=f.coordinator.stageLayoutDraft(right),close=f.queue.close();let closed=false;close.then(()=>closed=true);await Promise.resolve();assert.equal(closed,false);unblock();await close;await newer;
 assert.equal(writes,1);assert.equal(f.session.state().accepted.operations.length,1);same(f.session.state().localState.layoutDraft.value,right);assert.equal((await f.queue.notifySaved(f.session.state().localState.layoutDraft.id)).reason,'queue-closed');assert.equal(writes,1);await f.close();
});
await test('Concurrent receive and publication preserve admission in both reservation orders',async()=>{
 const remote=await fixture({nextId:()=>id(83)});await remote.save(await layout(10,'B'));await remote.queue.settled();
 let receive,guard,once=true,armed=false,f;f=await fixture({write:async()=>{if(armed&&once){once=false;receive=f.session.acceptExternal({reserve:()=>guard=f.store.reserveExternal(x=>x)});}}});await copyShared(remote,f);armed=true;
 await f.save(left);await f.queue.settled();assert.equal((await receive).reason,'local-layout-draft');assert.equal(f.session.state().accepted.operations.length,1);assert.equal(guard,undefined);
 const adopted=await f.session.acceptExternal({reserve:()=>guard=f.store.reserveExternal(x=>x)});assert.equal(adopted.kind,'accepted');assert.equal(f.session.state().accepted.operations.length,2);guard.release();await f.close();
 const second=await fixture();await copyShared(remote,second);let unblock,started;const signal=new Promise(resolve=>started=resolve),wait=new Promise(resolve=>unblock=resolve);let receiverGuard;
 second.hook(async step=>{if(step==='after-receive')await wait;});const receiving=second.session.acceptExternal({reserve:()=>{receiverGuard=second.store.reserveExternal(x=>x);started();return receiverGuard;}});await signal;
 const saved=second.save(right);assert.equal((await second.publisher.publish()).reason,'layout-busy');unblock();await receiving;receiverGuard.release();await saved;await second.queue.settled();
 assert.equal(second.session.state().accepted.operations.length,1);same(second.session.state().localState.layoutDraft.value,right);assert.equal(second.queue.state().lastResult.reason,'layout-draft-review');assert.equal((await second.history.scan()).count,1);await second.close();await remote.close();
});
await test('Graph change after staging keeps a stable pending operation and leaves the view untouched',async()=>{
 const f=await fixture();let once=false;f.hook(async step=>{if(step==='after-stage'&&!once){once=true;f.bump();}});await f.save(left);await f.queue.settled();const p=f.session.state().pending;assert.ok(p);assert.equal((await f.history.scan()).count,0);assert.deepEqual(f.store.state().groups,{});
 await f.queue.resume();assert.equal(f.session.state().accepted.operations[0].id,p.id);await f.close();
});
await test('Closing before publication drains without starting new shared work and refuses late notifications',async()=>{
 const f=await fixture();let close;f.hook(async step=>{if(step==='after-stage')close=f.queue.close();});await f.save(left);await f.queue.settled();await close;assert.equal((await f.history.scan()).count,0);assert.ok(f.session.state().pending);assert.equal((await f.queue.notifySaved(id(999))).reason,'queue-closed');await f.close();
});
await test('Closing after publish intent or path registration prevents a fresh shared write',async()=>{
 for(const point of ['after-publication-intent','after-attempt-path']){
  const f=await fixture();let close;f.hook(async step=>{if(step===point)close=f.queue.close();});await f.save(left);await f.queue.settled();await close;
  assert.equal((await f.history.scan()).count,0,point);assert.ok(f.session.state().pending);await f.close();
 }
});
await test('No-progress callbacks are bounded rather than spinning; observer errors do not trigger duplicate publishes',async()=>{
 let calls=0;const state={accepted:{fingerprint:'x'},localState:{layoutDraft:{id:'draft',baseFingerprint:'x'}},pending:null};
 const q=createAutoPublishQueue({readLocal:()=>state,canRun:()=>true,publish:async()=>{calls++;return {kind:'noop'};}});await q.resume({confirmed:true});await q.settled();assert.equal(calls,1);assert.equal(q.state().lastResult.reason,'publication-no-progress');await q.close();
 const f=await fixture();await f.queue.close();const bad=createAutoPublishQueue({readLocal:()=>f.session.state(),canRun:()=>true,publish:f.publisher.publish,onResult:()=>{throw Error('observer');}});const d=await f.coordinator.stageLayoutDraft(left);await bad.notifySaved(d.id);await bad.settled();assert.equal((await f.history.scan()).count,1);await bad.close();await f.close();
});
await fs.mkdir('.local/sync-016/unified/u2',{recursive:true});await fs.writeFile('.local/sync-016/unified/u2/queue-check.json',JSON.stringify({passed:checks.length,checks},null,2));console.log(JSON.stringify({passed:checks.length,checks}));
