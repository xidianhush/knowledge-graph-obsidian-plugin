// Node production host with synthetic memory adapters, never a device benchmark.
import fs from 'node:fs/promises';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {device,state} from './sync-g4-helpers.mjs';
import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';
import {testMemoryStore} from './sync-host-test-helpers.mjs';
if(!process.cwd().includes('workspace-'))throw Error('isolated-workspace-required');
await fs.mkdir('.local/sync-016/g8',{recursive:true});const out=await fs.mkdtemp('.local/sync-016/g8/measurement-');
const d=await device(),rows=[],limits={coldMs:30000,backupMs:30000,pausedEditMs:5000};
try{
 await d.select();for(let n=0;n<1024;n++){
  const c=d.capture(`Synthetic/${n%2?'B':'A'}.md`,30+n);try{await d.command('edit',c.key,c.value);}catch(e){console.log('capacity stop '+e.message);break;}
  if(d.h.state().status!=='ready'||state(d).pending)break;
  if(n%128===0)console.log('prepared '+(n+1));
 }
 const size={operations:state(d).accepted.operations.length,status:d.h.state().status,private:d.h.state().privateBudget};
 await fs.writeFile(out+'/size.json',JSON.stringify(size,null,2));
 for(let i=0;i<3;i++){
  const before=structuredClone(state(d));await d.h.close();let start=performance.now();d.h=await createUnifiedSyncHost(d.options);const coldMs=performance.now()-start;
  assert.deepEqual(state(d).accepted,before.accepted);
  const destination={...testMemoryStore(),location:'Synthetic G8 Backup'},id=(i+1).toString(16).padStart(32,'0');
  start=performance.now();const backup=await d.h.exportRecovery({destination,id});const backupMs=performance.now()-start;assert.equal(backup.kind,'exported');
  const c=d.capture('Synthetic/A.md',80+i);start=performance.now();let editError=null;try{await d.h.store.command({},'edit',c.key,c.value);await d.h.settled();}catch(e){editError=e.message;}const pausedEditMs=performance.now()-start;
  const row={repeat:i+1,editError,coldMs,backupMs,pausedEditMs,status:d.h.state().status,backupFiles:destination.files.size,resources:{nodeProcess:process.memoryUsage(),osFreeMemory:os.freemem()},withinInvestigationThresholds:coldMs<limits.coldMs&&backupMs<limits.backupMs&&pausedEditMs<limits.pausedEditMs};rows.push(row);await fs.writeFile(out+'/progress.json',JSON.stringify({size,limits,rows},null,2));console.log(JSON.stringify(row));
 }
 await d.h.close();d.h=await createUnifiedSyncHost(d.options);
 const destination={...testMemoryStore(),location:'Synthetic G8 Rotation'},id='f'.repeat(32);await d.h.exportRecovery({destination,id});let start=performance.now();const p=await d.h.previewRotation({destination,id,choice:'accepted'});assert.equal(p.kind,'rotation-review');const result=await d.h.confirmRotation(p.token);const rotationMs=performance.now()-start;
 const summary={date:'2026-11-21',out,node:process.version,platform:process.platform,cpu:os.cpus()[0].model,size,limits,rows,rotation:{ms:rotationMs,result},scope:'Node host/session, distinct synthetic two-note operations and memory storage adapters. Cold = host construction/replay after close; backup = host export plus verification; pausedEdit = local command through settled; rotation = preview plus confirm. OS disk/native UI/iPad timings and memory not measured. Thresholds are investigation thresholds, not product acceptance.'};await fs.writeFile(out+'/summary.json',JSON.stringify(summary,null,2));console.log(out);
}finally{await d.h.close();await d.io.close();}
