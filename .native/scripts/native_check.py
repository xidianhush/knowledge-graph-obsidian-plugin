"""Native Markdown, source-line navigation, and automatic vault-update integration."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.local/evidence'
RESULTS=[]
def check(name,ok,detail=None):
    row={'name':name,'pass':bool(ok),'detail':detail}; RESULTS.append(row)
    (OUT/'native-results.json').write_text(json.dumps(RESULTS,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(row,ensure_ascii=False),flush=True)
    assert ok,name
with sync_playwright() as p:
    browser=p.chromium.connect_over_cdp('http://127.0.0.1:9237')
    page=next(pg for pg in browser.contexts[0].pages if 'app://obsidian.md' in pg.url)
    errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
    page.reload(wait_until='domcontentloaded')
    page.wait_for_function("window.app?.workspace?.layoutReady && app.plugins.plugins['knowledge-graph-smoke']")
    check('Independent test vault',page.evaluate("app.vault.getName()==='test-vault'"))
    if page.locator('.modal-container').count(): page.keyboard.press('Escape')
    page.evaluate('''async () => {
      window.P=app.plugins.plugins['knowledge-graph-smoke']; window.savedSettings=P.pipelineSettings;
      for(const type of ['knowledge-graph-vault-view','knowledge-graph-smoke-view'])for(const leaf of app.workspace.getLeavesOfType(type))leaf.detach();
      window.root='__kg_native_acceptance__';
      if(!app.vault.getAbstractFileByPath(root))await app.vault.createFolder(root);
      for(const name of ['Renamed.md','Created.md','Again.md']){const file=app.vault.getAbstractFileByPath(root+'/'+name);if(file)await app.vault.delete(file);}
      const notes={
        'Alpha.md':'---\\nsubject: Integration\\n---\\n# Alpha\\n[[Beta#Start]]\\n![[pixel.png]]\\n$E=mc^2$\\n## Repeated\\nFirst section.\\n'+Array(60).fill('Body paragraph.\\n').join('\\n')+'\\n## Repeated\\nSecond section marker.\\n',
        'Beta.md':'# Start\\nTarget note.\\n', 'Skip.md':'Synthetic excluded content.\\n'
      };
      for(const [name,text]of Object.entries(notes)){const path=root+'/'+name,old=app.vault.getAbstractFileByPath(path);if(old)await app.vault.modify(old,text);else await app.vault.create(path,text);}
      if(!app.vault.getAbstractFileByPath(root+'/pixel.png')){
        const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6uoAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
        await app.vault.createBinary(root+'/pixel.png',bytes.buffer);
      }
      P.pipelineSettings={config:{include:[root+'/**'],exclude:['**/Skip.md']}};
      window.realRead=app.vault.cachedRead;
      await P.openGraph('vault',true);
      window.V=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view;
    }''')
    try:
        page.wait_for_function('V.graph?.renderer.stats.painted>0 && !V.contentEl.dataset.pipelineUpdating')
        page.wait_for_timeout(500)
        check('Live view owns exactly four vault subscriptions',page.evaluate('V.watchEvents.length===4'))
        page.evaluate("window.H=V.graph.data.nodes.filter(n=>n.title==='Repeated').sort((a,b)=>a.line-b.line)[1]; window.N=V.graph.data.nodes.find(n=>n.kind==='note'&&n.label==='Alpha'); window.S=V.nativeServices")
        check('Repeated heading retains source line',page.evaluate('H && H.line>100'),page.evaluate('H'))
        page.evaluate('''() => {const r=V.contentEl.getBoundingClientRect(); V.graph.showPreview(H,r.left+100,r.top+100,true);}''')
        page.wait_for_function("V.contentEl.querySelector('.kg-native-preview-body')?.textContent.includes('Second section marker.')")
        page.wait_for_selector('.kg-native-preview[data-ready="true"]')
        check('HUD opens native Markdown preview without snapshot HTML',page.evaluate("!N.preview && S.preview.state().open && V.contentEl.querySelector('.kg-native-preview-body h2')"))
        check('Repeated heading scrolls to exact source heading',page.evaluate("(()=>{const b=V.contentEl.querySelector('.kg-native-preview-body'), a=b.querySelector('[id^=kg-native-target]');return a && b.scrollTop>0 && a.getBoundingClientRect().top>=b.getBoundingClientRect().top-1 && a.getBoundingClientRect().top<b.getBoundingClientRect().bottom;})()"))
        page.wait_for_function("V.contentEl.querySelector('.kg-native-preview-body .math, .kg-native-preview-body mjx-container, .kg-native-preview-body .MathJax')")
        check('Obsidian renders math',True)
        page.wait_for_function("(()=>{const i=V.contentEl.querySelector('.kg-native-preview-body img');return i && i.complete && i.naturalWidth>0;})()",timeout=10000)
        check('Vault image resolves to a host resource URL',page.evaluate("V.contentEl.querySelector('.kg-native-preview-body img').src.startsWith('app://')"),page.evaluate("V.contentEl.querySelector('.kg-native-preview-body img').src"))
        check('Preview component is owned by the view',page.evaluate('S.diagnostics().active===1'))
        page.screenshot(path=str(OUT/'native-preview-heading.png'))
        page.evaluate('S.preview.hide()')
        check('Closing popup unloads Markdown component',page.evaluate('S.diagnostics().active===0 && S.diagnostics().created===S.diagnostics().unloaded && !V.graph.previewState().open'))
        page.evaluate("P.pipelineSettings.config.preview={max_note_chars:256}; S.preview.show(H,200,200,true)")
        page.wait_for_selector('.kg-native-preview[data-ready="true"]')
        check('Preview budget keeps a distant heading and explains truncation',page.evaluate("V.contentEl.querySelector('.kg-native-preview-body').textContent.includes('Second section marker.') && !!V.contentEl.querySelector('.kg-native-preview-hint')"))
        page.evaluate("()=>{delete P.pipelineSettings.config.preview; S.preview.hide();}")
        # Exercise actual Ctrl hover and release, not only the public HUD test hook.
        page.evaluate('V.graph.renderer.focusOn(H.id,1.25)');page.wait_for_timeout(600)
        point=page.evaluate('''() => {const r=V.host.shadowRoot.getElementById('cv').getBoundingClientRect(),c=V.graph.camera;return {x:r.left+H.x*c.zoom+c.panX,y:r.top+H.y*c.zoom+c.panY};}''')
        page.mouse.move(point['x'],point['y']);page.mouse.click(point['x'],point['y']);page.keyboard.down('Control')
        page.wait_for_function('V.graph.previewState().open')
        check('Ctrl hover opens a temporary native preview',page.evaluate('!V.graph.previewState().pinned'))
        page.keyboard.up('Control');page.wait_for_function('!V.graph.previewState().open')
        check('Releasing Ctrl closes temporary preview',True)
        page.evaluate('S.openNote(H)')
        page.wait_for_function('app.workspace.activeLeaf.view.file?.path===H.path')
        check('Heading jump opens the source file at the duplicate heading line',page.evaluate('app.workspace.activeLeaf.getEphemeralState().cursor?.from.line===H.line-1'),page.evaluate('app.workspace.activeLeaf.getEphemeralState()'))
        check('Navigation leaves graph tab available',page.evaluate("app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0]===V.leaf"))
        page.evaluate('app.workspace.revealLeaf(V.leaf)');page.wait_for_timeout(200)
        page.evaluate('''() => { const r=V.contentEl.getBoundingClientRect();V.graph.showPreview(N,r.left+100,r.top+100,true); }''')
        page.wait_for_selector('.kg-native-preview:not([hidden]) a.internal-link')
        page.locator('.kg-native-preview a.internal-link').first.click()
        page.wait_for_function("app.workspace.activeLeaf.view.file?.path===root+'/Beta.md'")
        check('Native internal wikilink opens relative to its source note',True)
        page.evaluate('app.workspace.revealLeaf(V.leaf)');page.wait_for_timeout(300)
        page.evaluate('''() => {
          const sh=V.host.shadowRoot;
          sh.getElementById('search').value='Alpha';V.graph.runSearch('Alpha');
          sh.getElementById('labels').value='selected';sh.getElementById('labels').dispatchEvent(new Event('change'));
          V.graph.select(H.id,false);V.graph.renderer.cancelInteraction();
          window.before=V.graph.captureState();window.oldSession=V.session;window.oldServices=V.nativeServices;
          window.releaseRead=null;
          app.vault.cachedRead=function(file){return new Promise(resolve=>{window.releaseRead=()=>realRead.call(app.vault,file).then(resolve);});};
        }''')
        page.evaluate("async()=>{const f=app.vault.getAbstractFileByPath(N.path);await app.vault.modify(f,(await realRead.call(app.vault,f))+'\\n### Updated\\nNew text.\\n');}")
        page.wait_for_function('releaseRead!==null')
        check('Old graph stays mounted while automatic rebuild reads',page.evaluate('V.session===oldSession && !oldSession.diagnostics().disposed && V.contentEl.dataset.smokeReady===\'true\''))
        page.evaluate('()=>{app.vault.cachedRead=realRead;releaseRead();}')
        page.wait_for_function("V.graph?.data.nodes.some(n=>n.title==='Updated') && !V.contentEl.dataset.pipelineUpdating")
        check('Modify event rebuilds without a command',True)
        check('Rebuild restores camera, search, labels and selection',page.evaluate('JSON.stringify(V.graph.captureState())===JSON.stringify(before)'),page.evaluate('({before,after:V.graph.captureState()})'))
        check('Swap releases old canvas and native services',page.evaluate('oldSession.diagnostics().disposed && oldSession.diagnostics().listeners===0 && oldServices.diagnostics().disposed && oldServices.diagnostics().active===0'))
        page.evaluate('''async()=>{
          window.started=P.pipelineResources.started;
          const f=app.vault.getAbstractFileByPath(root+'/Beta.md');
          for(let i=0;i<5;i++)await app.vault.modify(f,'# Start\\nBurst '+i+'\\n');
        }''')
        page.wait_for_function('P.pipelineResources.started>started && !V.contentEl.dataset.pipelineUpdating')
        page.wait_for_timeout(500)
        check('Rapid save burst is coalesced into one build',page.evaluate('P.pipelineResources.started===started+1'),page.evaluate('({started,after:P.pipelineResources.started})'))
        page.evaluate("async()=>{window.started=P.pipelineResources.started;await app.vault.modify(app.vault.getAbstractFileByPath(root+'/Skip.md'),'Excluded change');}")
        page.wait_for_timeout(800)
        check('Excluded note changes do not trigger builds',page.evaluate('P.pipelineResources.started===started'))
        page.evaluate("app.vault.create(root+'/Created.md','# Created\\n[[Alpha]]')")
        page.wait_for_function('V.graph?.data.meta.note_count===3 && !V.contentEl.dataset.pipelineUpdating')
        check('Create event adds a note and links',page.evaluate("V.graph.data.nodes.some(n=>n.label==='Created')"))
        page.evaluate("app.vault.rename(app.vault.getAbstractFileByPath(root+'/Created.md'),root+'/Renamed.md')")
        page.wait_for_function("V.graph?.data.nodes.some(n=>n.path===root+'/Renamed.md') && !V.contentEl.dataset.pipelineUpdating")
        check('Rename event removes the old node identity',page.evaluate("!V.graph.data.nodes.some(n=>n.path===root+'/Created.md')"))
        page.evaluate("()=>{V.graph.select(V.graph.data.nodes.find(n=>n.path===root+'/Renamed.md').id,false);}")
        page.evaluate("app.vault.delete(app.vault.getAbstractFileByPath(root+'/Renamed.md'))")
        page.wait_for_function('V.graph?.data.meta.note_count===2 && !V.contentEl.dataset.pipelineUpdating')
        check('Delete event clears missing selection',page.evaluate('V.graph.renderer.selected===null'))
        # A failing rebuild must keep the last successful graph usable, then recover.
        page.evaluate("()=>{window.goodSession=V.session;app.vault.cachedRead=async()=>{throw new Error('Synthetic read failure');};}")
        page.evaluate('V.rebuild()')
        check('Failed rebuild retains last successful graph',page.evaluate("V.session===goodSession && !goodSession.diagnostics().disposed && V.contentEl.textContent.includes('仍显示')"))
        page.evaluate('()=>{app.vault.cachedRead=realRead;}');page.evaluate('V.rebuild()')
        check('Rebuild recovers after a read failure',page.evaluate('V.session!==goodSession && !V.contentEl.querySelector(\'.kg-build-status\')'))
        # A new change supersedes an in-flight worker; only the newest payload may mount.
        page.evaluate("()=>{window.RealWorker=window.Worker;window.Worker=class extends RealWorker {set onmessage(cb){this.withheld=cb;}get onmessage(){return this.withheld;}};window.pending=V.rebuild();}")
        page.wait_for_function('P.pipelineResources.active===1')
        page.evaluate("()=>{window.Worker=RealWorker;}")
        page.evaluate("app.vault.modify(app.vault.getAbstractFileByPath(root+'/Beta.md'),'# Latest\\nLatest revision.\\n')")
        page.wait_for_function("V.graph?.data.nodes.some(n=>n.title==='Latest') && !V.contentEl.dataset.pipelineUpdating")
        check('New change cancels the obsolete worker and mounts only current data',page.evaluate("!V.graph.data.nodes.some(n=>n.title==='Start') && P.pipelineResources.active===0 && P.pipelineResources.started===P.pipelineResources.stopped"))
        # Event-driven empty state must keep subscriptions so a newly-created note restores the graph.
        page.evaluate("async()=>{for(const name of ['Alpha.md','Beta.md'])await app.vault.delete(app.vault.getAbstractFileByPath(root+'/'+name));}")
        page.wait_for_function("V.contentEl.dataset.pipelineEmpty==='true'")
        check('Deleting the last scoped notes displays empty state and releases graph',page.evaluate('V.session===null && V.nativeServices===null && V.watchEvents.length===4'))
        page.evaluate("app.vault.create(root+'/Again.md','# Again\\nRecovered automatically.\\n')")
        page.wait_for_function('V.graph?.data.meta.note_count===1 && !V.contentEl.dataset.pipelineUpdating')
        check('Create event recovers automatically from empty scope',True)
        # Closing during a delayed native read must not render into detached UI.
        page.evaluate('''()=>{
          window.S=V.nativeServices;window.lateRead=null;
          app.vault.cachedRead=file=>new Promise(resolve=>{window.lateRead=()=>realRead.call(app.vault,file).then(resolve);});
          const n=V.graph.data.nodes.find(n=>n.kind==='note');S.preview.show(n,200,200,true);
        }''')
        page.wait_for_function('lateRead!==null')
        page.evaluate('()=>{V.leaf.detach();app.vault.cachedRead=realRead;lateRead();}')
        page.wait_for_timeout(300)
        check('Closing during preview read cancels late render and all subscriptions',page.evaluate('S.diagnostics().disposed && S.diagnostics().active===0 && S.diagnostics().listeners===0 && S.diagnostics().observers===0 && V.watchEvents.length===0 && V.updateTimer===null && V.contentEl.childElementCount===0'))
        check('All workers stopped and no runtime errors',page.evaluate('P.pipelineResources.active===0 && P.pipelineResources.started===P.pipelineResources.stopped') and not errors,errors)
        # Leave a useful graph in the isolated vault for manual review.
        page.evaluate("P.openGraph('vault',true)");page.wait_for_timeout(700)
        page.screenshot(path=str(OUT/'native-auto-update-final.png'))
    finally:
        page.evaluate('()=>{app.vault.cachedRead=realRead;P.pipelineSettings=savedSettings;if(window.RealWorker)window.Worker=RealWorker;}')
print(json.dumps({'ok':len(RESULTS),'fail':sum(not r['pass'] for r in RESULTS)}))
