// Real disk first-join checks using attempts-v1; no private vault or cloud.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
import {createAttemptHistory} from '../src/sync/attempt-history-prototype.mjs';
import {createDurableSyncSession} from '../src/sync/persistence-prototype.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';
const base=path.resolve('.local/sync-016/a5/onboarding'),vault='a'.repeat(32),id=n=>n.toString(16).padStart(32,'0');
const files=['A','B'].map(name=>({path:'Synthetic/'+name+'.md',text:'# First\nBody\n# Second\nBody\n'}));
const graph=()=>buildGraph({files,config:{include:['Synthetic/**']}});
const model=()=>{const g=graph();return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
async function fixture(dx){
 const g=graph(),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius);
 const n=g.nodes.find(n=>n.path==='Synthetic/A.md'&&n.title==='Second');
 assert.equal(e.begin(n.id),null);e.move(n.x+dx,n.y+5);e.commit();let snapshot;
 await createLayoutStore(null,async s=>snapshot=s).command({},'edit',m.groupKey(n.id),m.capture(m.groupKey(n.id)));
 return {settings:{language:'zh'},ui:{legend:'true'},unknown:{preserve:42},layoutOverrides:snapshot};
}
const local=await fixture(-25),rival=await fixture(25);
function adapter(root,write){
 const absolute=name=>path.join(root,'shared',name);
 return {absolute,async stat(name){try{const s=await fs.stat(absolute(name));return {type:s.isDirectory()?'folder':'file',size:s.size};}catch(e){if(e.code==='ENOENT')return null;throw e;}},
 async list(name){const rows=await fs.readdir(absolute(name),{withFileTypes:true});return {files:rows.filter(r=>r.isFile()).map(r=>name+'/'+r.name),folders:rows.filter(r=>r.isDirectory()).map(r=>name+'/'+r.name)};},
 async readBinary(name){return Uint8Array.from(await fs.readFile(absolute(name))).buffer;},mkdir:name=>fs.mkdir(absolute(name)),
 async writeBinary(name,body){if(write)return write(absolute(name),Buffer.from(body));await fs.writeFile(absolute(name),Buffer.from(body));}};
}
async function open(root,{slot='pc',number=1,checkpoint,write,getEpoch,readLocalData}={}){
 await fs.mkdir(path.join(root,'shared'),{recursive:true});
 const io=adapter(root,write),attemptHistory=createAttemptHistory(io,vault);
 const session=createDurableSyncSession({privateStore:createNodeSyncStore(path.join(root,slot)),attemptHistory,vault,installation:id(slot==='pc'?11:12),
 createModel:model,nextId:()=>id(number++),enableConflictResolution:true,checkpoint,getEpoch,readLocalData});await session.open();return {session,io,attemptHistory};
}
const shared=async h=>(await h.attemptHistory.scan()).inventory;
const join=async(h,data,choice)=>{const p=await h.session.previewJoin({localData:data});assert.equal(p.kind,'join-preview',JSON.stringify(p));const r=await h.session.join({localData:data,choice,expectedSharedFingerprint:p.fingerprint});if(r.kind==='held')throw Error(JSON.stringify(r));return r;};
await fs.mkdir(base,{recursive:true});
if(process.argv[2]==='--crash'){
 const root=path.resolve(process.argv[3]),point=process.argv[4];assert.ok(path.relative(base,root)&&!path.relative(base,root).startsWith('..'));
 const h=await open(root,{checkpoint:async step=>{if(step===point)process.exit(86);},...(point==='partial'?{write:async(file,body)=>{await fs.writeFile(file,body.subarray(0,20));process.exit(86);}}:{})});
 await join(h,local,'import');throw Error('exit missing');
}else{
 const out=await fs.mkdtemp(path.join(base,'disk-')),checks=[],crashes=[];
 async function test(name,fn){const root=await fs.mkdtemp(path.join(out,'case-'));await fn(root);checks.push(name);}
 await test('Preview/cancel/cold-open never initializes or publishes or changes the original source',async root=>{
  const h=await open(root),before=structuredClone(local),p=await h.session.previewJoin({localData:local});
  assert.equal(p.kind,'join-preview');assert.deepEqual(p.local,local.layoutOverrides);assert.equal(p.shared.groups&&Object.keys(p.shared.groups).length,0);
  assert.equal(h.session.state().sequence,0);assert.equal(h.session.state().accepted,null);assert.deepEqual(await shared(h),[]);assert.deepEqual(local,before);
  await h.session.close();const cold=await open(root);assert.equal(cold.session.state().initialized,false);assert.equal(cold.session.state().sequence,0);await cold.session.close();
 });
 await test('Previewed import creates one root; empty peer adopts without publishing',async root=>{
  const a=await open(root),b=await open(root,{slot:'ipad',number:2});assert.equal((await join(a,local,'import')).kind,'imported');
  assert.deepEqual(a.session.getJoinBackup(),local);assert.deepEqual(a.session.getJoinProof().importReceipt.operation.parents,[]);
  assert.equal((await join(b,{settings:{language:'en'}},'shared')).kind,'adopted');assert.deepEqual(b.session.state().accepted.snapshot.groups,a.session.state().accepted.snapshot.groups);assert.deepEqual(b.session.state().accepted.snapshot.structures,a.session.state().accepted.snapshot.structures);
  assert.equal((await shared(a)).length,1);await a.session.close();await b.session.close();
 });
 await test('Import confirmation bound to directory preview rejects a newly arrived operation before backup/ID/write',async root=>{
  const a=await open(root),b=await open(root,{slot:'ipad',number:2}),p=await a.session.previewJoin({localData:local});await join(b,rival,'import');
  const result=await a.session.join({localData:local,choice:'import',expectedSharedFingerprint:p.fingerprint});
  assert.equal(result.reason,'shared-scan-changed');assert.equal(a.session.state().sequence,0);assert.equal(a.session.getJoinBackup(),null);assert.equal((await shared(a)).length,1);
  await a.session.close();await b.session.close();
 });
 await test('Adopt shared retains complete old source backup and publishes nothing',async root=>{
  const a=await open(root),b=await open(root,{slot:'ipad',number:2});await join(a,local,'import');const before=await shared(a);
  assert.equal((await join(b,rival,'shared')).kind,'adopted');assert.deepEqual(b.session.getJoinBackup(),rival);assert.equal(b.session.getJoinProof().importReceipt,null);
  assert.deepEqual(await shared(b),before);await a.session.close();await b.session.close();
 });
 await test('Two imported old layouts accept only their own independent root, then resolve with A5',async root=>{
  const a=await open(root),b=await open(root,{slot:'ipad',number:2});await join(a,local,'import');const r=await join(b,rival,'import');
  assert.equal(r.kind,'imported');assert.equal(r.sharedStatus,'blocked');assert.deepEqual(b.session.state().accepted.appliedIds,[id(2)]);
  assert.deepEqual(b.session.getJoinProof().importReceipt.operation.parents,[]);assert.equal((await a.session.acceptExternal()).reason,'shared-candidate-blocked');
  const review=await b.session.previewConflictResolution();assert.equal(review.kind,'review');assert.equal((await b.session.confirmConflictResolution(review.token,id(2))).kind,'staged');
  assert.match((await b.session.publish()).kind,/^accepted/);await a.session.acceptExternal();
  assert.deepEqual(a.session.state().accepted.snapshot,b.session.state().accepted.snapshot);assert.equal((await shared(a)).length,3);
  await a.session.close();await b.session.close();
 });
 await test('Unknown local schema is preserved and not offered as an import',async root=>{
  const h=await open(root),data={...local,layoutOverrides:{...local.layoutOverrides,schemaVersion:99}};
  assert.equal((await h.session.previewJoin({localData:data})).kind,'review-required');assert.equal(h.session.state().sequence,0);assert.equal((await shared(h)).length,0);await h.session.close();
 });
 for(const point of ['after-join-choice','after-attempt-path','before-accept'])await test('An arrival during '+point+' expires import consent and keeps the same pending ID for fresh review',async root=>{
  const b=await open(root,{slot:'ipad',number:2});let injected=false;
  const a=await open(root,{checkpoint:async step=>{if(step===point&&!injected){injected=true;await join(b,rival,'import');}}});
  const p=await a.session.previewJoin({localData:local});
  const r=await a.session.join({localData:local,choice:'import',expectedSharedFingerprint:p.fingerprint});
  assert.equal(r.reason,'shared-scan-changed');assert.equal(a.session.state().accepted,null);assert.equal(a.session.state().joining.id,id(1));
  if(point!=='before-accept')assert.equal((await a.attemptHistory.scan()).canonicalFiles.size,1);
  assert.deepEqual(a.session.getJoinBackup(),local);
  const retry=await join(a,local,'import');assert.equal(retry.kind,'imported');assert.equal(a.session.getJoinProof().importReceipt.operation.id,id(1));
  assert.equal((await a.attemptHistory.scan()).canonicalFiles.size,2);await a.session.close();await b.session.close();
 });
 for(const choice of ['import','shared'])await test('Live source change during '+choice+' confirmation pauses acceptance and preserves the complete original backup',async root=>{
  const peer=await open(root,{slot:'ipad',number:2});if(choice==='shared')await join(peer,rival,'import');
  let current=structuredClone(local);
  const h=await open(root,{readLocalData:async()=>current,checkpoint:async step=>{
   if(step===(choice==='import'?'before-accept':'before-join-adopt'))current=structuredClone(rival);
  }});
  const p=await h.session.previewJoin({localData:local});
  const r=await h.session.join({localData:local,choice,expectedSharedFingerprint:p.fingerprint});
  assert.equal(r.reason,'local-layout-changed');assert.equal(h.session.state().accepted,null);assert.deepEqual(h.session.getJoinBackup(),local);
  await h.session.close();await peer.session.close();
 });
 await test('Unknown shared file blocks preview and leaves source and accepted state untouched',async root=>{
  const h=await open(root);await fs.mkdir(h.io.absolute(h.attemptHistory.directory),{recursive:true});await fs.writeFile(h.io.absolute(h.attemptHistory.directory+'/unknown.json'),'{}');
  const p=await h.session.previewJoin({localData:local});assert.equal(p.kind,'review-required');assert.equal(p.reason,'unknown-file-name');assert.equal(h.session.state().accepted,null);await h.session.close();
 });
 for(const point of ['after-join-backup','after-join-choice','after-attempt-path','partial','after-publication','after-accept'])await test('Process exit and stable import recovery at '+point,async root=>{
  const child=spawnSync(process.execPath,[process.argv[1],'--crash',root,point],{encoding:'utf8'});assert.equal(child.status,86,child.stderr);
  const h=await open(root,{number:999});const before=h.session.state(),oldId=before.joining?.id;
  if(before.initialized){assert.equal((await h.session.previewJoin({localData:local})).kind,'already-joined');}
  else{const r=await join(h,local,'import');assert.equal(r.kind,'imported');}
  const proof=h.session.getJoinProof();if(oldId)assert.equal(proof.importReceipt.operation.id,oldId);
  assert.deepEqual(proof.importReceipt.operation.parents,[]);assert.deepEqual(h.session.getJoinBackup(),local);
  const scan=await h.attemptHistory.scan();assert.equal(scan.canonicalFiles.size,1);assert.equal(scan.blockers.length,0);
  await h.session.close();crashes.push(point);
 });
 const result={pass:true,out,checks,crashes};await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
