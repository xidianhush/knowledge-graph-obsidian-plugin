import {CAUSAL_PROTOTYPE_LIMITS,cloneBoundedSyncJson} from '../src/sync/causal-prototype.mjs';
import {createAttemptHistory,attemptHistoryDirectory} from '../src/sync/attempt-history-prototype.mjs';
import {sha256} from './sync-a4-attempt-candidate.mjs';

export const capacityPluginId='knowledge-map-a6-capacity';
export const capacityVaultName=role=>'Knowledge Map A6 Capacity '+role;
export const capacityLimits=CAUSAL_PROTOTYPE_LIMITS;
const encode=value=>new TextEncoder().encode(JSON.stringify(cloneBoundedSyncJson(value)));
export async function capacityFixtures(suite,id){
 function body(size){
  const op={protocol:2,layoutSchema:3,vault:suite,id,parents:[],structures:{},
   changes:Array.from({length:128},(_,i)=>({group:JSON.stringify(['note','Synthetic/'+i+'.md','']),value:null}))};
  let left=size-encode(op).length;
  for(const change of op.changes){
   const n=Math.min(left,1700);if(n<=0)break;
   const parts=JSON.parse(change.group);parts[1]='Synthetic/'+('x'.repeat(n))+parts[1].slice(10);
   change.group=JSON.stringify(parts);left-=n;
  }
  const bytes=encode(op);if(bytes.length!==size)throw Error('capacity-fixture-size');return bytes;
 }
 const normal=body(32768),larger=body(32769),directory=attemptHistoryDirectory(suite);
 const normalHash=await sha256(normal),largerHash=await sha256(larger);
 const name=n=>directory+'/'+id+'.'+normalHash+'.'+n.toString(16).padStart(32,'0')+'.json';
 const near=Array.from({length:1023},(_,i)=>name(i+1));
 const exact=name(1024),count=name(1025);
 const total=directory+'/'+id+'.'+largerHash+'.'+(1026).toString(16).padStart(32,'0')+'.json';
 const oversized=directory+'/'+'0'.repeat(32)+'.'+'0'.repeat(64)+'.'+'0'.repeat(32)+'.json';
 const extra=[{name:exact,bytes:normal},{name:count,bytes:normal},{name:total,bytes:larger},
  {name:oversized,bytes:new Uint8Array(capacityLimits.recordBytes+1)}];
 const inventory=near.map(name=>({name,hash:normalHash,size:normal.length}));
 const fingerprint=await sha256(new TextEncoder().encode(JSON.stringify(inventory)));
 return {directory,normal,normalHash,near,exact,count,total,oversized,extra,fingerprint,
  nearBytes:1023*normal.length};
}

export async function measureCapacityScan(adapter,suite){
 const stats={listCalls:0,statCalls:0,readCalls:0,readBytes:0};
 const io={stat:async name=>{stats.statCalls++;return adapter.stat(name);},
  list:async name=>{stats.listCalls++;return adapter.list(name);},
  readBinary:async name=>{stats.readCalls++;const data=await adapter.readBinary(name);stats.readBytes+=data.byteLength;return data;}};
 const started=performance.now();
 let result;
 try{
  const scan=await createAttemptHistory(io,suite).scan();
  result={blocked:!!(scan.blockers.length||scan.quarantined.length),error:null,count:scan.count,
   total:scan.total,fingerprint:scan.fingerprint,recognized:scan.records.map(row=>row.id),
   blockers:scan.blockers,quarantined:scan.quarantined};
 }catch(error){result={blocked:true,error:error.message};}
 return {...result,elapsedMs:performance.now()-started,io:stats};
}
export {sha256};
