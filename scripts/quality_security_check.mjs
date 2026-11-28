import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRecoveryDestination } from '../src/sync/recovery-export.mjs';
import { attemptHistoryDirectory } from '../src/sync/attempt-history-prototype.mjs';
import { validatePublicText } from './quality_public_check.mjs';
let writes = 0;
const vault = {
  configDir: '.obsidian',
  create: () => writes++,
  read: () => '',
  getAbstractFileByPath: () => null,
  createFolder: () => writes++,
};
for (const folder of [
  '../outside',
  '/absolute',
  'C:/outside',
  'backup/../outside',
  '.obsidian',
  'Knowledge Map Sync',
  'Knowledge Map Sync/nested',
  'backup\\outside',
  'backup//nested',
  'backup/.',
  'backup\u0000',
])
  assert.throws(() => createRecoveryDestination({ vault, folder }), /destination/);
const destination = createRecoveryDestination({ vault, folder: 'Safe Backup' });
await assert.rejects(() => destination.create('../escape', 'body'), /path/);
assert.equal(writes, 0);
for (const id of ['../outside', 'a'.repeat(31), 'g'.repeat(32), 'a'.repeat(32) + '/outside'])
  assert.throws(() => attemptHistoryDirectory(id), /vault/);
assert.equal(
  attemptHistoryDirectory('a'.repeat(32)),
  'Knowledge Map Sync/attempts-v1/' + 'a'.repeat(32) + '/ops',
);
for (const value of [
  '-----BEGIN PRIVATE KEY-----',
  'ghp_' + 'a'.repeat(36),
  'C:/Users/alice/private/',
])
  assert.throws(() => validatePublicText(value));
validatePublicText('Relative/path.md; sha256: ' + 'a'.repeat(64));
const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'km-public-check-'));
try {
  await fs.mkdir(path.join(temporaryRoot, 'src'));
  await fs.mkdir(path.join(temporaryRoot, 'docs/archive'), { recursive: true });
  await fs.mkdir(path.join(temporaryRoot, 'dist'));
  for (const name of ['main.js', 'manifest.json', 'styles.css'])
    await fs.writeFile(path.join(temporaryRoot, 'dist', name), '{}');
  const archived = path.join(temporaryRoot, 'docs/archive/fixture.md');
  const runGuard = () =>
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL('./quality_public_check.mjs', import.meta.url))],
      {
        cwd: temporaryRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  await fs.writeFile(archived, 'Example: C:/Users/alice/private/');
  assert.throws(runGuard, /Command failed/, 'Public CLI must scan archived Markdown');
  await fs.writeFile(archived, 'Example: <test-vault>/Knowledge Map Sync/');
  assert.doesNotThrow(runGuard);
  const readme = path.join(temporaryRoot, 'README.md');
  await fs.writeFile(readme, 'Example: C:/Users/alice/private/');
  assert.throws(runGuard, /Command failed/, 'Public CLI must scan root user documentation');
  await fs.writeFile(readme, 'Example: relative/test-vault/');
  assert.doesNotThrow(runGuard);
} finally {
  assert.equal(path.dirname(temporaryRoot), path.resolve(os.tmpdir()));
  assert.ok(path.basename(temporaryRoot).startsWith('km-public-check-'));
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
console.log(
  'Security boundaries: unsafe paths rejected before writes; leak guard positive/negative controls passed',
);
