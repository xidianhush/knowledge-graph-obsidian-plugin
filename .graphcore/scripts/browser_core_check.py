"""Shared browser adapter and bare GraphCore, with no Obsidian runtime."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import threading
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.local/evidence'
RESULTS = []
def check(name, passed, detail=None):
    row = {'name':name, 'pass':bool(passed), 'detail':detail}
    RESULTS.append(row)
    (OUT / 'core-browser-results.json').write_text(json.dumps(RESULTS, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(row, ensure_ascii=False), flush=True)
    assert passed, name
class QuietHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.mjs':'text/javascript', '.js':'text/javascript'}
    def log_message(self, *args): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'dist')))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome')
        page = browser.new_page(viewport={'width':1400,'height':900}, device_scale_factor=1.5)
        errors=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/')
        page.evaluate('''async () => {
          document.body.innerHTML='<div id="first" style="width:680px;height:760px;position:absolute;left:0;top:0"></div><div id="second" style="width:680px;height:760px;position:absolute;left:700px;top:0"></div>';
          window.mod=await import('/browser.mjs'); window.coreMod=await import('/graph-core.mjs');
          window.payload=await (await fetch('/smoke-payload.json')).json();
          window.original=JSON.stringify(payload);
          window.first=mod.mountGraph(document.getElementById('first'),payload);
          window.second=mod.mountGraph(document.getElementById('second'),payload);
        }''')
        page.wait_for_function('first.graph.renderer.stats.painted>0 && second.graph.renderer.stats.painted>0')
        check('Browser adapter without Obsidian or graph globals', page.evaluate('window.app===undefined && window.KG===undefined && window.createRenderer===undefined'))
        check('Shared input payload unchanged', page.evaluate('JSON.stringify(payload)===original && first.core.data!==second.core.data'))
        check('Separate inset state', page.evaluate('''() => { const old=second.graph.renderer.getInsets().right; first.graph.renderer.setInsets({right:120}); return second.graph.renderer.getInsets().right===old; }'''))
        page.evaluate("first.graph.renderer.setInsets({right:0}); first.graph.renderer.resetView(); second.graph.renderer.resetView()")
        page.mouse.move(1399,899)
        page.wait_for_timeout(600)
        check('Two mounts produce identical pixels', page.evaluate("first.host.shadowRoot.getElementById('cv').toDataURL()===second.host.shadowRoot.getElementById('cv').toDataURL()"))
        page.evaluate('''() => {
          window.bareCanvas=document.createElement('canvas'); bareCanvas.style.cssText='width:680px;height:760px'; document.body.appendChild(bareCanvas);
          window.bare=new coreMod.GraphCore({canvas:bareCanvas,payload,platform:mod.createCanvasPlatform(bareCanvas)});
          bare.mount();
        }''')
        page.wait_for_function('bare.renderer.stats.painted>0')
        # Compare equivalent frames: mounting the HUD already triggered inset/resize
        # redraws, whereas the bare canvas has only painted once so far.
        page.evaluate('window.counts=[first.core.frameCount,bare.frameCount]; first.core.resize(); bare.resize()')
        page.wait_for_function('first.core.frameCount>counts[0] && bare.frameCount>counts[1]')
        check('Core renders same pixels without HUD or DOM ids', page.evaluate("bareCanvas.toDataURL()===first.host.shadowRoot.getElementById('cv').toDataURL()"), page.evaluate("[first.core,bare].map(c=>({camera:c.renderer.camera,size:c.renderer.size(),insets:c.renderer.getInsets(),stats:c.renderer.stats,labels:c.renderer.labelMode}))"))
        page.evaluate('first.pause(); first.graph.renderer.zoomBy(1.1); window.paused=first.diagnostics().frameCount')
        page.wait_for_timeout(250)
        check('Explicit pause freezes pending render', page.evaluate('!first.diagnostics().active && first.diagnostics().frameCount===paused && first.diagnostics().core.frames>0'))
        page.evaluate('first.resume()')
        page.wait_for_function('first.diagnostics().frameCount>paused')
        check('Resume renders pending work', page.evaluate('first.diagnostics().active'))
        page.evaluate("document.getElementById('first').style.width='420px'")
        page.wait_for_function('first.graph.renderer.size()[0]===420')
        check('Container resize updates backing size', page.evaluate("first.host.shadowRoot.getElementById('cv').width===630"))
        page.evaluate("document.getElementById('first').style.display='none'")
        page.wait_for_function('!first.diagnostics().active')
        check('DOM-hidden view pauses', page.evaluate('!first.core.active'))
        page.evaluate("document.getElementById('first').style.display='block'")
        page.wait_for_function('first.diagnostics().active')
        check('DOM-shown view resumes', page.evaluate('first.core.active'))
        check('Failed payload mount removes partial host', page.evaluate("() => { const el=document.createElement('div');document.body.appendChild(el); try {mod.mountGraph(el,{});return false;} catch {return el.children.length===0;} finally {el.remove();} }"))
        check('Disposal detaches canvas input handlers', page.evaluate('''() => {
          const renderer=bare.renderer, zoom=renderer.camera.zoom;
          bare.dispose(); bare.dispose();
          bareCanvas.dispatchEvent(new WheelEvent('wheel',{deltaY:-600,bubbles:true,cancelable:true}));
          return renderer.camera.zoom===zoom && bare.diagnostics().listeners===0;
        }'''))
        page.evaluate('bareCanvas.remove(); first.dispose(); first.dispose()')
        check('Disposed mount releases all resources', page.evaluate("() => { const d=first.diagnostics();return d.disposed && !d.active && ['frames','listeners','observers','timers'].every(k=>d[k]===0); }"))
        check('Disposed session releases HUD and canvas DOM', page.evaluate('first.graph===null && first.host.shadowRoot.childElementCount===0 && first.core.data===null'))
        check('Sibling remains operational after disposal', page.evaluate('second.core.renderer.stats.painted>0 && !second.diagnostics().disposed'))
        page.evaluate("second.dispose(); window.third=mod.mountGraph(document.getElementById('first'),payload)")
        page.wait_for_function('third.graph.renderer.stats.painted>0')
        check('Remount cleanly after disposal', page.evaluate('third.core.diagnostics().listeners>0'))
        page.evaluate('third.dispose()')
        check('No browser errors', not errors, errors)
        browser.close()
finally:
    server.shutdown(); server.server_close()
print('CORE_BROWSER_RESULT',json.dumps({'ok':len(RESULTS),'fail':0}))
