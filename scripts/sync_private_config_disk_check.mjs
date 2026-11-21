// Authenticated real disk/process recovery. App local storage/Web Locks are fakes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
import {createDurableSyncSession} from '../src/sync/persistence-prototype.mjs';
import {createLayoutActionAuthor} from '../src/sync/author-prototype.mjs';
import {createPrivateConfigProjection} from '../src/sync/private-config-prototype.mjs';
import {createSettingsCoordinator} from '../src/sync/settings-coordinator-prototype.mjs';
import {openObsidianSyncDevice,createDeviceBoundPrivateStore} from '../src/sync/obsidian-host-prototype.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';
import {testLockManager} from './sync-host-test-helpers.mjs';
import {validateTestSettings as validate} from './sync-settings-test-helpers.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url)),BASE=path.join(ROOT,'.local/sync-016/a3/config'),vault='a'.repeat(32),id='private-config-disk-test';
const empty={schemaVersion:3,revision:0,groups:{},structures:{}},raw=()=>({settings:{language:'auto'},ui:{legend:'false'},unknown:{kept:42},layoutOverrides:{schemaVersion:99,backupOnly:'synthetic'}}),external=()=>({...raw(),settings:{language:'en'}});
const graph=()=>buildGraph({files:[{path:'Synthetic/A.md',text:'# First\nbody\n# Second\nother'}],config:{include:['**']}}),model=()=>{const g=graph();return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
async function io(dir,hook=()=>{}){
  const file=path.join(dir,'device-local.json'),app={loadLocalStorage:key=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8'))[key]??null:null,saveLocalStorage:(key,value)=>fs.writeFileSync(file,JSON.stringify({[key]:value}))};
  const device=await openObsidianSyncDevice({app,pluginId:id,locks:testLockManager()});if(!device.state().connection)await device.connect(vault);
  const backing=createNodeSyncStore(path.join(dir,'private'),{onStep:(step,name)=>hook('private:'+step+':'+name)}),sharedStore=createNodeSyncStore(path.join(dir,'shared'));
  const session=createDurableSyncSession({privateStore:createDeviceBoundPrivateStore({store:backing,device,vault}),sharedStore,vault,installation:device.state().installation,createModel:model,checkpoint:step=>hook('session:'+step)});
  await session.open();if(!session.state().initialized)await session.initialize({source:'explicit-empty',localBaseline:empty});
  const projection=createPrivateConfigProjection({session,validateSettings:validate,getExternalEpoch:()=>0,checkpoint:step=>hook('projection:'+step)});
  return {session,projection,device,backing,sharedStore,coordinator:()=>createSettingsCoordinator({session,documentStore:projection.documentStore,validateSettings:validate,nextId:()=> '1'.repeat(32),checkpoint:step=>hook('coordinator:'+step)})};
}
await fsp.mkdir(BASE,{recursive:true});
if(process.argv[2]?.startsWith('--crash-')){
  const mode=process.argv[2].slice(8),dir=path.resolve(process.argv[3]),point=process.argv[4],relative=path.relative(BASE,dir);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));let armed=mode==='init';
  const f=await io(dir,step=>{if(armed&&step===point)process.exit(86);});await f.projection.initialize({sourceData:raw()});
  if(mode==='save'){
    const c=f.coordinator();await c.open();const d=await c.beginSettingsDraft();d.value.settings.language='zh';await c.updateSettingsDraft(d.id,d.value);armed=true;await c.saveSettingsDraft(d.id);
  }else if(mode==='external'){
    const {id}=await f.projection.observeExternal(external());armed=true;await f.projection.resolveExternal(id,{choice:'merge'});
  }
  throw Error('crash did not fire: '+point);
}else{
  const checks=[],crashes=[];async function test(name,fn){await fn();checks.push(name);}
  const fresh=async()=>{const dir=await fsp.mkdtemp(path.join(BASE,'disk-')),f=await io(dir);await f.projection.initialize({sourceData:raw()});return {dir,...f};};
  await test('Settings, UI, full raw backup and accepted receipt remain distinct on signed disk reopen',async()=>{
    const f=await fresh(),fingerprint=f.session.state().accepted.fingerprint,c=f.coordinator();await c.open();await c.saveUi('legend',true);const d=await c.beginSettingsDraft();d.value.settings.language='zh';await c.updateSettingsDraft(d.id,d.value);await c.saveSettingsDraft(d.id);await f.session.close();
    const cold=await io(f.dir),value=(await cold.projection.documentStore.read()).data;assert.equal(value.settings.language,'zh');assert.equal(value.ui.legend,'true');assert.equal(value.unknown.kept,42);assert.deepEqual(value.layoutOverrides,empty);assert.deepEqual(await cold.projection.getInitialBackup(),raw());assert.equal(cold.session.state().accepted.fingerprint,fingerprint);assert.equal((await cold.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,0);await cold.session.close();
  });
  await test('Superseded external raw inputs stay authenticated and retrievable after disk reopen',async()=>{
    const f=await fresh(),a=external(),b=external();b.settings.language='zh';await f.projection.observeExternal(a);const version=f.session.getLocalDocument().version;const {id}=await f.projection.observeExternal(b);await f.session.close();const cold=await io(f.dir);assert.equal((await cold.projection.readHistory(version)).external.source.settings.language,'en');assert.equal((await cold.projection.resolveExternal(id,{choice:'merge'})).reason,'read-external-again');await cold.projection.observeExternal(b);await cold.projection.resolveExternal(id,{choice:'merge'});assert.equal((await cold.projection.documentStore.read()).data.settings.language,'zh');await cold.session.close();
  });
  await test('Conflicting local draft and external config both survive a signed cold load',async()=>{
    const f=await fresh(),c=f.coordinator();await c.open();const d=await c.beginSettingsDraft();d.value.settings.language='zh';await c.updateSettingsDraft(d.id,d.value);const {id}=await f.projection.observeExternal(external());await f.projection.resolveExternal(id,{choice:'merge'});assert.equal((await c.saveSettingsDraft(d.id)).kind,'review-required');await f.session.close();const cold=await io(f.dir),cc=cold.coordinator();await cc.open();assert.equal(cc.state().settingsDraft.value.settings.language,'zh');assert.equal((await cc.resume()).kind,'review-required');assert.equal((await cold.projection.documentStore.read()).data.settings.language,'en');await cold.session.close();
  });
  await test('Local config journal events can interleave a pending layout transaction without invalidating its recovery',async()=>{
    const f=await fresh(),g=graph(),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius),n=g.nodes.find(n=>n.title==='Second');assert.equal(e.begin(n.id),null);e.move(n.x+10,n.y+4);e.commit();let layout;const group=m.groupKey(n.id);await createLayoutStore(null,async value=>layout=value).command({},'edit',group,m.capture(group));const author=createLayoutActionAuthor({vault,createModel:model,nextId:()=> '2'.repeat(32)}),draft=author.prepareEdit({vault,sharedScanComplete:true,records:[],appliedIds:[],localBaseline:empty},[{group,value:{schemaVersion:3,record:layout.groups[group],structures:layout.structures}}]);await f.session.stage(draft);
    const c=f.coordinator();await c.open();await c.saveUi('legend',true);await f.session.close();const cold=await io(f.dir),before=await cold.projection.documentStore.read();await cold.session.publish();assert.equal((await cold.projection.documentStore.compareAndSet(before.version,before.data)).ok,false);assert.deepEqual((await cold.projection.documentStore.read()).data.layoutOverrides,draft.proposal);assert.equal((await cold.projection.documentStore.read()).data.ui.legend,'true');await cold.session.close();
  });
  await test('A signed journal cannot revert effective config to an older complete prefix',async()=>{
    const f=await fresh(),r=await f.projection.documentStore.read();r.data.settings.language='zh';await f.projection.documentStore.compareAndSet(r.version,r.data);const last=f.session.state().sequence;await f.session.close();await fsp.unlink(path.join(f.dir,'private/events/'+String(last).padStart(12,'0')+'.json'));await assert.rejects(io(f.dir),/private-rollback/);
  });
  for(const [mode,points]of [
    ['init',['session:before-local-document','session:after-local-document','private:temp-partial:events/000000000002.json','private:installed:events/000000000002.json']],
    ['save',['session:before-local-document','session:after-local-document','projection:after-private-config-save','coordinator:after-document-write','coordinator:after-save-clear','private:temp-partial:events/000000000006.json','private:installed:events/000000000006.json','private:temp-partial:events/000000000007.json']],
    ['external',['projection:before-external-config-commit','projection:after-external-config-commit','private:temp-partial:events/000000000004.json','private:installed:events/000000000004.json']],
  ])for(const point of points){
    await test('Real process exit recovers private '+mode+': '+point,async()=>{
      const dir=await fsp.mkdtemp(path.join(BASE,'crash-')),child=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--crash-'+mode,dir,point],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:20000});assert.equal(child.status,86,child.stderr||child.error?.message);const f=await io(dir);await f.projection.initialize({sourceData:raw()});
      if(mode==='save'){const c=f.coordinator();await c.open();if(c.state().pendingSave)await c.resume();else if(c.state().settingsDraft)await c.saveSettingsDraft(c.state().settingsDraft.id);assert.equal((await f.projection.documentStore.read()).data.settings.language,'zh');assert.equal(c.state().settingsDraft,null);assert.equal(c.state().pendingSave,null);}
      if(mode==='external'){const {id}=await f.projection.observeExternal(external());await f.projection.resolveExternal(id,{choice:'merge'});assert.equal((await f.projection.documentStore.read()).data.settings.language,'en');}
      assert.deepEqual(await f.projection.getInitialBackup(),raw());assert.deepEqual(f.session.state().accepted.snapshot,empty);assert.equal((await f.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,0);await f.session.close();crashes.push({mode,point,exitCode:86});
    });
  }
  const result={date:'2026-11-08 Asia/Shanghai',passed:checks.length,checks,actualChildCrashes:crashes,scope:'Real signed Node disk and process exits; App local storage/Web Locks fakes. No new native/iPad, power-loss, external data.json writes or cloud service claim.'};await fsp.writeFile(path.join(BASE,'config-disk-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:checks.length,processCrashes:crashes.length}));
}
