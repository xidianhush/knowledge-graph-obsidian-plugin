import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** A narrow leak guard, not a comprehensive secret/security audit. */
export function validatePublicText(text) {
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) throw Error('private key');
  if (
    /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{32,})/.test(
      text,
    )
  )
    throw Error('credential-shaped token');
  if (/[A-Za-z]:[\\/]Users[\\/](?!Public\b|<)[\w.-]+[\\/]/i.test(text))
    throw Error('private home path');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let count = 0;
  const scan = async (folder) => {
    for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
      const p = path.join(folder, entry.name);
      if (entry.isDirectory()) await scan(p);
      else if (/\.(?:js|mjs|css|json)$/.test(entry.name)) {
        try {
          validatePublicText(await fs.readFile(p, 'utf8'));
        } catch (e) {
          throw Error(path.relative(process.cwd(), p) + ': ' + e.message);
        }
        count++;
      }
    }
  };
  await scan('src');
  for (const name of ['main.js', 'manifest.json', 'styles.css']) {
    validatePublicText(await fs.readFile(path.join('dist', name), 'utf8'));
    count++;
  }
  console.log(
    'Public source/runtime leak guard passed: ' + count + ' files (not a full secret audit)',
  );
}
