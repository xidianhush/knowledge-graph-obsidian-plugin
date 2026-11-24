import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {buildAttemptProbe} from './prepare_sync_a4_attempt.mjs';
import {collisionFixtures,collisionPluginId,collisionVaultName} from './sync-a6-collision-fixture.mjs';

const nextId=()=>randomBytes(16).toString('hex');
const suite=nextId(),id=nextId(),nonce=nextId();
const fixtures=await collisionFixtures(suite,id,nonce);
const {main,modules}=await buildAttemptProbe({suite,id,nonce},
  'scripts/sync-a6-collision-fixture.mjs','scripts/sync-a6-collision-probe.js');
const json=value=>JSON.stringify(value,null,2)+'\n';
const base=path.resolve('.local/sync-016/a4/native');
await fs.mkdir(base,{recursive:true});
const out=await fs.mkdtemp(path.join(base,'collision-'));
const remote='/KM-C6-'+suite.slice(0,8);
const guide=(await fs.readFile('docs/SYNC_A6_COLLISION_GUIDE.md','utf8')).replaceAll('{{REMOTE}}',remote);
const plugin='.obsidian/plugins/'+collisionPluginId+'/';
const paths={},files=['START-HERE.md',fixtures.target,'.obsidian/app.json','.obsidian/community-plugins.json',
  '.obsidian/core-plugins.json',plugin+'manifest.json',plugin+'main.js',plugin+'data.json'];
for(const role of ['PC','iPad']){
  const vault=paths[role]=path.join(out,collisionVaultName(role));
  const content=[guide,fixtures.bodies.Baseline,json({safeMode:false}),json([collisionPluginId]),
    json(['file-explorer','command-palette']),
    json({id:collisionPluginId,name:'Knowledge Map A6 Collision Probe',version:'0.1.0',minAppVersion:'1.8.7',
      description:'Isolated synthetic same-path transport evidence.',author:'Hush',isDesktopOnly:false}),
    main,json({suite,role})];
  for(const [index,name] of files.entries()){
    const file=path.join(vault,name);
    await fs.mkdir(path.dirname(file),{recursive:true});
    await fs.writeFile(file,content[index]);
  }
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const preparation={out,paths,remote,suite,id,nonce,files,modules,buildSha256:sha(main),target:fixtures.target,
  bodies:Object.fromEntries(Object.entries(fixtures.bodies).map(([label,bytes])=>[label,{size:bytes.length,sha256:sha(bytes)}]))};
await fs.writeFile(path.join(out,'preparation.json'),json(preparation));
console.log(json(preparation));
