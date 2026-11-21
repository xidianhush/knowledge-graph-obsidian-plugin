const {Plugin, Notice, Platform, apiVersion} = require('obsidian');
const pluginId = 'knowledge-map-sync-a4-publish-probe';
const markerPath = 'SYNC-A4-PUBLISH-ISOLATED-TEST.json';
const directory = 'A4 Publish Probe';
const checkpointKey = pluginId + ':checkpoint';
const idPattern = /^[a-f0-9]{32}$/;
const encoder = new TextEncoder();
const variants = ['vault-create', 'vault-rename', 'adapter-rename'];
const restartVariants = ['vault-create', 'vault-rename'];
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
const requireState = (ok, reason) => { if (!ok) throw Error(reason); };
const bytes = value => encoder.encode(value).length;
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const body = (label, n = 0) => JSON.stringify({label, text: '同步🧪'.repeat(n)});
const full = [body('first', 30000), body('second', 30000)];
const original = body('original');
const prepared = body('publication-checkpoint', 1000);
const prefix = prepared.slice(0, prepared.length - 2);

async function observe(adapter, path, candidates) {
  const stat = await adapter.stat(path);
  if (!stat) return {kind: 'absent'};
  if (stat.type !== 'file' || !Number.isSafeInteger(stat.size) || stat.size < 0 || stat.size > 2097152) {
    return {kind: 'unexpected-stat'};
  }
  const text = await adapter.read(path);
  const match = candidates.indexOf(text);
  return match >= 0 ? {kind: 'exact', match, bytes: bytes(text), statBytes: stat.size} :
    {kind: 'different', bytes: bytes(text), statBytes: stat.size};
}

async function stage(vault, variant, from, text) {
  if (variant === 'vault-create') return;
  return vault.create(from, text);
}

function install(vault, variant, source, from, target, text) {
  if (variant === 'vault-create') return vault.create(target, text);
  if (variant === 'vault-rename') return vault.rename(source, target);
  return vault.adapter.rename(from, target);
}

async function collision(vault, runPath, variant, scenario) {
  const stem = runPath + '/' + variant + '-' + scenario;
  const target = stem + '-target.json', from = stem + '-source.txt';
  const source = await stage(vault, variant, from, full[0]);
  if (scenario === 'indexed-target') await vault.create(target, original);
  else await vault.adapter.write(target, original);
  const indexedBefore = !!vault.getAbstractFileByPath(target);
  if (scenario === 'unindexed-target' && indexedBefore) return {variant, scenario, indexedBefore, observed: false};
  requireState((await observe(vault.adapter, target, [original])).match === 0, 'collision-fixture-missing');
  // Capture index state again at invocation, after the disk read yielded.
  const indexedAtCall = !!vault.getAbstractFileByPath(target);
  if (scenario === 'unindexed-target' && indexedAtCall) return {variant, scenario, indexedBefore, indexedAtCall, observed: false};
  const [result] = await Promise.allSettled([(async () => install(vault, variant, source, from, target, full[0]))()]);
  const final = await observe(vault.adapter, target, [original, full[0]]);
  const sourceFinal = source ? await observe(vault.adapter, from, [full[0]]) : null;
  return {variant, scenario, indexedBefore, indexedAtCall, observed: true, result: result.status, final, sourceFinal,
    retained: result.status === 'rejected' && final.match === 0 && (!sourceFinal || sourceFinal.match === 0)};
}

async function race(vault, runPath, variant, trial) {
  const stem = runPath + '/' + variant + '-race-' + trial;
  const target = stem + '-target.json', from = [stem+'-left.txt', stem+'-right.txt'];
  const sources = await Promise.all(from.map((name, i) => stage(vault, variant, name, full[i])));
  let pending = true;
  const operation = Promise.allSettled(full.map(async (text, i) => install(vault, variant, sources[i], from[i], target, text)))
    .finally(() => { pending = false; });
  const observations = [];
  while (pending && observations.length < 16) {
    try { observations.push({...await observe(vault.adapter, target, full), pendingAtCompletion: pending}); }
    catch { observations.push({kind: 'read-failed', pendingAtCompletion: pending}); }
    if (pending) await pause();
  }
  const outcomes = (await operation).map(result => result.status);
  const final = await observe(vault.adapter, target, full);
  const sourceFinal = await Promise.all(from.map((name, i) => sources[i] ? observe(vault.adapter, name, [full[i]]) : null));
  const soleWinner = outcomes.filter(status => status === 'fulfilled').length === 1 ? outcomes.indexOf('fulfilled') : -1;
  const inconsistentSize = sample => sample.kind==='exact' && sample.bytes!==sample.statBytes;
  return {variant, scenario:'race', trial, outcomes, final, sourceFinal, observations,
    oneCompleteWinner: soleWinner >= 0 && final.match === soleWinner && !inconsistentSize(final) &&
      sourceFinal.every((value, i) => !value || (i === soleWinner ? value.kind==='absent' : value.match===0)),
    unexpectedBodyOrSizeObserved: observations.some(value => value.kind==='different' || inconsistentSize(value))};
}

function restartPaths(runPath, variant) {
  return {beforeSource:runPath+'/'+variant+'-before.txt', beforeTarget:runPath+'/'+variant+'-before.json',
    afterSource:runPath+'/'+variant+'-after.txt', afterTarget:runPath+'/'+variant+'-after.json'};
}

module.exports = class PublishProbe extends Plugin {
  async onload() {
    if (this.manifest.id !== pluginId) return;
    try {
      const adapter = this.app.vault.adapter;
      const stat = await adapter.stat(markerPath);
      requireState(stat?.type === 'file' && stat.size > 0 && stat.size <= 2048, 'invalid-marker');
      const text = await adapter.read(markerPath);
      requireState(bytes(text) <= 2048, 'invalid-marker');
      const marker = JSON.parse(text);
      requireState(marker?.version === 1 && marker.isolated === true && typeof marker.suite === 'string' && idPattern.test(marker.suite), 'invalid-marker');
      this.suite = marker.suite;
    } catch { new Notice('A4 发布探针只在专用独立库运行'); return; }
    this.boot = random();
    this.addCommand({id: 'run', name: 'A4 · 运行发布接口检查', callback: () => this.command(() => this.run())});
    this.addCommand({id: 'reopen', name: 'A4 · 检查退出重开后的发布状态', callback: () => this.command(() => this.reopen())});
  }
  async command(task) {
    if (this.busy) return;
    this.busy = true;
    try { return await task(); }
    catch (error) { new Notice('A4 检查暂停：'+String(error.message||error).slice(0, 160)); }
    finally { this.busy = false; }
  }
  async saveReport(phase, run, details) {
    const platform = Platform.isMobile ? 'mobile' : 'PC';
    const file = `SYNC-A4-publish-${platform}-${phase}-${random()}.json`;
    await this.app.vault.create(file, JSON.stringify({probe:1, build:PROBE_BUILD, suite:this.suite,
      run, phase, platform, obsidian:apiVersion, ...details}, null, 2)+'\n');
    new Notice('A4 报告已保存：'+file, 10000);
    return file;
  }
  async run() {
    const {app} = this, vault = app.vault, adapter = vault.adapter;
    requireState(app.loadLocalStorage(checkpointKey) === null, '此库已有检查，请继续重开复核');
    if (!await adapter.stat(directory)) await vault.createFolder(directory);
    const run = random(), runPath = directory+'/'+run;
    await vault.createFolder(runPath);
    const observations = [];
    for (const variant of variants) {
      for (const scenario of ['indexed-target','unindexed-target']) {
        observations.push(await collision(vault, runPath, variant, scenario));
      }
      for (let trial = 1; trial <= 3; trial++) observations.push(await race(vault, runPath, variant, trial));
    }
    const checkpoint = {version:1, suite:this.suite, run, boot:this.boot};
    app.saveLocalStorage(checkpointKey, checkpoint);
    const saved = app.loadLocalStorage(checkpointKey);
    requireState(saved?.suite === this.suite && saved?.run === run && saved?.boot === this.boot, '未能保存检查点');
    const boundary = [];
    for (const variant of restartVariants) {
      const paths = restartPaths(runPath, variant);
      await stage(vault, variant, paths.beforeSource, prepared);
      const after = await stage(vault, variant, paths.afterSource, prepared);
      await install(vault, variant, after, paths.afterSource, paths.afterTarget, prepared);
      boundary.push({variant, before:await observe(adapter, paths.beforeTarget, [prepared]), after:await observe(adapter, paths.afterTarget, [prepared])});
    }
    await vault.create(runPath+'/partial.json', prefix);
    return this.saveReport('first', run, {observations, boundary, raceBodyBytes:full.map(bytes)});
  }
  async reopen() {
    const saved = this.app.loadLocalStorage(checkpointKey);
    requireState(saved?.version === 1 && saved.suite === this.suite && typeof saved.run === 'string' && idPattern.test(saved.run), '请先运行发布接口检查');
    requireState(saved.boot !== this.boot, '请完全退出 Obsidian 再打开测试库');
    const runPath = directory+'/'+saved.run, adapter = this.app.vault.adapter;
    const observations = [];
    for (const variant of restartVariants) {
      const paths = restartPaths(runPath, variant);
      const before = await observe(adapter, paths.beforeTarget, [prepared]);
      const beforeSource = variant==='vault-rename' ? await observe(adapter, paths.beforeSource, [prepared]) : null;
      const after = await observe(adapter, paths.afterTarget, [prepared]);
      observations.push({variant, before, beforeSource, after,
        beforeSafeToRetry:before.kind==='absent' && (!beforeSource || beforeSource.match===0),
        afterMatches:after.match===0 && after.bytes===after.statBytes});
    }
    const partial = await observe(adapter, runPath+'/partial.json', [prefix, prepared]);
    return this.saveReport('reopen', saved.run, {observations, partial, partialRetained:partial.match===0});
  }
};
