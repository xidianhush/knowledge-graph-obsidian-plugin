import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';
import {createLayoutStore} from '../dist/graph-core.mjs';
import {fixture,layout,model} from './sync-auto-publish-test-helpers.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';
import {testLockManager} from './sync-host-test-helpers.mjs';
import {validateTestSettings} from './sync-settings-test-helpers.mjs';
const base=path.resolve('.local/sync-016/unified/u3'),left=await layout(-20),right=await layout(20),pluginId='unified-disk';
async function open(root,point){
 let armed=false,h;const at=()=>JSON.parse(fsSync.readFileSync(path.join(root,'app.json'),'utf8'));
 const app={loadLocalStorage:key=>at()[key]??null,saveLocalStorage(key,value){const values=at();values[key]=value;fsSync.writeFileSync(path.join(root,'app.json'),JSON.stringify(values));}};
 const exit=()=>{fsSync.writeFileSync(path.join(root,'before-exit.json'),JSON.stringify(h.state()));process.exit(86);};
 const transport=await fixture({root,write:async(name,bytes)=>{if(armed&&point==='shared-partial'){fsSync.writeFileSync(path.join(root,'shared',name),new Uint8Array(bytes).slice(0,120));exit();}}});
 h=await createUnifiedSyncHost({app,pluginId,adapter:transport.adapter,locks:testLockManager(),readSource:async()=>JSON.parse(await fs.readFile(path.join(root,'source.json'),'utf8')),
  saveUnjoined:async data=>fs.writeFile(path.join(root,'source.json'),JSON.stringify(data)),createStore:createLayoutStore,validateSettings:validateTestSettings,getGraph:()=>({isCurrent:()=>true,hidden:false,createModel:model}),getEpoch:()=>0,
  openBackend:async({vault})=>createNodeSyncStore(path.join(root,'ledger',vault)),checkpoint:async step=>{if(armed&&step===point)exit();}});
 return {h,app,arm:()=>armed=true,close:async()=>{await h.close();await transport.close();}};
}
if(process.argv[2]==='--crash'){
 const root=path.resolve(process.argv[3]),point=process.argv[4],relative=path.relative(base,root);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
 const f=await open(root,point),selection=await f.h.previewSelection({action:'new'});await f.h.confirmSelection(selection.token);const preview=await f.h.previewJoin();assert.equal((await f.h.confirmJoin(preview.token,'import')).kind,'joined');
 f.arm();if(point.startsWith('lifecycle:'))await f.h.disable();else{await f.h.saveLayout(right);await f.h.settled();}throw Error('checkpoint absent '+point);
}else{
 await fs.mkdir(base,{recursive:true});const out=await fs.mkdtemp(path.join(base,'disk-')),checks=[];
 for(const point of ['after-local-state','after-stage','after-attempt-path','shared-partial','after-publication','after-accept','lifecycle:after-transition-intent','lifecycle:after-bundle-close']){
  const root=await fs.mkdtemp(path.join(out,'case-'));await fs.writeFile(path.join(root,'app.json'),'{}');await fs.writeFile(path.join(root,'source.json'),JSON.stringify({settings:{language:'zh'},ui:{keep:'yes'},unknown:42,layoutOverrides:left}));
  const child=spawnSync(process.execPath,[process.argv[1],'--crash',root,point],{encoding:'utf8'});assert.equal(child.status,86,child.stderr);
  const before=JSON.parse(await fs.readFile(path.join(root,'before-exit.json'),'utf8')),appBefore=JSON.parse(await fs.readFile(path.join(root,'app.json'),'utf8'))[pluginId+':sync-v2:device'];
  const f=await open(root),initial=f.h.state();assert.equal(initial.installation,before.installation);assert.equal(initial.selected.vault,before.selected.vault);assert.equal(initial.session.accepted.operations.length,point==='after-accept'?2:1);
  const current=f.app.loadLocalStorage(pluginId+':sync-v2:device');assert.equal(current.secret,appBefore.secret);
  await f.h.settled();assert.equal(f.h.state().session.accepted.operations.length,initial.session.accepted.operations.length);
  if(point.startsWith('lifecycle:')){assert.equal(initial.status,'local-ready');await f.h.saveLayout(right);await f.h.enable();assert.equal(f.h.state().session.accepted.operations.length,1);}
  await f.h.resumePublication({confirmed:true});await f.h.settled();const final=f.h.state();assert.equal(final.session.pending,null);assert.equal(final.session.localState.layoutDraft,null);assert.equal(final.session.accepted.operations.length,2);assert.deepEqual(final.session.accepted.snapshot.groups,right.groups);
  const effective=await f.h.effective();assert.equal(effective.unknown,42);assert.equal(effective.ui.keep,'yes');await f.close();checks.push({point,pass:true,installation:initial.installation,vault:initial.selected.vault,acceptedIds:final.session.accepted.appliedIds});
 }
 const result={pass:true,out,checks,processExits:checks.length,scope:'Real files, signed registry/device/session and process exits; App and Web Locks contract adapters, not native Obsidian/Nutstore/iPad/power loss.'};await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
