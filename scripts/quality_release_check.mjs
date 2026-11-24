import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Check inputs and outputs, not just a packager's exit code. Never prints content. */
export async function validateReleaseTree(root) {
  const required = [
    'LICENSE',
    'scripts/package.mjs',
    'manifest.json',
    'package.json',
    'versions.json',
    'dist/main.js',
    'dist/manifest.json',
    'dist/styles.css',
  ];
  for (const name of required) {
    const s = await fs.stat(path.join(root, name)).catch(() => null);
    if (!s?.isFile() || !s.size) throw Error('missing or empty release file: ' + name);
  }
  const read = async (name) => JSON.parse(await fs.readFile(path.join(root, name), 'utf8'));
  const manifest = await read('manifest.json'),
    pkg = await read('package.json'),
    built = await read('dist/manifest.json'),
    versions = await read('versions.json');
  if (
    !/^\d+\.\d+\.\d+$/.test(manifest.version) ||
    manifest.version !== pkg.version ||
    built.version !== manifest.version
  )
    throw Error('release version mismatch');
  if (
    !versions[manifest.version] ||
    (manifest.minAppVersion && versions[manifest.version] !== manifest.minAppVersion)
  )
    throw Error('versions mapping mismatch');
  for (const name of ['data.json', 'smoke-payload.json'])
    if (await fs.stat(path.join(root, 'dist', name)).catch(() => null))
      throw Error('private release file: ' + name);
  return { version: manifest.version, files: 3 };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(
    JSON.stringify(
      await validateReleaseTree(path.resolve(fileURLToPath(new URL('../', import.meta.url)))),
    ),
  );
}
