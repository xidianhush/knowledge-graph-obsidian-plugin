import {openObsidianOnboardingReview} from './obsidian-onboarding-review.mjs';
import {openObsidianConflictReview,renderObsidianLayoutPreview} from './obsidian-conflict-review.mjs';
import {createRecoveryDestination} from './recovery-export.mjs';
import {randomSyncOperationId} from './author-prototype.mjs';

export function deriveSyncStatus(state,{result=null,error=null}={}){
 const s=state.session,p=state.publication;
 // An unarmed queue can retain this review result after its work is gone.
 // Ignore only that obsolete notice; later sources may still report a real fault.
 const idle=state.status==='ready'&&s?.initialized&&!s.faulted&&!s.closed&&!state.error&&!state.saveError&&!s.pending&&!s.localState?.layoutDraft&&!s.localState?.pendingSave&&!p?.paused&&!p?.running&&!p?.closed;
 const current=value=>idle&&value?.kind==='held'&&value.reason==='publication-review-required'?null:value;
 const last=current(result)??current(state.outcome)??current(p?.lastResult),reason=error??state.saveError??last?.reason??(s?.attemptConflict?'attempt-conflict-review':'');
 let key;
 if(state.saveError)key='unsaved';
 else if(state.rotationPending)key='rotation';
 else if(state.error||s?.faulted||state.status==='recovery-required')key='recovery';
 else if(error)key=/resolution-(choice|parent)-budget/.test(error)?'conflictLimit':'held';
 else if(state.selectionPending)key='selection';
 else if(s?.attemptConflict)key='damaged';
 else if(/resolution-(choice|parent)-budget/.test(reason))key='conflictLimit';
 else if(state.status==='join-required'&&!s?.initialized&&/^layout-/.test(reason))key='joinBlocked';
 else if(reason==='structure-path-review'||reason==='structure-path-budget')key='notes';
 else if(/paused/.test(state.status)||/budget|capacity|quota/.test(reason))key='capacity';
 else if(reason==='no-shared-conflict')key='noConflict';
 else if(!(state.status==='disabled'||state.status?.startsWith('local-'))&&(reason==='local-layout-review-required'||reason==='publication-review-required'&&s?.localState?.layoutDraft))key='draftReview';
 else if(s?.pending?.mode==='resolution'||/shared-candidate-blocked|conflict-confirmation|shared-conflict-review|required-competition/.test(reason))key='conflict';
 else if(/unresolved|predecessor|missing-parent/.test(reason))key='predecessor';
 else if(/graph-incompatible|waiting-note|resolution-graph/.test(reason))key='notes';
 else if(/quarantine|invalid|damaged|partial|unverified|shared-input-blocked|accepted-record|unknown-file|authentication|attempt-conflict-review/.test(reason))key='damaged';
 else if(state.status==='unselected')key='off';
 else if(state.status==='disabled'||state.status?.startsWith('local-'))key='disabled';
 else if(!s?.initialized)key=/^layout-/.test(reason)?'joinBlocked':/graph|hidden|busy|closing/.test(reason)?'waiting':'join';
 else if(state.externalPending)key='settings';
 else if(s.localState?.layoutDraft||s.pending)key='queued';
 else if(last?.scope!=='receive'&&['accepted','accepted-deferred'].includes(last?.kind))key='written';
 else if(/graph|hidden|busy|closing/.test(reason))key='waiting';
 else if(last?.kind==='held'||error)key='held';
 else key='saved';
 return {key,reason};
}

// One settings section; all persistent actions go through reviewed host APIs.
export function mountObsidianSyncSettings({container,app,host,Modal,t,onCheck=()=>host.receive(),onExport}={}){
 const doc=container.ownerDocument,section=doc.createElement('section');section.className='kg-sync-settings';section.style.cssText='margin-top:28px;border-top:1px solid var(--background-modifier-border);padding-top:16px;min-width:0;';container.append(section);
 let closed=false,busy=false,active=null,lastResult=null,lastError=null,tail=Promise.resolve(),candidates=[],backup=null,exportId=null,folder='Knowledge Map Backups',choice='accepted',rollbackChoice='accepted',rollbackPath=null;
 const text=(parent,tag,value)=>{const el=doc.createElement(tag);el.textContent=value;parent.append(el);return el;};
 const button=(parent,key,action,id,disabled=false)=>{const el=text(parent,'button',t(key));el.type='button';el.dataset.syncAction=id;el.disabled=disabled||busy||!!active;el.style.cssText='white-space:normal;height:auto;min-height:36px;max-width:100%;padding:6px 12px;';el.addEventListener('click',()=>void run(action));return el;};
 function recordError(error){
  const reason=String(error?.message??error);
  if(backup&&reason.startsWith('recovery-export-')){
   const path=backup.destination.location+'/'+backup.id;backup=null;rollbackPath=null;
   const key=reason==='recovery-export-incomplete'?'sync.backupMissingManifest':reason==='recovery-export-content-missing'?'sync.backupMissingBody':'sync.backupInvalid';
   lastError=t(key,{path})+' ('+reason+')';lastResult=null;
  }else lastError=reason;
 }
 function run(action){if(closed||busy||active)return Promise.resolve();busy=true;lastError=null;render();const work=tail.catch(()=>{}).then(action).then(result=>{lastResult=result;return result;},error=>{recordError(error);return {kind:'error'};}).finally(()=>{busy=false;if(!closed)render();});tail=work;return work;}
 function closedModal(){active=null;if(!closed)render();}
 function simpleReview({title,intro,choices,draw,onConfirm,onCancel,confirmLabel='sync.confirm'}){
  class ConfirmModal extends Modal{
   onOpen(){this.modalEl.style.width='min(760px, calc(100vw - 24px))';this.contentEl.style.cssText='max-height:80vh;overflow-y:auto;';text(this.contentEl,'h2',t(title));text(this.contentEl,'p',t(intro));draw?.(this.contentEl);let selected=null;
    const actions=doc.createElement('div');actions.style.cssText='display:flex;flex-wrap:wrap;gap:12px;margin-top:16px;';this.contentEl.append(actions);
    if(choices)for(const choice of choices){const b=text(actions,'button',t(choice.label));b.type='button';b.dataset.syncChoice=choice.id;b.addEventListener('click',()=>{selected=choice.id;for(const x of actions.querySelectorAll('[data-sync-choice]'))x.setAttribute('aria-pressed',String(x===b));confirm.disabled=false;});}
    const cancel=text(actions,'button',t('sync.cancel'));cancel.type='button';cancel.dataset.syncCancel='true';cancel.addEventListener('click',()=>{if(!this.committing)this.close();});
    const confirm=text(actions,'button',t(confirmLabel));confirm.type='button';confirm.dataset.syncConfirm='true';confirm.disabled=!!choices;
    confirm.addEventListener('click',async()=>{if(this.committing||confirm.disabled)return;this.committing=true;this.committed=true;for(const b of actions.querySelectorAll('button'))b.disabled=true;
     try{await modalAction(()=>onConfirm(selected));}finally{this.close();}});
   }
   onClose(){if(!this.committed)onCancel?.();this.contentEl.empty();closedModal();}
  }
  active=new ConfirmModal(app);active.open();render();return active;
 }
 async function modalAction(action){if(closed)return;try{lastResult=await action();}catch(error){recordError(error);}}
 async function join(){const review=await host.previewJoin();if(closed){if(review.token)host.discardJoin(review.token);return {kind:'held',reason:'settings-closed'};}if(review.kind!=='join-preview')return review;
  active=openObsidianOnboardingReview({app,Modal,t:(key,...args)=>t(key==='receive.joinPreserve'?'sync.joinPreserve':key,...args),review,onConfirm:choice=>modalAction(()=>host.confirmJoin(review.token,choice)),onCancel:()=>host.discardJoin(review.token),onClosed:closedModal});render();return review;
 }
 async function select(options){const preview=await host.previewSelection(options);if(closed){if(preview.token)host.discardSelection(preview.token);return {kind:'held',reason:'settings-closed'};}if(preview.kind!=='selection-preview')return preview;
  return simpleReview({title:'sync.selectTitle',intro:'sync.selectEffect',draw:el=>text(el,'p',preview.selection.vault),onCancel:()=>host.discardSelection(preview.token),onConfirm:async()=>{const result=await host.confirmSelection(preview.token);return result;}});
 }
 function layouts(parent,snapshot){if(!snapshot)return;for(const [group,record]of Object.entries(snapshot.groups))renderObsidianLayoutPreview(parent,{group,value:{record,structures:snapshot.structures}},t);}
 async function restore(){const review=await host.previewPublication();if(closed){if(review.token)host.discardReview(review.token);return {kind:'held',reason:'settings-closed'};}if(review.kind!=='publication-review')return review;
  return simpleReview({title:'sync.restoreTitle',intro:review.competition?'sync.competitionEffect':'sync.restoreEffect',confirmLabel:review.competition?'sync.keepBoth':'sync.confirm',draw:el=>{if(review.pending){text(el,'h3',t('sync.restorePending'));layouts(el,review.pending.proposal);}if(review.draft){text(el,'h3',t('sync.restoreDraft'));layouts(el,review.draft.value);}if(review.shared){text(el,'h3',t('sync.sharedLayout'));layouts(el,review.shared);}},onConfirm:()=>host.confirmPublication(review.token),onCancel:()=>host.discardReview(review.token)});
 }
 async function conflict(){const review=await host.previewConflict();if(closed){if(review.token)host.discardReview(review.token);return {kind:'held',reason:'settings-closed'};}if(review.kind!=='review')return review;
  active=openObsidianConflictReview({app,Modal,t,review,pending:review.pending,onConfirm:choice=>modalAction(()=>host.confirmConflict(review.token,choice)),onCancel:()=>host.discardReview(review.token),onClosed:closedModal});render();return review;
 }
 async function external(){const p=await host.previewExternalSettings();if(closed){if(p.token)host.discardReview(p.token);return {kind:'held',reason:'settings-closed'};}if(p.kind!=='settings-review')return p;
  if(p.review.kind==='invalid-external'){host.discardReview(p.token);return {kind:'held',reason:t('sync.invalidExternal')};}
  return simpleReview({title:'sync.externalTitle',intro:'sync.externalEffect',choices:[{id:'keep-local',label:'sync.keepLocal'},{id:'use-external',label:'sync.useExternal'},...(p.review.conflicts.length?[]:[{id:'merge',label:'sync.merge'}])],
   draw:el=>{for(const [key,value]of [['sync.localSettings',p.review.local],['sync.otherSettings',p.review.external]]){text(el,'h3',t(key));const pre=text(el,'pre',JSON.stringify(value,null,2));pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;';}},onCancel:()=>host.discardReview(p.token),onConfirm:choice=>host.confirmExternalSettings(p.token,choice)});
 }
 async function recoverShared(){const r=await host.previewSharedRecovery();if(closed){if(r.token)host.discardReview(r.token);return {kind:'held',reason:'settings-closed'};}if(r.kind!=='shared-recovery-review')return r;
  return simpleReview({title:'sync.recoveryTitle',intro:'sync.recoveryEffect',draw:el=>{for(const id of r.ids)text(el,'p',id);layouts(el,r.proposal);},onCancel:()=>host.discardReview(r.token),onConfirm:()=>host.confirmSharedRecovery(r.token)});
 }
 const destination=()=>createRecoveryDestination({vault:app.vault,folder});
 async function exportBackup(){exportId??=randomSyncOperationId();const d=destination(),id=exportId,r=await host.exportRecovery({destination:d,id});if(r.kind==='exported'){backup={destination:d,id};exportId=null;}return r.kind==='exported'?{...r,reason:t('sync.backupSaved',{path:folder+'/'+id})}:r;}
 async function rollback(){
  if(!backup)return {kind:'held',reason:t('sync.backupFirst')};
  const r=await host.previewRollback({...backup,choice:rollbackChoice});if(closed){if(r.token)host.discardReview(r.token);return {kind:'held',reason:'settings-closed'};}if(r.kind!=='rollback-review')return r;
  return simpleReview({title:'sync.rollbackTitle',intro:'sync.rollbackEffect',draw:el=>{text(el,'p',t('sync.backupFolder')+': '+r.backup);text(el,'p',r.path);text(el,'p',t(r.choice==='draft'?'sync.rollbackDraft':'sync.rollbackAccepted'));layouts(el,r.data.layoutOverrides);},onCancel:()=>host.discardReview(r.token),onConfirm:async()=>{const result=await host.confirmRollback(r.token);if(result.kind==='compatibility-exported')rollbackPath=result.path;return result;}});
 }
 async function rotate(){const pending=host.state().rotationPending;
  const r=pending?await host.previewRotationResume({destination:createRecoveryDestination({vault:app.vault,folder:pending.location})}):backup?await host.previewRotation({...backup,choice}):{kind:'held',reason:t('sync.backupFirst')};
  if(closed){if(r.token)host.discardReview(r.token);return {kind:'held',reason:'settings-closed'};}if(r.kind!=='rotation-review')return r;
  return simpleReview({title:'sync.rotateTitle',intro:'sync.rotateEffect',draw:el=>{text(el,'p',t('sync.current')+': '+r.from);text(el,'p',t('sync.target')+': '+r.target);text(el,'p',t('sync.backupFolder')+': '+r.backup);text(el,'p',t(r.choice==='draft'?'sync.rotateDraft':'sync.rotateAccepted'));layouts(el,r.proposal);},onCancel:()=>host.discardReview(r.token),onConfirm:()=>host.confirmRotation(r.token)});
 }
 async function abortRotation(){const r=await host.previewRotationAbort();if(closed){if(r.token)host.discardReview(r.token);return {kind:'held',reason:'settings-closed'};}if(r.kind!=='rotation-abort-review')return r;return simpleReview({title:'sync.abortRotation',intro:'sync.abortRotationEffect',onCancel:()=>host.discardReview(r.token),onConfirm:()=>host.confirmRotationAbort(r.token)});}
 async function abandonPublication(){if(!backup)return {kind:'held',reason:t('sync.backupFirst')};const r=await host.previewAbandonPublication(backup);if(closed){if(r.token)host.discardReview(r.token);return {kind:'held',reason:'settings-closed'};}if(r.kind!=='abandon-review')return r;return simpleReview({title:'sync.abandon',intro:'sync.abandonEffect',draw:el=>text(el,'p',r.pendingId),onCancel:()=>host.discardReview(r.token),onConfirm:()=>host.confirmAbandonPublication(r.token)});}
 function render(){if(closed)return;section.replaceChildren();const state=host.state(),status=deriveSyncStatus(state,{result:lastResult,error:lastError});
  text(section,'h2',t('sync.title'));text(section,'p',t('sync.intro'));
  const banner=text(section,'p',t('sync.status.'+status.key));banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');banner.dataset.syncStatus=status.key;
  if(status.reason){const details=text(section,'details','');text(details,'summary',t('sync.reason'));const friendly=['local-layout-review-required','no-shared-conflict','shared-conflict-review-required','shared-scan-changed','multiple-shared-conflicts'].includes(status.reason);const p=text(details,'p',friendly?t('sync.reason.'+status.reason):status.reason);p.style.overflowWrap='anywhere';}
  const current=text(section,'p',t('sync.current')+': '+(state.selected?.vault??t('sync.none'))+(state.selected?.transport==='v2'?' · '+t('sync.readOnly'):''));current.style.overflowWrap='anywhere';
  if(state.privateBudget){const b=state.privateBudget;text(section,'p',t('sync.privateBudget',{bytes:b.bytes,files:b.files,events:b.events,softBytes:b.limits.softBytes,softFiles:b.limits.softFiles,softEvents:b.limits.softEvents}));if(b.triggers?.length)text(section,'p',t('sync.budgetTriggers')+': '+b.triggers.map(k=>t('sync.budget.'+k)).join(', '));}
  const actions=doc.createElement('div');actions.style.cssText='display:flex;flex-wrap:wrap;gap:10px;align-items:center;';section.append(actions);
  const disabled=state.status==='disabled'||state.status.startsWith('local-'),enabled=!!state.selected&&!disabled&&state.status!=='recovery-required',pending=!!state.selectionPending;
  if(pending)button(actions,'sync.resumeSelection',()=>select({action:'resume'}),'resume-selection');
  if(state.selected&&!pending)button(actions,enabled?'sync.disable':'sync.enable',()=>enabled?host.disable():host.enable(),enabled?'disable':'enable',state.status==='recovery-required');
  button(actions,'sync.new',()=>select({action:'new'}),'new',enabled||pending);
  button(actions,'sync.find',async()=>{const found=await host.discover();if(found.kind==='catalog')candidates=found.candidates;return found;},'find',enabled);
  const picker=doc.createElement('select');picker.dataset.syncPicker='true';picker.setAttribute('aria-label',t('sync.choose'));picker.style.cssText='max-width:100%;min-width:0;flex:1 1 260px;';const placeholder=text(picker,'option',t('sync.choosePlaceholder'));placeholder.value='';for(const [i,c]of candidates.entries()){const opt=text(picker,'option',c.vault+(c.transport==='v2'?' · '+t('sync.readOnly'):'')+(c.verified===false?' · '+t('sync.unverifiedTarget'):''));opt.value=String(i);}picker.disabled=busy||!!active||enabled;actions.append(picker);
  button(actions,'sync.choose',()=>{const c=candidates[Number(picker.value)];return picker.value!==''&&c?select({action:'join',vault:c.vault,transport:c.transport}):{kind:'held',reason:t('sync.choosePlaceholder')};},'choose',enabled||pending);
  if(state.selected&&!state.session?.initialized)button(actions,'sync.join',join,'join',disabled);
  if(state.session?.initialized){button(actions,'sync.check',onCheck,'check',disabled);button(actions,'sync.conflict',conflict,'conflict',disabled||state.selected?.transport==='v2');button(actions,'sync.restore',restore,'restore',disabled||state.selected?.transport==='v2');button(actions,'sync.external',external,'external');}
  if(state.session?.attemptConflict)button(actions,'sync.recovery',recoverShared,'recover-shared',disabled||state.selected?.transport==='v2');
  if(onExport)button(actions,'sync.export',onExport,'export');
  if(typeof host.exportRecovery==='function'&&(state.session?.initialized||state.rotationPending)){
   const box=text(section,'div','');text(box,'p',t('sync.backupEffect'));
   const label=text(box,'label',t('sync.backupFolder'));const input=doc.createElement('input');input.value=folder;input.dataset.syncBackupFolder='true';input.type='text';input.style.cssText='width:100%;max-width:480px;';input.disabled=busy||!!active||!!state.rotationPending;input.addEventListener('change',()=>{folder=input.value.trim();exportId=null;backup=null;rollbackPath=null;lastResult=null;lastError=null;render();});label.append(input);
   button(box,'sync.backup',exportBackup,'backup',!!state.rotationPending);
   if(!backup)text(box,'p',t('sync.backupPageRequired'));
   if(backup)text(box,'p',t('sync.backupPrevious',{path:backup.destination.location+'/'+backup.id}));
   const sourceLabel=text(box,'label',t('sync.rotateSource'));const pick=doc.createElement('select');pick.dataset.syncRootChoice='true';pick.setAttribute('aria-label',t('sync.rotateSource'));for(const [value,key]of [['accepted','sync.rotateAccepted'],['draft','sync.rotateDraft']]){const opt=text(pick,'option',t(key));opt.value=value;}pick.value=choice;pick.disabled=busy||!!active||!!state.rotationPending;pick.addEventListener('change',()=>choice=pick.value);sourceLabel.append(pick);
   if(host.canReviewRotation&&!host.canReviewRotation())text(box,'p',t('sync.rotationWait'));
   if(busy||active)text(box,'p',t('sync.backupBusy'));
   button(box,state.rotationPending?'sync.resumeRotation':'sync.rotate',rotate,'rotate',!state.rotationPending&&!backup||!!host.canReviewRotation&&!host.canReviewRotation());
   if(state.session?.pending&&!state.rotationPending)button(box,'sync.abandon',abandonPublication,'abandon',!backup);
   if(state.rotationPending&&state.rotationPending.from===state.selected?.vault&&!state.selectionPending)button(box,'sync.abortRotation',abortRotation,'abort-rotation');
   if(typeof host.previewRollback==='function'){
    text(box,'p',t('sync.rollbackHelp'));text(box,'p',t(!disabled?'sync.rollbackDisableFirst':state.rotationPending?'sync.rollbackRotationPending':'sync.rollbackSelectFirst'));
    const rollbackLabel=text(box,'label',t('sync.rollbackSource'));
    const rollbackPick=doc.createElement('select');rollbackPick.dataset.syncRollbackChoice='true';rollbackPick.setAttribute('aria-label',t('sync.rollbackSource'));
    for(const [value,key]of [['accepted','sync.rollbackAccepted'],['draft','sync.rollbackDraft']]){const opt=text(rollbackPick,'option',t(key));opt.value=value;}
    rollbackPick.value=rollbackChoice;rollbackPick.disabled=busy||!!active||!!state.rotationPending;rollbackPick.addEventListener('change',()=>rollbackChoice=rollbackPick.value);rollbackLabel.append(rollbackPick);
    if(host.canReviewRotation&&!host.canReviewRotation())text(box,'p',t('sync.rollbackWait'));
    button(box,'sync.rollback',rollback,'rollback',!disabled||!backup||!!state.rotationPending||!!host.canReviewRotation&&!host.canReviewRotation());
    if(rollbackPath)text(box,'p',t('sync.rollbackSaved',{path:rollbackPath}));
   }
  }
 }
 const unsubscribe=host.subscribe(()=>{lastResult=null;render();});render();
 return {render,state:()=>({busy,reviewOpen:!!active,lastKind:lastResult?.kind,lastReason:lastResult?.reason,lastError}),settled:()=>tail,close(){closed=true;active?.close();active=null;unsubscribe();section.remove();}};
}
