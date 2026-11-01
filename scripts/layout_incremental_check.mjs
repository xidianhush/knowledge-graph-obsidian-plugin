import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
const text='# A\n## One\none\n## Two\ntwo\n# B\n## Three\nthree\n## Four\nfour';
const files=['A','B','C'].map(n=>({path:`Demo/${n}.md`,text}));
const build=f=>buildGraph({files:f,config:{include:['**']}});
const make=g=>createLayoutModel(g.nodes,g.meta.layout_root_radius);
const g=build(files),m=make(g),editor=createLayoutEditor(g.nodes,g.meta.layout_root_radius),records={};
for(const id of ['Demo/A#A/One','Demo/A#B/Three','Demo/A#B','Demo/B#A/One','Demo/A']){
  const n=g.nodes.find(n=>n.id===id);assert.equal(editor.begin(id),null);editor.move(n.x+12,n.y+8);editor.commit();
  const key=m.groupKey(id);records[key]=m.capture(key);assert.ok(records[key]);
}
const cases=[['add sibling',text.replace('## Two','## New\nnew\n## Two')],['delete sibling',text.replace('## One\none\n','')],
 ['add top heading',text+'\n# Added\nbody'],['delete top branch',text.slice(0,text.indexOf('# B'))]];
const results=[];
function geometry(graph){
 const byId=new Map(graph.nodes.map(n=>[n.id,n]));
 for(const n of graph.nodes){const p=byId.get(n.parent)||{x:0,y:0,r:graph.meta.layout_root_radius};assert.ok(Math.hypot(n.x-p.x,n.y-p.y)+n.r<=p.r+.0021);
 for(const q of graph.nodes)if(q.id<n.id && q.parent===n.parent)assert.ok(Math.hypot(n.x-q.x,n.y-q.y)>=n.r+q.r-.0021);}
}
for(const [name,updated] of cases){
 const next=build(files.map((f,i)=>i?f:{...f,text:updated})),model=make(next);
 let disk;const store=createLayoutStore({schemaVersion:1,revision:1,groups:records},async d=>{disk=d;});
 const start=performance.now();await store.reconcile(model);const report=model.apply(store.state().groups),ms=performance.now()-start;
 geometry(next);assert.ok(report.restored>=3,name);
 const sideKey=m.groupKey('Demo/B#A/One'),old=records[sideKey],fresh=store.state().groups[sideKey];
 assert.deepEqual(fresh.points,old.points,`${name}: untouched note local positions`);
 const reload=build(files.map((f,i)=>i?f:{...f,text:updated}));make(reload).apply(JSON.parse(JSON.stringify(disk||store.state())).groups);
 next.nodes.forEach((n,i)=>assert.ok(Math.hypot(n.x-reload.nodes[i].x,n.y-reload.nodes[i].y)<1e-7));
 const arranged=next.nodes.map(n=>[n.x,n.y]);await store.command({},'reset-all');model.apply(store.state().groups);
 const auto=build(files.map((f,i)=>i?f:{...f,text:updated}));assert.deepEqual(next.nodes.map(n=>[n.x,n.y]),auto.nodes.map(n=>[n.x,n.y]));
 await store.command({},'undo');model.apply(store.state().groups);assert.deepEqual(next.nodes.map(n=>[n.x,n.y]),arranged);
 results.push({name,report,ms,repairs:Object.values(disk?.groups||{}).filter(r=>r.repair).map(r=>r.repair)});
}
// Explicit file deletion keeps the surviving note siblings available for repair.
const store=createLayoutStore({schemaVersion:1,revision:1,groups:records},async()=>{});
await store.changePath('Demo/A.md',null,false);const remaining=build(files.slice(1)),rm=make(remaining);
await store.reconcile(rm);assert.equal(rm.apply(store.state().groups).skipped,0);geometry(remaining);
results.push({name:'file deletion preserves surviving groups'});
// A failed solve leaves the original record intact for recovery, never unsafe geometry.
const bad=structuredClone(records);Object.values(bad)[0].points[0].x=NaN;
const changed=build(files.map((f,i)=>i?f:{...f,text:text+'\n# New'})),cm=make(changed);
const repaired=cm.reconcile(bad);assert.ok(cm.apply(repaired).skipped>0);geometry(changed);
results.push({name:'invalid saved coordinates safely rejected'});
// Fixed-size synthetic note circles isolate placement from pipeline rescaling.
const base=[{id:'P',kind:'folder',x:0,y:0,r:100,depth:1},
 {id:'P/A',path:'P/A.md',parent:'P',kind:'note',x:-25,y:0,r:10,depth:2},
 {id:'P/B',path:'P/B.md',parent:'P',kind:'note',x:25,y:0,r:10,depth:2}];
const bm=createLayoutModel(base,200);base[1].y=15;base[2].y=15;
const bk=bm.groupKey('P/A'),br={[bk]:bm.capture(bk)};
for(const [name,nodes] of [
 ['free-space insertion',[...structuredClone(base),{id:'P/C',path:'P/C.md',parent:'P',kind:'note',x:0,y:-25,r:10,depth:2}]],
 ['deletion leaves gap',structuredClone(base).slice(0,2)],
]){
 const mm=createLayoutModel(nodes,200),rr=mm.reconcile(br);assert.equal(mm.apply(rr).skipped,0);
 assert.equal(nodes[1].x,-25);assert.equal(nodes[1].y,15);
 if(nodes[2]?.id==='P/B'){assert.equal(nodes[2].x,25);assert.equal(nodes[2].y,15);}
 results.push({name,keptCenters:true});
}
const impossible=structuredClone(base);impossible[1].r=101;
const im=createLayoutModel(impossible,200),ir=im.reconcile(br);
assert.deepEqual(ir.groups,br);assert.equal(im.apply(ir).skipped,1);results.push({name:'infeasible group keeps old record and falls back'});
const many=[base[0],...Array.from({length:129},(_,i)=>({id:'P/'+i,path:'P/'+i+'.md',parent:'P',kind:'note',x:i%10,y:Math.floor(i/10),r:.1,depth:2}))];
const large=createLayoutModel(many,200);assert.deepEqual(large.reconcile(br).groups,br);results.push({name:'over 128 children declines repair'});
const huge=[...structuredClone(base),{id:'P/C',path:'P/C.md',parent:'P',kind:'note',x:0,y:-25,r:10,depth:2},
 ...Array.from({length:5000},(_,i)=>({id:'P/A/'+i,parent:'P/A',kind:'folder',x:0,y:0,r:.01,depth:3}))];
assert.deepEqual(createLayoutModel(huge,200).reconcile(br).groups,br);results.push({name:'over 5000 affected nodes declines repair'});
const dense=[{id:'Q',kind:'folder',x:0,y:0,r:100,depth:1},...Array.from({length:128},(_,i)=>({id:'Q/'+i,path:'Q/'+i+'.md',parent:'Q',kind:'note',x:(i%16-7.5)*5,y:(Math.floor(i/16)-3.5)*5,r:1,depth:2}))];
const dm=createLayoutModel(dense,200);dense[1].y+=1;const dk=dm.groupKey('Q/0'),dr={[dk]:dm.capture(dk)};
const grown=structuredClone(dense);grown.slice(1).forEach(n=>n.r=8);
const startDense=performance.now(),denseModel=createLayoutModel(grown,200),denseRecords=denseModel.reconcile(dr);
results.push({name:'128 circle bounded repair',ms:performance.now()-startDense,fallback:denseModel.apply(denseRecords).skipped>0});
fs.mkdirSync('.local/evidence/layout-incremental',{recursive:true});
fs.writeFileSync('.local/evidence/layout-incremental/core.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results));
