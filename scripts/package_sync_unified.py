"""Package only a pristine generated U5 fixture; never a native-used vault."""
import hashlib,json,sys,tempfile,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=(ROOT/'.local/sync-016/unified/u5').resolve()
prepdir=Path(sys.argv[1]).resolve()
assert prepdir.is_relative_to(BASE) and prepdir.name.startswith('pristine-')
prep=json.loads((prepdir/'preparation.json').read_text(encoding='utf-8'));out=Path(tempfile.mkdtemp(prefix='delivery-',dir=BASE))
expected={'START-HERE.md','Synthetic/A.md','Synthetic/B.md','.obsidian/app.json','.obsidian/community-plugins.json','.obsidian/core-plugins.json'}
plugin='.obsidian/plugins/knowledge-map-sync-unified/'
expected.update(plugin+name for name in ['manifest.json','main.js','styles.css','data.json'])
assert set(prep['allowlist'])==expected
results=[]
for role in ['PC','iPad']:
 vault=Path(prep['paths'][role]).resolve();assert vault.parent==prepdir and vault.name==('Knowledge Map G4 ' if prep.get('phase')=='G4' else 'Knowledge Map Unified ')+role
 actual={p.relative_to(vault).as_posix() for p in vault.rglob('*') if p.is_file()}
 assert actual==expected,actual.symmetric_difference(expected)
 contents={}
 for name in sorted(expected):
  file=vault/name;assert not any(p.is_symlink() for p in [file,*file.parents])
  body=file.read_bytes();assert hashlib.sha256(body).hexdigest()==prep['digests'][role][name]
  contents[vault.name+'/'+name]=body
 contents['OPEN-FIRST.md']=(vault/'START-HERE.md').read_bytes()
 data=json.loads(contents[vault.name+'/'+plugin+'data.json'])
 assert set(data)==({'settings','pipeline','ui','layoutOverrides'} if role=='PC' else {'settings','pipeline','ui'})
 assert data['settings']=={'language':'zh'} and data['pipeline']=={'config':{'include':['Synthetic/**']}} and data['ui']=={'legend':'true'}
 manifest=json.loads(contents[vault.name+'/'+plugin+'manifest.json']);assert manifest['id']=='knowledge-map-sync-unified' and manifest['version']=='0.0.15'
 assert hashlib.sha256(contents[vault.name+'/'+plugin+'main.js']).hexdigest()==prep['pluginMainSha256']
 archive=out/('Knowledge-Map-'+('G4' if prep.get('phase')=='G4' else 'Unified')+'-20261115-'+role+'.zip')
 with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
  for name,body in contents.items():z.writestr(name,body)
 with zipfile.ZipFile(archive) as z:
  assert z.testzip() is None and set(z.namelist())==set(contents)
  for name,body in contents.items():assert z.read(name)==body
 results.append({'role':role,'archive':str(archive),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':sorted(contents),'crcAndBytes':True})
(out/'OPEN-FIRST.md').write_bytes((Path(prep['paths']['PC'])/'START-HERE.md').read_bytes())
result={'out':str(out),'preparation':str(prepdir),'remote':prep['remote'],'pluginMainSha256':prep['pluginMainSha256'],'packages':results,'scope':'Pristine allowlist only; no App profile, device identity, accepted history, report, credentials or daily notes.'}
(out/'package-verification.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps(result))
