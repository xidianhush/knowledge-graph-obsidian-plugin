"""Allowlisted pristine two-PC fixture for the G4-FB2 registry regression."""
import hashlib,json,sys,tempfile,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=(ROOT/'.local/sync-016/unified/u5').resolve()
prepdir=Path(sys.argv[1]).resolve()
assert prepdir.is_relative_to(BASE) and prepdir.name.startswith('pristine-')
prep=json.loads((prepdir/'preparation.json').read_text(encoding='utf-8'))
plugin='.obsidian/plugins/knowledge-map-sync-unified/'
expected={'START-HERE.md','Synthetic/A.md','Synthetic/B.md','.obsidian/app.json','.obsidian/community-plugins.json','.obsidian/core-plugins.json'}
expected.update(plugin+n for n in ['manifest.json','main.js','styles.css','data.json'])
assert set(prep['allowlist'])==expected and prep['phase']=='G4'
guide=(ROOT/'docs/SYNC_G4_FB2_RETEST.md').read_bytes();contents={'OPEN-FIRST.md':guide}
for role,source in [('A','PC'),('B','iPad')]:
 vault=Path(prep['paths'][source]).resolve();assert vault.parent==prepdir and vault.name=='Knowledge Map G4 '+source
 assert {p.relative_to(vault).as_posix() for p in vault.rglob('*') if p.is_file()}==expected
 for name in sorted(expected):
  file=vault/name;assert not any(p.is_symlink() for p in [file,*file.parents])
  body=file.read_bytes();assert hashlib.sha256(body).hexdigest()==prep['digests'][source][name]
  if name==plugin+'data.json':
   data=json.loads(body);assert set(data)==({'settings','pipeline','ui','layoutOverrides'} if source=='PC' else {'settings','pipeline','ui'})
   assert data['settings']=={'language':'zh'} and data['pipeline']=={'config':{'include':['Synthetic/**']}} and data['ui']=={'legend':'true'}
  if name==plugin+'manifest.json':
   manifest=json.loads(body);assert manifest['id']=='knowledge-map-sync-unified' and manifest['version']=='0.0.15'
  if name==plugin+'main.js':assert hashlib.sha256(body).hexdigest()==prep['pluginMainSha256']
  contents['Knowledge Map FB2 PC '+role+'/'+name]=guide if name=='START-HERE.md' else body
assert len(contents)==21
out=Path(tempfile.mkdtemp(prefix='fb2-delivery-',dir=BASE));archive=out/'Knowledge-Map-G4-FB2-20261116-PC-pair.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
 for name,body in contents.items():z.writestr(name,body)
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None and set(z.namelist())==set(contents)
 for name,body in contents.items():assert z.read(name)==body
(out/'OPEN-FIRST.md').write_bytes(guide)
result={'pass':True,'out':str(out),'archive':str(archive),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'pluginMainSha256':prep['pluginMainSha256'],'preparation':str(prepdir),'files':sorted(contents),'crcAndBytes':True,'scope':'Two pristine synthetic PC vaults only; no App profile, device identity, accepted history, report, credentials or daily notes.'}
(out/'package-verification.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps(result))
