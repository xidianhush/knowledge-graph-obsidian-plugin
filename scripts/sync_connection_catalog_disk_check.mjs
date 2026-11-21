// Actual files, signed private journal and child-process exit boundaries.
// App local-storage persistence is an injected file-backed contract adapter;
// these checks do not prove native App API or power-loss atomicity.
import assert from 'node:assert/strict';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createSyncConnectionCatalog} from '../src/sync/connection-catalog.mjs';
import {openSyncConnections} from '../src/sync/connection-registry.mjs';
import {createDeviceBoundPrivateStore} from '../src/sync/obsidian-host-prototype.mjs';
import {createDurableSyncSession} from '../src/sync/persistence-prototype.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';
import {testLockManager,testMemoryStore} from './sync-host-test-helpers.mjs';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel} from '../dist/graph-core.mjs';
const base=path.resolve('.local/sync-016/unified/u1'),pluginId='knowledge-graph-smoke',a='a'.repeat(32),b='b'.repeat(32),sha=v=>createHash('sha256').update(v).digest('hex');
function io(root){
 const location=p=>path.join(root,'shared',p);
 return {async stat(p){try{const s=await fs.stat(location(p));return {type:s.isDirectory()?'folder':'file',size:s.size};}catch(e){if(e.code==='ENOENT')return null;throw e;}},
  async list(p){const rows=await fs.readdir(location(p),{withFileTypes:true});return {files:rows.filter(r=>r.isFile()).map(r=>p+'/'+r.name),folders:rows.filter(r=>r.isDirectory()).map(r=>p+'/'+r.name)};},
  async readBinary(p){return Uint8Array.from(await fs.readFile(location(p))).buffer;}};
}
function appStore(root,point){
 const file=path.join(root,'app-local.json');let count=0;
 const read=()=>JSON.parse(fsSync.readFileSync(file,'utf8'));
 return {loadLocalStorage(key){const data=read();return data[key]??null;},saveLocalStorage(key,value){const data=read();data[key]=value;fsSync.writeFileSync(file,JSON.stringify(data));
  if(key.endsWith(':sync-connections-v1')){count++;if(point===(count===1?'app-intent-written':'app-commit-written'))process.exit(86);}
  if(point==='device-connect-written'&&key.endsWith(':sync-v2:device')&&value.connection?.vault===a)process.exit(86);
 }};
}
async function open(root,{point,nextId=()=>a}={}){
 const adapter=io(root),catalog=createSyncConnectionCatalog({adapter}),app=appStore(root,point),locks=testLockManager();
 const registry=await openSyncConnections({app,pluginId,catalog,locks,nextId,checkpoint:async step=>{if(step===point)process.exit(86);}});return {app,registry,adapter};
}
async function tree(dir){const rows=[];async function walk(p){for(const e of await fs.readdir(path.join(dir,p),{withFileTypes:true})){const name=p?p+'/'+e.name:e.name;if(e.isDirectory())await walk(name);else rows.push({name,hash:sha(await fs.readFile(path.join(dir,name)))});}}await walk('');return rows.sort((a,b)=>a.name.localeCompare(b.name));}
async function seed(root){
 await fs.mkdir(path.join(root,'shared'),{recursive:true});await fs.writeFile(path.join(root,'app-local.json'),'{}');
 const f=await open(root,{nextId:()=>b}),p=await f.registry.preview({action:'new'});assert.equal((await f.registry.confirm(p.token)).kind,'selected');
 const graph=buildGraph({files:[{path:'Synthetic/A.md',text:'# First\nSynthetic body'}],config:{include:['Synthetic/**']}});
 const session=createDurableSyncSession({privateStore:createDeviceBoundPrivateStore({store:createNodeSyncStore(path.join(root,'private')),device:f.registry.device,vault:b}),sharedStore:testMemoryStore(),
 vault:b,installation:f.registry.device.state().installation,createModel:()=>createLayoutModel(graph.nodes,graph.meta.layout_root_radius)});
 await session.open();await session.initialize({source:'explicit-empty',localBaseline:{schemaVersion:3,revision:0,groups:{},structures:{}}});
 await session.close();const anchor=f.registry.device.anchor(b);await f.registry.device.disable();await f.registry.close();
 return {device:JSON.parse(await fs.readFile(path.join(root,'app-local.json')))[pluginId+':sync-v2:device'],anchor,files:await tree(path.join(root,'private'))};
}
if(process.argv[2]==='--crash'){
 const root=path.resolve(process.argv[3]),point=process.argv[4];assert.ok(path.relative(base,root)&&!path.relative(base,root).startsWith('..'));
 const f=await open(root,{point}),p=await f.registry.preview({action:'new'});await f.registry.confirm(p.token);throw Error('exit point missing '+point);
}else{
 await fs.mkdir(base,{recursive:true});const out=await fs.mkdtemp(path.join(base,'disk-')),checks=[];
 for(const point of ['after-selection-intent','after-selection-connect','after-selection-commit','app-intent-written','device-connect-written','app-commit-written']){
  const root=await fs.mkdtemp(path.join(out,'case-')),before=await seed(root);
  const child=spawnSync(process.execPath,[process.argv[1],'--crash',root,point],{encoding:'utf8'});assert.equal(child.status,86,child.stderr);
  const f=await open(root,{nextId:()=>{throw Error('no new selection ID during recovery');}}),state=f.registry.state();
  assert.equal(state.pending,null);assert.equal(state.selected.vault,a);assert.equal(state.selected.transport,'attempts-v1');assert.deepEqual(state.bindings.map(x=>x.vault),[b,a]);
  assert.equal(state.installation,before.device.installation);assert.deepEqual(f.registry.device.anchor(b),before.anchor);
  const current=JSON.parse(await fs.readFile(path.join(root,'app-local.json')))[pluginId+':sync-v2:device'];assert.equal(current.secret,before.device.secret);assert.deepEqual(current.anchors,before.device.anchors);
  assert.deepEqual(await tree(path.join(root,'private')),before.files);assert.deepEqual(await fs.readdir(path.join(root,'shared')),[]);
  await f.registry.close();checks.push({point,pass:true,installationUnchanged:true,priorAnchorUnchanged:true,priorPrivateFilesUnchanged:true,noSharedFiles:true});
 }
 const result={pass:true,out,checks,processExits:checks.length,scope:'Real process exits and files; file-backed App contract and injected Web Locks, not native Obsidian, Nutstore, iPad or power loss.'};
 await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
