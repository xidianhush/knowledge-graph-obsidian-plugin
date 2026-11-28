import {cloneBoundedSyncJson} from '../src/sync/causal-prototype.mjs';
import {createAttemptHistory,attemptHistoryDirectory} from '../src/sync/attempt-history-prototype.mjs';
import {sha256,toHex} from './sync-a4-attempt-candidate.mjs';

export const collisionPluginId='knowledge-map-a6-collision';
export const collisionVaultName=role=>'Knowledge Map A6 Collision '+role;

export async function collisionFixtures(suite,id,nonce){
  const bodies={};
  for(const label of ['Baseline','PC','iPad']){
    const operation={protocol:2,layoutSchema:3,vault:suite,id,parents:[],
      changes:[{group:JSON.stringify(['note','Synthetic/'+label+'.md','']),value:null}],structures:{}};
    bodies[label]=new TextEncoder().encode(JSON.stringify(cloneBoundedSyncJson(operation)));
  }
  const hash=await sha256(bodies.Baseline);
  return {directory:attemptHistoryDirectory(suite),
    target:attemptHistoryDirectory(suite)+'/'+id+'.'+hash+'.'+nonce+'.json',bodies};
}

export async function inspectCollisionSnapshot(suite,entries){
  const directory=attemptHistoryDirectory(suite);
  const adapter={
    stat:async name=>name===directory?{type:'folder'}:
      entries.has(name)?{type:'file',size:entries.get(name).length}:null,
    list:async()=>({files:[...entries.keys()],folders:[]}),
    readBinary:async name=>Uint8Array.from(entries.get(name)).buffer,
  };
  const scan=await createAttemptHistory(adapter,suite).scan();
  return {blocked:!!(scan.blockers.length||scan.quarantined.length),blockers:scan.blockers,
    quarantined:scan.quarantined,observations:scan.observations,recognized:scan.records.map(op=>op.id)};
}

export {sha256};
export {toHex};
