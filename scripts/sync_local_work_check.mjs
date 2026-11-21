import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture,layout,model,graph,source,vault,other,empty,value} from './sync-local-work-test-helpers.mjs';
import {testLocalApp,testLockManager,testMemoryStore} from './sync-host-test-helpers.mjs';
import {createLayoutEditor,createLayoutModel} from '../dist/graph-core.mjs';
import {createLayoutModel as legacy1Model} from '../tests/fixtures/graph-core-0.0.9.mjs';
import {createLayoutModel as legacy2Model} from '../tests/fixtures/graph-core-0.0.10.mjs';
import {openObsidianSyncDevice} from '../src/sync/obsidian-host-prototype.mjs';
import {createDurableSyncSession,previewSharedJoin,syncContentHash} from '../src/sync/persistence-prototype.mjs';
import {cloneBoundedSyncJson} from '../src/sync/causal-prototype.mjs';
import {createLayoutActionAuthor} from '../src/sync/author-prototype.mjs';
import {readCompatibilityExport} from '../src/sync/local-work-prototype.mjs';
const checks=[],clone=x=>structuredClone(x),id='e'.repeat(32);
async function test(name,fn){await fn();checks.push(name);}
async function local(options){const f=await fixture(options);await f.controller.disable();await f.host.open();return f;}
async function close(f){await f.controller.disable();}
await test('Local storage requires disabled same-vault connection and exclusive device lease',async()=>{
  const f=await fixture();assert.throws(()=>f.base.assertLocalConnection(vault),/connection-disabled/);await assert.rejects(f.base.acquireLocal(vault),/busy/);await f.controller.disable();await assert.rejects(f.base.acquireLocal(other),/connection-disabled/);await f.host.open();const cold=await f.make();await assert.rejects(cold.host.open(),/busy/);assert.equal(f.controller.state().status,'local-ready');await close(f);
});
await test('Sync commands are refused before any shared I/O or faulted session in local mode',async()=>{
  const f=await local(),s=f.current().session,n=f.sharedCalls();assert.equal((await f.controller.run(()=>assert.fail())).kind,'held');
  for(const fn of [()=>s.initialize({}),()=>s.join({}),()=>s.stage({}),()=>s.publish(),()=>s.cancel(),()=>s.acceptExternal()])await assert.rejects(Promise.resolve().then(fn),/local-only/);
  assert.equal(f.sharedCalls(),n);assert.equal(s.state().faulted,false);assert.equal(f.device.state().connection.enabled,false);await close(f);
});
await test('Settings and UI persist locally across closing and cold reconstruction without enabling sync',async()=>{
  const f=await local(),fingerprint=f.current().session.state().accepted.fingerprint,n=f.sharedCalls(),draft=value(await f.host.beginSettings());draft.value.settings.language='zh';value(await f.host.updateSettings(draft.id,draft.value));assert.equal(value(await f.host.saveSettings(draft.id)).kind,'saved');value(await f.host.saveUi('legend',true));await close(f);const cold=await f.make();await cold.host.open();const view=await cold.host.view();assert.equal(view.data.settings.language,'zh');assert.equal(view.data.ui.legend,'true');assert.deepEqual(view.data.unknown,{keep:42});assert.equal(view.acceptedFingerprint,fingerprint);assert.equal(f.sharedCalls(),n);assert.equal(cold.device.state().connection.enabled,false);await close(cold);
});
await test('Actual core edited layout is saved as local draft and survives reopening without receipt forgery',async()=>{
  const f=await local(),snapshot=await layout(),accepted=clone(f.current().session.state().accepted);value(await f.host.saveLayout(snapshot));assert.equal((await f.host.view()).layoutSource,'local-draft');await close(f);const cold=await f.make();await cold.host.open();assert.deepEqual((await cold.host.view()).data.layoutOverrides,snapshot);assert.deepEqual(cold.current().session.state().accepted,accepted);await close(cold);
});
await test('Reenable drains local work, retains layout draft and never automatically publishes it',async()=>{
  const f=await local(),snapshot=await layout();value(await f.host.saveLayout(snapshot));value(await f.host.saveUi('legend',true));await f.controller.enable(vault);assert.equal(f.controller.state().status,'ready');assert.deepEqual(f.current().coordinator.state().layoutDraft.value,snapshot);assert.equal((await f.current().projection.documentStore.read()).data.ui.legend,'true');assert.equal(f.realShared.files.size,0);assert.equal((await f.controller.run(b=>b.coordinator.acceptExternal())).value.reason,'local-layout-draft');await close(f);
});
await test('A preexisting outbox retains its ID and attempted flag during local work and reenabling',async()=>{
  const f=await fixture(),snapshot=await layout(),group=Object.keys(snapshot.groups)[0],author=createLayoutActionAuthor({vault,createModel:model,nextId:()=> '2'.repeat(32)}),draft=author.prepareEdit({vault,sharedScanComplete:true,records:[],appliedIds:[],localBaseline:empty},[{group,value:{schemaVersion:3,record:snapshot.groups[group],structures:snapshot.structures}}]);await f.controller.run(b=>b.session.stage(draft));const before=clone(f.current().session.state().pending);await f.controller.disable();await f.host.open();value(await f.host.saveUi('legend',true));assert.equal(value(await f.host.prepareRestore({layoutOverrides:empty})).reason,'local-work-pending');await f.controller.enable(vault);assert.deepEqual(f.current().session.state().pending,before);assert.equal(f.realShared.files.size,0);await close(f);
});
await test('Graph epoch change before admitted local save retains previous draft',async()=>{
  const f=await local(),snapshot=await layout();value(await f.host.saveLayout(snapshot));let release,start;const gate=new Promise(r=>release=r),started=new Promise(r=>start=r),busy=f.controller.runLocal(async()=>{start();await gate;});await started;const saved=f.host.saveLayout(empty);f.bumpEpoch();release();await busy;assert.equal(value(await saved).reason,'graph-changed');assert.deepEqual(f.current().coordinator.state().layoutDraft.value,snapshot);await close(f);
});
await test('Invalid layout geometry is rejected before storage mutation',async()=>{
  const f=await local(),snapshot=await layout(),group=Object.keys(snapshot.groups)[0];snapshot.groups[group].points[0].x=1e200;const before=f.current().session.state().sequence;assert.throws(()=>f.host.saveLayout(snapshot));assert.equal(f.current().session.state().sequence,before);await close(f);
});
await test('Quota paused local work stays readable and exportable without pretending edits were saved',async()=>{
  const f=await local({limits:{softBytes:65536,hardBytes:1048576,softFiles:100,hardFiles:500,softEvents:90,hardEvents:4096}}),b=f.current(),status=await b.quota.inspect();await b.backend.create('blobs/filler','x'.repeat(65536-status.bytes));const before=b.session.state().sequence;assert.equal((await f.host.saveUi('legend',true)).kind,'held');assert.equal(f.controller.state().status,'local-paused');assert.equal((await f.host.view()).data.ui.legend,'false');assert.equal((await f.host.exportCompatibility({destination:testMemoryStore(),id})).kind,'exported');assert.equal(b.session.state().sequence,before);await close(f);
});
await test('Compatibility export includes local saved layout, excludes unsaved settings and changes no journal',async()=>{
  const f=await local(),snapshot=await layout(),destination=testMemoryStore();value(await f.host.saveLayout(snapshot));const d=value(await f.host.beginSettings());d.value.settings.language='zh';value(await f.host.updateSettings(d.id,d.value));const before=f.current().session.state().sequence;assert.equal((await f.host.exportCompatibility({destination,id})).layoutSource,'local-draft');const data=await readCompatibilityExport({source:destination,id});assert.deepEqual(data.layoutOverrides,snapshot);assert.equal(data.settings.language,'auto');assert.equal(f.current().session.state().sequence,before);await close(f);
});
await test('Compatibility exports retry identical content and never replace conflicting content',async()=>{
  const f=await local(),destination=testMemoryStore();await f.host.exportCompatibility({destination,id});const before=[...destination.files];await f.host.exportCompatibility({destination,id});assert.deepEqual([...destination.files],before);value(await f.host.saveUi('legend',true));await assert.rejects(f.host.exportCompatibility({destination,id}),/export-conflict/);assert.deepEqual([...destination.files],before);await close(f);
});
await test('Incomplete and tampered compatibility packages do not yield restore data',async()=>{
  const f=await local(),destination=testMemoryStore();destination.create=async(name,raw)=>{if(name.endsWith('manifest.json'))throw Error('full');destination.files.set(name,raw);return 'created';};await assert.rejects(f.host.exportCompatibility({destination,id}),/full/);await assert.rejects(readCompatibilityExport({source:destination,id}),/incomplete-export/);const good=testMemoryStore();await f.host.exportCompatibility({destination:good,id});good.files.set(id+'/data.json','{}');await assert.rejects(readCompatibilityExport({source:good,id}),/export-content/);await close(f);
});
await test('Explicit restore stores raw source and both drafts together, preserving current effective data and receipt',async()=>{
  const f=await local(),snapshot=await layout(),source={settingsVersion:1,settings:{language:'zh'},ui:{legend:'different-device'},layoutOverrides:snapshot,foreignIdentity:'untrusted',unknown:{keep:'source'}},accepted=clone(f.current().session.state().accepted),before=f.current().session.state().sequence;
  const preview=value(await f.host.prepareRestore(source));assert.equal(preview.scope,'draft-only');assert.equal(f.current().session.state().sequence,before);const staged=value(await f.host.applyRestore(preview.token));assert.equal(staged.kind,'restore-staged');assert.equal(f.current().session.state().sequence,before+1);assert.deepEqual(f.current().coordinator.state().restoreSource,source);const data=(await f.current().projection.documentStore.read()).data;assert.equal(data.settings.language,'auto');assert.equal(data.ui.legend,'false');assert.equal(data.foreignIdentity,undefined);assert.deepEqual(data.unknown,{keep:42});assert.deepEqual(f.current().session.state().accepted,accepted);await close(f);const cold=await f.make();await cold.host.open();assert.deepEqual(cold.current().coordinator.state().restoreSource,source);assert.deepEqual(cold.current().coordinator.state().layoutDraft.value,snapshot);await close(cold);
});
await test('Restored settings require their separate save and retain current UI/root metadata',async()=>{
  const f=await local(),review=value(await f.host.prepareRestore({settings:{language:'zh'},layoutOverrides:empty,ui:{legend:'foreign'}})),staged=value(await f.host.applyRestore(review.token));value(await f.host.saveSettings(staged.settingsId));const view=await f.host.view();assert.equal(view.data.settings.language,'zh');assert.equal(view.data.ui.legend,'false');assert.deepEqual(view.data.unknown,{keep:42});assert.equal(f.realShared.files.size,0);await close(f);
});
await test('Restoration cannot overwrite existing drafts or duplicate a consumed review token',async()=>{
  const f=await local(),preview=value(await f.host.prepareRestore({layoutOverrides:empty}));value(await f.host.applyRestore(preview.token));assert.equal(value(await f.host.prepareRestore({layoutOverrides:empty})).reason,'local-work-pending');await assert.rejects(f.host.applyRestore(preview.token),/restore-token/);assert.equal(f.current().session.state().faulted,false);await close(f);
});
await test('Graph or config changes invalidate restore preview and leave no new drafts',async()=>{
  const f=await local(),p=value(await f.host.prepareRestore({layoutOverrides:empty}));f.bumpEpoch();assert.equal(value(await f.host.applyRestore(p.token)).reason,'restore-basis-changed');assert.equal(f.current().coordinator.state().layoutDraft,null);const p2=value(await f.host.prepareRestore({layoutOverrides:empty}));value(await f.host.saveUi('legend',true));assert.equal(value(await f.host.applyRestore(p2.token)).reason,'restore-basis-changed');assert.equal(f.current().coordinator.state().layoutDraft,null);await close(f);
});
await test('Unreviewed, foreign-process and post-reopen tokens confer no restore permission',async()=>{
  const f=await local();await assert.rejects(f.host.applyRestore({}),/restore-token/);const p=value(await f.host.prepareRestore({layoutOverrides:empty}));await close(f);const cold=await f.make();await cold.host.open();await assert.rejects(cold.host.applyRestore(p.token),/restore-token/);await close(cold);
});
await test('Future settings and malformed or unknown layout versions are rejected before writing drafts',async()=>{
  const f=await local(),before=f.current().session.state().sequence;await assert.rejects(f.host.prepareRestore({settingsVersion:2,layoutOverrides:empty}),/restore-settings-version/);for(const schemaVersion of [1,2,4])await assert.rejects(f.host.prepareRestore({layoutOverrides:{schemaVersion,groups:{}}}));assert.equal(f.current().session.state().sequence,before);assert.equal(f.current().session.state().faulted,false);await close(f);
});
function legacySnapshot(schemaVersion){
  const {nodes,meta}=graph();
  const make=schemaVersion===1?legacy1Model:legacy2Model;
  const legacy=make(nodes,meta.layout_root_radius);
  const node=nodes.find(n=>n.title==='Second');
  const editor=createLayoutEditor(nodes,meta.layout_root_radius);
  assert.equal(editor.begin(node.id),null);
  editor.move(node.x+10,node.y+3);
  editor.commit();
  const key=legacy.groupKey(node.id);
  return {
    snapshot:{schemaVersion,revision:7,groups:{[key]:legacy.capture(key)}},
    positions:nodes.map(n=>[n.x,n.y]),
  };
}
for(const version of [1,2]){
  await test('Legacy schema '+version+' restores exact coordinates into a reviewed draft with original source',async()=>{
    const f=await local(),old=legacySnapshot(version);
    const backup={settingsVersion:1,settings:{language:'zh'},layoutOverrides:old.snapshot};
    const accepted=f.current().session.state().accepted;
    const sequence=f.current().session.state().sequence;
    const preview=value(await f.host.prepareRestore(backup));
    assert.equal(preview.layout.schemaVersion,3);
    assert.equal(preview.layout.revision,7);
    assert.equal(f.current().session.state().sequence,sequence);
    const {nodes,meta}=graph();
    assert.equal(createLayoutModel(nodes,meta.layout_root_radius).apply(preview.layout).restored,1);
    nodes.forEach((n,index)=>{
      assert.ok(Math.abs(n.x-old.positions[index][0])<1e-8);
      assert.ok(Math.abs(n.y-old.positions[index][1])<1e-8);
    });
    assert.equal(value(await f.host.applyRestore(preview.token)).kind,'restore-staged');
    assert.deepEqual(f.current().session.state().accepted,accepted);
    await close(f);
    const cold=await f.make();
    await cold.host.open();
    assert.deepEqual(cold.current().coordinator.state().restoreSource,backup);
    assert.deepEqual((await cold.host.view()).data.layoutOverrides,preview.layout);
    assert.equal(f.sharedCalls(),0);
    await close(cold);
  });
}
await test('Legacy recovery refuses incompatible geometry or an unknown group without staging a partial draft',async()=>{
  const f=await local(),before=f.current().session.state().sequence;
  const old=legacySnapshot(2).snapshot;
  const group=Object.keys(old.groups)[0];
  const unknown=clone(old);
  unknown.groups['foreign-group']=unknown.groups[group];
  await assert.rejects(f.host.prepareRestore({layoutOverrides:unknown}),/restore-legacy-group/);
  old.groups[group].points[0].x=2;
  await assert.rejects(f.host.prepareRestore({layoutOverrides:old}),/restore-legacy-geometry/);
  assert.equal(f.current().session.state().sequence,before);
  assert.equal(f.current().coordinator.state().layoutDraft,null);
  await close(f);
});
await test('A host expecting an existing identity reports its loss without generating a replacement',async()=>{
  const app=testLocalApp(),locks=testLockManager(),pluginId='lost-identity-test';
  await assert.rejects(openObsidianSyncDevice({app,locks,pluginId,requireExistingIdentity:true}),
    {code:'SYNC_PRIVATE_IDENTITY_MISSING'});
  assert.equal(app.writes(),0);
  const device=await openObsidianSyncDevice({app,locks,pluginId});
  assert.equal(device.state().connection,null);
});
await test('A lost private ledger holds its old anchor while a separate device explicitly rejoins and stages backup drafts',async()=>{
  const original=await fixture(),snapshot=await layout(),group=Object.keys(snapshot.groups)[0];
  const author=createLayoutActionAuthor({vault,createModel:model,nextId:()=> '2'.repeat(32)});
  const draft=author.prepareEdit({vault,sharedScanComplete:true,records:[],appliedIds:[],localBaseline:empty},
    [{group,value:{schemaVersion:3,record:snapshot.groups[group],structures:snapshot.structures}}]);
  await original.controller.run(async b=>{
    await b.session.stage(draft);
    assert.equal((await b.session.publish()).kind,'accepted');
  });
  await original.controller.disable();
  await original.host.open();
  value(await original.host.saveLayout(empty));
  const destination=testMemoryStore();
  assert.equal((await original.host.exportCompatibility({destination,id})).kind,'exported');
  await close(original);
  const anchor=original.base.anchor(vault);
  original.stores.get(vault).files.clear();
  const damaged=await original.make();
  await assert.rejects(damaged.host.open(),{code:'SYNC_PRIVATE_ANCHOR_MISSING'});
  assert.equal(damaged.controller.state().recoveryReason,'private-anchor-missing');
  assert.equal((await damaged.host.prepareCompatibilityRestore({source:destination,id})).reason,'recovery-required');
  assert.deepEqual(damaged.base.anchor(vault),anchor);
  assert.equal(original.stores.get(vault).files.size,0);

  const fresh=await fixture({shared:original.realShared,explicitJoin:true});
  assert.notEqual(fresh.base.state().installation,original.base.state().installation);
  assert.equal(fresh.controller.state().status,'join-required');
  const history=await previewSharedJoin({sharedStore:original.realShared,vault,createModel:model});
  assert.equal(history.kind,'shared-preview');
  assert.equal(history.operations,1);
  const duplicate=`Knowledge Map Sync/v2/${vault}/ops/conflict.json`;
  original.realShared.files.set(duplicate,[...original.realShared.files.values()][0]);
  const stale=await fresh.controller.join(async b=>{
    const result=await b.session.join({localData:source(),choice:'shared',expectedSharedFingerprint:history.fingerprint});
    assert.equal(b.session.state().sequence,0);
    return result;
  });
  assert.equal(value(stale).reason,'shared-scan-changed');
  original.realShared.files.delete(duplicate);
  const joined=await fresh.controller.join(async b=>{
    const result=await b.session.join({localData:{...source(),layoutOverrides:empty},choice:'shared',expectedSharedFingerprint:history.fingerprint});
    assert.equal(result.kind,'adopted');
    await b.projection.initialize({sourceData:source()});
    await b.coordinator.open();
    return result.state.accepted;
  });
  assert.deepEqual(joined.value.appliedIds,['2'.repeat(32)]);
  await fresh.controller.disable();
  await fresh.host.open();
  const calls=fresh.sharedCalls();
  const preview=value(await fresh.host.prepareCompatibilityRestore({source:{read:destination.read},id}));
  assert.deepEqual(preview.layout,empty);
  assert.equal(value(await fresh.host.applyRestore(preview.token)).kind,'restore-staged');
  assert.deepEqual(fresh.current().session.state().accepted,joined.value);
  assert.deepEqual((await fresh.host.view()).data.layoutOverrides,empty);
  assert.equal(fresh.sharedCalls(),calls);
  assert.equal(original.realShared.files.size,1);
  await close(fresh);
});
await test('Old coordinator v1 drafts migrate in memory without a write on opening',async()=>{
  const f=await fixture();await f.controller.run(b=>b.session.saveLocalState({version:1,settingsDraft:null,layoutDraft:null,pendingSave:null,uiPending:{}}));const sequence=f.current().session.state().sequence;await f.controller.disable();await f.host.open();assert.equal(f.current().coordinator.state().version,2);assert.equal(f.current().coordinator.state().restoreSource,null);assert.equal(f.current().session.state().sequence,sequence);await close(f);
});
await test('Missing local receipt remains join-required without inventing initialization or shared access',async()=>{
  const privateStore=testMemoryStore();let touched=0;const sharedStore={read:async()=>{touched++;},create:async()=>{touched++;},list:async()=>{touched++;}},session=createDurableSyncSession({privateStore,sharedStore,vault,installation:'b'.repeat(32),createModel:model,access:'local-only'});await session.open();assert.equal(session.state().initialized,false);await assert.rejects(session.initialize({}),/local-only/);assert.equal(touched,0);await session.close();
});
await test('A repeated replay blob is verified again on a new open and corruption fails closed',async()=>{
  const backend=testMemoryStore();
  backend.immutableBlobsUnderLease=true;
  const draft={version:1,settingsDraft:null,layoutDraft:null,uiPending:{},pendingSave:null};
  const hash=await syncContentHash(JSON.stringify(cloneBoundedSyncJson(draft)));
  const name='blobs/'+hash+'.json';
  const read=backend.read;
  let reads=0;
  backend.read=(key,max)=>{
    if(key===name)reads++;
    return read(key,max);
  };
  const f=await local({backend:()=>backend});
  await f.controller.runLocal(async b=>{
    await b.session.saveLocalState(draft);
    await b.session.saveLocalState(draft);
  });
  await close(f);
  const cold=await f.make();
  reads=0;
  await cold.host.open();
  assert.deepEqual(cold.current().session.state().localState,draft);
  assert.equal(reads,1);
  await close(cold);

  backend.files.set(name,backend.files.get(name)+'x');
  const damaged=await f.make();
  await assert.rejects(damaged.host.open(),/private-authentication/);
  assert.equal(damaged.controller.state().status,'recovery-required');
});
await test('Closing a local session drains admitted saves and freezes subsequent local inputs',async()=>{
  const f=await local();let start,finish;const started=new Promise(r=>start=r),gate=new Promise(r=>finish=r);const work=f.controller.runLocal(async b=>{start();await gate;return b.coordinator.saveUi('legend',true);});await started;const closing=f.controller.disable();assert.equal((await f.host.saveUi('legend',false)).kind,'held');finish();await work;await closing;await f.host.open();assert.equal((await f.host.view()).data.ui.legend,'true');await close(f);
});
const result={date:'2026-11-08 Asia/Shanghai',passed:checks.length,checks,scope:'Local-only private edits, compatibility package and reviewed schema3 restore drafts with actual core; memory backing and fake host APIs, not native or production UI.'};fs.mkdirSync('.local/sync-016/a3/local-work',{recursive:true});fs.writeFileSync('.local/sync-016/a3/local-work/local-work-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:checks.length}));
