"""Owned Windows Obsidian: G6 normal buttons, real IndexedDB and cold process.
Quota filling is deliberate synthetic injection, not OS disk exhaustion.
"""
import argparse,json,time
from pathlib import Path
from playwright.sync_api import sync_playwright
from sync_registry_native_check import prepare,launch,within,dismiss_owned_dialog

def run(preparation,seeded=False):
 meta=prepare(preparation,'g6');out=within(meta['out']);browser=None;checks=[];states={};timings=[];page=None;ui=None
 class Progress(list):
  def append(self,value):
   super().append(value);(out/'progress.json').write_text(json.dumps({'checks':self},ensure_ascii=False,indent=2),encoding='utf-8')
 checks=Progress()
 with sync_playwright() as pw:
  def stop():
   nonlocal browser
   if browser:
    try:browser.new_browser_cdp_session().send('Browser.close')
    except Exception:pass
    browser=None;time.sleep(.8)
  def connect():
   nonlocal browser,page
   launch(meta)
   for _ in range(150):
    try:browser=pw.chromium.connect_over_cdp('http://127.0.0.1:'+str(meta['port']));break
    except Exception:time.sleep(.1)
   else:raise AssertionError('Owned G6 profile unavailable')
   for _ in range(150):
    pages=[]
    for c in browser.contexts:
     for p in c.pages:
      try:
       actual=p.evaluate('window.app?.vault?.adapter?.basePath')
       if actual and Path(actual).resolve()==within(meta['paths']['A']):pages.append(p)
      except Exception:pass
    if pages:page=pages[0];break
    time.sleep(.1)
   else:raise AssertionError('Owned G6 vault unavailable')
   page.on('dialog',dismiss_owned_dialog)
   page.wait_for_function("!!window.app?.plugins?.getPlugin('knowledge-map-sync-unified')?.syncHost || document.body.innerText.includes('信任仓库作者并启用插件')",timeout=30000)
   trust=page.get_by_role('button',name='信任仓库作者并启用插件')
   if trust.count():trust.click();page.wait_for_timeout(2000)
   page.wait_for_function("!!window.app?.plugins?.getPlugin('knowledge-map-sync-unified')?.syncHost",timeout=30000)
  def js(code,arg=None):return page.evaluate(code,arg)
  def state():return js("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.state()")
  def settle():js("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.settled()")
  def graph():
   js("async()=>{app.setting.close();await app.commands.commands['knowledge-map-sync-unified:build-vault-graph'].callback()}")
   page.wait_for_function("!!app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0]?.view.graph",timeout=30000);settle()
   if state()['status']=='ready':page.wait_for_function("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.canReceive()",timeout=15000)
  def settings():
   nonlocal ui
   js("app.setting.open();app.setting.openTabById('knowledge-map-sync-unified');app.setting.win.document.documentElement.dataset.g6='true'")
   for _ in range(100):
    targets=[p for c in browser.contexts for p in c.pages if p.locator('html[data-g6] .kg-sync-settings').count()]
    if targets:ui=targets[0];return
    time.sleep(.05)
   raise AssertionError('G6 settings missing')
  def click(selector):
   ui.locator(selector).click(timeout=10000);settle()
   ui.wait_for_function("!!document.querySelector('.modal [data-sync-confirm],.modal [data-join-confirm]') || document.querySelector('.kg-sync-settings [data-sync-action=\"export\"]')?.disabled===false",timeout=15000)
  def action(name):
   started=time.perf_counter()
   if name=='rotate':page.wait_for_function("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.canReviewRotation()",timeout=15000)
   click('[data-sync-action="'+name+'"]')
   timings.append({'action':name,'ms':round((time.perf_counter()-started)*1000)})
  def shared():return js("async()=>{const a=app.vault.adapter,out={};for(const v of (await a.list('Knowledge Map Sync/attempts-v1')).folders){const dir=v+'/ops';if(!await a.exists(dir))continue;for(const p of (await a.list(dir)).files)out[p]=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await a.readBinary(p))),x=>x.toString(16).padStart(2,'0')).join('')}return out}")
  def drag(dx):
   graph()
   if page.locator('#legend-toggle').get_attribute('aria-expanded')=='true':page.locator('#legend-toggle').click()
   js("()=>{const r=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view.graph.renderer,n=r.NODES.find(n=>n.path==='Synthetic/A.md'&&n.title==='Second');r.focusOn(n.id,1.25,0)}")
   page.locator('#layout-mode').click();page.wait_for_timeout(150)
   p=js("()=>{const v=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view,r=v.graph.renderer,n=r.NODES.find(n=>n.path==='Synthetic/A.md'&&n.title==='Second'),c=v.host.shadowRoot.getElementById('cv').getBoundingClientRect();return {x:c.left+n.x*r.camera.zoom+r.camera.panX,y:c.top+n.y*r.camera.zoom+r.camera.panY}}")
   page.mouse.move(p['x'],p['y']);page.mouse.down();page.mouse.move(p['x']+dx,p['y']+8,steps=12);page.mouse.up();page.locator('#layout-mode').click();settle()
  try:
   connect();graph();settings()
   if seeded:
    seed=json.loads((within(preparation)/'preparation.json').read_text(encoding='utf-8'))['synthetic']['vault'];action('find');ui.locator('[data-sync-picker]').select_option(label=seed);action('choose');click('[data-sync-confirm]');choice='shared'
   else:action('new');click('[data-sync-confirm]');choice='import'
   action('join');click('[data-join-choice='+choice+']');click('[data-join-confirm]');assert len(state()['session']['accepted']['operations'])==(1024 if seeded else 1)
   if seeded:
    receipt=state()['session']['accepted'];started=time.perf_counter();stop();connect();graph();settings();assert state()['session']['accepted']==receipt;timings.append({'action':'full-history-process-cold-open','ms':round((time.perf_counter()-started)*1000)});checks.append('Full 1024-operation private ledger survives complete Obsidian process cold open before rotation')
   drag(23);settings();accepted=state()['session']['accepted'];assert len(accepted['operations'])>=2;old=state()['selected']['vault'];installation=state()['installation'];original=shared();expected=state()['session']['localState']['layoutDraft']['value']['groups'] if seeded else accepted['snapshot']['groups'];checks.append('Actual 1024-distinct-operation adoption and graph edit retains capacity-held draft' if seeded else 'Actual graph drag publishes a distinct operation before G6 backup')
   action('backup');assert '恢复备份已完整核验' in ui.locator('.kg-sync-settings').text_content()
   if seeded:ui.locator('[data-sync-root-choice]').select_option('draft')
   action('rotate');click('[data-sync-cancel]');assert state()['selected']['vault']==old;assert state()['session']['accepted']==accepted;checks.append('Actual Vault backup and cancelled rotation preserve the original acceptance')
   action('rotate');click('[data-sync-confirm]');assert state()['rotationPending'] is None;assert state()['selected']['vault']!=old;assert state()['session']['accepted']['snapshot']['groups']==expected;after=shared();assert all(after.get(k)==v for k,v in original.items());target=state()['selected']['vault'];root=state()['session']['accepted']['operations'][0]['id'];states['rotated']=state();checks.append('Confirmed normal rotation uses selected current geometry and keeps old shared bytes')
   stop();connect();graph();settings();assert state()['selected']['vault']==target;assert state()['installation']==installation;assert state()['session']['accepted']['operations'][0]['id']==root;assert state()['session']['accepted']['snapshot']['groups']==expected;checks.append('Full owned Obsidian process cold open preserves installation, target and original new root ID')
   action('disable');drag(19);settings();draft=state()['session']['localState']['layoutDraft'];assert draft
   js("async()=>{const s=app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.state(),prefix=s.installation+'/'+s.selected.vault+'/';const db=await new Promise((ok,no)=>{const r=indexedDB.open('knowledge-map-sync-v2-private',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});await new Promise((ok,no)=>{const t=db.transaction('files','readwrite'),store=t.objectStore('files');for(let n=0;n<4096;n++)store.add({key:prefix+'g6-synthetic-fill/'+n,text:'x',size:1});t.oncomplete=ok;t.onerror=()=>no(t.error)});db.close()}")
   stop();connect();graph();settings();assert state()['status']=='local-paused';assert state()['session']['localState']['layoutDraft']==draft;action('backup');assert '文件数量' in ui.locator('.kg-sync-settings').text_content();ui.locator('[data-sync-root-choice]').select_option('draft');action('rotate');click('[data-sync-confirm]');assert state()['session']['accepted']['snapshot']['groups']==draft['value']['groups'];assert state()['rotationPending'] is None;assert state()['status']=='ready';checks.append('Real IndexedDB synthetic file soft limit permits backup and explicit draft-root rotation without deleting history')
   final=state();stop();connect();graph();settings();assert state()['session']['accepted']==final['session']['accepted'];assert state()['selected']==final['selected'];checks.append('Final full process cold open keeps the selected draft root and connection')
   ui.locator('.kg-sync-settings').screenshot(path=str(out/'g6-final.png'))
   result={'pass':True,'checks':checks,'timings':timings,'states':states,'final':state(),'originalShared':original,'shared':shared(),'scope':'Actual owned Windows Obsidian normal graph/drag/buttons/Vault/IndexedDB/process restart. Deliberate synthetic IndexedDB file-count filling, not OS disk-full, Nutstore or iPad. Timings include driver/UI overhead.'};(out/'g6-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'pass':True,'checks':len(checks),'out':str(out)}))
  except Exception:
   if browser:
    try:(out/'failure.json').write_text(json.dumps({'checks':checks,'state':state(),'telemetry':js("({hidden:document.hidden,epoch:app.plugins.getPlugin('knowledge-map-sync-unified').layoutEpoch,canReceive:app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.canReceive(),graph:!!app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0]?.view.graph})"),'text':ui.locator('.kg-sync-settings').text_content() if ui else None},ensure_ascii=False,indent=2),encoding='utf-8')
    except Exception:pass
   raise
  finally:stop()
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('preparation');a.add_argument('--seeded',action='store_true');args=a.parse_args();run(args.preparation,args.seeded)
