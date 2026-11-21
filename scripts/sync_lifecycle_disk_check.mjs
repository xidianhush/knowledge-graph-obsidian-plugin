import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
import {createLayoutActionAuthor} from '../src/sync/author-prototype.mjs';
import {createDurableSyncSession} from '../src/sync/persistence-prototype.mjs';
import {createPrivateConfigProjection} from '../src/sync/private-config-prototype.mjs';
import {createSettingsCoordinator} from '../src/sync/settings-coordinator-prototype.mjs';
import {openObsidianSyncDevice,createDeviceBoundPrivateStore} from '../src/sync/obsidian-host-prototype.mjs';
import {createLifecycleDevice,createSyncLifecycle} from '../src/sync/connection-lifecycle-prototype.mjs';
import {createPrivateStoreBudget} from '../src/sync/private-store-budget-prototype.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';
import {testLockManager} from './sync-host-test-helpers.mjs';
import {validateTestSettings as validate} from './sync-settings-test-helpers.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url)),BASE=path.join(ROOT,'.local/sync-016/a3/lifecycle'),vault='a'.repeat(32),other='c'.repeat(32),pluginId='lifecycle-disk-test',exportId='e'.repeat(32);
const empty={schemaVersion:3,revision:0,groups:{},structures:{}},source=()=>({settings:{language:'auto'},ui:{legend:'false'},unknown:{keep:42}});
const graph=()=>buildGraph({files:[{path:'Synthetic/A.md',text:'# First\nbody\n# Second\nother'}],config:{include:['**']}}),model=()=>{const g=graph();return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
async function draft(){const g=graph(),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius),n=g.nodes.find(n=>n.title==='Second');assert.equal(e.begin(n.id),null);e.move(n.x+10,n.y+3);e.commit();let snapshot;const group=m.groupKey(n.id);await createLayoutStore(null,async value=>snapshot=value).command({},'edit',group,m.capture(group));return createLayoutActionAuthor({vault,createModel:model,nextId:()=> '2'.repeat(32)}).prepareEdit({vault,sharedScanComplete:true,records:[],appliedIds:[],localBaseline:empty},[{group,value:{schemaVersion:3,record:snapshot.groups[group],structures:snapshot.structures}}]);}
async function make(dir,{hook=()=>{},limits}={}){
  const local=path.join(dir,'device-local.json'),read=()=>fs.existsSync(local)?JSON.parse(fs.readFileSync(local,'utf8')):{},app={loadLocalStorage:key=>read()[key]??null,saveLocalStorage:(key,value)=>fs.writeFileSync(local,JSON.stringify({...read(),[key]:value}))},locks=testLockManager();
  const base=await openObsidianSyncDevice({app,pluginId,locks});if(!base.state().connection)await base.connect(vault);
  const device=await createLifecycleDevice({device:base,app,pluginId,locks,nextId:()=> 'd'.repeat(32),checkpoint:step=>hook('device:'+step)}),opened=[];
  const sharedStore=createNodeSyncStore(path.join(dir,'shared')),destination=createNodeSyncStore(path.join(dir,'exports'),{onStep:(step,name)=>hook('export:'+step+':'+name)});
  const controller=createSyncLifecycle({device,checkpoint:step=>hook('controller:'+step),openBundle:async({device,vault})=>{
    const backend=createNodeSyncStore(path.join(dir,vault,'private')),quota=createPrivateStoreBudget({store:backend,limits});
    const session=createDurableSyncSession({privateStore:createDeviceBoundPrivateStore({store:quota.store,device,vault}),sharedStore,vault,installation:device.state().installation,createModel:model}),projection=createPrivateConfigProjection({session,validateSettings:validate,getExternalEpoch:()=>0}),coordinator=createSettingsCoordinator({session,documentStore:projection.documentStore,validateSettings:validate,nextId:()=> '1'.repeat(32)});
    const bundle={session,projection,coordinator,quota,backend,open:()=>quota.recover(async()=>{await session.open();if(!session.state().initialized)await session.initialize({source:'explicit-empty',localBaseline:empty});await projection.initialize({sourceData:source()});await coordinator.open();})};opened.push(bundle);return bundle;
  }});
  await controller.open();return {base,device,controller,sharedStore,destination,current:()=>opened.at(-1),opened};
}
async function prepare(f){await f.controller.run(async b=>{if(!b.coordinator.state().settingsDraft){const d=await b.coordinator.beginSettingsDraft();d.value.settings.language='zh';await b.coordinator.updateSettingsDraft(d.id,d.value);}if(!b.coordinator.state().layoutDraft)await b.coordinator.stageLayoutDraft(empty);await b.coordinator.saveUi('legend',true);if(!b.session.state().pending)await b.session.stage(await draft());});}
await fsp.mkdir(BASE,{recursive:true});
if(process.argv[2]==='--crash'){
  const dir=path.resolve(process.argv[3]),mode=process.argv[4],point=process.argv[5],relative=path.relative(BASE,dir);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));let armed=false;
  const f=await make(dir,{hook:step=>{if(armed&&step===point)process.exit(86);}});await prepare(f);armed=true;
  if(mode==='disable')await f.controller.disable();else if(mode==='switch')await f.controller.switchTo(other);else await f.controller.exportRecovery({destination:f.destination,id:exportId});throw Error('point did not fire: '+point);
}else{
  const checks=[],crashes=[];async function test(name,fn){await fn();checks.push(name);}
  const fresh=async options=>{const dir=await fsp.mkdtemp(path.join(BASE,'disk-'));return {dir,...await make(dir,options)};};
  await test('Disable/re-enable preserves signed drafts, UI and the original unpublished outbox on real disk',async()=>{
    const f=await fresh();await prepare(f);await f.controller.disable();const cold=await make(f.dir);assert.equal(cold.controller.state().status,'disabled');assert.equal(cold.opened.length,0);await cold.controller.enable(vault);assert.equal(cold.current().coordinator.state().settingsDraft.value.settings.language,'zh');assert.ok(cold.current().coordinator.state().layoutDraft);assert.equal(cold.current().session.state().pending.id,'2'.repeat(32));assert.equal((await cold.controller.compatibilityData()).ui.legend,'true');assert.equal((await cold.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,0);await cold.controller.disable();
  });
  await test('Real directory inventory counts orphan blobs and interrupted temporary bytes without deleting them',async()=>{
    const f=await fresh(),backend=f.current().backend;await backend.create('blobs/orphan','orphan payload');await fsp.mkdir(path.join(f.dir,vault,'private/.tmp'),{recursive:true});await fsp.writeFile(path.join(f.dir,vault,'private/.tmp/retained.part'),'partial');const inv=await backend.inventory();assert.ok(inv.files.some(v=>v.name==='.tmp/retained.part'));assert.ok(inv.files.some(v=>v.name==='blobs/orphan'));assert.equal(inv.bytes,inv.files.reduce((n,v)=>n+v.bytes,0));assert.equal((await backend.inventory({maxFiles:1})).complete,false);await f.controller.disable();assert.equal(await fsp.readFile(path.join(f.dir,vault,'private/.tmp/retained.part'),'utf8'),'partial');
  });
  await test('Soft quota pause remains exportable and disabled without touching existing records',async()=>{
    const limits={softBytes:65536,hardBytes:1048576,softFiles:100,hardFiles:500,softEvents:90,hardEvents:4096},f=await fresh({limits});await prepare(f);const status=await f.current().quota.inspect();await f.current().backend.create('blobs/filler','x'.repeat(65536-status.bytes));const before=f.current().session.state().sequence;assert.equal((await f.controller.run(()=>assert.fail('must not enter'))).kind,'held');assert.equal((await f.controller.exportRecovery({destination:f.destination,id:exportId})).kind,'exported');assert.equal(f.current().session.state().sequence,before);await f.controller.disable();const cold=await make(f.dir,{limits});await cold.controller.enable(vault);assert.equal(cold.controller.state().status,'paused');assert.equal(cold.current().session.state().pending.id,'2'.repeat(32));await cold.controller.disable();
  });
  await test('Hard byte guard rejects before a new temp or final file is created',async()=>{
    const dir=await fsp.mkdtemp(path.join(BASE,'hard-')),backend=createNodeSyncStore(dir),quota=createPrivateStoreBudget({store:backend,limits:{softBytes:100,hardBytes:200,softFiles:10,hardFiles:20,softEvents:8,hardEvents:16}}),release=await quota.store.acquire('b'.repeat(32));await quota.recover(()=>quota.store.create('blobs/a','x'.repeat(190)));const before=await backend.inventory();await assert.rejects(quota.recover(()=>quota.store.create('blobs/b','y'.repeat(11))),/hard-limit/);assert.deepEqual(await backend.inventory(),before);assert.equal(await backend.read('blobs/b',64),null);await release();
  });
  await test('Recovery package contains unpublished payloads and drafts but no device secret or acceptance import authority',async()=>{
    const f=await fresh();await prepare(f);const r=await f.controller.exportRecovery({destination:f.destination,id:exportId});const raw=await f.destination.read(exportId+'/manifest.json',8388608),manifest=JSON.parse(raw);assert.equal(manifest.scope,'review-only-not-acceptance-ledger');assert.equal(manifest.files.length,r.files);assert.equal(JSON.parse(await f.destination.read(exportId+'/pending-operation.json',8388608)).id,'2'.repeat(32));assert.equal(JSON.parse(await f.destination.read(exportId+'/drafts.json',8388608)).settingsDraft.value.settings.language,'zh');const local=JSON.parse(await fsp.readFile(path.join(f.dir,'device-local.json'),'utf8'));assert.ok(!raw.includes(local[pluginId+':sync-v2:device'].secret));await f.controller.disable();
  });
  for(const [mode,points]of [
    ['disable',['device:after-transition-record','controller:after-transition-intent','controller:after-bundle-close','device:after-base-disable','device:after-slot-clear','controller:after-transition-complete']],
    ['switch',['device:after-transition-record','controller:after-transition-intent','controller:after-bundle-close','device:after-base-disable','device:after-target-enable','device:after-target-disable','device:after-slot-clear','controller:after-transition-complete']],
    ['export',['export:temp-partial:'+exportId+'/accepted.json','export:installed:'+exportId+'/drafts.json','export:temp-partial:'+exportId+'/manifest.json','export:installed:'+exportId+'/manifest.json']],
  ])for(const point of points)await test('Actual process exit preserves lifecycle '+mode+': '+point,async()=>{
    const dir=await fsp.mkdtemp(path.join(BASE,'crash-')),child=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--crash',dir,mode,point],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:20000});assert.equal(child.status,86,child.stderr||child.error?.message);const f=await make(dir);
    if(mode==='export'){assert.equal(f.controller.state().status,'ready');assert.equal((await f.controller.exportRecovery({destination:f.destination,id:exportId})).kind,'exported');}
    else{assert.equal(f.controller.state().status,'disabled');assert.equal(f.opened.length,0);assert.deepEqual(f.device.state().connection,{vault:mode==='switch'?other:vault,enabled:false});assert.equal(fs.existsSync(path.join(dir,other,'private')),false);await f.controller.enable(vault);}
    assert.equal(f.current().session.state().pending.id,'2'.repeat(32));assert.equal(f.current().session.state().pending.publicationAttempted,false);assert.equal(f.current().coordinator.state().settingsDraft.value.settings.language,'zh');assert.ok(f.current().coordinator.state().layoutDraft);assert.equal((await f.controller.compatibilityData()).settings.language,'auto');assert.equal((await f.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,0);await f.controller.disable();crashes.push({mode,point,exitCode:86});
  });
  const result={date:'2026-11-08 Asia/Shanghai',passed:checks.length,checks,actualChildCrashes:crashes,scope:'Real signed Node files/process exits and payload quota; App localStorage/Web Locks fakes. No new native/iPad, OS quota, power loss, automatic archive import or shared publication claim.'};await fsp.writeFile(path.join(BASE,'lifecycle-disk-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:checks.length,processCrashes:crashes.length}));
}
