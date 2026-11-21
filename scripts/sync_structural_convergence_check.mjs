import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pair,state,relay} from './sync-g4-helpers.mjs';
import {createLayoutActionAuthor,randomSyncOperationId} from '../src/sync/author-prototype.mjs';
import {cloneBoundedSyncJson} from '../src/sync/causal-prototype.mjs';
const checks=[],failures=[],copy=x=>structuredClone(x),canonical=x=>JSON.stringify(cloneBoundedSyncJson(x));
async function test(name,fn){try{await fn();checks.push(name);}catch(error){failures.push({name,message:error.message,stack:error.stack});}}
function add(files){return files.map(f=>f.path.endsWith('/A.md')?{...f,text:f.text+'# Fifth\nAdded body.\n'}:f);}
async function write(d,operation){const h=d.history(),body=canonical(operation),hash=await (await import('../src/sync/persistence-prototype.mjs')).syncContentHash(body),name=await h.allocate(operation.id,hash,[]);await h.write(name,body);}
const same=(a,b)=>{assert.deepEqual([...state(a).accepted.appliedIds].sort(),[...state(b).accepted.appliedIds].sort());assert.deepEqual(state(a).accepted.snapshot.groups,state(b).accepted.snapshot.groups);};
await test('Notes first on peer: equivalent automatic additions share identity; later source removal converges',async()=>{const p=await pair(),{a,b}=p;try{
 const before=a.files();a.setFiles(add(before));assert.equal((await a.h.graphReady()).kind,'accepted');
 b.setFiles(add(before));assert.equal((await b.h.graphReady()).kind,'accepted');
 const oa=state(a).accepted.operations.at(-1),ob=state(b).accepted.operations.at(-1);
 assert.equal(oa.id,ob.id,'same structural body and parents must share one operation ID');assert.deepEqual(oa,ob);
 a.setFiles(before);assert.equal((await a.h.graphReady()).kind,'accepted');b.setFiles(before);
 await relay(a,b);await relay(b,a);await b.check();await a.check();same(a,b);assert.equal(state(a).accepted.appliedIds.length,3);
 assert.equal((await a.history().scan()).records.length,3);assert.equal((await a.history().scan()).inventory.length,4,'separate physical attempts remain valid');
 }finally{await p.close();}});
await test('Layout file already present: graphReady accepts verified structural update without another operation',async()=>{const p=await pair(),{a,b}=p;try{
 const changed=add(a.files());a.setFiles(changed);await a.h.graphReady();await relay(a,b);b.setFiles(changed);
 assert.equal((await b.h.graphReady()).kind,'accepted');same(a,b);assert.equal(state(b).accepted.appliedIds.length,2);assert.equal(state(b).pending,null);
 }finally{await p.close();}});
await test('Ordinary distinct edits retain separate identities and conflict',async()=>{const p=await pair(),{a,b}=p;try{
 const ca=a.capture('Synthetic/A.md',-8),cb=b.capture('Synthetic/A.md',8);await a.command('capture',ca.key,ca.value);await b.command('capture',cb.key,cb.value);
 assert.notEqual(state(a).accepted.appliedIds.at(-1),state(b).accepted.appliedIds.at(-1));await relay(a,b);await relay(b,a);
 assert.equal((await a.check()).reason,'shared-candidate-blocked');assert.equal((await b.check()).reason,'shared-candidate-blocked');
 }finally{await p.close();}});
await test('Legacy random duplicate: preserve incompatible branch, cancel inert, valid explicit choice restores convergence',async()=>{const p=await pair(),{a,b}=p;try{
 a.h.notifyPathChange('Synthetic','Moved',true);a.setFiles(a.files().map(f=>({...f,path:f.path.replace('Synthetic/','Moved/')})));a.setConfig({include:['Synthetic/**','Moved/**']});await a.h.graphReady();await relay(a,b);
 b.h.notifyPathChange('Synthetic','Moved',true);b.setFiles(b.files().map(f=>({...f,path:f.path.replace('Synthetic/','Moved/')})));b.setConfig({include:['Synthetic/**','Moved/**']});await b.h.graphReady();
 const before=a.files(),changed=add(before);a.setFiles(changed);b.setFiles(changed);
 const s=state(a),ctx={vault:a.h.state().selected.vault,sharedScanComplete:true,records:(await a.history().scan()).records,appliedIds:s.accepted.appliedIds,localBaseline:s.accepted.snapshot};
 const legacy=createLayoutActionAuthor({vault:ctx.vault,createModel:a.model}).prepareReconcile(ctx).operation;
 const other={...copy(legacy),id:randomSyncOperationId()};await write(a,legacy);await write(b,other);await a.check();await b.check();
 a.setFiles(before);assert.equal((await a.h.graphReady()).kind,'accepted');const deletionHead=state(a).accepted.operations.at(-1).id;b.setFiles(before);await relay(a,b);await relay(b,a);await a.check();await b.check();
 const original=copy((await a.history().scan()).records);
 const review=await a.h.previewConflict();assert.equal(review.kind,'review');assert.equal(review.choices.length,3,'old ancestor choice identity remains available for journal compatibility');
 const valid=review.choices.find(c=>c.id===deletionHead),invalid=review.choices.find(c=>c.compatible===false);assert(valid&&valid.compatible&&invalid);
 a.h.discardReview(review.token);assert.deepEqual((await a.history().scan()).records,original);
 const bad=await a.h.previewConflict();await assert.rejects(a.h.confirmConflict(bad.token,invalid.id),/resolution-graph-incompatible/);assert.equal(state(a).pending,null);
 const fresh=await a.h.previewConflict();assert((await a.h.confirmConflict(fresh.token,valid.id)).kind.startsWith('accepted'));
 await relay(a,b);await b.check();same(a,b);assert.equal((await a.history().scan()).records.length,original.length+1);
 for(const op of original)assert.deepEqual((await a.history().scan()).records.find(r=>r.id===op.id),op);
 assert(!Object.values(state(b).accepted.snapshot.structures).flat().some(r=>r.title==='Fifth'));
 }finally{await p.close();}});
const result={pass:failures.length===0,checks,failures,scope:'Production graph/store/host/author/session/receiver; memory App, locks and shared adapters. No native or iPad/Nutstore claims.'};
await fs.mkdir('.local/sync-016/g4/fb4-fix',{recursive:true});await fs.writeFile('.local/sync-016/g4/fb4-fix/convergence.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(failures.length)process.exitCode=1;
