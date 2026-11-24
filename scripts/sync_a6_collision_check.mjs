import assert from 'node:assert/strict';
import {collisionFixtures,inspectCollisionSnapshot} from './sync-a6-collision-fixture.mjs';

const suite='a'.repeat(32);
const {target,directory,bodies}=await collisionFixtures(suite,'b'.repeat(32),'c'.repeat(32));
const checks=[];
const scan=async entries=>inspectCollisionSnapshot(suite,new Map(entries));
assert.equal((await scan([[target,bodies.Baseline]])).blocked,false);
checks.push('Identical baseline is valid');
for(const role of ['PC','iPad']){
  const result=await scan([[target,bodies[role]]]);
  assert.equal(result.blocked,true);
  assert.equal(result.blockers[0].reason,'unverified-bytes');
  checks.push(role+' replacement at the baseline path is blocked');
}
const copies=await scan([[target,bodies.Baseline],[directory+'/actual name (conflict PC).json',bodies.PC],
  [directory+'/actual name (conflict iPad).json',bodies.iPad]]);
assert.equal(copies.blocked,true);
assert.deepEqual(copies.quarantined,['b'.repeat(32)]);
assert.equal(copies.observations.length,3);
checks.push('Unknown provider names remain evidence and complete conflicting bodies are quarantined');
assert.equal((await scan([[target,new TextEncoder().encode('<<<<<<< local\n=======\n>>>>>>> remote')]])).blocked,true);
checks.push('Merged or corrupt bytes at the baseline path block admission');
console.log(JSON.stringify({checks}));
