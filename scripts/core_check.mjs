import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GraphCore, decodeGraphPayload } from '../dist/graph-core.mjs';
import { buildGraph, encodeGraphPayload } from '../dist/pipeline.mjs';
// Clean clones use public synthetic input; private snapshot regression is opt-in.
const encoded = process.argv.includes('--private-snapshot')
  ? JSON.parse(fs.readFileSync(new URL('../.local/smoke-payload.json', import.meta.url)))
  : encodeGraphPayload(buildGraph({files:[
      {path:'Demo/One.md',text:'# Parent\n## Child\nbody [[Two]]'},
      {path:'Demo/Two.md',text:'# Target\nbody'},
    ],config:{include:['Demo/**']}}));
const source = JSON.stringify(encoded);
const decoded = decodeGraphPayload(encoded);
assert.equal(JSON.stringify(encoded), source);
assert.deepEqual(decodeGraphPayload(decoded), decoded);
assert.equal(decoded.nodes.length, encoded.nodes.length);
assert.equal(decoded.edges.length, encoded.edges.length);
assert.ok(decoded.nodes.some(n => typeof n.parent === 'string'));
assert.ok(decoded.edges.some(e => typeof e.s === 'string' && typeof e.type === 'string'));
assert.throws(() => decodeGraphPayload({}), /nodes/);
assert.throws(() => decodeGraphPayload({nodes:[], edges:[], meta:{codec:'unknown'}}), /Unsupported/);

// Deterministic scheduler: pause must cancel native callbacks, retain pending work,
// resume exactly once, and refuse new work after disposal.
let sequence = 0, now = 0, calls = 0;
const scheduled = new Map();
const platform = { requestFrame(fn) { const id = ++sequence; scheduled.set(id, fn); return id; },
  cancelFrame(id) { scheduled.delete(id); }, now: () => now };
const core = new GraphCore({canvas: {}, payload: encoded, platform});
core.requestFrame(() => calls++);
assert.equal(scheduled.size, 1);
core.pause(); core.pause(); assert.equal(scheduled.size, 0);
core.resume(); core.resume(); assert.equal(scheduled.size, 1);
for (const [id, fn] of scheduled) { scheduled.delete(id); fn(++now); }
assert.equal(calls, 1); assert.equal(core.diagnostics().frames, 0);
core.requestFrame(() => calls++);
core.dispose(); core.dispose(); core.resume(); core.resize();
assert.equal(scheduled.size, 0); assert.equal(core.requestFrame(() => calls++), 0);
assert.equal(core.data, null); assert.equal(core.canvas, null);
assert.equal(core.diagnostics().active, false);
assert.throws(() => core.mount(), /only once/);
let ownedListeners = 0;
const failingPlatform = { ...platform,
  listenCanvas() { ownedListeners++; return () => ownedListeners--; },
  listenGlobal() { throw new Error('Simulated host subscription failure'); },
};
const failedCore = new GraphCore({ canvas: { getContext: () => ({}), style: {} }, payload: encoded, platform: failingPlatform });
assert.throws(() => failedCore.mount(), /Simulated host/);
assert.equal(ownedListeners, 0);
assert.equal(failedCore.diagnostics().disposed, true);
assert.equal(failedCore.diagnostics().frames, 0);
console.log('CORE_CHECK: codec immutability/idempotence, validation, scheduler lifecycle passed');

// Graph content uses the full canvas; HUD insets only reserve readable/fit space.
// A link and its target arrow must remain visible beside nodes near the footer.
function footerEdgeFrame(touch,insets,points){
  let path=[];const strokes=[],fills=[];
  const noOp=()=>{};
  const context=new Proxy({
    beginPath(){path=[];},moveTo(x,y){path.push([x,y]);},lineTo(x,y){path.push([x,y]);},
    stroke(){strokes.push(path.map(p=>[...p]));},fill(){fills.push(path.map(p=>[...p]));},
    measureText:()=>({width:20}),createRadialGradient:()=>({addColorStop:noOp}),
    createLinearGradient:()=>({addColorStop:noOp}),
  },{get:(target,key)=>key in target?target[key]:noOp});
  const payload=buildGraph({files:[{path:'A.md',text:'[[B]]'},{path:'B.md',text:''}],config:{include:['**']}});
  payload.nodes.forEach((n,i)=>{n.x=points[i][0];n.y=points[i][1];n.r=14;});
  const platform={...failingPlatform,touch,metrics:()=>({width:640,height:480,dpr:1}),
    listenCanvas:()=>noOp,listenGlobal:()=>noOp,setTimer:()=>1,clearTimer:noOp};
  const graph=new GraphCore({canvas:{getContext:()=>context,style:{}},payload,platform});
  graph.mount();const r=graph.renderer;
  r.setInsets(insets);r.camera.zoom=1;r.camera.panX=0;r.camera.panY=0;
  r.labelMode='off';r.selected='A';
  strokes.length=0;fills.length=0;r.draw();
  const result={strokes,fills,marks:r.markJobs.map(m=>({...m})),edges:r.stats.edges};
  graph.dispose();return result;
}
for(const touch of [false,true]){
  for(const insets of [{top:46,bottom:46,right:0},{top:110,bottom:95,right:150}]){
    const frame=footerEdgeFrame(touch,insets,[[80,468],[520,468]]);
    assert.equal(frame.edges,1,'footer link was culled while its nodes remained visible');
    assert.ok(frame.strokes.some(p=>p.length===2&&p.every(([x,y])=>y===468)&&p[1][0]-p[0][0]>300));
    assert.ok(frame.fills.some(p=>p.length===3&&p[0][1]===468),'footer arrow was not painted');
  }
  // Cross the viewport with both nodes outside: clip the line, never invent endpoint arrows.
  const cross=footerEdgeFrame(touch,{top:110,bottom:95,right:0},[[-100,468],[740,468]]);
  assert.equal(cross.edges,1);
  assert.ok(cross.strokes.some(p=>p.length===2&&p[0][0]>=-33&&p[1][0]<=673&&p.every(v=>v[1]===468)));
  assert.ok(!cross.fills.some(p=>p.length===3),'offscreen endpoint arrow was painted');
}
console.log('FOOTER_EDGE_CHECK: desktop/touch links and arrows reach the canvas bottom; offscreen clipping preserved');
