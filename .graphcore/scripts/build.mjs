import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const output = path.join(root, 'dist');
fs.mkdirSync(output, { recursive: true });
const template = read('upstream/template.html');
let css = template.match(/<style>([\s\S]*?)<\/style>/)[1]
  .replace(':root', ':host').replace('html, body', '.kg-surface').replace(/^  body\s*\{/m, '  .kg-surface {')
  .replace(/position:\s*fixed/g, 'position: absolute')
  .replace(/(\d)(vw|vh)\b/g, (_, n, unit) => n + (unit === 'vw' ? 'cqw' : 'cqh'));
css += '\n:host { display:block; width:100%; height:100%; color-scheme:dark; }\n.kg-surface { position:relative; width:100%; height:100%; container-type:size; outline:none; }\n';
css += read('src/host.css');
const html = template.match(/<body>([\s\S]*?)<script>/)[1]
  .replaceAll('__PAGE_TITLE__', '知识图谱').replaceAll('__GENERATED__', '快照冒烟');
const core = ['src/core/payload.js', 'src/core/renderer.js', 'src/core/graph-core.js'].map(read).join('\n');
const adapters = [
  'const GRAPH_CSS = ' + JSON.stringify(css) + ';',
  'const GRAPH_HTML = ' + JSON.stringify(html) + ';',
  ...['src/adapters/canvas-platform.js', 'src/adapters/hud-scope.js', 'src/adapters/hud.js', 'src/adapters/browser.js'].map(read),
].join('\n');
const bundle = '// GraphCore and shared browser adapter; only the final adapter imports Obsidian.\n' + core + '\n' + adapters + '\n' + read('src/plugin.js');
fs.writeFileSync(path.join(output, 'main.js'), bundle);
fs.writeFileSync(path.join(output, 'graph-core.mjs'), core + '\nexport { GraphCore, decodeGraphPayload };\n');
fs.writeFileSync(path.join(output, 'browser.mjs'), "import { GraphCore } from './graph-core.mjs';\n" + adapters + '\nexport { mountGraph, createCanvasPlatform };\n');
for (const name of ['manifest.json', 'styles.css']) fs.copyFileSync(path.join(root, name), path.join(output, name));
const payload = path.join(root, '.local/smoke-payload.json');
if (fs.existsSync(payload)) fs.copyFileSync(payload, path.join(output, 'smoke-payload.json'));
console.log(JSON.stringify({ bytes: Buffer.byteLength(bundle), sha256: crypto.createHash('sha256').update(bundle).digest('hex'), payloadIncluded: fs.existsSync(payload) }));
