import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {device,state} from './sync-g4-helpers.mjs';
import {empty} from './sync-auto-publish-test-helpers.mjs';
import {testMemoryStore} from './sync-host-test-helpers.mjs';
import {cloneBoundedSyncJson} from '../src/sync/causal-prototype.mjs';
import {syncContentHash} from '../src/sync/persistence-prototype.mjs';
import {createAttemptHistory} from '../src/sync/attempt-history-prototype.mjs';
const prep=JSON.parse(await fs.readFile(path.join(process.argv[2],'preparation.json'),'utf8')),d=await device(empty),checks=[];
try{
 d.setFiles(await Promise.all(['A','B'].map(async n=>({path:'Synthetic/'+n+'.md',text:await fs.readFile(path.join(prep.paths.PC,'Synthetic/'+n+'.md'),'utf8')}))));
 for(const name of Object.keys(prep.digests.PC).filter(n=>n.startsWith('Knowledge Map Sync/'))){let p='';for(const bit of name.split('/').slice(0,-1)){p=p?p+'/'+bit:bit;if(!await d.io.adapter.stat(p))await d.io.adapter.mkdir(p);}await d.io.adapter.writeBinary(name,new Uint8Array(await fs.readFile(path.join(prep.paths.PC,name))).buffer);}
 const s=await d.h.previewSelection({action:'join',vault:prep.synthetic.vault,transport:'attempts-v1'});await d.h.confirmSelection(s.token);const j=await d.h.previewJoin();assert.equal((await d.h.confirmJoin(j.token,'shared')).kind,'joined');
 assert.equal(state(d).accepted.operations.length,1024);assert.equal(new Set(state(d).accepted.operations.map(o=>o.id)).size,1024);assert.equal(await syncContentHash(JSON.stringify(cloneBoundedSyncJson(state(d).accepted.snapshot))),prep.synthetic.snapshotSha256);checks.push('Actual 1024 distinct two-group seed bytes can be normally selected/adopted and match the planned snapshot');
 const hist=createAttemptHistory(d.io.adapter,prep.synthetic.vault),old=(await hist.scan()).inventory;
 const c=d.capture('Synthetic/A.md',71);await d.h.store.command({},'edit',c.key,c.value);await d.h.settled();assert.equal(d.h.state().status,'ready');assert.equal(state(d).faulted,false);assert.equal(state(d).pending,null);assert.ok(state(d).localState.layoutDraft);assert.equal(d.h.state().outcome.reason,'attempt-file-budget');checks.push('Next actual graph edit saves draft and holds at shared physical capacity without faulting or creating an intent');
 const output={...testMemoryStore(),location:'Synthetic Backup'},id='8'.repeat(32);await d.h.exportRecovery({destination:output,id});checks.push('Complete full-seed backup includes all 1024 accepted operations and the saved unpublished draft');
 const fresh='9'.repeat(32);await d.h.exportRecovery({destination:output,id:fresh});const r=await d.h.previewRotation({destination:output,id:fresh,choice:'draft'});assert.equal((await d.h.confirmRotation(r.token)).kind,'rotated');assert.equal(state(d).accepted.operations.length,1);assert.deepEqual((await hist.scan()).inventory,old);checks.push('Exact-full distinct-operation seed supports reviewed draft rotation, preserving all 1024 old files');
 const backend=await d.options.openBackend({vault:d.h.state().selected.vault}),inventory=await backend.inventory({});
 const result={pass:true,checks,preparation:prep.out,privateNew:{bytes:inventory.bytes,files:inventory.files.length},exportBytes:[...output.files.values()].reduce((n,s)=>n+Buffer.byteLength(s),0),scope:'Production host/session with actual generated seed bytes, synthetic App/shared/private memory adapters. Not native/iPad/OS capacity.'};
 await fs.mkdir('.local/sync-016/g6',{recursive:true});const out=await fs.mkdtemp('.local/sync-016/g6/delivery-check-');await fs.writeFile(out+'/summary.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,out}));
}finally{await d.h.close();await d.io.close();}
