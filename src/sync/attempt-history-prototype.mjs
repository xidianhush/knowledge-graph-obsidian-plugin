import {CAUSAL_PROTOTYPE_LIMITS as limits,cloneBoundedSyncJson} from './causal-prototype.mjs';
import {inspectSchema3History} from './layout-prototype.mjs';
import {randomSyncOperationId} from './author-prototype.mjs';

const ID=/^[a-f0-9]{32}$/;
const NAME=/^([a-f0-9]{32})\.([a-f0-9]{64})\.([a-f0-9]{32})\.json$/;
const encoder=new TextEncoder();
const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
const canonical=value=>JSON.stringify(cloneBoundedSyncJson(value,{maxBytes:limits.recordBytes}));
const isPrefix=(prefix,full)=>prefix.length<=full.length&&prefix.every((byte,i)=>byte===full[i]);
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),
  byte=>byte.toString(16).padStart(2,'0')).join('');

export function attemptHistoryDirectory(vault){
  if(typeof vault!=='string'||!ID.test(vault))throw Error('attempt-vault');
  return 'Knowledge Map Sync/attempts-v1/'+vault+'/ops';
}

export function createAttemptHistory(adapter,vault,{nextId=randomSyncOperationId}={}){
  const directory=attemptHistoryDirectory(vault),prefix=directory+'/';
  const basename=name=>typeof name==='string'&&name.startsWith(prefix)&&name.slice(prefix.length);
  const scoped=name=>/^[^./\\:\u0000-\u001f\u007f][^/\\:\u0000-\u001f\u007f]{0,239}$/.test(basename(name)||'');
  function pathFor(id,hash,nonce){return prefix+id+'.'+hash+'.'+nonce+'.json';}
  function parse(bytes){
    try{
      const operation=JSON.parse(decoder.decode(bytes));
      if(operation?.protocol!==2||operation.layoutSchema!==3||operation.vault!==vault||
        typeof operation.id!=='string'||!ID.test(operation.id))return null;
      return {operation,text:canonical(operation)};
    }catch{return null;}
  }
  async function scan({intent,attempts=[]}={}){
    const stat=await adapter.stat(directory);
    if(stat&&stat.type!=='folder')throw Error('attempt-directory');
    const {files,folders}=stat?await adapter.list(directory):{files:[],folders:[]};
    if(files.length+folders.length>limits.operations)throw Error('attempt-file-budget');
    if(folders.length||new Set(files).size!==files.length||files.some(name=>!scoped(name)))throw Error('attempt-file-scope');
    const blockers=[],inventory=[],complete=new Map(),unknown=[],partial=[];
    let total=0;
    const intended=intent&&encoder.encode(canonical(intent));
    const ownPaths=new Set(attempts);
    for(const name of [...files].sort()){
      const stat=await adapter.stat(name);
      const remaining=Math.min(limits.recordBytes,limits.totalBytes-total);
      if(!stat||stat.type!=='file'||!Number.isSafeInteger(stat.size)||stat.size<0)throw Error('attempt-file-changed');
      if(stat.size>remaining)throw Error('attempt-file-budget');
      const bytes=new Uint8Array(await adapter.readBinary(name));
      if(bytes.length!==stat.size||bytes.length>remaining)throw Error('attempt-file-changed');
      total+=bytes.length;
      const hash=await digest(bytes),match=NAME.exec(basename(name));
      inventory.push({name,hash,size:bytes.length});
      if(!match){
        blockers.push({name,hash,reason:'unknown-file-name'});
        const parsed=parse(bytes);
        if(parsed&&!inspectSchema3History([parsed.operation],{vault}).index.issues.length){
          unknown.push({name,hash,bodyHash:await digest(encoder.encode(parsed.text)),operation:parsed.operation});
        }
        continue;
      }
      const [,id,expected]=match,key=id+'.'+expected;
      if(hash!==expected){
        partial.push({name,bytes,key});
        continue;
      }
      const parsed=parse(bytes);
      if(!parsed||parsed.operation.id!==id||parsed.text!==decoder.decode(bytes)){
        blockers.push({name,hash,reason:'invalid-complete-body'});
        continue;
      }
      if(!complete.has(key))complete.set(key,{name,hash,bytes,operation:parsed.operation});
    }
    for(const {name,bytes,key} of partial){
      const full=complete.get(key);
      if(full&&isPrefix(bytes,full.bytes))continue;
      const ownPrefix=ownPaths.has(name)&&intended&&isPrefix(bytes,intended);
      blockers.push({name,reason:ownPrefix?'own-truncated-attempt':'unverified-bytes'});
    }
    const full=[...complete.values()],records=full.map(row=>row.operation);
    const index=inspectSchema3History([...records,...unknown.map(row=>row.operation)],{vault}).index;
    const quarantined=new Set(index.quarantined);
    const canonicalFiles=new Map(full.filter(row=>!quarantined.has(row.operation.id)).map(row=>[row.operation.id,row.hash]));
    const observations=[...full,...unknown].map(({name,hash,bodyHash=hash,operation})=>({name,hash,bodyHash,id:operation.id}));
    return {records,canonicalFiles,observations,quarantined:index.quarantined,blockers,inventory,count:files.length,total,
      fingerprint:await digest(encoder.encode(JSON.stringify(inventory)))};
  }
  async function allocate(id,hash,attempts){
    for(let i=0;i<8;i++){
      const nonce=nextId();
      if(!ID.test(nonce))throw Error('attempt-nonce');
      const name=pathFor(id,hash,nonce);
      if(!attempts.includes(name)&&!await adapter.stat(name))return name;
    }
    return null;
  }
  async function write(name,text,{canContinue=()=>true}={}){
    if(!NAME.test(basename(name)||''))throw Error('attempt-write-scope');
    let folder='';
    for(const part of directory.split('/')){
      if(!canContinue())return false;
      folder=folder?folder+'/'+part:part;
      if(!await adapter.stat(folder)){
        try{await adapter.mkdir(folder);}catch(error){if((await adapter.stat(folder))?.type!=='folder')throw error;}
      }
    }
    if(await adapter.stat(name))return false;
    if(!canContinue())return false;
    // The check avoids known collisions. External writers may still race it.
    await adapter.writeBinary(name,encoder.encode(text).buffer);
    return true;
  }
  const validPath=(name,id,hash)=>{const match=NAME.exec(basename(name)||'');return match?.[1]===id&&match[2]===hash;};
  return {directory,scan,allocate,write,validPath};
}
