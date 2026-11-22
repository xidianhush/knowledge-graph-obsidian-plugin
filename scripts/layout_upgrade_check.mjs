import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createLayoutModel,createLayoutStore} from '../dist/graph-core.mjs';
import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';
import {fixture} from './sync-auto-publish-test-helpers.mjs';
import {testLocalApp,testLockManager,testMemoryStore} from './sync-host-test-helpers.mjs';
import {validateTestSettings} from './sync-settings-test-helpers.mjs';
import {planHistoricalLayout} from '../src/sync/historical-layout.mjs';
import {device as headingDevice,seedFiles} from './sync-g4-helpers.mjs';
import {buildGraph} from '../dist/pipeline.mjs';
import {validateSchema3Snapshot} from '../src/sync/layout-prototype.mjs';
export const nodes=()=>[{id:'P',kind:'folder',x:0,y:0,r:100,depth:1},
 {id:'P/A',path:'P/A.md',parent:'P',kind:'note',x:-25,y:0,r:20,depth:2},
 {id:'P/B',path:'P/B.md',parent:'P',kind:'note',x:25,y:0,r:20,depth:2}];
export function saved(){const n=nodes(),m=createLayoutModel(n,200);n[1].y=15;n[2].y=15;const k=m.groupKey('P/A');return {schemaVersion:3,revision:3,groups:{[k]:m.capture(k)},structures:{}};}
export async function device({data={layoutOverrides:saved()},makeNodes=nodes}={}){
 const io=await fixture(),app=testLocalApp(),backends=new Map();let source=structuredClone({settings:{language:'zh'},ui:{keep:'yes'},unknown:42,...data}),epoch=0,graph=true,failSave=false,hook=()=>{};
 const createModel=()=>createLayoutModel(makeNodes(),200);
 const options={app,pluginId:'upgrade-test',adapter:io.adapter,locks:testLockManager(),readSource:async()=>structuredClone(source),saveUnjoined:async(next,{expected})=>{await hook();if(failSave)throw Error('synthetic-save-failure');assert.deepEqual(source,expected);source=structuredClone(next);},createStore:createLayoutStore,validateSettings:validateTestSettings,
  openBackend:async({vault})=>{if(!backends.has(vault))backends.set(vault,testMemoryStore());return backends.get(vault);},getGraph:()=>graph?{hidden:false,isCurrent:()=>true,createModel}:null,getEpoch:()=>epoch};
 const host=await createUnifiedSyncHost(options);
 return {host,options,io,app,backends,createModel,source:()=>structuredClone(source),setSource:v=>source=structuredClone(v),bump:()=>epoch++,graph:v=>graph=v,fail:v=>failSave=v,hook:v=>hook=v,
  async select(){const p=await host.previewSelection({action:'new'});assert.equal((await host.confirmSelection(p.token)).kind,'selected');},
  async join(){const p=await host.previewJoin();assert.equal(p.kind,'join-preview');assert.equal((await host.confirmJoin(p.token,'import')).kind,'joined');},
  async prepare(){return host.prepareLocalGraph({createModel,isCurrent:()=>graph,epoch});},async close(){await host.close();await io.close();}};
}
const grown=()=>{const n=nodes();n[1].r=21;return n;},key=Object.keys(saved().groups)[0];
const checks=[],failures=[];async function test(name,fn){try{await fn();checks.push(name);}catch(e){failures.push({name,error:String(e.stack)});}}
await test('Unjoined upgrade coordinates survive a radius change and retain complete original layout',async()=>{
 const d=await device({makeNodes:grown});try{assert.equal(d.createModel().apply(d.source().layoutOverrides).skipped,1);const before=d.source();assert.equal((await d.prepare()).kind,'local-reconciled');const g=grown();const r=createLayoutModel(g,200).apply(d.host.store.state());assert.equal(r.skipped,0);assert.equal(g[1].y,15);assert.equal(g[2].y,15);assert.deepEqual(d.source().layoutUpgradeOriginal.layoutOverrides,before.layoutOverrides);assert.equal(d.source().unknown,42);assert.equal(d.app.writes(),0);assert.equal((await d.prepare()).kind,'unchanged');}finally{await d.close();}
});
await test('Same graph upgrade is a no-op without identity or config writes',async()=>{const d=await device();try{const before=d.source();assert.equal((await d.prepare()).kind,'unchanged');assert.deepEqual(d.source(),before);assert.equal(d.app.writes(),0);}finally{await d.close();}});
await test('Migration save failure, stale epoch and edit lock retain original source and store',async()=>{
 for(const reason of ['save','epoch','lock']){const d=await device({makeNodes:grown});try{const before=d.source(),store=d.host.store.state(),guard=reason==='lock'?d.host.store.reserveExternal(x=>x):null;if(reason==='save')d.fail(true);if(reason==='epoch')d.bump();try{await d.host.prepareLocalGraph({createModel:d.createModel,isCurrent:()=>true,epoch:0});assert.notEqual(reason,'save');}catch(e){assert.equal(reason,'save');}assert.deepEqual(d.source(),before);assert.deepEqual(d.host.store.state().groups,store.groups);guard?.release();}finally{await d.close();}}
});
await test('Selected unjoined reconciles locally; joined disabled never takes unjoined migration path',async()=>{
 const d=await device();try{await d.select();assert.equal((await d.prepare()).kind,'unchanged');await d.join();await d.host.disable();const before=d.source();assert.equal((await d.prepare()).reason,'already-joined');assert.deepEqual(d.source(),before);}finally{await d.close();}
});
await test('Mixed historical records remain archived and do not block usable local groups',async()=>{
 const raw=saved();raw.groups['["folder","Missing",""]']=structuredClone(raw.groups[key]);const d=await device({data:{layoutOverrides:raw},makeNodes:grown});try{await d.prepare();assert.ok(d.source().layoutOverrides.groups['["folder","Missing",""]']);assert.deepEqual(d.source().layoutUpgradeOriginal.layoutOverrides,raw);assert.equal(d.createModel().apply(d.host.store.state()).restored,1);}finally{await d.close();}
});
await test('Restore preview has per-group classification and cancellation never writes',async()=>{
 const d=await device({makeNodes:grown});try{const before=d.source(),p=await d.host.previewHistoricalRestore({readBackup:async()=>before});assert.equal(p.kind,'historical-restore-review');assert.equal(p.rows.length,1);assert.equal(p.rows[0].status,'exact');assert.equal(p.rows[0].maxDisplacement,0);d.host.discardHistoricalRestore(p.token);assert.deepEqual(d.source(),before);assert.equal((await d.host.confirmHistoricalRestore(p.token,{groups:[key]})).kind,'held');}finally{await d.close();}
});
await test('Unjoined selective restore verifies full pre-change backup and preserves unrelated configuration',async()=>{
 const d=await device({data:{layoutOverrides:{schemaVersion:3,revision:0,groups:{},structures:{}}},makeNodes:grown}),dst={...testMemoryStore(),location:'Synthetic Backups'};try{const before=d.source(),p=await d.host.previewHistoricalRestore({readBackup:async()=>({layoutOverrides:saved()})});const r=await d.host.confirmHistoricalRestore(p.token,{groups:[key],destination:dst,backupId:'b'.repeat(32)});assert.equal(r.kind,'restored-local');assert.deepEqual(JSON.parse(dst.files.get('b'.repeat(32)+'/initial-config.json')),before);assert.equal(d.source().ui.keep,'yes');assert.equal(d.createModel().apply(d.source().layoutOverrides).restored,1);}finally{await d.close();}
});
await test('Joined restore only stages a durable layout draft; explicit publication and cold reopen retain it',async()=>{
 const d=await device(),dst={...testMemoryStore(),location:'Synthetic Backups'};try{await d.select();await d.join();const before=d.host.state().session,config=await d.host.effective();const raw=saved();raw.groups[key].points.forEach(p=>p.y=-.15);const p=await d.host.previewHistoricalRestore({readBackup:async()=>({layoutOverrides:raw})});assert.equal((await d.host.confirmHistoricalRestore(p.token,{groups:[key],destination:dst,backupId:'c'.repeat(32)})).kind,'restore-staged');await d.host.settled();assert.equal(d.host.state().session.accepted.operations.length,before.accepted.operations.length);assert.ok(d.host.state().session.localState.layoutDraft);assert.equal(d.host.state().session.localState.settingsDraft,null);assert.equal((await d.host.effective()).settings.language,config.settings.language);await d.host.close();const cold=await createUnifiedSyncHost(d.options);assert.ok(cold.state().session.localState.layoutDraft);assert.equal(cold.state().session.accepted.operations.length,1);const pub=await cold.previewPublication();assert.equal(pub.kind,'publication-review');await cold.confirmPublication(pub.token);assert.equal(cold.state().session.accepted.operations.length,2);await cold.close();}finally{await d.close();}
});
await test('Backup or graph changes expire review before backup writes; no selection does not restore',async()=>{
 for(const change of ['backup','graph','none']){const d=await device(),dst={...testMemoryStore(),location:'Synthetic Backups'};let raw={layoutOverrides:saved()};try{const p=await d.host.previewHistoricalRestore({readBackup:async()=>structuredClone(raw)});if(change==='backup')raw={layoutOverrides:{...saved(),revision:9}};if(change==='graph')d.bump();const r=await d.host.confirmHistoricalRestore(p.token,{groups:change==='none'?[]:[key],destination:dst,backupId:'d'.repeat(32)});assert.equal(r.kind,'held');assert.equal(dst.files.size,0);}finally{await d.close();}}
});
await test('Unjoined edits retain untouched invalid history but reject newly invalid geometry',async()=>{
 const raw=saved(),missing='["folder","Missing",""]';raw.groups[missing]=structuredClone(raw.groups[key]);const d=await device({data:{layoutOverrides:raw},makeNodes:grown});try{await d.prepare();const next=d.source().layoutOverrides;next.groups[key].points.forEach(p=>p.y=-.15);assert.equal((await d.host.saveLayout(next)).kind,'saved-local');assert.deepEqual(d.source().layoutOverrides.groups[missing],raw.groups[missing]);const bad=structuredClone(next);bad.groups[key].points[0].x=100;await assert.rejects(d.host.saveLayout(bad));}finally{await d.close();}
});
await test('Default recovery reads retained original data and automatic current geometry is available for preview',async()=>{
 const d=await device({data:{layoutOverrides:{schemaVersion:3,revision:0,groups:{},structures:{}},layoutUpgradeOriginal:{version:1,layoutOverrides:saved()}}});try{const p=await d.host.previewHistoricalRestore();assert.equal(p.kind,'historical-restore-review');assert.ok(p.rows[0].current);assert.equal(p.rows[0].current.groups[key].points[0].y,0);d.host.discardHistoricalRestore(p.token);}finally{await d.close();}
});
await test('Malformed known-group history is retained without blocking usable sibling groups or graph preparation',async()=>{
 const raw=saved();raw.groups.root={shape:[null],points:[]};const d=await device({data:{layoutOverrides:raw},makeNodes:grown});try{await d.prepare();assert.deepEqual(d.source().layoutOverrides.groups.root,raw.groups.root);assert.deepEqual(d.source().layoutUpgradeOriginal.layoutOverrides,raw);assert.equal(d.createModel().apply(d.host.store.state()).restored,1);}finally{await d.close();}
});
await test('Malformed unrelated structure tables never reach the historical preview renderer',async()=>{
 const raw=saved();raw.structures.orphan=null;const p=planHistoricalLayout({sourceLayout:raw,currentLayout:saved(),createModel:()=>createLayoutModel(nodes(),200)});assert.equal(p.rows[0].status,'exact');assert.deepEqual(p.rows[0].source.structures,{});assert.equal(raw.structures.orphan,null);
});
await test('Radii requiring safety adjustments are classified and their center displacement is disclosed',async()=>{
 const p=planHistoricalLayout({sourceLayout:saved(),currentLayout:saved(),createModel:()=>{const n=nodes();n[1].r=40;n[2].r=40;return createLayoutModel(n,200);}});assert.equal(p.rows[0].status,'adjusted');assert.equal(p.rows[0].moved,2);assert.ok(p.rows[0].maxDisplacement>0);assert.equal(createLayoutModel((()=>{const n=nodes();n[1].r=40;n[2].r=40;return n;})(),200).apply(p.rows[0].target).skipped,0);
});
await test('Empty source, malformed version and unsafe selected group never produce a restore',async()=>{
 const d=await device();try{await assert.rejects(d.host.previewHistoricalRestore({readBackup:async()=>({layoutOverrides:{schemaVersion:99,revision:0,groups:{}}})}));const raw=saved();raw.groups[key].points[0].x=100;const p=await d.host.previewHistoricalRestore({readBackup:async()=>({layoutOverrides:raw})});assert.equal(p.rows[0].status,'unavailable');await assert.rejects(d.host.confirmHistoricalRestore(p.token,{groups:[key]}));}finally{await d.close();}
});
await test('Backup write failure and graph change after backup leave the accepted layout and draft untouched',async()=>{
 for(const mode of ['failure','epoch']){const d=await device();try{await d.select();await d.join();const before=d.host.state().session.accepted,raw=saved();raw.groups[key].points.forEach(p=>p.y=-.15);const r=await d.host.previewHistoricalRestore({readBackup:async()=>({layoutOverrides:raw})}),mem=testMemoryStore(),dst={...mem,location:'Synthetic Backups',async create(name,text){if(mode==='failure')throw Error('synthetic-backup-failure');const result=await mem.create(name,text);if(name.endsWith('/manifest.json'))d.bump();return result;}};try{assert.equal((await d.host.confirmHistoricalRestore(r.token,{groups:[key],destination:dst,backupId:'e'.repeat(32)})).kind,'held');assert.equal(mode,'epoch');}catch(e){assert.equal(mode,'failure');assert.match(e.message,/synthetic-backup-failure/);}assert.deepEqual(d.host.state().session.accepted,before);assert.equal(d.host.state().session.localState?.layoutDraft??null,null);}finally{await d.close();}}
});
await test('Complete store snapshots retain heading identities and isolate callers without expanding display state',async()=>{
 const d=await headingDevice();try{const before=d.source().layoutOverrides;assert.equal(typeof d.h.store.snapshot,'function');const snapshot=d.h.store.snapshot();assert.deepEqual(snapshot,before);validateSchema3Snapshot(snapshot);snapshot.structures[Object.keys(snapshot.structures)[0]][0].title='changed outside store';snapshot.groups={};assert.deepEqual(d.h.store.snapshot(),before);assert.equal(Object.hasOwn(d.h.store.state(),'structures'),false);}finally{await d.close();}
});
await test('Joined disabled cold restore keeps unselected heading groups and their identity tables in a durable draft',async()=>{
 const d=await headingDevice(),dst={...testMemoryStore(),location:'Synthetic Backups'};let h=d.h;
 try{
  await d.select();await h.disable();await h.close();h=await createUnifiedSyncHost(d.options);await h.graphReady();
  const accepted=structuredClone(h.state().session.accepted),selection=structuredClone(h.state().selected),source=d.source();
  const g=buildGraph({files:seedFiles,config:{include:['Synthetic/**']}}),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),folder=m.groupKey(g.nodes.find(n=>n.kind==='note').id),record=m.capture(folder,true);
  record.points=record.points.map(p=>({...p,x:-p.y||0,y:p.x||0}));const historical={layoutOverrides:{schemaVersion:3,revision:4,groups:{[folder]:record},structures:{}}};
  const p=await h.previewHistoricalRestore({readBackup:async()=>historical});assert.equal(p.rows[0].status,'exact');
  assert.equal((await h.confirmHistoricalRestore(p.token,{groups:[folder],destination:dst,backupId:'f'.repeat(32)})).kind,'restore-staged');
  await h.settled();const draft=h.state().session.localState.layoutDraft.value;validateSchema3Snapshot(draft);
  assert.deepEqual(draft.structures,accepted.snapshot.structures);for(const [k,r]of Object.entries(accepted.snapshot.groups))assert.deepEqual(draft.groups[k],r);
  assert.deepEqual(draft.groups[folder].points,record.points);assert.deepEqual(h.state().session.accepted,accepted);assert.deepEqual(h.state().selected,selection);assert.deepEqual(d.source(),source);assert.equal(h.state().session.localState.settingsDraft,null);
  assert.deepEqual(JSON.parse(dst.files.get('f'.repeat(32)+'/join-backup.json')),source);assert.ok(dst.files.has('f'.repeat(32)+'/manifest.json'));
  await h.close();h=await createUnifiedSyncHost(d.options);assert.equal(h.state().status,'local-ready');assert.equal((await h.graphReady()).kind,'projected');assert.deepEqual(h.store.snapshot().groups,draft.groups);assert.deepEqual(h.store.snapshot().structures,draft.structures);assert.deepEqual(h.state().session.accepted,accepted);
  await h.enable();await h.settled();assert.deepEqual(h.state().session.accepted,accepted);const pub=await h.previewPublication();assert.equal(pub.kind,'publication-review');h.discardReview(pub.token);assert.deepEqual(h.state().session.accepted,accepted);
 }finally{await h.close();await d.close();}
});
await fs.mkdir('.local/layout-upgrade',{recursive:true});await fs.writeFile('.local/layout-upgrade/check.json',JSON.stringify({checks,failures},null,2));console.log(JSON.stringify({passed:checks.length,failures},null,2));if(failures.length)process.exitCode=1;
