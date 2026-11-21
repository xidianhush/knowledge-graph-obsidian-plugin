"""Owned headless Chrome: real DOM buttons and IndexedDB, injected App/files.
Not Obsidian, Nutstore or iPad validation. No user browser/profile is opened.
"""
from pathlib import Path
import json,threading,base64,tempfile
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'.local/sync-016/unified/u4'
BASE.mkdir(parents=True,exist_ok=True)
OUT=Path(tempfile.mkdtemp(prefix='browser-',dir=BASE))
public=['src/i18n.js','src/i18n.obsidian.js','src/pipeline/defaults.js','src/pipeline/input.js','src/settings.js','src/i18n.receive.js','src/i18n.sync.js']
runtime='const require=()=>({PluginSettingTab:class{},Setting:class{}});\n'+'\n'.join((ROOT/p).read_text(encoding='utf-8') for p in public)+'\nwindow.validateGraphSettings=validateGraphSettings;window.kgT=kgT;window.kgI18nSetPreference=kgI18nSetPreference;kgI18nSetPreference("zh");'
html='''<!doctype html><meta charset="utf-8"><style>
:root{color-scheme:dark;--background-modifier-border:#5b6268;--interactive-accent:#69afff}*{box-sizing:border-box}body{margin:0;background:#202326;color:#eee;font:16px system-ui}main{max-width:820px;margin:auto;padding:24px}p{line-height:1.6}button,select{font:inherit;color:inherit;background:#353b41;border:1px solid #68717b;border-radius:6px;padding:8px;cursor:pointer}button:disabled{opacity:.45;cursor:default}button[aria-pressed=true]{border-color:#69afff}button p{font-size:14px}.modal{position:fixed;inset:24px auto auto 50%;transform:translateX(-50%);max-height:calc(100vh - 48px);overflow:auto;background:#282c31;box-shadow:0 0 0 200vmax #0009;border:1px solid #69747c;border-radius:12px;padding:20px;z-index:100}svg{max-width:100%}pre{font-size:12px}
</style><main><h1>Knowledge Map</h1><div id="settings"></div></main><script src="/runtime.js"></script><script type="module" src="/fixture.mjs"></script>'''
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  route=self.path.split('?',1)[0]
  if route=='/':body=html.encode();mime='text/html'
  elif route=='/runtime.js':body=runtime.encode();mime='text/javascript'
  elif route=='/fixture.mjs':body=(ROOT/'scripts/sync-settings-browser-fixture.mjs').read_bytes();mime='text/javascript'
  elif route.startswith(('/src/','/dist/')):
   p=(ROOT/route.lstrip('/')).resolve()
   if not p.is_relative_to(ROOT) or not p.is_file():self.send_error(404);return
   body=p.read_bytes();mime='text/javascript'
  else:self.send_error(404);return
  self.send_response(200);self.send_header('Content-Type',mime);self.end_headers();self.wfile.write(body)
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/'
playwright=sync_playwright().start();browser=playwright.chromium.launch(channel='chrome',headless=True);page=browser.new_page(viewport={'width':1360,'height':960},device_scale_factor=1);page.goto(url)
session=page.context.new_cdp_session(page)
class Cdp:
 def call(self,method,params=None,timeout=60):
  if method=='Browser.close':browser.close();return {}
  return session.send(method,params or {})
 def js(self,expression):return page.evaluate(expression)
 def wait_js(self,expression,timeout=15):return page.wait_for_function(expression,timeout=timeout*1000)
class CheckProgress(list):
 def append(self,value):
  super().append(value);(OUT/'progress.json').write_text(json.dumps({'checks':self},ensure_ascii=False,indent=2),encoding='utf-8');print(value,flush=True)
c=None;checks=CheckProgress()
try:
 c=Cdp()
 c.wait_js('window.qaReady===true',timeout=15)
 def js(code):return c.js(code)
 def settled():js('qa.settled()')
 def click(selector,settle_after=True):
  info=js(f'''(()=>{{const b=document.querySelector({json.dumps(selector)});if(!b||b.disabled)throw Error("Missing/disabled "+{json.dumps(selector)});b.scrollIntoView({{block:"center"}});const r=b.getBoundingClientRect();return {{x:r.x+r.width/2,y:r.y+r.height/2}};}})()''')
  c.call('Input.dispatchMouseEvent',{'type':'mousePressed','button':'left','clickCount':1,**info});c.call('Input.dispatchMouseEvent',{'type':'mouseReleased','button':'left','clickCount':1,**info})
  if settle_after:settled()
 def action(name):
  print('Action: '+name,flush=True);click(f'[data-sync-action="{name}"]')
 def join(choice):action('join');click(f'[data-join-choice="{choice}"]');click('[data-join-confirm]')
 def count():return js('qa.state().session.accepted.operations.length')
 assert js('qa.writes()')==0;action('find');assert js('qa.writes()')==0
 action('new');click('[data-sync-cancel]');assert js('qa.state().selected') is None;assert js('qa.fileCount()')==0;checks.append('Read-only page/discovery and canceled selection create no shared files or acceptance')
 action('new');click('[data-sync-confirm]');assert js('qa.state().session.initialized') is False
 action('join');click('[data-join-choice="import"]');click('[data-join-cancel]');assert js('qa.fileCount()')==0;checks.append('Join preview/cancel retains original layout without a write')
 join('import');assert count()==1
 idle_files=js('qa.snapshotFiles()');js('qa.reopenSettings()');settled();assert count()==1;assert js('qa.state().session.pending') is None;assert js('qa.state().session.localState?.layoutDraft ?? null') is None;assert js('qa.state().publication.armed') is False;assert js('document.querySelector("[data-sync-status]").dataset.syncStatus')=='saved';assert js('qa.snapshotFiles()')==idle_files;checks.append('Cold settings-only reopen with no work shows saved without arming queue or writing shared history')
 js('qa.save("right")');settled();assert count()==2;assert js('document.querySelector("[data-sync-status]").dataset.syncStatus')=='written';checks.append('Import and automatic publication use real private IndexedDB/session')
 action('disable');js('qa.save("left")');action('enable');assert count()==2;action('restore');click('[data-sync-cancel]');assert count()==2
 action('restore');js('qa.save("right")');click('[data-sync-confirm]');assert count()==2
 js('qa.save("left")');action('restore');click('[data-sync-confirm]');assert count()==3;checks.append('Restored draft cancel/stale confirmation do not publish; fresh review does')
 original=js('qa.snapshotFiles()')
 js('qa.show("B")');action('find');js('document.querySelector("[data-sync-picker]").value="0"');action('choose');click('[data-sync-confirm]');join('import');assert count()==1
 js('qa.show("A")');action('check');assert js('document.querySelector("[data-sync-status]").dataset.syncStatus')=='conflict'
 action('conflict');click('[data-resolution-cancel]');assert count()==3
 action('conflict');other=js('Array.from(document.querySelectorAll("[data-resolution-choice]")).find(b=>b.querySelector("strong").textContent.includes("另一份")).dataset.resolutionChoice');click(f'[data-resolution-choice="{other}"]');click('[data-resolution-confirm]');assert count()==5
 after=js('qa.snapshotFiles()');assert all(after.get(p)==digest for p,digest in original.items());checks.append('Conflict buttons preserve original branches and publish a two-head decision')
 js('qa.show("B")');action('check');assert count()==5;assert js('qa.matches("right")')
 js('qa.show("A")');js('qa.settings("en")');js('qa.external("auto")');action('external');click('[data-sync-cancel]');assert js('qa.effective().then(d=>d.settings.language)')=='en'
 action('external');click('[data-sync-choice="use-external"]');click('[data-sync-confirm]');assert js('qa.effective().then(d=>d.settings.language)')=='auto';assert count()==5;checks.append('External settings cancel/confirm changes no layout acceptance')
 js('qa.reopen()');assert count()==5;assert js('qa.fileCount()')==5;checks.append('Cold host reopen reads same IndexedDB receipt without duplicate publication')
 for width,height in [(1360,960),(1024,768)]:
  c.call('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':False})
  for lang in ['en','zh']:
   js(f'qa.language("{lang}")');settled();assert js('document.documentElement.scrollWidth<=innerWidth')
   js('scrollTo(0,0)');shot=c.call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})['data'];(OUT/f'{width}-{lang}-settings.png').write_bytes(base64.b64decode(shot))
   action('conflict');assert js('document.querySelector(".modal")===null')
   action('disable');js('qa.save("left")');action('enable');action('restore')
   bounds=js('(()=>{const m=document.querySelector(".modal"),r=m.getBoundingClientRect();return {width:r.width,left:r.left,right:r.right,max:innerWidth,scroll:m.scrollWidth,client:m.clientWidth};})()');assert bounds['left']>=0 and bounds['right']<=bounds['max'] and bounds['scroll']<=bounds['client'],bounds
   shot=c.call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})['data'];(OUT/f'{width}-{lang}-review.png').write_bytes(base64.b64decode(shot));click('[data-sync-cancel]')
 checks.append('English/Chinese settings and review fit desktop and 1024x768 without horizontal overflow')
 js('qa.deferPreview()');click('[data-sync-action="restore"]',settle_after=False);c.wait_js('window.qaPreviewWaiting===true');js('qa.show("B")');js('qa.releasePreview()');js('new Promise(r=>setTimeout(r,0))');assert js('document.querySelector(".modal")===null');checks.append('A preview completing after panel close cannot open a stray modal or publish')
 js('qa.show("C")');js('qa.interruptSelection()');action('new');click('[data-sync-confirm]');pending=js('qa.state().selectionPending.vault');installation=js('qa.state().installation');assert js('qa.state().session') is None;assert js('document.querySelector("[data-sync-status]").dataset.syncStatus')=='selection';action('resume-selection');click('[data-sync-confirm]');assert js('qa.state().selected.vault')==pending;assert js('qa.state().installation')==installation;assert js('qa.state().session.initialized') is False;assert js('qa.fileCount()')==5;checks.append('Reviewed resume button completes same interrupted selection without opening an unbound session')
 files=js('qa.snapshotFiles()');js('qa.compatibilityReview()');assert js('document.querySelector("[data-resolution-choice]").disabled');assert js('document.querySelector("[data-resolution-choice]").innerText.includes("当前笔记")');js('document.querySelector("[data-resolution-choice]").click()');assert js('document.querySelector("[data-resolution-confirm]").disabled');click('[data-resolution-cancel]');assert js('qaCompatibilityEvents')==['cancel'];assert js('qa.snapshotFiles()')==files
 js('qa.compatibilityReview()');click('[data-resolution-choice="'+'b'*32+'"]');click('[data-resolution-confirm]');assert js('qaCompatibilityEvents')==['b'*32];assert js('qa.snapshotFiles()')==files;checks.append('Incompatible conflict card stays visible and disabled; cancel is inert and compatible card confirms explicitly')
 js('qa.show("D")');action('new');click('[data-sync-confirm]');join('import');assert count()==1;receipt=js('qa.state().session.accepted');js('qa.collideShared()');action('check');assert js('qa.state().session.attemptConflict') is not None;assert js('document.querySelector("[data-sync-status]").dataset.syncStatus')=='damaged';action('recover-shared');assert js('document.querySelector(".modal")===null');checks.append('Durable same-ID quarantine is visible; unrepaired input cannot open a recovery confirmation')
 js('qa.backupBadFile()');original=js('qa.snapshotFiles()');action('recover-shared');click('[data-sync-cancel]');assert js('qa.state().session.attemptConflict') is not None;assert js('qa.snapshotFiles()')==original;js('qa.reopenSettings()');settled();assert js('document.querySelector("[data-sync-status]").dataset.syncStatus')=='damaged';checks.append('Recovery cancel and host reopen retain quarantine and original/backup bytes')
 action('recover-shared');js('qa.duplicateOriginal()');click('[data-sync-confirm]');assert js('qa.state().session.attemptConflict') is not None;assert js('qa.panelState().lastReason')=='shared-recovery-changed';original=js('qa.snapshotFiles()');action('recover-shared');click('[data-sync-confirm]');assert js('qa.state().session.attemptConflict') is None;assert js('qa.state().session.accepted')==receipt;assert js('qa.snapshotFiles()')==original;js('qa.reopenSettings()');settled();assert js('qa.state().session.attemptConflict') is None;action('check');assert count()==1;assert js('qa.state().publication.armed') is False;checks.append('Changed recovery input needs a new review; fresh confirmation persists without publication or replacing history')
 d_vault=js('qa.state().selected.vault');js('qa.show("E")');action('find');js('document.querySelector("[data-sync-picker]").value=Array.from(document.querySelector("[data-sync-picker]").options).find(o=>o.textContent.startsWith('+json.dumps(d_vault)+')).value');action('choose');click('[data-sync-confirm]');js('qa.collideShared()');action('join');assert js('qa.state().session.attemptConflict') is not None;js('qa.backupBadFile()');action('recover-shared');click('[data-sync-confirm]');assert js('qa.state().session.attemptConflict') is None;assert js('qa.state().session.initialized') is False;assert js('qa.state().session.accepted') is None;action('join');click('[data-join-choice="shared"]');click('[data-join-cancel]');assert js('qa.state().session.initialized') is False;join('shared');assert count()==1;checks.append('First join collision has a reachable recovery review without implicit join; separate adoption remains explicit')
 js('qa.show("F")');action('new');click('[data-sync-confirm]');join('import');js('qa.save("right")');settled();old=js('qa.state().selected.vault');receipt=js('qa.state().session.accepted');original=js('qa.snapshotFiles()');action('backup');assert js('qa.panelState().lastKind')=='exported';backups=js('qa.backups()');assert any(p.endswith('/manifest.json') for p in backups);checks.append('G6 normal backup button exports a complete manifest through host and real IndexedDB reads')
 action('rotate');click('[data-sync-cancel]');assert js('qa.state().selected.vault')==old;assert js('qa.state().session.accepted')==receipt
 js('qa.save("left")');settled();action('backup');new_backups=js('qa.backups()');assert len([p for p in new_backups if p.endswith('/manifest.json')])==len([p for p in backups if p.endswith('/manifest.json')])+1;checks.append('G6 successful export followed by another edit creates a fresh backup ID and current contents')
 original=js('qa.snapshotFiles()');action('rotate');click('[data-sync-confirm]');assert js('qa.state().selected.vault')!=old;assert js('qa.matches("left")');assert count()==1;assert all(js('qa.snapshotFiles()').get(p)==v for p,v in original.items());root=js('qa.state().session.accepted.operations[0].id');js('qa.reopenSettings()');settled();assert js('qa.state().session.accepted.operations[0].id')==root;assert js('qa.matches("left")');checks.append('G6 rotation cancel/confirm and IndexedDB host cold open preserve latest accepted geometry, one root and old shared bytes')
 js('qa.show("G")');action('new');click('[data-sync-confirm]');join('import');action('disable');js('qa.save("right")');settled();js('qa.pausePrivate()');settled();assert js('qa.state().status')=='local-paused';assert js('qa.state().session.localState.layoutDraft') is not None;action('backup');assert js('qa.panelState().lastKind')=='exported';js('document.querySelector("[data-sync-root-choice]").value="draft";document.querySelector("[data-sync-root-choice]").dispatchEvent(new Event("change"))');action('rotate');click('[data-sync-confirm]');assert js('qa.matches("right")');assert count()==1;assert js('qa.state().rotationPending') is None;checks.append('G6 private soft pause retains saved draft and normal buttons explicitly import it into a new root')
 action('backup');js('document.querySelector("[data-sync-root-choice]").value="accepted";document.querySelector("[data-sync-root-choice]").dispatchEvent(new Event("change"))');js('qa.interruptG6("rotation:after-disable")');action('rotate');click('[data-sync-confirm]');assert js('qa.state().rotationPending') is not None;old=js('qa.state().selected.vault');action('abort-rotation');click('[data-sync-confirm]');assert js('qa.state().rotationPending') is None;assert js('qa.state().selected.vault')==old;assert js('qa.state().session.initialized');checks.append('G6 same-process interrupted rotation exposes explicit abort and immediately reopens the old local session')
 js('qa.show("H")');action('new');click('[data-sync-confirm]');join('import');js('qa.interruptG6("after-publication-intent")');js('qa.save("left")');settled();js('qa.reopenSettings()');settled();assert js('qa.state().session.pending.publicationAttempted');assert js('qa.state().session.pending.attempts.length')==0;action('backup');action('abandon');click('[data-sync-cancel]');assert js('qa.state().session.pending') is not None;action('abandon');click('[data-sync-confirm]');assert js('qa.state().session.pending') is None;assert js('qa.state().session.localState.layoutDraft') is not None;checks.append('G6 explicit abandon button requires backup, cancels inertly and preserves saved draft with real IndexedDB journal replay')
 js('qa.show("G7")');action('new');click('[data-sync-confirm]');join('import');assert page.locator('[data-sync-action=rollback]').is_disabled();action('disable');js('qa.save("right")');settled();action('backup');before=js('qa.backups()');accepted=js('qa.state().session.accepted');draft=js('qa.state().session.localState.layoutDraft');action('rollback');click('[data-sync-cancel]');assert js('qa.backups()')==before;assert js('qa.state().session.localState.layoutDraft')==draft
 action('rollback');click('[data-sync-confirm]');after=js('qa.backups()');new_files={p:s for p,s in after.items() if p not in before};manifest=next(json.loads(s) for p,s in new_files.items() if p.endswith('/manifest.json'));assert manifest['scope']=='compatibility-data-not-acceptance';data=next(json.loads(s) for p,s in new_files.items() if p.endswith('/data.json'));assert data['layoutOverrides']==accepted['snapshot'];assert data['unknown']==42;assert data['ui']['keep']=='G7';assert '兼容文件已完整核验' in page.locator('.kg-sync-settings').text_content();checks.append('G7 disabled-only normal export requires a full backup, cancel is inert, and accepted compatibility data keeps current settings/UI/unknown fields')
 before=after;page.locator('[data-sync-rollback-choice]').select_option('draft');action('rollback');click('[data-sync-confirm]');new_files={p:s for p,s in js('qa.backups()').items() if p not in before};data=next(json.loads(s) for p,s in new_files.items() if p.endswith('/data.json'));assert data['layoutOverrides']==draft['value'];assert js('qa.state().session.accepted')==accepted;assert js('qa.state().session.localState.layoutDraft')==draft;checks.append('G7 explicit unpublished-draft compatibility export leaves original acceptance and draft intact in real IndexedDB')
 js('qa.reopenSettings()');settled();assert js('qa.state().session.accepted')==accepted;assert js('qa.state().session.localState.layoutDraft')==draft;assert page.locator('[data-sync-action=rollback]').is_disabled();action('backup');action('rollback');page.set_viewport_size({'width':390,'height':844});assert page.locator('.modal [data-sync-confirm]').is_visible();click('[data-sync-cancel]');page.set_viewport_size({'width':1360,'height':960});checks.append('G7 IndexedDB host cold reopen preserves original local-only work and requires a fresh verified backup before another review')
 # G8 targeted UI failures, preserving prior successful G7 evidence.
 assert page.locator('[data-sync-status]').get_attribute('data-sync-status')=='disabled'
 assert '本次设置页没有' not in page.locator('.kg-sync-settings').text_content()
 assert page.locator('label').filter(has=page.locator('[data-sync-rollback-choice]')).count()==1
 checks.append('G8 disabled saved draft has no unavailable review instruction; compatibility source has visible label')
 for kind,expected in [('manifest','缺少完成清单'),('body','缺少必要正文'),('damage','未能通过完整校验'),('move','缺少完成清单')]:
  action('backup');js('qa.damageBackup('+json.dumps(kind)+')');action('rollback')
  assert expected in page.locator('.kg-sync-settings').text_content()
  assert '导出时已核验：' not in page.locator('.kg-sync-settings').text_content()
  assert page.locator('[data-sync-action=rollback]').is_disabled()
  assert '本次设置页没有' in page.locator('.kg-sync-settings').text_content()
  assert page.locator('.modal').count()==0
  checks.append('G8 '+kind+' invalidates local backup reference with actionable message and no confirmation')
 action('backup');folder=page.locator('[data-sync-backup-folder]');folder.fill('Other G8 Backup');folder.dispatch_event('change');assert page.locator('[data-sync-action=rollback]').is_disabled();assert '本次设置页没有' in page.locator('.kg-sync-settings').text_content()
 action('backup');action('rollback');click('[data-sync-cancel]');js('qa.reopenSettings()');settled();assert page.locator('[data-sync-action=rollback]').is_disabled();assert '本次设置页没有' in page.locator('.kg-sync-settings').text_content();checks.append('G8 folder change/settings reconstruction clears consent; fresh export restores review and cancel stays inert')
 result={'pass':True,'out':str(OUT),'checks':checks,'scope':'Owned headless Chrome real DOM/buttons and IndexedDB; injected App/shared-file/Modal APIs. G6/G7 backup destination is an injected Vault file API, private store is real IndexedDB; threshold/stop injection is not OS disk-full. Not native Obsidian, Nutstore or iPad.'}
 (OUT/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
except Exception as error:
 report={'pass':False,'checks':checks,'error':repr(error)}
 if c:
  try:report['text']=c.js('document.body.textContent');report['panel']=c.js('qa.panelState()');report['state']=c.js('qa.state()');(OUT/'failure.png').write_bytes(base64.b64decode(c.call('Page.captureScreenshot',{'format':'png'})['data']))
  except Exception:pass
 (OUT/'failure.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(str(OUT));raise
finally:
 if c:
  try:c.call('Browser.close',timeout=3)
  except Exception:pass
 playwright.stop();server.shutdown()
