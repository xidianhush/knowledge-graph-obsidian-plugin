// First-join/import disk protocol checks. All data is synthetic and isolated.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
import * as legacyCore from '../tests/fixtures/graph-core-0.0.9.mjs';
import * as legacy2Core from '../tests/fixtures/graph-core-0.0.10.mjs';
import {planSchema3Transactions as plan} from '../src/sync/layout-prototype.mjs';
import {createLayoutActionAuthor} from '../src/sync/author-prototype.mjs';
import {createDurableSyncSession} from '../src/sync/persistence-prototype.mjs';
import {createSettingsCoordinator} from '../src/sync/settings-coordinator-prototype.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';
import {createVersionedDocumentStore} from './sync-versioned-document-store.mjs';
import {validateTestSettings} from './sync-settings-test-helpers.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url)),BASE=path.join(ROOT,'.local/sync-016/a3/join');
const vault='a'.repeat(32),installation='b'.repeat(32),ID=n=>n.toString(16).padStart(32,'0'),copy=x=>structuredClone(x);
const files=[{path:'Synthetic/A.md',text:'# First\nfirst\n## Child\nchild body\n# Second\nsecond'},
 {path:'Synthetic/B.md',text:'# Another\nbody\n# Other\nother body'}];
const graph=()=>buildGraph({files,config:{include:['**']}}),factory=()=>{const g=graph();return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
const legacyPositions=new Map();
async function fixture(file='Synthetic/A.md',title='Second',dx=12,old=false){
  const g=graph(),make=old===2?legacy2Core.createLayoutModel:old?legacyCore.createLayoutModel:createLayoutModel,m=make(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius),n=g.nodes.find(n=>n.path===file&&n.title===title);
  assert.equal(e.begin(n.id),null);e.move(n.x+dx,n.y+3);e.commit();const key=m.groupKey(n.id),record=m.capture(key);assert.ok(record);
  if(old){const version=old===2?2:1;legacyPositions.set(version,g.nodes.map(n=>[n.x,n.y]));return JSON.parse(JSON.stringify({schemaVersion:version,revision:7,groups:{[key]:record}}));}
  let disk;await createLayoutStore(null,async d=>disk=copy(d)).command({},'edit',key,record);return {...disk,revision:9};
}
const layout=await fixture(),alternate=await fixture('Synthetic/A.md','Second',-12),other=await fixture('Synthetic/B.md','Other',8),legacy=await fixture('Synthetic/A.md','Second',12,true),legacy2=await fixture('Synthetic/A.md','Second',12,2);
const raw={settings:{language:'zh',autoUpdate:true,debounceMs:350},pipeline:{config:{include:['**']}},ui:{legend:'true'},layoutOverrides:layout,unrelated:{keep:42}};
const operationPath=id=>`Knowledge Map Sync/v2/${vault}/ops/${id}.json`,empty={schemaVersion:3,revision:9,groups:{},structures:{}};
async function normalize(initial){
  let result;const model=factory(),store=createLayoutStore(initial,async next=>result=copy(next));
  await store.reconcile(model);return result||copy(initial);
}
function io(root,options={}){
  const privateStore=createNodeSyncStore(path.join(root,'private'),{onStep:(step,name)=>options.hook?.('private:'+step+':'+name)}),
    sharedStore=createNodeSyncStore(options.sharedRoot||path.join(root,'shared'),{onStep:(step,name)=>options.hook?.('shared:'+step+':'+name)});
  const session=createDurableSyncSession({privateStore,sharedStore,vault,installation,createModel:factory,nextId:()=>ID(100),normalizeLocalLayout:normalize,...options});
  return {root,session,privateStore,sharedStore};
}
async function fresh(options={}){await fs.mkdir(BASE,{recursive:true});const root=await fs.mkdtemp(path.join(BASE,'case-')),value=io(root,options);await value.session.open();return value;}
function external(snapshot=other,id=1){
  return createLayoutActionAuthor({vault,createModel:factory,nextId:()=>ID(id)}).prepareJoin({vault,sharedScanComplete:true,records:[],appliedIds:[],localBaseline:snapshot},{choice:'import'}).operation;
}
async function put(value,operation){await value.sharedStore.create(operationPath(operation.id),JSON.stringify(operation));}
function equalLayout(a,b){assert.deepEqual(a.groups,b.groups);assert.deepEqual(a.structures,b.structures);}
const checks=[],crashes=[];async function test(name,fn){try{await fn();checks.push(name);}catch(error){throw Error('Join check failed: '+name,{cause:error});}}
if(process.argv[2]==='--crash'){
  const root=path.resolve(process.argv[3]),point=process.argv[4],mode=process.argv[5];assert.ok(path.relative(BASE,root)&&!path.relative(BASE,root).startsWith('..'));
  const crash=step=>{if(step===point)process.exit(86);};const value=io(root,{hook:crash,checkpoint:async step=>crash(step)});await value.session.open();
  if(mode==='shared')await put(value,external());
  await value.session.join({localData:raw,choice:mode==='shared'?'shared':'import'});throw Error('join crash did not fire');
}else{
await test('A different nonempty old layout needs explicit choice and a durable full-data backup first',async()=>{
  const value=await fresh({nextId:()=>{throw Error('no ID before choice');}}),before=copy(raw),r=await value.session.join({localData:raw});
  assert.equal(r.kind,'review-required');assert.equal(r.reason,'join-choice-required');assert.equal(r.state.initialized,false);assert.equal(r.state.accepted,null);assert.equal(value.session.getJoinProof(),null);
  assert.deepEqual(value.session.getJoinBackup(),raw);assert.deepEqual(raw,before);assert.equal((await value.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,0);await value.session.close();
});
await test('Explicit local import creates one independent root and durably binds its original source and normalized snapshot',async()=>{
  const value=await fresh(),r=await value.session.join({localData:raw,choice:'import'});assert.equal(r.kind,'imported');assert.deepEqual(r.state.accepted.appliedIds,[ID(100)]);equalLayout(r.state.accepted.snapshot,layout);
  const proof=value.session.getJoinProof();assert.deepEqual(proof.importReceipt.operation.parents,[]);assert.equal(proof.importReceipt.operation.id,ID(100));assert.equal(proof.joinReceipt.choice,'import');assert.deepEqual(value.session.getJoinBackup(),raw);
  await value.session.close();const cold=io(value.root,{nextId:()=>{throw Error('never mint after join');}});await cold.session.open();assert.deepEqual(cold.session.getJoinProof(),proof);assert.equal((await cold.session.join({localData:raw,choice:'import'})).kind,'already-joined');await cold.session.close();
});
await test('A2 reload validation accepts the durable import receipt without emitting a second migration',async()=>{
  const value=await fresh();await value.session.join({localData:raw,choice:'import'});const accepted=value.session.state().accepted,proof=value.session.getJoinProof();
  const author=createLayoutActionAuthor({vault,createModel:factory,nextId:()=>{throw Error('no new ID');}});
  const r=author.prepareJoin({vault,sharedScanComplete:true,records:accepted.operations,appliedIds:accepted.appliedIds,localBaseline:accepted.snapshot},{receipt:proof.importReceipt});assert.equal(r.kind,'already-imported');assert.equal(r.operation,null);await value.session.close();
});
await test('Explicit shared adoption keeps the old local data backup and writes no new shared operation',async()=>{
  const value=await fresh({nextId:()=>{throw Error('adoption needs no operation ID');}}),op=external();await put(value,op);const r=await value.session.join({localData:raw,choice:'shared'});
  assert.equal(r.kind,'adopted');assert.deepEqual(r.state.accepted.appliedIds,[op.id]);equalLayout(r.state.accepted.snapshot,other);assert.deepEqual(value.session.getJoinBackup(),raw);assert.equal(value.session.getJoinProof().importReceipt,null);assert.equal((await value.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,1);await value.session.close();
});
await test('An empty new device adopts shared state without publishing an empty reset',async()=>{
  const value=await fresh({nextId:()=>{throw Error('no empty import');}});await put(value,external());const r=await value.session.join({localData:{settings:{language:'auto'}}});
  assert.equal(r.kind,'adopted');assert.equal(r.state.joining.reason,'empty');equalLayout(r.state.accepted.snapshot,other);assert.equal((await value.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,1);await value.session.close();
});
await test('An empty remote set plus an empty device creates only a local acceptance receipt',async()=>{
  const value=await fresh({nextId:()=>{throw Error('no clearing marker');}}),r=await value.session.join({localData:{},choice:'import'});assert.equal(r.kind,'adopted');assert.equal(r.state.accepted.operations.length,0);assert.equal((await value.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,0);await value.session.close();
});
await test('Identical nonempty layouts can join without inventing another equal-value concurrent root',async()=>{
  const value=await fresh({nextId:()=>{throw Error('no duplicate import');}}),op=external(layout);await put(value,op);const r=await value.session.join({localData:raw});
  assert.equal(r.kind,'adopted');assert.equal(r.state.joining.reason,'same-layout');assert.equal(r.state.accepted.operations.length,1);await value.session.close();
});
await test('Two devices explicitly importing old layouts retain independent roots and their conflict',async()=>{
  const a=await fresh({nextId:()=>ID(100)});await a.session.join({localData:raw,choice:'import'});
  const b=await fresh({sharedRoot:path.join(a.root,'shared'),installation:'c'.repeat(32),nextId:()=>ID(101)}),r=await b.session.join({localData:{...raw,layoutOverrides:alternate},choice:'import'});
  assert.equal(r.kind,'imported');assert.equal(r.sharedStatus,'blocked');assert.deepEqual(r.state.accepted.appliedIds,[ID(101)]);equalLayout(r.state.accepted.snapshot,alternate);
  const all=[a.session.getJoinProof().importReceipt.operation,b.session.getJoinProof().importReceipt.operation];assert.ok(all.every(op=>op.parents.length===0));assert.equal(plan(all,{vault,baseline:empty,createModel:factory}).status,'blocked');
  assert.equal((await b.session.join({localData:{...raw,layoutOverrides:alternate}})).kind,'already-joined');assert.equal((await a.session.acceptExternal()).kind,'held');await a.session.close();await b.session.close();
});
await test('Independent remote groups do not become import parents until separately accepted',async()=>{
  const value=await fresh(),op=external();await put(value,op);const r=await value.session.join({localData:raw,choice:'import'});assert.equal(r.sharedStatus,'candidate');assert.deepEqual(r.state.accepted.appliedIds,[ID(100)]);assert.deepEqual(value.session.getJoinProof().importReceipt.operation.parents,[]);
  const accepted=await value.session.acceptExternal();assert.equal(accepted.kind,'accepted');assert.equal(accepted.state.accepted.operations.length,2);assert.equal(value.session.getJoinProof().importReceipt.operation.id,ID(100));await value.session.close();
});
for(const version of [1,2])await test(`Existing-core schema${version} migration keeps coordinates and the complete original data`,async()=>{
  const oldLayout=copy(version===1?legacy:legacy2);
  const data={...raw,layoutOverrides:oldLayout},before=copy(data),value=await fresh(),expected=await normalize(oldLayout);const r=await value.session.join({localData:data,choice:'import'});
  assert.equal(r.kind,'imported');assert.deepEqual(value.session.getJoinBackup(),before);assert.deepEqual(data,before);equalLayout(r.state.accepted.snapshot,expected);assert.equal(r.state.accepted.snapshot.schemaVersion,3);
  const newGraph=graph();assert.equal(createLayoutModel(newGraph.nodes,newGraph.meta.layout_root_radius).apply(r.state.accepted.snapshot).skipped,0);
  newGraph.nodes.forEach((n,i)=>assert.ok(Math.hypot(n.x-legacyPositions.get(version)[i][0],n.y-legacyPositions.get(version)[i][1])<1e-7));await value.session.close();
});
await test('A schema1/2 migration without an injected existing-core normalizer stops after backup',async()=>{
  const value=await fresh({normalizeLocalLayout:undefined}),data={...raw,layoutOverrides:legacy},r=await value.session.join({localData:data,choice:'import'});
  assert.equal(r.kind,'review-required');assert.match(r.reason,/legacy-normalizer-required/);assert.deepEqual(value.session.getJoinBackup(),data);assert.equal(r.state.accepted,null);await value.session.close();
});
await test('Unsupported local versions, malformed groups or a dropping normalizer cannot clear old data',async()=>{
  for(const mode of ['future','bad-groups','drop']){
    const data=copy(raw);if(mode==='future')data.layoutOverrides.schemaVersion=99;if(mode==='bad-groups')data.layoutOverrides.groups=[];
    const value=await fresh(mode==='drop'?{normalizeLocalLayout:async()=>empty}:{}),r=await value.session.join({localData:data,choice:'import'});
    assert.equal(r.kind,'review-required');assert.deepEqual(value.session.getJoinBackup(),data);assert.equal(r.state.accepted,null);assert.equal((await value.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,0);await value.session.close();
  }
});
await test('Unknown or damaged shared data preserves the backup and blocks both import and shared adoption',async()=>{
  for(const choice of ['import','shared']){
    const value=await fresh();await value.sharedStore.create(operationPath(ID(1)),'{');const r=await value.session.join({localData:raw,choice});assert.equal(r.kind,'review-required');assert.deepEqual(value.session.getJoinBackup(),raw);assert.equal(r.state.initialized,false);await value.session.close();
  }
});
await test('Shared adoption of conflicting roots is held, while explicit local import can retain its own branch',async()=>{
  const value=await fresh();await put(value,external(layout,1));await put(value,external(alternate,2));const held=await value.session.join({localData:raw,choice:'shared'});assert.equal(held.kind,'review-required');assert.equal(held.state.joining.choice,null);
  const r=await value.session.join({localData:raw,choice:'import'});assert.equal(r.kind,'imported');assert.equal(r.sharedStatus,'blocked');assert.deepEqual(r.state.accepted.appliedIds,[ID(100)]);await value.session.close();
});
await test('Missing import files never cause a repeated migration or a replacement ID',async()=>{
  const value=await fresh();await value.session.join({localData:raw,choice:'import'});await value.session.close();await fs.unlink(path.join(value.root,'shared',operationPath(ID(100))));
  const cold=io(value.root,{nextId:()=>{throw Error('no second import');}});await cold.session.open();const r=await cold.session.join({localData:raw,choice:'import'});assert.equal(r.kind,'review-required');assert.equal(r.reason,'import-record-not-yet-available');assert.deepEqual(cold.session.getJoinBackup(),raw);assert.equal(r.state.accepted.operations.length,1);await cold.session.close();
});
await test('Changed same-ID import bodies cannot replace the original durable import receipt',async()=>{
  const value=await fresh();await value.session.join({localData:raw,choice:'import'});const proof=value.session.getJoinProof(),op=copy(proof.importReceipt.operation);op.changes[0].value.points[0].x+=.001;await fs.writeFile(path.join(value.root,'shared',operationPath(op.id)),JSON.stringify(op));
  const r=await value.session.join({localData:raw});assert.equal(r.kind,'review-required');assert.equal(r.reason,'import-record-content-changed');assert.deepEqual(value.session.getJoinProof(),proof);await value.session.close();
});
await test('Different local layout after backup/choice is held rather than overwritten by the old pending import',async()=>{
  let failOnce=true;const value=await fresh({checkpoint:async step=>{if(failOnce&&step==='after-join-choice'){failOnce=false;throw Error('stop-before-stage');}}});await assert.rejects(value.session.join({localData:raw,choice:'import'}));await value.session.close();
  const cold=io(value.root,{nextId:()=>{throw Error('use reserved ID');}});await cold.session.open();const r=await cold.session.join({localData:{...raw,layoutOverrides:alternate}});assert.equal(r.kind,'review-required');assert.equal(r.reason,'local-layout-changed');assert.equal((await cold.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,0);
  assert.equal((await cold.session.join({localData:raw})).kind,'imported');await cold.session.close();
});
await test('A copied config marker is not a private acceptance receipt and cannot suppress a requested import',async()=>{
  const value=await fresh(),data={...raw,importReceipt:{version:1,vault:'c'.repeat(32),operation:{id:ID(999)}},appliedIds:[ID(999)]};const r=await value.session.join({localData:data,choice:'import'});
  assert.equal(r.kind,'imported');assert.deepEqual(r.state.accepted.appliedIds,[ID(100)]);assert.deepEqual(value.session.getJoinBackup(),data);await value.session.close();
});
await test('Changed non-layout preferences or a newer equivalent local revision do not trigger another import',async()=>{
  const value=await fresh();await value.session.join({localData:raw,choice:'import'});const newer={...raw,settings:{...raw.settings,language:'en'},layoutOverrides:{...copy(layout),revision:999}};
  assert.equal((await value.session.join({localData:newer,choice:'import'})).kind,'already-joined');assert.equal(newer.settings.language,'en');assert.equal((await value.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,1);await value.session.close();
});
await test('Known ID collisions retry before durable choice; exhausted collisions stop with backup intact',async()=>{
  for(const exhaust of [false,true]){
    let calls=0;const value=await fresh({nextId:()=>{calls++;return exhaust||calls===1?ID(1):ID(100);}});await put(value,external(other,1));
    if(exhaust){await assert.rejects(value.session.join({localData:raw,choice:'import'}),/join-id-collision/);assert.equal(calls,8);assert.equal(value.session.state().accepted,null);}else {assert.equal((await value.session.join({localData:raw,choice:'import'})).kind,'imported');assert.equal(calls,2);}
    assert.deepEqual(value.session.getJoinBackup(),raw);await value.session.close();
  }
});
await test('Joining never exposes a fake empty accepted layout or allows bypass through ordinary publish/cancel',async()=>{
  let once=true;const value=await fresh({checkpoint:async step=>{if(once&&step==='after-stage'){once=false;throw Error('hold-stage');}}});await assert.rejects(value.session.join({localData:raw,choice:'import'}));await value.session.close();
  const cold=io(value.root);await cold.session.open();assert.equal(cold.session.state().accepted,null);assert.equal(cold.session.getJoinProof(),null);assert.equal((await cold.session.publish()).reason,'join-local-source-required');await assert.rejects(cold.session.cancel(),/join-review-required/);await cold.session.close();
});
await test('Import receipts and backup outputs are isolated from both callers and the durable log',async()=>{
  const value=await fresh(),data=copy(raw),before=copy(data),saving=value.session.join({localData:data,choice:'import'});data.layoutOverrides.groups={};await saving;
  assert.deepEqual(value.session.getJoinBackup(),before);const backup=value.session.getJoinBackup();backup.ui.legend='changed';const proof=value.session.getJoinProof();proof.importReceipt.operation.changes[0].value=null;assert.deepEqual(value.session.getJoinBackup(),before);assert.notEqual(value.session.getJoinProof().importReceipt.operation.changes[0].value,null);await value.session.close();
});
await test('A full plugin-data backup can exceed the wire budget without bloating the layout operation',async()=>{
  const value=await fresh(),data={...raw,unrelated:{padding:Array.from({length:300},()=> 'x'.repeat(8192))}},r=await value.session.join({localData:data,choice:'import'});assert.equal(r.kind,'imported');assert.deepEqual(value.session.getJoinBackup(),data);assert.ok(Buffer.byteLength(JSON.stringify(value.session.getJoinProof().importReceipt.operation))<2097152);await value.session.close();
});
await test('Shared choice only updates the accepted cache after backup, preserving settings/UI/unknown data',async()=>{
  const value=await fresh();await put(value,external());const cache=createVersionedDocumentStore(createNodeSyncStore(path.join(value.root,'cache')));await cache.compareAndSet(null,validateTestSettings(raw));
  const c=createSettingsCoordinator({session:value.session,documentStore:cache,validateSettings:validateTestSettings});await assert.rejects(c.open(),/acceptance-required/);assert.equal((await cache.read()).data.ui.legend,'true');
  await value.session.join({localData:raw,choice:'shared'});await c.open();await c.refreshCache();const d=(await cache.read()).data;equalLayout(d.layoutOverrides,other);assert.equal(d.settings.language,'zh');assert.equal(d.ui.legend,'true');assert.equal(d.unrelated.keep,42);assert.deepEqual(value.session.getJoinBackup(),raw);await value.session.close();
});
await test('An implicit same-layout choice that changes before adoption needs renewed explicit consent',async()=>{
  let once=true;const value=await fresh({checkpoint:async step=>{if(once&&step==='after-join-choice'){once=false;throw Error('pause-choice');}}});await put(value,external(layout,1));await assert.rejects(value.session.join({localData:raw}));await value.session.close();
  const cold=io(value.root);await cold.session.open();const reset=createLayoutActionAuthor({vault,createModel:factory,nextId:()=>ID(2)}).prepareResetAll({vault,sharedScanComplete:true,records:[external(layout,1)],appliedIds:[ID(1)],localBaseline:layout});await put(cold,reset.operation);
  assert.equal((await cold.session.join({localData:raw})).reason,'join-shared-changed-choice-required');assert.equal((await cold.session.join({localData:raw,choice:'shared'})).kind,'adopted');assert.equal(cold.session.getJoinProof().joinReceipt.choice,'shared');await cold.session.close();
});
await test('Epoch changes before committing choice retain the backup and do not publish',async()=>{
  let epoch=0;const value=await fresh({getEpoch:()=>epoch,checkpoint:async step=>{if(step==='after-join-backup')epoch++;}}),r=await value.session.join({localData:raw,choice:'import'});
  assert.equal(r.kind,'review-required');assert.equal(r.reason,'epoch-changed');assert.equal(r.state.accepted,null);assert.deepEqual(value.session.getJoinBackup(),raw);await value.session.close();
});
await test('Corrupt original backup or private import metadata stops cold load instead of pretending migration succeeded',async()=>{
  const value=await fresh();await value.session.join({localData:raw,choice:'import'});const source=value.session.state().joining.source;await value.session.close();await fs.writeFile(path.join(value.root,`private/blobs/${source}.json`),'{}');await assert.rejects(io(value.root).session.open(),/blob-changed/);
});
await test('A collision arriving after durable ID selection is held without changing IDs or the other file',async()=>{
  let once=true;const value=await fresh({checkpoint:async step=>{if(once&&step==='after-join-choice'){once=false;throw Error('pause-ID');}}});await assert.rejects(value.session.join({localData:raw,choice:'import'}));await value.session.close();
  const cold=io(value.root,{nextId:()=>{throw Error('reserved ID cannot change');}});await cold.session.open();const op=external(other,100),body=JSON.stringify(op);await cold.sharedStore.create(operationPath(op.id),body);
  const r=await cold.session.join({localData:raw});assert.equal(r.kind,'held');assert.equal(r.reason,'join-id-conflict');assert.equal(r.state.pending.id,ID(100));assert.equal(r.state.accepted,null);assert.equal(await cold.sharedStore.read(operationPath(op.id),2097152),body);assert.deepEqual(cold.session.getJoinBackup(),raw);await cold.session.close();
});
await test('A completed legacy import does not rerun migration merely because current notes changed',async()=>{
  const data={...raw,layoutOverrides:legacy},value=await fresh();await value.session.join({localData:data,choice:'import'});const proof=value.session.getJoinProof();await value.session.close();
  const changed=()=>{const g=buildGraph({files:files.map((f,i)=>i?f:{...f,text:f.text.replace('First','Changed')}),config:{include:['**']}});return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
  const cold=io(value.root,{createModel:changed,nextId:()=>{throw Error('no duplicate');},normalizeLocalLayout:async()=>{throw Error('do not migrate completed import again');}});await cold.session.open();const r=await cold.session.join({localData:data});assert.equal(r.kind,'already-joined');assert.equal(r.sharedStatus,'blocked');assert.deepEqual(cold.session.getJoinProof(),proof);await cold.session.close();
});
await test('An incompatible old local group can stay backed up while explicitly choosing valid shared state',async()=>{
  const changed=()=>{const g=buildGraph({files:files.map((f,i)=>i?f:{...f,text:f.text.replace('First','Changed')}),config:{include:['**']}});return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
  const value=await fresh({createModel:changed,normalizeLocalLayout:undefined});await put(value,external());assert.equal((await value.session.join({localData:raw,choice:'import'})).kind,'review-required');
  const r=await value.session.join({localData:raw,choice:'shared'});assert.equal(r.kind,'adopted');equalLayout(r.state.accepted.snapshot,other);assert.deepEqual(value.session.getJoinBackup(),raw);await value.session.close();
});
await test('An interrupted empty-device import request resumes adoption without creating a clearing operation',async()=>{
  let once=true;const value=await fresh({checkpoint:async step=>{if(once&&step==='after-join-choice'){once=false;throw Error('pause-empty-choice');}}});await assert.rejects(value.session.join({localData:{},choice:'import'}));await value.session.close();
  const cold=io(value.root,{nextId:()=>{throw Error('empty layout needs no operation');}});await cold.session.open();assert.equal((await cold.session.join({localData:{},choice:'import'})).kind,'adopted');assert.equal(cold.session.state().accepted.operations.length,0);assert.equal((await cold.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,0);await cold.session.close();
});
await test('A stale original config cannot revive layout after a confirmed post-import reset',async()=>{
  const value=await fresh();await value.session.join({localData:raw,choice:'import'});const accepted=value.session.state().accepted;
  const reset=createLayoutActionAuthor({vault,createModel:factory,nextId:()=>ID(101)}).prepareResetAll({vault,sharedScanComplete:true,records:accepted.operations,appliedIds:accepted.appliedIds,localBaseline:accepted.snapshot});
  await value.session.stage(reset);await value.session.publish();const proof=value.session.getJoinProof();await value.session.close();
  const cold=io(value.root,{nextId:()=>{throw Error('must not reimport stale config');}});await cold.session.open();assert.equal((await cold.session.join({localData:raw,choice:'import'})).kind,'already-joined');assert.equal(Object.keys(cold.session.state().accepted.snapshot.groups).length,0);assert.deepEqual(cold.session.getJoinProof(),proof);await cold.session.close();
});
await test('Completed shared adoption still detects a subsequently missing accepted root',async()=>{
  const value=await fresh(),op=external();await put(value,op);await value.session.join({localData:raw,choice:'shared'});await fs.unlink(path.join(value.root,'shared',operationPath(op.id)));
  const before=value.session.state().accepted,r=await value.session.join({localData:raw});assert.equal(r.kind,'review-required');assert.equal(r.reason,'accepted-record-missing');assert.deepEqual(value.session.state().accepted,before);assert.deepEqual(value.session.getJoinBackup(),raw);await value.session.close();
});
const points=['after-join-backup','after-join-choice','after-intent','after-stage','after-publication-intent','after-publication','before-accept','after-accept',
 'private:temp-partial:events/000000000002.json','private:installed:events/000000000002.json','private:temp-partial:events/000000000003.json',
 'private:temp-partial:events/000000000005.json','private:installed:events/000000000005.json','shared:temp-partial:'+operationPath(ID(100))];
for(const point of points)await test('Actual first-import process exit preserves the original ID and backup: '+point,async()=>{
  const root=await fs.mkdtemp(path.join(BASE,'import-crash-')),child=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--crash',root,point,'import'],{cwd:ROOT,encoding:'utf8',timeout:20000,windowsHide:true});assert.equal(child.status,86,child.stderr||child.error?.message);
  let allocations=0;const value=io(root,{nextId:()=>{allocations++;return ID(777);}});await value.session.open();const reserved=value.session.state().joining.id,expected=reserved||ID(777);
  assert.deepEqual(value.session.getJoinBackup(),raw);const r=await value.session.join({localData:raw,choice:'import'});assert.ok(['imported','already-joined'].includes(r.kind));assert.equal(value.session.getJoinProof().importReceipt.operation.id,expected);assert.equal(allocations,reserved?0:1);assert.equal((await value.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,1);assert.equal((await value.privateStore.list('intents')).length,1);await value.session.close();
  const cold=io(root,{nextId:()=>{throw Error('no repeated import');}});await cold.session.open();assert.equal((await cold.session.join({localData:raw})).kind,'already-joined');await cold.session.close();crashes.push({mode:'import',point,exitCode:86,operation:expected,reservedBeforeResume:reserved,allocationsDuringResume:allocations});
});
for(const point of ['after-join-backup','after-join-choice','before-join-adopt','after-join-adopt','private:temp-partial:events/000000000003.json'])await test('Actual shared-adoption process exit retains the old backup without publishing: '+point,async()=>{
  const root=await fs.mkdtemp(path.join(BASE,'adopt-crash-')),child=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--crash',root,point,'shared'],{cwd:ROOT,encoding:'utf8',timeout:20000,windowsHide:true});assert.equal(child.status,86,child.stderr||child.error?.message);
  const value=io(root,{nextId:()=>{throw Error('adoption must not mint');}});await value.session.open();const r=await value.session.join({localData:raw,choice:'shared'});assert.ok(['adopted','already-joined'].includes(r.kind));equalLayout(value.session.state().accepted.snapshot,other);assert.deepEqual(value.session.getJoinBackup(),raw);assert.equal((await value.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,1);assert.equal((await value.privateStore.list('intents')).length,0);await value.session.close();crashes.push({mode:'shared',point,exitCode:86});
});
await fs.mkdir(BASE,{recursive:true});const result={date:'2026-11-08 Asia/Shanghai',passed:checks.length,checks,actualChildCrashes:crashes,
 scope:'Isolated Node first join/import and actual existing-core schema1/2 migration; no real vault migration, platform device isolation, connection switch/disable UI or power-loss claim'};
await fs.writeFile(path.join(BASE,'join-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:checks.length,processCrashes:crashes.length,checks}));
}
