"""ME-A3: real disk, ItemView rebuilds and keyboard commands in a synthetic vault only."""
from pathlib import Path
import json
import sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.local/evidence/layout-state-0.0.6';OUT.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as p:
    browser=p.chromium.connect_over_cdp('http://127.0.0.1:9242',timeout=10000)
    page=next(pg for pg in browser.contexts[0].pages if 'app://obsidian.md' in pg.url)
    assert Path(page.evaluate('app.vault.adapter.basePath')).resolve()==(ROOT/'test-vault-layout-fix').resolve()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    def check(name,expr):
        ok=page.evaluate(expr) if isinstance(expr,str) else expr
        results.append({'name':name,'pass':bool(ok)})
        (OUT/'native-state-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
        print(json.dumps(results[-1]),flush=True)
        if not ok:page.screenshot(path=str(OUT/'state-failure.png'))
        assert ok,name
    def bind():
        page.evaluate("""()=>{
          window.P=app.plugins.plugins['knowledge-graph-smoke'];
          window.V=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view;window.R=V.graph.renderer;
          app.workspace.setActiveLeaf(V.leaf,{focus:true});
          if(!V.host.shadowRoot.getElementById('legend').classList.contains('collapsed'))V.host.shadowRoot.getElementById('legend-toggle').click();
          window.positions=()=>R.NODES.map(n=>[n.id,n.x,n.y]);
          window.near=(a,b)=>a.length===b.length&&a.every((n,i)=>n[0]===b[i][0]&&Math.hypot(n[1]-b[i][1],n[2]-b[i][2])<1e-7);
        }""")
    def settled():page.evaluate('async()=>await P.layoutStore.settled()')
    if '--prepare-only' in sys.argv:
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function("app?.plugins?.plugins['knowledge-graph-smoke']&&app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0]?.view.graph")
        bind();page.locator('#layout-mode').click();page.evaluate('R.zoomToDepth(2)');page.wait_for_timeout(800)
        runtime=page.evaluate("({plugin:P.manifest.version,vault:app.vault.adapter.basePath,canUndo:P.layoutStore.state().canUndo,groups:Object.keys(P.savedData.layoutOverrides.groups).length})")
        assert runtime['plugin']=='0.0.6' and not runtime['canUndo']
        (OUT/'trial-runtime.json').write_text(json.dumps(runtime,indent=2),encoding='utf8')
        page.screenshot(path=str(OUT/'persistence-native.png'))
        print(json.dumps(runtime),flush=True);browser.close();sys.exit(0)
    def drag(node_id=None,release=True):
        page.evaluate("""id=>{window.H=id?R.byId.get(id):R.NODES.find(n=>n.kind==='heading'&&n.title==='Second');R.selected=H.id;R.setEditMode(true);R.focusOn(H.id,1.25,0);}""",node_id)
        page.wait_for_timeout(130)
        at=page.evaluate("()=>{const b=V.host.shadowRoot.getElementById('cv').getBoundingClientRect();return{x:b.left+H.x*R.camera.zoom+R.camera.panX,y:b.top+H.y*R.camera.zoom+R.camera.panY}}")
        page.mouse.move(at['x'],at['y']);page.mouse.down();page.mouse.move(at['x']+30,at['y']+20,steps=14)
        if release:page.mouse.up();settled()
    try:
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function("app?.workspace?.layoutReady && app.plugins.plugins['knowledge-graph-smoke']")
        backup=page.evaluate("async()=>await app.plugins.plugins['knowledge-graph-smoke'].loadData()")
        (OUT/'synthetic-config-before-state-test.json').write_text(json.dumps(backup,ensure_ascii=False,indent=2),encoding='utf8')
        page.evaluate("""async()=>{
          window.P=app.plugins.plugins['knowledge-graph-smoke'];if(P.manifest.version!=='0.0.6')throw Error('Wrong runtime');
          for(const type of ['knowledge-graph-vault-view','knowledge-graph-smoke-view'])for(const leaf of app.workspace.getLeavesOfType(type))leaf.detach();
          await P.layoutStore.command({},'reset-all');
          const folder='__kg_persistence__';if(!app.vault.getAbstractFileByPath(folder))await app.vault.createFolder(folder);
          const previousRename=app.vault.getAbstractFileByPath(folder+'/Renamed.md');if(previousRename)await app.vault.delete(previousRename);
          for(let i=0;i<4;i++){const path=folder+'/State'+i+'.md',text='# First\\n## Child\\nBody text.\\n# Second\\nSecond body.\\n# Third\\nThird body.';const file=app.vault.getAbstractFileByPath(path);if(file)await app.vault.modify(file,text);else await app.vault.create(path,text);}
          const draft=structuredClone(P.savedData);draft.pipeline.config.include=[folder+'/**'];draft.settings.autoUpdate=true;draft.settings.debounceMs=150;
          draft.persistenceTest={preserve:'synthetic sentinel'};await P.saveGraphSettings(draft);await P.openGraph('vault',true);
        }""")
        bind();page.locator('#layout-mode').click();page.evaluate('window.automatic=positions()')
        drag('__kg_persistence__/State0#Second')
        check('Mouse release saves final group to real plugin data.json',"async()=>{window.saved=positions();const d=await P.loadData();return !near(saved,automatic)&&Object.keys(d.layoutOverrides.groups).length===1&&d.persistenceTest.preserve==='synthetic sentinel'}")
        page.locator('#layout-undo').click();settled()
        check('Undo button restores whole automatic group',"near(positions(),automatic)")
        page.locator('#layout-redo').click();settled()
        check('Redo button restores saved geometry',"near(positions(),saved)")
        page.keyboard.press('Control+z');settled()
        check('Native Ctrl+Z undoes in graph scope',"near(positions(),automatic)")
        page.keyboard.press('Control+Shift+z');settled()
        check('Native Ctrl+Shift+Z redoes in graph scope',"near(positions(),saved)")
        page.evaluate('window.revisionBefore=P.layoutStore.state().revision')
        drag('__kg_persistence__/State0#Second',False);page.keyboard.press('Escape');page.mouse.up();settled()
        check('Esc cancellation neither saves nor adds history',"near(positions(),saved)&&P.layoutStore.state().revision===revisionBefore")
        page.evaluate('async()=>await V.rebuild()');bind()
        check('Manual rebuild retains committed positions',"near(positions(),saved)")
        page.evaluate("async()=>{window.oldGraphRevision=V.generation;const f=app.vault.getAbstractFileByPath('__kg_persistence__/State0.md');await app.vault.modify(f,(await app.vault.read(f)).replace('Body text.','Body text.\\nExtra body line.'));}")
        page.wait_for_function("V.generation>oldGraphRevision&&V.contentEl.dataset.buildPhase==='ready'&&!V.contentEl.dataset.pipelineUpdating")
        bind();check('Automatic rebuild after body edit keeps layout',"near(positions(),saved)")
        page.evaluate("async()=>{await V.leaf.detach();await P.openGraph('vault',true)}");bind()
        check('Close and reopen restores disk-backed layout',"near(positions(),saved)")
        expected=page.evaluate('saved')
        page.reload(wait_until='domcontentloaded');page.wait_for_function("app?.plugins?.plugins['knowledge-graph-smoke']&&app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0]?.view.graph")
        bind();page.evaluate('v=>window.saved=v',expected)
        check('Application reload restores layout from data.json',"near(positions(),saved)&&!P.layoutStore.state().canUndo")
        page.locator('#layout-mode').click()
        # An old settings form must not erase newer drags.
        page.evaluate('window.staleDraft=structuredClone(P.savedData)');drag('__kg_persistence__/State0#Second')
        page.evaluate('async()=>{window.saved=positions();window.layoutJSON=JSON.stringify(P.savedData.layoutOverrides);staleDraft.settings.debounceMs=180;await P.saveGraphSettings(staleDraft)}')
        page.wait_for_function("V.contentEl.dataset.buildPhase==='ready'&&!V.contentEl.dataset.pipelineUpdating")
        bind();check('Settings saved from stale form preserve latest layout',"near(positions(),saved)&&JSON.stringify(P.savedData.layoutOverrides)===layoutJSON")
        # Two views share a store. A failed save must rollback both; successful writes broadcast.
        page.evaluate("""async()=>{window.secondLeaf=app.workspace.getLeaf('split');await secondLeaf.setViewState({type:'knowledge-graph-vault-view',active:false});window.secondView=secondLeaf.view;await app.workspace.revealLeaf(V.leaf);}""")
        page.wait_for_timeout(300);bind()
        drag('__kg_persistence__/State0#Second');page.evaluate('window.saved=positions()')
        check('Two live views share committed positions',"near(secondView.graph.renderer.NODES.map(n=>[n.id,n.x,n.y]),saved)")
        page.evaluate("()=>{window.realSave=P.saveData.bind(P);P.saveData=async()=>{throw Error('synthetic disk full')};}")
        drag('__kg_persistence__/State0#Second')
        check('Disk error rolls back both views and displays failure',"near(positions(),saved)&&near(secondView.graph.renderer.NODES.map(n=>[n.id,n.x,n.y]),saved)&&V.host.shadowRoot.getElementById('layout-status').textContent.includes('保存失败')&&!P.layoutStore.state().busy")
        page.evaluate('()=>{P.saveData=realSave;}')
        # Hold an actual disk write open and attempt another view command.
        page.evaluate("()=>{P.saveData=data=>new Promise((resolve,reject)=>{window.finishSave=()=>realSave(data).then(resolve,reject)});}")
        drag('__kg_persistence__/State0#Second',False);page.mouse.up()
        page.wait_for_function('typeof finishSave==="function"')
        page.evaluate("secondView.graph.renderer.setEditMode(true);secondView.graph.layoutCommand('reset-all')")
        check('Pending write rejects conflicting view command',"P.layoutStore.state().busy&&secondView.host.shadowRoot.getElementById('layout-status').textContent.includes('另一视图')")
        page.evaluate('async()=>{await finishSave();await P.layoutStore.settled();P.saveData=realSave}')
        page.evaluate('window.saved=positions()')
        check('Delayed write publishes once to both views',"near(secondView.graph.renderer.NODES.map(n=>[n.id,n.x,n.y]),saved)")
        page.evaluate('async()=>await secondLeaf.detach()');bind()
        page.evaluate("async()=>{window.oldGraphRevision=V.generation;await app.vault.rename(app.vault.getAbstractFileByPath('__kg_persistence__/State0.md'),'__kg_persistence__/Renamed.md')}")
        page.wait_for_function("V.generation>oldGraphRevision&&V.contentEl.dataset.buildPhase==='ready'&&!V.contentEl.dataset.pipelineUpdating");bind()
        check('Note rename preserves compatible heading layout and clears history',"!P.layoutStore.state().canUndo&&!V.host.shadowRoot.getElementById('layout-status').textContent.includes('使用自动布局')&&Object.keys(P.savedData.layoutOverrides.groups).some(k=>k.includes('Renamed.md'))")
        page.locator('#layout-mode').click();page.evaluate("R.selected='__kg_persistence__/Renamed#Second'")
        page.locator('#layout-reset-group').click();settled()
        check('Group reset removes only selected sibling override',"Object.keys(P.savedData.layoutOverrides.groups).length===0")
        page.locator('#layout-undo').click();settled()
        check('Group reset can be undone',"Object.keys(P.savedData.layoutOverrides.groups).length===1")
        page.evaluate("async()=>{window.oldGraphRevision=V.generation;const f=app.vault.getAbstractFileByPath('__kg_persistence__/Renamed.md');await app.vault.modify(f,(await app.vault.read(f))+'\\n# New Heading\\nNew body.');}")
        page.wait_for_function("V.generation>oldGraphRevision&&V.contentEl.dataset.buildPhase==='ready'&&!V.contentEl.dataset.pipelineUpdating");bind()
        check('Structural changes report automatic fallback with no stale undo',"V.host.shadowRoot.getElementById('layout-status').textContent.includes('使用自动布局')&&!P.layoutStore.state().canUndo&&R.NODES.every(n=>Number.isFinite(n.x+n.y))")
        page.locator('#layout-mode').click();page.locator('#layout-reset-all').click();settled()
        check('Full reset removes stored overrides durably',"async()=>Object.keys((await P.loadData()).layoutOverrides.groups).length===0")
        page.wait_for_timeout(300)
        check('Layout buttons remain reachable above the open detail panel',"()=>{const s=V.host.shadowRoot;return ['layout-mode','layout-undo','layout-redo','layout-reset-group','layout-reset-all'].every(id=>{const b=s.getElementById(id),r=b.getBoundingClientRect();return s.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b})}")
        page.evaluate('V.graph.dismiss();R.zoomToDepth(2)')
        page.wait_for_timeout(5500)
        page.screenshot(path=str(OUT/'persistence-native.png'))
        check('No native runtime errors',not errors)
    finally:
        page.keyboard.up('Control');page.mouse.up()
        page.evaluate("()=>{if(window.realSave&&window.P)P.saveData=realSave;}")
    browser.close()
