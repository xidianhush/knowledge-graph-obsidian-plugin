// Old candidate journal compatibility is distinct from formal 0.0.15 data.json.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {device,state} from './sync-g4-helpers.mjs';
import {testMemoryStore} from './sync-host-test-helpers.mjs';
import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';
import {createAttemptHistory} from '../src/sync/attempt-history-prototype.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),id=n=>n.toString(16).padStart(32,'0');
const old=await fs.readFile('.local/g7-legacy-g5-main.js','utf8');assert.equal(sha(old),'97b9e0b6403afe0f897f02f0cc2f45af23a52bcd70fd482d5591c4d7cbcb35f2');
class Base{};const api={Plugin:Base,ItemView:Base,PluginSettingTab:Base,Setting:Base,Scope:Base,Modal:Base,Notice:Base,Platform:{},addIcon(){}};
// Same JS realm: otherwise Object.prototype checks reject the test adapters,
// before any journal is read. Public code is pinned by the exact SHA above.
const oldModule=new Function('require','module',old+'\n;return loadProbeModule("src/sync/obsidian-unified-host.mjs");')(()=>api,{exports:{}});
const d=await device(),checks=[];let oldHost;
try{
 await d.select();let once=true;d.hook(step=>{if(once&&step==='after-publication-intent'){once=false;throw Error('G7 unwritten pending');}});
 const c=d.capture('Synthetic/A.md',81);await d.h.store.command({},'edit',c.key,c.value);await d.h.settled();d.hook(()=>{});await d.h.close();d.h=await createUnifiedSyncHost(d.options);assert.ok(state(d).pending);
 const hist=createAttemptHistory(d.io.adapter,d.h.state().selected.vault),scan=await hist.scan(),row=scan.inventory[0],body=new TextDecoder().decode(await d.io.adapter.readBinary(row.name));
 for(let n=1;n<1024;n++)await hist.write(await hist.allocate(scan.records[0].id,row.hash,[]),body);
 const destination={...testMemoryStore(),location:'Synthetic G7 preservation'};await d.h.exportRecovery({destination,id:id(1)});const preview=await d.h.previewAbandonPublication({destination,id:id(1)});assert.equal((await d.h.confirmAbandonPublication(preview.token)).kind,'abandoned');
 assert.equal(state(d).pending,null);assert.ok(state(d).localState.layoutDraft);await d.h.disable();const expected=structuredClone(state(d)),selected=d.h.state().selected,installation=d.h.state().installation;
 const backend=await d.options.openBackend({vault:selected.vault});await d.h.close();const files=[...backend.files];
 checks.push('Current host created an authenticated publication-abandoned event while preserving draft, intent and 1024 physical attempts');
 oldHost=await oldModule.createUnifiedSyncHost(d.options);const oldState=oldHost.state();assert.equal(oldState.status,'recovery-required');assert.ok(oldState.error);assert.deepEqual([...backend.files],files);assert.equal((await hist.scan()).inventory.length,1024);await oldHost.close();oldHost=null;
 checks.push('Exact frozen G5 candidate rejects the newer signed journal without rewriting private files or shared history');
 d.h=await createUnifiedSyncHost(d.options);assert.equal(d.h.state().installation,installation);assert.deepEqual(d.h.state().selected,selected);assert.deepEqual(state(d),expected);assert.equal(d.h.state().status,'local-ready');
 checks.push('Returning to current candidate replays the original abandoned intent and saved draft with original identity and connection');
 await fs.mkdir('.local/sync-016/g7',{recursive:true});const out=await fs.mkdtemp('.local/sync-016/g7/downgrade-');await fs.writeFile(out+'/summary.json',JSON.stringify({pass:true,out,checks,oldMain:sha(old),oldRefusal:{status:oldState.status,error:oldState.error},scope:'Exact G5 candidate module code in isolated VM over synthetic signed stores; duplicate physical attempts force a publication branch, not a distinct-operation capacity measurement. Not actual0.0.15, native/iPad or process interruption.'},null,2));console.log(JSON.stringify({pass:true,out,checks}));
}finally{await oldHost?.close();await d.h.close();await d.io.close();}
