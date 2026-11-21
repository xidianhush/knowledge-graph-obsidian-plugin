import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixture,layout,vault,pluginId,value} from './sync-local-work-test-helpers.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';
import {readCompatibilityExport} from '../src/sync/local-work-prototype.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url)),BASE=path.join(ROOT,'.local/sync-016/a3/local-work'),id='e'.repeat(32);
await fsp.mkdir(BASE,{recursive:true});
async function make(dir,{hook=()=>{}}={}){
  const local=path.join(dir,'device-local.json'),read=()=>fs.existsSync(local)?JSON.parse(fs.readFileSync(local,'utf8')):{},app={loadLocalStorage:key=>read()[key]??null,saveLocalStorage:(key,value)=>fs.writeFileSync(local,JSON.stringify({...read(),[key]:value}))};
  const f=await fixture({app,shared:createNodeSyncStore(path.join(dir,'shared')),backend:vault=>createNodeSyncStore(path.join(dir,vault,'private'),{onStep:(step,name)=>hook('private:'+step+':'+name)})});f.hook(hook);
  const destination=createNodeSyncStore(path.join(dir,'exports'),{onStep:(step,name)=>hook('export:'+step+':'+name)});
  return {...f,destination};
}
const restoreSource=async()=>({settingsVersion:1,settings:{language:'zh'},layoutOverrides:await layout(),ui:{legend:'foreign'},unknown:{safelyArchived:true}});
if(process.argv[2]==='--crash'){
  const dir=path.resolve(process.argv[3]),mode=process.argv[4],point=process.argv[5],relative=path.relative(BASE,dir);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));let armed=false;
  const f=await make(dir,{hook:step=>{if(armed&&(step===point||point==='private:event-partial'&&/^private:temp-partial:events\//.test(step)||point==='private:event-installed'&&/^private:installed:events\//.test(step)))process.exit(86);}});
  await f.controller.disable();await f.host.open();const snapshot=await layout();
  if(mode==='settings'){const d=value(await f.host.beginSettings());d.value.settings.language='zh';value(await f.host.updateSettings(d.id,d.value));armed=true;await f.host.saveSettings(d.id);}
  else if(mode==='layout'){armed=true;await f.host.saveLayout(snapshot);}
  else if(mode==='restore'){const review=value(await f.host.prepareRestore(await restoreSource()));armed=true;await f.host.applyRestore(review.token);}
  else {value(await f.host.saveLayout(snapshot));value(await f.host.saveUi('legend',true));armed=true;await f.host.exportCompatibility({destination:f.destination,id});}
  throw Error('checkpoint not reached: '+point);
}else{
  const checks=[],crashes=[];async function test(name,fn){await fn();checks.push(name);}
  await test('Real signed local settings, UI and edited geometry survive cold reopen with sync still disabled',async()=>{
    const dir=await fsp.mkdtemp(path.join(BASE,'disk-')),f=await make(dir);await f.controller.disable();await f.host.open();const n=f.sharedCalls(),snapshot=await layout(),d=value(await f.host.beginSettings());d.value.settings.language='zh';value(await f.host.updateSettings(d.id,d.value));value(await f.host.saveSettings(d.id));value(await f.host.saveUi('legend',true));value(await f.host.saveLayout(snapshot));const accepted=f.current().session.state().accepted;await f.controller.disable();const cold=await make(dir);await cold.host.open();assert.deepEqual((await cold.host.view()).data.layoutOverrides,snapshot);assert.equal((await cold.host.view()).data.settings.language,'zh');assert.equal((await cold.host.view()).data.ui.legend,'true');assert.deepEqual(cold.current().session.state().accepted,accepted);assert.equal(f.sharedCalls(),n);assert.equal(cold.sharedCalls(),0);assert.equal(cold.device.state().connection.enabled,false);await cold.controller.disable();
  });
  await test('Real compatibility package restores only reviewed drafts and preserves original effective settings',async()=>{
    const dir=await fsp.mkdtemp(path.join(BASE,'export-')),f=await make(dir);await f.controller.disable();await f.host.open();value(await f.host.saveLayout(await layout()));await f.host.exportCompatibility({destination:f.destination,id});const data=await readCompatibilityExport({source:f.destination,id});await f.controller.disable();const freshDir=await fsp.mkdtemp(path.join(BASE,'restore-')),target=await make(freshDir);await target.controller.disable();await target.host.open();const before=target.current().session.state().accepted,p=value(await target.host.prepareRestore(data));assert.equal(value(await target.host.applyRestore(p.token)).kind,'restore-staged');assert.deepEqual(target.current().session.state().accepted,before);assert.equal(target.current().session.state().pending,null);assert.equal((await target.current().projection.documentStore.read()).data.settings.language,'auto');assert.deepEqual(target.current().coordinator.state().restoreSource,data);await target.controller.disable();
  });
  for(const [mode,points]of [
    ['layout',['private:event-partial','private:event-installed','core:after-local-state']],
    ['settings',['core:before-local-document','core:after-local-document','core:after-local-state']],
    ['restore',['coordinator:before-restore-drafts','private:event-partial','private:event-installed','coordinator:after-restore-drafts']],
    ['export',['export:temp-partial:'+id+'/data.json','export:installed:'+id+'/data.json','export:temp-partial:'+id+'/manifest.json','export:installed:'+id+'/manifest.json']],
  ])for(const point of points)await test('Actual local-only process exit '+mode+': '+point,async()=>{
    const dir=await fsp.mkdtemp(path.join(BASE,'crash-')),child=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--crash',dir,mode,point],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:20000});assert.equal(child.status,86,child.stderr||child.error?.message);const f=await make(dir);assert.equal(f.controller.state().status,'disabled');await f.host.open();assert.equal(f.device.state().connection.enabled,false);assert.equal(f.sharedCalls(),0);assert.equal(f.current().session.state().pending,null);assert.equal(f.current().session.state().accepted.appliedIds.length,0);const local=f.current().coordinator.state();
    if(mode==='layout'){assert.equal(Boolean(local.layoutDraft),point!=='private:event-partial');if(local.layoutDraft)assert.deepEqual(local.layoutDraft.value,await layout());}
    else if(mode==='settings'){assert.ok(local.settingsDraft);assert.equal(local.settingsDraft.value.settings.language,'zh');await f.controller.runLocal(b=>b.coordinator.resume());const draft=f.current().coordinator.state().settingsDraft;if(draft)value(await f.host.saveSettings(draft.id));assert.equal((await f.host.view()).data.settings.language,'zh');}
    else if(mode==='restore'){const committed=['private:event-installed','coordinator:after-restore-drafts'].includes(point);assert.equal(Boolean(local.restoreSource),committed);assert.equal(Boolean(local.settingsDraft),committed);assert.equal(Boolean(local.layoutDraft),committed);if(committed)assert.deepEqual(local.restoreSource,await restoreSource());else {const p=value(await f.host.prepareRestore(await restoreSource()));assert.equal(value(await f.host.applyRestore(p.token)).kind,'restore-staged');}}
    else {await f.host.exportCompatibility({destination:f.destination,id});const data=await readCompatibilityExport({source:f.destination,id});assert.deepEqual(data.layoutOverrides,await layout());assert.equal(data.ui.legend,'true');}
    const deviceFile=JSON.parse(await fsp.readFile(path.join(dir,'device-local.json'),'utf8'));assert.equal(deviceFile[pluginId+':sync-v2:device'].connection.enabled,false);await f.controller.disable();crashes.push({mode,point,exitCode:86});
  });
  const result={date:'2026-11-08 Asia/Shanghai',passed:checks.length,checks,actualChildCrashes:crashes,scope:'Signed real Node files, no-replace link and actual process exits during local-only writes/restores/compatibility export. App and locks are test substitutes; no native/iPad, power-loss or production UI claim.'};await fsp.writeFile(path.join(BASE,'local-work-disk-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:checks.length,processCrashes:crashes.length}));
}
