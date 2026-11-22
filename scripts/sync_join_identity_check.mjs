import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
import * as syncLayout from '../src/sync/layout-prototype.mjs';
import {deriveSyncStatus} from '../src/sync/obsidian-sync-settings.mjs';
import {device,relay,state} from './sync-g4-helpers.mjs';
import {layout} from './sync-auto-publish-test-helpers.mjs';
import {testMemoryStore} from './sync-host-test-helpers.mjs';
const checks=[],failures=[];
async function test(name,fn){try{await fn();checks.push(name);}catch(error){failures.push({name,error:error.stack});}}
const text='# First\nBody\n# Second\nBody\n';
function modelFor(text){return ()=>{const g=buildGraph({files:[{path:'Synthetic/A.md',text}],config:{include:['Synthetic/**']}});return createLayoutModel(g.nodes,g.meta.layout_root_radius);};}
async function layoutFor(text){const g=buildGraph({files:[{path:'Synthetic/A.md',text}],config:{include:['Synthetic/**']}}),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius),n=g.nodes.find(n=>n.title==='Second');assert.equal(e.begin(n.id),null);e.move(n.x-20,n.y+5);e.commit();let saved;await createLayoutStore(null,async v=>saved=v).command({},'edit',m.groupKey(n.id),m.capture(m.groupKey(n.id)));return saved;}
const valid=await layoutFor(text),missing=structuredClone(valid);missing.structures={};
const normalize=(value,model=modelFor(text))=>syncLayout.normalizeJoinLayout(value,model);
await test('Missing local structure metadata can be reconstructed without moving any saved point',()=>{
 assert.equal(typeof syncLayout.normalizeJoinLayout,'function');const before=structuredClone(missing),next=normalize(missing);assert.deepEqual(next,valid);assert.deepEqual(missing,before);assert.throws(()=>syncLayout.validateSchema3Snapshot(missing),/layout-identity/);assert.throws(()=>syncLayout.normalizeRestoreLayout(missing,modelFor(text)),/layout-identity/);
});
await test('Old outline token is refreshed only when the current group shape and all coordinates survive',()=>{
 const stale=structuredClone(valid),key=Object.keys(stale.groups)[0];stale.groups[key].structure=stale.groups[key].structure.replace(/:\d+$/,':3');const fixed=normalize(stale);assert.deepEqual(fixed.groups[key].points,stale.groups[key].points);assert.deepEqual(fixed.groups[key].shape,stale.groups[key].shape);assert.deepEqual(fixed.structures,valid.structures);assert.deepEqual(fixed.groups[key].repair,{moved:0,added:0});
});
await test('Missing or renamed groups and repairs requiring a radius or coordinate change remain blocked',()=>{
 assert.throws(()=>normalize(missing,modelFor(text.replace('Second','Renamed'))));
 const removed=modelFor('# First\nBody\n');assert.throws(()=>normalize(missing,removed));
 const shifted=structuredClone(missing),key=Object.keys(shifted.groups)[0];shifted.groups[key].points[0].x=10;assert.throws(()=>normalize(shifted));
 const resized=structuredClone(missing);resized.groups[key].shape[0].r*=.5;assert.throws(()=>normalize(resized));
});
await test('Invalid local record fields or structure evidence never get silently sanitized',()=>{
 const bad=structuredClone(missing);bad.groups[Object.keys(bad.groups)[0]].unexpected='keep';assert.throws(()=>normalize(bad));
 const wrong=structuredClone(valid),note=Object.keys(wrong.structures)[0];wrong.structures[note][0].evidence='invalid';assert.throws(()=>normalize(wrong),/layout-identity-row/);
 const orphan=structuredClone(missing);orphan.structures['["note","Synthetic/Orphan.md",""]']=[{key:'bad',title:42,parent:null,level:99,evidence:'invalid'}];assert.throws(()=>normalize(orphan),/layout-baseline-incompatible/);
});
await test('Valid schema3 and strict shared validator keep their existing contract',()=>{
 assert.deepEqual(normalize(valid),valid);assert.throws(()=>syncLayout.validateSchema3Snapshot(missing),/layout-identity/);
});
await test('Normalization cannot drop an off-scope group or accept a corrupt guard with no identity table',()=>{
 const bad=structuredClone(missing),record=bad.groups[Object.keys(bad.groups)[0]];record.structure='abcdef:123456:2';assert.throws(()=>normalize(bad));
 const both=structuredClone(missing),key=Object.keys(both.groups)[0],otherKey=key.replace('A.md','Outside.md');both.groups[otherKey]=structuredClone(both.groups[key]);both.groups[otherKey].note=otherKey;assert.throws(()=>normalize(both));
});
await test('Unavailable original import offers an explicit current preview without writes and remains disabled on reopen',async()=>{
 const broken=await layout(-20);broken.structures={};broken.groups[Object.keys(broken.groups)[0]].points[0].x=10;
 const d=await device(broken);try{const p=await d.h.previewSelection({action:'new'});await d.h.confirmSelection(p.token);const before=d.source(),sequence=state(d).sequence;
 const review=await d.h.previewJoin();assert.equal(review.kind,'join-preview');assert.equal(review.canImport,false);assert.equal(review.canCurrent,true);d.h.discardJoin(review.token);assert.deepEqual(d.source(),before);assert.equal(state(d).sequence,sequence);assert.equal((await d.history().scan()).inventory.length,0);await d.h.disable();await d.h.close();
 const {createUnifiedSyncHost}=await import('../src/sync/obsidian-unified-host.mjs');const cold=await createUnifiedSyncHost(d.options);assert.match(cold.state().status,/^local-/);assert.equal(cold.state().session.initialized,false);assert.deepEqual(d.source(),before);await cold.close();
 }finally{await d.close();}
});
await test('Local import preview, cancel, backup, publication, peer adoption and cold reopen retain geometry',async()=>{
 const hostValid=await layout(-20),hostMissing=structuredClone(hostValid);hostMissing.structures={};
 const d=await device(hostMissing),peer=await device({schemaVersion:3,revision:0,groups:{},structures:{}});try{
 const p=await d.h.previewSelection({action:'new'});await d.h.confirmSelection(p.token);const before=d.source(),inventory=(await d.history().scan()).inventory;
 const review=await d.h.previewJoin();assert.equal(review.kind,'join-preview',JSON.stringify(review));assert.equal(review.canImport,true);assert.deepEqual(review.local.groups,hostValid.groups);d.h.discardJoin(review.token);assert.deepEqual(d.source(),before);assert.deepEqual((await d.history().scan()).inventory,inventory);
 const q=await d.h.previewJoin();assert.equal((await d.h.confirmJoin(q.token,'import')).kind,'joined');assert.deepEqual(state(d).accepted.snapshot.groups,hostValid.groups);const destination={...testMemoryStore(),location:'Synthetic Backup'},backupId='a'.repeat(32);assert.equal((await d.h.exportRecovery({destination,id:backupId})).kind,'exported');assert.deepEqual(JSON.parse(destination.files.get(backupId+'/join-backup.json')),before);
 await relay(d,peer);await peer.adopt(d);assert.deepEqual(state(peer).accepted.snapshot.groups,hostValid.groups);assert.deepEqual(state(peer).accepted.snapshot.structures,hostValid.structures);
 await d.h.close();const {createUnifiedSyncHost}=await import('../src/sync/obsidian-unified-host.mjs');const reopened=await createUnifiedSyncHost(d.options);assert.deepEqual(reopened.state().session.accepted.snapshot.groups,hostValid.groups);await reopened.close();
 }finally{await d.close();await peer.close();}
});
await test('Blocked join receives an explicit status rather than unchanged connection-selected instructions',()=>{
 const s={status:'join-required',session:{initialized:false}};assert.equal(deriveSyncStatus(s,{result:{kind:'review-required',reason:'layout-identity'}}).key,'joinBlocked');assert.equal(deriveSyncStatus({...s,outcome:{kind:'held',reason:'layout-restore-points-changed'}}).key,'joinBlocked');
 assert.equal(deriveSyncStatus({...s,status:'local-join-required'},{result:{kind:'review-required',reason:'layout-identity'}}).key,'disabled');
 assert.equal(deriveSyncStatus(s,{result:{kind:'review-required',reason:'layout-join-graph-incompatible'}}).key,'joinBlocked');
});
await fs.mkdir('.local/join-identity',{recursive:true});await fs.writeFile('.local/join-identity/check.json',JSON.stringify({pass:!failures.length,checks,failures},null,2));console.log(JSON.stringify({pass:!failures.length,checks,failures},null,2));if(failures.length)process.exitCode=1;
