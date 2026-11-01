"""Same-process balanced A/B. Restores the synthetic vault's binaries/config in finally."""
from pathlib import Path
import json,zipfile,hashlib,time,random,statistics
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'.local/evidence/native-ab';OUT.mkdir(parents=True,exist_ok=True)
TARGET=ROOT/'test-vault-layout-fix/.obsidian/plugins/knowledge-graph-smoke'
NAMES=['main.js','manifest.json','styles.css','data.json']
fixture=json.loads((OUT/'fixture.json').read_text(encoding='utf-8'))
baseline={n:(TARGET/n).read_bytes() for n in NAMES}
backup=OUT/('backup-'+str(time.time_ns()));backup.mkdir()
for n,data in baseline.items():(backup/n).write_bytes(data)
versions={}
for v in ['0.0.9','0.0.10']:
 with zipfile.ZipFile(ROOT/f'.local/releases/knowledge-graph-smoke-{v}.zip') as z:
  versions[v]={n:z.read(n) for n in NAMES[:3]}
order=[];rng=random.Random(4702)
for pair in range(4):
 batch=['0.0.9','0.0.10'];rng.shuffle(batch);order.extend(batch)
rows=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.connect_over_cdp('http://127.0.0.1:9242',timeout=15000)
 page=next(pg for pg in b.contexts[0].pages if 'app://obsidian.md' in pg.url)
 assert Path(page.evaluate('app.vault.adapter.basePath')).resolve()==(ROOT/'test-vault-layout-fix').resolve()
 page.on('pageerror',lambda e:errors.append({'message':str(e),'stack':e.stack}))
 try:
  for trial,version in enumerate(order):
   page.evaluate("async()=>{await app.plugins.disablePlugin('knowledge-graph-smoke')}")
   page.evaluate("""async files=>{const folder='__kg_native_ab__';if(!app.vault.getAbstractFileByPath(folder))await app.vault.createFolder(folder);for(const f of files){const existing=app.vault.getAbstractFileByPath(f.path);if(existing)await app.vault.modify(existing,f.text);else await app.vault.create(f.path,f.text)}}""",fixture['files'])
   for n,data in versions[version].items():(TARGET/n).write_bytes(data)
   (TARGET/'data.json').write_text(json.dumps(fixture['data']),encoding='utf-8')
   digest=hashlib.sha256((TARGET/'main.js').read_bytes()).hexdigest()
   page.evaluate("""async version=>{app.plugins.manifests['knowledge-graph-smoke'].version=version;await app.plugins.enablePlugin('knowledge-graph-smoke');window.P=app.plugins.plugins['knowledge-graph-smoke'];await P.openGraph('vault',true);window.V=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view;await P.layoutStore.settled()}""",version)
   assert page.evaluate("P.layoutStore.state().schemaVersion")== (1 if version=='0.0.9' else 2),'Loaded runtime schema differs from requested version'
   page.evaluate("""()=>{
    window.ab={row:null};const now=()=>performance.now();
    const save=P.saveData.bind(P);P.saveData=async(...args)=>{const r=ab.row,t=now();try{return await save(...args)}finally{if(r)r.saveMs+=now()-t}};
    const reconcile=P.layoutStore.reconcile.bind(P.layoutStore);P.layoutStore.reconcile=async(...args)=>{const r=ab.row,t=now();try{return await reconcile(...args)}finally{if(r){r.reconcileMs+=now()-t;r.reconcileEnd=now()}}};
    const read=app.vault.cachedRead.bind(app.vault);ab.read=read;app.vault.cachedRead=async(...args)=>{const r=ab.row,t=now();try{return await read(...args)}finally{if(r)r.readMs+=now()-t}};
    const Worker=window.Worker;ab.Worker=Worker;window.Worker=class extends Worker{constructor(...args){super(...args);const r=ab.row,t=now();this.addEventListener('message',()=>{if(r)r.workerMs+=now()-t},{once:true})}};
    const rebuild=V.rebuild.bind(V);V.rebuild=async(...args)=>{const r=ab.row;if(r){r.rebuilds++;r.rebuildStart=now()}try{return await rebuild(...args)}finally{if(r){r.ready=now();r.phase=V.contentEl.dataset.buildPhase;r.resolve()}}};
    ab.event=app.vault.on('modify',f=>{if(ab.row&&f.path==='__kg_native_ab__/Note0.md')ab.row.event=now()});
   }""")
   try:
    for i in range(16):
     row=page.evaluate("""async({text,i})=>{
      const r=ab.row={readMs:0,workerMs:0,reconcileMs:0,saveMs:0,rebuilds:0};
      const ready=new Promise((resolve,reject)=>{r.resolve=resolve;r.timeout=setTimeout(()=>reject(Error('auto rebuild timed out')),15000)});
      r.start=performance.now();const edit=i%4===0?text.replace('H1\\n','Renamed\\n'):i%4===2?text+'\\n# Added\\nextra':text;
      await app.vault.modify(app.vault.getAbstractFileByPath('__kg_native_ab__/Note0.md'),edit);r.fileWritten=performance.now();
      try{await ready}finally{clearTimeout(r.timeout);ab.row=null}
      const verify=performance.now();await P.layoutStore.settled();const disk=await P.loadData(),state=P.layoutStore.state();
      const ok=JSON.stringify(disk.layoutOverrides.groups)===JSON.stringify(state.groups)&&P.pipelineResources.active===0&&r.phase==='ready'&&r.rebuilds===1;
      if(!ok)throw Error('Failed correctness gate');
      return{requestToReadyMs:r.ready-r.start,fileWriteMs:r.fileWritten-r.start,eventToBuildMs:r.rebuildStart-r.event,buildToReadyMs:r.ready-r.rebuildStart,readMs:r.readMs,workerMs:r.workerMs,reconcileMs:r.reconcileMs,saveMs:r.saveMs,reconcileExcludingSaveMs:r.reconcileMs-r.saveMs,postReconcileMs:r.ready-r.reconcileEnd,verificationMs:performance.now()-verify,schemaVersion:state.schemaVersion,recordBytes:new TextEncoder().encode(JSON.stringify(state.groups)).length,nodes:V.graph.data.nodes.length,visibility:document.visibilityState,ok};
     }""",{'text':fixture['files'][0]['text'],'i':i})
     row.update({'trial':trial,'version':version,'edit':i%4,'warmup':i<4,'sha256':digest});rows.append(row)
     page.wait_for_timeout(100)
   finally:
    page.evaluate('()=>{app.vault.cachedRead=ab.read;window.Worker=ab.Worker;app.vault.offref(ab.event);ab.row=null}')
   (OUT/'progress.json').write_text(json.dumps({'order':order,'rows':rows,'errors':errors},indent=2),encoding='utf-8')
   print(json.dumps({'trial':trial+1,'version':version,'medianMs':statistics.median(r['requestToReadyMs'] for r in rows if r['trial']==trial and not r['warmup'])}),flush=True)
 finally:
  page.evaluate("async()=>{await app.plugins.disablePlugin('knowledge-graph-smoke')}")
  for n,data in baseline.items():(TARGET/n).write_bytes(data)
  originalVersion=json.loads(baseline['manifest.json'])['version']
  page.evaluate("async version=>{app.plugins.manifests['knowledge-graph-smoke'].version=version;await app.plugins.enablePlugin('knowledge-graph-smoke');await app.plugins.plugins['knowledge-graph-smoke'].openGraph('vault',true)}",originalVersion)
  current=page.evaluate("async()=>await app.plugins.plugins['knowledge-graph-smoke'].loadData()")
  original=json.loads(baseline['data.json']);assert current['settings']==original['settings'] and current['pipeline']==original['pipeline']
  assert current['layoutOverrides']['groups']==original['layoutOverrides']['groups']
  (OUT/'restore.json').write_text(json.dumps({'runtime':originalVersion,'scopeAndLayoutsRestored':True,'backup':str(backup)}),encoding='utf-8')
 b.close()
metrics=['requestToReadyMs','fileWriteMs','eventToBuildMs','buildToReadyMs','readMs','workerMs','reconcileMs','saveMs','reconcileExcludingSaveMs','postReconcileMs','verificationMs']
summary={v:{k:statistics.median(r[k] for r in rows if r['version']==v and not r['warmup']) for k in metrics} for v in versions}
report={'order':order,'seed':4702,'samplesPerVersion':48,'warmupPerTrial':4,'summary':summary,'rows':rows,'errors':errors,'note':'Same app process; balanced version pairs; 100ms debounce; requestToReady excludes Python polling, disk verification and next-frame paint. Phase timings are nested; do not sum reconcile and save.'}
(OUT/'result.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(summary),flush=True)
