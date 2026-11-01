/** Payload + canvas, with an injected platform. No Obsidian, DOM lookup or globals.
 * platform: metrics(), now(), requestFrame(fn), cancelFrame(id),
 * listenCanvas(type,fn,options), listenGlobal(type,fn,options) -> unsubscribe.
 */
class GraphCore {
  constructor({ canvas, payload, platform }) {
    if (!canvas || !platform) throw new Error('GraphCore requires canvas and platform');
    this.data = decodeGraphPayload(payload);
    this.canvas = canvas;
    this.platform = platform;
    this.renderer = null;
    this.disposed = false;
    this.active = true;
    this.frames = new Map();
    this.listeners = [];
    this.sequence = 0;
    this.frameCount = 0;
  }
  mount(hooks = {}) {
    if (this.disposed || this.renderer) throw new Error('GraphCore can be mounted only once');
    const listen = method => (type, fn, options) => {
      const remove = this.platform[method](type, event => {
        if (this.active && !this.disposed) fn(event);
      }, options);
      this.listeners.push(remove);
    };
    try {
      this.renderer = createCanvasRenderer(this.canvas, this.data, hooks, {
        metrics: () => this.platform.metrics(), now: () => this.platform.now(),
        requestFrame: callback => this.requestFrame(callback),
        listenCanvas: listen('listenCanvas'), listenGlobal: listen('listenGlobal'),
      });
      // Losing focus or hiding mid-drag must not leave a captured drag behind.
      listen('listenGlobal')('blur', () => this.renderer.cancelInteraction());
      return this.renderer;
    } catch (error) { this.dispose(); throw error; }
  }
  schedule(id, item) {
    item.native = this.platform.requestFrame(time => {
      item.native = null;
      if (!this.active || this.disposed) return;
      this.frames.delete(id);
      this.frameCount++;
      item.callback(time);
    });
  }
  requestFrame(callback) {
    if (this.disposed) return 0;
    const id = ++this.sequence, item = { callback, native: null };
    this.frames.set(id, item);
    if (this.active) this.schedule(id, item);
    return id;
  }
  pause() {
    if (this.disposed || !this.active) return;
    this.active = false;
    this.renderer?.cancelInteraction();
    for (const item of this.frames.values()) {
      if (item.native != null) this.platform.cancelFrame(item.native);
      item.native = null;
    }
  }
  resume() {
    if (this.disposed || this.active) return;
    this.active = true;
    for (const [id, item] of this.frames) this.schedule(id, item);
    this.renderer?.invalidate();
  }
  resize() { if (!this.disposed) this.renderer?.resize(); }
  diagnostics() {
    return { disposed: this.disposed, active: this.active, frameCount: this.frameCount,
      frames: this.frames.size, listeners: this.listeners.length };
  }
  dispose() {
    if (this.disposed) return;
    this.pause();
    this.disposed = true;
    for (const item of this.frames.values()) {
      if (item.native != null) this.platform.cancelFrame(item.native);
    }
    this.frames.clear();
    for (const remove of this.listeners.splice(0)) remove();
    this.renderer = this.canvas = this.platform = this.data = null;
  }
}
