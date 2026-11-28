"""Create a separate test vault/profile; never install into the user's vault."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
import argparse
parser=argparse.ArgumentParser(description='Prepare an isolated smoke vault from an explicit private JSON fixture')
parser.add_argument('--snapshot',required=True,type=Path)
parser.add_argument('--launch',action='store_true')
args=parser.parse_args()
snapshot=args.snapshot.resolve()
assert snapshot.is_file() and snapshot.suffix.lower()=='.json','Provide an existing JSON fixture; default build never copies private snapshots.'
EVIDENCE=ROOT/'.local/evidence';EVIDENCE.mkdir(parents=True,exist_ok=True)
provenance={'fixtureSha256':hashlib.sha256(snapshot.read_bytes()).hexdigest(),'files':{}}
for name in ('render.js','app.js','template.html'):
    provenance['files'][name]=hashlib.sha256((ROOT/'upstream'/name).read_bytes()).hexdigest()
(EVIDENCE/'smoke-provenance.json').write_text(json.dumps(provenance,indent=2),encoding='utf-8')

vault = ROOT / 'test-vault'
config = vault / '.obsidian'
plugin = config / 'plugins/knowledge-graph-smoke'
plugin.mkdir(parents=True, exist_ok=True)
for name in ('manifest.json', 'main.js', 'styles.css'):
    shutil.copy2(ROOT / 'dist' / name, plugin / name)
shutil.copy2(snapshot,plugin/'smoke-payload.json')
(config / 'community-plugins.json').write_text('["knowledge-graph-smoke"]', encoding='utf-8')
(config / 'core-plugins.json').write_text('["file-explorer","switcher","command-palette"]', encoding='utf-8')
(config / 'appearance.json').write_text('{"theme":"obsidian"}', encoding='utf-8')
(vault / 'Smoke test.md').write_text('# Isolated graph smoke test\n\nThis vault contains only a local graph snapshot, not the source notes.\n', encoding='utf-8')
profile = ROOT / 'test-profile'
profile.mkdir(exist_ok=True)
(profile / 'obsidian.json').write_text(json.dumps({'vaults': {'ca4e000000000001': {
    'path': str(vault), 'ts': 1792890000000, 'open': True}}}), encoding='utf-8')
port = 9238
if '--launch' in sys.argv:
    log = (EVIDENCE / 'obsidian-process.log').open('w', encoding='utf-8')
    proc = subprocess.Popen([r'D:\obsidian\Obsidian.exe', '--user-data-dir=' + str(profile),
        '--remote-debugging-port=' + str(port), '--remote-debugging-address=127.0.0.1'],
        stdout=log, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW)
    (EVIDENCE / 'obsidian-process.json').write_text(json.dumps({'pid': proc.pid, 'port': port}), encoding='utf-8')
    print(json.dumps({'pid': proc.pid, 'port': port, 'vault': str(vault)}))
else:
    print('Prepared', vault)
