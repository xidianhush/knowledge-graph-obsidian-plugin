// Independent unified candidate. No suite/fixture identity and no default
// product entry replacement. U4 supplies the user-facing connection controls.
const {Modal,Notice,Platform,apiVersion}=require('obsidian');
const {BasePlugin,decodeGraphPayload,createLayoutModel,createLayoutStore,validateGraphSettings,applyCandidateData,t}=loadProbeModule('knowledge-map-host');
const {mountObsidianSyncSettings}=loadProbeModule('src/sync/obsidian-sync-settings.mjs');
const {mountObsidianEasySettings}=loadProbeModule('src/sync/obsidian-easy-settings.mjs');
const {createUnifiedSyncHost}=loadProbeModule('src/sync/obsidian-unified-host.mjs');
const {openIndexedDbSyncStore}=loadProbeModule('src/sync/indexeddb-store-prototype.mjs');
const {startObsidianLayoutReceiver}=loadProbeModule('src/sync/obsidian-layout-receiver.mjs');
const {cloneBoundedSyncJson}=loadProbeModule('src/sync/causal-prototype.mjs');
const canonical=value=>JSON.stringify(cloneBoundedSyncJson(value));
module.exports=class KnowledgeMapUnifiedCandidate extends BasePlugin{
 async onload(){
  const views=new Map(),graph=()=>views.size===1?[...views.values()][0]:null;
  let receiver=null,receiverVault=null,host;const documents=new WeakSet();
  // Coalesced easy-sync wake: only when this device already authorized, debounced,
  // single-flight, and never re-triggered by its own waiting result (no self-loop).
  let easyTimer=null,easyRunning=false;
  const easyWin=()=>this.app.workspace?.containerEl?.ownerDocument?.defaultView??globalThis;
  const runEasy=async()=>{if(easyRunning||!host)return;easyRunning=true;try{await host.resumeEasySync();}catch(error){console.warn('[Knowledge Map easy]',error);}finally{easyRunning=false;}};
  const scheduleEasy=()=>{if(this.app.loadLocalStorage(this.manifest.id+':easy-sync-v1')===null)return;const win=easyWin();win.clearTimeout(easyTimer);easyTimer=win.setTimeout(()=>{easyTimer=null;void runEasy();},250);};
  const wake=()=>{requestReceive();void host?.wakeStructure().catch(error=>console.warn('[Knowledge Map structure]',error));void host?.resumePublication();scheduleEasy();};
  const requestReceive=()=>{
   if(!host?.canReceive()||!graph())return;
   const selected=host.state().selected;
   if(receiverVault!==selected.vault){void receiver?.close();receiver=null;}
   if(!receiver){receiverVault=selected.vault;receiver=startObsidianLayoutReceiver({vault:this.app.vault,logicalVault:selected.vault,
    ...(selected.transport==='attempts-v1'?{attemptDirectory:'Knowledge Map Sync/attempts-v1/'+selected.vault+'/ops'}:{}),
    win:graph().view.contentEl.ownerDocument.defaultView,layoutStore:host.store,
    getGraph:()=>{const g=graph();return host.canReceive()&&g?{...g,isCurrent:()=>host.canReceive()&&g.isCurrent()}:null;},
    readLocal:async()=>{await host.finishObservedStructure();return host.state().session;},receive:options=>host.receive(options),report:result=>{this.syncReceiveStatus=result;},
   });}else receiver.request('host-ready');
  };
  const readSource=async()=>await this.loadData()??{};
  host=await createUnifiedSyncHost({app:this.app,pluginId:this.manifest.id,adapter:this.app.vault.adapter,readSource,
   saveUnjoined:async(data,{expected})=>{
    const path=this.app.vault.configDir+'/plugins/'+this.manifest.id+'/data.json',adapter=this.app.vault.adapter;
    if(typeof adapter.process!=='function')throw Error('unified-conditional-config-api');
    let matched=false;
    if(!await adapter.stat(path)){
     if(Object.keys(expected).length)throw Error('unified-config-missing');
     await this.saveData(data);matched=true;
    }else await adapter.process(path,raw=>{if(canonical(JSON.parse(raw))!==canonical(expected))return raw;matched=true;return JSON.stringify(data);});
    if(!matched||canonical(await readSource())!==canonical(data))throw Error('unified-config-changed');
    applyCandidateData(this,data);
   },
   createStore:createLayoutStore,validateSettings:validateGraphSettings,openBackend:options=>openIndexedDbSyncStore(options),
   getGraph:graph,getEpoch:()=>this.layoutEpoch??0,onData:data=>{applyCandidateData(this,data);requestReceive();},
  });
  this.syncHost=host;
  if(this.app.workspace?.on)this.registerEvent(this.app.workspace.on('active-leaf-change',wake));
  this.vaultLayoutDriver={store:host.store,
   prepareGraph:({payload,epoch,isCurrent})=>host.prepareLocalGraph({epoch,isCurrent,createModel:()=>{const decoded=decodeGraphPayload(payload);return createLayoutModel(decoded.nodes,decoded.meta.layout_root_radius);}}),
   graphLoading:view=>views.set(view,null),
   graphReady:(view,payload,expected)=>{
    const doc=view.contentEl.ownerDocument;
    if(!documents.has(doc)){documents.add(doc);this.registerDomEvent(doc,'visibilitychange',wake);this.registerDomEvent(doc.defaultView,'focus',wake);}
    const spec={view,get hidden(){return doc.hidden||view.contentEl.getClientRects().length===0;},isCurrent:()=>views.size===1&&views.get(view)===spec&&!view.closed&&expected===this.layoutEpoch,
     createModel:()=>{const decoded=decodeGraphPayload(payload);return createLayoutModel(decoded.nodes,decoded.meta.layout_root_radius);}};
    views.set(view,spec);void host.graphReady().then(()=>{requestReceive();scheduleEasy();return host.resumePublication();}).catch(error=>console.warn('[Knowledge Map unified]',error));
   },
   graphClosed:view=>{views.delete(view);wake();},
   isTransportEvent:(path,oldPath,event,folder)=>[path,oldPath].filter(Boolean).every(p=>p==='Knowledge Map Sync'||p.startsWith('Knowledge Map Sync/'))||(event==='create'&&folder===true&&host.isExportEvent(path,oldPath)),
  };
  this.syncSaveUi=(key,value)=>host.saveUi(key,value);
  try{await super.onload();await host.effective();
   this.registerEvent(this.app.vault.on('rename',(file,oldPath)=>{
    if((this.pipelineSettings?.config?.remap??[]).length)return;
    if(Array.isArray(file?.children)||/\.md$/i.test(file?.path??''))host.notifyPathChange(oldPath,file.path,Array.isArray(file?.children));
   }));
   // Pre-join shared-folder events wake discovery/connection; post-join they also
   // drive the existing external-observe path. Coalesced by scheduleEasy.
   for(const event of ['modify','create','delete','rename'])this.registerEvent(this.app.vault.on(event,(file,oldPath)=>{
    if(![file?.path,oldPath].filter(Boolean).some(p=>p==='Knowledge Map Sync'||p.startsWith('Knowledge Map Sync/')))return;
    void host.notifyExternalChange({event,path:file?.path,oldPath,folder:Array.isArray(file?.children)});scheduleEasy();
   }));
   scheduleEasy();
  }
  catch(error){await host.close();throw error;}
  if(this.settingTab){const tab=this.settingTab,display=tab.display.bind(tab);tab.display=(...args)=>{
   this.syncSettingsPanel?.close();display(...args);
   this.syncSettingsPanel=mountObsidianEasySettings({container:tab.containerEl,app:this.app,host,Modal,t,onCheck:async()=>{requestReceive();return receiver?receiver.check():{kind:'held',reason:'graph-unavailable'};},onExport:async()=>{
    const nonce=Array.from(crypto.getRandomValues(new Uint8Array(8)),b=>b.toString(16).padStart(2,'0')).join(''),file='Knowledge-Map-Sync-Report-'+Date.now()+'-'+nonce+'.json';
    const report={...(await host.diagnostics()),build:PROBE_BUILD,obsidian:apiVersion,mobile:Platform.isMobile,timestamp:new Date().toISOString()};
    await this.app.vault.create(file,JSON.stringify(report,null,2)+'\n');new Notice(t('sync.exported',{file}));return {kind:'exported',file};
   }});
  };if(tab.containerEl?.isConnected)tab.display();}
  this.unifiedClose=async()=>{easyWin().clearTimeout(easyTimer);easyTimer=null;this.syncSettingsPanel?.close();await receiver?.close();await host.close();};
 }
 async saveGraphSettings(draft){
  const checked=validateGraphSettings(draft),result=await this.syncHost.saveSettings({settings:checked.settings,pipeline:checked.pipeline});
  if(!['saved','saved-local'].includes(result.kind))throw Error(result.reason||result.kind);
  return result;
 }
 onExternalSettingsChange(){return this.syncHost?.notifyExternalChange();}
 onunload(){void this.unifiedClose?.().catch(error=>console.warn('[Knowledge Map unified]',error));super.onunload();}
};
