import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openObsidianSyncDevice,createDeviceBoundPrivateStore,createObsidianSettingsDocument} from '../src/sync/obsidian-host-prototype.mjs';
import {createDurableSyncSession} from '../src/sync/persistence-prototype.mjs';
import {createSettingsCoordinator} from '../src/sync/settings-coordinator-prototype.mjs';
import {validateTestSettings as validate} from './sync-settings-test-helpers.mjs';
import {testLockManager,testLocalApp,testMemoryStore,testSettingsPlugin} from './sync-host-test-helpers.mjs';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel} from '../dist/graph-core.mjs';
const pluginId='knowledge-graph-smoke',key=pluginId+':sync-v2:device',vault='a'.repeat(32),other='c'.repeat(32),checks=[];
const empty={schemaVersion:3,revision:0,groups:{},structures:{}},clone=x=>structuredClone(x);
async function test(name,fn){await fn();checks.push(name);}
async function device(options={}){const app=options.app||testLocalApp(),locks=options.locks||testLockManager();return {app,locks,device:await openObsidianSyncDevice({app,locks,pluginId,...options})};}
async function privateFixture(){const f=await device();await f.device.connect(vault);const store=testMemoryStore(),bound=createDeviceBoundPrivateStore({store,device:f.device,vault}),release=await bound.acquire(f.device.state().installation);return {...f,store,bound,release};}
const host=(data={},configurationIsLocal=true)=>{const f=testSettingsPlugin(validate({layoutOverrides:empty,...data}));return {...f,document:createObsidianSettingsDocument({plugin:f.plugin,configurationIsLocal})};};
const model=()=>{const g=buildGraph({files:[{path:'Synthetic/A.md',text:'# First\nbody'}],config:{include:['**']}});return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
await test('Missing device-local API fails without writing plugin data or inventing an identity',async()=>{
  await assert.rejects(openObsidianSyncDevice({app:{},pluginId,locks:testLockManager()}),/local-api/);
});
await test('No lock or secure crypto capability fails before local writes',async()=>{
  const app=testLocalApp();await assert.rejects(openObsidianSyncDevice({app,pluginId,locks:{}}),/capability/);
  await assert.rejects(openObsidianSyncDevice({app,pluginId,locks:testLockManager(),cryptoProvider:{}}),/capability/);assert.equal(app.writes(),0);
});
await test('Fresh identity is random, read back, local-only, and redacted in public state',async()=>{
  const {app,device:d}=await device();const s=d.state(),raw=app.loadLocalStorage(key);assert.match(s.installation,/^[a-f0-9]{32}$/);assert.match(raw.secret,/^[a-f0-9]{64}$/);assert.ok(!Object.hasOwn(s,'secret'));assert.equal(s.connection,null);assert.equal(app.writes(),1);
  const another=await device();assert.notEqual(another.device.state().installation,s.installation);assert.notEqual(another.app.loadLocalStorage(key).secret,raw.secret);
});
await test('Concurrent first opens share one local identity under the identity lock',async()=>{
  const app=testLocalApp(),locks=testLockManager(),ds=await Promise.all([device({app,locks}),device({app,locks})]);assert.equal(ds[0].device.state().installation,ds[1].device.state().installation);assert.equal(app.writes(),1);
});
await test('Malformed existing identity or connection is never replaced with a fresh record',async()=>{
  const app=testLocalApp();app.saveLocalStorage(key,{version:99,installation:'bad'});await assert.rejects(device({app}),/identity-invalid/);assert.equal(app.writes(),1);
  const f=await device();const raw=f.app.loadLocalStorage(key);raw.connection={vault:'../wrong',enabled:true};f.app.saveLocalStorage(key,raw);await assert.rejects(device({app:f.app}),/connection-invalid/);
});
await test('Local storage errors and unconfirmed readback stop setup',async()=>{
  const app=testLocalApp();app.onSave(()=>{throw Error('quota');});await assert.rejects(device({app}),/quota/);assert.equal(app.writes(),0);
  await assert.rejects(device({app:{loadLocalStorage:()=>null,saveLocalStorage:()=>{}}}),/identity-invalid/);
});
await test('Connection and disabled state survive reopening without importing cached credentials',async()=>{
  const f=await device();await f.device.connect(vault);const reopened=(await device({app:f.app,locks:f.locks})).device;assert.deepEqual(reopened.state(),f.device.state());
  await reopened.disable();const disabled=(await device({app:f.app,locks:f.locks})).device;assert.equal(disabled.state().connection.enabled,false);await assert.rejects(disabled.acquire(vault),/connection-disabled/);
  const original=disabled.state().installation;await disabled.connect(vault);assert.equal(disabled.state().installation,original);
});
await test('Switching requires disabling and preserves identity rather than recycling another vault receipt',async()=>{
  const f=await device();await f.device.connect(vault);await assert.rejects(f.device.connect(other),/disable-before-switch/);await f.device.disable();await f.device.connect(other);
  assert.equal(f.device.state().connection.vault,other);await assert.rejects(f.device.acquire(vault),/connection-disabled/);
});
await test('A live session excludes parallel owners, disabling and connection switching',async()=>{
  const f=await device();await f.device.connect(vault);const second=(await device({app:f.app,locks:f.locks})).device,release=await f.device.acquire(vault);
  await assert.rejects(second.acquire(vault),/device-busy/);await assert.rejects(second.disable(),/device-busy/);await assert.rejects(f.device.connect(other),/device-busy/);await release();await release();await second.disable();
});
await test('Stale device handles and erased local state fail without regenerating credentials',async()=>{
  const f=await device(),second=(await device({app:f.app,locks:f.locks})).device;await f.device.connect(vault);assert.throws(()=>second.state(),/device-state-changed/);
  const old=f.device.state().installation;f.app.entries.delete(key);assert.throws(()=>f.device.state(),/identity-invalid/);const fresh=(await device({app:f.app,locks:f.locks})).device;assert.notEqual(fresh.state().installation,old);
});
await test('Failed connection persistence does not report the requested transition as completed',async()=>{
  const f=await device();f.app.onSave(()=>{throw Error('local-write-failure');});await assert.rejects(f.device.connect(vault),/local-write-failure/);assert.equal(f.device.state().connection,null);
});
await test('Private files are authenticated, readable after reopen, and not encrypted',async()=>{
  const f=await privateFixture(),text='{"sentinel":"synthetic"}';await f.bound.create('events/000000000001.json',text);assert.equal(await f.bound.read('events/000000000001.json',256),text);assert.ok(f.store.files.get('events/000000000001.json').endsWith(text));await f.release();
  const d=(await device({app:f.app,locks:f.locks})).device,b=createDeviceBoundPrivateStore({store:f.store,device:d,vault}),release=await b.acquire(d.state().installation);assert.equal(await b.read('events/000000000001.json',256),text);await release();
});
await test('Copying private files and plugin config to a different device cannot confer acceptance',async()=>{
  const f=await privateFixture();await f.bound.create('events/000000000001.json','{}');await f.release();const otherDevice=await device();await otherDevice.device.connect(vault);
  const b=createDeviceBoundPrivateStore({store:f.store,device:otherDevice.device,vault}),release=await b.acquire(otherDevice.device.state().installation);await assert.rejects(b.read('events/000000000001.json',256),/private-authentication/);await release();
});
await test('The same installation label without its local key still cannot verify copied files',async()=>{
  const f=await privateFixture();await f.bound.create('events/1.json','{}');await f.release();const app=testLocalApp(),raw=f.app.loadLocalStorage(key);raw.secret='d'.repeat(64);app.saveLocalStorage(key,raw);
  const d=(await device({app})).device,b=createDeviceBoundPrivateStore({store:f.store,device:d,vault}),release=await b.acquire(d.state().installation);await assert.rejects(b.read('events/1.json',256),/private-authentication/);await release();
});
await test('MAC covers bytes, file name and vault namespace',async()=>{
  const f=await privateFixture();await f.bound.create('events/1.json','{"value":1}');const raw=f.store.files.get('events/1.json');f.store.files.set('events/2.json',raw);await assert.rejects(f.bound.read('events/2.json',256),/private-authentication/);
  f.store.files.set('events/1.json',raw.replace('"value":1','"value":2'));await assert.rejects(f.bound.read('events/1.json',256),/private-authentication/);f.store.files.set('events/1.json',raw);await f.release();
  await f.device.disable();await f.device.connect(other);const b=createDeviceBoundPrivateStore({store:f.store,device:f.device,vault:other}),release=await b.acquire(f.device.state().installation);await assert.rejects(b.read('events/1.json',256),/private-authentication/);await release();
});
await test('Unsigned, truncated and oversized private payloads are rejected without replacement',async()=>{
  const f=await privateFixture();f.store.files.set('events/1.json','{}');await assert.rejects(f.bound.read('events/1.json',256),/private-authentication/);await assert.rejects(f.bound.create('events/1.json','new'),/private-create-conflict/);assert.equal(f.store.files.get('events/1.json'),'{}');
  await f.bound.create('events/2.json','x'.repeat(200));await assert.rejects(f.bound.read('events/2.json',10),/private-authentication/);f.store.files.set('events/2.json',f.store.files.get('events/2.json').slice(0,-1));await assert.rejects(f.bound.read('events/2.json',256),/private-authentication/);await f.release();
});
await test('Private stores require a lease, bounded paths and the correct installation',async()=>{
  const f=await privateFixture();await assert.rejects(f.bound.create('../escape','{}'),/path/);await assert.rejects(f.bound.read('x',Infinity),/budget/);assert.equal(await f.bound.read('events/missing.json',256),null);await f.release();await assert.rejects(f.bound.read('events/missing.json',256),/lease/);await assert.rejects(f.bound.acquire('0'.repeat(32)),/owner/);
});
await test('A failed backing lease releases the device gate',async()=>{
  const f=await device();await f.device.connect(vault);const store=testMemoryStore();store.acquire=async()=>{throw Error('backing-busy');};const b=createDeviceBoundPrivateStore({store,device:f.device,vault});await assert.rejects(b.acquire(f.device.state().installation),/backing-busy/);await f.device.disable();
});
await test('An intact older signed prefix cannot replace the latest device-anchored journal',async()=>{
  const f=await privateFixture();await f.bound.create('events/000000000001.json','{}');await f.bound.create('events/000000000002.json','{"next":true}');assert.equal(f.device.anchor(vault).sequence,2);await f.release();
  f.store.files.delete('events/000000000002.json');const b=createDeviceBoundPrivateStore({store:f.store,device:f.device,vault});await assert.rejects(b.acquire(f.device.state().installation),{code:'SYNC_PRIVATE_ANCHOR_MISSING'});assert.equal(f.device.anchor(vault).sequence,2);
});
await test('A copied same-name alternative signed event fails the device high-water hash',async()=>{
  const f=await privateFixture();await f.bound.create('events/000000000001.json','{}');await f.release();f.store.files.set('events/000000000001.json',await f.device.seal(vault,'events/000000000001.json','{"old":true}'));
  const b=createDeviceBoundPrivateStore({store:f.store,device:f.device,vault});await assert.rejects(b.acquire(f.device.state().installation),{code:'SYNC_PRIVATE_ANCHOR_MISMATCH'});
});
await test('Failure to anchor an installed event is not reported as successful and can be recovered',async()=>{
  const f=await privateFixture();f.app.onSave(()=>{throw Error('anchor-quota');});await assert.rejects(f.bound.create('events/000000000001.json','{}'),/anchor-quota/);assert.equal(f.device.anchor(vault),null);await f.release();f.app.onSave(null);
  const b=createDeviceBoundPrivateStore({store:f.store,device:f.device,vault}),release=await b.acquire(f.device.state().installation);assert.equal(await b.read('events/000000000001.json',256),'{}');assert.equal(f.device.anchor(vault).sequence,1);await release();
});
await test('Switching away and back retains each logical vault high-water anchor',async()=>{
  const f=await privateFixture();await f.bound.create('events/000000000001.json','{}');const anchor=f.device.anchor(vault);await f.release();await f.device.disable();await f.device.connect(other);assert.equal(f.device.anchor(other),null);await f.device.disable();await f.device.connect(vault);assert.deepEqual(f.device.anchor(vault),anchor);
});
await test('The device anchor namespace budget stops without evicting earlier vault anchors',async()=>{
  const f=await device(),raw=f.app.loadLocalStorage(key);raw.anchors=Object.fromEntries(Array.from({length:32},(_,n)=>[(n+1).toString(16).padStart(32,'0'),{sequence:1,hash:'0'.repeat(64)}]));f.app.saveLocalStorage(key,raw);const d=(await device({app:f.app,locks:f.locks})).device;await d.connect(vault);const b=createDeviceBoundPrivateStore({store:testMemoryStore(),device:d,vault}),release=await b.acquire(d.state().installation);await assert.rejects(b.create('events/000000000001.json','{}'),/anchor-budget/);assert.equal(Object.keys(f.app.loadLocalStorage(key).anchors).length,32);await release();
});
await test('A durable A3 session recovers its exact receipt through authenticated private files',async()=>{
  const f=await device();await f.device.connect(vault);const store=testMemoryStore(),sharedStore=testMemoryStore();
  const make=d=>createDurableSyncSession({privateStore:createDeviceBoundPrivateStore({store,device:d,vault}),sharedStore,vault,installation:d.state().installation,createModel:model});
  const s=make(f.device);await s.open();await s.initialize({source:'explicit-empty',localBaseline:empty});await s.saveLocalState({syntheticDraft:'kept'});const fingerprint=s.state().accepted.fingerprint;await s.close();
  const d=(await device({app:f.app,locks:f.locks})).device,cold=make(d);await cold.open();assert.equal(cold.state().accepted.fingerprint,fingerprint);assert.deepEqual(cold.state().localState,{syntheticDraft:'kept'});await cold.close();
  const otherDevice=(await device()).device;await otherDevice.connect(vault);const copied=make(otherDevice);await assert.rejects(copied.open(),/private-authentication/);await copied.close();
});
await test('No local-storage secret or connection is promoted from the plugin data document',async()=>{
  const f=host({sync:{installation:'f'.repeat(32),secret:'f'.repeat(64),vault:other},unrelated:42}),d=await device();await f.document.read();assert.equal(d.device.state().connection,null);assert.notEqual(d.device.state().installation,'f'.repeat(32));assert.equal(f.writes(),0);
});
await test('Document adapter refuses unsafe APIs and paths without falling back to saveData',async()=>{
  const f=host();delete f.adapter.process;assert.throws(()=>createObsidianSettingsDocument({plugin:f.plugin}),/document-api/);
  const g=host();g.plugin.app.vault.configDir='../outside';assert.throws(()=>createObsidianSettingsDocument({plugin:g.plugin}),/path/);g.plugin.app.vault.configDir='.obsidian';g.plugin.manifest.id='../other';assert.throws(()=>createObsidianSettingsDocument({plugin:g.plugin}),/document-api/);
});
await test('An unknown or synchronised config directory remains read-only even with process available',async()=>{
  for(const mode of [false,undefined,'true']){const f=host({},mode===undefined?false:mode),before=f.raw(),r=await f.document.read();assert.equal((await f.document.compareAndSet(r.version,{local:1})).reason,'external-writer-not-excluded');assert.equal(f.raw(),before);assert.equal(f.processes(),0);}
});
await test('Oversized or missing documents fail before reading and are never implicitly created',async()=>{
  const f=host();f.adapter.stat=async()=>({type:'file',size:8388609});await assert.rejects(f.document.read(),/document-budget/);assert.equal(f.reads(),0);f.adapter.stat=async()=>null;await assert.rejects(f.document.read(),/document-missing/);assert.equal(f.processes(),0);
});
await test('Malformed JSON, nonobject roots and growth after stat fail closed',async()=>{
  const f=host();for(const raw of ['{partial','null','[]']){f.setRaw(raw);await assert.rejects(f.document.read(),/document-json|document-shape/);}
  f.adapter.stat=async()=>({type:'file',size:2});f.setRaw(' '.repeat(8388609));await assert.rejects(f.document.read(),/document-budget/);assert.equal(f.writes(),0);
});
await test('A cooperative conditional save uses process and verifies readback',async()=>{
  const f=host({unrelated:{keep:42}}),r=await f.document.read();r.data.settings.language='zh';assert.equal((await f.document.compareAndSet(r.version,r.data)).ok,true);assert.equal(JSON.parse(f.raw()).unrelated.keep,42);assert.equal(f.writes(),1);
});
await test('Foreign version tokens and tokens with altered bytes cannot authorize a write',async()=>{
  const a=host(),b=host(),r=await a.document.read();assert.throws(()=>b.document.compareAndSet(r.version,r.data),/document-version/);assert.throws(()=>a.document.compareAndSet({...r.version},r.data),/document-version/);assert.equal(b.writes(),0);
});
await test('A same-file change before process makes the stale conditional write a no-op',async()=>{
  const f=host(),r=await f.document.read();f.beforeProcess(()=>{f.beforeProcess(null);f.patch(d=>d.unrelated='external');});assert.equal((await f.document.compareAndSet(r.version,{stale:1})).ok,false);assert.equal(JSON.parse(f.raw()).unrelated,'external');assert.equal(f.writes(),0);
});
await test('External notification invalidates tokens before queued reload or write',async()=>{
  const f=host(),r=await f.document.read();f.document.notifyExternalChange();assert.equal((await f.document.compareAndSet(r.version,r.data)).ok,false);assert.equal(f.processes(),0);
});
await test('Notification inside process and external replacement after process cannot report success',async()=>{
  const f=host(),r=await f.document.read();f.beforeProcess(()=>f.document.notifyExternalChange());assert.equal((await f.document.compareAndSet(r.version,{local:1})).ok,false);assert.equal(f.writes(),0);
  const g=host(),s=await g.document.read();g.afterProcess(()=>{g.setRaw('{"external":true}');g.document.notifyExternalChange();});assert.equal((await g.document.compareAndSet(s.version,{local:1})).ok,false);assert.deepEqual(JSON.parse(g.raw()),{external:true});
});
await test('An external notification during final readback still invalidates the save',async()=>{
  const f=host(),r=await f.document.read();f.onRead(()=>f.document.notifyExternalChange());assert.equal((await f.document.compareAndSet(r.version,{local:1})).ok,false);
});
await test('Closing a document gate prevents any later read or queued write',async()=>{
  const f=host(),r=await f.document.read();await f.document.close();await assert.rejects(f.document.read(),/document-closed/);assert.throws(()=>f.document.compareAndSet(r.version,r.data),/document-closed/);assert.equal(f.writes(),0);
});
async function coordinated(f){
  let localState=null;const session={state:()=>({accepted:{snapshot:clone(empty),fingerprint:'b'.repeat(64)},localState:clone(localState)}),saveLocalState:async data=>{localState=clone(data);},acceptExternal:async()=>({kind:'noop'})};
  const create=()=>createSettingsCoordinator({session,documentStore:f.document,validateSettings:validate,nextId:()=> '1'.repeat(32)}),c=create();await c.open();return {c,create};
}
async function draft(c,fn){const d=await c.beginSettingsDraft();fn(d.value);await c.updateSettingsDraft(d.id,d.value);return d;}
await test('Coordinator preserves unknown fields and current external UI through the public adapter surface',async()=>{
  const f=host({unrelated:{keep:42}}),{c}=await coordinated(f),d=await draft(c,v=>v.settings.debounceMs=600);f.patch(v=>{v.ui={remote:'kept'};v.layoutOverrides={untrusted:true};v.other=7;});f.document.notifyExternalChange();assert.equal((await c.saveSettingsDraft(d.id)).kind,'saved');const data=JSON.parse(f.raw());assert.equal(data.ui.remote,'kept');assert.equal(data.other,7);assert.deepEqual(data.layoutOverrides,empty);assert.equal(data.settings.debounceMs,600);
});
await test('An external same-field race retains the settings draft for review',async()=>{
  const f=host(),{c}=await coordinated(f),d=await draft(c,v=>v.settings.debounceMs=600);f.beforeProcess(()=>{f.beforeProcess(null);f.patch(v=>v.settings.debounceMs=700);f.document.notifyExternalChange();});assert.equal((await c.saveSettingsDraft(d.id)).kind,'review-required');assert.equal(c.state().settingsDraft.value.settings.debounceMs,600);assert.equal(JSON.parse(f.raw()).settings.debounceMs,700);
});
await test('A document failure leaves a durable intent and reopening the coordinator retries it',async()=>{
  const f=host(),{c,create}=await coordinated(f),d=await draft(c,v=>v.settings.language='zh');f.beforeProcess(()=>{throw Error('host-disk-failure');});await assert.rejects(c.saveSettingsDraft(d.id),/host-disk-failure/);assert.ok(c.state().pendingSave);f.beforeProcess(null);const cold=create();await cold.open();assert.equal((await cold.resume()).kind,'saved');assert.equal(JSON.parse(f.raw()).settings.language,'zh');
});
await test('Unknown external-writer configuration keeps settings and UI intents without touching data.json',async()=>{
  const f=host({},false),before=f.raw(),{c}=await coordinated(f),d=await draft(c,v=>v.settings.language='zh');const result=await c.saveSettingsDraft(d.id);assert.equal(result.kind,'held');assert.equal(result.reason,'external-writer-not-excluded');await c.saveUi('legend',true);assert.equal(c.state().uiPending.legend.value,'true');assert.equal(c.state().settingsDraft.value.settings.language,'zh');assert.equal(f.raw(),before);assert.equal(f.processes(),0);
});
const output={version:1,checks:checks.length,passed:true,names:checks,boundary:'Public-API contract fakes and in-memory authenticated session only. No native, iPad, power-loss or cross-tool CAS claim.'};
fs.mkdirSync(new URL('../.local/sync-016/a3/host/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../.local/sync-016/a3/host/host-check.json',import.meta.url),JSON.stringify(output,null,2));console.log(`SYNC host contract checks passed (${checks.length}).`);
