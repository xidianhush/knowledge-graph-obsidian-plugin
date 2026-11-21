const {Plugin, Modal, Notice, Platform, apiVersion}=require('obsidian');
const sync=name=>loadProbeModule('src/sync/'+name+'-prototype.mjs');
const {createLocalWorkHost,readCompatibilityExport}=sync('local-work');
const {createLifecycleDevice,createSyncLifecycle}=sync('connection-lifecycle');
const {createSettingsCoordinator}=sync('settings-coordinator');
const {createPrivateConfigProjection}=sync('private-config');
const {createDurableSyncSession}=sync('persistence');
const {openObsidianSyncDevice,createDeviceBoundPrivateStore}=sync('obsidian-host');
const {openIndexedDbSyncStore}=sync('indexeddb-store');
const {createPrivateStoreBudget}=sync('private-store-budget');
const {cloneBoundedSyncJson}=sync('causal');
const {randomSyncOperationId:random}=sync('author');
const {createLayoutModel,createLayoutEditor,createLayoutStore}=loadProbeModule('dist/graph-core.mjs');
const {buildGraph}=loadProbeModule('dist/pipeline.mjs');
const {validateGraphSettings}=loadProbeModule('probe-settings');
const pluginId='knowledge-map-sync-a3-local-work-probe';
const markerPath='SYNC-A3-ISOLATED-TEST.json';
const observationKey=pluginId+':observation';
const empty={schemaVersion:3,revision:0,groups:{},structures:{}};
const graph=()=>buildGraph({
  files:[{path:'Synthetic/A.md',text:'# First\nbody\n# Second\nother'}],
  config:{include:['**']},
});
function model(){
  const {nodes,meta}=graph();
  return createLayoutModel(nodes,meta.layout_root_radius);
}
function ensure(condition,reason){if(!condition)throw Error(reason);}
function value(result){
  ensure(result.kind==='completed','write admission held: '+result.reason);
  return result.value;
}
const same=(left,right)=>JSON.stringify(cloneBoundedSyncJson(left))===JSON.stringify(cloneBoundedSyncJson(right));
async function editedLayout(){
  const {nodes,meta}=graph();
  const node=nodes.find(node=>node.title==='Second');
  const layoutModel=createLayoutModel(nodes,meta.layout_root_radius);
  const editor=createLayoutEditor(nodes,meta.layout_root_radius);
  ensure(editor.begin(node.id)===null,'synthetic edit did not start');
  editor.move(node.x+10,node.y+3);
  editor.commit();
  const group=layoutModel.groupKey(node.id);
  let snapshot;
  await createLayoutStore(null,async next=>{snapshot=next;})
    .command({},'edit',group,layoutModel.capture(group));
  ensure(snapshot&&Object.keys(snapshot.groups).length>0,'synthetic layout was not saved');
  return snapshot;
}
async function openWork(app,vault){
  const base=await openObsidianSyncDevice({app,pluginId});
  const installation=base.state().installation;
  if(!base.state().connection)await base.connect(vault);
  ensure(base.state().connection.vault===vault,'wrong logical vault');
  const device=await createLifecycleDevice({device:base,app,pluginId});
  let sharedCalls=0;
  const rejectShared=()=>{sharedCalls++;throw Error('unexpected shared I/O');};
  const sharedStore={read:rejectShared,list:rejectShared,create:rejectShared};
  const lifecycle=createSyncLifecycle({device,async openBundle({access}){
    const backend=await openIndexedDbSyncStore({installation,vault});
    const quota=createPrivateStoreBudget({store:backend});
    const privateStore=createDeviceBoundPrivateStore({store:quota.store,device,vault,access});
    const session=createDurableSyncSession({privateStore,sharedStore,vault,installation,createModel:model,access});
    const projection=createPrivateConfigProjection({session,validateSettings:validateGraphSettings,getExternalEpoch:()=>0});
    const coordinator=createSettingsCoordinator({
      session,documentStore:projection.documentStore,validateSettings:validateGraphSettings,
      createModel:model,getGraphEpoch:()=>0,
    });
    return {backend,quota,session,projection,coordinator,open:()=>quota.recover(async()=>{
      await session.open();
      if(access==='sync'){
        if(!session.state().initialized)await session.initialize({source:'explicit-empty',localBaseline:empty});
        await projection.initialize({sourceData:{settings:{language:'auto'},ui:{legend:'false'}}});
      }
      await projection.open();
      await coordinator.open();
    })};
  }});
  const host=createLocalWorkHost({lifecycle,createModel:model,getGraphEpoch:()=>0});
  return {lifecycle,host,installation,sharedCalls:()=>sharedCalls};
}
async function verifyCapacity(installation){
  const backend=await openIndexedDbSyncStore({installation,vault:random()});
  const quota=createPrivateStoreBudget({store:backend,limits:{softBytes:1024,hardBytes:2048}});
  let release;
  try{
    release=await quota.store.acquire(installation);
    const result=await quota.run(async()=>{
      ensure(await quota.store.create('blobs/one','测试'.repeat(256))==='created','seed not committed');
      try{await quota.store.create('blobs/two','x'.repeat(513));}
      catch(error){ensure(error.code==='SYNC_PRIVATE_BUDGET','unexpected hard limit error');return;}
      throw Error('hard budget accepted an oversized batch');
    });
    ensure(result.status.bytes===1536&&result.status.files===1&&result.status.paused,'incorrect IndexedDB inventory');
    const held=await quota.run(()=>{throw Error('paused action ran');});
    ensure(held.kind==='held','soft quota not enforced');
    return {bytes:result.status.bytes,files:result.status.files};
  }finally{
    try{await release?.();}finally{await backend.close();}
  }
}

module.exports=class extends Plugin {
  async onload(){
    try{
      const adapter=this.app.vault.adapter;
      ensure(this.manifest.id===pluginId&&(await adapter.stat(markerPath))?.size<2048,'isolated marker missing');
      this.marker=JSON.parse(await adapter.read(markerPath));
      ensure(this.marker.version===1&&this.marker.isolated===true&&/^[a-f0-9]{32}$/.test(this.marker.suite),'isolated marker invalid');
    }catch{
      new Notice('SYNC-A3 探针需要独立测试库标记');
      return;
    }
    this.addCommand({id:'open',name:'打开 SYNC-A3 本地工作检查',callback:()=>this.panel()});
    this.addRibbonIcon('test-tube','SYNC-A3 本地工作检查',()=>this.panel());
  }
  panel(){
    const panel=new Modal(this.app);
    panel.onOpen=()=>{
      const content=panel.contentEl;
      content.createEl('h2',{text:'SYNC-A3 本地工作检查'});
      const summary=content.createEl('p',{text:'点击运行。完成首次检查后，完全退出 Obsidian 再重开复查。'});
      const list=content.createEl('ul');
      const button=content.createEl('button',{text:'运行并导出报告'});
      button.onclick=async()=>{
        if(this.running)return;
        this.running=true;
        button.disabled=true;
        summary.setText('检查中…');
        list.empty();
        try{
          const report=await this.check();
          summary.setText(`通过 ${report.passed} / 失败 ${report.failed} / 待重开 ${report.pending}`);
          for(const row of report.checks)list.createEl('li',{text:(row.passed===null?'– ':row.passed?'✓ ':'✗ ')+row.name});
          content.createEl('p',{text:report.filename});
        }catch(error){summary.setText(String(error.message||error).slice(0,160));}
        finally{button.disabled=false;this.running=false;}
      };
    };
    panel.open();
  }
  async check(){
    this.launch??=random();
    const run=random(),vault=this.marker.suite,checks=[];
    const platform=Platform.isMobile?'mobile':'PC';
    const report={probe:2,run,suite:vault,build:PROBE_BUILD,platform,obsidian:apiVersion,checks};
    async function check(name,fn){
      try{
        const detail=await fn();
        checks.push({name,passed:detail?.pending?null:true,...(detail?{detail}:{})});
      }catch(error){
        checks.push({name,passed:false,error:String(error.message||error).slice(0,160)});
        throw error;
      }
    }
    let work,observation;
    try{
      await check('禁用连接后打开签名 IndexedDB 日志',async()=>{
        work=await openWork(this.app,vault);
        const {lifecycle,host}=work;
        const initial=await lifecycle.open();
        if(initial.status==='ready')await lifecycle.disable();
        ensure((await host.open()).status==='local-ready','local session unavailable');
        ensure(lifecycle.state().connection.enabled===false,'connection enabled');
      });
      const {lifecycle,host,installation}=work;
      const expectedLayout=await editedLayout();
      let before;
      await check('完全重开后读回此前保存的设置和布局',async()=>{
        before=await host.view();
        const prior=this.app.loadLocalStorage(observationKey);
        if(!prior||prior.launch===this.launch)return {pending:true};
        ensure(prior.installation===installation&&prior.receipt===before.acceptedFingerprint,'private identity or receipt changed');
        ensure(before.kind==='local-view'&&before.layoutSource==='local-draft'&&before.data.settings.language==='zh'&&before.data.ui.legend==='true','prior saved data missing');
        ensure(same(before.data.layoutOverrides,expectedLayout),'saved geometry changed');
        return {priorRun:prior.run};
      });
      await check('本地恢复草稿并保存设置与界面偏好',async()=>{
        if(before.layoutSource!=='local-draft'){
          const preview=value(await host.prepareRestore({settings:{language:'zh'},layoutOverrides:expectedLayout}));
          const staged=value(await host.applyRestore(preview.token));
          ensure(staged.kind==='restore-staged','restore draft missing');
          ensure(value(await host.saveSettings(staged.settingsId)).kind==='saved','settings save failed');
        }else if(before.settingsDraft){
          ensure(value(await host.saveSettings(before.settingsDraft.id)).kind==='saved','interrupted settings save failed');
        }
        ensure(value(await host.saveUi('legend',true)).kind==='saved','UI save failed');
        const view=await host.view();
        ensure(view.kind==='local-view'&&view.layoutSource==='local-draft'&&same(view.data.layoutOverrides,expectedLayout),'geometry missing');
      });
      await check('兼容文件写入及摘要校验',async()=>{
        const destination=await openIndexedDbSyncStore({installation,vault:random()});
        try{
          ensure((await host.exportCompatibility({destination,id:run})).kind==='exported','export incomplete');
          const data=await readCompatibilityExport({source:destination,id:run});
          ensure(data.settings.language==='zh'&&data.ui.legend==='true'&&same(data.layoutOverrides,expectedLayout),'export lost saved data');
        }finally{await destination.close();}
      });
      await check('再启用保留本地草稿，共享读写为零',async()=>{
        ensure((await lifecycle.enable(vault)).status==='ready','enable failed');
        await lifecycle.disable();
        await host.open();
        const view=await host.view();
        ensure(view.layoutSource==='local-draft'&&view.acceptedFingerprint===before.acceptedFingerprint,'enable changed local authority');
        ensure(work.sharedCalls()===0,'shared I/O occurred');
        observation={installation,receipt:view.acceptedFingerprint,run,launch:this.launch};
      });
      await check('实际 IndexedDB 清点与软硬容量限制',()=>verifyCapacity(installation));
    }catch(error){report.blocked=String(error.message||error).slice(0,160);}
    finally{
      if(work){
        try{
          const status=work.lifecycle.state().status;
          if(status.startsWith('local-')||['ready','paused','join-required'].includes(status))await work.lifecycle.disable();
        }
        catch(error){checks.push({name:'释放本地会话',passed:false,error:String(error.message||error).slice(0,160)});}
      }
    }
    report.passed=checks.filter(row=>row.passed===true).length;
    report.failed=checks.filter(row=>row.passed===false).length;
    report.pending=checks.filter(row=>row.passed===null).length;
    if(observation&&report.failed===0&&!report.blocked)this.app.saveLocalStorage(observationKey,observation);
    report.filename='SYNC-A3-local-work-'+platform+'-'+run+'.json';
    await this.app.vault.create(report.filename,JSON.stringify(report,null,2)+'\n');
    return report;
  }
};
