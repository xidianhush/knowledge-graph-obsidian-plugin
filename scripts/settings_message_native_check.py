"""Inspect/fix gate in an owned synthetic Obsidian profile, never user vaults."""
import argparse,json,time
from pathlib import Path
from playwright.sync_api import sync_playwright
from sync_registry_native_check import prepare,launch,within,dismiss_owned_dialog
def run(prep,inspect=False):
 meta=prepare(prep,'settings-ui1-'+('before' if inspect else 'after'));out=within(meta['out']);launch(meta);checks=[]
 with sync_playwright() as pw:
  for _ in range(150):
   try:browser=pw.chromium.connect_over_cdp('http://127.0.0.1:'+str(meta['port']));break
   except Exception:time.sleep(.1)
  else:raise AssertionError('Owned CDP unavailable')
  try:
   pages={}
   for _ in range(150):
    for ctx in browser.contexts:
     for p in ctx.pages:
      try:
       actual=p.evaluate('window.app?.vault?.adapter?.basePath')
       for role,wanted in meta['paths'].items():
        if actual and Path(actual).resolve()==within(wanted):pages[role]=p
      except Exception:pass
    if len(pages)==2:break
    time.sleep(.1)
   assert len(pages)==2
   for p in pages.values():
    p.on('dialog',dismiss_owned_dialog)
    p.wait_for_function("!!window.app?.plugins?.getPlugin('knowledge-map-sync-unified')?.syncHost || document.body.innerText.includes('信任仓库作者并启用插件')",timeout=30000)
    trust=p.get_by_role('button',name='信任仓库作者并启用插件')
    if trust.count():trust.click();p.wait_for_timeout(2000)
    p.wait_for_function("!!window.app?.plugins?.getPlugin('knowledge-map-sync-unified')?.syncHost",timeout=30000)
   p=pages['A'];p.evaluate("app.setting.open();app.setting.openTabById('knowledge-map-sync-unified');app.setting.win.document.documentElement.dataset.settingsUi1='true'")
   for _ in range(100):
    targets=[t for c in browser.contexts for t in c.pages if t.locator('html[data-settings-ui1] .kg-settings-message').count()]
    if targets:break
    time.sleep(.1)
   assert targets;target=targets[0]
   target.locator('.kg-sync-settings').scroll_into_view_if_needed()
   def geom():return target.evaluate("""(()=>{const el=document.querySelector('.kg-settings-message'),r=el.getBoundingClientRect(),s=getComputedStyle(el);return {text:el.textContent,height:r.height,width:r.width,top:r.top,padding:s.padding,position:s.position,background:s.backgroundColor,role:el.getAttribute('role'),live:el.getAttribute('aria-live'),hit:r.height?document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.className:null}})()""")
   before=geom();(out/'empty-observation.json').write_text(json.dumps(before,indent=2),encoding='utf-8');target.screenshot(path=str(out/'settings-empty.png'))
   if inspect:
    assert before['text']=='' and before['height']>=15.8 and before['position']=='sticky' and 'kg-settings-message' in before['hit'],before
    target.locator('.kg-settings-message').evaluate("el=>el.style.padding='0'");zero=geom();assert zero['height']==0
    result={'pass':True,'reproduced':True,'before':before,'paddingOnlyIntervention':zero,'scope':'Actual same-profile Windows Obsidian 1.15.1 synthetic settings; no iPad/Nutstore.'}
   else:
    assert before['height']==0 and before['text']=='' and before['role']=='status' and before['live']=='polite';checks.append('Empty live region has zero height after scrolling native settings')
    target.get_by_role('button',name='检查范围',exact=True).click();target.wait_for_function("document.querySelector('.kg-settings-message').textContent.length>0")
    populated=geom();assert populated['height']>=16 and populated['position']=='sticky';checks.append('Normal scope message remains visible and sticky')
    target.get_by_role('button',name='撤销未保存修改',exact=True).click();assert geom()['height']==0;checks.append('Revert clears message without leaving a strip')
    number=target.locator('.kg-settings input[type=number]').first;number.fill('99');number.press('Tab');target.get_by_role('button',name='检查范围',exact=True).click()
    target.wait_for_function("document.querySelector('.kg-settings-message').dataset.error==='true'");assert geom()['height']>16;checks.append('Invalid settings still show the existing validation error')
    number.fill('350');number.press('Tab');target.get_by_role('button',name='检查范围',exact=True).click();target.wait_for_function("!document.querySelector('.kg-settings-message').dataset.error");checks.append('Correcting settings replaces the error with a normal message')
    target.get_by_role('button',name='保存并应用',exact=True).click();target.wait_for_function("document.querySelector('.kg-settings-message').textContent.includes('保存')");assert geom()['height']>0;checks.append('Save confirmation remains visible')
    target.get_by_role('button',name='撤销未保存修改',exact=True).click();assert geom()['height']==0
    target.locator('.kg-sync-settings').scroll_into_view_if_needed();target.get_by_role('button',name='新建共享布局',exact=True).click();target.locator('[data-sync-confirm]').wait_for();target.locator('[data-sync-cancel]').click();checks.append('Sync selection preview and cancel still work from scrolled settings')
    target.screenshot(path=str(out/'settings-final.png'));result={'pass':True,'checks':checks,'before':before,'populated':populated,'scope':'Actual Windows Obsidian synthetic settings and ordinary buttons. No iPad/Nutstore/native mobile claim.'}
   (out/'settings-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'pass':True,'inspect':inspect,'out':str(out),'checks':len(checks)}));return result
  finally:
   try:browser.new_browser_cdp_session().send('Browser.close')
   except Exception:pass
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('preparation');a.add_argument('--inspect',action='store_true');x=a.parse_args();run(x.preparation,x.inspect)
