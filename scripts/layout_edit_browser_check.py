"""Formal GraphCore/HUD with synthetic files through the real buildGraph pipeline."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.local/evidence/layout-state-0.0.6'
OUT.mkdir(parents=True,exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
    extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.mjs':'text/javascript'}
    def log_message(self,*a): pass
    def do_GET(self):
        if self.path=='/baseline.mjs':
            data=(ROOT/'.local/baselines/before-layout-20261029T014251900429Z/restore-check/dist/graph-core.mjs').read_bytes()
            self.send_response(200);self.send_header('Content-Type','text/javascript');self.end_headers();self.wfile.write(data)
        else: super().do_GET()
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
results=[]
try:
 with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':1200,'height':850})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(f'http://127.0.0.1:{server.server_port}/')
    page.evaluate('''async()=>{
      document.body.innerHTML='<div id="host" style="position:fixed;inset:0"></div>';
      const mod=await import('/browser.mjs'),pipeline=await import('/pipeline.mjs');
      window.payload=pipeline.buildGraph({files:Array.from({length:8},(_,i)=>({path:`Demo/Note${i}.md`,text:`# One\n## Child\n[[Note${(i+1)%8}#One]]\n# Two\ntext`})),config:{include:['**']}});
      window.source=JSON.stringify(payload);
      window.session=mod.mountGraph(document.getElementById('host'),payload);
      window.G=session.graph;window.R=G.renderer;window.cv=session.host.shadowRoot.getElementById('cv');
      window.positions=()=>R.NODES.map(n=>[n.id,n.x,n.y]);
      window.H=R.NODES.find(n=>n.kind==='heading'&&n.label==='Two');
      window.start=positions();
      window.oldCanvas=document.createElement('canvas');oldCanvas.style.cssText='position:fixed;inset:0;width:1200px;height:850px;pointer-events:none;visibility:hidden';document.body.append(oldCanvas);
      const old=await import('/baseline.mjs');window.oldCore=new old.GraphCore({canvas:oldCanvas,payload,platform:mod.createCanvasPlatform(oldCanvas)});oldCore.mount();
    }''')
    page.wait_for_timeout(250)
    def check(name,expr):
        passed=page.evaluate(expr) if isinstance(expr,str) else expr
        results.append({'name':name,'pass':bool(passed)})
        (OUT/'browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
        print(name,passed,flush=True);assert passed,name
    check('Reading mode canvas pixels equal 0.0.3',"()=>{oldCore.renderer.tweenTo({...R.camera},0);R.hover=null;R.selected=null;R.draw();oldCore.renderer.draw();return cv.toDataURL()===oldCanvas.toDataURL()}")
    page.evaluate('oldCore.dispose();oldCanvas.remove();R.focusOn(H.id,1.25,0)')
    page.wait_for_timeout(120)
    def point(id='H.id',handle=False):
        return page.evaluate('''([id,handle])=>{const c=cv.getBoundingClientRect(),n=R.byId.get(id),h=R.editHandle();return handle?{x:c.left+h.x,y:c.top+h.y}:{x:c.left+n.x*R.camera.zoom+R.camera.panX,y:c.top+n.y*R.camera.zoom+R.camera.panY}}''',[page.evaluate(id),handle])
    def drag(release=True,handle=False):
        at=point(handle=handle);page.mouse.move(at['x'],at['y']);page.mouse.down();page.mouse.move(at['x']+38,at['y']+23,steps=16);page.wait_for_timeout(80)
        if release:page.mouse.up()
    page.locator('#layout-mode').click();page.wait_for_timeout(60)
    page.evaluate('window.camBefore={...R.camera};window.coordsBefore=positions();window.marksBefore=JSON.stringify(R.markJobs)')
    drag()
    check('Drag changes display geometry',"JSON.stringify(coordsBefore)!==JSON.stringify(positions())")
    check('Node drag does not pan camera',"JSON.stringify(camBefore)===JSON.stringify(R.camera)")
    check('Payload remains immutable',"JSON.stringify(payload)===source")
    check('Moved node is hit at new position',"R.hitTest(H.x*R.camera.zoom+R.camera.panX,H.y*R.camera.zoom+R.camera.panY)?.id===H.id")
    check('Connected markers update',"JSON.stringify(R.markJobs)!==marksBefore")
    page.evaluate('window.saved=JSON.stringify(positions())');drag(False);page.keyboard.press('Escape');page.mouse.up()
    check('Escape exactly restores all coordinates',"JSON.stringify(positions())===saved && !R.layoutDragging && R.editMode")
    page.evaluate('window.saved=JSON.stringify(positions())');drag(False)
    page.mouse.wheel(0,-500)
    check('Wheel blocked during layout drag',"JSON.stringify(camBefore)===JSON.stringify(R.camera)")
    page.evaluate("window.dispatchEvent(new Event('blur'))");page.mouse.up()
    check('Blur cancels drag',"JSON.stringify(positions())===saved && !R.layoutDragging")
    drag(False);page.evaluate('session.pause()');page.mouse.up()
    check('Pause cancels drag',"JSON.stringify(positions())===saved && !R.layoutDragging")
    page.evaluate('session.resume()');page.wait_for_timeout(80)
    page.evaluate('R.selected=H.id');page.locator('#layout-parent').click();page.wait_for_timeout(80)
    check('Parent handle available',"R.selected===H.parent && !!R.editHandle()")
    page.evaluate('window.parentBefore=R.byId.get(H.parent);window.parentXY=[parentBefore.x,parentBefore.y];window.childXY=[H.x,H.y]')
    drag(handle=True)
    check('Parent and descendants translate together',"Math.abs((H.x-childXY[0])-(parentBefore.x-parentXY[0]))<1e-9 && Math.abs((H.y-childXY[1])-(parentBefore.y-parentXY[1]))<1e-9 && Math.hypot(H.x-childXY[0],H.y-childXY[1])>0")
    page.evaluate('window.headingBeforeRoot=H;window.rootNode=R.NODES.find(n=>!n.parent);R.selected=rootNode.id;window.rootBefore=positions()')
    page.wait_for_timeout(80)
    check('Root folder handle available',"!!R.editHandle() && R.editHandle().id===rootNode.id")
    drag(handle=True)
    check('Root folder handle moves whole subtree',"rootNode.x!==rootBefore.find(n=>n[0]===rootNode.id)[1] && Math.abs((H.x-rootBefore.find(n=>n[0]===H.id)[1])-(rootNode.x-rootBefore.find(n=>n[0]===rootNode.id)[1]))<1e-8")
    page.screenshot(path=str(OUT/'formal-browser.png'))
    page.evaluate('window.saved=JSON.stringify(positions());R.focusOn(H.id,1.25,0)');page.wait_for_timeout(80)
    drag(False);page.evaluate('window.keptRenderer=R;session.dispose()');page.mouse.up()
    check('Dispose cancels and clears owned resources',"JSON.stringify(keptRenderer.NODES.map(n=>[n.id,n.x,n.y]))===saved && session.diagnostics().listeners===0 && session.diagnostics().frames===0")
    check('No browser errors',not errors)
    browser.close()
finally:server.shutdown();server.server_close()
