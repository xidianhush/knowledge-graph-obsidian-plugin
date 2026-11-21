import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel} from '../dist/graph-core.mjs';
import {createDurableSyncSession} from '../src/sync/persistence-prototype.mjs';
import {createPrivateConfigProjection} from '../src/sync/private-config-prototype.mjs';
import {createSettingsCoordinator} from '../src/sync/settings-coordinator-prototype.mjs';
import {testMemoryStore,testLocalApp,testLockManager} from './sync-host-test-helpers.mjs';
import {openObsidianSyncDevice,createDeviceBoundPrivateStore} from '../src/sync/obsidian-host-prototype.mjs';
import {validateTestSettings as validate} from './sync-settings-test-helpers.mjs';
const clone=x=>structuredClone(x),vault='a'.repeat(32),installation='b'.repeat(32),empty={schemaVersion:3,revision:0,groups:{},structures:{}};
const model=()=>{const g=buildGraph({files:[{path:'Synthetic/A.md',text:'# First\nbody'}],config:{include:['**']}});return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
const raw=()=>({settings:{language:'auto',debounceMs:350,autoUpdate:true},pipeline:{config:{include:['**']}},ui:{legend:'false',other:'kept'},unknown:{keep:42},layoutOverrides:{schemaVersion:99,untouched:'old backup only'},sync:{untrusted:'copied marker'}});
async function fixture({initialize=true,signed=false}={}){
  const backing=testMemoryStore(),shared=testMemoryStore(),app=testLocalApp(),locks=testLockManager();let device=null,epoch=0,hook=null,sessionHook=null;
  if(signed){device=await openObsidianSyncDevice({app,pluginId:'private-config-test',locks});await device.connect(vault);}
  const make=async()=>{
    if(signed)device=await openObsidianSyncDevice({app,pluginId:'private-config-test',locks});
    const s=createDurableSyncSession({privateStore:signed?createDeviceBoundPrivateStore({store:backing,device,vault}):backing,sharedStore:shared,vault,installation:signed?device.state().installation:installation,createModel:model,checkpoint:step=>sessionHook?.(step)});await s.open();
    if(!s.state().initialized)await s.initialize({source:'explicit-empty',localBaseline:empty});
    const p=createPrivateConfigProjection({session:s,validateSettings:validate,getExternalEpoch:()=>epoch,checkpoint:step=>hook?.(step)});return {s,p};
  };
  const current=await make();if(initialize)await current.p.initialize({sourceData:raw()});
  const c=()=>createSettingsCoordinator({session:current.s,documentStore:current.p.documentStore,validateSettings:validate,nextId:()=> '1'.repeat(32)});
  return {...current,backing,shared,app,locks,device,make,c,hook:fn=>hook=fn,sessionHook:fn=>sessionHook=fn,bump:()=>++epoch};
}
const checks=[];async function test(name,fn){await fn();checks.push(name);}
async function setting(c,fn){const d=await c.beginSettingsDraft();fn(d.value);await c.updateSettingsDraft(d.id,d.value);return d;}
async function write(f,fn){const r=await f.p.documentStore.read();fn(r.data);return f.p.documentStore.compareAndSet(r.version,r.data);}
await test('Initialization is explicit and retains the full original JSON without trusting its layout or sync markers',async()=>{
  const f=await fixture({initialize:false});assert.equal((await f.p.open()).kind,'initialization-required');await assert.rejects(f.p.documentStore.read(),/initialization-required/);const source=raw();await f.p.initialize({sourceData:source});source.unknown.keep=0;assert.deepEqual(await f.p.getInitialBackup(),raw());const d=await f.p.documentStore.read();assert.deepEqual(d.data.layoutOverrides,empty);assert.equal(d.data.unknown.keep,42);assert.equal(d.data.sync.untrusted,'copied marker');assert.equal((await f.shared.list('Knowledge Map Sync/v2/'+vault+'/ops')).length,0);await f.s.close();
});
await test('A second initialization or a late copied config cannot replace the private effective document or original backup',async()=>{
  const f=await fixture();await write(f,d=>d.settings.language='zh');const source=raw();source.settings.language='en';assert.equal((await f.p.initialize({sourceData:source})).kind,'already-initialized');assert.equal((await f.p.documentStore.read()).data.settings.language,'zh');assert.equal((await f.p.getInitialBackup()).settings.language,'auto');await f.s.close();
});
await test('Private effective settings and UI cold-load from the same acceptance journal',async()=>{
  const f=await fixture(),c=f.c();await c.open();await c.saveUi('legend',true);const d=await setting(c,v=>v.settings.language='zh');await c.saveSettingsDraft(d.id);const fingerprint=f.s.state().accepted.fingerprint;await f.s.close();const cold=await f.make();assert.equal((await cold.p.open()).kind,'opened');const value=(await cold.p.documentStore.read()).data;assert.equal(value.ui.legend,'true');assert.equal(value.settings.language,'zh');assert.equal(value.unknown.keep,42);assert.equal(cold.s.state().accepted.fingerprint,fingerprint);assert.equal(cold.s.state().localState.settingsDraft,null);await cold.s.close();
});
await test('Local UI and settings saves succeed without any host data.json write API or external-writer exclusion',async()=>{
  const f=await fixture(),c=f.c();await c.open();await c.saveUi('legend',true);const d=await setting(c,v=>v.settings.debounceMs=600);assert.equal((await c.saveSettingsDraft(d.id)).kind,'saved');assert.equal((await f.p.documentStore.read()).data.settings.debounceMs,600);assert.equal(f.s.state().localState.pendingSave,null);await f.s.close();
});
await test('Observing external settings is durable input and never applies them automatically',async()=>{
  const f=await fixture(),source=raw();source.settings.language='en';const result=await f.p.observeExternal(source);assert.equal(result.kind,'review-required');assert.equal((await f.p.documentStore.read()).data.settings.language,'auto');await f.s.close();const cold=await f.make();assert.equal((await cold.p.open()).pendingExternal,result.id);assert.equal((await cold.p.reviewExternal(result.id)).external.settings.language,'en');await cold.s.close();
});
await test('An unrelated external field merges with saved local settings only after explicit merge choice',async()=>{
  const f=await fixture();await write(f,d=>d.settings.language='zh');const source=raw();source.settings.debounceMs=600;const {id}=await f.p.observeExternal(source);assert.equal((await f.p.reviewExternal(id)).kind,'candidate');assert.equal((await f.p.resolveExternal(id,{choice:'merge'})).kind,'applied');const d=(await f.p.documentStore.read()).data;assert.equal(d.settings.language,'zh');assert.equal(d.settings.debounceMs,600);await f.s.close();
});
await test('Same-field conflicts retain local effective config, external input and an unsaved settings draft',async()=>{
  const f=await fixture(),c=f.c();await c.open();await write(f,d=>d.settings.debounceMs=500);const draft=await setting(c,v=>v.settings.language='zh'),source=raw();source.settings.debounceMs=700;const {id}=await f.p.observeExternal(source),r=await f.p.resolveExternal(id,{choice:'merge'});assert.equal(r.kind,'review-required');assert.deepEqual(r.conflicts,[['settings','debounceMs']]);assert.equal((await f.p.documentStore.read()).data.settings.debounceMs,500);assert.equal(c.state().settingsDraft.value.settings.language,'zh');assert.equal((await f.p.reviewExternal(id)).external.settings.debounceMs,700);await f.s.close();
});
await test('Explicit keep-local acknowledges the external baseline without deleting it or changing local values',async()=>{
  const f=await fixture();await write(f,d=>d.settings.language='zh');const source=raw();source.settings.language='en';const {id}=await f.p.observeExternal(source);assert.equal((await f.p.resolveExternal(id,{choice:'keep-local'})).effectiveChanged,false);assert.equal((await f.p.documentStore.read()).data.settings.language,'zh');assert.equal((await f.p.observeExternal(source)).kind,'noop');assert.equal((await f.p.reviewExternal(id)).kind,'noop');assert.ok((await f.p.history()).entries.length>=3);await f.s.close();
});
await test('Explicit use-external changes only validated settings and pipeline, retaining local UI and unknown fields',async()=>{
  const f=await fixture();await write(f,d=>d.settings.language='zh');const source=raw();source.settings.language='en';source.ui.legend='remote';source.unknown.keep=99;source.layoutOverrides={untrusted:true};source.sync={installation:'forged'};const {id}=await f.p.observeExternal(source);await f.p.resolveExternal(id,{choice:'use-external'});const data=(await f.p.documentStore.read()).data;assert.equal(data.settings.language,'en');assert.equal(data.ui.legend,'false');assert.equal(data.unknown.keep,42);assert.equal(data.sync.untrusted,'copied marker');assert.deepEqual(data.layoutOverrides,empty);await f.s.close();
});
await test('An unsaved draft survives external adoption and merges its unrelated edits on save',async()=>{
  const f=await fixture(),c=f.c();await c.open();const d=await setting(c,v=>v.settings.language='zh'),source=raw();source.settings.debounceMs=600;const {id}=await f.p.observeExternal(source);await f.p.resolveExternal(id,{choice:'merge'});assert.equal(c.state().settingsDraft.value.settings.language,'zh');assert.equal((await c.saveSettingsDraft(d.id)).kind,'saved');const value=(await f.p.documentStore.read()).data;assert.equal(value.settings.language,'zh');assert.equal(value.settings.debounceMs,600);await f.s.close();
});
await test('A draft conflicting with newly adopted config stays reviewable after cold coordinator reopen',async()=>{
  const f=await fixture(),c=f.c();await c.open();const d=await setting(c,v=>v.settings.language='zh'),source=raw();source.settings.language='en';const {id}=await f.p.observeExternal(source);await f.p.resolveExternal(id,{choice:'use-external'});assert.equal((await c.saveSettingsDraft(d.id)).kind,'review-required');await f.s.close();const cold=await f.make(),coordinator=createSettingsCoordinator({session:cold.s,documentStore:cold.p.documentStore,validateSettings:validate});await coordinator.open();assert.equal(coordinator.state().settingsDraft.value.settings.language,'zh');assert.equal((await coordinator.resume()).kind,'review-required');await cold.s.close();
});
await test('Invalid external settings remain backed up and do not block independent local UI saves',async()=>{
  const f=await fixture(),source=raw();source.settings.debounceMs=0;const result=await f.p.observeExternal(source);assert.equal(result.kind,'invalid-external');assert.equal((await f.p.resolveExternal(result.id,{choice:'use-external'})).kind,'invalid-external');const c=f.c();await c.open();assert.equal((await c.saveUi('legend',true)).kind,'saved');assert.equal((await f.p.documentStore.read()).data.settings.debounceMs,350);const entry=(await f.p.history()).entries[0];assert.equal((await f.p.readHistory(entry.version)).external.source.settings.debounceMs,0);await f.s.close();
});
await test('External UI/layout-only changes are archived without replacing local state or asking to adopt settings',async()=>{
  const f=await fixture(),source=raw();source.ui.legend='remote';source.layoutOverrides={schemaVersion:999};source.futureUnknown=7;const result=await f.p.observeExternal(source);assert.equal(result.kind,'ignored-nonsettings');const value=(await f.p.documentStore.read()).data;assert.equal(value.ui.legend,'false');assert.deepEqual(value.layoutOverrides,empty);assert.equal(value.futureUnknown,undefined);const entry=(await f.p.history()).entries[0];assert.equal((await f.p.readHistory(entry.version)).external.source.futureUnknown,7);await f.s.close();
});
await test('Duplicate input in different JSON key order does not consume another journal event',async()=>{
  const f=await fixture(),source=raw();source.settings.language='en';const r=await f.p.observeExternal(source),sequence=f.s.state().sequence;const reordered=Object.fromEntries(Object.entries(source).reverse());assert.equal((await f.p.observeExternal(reordered)).id,r.id);assert.equal(f.s.state().sequence,sequence);await f.s.close();
});
await test('Superseded external snapshots remain retrievable by verified journal version',async()=>{
  const f=await fixture(),a=raw(),b=raw();a.settings.language='zh';b.settings.language='en';const first=await f.p.observeExternal(a),version=f.s.getLocalDocument().version;const second=await f.p.observeExternal(b);await assert.rejects(f.p.reviewExternal(first.id),/external-superseded/);assert.equal((await f.p.readHistory(version)).external.source.settings.language,'zh');await f.p.resolveExternal(second.id,{choice:'merge'});assert.equal((await f.p.readHistory(version)).external.reviewed,false);await f.s.close();
});
await test('Persisted external choices require a fresh source observation after process-local state is recreated',async()=>{
  const f=await fixture(),source=raw();source.settings.language='en';const {id}=await f.p.observeExternal(source);await f.s.close();const cold=await f.make();assert.equal((await cold.p.resolveExternal(id,{choice:'merge'})).reason,'read-external-again');await cold.p.observeExternal(source);assert.equal((await cold.p.resolveExternal(id,{choice:'merge'})).kind,'applied');await cold.s.close();
});
await test('External epoch invalidation before observation or adoption retains the prior document',async()=>{
  const f=await fixture(),source=raw();source.settings.language='en';f.bump();assert.equal((await f.p.observeExternal(source,{epoch:0})).reason,'external-changed');const {id}=await f.p.observeExternal(source);f.bump();assert.equal((await f.p.resolveExternal(id,{choice:'merge'})).reason,'external-changed');assert.equal((await f.p.documentStore.read()).data.settings.language,'auto');await f.s.close();
});
await test('An external epoch change immediately before commit does not adopt the stale observation',async()=>{
  const f=await fixture(),source=raw();source.settings.language='en';const {id}=await f.p.observeExternal(source);f.hook(step=>{if(step==='before-external-config-commit')f.bump();});assert.equal((await f.p.resolveExternal(id,{choice:'merge'})).reason,'external-changed');assert.equal((await f.p.documentStore.read()).data.settings.language,'auto');await f.s.close();
});
await test('An epoch change in the completed commit window reports deferred application, not a fictitious rollback',async()=>{
  const f=await fixture(),source=raw();source.settings.language='en';const {id}=await f.p.observeExternal(source);f.hook(step=>{if(step==='after-external-config-commit')f.bump();});assert.equal((await f.p.resolveExternal(id,{choice:'merge'})).kind,'applied-deferred');assert.equal((await f.p.documentStore.read()).data.settings.language,'en');await f.s.close();
});
await test('Stale private config tokens cannot replace newer external inputs or saved local values',async()=>{
  const f=await fixture(),stale=await f.p.documentStore.read();await write(f,d=>d.settings.language='zh');stale.data.settings.language='en';assert.equal((await f.p.documentStore.compareAndSet(stale.version,stale.data)).ok,false);assert.equal((await f.p.documentStore.read()).data.settings.language,'zh');await f.s.close();
});
await test('Concurrent private writes from the same token have one winner',async()=>{
  const f=await fixture(),a=await f.p.documentStore.read(),b=clone(a);a.data.settings.language='zh';b.data.settings.language='en';const r=await Promise.all([f.p.documentStore.compareAndSet(a.version,a.data),f.p.documentStore.compareAndSet(b.version,b.data)]);assert.equal(r.filter(v=>v.ok).length,1);assert.equal((await f.p.documentStore.read()).data.settings.language,'zh');await f.s.close();
});
await test('Reverting to an earlier value cannot revive its old CAS token',async()=>{
  const f=await fixture(),a=await f.p.documentStore.read();await write(f,d=>d.settings.language='zh');await write(f,d=>d.settings.language='auto');assert.equal((await f.p.documentStore.compareAndSet(a.version,a.data)).ok,false);await f.s.close();
});
await test('Unaccepted or missing layout caches cannot enter private config writes',async()=>{
  const f=await fixture(),r=await f.p.documentStore.read();r.data.layoutOverrides={schemaVersion:99};await assert.rejects(f.p.documentStore.compareAndSet(r.version,r.data),/unaccepted-layout/);delete r.data.layoutOverrides;await assert.rejects(f.p.documentStore.compareAndSet(r.version,r.data),/unaccepted-layout/);assert.deepEqual((await f.p.documentStore.read()).data.layoutOverrides,empty);await f.s.close();
});
await test('Array fields stay whole conflicting fields rather than index-wise merges',async()=>{
  const f=await fixture();await write(f,d=>d.pipeline.config.include=['Local/**']);const source=raw();source.pipeline.config.include=['External/**'];const {id}=await f.p.observeExternal(source),r=await f.p.resolveExternal(id,{choice:'merge'});assert.equal(r.kind,'review-required');assert.deepEqual(r.conflicts,[['pipeline','config','include']]);await f.s.close();
});
await test('Deleting nested unknown owned keys preserves other local additions',async()=>{
  const f=await fixture({initialize:false}),source=raw();source.pipeline.extra={remove:1,keep:2};await f.p.initialize({sourceData:source});await write(f,d=>d.pipeline.extra.local=3);const external=clone(source);delete external.pipeline.extra.remove;const {id}=await f.p.observeExternal(external);await f.p.resolveExternal(id,{choice:'merge'});assert.deepEqual((await f.p.documentStore.read()).data.pipeline.extra,{keep:2,local:3});await f.s.close();
});
await test('Captured caller objects and returned backup/history copies cannot change durable config',async()=>{
  const f=await fixture(),source=raw();source.settings.language='en';const pending=f.p.observeExternal(source);source.settings.language='zh';const {id}=await pending;const review=await f.p.reviewExternal(id);review.external.settings.language='zh';const backup=await f.p.getInitialBackup();backup.unknown.keep=0;assert.equal((await f.p.reviewExternal(id)).external.settings.language,'en');assert.equal((await f.p.getInitialBackup()).unknown.keep,42);await f.s.close();
});
await test('Private local document CAS and coordinator draft records cannot clobber each other',async()=>{
  const f=await fixture(),c=f.c();await c.open();const draft=await setting(c,v=>v.settings.language='zh'),source=raw();source.settings.debounceMs=600;const observed=f.p.observeExternal(source);await c.saveUi('legend',true);const {id}=await observed;await f.p.resolveExternal(id,{choice:'merge'});await c.saveSettingsDraft(draft.id);const doc=(await f.p.documentStore.read()).data;assert.equal(doc.ui.legend,'true');assert.equal(doc.settings.language,'zh');assert.equal(doc.settings.debounceMs,600);assert.equal(f.s.state().localState.settingsDraft,null);await f.s.close();
});
await test('A document save failure retains the original effective value and a recoverable coordinator intent',async()=>{
  const f=await fixture(),c=f.c();await c.open();const d=await setting(c,v=>v.settings.language='zh');f.sessionHook(step=>{if(step==='before-local-document')throw Error('private-disk-full');});await assert.rejects(c.saveSettingsDraft(d.id),/private-disk-full/);assert.ok(f.s.state().localState.pendingSave);await f.s.close();f.sessionHook(null);const cold=await f.make(),cc=createSettingsCoordinator({session:cold.s,documentStore:cold.p.documentStore,validateSettings:validate});await cc.open();assert.equal((await cc.resume()).kind,'saved');assert.equal((await cold.p.documentStore.read()).data.settings.language,'zh');await cold.s.close();
});
await test('A committed private config followed by failure before draft clear resumes idempotently',async()=>{
  const f=await fixture(),c=f.c();await c.open();const d=await setting(c,v=>v.settings.language='zh');f.hook(step=>{if(step==='after-private-config-save')throw Error('after-save');});await assert.rejects(c.saveSettingsDraft(d.id),/after-save/);assert.equal((await f.p.documentStore.read()).data.settings.language,'zh');const version=f.s.getLocalDocument().version;await f.s.close();f.hook(null);const cold=await f.make(),cc=createSettingsCoordinator({session:cold.s,documentStore:cold.p.documentStore,validateSettings:validate});await cc.open();await cc.resume();assert.equal(cold.s.getLocalDocument().version,version);assert.equal(cc.state().settingsDraft,null);await cold.s.close();
});
await test('Unknown private document versions fail closed rather than bootstrapping again',async()=>{
  const f=await fixture();const before=f.s.getLocalDocument();await f.s.compareAndSetLocalDocument(before.version,{version:99});await assert.rejects(f.p.open(),/stored-document/);await assert.rejects(f.p.initialize({sourceData:raw()}),/stored-document/);assert.deepEqual(f.s.getLocalDocument().data,{version:99});await f.s.close();
});
await test('Malformed cached external projections cannot be used as verified input',async()=>{
  const f=await fixture(),source=raw();source.settings.language='en';await f.p.observeExternal(source);const saved=f.s.getLocalDocument();saved.data.external.owned.settings.language='zh';await f.s.compareAndSetLocalDocument(saved.version,saved.data);await assert.rejects(f.p.open(),/stored-external-projection/);await f.s.close();
});
await test('Private document backup and revision blobs are verified on cold replay',async()=>{
  const f=await fixture(),doc=f.s.getLocalDocument();await f.s.close();f.backing.files.set('blobs/'+doc.backup+'.json','{}');await assert.rejects(f.make(),/blob-changed/);
});
await test('Authenticated local document commits are covered by the device journal high-water anchor',async()=>{
  const f=await fixture({signed:true});await write(f,d=>d.settings.language='zh');const last=f.s.state().sequence;await f.s.close();f.backing.files.delete('events/'+String(last).padStart(12,'0')+'.json');await assert.rejects(f.make(),/private-rollback/);
});
await test('History pagination is bounded and unknown versions cannot read arbitrary blobs',async()=>{
  const f=await fixture();await write(f,d=>d.settings.language='zh');await write(f,d=>d.settings.language='en');const page=await f.p.history({limit:1});assert.equal(page.entries.length,1);assert.ok(page.next);assert.notEqual((await f.p.history({before:page.next,limit:1})).entries[0].version,page.entries[0].version);assert.throws(()=>f.p.history({limit:21}),/history-limit/);await assert.rejects(f.p.readHistory('0'.repeat(64)),/local-document-version/);assert.equal((await f.p.documentStore.read()).data.settings.language,'en');assert.equal(f.s.state().faulted,false);await f.s.close();
});
await test('Nonobject, oversized and invalid local inputs cannot replace the last valid config',async()=>{
  const f=await fixture(),before=f.s.getLocalDocument().version;assert.throws(()=>f.p.observeExternal(null),/source-shape/);assert.throws(()=>f.p.observeExternal({large:'x'.repeat(16385)}),/string-budget/);const r=await f.p.documentStore.read();r.data.settings.language='bad';assert.throws(()=>f.p.documentStore.compareAndSet(r.version,r.data));assert.equal(f.s.getLocalDocument().version,before);await f.s.close();
});
await test('Future settings schema input remains archived and cannot be silently normalized to an older version',async()=>{
  const f=await fixture(),source=raw();source.settingsVersion=99;assert.equal((await f.p.observeExternal(source)).kind,'invalid-external');const state=f.s.getLocalDocument();assert.equal(state.data.external.source.settingsVersion,99);assert.equal((await f.p.documentStore.read()).data.settingsVersion,1);await f.s.close();
});
await test('Layout editing drafts stay separate while external settings are adopted',async()=>{
  const f=await fixture(),c=f.c();await c.open();await c.stageLayoutDraft(empty);const before=c.state().layoutDraft,source=raw();source.settings.language='zh';const {id}=await f.p.observeExternal(source);await f.p.resolveExternal(id,{choice:'merge'});assert.deepEqual(c.state().layoutDraft,before);assert.equal((await c.acceptExternal()).reason,'local-layout-draft');await f.s.close();
});
await test('Acceptance changes invalidate document tokens even if private config itself did not change',async()=>{
  const f=await fixture();let accepted=f.s.state().accepted;const wrapped={...f.s,state:()=>({...f.s.state(),accepted})},p=createPrivateConfigProjection({session:wrapped,validateSettings:validate,getExternalEpoch:()=>0});const before=await p.documentStore.read();accepted={...accepted,snapshot:{...empty,revision:1},fingerprint:'f'.repeat(64)};assert.equal((await p.documentStore.compareAndSet(before.version,before.data)).ok,false);assert.equal((await p.documentStore.read()).data.layoutOverrides.revision,1);await f.s.close();
});
await test('An acceptance change after config commit delays cache confirmation without deleting saved local settings',async()=>{
  const f=await fixture();let accepted=f.s.state().accepted;const wrapped={...f.s,state:()=>({...f.s.state(),accepted})},p=createPrivateConfigProjection({session:wrapped,validateSettings:validate,getExternalEpoch:()=>0,checkpoint:step=>{if(step==='after-private-config-save')accepted={...accepted,fingerprint:'f'.repeat(64)};}}),r=await p.documentStore.read();r.data.settings.language='zh';assert.equal((await p.documentStore.compareAndSet(r.version,r.data)).ok,false);assert.equal((await p.documentStore.read()).data.settings.language,'zh');await f.s.close();
});
await test('A damaged newly supplied host config cannot block reopening an already initialized private document',async()=>{
  const f=await fixture(),source=raw();source.settingsVersion=99;source.settings.language='bad';assert.equal((await f.p.initialize({sourceData:source})).kind,'already-initialized');assert.equal((await f.p.documentStore.read()).data.settings.language,'auto');await f.s.close();
});
await test('An empty validation diagnostic remains an invalid input rather than a false success',async()=>{
  const f=await fixture(),p=createPrivateConfigProjection({session:f.s,getExternalEpoch:()=>0,validateSettings:value=>{if(value.settings?.language==='bad')throw Error('');return validate(value);}}),source=raw();source.settings.language='bad';const r=await p.observeExternal(source);assert.equal(r.kind,'invalid-external');assert.equal((await p.reviewExternal(r.id)).kind,'invalid-external');assert.equal((await p.resolveExternal(r.id,{choice:'merge'})).kind,'invalid-external');assert.equal((await p.documentStore.read()).data.settings.language,'auto');await f.s.close();
});
await test('Newer notifications replace only the pending external pointer and retain both original sources in history',async()=>{
  const f=await fixture(),one=raw(),two=raw();one.settings.language='zh';two.settings.language='en';const r1=await f.p.observeExternal(one),v1=f.s.getLocalDocument().version;const r2=await f.p.observeExternal(two);const history=await f.p.history();assert.equal(history.entries[0].externalId,r2.id);assert.equal((await f.p.readHistory(v1)).external.id,r1.id);assert.equal((await f.p.documentStore.read()).data.settings.language,'auto');await f.s.close();
});
await test('A real external epoch source must be explicitly supplied rather than silently defaulting to a fake stable epoch',async()=>{
  const f=await fixture();assert.throws(()=>createPrivateConfigProjection({session:f.s,validateSettings:validate}),/options/);await f.s.close();
});
await test('Closing the projection rejects new saves while preserving its already queued work',async()=>{
  const f=await fixture(),source=raw();source.settings.language='en';const pending=f.p.observeExternal(source),closed=f.p.close();assert.throws(()=>f.p.documentStore.read(),/closed/);await pending;await closed;assert.ok(f.s.getLocalDocument().data.external);await f.s.close();
});
const result={date:'2026-11-08 Asia/Shanghai',passed:checks.length,checks,scope:'Real durable-session/coordinator logic over isolated memory stores, plus one device-authentication rollback case; no production/host/OS or service integration claim.'};fs.mkdirSync('.local/sync-016/a3/config',{recursive:true});fs.writeFileSync('.local/sync-016/a3/config/config-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:checks.length}));
