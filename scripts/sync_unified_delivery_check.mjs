import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {prepareUnifiedCandidate,UNIFIED_DELIVERY_FILES} from './prepare_sync_unified_candidate.mjs';
const preparation=await prepareUnifiedCandidate(),checks=[];
for(const [role,vault]of Object.entries(preparation.paths)){
 const found=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){assert.ok(!e.isSymbolicLink());const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else found.push(path.relative(vault,p).replaceAll('\\','/'));}}await walk(vault);
 assert.deepEqual(found.sort(),[...UNIFIED_DELIVERY_FILES].sort());const data=JSON.parse(await fs.readFile(path.join(vault,'.obsidian/plugins/knowledge-map-sync-unified/data.json'),'utf8'));
 assert.deepEqual(Object.keys(data).sort(),role==='PC'?['layoutOverrides','pipeline','settings','ui']:['pipeline','settings','ui']);
 assert.equal(JSON.parse(await fs.readFile(path.join(vault,'.obsidian/plugins/knowledge-map-sync-unified/manifest.json'),'utf8')).version,JSON.parse(await fs.readFile('manifest.json','utf8')).version);assert.ok(!found.some(p=>/marker|fixture|report|credential|identity|IndexedDB/i.test(p)));checks.push(role+' pristine allowlist and no sync identity/acceptance');
}
await fs.writeFile(path.join(preparation.out,'preparation-check.json'),JSON.stringify({pass:true,checks},null,2));console.log(JSON.stringify({pass:true,checks,preparation}));
