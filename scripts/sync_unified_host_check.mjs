import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';
import {createLayoutStore} from '../dist/graph-core.mjs';
import {fixture,layout,model} from './sync-auto-publish-test-helpers.mjs';
import {testLocalApp,testLockManager,testMemoryStore} from './sync-host-test-helpers.mjs';
import {validateTestSettings} from './sync-settings-test-helpers.mjs';
const checks=[],left=await layout(-20),right=await layout(20);
async function test(name,fn){await fn();checks.push(name);}
async function setup(){
 const transport=await fixture(),app=testLocalApp(),backends=new Map();let source={settings:{language:'zh'},ui:{keep:'yes'},unknown:42,layoutOverrides:left},epoch=0,graph=true,hidden=false,backendOpens=0,checkpoint=async()=>{};
 const options={app,pluginId:'unified-test',adapter:transport.adapter,locks:testLockManager(),readSource:async()=>structuredClone(source),saveUnjoined:async data=>{source=structuredClone(data);},createStore:createLayoutStore,validateSettings:validateTestSettings,
  openBackend:async({vault})=>{backendOpens++;if(!backends.has(vault))backends.set(vault,testMemoryStore());return backends.get(vault);},getGraph:()=>graph?{isCurrent:()=>true,hidden,createModel:model}:null,getEpoch:()=>epoch};
 options.checkpoint=step=>checkpoint(step);const host=await createUnifiedSyncHost(options);
 return {host,app,backends,options,transport,hook:fn=>checkpoint=fn,source:()=>source,setSource:v=>source=v,bump:()=>++epoch,hide:v=>hidden=v,graph:v=>graph=v,backendOpens:()=>backendOpens,async select(){const p=await host.previewSelection({action:'new'});assert.equal(p.kind,'selection-preview');assert.equal((await host.confirmSelection(p.token)).kind,'selected');},async join(){const p=await host.previewJoin();assert.equal(p.kind,'join-preview');return host.confirmJoin(p.token,'import');},async close(){await host.close();await transport.close();}};
}
await test('Unselected startup and cancellation keep old layout and do not mint an identity or acceptance',async()=>{
 const f=await setup();assert.equal(f.app.writes(),0);assert.equal(f.backendOpens(),0);assert.deepEqual(f.host.store.state().groups,left.groups);
 const p=await f.host.previewSelection({action:'new'});f.host.discardSelection(p.token);assert.equal(f.host.state().selected,null);assert.equal(f.backendOpens(),0);await f.close();
});
await test('Selected but unjoined never initializes empty; local edits and canceled join remain local',async()=>{
 const f=await setup();await f.select();assert.equal(f.host.state().session.initialized,false);const p=await f.host.previewJoin();f.host.discardJoin(p.token);
 await f.host.disable();await f.host.saveLayout(right);assert.deepEqual(f.source().layoutOverrides,right);assert.equal((await f.transport.history.scan()).count,0);assert.equal(f.host.state().session.initialized,false);await f.close();
});
await test('Explicit join uses current settings and ordinary saved layout queues automatically',async()=>{
 const f=await setup();await f.select();const p=await f.host.previewJoin();f.setSource({...f.source(),settings:{language:'en'},ui:{keep:'latest'},unknown:99});
 assert.equal((await f.host.confirmJoin(p.token,'import')).kind,'joined');const effective=await f.host.effective();assert.equal(effective.settings.language,'en');assert.equal(effective.ui.keep,'latest');assert.equal(effective.unknown,99);
 const evidence=await f.host.joinEvidence();assert.deepEqual(evidence.backup.layoutOverrides.groups,left.groups);assert.ok(evidence.proof);
 await f.host.saveLayout(right);await f.host.settled();assert.equal(f.host.state().session.accepted.operations.length,2);assert.deepEqual(f.host.state().session.accepted.snapshot.groups,right.groups);await f.close();
});
await test('A changed layout invalidates join consent; external configuration is observed without accepting its layout',async()=>{
 const f=await setup();await f.select();const p=await f.host.previewJoin();f.setSource({...f.source(),layoutOverrides:right});assert.equal((await f.host.confirmJoin(p.token,'import')).kind,'held');assert.equal(f.host.state().session.initialized,false);
 await f.join();const ids=f.host.state().session.accepted.appliedIds;f.setSource({...f.source(),settings:{language:'en'},layoutOverrides:left});await f.host.notifyExternalChange();const d=await f.host.effective();assert.equal(d.settings.language,'en');assert.deepEqual(f.host.state().session.accepted.appliedIds,ids);assert.deepEqual(d.layoutOverrides.groups,right.groups);await f.close();
});
await test('Disable preserves local work and reenable never publishes restored drafts automatically',async()=>{
 const f=await setup();await f.select();await f.join();await f.host.disable();await f.host.saveLayout(right);assert.equal(f.host.state().session.accepted.operations.length,1);const before=f.host.state().session.localState.layoutDraft.id;
 await f.host.enable();await f.host.settled();assert.equal(f.host.state().session.localState.layoutDraft.id,before);assert.equal(f.host.state().session.accepted.operations.length,1);await f.host.resumePublication({confirmed:true});await f.host.settled();assert.equal(f.host.state().session.accepted.operations.length,2);await f.close();
});
await test('No graph or hidden graph holds publishing and cold reopen preserves signed identity and drafts',async()=>{
 const f=await setup();await f.select();await f.join();f.hide(true);await f.host.saveLayout(right);await f.host.settled();const id=f.host.state().session.pending?.id,installation=f.host.state().installation;await f.host.close();
 const h=await createUnifiedSyncHost(f.options);await h.settled();assert.equal(h.state().installation,installation);assert.equal(h.state().session.accepted.operations.length,1);assert.ok(h.state().session.localState.layoutDraft);f.hide(false);f.graph(false);assert.equal((await h.resumePublication({confirmed:true})).kind,'held');f.graph(true);await h.resumePublication({confirmed:true});await h.settled();assert.equal(h.state().session.accepted.operations.length,2);await h.close();await f.transport.close();
});
await test('Switching after disable retains the original signed ledger and opens an unjoined selection',async()=>{
 const f=await setup();await f.select();await f.join();const original=f.host.state().selected.vault;await f.host.disable();const files=new Map(f.backends.get(original).files);
 const preview=await f.host.previewSelection({action:'new'});assert.equal((await f.host.confirmSelection(preview.token)).kind,'selected');assert.notEqual(f.host.state().selected.vault,original);assert.equal(f.host.state().session.initialized,false);assert.deepEqual(f.backends.get(original).files,files);await f.close();
});
await test('Missing identity preserves original records and rejects all save paths',async()=>{
 const f=await setup();await f.select();await f.join();await f.host.close();f.app.entries.delete('unified-test:sync-v2:device');const before=f.app.writes(),h=await createUnifiedSyncHost(f.options);
 assert.equal(h.state().status,'recovery-required');await assert.rejects(h.saveSettings({settings:{language:'en'},pipeline:{}}));await assert.rejects(h.saveUi('x','y'));await assert.rejects(h.saveLayout(right));assert.equal(f.app.writes(),before);await h.close();await f.transport.close();
});
await test('Private soft limit rejects a saved-success result and preserves the original acceptance',async()=>{
 const f=await setup();await f.select();await f.join();const s=f.host.state(),back=f.backends.get(s.selected.vault),ids=s.session.accepted.appliedIds;
 for(let i=0;i<4100;i++)back.files.set('capacity/'+i,'x');await assert.rejects(f.host.saveLayout(right),/private-storage-budget/);assert.deepEqual(f.host.state().session.accepted.appliedIds,ids);assert.equal(f.host.state().session.localState?.layoutDraft??null,null);await assert.rejects(f.host.saveSettings({settings:{language:'en'},pipeline:{}}));await f.close();
});
await test('Settings and UI saves retain accepted layout and the newer durable layout draft',async()=>{
 const f=await setup();await f.select();await f.join();f.hide(true);await f.host.saveLayout(right);const draft=f.host.state().session.localState.layoutDraft;
 await f.host.saveSettings({settings:{language:'en'},pipeline:{}});await f.host.saveUi('legend','false');const effective=await f.host.effective();assert.equal(effective.settings.language,'en');assert.equal(effective.ui.legend,'false');assert.equal(effective.unknown,42);assert.deepEqual(f.host.state().session.localState.layoutDraft,draft);assert.deepEqual(effective.layoutOverrides.groups,left.groups);await f.close();
});
await test('Conflicting external settings stay pending rather than overwrite a local preference',async()=>{
 const f=await setup();await f.select();await f.join();await f.host.saveSettings({settings:{language:'en'},pipeline:{}});f.setSource({...f.source(),settings:{language:'auto'}});
 assert.equal((await f.host.notifyExternalChange()).kind,'review-required');assert.equal((await f.host.effective()).settings.language,'en');await f.close();
});
await test('No graph and an edit reservation hold joins without accepting or clearing the source',async()=>{
 const f=await setup();await f.select();f.graph(false);assert.equal((await f.host.previewJoin()).reason,'graph-unavailable');assert.equal(f.host.state().session.initialized,false);await f.close();
 const g=await setup();await g.select();const p=await g.host.previewJoin(),guard=g.host.store.reserveExternal(v=>v);assert.equal((await g.host.confirmJoin(p.token,'import')).reason,'layout-busy');assert.equal(g.host.state().session.initialized,false);guard.release();await g.close();
});
await test('A graph change after durable join defers its view without losing the publication queue',async()=>{
 const f=await setup();await f.select();let once=true;f.hook(async step=>{if(step==='after-accept'&&once){once=false;f.bump();}});assert.equal((await f.join()).reason,'join-view-deferred');assert.ok(f.host.state().publication);await f.host.graphReady();await f.host.saveLayout(right);await f.host.settled();assert.equal(f.host.state().session.accepted.operations.length,2);await f.close();
});
await test('A visibility wake publishes an armed ordinary draft while restored work remains gated',async()=>{
 const f=await setup();await f.select();await f.join();f.hide(true);await f.host.saveLayout(right);await f.host.settled();assert.equal(f.host.state().session.accepted.operations.length,1);f.hide(false);await f.host.resumePublication();assert.equal(f.host.state().session.accepted.operations.length,2);await f.close();
});
await test('Legacy v2 selection permits read-only adoption and receive without an automatic writer',async()=>{
 const f=await setup(),remote=await fixture();await remote.save(left);await remote.queue.settled();const op=remote.session.state().accepted.operations[0],root='Knowledge Map Sync/v2/'+op.vault+'/ops';
 for(const p of ['Knowledge Map Sync','Knowledge Map Sync/v2','Knowledge Map Sync/v2/'+op.vault,root])await f.transport.adapter.mkdir(p);
 await f.transport.adapter.writeBinary(root+'/'+op.id+'.json',new TextEncoder().encode(JSON.stringify(op)).buffer);
 f.transport.adapter.read=async p=>new TextDecoder().decode(await f.transport.adapter.readBinary(p));
 const selection=await f.host.previewSelection({action:'join',vault:op.vault,transport:'v2'});assert.equal((await f.host.confirmSelection(selection.token)).kind,'selected');const preview=await f.host.previewJoin();assert.equal(preview.canImport,false);assert.equal((await f.host.confirmJoin(preview.token,'shared')).kind,'joined');assert.equal(f.host.canReceive(),true);assert.equal((await f.host.receive()).kind,'noop');assert.equal(f.host.state().publication,null);await f.close();await remote.close();
});
await test('Ending the layout edit wakes an ordinary draft held by the real store lock',async()=>{const f=await setup();await f.select();await f.join();const guard=f.host.store.reserveExternal(x=>x);await f.host.saveLayout(right);await f.host.settled();assert.equal(f.host.state().session.accepted.operations.length,1);assert.equal(f.host.state().publication.lastResult.reason,'layout-busy');guard.release();await f.host.settled();assert.equal(f.host.state().session.accepted.operations.length,2);await f.close();});
await test('An edit ending before the busy result is delivered still retries once',async()=>{const f=await setup();await f.select();await f.join();const reserve=f.host.store.reserveExternal,guard=reserve(x=>x);let once=true;f.host.store.reserveExternal=fn=>{const result=reserve(fn);if(!result&&once){once=false;guard.release();}return result;};await f.host.saveLayout(right);await f.host.settled();assert.equal(f.host.state().session.accepted.operations.length,2);await f.close();});
await fs.mkdir('.local/sync-016/unified/u3',{recursive:true});await fs.writeFile('.local/sync-016/unified/u3/host-check.json',JSON.stringify({passed:checks.length,checks},null,2));console.log(JSON.stringify({passed:checks.length,checks}));
