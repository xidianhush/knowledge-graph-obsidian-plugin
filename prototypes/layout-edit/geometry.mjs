// Synthetic prototype only. Positions are local to the parent, so subtrees move once.
export const clone = value => structuredClone(value);
export const GAP = 2;
export const PAD = 4;
export function scene(name = 'sparse') {
  const nodes = [{id:'root', parent:null, x:0, y:0, r:250, label:'知识领域'}];
  const dense = name === 'dense';
  let positions = [];
  if (dense) {
    for(let q=-2;q<=2;q++) for(let s=-2;s<=2;s++) {
      if(Math.abs(q+s)<=2) positions.push([96*(q+s/2),96*Math.sqrt(3)*s/2]);
    }
    positions.sort((a,b)=>Math.hypot(...a)-Math.hypot(...b));
  } else {
    positions = [[0,0],...Array.from({length:8},(_,i)=>[160*Math.cos(i*Math.PI/4),160*Math.sin(i*Math.PI/4)])];
  }
  positions.forEach(([x,y],i)=>nodes.push({id:'n'+i,parent:'root',x,y,
    r:dense?42+i%3: i===0?58:34+i%3*4,label:i===0?'整篇笔记':'笔记 '+i, hidden:i===3||i===6}));
  if(name==='boundary') {nodes[2].x=205; nodes[2].y=0;}
  for(let i=0;i<3;i++) nodes.push({id:'h'+i,parent:'n0',x:(i-1)*22,y:i===1?12:-10,r:9,label:['概念','推导','例题'][i]});
  return nodes;
}
export function world(nodes,id) {
  const n=nodes.find(n=>n.id===id); let x=n.x,y=n.y,p=n.parent;
  while(p) {const a=nodes.find(n=>n.id===p);x+=a.x;y+=a.y;p=a.parent;}
  return {...n,x,y};
}
export function validGroup(group,R,tolerance=1e-5) {
  for(let i=0;i<group.length;i++) {
    const a=group[i];
    if(!Number.isFinite(a.x+a.y+a.r)||Math.hypot(a.x,a.y)+a.r>R-PAD+tolerance)return false;
    for(let j=0;j<i;j++) {
      const b=group[j];
      if(Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r+GAP-tolerance)return false;
    }
  }
  return true;
}
export function validTree(nodes) {
  return nodes.every(p=>validGroup(nodes.filter(n=>n.parent===p.id),p.r));
}
function projectBoundary(n,R) {
  const d=Math.hypot(n.x,n.y),limit=R-PAD-n.r;
  if(d>limit) {n.x*=limit/d;n.y*=limit/d;}
}
// Each bounded microstep is either accepted whole or discarded whole.
export function move(nodes,id,target,maxSteps=16) {
  const node=nodes.find(n=>n.id===id);
  if(!node?.parent)return {nodes,blocked:true,steps:0};
  const parent=nodes.find(n=>n.id===node.parent);
  let group=nodes.filter(n=>n.parent===node.parent).map(n=>({...n}));
  if(!validGroup(group,parent.r))throw new Error('Invalid transaction baseline');
  let blocked=false,steps=0;
  for(;steps<maxSteps;steps++) {
    const active=group.find(n=>n.id===id);
    let dx=target.x-active.x,dy=target.y-active.y,dist=Math.hypot(dx,dy);
    if(dist<0.02)break;
    const amount=Math.min(3,dist);
    const candidate=group.map(n=>({...n}));
    const dragged=candidate.find(n=>n.id===id);
    dragged.x+=dx/dist*amount;dragged.y+=dy/dist*amount;
    for(let iter=0;iter<64;iter++) {
      candidate.forEach(n=>projectBoundary(n,parent.r));
      for(let i=0;i<candidate.length;i++)for(let j=0;j<i;j++) {
        const a=candidate[i],b=candidate[j];
        let vx=b.x-a.x,vy=b.y-a.y,d=Math.hypot(vx,vy),overlap=a.r+b.r+GAP-d;
        if(overlap<=0)continue;
        if(d<1e-9){vx=1;vy=0;d=1;}
        const wa=a.id===id?0.04:1,wb=b.id===id?0.04:1;
        a.x-=vx/d*overlap*wa/(wa+wb);a.y-=vy/d*overlap*wa/(wa+wb);
        b.x+=vx/d*overlap*wb/(wa+wb);b.y+=vy/d*overlap*wb/(wa+wb);
      }
      if(validGroup(candidate,parent.r))break;
    }
    if(!validGroup(candidate,parent.r)) {blocked=true;break;}
    const progress=Math.hypot(dragged.x-active.x,dragged.y-active.y);
    group=candidate;
    if(progress<0.01) {blocked=true;break;}
  }
  const positions=new Map(group.map(n=>[n.id,n]));
  return {nodes:nodes.map(n=>positions.get(n.id)||n),blocked,steps};
}
