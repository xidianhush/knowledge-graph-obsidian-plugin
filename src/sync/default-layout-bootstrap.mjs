// SYNC-UX-A1: fixed default-layout namespace and immutable bootstrap records.
// Discovery only proves the default graph exists; it never proves acceptance,
// receipt by another device, or any applied layout fact. No layout operation,
// reset or fake edit is ever published as an initialization marker.
import {CAUSAL_PROTOTYPE_LIMITS as limits,cloneBoundedSyncJson} from './causal-prototype.mjs';
import {randomSyncOperationId} from './author-prototype.mjs';
import {syncContentHash} from './persistence-prototype.mjs';
const ID=/^[a-f0-9]{32}$/,NAME=/^([a-f0-9]{64})\.([a-f0-9]{32})\.json$/;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
export const DEFAULT_LAYOUT_SEED='KM-SYNC-DEFAULT-LAYOUT-1';
export const DEFAULT_LAYOUT_VAULT_ID='71e90242bea19488f2a16c60f78fcabc';
export const DEFAULT_LAYOUT_BODY=Object.freeze({version:1,kind:'default-layout',transport:'attempts-v1',vault:DEFAULT_LAYOUT_VAULT_ID});
const canonical=value=>JSON.stringify(cloneBoundedSyncJson(value,{maxBytes:limits.recordBytes}));
export const defaultLayoutBodyText=()=>canonical(DEFAULT_LAYOUT_BODY);
export const defaultLayoutBootstrapDirectory=()=>'Knowledge Map Sync/bootstrap-v1/'+DEFAULT_LAYOUT_VAULT_ID;
export async function deriveDefaultLayoutVaultId(){return (await syncContentHash(DEFAULT_LAYOUT_SEED)).slice(0,32);}
const isPrefix=(prefix,full)=>prefix.length<=full.length&&prefix.every((byte,i)=>byte===full[i]);
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');

export function createDefaultLayoutBootstrap(adapter,{nextId=randomSyncOperationId}={}){
 if(!adapter||['stat','list','readBinary'].some(k=>typeof adapter[k]!=='function'))throw Error('bootstrap-adapter');
 const directory=defaultLayoutBootstrapDirectory(),prefix=directory+'/';
 const basename=name=>typeof name==='string'&&name.startsWith(prefix)&&name.slice(prefix.length);
 const scoped=name=>/^[^./\\:\u0000-\u001f\u007f][^/\\:\u0000-\u001f\u007f]{0,239}$/.test(basename(name)||'');
 async function scan({attempts=[]}={}){
  const stat=await adapter.stat(directory);
  if(stat&&stat.type!=='folder')throw Error('bootstrap-directory');
  if(!stat)return {present:false,facts:0,blockers:[],inventory:[],count:0,total:0};
  const {files,folders}=await adapter.list(directory);
  if(files.length+folders.length>limits.operations)throw Error('bootstrap-file-budget');
  if(folders.length||new Set(files).size!==files.length||files.some(name=>!scoped(name)))throw Error('bootstrap-file-scope');
  const blockers=[],inventory=[],complete=new Map(),partial=[];let total=0;
  const intended=encoder.encode(defaultLayoutBodyText()),ownPaths=new Set(attempts);
  for(const name of [...files].sort()){
   const stat=await adapter.stat(name);
   const remaining=Math.min(limits.recordBytes,limits.totalBytes-total);
   if(!stat||stat.type!=='file'||!Number.isSafeInteger(stat.size)||stat.size<0)throw Error('bootstrap-file-changed');
   if(stat.size>remaining)throw Error('bootstrap-file-budget');
   const bytes=new Uint8Array(await adapter.readBinary(name));
   if(bytes.length!==stat.size||bytes.length>remaining)throw Error('bootstrap-file-changed');
   total+=bytes.length;
   const hash=await digest(bytes),match=NAME.exec(basename(name));
   inventory.push({name,hash,size:bytes.length});
   if(!match){blockers.push({name,hash,reason:'unknown-file-name'});continue;}
   const [,expected]=match;
   if(hash!==expected){partial.push({name,bytes,key:expected});continue;}
   let body;try{body=JSON.parse(decoder.decode(bytes));}catch{blockers.push({name,hash,reason:'invalid-complete-body'});continue;}
   // Unknown versions, extra fields and noncanonical encodings pause the flow;
   // they are never treated as "no graph" and never trigger re-initialization.
   if(canonical(body)!==decoder.decode(bytes)||canonical(body)!==defaultLayoutBodyText()){blockers.push({name,hash,reason:'invalid-complete-body'});continue;}
   if(!complete.has(expected))complete.set(expected,{name,hash,bytes});
  }
  for(const {name,bytes,key} of partial){
   const full=complete.get(key);
   if(full&&isPrefix(bytes,full.bytes))continue;
   const ownPrefix=ownPaths.has(name)&&isPrefix(bytes,intended);
   blockers.push({name,reason:ownPrefix?'own-truncated-attempt':'unverified-bytes'});
  }
  // Legitimate same-body records from any device are one initialization fact.
  return {present:true,facts:complete.size?1:0,blockers,inventory,count:files.length,total};
 }
 async function ensure({canContinue=()=>true,attempts=[]}={}){
  const observed=await scan({attempts});
  if(observed.blockers.some(row=>row.reason!=='own-truncated-attempt'))return {kind:'held',reason:'bootstrap-unresolved-input'};
  if(observed.facts)return {kind:'present'};
  if(['stat','mkdir','writeBinary'].some(k=>typeof adapter[k]!=='function'))throw Error('bootstrap-adapter');
  const text=defaultLayoutBodyText(),bytes=encoder.encode(text),hash=await syncContentHash(text);
  let name=null;
  for(let i=0;i<8;i++){
   const nonce=nextId();
   if(typeof nonce!=='string'||!ID.test(nonce))throw Error('bootstrap-nonce');
   const candidate=prefix+hash+'.'+nonce+'.json';
   if(!attempts.includes(candidate)&&!await adapter.stat(candidate)){name=candidate;break;}
  }
  if(!name)return {kind:'held',reason:'bootstrap-id-collision'};
  let folder='';
  for(const part of directory.split('/')){
   if(!canContinue())return {kind:'held',reason:'bootstrap-cancelled'};
   folder=folder?folder+'/'+part:part;
   if(!await adapter.stat(folder)){
    try{await adapter.mkdir(folder);}catch(error){if((await adapter.stat(folder))?.type!=='folder')throw error;}
   }
  }
  if(await adapter.stat(name)){
   const again=await scan({attempts:[...attempts,name]});
   return again.facts&&!again.blockers.some(row=>row.reason!=='own-truncated-attempt')?{kind:'present'}:{kind:'held',reason:'bootstrap-path-occupied'};
  }
  if(!canContinue())return {kind:'held',reason:'bootstrap-cancelled'};
  // Independent attempt path; known collisions are avoided, external writers
  // may still race the check. Readback verifies the complete canonical body.
  await adapter.writeBinary(name,bytes.buffer);
  const stat=await adapter.stat(name);
  const read=stat?.type==='file'?new Uint8Array(await adapter.readBinary(name)):null;
  if(!read||read.length!==bytes.length||!isPrefix(bytes,read)||await digest(read)!==hash)throw Error('bootstrap-readback');
  return {kind:'written',name};
 }
 return {directory,scan,ensure};
}