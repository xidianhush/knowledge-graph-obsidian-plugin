"""Actual archived 0.0.15 and candidate in one fresh owned synthetic vault/profile.
No user profile or accepted evidence is opened. Only this run's files are replaced.
"""
import argparse,json,time,hashlib,shutil,os
from pathlib import Path
from playwright.sync_api import sync_playwright
from sync_registry_native_check import prepare,launch,within,dismiss_owned_dialog

ID='knowledge-graph-smoke'
def long_path(p):return Path('\\\\?\\'+str(Path(p).resolve())) if os.name=='nt' else Path(p)
def read_bytes(p):return long_path(p).read_bytes()
def read_json(p):return json.loads(long_path(p).read_text(encoding='utf-8'))
def copy_file(a,b):return shutil.copyfile(long_path(a),long_path(b))
def run(preparation):
 meta=prepare(preparation,'g7');out=within(meta['out']);vault=within(meta['paths']['A']);plugin=vault/'.obsidian/plugins'/ID
 profile=within(meta['profile']);settings=json.loads((profile/'obsidian.json').read_text(encoding='utf-8'))
 for v in settings['vaults'].values():v['open']=Path(v['path']).resolve()==vault
 (profile/'obsidian.json').write_text(json.dumps(settings),encoding='utf-8')
 legacy=Path(__file__).resolve().parents[1]/'.local/g7-legacy-0.0.15'
 expected='8801c3a3e5c2d96fcd6d230e8b703eac8472ac815e677e915c81c23249411391'
 assert hashlib.sha256((legacy/'main.js').read_bytes()).hexdigest()==expected
 for name,digest in {'manifest.json':'67f707c580bb80580bffd0c005e719292d887c346883f3c708b440bbd4ae0b43','styles.css':'50e33695e56f27070669d219d9ecf9d64f76e2359f1de1fa38fa42e30a4adb56'}.items():assert hashlib.sha256(read_bytes(legacy/name)).hexdigest()==digest
 frozen=out/'candidate-files';frozen.mkdir()
 for n in ['main.js','manifest.json','styles.css']:shutil.copyfile(plugin/n,frozen/n)
 browser=None;page=None;ui=None;checks=[];states={};timings=[]
 def record(s):
  checks.append(s);(out/'progress.json').write_text(json.dumps({'checks':checks},ensure_ascii=False,indent=2),encoding='utf-8');print(s,flush=True)
 with sync_playwright() as pw:
  def stop():
   nonlocal browser
   if browser:
    try:browser.new_browser_cdp_session().send('Browser.close')
    except Exception:pass
    browser=None;time.sleep(1)
  def connect():
   nonlocal browser,page
   launch(meta)
   for _ in range(200):
    try:browser=pw.chromium.connect_over_cdp('http://127.0.0.1:'+str(meta['port']));break
    except Exception:time.sleep(.1)
   else:raise AssertionError('Owned G7 profile unavailable')
   for _ in range(200):
    matches=[]
    for ctx in browser.contexts:
     for p in ctx.pages:
      try:
       actual=p.evaluate('window.app?.vault?.adapter?.basePath')
       if actual and Path(actual).resolve()==vault:matches.append(p)
      except Exception:pass
    if matches:page=matches[0];break
    time.sleep(.1)
   else:raise AssertionError('Owned G7 vault window unavailable')
   page.on('dialog',dismiss_owned_dialog)
   page.wait_for_function("!!window.app?.plugins?.getPlugin('"+ID+"')?.layoutStore || document.body.innerText.includes('信任仓库作者并启用插件')",timeout=45000)
   trust=page.get_by_role('button',name='信任仓库作者并启用插件')
   if trust.count():trust.click();page.wait_for_timeout(2000)
   page.wait_for_function("!!window.app?.plugins?.getPlugin('"+ID+"')?.layoutStore",timeout=45000)
  def js(code):return page.evaluate(code)
  def state():return js("app.plugins.getPlugin('"+ID+"').syncHost.state()")
  def settle():js("async()=>{const p=app.plugins.getPlugin('"+ID+"');await p.syncHost?.settled();await p.layoutStore.settled();await p.settingsSaveQueue;}")
  def graph():
   js("async()=>{app.setting.close();await app.commands.executeCommandById('"+ID+":build-vault-graph')}")
   page.wait_for_function("(()=>{const v=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0]?.view;return !!v?.graph?.renderer&&v.buildState?.phase==='ready'&&!v.contentEl.dataset.pipelineUpdating})()",timeout=45000);settle()
  def settings_panel():
   nonlocal ui
   js("app.setting.open();app.setting.openTabById('"+ID+"');app.setting.win.document.documentElement.dataset.g7='true'")
   for _ in range(100):
    matches=[p for c in browser.contexts for p in c.pages if p.locator('html[data-g7] .kg-sync-settings').count()]
    if matches:ui=matches[0];return
    time.sleep(.05)
   raise AssertionError('G7 sync settings absent')
  def click(selector):
   ui.locator(selector).click(timeout=15000);settle()
   ui.wait_for_function("!!document.querySelector('.modal [data-sync-confirm],.modal [data-join-confirm]') || document.querySelector('.kg-sync-settings [data-sync-action=export]')?.disabled===false",timeout=20000)
  def action(name):
   if name=='rollback':page.wait_for_function("app.plugins.getPlugin('"+ID+"').syncHost.canReviewRotation()",timeout=20000)
   click('[data-sync-action='+name+']');print('Action '+name+': '+json.dumps(js("app.plugins.getPlugin('"+ID+"').syncSettingsPanel.state()"),ensure_ascii=False),flush=True)
   if name=='rollback' and not ui.locator('[data-sync-confirm]').count():raise AssertionError('Rollback review not opened; '+ui.locator('.kg-sync-settings').text_content())
  def drag(dx,title='Second',note='A'):
   graph()
   if page.locator('#legend-toggle').get_attribute('aria-expanded')=='true':page.locator('#legend-toggle').click()
   js("()=>{const r=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view.graph.renderer,n=r.NODES.find(n=>n.path==='Synthetic/"+note+".md'&&n.title==='"+title+"');r.focusOn(n.id,1.25,0)}")
   page.locator('#layout-mode').click();page.wait_for_timeout(150)
   p=js("()=>{const v=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view,r=v.graph.renderer,n=r.NODES.find(n=>n.path==='Synthetic/"+note+".md'&&n.title==='"+title+"'),c=v.host.shadowRoot.getElementById('cv').getBoundingClientRect();return {x:c.left+n.x*r.camera.zoom+r.camera.panX,y:c.top+n.y*r.camera.zoom+r.camera.panY}}")
   page.mouse.move(p['x'],p['y']);page.mouse.down();page.mouse.move(p['x']+dx,p['y']+7,steps=12);page.mouse.up();page.locator('#layout-mode').click();settle()
  def shared():return {str(p.relative_to(vault)):hashlib.sha256(read_bytes(p)).hexdigest() for p in (vault/'Knowledge Map Sync').rglob('*.json')}
  def ledger_hash():return js("async()=>{const db=await new Promise((ok,no)=>{const r=indexedDB.open('knowledge-map-sync-v2-private',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});const rows=await new Promise((ok,no)=>{const t=db.transaction('files','readonly'),r=t.objectStore('files').getAll();r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});db.close();return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(rows)))),x=>x.toString(16).padStart(2,'0')).join('')}")
  try:
   connect();graph();settings_panel();action('new');click('[data-sync-confirm]');action('join');click('[data-join-choice=import]');click('[data-join-confirm]')
   drag(22);settings_panel();accepted=state()['session']['accepted'];assert len(accepted['operations'])==2;action('disable');drag(-25);settings_panel();draft=state()['session']['localState']['layoutDraft'];assert draft
   before=state();original_shared=shared();original_data=(plugin/'data.json').read_bytes();action('backup');backup_files={str(p) for p in (vault/'Knowledge Map Backups').rglob('*.json')}
   action('rollback');click('[data-sync-cancel]');assert {str(p) for p in (vault/'Knowledge Map Backups').rglob('*.json')}==backup_files
   exports={}
   for choice in ['accepted','draft']:
    ui.locator('[data-sync-rollback-choice]').select_option(choice);action('rollback');click('[data-sync-confirm]');assert '兼容文件已完整核验' in ui.locator('.kg-sync-settings').text_content()
    candidates=[p for p in (vault/'Knowledge Map Backups').glob('*/manifest.json') if str(p) not in backup_files and read_json(p).get('scope')=='compatibility-data-not-acceptance'];assert len(candidates)==1
    m=candidates[0];data=m.parent/'data.json';body=read_bytes(data);manifest=read_json(m);assert hashlib.sha256(body).hexdigest()==manifest['hash'];exports[choice]=data
    expected_layout=accepted['snapshot'] if choice=='accepted' else draft['value'];assert json.loads(body)['layoutOverrides']==expected_layout;backup_files|={str(p) for p in m.parent.glob('*.json')}
   assert (plugin/'data.json').read_bytes()==original_data;assert state()['session']['accepted']==accepted;assert state()['session']['localState']['layoutDraft']==draft
   record('Actual candidate canvas edits, disabled full backup and cancel/confirm accepted/draft compatibility exports preserve stale source and private work')
   states['candidateBefore']=before;ui.locator('.kg-sync-settings').screenshot(path=str(out/'candidate-export.png'));stop()
   for choice in ['accepted','draft']:
    for n in ['main.js','manifest.json','styles.css']:copy_file(legacy/n,plugin/n)
    copy_file(exports[choice],plugin/'data.json');connect();graph();loaded=js("app.plugins.getPlugin('"+ID+"').layoutStore.state()")
    assert js("!!app.plugins.getPlugin('"+ID+"').syncHost") is False;expected_layout=accepted['snapshot'] if choice=='accepted' else draft['value'];assert loaded['groups']==expected_layout['groups']
    assert js("app.plugins.getPlugin('"+ID+"').savedData.g7Unknown")=={'preserve':'Synthetic G7 unknown field'}
    assert js("app.plugins.getPlugin('"+ID+"').savedData.ui.g7Keep")=='local';old_ledger=ledger_hash();assert shared()==original_shared
    record('Actual formal 0.0.15 loads '+choice+' selected geometry, local UI and unknown field using unchanged published assets')
    drag(23,'Fourth','B');old_saved=json.loads((plugin/'data.json').read_text(encoding='utf-8'));assert old_saved['layoutOverrides']['groups']!=expected_layout['groups'];stop();connect();graph();assert js("app.plugins.getPlugin('"+ID+"').layoutStore.state().groups")==old_saved['layoutOverrides']['groups'];assert ledger_hash()==old_ledger;assert shared()==original_shared
    page.screenshot(path=str(out/('legacy-'+choice+'-reopened.png')));record('Formal 0.0.15 real drag and full owned process restart retain '+choice+' edit without modifying shared history or candidate IndexedDB')
    stop();copy_file(plugin/'data.json',out/('old-edited-'+choice+'.json'))
    for n in ['main.js','manifest.json','styles.css']:copy_file(frozen/n,plugin/n)
    connect();graph();s=state();assert s['installation']==before['installation'];assert s['selected']==before['selected'];assert s['status']=='local-ready';assert s['session']['accepted']==accepted;assert s['session']['localState']['layoutDraft']==draft;assert s['session']['pending'] is None;assert not s['publication']['armed'];assert shared()==original_shared;assert json.loads((plugin/'data.json').read_text(encoding='utf-8'))==old_saved
    states['returned-'+choice]=s;page.screenshot(path=str(out/('candidate-return-'+choice+'.png')));record('Candidate returns after '+choice+' rollback with original identity/connection/accepted/draft and no automatic publication of independent old-version edits');stop()
   result={'pass':True,'checks':checks,'states':states,'out':str(out),'meta':meta,'exports':{k:str(v) for k,v in exports.items()},'originalShared':original_shared,'scope':'Actual owned Windows Obsidian 1.15.1 process/canvas/Vault/IndexedDB and exact formal0.0.15 assets. Synthetic vault only; no iPad, Nutstore, OS disk-full or user acceptance.'}
   (out/'g7-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'pass':True,'checks':len(checks),'out':str(out)}),flush=True)
  except Exception:
   details={'checks':checks,'states':states}
   if page:
    try:
     details['runtime']=js("({text:document.body.innerText.slice(0,2400),loaded:Object.keys(app.plugins.plugins),state:app.plugins.getPlugin('"+ID+"')?.syncHost?.state(),panel:app.plugins.getPlugin('"+ID+"')?.syncSettingsPanel?.state()})");page.screenshot(path=str(out/'failure.png'))
     if ui:details['settings']=ui.locator('.kg-sync-settings').text_content();ui.screenshot(path=str(out/'failure-settings.png'))
    except Exception:pass
   (out/'failure.json').write_text(json.dumps(details,ensure_ascii=False,indent=2),encoding='utf-8')
   raise
  finally:stop()
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('preparation');args=a.parse_args();run(args.preparation)
