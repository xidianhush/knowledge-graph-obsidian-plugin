"""Legacy short-test metric includes polling and verification; do not compare versions directly.
Use native_ab_check.py for phase-separated same-process A/B. Restores scope afterwards.
"""
from pathlib import Path
import json,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'.local/evidence/continuous-009';OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.connect_over_cdp('http://127.0.0.1:9242',timeout=15000)
 page=next(pg for pg in browser.contexts[0].pages if 'app://obsidian.md' in pg.url)
 assert Path(page.evaluate('app.vault.adapter.basePath')).resolve()==(ROOT/'test-vault-layout-fix').resolve()
 errors=[];page.on('pageerror',lambda e:errors.append({'message':str(e),'stack':e.stack}))
 backup=page.evaluate("async()=>await app.plugins.plugins['knowledge-graph-smoke'].loadData()")
 (OUT/'synthetic-config-before.json').write_text(json.dumps(backup,ensure_ascii=False,indent=2),encoding='utf-8')
 rows=[];started=time.monotonic()
 try:
  page.evaluate(r"""async()=>{
   window.P=app.plugins.plugins['knowledge-graph-smoke'];if(P.manifest.version!=='0.0.9')throw Error('Wrong candidate');
   P.graphSettings.autoUpdate=false;window.folder='__kg_continuous_009__';
   if(!app.vault.getAbstractFileByPath(folder))await app.vault.createFolder(folder);
   window.fixture=Array.from({length:100},(_,i)=>`${i%10===0?'#':'##'} H${i}\nbody ${i}`).join('\n');
   for(let i=0;i<10;i++){const path=folder+'/Note'+i+'.md',f=app.vault.getAbstractFileByPath(path);if(f)await app.vault.modify(f,fixture);else await app.vault.create(path,fixture);}
   await P.saveGraphSettings({...P.savedData,settings:{...P.graphSettings,autoUpdate:true,debounceMs:100},pipeline:{...P.pipelineSettings,config:{...P.pipelineSettings.config,include:[folder+'/**']}}});
   await P.openGraph('vault',true);window.V=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view;window.R=V.graph.renderer;
   window.H=R.byId.get(folder+'/Note0#H0/H1');R.selected=H.id;R.setEditMode(true);R.focusOn(H.id,1.25,0);
  }""")
  page.wait_for_timeout(200)
  at=page.evaluate("()=>{const b=V.host.shadowRoot.getElementById('cv').getBoundingClientRect();return{x:b.left+H.x*R.camera.zoom+R.camera.panX,y:b.top+H.y*R.camera.zoom+R.camera.panY}}")
  page.mouse.move(at['x'],at['y']);page.mouse.down();page.mouse.move(at['x']+30,at['y']+20,steps=12);page.mouse.up()
  page.evaluate('async()=>await P.layoutStore.settled()')
  assert page.evaluate("Object.keys(P.layoutStore.state().groups).some(k=>k.includes(folder))"),'Manual arrangement missing'
  for i in range(120):
   page.evaluate(r"""async i=>{
    window.oldGeneration=V.generation;window.changeStart=performance.now();
    const text=i%4===0?fixture.replace('H1\n','Renamed\n'):i%4===2?fixture+'\n# Added\nextra':fixture;
    await app.vault.modify(app.vault.getAbstractFileByPath(folder+'/Note0.md'),text);
   }""",i)
   page.wait_for_function("V.generation>oldGeneration && V.contentEl.dataset.buildPhase==='ready' && !V.contentEl.dataset.pipelineUpdating",timeout=15000)
   row=page.evaluate("""async()=>{await P.layoutStore.settled();const disk=await P.loadData(),state=P.layoutStore.state(),diag=V.session.diagnostics();return{ms:performance.now()-changeStart,nodes:V.graph.data.nodes.length,workers:P.pipelineResources.active,busy:state.busy,diskMatches:JSON.stringify(disk.layoutOverrides.groups)===JSON.stringify(state.groups),recordBytes:new TextEncoder().encode(JSON.stringify(state.groups)).length,groups:Object.keys(state.groups).length,heap:performance.memory?.usedJSHeapSize,frames:diag.frames,timers:diag.timers,listeners:diag.listeners,fallback:V.host.shadowRoot.getElementById('layout-status').textContent.includes('使用自动布局'),restored:V.graph.renderer.layoutModel.apply(state.groups).restored}}""")
   assert row['diskMatches'] and not row['workers'] and not row['busy'] and row['restored']>=1,row
   rows.append(row)
   if (i+1)%20==0:
    (OUT/'native-progress.json').write_text(json.dumps({'completed':i+1,'rows':rows,'errors':errors},indent=2),encoding='utf-8')
    print(json.dumps({'completed':i+1,'lastMs':row['ms'],'bytes':row['recordBytes']}),flush=True)
   page.wait_for_timeout(250)
  times=sorted(r['ms'] for r in rows)
  result={'version':'0.0.9','completed':len(rows),'wallSeconds':time.monotonic()-started,'measurement':'Vault modify through automatic debounce, build, migration, disk verification; includes 100 ms debounce and test polling','p50Ms':times[len(times)//2],'p95Ms':times[int(len(times)*.95)],'maxMs':max(times),'rows':rows,'errors':errors}
  (OUT/'native.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k!='rows'}),flush=True)
 finally:
  page.mouse.up()
  page.evaluate("""async original=>{
   const p=app.plugins.plugins['knowledge-graph-smoke'];await p.layoutStore.settled();
   for(const key of Object.keys(p.layoutStore.state().groups))if(key.includes('__kg_continuous_009__'))await p.layoutStore.command({},'reset-group',key);
   await p.saveGraphSettings(original);await p.openGraph('vault',true);
  }""",backup)
  restored=page.evaluate("async()=>{const p=app.plugins.plugins['knowledge-graph-smoke'];await p.layoutStore.settled();return await p.loadData()}")
  assert restored['settings']==backup['settings'] and restored['pipeline']==backup['pipeline']
  assert restored.get('layoutOverrides',{}).get('groups',{})==backup.get('layoutOverrides',{}).get('groups',{})
  (OUT/'restore.json').write_text(json.dumps({'settingsRestored':True,'scopeRestored':True,'originalLayoutGroupsRestored':True}),encoding='utf-8')
 browser.close()
