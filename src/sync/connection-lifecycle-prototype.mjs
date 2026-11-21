// Durable local disable/switch intent. This slot is not plugin data.json and
// grants no layout acceptance. The original device record/key stay unchanged.
import {cloneBoundedSyncJson} from './causal-prototype.mjs';
const clone=x=>structuredClone(x),ID=/^[a-f0-9]{32}$/,plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),fail=reason=>{throw Error('sync-lifecycle-'+reason);};
const fields=(v,names)=>plain(v)&&Object.keys(v).sort().join(',')===[...names].sort().join(',');
export async function createLifecycleDevice({device,app,pluginId,locks=globalThis.navigator?.locks,nextId,checkpoint=async()=>{}}={}){
  if(!device||typeof app?.loadLocalStorage!=='function'||typeof app?.saveLocalStorage!=='function'||typeof locks?.request!=='function'||!/^[a-z0-9_-]+$/.test(pluginId||''))fail('device-options');
  nextId??=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');if(typeof nextId!=='function')fail('device-options');
  const key=pluginId+':sync-v2:lifecycle',installation=device.state().installation;let raw=clone(app.loadLocalStorage(key)),pending=null,leased=false;
  function check(){device.state();if(!equal(app.loadLocalStorage(key),raw))fail('local-transition-changed');}
  function validate(value){if(!fields(value,['version','token','installation','kind','from','to','generation','fromEnabled'])||value.version!==1||!ID.test(value.token)||value.installation!==installation||!ID.test(value.from)||!['disable','switch'].includes(value.kind)||!Number.isSafeInteger(value.generation)||value.generation<0||value.generation>Number.MAX_SAFE_INTEGER-3||typeof value.fromEnabled!=='boolean'||(value.kind==='disable'?value.to!==null:!ID.test(value.to)||value.to===value.from))fail('transition-invalid');return value;}
  if(raw!==null){if(!fields(raw,['from','token','sealed'])||!ID.test(raw.from)||!ID.test(raw.token)||typeof raw.sealed!=='string'||raw.sealed.length>4096)fail('slot-invalid');
    pending=validate(JSON.parse(await device.unseal(raw.from,'lifecycle/'+raw.token+'.json',raw.sealed,2048)));if(pending.from!==raw.from||pending.token!==raw.token)fail('slot-binding');}
  function save(value){app.saveLocalStorage(key,clone(value));if(!equal(app.loadLocalStorage(key),value))fail('local-transition-unconfirmed');raw=clone(value);}
  async function acquireMode(vault,local){check();if(pending)fail('transition-pending');const release=await device[local?'acquireLocal':'acquire'](vault);try{check();if(pending)fail('transition-pending');leased=true;}catch(error){await release();throw error;}
    let released=false;return async()=>{if(released)return;released=true;leased=false;await release();};}
  const guard={...device,
    state(){check();return {...device.state(),transition:clone(pending)};},
    acquire:vault=>acquireMode(vault,false),
    acquireLocal:vault=>acquireMode(vault,true),
    assertConnection(vault){check();if(pending&&(!leased||pending.from!==vault))fail('transition-pending');device.assertConnection(vault);},
    assertLocalConnection(vault){check();if(pending&&(!leased||pending.from!==vault))fail('transition-pending');device.assertLocalConnection(vault);},
    connect(vault){check();if(pending)fail('transition-pending');return device.connect(vault);},
    disable(){check();if(pending)fail('transition-pending');return device.disable();},
    beginTransition(kind,to=null){return locks.request(key+':'+installation,{mode:'exclusive'},async()=>{
      check();if(pending){if(pending.kind===kind&&pending.to===to)return clone(pending);fail('another-transition-pending');}
      const connection=device.state().connection;if(!connection)fail('no-connection');
      if(connection.enabled&&!leased)fail('active-owner-required');
      const token=nextId();const value=validate({version:1,token,installation,kind,from:connection.vault,to,generation:device.state().generation,fromEnabled:connection.enabled});
      const sealed=await device.seal(value.from,'lifecycle/'+token+'.json',JSON.stringify(value));check();save({from:value.from,token,sealed});pending=value;await checkpoint('after-transition-record');return clone(value);
    });},
    completeTransition(token){return locks.request(key+':'+installation,{mode:'exclusive'},async()=>{
      check();if(!pending||pending.token!==token)fail('transition-token');if(leased)fail('active-lease');
      const state=device.state(),connection=state.connection,allowed=[{generation:pending.generation,vault:pending.from,enabled:pending.fromEnabled}];let generation=pending.generation;
      if(pending.fromEnabled)allowed.push({generation:++generation,vault:pending.from,enabled:false});
      if(pending.kind==='switch'){allowed.push({generation:++generation,vault:pending.to,enabled:true});allowed.push({generation:++generation,vault:pending.to,enabled:false});}
      if(!connection||!allowed.some(v=>v.generation===state.generation&&v.vault===connection.vault&&v.enabled===connection.enabled))fail('transition-source');
      // The signed pending slot remains until every base-device step completed.
      // A restart at any step replays this without opening either private vault.
      if(connection.vault===pending.from){await device.disable();await checkpoint('after-base-disable');if(pending.kind==='switch'){await device.connect(pending.to);await checkpoint('after-target-enable');await device.disable();await checkpoint('after-target-disable');}}
      else {await device.disable();await checkpoint('after-target-disable');}
      save(null);pending=null;await checkpoint('after-slot-clear');return guard.state();
    });},
  };
  return guard;
}

export function createSyncLifecycle({device,openBundle,checkpoint=async()=>{}}={}){
  if(!device||typeof openBundle!=='function'||['state','connect','beginTransition','completeTransition'].some(k=>typeof device[k]!=='function'))fail('controller-options');
  let bundle=null,status='new',tail=Promise.resolve(),freezing=false,transitioning=false,recoveryReason=null;
  const state=()=>({status,connection:device.state().connection,transition:device.state().transition,
    ...(status==='recovery-required'&&recoveryReason?{recoveryReason}:{})});
  function enqueue(fn){const work=tail.catch(()=>{}).then(fn);tail=work;return work;}
  async function closeBundle(){const closing=bundle;if(!closing)return;let failure;
    for(const fn of [()=>closing.coordinator?.close(),()=>closing.projection?.close(),()=>closing.session.close(),()=>closing.backend?.close?.()])try{await fn();}catch(error){failure??=error;}
    bundle=null;if(failure)throw failure;
  }
  async function openCurrent(access='sync'){const current=device.state(),local=access==='local-only';
    recoveryReason=null;
    if(current.transition){await device.completeTransition(current.transition.token);status='disabled';return {...state(),recoveredTransition:true};}
    if(!current.connection||current.connection.enabled===local){status='disabled';return state();}
    if(bundle)fail('already-open');
    try{bundle=await openBundle({device,vault:current.connection.vault,access});if(!bundle?.session||!bundle.quota||typeof bundle.open!=='function'||local&&bundle.session.access!=='local-only')fail('bundle-shape');await bundle.open();
      status=(local?'local-':'')+(bundle.session.state().initialized?(await bundle.quota.inspect()).paused?'paused':'ready':'join-required');return state();
    }catch(error){
      try{await closeBundle();}catch{}
      if(error?.code==='SYNC_PRIVATE_ANCHOR_MISSING')recoveryReason='private-anchor-missing';
      if(error?.code==='SYNC_PRIVATE_ANCHOR_MISMATCH')recoveryReason='private-anchor-mismatch';
      status='recovery-required';
      throw error;
    }
  }
  const controller={
    open(){if(status!=='new')fail('already-open');return enqueue(()=>openCurrent());},
    close(){freezing=true;return enqueue(async()=>{try{await closeBundle();}finally{status='closed';freezing=false;}});},
    openLocal(){if(freezing||status!=='disabled'||bundle)fail('local-open-state');freezing=true;return enqueue(async()=>{try{return await openCurrent('local-only');}finally{freezing=false;}});},
    enable(vault){if(freezing||bundle&&!status.startsWith('local-'))fail('close-first');if(!ID.test(vault))fail('vault');freezing=true;
      return enqueue(async()=>{recoveryReason=null;try{await closeBundle();await device.connect(vault);return await openCurrent();}catch(error){status='recovery-required';throw error;}finally{freezing=false;}});},
    runLocal(fn){if(typeof fn!=='function')fail('command');if(freezing||status!=='local-ready')return Promise.resolve({kind:'held',reason:status});
      return enqueue(async()=>{try{const result=await bundle.quota.run(()=>fn(bundle));if(result.kind==='held'||result.status?.paused)status='local-paused';return result;}
        catch(error){if(bundle.session.state().faulted)status='recovery-required';throw error;}});
    },
    readLocal(fn){if(typeof fn!=='function')fail('command');if(freezing||!['local-ready','local-paused'].includes(status))return Promise.resolve({kind:'held',reason:status});
      return enqueue(async()=>{await bundle.coordinator?.settled();await bundle.projection?.settled();await bundle.session.settled();return fn(bundle);});
    },
    run(fn){if(typeof fn!=='function')fail('command');if(freezing||status!=='ready')return Promise.resolve({kind:'held',reason:status});
      return enqueue(async()=>{try{const result=await bundle.quota.run(()=>fn(bundle));if(result.kind==='held'||result.status?.paused)status='paused';return result;}
        catch(error){status='recovery-required';throw error;}});
    },
    join(fn){if(typeof fn!=='function')fail('command');if(freezing||status!=='join-required')return Promise.resolve({kind:'held',reason:status});
      return enqueue(async()=>{try{const result=await bundle.quota.run(()=>fn(bundle));status=result.kind==='held'||result.status?.paused?'paused':bundle.session.state().initialized?'ready':'join-required';return result;}
        catch(error){status='recovery-required';throw error;}});
    },
    disable(){return controller.transition('disable');},
    switchTo(vault){if(!ID.test(vault))fail('vault');if(vault===device.state().connection?.vault)return Promise.resolve({kind:'noop',...state()});return controller.transition('switch',vault);},
    async transition(kind,to=null){
      if(!['disable','switch'].includes(kind))fail('transition-kind');if(freezing&&status!=='exporting')fail('closing');transitioning=true;freezing=true;status='closing';
      let intent;try{intent=await device.beginTransition(kind,to);await checkpoint('after-transition-intent');}
      catch(error){await enqueue(async()=>{try{await closeBundle();}finally{transitioning=false;freezing=false;status='recovery-required';}}).catch(()=>{});throw error;}
      return enqueue(async()=>{
        let failure;try{await closeBundle();}catch(error){failure=error;}
        await checkpoint('after-bundle-close');await device.completeTransition(intent.token);await checkpoint('after-transition-complete');
        transitioning=false;freezing=false;status='disabled';return {kind:failure?'disabled-with-recovery-required':'disabled',warning:failure?String(failure.message).slice(0,160):null,...state()};
      });
    },
    async exportRecovery({destination,id,capture}={}){
      if(freezing||!bundle||!['ready','paused','local-ready','local-paused'].includes(status))fail('export-state');const previous=status;freezing=true;status='exporting';
      return enqueue(async()=>{
        try{await bundle.coordinator?.settled();await bundle.projection?.settled();await bundle.session.settled();
          const session=bundle.session.state();if(session.faulted)fail('reopen-required');
          const configuration=bundle.session.getLocalDocument(),initial=configuration?await bundle.session.getLocalDocumentBackup():null;
          const joinBackup=await bundle.session.getJoinBackup?.()||null;
          const data={vault:device.state().connection.vault,installation:device.state().installation,session,configuration,initial,joinBackup};
          return capture?capture(data):await exportRecoveryParts({destination,id,...data});
        }finally{if(!transitioning){freezing=false;status=bundle?.session.state().faulted?'recovery-required':previous;}}
      });
    },
    async compatibilityData(){if(freezing||!bundle)fail('export-state');return enqueue(async()=>{
      await bundle.coordinator?.settled();const data=await bundle.projection.documentStore.read();return cloneBoundedSyncJson(data.data);
    });},
    state,settled:()=>tail.catch(()=>{}),
  };
  return controller;
}

// Review-only data export, NOT a portable acceptance ledger or automatic restore.
// Destination is explicit, outside the private quota, and must implement complete
// no-replace creation. Completion manifest is written last, verified on retry.
export async function exportRecoveryParts({destination,id,vault,installation,session,configuration,initial,joinBackup,maxBytes=128*1048576}={}){
  if(!destination||['create','read'].some(k=>typeof destination[k]!=='function')||![id,vault,installation].every(v=>ID.test(v))||!Number.isSafeInteger(maxBytes)||maxBytes<1)fail('export-options');
  const pending=session.pending;
  const parts=[['accepted.json',session.accepted?.snapshot||null],['drafts.json',session.localState],['pending.json',pending?{id:pending.id,publicationAttempted:pending.publicationAttempted}:null],['pending-operation.json',pending?.operation||null],['pending-backup.json',pending?.backup||null],['pending-proposal.json',pending?.proposal||null],['configuration.json',configuration?.data||null],['configuration-reference.json',configuration?{version:configuration.version,backup:configuration.backup}:null],['initial-config.json',initial],['join-backup.json',joinBackup]];
  const operationIds=new Set();for(const op of session.accepted?.operations||[]){if(!ID.test(op.id)||operationIds.has(op.id))fail('export-operation');operationIds.add(op.id);parts.push(['operations/'+op.id+'.json',op]);}
  const {syncContentHash}=await import('./persistence-prototype.mjs');const files=[];let total=0;
  function encode(value){return JSON.stringify(cloneBoundedSyncJson(value,{maxBytes:8388608}));}
  for(const [name,value]of parts){const text=encode(value),bytes=new TextEncoder().encode(text).length;total+=bytes;if(total>maxBytes||files.length>=1100)fail('export-budget');files.push({name,bytes,hash:await syncContentHash(text)});}
  const manifest={version:1,id,vault,installation,scope:'review-only-not-acceptance-ledger',files};
  async function install(name,text){await destination.create(id+'/'+name,text);if(await destination.read(id+'/'+name,new TextEncoder().encode(text).length)!==text)fail('export-destination-conflict');}
  for(let i=0;i<parts.length;i++){const text=encode(parts[i][1]);if(await syncContentHash(text)!==files[i].hash)fail('export-source-changed');await install(files[i].name,text);}await install('manifest.json',encode(manifest));
  return {kind:'exported',id,files:files.length,bytes:total,scope:manifest.scope};
}
