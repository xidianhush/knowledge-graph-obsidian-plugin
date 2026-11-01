"""Local source/three-file release lock. Does not read vaults or publish anything."""
from pathlib import Path
import hashlib,json,zipfile,subprocess
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.local/releases';VERSION='0.0.6'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
package=OUT/'knowledge-graph-smoke-0.0.6.zip'
assert sha(package)=='f401783f972b426428de647e11e1996a0cb359b69b68388918d7fe38e98c05cb'
names=['main.js','manifest.json','styles.css']
release=OUT/'knowledge-graph-smoke-0.0.6/knowledge-graph-smoke'
with zipfile.ZipFile(package) as z:
    assert sorted(z.namelist())==sorted('knowledge-graph-smoke/'+n for n in names)
    for n in names:assert z.read('knowledge-graph-smoke/'+n)==(release/n).read_bytes()==(ROOT/'dist'/n).read_bytes()
assert sha(release/'main.js')=='48caf2479faac124bbaa8f72c952e7d731f845ee204e093252b15f1bf799b49a'
assert json.loads((release/'manifest.json').read_text())['version']==VERSION
archive=OUT/'source-0.0.6-20261030.zip'
restore=ROOT/'.local/release-restore-0.0.6-20261030'
assert not archive.exists() and not restore.exists(),'Refuse to overwrite frozen source'
files=[p for p in (ROOT/'src').rglob('*') if p.is_file()]+[ROOT/p for p in ['scripts/build.mjs','upstream/template.html','manifest.json','package.json','styles.css']]
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(files):z.write(p,p.relative_to(ROOT).as_posix())
with zipfile.ZipFile(archive) as z:z.extractall(restore)
subprocess.run(['node',str(restore/'scripts/build.mjs')],cwd=restore,check=True)
for n in names:assert sha(restore/'dist'/n)==sha(release/n)
lock={'version':VERSION,'date':'2026-10-30','package':str(package),'packageSha256':sha(package),'sourceArchive':str(archive),'sourceSha256':sha(archive),'sourceFiles':len(files),'cleanRestoreMatches':True,'files':{n:sha(release/n) for n in names},'runtimeReload':'not performed by release freeze'}
(OUT/'release-lock-0.0.6.json').write_text(json.dumps(lock,indent=2),encoding='utf8')
print(json.dumps(lock))
