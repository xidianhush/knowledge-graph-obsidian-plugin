// Both worker and cooperative fallback consume exactly the same operations.
function kgDrainPipelineSteps(steps) {
  let result; do { result=steps.next(); } while(!result.done); return result.value;
}
const KG_NOMINAL_FIT_RADIUS = (900 - 46) / 2;
function kgPlace(a,b,c) {
  const ax=a.x,ay=a.y,da=b.r+c.r,db=a.r+c.r,dx=b.x-ax,dy=b.y-ay,dc=dx*dx+dy*dy;
  if(dc){const da2=da*da,db2=db*db,x=.5+(db2-da2)/(2*dc),db3=db2-dc;
    const y=Math.sqrt(Math.max(0,2*da2*(db2+dc)-db3*db3-da2*da2))/(2*dc);
    c.x=ax+x*dx+y*dy;c.y=ay+x*dy-y*dx;
  } else {c.x=ax+db;c.y=ay;}
}
function kgIntersects(a,b){const dx=b.x-a.x,dy=b.y-a.y,dr=a.r+b.r;return dr*dr-1e-6>dx*dx+dy*dy;}
function* kgEncloseSteps(disks) {
  const n=disks.length;if(!n)return[0,0,0];if(n===1)return[disks[0].x,disks[0].y,disks[0].r];
  if(n===2){const[p,q]=disks,dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy),R=(d+p.r+q.r)/2;
    if(d<=1e-12)return[p.x,p.y,R];const t=(R-p.r)/d;return[p.x+t*dx,p.y+t*dy,R];}
  const sum=(fn)=>disks.reduce((v,d)=>v+fn(d),0),total=sum(d=>d.r*d.r)||1;
  let cx=sum(d=>d.x*d.r*d.r)/total,cy=sum(d=>d.y*d.r*d.r)/total;
  const extent=(x,y)=>disks.reduce((r,d)=>Math.max(r,Math.hypot(d.x-x,d.y-y)+d.r),0);
  let R=extent(cx,cy);
  for(let i=0;i<12;i++){
    yield;
    let far=disks[0],farR=-Infinity;for(const d of disks){yield;const r=Math.hypot(d.x-cx,d.y-cy)+d.r;if(r>farR){far=d;farR=r;}}
    let best=[R,cx,cy];for(const step of [.5,.25,.125,.0625]){const nx=cx+(far.x-cx)*step,ny=cy+(far.y-cy)*step,cand=extent(nx,ny);if(cand<best[0]-1e-12)best=[cand,nx,ny];}
    if(best[0]>=R-1e-12)break;[R,cx,cy]=best;
  }
  return[cx,cy,R];
}
function packGraphSiblings(radii) { return kgDrainPipelineSteps(packGraphSiblingSteps(radii)); }
function* packGraphSiblingSteps(radii) {
  const n=radii.length;if(!n)return[[],0];
  const C=radii.map(r=>({x:0,y:0,r}));if(n===1)return[[[0,0]],C[0].r];
  C[0].x=-C[1].r;C[1].x=C[0].r;
  if(n>2){
    kgPlace(C[1],C[0],C[2]);
    const next=Array(n).fill(0),prev=Array(n).fill(0);
    [next[0],prev[0],next[1],prev[1],next[2],prev[2]]=[1,2,2,0,0,1];
    let ai=0,bi=1,i=3,guard=0;
    while(i<n && guard<64*n+64){
      yield;guard++;const c=C[i];kgPlace(C[ai],C[bi],c);
      let j=next[bi],k=prev[ai],sj=C[bi].r,sk=C[ai].r,collided=false;
      while(true){
        yield;
        if(sj<=sk){if(kgIntersects(C[j],c)){bi=j;next[ai]=bi;prev[bi]=ai;collided=true;break;}sj+=C[j].r;j=next[j];}
        else{if(kgIntersects(C[k],c)){ai=k;next[ai]=bi;prev[bi]=ai;collided=true;break;}sk+=C[k].r;k=prev[k];}
        if(j===next[k])break;
      }
      if(collided)continue;
      prev[i]=ai;next[i]=bi;next[ai]=i;prev[bi]=i;bi=i;i++;
    }
    if(i<n)throw new Error('Circle packing did not converge');
  }
  const[cx,cy,R]=yield* kgEncloseSteps(C);return[C.map(p=>[p.x-cx,p.y-cy]),R];
}
function* layoutGraphSteps(nodes,cfg,maxDepth) {
  const l=cfg.layout,leaf=l.leaf_radius,ratio=l.level_ratio,padding=l.padding,power=l.size_exponent,norm=l.norm_root_radius;
  const angle=l.start_angle*Math.PI/180,minPx=cfg.lod.min_px,children=new Map(),roots=[];
  for(const[id,node]of nodes){yield;if(node.parent==null||!nodes.has(node.parent))roots.push(id);else{if(!children.has(node.parent))children.set(node.parent,[]);children.get(node.parent).push(id);}}
  const key=id=>{const n=nodes.get(id),order=n.kind==='folder'?0:1;return n.kind==='heading'?[order,0,n.line||0,n.label]:[order,-(n.note_count||0),0,n.label];};
  const compare=(a,b)=>{const x=key(a),y=key(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]-y[i];return kgCompare(x[3],y[3]);};
  for(const kids of children.values())kids.sort(compare);roots.sort(compare);
  const leaves=new Map(),radius=new Map(),pos=new Map();
  // Iterative postorder avoids JS call-stack limits on long folder chains.
  const stack=roots.map(id=>[id,false]),visiting=new Set();
  while(stack.length){yield;const[id,done]=stack.pop(),kids=children.get(id)||[];
    if(done){leaves.set(id,kids.length?kids.reduce((s,k)=>s+leaves.get(k),0):1);visiting.delete(id);continue;}
    if(visiting.has(id))throw new Error('Cycle in graph hierarchy: '+id);
    visiting.add(id);stack.push([id,true]);for(let i=kids.length-1;i>=0;i--)stack.push([kids[i],false]);
  }
  if(leaves.size!==nodes.size)throw new Error('Unreachable or cyclic graph hierarchy');
  function* assign(id,x,y,allocated){
    const work=[[id,x,y,allocated]];
    while(work.length){yield;const[nid,nx,ny,r]=work.pop();radius.set(nid,r);pos.set(nid,[nx,ny]);const kids=children.get(nid)||[];if(!kids.length)continue;
      const targets=kids.map(k=>leaves.get(k)**power),[positions,enc]=yield* packGraphSiblingSteps(targets),biggest=targets.reduce((m,v)=>Math.max(m,v),0);
      const s=enc>0&&biggest>0?Math.min(r/(enc*padding),r/(biggest*ratio)):1;
      for(let i=kids.length-1;i>=0;i--)work.push([kids[i],nx+positions[i][0]*s,ny+positions[i][1]*s,targets[i]*s]);
    }
  }
  const targets=roots.map(r=>leaves.get(r)**power),[rootPositions,enc]=yield* packGraphSiblingSteps(targets);
  let rootRadius=targets.length?enc*padding:leaf;const scale=rootRadius>0?norm/rootRadius:1;
  for(const [i,r]of roots.entries())yield* assign(r,rootPositions[i][0]*scale,rootPositions[i][1]*scale,targets[i]*scale);rootRadius*=scale;
  const minR=radius.size?[...radius.values()].reduce((a,b)=>Math.min(a,b),Infinity):1;
  const digits=minR<.01?Math.min(9,3+Math.ceil(-Math.log10(minR))-1):3;
  const cos=Math.cos(angle),sin=Math.sin(angle),byDepth=new Map();
  for(const[id,node]of nodes){yield;const[x,y]=pos.get(id)||[0,0];node.x=kgRound(x*cos-y*sin,digits);node.y=kgRound(-(x*sin+y*cos),digits);node.r=Math.max(kgRound(radius.get(id)||leaf*scale,4),1e-4);
    if(!byDepth.has(node.depth))byDepth.set(node.depth,[]);byDepth.get(node.depth).push(id);}
  const median=arr=>!arr.length?0:arr.length%2?arr[Math.floor(arr.length/2)]:(arr[arr.length/2-1]+arr[arr.length/2])/2;
  const layers=[];
  for(let depth=1;depth<=maxDepth;depth++){yield;const members=byDepth.get(depth)||[],rs=members.map(id=>nodes.get(id).r).sort((a,b)=>a-b),mz=rs.map(r=>minPx/Math.max(r,1e-9)).sort((a,b)=>a-b);
    layers.push({depth,count:members.length,r_min:kgRound(rs[0]||0,4),r_median:kgRound(median(rs),4),r_max:kgRound(rs.at(-1)||0,4),minzoom_median:kgRound(median(mz),6)});}
  const fade=cfg.lod.fade_span,ceiling=cfg.zoom.zoom_in_ceiling,floor=cfg.zoom.zoom_out_floor;
  const homeLevel=Math.max(1,Math.min(cfg.zoom.home_level,maxDepth)),band=Math.min(1,Math.max(0,cfg.zoom.home_band));
  const allR=[...nodes.values()].map(n=>n.r).filter(r=>r>0),rootR=(byDepth.get(1)||[]).map(id=>nodes.get(id).r).filter(r=>r>0);
  const minimum=values=>values.reduce((a,b)=>Math.min(a,b),Infinity);
  const hi=allR.length?minPx/minimum(allR)*ceiling:1,lo=minPx/minimum(rootR.length?rootR:allR.length?allR:[1])*floor;
  const fit=rootRadius>0?KG_NOMINAL_FIT_RADIUS/rootRadius*cfg.zoom.home_fit:lo,steps=maxDepth-homeLevel,rungMin=fade*1.02;
  const anchorByFit=fit*fade/(1+band*(fade-1)),cap=steps>0?hi/rungMin**steps:hi,anchorFloor=Math.min(lo*rungMin**(homeLevel-1),cap);
  const anchor=Math.min(Math.max(anchorByFit,anchorFloor),cap);let rung=steps>0&&anchor>0?(hi/anchor)**(1/steps):rungMin;rung=Math.max(rung,rungMin);
  const mature=Array.from({length:maxDepth},(_,i)=>anchor*rung**(i+1-homeLevel));if(mature.length)mature[0]=Math.min(mature[0],lo);
  const enter=mature.map(m=>m/fade),homeZoom=enter[homeLevel-1]+band*(mature[homeLevel-1]-enter[homeLevel-1]);
  let homeLayer=1;enter.forEach((e,i)=>{if(e<=homeZoom)homeLayer=i+1;});
  const targetSteps=Math.max(20,Math.min(48,kgRound(6*(maxDepth-1)+8))),span=lo>0?hi/lo:1;
  const wheelStep=Math.min(1.6,Math.max(1.02,span<=1?1.05:span**(1/targetSteps)));
  return{layers,enter,homeLayer,rootRadius,wheelStep,homeZoom};
}
