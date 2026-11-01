"""Real keyboard regression tests in test-vault only; no daily-vault connection."""
from pathlib import Path
import json
import sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.local/evidence'
OUT.mkdir(parents=True, exist_ok=True)
suffix = '-before' if '--baseline' in sys.argv else ''
results = []

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp('http://127.0.0.1:9238', timeout=10000)
    page = next(pg for pg in browser.contexts[0].pages if 'app://obsidian.md' in pg.url)
    assert Path(page.evaluate('app.vault.adapter.basePath')).resolve() == (ROOT / 'test-vault').resolve(), 'Refusing non-test vault'
    page.reload(wait_until='domcontentloaded')
    page.wait_for_function("window.app?.workspace?.layoutReady && app.plugins.plugins['knowledge-graph-smoke']")
    if page.locator('.modal-container').count():
        page.keyboard.press('Escape')
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.evaluate('''async () => {
        window.modal=null;window.P=app.plugins.plugins['knowledge-graph-smoke'];
        window.savedPipeline=P.pipelineSettings;
        // Keep a live base tab before removing graph leaves; newer Obsidian
        // can otherwise have no tab group to attach the next leaf to.
        window.noteLeaf=app.workspace.getLeaf(false);
        await noteLeaf.setViewState({type:'empty',active:true});
        for(const type of ['knowledge-graph-smoke-view','knowledge-graph-vault-view'])
            for(const leaf of app.workspace.getLeavesOfType(type))leaf.detach();
        const path='__kg_interaction_test__.md';
        window.fixture=app.vault.getAbstractFileByPath(path);
        if(!fixture)fixture=await app.vault.create(path,'# Target\\nSynthetic preview body.\\n## Child\\nChild content.');
        // The preceding lifecycle suite can leave an empty workspace. Reuse or
        // create its base leaf before asking the plugin for an additional tab.
        await noteLeaf.openFile(fixture);await app.workspace.revealLeaf(noteLeaf);
        P.pipelineSettings={config:{include:[path],preview:{enabled:true}}};
        await P.openGraph('vault',true);
        window.V=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view;
        window.outside=document.body.appendChild(document.createElement('button'));
        outside.textContent='Test focus outside graph';outside.style.cssText='position:fixed;left:1px;top:1px;z-index:99999';
        window.H=V.graph.data.nodes.find(n=>n.kind==='heading'&&n.title==='Child');
        V.graph.renderer.focusOn(H.id,1.25);
    }''')
    page.wait_for_timeout(700)

    def point():
        return page.evaluate('''() => {const r=V.host.shadowRoot.getElementById('cv').getBoundingClientRect(),c=V.graph.camera;
            return {x:r.left+H.x*c.zoom+c.panX,y:r.top+H.y*c.zoom+c.panY};}''')

    def move():
        at = point()
        page.mouse.move(at['x'], at['y'])

    def record(name, expression):
        page.wait_for_timeout(250)
        row = {'name': name, 'pass': bool(page.evaluate(expression)), 'state': page.evaluate('''() => ({
            preview:V.graph.previewState(),activeGraph:app.workspace.activeLeaf===V.leaf,
            focus:V.host.shadowRoot.activeElement?.tagName||document.activeElement?.tagName,
            hover:V.graph.renderer.hover,selected:V.graph.renderer.selected})''')}
        results.append(row)
        (OUT / ('interaction-results'+suffix+'.json')).write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf8')
        print(json.dumps(row, ensure_ascii=False), flush=True)

    def reset():
        page.keyboard.up('Control')
        page.evaluate('app.workspace.setActiveLeaf(V.leaf,{focus:true}); V.nativeServices.preview.hide()')
        page.wait_for_timeout(150)

    ready = "V.graph.previewState().open && V.contentEl.querySelector('.kg-native-preview').dataset.ready==='true'"
    try:
        page.evaluate('outside.focus()')
        page.keyboard.down('Control')
        move()
        record('Ctrl held before entering canvas opens native preview without click', ready)
        page.keyboard.up('Control')
        record('Ctrl release outside shadow closes preview and clears modifier', '!V.graph.previewState().open && !V.graph.previewState().ctrl')

        page.mouse.move(2,2)
        page.evaluate('outside.focus()')
        move()
        page.keyboard.down('Control')
        record('Stationary pointer then Ctrl opens without canvas focus', ready)
        page.keyboard.up('Control')

        at = point()
        page.mouse.click(at['x'],at['y'])
        page.keyboard.down('Control')
        record('Click canvas then Ctrl still opens native preview', ready)
        page.keyboard.up('Control')
        page.keyboard.press('Escape')
        record('Escape closes selection and keeps graph tab active', 'app.workspace.activeLeaf===V.leaf && V.graph.renderer.selected===null && !V.graph.previewState().open')

        reset()
        page.evaluate("V.graph.select(H.id,false);V.host.shadowRoot.getElementById('search').focus()")
        page.keyboard.press('Escape')
        record('Escape from search keeps graph active and exits search', "app.workspace.activeLeaf===V.leaf && V.host.shadowRoot.activeElement?.id!=='search'")

        reset()
        page.evaluate('outside.focus()')
        page.keyboard.press('Escape')
        record('Escape after revealing graph without canvas focus keeps graph tab', 'app.workspace.activeLeaf===V.leaf')

        reset()
        move()
        page.keyboard.down('Control')
        page.wait_for_timeout(300)
        at = point()
        page.mouse.click(at['x'],at['y'])
        page.keyboard.up('Control')
        record('Click during hover pins native preview after Ctrl release', 'V.graph.previewState().open && V.graph.previewState().pinned')
        page.evaluate("V.contentEl.querySelector('.kg-native-preview').focus()")
        page.keyboard.press('Escape')
        record('Escape in pinned native preview closes it without leaving graph', '!V.graph.previewState().open && app.workspace.activeLeaf===V.leaf')

        reset()
        move()
        page.keyboard.down('Control')
        page.mouse.move(2,2)
        page.keyboard.up('Control')
        move()
        record('Returning without Ctrl does not reopen stale preview', '!V.graph.previewState().open && !V.graph.previewState().ctrl')

        reset()
        page.evaluate("V.host.shadowRoot.getElementById('search').focus()")
        search_box = page.locator('.kg-smoke-host #search').bounding_box()
        page.mouse.move(search_box['x']+10, search_box['y']+10)
        page.keyboard.down('Control')
        record('Ctrl over graph controls does not preview a stale canvas target', '!V.graph.previewState().open')
        page.keyboard.up('Control')

        page.evaluate('outside.focus()')
        move()
        for _ in range(10):
            page.keyboard.down('Control')
            page.wait_for_function(ready)
            page.keyboard.up('Control')
            page.wait_for_function('!V.graph.previewState().open')
        record('Ten consecutive hover cycles release all Markdown components', 'V.nativeServices.diagnostics().active===0 && V.nativeServices.diagnostics().created===V.nativeServices.diagnostics().unloaded')

        page.keyboard.down('Control')
        page.wait_for_function(ready)
        page.evaluate("window.dispatchEvent(new Event('blur'))")
        record('Window blur closes temporary preview and clears Ctrl', '!V.graph.previewState().open && !V.graph.previewState().ctrl')
        page.keyboard.up('Control')

        reset()
        page.evaluate("V.graph.select(H.id,false);app.commands.executeCommandById('command-palette:open')")
        page.wait_for_selector('.modal-container')
        page.keyboard.press('Escape')
        record('Modal Escape remains owned by the modal', "!document.querySelector('.modal-container') && V.graph.renderer.selected===H.id && app.workspace.activeLeaf===V.leaf")

        page.evaluate('async () => { await app.workspace.revealLeaf(noteLeaf); app.workspace.setActiveLeaf(noteLeaf,{focus:true}); }')
        page.wait_for_function('app.workspace.activeLeaf===noteLeaf')
        page.evaluate('noteLeaf.view.editor.focus()')
        page.keyboard.press('Escape')
        record('Escape in note tab does not invoke hidden graph dismissal', 'V.graph.renderer.selected===H.id')
        record('No uncaught runtime errors', 'true')
        results[-1]['pass'] = not errors
        results[-1]['errors'] = errors
        reset()
        move()
        page.keyboard.down('Control')
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / ('interaction-native'+suffix+'.png')))
    finally:
        page.keyboard.up('Control')
        page.evaluate('''async () => {
            modal?.close();outside.remove();V.leaf.detach();noteLeaf.detach();P.pipelineSettings=savedPipeline;
        }''')
        # Keep the synthetic fixture for repeatable testing; never edit existing notes.
        (OUT / ('interaction-results'+suffix+'.json')).write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf8')
        browser.close()

failed = sum(not row['pass'] for row in results)
print(f'INTERACTION_CHECK: {len(results)-failed} passed / {failed} failed', flush=True)
sys.exit(bool(failed))
