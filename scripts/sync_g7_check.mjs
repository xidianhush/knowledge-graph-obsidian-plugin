import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {device,state} from './sync-g4-helpers.mjs';
import {testMemoryStore} from './sync-host-test-helpers.mjs';
import {readCompatibilityExport} from '../src/sync/local-work-prototype.mjs';
import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';
const tests=[],failures=[],id=n=>n.toString(16).padStart(32,'0');
const destination=()=>({...testMemoryStore(),location:'Synthetic G7 Backup'});
async function edit(d,x){const c=d.capture('Synthetic/A.md',x);await d.h.store.command({},'edit',c.key,c.value);await d.h.settled();}
async function test(name,fn){let d;try{d=await device();d.setSource({...d.source(),unknown:{keep:'original'}});await d.select();await fn(d);tests.push(name);}catch(e){failures.push({name,error:e.message,stack:e.stack});}finally{await d?.h.close();await d?.io.close();}}
async function backup(d,n=1){const output=destination();await d.h.exportRecovery({destination:output,id:id(n)});return output;}
async function preview(d,output,choice='accepted',n=1){return d.h.previewRollback({destination:output,id:id(n),choice});}
await test('Latest accepted export uses current private settings/UI/unknown fields, never stale data.json',async d=>{
 await d.h.saveUi('legend','false');await edit(d,70);const accepted=structuredClone(state(d).accepted),source=d.source();
 assert.notDeepEqual(accepted.snapshot.groups,source.layoutOverrides.groups);await d.h.disable();const output=await backup(d),before=structuredClone(state(d));
 const r=await preview(d,output);assert.equal(r.kind,'rollback-review');assert.deepEqual(r.data.layoutOverrides,accepted.snapshot);
 assert.equal(r.data.ui.legend,'false');assert.deepEqual(r.data.unknown,{keep:'original'});
 assert.equal((await d.h.confirmRollback(r.token)).kind,'compatibility-exported');
 const data=await readCompatibilityExport({source:output,id:r.exportId});assert.deepEqual(data,r.data);assert.deepEqual(d.source(),source);assert.deepEqual(state(d),before);
});
await test('Explicit draft versus accepted selection never silently substitutes or publishes draft',async d=>{
 await d.h.disable();await edit(d,110);const draft=structuredClone(state(d).localState.layoutDraft),output=await backup(d);
 const a=await preview(d,output),b=await preview(d,output,'draft');assert.notDeepEqual(a.data.layoutOverrides.groups,b.data.layoutOverrides.groups);
 assert.deepEqual(b.data.layoutOverrides,draft.value);assert.equal((await d.h.confirmRollback(b.token)).kind,'compatibility-exported');assert.deepEqual(state(d).localState.layoutDraft,draft);
});
await test('Enabled sync refuses export review until explicitly disabled',async d=>{
 const output=await backup(d);assert.equal((await preview(d,output)).reason,'disable-before-rollback');
});
await test('Cancel writes no compatibility file and keeps original state',async d=>{
 await d.h.disable();const output=await backup(d),before=[...output.files],s=structuredClone(state(d));const p=await preview(d,output);d.h.discardReview(p.token);
 assert.equal((await d.h.confirmRollback(p.token)).kind,'held');assert.deepEqual([...output.files],before);assert.deepEqual(state(d),s);
});
await test('New local edit after review expires consent without output',async d=>{
 await d.h.disable();const output=await backup(d),p=await preview(d,output);await edit(d,99);
 assert.equal((await d.h.confirmRollback(p.token)).kind,'held');assert.equal(output.files.has(p.exportId+'/manifest.json'),false);
});
await test('Changed source/graph after review expires consent',async d=>{
 await d.h.disable();const output=await backup(d),p=await preview(d,output);d.setSource({...d.source(),externalUnknown:5});
 assert.equal((await d.h.confirmRollback(p.token)).kind,'held');const q=await preview(d,output);d.setFiles(d.files());assert.equal((await d.h.confirmRollback(q.token)).kind,'held');
});
await test('Damaged full backup refuses export even when selected geometry is unchanged',async d=>{
 await d.h.disable();const output=await backup(d);output.files.set(id(1)+'/join-backup.json','{}');await assert.rejects(()=>preview(d,output),/recovery-export-content/);
});
await test('Unknown shared input cannot be flattened into a compatibility layout',async d=>{
 await d.h.disable();const output=await backup(d),dir='Knowledge Map Sync/attempts-v1/'+d.h.state().selected.vault+'/ops';await d.io.adapter.writeBinary(dir+'/unknown.json',new TextEncoder().encode('{}'));
 await assert.rejects(()=>preview(d,output),/shared-input/);
});
await test('Unfinished publication is backed up but cannot be silently exported as a single current layout',async d=>{
 let once=true;d.hook(step=>{if(once&&step==='after-publication-intent'){once=false;throw Error('G7 pending boundary');}});await edit(d,96);d.hook(()=>{});await d.h.close();d.h=await createUnifiedSyncHost(d.options);assert.ok(state(d).pending);await d.h.disable();const output=await backup(d);
 await assert.rejects(()=>preview(d,output),/rotation-pending/);assert.ok(state(d).pending);
});
await test('Durable same-ID quarantine blocks compatibility export even after sync is disabled',async d=>{
 const h=d.history(),op=structuredClone((await h.scan()).records[0]);op.changes[0].value.points[0].x+=0.01;
 const raw=JSON.stringify((await import('../src/sync/causal-prototype.mjs')).cloneBoundedSyncJson(op)),hash=await (await import('../src/sync/persistence-prototype.mjs')).syncContentHash(raw);
 await h.write(await h.allocate(op.id,hash,[]),raw);await d.h.receive();assert.ok(state(d).attemptConflict);await d.h.disable();const output=await backup(d);
 await assert.rejects(()=>preview(d,output),/rotation-pending/);assert.ok(state(d).attemptConflict);
});
await test('A new same-body physical attempt after review expires the inventory consent',async d=>{
 await d.h.disable();const output=await backup(d),p=await preview(d,output),hist=d.history(),scan=await hist.scan(),row=scan.inventory[0];
 await hist.write(await hist.allocate(scan.records[0].id,row.hash,[]),new TextDecoder().decode(await d.io.adapter.readBinary(row.name)));
 assert.equal((await d.h.confirmRollback(p.token)).kind,'held');assert.equal(output.files.has(p.exportId+'/manifest.json'),false);
});
await test('Partial output failure leaves no completion manifest; fresh retry is independently verified',async d=>{
 await d.h.disable();const output=await backup(d),p=await preview(d,output),create=output.create;output.create=async(name,raw)=>{if(name===p.exportId+'/data.json')throw Error('injected-space-failure');return create(name,raw);};
 await assert.rejects(()=>d.h.confirmRollback(p.token),/injected-space-failure/);assert.equal(output.files.has(p.exportId+'/manifest.json'),false);
 output.create=create;const q=await preview(d,output);assert.notEqual(q.exportId,p.exportId);assert.equal((await d.h.confirmRollback(q.token)).kind,'compatibility-exported');await readCompatibilityExport({source:output,id:q.exportId});
});
await test('External source change during output leaves body only and no success manifest',async d=>{
 await d.h.disable();const output=await backup(d),p=await preview(d,output),create=output.create;output.create=async(name,raw)=>{const r=await create(name,raw);if(name===p.exportId+'/data.json')d.setSource({...d.source(),arrived:'during write'});return r;};
 assert.equal((await d.h.confirmRollback(p.token)).kind,'held');assert.equal(output.files.has(p.exportId+'/manifest.json'),false);
});
await test('Source change while completion marker is written cannot report successful rollback export',async d=>{
 await d.h.disable();const output=await backup(d),p=await preview(d,output),create=output.create;output.create=async(name,raw)=>{const result=await create(name,raw);if(name===p.exportId+'/manifest.json')d.setSource({...d.source(),arrived:'during manifest'});return result;};
 assert.equal((await d.h.confirmRollback(p.token)).kind,'held');
});
await test('Only exact generated directories during active export are excluded from graph invalidation',async d=>{
 await d.h.disable();const output=await backup(d),p=await preview(d,output),create=output.create,folder=output.location+'/'+p.exportId;
 assert.equal(d.h.isExportEvent(folder),false);let observed=false;output.create=async(name,raw)=>{observed=true;assert.equal(d.h.isExportEvent(folder),true);assert.equal(d.h.isExportEvent(folder+'/note.md'),false);assert.equal(d.h.isExportEvent('Synthetic/A.md'),false);assert.equal(d.h.isExportEvent(folder,'Synthetic'),false);return create(name,raw);};
 assert.equal((await d.h.confirmRollback(p.token)).kind,'compatibility-exported');assert.equal(observed,true);assert.equal(d.h.isExportEvent(folder),false);
});
await test('Private soft pause still allows current accepted compatibility export without new ledger writes',async d=>{
 await d.h.disable();await d.h.close();d.options.budgetLimits={softEvents:1};d.h=await createUnifiedSyncHost(d.options);assert.equal(d.h.state().status,'local-paused');
 const output=await backup(d),before=structuredClone(state(d)),p=await preview(d,output);assert.equal((await d.h.confirmRollback(p.token)).kind,'compatibility-exported');assert.deepEqual(state(d),before);
});
await test('Root selection and connection remain original after export and host cold reopen',async d=>{
 await d.h.disable();const output=await backup(d),p=await preview(d,output),before=structuredClone(state(d)),selected=d.h.state().selected;await d.h.confirmRollback(p.token);await d.h.close();d.h=await createUnifiedSyncHost(d.options);
 assert.deepEqual(state(d),before);assert.deepEqual(d.h.state().selected,selected);assert.equal(d.h.state().status,'local-ready');
});
await fs.mkdir('.local/sync-016/g7',{recursive:true});const out=await fs.mkdtemp('.local/sync-016/g7/check-');
const result={pass:failures.length===0,tests,failures,out,scope:'Real production graph/store/unified host, synthetic App/shared/private adapters; no native/iPad/process claims'};
await fs.writeFile(out+'/summary.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(failures.length)process.exitCode=1;
