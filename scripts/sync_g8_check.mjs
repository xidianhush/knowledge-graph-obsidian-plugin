import assert from 'node:assert/strict';
import {deriveSyncStatus} from '../src/sync/obsidian-sync-settings.mjs';
import {verifyRecoveryExport} from '../src/sync/recovery-export.mjs';
import {device} from './sync-g4-helpers.mjs';
import {testMemoryStore} from './sync-host-test-helpers.mjs';
const failures=[],checks=[];
async function test(name,fn){try{await fn();checks.push(name);}catch(e){failures.push({name,error:e.message});}}
const local={status:'local-ready',session:{initialized:true,localState:{layoutDraft:{}}},outcome:{kind:'held',reason:'local-layout-review-required'}};
await test('Disabled draft remains local; enabled draft requires review; real errors win',()=>{
 assert.equal(deriveSyncStatus(local).key,'disabled');
 assert.equal(deriveSyncStatus({...local,status:'ready'}).key,'draftReview');
 assert.equal(deriveSyncStatus({...local,saveError:'disk'}).key,'unsaved');
 assert.equal(deriveSyncStatus({...local,status:'local-paused'}).key,'capacity');
 assert.equal(deriveSyncStatus({...local,error:'broken'}).key,'recovery');
});
await test('Missing manifest, missing body and damaged body are distinguishable without modifying backup',async()=>{
 const d=await device();try{await d.select();const destination={...testMemoryStore(),location:'Synthetic Backup'},id='a'.repeat(32);
 await d.h.exportRecovery({destination,id});const original=new Map(destination.files);
 destination.files.delete(id+'/manifest.json');await assert.rejects(()=>verifyRecoveryExport({source:destination,id}),/recovery-export-incomplete/);
 destination.files.clear();for(const row of original)destination.files.set(...row);
 destination.files.delete(id+'/accepted.json');await assert.rejects(()=>verifyRecoveryExport({source:destination,id}),/recovery-export-content-missing/);
 destination.files.set(id+'/accepted.json','{}');await assert.rejects(()=>verifyRecoveryExport({source:destination,id}),/recovery-export-content$/);
 }finally{await d.h.close();await d.io.close();}
});
console.log(JSON.stringify({pass:!failures.length,checks,failures},null,2));if(failures.length)process.exitCode=1;
