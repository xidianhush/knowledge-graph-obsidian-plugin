"""Real Web Locks in same-origin pages; synthetic App-local storage, no user browser."""
from pathlib import Path
import json,threading,tempfile
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'.local/sync-016/g4/fb2-fix';BASE.mkdir(parents=True,exist_ok=True);OUT=Path(tempfile.mkdtemp(prefix='browser-',dir=BASE))
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  route=self.path.split('?',1)[0]
  if route=='/':body=b'''<!doctype html><title>Registry scope test</title><script type="module">import {openSyncConnections} from '/src/sync/connection-registry.mjs';window.openRegistry=()=>openSyncConnections({app:{loadLocalStorage:k=>JSON.parse(localStorage.getItem(scope+':'+k)??'null'),saveLocalStorage:(k,v)=>localStorage.setItem(scope+':'+k,JSON.stringify(v))},pluginId:'registry-browser',catalog:{scan:async()=>({kind:'catalog',namespaces:[],candidates:[],fingerprint:'0'.repeat(64)})}});window.ready=true;</script>''';mime='text/html'
  elif route.startswith('/src/'):
   p=(ROOT/route.lstrip('/')).resolve()
   if not p.is_relative_to(ROOT) or not p.is_file():self.send_error(404);self.end_headers();return
   body=p.read_bytes();mime='text/javascript'
  else:self.send_error(404);self.end_headers();return
  self.send_response(200);self.send_header('Content-Type',mime);self.end_headers();self.wfile.write(body)
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();checks=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(channel='chrome',headless=True);ctx=browser.new_context();pages=[ctx.new_page() for _ in range(3)]
  for p,scope in zip(pages,['A','B','B']):p.goto('http://127.0.0.1:'+str(server.server_port));p.wait_for_function('window.ready===true');p.evaluate('(s)=>window.scope=s',scope)
  a,b,duplicate=pages
  for p in [a,b]:p.evaluate('async()=>{window.registry=await openRegistry();const r=await registry.preview({action:"new"});await registry.confirm(r.token);}')
  states=[p.evaluate('registry.state()') for p in [a,b]];assert states[0]['installation']!=states[1]['installation'];assert states[0]['selected']['vault']!=states[1]['selected']['vault'];checks.append('Independent vault stores open and select concurrently across real same-origin Web Locks pages')
  held=a.evaluate('(async()=> (await navigator.locks.query()).held)()');assert sum(x['name']=='registry-browser:sync-connections-v1:lock' and x['mode']=='shared' for x in held)==2;checks.append('Actual lock inventory has two shared legacy guards and distinct exclusive installation locks')
  reason=duplicate.evaluate('async()=>{try{await openRegistry();return null;}catch(e){return e.message;}}');assert reason=='connections-registry-busy';checks.append('Second page of same vault is refused without replacing identity')
  assert not a.evaluate('navigator.locks.request("registry-browser:sync-connections-v1:lock",{mode:"exclusive",ifAvailable:true},l=>!!l)');checks.append('Running new registries exclude legacy exclusive client')
  await_expr='async()=>{await registry.close();window.registry=await openRegistry();return registry.state();}'
  assert a.evaluate(await_expr)==states[0];assert b.evaluate('registry.state()')==states[1];checks.append('Closing and reopening one registry preserves both vault states independently')
  for p in [a,b]:p.evaluate('registry.close()')
  a.evaluate('()=>{window.legacyReady=false;window.legacyWork=navigator.locks.request("registry-browser:sync-connections-v1:lock",{mode:"exclusive"},async()=>{window.legacyReady=true;await new Promise(r=>window.releaseLegacy=r);});}');a.wait_for_function('legacyReady');assert b.evaluate('async()=>{try{await openRegistry();return null;}catch(e){return e.message;}}')=='connections-registry-busy';a.evaluate('async()=>{releaseLegacy();await legacyWork;}');checks.append('Running legacy exclusive client blocks new registries until released')
  browser.close()
 result={'pass':True,'checks':checks,'held':held,'scope':'Owned headless Chrome, real same-origin Web Locks/localStorage and production registry/device. Synthetic App namespaces, not Obsidian/iPad/Nutstore.'};(OUT/'verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({'pass':True,'checks':len(checks),'out':str(OUT)}))
finally:server.shutdown()
