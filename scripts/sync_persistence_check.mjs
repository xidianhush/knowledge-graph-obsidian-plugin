// Real, isolated filesystem checks and real child-process crash recovery.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync,spawn} from 'node:child_process';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
import {createLayoutActionAuthor} from '../src/sync/author-prototype.mjs';
import {createDurableSyncSession} from '../src/sync/persistence-prototype.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';
import {createVersionedDocumentStore} from './sync-versioned-document-store.mjs';
import {createSettingsCoordinator} from '../src/sync/settings-coordinator-prototype.mjs';
import {validateTestSettings} from './sync-settings-test-helpers.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url)),BASE=path.join(ROOT,'.local/sync-016/a3');
const vault='a'.repeat(32),installation='b'.repeat(32),ID=n=>n.toString(16).padStart(32,'0'),clone=x=>structuredClone(x);
const files=[{path:'Synthetic/A.md',text:'# First\nfirst body\n## Child\nchild\n# Second\nsecond body'},
 {path:'Synthetic/B.md',text:'# Another\nbody\n# Other\nbody'}];
const factory=(items=files)=>()=>{const g=buildGraph({files:items,config:{include:['**']}});return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
const empty={schemaVersion:3,revision:9,groups:{},structures:{}};
const context=accepted=>({vault,sharedScanComplete:true,records:accepted?.operations||[],appliedIds:accepted?.appliedIds||[],localBaseline:accepted?.snapshot||empty});
async function input(file='Synthetic/A.md',title='Second'){
  const g=buildGraph({files,config:{include:['**']}}),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius);
  const n=g.nodes.find(n=>n.path===file&&n.title===title);assert.equal(e.begin(n.id),null);e.move(n.x+12,n.y+3);e.commit();let disk;
  const store=createLayoutStore(null,async value=>disk=clone(value)),group=m.groupKey(n.id);await store.command({},'edit',group,m.capture(group));
  return [{group,value:{schemaVersion:3,record:disk.groups[group],structures:disk.structures}}];
}
const change=await input();
const changeB=await input('Synthetic/B.md','Other');
function author(options={}){let id=1;return createLayoutActionAuthor({vault,createModel:factory(),nextId:()=>ID(id++),...options});}
const operationPath=id=>`Knowledge Map Sync/v2/${vault}/ops/${id}.json`;
function stores(root,{hook}={}){return {
  privateStore:createNodeSyncStore(path.join(root,'private'),{onStep:(step,name)=>hook?.('private:'+step+':'+name)}),
  sharedStore:createNodeSyncStore(path.join(root,'shared'),{onStep:(step,name)=>hook?.('shared:'+step+':'+name)}),
};}
function session(root,options={}){const io=stores(root,options);return {...io,session:createDurableSyncSession({...io,vault,installation,createModel:factory(),...options})};}
async function fresh(options={}){
  await fs.mkdir(BASE,{recursive:true});const root=await fs.mkdtemp(path.join(BASE,'disk-')),io=session(root,options);await io.session.open();
  await io.session.initialize({localBaseline:empty,source:'explicit-empty'});return {root,...io};
}
const checks=[],crashes=[];
async function test(name,fn){await fn();checks.push(name);}
async function coordinator(io,{checkpoint}={}){
  const doc=createVersionedDocumentStore(createNodeSyncStore(path.join(io.root,'cache')));
  if((await doc.read()).version===null)await doc.compareAndSet(null,validateTestSettings({settings:{language:'auto'},ui:{legend:'false'},layoutOverrides:empty,unrelated:{keep:42}}));
  const c=createSettingsCoordinator({session:io.session,documentStore:doc,validateSettings:validateTestSettings,checkpoint});await c.open();return {c,doc};
}

if(process.argv[2]==='--crash'){
  const root=path.resolve(process.argv[3]),point=process.argv[4];
  assert.ok(path.relative(BASE,root)&&!path.relative(BASE,root).startsWith('..'));
  const crash=step=>{if(step===point)process.exit(86);};
  const io=session(root,{hook:crash,checkpoint:async step=>crash(step)});await io.session.open();
  if(!io.session.state().initialized)await io.session.initialize({localBaseline:empty,source:'explicit-empty'});
  const a=author(),draft=a.prepareEdit(context(),change);await io.session.stage(draft);await io.session.publish();
  throw Error('crash point did not fire: '+point);
}else if(process.argv[2]==='--receive-crash'){
  const root=path.resolve(process.argv[3]),point=process.argv[4];assert.ok(path.relative(BASE,root)&&!path.relative(BASE,root).startsWith('..'));
  const crash=step=>{if(step===point)process.exit(86);};const io=session(root,{hook:crash,checkpoint:async step=>crash(step)});await io.session.open();
  await io.session.initialize({localBaseline:empty,source:'explicit-empty'});const d=author().prepareEdit(context(),change);
  await io.sharedStore.create(operationPath(d.operation.id),JSON.stringify(d.operation));await io.session.acceptExternal();throw Error('receive crash did not fire');
}else if(process.argv[2]==='--cache-crash'){
  const root=path.resolve(process.argv[3]),point=process.argv[4];assert.ok(path.relative(BASE,root)&&!path.relative(BASE,root).startsWith('..'));let armed=false;
  const crash=step=>{if(armed&&step===point)process.exit(86);};const io=session(root,{hook:crash,checkpoint:async step=>crash(step)});io.root=root;
  await io.session.open();await io.session.initialize({localBaseline:empty,source:'explicit-empty'});
  const {c}=await coordinator(io,{checkpoint:async step=>crash('coordinator:'+step)}),s=await c.beginSettingsDraft();s.value.settings.language='zh';await c.updateSettingsDraft(s.id,s.value);
  armed=true;await c.saveSettingsDraft(s.id);throw Error('cache crash did not fire');
}else if(process.argv[2]==='--lease'){
  const root=path.resolve(process.argv[3]);assert.ok(!path.relative(BASE,root).startsWith('..'));
  const io=createNodeSyncStore(path.join(root,'private'));let release,guard;
  try{release=await io.acquire(installation);guard=await fs.open(path.join(root,'guard'),'wx');await new Promise(r=>setTimeout(r,120));await guard.close();guard=null;await fs.unlink(path.join(root,'guard'));console.log('acquired');}
  catch(e){if(e.message==='store-busy')console.log('busy');else {console.error(e.stack);process.exitCode=1;}}
  finally{await guard?.close();await release?.();}
}else{
await test('Explicit empty initialization produces a hashed receipt without publishing a clearing operation',async()=>{
  const io=await fresh();assert.deepEqual(io.session.state().accepted.snapshot,empty);assert.deepEqual(io.session.state().accepted.appliedIds,[]);
  assert.deepEqual(await io.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`),[]);await io.session.close();
  const cold=session(io.root);await cold.session.open();assert.deepEqual(cold.session.state().accepted.snapshot,empty);await cold.session.close();
});
await test('Stage persists the exact operation, old backup and candidate before any shared publication',async()=>{
  const io=await fresh(),a=author(),draft=a.prepareEdit(context(),change);await io.session.stage(draft);
  assert.deepEqual(io.session.state().pending.backup,empty);assert.deepEqual(io.session.state().pending.operation,draft.operation);
  assert.deepEqual(io.session.state().accepted.snapshot,empty);assert.equal(await io.sharedStore.read(operationPath(ID(1)),2097152),null);
  await io.session.close();const cold=session(io.root);await cold.session.open();assert.deepEqual(cold.session.state().pending.proposal,draft.proposal);await cold.session.close();
});
await test('Publish commits the same ID and a new acceptance receipt before author confirmation',async()=>{
  const io=await fresh(),a=author(),draft=a.prepareEdit(context(),change);await io.session.stage(draft);const result=await io.session.publish();
  assert.equal(result.kind,'accepted');assert.equal(result.state.pending,null);assert.deepEqual(result.state.accepted.snapshot,draft.proposal);
  assert.ok(a.confirmPublished(context(result.state.accepted)).historyToken);assert.equal((await io.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,1);
  await io.session.close();const cold=session(io.root);await cold.session.open();assert.deepEqual(cold.session.state().accepted,result.state.accepted);await cold.session.close();
});
await test('A second reset transaction survives a cold load without losing tombstones or its before-image',async()=>{
  const io=await fresh(),a=author(),first=a.prepareEdit(context(),change);await io.session.stage(first);let r=await io.session.publish();a.confirmPublished(context(r.state.accepted));
  const second=a.prepareResetAll(context(r.state.accepted));await io.session.stage(second);assert.deepEqual(io.session.state().pending.backup,first.proposal);
  r=await io.session.publish();assert.equal(Object.keys(r.state.accepted.snapshot.groups).length,0);assert.equal(r.state.accepted.operations.length,2);
  await io.session.close();const cold=session(io.root);await cold.session.open();assert.deepEqual(cold.session.state().accepted,r.state.accepted);await cold.session.close();
});
await test('An equivalent existing shared body is read idempotently without replacing its formatting',async()=>{
  const io=await fresh(),d=author().prepareEdit(context(),change),pretty=JSON.stringify(d.operation,null,2);await io.session.stage(d);
  await io.sharedStore.create(operationPath(d.operation.id),pretty);assert.equal((await io.session.publish()).kind,'accepted');
  assert.equal(await io.sharedStore.read(operationPath(d.operation.id),2097152),pretty);await io.session.close();
});
await test('A same-ID different shared body blocks acceptance and is never overwritten or cancelled',async()=>{
  const io=await fresh(),d=author().prepareEdit(context(),change),bad=clone(d.operation);bad.changes[0].value.points[0].x+=.001;
  await io.session.stage(d);const raw=JSON.stringify(bad);await io.sharedStore.create(operationPath(d.operation.id),raw);
  await assert.rejects(io.session.publish(),/publication-conflict/);assert.deepEqual(io.session.state().accepted.snapshot,empty);assert.ok(io.session.state().pending);
  assert.equal(await io.sharedStore.read(operationPath(d.operation.id),2097152),raw);await io.session.close();
  const cold=session(io.root);await cold.session.open();await assert.rejects(cold.session.cancel(),/publication-may-have-started/);await cold.session.close();
});
await test('A partial shared JSON blocks progress while retaining the exact complete outbox body',async()=>{
  const io=await fresh(),d=author().prepareEdit(context(),change);await io.session.stage(d);await io.sharedStore.create(operationPath(d.operation.id),'{');
  await assert.rejects(io.session.publish(),/shared-partial-json/);assert.deepEqual(io.session.state().pending.operation,d.operation);assert.deepEqual(io.session.state().accepted.snapshot,empty);await io.session.close();
});
await test('Unpublished cancellation retains backups and prevents accidental reuse of its old intent ID',async()=>{
  const io=await fresh(),d=author().prepareEdit(context(),change);await io.session.stage(d);await io.session.cancel();assert.equal(io.session.state().pending,null);
  assert.equal((await io.privateStore.list('intents')).length,1);await io.session.close();const cold=session(io.root);await cold.session.open();
  assert.equal(cold.session.state().pending,null);await assert.rejects(cold.session.stage(d),/stage-operation/);await cold.session.close();
});
await test('A failed publication attempt cannot be cancelled just because no shared file is visible',async()=>{
  let armed=false;const io=await fresh({checkpoint:async step=>{if(armed&&step==='after-publication-intent')throw Error('injected');}}),d=author().prepareEdit(context(),change);
  await io.session.stage(d);armed=true;await assert.rejects(io.session.publish(),/injected/);assert.equal(await io.sharedStore.read(operationPath(d.operation.id),2097152),null);await io.session.close();
  const cold=session(io.root);await cold.session.open();await assert.rejects(cold.session.cancel(),/publication-may-have-started/);await cold.session.close();
  const again=session(io.root);await again.session.open();assert.equal((await again.session.publish()).kind,'accepted');await again.session.close();
});
await test('Incomplete journal tail is refused instead of falling back to an older empty receipt',async()=>{
  const io=await fresh(),d=author().prepareEdit(context(),change);await io.session.stage(d);await io.session.publish();await io.session.close();
  await fs.writeFile(path.join(io.root,'private/events/000000000004.json'),'{');const cold=session(io.root);await assert.rejects(cold.session.open(),/partial-private-json/);
  assert.equal(await io.sharedStore.read(operationPath(d.operation.id),2097152)!==null,true);assert.equal((await io.privateStore.list('intents')).length,1);
});
await test('A journal gap fails closed and all existing snapshots stay on disk',async()=>{
  const io=await fresh();await io.session.close();await io.privateStore.create('events/000000000003.json','{}');await assert.rejects(session(io.root).session.open(),/journal-gap/);
  assert.ok((await io.privateStore.list('blobs')).length>0);
});
await test('Modified backup/blob content and modified intent metadata are detected on cold load',async()=>{
  for(const mode of ['blob','intent']){
    const io=await fresh(),d=author().prepareEdit(context(),change);await io.session.stage(d);await io.session.close();
    const intentPath=path.join(io.root,`private/intents/${d.operation.id}.json`),meta=JSON.parse(await fs.readFile(intentPath,'utf8'));
    if(mode==='blob')await fs.writeFile(path.join(io.root,`private/blobs/${meta.backup}.json`),'{}');
    else {meta.proposal=meta.backup;await fs.writeFile(intentPath,JSON.stringify(meta));}
    await assert.rejects(session(io.root).session.open(),/blob-changed|intent-changed|private-file-changed/);
  }
});
await test('A copied private ledger cannot impersonate a different installation or logical vault',async()=>{
  const io=await fresh();await io.session.close();for(const options of [{installation:'c'.repeat(32)},{vault:'d'.repeat(32)}])await assert.rejects(session(io.root,options).session.open(),/journal-chain/);
});
await test('A second live writer cannot open the same private ledger',async()=>{
  const io=await fresh();await assert.rejects(session(io.root).session.open(),/store-busy/);await io.session.close();
  const cold=session(io.root);await cold.session.open();await cold.session.close();
});
await test('Simultaneous child-process lease claimants never enter the guarded write region together',async()=>{
  await fs.mkdir(BASE,{recursive:true});const root=await fs.mkdtemp(path.join(BASE,'leases-'));
  const children=Array.from({length:6},()=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'--lease',root],{cwd:ROOT,stdio:['ignore','pipe','pipe'],windowsHide:true});let out='',err='';
    child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',reject);child.on('close',code=>code?reject(Error(err)):resolve(out.trim()));
  }));const values=await Promise.all(children);assert.ok(values.every(v=>['acquired','busy'].includes(v)));
  // All simultaneous claimants may conservatively decline; a later uncontended
  // acquisition must still work, without reaping somebody else's live claim.
  const release=await createNodeSyncStore(path.join(root,'private')).acquire(installation);await release();
});
await test('A changed graph holds the staged operation and a later compatible graph resumes the same ID',async()=>{
  let items=files;const io=await fresh({createModel:()=>factory(items)()}),d=author().prepareEdit(context(),change);await io.session.stage(d);
  items=files.map((f,i)=>i?f:{...f,text:f.text.replace('First','Renamed')});let r=await io.session.publish();assert.equal(r.kind,'held');assert.equal(r.reason,'graph-incompatible');assert.equal(r.state.pending.id,d.operation.id);
  items=files;r=await io.session.publish();assert.equal(r.kind,'accepted');assert.equal(r.state.accepted.operations[0].id,d.operation.id);await io.session.close();
});
await test('A cold accepted receipt can seed the A2 structural repair author and persist its new transaction',async()=>{
  const io=await fresh(),a=author(),d=a.prepareEdit(context(),change);await io.session.stage(d);await io.session.publish();await io.session.close();
  const renamed=files.map((f,i)=>i?f:{...f,text:f.text.replace('First','Renamed')}),cold=session(io.root,{createModel:factory(renamed)});await cold.session.open();
  const repairAuthor=author({createModel:factory(renamed),nextId:()=>ID(2)}),repair=repairAuthor.prepareReconcile(context(cold.session.state().accepted));assert.ok(repair.operation);
  await cold.session.stage(repair);const result=await cold.session.publish();assert.equal(result.kind,'accepted');assert.deepEqual(result.state.accepted.snapshot,repair.proposal);
  repairAuthor.confirmPublished(context(result.state.accepted));await cold.session.close();
});
await test('Epoch changes after publication do not advance the acceptance receipt',async()=>{
  let epoch=0,armed=false;const io=await fresh({getEpoch:()=>epoch,checkpoint:async step=>{if(armed&&step==='after-publication')epoch++;}}),d=author().prepareEdit(context(),change);
  await io.session.stage(d);armed=true;const r=await io.session.publish();assert.equal(r.kind,'held');assert.equal(r.reason,'epoch-changed-after-publication');assert.deepEqual(r.state.accepted.snapshot,empty);
  assert.ok(await io.sharedStore.read(operationPath(d.operation.id),2097152));await io.session.close();const cold=session(io.root);await cold.session.open();assert.equal((await cold.session.publish()).kind,'accepted');await cold.session.close();
});
await test('An epoch change during atomic acceptance returns deferred view application with durable history intact',async()=>{
  let epoch=0,armed=false;const io=await fresh({getEpoch:()=>epoch,hook:async step=>{if(armed&&step==='private:installed:events/000000000004.json')epoch++;}}),d=author().prepareEdit(context(),change);
  await io.session.stage(d);armed=true;const r=await io.session.publish();assert.equal(r.kind,'accepted-deferred');assert.deepEqual(r.state.accepted.snapshot,d.proposal);await io.session.close();
});
await test('Missing or altered accepted shared files cannot be silently acknowledged as valid parents',async()=>{
  for(const mode of ['missing','changed']){
    const io=await fresh(),a=author(),d=a.prepareEdit(context(),change);await io.session.stage(d);let r=await io.session.publish();a.confirmPublished(context(r.state.accepted));
    const reset=a.prepareResetAll(context(r.state.accepted));await io.session.stage(reset);
    const target=path.join(io.root,'shared',operationPath(d.operation.id));if(mode==='missing')await fs.unlink(target);else await fs.writeFile(target,'{}');
    if(mode==='missing'){r=await io.session.publish();assert.equal(r.kind,'held');assert.equal(r.reason,'accepted-record-missing');}
    else await assert.rejects(io.session.publish(),/accepted-record-changed/);
    assert.deepEqual(io.session.state().accepted.snapshot,d.proposal);assert.equal(io.session.state().pending.id,reset.operation.id);await io.session.close();
  }
});
await test('Adoption requires exact supplied applied facts, a current candidate and matching shared bytes',async()=>{
  const seed=author().prepareEdit(context(),change);const goodRoot=await fs.mkdtemp(path.join(BASE,'adopt-')),io=session(goodRoot);await io.sharedStore.create(operationPath(seed.operation.id),JSON.stringify(seed.operation));await io.session.open();
  await io.session.initialize({records:[seed.operation],appliedIds:[seed.operation.id],localBaseline:seed.proposal,source:'verified-adopt'});assert.deepEqual(io.session.state().accepted.snapshot,seed.proposal);await io.session.close();
  for(const options of [{records:[seed.operation],appliedIds:[],localBaseline:seed.proposal,source:'verified-adopt'},
    {records:[seed.operation],appliedIds:[seed.operation.id],localBaseline:seed.proposal,source:'verified-adopt'},
    {records:[],appliedIds:[],localBaseline:seed.proposal,source:'explicit-empty'}]){
    const root=await fs.mkdtemp(path.join(BASE,'bad-adopt-')),bad=session(root);await bad.session.open();await assert.rejects(bad.session.initialize(options));assert.equal(bad.session.state().accepted,null);await bad.session.close();
  }
});
await test('Forged candidate, applied IDs, backup or unknown wire version cannot reach shared publication',async()=>{
  const seed=author().prepareEdit(context(),change);for(const alter of [d=>d.proposal=empty,d=>d.appliedIds=[],d=>d.backup=d.proposal,d=>d.operation.protocol=99]){
    const io=await fresh(),d=clone(seed);alter(d);await assert.rejects(io.session.stage(d));assert.equal(await io.sharedStore.read(operationPath(ID(1)),2097152),null);assert.deepEqual(io.session.state().accepted.snapshot,empty);await io.session.close();
  }
});
await test('Caller mutation cannot change a queued draft or the returned accepted/backup snapshots',async()=>{
  const io=await fresh(),d=author().prepareEdit(context(),change),original=clone(d),save=io.session.stage(d);d.operation.changes[0].value.points[0].x=999;d.proposal.groups={};
  await save;assert.deepEqual(io.session.state().pending.operation,original.operation);const r=await io.session.publish();r.state.accepted.snapshot.groups={};
  assert.deepEqual(io.session.state().accepted.snapshot,original.proposal);await io.session.close();
});
await test('Concurrent commands serialize and a failed command requires reopening without losing the staged action',async()=>{
  const io=await fresh(),d=author().prepareEdit(context(),change),first=io.session.stage(d),second=io.session.stage(d);await first;await assert.rejects(second,/stage-state/);
  await assert.rejects(io.session.publish(),/reopen-required/);await io.session.close();const cold=session(io.root);await cold.session.open();assert.equal((await cold.session.publish()).kind,'accepted');await cold.session.close();
});
await test('An I/O exception before shared installation leaves old accepted data and can retry after reopening',async()=>{
  let armed=false;const io=await fresh({hook:async step=>{if(armed&&step.startsWith('shared:temp-synced:'))throw Error('disk-fault');}}),d=author().prepareEdit(context(),change);
  await io.session.stage(d);armed=true;await assert.rejects(io.session.publish(),/disk-fault/);assert.deepEqual(io.session.state().accepted.snapshot,empty);assert.deepEqual(io.session.state().pending.operation,d.operation);await io.session.close();
  const cold=session(io.root);await cold.session.open();assert.equal((await cold.session.publish()).kind,'accepted');await cold.session.close();
});
await test('Node adapter rejects path traversal, invalid UTF8 and file growth budgets',async()=>{
  const io=await fresh();await assert.rejects(io.privateStore.read('../outside',1024),/store-path/);await assert.rejects(io.privateStore.create('C:/outside','x'),/store-path/);
  await io.privateStore.create('blobs/unicode.json','测试😀中文');assert.equal(await io.privateStore.read('blobs/unicode.json',100),'测试😀中文');
  await io.privateStore.create('blobs/size.json','abc');await assert.rejects(io.privateStore.read('blobs/size.json',2),/file-budget/);
  await fs.writeFile(path.join(io.root,'private/blobs/utf8.json'),Buffer.from([0xff]));await assert.rejects(io.privateStore.read('blobs/utf8.json',10),/invalid-utf8/);await io.session.close();
});
await test('External acceptance reads the complete shared set without creating or changing shared files',async()=>{
  const io=await fresh(),d=author().prepareEdit(context(),change),raw=JSON.stringify(d.operation,null,2);await io.sharedStore.create(operationPath(d.operation.id),raw);
  const originalCreate=io.sharedStore.create;let sharedWrites=0;io.sharedStore.create=async(...args)=>{sharedWrites++;return originalCreate(...args);};
  const r=await io.session.acceptExternal();assert.equal(r.kind,'accepted');assert.deepEqual(r.state.accepted.snapshot,d.proposal);
  assert.equal(await io.sharedStore.read(operationPath(d.operation.id),2097152),raw);assert.equal((await io.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,1);
  const sequence=r.state.sequence;assert.equal((await io.session.acceptExternal()).kind,'noop');assert.equal(io.session.state().sequence,sequence);assert.equal(sharedWrites,0);
  await io.session.close();const cold=session(io.root);await cold.session.open();assert.deepEqual(cold.session.state().accepted,r.state.accepted);await cold.session.close();
});
await test('Independent external groups are accepted together without publishing another operation',async()=>{
  const io=await fresh(),a=author().prepareEdit(context(),change),b=author({nextId:()=>ID(2)}).prepareEdit(context(),changeB);
  for(const d of [b,a])await io.sharedStore.create(operationPath(d.operation.id),JSON.stringify(d.operation));
  const r=await io.session.acceptExternal();assert.equal(r.kind,'accepted');assert.equal(Object.keys(r.state.accepted.snapshot.groups).length,2);assert.equal(r.state.accepted.operations.length,2);await io.session.close();
});
await test('Missing causal predecessors hold external acceptance until the exact dependency arrives',async()=>{
  const io=await fresh(),d=author().prepareEdit(context(),change),reset=author({nextId:()=>ID(2)}).prepareResetAll(context({snapshot:d.proposal,operations:[d.operation],appliedIds:[d.operation.id]}));
  await io.sharedStore.create(operationPath(reset.operation.id),JSON.stringify(reset.operation));assert.equal((await io.session.acceptExternal()).kind,'held');assert.deepEqual(io.session.state().accepted.snapshot,empty);
  await io.sharedStore.create(operationPath(d.operation.id),JSON.stringify(d.operation));const r=await io.session.acceptExternal();assert.equal(r.kind,'accepted');assert.equal(r.state.accepted.operations.length,2);assert.equal(Object.keys(r.state.accepted.snapshot.groups).length,0);await io.session.close();
});
await test('Concurrent same-group shared versions retain the existing accepted baseline',async()=>{
  const io=await fresh(),d=author().prepareEdit(context(),change);await io.sharedStore.create(operationPath(d.operation.id),JSON.stringify(d.operation));await io.session.acceptExternal();
  const other=author({nextId:()=>ID(2)}).prepareEdit(context(),change);await io.sharedStore.create(operationPath(other.operation.id),JSON.stringify(other.operation));
  const before=io.session.state().accepted,r=await io.session.acceptExternal();assert.equal(r.kind,'held');assert.deepEqual(io.session.state().accepted,before);await io.session.close();
});
await test('Different same-ID conflict-copy bodies block receipt acceptance, equal copies deduplicate',async()=>{
  for(const different of [false,true]){
    const io=await fresh(),d=author().prepareEdit(context(),change),copy=clone(d.operation);if(different)copy.changes[0].value.points[0].x+=.001;
    await io.sharedStore.create(operationPath(d.operation.id),JSON.stringify(d.operation));await io.sharedStore.create(`Knowledge Map Sync/v2/${vault}/ops/${d.operation.id} (conflict).json`,JSON.stringify(copy));
    const r=await io.session.acceptExternal();assert.equal(r.kind,different?'held':'accepted');assert.equal(io.session.state().accepted.operations.length,different?0:1);await io.session.close();
  }
});
await test('Malformed, foreign, future-protocol, misnamed or copy-only shared files never become applied facts',async()=>{
  const d=author().prepareEdit(context(),change);
  for(const mode of ['partial','foreign','future','misnamed','copy-only']){
    const io=await fresh(),op=clone(d.operation);let name=operationPath(op.id),body;
    if(mode==='foreign')op.vault='c'.repeat(32);if(mode==='future')op.protocol=99;if(mode==='misnamed')name=operationPath(ID(2));if(mode==='copy-only')name=`Knowledge Map Sync/v2/${vault}/ops/copy.json`;
    body=mode==='partial'?'{':JSON.stringify(op);await io.sharedStore.create(name,body);assert.equal((await io.session.acceptExternal()).kind,'held');assert.deepEqual(io.session.state().accepted.snapshot,empty);await io.session.close();
  }
});
await test('Deleting or changing an accepted record cannot be hidden by a later external scan',async()=>{
  for(const changed of [false,true]){
    const io=await fresh(),d=author().prepareEdit(context(),change);await io.sharedStore.create(operationPath(d.operation.id),JSON.stringify(d.operation));await io.session.acceptExternal();const before=io.session.state().accepted;
    const target=path.join(io.root,'shared',operationPath(d.operation.id));if(changed){const op=clone(d.operation);op.changes[0].value.points[0].x+=.001;await fs.writeFile(target,JSON.stringify(op));}else await fs.unlink(target);
    assert.equal((await io.session.acceptExternal()).kind,'held');assert.deepEqual(io.session.state().accepted,before);await io.session.close();
  }
});
await test('A visible cancelled local intent is held for review instead of being mistaken for a remote edit',async()=>{
  for(const changed of [false,true]){
    const io=await fresh(),d=author().prepareEdit(context(),change);await io.session.stage(d);await io.session.cancel();await io.session.close();const cold=session(io.root);await cold.session.open();
    const op=clone(d.operation);if(changed)op.changes[0].value.points[0].x+=.001;await cold.sharedStore.create(operationPath(op.id),JSON.stringify(op));
    assert.equal((await cold.session.acceptExternal()).reason,changed?'local-intent-id-conflict':'cancelled-record-visible-review');assert.deepEqual(cold.session.state().accepted.snapshot,empty);await cold.session.close();
  }
});
await test('External acceptance waits behind a staged local action without changing its basis',async()=>{
  const io=await fresh(),d=author().prepareEdit(context(),change);await io.session.stage(d);const head=io.session.state().head;
  assert.equal((await io.session.acceptExternal()).reason,'local-action-pending');assert.equal(io.session.state().head,head);assert.deepEqual(io.session.state().pending.operation,d.operation);await io.session.close();
});
await test('A shared set changing during receive preparation is held and later accepted from a fresh scan',async()=>{
  let add=null;const io=await fresh({checkpoint:async step=>{if(step==='before-receive'&&add){const fn=add;add=null;await fn();}}}),d=author().prepareEdit(context(),change),b=author({nextId:()=>ID(2)}).prepareEdit(context(),changeB);
  await io.sharedStore.create(operationPath(d.operation.id),JSON.stringify(d.operation));add=()=>io.sharedStore.create(operationPath(b.operation.id),JSON.stringify(b.operation));
  assert.equal((await io.session.acceptExternal()).reason,'shared-scan-changed');assert.equal(io.session.state().accepted.operations.length,0);assert.equal((await io.session.acceptExternal()).state.accepted.operations.length,2);await io.session.close();
});
await test('Epoch changes during receive defer acceptance or view application at the durable boundary',async()=>{
  for(const phase of ['before-receive','after-receive']){
    let epoch=0;const io=await fresh({getEpoch:()=>epoch,checkpoint:async step=>{if(step===phase)epoch++;}}),d=author().prepareEdit(context(),change);await io.sharedStore.create(operationPath(d.operation.id),JSON.stringify(d.operation));
    const r=await io.session.acceptExternal();assert.equal(r.kind,phase==='before-receive'?'held':'accepted-deferred');assert.equal(r.state.accepted.operations.length,phase==='before-receive'?0:1);await io.session.close();
  }
});
await test('Accepting a remote descendant makes it the next author basis without republishing it',async()=>{
  const io=await fresh(),d=author().prepareEdit(context(),change);await io.sharedStore.create(operationPath(d.operation.id),JSON.stringify(d.operation));const r=await io.session.acceptExternal();
  const reset=author({nextId:()=>ID(2)}).prepareResetAll(context(r.state.accepted));assert.deepEqual(reset.operation.parents,[d.operation.id]);await io.session.stage(reset);assert.equal((await io.session.publish()).kind,'accepted');assert.equal((await io.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,2);await io.session.close();
});
await test('Durable local drafts survive cold load without altering the acceptance fingerprint',async()=>{
  const io=await fresh(),fingerprint=io.session.state().accepted.fingerprint;await io.session.saveLocalState({version:1,draft:{language:'zh'}});assert.equal(io.session.state().accepted.fingerprint,fingerprint);await io.session.close();
  const cold=session(io.root);await cold.session.open();assert.deepEqual(cold.session.state().localState,{version:1,draft:{language:'zh'}});assert.equal(cold.session.state().accepted.fingerprint,fingerprint);await cold.session.close();
});
await test('A durable settings draft remains intact while external layout is accepted and cached',async()=>{
  const io=await fresh(),{c,doc}=await coordinator(io),s=await c.beginSettingsDraft();s.value.settings.language='zh';await c.updateSettingsDraft(s.id,s.value);
  const d=author().prepareEdit(context(),change);await io.sharedStore.create(operationPath(d.operation.id),JSON.stringify(d.operation));assert.equal((await c.acceptExternal()).kind,'accepted');
  assert.equal((await doc.read()).data.settings.language,'auto');assert.deepEqual((await doc.read()).data.layoutOverrides,d.proposal);await io.session.close();
  const cold=session(io.root);cold.root=io.root;await cold.session.open();const reopened=await coordinator(cold);assert.equal(reopened.c.state().settingsDraft.value.settings.language,'zh');await reopened.c.saveSettingsDraft(s.id);assert.equal((await reopened.doc.read()).data.settings.language,'zh');await cold.session.close();
});
await test('Disk-backed local layout previews block receive and persist independently of accepted layout caches',async()=>{
  const io=await fresh(),{c,doc}=await coordinator(io),d=author().prepareEdit(context(),change);await c.stageLayoutDraft(d.proposal);await c.saveUi('legend','true');
  await io.sharedStore.create(operationPath(d.operation.id),JSON.stringify(d.operation));assert.equal((await c.acceptExternal()).reason,'local-layout-draft');assert.deepEqual((await doc.read()).data.layoutOverrides,empty);await io.session.close();
  const cold=session(io.root);cold.root=io.root;await cold.session.open();const reopened=await coordinator(cold);assert.deepEqual(reopened.c.state().layoutDraft.value,d.proposal);await cold.session.close();
});
await test('Versioned document compare-and-set prevents competing writers from replacing the same version',async()=>{
  const root=await fs.mkdtemp(path.join(BASE,'cas-')),store=createNodeSyncStore(root),a=createVersionedDocumentStore(store),b=createVersionedDocumentStore(store);await a.compareAndSet(null,{value:0});const old=await a.read();
  const results=await Promise.all([a.compareAndSet(old.version,{value:1}),b.compareAndSet(old.version,{value:2})]);assert.equal(results.filter(r=>r.ok).length,1);assert.equal((await a.read()).sequence,2);
});
for(const point of ['before-receive','after-receive','private:temp-partial:events/000000000002.json','private:installed:events/000000000002.json']){
  await test('Actual external-receive process exit recovers without shared writes: '+point,async()=>{
    const root=await fs.mkdtemp(path.join(BASE,'receive-crash-')),child=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--receive-crash',root,point],{cwd:ROOT,encoding:'utf8',timeout:20000,windowsHide:true});assert.equal(child.status,86,child.stderr||child.error?.message);
    const io=session(root);await io.session.open();const d=author().prepareEdit(context(),change),raw=await io.sharedStore.read(operationPath(d.operation.id),2097152);await io.session.acceptExternal();assert.deepEqual(io.session.state().accepted.snapshot,d.proposal);assert.equal(await io.sharedStore.read(operationPath(d.operation.id),2097152),raw);assert.equal((await io.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,1);await io.session.close();crashes.push({point,mode:'receive',exitCode:86,recoveredId:d.operation.id});
  });
}
for(const point of ['after-local-state','coordinator:after-document-write','coordinator:after-save-clear','private:temp-partial:events/000000000004.json','private:installed:events/000000000005.json']){
  await test('Actual settings/cache process exit retains or resolves the same save intent: '+point,async()=>{
    const root=await fs.mkdtemp(path.join(BASE,'cache-crash-')),child=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--cache-crash',root,point],{cwd:ROOT,encoding:'utf8',timeout:20000,windowsHide:true});assert.equal(child.status,86,child.stderr||child.error?.message);
    const io=session(root);io.root=root;await io.session.open();const {c,doc}=await coordinator(io);if(c.state().pendingSave)await c.resume();else if(c.state().settingsDraft)await c.saveSettingsDraft(c.state().settingsDraft.id);
    assert.equal((await doc.read()).data.settings.language,'zh');assert.equal((await doc.read()).sequence,2);assert.equal(c.state().settingsDraft,null);assert.deepEqual(io.session.state().accepted.snapshot,empty);assert.equal((await io.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,0);await io.session.close();crashes.push({point,mode:'cache',exitCode:86,recoveredId:null});
  });
}
for(const point of ['after-intent','after-stage','after-publication-intent','after-publication','before-accept','after-accept',
 'private:temp-synced:events/000000000002.json','private:installed:events/000000000002.json',
 'private:temp-synced:events/000000000004.json','private:installed:events/000000000004.json',
 'private:temp-partial:events/000000000002.json','private:temp-partial:events/000000000004.json',
 'shared:temp-partial:'+operationPath(ID(1)),'shared:installed:'+operationPath(ID(1))]){
  await test('Actual process exit recovers: '+point,async()=>{
    const root=await fs.mkdtemp(path.join(BASE,'crash-')),child=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--crash',root,point],{cwd:ROOT,encoding:'utf8',timeout:20000,windowsHide:true});
    assert.equal(child.status,86,child.stderr||child.error?.message);const io=session(root);await io.session.open();
    const d=author().prepareEdit(context(),change);if(io.session.state().pending){assert.deepEqual(io.session.state().pending.operation,d.operation);assert.equal((await io.session.publish()).kind,'accepted');}
    assert.deepEqual(io.session.state().accepted.snapshot,d.proposal);assert.deepEqual(io.session.state().accepted.appliedIds,[d.operation.id]);
    assert.equal((await io.sharedStore.list(`Knowledge Map Sync/v2/${vault}/ops`)).length,1);assert.equal((await io.privateStore.list('intents')).length,1);
    const capabilities=io.privateStore.capabilities();await io.session.close();const again=session(root);await again.session.open();assert.equal(again.session.state().pending,null);assert.deepEqual(again.session.state().accepted.appliedIds,[d.operation.id]);await again.session.close();
    crashes.push({point,exitCode:child.status,recoveredId:d.operation.id,capabilities});
  });
}
const result={date:'2026-11-08 Asia/Shanghai',phase:'external-acceptance-and-save-coordination',passed:checks.length,checks,actualChildCrashes:crashes,
 scope:'Real isolated Node disk/receive/draft recovery and cooperative conditional document writes; not power-cut, Obsidian data.json CAS, native UI, first-import migration or platform device isolation'};
await fs.writeFile(path.join(BASE,'external-persistence-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:checks.length,processCrashes:crashes.length,checks}));
}
