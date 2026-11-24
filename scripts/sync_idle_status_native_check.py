"""Owned Windows profile: import once, close graph, cold-open settings first."""
import argparse,json,time,hashlib,os
from pathlib import Path
from playwright.sync_api import sync_playwright
from sync_registry_native_check import prepare,launch,within,dismiss_owned_dialog
def run(prep):
 meta=prepare(prep,'idle-ui2');out=within(meta['out']);checks=[];before=None;browser=None
 def shared():return {str(p.relative_to(Path(meta['paths']['A']))):hashlib.sha256((Path('\\\\?\\'+str(p.resolve())) if os.name=='nt' else p).read_bytes()).hexdigest() for p in (Path(meta['paths']['A'])/'Knowledge Map Sync').rglob('*.json')}
 with sync_playwright() as pw:
  try:
   for cold in [False,True]:
    launch(meta)
    for _ in range(150):
     try:browser=pw.chromium.connect_over_cdp('http://127.0.0.1:'+str(meta['port']));break
     except Exception:time.sleep(.1)
    else:raise AssertionError('Owned CDP unavailable')
    pages={}
    for _ in range(150):
     for ctx in browser.contexts:
      for p in ctx.pages:
       try:
        path=p.evaluate('window.app?.vault?.adapter?.basePath')
        for role,wanted in meta['paths'].items():
         if path and Path(path).resolve()==within(wanted):pages[role]=p
       except Exception:pass
     if len(pages)==2:break
     time.sleep(.1)
    assert len(pages)==2
    for p in pages.values():
     p.on('dialog',dismiss_owned_dialog);p.wait_for_function("!!window.app?.plugins?.getPlugin('knowledge-map-sync-unified')?.syncHost || document.body.innerText.includes('信任仓库作者并启用插件')",timeout=30000)
     trust=p.get_by_role('button',name='信任仓库作者并启用插件')
     if trust.count():trust.click();p.wait_for_timeout(2000)
     p.wait_for_function("!!window.app?.plugins?.getPlugin('knowledge-map-sync-unified')?.syncHost",timeout=30000)
    page=pages['A']
    def state():return page.evaluate("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.state()")
    def settled():page.evaluate("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.settled()")
    if not cold:
     page.evaluate("async()=>{await app.commands.commands['knowledge-map-sync-unified:build-vault-graph'].callback()}");page.wait_for_function("!!app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0]?.view.graph",timeout=30000)
    else:assert page.evaluate("app.workspace.getLeavesOfType('knowledge-graph-vault-view').length")==0
    page.evaluate("app.setting.open();app.setting.openTabById('knowledge-map-sync-unified');app.setting.win.document.documentElement.dataset.idleUi2='true'")
    for _ in range(100):
     targets=[p for ctx in browser.contexts for p in ctx.pages if p.locator('html[data-idle-ui2] .kg-sync-settings').count()]
     if targets:break
     time.sleep(.1)
    assert targets;ui=targets[0]
    if not cold:
     ui.locator('[data-sync-action=new]').click();ui.locator('[data-sync-confirm]').click();settled();ui.locator('[data-sync-action=join]').click();ui.locator('[data-join-choice=import]').click();ui.locator('[data-join-confirm]').click();settled()
     before=state();assert len(before['session']['accepted']['operations'])==1;files=shared();checks.append('Ordinary new connection and reviewed import create one accepted synthetic operation')
     page.evaluate("async()=>{app.setting.close();for(const l of app.workspace.getLeavesOfType('knowledge-graph-vault-view'))await l.detach()}");page.wait_for_timeout(1200)
     try:browser.new_browser_cdp_session().send('Browser.close')
     except Exception as error:
      if 'closed' not in str(error).lower():raise
     browser=None;time.sleep(.8)
    else:
     settled();after=state();assert after['installation']==before['installation'] and after['selected']==before['selected'] and after['session']['accepted']==before['session']['accepted'];checks.append('Cold settings-before-graph keeps original identity, connection and accepted receipt')
     assert not after['session']['pending'] and not (after['session']['localState'] or {}).get('layoutDraft') and not after['publication']['armed'] and not after['publication']['paused'];checks.append('No pending work or publication consent minted by status display')
     assert ui.locator('[data-sync-status]').get_attribute('data-sync-status')=='saved';assert not ui.locator('.kg-sync-settings details').count();checks.append('Actual cold native settings display saved with no obsolete pause reason')
     assert shared()==files;checks.append('Cold open and settings display do not write or replace shared history')
     ui.locator('.kg-sync-settings').screenshot(path=str(out/'idle-settings.png'));result={'pass':True,'checks':checks,'before':before,'after':after,'files':files,'scope':'Actual owned Windows Obsidian profile, ordinary connection/import, full exit and settings before graph. No iPad/Nutstore or user vaults.'};(out/'idle-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'pass':True,'checks':len(checks),'out':str(out)}))
  finally:
   if browser:
    try:browser.new_browser_cdp_session().send('Browser.close')
    except Exception:pass
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('preparation');run(a.parse_args().preparation)
