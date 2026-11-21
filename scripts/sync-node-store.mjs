// Test adapter only: real Node file I/O. Not an Obsidian/mobile adapter.
// Full temporary files are fsynced and installed with no-replace hard links.
// Directory fsync is attempted where supported; power-loss durability is NOT
// established by the process-crash tests, especially on Windows.
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
export function createNodeSyncStore(root,{onStep=async()=>{}}={}) {
  root=path.resolve(root);let directoryFsync=null;
  const nonce=()=>randomBytes(16).toString('hex');
  function target(name){
    if(typeof name!=='string'||!name||name.includes('\\')||name.includes(':')||name.split('/').some(s=>!s||s==='.'||s==='..'))throw Error('store-path');
    const value=path.resolve(root,...name.split('/')),relative=path.relative(root,value);
    if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('store-path');return value;
  }
  async function rootReady(){await fs.mkdir(root,{recursive:true});const info=await fs.lstat(root);if(info.isSymbolicLink()||!info.isDirectory())throw Error('store-root');}
  async function parents(name){
    await rootReady();const bits=name.split('/').slice(0,-1);let here=root;
    for(const bit of bits){here=path.join(here,bit);try{await fs.mkdir(here);}catch(e){if(e.code!=='EEXIST')throw e;}
      const stat=await fs.lstat(here);if(stat.isSymbolicLink()||!stat.isDirectory())throw Error('store-symlink');}
  }
  async function checked(name){
    const value=target(name);let here=root;
    for(const bit of name.split('/')){here=path.join(here,bit);let stat;try{stat=await fs.lstat(here);}catch(e){if(e.code==='ENOENT')return value;throw e;}
      if(stat.isSymbolicLink())throw Error('store-symlink');}
    return value;
  }
  async function syncDirectory(folder){
    let h;try{h=await fs.open(folder,'r');await h.sync();directoryFsync=true;}
    catch(e){if(!['EPERM','EINVAL','EISDIR','ENOTSUP','EBADF'].includes(e.code))throw e;directoryFsync=false;}
    finally{await h?.close();}
  }
  async function read(name,maxBytes){
    if(!Number.isSafeInteger(maxBytes)||maxBytes<0)throw Error('store-read-budget');
    const value=await checked(name);let h;
    try{h=await fs.open(value,'r');const stat=await h.stat();if(!stat.isFile()||stat.size>maxBytes)throw Error('store-file-budget');
      // Bounded read, including a byte to detect growth after stat.
      const buffer=Buffer.alloc(Math.min(maxBytes+1,stat.size+1));let used=0;
      while(used<buffer.length){const {bytesRead}=await h.read(buffer,used,buffer.length-used,used);if(!bytesRead)break;used+=bytesRead;}
      if(used>maxBytes||used>stat.size)throw Error('store-file-grew');if(used<stat.size)throw Error('store-file-shrank');
      const text=buffer.subarray(0,used).toString('utf8');
      if(!Buffer.from(text,'utf8').equals(buffer.subarray(0,used)))throw Error('store-invalid-utf8');return text;
    }catch(e){if(e.code==='ENOENT')return null;throw e;}finally{await h?.close();}
  }
  async function create(name,text){
    const final=target(name);if(typeof text!=='string')throw Error('store-text');await parents(name);await checked(name);
    const tempName='.tmp/'+nonce()+'.part';await parents(tempName);const temp=target(tempName);let h;
    try{
      h=await fs.open(temp,'wx',0o600);await onStep('temp-open',name);
      const bytes=Buffer.from(text,'utf8'),split=Math.ceil(bytes.length/2);
      await h.writeFile(bytes.subarray(0,split));await onStep('temp-partial',name);await h.writeFile(bytes.subarray(split));
      await h.sync();await onStep('temp-synced',name);await h.close();h=null;
      try{await fs.link(temp,final);}catch(e){if(e.code!=='EEXIST')throw e;await fs.unlink(temp);return 'exists';}
      await onStep('installed',name);await syncDirectory(path.dirname(final));await fs.unlink(temp);
      await onStep('complete',name);return 'created';
    }finally{await h?.close();} // Interrupted temporaries stay available for diagnosis.
  }
  async function list(prefix){
    target(prefix);await rootReady();const value=await checked(prefix);let entries;
    try{entries=await fs.readdir(value,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return [];throw e;}
    if(entries.length>4096)throw Error('store-list-budget');
    if(entries.some(e=>!e.isFile()||e.isSymbolicLink()))throw Error('store-list-entry');
    return entries.map(e=>prefix+'/'+e.name).sort();
  }
  async function acquire(installation){
    if(!/^[a-f0-9]{32}$/.test(installation))throw Error('store-installation');
    const token=nonce(),name=`.leases/${process.pid}-${token}.json`,body=JSON.stringify({installation,pid:process.pid,token});
    if(await create(name,body)!=='created')throw Error('store-lease-collision');
    const release=async()=>{const raw=await read(name,1024);if(raw!==body)throw Error('store-lease-changed');await fs.unlink(target(name));await syncDirectory(path.dirname(target(name)));};
    try{
      // Publish our unique claim BEFORE enumeration. Simultaneous claimants
      // either see the holder or both decline; neither deletes another claim.
      // Proven-dead claims are ignored but retained. PID reuse fails closed.
      for(const other of await list('.leases')){
        if(other===name)continue;const raw=await read(other,1024);if(raw===null)continue;
        let prior;try{prior=JSON.parse(raw);}catch{throw Error('store-unreadable-lease');}
        if(!Number.isSafeInteger(prior.pid)||prior.pid<1||!/^[a-f0-9]{32}$/.test(prior.token)||other!==`.leases/${prior.pid}-${prior.token}.json`)throw Error('store-unreadable-lease');
        let alive=true;try{process.kill(prior.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}
        if(alive)throw Error('store-busy');
      }
      return release;
    }catch(error){await release();throw error;}
  }
  async function inventory({maxFiles=8193,maxBytes=151000000}={}){
    if(!Number.isSafeInteger(maxFiles)||maxFiles<1||!Number.isSafeInteger(maxBytes)||maxBytes<1)throw Error('store-inventory-budget');
    await rootReady();const files=[];let bytes=0,complete=true;
    async function scan(relative,depth){if(depth>16)throw Error('store-inventory-depth');
      const directory=relative?await checked(relative):root,entries=await fs.readdir(directory,{withFileTypes:true});
      for(const entry of entries){const name=relative?relative+'/'+entry.name:entry.name;if(name==='.leases')continue;
        if(entry.isSymbolicLink())throw Error('store-symlink');
        if(entry.isDirectory()){if(!await scan(name,depth+1))return false;}
        else if(entry.isFile()){const stat=await fs.lstat(await checked(name));if(!stat.isFile()||stat.isSymbolicLink())throw Error('store-inventory-entry');files.push({name,bytes:stat.size});bytes+=stat.size;if(files.length>=maxFiles||bytes>=maxBytes){complete=false;return false;}}
        else throw Error('store-inventory-entry');
      }return true;
    }
    await scan('',0);files.sort((a,b)=>a.name.localeCompare(b.name));return {files,bytes,complete};
  }
  return {read,create,list,acquire,inventory,stableInventoryUnderLease:true,immutableBlobsUnderLease:true,capabilities:()=>({adapter:'Node test-only',atomicInstall:'fs.link/no-replace',fileFsync:true,directoryFsync,processCrashTestOnly:true})};
}
