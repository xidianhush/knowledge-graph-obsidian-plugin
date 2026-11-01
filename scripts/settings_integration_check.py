"""Settings UI, persistence and live lifecycle in the workspace's isolated Obsidian vault."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.local/evidence'
RESULTS=[]
def check(name, passed, detail=None):
    row={'name':name,'pass':bool(passed),'detail':detail}; RESULTS.append(row)
    (OUT/'settings-results.json').write_text(json.dumps(RESULTS,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(row,ensure_ascii=False),flush=True)
    assert passed,name
with sync_playwright() as p:
    browser=p.chromium.connect_over_cdp('http://127.0.0.1:9238')
    page=next(pg for pg in browser.contexts[0].pages if 'app://obsidian.md' in pg.url)
    page.wait_for_function('window.app?.vault')
    assert Path(page.evaluate('app.vault.adapter.basePath')).resolve()==(ROOT/'test-vault').resolve()
    page.reload(wait_until='domcontentloaded')
    page.wait_for_function("window.app?.workspace?.layoutReady && app.plugins.plugins['knowledge-graph-smoke']?.graphSettings")
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    if page.locator('.modal-container').count():page.keyboard.press('Escape')
    saved=page.evaluate("window.app?.plugins?.plugins['knowledge-graph-smoke'].savedData")
    page.evaluate('''async()=>{
      window.P=app.plugins.plugins['knowledge-graph-smoke'];
      for(const type of ['knowledge-graph-vault-view','knowledge-graph-smoke-view'])for(const leaf of app.workspace.getLeavesOfType(type))leaf.detach();
      window.root='__kg_settings_acceptance__';
      if(!app.vault.getAbstractFileByPath(root))await app.vault.createFolder(root);
      for(const [name,text] of Object.entries({'Alpha.md':'# Alpha\\nText.\\n','Beta.md':'# Beta\\n[[Alpha]]\\n','Skip.md':'Synthetic excluded note.\\n'})){
        const old=app.vault.getAbstractFileByPath(root+'/'+name);if(old)await app.vault.modify(old,text);else await app.vault.create(root+'/'+name,text);
      }
      window.draft=structuredClone(P.savedData);draft.pipeline.config.include=[root+'/**'];draft.pipeline.config.exclude=['**/Skip.md'];
      draft.pipeline.config.preview={enabled:true,max_note_chars:256};draft.settings={autoUpdate:true,debounceMs:350};
      draft.unrelated={keep:42};draft.pipeline.config.layout={padding:1.2};draft.pipeline.annotations={edges:[]};draft.pipeline.candidates={candidates:[]};
      await P.saveGraphSettings(draft);await P.openGraph('vault',true);
      window.V=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view;
      window.reads=[];window.originalRead=app.vault.cachedRead;app.vault.cachedRead=function(f){reads.push(f.path);return originalRead.call(this,f);};
      app.setting.open();app.setting.openTabById(P.manifest.id);
    }''')
    try:
        page.wait_for_selector('.kg-settings')
        check('Registered native Obsidian settings tab',page.locator('.kg-settings').count()==1)
        check('Persisted settings populate UI',page.get_by_role('textbox',name='包含范围',exact=True).input_value()=='__kg_settings_acceptance__/**')
        page.get_by_role('button',name='检查范围',exact=True).click()
        check('Scope preview reports selected count without body reads',page.evaluate("reads.length===0 && document.querySelector('.kg-settings-message').textContent.includes('匹配 2 篇')"))
        page.get_by_role('textbox',name='包含范围',exact=True).fill('')
        page.get_by_role('button',name='保存并应用',exact=True).click()
        check('Invalid empty scope cannot replace saved settings',page.evaluate("document.querySelector('.kg-settings-message').dataset.error==='true' && P.pipelineSettings.config.include[0]===root+'/**'"))
        page.get_by_role('button',name='撤销未保存修改',exact=True).click()
        page.get_by_role('textbox',name='目录映射',exact=True).fill('{broken')
        page.get_by_role('button',name='保存并应用',exact=True).click()
        check('Invalid mapping JSON is visible and not saved',page.evaluate("document.querySelector('.kg-settings-message').textContent.includes('JSON') && P.pipelineSettings.config.remap.length===0"))
        page.get_by_role('button',name='撤销未保存修改',exact=True).click()
        page.get_by_role('spinbutton',name='更新防抖（毫秒）',exact=True).fill('700')
        page.locator('.kg-settings .setting-item').filter(has=page.get_by_text('自动更新',exact=True)).locator('.checkbox-container').click()
        page.locator('.kg-settings .setting-item').filter(has=page.get_by_text('原生笔记预览',exact=True)).locator('.checkbox-container').click()
        page.get_by_role('button',name='保存并应用',exact=True).click()
        page.wait_for_function("P.graphSettings.autoUpdate===false && V.buildState.phase==='ready' && !V.contentEl.dataset.pipelineUpdating")
        check('UI saves update and preview toggles plus debounce',page.evaluate('P.graphSettings.debounceMs===700 && P.pipelineSettings.config.preview.enabled===false'))
        check('Saving preserves advanced config and unrelated data',page.evaluate('P.savedData.unrelated.keep===42 && P.pipelineSettings.config.layout.padding===1.2 && Array.isArray(P.pipelineSettings.annotations.edges) && Array.isArray(P.pipelineSettings.candidates.candidates)'))
        check('Build feedback shows counts, duration and auto-update mode',page.evaluate("V.buildState.message.includes('2 篇笔记') && V.buildState.message.includes('秒') && V.buildState.message.includes('自动更新已关闭')"))
        page.screenshot(path=str(OUT/'settings-tab.png'))
        page.evaluate('app.setting.close()')
        page.evaluate("()=>{const toggle=V.host.shadowRoot.getElementById('legend-toggle');if(toggle.getAttribute('aria-expanded')==='true')toggle.click();}")
        check('Build status does not cover collapsed legend control',page.evaluate("(()=>{const a=V.contentEl.querySelector('.kg-build-status').getBoundingClientRect(),b=V.host.shadowRoot.getElementById('legend-toggle').getBoundingClientRect();return a.bottom<=b.top || a.top>=b.bottom || a.right<=b.left || a.left>=b.right;})()"))
        page.evaluate('''async()=>{window.rev=V.generation;window.count=reads.length;const n=V.graph.data.nodes.find(n=>n.kind==='note');await V.nativeServices.preview.show(n,200,200,true);}''')
        check('Disabled preview does not read or open',page.evaluate('reads.length===count && !V.nativeServices.preview.state().open'))
        page.evaluate("async()=>{const f=app.vault.getAbstractFileByPath(root+'/Alpha.md');await app.vault.modify(f,'# Changed\\nDisabled auto-update.\\n');}")
        page.wait_for_timeout(900)
        check('Disabled automatic update ignores note modifications',page.evaluate('V.generation===rev && V.updateTimer===null'))
        page.get_by_role('button',name='重新构建',exact=True).click()
        page.wait_for_function("V.graph.data.nodes.some(n=>n.title==='Changed') && !V.contentEl.dataset.pipelineUpdating")
        check('Manual rebuild works with automatic updates disabled',True)
        check('Excluded notes were never read',page.evaluate("!reads.some(p=>p.endsWith('/Skip.md') || p==='Utilities/API Key.md')"))
        page.evaluate('''async()=>{reads.length=0;const d=structuredClone(P.savedData);d.pipeline.config.exclude_notes=['Beta'];d.pipeline.config.remap=[{from:root,to:'Mapped'}];await P.saveGraphSettings(d);}''')
        page.wait_for_function("V.buildState.phase==='ready'")
        check('Named exclusion is applied before reads',page.evaluate("V.graph.data.meta.note_count===1 && !reads.some(p=>p.endsWith('/Beta.md'))"))
        check('Directory mapping changes graph identity but preserves source path',page.evaluate("V.graph.data.nodes.some(n=>n.kind==='note' && n.id==='Mapped/Alpha' && n.path===root+'/Alpha.md')"))
        page.evaluate('''async()=>{const d=structuredClone(P.savedData);d.pipeline.config.exclude_notes=[];d.pipeline.config.remap=[];await P.saveGraphSettings(d);}''')
        page.wait_for_function("V.buildState.phase==='ready'")
        page.evaluate('''async()=>{const d=structuredClone(P.savedData);d.settings.autoUpdate=true;d.settings.debounceMs=1000;d.pipeline.config.preview.enabled=true;await P.saveGraphSettings(d);}''')
        page.wait_for_function("V.buildState.phase==='ready'")
        page.evaluate('''async()=>{window.started=P.pipelineResources.started;const f=app.vault.getAbstractFileByPath(root+'/Alpha.md');await app.vault.modify(f,'# Debounced\\n');}''')
        page.wait_for_function("V.buildState.phase==='waiting'")
        check('Waiting status is displayed during configured debounce',page.evaluate('V.updateTimer!==null'))
        page.wait_for_timeout(400)
        check('Configured debounce delays worker creation',page.evaluate('P.pipelineResources.started===started'))
        page.wait_for_function("V.buildState.phase==='ready' && V.graph.data.nodes.some(n=>n.title==='Debounced')")
        page.evaluate('''()=>{window.previous=V.session;window.releaseRead=null;app.vault.cachedRead=f=>new Promise(resolve=>{window.releaseRead=()=>originalRead.call(app.vault,f).then(resolve);});void V.rebuild();}''')
        page.wait_for_function('releaseRead!==null')
        check('Old graph stays visible while build is pending',page.evaluate('V.session===previous && V.buildState.phase===\'building\''))
        page.get_by_role('button',name='取消',exact=True).click()
        page.evaluate('()=>{app.vault.cachedRead=originalRead;releaseRead();}')
        page.wait_for_timeout(200)
        check('Cancel discards late result, clears busy flag and keeps old graph',page.evaluate("V.session===previous && V.buildState.phase==='cancelled' && !V.contentEl.dataset.pipelineUpdating && P.pipelineResources.active===0"))
        page.evaluate('''async()=>{window.realSave=P.saveData;P.saveData=async()=>{throw new Error('simulated disk failure');};const d=structuredClone(P.savedData);d.settings.debounceMs=900;try{await P.saveGraphSettings(d);}catch(e){window.saveFailure=e.message;}P.saveData=realSave;}''')
        check('Save failure leaves active settings untouched',page.evaluate("saveFailure==='simulated disk failure' && P.graphSettings.debounceMs===1000"))
        page.evaluate('''async()=>{const d=structuredClone(P.savedData);d.pipeline.config.include=['NoSuchScope/**'];await P.saveGraphSettings(d);}''')
        page.wait_for_function("V.buildState.phase==='empty'")
        check('Empty scope has actionable feedback and no stale graph',page.evaluate('!V.session && V.contentEl.dataset.pipelineEmpty===\'true\''))
        page.evaluate('''async()=>{const d=structuredClone(P.savedData);d.pipeline.config.include=[root+'/**'];d.settings.autoUpdate=false;await P.saveGraphSettings(d);}''')
        page.wait_for_function("V.buildState.phase==='ready'")
        page.screenshot(path=str(OUT/'settings-build-ready.png'))
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function("window.app?.workspace?.layoutReady && window.app?.plugins?.plugins['knowledge-graph-smoke']?.graphSettings")
        page.evaluate("window.P=app.plugins.plugins['knowledge-graph-smoke']")
        check('Settings survive full application page reload',page.evaluate("P.graphSettings.autoUpdate===false && P.graphSettings.debounceMs===1000 && P.savedData.unrelated.keep===42 && P.pipelineSettings.config.include[0]==='__kg_settings_acceptance__/**'"))
        page.evaluate("async()=>{await P.openGraph('vault',true);window.V=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view;}")
        page.wait_for_function("V.buildState.phase==='ready'")
        page.evaluate('V.leaf.detach()')
        check('Closing releases subscriptions, workers and status DOM',page.evaluate('V.watchEvents.length===0 && V.updateTimer===null && P.pipelineResources.active===0 && V.contentEl.childElementCount===0'))
        check('No uncaught runtime errors',not errors,errors)
    finally:
        page.evaluate('''async(saved)=>{app.setting.close();if(window.originalRead)app.vault.cachedRead=originalRead;for(const leaf of app.workspace.getLeavesOfType('knowledge-graph-vault-view'))leaf.detach();await P.saveGraphSettings(saved);}''',saved)
print(json.dumps({'ok':len(RESULTS),'fail':sum(not row['pass'] for row in RESULTS)}))
