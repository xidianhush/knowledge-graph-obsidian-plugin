// Test-only document CAS via immutable versions. NOT Obsidian data.json CAS.
// Competing cooperative writers install the same next sequence exclusively.
import {cloneBoundedSyncJson} from '../src/sync/causal-prototype.mjs';
import {syncContentHash} from '../src/sync/persistence-prototype.mjs';
const canonical=value=>JSON.stringify(cloneBoundedSyncJson(value));
export function createVersionedDocumentStore(store,{checkpoint=async()=>{}}={}){
  const name=n=>`document/${String(n).padStart(12,'0')}.json`;
  async function read(){
    const files=(await store.list('document')).sort();if(files.length>4096)throw Error('document-budget');
    let version=null,sequence=0,data={};
    for(const file of files){
      if(file!==name(sequence+1))throw Error('document-gap');
      const raw=await store.read(file,8388608);if(raw===null)throw Error('document-missing');
      const event=JSON.parse(raw);
      if(canonical(event)!==raw||Object.keys(event).sort().join(',')!=='data,previous,sequence,version'||event.version!==1||event.previous!==version||event.sequence!==sequence+1)throw Error('document-chain');
      data=event.data;version=await syncContentHash(raw);sequence++;
    }
    return {data,version,sequence};
  }
  return {read,async compareAndSet(version,data){
    data=cloneBoundedSyncJson(data);const before=await read();if(before.version!==version)return {ok:false};
    const event={version:1,previous:version,sequence:before.sequence+1,data},text=canonical(event);
    await checkpoint('before-cas');if(await store.create(name(event.sequence),text)!=='created')return {ok:false};
    if(await store.read(name(event.sequence),8388608)!==text)throw Error('document-write-conflict');
    await checkpoint('after-cas');return {ok:true,version:await syncContentHash(text)};
  }};
}
