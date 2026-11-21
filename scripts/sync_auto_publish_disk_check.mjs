// Real Node files and process exits. Synthetic graph and storage adapters;
// no native Obsidian, Nutstore, iPad, OS quota or power-loss claims.
import assert from 'node:assert/strict';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fixture,layout,id} from './sync-auto-publish-test-helpers.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';
const base=path.resolve('.local/sync-016/unified/u2'),left=await layout(-20),right=await layout(20);
const same=(a,b)=>{assert.deepEqual(a.groups,b.groups);assert.deepEqual(a.structures,b.structures);};
async function files(root){const out=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else out.push(p);}}await walk(root);return out;}
if(process.argv[2]==='--crash'){
 const root=path.resolve(process.argv[3]),point=process.argv[4],newer=process.argv[5]==='newer',relative=path.relative(base,root);
 assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));let armed=false,f;
 const exit=()=>{fsSync.writeFileSync(path.join(root,'before-exit.json'),JSON.stringify({point,newer,state:f.session.state()}));process.exit(86);};
 const backing=createNodeSyncStore(path.join(root,'private'),{onStep:async step=>{if(armed&&point==='local-save-partial'&&step==='temp-partial')exit();}});
 f=await fixture({root,privateStore:backing,write:async(name,bytes)=>{
   if(armed&&point==='shared-partial'){const target=path.join(root,'shared',name);fsSync.writeFileSync(target,new Uint8Array(bytes).slice(0,100));exit();}
 }});
 if(newer){await f.coordinator.stageLayoutDraft(left);await f.stage(left);await f.coordinator.stageLayoutDraft(right);}
 f.hook(async step=>{if(armed&&step===point)exit();});armed=true;
 if(newer)await f.queue.resume({confirmed:true});else{await f.save(left);await f.queue.settled();}
 throw Error('exit point not reached '+point);
}else{
 await fs.mkdir(base,{recursive:true});const out=await fs.mkdtemp(path.join(base,'disk-')),checks=[];
 const cases=[...['local-save-partial','after-local-state','after-intent','after-stage','after-publication-intent','after-attempt-path','shared-partial','after-publication','before-accept','after-accept'].map(point=>({point,newer:false})),
   ...['after-publication','before-accept','after-accept','after-local-state'].map(point=>({point,newer:true}))];
 for(const {point,newer}of cases){
   const root=await fs.mkdtemp(path.join(out,'case-')),child=spawnSync(process.execPath,[process.argv[1],'--crash',root,point,newer?'newer':'ordinary'],{encoding:'utf8'});
   assert.equal(child.status,86,child.stderr||child.stdout);
   const before=JSON.parse(await fs.readFile(path.join(root,'before-exit.json'),'utf8'));
   const originalFiles=await files(path.join(root,'shared')),originalBytes=new Map(await Promise.all(originalFiles.map(async p=>[p,await fs.readFile(p)])));
   const f=await fixture({root,nextId:(()=>{let n=100;return ()=>id(n++);})()}),initial=f.session.state();
   await f.queue.settled();assert.deepEqual(await files(path.join(root,'shared')),originalFiles);
   assert.equal((await f.queue.resume()).reason,'publication-review-required');
   if(point==='local-save-partial'){
     assert.equal(initial.pending,null);assert.equal(initial.localState?.layoutDraft??null,null);assert.equal(initial.accepted.operations.length,0);
     await f.queue.resume({confirmed:true});assert.equal((await f.history.scan()).count,0);
   }else{
     const pending=before.state.pending??initial.pending;
     await f.queue.resume({confirmed:true});const final=f.session.state(),scan=await f.history.scan();
     assert.equal(final.pending,null);assert.equal(final.localState.layoutDraft,null);same(final.accepted.snapshot,newer?right:left);
     assert.equal(final.accepted.operations.length,newer?2:1);assert.equal(scan.canonicalFiles.size,newer?2:1);
     if(pending){assert.deepEqual(final.accepted.operations.find(op=>op.id===pending.id),pending.operation);if(newer)assert.deepEqual(final.accepted.operations.find(op=>op.id!==pending.id).parents,[pending.id]);}
     if(point==='shared-partial'){assert.equal(scan.count,2);assert.equal(scan.blockers.length,0);}
     if(point==='after-attempt-path')assert.equal(final.accepted.operations[0].id,initial.pending.id);
     for(const [p,bytes]of originalBytes)assert.deepEqual(await fs.readFile(p),bytes);
     const acceptedIds=final.accepted.appliedIds;await f.close();const reopened=await fixture({root});await reopened.queue.settled();
     assert.deepEqual(reopened.session.state().accepted.appliedIds,acceptedIds);assert.equal(reopened.session.state().localState.layoutDraft,null);assert.equal((await reopened.history.scan()).canonicalFiles.size,newer?2:1);await reopened.close();
     checks.push({point,newer,pass:true,acceptedIds,originalFilesPreserved:true,scope:'files/process exit'});continue;
   }
   await f.close();checks.push({point,newer,pass:true,noSharedWrite:true});
 }
 const result={pass:true,out,checks,processExits:cases.length,scope:'Real Node files/process exits; synthetic adapters. No native Obsidian, service transfer, iPad or power-loss validation.'};
 await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
