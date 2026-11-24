import {renderObsidianLayoutPreview} from './obsidian-conflict-review.mjs';
export function openHistoricalLayoutReview({app,Modal,t,review,onConfirm,onCancel,onClosed}){
 class HistoricalModal extends Modal{
  onOpen(){
   const root=this.contentEl,doc=root.ownerDocument,selected=new Set();
   this.modalEl.style.width='min(1100px, calc(100vw - 24px))';root.style.cssText='max-height:80vh;overflow-y:auto;overflow-wrap:anywhere;';
   const text=(parent,tag,value)=>{const el=doc.createElement(tag);el.textContent=value;parent.append(el);return el;};
   text(root,'h2',t('sync.historicalTitle'));text(root,'p',t('sync.historicalEffect'));
   for(const row of review.rows){
    const card=text(root,'section','');card.dataset.historicalGroup=row.group;card.style.cssText='border:1px solid var(--background-modifier-border);padding:12px;margin:12px 0;border-radius:8px;';
    const label=text(card,'label',''),input=doc.createElement('input');input.type='checkbox';input.disabled=row.status==='unavailable';input.dataset.historicalSelect=row.group;label.append(input);
    let name=row.group;try{name=JSON.parse(row.group)[1]||t('receive.resolutionRoot');}catch{/* Untrusted labels remain text. */}
    text(label,'strong',name);text(card,'p',t('sync.historical.'+row.status));
    if(row.reason)text(card,'p',row.reason);
    if(row.status==='adjusted')text(card,'p',t('sync.historicalMoved',{count:row.moved,distance:(row.maxDisplacement*100).toFixed(3)}));
    const columns=text(card,'div','');columns.style.cssText='display:flex;flex-wrap:wrap;gap:12px;';
    for(const [key,snapshot]of [['sync.historicalOld',row.source],['sync.historicalNow',row.current],['sync.historicalProposed',row.target]]){
     const col=text(columns,'div','');col.style.cssText='flex:1 1 240px;min-width:0;';text(col,'h3',t(key));
     if(snapshot){const record=snapshot.groups[row.group];renderObsidianLayoutPreview(col,{group:row.group,value:{record,structures:snapshot.structures}},t);}else text(col,'p',t('sync.historicalNoPreview'));
    }
    input.addEventListener('change',()=>{if(input.checked)selected.add(row.group);else selected.delete(row.group);confirm.disabled=!selected.size;});
   }
   if(!review.rows.length)text(root,'p',t('sync.historicalEmpty'));
   const actions=text(root,'div','');actions.style.cssText='display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap;';
   const cancel=text(actions,'button',t('sync.cancel'));cancel.type='button';cancel.dataset.historicalCancel='true';cancel.onclick=()=>{if(!this.committing)this.close();};
   const confirm=text(actions,'button',t('sync.historicalConfirm'));confirm.type='button';confirm.disabled=true;confirm.dataset.historicalConfirm='true';
   confirm.onclick=async()=>{if(this.committing||!selected.size)return;this.committing=true;this.committed=true;for(const b of root.querySelectorAll('button,input'))b.disabled=true;try{await onConfirm([...selected]);}finally{this.close();}};
  }
  onClose(){if(!this.committed)onCancel();this.contentEl.replaceChildren();onClosed();}
 }
 const modal=new HistoricalModal(app);modal.open();return modal;
}
