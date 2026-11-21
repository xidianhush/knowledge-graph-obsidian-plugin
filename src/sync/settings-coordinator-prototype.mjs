// A3 coordination policy over an already-open durable session and a document
// adapter with real compare-and-set. No production saveData/Vault integration.
import {cloneBoundedSyncJson} from './causal-prototype.mjs';
import {validateSchema3Snapshot,probeSchema3Snapshot,normalizeRestoreLayout} from './layout-prototype.mjs';
import {randomSyncOperationId} from './author-prototype.mjs';
import {mergeSyncSettings as merge,SYNC_MISSING as MISSING} from './settings-merge-prototype.mjs';
const clone=x=>structuredClone(x),plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const text=x=>JSON.stringify(cloneBoundedSyncJson(x)),equal=(a,b)=>a===MISSING||b===MISSING?a===b:text(a)===text(b);
const keys=(v,fields)=>plain(v)&&Object.keys(v).sort().join(',')===[...fields].sort().join(',');
const fail=reason=>{throw Error('coordinator-'+reason);};
export function createSettingsCoordinator({session,documentStore,validateSettings,nextId=randomSyncOperationId,checkpoint=async()=>{},createModel,getGraphEpoch}={}){
  if(!session||['state','saveLocalState','acceptExternal'].some(k=>typeof session[k]!=='function')||!documentStore||
    ['read','compareAndSet'].some(k=>typeof documentStore[k]!=='function')||typeof validateSettings!=='function')fail('options');
  let opened=false,closing=false,tail=Promise.resolve(),local=null,settingsInputs=0,appliedInputs=0,lastSaved=null;
  const restoreTokens=new WeakMap();
  const defaults=()=>({version:2,settingsDraft:null,layoutDraft:null,uiPending:{},pendingSave:null,restoreSource:null});
  function queue(fn){if(closing)fail('closing');const result=tail.catch(()=>{}).then(()=>{if(!opened)fail('not-open');return fn();});tail=result;return result;}
  const state=()=>clone(local);
  async function persist(next){await session.saveLocalState(next);local=clone(next);return state();}
  function owned(data){
    const input={settings:data.settings||{},pipeline:data.pipeline||{}};
    const checked=cloneBoundedSyncJson(validateSettings(clone(input)));
    if(!plain(checked.settings)||!plain(checked.pipeline))fail('settings-shape');
    return {settings:checked.settings,pipeline:checked.pipeline};
  }
  function authority(){const accepted=session.state().accepted;if(!accepted?.fingerprint)fail('acceptance-required');return accepted;}
  function id(){const value=nextId();if(typeof value!=='string'||!/^[a-f0-9]{32}$/.test(value))fail('draft-id');return value;}
  async function document(){const found=await documentStore.read();if(!found||!Object.hasOwn(found,'version')||!plain(found.data))fail('document');
    return {version:found.version,data:cloneBoundedSyncJson(found.data)};}
  function loadLocal(value){
    if(value?.version===1&&keys(value,['version','settingsDraft','layoutDraft','uiPending','pendingSave']))value={...value,version:2,restoreSource:null};
    if(!keys(value,['version','settingsDraft','layoutDraft','uiPending','pendingSave','restoreSource'])||value.version!==2||!plain(value.uiPending)||value.restoreSource!==null&&!plain(value.restoreSource))fail('local-state');
    const s=value.settingsDraft,l=value.layoutDraft,p=value.pendingSave;
    if(s&&(!keys(s,['id','base','value'])||!/^[a-f0-9]{32}$/.test(s.id)||!keys(s.base,['settings','pipeline'])||!keys(s.value,['settings','pipeline'])))fail('settings-draft');
    if(l&&(!keys(l,['id','baseFingerprint','value'])||!/^[a-f0-9]{32}$/.test(l.id)||!/^[a-f0-9]{64}$/.test(l.baseFingerprint)))fail('layout-draft');
    if(l)validateSchema3Snapshot(l.value);
    if(p&&(!keys(p,['kind','settingsId'])||!['cache','settings'].includes(p.kind)||(p.kind==='settings'?p.settingsId!==s?.id:p.settingsId!==null)))fail('pending-save');
    for(const [key,item]of Object.entries(value.uiPending))if(!key||key.length>512||!keys(item,['base','value'])||!keys(item.base,['exists','value'])||typeof item.base.exists!=='boolean'||typeof item.value!=='string')fail('ui-pending');
    return cloneBoundedSyncJson(value);
  }
  function restoreBlocked(){return local.settingsDraft||local.layoutDraft||local.pendingSave||Object.keys(local.uiPending).length||session.state().pending;}
  function graphEpoch(){if(typeof createModel!=='function'||typeof getGraphEpoch!=='function')fail('restore-graph-required');const value=getGraphEpoch();if(!Number.isSafeInteger(value)||value<0)fail('restore-epoch');return value;}
  function restoreLayout(source){if(Object.hasOwn(source,'settingsVersion')&&source.settingsVersion!==1)fail('restore-settings-version');
    const layout=normalizeRestoreLayout(source.layoutOverrides,createModel);
    if(!probeSchema3Snapshot(layout,createModel).ok)fail('restore-graph-incompatible');return layout;}
  async function flush(kind,settingsId=null){
    if(kind==='settings'&&local.settingsDraft?.id!==settingsId)fail('stale-settings-draft');
    if(local.pendingSave&&(local.pendingSave.kind!==kind||local.pendingSave.settingsId!==settingsId))return {kind:'held',reason:'another-save-pending',state:state()};
    if(!local.pendingSave)await persist({...local,pendingSave:{kind,settingsId}});
    for(let attempt=0;attempt<3;attempt++){
      const current=await document(),accepted=authority(),conflicts=[];
      const target=clone(current.data),currentSettings=owned(current.data);
      if(kind==='settings'){
        const draft=local.settingsDraft;
        const merged=merge(draft.base,draft.value,currentSettings,[],conflicts);
        const normalized=cloneBoundedSyncJson(validateSettings(clone(merged)));target.settings=normalized.settings;target.pipeline=normalized.pipeline;
        if(Object.hasOwn(normalized,'settingsVersion'))target.settingsVersion=normalized.settingsVersion;
      }
      const ui=plain(current.data.ui)?current.data.ui:{},rows=new Map(Object.entries(ui));
      for(const [key,item]of Object.entries(local.uiPending)){
        const base=item.base.exists?item.base.value:MISSING,now=Object.hasOwn(ui,key)?ui[key]:MISSING;
        const merged=merge(base,item.value,now,['ui',key],conflicts);if(merged===MISSING)rows.delete(key);else rows.set(key,merged);
      }
      if(Object.keys(local.uiPending).length)target.ui=Object.fromEntries(rows);
      target.layoutOverrides=clone(accepted.snapshot);
      if(conflicts.length)return {kind:'review-required',conflicts,state:state()};
      await checkpoint('before-document-write');if(authority().fingerprint!==accepted.fingerprint)continue;
      if(!equal(target,current.data)){
        const written=await documentStore.compareAndSet(current.version,target);
        if(!written?.ok){
          if(written?.retryable===false)return {kind:'held',reason:written.reason||'document-write-blocked',state:state()};
          continue;
        }
        await checkpoint('after-document-write');
      }
      if(authority().fingerprint!==accepted.fingerprint)continue;
      const retainedDraft=kind==='settings'&&settingsInputs>appliedInputs;
      const draft=local.settingsDraft;
      if(kind==='settings')lastSaved={id:draft.id,value:clone(draft.value)};
      const next={...local,uiPending:{},pendingSave:null,...(kind==='settings'?{settingsDraft:retainedDraft?{id:draft.id,base:clone(draft.value),value:clone(draft.value)}:null}:{})};
      await persist(next);await checkpoint('after-save-clear');
      // A receipt changing during the durable clear cannot authorize a view
      // update. Re-open a cache intent and let the next run repair its cache.
      if(authority().fingerprint!==accepted.fingerprint){await persist({...local,pendingSave:{kind:'cache',settingsId:null}});return {kind:'held',reason:'acceptance-changed',state:state()};}
      return {kind:'saved',retainedDraft:retainedDraft||(kind==='settings'&&settingsInputs>appliedInputs),state:state(),document:clone(target),acceptanceFingerprint:accepted.fingerprint};
    }
    return {kind:'held',reason:'document-changed',state:state()};
  }
  return {
    async open(){if(closing)fail('closing');if(opened)fail('already-open');authority();local=loadLocal(session.state().localState||defaults());opened=true;return state();},
    beginSettingsDraft(){return queue(async()=>{
      if(local.settingsDraft)fail('settings-draft-open');const current=await document(),base=owned(current.data),draft={id:id(),base,value:clone(base)};
      await persist({...local,settingsDraft:draft});return clone(draft);
    });},
    async updateSettingsDraft(draftId,value){
      if(closing)fail('closing');
      value=cloneBoundedSyncJson(value);if(!keys(value,['settings','pipeline']))fail('settings-scope');value=owned(value);
      if(local?.settingsDraft?.id!==draftId)fail('stale-settings-draft');const input=++settingsInputs,basis=clone(local.settingsDraft.value);
      return queue(async()=>{
      let draft;
      if(local.settingsDraft?.id===draftId)draft={...local.settingsDraft,value};
      else if(!local.settingsDraft&&lastSaved?.id===draftId&&equal(lastSaved.value,basis))draft={id:draftId,base:clone(lastSaved.value),value};
      else fail('stale-settings-draft');
      await persist({...local,settingsDraft:draft});appliedInputs=input;return clone(draft);
    });},
    saveSettingsDraft(draftId){return queue(()=>flush('settings',draftId));},
    async saveUi(key,value){
      if(typeof key!=='string'||!key||key.length>512||value===undefined)fail('ui-key');value=String(value);
      return queue(async()=>{
        const current=await document(),ui=plain(current.data.ui)?current.data.ui:{},base={exists:Object.hasOwn(ui,key),value:Object.hasOwn(ui,key)?ui[key]:null};
        const entries=new Map(Object.entries(local.uiPending));entries.set(key,{base,value});
        await persist({...local,uiPending:Object.fromEntries(entries)});
        if(local.pendingSave?.kind==='settings')return {kind:'held',reason:'settings-save-pending',state:state()};
        return flush('cache');
      });
    },
    async stageLayoutDraft(value){value=validateSchema3Snapshot(value);const baseFingerprint=authority().fingerprint;return queue(async()=>{
      const draft={id:id(),baseFingerprint,value};await persist({...local,layoutDraft:draft});return clone(draft);
    });},
    prepareRestore(sourceData){const source=cloneBoundedSyncJson(sourceData);if(!plain(source))fail('restore-source');return queue(async()=>{
      if(restoreBlocked())return {kind:'held',reason:'local-work-pending'};
      const epoch=graphEpoch(),layout=restoreLayout(source),value=owned(source),current=await document(),fingerprint=authority().fingerprint;
      if(epoch!==graphEpoch())return {kind:'held',reason:'graph-changed'};
      const token=Object.freeze({});restoreTokens.set(token,{source,layout,value,version:current.version,base:owned(current.data),fingerprint,epoch});
      return {kind:'restore-preview',token,settings:clone(value),layout:clone(layout),scope:'draft-only',ignoredFields:'ui-and-root-metadata'};
    });},
    applyRestore(token){return queue(async()=>{
      const review=restoreTokens.get(token);if(!review)fail('restore-token');
      if(restoreBlocked())return {kind:'held',reason:'local-work-pending'};
      const current=await document();if(review.version!==current.version||review.fingerprint!==authority().fingerprint||review.epoch!==graphEpoch())return {kind:'held',reason:'restore-basis-changed'};
      if(!equal(restoreLayout(review.source),review.layout))return {kind:'held',reason:'restore-basis-changed'};
      const settingsId=id(),layoutId=id();await checkpoint('before-restore-drafts');
      const latest=await document();
      if(review.epoch!==graphEpoch()||review.fingerprint!==authority().fingerprint||review.version!==latest.version)return {kind:'held',reason:'restore-basis-changed'};
      await persist({...local,settingsDraft:{id:settingsId,base:review.base,value:review.value},layoutDraft:{id:layoutId,baseFingerprint:review.fingerprint,value:review.layout},restoreSource:review.source});
      restoreTokens.delete(token);await checkpoint('after-restore-drafts');
      return {kind:review.epoch===graphEpoch()&&review.fingerprint===authority().fingerprint?'restore-staged':'restore-staged-deferred',settingsId,layoutId,state:state()};
    });},
    clearLayoutDraft(draftId){return queue(async()=>{if(local.layoutDraft?.id!==draftId)fail('stale-layout-draft');return persist({...local,layoutDraft:null});});},
    settlePublishedLayoutDraft(){return queue(async()=>{
      const draft=local.layoutDraft;if(!draft)return {kind:'noop'};
      if(typeof session.readLocalPublication!=='function'||typeof session.compareAndSetLocalState!=='function')fail('publication-proof-required');
      const accepted=authority(),expected=clone(session.state().localState);
      // A coordinator never overwrites a different owner's newer local state.
      if(!equal(loadLocal(expected),local))return {kind:'held',reason:'local-state-changed'};
      if(draft.baseFingerprint!==accepted.fingerprint&&!await session.readLocalPublication(draft.baseFingerprint))return {kind:'held',reason:'layout-draft-review'};
      const sameLayout=equal({groups:draft.value.groups,structures:draft.value.structures},{groups:accepted.snapshot.groups,structures:accepted.snapshot.structures});
      if(!sameLayout&&draft.baseFingerprint===accepted.fingerprint)return {kind:'ready'};
      const next={...local,layoutDraft:sameLayout?null:{...draft,baseFingerprint:accepted.fingerprint}};
      if(!await session.compareAndSetLocalState(expected,next,{acceptedFingerprint:accepted.fingerprint}).then(r=>r.ok))return {kind:'held',reason:'acceptance-or-local-state-changed'};
      local=clone(next);return {kind:sameLayout?'cleared':'rebased'};
    });},
    refreshCache(){return queue(()=>flush('cache'));},
    acceptExternal(){return queue(async()=>{
      if(local.layoutDraft)return {kind:'held',reason:'local-layout-draft',state:state()};
      if(local.pendingSave)return {kind:'held',reason:'save-pending',state:state()};
      const result=await session.acceptExternal();
      if(['accepted','accepted-deferred','noop'].includes(result.kind))return {kind:result.kind,acceptance:result,cache:await flush('cache'),state:state()};
      return {kind:result.kind,reason:result.reason,state:state()};
    });},
    resume(){return queue(()=>local.pendingSave?flush(local.pendingSave.kind,local.pendingSave.settingsId):Promise.resolve({kind:'noop',state:state()}));},
    state,settled:()=>tail.catch(()=>{}),
    async close(){closing=true;await tail.catch(()=>{});opened=false;},
  };
}
