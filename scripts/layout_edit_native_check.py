"""ME-A2 native interaction check; leaves synthetic layout examples in test-vault."""
from pathlib import Path
import json
import sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'.local/evidence/layout-state-0.0.6';OUT.mkdir(parents=True,exist_ok=True)
VAULT='test-vault-layout-fix' if '--isolated-fix' in sys.argv else 'test-vault'
PORT=9242 if '--isolated-fix' in sys.argv else 9238
results=[]
with sync_playwright() as p:
    browser=p.chromium.connect_over_cdp(f'http://127.0.0.1:{PORT}',timeout=10000)
    page=next(pg for pg in browser.contexts[0].pages if 'app://obsidian.md' in pg.url)
    assert Path(page.evaluate('app.vault.adapter.basePath')).resolve()==(ROOT/VAULT).resolve()
    page.reload(wait_until='domcontentloaded')
    if '--isolated-fix' in sys.argv:
        page.wait_for_function('window.app?.workspace?.layoutReady')
        page.wait_for_timeout(500)
        trust=page.get_by_text('Trust author and enable plugins',exact=True)
        if trust.is_visible():trust.click()
        page.evaluate("async()=>{await app.plugins.enablePluginAndSave('knowledge-graph-smoke')}")
    page.wait_for_function("window.app?.workspace?.layoutReady && app.plugins.plugins['knowledge-graph-smoke']")
    if page.locator('.modal-container').count():page.keyboard.press('Escape')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.evaluate('''async()=>{
      window.P=app.plugins.plugins['knowledge-graph-smoke'];window.originalPipeline=P.pipelineSettings;window.originalGraphSettings=P.graphSettings;
      if(P.manifest.version!=='0.0.6')throw new Error('Wrong runtime version');
      const base=app.workspace.getLeaf(false);await base.setViewState({type:'empty',active:true});
      for(const type of ['knowledge-graph-vault-view','knowledge-graph-smoke-view'])for(const leaf of app.workspace.getLeavesOfType(type))leaf.detach();
      const root='__kg_layout_trial__';if(!app.vault.getAbstractFileByPath(root))await app.vault.createFolder(root);
      for(let i=0;i<8;i++){const path=root+'/Layout'+i+'.md';if(!app.vault.getAbstractFileByPath(path))await app.vault.create(path,`# Concept\nNative preview $E=mc^2$.\n[[Layout${(i+1)%8}#Example]]\n## Child\nNested content.\n# Example\nPreview marker for layout testing.\n# Summary\nAnother sibling.`);}
      P.pipelineSettings={config:{include:[root+'/**'],preview:{enabled:true}}};P.graphSettings={...P.graphSettings,autoUpdate:false};
      await app.workspace.revealLeaf(base);await P.openGraph('vault',true);
      window.V=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view;window.R=V.graph.renderer;
      app.workspace.setActiveLeaf(V.leaf,{focus:true});
      if(!V.host.shadowRoot.getElementById('legend').classList.contains('collapsed'))V.host.shadowRoot.getElementById('legend-toggle').click();
      window.H=R.NODES.find(n=>n.kind==='heading'&&n.title==='Example');
      window.positions=()=>R.NODES.map(n=>[n.id,n.x,n.y]);R.focusOn(H.id,1.25,0);
    }''')
    page.wait_for_timeout(300)
    def check(name,expression):
        ok=page.evaluate(expression) if isinstance(expression,str) else expression
        if not ok:
            page.screenshot(path=str(OUT/'native-failure.png'))
            print(json.dumps(page.evaluate("({preview:V.graph.previewState(),active:app.workspace.activeLeaf===V.leaf,diagnostics:V.session.diagnostics(),heading:H.id,status:V.host.shadowRoot.getElementById('layout-status').textContent})")),flush=True)
        row={'name':name,'pass':bool(ok)};results.append(row);(OUT/'native-layout-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(row),flush=True);assert ok,name
    def point():return page.evaluate("()=>{const r=V.host.shadowRoot.getElementById('cv').getBoundingClientRect(),c=R.camera;return {x:r.left+H.x*c.zoom+c.panX,y:r.top+H.y*c.zoom+c.panY}}")
    def start():
        a=point();page.mouse.move(a['x'],a['y']);page.mouse.down();page.mouse.move(a['x']+40,a['y']+28,steps=16);page.wait_for_timeout(150)
    try:
        check('Runtime candidate 0.0.6 in isolated vault',"P.manifest.version==='0.0.6'")
        page.locator('#layout-mode').click()
        at=point();page.mouse.move(at['x'],at['y']);page.keyboard.down('Control');page.wait_for_timeout(450)
        check('Ctrl preview works in idle edit mode',"V.graph.previewState().open")
        page.mouse.click(at['x'],at['y']);page.keyboard.up('Control');page.wait_for_timeout(200)
        check('Click still pins native preview',"V.graph.previewState().pinned")
        page.keyboard.press('Escape');page.wait_for_timeout(80)
        check('Idle Escape closes preview and retains graph',"!V.graph.previewState().open && app.workspace.activeLeaf===V.leaf && R.editMode")
        page.evaluate('window.saved=JSON.stringify(positions());window.cam={...R.camera}')
        start();page.keyboard.down('Control');page.wait_for_timeout(300)
        check('Dragging suppresses native preview',"R.layoutDragging && !V.graph.previewState().open && JSON.stringify(positions())!==saved")
        page.keyboard.press('Escape');page.mouse.up();page.keyboard.up('Control');page.wait_for_timeout(100)
        check('Native View.scope Escape cancels whole transaction',"JSON.stringify(positions())===saved && !R.layoutDragging && app.workspace.activeLeaf===V.leaf")
        start();page.mouse.up();page.wait_for_timeout(100)
        check('Release commits display position without camera change',"JSON.stringify(positions())!==saved && JSON.stringify(R.camera)===JSON.stringify(cam)")
        check('Drag release does not open or pin preview',"!V.graph.previewState().open && !V.graph.previewState().pinned")
        at=point();page.mouse.move(at['x'],at['y']);page.keyboard.down('Control');page.wait_for_timeout(450)
        check('Native preview resolves at moved node',"V.graph.previewState().open && R.hitTest(H.x*R.camera.zoom+R.camera.panX,H.y*R.camera.zoom+R.camera.panY)?.id===H.id")
        page.keyboard.up('Control');page.evaluate('window.saved=JSON.stringify(positions())')
        start();page.evaluate("V.host.shadowRoot.getElementById('cv').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,composed:true}))");page.mouse.up()
        check('Pointer cancellation restores position',"JSON.stringify(positions())===saved && !R.layoutDragging")
        start();page.evaluate('window.oldR=R;window.oldSaved=saved;window.rebuildTask=V.rebuild()');page.mouse.up();page.evaluate('async()=>await rebuildTask')
        check('Rebuild cancels old transaction before replacing session',"JSON.stringify(oldR.NODES.map(n=>[n.id,n.x,n.y]))===oldSaved && !oldR.layoutDragging")
        page.evaluate("R=V.graph.renderer;H=R.NODES.find(n=>n.kind==='heading'&&n.title==='Example');R.focusOn(H.id,1.25,0)")
        check('Rebuild exits edit mode while preserving saved geometry',"!R.editMode && R.NODES.every(n=>{const p=JSON.parse(oldSaved).find(a=>a[0]===n.id);return p&&Math.hypot(n.x-p[1],n.y-p[2])<1e-7})")
        page.wait_for_timeout(150);page.screenshot(path=str(OUT/'native-layout.png'))
        page.evaluate(r'''async()=>{
          const folder='__kg_root_layout__';if(!app.vault.getAbstractFileByPath(folder))await app.vault.createFolder(folder);
          for(const path of ['__kg_root_note_A.md','__kg_root_note_B.md',folder+'/Nested.md'])if(!app.vault.getAbstractFileByPath(path))await app.vault.create(path,'# Heading\nSynthetic root movement example.\n## Child\nNested content.');
          P.pipelineSettings={config:{include:['__kg_root_note_*.md',folder+'/**'],preview:{enabled:true}}};
          await V.rebuild();R=V.graph.renderer;H=R.NODES.find(n=>n.kind==='note'&&!n.parent);R.zoomToDepth(1);
        }''')
        page.wait_for_timeout(650);page.locator('#layout-mode').click()
        page.evaluate('window.saved=JSON.stringify(positions());window.rootXY=[H.x,H.y]')
        start();page.mouse.up()
        check('Root note direct drag moves its circle',"Math.hypot(H.x-rootXY[0],H.y-rootXY[1])>0.001")
        page.evaluate('window.saved=JSON.stringify(positions())');start();page.keyboard.press('Escape');page.mouse.up()
        check('Root note Escape restores entire graph',"JSON.stringify(positions())===saved && app.workspace.activeLeaf===V.leaf")
        page.evaluate('H=R.NODES.find(n=>n.kind===\'folder\'&&!n.parent);R.selected=H.id;window.rootXY=[H.x,H.y]')
        print(json.dumps(page.evaluate("()=>{const c=V.host.shadowRoot.getElementById('cv').getBoundingClientRect(),x=H.x*R.camera.zoom+R.camera.panX,y=H.y*R.camera.zoom+R.camera.panY;return {target:H.id,point:[x+c.left,y+c.top],hit:R.hitTest(x,y)?.id,element:V.host.shadowRoot.elementFromPoint(x+c.left,y+c.top)?.outerHTML.slice(0,300),size:[innerWidth,innerHeight]}}")),flush=True)
        start();page.mouse.up()
        print(json.dumps(page.evaluate("({status:V.host.shadowRoot.getElementById('layout-status').textContent,active:R.layoutDragging,selected:R.selected,before:rootXY,after:[H.x,H.y],roots:R.NODES.filter(n=>!n.parent).map(n=>({id:n.id,x:n.x,y:n.y,r:n.r})),radius:V.graph.data.meta.layout_root_radius})")),flush=True)
        check('Root folder direct drag moves its circle',"Math.hypot(H.x-rootXY[0],H.y-rootXY[1])>0.001")
        for kind in ['note','folder']:
            page.evaluate("kind=>{H=R.NODES.find(n=>n.kind===kind&&!n.parent);R.selected=H.id;window.rootXY=[H.x,H.y]}",kind)
            page.wait_for_timeout(100)
            at=page.evaluate("()=>{const h=R.editHandle(),r=V.host.shadowRoot.getElementById('cv').getBoundingClientRect();return {x:r.left+h.x,y:r.top+h.y}}")
            page.mouse.move(at['x'],at['y']);page.mouse.down();page.mouse.move(at['x']+25,at['y']-20,steps=12);page.mouse.up()
            check('Root '+kind+' handle moves circle',"Math.hypot(H.x-rootXY[0],H.y-rootXY[1])>0.001")
        page.screenshot(path=str(OUT/'root-native.png'))
        check('No native runtime errors',not errors)
        (OUT/'runtime.json').write_text(json.dumps(page.evaluate("({plugin:P.manifest.version,obsidian:typeof appVersion==='string'?appVersion:null,vault:app.vault.getName(),nodes:R.NODES.length,edges:R.SEM.length})"),indent=2),encoding='utf8')
    finally:
        page.keyboard.up('Control');page.mouse.up()
        page.evaluate('P.pipelineSettings=originalPipeline;P.graphSettings=originalGraphSettings')
        browser.close()
