// Actual files/process exits; synthetic App/Web Locks and graph contracts.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import sync from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';import {createLayoutStore} from '../dist/graph-core.mjs';import {fixture,layout,model} from './sync-auto-publish-test-helpers.mjs';import {createNodeSyncStore} from './sync-node-store.mjs';import {testLockManager} from './sync-host-test-helpers.mjs';import {validateTestSettings} from './sync-settings-test-helpers.mjs';import {createAttemptHistory} from '../src/sync/attempt-history-prototype.mjs';
const base=path.resolve('.local/sync-016/g5'),pluginId='g5-disk';
function scoped(root){const rel=path.relative(base,path.resolve(root));assert.ok(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel));return path.resolve(root);}
async function open(root){root=scoped(root);const io=await fixture({root}),app={loadLocalStorage:k=>JSON.parse(sync.readFileSync(path.join(root,'app.json'),'utf8'))[k]??null,saveLocalStorage(k,v){const p=path.join(root,'app.json'),data=JSON.parse(sync.readFileSync(p,'utf8'));data[k]=v;sync.writeFileSync(p,JSON.stringify(data));}};
 const h=await createUnifiedSyncHost({app,pluginId,adapter:io.adapter,locks:testLockManager(),readSource:async()=>JSON.parse(await fs.readFile(path.join(root,'source.json'),'utf8')),saveUnjoined:async v=>fs.writeFile(path.join(root,'source.json'),JSON.stringify(v)),createStore:createLayoutStore,validateSettings:validateTestSettings,getGraph:()=>({isCurrent:()=>true,hidden:false,createModel:model}),getEpoch:()=>0,openBackend:async({vault})=>createNodeSyncStore(path.join(root,'ledger',vault))});
 return {h,io,async close(){await h.close();await io.close();}};}
if(process.argv[2]==='--child'){
 const root=scoped(process.argv[3]),phase=process.argv[4],f=await open(root);
 if(phase==='quarantine'){
  const s=await f.h.previewSelection({action:'new'});await f.h.confirmSelection(s.token);const j=await f.h.previewJoin();await f.h.confirmJoin(j.token,'import');
  const history=createAttemptHistory(f.io.adapter,f.h.state().selected.vault),op=structuredClone((await history.scan()).records[0]);op.changes[0].value.points[0].x+=.01;const body=JSON.stringify(op),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body))),b=>b.toString(16).padStart(2,'0')).join(''),name=await history.allocate(op.id,hash,[]);await history.write(name,body);assert.equal((await f.h.receive()).reason,'attempt-conflict-review');
  sync.writeFileSync(path.join(root,'fault.json'),JSON.stringify({name,body,accepted:f.h.state().session.accepted,installation:f.h.state().installation}));process.exit(86);
 }else{
  const p=await f.h.previewSharedRecovery();assert.equal(p.kind,'shared-recovery-review');assert.equal((await f.h.confirmSharedRecovery(p.token)).kind,'recovered');process.exit(87);
 }
}else{
 await fs.mkdir(base,{recursive:true});const out=await fs.mkdtemp(path.join(base,'disk-'));await fs.writeFile(path.join(out,'app.json'),'{}');await fs.writeFile(path.join(out,'source.json'),JSON.stringify({settings:{language:'zh'},pipeline:{},layoutOverrides:await layout(-20)}));
 const run=(phase,code)=>{const child=spawnSync(process.execPath,[process.argv[1],'--child',out,phase],{encoding:'utf8'});assert.equal(child.status,code,child.stderr||child.stdout);};run('quarantine',86);
 const fault=JSON.parse(await fs.readFile(path.join(out,'fault.json'),'utf8'));let f=await open(out);assert.ok(f.h.state().session.attemptConflict);assert.equal((await f.h.receive()).reason,'attempt-conflict-review');await f.close();
 const from=path.resolve(out,'shared',fault.name),backup=path.resolve(out,'backed-up-conflicting-attempt.json');assert.ok(from.startsWith(out+path.sep)&&backup.startsWith(out+path.sep));await fs.rename(from,backup);assert.equal(await fs.readFile(backup,'utf8'),fault.body);
 f=await open(out);const before=f.h.state().session.sequence,p=await f.h.previewSharedRecovery();f.h.discardReview(p.token);assert.equal(f.h.state().session.sequence,before);assert.ok(f.h.state().session.attemptConflict);await f.close();run('recover',87);
 f=await open(out);assert.equal(f.h.state().session.attemptConflict,null);assert.equal(f.h.state().installation,fault.installation);assert.deepEqual(f.h.state().session.accepted,fault.accepted);assert.equal((await f.h.receive()).kind,'noop');assert.equal(await fs.readFile(backup,'utf8'),fault.body);await f.close();
 const result={pass:true,out,processExits:2,checks:['Quarantine survives an unclean process exit','Moving conflicting bytes to a checked backup path does not clear local quarantine','Preview cancellation performs no recovery journal write','Confirmed recovery survives immediate process exit; accepted receipt/identity/original backup unchanged'],scope:'Real Node files, device-signed journal and two process exits; App/locks/graph adapters, not Obsidian/Nutstore/iPad/power loss.'};await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
