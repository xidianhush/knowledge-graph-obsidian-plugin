// Run only inside an isolated current-source snapshot: legacy scripts keep
// their historical output names, so never run this against accepted evidence.
import fs from 'node:fs/promises';import path from 'node:path';import {spawnSync} from 'node:child_process';
if(!process.cwd().includes(path.join('.local','sync-016','g6','workspace-')))throw Error('isolated-g6-workspace-required');
await fs.mkdir('.local/sync-016/g6',{recursive:true});const out=await fs.mkdtemp('.local/sync-016/g6/regression-'),checks=[];
for(const name of ['sync_unified_host_disk_check','sync_auto_publish_disk_check','sync_connection_catalog_disk_check','sync_g6_disk_check']){
 const r=spawnSync(process.execPath,['scripts/'+name+'.mjs'],{encoding:'utf8'});await fs.writeFile(out+'/'+name+'.log',(r.stdout??'')+(r.stderr??''));checks.push({name,exit:r.status});if(r.status!==0)break;
}
const result={pass:checks.length===4&&checks.every(r=>r.exit===0),out,checks};await fs.writeFile(out+'/summary.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.pass)process.exitCode=1;
