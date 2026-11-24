import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';
import {createLayoutStore} from '../dist/graph-core.mjs';
import {layout,model,empty} from './sync-auto-publish-test-helpers.mjs';
import {testLocalApp,testLockManager,testMemoryStore} from './sync-host-test-helpers.mjs';
import {validateTestSettings} from './sync-settings-test-helpers.mjs';
import {createAttemptHistory} from '../src/sync/attempt-history-prototype.mjs';
import {createDefaultLayoutBootstrap,DEFAULT_LAYOUT_VAULT_ID} from '../src/sync/default-layout-bootstrap.mjs';
import {packSchema3Operation} from '../src/sync/wire-prototype.mjs';
import {cloneBoundedSyncJson} from '../src/sync/causal-prototype.mjs';
import {syncContentHash} from '../src/sync/persistence-prototype.mjs';
import {easySyncKey} from '../src/sync/easy-sync-setup.mjs';
const checks=[],left=await layout(-20),right=await layout(20);
async function test(name,fn){await fn();checks.push(name);}
function memoryAdapter(){
 const memory=new Map(),folders=new Set();
 return {memory,folders,
  async stat(p){return memory.has(p)?{type:'file',size:memory.get(p).length}:folders.has(p)?{type:'folder',size:0}:null;},
  async list(p){const inScope=n=>n.startsWith(p+'/')&&!n.slice(p.length+1).includes('/');return {files:[...memory.keys()].filter(inScope),folders:[...folders].filter(inScope)};},
  async readBinary(p){return Uint8Array.from(memory.get(p)).buffer;},
  async mkdir(p){const parts=p.split('/');for(let i=1;i<=parts.length;i++)folders.add(parts.slice(0,i).join('/'));},
  async writeBinary(p,bytes){memory.set(p,new Uint8Array(bytes));}};
}
function copyShared(from,to){for(const [k,v] of from.memory)if(k.startsWith('Knowledge Map Sync'))to.memory.set(k,new Uint8Array(v));for(const f of from.folders)if(f.startsWith('Knowledge Map Sync'))to.folders.add(f);}
async function seedLayout(adapter,vault,snapshot,opId){
 const changes=Object.entries(snapshot.groups).map(([group,record])=>({group,value:{schemaVersion:3,record,structures:record.note?{[record.note]:snapshot.structures[record.note]}:{}}}));
 const operation=packSchema3Operation({vault,id:opId,parents:[],changes}),text=JSON.stringify(cloneBoundedSyncJson(operation)),history=createAttemptHistory(adapter,vault);
 const name=await history.allocate(operation.id,await syncContentHash(text),[]);await history.write(name,text);return operation;
}
async function setup({local=empty,adapter=memoryAdapter(),app=testLocalApp(),backends=new Map(),checkpoint=async()=>{}}={}){
 let source={settings:{language:'zh'},ui:{keep:'yes'},layoutOverrides:local},epoch=0,graph=true,hidden=false,hook=checkpoint;
 const options={app,pluginId:'easy-test',adapter,locks:testLockManager(),readSource:async()=>structuredClone(source),saveUnjoined:async d=>{source=structuredClone(d);},createStore:createLayoutStore,validateSettings:validateTestSettings,
  openBackend:async({vault})=>{if(!backends.has(vault))backends.set(vault,testMemoryStore());return backends.get(vault);},getGraph:()=>graph?{isCurrent:()=>true,hidden,createModel:model}:null,getEpoch:()=>epoch,checkpoint:step=>hook(step)};
 const host=await createUnifiedSyncHost(options);
 return {host,app,adapter,backends,options,source:()=>source,setSource:v=>source=v,setLocal:v=>source={...source,layoutOverrides:v},bump:()=>++epoch,graph:v=>graph=v,hide:v=>hidden=v,hook:fn=>hook=fn,async close(){await host.close();}};
}
await test('Fresh device with no manual layout prepares the default namespace and joins empty in one switch',async()=>{
 const f=await setup({local:empty});assert.equal(f.host.easySyncState().phase,'idle');assert.equal(f.app.loadLocalStorage(easySyncKey('easy-test')),null);
 const r=await f.host.startEasySync();assert.equal(r.kind,'easy-joined');const s=f.host.easySyncState();
 assert.equal(s.phase,'active');assert.equal(s.reason,'awaiting-transfer');assert.equal(s.authorization.authorized,true);assert.equal(s.authorization.enabled,true);
 assert.equal(f.host.state().selected.vault,DEFAULT_LAYOUT_VAULT_ID);assert.equal(f.host.state().session.initialized,true);assert.equal(f.host.state().session.accepted.operations.length,0);
 assert.ok(f.app.loadLocalStorage(easySyncKey('easy-test')));const boot=await createDefaultLayoutBootstrap(f.adapter).scan();assert.equal(boot.facts,1);await f.close();
});
await test('Resume without authorization is held and never writes shared files',async()=>{
 const f=await setup();const r=await f.host.resumeEasySync();assert.equal(r.kind,'held');assert.equal(r.reason,'easy-sync-not-authorized');
 assert.equal(f.host.easySyncState().phase,'idle');assert.equal((await createDefaultLayoutBootstrap(f.adapter).scan()).facts,0);await f.close();
});
await test('Two fresh devices converge on the same default after exchange and then sync a real edit both ways',async()=>{
 const a=await setup({local:empty}),b=await setup({local:empty});
 await a.host.startEasySync();copyShared(a.adapter,b.adapter);const rb=await b.host.startEasySync();assert.equal(rb.kind,'easy-joined');
 assert.equal(a.host.state().selected.vault,b.host.state().selected.vault);assert.equal(b.host.state().selected.vault,DEFAULT_LAYOUT_VAULT_ID);
 await a.host.saveLayout(right);await a.host.settled();assert.equal(a.host.state().session.accepted.operations.length,1);
 copyShared(a.adapter,b.adapter);await b.host.notifyExternalChange();await b.host.receive();await b.host.settled();
 assert.deepEqual(b.host.state().session.accepted.snapshot.groups,right.groups);
 await b.host.saveLayout(left);await b.host.settled();copyShared(b.adapter,a.adapter);await a.host.notifyExternalChange();await a.host.receive();await a.host.settled();
 assert.deepEqual(a.host.state().session.accepted.snapshot.groups,left.groups);await a.close();await b.close();
});
await test('Local manual layout with empty shared history imports once under the switch authorization',async()=>{
 const f=await setup({local:left});const boot=createDefaultLayoutBootstrap(f.adapter);await boot.ensure();
 const r=await f.host.startEasySync();assert.equal(r.kind,'easy-joined');assert.equal(f.host.state().selected.vault,DEFAULT_LAYOUT_VAULT_ID);
 assert.equal(f.host.state().session.accepted.operations.length,1);assert.deepEqual(f.host.state().session.accepted.snapshot.groups,left.groups);
 assert.equal(f.host.easySyncState().phase,'active');await f.close();
});
await test('Semantically identical local and shared layouts adopt shared without republishing',async()=>{
 const f=await setup({local:left});await seedLayout(f.adapter,DEFAULT_LAYOUT_VAULT_ID,left,'1'.repeat(32));await createDefaultLayoutBootstrap(f.adapter).ensure();
 const r=await f.host.startEasySync();assert.equal(r.kind,'easy-joined');assert.equal(f.host.state().session.accepted.operations.length,1);
 assert.deepEqual(f.host.state().session.accepted.snapshot.groups,left.groups);assert.equal(f.host.state().session.pending,null);await f.close();
});
await test('Different local and shared layouts stop for review and never overwrite either side',async()=>{
 const f=await setup({local:left});await seedLayout(f.adapter,DEFAULT_LAYOUT_VAULT_ID,right,'1'.repeat(32));await createDefaultLayoutBootstrap(f.adapter).ensure();
 const r=await f.host.startEasySync();assert.equal(r.kind,'easy-review-required');assert.equal(r.reason,'join-choice-required');
 const s=f.host.easySyncState();assert.equal(s.phase,'review-required');assert.equal(f.host.state().session.initialized,false);
 assert.deepEqual(f.source().layoutOverrides.groups,left.groups);assert.equal(f.host.state().session.accepted,null);await f.close();
});
await test('Multiple writable candidates surface a selection instead of picking a winner',async()=>{
 const f=await setup({local:empty});await seedLayout(f.adapter,'c'.repeat(32),left,'1'.repeat(32));await seedLayout(f.adapter,'d'.repeat(32),right,'2'.repeat(32));
 const r=await f.host.startEasySync();assert.equal(r.kind,'easy-selecting');const s=f.host.easySyncState();assert.equal(s.phase,'selecting');assert.equal(s.candidates.length,2);
 assert.equal(f.host.state().selected,null);assert.equal(f.host.state().session,null);await f.close();
});
await test('Only legacy v2 read-only history explains read-only state without auto-writable conversion',async()=>{
 const f=await setup({local:empty}),op={protocol:2,layoutSchema:3,vault:'e'.repeat(32),id:'1'.repeat(32),parents:[],changes:[{group:'root',value:null}],structures:{}};
 const root='Knowledge Map Sync/v2/'+'e'.repeat(32)+'/ops';for(const p of ['Knowledge Map Sync','Knowledge Map Sync/v2','Knowledge Map Sync/v2/'+'e'.repeat(32),root])await f.adapter.mkdir(p);
 await f.adapter.writeBinary(root+'/'+op.id+'.json',new TextEncoder().encode(JSON.stringify(op)).buffer);
 const r=await f.host.startEasySync();assert.equal(r.kind,'easy-legacy-read-only');const s=f.host.easySyncState();assert.equal(s.phase,'review-required');assert.equal(s.reason,'legacy-read-only');
 assert.equal(f.host.state().selected,null);await f.close();
});
await test('An existing joined connection is preserved by the switch without rejoin or switch',async()=>{
 const f=await setup({local:left});const p=await f.host.previewSelection({action:'new'});await f.host.confirmSelection(p.token);const j=await f.host.previewJoin();await f.host.confirmJoin(j.token,'import');
 const vault=f.host.state().selected.vault,ops=f.host.state().session.accepted.operations.length;assert.notEqual(vault,DEFAULT_LAYOUT_VAULT_ID);
 const r=await f.host.startEasySync();assert.equal(r.kind,'easy-active');assert.equal(f.host.state().selected.vault,vault);assert.equal(f.host.state().session.accepted.operations.length,ops);
 assert.equal(f.host.easySyncState().phase,'active');await f.close();
});
await test('Turning off blocks shared writes and keeps local work; turning on does not auto-publish the off-period draft',async()=>{
 const f=await setup({local:left});await f.host.startEasySync();await f.host.settled();const ops=f.host.state().session.accepted.operations.length;
 await f.host.stopEasySync();assert.equal(f.host.easySyncState().phase,'off');assert.equal(f.host.easySyncState().authorization.enabled,false);
 await f.host.saveLayout(right);await f.host.settled();assert.equal(f.host.state().session.accepted.operations.length,ops);const draft=f.host.state().session.localState.layoutDraft;assert.ok(draft);
 await f.host.startEasySync();await f.host.settled();assert.equal(f.host.state().session.accepted.operations.length,ops);assert.equal(f.host.state().session.localState.layoutDraft.id,draft.id);
 assert.equal(f.host.easySyncState().authorization.enabled,true);
 await f.host.resumePublication({confirmed:true});await f.host.settled();assert.equal(f.host.state().session.accepted.operations.length,ops+1);await f.close();
});
await test('Reopen resumes the authorized flow without reimporting or reassigning the target',async()=>{
 const f=await setup({local:left});await f.host.startEasySync();const vault=f.host.state().selected.vault,ops=f.host.state().session.accepted.operations.length;await f.host.close();
 const h=await createUnifiedSyncHost(f.options);await h.settled();const r=await h.resumeEasySync();assert.equal(r.kind,'easy-active');
 assert.equal(h.state().selected.vault,vault);assert.equal(h.state().session.accepted.operations.length,ops);assert.equal(h.easySyncState().phase,'active');
 await h.resumeEasySync();assert.equal(h.state().session.accepted.operations.length,ops);await h.close();
});
await test('Authorization durable before the checkpoint exit; resume continues preparation after interruption',async()=>{
 const f=await setup({local:empty});let exited=false;f.hook(async step=>{if(step==='easy:after-authorization'&&!exited){exited=true;throw Error('simulated-exit');}});
 await assert.rejects(f.host.startEasySync(),/simulated-exit/);assert.ok(f.app.loadLocalStorage(easySyncKey('easy-test')));await f.close();
 const h=await createUnifiedSyncHost(f.options);const r=await h.resumeEasySync();assert.equal(r.kind,'easy-joined');assert.equal(h.state().selected.vault,DEFAULT_LAYOUT_VAULT_ID);assert.equal(h.state().session.accepted.operations.length,0);await h.close();
});
await test('Damaged bootstrap input pauses the automatic flow instead of reinitializing',async()=>{
 const f=await setup({local:empty});const dir='Knowledge Map Sync/bootstrap-v1/'+DEFAULT_LAYOUT_VAULT_ID;await f.adapter.mkdir(dir);
 await f.adapter.writeBinary(dir+'/'+'f'.repeat(64)+'.'+'3'.repeat(32)+'.json',new TextEncoder().encode('{"version":9}').buffer);
 const r=await f.host.startEasySync();assert.equal(r.kind,'held');assert.equal(f.host.easySyncState().phase,'paused');
 assert.equal(f.host.state().selected,null);assert.equal((await createDefaultLayoutBootstrap(f.adapter).scan()).facts,0);await f.close();
});
await fs.mkdir('.local/sync-ux/a2',{recursive:true});await fs.writeFile('.local/sync-ux/a2/easy-setup-check.json',JSON.stringify({passed:checks.length,checks},null,2));console.log(JSON.stringify({passed:checks.length,checks}));