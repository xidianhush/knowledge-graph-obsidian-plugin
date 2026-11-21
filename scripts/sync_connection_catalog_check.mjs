import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createSyncConnectionCatalog} from '../src/sync/connection-catalog.mjs';
import {openSyncConnections} from '../src/sync/connection-registry.mjs';
import {createAttemptHistory} from '../src/sync/attempt-history-prototype.mjs';
import {testLocalApp,testLockManager} from './sync-host-test-helpers.mjs';
import {openObsidianSyncDevice} from '../src/sync/obsidian-host-prototype.mjs';
const pluginId='knowledge-graph-smoke',id=n=>n.toString(16).padStart(32,'0'),a=id(1),b=id(2);
const base=path.resolve('.local/sync-016/unified/u1'),checks=[];
const op=(vault,n=10)=>({protocol:2,layoutSchema:3,vault,id:id(n),parents:[],changes:[{group:'root',value:null}],structures:{}});
function memoryAdapter(){
 const files=new Map(),folders=new Set(),reads=[];
 return {files,folders,reads,
  async stat(p){return files.has(p)?{type:'file',size:files.get(p).length}:folders.has(p)?{type:'folder',size:0}:null;},
  async list(p){const immediate=n=>n.startsWith(p+'/')&&!n.slice(p.length+1).includes('/');return {files:[...files.keys()].filter(immediate),folders:[...folders].filter(immediate)};},
  async readBinary(p){reads.push(p);return Uint8Array.from(files.get(p)).buffer;},
  async mkdir(p){folders.add(p);},async writeBinary(p,raw){files.set(p,new Uint8Array(raw));},
  async seed(p,raw){let head='';for(const bit of p.split('/').slice(0,-1)){head=head?head+'/'+bit:bit;folders.add(head);}files.set(p,new TextEncoder().encode(raw));},
 };
}
async function put(io,vault=a,n=10){const history=createAttemptHistory(io,vault),operation=op(vault,n),text=JSON.stringify((await import('../src/sync/causal-prototype.mjs')).cloneBoundedSyncJson(operation));const hash=await (await import('../src/sync/persistence-prototype.mjs')).syncContentHash(text);const name=await history.allocate(operation.id,hash,[]);await history.write(name,text);return name;}
async function fixture(extra={}){const adapter=extra.adapter??memoryAdapter(),app=extra.app??testLocalApp(),locks=extra.locks??testLockManager();const catalog=createSyncConnectionCatalog({adapter});const registry=await openSyncConnections({app,pluginId,locks,catalog,nextId:()=>id(99),...extra});return {adapter,app,locks,catalog,registry};}
async function test(name,fn){await fn();checks.push(name);}
const key=pluginId+':sync-connections-v1';
await test('Discovery is read-only; no library is invented from an empty directory',async()=>{
 const io=memoryAdapter(),r=await createSyncConnectionCatalog({adapter:io}).scan();assert.equal(r.kind,'catalog');assert.deepEqual(r.candidates,[]);assert.equal(io.files.size,0);
 io.folders.add('Knowledge Map Sync/attempts-v1/'+a);io.folders.add('Knowledge Map Sync/attempts-v1');
 const empty=await createSyncConnectionCatalog({adapter:io}).scan();assert.equal(empty.kind,'catalog');assert.deepEqual(empty.candidates,[]);assert.equal(empty.namespaces.length,1);
});
await test('Valid attempts and legacy v2 are separate candidates with read-only legacy access',async()=>{
 const io=memoryAdapter();await put(io,a);await io.seed('Knowledge Map Sync/v2/'+b+'/ops/'+id(11)+'.json',JSON.stringify(op(b,11)));
 const r=await createSyncConnectionCatalog({adapter:io}).scan();assert.equal(r.kind,'catalog');assert.deepEqual(r.candidates.map(c=>[c.transport,c.vault,c.access]).sort(),[['attempts-v1',a,'read-write'],['v2',b,'read-only']]);
});
await test('Multiple histories do not choose a latest library or change the device connection',async()=>{
 const f=await fixture();await put(f.adapter,a);await put(f.adapter,b,11);assert.equal((await f.catalog.scan()).candidates.length,2);assert.equal(f.registry.state().selected,null);assert.equal(f.registry.device.state().connection,null);await f.registry.close();
});
await test('Unknown folders, wrong scoped paths and oversized namespace discovery block without partial success',async()=>{
 for(const mode of ['unknown','scope','budget']){const io=memoryAdapter();io.folders.add('Knowledge Map Sync/attempts-v1');
  if(mode==='unknown')io.folders.add('Knowledge Map Sync/attempts-v1/not-an-id');
  if(mode==='scope')io.list=async()=>({files:[],folders:['../outside']});
  if(mode==='budget')for(let i=1;i<=33;i++)io.folders.add('Knowledge Map Sync/attempts-v1/'+id(i));
  const r=await createSyncConnectionCatalog({adapter:io}).scan();assert.equal(r.kind,'held',mode);assert.equal(r.candidates,undefined);assert.equal(io.reads.length,0);
 }
});
await test('Damaged, unknown, missing-predecessor and same-ID bodies are not presented as usable joins',async()=>{
 for(const mode of ['damaged','unknown','missing','same-id']){const io=memoryAdapter();const name=await put(io,a);
  if(mode==='damaged')io.files.set(name,new Uint8Array([123]));
  if(mode==='unknown')await io.seed('Knowledge Map Sync/attempts-v1/'+a+'/ops/unrecognized.json','{}');
  if(mode==='missing'||mode==='same-id'){
   const history=createAttemptHistory(io,a),operation=op(a,mode==='missing'?12:10);if(mode==='missing')operation.parents=[id(999)];else operation.changes=[{group:JSON.stringify(['note','Other.md','']),value:null}];
   const {cloneBoundedSyncJson}=await import('../src/sync/causal-prototype.mjs'),{syncContentHash}=await import('../src/sync/persistence-prototype.mjs');const text=JSON.stringify(cloneBoundedSyncJson(operation)),name=await history.allocate(operation.id,await syncContentHash(text),[]);await history.write(name,text);
  }
  assert.equal((await createSyncConnectionCatalog({adapter:io}).scan()).kind,'held',mode);
 }
});
await test('Record and total read budgets are enforced before reading oversized bytes',async()=>{
 const io=memoryAdapter();await put(io,a);const original=io.stat;io.stat=async p=>{const s=await original(p);return s?.type==='file'?{...s,size:2097153}:s;};
 assert.equal((await createSyncConnectionCatalog({adapter:io}).scan()).kind,'held');assert.equal(io.reads.length,0);
});
await test('Aggregate bytes across namespaces and physical file count stop before extra reads',async()=>{
 const io=memoryAdapter();for(let i=1;i<=17;i++){const body=JSON.stringify(op(id(i)));await io.seed('Knowledge Map Sync/v2/'+id(i)+'/ops/'+id(10)+'.json',' '.repeat(2097152-body.length)+body);}
 assert.equal((await createSyncConnectionCatalog({adapter:io}).scan()).kind,'held');assert.equal(io.reads.length,16);
 const many=memoryAdapter();for(let i=1;i<=1025;i++)await many.seed('Knowledge Map Sync/v2/'+a+'/ops/'+id(i)+'.json',JSON.stringify(op(a,i)));
 assert.equal((await createSyncConnectionCatalog({adapter:many}).scan()).kind,'held');assert.equal(many.reads.length,0);
});
await test('A namespace arriving while reading a body invalidates the whole discovery',async()=>{
 const io=memoryAdapter();await put(io,a);const read=io.readBinary;io.readBinary=async p=>{const result=await read(p);io.folders.add('Knowledge Map Sync/attempts-v1/'+b);return result;};
 assert.equal((await createSyncConnectionCatalog({adapter:io}).scan()).reason,'catalog-scan-changed');
});
await test('An ops listing that grows between inspections never bypasses the global file-read budget',async()=>{
 const io=memoryAdapter();for(const [vault,count] of [[a,800],[b,600]]){const first=await put(io,vault),raw=new TextDecoder().decode(io.files.get(first));for(let i=1;i<count;i++)await io.seed(first.replace(/\.[a-f0-9]{32}\.json$/,'.'+id(i)+'.json'),raw);}
 const list=io.list;let times=0;io.list=async p=>{const row=await list(p);return p==='Knowledge Map Sync/attempts-v1/'+b+'/ops'&&++times===1?{...row,files:row.files.slice(0,100)}:row;};
 const r=await createSyncConnectionCatalog({adapter:io}).scan();assert.equal(r.kind,'held');assert.ok(io.reads.length<=1024,'read '+io.reads.length+' physical files');
});
await test('Preview/cancel never persists a choice, namespace or acceptance; confirmation creates only local binding',async()=>{
 const f=await fixture(),before=f.app.writes();const preview=await f.registry.preview({action:'new'});assert.equal(preview.kind,'selection-preview');assert.equal(f.app.writes(),before);assert.equal(f.adapter.files.size,0);
 f.registry.discard(preview.token);assert.equal((await f.registry.confirm(preview.token)).reason,'selection-review-required');
 const fresh=await f.registry.preview({action:'new'});assert.equal((await f.registry.confirm(fresh.token)).kind,'selected');assert.equal(f.registry.state().selected.vault,id(99));assert.equal(f.adapter.files.size,0);assert.equal(f.registry.device.anchor(id(99)),null);await f.registry.close();
});
await test('Data.json-looking data and copied local binding cannot create an acceptance or replace identity',async()=>{
 const f=await fixture();f.app.entries.set('data.json',{sync:{vault:a,accepted:[id(10)]}});assert.equal(f.registry.state().selected,null);
 const p=await f.registry.preview({action:'new'});await f.registry.confirm(p.token);const meta=f.app.entries.get(key);await f.registry.close();
 const app=testLocalApp();app.entries.set(key,meta);await assert.rejects(fixture({app}),/identity-missing/);assert.equal(app.writes(),0);
});
await test('Directory input changing after preview expires selection without saving a binding',async()=>{
 const f=await fixture();await put(f.adapter,a);const p=await f.registry.preview({action:'join',vault:a,transport:'attempts-v1'});await put(f.adapter,b,11);
 assert.equal((await f.registry.confirm(p.token)).reason,'selection-input-changed');assert.equal(f.registry.state().selected,null);assert.equal(f.app.entries.has(key),false);await f.registry.close();
});
await test('Legacy choice is explicitly read-only; matching vault ID cannot silently switch transport',async()=>{
 const f=await fixture();await f.adapter.seed('Knowledge Map Sync/v2/'+a+'/ops/'+id(10)+'.json',JSON.stringify(op(a)));
 const p=await f.registry.preview({action:'join',vault:a,transport:'v2'});await f.registry.confirm(p.token);assert.throws(()=>f.registry.assertSelected({write:true}),/read-only/);assert.equal(f.registry.assertSelected({write:false}).transport,'v2');
 await f.registry.device.disable();await put(f.adapter,a);const other=await f.registry.preview({action:'join',vault:a,transport:'attempts-v1'});assert.equal(other.reason,'transport-binding-mismatch');await f.registry.close();
});
await test('Existing unknown legacy binding is never guessed or cleared',async()=>{
 const app=testLocalApp(),locks=testLockManager(),device=await openObsidianSyncDevice({app,pluginId,locks});await device.connect(a);const before=structuredClone([...app.entries]);
 await assert.rejects(fixture({app,locks}),/binding-missing/);assert.deepEqual([...app.entries],before);
});
await test('Selection cannot switch away from an enabled library or replace a busy device session',async()=>{
 const f=await fixture();let p=await f.registry.preview({action:'new'});await f.registry.confirm(p.token);await put(f.adapter,a);
 assert.equal((await f.registry.preview({action:'join',vault:a,transport:'attempts-v1'})).reason,'disable-before-switch');
 await put(f.adapter,id(99));p=await f.registry.preview({action:'join',vault:id(99),transport:'attempts-v1'});assert.equal(p.kind,'selection-preview');
 const release=await f.registry.device.acquire(id(99));await assert.rejects(f.registry.confirm(p.token),/device-busy/);assert.ok(f.registry.state().pending);await release();await f.registry.close();
});
await test('All 32 bindings and anchors survive a rejected 33rd selection without pruning',async()=>{
 let n=100;const f=await fixture({nextId:()=>id(n++)});
 for(let i=0;i<32;i++){const p=await f.registry.preview({action:'new'});assert.equal((await f.registry.confirm(p.token)).kind,'selected');await f.registry.device.anchorEvent(p.selection.vault,'events/000000000001.json','anchor-'+i);await f.registry.device.disable();}
 const before=structuredClone([...f.app.entries]),r=await f.registry.preview({action:'new'});assert.equal(r.reason,'binding-budget');assert.deepEqual([...f.app.entries],before);assert.equal(f.registry.state().bindings.length,32);await f.registry.close();
});
await test('An old anchored vault without a transport binding is neither minted as new nor guessed on join',async()=>{
 const ids=[id(99),a,b],f=await fixture({nextId:()=>ids.shift()});const p=await f.registry.preview({action:'new'});await f.registry.confirm(p.token);
 await f.registry.device.disable();await f.registry.device.connect(a);await f.registry.device.anchorEvent(a,'events/000000000001.json','old-anchor');await f.registry.device.disable();await f.registry.device.connect(id(99));
 await f.registry.device.disable();const fresh=await f.registry.preview({action:'new'});assert.equal(fresh.selection.vault,b);
 await put(f.adapter,a);assert.equal((await f.registry.preview({action:'join',vault:a,transport:'attempts-v1'})).reason,'anchor-without-transport-binding');await f.registry.close();
});
await test('Unbound old anchors still consume the 32-library budget even with a short binding list',async()=>{
 let next=99;const f=await fixture({nextId:()=>id(next++)}),p=await f.registry.preview({action:'new'});await f.registry.confirm(p.token);await f.registry.device.disable();
 for(let i=1;i<=32;i++){await f.registry.device.connect(id(i));await f.registry.device.anchorEvent(id(i),'events/000000000001.json','old-'+i);await f.registry.device.disable();}
 await f.registry.device.connect(id(99));await f.registry.device.disable();const before=structuredClone([...f.app.entries]);
 assert.equal((await f.registry.preview({action:'new'})).reason,'binding-budget');assert.deepEqual([...f.app.entries],before);await f.registry.close();
});
await test('Directory arrival after base connection holds metadata commit until explicit fresh review',async()=>{
 const adapter=memoryAdapter();let arrived=false;
 const f=await fixture({adapter,checkpoint:async step=>{if(step==='after-selection-connect'&&!arrived){arrived=true;await put(adapter,a);}}});
 const p=await f.registry.preview({action:'new'});const r=await f.registry.confirm(p.token);assert.equal(r.reason,'selection-input-changed');assert.equal(f.registry.state().selected,null);assert.equal(f.registry.state().pending.selection.vault,id(99));
 const review=await f.registry.preview({action:'resume'});assert.equal((await f.registry.confirm(review.token)).kind,'selected');assert.equal(f.registry.state().selected.vault,id(99));await f.registry.close();
});
await test('Reopening preserves identity, bound transport and progress anchors with no fresh choice or writes',async()=>{
 const f=await fixture();await put(f.adapter,a);const p=await f.registry.preview({action:'join',vault:a,transport:'attempts-v1'});await f.registry.confirm(p.token);
 await f.registry.device.anchorEvent(a,'events/000000000001.json','synthetic-anchor');const original=f.registry.state(),anchor=f.registry.device.anchor(a);await f.registry.close();const writes=f.app.writes();
 const cold=await fixture({adapter:f.adapter,app:f.app,locks:f.locks,nextId:()=>{throw Error('no new ID');}});assert.deepEqual(cold.registry.state(),original);assert.deepEqual(cold.registry.device.anchor(a),anchor);assert.equal(f.app.writes(),writes);await cold.registry.close();
});
await test('Concurrent registries and tampered metadata fail without replacing prior local state',async()=>{
 const f=await fixture();await assert.rejects(fixture({app:f.app,locks:f.locks,adapter:f.adapter}),/registry-busy/);
 const p=await f.registry.preview({action:'new'});await f.registry.confirm(p.token);await f.registry.close();const raw=f.app.entries.get(key);f.app.entries.set(key,raw.replace('attempts-v1','v2'));const before=f.app.writes();await assert.rejects(fixture({app:f.app,locks:f.locks,adapter:f.adapter}),/authentication|metadata/);assert.equal(f.app.writes(),before);
});
await test('Read failures including non-Error adapter rejections return a held discovery and can recover',async()=>{
 for(const error of [null,'IO unavailable',{message:123},Error('IO unavailable')]){const io=memoryAdapter();io.stat=async()=>{throw error;};assert.equal((await createSyncConnectionCatalog({adapter:io}).scan()).kind,'held');}
 const io=memoryAdapter();await put(io,a);const read=io.readBinary;io.readBinary=async()=>{throw Error('IO');};assert.equal((await createSyncConnectionCatalog({adapter:io}).scan()).kind,'held');io.readBinary=read;assert.equal((await createSyncConnectionCatalog({adapter:io}).scan()).kind,'catalog');
});
await test('Failed local save does not enable the device; uncertain completed save recovers the same selection',async()=>{
 const f=await fixture(),p=await f.registry.preview({action:'new'});f.app.onSave(()=>{throw Error('quota');});await assert.rejects(f.registry.confirm(p.token),/quota/);
 assert.equal(f.registry.state().selected,null);assert.equal(f.registry.state().pending,null);assert.equal(f.registry.device.state().connection,null);f.app.onSave(null);await f.registry.close();
 const app=testLocalApp(),locks=testLockManager(),adapter=memoryAdapter(),save=app.saveLocalStorage;
 app.saveLocalStorage=(name,value)=>{save(name,value);if(name===key)throw Error('ack-lost');};const g=await fixture({app,locks,adapter}),preview=await g.registry.preview({action:'new'});
 await assert.rejects(g.registry.confirm(preview.token),/ack-lost/);assert.equal(g.registry.device.state().connection,null);await g.registry.close();app.saveLocalStorage=save;
 const cold=await fixture({app,locks,adapter,nextId:()=>{throw Error('no new ID');}});assert.equal(cold.registry.state().selected.vault,id(99));assert.equal(adapter.files.size,0);await cold.registry.close();
});
await test('Unconfirmed write readback never reports a selected connection or replaces damaged metadata',async()=>{
 const app=testLocalApp(),save=app.saveLocalStorage;app.saveLocalStorage=(name,value)=>{save(name,value);if(name===key)app.entries.set(name,value+'changed');};
 const f=await fixture({app}),p=await f.registry.preview({action:'new'});await assert.rejects(f.registry.confirm(p.token),/write-unconfirmed/);assert.equal(f.registry.device.state().connection,null);
 const corrupt=app.entries.get(key);await f.registry.close();app.saveLocalStorage=save;await assert.rejects(fixture({app,locks:f.locks,adapter:f.adapter}),/authentication|metadata/);assert.equal(app.entries.get(key),corrupt);
});
await test('Cold pending choice with new directory input stays held until a fresh explicit preview',async()=>{
 const f=await fixture({checkpoint:async step=>{if(step==='after-selection-intent')throw Error('stop');}}),p=await f.registry.preview({action:'new'});await assert.rejects(f.registry.confirm(p.token),/stop/);await f.registry.close();await put(f.adapter,a);
 const cold=await fixture({app:f.app,locks:f.locks,adapter:f.adapter,nextId:()=>{throw Error('stable ID');}});assert.equal(cold.registry.state().selected,null);assert.equal(cold.registry.state().pending.selection.vault,id(99));
 assert.equal((await cold.registry.resume()).reason,'selection-input-changed');const fresh=await cold.registry.preview({action:'resume'});assert.equal((await cold.registry.confirm(fresh.token)).kind,'selected');assert.equal(cold.registry.state().selected.vault,id(99));await cold.registry.close();
});
await fs.mkdir(base,{recursive:true});
const result={passed:checks.length,checks,scope:'Synthetic adapter and App/Web Locks contracts; not native Obsidian or service.'};
await fs.writeFile(path.join(base,'catalog-check.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
