const { Plugin, ItemView, Notice } = require('obsidian');
const VIEW_TYPE = 'knowledge-graph-smoke-view';

class KnowledgeGraphView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.generation = 0; }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return '知识图谱 · 冒烟'; }
  getIcon() { return 'network'; }
  async onOpen() {
    const generation = ++this.generation;
    this.release();
    this.contentEl.classList.add('kg-smoke-content');
    this.contentEl.textContent = '正在载入图谱快照…';
    try {
      const text = await this.app.vault.adapter.read(this.plugin.manifest.dir + '/smoke-payload.json');
      if (generation !== this.generation) return;
      this.contentEl.replaceChildren();
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
      this.contentEl.textContent = '图谱冒烟加载失败：' + error.message;
      console.error('[knowledge-graph-smoke]', error);
    }
  }
  release() {
    for (const ref of this.layoutEvents || []) this.app.workspace.offref(ref);
    this.layoutEvents = [];
    this.session?.dispose();
    this.session = this.graphHostScope = this.graph = this.host = null;
    delete this.contentEl.dataset.smokeReady;
  }
  async onClose() { ++this.generation; this.release(); this.contentEl.replaceChildren(); }
}

module.exports = class KnowledgeGraphSmokePlugin extends Plugin {
  async onload() {
    this.registerView(VIEW_TYPE, leaf => new KnowledgeGraphView(leaf, this));
    this.addCommand({ id: 'open-graph-smoke', name: '打开知识图谱冒烟', callback: () => this.openGraph() });
    this.addRibbonIcon('network', '打开知识图谱冒烟', () => this.openGraph());
  }
  async openGraph() {
    try {
      const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0] || this.app.workspace.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
      await this.app.workspace.revealLeaf(leaf);
    } catch (error) { new Notice('无法打开知识图谱：' + error.message); }
  }
  onunload() { this.app.workspace.detachLeavesOfType(VIEW_TYPE); }
};
