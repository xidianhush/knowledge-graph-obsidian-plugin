// SYNC-UX-A3: simplified normal-area sync settings driven by host.easySyncState().
// One switch, one status sentence, at most one primary action, and a collapsed
// advanced area that reuses the existing full capability panel. Persistent
// actions still go through the reviewed host APIs; nothing here changes
// acceptance state directly.
import {mountObsidianSyncSettings} from './obsidian-sync-settings.mjs';
import {openObsidianOnboardingReview} from './obsidian-onboarding-review.mjs';
import {openObsidianConflictReview,renderObsidianLayoutPreview} from './obsidian-conflict-review.mjs';

// Map the orchestration phase + host state to one status key and one action.
export function describeEasySync(easy,state){
 const phase=easy?.phase??'idle',reason=easy?.reason??null,s=state?.session;
 const conflict=!!s?.attemptConflict||s?.pending?.mode==='resolution'||/conflict/.test(reason??'');
 // A restored/off-period draft leaves the existing publisher queue unarmed.
 // Surface its review action without arming or resuming publication from UI state.
 const draftReview=!!s?.localState?.layoutDraft&&(/publication-review-required|local-layout-review-required/.test(reason??'')||
  (state?.publication?.armed===false&&!state.publication.closed));
 switch(phase){
  case 'idle':return {status:'idle',guidance:true,action:null};
  case 'off':return {status:'off',action:null};
  case 'preparing':return {status:'preparing',guidance:true,action:null};
  case 'joining':return {status:'joining',action:null};
  case 'awaiting-transfer':return {status:'awaitingTransfer',guidance:true,action:'check'};
  case 'selecting':return {status:'selecting',action:'select'};
  case 'review-required':return reason==='legacy-read-only'?{status:'legacy',action:'readonly'}:{status:'different',action:'review'};
  case 'paused':return {status:'paused',action:'recover'};
  case 'active':
   if(conflict)return {status:'conflict',action:'conflict'};
   if(draftReview)return {status:'draftReview',action:'publish'};
   if(reason==='waiting')return {status:'waiting',action:'check'};
   if(reason==='draft-pending')return {status:'draft',action:'check'};
   if(reason==='written')return {status:'written',action:'check'};
   if(reason==='awaiting-transfer')return {status:'awaitingTransfer',guidance:true,action:'check'};
   return {status:'clean',action:'check'};
  default:return {status:'paused',action:'recover'};
 }
}

export function mountObsidianEasySettings({container,app,host,Modal,t,onCheck=()=>host.receive(),onExport}={}){
 const doc=container.ownerDocument,section=doc.createElement('section');
 section.className='kg-easy-sync';section.style.cssText='margin-top:28px;border-top:1px solid var(--background-modifier-border);padding-top:16px;min-width:0;';
 container.append(section);
 let closed=false,busy=false,active=null,tail=Promise.resolve(),lastError=null,advanced=null,advancedPanel=null,advancedMounted=false;
 const text=(parent,tag,value)=>{const el=doc.createElement(tag);el.textContent=value;parent.append(el);return el;};
 function run(action){if(closed||busy||active)return Promise.resolve();busy=true;lastError=null;render();
  const work=tail.catch(()=>{}).then(action).then(r=>r,error=>{lastError=String(error?.message??error);return {kind:'error'};}).finally(()=>{busy=false;if(!closed)render();});
  tail=work;return work;}
 function closedModal(){active=null;if(!closed)render();}
 async function modalAction(action){if(closed)return;try{return await action();}catch(error){lastError=String(error?.message??error);return {kind:'error'};}}
 function simpleReview({title,intro,choices,draw,onConfirm,onCancel,confirmLabel='sync.confirm'}){
  class ConfirmModal extends Modal{
   onOpen(){this.modalEl.style.width='min(760px, calc(100vw - 24px))';this.contentEl.style.cssText='max-height:80vh;overflow-y:auto;';text(this.contentEl,'h2',t(title));text(this.contentEl,'p',t(intro));draw?.(this.contentEl);let selected=null;
    const actions=doc.createElement('div');actions.style.cssText='display:flex;flex-wrap:wrap;gap:12px;margin-top:16px;';this.contentEl.append(actions);
    if(choices)for(const choice of choices){const b=text(actions,'button',t(choice.label));b.type='button';b.dataset.syncChoice=choice.id;b.addEventListener('click',()=>{selected=choice.id;for(const x of actions.querySelectorAll('[data-sync-choice]'))x.setAttribute('aria-pressed',String(x===b));confirm.disabled=false;});}
    const cancel=text(actions,'button',t('sync.cancel'));cancel.type='button';cancel.dataset.syncCancel='true';cancel.addEventListener('click',()=>{if(!this.committing)this.close();});
    const confirm=text(actions,'button',t(confirmLabel));confirm.type='button';confirm.dataset.syncConfirm='true';confirm.disabled=!!choices;
    confirm.addEventListener('click',async()=>{if(this.committing||confirm.disabled)return;this.committing=true;this.committed=true;for(const b of actions.querySelectorAll('button'))b.disabled=true;try{await modalAction(()=>onConfirm(selected));}finally{this.close();}});}
   onClose(){if(!this.committed)onCancel?.();this.contentEl.empty();closedModal();}
  }
  active=new ConfirmModal(app);active.open();render();return active;
 }
 function layouts(parent,snapshot){if(!snapshot)return;for(const [group,record]of Object.entries(snapshot.groups))renderObsidianLayoutPreview(parent,{group,value:{record,structures:snapshot.structures}},t);}
 async function joinReview(){const review=await host.previewJoin();if(closed){if(review.token)host.discardJoin(review.token);return {kind:'held',reason:'settings-closed'};}if(review.kind!=='join-preview')return review;
  active=openObsidianOnboardingReview({app,Modal,t:(key,...args)=>t(key==='receive.joinPreserve'?'sync.joinPreserve':key,...args),review,onConfirm:choice=>modalAction(()=>host.confirmJoin(review.token,choice)),onCancel:()=>host.discardJoin(review.token),onClosed:closedModal});render();return review;}
 async function conflictReview(){const review=await host.previewConflict();if(closed){if(review.token)host.discardReview(review.token);return {kind:'held',reason:'settings-closed'};}if(review.kind!=='review')return review;
  active=openObsidianConflictReview({app,Modal,t,review,pending:review.pending,onConfirm:choice=>modalAction(()=>host.confirmConflict(review.token,choice)),onCancel:()=>host.discardReview(review.token),onClosed:closedModal});render();return review;}
 async function restoreReview(){const review=await host.previewPublication();if(closed){if(review.token)host.discardReview(review.token);return {kind:'held',reason:'settings-closed'};}if(review.kind!=='publication-review')return review;
  return simpleReview({title:'sync.restoreTitle',intro:review.competition?'sync.competitionEffect':'sync.restoreEffect',confirmLabel:review.competition?'sync.keepBoth':'sync.confirm',draw:el=>{if(review.pending){text(el,'h3',t('sync.restorePending'));layouts(el,review.pending.proposal);}if(review.draft){text(el,'h3',t('sync.restoreDraft'));layouts(el,review.draft.value);}if(review.shared){text(el,'h3',t('sync.sharedLayout'));layouts(el,review.shared);}},onConfirm:()=>host.confirmPublication(review.token),onCancel:()=>host.discardReview(review.token)});}
 async function selectCandidate(){const candidates=host.easySyncState().candidates??[];if(!candidates.length)return {kind:'held',reason:'no-candidates'};
  return simpleReview({title:'sync.selectTitle',intro:'sync.selectEffect',choices:candidates.map(c=>({id:c.vault+'|'+c.transport,label:c.vault.slice(0,8)+'…'+(c.transport==='v2'?' · '+t('sync.readOnly'):'')})),
   onCancel:()=>{},onConfirm:async id=>{const [vault,transport]=id.split('|');const preview=await host.previewSelection({action:'join',vault,transport});if(preview.kind!=='selection-preview')return preview;return host.confirmSelection(preview.token);}});}
 function openAdvanced(){advanced?.setAttribute('open','');advanced?.scrollIntoView({block:'nearest'});return {kind:'advanced-opened'};}
 const actions={check:()=>onCheck(),select:selectCandidate,review:joinReview,conflict:conflictReview,publish:restoreReview,recover:openAdvanced,readonly:openAdvanced};
 // Normal area rebuilds on every render; the advanced panel mounts once and persists.
 const normal=doc.createElement('div');section.append(normal);
 advanced=doc.createElement('details');advanced.className='kg-easy-advanced';advanced.dataset.easyAdvanced='true';advanced.style.cssText='margin-top:16px;';
 text(advanced,'summary',t('sync.easy.advanced'));
 const advancedBody=text(advanced,'div','');section.append(advanced);
 advancedPanel=mountObsidianSyncSettings({container:advancedBody,app,host,Modal,t,onCheck,onExport});
 function render(){if(closed)return;normal.replaceChildren();
  advanced.querySelector('summary').textContent=t('sync.easy.advanced');
  const easy=host.easySyncState(),state=host.state(),view=describeEasySync(easy,state);
  text(normal,'h2',t('sync.easy.title'));
  // Toggle row: an Obsidian-style switch. First activation reads "Turn on layout sync".
  const row=text(normal,'div','');row.style.cssText='display:flex;align-items:center;gap:12px;flex-wrap:wrap;';
  const label=text(row,'label',t(easy.authorization.authorized?'sync.easy.toggle':'sync.easy.toggleFirst'));label.style.cssText='display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:600;';
  const toggle=doc.createElement('input');toggle.type='checkbox';toggle.className='kg-easy-toggle';toggle.dataset.easyToggle='true';toggle.setAttribute('role','switch');
  toggle.checked=!!easy.authorization.enabled;toggle.disabled=busy||!!active;label.prepend(toggle);
  toggle.addEventListener('change',()=>{const on=toggle.checked;void run(()=>on?host.startEasySync():host.stopEasySync());});
  // One status sentence.
  const banner=text(normal,'p',t('sync.easy.status.'+view.status));banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');banner.dataset.easyStatus=view.status;banner.style.cssText='margin:12px 0;line-height:1.6;';
  if(lastError){const e=text(normal,'p',lastError);e.style.cssText='color:var(--text-error);overflow-wrap:anywhere;';}
  // Technical reason goes in details, never the normal sentence.
  if(easy.reason){const details=text(normal,'details','');text(details,'summary',t('sync.easy.reason'));const p=text(details,'p',easy.reason);p.style.overflowWrap='anywhere';}
  // First-run guidance while preparing or waiting for transfer.
  if(view.guidance){const note=text(normal,'p',t('sync.easy.guidance'));note.style.cssText='line-height:1.6;color:var(--text-muted);';}
  // At most one primary action.
  if(view.action){const actionsRow=text(normal,'div','');actionsRow.style.cssText='display:flex;flex-wrap:wrap;gap:10px;margin:8px 0;';
   const b=text(actionsRow,'button',t('sync.easy.action.'+view.action));b.type='button';b.dataset.easyAction=view.action;b.disabled=busy||!!active;b.style.cssText='white-space:normal;height:auto;min-height:36px;max-width:100%;padding:6px 14px;';
   b.addEventListener('click',()=>void run(actions[view.action]));}
  // Current shared layout id is detail, not a normal-area decision.
  if(state.selected){const details=text(normal,'details','');text(details,'summary',t('sync.easy.current'));const p=text(details,'p',state.selected.vault+(state.selected.transport==='v2'?' · '+t('sync.readOnly'):''));p.style.overflowWrap='anywhere';}
 }
 const unsubscribe=host.subscribe(()=>render());render();
 return {render,state:()=>({busy,reviewOpen:!!active,lastError,status:section.querySelector('[data-easy-status]')?.dataset.easyStatus??null}),settled:()=>tail,close(){closed=true;active?.close();active=null;advancedPanel?.close();unsubscribe();section.remove();}};
}
