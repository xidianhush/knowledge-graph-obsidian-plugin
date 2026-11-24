// Build a fresh synthetic vault and a dedicated Obsidian profile for native QA.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {graphHostBundle} from './build.mjs';
import {buildKnowledgeMapReceiveCandidate} from './build_sync_a3_probe.mjs';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutEditor,createLayoutModel,createLayoutStore,decodeGraphPayload} from '../dist/graph-core.mjs';
import {packSchema3Operation} from '../src/sync/wire-prototype.mjs';
import {planSchema3Transactions} from '../src/sync/layout-prototype.mjs';
import {sharedOperationDirectory} from '../src/sync/obsidian-shared-history.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const nutstore=process.argv.includes('--nutstore');
const id='knowledge-map-sync-a4-receive',vaultName=nutstore?'Knowledge Map A4 Nutstore':'Knowledge Map A4 Receive';
const nextId=()=>crypto.randomBytes(16).toString('hex');
const suite=nextId(),operations=[nextId(),nextId()];
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const config={include:['Synthetic/**']};
const first={path:'Synthetic/Arrival.md',text:'# Before\nA synthetic heading.\n# Move me\nSynthetic arrival content.\n'};
const late={path:'Synthetic/Late.md',text:'# First\nSynthetic delayed content.\n# Late arrival\nSecond synthetic heading.\n'};
const initial=[first],complete=[first,late];
const empty={schemaVersion:3,revision:0,groups:{},structures:{}};
const build=files=>decodeGraphPayload(buildGraph({files,config}));
const model=files=>{const {nodes,meta}=build(files);return createLayoutModel(nodes,meta.layout_root_radius);};

async function change(files,title,delta){
  const {nodes,meta}=build(files),layoutModel=createLayoutModel(nodes,meta.layout_root_radius);
  const editor=createLayoutEditor(nodes,meta.layout_root_radius),node=nodes.find(n=>n.title===title);
  assert.ok(node);assert.equal(editor.begin(node.id),null);
  const before=[node.x,node.y];
  editor.move(node.x+delta,node.y+3);editor.commit();
  assert.notDeepEqual([node.x,node.y],before);
  const group=layoutModel.groupKey(node.id),record=layoutModel.capture(group);
  let snapshot;
  await createLayoutStore(null,async value=>{snapshot=value;}).command({},'edit',group,record);
  const stored=snapshot.groups[group],structures=stored.note?{[stored.note]:snapshot.structures[stored.note]}:{};
  return {group,value:{schemaVersion:3,record:stored,structures}};
}
const firstOp=packSchema3Operation({vault:suite,id:operations[0],parents:[],changes:[await change(initial,'Move me',10)]});
const secondOp=packSchema3Operation({vault:suite,id:operations[1],parents:[operations[0]],changes:[
  await change(complete,'Move me',15),await change(complete,'Late arrival',10),
]});
const plan=(files,ops)=>planSchema3Transactions(ops,{vault:suite,baseline:empty,createModel:()=>model(files)});
assert.equal(plan(initial,[firstOp]).status,'candidate');
assert.equal(plan(initial,[firstOp,secondOp]).status,'blocked');
assert.equal(Object.keys(plan(complete,[firstOp,secondOp]).proposal.groups).length,2);
assert.equal(plan(complete,[firstOp,secondOp]).status,'candidate');

const base=path.join(root,'.local/sync-016/a4/native');
fs.mkdirSync(base,{recursive:true});
const out=fs.mkdtempSync(path.join(base,nutstore?'transport-':'receive-')),vault=path.join(out,vaultName),profile=path.join(out,'profile');
const plugin='.obsidian/plugins/'+id+'/',bundle=buildKnowledgeMapReceiveCandidate(root,graphHostBundle);
const json=value=>JSON.stringify(value,null,2)+'\n';
function write(relative,value){const file=path.join(vault,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);}
const fixtures={first:JSON.stringify(firstOp)+'\n',second:JSON.stringify(secondOp)+'\n',note:late.text};
write('SYNC-A4-ISOLATED-TEST.json',json({version:1,isolated:true,suite,operations,
  digests:Object.fromEntries(Object.entries(fixtures).map(([name,text])=>[name,sha(text)]))}));
write('.obsidian/community-plugins.json',json([id]));
write('.obsidian/core-plugins.json',json(['file-explorer','command-palette']));
write('.obsidian/app.json',json({safeMode:false}));
write(plugin+'manifest.json',json({id,name:vaultName,version:'0.1.0',minAppVersion:'1.8.7',description:'Isolated read-only layout receiver probe.',author:'Hush',isDesktopOnly:false}));
write(plugin+'data.json',json({settings:{language:'zh'},pipeline:{config}}));
write(plugin+'main.js',bundle.main);
write(plugin+'styles.css',fs.readFileSync(path.join(root,'dist/styles.css')));
write(first.path,first.text);
write('A4 fixtures/first.txt',fixtures.first);
write('A4 fixtures/second.txt',fixtures.second);
write('A4 fixtures/late-note.txt',fixtures.note);
write(sharedOperationDirectory(suite)+'/A4-SAMPLE-FOLDER.txt','Synthetic A4 operations arrive here during the test.\n');
const guide=nutstore?'SYNC_A4_NUTSTORE_TEST_GUIDE.md':'SYNC_A4_RECEIVE_TEST_GUIDE.md';
write('START-HERE.md',fs.readFileSync(path.join(root,'docs',guide)));
fs.mkdirSync(profile);
fs.writeFileSync(path.join(profile,'obsidian.json'),json({vaults:{'a4receive0000001':{path:vault,ts:Date.now(),open:true}}}));
const preparation={out,vault,profile,suite,operations,pluginMainSha256:bundle.pluginMainSha256,provenance:bundle.provenance};
fs.writeFileSync(path.join(out,'preparation.json'),json(preparation));
console.log(JSON.stringify(preparation));
