import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {deriveSyncStatus} from '../src/sync/obsidian-sync-settings.mjs';
const ready={status:'ready',selected:{vault:'a'.repeat(32),transport:'attempts-v1'},session:{initialized:true,accepted:{appliedIds:[]},localState:null,pending:null},publication:{lastResult:null}};
const cases=[
 [{...ready,session:{...ready.session,faulted:true},outcome:{kind:'held',reason:'publication-error'}},'recovery'],
 [{...ready,session:{...ready.session,attemptConflict:{ids:['a'.repeat(32)]}},outcome:{kind:'noop',scope:'receive'}},'damaged'],
 [{...ready,outcome:{kind:'held',reason:'resolution-choice-budget'}},'conflictLimit'],
 [{...ready,outcome:{kind:'held',reason:'no-shared-conflict'}},'noConflict'],
 [{...ready,outcome:{kind:'held',reason:'local-layout-review-required'}},'draftReview'],
 [{status:'unselected'},'off'],[{...ready,status:'join-required',session:{initialized:false}},'join'],
 [ready,'saved'],[{...ready,saveError:'quota write failed'},'unsaved'],
 [{...ready,session:{...ready.session,localState:{layoutDraft:{id:'a'}}}},'queued'],
 [{...ready,publication:{lastResult:{kind:'accepted'}}},'written'],
 [{...ready,status:'paused'},'capacity'],[{...ready,publication:{lastResult:{kind:'held',reason:'shared-candidate-blocked'}}},'conflict'],
 [{...ready,publication:{lastResult:{kind:'held',reason:'shared-input-unresolved'}}},'predecessor'],
 [{...ready,publication:{lastResult:{kind:'held',reason:'graph-incompatible'}}},'notes'],
 [{...ready,publication:{lastResult:{kind:'held',reason:'attempt-id-quarantine'}}},'damaged'],
 [{...ready,status:'local-ready'},'disabled'],
 [{status:'selection-review-required',selectionPending:{vault:'a'.repeat(32)}},'selection'],
 [{...ready,status:'join-required',session:{initialized:false},outcome:{kind:'held',reason:'graph-unavailable'}},'waiting'],
];
for(const [s,expected]of cases)assert.equal(deriveSyncStatus(s).key,expected);
assert.equal(deriveSyncStatus({...ready,outcome:{kind:'accepted',scope:'publication'}},{result:{kind:'held',reason:'layout-busy'}}).key,'waiting');
assert.equal(deriveSyncStatus({...ready,outcome:{kind:'accepted',scope:'publication'}},{error:'action failed'}).key,'held');
assert.equal(deriveSyncStatus(ready,{error:'resolution-choice-budget'}).key,'conflictLimit');
assert.equal(deriveSyncStatus({...ready,externalPending:true,outcome:{kind:'accepted',scope:'publication'}}).key,'settings');
const original=await fs.readFile('src/i18n.sync.js','utf8');assert.ok(!/all devices.{0,20}(up.to.date|complete)|云端.{0,4}完成|全设备.{0,4}完成/i.test(original));
await fs.mkdir('.local/sync-016/unified/u4',{recursive:true});await fs.writeFile('.local/sync-016/unified/u4/status-check.json',JSON.stringify({passed:cases.length+4,checks:[...cases.map(([,key])=>key),'fresh held overrides previous success','action error overrides previous success','external settings review','conflict choice budget error uses its own status']},null,2));console.log('Sync settings status checks passed: '+(cases.length+4));
