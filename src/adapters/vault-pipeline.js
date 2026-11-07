// Obsidian I/O and YAML decoding stay outside the deterministic pipeline.
function runPipelineWorker(input, win, signal, resources) {
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(new Error('Graph build cancelled'));return;}
    let worker,url,settled=false;
    const unavailable=error=>{error.workerUnavailable=true;return error;};
    const finish=(error,result)=>{
      if(settled)return;settled=true;signal.removeEventListener('abort',abort);
      if(worker){worker.terminate();resources.active--;resources.stopped++;}
      if(url)win.URL.revokeObjectURL(url);
      if(error)reject(error);else resolve(result);
    };
    const abort=()=>finish(new Error('Graph build cancelled'));
    try{
      url=win.URL.createObjectURL(new win.Blob([PIPELINE_WORKER_SOURCE],{type:'text/javascript'}));
      worker=new win.Worker(url);resources.active++;resources.started++;
      worker.onmessage=event=>event.data.error?finish(new Error(event.data.error)):finish(null,event.data.payload);
      worker.onerror=event=>{event.preventDefault?.();finish(unavailable(new Error(event.message||'Graph worker failed')));};
      worker.onmessageerror=()=>finish(unavailable(new Error('Graph worker returned an unreadable payload')));
      signal.addEventListener('abort',abort,{once:true});worker.postMessage(input);
    }catch(error){finish(unavailable(error));}
  });
}
async function buildVaultGraph(plugin,win,signal,onProgress){
  const settings=plugin.pipelineSettings||{};
  const config=pipelineConfig({include:['**'],...settings.config,vault:'.',vault_name:plugin.app.vault.getName()});
  // Explicit exclusion inherited from this project's handoff; exclude before reads.
  if(!config.exclude.includes('Utilities/API Key.md'))config.exclude.push('Utilities/API Key.md');
  const entries=plugin.app.vault.getMarkdownFiles().map(file=>({path:file.path,file}));
  const scan=selectGraphFiles(entries,config), selected=new Map();
  onProgress(kgT('core.pipeline.selected', { notes: scan.files.length, excluded: scan.stats.excluded }));
  for(const [index,entry] of scan.files.entries()){
    if(signal.aborted)throw new Error('Graph build cancelled');
    const text=await plugin.app.vault.cachedRead(entry.file);
    if(signal.aborted)throw new Error('Graph build cancelled');
    const frontmatter=splitGraphFrontmatter({text,rel:entry.rel},parseYaml).frontmatter;
    selected.set(entry.rel,{text,frontmatter});
    if(index%25===0){onProgress(kgT('core.pipeline.reading', { current: index + 1, total: scan.files.length }));await new Promise(resolve=>win.setTimeout(resolve,0));}
  }
  onProgress(kgT('core.pipeline.layout'));
  const input={files:entries.map(e=>({path:e.path,...(selected.get(e.path)||{text:''})})),config:{...config,attachments:undefined},annotations:settings.annotations||{},candidates:settings.candidates||{},generated:new Date().toISOString().slice(0,16).replace('T',' ')};
  // Blob worker has no vault/Node access; only explicitly selected note text crosses.
  let payload;
  try { payload=await runPipelineWorker(input,win,signal,plugin.pipelineResources); }
  catch(error){
    if(signal.aborted || !error.workerUnavailable)throw error;
    payload=await buildGraphAsync(input,{
      signal,now:()=>win.performance.now(),
      yieldTask:()=>new Promise(resolve=>win.setTimeout(resolve,0)),
      onProgress:progress=>onProgress(kgT('core.pipeline.'+progress.stage,progress)),
    });
  }
  if(signal.aborted)throw new Error('Graph build cancelled');
  return payload;
}
