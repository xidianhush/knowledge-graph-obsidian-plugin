// Development-only transport probe. Not part of Knowledge Map's runtime bundle.
const {Plugin, Modal, Notice, Platform, apiVersion} = require('obsidian');
const ROOT = 'Knowledge Map Sync';
const DIR = ROOT + '/a1-probe';
const MARKER = 'SYNC-A1-ISOLATED-TEST.txt';
const PAYLOAD = 'Knowledge Map A1 | 中文路径与标题 | αβ | 🧭 | 0123456789';
const LIMIT = 512;
const id = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');

module.exports = class SyncA1Probe extends Plugin {
  async onload() {
    this.role = Platform.isMobileApp ? 'iPad' : 'PC';
    this.records = []; this.events = []; this.reads = []; this.failures = [];
    this.queue = Promise.resolve(); this.alive = true; this.panels = new Set();
    const a = this.app.vault.adapter;
    // Fail closed in any vault not explicitly created by the A1 packer.
    if (!await a.exists(MARKER)) { new Notice('SYNC-A1：此库没有独立测试标记，探针未启动。'); return; }
    this.suite = (await a.read(MARKER)).trim();
    if (!/^sync-a1-[a-f0-9]{32}$/.test(this.suite)) throw new Error('Invalid A1 marker');
    for (const kind of ['create', 'modify', 'delete', 'rename']) {
      this.registerEvent(this.app.vault.on(kind, (file, oldPath) => {
        if (![file.path, oldPath].some(p => p && p.startsWith(DIR + '/'))) return;
        this.events.push({kind, path:file.path, oldPath, at:new Date().toISOString()});
        this.events = this.events.slice(-200);
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.scan('event:' + kind), 350);
      }));
    }
    this.registerDomEvent(document, 'visibilitychange', () => {
      if (document.visibilityState === 'visible') this.scan('foreground');
    });
    this.addRibbonIcon('radio-tower', 'SYNC-A1 传输探针', () => this.openPanel());
    this.addCommand({id:'open', name:'打开双端传输探针', callback:() => this.openPanel()});
    this.app.workspace.onLayoutReady(() => this.scan('startup'));
  }
  onunload() { this.alive = false; clearTimeout(this.timer); for (const m of this.panels) m.close(); }
  enqueue(fn) {
    const next = this.queue.then(() => this.alive && fn());
    this.queue = next.catch(() => {});
    return next.catch(error => { this.failures.push(String(error.message || error).slice(0, 160)); this.failures = this.failures.slice(-50); this.render(); new Notice('SYNC-A1 操作失败，请查看面板'); });
  }
  async mkdir() {
    const a = this.app.vault.adapter;
    for (const p of [ROOT, DIR]) if (!await a.exists(p)) await a.mkdir(p);
  }
  scan(reason = 'manual') { return this.enqueue(() => this.readRecords(reason)); }
  async readRecords(reason) {
    const a = this.app.vault.adapter;
    const old = new Set(this.records.map(r => r.id));
    const records = [], invalid = [];
    if (await a.exists(DIR)) {
      const listing = await a.list(DIR);
      const files = listing.files.filter(p => p.startsWith(DIR + '/') && !p.slice(DIR.length + 1).includes('/') && p.endsWith('.json'));
      if (files.length > LIMIT) throw new Error('测试记录超过 512，请停止并导出报告');
      for (const path of files.sort()) {
        try {
          const stat = await a.stat(path);
          if (!stat || stat.size > 32768) throw new Error('oversize/missing');
          const raw = await a.read(path);
          if (raw.length > 32768) throw new Error('oversize');
          const r = JSON.parse(raw);
          if (r.probe !== 1 || r.suite !== this.suite || !/^[a-f0-9]{32}$/.test(r.id) ||
              !['PC','iPad'].includes(r.origin) || path !== DIR + '/' + r.origin + '-' + r.id + '.json' ||
              r.payload !== PAYLOAD || !['normal','offline','background','reopen'].includes(r.scenario) ||
              !Array.isArray(r.observedIds) || r.observedIds.length > LIMIT ||
              !r.observedIds.every(v => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v))) throw new Error('invalid sentinel');
          records.push(r);
        } catch (_) { invalid.push(path); }
      }
    }
    this.records = records; this.invalid = invalid;
    this.reads.push({reason, at:new Date().toISOString(), total:records.length, added:records.filter(r => !old.has(r.id)).map(r => r.id), invalid});
    this.reads = this.reads.slice(-100); this.render();
    return records;
  }
  write(scenario = 'normal') {
    return this.enqueue(async () => {
      await this.mkdir(); await this.readRecords('before-write');
      if (this.records.length >= LIMIT) throw new Error('测试记录达到上限');
      const a = this.app.vault.adapter;
      const r = {probe:1, suite:this.suite, id:id(), origin:this.role, scenario,
        payload:PAYLOAD, observedIds:this.records.map(v => v.id).sort()};
      const path = DIR + '/' + r.origin + '-' + r.id + '.json';
      if (await a.exists(path)) throw new Error('ID collision; existing file preserved');
      const raw = JSON.stringify(r, null, 2) + '\n';
      await a.write(path, raw);
      if (await a.read(path) !== raw) throw new Error('Local readback differs');
      await this.readRecords('after-write');
      new Notice('本机 JSON 已写入；请运行 Nutstore 同步');
    });
  }
  snapshot() {
    const manifests = this.app.plugins.manifests;
    return {probeVersion:'0.1.0', suite:this.suite, role:this.role, host:apiVersion,
      mobile:Platform.isMobileApp,
      syncPlugins:['nutstore-sync','remotely-sync','remotely-save'].map(key => ({id:key, version:manifests[key]?.version || null, enabled:!!this.app.plugins.getPlugin(key)})),
      records:this.records, events:this.events, reads:this.reads, invalid:this.invalid || [], failures:this.failures,
      scope:'Transport probe only; no layout sync or cloud delivery claim'};
  }
  exportReport() {
    return this.enqueue(async () => {
      await this.readRecords('export');
      const path = 'SYNC-A1-report-' + this.role + '-' + id() + '.json';
      await this.app.vault.adapter.write(path, JSON.stringify(this.snapshot(), null, 2) + '\n');
      new Notice('报告已写入测试库根目录：' + path, 10000);
    });
  }
  openPanel() {
    if (!this.suite) return;
    const m = new Modal(this.app); m.onOpen = () => { this.panels.add(m); this.render(); };
    m.onClose = () => this.panels.delete(m); m.open();
  }
  render() {
    for (const m of this.panels) {
      const el = m.contentEl; el.empty();
      el.createEl('h2', {text:'SYNC-A1 双端传输探针'});
      el.createEl('p', {text:'仅测试库使用。此面板不联网；请在 Nutstore 中手动运行双向同步。'});
      const role = el.createEl('select'); for (const v of ['PC','iPad']) role.createEl('option', {value:v, text:'本机：' + v});
      role.value = this.role; role.onchange = () => {this.role = role.value; this.render();};
      const line = text => el.createEl('p', {text});
      line('有效 JSON：PC ' + this.records.filter(r => r.origin === 'PC').length + ' / iPad ' + this.records.filter(r => r.origin === 'iPad').length + '；无效 ' + (this.invalid || []).length);
      const local = new Set(this.records.filter(r => r.origin === this.role).map(r => r.id));
      line('另一端回执引用本机记录：' + new Set(this.records.filter(r => r.origin !== this.role).flatMap(r => r.observedIds).filter(v => local.has(v))).size);
      const latest = this.reads[this.reads.length - 1];
      line('最近读取：' + (latest ? latest.reason + ' / ' + latest.at : '尚未读取') + '；文件事件 ' + this.events.length);
      const add = (text, fn) => { const p = el.createEl('p'); const b = p.createEl('button', {text}); b.onclick = () => fn(); };
      add('写入本机 JSON（正常）', () => this.write());
      add('写入本机 JSON（离线场景）', () => this.write('offline'));
      add('写入本机 JSON（对端后台场景）', () => this.write('background'));
      add('写入本机 JSON（对端重开场景）', () => this.write('reopen'));
      add('手动检查文件（用于补扫）', () => this.scan());
      add('导出本机报告', () => this.exportReport());
      if (this.failures.length) line('最近失败：' + this.failures[this.failures.length - 1]);
      line('请先看自动更新结果，再点手动检查；报告会记录读取来源。');
    }
  }
};
