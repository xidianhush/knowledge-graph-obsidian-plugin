"""Local, allowlisted source snapshot; never includes vaults, configs or payloads."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import datetime
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    dest = ROOT / '.local' / 'baselines' / ('before-layout-' + stamp)
    source = dest / 'source'
    source.mkdir(parents=True, exist_ok=False)
    files = [p for p in ROOT.glob('*.md') if p.is_file()]
    files += [ROOT / n for n in ['.gitignore', 'manifest.json', 'package.json', 'styles.css']]
    for folder in ['src', 'scripts', 'upstream']:
        files += [p for p in (ROOT / folder).rglob('*')
                  if p.is_file() and '__pycache__' not in p.parts
                  and p.suffix in ['.js', '.mjs', '.py', '.css', '.html', '.json']]
    entries = []
    for p in sorted(set(files)):
        if p.is_symlink() or not p.resolve().is_relative_to(ROOT):
            raise RuntimeError('Refusing linked source: ' + str(p))
        rel = p.relative_to(ROOT)
        target = source / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, target)
        assert digest(p) == digest(target)
        entries.append({'path': rel.as_posix(), 'sha256': digest(target)})
    archive = dest / 'source.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
        for entry in entries:
            z.write(source / entry['path'], entry['path'])
    restored = dest / 'restore-check'
    with zipfile.ZipFile(archive) as z:
        z.extractall(restored)
    assert all(digest(restored / e['path']) == e['sha256'] for e in entries)
    build = subprocess.run(['node', 'scripts/build.mjs'], cwd=restored,
                           check=True, capture_output=True, text=True)
    release = ROOT / '.local/releases/knowledge-graph-smoke-0.0.3/knowledge-graph-smoke'
    matches = {name: digest(restored / 'dist' / name) == digest(release / name)
               for name in ['main.js', 'manifest.json', 'styles.css']}
    assert all(matches.values()), matches
    receipt = {'createdUTC': stamp, 'scope': 'local source backup, not approved for publication',
               'files': entries, 'archiveSHA256': digest(archive),
               'restoredBuild': json.loads(build.stdout), 'releaseMatches': matches,
               'restore': 'Extract source.zip into a new empty folder; run node scripts/build.mjs. No npm install required.'}
    (dest / 'receipt.json').write_text(json.dumps(receipt, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps({'directory': str(dest), 'files': len(entries), 'releaseMatches': matches}))

if __name__ == '__main__':
    main()
