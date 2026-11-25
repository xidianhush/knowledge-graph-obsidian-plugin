// SYNC-UX-A2 disk check: real-file one-switch preparation, reopen resume,
// two-device exchange with a real edit, and selection-stage exit recovery.
// File-backed App contract, real shared/private files and injected locks; not
// native Obsidian, Nutstore, iPad or real cross-device transfer.
import assert from 'node:assert/strict';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';
import {createLayoutStore} from '../dist/graph-core.mjs';
import {layout,model,empty} from './sync-auto-publish-test-helpers.mjs';
import {testLockManager} from './sync-host-test-helpers.mjs';
import {validateTestSettings} from './sync-settings-test-helpers.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';
import {createDefaultLayoutBootstrap,DEFAULT_LAYOUT_VAULT_ID} from '../src/sync/default-layout-bootstrap.mjs';
import {describeEasySync} from '../src/sync/obsidian-easy-settings.mjs';
const base=path.resolve('.local/sync-ux/a2-disk'),pluginId='knowledge-graph-smoke';
const right=await layout(20);
function io(root){
 const location=p=>path.join(root,'shared',p);
 return {async stat(p){try{const s=await fs.stat(location(p));return {type:s.isDirectory()?'folder':'file',size:s.size};}catch(e){if(e.code==='ENOENT')return null;throw e;}},
  async list(p){const rows=await fs.readdir(location(p),{withFileTypes:true});return {files:rows.filter(r=>r.isFile()).map(r=>p+'/'+r.name),folders:rows.filter(r=>r.isDirectory()).map(r=>p+'/'+r.name)};},
  async readBinary(p){return Uint8Array.from(await fs.readFile(location(p))).buffer;},
  async mkdir(p){await fs.mkdir(location(p),{recursive:true});},
  async writeBinary(p,raw){await fs.writeFile(location(p),Buffer.from(raw));}};
}
function appStore(root){
 const file=path.join(root,'app-local.json');const read=()=>JSON.parse(fsSync.readFileSync(file,'utf8'));
 return {loadLocalStorage(key){const data=read();return data[key]??null;},saveLocalStorage(key,value){const data=read();data[key]=value;fsSync.writeFileSync(file,JSON.stringify(data));}};
}
async function seed(root){await fs.mkdir(path.join(root,'shared'),{recursive:true});await fs.writeFile(path.join(root,'app-local.json'),'{}');}
async function copyShared(srcRoot,dstRoot){const src=path.join(srcRoot,'shared','Knowledge Map Sync');if(!fsSync.existsSync(src))return;await fs.cp(src,path.join(dstRoot,'shared','Knowledge Map Sync'),{recursive:true});}
async function hostFor(root,{local=empty,checkpoint=async()=>{}}={}){
 const dataFile=path.join(root,'data.json');
 let source=fsSync.existsSync(dataFile)?JSON.parse(fsSync.readFileSync(dataFile,'utf8')):{settings:{language:'zh'},ui:{},layoutOverrides:local};
 const host=await createUnifiedSyncHost({app:appStore(root),pluginId,adapter:io(root),locks:testLockManager(),readSource:async()=>structuredClone(source),saveUnjoined:async d=>{source=structuredClone(d);fsSync.writeFileSync(dataFile,JSON.stringify(source));},createStore:createLayoutStore,validateSettings:validateTestSettings,
  openBackend:async({vault})=>createNodeSyncStore(path.join(root,'private',vault)),getGraph:()=>({isCurrent:()=>true,hidden:false,createModel:model}),getEpoch:()=>0,checkpoint});
 return {host,source:()=>source};
}
await fs.mkdir(base,{recursive:true});const out=await fs.mkdtemp(path.join(base,'disk-')),checks=[];
// 1. Fresh device prepares the default on real files; reopen resumes without reimport.
const rootA=await fs.mkdtemp(path.join(out,'fresh-'));await seed(rootA);
const a=await hostFor(rootA,{local:empty});const ra=await a.host.startEasySync();assert.equal(ra.kind,'easy-joined');
assert.equal(a.host.state().selected.vault,DEFAULT_LAYOUT_VAULT_ID);assert.equal(a.host.state().session.accepted.operations.length,0);
assert.equal((await createDefaultLayoutBootstrap(io(rootA)).scan()).facts,1);await a.host.close();
const a2=await hostFor(rootA);const ra2=await a2.host.resumeEasySync();assert.equal(ra2.kind,'easy-active');
assert.equal(a2.host.state().selected.vault,DEFAULT_LAYOUT_VAULT_ID);assert.equal(a2.host.state().session.accepted.operations.length,0);
assert.equal((await createDefaultLayoutBootstrap(io(rootA)).scan()).facts,1);await a2.host.close();
checks.push({case:'fresh-prepare-and-reopen',pass:true,noReimport:true,singleBootstrap:true});
// 2. Two real-file devices exchange the default and a real edit flows A to B.
const rootB=await fs.mkdtemp(path.join(out,'peer-'));await seed(rootB);
const b=await hostFor(rootB,{local:empty});await copyShared(rootA,rootB);const rb=await b.host.startEasySync();assert.equal(rb.kind,'easy-joined');
assert.equal(b.host.state().selected.vault,DEFAULT_LAYOUT_VAULT_ID);
const a3=await hostFor(rootA);await a3.host.resumeEasySync();await a3.host.saveLayout(right);await a3.host.settled();assert.equal(a3.host.state().session.accepted.operations.length,1);
await copyShared(rootA,rootB);await b.host.notifyExternalChange();await b.host.receive();await b.host.settled();
assert.deepEqual(b.host.state().session.accepted.snapshot.groups,right.groups);await a3.host.close();await b.host.close();
checks.push({case:'two-device-real-exchange',pass:true,sameDefault:true,editReceived:true});
// 3. Exit after the selection intent is durable; reopen completes selection and join once.
const rootC=await fs.mkdtemp(path.join(out,'crash-'));await seed(rootC);let exited=false;
const c=await hostFor(rootC,{local:empty,checkpoint:async step=>{if(step==='selection:after-selection-intent'&&!exited){exited=true;throw Error('simulated-exit');}}});
await assert.rejects(c.host.startEasySync(),/simulated-exit/);await c.host.close();
const c2=await hostFor(rootC);const rc=await c2.host.resumeEasySync();assert.equal(rc.kind,'easy-joined');
assert.equal(c2.host.state().selected.vault,DEFAULT_LAYOUT_VAULT_ID);assert.equal(c2.host.state().session.accepted.operations.length,0);
assert.equal((await createDefaultLayoutBootstrap(io(rootC)).scan()).facts,1);assert.equal(c2.host.state().selectionPending,null);await c2.host.close();
checks.push({case:'selection-exit-recovery',pass:true,resumedSelection:true,noDuplicateBootstrap:true});
// 4. Off-period draft survives a real-file reopen and stays behind review.
const rootD=await fs.mkdtemp(path.join(out,'draft-'));await seed(rootD);
const d=await hostFor(rootD,{local:right});await d.host.startEasySync();await d.host.stopEasySync();await d.host.saveLayout(await layout(-20));await d.host.startEasySync();await d.host.settled();
const draftBefore=d.host.state().session.localState.layoutDraft,opsBefore=d.host.state().session.accepted.operations.length;
async function inventory(root){const base=path.join(root,'shared'),rows=[];for(const name of (await fs.readdir(base,{recursive:true})).sort()){const file=path.join(base,name);if((await fs.stat(file)).isFile())rows.push([name,(await fs.readFile(file)).toString('hex')]);}return rows;}
const sharedBefore=await inventory(rootD);await d.host.close();
const d2=await hostFor(rootD);await d2.host.resumeEasySync();await d2.host.settled();
assert.deepEqual(describeEasySync(d2.host.easySyncState(),d2.host.state()),{status:'draftReview',action:'publish'});
assert.equal(d2.host.state().session.localState.layoutDraft.id,draftBefore.id);assert.equal(d2.host.state().session.accepted.operations.length,opsBefore);
const review=await d2.host.previewPublication();assert.equal(review.kind,'publication-review');await d2.host.discardReview(review.token);await d2.host.settled();assert.deepEqual(await inventory(rootD),sharedBefore);
const accepted=await d2.host.previewPublication();await d2.host.confirmPublication(accepted.token);await d2.host.settled();assert.equal(d2.host.state().session.accepted.operations.length,opsBefore+1);await d2.host.close();
checks.push({case:'off-period-draft-review-after-reopen',pass:true,noWritesOnCancel:true,explicitConfirmation:true});
await fs.writeFile(path.join(out,'verification.json'),JSON.stringify({pass:true,out,checks,scope:'Real shared/private files and file-backed App contract with injected locks; exchange is local file copy, not Nutstore, iPad or real transfer.'},null,2));
console.log(JSON.stringify({pass:true,out,checks}));
