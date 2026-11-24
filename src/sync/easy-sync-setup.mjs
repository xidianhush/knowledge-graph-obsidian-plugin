import {cloneBoundedSyncJson} from './causal-prototype.mjs';

// Device-bound authorization for the one-switch easy setup. The record lives in
// local sealed storage (never the syncable data.json) and only grants permission
// to run the automatic preparation/connection orchestration. It is NOT an
// acceptance receipt: discovery, selection and join still go through the existing
// registry/session gates. Progress is not duplicated here — the registry selection,
// the session join receipt and the idempotent bootstrap record are each durable on
// their own, so every orchestration phase is re-entrant after a restart.
const realm='0'.repeat(32),name='easy-sync.json',MAX=4096;
const canonical=x=>JSON.stringify(cloneBoundedSyncJson(x,{maxBytes:MAX}));
const fail=reason=>{throw Error('easy-sync-'+reason);};
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
const fields=(x,names)=>plain(x)&&Object.keys(x).sort().join(',')===[...names].sort().join(',');
function validate(value,installation){
 if(!fields(value,['version','installation','enabled'])||value.version!==1||value.installation!==installation||typeof value.enabled!=='boolean')fail('metadata');
 return cloneBoundedSyncJson(value);
}
export function easySyncKey(pluginId){return pluginId+':easy-sync-v1';}
// UI phases. `active` carries a sub-reason; `review-required`/`paused` carry a
// technical reason code that the settings page translates into one next action.
export const EASY_SYNC_PHASES=Object.freeze(['idle','off','preparing','awaiting-transfer','selecting','joining','active','review-required','paused']);
export async function createEasySyncAuthorization({app,pluginId,device,checkpoint=async()=>{}}={}){
 if(!/^[a-z0-9_-]+$/.test(pluginId||'')||!app||typeof app.loadLocalStorage!=='function'||typeof app.saveLocalStorage!=='function'||typeof device?.seal!=='function'||typeof device?.unseal!=='function')fail('options');
 const key=easySyncKey(pluginId),installation=device.state().installation;
 let raw=app.loadLocalStorage(key),record=null;
 if(raw!==null){
  if(typeof raw!=='string'||raw.length>MAX+1024)fail('metadata');
  record=validate(JSON.parse(await device.unseal(realm,name,raw,MAX)),installation);
 }
 function check(){device.state();if(app.loadLocalStorage(key)!==raw)fail('metadata-changed');}
 async function save(next){check();next=validate(next,installation);const signed=await device.seal(realm,name,canonical(next));check();app.saveLocalStorage(key,signed);if(app.loadLocalStorage(key)!==signed)fail('write-unconfirmed');raw=signed;record=next;}
 return {
  state(){check();return record?{authorized:true,enabled:record.enabled}:{authorized:false,enabled:false};},
  // Only a direct user toggle calls this. It reliably persists the authorization
  // (write-then-read-back) before any shared preparation begins.
  async authorize(){await save({version:1,installation,enabled:true});await checkpoint('easy:after-authorization');return {kind:'authorized'};},
  async setEnabled(enabled){if(!record)fail('not-authorized');if(typeof enabled!=='boolean')fail('enabled');await save({...record,enabled});await checkpoint('easy:after-enabled');return {kind:'enabled-set',enabled};},
 };
}