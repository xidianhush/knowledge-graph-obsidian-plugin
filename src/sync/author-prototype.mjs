// A2 action author only. The caller must persist/backup before confirming.
import {cloneBoundedSyncJson} from './causal-prototype.mjs';
import {planSchema3Transactions,validateSchema3Change,inspectSchema3History,projectAcceptedSchema3History,probeSchema3Snapshot} from './layout-prototype.mjs';
import {packSchema3Operation,schema3Changes} from './wire-prototype.mjs';
import {remapAcceptedSchema3Paths} from './reconcile-prototype.mjs';
const ID=/^[a-f0-9]{32}$/;
const clone=x=>structuredClone(x);
const fail=code=>{throw Error('author-'+code);};
const text=x=>JSON.stringify(cloneBoundedSyncJson(x));
const equal=(a,b)=>text(a)===text(b);
const sameLayout=(a,b)=>equal({groups:a.groups,structures:a.structures},{groups:b.groups,structures:b.structures});
const empty=revision=>({schemaVersion:3,revision,groups:{},structures:{}});
function changesFor(snapshot,groups=Object.keys(snapshot.groups)) {
  return [...groups].sort().map(group=>({group,value:Object.hasOwn(snapshot.groups,group)?{
    schemaVersion:3,record:snapshot.groups[group],structures:snapshot.groups[group].note?
      {[snapshot.groups[group].note]:snapshot.structures[snapshot.groups[group].note]}:{},
  }:null}));
}
export function randomSyncOperationId(provider=globalThis.crypto) {
  if(typeof provider?.getRandomValues!=='function')fail('secure-random-unavailable');
  return Array.from(provider.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
}

export function createLayoutActionAuthor({vault,createModel,nextId=randomSyncOperationId}={}) {
  if(typeof vault!=='string'||!ID.test(vault)||typeof createModel!=='function'||typeof nextId!=='function')fail('options');
  const tokens=new WeakMap(),active=new Set(),confirmedLocal=new Map();let pending=null,confirmedImport=null;
  const plan=(records,baseline)=>planSchema3Transactions(records,{vault,baseline,createModel});
  function scan(ctx) {
    if(ctx?.vault!==vault)fail('foreign-context');
    if(ctx.sharedScanComplete!==true)fail('scan-required');
    const baseline=cloneBoundedSyncJson(ctx.localBaseline);
    plan([],baseline); // Validate trusted local state without replacing it.
    const available=plan(ctx.records,empty(baseline.revision));
    if(available.index.issues.length||available.index.quarantined.length||available.index.pending.length)fail('shared-input-unresolved');
    return {baseline,available,byId:new Map(available.index.ready.map(op=>[op.id,op]))};
  }
  function context(ctx) {
    const state=scan(ctx),ids=ctx.appliedIds;
    if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!state.byId.has(id)))fail('applied-receipt');
    const applied=new Set(ids),records=state.available.index.ready.filter(op=>applied.has(op.id));
    if(records.some(op=>op.parents.some(p=>!applied.has(p))))fail('applied-not-closed');
    const materialized=plan(records,empty(state.baseline.revision));
    if(materialized.status!=='candidate'||!sameLayout(materialized.proposal,state.baseline))fail('applied-state-mismatch');
    return {...state,applied,records,materialized};
  }
  function acceptedContext(ctx) {
    // A3 must load these two local facts from one durable acceptance receipt.
    // A shared operation's mere arrival must NEVER add it to appliedIds.
    if(ctx?.vault!==vault)fail('foreign-context');
    if(ctx.sharedScanComplete!==true)fail('scan-required');
    const baseline=cloneBoundedSyncJson(ctx.localBaseline);
    if(Object.keys(baseline).sort().join(',')!=='groups,revision,schemaVersion,structures'||baseline.schemaVersion!==3)fail('accepted-baseline');
    const available=inspectSchema3History(ctx.records,{vault}),byId=new Map(available.index.ready.map(op=>[op.id,op]));
    if(available.index.issues.length||available.index.quarantined.length||available.index.pending.length)fail('shared-input-unresolved');
    const ids=ctx.appliedIds;
    if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!byId.has(id)))fail('applied-receipt');
    const applied=new Set(ids),records=available.index.ready.filter(op=>applied.has(op.id));
    if(records.some(op=>op.parents.some(p=>!applied.has(p))))fail('applied-not-closed');
    const materialized=projectAcceptedSchema3History(records,{vault,revision:baseline.revision});
    if(!equal(materialized.snapshot,baseline))fail('applied-state-mismatch');
    return {baseline,available,byId,applied,records,materialized};
  }
  function reserve(state) {
    for(let i=0;i<8;i++){
      const id=nextId();if(typeof id!=='string'||!ID.test(id))fail('id-source');
      if(!state.byId.has(id))return id;
    }
    fail('id-collision');
  }
  function checkIdle(){if(pending)fail('pending-publication');}
  function result(){return {kind:'publish',operation:clone(pending.operation),proposal:clone(pending.proposal),
    appliedIds:[...pending.appliedIds],sharedStatus:pending.sharedStatus,
    ...(pending.backup?{backup:clone(pending.backup)}:{})};}
  function noop(state,kind='noop') {return {kind,operation:null,proposal:clone(state.baseline),appliedIds:state.records?.map(op=>op.id)||[]};}
  function prepare(ctx,changes,{kind='edit',consume=null,nextKind='undo'}={}) {
    checkIdle();const state=context(ctx);
    if(!Array.isArray(changes))fail('changes');
    if(!changes.length)return noop(state);
    const packed=packSchema3Operation({vault,id:'0'.repeat(32),parents:[],changes}),clean=schema3Changes(packed),noteEqual=new Map();
    const unchanged=clean.every(c=>{
      const previous=state.baseline.groups[c.group];if(c.value===null)return !previous;
      if(!previous||!equal(c.value.record,previous))return false;
      const note=c.value.record.note;if(!note)return true;
      if(!noteEqual.has(note))noteEqual.set(note,equal(c.value.structures[note],state.baseline.structures[note]));
      return noteEqual.get(note);
    });
    if(unchanged)return noop(state);
    const operation={...packed,id:reserve(state),parents:[...state.materialized.index.heads]};
    const local=plan([...state.records,operation],empty(state.baseline.revision));
    if(local.status!=='candidate')fail('invalid-local-operation');
    const global=plan([...state.available.index.ready,operation],state.baseline);
    pending={operation,proposal:local.proposal,appliedIds:local.index.ready.map(op=>op.id),sharedStatus:global.status,kind,consume,nextKind};
    return result();
  }
  function domain(plans,touched) {
    return [...new Set(plans.flatMap(p=>p.decisions.filter(d=>d.groups.some(g=>touched.has(g))).flatMap(d=>d.groups)))].sort();
  }
  function historyBasis(source,state) {
    const ancestors=new Set(),stack=[...source.parents];
    while(stack.length){const id=stack.pop();if(ancestors.has(id))continue;ancestors.add(id);stack.push(...state.byId.get(id).parents);}
    const records=state.available.index.ready.filter(op=>ancestors.has(op.id));
    const before=plan(records,empty(state.baseline.revision)),after=plan([...records,source],empty(state.baseline.revision));
    if(before.status!=='candidate'||after.status!=='candidate')fail('history-context');
    ancestors.add(source.id);return {before,after,ids:ancestors};
  }
  function refreshLocalHistory(state) {
    // Only invoked after confirmed local undo/redo. A remote write after the
    // token's original basis disqualifies rebasing, even if coordinates match.
    for(const token of active){const entry=tokens.get(token),source=state.byId.get(entry.source);
      if(!source||!state.applied.has(source.id)||!equal(source,entry.operation))continue;
      try{
        const {after,ids}=historyBasis(source,state),touched=new Set(source.changes.map(c=>c.group));
        const groups=domain([after,state.available],touched),guard=new Set(groups);
        const current=new Map(state.available.index.frontiers.map(f=>[f.group,f.heads]));
        const applied=new Map(state.materialized.index.frontiers.map(f=>[f.group,f.heads]));
        if(groups.some(g=>!equal(current.get(g)||[],applied.get(g)||[])))continue;
        if(!groups.every(g=>equal(state.baseline.groups[g]||null,after.proposal.groups[g]||null)))continue;
        const notes=new Set(groups.map(g=>state.baseline.groups[g]?.note).filter(Boolean));
        if([...notes].some(n=>!equal(state.baseline.structures[n],after.proposal.structures[n])))continue;
        if(state.records.some(op=>!ids.has(op.id)&&op.changes.some(c=>guard.has(c.group))&&
          (!confirmedLocal.has(op.id)||!equal(confirmedLocal.get(op.id),op))))continue;
        entry.allowedHeads=groups.map(g=>[g,current.get(g)||[]]);
      }catch{/* A context mismatch leaves old guards intact; never grants consent. */}
    }
  }
  function history(ctx,token,kind) {
    checkIdle();const entry=tokens.get(token);if(!entry||entry.kind!==kind)fail('history-token');
    const state=context(ctx),source=state.byId.get(entry.source);
    if(!source||!state.applied.has(source.id))fail('history-not-applied');
    if(!equal(source,entry.operation))fail('history-source-changed');
    const {before,after}=historyBasis(source,state);
    const touched=new Set(source.changes.map(c=>c.group));
    const expected=new Map(after.index.frontiers.map(f=>[f.group,f.heads])),now=new Map(state.available.index.frontiers.map(f=>[f.group,f.heads]));
    for(const [group,heads]of entry.allowedHeads||[])expected.set(group,heads);
    for(const group of domain([after,state.available],touched))if(!equal(expected.get(group)||[],now.get(group)||[]))fail('history-stale');
    return prepare(ctx,changesFor(before.proposal,[...touched]),{kind,consume:token,nextKind:kind==='undo'?'redo':'undo'});
  }
  function prepareJoin(ctx,{choice,receipt=confirmedImport}={}) {
    checkIdle();const state=scan(ctx),backup=clone(state.baseline);
    if(choice!==undefined&&!['shared','import'].includes(choice))fail('join-choice');
    const adopt=()=>({kind:state.available.status==='candidate'?'adopt-shared':'review-required',operation:null,
      proposal:clone(state.available.status==='candidate'?state.available.proposal:backup),backup,
      appliedIds:state.available.status==='candidate'?state.available.index.ready.map(op=>op.id):[],sharedStatus:state.available.status});
    if(!Object.keys(backup.groups).length)return adopt();
    if(choice===undefined&&!receipt){
      if(state.available.status==='candidate'&&sameLayout(state.available.proposal,backup))return adopt();
      return {kind:'review-required',operation:null,proposal:backup,backup:clone(backup),appliedIds:[],sharedStatus:state.available.status,reason:'join-choice-required'};
    }
    if(choice==='shared')return adopt();
    if(receipt){
      const r=cloneBoundedSyncJson(receipt);
      if(r.version!==1||r.vault!==vault||r.operation?.vault!==vault||r.operation.parents?.length!==0)fail('import-receipt');
      const existing=state.byId.get(r.operation.id);
      if(!existing)return {kind:'review-required',operation:null,proposal:backup,backup,reason:'import-record-not-yet-available'};
      if(!equal(existing,r.operation))fail('import-receipt-content');
      const original=plan([existing],empty(backup.revision));
      if(original.status!=='candidate'||(!sameLayout(original.proposal,backup)&&
        !(state.available.status==='candidate'&&sameLayout(state.available.proposal,backup))))fail('import-receipt-snapshot');
      const joined=adopt();
      return {...joined,kind:'already-imported',appliedIds:joined.sharedStatus==='candidate'?joined.appliedIds:[existing.id],importReceipt:clone(r)};
    }
    const operation=packSchema3Operation({vault,id:reserve(state),parents:[],changes:changesFor(backup)});
    const local=plan([operation],empty(backup.revision));if(local.status!=='candidate')fail('invalid-import');
    const global=plan([...state.available.index.ready,operation],backup);
    pending={operation,proposal:local.proposal,appliedIds:[operation.id],sharedStatus:global.status,backup,kind:'import',consume:null,nextKind:null};
    return result();
  }
  function prepareReconcile(ctx,{pathChanges=[]}={}) {
    checkIdle();const state=acceptedContext(ctx),backup=clone(state.baseline);
    const renamed=remapAcceptedSchema3Paths(backup,pathChanges);
    const model=createModel(),reconciled=model.reconcile(clone(renamed));
    const target=cloneBoundedSyncJson({schemaVersion:3,revision:backup.revision,groups:reconciled.groups,structures:reconciled.structures});
    // Existing reconcile keeps one record for every source override, including
    // unverified ones. A structural repair is never an implicit reset/delete.
    if(Object.keys(target.groups).length!==Object.keys(backup.groups).length)fail('reconciliation-group-loss');
    // Reconcile deliberately retains unverified old records. Preserve them in
    // the preview/backup rather than publishing tombstones or a valid subset.
    const review=reason=>({kind:'review-required',operation:null,proposal:clone(backup),backup:clone(backup),
      reconciliationPreview:clone(target),appliedIds:[...state.applied],reason});
    const compatibility=probeSchema3Snapshot(target,createModel);
    if(!compatibility.ok)return review(compatibility.reason);
    plan([],target); // Static, budget, identity AND geometry checks stay enabled.
    if(sameLayout(backup,target))return noop(state);
    const all=[...new Set([...Object.keys(backup.groups),...Object.keys(target.groups)])].sort();
    const changed=all.filter(group=>{
      const before=backup.groups[group],after=target.groups[group];
      return !equal(before||null,after||null)||!!after?.note&&!equal(backup.structures[after.note]||null,target.structures[after.note]);
    });
    const packed=packSchema3Operation({vault,id:'0'.repeat(32),parents:state.materialized.index.heads,changes:changesFor(target,changed)});
    const operation={...packed,id:reserve(state)};
    const local=plan([...state.records,operation],empty(backup.revision));
    if(local.status!=='candidate'||!sameLayout(local.proposal,target))fail('invalid-reconciliation');
    const global=plan([...state.available.index.ready,operation],target);
    pending={operation,proposal:local.proposal,appliedIds:local.index.ready.map(op=>op.id),sharedStatus:global.status,
      backup,kind:'reconcile',consume:null,nextKind:null};
    return result();
  }
  return {
    prepareEdit:(ctx,changes)=>prepare(ctx,changes),
    prepareResetGroup(ctx,group){checkIdle();const state=context(ctx);validateSchema3Change({group,value:null});
      return Object.hasOwn(state.baseline.groups,group)?prepare(ctx,[{group,value:null}],{kind:'reset'}):noop(state);},
    prepareResetAll(ctx){checkIdle();const state=context(ctx);
      if(!Object.keys(state.baseline.groups).length)return noop(state);
      return prepare(ctx,state.materialized.index.frontiers.map(f=>({group:f.group,value:null})),{kind:'reset'});},
    prepareUndo:(ctx,token)=>history(ctx,token,'undo'),prepareRedo:(ctx,token)=>history(ctx,token,'redo'),prepareJoin,prepareReconcile,
    retry(){if(!pending)fail('no-pending');return result();},
    cancel(ctx){if(!pending)fail('no-pending');const state=pending.kind==='reconcile'?acceptedContext(ctx):scan(ctx);if(state.byId.has(pending.operation.id))fail('already-published');pending=null;},
    confirmPublished(ctx){
      if(!pending)fail('no-pending');const state=context(ctx),op=state.byId.get(pending.operation.id);
      if(!op||!state.applied.has(op.id)||!equal(op,pending.operation))fail('not-published-and-applied');
      for(const id of confirmedLocal.keys())if(!state.byId.has(id))confirmedLocal.delete(id);
      confirmedLocal.set(op.id,clone(op));
      if(pending.kind==='reconcile'){for(const token of active)tokens.delete(token);active.clear();}
      if(pending.consume){tokens.delete(pending.consume);active.delete(pending.consume);}
      if(['edit','reset','import'].includes(pending.kind))for(const token of active)if(tokens.get(token)?.kind==='redo'){tokens.delete(token);active.delete(token);}
      if(['undo','redo'].includes(pending.kind))refreshLocalHistory(state);
      let historyToken=null,importReceipt=null;
      if(pending.nextKind){
        while(active.size>=50){const token=active.values().next().value;active.delete(token);tokens.delete(token);}
        historyToken=Object.freeze({});tokens.set(historyToken,{kind:pending.nextKind,source:op.id,operation:clone(op)});active.add(historyToken);
      }
      if(pending.kind==='import'){confirmedImport={version:1,vault,operation:clone(op)};importReceipt=clone(confirmedImport);}
      pending=null;return {historyToken,importReceipt};
    },
    state:()=>({pendingId:pending?.operation.id||null,historyEntries:active.size}),
  };
}
