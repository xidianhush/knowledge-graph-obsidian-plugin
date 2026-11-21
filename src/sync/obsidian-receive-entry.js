// Isolated A4 candidate. The product build uses its ordinary layout driver.
const {Notice,Platform,apiVersion,Modal}=require('obsidian');
const {BasePlugin,decodeGraphPayload,createLayoutModel,createLayoutStore,validateGraphSettings,t}=loadProbeModule('knowledge-map-host');
const sync=name=>loadProbeModule('src/sync/'+name+'-prototype.mjs');
const {createReadOnlyLayoutHistory,sharedOperationDirectory}=loadProbeModule('src/sync/obsidian-shared-history.mjs');
const {startObsidianLayoutReceiver}=loadProbeModule('src/sync/obsidian-layout-receiver.mjs');
const {openObsidianConflictReview}=loadProbeModule('src/sync/obsidian-conflict-review.mjs');
const {openObsidianOnboardingReview}=loadProbeModule('src/sync/obsidian-onboarding-review.mjs');
const {openObsidianSyncDevice,openIsolatedSyncTestDevice,createDeviceBoundPrivateStore}=sync('obsidian-host');
const {openIndexedDbSyncStore}=sync('indexeddb-store');
const {createPrivateStoreBudget}=sync('private-store-budget');
const {createDurableSyncSession,syncContentHash}=sync('persistence');
const {createPrivateConfigProjection}=sync('private-config');
const {createSettingsCoordinator}=sync('settings-coordinator');
const {randomSyncOperationId,createLayoutActionAuthor}=sync('author');
const {validateSchema3Snapshot,probeSchema3Snapshot}=sync('layout');
const {cloneBoundedSyncJson}=sync('causal');

const pluginId=ATTEMPT_SUITE?'knowledge-map-a4-attempt-layout':'knowledge-map-sync-a4-receive';
const markerPath=ATTEMPT_SUITE?'SYNC-A4-ATTEMPT-LAYOUT.json':'SYNC-A4-ISOLATED-TEST.json';
const ID=/^[a-f0-9]{32}$/,HASH=/^[a-f0-9]{64}$/,notePath='Synthetic/Late.md';
const empty={schemaVersion:3,revision:0,groups:{},structures:{}};
const expectedKeys=['first','second','note'];
function requireState(value,message){if(!value)throw Error(message);}
async function readFixture(adapter,name,limit){
  const stat=await adapter.stat(name);
  if(stat?.type!=='file'||!Number.isSafeInteger(stat.size)||stat.size<1||stat.size>limit)return null;
  const text=await adapter.read(name);
  return new TextEncoder().encode(text).length<=limit?text:null;
}
function validMarker(value){
  return value?.version===1&&value.isolated===true&&typeof value.suite==='string'&&ID.test(value.suite)&&
    Array.isArray(value.operations)&&value.operations.length===2&&value.operations.every(id=>typeof id==='string'&&ID.test(id))&&
    new Set(value.operations).size===2&&expectedKeys.every(key=>typeof value.digests?.[key]==='string'&&HASH.test(value.digests[key]));
}

async function openReceiveHost(plugin,marker){
  const {app}=plugin,{suite,operations,digests}=marker,vault=app.vault;
  const onboardingEnabled=ATTEMPT_SUITE&&['OnboardEmpty','OnboardBoth'].includes(marker.scenario);
  const resolutionEnabled=ATTEMPT_SUITE&&(marker.scenario==='Resolve'||onboardingEnabled);
  const attemptHistory=ATTEMPT_SUITE?sync('attempt-history').createAttemptHistory(vault.adapter,suite):null;
  const directory=attemptHistory?.directory??sharedOperationDirectory(suite);
  plugin.startupPhase='device-identity';
  const device=await (ATTEMPT_SUITE?openIsolatedSyncTestDevice({app,pluginId,vault:suite}):
    openObsidianSyncDevice({app,pluginId}));
  const connection=device.state().connection;
  plugin.startupPhase='device-connection';
  plugin.startupConnection=connection;
  if(connection)requireState(connection.enabled&&connection.vault===suite,t('receive.isolated'));
  else await device.connect(suite);
  const installation=device.state().installation;
  plugin.startupPhase='indexeddb-open';
  const backend=await openIndexedDbSyncStore({installation,vault:suite});
  const quota=createPrivateStoreBudget({store:backend});
  const privateStore=createDeviceBoundPrivateStore({store:quota.store,device,vault:suite});
  const sharedStore=attemptHistory?undefined:createReadOnlyLayoutHistory(vault.adapter,suite);
  const views=new Map(),runs=[];
  const epoch=()=>plugin.layoutEpoch??0;
  const getGraph=()=>views.size===1?[...views.values()][0]:null;
  function model(){
    const graph=getGraph();
    requireState(graph?.isCurrent(),t('receive.openGraph'));
    return graph.createModel();
  }
  const session=createDurableSyncSession({privateStore,sharedStore,attemptHistory,vault:suite,installation,createModel:model,getEpoch:epoch,
    ...(onboardingEnabled?{readLocalData:async()=>(await plugin.loadData())??{}}:{}),
    enableConflictResolution:resolutionEnabled});
  const projection=createPrivateConfigProjection({session,validateSettings:validateGraphSettings,getExternalEpoch:()=>0});
  const coordinator=createSettingsCoordinator({session,documentStore:projection.documentStore,validateSettings:validateGraphSettings,createModel:model,getGraphEpoch:epoch});
  let receiver,activeReview,closing=false,tail=Promise.resolve(),lastNotice='',projectionReady=false;
  async function openProjection(){
    if(projectionReady)return;
    if(!session.getLocalDocument())await projection.initialize({sourceData:(await plugin.loadData())??{}});
    await projection.open();await coordinator.open();projectionReady=true;
  }
  async function close(){
    closing=true;
    activeReview?.close();
    try{await receiver?.close();await tail;await coordinator.close();await projection.close();}
    finally{try{await session.close();}finally{backend.close();}}
  }
  try{
    await quota.recover(async()=>{
      plugin.startupPhase='private-journal';
      await session.open();
      plugin.startupPhase='private-initialize';
      if(!session.state().initialized&&!onboardingEnabled)await session.initialize({source:'explicit-empty',localBaseline:empty});
      plugin.startupPhase='private-document';
      if(session.state().initialized)await openProjection();
    });
  }catch(error){await close();throw error;}

  const state=()=>session.state(),initial=state();
  const draft=initial.localState?.layoutDraft;
  const originalSource=onboardingEnabled?(await plugin.loadData())??{}:null;
  const store=createLayoutStore(initial.accepted?(draft?.baseFingerprint===initial.accepted.fingerprint?draft.value:initial.accepted.snapshot):originalSource.layoutOverrides,async layout=>{
    requireState(!closing,t('receive.isolated'));
    requireState(projectionReady,t('receive.joinRequired'));
    const result=await quota.run(()=>coordinator.stageLayoutDraft(layout));
    if(result.kind!=='completed')throw Error(result.reason);
  });
  let joinGuard=!initial.initialized?store.reserveExternal(value=>validateSchema3Snapshot(value)):null;
  function record(entry){runs.push(entry);if(runs.length>100)runs.shift();}
  function report(result,triggeredBy){
    const current=state(),view=getGraph()?.view;
    const applied=current.accepted?.appliedIds.length??0;
    record({kind:result.kind,reason:result.reason,triggeredBy,applied,sequence:current.sequence,
      generation:view?.generation??null,groups:Object.keys(store.state().groups).length});
    const key=attemptHistory?(result.kind==='applied'?'receive.attemptApplied':
      result.reason?.startsWith('attempt-')?'receive.attemptHeld':null):
      result.kind==='applied'?'receive.applied':result.reason==='shared-candidate-blocked'?'receive.waitingNote':
      result.reason==='local-layout-draft'?'receive.draftHeld':null;
    const notice=key&&t(key,{count:applied,reason:result.reason});
    if(notice&&notice!==lastNotice)new Notice(notice);
    lastNotice=notice;
  }
  function graphReady(view,payload,graphEpoch){
    const spec={view,isCurrent:()=>!closing&&views.size===1&&views.get(view)===spec&&!view.closed&&epoch()===graphEpoch,
      createModel(){const graph=decodeGraphPayload(payload);return createLayoutModel(graph.nodes,graph.meta.layout_root_radius);}};
    views.set(view,spec);
    if(!projectionReady)return;
    startReceiver(view);
  }
  function startReceiver(view){
    if(receiver)receiver.request('graph-ready');
    else receiver=startObsidianLayoutReceiver({vault,logicalVault:suite,attemptDirectory:attemptHistory?.directory,win:view.contentEl.ownerDocument.defaultView,
      layoutStore:store,getGraph,readLocal:state,report,
      async receive(options){const result=await quota.run(()=>session.acceptExternal(options));return result.kind==='completed'?result.value:result;}});
  }
  const operationPath=index=>directory+'/'+operations[index]+'.json';
  async function place(key,source,target){
    requireState(getGraph()?.isCurrent(),t('receive.openGraph'));
    if(await vault.adapter.stat(target)){new Notice(t('receive.already'));return;}
    if(key==='second')requireState(state().accepted.appliedIds.includes(operations[0]),t('receive.firstRequired'));
    if(key==='note')requireState(await vault.adapter.stat(operationPath(1)),t('receive.secondRequired'));
    const text=await readFixture(vault.adapter,'A4 fixtures/'+source,262144);
    requireState(text&&await syncContentHash(text)===digests[key],t('receive.isolated'));
    // This command simulates a delivery into the isolated fixture. The receiver
    // sees only real Vault events. It never creates or replaces a shared file.
    await vault.create(target,text);
    record({kind:'fixture-added',fixture:key});
    new Notice(t('receive.written'));
  }
  function command(id,key,action){
    plugin.addCommand({id,name:t(key),callback:()=>{
      if(closing)return;
      tail=tail.then(()=>{if(!closing)return action();}).catch(error=>{
        record({kind:'command-error',command:id,reason:String(error.message||error).slice(0,240)});
        new Notice(String(error.message||error).slice(0,200));
      });
      return tail;
    }});
  }
  function sameLayout(a,b){
    const canonical=value=>JSON.stringify(cloneBoundedSyncJson({groups:value.groups,structures:value.structures}));
    return canonical(a)===canonical(b);
  }
  async function publishDraft(){
    if(!state().initialized){new Notice(t('receive.joinRequired'));return;}
    if(state().pending?.mode==='resolution'){new Notice(t('receive.resolutionUseReview'));return;}
    const graph=getGraph();
    requireState(graph?.isCurrent(),t('receive.openGraph'));
    const guard=store.reserveExternal(value=>{
      const snapshot=validateSchema3Snapshot(value);
      requireState(probeSchema3Snapshot(snapshot,graph.createModel).ok,t('receive.attemptGraphChanged'));
      return snapshot;
    });
    requireState(guard,t('receive.attemptEditing'));
    try{
      const ran=await quota.run(async()=>{
        let current=state();
        const draft=current.localState?.layoutDraft;
        if(!current.pending){
          if(!draft)return {kind:'held',reason:'layout-draft-missing'};
          if(sameLayout(draft.value,current.accepted.snapshot)){
            await coordinator.clearLayoutDraft(draft.id);
            return {kind:'noop'};
          }
          if(draft.baseFingerprint!==current.accepted.fingerprint)return {kind:'held',reason:'layout-draft-review'};
          const changes=[...new Set([...Object.keys(current.accepted.snapshot.groups),...Object.keys(draft.value.groups)])].flatMap(group=>{
            const before=current.accepted.snapshot.groups[group],after=draft.value.groups[group];
            const wrap=(record,source)=>record?{schemaVersion:3,record,structures:record.note?{[record.note]:source.structures[record.note]}:{}}:null;
            const oldValue=wrap(before,current.accepted.snapshot),value=wrap(after,draft.value);
            return JSON.stringify(cloneBoundedSyncJson(oldValue))===JSON.stringify(cloneBoundedSyncJson(value))?[]:[{group,value}];
          });
          const author=createLayoutActionAuthor({vault:suite,createModel:model});
          const proposal=author.prepareEdit({vault:suite,sharedScanComplete:true,records:current.accepted.operations,
            appliedIds:current.accepted.appliedIds,localBaseline:current.accepted.snapshot},changes);
          requireState(proposal.kind==='publish'&&sameLayout(proposal.proposal,draft.value),t('receive.attemptMismatch'));
          await session.stage(proposal);
        }
        const result=await session.publish();
        current=state();
        if(result.kind.startsWith('accepted')&&draft&&sameLayout(draft.value,current.accepted.snapshot))await coordinator.clearLayoutDraft(draft.id);
        return result;
      });
      const result=ran.kind==='completed'?ran.value:ran;
      record({kind:result.kind,reason:result.reason,triggeredBy:['publish-command'],sequence:state().sequence});
      new Notice(result.kind.startsWith('accepted')?t('receive.attemptPublished'):(result.reason??result.kind));
    }finally{
      guard.release();
      receiver?.request('publish-command');
    }
  }
  function resolutionNotice(result){
    new Notice(t(result.kind.startsWith('accepted')?'receive.resolutionSaved':
      result.reason==='resolution-input-changed'?'receive.resolutionChanged':'receive.resolutionHeld'),15000);
  }
  async function reviewConflict(){
    if(!state().initialized){new Notice(t('receive.joinRequired'));return;}
    if(!getGraph()?.isCurrent())await plugin.openGraph('vault',true);
    requireState(getGraph()?.isCurrent(),t('receive.openGraph'));
    if(activeReview){new Notice(t('receive.resolutionAlreadyOpen'));return;}
    const pending=state().pending;
    let review;
    if(pending?.mode==='resolution'){
      const changes=pending.operation.changes.map(({group})=>({group,value:pending.proposal.groups[group]?{
        schemaVersion:3,record:pending.proposal.groups[group],structures:pending.proposal.groups[group].note?
          {[pending.proposal.groups[group].note]:pending.proposal.structures[pending.proposal.groups[group].note]}:{}}:null}));
      review={kind:'review',choices:[{id:pending.choice,changes}]};
    }else{
      const ran=await quota.run(()=>session.previewConflictResolution());review=ran.kind==='completed'?ran.value:ran;
      if(review.kind!=='review'){resolutionNotice(review);record({kind:'resolution-held',reason:review.reason});return;}
    }
    record({kind:'resolution-review',choices:review.choices.map(c=>c.id)});
    activeReview=openObsidianConflictReview({app,Modal,t,review,pending:pending?.mode==='resolution',
      onCancel(){if(review.token)session.discardConflictReview(review.token);record({kind:'resolution-cancelled'});new Notice(t(pending?'receive.resolutionPendingClosed':'receive.resolutionCancelled'));},
      onClosed(){activeReview=null;},
      onConfirm(choice){
        const work=tail.then(async()=>{
          if(closing)return;
          const graph=getGraph();requireState(graph?.isCurrent(),t('receive.openGraph'));
          const guard=store.reserveExternal(value=>{
            const clean=validateSchema3Snapshot(value);requireState(probeSchema3Snapshot(clean,graph.createModel).ok,t('receive.attemptGraphChanged'));return clean;
          });
          requireState(guard,t('receive.attemptEditing'));
          try{
            const ran=await quota.run(async()=>{
              if(pending){if(state().pending?.id!==pending.id)return {kind:'held',reason:'resolution-input-changed'};}
              else{const staged=await session.confirmConflictResolution(review.token,choice);if(staged.kind!=='staged')return staged;}
              if(!graph.isCurrent())return {kind:'held',reason:'resolution-input-changed'};
              return session.publish();
            });
            const result=ran.kind==='completed'?ran.value:ran;
            record({kind:result.kind,reason:result.reason,triggeredBy:['resolution-confirm'],choice,sequence:state().sequence});
            resolutionNotice(result);
          }finally{guard.release();receiver?.request('resolution-confirm');}
        }).catch(error=>{record({kind:'resolution-error',reason:error.message});new Notice(t('receive.resolutionHeld'),15000);});
        tail=work;return work;
      }});
    record({kind:'resolution-review-opened'});
  }
  async function reviewJoin(){
    if(state().initialized){new Notice(t('receive.joinAlready'));return;}
    if(!getGraph()?.isCurrent())await plugin.openGraph('vault',true);
    const graph=getGraph();requireState(graph?.isCurrent(),t('receive.openGraph'));
    if(activeReview){new Notice(t('receive.resolutionAlreadyOpen'));return;}
    const source=(await plugin.loadData())??{};
    const sourceLayout=JSON.stringify(cloneBoundedSyncJson(source.layoutOverrides??null));
    const ran=await quota.run(()=>session.previewJoin({localData:source}));
    const review=ran.kind==='completed'?ran.value:ran;
    if(review.kind!=='join-preview'){
      record({kind:'join-held',reason:review.reason});new Notice(t('receive.joinHeld',{reason:review.reason??review.kind}),15000);return;
    }
    record({kind:'join-review',fingerprint:review.fingerprint,pendingId:review.pendingId});
    activeReview=openObsidianOnboardingReview({app,Modal,t,review,
      onClosed(){activeReview=null;},
      onCancel(){record({kind:'join-cancelled',pendingId:state().joining?.id??null});new Notice(t(review.choice?'receive.joinPendingClosed':'receive.joinCancelled'));},
      onConfirm(choice){
        const work=tail.then(async()=>{
          if(closing)return;
          const fresh=(await plugin.loadData())??{};
          let result;
          if(!graph.isCurrent()||sourceLayout!==JSON.stringify(cloneBoundedSyncJson(fresh.layoutOverrides??null)))result={kind:'held',reason:'join-input-changed'};
          else{
            const ran=await quota.run(()=>session.join({localData:fresh,choice,expectedSharedFingerprint:review.fingerprint}));
            result=ran.kind==='completed'?ran.value:ran;
          }
          record({kind:result.kind,reason:result.reason,triggeredBy:['join-confirm'],choice,sequence:state().sequence});
          if(state().initialized){
            const opened=await quota.run(openProjection);
            if(opened.kind!=='completed')throw Error(opened.reason);
            if(joinGuard){
              if(graph.isCurrent()&&probeSchema3Snapshot(state().accepted.snapshot,graph.createModel).ok)joinGuard.apply(state().accepted.snapshot);
              joinGuard.release();joinGuard=null;
            }
            if(getGraph()?.isCurrent())startReceiver(getGraph().view);
            new Notice(t(choice==='import'?'receive.joinImported':'receive.joinAdopted'),15000);
          }else new Notice(t('receive.joinHeld',{reason:result.reason??result.kind}),15000);
        }).catch(error=>{record({kind:'join-error',reason:error.message});new Notice(t('receive.joinHeld',{reason:error.message}),15000);});
        tail=work;return work;
      }});
  }
  function registerCommands(){
    if(onboardingEnabled)command('join-layout','receive.join',reviewJoin);
    if(resolutionEnabled)command('resolve-layout','receive.resolve',reviewConflict);
    if(attemptHistory)command('publish-layout','receive.attemptPublish',publishDraft);
    else{
      command('deliver-first','receive.first',()=>place('first','first.txt',operationPath(0)));
      command('deliver-second','receive.second',()=>place('second','second.txt',operationPath(1)));
      command('deliver-note','receive.note',()=>place('note','late-note.txt',notePath));
    }
    command('scan-layout','receive.check',async()=>{
      if(!getGraph()?.isCurrent())await plugin.openGraph('vault',true);
      if(!state().initialized){report({kind:'held',reason:'join-required'},['manual']);new Notice(t('receive.joinRequired'));return;}
      if(!receiver||!getGraph()?.isCurrent()){
        report({kind:'held',reason:'graph-not-ready'},['manual']);
        throw Error(t('receive.openGraph'));
      }
      const result=await receiver.check('manual');
      new Notice(t('receive.checkResult',{kind:result.kind,reason:result.reason??'none'}),10000);
    });
    command('export-report','receive.report',async()=>{
      const current=state(),platform=Platform.isMobile?'mobile':'PC';
      const file='SYNC-A4-native-'+platform+'-'+randomSyncOperationId()+'.json';
      const inventory=attemptHistory?await attemptHistory.scan().then(scan=>({files:scan.inventory,blockers:scan.blockers}),
        error=>({error:error.message})):null;
      await vault.create(file,JSON.stringify({probe:5,build:PROBE_BUILD,suite,platform,obsidian:apiVersion,
        accepted:current.accepted?.appliedIds??[],groups:Object.keys(store.state().groups).length,sequence:current.sequence,
        localDraft:!!current.localState?.layoutDraft,runs,...(attemptHistory?{
          transport:'attempts-v1',pending:current.pending?.id??null,attemptConflict:current.attemptConflict,inventory,
          graphReady:!!getGraph()?.isCurrent(),receiverReady:!!receiver,
          ...(onboardingEnabled?{onboarding:{initialized:current.initialized,joining:current.joining,proof:session.getJoinProof(),
            backup:session.getJoinBackup(),originalSource:originalSource,sourceNow:(await plugin.loadData())??{},projectionReady}}:{}),
          ...(resolutionEnabled?{resolution:{accepted:current.accepted,pending:current.pending,
            layout:{groups:store.state().groups}}}:{}),
        }:{})},null,2)+'\n');
      new Notice(t('receive.reportSaved',{file}));
    });
  }
  const withinTransport=path=>typeof path==='string'&&path.length>0&&
    (path===directory||path.startsWith(directory+'/')||directory.startsWith(path+'/'));
  return {store,graphLoading:view=>views.set(view,null),graphReady,graphClosed:view=>views.delete(view),registerCommands,close,
    ...(attemptHistory?{isTransportEvent:(path,oldPath)=>withinTransport(path)&&(!oldPath||withinTransport(oldPath))}:{})};
}

module.exports=class KnowledgeMapReceiveCandidate extends BasePlugin {
  async onload(){
    this.startupPhase='isolated-marker';
    try{
    let marker;
    if(this.manifest.id===pluginId){
      try{marker=JSON.parse(await readFixture(this.app.vault.adapter,markerPath,4096));}catch{}
    }
    const candidateName=['OnboardEmpty','OnboardBoth'].includes(marker?.scenario)?'Knowledge Map A5 '+marker.scenario:
      ['Different','Same','Resolve'].includes(marker?.scenario)?'Knowledge Map A6 '+marker.scenario:'Knowledge Map A4 Layout';
    const valid=ATTEMPT_SUITE?marker?.version===1&&marker.isolated===true&&marker.suite===ATTEMPT_SUITE&&
      ['PC','iPad'].some(role=>this.app.vault.getName()===candidateName+' '+role):validMarker(marker);
    if(!valid){new Notice(t('receive.isolated'));return;}
    this.vaultLayoutDriver=await openReceiveHost(this,marker);
    this.startupPhase='graph-plugin';
    try{await super.onload();this.vaultLayoutDriver.registerCommands();this.hostLoaded=true;}
    catch(error){await this.vaultLayoutDriver.close();throw error;}
    }catch(error){
      if(ATTEMPT_SUITE){
        const file='SYNC-A6-startup-'+Date.now()+'-'+randomSyncOperationId()+'.json';
        const report={version:1,suite:ATTEMPT_SUITE,phase:this.startupPhase,
          error:String(error.message??error).slice(0,240),vaultName:this.app.vault.getName(),
          obsidian:apiVersion,mobile:Platform.isMobile,build:PROBE_BUILD,
          connection:this.startupConnection??null,
          capabilities:{webLocks:typeof globalThis.navigator?.locks?.request==='function',
            webCrypto:!!globalThis.crypto?.subtle,indexedDB:!!globalThis.indexedDB,
            appLocalStorage:typeof this.app.loadLocalStorage==='function'&&typeof this.app.saveLocalStorage==='function'}};
        let saved=false;
        try{await this.app.vault.create(file,JSON.stringify(report,null,2)+'\n');saved=true;}catch{}
        new Notice(t('receive.attemptStartupFailed',{phase:report.phase,error:report.error,
          file:saved?file:t('receive.attemptStartupReportFailed')}),30000);
      }
      throw error;
    }
  }
  onunload(){
    this.vaultLayoutDriver?.close().catch(error=>console.warn('[Knowledge Map A4]',error));
    if(this.hostLoaded)super.onunload();
  }
};
