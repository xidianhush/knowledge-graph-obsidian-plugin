// Synthetic signed-store checks; no native app, personal vault or cloud access.
import assert from 'node:assert/strict';
import {createDurableSyncSession,syncContentHash} from '../src/sync/persistence-prototype.mjs';
import {cloneBoundedSyncJson} from '../src/sync/causal-prototype.mjs';
import {openObsidianSyncDevice,createDeviceBoundPrivateStore} from '../src/sync/obsidian-host-prototype.mjs';
import {testLocalApp,testLockManager,testMemoryStore} from './sync-host-test-helpers.mjs';
const vault='a'.repeat(32),pluginId='replay-cache-test',empty={schemaVersion:3,revision:0,groups:{},structures:{}};
const checks=[];
async function test(name,fn){await fn();checks.push(name);}
const blobName=async value=>'blobs/'+await syncContentHash(JSON.stringify(cloneBoundedSyncJson(value)))+'.json';
async function fixture(values,{immutable=true}={}){
 const app=testLocalApp(),locks=testLockManager(),backend=testMemoryStore(),sharedStore=testMemoryStore();
 backend.immutableBlobsUnderLease=immutable;
 const device=await openObsidianSyncDevice({app,pluginId,locks});await device.connect(vault);
 const reads=new Map(),read=backend.read;backend.read=async(name,max)=>{reads.set(name,(reads.get(name)||0)+1);return read(name,max);};
 function session(afterRead=()=>{}){
  const bound=createDeviceBoundPrivateStore({store:backend,device,vault});
  return createDurableSyncSession({privateStore:{...bound,async read(name,max){const value=await bound.read(name,max);afterRead(name);return value;}},sharedStore,vault,installation:device.state().installation,createModel:()=>{throw Error('unexpected model construction');}});
 }
 const initial=session();try{await initial.open();await initial.initialize({source:'explicit-empty',localBaseline:empty});for(const value of values)await initial.saveLocalState(value);}finally{await initial.close();}
 reads.clear();return {app,backend,reads,session};
}
await test('A replay working set above eight blobs is authenticated once per unique value',async()=>{
 const values=Array.from({length:32},(_,n)=>({n,keep:'synthetic'})),f=await fixture([...values,...values]),s=f.session();
 try{await s.open();assert.deepEqual(s.state().localState,values.at(-1));for(const value of values)assert.equal(f.reads.get(await blobName(value)),1,'hot working set should not be repeatedly authenticated');}finally{await s.close();}
});
await test('Stores without immutable capability keep re-reading authenticated blobs',async()=>{
 const value={keep:'fallback'},f=await fixture([value,value],{immutable:false}),s=f.session();
 try{await s.open();assert.equal(f.reads.get(await blobName(value)),2);}finally{await s.close();}
});
await test('Recent small values survive byte pressure while cold large values are evicted',async()=>{
 const hot={keep:'hot'},large=n=>({n,payload:Array(20).fill('x'.repeat(16000))}),a=large(1),b=large(2);
 const f=await fixture([hot,a,hot,b,hot,a]),s=f.session();
 try{await s.open();assert.equal(f.reads.get(await blobName(hot)),1);assert.equal(f.reads.get(await blobName(a)),2,'cold content must be evicted under 512 KiB pressure');}finally{await s.close();}
});
await test('UTF-8 blobs above the byte ceiling remain uncached even with fewer characters',async()=>{
 const value={payload:Array(16).fill('汉'.repeat(12000))},f=await fixture([value,value]),s=f.session();
 try{await s.open();assert.deepEqual(s.state().localState,value);assert.equal(f.reads.get(await blobName(value)),2);}finally{await s.close();}
});
await test('Tiny entries are still bounded by the 1024-entry ceiling',async()=>{
 const values=Array.from({length:1025},(_,n)=>({n})),f=await fixture([...values,values[0]]),s=f.session();
 try{await s.open();assert.equal(f.reads.get(await blobName(values[0])),2);}finally{await s.close();}
});
await test('A fresh open reauthenticates blobs and rejects changed content',async()=>{
 const value={keep:'fresh'},f=await fixture([value,value]),name=await blobName(value);
 for(let i=0;i<2;i++){f.reads.clear();const s=f.session();try{await s.open();assert.equal(f.reads.get(name),1);const detached=s.state();detached.localState.keep='changed outside';assert.deepEqual(s.state().localState,value);}finally{await s.close();}}
 f.backend.files.set(name,f.backend.files.get(name)+'x');const original=new Map(f.backend.files),damaged=f.session();
 try{await assert.rejects(damaged.open(),/private-authentication/);assert.equal(damaged.state().faulted,true);assert.deepEqual(f.backend.files,original);}finally{await damaged.close();}
});
await test('Cached blobs never bypass journal authentication',async()=>{
 const value={keep:'journal'},f=await fixture([value,value,value]),name='events/000000000003.json';
 f.backend.files.set(name,f.backend.files.get(name)+'x');const original=new Map(f.backend.files),s=f.session();
 try{await assert.rejects(s.open(),/private-authentication/);assert.equal(s.state().faulted,true);assert.deepEqual(f.backend.files,original);}finally{await s.close();}
});
await test('Revoked identity immediately before a cache hit still fails the live access check',async()=>{
 const value={keep:'revocation'},f=await fixture([value,value]),name=await blobName(value);
 const s=f.session(event=>{if(event==='events/000000000003.json'){const key=pluginId+':sync-v2:device',record=f.app.loadLocalStorage(key);record.generation++;record.connection.enabled=false;f.app.saveLocalStorage(key,record);}});
 try{await assert.rejects(s.open(),/sync-host-device-state-changed/);assert.equal(f.reads.get(name),1,'failure must occur before a second backend blob read');assert.equal(s.state().faulted,true);}finally{await s.close();}
});
console.log(JSON.stringify({passed:checks.length,checks,scope:'Real session/device authentication over controlled memory backing; not IndexedDB/iPad measurements.'}));
