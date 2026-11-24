import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
import {createLayoutActionAuthor} from '../src/sync/author-prototype.mjs';
import {createAttemptHistory} from '../src/sync/attempt-history-prototype.mjs';
import {createDurableSyncSession} from '../src/sync/persistence-prototype.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';

const vault='a'.repeat(32),id=n=>n.toString(16).padStart(32,'0');
const empty={schemaVersion:3,revision:0,groups:{},structures:{}};
const files=['A','B'].map(name=>({path:'Synthetic/'+name+'.md',text:'# First\nBody\n# Second\nSecond body\n'}));
const graph=()=>buildGraph({files,config:{include:['Synthetic/**']}});
const model=()=>{const g=graph();return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
async function change(dx,note='A'){
 const g=graph(),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius);
 const node=g.nodes.find(n=>n.path==='Synthetic/'+note+'.md'&&n.title==='Second');
 assert.equal(e.begin(node.id),null);e.move(node.x+dx,node.y+3);e.commit();
 const group=m.groupKey(node.id);let disk;
 const store=createLayoutStore(null,async value=>{disk=value;});await store.command({},'edit',group,m.capture(group));
 return {group,value:{schemaVersion:3,record:disk.groups[group],structures:disk.structures}};
}
const left=await change(-8),right=await change(8),other=await change(5,'B');
const base=path.resolve('.local/sync-016/a5');await fs.mkdir(base,{recursive:true});
const out=await fs.mkdtemp(path.join(base,'resolution-check-')),checks=[];
function adapter(root,{write}={}){
 const abs=name=>path.join(root,'shared',name);
 return {abs,async stat(name){try{const s=await fs.stat(abs(name));return {type:s.isDirectory()?'folder':'file',size:s.size};}catch(e){if(e.code==='ENOENT')return null;throw e;}},
  async list(name){const rows=await fs.readdir(abs(name),{withFileTypes:true});return {files:rows.filter(r=>r.isFile()).map(r=>name+'/'+r.name),folders:rows.filter(r=>r.isDirectory()).map(r=>name+'/'+r.name)};},
  async readBinary(name){return Uint8Array.from(await fs.readFile(abs(name))).buffer;},mkdir:name=>fs.mkdir(abs(name)),
  writeBinary:async(name,bytes)=>write?write(abs(name),Buffer.from(bytes)):fs.writeFile(abs(name),Buffer.from(bytes))};
}
async function open(root,options={}){
 await fs.mkdir(path.join(root,'shared'),{recursive:true});
 const io=adapter(root,options),history=createAttemptHistory(io,vault);
 const session=createDurableSyncSession({privateStore:createNodeSyncStore(path.join(root,'private')),attemptHistory:history,
  vault,installation:id(100),createModel:model,nextId:()=>id(99),enableConflictResolution:true,...options});
 await session.open();if(!session.state().initialized)await session.initialize({source:'explicit-empty',localBaseline:empty});
 return {root,io,history,session};
}
function draft(host,c,n){const accepted=host.session.state().accepted;
 return createLayoutActionAuthor({vault,createModel:model,nextId:()=>id(n)}).prepareEdit({vault,sharedScanComplete:true,
  records:accepted.operations,appliedIds:accepted.appliedIds,localBaseline:accepted.snapshot},[c]);}
async function relay(a,b){
 const scan=await a.history.scan();await fs.mkdir(b.io.abs(b.history.directory),{recursive:true});
 for(const row of scan.inventory)if(!await b.io.stat(row.name))await fs.copyFile(a.io.abs(row.name),b.io.abs(row.name),fs.constants.COPYFILE_EXCL);
}
async function setup(options={}){
 const root=await fs.mkdtemp(path.join(out,'case-'));const a=await open(path.join(root,'pc'),options),b=await open(path.join(root,'ipad'));
 await a.session.stage(draft(a,left,1));assert.equal((await a.session.publish()).kind,'accepted');
 await b.session.stage(draft(b,right,2));assert.equal((await b.session.publish()).kind,'accepted');
 await relay(a,b);await relay(b,a);
 assert.equal((await a.session.acceptExternal()).reason,'shared-candidate-blocked');
 assert.equal((await b.session.acceptExternal()).reason,'shared-candidate-blocked');
 return {a,b};
}
async function test(name,run){await run();checks.push(name);}
async function inject(host,c,n){
 const operation=createLayoutActionAuthor({vault,createModel:model,nextId:()=>id(n)}).prepareEdit({vault,sharedScanComplete:true,
  records:[],appliedIds:[],localBaseline:empty},[c]).operation;
 const text=JSON.stringify((await import('../src/sync/causal-prototype.mjs')).cloneBoundedSyncJson(operation));
 const hash=await (await import('../src/sync/persistence-prototype.mjs')).syncContentHash(text);
 const name=await host.history.allocate(operation.id,hash,[]);await host.history.write(name,text);return name;
}
await test('Explicit choice publishes a third record referencing both heads; receive converges and cold reopen retains every original',async()=>{
 const {a,b}=await setup(),before=await a.history.scan(),accepted=a.session.state().accepted;
 const review=await a.session.previewConflictResolution();assert.equal(review.kind,'review');assert.equal(review.choices.length,2);
 assert.deepEqual(a.session.state().accepted,accepted);assert.equal((await a.history.scan()).fingerprint,before.fingerprint);
 assert.equal((await a.session.confirmConflictResolution(review.token,id(2))).kind,'staged');
 assert.equal((await a.session.publish()).kind,'accepted');
 assert.deepEqual(a.session.state().accepted.operations.at(-1).parents.slice().sort(),[id(1),id(2)]);
 assert.deepEqual(a.session.state().accepted.snapshot.groups,b.session.state().accepted.snapshot.groups);
 await relay(a,b);assert.equal((await b.session.acceptExternal()).kind,'accepted');
 assert.deepEqual(a.session.state().accepted,b.session.state().accepted);
 const after=await a.history.scan();assert.equal(after.count,3);
 for(const row of before.inventory)assert.deepEqual(after.inventory.find(r=>r.name===row.name),row);
 const final=a.session.state().accepted;await a.session.close();await b.session.close();
 const cold=await open(a.root);assert.deepEqual(cold.session.state().accepted,final);await cold.session.close();
});
await test('Cancel and closed-session consent do not write or accept; arbitrary tokens/choices cannot stage',async()=>{
 const {a,b}=await setup(),old=a.session.state();
 const review=await a.session.previewConflictResolution();assert.equal(a.session.discardConflictReview(review.token),true);
 assert.equal((await a.session.confirmConflictResolution(review.token,id(1))).reason,'resolution-review-required');
 assert.deepEqual(a.session.state(),old);
 const another=await a.session.previewConflictResolution();await a.session.close();
 const cold=await open(a.root);assert.equal((await cold.session.confirmConflictResolution(another.token,id(1))).reason,'resolution-review-required');
 const fresh=await cold.session.previewConflictResolution();assert.equal((await cold.session.confirmConflictResolution(fresh.token,id(77))).reason,'resolution-choice-invalid');
 assert.equal(cold.session.state().pending,null);assert.equal(cold.session.state().faulted,false);
 await cold.session.close();await b.session.close();
});
await test('New input, graph epoch, pending local draft and malformed names invalidate selection without writing',async()=>{
 let epoch=0;const {a,b}=await setup({getEpoch:()=>epoch});
 let review=await a.session.previewConflictResolution();epoch++;
 assert.equal((await a.session.confirmConflictResolution(review.token,id(1))).reason,'resolution-input-changed');
 review=await a.session.previewConflictResolution();const added=await inject(a,other,3);
 assert.equal((await a.session.confirmConflictResolution(review.token,id(1))).reason,'resolution-input-changed');
 await fs.unlink(a.io.abs(added));
 review=await a.session.previewConflictResolution();await a.session.saveLocalState({layoutDraft:{marker:true}});
 assert.equal((await a.session.confirmConflictResolution(review.token,id(1))).reason,'resolution-local-action-pending');
 await a.session.saveLocalState(null);
 await fs.writeFile(a.io.abs(a.history.directory+'/unknown.json'),'?');
 assert.equal((await a.session.previewConflictResolution()).reason,'unknown-file-name');
 assert.equal(a.session.state().pending,null);assert.equal(a.session.state().accepted.appliedIds.length,1);
 await a.session.close();await b.session.close();
});
await test('Confirmed unattempted intent can cancel; cold pending intent retries the same ID/body',async()=>{
 const {a,b}=await setup();let r=await a.session.previewConflictResolution();
 await a.session.confirmConflictResolution(r.token,id(1));await a.session.cancel();
 assert.equal(a.session.state().pending,null);await a.session.close();
 const cold=await open(a.root,{nextId:()=>id(98)});r=await cold.session.previewConflictResolution();
 assert.equal((await cold.session.confirmConflictResolution(r.token,id(2))).kind,'staged');
 const pending=cold.session.state().pending;await cold.session.close();
 const again=await open(a.root);assert.deepEqual(again.session.state().pending,pending);
 assert.equal((await again.session.publish()).kind,'accepted');assert.ok(again.session.state().accepted.appliedIds.includes(pending.id));
 await again.session.close();await b.session.close();
});
await test('New input after confirmation prevents publication and keeps the original accepted receipt',async()=>{
 const {a,b}=await setup(),accepted=a.session.state().accepted,r=await a.session.previewConflictResolution();
 await a.session.confirmConflictResolution(r.token,id(1));await inject(a,other,3);
 assert.equal((await a.session.publish()).reason,'resolution-input-changed');
 assert.equal((await a.history.scan()).count,3);assert.deepEqual(a.session.state().accepted,accepted);
 assert.equal(a.session.state().pending.publicationAttempted,false);
 await a.session.cancel();await a.session.close();await b.session.close();
});
await test('Partial resolution write retains the original prefix and cold retry uses a new path with the same operation',async()=>{
 const {a,b}=await setup();let r=await a.session.previewConflictResolution();
 await a.session.confirmConflictResolution(r.token,id(2));const expected=a.session.state().pending.operation;await a.session.close();
 const partial=await open(a.root,{write:async(file,bytes)=>{await fs.writeFile(file,bytes.subarray(0,20));throw Error('injected interruption');}});
 assert.equal((await partial.session.publish()).reason,'attempt-write-unconfirmed');await partial.session.close();
 const cold=await open(a.root);assert.deepEqual(cold.session.state().pending.operation,expected);
 assert.equal((await cold.session.publish()).kind,'accepted');assert.equal((await cold.history.scan()).count,4);
 assert.deepEqual(cold.session.state().accepted.operations.find(op=>op.id===expected.id),expected);
 await cold.session.close();await b.session.close();
});
await test('Publication completed before a private accept failure recovers from its durable resolution intent',async()=>{
 let stop=false;const {a,b}=await setup({checkpoint:async step=>{if(stop&&step==='before-accept')throw Error('injected accept interruption');}});
 const r=await a.session.previewConflictResolution();await a.session.confirmConflictResolution(r.token,id(1));stop=true;
 await assert.rejects(a.session.publish(),/injected accept interruption/);const pending=a.session.state().pending;await a.session.close();
 const cold=await open(a.root);assert.deepEqual(cold.session.state().pending,pending);
 assert.equal((await cold.session.publish()).kind,'accepted');assert.equal((await cold.history.scan()).count,3);
 await cold.session.close();await b.session.close();
});
await test('Default-disabled sessions cannot review or replay resolution intents',async()=>{
 const {a,b}=await setup();await a.session.close();
 const disabled=await open(a.root,{enableConflictResolution:false});
 assert.equal((await disabled.session.previewConflictResolution()).reason,'resolution-disabled');await disabled.session.close();
 const enabled=await open(a.root),review=await enabled.session.previewConflictResolution();
 await enabled.session.confirmConflictResolution(review.token,id(1));await enabled.session.close();
 await assert.rejects(open(a.root,{enableConflictResolution:false}),/persistence-intent/);
 await b.session.close();
});
await test('A whole conflict domain is resolved while independent remote groups remain in the accepted result',async()=>{
 const {a,b}=await setup();await inject(a,other,3);
 const r=await a.session.previewConflictResolution();assert.equal(r.kind,'review');
 assert.equal((await a.session.confirmConflictResolution(r.token,id(2))).kind,'staged');
 assert.equal((await a.session.publish()).kind,'accepted');
 assert.deepEqual(a.session.state().accepted.operations.at(-1).parents.slice().sort(),[id(1),id(2),id(3)]);
 assert.deepEqual(a.session.state().accepted.snapshot.groups[other.group],other.value.record);
 assert.deepEqual(a.session.state().accepted.snapshot.groups[left.group],right.value.record);
 await a.session.close();await b.session.close();
});
await test('ID/body quarantine cannot be cleared by branch selection or by removing the rival file',async()=>{
 const {a,b}=await setup();const rival=await inject(a,right,1);
 assert.equal((await a.session.previewConflictResolution()).reason,'attempt-conflict-review');
 await fs.unlink(a.io.abs(rival));await a.session.close();
 const cold=await open(a.root);assert.equal((await cold.session.previewConflictResolution()).reason,'attempt-conflict-review');
 assert.equal(cold.session.state().accepted.appliedIds.length,1);await cold.session.close();await b.session.close();
});
await test('Late input after publication holds acceptance and keeps the durable published decision pending',async()=>{
 let late=false,host;
 const {a,b}=await setup({checkpoint:async step=>{if(late&&step==='after-publication'){late=false;await inject(host,other,3);}}});host=a;
 const accepted=a.session.state().accepted,r=await a.session.previewConflictResolution();
 await a.session.confirmConflictResolution(r.token,id(1));late=true;
 assert.equal((await a.session.publish()).reason,'resolution-input-changed');
 assert.deepEqual(a.session.state().accepted,accepted);assert.equal(a.session.state().pending.publicationAttempted,true);
 await a.session.close();const cold=await open(a.root);
 assert.equal((await cold.session.publish()).reason,'resolution-input-changed');assert.deepEqual(cold.session.state().accepted,accepted);
 await cold.session.close();await b.session.close();
});
await test('A multi-domain complete selection survives disk cold reopen and preserves its original decision ID',async()=>{
 const {a,b}=await setup();await inject(a,other,3);await inject(a,await change(-5,'B'),4);const r=await a.session.previewConflictResolution();assert.equal(r.choices.length,4);
 await a.session.confirmConflictResolution(r.token,r.choices[0].id);const pending=a.session.state().pending;await a.session.close();const cold=await open(a.root);assert.equal(cold.session.state().pending.id,pending.id);assert.equal(cold.session.state().pending.choice,pending.choice);assert.equal((await cold.session.publish()).kind,'accepted');assert.equal(cold.session.state().accepted.operations.length,5);await relay(cold,b);assert.equal((await b.session.acceptExternal()).kind,'accepted');assert.deepEqual(cold.session.state().accepted.snapshot.groups,b.session.state().accepted.snapshot.groups);await cold.session.close();await b.session.close();
});
await fs.writeFile(path.join(out,'verification.json'),JSON.stringify({checks,scope:'Real Node disk/private cold reopen, injected interruptions; not OS process death or native UI.'},null,2));
console.log(JSON.stringify({out,passed:checks.length,checks}));
