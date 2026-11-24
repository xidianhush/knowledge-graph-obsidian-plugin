"""Whitelist-only G7 delivery; no identities, profiles, journals or evidence."""
import argparse,json,hashlib,tempfile,zipfile,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def raw(p):return Path('\\\\?\\'+str(Path(p).resolve())).read_bytes() if os.name=='nt' else Path(p).read_bytes()
def digest(b):return hashlib.sha256(b).hexdigest()
def run(preparation,legacy):
 preparation=Path(preparation).resolve();legacy=Path(legacy).resolve();assert preparation.is_relative_to(ROOT/'.local/sync-016/g7')
 prep=json.loads(raw(preparation/'preparation.json'));assert prep['phase']=='G7' and prep['pluginId']=='knowledge-graph-smoke'
 out=Path(tempfile.mkdtemp(prefix='delivery-',dir=ROOT/'.local/sync-016/g7'));checks=[];packages=[]
 for role in ['PC','iPad']:
  vault=Path(prep['paths'][role]).resolve();assert vault.is_relative_to(preparation)
  names=prep['allowlist'];assert len(names)==10 and len(set(names))==10
  allowed={'START-HERE.md','Synthetic/A.md','Synthetic/B.md','.obsidian/app.json','.obsidian/community-plugins.json','.obsidian/core-plugins.json',*['.obsidian/plugins/knowledge-graph-smoke/'+n for n in ['main.js','manifest.json','styles.css','data.json']]};assert set(names)==allowed
  zpath=out/('Knowledge-Map-G7-'+role+'.zip')
  with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED) as z:
   for name in names:
    data=raw(vault/name);assert digest(data)==prep['digests'][role][name];z.writestr('Knowledge Map G7 '+role+'/'+name,data)
  with zipfile.ZipFile(zpath) as z:
   assert z.testzip() is None and len(z.namelist())==10
   for name in names:assert z.read('Knowledge Map G7 '+role+'/'+name)==raw(vault/name)
  packages.append({'role':role,'path':str(zpath),'files':10,'sha256':digest(raw(zpath))});checks.append(role+' CRC/whitelist/hash/exact source bytes')
 kit={};hashes={};expected={'main.js':'8801c3a3e5c2d96fcd6d230e8b703eac8472ac815e677e915c81c23249411391','manifest.json':'67f707c580bb80580bffd0c005e719292d887c346883f3c708b440bbd4ae0b43','styles.css':'50e33695e56f27070669d219d9ecf9d64f76e2359f1de1fa38fa42e30a4adb56'}
 for name,wanted in expected.items():
  data=raw(legacy/name);assert digest(data)==wanted;kit['G7-正式0.0.15/'+name]=data
  candidate=raw(Path(prep['paths']['PC'])/'.obsidian/plugins/knowledge-graph-smoke'/name);kit['G7-返回候选/'+name]=candidate
 for name,data in kit.items():hashes[name]=digest(data)
 assert hashes['G7-返回候选/main.js']==prep['pluginMainSha256'];kit['SHA256SUMS.json']=(json.dumps(hashes,ensure_ascii=False,indent=2)+'\n').encode()
 zpath=out/'G7-版本切换文件-放在库外.zip'
 with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED) as z:
  for name,data in kit.items():z.writestr(name,data)
 with zipfile.ZipFile(zpath) as z:
  assert z.testzip() is None and set(z.namelist())==set(kit)
  for name,data in kit.items():assert z.read(name)==data
 packages.append({'role':'version-kit','path':str(zpath),'files':7,'sha256':digest(raw(zpath))});checks.append('Exact published 0.0.15 assets and returned candidate three-file kit CRC/hash/bytes')
 guide=raw(preparation/'Knowledge Map G7 PC/START-HERE.md');(out/'G7-操作指南.md').write_bytes(guide)
 result={'pass':True,'out':str(out),'preparation':str(preparation),'remote':prep['remote'],'main':prep['pluginMainSha256'],'packages':packages,'kitHashes':hashes,'checks':checks,'scope':'Only fresh synthetic vault allowlists and public three-file version kits; no device identity/private ledger/credentials/user reports/screenshots/profile'}
 (out/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('preparation');a.add_argument('legacy');x=a.parse_args();run(x.preparation,x.legacy)
