import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {prepareUnifiedCandidate} from './prepare_sync_unified_candidate.mjs';
const prep=await prepareUnifiedCandidate(),root=process.cwd();prep.phase='G4';prep.remote=prep.remote.replace('/KM-U5-','/KM-G4-');
const guide=(await fs.readFile(path.join(root,'docs/SYNC_G4_GUIDE.md'),'utf8')).replaceAll('{{REMOTE}}',prep.remote);
for(const role of ['PC','iPad']){
 const target=path.join(prep.out,'Knowledge Map G4 '+role);if(!path.resolve(target).startsWith(path.resolve(prep.out)+path.sep))throw Error('scope');
 await fs.rename(prep.paths[role],target);prep.paths[role]=target;await fs.writeFile(path.join(target,'START-HERE.md'),guide);
 prep.digests[role]['START-HERE.md']=createHash('sha256').update(guide).digest('hex');
}
await fs.writeFile(path.join(prep.out,'preparation.json'),JSON.stringify(prep,null,2)+'\n');console.log(JSON.stringify(prep));
