import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {device,state,relay} from './sync-g4-helpers.mjs';
import {testMemoryStore} from './sync-host-test-helpers.mjs';
import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';
import {createSyncConnectionCatalog} from '../src/sync/connection-catalog.mjs';
import {createRecoveryDestination} from '../src/sync/recovery-export.mjs';
const tests=[],failures=[];
const id=n=>n.toString(16).padStart(32,'0');
const dest=()=>({...testMemoryStore(),location:'Synthetic Recovery'});
async function test(name,fn){let d;try{d=await device();await d.select();await fn(d);tests.push(name);}catch(e){failures.push({name,error:e.message,stack:e.stack});}finally{await d?.h.close();await d?.io.close();}}
async function edit(d,dx=40){const c=d.capture('Synthetic/A.md',dx);await d.h.store.command({},'edit',c.key,c.value);await d.h.settled();}
async function reopen(d){await d.h.close();d.h=await createUnifiedSyncHost(d.options);}
await test('Paused export includes complete current accepted/draft/originals without private writes',async d=>{
 await edit(d);const a=structuredClone(state(d).accepted);await d.h.disable();await edit(d,70);
 await d.h.close();d.options.budgetLimits={softEvents:1};d.h=await createUnifiedSyncHost(d.options);
 assert.equal(d.h.state().status,'local-paused');const before=state(d).sequence,output=dest();
 const r=await d.h.exportRecovery({destination:output,id:id(1)});assert.equal(r.kind,'exported');
 assert.equal(state(d).sequence,before);assert.deepEqual(JSON.parse(output.files.get(id(1)+'/accepted.json')),a.snapshot);
 assert.ok(JSON.parse(output.files.get(id(1)+'/drafts.json')).layoutDraft);
 assert.ok(output.files.has(id(1)+'/initial-config.json'));assert.ok(output.files.has(id(1)+'/join-backup.json'));
 const report=await d.h.diagnostics();assert.ok(report.privateBudget.paused);assert.ok(report.privateBudget.triggers.includes('events'));
});
await test('Failed export is incomplete and retry preserves fixed contents',async d=>{
 const output=dest(),create=output.create;let n=0;output.create=async(...args)=>{if(++n===3)throw Error('injected-full');return create(...args);};
 await assert.rejects(()=>d.h.exportRecovery({destination:output,id:id(2)}),/injected-full/);assert.equal(output.files.has(id(2)+'/manifest.json'),false);
 output.create=create;assert.equal((await d.h.exportRecovery({destination:output,id:id(2)})).kind,'exported');
});
await test('Targeted catalog ignores unrelated saturated content but validates root topology',async d=>{
 const target=d.h.state().selected,adapter=d.io.adapter,list=adapter.list;
 const other='Knowledge Map Sync/attempts-v1/'+id(999),base='Knowledge Map Sync/attempts-v1';
 adapter.list=async p=>{const row=await list(p);if(p===base)return {...row,folders:[...row.folders,other]};return row;};
 const stat=adapter.stat;adapter.stat=async p=>[other,other+'/ops'].includes(p)?{type:'folder',size:0}:stat(p);
 adapter.list=(()=>{const prev=adapter.list;return async p=>p===other?{files:[],folders:[other+'/ops']}:p===other+'/ops'?{files:Array.from({length:1025},(_,i)=>other+'/ops/'+i+'.json'),folders:[]}:prev(p);})();
 const catalog=createSyncConnectionCatalog({adapter});assert.equal((await catalog.scan()).kind,'held');
 assert.equal((await catalog.scan({target})).kind,'catalog');
 const prev=adapter.list;adapter.list=async p=>p===base?{files:[base+'/unknown'],folders:[]}:prev(p);
 assert.equal((await catalog.scan({target})).kind,'held');
});
await test('Rotation selects latest accepted, keeps old bytes and cold-opens one new root',async d=>{
 await edit(d);const accepted=structuredClone(state(d).accepted),old=d.h.state().selected.vault,output=dest();
 await d.h.exportRecovery({destination:output,id:id(3)});
 const p=await d.h.previewRotation({destination:output,id:id(3),choice:'accepted'});assert.equal(p.kind,'rotation-review');
 d.h.discardReview(p.token);assert.equal(d.h.state().selected.vault,old);
 const q=await d.h.previewRotation({destination:output,id:id(3),choice:'accepted'});assert.equal((await d.h.confirmRotation(q.token)).kind,'rotated');
 assert.notEqual(d.h.state().selected.vault,old);assert.deepEqual(state(d).accepted.snapshot.groups,accepted.snapshot.groups);assert.equal(state(d).accepted.operations.length,1);
 const root=state(d).accepted.operations[0].id;await reopen(d);assert.equal(state(d).accepted.operations[0].id,root);assert.deepEqual(state(d).accepted.snapshot.groups,accepted.snapshot.groups);
});
await test('Paused saved draft can explicitly become a new root without clearing old draft',async d=>{
 await d.h.disable();await edit(d,81);const draft=structuredClone(state(d).localState.layoutDraft),old=d.h.state().selected.vault;
 await d.h.close();d.options.budgetLimits={softEvents:1};d.h=await createUnifiedSyncHost(d.options);
 const output=dest();await d.h.exportRecovery({destination:output,id:id(4)});
 const p=await d.h.previewRotation({destination:output,id:id(4),choice:'draft'});assert.equal(p.kind,'rotation-review');
 // The injected soft gate belongs to the old session; new namespace opens under defaults.
 delete d.options.budgetLimits;
 assert.equal((await d.h.confirmRotation(p.token)).kind,'rotated');
 assert.deepEqual(state(d).accepted.snapshot.groups,draft.value.groups);
 assert.ok((await d.options.openBackend({vault:old})).files.size>0);
});
await test('Changed backup or source epoch expires rotation without selecting a target',async d=>{
 const output=dest(),old=d.h.state().selected.vault;await d.h.exportRecovery({destination:output,id:id(5)});
 const p=await d.h.previewRotation({destination:output,id:id(5),choice:'accepted'});d.setFiles(d.files());
 assert.equal((await d.h.confirmRotation(p.token)).kind,'held');assert.equal(d.h.state().selected.vault,old);
 output.files.set(id(5)+'/accepted.json','null');
 await assert.rejects(()=>d.h.previewRotation({destination:output,id:id(5),choice:'accepted'}));assert.equal(d.h.state().selected.vault,old);
});
for(const stop of ['rotation:after-intent','rotation:after-disable','selection:after-selection-connect','rotation:after-selection','after-join-choice','after-intent','after-publication','rotation:after-root'])await test('Interrupted rotation resumes the same target/root at '+stop,async d=>{
 await edit(d);const expected=structuredClone(state(d).accepted.snapshot),old=d.h.state().selected.vault,output=dest();await d.h.exportRecovery({destination:output,id:id(8)});
 const p=await d.h.previewRotation({destination:output,id:id(8),choice:'accepted'});let once=true;d.hook(step=>{if(once&&step===stop){once=false;throw Error('injected-rotation-stop');}});
 await assert.rejects(()=>d.h.confirmRotation(p.token),/injected-rotation-stop/);assert.equal(once,false);
 d.hook(()=>{});await reopen(d);const intent=d.h.state().rotationPending;assert.equal(intent.target,p.target);assert.equal(intent.rootId,p.rootId);
 assert.equal((await d.h.receive()).reason,'rotation-review-required');assert.equal((await d.h.previewSelection({action:'new'})).kind,'held');
 const r=await d.h.previewRotationResume({destination:output});d.h.discardReview(r.token);assert.ok(d.h.state().rotationPending);
 const q=await d.h.previewRotationResume({destination:output});assert.equal((await d.h.confirmRotation(q.token)).kind,'rotated');
 assert.notEqual(d.h.state().selected.vault,old);assert.equal(state(d).accepted.operations[0].id,p.rootId);assert.deepEqual(state(d).accepted.snapshot.groups,expected.groups);
});
await test('Own partial root attempt is retained and retry uses the original logical ID',async d=>{
 const output=dest();await d.h.exportRecovery({destination:output,id:id(9)});const p=await d.h.previewRotation({destination:output,id:id(9),choice:'accepted'});
 const write=d.io.adapter.writeBinary;let once=true;d.io.adapter.writeBinary=async(path,bytes)=>{if(once&&path.includes(p.target)){once=false;await write(path,new Uint8Array(bytes).slice(0,83));throw Error('injected-partial');}return write(path,bytes);};
 assert.notEqual((await d.h.confirmRotation(p.token)).kind,'rotated');assert.equal(once,false);await reopen(d);const r=await d.h.previewRotationResume({destination:output});assert.equal((await d.h.confirmRotation(r.token)).kind,'rotated');assert.equal(state(d).accepted.operations[0].id,p.rootId);
});
await test('Unfinished publication can be backed up but never flattened by rotation',async d=>{
 d.hook(step=>{if(step==='after-intent')throw Error('injected-pending');});await edit(d);assert.ok(state(d).faulted);d.hook(()=>{});await reopen(d);assert.ok(state(d).pending);
 const output=dest();await d.h.exportRecovery({destination:output,id:id(10)});assert.ok(JSON.parse(output.files.get(id(10)+'/pending-operation.json')));
 await assert.rejects(()=>d.h.previewRotation({destination:output,id:id(10),choice:'accepted'}),/rotation-pending/);
});
await test('Same-ID changed shared body cannot authorize rotation even with identical projection',async d=>{
 const output=dest();await d.h.exportRecovery({destination:output,id:id(11)});const history=d.history(),scan=await history.scan(),original=scan.inventory[0].name;
 const op=structuredClone(state(d).accepted.operations[0]);op.changes.reverse();const body=JSON.stringify((await import('../src/sync/causal-prototype.mjs')).cloneBoundedSyncJson(op)),hash=await (await import('../src/sync/persistence-prototype.mjs')).syncContentHash(body);
 const stat=d.io.adapter.stat,list=d.io.adapter.list;d.io.adapter.stat=p=>p===original?Promise.resolve(null):stat(p);d.io.adapter.list=async p=>{const row=await list(p);return {...row,files:row.files.filter(n=>n!==original)};};
 await history.write(await history.allocate(op.id,hash,[]),body);const accepted=structuredClone(state(d).accepted);
 await assert.rejects(()=>d.h.previewRotation({destination:output,id:id(11),choice:'accepted'}),/rotation-shared/);assert.deepEqual(state(d).accepted,accepted);
});
await test('Graph epoch changing during root write keeps durable rotation for fresh review',async d=>{
 const output=dest();await d.h.exportRecovery({destination:output,id:id(12)});const p=await d.h.previewRotation({destination:output,id:id(12),choice:'accepted'}),write=d.io.adapter.writeBinary;let once=true;
 d.io.adapter.writeBinary=async(name,bytes)=>{await write(name,bytes);if(once&&name.includes(p.target)){once=false;d.setFiles(d.files());}};
 assert.notEqual((await d.h.confirmRotation(p.token)).kind,'rotated');assert.ok(d.h.state().rotationPending);
});
await test('The 32-namespace topology refuses rotation before any control intent or switch',async d=>{
 const output=dest();await d.h.exportRecovery({destination:output,id:id(13)});const list=d.io.adapter.list,base='Knowledge Map Sync/attempts-v1';
 d.io.adapter.list=async p=>{const r=await list(p);return p===base?{...r,folders:[...r.folders,...Array.from({length:31},(_,n)=>base+'/'+id(100+n))]}:r;};
 const old=d.h.state().selected.vault,p=await d.h.previewRotation({destination:output,id:id(13),choice:'accepted'});assert.equal(p.kind,'held');assert.equal(p.reason,'namespace-budget');assert.equal(d.h.state().rotationPending,null);assert.equal(d.h.state().selected.vault,old);
});
await test('An extra same-body physical attempt invalidates rotation consent',async d=>{
 const output=dest();await d.h.exportRecovery({destination:output,id:id(14)});const p=await d.h.previewRotation({destination:output,id:id(14),choice:'accepted'}),hist=d.history(),scan=await hist.scan(),row=scan.inventory[0],raw=await d.io.adapter.readBinary(row.name);
 await hist.write(await hist.allocate(scan.records[0].id,row.hash,[]),new TextDecoder().decode(raw));assert.equal((await d.h.confirmRotation(p.token)).kind,'held');assert.equal(d.h.state().rotationPending,null);
});
await test('Old offline device writes only old namespace; explicit new join remains separate',async d=>{
 const b=await device();try{
  await relay(d,b);await b.adopt(d);const old=b.h.state().selected.vault,output=dest();await d.h.exportRecovery({destination:output,id:id(15)});const p=await d.h.previewRotation({destination:output,id:id(15),choice:'accepted'});await d.h.confirmRotation(p.token);const current=structuredClone(state(d).accepted);
  await edit(b,123);await relay(b,d);assert.deepEqual(state(d).accepted,current);assert.equal((await d.h.receive()).kind,'noop');assert.equal(b.h.state().selected.vault,old);
  await relay(d,b);await b.h.disable();const q=await b.h.previewSelection({action:'join',...d.h.state().selected});await b.h.confirmSelection(q.token);const join=await b.h.previewJoin();await b.h.confirmJoin(join.token,'shared');assert.deepEqual(state(b).accepted.snapshot.groups,current.snapshot.groups);
 }finally{await b.h.close();await b.io.close();}
});
await test('Changed old inventory after intent can explicitly cancel before switching, without losing work',async d=>{
 const output=dest();await d.h.exportRecovery({destination:output,id:id(16)});const p=await d.h.previewRotation({destination:output,id:id(16),choice:'accepted'});let once=true;
 d.hook(step=>{if(once&&step==='rotation:after-intent'){once=false;throw Error('injected-stop');}});await assert.rejects(()=>d.h.confirmRotation(p.token));d.hook(()=>{});
 const hist=d.history(),scan=await hist.scan(),row=scan.inventory[0];await hist.write(await hist.allocate(scan.records[0].id,row.hash,[]),new TextDecoder().decode(await d.io.adapter.readBinary(row.name)));
 await reopen(d);const before=structuredClone(state(d)),old=d.h.state().selected.vault;
 const cancel=await d.h.previewRotationAbort();assert.equal(cancel.kind,'rotation-abort-review');assert.equal((await d.h.confirmRotationAbort(cancel.token)).kind,'rotation-aborted');assert.equal(d.h.state().rotationPending,null);assert.equal(d.h.state().selected.vault,old);assert.deepEqual(state(d),before);
});
await test('Full shared inventory permits backed-up unwritten pending to be explicitly abandoned and draft-rotated',async d=>{
 const hist=d.history(),scan=await hist.scan(),row=scan.inventory[0],text=new TextDecoder().decode(await d.io.adapter.readBinary(row.name));
 let once=true;d.hook(step=>{if(once&&step==='after-publication-intent'){once=false;throw Error('injected-before-any-path');}});await edit(d,91);d.hook(()=>{});await reopen(d);
 // Controlled physical-count boundary case, not a distinct-operation capacity claim.
 for(let n=1;n<1024;n++)await hist.write(await hist.allocate(scan.records[0].id,row.hash,[]),text);
 assert.ok(state(d).pending?.publicationAttempted);assert.equal(state(d).pending.attempts.length,0);const originalPending=state(d).pending.id,output=dest();await d.h.exportRecovery({destination:output,id:id(17)});
 const p=await d.h.previewAbandonPublication({destination:output,id:id(17)});assert.equal(p.kind,'abandon-review');assert.equal((await d.h.confirmAbandonPublication(p.token)).kind,'abandoned');assert.equal(state(d).pending,null);assert.ok(state(d).localState.layoutDraft);
 await reopen(d);assert.equal(state(d).pending,null);assert.equal((await hist.scan()).inventory.length,1024);assert.equal(JSON.parse(output.files.get(id(17)+'/pending-operation.json')).id,originalPending);
 await d.h.exportRecovery({destination:output,id:id(18)});const r=await d.h.previewRotation({destination:output,id:id(18),choice:'draft'});assert.equal((await d.h.confirmRotation(r.token)).kind,'rotated');
});
await test('Same-process cancel after disabling reopens old local session without a cold restart',async d=>{
 const output=dest();await d.h.exportRecovery({destination:output,id:id(19)});const r=await d.h.previewRotation({destination:output,id:id(19),choice:'accepted'});let once=true;d.hook(step=>{if(once&&step==='rotation:after-disable'){once=false;throw Error('injected-disabled-stop');}});await assert.rejects(()=>d.h.confirmRotation(r.token));d.hook(()=>{});
 const p=await d.h.previewRotationAbort();assert.equal((await d.h.confirmRotationAbort(p.token)).kind,'rotation-aborted');assert.equal(d.h.state().status,'local-ready');assert.ok(state(d).accepted);assert.equal((await d.h.exportRecovery({destination:output,id:id(20)})).kind,'exported');
});
await test('Vault destination excludes Windows case/trailing-dot aliases of private/shared roots',async()=>{
 const vault={create(){},read(){},getAbstractFileByPath(){},createFolder(){}};
 for(const folder of ['.OBSIDIAN/backups','Knowledge Map Sync./backups','knowledge map sync/backups'])assert.throws(()=>createRecoveryDestination({vault,folder}),/destination/);
});
await fs.mkdir('.local/sync-016/g6',{recursive:true});const out=await fs.mkdtemp('.local/sync-016/g6/check-');
const result={pass:!failures.length,tests,failures,scope:'Production graph/store/host/session with synthetic App/shared/private adapters; not native/iPad/OS space.',out};await fs.writeFile(out+'/summary.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(failures.length)process.exitCode=1;
