const { Plugin, ItemView, Notice, parseYaml } = require('obsidian');
const VIEW_TYPE = 'knowledge-graph-smoke-view';
const VAULT_VIEW_TYPE = 'knowledge-graph-vault-view';

class KnowledgeGraphView extends ItemView {
  constructor(leaf, plugin, source = 'snapshot') { super(leaf); this.plugin = plugin; this.generation = 0; this.source = source; }
  getViewType() { return this.source === 'vault' ? VAULT_VIEW_TYPE : VIEW_TYPE; }
  getDisplayText() { return this.source === 'vault' ? '知识图谱 · 当前库' : '知识图谱 · 冒烟'; }
  getIcon() { return 'network'; }
  async onOpen() {
    const generation = ++this.generation;
    this.release();
    this.contentEl.classList.add('kg-smoke-content');
    this.contentEl.textContent = this.source === 'vault' ? '正在读取当前库…' : '正在载入图谱快照…';
    this.buildController = new AbortController();
    try {
      const text = this.source === 'vault'
        ? await buildVaultGraph(this.plugin,this.contentEl.ownerDocument.defaultView,this.buildController.signal,message => {
          if(generation === this.generation)this.contentEl.textContent=message;
        })
        : await this.app.vault.adapter.read(this.plugin.manifest.dir + '/smoke-payload.json');
      if (generation !== this.generation) return;
      this.contentEl.replaceChildren();
      if(this.source === 'vault' && !text.nodes.length) {
        this.contentEl.textContent = '当前范围内没有可显示的 Markdown 笔记。';
        this.contentEl.dataset.pipelineEmpty = 'true';
        return;
      }
      this.session = mountGraph(this.contentEl, text);
      this.host = this.session.host;
      this.graph = this.session.graph;
      // View.scope belongs to Obsidian's keyboard handler. Keep the QA alias separate.
      this.graphHostScope = this.session;
      this.layoutEvents = [
        this.app.workspace.on('layout-change', this.session.refresh),
        this.app.workspace.on('active-leaf-change', this.session.refresh),
      ];
      this.session.refresh();
      this.contentEl.dataset.smokeReady = 'true';
    } catch (error) {
      if (generation !== this.generation) return;
      this.release();
      this.contentEl.textContent = '图谱加载失败：' + error.message;
      console.error('[knowledge-graph-smoke]', error);
    }
  }
  release() {
    this.buildController?.abort();
    this.buildController = null;
    for (const ref of this.layoutEvents || []) this.app.workspace.offref(ref);
    this.layoutEvents = [];
    this.session?.dispose();
    this.session = this.graphHostScope = this.graph = this.host = null;
    delete this.contentEl.dataset.smokeReady;
    delete this.contentEl.dataset.pipelineEmpty;
  }
  async onClose() { ++this.generation; this.release(); this.contentEl.replaceChildren(); }
}

module.exports = class KnowledgeGraphSmokePlugin extends Plugin {
  async onload() {
    const saved = await this.loadData();
    this.pipelineSettings = saved?.pipeline || {};
    this.pipelineResources = {active:0,started:0,stopped:0};
    this.registerView(VIEW_TYPE, leaf => new KnowledgeGraphView(leaf, this));
    this.registerView(VAULT_VIEW_TYPE, leaf => new KnowledgeGraphView(leaf, this, 'vault'));
    this.addCommand({ id: 'open-graph-smoke', name: '打开知识图谱冒烟', callback: () => this.openGraph() });
    this.addCommand({ id: 'build-vault-graph', name: '从当前库构建知识图谱', callback: () => this.openGraph('vault',true) });
    this.addRibbonIcon('network', '从当前库构建知识图谱', () => this.openGraph('vault',true));
  }
  async openGraph(source = 'snapshot', rebuild = false) {
    try {
      const type = source === 'vault' ? VAULT_VIEW_TYPE : VIEW_TYPE;
      const existing = this.app.workspace.getLeavesOfType(type)[0];
      const leaf = existing || this.app.workspace.getLeaf('tab');
      await leaf.setViewState({ type, active: true });
      if(existing && rebuild)await leaf.view.onOpen();
      await this.app.workspace.revealLeaf(leaf);
    } catch (error) { new Notice('无法打开知识图谱：' + error.message); }
  }
  onunload() { this.app.workspace.detachLeavesOfType(VIEW_TYPE); this.app.workspace.detachLeavesOfType(VAULT_VIEW_TYPE); }
};
