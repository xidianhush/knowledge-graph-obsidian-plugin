import {sharedOperationDirectory} from './obsidian-shared-history.mjs';
import {probeSchema3Snapshot,validateSchema3Snapshot} from './layout-prototype.mjs';

// `readLocal` reads the private receipt and journal state. `receive` admits an
// A3 acceptExternal call under the private quota and returns its result.
export function startObsidianLayoutReceiver({vault,logicalVault,attemptDirectory,win,layoutStore,getGraph,readLocal,receive,report,delay=180}) {
  const directory=attemptDirectory??sharedOperationDirectory(logicalVault),doc=win.document;
  const signals=new Set();
  let timer=null,running=null,closed=false,waitForIdle=false,shown=null,manualTail=Promise.resolve();
  const held=reason=>({kind:'held',reason});
  function relevant(path,folder) {
    if(typeof path!=='string'||!path)return false;
    if(path===directory||directory.startsWith(path+'/'))return true;
    if(path.startsWith(directory+'/'))return !!attemptDirectory||folder||/\.json$/i.test(path);
    return !path.startsWith('Knowledge Map Sync/')&&(folder||/\.md$/i.test(path));
  }
  const refs=['create','modify','delete','rename'].map(name=>vault.on(name,(file,oldPath)=>{
    const folder=Array.isArray(file?.children);
    if(relevant(file?.path,folder)||relevant(oldPath,folder))request('vault:'+name);
  }));
  const focus=()=>request('focus'), visibility=()=>request('visibility');
  win.addEventListener('focus',focus);
  doc.addEventListener('visibilitychange',visibility);
  const stopIdle=layoutStore.onIdle(()=>{
    if(waitForIdle){waitForIdle=false;request('layout-idle');}
  });

  function schedule() {
    if(timer===null&&!running&&!doc.hidden)timer=win.setTimeout(flush,delay);
  }
  function request(signal='manual') {
    if(closed)return;
    signals.add(signal);
    schedule();
  }
  function busy() {
    const state=layoutStore.state();
    return state.busy||state.locked;
  }
  function deferred() {
    waitForIdle=busy();
    return held(waitForIdle?'layout-editing':'graph-changed');
  }
  async function scan() {
    const graph=getGraph(),current=()=>!closed&&!doc.hidden&&graph?.isCurrent();
    if(!current())return held('graph-not-ready');
    if(layoutStore.state().unsupported)return held('layout-unsupported');
    if(busy())return deferred();
    const local=await readLocal();
    if(!current()||busy())return deferred();
    if(local.localState?.layoutDraft)return held('local-layout-draft');
    if(local.localState?.pendingSave||local.pending)return held('local-action-pending');
    if(!local.accepted)return held('join-required');

    let reservation=null,blockedByEdit=false;
    const reserve=()=>{
      if(!current())return false;
      reservation=layoutStore.reserveExternal(value=>{
        const snapshot=validateSchema3Snapshot(value);
        if(!probeSchema3Snapshot(snapshot,graph.createModel).ok)throw Error('layout-graph-incompatible');
        return snapshot;
      });
      if(!reservation&&busy()){blockedByEdit=true;waitForIdle=true;}
      return reservation!==null;
    };
    function project(accepted) {
      if(!current())return held('graph-changed');
      if(shown?.fingerprint===accepted.fingerprint&&shown.graph===graph)return {kind:'noop'};
      if(!reservation&&!reserve())return deferred();
      const changed=reservation.apply(accepted.snapshot);
      shown={fingerprint:accepted.fingerprint,graph};
      return {kind:changed?'applied':'noop'};
    }
    function release() {
      reservation?.release();
      reservation=null;
    }
    // Reopen from the last verified receipt, even if shared input is temporarily
    // missing. A later compatible snapshot may supersede an old graph shape.
    let restored;
    try{restored=project(local.accepted);}
    catch(error){if(error.message!=='layout-graph-incompatible')throw error;restored=held(error.message);}
    finally{release();}
    if(!current()||busy())return deferred();
    try{
      const result=await receive({model:graph.createModel,reserve});
      if(result.reason==='layout-busy-or-stale'){
        if(!blockedByEdit)return deferred();
        if(!busy()){waitForIdle=false;request('layout-idle');}
        return held('layout-editing');
      }
      if(result.kind==='noop')return restored;
      if(result.kind==='accepted'||result.kind==='accepted-deferred')return project(result.state.accepted);
      return held(result.reason);
    }finally{release();}
  }
  function flush() {
    timer=null;
    if(closed||doc.hidden||!signals.size)return;
    const triggeredBy=[...signals];signals.clear();
    running=scan().then(result=>{if(!closed)report(result,triggeredBy);return result;},error=>{
      const result={kind:'error',reason:String(error.message||error)};
      if(!closed)report(result,triggeredBy);
      return result;
    }).finally(()=>{
      running=null;
      if(!closed&&signals.size)schedule();
    });
  }
  request('startup');
  return {
    request,
    check(signal='manual'){
      const work=manualTail.catch(()=>{}).then(async()=>{
        await running;
        if(closed)return held('receiver-closed');
        if(timer!==null){win.clearTimeout(timer);timer=null;}
        signals.add(signal);
        if(doc.hidden){
          const result=held('view-hidden'),triggeredBy=[...signals];signals.clear();
          report(result,triggeredBy);return result;
        }
        flush();
        return running;
      });
      manualTail=work;return work;
    },
    async close() {
      closed=true;
      if(timer!==null)win.clearTimeout(timer);
      stopIdle();
      for(const ref of refs)vault.offref(ref);
      win.removeEventListener('focus',focus);
      doc.removeEventListener('visibilitychange',visibility);
      await running;
      await manualTail;
    },
  };
}
