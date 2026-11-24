// Replay exact delivered synthetic source bytes for each independent device.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {device,state} from './sync-g4-helpers.mjs';import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';import {testMemoryStore} from './sync-host-test-helpers.mjs';import {readCompatibilityExport} from '../src/sync/local-work-prototype.mjs';
const prep=JSON.parse(await fs.readFile(path.join(process.argv[2],'preparation.json'),'utf8')),checks=[],sha=b=>createHash('sha256').update(b).digest('hex');
for(const role of ['PC','iPad']){
 const root=prep.paths[role],source=JSON.parse(await fs.readFile(path.join(root,'.obsidian/plugins/knowledge-graph-smoke/data.json'),'utf8'));assert.ok(Object.keys(source.layoutOverrides.groups).length);
 for(const [name,hash]of Object.entries(prep.digests[role]))assert.equal(sha(await fs.readFile(path.join(root,name))),hash);
 const d=await device();try{
  await d.h.close();d.options.pluginId='knowledge-graph-smoke';d.setSource(source);d.setFiles(await Promise.all(['A','B'].map(async n=>({path:'Synthetic/'+n+'.md',text:await fs.readFile(path.join(root,'Synthetic/'+n+'.md'),'utf8')}))));d.h=await createUnifiedSyncHost(d.options);
  const p=await d.h.previewSelection({action:'new'});await d.h.confirmSelection(p.token);const j=await d.h.previewJoin();assert.equal((await d.h.confirmJoin(j.token,'import')).kind,'joined');assert.deepEqual(state(d).accepted.snapshot.groups,source.layoutOverrides.groups);
  await d.h.disable();const capture=d.capture('Synthetic/A.md',105);await d.h.store.command({},'edit',capture.key,capture.value);await d.h.settled();
  const backup={...testMemoryStore(),location:'G7 Delivery Backup'},backupId='1'.repeat(32);await d.h.exportRecovery({destination:backup,id:backupId});
  for(const choice of ['accepted','draft']){const r=await d.h.previewRollback({destination:backup,id:backupId,choice});assert.equal((await d.h.confirmRollback(r.token)).kind,'compatibility-exported');const data=await readCompatibilityExport({source:backup,id:r.exportId});assert.deepEqual(data.layoutOverrides,choice==='accepted'?state(d).accepted.snapshot:state(d).localState.layoutDraft.value);assert.deepEqual(data.g7Unknown,source.g7Unknown);checks.push(role+' exact pristine source: local import and '+choice+' compatibility export verified');}
 }finally{await d.h.close();await d.io.close();}
}
await fs.mkdir('.local/sync-016/g7',{recursive:true});const out=await fs.mkdtemp('.local/sync-016/g7/delivery-check-');const result={pass:true,out,checks,scope:'Exact delivered source/config/notes through production graph/host/session with synthetic adapters; no iPad native or service claim'};await fs.writeFile(out+'/summary.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
