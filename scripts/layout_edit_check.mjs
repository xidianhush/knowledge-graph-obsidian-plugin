import assert from 'node:assert/strict';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutEditor} from '../dist/graph-core.mjs';
const files=Array.from({length:12},(_,i)=>({path:`Demo/Note${i}.md`,text:`# First\n## Child\nbody [[Note${(i+1)%12}]]\n# Second\n## Last\ntext`}));
const graph=buildGraph({files,config:{include:['**']}}),nodes=graph.nodes;
const source=JSON.stringify(nodes),editor=createLayoutEditor(nodes,graph.meta.layout_root_radius),byId=new Map(nodes.map(n=>[n.id,n]));
let tested=0,moved=0;
for(const node of nodes.filter(n=>n.parent)) {
  const before=nodes.map(n=>[n.id,n.x,n.y]),p=byId.get(node.parent);
  assert.equal(editor.begin(node.id),null,`begin ${node.id}`);
  for(let i=0;i<10;i++) {
    editor.move(node.x+p.r*.05,node.y+p.r*.02);
    const group=nodes.filter(n=>n.parent===p.id);
    for(let a=0;a<group.length;a++){
      const n=group[a];assert.ok(Math.hypot(n.x-p.x,n.y-p.y)+n.r<=p.r+.00201);
      for(let b=0;b<a;b++)assert.ok(Math.hypot(n.x-group[b].x,n.y-group[b].y)>=n.r+group[b].r-.00201);
    }
  }
  if(nodes.some((n,i)=>n.x!==before[i][1]||n.y!==before[i][2]))moved++;
  editor.cancel();assert.deepEqual(nodes.map(n=>[n.id,n.x,n.y]),before);tested++;
}
assert.equal(JSON.stringify(nodes),source);assert.ok(moved>0);
let rootCases=0;
const tight=[{id:'a',x:-314.4344483916968,y:-431.16286600405044,r:414.3764},{id:'b',x:298.0999357828423,y:504.0748734351545,r:414.3764},{id:'c',x:503.67627116948,y:-298.77603042984134,r:414.3764}];
const tightEditor=createLayoutEditor(tight,1000),tightBefore=JSON.stringify(tight);
assert.equal(tightEditor.begin('a'),null);assert.equal(tightEditor.move(tight[0].x+100,tight[0].y+70),false);assert.ok(tight[0].x>-250);
tightEditor.cancel();assert.equal(JSON.stringify(tight),tightBefore);
for(const paths of [['Root.md'],['A.md','B.md','C.md'],['Folder/A.md','Other/B.md'],['Root.md','Folder/A.md']]) {
  const g=buildGraph({files:paths.map(path=>({path,text:'# Heading\n## Child'})),config:{include:['**']}});
  const ids=new Map(g.nodes.map(n=>[n.id,n])),roots=g.nodes.filter(n=>!ids.has(n.parent)),radius=g.meta.layout_root_radius;
  const edit=createLayoutEditor(g.nodes,radius);
  for(const n of roots){
    const original=JSON.stringify(g.nodes),before=new Map(g.nodes.map(a=>[a.id,[a.x,a.y]]));
    assert.equal(edit.begin(n.id),null);
    edit.move(n.x+radius*.025,n.y+radius*.015);
    assert.ok(Math.hypot(n.x-before.get(n.id)[0],n.y-before.get(n.id)[1])>1e-6);
    for(let i=0;i<roots.length;i++){const a=roots[i];assert.ok(Math.hypot(a.x,a.y)+a.r<=radius+.00201);for(let j=0;j<i;j++)assert.ok(Math.hypot(a.x-roots[j].x,a.y-roots[j].y)>=a.r+roots[j].r-.00201);}
    for(const a of g.nodes){let ancestor=a;while(ids.has(ancestor.parent))ancestor=ids.get(ancestor.parent);assert.ok(Math.abs((a.x-before.get(a.id)[0])-(ancestor.x-before.get(ancestor.id)[0]))<1e-8);}
    edit.cancel();assert.equal(JSON.stringify(g.nodes),original);rootCases++;
  }
}
console.log(JSON.stringify({groupsTested:tested,groupsWithMovement:moved,rootCases,checks:'real packing, roots of all kinds, subtree translation and exact cancellation passed'}));
