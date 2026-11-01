const { Plugin, ItemView, Notice } = require('obsidian');
const VIEW_TYPE = 'knowledge-graph-smoke-view';

class KnowledgeGraphView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.generation = 0; }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return '知识图谱 · 冒烟'; }
  getIcon() { return 'network'; }

  async onOpen() {
    const generation = ++this.generation;
    this.contentEl.classList.add('kg-smoke-content');
    this.contentEl.textContent = '正在载入图谱快照…';
    try {
      const text = await this.app.vault.adapter.read(this.plugin.manifest.dir + '/smoke-payload.json');
      const payload = JSON.parse(text);
      if (!Array.isArray(payload.nodes) || !Array.isArray(payload.edges) || !payload.meta) {
        throw new Error('图谱快照缺少 nodes / edges / meta');
      }
      if (generation !== this.generation) return;
      this.contentEl.replaceChildren();
      const doc = this.contentEl.ownerDocument, win = doc.defaultView;
      const host = doc.createElement('div');
      host.className = 'kg-smoke-host';
      this.contentEl.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      const style = doc.createElement('style');
      style.textContent = GRAPH_CSS;
      shadow.appendChild(style);
      const surface = doc.createElement('div');
      surface.className = 'kg-surface';
      surface.tabIndex = 0;
      surface.setAttribute('aria-label', '知识图谱冒烟画布');
      surface.innerHTML = GRAPH_HTML;
      shadow.appendChild(surface);
      const data = doc.createElement('script');
      data.type = 'application/json';
      data.id = 'graph-data';
      data.textContent = text;
      surface.appendChild(data);
      this.host = host;
      const scope = createScope(host, shadow, surface);
      // View.scope belongs to Obsidian's keyboard handler; never overwrite it.
      this.graphHostScope = scope;
      runUpstream(scope, surface);
      scope.finishSetup();
      this.graph = scope.window.KG;
      let previousSize = '';
      const refresh = () => {
        const visible = host.isConnected && host.getClientRects().length > 0 &&
          host.clientWidth > 0 && host.clientHeight > 0 && !doc.hidden;
        scope.setActive(visible);
        const size = host.clientWidth + ':' + host.clientHeight + ':' + win.devicePixelRatio;
        if (visible && size !== previousSize) { previousSize = size; scope.resize(); }
      };
      scope.trackObserver(new win.ResizeObserver(refresh)).observe(host);
      scope.trackObserver(new win.IntersectionObserver(refresh)).observe(host);
      scope.listen(doc, 'visibilitychange', refresh);
      scope.listen(win, 'resize', refresh);
      // A DPR change can occur independently of CSS dimensions.
      let dprQuery;
      const onDpr = () => {
        dprQuery?.removeEventListener('change', onDpr);
        dprQuery = win.matchMedia('(resolution: ' + win.devicePixelRatio + 'dppx)');
        dprQuery.addEventListener('change', onDpr, { once: true });
        refresh();
      };
      onDpr();
      this.removeDpr = () => dprQuery?.removeEventListener('change', onDpr);
      this.layoutEvents = [
        this.app.workspace.on('layout-change', refresh),
        this.app.workspace.on('active-leaf-change', refresh),
      ];
      refresh();
      this.contentEl.dataset.smokeReady = 'true';
    } catch (error) {
      if (generation !== this.generation) return;
      this.release();
      this.contentEl.textContent = '图谱冒烟加载失败：' + error.message;
      console.error('[knowledge-graph-smoke]', error);
    }
  }

  release() {
    this.removeDpr?.();
    this.removeDpr = null;
    for (const ref of this.layoutEvents || []) this.app.workspace.offref(ref);
    this.layoutEvents = [];
    this.graphHostScope?.dispose();
    this.graphHostScope = null;
    this.graph = null;
    this.host?.remove();
    this.host = null;
    delete this.contentEl.dataset.smokeReady;
  }
  async onClose() { ++this.generation; this.release(); this.contentEl.replaceChildren(); }
}

module.exports = class KnowledgeGraphSmokePlugin extends Plugin {
  async onload() {
    this.registerView(VIEW_TYPE, leaf => new KnowledgeGraphView(leaf, this));
    this.addCommand({ id: 'open-graph-smoke', name: '打开知识图谱冒烟',
      callback: () => this.openGraph() });
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
