// U5-FB1 technical regression. Real private/shared files and reviewed host APIs.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';
import {createLayoutStore} from '../dist/graph-core.mjs';
import {fixture,layout,model,empty} from './sync-auto-publish-test-helpers.mjs';
import {testLocalApp,testLockManager} from './sync-host-test-helpers.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';
import {validateTestSettings} from './sync-settings-test-helpers.mjs';
import {startObsidianLayoutReceiver} from '../src/sync/obsidian-layout-receiver.mjs';
const base=path.resolve('.local/sync-016/unified/u5');await fs.mkdir(base,{recursive:true});
const out=await fs.mkdtemp(path.join(base,'incomplete-restore-'));
const initial=await layout(-20),local=await layout(20),remote=await layout(40);
async function device(role,dir,seed){
 const transport=await fixture({root:dir}),app=testLocalApp();let source={settings:{language:'zh'},layoutOverrides:seed},hook=async()=>{};
 const options={app,pluginId:'incomplete-restore-repro',adapter:transport.adapter,locks:testLockManager(),readSource:async()=>structuredClone(source),saveUnjoined:async d=>source=structuredClone(d),createStore:createLayoutStore,validateSettings:validateTestSettings,
  checkpoint:step=>hook(step),openBackend:async({vault})=>createNodeSyncStore(path.join(dir,'host-private',vault)),getGraph:()=>({isCurrent:()=>true,hidden:false,createModel:model}),getEpoch:()=>0};
 let h=await createUnifiedSyncHost(options);
 return {role,dir,transport,hook:fn=>hook=fn,get h(){return h;},async reopen(){await h.close();h=await createUnifiedSyncHost(options);},async close(){await h.close();await transport.close();}};
}
async function inventory(d){const root=path.join(d.dir,'shared'),entries=await fs.readdir(root,{recursive:true,withFileTypes:true}),result={};for(const e of entries)if(e.isFile()){const f=path.join(e.parentPath,e.name);result[path.relative(root,f)]=await fs.readFile(f,'utf8');}return result;}
async function deliver(a,b){for(const [name,body]of Object.entries(await inventory(a))){const target=path.join(b.dir,'shared',name);await fs.mkdir(path.dirname(target),{recursive:true});try{assert.equal(await fs.readFile(target,'utf8'),body);}catch(e){if(e.code!=='ENOENT')throw e;await fs.writeFile(target,body);}}}
const snapshot=d=>({status:d.h.state().status,accepted:d.h.state().session?.accepted,draft:d.h.state().session?.localState?.layoutDraft,queue:d.h.state().publication,view:d.h.store.state()});
async function attempt(fn){try{return await fn();}catch(e){return {kind:'thrown',reason:e.message};}}
async function checkReceive(d){
 const signals={addEventListener(){},removeEventListener(){}},selected=d.h.state().selected;
 const receiver=startObsidianLayoutReceiver({vault:{on:()=>({}),offref(){}},logicalVault:selected.vault,attemptDirectory:'Knowledge Map Sync/attempts-v1/'+selected.vault+'/ops',win:{...signals,document:{...signals,hidden:false},setTimeout:()=>0,clearTimeout(){}},layoutStore:d.h.store,getGraph:()=>({isCurrent:()=>true,createModel:model}),readLocal:()=>d.h.state().session,receive:options=>d.h.receive(options),report(){}});
 try{return await receiver.check();}finally{await receiver.close();}
}
const results=[];
for(const [peerEdits,interruption] of [[false,null],[true,null],[true,'after-stage'],[true,'partial-write']]){
 const dir=path.join(out,peerEdits?'remote-'+(interruption??'normal'):'control'),a=await device('PC',path.join(dir,'PC'),initial),b=await device('peer',path.join(dir,'peer'),empty),events=[];
 try{
  const s=await a.h.previewSelection({action:'new'});await a.h.confirmSelection(s.token);const j=await a.h.previewJoin();await a.h.confirmJoin(j.token,'import');await deliver(a,b);
  const chosen=await b.h.previewSelection({action:'join',...a.h.state().selected});await b.h.confirmSelection(chosen.token);const bj=await b.h.previewJoin();await b.h.confirmJoin(bj.token,'shared');
  await a.h.disable();await a.h.saveLayout(local);const draft=a.h.state().session.localState.layoutDraft;await a.reopen();await a.h.graphReady();await a.h.enable();
  const cancel=await a.h.previewPublication();assert.equal(cancel.kind,'publication-review',JSON.stringify(cancel));a.h.discardReview(cancel.token);await a.h.settled();
  assert.equal(a.h.state().session.accepted.operations.length,1);assert.equal(a.h.state().session.localState.layoutDraft.id,draft.id);events.push({step:'canceled-restore',PC:snapshot(a)});
  if(peerEdits){
   const stale=await a.h.previewPublication(),unchangedDraft=a.h.state().session.localState.layoutDraft;
   await b.h.saveLayout(remote);await b.h.settled();assert.equal(b.h.state().session.accepted.operations.length,2);await deliver(b,a);
   const inventoryBefore=await inventory(a);assert.equal((await a.h.confirmPublication(stale.token)).reason,'shared-scan-changed');assert.deepEqual(await inventory(a),inventoryBefore);assert.deepEqual(a.h.state().session.localState.layoutDraft,unchangedDraft);
   const receive=await checkReceive(a);events.push({step:'peer-delivered-and-receive',result:receive.kind,reason:receive.reason,PC:snapshot(a),peer:snapshot(b)});
   assert.equal(a.h.state().session.accepted.operations.length,1);assert.deepEqual(a.h.state().session.localState.layoutDraft,draft);
   const pcConflict=await attempt(()=>a.h.previewConflict()),peerConflict=await attempt(()=>b.h.previewConflict());
   assert.equal(pcConflict.reason,'local-layout-review-required');assert.equal(peerConflict.reason,'no-shared-conflict');events.push({step:'conflict-preview',PC:pcConflict,peer:peerConflict});
  }
  const before=await inventory(a),review=await a.h.previewPublication();assert.equal(review.kind,'publication-review');
  if(interruption){let once=true;a.hook(async step=>{if(once&&step===(interruption==='partial-write'?'after-publication':interruption)){once=false;
   if(interruption==='partial-write'){const pending=a.h.state().session.pending,files=await inventory(a),name=Object.keys(files).find(n=>n.includes('/'+pending.id+'.'));assert.ok(name);await fs.writeFile(path.join(a.dir,'shared',name),files[name].slice(0,12));}
   throw Error('simulated-interruption');}});}
  let confirmed=await attempt(()=>a.h.confirmPublication(review.token));await a.h.settled();
  if(interruption){assert.equal(confirmed.kind,'thrown');const id=a.h.state().session.pending.id;await a.reopen();await a.h.graphReady();assert.equal(a.h.state().session.pending.id,id);assert.ok(a.h.state().session.localState.layoutDraft);const resumed=await a.h.previewPublication();assert.equal(resumed.kind,'publication-review',JSON.stringify(resumed));confirmed=await a.h.confirmPublication(resumed.token);assert.equal(a.h.state().session.accepted.operations.at(-1).id,id);}
  if(peerEdits){
   assert.equal(review.competition,true);assert.ok(review.shared);
   assert.ok(confirmed.kind.startsWith('accepted'));assert.equal(confirmed.sharedStatus,'conflict');
   assert.equal(a.h.state().session.localState.layoutDraft,null);assert.equal(a.h.state().session.pending,null);
   const branch=await inventory(a);for(const [k,v]of Object.entries(before))assert.equal(branch[k],v);
   await a.reopen();await a.h.graphReady();assert.equal(a.h.state().session.accepted.operations.length,2);
   const conflict=await a.h.previewConflict();assert.equal(conflict.kind,'review');a.h.discardReview(conflict.token);assert.deepEqual(await inventory(a),branch);
   const fresh=await a.h.previewConflict();assert.ok((await a.h.confirmConflict(fresh.token,fresh.choices[0].id)).kind.startsWith('accepted'));
   await deliver(a,b);await checkReceive(b);assert.deepEqual(a.h.state().session.accepted.snapshot.groups,b.h.state().session.accepted.snapshot.groups);
   assert.equal(a.h.state().session.accepted.operations.length,4);for(const [k,v]of Object.entries(before))assert.equal((await inventory(a))[k],v);
  }
  else{assert.ok(confirmed.kind.startsWith('accepted'));assert.equal(a.h.state().session.accepted.operations.length,2);assert.equal(a.h.state().session.localState.layoutDraft,null);}
  events.push({step:'fresh-explicit-confirmation',result:{kind:confirmed.kind,reason:confirmed.reason??null},PC:snapshot(a),peer:snapshot(b)});
  results.push({peerEdits,observed:true,events});
 }finally{await a.close();await b.close();}
}
await fs.writeFile(path.join(out,'reproduction.json'),JSON.stringify({date:'2026-11-15',scope:'Diagnostic only: real Node shared/private files, host close/reopen; App/device backing and graph contracts are test adapters. No native/Nutstore/iPad acceptance.',results},null,2));
console.log(JSON.stringify({out,pass:true,checks:['cancel retains draft','late remote expires consent without a write','no shared conflict has a normal result','explicit branch publication clears only proved draft','cold reopen retains branch without duplicate publication','canceled conflict preserves files','confirmed conflict converges both devices'],observations:results.map(r=>({peerEdits:r.peerEdits,result:r.events.at(-1).result})),scope:'Real files; injected App/graph/locks, not native or iPad acceptance.'}));
