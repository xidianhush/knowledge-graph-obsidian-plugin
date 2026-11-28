// SYNC-UX-A3 clickable sketch: the real simplified easy-sync panel mounted
// against real hosts pre-driven into four states (off / prepared / normal /
// conflict). A top switcher, language, theme and width controls let the user
// click through and confirm visuals and copy before formal settings integration.
import {createUnifiedSyncHost} from '/src/sync/obsidian-unified-host.mjs';
import {createAttemptHistory} from '/src/sync/attempt-history-prototype.mjs';
import {mountObsidianEasySettings} from '/src/sync/obsidian-easy-settings.mjs';
import {openIndexedDbSyncStore} from '/src/sync/indexeddb-store-prototype.mjs';
import {buildGraph} from '/dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '/dist/graph-core.mjs';
import {cloneBoundedSyncJson} from '/src/sync/causal-prototype.mjs';
import {packSchema3Operation} from '/src/sync/wire-prototype.mjs';
import {syncContentHash} from '/src/sync/persistence-prototype.mjs';
import {DEFAULT_LAYOUT_VAULT_ID} from '/src/sync/default-layout-bootstrap.mjs';
const graph=buildGraph({files:[{path:'Synthetic/A.md',text:'# First\nBody\n# Second\nBody'}],config:{include:['Synthetic/**']}});
const model=()=>{const current=structuredClone(graph);return createLayoutModel(current.nodes,current.meta.layout_root_radius);};
async function layout(dx){const g=buildGraph({files:[{path:'Synthetic/A.md',text:'# First\nBody\n# Second\nBody'}],config:{include:['Synthetic/**']}}),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),editor=createLayoutEditor(g.nodes,g.meta.layout_root_radius),node=g.nodes.find(n=>n.title==='Second');editor.begin(node.id);editor.move(node.x+dx,node.y+5);editor.commit();let result;const key=m.groupKey(node.id);await createLayoutStore(null,async s=>result=s).command({},'edit',key,m.capture(key));return result;}
const left=await layout(-20),right=await layout(20),sources=new Map(),hosts=new Map(),adapters=new Map();
function makeAdapter(){const files=new Map(),folders=new Set();return {files,folders,async stat(p){return files.has(p)?{type:'file',size:files.get(p).byteLength}:folders.has(p)?{type:'folder',size:0}:null;},async list(p){const child=n=>n.startsWith(p+'/')&&!n.slice(p.length+1).includes('/');return {files:[...files.keys()].filter(child),folders:[...folders].filter(child)};},async readBinary(p){return files.get(p);},async read(p){return new TextDecoder().decode(files.get(p));},async mkdir(p){folders.add(p);},async writeBinary(p,b){files.set(p,b.slice(0));}};}
for(const [name,fn]of Object.entries({createEl(tag,opts={}){const el=document.createElement(tag);if(opts.text)el.textContent=opts.text;if(opts.cls)el.className=opts.cls;for(const [key,value]of Object.entries(opts.attr??{}))el.setAttribute(key,value);this.append(el);return el;},createDiv(){return this.createEl('div');},empty(){this.replaceChildren();}}))Object.defineProperty(HTMLElement.prototype,name,{value:fn,configurable:true});
class Modal{constructor(){this.modalEl=document.createElement('div');this.modalEl.className='modal';this.contentEl=document.createElement('div');this.modalEl.append(this.contentEl);}open(){document.body.append(this.modalEl);this.key=e=>{if(e.key==='Escape')this.close();};document.addEventListener('keydown',this.key);this.onOpen();}close(){if(!this.modalEl.isConnected)return;this.onClose();document.removeEventListener('keydown',this.key);this.modalEl.remove();}}
const backupFiles=new Map(),backupFolders=new Set();
const backupVault={configDir:'.obsidian',getAbstractFileByPath:p=>backupFiles.has(p)?{path:p}:backupFolders.has(p)?{path:p,children:[]}:null,async read(f){return backupFiles.get(f.path);},async create(p,s){if(backupFiles.has(p))throw Error('exists');backupFiles.set(p,s);return {path:p};},async createFolder(p){backupFolders.add(p);}};
async function open(name,local){if(hosts.has(name))return hosts.get(name);sources.set(name,{settings:{language:'zh'},ui:{keep:name},layoutOverrides:local});
 const adapter=makeAdapter();adapters.set(name,adapter);
 const app={loadLocalStorage:key=>JSON.parse(localStorage.getItem(name+':'+key)??'null'),saveLocalStorage(key,value){localStorage.setItem(name+':'+key,JSON.stringify(value));}};
 const locks={request:(key,...args)=>navigator.locks.request(name+':'+key,...args)};
 const h=await createUnifiedSyncHost({app,pluginId:'knowledge-map-sync-unified',adapter,locks,readSource:async()=>sources.get(name),saveUnjoined:async v=>sources.set(name,v),createStore:createLayoutStore,validateSettings:window.validateGraphSettings,openBackend:openIndexedDbSyncStore,getGraph:()=>({isCurrent:()=>true,hidden:false,createModel:model}),getEpoch:()=>0,checkpoint:async()=>{}});
 hosts.set(name,h);return h;}
async function seedShared(name,vault,snapshot,opId){const adapter=adapters.get(name);const changes=Object.entries(snapshot.groups).map(([group,record])=>({group,value:{schemaVersion:3,record,structures:record.note?{[record.note]:snapshot.structures[record.note]}:{}}}));const operation=packSchema3Operation({vault,id:opId,parents:[],changes}),text=JSON.stringify(cloneBoundedSyncJson(operation)),history=createAttemptHistory(adapter,vault);const name2=await history.allocate(operation.id,await syncContentHash(text),[]);await history.write(name2,text);return operation;}
async function collideShared(name){const h=hosts.get(name),adapter=adapters.get(name);const hist=createAttemptHistory(adapter,h.state().selected.vault),op=structuredClone((await hist.scan()).records[0]);op.changes[0].value.points[0].x+=.01;const body=JSON.stringify(cloneBoundedSyncJson(op)),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body))),v=>v.toString(16).padStart(2,'0')).join('');await hist.write(await hist.allocate(op.id,hash,[]),body);}
// Drive four demo hosts into their target states once.
const idle=await open('demo-idle',null);
const ready=await open('demo-ready',null);await ready.startEasySync();await ready.settled();
const active=await open('demo-active',null);await seedShared('demo-active',DEFAULT_LAYOUT_VAULT_ID,left,'a'.repeat(32));await active.startEasySync();await active.settled();
const conflict=await open('demo-conflict',null);await conflict.startEasySync();await conflict.saveLayout(right);await conflict.settled();await collideShared('demo-conflict');await conflict.receive();await conflict.settled();
const draft=await open('demo-draft',null);await seedShared('demo-draft',DEFAULT_LAYOUT_VAULT_ID,left,'b'.repeat(32));await draft.startEasySync();await draft.stopEasySync();await draft.saveLayout(right);await draft.startEasySync();await draft.settled();
const demos=[['idle','未开启 / Off',idle],['ready','准备完成 / Prepared',ready],['active','正常使用 / Normal',active],['conflict','冲突 / Conflict',conflict],['draft','待审草稿 / Draft',draft]];
const panels=new Map(),stage=document.getElementById('settings');
for(const [key,,h]of demos){const box=document.createElement('div');box.dataset.demoBox=key;box.hidden=true;stage.append(box);
 panels.set(key,mountObsidianEasySettings({container:box,app:{vault:backupVault},host:h,Modal,t:(...args)=>window.kgT(...args),onCheck:()=>h.receive()}));}
let current='idle';
function show(key){current=key;for(const [k,box]of [...stage.children].map(b=>[b.dataset.demoBox,b]))box.hidden=k!==key;}
show('idle');
window.qaEasy={demos:demos.map(([k,label])=>({key:k,label})),current:()=>current,
 show(key){show(key);return panels.get(key).state();},
 state:()=>hosts.get('demo-'+current).state(),easy:()=>hosts.get('demo-'+current).easySyncState(),
 panelState:()=>panels.get(current).state(),
 async settled(){await panels.get(current).settled();await hosts.get('demo-'+current).settled();},
 language(lang){window.kgI18nSetPreference(lang);for(const p of panels.values())p.render();return current;},
 async toggle(){const h=hosts.get('demo-'+current);const on=h.easySyncState().authorization.enabled;await (on?h.stopEasySync():h.startEasySync());await h.settled();panels.get(current).render();return h.easySyncState();},
 async action(name){const b=document.querySelector(`[data-demo-box="${current}"] [data-easy-action="${name}"]`);if(!b||b.disabled)throw Error('Missing/disabled action '+name);b.click();await panels.get(current).settled();return panels.get(current).state();},
 status:()=>document.querySelector(`[data-demo-box="${current}"] [data-easy-status]`)?.dataset.easyStatus??null,
};
window.qaEasyReady=true;
