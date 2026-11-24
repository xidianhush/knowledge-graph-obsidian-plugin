// Same real plugin ID, fresh synthetic vaults: exercise true in-place rollback.
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {prepareUnifiedCandidate} from './prepare_sync_unified_candidate.mjs';
const prep=await prepareUnifiedCandidate(),oldId=prep.pluginId,pluginId='knowledge-graph-smoke',remote='/KM-G7-'+randomBytes(4).toString('hex');
const seedLayout=JSON.parse(await fs.readFile(path.join(prep.paths.PC,'.obsidian/plugins',oldId,'data.json'),'utf8')).layoutOverrides;
const sha=b=>createHash('sha256').update(b).digest('hex');
prep.phase='G7';prep.pluginId=pluginId;prep.remote=remote;prep.digests={};prep.allowlist=[];
for(const role of ['PC','iPad']){
 const vault=path.join(prep.out,'Knowledge Map G7 '+role);await fs.rename(prep.paths[role],vault);prep.paths[role]=vault;
 const old='.obsidian/plugins/'+oldId,newPath='.obsidian/plugins/'+pluginId;await fs.rename(path.join(vault,old),path.join(vault,newPath));
 const manifest=JSON.parse(await fs.readFile(path.join(vault,newPath,'manifest.json'),'utf8'));manifest.id=pluginId;manifest.name='Knowledge Map G7 Candidate';manifest.description='Isolated G7 rollback candidate; not a release.';
 const dataPath=path.join(vault,newPath,'data.json'),data=JSON.parse(await fs.readFile(dataPath,'utf8'));data.g7Unknown={preserve:'Synthetic G7 unknown field'};data.ui={...data.ui,g7Keep:'local'};
 if(role==='iPad')data.layoutOverrides=structuredClone(seedLayout);
 const guide=(await fs.readFile('docs/SYNC_G7_GUIDE.md','utf8')).replaceAll('{{REMOTE}}',remote);
 for(const [name,value]of Object.entries({'START-HERE.md':guide,'.obsidian/community-plugins.json':JSON.stringify([pluginId]),[newPath+'/manifest.json']:JSON.stringify(manifest,null,2)+'\n',[newPath+'/data.json']:JSON.stringify(data,null,2)+'\n'}))await fs.writeFile(path.join(vault,name),value);
 const names=['START-HERE.md','Synthetic/A.md','Synthetic/B.md','.obsidian/app.json','.obsidian/community-plugins.json','.obsidian/core-plugins.json',...['manifest.json','main.js','styles.css','data.json'].map(n=>newPath+'/'+n)];prep.allowlist=names;prep.digests[role]={};for(const name of names)prep.digests[role][name]=sha(await fs.readFile(path.join(vault,name)));
}
prep.scope='Fresh G7 synthetic vaults using real published plugin ID for in-place switching. No identity, private journal, reports, screenshots, profiles, credentials or accepted G6 data.';
await fs.writeFile(path.join(prep.out,'preparation.json'),JSON.stringify(prep,null,2)+'\n');console.log(JSON.stringify({out:prep.out,paths:prep.paths,remote,pluginId,main:prep.pluginMainSha256}));
