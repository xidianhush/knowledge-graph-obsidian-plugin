from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.connect_over_cdp('http://127.0.0.1:9242');page=next(x for x in b.contexts[0].pages if 'app://obsidian.md' in x.url)
 assert Path(page.evaluate('app.vault.adapter.basePath')).resolve()==(ROOT/'test-vault-layout-fix').resolve()
 errors=[];page.on('pageerror',lambda e:errors.append({'message':str(e),'stack':e.stack}))
 try:
  page.evaluate("async()=>{await app.plugins.disablePlugin('knowledge-graph-smoke')}")
  page.wait_for_timeout(300)
  for i in range(100):
   page.evaluate("""()=>new Promise((resolve,reject)=>{const url=URL.createObjectURL(new Blob(['onmessage=()=>postMessage(1)'],{type:'text/javascript'}));const w=new Worker(url);w.onmessage=()=>{w.terminate();URL.revokeObjectURL(url);resolve()};w.onerror=reject;w.postMessage(0)})""")
  page.wait_for_timeout(300)
  result={'pluginDisabled':True,'minimalWorkerCycles':100,'errors':errors}
  (ROOT/'.local/evidence/desktop-stability-009/worker-probe.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
 finally:
  page.evaluate("async()=>{await app.plugins.enablePlugin('knowledge-graph-smoke');await app.plugins.plugins['knowledge-graph-smoke'].openGraph('vault',true)}")
 b.close()
