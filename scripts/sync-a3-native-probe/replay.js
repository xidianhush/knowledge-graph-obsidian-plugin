const {Plugin, Modal, Notice, Platform, apiVersion}=require('obsidian');
const sync=name=>loadProbeModule('src/sync/'+name+'-prototype.mjs');
const {openObsidianSyncDevice,createDeviceBoundPrivateStore}=sync('obsidian-host');
const {openIndexedDbSyncStore}=sync('indexeddb-store');
const {createPrivateStoreBudget,PRIVATE_STORE_BUDGET}=sync('private-store-budget');
const {createDurableSyncSession,syncContentHash}=sync('persistence');
const {cloneBoundedSyncJson}=sync('causal');
const {randomSyncOperationId:random}=sync('author');
const {buildGraph}=loadProbeModule('dist/pipeline.mjs');
const {createLayoutModel}=loadProbeModule('dist/graph-core.mjs');

const pluginId='knowledge-map-sync-a3-replay-probe';
const markerPath='SYNC-A3-ISOLATED-TEST.json';
const targetBytes=PRIVATE_STORE_BUDGET.softBytes-512;
const targetFiles=PRIVATE_STORE_BUDGET.softFiles-1;
const samples={
  repeated:{label:'高复用 · 3,967 条事件',events:3967,repeat:true},
  distinct:{label:'低复用 · 2,000 条事件',events:2000,repeat:false},
};
const ID=/^[a-f0-9]{32}$/;
const HASH=/^[a-f0-9]{64}$/;
const encoder=new TextEncoder();
const bytes=value=>encoder.encode(value).length;
const canonical=value=>JSON.stringify(cloneBoundedSyncJson(value));
const eventName=sequence=>'events/'+String(sequence).padStart(12,'0')+'.json';
const round=ms=>Math.round(ms*10)/10;
function ensure(condition,reason){if(!condition)throw Error(reason);}
function createModel(){
  const graph=buildGraph({files:[],config:{include:['**']}});
  return createLayoutModel(graph.nodes,graph.meta.layout_root_radius);
}

async function prepare(device,backend,vault,sample,progress){
  const installation=device.state().installation;
  const releaseDevice=await device.acquireLocal(vault);
  let releaseBackend;
  try{
    releaseBackend=await backend.acquire(installation);
    let bodyBytes=0, files=0;
    const batch=[];
    async function flush(){
      const results=await Promise.allSettled(batch.splice(0).map(async({name,raw})=>{
        const outcome=await backend.create(name,raw);
        ensure(outcome==='created'||outcome==='exists'&&await backend.read(name,bytes(raw))===raw,'seed record collision');
      }));
      const failed=results.find(result=>result.status==='rejected');
      if(failed)throw failed.reason;
    }
    async function put(name,raw){
      bodyBytes+=bytes(raw);
      files++;
      ensure(bodyBytes<=targetBytes&&files<=targetFiles,'fixture budget exceeded');
      batch.push({name,raw});
      if(batch.length===16)await flush();
    }
    async function blob(data){
      const text=canonical(data);
      const hash=await syncContentHash(text),name='blobs/'+hash+'.json';
      await put(name,await device.seal(vault,name,text));
      return hash;
    }
    let head=null,lastEvent;
    async function append(sequence,kind,data){
      const text=canonical({version:1,installation,vault,sequence,previous:head,kind,data});
      const name=eventName(sequence),raw=await device.seal(vault,name,text);
      await put(name,raw);
      head=await syncContentHash(text);
      lastEvent=raw;
    }
    const snapshot=await blob({schemaVersion:3,revision:0,groups:{},structures:{}});
    await append(1,'init',{snapshot,operations:[]});
    const stateFor=sampleId=>({
      version:2,settingsDraft:null,layoutDraft:null,uiPending:{},pendingSave:null,
      restoreSource:{syntheticSample:sampleId},
    });
    const repeatedHash=sample.repeat?await blob(stateFor(1)):null;
    for(let sequence=2;sequence<=sample.events;sequence++){
      const hash=repeatedHash??await blob(stateFor(sequence));
      await append(sequence,'local-state',{hash});
      if(sequence%128===0)progress('正在准备日志 '+sequence+' / '+sample.events);
    }
    progress('正在补足合成容量');
    // ASCII filler records count toward the same IndexedDB inventory. They
    // are deliberately unreferenced so the journal reads only real blobs.
    const fillerCount=targetFiles-files;
    for(let remaining=fillerCount;remaining>0;remaining--){
      const size=Math.floor((targetBytes-bodyBytes)/remaining);
      await put('filler/'+remaining,'x'.repeat(size));
    }
    await flush();
    const inventory=await backend.inventory();
    ensure(inventory.complete&&inventory.files.length===targetFiles&&inventory.bytes===targetBytes,'fixture inventory mismatch');
    await device.anchorEvent(vault,eventName(sample.events),lastEvent);
    return {head,events:sample.events,bytes:targetBytes,files:targetFiles,lastSample:sample.repeat?1:sample.events};
  }finally{
    try{await releaseBackend?.();}finally{await releaseDevice();}
  }
}

async function measure(device,installation,vault,fixture){
  const stats={};
  function timed(label,fn){
    return async(...args)=>{
      const start=performance.now();
      try{return await fn(...args);}
      finally{
        const count=stats[label]??={calls:0,ms:0};
        count.calls++;
        count.ms+=performance.now()-start;
      }
    };
  }
  const start=performance.now();
  const backend=await timed('indexedDbOpen',openIndexedDbSyncStore)({installation,vault});
  const readByPrefix={};
  const privateBackend={...backend,
    read(name,limit){
      const prefix=name.split('/')[0];
      readByPrefix[prefix]??=timed('read:'+prefix,backend.read);
      return readByPrefix[prefix](name,limit);
    },
    list:timed('list',backend.list),
    acquire:timed('backendLease',backend.acquire),
    inventory:timed('inventory',backend.inventory),
  };
  const measuredDevice={...device,
    unseal:timed('authenticate',device.unseal),
    anchorEvent:timed('checkEventAnchor',device.anchorEvent),
    verifyAnchor:timed('verifyStoredAnchor',device.verifyAnchor),
  };
  const quota=createPrivateStoreBudget({store:privateBackend});
  const privateStore=createDeviceBoundPrivateStore({store:quota.store,device:measuredDevice,vault,access:'local-only'});
  let sharedCalls=0;
  const rejectShared=()=>{sharedCalls++;throw Error('unexpected shared I/O');};
  const sharedStore={read:rejectShared,list:rejectShared,create:rejectShared};
  const session=createDurableSyncSession({privateStore,sharedStore,vault,installation,createModel,access:'local-only'});
  try{
    const {value:state,status}=await quota.recover(timed('journalOpen',session.open));
    const totalMs=round(performance.now()-start);
    ensure(state.initialized&&state.head===fixture.head&&state.sequence===fixture.events,'replayed head differs');
    ensure(state.localState?.restoreSource?.syntheticSample===fixture.lastSample,'local state differs');
    ensure(status.complete&&!status.paused&&status.bytes===fixture.bytes&&status.files===fixture.files&&status.events===fixture.events,'replayed inventory differs');
    ensure(sharedCalls===0&&device.state().connection.enabled===false,'unexpected connection or shared I/O');
    for(const row of Object.values(stats))row.ms=round(row.ms);
    return {totalMs,stats,checkedEvents:state.sequence,sharedCalls};
  }finally{
    try{await session.close();}finally{await backend.close();}
  }
}

module.exports=class extends Plugin {
  async onload(){
    try{
      const adapter=this.app.vault.adapter;
      ensure(this.manifest.id===pluginId&&(await adapter.stat(markerPath))?.size<2048,'isolated marker missing');
      this.marker=JSON.parse(await adapter.read(markerPath));
      ensure(this.marker.version===1&&this.marker.isolated===true&&ID.test(this.marker.suite),'isolated marker invalid');
    }catch{
      new Notice('SYNC-A3 长日志测试需要独立测试库标记');
      return;
    }
    this.addCommand({id:'open',name:'打开 SYNC-A3 长日志测试',callback:()=>this.panel()});
    this.addRibbonIcon('test-tube','SYNC-A3 长日志测试',()=>this.panel());
  }
  panel(){
    const panel=new Modal(this.app);
    panel.onOpen=()=>{
      const content=panel.contentEl;
      content.createEl('h2',{text:'SYNC-A3 长日志测试'});
      const summary=content.createEl('p',{text:'先选高复用样本。首次会准备约 64 MiB 合成数据，完成后退出 Obsidian 再重开复测。'});
      const detail=content.createEl('p');
      for(const [key,sample] of Object.entries(samples)){
        const button=content.createEl('button',{text:sample.label});
        button.onclick=async()=>{
          if(this.running)return;
          this.running=true;
          button.disabled=true;
          detail.setText('');
          try{
            const report=await this.check(key,text=>summary.setText(text));
            const phase={initial:'首次测量完成',reopened:'完全重开测量完成','same-launch':'本次启动内复测完成'}[report.phase];
            summary.setText(report.error?'测量暂停 · '+report.error:phase+' · '+(report.measurement.totalMs/1000).toFixed(2)+' 秒');
            detail.setText(report.filename);
          }catch(error){summary.setText(String(error.message||error).slice(0,160));}
          finally{button.disabled=false;this.running=false;}
        };
      }
    };
    panel.open();
  }
  async check(key,progress=()=>{}){
    ensure(Object.hasOwn(samples,key),'unknown sample');
    const sample=samples[key],suite=this.marker.suite;
    const launchKey=Symbol.for(pluginId+':launch');
    const launch=globalThis[launchKey]??=random();
    const run=random(),platform=Platform.isMobile?'mobile':'PC';
    const filename='SYNC-A3-replay-'+platform+'-'+key+'-'+run+'.json';
    const report={probe:3,run,suite,sample:key,platform,obsidian:apiVersion,build:PROBE_BUILD,filename};
    const storageKey=pluginId+':sample:'+key;
    let completed;
    try{
      const device=await openObsidianSyncDevice({app:this.app,pluginId});
      const installation=device.state().installation;
      const vault=(await syncContentHash(suite+'/'+key)).slice(0,32);
      const connection=device.state().connection;
      if(connection?.enabled)await device.disable();
      if(connection?.vault!==vault){
        await device.connect(vault);
        await device.disable();
      }
      const previous=this.app.loadLocalStorage(storageKey);
      let fixture=previous?.fixture;
      if(previous){
        ensure(previous.version===1&&previous.suite===suite&&previous.installation===installation&&fixture
          &&HASH.test(fixture.head)&&fixture.events===sample.events&&fixture.bytes===targetBytes&&fixture.files===targetFiles
          &&fixture.lastSample===(sample.repeat?1:sample.events),'stored fixture mismatch');
      }else{
        progress('正在准备独立 IndexedDB 数据');
        const start=performance.now();
        const backend=await openIndexedDbSyncStore({installation,vault});
        try{fixture=await prepare(device,backend,vault,sample,progress);}
        finally{await backend.close();}
        report.setupMs=round(performance.now()-start);
        this.app.saveLocalStorage(storageKey,{version:1,suite,installation,fixture});
      }
      report.fixture={bytes:fixture.bytes,files:fixture.files,events:fixture.events};
      report.phase=!previous?.firstRun?'initial':previous.lastLaunch===launch?'same-launch':'reopened';
      if(previous?.firstRun)report.priorRun=previous.firstRun;
      progress('正在验证并回放 '+sample.events+' 条事件');
      report.measurement=await measure(device,installation,vault,fixture);
      completed={version:1,suite,installation,fixture,firstRun:previous?.firstRun??run,lastLaunch:launch};
    }catch(error){report.error=String(error.message||error).slice(0,160);}
    await this.app.vault.create(filename,JSON.stringify(report,null,2)+'\n');
    if(completed)this.app.saveLocalStorage(storageKey,completed);
    return report;
  }
};
