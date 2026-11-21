// Opt-in recovery entry shared by the plugin and the isolated verification build.
const {Modal,Notice,Platform,apiVersion}=require('obsidian');
const {
  BasePlugin,buildVaultGraph,decodeGraphPayload,createLayoutModel,validateGraphSettings,t,
}=loadProbeModule('knowledge-map-host');
const sync=name=>loadProbeModule('src/sync/'+name+'-prototype.mjs');
const {openObsidianSyncDevice,createDeviceBoundPrivateStore}=sync('obsidian-host');
const {openIndexedDbSyncStore}=sync('indexeddb-store');
const {createPrivateStoreBudget}=sync('private-store-budget');
const {createDurableSyncSession,previewSharedJoin}=sync('persistence');
const {normalizeRestoreLayout}=sync('layout');
const {createLifecycleDevice,createSyncLifecycle}=sync('connection-lifecycle');
const {createPrivateConfigProjection}=sync('private-config');
const {createSettingsCoordinator}=sync('settings-coordinator');
const {createLocalWorkHost}=sync('local-work');
const {randomSyncOperationId:random}=sync('author');
const {createReadOnlyLayoutHistory}=loadProbeModule('src/sync/obsidian-shared-history.mjs');

const candidateId='knowledge-map-sync-a3-recovery';
const markerPath='SYNC-A3-ISOLATED-TEST.json';
const idPattern=/^[a-f0-9]{32}$/;
const encoder=new TextEncoder();
function requireState(condition,message){if(!condition)throw Error(message);}
function completed(result){
  if(result.kind==='held')throw Error(t('recovery.held',{reason:result.reason}));
  return result.kind==='completed'?completed(result.value):result;
}
function backupPath(input){
  const path=input.trim(),segments=path.split('/');
  requireState(path.length<=512&&!/[\\:\u0000-\u001f\u007f]/.test(path)&&segments.every(s=>s&&!s.startsWith('.')),
    t('recovery.relativePath'));
  return path;
}
async function readText(adapter,path,budget){
  const stat=await adapter.stat(path);
  if(!stat)return null;
  requireState(stat.type==='file'&&Number.isSafeInteger(stat.size)&&stat.size>=0&&stat.size<=budget,t('recovery.size'));
  const text=await adapter.read(path);
  requireState(encoder.encode(text).length<=budget,t('recovery.size'));
  return text;
}
const readOnlyHistory=(adapter,vault)=>createReadOnlyLayoutHistory(adapter,vault,code=>t('recovery.'+code));

function createWorkspace(plugin,suite,win,{simulateMissing=false,shared=false}={}){
  const pluginId=RECOVERY_CANDIDATE?candidateId:plugin.manifest.id+(shared?'-rejoin':'-recovery');
  const workspaceKey=pluginId+':workspace';
  let lifecycle,host,bundle,modelInput,graphController,closed=false;
  let lastEpoch=-1,lastPipeline=null,lastData=null,epoch=0;
  function getEpoch(){
    if(lastEpoch!==plugin.layoutEpoch||lastPipeline!==plugin.pipelineSettings||lastData!==plugin.savedData){
      lastEpoch=plugin.layoutEpoch;
      lastPipeline=plugin.pipelineSettings;
      lastData=plugin.savedData;
      epoch++;
    }
    return epoch;
  }
  function model(){
    requireState(modelInput?.epoch===getEpoch(),t('recovery.graphChanged'));
    const graph=decodeGraphPayload(modelInput.payload);
    return createLayoutModel(graph.nodes,graph.meta.layout_root_radius);
  }
  const readMarker=()=>plugin.app.loadLocalStorage(workspaceKey);
  function workspaceMarker(){
    const marker=readMarker();
    if(marker!==null)requireState(marker?.version===1&&idPattern.test(marker.suite)&&typeof marker.ready==='boolean',t('recovery.markerInvalid'));
    return marker;
  }
  function saveMarker(ready){
    plugin.app.saveLocalStorage(workspaceKey,{version:1,suite,ready});
    const actual=readMarker();
    requireState(actual?.version===1&&actual.suite===suite&&actual.ready===ready,t('recovery.markerWrite'));
  }
  async function open({setup=false,review}={}){
    let marker=workspaceMarker();
    if(!marker?.ready&&!setup&&!review)return {kind:'setup-required'};
    if(review)requireState(!marker?.ready&&!closed&&review.epoch===getEpoch(),t('recovery.historyChanged'));
    if(review)suite=review.vault;
    else suite??=marker?.suite??random();
    if(marker)requireState(marker.suite===suite,t('recovery.differentVault'));
    const app=plugin.app;
    try{
      const base=await openObsidianSyncDevice({app,pluginId,requireExistingIdentity:!!marker});
      const connection=base.state().connection;
      requireState(!closed,t('recovery.openFirst'));
      if(!marker){
        requireState(connection===null&&readMarker()===null,t('recovery.existingConnection'));
        saveMarker(false);
        marker=readMarker();
      }
      if(!connection){
        requireState(!marker.ready&&(setup||review),t('recovery.missingConnection'));
        await base.connect(suite);
      }else requireState(connection.vault===suite,t('recovery.differentVault'));
      const device=await createLifecycleDevice({device:base,app,pluginId});
      const rejectShared=()=>{throw Error(t('recovery.localOnly'));};
      lifecycle=createSyncLifecycle({device,async openBundle({access}){
        const sharedStore=shared&&access==='sync'&&review?readOnlyHistory(app.vault.adapter,suite):
          {read:rejectShared,create:rejectShared,list:rejectShared};
        const installation=device.state().installation;
        const backend=await openIndexedDbSyncStore({installation,vault:suite});
        const anchor=device.anchor(suite);
        const missing=simulateMissing&&anchor?'events/'+String(anchor.sequence).padStart(12,'0')+'.json':null;
        const store=missing?{...backend,read:(name,limit)=>name===missing?Promise.resolve(null):backend.read(name,limit)}:backend;
        const quota=createPrivateStoreBudget({store});
        const privateStore=createDeviceBoundPrivateStore({store:quota.store,device,vault:suite,access});
        const session=createDurableSyncSession({privateStore,sharedStore,vault:suite,installation,createModel:model,access,
          getEpoch,normalizeLocalLayout:value=>normalizeRestoreLayout(value,model)});
        const projection=createPrivateConfigProjection({session,validateSettings:validateGraphSettings,getExternalEpoch:()=>0});
        const coordinator=createSettingsCoordinator({
          session,documentStore:projection.documentStore,validateSettings:validateGraphSettings,
          createModel:model,getGraphEpoch:getEpoch,
        });
        bundle={backend,session,quota,projection,coordinator,open:()=>quota.recover(async()=>{
          await session.open();
          if(access==='sync'&&setup&&!marker.ready&&!shared){
            if(!session.state().initialized)await session.initialize({
              source:'explicit-empty',localBaseline:{schemaVersion:3,revision:0,groups:{},structures:{}},
            });
            if(!session.getLocalDocument())await projection.initialize({sourceData:plugin.savedData});
          }
          if(access==='local-only'||!review)requireState(session.state().initialized&&session.getLocalDocument(),t('recovery.incomplete'));
          if(session.getLocalDocument()){
            await projection.open();
            await coordinator.open();
          }
        })};
        return bundle;
      }});
      host=createLocalWorkHost({lifecycle,createModel:model,getGraphEpoch:getEpoch});
      let initial=await lifecycle.open();
      if(!marker.ready&&initial.status==='disabled')initial=await lifecycle.enable(suite);
      if(review){
        requireState(!closed&&review.epoch===getEpoch(),t('recovery.historyChanged'));
        const confirm=async({session,projection})=>{
          const result=await session.join({localData:plugin.savedData,choice:'shared',expectedSharedFingerprint:review.fingerprint});
          if(['adopted','adopted-deferred','already-joined'].includes(result.kind)&&!session.getLocalDocument()){
            const initialized=await projection.initialize({sourceData:session.getJoinBackup()});
            requireState(initialized.kind==='initialized',t('recovery.incomplete'));
          }
          return result;
        };
        const result=completed(await (initial.status==='join-required'?lifecycle.join(confirm):lifecycle.run(confirm)));
        if(result.kind==='review-required')return result;
        requireState(['adopted','adopted-deferred','already-joined'].includes(result.kind),t('recovery.openFailed'));
        initial=lifecycle.state();
      }
      if(initial.status==='ready'||initial.status==='paused')await lifecycle.disable();
      const opened=await host.open();
      requireState(opened.status==='local-ready'||opened.status==='local-paused',t('recovery.openFailed'));
      if(!marker.ready)saveMarker(true);
      const local=bundle.coordinator.state();
      return {kind:opened.status,draft:local.layoutDraft?{schema:local.restoreSource?.layoutOverrides?.schemaVersion,
        groups:Object.keys(local.layoutDraft.value.groups).length}:null};
    }catch(error){
      const reason=error.code==='SYNC_PRIVATE_IDENTITY_MISSING'?'private-identity-missing':lifecycle?.state().recoveryReason;
      if(reason)return {kind:'recovery-required',reason};
      throw error;
    }
  }
  async function prepareGraph(){
    const captured=getEpoch();
    graphController=new AbortController();
    const payload=await buildVaultGraph(plugin,win,graphController.signal,()=>{});
    requireState(!closed&&captured===getEpoch(),t('recovery.graphChanged'));
    modelInput={epoch:captured,payload};
    return captured;
  }
  return {
    open,
    async previewHistory(input){
      const vault=input.trim(),marker=workspaceMarker();
      requireState(idPattern.test(vault),t('recovery.historyId'));
      requireState(!marker?.ready&&(!marker||marker.suite===vault),t('recovery.differentVault'));
      const epoch=await prepareGraph();
      const result=await previewSharedJoin({sharedStore:readOnlyHistory(plugin.app.vault.adapter,vault),vault,createModel:model});
      requireState(!closed&&epoch===getEpoch(),t('recovery.historyChanged'));
      return {...result,vault,epoch};
    },
    async join(review){
      await lifecycle?.close();
      return open({review});
    },
    async preview(input){
      requireState(!closed&&host,t('recovery.openFirst'));
      const path=backupPath(input),adapter=plugin.app.vault.adapter;
      const captured=await prepareGraph();
      if(/\.json$/i.test(path)){
        const text=await readText(adapter,path,8388608);
        requireState(text!==null,t('recovery.fileMissing'));
        const source=JSON.parse(text);
        requireState(!closed&&captured===getEpoch(),t('recovery.graphChanged'));
        return completed(await host.prepareRestore(source));
      }
      const id=path.split('/').at(-1);
      requireState(idPattern.test(id),t('recovery.packagePath'));
      const source={read:(name,limit)=>{
        const file=name.slice(id.length+1);
        requireState(name.startsWith(id+'/')&&['data.json','manifest.json'].includes(file),t('recovery.packageFile'));
        return readText(adapter,path+'/'+file,limit);
      }};
      return completed(await host.prepareCompatibilityRestore({source,id}));
    },
    async apply(token){
      requireState(!closed&&host,t('recovery.openFirst'));
      return completed(await host.applyRestore(token));
    },
    cancel(){
      closed=true;
      graphController?.abort();
    },
    async close(){
      await lifecycle?.close();
    },
  };
}

const recoveryMessages={
  'private-identity-missing':'recovery.identityMissing',
  'private-anchor-missing':'recovery.anchorMissing',
  'private-anchor-mismatch':'recovery.anchorMismatch',
};
const historyMessages={
  'shared-history-empty':'recovery.historyEmpty',
  'shared-partial-json':'recovery.historyIncomplete',
  'shared-input-unresolved':'recovery.historyUnresolved',
  'shared-candidate-blocked':'recovery.historyUnresolved',
  'shared-scan-changed':'recovery.historyChanged',
  'accepted-history-differs-from-preview':'recovery.historyResumeHeld',
};
function reviewError(reason){
  const key=historyMessages[reason];
  return Error(key?t(key):t('recovery.held',{reason}));
}
class RecoveryModal extends Modal {
  constructor(plugin,suite,shared){
    super(plugin.app);
    this.plugin=plugin;
    this.suite=suite;
    this.shared=shared;
    this.tail=Promise.resolve();
    this.observations=[];
  }
  onOpen(){
    const content=this.contentEl;
    content.createEl('h2',{text:t(this.shared?'recovery.historyTitle':'recovery.title')});
    if(!RECOVERY_CANDIDATE)content.createEl('p',{text:t(this.shared?'recovery.historyHelp':'recovery.draftHelp')});
    this.status=content.createEl('p',{text:t('recovery.loading')});
    const button=(parent,text,action)=>{const node=parent.createEl('button',{text});node.onclick=()=>this.run(action);return node;};
    if(this.shared){
      this.history=content.createDiv();
      this.history.hidden=true;
      this.vaultId=this.history.createEl('input');
      this.vaultId.type='text';
      this.vaultId.placeholder=t('recovery.historyIdLabel');
      this.vaultId.setAttribute('aria-label',t('recovery.historyIdLabel'));
      this.vaultId.autocapitalize='off';
      this.vaultId.spellcheck=false;
      this.vaultId.oninput=()=>this.clearHistoryReview();
      button(this.history,t('recovery.historyPreview'),async()=>{
        this.clearHistoryReview();
        const input=this.vaultId.value;
        this.status.setText(t('recovery.historyChecking'));
        const result=await this.workspace.previewHistory(input);
        if(this.closed||input!==this.vaultId.value)return;
        if(result.kind!=='shared-preview')throw reviewError(result.reason);
        this.historyReview=result;
        this.joinButton.disabled=false;
        this.status.setText(t('recovery.historyPreviewReady',result));
      });
      this.joinButton=button(this.history,t('recovery.historyConfirm'),async()=>{
        const review=this.historyReview;
        this.clearHistoryReview();
        this.status.setText(t('recovery.historyJoining'));
        const result=await this.workspace.join(review);
        if(this.closed)return;
        if(result.kind==='review-required')throw reviewError(result.reason);
        this.displayWorkspace(result);
        if(result.kind==='local-ready'&&!result.draft)this.status.setText(t('recovery.historyJoined'));
      });
      this.clearHistoryReview();
    }
    this.backup=content.createDiv();
    this.backup.hidden=!RECOVERY_CANDIDATE;
    this.input=this.backup.createEl('input');
    this.input.type='text';
    this.input.value=RECOVERY_CANDIDATE?'Recovery samples/layout-schema2.json':'';
    this.input.placeholder=t('recovery.sourceLabel');
    this.input.setAttribute('aria-label',t('recovery.sourceLabel'));
    const buttons=this.backup.createDiv();
    if(!this.shared)this.setup=button(content,t('recovery.setup'),()=>this.openWorkspace({setup:true}));
    this.previewButton=button(buttons,t('recovery.preview'),async()=>{
      this.token=null;
      this.confirm.disabled=true;
      const input=this.input.value;
      const result=await this.workspace.preview(input);
      if(this.closed||input!==this.input.value)return;
      requireState(result.kind==='restore-preview',t('recovery.previewUnavailable'));
      this.token=result.token;
      this.confirm.disabled=false;
      const groups=Object.keys(result.layout.groups).length;
      this.observations.push({kind:'preview',groups});
      this.status.setText(t('recovery.previewReady',{groups}));
    });
    this.confirm=button(buttons,t('recovery.confirm'),async()=>{
      const result=await this.workspace.apply(this.token);
      this.token=null;
      this.confirm.disabled=true;
      this.previewButton.disabled=true;
      this.observations.push({kind:result.kind});
      this.status.setText(result.kind==='restore-staged'?t('recovery.saved'):t('recovery.savedDeferred'));
    });
    if(RECOVERY_CANDIDATE)this.checkLoss=button(content,t('recovery.simulateLoss'),()=>this.openWorkspace({simulateMissing:true}));
    button(content,t('recovery.reopen'),()=>this.openWorkspace());
    if(RECOVERY_CANDIDATE)button(content,t('recovery.exportReport'),async()=>{
      const run=random(),platform=Platform.isMobile?'mobile':'PC';
      const filename='SYNC-A3-recovery-'+platform+'-'+run+'.json';
      await this.app.vault.create(filename,JSON.stringify({
        probe:4,build:PROBE_BUILD,suite:this.suite,run,platform,obsidian:apiVersion,observations:this.observations,
      },null,2)+'\n');
      this.status.setText(t('recovery.reportSaved',{file:filename}));
    });
    this.input.oninput=()=>{this.token=null;this.confirm.disabled=true;};
    this.confirm.disabled=true;
    this.previewButton.disabled=true;
    if(this.checkLoss)this.checkLoss.disabled=true;
    if(this.setup)this.setup.disabled=true;
    this.run(()=>this.openWorkspace());
  }
  clearHistoryReview(){
    this.historyReview=null;
    if(this.joinButton)this.joinButton.disabled=true;
  }
  run(action){
    if(this.busy||this.closed)return;
    this.busy=true;
    this.tail=Promise.resolve().then(action).catch(error=>{
      if(!this.closed)this.status.setText(String(error.message||error).slice(0,180));
    }).finally(()=>{this.busy=false;});
  }
  async openWorkspace(options={}){
    this.token=null;
    this.confirm.disabled=true;
    this.previewButton.disabled=true;
    if(this.checkLoss)this.checkLoss.disabled=true;
    if(this.history){this.history.hidden=true;this.clearHistoryReview();}
    await this.workspace?.close();
    if(this.closed)return;
    const win=this.contentEl.ownerDocument.defaultView;
    this.workspace=createWorkspace(this.plugin,this.suite,win,{...options,shared:this.shared});
    const result=await this.workspace.open(options);
    if(this.closed)return;
    this.observations.push({...result,simulated:options.simulateMissing===true});
    this.displayWorkspace(result);
  }
  displayWorkspace(result){
    const local=['local-ready','local-paused'].includes(result.kind);
    if(this.setup)this.setup.disabled=result.kind!=='setup-required';
    if(this.history)this.history.hidden=result.kind!=='setup-required';
    this.backup.hidden=!RECOVERY_CANDIDATE&&!local;
    this.previewButton.disabled=result.kind!=='local-ready'||!!result.draft;
    if(this.checkLoss)this.checkLoss.disabled=!local;
    if(result.kind==='recovery-required')this.status.setText(t(recoveryMessages[result.reason]));
    else if(result.kind==='setup-required')this.status.setText(t(this.shared?'recovery.historySelect':RECOVERY_CANDIDATE?'recovery.needsSetup':'recovery.localNeedsSetup'));
    else if(result.draft)this.status.setText(t('recovery.draftRead',{groups:result.draft.groups}));
    else this.status.setText(result.kind==='local-paused'?t('recovery.paused'):t('recovery.select'));
  }
  onClose(){
    this.closed=true;
    this.workspace?.cancel();
    this.plugin.recoveryClosing=this.tail.then(()=>this.workspace?.close()).catch(error=>console.warn('[Knowledge Map recovery]',error));
    this.plugin.recoveryModal=null;
    this.contentEl.empty();
  }
}

module.exports=class KnowledgeMapRecoveryPlugin extends BasePlugin {
  async onload(){
    let marker;
    if(RECOVERY_CANDIDATE){
      const raw=await readText(this.app.vault.adapter,markerPath,2048);
      try{marker=JSON.parse(raw);}catch{}
      if(this.manifest.id!==candidateId||marker?.version!==1||marker.isolated!==true||!idPattern.test(marker.suite)){
        new Notice(t('recovery.isolated'));
        return;
      }
    }
    await super.onload();
    this.hostLoaded=true;
    const open=shared=>async()=>{
      await this.recoveryClosing;
      if(!this.hostLoaded||this.recoveryModal)return;
      this.recoveryModal=new RecoveryModal(this,marker?.suite,shared);
      this.recoveryModal.open();
    };
    this.addCommand({id:'open-recovery',name:t('recovery.title'),callback:open(false)});
    if(!RECOVERY_CANDIDATE)this.addCommand({id:'rejoin-shared-layout',name:t('recovery.historyTitle'),callback:open(true)});
  }
  onunload(){
    this.recoveryModal?.close();
    if(this.hostLoaded)super.onunload();
    this.hostLoaded=false;
  }
};
