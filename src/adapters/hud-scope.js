/* DOM compatibility boundary for the existing HUD only. GraphCore never uses this facade. */
function createHudScope(host, shadow, surface) {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const listeners = [];
  const observers = new Set();
  const timers = new Set();
  const resizeBus = new win.EventTarget();
  let disposed = false, active = true, dragging = false;
  let pointer = null;
  const canvas = shadow.getElementById('cv');
  function pointerOnCanvas() {
    return active && !disposed && pointer && doc.elementFromPoint(...pointer) === host &&
      shadow.elementFromPoint(...pointer) === canvas;
  }

  function listen(target, type, callback, options) {
    target.addEventListener(type, callback, options);
    const remove = () => target.removeEventListener(type, callback, options);
    listeners.push(remove);
    return remove;
  }
  function localEvent(event) {
    const target = event.composedPath()[0] || event.target;
    return new Proxy(event, { get(obj, key) {
      if (key === 'target') return target;
      const value = Reflect.get(obj, key, obj);
      return typeof value === 'function' ? value.bind(obj) : value;
    } });
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
      pointer = null;
      resizeBus.dispatchEvent(new win.Event('blur'));
    }
  }
  function trackObserver(observer) { observers.add(observer); return observer; }
  class ManagedMutationObserver {
    constructor(callback) { return trackObserver(new win.MutationObserver(callback)); }
  }
  // Observe modifiers without moving focus away from the user's editor or controls.
  listen(win, 'mousemove', event => { pointer = [event.clientX, event.clientY]; }, true);
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
      toast.textContent = kgT('core.browser.snapshotToast');
      toast.classList.add('show');
      setTimer(() => toast.classList.remove('show'), 2600);
    } },
    addEventListener(type, callback, options) {
      if (type === 'resize' || type === 'blur') {
        listen(resizeBus, type, callback, options);
      } else if (type === 'keydown' || type === 'keyup') {
        listen(win, type, event => {
          if (!active || disposed) return;
          const inside = event.composedPath().includes(host);
          if (event.key === 'Control'
            ? (type === 'keyup' || inside || pointerOnCanvas())
            : inside) callback(localEvent(event));
        }, options);
      } else {
        listen(win, type, event => {
          if (!active || disposed) return;
          if (dragging || event.composedPath().includes(host)) callback(localEvent(event));
        }, options);
      }
    },
  };
  const localDocument = {
    get activeElement() { return shadow.activeElement; },
    getElementById: id => shadow.getElementById(id),
    createElement: tag => doc.createElement(tag),
    addEventListener(type, callback, options) {
      listen(shadow, type, event => { if (active) callback(localEvent(event)); }, options);
    },
  };
  function finishSetup() {
    listen(win, 'mouseup', () => { dragging = false; });
    listen(win, 'blur', () => { dragging = false; pointer = null; resizeBus.dispatchEvent(new win.Event('blur')); });
    listen(shadow, 'focusout', () => {
      if (!shadow.activeElement) resizeBus.dispatchEvent(new win.Event('blur'));
    });
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    active = false;
    for (const id of [...timers]) clearTimer(id);
    for (const observer of observers) observer.disconnect();
    observers.clear();
    for (const remove of listeners.splice(0)) remove();
  }
  return {
    window: localWindow, document: localDocument,
    setTimeout: setTimer, clearTimeout: clearTimer, MutationObserver: ManagedMutationObserver,
    getComputedStyle: win.getComputedStyle.bind(win),
    listen, trackObserver, setActive, finishSetup, dispose,
    cleanup: fn => listeners.push(fn),
    canvasPointer: () => pointerOnCanvas() ? [...pointer] : null,
    resize: () => resizeBus.dispatchEvent(new win.Event('resize')),
    diagnostics: () => ({ disposed, active, frameCount: 0, frames: 0,
      timers: timers.size, observers: observers.size, listeners: listeners.length }),
  };
}
