// Optional isolated resource benchmark; not a timing assertion in npm test.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {analyzeSyncCausality} from '../src/sync/causal-prototype.mjs';
import {planSchema3Transactions} from '../src/sync/layout-prototype.mjs';
import {createLayoutActionAuthor} from '../src/sync/author-prototype.mjs';
import {packSchema3Operation} from '../src/sync/wire-prototype.mjs';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url)),vault='a'.repeat(32),ID=n=>n.toString(16).padStart(32,'0');
const cases=[
  {name:'metadata-chain-128',kind:'metadata',count:128},
  {name:'metadata-chain-1000',kind:'metadata',count:1000},
  {name:'metadata-concurrent-1000',kind:'metadata',count:1000,concurrent:true},
  {name:'layout-chain-32',kind:'layout',count:32},
  {name:'layout-chain-128',kind:'layout',count:128},
  {name:'layout-chain-1024',kind:'layout',count:1024},
  {name:'layout-branches-64',kind:'layout',count:64,concurrent:true},
  {name:'layout-128-siblings',kind:'import',notes:1,heads:128,children:0,edits:1},
  {name:'layout-4097-nodes',kind:'import',notes:32,heads:127,children:0,edits:32},
  {name:'layout-note-1020-headings-20-groups',kind:'import',notes:1,heads:20,children:50,edits:20},
  {name:'layout-note-4840-headings-40-groups',kind:'import',notes:1,heads:40,children:120,edits:40},
  {name:'author-prepare-128',kind:'author',count:128},
  {name:'layout-note-1020-history-64',kind:'layout',notes:1,heads:20,children:50,edits:1,count:64},
  {name:'reconcile-note-1020-headings-20-groups',kind:'reconcile',notes:1,heads:20,children:50,edits:20},
  {name:'reconcile-note-4840-headings-40-groups',kind:'reconcile',notes:1,heads:40,children:120,edits:40},
  {name:'scan-128-files',kind:'scan',count:128},
  {name:'scan-1000-files',kind:'scan',count:1000},
];
const makeOp=(n,parents,changes)=>({protocol:1,vault,id:ID(n),parents:parents.map(ID),changes});
const empty={schemaVersion:3,revision:0,groups:{},structures:{}};
async function fixture(spec={}) {
  const notes=spec.notes||1,heads=spec.heads||2,children=spec.children||0;
  const content=Array.from({length:heads},(_,i)=>`# Heading ${i}\nbody ${i}\n`+
    Array.from({length:children},(_,j)=>`## Child ${i}-${j}\nbody ${j}`).join('\n')).join('\n');
  const files=Array.from({length:notes},(_,i)=>({path:`Synthetic/Note-${i}.md`,text:content}));
  const build=()=>buildGraph({files,config:{include:['**']}});
  const g=build(),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius);
  const disk={schemaVersion:3,revision:0,groups:{},structures:{}};
  const targets=spec.children?g.nodes.filter(n=>n.level===2&&n.title.endsWith('-0')):
    g.nodes.filter(n=>n.level===1&&n.title==='Heading 0');
  let rotationFixtures=0;
  for(const n of targets.slice(0,spec.edits||1)){
    const reason=e.begin(n.id);if(reason)throw Error('fixture-editor: '+reason);
    e.move(n.x+2,n.y+1);e.commit();const group=m.groupKey(n.id);let record=m.capture(group);
    if(!record){
      // Dense tangent fixtures may have no permitted single-node translation.
      // Rotate sibling centers rigidly and translate their subtrees; this is
      // synthetic valid geometry, NOT a successful native drag measurement.
      const p=g.nodes.find(x=>x.id===n.parent)||{x:0,y:0},angle=.015;
      for(const sibling of g.nodes.filter(x=>x.parent===n.parent)){
        const x=sibling.x-p.x,y=sibling.y-p.y,dx=p.x+x*Math.cos(angle)-y*Math.sin(angle)-sibling.x,
          dy=p.y+x*Math.sin(angle)+y*Math.cos(angle)-sibling.y,stack=[sibling];
        while(stack.length){const node=stack.pop();node.x+=dx;node.y+=dy;stack.push(...g.nodes.filter(x=>x.parent===node.id));}
      }
      record=m.capture(group);rotationFixtures++;
    }
    if(!record)throw Error('fixture-no-override');let single;
    const s=createLayoutStore(null,async d=>single=d);await s.command({},'edit',group,record);
    Object.assign(disk.groups,single.groups);Object.assign(disk.structures,single.structures);disk.revision++;
  }
  const changes=Object.entries(disk.groups).map(([group,record])=>({group,value:{schemaVersion:3,record,
    structures:record.note?{[record.note]:disk.structures[record.note]}:{}}}));
  return {graph:g,disk,changes,rotationFixtures,createModel:()=>createLayoutModel(structuredClone(g.nodes),g.meta.layout_root_radius),
    changedFactory(){const updated=buildGraph({files:files.map((f,i)=>i?f:{...f,text:f.text.replace('# Heading 0\n','# Renamed 0\n')}),config:{include:['**']}});
      return ()=>createLayoutModel(structuredClone(updated.nodes),updated.meta.layout_root_radius);},
  };
}
async function run(spec) {
  let action,meta={};
  if(spec.kind==='metadata'){
    const records=Array.from({length:spec.count},(_,i)=>makeOp(i+1,spec.concurrent||i===0?[]:[i],[{group:'root',value:{x:i}}]));
    meta={records:records.length,bytes:Buffer.byteLength(JSON.stringify(records))};
    action=()=>{const r=analyzeSyncCausality(records,{vault});if(r.ready.length!==records.length)throw Error('count mismatch');
      return {ready:r.ready.length,conflicts:r.conflicts.length};};
  } else if(spec.kind==='scan') {
    const dir=fs.mkdtempSync(path.join(ROOT,'.local/sync-016/a2/scan-'));
    const body=JSON.stringify(makeOp(1,[],[{group:'root',value:{x:1}}]));
    for(let i=0;i<spec.count;i++)fs.writeFileSync(path.join(dir,ID(i+1)+'.json'),body.replace(ID(1),ID(i+1)));
    meta={files:spec.count,bytes:Buffer.byteLength(body)*spec.count,source:'Local Node filesystem, warm OS cache; NOT Nutstore or Vault API'};
    action=()=>{const files=fs.readdirSync(dir);for(const name of files)JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));return {read:files.length};};
  } else {
    const f=await fixture(spec);
    if(spec.kind==='reconcile'){
      const record=packSchema3Operation({vault,id:ID(1),parents:[],changes:f.changes}),changed=f.changedFactory();
      meta={records:1,bytes:Buffer.byteLength(JSON.stringify(record)),nodes:f.graph.nodes.length,groups:f.changes.length};
      action=()=>{const a=createLayoutActionAuthor({vault,createModel:changed,nextId:()=>ID(2)});
        const r=a.prepareReconcile({vault,sharedScanComplete:true,records:[record],appliedIds:[ID(1)],localBaseline:f.disk});
        if(!r.operation||r.sharedStatus!=='candidate'||r.operation.parents.join(',')!==ID(1))throw Error('expected valid causal repair');
        return {status:r.sharedStatus,changes:r.operation.changes.length};};
    } else if(spec.kind==='layout'||spec.kind==='author'){
      const records=Array.from({length:spec.count},(_,i)=>packSchema3Operation({vault,id:ID(i+1),parents:(spec.concurrent||i===0?[]:[i]).map(ID),changes:f.changes}));
      meta={records:records.length,bytes:Buffer.byteLength(JSON.stringify(records)),nodes:f.graph.nodes.length};
      action=()=>{const r=planSchema3Transactions(records,{vault,baseline:empty,createModel:f.createModel});
        if(r.index.ready.length!==records.length)throw Error('unexpected rejected record');
        if(spec.kind==='author'){
          const a=createLayoutActionAuthor({vault,createModel:f.createModel,nextId:()=>ID(spec.count+1)});
          const d=a.prepareResetAll({vault,records,appliedIds:r.index.ready.map(op=>op.id),localBaseline:r.proposal,sharedScanComplete:true});
          if(!d.operation)throw Error('expected reset');
        }
        return {status:r.status,groups:Object.keys(r.proposal.groups).length};};
    } else {
      const operation=makeOp(1,[],f.changes),bytes=Buffer.byteLength(JSON.stringify(operation));
      const deduplicated=packSchema3Operation({vault,id:ID(1),parents:[],changes:f.changes});
      meta={nodes:f.graph.nodes.length,groups:f.changes.length,bytes,deduplicatedBytes:Buffer.byteLength(JSON.stringify(deduplicated)),rotationFixtures:f.rotationFixtures,
        baselineBytes:Buffer.byteLength(JSON.stringify(f.disk)),
        identityRows:Object.values(f.disk.structures).reduce((n,a)=>n+a.length,0)};
      action=()=>{
        const a=createLayoutActionAuthor({vault,createModel:f.createModel,nextId:()=>ID(1)});
        const result=a.prepareJoin({vault,sharedScanComplete:true,records:[],appliedIds:[],localBaseline:f.disk},{choice:'import'});
        if(!result.operation||result.sharedStatus!=='candidate')throw Error('expected valid import record');
        if(result.operation.changes.length!==f.changes.length)throw Error('import group count');
        return {status:result.sharedStatus,groups:result.operation.changes.length};
      };
    }
  }
  globalThis.gc?.();const before=process.memoryUsage(),samples=[],results=[];
  for(let i=0;i<4;i++){
    const start=performance.now();try{results.push({ok:true,value:action()});}catch(e){results.push({ok:false,error:e.message});}
    samples.push(performance.now()-start);
  }
  const after=process.memoryUsage();globalThis.gc?.();const retained=process.memoryUsage();
  return {case:spec.name,...meta,samplesMs:samples,coldMs:samples[0],warmMedianMs:[...samples.slice(1)].sort((a,b)=>a-b)[1],
    heapBefore:before.heapUsed,heapAfterBeforeGC:after.heapUsed,heapRetainedAfterGC:retained.heapUsed,
    rssAfter:retained.rss,processPeakRSSKiB:process.resourceUsage().maxRSS,results};
}
const child=process.argv.indexOf('--case');
if(child>=0){
  try{const spec=cases.find(c=>c.name===process.argv[child+1]);if(!spec)throw Error('unknown case');console.log(JSON.stringify(await run(spec)));}
  catch(error){console.log(JSON.stringify({case:process.argv[child+1],setupError:error.message}));process.exitCode=1;}
} else {
  fs.mkdirSync(path.join(ROOT,'.local/sync-016/a2'),{recursive:true});
  const label=process.argv[2]||'baseline';if(!/^[a-z0-9-]+$/.test(label))throw Error('label');
  const report={date:'2026-11-08 Asia/Shanghai',label,host:{node:process.version,platform:process.platform,release:os.release(),arch:process.arch,
    cpu:os.cpus()[0].model,totalMemory:os.totalmem()},method:'Fresh child per case, --expose-gc, 256 MiB V8 heap, 20s timeout, one cold + three warm calls. RSS includes setup. No iPad/Nutstore measurement.',cases:[]};
  for(const c of cases){
    const r=spawnSync(process.execPath,['--expose-gc','--max-old-space-size=256',fileURLToPath(import.meta.url),'--case',c.name],
      {cwd:ROOT,encoding:'utf8',timeout:20000,maxBuffer:1048576});
    let row;try{row=JSON.parse(r.stdout.trim());}catch{row={case:c.name,error:r.error?.message||'child failed',exitCode:r.status,stderr:r.stderr?.slice(-400)};}
    report.cases.push(row);fs.writeFileSync(path.join(ROOT,`.local/sync-016/a2/scale-${label}.json`),JSON.stringify(report,null,2));
    console.log(JSON.stringify({case:c.name,ms:row.warmMedianMs,bytes:row.bytes,error:row.setupError||row.error||row.results?.find(x=>!x.ok)?.error,peakMiB:row.processPeakRSSKiB/1024}));
  }
}
