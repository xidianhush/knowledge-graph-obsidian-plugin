// Browser primitives are selected from the canvas's owner window (including popouts).
function createCanvasPlatform(canvas) {
  const win = canvas.ownerDocument.defaultView;
  let dragging = false;
  const listen = (target, type, callback, options) => {
    target.addEventListener(type, callback, options);
    return () => target.removeEventListener(type, callback, options);
  };
  return {
    metrics: () => ({ dpr: win.devicePixelRatio || 1, width: canvas.clientWidth, height: canvas.clientHeight }),
    now: () => win.performance.now(),
    requestFrame: fn => win.requestAnimationFrame(fn),
    cancelFrame: id => win.cancelAnimationFrame(id),
    listenCanvas(type, callback, options) {
      return listen(canvas, type, event => {
        if (type === 'mousedown' && event.button === 0) dragging = true;
        callback(event);
      }, options);
    },
    listenGlobal(type, callback, options) {
      return listen(win, type, event => {
        if (type === 'mousemove' && !dragging && !event.composedPath().includes(canvas)) return;
        if (type === 'mouseup' || type === 'blur') dragging = false;
        callback(event);
      }, options);
    },
  };
}
