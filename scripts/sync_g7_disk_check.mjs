// Actual process exits around compatibility output; no user/accepted vaults.
import fs from 'node:fs/promises';import sync from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';
import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';import {readCompatibilityExport} from '../src/sync/local-work-prototype.mjs';
import {createLayoutStore} from '../dist/graph-core.mjs';import {fixture,layout,model} from './sync-auto-publish-test-helpers.mjs';import {createNodeSyncStore} from './sync-node-store.mjs';import {testLockManager} from './sync-host-test-helpers.mjs';import {validateTestSettings} from './sync-settings-test-helpers.mjs';
const base=path.resolve('.local/sync-016/g7'),backupId='1'.repeat(32),left=await layout(-20),right=await layout(75);
async function open(root,point){
 let h,armed=false,exportId;const localFile=path.join(root,'app.json'),load=()=>JSON.parse(sync.readFileSync(localFile,'utf8'));
 const app={loadLocalStorage:k=>load()[k]??null,saveLocalStorage(k,v){const all=load();all[k]=v;sync.writeFileSync(localFile,JSON.stringify(all));}};
 const transport=await fixture({root}),store=createNodeSyncStore(path.join(root,'backup'));
 const destination={...store,location:'Synthetic G7 Backup',async create(name,raw){const r=await store.create(name,raw);if(armed&&name===exportId+'/'+point){sync.writeFileSync(path.join(root,'before-exit.json'),JSON.stringify({state:h.state(),exportId}));process.exit(86);}return r;}};
 h=await createUnifiedSyncHost({app,pluginId:'g7-disk',adapter:transport.adapter,locks:testLockManager(),readSource:async()=>JSON.parse(await fs.readFile(path.join(root,'source.json'),'utf8')),saveUnjoined:async data=>fs.writeFile(path.join(root,'source.json'),JSON.stringify(data)),createStore:createLayoutStore,validateSettings:validateTestSettings,getGraph:()=>({isCurrent:()=>true,hidden:false,createModel:model}),getEpoch:()=>0,openBackend:async({vault})=>createNodeSyncStore(path.join(root,'ledger',vault))});
 return {h,destination,arm:id=>{armed=true;exportId=id;},close:async()=>{await h.close();await transport.close();}};
}
if(process.argv[2]==='--crash'){
 const root=path.resolve(process.argv[3]),rel=path.relative(base,root);assert.ok(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel));const f=await open(root,process.argv[4]);
 const p=await f.h.previewSelection({action:'new'});await f.h.confirmSelection(p.token);const j=await f.h.previewJoin();await f.h.confirmJoin(j.token,'import');await f.h.disable();await f.h.saveLayout(right);await f.h.exportRecovery({destination:f.destination,id:backupId});const review=await f.h.previewRollback({destination:f.destination,id:backupId,choice:'draft'});f.arm(review.exportId);await f.h.confirmRollback(review.token);throw Error('Missing abrupt exit');
}else{
 await fs.mkdir(base,{recursive:true});const out=await fs.mkdtemp(path.join(base,'disk-')),checks=[];
 for(const point of ['data.json','manifest.json']){
  const root=await fs.mkdtemp(path.join(out,'case-'));await fs.writeFile(path.join(root,'app.json'),'{}');await fs.writeFile(path.join(root,'source.json'),JSON.stringify({settings:{language:'zh'},ui:{keep:'yes'},unknown:71,layoutOverrides:left}));
  const child=spawnSync(process.execPath,[process.argv[1],'--crash',root,point],{encoding:'utf8'});assert.equal(child.status,86,child.stderr);
  const before=JSON.parse(await fs.readFile(path.join(root,'before-exit.json'),'utf8')),f=await open(root);assert.equal(f.h.state().installation,before.state.installation);assert.deepEqual(f.h.state().selected,before.state.selected);assert.deepEqual(f.h.state().session,before.state.session);assert.equal(f.h.state().status,'local-ready');
  if(point==='data.json')await assert.rejects(()=>readCompatibilityExport({source:f.destination,id:before.exportId}),/incomplete-export/);else assert.deepEqual((await readCompatibilityExport({source:f.destination,id:before.exportId})).layoutOverrides,right);
  const p=await f.h.previewRollback({destination:f.destination,id:backupId,choice:'draft'});assert.notEqual(p.exportId,before.exportId);assert.equal((await f.h.confirmRollback(p.token)).kind,'compatibility-exported');assert.deepEqual((await readCompatibilityExport({source:f.destination,id:p.exportId})).layoutOverrides,right);assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,'source.json'),'utf8')).layoutOverrides,left);await f.close();checks.push({point,pass:true});
 }
 const result={pass:true,out,checks,processExits:checks.length,scope:'Real signed files/no-replace output and two abrupt Node exits; fake App/locks, not real Obsidian/iPad/OS disk-full or power loss'};await fs.writeFile(out+'/summary.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
