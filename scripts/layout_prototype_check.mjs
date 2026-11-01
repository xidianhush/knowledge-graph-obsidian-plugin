import assert from 'node:assert/strict';
import {scene,clone,move,validTree,world} from '../prototypes/layout-edit/geometry.mjs';
let checks=0;const ok=(v,label)=>{assert.ok(v,label);checks++;};
for(const name of ['sparse','dense','boundary']) {
  let nodes=scene(name);ok(validTree(nodes),name+' initial geometry');
  let seed=17;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
  for(let i=0;i<200;i++) {
    const siblings=nodes.filter(n=>n.parent==='root');const id=siblings[Math.floor(random()*siblings.length)].id;
    const previous=clone(nodes);const result=move(nodes,id,{x:(random()-.5)*900,y:(random()-.5)*900});nodes=result.nodes;
    assert.ok(validTree(nodes),name+' accepted invalid frame');
    assert.deepEqual(previous.filter(n=>n.parent==='n0'),nodes.filter(n=>n.parent==='n0'));
    assert.deepEqual(previous.find(n=>n.id==='root'),nodes.find(n=>n.id==='root'));
  }
  checks+=3;
}
let nodes=scene(),before=clone(nodes);
for(let i=0;i<8;i++)nodes=move(nodes,'n0',{x:145,y:0}).nodes;
ok(validTree(nodes),'pushing remains valid');
ok(nodes.some(n=>n.parent==='root'&&n.id!=='n0'&&Math.hypot(n.x-before.find(a=>a.id===n.id).x,n.y-before.find(a=>a.id===n.id).y)>1),'siblings yield');
const delta=world(nodes,'n0').x-world(before,'n0').x;
ok(Math.abs(world(nodes,'h0').x-world(before,'h0').x-delta)<1e-9,'subtree translates once');
assert.deepEqual(move(before,'root',{x:100,y:100}).nodes,before);checks++;
let hidden=scene();hidden=move(hidden,'n3',{x:0,y:0}).nodes;
ok(validTree(hidden),'hidden siblings occupy space');
console.log(JSON.stringify({checks,randomMoves:600,result:'PASS'}));
