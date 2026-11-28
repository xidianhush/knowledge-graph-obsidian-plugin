"""U5 owned Windows Obsidian profiles. UI buttons via CDP/Playwright.
Only generated synthetic vaults; local delivery is not Nutstore/iPad testing.
"""
from pathlib import Path
import argparse,json,os,shutil,socket,subprocess,tempfile,time,urllib.request,re,hashlib
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'.local/sync-016/unified/u5'
def within(p):
 p=Path(p).resolve()
 if not p.is_relative_to(BASE.resolve()) or p==BASE.resolve():raise ValueError('out of synthetic scope')
 return p
def free_port():
 with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
def prepare(preparation):
 prep=json.loads((within(preparation)/'preparation.json').read_text(encoding='utf-8'));out=Path(tempfile.mkdtemp(prefix='native-',dir=BASE))
 asars=list((Path(os.environ['APPDATA'])/'obsidian').glob('obsidian-*.asar'));asar=max(asars,key=lambda p:tuple(int(x) for x in p.stem.removeprefix('obsidian-').split('.')))
 result={'out':str(out),'pluginId':prep['pluginId'],'pluginMainSha256':prep['pluginMainSha256'],'preparation':prep['out'],'asar':asar.name,'targets':{}}
 for role in ['PC','iPad']:
  vault=out/('Knowledge Map Unified '+role);shutil.copytree(within(prep['paths'][role]),vault);profile=out/('profile-'+role);profile.mkdir();shutil.copyfile(asar,profile/asar.name)
  (profile/'obsidian.json').write_text(json.dumps({'vaults':{os.urandom(8).hex():{'path':str(vault),'ts':int(time.time()*1000),'open':True}},'updateDisabled':True}),encoding='utf-8')
  result['targets'][role]={'vault':str(vault),'profile':str(profile),'port':free_port()}
 (out/'native.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
def launch(out,only=None):
 meta=json.loads((within(out)/'native.json').read_text());exe=Path('D:/Obsidian/Obsidian.exe');assert exe.is_file()
 q=lambda v:"'"+str(v).replace("'","''")+"'"
 for role,target in meta['targets'].items():
  if only and role!=only:continue
  with socket.socket() as s:s.bind(('127.0.0.1',target['port']))
  args=['--user-data-dir="'+str(within(target['profile']))+'"','--remote-debugging-port='+str(target['port']),'--remote-debugging-address=127.0.0.1','--enable-logging','--log-file="'+str(within(out)/(role+'-chromium.log'))+'"']
  command='Start-Process -FilePath '+q(exe)+' -ArgumentList @('+','.join(q(a) for a in args)+') -WindowStyle Hidden -PassThru | Select-Object -ExpandProperty Id'
  ps=Path(os.environ['WINDIR'])/'System32/WindowsPowerShell/v1.0/powershell.exe'
  r=subprocess.run([str(ps),'-NoProfile','-Command',command],capture_output=True,text=True,check=True);target['launcherPid']=r.stdout.strip()
 (within(out)/'native.json').write_text(json.dumps(meta,indent=2),encoding='utf-8');print(json.dumps(meta))
def close(out):
 from playwright.sync_api import sync_playwright
 meta=json.loads((within(out)/'native.json').read_text())
 with sync_playwright() as pw:
  for role,target in meta['targets'].items():
   browser=pw.chromium.connect_over_cdp('http://127.0.0.1:'+str(target['port']));pages=[p for c in browser.contexts for p in c.pages if p.url.startswith('app://')];assert len(pages)==1;assert Path(pages[0].evaluate('app.vault.adapter.basePath')).resolve()==within(target['vault'])
   try:browser.new_browser_cdp_session().send('Browser.close')
   except Exception:pass
 print('Closed only the two verified generated profiles')
def inspect(out):
 from playwright.sync_api import sync_playwright
 meta=json.loads((within(out)/'native.json').read_text());results={}
 with sync_playwright() as p:
  for role,target in meta['targets'].items():
   browser=p.chromium.connect_over_cdp('http://127.0.0.1:'+str(target['port']));pages=[page for context in browser.contexts for page in context.pages if page.url.startswith('app://')];assert len(pages)==1
   page=pages[0];page.wait_for_function('window.app?.vault',timeout=30000)
   results[role]=page.evaluate('''() => {const p=app.plugins.getPlugin('knowledge-map-sync-unified');return {vault:app.vault.adapter.basePath,plugins:app.plugins.enabledPlugins?Array.from(app.plugins.enabledPlugins):[],text:document.body.innerText.slice(-2200),candidate:!!p,error:p?.syncHost?.state()?.error??null,tabId:p?.settingTab?.id,tabConnected:p?.settingTab?.containerEl?.isConnected,tabDisplay:p?.settingTab?.display?.toString().slice(0,900),hasClose:typeof p?.unifiedClose,settingKeys:Object.keys(app.setting),modalCount:document.querySelectorAll('.modal').length};}''')
   results[role]['settingsWindow']=page.evaluate("({same:app.setting.win===window,isOpen:app.setting.isOpen,location:app.setting.win?.location?.href,text:app.setting.win?.document?.body?.innerText?.slice(-1200)})")
   results[role]['pageUrls']=[pg.url for ctx in browser.contexts for pg in ctx.pages]
   assert Path(results[role]['vault']).resolve()==within(target['vault'])
   page.screenshot(path=str(within(out)/(role+'-startup.png')))
 (within(out)/'startup.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({role:{'vault':r['vault'],'candidate':r['candidate'],'settingsWindow':r['settingsWindow']['same'],'pages':r['pageUrls']} for role,r in results.items()}))
def exercise(out,resume=False,incomplete_restore=False,competition_fixed=False,g4=False,g4_fb4=False,g4_fb5=False):
 from playwright.sync_api import sync_playwright
 out=within(out);meta=json.loads((out/'native.json').read_text());checks=[];pages={};browsers={};settingsPages={};events={}
 if (out/'failure.json').exists():shutil.copyfile(out/'failure.json',out/('failure-before-'+str(time.time_ns())+'.json'))
 def record(name):checks.append(name);(out/'progress.json').write_text(json.dumps({'checks':checks},ensure_ascii=False,indent=2),encoding='utf-8');print(name,flush=True)
 with sync_playwright() as pw:
  def connect(role):
   target=meta['targets'][role];b=pw.chromium.connect_over_cdp('http://127.0.0.1:'+str(target['port']));candidates=[page for ctx in b.contexts for page in ctx.pages if page.url.startswith('app://')];assert len(candidates)==1;page=candidates[0]
   page.wait_for_function('!!window.app?.vault?.adapter',timeout=30000)
   assert Path(page.evaluate('app.vault.adapter.basePath')).resolve()==within(target['vault']);page.on('pageerror',lambda err:events.setdefault(role,[]).append(str(err)));pages[role]=page;browsers[role]=b;return page
  def state(role):return pages[role].evaluate("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.state()")
  def settle(role):pages[role].evaluate("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.settled()")
  def settings(role):
   page=pages[role];page.evaluate("app.setting.open();app.setting.openTabById('knowledge-map-sync-unified')");page.wait_for_function("!!app.setting.win?.document?.querySelector('.kg-sync-settings')",timeout=10000)
   for context in browsers[role].contexts:
    for ui in context.pages:
     if ui.locator('.kg-sync-settings').count():settingsPages[role]=ui;return ui
   raise AssertionError('settings window target missing')
  def graph(role):
   page=pages[role];page.evaluate("async()=>{app.setting.close();await app.commands.commands['knowledge-map-sync-unified:build-vault-graph'].callback();}")
   page.wait_for_function("app.workspace.getLeavesOfType('knowledge-graph-vault-view').some(l=>l.view.graph?.renderer)",timeout=30000);settle(role);return page
  def click(role,selector):
   for context in browsers[role].contexts:
    for page in context.pages:
     found=page.locator(selector)
     if found.count() and found.first.is_visible():found.first.click(timeout=5000);settle(role);return
   raise AssertionError('visible native button missing '+role+' '+selector)
  def action(role,name):click(role,'[data-sync-action="'+name+'"]')
  def count(role):return len(state(role)['session']['accepted']['operations'])
  def deliver(source,dest):
   a=within(meta['targets'][source]['vault'])/'Knowledge Map Sync';b=within(meta['targets'][dest]['vault'])/'Knowledge Map Sync';copied=[]
   long=lambda p:Path('\\\\?\\'+str(p.resolve())) if os.name=='nt' else p
   for file in a.rglob('*.json'):
    target=long(b/file.relative_to(a));target.parent.mkdir(parents=True,exist_ok=True);body=long(file).read_bytes()
    if target.exists():assert target.read_bytes()==body
    else:target.write_bytes(body);copied.append(str(file.relative_to(a)))
   page=pages[dest];page.evaluate("app.plugins.getPlugin('knowledge-map-sync-unified').app.vault.adapter.exists('Knowledge Map Sync')");return copied
  def drag(role,dx,note='A'):
   page=graph(role)
   if page.locator('#legend-toggle').get_attribute('aria-expanded')=='true':page.locator('#legend-toggle').click();settle(role)
   page.evaluate("(()=>{const v=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view,r=v.graph.renderer,n=r.NODES.find(n=>n.path==='Synthetic/A.md'&&n.title==='Second');r.focusOn(n.id,1.25,0);})()".replace('Synthetic/A.md','Synthetic/'+note+'.md').replace("title==='Second'","title==='Fourth'" if note=='B' else "title==='Second'"))
   page.locator('#layout-mode').click();page.wait_for_timeout(150)
   point=page.evaluate("(()=>{const v=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view,r=v.graph.renderer,n=r.NODES.find(n=>n.path==='Synthetic/A.md'&&n.title==='Second'),c=v.host.shadowRoot.getElementById('cv').getBoundingClientRect();return {x:c.left+n.x*r.camera.zoom+r.camera.panX,y:c.top+n.y*r.camera.zoom+r.camera.panY};})()".replace('Synthetic/A.md','Synthetic/'+note+'.md').replace("title==='Second'","title==='Fourth'" if note=='B' else "title==='Second'"))
   hit=page.evaluate("p=>{const v=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view;return v.host.shadowRoot.elementFromPoint(p.x,p.y)?.id;}",point)
   assert hit=='cv',('canvas target is occluded',hit,point)
   page.mouse.move(point['x'],point['y']);page.mouse.down();page.mouse.move(point['x']+dx,point['y']+8,steps=12);page.mouse.up();page.locator('#layout-mode').click();settle(role)
  def restart(role):
   assert Path(pages[role].evaluate('app.vault.adapter.basePath')).resolve()==within(meta['targets'][role]['vault'])
   try:browsers[role].new_browser_cdp_session().send('Browser.close')
   except Exception:pass
   for _ in range(100):
    try:
     with socket.create_connection(('127.0.0.1',meta['targets'][role]['port']),timeout=.2):pass
    except OSError:break
    time.sleep(.1)
   launch(out,only=role)
   for _ in range(100):
    try:page=connect(role);break
    except Exception:time.sleep(.1)
   else:raise AssertionError('cold profile unavailable '+role)
   page.wait_for_function("!!window.app?.plugins?.getPlugin('knowledge-map-sync-unified')?.syncHost",timeout=20000)
  try:
   if resume and competition_fixed:
    checks=json.loads((out/'progress.json').read_text(encoding='utf-8'))['checks'];assert len(checks)==8
    for role in ['PC','iPad']:
     page=connect(role);page.wait_for_function("!!window.app?.plugins?.getPlugin('knowledge-map-sync-unified')?.syncHost",timeout=20000);assert count(role)==6
    identities={r:state(r)['installation'] for r in pages};receipts={r:state(r)['session']['accepted'] for r in pages}
    for role in ['PC','iPad']:
     restart(role);graph(role);assert state(role)['installation']==identities[role] and state(role)['session']['accepted']==receipts[role];settings(role);action(role,'export');settingsPages[role].screenshot(path=str(out/(role+'-fixed.png')))
    assert state('PC')['session']['accepted']['snapshot']['groups']==state('iPad')['session']['accepted']['snapshot']['groups']
    result={'pass':True,'states':{r:state(r) for r in pages},'checks':checks+['Explicit preservation and canceled/confirmed resolution completed; both real processes cold reopen unchanged without duplicate publication'],'scope':'Actual Windows Obsidian and local file copying, not Nutstore/iPad acceptance.'}
    (out/'competition-fixed.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'pass':True,'out':str(out)}));return
   if resume:
    checks=json.loads((out/'progress.json').read_text(encoding='utf-8'))['checks'];assert len(checks) in (3,6)
    for role in ['PC','iPad']:connect(role);settings(role)
    if len(checks)==3:assert count('PC')==1 and not state('iPad')['session']
    else:assert count('PC')==3 and count('iPad')==3 and state('PC')['status']=='local-ready'
   else:
    for role in ['PC','iPad']:
     page=connect(role);page.wait_for_function("!!app.plugins.getPlugin('knowledge-map-sync-unified')?.syncHost || document.body.innerText.includes('信任仓库作者并启用插件')",timeout=30000);trust=page.get_by_role('button',name=re.compile('信任.*作者'))
     if trust.count():trust.click();page.wait_for_timeout(900);page.wait_for_load_state('domcontentloaded')
     page.wait_for_function("!!app.plugins.getPlugin('knowledge-map-sync-unified')?.syncHost",timeout=20000)
     assert state(role)['status']=='unselected';graph(role);ui=settings(role);assert ui.locator('[data-sync-action="export"]').count()==1
    record('Two actual Obsidian profiles load marker-free candidate and ordinary settings without a selected identity')
    action('PC','export');report=list(within(meta['targets']['PC']['vault']).glob('Knowledge-Map-Sync-Report-*.json'));assert len(report)==1;initial=json.loads(report[0].read_text(encoding='utf-8'));assert initial['accepted'] is None
    record('Actual settings export creates an inspectable JSON report before connection')
    action('PC','new');click('PC','[data-sync-cancel]');assert state('PC')['selected'] is None
    action('PC','new');click('PC','[data-sync-confirm]');action('PC','join');click('PC','[data-join-choice="import"]');click('PC','[data-join-cancel]');assert not state('PC')['session']['initialized']
    action('PC','join');click('PC','[data-join-choice="import"]');click('PC','[data-join-confirm]');assert count('PC')==1;record('Actual new connection and join preview cancel/confirm preserve old layout and import once')
   if len(checks)<4:
    deliver('PC','iPad');action('iPad','find');settingsPages['iPad'].locator('[data-sync-picker]').select_option(index=1);action('iPad','choose');click('iPad','[data-sync-confirm]');action('iPad','join');click('iPad','[data-join-choice="shared"]');click('iPad','[data-join-confirm]');assert count('iPad')==1;record('Peer discovers locally delivered files and adopts through the ordinary settings preview without a second root')
   if len(checks)<6:
    drag('PC',24);pages['PC'].wait_for_function("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.state().session.accepted.operations.length===2",timeout=5000);record('Native canvas drag and end-edit automatically publish after durable local save')
    deliver('PC','iPad');graph('iPad');pages['iPad'].wait_for_function("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.state().session.accepted.operations.length===2",timeout=6000)
    drag('iPad',-26);pages['iPad'].wait_for_function("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.state().session.accepted.operations.length===3",timeout=5000)
    deliver('iPad','PC');graph('PC');pages['PC'].wait_for_function("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.state().session.accepted.operations.length===3",timeout=6000);record('Both real profiles publish and receive native edits through local file delivery')
   if g4 or g4_fb4 or g4_fb5:
    def wait_count(role,n):pages[role].wait_for_function("n=>app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.state().session.accepted.operations.length===n",arg=n,timeout=10000)
    def transfer(a,b):deliver(a,b);graph(b);pages[b].wait_for_function("n=>app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.state().session.accepted.operations.length===n",arg=count(a),timeout=10000)
    def toolbar(kind):
     page=pages['PC'];before=count('PC');page.locator('#layout-mode').click();page.locator('#layout-'+kind).click();page.locator('#layout-mode').click();settle('PC');wait_count('PC',before+1)
    drag('PC',22,'B');wait_count('PC',4);transfer('PC','iPad')
    toolbar('reset-group');assert len(state('PC')['session']['accepted']['snapshot']['groups'])==1
    toolbar('undo');assert len(state('PC')['session']['accepted']['snapshot']['groups'])==2
    toolbar('redo');toolbar('reset-all');assert not state('PC')['session']['accepted']['snapshot']['groups']
    toolbar('undo');transfer('PC','iPad');record('Actual toolbar group reset/undo/redo/reset-all and undo publish and reach the peer')
    drag('PC',-18,'B');transfer('PC','iPad')
    for role,dx in [('PC',20),('iPad',-20)]:
     before=count(role);drag(role,dx,'A');wait_count(role,before+1);drag(role,-dx,'B');wait_count(role,before+2)
    deliver('PC','iPad');deliver('iPad','PC');settings('PC');action('PC','conflict');ui=settingsPages['PC'];assert ui.locator('[data-resolution-choice]').count()==4;ui.screenshot(path=str(out/'four-complete-choices.png'));click('PC','[data-resolution-cancel]')
    action('PC','conflict');before=count('PC');peer_before=count('iPad');drag('iPad',13,'A');settings('iPad');action('iPad','restore');click('iPad','[data-sync-confirm]');wait_count('iPad',peer_before+1);deliver('iPad','PC');click('PC','[data-resolution-choice]');click('PC','[data-resolution-confirm]');assert count('PC')==before
    action('PC','conflict');assert ui.locator('[data-resolution-choice]').count()==4;click('PC','[data-resolution-choice]');click('PC','[data-resolution-confirm]');transfer('PC','iPad');assert state('PC')['session']['accepted']['snapshot']['groups']==state('iPad')['session']['accepted']['snapshot']['groups'];record('Four complete multi-domain choices; cancel and late-input consent are inert; fresh selection converges')
    def rename(role,old,new):pages[role].evaluate("async p=>app.vault.rename(app.vault.getAbstractFileByPath(p[0]),p[1])",[old,new]);graph(role)
    for old,new in [('Synthetic/A.md','Synthetic/C.md'),('Synthetic','Moved')]:
     if old=='Synthetic':
      for role in ['PC','iPad']:pages[role].evaluate("async()=>{const p=app.plugins.getPlugin('knowledge-map-sync-unified');await p.saveGraphSettings({settings:p.graphSettings,pipeline:{config:{...p.pipelineSettings.config,include:['Synthetic/**','Moved/**']}}});}");graph(role)
     before=count('PC');rename('PC',old,new);wait_count('PC',before+1);deliver('PC','iPad');rename('iPad',old,new);wait_count('iPad',count('PC'))
    record('Actual Vault rename events migrate note and folder identities atomically and peer accepts after matching notes arrive')
    for add in [True,False]:
     before=count('PC')
     for role in ['PC','iPad']:
      pages[role].evaluate("async add=>{const f=app.vault.getAbstractFileByPath('Moved/C.md'),s=await app.vault.read(f);await app.vault.modify(f,add?s+'# Fifth\\nNew heading.\\n':s.replace('# Fifth\\nNew heading.\\n',''));}",add)
      graph(role)
      if role=='PC':wait_count('PC',before+1);deliver('PC','iPad')
      else:wait_count('iPad',count('PC'))
    record('Actual note modifications add and remove a heading while retaining complete accepted groups')
    if g4_fb4 or g4_fb5:
     before=count('PC')
     for add in [True,False]:
      # Both profiles receive the note change BEFORE any corresponding layout
      # transport. The peer performs no manual layout edit.
      for role in ['PC','iPad']:
       pages[role].evaluate("async add=>{const f=app.vault.getAbstractFileByPath('Moved/C.md'),s=await app.vault.read(f);await app.vault.modify(f,add?s+'# Fifth\\nNew heading.\\n':s.replace('# Fifth\\nNew heading.\\n',''));}",add);graph(role);wait_count(role,before+(1 if add else 2))
      assert state('PC')['session']['accepted']['operations'][-1]==state('iPad')['session']['accepted']['operations'][-1]
      if add:legacy_source=state('PC')['session']['accepted']['operations'][-1]
     deliver('PC','iPad');deliver('iPad','PC');settings('PC');action('PC','check');settings('iPad');action('iPad','check');assert state('PC')['session']['accepted']['snapshot']['groups']==state('iPad')['session']['accepted']['snapshot']['groups'];record('Notes arrive before layout files on both actual profiles; equal structural IDs and subsequent deletion converge')
     # Seed one old-style random-ID duplicate into synthetic shared history.
     # This is explicit legacy/fault input, never an injected private receipt.
     import secrets,hashlib
     vault_root=within(meta['targets']['PC']['vault']);ops=vault_root/'Knowledge Map Sync'/'attempts-v1'/state('PC')['selected']['vault']/'ops'
     long=lambda p:Path('\\\\?\\'+str(p.resolve())) if os.name=='nt' else p
     source=next(p for p in ops.glob('*.json') if json.loads(long(p).read_text(encoding='utf-8'))['id']==legacy_source['id'])
     legacy_id=secrets.token_hex(16);body=long(source).read_text(encoding='utf-8').replace(legacy_source['id'],legacy_id).encode('utf-8');target=long(ops/(legacy_id+'.'+hashlib.sha256(body).hexdigest()+'.'+secrets.token_hex(16)+'.json'));target.write_bytes(body)
     delete_head=state('PC')['session']['accepted']['operations'][-1]['id']
     deliver('PC','iPad');settings('PC');action('PC','check');action('PC','conflict');ui=settingsPages['PC'];assert ui.locator('[data-resolution-choice]').count()>=2;assert ui.locator('[data-resolution-choice]:disabled').count()>=1;ui.screenshot(path=str(out/'legacy-compatible-review.png'));click('PC','[data-resolution-cancel]');assert count('PC')==before+2
     action('PC','conflict');click('PC','[data-resolution-choice="'+delete_head+'"]');click('PC','[data-resolution-confirm]');wait_count('PC',before+4);transfer('PC','iPad');assert state('PC')['session']['accepted']['snapshot']['groups']==state('iPad')['session']['accepted']['snapshot']['groups'];assert target.read_bytes()==body;record('Seeded legacy duplicate remains intact; real settings cancel then compatible choice resolve both profiles')
    if g4_fb5:
     before=count('PC')
     pages['PC'].evaluate("()=>{const p=app.plugins.getPlugin('knowledge-map-sync-unified'),a=app.vault.adapter,write=a.writeBinary.bind(a);a.writeBinary=async(path,body)=>{const r=await write(path,body);if(path.startsWith('Knowledge Map Sync/attempts-v1/')&&path.endsWith('.json')){a.writeBinary=write;p.layoutEpoch++;}return r;};}")
     for role in ['PC','iPad']:
      pages[role].evaluate("async()=>{const f=app.vault.getAbstractFileByPath('Moved/C.md'),s=await app.vault.read(f);await app.vault.modify(f,s+'# Fifth\\nNew heading.\\n');}");graph(role)
      if role=='PC':
       graph(role);wait_count(role,before+1)
     deliver('PC','iPad');deliver('iPad','PC');settings('PC');action('PC','check');settings('iPad');action('iPad','check');wait_count('iPad',before+1);assert state('PC')['session']['pending'] is None and state('iPad')['session']['pending'] is None
     assert state('PC')['session']['accepted']['snapshot']['groups']==state('iPad')['session']['accepted']['snapshot']['groups'];record('Injected epoch invalidation after real shared write automatically completes on new graph without a restore confirmation')
     for role in ['PC','iPad']:
      pages[role].evaluate("async()=>{const f=app.vault.getAbstractFileByPath('Moved/C.md'),s=await app.vault.read(f);await app.vault.modify(f,s.replace('# Fifth\\nNew heading.\\n',''));}");graph(role)
     deliver('PC','iPad');deliver('iPad','PC');settings('PC');action('PC','check');settings('iPad');action('iPad','check');wait_count('PC',before+2);wait_count('iPad',before+2);assert state('PC')['session']['accepted']['snapshot']['groups']==state('iPad')['session']['accepted']['snapshot']['groups'];record('Following heading removal also converges automatically with no additional branch or manual confirmation')
    receipts={r:state(r)['session']['accepted'] for r in pages};identities={r:state(r)['installation'] for r in pages}
    for role in ['PC','iPad']:restart(role);graph(role);assert state(role)['session']['accepted']==receipts[role] and state(role)['installation']==identities[role];settings(role);action(role,'export');settingsPages[role].screenshot(path=str(out/(role+'-g4-final.png')))
    record('Both real G4 profiles cold reopen with identical accepted history and original device identities')
    result={'pass':True,'checks':checks,'states':{r:state(r) for r in pages},'scope':'Real Windows Obsidian toolbar/mouse/settings and real Vault API note mutations; local shared-file copying, not iPad/Nutstore.'};(out/'g4.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'pass':True,'out':str(out)}));return
   settings('PC')
   if state('PC')['status']=='ready':action('PC','disable')
   drag('PC',18);assert count('PC')==3;before=state('PC');draft=before['session']['localState']['layoutDraft'];assert draft
   restart('PC');assert state('PC')['status']=='local-ready';graph('PC');assert state('PC')['session']['localState']['layoutDraft']['id']==draft['id'];assert state('PC')['session']['accepted']['appliedIds']==before['session']['accepted']['appliedIds']
   assert pages['PC'].evaluate("app.plugins.getPlugin('knowledge-map-sync-unified').layoutStore.state().groups")==draft['value']['groups']
   settings('PC');action('PC','enable');assert count('PC')==3;action('PC','restore');click('PC','[data-sync-cancel]');assert count('PC')==3
   if incomplete_restore:
    # Reproduce the user's interrupted flow through ordinary UI. No receipt,
    # draft, identity or operation is injected into the running plugin.
    canceled=state('PC');assert canceled['session']['localState']['layoutDraft']['id']==draft['id']
    drag('PC',-22);assert count('PC')==3
    local_draft=state('PC')['session']['localState']['layoutDraft'];assert local_draft and local_draft['id']!=draft['id']
    drag('iPad',22);assert count('iPad')==4;deliver('iPad','PC')
    for role in ['PC','iPad']:settings(role);action(role,'check')
    assert count('PC')==3 and count('iPad')==4
    assert state('PC')['session']['localState']['layoutDraft']==local_draft
    record('Canceled restore remains local after a newer local edit and peer delivery; normal check cannot accept over the draft')
    action('iPad','conflict');ui=settingsPages['iPad'];assert not ui.locator('[data-resolution-choice]').count()
    pages['iPad'].evaluate("app.plugins.getPlugin('knowledge-map-sync-unified').syncSettingsPanel.settled()")
    assert ('当前没有共享布局冲突' if competition_fixed else 'resolution-one-domain-required') in ui.locator('.kg-sync-settings').text_content()
    ui.locator('.kg-sync-settings details summary').click()
    ui.screenshot(path=str(out/'peer-no-shared-conflict.png'))
    record('Peer conflict button shows a normal no-conflict explanation' if competition_fixed else 'Peer conflict button opens no layout choice and shows resolution-one-domain-required for its single shared chain')
    originals={str(file.relative_to(within(meta['targets']['PC']['vault']))):hashlib.sha256(Path('\\\\?\\'+str(file.resolve())).read_bytes()).hexdigest() for file in (within(meta['targets']['PC']['vault'])/'Knowledge Map Sync').rglob('*.json')}
    action('PC','restore');assert settingsPages['PC'].locator('[data-sync-confirm]').count()==1;click('PC','[data-sync-confirm]')
    if competition_fixed:
     assert count('PC')==4 and state('PC')['session']['localState']['layoutDraft'] is None
     assert state('PC')['outcome']['reason']=='shared-conflict-review-required'
     action('PC','conflict');click('PC','[data-resolution-cancel]');assert count('PC')==4
     action('PC','conflict');click('PC','[data-resolution-choice]');click('PC','[data-resolution-confirm]');assert count('PC')==6
     deliver('PC','iPad');graph('iPad');pages['iPad'].wait_for_function("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.state().session.accepted.operations.length===6",timeout=6000)
     for name,digest in originals.items():assert hashlib.sha256(Path('\\\\?\\'+str((within(meta['targets']['PC']['vault'])/name).resolve())).read_bytes()).hexdigest()==digest
     identities={r:state(r)['installation'] for r in pages}
     for role in ['PC','iPad']:restart(role);graph(role);assert count(role)==6 and state(role)['installation']==identities[role];settings(role);action(role,'export');settingsPages[role].screenshot(path=str(out/(role+'-fixed.png')))
     assert state('PC')['session']['accepted']['snapshot']['groups']==state('iPad')['session']['accepted']['snapshot']['groups']
     result={'pass':True,'states':{r:state(r) for r in pages},'checks':checks+['Explicit preservation creates local branch; conflict cancellation is inert; selection converges; both processes cold reopen without duplicate publication'],'scope':'Actual Windows Obsidian and local file copying, not Nutstore/iPad acceptance.'}
     (out/'competition-fixed.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'pass':True,'out':str(out),'scope':result['scope']}));return
    assert count('PC')==3 and state('PC')['session']['localState']['layoutDraft']==local_draft
    assert state('PC')['publication']['lastResult']['reason']=='shared-candidate-blocked'
    for name,digest in originals.items():assert hashlib.sha256(Path('\\\\?\\'+str((within(meta['targets']['PC']['vault'])/name).resolve())).read_bytes()).hexdigest()==digest
    settingsPages['PC'].screenshot(path=str(out/'PC-restore-blocked.png'))
    record('Fresh explicit PC restore confirmation is held shared-candidate-blocked; draft and original shared bytes remain intact')
    for role in ['PC','iPad']:settings(role);action(role,'export')
    result={'reproduced':True,'productFixed':False,'checks':checks,'events':events,'states':{r:state(r) for r in pages},'canceledRestoreState':canceled,'scope':'Actual Windows Obsidian normal settings/buttons and mouse; two fresh synthetic profiles, local file delivery only. Reproduces an unfixed blocked flow, not acceptance.'}
    (out/'incomplete-restore.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'reproduced':True,'productFixed':False,'out':str(out)}));return
   action('PC','restore');click('PC','[data-sync-confirm]');pages['PC'].wait_for_function("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.state().session.accepted.operations.length===4",timeout=5000)
   record('Actual process cold reopen retains disabled local draft and identity; cancel holds, fresh explicit restore publishes')
   deliver('PC','iPad');graph('iPad');pages['iPad'].wait_for_function("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.state().session.accepted.operations.length===4",timeout=6000)
   drag('PC',-22);drag('iPad',22);assert count('PC')==5 and count('iPad')==5
   originals={role:{str(file.relative_to(within(meta['targets'][role]['vault']))):hashlib.sha256(Path('\\\\?\\'+str(file.resolve())).read_bytes()).hexdigest() for file in (within(meta['targets'][role]['vault'])/'Knowledge Map Sync').rglob('*.json')} for role in ['PC','iPad']}
   deliver('PC','iPad');deliver('iPad','PC')
   for role in ['PC','iPad']:settings(role);action(role,'check')
   assert count('PC')==5 and count('iPad')==5
   action('iPad','conflict');click('iPad','[data-resolution-cancel]');assert count('iPad')==5
   action('iPad','conflict');click('iPad','[data-resolution-choice]');click('iPad','[data-resolution-confirm]');assert count('iPad')==7
   deliver('iPad','PC');graph('PC');pages['PC'].wait_for_function("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.state().session.accepted.operations.length===7",timeout=6000)
   for role in ['PC','iPad']:
    for name,digest in originals[role].items():assert hashlib.sha256(Path('\\\\?\\'+str((within(meta['targets'][role]['vault'])/name).resolve())).read_bytes()).hexdigest()==digest
   assert state('PC')['session']['accepted']['snapshot']['groups']==state('iPad')['session']['accepted']['snapshot']['groups'];record('Native concurrent canvas edits remain separate branches; canceled conflict is inert and confirmed two-head resolution preserves originals')
   identities={r:state(r)['installation'] for r in ['PC','iPad']};accepted={r:state(r)['session']['accepted'] for r in ['PC','iPad']}
   for role in ['PC','iPad']:
    restart(role);graph(role);assert state(role)['installation']==identities[role];assert state(role)['session']['accepted']==accepted[role];settings(role);action(role,'check');assert count(role)==7
   record('Both actual Windows processes cold reopen with same installation and accepted history, without repeated import/publication')
   for role in ['PC','iPad']:ui=settings(role);action(role,'export');ui.screenshot(path=str(out/(role+'-settings.png')))
   result={'pass':True,'checks':checks,'events':events,'states':{r:state(r) for r in pages},'scope':'Real Windows Obsidian; normal navigation/commands and DOM buttons, native canvas input. Shared file delivery is explicit local copying, not Nutstore or iPad.'};(out/'exercise.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'pass':True,'checks':checks,'out':str(out)}))
  except Exception as error:
   failure={'pass':False,'checks':checks,'error':repr(error),'events':events,'states':{}}
   for role,page in pages.items():
    try:failure['states'][role]=state(role);failure[role+'Text']=page.locator('body').inner_text()[-3000:];page.screenshot(path=str(out/(role+'-failure.png')))
    except Exception:pass
   (out/'failure.json').write_text(json.dumps(failure,ensure_ascii=False,indent=2),encoding='utf-8');raise
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('mode',choices=['prepare','launch','inspect','exercise','close']);a.add_argument('path');a.add_argument('--resume',action='store_true');a.add_argument('--incomplete-restore',action='store_true');a.add_argument('--competition-fixed',action='store_true');a.add_argument('--g4',action='store_true');a.add_argument('--g4-fb4',action='store_true');a.add_argument('--g4-fb5',action='store_true');args=a.parse_args();globals()[args.mode](args.path,**({'resume':args.resume,'incomplete_restore':args.incomplete_restore,'competition_fixed':args.competition_fixed,'g4':args.g4,'g4_fb4':args.g4_fb4,'g4_fb5':args.g4_fb5} if args.mode=='exercise' else {}))
