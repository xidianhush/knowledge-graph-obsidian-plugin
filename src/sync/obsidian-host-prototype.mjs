// A3 host-facing adapters. Not bundled or attached to the production plugin.
// Public App local storage is device/vault-local; plugin data.json is not identity.
import {cloneBoundedSyncJson,CAUSAL_PROTOTYPE_LIMITS as limits} from './causal-prototype.mjs';
const ID=/^[a-f0-9]{32}$/,KEY=/^[a-f0-9]{64}$/,encoder=new TextEncoder();
const fail=reason=>{throw Error('sync-host-'+reason);},clone=x=>structuredClone(x);
const bytes=x=>encoder.encode(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fields=(x,names)=>plain(x)&&Object.keys(x).sort().join(',')===[...names].sort().join(',');
const hex=value=>Array.from(value,n=>n.toString(16).padStart(2,'0')).join('');
function relative(value){
  if(typeof value!=='string'||!value||bytes(value).length>512||/[\\:\u0000-\u001f\u007f]/.test(value)||value.split('/').some(p=>!p||p==='.'||p==='..'))fail('path');
  return value;
}
function json(raw,maxBytes=limits.snapshotBytes){
  if(typeof raw!=='string'||bytes(raw).length>maxBytes)fail('document-budget');
  let value;try{value=JSON.parse(raw);}catch{fail('document-json');}
  if(!plain(value))fail('document-shape');return cloneBoundedSyncJson(value,{maxBytes});
}
function localRecord(value){
  if(!fields(value,['version','installation','secret','generation','connection','anchors'])||value.version!==1||!ID.test(value.installation)||!KEY.test(value.secret)||
    !Number.isSafeInteger(value.generation)||value.generation<0||!plain(value.anchors)||Object.keys(value.anchors).length>32)fail('local-identity-invalid');
  for(const [vault,anchor]of Object.entries(value.anchors))if(!ID.test(vault)||!fields(anchor,['sequence','hash'])||!Number.isSafeInteger(anchor.sequence)||anchor.sequence<1||anchor.sequence>4096||!KEY.test(anchor.hash))fail('local-anchor-invalid');
  if(value.connection!==null&&(!fields(value.connection,['vault','enabled'])||!ID.test(value.connection.vault)||typeof value.connection.enabled!=='boolean'))fail('local-connection-invalid');
  return clone(value);
}
// Web Locks are required, never replaced with a read-then-write localStorage lease.
async function acquire(locks,name){
  let ready,failed,done;const obtained=new Promise((resolve,reject)=>{ready=resolve;failed=reject;}),held=new Promise(resolve=>done=resolve);
  let work;try{work=locks.request(name,{mode:'exclusive',ifAvailable:true},async lock=>{
    if(!lock){failed(Error('sync-host-device-busy'));return;}
    let released=false;ready(async()=>{if(!released){released=true;done();}await work;});await held;
  });}catch(error){failed(error);}
  Promise.resolve(work).catch(failed);return obtained;
}
// Isolated test suites can share a host storage domain after vault recreation.
// Preserve a matching legacy identity so its private recovery ledger stays readable.
export async function openIsolatedSyncTestDevice({app,pluginId,vault,...options}={}){
  if(!/^[a-z0-9_-]+$/.test(pluginId||'')||typeof vault!=='string'||!ID.test(vault)||
    typeof app?.loadLocalStorage!=='function')fail('isolated-device-options');
  const scopedId=pluginId+'-test-'+vault;
  const suffix=':sync-v2:device';
  if(app.loadLocalStorage(scopedId+suffix)!==null){
    return openObsidianSyncDevice({app,pluginId:scopedId,...options});
  }
  const legacy=app.loadLocalStorage(pluginId+suffix);
  return openObsidianSyncDevice({app,pluginId:legacy?.connection?.vault===vault?pluginId:scopedId,...options});
}
export async function openObsidianSyncDevice({app,pluginId,locks=globalThis.navigator?.locks,cryptoProvider=globalThis.crypto,requireExistingIdentity=false}={}){
  if(!/^[a-z0-9_-]+$/.test(pluginId||'')||typeof app?.loadLocalStorage!=='function'||typeof app?.saveLocalStorage!=='function')fail('local-api-unavailable');
  if(typeof locks?.request!=='function'||typeof cryptoProvider?.getRandomValues!=='function'||!cryptoProvider?.subtle)fail('capability-unavailable');
  const key=pluginId+':sync-v2:device',identityLock=key+':identity';let record;
  function load(){return localRecord(app.loadLocalStorage(key));}
  function save(next){app.saveLocalStorage(key,clone(next));if(!same(load(),next))fail('local-write-unconfirmed');}
  await locks.request(identityLock,{mode:'exclusive'},()=>{
    const raw=app.loadLocalStorage(key);
    if(raw===null){
      if(requireExistingIdentity===true){
        const error=Error('sync-host-private-identity-missing');
        error.code='SYNC_PRIVATE_IDENTITY_MISSING';
        throw error;
      }
      record={version:1,installation:hex(cryptoProvider.getRandomValues(new Uint8Array(16))),secret:hex(cryptoProvider.getRandomValues(new Uint8Array(32))),generation:0,connection:null,anchors:{}};save(record);
    }
    else record=localRecord(raw);
  });
  const installation=record.installation,leaseName=key+':session:'+installation;
  function check(){if(!same(load(),record))fail('device-state-changed');}
  const state=()=>{check();return {version:1,installation,generation:record.generation,connection:clone(record.connection)};};
  async function transition(fn){
    return locks.request(identityLock,{mode:'exclusive'},async()=>{
      const release=await acquire(locks,leaseName);
      try{check();const connection=fn(clone(record.connection));if(same(connection,record.connection))return state();
        if(record.generation===Number.MAX_SAFE_INTEGER)fail('generation-budget');
        const next=localRecord({...record,generation:record.generation+1,connection});save(next);record=next;return state();
      }finally{await release();}
    });
  }
  const cryptographicKey=await cryptoProvider.subtle.importKey('raw',new Uint8Array(record.secret.match(/../g).map(v=>parseInt(v,16))),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  function domain(vault,name,text){if(!ID.test(vault))fail('vault');relative(name);return 'KM-SYNC-PRIVATE-1\n'+installation+'\n'+vault+'\n'+name+'\n'+text;}
  const digest=async raw=>hex(new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',bytes(raw))));
  function assertAccess(vault,enabled){check();if(record.connection?.enabled!==enabled||record.connection.vault!==vault)fail('connection-disabled');}
  async function acquireAccess(vault,enabled){const release=await acquire(locks,leaseName);try{assertAccess(vault,enabled);return release;}catch(error){await release();throw error;}}
  return {
    state,
    connect(vault){if(!ID.test(vault))fail('vault');return transition(current=>{
      if(current?.enabled&&current.vault!==vault)fail('disable-before-switch');return {vault,enabled:true};
    });},
    disable(){return transition(current=>current?{...current,enabled:false}:null);},
    acquire:vault=>acquireAccess(vault,true),
    assertConnection:vault=>assertAccess(vault,true),
    acquireLocal:vault=>acquireAccess(vault,false),
    assertLocalConnection:vault=>assertAccess(vault,false),
    anchor(vault){check();return clone(record.anchors[vault]||null);},
    anchoredVaults(){check();return Object.keys(record.anchors);},
    async anchorEvent(vault,name,raw){
      check();const match=/^events\/(\d{12})\.json$/.exec(name);if(!match)return;
      const sequence=Number(match[1]);
      if(sequence<1||sequence>4096)fail('local-anchor-budget');
      if(record.anchors[vault]?.sequence>sequence)return;
      const hash=await digest(raw);check();
      const previous=record.anchors[vault];
      if(previous?.sequence>sequence)return;
      if(previous?.sequence===sequence){if(previous.hash!==hash)fail('local-anchor-changed');return;}
      if(!previous&&Object.keys(record.anchors).length>=32)fail('local-anchor-budget');
      const next=localRecord({...record,anchors:{...record.anchors,[vault]:{sequence,hash}}});save(next);record=next;
    },
    async verifyAnchor(vault,raw){
      check();
      const anchor=record.anchors[vault];
      if(anchor&&(raw===null||await digest(raw)!==anchor.hash)){
        const error=Error('sync-host-private-rollback');
        error.code=raw===null?'SYNC_PRIVATE_ANCHOR_MISSING':'SYNC_PRIVATE_ANCHOR_MISMATCH';
        throw error;
      }
      check();
    },
    async seal(vault,name,text){check();const body=domain(vault,name,text),mac=hex(new Uint8Array(await cryptoProvider.subtle.sign('HMAC',cryptographicKey,bytes(body))));check();return body.slice(0,body.length-text.length)+mac+'\n'+text;},
    async unseal(vault,name,raw,maxBytes){
      check();const header=domain(vault,name,''),mac=raw.slice(header.length,header.length+64),text=raw.slice(header.length+65);
      if(!raw.startsWith(header)||!KEY.test(mac)||raw[header.length+64]!=='\n'||bytes(text).length>maxBytes)fail('private-authentication');
      const ok=await cryptoProvider.subtle.verify('HMAC',cryptographicKey,new Uint8Array(mac.match(/../g).map(v=>parseInt(v,16))),bytes(domain(vault,name,text)));
      check();if(!ok)fail('private-authentication');return text;
    },
  };
}
// Authentication adds provenance, not atomicity/durability. Backing stores still
// must implement the A3 complete-create/no-replace and exclusive lease contract.
export function createDeviceBoundPrivateStore({store,device,vault,access='sync'}={}){
  if(!ID.test(vault)||!store||['read','create','list','acquire'].some(k=>typeof store[k]!=='function')||!device)fail('private-store-options');
  let leased=false;
  if(!['sync','local-only'].includes(access)||access==='local-only'&&['assertLocalConnection','acquireLocal'].some(k=>typeof device[k]!=='function'))fail('private-access');
  function check(){device[access==='sync'?'assertConnection':'assertLocalConnection'](vault);if(!leased)fail('private-lease-required');}
  return {
    // An opt-in backend guarantees that a blob cannot change while this
    // lease is held. Recheck the live device and connection on cache hits.
    ...(store.immutableBlobsUnderLease===true?{checkReplayCacheAccess:check}:{}),
    async acquire(installation){
      if(leased||installation!==device.state().installation)fail('private-owner');
      const deviceRelease=await device[access==='sync'?'acquire':'acquireLocal'](vault);let storeRelease;
      try{storeRelease=await store.acquire(installation);const anchor=device.anchor(vault);
        if(anchor){const name=`events/${String(anchor.sequence).padStart(12,'0')}.json`,raw=await store.read(name,262144+1024);await device.verifyAnchor(vault,raw);await device.unseal(vault,name,raw,262144);}
        leased=true;
      }
      catch(error){try{await storeRelease?.();}finally{await deviceRelease();}throw error;}
      let released=false;return async()=>{if(released)return;released=true;leased=false;try{await storeRelease();}finally{await deviceRelease();}};
    },
    async read(name,maxBytes){check();relative(name);if(!Number.isSafeInteger(maxBytes)||maxBytes<0||maxBytes>limits.snapshotBytes)fail('private-budget');
      const raw=await store.read(name,maxBytes+1024);check();if(raw===null)return null;
      const text=await device.unseal(vault,name,raw,maxBytes);await device.anchorEvent(vault,name,raw);return text;
    },
    async create(name,text){check();relative(name);if(typeof text!=='string'||bytes(text).length>limits.snapshotBytes)fail('private-budget');
      const raw=await device.seal(vault,name,text);check();const result=await store.create(name,raw);check();
      if(/^events\//.test(name)){const confirmed=await store.read(name,bytes(raw).length);if(confirmed!==raw)fail('private-create-conflict');await device.anchorEvent(vault,name,raw);}return result;
    },
    async list(prefix){check();relative(prefix);const rows=await store.list(prefix);check();if(!Array.isArray(rows)||rows.length>4096)fail('private-list-budget');
      for(const name of rows){relative(name);if(!name.startsWith(prefix+'/'))fail('private-list-path');}return rows;
    },
  };
}
// Cooperative conditional writes through public DataAdapter.process. This is
// NOT a CAS against Nutstore/OS writers. Those must be excluded explicitly;
// unknown or synchronised .obsidian configurations remain read-only here.
export function createObsidianSettingsDocument({plugin,configurationIsLocal=false}={}){
  const app=plugin?.app,adapter=app?.vault?.adapter,id=plugin?.manifest?.id;
  if(!/^[a-z0-9_-]+$/.test(id||'')||!adapter||['read','stat','process'].some(k=>typeof adapter[k]!=='function'))fail('document-api-unavailable');
  const path=relative(app.vault.configDir)+'/plugins/'+id+'/data.json',tokens=new WeakSet();let epoch=0,closed=false,tail=Promise.resolve();
  function live(){if(closed)fail('document-closed');}
  async function rawRead(){live();const stat=await adapter.stat(path);if(!stat||stat.type!=='file')fail('document-missing');
    if(!Number.isSafeInteger(stat.size)||stat.size<0||stat.size>limits.snapshotBytes)fail('document-budget');
    const raw=await adapter.read(path);live();json(raw);return raw;
  }
  return {
    path,
    capabilities:Object.freeze({conditionalScope:'adapter-process',externalWritersExcluded:configurationIsLocal===true}),
    // Host must call immediately on notification, before queueing any reload.
    notifyExternalChange(){live();epoch++;},
    async read(){const before=epoch,raw=await rawRead();if(epoch!==before)fail('document-changed');const version=Object.freeze({raw,epoch});tokens.add(version);return {version,data:json(raw)};},
    compareAndSet(version,data){
      live();if(!tokens.has(version))fail('document-version');
      const target=JSON.stringify(cloneBoundedSyncJson(data,{maxBytes:limits.snapshotBytes}));json(target);
      const work=tail.catch(()=>{}).then(async()=>{
        live();if(configurationIsLocal!==true)return {ok:false,retryable:false,reason:'external-writer-not-excluded'};
        if(version.epoch!==epoch)return {ok:false,reason:'external-change'};
        let matched=false;
        await adapter.process(path,raw=>{
          live();json(raw);if(epoch!==version.epoch||raw!==version.raw)return raw;
          matched=true;return target;
        });
        live();if(!matched||epoch!==version.epoch)return {ok:false,reason:'document-changed'};
        const confirmed=await rawRead();if(epoch!==version.epoch||confirmed!==target)return {ok:false,reason:'document-changed'};
        return {ok:true};
      });tail=work;return work;
    },
    async close(){closed=true;await tail.catch(()=>{});},
  };
}
