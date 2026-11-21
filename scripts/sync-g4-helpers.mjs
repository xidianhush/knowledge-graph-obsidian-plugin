import assert from 'node:assert/strict';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutStore,createLayoutEditor} from '../dist/graph-core.mjs';
import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';
import {createAttemptHistory} from '../src/sync/attempt-history-prototype.mjs';
import {fixture,layout,empty} from './sync-auto-publish-test-helpers.mjs';
import {testLocalApp,testMemoryStore,testLockManager} from './sync-host-test-helpers.mjs';
import {validateTestSettings} from './sync-settings-test-helpers.mjs';
import {startObsidianLayoutReceiver} from '../src/sync/obsidian-layout-receiver.mjs';
export const seedFiles=['A','B'].map(n=>({path:'Synthetic/'+n+'.md',text:'# First\nBody\n# Second\nBody\n'}));
const a=await layout(-20),b=await layout(15,'B');
export const seed={schemaVersion:3,revision:0,groups:{...a.groups,...b.groups},structures:{...a.structures,...b.structures}};
export async function device(initial=seed,{checkpoint=async()=>{}}={}){
 const io=await fixture(),back=new Map(),app=testLocalApp();let files=structuredClone(seedFiles),config={include:['Synthetic/**']},epoch=0,hidden=false;
 let source={settings:{language:'zh'},pipeline:{config},layoutOverrides:initial};
 const model=()=>{const g=buildGraph({files,config});return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
 const options={app,pluginId:'g4-test',adapter:io.adapter,locks:testLockManager(),checkpoint:step=>checkpoint(step),readSource:async()=>structuredClone(source),saveUnjoined:async v=>source=structuredClone(v),createStore:createLayoutStore,validateSettings:validateTestSettings,
 openBackend:async({vault})=>{if(!back.has(vault))back.set(vault,testMemoryStore());return back.get(vault);},getGraph:()=>({isCurrent:()=>true,hidden,createModel:model}),getEpoch:()=>epoch};
 const h=await createUnifiedSyncHost(options),signals={addEventListener(){},removeEventListener(){}};
 return {h,io,model,options,hook:fn=>checkpoint=fn,source:()=>structuredClone(source),setSource:v=>source=structuredClone(v),files:()=>structuredClone(files),setFiles:v=>{files=structuredClone(v);epoch++;},setConfig:v=>{config=v;epoch++;},hide:v=>hidden=v,
 async select(){const p=await h.previewSelection({action:'new'});await h.confirmSelection(p.token);const j=await h.previewJoin();assert.equal((await h.confirmJoin(j.token,'import')).kind,'joined');},
 async adopt(other){const p=await h.previewSelection({action:'join',...other.h.state().selected});await h.confirmSelection(p.token);const j=await h.previewJoin();assert.equal((await h.confirmJoin(j.token,'shared')).kind,'joined');},
 history(){return createAttemptHistory(io.adapter,h.state().selected.vault);},
 capture(path,dx){const g=buildGraph({files,config}),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius),n=g.nodes.find(n=>n.path===path&&n.title==='Second');assert.equal(e.begin(n.id),null);e.move(n.x+dx,n.y+5);e.commit();const key=m.groupKey(n.id);return {key,value:m.capture(key)};},
 async check(){const r=startObsidianLayoutReceiver({vault:{on:()=>({}),offref(){}},logicalVault:h.state().selected.vault,win:{...signals,document:{...signals,hidden},setTimeout:()=>0,clearTimeout(){}},layoutStore:h.store,getGraph:()=>({isCurrent:()=>true,createModel:model}),readLocal:()=>h.state().session,receive:o=>h.receive(o),report(){}});try{return await r.check();}finally{await r.close();}},
 async command(kind,key,value){await h.store.command({},kind,key,value);await h.settled();},
 async close(){await h.close();await io.close();}};
}
export async function relay(a,b){const scan=await a.history().scan();for(const row of scan.inventory){const body=await a.io.adapter.readBinary(row.name);let folder='';for(const part of row.name.split('/').slice(0,-1)){folder=folder?folder+'/'+part:part;if(!await b.io.adapter.stat(folder))await b.io.adapter.mkdir(folder);}if(await b.io.adapter.stat(row.name))assert.deepEqual(new Uint8Array(await b.io.adapter.readBinary(row.name)),new Uint8Array(body));else await b.io.adapter.writeBinary(row.name,body);}}
export async function pair(){const a=await device(),b=await device(empty);await a.select();await relay(a,b);await b.adopt(a);return {a,b,async close(){await a.close();await b.close();}};}
export const state=d=>d.h.state().session;
