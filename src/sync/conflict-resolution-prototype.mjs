import {CAUSAL_PROTOTYPE_LIMITS,cloneBoundedSyncJson} from './causal-prototype.mjs';
import {inspectSchema3History,projectAcceptedSchema3History} from './layout-prototype.mjs';
import {packSchema3Operation} from './wire-prototype.mjs';

const fail=reason=>{throw Error('resolution-'+reason);};
const clone=value=>cloneBoundedSyncJson(value);
// Enumerate complete choices over all conflict domains, with a bounded product.
// Single-domain choice IDs remain the original causal head IDs.
export function reviewSchema3Conflict(records,{vault,revision}={}){
 const {index,domains}=inspectSchema3History(records,{vault});
 if(index.issues.length||index.pending.length||index.quarantined.length)fail('invalid-input');
 const fronts=new Map(index.frontiers.map(row=>[row.group,row.heads]));
 const conflicted=domains.filter(groups=>groups.some(group=>(fronts.get(group)||[]).length>1)).sort((a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:JSON.stringify(a)>JSON.stringify(b)?1:0);
 if(!conflicted.length)fail('one-domain-required');
 if(index.heads.length>CAUSAL_PROTOTYPE_LIMITS.parents)fail('parent-budget');
 const groups=conflicted.flat(),byId=new Map(index.ready.map(op=>[op.id,op]));let choices=[{changes:[],sourceHeads:[]}];
 for(const domain of conflicted){
 const heads=[...new Set(domain.flatMap(group=>fronts.get(group)||[]))].sort(),domainChoices=[];
 if(heads.length<2||choices.length*heads.length>8)fail('choice-budget');
 for(const id of heads){
  const ids=new Set(),stack=[id];
  while(stack.length){const current=stack.pop();if(ids.has(current))continue;ids.add(current);stack.push(...byId.get(current).parents);}
  let snapshot;
  try{snapshot=projectAcceptedSchema3History(index.ready.filter(op=>ids.has(op.id)),{vault,revision}).snapshot;}
  catch{fail('branch-unresolved');}
  const changes=domain.map(group=>({group,value:snapshot.groups[group]?{schemaVersion:3,record:snapshot.groups[group],
   structures:snapshot.groups[group].note?{[snapshot.groups[group].note]:snapshot.structures[snapshot.groups[group].note]}:{}}:null}));
  domainChoices.push({id,changes:clone(changes)});
 }
 choices=choices.flatMap(prior=>domainChoices.map(choice=>({changes:[...prior.changes,...choice.changes],sourceHeads:[...prior.sourceHeads,choice.id]})));
 }
 return {groups:[...groups],heads:[...index.heads],choices:choices.map((choice,i)=>({...choice,id:conflicted.length===1?choice.sourceHeads[0]:(i+1).toString(16).padStart(32,'0')}))};
}

export function buildSchema3ConflictResolution(records,{vault,revision,choice,id}={}){
 if(!/^[a-f0-9]{32}$/.test(id)||records.some(op=>op.id===id))fail('operation-id');
 const review=reviewSchema3Conflict(records,{vault,revision}),selected=review.choices.find(row=>row.id===choice);
 if(!selected)fail('unknown-choice');
 const operation=packSchema3Operation({vault,id,parents:review.heads,changes:selected.changes});
 const proposal=projectAcceptedSchema3History([...records,operation],{vault,revision}).snapshot;
 return {operation,proposal,appliedIds:[...records.map(op=>op.id),id],review};
}
