import assert from 'node:assert/strict';
import {buildGraph} from '../dist/pipeline.mjs';
import {createLayoutModel,createLayoutEditor,createLayoutStore} from '../dist/graph-core.mjs';
import {createDurableSyncSession} from '../src/sync/persistence-prototype.mjs';
import {createPrivateConfigProjection} from '../src/sync/private-config-prototype.mjs';
import {createSettingsCoordinator} from '../src/sync/settings-coordinator-prototype.mjs';
import {openObsidianSyncDevice,createDeviceBoundPrivateStore} from '../src/sync/obsidian-host-prototype.mjs';
import {createLifecycleDevice,createSyncLifecycle} from '../src/sync/connection-lifecycle-prototype.mjs';
import {createPrivateStoreBudget} from '../src/sync/private-store-budget-prototype.mjs';
import {createLocalWorkHost} from '../src/sync/local-work-prototype.mjs';
import {testMemoryStore,testLocalApp,testLockManager} from './sync-host-test-helpers.mjs';
import {validateTestSettings as validate} from './sync-settings-test-helpers.mjs';
export const vault='a'.repeat(32),other='c'.repeat(32),empty={schemaVersion:3,revision:0,groups:{},structures:{}},pluginId='local-work-test';
export const graph=()=>buildGraph({files:[{path:'Synthetic/A.md',text:'# First\nbody\n# Second\nother'}],config:{include:['**']}});
export function model(){const g=graph();return createLayoutModel(g.nodes,g.meta.layout_root_radius);}
export async function layout(){const g=graph(),m=createLayoutModel(g.nodes,g.meta.layout_root_radius),editor=createLayoutEditor(g.nodes,g.meta.layout_root_radius),node=g.nodes.find(n=>n.title==='Second');assert.equal(editor.begin(node.id),null);editor.move(node.x+10,node.y+3);editor.commit();let snapshot;const key=m.groupKey(node.id);await createLayoutStore(null,async v=>snapshot=v).command({},'edit',key,m.capture(key));return snapshot;}
export const source=()=>({settings:{language:'auto'},ui:{legend:'false'},unknown:{keep:42}});
export async function fixture(options={}){
  const app=options.app||testLocalApp(),locks=options.locks||testLockManager(),stores=options.stores||new Map();let sharedCalls=0,epoch=0,hook=()=>{};
  const realShared=options.shared||testMemoryStore(),shared=Object.fromEntries(['read','list','create'].map(k=>[k,(...args)=>{sharedCalls++;return realShared[k](...args);} ]));
  async function make(){const opened=[],base=await openObsidianSyncDevice({app,pluginId,locks});if(!base.state().connection)await base.connect(vault);
    const device=await createLifecycleDevice({device:base,app,pluginId,locks}),controller=createSyncLifecycle({device,openBundle:async({device,vault,access})=>{
      if(!stores.has(vault))stores.set(vault,options.backend?options.backend(vault):testMemoryStore());const backend=stores.get(vault),quota=createPrivateStoreBudget({store:backend,limits:options.limits});
      const session=createDurableSyncSession({privateStore:createDeviceBoundPrivateStore({store:quota.store,device,vault,access}),sharedStore:shared,vault,installation:device.state().installation,createModel:model,access,checkpoint:step=>hook('core:'+step)});
      const projection=createPrivateConfigProjection({session,validateSettings:validate,getExternalEpoch:()=>0}),coordinator=createSettingsCoordinator({session,documentStore:projection.documentStore,validateSettings:validate,createModel:model,getGraphEpoch:()=>epoch,checkpoint:step=>hook('coordinator:'+step)});
      const bundle={session,projection,coordinator,quota,backend,open:()=>quota.recover(async()=>{await session.open();if(access==='sync'&&!session.state().initialized&&!options.explicitJoin)await session.initialize({source:'explicit-empty',localBaseline:empty});if(session.state().initialized){if(access==='sync')await projection.initialize({sourceData:source()});await projection.open();await coordinator.open();}})};opened.push(bundle);return bundle;
    }});await controller.open();return {device,base,controller,host:createLocalWorkHost({lifecycle:controller,createModel:model,getGraphEpoch:()=>epoch}),opened,current:()=>opened.at(-1)};
  }
  return {...await make(),make,app,stores,locks,realShared,sharedCalls:()=>sharedCalls,epoch:()=>epoch,bumpEpoch:()=>epoch++,hook:fn=>hook=fn};
}
export function value(result){assert.equal(result.kind,'completed',JSON.stringify(result));return result.value;}
