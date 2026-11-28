// SYNC-UX-A1: default-layout bootstrap discovery and initialization.
// Synthetic adapter and App/Web Locks contracts; not native Obsidian or service.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createSyncConnectionCatalog} from '../src/sync/connection-catalog.mjs';
import {openSyncConnections} from '../src/sync/connection-registry.mjs';
import {createAttemptHistory} from '../src/sync/attempt-history-prototype.mjs';
import {createDefaultLayoutBootstrap,DEFAULT_LAYOUT_VAULT_ID,DEFAULT_LAYOUT_SEED,DEFAULT_LAYOUT_BODY,defaultLayoutBodyText,defaultLayoutBootstrapDirectory,deriveDefaultLayoutVaultId} from '../src/sync/default-layout-bootstrap.mjs';
import {cloneBoundedSyncJson} from '../src/sync/causal-prototype.mjs';
import {syncContentHash} from '../src/sync/persistence-prototype.mjs';
import {testLocalApp,testLockManager} from './sync-host-test-helpers.mjs';
const pluginId='knowledge-graph-smoke',id=n=>n.toString(16).padStart(32,'0'),a=id(1),b=id(2);
const base=path.resolve('.local/sync-ux/a1'),checks=[];
const encoder=new TextEncoder();
const op=(vault,n=10)=>({protocol:2,layoutSchema:3,vault,id:id(n),parents:[],changes:[{group:'root',value:null}],structures:{}});
function memoryAdapter(){
 const files=new Map(),folders=new Set(),reads=[];
 return {files,folders,reads,
  async stat(p){return files.has(p)?{type:'file',size:files.get(p).length}:folders.has(p)?{type:'folder',size:0}:null;},
  async list(p){const immediate=n=>n.startsWith(p+'/')&&!n.slice(p.length+1).includes('/');return {files:[...files.keys()].filter(immediate),folders:[...folders].filter(immediate)};},
  async readBinary(p){reads.push(p);return Uint8Array.from(files.get(p)).buffer;},
  async mkdir(p){folders.add(p);},async writeBinary(p,raw){files.set(p,new Uint8Array(raw));},
  async seed(p,raw){let head='';for(const bit of p.split('/').slice(0,-1)){head=head?head+'/'+bit:bit;folders.add(head);}files.set(p,typeof raw==='string'?encoder.encode(raw):new Uint8Array(raw));},
 };
}
async function put(io,vault=a,n=10){const history=createAttemptHistory(io,vault),operation=op(vault,n),text=JSON.stringify(cloneBoundedSyncJson(operation));const hash=await syncContentHash(text);const name=await history.allocate(operation.id,hash,[]);await history.write(name,text);return name;}
const catalog=io=>createSyncConnectionCatalog({adapter:io});
async function test(name,fn){await fn();checks.push(name);}
const directory=defaultLayoutBootstrapDirectory();

await test('Fixed default namespace derives from the published seed and body is canonical',async()=>{
 assert.equal(await deriveDefaultLayoutVaultId(),DEFAULT_LAYOUT_VAULT_ID);
 assert.equal(DEFAULT_LAYOUT_VAULT_ID,'71e90242bea19488f2a16c60f78fcabc');
 assert.equal(await syncContentHash(DEFAULT_LAYOUT_SEED).then(h=>h.slice(0,32)),DEFAULT_LAYOUT_VAULT_ID);
 assert.deepEqual(JSON.parse(defaultLayoutBodyText()),DEFAULT_LAYOUT_BODY);
 assert.equal(defaultLayoutBodyText(),JSON.stringify(cloneBoundedSyncJson(DEFAULT_LAYOUT_BODY)));
 assert.equal(directory,'Knowledge Map Sync/bootstrap-v1/'+DEFAULT_LAYOUT_VAULT_ID);
});
await test('Ensure writes one immutable verified record; discovery alone never writes',async()=>{
 const io=memoryAdapter(),bootstrap=createDefaultLayoutBootstrap(io,{nextId:()=>id(7)});
 const empty=await catalog(io).scan();assert.equal(empty.kind,'catalog');assert.deepEqual(empty.candidates,[]);assert.equal(io.files.size,0);
 const written=await bootstrap.ensure();assert.equal(written.kind,'written');
 assert.match(written.name.slice(directory.length+1),/^[a-f0-9]{64}\.[a-f0-9]{32}\.json$/);
 const hash=await syncContentHash(defaultLayoutBodyText());
 assert.equal(written.name,directory+'/'+hash+'.'+id(7)+'.json');
 assert.equal(new TextDecoder().decode(io.files.get(written.name)),defaultLayoutBodyText());
 const again=await bootstrap.ensure();assert.equal(again.kind,'present');assert.equal(io.files.size,1);
 const scan=await bootstrap.scan();assert.equal(scan.facts,1);assert.deepEqual(scan.blockers,[]);
});
await test('Catalog discovers a bootstrap-only candidate without layout operations',async()=>{
 const io=memoryAdapter();await createDefaultLayoutBootstrap(io,{nextId:()=>id(7)}).ensure();
 const r=await catalog(io).scan();assert.equal(r.kind,'catalog');
 assert.deepEqual(r.candidates,[{vault:DEFAULT_LAYOUT_VAULT_ID,transport:'attempts-v1',access:'read-write',operations:0,bootstrapOnly:true}]);
 assert.deepEqual(r.namespaces,[{vault:DEFAULT_LAYOUT_VAULT_ID,transport:'attempts-v1'}]);
 assert.equal(r.files,1);assert.ok(r.bytes>0);
 const again=await catalog(io).scan();assert.equal(again.fingerprint,r.fingerprint);
});
await test('Two offline devices converge on one initialization fact after exchange',async()=>{
 const ioA=memoryAdapter(),ioB=memoryAdapter();
 const wa=await createDefaultLayoutBootstrap(ioA,{nextId:()=>id(7)}).ensure();
 const wb=await createDefaultLayoutBootstrap(ioB,{nextId:()=>id(8)}).ensure();
 assert.notEqual(wa.name,wb.name);
 const merged=memoryAdapter();
 for(const io of [ioA,ioB])for(const [name,bytes] of io.files)await merged.seed(name,bytes);
 for(const folder of [...ioA.folders,...ioB.folders])merged.folders.add(folder);
 const r=await catalog(merged).scan();assert.equal(r.kind,'catalog');
 assert.equal(r.candidates.length,1);assert.equal(r.candidates[0].bootstrapOnly,true);assert.equal(r.candidates[0].operations,0);
 assert.equal(r.files,2);
 const scan=await createDefaultLayoutBootstrap(merged).scan();assert.equal(scan.facts,1);assert.deepEqual(scan.blockers,[]);
 const again=await createDefaultLayoutBootstrap(merged,{nextId:()=>id(9)}).ensure();assert.equal(again.kind,'present');assert.equal(merged.files.size,2);
});
await test('Other vault directories are neither scanned nor merged; random histories stay separate',async()=>{
 const io=memoryAdapter();await createDefaultLayoutBootstrap(io,{nextId:()=>id(7)}).ensure();await put(io,a);
 const r=await catalog(io).scan();assert.equal(r.kind,'catalog');
 assert.deepEqual(r.candidates.map(c=>[c.vault,c.bootstrapOnly]).sort(),[[a,false],[DEFAULT_LAYOUT_VAULT_ID,true]].sort());
 const foreign=memoryAdapter();await foreign.seed('Knowledge Map Sync/bootstrap-v1/'+a+'/'+id(7)+'.json',defaultLayoutBodyText());
 assert.equal((await catalog(foreign).scan()).reason,'catalog-bootstrap-namespace');
});
await test('Existing history candidates are marked bootstrapOnly false even with a bootstrap record',async()=>{
 const io=memoryAdapter();await createDefaultLayoutBootstrap(io,{nextId:()=>id(7)}).ensure();
 await put(io,DEFAULT_LAYOUT_VAULT_ID,10);
 const r=await catalog(io).scan();assert.equal(r.kind,'catalog');
 assert.deepEqual(r.candidates,[{vault:DEFAULT_LAYOUT_VAULT_ID,transport:'attempts-v1',access:'read-write',operations:1,bootstrapOnly:false}]);
 assert.equal(r.namespaces.length,1);
});
await test('Damaged, foreign-version, truncated and unknown bootstrap inputs pause discovery',async()=>{
 const hash=await syncContentHash(defaultLayoutBodyText());
 for(const mode of ['truncated','unknown-name','foreign-version','extra-field','noncanonical']){
  const io=memoryAdapter();
  if(mode==='truncated')await io.seed(directory+'/'+hash+'.'+id(7)+'.json',encoder.encode(defaultLayoutBodyText()).slice(0,20));
  if(mode==='unknown-name')await io.seed(directory+'/manifest.json',defaultLayoutBodyText());
  if(mode==='foreign-version'){const body=JSON.stringify(cloneBoundedSyncJson({...DEFAULT_LAYOUT_BODY,version:2}));await io.seed(directory+'/'+await syncContentHash(body)+'.'+id(7)+'.json',body);}
  if(mode==='extra-field'){const body=JSON.stringify(cloneBoundedSyncJson({...DEFAULT_LAYOUT_BODY,extra:1}));await io.seed(directory+'/'+await syncContentHash(body)+'.'+id(7)+'.json',body);}
  if(mode==='noncanonical')await io.seed(directory+'/'+hash+'.'+id(7)+'.json',JSON.stringify(DEFAULT_LAYOUT_BODY));
  const r=await catalog(io).scan();assert.equal(r.kind,'held',mode);assert.equal(r.candidates,undefined);
 }
});
await test('A truncated transfer recovers when the complete same-hash record arrives',async()=>{
 const io=memoryAdapter();const written=await createDefaultLayoutBootstrap(io,{nextId:()=>id(7)}).ensure();
 const full=io.files.get(written.name),partial=memoryAdapter();
 await partial.seed(written.name,full.slice(0,15));
 assert.equal((await catalog(partial).scan()).kind,'held');
 await partial.seed(written.name,full);
 const r=await catalog(partial).scan();assert.equal(r.kind,'catalog');assert.equal(r.candidates.length,1);
 const duplicate=memoryAdapter();await duplicate.seed(written.name,full);await duplicate.seed(written.name.replace(id(7),id(8)),full);
 const d=await catalog(duplicate).scan();assert.equal(d.kind,'catalog');assert.equal(d.candidates.length,1);assert.equal(d.candidates[0].operations,0);
});
await test('Bootstrap scope and budgets follow the shared protection rules',async()=>{
 const sub=memoryAdapter();await sub.seed(directory+'/nested/'+id(7)+'.json',defaultLayoutBodyText());
 assert.equal((await catalog(sub).scan()).reason,'catalog-bootstrap-scope');
 const rootFile=memoryAdapter();await rootFile.seed('Knowledge Map Sync/bootstrap-v1/stray.json','{}');
 assert.equal((await catalog(rootFile).scan()).reason,'catalog-root-file');
 const many=memoryAdapter(),hash=await syncContentHash(defaultLayoutBodyText());
 for(let i=1;i<=1025;i++)await many.seed(directory+'/'+hash+'.'+id(i)+'.json',defaultLayoutBodyText());
 const r=await catalog(many).scan();assert.equal(r.kind,'held');assert.equal(many.reads.length,0);
});
await test('A bootstrap record arriving mid-scan invalidates the observation',async()=>{
 const io=memoryAdapter();await createDefaultLayoutBootstrap(io,{nextId:()=>id(7)}).ensure();
 const hash=await syncContentHash(defaultLayoutBodyText()),read=io.readBinary;let fired=false;
 io.readBinary=async p=>{const result=await read(p);if(!fired&&p.startsWith(directory+'/')){fired=true;io.readBinary=read;await io.seed(directory+'/'+hash+'.'+id(8)+'.json',defaultLayoutBodyText());}return result;};
 assert.equal((await catalog(io).scan()).reason,'catalog-scan-changed');
});
await test('Ensure refuses damaged input and recovers its own truncated attempt',async()=>{
 const hash=await syncContentHash(defaultLayoutBodyText());
 const damaged=memoryAdapter();await damaged.seed(directory+'/manifest.json','{}');
 const refused=await createDefaultLayoutBootstrap(damaged,{nextId:()=>id(7)}).ensure();
 assert.equal(refused.kind,'held');assert.equal(damaged.files.size,1);
 const io=memoryAdapter(),name=directory+'/'+hash+'.'+id(7)+'.json';
 await io.seed(name,encoder.encode(defaultLayoutBodyText()).slice(0,18));
 const held=await createDefaultLayoutBootstrap(io,{nextId:()=>id(8)}).ensure();assert.equal(held.kind,'held');
 const recovered=await createDefaultLayoutBootstrap(io,{nextId:()=>id(8)}).ensure({attempts:[name]});
 assert.equal(recovered.kind,'written');assert.notEqual(recovered.name,name);
 const r=await catalog(io).scan();assert.equal(r.kind,'catalog');assert.equal(r.candidates.length,1);
});
await test('Registry can select a bootstrap-only candidate; selection is not acceptance',async()=>{
 const io=memoryAdapter();await createDefaultLayoutBootstrap(io,{nextId:()=>id(7)}).ensure();
 const app=testLocalApp(),locks=testLockManager();
 const registry=await openSyncConnections({app,pluginId,locks,catalog:catalog(io),nextId:()=>{throw Error('no random ID for the fixed default');}});
 const preview=await registry.preview({action:'join',vault:DEFAULT_LAYOUT_VAULT_ID,transport:'attempts-v1'});
 assert.equal(preview.kind,'selection-preview');
 const before=io.files.size;
 assert.equal((await registry.confirm(preview.token)).kind,'selected');
 assert.equal(registry.state().selected.vault,DEFAULT_LAYOUT_VAULT_ID);
 assert.equal(registry.assertSelected({write:true}).transport,'attempts-v1');
 assert.equal(io.files.size,before);
 assert.equal((await registry.preview({action:'new',vault:DEFAULT_LAYOUT_VAULT_ID})).reason,'id-collision');
 await registry.device.disable();await registry.close();
 const cold=await openSyncConnections({app,pluginId,locks,catalog:catalog(io),nextId:()=>{throw Error('no new ID on reopen');}});
 assert.equal(cold.state().selected.vault,DEFAULT_LAYOUT_VAULT_ID);await cold.close();
});
await fs.mkdir(base,{recursive:true});
const result={passed:checks.length,checks,scope:'Synthetic adapter and App/Web Locks contracts; not native Obsidian, Nutstore, iPad or real transfer.'};
await fs.writeFile(path.join(base,'bootstrap-check.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));