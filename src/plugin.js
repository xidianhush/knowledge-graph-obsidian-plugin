const { Plugin, ItemView, Notice, parseYaml, MarkdownRenderer, Component, Scope, addIcon } = require('obsidian');
const KNOWLEDGE_MAP_ICON_ID = 'knowledge-map';
// Hub with three satellites: two links pass through the outer ring to the inner node,
// the third stops at the ring. Single-color path so Obsidian can recolor it.
const KNOWLEDGE_MAP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"><circle cx="50" cy="50" r="24"/><path d="M21 50 H41"/><path d="M81 22.3 L56.7 44"/><path d="M78.2 76.5 L67.5 66.4"/><circle cx="50" cy="50" r="9"/><circle cx="13" cy="50" r="8"/><circle cx="87" cy="17" r="8"/><circle cx="84" cy="82" r="8"/></svg>';
const VIEW_TYPE = 'knowledge-graph-smoke-view';
const VAULT_VIEW_TYPE = 'knowledge-graph-vault-view';

class KnowledgeGraphView extends ItemView {
  constructor(leaf, plugin, source = 'snapshot') {
    super(leaf); this.plugin = plugin; this.generation = 0; this.source = source;
    this.watchEvents = []; this.layoutEvents = []; this.updateTimer = null; this.closed = true;
    this.statusTimer = null;
    // The host handles Escape before bubbling DOM listeners; claim it only in this view.
    this.scope = new Scope(this.app.scope);
    this.scope.register([], 'Escape', event => {
      if (this.closed || !this.graph || this.app.workspace.activeLeaf !== this.leaf) return;
      this.graph.dismiss();
      event.stopPropagation();
      return false;
    });
    for (const [modifiers,key,command] of [[['Mod'],'z','undo'],[['Mod','Shift'],'z','redo'],[['Mod'],'y','redo']]) {
      this.scope.register(modifiers,key,event=>{
        if(this.closed || this.app.workspace.activeLeaf!==this.leaf || !this.graph?.layoutCommand(command))return;
        event.preventDefault();event.stopPropagation();return false;
      });
    }
  }
  getViewType() { return this.source === 'vault' ? VAULT_VIEW_TYPE : VIEW_TYPE; }
  getDisplayText() { return this.source === 'vault' ? '知识图谱 · 当前库' : '知识图谱 · 冒烟'; }
  getIcon() { return KNOWLEDGE_MAP_ICON_ID; }
  async onOpen() {
    this.closed = false;
    this.contentEl.classList.add('kg-smoke-content');
    if (this.source === 'vault' && !this.watchEvents.length) this.watchVault();
    await this.rebuild();
  }
  watchVault() {
    const vault = this.app.vault;
    const changed = (file, oldPath) => {
      if (this.closed || this.plugin.graphSettings.autoUpdate === false) return;
      // Folder renames/deletes can move many notes without per-note rename events.
      const paths = [file.path, oldPath].filter(Boolean);
      const folder = Array.isArray(file.children);
      if (!folder && !paths.some(path => /\.md$/i.test(path))) return;
      try {
        const config = graphScopeConfig(this.plugin);
        if (!folder && !paths.some(path => selectGraphFiles([{ path }], config).files.length)) return;
      } catch { /* Let rebuild report invalid configuration while retaining the old graph. */ }
      ++this.generation; this.buildController?.abort();
      this.nativeServices?.preview.hide();
      const win = this.contentEl.ownerDocument.defaultView;
      win.clearTimeout(this.updateTimer);
      delete this.contentEl.dataset.pipelineUpdating;
      this.progress('笔记已变更，等待自动更新…', 'waiting');
      this.updateTimer = win.setTimeout(() => { this.updateTimer = null; void this.rebuild(); }, this.plugin.graphSettings.debounceMs ?? 350);
    };
    for (const name of ['create', 'modify', 'delete', 'rename']) this.watchEvents.push(vault.on(name, changed));
  }
  rebuildButton() { return this.host?.shadowRoot?.getElementById('rebuild') || null; }
  syncRebuildButton(phase) {
    const button = this.rebuildButton();
    if (!button) return;
    const busy = phase === 'building' || phase === 'waiting';
    button.disabled = busy;
    button.classList.toggle('is-busy', busy);
    // 顶栏按钮只有字形（见 src/host.css），含义靠 title/aria-label 携带，构建中同步更新。
    const name = busy ? '正在重新构建图谱' : '重新构建当前库的图谱（不用关开视图）';
    button.setAttribute('title', name);
    button.setAttribute('aria-label', name);
    const label = button.querySelector('.kg-action-label');
    if (label) label.textContent = busy ? '构建中…' : '重新构建';
  }
  progress(message, phase = 'building') {
    this.buildState = { phase, message, updatedAt: Date.now() };
    this.contentEl.dataset.buildPhase = phase;
    this.syncRebuildButton(phase);
    const win = this.contentEl.ownerDocument.defaultView;
    win.clearTimeout(this.statusTimer); this.statusTimer = null;
    if (!this.statusEl?.isConnected) {
      if (!this.session) this.contentEl.replaceChildren();
      this.statusEl = this.contentEl.appendChild(this.contentEl.ownerDocument.createElement('div'));
      this.statusEl.className = 'kg-build-status';
    }
    this.statusEl.replaceChildren();
    const text = this.statusEl.appendChild(this.contentEl.ownerDocument.createElement('span'));
    text.setAttribute('role', 'status'); text.setAttribute('aria-live', 'polite'); text.textContent = message;
    // 重建入口常驻顶栏；状态条只保留「构建中可取消」与「还没有图谱可看时」的按钮，
    // 避免与顶栏按钮重复。取消/失败/空库提示保留到下一次构建。
    if (this.source === 'vault') {
      const busy = ['building', 'waiting'].includes(phase);
      if (busy || !this.session) {
        const button = this.statusEl.appendChild(this.contentEl.ownerDocument.createElement('button'));
        button.textContent = busy ? '取消' : '重新构建';
        button.onclick = () => busy ? this.cancelBuild() : void this.rebuild();
      }
    }
    // 构建完成提示约 2 秒后自动消失，不再常驻遮挡画布底部。
    if (phase === 'ready') {
      this.statusTimer = win.setTimeout(() => {
        this.statusTimer = null;
        this.statusEl?.remove(); this.statusEl = null;
      }, 2000);
    }
  }
  cancelBuild() {
    ++this.generation; this.buildController?.abort(); this.buildController = null;
    this.contentEl.ownerDocument.defaultView.clearTimeout(this.updateTimer); this.updateTimer = null;
    delete this.contentEl.dataset.pipelineUpdating;
    this.progress('本次构建已取消' + (this.session ? '（仍显示上次成功的图谱）' : '') + '；后续变动仍按自动更新设置处理。', 'cancelled');
  }
  applySettings() {
    this.nativeServices?.preview.hide();
    return this.rebuild();
  }
  async rebuild() {
    if (this.closed) return;
    this.graph?.renderer.cancelInteraction();
    const win = this.contentEl.ownerDocument.defaultView;
    win.clearTimeout(this.updateTimer); this.updateTimer = null;
    const generation = ++this.generation;
    const started = win.performance.now();
    this.buildController?.abort();
    this.nativeServices?.preview.hide();
    const controller = this.buildController = new AbortController();
    this.contentEl.dataset.pipelineUpdating = 'true';
    this.progress(this.source === 'vault' ? '正在读取当前库…' : '正在载入图谱快照…');
    const layoutEpoch=this.plugin.layoutEpoch;
    let nextSession, nextServices;
    try {
      const payload = this.source === 'vault'
        ? await buildVaultGraph(this.plugin, win, controller.signal, message => {
          if (generation === this.generation) this.progress(message);
        })
        : await this.app.vault.adapter.read(this.plugin.manifest.dir + '/smoke-payload.json');
      this.graph?.renderer.cancelInteraction();
      if(this.source==='vault')await this.plugin.layoutStore.settled();
      if (generation !== this.generation || this.closed) return;
      if (this.source === 'vault' && !payload.nodes.length) {
        this.releaseSession(); this.contentEl.replaceChildren();
        this.progress('当前范围内没有可显示的 Markdown 笔记。请检查设置中的包含与排除范围。', 'empty');
        this.contentEl.dataset.pipelineEmpty = 'true'; return;
      }
      const state = this.graph?.captureState();
      if (!this.session) this.contentEl.replaceChildren();
      if (this.source === 'vault') {
        nextServices = createNativeGraphServices(this);
        nextServices.layoutStore = this.plugin.layoutStore;
        nextServices.onRebuild = () => { if (!this.closed) void this.rebuild(); };
        const decoded=decodeGraphPayload(payload);
        await this.plugin.layoutStore.reconcile(createLayoutModel(decoded.nodes,decoded.meta.layout_root_radius),
          ()=>generation===this.generation && !this.closed && !controller.signal.aborted && layoutEpoch===this.plugin.layoutEpoch);
        if(generation!==this.generation || this.closed || controller.signal.aborted || layoutEpoch!==this.plugin.layoutEpoch){nextServices?.dispose?.();return;}
        const shape=JSON.stringify(decoded.nodes.map(n=>[n.id,n.parent,n.r,n.kind,n.title]));
        if(this.layoutShape && this.layoutShape!==shape)this.plugin.layoutStore.clearHistory();
        this.layoutShape=shape;
      }
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
      if (this.source === 'vault') {
        this.progress('构建完成 · ' + payload.meta.note_count + ' 篇笔记 · ' + payload.nodes.length + ' 个节点 · ' + payload.edges.length + ' 条边 · ' + ((win.performance.now() - started) / 1000).toFixed(2) + ' 秒' + (this.plugin.graphSettings.autoUpdate === false ? ' · 自动更新已关闭' : ''), 'ready');
      }
    } catch (error) {
      nextSession?.dispose(); nextServices?.dispose();
      if (generation !== this.generation || this.closed || controller.signal.aborted) return;
      this.progress('图谱更新失败：' + error.message + (this.session ? '（仍显示上次成功的图谱）' : ''), 'error');
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
    this.contentEl.ownerDocument.defaultView.clearTimeout(this.statusTimer); this.statusTimer = null;
    for (const ref of this.watchEvents) this.app.vault.offref(ref);
    this.watchEvents = [];
    this.releaseSession(); this.statusEl = null;
    delete this.contentEl.dataset.pipelineEmpty; delete this.contentEl.dataset.pipelineUpdating; delete this.contentEl.dataset.buildPhase;
  }
  async onClose() { this.closed = true; ++this.generation; this.release(); this.contentEl.replaceChildren(); }
}

module.exports = class KnowledgeGraphSmokePlugin extends Plugin {
  async onload() {
    const saved = await this.loadData();
    this.savedData = graphSettingsDraft(saved || {});
    this.pipelineSettings = this.savedData.pipeline;
    this.graphSettings = this.savedData.settings;
    this.settingsSaveQueue = Promise.resolve();
    this.layoutEpoch=0;
    for(const event of ['modify','create','delete','rename'])this.registerEvent(this.app.vault.on(event,()=>{this.layoutEpoch++;}));
    this.layoutStore = createLayoutStore(this.savedData.layoutOverrides, layout => {
      const operation=this.settingsSaveQueue.catch(()=>{}).then(async()=>{
        const data={...this.savedData,layoutOverrides:layout};
        try { await this.saveData(data); } catch(error) { new Notice('布局保存失败，已恢复上次保存的位置：'+error.message); throw error; }
        this.savedData=data;
      });
      this.settingsSaveQueue=operation;return operation;
    });
    for(const event of ['rename','delete'])this.registerEvent(this.app.vault.on(event,(file,oldPath)=>{
      const folder=Array.isArray(file.children);
      if(!folder && !/\.md$/i.test(file.path) && !/\.md$/i.test(oldPath||''))return;
      for(const leaf of this.app.workspace.getLeavesOfType(VAULT_VIEW_TYPE))leaf.view.graph?.renderer.cancelInteraction();
      void this.layoutStore.changePath(oldPath||file.path,event==='rename'?file.path:null,folder,
        !(this.pipelineSettings.config.remap||[]).length).catch(error=>new Notice('布局保存失败：'+error.message));
    }));
    this.pipelineResources = { active: 0, started: 0, stopped: 0 };
    this.registerView(VIEW_TYPE, leaf => new KnowledgeGraphView(leaf, this));
    this.registerView(VAULT_VIEW_TYPE, leaf => new KnowledgeGraphView(leaf, this, 'vault'));
    this.addCommand({ id: 'open-graph-smoke', name: '打开知识图谱冒烟', callback: () => this.openGraph() });
    this.addCommand({ id: 'build-vault-graph', name: '从当前库构建知识图谱', callback: () => this.openGraph('vault', true) });
    addIcon(KNOWLEDGE_MAP_ICON_ID, KNOWLEDGE_MAP_ICON);
    this.addRibbonIcon(KNOWLEDGE_MAP_ICON_ID, '从当前库构建知识图谱', () => this.openGraph('vault', true));
    this.addSettingTab(new KnowledgeGraphSettingsTab(this.app, this));
  }
  saveGraphSettings(draft) {
    const data = validateGraphSettings(draft);
    const operation = this.settingsSaveQueue.catch(() => {}).then(async () => {
      // Settings drafts may predate a drag. Always merge the latest layout here.
      if(Object.hasOwn(this.savedData,'layoutOverrides'))data.layoutOverrides=this.savedData.layoutOverrides;
      else delete data.layoutOverrides;
      // A failed disk write leaves the running configuration and graph untouched.
      await this.saveData(data);
      this.savedData = data; this.pipelineSettings = data.pipeline; this.graphSettings = data.settings;
      for (const leaf of this.app.workspace.getLeavesOfType(VAULT_VIEW_TYPE)) void leaf.view.applySettings();
    });
    this.settingsSaveQueue = operation;
    return operation;
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
