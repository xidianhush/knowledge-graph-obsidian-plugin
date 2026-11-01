// Local, bounded transactions over display coordinates. No host IO or persistent data.
function createLayoutEditor(nodes, rootRadius) {
  const byId = new Map(nodes.map(n => [n.id, n])), kids = new Map();
  for (const n of nodes) { if (!kids.has(n.parent)) kids.set(n.parent, []); kids.get(n.parent).push(n); }
  const roots=nodes.filter(n=>!byId.has(n.parent));
  // Fixed virtual container at the automatic layout origin. It is display-only;
  // no synthetic node, parent relation or radius is added to the graph payload.
  const enclosing=roots.reduce((r,n)=>Math.max(r,Math.hypot(n.x,n.y)+n.r),0);
  const root={x:0,y:0,r:Number.isFinite(rootRadius)&&rootRadius>0?rootRadius:enclosing*1.05};
  let tx = null;
  function valid(group, tolerance) {
    for (let i = 0; i < group.length; i++) {
      const a = group[i];
      if (!Number.isFinite(a.x + a.y) || Math.hypot(a.x, a.y) + a.r > 1 + tolerance) return false;
      for (let j = 0; j < i; j++) {
        const b = group[j];
        if (Math.hypot(a.x-b.x,a.y-b.y) < a.r+b.r-tolerance) return false;
      }
    }
    return true;
  }
  function begin(id) {
    if (tx) cancel();
    const node = byId.get(id);
    if (!node) return '元素已不存在';
    const parent = byId.get(node.parent) || root;
    const siblings = parent===root?roots:kids.get(parent.id);
    if (siblings.length > 128) return '此组超过 128 个元素，当前候选暂不支持调整';
    const group = siblings.map(n => ({id:n.id,x:(n.x-parent.x)/parent.r,y:(n.y-parent.y)/parent.r,r:n.r/parent.r}));
    // Payload rounding is in world units. Do not force a gap into tangent packing.
    const tolerance = Math.max(1e-8, 0.002 / parent.r);
    if (tolerance > 0.002 || !valid(group,tolerance)) return '此组初始几何不适合安全调整';
    const branches = new Map(), before = new Map();
    for (const sibling of siblings) {
      const stack=[sibling], branch=[];
      while(stack.length) {const n=stack.pop();branch.push(n);before.set(n.id,{x:n.x,y:n.y});stack.push(...(kids.get(n.id)||[]));}
      branches.set(sibling.id,branch);
    }
    if (before.size > 5000) return '此组子树超过 5000 个元素，当前候选暂不支持调整';
    tx={id,parent,group,initial:group.map(n=>({...n})),before,branches,tolerance};
    return null;
  }
  function move(x,y) {
    if (!tx) return false;
    const t=tx, target={x:(x-t.parent.x)/t.parent.r,y:(y-t.parent.y)/t.parent.r};
    const step=Math.min(0.015,...t.group.map(n=>n.r*.2));
    let blocked=false;
    for(let s=0;s<16;s++) {
      const active=t.group.find(n=>n.id===t.id),dx=target.x-active.x,dy=target.y-active.y,d=Math.hypot(dx,dy);
      if(d<1e-8)break;
      const candidate=t.group.map(n=>({...n})),a=candidate.find(n=>n.id===t.id),amount=Math.min(d,step);
      a.x+=dx/d*amount;a.y+=dy/d*amount;
      // Small tangent groups near the outer boundary need more alternating
      // projections. Keep the higher budget limited to small groups.
      for(let iter=0;iter<(candidate.length<=16?96:48);iter++) {
        for(const n of candidate) {const dist=Math.hypot(n.x,n.y),limit=1-n.r;if(dist>limit){n.x*=limit/dist;n.y*=limit/dist;}}
        for(let i=0;i<candidate.length;i++)for(let j=0;j<i;j++) {
          const p=candidate[i],q=candidate[j];let vx=q.x-p.x,vy=q.y-p.y,len=Math.hypot(vx,vy),over=p.r+q.r-len;
          if(over<=0)continue;if(len<1e-12){vx=1;vy=0;len=1;}
          const wp=p.id===t.id?.04:1,wq=q.id===t.id?.04:1;
          p.x-=vx/len*over*wp/(wp+wq);p.y-=vy/len*over*wp/(wp+wq);
          q.x+=vx/len*over*wq/(wp+wq);q.y+=vy/len*over*wq/(wp+wq);
        }
        if(valid(candidate,t.tolerance))break;
      }
      if(!valid(candidate,t.tolerance)){blocked=true;break;}
      const progress=Math.hypot(a.x-active.x,a.y-active.y);t.group=candidate;
      if(progress<1e-8){blocked=true;break;}
    }
    for(let i=0;i<t.group.length;i++) {
      const n=t.group[i],initial=t.initial[i],dx=(n.x-initial.x)*t.parent.r,dy=(n.y-initial.y)*t.parent.r;
      for(const child of t.branches.get(n.id)){const b=t.before.get(child.id);child.x=b.x+dx;child.y=b.y+dy;}
    }
    return blocked;
  }
  function cancel() {if(!tx)return false;for(const[id,p]of tx.before){const n=byId.get(id);n.x=p.x;n.y=p.y;}tx=null;return true;}
  return {begin,move,cancel,commit(){tx=null;},get active(){return !!tx;},get parent(){return tx?.parent;}};
}
