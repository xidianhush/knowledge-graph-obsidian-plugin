"""Copy only the user-approved scope and referenced local images into a new trial vault.

Never installs into, writes to, or reads other Markdown from the daily vault.
Refuses existing destinations and symlink/junction escapes. Requires synthetic acceptance first.
"""
from pathlib import Path
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from urllib.parse import unquote

ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(r'D:\obsidian_vault\hush-ob-bucket').resolve()
TRIAL=ROOT/'real-vault-trial'
PROFILE=ROOT/'real-trial-profile'
OUT=ROOT/'.local/evidence'
SCOPES=['Science and Tech','Literature History Philosophy']
IMAGE_EXT={'.png','.jpg','.jpeg','.gif','.svg','.webp','.bmp','.heic','.avif'}
for name,count in [('native',31),('vault-pipeline',16),('smoke',24),('core-browser',17),('settings',24)]:
    rows=json.loads((OUT/(name+'-results.json')).read_text(encoding='utf8'))
    assert len(rows)==count and all(r['pass'] for r in rows), 'Independent acceptance required: '+name
assert not TRIAL.exists() and not PROFILE.exists(), 'Refusing to overwrite an existing trial or profile'
assert TRIAL.resolve().parent==ROOT and SOURCE!=TRIAL.resolve()

def safe_source(file):
    resolved=file.resolve()
    assert resolved.is_relative_to(SOURCE), 'Source path escapes vault'
    rel=resolved.relative_to(SOURCE)
    assert not any(part.startswith('.') for part in rel.parts)
    assert rel.as_posix().lower()!='utilities/api key.md'
    return rel

notes=[]
for scope in SCOPES:
    base=SOURCE/scope
    assert base.resolve().is_relative_to(SOURCE) and base.resolve()==base
    for directory,dirs,files in os.walk(base,followlinks=False):
        dirs[:]=[d for d in dirs if not d.startswith('.') and not (Path(directory)/d).is_symlink() and d!='node_modules']
        for name in files:
            file=Path(directory)/name
            if file.suffix.lower()=='.md' and not file.is_symlink():
                rel=safe_source(file)
                assert rel.parts[0] in SCOPES
                notes.append((file,rel))

# Index image paths only; do not inspect non-approved Markdown or excluded areas.
images={}
excluded={'Utilities','Logs','Medical and Health','Projects','copilot','quartz-setup','node_modules'}
for directory,dirs,files in os.walk(SOURCE,followlinks=False):
    dirs[:]=[d for d in dirs if not d.startswith('.') and d not in excluded and not (Path(directory)/d).is_symlink()]
    for name in files:
        f=Path(directory)/name
        if f.suffix.lower() in IMAGE_EXT and not f.is_symlink():
            rel=safe_source(f)
            images[rel.as_posix().lower()]=(f,rel)
by_name={}
for key,pair in images.items():by_name.setdefault(pair[1].name.lower(),[]).append(pair)

TRIAL.mkdir()
manifest={'source':str(SOURCE),'destination':str(TRIAL),'scopes':SCOPES,'notes':[],'images':[],'unresolved_images':[]}
selected_images={}
def copy_file(file,rel,kind):
    raw=file.read_bytes()
    target=TRIAL/rel
    assert target.resolve().is_relative_to(TRIAL.resolve())
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(raw)
    manifest[kind].append({'path':rel.as_posix(),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
    return raw
for file,rel in sorted(notes):
    raw=copy_file(file,rel,'notes')
    text=raw.decode('utf-8-sig')
    # Ignore fenced code when collecting actual embedded-image references.
    text=re.sub(r'(?ms)^\s*(`{3,}|~{3,}).*?^\s*\1\s*$', '', text)
    refs=re.findall(r'!\[\[([^\]]+)\]\]',text)
    refs += [a or b for a,b in re.findall(r'!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+[^)]*)?\)',text)]
    refs += re.findall(r'<img\b[^>]*\bsrc=["\']([^"\']+)',text,re.I)
    for reference in refs:
        value=unquote(reference.split('|',1)[0].split('#',1)[0].split('?',1)[0]).replace('\\','/')
        if re.match(r'^[a-zA-Z][\w+.-]*:',value) or value.startswith('//') or Path(value).suffix.lower() not in IMAGE_EXT:continue
        candidates=[]
        for candidate in [file.parent/value,SOURCE/value.lstrip('/')]:
            resolved=candidate.resolve()
            if resolved.is_relative_to(SOURCE):
                pair=images.get(resolved.relative_to(SOURCE).as_posix().lower())
                if pair:candidates=[pair];break
        if not candidates:candidates=by_name.get(Path(value).name.lower(),[])
        if len(candidates)==1:selected_images[candidates[0][1].as_posix()]=candidates[0]
        else:manifest['unresolved_images'].append({'note':rel.as_posix(),'reference':value,'reason':'missing or ambiguous'})
for file,rel in sorted(selected_images.values()):copy_file(file,rel,'images')

plugin=TRIAL/'.obsidian/plugins/knowledge-graph-smoke'
plugin.mkdir(parents=True)
for name in ['main.js','manifest.json','styles.css']:shutil.copy2(ROOT/'dist'/name,plugin/name)
(plugin/'data.json').write_text(json.dumps({'settingsVersion':1,'settings':{'autoUpdate':True,'debounceMs':350},'pipeline':{'config':{'include':[s+'/**' for s in SCOPES],'exclude':['Utilities/**'],'exclude_notes':[],'remap':[],'preview':{'enabled':True,'max_note_chars':60000}}}},ensure_ascii=False,indent=2),encoding='utf8')
config=TRIAL/'.obsidian'
(config/'community-plugins.json').write_text('["knowledge-graph-smoke"]',encoding='utf8')
(config/'core-plugins.json').write_text('["file-explorer","switcher","command-palette"]',encoding='utf8')
(config/'appearance.json').write_text('{"theme":"obsidian"}',encoding='utf8')
PROFILE.mkdir()
(PROFILE/'obsidian.json').write_text(json.dumps({'vaults':{'ca4e000000000044':{'path':str(TRIAL),'ts':1793000000000,'open':True}}}),encoding='utf8')
(OUT/'real-trial-copy.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
summary={key:len(manifest[key]) for key in ['notes','images','unresolved_images']}
summary['image_bytes']=sum(row['bytes'] for row in manifest['images'])
if '--launch' in sys.argv:
    with (OUT/'real-trial-process.log').open('w',encoding='utf8') as log:
        proc=subprocess.Popen([r'D:\obsidian\Obsidian.exe','--user-data-dir='+str(PROFILE),'--remote-debugging-port=9239','--remote-debugging-address=127.0.0.1'],stdout=log,stderr=log,creationflags=subprocess.CREATE_NO_WINDOW)
    summary['pid']=proc.pid
print(json.dumps(summary))
