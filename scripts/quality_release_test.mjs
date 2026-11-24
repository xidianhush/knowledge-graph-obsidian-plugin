import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = process.cwd(),
  temp = await fs.mkdtemp(path.join(os.tmpdir(), 'km-release-'));
try {
  await fs.mkdir(path.join(temp, 'scripts'));
  await fs.mkdir(path.join(temp, 'dist'));
  await fs.copyFile(path.join(root, 'scripts/package.mjs'), path.join(temp, 'scripts/package.mjs'));
  for (const name of ['manifest.json', 'package.json'])
    await fs.writeFile(
      path.join(temp, name),
      JSON.stringify({ version: '0.0.16', isDesktopOnly: false }),
    );
  await fs.writeFile(path.join(temp, 'LICENSE'), 'MIT License\nCopyright test\n');
  await fs.writeFile(path.join(temp, 'versions.json'), JSON.stringify({ '0.0.16': '1.6.7' }));
  for (const [name, body] of Object.entries({
    'main.js': 'module.exports={};',
    'manifest.json': JSON.stringify({ version: '0.0.16' }),
    'styles.css': '.kg{}',
  }))
    await fs.writeFile(path.join(temp, 'dist', name), body);
  const out = path.join(temp, 'package');
  execFileSync(process.execPath, [path.join(temp, 'scripts/package.mjs'), '--out', out], {
    stdio: 'pipe',
  });
  assert.ok(
    (await fs.stat(path.join(out, 'main.js')).catch(() => null))?.size,
    'Packaging must actually produce a nonempty runtime, not merely exit zero',
  );
  const { validateReleaseTree } = await import('./quality_release_check.mjs');
  await validateReleaseTree(temp);
  await fs.writeFile(path.join(out, 'data.json'), 'private');
  assert.throws(
    () =>
      execFileSync(process.execPath, [path.join(temp, 'scripts/package.mjs'), '--out', out], {
        stdio: 'pipe',
      }),
    /Command failed/,
  );
  assert.equal(await fs.readFile(path.join(out, 'data.json'), 'utf8'), 'private');
  await fs.rm(path.join(out, 'data.json'));
  for (const file of ['LICENSE', 'scripts/package.mjs', 'dist/main.js', 'dist/styles.css']) {
    const p = path.join(temp, file),
      before = await fs.readFile(p);
    await fs.writeFile(p, '');
    await assert.rejects(() => validateReleaseTree(temp), /empty/);
    await fs.writeFile(p, before);
  }
  await fs.writeFile(path.join(temp, 'dist/data.json'), 'private');
  await assert.rejects(() => validateReleaseTree(temp), /private/);
  await fs.rm(path.join(temp, 'dist/data.json'));
  const manifest = path.join(temp, 'dist/manifest.json');
  await fs.writeFile(manifest, JSON.stringify({ version: '1.0.0' }));
  await assert.rejects(() => validateReleaseTree(temp), /version/);
  assert.throws(
    () =>
      execFileSync(process.execPath, [path.join(temp, 'scripts/package.mjs'), '--out', out], {
        stdio: 'pipe',
      }),
    /Command failed/,
  );
  await fs.writeFile(manifest, JSON.stringify({ version: '0.0.16' }));
  await fs.writeFile(path.join(temp, 'versions.json'), '{}');
  await assert.rejects(() => validateReleaseTree(temp), /versions/);
  console.log(
    'Release integrity: real packaging, empty files, private data, version and mapping guards passed',
  );
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
