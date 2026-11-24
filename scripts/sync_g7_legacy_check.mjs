// Execute the exact archived release, not an imitation of its data reader.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {device,state} from './sync-g4-helpers.mjs';
import {testMemoryStore} from './sync-host-test-helpers.mjs';
import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';
import {readCompatibilityExport} from '../src/sync/local-work-prototype.mjs';
const root=process.cwd(),checks=[],id=n=>n.toString(16).padStart(32,'0'),sha=b=>createHash('sha256').update(b).digest('hex'),plain=v=>JSON.parse(JSON.stringify(v));
const legacyBase=process.env.G7_LEGACY_DIR??path.join(root,'.local/g7-legacy-0.0.15');
const legacy=await fs.readFile(path.join(legacyBase,'main.js'),'utf8');
assert.equal(sha(legacy),'8801c3a3e5c2d96fcd6d230e8b703eac8472ac815e677e915c81c23249411391');
const manifest=JSON.parse(await fs.readFile(path.join(legacyBase,'manifest.json'),'utf8'));assert.equal(manifest.version,'0.0.15');assert.equal(manifest.id,'knowledge-graph-smoke');
checks.push('Exact archived formal 0.0.15 main SHA and true manifest verified');
function oldPlugin(data){
 let disk=plain(data),writes=0;
 class Plugin{loadData(){return Promise.resolve(plain(disk));}async saveData(next){disk=plain(next);writes++;}registerEvent(){}registerView(){}addCommand(){}addRibbonIcon(){}addSettingTab(){}}
 class Base{};const api={Plugin,ItemView:Base,PluginSettingTab:Base,Setting:Base,Scope:Base,Notice:Base,Platform:{},moment:{locale:()=> 'en'},addIcon(){}};
 const context={module:{exports:{}},require:()=>api,console,setTimeout,clearTimeout,TextEncoder,TextDecoder,URL,AbortController,structuredClone};vm.runInNewContext(legacy+'\n;globalThis.G7legacy={buildGraph,createLayoutModel};',context);
 const plugin=new context.module.exports();plugin.app={vault:{on:()=>({})},workspace:{getLeavesOfType:()=>[],detachLeavesOfType(){}}};plugin.manifest=manifest;
 return {plugin,context,disk:()=>plain(disk),writes:()=>writes};
}
for(const choice of ['accepted','draft']){
 const d=await device();try{
  d.setSource({...d.source(),settings:{language:'en'},ui:{legend:'false',keep:'g7'},unknown:{g7:'preserved'}});await d.select();
  await d.h.saveUi('legend','true');await d.h.disable();const capture=d.capture('Synthetic/A.md',105);await d.h.store.command({},'edit',capture.key,capture.value);await d.h.settled();
  const before=structuredClone(state(d)),selected=d.h.state().selected,installation=d.h.state().installation,output={...testMemoryStore(),location:'G7 Recovery'};
  await d.h.exportRecovery({destination:output,id:id(1)});const p=await d.h.previewRollback({destination:output,id:id(1),choice});await d.h.confirmRollback(p.token);
  const exported=await readCompatibilityExport({source:output,id:p.exportId}),old=oldPlugin(exported);await old.plugin.onload();
  assert.deepEqual(plain(old.plugin.savedData.layoutOverrides),exported.layoutOverrides);assert.equal(old.plugin.savedData.ui.legend,'true');assert.deepEqual(plain(old.plugin.savedData.unknown),{g7:'preserved'});assert.equal(old.writes(),0);
  const graph=old.context.G7legacy.buildGraph({files:d.files(),config:{include:['Synthetic/**']}}),model=old.context.G7legacy.createLayoutModel(graph.nodes,graph.meta.layout_root_radius);
  const applied=model.apply(exported.layoutOverrides);assert.equal(applied.restored,2);assert.equal(applied.skipped,0);
  checks.push('Actual 0.0.15 loads '+choice+' schema3 geometry and preserves current settings/UI/unknown fields without load writes');
  const next=d.capture('Synthetic/B.md',-53);await old.plugin.layoutStore.command({},'edit',next.key,next.value);await old.plugin.settingsSaveQueue;
  const oldEdited=old.disk();assert.notDeepEqual(oldEdited.layoutOverrides.groups,exported.layoutOverrides.groups);assert.deepEqual(oldEdited.unknown,exported.unknown);assert.equal(oldEdited.ui.legend,'true');
  old.plugin.onunload();const reopened=oldPlugin(oldEdited);await reopened.plugin.onload();assert.deepEqual(plain(reopened.plugin.layoutStore.state().groups),oldEdited.layoutOverrides.groups);reopened.plugin.onunload();
  checks.push('Actual 0.0.15 saves an additional group edit and reloads exact geometry/unknown/UI for '+choice);
  await d.h.close();d.setSource(oldEdited);d.h=await createUnifiedSyncHost(d.options);
  assert.equal(d.h.state().installation,installation);assert.deepEqual(d.h.state().selected,selected);assert.equal(d.h.state().status,'local-ready');assert.deepEqual(state(d).accepted,before.accepted);assert.deepEqual(state(d).localState.layoutDraft,before.localState.layoutDraft);
  assert.deepEqual(d.source(),oldEdited);assert.equal(state(d).pending,null);assert.equal(d.h.state().publication?.armed??false,false);
  checks.push('Candidate return retains original identity/connection/accepted/draft and leaves old-edited data.json independent without publication for '+choice);
 }finally{await d.h.close();await d.io.close();}
}
await fs.mkdir('.local/sync-016/g7',{recursive:true});const out=await fs.mkdtemp('.local/sync-016/g7/legacy-');
await fs.writeFile(out+'/summary.json',JSON.stringify({pass:true,out,checks,legacyMain:sha(legacy),scope:'Actual formal release VM Plugin load/save/store and fresh host instances over synthetic App/private/shared adapters; not real Obsidian process/iPad or OS failure'},null,2));console.log(JSON.stringify({pass:true,out,checks}));
