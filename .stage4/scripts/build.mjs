import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const output = path.join(root, 'dist');
fs.mkdirSync(output, { recursive: true });
const template = read('upstream/template.html');
const renderer = read('upstream/render.js');
let app = read('upstream/app.js');
const anchor = '  function showPreviewFor(node, cx, cy, pinned) {';
if (app.split(anchor).length !== 2) throw new Error('Upstream preview host hook changed');
app = app.replace(anchor, anchor + '\n    const hostRect = surface.getBoundingClientRect();\n    cx -= hostRect.left; cy -= hostRect.top;');
let css = template.match(/<style>([\s\S]*?)<\/style>/)[1]
  .replace(':root', ':host').replace('html, body', '.kg-surface').replace(/^  body\s*\{/m, '  .kg-surface {')
  .replace(/position:\s*fixed/g, 'position: absolute')
  .replace(/(\d)(vw|vh)\b/g, (_, n, unit) => n + (unit === 'vw' ? 'cqw' : 'cqh'));
css += '\n:host { display:block; width:100%; height:100%; color-scheme:dark; }\n.kg-surface { position:relative; width:100%; height:100%; container-type:size; outline:none; }\n';
css += read('src/host.css');
const html = template.match(/<body>([\s\S]*?)<script>/)[1]
  .replaceAll('__PAGE_TITLE__', '知识图谱').replaceAll('__GENERATED__', '快照冒烟');
const bundle = [
  '// Generated smoke bundle. Source renderer/app from upstream; see upstream/provenance.json.',
  'const GRAPH_CSS = ' + JSON.stringify(css) + ';',
  'const GRAPH_HTML = ' + JSON.stringify(html) + ';',
  read('src/scope.js'),
  'function runUpstream(scope, surface) {',
  'const { window, document, requestAnimationFrame, cancelAnimationFrame, setTimeout, clearTimeout, MutationObserver, getComputedStyle } = scope;',
  renderer, app, '}', read('src/plugin.js'),
].join('\n');
fs.writeFileSync(path.join(output, 'main.js'), bundle);
for (const name of ['manifest.json', 'styles.css']) fs.copyFileSync(path.join(root, name), path.join(output, name));
const payload = path.join(root, '.local/smoke-payload.json');
if (fs.existsSync(payload)) fs.copyFileSync(payload, path.join(output, 'smoke-payload.json'));
console.log(JSON.stringify({ bytes: Buffer.byteLength(bundle), sha256: crypto.createHash('sha256').update(bundle).digest('hex'), payloadIncluded: fs.existsSync(payload) }));
