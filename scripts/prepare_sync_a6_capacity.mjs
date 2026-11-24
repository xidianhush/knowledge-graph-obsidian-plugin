import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {buildAttemptProbe} from './prepare_sync_a4_attempt.mjs';
import {capacityPluginId,capacityVaultName,capacityFixtures,capacityLimits} from './sync-a6-capacity-fixture.mjs';

const suite=randomBytes(16).toString('hex'),id=randomBytes(16).toString('hex');
const fixture=await capacityFixtures(suite,id);
const {main,modules}=await buildAttemptProbe({suite,id},'scripts/sync-a6-capacity-fixture.mjs','scripts/sync-a6-capacity-probe.js');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const base=path.resolve('.local/sync-016/a4/native');await fs.mkdir(base,{recursive:true});
const out=await fs.mkdtemp(path.join(base,'capacity-'));
const remote='/KM-Q6-'+suite.slice(0,8);
const guide=(await fs.readFile('docs/SYNC_A6_CAPACITY_GUIDE.md','utf8')).replaceAll('{{REMOTE}}',remote);
const paths={},plugin='.obsidian/plugins/'+capacityPluginId+'/';
const files=['START-HERE.md','.obsidian/app.json','.obsidian/community-plugins.json','.obsidian/core-plugins.json',
 plugin+'manifest.json',plugin+'main.js',plugin+'data.json'];
for(const role of ['PC','iPad']){
 const vault=paths[role]=path.join(out,capacityVaultName(role));
 const content=[guide,json({safeMode:false}),json([capacityPluginId]),json(['file-explorer','command-palette']),
  json({id:capacityPluginId,name:'Knowledge Map A6 Capacity Probe',version:'0.1.0',minAppVersion:'1.8.7',
   description:'Isolated shared-file budget and recovery probe.',author:'Hush',isDesktopOnly:false}),main,
  json({suite,role,stage:'fresh',runs:[],archives:[],syntheticLocalDraft:{version:1,owner:role,
   marker:'A6-Capacity-'+suite+'-'+role,body:'Synthetic local marker; not a production layout draft.'}})];
 for(const [i,name] of files.entries()){
  const file=path.join(vault,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,content[i]);
 }
}
const prep={out,paths,remote,suite,id,files,modules,buildSha256:sha(main),limits:capacityLimits,
 fixture:{directory:fixture.directory,normalSize:fixture.normal.length,normalHash:fixture.normalHash,
  nearCount:fixture.near.length,nearBytes:fixture.nearBytes,fingerprint:fixture.fingerprint},
 scope:'Empty paired vaults. PC generates real 1023-file / 31.96875MiB immutable sample; iPad receives it. Boundaries run offline.'};
await fs.writeFile(path.join(out,'preparation.json'),json(prep));
await fs.writeFile(path.join(out,'操作步骤.md'),guide);
console.log(json(prep));
