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
OUT=Path(tempfile.mkdtemp(prefix='join-identity-browser-',dir=BASE))
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
  elif route=='/fixture.mjs':body=((ROOT/'scripts/sync-settings-browser-fixture.mjs').read_text(encoding='utf-8')+"window.qa.seedJoinIdentity=(name,bad=false)=>{const value=structuredClone(left);value.structures={};if(bad)value.revision=-1;sources.set(name,{settings:{language:'zh'},ui:{keep:name},layoutOverrides:value});};").encode('utf-8');mime='text/javascript'
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
 js('qa.seedJoinIdentity("JoinMissing")');js('qa.show("JoinMissing")');settled();action('new');click('[data-sync-confirm]');before=js('qa.snapshotFiles()')
 action('join');assert page.locator('[data-join-choice="import"]').is_enabled();assert page.locator('[data-join-confirm]').is_disabled();click('[data-join-cancel]');assert js('qa.snapshotFiles()')==before
 checks.append('Missing metadata opens the real import review; cancellation publishes nothing')
 action('join');click('[data-join-choice="import"]');click('[data-join-confirm]');assert js('qa.matches("left")');assert count()==1
 action('backup');backups=js('qa.backups()');originals=[json.loads(body) for name,body in backups.items() if name.endswith('/join-backup.json')];assert any(row and row.get('layoutOverrides',{}).get('structures')=={} for row in originals)
 checks.append('Explicit import keeps coordinates and the original unrepaired data in the recovery backup')
 js('qa.seedJoinIdentity("JoinBad",true)');js('qa.show("JoinBad")');settled();action('new');click('[data-sync-confirm]');before=js('qa.snapshotFiles()');action('join');assert page.locator('[data-join-confirm]').count()==0
 assert js('document.querySelector("[data-sync-status]").dataset.syncStatus')=='joinBlocked';assert '加入已暂停' in page.locator('.kg-sync-settings').text_content();assert 'layout-' in page.locator('details').text_content();assert js('qa.snapshotFiles()')==before
 checks.append('Invalid source format displays an actionable Chinese blocked status and retains every shared byte')
 js('qa.language("en")');action('join');assert 'Joining is paused' in page.locator('.kg-sync-settings').text_content();page.set_viewport_size({'width':1024,'height':768});assert js('document.documentElement.scrollWidth<=innerWidth')
 action('disable');assert js('document.querySelector("[data-sync-status]").dataset.syncStatus')=='disabled';js('qa.reopenSettings()');settled();assert js('document.querySelector("[data-sync-status]").dataset.syncStatus')=='disabled'
 checks.append('English blocked status fits iPad-sized viewport; disabling and reopening retain local work')
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
