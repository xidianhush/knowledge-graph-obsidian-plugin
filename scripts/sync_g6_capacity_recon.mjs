// Default-threshold synthetic reconnaissance; no duplicate-operation padding.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {device,state} from './sync-g4-helpers.mjs';
import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';
import {PRIVATE_STORE_BUDGET} from '../src/sync/private-store-budget-prototype.mjs';
import {deriveSyncStatus} from '../src/sync/obsidian-sync-settings.mjs';
await fs.mkdir('.local/sync-016/g6',{recursive:true});
const out=await fs.mkdtemp('.local/sync-016/g6/capacity-'),d=await device(),started=performance.now();
const samples=[];let attempted=0;
try{
 await d.select();
 for(let n=0;n<1024;n++){
  const c=d.capture(`Synthetic/${n%2?'B':'A'}.md`,30+n);
  attempted++;
  try{await d.command('edit',c.key,c.value);}catch(e){samples.push({attempted,saveFailure:e.message});break;}
  const s=state(d),h=d.h.state();
  if(n%25===0||h.status!=='ready'||s.pending){const row={attempted,operations:s.accepted.operations.length,sequence:s.sequence,status:h.status,pending:!!s.pending,draft:!!s.localState.layoutDraft,elapsedMs:Math.round(performance.now()-started)};samples.push(row);console.log(JSON.stringify(row));}
  if(h.status!=='ready'||s.pending)break;
 }
 const before=structuredClone(state(d)),connection=structuredClone(d.h.state().selected),installation=d.h.state().installation;
 const backend=await d.options.openBackend({vault:connection.vault});
 const inventory=await backend.inventory({maxFiles:8193,maxBytes:151000000});
 const scan=await d.history().scan();
 const acceptedIds=before.accepted.operations.map(o=>o.id);
 assert.equal(new Set(acceptedIds).size,acceptedIds.length);
 const persistedPaths=Array.from(backend.files.keys());
 await d.h.close();const coldStart=performance.now();d.h=await createUnifiedSyncHost(d.options);const coldMs=performance.now()-coldStart;
 const cold=state(d);
 assert.deepEqual(cold.accepted,before.accepted);
 assert.deepEqual(cold.pending,before.pending);
 assert.deepEqual(cold.localState,before.localState);
 assert.deepEqual(d.h.state().selected,connection);assert.equal(d.h.state().installation,installation);
 assert.deepEqual(Array.from(backend.files.keys()),persistedPaths);
 const result={pass:true,date:'2026-11-17',out,attempted,acceptedOperations:acceptedIds.length,groups:Object.keys(before.accepted.snapshot.groups).length,sequence:before.sequence,private:{bytes:inventory.bytes,files:inventory.files.length,events:inventory.files.filter(r=>r.name.startsWith('events/')).length,complete:inventory.complete,limits:PRIVATE_STORE_BUDGET},shared:{files:scan.inventory.length,bytes:scan.inventory.reduce((n,r)=>n+r.size,0)},before:{pending:before.pending?.id??null,draft:before.localState?.layoutDraft?.id??null},cold:{ms:Math.round(coldMs),status:d.h.state().status,display:deriveSyncStatus(d.h.state()),allAcceptedPendingLocalAndIdentityEqual:true,noNewPrivateFiles:true},samples,scope:'Default actual engineering thresholds, distinct two-group operations through production graph/store/host/session. App/shared/private adapters are memory contract fakes, not IndexedDB/native/iPad/OS disk-full evidence. Timings are Node-only.'};
 await fs.writeFile(out+'/summary.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await d.h.close();await d.io.close();}
