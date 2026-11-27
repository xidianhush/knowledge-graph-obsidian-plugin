// A3 disk protocol over injected stores. No Obsidian, Node or production I/O.
// Store.create must atomically install a COMPLETE file without replacement;
// privateStore.acquire must exclude other writers and survive process crashes.
import {cloneBoundedSyncJson,CAUSAL_PROTOTYPE_LIMITS as limits} from './causal-prototype.mjs';
import {planSchema3Transactions,projectAcceptedSchema3History,validateSchema3Snapshot,validateCurrentJoinCoverage,inspectSchema3History} from './layout-prototype.mjs';
import {packSchema3Operation} from './wire-prototype.mjs';
import {randomSyncOperationId} from './author-prototype.mjs';
import {reviewSchema3Conflict,buildSchema3ConflictResolution} from './conflict-resolution-prototype.mjs';
const ID=/^[a-f0-9]{32}$/,HASH=/^[a-f0-9]{64}$/,META=262144,MAX_EVENTS=4096;
const REPLAY_BLOB_BYTES=512*1024,REPLAY_BLOB_ENTRIES=1024;
const copy=x=>structuredClone(x),fail=reason=>{throw Error('persistence-'+reason);};
const canonical=(value,maxBytes=limits.snapshotBytes)=>JSON.stringify(cloneBoundedSyncJson(value,{maxBytes}));
const same=(a,b)=>canonical(a)===canonical(b);
const fields=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const empty=revision=>({schemaVersion:3,revision,groups:{},structures:{}});
export async function syncContentHash(text,cryptoProvider=globalThis.crypto){
  if(!cryptoProvider?.subtle)fail('crypto-unavailable');
  return Array.from(new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('');
}
const operationDirectory=vault=>`Knowledge Map Sync/v2/${vault}/ops`;
async function scanSharedHistory(sharedStore,vault){
  const directory=operationDirectory(vault),namespace=directory+'/';
  const names=(await sharedStore.list(directory)).filter(name=>/\.json$/i.test(name)).sort();
  if(names.length>limits.operations)return {issue:'shared-operation-budget'};
  const records=[],canonicalFiles=new Map(),fingerprints=[];let total=0;
  for(const name of names){
    const filename=name.slice(namespace.length);
    if(!name.startsWith(namespace)||filename.includes('/'))return {issue:'shared-file-scope'};
    const raw=await sharedStore.read(name,limits.recordBytes);if(raw===null)return {issue:'shared-scan-changed'};
    total+=new TextEncoder().encode(raw).length;if(total>limits.totalBytes)return {issue:'shared-byte-budget'};
    let op;try{op=JSON.parse(raw);}catch{return {issue:'shared-partial-json'};}
    if(op?.protocol!==2||op.vault!==vault||typeof op.id!=='string'||!ID.test(op.id))return {issue:'shared-envelope'};
    const normal=canonical(op,limits.recordBytes),hash=await syncContentHash(normal);
    if(/^[a-f0-9]{32}\.json$/.test(filename)){
      if(filename!==op.id+'.json')return {issue:'shared-filename-id'};canonicalFiles.set(op.id,hash);
    }
    fingerprints.push([name,hash]);records.push(op);
  }
  for(const op of records)if(!canonicalFiles.has(op.id))return {issue:'shared-canonical-file-missing'};
  return {records,canonicalFiles,inventory:fingerprints.map(([name,hash])=>({name,hash})),fingerprint:await syncContentHash(canonical(fingerprints,META))};
}
function checkJoinHistory(scan,vault){
  if(scan.issue)return scan;
  const {index}=inspectSchema3History(scan.records,{vault});
  if(index.issues.length||index.quarantined.length||index.pending.length)return {issue:'shared-input-unresolved'};
  return scan;
}
export async function previewSharedJoin({sharedStore,vault,createModel}){
  if(!ID.test(vault))fail('vault');
  const scan=checkJoinHistory(await scanSharedHistory(sharedStore,vault),vault);
  if(scan.issue)return {kind:'review-required',reason:scan.issue};
  if(!scan.records.length)return {kind:'review-required',reason:'shared-history-empty'};
  const candidate=planSchema3Transactions(scan.records,{vault,baseline:empty(0),createModel});
  if(candidate.status!=='candidate')return {kind:'review-required',reason:'shared-candidate-blocked'};
  return {kind:'shared-preview',fingerprint:scan.fingerprint,operations:candidate.index.ready.length,
    groups:Object.keys(candidate.proposal.groups).length};
}
export function createDurableSyncSession({privateStore,sharedStore,attemptHistory,vault,installation,createModel,getEpoch=()=>0,checkpoint=async()=>{},nextId=randomSyncOperationId,normalizeLocalLayout,projectLocalLayout,readLocalData,access='sync',enableConflictResolution=false}={}) {
  if(!['sync','local-only'].includes(access))fail('access');
  const requireSync=()=>{if(access!=='sync')fail('local-only');};
  if(!ID.test(vault)||!ID.test(installation)||typeof createModel!=='function'||typeof getEpoch!=='function'||typeof nextId!=='function'||
    normalizeLocalLayout!==undefined&&typeof normalizeLocalLayout!=='function'||projectLocalLayout!==undefined&&typeof projectLocalLayout!=='function'||readLocalData!==undefined&&typeof readLocalData!=='function')fail('options');
  for(const store of attemptHistory?[privateStore]:[privateStore,sharedStore])if(!store||['read','create','list'].some(k=>typeof store[k]!=='function'))fail('store');
  if(attemptHistory&&['scan','allocate','write','validPath'].some(k=>typeof attemptHistory[k]!=='function'))fail('attempt-store');
  if(typeof privateStore.acquire!=='function')fail('exclusive-store-required');
  let release=null,opening=false,opened=false,faulted=false,closed=false,tail=Promise.resolve(),head=null,sequence=0,receipt=null,pending=null,localState=null,joining=null,localDocument=null;
  const localDocumentVersions=new Map();
  // Derived only from verified ordinary local accept events; never from a
  // receive, join or conflict decision. Rebuilt on open, with no format change.
  const localPublications=new Map();
  function rememberPublication(next){
    if(pending.meta.version===1)localPublications.set(receipt.fingerprint,{operationId:pending.id,beforeFingerprint:receipt.fingerprint,afterFingerprint:next.fingerprint});
  }
  const resolutionReviews=new WeakMap();
  const recoveryReviews=new WeakMap();
  const attemptLimit=4;
  let attemptConflict=null;
  const journalFields=['version','installation','vault','sequence','previous','kind','data'];
  if(attemptHistory)journalFields.push('transport');
  // A lease-scoped cache of validated content-addressed blobs. Every journal
  // event is still read and checked, and each new open starts with an empty cache.
  let replayBlobs=null,replayBlobBytes=0;
  const resolved=new Set(),cancelled=new Set(),knownIntents=new Map(),namespace=operationDirectory(vault)+'/';
  const eventName=n=>`events/${String(n).padStart(12,'0')}.json`;
  const equalIds=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&same([...a].sort(),[...b].sort());
  function enqueue(fn){const work=tail.catch(()=>{}).then(async()=>{
    if(!opened||closed||faulted)fail('reopen-required');
    try{return await fn();}catch(error){faulted=true;throw error;}
  });tail=work;return work;}
  async function readPrivate(name,budget=META){
    const raw=await privateStore.read(name,budget);if(raw===null)fail('missing-private-file');
    let value;try{value=JSON.parse(raw);}catch{fail('partial-private-json');}
    const text=canonical(value,budget);if(text!==raw)fail('private-file-changed');
    return {value,text,hash:await syncContentHash(text)};
  }
  async function install(name,text){
    await privateStore.create(name,text);
    const found=await privateStore.read(name,new TextEncoder().encode(text).length);
    if(found!==text)fail('private-create-conflict');
  }
  async function blob(value,budget){
    const text=canonical(value,budget),hash=await syncContentHash(text);
    await install(`blobs/${hash}.json`,text);return hash;
  }
  async function loadBlob(hash,budget){
    if(!HASH.test(hash))fail('blob-reference');
    const cached=replayBlobs?.get(hash);
    if(cached&&cached.bytes<=budget){
      privateStore.checkReplayCacheAccess();
      // Keep reused history blobs ahead of one-use snapshots, within both caps.
      replayBlobs.delete(hash);replayBlobs.set(hash,cached);
      return copy(cached.value);
    }
    const result=await readPrivate(`blobs/${hash}.json`,budget);
    if(result.hash!==hash)fail('blob-changed');
    if(replayBlobs&&result.text.length<=REPLAY_BLOB_BYTES){
      const bytes=new TextEncoder().encode(result.text).length;
      if(bytes<=REPLAY_BLOB_BYTES){
        while(replayBlobs.size>=REPLAY_BLOB_ENTRIES||replayBlobBytes+bytes>REPLAY_BLOB_BYTES){
          const oldest=replayBlobs.keys().next().value;
          replayBlobBytes-=replayBlobs.get(oldest).bytes;
          replayBlobs.delete(oldest);
        }
        replayBlobs.set(hash,{bytes,value:copy(result.value)});
        replayBlobBytes+=bytes;
      }
    }
    return result.value;
  }
  async function loadReceipt(data){
    if(!fields(data,['snapshot','operations'])||!Array.isArray(data.operations)||data.operations.length>limits.operations)fail('receipt');
    const snapshot=await loadBlob(data.snapshot,limits.snapshotBytes),operations=[],ids=new Set();let bytes=0;
    for(const ref of data.operations){
      if(!fields(ref,['id','hash'])||!ID.test(ref.id)||ids.has(ref.id))fail('receipt-reference');
      const op=await loadBlob(ref.hash,limits.recordBytes);bytes+=new TextEncoder().encode(canonical(op,limits.recordBytes)).length;
      if(bytes>limits.totalBytes)fail('receipt-budget');
      if(op.protocol!==2||op.id!==ref.id||op.vault!==vault)fail('receipt-operation');ids.add(ref.id);operations.push(op);
    }
    const projection=projectAcceptedSchema3History(operations,{vault,revision:snapshot.revision});
    if(!same(projection.snapshot,snapshot))fail('receipt-projection');
    return {data:copy(data),snapshot,operations,ids:[...ids],fingerprint:await syncContentHash(canonical(data,META))};
  }
  async function loadIntent(id,expectedHash){
    if(!ID.test(id))fail('intent-id');
    const found=await readPrivate(`intents/${id}.json`),v=found.value;
    if(expectedHash&&found.hash!==expectedHash)fail('intent-changed');
    const names=['version','installation','vault','id','base','operation','backup','proposal','appliedIds'];
    if(v.version===2)names.push('mode','source');
    if(v.version===3)names.push('mode','inputs','choice','scan');
    if(!fields(v,names)||![1,2,3].includes(v.version)||(v.version===2&&(v.mode!=='import'||!HASH.test(v.source)))||
      (v.version===3&&(!enableConflictResolution||!attemptHistory||v.mode!=='resolution'||!HASH.test(v.scan)||!ID.test(v.choice)||!Array.isArray(v.inputs)))||
      v.installation!==installation||v.vault!==vault||v.id!==id||!HASH.test(v.base)||!Array.isArray(v.appliedIds))fail('intent');
    const operation=await loadBlob(v.operation,limits.recordBytes),backup=await loadBlob(v.backup,limits.snapshotBytes),proposal=await loadBlob(v.proposal,limits.snapshotBytes);
    if(operation.protocol!==2||operation.vault!==vault||operation.id!==id)fail('intent-operation');
    knownIntents.set(id,v.operation);
    const inputs=[];
    if(v.version===3){
      if(v.inputs.length>limits.operations)fail('resolution-input-budget');
      for(const ref of v.inputs){
        if(!fields(ref,['id','hash'])||!ID.test(ref.id)||!HASH.test(ref.hash))fail('resolution-input-reference');
        const op=await loadBlob(ref.hash,limits.recordBytes);if(op.id!==ref.id)fail('resolution-input-id');inputs.push(op);
      }
    }
    return {id,hash:found.hash,meta:v,operation,backup,proposal,...(v.version===3?{inputs}:{})};
  }
  function validateIntent(intent){
    if(intent.meta.version===2){
      if(receipt||!joining||joining.completed||joining.choice!=='import'||joining.id!==intent.id||intent.meta.source!==joining.source||
        intent.meta.backup!==joining.normalizedHash||intent.meta.proposal!==joining.normalizedHash||!same(intent.backup,joining.normalized)||
        !equalIds(intent.meta.appliedIds,[intent.id])||intent.meta.appliedIds.length!==1||intent.operation.parents.length)fail('import-intent-basis');
      const after=projectAcceptedSchema3History([intent.operation],{vault,revision:joining.normalized.revision});
      if(!same(after.snapshot,intent.proposal))fail('import-intent-projection');return;
    }
    if(!receipt||intent.meta.backup!==receipt.data.snapshot||!same(intent.backup,receipt.snapshot)||receipt.ids.includes(intent.id))fail('intent-basis');
    if(intent.meta.version===3){
      const refs=new Map(intent.meta.inputs.map(ref=>[ref.id,ref.hash]));
      if(refs.size!==intent.meta.inputs.length||receipt.data.operations.some(ref=>refs.get(ref.id)!==ref.hash))fail('resolution-receipt-coverage');
      const result=buildSchema3ConflictResolution(intent.inputs,{vault,revision:receipt.snapshot.revision,choice:intent.meta.choice,id:intent.id});
      if(!same(result.operation,intent.operation)||!same(result.proposal,intent.proposal)||
        !equalIds(result.appliedIds,intent.meta.appliedIds))fail('resolution-intent-projection');
      return;
    }
    if(!equalIds(intent.meta.appliedIds,[...receipt.ids,intent.id])||new Set(intent.meta.appliedIds).size!==intent.meta.appliedIds.length)fail('intent-applied-ids');
    const before=projectAcceptedSchema3History(receipt.operations,{vault,revision:receipt.snapshot.revision});
    if(!equalIds(intent.operation.parents,before.index.heads))fail('intent-parents');
    const after=projectAcceptedSchema3History([...receipt.operations,intent.operation],{vault,revision:receipt.snapshot.revision});
    if(!same(after.snapshot,intent.proposal))fail('intent-projection');
  }
  async function append(kind,data){
    if(sequence>=MAX_EVENTS)fail('journal-budget');
    const event={version:1,installation,vault,sequence:sequence+1,previous:head,kind,data,
      ...(attemptHistory?{transport:'attempts-v1'}:{})};
    const text=canonical(event,META),hash=await syncContentHash(text);await install(eventName(sequence+1),text);
    head=hash;sequence++;return event;
  }
  async function applyEvent(event,hash){
    if(!fields(event,journalFields)||attemptHistory&&event.transport!=='attempts-v1'||event.version!==1||event.installation!==installation||
      event.vault!==vault||event.sequence!==sequence+1||event.previous!==head)fail('journal-chain');
    const d=event.data;
    if(event.kind==='init'){
      if(sequence||receipt||pending||joining)fail('journal-init');receipt=await loadReceipt(d);
    }else if(event.kind==='join-backup'){
      // Before joining, the only prior events can be quarantine and its explicit
      // recovery. They must not prevent a separately reviewed first join.
      if(receipt||pending||joining||attemptConflict||!fields(d,['source']))fail('journal-join-backup');
      const sourceData=await loadBlob(d.source,limits.snapshotBytes);if(!plainData(sourceData))fail('join-source');
      joining={source:d.source,sourceData,normalizedHash:null,normalized:null,choice:null,reason:null,id:null,completed:false};
    }else if(event.kind==='join-choice'){
      if(receipt||pending||!joining||joining.choice||!fields(d,['choice','reason','normalized','id'])||!['import','shared'].includes(d.choice)||
        !['explicit','empty','same-layout','current-layout'].includes(d.reason)||(d.choice==='import'?(!ID.test(d.id)||!['explicit','current-layout'].includes(d.reason)):d.id!==null))fail('journal-join-choice');
      const normalized=validateSchema3Snapshot(await loadBlob(d.normalized,limits.snapshotBytes));validateSourceCoverage(joining.sourceData,normalized,d.reason==='current-layout');
      if(d.choice==='import'&&d.reason!=='current-layout'&&!Object.keys(normalized.groups).length||d.reason==='empty'&&Object.keys(normalized.groups).length)fail('join-choice-shape');
      Object.assign(joining,{normalizedHash:d.normalized,normalized,choice:d.choice,reason:d.reason,id:d.id});
    }else if(event.kind==='join-consent'){
      if(receipt||pending||joining?.choice!=='shared'||joining.reason==='explicit'||!fields(d,[]))fail('journal-join-consent');joining.reason='explicit';
    }else if(event.kind==='join-adopt'){
      if(receipt||pending||joining?.choice!=='shared'||!fields(d,['receipt']))fail('journal-join-adopt');
      const next=await loadReceipt(d.receipt);
      if(next.snapshot.revision!==joining.normalized.revision||joining.reason==='same-layout'&&!sameLayout(next.snapshot,joining.normalized))fail('join-adopt-basis');
      receipt=next;joining.completed=true;
    }else if(event.kind==='receive'){
      if(!receipt||pending)fail('journal-receive');const next=await loadReceipt(d);validateExtension(next);receipt=next;
    }else if(event.kind==='local-state'){
      if(!receipt||!fields(d,['hash']))fail('journal-local-state');localState=await loadBlob(d.hash,limits.snapshotBytes);
    }else if(event.kind==='local-document'){
      if(!receipt||!fields(d,['previous','hash','backup'])||d.previous!==(localDocument?.version||null)||!HASH.test(d.backup)||localDocument&&d.backup!==localDocument.backup)fail('journal-local-document');
      if(!localDocument&&!plainData(await loadBlob(d.backup,limits.snapshotBytes)))fail('local-document-backup');
      const data=await loadBlob(d.hash,limits.snapshotBytes);if(!plainData(data))fail('local-document-shape');
      localDocument={version:hash,hash:d.hash,backup:d.backup,data};localDocumentVersions.set(hash,{hash:d.hash,backup:d.backup});
    }else if(event.kind==='stage'){
      if((!receipt&&joining?.choice!=='import')||pending||!fields(d,['id','hash']))fail('journal-stage');
      const intent=await loadIntent(d.id,d.hash);if(intent.meta.base!==head||resolved.has(intent.id))fail('intent-base');validateIntent(intent);pending=intent;
    }else if(event.kind==='publish'){
      if(!pending||pending.attempted||!fields(d,['id'])||d.id!==pending.id)fail('journal-publish');pending.attempted=true;
    }else if(event.kind==='attempt-path'){
      if(!attemptHistory||!pending?.attempted||!fields(d,['id','name'])||d.id!==pending.id||
        !attemptHistory.validPath(d.name,d.id,pending.meta.operation)||(pending.attempts?.length??0)>=attemptLimit||
        pending.attempts?.includes(d.name))fail('journal-attempt-path');
      (pending.attempts??=[]).push(d.name);
    }else if(event.kind==='attempt-conflict'){
      if(!attemptHistory||attemptConflict||!fields(d,['ids','evidence'])||!Array.isArray(d.ids)||!d.ids.length||
        d.ids.length>limits.operations||d.ids.some(id=>!ID.test(id))||!Array.isArray(d.evidence))fail('journal-attempt-conflict');
      attemptConflict=d;
    }else if(event.kind==='attempt-recovery'){
      if(!attemptHistory||!attemptConflict||!fields(d,['conflict','inventory'])||!HASH.test(d.conflict)||!HASH.test(d.inventory)||d.conflict!==await syncContentHash(canonical(attemptConflict,META)))fail('journal-attempt-recovery');
      attemptConflict=null;
    }else if(event.kind==='publication-abandoned'){
      if(!attemptHistory||!pending||pending.meta.version!==1||pending.attempts?.length||!fields(d,['id','backup','inventory'])||d.id!==pending.id||!HASH.test(d.backup)||!HASH.test(d.inventory))fail('journal-abandoned');
      cancelled.add(pending.id);resolved.add(pending.id);pending=null;
    }else if(event.kind==='accept'||event.kind==='cancel'){
      if(!pending||!fields(d,['id'])||d.id!==pending.id)fail('journal-resolution');
      if(event.kind==='accept'&&!pending.attempted||event.kind==='cancel'&&(pending.attempted||pending.meta.version===2))fail('journal-publication-state');
      if(event.kind==='accept'){
        const next=await loadReceipt({snapshot:pending.meta.proposal,operations:[...(pending.meta.inputs??receipt?.data.operations??[]),{id:pending.id,hash:pending.meta.operation}]});
        rememberPublication(next);receipt=next;
        if(pending.meta.version===2)joining.completed=true;
      }
      else cancelled.add(pending.id);
      resolved.add(pending.id);pending=null;
    }else fail('journal-kind');
    sequence=event.sequence;head=hash;
  }
  function state(){return copy({initialized:!!receipt,faulted,closed,sequence,head,
    ...(attemptHistory?{attemptConflict}:{}),
    accepted:receipt?{snapshot:receipt.snapshot,appliedIds:receipt.ids,operations:receipt.operations,fingerprint:receipt.fingerprint}:null,localState,
    joining:joining?{source:joining.source,normalized:joining.normalizedHash,choice:joining.choice,reason:joining.reason,id:joining.id,completed:joining.completed}:null,
    pending:pending?{id:pending.id,operation:pending.operation,proposal:pending.proposal,backup:pending.backup,publicationAttempted:!!pending.attempted,
      ...(pending.meta.version===3?{mode:'resolution',choice:pending.meta.choice}:{}),
      ...(attemptHistory?{attempts:pending.attempts??[]}:{})}:null});}
  async function checkSharedAccepted(){
    for(const ref of receipt.data.operations){
      const raw=await sharedStore.read(namespace+ref.id+'.json',limits.recordBytes);
      if(raw===null)return 'accepted-record-missing';
      let op;try{op=JSON.parse(raw);}catch{fail('shared-partial-json');}
      if(await syncContentHash(canonical(op,limits.recordBytes))!==ref.hash)fail('accepted-record-changed');
    }
    return null;
  }
  function validateExtension(next){
    const refs=new Map(next.data.operations.map(ref=>[ref.id,ref.hash]));
    if(next.snapshot.revision!==receipt.snapshot.revision||receipt.data.operations.some(ref=>refs.get(ref.id)!==ref.hash))fail('receipt-not-monotonic');
  }
  async function scanAttempts(intent){
    if(attemptConflict)return {issue:'attempt-conflict-review'};
    let scan;
    try{scan=await attemptHistory.scan(intent&&{intent:intent.operation,attempts:intent.attempts});}
    catch(error){return {issue:error.message==='attempt-file-budget'?'attempt-file-budget':'attempt-scan-unavailable'};}
    const trusted=new Map((receipt?.data.operations??[]).map(ref=>[ref.id,ref.hash]));
    if(intent)trusted.set(intent.id,intent.meta.operation);
    const ids=new Set(scan.quarantined);
    for(const row of scan.observations)if(trusted.has(row.id)&&trusted.get(row.id)!==row.bodyHash)ids.add(row.id);
    if(ids.size){
      const conflict={ids:[...ids].sort(),evidence:scan.observations.filter(row=>ids.has(row.id)).slice(0,16)};
      await append('attempt-conflict',conflict);
      attemptConflict=conflict;
      return {issue:'attempt-conflict-review'};
    }
    const blocker=scan.blockers.find(row=>row.reason!=='own-truncated-attempt');
    if(blocker)return {issue:blocker.reason,blockers:scan.blockers};
    return scan;
  }
  const scanShared=()=>attemptHistory?scanAttempts():scanSharedHistory(sharedStore,vault);
  async function repairedAttemptInput(){
    if(!attemptHistory||!attemptConflict)return {issue:'no-shared-recovery'};
    if(localState?.pendingSave)return {issue:'local-save-pending'};
    let scan;try{scan=await attemptHistory.scan(pending?{intent:pending.operation,attempts:pending.attempts}:undefined);}catch{return {issue:'attempt-scan-unavailable'};}
    if(scan.quarantined.length||scan.blockers.length)return {issue:'shared-input-blocked'};
    const issue=checkAttemptReceipt(scan);if(issue)return {issue};
    const trusted=new Map((receipt?.data.operations??[]).map(row=>[row.id,row.hash]));if(pending)trusted.set(pending.id,pending.meta.operation);
    for(const row of scan.observations){
      if(knownIntents.has(row.id)&&knownIntents.get(row.id)!==row.bodyHash)return {issue:'local-intent-id-conflict'};
      if(cancelled.has(row.id))return {issue:'cancelled-record-visible-review'};
      if(trusted.has(row.id)&&trusted.get(row.id)!==row.bodyHash)return {issue:'accepted-record-changed'};
      if(attemptConflict.ids.includes(row.id)&&!trusted.has(row.id)&&!attemptConflict.evidence.some(old=>old.id===row.id&&old.bodyHash===row.bodyHash))return {issue:'recovery-unverified-body'};
    }
    let plan;try{plan=planSchema3Transactions(scan.records,{vault,baseline:empty(receipt?.snapshot.revision??joining?.normalized?.revision??0),createModel});}catch{return {issue:'graph-incompatible'};}
    if(plan.status!=='candidate')return {issue:'shared-candidate-blocked'};
    return {...scan,proposal:plan.proposal};
  }
  function plainData(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
  const localLayout=data=>Object.hasOwn(data,'layoutOverrides')?data.layoutOverrides:null;
  const sameLayout=(a,b)=>same({groups:a.groups,structures:a.structures},{groups:b.groups,structures:b.structures});
  function matchesJoinSource(data){
    const raw=localLayout(data),original=localLayout(joining.sourceData);if(same(raw,original))return true;
    if(raw?.schemaVersion!==3)return false;
    try{validateSchema3Snapshot(raw);}catch{return false;}
    return original?.schemaVersion===3&&sameLayout(raw,original)||joining.normalized&&sameLayout(raw,joining.normalized)||receipt&&sameLayout(raw,receipt.snapshot);
  }
  async function liveJoinSourceMatches(){
    if(!readLocalData)return true;
    try{const data=cloneBoundedSyncJson(await readLocalData());return plainData(data)&&matchesJoinSource(data);}catch{return false;}
  }
  function validateSourceCoverage(data,normalized,current=false){
    const raw=localLayout(data);
    if(current){validateCurrentJoinCoverage(raw,normalized);return;}
    if(raw==null){if(Object.keys(normalized.groups).length)fail('migration-invented-layout');return;}
    if(!plainData(raw)||![1,2,3].includes(raw.schemaVersion)||!plainData(raw.groups))fail('local-layout-version');
    if(Object.keys(raw.groups).length!==Object.keys(normalized.groups).length)fail('migration-group-loss');
  }
  async function normalizeSource(data){
    const raw=localLayout(data);let normalized;
    if(raw==null)normalized=empty(0);
    else if(!plainData(raw)||![1,2,3].includes(raw.schemaVersion)||!plainData(raw.groups))fail('local-layout-version');
    else if(normalizeLocalLayout)normalized=await normalizeLocalLayout(copy(raw));
    else if(raw.schemaVersion===3)normalized=raw;
    else fail('legacy-normalizer-required');
    normalized=validateSchema3Snapshot(normalized);validateSourceCoverage(data,normalized);return normalized;
  }
  async function currentSource(data){
    if(!projectLocalLayout)fail('current-layout-unavailable');
    const raw=localLayout(data),projected=await projectLocalLayout(copy(raw));
    const snapshot=validateSchema3Snapshot(projected.snapshot);validateSourceCoverage(data,snapshot,true);
    return {snapshot,sourceGroups:Object.keys(raw.groups).length,omittedGroups:Object.keys(raw.groups).filter(key=>!Object.hasOwn(snapshot.groups,key))};
  }
  const importChanges=normalized=>Object.entries(normalized.groups).map(([group,record])=>({group,value:{schemaVersion:3,record,structures:record.note?{[record.note]:normalized.structures[record.note]}:{}}}));
  const joinScan=async()=>checkJoinHistory(await (attemptHistory&&pending?.meta.version===2?scanAttempts(pending):scanShared()),vault);
  async function stageImport(){
    const normalized=joining.normalized;
    const changes=importChanges(normalized);if(!changes.length&&joining.reason==='current-layout')changes.push({group:'root',value:null});
    const operation=packSchema3Operation({vault,id:joining.id,parents:[],changes});
    const meta={version:2,mode:'import',installation,vault,id:operation.id,base:head,source:joining.source,operation:await blob(operation,limits.recordBytes),
      backup:joining.normalizedHash,proposal:joining.normalizedHash,appliedIds:[operation.id]};
    const intent={id:operation.id,meta,operation,backup:normalized,proposal:normalized};validateIntent(intent);
    if((await privateStore.list('intents')).length>=limits.operations)fail('intent-budget');
    const text=canonical(meta,META);await install(`intents/${intent.id}.json`,text);intent.hash=await syncContentHash(text);knownIntents.set(intent.id,meta.operation);
    await checkpoint('after-intent');await append('stage',{id:intent.id,hash:intent.hash});pending=intent;await checkpoint('after-stage');
  }
  function checkAttemptReceipt(scan){
    if(scan.issue)return scan.issue;
    for(const ref of receipt?.data.operations??[]){
      if(!scan.canonicalFiles.has(ref.id))return 'accepted-record-missing';
      if(scan.canonicalFiles.get(ref.id)!==ref.hash)return 'accepted-record-changed';
    }
    return null;
  }
  async function unwrittenPublicationInput(){
    if(!attemptHistory||!pending||pending.meta.version!==1||pending.attempts?.length||attemptConflict||localState?.pendingSave)return {issue:'publication-may-have-started'};
    let scan;try{scan=await attemptHistory.scan();}catch{return {issue:'shared-input-blocked'};}
    const issue=checkAttemptReceipt(scan);if(issue)return {issue};
    if(scan.blockers.length||scan.quarantined.length||scan.observations.some(row=>row.id===pending.id))return {issue:'publication-visible-or-blocked'};
    for(const row of scan.observations)if(knownIntents.has(row.id)&&(knownIntents.get(row.id)!==row.bodyHash||cancelled.has(row.id)))return {issue:'local-intent-id-conflict'};
    return scan;
  }
  async function checkResolutionInput(scan){
    if(pending?.meta.version!==3)return null;
    const own=new Set(pending.attempts??[]);
    const fingerprint=await syncContentHash(JSON.stringify(scan.inventory.filter(row=>!own.has(row.name))));
    return fingerprint===pending.meta.scan?null:'resolution-input-changed';
  }
  async function resolutionScan(){
    if(!enableConflictResolution||!attemptHistory)return {issue:'resolution-disabled'};
    if(!receipt||pending||localState?.layoutDraft||localState?.pendingSave)return {issue:'resolution-local-action-pending'};
    const scan=await scanAttempts(),issue=checkAttemptReceipt(scan);
    if(issue)return {issue};
    for(const [id,hash] of knownIntents)if(scan.canonicalFiles.has(id)){
      if(scan.canonicalFiles.get(id)!==hash||cancelled.has(id))return {issue:'resolution-local-intent-review'};
    }
    return scan;
  }
  async function writeAttempt(text,scan,epoch,beforeWrite,canContinue){
    if(scan.canonicalFiles.get(pending.id)===pending.meta.operation)return null;
    const attempts=pending.attempts??=[];
    if(attempts.length>=attemptLimit)return 'attempt-retry-budget';
    if(scan.count>=limits.operations||scan.total+new TextEncoder().encode(text).length>limits.totalBytes)return 'attempt-file-budget';
    let name;
    try{name=await attemptHistory.allocate(pending.id,pending.meta.operation,attempts);}
    catch{return 'attempt-path-unavailable';}
    if(!name)return 'attempt-path-unavailable';
    if(getEpoch()!==epoch)return 'epoch-changed';
    await append('attempt-path',{id:pending.id,name});
    attempts.push(name);
    await checkpoint('after-attempt-path');
    if(beforeWrite){const issue=await beforeWrite();if(issue)return issue;}
    if(getEpoch()!==epoch)return 'epoch-changed';
    try{return await attemptHistory.write(name,text,{canContinue})?null:!canContinue()?'publication-unavailable':'attempt-path-occupied';}
    catch{return 'attempt-write-unconfirmed';}
  }
  function reviewedPublicationValid(scan){
    try{const records=pending?[...scan.records.filter(op=>op.id!==pending.id),pending.operation]:scan.records;
      const plan=planSchema3Transactions(records,{vault,baseline:empty(receipt?.snapshot.revision??0),createModel});
      return !plan.index.pending.length&&!plan.index.issues.length&&!plan.index.quarantined.length&&plan.decisions.every(d=>['candidate','conflict'].includes(d.status));
    }catch{return false;}
  }
  async function publishPending(importSource=false,reviewedJoin=null,canContinue=()=>true,reviewedConflict=null,observedOnly=false){
    if(!pending)fail('no-pending');const importing=pending.meta.version===2;
    if(!canContinue())return {kind:'held',reason:'publication-unavailable',state:state()};
    if(importing&&!importSource)return {kind:'held',reason:'join-local-source-required',state:state()};
    if(!importing&&!receipt)fail('no-pending');
    validateIntent(pending);const epoch=getEpoch();if(!Number.isSafeInteger(epoch)||epoch<0)fail('epoch');
    const revision=receipt?.snapshot.revision??pending.proposal.revision;
    const candidate=planSchema3Transactions([...(pending.inputs??receipt?.operations??[]),pending.operation],{vault,baseline:empty(revision),createModel});
    if(candidate.status!=='candidate'||!same(candidate.proposal,pending.proposal))return {kind:'held',reason:'graph-incompatible',state:state()};
    const held=reason=>({kind:'held',reason,state:state()});
    if(observedOnly&&(!attemptHistory||pending.meta.version!==1||localState?.layoutDraft||localState?.pendingSave))return held('published-completion-unavailable');
    const reviewedInput=reviewedJoin??reviewedConflict;
    const originalNames=new Set(reviewedInput?.inventory.map(row=>row.name)??[]);
    async function joinInputChanged(scan){
      if(!reviewedInput)return false;
      // Only paths allocated by this call may be new. Existing own attempts,
      // external duplicates and every other observed byte remain consent inputs.
      const ownNew=new Set((pending.attempts??[]).filter(name=>!originalNames.has(name)));
      if(!attemptHistory&&!reviewedJoin.canonicalFiles.has(pending.id))ownNew.add(namespace+pending.id+'.json');
      return !same(scan.inventory.filter(row=>!ownNew.has(row.name)),reviewedInput.inventory);
    }
    let sharedStatus,observed;
    if(attemptHistory){
      observed=await scanAttempts(pending);
      const issue=checkAttemptReceipt(observed);if(issue)return held(issue);
      if(observedOnly&&observed.canonicalFiles.get(pending.id)!==pending.meta.operation)return held('published-operation-unavailable');
      if(reviewedConflict&&!reviewedPublicationValid(observed))return held('shared-input-unresolved');
      if(await joinInputChanged(observed))return held('shared-scan-changed');
      if(importing){const checked=checkJoinHistory(observed,vault);if(checked.issue)return held(checked.issue);}
      const changed=await checkResolutionInput(observed);if(changed)return held(changed);
      // Prior complete bytes can recover an interrupted write. An existing
      // copy of a different body is never accepted by writing another copy.
    }else if(importing){
      const scan=await joinScan();if(scan.issue)return {kind:'held',reason:scan.issue,state:state()};
      if(await joinInputChanged(scan))return held('shared-scan-changed');
      if(scan.canonicalFiles.has(pending.id)&&scan.canonicalFiles.get(pending.id)!==pending.meta.operation)return {kind:'held',reason:'join-id-conflict',state:state()};
      sharedStatus=planSchema3Transactions([...scan.records,pending.operation],{vault,baseline:pending.proposal,createModel}).status;
    }else {const missing=await checkSharedAccepted();if(missing)return {kind:'held',reason:missing,state:state()};}
    if(importing&&!await liveJoinSourceMatches())return held('local-layout-changed');
    if(!canContinue())return held('publication-unavailable');
    if(getEpoch()!==epoch)return {kind:'held',reason:'epoch-changed',state:state()};
    if(!pending.attempted){await append('publish',{id:pending.id});pending.attempted=true;await checkpoint('after-publication-intent');}
    if(getEpoch()!==epoch)return {kind:'held',reason:'epoch-changed',state:state()};
    if(!canContinue())return held('publication-unavailable');
    const text=canonical(pending.operation,limits.recordBytes);
    if(attemptHistory){
      const beforeWrite=async()=>{
        if(!canContinue())return 'publication-unavailable';
        if(reviewedConflict){
          const check=await scanAttempts(pending),issue=checkAttemptReceipt(check);if(issue)return issue;
          if(!reviewedPublicationValid(check))return 'shared-input-unresolved';
          if(await joinInputChanged(check))return 'shared-scan-changed';
        }
        if(importing){
          const check=await scanAttempts(pending);if(check.issue)return check.issue;
          if(await joinInputChanged(check))return 'shared-scan-changed';
          const checked=checkJoinHistory(check,vault);if(checked.issue)return checked.issue;
          if(!await liveJoinSourceMatches())return 'local-layout-changed';
        }
        return canContinue()?null:'publication-unavailable';
      };
      if(!observedOnly){const issue=await writeAttempt(text,observed,epoch,beforeWrite,canContinue);if(issue)return held(issue);}
    }else{
      if(importing&&reviewedJoin){
        const scan=await joinScan();if(scan.issue)return held(scan.issue);
        if(await joinInputChanged(scan))return held('shared-scan-changed');
        if(!await liveJoinSourceMatches())return held('local-layout-changed');
      }
      if(!canContinue())return held('publication-unavailable');
      const name=namespace+pending.id+'.json';await sharedStore.create(name,text);
      const raw=await sharedStore.read(name,limits.recordBytes);if(raw===null)fail('publication-missing');
      let actual;try{actual=JSON.parse(raw);}catch{fail('shared-partial-json');}
      if(canonical(actual,limits.recordBytes)!==text)fail('publication-conflict');
    }
    await checkpoint('after-publication');
    if((reviewedConflict||observedOnly)&&!canContinue())return held('publication-unavailable');
    if(getEpoch()!==epoch)return {kind:'held',reason:'epoch-changed-after-publication',state:state()};
    await checkpoint('before-accept');if((reviewedConflict||observedOnly)&&!canContinue())return held('publication-unavailable');if(getEpoch()!==epoch)return {kind:'held',reason:'epoch-changed-after-publication',state:state()};
    const next=await loadReceipt({snapshot:pending.meta.proposal,operations:[...(pending.meta.inputs??receipt?.data.operations??[]),{id:pending.id,hash:pending.meta.operation}]});
    if(attemptHistory){
      const scan=await scanAttempts(pending),issue=checkAttemptReceipt(scan);
      if(issue)return held(issue);
      if(await joinInputChanged(scan))return held('shared-scan-changed');
      const changed=await checkResolutionInput(scan);if(changed)return held(changed);
      if(scan.blockers.length||scan.canonicalFiles.get(pending.id)!==pending.meta.operation)return held('attempt-publication-unverified');
      const plan=planSchema3Transactions(scan.records,{vault,baseline:empty(revision),createModel});
      if(importing){
        const checked=checkJoinHistory(scan,vault);if(checked.issue)return held(checked.issue);
        sharedStatus=plan.status;
      }else if(plan.status!=='candidate'&&!(reviewedConflict&&!plan.index.pending.length&&!plan.index.issues.length&&!plan.index.quarantined.length&&plan.decisions.some(d=>d.status==='conflict')&&plan.decisions.every(d=>['conflict','candidate'].includes(d.status))))return held('shared-candidate-blocked');
      else sharedStatus=plan.status==='candidate'?'candidate':'conflict';
      const check=await scanAttempts(pending);
      if(check.issue)return held(check.issue);
      if(check.fingerprint!==scan.fingerprint)return held('shared-scan-changed');
    }else if(importing&&reviewedJoin){
      const scan=await joinScan();if(scan.issue)return held(scan.issue);
      if(await joinInputChanged(scan))return held('shared-scan-changed');
    }
    if(importing&&!await liveJoinSourceMatches())return held('local-layout-changed');
    if(getEpoch()!==epoch)return {kind:'held',reason:'epoch-changed-after-publication',state:state()};
    if((reviewedConflict||observedOnly)&&!canContinue())return held('publication-unavailable');
    const id=pending.id;await append('accept',{id});rememberPublication(next);receipt=next;resolved.add(id);pending=null;if(importing)joining.completed=true;await checkpoint('after-accept');
    return {kind:getEpoch()===epoch?'accepted':'accepted-deferred',...(importing||reviewedConflict?{sharedStatus}:{}),state:state()};
  }
  return {
    get access(){return access;},
    async open(){
      if(opening||opened||closed||faulted)fail('session-lifecycle');
      opening=true;
      try{
        release=await privateStore.acquire(installation);
        if(typeof privateStore.checkReplayCacheAccess==='function')replayBlobs=new Map();
        const names=(await privateStore.list('events')).sort();if(names.length>MAX_EVENTS)fail('journal-budget');
        for(let i=0;i<names.length;i++){
          if(names[i]!==eventName(i+1))fail('journal-gap');
          const event=await readPrivate(names[i]);await applyEvent(event.value,event.hash);
        }
        const intents=await privateStore.list('intents');if(intents.length>limits.operations)fail('intent-budget');
        const orphans=[];
        for(const name of intents){const match=/^intents\/([a-f0-9]{32})\.json$/.exec(name);if(!match)fail('intent-filename');
          if(!resolved.has(match[1])&&pending?.id!==match[1])orphans.push(await loadIntent(match[1]));}
        if(orphans.length){
          if(orphans.length!==1||pending||orphans[0].meta.base!==head)fail('orphan-review-required');
          validateIntent(orphans[0]);await append('stage',{id:orphans[0].id,hash:orphans[0].hash});pending=orphans[0];
        }
        opened=true;return state();
      }catch(error){faulted=true;if(release){await release();release=null;}throw error;}
      finally{replayBlobs=null;replayBlobBytes=0;opening=false;}
    },
    async initialize({records=[],appliedIds=[],localBaseline,source}={}){
      requireSync();
      if(!Array.isArray(records)||records.length>limits.operations)fail('initialize-budget');let total=0;
      records=records.map(op=>{const text=canonical(op,limits.recordBytes);total+=new TextEncoder().encode(text).length;if(total>limits.totalBytes)fail('initialize-budget');return JSON.parse(text);});
      appliedIds=cloneBoundedSyncJson(appliedIds,{maxBytes:META});localBaseline=cloneBoundedSyncJson(localBaseline);
      return enqueue(async()=>{
      if(receipt||pending||sequence||!['explicit-empty','verified-adopt'].includes(source))fail('initialize-consent');
      if(!equalIds(appliedIds,records.map(op=>op.id))||new Set(appliedIds).size!==appliedIds.length)fail('initialize-applied-ids');
      if(source==='explicit-empty'&&(records.length||Object.keys(localBaseline?.groups||{}).length))fail('initialize-not-empty');
      const candidate=planSchema3Transactions(records,{vault,baseline:empty(localBaseline?.revision),createModel});
      if(candidate.status!=='candidate'||!same(candidate.proposal,localBaseline))fail('initialize-candidate');
      const epoch=getEpoch();if(!Number.isSafeInteger(epoch)||epoch<0)fail('epoch');
      const operations=[];for(const op of records){if(op.protocol!==2)fail('initialize-version');operations.push({id:op.id,hash:await blob(op,limits.recordBytes)});}
      const data={snapshot:await blob(localBaseline,limits.snapshotBytes),operations};const checked=await loadReceipt(data);
      if(await (async()=>{for(const ref of operations){const raw=await sharedStore.read(namespace+ref.id+'.json',limits.recordBytes);
        if(raw===null||await syncContentHash(canonical(JSON.parse(raw),limits.recordBytes))!==ref.hash)return true;}return false;})())fail('initialize-shared-mismatch');
      if(getEpoch()!==epoch)return {kind:'held',reason:'epoch-changed'};
      await append('init',data);receipt=checked;await checkpoint('after-init');return {...state(),viewEpoch:epoch,viewDeferred:getEpoch()!==epoch};
    });},
    previewJoin({localData}={}){
      requireSync();localData=cloneBoundedSyncJson(localData);
      return enqueue(async()=>{
        if(receipt)return {kind:'already-joined',state:state()};
        const held=reason=>({kind:'review-required',reason});
        if(!plainData(localData))return held('local-data-shape');
        const epoch=getEpoch();
        let local=null,localIssue=null,current=null,currentFingerprint=null;
        try{local=await normalizeSource(localData);}catch(error){localIssue=error.message;}
        if(joining&&!same(localLayout(localData),localLayout(joining.sourceData)))return held('local-layout-changed');
        let canImport=!!local&&Object.keys(local.groups).length>0;
        if(canImport)try{planSchema3Transactions([],{vault,baseline:local,createModel});}catch(error){canImport=false;localIssue=error.message;}
        if(joining?.reason==='current-layout'&&joining.choice){
          const raw=localLayout(joining.sourceData);current={snapshot:copy(joining.normalized),sourceGroups:Object.keys(raw.groups).length,omittedGroups:Object.keys(raw.groups).filter(key=>!Object.hasOwn(joining.normalized.groups,key))};
        }else if(!canImport&&projectLocalLayout&&(localIssue||local&&Object.keys(local.groups).length))try{current=await currentSource(localData);}catch{/* Original failure stays visible when current projection is unavailable. */}
        if(!local&&!current)return held(localIssue);
        let canCurrent=!!current;
        if(current){currentFingerprint=await syncContentHash(canonical(current.snapshot));try{planSchema3Transactions([],{vault,baseline:current.snapshot,createModel});}catch{canCurrent=false;}}
        const scan=await joinScan();if(scan.issue)return held(scan.issue);
        let currentIssue=null;
        if(current&&scan.records.length&&!(joining?.reason==='current-layout'&&joining.choice==='import'&&scan.records.every(op=>op.id===joining.id))){canCurrent=false;currentIssue='history-not-empty';}
        const candidate=planSchema3Transactions(scan.records,{vault,baseline:empty(local?.revision??current.snapshot.revision),createModel});
        if(getEpoch()!==epoch)return held('epoch-changed');
        return {kind:'join-preview',fingerprint:scan.fingerprint,local,shared:candidate.status==='candidate'?candidate.proposal:null,
          current,currentFingerprint,canCurrent,currentIssue,localIssue,operations:scan.records.length,canImport,sharedStatus:candidate.status,choice:joining?.choice==='import'&&joining.reason==='current-layout'?'current':joining?.choice??null,pendingId:joining?.id??null};
      });
    },
    async join({localData,choice,expectedSharedFingerprint,expectedCurrentFingerprint}={}){
      requireSync();
      localData=cloneBoundedSyncJson(localData);if(!plainData(localData)||choice!==undefined&&!['import','shared','current'].includes(choice))fail('join-request');
      if(expectedSharedFingerprint!==undefined&&(!['shared','import','current'].includes(choice)||typeof expectedSharedFingerprint!=='string'||!HASH.test(expectedSharedFingerprint)))fail('join-fingerprint');
      if(expectedCurrentFingerprint!==undefined&&!HASH.test(expectedCurrentFingerprint)||choice==='current'&&expectedCurrentFingerprint===undefined)fail('join-current-consent');
      return enqueue(async()=>{
        const held=reason=>({kind:'review-required',reason,state:state()});
        async function reviewedScan(){
          const scan=await joinScan();
          if(scan.issue)return scan;
          if(expectedSharedFingerprint!==undefined&&scan.fingerprint!==expectedSharedFingerprint)return {issue:'shared-scan-changed'};
          return scan;
        }
        const sourceMatches=()=>matchesJoinSource(localData);
        if(receipt){
          if(!joining?.completed)return held('already-initialized-use-accepted-state');
          if(!sourceMatches())return held('local-layout-changed');
          const scan=await reviewedScan();if(scan.issue)return held(scan.issue);
          if(joining.choice==='import'){
            if(!scan.canonicalFiles.has(joining.id))return held('import-record-not-yet-available');
            if(scan.canonicalFiles.get(joining.id)!==knownIntents.get(joining.id))return held('import-record-content-changed');
          }
          if(expectedSharedFingerprint!==undefined&&scan.canonicalFiles.size!==receipt.data.operations.length)
            return held('accepted-history-differs-from-preview');
          for(const ref of receipt.data.operations){
            if(!scan.canonicalFiles.has(ref.id))return held('accepted-record-missing');
            if(scan.canonicalFiles.get(ref.id)!==ref.hash)return held('accepted-record-changed');
          }
          return {kind:'already-joined',sharedStatus:planSchema3Transactions(scan.records,{vault,baseline:empty(receipt.snapshot.revision),createModel}).status,state:state()};
        }
        const epoch=getEpoch();if(!Number.isSafeInteger(epoch)||epoch<0)fail('epoch');
        // A UI confirmation authorizes only the shared history shown in its preview.
        const reviewed=expectedSharedFingerprint===undefined?null:await reviewedScan();
        if(reviewed?.issue)return held(reviewed.issue);
        if(readLocalData){
          let live;try{live=cloneBoundedSyncJson(await readLocalData());}catch{return held('local-layout-changed');}
          if(!plainData(live)||!same(localLayout(live),localLayout(localData)))return held('local-layout-changed');
        }
        let projected=null;
        if(!joining?.choice&&(choice==='current'||choice==='shared'&&expectedCurrentFingerprint)){
          try{projected=await currentSource(localData);}catch(error){return held(error.message);}
          if(await syncContentHash(canonical(projected.snapshot))!==expectedCurrentFingerprint)return held('current-layout-changed');
        }
        if(choice==='current'){
          const scan=reviewed??await reviewedScan();if(scan.issue)return held(scan.issue);
          if(scan.records.length&&!(joining?.reason==='current-layout'&&joining.choice==='import'&&scan.records.every(op=>op.id===joining.id)))return held('current-history-not-empty');
        }
        if(joining?.reason==='current-layout'&&expectedCurrentFingerprint&&await syncContentHash(canonical(joining.normalized))!==expectedCurrentFingerprint)return held('current-layout-changed');
        if(!joining){
          if(pending||attemptConflict)fail('join-state');const source=await blob(localData,limits.snapshotBytes);
          await append('join-backup',{source});joining={source,sourceData:copy(localData),normalizedHash:null,normalized:null,choice:null,reason:null,id:null,completed:false};
          await checkpoint('after-join-backup');
        }
        if(!sourceMatches())return held('local-layout-changed');
        const requested=choice==='current'?'import':choice;
        if(joining.choice&&choice!==undefined&&(requested!==joining.choice||choice==='current'&&joining.reason!=='current-layout')&&!(joining.reason==='empty'&&choice==='import'))return held('join-choice-changed');
        if(!joining.choice){
          let normalized;try{normalized=projected?.snapshot??await normalizeSource(joining.sourceData);}catch(error){return held(error.message);}
          const scan=reviewed??await reviewedScan();if(scan.issue)return held(scan.issue);
          const shared=planSchema3Transactions(scan.records,{vault,baseline:empty(normalized.revision),createModel});
          let selected=requested,reason=projected?'current-layout':'explicit';
          if(!projected&&!Object.keys(normalized.groups).length){selected='shared';reason='empty';}
          else if(selected===undefined){if(shared.status!=='candidate'||!sameLayout(shared.proposal,normalized))return held('join-choice-required');selected='shared';reason='same-layout';}
          if(selected==='shared'&&shared.status!=='candidate')return held('shared-candidate-blocked');
          let id=null;
          if(selected==='import'){
            try{
              planSchema3Transactions([],{vault,baseline:normalized,createModel});
              const changes=importChanges(normalized);if(!changes.length&&reason==='current-layout')changes.push({group:'root',value:null});
              packSchema3Operation({vault,id:'0'.repeat(32),parents:[],changes});
            }catch(error){return held(error.message);}
            const known=new Set(scan.records.map(op=>op.id));for(let i=0;i<8;i++){
              const candidate=nextId();if(typeof candidate!=='string'||!ID.test(candidate))fail('join-id-source');
              if(!known.has(candidate)){id=candidate;break;}
            }if(!id)fail('join-id-collision');
          }
          const normalizedHash=await blob(normalized,limits.snapshotBytes);
          if(getEpoch()!==epoch)return held('epoch-changed');
          await append('join-choice',{choice:selected,reason,normalized:normalizedHash,id});Object.assign(joining,{normalizedHash,normalized,choice:selected,reason,id});
          await checkpoint('after-join-choice');
        }else if(joining.choice==='shared'&&!['explicit','current-layout'].includes(joining.reason)&&choice==='shared'){
          await append('join-consent',{});joining.reason='explicit';
        }
        if(getEpoch()!==epoch)return held('epoch-changed');
        if(joining.choice==='import'){
          if(!pending)await stageImport();if(getEpoch()!==epoch)return held('epoch-changed');
          const result=await publishPending(true,reviewed);
          if(result.kind==='accepted'||result.kind==='accepted-deferred')return {...result,kind:result.kind==='accepted'?'imported':'imported-deferred'};
          return result;
        }
        const scan=await reviewedScan();if(scan.issue)return held(scan.issue);
        const candidate=planSchema3Transactions(scan.records,{vault,baseline:empty(joining.normalized.revision),createModel});
        if(candidate.status!=='candidate')return held('shared-candidate-blocked');
        if(joining.reason==='same-layout'&&!sameLayout(candidate.proposal,joining.normalized))return held('join-shared-changed-choice-required');
        const operations=[];for(const op of candidate.index.ready)operations.push({id:op.id,hash:await blob(op,limits.recordBytes)});
        const data={snapshot:await blob(candidate.proposal,limits.snapshotBytes),operations},next=await loadReceipt(data);
        await checkpoint('before-join-adopt');const check=await joinScan();if(check.issue||check.fingerprint!==scan.fingerprint)return held('shared-scan-changed');
        if(!await liveJoinSourceMatches())return held('local-layout-changed');
        if(getEpoch()!==epoch)return held('epoch-changed');
        await append('join-adopt',{receipt:data});receipt=next;joining.completed=true;await checkpoint('after-join-adopt');
        return {kind:getEpoch()===epoch?'adopted':'adopted-deferred',state:state()};
      });
    },
    getJoinBackup:()=>joining?copy(joining.sourceData):null,
    getJoinProof(){
      if(!opened||faulted||!joining?.completed||!receipt)return null;
      const operation=joining.choice==='import'?receipt.operations.find(op=>op.id===joining.id):null;
      return copy({joinReceipt:{version:1,vault,installation,source:joining.source,normalized:joining.normalizedHash,choice:joining.choice,
        operation:operation?{id:operation.id,hash:knownIntents.get(operation.id)}:null},importReceipt:operation?{version:1,vault,operation}:null});
    },
    previewConflictResolution(){requireSync();return enqueue(async()=>{
      const scan=await resolutionScan();if(scan.issue)return {kind:'held',reason:scan.issue};
      const epoch=getEpoch(),fingerprint=receipt.fingerprint;
      if(!Number.isSafeInteger(epoch)||epoch<0)fail('epoch');
      let review;
      try{
        review=reviewSchema3Conflict(scan.records,{vault,revision:receipt.snapshot.revision});
        let probeId='f'.repeat(32);
        for(let n=1;scan.canonicalFiles.has(probeId);n++)probeId=(BigInt('0x'+'f'.repeat(32))-BigInt(n)).toString(16).padStart(32,'0');
        for(const choice of review.choices){
          const planned=buildSchema3ConflictResolution(scan.records,{vault,revision:receipt.snapshot.revision,choice:choice.id,id:probeId});
          const candidate=planSchema3Transactions([...scan.records,planned.operation],{vault,baseline:empty(receipt.snapshot.revision),createModel});
          choice.compatible=candidate.status==='candidate'&&same(candidate.proposal,planned.proposal);
        }
        if(!review.choices.some(choice=>choice.compatible))return {kind:'held',reason:'resolution-graph-incompatible'};
      }catch(error){return {kind:'held',reason:error.message.startsWith('resolution-')?error.message:'resolution-preview-unavailable'};}
      const check=await resolutionScan();
      if(check.issue||check.fingerprint!==scan.fingerprint||getEpoch()!==epoch)return {kind:'held',reason:check.issue??'resolution-input-changed'};
      const token=Object.freeze({});resolutionReviews.set(token,{scan:scan.fingerprint,receipt:fingerprint,epoch});
      return {kind:'review',token,groups:copy(review.groups),choices:copy(review.choices).map(choice=>({...choice,isLocal:(choice.sourceHeads??[choice.id]).every(id=>receipt.ids.includes(id))}))};
    });},
    discardConflictReview:token=>resolutionReviews.delete(token),
    confirmConflictResolution(token,choice){requireSync();return enqueue(async()=>{
      const consent=resolutionReviews.get(token);resolutionReviews.delete(token);
      const held=reason=>({kind:'held',reason,state:state()});
      if(!consent)return held('resolution-review-required');
      const scan=await resolutionScan();if(scan.issue)return held(scan.issue);
      if(consent.scan!==scan.fingerprint||consent.receipt!==receipt.fingerprint||consent.epoch!==getEpoch())return held('resolution-input-changed');
      let draft;
      try{
        let id;
        for(let n=0;n<8;n++){const proposed=nextId();if(ID.test(proposed)&&!scan.canonicalFiles.has(proposed)&&!knownIntents.has(proposed)&&!resolved.has(proposed)){id=proposed;break;}}
        if(!id)return held('resolution-id-unavailable');
        draft=buildSchema3ConflictResolution(scan.records,{vault,revision:receipt.snapshot.revision,choice,id});
        const candidate=planSchema3Transactions([...scan.records,draft.operation],{vault,baseline:empty(receipt.snapshot.revision),createModel});
        if(candidate.status!=='candidate'||!same(candidate.proposal,draft.proposal))return held('resolution-graph-incompatible');
      }catch{return held('resolution-choice-invalid');}
      const check=await resolutionScan();
      if(check.issue||check.fingerprint!==scan.fingerprint||getEpoch()!==consent.epoch)return held(check.issue??'resolution-input-changed');
      if((await privateStore.list('intents')).length>=limits.operations)return held('resolution-intent-budget');
      const inputs=[];
      for(const op of scan.records)inputs.push({id:op.id,hash:await blob(op,limits.recordBytes)});
      const operation=draft.operation,meta={version:3,mode:'resolution',installation,vault,id:operation.id,base:head,
        operation:await blob(operation,limits.recordBytes),backup:receipt.data.snapshot,proposal:await blob(draft.proposal,limits.snapshotBytes),
        appliedIds:draft.appliedIds,inputs,choice,scan:scan.fingerprint};
      const intent={id:operation.id,meta,operation,backup:receipt.snapshot,proposal:draft.proposal,inputs:scan.records};validateIntent(intent);
      const text=canonical(meta,META);await install(`intents/${operation.id}.json`,text);intent.hash=await syncContentHash(text);
      knownIntents.set(intent.id,meta.operation);
      await checkpoint('after-intent');await append('stage',{id:intent.id,hash:intent.hash});pending=intent;
      await checkpoint('after-stage');return {kind:'staged',state:state()};
    });},
    async stage(draft){
      requireSync();
      draft={kind:draft?.kind,operation:cloneBoundedSyncJson(draft?.operation,{maxBytes:limits.recordBytes}),proposal:cloneBoundedSyncJson(draft?.proposal),
        appliedIds:cloneBoundedSyncJson(draft?.appliedIds,{maxBytes:META}),...(draft?.backup?{backup:cloneBoundedSyncJson(draft.backup)}:{})};
      return enqueue(async()=>{
      if(!receipt||pending||draft?.kind!=='publish')fail('stage-state');
      if((await privateStore.list('intents')).length>=limits.operations)fail('intent-budget');
      const operation=cloneBoundedSyncJson(draft.operation,{maxBytes:limits.recordBytes}),proposal=cloneBoundedSyncJson(draft.proposal);
      if(operation.protocol!==2||operation.vault!==vault||!ID.test(operation.id)||resolved.has(operation.id))fail('stage-operation');
      if(draft.backup&&!same(draft.backup,receipt.snapshot))fail('stage-backup');
      const candidate=planSchema3Transactions([...receipt.operations,operation],{vault,baseline:empty(receipt.snapshot.revision),createModel});
      if(candidate.status!=='candidate'||!same(candidate.proposal,proposal))fail('stage-candidate');
      const meta={version:1,installation,vault,id:operation.id,base:head,operation:await blob(operation,limits.recordBytes),
        backup:receipt.data.snapshot,proposal:await blob(proposal,limits.snapshotBytes),appliedIds:copy(draft.appliedIds)};
      const intent={id:operation.id,meta,operation,backup:receipt.snapshot,proposal};validateIntent(intent);
      const text=canonical(meta,META);await install(`intents/${operation.id}.json`,text);intent.hash=await syncContentHash(text);
      knownIntents.set(intent.id,meta.operation);
      await checkpoint('after-intent');await append('stage',{id:intent.id,hash:intent.hash});pending=intent;await checkpoint('after-stage');return state();
    });},
    async saveLocalState(value){
      value=cloneBoundedSyncJson(value);
      return enqueue(async()=>{
        if(!receipt)fail('local-state-before-init');const hash=await blob(value,limits.snapshotBytes);
        await append('local-state',{hash});localState=value;await checkpoint('after-local-state');return state();
      });
    },
    readLocalPublication(baseFingerprint){return enqueue(async()=>{
      const proof=localPublications.get(baseFingerprint);
      return proof?.afterFingerprint===receipt?.fingerprint?copy(proof):null;
    });},
    compareAndSetLocalState(expected,value,{acceptedFingerprint}={}){
      expected=cloneBoundedSyncJson(expected);value=cloneBoundedSyncJson(value);
      return enqueue(async()=>{
        if(!receipt||receipt.fingerprint!==acceptedFingerprint||!same(localState,expected))return {ok:false};
        const hash=await blob(value,limits.snapshotBytes);
        await append('local-state',{hash});localState=value;await checkpoint('after-local-state');return {ok:true};
      });
    },
    getLocalDocument(){if(!opened||closed||faulted)fail('reopen-required');return localDocument?copy({version:localDocument.version,data:localDocument.data,backup:localDocument.backup}):null;},
    listLocalDocumentVersions(){if(!opened||closed||faulted)fail('reopen-required');return [...localDocumentVersions.keys()];},
    readLocalDocumentVersion(version){const ref=localDocumentVersions.get(version);if(!ref)return Promise.reject(Error('persistence-local-document-version'));return enqueue(async()=>copy(await loadBlob(ref.hash,limits.snapshotBytes)));},
    getLocalDocumentBackup(){return enqueue(async()=>localDocument?copy(await loadBlob(localDocument.backup,limits.snapshotBytes)):null);},
    compareAndSetLocalDocument(expectedVersion,value,{initialBackup}={}){
      value=cloneBoundedSyncJson(value,{maxBytes:limits.snapshotBytes});if(!plainData(value))fail('local-document-shape');
      if(initialBackup!==undefined){initialBackup=cloneBoundedSyncJson(initialBackup,{maxBytes:limits.snapshotBytes});if(!plainData(initialBackup))fail('local-document-backup');}
      return enqueue(async()=>{
        if(!receipt)fail('local-document-before-init');
        if(expectedVersion!==(localDocument?.version||null))return {ok:false};
        if(!localDocument&&initialBackup===undefined)fail('local-document-backup-required');
        if(localDocument&&initialBackup!==undefined)fail('local-document-backup-already-set');
        const hash=await blob(value,limits.snapshotBytes);if(hash===localDocument?.hash)return {ok:true,version:localDocument.version};
        const backup=localDocument?.backup||await blob(initialBackup,limits.snapshotBytes);
        await checkpoint('before-local-document');await append('local-document',{previous:expectedVersion,hash,backup});
        localDocument={version:head,hash,backup,data:value};localDocumentVersions.set(head,{hash,backup});await checkpoint('after-local-document');
        return {ok:true,version:head};
      });
    },
    acceptExternal({model=createModel,reserve}={}){requireSync();return enqueue(async()=>{
      if(!receipt)fail('receive-before-init');
      const held=reason=>({kind:'held',reason,state:state()});
      // A missing/unreadable shared directory is retryable on the next scan.
      // Private journal failures still fault the session in enqueue().
      const scanForReceive=()=>attemptHistory?scanShared():scanShared().catch(()=>({issue:'shared-scan-unavailable'}));
      if(pending)return held('local-action-pending');
      if(reserve&&localState?.layoutDraft)return held('local-layout-draft');
      if(reserve&&localState?.pendingSave)return held('local-action-pending');
      const epoch=getEpoch();if(!Number.isSafeInteger(epoch)||epoch<0)fail('epoch');
      const scan=await scanForReceive();if(scan.issue)return held(scan.issue);
      for(const [id,hash]of knownIntents)if(scan.canonicalFiles.has(id)){
        if(scan.canonicalFiles.get(id)!==hash)return held('local-intent-id-conflict');
        if(cancelled.has(id))return held('cancelled-record-visible-review');
      }
      for(const ref of receipt.data.operations){
        if(!scan.canonicalFiles.has(ref.id))return held('accepted-record-missing');
        if(scan.canonicalFiles.get(ref.id)!==ref.hash)return held('accepted-record-changed');
      }
      const plan=planSchema3Transactions(scan.records,{vault,baseline:empty(receipt.snapshot.revision),createModel:model});
      if(plan.status!=='candidate')return {...held('shared-candidate-blocked'),preview:copy(plan.proposal)};
      if(equalIds(plan.index.ready.map(op=>op.id),receipt.ids)&&same(plan.proposal,receipt.snapshot))return {kind:'noop',state:state()};
      const operations=[];for(const op of plan.index.ready)operations.push({id:op.id,hash:await blob(op,limits.recordBytes)});
      const data={snapshot:await blob(plan.proposal,limits.snapshotBytes),operations},next=await loadReceipt(data);validateExtension(next);
      await checkpoint('before-receive');const check=await scanForReceive();if(check.issue||check.fingerprint!==scan.fingerprint)return held(attemptHistory&&check.issue||'shared-scan-changed');
      if(getEpoch()!==epoch)return held('epoch-changed');
      // The host reserves its active layout store at the commit boundary.
      if(reserve&&!reserve())return held('layout-busy-or-stale');
      await append('receive',data);receipt=next;await checkpoint('after-receive');
      return {kind:getEpoch()===epoch?'accepted':'accepted-deferred',state:state()};
    });},
    previewSharedRecovery(){requireSync();return enqueue(async()=>{
      const scan=await repairedAttemptInput();if(scan.issue)return {kind:'held',reason:scan.issue};
      const token=Object.freeze({}),conflict=await syncContentHash(canonical(attemptConflict,META));
      recoveryReviews.set(token,{head,conflict,fingerprint:scan.fingerprint,epoch:getEpoch()});
      return {kind:'shared-recovery-review',token,ids:copy(attemptConflict.ids),evidence:copy(attemptConflict.evidence),inventory:copy(scan.inventory),proposal:copy(scan.proposal)};
    });},
    discardSharedRecovery:token=>recoveryReviews.delete(token),
    confirmSharedRecovery(token,{canContinue=()=>true}={}){requireSync();return enqueue(async()=>{
      const review=recoveryReviews.get(token);recoveryReviews.delete(token);
      if(!review||!attemptConflict||review.head!==head||review.epoch!==getEpoch()||!canContinue())return {kind:'held',reason:'shared-recovery-changed'};
      const scan=await repairedAttemptInput();if(scan.issue)return {kind:'held',reason:scan.issue};
      if(review.fingerprint!==scan.fingerprint||review.head!==head||review.epoch!==getEpoch()||!canContinue())return {kind:'held',reason:'shared-recovery-changed'};
      await append('attempt-recovery',{conflict:review.conflict,inventory:scan.fingerprint});attemptConflict=null;
      return {kind:'recovered',state:state()};
    });},
    reviewAbandonPublication(){return enqueue(unwrittenPublicationInput);},
    abandonPublication({backupHash,inventoryHash}={}){requireSync();return enqueue(async()=>{
      if(!HASH.test(backupHash)||!HASH.test(inventoryHash))return {kind:'held',reason:'backup-required'};
      const scan=await unwrittenPublicationInput();if(scan.issue||scan.fingerprint!==inventoryHash)return {kind:'held',reason:scan.issue??'shared-input-changed'};
      const id=pending.id;await append('publication-abandoned',{id,backup:backupHash,inventory:inventoryHash});cancelled.add(id);resolved.add(id);pending=null;return {kind:'abandoned',id};
    });},
    reviewRotationInput(){return enqueue(async()=>{
      if(!attemptHistory||!receipt||pending||attemptConflict)return {issue:'rotation-session-not-clean'};
      let scan;try{scan=await attemptHistory.scan();}catch{return {issue:'attempt-scan-unavailable'};}
      const issue=checkAttemptReceipt(scan);if(issue)return {issue};
      if(scan.blockers.length||scan.quarantined.length)return {issue:'shared-input-blocked'};
      for(const row of scan.observations){
        if(knownIntents.has(row.id)&&knownIntents.get(row.id)!==row.bodyHash)return {issue:'local-intent-id-conflict'};
        if(cancelled.has(row.id))return {issue:'cancelled-record-visible-review'};
      }
      return scan;
    });},
    reviewPublicationInput(){requireSync();return enqueue(async()=>{const scan=await scanAttempts(pending??undefined),issue=checkAttemptReceipt(scan);return {...scan,issue:issue??(reviewedPublicationValid(scan)?null:'shared-input-unresolved')};});},
    publish:({canContinue=()=>true,reviewedConflict=null}={})=>{requireSync();if(typeof canContinue!=='function')fail('publication-guard');const consent=reviewedConflict?copy(reviewedConflict):null;return enqueue(()=>publishPending(false,null,canContinue,consent));},
    finishPublished:({id,canContinue=()=>true}={})=>{requireSync();if(!ID.test(id||'')||typeof canContinue!=='function')fail('publication-guard');return enqueue(()=>pending?.id===id?publishPending(false,null,canContinue,null,true):{kind:'held',reason:'published-completion-changed',state:state()});},
    cancel(){requireSync();return enqueue(async()=>{
      if(!pending)fail('no-pending');
      if(pending.meta.version===2)fail('join-review-required');
      if(pending.attempted)fail('publication-may-have-started');
      if(attemptHistory){
        const scan=await scanAttempts(pending);
        if(scan.issue||scan.canonicalFiles.has(pending.id))fail('already-published-or-colliding');
      }else if(await sharedStore.read(namespace+pending.id+'.json',limits.recordBytes)!==null)fail('already-published-or-colliding');
      const id=pending.id;await append('cancel',{id});resolved.add(id);cancelled.add(id);pending=null;return state();
    });},
    state,settled:()=>tail.catch(()=>{}),
    async close(){await tail.catch(()=>{});closed=true;if(release){await release();release=null;}},
  };
}
