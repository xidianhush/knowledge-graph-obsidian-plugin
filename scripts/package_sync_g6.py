"""Package only pristine synthetic allowlisted files; never a native profile."""
import argparse,hashlib,json,os,tempfile,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def sha(b):return hashlib.sha256(b).hexdigest()
def extended(p):return '\\\\?\\'+str(p.resolve()) if os.name=='nt' else str(p)
def run(preparation):
 source=Path(preparation).resolve();assert source.is_relative_to(ROOT/'.local')
 p=json.loads((source/'preparation.json').read_text(encoding='utf-8'));assert p['phase']=='G6';assert p['synthetic']['operations']==1024 and p['synthetic']['groups']==2
 base=ROOT/'.local/sync-016/g6';base.mkdir(parents=True,exist_ok=True);out=Path(tempfile.mkdtemp(prefix='delivery-',dir=base));checks=[]
 fixed={'START-HERE.md','Synthetic/A.md','Synthetic/B.md','.obsidian/app.json','.obsidian/community-plugins.json','.obsidian/core-plugins.json'}
 plugin='.obsidian/plugins/knowledge-map-sync-unified/'
 fixed.update(plugin+n for n in ['main.js','styles.css','manifest.json','data.json'])
 for role in ['PC','iPad']:
  root=Path(p['paths'][role]).resolve();assert root.is_relative_to(source);expected=p['digests'][role];actual={}
  for folder,_,files in os.walk(extended(root)):
   for name in files:
    full=os.path.join(folder,name);rel=os.path.relpath(full,extended(root)).replace('\\','/');actual[rel]=full
  assert set(actual)==set(expected)
  for name in actual:
   if name not in fixed:
    assert role=='PC' and name.startswith('Knowledge Map Sync/attempts-v1/'+p['synthetic']['vault']+'/ops/') and name.endswith('.json')
   assert sha(Path(actual[name]).read_bytes())==expected[name],name
  manifest=json.loads(Path(actual[plugin+'manifest.json']).read_text(encoding='utf-8'));assert manifest['version']=='0.0.15' and manifest['id']=='knowledge-map-sync-unified'
  assert expected[plugin+'main.js']==p['pluginMainSha256']
  archive=out/('Knowledge-Map-G6-'+role+'.zip')
  with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
   for name,full in sorted(actual.items()):z.write(full,'Knowledge Map G6 '+role+'/'+name)
  with zipfile.ZipFile(archive) as z:
   assert z.testzip() is None;assert len(z.infolist())==len(expected)
   for name,full in actual.items():assert z.read('Knowledge Map G6 '+role+'/'+name)==Path(full).read_bytes()
  checks.append({'role':role,'files':len(expected),'sha256':sha(archive.read_bytes()),'archive':str(archive),'crcAndBytes':True})
 (out/'G6-操作指南.md').write_text(Path(actual['START-HERE.md']).read_text(encoding='utf-8'),encoding='utf-8')
 result={'pass':True,'out':str(out),'preparation':str(source),'main':p['pluginMainSha256'],'remote':p['remote'],'synthetic':p['synthetic'],'packages':checks,'scope':p['scope']};(out/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('preparation');run(a.parse_args().preparation)
