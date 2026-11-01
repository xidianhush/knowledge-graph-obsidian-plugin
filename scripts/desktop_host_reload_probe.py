from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.connect_over_cdp('http://127.0.0.1:9242');page=next(x for x in b.contexts[0].pages if 'app://obsidian.md' in x.url)
 assert Path(page.evaluate('app.vault.adapter.basePath')).resolve()==(ROOT/'test-vault-layout-fix').resolve()
 states=[]
 errors=[];page.on('pageerror',lambda e:errors.append({'message':str(e),'stack':e.stack}))
 page.evaluate("window.hostErrors=[];window.addEventListener('error',e=>hostErrors.push({message:e.message,file:e.filename,line:e.lineno,column:e.colno,error:String(e.error)}))")
 try:
  page.evaluate("async()=>{await app.plugins.disablePluginAndSave('knowledge-graph-smoke')}")
  page.wait_for_function("async()=>!JSON.parse(await app.vault.adapter.read('.obsidian/community-plugins.json')).includes('knowledge-graph-smoke')")
  for i in range(3):
   page.reload(wait_until='domcontentloaded');page.wait_for_function('app?.workspace?.layoutReady')
   states.append(page.evaluate("()=>({enabled:[...app.plugins.enabledPlugins],present:!!app.plugins.plugins['knowledge-graph-smoke'],loaded:app.plugins.plugins['knowledge-graph-smoke']?._loaded,views:app.workspace.getLeavesOfType('knowledge-graph-vault-view').length})"))
   page.evaluate("()=>{app.setting.open();app.setting.openTabById('about');app.setting.close()}")
   page.wait_for_timeout(400)
  page.wait_for_timeout(500)
  result={'validControl':all(not row['loaded'] for row in states),'states':states,'reloadAboutCycles':3,'errors':errors}
  (ROOT/'.local/evidence/desktop-stability-009/host-reload-probe.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
  print(json.dumps(result))
 finally:
  page.evaluate("async()=>{await app.plugins.enablePluginAndSave('knowledge-graph-smoke');await app.plugins.plugins['knowledge-graph-smoke'].openGraph('vault',true)}")
 b.close()
