"""Render Python and JS fixture payloads with the same core in a real browser."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
import threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.local/evidence'
class Handler(SimpleHTTPRequestHandler):
    extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.mjs':'text/javascript','.js':'text/javascript'}
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
results=[]
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome')
        page=browser.new_page(viewport={'width':1400,'height':900},device_scale_factor=1.5)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/')
        page.evaluate('''async () => {
          document.body.innerHTML='<div id="one" style="position:absolute;left:0;top:0;width:680px;height:800px"></div><div id="two" style="position:absolute;left:700px;top:0;width:680px;height:800px"></div>';
          window.pipeline=await import('/pipeline.mjs');window.adapter=await import('/browser.mjs');
        }''')
        page.mouse.move(1399,899)
        manifest=json.loads((ROOT/'.local/pipeline-golden/manifest.json').read_text())
        for item in manifest['fixtures']:
            fixture=json.loads((ROOT/'.local/pipeline-golden'/f"{item['name']}.json").read_text(encoding='utf8'))
            result=page.evaluate('''async fixture => {
              const workerResult=await new Promise((resolve,reject)=>{
                const w=new Worker('/pipeline-worker.js');
                w.onmessage=e=>{w.terminate();e.data.error?reject(new Error(e.data.error)):resolve(e.data.payload);};
                w.onerror=e=>{w.terminate();reject(new Error(e.message));};w.postMessage(fixture.input);
              });
              const main=pipeline.buildGraph(fixture.input);
              const workerEqual=JSON.stringify(main)===JSON.stringify(workerResult);
              const a=adapter.mountGraph(document.getElementById('one'),fixture.expected);
              const b=adapter.mountGraph(document.getElementById('two'),workerResult);
              try {
                await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
                a.core.resize();b.core.resize();
                await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
                const pixelEqual=a.host.shadowRoot.getElementById('cv').toDataURL()===b.host.shadowRoot.getElementById('cv').toDataURL();
                return {workerEqual,pixelEqual,painted:b.graph.renderer.stats.painted,nodes:workerResult.nodes.length,edges:workerResult.edges.length};
              } finally {a.dispose();b.dispose();}
            }''',fixture)
            row={'name':item['name'],'pass':result['workerEqual'] and result['pixelEqual'] and result['painted']>0,**result}
            results.append(row)
            (OUT/'pipeline-browser-results.json').write_text(json.dumps(results,indent=2),encoding='utf8')
            print(json.dumps(row),flush=True)
            assert row['pass'],row
        assert not errors,errors
        browser.close()
finally:
    server.shutdown();server.server_close()
print('PIPELINE_BROWSER_RESULT',json.dumps({'fixtures':len(results),'errors':[]}))
