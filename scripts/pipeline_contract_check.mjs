import assert from 'node:assert/strict';
import {buildGraph,buildGraphAsync,encodeGraphPayload,pipelineConfig,selectGraphFiles,parseGraphNote,kgRound} from '../dist/pipeline.mjs';
import {decodeGraphPayload} from '../dist/graph-core.mjs';
const config={include:['**']};
assert.equal(kgRound(2.675,2),2.67);assert.equal(kgRound(2.5),2);assert.equal(kgRound(3.5),4);assert.equal(kgRound(-2.5),-2);
const empty=buildGraph({files:[],config});assert.equal(empty.nodes.length,0);assert.equal(empty.meta.scan.max_depth,1);
assert.throws(()=>buildGraph({files:[],config:{include:[]}}),/include/);
assert.throws(()=>buildGraph({files:[],config:{...config,layout:{padding:.5}}}),/padding/);
assert.throws(()=>buildGraph({files:[{path:'../outside.md',text:''}],config}),/relative/);
assert.throws(()=>buildGraph({files:[{path:'A.md',text:''},{path:'A/B.md',text:''}],config}),/collides/);
assert.throws(()=>buildGraph({files:[{path:'A/Foo.md',text:''},{path:'B/Foo.md',text:''}],config:{...config,remap:[{from:'A',to:'C'},{from:'B',to:'C'}]}}),/same id/);
const files=[{path:'A/Test.MD',text:'---\nsubject: A\n---\n# Heading\n[[Else]]'},{path:'B/Else.md',text:'# Target'}, {path:'.hidden/No.md',text:''}];
assert.throws(()=>buildGraph({files,config}),/YAML parser/);
let yamlCalls=0;const raw=buildGraph({files,config,parseYaml:raw=>{yamlCalls++;assert.equal(raw,'subject: A');return{subject:'A'};}});
assert.equal(yamlCalls,1);assert.equal(raw.meta.note_count,2);
assert.ok(raw.edges.some(e=>e.type==='derives'&&e.t==='B/Else'));
const encoded=encodeGraphPayload(raw),decoded=decodeGraphPayload(encoded);delete decoded.meta.edge_types;
assert.deepEqual(JSON.parse(JSON.stringify(decoded)),JSON.parse(JSON.stringify(raw)));
const selected=selectGraphFiles(files,pipelineConfig({include:['[AB]/*'],exclude:['a/test.md']}));assert.deepEqual(selected.files.map(f=>f.id),['B/Else']);
const file={path:'A.md',rel:'A.md',id:'A',text:'---\nx: [\n---\n# yes'};
assert.equal(parseGraphNote(file,()=>{throw new Error('bad YAML');}).headings[0].line,4);
assert.equal(parseGraphNote({...file,text:'\uFEFF---\r\nx: 1\r\n---\r\n# yes'},()=>({x:1})).headings[0].line,4);
console.log('PIPELINE_CONTRACT_CHECK: rounding, scope, exclusions, malformed input, YAML boundary, empty graph, codec roundtrip passed');

import fs from 'node:fs/promises';
import vm from 'node:vm';

// A shared generator must preserve all payload fields, links and geometry.
const cooperativeInput={
  files:Array.from({length:96},(_,i)=>({path:'Lab/B'+i%8+'/N'+i+'.md',
    text:Array.from({length:12},(_,j)=>'#'.repeat(1+j%6)+' Section '+j+'\n\nbody [[N'+(i+1)%96+'#Section 0]]').join('\n\n'),
    frontmatter:i===0?{derives:['N3'],prerequisites:['N2']}:{} })),
  config,annotations:{notes:{N0:{aliases:['First']}},edges:[{source:'First',target:'N5'}]},
  candidates:{candidates:[{source:'N2',target:'N3',status:'accepted'}]},generated:'fixed',
};
const expected=buildGraph(cooperativeInput);
let clock=0,yields=0;
const phases=new Set();
assert.deepEqual(await buildGraphAsync(cooperativeInput,{
  signal:new AbortController().signal,now:()=>clock+=2,
  yieldTask:async()=>{yields++;},onProgress:p=>phases.add(p.stage),
}),expected);
assert.ok(yields>2 && phases.has('layout'));
for(const stage of ['parsing','connections','layout']){
  const controller=new AbortController();
  await assert.rejects(buildGraphAsync(cooperativeInput,{
    signal:controller.signal,now:()=>clock+=9,yieldTask:async()=>{},
    onProgress:p=>{if(p.stage===stage)controller.abort();},
  }),/cancelled/);
}
const cancelled=new AbortController();cancelled.abort();
await assert.rejects(buildGraphAsync(cooperativeInput,{signal:cancelled.signal,yieldTask:async()=>{throw Error('must not run');}}),/cancelled/);

// Host adapter: unavailable workers retry once; data errors and cancellation do not.
const adapter=vm.createContext({Error,Promise,Map,Set,Date,Array,AbortController,
  pipelineConfig,selectGraphFiles,splitGraphFrontmatter:()=>({frontmatter:{}}),parseYaml:()=>({}),
  PIPELINE_WORKER_SOURCE:'test',kgT:(key)=>key,
  buildGraphAsync:async(input,options)=>{
    adapter.fallbackCalls++;
    return buildGraphAsync(input,options);
  },fallbackCalls:0,
});
vm.runInContext(await fs.readFile(new URL('../src/adapters/vault-pipeline.js',import.meta.url),'utf8')+
  '\nglobalThis.runPipelineWorker=runPipelineWorker;globalThis.buildVaultGraph=buildVaultGraph;',adapter);
const fixtureText=new Map([['A.md','# A\n[[B]]'],['B.md','# B']]);
let forbidSecretReads=0;
const host={
  pipelineSettings:{},pipelineResources:{active:0,started:0,stopped:0},
  app:{vault:{
    getName:()=>'synthetic',
    getMarkdownFiles:()=>[...fixtureText.keys(),'Utilities/API Key.md'].map(path=>({path})),
    cachedRead:async file=>{assert.notEqual(file.path,'Utilities/API Key.md');forbidSecretReads++;return fixtureText.get(file.path);},
  }},
};
for(const mode of ['success','constructor','blob','async-error','message-error','post-message','data-error','abort']){
  let revoked=0,terminated=0,prevented=0;
  const controller=new AbortController();
  const win={
    Blob:class{},performance:{now:()=>clock+=9},setTimeout,
    URL:{createObjectURL:()=>{if(mode==='blob')throw Error('Blob blocked');return 'blob:test';},revokeObjectURL:()=>revoked++},
    Worker:class{
      constructor(){if(mode==='constructor')throw Error('Worker blocked');}
      terminate(){terminated++;}
      postMessage(input){
        if(mode==='post-message')throw Error('post failed');
        queueMicrotask(()=>{
          if(mode==='abort'){controller.abort();return;}
          if(mode==='async-error')this.onerror({message:'Worker failed',preventDefault:()=>prevented++});
          else if(mode==='message-error')this.onmessageerror();
          else if(mode==='data-error')this.onmessage({data:{error:'Invalid graph data'}});
          else this.onmessage({data:{payload:buildGraph(input)}});
        });
      }
    },
  };
  adapter.fallbackCalls=0;
  const progress=[];
  if(mode==='data-error'||mode==='abort'){
    await assert.rejects(adapter.buildVaultGraph(host,win,controller.signal,p=>progress.push(p)),mode==='abort'?/cancelled/:/Invalid graph data/);
    assert.equal(adapter.fallbackCalls,0);
  }else{
    const payload=await adapter.buildVaultGraph(host,win,controller.signal,p=>progress.push(p));
    assert.equal(payload.meta.note_count,2);
    assert.equal(adapter.fallbackCalls,mode==='success'?0:1);
  }
  assert.equal(host.pipelineResources.active,0);
  assert.equal(revoked,mode==='blob'?0:1);
  assert.equal(terminated,['constructor','blob'].includes(mode)?0:1);
  if(mode==='async-error')assert.equal(prevented,1);
}
// Cancellation during fallback must never resolve a partial graph.
const fallbackController=new AbortController();
await assert.rejects(adapter.buildVaultGraph(host,{
  Worker:class{constructor(){throw Error('blocked');}},Blob:class{},
  URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},
  setTimeout:fn=>setTimeout(()=>{fallbackController.abort();fn();},0),
  performance:{now:()=>clock+=9},
},fallbackController.signal,()=>{}),/cancelled/);
assert.ok(forbidSecretReads>0);
console.log('PIPELINE_COOPERATIVE_CHECK: identical payload, stage cancellation, worker failure fallback/cleanup, data errors and excluded reads passed');
