"""Two vault windows in ONE owned Obsidian profile. Synthetic data only."""
from pathlib import Path
import json,os,shutil,tempfile,socket,subprocess,time,argparse
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'.local/sync-016/unified/u5'
def dismiss_owned_dialog(dialog):
 try:dialog.dismiss()
 except Exception:pass # An owned window may already be gone during Browser.close.
def within(p):
 p=Path(p).resolve();assert p.is_relative_to(BASE.resolve()) and p!=BASE.resolve();return p
def prepare(prep,label):
 meta=json.loads((within(prep)/'preparation.json').read_text(encoding='utf-8'));out=Path(tempfile.mkdtemp(prefix='registry-'+label+'-',dir=BASE));profile=out/'profile';profile.mkdir();paths={}
 for role in ['A','B']:
  dest=within(out/('Knowledge Map FB2 '+role));src=within(meta['paths']['PC' if role=='A' else 'iPad'])
  extended=lambda p:'\\\\?\\'+str(p) if os.name=='nt' else p
  shutil.copytree(extended(src),extended(dest));paths[role]=str(dest)
 asars=list((Path(os.environ['APPDATA'])/'obsidian').glob('obsidian-*.asar'));asar=max(asars,key=lambda p:tuple(map(int,p.stem.removeprefix('obsidian-').split('.'))));shutil.copyfile(asar,profile/asar.name)
 (profile/'obsidian.json').write_text(json.dumps({'vaults':{os.urandom(8).hex():{'path':p,'open':True,'ts':int(time.time()*1000)} for p in paths.values()},'updateDisabled':True}),encoding='utf-8')
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 result={'out':str(out),'profile':str(profile),'paths':paths,'port':port,'mainSha256':meta['pluginMainSha256']};(out/'native.json').write_text(json.dumps(result,indent=2),encoding='utf-8');return result
def launch(meta):
 q=lambda v:"'"+str(v).replace("'","''")+"'"
 args=['--user-data-dir="'+meta['profile']+'"','--remote-debugging-port='+str(meta['port']),'--remote-debugging-address=127.0.0.1','--enable-logging','--log-file="'+meta['out']+'/chromium.log"']
 cmd='Start-Process -FilePath '+q('D:/Obsidian/Obsidian.exe')+' -ArgumentList @('+','.join(q(a) for a in args)+') -WindowStyle Hidden -PassThru | Select-Object -ExpandProperty Id'
 subprocess.run([str(Path(os.environ['WINDIR'])/'System32/WindowsPowerShell/v1.0/powershell.exe'),'-NoProfile','-Command',cmd],capture_output=True,text=True,check=True)
def exercise(meta,legacy=False):
 out=within(meta['out']);checks=[]
 with sync_playwright() as pw:
  for _ in range(100):
   try:browser=pw.chromium.connect_over_cdp('http://127.0.0.1:'+str(meta['port']));break
   except Exception:time.sleep(.1)
  else:raise AssertionError('Owned profile CDP unavailable')
  pages={}
  for _ in range(100):
   for ctx in browser.contexts:
    for p in ctx.pages:
     if not p.url.startswith('app://'):continue
     try:
      actual=p.evaluate('window.app?.vault?.adapter?.basePath')
      for role,wanted in meta['paths'].items():
       if actual and Path(actual).resolve()==within(wanted):pages[role]=p
     except Exception:pass
   if len(pages)==2:break
   time.sleep(.1)
  assert len(pages)==2,'Both same-profile vault windows must exist'
  for p in pages.values():p.on('dialog',dismiss_owned_dialog)
  def state(role):
   for _ in range(100):
    try:
     value=pages[role].evaluate("window.app?.plugins?.getPlugin('knowledge-map-sync-unified')?.syncHost?.state() ?? null")
     if value is not None:return value
    except Exception as error:
     if 'Execution context was destroyed' not in str(error):raise
    time.sleep(.1)
   raise AssertionError('Owned vault host unavailable '+role)
  def ui(role):
   p=pages[role];p.evaluate("app.setting.open();app.setting.openTabById('knowledge-map-sync-unified');app.setting.win.document.documentElement.dataset.registryRole='"+role+"';")
   for _ in range(100):
    for ctx in browser.contexts:
     for target in ctx.pages:
      if target.locator('html[data-registry-role="'+role+'"] .kg-sync-settings').count():return target
    time.sleep(.05)
   raise AssertionError('Settings target not found '+role)
  def click(role,selector):
   target=ui(role);target.locator(selector).first.click(timeout=10000);pages[role].evaluate("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.settled()")
   target.wait_for_function("!!document.querySelector('[data-sync-confirm]') || document.querySelector('.kg-sync-settings [data-sync-action=\"new\"]')?.disabled === false",timeout=10000);return target
  try:
   for role,p in pages.items():
    p.wait_for_function("!!window.app?.plugins?.getPlugin('knowledge-map-sync-unified')?.syncHost || document.body.innerText.includes('信任仓库作者并启用插件')",timeout=30000)
    trust=p.get_by_role('button',name='信任仓库作者并启用插件')
    if trust.count():trust.click();p.wait_for_timeout(2000) # Enabling a fresh vault can reload its renderer.
    p.wait_for_function("!!window.app?.plugins?.getPlugin('knowledge-map-sync-unified')?.syncHost",timeout=30000);assert state(role)['status']=='unselected'
   a=click('A','[data-sync-action="new"]');assert a.locator('[data-sync-confirm]').count()==1;a.locator('[data-sync-cancel]').click()
   query=pages['B'].evaluate('navigator.locks.query()')
   b=click('B','[data-sync-action="new"]');blocked=not b.locator('[data-sync-confirm]').count()
   if legacy:
    blockedState=state('B')
    reason=b.locator('.kg-sync-settings').text_content()
    if blocked:assert 'connections-registry-busy' in reason
    result={'pass':True,'legacyReproduced':blocked,'blockedState':blockedState,'reason':reason,'lockInventoryFromB':query,'scope':'Actual two Obsidian vault windows in one owned profile; no user vaults.'}
   else:
    assert not blocked,'Second independent vault must show selection preview';b.locator('[data-sync-cancel]').click();checks.append('Both same-profile independent vaults open and cancel ordinary selection previews concurrently')
    for role in ['A','B']:target=click(role,'[data-sync-action="new"]');target.locator('[data-sync-confirm]').click();pages[role].evaluate("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.settled()")
    before={r:state(r) for r in pages};assert before['A']['installation']!=before['B']['installation'];assert before['A']['selected']['vault']!=before['B']['selected']['vault'];checks.append('Both normal selection confirmations preserve distinct installation and logical vault IDs')
    held=pages['A'].evaluate('(async()=> (await navigator.locks.query()).held)()');checks.append('Real Web Locks inventory captured from actual same-profile Obsidian')
    for role in ['A','B']:target=ui(role);target.screenshot(path=str(out/(role+'-selected.png')))
    await_close="app.plugins.getPlugin('knowledge-map-sync-unified').unifiedClose()"
    pages['A'].evaluate(await_close);assert state('B')['selected']==before['B']['selected'];assert state('B')['installation']==before['B']['installation'];checks.append('Closing one candidate host leaves the other selected vault and identity intact')
    result={'pass':True,'checks':checks,'statesBeforeClose':before,'held':held,'scope':'Actual Windows Obsidian two vault windows in one profile, ordinary settings/buttons; no Nutstore/iPad or concurrent document-edit claim.'}
   (out/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');return result
  finally:
   # The connection is to this generated profile; every vault page was checked.
   try:browser.new_browser_cdp_session().send('Browser.close')
   except Exception:pass
def cold(meta):
 out=within(meta['out']);before=json.loads((out/'verification.json').read_text(encoding='utf-8'))['statesBeforeClose'];launch(meta)
 with sync_playwright() as pw:
  for _ in range(100):
   try:browser=pw.chromium.connect_over_cdp('http://127.0.0.1:'+str(meta['port']));break
   except Exception:time.sleep(.1)
  else:raise AssertionError('Owned cold profile CDP unavailable')
  try:
   pages={}
   for _ in range(200):
    for ctx in browser.contexts:
     for p in ctx.pages:
      try:
       actual=p.evaluate('window.app?.vault?.adapter?.basePath')
       for role,wanted in meta['paths'].items():
        if actual and Path(actual).resolve()==within(wanted):pages[role]=p
      except Exception:pass
    if len(pages)==2:break
    time.sleep(.1)
   assert len(pages)==2,'Both cold vault windows must exist'
   for p in pages.values():p.on('dialog',dismiss_owned_dialog)
   states={}
   for role,p in pages.items():
    p.wait_for_function("!!window.app?.plugins?.getPlugin('knowledge-map-sync-unified')?.syncHost",timeout=30000)
    p.evaluate("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.settled()")
    states[role]=p.evaluate("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.state()")
    assert states[role]['status']=='join-required' and states[role]['error'] is None
    assert states[role]['installation']==before[role]['installation'] and states[role]['selected']==before[role]['selected']
   held=pages['A'].evaluate('(async()=> (await navigator.locks.query()).held)()')
   assert len([x for x in held if x['name']=='knowledge-map-sync-unified:sync-connections-v1:lock' and x['mode']=='shared'])==2
   result={'pass':True,'checks':['Both vaults cold reopen concurrently with unchanged installation and selected connection','Both real shared registry guards reacquired after full profile exit'],'states':states,'held':held,'scope':'Actual owned Windows Obsidian profile cold restart; same two synthetic vaults, no Nutstore/iPad.'}
   (out/'cold-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'cold':True,'pass':True,'checks':2,'out':str(out)}));return result
  finally:
   try:browser.new_browser_cdp_session().send('Browser.close')
   except Exception:pass
def main(old,new):
 results={}
 for label,prep in [('legacy',old),('fixed',new)]:
  meta=prepare(prep,label);launch(meta);r=exercise(meta,legacy=label=='legacy');results[label]={'out':meta['out'],'pass':r['pass'],'reproduced':r.get('legacyReproduced'),'checks':len(r.get('checks',[]))}
 cold(json.loads((Path(results['fixed']['out'])/'native.json').read_text(encoding='utf-8')));print(json.dumps(results))
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('old');a.add_argument('new');x=a.parse_args();main(x.old,x.new)
