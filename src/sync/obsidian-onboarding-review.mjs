import {renderObsidianLayoutPreview} from './obsidian-conflict-review.mjs';

// Previews do not mutate the graph, session, original data or transport.
export function openObsidianOnboardingReview({app,Modal,t,review,onConfirm,onCancel,onClosed}){
 class JoinModal extends Modal{
  onOpen(){
   this.modalEl.style.width='min(760px, calc(100vw - 24px))';
   this.contentEl.style.cssText='overflow-y:auto;max-height:80vh;';
   this.contentEl.createEl('h2',{text:t('receive.joinTitle')});
   this.contentEl.createEl('p',{text:t(review.choice?'receive.joinPending':'receive.joinIntro')});
   const cards=this.contentEl.createDiv();cards.style.cssText='display:flex;flex-wrap:wrap;gap:12px;';
   this.buttons=[];this.selected=null;
   for(const choice of ['import',...(review.current?['current']:[]),'shared']){
    const snapshot=choice==='import'?review.local:choice==='current'?review.current.snapshot:review.shared;
    const enabled=(!review.choice||review.choice===choice)&&(choice==='import'?review.canImport:choice==='current'?review.canCurrent:!!snapshot);
    const card=cards.createEl('button',{attr:{type:'button','data-join-choice':choice,'aria-pressed':'false'}});
    card.disabled=!enabled;card.style.cssText='display:block;flex:1 1 240px;height:auto;padding:12px;white-space:normal;text-align:left;border:2px solid var(--background-modifier-border);';
    card.createEl('strong',{text:t(choice==='import'?'receive.joinLocal':choice==='current'?'receive.joinCurrent':'receive.joinShared')});
    card.createEl('p',{text:t(choice==='import'?'receive.joinImportEffect':choice==='current'?'receive.joinCurrentEffect':'receive.joinSharedEffect')});
    if(choice==='current')card.createEl('p',{text:t('receive.joinCurrentCounts',{source:review.current.sourceGroups,current:Object.keys(snapshot.groups).length,archived:review.current.omittedGroups.length})});
    if(choice==='current'&&review.currentIssue==='history-not-empty')card.createEl('p',{text:t('receive.joinCurrentHistory')});
    if(choice==='import'&&review.current&&!review.canImport)card.createEl('p',{text:t('receive.joinOriginalBlocked')});
    else if(snapshot&&Object.keys(snapshot.groups).length){
     for(const [group,record] of Object.entries(snapshot.groups))renderObsidianLayoutPreview(card,{group,value:{record,structures:snapshot.structures}},t);
    }else card.createEl('p',{text:t(choice==='current'?'receive.joinCurrentEmpty':snapshot?'receive.joinEmpty':'receive.joinBlocked')});
    card.addEventListener('click',()=>{
     if(this.busy||!enabled)return;this.selected=choice;this.confirm.disabled=false;
     for(const button of this.buttons){const selected=button===card;button.setAttribute('aria-pressed',String(selected));button.style.borderColor=selected?'var(--interactive-accent)':'var(--background-modifier-border)';}
    });this.buttons.push(card);
   }
   if(review.current){
    const warning=this.contentEl.createEl('p',{text:t('receive.joinCurrentBackup')});warning.setAttribute('role','note');
    if(review.current.omittedGroups.length){
     const details=this.contentEl.createEl('details',{attr:{'data-join-archived':'true'}});details.createEl('summary',{text:t('receive.joinArchived',{count:review.current.omittedGroups.length})});
     const list=details.createEl('ul');
     for(const group of review.current.omittedGroups){let label=group;if(group==='root')label=t('receive.resolutionRoot');else try{const parts=JSON.parse(group);label=parts[1]+(parts[2]||'');}catch{}
      const li=list.createEl('li',{text:label});li.style.overflowWrap='anywhere';}
    }
   }
   this.contentEl.createEl('p',{text:t('receive.joinPreserve')});
   const actions=this.contentEl.createDiv();actions.style.cssText='display:flex;justify-content:flex-end;gap:12px;margin-top:16px;';
   const cancel=actions.createEl('button',{text:t(review.choice?'receive.resolutionClose':'receive.resolutionCancel'),attr:{'data-join-cancel':'true'}});
   cancel.addEventListener('click',()=>{if(!this.busy)this.close();});
   this.confirm=actions.createEl('button',{text:t(review.choice?'receive.joinRetry':'receive.joinConfirm'),cls:'mod-cta',attr:{'data-join-confirm':'true'}});
   this.confirm.disabled=true;
   this.confirm.addEventListener('click',async()=>{
    if(this.busy||!this.selected)return;this.busy=true;this.committed=true;this.confirm.disabled=true;cancel.disabled=true;
    try{await onConfirm(this.selected);}finally{this.close();}
   });
  }
  onClose(){if(!this.committed)onCancel();onClosed();this.contentEl.empty();}
 }
 const modal=new JoinModal(app);modal.open();return modal;
}
