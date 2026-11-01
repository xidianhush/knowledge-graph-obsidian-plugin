"""Bounded desktop lifecycle checks in the synthetic vault; no note writes."""
from pathlib import Path
import json,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.local/evidence/desktop-stability-009';OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.connect_over_cdp('http://127.0.0.1:9242',timeout=15000)
 page=next(pg for pg in browser.contexts[0].pages if 'app://obsidian.md' in pg.url)
 assert Path(page.evaluate('app.vault.adapter.basePath')).resolve()==(ROOT/'test-vault-layout-fix').resolve()
 cdp=page.context.new_cdp_session(page);exceptions=[];cdp.on('Runtime.exceptionThrown',lambda e:exceptions.append(e));cdp.send('Runtime.enable')
 errors=[];page.on('pageerror',lambda e:errors.append({'message':str(e),'stack':e.stack,'after':results[-1]['name'] if results else 'startup'}))
 results=[];cycles=[]
 def check(name,value):
  results.append({'name':name,'pass':bool(value)})
  (OUT/'results.json').write_text(json.dumps({'checks':results,'cycles':cycles,'errors':errors,'events':page.evaluate('window.stabilityEvents||[]'),'exceptions':exceptions},indent=2),encoding='utf-8')
  print(json.dumps(results[-1]),flush=True);assert value,name
 def bind():
  page.evaluate("""()=>{window.P=app.plugins.plugins['knowledge-graph-smoke'];window.V=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0]?.view;}""")
 page.add_init_script("window.stabilityEvents=[];window.addEventListener('error',e=>stabilityEvents.push({message:e.message,file:e.filename,line:e.lineno,column:e.colno,error:String(e.error),phase:window.stabilityPhase}))")
 page.reload(wait_until='domcontentloaded')
 page.wait_for_function("app?.workspace?.layoutReady && app.plugins.plugins['knowledge-graph-smoke']")
 bind()
 page.evaluate("app.changeTheme('obsidian')")
 page.wait_for_function("document.body.classList.contains('theme-dark')")
 runtime=page.evaluate("""()=>{app.setting.open();app.setting.openTabById('about');const about=app.setting.activeTab.containerEl.innerText;app.setting.close();return{plugin:P.manifest.version,electron:process.versions.electron,about,dark:document.body.classList.contains('theme-dark'),plugins:Object.keys(app.plugins.plugins)}}""")
 (OUT/'runtime.json').write_text(json.dumps(runtime,ensure_ascii=False,indent=2),encoding='utf-8')
 check('Runtime candidate and dark theme',runtime['plugin']=='0.0.9' and runtime['dark'])
 check('Actual Obsidian version 1.14.5','1.14.5' in runtime['about'])
 initial=page.evaluate('async()=>await P.loadData()')
 (OUT/'synthetic-config-before.json').write_text(json.dumps(initial,ensure_ascii=False,indent=2),encoding='utf-8')
 try:
  page.evaluate("""async()=>{for(const leaf of app.workspace.getLeavesOfType('knowledge-graph-vault-view'))await leaf.detach();}""")
  for i in range(30):
   row=page.evaluate("""async()=>{
    window.stabilityPhase='open-close';const start=performance.now();await P.openGraph('vault',true);
    const v=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view,s=v.session,preview=v.nativeServices;
    const live=s.diagnostics();await v.leaf.detach();
    return{ms:performance.now()-start,live,closed:s.diagnostics(),preview:preview.diagnostics(),workers:{...P.pipelineResources},views:app.workspace.getLeavesOfType('knowledge-graph-vault-view').length};
   }""")
   cycles.append(row)
   d=row['closed'];assert d['disposed'] and all(d[k]==0 for k in ['frames','timers','observers','listeners']),row
   assert row['preview']['disposed'] and row['workers']['active']==0 and row['views']==0,row
   if (i+1)%10==0:check(f'{i+1} open-close cycles release owned resources',True)
  page.evaluate("async()=>await P.openGraph('vault',true)");bind()
  page.evaluate("""()=>{window.layoutBefore=JSON.stringify(P.layoutStore.state().groups);window.coordsBefore=V.graph.renderer.NODES.map(n=>[n.id,n.x,n.y]);window.selection=V.graph.renderer.NODES.find(n=>n.kind==='heading').id;V.graph.renderer.selected=selection;window.cameraBefore=JSON.stringify(V.graph.renderer.camera);}""")
  check('Rebuild preserves camera selection and saved coordinates',page.evaluate("""async()=>{await V.rebuild();return JSON.stringify(V.graph.renderer.camera)===cameraBefore&&V.graph.renderer.selected===selection&&JSON.stringify(V.graph.renderer.NODES.map(n=>[n.id,n.x,n.y]))===JSON.stringify(coordsBefore)}"""))
  page.evaluate("""async()=>{window.tab=app.workspace.getLeaf('tab');await tab.openFile(app.vault.getAbstractFileByPath('__kg_rename__/Note0.md'));app.workspace.setActiveLeaf(tab,{focus:true});}""")
  page.wait_for_timeout(200)
  check('Inactive graph pauses',page.evaluate('()=>{V.session.refresh();return !V.session.diagnostics().active}'))
  page.evaluate('window.hiddenFrames=V.session.diagnostics().frameCount')
  page.wait_for_timeout(200)
  check('Hidden graph stops rendering',page.evaluate('V.session.diagnostics().frameCount===hiddenFrames'))
  page.evaluate('async()=>{await app.workspace.revealLeaf(V.leaf);await tab.detach();V.session.refresh()}')
  check('Graph resumes on return',page.evaluate('V.session.diagnostics().active'))
  for i in range(10):
   check(f'Cancel/rebuild race {i+1}',page.evaluate("""async()=>{const old=V.session,pending=V.rebuild();V.cancelBuild();await pending;const kept=V.session===old;await Promise.all([V.rebuild(),V.rebuild()]);return kept&&!!V.graph&&P.pipelineResources.active===0&&!P.layoutStore.state().busy}"""))
  page.evaluate("""async()=>{window.second=app.workspace.getLeaf('split');await second.setViewState({type:'knowledge-graph-vault-view',active:false});}""")
  check('Split views use separate cores and shared committed layouts',page.evaluate("second.view.session.core!==V.session.core && JSON.stringify(second.view.graph.renderer.NODES.map(n=>[n.id,n.x,n.y]))===JSON.stringify(V.graph.renderer.NODES.map(n=>[n.id,n.x,n.y]))"))
  page.evaluate('async()=>{await second.detach();await app.workspace.revealLeaf(V.leaf)}')
  page.evaluate('window.originalSettings=structuredClone(P.graphSettings)')
  for i in range(10):
   check(f'Settings rebuild {i+1}',page.evaluate("""async()=>{const draft=structuredClone(P.savedData);draft.settings.autoUpdate=!P.graphSettings.autoUpdate;await P.saveGraphSettings(draft);await V.rebuild();return JSON.stringify(P.layoutStore.state().groups)===layoutBefore&&P.pipelineResources.active===0}"""))
  page.evaluate("async()=>{const draft=structuredClone(P.savedData);draft.settings=originalSettings;await P.saveGraphSettings(draft);await V.rebuild()}")
  for i in range(10):
   page.evaluate("""async()=>{window.retired=V.session;await app.plugins.disablePlugin('knowledge-graph-smoke');}""")
   check(f'Plugin disable releases graph {i+1}',page.evaluate('retired.diagnostics().disposed && retired.diagnostics().listeners===0 && retired.diagnostics().frames===0'))
   page.evaluate("async()=>{await app.plugins.enablePlugin('knowledge-graph-smoke');await app.plugins.plugins['knowledge-graph-smoke'].openGraph('vault',true)}");bind()
   page.wait_for_timeout(150)
   check(f'Plugin reload retains layouts {i+1}',page.evaluate('JSON.stringify(P.layoutStore.state().groups)===layoutBefore'))
  page.wait_for_timeout(300)
  check('No uncaught errors',not errors)
  check('No outstanding workers or layout writes',page.evaluate('P.pipelineResources.active===0 && !P.layoutStore.state().busy'))
  page.screenshot(path=str(OUT/'ready.png'))
 finally:
  # Only settings touched by a future extension may need restoring; layout data is never reset here.
  page.keyboard.up('Control');page.mouse.up()
 browser.close()
