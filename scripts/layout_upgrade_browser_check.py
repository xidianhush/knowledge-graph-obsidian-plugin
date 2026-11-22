"""Owned Chrome, real DOM and IndexedDB; synthetic sources only, not iPad proof."""
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import json,threading,tempfile
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'.local/layout-upgrade';BASE.mkdir(parents=True,exist_ok=True)
OUT=Path(tempfile.mkdtemp(prefix='browser-',dir=BASE))
public=['src/i18n.js','src/i18n.obsidian.js','src/pipeline/defaults.js','src/pipeline/input.js','src/settings.js','src/i18n.receive.js','src/i18n.sync.js']
runtime='const require=()=>({PluginSettingTab:class{},Setting:class{}});\n'+'\n'.join((ROOT/p).read_text(encoding='utf-8') for p in public)+'\nwindow.validateGraphSettings=validateGraphSettings;window.kgT=kgT;window.kgI18nSetPreference=kgI18nSetPreference;kgI18nSetPreference("zh");'
fixture=(ROOT/'scripts/sync-settings-browser-fixture.mjs').read_text(encoding='utf-8')+'''
window.qa.seedHistorical=async(name)=>{sources.set(name,{settings:{language:'zh'},ui:{keep:name},unknown:42,layoutOverrides:left});await show(name);const h=hosts.get(name),s=await h.previewSelection({action:'new'});await h.confirmSelection(s.token);const j=await h.previewJoin();await h.confirmJoin(j.token,'import');await h.saveLayout(right);await h.settled();};
'''
html='''<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}:root{color-scheme:dark;--background-modifier-border:#555;--interactive-accent:#69afff}body{background:#202326;color:#eee;font:16px system-ui}main{max-width:820px;margin:auto;padding:12px}button{font:inherit;padding:8px;color:inherit;background:#353b41}button:disabled{opacity:.4}.modal{position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#282c31;padding:16px;box-shadow:0 0 0 200vmax #0009;max-height:95vh;overflow:auto;z-index:100}svg{max-width:100%}input{max-width:100%}p{line-height:1.5}</style><main><div id="settings"></div></main><script src="/runtime.js"></script><script type="module" src="/fixture.mjs"></script>'''
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  route=self.path.split('?',1)[0]
  if route=='/':body=html.encode();mime='text/html'
  elif route=='/runtime.js':body=runtime.encode();mime='text/javascript'
  elif route=='/fixture.mjs':body=fixture.encode();mime='text/javascript'
  elif route.startswith(('/src/','/dist/')):
   p=(ROOT/route.lstrip('/')).resolve()
   if not p.is_relative_to(ROOT) or not p.is_file():self.send_error(404);return
   body=p.read_bytes();mime='text/javascript'
  else:self.send_error(404);return
  self.send_response(200);self.send_header('Content-Type',mime);self.end_headers();self.wfile.write(body)
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
checks=[]
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True)
 try:
  page=browser.new_page(viewport={'width':1360,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/');page.wait_for_function('window.qaReady===true')
  for name,width in [('Desktop',1360),('Touch',390)]:
   page.set_viewport_size({'width':width,'height':900});page.evaluate('name=>qa.seedHistorical(name)',name)
   baseline=page.evaluate('qa.backups()');operations=page.evaluate('qa.state().session.accepted.operations.length')
   page.locator('[data-sync-action="historical-restore"]').click();page.locator('[data-historical-confirm]').wait_for()
   assert page.locator('[data-historical-select]:checked').count()==0
   assert page.locator('[data-historical-confirm]').is_disabled()
   assert page.locator('.modal svg').count()==3
   page.screenshot(path=str(OUT/(name+'-preview.png')),full_page=True)
   page.locator('[data-historical-cancel]').click();assert page.evaluate('qa.backups()')==baseline
   checks.append(name+': previews current/history/proposal; cancel writes nothing')
   page.locator('[data-sync-action="historical-restore"]').click();page.locator('[data-historical-select]').check();page.locator('[data-historical-confirm]').click()
   page.wait_for_function('!document.querySelector("[data-historical-confirm]")');page.evaluate('qa.settled()')
   assert page.evaluate('qa.state().session.accepted.operations.length')==operations
   assert page.evaluate('qa.state().session.localState.layoutDraft!==null')
   assert page.evaluate('qa.state().session.localState.settingsDraft===null')
   assert len(page.evaluate('qa.backups()'))>len(baseline)
   page.evaluate('qa.reopen()');assert page.evaluate('qa.state().session.localState.layoutDraft!==null')
   checks.append(name+': verified backup, layout-only draft, cold reopen and no auto-publication')
   page.locator('[data-sync-action="restore"]').click();page.locator('[data-sync-confirm]').click();page.evaluate('qa.settled()')
   assert page.evaluate('qa.matches("left")');checks.append(name+': separately reviewed publication restores historical positions')
  assert not errors,errors
  (OUT/'verification.json').write_text(json.dumps({'pass':True,'checks':checks,'scope':'Owned Chrome DOM/IndexedDB; desktop and narrow viewport; not real iPad'},ensure_ascii=False,indent=2),encoding='utf-8')
  print(json.dumps({'pass':True,'out':str(OUT),'checks':checks},ensure_ascii=False))
 finally:browser.close();server.shutdown()
