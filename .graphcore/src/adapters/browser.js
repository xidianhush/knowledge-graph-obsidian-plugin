/** Mount the shared graph UI in any DOM container; this is also used by ItemView.
 * Returns core, graph (HUD API), refresh(), pause(), resume(), dispose().
 * Container contents are preserved; only the owned host is removed on disposal.
 */
function mountGraph(container, payload) {
  const doc = container.ownerDocument, win = doc.defaultView;
  const host = doc.createElement('div');
  host.className = 'kg-smoke-host';
  host.style.cssText = 'display:block;width:100%;height:100%;min-height:0;isolation:isolate';
  container.appendChild(host);
  let core, hud, session, dprQuery, onDpr, disposed = false, paused = false, previousSize = '';
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    dprQuery?.removeEventListener('change', onDpr);
    core?.dispose();
    hud?.dispose();
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
    surface.setAttribute('aria-label', '知识图谱画布');
    surface.innerHTML = GRAPH_HTML; shadow.appendChild(surface);
    const canvas = shadow.getElementById('cv');
    core = new GraphCore({ canvas, payload, platform: createCanvasPlatform(canvas) });
    hud = createHudScope(host, shadow, surface);
    const graph = mountHud(hud, surface, core);
    hud.finishSetup();
    const refresh = () => {
      if (disposed) return;
      const visible = !paused && host.isConnected && host.getClientRects().length > 0 &&
        host.clientWidth > 0 && host.clientHeight > 0 && !doc.hidden;
      hud.setActive(visible);
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
