import assert from 'node:assert/strict';
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
console.log(
  'Security boundaries: unsafe paths rejected before writes; leak guard positive/negative controls passed',
);
