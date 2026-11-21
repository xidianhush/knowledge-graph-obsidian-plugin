import assert from 'node:assert/strict';
import {createLayoutModel,createLayoutStore} from '../dist/graph-core.mjs';
import {fixture,empty,graph,layout,model,vault,value} from './sync-local-work-test-helpers.mjs';
import {createReadOnlyLayoutHistory,sharedOperationDirectory} from '../src/sync/obsidian-shared-history.mjs';
import {startObsidianLayoutReceiver} from '../src/sync/obsidian-layout-receiver.mjs';
import {packSchema3Operation} from '../src/sync/wire-prototype.mjs';

const directory=sharedOperationDirectory(vault),id='1'.repeat(32),name=directory+'/'+id+'.json';
const snapshot=await layout();
const [group]=Object.keys(snapshot.groups);
const operation=packSchema3Operation({vault,id,parents:[],changes:[{group,value:{schemaVersion:3,
  record:snapshot.groups[group],structures:snapshot.structures}}]});
const raw=JSON.stringify(operation),checks=[];
async function test(name,run){await run();checks.push(name);}

function signals(){
  const listeners=new Map();
  return {
    addEventListener(type,fn){listeners.set(type,fn);},
    removeEventListener(type,fn){assert.equal(listeners.get(type),fn);listeners.delete(type);},
    emit(type){listeners.get(type)?.();},
  };
}
async function environment({initialFiles=[],existing}={}){
  const files=new Map(initialFiles),events=new Map(),timers=new Map(),waiters=[];
  let timerId=0,reads=0,scans=0,published=0,rendered=0,localWrites=0,folderExists=true,readFails=false;
  const doc={...signals(),hidden:false};
  const win={...signals(),document:doc,
    setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);}};
  const appVault={
    on(type,fn){events.set(type,fn);return type;},offref(ref){events.delete(ref);},
    adapter:{
      async stat(path){return path===directory?(folderExists?{type:'folder'}:null):files.has(path)?{type:'file',size:Buffer.byteLength(files.get(path))}:null;},
      async list(path){assert.equal(path,directory);scans++;return {files:[...files.keys()],folders:[]};},
      async read(path){reads++;if(readFails)throw Error('file disappeared');assert.ok(files.has(path));return files.get(path);},
      async write(){published++;assert.fail('receiver wrote to Vault');},
    },
  };
  const readOnly=createReadOnlyLayoutHistory(appVault.adapter,vault);
  const shared={...readOnly,create(){published++;return readOnly.create();}};
  const previous=existing?.fixture;
  const f=await fixture({app:previous?.app,locks:previous?.locks,stores:previous?.stores,shared});
  const session=()=>f.current().session;
  const initialDraft=session().state().localState?.layoutDraft;
  const store=createLayoutStore(initialDraft?.value,async value=>{
    localWrites++;
    const result=await f.controller.run(bundle=>bundle.coordinator.stageLayoutDraft(value));
    if(result.kind!=='completed')throw Error(result.reason);
  });
  const renderedGraph=graph();
  const liveModel=createLayoutModel(renderedGraph.nodes,renderedGraph.meta.layout_root_radius);
  store.subscribe(state=>{if(!state.busy){rendered++;liveModel.apply(state.groups);}});
  let spec={createModel:model,isCurrent:()=>true},afterReceive=()=>{};
  const receiver=startObsidianLayoutReceiver({vault:appVault,logicalVault:vault,win,layoutStore:store,
    getGraph:()=>spec,readLocal:()=>session().state(),
    receive:async options=>{
      const result=await f.controller.run(({session})=>session.acceptExternal(options));
      afterReceive();
      return result.kind==='completed'?result.value:result;
    },report:result=>waiters.shift()?.(result)});
  return {
    files,receiver,store,fixture:f,session,win,doc,readOnly,renderedGraph,
    get count(){return {reads,scans,published,rendered,localWrites,timers:timers.size};},
    setFolderExists(value){folderExists=value;},
    setReadFails(value){readFails=value;},
    setAfterReceive(fn){afterReceive=fn;},
    setGraph(next){spec=next;receiver.request();},
    fire(type,path,oldPath){events.get(type)?.({path},oldPath);},
    async start(){assert.equal(timers.size,1);const report=new Promise(resolve=>waiters.push(resolve));
      const [id,callback]=timers.entries().next().value;timers.delete(id);callback();
      const result=await report;await new Promise(setImmediate);return result;},
    manual:()=>receiver.check(),
    async close(){await receiver.close();await f.controller.close();
      assert.equal(events.size,0);assert.equal(timers.size,0);},
  };
}

await test('startup, partial JSON, event coalescing and exact coordinate adoption',async()=>{
  const e=await environment();
  try{
    assert.equal((await e.start()).kind,'noop');
    e.fire('modify','Unrelated.json');assert.equal(e.count.timers,0);
    e.files.set(name,'{');e.fire('create',name);e.fire('modify',name);e.win.emit('focus');
    assert.deepEqual(await e.start(),{kind:'held',reason:'shared-partial-json'});
    assert.deepEqual(e.store.state().groups,{});
    e.files.set(name,raw);e.fire('rename',name,directory+'/upload.part');
    assert.equal((await e.start()).kind,'applied');
    const expected=graph(),expectedModel=createLayoutModel(expected.nodes,expected.meta.layout_root_radius);
    assert.deepEqual(expectedModel.apply(snapshot),{restored:1,skipped:0});
    assert.deepEqual(e.renderedGraph.nodes.map(n=>[n.id,n.x,n.y]),expected.nodes.map(n=>[n.id,n.x,n.y]));
    const sequence=e.session().state().sequence,rendered=e.count.rendered;
    e.doc.hidden=true;e.fire('modify',name);e.win.emit('focus');assert.equal(e.count.timers,0);
    e.doc.hidden=false;e.doc.emit('visibilitychange');assert.equal((await e.start()).kind,'noop');
    assert.equal(e.session().state().sequence,sequence);assert.equal(e.count.rendered,rendered);
    assert.equal(e.count.localWrites+e.count.published,0);
  }finally{await e.close();}
});

await test('drag starting during scan defers the receipt and cancellation retries once',async()=>{
  const e=await environment({initialFiles:[[name,raw]]}),owner={};
  try{
    const before=e.session().state().sequence;
    e.fixture.hook(step=>{if(step==='core:before-receive')assert.ok(e.store.acquire(owner));});
    assert.deepEqual(await e.start(),{kind:'held',reason:'layout-editing'});
    assert.equal(e.session().state().sequence,before);assert.equal(e.count.timers,0);
    e.fixture.hook(()=>{});e.store.release(owner);
    assert.equal((await e.start()).kind,'applied');assert.equal(e.count.timers,0);
  }finally{await e.close();}
});

await test('an edit ending before the held result is delivered still retries',async()=>{
  const e=await environment({initialFiles:[[name,raw]]}),owner={};
  try{
    e.fixture.hook(step=>{if(step==='core:before-receive')assert.ok(e.store.acquire(owner));});
    e.setAfterReceive(()=>{e.store.release(owner);e.fixture.hook(()=>{});e.setAfterReceive(()=>{});});
    assert.deepEqual(await e.start(),{kind:'held',reason:'layout-editing'});
    assert.equal((await e.start()).kind,'applied');assert.equal(e.count.timers,0);
  }finally{await e.close();}
});

await test('local commit wins admission and durable draft is left for review',async()=>{
  const e=await environment({initialFiles:[[name,raw]]}),owner={};
  try{
    let save;
    e.fixture.hook(step=>{if(step==='core:before-receive'){
      assert.ok(e.store.acquire(owner));
      const record=structuredClone(snapshot.groups[group]);
      record.identity=structuredClone(snapshot.structures[record.note]);
      save=e.store.command(owner,'edit',group,record);
    }});
    assert.deepEqual(await e.start(),{kind:'held',reason:'layout-editing'});
    await save;
    assert.deepEqual(await e.start(),{kind:'held',reason:'local-layout-draft'});
    assert.deepEqual(e.session().state().accepted.snapshot,empty);
    assert.ok(e.session().state().localState.layoutDraft);assert.equal(e.count.localWrites,1);
    assert.equal(e.store.state().canUndo,true);
  }finally{await e.close();}
});

await test('late graph structure retries, then a graph change after durable receive defers presentation',async()=>{
  const e=await environment({initialFiles:[[name,raw]]});
  try{
    e.setGraph({createModel:()=>({keys:()=>[]}),isCurrent:()=>true});
    assert.deepEqual(await e.start(),{kind:'held',reason:'shared-candidate-blocked'});
    assert.deepEqual(e.session().state().accepted.snapshot,empty);
    let current=true;
    e.setGraph({createModel:model,isCurrent:()=>current});
    e.fixture.hook(step=>{if(step==='core:after-receive'){
      assert.equal(e.store.acquire({}),false);current=false;
    }});
    assert.deepEqual(await e.start(),{kind:'held',reason:'graph-changed'});
    assert.deepEqual(e.session().state().accepted.appliedIds,[id]);assert.deepEqual(e.store.state().groups,{});
    assert.equal(e.store.state().locked,false);
    e.setGraph({createModel:model,isCurrent:()=>true});
    assert.equal((await e.start()).kind,'applied');
    assert.equal(e.count.localWrites+e.count.published,0);
  }finally{await e.close();}
});

await test('cold reopen uses the durable receipt even if an accepted file disappeared',async()=>{
  const e=await environment({initialFiles:[[name,raw]]});
  try{assert.equal((await e.start()).kind,'applied');}finally{await e.close();}
  const reopened=await environment({existing:e});
  try{
    assert.deepEqual(await reopened.start(),{kind:'held',reason:'accepted-record-missing'});
    assert.deepEqual(reopened.store.state().groups,e.store.state().groups);
    assert.equal(reopened.count.localWrites+reopened.count.published,0);
    await assert.rejects(reopened.readOnly.read(directory+'/../escape.json',100),/historyScope/);
    assert.throws(()=>reopened.readOnly.create(name,raw),/historyReadOnly/);
  }finally{await reopened.close();}
});

await test('missing directory and failed file read recover without reopening the private session',async()=>{
  const e=await environment({initialFiles:[[name,raw]]});
  try{
    e.setFolderExists(false);
    assert.deepEqual(await e.start(),{kind:'held',reason:'shared-scan-unavailable'});
    e.setFolderExists(true);e.setReadFails(true);e.fire('create',directory);
    assert.deepEqual(await e.start(),{kind:'held',reason:'shared-scan-unavailable'});
    assert.equal(e.session().state().faulted,false);
    e.setReadFails(false);e.fire('modify',name);
    assert.equal((await e.start()).kind,'applied');
  }finally{await e.close();}
});
await test('manual checks await real scans, serialize concurrent calls and cancel the pending debounce',async()=>{
  const e=await environment({initialFiles:[[name,raw]]});
  try{
    const [first,second]=await Promise.all([e.manual(),e.manual()]);
    assert.equal(first.kind,'applied');
    assert.equal(second.kind,'noop');
    assert.equal(e.count.timers,0);
    assert.deepEqual(e.session().state().accepted.appliedIds,[id]);
    assert.equal(e.count.published,0);
  }finally{await e.close();}
});
await test('manual checks report hidden or missing graph states and can recover without reopening',async()=>{
  const e=await environment({initialFiles:[[name,raw]]});
  try{
    e.doc.hidden=true;
    assert.deepEqual(await e.manual(),{kind:'held',reason:'view-hidden'});
    e.doc.hidden=false;e.setGraph(null);
    assert.deepEqual(await e.manual(),{kind:'held',reason:'graph-not-ready'});
    e.setGraph({createModel:model,isCurrent:()=>true});
    assert.equal((await e.manual()).kind,'applied');
  }finally{await e.close();}
  assert.deepEqual(await e.manual(),{kind:'held',reason:'receiver-closed'});
});
console.log(JSON.stringify({passed:checks.length,checks}));
