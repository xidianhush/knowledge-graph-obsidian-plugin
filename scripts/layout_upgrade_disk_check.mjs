import fs from 'node:fs/promises';
import syncFs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';
import {createLayoutModel,createLayoutStore} from '../dist/graph-core.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';
import {verifyRecoveryExport} from '../src/sync/recovery-export.mjs';
import {testLockManager} from './sync-host-test-helpers.mjs';
import {validateTestSettings} from './sync-settings-test-helpers.mjs';
const BASE=path.resolve('.local/layout-upgrade/disk');await fs.mkdir(BASE,{recursive:true});
const nodes=()=>[{id:'P',kind:'folder',x:0,y:0,r:100,depth:1},{id:'P/A',path:'P/A.md',parent:'P',kind:'note',x:-25,y:0,r:20,depth:2},{id:'P/B',path:'P/B.md',parent:'P',kind:'note',x:25,y:0,r:20,depth:2}];
const model=()=>createLayoutModel(nodes(),200);
function layout(y){const g=nodes(),m=createLayoutModel(g,200);g[1].y=y;g[2].y=y;const k=m.groupKey('P/A');return {schemaVersion:3,revision:1,groups:{[k]:m.capture(k)},structures:{}};}
const original={settings:{language:'zh'},ui:{keep:'yes'},unknown:42,layoutOverrides:layout(15)},restored={layoutOverrides:layout(-15)},backupId='b'.repeat(32);
async function open(root,point){
 assert.ok(root.startsWith(BASE+path.sep));await fs.mkdir(root,{recursive:true});
 const config=path.join(root,'config.json'),appFile=path.join(root,'app.json'),transport=path.join(root,'shared');await fs.mkdir(transport,{recursive:true});
 if(!syncFs.existsSync(config))await fs.writeFile(config,JSON.stringify(original));
 let entries=syncFs.existsSync(appFile)?JSON.parse(syncFs.readFileSync(appFile,'utf8')):{};
 const app={loadLocalStorage:k=>structuredClone(entries[k]??null),saveLocalStorage(k,v){entries[k]=v;syncFs.writeFileSync(appFile,JSON.stringify(entries));}};
 const adapter={async stat(p){try{const s=await fs.stat(path.join(transport,p));return {type:s.isDirectory()?'folder':'file',size:s.size};}catch(e){if(e.code==='ENOENT')return null;throw e;}},async list(p){const rows=await fs.readdir(path.join(transport,p),{withFileTypes:true});return {files:rows.filter(r=>r.isFile()).map(r=>p+'/'+r.name),folders:rows.filter(r=>r.isDirectory()).map(r=>p+'/'+r.name)};},mkdir:p=>fs.mkdir(path.join(transport,p)),async readBinary(p){return Uint8Array.from(await fs.readFile(path.join(transport,p))).buffer;},async writeBinary(p,b){await fs.writeFile(path.join(transport,p),Buffer.from(b));}};
 let active=false;
 const host=await createUnifiedSyncHost({app,pluginId:'upgrade-disk',adapter,locks:testLockManager(),readSource:async()=>JSON.parse(await fs.readFile(config,'utf8')),saveUnjoined:async(data,{expected})=>{assert.deepEqual(JSON.parse(await fs.readFile(config,'utf8')),expected);await fs.writeFile(config,JSON.stringify(data));},createStore:createLayoutStore,validateSettings:validateTestSettings,openBackend:async({vault})=>createNodeSyncStore(path.join(root,'private',vault)),getGraph:()=>({hidden:false,isCurrent:()=>true,createModel:model}),getEpoch:()=>0,checkpoint:async step=>{if(active&&step===point)process.exit(86);}});
 const destination={...createNodeSyncStore(path.join(root,'backups'),{onStep:async step=>{if(active&&point==='backup-partial'&&step==='temp-partial')process.exit(86);}}),location:'Synthetic Backups'};
 return {host,destination,arm:()=>active=true,config};
}
if(process.argv[2]==='--crash'){
 const root=path.resolve(process.argv[3]),h=await open(root,process.argv[4]);
 const p=await h.host.previewSelection({action:'new'});await h.host.confirmSelection(p.token);const j=await h.host.previewJoin();await h.host.confirmJoin(j.token,'import');
 const r=await h.host.previewHistoricalRestore({readBackup:async()=>restored});h.arm();await h.host.confirmHistoricalRestore(r.token,{groups:Object.keys(restored.layoutOverrides.groups),destination:h.destination,backupId});throw Error('Expected process exit');
}else{
 const out=await fs.mkdtemp(path.join(BASE,'run-')),checks=[];
 for(const point of ['backup-partial','historical:after-backup','historical:after-draft']){
  const root=await fs.mkdtemp(path.join(out,'case-')),child=spawnSync(process.execPath,[process.argv[1],'--crash',root,point],{encoding:'utf8'});assert.equal(child.status,86,child.stderr);
  const h=await open(root),s=h.host.state().session;assert.equal(s.accepted.operations.length,1);assert.deepEqual(s.accepted.snapshot.groups,original.layoutOverrides.groups);assert.deepEqual(JSON.parse(await fs.readFile(h.config,'utf8')),original);
  if(point==='historical:after-draft'){
   assert.deepEqual(s.localState.layoutDraft.value.groups,restored.layoutOverrides.groups);assert.equal(s.localState.settingsDraft,null);await h.host.settled();assert.equal(h.host.state().session.accepted.operations.length,1);
   const p=await h.host.previewPublication();assert.equal(p.kind,'publication-review');await h.host.confirmPublication(p.token);assert.equal(h.host.state().session.accepted.operations.length,2);
  }else assert.equal(s.localState?.layoutDraft??null,null);
  if(point!=='backup-partial'){const verified=await verifyRecoveryExport({source:h.destination,id:backupId});assert.deepEqual(verified.contents.get('accepted.json').groups,original.layoutOverrides.groups);}
  await h.host.close();const cold=await open(root);assert.equal(cold.host.state().session.accepted.operations.length,point==='historical:after-draft'?2:1);await cold.host.close();checks.push('Process exit '+point+': original data, acceptance and publication gate retained');
 }
 const result={pass:true,checks,out,scope:'Synthetic filesystem, real process exits and cold host reopen; no daily vault or iPad'};await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
