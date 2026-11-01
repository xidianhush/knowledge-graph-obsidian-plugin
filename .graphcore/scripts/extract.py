"""One-time, guarded extraction from the frozen smoke sources; no algorithm edits."""
from pathlib import Path
import re
ROOT = Path(__file__).resolve().parents[1]
UP = Path(r'D:\what_i_am_doing\Project\knowledge-graph-obsidian-plugin\upstream')
def once(text, old, new):
    assert text.count(old) == 1, old
    return text.replace(old, new)
r = (UP / 'render.js').read_text(encoding='utf-8')
r = once(r, '(function () {', 'function createCanvasRenderer(canvas, DATA, hooks, runtime) {')
r = once(r, '  window.createRenderer = createRenderer;\n})();', '  return createRenderer(canvas, DATA, hooks);\n}')
r = r.replace('window.devicePixelRatio', 'runtime.metrics().dpr').replace('window.innerWidth', 'runtime.metrics().width').replace('window.innerHeight', 'runtime.metrics().height')
r = r.replace('requestAnimationFrame(', 'runtime.requestFrame(').replace('performance.now()', 'runtime.now()')
r = r.replace('canvas.addEventListener(', 'runtime.listenCanvas(').replace('window.addEventListener(', 'runtime.listenGlobal(')
r = once(r, "    runtime.listenGlobal('resize', resize);", '')
r = once(r, '      resize: resize,', "      resize: resize,\n      cancelInteraction: function () { dragging = false; lastMouse = null; tween = null; canvas.style.cursor = 'grab'; },")
(ROOT / 'src/core/renderer.js').write_text(r, encoding='utf-8')
a = (UP / 'app.js').read_text(encoding='utf-8')
a = once(a, '(function () {', 'function mountHud(scope, surface, core) {\n  const { window, document, setTimeout, clearTimeout, MutationObserver, getComputedStyle } = scope;')
a = once(a, '  const DATA = JSON.parse(document.getElementById(\'graph-data\').textContent);', '  const DATA = core.data;')
start = a.index('  // 阶段 3.4：payload')
end = a.index('  const domainColor', start)
a = a[:start] + a[end:]
a = once(a, '  const R = window.createRenderer(canvas, DATA, {', '  const R = core.mount({')
a = once(a, '  window.KG = {', '  return {')
a = once(a, '\n})();', '\n}')
anchor = '  function showPreviewFor(node, cx, cy, pinned) {'
a = once(a, anchor, anchor + '\n    const hostRect = surface.getBoundingClientRect();\n    cx -= hostRect.left; cy -= hostRect.top;')
# DOM event handlers are now owned by the HUD resource scope, including dynamic rows.
a = re.sub(r"(\$\('[^']+'\)|\b(?:b|btn|li|a|el|canvas|PV))\.addEventListener\(", r'scope.listen(\1, ', a)
(ROOT / 'src/adapters/hud.js').write_text(a, encoding='utf-8')
s = (ROOT / 'src/adapters/hud-scope.js').read_text(encoding='utf-8')
s = s.replace('function createScope(', 'function createHudScope(')
s = s.replace('/* Temporary host boundary for the smoke test. Upstream rendering stays unchanged.\n * Each mount owns its globals, callbacks and DOM; no eval, iframe or runtime Node.\n */', '/* DOM compatibility boundary for the existing HUD only. GraphCore never uses this facade. */')
s = s.replace('    localWindow.KG = null;\n    localWindow.createRenderer = null;\n', '')
# Public listen returns an unsubscriber; removed dynamic elements are released on disposal.
s = s.replace('    listeners.push(() => target.removeEventListener(type, callback, options));', '    const remove = () => target.removeEventListener(type, callback, options);\n    listeners.push(remove);\n    return remove;')
(ROOT / 'src/adapters/hud-scope.js').write_text(s, encoding='utf-8')
