const { Plugin, ItemView, Notice, parseYaml, MarkdownRenderer, Component } = require('obsidian');
const VIEW_TYPE = 'knowledge-graph-smoke-view';
const VAULT_VIEW_TYPE = 'knowledge-graph-vault-view';

class KnowledgeGraphView extends ItemView {
  constructor(leaf, plugin, source = 'snapshot') {
    super(leaf); this.plugin = plugin; this.generation = 0; this.source = source;
    this.watchEvents = []; this.layoutEvents = []; this.updateTimer = null; this.closed = true;
  }
  getViewType() { return this.source === 'vault' ? VAULT_VIEW_TYPE : VIEW_TYPE; }
  getDisplayText() { return this.source === 'vault' ? '知识图谱 · 当前库' : '知识图谱 · 冒烟'; }
  getIcon() { return 'network'; }
  async onOpen() {
    this.closed = false;
    this.contentEl.classList.add('kg-smoke-content');
    if (this.source === 'vault' && !this.watchEvents.length) this.watchVault();
    await this.rebuild();
  }
  watchVault() {
    const vault = this.app.vault;
    const changed = (file, oldPath) => {
      if (this.closed) return;
      // Folder renames/deletes can move many notes without per-note rename events.
      const paths = [file.path, oldPath].filter(Boolean);
      const folder = Array.isArray(file.children);
      if (!folder && !paths.some(path => /\.md$/i.test(path))) return;
      try {
        const config = pipelineConfig({ include: ['**'], ...this.plugin.pipelineSettings.config });
        config.exclude.push('Utilities/API Key.md');
        if (!folder && !paths.some(path => selectGraphFiles([{ path }], config).files.length)) return;
      } catch { /* Let rebuild report invalid configuration while retaining the old graph. */ }
      ++this.generation; this.buildController?.abort();
      this.nativeServices?.preview.hide();
      const win = this.contentEl.ownerDocument.defaultView;
      win.clearTimeout(this.updateTimer);
      this.updateTimer = win.setTimeout(() => { this.updateTimer = null; void this.rebuild(); }, 350);
    };
    for (const name of ['create', 'modify', 'delete', 'rename']) this.watchEvents.push(vault.on(name, changed));
  }
  progress(message) {
    if (!this.session) { this.contentEl.textContent = message; this.statusEl = null; return; }
    if (!this.statusEl?.isConnected) {
      this.statusEl = this.contentEl.appendChild(this.contentEl.ownerDocument.createElement('div'));
      this.statusEl.className = 'kg-build-status'; this.statusEl.setAttribute('role', 'status');
    }
    this.statusEl.textContent = message;
  }
  async rebuild() {
    if (this.closed) return;
    const win = this.contentEl.ownerDocument.defaultView;
    win.clearTimeout(this.updateTimer); this.updateTimer = null;
    const generation = ++this.generation;
    this.buildController?.abort();
    const controller = this.buildController = new AbortController();
    this.contentEl.dataset.pipelineUpdating = 'true';
    this.progress(this.source === 'vault' ? '正在读取当前库…' : '正在载入图谱快照…');
    let nextSession, nextServices;
    try {
      const payload = this.source === 'vault'
        ? await buildVaultGraph(this.plugin, win, controller.signal, message => {
          if (generation === this.generation) this.progress(message);
        })
        : await this.app.vault.adapter.read(this.plugin.manifest.dir + '/smoke-payload.json');
      if (generation !== this.generation || this.closed) return;
      if (this.source === 'vault' && !payload.nodes.length) {
        this.releaseSession(); this.contentEl.textContent = '当前范围内没有可显示的 Markdown 笔记。';
        this.contentEl.dataset.pipelineEmpty = 'true'; return;
      }
      const state = this.graph?.captureState();
      if (!this.session) this.contentEl.replaceChildren();
      if (this.source === 'vault') nextServices = createNativeGraphServices(this);
      nextSession = mountGraph(this.contentEl, payload, nextServices || {});
      if (state) nextSession.graph.restoreState(state);
      this.releaseSession();
      this.session = nextSession; this.nativeServices = nextServices;
      this.host = nextSession.host; this.graph = nextSession.graph;
      // View.scope is reserved for Obsidian's keyboard handler.
      this.graphHostScope = nextSession;
      this.layoutEvents = [
        this.app.workspace.on('layout-change', nextSession.refresh),
        this.app.workspace.on('active-leaf-change', nextSession.refresh),
      ];
      this.session.refresh(); this.statusEl?.remove(); this.statusEl = null;
      delete this.contentEl.dataset.pipelineEmpty;
      this.contentEl.dataset.smokeReady = 'true';
      this.contentEl.dataset.graphRevision = String(generation);
    } catch (error) {
      nextSession?.dispose(); nextServices?.dispose();
      if (generation !== this.generation || this.closed || controller.signal.aborted) return;
      this.progress('图谱更新失败：' + error.message + (this.session ? '（仍显示上次成功的图谱）' : ''));
      console.error('[knowledge-graph-smoke]', error);
    } finally {
      if (generation === this.generation) {
        this.buildController = null; delete this.contentEl.dataset.pipelineUpdating;
      }
    }
  }
  releaseSession() {
    for (const ref of this.layoutEvents) this.app.workspace.offref(ref);
    this.layoutEvents = [];
    this.session?.dispose(); this.nativeServices?.dispose();
    this.nativeServices = null;
    this.session = this.graphHostScope = this.graph = this.host = null;
    delete this.contentEl.dataset.smokeReady;
  }
  release() {
    this.buildController?.abort(); this.buildController = null;
    this.contentEl.ownerDocument.defaultView.clearTimeout(this.updateTimer); this.updateTimer = null;
    for (const ref of this.watchEvents) this.app.vault.offref(ref);
    this.watchEvents = [];
    this.releaseSession(); this.statusEl = null;
    delete this.contentEl.dataset.pipelineEmpty; delete this.contentEl.dataset.pipelineUpdating;
  }
  async onClose() { this.closed = true; ++this.generation; this.release(); this.contentEl.replaceChildren(); }
}

module.exports = class KnowledgeGraphSmokePlugin extends Plugin {
  async onload() {
    const saved = await this.loadData();
    this.pipelineSettings = saved?.pipeline || {};
    this.pipelineResources = { active: 0, started: 0, stopped: 0 };
    this.registerView(VIEW_TYPE, leaf => new KnowledgeGraphView(leaf, this));
    this.registerView(VAULT_VIEW_TYPE, leaf => new KnowledgeGraphView(leaf, this, 'vault'));
    this.addCommand({ id: 'open-graph-smoke', name: '打开知识图谱冒烟', callback: () => this.openGraph() });
    this.addCommand({ id: 'build-vault-graph', name: '从当前库构建知识图谱', callback: () => this.openGraph('vault', true) });
    this.addRibbonIcon('network', '从当前库构建知识图谱', () => this.openGraph('vault', true));
  }
  async openGraph(source = 'snapshot', rebuild = false) {
    try {
      const type = source === 'vault' ? VAULT_VIEW_TYPE : VIEW_TYPE;
      const existing = this.app.workspace.getLeavesOfType(type)[0];
      const leaf = existing || this.app.workspace.getLeaf('tab');
      await leaf.setViewState({ type, active: true });
      if (existing && rebuild) await leaf.view.rebuild();
      await this.app.workspace.revealLeaf(leaf);
    } catch (error) { new Notice('无法打开知识图谱：' + error.message); }
  }
  onunload() { this.app.workspace.detachLeavesOfType(VIEW_TYPE); this.app.workspace.detachLeavesOfType(VAULT_VIEW_TYPE); }
};
