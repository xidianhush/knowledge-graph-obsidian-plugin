// Synthetic core-only A/B: no vault writes, UI, Worker or filesystem timing.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {buildGraph} from '../dist/pipeline.mjs';
import * as compact from '../dist/graph-core.mjs';
import * as legacy from '../tests/fixtures/graph-core-0.0.9.mjs';

const output='.local/evidence/layout-scale-ab';
fs.mkdirSync(output,{recursive:true});
const scenarios=[
  {headings:1000,notes:1,groups:1}, {headings:1000,notes:1,groups:10},
  {headings:5000,notes:1,groups:1}, {headings:5000,notes:1,groups:10},
  {headings:5000,notes:50,groups:50},
];
const percentile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))];
const rows=[];
for(const scenario of scenarios){
  const perNote=scenario.headings/scenario.notes;
  const text=Array.from({length:perNote},(_,i)=>`${i%10?'##':'#'} H${i}\nbody ${i}`).join('\n');
  const files=Array.from({length:scenario.notes},(_,i)=>({path:`Scale/Note${i}.md`,text}));
  const build=files=>buildGraph({files,config:{include:['Scale/**']}});
  const initial=build(files),model=legacy.createLayoutModel(initial.nodes,initial.meta.layout_root_radius);
  const editor=legacy.createLayoutEditor(initial.nodes,initial.meta.layout_root_radius),seed={};
  // Spread saved groups across notes first, then across separate parents.
  for(let i=0;i<scenario.groups;i++){
    const note=i%scenario.notes,heading=Math.floor(i/scenario.notes)*10+1;
    const node=initial.nodes.find(n=>n.id===`Scale/Note${note}#H${heading-1}/H${heading}`);
    assert.ok(node);assert.equal(editor.begin(node.id),null);
    editor.move(node.x+1,node.y+1);editor.commit();
    const key=model.groupKey(node.id);seed[key]=model.capture(key);assert.ok(seed[key],'Fixture must contain a real adjustment');
  }
  const records={legacy:seed,compact:structuredClone(seed)},samples=[];
  for(let step=0;step<12;step++){
    const edited=step%4===0?text.replace('H1\n','Renamed\n'):step%4===2?text+'\n# Added\nextra':text;
    const started=performance.now(),graph=build(files.map((f,i)=>i===0?{...f,text:edited}:f));
    const buildMs=performance.now()-started,geometries={};
    for(const version of step%2?['compact','legacy']:['legacy','compact']){
      const api=version==='legacy'?legacy:compact,data=structuredClone(graph);
      let at=performance.now();const next=api.createLayoutModel(data.nodes,data.meta.layout_root_radius);
      const modelMs=performance.now()-at;
      at=performance.now();records[version]=next.reconcile(records[version]);const applied=next.apply(records[version]);
      const reconcileApplyMs=performance.now()-at;
      at=performance.now();const encoded=JSON.stringify(records[version]);records[version]=JSON.parse(encoded);
      const jsonRoundtripMs=performance.now()-at;
      assert.equal(applied.skipped,0);assert.equal(applied.restored,scenario.groups);
      assert.equal(Object.keys(records[version]).length,scenario.groups);
      assert.ok(data.nodes.every(n=>Number.isFinite(n.x+n.y+n.r)));
      geometries[version]=data.nodes.map(n=>[n.x,n.y]);
      samples.push({step,operation:['rename','restore','add','delete'][step%4],warmup:step<4,version,
        buildMs,modelMs,reconcileApplyMs,jsonRoundtripMs,recordBytes:Buffer.byteLength(encoded),...applied});
    }
    geometries.legacy.forEach((p,i)=>assert.ok(Math.hypot(p[0]-geometries.compact[i][0],p[1]-geometries.compact[i][1])<1e-7,'Version geometry differs'));
  }
  const summary=Object.fromEntries(['legacy','compact'].map(version=>{
    const measured=samples.filter(s=>s.version===version&&!s.warmup);
    return [version,{samples:measured.length,maxRecordBytes:Math.max(...measured.map(s=>s.recordBytes)),
      medianModelMs:percentile(measured.map(s=>s.modelMs),.5),
      medianReconcileApplyMs:percentile(measured.map(s=>s.reconcileApplyMs),.5),
      medianJsonRoundtripMs:percentile(measured.map(s=>s.jsonRoundtripMs),.5),
      medianLayoutAndJsonMs:percentile(measured.map(s=>s.modelMs+s.reconcileApplyMs+s.jsonRoundtripMs),.5)}];
  }));
  rows.push({...scenario,nodes:initial.nodes.length,summary,samples});
  fs.writeFileSync(output+'/result.json',JSON.stringify({date:new Date().toISOString(),runtime:process.version,
    scope:'Core only. Common pipeline, alternating versions, 4 warmup + 8 measured per version/scenario. No Worker, UI or disk IO. All saved groups restored, zero skipped, version geometry equal.',rows},null,2));
  console.log(JSON.stringify({...scenario,summary}));
}
