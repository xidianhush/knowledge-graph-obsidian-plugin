import {createSyncConnectionCatalog} from './connection-catalog.mjs';
import {createDefaultLayoutBootstrap,DEFAULT_LAYOUT_VAULT_ID} from './default-layout-bootstrap.mjs';
import {createEasySyncAuthorization} from './easy-sync-setup.mjs';
import {openSyncConnections} from './connection-registry.mjs';
import {createLifecycleDevice,createSyncLifecycle,exportRecoveryParts} from './connection-lifecycle-prototype.mjs';
import {verifyRecoveryExport} from './recovery-export.mjs';
import {readCompatibilityExport} from './local-work-prototype.mjs';
import {openRotationControl} from './rotation-control.mjs';
import {randomSyncOperationId} from './author-prototype.mjs';
import {packSchema3Operation} from './wire-prototype.mjs';
import {createDeviceBoundPrivateStore} from './obsidian-host-prototype.mjs';
import {createPrivateStoreBudget} from './private-store-budget-prototype.mjs';
import {createDurableSyncSession,syncContentHash} from './persistence-prototype.mjs';
import {createAttemptHistory} from './attempt-history-prototype.mjs';
import {createReadOnlyLayoutHistory} from './obsidian-shared-history.mjs';
import {createPrivateConfigProjection} from './private-config-prototype.mjs';
import {createSettingsCoordinator} from './settings-coordinator-prototype.mjs';
import {createAutoPublishQueue,createLayoutDraftPublisher} from './auto-publish-queue.mjs';
import {createLayoutActionAuthor} from './author-prototype.mjs';
import {cloneBoundedSyncJson} from './causal-prototype.mjs';
import {normalizeRestoreLayout,normalizeJoinLayout,projectCurrentJoinLayout,validateSchema3Snapshot,probeSchema3Snapshot,planSchema3Transactions,inspectSchema3History} from './layout-prototype.mjs';
import {readHistoricalLayout,reconcileLocalLayout,planHistoricalLayout,mergeHistoricalGroups,localLayoutChanged,validateUnjoinedLayoutEdit} from './historical-layout.mjs';
const copy=v=>cloneBoundedSyncJson(v),equal=(a,b)=>JSON.stringify(copy(a))===JSON.stringify(copy(b));
const layoutOf=v=>v.layoutOverrides??null,held=reason=>({kind:'held',reason});
function unwrap(r){return r?.kind==='completed'?unwrap(r.value):r;}
export async function createUnifiedSyncHost({app,pluginId,adapter,locks=globalThis.navigator?.locks,readSource,saveUnjoined,createStore,validateSettings,openBackend,getGraph,getEpoch,onData=()=>{},budgetLimits,checkpoint=async()=>{}}={}){
 if([readSource,saveUnjoined,createStore,validateSettings,openBackend,getGraph,getEpoch,onData].some(fn=>typeof fn!=='function'))throw Error('unified-options');
 let registry=null,lifecycle=null,bundle=null,publisherQueue=null,rotation=null,rotationData=null,closed=false,freezing=false,error=null,externalEpoch=0,tail=Promise.resolve();
 const joinTokens=new WeakMap(),reviews=new WeakMap(),historicalReviews=new WeakMap(),listeners=new Set(),exportTasks=new Map();let saveError=null,outcome=null,pathBasis=null,pathOverflow=false,structureWaiting=false,privateBudget=null;const pathChanges=[];
 let exportFolders=null;
 let easyAuth=null;const easy={phase:'idle',reason:null,candidates:null,target:null};
 async function withExportFolders(destination,id,fn){
  if(typeof destination.location!=='string')return fn();
  const parts=destination.location.split('/'),folders=[];for(let n=1;n<=parts.length;n++)folders.push(parts.slice(0,n).join('/'));
  exportFolders=new Set([...folders,destination.location+'/'+id,destination.location+'/'+id+'/operations']);
  try{return await fn();}finally{exportFolders=null;}
 }
 async function inspectBudget(){if(!bundle){privateBudget=null;return null;}const s=await bundle.quota.inspect();privateBudget={...s,triggers:['bytes','files','events'].filter(k=>s[k]>=s.limits['soft'+k[0].toUpperCase()+k.slice(1)]).concat(s.complete?[]:['incomplete'])};return privateBudget;}
 function emit(){for(const fn of [...listeners])try{fn();}catch{/* Status observers never own a transaction. */}}
 function report(result,scope){outcome={kind:result?.kind,reason:result?.reason??null,scope};emit();return result;}
 function enqueue(fn){const task=tail.catch(()=>{}).then(()=>{if(closed)throw Error('unified-closed');return fn();});tail=task;task.then(emit,emit);return task;}
 function model(){const g=getGraph();if(!g?.isCurrent())throw Error('unified-graph-unavailable');return g.createModel();}
 const epoch=()=>getEpoch()+externalEpoch;
 const source=async()=>copy((await readSource())??{});
 function writable(){return registry?.state().selected?.transport==='attempts-v1';}
 function gate(write=true){if(closed||freezing)return {reason:'host-closing'};if(rotation?.state())return {reason:'rotation-review-required'};if(write&&!writable())return {reason:'read-only'};if(lifecycle?.state().status!=='ready')return {reason:lifecycle?.state().status||'disabled'};
  const g=getGraph();return g?.isCurrent()&&!g.hidden?true:{reason:g?.hidden?'view-hidden':'graph-unavailable'};}
 const store=createStore(layoutOf(await source()),value=>host.saveLayout(value));
 const stopLayoutIdle=store.onIdle(()=>{
  if(!closed&&!freezing&&publisherQueue?.state().lastResult?.reason==='layout-busy')void publisherQueue.resume();
  if(!closed&&!freezing&&structureWaiting&&gate()===true)void host.wakeStructure().catch(()=>{});
 });
 async function observe(){
  if(!bundle?.ready)return held('join-required');const captured=externalEpoch,current=await source();
  const result=await bundle.projection.observeExternal(current,{epoch:captured});
  if(result.kind==='review-required'){
   const preview=await bundle.projection.reviewExternal(result.id);
   if(preview.kind==='candidate')return bundle.projection.resolveExternal(result.id,{choice:'merge'});
  }
  return result;
 }
 async function setupProjection(b){
  if(b.ready)return;
  if(!b.session.getLocalDocument())await b.projection.initialize({sourceData:rotationData??await source()});
  await b.projection.open();await b.coordinator.open();b.ready=true;await observe();
 }
 async function makeBundle({device,vault,access}){
  const backend=await openBackend({installation:device.state().installation,vault}),quota=createPrivateStoreBudget({store:backend,...(budgetLimits?{limits:budgetLimits}:{})});
  const privateStore=createDeviceBoundPrivateStore({store:quota.store,device,vault,access});
  const attempts=writable()?createAttemptHistory(adapter,vault):null;
  const session=createDurableSyncSession({privateStore,...(attempts?{attemptHistory:attempts}:{sharedStore:createReadOnlyLayoutHistory(adapter,vault)}),vault,installation:device.state().installation,access,
   createModel:model,getEpoch:epoch,readLocalData:async()=>rotationData??source(),nextId:()=>rotation?.state()?.target===vault?rotation.state().rootId:randomSyncOperationId(),normalizeLocalLayout:raw=>normalizeJoinLayout(raw,model),projectLocalLayout:raw=>projectCurrentJoinLayout(raw,model),enableConflictResolution:!!attempts,checkpoint});
  const projection=createPrivateConfigProjection({session,validateSettings,getExternalEpoch:()=>externalEpoch});
  const coordinator=createSettingsCoordinator({session,documentStore:projection.documentStore,validateSettings,createModel:model,getGraphEpoch:epoch});
  const b={session,projection,coordinator,backend,quota,attempts,ready:false,async open(){await quota.recover(async()=>{await session.open();if(session.state().initialized&&rotation?.state()?.target!==vault)await setupProjection(b);});await inspectBudget();}};
  bundle=b;return b;
 }
 function startQueue(){
  if(!bundle?.ready||!bundle.attempts||publisherQueue||rotation?.state())return;
  const b=bundle,publisher=createLayoutDraftPublisher({session:b.session,coordinator:b.coordinator,attemptHistory:b.attempts,vault:registry.state().selected.vault,createModel:model,getEpoch:epoch,
   reserve(){const captured=epoch(),guard=store.reserveExternal(x=>x);return guard&&{release:()=>guard.release(),isCurrent:()=>gate()===true&&captured===epoch()};},
   runExclusive:fn=>lifecycle.run(()=>fn()).then(unwrap)});
  b.publisher=publisher;
  publisherQueue=createAutoPublishQueue({readLocal:()=>b.session.state(),publish:publisher.publish,canRun:gate,onResult:r=>{
   report(r,'publication');
   const q=publisherQueue,s=store.state();
   // The edit may end between the failed reservation and this async result.
   // Resume after the queue has recorded its held state, only for an idle store.
   if(r.reason==='layout-busy'&&!s.busy&&!s.locked&&!s.unsupported)Promise.resolve().then(()=>{
    if(q&&publisherQueue===q&&!closed&&!freezing)void q.resume();
   });
  }});
 }
 async function ensure(){
  if(registry)return;
  registry=await openSyncConnections({app,pluginId,catalog:createSyncConnectionCatalog({adapter}),locks,checkpoint:step=>checkpoint('selection:'+step)});
  easyAuth=await createEasySyncAuthorization({app,pluginId,device:registry.device,checkpoint});
  rotation=await openRotationControl({app,pluginId,device:registry.device});
  const device=await createLifecycleDevice({device:registry.device,app,pluginId,locks});
  lifecycle=createSyncLifecycle({device,openBundle:makeBundle,checkpoint:step=>checkpoint('lifecycle:'+step)});if(!registry.state().pending)await lifecycle.open();
  if(lifecycle.state().status==='disabled'&&registry.state().selected&&registry.device.state().connection&&!registry.device.state().connection.enabled)await lifecycle.openLocal();
  startQueue();
 }
 async function run(fn){if(error)throw Error(error);const local=lifecycle?.state().status.startsWith('local-');const result=unwrap(await lifecycle[local?'runLocal':'run'](fn));if(result.kind==='held')throw Error(result.reason);return result;}
 async function deliver(){if(!bundle?.ready)return source();const data=(await bundle.projection.documentStore.read()).data;await onData(copy(data));return data;}
 async function stopQueue(){const q=publisherQueue;publisherQueue=null;await q?.close();}
 async function finishObservedStructure(){
  const s=bundle?.ready&&bundle.session.state(),p=s?.pending;
  if(!p||p.mode==='resolution'||!writable()||s.localState?.layoutDraft||s.localState?.pendingSave)return {kind:'noop'};
  const normalized={...p.operation,id:'0'.repeat(32)};
  if(p.id!==(await syncContentHash('KM-SYNC-STRUCTURE-ID-1\n'+JSON.stringify(copy(normalized)))).slice(0,32))return {kind:'noop'};
  structureWaiting=true;
  if(gate()!==true)return held(gate().reason);
  if(!probeSchema3Snapshot(p.proposal,model).ok)return held('graph-incompatible');
  const reserved=reserveReview();if(!reserved)return held('layout-busy');
  // Only an actual busy/hidden gate waits for idle. Releasing this own guard
  // must not turn a persistent missing-input hold into a self-waking scan loop.
  structureWaiting=false;
  try{
   const result=unwrap(await lifecycle.run(b=>b.session.finishPublished({id:p.id,canContinue:reserved.current})));
   if(result.kind.startsWith('accepted')){structureWaiting=false;if(reserved.current()){reserved.guard.apply(bundle.session.state().accepted.snapshot);await deliver();}}
   return report(result,'structure');
  }finally{reserved.guard.release();}
 }
 function assertSave(){const status=lifecycle?.state().status;if(rotation?.state())throw Error('rotation-review-required');if(registry?.state().pending)throw Error('selection-review-required');if(error||freezing||['recovery-required','closed','paused','local-paused','closing'].includes(status))throw Error(error||status||'unified-closing');}
 function externalPending(){const s=bundle?.session.state();if(!bundle?.ready||s.faulted||s.closed)return false;const ext=bundle.session.getLocalDocument()?.data.external;return !!ext&&!ext.reviewed;}
 function publicationBasis(){const s=bundle.session.state();return {accepted:s.accepted?.fingerprint??null,pending:s.pending,draft:s.localState?.layoutDraft??null};}
 function reviewToken(kind,extra={}){const token=Object.freeze({});reviews.set(token,{kind,bundle,epoch:epoch(),basis:publicationBasis(),...extra});return token;}
 function consume(token,kind){const r=reviews.get(token);reviews.delete(token);return r?.kind===kind&&r.bundle===bundle&&r.epoch===epoch()&&equal(r.basis,publicationBasis())?r:null;}
 function recoveryGate(){
  if(lifecycle?.state().status!=='join-required')return gate();
  if(closed||freezing||!writable()||registry?.state().pending)return {reason:'shared-recovery-unavailable'};
  const g=getGraph();return g?.isCurrent()&&!g.hidden?true:{reason:g?.hidden?'view-hidden':'graph-unavailable'};
 }
 function reserveReview(joinRecovery=false){const captured=epoch(),guard=store.reserveExternal(value=>{if(!probeSchema3Snapshot(value,model).ok)throw Error('unified-graph-incompatible');return validateSchema3Snapshot(value);});return guard&&{guard,current:()=>(joinRecovery?recoveryGate():gate())===true&&epoch()===captured};}
 const hashValue=v=>syncContentHash(JSON.stringify(copy(v)));
 async function historicalBasis(){
  const scan=bundle?.attempts?await bundle.attempts.scan():null;
  if(scan&&(scan.issue||scan.blockers.length||scan.quarantined.length))throw Error('shared-input-blocked');
  return hashValue({source:await source(),view:store.snapshot(),epoch:epoch(),selected:registry?.state().selected??null,status:lifecycle?.state().status??'unselected',session:bundle?.session.state()??null,inventory:scan?.inventory??null});
 }
 function historicalGate(){
  assertSave();if(registry?.state().pending||rotation?.state())return false;
  const g=getGraph(),s=bundle?.session.state();
  return !!g?.isCurrent()&&!g.hidden&&(!s?.initialized||bundle.ready&&!s.pending&&!s.faulted&&!s.attemptConflict&&!s.localState?.layoutDraft&&!s.localState?.pendingSave&&!s.localState?.settingsDraft&&!externalPending());
 }
 async function writeLocalRecovery(destination,id,data){
  if(!/^[a-f0-9]{32}$/.test(id)||typeof destination?.create!=='function'||typeof destination?.read!=='function')throw Error('historical-backup-options');
  const body=JSON.stringify(copy(data)),hash=await syncContentHash(body),bytes=new TextEncoder().encode(body).length;
  await destination.create(id+'/initial-config.json',body);if(await destination.read(id+'/initial-config.json',bytes)!==body)throw Error('historical-backup-content');
  const manifest=JSON.stringify({version:1,id,scope:'unjoined-config-recovery',bytes,hash});await destination.create(id+'/manifest.json',manifest);
  if(await destination.read(id+'/manifest.json',262144)!==manifest||await syncContentHash(await destination.read(id+'/initial-config.json',bytes))!==hash)throw Error('historical-backup-content');
 }
 async function rotationBasis(){const s=bundle?.session.state();return hashValue({sequence:s?.sequence,accepted:s?.accepted?.fingerprint,local:s?.localState,pending:s?.pending,configuration:bundle?.session.getLocalDocument(),source:await source()});}
 async function rotationInput({destination,id,choice},intent=null){
  if(!getGraph()?.isCurrent()||getGraph().hidden||saveError)throw Error('rotation-graph-or-unsaved');
  if(!['accepted','draft'].includes(choice)||!destination?.location)throw Error('rotation-options');
  const backup=await verifyRecoveryExport({source:destination,id}),parts=backup.contents;
  if(backup.manifest.installation!==registry.device.state().installation)throw Error('rotation-backup-identity');
  const accepted=validateSchema3Snapshot(parts.get('accepted.json')),drafts=parts.get('drafts.json');
  const ops=backup.manifest.files.filter(r=>r.name.startsWith('operations/')).map(r=>parts.get(r.name));
  const projected=planSchema3Transactions(ops,{vault:backup.manifest.vault,baseline:{...accepted,groups:{},structures:{}},createModel:model});
  if(projected.status!=='candidate'||!equal(projected.proposal.groups,accepted.groups)||!equal(projected.proposal.structures,accepted.structures))throw Error('rotation-backup-projection');
  const selected=validateSchema3Snapshot(choice==='draft'?drafts?.layoutDraft?.value:accepted);
  if(!Object.keys(selected.groups).length||!probeSchema3Snapshot(selected,model).ok)throw Error('rotation-layout');
  if(parts.get('pending.json')||drafts?.pendingSave||drafts?.settingsDraft)throw Error('rotation-pending');
  let inventoryHash=null;
  if(!intent||registry.state().selected?.vault===intent.from){
   const s=bundle?.session.state();
   if(!s?.initialized||s.faulted||s.attemptConflict||s.pending||externalPending()||s.localState?.pendingSave||s.localState?.settingsDraft||registry.state().pending)throw Error('rotation-pending');
   if(backup.manifest.vault!==registry.state().selected.vault||!equal(s.accepted.snapshot,accepted)||!equal(s.localState,drafts)||!equal(bundle.session.getLocalDocument()?.data,parts.get('configuration.json')))throw Error('rotation-backup-stale');
   if(choice==='draft'&&drafts.layoutDraft.baseFingerprint!==s.accepted.fingerprint)throw Error('rotation-draft-stale');
   const scan=await bundle.session.reviewRotationInput();if(scan.issue)throw Error('rotation-shared-input:'+scan.issue);inventoryHash=scan.fingerprint;
   const plan=planSchema3Transactions(scan.records,{vault:backup.manifest.vault,baseline:{...accepted,groups:{},structures:{}},createModel:model});
   if(plan.status!=='candidate'||scan.records.length!==s.accepted.operations.length||!equal(plan.proposal.groups,accepted.groups)||!equal(plan.proposal.structures,accepted.structures))throw Error('rotation-shared-not-accepted');
  }
  const data={...parts.get('configuration.json')?.effective,layoutOverrides:selected};
  return {backup,selected,data,inventoryHash};
 }
 function rootOperation(vault,id,snapshot){return packSchema3Operation({vault,id,parents:[],changes:Object.entries(snapshot.groups).map(([group,record])=>({group,value:{schemaVersion:3,record,structures:record.note?{[record.note]:snapshot.structures[record.note]}:{}}}))});}
 async function openRotationTarget(){const device=await createLifecycleDevice({device:registry.device,app,pluginId,locks});lifecycle=createSyncLifecycle({device,openBundle:makeBundle,checkpoint:step=>checkpoint('lifecycle:'+step)});await lifecycle.open();if(lifecycle.state().status==='disabled')await lifecycle.openLocal();}
 async function performRotation(r){
  const {intent,destination}=r;
  const checked=await rotationInput({destination,id:intent.backupId,choice:intent.choice},rotation.state());
  if(checked.backup.hash!==intent.backupHash||await hashValue(checked.selected)!==intent.snapshotHash)throw Error('rotation-backup-changed');
  if(checked.inventoryHash&&checked.inventoryHash!==intent.inventoryHash)return held('rotation-shared-changed');
  const guard=store.reserveExternal(x=>validateSchema3Snapshot(x));if(!guard)return held('layout-busy');
  const captured=epoch();freezing=true;await stopQueue();
  try{
   if(registry.state().selected?.vault===intent.from&&await rotationBasis()!==intent.basisHash)throw Error('rotation-source-changed');
   await rotation.begin(intent);await checkpoint('rotation:after-intent');
   if(registry.state().selected?.vault!==intent.target||registry.state().pending){
    await lifecycle?.close();bundle=null;
    if(registry.device.state().connection?.enabled)await registry.device.disable();
    await checkpoint('rotation:after-disable');
    const p=await registry.preview(registry.state().pending?{action:'resume'}:{action:'new',vault:intent.target});
    if(p.kind!=='selection-preview')return p;
    const chosen=await registry.confirm(p.token);if(chosen.kind!=='selected')return chosen;
    await checkpoint('rotation:after-selection');
   }
   if(registry.state().selected?.vault!==intent.target)throw Error('rotation-target-changed');
   rotationData=checked.data;
   if(!bundle)await openRotationTarget();
   const pending=bundle.session.state().pending;
   if(pending&&(pending.id!==intent.rootId||await hashValue(pending.operation)!==intent.rootHash))throw Error('rotation-target-intent');
   const scan=await bundle.attempts.scan(pending?{intent:pending.operation,attempts:pending.attempts}:undefined);
   if(scan.issue||scan.blockers.some(row=>row.reason!=='own-truncated-attempt')||scan.quarantined.length||scan.records.some(op=>op.id!==intent.rootId)||scan.inventory.some(row=>!row.name.split('/').at(-1).startsWith(intent.rootId+'.'+intent.rootHash+'.')))throw Error('rotation-target-occupied');
   if(epoch()!==captured||!probeSchema3Snapshot(checked.selected,model).ok)throw Error('rotation-graph-changed');
   const result=unwrap(await bundle.quota.recover(async()=>{
    if(!bundle.session.state().initialized){const joined=await bundle.session.join({localData:rotationData,choice:'import'});if(!bundle.session.state().initialized)return joined;}
    await setupProjection(bundle);return {kind:'joined'};
   }));
   if(!bundle.ready)return result;
   const a=bundle.session.state().accepted;
   if(a.operations.length!==1||a.operations[0].id!==intent.rootId||await hashValue(a.operations[0])!==intent.rootHash||!equal(a.snapshot.groups,checked.selected.groups)||!equal(a.snapshot.structures,checked.selected.structures))throw Error('rotation-root-mismatch');
   await checkpoint('rotation:after-root');
   if(epoch()!==captured||!probeSchema3Snapshot(checked.selected,model).ok)return held('rotation-graph-changed');
   // Lifecycle cached join-required before direct recovery admission; reopen it
   // using the same authenticated target session before lifting the control gate.
   await lifecycle.close();bundle=null;await openRotationTarget();
   if(!bundle.ready)await bundle.quota.recover(()=>setupProjection(bundle));
   await rotation.complete();rotationData=null;exportTasks.clear();saveError=null;
   if(epoch()===captured)guard.apply(bundle.session.state().accepted.snapshot);await deliver();await inspectBudget();
   return report({kind:'rotated',from:intent.from,target:intent.target,rootId:intent.rootId},'rotation');
  }finally{freezing=false;guard.release();startQueue();}
 }
 const easySameLayout=(a,b)=>JSON.stringify(copy({groups:a.groups,structures:a.structures}))===JSON.stringify(copy({groups:b.groups,structures:b.structures}));
 function easyActiveReason(){
  const s=bundle?.session.state();if(!s)return 'clean';
  if(s.pending)return 'waiting';
  if(s.localState?.layoutDraft)return 'draft-pending';
  const last=publisherQueue?.state().lastResult;
  if(last&&String(last.kind).startsWith('accepted'))return 'written';
  if(!s.accepted?.operations?.length)return 'awaiting-transfer';
  return 'clean';
 }
 // Internal (already-enqueued) forms of the public review methods. The easy
 // orchestration calls these inside a single host task; it never awaits a public
 // enqueued method from within a queued task (that would deadlock the serial queue).
 async function joinPreviewInternal(){
  if(rotation?.state())return held('rotation-review-required');
  if(!getGraph()?.isCurrent())return held('graph-unavailable');
  if(!bundle||bundle.ready)return held('join-not-required');const data=await source(),before=epoch();const result=unwrap(await lifecycle.join(b=>b.session.previewJoin({localData:data})));
  if(result.kind!=='join-preview')return result;
  const token=Object.freeze({});joinTokens.set(token,{data,epoch:before,fingerprint:result.fingerprint,currentFingerprint:result.currentFingerprint,canImport:result.canImport,canCurrent:result.canCurrent,bundle});return {...result,token,canImport:result.canImport&&writable(),canCurrent:result.canCurrent&&writable()};
 }
 async function joinConfirmInternal(token,choice){
  if(!getGraph()?.isCurrent())return held('graph-unavailable');
  const review=joinTokens.get(token);joinTokens.delete(token);if(!review||review.bundle!==bundle||review.epoch!==epoch()||!['import','shared','current'].includes(choice)||choice==='current'&&!review.canCurrent)return held('join-review-changed');
  const current=await source();if(!equal(layoutOf(current),layoutOf(review.data))||choice!=='shared'&&!writable())return held('join-source-changed');
  const guard=store.reserveExternal(value=>{if(!probeSchema3Snapshot(value,model).ok)throw Error('unified-graph-incompatible');return validateSchema3Snapshot(value);});if(!guard)return held('layout-busy');
  try{
   const result=unwrap(await lifecycle.join(async b=>{
    const joined=await b.session.join({localData:current,choice,expectedSharedFingerprint:review.fingerprint,...(choice!=='import'&&review.currentFingerprint?{expectedCurrentFingerprint:review.currentFingerprint}:{})});
    if(b.session.state().initialized)await setupProjection(b);return joined;
   }));
   if(!bundle.ready)return result;
   startQueue();
   if(epoch()!==review.epoch||!getGraph()?.isCurrent())return held('join-view-deferred');
   guard.apply(bundle.session.state().accepted.snapshot);await deliver();return {kind:'joined',result};
  }finally{guard.release();}
 }
 async function selectInternal(token){
  if(rotation?.state())return held('rotation-review-required');
  if(bundle&&registry.device.state().connection?.enabled&&!registry.state().pending)return held('disable-before-selection');await ensure();await stopQueue();await lifecycle.close();bundle=null;
  const result=await registry.confirm(token);
  const device=await createLifecycleDevice({device:registry.device,app,pluginId,locks});lifecycle=createSyncLifecycle({device,openBundle:makeBundle,checkpoint:step=>checkpoint('lifecycle:'+step)});if(!registry.state().pending)await lifecycle.open();
  if(lifecycle.state().status==='disabled'&&registry.device.state().connection&&!registry.device.state().connection.enabled)await lifecycle.openLocal();
  startQueue();return result;
 }
 async function enableInternal(vault){await stopQueue();await lifecycle.enable(vault);startQueue();return {kind:'enabled'};}
 async function easyJoin(){
  if(!getGraph()?.isCurrent()){easy.phase='preparing';easy.reason='graph-unavailable';return held('graph-unavailable');}
  const preview=await joinPreviewInternal();
  if(preview.kind!=='join-preview'){easy.phase='paused';easy.reason=preview.reason??preview.kind;return preview;}
  const local=preview.local,localEmpty=!local||Object.keys(local.groups||{}).length===0;
  let choice=null;
  if(preview.localIssue){easy.phase='review-required';easy.reason='local-layout-review';easy.target=preview;return {kind:'easy-review-required',reason:'local-layout-review',preview};}
  if(localEmpty)choice='shared';
  else if(preview.canImport&&preview.operations===0)choice='import';
  else if(preview.canImport&&preview.operations>0&&preview.shared&&easySameLayout(local,preview.shared))choice='shared';
  else {easy.phase='review-required';easy.reason='join-choice-required';easy.target=preview;return {kind:'easy-review-required',reason:'join-choice-required',preview};}
  easy.phase='joining';easy.reason=null;
  const result=await joinConfirmInternal(preview.token,choice);
  if(['joined','adopted','adopted-deferred','imported','imported-deferred','already-joined'].includes(result.kind)){easy.phase='active';easy.reason=easyActiveReason();easy.target=null;return {kind:'easy-joined',result};}
  easy.phase=result.kind==='review-required'?'review-required':'paused';easy.reason=result.reason??result.kind;easy.target=preview;return result;
 }
 async function easySelect(candidate){
  easy.phase='preparing';easy.reason=null;easy.target={vault:candidate.vault,transport:candidate.transport};
  const p=await registry.preview({action:'join',vault:candidate.vault,transport:candidate.transport});
  if(p.kind!=='selection-preview'){easy.phase='paused';easy.reason=p.reason;return p;}
  const result=await selectInternal(p.token);
  if(result.kind!=='selected'){easy.phase='paused';easy.reason=result.reason;return result;}
  const st=lifecycle.state().status;
  if(st==='join-required')return await easyJoin();
  if(st==='ready'||st==='paused'){easy.phase='active';easy.reason=easyActiveReason();return {kind:'easy-active'};}
  easy.phase='preparing';easy.reason=st;return {kind:'easy-preparing'};
 }
 async function easyResume({reenable=false}={}){
  const auth=easyAuth.state();
  if(!auth.authorized){easy.phase='idle';easy.reason=null;return held('easy-sync-not-authorized');}
  if(!auth.enabled&&!reenable){easy.phase='off';easy.reason=null;return {kind:'easy-off'};}
  if(error){easy.phase='paused';easy.reason=error;return held(error);}
  if(rotation?.state()){easy.phase='paused';easy.reason='rotation-review-required';return held('rotation-review-required');}
  if(registry.state().pending){const r=await registry.resume();if(r.kind!=='selected'&&r.kind!=='ready'){easy.phase='paused';easy.reason=r.reason;return r;}}
  const selected=registry.state().selected;
  if(selected){
   const conn=registry.device.state().connection;
   if(!conn?.enabled){
    if(reenable)await enableInternal(selected.vault);
    else {easy.phase='off';easy.reason=null;return {kind:'easy-off'};}
   }
   const st=lifecycle.state().status;
   if(st==='join-required')return await easyJoin();
   if(st==='ready'||st==='paused'){easy.phase='active';easy.reason=easyActiveReason();return {kind:'easy-active'};}
   if(st==='recovery-required'){easy.phase='paused';easy.reason='recovery-required';return held('recovery-required');}
   easy.phase='preparing';easy.reason=st;return {kind:'easy-preparing'};
  }
  const scan=await createSyncConnectionCatalog({adapter}).scan();
  if(scan.kind!=='catalog'){easy.phase='paused';easy.reason=scan.reason;return scan;}
  const writableCandidates=scan.candidates.filter(c=>c.transport==='attempts-v1');
  const readonlyCandidates=scan.candidates.filter(c=>c.transport==='v2');
  if(writableCandidates.length===1)return await easySelect(writableCandidates[0]);
  if(writableCandidates.length>1){easy.phase='selecting';easy.reason=null;easy.candidates=copy(scan.candidates);return {kind:'easy-selecting',candidates:copy(scan.candidates)};}
  if(readonlyCandidates.length>0){easy.phase='review-required';easy.reason='legacy-read-only';easy.candidates=copy(readonlyCandidates);return {kind:'easy-legacy-read-only',candidates:copy(readonlyCandidates)};}
  const boot=createDefaultLayoutBootstrap(adapter);
  const ensured=await boot.ensure();
  if(ensured.kind==='held'){easy.phase='paused';easy.reason=ensured.reason;return ensured;}
  const rescan=await createSyncConnectionCatalog({adapter}).scan();
  if(rescan.kind!=='catalog'){easy.phase='paused';easy.reason=rescan.reason;return rescan;}
  const def=rescan.candidates.find(c=>c.vault===DEFAULT_LAYOUT_VAULT_ID&&c.transport==='attempts-v1');
  if(def)return await easySelect(def);
  easy.phase='awaiting-transfer';easy.reason=null;return {kind:'easy-awaiting-transfer'};
 }
 const host={store,
  state:()=>({status:error?'recovery-required':rotation?.state()?'rotation-review-required':registry?.state().pending?'selection-review-required':lifecycle?.state().status??'unselected',rotationPending:rotation?.state()??null,error,saveError,outcome,privateBudget,externalPending:externalPending(),selectionPending:registry?.state().pending?.selection??null,selected:registry?.state().selected??null,installation:registry?.device.state().installation??null,session:bundle?.session.state()??null,externalEpoch,publication:publisherQueue?.state()??null}),
  subscribe(fn){if(typeof fn!=='function'||listeners.size>=32)throw Error('unified-status-listener');listeners.add(fn);return ()=>listeners.delete(fn);},
  discover:()=>enqueue(async()=>{const catalog=createSyncConnectionCatalog({adapter}),scan=await catalog.scan();if(scan.kind==='catalog'||!['catalog-file-budget','catalog-byte-budget'].includes(scan.reason))return scan;
   const topology=await catalog.scan({target:{vault:'0'.repeat(32),transport:'attempts-v1'}});if(topology.kind!=='catalog')return topology;
   return {kind:'catalog',scope:'namespaces-only',reason:scan.reason,namespaces:topology.namespaces,candidates:topology.namespaces.map(n=>({...n,operations:null,verified:false}))};}),
  diagnostics:()=>enqueue(async()=>{
   await publisherQueue?.settled();await lifecycle?.settled();await inspectBudget();const state=host.state(),s=state.session;
   let sharedInventory=null;if(bundle?.attempts)try{const scan=await bundle.attempts.scan();sharedInventory={inventory:scan.inventory,blockers:scan.blockers,quarantined:scan.quarantined};}catch{sharedInventory={issue:'attempt-scan-unavailable'};}
   return copy({version:1,status:state.status,error:state.error,saveError:state.saveError,connection:state.selected,selectionPending:state.selectionPending,rotationPending:state.rotationPending,installation:state.installation,
    attemptConflict:s?.attemptConflict??null,sharedInventory,privateBudget,
    sequence:s?.sequence??null,faulted:s?.faulted??false,accepted:s?.accepted??null,pending:s?.pending??null,layoutDraft:s?.localState?.layoutDraft??null,
    pendingSave:s?.localState?.pendingSave??null,externalPending:state.externalPending,outcome:state.outcome,
    publication:state.publication?{closed:!!state.publication.closed,armed:!!state.publication.armed,paused:!!state.publication.paused,running:!!state.publication.running,lastResult:state.publication.lastResult?{kind:state.publication.lastResult.kind,reason:state.publication.lastResult.reason??null}:null}:null,view:store.state()});
  }),
  exportRecovery:options=>enqueue(async()=>{
   if(!bundle?.ready||error||bundle.session.state().faulted)return held('reopen-required');
   if(!/^[a-f0-9]{32}$/.test(options?.id)||!options.destination)throw Error('recovery-export-options');
   freezing=true;await stopQueue();
   try{
    let data=exportTasks.get(options.id);
    if(!data){data=await lifecycle.exportRecovery({capture:value=>value});exportTasks.clear();exportTasks.set(options.id,data);}
    const result=await withExportFolders(options.destination,options.id,()=>exportRecoveryParts({...options,...data}));await verifyRecoveryExport({source:options.destination,id:options.id});await inspectBudget();return result;
   }finally{freezing=false;startQueue();}
  }),
  previewRollback:options=>enqueue(async()=>{
   if(!lifecycle?.state().status.startsWith('local-'))return held('disable-before-rollback');
   if(rotation?.state()||registry?.state().pending)return held('selection-or-rotation-review-required');
   const checked=await rotationInput(options),exportId=randomSyncOperationId();
   const token=Object.freeze({});reviews.set(token,{kind:'rollback',epoch:epoch(),options:{...options},exportId,basisHash:await rotationBasis(),backupHash:checked.backup.hash,inventoryHash:checked.inventoryHash});
   return {kind:'rollback-review',token,exportId,data:copy(checked.data),choice:options.choice,backup:options.destination.location+'/'+options.id,path:options.destination.location+'/'+exportId+'/data.json'};
  }),
  confirmRollback:token=>enqueue(async()=>{
   const r=reviews.get(token);reviews.delete(token);
   if(r?.kind!=='rollback'||!lifecycle?.state().status.startsWith('local-')||rotation?.state()||registry?.state().pending||r.epoch!==epoch()||r.basisHash!==await rotationBasis())return held('rollback-review-changed');
   const checked=await rotationInput(r.options);
   if(checked.backup.hash!==r.backupHash||checked.inventoryHash!==r.inventoryHash)return held('rollback-review-changed');
   const guard=store.reserveExternal(value=>validateSchema3Snapshot(value));if(!guard)return held('layout-busy');
   freezing=true;await stopQueue();
   try{return await withExportFolders(r.options.destination,r.exportId,async()=>{
    const {destination}=r.options,body=JSON.stringify(cloneBoundedSyncJson(checked.data,{maxBytes:8388608}));
    const manifest={version:1,id:r.exportId,scope:'compatibility-data-not-acceptance',bytes:new TextEncoder().encode(body).length,hash:await syncContentHash(body)};
    await destination.create(r.exportId+'/data.json',body);
    if(await destination.read(r.exportId+'/data.json',manifest.bytes)!==body)throw Error('rollback-output-conflict');
    const current=await rotationInput(r.options);
    if(r.epoch!==epoch()||r.basisHash!==await rotationBasis()||current.backup.hash!==r.backupHash||current.inventoryHash!==r.inventoryHash)return held('rollback-review-changed');
    await destination.create(r.exportId+'/manifest.json',JSON.stringify(copy(manifest)));
    const verified=await readCompatibilityExport({source:destination,id:r.exportId});if(!equal(verified,checked.data))throw Error('rollback-output-conflict');
    const final=await rotationInput(r.options);
    if(r.epoch!==epoch()||r.basisHash!==await rotationBasis()||final.backup.hash!==r.backupHash||final.inventoryHash!==r.inventoryHash)return held('rollback-review-changed');
    return {kind:'compatibility-exported',id:r.exportId,path:destination.location+'/'+r.exportId+'/data.json',choice:r.options.choice,backup:destination.location+'/'+r.options.id};
   });
   }finally{guard.release();freezing=false;startQueue();}
  }),
  previewRotation:options=>enqueue(async()=>{
   if(rotation?.state())return held('rotation-review-required');await publisherQueue?.settled();await lifecycle?.settled();
   const checked=await rotationInput(options),target=randomSyncOperationId(),rootId=randomSyncOperationId();
   const capacity=await registry.preview({action:'new',vault:target});if(capacity.kind==='selection-preview')registry.discard(capacity.token);else if(capacity.reason!=='disable-before-switch')return capacity;
   const intent={version:1,installation:registry.device.state().installation,from:registry.state().selected.vault,target,rootId,backupId:options.id,location:options.destination.location,backupHash:checked.backup.hash,snapshotHash:await hashValue(checked.selected),rootHash:await hashValue(rootOperation(target,rootId,checked.selected)),basisHash:await rotationBasis(),inventoryHash:checked.inventoryHash,choice:options.choice};
   const token=Object.freeze({});reviews.set(token,{kind:'rotation',epoch:epoch(),intent,destination:options.destination});
   return {kind:'rotation-review',token,from:intent.from,target,rootId,choice:options.choice,proposal:checked.selected,backup:intent.location+'/'+intent.backupId};
  }),
  previewAbandonPublication:({destination,id}={})=>enqueue(async()=>{
   if(rotation?.state()||!bundle?.ready||lifecycle.state().status.startsWith('local-'))return held('enable-before-publication-review');
   await publisherQueue?.settled();const backup=await verifyRecoveryExport({source:destination,id}),s=bundle.session.state();
   if(!s.pending||!equal(backup.contents.get('pending-operation.json'),s.pending.operation)||!equal(backup.contents.get('drafts.json'),s.localState)||backup.manifest.vault!==registry.state().selected.vault||backup.manifest.installation!==registry.device.state().installation)throw Error('abandon-backup-stale');
   const scan=await bundle.session.reviewAbandonPublication();if(scan.issue)return held(scan.issue);
   return {kind:'abandon-review',token:reviewToken('abandon',{destination,id,backupHash:backup.hash,inventoryHash:scan.fingerprint,head:s.head}),pendingId:s.pending.id};
  }),
  confirmAbandonPublication:token=>enqueue(async()=>{
   const r=consume(token,'abandon');if(!r||bundle.session.state().head!==r.head||rotation?.state())return held('abandon-review-changed');
   freezing=true;await stopQueue();try{const backup=await verifyRecoveryExport({source:r.destination,id:r.id});if(backup.hash!==r.backupHash)throw Error('abandon-backup-changed');return report(unwrap(await bundle.quota.recover(()=>bundle.session.abandonPublication(r))),'recovery');}finally{freezing=false;startQueue();}
  }),
  previewRotationResume:({destination}={})=>enqueue(async()=>{
   const intent=rotation?.state();if(!intent)return held('rotation-not-pending');if(destination?.location!==intent.location)throw Error('rotation-backup-location');
   const checked=await rotationInput({destination,id:intent.backupId,choice:intent.choice},intent);
   if(checked.backup.hash!==intent.backupHash)throw Error('rotation-backup-changed');
   const token=Object.freeze({});reviews.set(token,{kind:'rotation',epoch:epoch(),intent,destination});return {kind:'rotation-review',token,from:intent.from,target:intent.target,rootId:intent.rootId,choice:intent.choice,proposal:checked.selected,backup:intent.location+'/'+intent.backupId};
  }),
  confirmRotation:token=>enqueue(async()=>{const r=reviews.get(token);reviews.delete(token);if(r?.kind!=='rotation'||r.epoch!==epoch())return held('rotation-review-changed');return performRotation(r);}),
  previewRotationAbort:()=>enqueue(async()=>{
   const intent=rotation?.state();if(!intent||registry.state().pending||registry.state().selected?.vault!==intent.from)return held('rotation-already-switched');
   const token=Object.freeze({});reviews.set(token,{kind:'rotation-abort',intent,epoch:epoch()});return {kind:'rotation-abort-review',token,from:intent.from,target:intent.target};
  }),
  confirmRotationAbort:token=>enqueue(async()=>{
   const r=reviews.get(token);reviews.delete(token);if(r?.kind!=='rotation-abort'||r.epoch!==epoch()||!equal(r.intent,rotation?.state())||registry.state().pending||registry.state().selected?.vault!==r.intent.from)return held('rotation-abort-changed');
   if(!bundle)await openRotationTarget();await rotation.complete();rotationData=null;startQueue();return report({kind:'rotation-aborted',from:r.intent.from},'rotation');
  }),
  previewSelection:options=>enqueue(async()=>{await ensure();return rotation.state()?held('rotation-review-required'):registry.preview(options);}),
  discardSelection:token=>registry?.discard(token),
  confirmSelection:token=>enqueue(()=>selectInternal(token)),
  previewJoin:()=>enqueue(joinPreviewInternal),
  discardJoin:token=>joinTokens.delete(token),
  discardReview(token){const r=reviews.get(token);if(r?.sessionToken){if(r.kind==='shared-recovery')r.bundle.session.discardSharedRecovery(r.sessionToken);else r.bundle.session.discardConflictReview(r.sessionToken);}reviews.delete(token);},
  previewSharedRecovery:()=>enqueue(async()=>{
   if(!bundle||recoveryGate()!==true)return held(recoveryGate().reason||'join-required');
   const review=unwrap(await lifecycle[lifecycle.state().status==='join-required'?'join':'run'](b=>b.session.previewSharedRecovery()));if(review.kind!=='shared-recovery-review')return report(review,'recovery');
   return {...review,token:reviewToken('shared-recovery',{sessionToken:review.token})};
  }),
  confirmSharedRecovery:token=>enqueue(async()=>{
   const review=consume(token,'shared-recovery');if(!review||recoveryGate()!==true)return held('shared-recovery-changed');
   const reserved=reserveReview(true);if(!reserved)return held('layout-busy');
   try{return report(unwrap(await lifecycle[lifecycle.state().status==='join-required'?'join':'run'](b=>b.session.confirmSharedRecovery(review.sessionToken,{canContinue:reserved.current}))),'recovery');}finally{reserved.guard.release();}
  }),
  previewPublication:()=>enqueue(async()=>{
   if(!bundle?.ready||!publisherQueue)return held('publication-unavailable');await publisherQueue.settled();const captured=epoch(),basis=publicationBasis();
   if(basis.pending?.mode==='resolution')return held('conflict-confirmation-required');
   if(!basis.pending&&!basis.draft)return held('no-pending-publication');
   const scan=await bundle.session.reviewPublicationInput();if(scan.issue)return held(scan.issue);
   if(captured!==epoch()||!equal(basis,publicationBasis()))return held('publication-review-changed');
   const accepted=bundle.session.state().accepted,competition=scan.records.some(op=>!accepted.appliedIds.includes(op.id)&&op.id!==basis.pending?.id);
   const shared=planSchema3Transactions(scan.records,{vault:registry.state().selected.vault,baseline:{...accepted.snapshot,groups:{},structures:{}},createModel:model});
   return {kind:'publication-review',token:reviewToken('publication',{inventory:copy(scan.inventory)}),competition,shared:shared.status==='candidate'?shared.proposal:null,accepted:accepted.snapshot,pending:basis.pending,draft:basis.draft};
  }),
  confirmPublication:token=>enqueue(async()=>{
   const review=consume(token,'publication');if(!bundle||!review)return held('publication-review-changed');if(gate()!==true)return held(gate().reason);
   await stopQueue();
   try{const result=await bundle.publisher.publish({canContinue:()=>gate()===true&&epoch()===review.epoch,reviewedConflict:{inventory:review.inventory}});return report(result.sharedStatus==='conflict'?{...result,reason:'shared-conflict-review-required'}:result,'publication');}
   finally{startQueue();}
  }),
  previewConflict:()=>enqueue(async()=>{
   if(gate()!==true||!bundle?.ready)return held(gate().reason||'join-required');
   if(bundle.session.state().localState?.layoutDraft)return held('local-layout-review-required');
   const pending=bundle.session.state().pending;let review;
   if(pending?.mode==='resolution')review={kind:'review',choices:[{id:pending.choice,changes:pending.operation.changes.map(({group})=>({group,value:pending.proposal.groups[group]?{record:pending.proposal.groups[group],structures:pending.proposal.structures}:null}))}]};
   else try{review=await run(b=>b.session.previewConflictResolution());}catch(error){if(error.message==='resolution-one-domain-required'){
    const scan=await bundle.attempts.scan();if(scan.issue||scan.blockers.length||scan.quarantined.length)return held(scan.issue||'shared-input-blocked');const index=inspectSchema3History(scan.records,{vault:registry.state().selected.vault}).index;
    if(index.pending.length||index.issues.length||index.quarantined.length)return held('shared-input-blocked');
    return held(index.frontiers.some(f=>f.heads.length>1)?'multiple-shared-conflicts':'no-shared-conflict');
   }throw error;}
   if(review.kind!=='review')return review;
   return {...review,pending:pending?.mode==='resolution',token:reviewToken('conflict',{sessionToken:review.token??null})};
  }),
  confirmConflict:(token,choice)=>enqueue(async()=>{
   if(!bundle)return held('join-required');const review=consume(token,'conflict');if(!review||gate()!==true)return held('resolution-input-changed');
   const reserved=reserveReview();if(!reserved)return held('layout-busy');
   try{
    const result=await run(async b=>{
     if(!b.session.state().pending){const staged=await b.session.confirmConflictResolution(review.sessionToken,choice);if(staged.kind!=='staged')return staged;}
     else if(b.session.state().pending.mode!=='resolution'||b.session.state().pending.choice!==choice)return held('resolution-input-changed');
     return b.session.publish({canContinue:reserved.current});
    });
    report(result,'publication');if(result.kind.startsWith('accepted')&&reserved.current()){reserved.guard.apply(bundle.session.state().accepted.snapshot);await deliver();}return result;
   }finally{reserved.guard.release();}
  }),
  previewExternalSettings:()=>enqueue(async()=>{
   if(!bundle?.ready)return held('join-required');await run(observe);const doc=bundle.session.getLocalDocument(),ext=doc.data.external;
   if(!ext||ext.reviewed)return held('no-external-settings');const review=await run(b=>b.projection.reviewExternal(ext.id));
   return {kind:'settings-review',review,token:reviewToken('external',{document:doc.version,id:ext.id})};
  }),
  confirmExternalSettings:(token,choice)=>enqueue(async()=>{
   if(!bundle)return held('join-required');const r=consume(token,'external');if(!r||bundle.session.getLocalDocument().version!==r.document)return held('external-review-changed');
   const result=await run(b=>b.projection.resolveExternal(r.id,{choice}));await deliver();return result;
  }),
  joinEvidence:()=>enqueue(async()=>bundle?{backup:bundle.session.getJoinBackup(),proof:bundle.session.getJoinProof()}:null),
  confirmJoin:(token,choice)=>enqueue(()=>joinConfirmInternal(token,choice)),
  prepareLocalGraph:({createModel,isCurrent,epoch:expected}={})=>enqueue(async()=>{
   if(bundle?.session.state().initialized)return held('already-joined');assertSave();
   if(typeof createModel!=='function'||typeof isCurrent!=='function'||expected!==getEpoch()||!isCurrent())return held('graph-changed');
   const current=await source(),raw=current.layoutOverrides;if(raw==null)return {kind:'unchanged'};
   const next=reconcileLocalLayout(raw,createModel);if(!localLayoutChanged(raw,next))return {kind:'unchanged'};
   const guard=store.reserveExternal(x=>x);if(!guard)return held('layout-busy');
   try{
    if(expected!==getEpoch()||!isCurrent())return held('graph-changed');
    next.revision=raw.revision+1;
    const data={...current,layoutOverrides:next,layoutUpgradeOriginal:current.layoutUpgradeOriginal??{version:1,layoutOverrides:copy(raw)}};
    await saveUnjoined(data,{expected:current});guard.apply(next);
    return {kind:'local-reconciled',deferred:expected!==getEpoch()||!isCurrent()};
   }finally{guard.release();}
  }),
  previewHistoricalRestore:({readBackup=async()=>await bundle?.session.getJoinBackup()??await source()}={})=>enqueue(async()=>{
   if(typeof readBackup!=='function')throw Error('historical-backup-options');
   await publisherQueue?.settled();if(!historicalGate())return held('historical-restore-unavailable');
   const before=await historicalBasis(),data=copy(await readBackup()),sourceLayout=readHistoricalLayout(data),currentLayout=store.snapshot();
   const plan=planHistoricalLayout({sourceLayout,currentLayout,createModel:model});
   if(before!==await historicalBasis())return held('historical-restore-changed');
   const token=Object.freeze({});historicalReviews.set(token,{readBackup,hash:await hashValue(data),basis:before,plan,sourceLayout});
   return {kind:'historical-restore-review',token,...copy(plan)};
  }),
  discardHistoricalRestore:token=>historicalReviews.delete(token),
  confirmHistoricalRestore:(token,{groups,destination,backupId}={})=>enqueue(async()=>{
   const r=historicalReviews.get(token);historicalReviews.delete(token);
   if(!r||!groups?.length)return held('historical-restore-selection');
   if(!historicalGate()||r.basis!==await historicalBasis()||r.hash!==await hashValue(await r.readBackup()))return held('historical-restore-changed');
   const fresh=planHistoricalLayout({sourceLayout:r.sourceLayout,currentLayout:store.snapshot(),createModel:model});
   if(!equal(fresh,r.plan))return held('historical-restore-changed');
   const next=mergeHistoricalGroups(store.snapshot(),fresh.rows,groups),joined=!!bundle?.session.state().initialized;
   if(joined){validateSchema3Snapshot(next);if(!probeSchema3Snapshot(next,model).ok)return held('graph-incompatible');}
   const guard=store.reserveExternal(x=>x);if(!guard)return held('layout-busy');
   freezing=true;await stopQueue();
   try{
    const before=await source();
    if(joined){
     const data=await lifecycle.exportRecovery({capture:value=>value});
     await withExportFolders(destination,backupId,()=>exportRecoveryParts({destination,id:backupId,...data}));await verifyRecoveryExport({source:destination,id:backupId});
    }else await withExportFolders(destination,backupId,()=>writeLocalRecovery(destination,backupId,before));
    await checkpoint('historical:after-backup');
    if(r.basis!==await historicalBasis()||r.hash!==await hashValue(await r.readBackup())||!getGraph()?.isCurrent())return held('historical-restore-changed');
    if(joined){const draft=await run(b=>b.coordinator.stageLayoutDraft(next));await checkpoint('historical:after-draft');guard.apply(next);return {kind:'restore-staged',id:draft.id,backup:destination.location+'/'+backupId};}
    await saveUnjoined({...before,layoutOverrides:next,layoutUpgradeOriginal:before.layoutUpgradeOriginal??{version:1,layoutOverrides:copy(before.layoutOverrides??{schemaVersion:3,revision:0,groups:{},structures:{}})}},{expected:before});guard.apply(next);return {kind:'restored-local',backup:destination.location+'/'+backupId};
   }finally{freezing=false;guard.release();startQueue();}
  }),
  saveLayout:value=>enqueue(async()=>{
   const before=epoch();assertSave();
   if(!bundle?.ready){if(bundle?.session.state().initialized)throw Error('reopen-required');const data=await source(),layout=validateUnjoinedLayoutEdit(data.layoutOverrides,copy(value),model);if(before!==epoch())throw Error('unified-graph-changed');await saveUnjoined({...data,layoutOverrides:layout},{expected:data});return {kind:'saved-local'};}
   const layout=validateSchema3Snapshot(value);if(!probeSchema3Snapshot(layout,model).ok)throw Error('unified-graph-incompatible');
   const draft=await run(b=>{if(before!==epoch()||!probeSchema3Snapshot(layout,model).ok)throw Error('unified-graph-changed');return b.coordinator.stageLayoutDraft(layout);});publisherQueue?.notifySaved(draft.id);return {kind:'saved-draft',id:draft.id};
  }),
  saveSettings:value=>enqueue(async()=>{
   assertSave();
   if(!bundle?.ready){const current=await source(),checked=validateSettings({...current,settings:value.settings,pipeline:value.pipeline});await saveUnjoined(checked,{expected:current});return {kind:'saved-local'};}
   const result=await run(async b=>{let draft=b.coordinator.state().settingsDraft;if(!draft)draft=await b.coordinator.beginSettingsDraft();await b.coordinator.updateSettingsDraft(draft.id,value);return b.coordinator.saveSettingsDraft(draft.id);});await deliver();return result;
  }),
  saveUi:(key,value)=>enqueue(async()=>{
   assertSave();
   if(!bundle?.ready){const data=await source();await saveUnjoined({...data,ui:{...data.ui,[key]:String(value)}},{expected:data});return {kind:'saved-local'};}
   const result=await run(b=>b.coordinator.saveUi(key,value));await deliver();return result;
  }),
  notifyExternalChange(){externalEpoch++;return enqueue(async()=>{if(!bundle?.ready)return {kind:'local-input'};const result=await run(observe);await deliver();return result;});},
  effective:()=>enqueue(deliver),
  receive:options=>{if(gate(false)!==true)return Promise.resolve(held(gate(false).reason));return lifecycle.run(b=>b.session.acceptExternal(options)).then(unwrap).then(r=>report(r,'receive'));},
  canReceive:()=>gate(false)===true,
  canReviewRotation:()=>!!getGraph()?.isCurrent()&&!getGraph().hidden&&!saveError,
  isExportEvent:(...paths)=>{const present=paths.filter(Boolean);return !!exportFolders&&present.length>0&&present.every(p=>exportFolders.has(p));},
  notifyPathChange(oldPath,newPath,folder){if(!pathChanges.length)pathBasis=bundle?.session.state().accepted?.fingerprint??null;if(pathChanges.length>=64){pathOverflow=true;return report(held('structure-path-budget'),'structure');}pathChanges.push({oldPath,newPath,folder:!!folder});},
  wakeStructure:()=>structureWaiting&&gate()===true?host.graphReady():Promise.resolve({kind:'noop'}),
  graphReady:()=>enqueue(async()=>{
   if(!bundle?.ready)return held('join-required');
   const completed=await finishObservedStructure();if(completed.kind!=='noop')return completed;
   const state=bundle.session.state(),draft=state.localState?.layoutDraft;
   if(draft&&draft.baseFingerprint!==state.accepted.fingerprint)return held('layout-draft-review');
   const target=draft?.value??state.accepted.snapshot;
   if(!probeSchema3Snapshot(target,model).ok){
    if(draft||state.pending)return report(held('graph-incompatible'),'structure');
    if(gate()!==true){structureWaiting=true;return report(held('graph-incompatible'),'structure');}
    if(pathOverflow||pathChanges.length&&pathBasis!==state.accepted.fingerprint)return report(held('structure-path-review'),'structure');
    const captured=epoch(),pathCount=pathChanges.length,guard=store.reserveExternal(x=>validateSchema3Snapshot(x));if(!guard){structureWaiting=true;return held('layout-busy');}structureWaiting=false;
    try{
     const scan=await bundle.attempts.scan();if(scan.issue||scan.blockers.length||scan.quarantined.length)return report(held(scan.issue||'shared-input-blocked'),'structure');
     let proposal;
     try{proposal=createLayoutActionAuthor({vault:registry.state().selected.vault,createModel:model}).prepareReconcile({vault:registry.state().selected.vault,sharedScanComplete:true,records:scan.records,appliedIds:state.accepted.appliedIds,localBaseline:state.accepted.snapshot},{pathChanges:copy(pathChanges)});}catch{return report(held('graph-incompatible'),'structure');}
     if(proposal.kind!=='publish')return report(held('graph-incompatible'),'structure');
     // Replicated notes may precede their layout files. Two devices repairing
     // the exact same causal input must author one logical operation, even
     // when they publish different physical attempt paths. Ordinary edits and
     // previously written random-ID history are deliberately unaffected.
     const originalId=proposal.operation.id,operation={...proposal.operation,id:'0'.repeat(32)};
     operation.id=(await syncContentHash('KM-SYNC-STRUCTURE-ID-1\n'+JSON.stringify(copy(operation)))).slice(0,32);
     const existing=scan.records.find(op=>op.id===operation.id);
     if(existing&&!equal(existing,operation))return report(held('structural-id-conflict'),'structure');
     proposal={...proposal,operation,appliedIds:proposal.appliedIds.map(id=>id===originalId?operation.id:id)};
     const shared=planSchema3Transactions([...scan.records.filter(op=>op.id!==operation.id),operation],{vault:registry.state().selected.vault,baseline:proposal.proposal,createModel:model});
     if(shared.status!=='candidate')return report(held('graph-incompatible'),'structure');
     const current=()=>captured===epoch()&&gate()===true;
     if(!current()){structureWaiting=true;return held('graph-incompatible');}
     const result=await run(async b=>{
      if(existing)return b.session.acceptExternal({model,reserve:current});
      await b.session.stage(proposal);pathChanges.splice(0,pathCount);if(!pathChanges.length)pathBasis=null;return b.session.publish({canContinue:current});
     });
     if(existing&&result.kind.startsWith('accepted')){pathChanges.splice(0,pathCount);if(!pathChanges.length)pathBasis=null;}
     if(result.kind.startsWith('accepted')&&current()){guard.apply(bundle.session.state().accepted.snapshot);await deliver();}
     return report(result,'structure');
    }finally{guard.release();}
   }
   pathChanges.length=0;pathBasis=null;pathOverflow=false;structureWaiting=false;
   const guard=store.reserveExternal(x=>validateSchema3Snapshot(x));if(!guard){structureWaiting=true;return held('layout-busy');}
   try{guard.apply(target);}finally{guard.release();}return {kind:'projected'};
  }),
  finishObservedStructure:()=>enqueue(finishObservedStructure),
  resumePublication:options=>{
   if(!bundle?.session.state().pending)return publisherQueue?publisherQueue.resume(options):Promise.resolve(held('publication-unavailable'));
   return enqueue(async()=>{const completed=await finishObservedStructure();if(completed.kind!=='noop')return completed;return publisherQueue?publisherQueue.resume(options):held('publication-unavailable');});
  },
  async disable(){if(rotation?.state())return held('rotation-review-required');if(registry?.state().pending)return held('selection-review-required');freezing=true;await stopQueue();return enqueue(async()=>{try{await lifecycle?.disable();bundle=null;await lifecycle?.openLocal();return {kind:'disabled'};}finally{freezing=false;}});},
  enable:()=>enqueue(async()=>{if(rotation?.state())return held('rotation-review-required');if(!registry?.state().selected)return held('selection-required');if(registry.state().pending)return held('selection-review-required');await stopQueue();await lifecycle.enable(registry.state().selected.vault);startQueue();return {kind:'enabled'};}),
  // One-switch easy setup. startEasySync is the only entry that persists a fresh
  // authorization; resumeEasySync continues an existing one without expanding it.
  // Both run inside a single host task and call internal forms only (no nested
  // public enqueue, which would deadlock the serial queue).
  startEasySync:()=>enqueue(async()=>{await ensure();await easyAuth.authorize();return easyResume({reenable:true});}),
  resumeEasySync:()=>enqueue(async()=>{await ensure();if(!easyAuth.state().authorized){easy.phase='idle';easy.reason=null;return held('easy-sync-not-authorized');}return easyResume({reenable:false});}),
  stopEasySync:()=>enqueue(async()=>{
   await ensure();
   if(rotation?.state())return held('rotation-review-required');
   if(registry.state().pending)return held('selection-review-required');
   if(easyAuth.state().authorized)await easyAuth.setEnabled(false);
   freezing=true;await stopQueue();
   try{await lifecycle?.disable();bundle=null;await lifecycle?.openLocal();easy.phase='off';easy.reason=null;return {kind:'disabled'};}finally{freezing=false;}
  }),
  easySyncState:()=>{
   let authorization={authorized:false,enabled:false};try{authorization=easyAuth?.state()??authorization;}catch{authorization={authorized:false,enabled:false};}
   const active=easy.phase==='active';
   return {phase:easy.phase,reason:active?easyActiveReason():easy.reason,candidates:easy.candidates,target:easy.target,authorization,selected:registry?.state().selected??null,status:host.state().status};
  },
  async settled(){await tail.catch(()=>{});await publisherQueue?.settled();await lifecycle?.settled();},
  async close(){if(closed)return;freezing=true;await stopQueue();await tail.catch(()=>{});try{await lifecycle?.close();}finally{closed=true;stopLayoutIdle();bundle=null;await registry?.close();listeners.clear();}},
 };
 for(const name of ['saveLayout','saveSettings','saveUi']){const save=host[name];host[name]=(...args)=>save(...args).then(r=>{saveError=null;emit();return r;},e=>{saveError=String(e?.message??e);emit();throw e;});}
 // Restore only an existing authenticated selection. A copied data.json or a
 // fresh vault cannot mint a connection or silently initialize an empty receipt.
 if(app.loadLocalStorage(pluginId+':sync-connections-v1')!==null){try{await ensure();}catch(e){error=String(e?.message??e);}}
 return host;
}
