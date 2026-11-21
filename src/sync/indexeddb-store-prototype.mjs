// Device-private A3 storage through standard browser transactions. No Vault/Node
// files, network, automatic GC or power-loss guarantee. Use with device binding.
const LIMIT=8388608+1024,DB='knowledge-map-sync-v2-private',TABLE='files';
const fail=reason=>{throw Error('sync-idb-'+reason);},size=text=>new TextEncoder().encode(text).length;
function name(value){if(typeof value!=='string'||!value||size(value)>512||/[\\:\u0000-\u001f\u007f]/.test(value)||value.split('/').some(v=>!v||v==='.'||v==='..'))fail('path');return value;}
async function lease(locks,key){
  let ready,reject,done;const got=new Promise((a,b)=>{ready=a;reject=b;}),held=new Promise(a=>done=a);
  const work=locks.request(key,{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock){reject(Error('sync-idb-busy'));return;}let released=false;ready(async()=>{if(!released){released=true;done();}await work;});await held;});
  work.catch(reject);return got;
}
export async function openIndexedDbSyncStore({installation,vault,indexedDB=globalThis.indexedDB,keyRange=globalThis.IDBKeyRange,locks=globalThis.navigator?.locks,beforeCreateCommit=()=>{}}={}){
  if(!/^[a-f0-9]{32}$/.test(installation)||!/^[a-f0-9]{32}$/.test(vault))fail('scope');
  if(typeof indexedDB?.open!=='function'||typeof keyRange?.bound!=='function'||typeof locks?.request!=='function'||typeof beforeCreateCommit!=='function')fail('capability-unavailable');
  const prefix=installation+'/'+vault+'/',database=await new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB,1);let abandoned=false;
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(TABLE))request.result.createObjectStore(TABLE,{keyPath:'key'});};
    request.onerror=()=>reject(Error('sync-idb-open-failed'));
    request.onblocked=()=>{abandoned=true;reject(Error('sync-idb-upgrade-blocked'));};
    request.onsuccess=()=>{if(abandoned)request.result.close();else resolve(request.result);};
  });
  let closed=false,held=false,strict=null;
  database.onversionchange=()=>{closed=true;database.close();};
  function live(){if(closed)fail('closed');}
  function transaction(mode){live();
    if(mode==='readwrite'&&strict!==false){try{const tx=database.transaction(TABLE,mode,{durability:'strict'});strict=tx.durability==='strict';return tx;}catch(error){if(error?.name!=='TypeError')throw error;strict=false;}}
    return database.transaction(TABLE,mode);
  }
  function run(mode,action){return new Promise((resolve,reject)=>{
    let value,failure;const tx=transaction(mode),store=tx.objectStore(TABLE);
    tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(failure||Error('sync-idb-transaction-aborted'));tx.onerror=()=>{};
    try{action(store,v=>value=v,error=>{failure=error;try{tx.abort();}catch{}},tx);}catch(error){failure=error;try{tx.abort();}catch{}reject(error);}
  });}
  return {
    stableInventoryUnderLease:true,
    immutableBlobsUnderLease:true,
    capabilities:()=>({backend:'indexeddb',completeCreate:'transaction-add',durability:strict===true?'strict-requested':strict===false?'default':'not-yet-written',powerLossVerified:false}),
    async acquire(owner){live();if(owner!==installation||held)fail('owner');const release=await lease(locks,DB+':'+prefix);if(closed){await release();fail('closed');}held=true;let released=false;return async()=>{if(released)return;released=true;held=false;await release();};},
    read(relative,maxBytes){name(relative);if(!Number.isSafeInteger(maxBytes)||maxBytes<0||maxBytes>LIMIT)fail('budget');return run('readonly',(store,result,abort)=>{
      const request=store.get(prefix+relative);request.onsuccess=()=>{const row=request.result;if(row===undefined){result(null);return;}
        if(typeof row.text!=='string'||!Number.isSafeInteger(row.size)||row.size!==size(row.text)||row.size>maxBytes){abort(Error('sync-idb-read-budget'));return;}result(row.text);
      };
    });},
    async create(relative,text){name(relative);if(typeof text!=='string'||size(text)>LIMIT)fail('budget');
      // ConstraintError aborts this transaction; no replacement or partial value
      // can be committed. Resolve only on complete/abort, not request success.
      return new Promise((resolve,reject)=>{
        let duplicate=false;const tx=transaction('readwrite'),request=tx.objectStore(TABLE).add({key:prefix+relative,text,size:size(text)});
        request.onsuccess=()=>{try{const result=beforeCreateCommit(relative,()=>tx.abort());if(result&&typeof result.then==='function')tx.abort();}catch{try{tx.abort();}catch{}}};
        request.onerror=()=>{duplicate=request.error?.name==='ConstraintError';};
        tx.oncomplete=()=>resolve('created');tx.onerror=()=>{};tx.onabort=()=>duplicate?resolve('exists'):reject(Error('sync-idb-create-aborted'));
      });
    },
    list(relative){name(relative);const start=prefix+relative+'/';return run('readonly',(store,result,abort)=>{
      const rows=[],request=store.openKeyCursor(keyRange.bound(start,start+'\uffff',false,true));request.onsuccess=()=>{const cursor=request.result;if(!cursor){result(rows);return;}
        if(typeof cursor.key!=='string'||!cursor.key.startsWith(start)||rows.length>=4096){abort(Error('sync-idb-list-budget'));return;}
        const relative=cursor.key.slice(prefix.length);try{name(relative);}catch(error){abort(error);return;}rows.push(relative);cursor.continue();
      };
    });},
    inventory({maxFiles=8193,maxBytes=151000000}={}){
      if(!Number.isSafeInteger(maxFiles)||maxFiles<1||!Number.isSafeInteger(maxBytes)||maxBytes<1)fail('inventory-budget');
      return run('readonly',(store,result,abort)=>{const files=[];let total=0;const request=store.openCursor(keyRange.bound(prefix,prefix+'\uffff',false,true));
        request.onsuccess=()=>{const cursor=request.result;if(!cursor){result({files,bytes:total,complete:true});return;}
          const row=cursor.value;if(typeof cursor.key!=='string'||!cursor.key.startsWith(prefix)||typeof row.text!=='string'||!Number.isSafeInteger(row.size)||row.size!==size(row.text)){abort(Error('sync-idb-inventory-row'));return;}
          const relative=cursor.key.slice(prefix.length);try{name(relative);}catch(error){abort(error);return;}files.push({name:relative,bytes:row.size});total+=row.size;
          if(files.length>=maxFiles||total>=maxBytes){result({files,bytes:total,complete:false});return;}cursor.continue();
        };
      });
    },
    async close(){if(held)fail('lease-active');closed=true;database.close();},
  };
}
