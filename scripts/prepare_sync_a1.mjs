// Creates a NEW synthetic vault, never copies existing vaults or credentials.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const base = path.join(root, '.local/sync-016');
fs.mkdirSync(base, {recursive:true});
const out = fs.mkdtempSync(path.join(base, 'a1-'));
const vault = path.join(out, 'Knowledge Map SYNC-A1');
const plugin = path.join(vault, '.obsidian/plugins/knowledge-map-sync-a1-probe');
fs.mkdirSync(plugin, {recursive:true});
const suite = 'sync-a1-' + crypto.randomBytes(16).toString('hex');
fs.writeFileSync(path.join(vault, 'SYNC-A1-ISOLATED-TEST.txt'), suite + '\n');
fs.writeFileSync(path.join(plugin, 'manifest.json'), JSON.stringify({id:'knowledge-map-sync-a1-probe', name:'Knowledge Map SYNC-A1 Probe', version:'0.1.0', minAppVersion:'1.6.7', description:'Isolated synthetic vault transport probe. No network or layout changes.', author:'Hush', isDesktopOnly:false}, null, 2));
fs.copyFileSync(path.join(root, 'scripts/sync-a1-probe/main.js'), path.join(plugin, 'main.js'));
fs.writeFileSync(path.join(vault, '.obsidian/community-plugins.json'), JSON.stringify(['knowledge-map-sync-a1-probe']));
fs.writeFileSync(path.join(vault, '.obsidian/app.json'), JSON.stringify({safeMode:false}));
fs.copyFileSync(path.join(root, 'docs/SYNC_A1_TEST_GUIDE.md'), path.join(vault, 'START-HERE.md'));
const profile = path.join(out, 'profile'); fs.mkdirSync(profile);
fs.writeFileSync(path.join(profile, 'obsidian.json'), JSON.stringify({vaults:{'synca1test0000001':{path:vault,ts:Date.now(),open:true}}}));
const result = {suite, out, vault, profile, generatedAt:new Date().toISOString(), files:[]};
for (const name of fs.readdirSync(plugin)) {
  const bytes = fs.readFileSync(path.join(plugin, name));
  result.files.push({name, bytes:bytes.length, sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
fs.writeFileSync(path.join(out, 'preparation.json'), JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
