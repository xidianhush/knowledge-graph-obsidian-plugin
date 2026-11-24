import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {prepareSyncUxCandidate,UX_DELIVERY_FILES} from './prepare_sync_ux_candidate.mjs';
const preparation=await prepareSyncUxCandidate(),checks=[];
const plugin='.obsidian/plugins/knowledge-map-sync-ux/';
const rootManifest=JSON.parse(await fs.readFile('manifest.json','utf8'));
for(const [role,vault]of Object.entries(preparation.paths)){
 const found=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){assert.ok(!e.isSymbolicLink());const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else found.push(path.relative(vault,p).replaceAll('\\','/'));}}await walk(vault);
 assert.deepEqual(found.sort(),[...UX_DELIVERY_FILES].sort());
 const data=JSON.parse(await fs.readFile(path.join(vault,plugin+'data.json'),'utf8'));
 assert.deepEqual(Object.keys(data).sort(),['pipeline','settings','ui']);assert.equal(data.layoutOverrides,undefined);
 const manifest=JSON.parse(await fs.readFile(path.join(vault,plugin+'manifest.json'),'utf8'));
 assert.equal(manifest.version,rootManifest.version);assert.equal(manifest.id,'knowledge-map-sync-ux');assert.equal(manifest.name,'Knowledge Map Sync UX Candidate');
 assert.ok(!found.some(p=>/marker|fixture|report|credential|identity|IndexedDB|bootstrap-v1|attempts-v1/i.test(p)));
 checks.push(role+' pristine fresh allowlist, no manual layout and no sync identity/acceptance/bootstrap');
}
const modules=preparation.build.modules.map(m=>m.file);
for(const required of ['src/sync/obsidian-easy-settings.mjs','src/sync/easy-sync-setup.mjs','src/sync/default-layout-bootstrap.mjs','src/sync/obsidian-unified-host.mjs'])assert.ok(modules.includes(required),required);
checks.push('Candidate bundle includes easy-settings, easy-sync-setup, default-layout-bootstrap and unified host');
assert.equal(preparation.manifestVersion,rootManifest.version);checks.push('Candidate manifest version matches source manifest '+rootManifest.version);
await fs.writeFile(path.join(preparation.out,'preparation-check.json'),JSON.stringify({pass:true,checks},null,2));console.log(JSON.stringify({pass:true,checks,preparation}));