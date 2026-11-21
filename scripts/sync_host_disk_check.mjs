// Real disk/process recovery for authenticated stores. App/Web Locks remain fakes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {openObsidianSyncDevice,createDeviceBoundPrivateStore} from '../src/sync/obsidian-host-prototype.mjs';
import {createDurableSyncSession} from '../src/sync/persistence-prototype.mjs';
import {createLayoutActionAuthor} from '../src/sync/author-prototype.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';
import {testLockManager} from './sync-host-test-helpers.mjs';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),BASE=path.join(root,'.local/sync-016/a3/host'),vault='a'.repeat(32),pluginId='knowledge-graph-smoke',ID='1'.repeat(32);
const empty={schemaVersion:3,revision:0,groups:{},structures:{}},files=[{path:'Synthetic/A.md',text:'# First\nbody\n# Second\nother'}];
function graph(){return buildGraph({files,config:{include:['**']}});}
const model=()=>{const g=graph();return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
async function draft(){const g=graph(),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius),n=g.nodes.find(n=>n.title==='Second');
  assert.equal(e.begin(n.id),null);e.move(n.x+10,n.y+4);e.commit();let snapshot;const group=m.groupKey(n.id);await createLayoutStore(null,async value=>snapshot=structuredClone(value)).command({},'edit',group,m.capture(group));
  return createLayoutActionAuthor({vault,createModel:model,nextId:()=>ID}).prepareEdit({vault,sharedScanComplete:true,records:[],appliedIds:[],localBaseline:empty},[{group,value:{schemaVersion:3,record:snapshot.groups[group],structures:snapshot.structures}}]);
}
// A file simulates the host's device-local storage across test child processes.
// It is not part of private/shared stores and is never copied in config-copy tests.
async function io(dir,{hook=()=>{}}={}){
  const local=path.join(dir,'device-local.json'),app={
    loadLocalStorage:key=>fs.existsSync(local)?JSON.parse(fs.readFileSync(local,'utf8'))[key]??null:null,
    saveLocalStorage(key,value){fs.writeFileSync(local,JSON.stringify({[key]:value}));},
  };
  const device=await openObsidianSyncDevice({app,pluginId,locks:testLockManager()});if(!device.state().connection)await device.connect(vault);
  const backing=createNodeSyncStore(path.join(dir,'private'),{onStep:(step,name)=>hook('private:'+step+':'+name)}),sharedStore=createNodeSyncStore(path.join(dir,'shared'));
  const privateStore=createDeviceBoundPrivateStore({store:backing,device,vault}),session=createDurableSyncSession({privateStore,sharedStore,vault,installation:device.state().installation,createModel:model,checkpoint:async step=>hook(step)});
  return {device,backing,sharedStore,privateStore,session};
}
await fsp.mkdir(BASE,{recursive:true});
if(process.argv[2]==='--crash'){
  const dir=path.resolve(process.argv[3]),point=process.argv[4],relative=path.relative(BASE,dir);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
  const f=await io(dir,{hook:step=>{if(step===point)process.exit(86);}});await f.session.open();if(!f.session.state().initialized)await f.session.initialize({source:'explicit-empty',localBaseline:empty});await f.session.stage(await draft());await f.session.publish();throw Error('missing crash point');
}else{
  const checks=[],crashes=[];async function test(name,fn){await fn();checks.push(name);}
  const fresh=async()=>{const dir=await fsp.mkdtemp(path.join(BASE,'signed-'));return {dir,...await io(dir)};};
  await test('Authenticated disk receipts and private drafts recover after closing and reopening',async()=>{
    const f=await fresh();await f.session.open();await f.session.initialize({source:'explicit-empty',localBaseline:empty});await f.session.saveLocalState({synthetic:'draft'});const fingerprint=f.session.state().accepted.fingerprint;await f.session.close();
    const cold=await io(f.dir);await cold.session.open();assert.equal(cold.session.state().accepted.fingerprint,fingerprint);assert.deepEqual(cold.session.state().localState,{synthetic:'draft'});assert.equal(cold.device.state().installation,f.device.state().installation);await cold.session.close();
  });
  await test('A copied disk private tree without device-local storage is rejected and preserved',async()=>{
    const f=await fresh();await f.session.open();await f.session.initialize({source:'explicit-empty',localBaseline:empty});await f.session.close();const dir=await fsp.mkdtemp(path.join(BASE,'copied-'));await fsp.cp(path.join(f.dir,'private'),path.join(dir,'private'),{recursive:true});
    const before=await fsp.readFile(path.join(dir,'private/events/000000000001.json'),'utf8'),copied=await io(dir);assert.notEqual(copied.device.state().installation,f.device.state().installation);await assert.rejects(copied.session.open(),/private-authentication/);await copied.session.close();assert.equal(await fsp.readFile(path.join(dir,'private/events/000000000001.json'),'utf8'),before);
  });
  await test('Copying the installation label while replacing its local key cannot verify disk receipts',async()=>{
    const f=await fresh();await f.session.open();await f.session.initialize({source:'explicit-empty',localBaseline:empty});await f.session.close();const local=path.join(f.dir,'device-local.json'),record=JSON.parse(await fsp.readFile(local,'utf8'));record[pluginId+':sync-v2:device'].secret='d'.repeat(64);await fsp.writeFile(local,JSON.stringify(record));
    const changed=await io(f.dir);await assert.rejects(changed.session.open(),/private-authentication/);await changed.session.close();
  });
  await test('A changed authenticated file on disk cannot be replayed or silently rewritten',async()=>{
    const f=await fresh();await f.session.open();await f.session.initialize({source:'explicit-empty',localBaseline:empty});await f.session.close();const file=path.join(f.dir,'private/events/000000000001.json'),raw=await fsp.readFile(file,'utf8'),changed=raw.slice(0,-1)+'x';await fsp.writeFile(file,changed);const cold=await io(f.dir);await assert.rejects(cold.session.open(),/private-rollback/);await cold.session.close();assert.equal(await fsp.readFile(file,'utf8'),changed);
  });
  await test('Restoring an authentic earlier journal prefix cannot roll back device-anchored acceptance',async()=>{
    const f=await fresh();await f.session.open();await f.session.initialize({source:'explicit-empty',localBaseline:empty});await f.session.saveLocalState({synthetic:'latest'});await f.session.close();await fsp.unlink(path.join(f.dir,'private/events/000000000002.json'));
    const cold=await io(f.dir);await assert.rejects(cold.session.open(),/private-rollback/);await cold.session.close();assert.equal(cold.device.anchor(vault).sequence,2);
  });
  await test('Local authentication never changes or signs the public v2 operation body',async()=>{
    const f=await fresh(),d=await draft();await f.session.open();await f.session.initialize({source:'explicit-empty',localBaseline:empty});await f.session.stage(d);await f.session.publish();const raw=await f.sharedStore.read(`Knowledge Map Sync/v2/${vault}/ops/${ID}.json`,2097152);assert.deepEqual(JSON.parse(raw),d.operation);assert.ok(!raw.includes('KM-SYNC-PRIVATE'));assert.ok(!raw.includes(f.device.state().installation));await f.session.close();
  });
  for(const point of ['after-intent','after-stage','private:temp-partial:events/000000000002.json','private:installed:events/000000000002.json','after-publication','after-accept']){
    await test('Authenticated journal survives real process exit: '+point,async()=>{
      const dir=await fsp.mkdtemp(path.join(BASE,'crash-')),child=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--crash',dir,point],{cwd:root,encoding:'utf8',timeout:20000,windowsHide:true});assert.equal(child.status,86,child.stderr||child.error?.message);const f=await io(dir);await f.session.open();const d=await draft();if(f.session.state().pending)await f.session.publish();
      assert.equal(f.session.state().pending,null);assert.deepEqual(f.session.state().accepted.appliedIds,[ID]);assert.deepEqual(f.session.state().accepted.snapshot,d.proposal);assert.equal((await f.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,1);await f.session.close();crashes.push({point,exitCode:86,recoveredId:ID});
    });
  }
  const result={date:'2026-11-08 Asia/Shanghai',passed:checks.length,checks,actualChildCrashes:crashes,scope:'Real Node disk/HMAC/process recovery with fake App local storage and fake Web Locks, not native device storage, iPad, power loss or cross-tool CAS'};await fsp.writeFile(path.join(BASE,'host-disk-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:checks.length,processCrashes:crashes.length}));
}
