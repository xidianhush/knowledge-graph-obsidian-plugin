const {Plugin,Notice,Platform,apiVersion}=require('obsidian');
const {capacityPluginId,capacityVaultName,capacityLimits,capacityFixtures,measureCapacityScan,sha256}=
 loadProbeModule('scripts/sync-a6-capacity-fixture.mjs');

module.exports=class CapacityProbe extends Plugin{
 async onload(){
  const state=await this.loadData();
  if(this.manifest.id!==capacityPluginId||state?.suite!==PROBE_BUILD.suite||
   !['PC','iPad'].includes(state.role)||this.app.vault.getName()!==capacityVaultName(state.role)){
   new Notice('A6 容量探针需要对应的独立测试库。');return;
  }
  this.state=state;this.adapter=this.app.vault.adapter;
  this.f=await capacityFixtures(state.suite,PROBE_BUILD.id);
  this.add('near','1 · 准备或确认近限额样本',()=>this.near());
  this.add('limits','2 · 离线测试边界并停在触顶',()=>this.limits());
  this.add('report','3 · 检查当前状态并导出',()=>this.report());
  this.add('recover','4 · 移出探针超额文件并复查',()=>this.recover());
 }
 add(id,label,run){
  this.addCommand({id,name:'A6 容量 · '+label,callback:async()=>{
   if(this.busy)return new Notice('容量检查正在运行，请等待结果。');
   this.busy=true;
   try{await run();}catch(error){
    this.state.lastError=error.message;
    try{await this.saveData(this.state);}catch{}
    new Notice('A6 容量检查未完成 · '+error.message+' · 请保留现场并运行检查导出',30000);
   }finally{this.busy=false;}
  }});
 }
 async mkdir(directory){
  let current='';
  for(const part of directory.split('/')){
   current=current?current+'/'+part:part;
   const stat=await this.adapter.stat(current);
   if(!stat)await this.adapter.mkdir(current);
   else if(stat.type!=='folder')throw Error('folder-occupied');
  }
 }
 async put(name,bytes){
  if(await this.adapter.stat(name))throw Error('probe-target-occupied');
  await this.adapter.writeBinary(name,bytes.buffer);
 }
 async measure(phase){
  new Notice('A6 容量 · '+phase+' · 正在检查，请保持前台',12000);
  const memory=()=>performance.memory?{usedJSHeapSize:performance.memory.usedJSHeapSize,
   totalJSHeapSize:performance.memory.totalJSHeapSize,jsHeapSizeLimit:performance.memory.jsHeapSizeLimit}:null;
  const before=memory(),visibilityStart=document.visibilityState;
  let last=performance.now(),ticks=0,maxTimerDelayMs=0;
  const timer=setInterval(()=>{const now=performance.now();maxTimerDelayMs=Math.max(maxTimerDelayMs,now-last-100);last=now;ticks++;},100);
  let result;
  try{result=await measureCapacityScan(this.adapter,this.state.suite);}
  finally{clearInterval(timer);maxTimerDelayMs=Math.max(maxTimerDelayMs,performance.now()-last-100,0);}
  const row={phase,at:new Date().toISOString(),...result,resources:{before,after:memory(),
   timerSamples:ticks,maxTimerDelayMs,visibilityStart,visibilityEnd:document.visibilityState}};
  this.state.runs.push(row);
  if(this.state.runs.length>32)this.state.runs.shift();
  await this.saveData(this.state);
  return row;
 }
 cleanNear(row){
  if(row.blocked||row.count!==1023||row.total!==this.f.nearBytes||row.fingerprint!==this.f.fingerprint||
   row.recognized.length!==1||row.recognized[0]!==PROBE_BUILD.id)throw Error('near-sample-mismatch');
 }
 async near(){
  if(this.state.stage!=='fresh'&&this.state.stage!=='seeding')throw Error('stage-requires-report-or-recovery');
  if(this.state.role==='PC'){
   const seedStart=performance.now();let newFiles=0,existingFiles=0;
   this.state.stage='seeding';await this.saveData(this.state);
   await this.mkdir(this.f.directory);
   const allowed=new Set(this.f.near);
   const listing=await this.adapter.list(this.f.directory);
   if(listing.folders.length||listing.files.some(name=>!allowed.has(name)))throw Error('unexpected-seed-file');
   for(const [i,name] of this.f.near.entries()){
    if(await this.adapter.stat(name)){
     if(await sha256(new Uint8Array(await this.adapter.readBinary(name)))!==this.f.normalHash)throw Error('seed-bytes-changed');
     existingFiles++;
    }else{await this.put(name,this.f.normal);newFiles++;}
    if(i%128===0)new Notice('A6 生成合成文件 '+(i+1)+'/1023',5000);
   }
   this.state.generation={elapsedMs:performance.now()-seedStart,newFiles,existingFiles,bytesWritten:newFiles*this.f.normal.length};
  }
  const row=await this.measure('near');this.cleanNear(row);
  this.state.reference={fingerprint:row.fingerprint,count:row.count,total:row.total};
  this.state.stage='near';this.state.lastError=null;await this.saveData(this.state);await this.report(row);
 }
 async archive(item){
  const source=await this.adapter.stat(item.name);
  if(!source)return;
  const hash=await sha256(item.bytes);
  if(source.type!=='file'||source.size!==item.bytes.length||
   await sha256(new Uint8Array(await this.adapter.readBinary(item.name)))!==hash)throw Error('extra-bytes-changed');
  const directory=this.manifest.dir+'/held';await this.mkdir(directory);
  let pending;
  for(const row of this.state.archives){
   if(row.source===item.name&&!await this.adapter.stat(row.name)){pending=row;break;}
  }
  this.state.archiveSequence=(this.state.archiveSequence??0)+(pending?0:1);
  const to=pending?.name??directory+'/'+this.state.archiveSequence+'-'+item.name.split('/').at(-1);
  if(await this.adapter.stat(to))throw Error('archive-occupied');
  // Record the move intent before moving; reports/recovery verify either side.
  if(!pending)this.state.archives.push({source:item.name,name:to,size:item.bytes.length,sha256:hash});
  await this.saveData(this.state);
  await this.adapter.rename(item.name,to);
  if(await sha256(new Uint8Array(await this.adapter.readBinary(to)))!==hash)throw Error('archive-readback');
 }
 async limits(){
  if(!this.state.reference||this.state.stage!=='near')throw Error('confirm-near-first');
  this.cleanNear(await this.measure('before-boundaries'));
  this.state.stage='testing';await this.saveData(this.state);
  const [exact,count,total,oversized]=this.f.extra;
  await this.put(exact.name,exact.bytes);
  const at=await this.measure('exact-1024-and-32MiB');
  if(at.blocked||at.count!==1024||at.total!==capacityLimits.totalBytes)throw Error('exact-limit-unexpected');
  await this.archive(exact);
  await this.put(total.name,total.bytes);
  const bytes=await this.measure('total-plus-one-byte');
  if(bytes.error!=='attempt-file-budget'||bytes.io.readBytes>capacityLimits.totalBytes)throw Error('total-limit-unexpected');
  await this.archive(total);
  await this.put(oversized.name,oversized.bytes);
  const single=await this.measure('single-file-plus-one-byte');
  if(single.error!=='attempt-file-budget'||single.io.readCalls!==0)throw Error('single-limit-unexpected');
  await this.archive(oversized);
  await this.put(exact.name,exact.bytes);await this.put(count.name,count.bytes);
  const files=await this.measure('count-1025');
  if(files.error!=='attempt-file-budget'||files.io.readCalls!==0)throw Error('count-limit-unexpected');
  this.state.stage='over-count';this.state.lastError=null;await this.saveData(this.state);await this.report(files);
 }
 async recover(){
  if(!this.state.reference)throw Error('no-near-reference');
  for(const item of this.f.extra)await this.archive(item);
  const row=await this.measure('recovered');this.cleanNear(row);
  this.state.stage='recovered';this.state.lastError=null;
  await this.saveData(this.state);await this.report(row);
 }
 async report(existing){
  const final=existing??await this.measure('manual-'+this.state.stage);
  const archives=[];
  for(const row of this.state.archives){
   const stat=await this.adapter.stat(row.name);
   archives.push({...row,preserved:stat?.type==='file'&&stat.size===row.size&&
    await sha256(new Uint8Array(await this.adapter.readBinary(row.name)))===row.sha256});
  }
  const listing=await this.adapter.stat(this.f.directory)?await this.adapter.list(this.f.directory):{files:[],folders:[]};
  const report={version:1,suite:this.state.suite,role:this.state.role,stage:this.state.stage,
   obsidian:apiVersion,mobile:Platform.isMobile,nutstore:this.app.plugins?.manifests?.['nutstore-sync']?.version??null,
   buildSha256:await sha256(new Uint8Array(await this.adapter.readBinary(this.manifest.dir+'/main.js'))),
   limits:capacityLimits,reference:this.state.reference??null,syntheticLocalDraft:this.state.syntheticLocalDraft,
   generation:this.state.generation??null,
   fixture:{normalHash:this.f.normalHash,normalSize:this.f.normal.length,nearCount:1023,nearBytes:this.f.nearBytes,
    expectedNearFingerprint:this.f.fingerprint},final,runs:this.state.runs,archives,
   inventory:{files:listing.files.length,folders:listing.folders.length,
    namesHash:await sha256(new TextEncoder().encode(JSON.stringify(listing.files.sort())))},
   lastError:this.state.lastError??null,
   scope:'Shared-file scanner only; synthetic local marker is not production draft/receipt. Heap API may be unavailable; timer delay is not FPS or OS memory.'};
  const file='SYNC-A6-Capacity-'+this.state.role+'-'+Date.now()+'.json';
  await this.app.vault.create(file,JSON.stringify(report,null,2)+'\n');
  new Notice('A6 容量报告已导出 · '+this.state.stage+' · '+(final.blocked?'已阻塞':'无阻塞')+' · '+file,30000);
 }
};
