import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {model,layout,id} from './sync-auto-publish-test-helpers.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';
import {createAttemptHistory} from '../src/sync/attempt-history-prototype.mjs';
import {createDurableSyncSession} from '../src/sync/persistence-prototype.mjs';
import {normalizeJoinLayout,projectCurrentJoinLayout} from '../src/sync/layout-prototype.mjs';
const base=path.resolve('.local/current-join-disk'),vault='a'.repeat(32),valid=await layout(-20),old='["note","Synthetic/Gone.md",""]',mixed=structuredClone(valid);
mixed.groups[old]=structuredClone(Object.values(valid.groups)[0]);mixed.groups[old].note=old;
const source={settings:{language:'zh'},ui:{keep:'original'},unknown:{preserve:42},layoutOverrides:mixed};
async function open(root,{point=null,start=1}={}){
 const shared=path.join(root,'shared');await fs.mkdir(shared,{recursive:true});
 const at=p=>path.join(shared,p);
 const adapter={async stat(p){try{const s=await fs.stat(at(p));return {type:s.isDirectory()?'folder':'file',size:s.size};}catch(e){if(e.code==='ENOENT')return null;throw e;}},async list(p){const rows=await fs.readdir(at(p),{withFileTypes:true});return {files:rows.filter(r=>r.isFile()).map(r=>p+'/'+r.name),folders:rows.filter(r=>r.isDirectory()).map(r=>p+'/'+r.name)};},mkdir:p=>fs.mkdir(at(p)),async readBinary(p){return Uint8Array.from(await fs.readFile(at(p))).buffer;},async writeBinary(p,b){if(point==='partial'){await fs.writeFile(at(p),Buffer.from(b).subarray(0,20));process.exit(86);}await fs.writeFile(at(p),Buffer.from(b));}};
 const history=createAttemptHistory(adapter,vault);let n=start;
 const session=createDurableSyncSession({privateStore:createNodeSyncStore(path.join(root,'private')),attemptHistory:history,vault,installation:'b'.repeat(32),createModel:model,normalizeLocalLayout:raw=>normalizeJoinLayout(raw,model),projectLocalLayout:raw=>projectCurrentJoinLayout(raw,model),readLocalData:()=>structuredClone(source),nextId:()=>id(n++),checkpoint:async step=>{if(step===point)process.exit(86);}});await session.open();return {session,history};
}
async function join(h){const p=await h.session.previewJoin({localData:source});assert.equal(p.kind,'join-preview',JSON.stringify(p));assert.equal(p.canCurrent,true);return h.session.join({localData:source,choice:'current',expectedSharedFingerprint:p.fingerprint,expectedCurrentFingerprint:p.currentFingerprint});}
await fs.mkdir(base,{recursive:true});
if(process.argv[2]==='--crash'){
 const root=path.resolve(process.argv[3]);assert.ok(root.startsWith(base+path.sep));const h=await open(root,{point:process.argv[4]});await join(h);throw Error('Expected process exit');
}else{
 const out=await fs.mkdtemp(path.join(base,'run-')),checks=[];
 for(const point of ['after-join-backup','after-join-choice','after-attempt-path','partial','after-publication','after-accept']){
  const root=await fs.mkdtemp(path.join(out,'case-')),child=spawnSync(process.execPath,[process.argv[1],'--crash',root,point],{encoding:'utf8'});assert.equal(child.status,86,child.stderr);
  const h=await open(root,{start:999}),before=h.session.state(),pendingId=before.joining?.id;
  if(!before.initialized)assert.match((await join(h)).kind,/^imported/);
  assert.equal(h.session.state().joining.reason,'current-layout');assert.deepEqual(h.session.state().accepted.snapshot,valid);assert.deepEqual(h.session.getJoinBackup(),source);
  const proof=h.session.getJoinProof();if(pendingId)assert.equal(proof.importReceipt.operation.id,pendingId);assert.equal((await h.history.scan()).canonicalFiles.size,1);await h.session.close();
  const cold=await open(root);assert.deepEqual(cold.session.getJoinBackup(),source);assert.deepEqual(cold.session.state().accepted.snapshot,valid);await cold.session.close();checks.push('Current-mode stable-ID and full original backup recovery after '+point);
 }
 const result={pass:true,checks,out,scope:'Synthetic filesystem and real process exits; no Obsidian daily vault, sync service or iPad'};await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
