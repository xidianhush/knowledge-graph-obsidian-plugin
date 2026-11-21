import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash} from 'node:crypto';
import {graphHostBundle} from './build.mjs';
import {buildKnowledgeMapUnifiedCandidate} from './build_sync_a3_probe.mjs';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),pluginId='knowledge-map-sync-unified',plugin='.obsidian/plugins/'+pluginId+'/';
export const UNIFIED_DELIVERY_FILES=Object.freeze(['START-HERE.md','Synthetic/A.md','Synthetic/B.md','.obsidian/app.json','.obsidian/community-plugins.json','.obsidian/core-plugins.json',...['manifest.json','main.js','styles.css','data.json'].map(p=>plugin+p)]);
const notes={'Synthetic/A.md':'# First\nSynthetic first heading.\n# Second\nSynthetic second heading.\n','Synthetic/B.md':'# Third\nSynthetic third heading.\n# Fourth\nSynthetic fourth heading.\n'};
const json=v=>JSON.stringify(v,null,2)+'\n',sha=b=>createHash('sha256').update(b).digest('hex');
async function oldLayout(){const g=buildGraph({files:Object.entries(notes).map(([path,text])=>({path,text})),config:{include:['Synthetic/**']}}),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius),n=g.nodes.find(n=>n.path==='Synthetic/A.md'&&n.title==='Second');if(e.begin(n.id)!==null)throw Error('fixture edit');e.move(n.x-80,n.y+5);e.commit();let result;const key=m.groupKey(n.id);await createLayoutStore(null,async s=>result=s).command({},'edit',key,m.capture(key));return result;}
export async function prepareUnifiedCandidate(){
 const base=path.join(root,'.local/sync-016/unified/u5');await fs.mkdir(base,{recursive:true});const out=await fs.mkdtemp(path.join(base,'pristine-')),remote='/KM-U5-'+randomBytes(4).toString('hex');
 const built=buildKnowledgeMapUnifiedCandidate(root,graphHostBundle),guide=(await fs.readFile(path.join(root,'docs/SYNC_GUIDE.md'),'utf8')).replaceAll('{{REMOTE}}',remote),paths={},digests={};
 const layout=await oldLayout(),manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
 for(const role of ['PC','iPad']){
  const vault=paths[role]=path.join(out,'Knowledge Map Unified '+role),files={'START-HERE.md':guide,...notes,'.obsidian/app.json':json({safeMode:false}),'.obsidian/community-plugins.json':json([pluginId]),'.obsidian/core-plugins.json':json(['file-explorer','command-palette']),[plugin+'manifest.json']:json({...manifest,id:pluginId,name:'Knowledge Map Sync Candidate',description:'Independent unified layout-sync candidate. Not a release.'}),[plugin+'main.js']:built.main,[plugin+'styles.css']:await fs.readFile(path.join(root,'dist/styles.css')),[plugin+'data.json']:json({settings:{language:'zh'},pipeline:{config:{include:['Synthetic/**']}},ui:{legend:'true'},...(role==='PC'?{layoutOverrides:layout}:{})})};
  digests[role]={};for(const [name,value]of Object.entries(files)){const file=path.join(vault,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,value);digests[role][name]=sha(Buffer.from(value));}
 }
 const preparation={version:1,out,paths,remote,pluginId,pluginMainSha256:built.pluginMainSha256,build:built.build,digests,allowlist:UNIFIED_DELIVERY_FILES,scope:'Pristine synthetic local layout only; no sync identity, acceptance, marker, profile, report or credentials.'};
 await fs.writeFile(path.join(out,'preparation.json'),json(preparation));return preparation;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await prepareUnifiedCandidate()));
