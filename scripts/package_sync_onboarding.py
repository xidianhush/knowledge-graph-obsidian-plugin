"""Package two pristine onboarding fixtures with an explicit public allowlist."""
import hashlib
import json
import sys
import tempfile
import zipfile
from pathlib import Path

root=Path(__file__).resolve().parents[1]
native=(root/'.local/sync-016/a4/native').resolve()
base=root/'.local/sync-016/a5/onboarding'
base.mkdir(parents=True,exist_ok=True)
out=Path(tempfile.mkdtemp(prefix='delivery-',dir=base))
preps=[json.loads((Path(arg)/'preparation.json').read_text(encoding='utf-8')) for arg in sys.argv[1:]]
assert len(preps)==2 and [p['scenario'] for p in preps]==['OnboardEmpty','OnboardBoth']
assert len({p['suite'] for p in preps})==2
plugin='.obsidian/plugins/knowledge-map-a4-attempt-layout/'
names=['START-HERE.md','SYNC-A4-ATTEMPT-LAYOUT.json','Synthetic/A.md','Synthetic/B.md',
       '.obsidian/app.json','.obsidian/community-plugins.json','.obsidian/core-plugins.json',
       plugin+'manifest.json',plugin+'main.js',plugin+'styles.css',plugin+'data.json']
guide=(root/'docs/SYNC_A5_ONBOARDING_GUIDE.md').read_text(encoding='utf-8')
guide=guide.replace('{{SCENARIO}}','两组，请使用对应目录').replace('{{REMOTE}}',
    '第一组 '+preps[0]['remote']+'；第二组 '+preps[1]['remote'])
(out/'OPEN-FIRST.md').write_text(guide,encoding='utf-8')
results=[]
for role in ['PC','iPad']:
    contents={'OPEN-FIRST.md':guide.encode('utf-8')}
    for prep in preps:
        vault=Path(prep['paths'][role]).resolve()
        assert vault.is_relative_to(native) and vault!=native
        assert vault.name=='Knowledge Map A5 '+prep['scenario']+' '+role
        actual={p.relative_to(vault).as_posix() for p in vault.rglob('*') if p.is_file()}
        assert actual==set(names),actual.symmetric_difference(names)
        marker=json.loads((vault/'SYNC-A4-ATTEMPT-LAYOUT.json').read_text())
        assert marker==dict(version=1,isolated=True,suite=prep['suite'],scenario=prep['scenario'])
        data=json.loads((vault/(plugin+'data.json')).read_text(encoding='utf-8'))
        assert set(data)==({'settings','pipeline','ui','onboardingFixture','layoutOverrides'} if role=='PC' or prep['scenario']=='OnboardBoth' else {'settings','pipeline','ui','onboardingFixture'})
        assert data['onboardingFixture']==dict(role=role,preserve='synthetic-only')
        for name in names:
            file=vault/name
            assert not any(p.is_symlink() for p in [file,*file.parents])
            contents[vault.name+'/'+name]=file.read_bytes()
        assert hashlib.sha256(contents[vault.name+'/'+plugin+'main.js']).hexdigest()==prep['pluginMainSha256']
    archive=out/('Knowledge-Map-Onboarding-20261114-'+role+'.zip')
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for name,value in contents.items():z.writestr(name,value)
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None and set(z.namelist())==set(contents)
        for name,value in contents.items():assert z.read(name)==value
    results.append(dict(role=role,archive=str(archive),bytes=archive.stat().st_size,
        sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),files=list(contents),crcAndByteEquality=True))
result=dict(out=str(out),preparations=preps,packages=results,
    scope='Only allowlisted synthetic notes, fixture layouts and plugin files; no profiles, credentials, reports or private logs.')
(out/'package-verification.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result))
