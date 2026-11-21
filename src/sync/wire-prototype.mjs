// Proposed shared record v2. Experimental v1 records remain readable for tests.
import {cloneBoundedSyncJson,CAUSAL_PROTOTYPE_LIMITS} from './causal-prototype.mjs';
const same=(a,b)=>JSON.stringify(cloneBoundedSyncJson(a))===JSON.stringify(cloneBoundedSyncJson(b));
export function schema3Changes(op) {
  if(op.protocol===1)return op.changes;
  if(op.protocol!==2||op.layoutSchema!==3||!op.structures||Array.isArray(op.structures))throw Error('layout-wire-version');
  const used=new Set(),changes=op.changes.map(c=>{
    if(c.value===null)return c;
    const note=c.value.note,structures={};
    if(note){if(!Object.hasOwn(op.structures,note))throw Error('layout-wire-missing-structure');used.add(note);Object.defineProperty(structures,note,{value:op.structures[note],enumerable:true});}
    return {group:c.group,value:{schemaVersion:3,record:c.value,structures}};
  });
  if(Object.keys(op.structures).some(note=>!used.has(note)))throw Error('layout-wire-unused-structure');
  return changes;
}
export function packSchema3Operation({vault,id,parents,changes}) {
  const data=(value,fields)=>{
    if(!value||Array.isArray(value)||(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)||
      Object.keys(value).length!==fields.length||fields.some(k=>!Object.hasOwn(value,k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,k),'value')))throw Error('layout-wire-value');
  };
  if(!Array.isArray(changes)||changes.length>CAUSAL_PROTOTYPE_LIMITS.changes)throw Error('layout-wire-changes');
  const groups=new Set();
  const structures=new Map();
  const compact=changes.map(c=>{
    data(c,['group','value']);if(typeof c.group!=='string'||!c.group||c.group.length>2048||groups.has(c.group))throw Error('layout-wire-group');groups.add(c.group);
    if(c.value===null)return {group:c.group,value:null};
    data(c.value,['schemaVersion','record','structures']);
    if(c.value?.schemaVersion!==3||!c.value.record||!c.value.structures)throw Error('layout-wire-value');
    const table=c.value.structures;if(Array.isArray(table)||![Object.prototype,null].includes(Object.getPrototypeOf(table)))throw Error('layout-wire-value');
    for(const note of Object.keys(table)){
      const d=Object.getOwnPropertyDescriptor(table,note);if(!Object.hasOwn(d,'value'))throw Error('layout-wire-value');const rows=d.value;
      if(structures.has(note)&&structures.get(note)!==rows&&!same(structures.get(note),rows))throw Error('layout-wire-structure-conflict');
      structures.set(note,rows);
    }
    return {group:c.group,value:c.value.record};
  });
  return cloneBoundedSyncJson({protocol:2,layoutSchema:3,vault,id,parents,changes:compact,structures:Object.fromEntries(structures)},
    {maxBytes:CAUSAL_PROTOTYPE_LIMITS.recordBytes});
}
