"""Integration checks against the isolated, real Obsidian instance on localhost."""
import base64
import json
import re
from pathlib import Path
import sys
import time
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.local/evidence'
SOURCE = Path(r'D:\obsidian_vault\knowledge-graph')
RESULTS = []
VIEW = 'knowledge-graph-smoke-view'

def check(name, condition, detail=None):
    row = {'name': name, 'pass': bool(condition), 'detail': detail}
    RESULTS.append(row)
    (OUT / 'smoke-results.json').write_text(json.dumps(RESULTS, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(row, ensure_ascii=False), flush=True)
    if not condition:
        raise AssertionError(name)

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp('http://127.0.0.1:9237')
    context = browser.contexts[0]
    print('PAGES', [(pg.url, pg.title()) for pg in context.pages], flush=True)
    page = next(pg for pg in context.pages if 'app://obsidian.md' in pg.url)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.wait_for_function('window.app && app.workspace && app.workspace.layoutReady', timeout=60000)
    check('Isolated test vault', page.evaluate('app.vault.getName()') == 'test-vault')
    if '--reload-plugin' in sys.argv:
        # Reload the isolated page to also discard any keyboard scope left by an older bundle.
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function('window.app && app.workspace && app.workspace.layoutReady', timeout=60000)
    print('PLUGINS', page.evaluate('Object.keys(app.plugins.plugins)'), flush=True)
    page.wait_for_function("app.plugins.plugins['knowledge-graph-smoke']", timeout=20000)
    # A fresh profile may show the community-plugin settings panel at startup.
    if page.locator('.modal-container').count():
        page.keyboard.press('Escape')
        page.wait_for_timeout(250)
    page.evaluate("() => { for (const type of ['knowledge-graph-smoke-view','knowledge-graph-vault-view']) for (const leaf of app.workspace.getLeavesOfType(type)) leaf.detach(); }")
    page.evaluate("app.plugins.plugins['knowledge-graph-smoke'].openGraph()")
    page.wait_for_selector('[data-smoke-ready="true"]', timeout=15000)
    page.evaluate("window.__smokeView = app.workspace.getLeavesOfType('knowledge-graph-smoke-view')[0].view")
    page.wait_for_function('__smokeView.graph.renderer.stats.painted > 0')
    read = lambda expr: page.evaluate('() => { const v = __smokeView; const R = v.graph.renderer; return (' + expr + '); }')
    check('Native ItemView canvas, no iframe', read("v.contentEl.querySelector('iframe') === null && !!v.host.shadowRoot.getElementById('cv')"))
    check('No host globals', page.evaluate('window.KG === undefined && window.createRenderer === undefined'))
    check('Host keyboard scope preserved', read("v.scope == null || typeof v.scope.handleKey === 'function'"))
    check('Snapshot loaded', read('v.graph.data.nodes.length') == 3515, read('v.graph.data.nodes.length'))
    check('Pixels rendered', read('R.stats.painted > 0 && R.stats.labels > 0'), read('({painted:R.stats.painted,labels:R.stats.labels,edges:R.stats.edges})'))
    cv = page.locator('.kg-smoke-host').first.locator('#cv')
    page.mouse.move(1, 1)
    page.wait_for_timeout(1200)
    page.screenshot(path=str(OUT / 'obsidian-home.png'))
    box = cv.bounding_box()
    x, y = box['x'] + box['width'] * .6, box['y'] + box['height'] * .5
    before = read('R.camera.zoom')
    page.mouse.move(x, y)
    page.mouse.wheel(0, -600)
    page.wait_for_timeout(400)
    check('Wheel zoom', read('R.camera.zoom') > before, {'before': before, 'after': read('R.camera.zoom')})
    before = read('({x:R.camera.panX,y:R.camera.panY})')
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + 100, y + 50, steps=8)
    page.mouse.up()
    after = read('({x:R.camera.panX,y:R.camera.panY})')
    check('Drag pan', abs(after['x'] - before['x']) > 50, {'before': before, 'after': after})
    page.screenshot(path=str(OUT / 'obsidian-zoom.png'))
    size = read('R.size()')
    dpr = page.evaluate('devicePixelRatio')
    backing = cv.evaluate('(el) => [el.width,el.height]')
    check('DPR backing dimensions', backing == [round(v * dpr) for v in size], {'css': size, 'backing': backing, 'dpr': dpr})

    # Independent page at exactly the same canvas dimensions: source camera + pixels.
    # Run the untouched standalone page in the same Electron engine for pixel QA.
    # A separate Chrome binary uses different rasterization; that is not a host-adapter test.
    # This temporary reference iframe belongs to the test only, never the plugin view.
    reference_html = (SOURCE / 'dist/knowledge-graph.html').read_text(encoding='utf-8')
    frozen_renderer = (ROOT / 'upstream/render.js').read_text(encoding='utf-8')
    check('Reference renderer matches frozen source', frozen_renderer in reference_html)
    snapshot = (ROOT / '.local/smoke-payload.json').read_text(encoding='utf-8')
    original_payload = json.loads(re.search(r'<script type="application/json" id="graph-data">(.*?)</script>', reference_html, re.S).group(1))
    (OUT / 'reference-snapshot.json').write_text(json.dumps({
        'pluginGenerated': json.loads(snapshot)['meta'].get('generated'),
        'upstreamHtmlGenerated': original_payload['meta'].get('generated'),
        'sameSnapshotBeforeNormalization': original_payload == json.loads(snapshot),
        'comparison': 'Untouched upstream renderer and app with the frozen plugin payload'}, indent=2), encoding='utf-8')
    reference_html = re.sub(r'(<script type="application/json" id="graph-data">).*?(</script>)',
        lambda m: m.group(1) + snapshot.replace('<', '\\u003c') + m.group(2), reference_html, count=1, flags=re.S)
    page.evaluate("""({html,width,height}) => {
      document.getElementById('kg-test-reference')?.remove();
      const frame=document.createElement('iframe'); frame.id='kg-test-reference';
      frame.name='kg-test-reference'; frame.style.cssText='position:fixed;left:-10000px;top:0;border:0';
      frame.style.width=width+'px'; frame.style.height=height+'px';
      frame.srcdoc=html; document.body.append(frame);
    }""", {'html': reference_html, 'width': size[0], 'height': size[1]})
    reference = page.locator('#kg-test-reference').element_handle().content_frame()
    reference.wait_for_function('window.KG && KG.renderer.stats.painted > 0')
    # draw() re-evaluates the last pointer on every frame; leave the canvas first.
    page.mouse.move(1, 1)
    reference.evaluate("() => { KG.renderer.selected=null; KG.renderer.hover=null; KG.renderer.resetView(); document.getElementById('toast').classList.remove('show'); }")
    page.evaluate("() => { const R=__smokeView.graph.renderer; R.selected=null; R.hover=null; R.resetView(); }")
    reference.wait_for_timeout(700)
    page.wait_for_timeout(700)
    rc = reference.evaluate('({zoom:KG.camera.zoom,panX:KG.camera.panX,panY:KG.camera.panY})')
    pc = read('({zoom:R.camera.zoom,panX:R.camera.panX,panY:R.camera.panY})')
    check('Same-size home camera', all(abs(rc[k] - pc[k]) < 1e-8 for k in rc), {'source': rc, 'plugin': pc})
    ref_png = reference.locator('#cv').evaluate('(cv) => cv.toDataURL()')
    plugin_png = cv.evaluate('(cv) => cv.toDataURL()')
    (OUT / 'reference-canvas.png').write_bytes(base64.b64decode(ref_png.split(',')[1]))
    (OUT / 'plugin-canvas.png').write_bytes(base64.b64decode(plugin_png.split(',')[1]))
    from PIL import Image, ImageChops
    ref_image = Image.open(OUT / 'reference-canvas.png').convert('RGBA')
    plugin_image = Image.open(OUT / 'plugin-canvas.png').convert('RGBA')
    difference = ImageChops.difference(ref_image, plugin_image)
    changed = sum(1 for pixel in difference.getdata() if max(pixel) > 3)
    fraction = changed / (ref_image.width * ref_image.height)
    check('Same-size canvas pixels', fraction < .01, {'fractionDifferentOver3': fraction, 'exactEqual': ref_png == plugin_png})
    page.evaluate("document.getElementById('kg-test-reference').remove()")

    # A host input must not receive graph hotkeys; graph's own input still works.
    before = read('R.camera.panX')
    page.evaluate("() => { const input=document.createElement('input'); input.id='smoke-host-input'; input.style.position='fixed'; input.style.top='0'; document.body.append(input); input.focus(); }")
    page.keyboard.press('ArrowRight')
    page.wait_for_timeout(150)
    check('Host keyboard isolation', read('R.camera.panX') == before)
    page.evaluate("document.getElementById('smoke-host-input').remove()")
    search = page.locator('.kg-smoke-host').first.locator('#search')
    search.fill('Science')
    page.wait_for_timeout(250)
    check('Scoped search', read('v.graph.state().searchMatches') > 0)
    search.fill('')
    page.wait_for_timeout(200)

    # Multiple native leaves exercise ResizeObserver and per-view camera/insets.
    initial_size = read('R.size()')
    page.evaluate("async () => { window.__secondLeaf=app.workspace.getLeaf('split','vertical'); await __secondLeaf.setViewState({type:'knowledge-graph-smoke-view',active:true}); }")
    page.wait_for_function('__secondLeaf.view.graph && __secondLeaf.view.graph.renderer.stats.painted > 0')
    page.wait_for_timeout(400)
    check('Split pane resize', read('R.size()[0]') < initial_size[0], {'before': initial_size, 'after': read('R.size()')})
    second_zoom = page.evaluate('__secondLeaf.view.graph.camera.zoom')
    page.evaluate('__smokeView.graph.renderer.zoomBy(1.2)')
    page.wait_for_timeout(400)
    check('Independent view cameras', page.evaluate('__secondLeaf.view.graph.camera.zoom') == second_zoom)
    second_host = page.locator('.kg-smoke-host').nth(1)
    second_host.locator('#reset').click()
    check('Narrow pane reset remains reachable', page.evaluate("() => { const s=__secondLeaf.view.host.shadowRoot; const a=s.getElementById('topbar').getBoundingClientRect(); const b=s.getElementById('reset').getBoundingClientRect(); return b.left>=a.left-1 && b.right<=a.right+1; }"))
    for host in page.locator('.kg-smoke-host').all():
        if host.locator('#legend-toggle').get_attribute('aria-expanded') == 'true':
            host.locator('#legend-toggle').click()
    check('Collapsed legend hides its body', page.locator('.kg-smoke-host').first.locator('#legend-body').evaluate("el => getComputedStyle(el).display") == 'none')
    page.mouse.move(1, 1)
    page.wait_for_timeout(400)
    page.screenshot(path=str(OUT / 'obsidian-split.png'))
    page.evaluate("() => { window.__closedScope=__secondLeaf.view.graphHostScope; __secondLeaf.detach(); }")
    page.wait_for_timeout(300)
    closed = page.evaluate('__closedScope.diagnostics()')
    check('Close clears frames, timers, observers and listeners', closed['disposed'] and all(closed[k] == 0 for k in ['frames','timers','observers','listeners']), closed)
    page.evaluate("async () => { await app.workspace.revealLeaf(__smokeView.leaf); __smokeView.graph.renderer.resetView(); window.__blank=app.workspace.getLeaf('tab'); await __blank.setViewState({type:'empty',active:true}); await app.workspace.revealLeaf(__blank); }")
    page.wait_for_timeout(300)
    hidden = read('v.graphHostScope.diagnostics()')
    page.wait_for_timeout(350)
    hidden_after = read('v.graphHostScope.diagnostics()')
    check('Hidden view pauses animation', not hidden['active'] and hidden['frameCount'] == hidden_after['frameCount'], hidden_after)
    page.evaluate('app.workspace.revealLeaf(__smokeView.leaf)')
    page.wait_for_timeout(400)
    check('Hidden view resumes', read('v.graphHostScope.diagnostics().active'))
    page.evaluate('__blank.detach()')
    page.evaluate("() => { window.__finalScope=__smokeView.graphHostScope; __smokeView.leaf.detach(); }")
    page.wait_for_timeout(300)
    check('Last view cleanup', page.evaluate('__finalScope.diagnostics().disposed && __finalScope.diagnostics().listeners===0'))
    page.evaluate("app.plugins.plugins['knowledge-graph-smoke'].openGraph()")
    page.wait_for_selector('[data-smoke-ready="true"]')
    check('Reopen view', page.locator('[data-smoke-ready="true"]').count() == 1)
    check('No uncaught page errors', not errors, errors)
    page.mouse.move(1, 1)
    page.wait_for_timeout(3500)
    page.screenshot(path=str(OUT / 'obsidian-final.png'))
    (OUT / 'smoke-results.json').write_text(json.dumps(RESULTS, ensure_ascii=False, indent=2), encoding='utf-8')
    print('SMOKE_RESULT', json.dumps({'ok': len(RESULTS), 'fail': 0}), flush=True)
