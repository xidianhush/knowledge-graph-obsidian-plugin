from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.connect_over_cdp('http://127.0.0.1:9242');page=next(x for x in b.contexts[0].pages if 'app://obsidian.md' in x.url)
 assert Path(page.evaluate('app.vault.adapter.basePath')).resolve()==(ROOT/'test-vault-layout-fix').resolve()
 errors=[];page.on('pageerror',lambda e:errors.append({'message':str(e),'stack':e.stack}))
 page.evaluate("window.hostErrors=[];window.addEventListener('error',e=>hostErrors.push({message:e.message,file:e.filename,line:e.lineno,column:e.colno,error:String(e.error)}))")
 try:
  page.evaluate("async()=>{await app.plugins.disablePlugin('knowledge-graph-smoke')}")
  for i in range(30):
   page.evaluate("async()=>{const leaf=app.workspace.getLeaf('tab');await leaf.openFile(app.vault.getAbstractFileByPath('__kg_rename__/Note0.md'));await leaf.detach();}")
  page.wait_for_timeout(500)
  result={'pluginDisabled':True,'cycles':30,'errors':errors,'events':page.evaluate('hostErrors')}
  (ROOT/'.local/evidence/desktop-stability-009/host-probe.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
  print(json.dumps(result))
 finally:
  page.evaluate("async()=>{await app.plugins.enablePlugin('knowledge-graph-smoke');await app.plugins.plugins['knowledge-graph-smoke'].openGraph('vault',true)}")
 b.close()
