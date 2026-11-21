import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
import {createSettingsCoordinator} from '../src/sync/settings-coordinator-prototype.mjs';
import {validateTestSettings as validate} from './sync-settings-test-helpers.mjs';
const clone=x=>structuredClone(x),fp=n=>n.toString(16).padStart(64,'0');
const empty={schemaVersion:3,revision:9,groups:{},structures:{}};
async function layout(){
  const g=buildGraph({files:[{path:'Synthetic/A.md',text:'# First\nbody\n# Second\nother'}],config:{include:['**']}}),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius);
  const n=g.nodes.find(n=>n.title==='Second');assert.equal(e.begin(n.id),null);e.move(n.x+10,n.y+3);e.commit();let disk;
  await createLayoutStore(null,async d=>disk=clone(d)).command({},'edit',m.groupKey(n.id),m.capture(m.groupKey(n.id)));return {...disk,revision:9};
}
const moved=await layout(),checks=[];
async function test(name,fn){await fn();checks.push(name);}
function fixture(){
  let doc=validate({ui:{legend:'false',other:'keep'},layoutOverrides:empty,unrelated:{keep:42}}),version=1,accepted={snapshot:clone(empty),fingerprint:fp(1)},localState=null,ids=1;
  let writeHook=null,persistHook=null,coordinatorHook=null,external={kind:'noop'},writes=0,receives=0;
  const session={state:()=>clone({accepted,localState}),saveLocalState:async next=>{await persistHook?.(next);localState=clone(next);},acceptExternal:async()=>{receives++;if(external.accepted)accepted=clone(external.accepted);return {kind:external.kind,state:session.state()};}};
  const store={read:async()=>({data:clone(doc),version}),compareAndSet:async(expected,next)=>{await writeHook?.();if(expected!==version)return {ok:false};doc=clone(next);version++;writes++;return {ok:true,version};}};
  const create=()=>createSettingsCoordinator({session,documentStore:store,validateSettings:validate,nextId:()=>String(ids++).padStart(32,'0'),checkpoint:step=>coordinatorHook?.(step)});
  return {session,store,create,document:()=>clone(doc),patch:fn=>{fn(doc);version++;},accepted:value=>{accepted=clone(value);},external:value=>{external=value;},
    writeHook:value=>writeHook=value,persistHook:value=>persistHook=value,checkpoint:value=>coordinatorHook=value,writes:()=>writes,receives:()=>receives,local:()=>clone(localState)};
}
async function ready(){const f=fixture(),c=f.create();await c.open();return {f,c};}
async function settings(c,edit){const draft=await c.beginSettingsDraft();edit(draft.value);await c.updateSettingsDraft(draft.id,draft.value);return draft;}
await test('UI writes merge only their key and preserve settings, other UI and unknown fields',async()=>{
  const {f,c}=await ready();await c.saveUi('legend',true);const d=f.document();assert.equal(d.ui.legend,'true');assert.equal(d.ui.other,'keep');assert.equal(d.unrelated.keep,42);assert.equal(d.settings.language,'auto');
});
await test('Settings save reads fresh UI and replaces an external stale layout only from the trusted receipt',async()=>{
  const {f,c}=await ready(),s=await settings(c,d=>d.settings.debounceMs=500);f.patch(d=>{d.ui.extra='remote';d.layoutOverrides=moved;d.appliedIds=['untrusted'];d.unrelated.other=7;});
  assert.equal((await c.saveSettingsDraft(s.id)).kind,'saved');const d=f.document();assert.equal(d.ui.extra,'remote');assert.equal(d.unrelated.other,7);assert.deepEqual(d.layoutOverrides,empty);assert.deepEqual(f.session.state().accepted.snapshot,empty);
});
await test('Unrelated concurrent settings changes merge by field rather than overwriting an old full draft',async()=>{
  const {f,c}=await ready(),s=await settings(c,d=>d.settings.debounceMs=500);f.patch(d=>d.settings.autoUpdate=false);await c.saveSettingsDraft(s.id);
  assert.equal(f.document().settings.autoUpdate,false);assert.equal(f.document().settings.debounceMs,500);
});
await test('Conflicting settings values retain both the external document and the durable draft',async()=>{
  const {f,c}=await ready(),s=await settings(c,d=>d.settings.debounceMs=500);f.patch(d=>d.settings.debounceMs=600);
  const r=await c.saveSettingsDraft(s.id);assert.equal(r.kind,'review-required');assert.deepEqual(r.conflicts,[['settings','debounceMs']]);assert.equal(f.document().settings.debounceMs,600);
  const reload=f.create();await reload.open();assert.equal(reload.state().settingsDraft.value.settings.debounceMs,500);
  const desired=reload.state().settingsDraft.value;desired.settings.debounceMs=600;await reload.updateSettingsDraft(s.id,desired);assert.equal((await reload.resume()).kind,'saved');
});
await test('Array replacements are atomic conflict fields, not index-wise merged lists',async()=>{
  const {f,c}=await ready(),s=await settings(c,d=>d.pipeline.config.include=['Local/**']);f.patch(d=>d.pipeline.config.include=['External/**']);
  const r=await c.saveSettingsDraft(s.id);assert.equal(r.kind,'review-required');assert.deepEqual(f.document().pipeline.config.include,['External/**']);
});
await test('Deleting an owned nested key preserves unrelated external additions',async()=>{
  const {f,c}=await ready();f.patch(d=>d.pipeline.annotations={remove:1,keep:2});const s=await settings(c,d=>delete d.pipeline.annotations.remove);
  f.patch(d=>d.pipeline.annotations.external=3);await c.saveSettingsDraft(s.id);assert.deepEqual(f.document().pipeline.annotations,{keep:2,external:3});
});
await test('A compare-and-set race retries from the new document without losing unrelated changes',async()=>{
  const {f,c}=await ready(),s=await settings(c,d=>d.settings.debounceMs=500);f.writeHook(()=>{f.writeHook(null);f.patch(d=>d.ui.race='preserved');});
  assert.equal((await c.saveSettingsDraft(s.id)).kind,'saved');assert.equal(f.document().ui.race,'preserved');assert.equal(f.document().settings.debounceMs,500);
});
await test('A competing same-field write during CAS becomes a review instead of a blind retry',async()=>{
  const {f,c}=await ready(),s=await settings(c,d=>d.settings.debounceMs=500);f.writeHook(()=>{f.writeHook(null);f.patch(d=>d.settings.debounceMs=700);});
  assert.equal((await c.saveSettingsDraft(s.id)).kind,'review-required');assert.equal(f.document().settings.debounceMs,700);
});
await test('Repeated contention stops after bounded retries and retains the pending save',async()=>{
  const {f,c}=await ready(),s=await settings(c,d=>d.settings.language='zh');let rounds=0;f.writeHook(()=>f.patch(d=>d.race=++rounds));
  assert.equal((await c.saveSettingsDraft(s.id)).kind,'held');assert.equal(rounds,3);assert.ok(c.state().pendingSave);assert.equal(c.state().settingsDraft.value.settings.language,'zh');
  f.writeHook(null);assert.equal((await c.resume()).kind,'saved');
});
await test('Document write failure preserves a recoverable settings intent before returning failure',async()=>{
  const {f,c}=await ready(),s=await settings(c,d=>d.settings.language='zh');f.writeHook(()=>{throw Error('disk-full');});await assert.rejects(c.saveSettingsDraft(s.id),/disk-full/);
  assert.equal(f.document().settings.language,'auto');f.writeHook(null);const reload=f.create();await reload.open();assert.equal((await reload.resume()).kind,'saved');assert.equal(f.document().settings.language,'zh');
});
await test('A commit followed by failed private clear resumes without another document write',async()=>{
  const {f,c}=await ready(),s=await settings(c,d=>d.settings.language='zh');f.persistHook(next=>{if(!next.pendingSave&&!next.settingsDraft)throw Error('clear-failed');});
  await assert.rejects(c.saveSettingsDraft(s.id),/clear-failed/);assert.equal(f.document().settings.language,'zh');const count=f.writes();f.persistHook(null);
  const reload=f.create();await reload.open();assert.equal((await reload.resume()).kind,'saved');assert.equal(f.writes(),count);
});
await test('A failed UI save retains the optimistic value and a concurrent external UI edit requires review',async()=>{
  const {f,c}=await ready();f.writeHook(()=>{throw Error('disk-full');});await assert.rejects(c.saveUi('legend','true'),/disk-full/);assert.equal(c.state().uiPending.legend.value,'true');
  f.writeHook(null);f.patch(d=>d.ui.legend='external');const reload=f.create();await reload.open();assert.equal((await reload.resume()).kind,'review-required');assert.equal(f.document().ui.legend,'external');
});
await test('A later UI action is retained even while a failed settings save is pending',async()=>{
  const {f,c}=await ready(),s=await settings(c,d=>d.settings.language='zh');f.writeHook(()=>{throw Error('disk-full');});await assert.rejects(c.saveSettingsDraft(s.id));
  assert.equal((await c.saveUi('legend','true')).kind,'held');assert.equal(f.local().uiPending.legend.value,'true');f.writeHook(null);assert.equal((await c.resume()).kind,'saved');assert.equal(f.document().ui.legend,'true');
});
await test('A durable local layout draft prevents receive and survives coordinator recreation',async()=>{
  const {f,c}=await ready(),draft=await c.stageLayoutDraft(moved);f.external({kind:'accepted',accepted:{snapshot:moved,fingerprint:fp(2)}});
  assert.equal((await c.acceptExternal()).reason,'local-layout-draft');assert.equal(f.receives(),0);
  const reload=f.create();await reload.open();assert.deepEqual(reload.state().layoutDraft.value,moved);await assert.rejects(reload.clearLayoutDraft('bad'),/stale-layout-draft/);
  await reload.clearLayoutDraft(draft.id);assert.equal((await reload.acceptExternal()).kind,'accepted');
});
await test('Cache writes retain the local layout preview separately and never claim it was accepted',async()=>{
  const {f,c}=await ready();await c.stageLayoutDraft(moved);await c.saveUi('legend','true');assert.deepEqual(f.document().layoutOverrides,empty);assert.deepEqual(c.state().layoutDraft.value,moved);assert.deepEqual(f.session.state().accepted.snapshot,empty);
});
await test('Receiving layout keeps an unsaved settings draft intact and does not apply it accidentally',async()=>{
  const {f,c}=await ready(),s=await settings(c,d=>d.settings.language='zh');f.external({kind:'accepted',accepted:{snapshot:moved,fingerprint:fp(2)}});
  const r=await c.acceptExternal();assert.equal(r.kind,'accepted');assert.deepEqual(f.document().layoutOverrides,moved);assert.equal(f.document().settings.language,'auto');assert.equal(c.state().settingsDraft.id,s.id);assert.equal(c.state().settingsDraft.value.settings.language,'zh');
});
await test('A repeated receive/cache repair does not issue another document write',async()=>{
  const {f,c}=await ready();f.external({kind:'accepted',accepted:{snapshot:moved,fingerprint:fp(2)}});await c.acceptExternal();const count=f.writes();f.external({kind:'noop'});await c.acceptExternal();assert.equal(f.writes(),count);
});
await test('Cache failure after durable receipt acceptance never rolls back the accepted layout',async()=>{
  const {f,c}=await ready();f.external({kind:'accepted',accepted:{snapshot:moved,fingerprint:fp(2)}});f.writeHook(()=>{throw Error('cache-full');});await assert.rejects(c.acceptExternal(),/cache-full/);
  assert.deepEqual(f.session.state().accepted.snapshot,moved);assert.deepEqual(f.document().layoutOverrides,empty);f.writeHook(null);assert.equal((await c.resume()).kind,'saved');assert.deepEqual(f.document().layoutOverrides,moved);
});
await test('An acceptance changing before document write is recomputed from the current authoritative receipt',async()=>{
  const {f,c}=await ready();let once=true;f.checkpoint(step=>{if(step==='before-document-write'&&once){once=false;f.accepted({snapshot:moved,fingerprint:fp(2)});}});
  const r=await c.refreshCache();assert.equal(r.kind,'saved');assert.deepEqual(f.document().layoutOverrides,moved);assert.equal(r.acceptanceFingerprint,fp(2));
});
await test('Settings and UI saves serialize and preserve both intentional changes',async()=>{
  const {f,c}=await ready(),s=await settings(c,d=>d.settings.language='zh');await Promise.all([c.saveSettingsDraft(s.id),c.saveUi('legend','true'),c.saveUi('other','changed')]);
  assert.equal(f.document().settings.language,'zh');assert.deepEqual(f.document().ui,{legend:'true',other:'changed'});
});
await test('Caller and returned-object mutations cannot alter captured settings or layout drafts',async()=>{
  const {f,c}=await ready(),s=await c.beginSettingsDraft(),v=clone(s.value);v.settings.language='zh';const save=c.updateSettingsDraft(s.id,v);v.settings.language='en';await save;
  const layout=clone(moved),staging=c.stageLayoutDraft(layout);layout.groups={};const staged=await staging;staged.value.groups={};assert.deepEqual(c.state().layoutDraft.value,moved);
  assert.equal(c.state().settingsDraft.value.settings.language,'zh');assert.equal(f.document().settings.language,'auto');
});
await test('Invalid settings and non-scope fields leave the prior draft unchanged',async()=>{
  const {c}=await ready(),s=await c.beginSettingsDraft(),bad=clone(s.value);bad.settings.debounceMs=0;await assert.rejects(c.updateSettingsDraft(s.id,bad));
  await assert.rejects(c.updateSettingsDraft(s.id,{...s.value,layoutOverrides:moved}),/settings-scope/);assert.deepEqual(c.state().settingsDraft.value,s.value);
});
await test('Malformed layout input is rejected without replacing a previously durable draft',async()=>{
  const {c}=await ready(),saved=await c.stageLayoutDraft(moved),bad=clone(moved);bad.groups[Object.keys(bad.groups)[0]].points[0].x=Infinity;
  await assert.rejects(c.stageLayoutDraft(bad));assert.equal(c.state().layoutDraft.id,saved.id);
});
await test('JSON prototype-like UI keys remain data and cannot modify object prototypes',async()=>{
  const {f,c}=await ready();await c.saveUi('__proto__','safe');assert.equal(Object.hasOwn(f.document().ui,'__proto__'),true);assert.equal(f.document().ui.__proto__,'safe');assert.equal({}.polluted,undefined);
});
await test('Unknown local-state versions fail closed without changing the document',async()=>{
  const f=fixture(),before=f.document();await f.session.saveLocalState({version:99});await assert.rejects(f.create().open(),/local-state/);assert.deepEqual(f.document(),before);
});
await test('Typing while a settings write is queued keeps a rebased unsaved draft after the earlier save',async()=>{
  const {f,c}=await ready(),s=await settings(c,d=>d.settings.language='zh'),next=clone(s.value);next.settings.language='en';
  const save=c.saveSettingsDraft(s.id),typing=c.updateSettingsDraft(s.id,next);const r=await save;await typing;
  assert.equal(r.retainedDraft,true);assert.equal(f.document().settings.language,'zh');assert.equal(c.state().settingsDraft.base.settings.language,'zh');assert.equal(c.state().settingsDraft.value.settings.language,'en');
  assert.equal((await c.saveSettingsDraft(s.id)).kind,'saved');assert.equal(f.document().settings.language,'en');
});
await test('Typing during the durable clear window is not erased by completion of the previous save',async()=>{
  const {f,c}=await ready(),s=await settings(c,d=>d.settings.language='zh'),next=clone(s.value);next.settings.language='en';let typing;
  f.persistHook(value=>{if(!typing&&!value.pendingSave&&!value.settingsDraft){typing=c.updateSettingsDraft(s.id,next);}});
  const saved=await c.saveSettingsDraft(s.id);assert.equal(saved.retainedDraft,true);await typing;assert.equal(c.state().settingsDraft.value.settings.language,'en');assert.equal(c.state().settingsDraft.base.settings.language,'zh');
});
await test('A layout edit queued during receive retains the receipt visible when that edit was submitted',async()=>{
  const {f,c}=await ready();let start,release;const started=new Promise(r=>start=r),gate=new Promise(r=>release=r);
  f.session.acceptExternal=async()=>{start();await gate;f.accepted({snapshot:moved,fingerprint:fp(2)});return {kind:'accepted'};};
  const receive=c.acceptExternal();await started;const draft=c.stageLayoutDraft(moved);release();await receive;await draft;
  assert.equal(c.state().layoutDraft.baseFingerprint,fp(1));assert.equal(f.session.state().accepted.fingerprint,fp(2));
});
await test('Malformed external settings stop cache/UI writes while retaining the requested UI value',async()=>{
  const {f,c}=await ready();f.patch(d=>d.settings.debounceMs=0);const before=f.document();await assert.rejects(c.saveUi('legend','true'));
  assert.deepEqual(f.document(),before);assert.equal(c.state().uiPending.legend.value,'true');f.patch(d=>d.settings.debounceMs=350);assert.equal((await c.resume()).kind,'saved');
});
const result={passed:checks.length,checks,scope:'Isolated coordinator policy with real settings validation and a conditional-write test adapter; not Obsidian saveData atomicity or production UI integration'};
fs.mkdirSync('.local/sync-016/a3',{recursive:true});fs.writeFileSync('.local/sync-016/a3/coordinator-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
