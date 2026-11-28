// Pristine G6 synthetic multi-operation history; no device/private state.
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {prepareUnifiedCandidate} from './prepare_sync_unified_candidate.mjs';
import {packSchema3Operation} from '../src/sync/wire-prototype.mjs';
import {cloneBoundedSyncJson} from '../src/sync/causal-prototype.mjs';
import {planSchema3Transactions} from '../src/sync/layout-prototype.mjs';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
const canon=v=>JSON.stringify(cloneBoundedSyncJson(v)),sha=s=>createHash('sha256').update(s).digest('hex'),id=()=>randomBytes(16).toString('hex');
const prep=await prepareUnifiedCandidate(),vault=id(),plugin='.obsidian/plugins/'+prep.pluginId+'/';
const pc=JSON.parse(await fs.readFile(path.join(prep.paths.PC,plugin+'data.json'),'utf8'));
const files=await Promise.all(['A','B'].map(async n=>({path:'Synthetic/'+n+'.md',text:await fs.readFile(path.join(prep.paths.PC,'Synthetic/'+n+'.md'),'utf8')}))),config={include:['Synthetic/**']};
const graph=()=>buildGraph({files,config}),createModel=()=>{const g=graph();return createLayoutModel(g.nodes,g.meta.layout_root_radius);};
const g=graph(),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius),n=g.nodes.find(n=>n.path==='Synthetic/B.md'&&n.title==='Fourth');e.begin(n.id);e.move(n.x+35,n.y+5);e.commit();let second;const key=m.groupKey(n.id);await createLayoutStore(null,async s=>second=s).command({},'edit',key,m.capture(key));
const layout={...pc.layoutOverrides,groups:{...pc.layoutOverrides.groups,...second.groups},structures:{...pc.layoutOverrides.structures,...second.structures}},records=[],shared={};
const keys=Object.keys(layout.groups);if(keys.length!==2)throw Error('g6-two-groups');
let parent=null;
for(let i=0;i<1024;i++){
 const changes=i===0?keys.map(group=>[group,layout.groups[group]]):[[keys[i%2],structuredClone(layout.groups[keys[i%2]])]];
 if(i)changes[0][1].points[0].x+=(i%17)*0.00001;
 const op=packSchema3Operation({vault,id:id(),parents:parent?[parent]:[],changes:changes.map(([group,record])=>({group,value:{schemaVersion:3,record,structures:record.note?{[record.note]:layout.structures[record.note]}:{}}}))});parent=op.id;records.push(op);
 const raw=canon(op),name=op.id+'.'+sha(raw)+'.'+id()+'.json';shared['Knowledge Map Sync/attempts-v1/'+vault+'/ops/'+name]=raw;
}
const plan=planSchema3Transactions(records,{vault,baseline:{schemaVersion:3,revision:0,groups:{},structures:{}},createModel});if(plan.status!=='candidate')throw Error('g6-seed-projection');
prep.phase='G6';prep.remote='/KM-G6-'+randomBytes(4).toString('hex');prep.synthetic={vault,operations:records.length,groups:2,physicalFiles:1024,sharedBytes:Object.values(shared).reduce((n,s)=>n+Buffer.byteLength(s),0),snapshotSha256:sha(canon(plan.proposal))};
const guide=(await fs.readFile('docs/SYNC_G6_GUIDE.md','utf8')).replaceAll('{{REMOTE}}',prep.remote).replaceAll('{{VAULT}}',vault);
for(const role of ['PC','iPad']){
 const root=path.join(prep.out,'Knowledge Map G6 '+role);await fs.rename(prep.paths[role],root);prep.paths[role]=root;
 const data=JSON.parse(await fs.readFile(path.join(root,plugin+'data.json'),'utf8'));if(role==='PC')data.layoutOverrides=plan.proposal;
 const updates={'START-HERE.md':guide,[plugin+'data.json']:JSON.stringify(data,null,2)+'\n',...(role==='PC'?shared:{})};
 for(const [name,text]of Object.entries(updates)){await fs.mkdir(path.dirname(path.join(root,name)),{recursive:true});await fs.writeFile(path.join(root,name),text);prep.digests[role][name]=sha(text);}
}
prep.scope='New synthetic two-group history with 1024 DISTINCT operation IDs/bodies, no duplicate padding, no App identity/receipt/private ledger/profile/credentials. PC seeds shared files, iPad receives them using a new remote folder.';
await fs.writeFile(path.join(prep.out,'preparation.json'),JSON.stringify(prep,null,2)+'\n');console.log(JSON.stringify({out:prep.out,remote:prep.remote,synthetic:prep.synthetic,main:prep.pluginMainSha256}));
