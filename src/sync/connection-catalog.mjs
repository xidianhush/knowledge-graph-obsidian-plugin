import {createAttemptHistory} from './attempt-history-prototype.mjs';
import {createDefaultLayoutBootstrap,DEFAULT_LAYOUT_VAULT_ID} from './default-layout-bootstrap.mjs';
import {inspectSchema3History} from './layout-prototype.mjs';
import {cloneBoundedSyncJson,CAUSAL_PROTOTYPE_LIMITS as limits} from './causal-prototype.mjs';
import {syncContentHash} from './persistence-prototype.mjs';
export const SYNC_CONNECTION_LIMIT=32;
const ID=/^[a-f0-9]{32}$/,decoder=new TextDecoder('utf-8',{fatal:true});
const canonical=v=>JSON.stringify(cloneBoundedSyncJson(v));
const fail=reason=>{throw Error('catalog-'+reason);};

// Observation of two known transport roots, not an atomic filesystem snapshot.
// Discovery does not write, choose a library or establish any applied facts.
export function createSyncConnectionCatalog({adapter}={}){
 if(!adapter||['stat','list','readBinary'].some(k=>typeof adapter[k]!=='function'))fail('adapter');
 return {async scan({target}={}){
  try{
   if(target&&(!ID.test(target.vault)||!['attempts-v1','v2'].includes(target.transport)))fail('target');
   const topology=[],inventory=[],namespaces=[],candidates=[];let files=0,total=0;
   async function listing(directory){
    const stat=await adapter.stat(directory);if(!stat)return null;if(stat.type!=='folder')fail('directory');
    const row=await adapter.list(directory);
    if(!row||!Array.isArray(row.files)||!Array.isArray(row.folders))fail('listing');
    const all=[...row.files,...row.folders],prefix=directory+'/';
    if(new Set(all).size!==all.length||all.some(name=>typeof name!=='string'||!name.startsWith(prefix)||!name.slice(prefix.length)||/[\/\\:\u0000-\u001f\u007f]/.test(name.slice(prefix.length))||['.','..'].includes(name.slice(prefix.length))))fail('scope');
    return {files:[...row.files].sort(),folders:[...row.folders].sort()};
   }
   async function remember(directory){const row=await listing(directory);topology.push({directory,row});return row;}
   async function read(name){
    const stat=await adapter.stat(name),remaining=Math.min(limits.recordBytes,limits.totalBytes-total);
    if(stat?.type!=='file'||!Number.isSafeInteger(stat.size)||stat.size<0||stat.size>remaining)fail('byte-budget');
    const bytes=new Uint8Array(await adapter.readBinary(name));
    if(bytes.length!==stat.size||bytes.length>remaining)fail('file-changed');total+=bytes.length;return bytes;
   }
   for(const transport of ['attempts-v1','v2']){
    const base='Knowledge Map Sync/'+transport,root=await remember(base);if(!root)continue;
    if(root.files.length)fail('root-file');if(namespaces.length+root.folders.length>SYNC_CONNECTION_LIMIT)fail('namespace-budget');
    for(const directory of root.folders){
     const vault=directory.slice(base.length+1);if(!ID.test(vault))fail('namespace');
     namespaces.push({vault,transport});
     if(target&&(target.vault!==vault||target.transport!==transport))continue;
     const namespace=await remember(directory);if(!namespace||namespace.files.length||namespace.folders.some(p=>p!==directory+'/ops'))fail('namespace-scope');
     const ops=directory+'/ops',row=await remember(ops);if(!row)continue;
     files+=row.files.length+row.folders.length;if(files>limits.operations)fail('file-budget');if(row.folders.length)fail('ops-scope');
     let records;
     if(transport==='attempts-v1'){
      const scan=await createAttemptHistory({stat:p=>adapter.stat(p),list:async p=>{if(p!==ops)fail('scope');return row;},readBinary:async p=>(await read(p)).buffer},vault).scan();
      if(scan.blockers.length||scan.quarantined.length)fail('unresolved-input');records=scan.records;inventory.push(...scan.inventory);
     }else{
      records=[];
      for(const name of row.files){
       const filename=name.slice(ops.length+1);if(!/^[a-f0-9]{32}\.json$/.test(filename))fail('legacy-name');
       const bytes=await read(name);let op;try{op=JSON.parse(decoder.decode(bytes));}catch{fail('legacy-body');}
       if(op?.protocol!==2||op.layoutSchema!==3||op.vault!==vault||op.id!==filename.slice(0,-5))fail('legacy-envelope');
       records.push(op);inventory.push({name,hash:await syncContentHash(decoder.decode(bytes)),size:bytes.length});
      }
     }
     const {index}=inspectSchema3History(records,{vault});
     if(index.issues.length||index.quarantined.length||index.pending.length)fail('unresolved-input');
     if(records.length)candidates.push({vault,transport,access:transport==='v2'?'read-only':'read-write',operations:new Set(records.map(op=>op.id)).size,bootstrapOnly:false});
    }
   }
   // SYNC-UX-A1: the fixed default namespace may be discoverable through an
   // immutable bootstrap record before any layout operation exists. Discovery
   // still never chooses, joins or accepts anything.
   const bootstrapBase='Knowledge Map Sync/bootstrap-v1',bootstrapRoot=await remember(bootstrapBase),bootstrapFacts=new Set();
   if(bootstrapRoot){
    if(bootstrapRoot.files.length)fail('root-file');
    const known=new Set(namespaces.map(row=>row.vault+'|'+row.transport));
    const additions=bootstrapRoot.folders.filter(directory=>!known.has(directory.slice(bootstrapBase.length+1)+'|attempts-v1'));
    if(namespaces.length+additions.length>SYNC_CONNECTION_LIMIT)fail('namespace-budget');
    for(const directory of bootstrapRoot.folders){
     const vault=directory.slice(bootstrapBase.length+1);
     if(vault!==DEFAULT_LAYOUT_VAULT_ID)fail('bootstrap-namespace');
     if(!known.has(vault+'|attempts-v1')){namespaces.push({vault,transport:'attempts-v1'});known.add(vault+'|attempts-v1');}
     if(target&&(target.vault!==vault||target.transport!=='attempts-v1'))continue;
     const namespace=await remember(directory);if(!namespace)continue;
     if(namespace.folders.length)fail('bootstrap-scope');
     files+=namespace.files.length;if(files>limits.operations)fail('file-budget');
     const scan=await createDefaultLayoutBootstrap({stat:p=>adapter.stat(p),list:async p=>{if(p!==directory)fail('scope');return namespace;},readBinary:async p=>(await read(p)).buffer}).scan();
     if(scan.blockers.length)fail('unresolved-input');
     inventory.push(...scan.inventory);
     if(scan.facts)bootstrapFacts.add(vault);
    }
   }
   for(const vault of bootstrapFacts)if(!candidates.some(row=>row.vault===vault&&row.transport==='attempts-v1'))
    candidates.push({vault,transport:'attempts-v1',access:'read-write',operations:0,bootstrapOnly:true});
   // A root or namespace added while its children were inspected expires this
   // observation. Content races still require the join/publish scan gate later.
   for(const {directory,row}of topology)if(canonical(await listing(directory))!==canonical(row))fail('scan-changed');
   return {kind:'catalog',namespaces,candidates,fingerprint:await syncContentHash(canonical({topology,inventory})),files,bytes:total,...(target?{scope:'target',target:{vault:target.vault,transport:target.transport}}:{})};
  }catch(error){const message=typeof error?.message==='string'?error.message:'';return {kind:'held',reason:message.startsWith('catalog-')?message:'catalog-scan-unavailable'};}
 }};
}
