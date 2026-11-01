/** Obsidian-only services. The shared HUD receives callbacks, never host objects. */
function prepareNativePreview(body, targetLine, marker, requestedLimit) {
  // Character limits alone do not bound Markdown/MathJax/image work. Keep a small
  // native excerpt, starting at the requested heading when the whole note is heavy.
  const limit = Math.min(requestedLimit, 12000);
  const lines = body.split('\n');
  const mathTokens = text => (text.match(/\$|\\\(|\\\[|\\begin\{/g) || []).length;
  const embeds = text => (text.match(/!\[|<(?:img|iframe|video|audio)\b/gi) || []).length;
  const heavy = body.length > limit || mathTokens(body) > 80 || embeds(body) > 6;
  const offset = heavy && targetLine >= 0 ? targetLine : 0;
  let markdown = '', fence = null, dollars = 0, media = 0, truncated = offset > 0;
  for (let i = offset; i < lines.length; i++) {
    let line = lines[i];
    const nextMath = dollars + mathTokens(line), nextMedia = media + embeds(line);
    if (markdown.length + line.length + 1 > limit || nextMath > 80 || nextMedia > 6) {
      truncated = true; break;
    }
    dollars = nextMath; media = nextMedia;
    if (i === targetLine) line = line.replace(/^(\s*#{1,6}\s+)/, '$1<span id="' + marker + '"></span>');
    markdown += line + '\n';
    const match = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (match) {
      if (!fence) fence = match[1];
      else if (match[1][0] === fence[0] && match[1].length >= fence.length && !match[2].trim()) fence = null;
    }
  }
  if (fence) markdown += '\n' + fence + '\n';
  return { markdown, truncated };
}

function createNativeGraphServices(view) {
  const app = view.app, container = view.contentEl, doc = container.ownerDocument, win = doc.defaultView;
  const panel = doc.createElement('section');
  panel.className = 'kg-native-preview'; panel.hidden = true; panel.tabIndex = -1;
  panel.setAttribute('aria-label', '笔记预览');
  const bar = panel.appendChild(doc.createElement('div')); bar.className = 'kg-native-preview-bar';
  const title = bar.appendChild(doc.createElement('span'));
  const open = bar.appendChild(doc.createElement('button')); open.textContent = '打开笔记';
  const close = bar.appendChild(doc.createElement('button')); close.textContent = '关闭'; close.setAttribute('aria-label', '关闭预览');
  const body = panel.appendChild(doc.createElement('div')); body.className = 'kg-native-preview-body markdown-rendered';
  container.appendChild(panel);
  const events = new win.AbortController();
  let disposed = false, generation = 0, child = null, node = null, pinned = false, onHide = () => {}, pending;
  const resources = { created: 0, unloaded: 0, active: 0, rendering: 0, peakRendering: 0 };
  let queued = null, hoverTimer = null, busy = false;
  let position = null, listeners = 0;
  const resize = new win.ResizeObserver(() => { if (!panel.hidden && position) place(...position); });
  resize.observe(container);
  function releaseComponent() {
    if (!child) return;
    view.removeChild(child); child = null; resources.unloaded++; resources.active--;
  }
  function hide() {
    if (hoverTimer !== null) win.clearTimeout(hoverTimer);
    hoverTimer = null;
    queued?.resolve(); queued = null;
    ++generation; releaseComponent(); node = null; pending = null; pinned = false;
    panel.hidden = true; delete panel.dataset.ready; body.replaceChildren(); onHide();
  }
  function place(cx, cy) {
    const rect = container.getBoundingClientRect(), w = panel.offsetWidth, h = panel.offsetHeight;
    const x = cx - rect.left, y = cy - rect.top;
    panel.style.left = Math.max(8, Math.min(x + 18 + w > rect.width ? x - w - 18 : x + 18, rect.width - w - 8)) + 'px';
    panel.style.top = Math.max(8, Math.min(y + 18 + h > rect.height ? y - h - 18 : y + 18, rect.height - h - 8)) + 'px';
  }
  async function openNote(target) {
    try {
      if (!target?.path) throw new Error('这个元素没有对应的笔记');
      if (!graphPathAllowed(view.plugin, target.path)) throw new Error('这篇笔记不在当前建图范围内');
      const file = app.vault.getAbstractFileByPath(target.path);
      if (!file || file.extension !== 'md') throw new Error('笔记已删除或移动，请等待图谱更新');
      let line = 0;
      if (target.kind === 'heading') {
        const current = parseGraphNote({ text: await app.vault.cachedRead(file), id: target.note }, parseYaml);
        const heading = current.headings.find(h => h.id === target.id);
        if (!heading) throw new Error('标题已变更，请等待图谱更新');
        line = heading.line - 1;
      }
      // Open a separate tab so navigating does not replace the graph itself.
      const leaf = app.workspace.getLeaf('tab');
      await leaf.openFile(file, { active: true, eState: { line } });
      hide();
    } catch (error) { new Notice(error.message); }
  }
  async function render(target, token, cx, cy) {
    if (!graphPathAllowed(view.plugin, target.path)) throw new Error('这篇笔记不在当前建图范围内');
    const file = app.vault.getAbstractFileByPath(target.path);
    if (!file || file.extension !== 'md') throw new Error('笔记已删除或移动');
    const text = await app.vault.cachedRead(file);
    if (disposed || token !== generation) return;
    const parsed = target.kind === 'heading'
      ? parseGraphNote({ text, id: target.note }, parseYaml)
      : splitGraphFrontmatter({ text }, parseYaml);
    const heading = parsed.headings?.find(h => h.id === target.id);
    if (target.kind === 'heading' && !heading) throw new Error('标题已变更，请等待图谱更新');
    const targetLine = target.kind === 'heading' ? Math.max(0, heading.line - parsed.offset - 1) : -1;
    const marker = 'kg-native-target-' + token;
    const configured = Number(view.plugin.pipelineSettings?.config?.preview?.max_note_chars);
    const limit = Number.isFinite(configured) && configured > 0 ? Math.max(1, Math.floor(configured)) : 60000;
    const { markdown, truncated } = prepareNativePreview(parsed.body, targetLine, marker, limit);
    child = new Component(); view.addChild(child); resources.created++; resources.active++;
    const component = child;
    body.replaceChildren();
    const content = body.appendChild(doc.createElement('div'));
    await MarkdownRenderer.render(app, markdown, content, target.path, component);
    if (disposed || token !== generation) { content.remove(); return; }
    if (truncated) { const hint = body.appendChild(doc.createElement('p')); hint.className = 'kg-native-preview-hint'; hint.textContent = '内容较多，预览已截取；打开笔记查看全文。'; }
    const anchor = content.querySelector('#' + marker);
    body.scrollTop = anchor ? Math.max(0, anchor.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 12) : 0;
    place(cx, cy); panel.dataset.ready = 'true';
  }
  async function drain() {
    if (disposed || busy || !queued || hoverTimer !== null) return;
    const request = queued; queued = null; busy = true;
    resources.rendering++; resources.peakRendering = Math.max(resources.peakRendering, resources.rendering);
    try {
      await render(request.target, request.token, ...request.position);
    } catch (error) {
      if (request.token === generation && !disposed) { releaseComponent(); body.textContent = '预览失败：' + error.message; }
    } finally {
      busy = false; resources.rendering--; request.resolve();
      void drain();
    }
  }
  function show(target, cx, cy, pin) {
    if (disposed || view.plugin.pipelineSettings?.config?.preview?.enabled === false || !graphPathAllowed(view.plugin, target?.path) || target.kind === 'folder') { hide(); return Promise.resolve(); }
    position = [cx, cy];
    if (node?.id === target.id && !panel.hidden) {
      pinned = !!pin; place(cx, cy);
      if (pin && hoverTimer !== null) { win.clearTimeout(hoverTimer); hoverTimer = null; void drain(); }
      return pending;
    }
    hide(); node = target; pinned = !!pin; panel.hidden = false;
    title.textContent = target.path + (target.kind === 'heading' ? ' › ' + target.title : '');
    body.textContent = '正在读取笔记…'; place(cx, cy);
    pending = new Promise(resolve => {
      queued = { target, token: generation, position: [cx, cy], resolve };
    });
    if (!pin) hoverTimer = win.setTimeout(() => { hoverTimer = null; void drain(); }, 120);
    else void drain();
    return pending;
  }
  const listen = (el, type, fn, capture = false) => {
    listeners++; el.addEventListener(type, fn, { signal: events.signal, capture });
  };
  listen(panel, 'mousedown', () => { pinned = true; }, true);
  listen(close, 'click', hide);
  listen(open, 'click', () => openNote(node));
  listen(panel, 'keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); hide(); view.host?.shadowRoot?.querySelector('.kg-surface')?.focus(); } });
  listen(panel, 'click', event => {
    const link = event.target.closest?.('a.internal-link');
    if (!link || !node) return;
    event.preventDefault(); event.stopPropagation();
    const href = link.getAttribute('data-href') || link.getAttribute('href');
    let source = node.path;
    const embeds = [];
    for (let el = link.parentElement; el && el !== body; el = el.parentElement) {
      if (el.matches('.internal-embed[data-src]')) embeds.unshift(el.getAttribute('data-src'));
    }
    for (const embed of embeds) {
      const file = app.metadataCache.getFirstLinkpathDest(embed.split('#')[0], source);
      if (file?.extension === 'md') source = file.path;
    }
    if (href) app.workspace.openLinkText(href, source, 'tab').then(hide).catch(error => new Notice(error.message));
  }, true);
  // A temporary Ctrl preview also closes when the key is released outside the shadow root.
  listen(win, 'keyup', event => { if (event.key === 'Control' && !pinned) hide(); });
  listen(win, 'blur', () => { if (!pinned) hide(); });
  return {
    openNote,
    preview: { show, hide, setOnHide(callback) { onHide = callback; }, state: () => ({ open: !panel.hidden, pinned, note: node?.note || node?.id || null }) },
    diagnostics: () => ({ disposed, ...resources, queued: !!queued, timers: hoverTimer === null ? 0 : 1, listeners, observers: disposed ? 0 : 1 }),
    dispose() { if (disposed) return; disposed = true; hide(); events.abort(); listeners = 0; resize.disconnect(); panel.remove(); onHide = () => {}; },
  };
}
