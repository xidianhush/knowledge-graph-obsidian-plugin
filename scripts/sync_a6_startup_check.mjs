import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {openObsidianSyncDevice,openIsolatedSyncTestDevice} from '../src/sync/obsidian-host-prototype.mjs';
import {testLocalApp,testLockManager} from './sync-host-test-helpers.mjs';

const source=fs.readFileSync('src/sync/obsidian-receive-entry.js','utf8');
const suite='a'.repeat(32),other='b'.repeat(32);
const checks=[];
for(const failure of ['identity','connection','indexeddb']){
  const written=[],notices=[];
  class BasePlugin{}
  const modules={
    'knowledge-map-host':{BasePlugin,t:(key,values)=>key+JSON.stringify(values)},
    'src/sync/author-prototype.mjs':{randomSyncOperationId:()=>'c'.repeat(32)},
    'src/sync/attempt-history-prototype.mjs':{createAttemptHistory:()=>({directory:'isolated-test'})},
    'src/sync/obsidian-host-prototype.mjs':{
      async openIsolatedSyncTestDevice(){
        if(failure==='identity')throw Error('sync-host-device-busy');
        return {state:()=>({installation:'d'.repeat(32),connection:{enabled:true,vault:failure==='connection'?other:suite}})};
      },
    },
    'src/sync/indexeddb-store-prototype.mjs':{openIndexedDbSyncStore:async()=>{throw Error('sync-idb-open-failed');}},
  };
  const context=vm.createContext({module:{exports:{}},require:()=>({
    Notice:class {constructor(message){notices.push(message);}},Platform:{isMobile:true},apiVersion:'1.15.0',
  }),ATTEMPT_SUITE:suite,PROBE_BUILD:{version:5},
  TextEncoder,loadProbeModule:name=>modules[name]??{},Date,
  });
  vm.runInContext(source,context);
  const probe=new context.module.exports();
  probe.manifest={id:'knowledge-map-a4-attempt-layout'};
  probe.app={vault:{
    getName:()=> 'Knowledge Map A6 Different iPad',
    adapter:{stat:async()=>({type:'file',size:128}),
      read:async()=>JSON.stringify({version:1,isolated:true,suite,scenario:'Different'})},
    create:async(name,text)=>written.push({name,report:JSON.parse(text)}),
  }};
  await assert.rejects(probe.onload());
  assert.equal(written.length,1);
  assert.match(written[0].name,/^SYNC-A6-startup-.*\.json$/);
  const {report}=written[0];
  const phases={identity:'device-identity',connection:'device-connection',indexeddb:'indexeddb-open'};
  assert.equal(report.phase,phases[failure]);
  assert.equal(report.suite,suite);
  assert.equal(report.mobile,true);
  assert.equal(Object.hasOwn(report,'secret'),false);
  assert.equal(Object.hasOwn(report,'installation'),false);
  assert.ok(notices.some(message=>message.includes('receive.attemptStartupFailed')));
  checks.push({failure,phase:report.phase,error:report.error});
}
const pluginId='knowledge-map-a4-attempt-layout',suffix=':sync-v2:device';
const app=testLocalApp(),locks=testLockManager();
const legacy=await openObsidianSyncDevice({app,locks,pluginId});
await legacy.connect(other);
await legacy.anchorEvent(other,'events/000000000001.json','retained legacy progress');
const previous=app.loadLocalStorage(pluginId+suffix);
const current=await openIsolatedSyncTestDevice({app,locks,pluginId,vault:suite});
assert.equal(current.state().connection,null);
await current.connect(suite);
assert.deepEqual(app.loadLocalStorage(pluginId+suffix),previous);
assert.notEqual(current.state().installation,legacy.state().installation);
assert.deepEqual((await openIsolatedSyncTestDevice({app,locks,pluginId,vault:suite})).state(),current.state());
checks.push({check:'Foreign legacy binding retained; new suite gets stable isolated identity'});
const existing=await openIsolatedSyncTestDevice({app,locks,pluginId,vault:other});
assert.deepEqual(existing.state(),legacy.state());
assert.deepEqual(app.loadLocalStorage(pluginId+suffix),previous);
checks.push({check:'Matching legacy identity and its anchors remain in use'});
const scopedKey=pluginId+'-test-'+suite+suffix;
const corrupt=app.loadLocalStorage(scopedKey);
corrupt.secret='invalid';
app.saveLocalStorage(scopedKey,corrupt);
await assert.rejects(openIsolatedSyncTestDevice({app,locks,pluginId,vault:suite}),/local-identity-invalid/);
assert.deepEqual(app.loadLocalStorage(scopedKey),corrupt);
checks.push({check:'Corrupt existing isolated identity is rejected and preserved'});
console.log(JSON.stringify({checks}));
