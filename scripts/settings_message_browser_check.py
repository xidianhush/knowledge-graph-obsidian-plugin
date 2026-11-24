"""Production settings/CSS with real DOM; synthetic Obsidian Setting adapter.
Owned Chrome only. Viewport/touch emulation is not native iPad evidence.
"""
import json,tempfile,threading
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'.local/sync-016/g4/ui1-fix';BASE.mkdir(parents=True,exist_ok=True);OUT=Path(tempfile.mkdtemp(prefix='browser-',dir=BASE))
adapter=r'''
HTMLElement.prototype.empty=function(){this.replaceChildren()};HTMLElement.prototype.addClass=function(c){this.classList.add(c)};
HTMLElement.prototype.createEl=function(tag,opts={}){const e=document.createElement(tag);if(opts.text)e.textContent=opts.text;if(opts.cls)e.className=opts.cls;for(const [k,v] of Object.entries(opts.attr||{}))e.setAttribute(k,v);this.append(e);return e};HTMLElement.prototype.createDiv=function(opts){return this.createEl('div',opts)};
class Tab{constructor(app,plugin){this.app=app;this.plugin=plugin;this.containerEl=document.querySelector('#settings')}}
class FixtureSetting{constructor(el){this.el=el.createDiv({cls:'setting-item'});this.info=this.el.createDiv();this.control=this.el.createDiv();}setName(t){this.info.createEl('b',{text:t});return this}setDesc(t){this.info.createEl('p',{text:t});return this}
 input(tag,fn){const e=this.control.createEl(tag),api={inputEl:e,setValue(v){if(e.type==='checkbox')e.checked=v;else e.value=v;return this},onChange(cb){e.addEventListener('input',()=>cb(e.type==='checkbox'?e.checked:e.value));return this},addOption(v,t){e.append(new Option(t,v));return this}};fn(api);return this}
 addDropdown(fn){return this.input('select',fn)}addTextArea(fn){return this.input('textarea',fn)}addText(fn){return this.input('input',fn)}addToggle(fn){return this.input('input',a=>{a.inputEl.type='checkbox';fn(a)})}
 addButton(fn){const e=this.control.createEl('button');fn({setButtonText(t){e.textContent=t;return this},setCta(){return this},setDisabled(v){e.disabled=v;return this},onClick(cb){e.addEventListener('click',cb);return this}});return this}}
const require=()=>({PluginSettingTab:Tab,Setting:FixtureSetting});
'''
files=['src/i18n.js','src/i18n.obsidian.js','src/pipeline/defaults.js','src/pipeline/input.js','src/settings.js']
runtime=adapter+'\n'+'\n'.join((ROOT/p).read_text(encoding='utf-8') for p in files)+r'''
const saved={settings:{language:'zh'},pipeline:{config:{include:['Synthetic/**']}},ui:{legend:'true'}};
window.qa={show(lang){kgI18nSetPreference(lang);const plugin={savedData:structuredClone(saved),saveGraphSettings:async function(data){this.savedData=structuredClone(data)}};this.tab=new KnowledgeGraphSettingsTab({vault:{getMarkdownFiles:()=>[{path:'Synthetic/A.md'}]}},plugin);this.tab.display()},message(){return document.querySelector('.kg-settings-message')}};qa.show('zh');window.ready=true;
'''
html='''<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><style>
*{box-sizing:border-box}body{margin:0;background:var(--background-primary);color:var(--text-normal);font:16px sans-serif}body.dark{--background-primary:#000;--text-normal:#ddd;--text-error:#f66}body.light{--background-primary:#fff;--text-normal:#222;--text-error:#c00}#scroll{height:70vh;overflow:auto;margin:16px;padding:16px;background:var(--background-primary)}.setting-item{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:20px 0;border-bottom:1px solid #666}.setting-item>div{min-width:0}.setting-item p{line-height:1.6;max-width:40em}button,input,textarea,select{font:inherit;max-width:100%}button{margin:4px}.setting-item>div:last-child{max-width:50%}#after{height:400px}textarea{max-width:100%}
</style><body class="dark"><div id="scroll"><div id="settings"></div><div id="after">Synthetic end of settings</div></div><script src="/runtime.js"></script></body>'''
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  if self.path=='/':body=html.encode();mime='text/html'
  elif self.path=='/runtime.js':body=runtime.encode();mime='text/javascript'
  elif self.path=='/styles.css':body=(ROOT/'styles.css').read_bytes();mime='text/css'
  else:self.send_error(404);self.end_headers();return
  self.send_response(200);self.send_header('Content-Type',mime);self.end_headers();self.wfile.write(body)
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();checks=[];failures=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(channel='chrome',headless=True)
 try:
  for width,height,touch in [(1360,960,False),(1194,834,True),(390,844,True)]:
   context=browser.new_context(viewport={'width':width,'height':height},has_touch=touch);page=context.new_page();page.set_default_timeout(2000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:'+str(server.server_port)+'/')
   page.wait_for_function('window.ready===true || window.qa !== undefined',timeout=3000)
   assert not errors,errors
   for theme in ['dark','light']:
    for lang in ['zh','en']:
     tag=f'{width}x{height}/{theme}/{lang}'
     try:
      page.evaluate('([theme,lang])=>{document.body.className=theme;qa.show(lang);document.querySelector("#scroll").scrollTop=99999}',[theme,lang])
      empty=page.evaluate('({text:qa.message().textContent,height:qa.message().getBoundingClientRect().height,role:qa.message().getAttribute("role"),live:qa.message().getAttribute("aria-live")})')
      assert empty=={'text':'','height':0,'role':'status','live':'polite'},empty
      check='检查范围' if lang=='zh' else 'Check scope';revert='撤销未保存修改' if lang=='zh' else 'Discard changes'
      page.get_by_role('button',name=check,exact=True).click();page.wait_for_function('qa.message().textContent.length>0')
      assert page.evaluate('getComputedStyle(qa.message()).position==="sticky" && qa.message().getBoundingClientRect().height>16')
      page.get_by_role('button',name=revert,exact=True).click();assert page.evaluate('qa.message().getBoundingClientRect().height')==0
      number=page.locator('input[type=number]').first;number.fill('99');page.get_by_role('button',name=check,exact=True).click();assert page.locator('.kg-settings-message').get_attribute('data-error')=='true'
      number.fill('350');page.get_by_role('button',name=check,exact=True).click();assert page.locator('.kg-settings-message').get_attribute('data-error') is None
      page.evaluate('qa.message().textContent="Long message ".repeat(100)');assert page.evaluate('qa.message().getBoundingClientRect().height>16 && qa.message().scrollWidth<=qa.message().clientWidth')
      # Injected 1200-character text checks wrapping/clear geometry only. Existing
      # oversized sticky-message interaction is outside this empty-strip fix.
      page.evaluate('qa.message().textContent="";document.querySelector("#scroll").scrollTop=99999');assert page.evaluate('qa.message().getBoundingClientRect().height')==0
      checks.append(tag+' empty/scrolled/normal/error/clear/long live-message transitions')
     except Exception as error:failures.append({'case':tag,'error':str(error)})
   page.screenshot(path=str(OUT/(str(width)+'-final.png')));context.close()
 finally:browser.close();server.shutdown()
result={'pass':not failures,'checks':checks,'failures':failures,'scope':'Production settings.js/CSS, real Chrome DOM with synthetic Obsidian Setting adapter. Real clicks verify normal/error/revert; injected long text verifies wrapping and programmatic clearing only, not oversized sticky-message usability. Touch viewports are not native iPad.'};(OUT/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'pass':result['pass'],'checks':len(checks),'failures':failures,'out':str(OUT)}));raise SystemExit(0 if result['pass'] else 1)
