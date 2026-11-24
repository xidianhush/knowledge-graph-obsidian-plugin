import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Builds a clean, whitelisted release package: only the three runtime files
// Obsidian loads (main.js, manifest.json, styles.css) plus SHA256SUMS.
// Usage:
//   node scripts/build.mjs
//   node scripts/package.mjs [--out <dir>] [--notes <file>]
// Default output: .local/release/<version>/ (git-ignored).

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = name => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (manifest.version !== pkg.version) {
  throw new Error(`version mismatch: manifest ${manifest.version} vs package.json ${pkg.version}`);
}
if (manifest.isDesktopOnly !== true) {
  console.warn('Mobile installation is enabled; consult the release notes for validated devices and platform limits. isDesktopOnly does not certify every mobile platform.');
}

const out = path.resolve(root, arg('--out') || path.join('.local', 'release', manifest.version));
const whitelist = ['main.js', 'manifest.json', 'styles.css'];
const dist = path.join(root, 'dist');

for (const name of whitelist) {
  const file = path.join(dist, name);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile() || !fs.statSync(file).size) throw new Error(`missing or empty dist/${name}; run "node scripts/build.mjs" first`);
}
const built = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'));
if (built.version !== manifest.version || built.id !== manifest.id || built.minAppVersion !== manifest.minAppVersion) throw new Error('built manifest version or identity mismatch; rebuild first');
// guard: never ship local snapshot payload or private data even if present in dist
for (const forbidden of ['smoke-payload.json', 'data.json']) {
  if (fs.existsSync(path.join(dist, forbidden))) {
    throw new Error(`refusing to package: dist/${forbidden} must not be shipped`);
  }
}

// Do not silently leave private or unrelated files in a reused output folder.
// Reject them in place, rather than deleting somebody's data.
if (fs.existsSync(out)) {
  const allowed = new Set([...whitelist, 'SHA256SUMS', 'RELEASE_NOTES.md']);
  for (const name of fs.readdirSync(out)) {
    if (!allowed.has(name) || !fs.statSync(path.join(out, name)).isFile()) {
      throw new Error(`refusing unexpected package output: ${name}; choose a clean output directory`);
    }
  }
}
fs.mkdirSync(out, { recursive: true });
const rows = [];
for (const name of whitelist) {
  const src = path.join(dist, name);
  const dst = path.join(out, name);
  fs.copyFileSync(src, dst);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex');
  rows.push(`${hash}  ${name}`);
}
const notes = arg('--notes');
if (notes) {
  const src = path.resolve(root, notes);
  if (!fs.existsSync(src)) throw new Error(`notes file not found: ${notes}`);
  fs.copyFileSync(src, path.join(out, 'RELEASE_NOTES.md'));
}
fs.writeFileSync(path.join(out, 'SHA256SUMS'), rows.join('\n') + '\n');

const mainHash = rows[0].split('  ')[0];
const size = fs.statSync(path.join(out, 'main.js')).size;
console.log(JSON.stringify({
  version: manifest.version,
  out,
  files: fs.readdirSync(out).sort(),
  mainBytes: size,
  mainSha256: mainHash,
  payloadExcluded: true,
}, null, 2));
