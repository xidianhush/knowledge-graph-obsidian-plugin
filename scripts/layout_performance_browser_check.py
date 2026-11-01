"""RAF-paced synthetic dragging with the real renderer, HUD and pipeline."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'.local/evidence/layout-performance';OUT.mkdir(parents=True,exist_ok=True)
VERSION=json.loads((ROOT/'manifest.json').read_text())['version']
class Handler(SimpleHTTPRequestHandler):
    extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.mjs':'text/javascript'}
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':1200,'height':900});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(f'http://127.0.0.1:{server.server_port}/')
    page.evaluate("""async()=>{window.mod=await import('/browser.mjs');window.pipeline=await import('/pipeline.mjs');window.coreMod=await import('/graph-core.mjs');
      window.stats=a=>{const b=[...a].sort((x,y)=>x-y);return{samples:b.length,p50:b[Math.floor(b.length*.5)]||0,p95:b[Math.min(b.length-1,Math.floor(b.length*.95))]||0,max:b.at(-1)||0}};
    }""")
    results=[]
    for siblings,branch in [(10,1),(50,1),(128,1),(200,1),(10,10),(10,100),(10,500),(10,501)]:
        row=page.evaluate("""async([siblings,branch])=>{
          document.body.innerHTML='<div id="host" style="position:fixed;inset:0"></div>';
          const payload=pipeline.buildGraph({files:Array.from({length:siblings},(_,i)=>({path:`Group/Note${i}.md`,text:branch===1?'body':Array.from({length:branch-1},(_,j)=>`${j%10===0?'#':'##'} Heading ${j}\\nbody`).join('\\n')})),config:{include:['**']}});
          const session=mod.mountGraph(document.getElementById('host'),payload),R=session.graph.renderer,cv=session.host.shadowRoot.getElementById('cv');
          const drawMs=[],events=[],intervals=[],n=R.byId.get('Group/Note0'),parent=R.byId.get('Group');
          const original=session.core.platform.requestFrame;
          session.core.platform.requestFrame=fn=>original(t=>{const start=performance.now();fn(t);drawMs.push(performance.now()-start)});
          R.focusOn(parent.id,1.05,0);R.setEditMode(true);R.selected=n.id;
          await new Promise(r=>setTimeout(r,120));drawMs.length=0;
          const initial=R.NODES.map(n=>[n.x,n.y]);
          const rect=cv.getBoundingClientRect(),xy=()=>({clientX:rect.left+n.x*R.camera.zoom+R.camera.panX,clientY:rect.top+n.y*R.camera.zoom+R.camera.panY});
          const event=(type,point)=>cv.dispatchEvent(new MouseEvent(type,{bubbles:true,composed:true,button:0,buttons:type==='mouseup'?0:1,...point}));
          const start=performance.now();event('mousedown',xy());const beginMs=performance.now()-start;
          let last=performance.now();
          for(let i=0;i<90;i++){
            await new Promise(requestAnimationFrame);const now=performance.now();intervals.push(now-last);last=now;
            const at=xy(),step=parent.r*R.camera.zoom*.04;
            at.clientX+=Math.cos(i*.16)*step;at.clientY+=Math.sin(i*.16)*step;
            const start=performance.now();event('mousemove',at);events.push(performance.now()-start);
          }
          const moved=R.NODES.some((n,i)=>Math.hypot(n.x-initial[i][0],n.y-initial[i][1])>1e-7),status=session.host.shadowRoot.getElementById('layout-status').textContent;
          const t=performance.now();R.cancelLayout();const cancelMs=performance.now()-t;event('mouseup',xy());
          const cancelled=R.NODES.every((n,i)=>n.x===initial[i][0]&&n.y===initial[i][1]);
          await new Promise(r=>setTimeout(r,120));const f=session.diagnostics().frameCount;
          await new Promise(r=>setTimeout(r,180));const idleFrames=session.diagnostics().frameCount-f;
          session.dispose();const disposed=session.diagnostics();
          return{siblings,branch,affected:siblings*branch,nodes:payload.nodes.length,beginMs,eventMs:stats(events),drawMs:stats(drawMs),frameIntervalMs:stats(intervals),cancelMs,moved,cancelled,idleFrames,status,disposed};
        }""",[siblings,branch])
        assert row['cancelled'] and row['idleFrames']==0
        assert row['disposed']['frames']==0 and row['disposed']['listeners']==0 and row['disposed']['timers']==0
        if siblings>128 or siblings*branch>5000:assert not row['moved'] and '超过' in row['status']
        elif siblings<=50:assert row['moved'] and row['drawMs']['samples']>30
        results.append(row)
        report={'version':VERSION,'browser':browser.version,'viewport':[1200,900],'samplesPerScenario':90,'measurement':'Synthetic RAF-paced DOM input; wall event and scheduled renderer callback costs, actual RAF intervals','results':results,'errors':errors}
        (OUT/f'browser-{VERSION}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
        print(json.dumps({k:row[k] for k in ['siblings','affected','eventMs','drawMs','frameIntervalMs','moved','idleFrames']}),flush=True)
    assert not errors
    browser.close()
finally:server.shutdown()
