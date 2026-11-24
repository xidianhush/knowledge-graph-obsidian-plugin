// New synthetic shared namespace only. Never copies a used App profile or receipt.
import fs from 'node:fs/promises';import path from 'node:path';import {randomBytes,createHash} from 'node:crypto';
import {prepareUnifiedCandidate} from './prepare_sync_unified_candidate.mjs';
import {packSchema3Operation} from '../src/sync/wire-prototype.mjs';
import {cloneBoundedSyncJson} from '../src/sync/causal-prototype.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),canon=v=>JSON.stringify(cloneBoundedSyncJson(v));
const prep=await prepareUnifiedCandidate(),vault=randomBytes(16).toString('hex'),id=randomBytes(16).toString('hex'),ops='Knowledge Map Sync/attempts-v1/'+vault+'/ops';
prep.phase='G5';prep.remote=prep.remote.replace('/KM-U5-','/KM-G5-');
const data=JSON.parse(await fs.readFile(path.join(prep.paths.PC,'.obsidian/plugins/'+prep.pluginId+'/data.json'),'utf8')),layout=data.layoutOverrides;
const op=packSchema3Operation({vault,id,parents:[],changes:Object.entries(layout.groups).map(([group,record])=>({group,value:{schemaVersion:3,record,structures:record.note?{[record.note]:layout.structures[record.note]}:{}}}))});
const original=canon(op),originalName=id+'.'+sha(original)+'.'+randomBytes(16).toString('hex')+'.json';
const bad=structuredClone(op);bad.changes[0].value.points[0].x+=.01;const collision=canon(bad),badName=id+'.'+sha(collision)+'.'+randomBytes(16).toString('hex')+'.json';
const guide=(await fs.readFile('docs/SYNC_G5_GUIDE.md','utf8')).replaceAll('{{REMOTE}}',prep.remote).replaceAll('{{VAULT}}',vault).replaceAll('{{OPS}}',ops);
const write=async(base,name,bytes)=>{const target=path.resolve(base,name);if(!target.startsWith(path.resolve(base)+path.sep))throw Error('g5-path');await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);return sha(bytes);};
for(const role of ['PC','iPad']){const target=path.join(prep.out,'Knowledge Map G5 '+role);await fs.rename(prep.paths[role],target);prep.paths[role]=target;prep.digests[role]['START-HERE.md']=await write(target,'START-HERE.md',guide);}
prep.digests.PC[ops+'/'+originalName]=await write(prep.paths.PC,ops+'/'+originalName,original);
const kit={'01-未知文件/unexpected.json':'{"g5":"synthetic unknown input"}\n',['02-原件备份/'+originalName]:original,['03-同ID不同正文/'+badName]:collision};
prep.faultKit={};for(const [name,bytes]of Object.entries(kit))prep.faultKit[name]=await write(path.join(prep.out,'G5故障样本-放在库外'),name,bytes);
prep.synthetic={vault,id,ops,originalName,badName};prep.scope='New synthetic notes and one synthetic shared operation; no App identity, private journal, receipt, profile, report or credentials. Fault kit stays outside vaults.';
await fs.writeFile(path.join(prep.out,'preparation.json'),JSON.stringify(prep,null,2)+'\n');console.log(JSON.stringify({out:prep.out,remote:prep.remote,pluginMainSha256:prep.pluginMainSha256,synthetic:prep.synthetic}));
