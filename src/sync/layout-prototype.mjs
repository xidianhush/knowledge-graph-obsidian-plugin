// A2 candidate planner only. No store, filesystem, renderer or production imports.
import {analyzeSyncCausality, cloneBoundedSyncJson,buildSyncReachability} from './causal-prototype.mjs';
import {schema3Changes} from './wire-prototype.mjs';
export const LAYOUT_PROTOTYPE_LIMITS = Object.freeze({operations:1024, groups:256, points:5000, identities:5000});
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const keys = (v, required, optional=[]) => plain(v) && required.every(k => Object.hasOwn(v,k)) && Object.keys(v).every(k => [...required,...optional].includes(k));
const fail = reason => {throw Error('layout-' + reason);};
const same = (a,b) => {
  if(a===b)return true;
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const ak=Object.keys(a),bk=Object.keys(b);
  return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
};
function keyParts(key, root=false) {
  if (root && key === 'root') return null;
  if (typeof key !== 'string' || key.length > 2048) fail('key');
  let v;try {v=JSON.parse(key);} catch {fail('key');}
  if (!Array.isArray(v) || v.length!==3 || !['folder','note','heading'].includes(v[0]) ||
      typeof v[1]!=='string' || !v[1] || v[1].split('/').some(p=>!p||p==='.'||p==='..') ||
      /[\\:\x00-\x1f]/.test(v[1]) || typeof v[2]!=='string' ||
      (v[0]==='heading' ? !v[2].startsWith('#') : v[2]!=='') || JSON.stringify(v)!==key) fail('key');
  return v;
}
function checkValue(group, value, identities=new WeakMap()) {
  const parent=keyParts(group,true);
  if (value===null) return;
  if (!keys(value,['schemaVersion','record','structures']) || value.schemaVersion!==3) fail('schema');
  const r=value.record;
  if (!keys(r,['shape','points'],['note','structure','repair']) || !Array.isArray(r.shape) ||
      !r.shape.length || r.shape.length>128 || !Array.isArray(r.points) || r.points.length!==r.shape.length || !plain(value.structures)) fail('record');
  const seen=new Set();
  for (let i=0;i<r.shape.length;i++) {
    const s=r.shape[i],p=r.points[i];
    if (!keys(s,['id','r']) || !keys(p,['id','x','y']) || seen.has(s.id) || p.id!==s.id ||
        !Number.isFinite(s.r) || s.r<=0 || s.r>1.002 || !Number.isFinite(p.x) || !Number.isFinite(p.y)) fail('points');
    const child=keyParts(s.id);
    const headings=parent && ['note','heading'].includes(parent[0]);
    if (headings ? child[0]!=='heading'||child[1]!==parent[1] : child[0]==='heading') fail('membership');
    seen.add(s.id);
  }
  if (Object.hasOwn(r,'repair') && (!keys(r.repair,['moved','added']) ||
      !['moved','added'].every(k=>Number.isInteger(r.repair[k])&&r.repair[k]>=0&&r.repair[k]<=128))) fail('repair');
  const headings=parent && ['note','heading'].includes(parent[0]);
  if (!headings) {
    if (Object.hasOwn(r,'note') || Object.hasOwn(r,'structure') || Object.keys(value.structures).length) fail('unexpected-identity');
    return;
  }
  const note=JSON.stringify(['note',parent[1],'']);
  const rows=value.structures[note];
  if (r.note!==note || typeof r.structure!=='string' || !/^[a-f0-9]{1,8}:[a-f0-9]{1,8}:\d+$/.test(r.structure) ||
      Object.keys(value.structures).length!==1 || !Object.hasOwn(value.structures,note) || !Array.isArray(rows) ||
      !rows.length || rows.length>LAYOUT_PROTOTYPE_LIMITS.identities || Number(r.structure.split(':')[2])!==rows.length) fail('identity');
  let cached=identities.get(rows);
  if(cached&&cached.note!==note)fail('identity-path');
  if(!cached){
  const previous=new Map([[note,{level:0}]]),byParent=new Map();
  for (const row of rows) {
    if (!keys(row,['key','title','parent','level','evidence']) || typeof row.title!=='string' || row.title.length>4096 ||
        typeof row.evidence!=='string' || !/^\d+:[a-f0-9]{1,8}:[a-f0-9]{1,8}$/.test(row.evidence) ||
        !Number.isInteger(row.level) || row.level<1 || row.level>6 || previous.has(row.key) ||
        !previous.has(row.parent) || previous.get(row.parent).level>=row.level) fail('identity-row');
    const k=keyParts(row.key);if(k[0]!=='heading'||k[1]!==parent[1]) fail('identity-path');
    previous.set(row.key,row);
    if(!byParent.has(row.parent))byParent.set(row.parent,[]);byParent.get(row.parent).push(row.key);
  }
  cached={note,byParent};identities.set(rows,cached);
  }
  const siblings=cached.byParent.get(group)||[];
  if (siblings.length!==seen.size || siblings.some(k=>!seen.has(k))) fail('identity-membership');
}
export function validateSchema3Change(change) {
  const clean=cloneBoundedSyncJson(change);
  if (!keys(clean,['group','value'])) fail('change');
  checkValue(clean.group,clean.value);return clean;
}

function assemble(values, revision) {
  const groups=new Map(),structures=new Map();let points=0;
  if(values.size>LAYOUT_PROTOTYPE_LIMITS.groups) throw RangeError('layout-group-budget');
  for(const [group,value] of [...values].sort(([a],[b])=>a<b?-1:a>b?1:0)) {
    if(value===null)continue;
    groups.set(group,value.record);points+=value.record.points.length;
    if(points>LAYOUT_PROTOTYPE_LIMITS.points) throw RangeError('layout-point-budget');
    for(const [note,rows] of Object.entries(value.structures)) {
      if(structures.has(note)&&structures.get(note)!==rows&&!same(structures.get(note),rows)) fail('structure-conflict');
      structures.set(note,rows);
    }
  }
  return {schemaVersion:3,revision,groups:Object.fromEntries(groups),structures:Object.fromEntries(structures)};
}
function components(ops, baselineValues=new Map()) {
  const parent=new Map(),notes=new Map();
  function find(k){if(!parent.has(k))parent.set(k,k);if(parent.get(k)!==k)parent.set(k,find(parent.get(k)));return parent.get(k);}
  function join(a,b){a=find(a);b=find(b);if(a!==b)parent.set(b,a);}
  function add(c){find(c.group);const note=c.value?.record.note;if(note){if(notes.has(note))join(c.group,notes.get(note));else notes.set(note,c.group);}}
  for(const [group,value]of baselineValues)add({group,value});
  for(const op of ops){for(const c of schema3Changes(op))add(c);for(const c of op.changes)join(op.changes[0].group,c.group);}
  if(parent.size>LAYOUT_PROTOTYPE_LIMITS.groups)throw RangeError('layout-group-budget');
  const out=new Map();for(const k of parent.keys()){const p=find(k);if(!out.has(p))out.set(p,[]);out.get(p).push(k);}
  return [...out.values()].map(g=>g.sort()).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
}
function incompleteResolutions(index) {
  const reach=buildSyncReachability(index.ready),views=new Map(),bad=new Set(),blocked=new Set();
  for(const op of index.ready) {
    if(op.parents.some(p=>bad.has(p)||blocked.has(p))){blocked.add(op.id);continue;}
    const view=new Map();
    for(const p of op.parents)for(const [group,heads]of views.get(p))view.set(group,[...new Set([...(view.get(group)||[]),...heads])]);
    for(const [group,heads]of view)view.set(group,heads.filter(id=>!heads.some(other=>reach.has(other,id))));
    const conflicts=new Set([...view].filter(([,ids])=>ids.length>1).map(([g])=>g));
    if(conflicts.size){const all=reach.before(op.id),history=index.ready.filter(x=>all.has(x.id)),touched=new Set(op.changes.map(c=>c.group));
      for(const domain of components(history))if(domain.some(g=>conflicts.has(g))&&domain.some(g=>touched.has(g))&&domain.some(g=>!touched.has(g)))bad.add(op.id);
    }
    for(const c of op.changes)view.set(c.group,[op.id]);views.set(op.id,view);
  }
  return bad;
}

// Static history inspection is deliberately separate from a view candidate.
// It proves record validity, dependency closure and transaction frontiers, not
// compatibility with the current graph. Never apply its output to a view.
export function inspectSchema3History(input,{vault}={}) {
  if(!Array.isArray(input)||input.length>LAYOUT_PROTOTYPE_LIMITS.operations)throw RangeError('layout-operation-budget');
  const identities=new WeakMap();
  const validateOperation=op=>{for(const c of schema3Changes(op))checkValue(c.group,c.value,identities);};
  let index=analyzeSyncCausality(input,{vault,validateOperation});
  const bad=incompleteResolutions(index);
  if(bad.size)index=analyzeSyncCausality(input,{vault,validateOperation:op=>{
    validateOperation(op);if(bad.has(op.id))fail('incomplete-resolution');
  }});
  return {index,domains:components(index.ready)};
}

// For checking a trusted local applied ledger against its last accepted state,
// even when that graph no longer exists. This is NOT an auto-apply candidate.
export function projectAcceptedSchema3History(input,{vault,revision=0}={}) {
  if(!Number.isSafeInteger(revision)||revision<0)fail('baseline');
  const {index,domains}=inspectSchema3History(input,{vault});
  if(index.issues.length||index.quarantined.length||index.pending.length||index.conflicts.length)fail('accepted-history-unresolved');
  const byId=new Map(index.ready.map(op=>[op.id,op])),values=new Map();
  for(const frontier of index.frontiers){
    const change=schema3Changes(byId.get(frontier.heads[0])).find(c=>c.group===frontier.group);
    if(change.value!==null)values.set(change.group,change.value);
  }
  return {snapshot:structuredClone(assemble(values,revision)),index,domains};
}

// createModel MUST return a fresh model over isolated graph nodes on every call.
// Existing core apply handles parent-local geometry; reconcile is used as an exact
// identity check, never to publish repaired/migrated data from this prototype.
export function probeSchema3Snapshot(snapshot, createModel) {
  if(!Object.keys(snapshot.groups).length&&!Object.keys(snapshot.structures).length)return {ok:true,restored:0,skipped:0};
  const model=createModel(),known=new Set(model.keys());
  if(Object.keys(snapshot.groups).some(k=>!known.has(k)))return {ok:false,reason:'missing-group'};
  const report=model.apply(structuredClone(snapshot));
  if(report.skipped||report.restored!==Object.keys(snapshot.groups).length)return {ok:false,reason:'geometry-or-structure',...report};
  const reconciled=model.reconcile(structuredClone(snapshot));
  if(!same(reconciled.groups,snapshot.groups)||!same(reconciled.structures,snapshot.structures))return {ok:false,reason:'identity-context'};
  return {ok:true,...report};
}

export function validateSchema3Snapshot(input) {
  const base=cloneBoundedSyncJson(input);
  if(!keys(base,['schemaVersion','revision','groups','structures'])||base.schemaVersion!==3||
      !Number.isSafeInteger(base.revision)||base.revision<0||!plain(base.groups)||!plain(base.structures))fail('baseline');
  const values=new Map();
  const identities=new WeakMap();
  for(const [group,record]of Object.entries(base.groups)){
    const value={schemaVersion:3,record,structures:record.note?{[record.note]:base.structures[record.note]}:{}};
    checkValue(group,value,identities);values.set(group,value);
  }
  if(!same(assemble(values,base.revision),base))fail('baseline-incompatible');
  return base;
}

// First join reads device-local working data, which may retain old outline
// guards after a rebuild. Shared validation and explicit restore stay strict.
// A reduced first-join source is valid only after a distinct explicit choice.
// Replay uses this static proof rather than requiring the old graph to exist.
export function validateCurrentJoinCoverage(raw, snapshot) {
  if(raw?.schemaVersion!==3||!plain(raw.groups)||!Number.isSafeInteger(raw.revision)||raw.revision<0||snapshot.revision!==raw.revision)fail('current-source');
  for(const [key,record]of Object.entries(snapshot.groups)){
    const old=raw.groups[key];
    if(!old||!same(old.shape,record.shape)||!same(old.points,record.points)||old.note!==record.note||old.structure!==record.structure)fail('current-coverage');
  }
}

// Match the renderer: apply compatible records, leaving other groups automatic.
// Capture effective manual positions on isolated nodes, never repair stale groups.
export function projectCurrentJoinLayout(input, createModel) {
  const source=cloneBoundedSyncJson(input);
  if(source?.schemaVersion!==3||!plain(source.groups)||!Number.isSafeInteger(source.revision)||source.revision<0)fail('current-source');
  const entries=Object.entries(source.groups);
  if(entries.length>LAYOUT_PROTOTYPE_LIMITS.groups)fail('current-group-budget');
  const model=createModel();model.apply(structuredClone(source));
  const groups={},structures={};
  for(const [key,old]of entries){
    const captured=model.capture(key);if(!captured)continue;
    if(!same(old.shape,captured.shape)||old.note!==captured.note||old.structure!==captured.structure||!Array.isArray(old.points)||old.points.length!==captured.points.length||old.points.some((p,i)=>p.id!==captured.points[i].id||Math.abs(p.x-captured.points[i].x)>1e-9||Math.abs(p.y-captured.points[i].y)>1e-9))fail('current-capture-changed');
    const record={shape:captured.shape,points:structuredClone(old.points)};
    if(captured.note){record.note=captured.note;record.structure=captured.structure;structures[captured.note]=captured.identity;}
    groups[key]=record;
  }
  const snapshot=validateSchema3Snapshot({schemaVersion:3,revision:source.revision,groups,structures});
  validateCurrentJoinCoverage(source,snapshot);
  if(!probeSchema3Snapshot(snapshot,createModel).ok)fail('current-graph-incompatible');
  return {snapshot,sourceGroups:entries.length,omittedGroups:entries.map(([key])=>key).filter(key=>!Object.hasOwn(groups,key))};
}

export function normalizeJoinLayout(input, createModel) {
  try{return normalizeRestoreLayout(input,createModel);}catch(error){
    if(input?.schemaVersion!==3||error.message!=='layout-identity')throw error;
  }
  const source=cloneBoundedSyncJson(input),entries=Object.entries(source.groups);
  if(entries.length>LAYOUT_PROTOTYPE_LIMITS.groups)fail('group-budget');
  const notes=new Set(entries.map(([,record])=>record?.note).filter(Boolean));
  if(Object.keys(source.structures).some(note=>!notes.has(note)))fail('baseline-incompatible');
  for(const [group,record]of entries){
    const rows=record.note?source.structures[record.note]:undefined;
    const value={schemaVersion:3,record,structures:record.note?{[record.note]:rows}:{}};
    try{checkValue(group,value);}catch(error){
      if(error.message!=='layout-identity')throw error;
      // A stale count cannot conceal malformed evidence or changed siblings.
      // Missing tables require the reconciler's existing whole-outline guard.
      if(rows!==undefined){
        if(!Array.isArray(rows)||!rows.length||typeof record.structure!=='string')throw error;
        checkValue(group,{...value,record:{...record,structure:record.structure.replace(/:\d+$/,':'+rows.length)}});
      }
    }
  }
  const reconciled=createModel().reconcile(structuredClone(source));
  const result=validateSchema3Snapshot({...source,...reconciled});
  if(Object.keys(result.groups).length!==entries.length||entries.some(([key,record])=>{
    const next=result.groups[key];return !next||record.note!==next.note||!same(record.shape,next.shape)||!same(record.points,next.points);
  }))fail('join-points-changed');
  if(!probeSchema3Snapshot(result,createModel).ok)fail('join-graph-incompatible');
  return result;
}

// Restore accepts a format migration only when the original geometry already
// applies to the current graph. Reconciliation may repair or rename groups in
// other flows; an explicit restore preview must keep every saved point.
export function normalizeRestoreLayout(input, createModel) {
  const source=cloneBoundedSyncJson(input);
  if(source?.schemaVersion===3)return validateSchema3Snapshot(source);
  if(![1,2].includes(source?.schemaVersion)||!plain(source.groups)||
     !Number.isSafeInteger(source.revision)||source.revision<0)fail('restore-version');
  const entries=Object.entries(source.groups);
  if(entries.length>LAYOUT_PROTOTYPE_LIMITS.groups)fail('restore-group-budget');
  const model=createModel();
  const known=new Set(model.keys());
  let points=0;
  for(const [key,record] of entries){
    if(!known.has(key)||!plain(record)||!Array.isArray(record.shape)||!Array.isArray(record.points)||
       record.shape.length>128||record.points.length>128)fail('restore-legacy-group');
    points+=record.points.length;
  }
  if(points>LAYOUT_PROTOTYPE_LIMITS.points)fail('restore-point-budget');
  const {restored,skipped}=model.apply(structuredClone(source));
  if(skipped||restored!==entries.length)fail('restore-legacy-geometry');
  const {groups,structures}=createModel().reconcile(structuredClone(source));
  const result=validateSchema3Snapshot({schemaVersion:3,revision:source.revision,groups,structures});
  if(Object.keys(result.groups).length!==entries.length||
     entries.some(([key,record])=>!Object.hasOwn(result.groups,key)||!same(result.groups[key].points,record.points))){
    fail('restore-legacy-points-changed');
  }
  return result;
}
export function planSchema3Transactions(input,{vault,baseline,createModel}={}) {
  if(typeof createModel!=='function')throw Error('layout-model-factory');
  if(!Array.isArray(input)||input.length>LAYOUT_PROTOTYPE_LIMITS.operations)throw RangeError('layout-operation-budget');
  const base=validateSchema3Snapshot(baseline),values=new Map();
  for(const [group,record]of Object.entries(base.groups))values.set(group,{schemaVersion:3,record,structures:record.note?{[record.note]:base.structures[record.note]}:{}});
  if(!probeSchema3Snapshot(base,createModel).ok)fail('baseline-incompatible');
  const {index}=inspectSchema3History(input,{vault});
  const byId=new Map(index.ready.map(op=>[op.id,op])),fronts=new Map(index.frontiers.map(f=>[f.group,f.heads]));
  const domains=components(index.ready,values),decisions=[];
  let selected=new Map(values);
  const eligible=domains.filter(groups=>groups.some(g=>fronts.has(g)));
  const conflicted=groups=>groups.filter(g=>(fronts.get(g)||[]).length>1);
  function update(current,groups){const next=new Map(current);
    for(const group of groups){const head=fronts.get(group)?.[0];if(!head)continue;
      const value=schema3Changes(byId.get(head)).find(c=>c.group===group).value;
      if(value===null)next.delete(group);else next.set(group,value);
    }return next;
  }
  // Validate the combined safe candidate once. On contextual failure fall back
  // to per-domain probes so a bad domain does not suppress independent groups.
  let fast=false;
  try{let combined=new Map(selected);for(const groups of eligible)if(!conflicted(groups).length)combined=update(combined,groups);
    if(eligible.length){fast=probeSchema3Snapshot(assemble(combined,base.revision),createModel).ok;if(fast)selected=combined;}
  }catch(error){if(error instanceof RangeError)throw error;}
  for(const groups of eligible) {
    if(!groups.some(g=>fronts.has(g)))continue;
    const conflicts=groups.filter(g=>(fronts.get(g)||[]).length>1);
    if(conflicts.length){decisions.push({groups,status:'conflict',conflicts});continue;}
    if(fast){decisions.push({groups,status:'candidate'});continue;}
    const next=update(selected,groups);
    try {
      const snapshot=assemble(next,base.revision),result=probeSchema3Snapshot(snapshot,createModel);
      if(!result.ok){decisions.push({groups,status:'incompatible',reason:result.reason});continue;}
      selected=next;decisions.push({groups,status:'candidate'});
    } catch(error){if(error instanceof RangeError)throw error;decisions.push({groups,status:'incompatible',reason:error.message});}
  }
  return {status:index.pending.length||index.issues.length||index.quarantined.length||decisions.some(d=>d.status!=='candidate')?'blocked':'candidate',
    proposal:structuredClone(assemble(selected,base.revision)),decisions,index};
}
