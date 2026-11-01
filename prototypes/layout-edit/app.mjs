import {scene,clone,world,move,validTree} from './geometry.mjs';
const $=id=>document.getElementById(id),svg=$('graph'),NS='http://www.w3.org/2000/svg';
let nodes=scene(),baseline=clone(nodes),selected=null,editing=false,hidden=false;
let undo=[],redo=[],gesture=null,raf=0,camera={x:0,y:0,z:1},frameTimes=[];
function status(text){$('status').textContent=text;}
function el(tag,attrs,parent=svg){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;}
function draw(){
  const W=svg.clientWidth,H=svg.clientHeight;svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.replaceChildren();
  const scale=Math.min(W,H)/560*camera.z,g=el('g',{transform:`translate(${W/2+camera.x} ${H/2+camera.y}) scale(${scale})`});
  el('circle',{cx:0,cy:0,r:250,class:'container','data-id':'root'},g);
  const visible=nodes.filter(n=>n.id!=='root'&&!(hidden&&n.hidden));
  const edges=[['h0','n1'],['h1','n2'],['h2','n4'],['n1','n5'],['n2','n7']];
  for(const[a,b]of edges) {if(!visible.some(n=>n.id===a)||!visible.some(n=>n.id===b))continue;
    const p=world(nodes,a),q=world(nodes,b),d=Math.hypot(p.x-q.x,p.y-q.y),ux=(q.x-p.x)/d,uy=(q.y-p.y)/d;
    el('line',{x1:p.x+ux*p.r,y1:p.y+uy*p.r,x2:q.x-ux*q.r,y2:q.y-uy*q.r,class:'edge','data-edge':a+'-'+b},g);
  }
  for(const n of visible){const p=world(nodes,n.id);
    const c=el('circle',{cx:p.x,cy:p.y,r:p.r,class:'node'+(selected===n.id?' selected':'')+(gesture?.dragging&&gesture.id===n.id?' active':''),'data-id':n.id},g);
    const title=el('title',{},c);title.textContent=n.label;
    const t=el('text',{x:p.x,y:p.y+(n.id==='n0'?-p.r+17:n.parent==='n0'?n.r+15:4),'text-anchor':'middle'},g);t.textContent=n.label;
  }
  const n=nodes.find(n=>n.id===selected);
  if(editing&&n?.parent&&nodes.some(c=>c.parent===n.id)){
    const p=world(nodes,n.id);el('line',{x1:p.x,y1:p.y-p.r,x2:p.x,y2:p.y-p.r-17,stroke:'#d4e8f5'},g);
    const h=el('circle',{cx:p.x,cy:p.y-p.r-19,r:10,class:'handle','data-handle':n.id},g);el('title',{},h).textContent='拖动整篇笔记';
  }
  $('parent').disabled=!n?.parent||!!gesture;$('undo').disabled=!undo.length||!!gesture;$('redo').disabled=!redo.length||!!gesture;
  $('reset').disabled=!editing||!n?.parent||!!gesture;
  $('selected').textContent=n?`${n.label}${n.id==='root'?' · 根级暂不开放移动':''}`:'未选中';
  svg.style.cursor=gesture?.dragging?'grabbing':editing?'crosshair':'grab';
}
function point(e){const r=svg.getBoundingClientRect(),s=Math.min(r.width,r.height)/560*camera.z;return{x:(e.clientX-r.left-r.width/2-camera.x)/s,y:(e.clientY-r.top-r.height/2-camera.y)/s};}
function stop(){cancelAnimationFrame(raf);raf=0;}
function cancel(message='已取消，整组恢复拖动前位置'){
  stop();if(gesture){if(gesture.before)nodes=gesture.before;else if(gesture.camera)camera=gesture.camera;const id=gesture.pointer;gesture=null;if(svg.hasPointerCapture(id))svg.releasePointerCapture(id);status(message);draw();}
}
function tick(){
  raf=0;if(!gesture?.dragging)return;
  const start=performance.now(),n=nodes.find(n=>n.id===gesture.id),t=gesture.target;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const next={x:n.x+(t.x-n.x)*(reduced?1:.65),y:n.y+(t.y-n.y)*(reduced?1:.65)};
  const previous={x:n.x,y:n.y};const result=move(nodes,n.id,next,12);nodes=result.nodes;
  const actual=nodes.find(a=>a.id===n.id);const moved=Math.hypot(actual.x-previous.x,actual.y-previous.y);
  const distance=Math.hypot(actual.x-t.x,actual.y-t.y);
  const limited=result.blocked||(moved<.025&&distance>.1);
  status(limited?'这里放不下：已停在有效位置，可换个方向':'拖动中 · 同组让位 · Esc 取消');draw();
  frameTimes.push(performance.now()-start);if(frameTimes.length>1000)frameTimes.shift();
  if(!limited&&distance>.1)raf=requestAnimationFrame(tick);
}
svg.addEventListener('pointerdown',e=>{
  if(e.button!==0||gesture)return;e.preventDefault();svg.focus();
  const id=e.target.getAttribute('data-handle')||e.target.getAttribute('data-id');const n=nodes.find(n=>n.id===id);
  const p=point(e);selected=n?.id||null;
  gesture={pointer:e.pointerId,id:editing&&n?.parent?id:null,startX:e.clientX,startY:e.clientY,camera:{...camera},before:editing&&n?.parent?clone(nodes):null,dragging:false,offset:n?{x:p.x-world(nodes,n.id).x,y:p.y-world(nodes,n.id).y}:null};
  svg.setPointerCapture(e.pointerId);draw();
});
svg.addEventListener('pointermove',e=>{
  if(!gesture||e.pointerId!==gesture.pointer)return;
  const dx=e.clientX-gesture.startX,dy=e.clientY-gesture.startY;
  if(!gesture.dragging&&Math.hypot(dx,dy)<5)return;
  gesture.dragging=true;
  if(!gesture.id){camera.x=gesture.camera.x+dx;camera.y=gesture.camera.y+dy;draw();return;}
  const n=nodes.find(n=>n.id===gesture.id),parent=world(nodes,n.parent),p=point(e);
  gesture.target={x:p.x-parent.x-gesture.offset.x,y:p.y-parent.y-gesture.offset.y};
  if(!raf)raf=requestAnimationFrame(tick);
});
svg.addEventListener('pointerup',e=>{
  if(!gesture||e.pointerId!==gesture.pointer)return;
  if(gesture.id&&gesture.dragging){stop();tick();stop();if(JSON.stringify(nodes)!==JSON.stringify(gesture.before)){undo.push(gesture.before);redo=[];}status('本次调整已提交 · 仅保留在页面会话');}
  const id=gesture.pointer;gesture=null;stop();if(svg.hasPointerCapture(id))svg.releasePointerCapture(id);draw();
});
svg.addEventListener('pointercancel',()=>cancel());svg.addEventListener('lostpointercapture',()=>{if(gesture)cancel();});
window.addEventListener('blur',()=>cancel());document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});window.addEventListener('pagehide',()=>cancel());
window.addEventListener('pointerout',e=>{if(!e.relatedTarget&&gesture&&(e.clientX<=0||e.clientY<=0||e.clientX>=innerWidth||e.clientY>=innerHeight))cancel('指针离开窗口，已取消本次拖动');});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(gesture||document.activeElement===svg)){e.preventDefault();e.stopPropagation();if(gesture)cancel();else{selected=null;draw();}}});
svg.addEventListener('wheel',e=>{e.preventDefault();if(gesture)return;const p=point(e),old=camera.z;camera.z=Math.max(.5,Math.min(3,old*Math.exp(-e.deltaY*.001)));const s=Math.min(svg.clientWidth,svg.clientHeight)/560;camera.x-=p.x*s*(camera.z-old);camera.y-=p.y*s*(camera.z-old);draw();},{passive:false});
$('mode').onclick=()=>{cancel();editing=!editing;$('mode').setAttribute('aria-pressed',editing);$('mode').textContent='调整布局：'+(editing?'开':'关');status(editing?'拖圆移动，拖空白平移；选父级后可拖手柄':'阅读模式：拖空白平移，滚轮缩放');draw();};
$('scene').onchange=()=>{cancel();nodes=scene($('scene').value);baseline=clone(nodes);selected=null;undo=[];redo=[];camera={x:0,y:0,z:1};status('已切换合成场景');draw();};
$('hide').onchange=()=>{cancel();hidden=$('hide').checked;if(hidden&&nodes.find(n=>n.id===selected)?.hidden)selected=null;status(hidden?'两篇笔记已隐藏，仍参与避让':'显示所有笔记');draw();};
$('parent').onclick=()=>{selected=nodes.find(n=>n.id===selected)?.parent||selected;draw();};
$('undo').onclick=()=>{if(undo.length&&!gesture){redo.push(clone(nodes));nodes=undo.pop();status('已撤销整组调整');draw();}};
$('redo').onclick=()=>{if(redo.length&&!gesture){undo.push(clone(nodes));nodes=redo.pop();status('已重做整组调整');draw();}};
$('reset').onclick=()=>{const n=nodes.find(n=>n.id===selected);if(!n?.parent)return;undo.push(clone(nodes));redo=[];nodes=nodes.map(a=>a.parent===n.parent?{...a,x:baseline.find(b=>b.id===a.id).x,y:baseline.find(b=>b.id===a.id).y}:a);status('已恢复此组，子组的局部调整保留');draw();};
$('home').onclick=()=>{cancel();camera={x:0,y:0,z:1};draw();};
new ResizeObserver(()=>{cancel('视图尺寸变化，已取消当前拖动');draw();}).observe(svg);
// Read-only diagnostic snapshot for repeatable tests of this synthetic prototype.
window.layoutPrototype={snapshot:()=>clone({nodes,selected,editing,hidden,camera,undo:undo.length,redo:redo.length,active:!!gesture,valid:validTree(nodes),frameTimes})};
draw();
