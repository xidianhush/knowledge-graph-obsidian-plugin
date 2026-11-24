// Entry point for the isolated Obsidian test vaults only.
const {Plugin, Notice, Platform, apiVersion} = require('obsidian');
const {
  attemptDirectory, inspectSnapshot, makeFixtures, matchesRound, probeId, roles, rounds, sha256, toHex, vaultName,
} = loadProbeModule('scripts/sync-a4-attempt-candidate.mjs');

module.exports = class AttemptProbe extends Plugin {
  async onload() {
    const state = await this.loadData();
    if (!state || state.suite !== PROBE_BUILD.suite || !roles.includes(state.role) ||
        this.app.vault.getName() !== vaultName(state.role)) {
      new Notice('A4 尝试探针只在配对的独立测试库启用。');
      return;
    }
    this.state = state;
    this.adapter = this.app.vault.adapter;
    this.dir = attemptDirectory(state.suite);
    this.fixtures = await makeFixtures(state.suite, PROBE_BUILD.ids, PROBE_BUILD.tokens);
    this.command('baseline', '基线 · 检查空目录', () => this.scan(0));
    rounds.forEach(({fixture, sender, label}, i) => {
      const round = i + 1;
      if (sender === state.role) {
        this.command('send-' + round, round + ' · 投放' + label, () => this.seed(round, this.fixtures[fixture]));
      } else {
        this.command('scan-' + round, round + ' · 核对' + label, () => this.scan(round));
      }
    });
    this.command('report', '导出本机报告', () => this.exportReport());
  }

  command(id, label, action) {
    this.addCommand({
      id, name: 'A4 尝试 · ' + label,
      callback: async () => {
        if (this.busy) return new Notice('A4 探针正在读写，请等提示。');
        this.busy = true;
        try {
          await action();
        } catch (error) {
          new Notice('A4 ' + label + '失败 · ' + error.message, 10000);
        } finally {
          this.busy = false;
        }
      },
    });
  }

  async seed(round, {name, bytes}) {
    if (!(await this.adapter.exists(this.dir))) {
      let folder = '';
      for (const part of this.dir.split('/')) {
        folder = folder ? folder + '/' + part : part;
        if (!(await this.adapter.exists(folder))) await this.adapter.mkdir(folder);
      }
    }
    // The existence check guards repeat clicks, with the probe run manually between syncs.
    if (await this.adapter.exists(name)) throw Error('样本路径已存在，请保留现场');
    await this.adapter.writeBinary(name, bytes.buffer);
    const actual = new Uint8Array(await this.adapter.readBinary(name));
    if (toHex(actual) !== toHex(bytes)) throw Error('投放后读回字节有差异');
    this.state.seeds.push({round, name, size: actual.length, sha256: await sha256(actual), at: new Date().toISOString()});
    await this.saveData(this.state);
    new Notice('A4 第 ' + round + ' 轮已投放，可运行坚果云同步。');
  }

  async snapshot() {
    const entries = new Map();
    const files = [];
    if (!(await this.adapter.exists(this.dir))) return {entries, files};
    const listing = await this.adapter.list(this.dir);
    if (listing.files.length + listing.folders.length > 32) throw Error('超出 32 项合成文件盘点上限');
    for (const name of listing.folders.sort()) files.push({name, kind: 'folder'});
    for (const name of listing.files.sort()) {
      if (!name.startsWith(this.dir + '/') || name.slice(this.dir.length + 1).includes('/')) {
        throw Error('unexpected-path');
      }
      const stat = await this.adapter.stat(name);
      if (!stat || stat.type !== 'file' || stat.size > 4096) {
        files.push({name, kind: 'skipped', size: stat?.size});
        continue;
      }
      const bytes = new Uint8Array(await this.adapter.readBinary(name));
      if (bytes.length > 4096) throw Error('fixture-byte-budget');
      entries.set(name, bytes);
      files.push({name, kind: 'file', size: bytes.length, sha256: await sha256(bytes), hex: toHex(bytes)});
    }
    return {entries, files};
  }

  async capture(round) {
    const {entries, files} = await this.snapshot();
    const result = await inspectSnapshot(this.state.suite, entries);
    const pass = files.length === entries.size && matchesRound(round, entries, result, this.fixtures, PROBE_BUILD.ids);
    return {round, at: new Date().toISOString(), pass, files, result};
  }

  async scan(round) {
    const checkpoint = await this.capture(round);
    this.state.checkpoints.push(checkpoint);
    await this.saveData(this.state);
    const result = checkpoint.result;
    new Notice('A4 第 ' + round + ' 轮' + (checkpoint.pass ? '符合预期' : '有差异，请导出报告') +
      ' · 文件 ' + checkpoint.files.length + ' · 就绪 ' + result.ready.length +
      ' · 等待 ' + result.pending.length + ' · 阻塞 ' + result.blockers.length +
      ' · 已补全截断 ' + result.superseded.length + ' · 隔离 ' + result.quarantined.length, 12000);
  }

  async exportReport() {
    const {role, suite, seeds, checkpoints} = this.state;
    const name = 'SYNC-A4-Attempt-' + role + '-' + Date.now() + '.json';
    let final;
    try {
      final = await this.capture(4);
    } catch (error) {
      final = {round: 4, error: error.message};
    }
    const build = new Uint8Array(await this.adapter.readBinary(this.manifest.dir + '/main.js'));
    const report = {version: 1, suite, role, buildSha256: await sha256(build),
      obsidian: apiVersion, mobile: Platform.isMobile, nutstore: this.app.plugins?.manifests?.['nutstore-sync']?.version ?? null,
      seeds, checkpoints, final};
    await this.app.vault.create(name, JSON.stringify(report, null, 2) + '\n');
    new Notice('A4 报告已写到库根目录 · ' + name, 15000);
  }
};
