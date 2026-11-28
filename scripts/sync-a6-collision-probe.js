const {Plugin,Notice,Platform,apiVersion}=require('obsidian');
const {collisionPluginId,collisionVaultName,collisionFixtures,inspectCollisionSnapshot,sha256,toHex}=
  loadProbeModule('scripts/sync-a6-collision-fixture.mjs');

module.exports=class CollisionProbe extends Plugin{
  async onload(){
    const state=await this.loadData();
    if(this.manifest.id!==collisionPluginId||state?.suite!==PROBE_BUILD.suite||
      !['PC','iPad'].includes(state.role)||this.app.vault.getName()!==collisionVaultName(state.role)){
      new Notice('A6 同路径探针需要对应的独立测试库。');return;
    }
    this.state=state;
    this.adapter=this.app.vault.adapter;
    this.fixtures=await collisionFixtures(state.suite,PROBE_BUILD.id,PROBE_BUILD.nonce);
    this.command('baseline','1 · 确认同步基线',()=>this.baseline());
    this.command('edit','2 · 离线改写同路径并导出',()=>this.edit());
    this.command('report','3 · 检查实际文件并导出',()=>this.exportReport());
  }
  command(id,label,action){
    this.addCommand({id,name:'A6 同路径 · '+label,callback:async()=>{
      if(this.busy)return new Notice('A6 正在读写，请等待提示。');
      this.busy=true;
      try{await action();}catch(error){new Notice('A6 · '+error.message,20000);}
      finally{this.busy=false;}
    }});
  }
  async capture(){
    const {directory,bodies}=this.fixtures;
    const files=[],entries=new Map();
    const listing=await this.adapter.list(directory);
    if(listing.files.length+listing.folders.length>32)throw Error('目录超过 32 项，请保留现场');
    for(const name of listing.folders.sort())files.push({name,kind:'folder'});
    let total=0;
    for(const name of listing.files.sort()){
      if(!name.startsWith(directory+'/')||name.slice(directory.length+1).includes('/'))throw Error('文件超出取证范围');
      const stat=await this.adapter.stat(name);
      if(!stat||stat.type!=='file'||!Number.isSafeInteger(stat.size)||stat.size<0||
        stat.size>4096||total+stat.size>65536){
        files.push({name,kind:'skipped',size:stat?.size??null});continue;
      }
      const bytes=new Uint8Array(await this.adapter.readBinary(name));
      if(bytes.length!==stat.size)throw Error('盘点时文件发生变化，请等待同步完成后再检查');
      total+=bytes.length;
      entries.set(name,bytes);
      files.push({name,kind:'file',size:bytes.length,sha256:await sha256(bytes),hex:toHex(bytes),
        body:Object.keys(bodies).find(label=>toHex(bodies[label])===toHex(bytes))??'other'});
    }
    let analysis;
    try{analysis=await inspectCollisionSnapshot(this.state.suite,entries);}
    catch(error){analysis={blocked:true,error:error.message};}
    if(files.some(row=>row.kind!=='file'))analysis={...analysis,blocked:true,incompleteInventory:true};
    return {at:new Date().toISOString(),files,analysis};
  }
  async baseline(){
    if(this.state.edit)throw Error('本端已改写，不能重新确认基线');
    const snapshot=await this.capture();
    if(snapshot.files.length!==1||snapshot.files[0].name!==this.fixtures.target||
      snapshot.files[0].body!=='Baseline'||snapshot.analysis.blocked)throw Error('当前文件不是唯一完整基线，请导出报告');
    this.state.baseline=snapshot;
    await this.saveData(this.state);
    new Notice('A6 基线已确认。两端确认后，请实际断网再改写。',15000);
  }
  async edit(){
    if(!this.state.baseline||this.state.edit)throw Error('先确认基线，离线改写每端只执行一次');
    const snapshot=await this.capture();
    if(snapshot.files.length!==1||snapshot.files[0].name!==this.fixtures.target||snapshot.files[0].body!=='Baseline'){
      throw Error('基线已变化，请导出报告并保留现场');
    }
    const bytes=this.fixtures.bodies[this.state.role];
    await this.adapter.writeBinary(this.fixtures.target,bytes.buffer);
    this.state.edit=await this.capture();
    if(this.state.edit.files[0]?.body!==this.state.role)throw Error('写后读回不匹配，请保留现场');
    await this.saveData(this.state);
    await this.exportReport();
  }
  async exportReport(){
    const final=await this.capture();
    const build=new Uint8Array(await this.adapter.readBinary(this.manifest.dir+'/main.js'));
    const report={version:1,suite:this.state.suite,role:this.state.role,target:this.fixtures.target,
      obsidian:apiVersion,mobile:Platform.isMobile,
      nutstore:this.app.plugins?.manifests?.['nutstore-sync']?.version??null,buildSha256:await sha256(build),
      baseline:this.state.baseline??null,edit:this.state.edit??null,final};
    const file='SYNC-A6-Collision-'+this.state.role+'-'+Date.now()+'.json';
    await this.app.vault.create(file,JSON.stringify(report,null,2)+'\n');
    new Notice('A6 报告已导出 · 文件 '+final.files.length+' · '+
      (final.analysis.blocked?'文件扫描已阻塞':'文件扫描无阻塞')+' · '+file,20000);
  }
};
