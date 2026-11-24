// Verify an exported source tree without .git, node_modules, private snapshots,
// profiles or evidence. This includes the explicitly selected local candidate,
// not just HEAD: uncommitted join fixes are part of this candidate.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = process.cwd(),
  temp = await fs.mkdtemp(path.join(os.tmpdir(), 'km-clean-'));
try {
  for (const name of ['src', 'scripts', 'tests', 'upstream', 'prototypes'])
    await fs.cp(path.join(root, name), path.join(temp, name), { recursive: true });
  // Some portable contracts inspect their documented protocol/guide fixtures.
  await fs.cp(path.join(root, 'docs'), path.join(temp, 'docs'), {
    recursive: true,
    filter: (p) => !p.includes(path.sep + 'archive' + path.sep),
  });
  for (const name of [
    'manifest.json',
    'package.json',
    'package-lock.json',
    'versions.json',
    'styles.css',
    'LICENSE',
  ])
    await fs.copyFile(path.join(root, name), path.join(temp, name));
  const log = execFileSync(process.execPath, ['scripts/test.mjs'], {
    cwd: temp,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  execFileSync(process.execPath, ['scripts/quality_release_check.mjs'], {
    cwd: temp,
    stdio: 'pipe',
  });
  const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
  if (
    hash(await fs.readFile(path.join(root, 'dist/main.js'))) !==
    hash(await fs.readFile(path.join(temp, 'dist/main.js')))
  )
    throw Error('Clean export bundle differs from the current frozen build');
  execFileSync(process.execPath, ['scripts/package.mjs', '--out', path.join(temp, 'package')], {
    cwd: temp,
    stdio: 'pipe',
  });
  const names = (await fs.readdir(path.join(temp, 'package'))).sort();
  if (
    JSON.stringify(names) !==
    JSON.stringify(['SHA256SUMS', 'main.js', 'manifest.json', 'styles.css'])
  )
    throw Error('unexpected clean package');
  const evidence = path.join(root, '.local/quality-1.0');
  await fs.mkdir(evidence, { recursive: true });
  await fs.writeFile(path.join(evidence, 'clean-export.log'), log);
  console.log(
    'Clean candidate export passed without private state or node_modules; ' +
      log.trim().split('\n').at(-1),
  );
} catch (error) {
  if (error.stdout) console.error(String(error.stdout).slice(-3500));
  if (error.stderr) console.error(String(error.stderr).slice(-2000));
  throw error;
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
