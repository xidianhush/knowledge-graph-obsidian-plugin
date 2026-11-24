import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {bundleSyncHost} from './bundle-sync-host.mjs';
export function buildSyncA3Probe(root){
  const modules=[['Causal','src/sync/causal-prototype.mjs',['cloneBoundedSyncJson','CAUSAL_PROTOTYPE_LIMITS']],['SyncHost','src/sync/obsidian-host-prototype.mjs',['openObsidianSyncDevice','createDeviceBoundPrivateStore','createObsidianSettingsDocument']],['NativeStore','src/sync/indexeddb-store-prototype.mjs',['openIndexedDbSyncStore']]],provenance=[],parts=[];
  for(const [global,file,exports]of modules){const original=fs.readFileSync(path.join(root,file),'utf8');provenance.push({file,sha256:crypto.createHash('sha256').update(original).digest('hex')});let source=original.replace(/^export /gm,'');if(global==='SyncHost')source=source.replace("import {cloneBoundedSyncJson,CAUSAL_PROTOTYPE_LIMITS as limits} from './causal-prototype.mjs';","const {cloneBoundedSyncJson,CAUSAL_PROTOTYPE_LIMITS:limits}=Causal;");parts.push(`const ${global}=(()=>{\n${source}\nreturn {${exports.join(',')}};\n})();`);}
  const footer=fs.readFileSync(path.join(root,'scripts/sync-a3-native-probe/main.js'),'utf8'),build={version:1,modules:provenance,footerSha256:crypto.createHash('sha256').update(footer).digest('hex')};
  parts.push('const PROBE_BUILD='+JSON.stringify(build)+';\n'+footer);const main=parts.join('\n');return {main,build,provenance,pluginMainSha256:crypto.createHash('sha256').update(main).digest('hex')};
}

export function buildSyncA3LocalWorkProbe(root,{replay=false}={}){
  return bundleSyncHost(root,{replay});
}

export function buildKnowledgeMapRecovery(root,host,{candidate=false}={}){
  return bundleSyncHost(root,{host,candidate});
}

export function buildKnowledgeMapReceiveCandidate(root,host,{attemptSuite=null}={}){
  return bundleSyncHost(root,{host,receive:true,attemptSuite});
}
export function buildKnowledgeMapUnifiedCandidate(root,host){return bundleSyncHost(root,{host,unified:true});}
