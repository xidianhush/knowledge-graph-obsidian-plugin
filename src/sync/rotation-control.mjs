// Small authenticated control intent outside per-library history/quota.
// The backup remains review-only; this intent binds one explicitly chosen root.
const ID=/^[a-f0-9]{32}$/,HASH=/^[a-f0-9]{64}$/,realm='0'.repeat(32),name='rotation-control.json';
export async function openRotationControl({app,pluginId,device}={}){
 const key=pluginId+':sync-rotation-v1';let raw=app.loadLocalStorage(key),pending=null;
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),fail=()=>{throw Error('rotation-control-invalid');};
 function validate(v){
  const keys=['version','installation','from','target','rootId','backupId','location','backupHash','snapshotHash','rootHash','basisHash','inventoryHash','choice'];
  if(!v||Object.keys(v).sort().join(',')!==keys.sort().join(',')||v.version!==1||v.installation!==device.state().installation||!['from','target','rootId','backupId'].every(k=>ID.test(v[k]))||v.from===v.target||!['backupHash','snapshotHash','rootHash','basisHash','inventoryHash'].every(k=>HASH.test(v[k]))||!['accepted','draft'].includes(v.choice)||typeof v.location!=='string'||v.location.length>240)fail();return structuredClone(v);
 }
 if(raw!==null){if(typeof raw!=='string'||raw.length>17000)fail();pending=validate(JSON.parse(await device.unseal(realm,name,raw,16384)));}
 function check(){device.state();if(app.loadLocalStorage(key)!==raw)fail();}
 async function save(value){check();const next=value?await device.seal(realm,name,JSON.stringify(validate(value))):null;check();app.saveLocalStorage(key,next);if(app.loadLocalStorage(key)!==next)fail();raw=next;pending=value?validate(value):null;}
 return {state(){check();return structuredClone(pending);},async begin(value){check();if(pending&&!same(pending,value))fail();if(!pending)await save(value);},async complete(){await save(null);}};
}
