"""Strict generated G5 allowlist; fault kit is packaged outside both vaults."""
import hashlib,json,sys,tempfile,zipfile,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=(ROOT/'.local/sync-016/unified/u5').resolve()
def read(p):return (Path('\\\\?\\'+str(p.resolve())) if os.name=='nt' else p).read_bytes()
def inventory(p):
 scan=Path('\\\\?\\'+str(p.resolve())) if os.name=='nt' else p
 return {f.relative_to(scan).as_posix() for f in scan.rglob('*') if f.is_file()}
prepdir=Path(sys.argv[1]).resolve();assert prepdir.is_relative_to(BASE) and prepdir.name.startswith('pristine-')
p=json.loads(read(prepdir/'preparation.json'));assert p['phase']=='G5'
expected={'START-HERE.md','Synthetic/A.md','Synthetic/B.md','.obsidian/app.json','.obsidian/community-plugins.json','.obsidian/core-plugins.json'}
expected.update('.obsidian/plugins/knowledge-map-sync-unified/'+n for n in ['main.js','styles.css','manifest.json','data.json']);assert set(p['allowlist'])==expected
s=p['synthetic'];shared=s['ops']+'/'+s['originalName'];kit={'01-未知文件/unexpected.json','02-原件备份/'+s['originalName'],'03-同ID不同正文/'+s['badName']};assert set(p['faultKit'])==kit
out=Path(tempfile.mkdtemp(prefix='g5-delivery-',dir=BASE));packages=[]
for role in ['PC','iPad','faultKit']:
 folder=prepdir/'G5故障样本-放在库外' if role=='faultKit' else Path(p['paths'][role]);assert folder.resolve().is_relative_to(prepdir)
 hashes=p['faultKit'] if role=='faultKit' else p['digests'][role];allowed=kit if role=='faultKit' else expected|({shared} if role=='PC' else set())
 assert set(hashes)==allowed and inventory(folder)==allowed
 data={name:read(folder/name) for name in allowed};assert all(hashlib.sha256(b).hexdigest()==hashes[n] for n,b in data.items())
 if role!='faultKit':
  config=json.loads(data['.obsidian/plugins/knowledge-map-sync-unified/data.json']);assert set(config)<= {'settings','pipeline','ui','layoutOverrides'}
  assert hashlib.sha256(data['.obsidian/plugins/knowledge-map-sync-unified/main.js']).hexdigest()==p['pluginMainSha256']
 target=out/('G5-故障样本-放在库外.zip' if role=='faultKit' else 'Knowledge-Map-G5-'+role+'.zip')
 with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
  for name,b in sorted(data.items()):z.writestr(folder.name+'/'+name,b)
 with zipfile.ZipFile(target) as z:
  assert z.testzip() is None and set(z.namelist())=={folder.name+'/'+n for n in allowed}
  assert all(z.read(folder.name+'/'+n)==b for n,b in data.items())
 packages.append({'role':role,'path':str(target),'sha256':hashlib.sha256(read(target)).hexdigest(),'files':len(data),'crcAndBytes':True})
(out/'G5-操作指南.md').write_bytes(read(Path(p['paths']['PC'])/'START-HERE.md'))
result={'pass':True,'out':str(out),'preparation':str(prepdir),'remote':p['remote'],'synthetic':s,'main':p['pluginMainSha256'],'packages':packages,'scope':p['scope']}
(out/'package-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
