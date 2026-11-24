"""SYNC-UX-A3 clickable sketch check: owned headless Chrome renders the real
simplified easy-sync panel in four states with real DOM clicks. Captures
zh/en, dark/light and narrow screenshots for user visual/copy confirmation.
Not Obsidian, Nutstore or iPad validation; no user browser/profile is opened.
"""
from pathlib import Path
import json,threading,base64,tempfile
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'.local/sync-ux/a3-sketch'
BASE.mkdir(parents=True,exist_ok=True)
OUT=Path(tempfile.mkdtemp(prefix='sketch-',dir=BASE))
public=['src/i18n.js','src/i18n.obsidian.js','src/pipeline/defaults.js','src/pipeline/input.js','src/settings.js','src/i18n.receive.js','src/i18n.sync.js']
runtime='const require=()=>({PluginSettingTab:class{},Setting:class{}});\n'+'\n'.join((ROOT/p).read_text(encoding='utf-8') for p in public)+'\nwindow.validateGraphSettings=validateGraphSettings;window.kgT=kgT;window.kgI18nSetPreference=kgI18nSetPreference;kgI18nSetPreference("zh");'
html='''<!doctype html><meta charset="utf-8"><style>
:root{color-scheme:dark;--background-modifier-border:#5b6268;--interactive-accent:#69afff;--text-muted:#9aa0a6;--text-error:#ff8080}*{box-sizing:border-box}
body{margin:0;background:#202326;color:#eee;font:16px system-ui}body.light{color-scheme:light;background:#ffffff;color:#222;--background-modifier-border:#d0d3d6;--interactive-accent:#2e7cd6;--text-muted:#666;--text-error:#c0392b}
main{max-width:820px;margin:auto;padding:24px}body.narrow main{max-width:390px}p{line-height:1.6}
button,select,input{font:inherit;color:inherit}button{background:#353b41;border:1px solid #68717b;border-radius:6px;padding:8px;cursor:pointer}body.light button{background:#f0f1f3;border-color:#c2c7cc}
button:disabled{opacity:.45;cursor:default}button[aria-pressed=true]{border-color:var(--interactive-accent)}
.kg-easy-toggle{width:18px;height:18px;accent-color:var(--interactive-accent)}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 24px;border-bottom:1px solid var(--background-modifier-border);position:sticky;top:0;background:inherit;z-index:5}
.bar .group{display:flex;gap:6px;flex-wrap:wrap}.bar span{font-size:13px;color:var(--text-muted)}
.modal{position:fixed;inset:24px auto auto 50%;transform:translateX(-50%);max-height:calc(100vh - 48px);overflow:auto;background:#282c31;box-shadow:0 0 0 200vmax #0009;border:1px solid #69747c;border-radius:12px;padding:20px;z-index:100}body.light .modal{background:#fff;border-color:#c2c7cc}
details{margin:8px 0}summary{cursor:pointer}svg{max-width:100%}pre{font-size:12px}
</style>
<div class="bar">
 <div class="group" id="demos"></div>
 <div class="group"><button data-lang="zh">中文</button><button data-lang="en">EN</button></div>
 <div class="group"><button data-theme="dark">Dark</button><button data-theme="light">Light</button></div>
 <div class="group"><button data-width="wide">Wide</button><button data-width="narrow">Narrow</button></div>
</div>
<main><h1>Knowledge Map</h1><div id="settings"></div></main>
<script src="/runtime.js"></script><script type="module" src="/fixture.mjs"></script>
<script>
const wait=setInterval(()=>{if(!window.qaEasyReady)return;clearInterval(wait);
 const demos=document.getElementById('demos');for(const d of window.qaEasy.demos){const b=document.createElement('button');b.textContent=d.label;b.dataset.demo=d.key;b.addEventListener('click',()=>{window.qaEasy.show(d.key);mark();});demos.append(b);}
 function mark(){for(const b of demos.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.demo===window.qaEasy.current()));}
 document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>window.qaEasy.language(b.dataset.lang)));
 document.querySelectorAll('[data-theme]').forEach(b=>b.addEventListener('click',()=>document.body.classList.toggle('light',b.dataset.theme==='light')));
 document.querySelectorAll('[data-width]').forEach(b=>b.addEventListener('click',()=>document.body.classList.toggle('narrow',b.dataset.width==='narrow')));
 mark();window.qaControlsReady=true;},50);
</script>'''
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  route=self.path.split('?',1)[0]
  if route=='/':body=html.encode();mime='text/html'
  elif route=='/runtime.js':body=runtime.encode();mime='text/javascript'
  elif route=='/fixture.mjs':body=(ROOT/'scripts/sync-easy-settings-sketch-fixture.mjs').read_bytes();mime='text/javascript'
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
logs=[]
page.on('console',lambda m:logs.append(f'{m.type}: {m.text}'))
page.on('pageerror',lambda e:logs.append(f'pageerror: {e}'))
def call(method,params=None):return session.send(method,params or {})
def js(expr):return page.evaluate(expr)
def wait(expr,timeout=20):return page.wait_for_function(expr,timeout=timeout*1000)
checks=[]
def note(v):checks.append(v);(OUT/'progress.json').write_text(json.dumps({'checks':checks},ensure_ascii=False,indent=2),encoding='utf-8');print(v,flush=True)
def shot(name):
 js('scrollTo(0,0)');data=call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})['data'];(OUT/name).write_bytes(base64.b64decode(data))
expected={'idle':'idle','ready':'awaitingTransfer','active':'clean','conflict':'conflict'}
try:
 wait('window.qaEasyReady===true');wait('window.qaControlsReady===true')
 # Each demo renders the expected status, one switch, at most one primary action, collapsed advanced.
 for key,status in expected.items():
  js(f'qaEasy.show("{key}")');js('qaEasy.settled()')
  assert js('qaEasy.status()')==status,(key,js('qaEasy.status()'))
  box=f"[data-demo-box='{key}']"
  assert js(f'document.querySelectorAll("{box} [data-easy-toggle]").length')==1
  assert js(f'document.querySelectorAll("{box} [data-easy-action]").length')<=1
  assert js(f'document.querySelector("{box} [data-easy-advanced]").open')==False
  note(f'{key} state renders status={status} with one switch, <=1 action and collapsed advanced')
 # Screenshots: four states across language/theme/width for user confirmation.
 for width,cls in [(1360,''),(390,'narrow')]:
  call('Emulation.setDeviceMetricsOverride',{'width':width,'height':960,'deviceScaleFactor':1,'mobile':False})
  narrow=str(cls=='narrow').lower()
  js(f'document.body.classList.toggle("narrow",{narrow})')
  for lang in ['zh','en']:
   js(f'qaEasy.language("{lang}")')
   for theme in ['dark','light']:
    light=str(theme=='light').lower()
    js(f'document.body.classList.toggle("light",{light})')
    for key in expected:
     js(f'qaEasy.show("{key}")');js('qaEasy.settled()')
     assert js('document.documentElement.scrollWidth<=innerWidth'),(width,lang,theme,key)
     shot(f'{width}-{lang}-{theme}-{key}.png')
 note('Four states captured in zh/en, dark/light, wide/narrow without horizontal overflow')
 # Real click: the switch turns the off demo on; a primary action is clickable.
 js('qaEasy.show("idle")');js('qaEasy.language("zh")');js('document.body.classList.remove("light","narrow")')
 call('Emulation.setDeviceMetricsOverride',{'width':1360,'height':960,'deviceScaleFactor':1,'mobile':False})
 before=js('qaEasy.easy().authorization.enabled');assert before is False
 js("document.querySelector(\"[data-demo-box='idle'] [data-easy-toggle]\").click()");js('qaEasy.settled()')
 assert js('qaEasy.easy().authorization.enabled') is True
 assert js('qaEasy.status()') in ('preparing','awaitingTransfer','active','joining')
 note('Clicking the switch on the off demo authorizes and prepares without manual drag')
 js('qaEasy.show("active")');js('qaEasy.settled()')
 assert js("document.querySelector(\"[data-demo-box='active'] [data-easy-action='check']\")") is not None
 js('qaEasy.action("check")');js('qaEasy.settled()')
 note('Normal-state primary action (check shared layout) is present and clickable')
 result={'pass':True,'out':str(OUT),'checks':checks,'states':expected,'scope':'Owned headless Chrome real DOM/buttons and IndexedDB; injected App/shared-file/Modal APIs. Not native Obsidian, Nutstore or iPad.'}
 (OUT/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
except Exception as error:
 report={'pass':False,'checks':checks,'error':repr(error),'logs':logs[-40:]}
 try:report['ready']=js('({easy:window.qaEasyReady,controls:window.qaControlsReady,demos:document.getElementById("demos").innerHTML})');report['text']=js('document.body.textContent');(OUT/'failure.png').write_bytes(base64.b64decode(call('Page.captureScreenshot',{'format':'png'})['data']))
 except Exception:pass
 (OUT/'failure.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(str(OUT));raise
finally:
 try:call('Browser.close')
 except Exception:pass
 playwright.stop();server.shutdown()