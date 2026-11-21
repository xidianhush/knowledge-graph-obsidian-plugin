// Narrow local-work host entrypoints. No UI/production saveData wiring.
import {cloneBoundedSyncJson} from './causal-prototype.mjs';
import {validateSchema3Snapshot,probeSchema3Snapshot} from './layout-prototype.mjs';
import {syncContentHash} from './persistence-prototype.mjs';
const ID=/^[a-f0-9]{32}$/,HASH=/^[a-f0-9]{64}$/,MAX=8388608,encoder=new TextEncoder();
const fail=reason=>{throw Error('local-work-'+reason);},clone=x=>cloneBoundedSyncJson(x,{maxBytes:MAX});
const text=x=>JSON.stringify(clone(x)),plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function destination(store,id){if(!ID.test(id)||!store||['read','create'].some(k=>typeof store[k]!=='function'))fail('export-options');}
export async function readCompatibilityExport({source,id}={}){
  if(!ID.test(id)||typeof source?.read!=='function')fail('export-options');
  const raw=await source.read(id+'/manifest.json',4096);if(raw===null)fail('incomplete-export');
  let manifest;try{manifest=JSON.parse(raw);}catch{fail('manifest-json');}
  if(!plain(manifest)||Object.keys(manifest).sort().join(',')!=='bytes,hash,id,scope,version'||manifest.version!==1||manifest.id!==id||manifest.scope!=='compatibility-data-not-acceptance'||!HASH.test(manifest.hash)||!Number.isSafeInteger(manifest.bytes)||manifest.bytes<2||manifest.bytes>MAX)fail('manifest');
  const body=await source.read(id+'/data.json',manifest.bytes);if(body===null||encoder.encode(body).length!==manifest.bytes||await syncContentHash(body)!==manifest.hash)fail('export-content');
  let data;try{data=clone(JSON.parse(body));}catch{fail('export-json');}if(!plain(data))fail('export-shape');return data;
}
export function createLocalWorkHost({lifecycle,createModel,getGraphEpoch}={}){
  if(!lifecycle||typeof lifecycle.runLocal!=='function'||typeof lifecycle.readLocal!=='function'||typeof createModel!=='function'||typeof getGraphEpoch!=='function')fail('options');
  function epoch(){const n=getGraphEpoch();if(!Number.isSafeInteger(n)||n<0)fail('epoch');return n;}
  function checkedLayout(value){const layout=validateSchema3Snapshot(value);if(!probeSchema3Snapshot(layout,createModel).ok)fail('graph-incompatible');return layout;}
  async function view(bundle){
    const before=epoch(),data=(await bundle.projection.documentStore.read()).data,local=bundle.coordinator.state(),accepted=bundle.session.state().accepted;
    let layoutSource='accepted',issue=null;
    if(local.layoutDraft){if(local.layoutDraft.baseFingerprint!==accepted.fingerprint)issue='layout-basis-changed';else{data.layoutOverrides=local.layoutDraft.value;layoutSource='local-draft';}}
    try{checkedLayout(data.layoutOverrides);}catch{issue??='graph-incompatible';}
    if(before!==epoch())issue='graph-changed';
    return {kind:issue?'held':'local-view',reason:issue,data:clone(data),layoutSource,acceptedFingerprint:accepted.fingerprint,settingsDraft:clone(local.settingsDraft),pendingOperation:bundle.session.state().pending?.id||null};
  }
  return {
    open:()=>lifecycle.openLocal(),
    beginSettings:()=>lifecycle.runLocal(b=>b.coordinator.beginSettingsDraft()),
    updateSettings(id,value){value=clone(value);return lifecycle.runLocal(b=>b.coordinator.updateSettingsDraft(id,value));},
    saveSettings:id=>lifecycle.runLocal(b=>b.coordinator.saveSettingsDraft(id)),
    saveUi:(key,value)=>lifecycle.runLocal(b=>b.coordinator.saveUi(key,value)),
    saveLayout(value){const before=epoch(),layout=checkedLayout(value);return lifecycle.runLocal(b=>before!==epoch()?{kind:'held',reason:'graph-changed'}:b.coordinator.stageLayoutDraft(layout));},
    view:()=>lifecycle.readLocal(view),
    prepareRestore(data){data=clone(data);return lifecycle.runLocal(b=>b.coordinator.prepareRestore(data));},
    async prepareCompatibilityRestore(options){
      const data=await readCompatibilityExport(options);
      return lifecycle.runLocal(b=>b.coordinator.prepareRestore(data));
    },
    applyRestore:token=>lifecycle.runLocal(b=>b.coordinator.applyRestore(token)),
    exportCompatibility({destination:store,id}={}){
      destination(store,id);return lifecycle.readLocal(async bundle=>{
        const current=await view(bundle);if(current.kind==='held')return current;
        const body=text(current.data),manifest={version:1,id,scope:'compatibility-data-not-acceptance',bytes:encoder.encode(body).length,hash:await syncContentHash(body)};
        async function install(name,raw){await store.create(id+'/'+name,raw);if(await store.read(id+'/'+name,name==='manifest.json'?4096:MAX)!==raw)fail('export-conflict');}
        await install('data.json',body);await install('manifest.json',text(manifest));return {kind:'exported',id,scope:manifest.scope,layoutSource:current.layoutSource};
      });
    },
  };
}
