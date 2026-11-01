// Retained-memory comparison: 0.0.10 schema 2 records vs 0.0.11 schema 3 records.
// Run with `node --expose-gc scripts/layout_memory_check.mjs`; the script re-execs itself once
// with --expose-gc when the flag is missing. Numbers are Node heap deltas, not renderer memory.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {buildGraph} from '../dist/pipeline.mjs';
import * as current from '../dist/graph-core.mjs';
import * as base from '../tests/fixtures/graph-core-0.0.10.mjs';

if(typeof global.gc!=='function'){
  const run=spawnSync(process.execPath,['--expose-gc',...process.argv.slice(1)],{stdio:'inherit'});
  process.exit(run.status??1);
}

const output='.local/evidence/layout-memory';
fs.mkdirSync(output,{recursive:true});
const scenario={headings:5000,groups:10};
const text=Array.from({length:scenario.headings},(_,i)=>`${i%10?'##':'#'} H${i}\nbody ${i}`).join('\n');
const files=[{path:'Scale/Note0.md',text}];
const build=()=>buildGraph({files,config:{include:['Scale/**']}});
const measure=(api,label)=>{
  const graph=build(),model=api.createLayoutModel(graph.nodes,graph.meta.layout_root_radius);
  const editor=api.createLayoutEditor(graph.nodes,graph.meta.layout_root_radius),records={};
  for(let i=0;i<scenario.groups;i++){
    const heading=i*10+1;
    const node=graph.nodes.find(n=>n.id===`Scale/Note0#H${heading-1}/H${heading}`);
    if(!node)throw new Error('fixture node missing');
    editor.begin(node.id);editor.move(node.x+1,node.y+1);editor.commit();
    const key=model.groupKey(node.id);records[key]=model.capture(key);
  }
  const graph2=build(),model2=api.createLayoutModel(graph2.nodes,graph2.meta.layout_root_radius);
  global.gc();
  const before=process.memoryUsage().heapUsed;
  const kept=model2.reconcile(records);
  model2.apply(kept);
  global.gc();
  const after=process.memoryUsage().heapUsed;
  return {label,retainedBytes:Math.max(0,after-before),jsonBytes:Buffer.byteLength(JSON.stringify(kept)),
    groups:Object.keys(kept.groups??kept).length};
};
const result={date:new Date().toISOString(),node:process.version,scenario,
  method:'heapUsed delta after global.gc(), keeping only the reconciled layout reachable; JSON bytes of the same payload',
  base:measure(base,'0.0.10-schema2'),current:measure(current,'0.0.11-schema3')};
fs.writeFileSync(`${output}/result.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
