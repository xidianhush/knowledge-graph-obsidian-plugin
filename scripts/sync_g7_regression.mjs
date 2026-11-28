// Old scripts keep historical output names. Run only in fresh G7 source copies.
import fs from 'node:fs/promises';import path from 'node:path';import {spawnSync} from 'node:child_process';
if(!process.cwd().includes(path.join('.local','sync-016','g7','workspace-')))throw Error('isolated-current-source-g7-workspace-required');
await fs.mkdir('.local/sync-016/g7',{recursive:true});const out=await fs.mkdtemp('.local/sync-016/g7/regression-'),checks=[];
for(const name of ['test','sync_g7_legacy_check','sync_g7_downgrade_check','sync_unified_host_disk_check','sync_g6_disk_check','sync_g7_disk_check']){
 const r=spawnSync(process.execPath,['scripts/'+name+'.mjs'],{encoding:'utf8',maxBuffer:32*1024*1024});await fs.writeFile(out+'/'+name+'.log',(r.stdout??'')+(r.stderr??''));checks.push({name,exit:r.status,error:r.error?.message});console.log(name+': '+r.status);if(r.status!==0)break;
}
const result={pass:checks.length===6&&checks.every(r=>r.exit===0),out,checks};await fs.writeFile(out+'/summary.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.pass)process.exitCode=1;
