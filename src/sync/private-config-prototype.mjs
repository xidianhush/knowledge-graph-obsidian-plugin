// A3 effective configuration over the SAME authenticated private session log.
// The external data.json is input only; this module has no host write API.
import {cloneBoundedSyncJson,CAUSAL_PROTOTYPE_LIMITS as limits} from './causal-prototype.mjs';
import {syncContentHash} from './persistence-prototype.mjs';
import {mergeSyncSettings} from './settings-merge-prototype.mjs';
const clone=x=>structuredClone(x),plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),HASH=/^[a-f0-9]{64}$/;
const fail=reason=>{throw Error('private-config-'+reason);};
const bounded=x=>cloneBoundedSyncJson(x,{maxBytes:limits.snapshotBytes}),text=x=>JSON.stringify(bounded(x)),same=(a,b)=>text(a)===text(b);
const fields=(value,names)=>plain(value)&&Object.keys(value).sort().join(',')===[...names].sort().join(',');
export function createPrivateConfigProjection({session,validateSettings,getExternalEpoch,checkpoint=async()=>{}}={}){
  if(!session||['getLocalDocument','compareAndSetLocalDocument','getLocalDocumentBackup','readLocalDocumentVersion','listLocalDocumentVersions','state'].some(k=>typeof session[k]!=='function')||typeof validateSettings!=='function'||typeof getExternalEpoch!=='function')fail('options');
  let tail=Promise.resolve(),closed=false,closing=false,seen=null;
  function live(){if(closed||closing)fail('closed');}
  function queue(fn){live();const work=tail.catch(()=>{}).then(()=>{if(closed)fail('closed');return fn();});tail=work;return work;}
  function authority(){const value=session.state();if(value.closed||value.faulted||!value.accepted?.fingerprint)fail('acceptance-required');return value.accepted;}
  function normalize(value){value=bounded(value);if(!plain(value))fail('document-shape');if(Object.hasOwn(value,'settingsVersion')&&value.settingsVersion!==1)fail('settings-version');const result=bounded(validateSettings(clone(value)));
    if(!plain(result.settings)||!plain(result.pipeline))fail('settings-shape');delete result.layoutOverrides;return result;
  }
  function owned(value){const result=normalize({settings:value.settings??{},pipeline:value.pipeline??{},...(Object.hasOwn(value,'settingsVersion')?{settingsVersion:value.settingsVersion}:{})});return {settings:result.settings,pipeline:result.pipeline};}
  function load(value){
    if(!fields(value,['version','effective','externalBase','external'])||value.version!==1||!plain(value.effective)||Object.hasOwn(value.effective,'layoutOverrides')||!fields(value.externalBase,['settings','pipeline']))fail('stored-document');
    if(!same(normalize(value.effective),value.effective)||!same(owned(value.externalBase),value.externalBase))fail('stored-settings');
    const ext=value.external;
    if(ext!==null&&(!fields(ext,['id','source','owned','issue','reviewed'])||!HASH.test(ext.id)||!plain(ext.source)||typeof ext.reviewed!=='boolean'||
      (ext.issue!==null?typeof ext.issue!=='string'||ext.issue.length>160||ext.owned!==null:!fields(ext.owned,['settings','pipeline']))))fail('stored-external');
    if(ext?.owned&&!same(owned(ext.owned),ext.owned))fail('stored-external-settings');return bounded(value);
  }
  function current(){authority();const found=session.getLocalDocument();if(!found)fail('initialization-required');return {version:found.version,data:load(found.data)};}
  function materialize(data,accepted=authority()){return {...clone(data.effective),layoutOverrides:clone(accepted.snapshot)};}
  const token=(version,accepted)=>JSON.stringify({document:version,acceptance:accepted.fingerprint});
  async function verifyExternal(data){
    const ext=data.external;if(!ext)return;if(await syncContentHash(text(ext.source))!==ext.id)fail('stored-external-hash');
    let checked=null;try{checked=owned(ext.source);}catch{}
    if(checked===null?ext.issue===null||ext.owned!==null||ext.reviewed:ext.issue!==null||!same(checked,ext.owned))fail('stored-external-projection');
  }
  async function write(version,data,options){
    await verifyExternal(data);return session.compareAndSetLocalDocument(version,bounded(data),options);
  }
  function preview(found,id){
    const ext=found.data.external;if(!ext||ext.id!==id)fail('external-superseded');
    if(ext.reviewed)return {kind:'noop',id};if(ext.issue!==null)return {kind:'invalid-external',id,issue:ext.issue};
    const conflicts=[],local=owned(found.data.effective),merged=mergeSyncSettings(found.data.externalBase,ext.owned,local,[],conflicts);
    return {kind:conflicts.length?'review-required':'candidate',id,conflicts,base:clone(found.data.externalBase),local,external:clone(ext.owned),proposal:normalize({...found.data.effective,...merged})};
  }
  const documentStore={
    read(){return queue(async()=>{const found=current(),accepted=authority();await verifyExternal(found.data);return {version:token(found.version,accepted),data:materialize(found.data,accepted)};});},
    compareAndSet(expected,data){
      const captured=bounded(data),effective=normalize(captured);
      return queue(async()=>{
        const found=current(),accepted=authority();if(expected!==token(found.version,accepted))return {ok:false};
        if(!Object.hasOwn(captured,'layoutOverrides')||!same(captured.layoutOverrides,accepted.snapshot))fail('unaccepted-layout-cache');
        await checkpoint('before-private-config-save');if(authority().fingerprint!==accepted.fingerprint)return {ok:false};
        const result=await write(found.version,{...found.data,effective});if(!result.ok)return result;
        await checkpoint('after-private-config-save');if(authority().fingerprint!==accepted.fingerprint)return {ok:false,reason:'acceptance-changed'};
        return {ok:true};
      });
    },
  };
  return {
    documentStore,
    open(){return queue(async()=>{const found=session.getLocalDocument();if(!found){authority();return {kind:'initialization-required'};}const data=load(found.data);await verifyExternal(data);return {kind:'opened',pendingExternal:data.external&&!data.external.reviewed?data.external.id:null};});},
    initialize({sourceData}={}){
      const source=bounded(sourceData);if(!plain(source))fail('source-shape');
      return queue(async()=>{
        authority();const existing=session.getLocalDocument();if(existing){load(existing.data);await verifyExternal(existing.data);return {kind:'already-initialized'};}
        const effective=normalize(source),data={version:1,effective,externalBase:owned(effective),external:null};const result=await write(null,data,{initialBackup:source});
        return {kind:result.ok?'initialized':'held',reason:result.ok?undefined:'document-changed'};
      });
    },
    observeExternal(sourceData,{epoch=getExternalEpoch()}={}){
      const source=bounded(sourceData);if(!plain(source))fail('source-shape');
      return queue(async()=>{
        if(epoch!==getExternalEpoch())return {kind:'held',reason:'external-changed'};
        const id=await syncContentHash(text(source)),found=current();let externalOwned=null,issue=null;
        try{externalOwned=owned(source);}catch(error){issue=String(error.message||error).slice(0,160);}
        if(epoch!==getExternalEpoch())return {kind:'held',reason:'external-changed'};
        if(found.data.external?.id===id){await verifyExternal(found.data);seen={id,epoch};return {kind:found.data.external.reviewed?'noop':issue!==null?'invalid-external':'review-required',id};}
        const external={id,source,owned:externalOwned,issue,reviewed:issue===null&&same(externalOwned,found.data.externalBase)};
        await checkpoint('before-external-observation');if(epoch!==getExternalEpoch())return {kind:'held',reason:'external-changed'};
        const result=await write(found.version,{...found.data,external});if(!result.ok)return {kind:'held',reason:'document-changed'};
        seen={id,epoch};await checkpoint('after-external-observation');
        if(epoch!==getExternalEpoch())return {kind:'held',reason:'external-changed',id};
        return {kind:external.reviewed?'ignored-nonsettings':issue!==null?'invalid-external':'review-required',id};
      });
    },
    reviewExternal(id){return queue(async()=>{const found=current();await verifyExternal(found.data);return preview(found,id);});},
    resolveExternal(id,{choice}={}){
      if(!['merge','keep-local','use-external'].includes(choice))fail('choice');
      return queue(async()=>{
        const found=current();await verifyExternal(found.data);const review=preview(found,id);if(review.kind==='noop')return review;
        if(!seen||seen.id!==id)return {kind:'held',reason:'read-external-again'};
        if(seen.epoch!==getExternalEpoch())return {kind:'held',reason:'external-changed'};
        if(review.kind==='invalid-external')return review;
        if(choice==='merge'&&review.conflicts.length)return review;
        const effective=choice==='keep-local'?found.data.effective:choice==='use-external'?normalize({...found.data.effective,...found.data.external.owned}):review.proposal;
        const epoch=seen.epoch;await checkpoint('before-external-config-commit');if(epoch!==getExternalEpoch())return {kind:'held',reason:'external-changed'};
        const result=await write(found.version,{...found.data,effective,externalBase:found.data.external.owned,external:{...found.data.external,reviewed:true}});
        if(!result.ok)return {kind:'held',reason:'document-changed'};await checkpoint('after-external-config-commit');
        return {kind:epoch===getExternalEpoch()?'applied':'applied-deferred',effectiveChanged:!same(effective,found.data.effective)};
      });
    },
    getInitialBackup(){return queue(()=>session.getLocalDocumentBackup());},
    history({before=null,limit=20}={}){
      if(!Number.isInteger(limit)||limit<1||limit>20)fail('history-limit');
      return queue(async()=>{
        const versions=session.listLocalDocumentVersions().reverse(),start=before===null?0:versions.indexOf(before)+1;
        if(before!==null&&start===0)fail('history-version');const selected=versions.slice(start,start+limit),entries=[];
        for(const version of selected){const data=load(await session.readLocalDocumentVersion(version));await verifyExternal(data);entries.push({version,externalId:data.external?.id||null,reviewed:data.external?.reviewed??null});}
        return {entries,next:selected.length&&start+selected.length<versions.length?selected.at(-1):null};
      });
    },
    readHistory(version){return queue(async()=>{const data=load(await session.readLocalDocumentVersion(version));await verifyExternal(data);return data;});},
    async close(){closing=true;await tail.catch(()=>{});closed=true;},
    settled:()=>tail.catch(()=>{}),
  };
}
