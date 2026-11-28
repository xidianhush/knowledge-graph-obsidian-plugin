import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = path.join(root, '.local/sync-016/a4/native');
const id = 'knowledge-map-sync-a4-publish-probe', name = 'Knowledge Map A4 Publish';
const source = fs.readFileSync(path.join(root, 'scripts/sync-a4-publish-probe/main.js'), 'utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const build = {version:1, sourceSha256:sha(source)};
const main = 'const PROBE_BUILD = '+JSON.stringify(build)+';\n'+source;
new vm.Script(main, {filename: 'sync-a4-publish-probe.js'});

fs.mkdirSync(base, {recursive:true});
const out = fs.mkdtempSync(path.join(base, 'publish-')), vault = path.join(out, name);
const suite = crypto.randomBytes(16).toString('hex');
const plugin = '.obsidian/plugins/'+id+'/';
const json = value => JSON.stringify(value, null, 2)+'\n';
function write(relative, data) {
  const file = path.join(vault, relative);
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, data);
}
write('SYNC-A4-PUBLISH-ISOLATED-TEST.json', json({version:1, isolated:true, suite}));
write('START-HERE.md', fs.readFileSync(path.join(root, 'docs/SYNC_A4_PUBLISH_TEST_GUIDE.md')));
write('.obsidian/community-plugins.json', json([id]));
write('.obsidian/core-plugins.json', json(['file-explorer','command-palette']));
write('.obsidian/app.json', json({safeMode:false}));
write(plugin+'manifest.json', json({id,name,version:'0.1.0',minAppVersion:'1.8.7',description:'Isolated shared layout publication capability probe.',author:'Hush',isDesktopOnly:false}));
write(plugin+'main.js', main);
const preparation = {out,vault,suite,pluginMainSha256:sha(main),build};
fs.writeFileSync(path.join(out,'preparation.json'), json(preparation));
console.log(JSON.stringify(preparation));
