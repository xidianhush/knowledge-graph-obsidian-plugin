import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutEditor,createLayoutModel,createLayoutStore} from '../dist/graph-core.mjs';
import {createAttemptHistory,attemptHistoryDirectory} from '../src/sync/attempt-history-prototype.mjs';
import {createLayoutActionAuthor} from '../src/sync/author-prototype.mjs';
import {createDurableSyncSession} from '../src/sync/persistence-prototype.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';

const base=path.resolve('.local/sync-016/a4'),vault='a'.repeat(32),installation='b'.repeat(32);
const dir=attemptHistoryDirectory(vault),id=n=>n.toString(16).padStart(32,'0');
const empty={schemaVersion:3,revision:0,groups:{},structures:{}};
const files=['A','B'].map(name=>({path:'Synthetic/'+name+'.md',text:'# First\nBody\n# Second\nSecond body\n'}));
const graph=()=>buildGraph({files,config:{include:['Synthetic/**']}});
const model=()=>{const g=graph();return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
async function change(note,dx){
  const g=graph(),m=createLayoutModel(g.nodes,g.meta.layout_root_radius);
  const e=createLayoutEditor(g.nodes,g.meta.layout_root_radius),node=g.nodes.find(n=>n.path===note&&n.title==='Second');
  assert.equal(e.begin(node.id),null);e.move(node.x+dx,node.y+5);e.commit();
  const group=m.groupKey(node.id);let snapshot;
  const store=createLayoutStore(null,async value=>{snapshot=value;});
  await store.command({},'edit',group,m.capture(group));
  return {group,value:{schemaVersion:3,record:snapshot.groups[group],structures:snapshot.structures}};
}
const original=await change('Synthetic/A.md',10),rival=await change('Synthetic/A.md',-10),other=await change('Synthetic/B.md',12);
function draft(accepted,change=original,n=1){
  return createLayoutActionAuthor({vault,createModel:model,nextId:()=>id(n)}).prepareEdit({vault,sharedScanComplete:true,
    records:accepted.operations,appliedIds:accepted.appliedIds,localBaseline:accepted.snapshot},[change]);
}
function adapter(root,{write,stat}={}){
  const absolute=name=>path.join(root,'shared',name);
  return {absolute,
    async stat(name){
      await stat?.(name);
      try{const value=await fs.stat(absolute(name));return {type:value.isDirectory()?'folder':'file',size:value.size};}
      catch(error){if(error.code==='ENOENT')return null;throw error;}
    },
    async list(name){
      const children=await fs.readdir(absolute(name),{withFileTypes:true});
      return {files:children.filter(row=>!row.isDirectory()).map(row=>name+'/'+row.name),
        folders:children.filter(row=>row.isDirectory()).map(row=>name+'/'+row.name)};
    },
    async readBinary(name){const data=await fs.readFile(absolute(name));return Uint8Array.from(data).buffer;},
    mkdir:name=>fs.mkdir(absolute(name)),
    async writeBinary(name,buffer){
      if(write)return write(absolute(name),Buffer.from(buffer));
      await fs.writeFile(absolute(name),Buffer.from(buffer));
    },
  };
}
async function open(root,{checkpoint,write,stat,getEpoch,slot='private'}={}){
  const io=adapter(root,{write,stat});
  const attemptHistory=createAttemptHistory(io,vault);
  const session=createDurableSyncSession({privateStore:createNodeSyncStore(path.join(root,slot)),attemptHistory,
    vault,installation,createModel:model,checkpoint,getEpoch});
  await session.open();
  if(!session.state().initialized)await session.initialize({source:'explicit-empty',localBaseline:empty});
  return {session,io,attemptHistory};
}
const stage=async({session},c=original,n=1)=>session.stage(draft(session.state().accepted,c,n));
const list=async io=>(await io.stat(dir))?(await io.list(dir)).files.sort():[];
const bytes=(io,name)=>fs.readFile(io.absolute(name));
const pathsFor=async io=>Promise.all((await list(io)).map(async name=>[name,await bytes(io,name)]));
const rootArg=process.argv[3],point=process.argv[4];

if(process.argv[2]==='--crash'){
  const root=path.resolve(rootArg),relative=path.relative(base,root);
  assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
  const host=await open(root,{checkpoint:async name=>{if(name===point)process.exit(86);},
    ...(point==='partial'?{write:async(file,body)=>{
      const handle=await fs.open(file,'w');
      await handle.writeFile(body.subarray(0,20));await handle.sync();await handle.close();process.exit(86);
    }}:{})});
  await stage(host);
  await host.session.publish();
  throw Error('missing crash point '+point);
}else{
  await fs.mkdir(base,{recursive:true});
  const out=await fs.mkdtemp(path.join(base,'layout-candidate-check-')),checks=[];
  async function test(label,run){
    const root=await fs.mkdtemp(path.join(out,'case-'));
    await fs.mkdir(path.join(root,'shared'));
    await run(root);
    checks.push(label);
  }
  for(const point of ['after-stage','after-publication-intent','after-attempt-path','partial','after-publication','before-accept']){
    await test('Real process exit and cold recovery at '+point,async root=>{
      const child=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--crash',root,point],{encoding:'utf8',windowsHide:true});
      assert.equal(child.status,86,child.stdout+child.stderr);
      const host=await open(root),pending=host.session.state().pending,before=await pathsFor(host.io);
      assert.equal(pending.id,id(1));
      assert.equal(host.session.state().accepted.appliedIds.length,0);
      assert.equal((await host.session.publish()).kind,'accepted');
      const after=await pathsFor(host.io);
      assert.equal(after.length,point==='partial'?2:1);
      for(const [name,body] of before)assert.deepEqual(await bytes(host.io,name),body);
      if(point==='after-attempt-path')assert.notEqual(after[0][0],pending.attempts[0]);
      if(point==='partial')assert.ok(after.some(([name,body])=>name!==before[0][0]&&JSON.parse(body).id===pending.id));
      await host.session.close();
      const cold=await open(root);
      assert.deepEqual(cold.session.state().accepted.appliedIds,[id(1)]);
      assert.equal((await cold.session.acceptExternal()).kind,'noop');
      await cold.session.close();
    });
  }
  await test('A rival arriving after write blocks acceptance and survives disappearance in the private journal',async root=>{
    let host,injected;
    host=await open(root,{checkpoint:async step=>{
      if(step!=='after-publication')return;
      injected=dir+'/provider conflict.json';
      const operation=draft(host.session.state().accepted,rival).operation;
      await fs.writeFile(host.io.absolute(injected),JSON.stringify(operation,null,2));
    }});
    await stage(host);
    assert.equal((await host.session.publish()).reason,'attempt-conflict-review');
    assert.deepEqual(host.session.state().accepted.appliedIds,[]);
    assert.ok(host.session.state().attemptConflict.evidence.some(item=>item.name===injected));
    await host.session.close();
    await fs.unlink(host.io.absolute(injected));
    const cold=await open(root);
    assert.equal((await cold.session.publish()).reason,'attempt-conflict-review');
    assert.equal((await list(cold.io)).length,1);
    assert.equal(cold.session.state().pending.id,id(1));
    await cold.session.close();
  });
  await test('Receive freezes accepted baseline on late rival and unknown names block before application',async root=>{
    const sender=await open(root);await stage(sender);await sender.session.publish();
    const receiver=await open(root,{slot:'receiver'}),unknown=dir+'/unexpected.json';
    await fs.writeFile(sender.io.absolute(unknown),'?');
    assert.equal((await receiver.session.acceptExternal()).reason,'unknown-file-name');
    await fs.unlink(sender.io.absolute(unknown));
    assert.equal((await receiver.session.acceptExternal()).kind,'accepted');
    const accepted=receiver.session.state().accepted;
    await fs.writeFile(sender.io.absolute(unknown),JSON.stringify(draft({operations:[],appliedIds:[],snapshot:empty},rival).operation));
    assert.equal((await receiver.session.acceptExternal()).reason,'attempt-conflict-review');
    assert.deepEqual(receiver.session.state().accepted,accepted);
    await receiver.session.close();await sender.session.close();
    await fs.unlink(sender.io.absolute(unknown));
    const cold=await open(root,{slot:'receiver'});
    assert.equal((await cold.session.acceptExternal()).reason,'attempt-conflict-review');
    assert.deepEqual(cold.session.state().accepted,accepted);
    await cold.session.close();
  });
  await test('Separate valid operations converge without a receive write and missing accepted input preserves state',async root=>{
    const sender=await open(root);await stage(sender);await sender.session.publish();
    const receiver=await open(root,{slot:'receiver'});assert.equal((await receiver.session.acceptExternal()).kind,'accepted');
    await stage(receiver,other,2);assert.equal((await receiver.session.publish()).kind,'accepted');
    const before=await pathsFor(sender.io);
    assert.equal((await sender.session.acceptExternal()).kind,'accepted');
    assert.deepEqual(await pathsFor(sender.io),before);
    const accepted=sender.session.state().accepted;
    await fs.unlink(sender.io.absolute(before[0][0]));
    assert.equal((await sender.session.acceptExternal()).reason,'accepted-record-missing');
    assert.deepEqual(sender.session.state().accepted,accepted);
    await receiver.session.close();await sender.session.close();
  });
  await test('Unreadable directory and an edit epoch change keep the outbox intact',async root=>{
    let blocked=true,epoch=0;
    const host=await open(root,{getEpoch:()=>epoch,stat:async name=>{if(blocked&&name===dir)throw Error('EACCES');},
      checkpoint:async step=>{if(step==='after-attempt-path')epoch++;}});
    await stage(host);
    assert.equal((await host.session.publish()).reason,'attempt-scan-unavailable');
    blocked=false;
    assert.equal((await host.session.publish()).reason,'epoch-changed');
    assert.equal((await list(host.io)).length,0);
    assert.equal(host.session.state().pending.attempts.length,1);
    await host.session.close();
  });
  await test('An oversized physical file blocks a pending write before file contents are read',async root=>{
    const host=await open(root);
    await stage(host);
    await fs.mkdir(host.io.absolute(dir),{recursive:true});
    const file=host.io.absolute(dir+'/over-limit.json');
    await fs.writeFile(file,Buffer.alloc(2*1024*1024+1));
    assert.equal((await host.session.publish()).reason,'attempt-file-budget');
    assert.equal((await list(host.io)).length,1);
    assert.equal(host.session.state().pending.attempts.length,0);
    await host.session.close();
  });
  await fs.writeFile(path.join(out,'verification.json'),JSON.stringify({checks},null,2)+'\n');
  console.log(checks.length+' layout candidate checks: '+out);
}
