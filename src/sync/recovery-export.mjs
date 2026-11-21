import {syncContentHash} from './persistence-prototype.mjs';
import {cloneBoundedSyncJson} from './causal-prototype.mjs';
const ID=/^[a-f0-9]{32}$/,HASH=/^[a-f0-9]{64}$/;
const fixed=['accepted.json','drafts.json','pending.json','pending-operation.json','pending-backup.json','pending-proposal.json','configuration.json','configuration-reference.json','initial-config.json','join-backup.json'];
const bytes=s=>new TextEncoder().encode(s).length;
const fail=reason=>{throw Error('recovery-export-'+reason);};
export async function verifyRecoveryExport({source,id}={}){
 if(!ID.test(id)||typeof source?.read!=='function')fail('options');
 const raw=await source.read(id+'/manifest.json',262144);if(raw===null)fail('incomplete');
 let m;try{m=JSON.parse(raw);}catch{fail('manifest');}
 if(m?.version!==1||m.id!==id||!ID.test(m.vault)||!ID.test(m.installation)||m.scope!=='review-only-not-acceptance-ledger'||!Array.isArray(m.files)||m.files.length<10||m.files.length>1100)fail('manifest');
 const contents=new Map();let total=0;
 for(const r of m.files){
  if(!r||!(fixed.includes(r.name)||/^operations\/[a-f0-9]{32}\.json$/.test(r.name))||contents.has(r.name)||!HASH.test(r.hash)||!Number.isSafeInteger(r.bytes)||r.bytes<1||r.bytes>8388608||(total+=r.bytes)>128*1048576)fail('manifest-file');
  const body=await source.read(id+'/'+r.name,r.bytes);if(body===null)fail('content-missing');if(bytes(body)!==r.bytes||await syncContentHash(body)!==r.hash)fail('content');
  let value;try{value=cloneBoundedSyncJson(JSON.parse(body),{maxBytes:8388608});}catch{fail('json');}contents.set(r.name,value);
 }
 if(fixed.some(n=>!contents.has(n)))fail('missing-part');
 if(await source.read(id+'/manifest.json',262144)!==raw)fail('changed');
 return {manifest:m,hash:await syncContentHash(raw),contents,bytes:total};
}

// Explicit ordinary-vault destination, never the shared transport/config roots.
// Obsidian create + exact readback is the existing conditional file contract;
// it does not establish arbitrary external-writer atomicity.
export function createRecoveryDestination({vault,folder}={}){
 const config=vault?.configDir??'.obsidian';
 if(typeof folder!=='string'||folder.length>240||/[\\:\x00-\x1f]/.test(folder)||folder.split('/').some(p=>!p||p==='.'||p==='..'||p!==p.trim()||p.endsWith('.'))||[config,'Knowledge Map Sync'].some(p=>folder.toLowerCase()===p.toLowerCase()||folder.toLowerCase().startsWith(p.toLowerCase()+'/'))||['create','read','getAbstractFileByPath','createFolder'].some(k=>typeof vault?.[k]!=='function'))fail('destination');
 function path(name){if(!/^[a-f0-9]{32}\/(?:[a-z-]+\.json|operations\/[a-f0-9]{32}\.json)$/.test(name))fail('path');return folder+'/'+name;}
 return {location:folder,
  async read(name,max){const file=vault.getAbstractFileByPath(path(name));if(!file)return null;const text=await vault.read(file);if(bytes(text)>max)fail('read-budget');return text;},
  async create(name,text){const p=path(name);let parent='';for(const part of p.split('/').slice(0,-1)){parent=parent?parent+'/'+part:part;if(!vault.getAbstractFileByPath(parent))try{await vault.createFolder(parent);}catch(e){if(!vault.getAbstractFileByPath(parent))throw e;}}
   const file=vault.getAbstractFileByPath(p);if(file){if(await vault.read(file)!==text)fail('destination-conflict');return 'exists';}
   await vault.create(p,text);return 'created';},
 };
}
