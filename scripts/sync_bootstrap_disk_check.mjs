// SYNC-UX-A1 disk check: real files, two-device exchange, concurrent writers,
// truncated transfer and process-exit recovery for bootstrap initialization.
// File-backed App contract and injected locks; not native Obsidian, Nutstore,
// iPad or real cross-device transfer.
import assert from 'node:assert/strict';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createSyncConnectionCatalog} from '../src/sync/connection-catalog.mjs';
import {openSyncConnections} from '../src/sync/connection-registry.mjs';
import {createDefaultLayoutBootstrap,DEFAULT_LAYOUT_VAULT_ID,defaultLayoutBodyText,defaultLayoutBootstrapDirectory} from '../src/sync/default-layout-bootstrap.mjs';
import {syncContentHash} from '../src/sync/persistence-prototype.mjs';
import {testLockManager} from './sync-host-test-helpers.mjs';
const base=path.resolve('.local/sync-ux/a1-disk'),pluginId='knowledge-graph-smoke';
const sha=v=>createHash('sha256').update(v).digest('hex');
const directory=defaultLayoutBootstrapDirectory();
function io(root){
 const location=p=>path.join(root,'shared',p);
 return {async stat(p){try{const s=await fs.stat(location(p));return {type:s.isDirectory()?'folder':'file',size:s.size};}catch(e){if(e.code==='ENOENT')return null;throw e;}},
  async list(p){const rows=await fs.readdir(location(p),{withFileTypes:true});return {files:rows.filter(r=>r.isFile()).map(r=>p+'/'+r.name),folders:rows.filter(r=>r.isDirectory()).map(r=>p+'/'+r.name)};},
  async readBinary(p){return Uint8Array.from(await fs.readFile(location(p))).buffer;},
  async mkdir(p){await fs.mkdir(location(p),{recursive:true});},
  async writeBinary(p,raw){await fs.writeFile(location(p),Buffer.from(raw));}};
}
function appStore(root){
 const file=path.join(root,'app-local.json');
 const read=()=>JSON.parse(fsSync.readFileSync(file,'utf8'));
 return {loadLocalStorage(key){const data=read();return data[key]??null;},saveLocalStorage(key,value){const data=read();data[key]=value;fsSync.writeFileSync(file,JSON.stringify(data));}};
}
async function seed(root){await fs.mkdir(path.join(root,'shared'),{recursive:true});await fs.writeFile(path.join(root,'app-local.json'),'{}');}
async function filesUnder(root,dir){
 const rows=[];async function walk(p){for(const e of await fs.readdir(path.join(root,'shared',p),{withFileTypes:true})){const name=p?p+'/'+e.name:e.name;if(e.isDirectory())await walk(name);else rows.push({name,hash:sha(await fs.readFile(path.join(root,'shared',name)))});}}
 await walk(dir);return rows.sort((a,b)=>a.name.localeCompare(b.name));
}
const exitWith=(child)=>new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>resolve(code));});
if(process.argv[2]==='--ensure'||process.argv[2]==='--crash-write'){
 const root=path.resolve(process.argv[3]),nonce=process.argv[4];
 assert.ok(path.relative(base,root)&&!path.relative(base,root).startsWith('..'));
 const adapter=io(root);
 if(process.argv[2]==='--crash-write'){const write=adapter.writeBinary;adapter.writeBinary=async(p,raw)=>{const u8=raw instanceof Uint8Array?raw:new Uint8Array(raw);await write(p,u8.subarray(0,Math.floor(u8.length/2)));process.exit(86);};}
 const result=await createDefaultLayoutBootstrap(adapter,{nextId:()=>nonce}).ensure();
 console.log(JSON.stringify(result));
}else{
 await fs.mkdir(base,{recursive:true});const out=await fs.mkdtemp(path.join(base,'disk-')),checks=[];
 const bodyHash=await syncContentHash(defaultLayoutBodyText());
 // 1. Two offline devices initialize independently, then exchange files.
 const rootA=await fs.mkdtemp(path.join(out,'device-a-')),rootB=await fs.mkdtemp(path.join(out,'device-b-'));
 await seed(rootA);await seed(rootB);
 const nonceA='a'.repeat(32),nonceB='b'.repeat(32);
 const ra=await createDefaultLayoutBootstrap(io(rootA),{nextId:()=>nonceA}).ensure();
 const rb=await createDefaultLayoutBootstrap(io(rootB),{nextId:()=>nonceB}).ensure();
 assert.equal(ra.kind,'written');assert.equal(rb.kind,'written');assert.notEqual(ra.name,rb.name);
 const nameA=directory+'/'+bodyHash+'.'+nonceA+'.json',nameB=directory+'/'+bodyHash+'.'+nonceB+'.json';
 await fs.mkdir(path.join(rootB,'shared',directory),{recursive:true});await fs.mkdir(path.join(rootA,'shared',directory),{recursive:true});
 await fs.copyFile(path.join(rootA,'shared',nameA),path.join(rootB,'shared',nameA));
 await fs.copyFile(path.join(rootB,'shared',nameB),path.join(rootA,'shared',nameB));
 const scanA=await createSyncConnectionCatalog({adapter:io(rootA)}).scan(),scanB=await createSyncConnectionCatalog({adapter:io(rootB)}).scan();
 assert.equal(scanA.kind,'catalog');assert.equal(scanB.kind,'catalog');
 assert.deepEqual(scanA.candidates,[{vault:DEFAULT_LAYOUT_VAULT_ID,transport:'attempts-v1',access:'read-write',operations:0,bootstrapOnly:true}]);
 assert.deepEqual(scanA.candidates,scanB.candidates);assert.equal(scanA.fingerprint,scanB.fingerprint);assert.equal(scanA.files,2);
 const factsA=await createDefaultLayoutBootstrap(io(rootA)).scan();assert.equal(factsA.facts,1);assert.deepEqual(factsA.blockers,[]);
 const againA=await createDefaultLayoutBootstrap(io(rootA),{nextId:()=>{throw Error('no new attempt after exchange');}}).ensure();
 assert.equal(againA.kind,'present');
 assert.deepEqual(await filesUnder(rootA,directory),await filesUnder(rootB,directory));
 checks.push({case:'offline-two-device-exchange',pass:true,oneCandidate:true,sameFingerprint:true,noExtraWrite:true});
 // 2. Truncated transfer pauses; the complete same-hash record recovers it.
 const rootC=await fs.mkdtemp(path.join(out,'device-c-'));await seed(rootC);
 const full=await fs.readFile(path.join(rootA,'shared',nameA));
 await fs.mkdir(path.join(rootC,'shared',directory),{recursive:true});
 await fs.writeFile(path.join(rootC,'shared',nameA),full.subarray(0,Math.floor(full.length/2)));
 const partial=await createSyncConnectionCatalog({adapter:io(rootC)}).scan();
 assert.equal(partial.kind,'held');assert.equal(partial.candidates,undefined);
 const refused=await createDefaultLayoutBootstrap(io(rootC),{nextId:()=>'c'.repeat(32)}).ensure();
 assert.equal(refused.kind,'held');
 await fs.writeFile(path.join(rootC,'shared',nameA),full);
 const recovered=await createSyncConnectionCatalog({adapter:io(rootC)}).scan();
 assert.equal(recovered.kind,'catalog');assert.equal(recovered.candidates.length,1);assert.equal(recovered.candidates[0].bootstrapOnly,true);
 checks.push({case:'truncated-transfer-pause-and-recovery',pass:true,heldWhilePartial:true,noReinitWhileHeld:true});
 // 3. Concurrent writers on one shared folder never overwrite or conflict.
 const rootD=await fs.mkdtemp(path.join(out,'concurrent-'));await seed(rootD);
 const children=[['d'.repeat(32),'e'.repeat(32)].map(nonce=>spawn(process.execPath,[process.argv[1],'--ensure',rootD,nonce],{stdio:'ignore'}))][0];
 const codes=await Promise.all(children.map(exitWith));assert.deepEqual(codes,[0,0]);
 const concurrent=await createDefaultLayoutBootstrap(io(rootD)).scan();
 assert.equal(concurrent.facts,1);assert.deepEqual(concurrent.blockers,[]);
 const listed=await filesUnder(rootD,directory);assert.ok(listed.length>=1&&listed.length<=2);
 for(const row of listed)assert.equal(row.hash,sha(defaultLayoutBodyText()));
 const scanD=await createSyncConnectionCatalog({adapter:io(rootD)}).scan();
 assert.equal(scanD.kind,'catalog');assert.equal(scanD.candidates.length,1);assert.equal(scanD.candidates[0].operations,0);
 checks.push({case:'concurrent-ensure',pass:true,files:listed.length,oneFact:true,immutableBodies:true});
 // 4. Process exit between write and readback leaves a recoverable attempt.
 const rootE=await fs.mkdtemp(path.join(out,'crash-'));await seed(rootE);
 const nonceE='f'.repeat(32),attemptE=directory+'/'+bodyHash+'.'+nonceE+'.json';
 const crashed=spawnSync(process.execPath,[process.argv[1],'--crash-write',rootE,nonceE],{encoding:'utf8'});
 assert.equal(crashed.status,86,crashed.stderr);
 const cold=await createSyncConnectionCatalog({adapter:io(rootE)}).scan();
 assert.equal(cold.kind,'held');
 const coldEnsure=await createDefaultLayoutBootstrap(io(rootE),{nextId:()=>{throw Error('no nonce without attempts');}}).ensure();
 assert.equal(coldEnsure.kind,'held');
 const resumed=await createDefaultLayoutBootstrap(io(rootE),{nextId:()=>'1'.repeat(32)}).ensure({attempts:[attemptE]});
 assert.equal(resumed.kind,'written');assert.notEqual(resumed.name,attemptE);
 const after=await createSyncConnectionCatalog({adapter:io(rootE)}).scan();
 assert.equal(after.kind,'catalog');assert.equal(after.candidates.length,1);
 const stable=await createDefaultLayoutBootstrap(io(rootE),{nextId:()=>{throw Error('no new attempt after recovery');}}).ensure();
 assert.equal(stable.kind,'present');
 checks.push({case:'crash-between-write-and-readback',pass:true,heldWithoutAttempts:true,resumedWithOwnAttempt:true,idempotentAfter:true});
 // 5. Registry selection on real files survives reopen without new IDs.
 const app=appStore(rootA),locks=testLockManager(),catalog=createSyncConnectionCatalog({adapter:io(rootA)});
 const registry=await openSyncConnections({app,pluginId,locks,catalog,nextId:()=>{throw Error('no random ID for the fixed default');}});
 const preview=await registry.preview({action:'join',vault:DEFAULT_LAYOUT_VAULT_ID,transport:'attempts-v1'});
 assert.equal(preview.kind,'selection-preview');
 assert.equal((await registry.confirm(preview.token)).kind,'selected');
 assert.equal(registry.state().selected.vault,DEFAULT_LAYOUT_VAULT_ID);
 const before=await filesUnder(rootA,directory);await registry.close();
 const coldRegistry=await openSyncConnections({app,pluginId,locks,catalog,nextId:()=>{throw Error('no new ID on reopen');}});
 assert.equal(coldRegistry.state().selected.vault,DEFAULT_LAYOUT_VAULT_ID);
 assert.deepEqual(await filesUnder(rootA,directory),before);await coldRegistry.close();
 checks.push({case:'registry-selection-reopen',pass:true,selectionNotAcceptance:true,noSharedWrite:true});
 const result={pass:true,out,checks,processExits:3,scope:'Real files and process exits; file-backed App contract and injected locks. Exchange is local file copy, not Nutstore, iPad or real transfer.'};
 await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}