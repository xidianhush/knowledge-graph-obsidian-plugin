import {randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {graphHostBundle} from './build.mjs';
import {buildKnowledgeMapReceiveCandidate} from './build_sync_a3_probe.mjs';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const scenario=process.argv[2]??null;
if(scenario!==null&&!['Different','Same','Resolve','OnboardEmpty','OnboardBoth'].includes(scenario))throw Error('Unsupported isolated layout scenario');
const onboarding=['OnboardEmpty','OnboardBoth'].includes(scenario);
const base=path.join(root,'.local/sync-016/a4/native');
const suite=randomBytes(16).toString('hex'),remote=(onboarding?'/KM-J5-':scenario==='Resolve'?'/KM-R5-':scenario?'/KM-A6-':'/KM-L4-')+suite.slice(0,8);
const id='knowledge-map-a4-attempt-layout';
const {main,pluginMainSha256}=buildKnowledgeMapReceiveCandidate(root,graphHostBundle,{attemptSuite:suite});
const json=value=>JSON.stringify(value,null,2)+'\n';
const guide=await fs.readFile(path.join(root,'docs',onboarding?'SYNC_A5_ONBOARDING_GUIDE.md':scenario==='Resolve'?'SYNC_A5_RESOLUTION_GUIDE.md':scenario?'SYNC_A6_CONCURRENT_GUIDE.md':'SYNC_A4_LAYOUT_CANDIDATE_GUIDE.md'),'utf8');
await fs.mkdir(base,{recursive:true});
const out=await fs.mkdtemp(path.join(base,scenario?'a6-'+scenario.toLowerCase()+'-':'layout-attempt-')),paths={};
const plugin='.obsidian/plugins/'+id+'/';
const notes={'Synthetic/A.md':'# First\nSynthetic first heading.\n# Second\nSynthetic second heading.\n',
 'Synthetic/B.md':'# Third\nSynthetic third heading.\n# Fourth\nSynthetic fourth heading.\n'};
async function oldLayout(dx){
 const g=buildGraph({files:Object.entries(notes).map(([path,text])=>({path,text})),config:{include:['Synthetic/**']}});
 const m=createLayoutModel(g.nodes,g.meta.layout_root_radius),e=createLayoutEditor(g.nodes,g.meta.layout_root_radius);
 const node=g.nodes.find(n=>n.path==='Synthetic/A.md'&&n.title==='Second');
 if(e.begin(node.id)!==null)throw Error('fixture-edit');e.move(node.x+dx,node.y+5);e.commit();let result;
 const group=m.groupKey(node.id);await createLayoutStore(null,async value=>result=value).command({},'edit',group,m.capture(group));return result;
}
for(const role of ['PC','iPad']){
  const vault=paths[role]=path.join(out,(onboarding?'Knowledge Map A5 '+scenario:scenario?'Knowledge Map A6 '+scenario:'Knowledge Map A4 Layout')+' '+role);
  const files={
    'START-HERE.md':guide.replaceAll('{{REMOTE}}',remote).replaceAll('{{SCENARIO}}',scenario??'Sequential'),
    'SYNC-A4-ATTEMPT-LAYOUT.json':json({version:1,isolated:true,suite,...(scenario?{scenario}:{})}),
    ...notes,
    '.obsidian/app.json':json({safeMode:false}),
    '.obsidian/community-plugins.json':json([id]),
    '.obsidian/core-plugins.json':json(['file-explorer','command-palette']),
    [plugin+'manifest.json']:json({id,name:'Knowledge Map A4 Layout Candidate',version:'0.1.0',minAppVersion:'1.8.7',
      description:'Isolated layout synchronization candidate.',author:'Hush',isDesktopOnly:false}),
    [plugin+'main.js']:main,
    [plugin+'styles.css']:await fs.readFile(path.join(root,'dist/styles.css')),
    [plugin+'data.json']:json({settings:{language:'zh'},pipeline:{config:{include:['Synthetic/**']}},
      ...(onboarding?{ui:{legend:'true'},onboardingFixture:{role,preserve:'synthetic-only'},
        ...((role==='PC'||scenario==='OnboardBoth')?{layoutOverrides:await oldLayout(role==='PC'?-80:80)}:{})}:{})}),
  };
  for(const [relative,value] of Object.entries(files)){
    const file=path.join(vault,relative);
    await fs.mkdir(path.dirname(file),{recursive:true});
    await fs.writeFile(file,value);
  }
}
const preparation={out,paths,suite,remote,pluginMainSha256,...(scenario?{scenario}:{})};
await fs.writeFile(path.join(out,'preparation.json'),json(preparation));
console.log(json(preparation));
