// Private-storage admission and exact pre-create limits. No deletion or GC.
export const PRIVATE_STORE_BUDGET=Object.freeze({softBytes:64*1048576,hardBytes:144*1048576,softFiles:4096,hardFiles:8192,softEvents:3968,hardEvents:4096});
const bytes=text=>new TextEncoder().encode(text).length;
const fail=reason=>{throw Error('private-budget-'+reason);};
export function createPrivateStoreBudget({store,limits=PRIVATE_STORE_BUDGET}={}){
  if(!store||['read','create','list','acquire','inventory'].some(k=>typeof store[k]!=='function'))fail('store');
  limits={...PRIVATE_STORE_BUDGET,...limits};if(Object.keys(limits).sort().join(',')!=='hardBytes,hardEvents,hardFiles,softBytes,softEvents,softFiles'||Object.values(limits).some(n=>!Number.isSafeInteger(n)||n<1)||limits.softBytes>=limits.hardBytes||limits.softFiles>=limits.hardFiles||limits.softEvents>=limits.hardEvents||limits.hardEvents>4096)fail('limits');
  let held=false,active=null,tail=Promise.resolve();
  // Only controlled stores may account for successful creates incrementally.
  // All writers must respect the same lease. Successful creates leave no
  // extra inventory entries. A failure may leave files and invalidates counts.
  const incremental=store.stableInventoryUnderLease===true;
  async function inspect(){const v=await store.inventory({maxFiles:limits.hardFiles+1,maxBytes:limits.hardBytes+1});
    if(!v||typeof v.complete!=='boolean'||!Number.isSafeInteger(v.bytes)||v.bytes<0||!Array.isArray(v.files)||v.files.some(f=>typeof f.name!=='string'||!Number.isSafeInteger(f.bytes)||f.bytes<0))fail('inventory');
    if(new Set(v.files.map(f=>f.name)).size!==v.files.length||v.complete&&v.files.reduce((n,f)=>n+f.bytes,0)!==v.bytes)fail('inventory');
    const events=v.files.filter(f=>f.name.startsWith('events/')).length;
    return {bytes:v.bytes,files:v.files.length,events,complete:v.complete,paused:!v.complete||v.bytes>=limits.softBytes||v.files.length>=limits.softFiles||events>=limits.softEvents,hard:!v.complete||v.bytes>=limits.hardBytes||v.files.length>=limits.hardFiles||events>=limits.hardEvents,limits:{...limits}};
  }
  function action(kind,fn){
    if(typeof fn!=='function')fail('action');
    const work=tail.catch(()=>{}).then(async()=>{
      if(!held&&kind==='normal')fail('lease-required');
      const status=kind==='normal'?await inspect():null;
      if(status?.paused)return {kind:'held',reason:'private-storage-budget',status};
      const admission={counts:incremental?status:null,writes:Promise.resolve(),accepting:true};
      active=admission;
      try{
        const value=await fn();
        admission.accepting=false;
        await admission.writes;
        return {kind:'completed',value,status:await inspect()};
      }finally{
        admission.accepting=false;
        await admission.writes;
        active=null;
      }
    });
    tail=work;
    return work;
  }
  const boundedStore={
    immutableBlobsUnderLease:store.immutableBlobsUnderLease===true,
    read:(...args)=>store.read(...args),list:(...args)=>store.list(...args),inventory:(...args)=>store.inventory(...args),
    async acquire(owner){
      if(held)fail('lease-active');
      const release=await store.acquire(owner);
      held=true;
      if(active)active.counts=null;
      let released=false;
      return async()=>{
        if(released)return;
        released=true;
        if(!active)await tail.catch(()=>{});
        held=false;
        if(active){
          await active.writes;
          active.counts=null;
        }
        await release();
      };
    },
    async create(name,text){
      const admission=active;
      if(!held||!admission?.accepting)fail('admission-required');
      if(typeof text!=='string')fail('text');
      const write=admission.writes.then(async()=>{
        if(!held)fail('lease-required');
        const found=await store.read(name,8388608+1024);
        if(found!==null)return 'exists';
        const status=admission.counts??await inspect();
        const needed=bytes(text),event=Number(name.startsWith('events/'));
        if(!status.complete||status.bytes+needed>limits.hardBytes||status.files+1>limits.hardFiles||status.events+event>limits.hardEvents){
          const error=Error('private-budget-hard-limit');
          error.code='SYNC_PRIVATE_BUDGET';
          error.status=status;
          throw error;
        }
        admission.counts=null;
        const result=await store.create(name,text);
        if(incremental&&result==='created'){
          admission.counts={...status,bytes:status.bytes+needed,files:status.files+1,events:status.events+event};
        }
        return result;
      });
      admission.writes=write.catch(()=>{});
      return write;
    },
  };
  return {store:boundedStore,inspect,run:fn=>action('normal',fn),recover:fn=>action('recovery',fn),settled:()=>tail.catch(()=>{})};
}
