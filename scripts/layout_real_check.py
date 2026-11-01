"""Layout acceptance in the already-authorized real copy. Original notes are read-only."""
from pathlib import Path
import json,hashlib
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];TRIAL=ROOT/'real-vault-trial'
OUT=ROOT/'.local/evidence/layout-performance';OUT.mkdir(parents=True,exist_ok=True)
manifest=json.loads((ROOT/'.local/evidence/real-trial-copy.json').read_text(encoding='utf8'))
VERSION=json.loads((ROOT/'manifest.json').read_text())['version']
baselinePath=OUT/'real-content-before.json'
if baselinePath.exists():
    baseline=json.loads(baselinePath.read_text(encoding='utf8'))
else:
    baseline=[]
    for row in manifest['notes']+manifest['images']:
        file=(TRIAL/row['path']).resolve()
        assert file.is_relative_to(TRIAL.resolve()) and row['path'].lower()!='utilities/api key.md'
        baseline.append({'path':row['path'],'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
    baselinePath.write_text(json.dumps(baseline,ensure_ascii=False,indent=2),encoding='utf8')
def originals_match():
    for row in baseline:
        file=(TRIAL/row['path']).resolve()
        assert file.is_relative_to(TRIAL.resolve()) and row['path'].lower()!='utilities/api key.md'
        if hashlib.sha256(file.read_bytes()).hexdigest()!=row['sha256']:return False
    return True
assert originals_match(),'Copy changed after this task baseline; inspect before proceeding'
results=[]
with sync_playwright() as p:
    browser=p.chromium.connect_over_cdp('http://127.0.0.1:9239',timeout=10000)
    page=next(pg for pg in browser.contexts[0].pages if 'app://obsidian.md' in pg.url)
    assert Path(page.evaluate('app.vault.adapter.basePath')).resolve()==TRIAL.resolve()
    page.wait_for_function("app?.workspace?.layoutReady&&app.plugins.plugins['knowledge-graph-smoke']")
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    def check(name,expr,detail=None):
        ok=page.evaluate(expr) if isinstance(expr,str) else expr
        row={'name':name,'pass':bool(ok)}
        if detail is not None:row['detail']=detail
        results.append(row);(OUT/f'real-{VERSION}.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
        print(json.dumps(row),flush=True)
        if not ok:page.screenshot(path=str(OUT/'real-failure.png'))
        assert ok,name
    def bind():
        page.evaluate("""()=>{
          window.P=app.plugins.plugins['knowledge-graph-smoke'];window.V=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view;window.R=V.graph.renderer;
          app.workspace.setActiveLeaf(V.leaf,{focus:true});
          const legend=V.host.shadowRoot.getElementById('legend');if(!legend.classList.contains('collapsed'))V.host.shadowRoot.getElementById('legend-toggle').click();
          window.positions=()=>R.NODES.map(n=>[n.id,n.x,n.y]);
          window.near=(a,b)=>a.length===b.length&&a.every((n,i)=>n[0]===b[i][0]&&Math.hypot(n[1]-b[i][1],n[2]-b[i][2])<1e-7);
        }""")
    def settle():page.evaluate('async()=>await P.layoutStore.settled()')
    def drag():
        page.evaluate('R.selected=H.id;R.setEditMode(true);R.focusOn(H.id,1.25,0)');page.wait_for_timeout(160)
        at=page.evaluate("()=>{const b=V.host.shadowRoot.getElementById('cv').getBoundingClientRect(),h=R.editHandle();return{x:b.left+h.x,y:b.top+h.y}}")
        page.mouse.move(at['x'],at['y']);page.mouse.down();page.mouse.move(at['x']+28,at['y']+18,steps=18);page.mouse.up();settle()
    try:
        page.evaluate("""async()=>{
          window.P=app.plugins.plugins['knowledge-graph-smoke'];window.probe='Science and Tech/__kg_layout_me_a4_probe__.md';
          if(app.vault.getAbstractFileByPath(probe))throw Error('Probe already exists; refusing to overwrite');
          window.originalCachedRead=app.vault.cachedRead;
          window.readPaths=new Set();app.vault.cachedRead=function(file){if(!/^(Science and Tech|Literature History Philosophy)\//.test(file.path))throw Error('Out of approved scope');readPaths.add(file.path);return originalCachedRead.call(this,file)};
          window.originalSettings=structuredClone(P.savedData);
          await P.openGraph('vault',true);
        }""")
        bind();check('Runtime uses candidate in the authorized copy',f"P.manifest.version==='{VERSION}'")
        check('All 95 approved notes build; only approved bodies read',"V.graph.data.meta.note_count===95&&readPaths.size===95",page.evaluate('({notes:V.graph.data.meta.note_count,nodes:R.NODES.length,edges:R.SEM.length})'))
        check('Worker resources released after build',"P.pipelineResources.active===0&&P.pipelineResources.started===P.pipelineResources.stopped")
        page.evaluate('window.automatic=positions()')
        page.locator('#layout-mode').click()
        # Choose moderate groups by geometry, without exporting note titles/paths to the report.
        for kind in ['heading','note','folder']:
            page.evaluate("""kind=>{
              const counts=new Map();for(const n of R.NODES)counts.set(n.parent,(counts.get(n.parent)||0)+1);
              const candidates=R.NODES.filter(n=>n.kind===kind&&counts.get(n.parent)>=2&&counts.get(n.parent)<=12&&n.r>1).sort((a,b)=>a.r-b.r);
              window.H=candidates[Math.min(2,candidates.length-1)];if(!H)throw Error('No suitable '+kind+' group');window.before=positions();
            }""",kind)
            drag()
            check('Real '+kind+' moves and saves with its subtree',"!near(positions(),before)&&!P.layoutStore.state().busy&&Object.keys(P.savedData.layoutOverrides.groups).length>0")
            page.evaluate('window.moved=positions();V.graph.layoutCommand("undo")');settle()
            check('Real '+kind+' whole transaction undo',"near(positions(),before)")
            page.evaluate('V.graph.layoutCommand("redo")');settle()
            check('Real '+kind+' redo',"near(positions(),moved)")
        page.evaluate('window.saved=positions()')
        page.evaluate('async()=>await V.rebuild()');bind()
        check('Real graph rebuild restores saved coordinates',"near(positions(),saved)")
        # Keep a selected real heading preview within the native size/queue limits.
        page.evaluate("H=R.NODES.find(n=>n.kind==='heading'&&n.r>1);R.focusOn(H.id,1.25,0);V.graph.dismiss()")
        page.wait_for_timeout(200)
        at=page.evaluate("()=>{const b=V.host.shadowRoot.getElementById('cv').getBoundingClientRect();return{x:b.left+H.x*R.camera.zoom+R.camera.panX,y:b.top+H.y*R.camera.zoom+R.camera.panY}}")
        page.mouse.move(at['x'],at['y']);page.keyboard.down('Control');page.wait_for_timeout(650)
        check('Ctrl preview still opens on real content',"V.graph.previewState().open")
        page.keyboard.press('Escape');page.keyboard.up('Control')
        check('Esc retains the real graph and closes preview',"app.workspace.activeLeaf===V.leaf&&!V.graph.previewState().open")
        # Stress RAF and cancellation on the live real graph, restoring exactly afterward.
        metrics=page.evaluate("""async()=>{
          const events=[],draw=[],intervals=[],cv=V.host.shadowRoot.getElementById('cv'),plat=V.session.core.platform,original=plat.requestFrame;
          plat.requestFrame=fn=>original(t=>{const a=performance.now();fn(t);draw.push(performance.now()-a)});
          R.setEditMode(true);R.selected=H.id;R.focusOn(H.id,1.25,0);await new Promise(r=>setTimeout(r,120));draw.length=0;
          const b=cv.getBoundingClientRect(),h=R.editHandle(),initial=positions(),point={clientX:b.left+h.x,clientY:b.top+h.y};
          const emit=(type,p)=>cv.dispatchEvent(new MouseEvent(type,{bubbles:true,composed:true,button:0,buttons:1,...p}));
          emit('mousedown',point);let last=performance.now();
          for(let i=0;i<90;i++){await new Promise(requestAnimationFrame);const t=performance.now();intervals.push(t-last);last=t;
            emit('mousemove',{clientX:point.clientX+35*Math.sin(i*.1),clientY:point.clientY+25*Math.cos(i*.1)});events.push(performance.now()-t);}
          const t=performance.now();R.cancelLayout();const cancelMs=performance.now()-t;emit('mouseup',point);
          plat.requestFrame=original;
          const stat=a=>{a.sort((x,y)=>x-y);return{samples:a.length,p50:a[Math.floor(a.length*.5)]||0,p95:a[Math.floor(a.length*.95)]||0,max:a.at(-1)||0}};
          return{eventMs:stat(events),drawMs:stat(draw),frameIntervalMs:stat(intervals),cancelMs,cancelled:near(positions(),initial)};
        }""")
        (OUT/f'real-timing-{VERSION}.json').write_text(json.dumps(metrics,indent=2),encoding='utf8')
        check('Real graph RAF drag cancels exactly',metrics['cancelled'],metrics)
        page.evaluate("async()=>{window.oldGeneration=V.generation;await app.vault.create(probe,'# Synthetic probe\\nOnly this synthetic file is edited.\\n## Child\\nbody');}")
        page.wait_for_function("V.generation>oldGeneration&&V.buildState.phase==='ready'&&V.graph.data.meta.note_count===96",timeout=60000);bind()
        check('Synthetic addition rebuilds real graph with valid finite geometry',"R.NODES.every(n=>Number.isFinite(n.x+n.y))&&!P.layoutStore.state().canUndo",page.evaluate('R.applyLayout(P.layoutStore.state().groups)'))
        page.evaluate("async()=>{window.oldGeneration=V.generation;const f=app.vault.getAbstractFileByPath(probe);await app.vault.modify(f,(await app.vault.read(f))+'\\nMore body');}")
        page.wait_for_function("V.generation>oldGeneration&&V.buildState.phase==='ready'",timeout=60000);bind()
        check('Synthetic body change completes automatic rebuild',"P.pipelineResources.active===0")
        page.evaluate("async()=>{window.oldGeneration=V.generation;await app.vault.rename(app.vault.getAbstractFileByPath(probe),probe.replace('.md','-renamed.md'));}")
        page.wait_for_function("V.generation>oldGeneration&&V.buildState.phase==='ready'",timeout=60000);bind()
        check('Synthetic rename finishes without stale history',"!P.layoutStore.state().canUndo&&P.pipelineResources.active===0")
        page.evaluate("async()=>{window.oldGeneration=V.generation;await app.vault.delete(app.vault.getAbstractFileByPath(probe.replace('.md','-renamed.md')));}")
        page.wait_for_function("V.generation>oldGeneration&&V.buildState.phase==='ready'&&V.graph.data.meta.note_count===95",timeout=60000);bind()
        check('Removing probe restores the compatible saved real layout',"near(positions(),saved)")
        # Rebuild/close cycles: old owned resources must reach zero, not only become hidden.
        cycles=page.evaluate("""async()=>{
          const rows=[];for(let i=0;i<6;i++){const old=V.session;await V.rebuild();rows.push(old.diagnostics());}
          return rows;
        }""");bind()
        check('Six rebuilds release all old frames/listeners/timers/observers',all(r['disposed'] and all(r[k]==0 for k in ['frames','listeners','timers','observers']) for r in cycles))
        check('Rebuild cycles keep saved coordinates and stop workers',"near(positions(),saved)&&P.pipelineResources.active===0&&P.pipelineResources.started===P.pipelineResources.stopped")
        expected=page.evaluate('saved');page.reload(wait_until='domcontentloaded')
        page.wait_for_function("app?.workspace?.getLeavesOfType('knowledge-graph-vault-view')[0]?.view.graph",timeout=60000);bind();page.evaluate('v=>window.saved=v',expected)
        check('Real copy application reload retains layout',"near(positions(),saved)")
        page.evaluate('async()=>{await V.leaf.detach();await P.openGraph("vault",true)}');bind()
        check('Close/reopen retains layout',"near(positions(),saved)")
        check('Scope/settings preserved after layout writes',"P.pipelineSettings.config.include.length===2&&P.pipelineSettings.config.include.includes('Science and Tech/**')&&P.pipelineSettings.config.include.includes('Literature History Philosophy/**')&&P.graphSettings.debounceMs===500")
        check('No uncaught runtime errors',not errors)
        page.locator('#layout-mode').click();page.evaluate('V.graph.dismiss();R.zoomToDepth(2)');page.wait_for_timeout(700)
        page.screenshot(path=str(OUT/'real-ready.png'))
        runtime=page.evaluate('({plugin:P.manifest.version,vault:app.vault.adapter.basePath,notes:V.graph.data.meta.note_count,nodes:R.NODES.length,edges:R.SEM.length,groups:Object.keys(P.savedData.layoutOverrides.groups).length})')
        (OUT/'real-ready.json').write_text(json.dumps(runtime,indent=2),encoding='utf8')
    finally:
        page.keyboard.up('Control');page.mouse.up()
        page.evaluate("""async()=>{if(window.originalCachedRead)app.vault.cachedRead=originalCachedRead;
          for(const path of ['Science and Tech/__kg_layout_me_a4_probe__.md','Science and Tech/__kg_layout_me_a4_probe__-renamed.md']){const f=app.vault.getAbstractFileByPath(path);if(f)await app.vault.delete(f);}}""")
        browser.close()
    check('All 95 original notes and 567 copied images remain byte-identical',originals_match())
