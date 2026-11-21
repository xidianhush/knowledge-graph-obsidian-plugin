// Contract fakes only. They do not establish native/iPad API guarantees.
const clone=x=>structuredClone(x);
export function testLockManager(){
  const locks=new Map();
  return {request(name,options,callback){
    let slot=locks.get(name);if(!slot){slot={holders:0,mode:null,waiting:[]};locks.set(name,slot);}
    const mode=options.mode??'exclusive',available=()=>!slot.holders||slot.mode==='shared'&&mode==='shared';
    if((!available()||slot.waiting.length)&&options.ifAvailable)return Promise.resolve().then(()=>callback(null));
    return new Promise((resolve,reject)=>{
      const release=()=>{slot.holders--;if(!slot.holders)slot.mode=null;while(slot.waiting.length&&(!slot.holders||slot.mode==='shared'&&slot.waiting[0].mode==='shared'))slot.waiting.shift().run();};
      const run=()=>{slot.holders++;slot.mode=mode;Promise.resolve().then(()=>callback({name,mode})).then(value=>{release();resolve(value);},error=>{release();reject(error);});};
      if(!available()||slot.waiting.length)slot.waiting.push({mode,run});else run();
    });
  }};
}
export function testLocalApp(){
  const entries=new Map();let writes=0,hook=null;
  return {loadLocalStorage:key=>entries.has(key)?clone(entries.get(key)):null,
    saveLocalStorage(key,value){hook?.(key,value);writes++;entries.set(key,clone(value));},
    entries,writes:()=>writes,onSave:fn=>hook=fn};
}
export function testMemoryStore(){
  const files=new Map();let held=false;
  return {files,
    async read(name,max){const value=files.get(name)??null;if(value!==null&&Buffer.byteLength(value)>max)throw Error('test-store-budget');return value;},
    async create(name,text){if(files.has(name))return 'exists';files.set(name,text);return 'created';},
    async list(prefix){return [...files.keys()].filter(k=>k.startsWith(prefix+'/')).sort();},
    async inventory({maxFiles=8193,maxBytes=151000000}={}){const rows=[];let bytes=0;for(const [name,text]of files){rows.push({name,bytes:Buffer.byteLength(text)});bytes+=Buffer.byteLength(text);if(rows.length>=maxFiles||bytes>=maxBytes)return {files:rows,bytes,complete:false};}return {files:rows,bytes,complete:true};},
    async acquire(){if(held)throw Error('test-store-busy');held=true;return async()=>{held=false;};},
  };
}
export function testSettingsPlugin(data){
  let raw=JSON.stringify(data),beforeProcess=null,afterProcess=null,onRead=null,writes=0,reads=0,processes=0;
  const expected='.obsidian/plugins/knowledge-graph-smoke/data.json';
  function path(p){if(p!==expected)throw Error('unexpected-host-path');}
  const adapter={
    async stat(p){path(p);return raw===null?null:{type:'file',size:Buffer.byteLength(raw)};},
    async read(p){path(p);reads++;await onRead?.();return raw;},
    async process(p,fn){path(p);processes++;await beforeProcess?.();const next=fn(raw);if(next!==raw)writes++;raw=next;await afterProcess?.();return raw;},
  };
  const plugin={manifest:{id:'knowledge-graph-smoke'},app:{vault:{configDir:'.obsidian',adapter}},saveData(){throw Error('unexpected-saveData-fallback');}};
  return {plugin,adapter,raw:()=>raw,setRaw:text=>raw=text,patch:fn=>{const value=JSON.parse(raw);fn(value);raw=JSON.stringify(value);},
    beforeProcess:fn=>beforeProcess=fn,afterProcess:fn=>afterProcess=fn,onRead:fn=>onRead=fn,writes:()=>writes,reads:()=>reads,processes:()=>processes};
}
