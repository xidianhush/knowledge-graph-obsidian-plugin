"""Runtime-only synthetic candidate update; never includes data or identity."""
import json,hashlib,zipfile,tempfile,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1];base=root/'.local/sync-016/unified/u5'
prep=Path(sys.argv[1]).resolve();assert prep.is_relative_to(base.resolve()) and prep.name.startswith('pristine-')
meta=json.loads((prep/'preparation.json').read_text('utf-8'));phase=sys.argv[2] if len(sys.argv)>2 else 'FB1';assert phase in ['FB1','G4-FB4','G4-FB5','G4-UI1','G4-UI2']
out=Path(tempfile.mkdtemp(prefix={'FB1':'fb1-update-','G4-FB4':'g4-fb4-update-','G4-FB5':'g4-fb5-update-','G4-UI1':'g4-ui1-update-','G4-UI2':'g4-ui2-update-'}[phase],dir=base))
files={};plugin='knowledge-map-sync-unified'
for name in ['main.js','manifest.json','styles.css']:
 rel='.obsidian/plugins/'+plugin+'/'+name
 pc=(Path(meta['paths']['PC'])/rel).read_bytes();ipad=(Path(meta['paths']['iPad'])/rel).read_bytes();assert pc==ipad
 assert hashlib.sha256(pc).hexdigest()==meta['digests']['PC'][rel]
 files[plugin+'/'+name]=pc
assert hashlib.sha256(files[plugin+'/main.js']).hexdigest()==meta['pluginMainSha256']
assert json.loads(files[plugin+'/manifest.json'])['id']==plugin
files['OPEN-FIRST.md']=(root/{'FB1':'docs/SYNC_UNIFIED_U5_FB1_RETEST.md','G4-FB4':'docs/SYNC_G4_FB4_RETEST.md','G4-FB5':'docs/SYNC_G4_FB5_RETEST.md','G4-UI1':'docs/SYNC_G4_UI1_RETEST.md','G4-UI2':'docs/SYNC_G4_UI2_RETEST.md'}[phase]).read_bytes()
archive=out/{'FB1':'Knowledge-Map-Unified-FB1-20261115-Update.zip','G4-FB4':'Knowledge-Map-G4-FB4-20261115-Update.zip','G4-FB5':'Knowledge-Map-G4-FB5-20261116-Update.zip','G4-UI1':'Knowledge-Map-G4-UI1-20261116-Update.zip','G4-UI2':'Knowledge-Map-G4-UI2-20261117-Update.zip'}[phase]
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for name,body in files.items():z.writestr(name,body)
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None and set(z.namelist())==set(files)
 for name,body in files.items():assert z.read(name)==body
(out/'OPEN-FIRST.md').write_bytes(files['OPEN-FIRST.md'])
result={'archive':str(archive),'preparation':str(prep),'mainSha256':meta['pluginMainSha256'],'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':{name:hashlib.sha256(body).hexdigest() for name,body in files.items()},'crcAndBytes':True,'scope':'Three runtime files plus instructions; no data.json, private storage, connection, settings, user notes or reports.'}
(out/'verification.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps(result))
