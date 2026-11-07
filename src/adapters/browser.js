/** Mount the shared graph UI in any DOM container; this is also used by ItemView.
 * Returns core, graph (HUD API), refresh(), pause(), resume(), dispose().
 * Container contents are preserved; only the owned host is removed on disposal.
 */
function mountGraph(container, payload, services = {}) {
  const doc = container.ownerDocument, win = doc.defaultView;
  const host = doc.createElement('div');
  host.className = 'kg-smoke-host';
  host.style.cssText = 'display:block;width:100%;height:100%;min-height:0;isolation:isolate';
  container.appendChild(host);
  let core, hud, session, dprQuery, onDpr, disposed = false, paused = false, previousSize = '';
  let detachI18n, offI18n;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    dprQuery?.removeEventListener('change', onDpr);
    offI18n?.();
    detachI18n?.();
    core?.dispose();
    hud?.dispose();
    services.preview?.hide();
    host.shadowRoot?.querySelector('.kg-surface')?.replaceChildren();
    host.shadowRoot?.replaceChildren();
    host.remove();
    if (session) session.graph = null;
  };
  try {
    const shadow = host.attachShadow({ mode: 'open' });
    const style = doc.createElement('style'); style.textContent = GRAPH_CSS; shadow.appendChild(style);
    const surface = doc.createElement('div');
    surface.className = 'kg-surface'; surface.tabIndex = 0;
    if (container.dataset.kgPlatform) surface.dataset.kgPlatform = container.dataset.kgPlatform;
    surface.setAttribute('aria-label', kgT('core.canvas.ariaLabel'));
    surface.innerHTML = GRAPH_HTML; shadow.appendChild(surface);
    if (surface.dataset.kgPlatform) {
      for (const [attribute, key] of [
        ['title', 'ui.zoomOut'], ['title', 'ui.zoomIn'], ['title', 'ui.layoutMode.title'],
        ['title', 'ui.legend.toggleTitle'], ['html', 'ui.legend.contains'], ['html', 'ui.legend.hint'],
      ]) {
        const binding = 'data-i18n-' + attribute;
        surface.querySelector(`[${binding}="${key}"]`)?.setAttribute(binding, key + '.touch');
      }
    }
    // 首次翻译模板里的 data-i18n*，并登记为语言切换时自动重刷的根。
    detachI18n = kgI18nAttach(surface);
    const canvas = shadow.getElementById('cv');
    core = new GraphCore({ canvas, payload, platform: createCanvasPlatform(canvas, !!surface.dataset.kgPlatform) });
    hud = createHudScope(host, shadow, surface);
    if (surface.dataset.kgPlatform) {
      // Obsidian's drawers consume Touch Events as well as Pointer Events.
      // Only contain gestures originating on the graph canvas.
      for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
        hud.listen(canvas, type, event => {
          if (event.cancelable) event.preventDefault();
          event.stopPropagation();
        }, { passive: false });
      }
    }
    const graph = mountHud(hud, surface, core, services);
    hud.finishSetup();
    // 语言切换：重刷模板文案（attach 已自动做一次，这里兜住 root 自身的 aria-label），
    // 让画布重绘（renderer 在绘制时 kgT），并通知 HUD 侧重填动态文案。
    offI18n = kgI18nOnChange(() => {
      surface.setAttribute('aria-label', kgT('core.canvas.ariaLabel'));
      kgI18nApply(surface);
      core?.invalidate?.();
      graph?.applyI18n?.();
    });
    const refresh = () => {
      if (disposed) return;
      const visible = !paused && host.isConnected && host.getClientRects().length > 0 &&
        host.clientWidth > 0 && host.clientHeight > 0 && !doc.hidden;
      hud.setActive(visible);
      if (!visible) services.preview?.hide();
      if (visible) core.resume(); else core.pause();
      const size = host.clientWidth + ':' + host.clientHeight + ':' + win.devicePixelRatio;
      if (visible && size !== previousSize) { previousSize = size; core.resize(); hud.resize(); }
    };
    hud.trackObserver(new win.ResizeObserver(refresh)).observe(host);
    hud.trackObserver(new win.IntersectionObserver(refresh)).observe(host);
    hud.listen(doc, 'visibilitychange', refresh);
    hud.listen(win, 'resize', refresh);
    onDpr = () => {
      dprQuery?.removeEventListener('change', onDpr);
      dprQuery = win.matchMedia('(resolution: ' + win.devicePixelRatio + 'dppx)');
      dprQuery.addEventListener('change', onDpr, { once: true });
      refresh();
    };
    onDpr();
    session = { host, graph, core, refresh, dispose,
      pause() { paused = true; refresh(); }, resume() { paused = false; refresh(); },
      diagnostics() {
        const c = core.diagnostics(), h = hud.diagnostics();
        return { disposed, active: c.active, frameCount: c.frameCount + h.frameCount,
          frames: c.frames + h.frames, timers: h.timers, observers: h.observers,
          listeners: c.listeners + h.listeners + (disposed ? 0 : 1), core: c, hud: h };
      },
    };
    return session;
  } catch (error) { dispose(); throw error; }
}
