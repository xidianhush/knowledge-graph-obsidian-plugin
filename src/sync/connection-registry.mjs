import {openObsidianSyncDevice} from './obsidian-host-prototype.mjs';
import {randomSyncOperationId} from './author-prototype.mjs';
import {cloneBoundedSyncJson} from './causal-prototype.mjs';
import {SYNC_CONNECTION_LIMIT} from './connection-catalog.mjs';
const ID=/^[a-f0-9]{32}$/,HASH=/^[a-f0-9]{64}$/,realm='0'.repeat(32),name='connection-registry.json',MAX=262144;
const clone=x=>structuredClone(x),canonical=x=>JSON.stringify(cloneBoundedSyncJson(x,{maxBytes:MAX})),same=(a,b)=>canonical(a)===canonical(b);
const fail=reason=>{throw Error('connections-'+reason);},held=reason=>({kind:'held',reason});
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x),fields=(x,names)=>plain(x)&&Object.keys(x).sort().join(',')===[...names].sort().join(',');
const selection=s=>fields(s,['vault','transport','origin'])&&ID.test(s.vault)&&['attempts-v1','v2'].includes(s.transport)&&['new','join'].includes(s.origin)&&(s.origin!=='new'||s.transport==='attempts-v1');
function validate(value,installation){
 if(!fields(value,['version','installation','bindings','selected','pending'])||value.version!==1||value.installation!==installation||!Array.isArray(value.bindings)||value.bindings.length>SYNC_CONNECTION_LIMIT||
  value.bindings.some(b=>!fields(b,['vault','transport'])||!ID.test(b.vault)||!['attempts-v1','v2'].includes(b.transport))||new Set(value.bindings.map(b=>b.vault)).size!==value.bindings.length)fail('metadata');
 if(value.selected!==null&&(!selection(value.selected)||!value.bindings.some(b=>b.vault===value.selected.vault&&b.transport===value.selected.transport)))fail('metadata-selected');
 const p=value.pending;if(p!==null&&(!fields(p,['selection','fingerprint','from'])||!selection(p.selection)||!HASH.test(p.fingerprint)||!fields(p.from,['generation','connection'])||!Number.isSafeInteger(p.from.generation)||p.from.generation<0||
  p.from.connection!==null&&(!fields(p.from.connection,['vault','enabled'])||!ID.test(p.from.connection.vault)||typeof p.from.connection.enabled!=='boolean')))fail('metadata-pending');
 return clone(value);
}

// Local signed connection metadata is separate from syncable plugin data.json
// and from per-vault session journals. Selection never establishes acceptance.
export async function openSyncConnections({app,pluginId,catalog,locks=globalThis.navigator?.locks,nextId=randomSyncOperationId,checkpoint=async()=>{}}={}){
 if(!/^[a-z0-9_-]+$/.test(pluginId||'')||!app||typeof app.loadLocalStorage!=='function'||typeof app.saveLocalStorage!=='function'||typeof catalog?.scan!=='function'||typeof locks?.request!=='function'||typeof nextId!=='function')fail('options');
 const key=pluginId+':sync-connections-v1';let raw=app.loadLocalStorage(key);
 if(raw!==null&&(typeof raw!=='string'||raw.length>MAX+1024))fail('metadata');
 const device=await openObsidianSyncDevice({app,pluginId,locks,requireExistingIdentity:raw!==null});
 const installation=device.state().installation;let closed=false,closing=false,tail=Promise.resolve();
 const releases=[];
 async function lease(name,mode){
  let unlock,work;
  await new Promise((resolve,reject)=>{const waiting=new Promise(r=>unlock=r);
   work=locks.request(name,{mode,ifAvailable:true},async lock=>{if(!lock){reject(Error('connections-registry-busy'));return;}resolve();await waiting;});Promise.resolve(work).catch(reject);
  });
  releases.push(async()=>{unlock();await work;});
 }
 const release=async()=>{for(const done of [...releases].reverse())await done();};
 try{
  // New registries may coexist across local installations. The shared legacy
  // guard still excludes old clients holding/requesting the original global
  // exclusive lock, including a second window of this same vault.
  await lease(key+':lock','shared');
  await lease(key+':installation:'+installation+':lock','exclusive');
 }catch(error){await release();throw error;}
 let local;const tokens=new WeakMap();
 function check(){if(closed)fail('closed');device.state();if(app.loadLocalStorage(key)!==raw)fail('metadata-changed');}
 function base(){const d=device.state();return {generation:d.generation,connection:d.connection};}
 function stable(){const c=device.state().connection;if(!local.pending&&(local.selected?c?.vault!==local.selected.vault:c!==null))fail('binding-missing');}
 async function save(next){check();next=validate(next,installation);const signed=await device.seal(realm,name,canonical(next));check();app.saveLocalStorage(key,signed);if(app.loadLocalStorage(key)!==signed)fail('write-unconfirmed');raw=signed;local=next;}
 function queue(fn){if(closing||closed)fail('closed');const result=tail.catch(()=>{}).then(()=>{check();return fn();});tail=result;return result;}
 function bindingIssue(s){
  const existing=local.bindings.find(b=>b.vault===s.vault);if(existing&&existing.transport!==s.transport)return 'transport-binding-mismatch';
  if(!existing&&device.anchor(s.vault))return 'anchor-without-transport-binding';
  const occupied=new Set([...local.bindings.map(b=>b.vault),...device.anchoredVaults()]);
  if(!existing&&occupied.size>=SYNC_CONNECTION_LIMIT)return 'binding-budget';return null;
 }
 function targetIssue(s,scan){
  const issue=bindingIssue(s);if(issue)return issue;
  if(s.origin==='new')return scan.namespaces.some(n=>n.vault===s.vault)?'new-namespace-occupied':scan.namespaces.length>=SYNC_CONNECTION_LIMIT?'namespace-budget':null;
  return scan.candidates.some(n=>n.vault===s.vault&&n.transport===s.transport)?null:'selected-history-unavailable';
 }
 async function recover(){
  if(!local.pending){stable();return {kind:'ready'};}
  const p=local.pending,scan=await catalog.scan({target:p.selection});if(scan.kind!=='catalog')return scan;
  const issue=targetIssue(p.selection,scan);if(issue)return held(issue);
  if(scan.fingerprint!==p.fingerprint)return held('selection-input-changed');
  const desired={vault:p.selection.vault,enabled:true},expected=p.from.generation+(same(p.from.connection,desired)?0:1),now=base();
  if(same(now,p.from))await device.connect(p.selection.vault);
  else if(now.generation!==expected||!same(now.connection,desired))return held('selection-device-changed');
  await checkpoint('after-selection-connect');
  const checked=await catalog.scan({target:p.selection});if(checked.kind!=='catalog')return checked;
  const changed=targetIssue(p.selection,checked);if(changed)return held(changed);
  if(checked.fingerprint!==p.fingerprint)return held('selection-input-changed');
  const current=base();if(current.generation!==expected||!same(current.connection,desired))return held('selection-device-changed');
  const existing=local.bindings.some(b=>b.vault===p.selection.vault);
  await save({...local,selected:p.selection,pending:null,bindings:existing?local.bindings:[...local.bindings,{vault:p.selection.vault,transport:p.selection.transport}]});
  await checkpoint('after-selection-commit');return {kind:'selected',selection:clone(local.selected)};
 }
 try{
  local=raw===null?{version:1,installation,bindings:[],selected:null,pending:null}:validate(JSON.parse(await device.unseal(realm,name,raw,MAX)),installation);
  stable();await recover();
 }catch(error){await release();throw error;}
 return {device,
  state(){check();stable();return clone({...local,connection:device.state().connection});},
  preview({action,vault,transport}={}){return queue(async()=>{
   if(!['new','join','resume'].includes(action))return held('selection-action');
   if(local.pending&&action!=='resume')return held('selection-pending');
   if(!local.pending&&action==='resume')return held('selection-not-pending');
   const requested=action==='resume'?local.pending.selection:action==='join'?{vault,transport}:vault?{vault,transport:'attempts-v1'}:null;
   const scan=await catalog.scan(requested?{target:requested}:{});if(scan.kind!=='catalog')return scan;
   let chosen;
   if(action==='resume')chosen=local.pending.selection;
   else if(action==='new'){
    const known=new Set([...scan.namespaces.map(n=>n.vault),...local.bindings.map(n=>n.vault),...device.anchoredVaults()]);
    for(let i=0;i<8;i++){const candidate=vault??nextId();if(!ID.test(candidate))fail('id-source');if(!known.has(candidate)){chosen={vault:candidate,transport:'attempts-v1',origin:'new'};break;}if(vault)break;}
    if(!chosen)return held('id-collision');
   }else{
    if(!ID.test(vault||'')||!['v2','attempts-v1'].includes(transport))return held('selection-target');chosen={vault,transport,origin:'join'};
   }
   const issue=targetIssue(chosen,scan);if(issue)return held(issue);
   const from=base();if(action!=='resume'&&from.connection?.enabled&&from.connection.vault!==chosen.vault)return held('disable-before-switch');
   // Use the same target observation for preview, confirmation and cold recovery.
   const targeted=await catalog.scan({target:chosen});if(targeted.kind!=='catalog')return targeted;
   const targetCheck=targetIssue(chosen,targeted);if(targetCheck)return held(targetCheck);
   const token=Object.freeze({});tokens.set(token,{selection:clone(chosen),fingerprint:targeted.fingerprint,from,resuming:action==='resume'});
   return {kind:'selection-preview',token,selection:clone(chosen),access:chosen.transport==='v2'?'read-only':'read-write'};
  });},
  discard:token=>tokens.delete(token),
  confirm(token){return queue(async()=>{
   const review=tokens.get(token);tokens.delete(token);if(!review)return held('selection-review-required');
   const scan=await catalog.scan({target:review.selection});if(scan.kind!=='catalog')return scan;
   if(scan.fingerprint!==review.fingerprint||!same(base(),review.from))return held('selection-input-changed');
   const issue=targetIssue(review.selection,scan);if(issue)return held(issue);
   if(review.resuming){if(!local.pending||!same(local.pending.selection,review.selection))return held('selection-input-changed');await save({...local,pending:{...local.pending,fingerprint:review.fingerprint}});}
   else{if(local.pending)return held('selection-pending');await save({...local,pending:{selection:review.selection,fingerprint:review.fingerprint,from:review.from}});}
   await checkpoint('after-selection-intent');return recover();
  });},
  resume:()=>queue(recover),
  assertSelected({write=false}={}){check();stable();if(local.pending||!local.selected)fail('selection-required');device.assertConnection(local.selected.vault);if(write&&local.selected.transport==='v2')fail('read-only');return clone(local.selected);},
  async close(){closing=true;await tail.catch(()=>{});closed=true;await release();},
 };
}
