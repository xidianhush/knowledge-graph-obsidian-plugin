/* Temporary host boundary for the smoke test. Upstream rendering stays unchanged.
 * Each mount owns its globals, callbacks and DOM; no eval, iframe or runtime Node.
 */
function createScope(host, shadow, surface) {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const listeners = [];
  const observers = new Set();
  const frames = new Map();
  const timers = new Set();
  const resizeBus = new win.EventTarget();
  let disposed = false, active = true, sequence = 0, dragging = false;
  let frameCount = 0;

  function listen(target, type, callback, options) {
    target.addEventListener(type, callback, options);
    listeners.push(() => target.removeEventListener(type, callback, options));
  }
  function localEvent(event) {
    const target = event.composedPath()[0] || event.target;
    return new Proxy(event, { get(obj, key) {
      if (key === 'target') return target;
      const value = Reflect.get(obj, key, obj);
      return typeof value === 'function' ? value.bind(obj) : value;
    } });
  }
  function schedule(id, item) {
    item.native = win.requestAnimationFrame(ts => {
      item.native = null;
      if (!active || disposed) return;
      frames.delete(id);
      frameCount++;
      item.callback(ts);
    });
  }
  function requestFrame(callback) {
    if (disposed) return 0;
    const id = ++sequence, item = { callback, native: null };
    frames.set(id, item);
    if (active) schedule(id, item);
    return id;
  }
  function cancelFrame(id) {
    const item = frames.get(id);
    if (item?.native != null) win.cancelAnimationFrame(item.native);
    frames.delete(id);
  }
  function setTimer(callback, delay) {
    if (disposed) return 0;
    const id = win.setTimeout(() => {
      timers.delete(id);
      if (!disposed) callback();
    }, delay);
    timers.add(id);
    return id;
  }
  function clearTimer(id) { win.clearTimeout(id); timers.delete(id); }
  function setActive(value) {
    if (disposed || active === value) return;
    active = value;
    if (!active) {
      dragging = false;
      resizeBus.dispatchEvent(new win.Event('blur'));
    }
    for (const [id, item] of frames) {
      if (active && item.native == null) schedule(id, item);
      else if (!active && item.native != null) {
        win.cancelAnimationFrame(item.native);
        item.native = null;
      }
    }
  }
  function trackObserver(observer) { observers.add(observer); return observer; }
  class ManagedMutationObserver {
    constructor(callback) { return trackObserver(new win.MutationObserver(callback)); }
  }
  listen(surface, 'mousedown', event => {
    dragging = event.target === shadow.getElementById('cv');
    if (dragging) surface.focus({ preventScroll: true });
  }, true);
  // This listener runs after upstream mouseup, so a drag can finish outside the view.
  const localWindow = {
    get devicePixelRatio() { return win.devicePixelRatio; },
    get innerWidth() { return surface.clientWidth; },
    get innerHeight() { return surface.clientHeight; },
    localStorage: {
      getItem: key => win.localStorage.getItem('knowledge-graph-smoke.' + key),
      setItem: (key, value) => win.localStorage.setItem('knowledge-graph-smoke.' + key, value),
    },
    // Snapshot smoke must not navigate the host or open the author's real vault.
    location: { set href(value) {
      const toast = shadow.getElementById('toast');
      toast.textContent = '当前为快照冒烟，原笔记跳转将在正式适配层接入';
      toast.classList.add('show');
      setTimer(() => toast.classList.remove('show'), 2600);
    } },
    addEventListener(type, callback, options) {
      if (type === 'resize' || type === 'blur') {
        listen(resizeBus, type, callback, options);
      } else if (type === 'keydown' || type === 'keyup') {
        listen(shadow, type, event => { if (active) callback(localEvent(event)); }, options);
      } else {
        listen(win, type, event => {
          if (!active || disposed) return;
          if (dragging || event.composedPath().includes(host)) callback(localEvent(event));
        }, options);
      }
    },
  };
  const localDocument = {
    getElementById: id => shadow.getElementById(id),
    createElement: tag => doc.createElement(tag),
    addEventListener(type, callback, options) {
      listen(shadow, type, event => { if (active) callback(localEvent(event)); }, options);
    },
  };
  function finishSetup() {
    listen(win, 'mouseup', () => { dragging = false; });
    listen(win, 'blur', () => { dragging = false; resizeBus.dispatchEvent(new win.Event('blur')); });
    listen(shadow, 'focusout', () => {
      if (!shadow.activeElement) resizeBus.dispatchEvent(new win.Event('blur'));
    });
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const id of [...frames.keys()]) cancelFrame(id);
    for (const id of [...timers]) clearTimer(id);
    for (const observer of observers) observer.disconnect();
    observers.clear();
    for (const remove of listeners.splice(0)) remove();
    localWindow.KG = null;
    localWindow.createRenderer = null;
  }
  return {
    window: localWindow, document: localDocument,
    requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame,
    setTimeout: setTimer, clearTimeout: clearTimer, MutationObserver: ManagedMutationObserver,
    getComputedStyle: win.getComputedStyle.bind(win),
    listen, trackObserver, setActive, finishSetup, dispose,
    resize: () => resizeBus.dispatchEvent(new win.Event('resize')),
    diagnostics: () => ({ disposed, active, frameCount, frames: frames.size,
      timers: timers.size, observers: observers.size, listeners: listeners.length }),
  };
}
