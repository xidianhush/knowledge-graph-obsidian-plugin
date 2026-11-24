"""Owned Windows Obsidian profile; actual 0.0.15 -> formal 0.0.16 -> candidate.
All vaults/files are generated. No user's Obsidian profile or daily vault is used.
"""
from pathlib import Path
import os,json,hashlib,subprocess,tempfile,shutil,socket,time,urllib.request,re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'.local/layout-upgrade';BASE.mkdir(parents=True,exist_ok=True)
OUT=Path(tempfile.mkdtemp(prefix='native-',dir=BASE));vault=OUT/'Synthetic Vault';profile=OUT/'Profile';profile.mkdir();vault.mkdir()
def command(args,cwd=ROOT):return subprocess.check_output(args,cwd=cwd,stderr=subprocess.STDOUT)
def archive(tag):
 existing=[p for p in BASE.glob('native-*/source-'+tag+'/dist') if (p/'main.js').is_file() and (p/'manifest.json').is_file()]
 if existing:return sorted(existing)[-1]
 dst=OUT/('source-'+tag);dst.mkdir()
 files=command(['git','ls-tree','-r','--name-only',tag]).decode().splitlines()
 for name in files:
  if name.startswith(('src/','scripts/','upstream/')) or name in ['package.json','manifest.json','styles.css']:
   target=dst/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(command(['git','show',tag+':'+name]))
 command(['node','scripts/build.mjs'],dst);return dst/'dist'
old=archive('0.0.15');formal=archive('0.0.16')
plugin=vault/'.obsidian/plugins/knowledge-graph-smoke';plugin.mkdir(parents=True)
(vault/'.obsidian/community-plugins.json').write_text('["knowledge-graph-smoke"]',encoding='utf-8')
(vault/'.obsidian/app.json').write_text('{"safeMode":false}',encoding='utf-8')
(vault/'.obsidian/core-plugins.json').write_text('["file-explorer","command-palette"]',encoding='utf-8')
(vault/'Synthetic').mkdir()
for n in ['A','B','C']:(vault/'Synthetic'/(n+'.md')).write_text('# First\nFirst body.\n# Second\nSecond body.\n# Third\nThird body.\n',encoding='utf-8')
asar=max((Path(os.environ['APPDATA'])/'obsidian').glob('obsidian-*.asar'),key=lambda p:tuple(map(int,p.stem.removeprefix('obsidian-').split('.'))));shutil.copyfile(asar,profile/asar.name)
(profile/'obsidian.json').write_text(json.dumps({'vaults':{'1234567890abcdef':{'path':str(vault),'ts':int(time.time()*1000),'open':True}},'updateDisabled':True}),encoding='utf-8')
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
ps=Path(os.environ['WINDIR'])/'System32/WindowsPowerShell/v1.0/powershell.exe'
def quote(v):return "'"+str(v).replace("'","''")+"'"
def install(dist):
 for name in ['main.js','manifest.json','styles.css']:shutil.copyfile(dist/name,plugin/name)
def launch():
 args=['--user-data-dir="'+str(profile)+'"','--remote-debugging-port='+str(port),'--remote-debugging-address=127.0.0.1','--disable-gpu']
 cmd='Start-Process -FilePath '+quote('D:/Obsidian/Obsidian.exe')+' -ArgumentList @('+','.join(map(quote,args))+') -WindowStyle Hidden -PassThru | Select-Object -ExpandProperty Id'
 pid=int(command([str(ps),'-NoProfile','-Command',cmd]).decode().strip())
 for i in range(120):
  try:urllib.request.urlopen(f'http://127.0.0.1:{port}/json/version',timeout=1);return pid
  except Exception:time.sleep(.25)
 raise RuntimeError('Owned Obsidian CDP unavailable')
checks=[];pid=None;browser=None
with sync_playwright() as p:
 def open_app(dist):
  global pid,browser,page
  install(dist);pid=launch();browser=p.chromium.connect_over_cdp(f'http://127.0.0.1:{port}');page=next(pg for pg in browser.contexts[0].pages if 'app://obsidian.md' in pg.url)
  page.wait_for_function('window.app?.vault?.adapter',timeout=30000)
  assert Path(page.evaluate('app.vault.adapter.basePath')).resolve()==vault.resolve()
  page.wait_for_function("app.plugins?.getPlugin('knowledge-graph-smoke')||document.body.innerText.includes('信任仓库作者并启用插件')||document.body.innerText.includes('Trust author')",timeout=30000)
  trust=page.get_by_role('button',name=re.compile('信任.*作者|Trust.*author',re.I))
  if trust.count():trust.click();page.wait_for_timeout(900);page.wait_for_load_state('domcontentloaded')
  try:page.wait_for_function("window.app?.workspace?.layoutReady&&app.plugins?.getPlugin('knowledge-graph-smoke')",timeout=30000)
  except Exception:
   page.screenshot(path=str(OUT/'startup-failure.png'))
   diagnostic=page.evaluate("({url:location.href,text:document.body.innerText.slice(-2000),hasApp:!!window.app,plugins:window.app?.plugins?Object.keys(app.plugins.plugins):null})")
   (OUT/'startup-failure.json').write_text(json.dumps(diagnostic,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(diagnostic,ensure_ascii=False),flush=True);raise
  assert Path(page.evaluate('app.vault.adapter.basePath')).resolve()==vault.resolve()
  page.evaluate("async()=>{window.P=app.plugins.getPlugin('knowledge-graph-smoke');await app.commands.executeCommandById('knowledge-graph-smoke:build-vault-graph');}")
  page.wait_for_function("app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0]?.view.graph?.renderer",timeout=30000)
  page.evaluate("()=>{window.V=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view;window.R=V.graph.renderer;app.workspace.setActiveLeaf(V.leaf,{focus:true});}")
  page.evaluate('P.layoutStore.settled()')
 def close_app():
  global pid,browser
  if browser:
   try:page.evaluate('P.layoutStore.settled()');browser.close()
   except Exception:pass
  if pid:
   # Only terminate the PID we launched for the checked generated profile.
   command([str(ps),'-NoProfile','-Command','Stop-Process -Id '+str(pid)+' -ErrorAction SilentlyContinue'])
  browser=None;pid=None;time.sleep(.5)
 def positions():return page.evaluate('R.NODES.map(n=>[n.id,n.x,n.y,n.r])')
 def near(a,b):return len(a)==len(b) and all(x[0]==y[0] and max(abs(u-v) for u,v in zip(x[1:],y[1:]))<1e-7 for x,y in zip(a,b))
 def record(name):checks.append(name);(OUT/'progress.json').write_text(json.dumps(checks,indent=2),encoding='utf-8');print(name,flush=True)
 try:
  open_app(old)
  page.evaluate("()=>{window.H=R.NODES.find(n=>n.kind==='note'&&n.path==='Synthetic/A.md');R.selected=H.id;R.setEditMode(true);R.focusOn(H.id,1.25,0);}");page.wait_for_timeout(250)
  at=page.evaluate("()=>{const b=V.host.shadowRoot.getElementById('cv').getBoundingClientRect();return{x:b.left+H.x*R.camera.zoom+R.camera.panX,y:b.top+H.y*R.camera.zoom+R.camera.panY}}")
  page.mouse.move(at['x'],at['y']);page.mouse.down();page.mouse.move(at['x']+25,at['y']+18,steps=16);page.mouse.up();page.evaluate('P.layoutStore.settled()');page.evaluate('R.setEditMode(false)')
  saved=page.evaluate('P.layoutStore.state()');assert len(saved['groups'])>0,'Real layout drag did not persist'
  before=positions();original=(plugin/'data.json').read_bytes();close_app();open_app(old);assert near(before,positions());record('Real 0.0.15 drag persisted across a cold process reopen')
  close_app();open_app(formal);assert near(before,positions());record('Same structure upgrade to formal 0.0.16 preserves the compatible saved geometry')
  # Note siblings are unchanged; adding headings inside C changes their parent-local radii.
  close_app();(vault/'Synthetic/C.md').write_text('# First\nBody\n# Second\nBody\n# Third\nBody\n# Fourth\nBody\n# Fifth\nBody\n',encoding='utf-8')
  shutil.copyfile(plugin/'data.json',OUT/'before-upgrade-data.json');raw=(plugin/'data.json').read_bytes()
  open_app(formal);formal_positions=positions();formal_report=page.evaluate('({groups:Object.keys(P.layoutStore.state().groups).length,status:P.syncHost.state().status})');close_app()
  # Same precise source and note bytes, different runtime; never reuse mutated experimental state.
  (plugin/'data.json').write_bytes(raw);open_app(ROOT/'dist');fixed_positions=positions();report=page.evaluate('({groups:Object.keys(P.layoutStore.state().groups).length,status:P.syncHost.state().status,archive:P.savedData.layoutUpgradeOriginal!==undefined})')
  assert not near(formal_positions,fixed_positions),'Expected formal runtime to skip radius-incompatible saved geometry'
  assert report['archive'];assert report['status']=='unselected';assert report['groups']==formal_report['groups']
  page.screenshot(path=str(OUT/'candidate.png'));record('Same source: formal 0.0.16 skips stale geometry; candidate reconciles before mount without joining')
  after=(plugin/'data.json').read_bytes();close_app();open_app(ROOT/'dist');assert near(fixed_positions,positions());record('Candidate restored geometry and original archive survive a cold process reopen')
  result={'pass':True,'checks':checks,'out':str(OUT),'formal':formal_report,'candidate':report,'runtimeSha256':hashlib.sha256((ROOT/'dist/main.js').read_bytes()).hexdigest(),'scope':'Actual Windows Obsidian in a generated profile; no real iPad or Nutstore validation'}
  (OUT/'verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
 finally:close_app()
