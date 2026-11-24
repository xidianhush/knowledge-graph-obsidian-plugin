"""Package the allowlisted clean native test vault files, including .obsidian."""
import hashlib,json,sys,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
base=(root/'.local/sync-016/a3/native').resolve()
a4_base=(root/'.local/sync-016/a4/native').resolve()
out=Path(sys.argv[1]).resolve()
a4=out.is_relative_to(a4_base) and out!=a4_base
assert a4 or (out.is_relative_to(base) and out!=base),'outside native fixture root'
preparation=json.loads((out/'preparation.json').read_text(encoding='utf-8'))
vault_name=Path(preparation['vault']).name
plugin_ids={'Knowledge Map A3 Native':'knowledge-map-sync-a3-native-probe',
            'Knowledge Map A3 Local Work':'knowledge-map-sync-a3-local-work-probe',
            'Knowledge Map A3 Replay':'knowledge-map-sync-a3-replay-probe',
            'Knowledge Map A3 Recovery':'knowledge-map-sync-a3-recovery',
            'Knowledge Map A4 Receive':'knowledge-map-sync-a4-receive',
            'Knowledge Map A4 Nutstore':'knowledge-map-sync-a4-receive',
            'Knowledge Map A4 Publish':'knowledge-map-sync-a4-publish-probe'}
publish=vault_name=='Knowledge Map A4 Publish'
assert vault_name in plugin_ids and a4==(vault_name.startswith('Knowledge Map A4 '))
vault=out/vault_name
assert Path(preparation['vault']).resolve()==vault
marker_name='SYNC-A4-PUBLISH-ISOLATED-TEST.json' if publish else 'SYNC-A4-ISOLATED-TEST.json' if a4 else 'SYNC-A3-ISOLATED-TEST.json'
marker=json.loads((vault/marker_name).read_text(encoding='utf-8'))
assert marker['isolated'] is True and marker['suite']==preparation['suite']
plugin='.obsidian/plugins/'+plugin_ids[vault_name]+'/'
names=[marker_name,'START-HERE.md','.obsidian/community-plugins.json','.obsidian/core-plugins.json','.obsidian/app.json',plugin+'main.js',plugin+'manifest.json',plugin+'data.json']
data_expected={'probe':1,'suite':preparation['suite']}
if vault_name=='Knowledge Map A3 Recovery':
    names += [plugin+'styles.css','Synthetic/A.md','Recovery samples/layout-schema2.json']
    data_expected['settings']={'language':'zh'}
    data_expected['pipeline']={'config':{'include':['Synthetic/**']}}
if a4 and not publish:
    assert len(marker['suite'])==32 and all(c in '0123456789abcdef' for c in marker['suite'])
    names += [plugin+'styles.css','Synthetic/Arrival.md','A4 fixtures/first.txt','A4 fixtures/second.txt',
              'A4 fixtures/late-note.txt',f"Knowledge Map Sync/v2/{marker['suite']}/ops/A4-SAMPLE-FOLDER.txt"]
    data_expected={'settings':{'language':'zh'},'pipeline':{'config':{'include':['Synthetic/**']}}}
if publish:
    names.remove(plugin+'data.json')
if a4:
    assert {p.relative_to(vault).as_posix() for p in vault.rglob('*') if p.is_file()}==set(names)
contents={}
for name in names:
    file=vault/name
    assert file.resolve().is_relative_to(vault.resolve()) and not any(p.is_symlink() for p in [file,*file.parents]),name
    contents[vault_name+'/'+name]=file.read_bytes()
assert hashlib.sha256(contents[vault_name+'/'+plugin+'main.js']).hexdigest()==preparation['pluginMainSha256']
if not publish:
    assert json.loads(contents[vault_name+'/'+plugin+'data.json'])==data_expected
archive=out/(vault_name+' test vault.zip')
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
    for name,value in contents.items():z.writestr(name,value)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None and set(z.namelist())==set(contents)
    for name,value in contents.items():assert z.read(name)==value
result={'archive':str(archive),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'pluginMainSha256':preparation['pluginMainSha256'],'files':list(contents),'crcAndByteEquality':True,'cleanBlankData':True,'scope':'No profile, localStorage, IndexedDB, accounts, private keys, user notes or PC reports.'}
(out/'package-verification.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result))
