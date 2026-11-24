// Read-only product reconnaissance: new synthetic instances only; no G4/G5 artifacts.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {device, state} from './sync-g4-helpers.mjs';
import {createUnifiedSyncHost} from '../src/sync/obsidian-unified-host.mjs';
import {deriveSyncStatus} from '../src/sync/obsidian-sync-settings.mjs';
import {PRIVATE_STORE_BUDGET} from '../src/sync/private-store-budget-prototype.mjs';
import {exportRecoveryParts} from '../src/sync/connection-lifecycle-prototype.mjs';
import {createNodeSyncStore} from './sync-node-store.mjs';

const out=await fs.mkdtemp('.local/sync-016/g6/recon-');
const checks=[], observations={};
const d=await device();
try {
 await d.select();
 const baseline=structuredClone(state(d).accepted.snapshot);
 for(let n=0;n<24;n++){
  const c=d.capture(`Synthetic/${n%2?'B':'A'}.md`,30+n);
  await d.command('edit',c.key,c.value);
  assert.equal(state(d).pending,null);
  assert.equal(state(d).localState.layoutDraft,null);
 }
 const accepted=structuredClone(state(d).accepted),scan=await d.history().scan();
 assert.equal(new Set(accepted.operations.map(o=>o.id)).size,25);
 assert.equal(scan.inventory.length,25);
 assert.notDeepEqual(accepted.snapshot.groups,baseline.groups);
 observations.multiOperation={operations:25,physicalFiles:scan.inventory.length,groups:Object.keys(accepted.snapshot.groups).length,sequence:state(d).sequence,bytes:scan.inventory.reduce((s,r)=>s+r.size,0)};
 checks.push('24 distinct alternating two-group edits plus imported root through production graph/store/host/session');

 // The public diagnostics are data, not a recoverable export manifest.
 const report=await d.h.diagnostics();
 assert.equal('privateBudget' in report,false);
 assert.equal(typeof d.h.exportRecovery,'undefined');
 observations.normalExport={hostRecoveryMethod:false,privateBudgetInDiagnostics:false};

 // Exercise the existing core only, outside the private quota, with a real
 // no-replace Node destination. This does NOT establish normal UI reachability.
 const destination=createNodeSyncStore(out+'/export'),exportId=randomBytes(16).toString('hex');
 const result=await exportRecoveryParts({destination,id:exportId,vault:d.h.state().selected.vault,installation:d.h.state().installation,session:state(d),configuration:null,initial:null,joinBackup:null});
 const manifest=JSON.parse(await destination.read(exportId+'/manifest.json',8388608));
 for(const row of manifest.files){const raw=await destination.read(exportId+'/'+row.name,row.bytes);assert.equal(Buffer.byteLength(raw),row.bytes);}
 assert.deepEqual(JSON.parse(await destination.read(exportId+'/accepted.json',8388608)),accepted.snapshot);
 observations.coreExport={...result,configuration:'not supplied by public host; not a complete recovery package'};
 checks.push('Existing core exports synthetic accepted snapshot and all 25 operation bodies to new disk destination');
 const partialId=randomBytes(16).toString('hex');let writes=0;
 await assert.rejects(()=>exportRecoveryParts({destination:{read:destination.read,create:async(...args)=>{if(++writes===3)throw Error('controlled-destination-failure');return destination.create(...args);}},id:partialId,vault:d.h.state().selected.vault,installation:d.h.state().installation,session:state(d),configuration:null,initial:null,joinBackup:null}),/controlled-destination-failure/);
 assert.equal(await destination.read(partialId+'/manifest.json',8388608),null);
 checks.push('Controlled partial export leaves no completion manifest and does not change source acceptance');
 assert.deepEqual(state(d).accepted,accepted);

 // Reopen the same new synthetic instance with a deliberately small soft
 // threshold. Hard limits stay unchanged. Not real-scale capacity evidence.
 await d.h.close();
 d.options.budgetLimits={...PRIVATE_STORE_BUDGET,softEvents:1};
 d.h=await createUnifiedSyncHost(d.options);
 assert.equal(d.h.state().status,'paused');
 assert.deepEqual(state(d).accepted,accepted);
 const changed=structuredClone(accepted.snapshot);
 Object.values(changed.groups)[0].points[0].x+=0.01;
 await assert.rejects(()=>d.h.saveLayout(changed),/paused/);
 assert.equal(deriveSyncStatus(d.h.state()).key,'unsaved');
 observations.smallThreshold={softEvents:1,status:d.h.state().status,saveError:d.h.state().saveError,display:deriveSyncStatus(d.h.state()),acceptedPreserved:true};
 checks.push('Small injected private soft threshold cold-opens paused; rejected new save displays unsaved and keeps accepted work');

 // Existing normal selection/import path: deliberately record whether it
 // uses the accepted layout or the stale pre-join data.json source.
 const oldVault=d.h.state().selected.vault;
 await d.h.disable();
 delete d.options.budgetLimits;
 await d.h.close();d.h=await createUnifiedSyncHost(d.options);
 const p=await d.h.previewSelection({action:'new'});
 assert.equal(p.kind,'selection-preview');
 await d.h.confirmSelection(p.token);
 const j=await d.h.previewJoin();assert.equal(j.kind,'join-preview');
 await d.h.confirmJoin(j.token,'import');
 assert.notEqual(d.h.state().selected.vault,oldVault);
 assert.deepEqual(state(d).accepted.snapshot.groups,baseline.groups);
 assert.notDeepEqual(state(d).accepted.snapshot.groups,accepted.snapshot.groups);
 observations.manualNewConnection={importsStaleSource:true,oldVault,newVault:d.h.state().selected.vault,oldAcceptedRetainedInOldBackend:true};
 checks.push('Reproduced existing new-connection import using stale pre-join source rather than latest accepted groups');
} finally {await d.h.close();await d.io.close();}
const summary={date:'2026-11-17',pass:true,checks,observations,scope:'New synthetic graph/store/host/session; App/shared/private backend are memory contract adapters. Only export destination is real Node disk. Small threshold is injected, not real capacity/IndexedDB/native/iPad/Nutstore/OS disk-full evidence.',out};
await fs.writeFile(out+'/summary.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary));
