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
OUT=Path(tempfile.mkdtemp(prefix='current-join-browser-',dir=BASE))
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
  elif route=='/fixture.mjs':body=((ROOT/'scripts/sync-settings-browser-fixture.mjs').read_text(encoding='utf-8')+'window.qa.seedCurrent=(name,bad=false)=>{const value=structuredClone(left);if(bad)value.groups[Object.keys(value.groups)[0]].points[0].x=10;else{const old=\'[\\"note\\",\\"Synthetic/Gone.md\\",\\"\\"]\';value.groups[old]=structuredClone(Object.values(value.groups)[0]);value.groups[old].note=old;}sources.set(name,{settings:{language:\'zh\'},ui:{keep:name},layoutOverrides:value});};window.qa.originalSource=()=>structuredClone(sources.get(current));window.qa.joinEvidence=()=>hosts.get(current).joinEvidence();').encode('utf-8');mime='text/javascript'
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
 js('qa.seedCurrent("Current")');js('qa.show("Current")');settled();action('new');click('[data-sync-confirm]');original=js('qa.originalSource()');before=js('qa.snapshotFiles()')
 action('join');assert page.locator('[data-join-choice="import"]').is_disabled();assert page.locator('[data-join-choice="current"]').is_enabled();assert page.locator('[data-join-confirm]').is_disabled();assert page.locator('[data-join-choice="current"][aria-pressed="true"]').count()==0
 assert '历史记录：2 组' in page.locator('.modal').text_content();assert '当前手动布局：1 组' in page.locator('.modal').text_content();assert '仅保留在备份中：1 组' in page.locator('.modal').text_content();assert '完整备份' in page.locator('.modal').text_content();click('[data-join-archived] summary');assert 'Synthetic/Gone.md' in page.locator('[data-join-archived]').text_content()
 click('[data-join-choice="current"]');click('[data-join-cancel]');assert js('qa.originalSource()')==original;assert js('qa.snapshotFiles()')==before;assert not js('qa.state().session.initialized')
 checks.append('Current-layout card is explicit, discloses counts/archived groups and cancellation retains every original byte')
 action('join');click('[data-join-choice="current"]');click('[data-join-confirm]');assert js('qa.matches("left")');assert count()==1;assert js('qa.joinEvidence().then(e=>e.backup)')==original
 checks.append('Current confirmation imports the displayed canonical positions and retains the full original source')
 action('backup');backups=js('qa.backups()');assert any(json.loads(body)==original for name,body in backups.items() if name.endswith('/join-backup.json'));js('qa.reopen()');settled();assert js('qa.matches("left")');assert count()==1
 checks.append('Recovery export and IndexedDB cold reopen retain every archived record without duplicate publication')
 js('qa.show("Peer")');action('find');js('document.querySelector("[data-sync-picker]").value="0"');action('choose');click('[data-sync-confirm]');join('shared');assert js('qa.matches("left")')
 checks.append('Another logical device adopts the current-layout root through the normal shared-layout review')
 js('qa.seedCurrent("Automatic",true)');js('qa.show("Automatic")');settled();action('new');click('[data-sync-confirm]');js('qa.language("en")');action('join');assert 'Current manual layout: 0 groups' in page.locator('.modal').text_content();assert 'automatic positions' in page.locator('[data-join-choice="current"]').text_content();page.set_viewport_size({'width':1024,'height':768});assert js('document.documentElement.scrollWidth<=innerWidth');assert page.locator('[data-join-confirm]').is_disabled();click('[data-join-choice="current"]');click('[data-join-confirm]');assert count()==1;assert js('Object.keys(qa.state().session.accepted.snapshot.groups).length')==0
 checks.append('An explicit automatic current-layout choice fits the iPad-sized viewport and creates its own reset root')
 action('disable');js('qa.reopenSettings()');settled();assert js('document.querySelector("[data-sync-status]").dataset.syncStatus')=='disabled';assert count()==1
 checks.append('Disabling and reopening after current-layout join keeps accepted state and original backup')
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
