"""Actual owned Windows Obsidian graph/buttons with deliberate adapter faults.
No user vaults, sync service, physical disk failure or native iPad claims.
"""
import argparse,json,time
from pathlib import Path
from playwright.sync_api import sync_playwright
from sync_registry_native_check import prepare,launch,within,dismiss_owned_dialog
def run(prep,seeded=False):
 meta=prepare(prep,'g5');out=within(meta['out']);browser=None;checks=[];states={}
 with sync_playwright() as pw:
  def connect():
   nonlocal browser,page,ui
   launch(meta)
   for _ in range(150):
    try:browser=pw.chromium.connect_over_cdp('http://127.0.0.1:'+str(meta['port']));break
    except Exception:time.sleep(.1)
   else:raise AssertionError('Owned profile unavailable')
   found={}
   for _ in range(150):
    for c in browser.contexts:
     for p in c.pages:
      try:
       actual=p.evaluate('window.app?.vault?.adapter?.basePath')
       for role,wanted in meta['paths'].items():
        if actual and Path(actual).resolve()==within(wanted):found[role]=p
      except Exception:pass
    if len(found)==2:break
    time.sleep(.1)
   assert len(found)==2
   for p in found.values():
    p.on('dialog',dismiss_owned_dialog);p.wait_for_function("!!window.app?.plugins?.getPlugin('knowledge-map-sync-unified')?.syncHost || document.body.innerText.includes('信任仓库作者并启用插件')",timeout=30000)
    trust=p.get_by_role('button',name='信任仓库作者并启用插件')
    if trust.count():trust.click();p.wait_for_timeout(2000)
    p.wait_for_function("!!window.app?.plugins?.getPlugin('knowledge-map-sync-unified')?.syncHost",timeout=30000)
   page=found['A'];ui=None
  def stop():
   nonlocal browser
   if browser:
    try:browser.new_browser_cdp_session().send('Browser.close')
    except Exception as e:
     if 'closed' not in str(e).lower():raise
    browser=None;time.sleep(.8)
  def js(code,arg=None):return page.evaluate(code,arg)
  def state():return js("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.state()")
  def settle():js("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.settled()")
  def graph():
   js("async()=>{app.setting.close();await app.commands.commands['knowledge-map-sync-unified:build-vault-graph'].callback()}")
   page.wait_for_function("!!app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0]?.view.graph",timeout=30000);settle()
   if state()['session'] and state()['session']['initialized']:page.wait_for_function("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.canReceive()",timeout=15000)
  def settings():
   nonlocal ui
   js("app.setting.open();app.setting.openTabById('knowledge-map-sync-unified');app.setting.win.document.documentElement.dataset.g5='true'")
   for _ in range(100):
    targets=[p for c in browser.contexts for p in c.pages if p.locator('html[data-g5] .kg-sync-settings').count()]
    if targets:ui=targets[0];return
    time.sleep(.05)
   raise AssertionError('Owned settings target missing')
  def click(selector):
   ui.locator(selector).click(timeout=10000);settle()
   ui.wait_for_function("!!document.querySelector('.modal [data-sync-confirm], .modal [data-join-confirm], .modal [data-resolution-confirm]') || document.querySelector('.kg-sync-settings [data-sync-action=\"export\"]')?.disabled===false",timeout=10000)
  def action(name):
   if name=='check':
    page.wait_for_function("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.canReceive()",timeout=15000)
   click('[data-sync-action="'+name+'"]')
  def init_io():
   js(r'''()=>{const p=app.plugins.getPlugin('knowledge-map-sync-unified'),a=app.vault.adapter;window.g5={p,a,dir:()=> 'Knowledge Map Sync/attempts-v1/'+p.syncHost.state().selected.vault+'/ops',canon(v){if(Array.isArray(v))return v.map(x=>this.canon(x));if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,this.canon(v[k])]));return v},async hash(b){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('')},async snapshot(){const out={};for(const f of (await a.list(this.dir())).files)out[f]=await this.hash(await a.readBinary(f));return out},async writeOp(op){const body=new TextEncoder().encode(JSON.stringify(this.canon(op))),hash=await this.hash(body),nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join(''),name=this.dir()+'/'+op.id+'.'+hash+'.'+nonce+'.json';await a.writeBinary(name,body.buffer);return name},async backup(name,label){if(!await a.exists('G5 Backups'))await a.mkdir('G5 Backups');const target='G5 Backups/'+label+'.json';await a.rename(name,target);return target}}}''')
  def snapshot():return js('g5.snapshot()')
  def drag(dx):
   graph()
   if page.locator('#legend-toggle').get_attribute('aria-expanded')=='true':page.locator('#legend-toggle').click()
   js("()=>{const r=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view.graph.renderer,n=r.NODES.find(n=>n.path==='Synthetic/A.md'&&n.title==='Second');r.focusOn(n.id,1.25,0)}")
   page.locator('#layout-mode').click();page.wait_for_timeout(150)
   point=js("()=>{const v=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view,r=v.graph.renderer,n=r.NODES.find(n=>n.path==='Synthetic/A.md'&&n.title==='Second'),c=v.host.shadowRoot.getElementById('cv').getBoundingClientRect();return {x:c.left+n.x*r.camera.zoom+r.camera.panX,y:c.top+n.y*r.camera.zoom+r.camera.panY}}")
   assert js("p=>app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view.host.shadowRoot.elementFromPoint(p.x,p.y)?.id",point)=='cv'
   page.mouse.move(point['x'],point['y']);page.mouse.down();page.mouse.move(point['x']+dx,point['y']+8,steps=12);page.mouse.up();page.locator('#layout-mode').click();settle()
  page=None;ui=None
  try:
   connect();graph();settings()
   if seeded:
    action('find');ui.locator('[data-sync-picker]').select_option('0');action('choose');click('[data-sync-confirm]');choice='shared'
   else:action('new');click('[data-sync-confirm]');choice='import'
   action('join');click('[data-join-choice='+choice+']');click('[data-join-confirm]');assert len(state()['session']['accepted']['operations'])==1;page.wait_for_function("app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.canReceive()",timeout=15000);init_io();original=state()['session']['accepted'];original_files=snapshot();checks.append('Actual graph and ordinary reviewed '+choice+' join accept one original operation')
   js("async()=>{g5.unknown=g5.dir()+'/unexpected.json';await g5.a.writeBinary(g5.unknown,new TextEncoder().encode('{\"unknown\":true}').buffer)}");action('check');assert state()['outcome']['reason']=='unknown-file-name';assert state()['session']['accepted']==original;js("g5.backup(g5.unknown,'unknown-original')");action('check');assert state()['outcome']['kind']=='noop';checks.append('Unknown file blocks native check, remains backed up, and does not alter accepted layout')
   first=next(iter(original_files));page.evaluate("async name=>{g5.missing=name;g5.missingBackup=await g5.backup(name,'missing-original')}",first);action('check');assert state()['outcome']['reason']=='accepted-record-missing';assert state()['session']['accepted']==original;js('g5.a.rename(g5.missingBackup,g5.missing)');action('check');assert state()['outcome']['kind']=='noop';checks.append('Missing accepted original holds layout; restoring exact original makes native check noop')
   js("async()=>{const op=structuredClone(g5.p.syncHost.state().session.accepted.operations[0]);op.changes[0].value.points[0].x+=.01;g5.bad=await g5.writeOp(op)}");action('check');assert state()['session']['attemptConflict'];action('recover-shared');assert ui.locator('[data-sync-confirm]').count()==0;js("g5.backup(g5.bad,'same-id-original')");action('recover-shared');click('[data-sync-cancel]');assert state()['session']['attemptConflict'];checks.append('Persistent collision is visible; unsafe input rejected and recovery cancel is inert')
   stop();connect();graph();init_io();settings();assert state()['session']['attemptConflict'];action('recover-shared');js("g5.writeOp(g5.p.syncHost.state().session.accepted.operations[0])");click('[data-sync-confirm]');assert state()['session']['attemptConflict'];action('recover-shared');before=snapshot();click('[data-sync-confirm]');assert not state()['session']['attemptConflict'];assert snapshot()==before;assert state()['session']['accepted']==original;action('check');checks.append('Actual process cold reopen retains quarantine; changed input requires fresh recovery confirmation without shared writes')
   for mode in ['partial','commit','epoch','source']:
    js(r'''mode=>{const a=g5.a,write=a.writeBinary.bind(a);g5.originalWrite=write;g5.faultPath=null;g5.mode=mode;g5.once=true;if(mode==='commit'){const add=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(value,...args){if(g5.commitFailure&&String(value?.key).includes('/events/')){g5.commitFailure=false;IDBObjectStore.prototype.add=add;throw Error('G5 injected private journal failure')}return add.call(this,value,...args)}}a.writeBinary=async(name,bytes)=>{if(g5.once&&name.startsWith(g5.dir()+'/')){g5.once=false;g5.faultPath=name;if(mode==='partial'){await write(name,bytes.slice(0,83));throw Error('G5 injected partial write')}await write(name,bytes);if(mode==='commit')g5.commitFailure=true;if(mode==='epoch')g5.p.layoutEpoch=(g5.p.layoutEpoch??0)+1;if(mode==='source'){await a.process(app.vault.configDir+'/plugins/knowledge-map-sync-unified/data.json',raw=>JSON.stringify({...JSON.parse(raw),g5SourceChanged:true}));void g5.p.onExternalSettingsChange()}return}return write(name,bytes)}}''',mode)
    drag(23);page.wait_for_function("!!app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.state().session.pending",timeout=10000);settle();s=state();pending=s['session']['pending'];assert pending;pending_id=pending['id'];fault_path=js('g5.faultPath');assert fault_path
    states[mode+'-fault']=s;before=snapshot();stop();connect();graph();init_io();settings();assert state()['session']['pending']['id']==pending_id;assert snapshot()==before;action('restore');click('[data-sync-cancel]');assert state()['session']['pending']['id']==pending_id;action('restore');click('[data-sync-confirm]');page.wait_for_function("!app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.state().session.pending",timeout=10000);settle();assert pending_id in state()['session']['accepted']['appliedIds'];after=snapshot();assert all(after.get(k)==v for k,v in before.items());checks.append(mode+' fault via actual adapter/private journal/epoch/source boundary keeps original ID through process cold open and reviewed recovery');states[mode+'-recovered']=state()
   final=state();settings();ui.locator('.kg-sync-settings').screenshot(path=str(out/'g5-final.png'));result={'pass':True,'checks':checks,'states':states,'final':final,'shared':snapshot(),'scope':'Actual owned Windows Obsidian graph/canvas/buttons and process restarts; deliberate adapter/IndexedDB/epoch/source injection, not real hardware corruption, Nutstore or iPad.'};(out/'g5-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'pass':True,'checks':len(checks),'out':str(out)}))
  except Exception:
   if browser:
    try:
     (out/'failure.json').write_text(json.dumps({'checks':checks,'state':state(),'telemetry':js("({hidden:document.hidden,epoch:app.plugins.getPlugin('knowledge-map-sync-unified').layoutEpoch,receive:app.plugins.getPlugin('knowledge-map-sync-unified').syncReceiveStatus,canReceive:app.plugins.getPlugin('knowledge-map-sync-unified').syncHost.canReceive()})"),'settings':ui.locator('.kg-sync-settings').text_content() if ui else None},ensure_ascii=False,indent=2),encoding='utf-8')
     if ui:ui.screenshot(path=str(out/'failure.png'))
    except Exception:pass
   raise
  finally:stop()
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('preparation');a.add_argument('--seeded',action='store_true');args=a.parse_args();run(args.preparation,args.seeded)
