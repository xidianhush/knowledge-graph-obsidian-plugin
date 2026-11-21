// Native Obsidian modal; preview renders isolated normalized group snapshots.
// It never applies preview geometry to the live graph or writes a sync file.
export function renderObsidianLayoutPreview(parent,change,t){
 const doc=parent.ownerDocument;
 const svgElement=(name,attrs)=>{const el=doc.createElementNS('http://www.w3.org/2000/svg',name);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));return el;};
  const group=change.group==='root'?'root':JSON.parse(change.group),caption=doc.createElement('p');caption.textContent=group==='root'?t('receive.resolutionRoot'):group[1];parent.append(caption);
  if(!change.value){const text=doc.createElement('p');text.textContent=t('receive.resolutionAuto');parent.append(text);return;}
  const {record,structures}=change.value,points=record.points,shape=new Map(record.shape.map(row=>[row.id,row.r]));
  const labels=new Map(Object.values(structures).flat().map(row=>[row.key,row.title]));
  let extent=1;
  for(const point of points)extent=Math.max(extent,Math.abs(point.x)+shape.get(point.id),Math.abs(point.y)+shape.get(point.id));
  extent*=1.12;
  const svg=svgElement('svg',{viewBox:[-extent,-extent,extent*2,extent*2].join(' '),width:'100%',height:'190',role:'img','aria-label':caption.textContent});
  svg.append(svgElement('circle',{cx:0,cy:0,r:1,fill:'#183a46',stroke:'#5e8695','stroke-width':0.012}));
  for(const point of points){
   svg.append(svgElement('circle',{cx:point.x,cy:point.y,r:shape.get(point.id),fill:'#508bb2',stroke:'#acd3e3','stroke-width':0.014}));
   const text=svgElement('text',{x:point.x,y:point.y,'text-anchor':'middle','dominant-baseline':'middle',fill:'white','font-size':0.14});
   const key=JSON.parse(point.id);text.textContent=labels.get(point.id)??key[1].split('/').at(-1);svg.append(text);
  }
  parent.append(svg);
}
export function openObsidianConflictReview({app,Modal,t,review,pending=false,onConfirm,onCancel,onClosed}){
 class ReviewModal extends Modal{
  onOpen(){
   this.modalEl.style.width='min(760px, calc(100vw - 24px))';this.contentEl.style.overflowY='auto';this.contentEl.style.maxHeight='80vh';
   this.contentEl.createEl('h2',{text:t('receive.resolutionTitle')});
   const combinations=review.choices.some(choice=>(choice.sourceHeads?.length??0)>1);
   this.contentEl.createEl('p',{text:t(pending?'receive.resolutionPending':combinations?'receive.resolutionCombinations':'receive.resolutionIntro')});
   this.selected=pending?review.choices[0].id:null;
   this.buttons=[];
   const cards=this.contentEl.createDiv();cards.style.display='flex';cards.style.flexWrap='wrap';cards.style.gap='12px';
   for(const [i,choice] of review.choices.entries()){
    const card=cards.createEl('button',{attr:{type:'button','data-resolution-choice':choice.id,'aria-pressed':String(this.selected===choice.id)}});
    card.disabled=choice.compatible===false;
    card.style.cssText='display:block;flex:1 1 240px;height:auto;padding:12px;white-space:normal;text-align:left;border:2px solid var(--background-modifier-border);';
    card.createEl('strong',{text:t(pending?'receive.resolutionConfirmed':combinations?'receive.resolutionCombination':choice.isLocal?'receive.resolutionLocal':'receive.resolutionOther',{number:i+1})});
    if(choice.compatible===false)card.createEl('p',{text:t('receive.resolutionIncompatible')});
    for(const change of choice.changes)renderObsidianLayoutPreview(card,change,t);
    card.addEventListener('click',()=>{
     if(this.busy||card.disabled)return;this.selected=choice.id;
     for(const button of this.buttons){const selected=button===card;button.setAttribute('aria-pressed',String(selected));button.style.borderColor=selected?'var(--interactive-accent)':'var(--background-modifier-border)';}
     this.confirm.disabled=false;
    });
    this.buttons.push(card);
   }
   this.contentEl.createEl('p',{text:t('receive.resolutionPreserve')});
   const actions=this.contentEl.createDiv();actions.style.cssText='display:flex;justify-content:flex-end;gap:12px;margin-top:16px;';
   const cancel=actions.createEl('button',{text:t(pending?'receive.resolutionClose':'receive.resolutionCancel'),attr:{'data-resolution-cancel':'true'}});
   cancel.addEventListener('click',()=>{if(!this.busy)this.close();});
   this.confirm=actions.createEl('button',{text:t(pending?'receive.resolutionRetry':'receive.resolutionConfirm'),cls:'mod-cta',attr:{'data-resolution-confirm':'true'}});
   this.confirm.disabled=!this.selected;
   this.confirm.addEventListener('click',async()=>{
    if(this.busy||!this.selected)return;
    this.busy=true;this.committed=true;this.confirm.disabled=true;cancel.disabled=true;
    try{await onConfirm(this.selected);}finally{this.close();}
   });
  }
  onClose(){if(!this.committed)onCancel();onClosed();this.contentEl.empty();}
 }
 const modal=new ReviewModal(app);modal.open();return modal;
}
