// Build a new isolated, credential-free native capability vault. No existing vault reads.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildSyncA3Probe,buildSyncA3LocalWorkProbe,buildKnowledgeMapRecovery} from './build_sync_a3_probe.mjs';
import {graphHostBundle} from './build.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),base=path.join(root,'.local/sync-016/a3/native');fs.mkdirSync(base,{recursive:true});
const localWork=process.argv[2]==='--local-work';
const replay=process.argv[2]==='--replay';
const recovery=process.argv[2]==='--recovery';
const bundle=recovery?buildKnowledgeMapRecovery(root,graphHostBundle,{candidate:true}):
  localWork||replay?buildSyncA3LocalWorkProbe(root,{replay}):buildSyncA3Probe(root);
if(process.argv[2]==='--refresh'){
  const out=path.resolve(process.argv[3]||''),relative=path.relative(base,out);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('refresh outside native fixture');
  const result=JSON.parse(fs.readFileSync(path.join(out,'preparation.json'),'utf8'));if(result.out!==out||result.vault!==path.join(out,'Knowledge Map A3 Native'))throw Error('refresh fixture provenance');
  const marker=JSON.parse(fs.readFileSync(path.join(result.vault,'SYNC-A3-ISOLATED-TEST.json'),'utf8'));if(marker.suite!==result.suite||marker.isolated!==true)throw Error('refresh fixture marker');
  fs.writeFileSync(path.join(result.vault,'.obsidian/plugins/knowledge-map-sync-a3-native-probe/main.js'),bundle.main);Object.assign(result,{pluginMainSha256:bundle.pluginMainSha256,provenance:bundle.provenance});fs.writeFileSync(path.join(out,'preparation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exit(0);
}
const vaultName=recovery?'Knowledge Map A3 Recovery':replay?'Knowledge Map A3 Replay':localWork?'Knowledge Map A3 Local Work':'Knowledge Map A3 Native';
const id=recovery?'knowledge-map-sync-a3-recovery':replay?'knowledge-map-sync-a3-replay-probe':localWork?'knowledge-map-sync-a3-local-work-probe':'knowledge-map-sync-a3-native-probe';
const out=fs.mkdtempSync(path.join(base,recovery?'recovery-':replay?'replay-':localWork?'local-work-':'probe-')),vault=path.join(out,vaultName),profile=path.join(out,'profile'),plugin=path.join(vault,'.obsidian/plugins',id),suite=crypto.randomBytes(16).toString('hex');fs.mkdirSync(plugin,{recursive:true});fs.mkdirSync(profile);
fs.writeFileSync(path.join(plugin,'main.js'),bundle.main);
const write=(file,value)=>fs.writeFileSync(path.join(vault,file),JSON.stringify(value,null,2)+'\n');write('SYNC-A3-ISOLATED-TEST.json',{version:1,suite,isolated:true});
write('.obsidian/community-plugins.json',[id]);write('.obsidian/core-plugins.json',['file-explorer','command-palette']);write('.obsidian/app.json',{safeMode:false});write('.obsidian/plugins/'+id+'/manifest.json',{id,name:recovery?vaultName:vaultName+' Probe',version:'0.1.0',minAppVersion:'1.8.7',description:'Isolated local storage capability probe.',author:'Hush',isDesktopOnly:false});
write('.obsidian/plugins/'+id+'/data.json',{probe:1,suite,...(recovery?{settings:{language:'zh'},pipeline:{config:{include:['Synthetic/**']}}}:{})});
if(recovery){
  const {buildGraph}=await import('../dist/pipeline.mjs');
  const {createLayoutEditor,decodeGraphPayload}=await import('../dist/graph-core.mjs');
  const {createLayoutModel}=await import('../tests/fixtures/graph-core-0.0.10.mjs');
  const note='Synthetic/A.md',text='# First\nbody\n# Second\nother\n';
  const {nodes,meta}=decodeGraphPayload(buildGraph({files:[{path:note,text}],config:{include:['Synthetic/**']}}));
  const model=createLayoutModel(nodes,meta.layout_root_radius),editor=createLayoutEditor(nodes,meta.layout_root_radius);
  const node=nodes.find(row=>row.title==='Second');
  if(!node||editor.begin(node.id)!==null)throw Error('could not prepare legacy layout');
  editor.move(node.x+10,node.y+3);
  editor.commit();
  const key=model.groupKey(node.id),record=model.capture(key);
  if(!record)throw Error('legacy sample layout missing');
  fs.mkdirSync(path.join(vault,'Synthetic'));
  fs.writeFileSync(path.join(vault,note),text);
  fs.mkdirSync(path.join(vault,'Recovery samples'));
  write('Recovery samples/layout-schema2.json',{
    settingsVersion:1,settings:{language:'en'},pipeline:{config:{include:['Synthetic/**']}},
    layoutOverrides:{schemaVersion:2,revision:7,groups:{[key]:record}},
  });
  fs.copyFileSync(path.join(root,'dist/styles.css'),path.join(plugin,'styles.css'));
  fs.copyFileSync(path.join(root,'docs/SYNC_A3_RECOVERY_TEST_GUIDE.md'),path.join(vault,'START-HERE.md'));
}else if(replay){
  fs.copyFileSync(path.join(root,'docs/SYNC_A3_REPLAY_TEST_GUIDE.md'),path.join(vault,'START-HERE.md'));
}else if(localWork){
  fs.writeFileSync(path.join(vault,'START-HERE.md'),[
    '# SYNC-A3 本地工作原生检查',
    '打开独立测试库并启用 Knowledge Map A3 Local Work Probe。命令面板运行「打开 SYNC-A3 本地工作检查」。',
    '首次运行应显示通过 5 / 失败 0 / 待重开 1。完全退出 Obsidian 后，重新打开此测试库，再运行一次，应显示通过 6 / 失败 0 / 待重开 0。',
    '检查结束后，测试库根目录会生成 SYNC-A3-local-work-…json。发回第二次报告即可。此测试只需 Obsidian，无需坚果云。',
  ].join('\n\n')+'\n');
}else fs.copyFileSync(path.join(root,'docs/SYNC_A3_NATIVE_TEST_GUIDE.md'),path.join(vault,'START-HERE.md'));
fs.writeFileSync(path.join(profile,'obsidian.json'),JSON.stringify({vaults:{a3native000000001:{path:vault,ts:Date.now(),open:true}}}));const result={out,vault,profile,suite,pluginMainSha256:bundle.pluginMainSha256,provenance:bundle.provenance};fs.writeFileSync(path.join(out,'preparation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
