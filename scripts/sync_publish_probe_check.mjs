import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {setImmediate as yieldTask} from 'node:timers/promises';

const source = fs.readFileSync(new URL('sync-a4-publish-probe/main.js', import.meta.url),'utf8');
const script = new vm.Script(source);
const marker = 'SYNC-A4-PUBLISH-ISOLATED-TEST.json', suite = 'a'.repeat(32);
const pluginId = 'knowledge-map-sync-a4-publish-probe';

function environment({isolated=true, partialCreate=false, adapterReplaces=false}={}) {
  const files = new Map(), folders = new Set(), index = new Set(), local = new Map(), notices = [];
  if (isolated) files.set(marker, JSON.stringify({version:1, isolated:true, suite}));
  const adapter = {
    async stat(name) {
      if (folders.has(name)) return {type:'folder'};
      if (files.has(name)) return {type:'file',size:Buffer.byteLength(files.get(name))};
      return null;
    },
    async read(name) { assert.ok(files.has(name)); return files.get(name); },
    async write(name,text) { files.set(name,text); },
    async rename(from,to) {
      if (files.has(to) && !adapterReplaces) throw Error('exists');
      assert.ok(files.has(from));
      files.set(to,files.get(from)); files.delete(from);
      index.delete(from); index.add(to);
    },
  };
  const vault = {
    adapter,
    getAbstractFileByPath(name) { return index.has(name)?{path:name}:null; },
    async createFolder(name) { assert.ok(!folders.has(name)); folders.add(name); },
    async create(name,text) {
      if (files.has(name)) throw Error('exists');
      if (partialCreate && Buffer.byteLength(text)>100000) {
        files.set(name,text.slice(0,400));
        await yieldTask();
      }
      files.set(name,text); index.add(name);
      return {path:name};
    },
    async rename(file,to) {
      if (files.has(to)) throw Error('exists');
      return adapter.rename(file.path,to);
    },
  };
  const app = {vault,loadLocalStorage:key=>local.get(key)??null,saveLocalStorage:(key,value)=>local.set(key,structuredClone(value))};
  return {files,local,notices,async boot(id=pluginId){
    const commands = new Map(), module = {exports:null};
    const obsidian = {
      Plugin:class{addCommand(command){commands.set(command.id,command.callback);}},
      Notice:class{constructor(text){notices.push(text);}}, Platform:{isMobile:false}, apiVersion:'mock-vault',
    };
    script.runInNewContext({module,require:()=>obsidian,PROBE_BUILD:{version:1},TextEncoder,crypto,setTimeout});
    const plugin = new module.exports();
    plugin.app = app; plugin.manifest = {id};
    await plugin.onload();
    return commands;
  }};
}

const noMarker = environment({isolated:false});
assert.equal((await noMarker.boot()).size,0);
const wrongId = environment();
assert.equal((await wrongId.boot('other-plugin')).size,0);
assert.equal(wrongId.local.size,0);

const good = environment();
const firstBoot = await good.boot();
const firstName = await firstBoot.get('run')();
const first = JSON.parse(good.files.get(firstName));
assert.equal(first.observations.length,15);
assert.ok(first.observations.every(o=>o.scenario==='race'?o.oneCompleteWinner:o.observed&&o.retained));
assert.ok(first.observations.filter(o=>o.scenario==='unindexed-target').every(o=>o.indexedAtCall===false));
assert.ok(first.observations.filter(o=>o.scenario==='race').every(o=>!o.unexpectedBodyOrSizeObserved));
assert.ok(first.boundary.every(row=>row.before.kind==='absent'&&row.after.match===0));
assert.equal(await firstBoot.get('reopen')(),undefined);
assert.match(good.notices.at(-1),/完全退出/);
const snapshot = new Map(good.files);
const reopenedName = await (await good.boot()).get('reopen')();
const reopened = JSON.parse(good.files.get(reopenedName));
assert.equal(reopened.run,first.run);
assert.ok(reopened.observations.every(row=>row.beforeSafeToRetry&&row.afterMatches));
assert.equal(reopened.partialRetained,true);
assert.equal(good.files.size,snapshot.size+1);
for(const [name,content] of snapshot)assert.equal(good.files.get(name),content);

const weak = environment({partialCreate:true,adapterReplaces:true});
const weakName = await (await weak.boot()).get('run')();
const weakReport = JSON.parse(weak.files.get(weakName));
assert.ok(weakReport.observations.some(o=>o.variant==='vault-create'&&o.unexpectedBodyOrSizeObserved));
assert.ok(weakReport.observations.some(o=>o.variant==='adapter-rename'&&o.scenario==='indexed-target'&&!o.retained));
assert.ok(weakReport.observations.some(o=>o.variant==='adapter-rename'&&o.scenario==='race'&&!o.oneCompleteWinner));
console.log('A4 publish probe: isolation, exclusive and weak adapters, partial visibility, and read-only reopen passed.');
