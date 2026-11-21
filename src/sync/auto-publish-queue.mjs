// Unified candidate U2. Host integration is injected; constructing a queue does
// no I/O and does not authorize publication of work restored after closing.
import {cloneBoundedSyncJson,CAUSAL_PROTOTYPE_LIMITS as limits} from './causal-prototype.mjs';
import {createLayoutActionAuthor} from './author-prototype.mjs';
import {planSchema3Transactions} from './layout-prototype.mjs';
const equal=(a,b)=>JSON.stringify(cloneBoundedSyncJson(a))===JSON.stringify(cloneBoundedSyncJson(b));
const sameLayout=(a,b)=>equal({groups:a.groups,structures:a.structures},{groups:b.groups,structures:b.structures});
const work=s=>!!(s.pending||s.localState?.layoutDraft);
const key=s=>JSON.stringify([s.accepted?.fingerprint,s.pending?.id,s.localState?.layoutDraft?.id,s.localState?.layoutDraft?.baseFingerprint]);
const held=reason=>({kind:'held',reason});

export function createAutoPublishQueue({readLocal,publish,canRun=()=>true,onResult=()=>{},maxBatch=4}={}){
  if([readLocal,publish,canRun,onResult].some(v=>typeof v!=='function')||!Number.isInteger(maxBatch)||maxBatch<1||maxBatch>32)throw Error('auto-publish-options');
  let closed=false,armed=false,paused=false,requested=false,running=false,tail=Promise.resolve(),lastResult=null;
  let restoredWork=work(readLocal());
  function report(result){lastResult=result;try{onResult(result);}catch{/* Observers never decide publication/retry. */}return result;}
  function gate(){if(closed)return held('queue-closed');const allowed=canRun();return allowed===true?null:held(allowed?.reason||'publication-unavailable');}
  async function drain(){
    running=true;
    try{
      for(let count=0;requested&&!closed&&!paused&&count<maxBatch;count++){
        requested=false;const blocked=gate();if(blocked){report(blocked);break;}
        const before=readLocal();if(!work(before)){report({kind:'noop'});break;}
        const result=await publish({canContinue:()=>!gate()});report(result);
        if(result.kind==='held'||result.kind==='review-required'){paused=true;break;}
        const after=readLocal();
        if(work(after)&&key(before)===key(after)){paused=true;report(held('publication-no-progress'));break;}
        requested=work(after);
      }
      // A bounded batch yields control and requires an explicit retry. This
      // also bounds callbacks that keep manufacturing newer drafts forever.
      if(requested&&!closed&&!paused){paused=true;report(held('publication-batch-limit'));}
    }catch(error){paused=true;report({...held('publication-error'),error:String(error?.message??error)});}
    finally{running=false;}
    return lastResult;
  }
  function start(){if(running||closed||paused||!armed)return tail;tail=tail.catch(()=>{}).then(drain);running=true;return tail;}
  return {
    notifySaved(draftId){
      if(closed)return Promise.resolve(held('queue-closed'));
      if(readLocal().localState?.layoutDraft?.id!==draftId)return Promise.resolve(held('saved-draft-changed'));
      if(restoredWork)return Promise.resolve(report(held('publication-review-required')));
      armed=true;requested=true;return start();
    },
    resume({confirmed=false}={}){
      if(closed)return Promise.resolve(held('queue-closed'));
      if((!armed||restoredWork)&&!confirmed)return Promise.resolve(report(held('publication-review-required')));
      if(confirmed)restoredWork=false;
      armed=true;paused=false;requested=true;return start();
    },
    state:()=>({closed,armed,paused,running,lastResult}),
    settled:()=>tail,
    close(){closed=true;requested=false;return tail.then(()=>{},()=>{});},
  };
}

export function createLayoutDraftPublisher({session,coordinator,attemptHistory,vault,createModel,getEpoch,reserve,runExclusive=fn=>fn(),nextId}={}){
  if(!session||!coordinator||!attemptHistory||[createModel,getEpoch,reserve,runExclusive].some(fn=>typeof fn!=='function'))throw Error('layout-publisher-options');
  return {async publish({canContinue=()=>true,reviewedConflict=null}={}){
    if(!canContinue())return held('publication-unavailable');
    const epoch=getEpoch(),guard=await reserve();if(!guard)return held('layout-busy');
    const current=()=>canContinue()&&getEpoch()===epoch&&guard.isCurrent();
    try{return await runExclusive(async()=>{
      if(!current())return held('publication-unavailable');
      let state=session.state();
      if(!state.initialized||state.faulted||state.closed)return held('session-unavailable');
      if(state.pending?.mode==='resolution')return held('conflict-confirmation-required');
      if(state.localState?.pendingSave)return held('local-save-pending');
      if(reviewedConflict){const scan=await session.reviewPublicationInput();if(scan.issue)return held(scan.issue);if(!equal(scan.inventory,reviewedConflict.inventory))return held('shared-scan-changed');}
      if(!state.pending){
        const settled=await coordinator.settlePublishedLayoutDraft();if(settled.kind==='held')return settled;
        state=session.state();const draft=state.localState?.layoutDraft;if(!draft)return {kind:'noop'};
        const scan=await attemptHistory.scan();
        if(scan.issue||scan.blockers?.length||scan.quarantined?.length)return held(scan.issue||'shared-input-blocked');
        // Do not build a 1025-operation plan or allocate a fresh intent when
        // admission is already impossible. The reliable draft is the exit.
        if(scan.count>=limits.operations)return held('attempt-file-budget');
        if(scan.records.length>=limits.operations)return held('shared-operation-budget');
        if(!current())return held('publication-unavailable');
        const accepted=state.accepted;
        const changes=[...new Set([...Object.keys(accepted.snapshot.groups),...Object.keys(draft.value.groups)])].flatMap(group=>{
          const wrap=(record,source)=>record?{schemaVersion:3,record,structures:record.note?{[record.note]:source.structures[record.note]}:{}}:null;
          const before=wrap(accepted.snapshot.groups[group],accepted.snapshot),value=wrap(draft.value.groups[group],draft.value);
          return equal(before,value)?[]:[{group,value}];
        });
        const author=createLayoutActionAuthor({vault,createModel,nextId});
        let proposal;try{proposal=author.prepareEdit({vault,sharedScanComplete:true,records:scan.records,appliedIds:accepted.appliedIds,localBaseline:accepted.snapshot},changes);}catch(error){if(/budget|limit/.test(error.message))return held(error.message);throw error;}
        if(proposal.kind!=='publish')return proposal;
        if(scan.total+new TextEncoder().encode(JSON.stringify(cloneBoundedSyncJson(proposal.operation))).length>limits.totalBytes)return held('shared-byte-budget');
        if(proposal.sharedStatus!=='candidate'){
          const plan=planSchema3Transactions([...scan.records,proposal.operation],{vault,baseline:{...accepted.snapshot,groups:{},structures:{}},createModel});
          if(!reviewedConflict||plan.index.pending.length||plan.index.issues.length||plan.index.quarantined.length||!plan.decisions.some(d=>d.status==='conflict')||!plan.decisions.every(d=>['conflict','candidate'].includes(d.status)))return held('shared-candidate-blocked');
        }
        if(!sameLayout(proposal.proposal,draft.value))return held('layout-proposal-mismatch');
        await session.stage(proposal);
      }
      if(!current())return held('publication-unavailable');
      const result=await session.publish({canContinue:current,reviewedConflict});
      if(['accepted','accepted-deferred'].includes(result.kind)){
        const settled=await coordinator.settlePublishedLayoutDraft();
        if(settled.kind==='held')return {...settled,publication:result.kind};
      }
      return result;
    });}finally{guard.release();}
  }};
}
