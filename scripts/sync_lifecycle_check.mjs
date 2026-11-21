import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel} from '../dist/graph-core.mjs';
import {createDurableSyncSession} from '../src/sync/persistence-prototype.mjs';
import {createPrivateConfigProjection} from '../src/sync/private-config-prototype.mjs';
import {createSettingsCoordinator} from '../src/sync/settings-coordinator-prototype.mjs';
import {openObsidianSyncDevice,createDeviceBoundPrivateStore} from '../src/sync/obsidian-host-prototype.mjs';
import {createLifecycleDevice,createSyncLifecycle,exportRecoveryParts} from '../src/sync/connection-lifecycle-prototype.mjs';
import {createPrivateStoreBudget,PRIVATE_STORE_BUDGET} from '../src/sync/private-store-budget-prototype.mjs';
import {testMemoryStore,testLocalApp,testLockManager} from './sync-host-test-helpers.mjs';
import {validateTestSettings as validate} from './sync-settings-test-helpers.mjs';
const vault='a'.repeat(32),other='c'.repeat(32),pluginId='lifecycle-test',clone=x=>structuredClone(x),empty={schemaVersion:3,revision:0,groups:{},structures:{}};
const model=()=>{const g=buildGraph({files:[{path:'Synthetic/A.md',text:'# First\nbody'}],config:{include:['**']}});return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
const source=()=>({settings:{language:'auto'},ui:{legend:'false'},unknown:{kept:42}});
async function fixture(options={}){
  const app=options.app||testLocalApp(),locks=options.locks||testLockManager(),stores=options.stores||new Map(),shared=testMemoryStore(),opened=[];let hook=null;
  async function make(){
    const base=await openObsidianSyncDevice({app,pluginId,locks});if(!base.state().connection)await base.connect(vault);
    const device=await createLifecycleDevice({device:base,app,pluginId,locks,nextId:()=> 'd'.repeat(32)});
    const controller=createSyncLifecycle({device,checkpoint:step=>hook?.(step),openBundle:async({device,vault})=>{
      if(!stores.has(vault))stores.set(vault,testMemoryStore());const backend=stores.get(vault),quota=createPrivateStoreBudget({store:backend,limits:options.limits||PRIVATE_STORE_BUDGET});
      const session=createDurableSyncSession({privateStore:createDeviceBoundPrivateStore({store:quota.store,device,vault}),sharedStore:shared,vault,installation:device.state().installation,createModel:model});
      const projection=createPrivateConfigProjection({session,validateSettings:validate,getExternalEpoch:()=>0});
      const coordinator=createSettingsCoordinator({session,documentStore:projection.documentStore,validateSettings:validate,nextId:()=> '1'.repeat(32)});
      const bundle={session,projection,coordinator,quota,backend,open:()=>quota.recover(async()=>{await session.open();if(!session.state().initialized&&!options.noInitialize)await session.initialize({source:'explicit-empty',localBaseline:empty});if(options.failOpen?.())throw Error('after-session-open');if(session.state().initialized){await projection.initialize({sourceData:source()});await coordinator.open();}})};opened.push(bundle);return bundle;
    }});
    return {base,device,controller};
  }
  const f=await make();await f.controller.open();return {...f,app,locks,stores,shared,opened,make,hook:fn=>hook=fn,current:()=>opened.at(-1)};
}
const checks=[];async function test(name,fn){await fn();checks.push(name);}
async function quotaFixture(limits={softBytes:100,hardBytes:200,softFiles:5,hardFiles:10,softEvents:4,hardEvents:8}){const store=testMemoryStore(),quota=createPrivateStoreBudget({store,limits}),release=await quota.store.acquire('b'.repeat(32));return {store,quota,release};}
await test('Soft byte limit pauses before executing a new callback and keeps all old records',async()=>{
  const f=await quotaFixture();await f.quota.run(()=>f.quota.store.create('blobs/a','x'.repeat(100)));let called=false;const r=await f.quota.run(()=>{called=true;});assert.equal(r.kind,'held');assert.equal(called,false);assert.equal(f.store.files.get('blobs/a').length,100);await f.release();
});
await test('Already admitted work may finish within reserved hard capacity',async()=>{
  const f=await quotaFixture();const r=await f.quota.run(async()=>{await f.quota.store.create('blobs/a','x'.repeat(99));await f.quota.store.create('blobs/b','y'.repeat(90));});assert.equal(r.kind,'completed');assert.equal(r.status.paused,true);assert.equal(r.status.bytes,189);await f.release();
});
await test('A hard byte overflow rejects before installing the new record',async()=>{
  const f=await quotaFixture();await f.quota.recover(()=>f.quota.store.create('blobs/a','x'.repeat(190)));await assert.rejects(f.quota.recover(()=>f.quota.store.create('blobs/b','y'.repeat(11))),/hard-limit/);assert.equal(f.store.files.has('blobs/b'),false);assert.equal(f.store.files.get('blobs/a').length,190);await f.release();
});
await test('Recovery metadata can use reserve after normal admission pauses',async()=>{
  const f=await quotaFixture();await f.quota.run(()=>f.quota.store.create('blobs/a','x'.repeat(100)));assert.equal((await f.quota.recover(()=>f.quota.store.create('events/1','ok'))).kind,'completed');assert.equal(f.store.files.get('events/1'),'ok');await f.release();
});
await test('Existing names remain no-replace and idempotent even at the hard ceiling',async()=>{
  const f=await quotaFixture();await f.quota.recover(()=>f.quota.store.create('blobs/a','x'.repeat(200)));assert.equal((await f.quota.recover(()=>f.quota.store.create('blobs/a','different'))).value,'exists');assert.equal(f.store.files.get('blobs/a').length,200);await f.release();
});
await test('File count and journal-event limits reserve room independently of bytes',async()=>{
  const f=await quotaFixture();await f.quota.run(async()=>{for(let n=1;n<=4;n++)await f.quota.store.create('events/'+n,'x');});assert.equal((await f.quota.inspect()).events,4);assert.equal((await f.quota.run(()=>{})).kind,'held');await f.quota.recover(async()=>{for(let n=5;n<=8;n++)await f.quota.store.create('events/'+n,'x');});await assert.rejects(f.quota.recover(()=>f.quota.store.create('events/9','x')),/hard-limit/);await f.release();
});
await test('Incomplete inventory is a pause, never a completed partial count',async()=>{
  const f=await quotaFixture();f.store.files.set('blobs/a','x'.repeat(201));const status=await f.quota.inspect();assert.equal(status.complete,false);assert.equal(status.paused,true);let called=false;await f.quota.run(()=>called=true);assert.equal(called,false);await f.release();
});
await test('Unscoped private writes and invalid budget shapes cannot bypass admission',async()=>{
  const f=await quotaFixture();await assert.rejects(f.quota.store.create('blobs/a','x'),/admission/);assert.throws(()=>createPrivateStoreBudget({store:f.store,limits:{softBytes:200,hardBytes:100}}),/limits/);await f.release();
});
await test('Normal admissions serialize their inventory checks',async()=>{
  const f=await quotaFixture();const r=await Promise.all([f.quota.run(()=>f.quota.store.create('a','x'.repeat(100))),f.quota.run(()=>f.quota.store.create('b','y'))]);assert.equal(r[0].kind,'completed');assert.equal(r[1].kind,'held');assert.equal(f.store.files.has('b'),false);await f.release();
});
await test('Exclusive batch writes serialize hard reservations and recover from an uncertain install',async()=>{
  const store=testMemoryStore(),create=store.create;
  store.stableInventoryUnderLease=true;
  store.create=async(name,text)=>{
    if(name==='first'){
      await create('retained/partial','x'.repeat(80));
      throw Error('interrupted-write');
    }
    return create(name,text);
  };
  const quota=createPrivateStoreBudget({store,limits:{softBytes:50,hardBytes:100}}),release=await quota.store.acquire('b'.repeat(32));
  try{
    const result=await quota.run(()=>Promise.allSettled([
      quota.store.create('first','x'),
      quota.store.create('second','y'.repeat(15)),
      quota.store.create('third','z'.repeat(6)),
    ]));
    assert.match(result.value[0].reason.message,/interrupted-write/);
    assert.equal(result.value[1].value,'created');
    assert.equal(result.value[2].reason.code,'SYNC_PRIVATE_BUDGET');
    assert.equal(result.status.bytes,95);
    assert.equal(store.files.has('third'),false);
  }finally{await release();}
});
await test('Disable persists intent, releases the session and retains private drafts and effective config',async()=>{
  const f=await fixture();await f.controller.run(async b=>{const d=await b.coordinator.beginSettingsDraft();d.value.settings.language='zh';await b.coordinator.updateSettingsDraft(d.id,d.value);await b.coordinator.saveUi('legend',true);});const before=clone(f.current().session.state().localState),accepted=f.current().session.state().accepted;const r=await f.controller.disable();assert.equal(r.kind,'disabled');assert.equal(f.device.state().connection.enabled,false);assert.equal(f.device.state().transition,null);assert.deepEqual(f.current().session.state().localState,before);assert.deepEqual(f.current().session.state().accepted,accepted);assert.equal(f.current().session.state().closed,true);
});
await test('Enabling the same connection restores private state without publishing or initializing over it',async()=>{
  const f=await fixture();await f.controller.run(b=>b.coordinator.saveUi('legend',true));const fingerprint=f.current().session.state().accepted.fingerprint;await f.controller.disable();await f.controller.enable(vault);const value=await f.current().projection.documentStore.read();assert.equal(value.data.ui.legend,'true');assert.equal(f.current().session.state().accepted.fingerprint,fingerprint);assert.equal((await f.shared.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,0);await f.controller.disable();
});
await test('Switching leaves the target disabled and never opens it automatically',async()=>{
  const f=await fixture();await f.controller.run(b=>b.coordinator.saveUi('legend',true));await f.controller.switchTo(other);assert.deepEqual(f.device.state().connection,{vault:other,enabled:false});assert.equal(f.stores.has(other),false);await f.controller.enable(other);assert.equal((await f.current().projection.documentStore.read()).data.ui.legend,'false');await f.controller.switchTo(vault);await f.controller.enable(vault);assert.equal((await f.current().projection.documentStore.read()).data.ui.legend,'true');await f.controller.disable();
});
await test('Once disable starts, new controller callbacks cannot mutate state',async()=>{
  const f=await fixture();const closing=f.controller.disable();let called=false;const r=await f.controller.run(()=>called=true);assert.equal(r.kind,'held');assert.equal(called,false);await closing;
});
await test('Work accepted before close drains before the session lease is released',async()=>{
  const f=await fixture();let started,finish;const began=new Promise(r=>started=r),gate=new Promise(r=>finish=r);const saved=f.controller.run(async b=>{started();await gate;await b.coordinator.saveUi('legend',true);});await began;const closing=f.controller.disable();finish();await saved;await closing;await f.controller.enable(vault);assert.equal((await f.current().projection.documentStore.read()).data.ui.legend,'true');await f.controller.disable();
});
await test('A stored transition blocks another guarded owner before it opens private storage',async()=>{
  const f=await fixture();await f.device.beginTransition('disable');const base=await openObsidianSyncDevice({app:f.app,pluginId,locks:f.locks}),guard=await createLifecycleDevice({device:base,app:f.app,pluginId,locks:f.locks});await assert.rejects(guard.acquire(vault),/transition-pending/);assert.throws(()=>guard.connect(vault),/transition-pending/);await f.current().coordinator.close();await f.current().projection.close();await f.current().session.close();await f.device.completeTransition(f.device.state().transition.token);
});
await test('A failed transition completion keeps the signed pending intent for restart',async()=>{
  const f=await fixture();f.hook(step=>{if(step==='after-bundle-close')throw Error('simulated-exit');});await assert.rejects(f.controller.disable(),/simulated-exit/);assert.equal(f.device.state().transition.kind,'disable');f.hook(null);const cold=await f.make();assert.equal((await cold.controller.open()).recoveredTransition,true);assert.equal(cold.device.state().connection.enabled,false);assert.equal(cold.device.state().transition,null);
});
await test('Switch transition restart completes to a disabled target without touching source or target journals',async()=>{
  const f=await fixture();const before=[...f.stores.get(vault).files];f.hook(step=>{if(step==='after-bundle-close')throw Error('exit');});await assert.rejects(f.controller.switchTo(other),/exit/);f.hook(null);const cold=await f.make();await cold.controller.open();assert.deepEqual(cold.device.state().connection,{vault:other,enabled:false});assert.deepEqual([...f.stores.get(vault).files],before);assert.equal(f.stores.has(other),false);
});
await test('Corrupt or copied local transition slots cannot confer disable/switch authority',async()=>{
  const f=await fixture();await f.device.beginTransition('disable');const slot=f.app.loadLocalStorage(pluginId+':sync-v2:lifecycle');slot.sealed=slot.sealed.slice(0,-1)+'x';f.app.saveLocalStorage(pluginId+':sync-v2:lifecycle',slot);const base=await openObsidianSyncDevice({app:f.app,pluginId,locks:f.locks});await assert.rejects(createLifecycleDevice({device:base,app:f.app,pluginId,locks:f.locks}),/authentication/);await f.current().coordinator.close();await f.current().projection.close();await f.current().session.close();
});
await test('Compatibility output contains only effective settings and accepted layout while drafts remain pending',async()=>{
  const f=await fixture();await f.controller.run(async b=>{const d=await b.coordinator.beginSettingsDraft();d.value.settings.language='zh';await b.coordinator.updateSettingsDraft(d.id,d.value);await b.coordinator.stageLayoutDraft(empty);});const output=await f.controller.compatibilityData();assert.equal(output.settings.language,'auto');assert.deepEqual(output.layoutOverrides,empty);assert.equal(f.current().coordinator.state().settingsDraft.value.settings.language,'zh');assert.ok(f.current().coordinator.state().layoutDraft);await f.controller.disable();
});
await test('Recovery export writes verified parts and a last completion manifest without changing the private journal',async()=>{
  const f=await fixture(),destination=testMemoryStore();await f.controller.run(async b=>{const d=await b.coordinator.beginSettingsDraft();d.value.settings.language='zh';await b.coordinator.updateSettingsDraft(d.id,d.value);});const sequence=f.current().session.state().sequence,id='1'.repeat(32);const r=await f.controller.exportRecovery({destination,id});assert.equal(r.scope,'review-only-not-acceptance-ledger');assert.ok(destination.files.has(id+'/manifest.json'));const draft=JSON.parse(destination.files.get(id+'/drafts.json'));assert.equal(draft.settingsDraft.value.settings.language,'zh');assert.equal(f.current().session.state().sequence,sequence);assert.equal(f.controller.state().status,'ready');await f.controller.disable();
});
await test('A partial export cannot publish its completion manifest and never deletes prior parts',async()=>{
  const f=await fixture(),destination=testMemoryStore(),create=destination.create;let n=0;destination.create=async(...args)=>{if(++n===3)throw Error('export-disk-full');return create(...args);};const id='2'.repeat(32);await assert.rejects(f.controller.exportRecovery({destination,id}),/export-disk-full/);assert.equal(destination.files.has(id+'/manifest.json'),false);assert.equal(destination.files.size,2);destination.create=create;assert.equal((await f.controller.exportRecovery({destination,id})).kind,'exported');await f.controller.disable();
});
await test('Conflicting export destinations are never overwritten or treated as complete',async()=>{
  const f=await fixture(),destination=testMemoryStore(),id='3'.repeat(32);destination.files.set(id+'/accepted.json','different');await assert.rejects(f.controller.exportRecovery({destination,id}));assert.equal(destination.files.get(id+'/accepted.json'),'different');assert.equal(destination.files.has(id+'/manifest.json'),false);await f.controller.disable();
});
await test('Paused quota still allows read-only compatibility/recovery output and local disable',async()=>{
  const f=await fixture();const b=f.current(),now=await b.quota.inspect();b.backend.files.set('orphan/filler','x'.repeat(PRIVATE_STORE_BUDGET.softBytes-now.bytes));const r=await f.controller.run(()=>assert.fail('new writes must pause'));assert.equal(r.kind,'held');assert.equal(f.controller.state().status,'paused');const destination=testMemoryStore();assert.equal((await f.controller.exportRecovery({destination,id:'4'.repeat(32)})).kind,'exported');assert.equal((await f.controller.compatibilityData()).settings.language,'auto');assert.equal((await f.controller.disable()).kind,'disabled');
});
await test('Recovery export budgets are checked before any destination part is written',async()=>{
  const destination=testMemoryStore();await assert.rejects(exportRecoveryParts({destination,id:'5'.repeat(32),vault,installation:'b'.repeat(32),session:{accepted:{snapshot:empty,operations:[]},localState:{large:'data'},pending:null},configuration:null,initial:null,joinBackup:null,maxBytes:1}),/export-budget/);assert.equal(destination.files.size,0);
});
await test('A completed transition replay cannot disable a later re-enabled connection',async()=>{
  const f=await fixture();await f.device.beginTransition('disable');const slot=f.app.loadLocalStorage(pluginId+':sync-v2:lifecycle');await f.current().coordinator.close();await f.current().projection.close();await f.current().session.close();await f.device.completeTransition(f.device.state().transition.token);await f.device.connect(vault);f.app.saveLocalStorage(pluginId+':sync-v2:lifecycle',slot);
  const base=await openObsidianSyncDevice({app:f.app,pluginId,locks:f.locks}),guard=await createLifecycleDevice({device:base,app:f.app,pluginId,locks:f.locks});await assert.rejects(guard.completeTransition(guard.state().transition.token),/transition-source/);assert.equal(base.state().connection.enabled,true);
});
await test('Restart after the target is already disabled does not generate extra enable/disable generations',async()=>{
  const f=await fixture();await f.device.beginTransition('switch',other);await f.current().coordinator.close();await f.current().projection.close();await f.current().session.close();await f.base.disable();await f.base.connect(other);await f.base.disable();const generation=f.base.state().generation;
  const base=await openObsidianSyncDevice({app:f.app,pluginId,locks:f.locks}),guard=await createLifecycleDevice({device:base,app:f.app,pluginId,locks:f.locks});await guard.completeTransition(guard.state().transition.token);assert.equal(guard.state().generation,generation);assert.equal(guard.state().connection.enabled,false);
});
await test('An uncertain local intent write releases the source lease and recovers from the stored signed slot',async()=>{
  const f=await fixture(),save=f.app.saveLocalStorage.bind(f.app);f.app.saveLocalStorage=(key,value)=>{save(key,value);if(key===pluginId+':sync-v2:lifecycle'&&value!==null)throw Error('after-local-write');};await assert.rejects(f.controller.disable(),/after-local-write/);assert.equal(f.current().session.state().closed,true);const cold=await f.make();await cold.controller.open();assert.equal(cold.device.state().connection.enabled,false);assert.equal(cold.device.state().transition,null);
});
await test('Failed local intent persistence never claims disable success and leaves a reopenable private journal',async()=>{
  const f=await fixture();await f.controller.run(b=>b.coordinator.saveUi('legend',true));f.app.onSave(key=>{if(key===pluginId+':sync-v2:lifecycle')throw Error('local-quota');});await assert.rejects(f.controller.disable(),/local-quota/);assert.equal(f.current().session.state().closed,true);assert.equal(f.base.state().connection.enabled,true);f.app.onSave(null);await f.controller.enable(vault);assert.equal((await f.current().projection.documentStore.read()).data.ui.legend,'true');await f.controller.disable();
});
await test('A second guarded handle cannot complete a pending close while its original owner is active',async()=>{
  const f=await fixture();await f.device.beginTransition('disable');const base=await openObsidianSyncDevice({app:f.app,pluginId,locks:f.locks}),guard=await createLifecycleDevice({device:base,app:f.app,pluginId,locks:f.locks});await assert.rejects(guard.completeTransition(guard.state().transition.token),/busy/);assert.ok(guard.state().transition);await f.current().coordinator.close();await f.current().projection.close();await f.current().session.close();await f.device.completeTransition(f.device.state().transition.token);
});
await test('A new namespace stays join-required until an explicit validated join callback completes',async()=>{
  const f=await fixture({noInitialize:true});assert.equal(f.controller.state().status,'join-required');assert.equal((await f.controller.run(()=>assert.fail())).kind,'held');await f.controller.join(async b=>{await b.session.join({localData:source()});await b.projection.initialize({sourceData:source()});await b.coordinator.open();});assert.equal(f.controller.state().status,'ready');assert.equal((await f.shared.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,0);await f.controller.disable();
});
await test('A failure after acquiring the private session cannot leak its lease or leave a half-open bundle',async()=>{
  let fail=false;const f=await fixture({failOpen:()=>fail});await f.controller.disable();fail=true;await assert.rejects(f.controller.enable(vault),/after-session-open/);assert.equal(f.current().session.state().closed,true);fail=false;await f.controller.enable(vault);assert.equal(f.controller.state().status,'ready');await f.controller.disable();
});
await test('Mutating a direct export source during async copying cannot produce a false completion manifest',async()=>{
  const destination=testMemoryStore(),create=destination.create,snapshot={...empty},session={accepted:{snapshot,operations:[]},localState:{value:'old'},pending:null};let once=false;const id='6'.repeat(32);
  destination.create=async(...args)=>{if(!once){once=true;session.localState.value='changed';}return create(...args);};await assert.rejects(exportRecoveryParts({destination,id,vault,installation:'b'.repeat(32),session,configuration:null,initial:null,joinBackup:null}),/export-source-changed/);assert.equal(destination.files.has(id+'/manifest.json'),false);
});
await test('Disable requested during an export persists immediately and finishes after the export drains',async()=>{
  const f=await fixture(),destination=testMemoryStore(),create=destination.create;let start,finish,once=false;const began=new Promise(r=>start=r),gate=new Promise(r=>finish=r);destination.create=async(...args)=>{if(!once){once=true;start();await gate;}return create(...args);};const exporting=f.controller.exportRecovery({destination,id:'7'.repeat(32)});await began;const closing=f.controller.disable();finish();assert.equal((await exporting).kind,'exported');assert.equal((await closing).kind,'disabled');assert.equal(f.controller.state().status,'disabled');
});
await test('Closed coordinator refuses new drafts and UI mutations after draining',async()=>{
  const f=await fixture();await f.current().coordinator.close();await assert.rejects(f.current().coordinator.saveUi('legend',true),/closing/);assert.throws(()=>f.current().coordinator.beginSettingsDraft(),/closing/);await f.controller.disable();
});
const result={date:'2026-11-08 Asia/Shanghai',passed:checks.length,checks,scope:'Lifecycle/quota/review-only export with real core/coordinator/private log over memory stores; no new native/iPad, cloud, power loss or automatic archive import claim.'};fs.mkdirSync('.local/sync-016/a3/lifecycle',{recursive:true});fs.writeFileSync('.local/sync-016/a3/lifecycle/lifecycle-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:checks.length}));
