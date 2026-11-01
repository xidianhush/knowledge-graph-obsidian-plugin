"""0.0.8 synthetic-only rename, disk and reload integration."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.local/evidence/layout-rename-008';OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.connect_over_cdp('http://127.0.0.1:9242',timeout=15000)
 page=next(pg for pg in browser.contexts[0].pages if 'app://obsidian.md' in pg.url)
 assert Path(page.evaluate('app.vault.adapter.basePath')).resolve()==(ROOT/'test-vault-layout-fix').resolve()
 page.reload(wait_until='domcontentloaded')
 page.wait_for_function("app?.workspace?.layoutReady && app.plugins.plugins['knowledge-graph-smoke']")
 results=[]
 def check(name,value):
  results.append({'name':name,'pass':bool(value)})
  (OUT/'native.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
  print(json.dumps(results[-1]),flush=True)
  assert value,name
 page.evaluate(r"""async()=>{
  window.P=app.plugins.plugins['knowledge-graph-smoke'];if(P.manifest.version!=='0.0.8')throw Error('Wrong version');
  for(const leaf of app.workspace.getLeavesOfType('knowledge-graph-vault-view'))leaf.detach();
  for(const key of Object.keys(P.layoutStore.state().groups))if(key.includes('__kg_rename__'))await P.layoutStore.command({},'reset-group',key);
  P.graphSettings={...P.graphSettings,autoUpdate:false};
  const folder='__kg_rename__';if(!app.vault.getAbstractFileByPath(folder))await app.vault.createFolder(folder);
  window.original='# Alpha\nalpha body\n## One\none body\n## Two\ntwo body\n# Beta\nbeta body\n## Three\nthree body\n## Four\nfour body';
  for(let i=0;i<3;i++){const path=folder+'/Note'+i+'.md',file=app.vault.getAbstractFileByPath(path),text=i===1?'# Same\nfirst\n# Same\nsecond':i===2?'# Only\nbody':original;if(file)await app.vault.modify(file,text);else await app.vault.create(path,text);}
  await P.saveGraphSettings({...P.savedData,settings:{...P.graphSettings,autoUpdate:false},pipeline:{...P.pipelineSettings,config:{include:[folder+'/**']}}});
  await P.openGraph('vault',true);
 }""")
 def bind():
  page.evaluate(r"""()=>{window.P=app.plugins.plugins['knowledge-graph-smoke'];window.V=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view;window.R=V.graph.renderer;app.workspace.setActiveLeaf(V.leaf,{focus:true});}""")
 bind()
 for id in ['__kg_rename__/Note0#Alpha/One','__kg_rename__/Note0#Beta/Three','__kg_rename__/Note0#Beta','__kg_rename__/Note1#Same','__kg_rename__/Note2#Only']:
  page.evaluate("id=>{window.H=R.byId.get(id);R.selected=id;R.setEditMode(true);R.focusOn(id,1.25,0)}",id)
  page.wait_for_timeout(180)
  at=page.evaluate("()=>{const b=V.host.shadowRoot.getElementById('cv').getBoundingClientRect();return{x:b.left+H.x*R.camera.zoom+R.camera.panX,y:b.top+H.y*R.camera.zoom+R.camera.panY}}")
  page.mouse.move(at['x'],at['y']);page.mouse.down();page.mouse.move(at['x']+25,at['y']+15,steps=12);page.mouse.up()
  page.evaluate('async()=>await P.layoutStore.settled()')
 saved=page.evaluate('R.NODES.map(n=>[n.x,n.y])')
 def same():
  return page.evaluate('(old)=>R.NODES.length===old.length&&R.NODES.every((n,i)=>Math.hypot(n.x-old[i][0],n.y-old[i][1])<1e-7)',saved)
 check('Real mouse drags save three groups',page.evaluate("Object.keys(P.savedData.layoutOverrides.groups).filter(k=>k.includes('__kg_rename__/Note0')).length===3"))
 check('Single and duplicate heading drags saved',page.evaluate("Object.keys(P.savedData.layoutOverrides.groups).filter(k=>k.includes('__kg_rename__')).length===5"))
 for note,old,new in [('Note0','## One','## Renamed'),('Note0','# Alpha','# New Parent'),('Note1','# Same','# Different'),('Note2','# Only','# Single Renamed')]:
  page.evaluate(r"""async([note,old,next])=>{const f=app.vault.getAbstractFileByPath('__kg_rename__/'+note+'.md');await app.vault.modify(f,(await app.vault.read(f)).replace(old,next));await V.rebuild();}""",[note,old,new]);bind()
  check('Rebuild preserves positions: '+new,same())
  check('Migration reaches disk: '+new,page.evaluate("async()=>JSON.stringify((await P.loadData()).layoutOverrides.groups)===JSON.stringify(P.layoutStore.state().groups)"))
 check('Old-structure undo cleared',page.evaluate('!P.layoutStore.state().canUndo'))
 page.reload(wait_until='domcontentloaded');page.wait_for_function("app?.plugins?.plugins['knowledge-graph-smoke'] && app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0]?.view.graph");bind()
 check('Application reload retains migrated positions',same())
 page.evaluate("R.setEditMode(true);R.selected='__kg_rename__/Note0#New Parent/Renamed';V.graph.layoutCommand('reset-group')")
 page.evaluate('async()=>await P.layoutStore.settled()')
 check('Reset group changes layout',not same())
 page.evaluate("V.graph.layoutCommand('undo')");page.evaluate('async()=>await P.layoutStore.settled()')
 check('Undo reset restores migrated arrangement',same())
 page.evaluate("async()=>{await P.saveGraphSettings({...P.savedData,settings:{...P.graphSettings,autoUpdate:true}});await V.rebuild();}");bind()
 page.evaluate(r"""async()=>{window.oldGeneration=V.generation;const f=app.vault.getAbstractFileByPath('__kg_rename__/Note0.md');await app.vault.modify(f,(await app.vault.read(f)).replace('## Renamed','## Final Name'));}""")
 page.wait_for_function("V.generation>oldGeneration && V.contentEl.dataset.buildPhase==='ready' && !V.contentEl.dataset.pipelineUpdating")
 bind();check('Automatic vault update preserves renamed positions',same())
 page.evaluate("R.selected='__kg_rename__/Note0#New Parent/Final Name';R.focusOn(R.selected,1.25,0)")
 page.keyboard.press('Escape')
 check('Escape stays in graph view',page.evaluate('app.workspace.activeLeaf===V.leaf'))
 page.screenshot(path=str(OUT/'trial-ready.png'))
 print(json.dumps({'version':'0.0.8','vault':'test-vault-layout-fix','checks':len(results)}),flush=True)
 browser.close()
