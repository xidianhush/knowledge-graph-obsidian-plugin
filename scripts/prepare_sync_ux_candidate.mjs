import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash} from 'node:crypto';
import {graphHostBundle} from './build.mjs';
import {buildKnowledgeMapUnifiedCandidate} from './build_sync_a3_probe.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),pluginId='knowledge-map-sync-ux',plugin='.obsidian/plugins/'+pluginId+'/';
export const UX_DELIVERY_FILES=Object.freeze(['START-HERE.md','Synthetic/A.md','Synthetic/B.md','.obsidian/app.json','.obsidian/community-plugins.json','.obsidian/core-plugins.json',...['manifest.json','main.js','styles.css','data.json'].map(p=>plugin+p)]);
const notes={'Synthetic/A.md':'# First\nSynthetic first heading.\n# Second\nSynthetic second heading.\n','Synthetic/B.md':'# Third\nSynthetic third heading.\n# Fourth\nSynthetic fourth heading.\n'};
const json=v=>JSON.stringify(v,null,2)+'\n',sha=b=>createHash('sha256').update(b).digest('hex');
// SYNC-UX-A5: two pristine fresh vaults (no manual layout on either end) so the headline
// acceptance — enable layout sync once with no prior drag — can be exercised on both devices.
export async function prepareSyncUxCandidate(){
 const base=path.join(root,'.local/sync-ux/a5');await fs.mkdir(base,{recursive:true});const out=await fs.mkdtemp(path.join(base,'pristine-')),remote='/KM-SYNC-UX-'+randomBytes(4).toString('hex');
 const built=buildKnowledgeMapUnifiedCandidate(root,graphHostBundle),guide=(await fs.readFile(path.join(root,'docs/SYNC_UX_EASY_SETUP_GUIDE.md'),'utf8')).replaceAll('{{REMOTE}}',remote),paths={},digests={};
 const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
 for(const role of ['PC','iPad']){
  const vault=paths[role]=path.join(out,'Knowledge Map Sync UX '+role),files={'START-HERE.md':guide,...notes,'.obsidian/app.json':json({safeMode:false}),'.obsidian/community-plugins.json':json([pluginId]),'.obsidian/core-plugins.json':json(['file-explorer','command-palette']),[plugin+'manifest.json']:json({...manifest,id:pluginId,name:'Knowledge Map Sync UX Candidate',description:'One-switch layout-sync ease-of-use candidate (SYNC-UX). Not a release.'}),[plugin+'main.js']:built.main,[plugin+'styles.css']:await fs.readFile(path.join(root,'dist/styles.css')),[plugin+'data.json']:json({settings:{language:'zh'},pipeline:{config:{include:['Synthetic/**']}},ui:{legend:'true'}})};
  digests[role]={};for(const [name,value]of Object.entries(files)){const file=path.join(vault,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,value);digests[role][name]=sha(Buffer.from(value));}
 }
 const preparation={version:1,out,paths,remote,pluginId,candidateName:'Knowledge Map Sync UX Candidate',manifestVersion:manifest.version,pluginMainSha256:built.pluginMainSha256,build:built.build,digests,allowlist:UX_DELIVERY_FILES,scope:'Pristine synthetic fresh vaults, no manual layout on either end; no sync identity, acceptance, bootstrap record, marker, profile, report or credentials. External transfer of Knowledge Map Sync is performed by the user’s own sync tool.'};
 await fs.writeFile(path.join(out,'preparation.json'),json(preparation));return preparation;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await prepareSyncUxCandidate()));