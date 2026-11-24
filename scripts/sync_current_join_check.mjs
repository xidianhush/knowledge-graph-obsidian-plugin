import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel} from '../dist/graph-core.mjs';
import * as layouts from '../src/sync/layout-prototype.mjs';
import {device,relay,state,seedFiles} from './sync-g4-helpers.mjs';
import {layout,empty} from './sync-auto-publish-test-helpers.mjs';
import {testMemoryStore} from './sync-host-test-helpers.mjs';
import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';
const good=await layout(-20),mixed=structuredClone(good),oldKey='["note","Synthetic/Gone.md",""]';
mixed.groups[oldKey]=structuredClone(Object.values(good.groups)[0]);mixed.groups[oldKey].note=oldKey;
const checks=[],failures=[];
async function test(name,fn){try{await fn();checks.push(name);}catch(error){failures.push({name,error:error.stack});}}
const model=()=>{const g=buildGraph({files:seedFiles,config:{include:['Synthetic/**']}});return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
const project=v=>layouts.projectCurrentJoinLayout(v,model);
await test('Current projection archives stale groups without mutating source or weakening original/shared validation',()=>{
 assert.equal(typeof layouts.projectCurrentJoinLayout,'function');const before=structuredClone(mixed),p=project(mixed);
 assert.deepEqual(p.snapshot,good);assert.equal(p.sourceGroups,2);assert.deepEqual(p.omittedGroups,[oldKey]);assert.deepEqual(mixed,before);
 assert.throws(()=>layouts.normalizeJoinLayout(mixed,model));assert.throws(()=>layouts.validateSchema3Snapshot(mixed));assert.throws(()=>layouts.normalizeRestoreLayout(mixed,model));
});
await test('Captured projection reproduces existing renderer apply positions for every current node',()=>{
 const p=project(mixed);function positions(snapshot){const g=buildGraph({files:seedFiles,config:{include:['Synthetic/**']}}),m=createLayoutModel(g.nodes,g.meta.layout_root_radius);m.apply(snapshot);return g.nodes.map(n=>[n.id,n.x,n.y,n.r]);}
 const before=positions(mixed),after=positions(p.snapshot);assert.equal(before.length,after.length);before.forEach((n,i)=>{assert.equal(n[0],after[i][0]);for(let k=1;k<4;k++)assert.ok(Math.abs(n[k]-after[i][k])<1e-9);});
});
await test('Unusable geometry becomes an explicitly reviewed automatic proposal; unknown formats remain blocked',()=>{
 const bad=structuredClone(good);bad.groups[Object.keys(bad.groups)[0]].points[0].x=10;const p=project(bad);assert.deepEqual(p.snapshot.groups,{});assert.equal(p.omittedGroups.length,1);
 assert.throws(()=>project({...mixed,schemaVersion:99}));assert.throws(()=>project({...mixed,revision:-1}));
});
await test('Current first-join preview/cancel leaves original config and all histories untouched',async()=>{
 const d=await device(mixed);try{const s=await d.h.previewSelection({action:'new'});await d.h.confirmSelection(s.token);const before=d.source(),j=await d.h.previewJoin();assert.equal(j.kind,'join-preview',JSON.stringify(j));assert.equal(j.canImport,false);assert.equal(j.canCurrent,true);assert.deepEqual(j.current.snapshot,good);assert.equal(j.current.omittedGroups.length,1);d.h.discardJoin(j.token);assert.deepEqual(d.source(),before);assert.equal(state(d).sequence,0);assert.equal((await d.history().scan()).inventory.length,0);}finally{await d.close();}
});
await test('Explicit current choice retains complete original backup, imports canonical layout and peer adopts it',async()=>{
 const d=await device(mixed),b=await device(empty);try{const s=await d.h.previewSelection({action:'new'});await d.h.confirmSelection(s.token);const before=d.source(),j=await d.h.previewJoin();assert.equal((await d.h.confirmJoin(j.token,'current')).kind,'joined');assert.deepEqual(state(d).accepted.snapshot,good);assert.equal(state(d).joining.reason,'current-layout');
 const dst={...testMemoryStore(),location:'Synthetic Backup'},id='a'.repeat(32);await d.h.exportRecovery({destination:dst,id});assert.deepEqual(JSON.parse(dst.files.get(id+'/join-backup.json')),before);
 await relay(d,b);await b.adopt(d);assert.deepEqual(state(b).accepted.snapshot.groups,good.groups);await d.h.close();const cold=await createUnifiedSyncHost(d.options);assert.deepEqual(cold.state().session.accepted.snapshot,good);const proof=await cold.joinEvidence();assert.deepEqual(proof.backup,before);await cold.close();}finally{await d.close();await b.close();}
});
await test('Original import cannot silently choose the reduced current proposal',async()=>{
 const d=await device(mixed);try{const s=await d.h.previewSelection({action:'new'});await d.h.confirmSelection(s.token);const j=await d.h.previewJoin();assert.notEqual((await d.h.confirmJoin(j.token,'import')).kind,'joined');assert.equal(state(d).initialized,false);assert.equal((await d.history().scan()).inventory.length,0);}finally{await d.close();}
});
await test('Shared adoption from an incompatible original source is separately reviewed and preserves every original record',async()=>{
 const a=await device(),b=await device(mixed);try{await a.select();await relay(a,b);const s=await b.h.previewSelection({action:'join',...a.h.state().selected});await b.h.confirmSelection(s.token);const original=b.source(),j=await b.h.previewJoin();assert.equal(j.canImport,false);const count=(await b.history().scan()).inventory.length;assert.equal((await b.h.confirmJoin(j.token,'shared')).kind,'joined');assert.deepEqual(state(b).accepted.snapshot.groups,state(a).accepted.snapshot.groups);assert.equal((await b.history().scan()).inventory.length,count);assert.deepEqual((await b.h.joinEvidence()).backup,original);await b.h.close();const cold=await createUnifiedSyncHost(b.options);assert.deepEqual(cold.state().session.accepted.snapshot.groups,state(a).accepted.snapshot.groups);await cold.close();}finally{await a.close();await b.close();}
});
await test('Ordinary PC edits after current join publish and peer receives while original archive remains intact',async()=>{
 const a=await device(mixed),b=await device(empty);try{const s=await a.h.previewSelection({action:'new'});await a.h.confirmSelection(s.token);const original=a.source(),j=await a.h.previewJoin();await a.h.confirmJoin(j.token,'current');await relay(a,b);await b.adopt(a);
 const moved=await layout(15);await a.h.saveLayout(moved);await a.h.settled();assert.equal(state(a).accepted.operations.length,2);await relay(a,b);await b.h.receive();assert.deepEqual(state(b).accepted.snapshot.groups,moved.groups);assert.deepEqual((await a.h.joinEvidence()).backup,original);
 await a.h.disable();await a.h.saveLayout(good);await a.h.enable();await a.h.settled();assert.equal(state(a).accepted.operations.length,2);const review=await a.h.previewPublication();assert.equal(review.kind,'publication-review');await a.h.confirmPublication(review.token);assert.equal(state(a).accepted.operations.length,3);assert.deepEqual((await a.h.joinEvidence()).backup,original);
 }finally{await a.close();await b.close();}
});
await test('A proposal change without an epoch increment still expires the captured current fingerprint',async()=>{
 const d=await device(mixed);await d.h.close();let changed=false;
 const options={...d.options,getGraph:()=>({hidden:false,isCurrent:()=>true,createModel:()=>{const files=changed?seedFiles.map(f=>({...f,text:f.text+'# Added\nBody'})):seedFiles,g=buildGraph({files,config:{include:['Synthetic/**']}});return createLayoutModel(g.nodes,g.meta.layout_root_radius);}})};
 const h=await createUnifiedSyncHost(options);try{const s=await h.previewSelection({action:'new'});await h.confirmSelection(s.token);const j=await h.previewJoin();changed=true;assert.equal((await h.confirmJoin(j.token,'current')).reason,'current-layout-changed');assert.equal(h.state().session.sequence,0);}finally{await h.close();await d.close();}
});
await test('Current automatic proposal publishes its own reset root instead of implicitly adopting shared geometry',async()=>{
 const bad=structuredClone(good);bad.groups[Object.keys(bad.groups)[0]].points[0].x=10;const d=await device(bad);try{const s=await d.h.previewSelection({action:'new'});await d.h.confirmSelection(s.token);const j=await d.h.previewJoin();assert.equal(j.canCurrent,true);assert.deepEqual(j.current.snapshot.groups,{});assert.equal((await d.h.confirmJoin(j.token,'current')).kind,'joined');assert.deepEqual(state(d).accepted.snapshot.groups,{});assert.equal(state(d).accepted.operations.length,1);assert.deepEqual(state(d).accepted.operations[0].changes,[{group:'root',value:null}]);}finally{await d.close();}
});
await test('Current-layout starting points cannot silently combine with populated shared history',async()=>{
 for(const automatic of [false,true]){const a=await device(),initial=structuredClone(automatic?good:mixed);if(automatic)initial.groups[Object.keys(initial.groups)[0]].points[0].x=10;const b=await device(initial);try{await a.select();await relay(a,b);const s=await b.h.previewSelection({action:'join',...a.h.state().selected});await b.h.confirmSelection(s.token);const before=(await b.history().scan()).inventory,j=await b.h.previewJoin();assert.equal(j.kind,'join-preview');assert.equal(j.canCurrent,false);assert.equal(j.currentIssue,'history-not-empty');assert.notEqual((await b.h.confirmJoin(j.token,'current')).kind,'joined');assert.equal(state(b).sequence,0);assert.deepEqual((await b.history().scan()).inventory,before);}finally{await a.close();await b.close();}}
});
await test('Source, graph and shared-inventory changes expire current review before acceptance',async()=>{
 for(const change of ['source','graph']){const d=await device(mixed);try{const s=await d.h.previewSelection({action:'new'});await d.h.confirmSelection(s.token);const j=await d.h.previewJoin();if(change==='source')d.setSource({...d.source(),layoutOverrides:good});else d.setFiles(seedFiles.map(f=>({...f,text:f.text+'# New\nBody'})));assert.notEqual((await d.h.confirmJoin(j.token,'current')).kind,'joined');assert.equal(state(d).initialized,false);assert.equal((await d.history().scan()).inventory.length,0);}finally{await d.close();}}
 const d=await device(mixed),peer=await device();try{const s=await d.h.previewSelection({action:'new'});await d.h.confirmSelection(s.token);const j=await d.h.previewJoin();await peer.select();const v=state(peer).accepted.operations[0];const history=await import('../src/sync/attempt-history-prototype.mjs');const text=JSON.stringify({...v,vault:d.h.state().selected.vault}),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');const h=history.createAttemptHistory(d.io.adapter,d.h.state().selected.vault);await h.write(await h.allocate(v.id,hash,[]),text);assert.notEqual((await d.h.confirmJoin(j.token,'current')).kind,'joined');assert.equal(state(d).initialized,false);}finally{await d.close();await peer.close();}
});
await fs.mkdir('.local/current-join',{recursive:true});await fs.writeFile('.local/current-join/check.json',JSON.stringify({pass:!failures.length,checks,failures},null,2));console.log(JSON.stringify({pass:!failures.length,checks,failures},null,2));if(failures.length)process.exitCode=1;
