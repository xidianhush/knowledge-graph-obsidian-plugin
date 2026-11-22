// Device-local historical input only. Shared operations keep their strict validator.
import {cloneBoundedSyncJson} from './causal-prototype.mjs';
import {validateSchema3Snapshot,probeSchema3Snapshot} from './layout-prototype.mjs';
const equal=(a,b)=>JSON.stringify(cloneBoundedSyncJson(a))===JSON.stringify(cloneBoundedSyncJson(b));
export function readHistoricalLayout(data){
 const raw=cloneBoundedSyncJson(data,{maxBytes:8388608});
 const layout=raw?.layoutUpgradeOriginal?.layoutOverrides??raw?.layoutOverrides;
 if(!layout||![1,2,3].includes(layout.schemaVersion)||!Number.isSafeInteger(layout.revision)||layout.revision<0||!layout.groups||typeof layout.groups!=='object'||Array.isArray(layout.groups)||Object.keys(layout.groups).length>1024)throw Error('historical-layout-source');
 return structuredClone(layout);
}
export function reconcileLocalLayout(layout,createModel){
 readHistoricalLayout({layoutOverrides:layout});
 const safe={},retained={};
 for(const [key,r]of Object.entries(layout.groups)){
  const usable=r&&typeof r==='object'&&Array.isArray(r.shape)&&Array.isArray(r.points)&&r.shape.length<=128&&r.points.length<=128&&r.shape.every(p=>p&&typeof p.id==='string'&&Number.isFinite(p.r)&&p.r>0)&&r.points.every(p=>p&&typeof p.id==='string'&&Number.isFinite(p.x)&&Number.isFinite(p.y));
  (usable?safe:retained)[key]=structuredClone(r);
 }
 const result=createModel().reconcile({...structuredClone(layout),groups:safe});
 Object.assign(result.groups,retained);
 return {schemaVersion:3,revision:layout.revision,groups:result.groups,structures:result.structures};
}
function single(group,record,structures,revision){return {schemaVersion:3,revision,groups:{[group]:record},structures:record.note?{[record.note]:structures[record.note]}:{}};}
export function planHistoricalLayout({sourceLayout,currentLayout,createModel}){
 const reconciled=reconcileLocalLayout(sourceLayout,createModel),known=new Set(createModel().keys()),rows=[];
 const displayed=createModel();displayed.apply(structuredClone(currentLayout));
 for(const [group,original]of Object.entries(sourceLayout.groups)){
  let row={group,status:'unavailable',reason:'identity-or-geometry',source:null,current:null,target:null,maxDisplacement:null,moved:0};
  if(known.has(group)){
   const captured=displayed.capture(group,true);if(captured)try{const {identity,...current}=captured,s=single(group,current,current.note?{[current.note]:identity}:{},currentLayout.revision);validateSchema3Snapshot(s);row.current=s;}catch{/* Retained historical data need not be a current snapshot. */}
   const record=reconciled.groups[group];
   if(record)try{
    const target=validateSchema3Snapshot(single(group,record,reconciled.structures,sourceLayout.revision));
    if(probeSchema3Snapshot(target,createModel).ok){
     const oldPoints=new Map((original.points||[]).map(p=>[p.id,p])),displacements=record.points.map(p=>{const old=oldPoints.get(p.id);return old?Math.hypot(p.x-old.x,p.y-old.y):null;});
     const max=Math.max(0,...displacements.filter(d=>d!==null));
     row={...row,status:displacements.every(d=>d!==null&&d<=1e-9)&&oldPoints.size===record.points.length?'exact':'adjusted',reason:null,target,maxDisplacement:max,moved:displacements.filter(d=>d===null||d>1e-9).length};
     // Old radii and centers are for comparison, not a validated restore proposal.
     if(Array.isArray(original.points)&&Array.isArray(original.shape)&&original.points.length<=128&&original.shape.length<=128&&original.points.every(p=>p&&typeof p.id==='string'&&Number.isFinite(p.x)&&Number.isFinite(p.y))&&original.shape.every(p=>p&&typeof p.id==='string'&&Number.isFinite(p.r)&&p.r>0)){
      const labels=sourceLayout.structures?.[original.note];
      row.source={schemaVersion:3,revision:sourceLayout.revision,groups:{[group]:structuredClone(original)},structures:Array.isArray(labels)?{[original.note]:labels.filter(p=>p&&typeof p.key==='string'&&typeof p.title==='string')}:{}};
     }
    }
   }catch{/* Unknown, malformed, or unsafe groups stay archived. */}
  }else row.reason='missing-group';
  rows.push(row);
 }
 return {rows,sourceGroups:rows.length};
}
export function mergeHistoricalGroups(base,rows,selection){
 if(!Array.isArray(selection)||!selection.length||new Set(selection).size!==selection.length)throw Error('historical-layout-selection');
 const next={schemaVersion:3,revision:base?.revision??0,groups:structuredClone(base?.groups??{}),structures:structuredClone(base?.structures??{})};
 for(const key of selection){const row=rows.find(r=>r.group===key);if(!row?.target||row.status==='unavailable')throw Error('historical-layout-selection');next.groups[key]=structuredClone(row.target.groups[key]);Object.assign(next.structures,structuredClone(row.target.structures));}
 next.revision=(base?.revision??0)+1;return next;
}
export function localLayoutChanged(a,b){return a?.schemaVersion!==b.schemaVersion||!equal(a?.groups,b.groups)||!equal(a?.structures??{},b.structures);}
export function validateUnjoinedLayoutEdit(previous,next,createModel){
 readHistoricalLayout({layoutOverrides:next});if(next.schemaVersion!==3)throw Error('historical-edit-version');
 for(const [group,record]of Object.entries(next.groups)){
  const old=previous?.groups?.[group];
  if(old&&equal(old,record)&&(!record.note||equal(previous.structures?.[record.note]??null,next.structures?.[record.note]??null)))continue;
  const candidate=validateSchema3Snapshot(single(group,record,next.structures||{},next.revision));
  if(!probeSchema3Snapshot(candidate,createModel).ok)throw Error('unified-graph-incompatible');
 }
 return next;
}
