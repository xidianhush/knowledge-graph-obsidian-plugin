"""Acceptance against only the approved real-vault copy (port 9239)."""
from pathlib import Path
import hashlib
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.local/evidence'
TRIAL=ROOT/'real-vault-trial'
MANIFEST=json.loads((OUT/'real-trial-copy.json').read_text(encoding='utf8'))
RESULTS=[]
def check(name, passed, detail=None):
    row={'name':name,'pass':bool(passed),'detail':detail};RESULTS.append(row)
    (OUT/'real-trial-results.json').write_text(json.dumps(RESULTS,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(row,ensure_ascii=False),flush=True)
    assert passed,name
check('Copy contains exactly 95 approved Markdown files',len(list(TRIAL.rglob('*.md')))==95 and all((TRIAL/row['path']).is_file() for row in MANIFEST['notes']))
check('Private directories and API Key are absent',not any((TRIAL/name).exists() for name in ['Utilities','Logs','Medical and Health','Projects','.git','.trash']))
check('Copied image bytes match copy manifest',all(hashlib.sha256((TRIAL/row['path']).read_bytes()).hexdigest()==row['sha256'] for row in MANIFEST['images']),{'images':len(MANIFEST['images']),'bytes':sum(r['bytes'] for r in MANIFEST['images'])})
with sync_playwright() as p:
    browser=p.chromium.connect_over_cdp('http://127.0.0.1:9239')
    page=next(pg for pg in browser.contexts[0].pages if 'app://obsidian.md' in pg.url)
    page.wait_for_function('window.app?.workspace?.layoutReady')
    check('Obsidian opens only workspace trial copy',Path(page.evaluate('app.vault.adapter.basePath')).resolve()==TRIAL.resolve())
    page.wait_for_function("app.plugins.plugins['knowledge-graph-smoke']?.graphSettings")
    if page.locator('.modal-container').count():page.keyboard.press('Escape')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.evaluate('''async()=>{
      window.P=app.plugins.plugins['knowledge-graph-smoke'];window.reads=[];window.originalRead=app.vault.cachedRead;
      app.vault.cachedRead=function(file){
        if(!/^(Science and Tech|Literature History Philosophy)\//.test(file.path))throw new Error('Out of trial scope read blocked');
        reads.push(file.path);return originalRead.call(this,file);
      };
      await P.openGraph('vault',true);window.V=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view;
    }''')
    try:
        page.wait_for_function("V.buildState.phase==='ready' && V.graph.renderer.stats.painted>0",timeout=60000)
        check('Real notes build successfully in worker',page.evaluate('V.graph.data.meta.note_count===95'),page.evaluate('({notes:V.graph.data.meta.note_count,nodes:V.graph.data.nodes.length,edges:V.graph.data.edges.length,status:V.buildState.message})'))
        check('Only approved note bodies cross vault read boundary',page.evaluate("new Set(reads).size===95 && reads.every(p=>/^(Science and Tech|Literature History Philosophy)\//.test(p))"))
        check('Worker resources are released',page.evaluate('P.pipelineResources.active===0 && P.pipelineResources.started===P.pipelineResources.stopped'))
        page.evaluate("V.host.shadowRoot.getElementById('legend-toggle').click()")
        page.screenshot(path=str(OUT/'real-trial-graph.png'))
        # Choose existing local-image/math examples by metadata/content in the approved copy.
        page.evaluate('''async()=>{
          const candidates=[];
          for(const n of V.graph.data.nodes.filter(n=>n.kind==='note')){
            const file=app.vault.getAbstractFileByPath(n.path),text=await app.vault.cachedRead(file);
            if(text.length>50000 || /!\[[^\]]*\]\(https?:|<img[^>]+https?:/i.test(text))continue;
            const embeds=app.metadataCache.getFileCache(file)?.embeds||[];
            candidates.push({n,text,localImage:embeds.some(e=>/\.(png|jpg|jpeg|webp|gif)(?:\||$)/i.test(e.link)&&app.metadataCache.getFirstLinkpathDest(e.link,n.path))});
          }
          candidates.sort((a,b)=>a.text.length-b.text.length);
          window.imageNode=candidates.find(c=>c.localImage)?.n;window.mathNode=candidates.find(c=>/\$[^$]+\$/.test(c.text))?.n;
          if(imageNode)await V.nativeServices.preview.show(imageNode,400,250,true);
        }''')
        check('Approved scope contains a local-image preview example',page.evaluate('!!imageNode'))
        page.wait_for_function("Array.from(V.contentEl.querySelectorAll('.kg-native-preview-body img')).some(i=>i.src.startsWith('app://')&&i.complete&&i.naturalWidth>0)",timeout=15000)
        check('Real copied image renders through Obsidian resource URL',True)
        page.screenshot(path=str(OUT/'real-trial-image-preview.png'))
        page.evaluate('''async()=>{V.nativeServices.preview.hide();if(mathNode)await V.nativeServices.preview.show(mathNode,400,250,true);}''')
        check('Approved scope contains a math preview example',page.evaluate('!!mathNode'))
        page.wait_for_function("V.contentEl.querySelector('.kg-native-preview-body .math, .kg-native-preview-body mjx-container, .kg-native-preview-body .MathJax')",timeout=15000)
        check('Real note formulas render with host MarkdownRenderer',True)
        page.evaluate('''async()=>{V.nativeServices.preview.hide();window.H=V.graph.data.nodes.find(n=>n.kind==='heading');await V.nativeServices.openNote(H);}''')
        check('Real heading navigation reaches exact source line',page.evaluate('app.workspace.activeLeaf.view.file?.path===H.path && app.workspace.activeLeaf.getEphemeralState().cursor?.from.line===H.line-1'))
        page.evaluate('app.workspace.revealLeaf(V.leaf)')
        page.evaluate('''async()=>{window.before=V.graph.captureState();await app.vault.create('Science and Tech/__kg_trial_probe__.md','# Trial probe\\nSynthetic acceptance note; removed after test.\\n');}''')
        page.wait_for_function("V.buildState.phase==='ready' && V.graph.data.meta.note_count===96")
        check('Trial copy create event rebuilds and preserves view state',page.evaluate('JSON.stringify(V.graph.captureState())===JSON.stringify(before)'))
        page.evaluate("async()=>{await app.vault.delete(app.vault.getAbstractFileByPath('Science and Tech/__kg_trial_probe__.md'));}")
        page.wait_for_function("V.buildState.phase==='ready' && V.graph.data.meta.note_count===95")
        check('Trial copy deletion restores 95 notes',True)
        page.evaluate('''async()=>{const d=structuredClone(P.savedData);d.settings.debounceMs=500;await P.saveGraphSettings(d);}''')
        page.wait_for_function("V.buildState.phase==='ready'")
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function("window.app?.workspace?.layoutReady && app.plugins.plugins['knowledge-graph-smoke']?.graphSettings")
        page.evaluate("window.P=app.plugins.plugins['knowledge-graph-smoke']")
        check('Trial settings survive reload with confirmed include scope',page.evaluate("P.graphSettings.debounceMs===500 && P.pipelineSettings.config.include.length===2 && P.pipelineSettings.config.include.includes('Science and Tech/**') && P.pipelineSettings.config.include.includes('Literature History Philosophy/**')"))
        page.evaluate("async()=>{await P.openGraph('vault',true);window.V=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view;}")
        page.wait_for_function("V.buildState.phase==='ready'")
        check('No uncaught real-trial runtime errors',not errors,errors)
        page.screenshot(path=str(OUT/'real-trial-final.png'))
    finally:
        page.evaluate('''async()=>{if(window.originalRead)app.vault.cachedRead=originalRead;const f=app.vault.getAbstractFileByPath('Science and Tech/__kg_trial_probe__.md');if(f)await app.vault.delete(f);}''')
check('Copied Markdown content is unchanged after trial',all(hashlib.sha256((TRIAL/r['path']).read_bytes()).hexdigest()==r['sha256'] for r in MANIFEST['notes']))
print(json.dumps({'ok':len(RESULTS),'fail':sum(not r['pass'] for r in RESULTS)}))
