import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { validateBaselineRecord } from './baseline-contract.mjs';
const read = (p) => fs.readFileSync(p, 'utf8'),
  record = JSON.parse(read('docs/BASELINE.json'));
validateBaselineRecord(record);
for (const name of ['manifest.json', 'package.json'])
  if (JSON.parse(read(name)).version !== record.runtimeVersion)
    throw Error('wrong source version: ' + name);
if (!read('src/sync/obsidian-unified-entry.js').includes('mountObsidianEasySettings'))
  throw Error('easy settings not wired');
if (!read('scripts/bundle-sync-host.mjs').includes('src/sync/obsidian-easy-settings.mjs'))
  throw Error('formal build does not include easy settings');
for (const capability of [
  'startEasySync',
  'prepareLocalGraph',
  'previewHistoricalRestore',
  'confirmHistoricalRestore',
])
  if (!read('src/sync/obsidian-unified-host.mjs').includes(capability))
    throw Error('missing capability: ' + capability);
if (process.argv.includes('--workspace')) {
  for (const name of fs.readdirSync('src/sync')) {
    if (/\.(mjs|js)$/.test(name) && read('src/sync/' + name).includes('\r\n'))
      throw Error('Non-reproducible CRLF provenance source: src/sync/' + name);
  }
  // Local workspaces must have the recorded history. Exported/shallow CI source
  // can still check the immutable record and actual production capabilities.
  for (const name of ['experience', 'recovery', 'published']) {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', record[name], 'HEAD'], { stdio: 'pipe' });
    } catch {
      throw Error(
        'Workspace HEAD does not include the ' +
          name +
          ' baseline; finish integration before development.',
      );
    }
  }
  const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
  if (branch !== record.activeBranch) throw Error('Wrong active branch: ' + (branch || 'detached'));
}
console.log('Baseline verified: one-switch + published recovery; ' + record.activeBranch);
