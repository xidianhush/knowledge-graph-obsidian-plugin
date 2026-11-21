import {cloneBoundedSyncJson} from './causal-prototype.mjs';
export const SYNC_MISSING=Symbol('missing');
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const equal=(a,b)=>a===SYNC_MISSING||b===SYNC_MISSING?a===b:JSON.stringify(cloneBoundedSyncJson(a))===JSON.stringify(cloneBoundedSyncJson(b));
// Arrays are indivisible fields; absent keys remain distinct from JSON null.
export function mergeSyncSettings(base,wanted,current,path=[],conflicts=[]){
  if(equal(wanted,base))return current;
  if(equal(current,base)||equal(current,wanted))return wanted;
  if(plain(base)&&plain(wanted)&&plain(current)){
    const out=[];for(const key of new Set([...Object.keys(base),...Object.keys(wanted),...Object.keys(current)])){
      const get=value=>Object.hasOwn(value,key)?value[key]:SYNC_MISSING;
      const value=mergeSyncSettings(get(base),get(wanted),get(current),[...path,key],conflicts);if(value!==SYNC_MISSING)out.push([key,value]);
    }return Object.fromEntries(out);
  }
  conflicts.push(path);return current;
}
