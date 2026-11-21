import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
import {createDurableSyncSession} from '../src/sync/persistence-prototype.mjs';
import {createAttemptHistory} from '../src/sync/attempt-history-prototype.mjs';
import {createSettingsCoordinator} from '../src/sync/settings-coordinator-prototype.mjs';
import {createPrivateConfigProjection} from '../src/sync/private-config-prototype.mjs';
import {createLayoutActionAuthor} from '../src/sync/author-prototype.mjs';
import {createAutoPublishQueue,createLayoutDraftPublisher} from '../src/sync/auto-publish-queue.mjs';
import {testMemoryStore} from './sync-host-test-helpers.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';
import {validateTestSettings} from './sync-settings-test-helpers.mjs';
export const vault='a'.repeat(32),installation='b'.repeat(32),id=n=>n.toString(16).padStart(32,'0');
export const empty={schemaVersion:3,revision:0,groups:{},structures:{}};
const files=['A','B'].map(n=>({path:'Synthetic/'+n+'.md',text:'# First\nBody\n# Second\nBody\n'}));
const graph=()=>buildGraph({files,config:{include:['Synthetic/**']}});
export const model=()=>{const g=graph();return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
export async function layout(dx,note='A'){
 const g=graph(),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius),n=g.nodes.find(n=>n.path==='Synthetic/'+note+'.md'&&n.title==='Second');
 assert.equal(e.begin(n.id),null);e.move(n.x+dx,n.y+5);e.commit();let result;const key=m.groupKey(n.id);await createLayoutStore(null,async s=>result=s).command({},'edit',key,m.capture(key));return result;
}
export async function fixture({root,privateStore,write,checkpoint=async()=>{},nextId,initialise=true,createModel=model}={}){
 const memory=new Map(),folders=new Set();let epoch=0,enabled=true,hidden=false,n=1,hook=checkpoint;
 const at=p=>path.join(root,'shared',p);
 if(root)await fs.mkdir(path.join(root,'shared'),{recursive:true});
 const adapter={
  async stat(p){if(root){try{const s=await fs.stat(at(p));return {type:s.isDirectory()?'folder':'file',size:s.size};}catch(e){if(e.code==='ENOENT')return null;throw e;}}return memory.has(p)?{type:'file',size:memory.get(p).length}:folders.has(p)?{type:'folder',size:0}:null;},
  async list(p){if(root){const rows=await fs.readdir(at(p),{withFileTypes:true});return {files:rows.filter(r=>r.isFile()).map(r=>p+'/'+r.name),folders:rows.filter(r=>r.isDirectory()).map(r=>p+'/'+r.name)};}const inScope=n=>n.startsWith(p+'/')&&!n.slice(p.length+1).includes('/');return {files:[...memory.keys()].filter(inScope),folders:[...folders].filter(inScope)};},
  async readBinary(p){return root?Uint8Array.from(await fs.readFile(at(p))).buffer:Uint8Array.from(memory.get(p)).buffer;},
  async mkdir(p){if(root)await fs.mkdir(at(p));else folders.add(p);},
  async writeBinary(p,bytes){if(write)await write(p,bytes);if(root)await fs.writeFile(at(p),new Uint8Array(bytes));else memory.set(p,new Uint8Array(bytes));},
 };
 const backing=privateStore??(root?createNodeSyncStore(path.join(root,'private')):testMemoryStore()),history=createAttemptHistory(adapter,vault);
 const session=createDurableSyncSession({privateStore:backing,attemptHistory:history,vault,installation,createModel,getEpoch:()=>epoch,nextId:nextId??(()=>id(n++)),checkpoint:step=>hook(step)});
 await session.open();if(initialise&&!session.state().initialized)await session.initialize({source:'explicit-empty',localBaseline:empty});
 const projection=createPrivateConfigProjection({session,validateSettings:validateTestSettings,getExternalEpoch:()=>0});
 if(!session.getLocalDocument())await projection.initialize({sourceData:{settings:{language:'zh'},ui:{preserve:'yes'},unknown:42}});
 await projection.open();
 const coordinator=createSettingsCoordinator({session,documentStore:projection.documentStore,validateSettings:validateTestSettings,createModel,getGraphEpoch:()=>epoch});await coordinator.open();
 const store=createLayoutStore(session.state().accepted.snapshot,async()=>{}),results=[];
 const gate=()=>enabled&&!hidden?true:{reason:enabled?'view-hidden':'disabled'};
 const publisher=createLayoutDraftPublisher({session,coordinator,attemptHistory:history,vault,createModel,getEpoch:()=>epoch,
  nextId:nextId??(()=>id(n++)),reserve(){const current=epoch,guard=store.reserveExternal(x=>x);return guard&&{release:()=>guard.release(),isCurrent:()=>epoch===current&&gate()===true};}});
 const queue=createAutoPublishQueue({readLocal:()=>session.state(),canRun:gate,publish:publisher.publish,onResult:r=>results.push(r)});
 return {session,projection,coordinator,history,adapter,backing,store,queue,publisher,results,
  async save(value){if(queue.state().closed)throw Error('queue-closed');const draft=await coordinator.stageLayoutDraft(value);queue.notifySaved(draft.id);return draft;},
  async stage(value){const a=session.state().accepted,author=createLayoutActionAuthor({vault,createModel,nextId:nextId??(()=>id(n++))});const changes=Object.entries(value.groups).map(([group,record])=>({group,value:{schemaVersion:3,record,structures:value.structures}}));const proposal=author.prepareEdit({vault,sharedScanComplete:true,records:a.operations,appliedIds:a.appliedIds,localBaseline:a.snapshot},changes);await session.stage(proposal);return session.state().pending;},
  hook:fn=>hook=fn,bump:()=>++epoch,setEnabled:v=>enabled=v,setHidden:v=>hidden=v,
  async close(){await queue.close();await coordinator.close();await projection.close();await session.close();},
 };
}
