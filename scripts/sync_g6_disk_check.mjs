// New G6 real-file/process-exit cases; App and Web Locks remain contract fakes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import sync from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';
import {createLayoutStore} from '../dist/graph-core.mjs';
import {fixture,layout,model} from './sync-auto-publish-test-helpers.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';
import {testLockManager} from './sync-host-test-helpers.mjs';
import {validateTestSettings} from './sync-settings-test-helpers.mjs';
import {syncContentHash} from '../src/sync/persistence-prototype.mjs';
const base=path.resolve('.local/sync-016/g6'),left=await layout(-20),right=await layout(30),backupId='1'.repeat(32),pluginId='g6-disk';
async function open(root,point){
 let armed=false,h;const file=path.join(root,'app.json'),load=()=>JSON.parse(sync.readFileSync(file,'utf8'));
 const app={loadLocalStorage:key=>load()[key]??null,saveLocalStorage(key,value){const all=load();all[key]=value;sync.writeFileSync(file,JSON.stringify(all));}};
 const transport=await fixture({root}),destination={...createNodeSyncStore(path.join(root,'backup')),location:'Synthetic Backup'};
 h=await createUnifiedSyncHost({app,pluginId,adapter:transport.adapter,locks:testLockManager(),readSource:async()=>JSON.parse(await fs.readFile(path.join(root,'source.json'),'utf8')),saveUnjoined:async data=>fs.writeFile(path.join(root,'source.json'),JSON.stringify(data)),createStore:createLayoutStore,validateSettings:validateTestSettings,getGraph:()=>({isCurrent:()=>true,hidden:false,createModel:model}),getEpoch:()=>0,openBackend:async({vault})=>createNodeSyncStore(path.join(root,'ledger',vault)),checkpoint:async step=>{if(armed&&step===point){sync.writeFileSync(path.join(root,'before-exit.json'),JSON.stringify(h.state()));process.exit(86);}}});
 return {h,destination,arm:()=>armed=true,close:async()=>{await h.close();await transport.close();}};
}
async function snapshot(root,vault){const dir=path.join(root,'shared','Knowledge Map Sync/attempts-v1',vault,'ops'),out={};for(const n of await fs.readdir(dir))out[n]=await syncContentHash(await fs.readFile(path.join(dir,n),'utf8'));return out;}
if(process.argv[2]==='--crash'){
 const root=path.resolve(process.argv[3]),relative=path.relative(base,root);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));const f=await open(root,process.argv[4]);
 const p=await f.h.previewSelection({action:'new'});await f.h.confirmSelection(p.token);const j=await f.h.previewJoin();await f.h.confirmJoin(j.token,'import');await f.h.saveLayout(right);await f.h.settled();
 await f.h.exportRecovery({destination:f.destination,id:backupId});const r=await f.h.previewRotation({destination:f.destination,id:backupId,choice:'accepted'});await fs.writeFile(path.join(root,'old-files.json'),JSON.stringify(await snapshot(root,r.from)));f.arm();await f.h.confirmRotation(r.token);throw Error('missing-checkpoint');
}else{
 await fs.mkdir(base,{recursive:true});const out=await fs.mkdtemp(path.join(base,'disk-')),checks=[];
 for(const point of ['rotation:after-intent','rotation:after-disable','selection:after-selection-connect','rotation:after-selection','after-join-choice','after-intent','after-publication','rotation:after-root']){
  const root=await fs.mkdtemp(path.join(out,'case-'));await fs.writeFile(path.join(root,'app.json'),'{}');await fs.writeFile(path.join(root,'source.json'),JSON.stringify({settings:{language:'zh'},ui:{keep:'yes'},unknown:42,layoutOverrides:left}));
  const child=spawnSync(process.execPath,[process.argv[1],'--crash',root,point],{encoding:'utf8'});assert.equal(child.status,86,child.stderr);
  const before=JSON.parse(await fs.readFile(path.join(root,'before-exit.json'),'utf8')),intent=before.rotationPending,old=JSON.parse(await fs.readFile(path.join(root,'old-files.json'),'utf8')),f=await open(root);
  assert.equal(f.h.state().installation,before.installation);assert.equal(f.h.state().rotationPending.target,intent.target);assert.deepEqual(await snapshot(root,intent.from),old);
  const r=await f.h.previewRotationResume({destination:f.destination});assert.equal((await f.h.confirmRotation(r.token)).kind,'rotated');assert.equal(f.h.state().session.accepted.operations[0].id,intent.rootId);assert.deepEqual(f.h.state().session.accepted.snapshot.groups,right.groups);assert.deepEqual(await snapshot(root,intent.from),old);await f.close();checks.push({point,pass:true,target:intent.target,rootId:intent.rootId});
 }
 const result={pass:true,out,checks,processExits:checks.length,scope:'Actual Node files, fsync/no-replace backup, signed state and eight abrupt process exits. App/locks synthetic; not native/iPad/OS disk-full/power loss.'};await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
