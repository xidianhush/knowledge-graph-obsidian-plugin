/* 知识笔记语义缩放可视化 —— 前端交互层
 *
 * 分工：web/render.js 负责「画什么、怎么淡入淡出、怎么响应滚轮/拖拽」，
 * 本文件只负责 DOM 侧的一切 —— 顶栏、侧栏、搜索、过滤、图例、键盘快捷键。
 * 两者通过 createRenderer 的 hooks（onHover / onSelect / onCamera / onFrame）
 * 与 api（selected / filterSet / matchSet / labelMode / focusOn /
 * zoomToDepth）通信。
 *
 * 设计要点：
 *  1) zoom 是唯一真源，层级由 zoom 连续派生（R.enterAt(zoom)）。换层从不反向改
 *     相机，所以不存在「视角收窄 → zoom 变大 → 又跳回深层」的正反馈震荡。
 *     方向：**放大 = 更深**（与地图一致）。旧版「zoom 越大看到的层越浅」是 bug。
 *  2) 节点坐标全部在构建期算定，前端只做连续淡入淡出 —— 位置永不变，也没有
 *     「展开标题层」这种按需增删元素的操作：标题从构建期起就是一等节点。
 *  3) 淡入淡出的门槛由构建期写入每个节点的世界半径 r 决定（minzoom =
 *     lod.min_px / r，就是地图矢量瓦片那个 minzoom 字段）。circle packing 保证
 *     沿包含链 r 严格递减，于是 minzoom 严格递增 ——「放大一定只会看到更细的
 *     东西」这条方向性是被几何锁住的，不靠前端临场判断。
 */
function mountHud(scope, surface, core, services = {}) {
  const { window, document, setTimeout, clearTimeout, MutationObserver, getComputedStyle } = scope;
  'use strict';

  // ── 数据 ──────────────────────────────────────────────────────────────
  const DATA = core.data;
  const META = DATA.meta;
  const THEME = META.theme || {};
  const MAX_DEPTH = META.max_depth;
  const VAULT = META.vault_name;
  const LEVELS = DATA.levels || {};

  const NODES = DATA.nodes;
  const NODE = new Map(NODES.map((n) => [n.id, n]));
  const EDGES = DATA.edges;

  const domainColor = (d) => (THEME.domains && THEME.domains[d]) || THEME.fallback || '#8B949E';
  // 边类型 / 来源 / 节点种类都是有限枚举（UI-A11）：文案在调用时查 kgT，
  // 语言切换后由 applyI18n() 重建的 DOM 自然拿到新语言；未知值原样显示，不能丢。
  const EDGE_TYPES = { prerequisite: 1, derives: 1, contrast: 1, contains: 1 };
  const ORIGIN_KINDS = { wiki: 1, annotation: 1, frontmatter: 1, candidate: 1, hierarchy: 1, mixed: 1 };
  const NODE_KINDS = { folder: 1, note: 1, heading: 1 };
  const edgeLabel = (type) => (EDGE_TYPES[type] ? kgT('hud.edgeType.' + type) : type);
  const edgeHint = (type) => (EDGE_TYPES[type] ? kgT('hud.edgeHint.' + type) : '');
  const originLabel = (origin) => (ORIGIN_KINDS[origin] ? kgT('hud.origin.' + origin) : '');
  const kindLabel = (kind) => (NODE_KINDS[kind] ? kgT('hud.kind.' + kind) : kind);

  // 父子索引：过滤时要「留下这篇笔记的全部标题」，得能顺着往下走
  const KIDS = new Map();
  NODES.forEach((n) => {
    if (!n.parent) return;
    let list = KIDS.get(n.parent);
    if (!list) { list = []; KIDS.set(n.parent, list); }
    list.push(n.id);
  });

  // ── DOM ───────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const canvas = $('cv');
  const tooltip = $('tooltip');
  const toastEl = $('toast');
  const mobile = !!surface.dataset.kgPlatform;

  // ── 状态 ──────────────────────────────────────────────────────────────
  let filterDomain = 'all';
  let searchQ = '';
  let labelMode = 'auto';      // 'auto' | 'on' | 'off' | 'selected'，与渲染器同词汇

  // 图例收起状态要记住（UI-A8）：优先走宿主注入的 services.uiStorage（Obsidian 侧
  // 落 data.json，由 i18n-obsidian 流注入）；没有注入时回退 localStorage —— 这份 HTML
  // 也能 file:// 直接打开，Chrome 下 localStorage 可能抛 SecurityError，两个方向都整段兜住。
  const LEGEND_STORAGE_KEY = 'kg.legendCollapsed';
  const uiStorage = services.uiStorage && typeof services.uiStorage.get === 'function'
    ? services.uiStorage : null;

  function readStored(key, fallback) {
    try {
      const v = window.localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch (err) { return fallback; }
  }

  function writeStored(key, value) {
    try { window.localStorage.setItem(key, value); } catch (err) { /* 存不下就算了 */ }
  }

  // 一次性迁移：宿主 uiStorage 还没有这个键时，把老用户 localStorage 里的状态搬过去；
  // 用户从没设置过（读不到）就保持默认展开。
  function loadLegendCollapsed() {
    if (uiStorage) {
      let value = null;
      try { value = uiStorage.get(LEGEND_STORAGE_KEY, null); } catch (err) { value = null; }
      if (value == null) {
        const legacy = readStored(LEGEND_STORAGE_KEY, null);
        if (legacy != null) {
          value = legacy;
          try { uiStorage.set(LEGEND_STORAGE_KEY, legacy); } catch (err) { /* 下次再迁移 */ }
        }
      }
      return value === '1' || (value == null && mobile);
    }
    return readStored(LEGEND_STORAGE_KEY, mobile ? '1' : '0') === '1';
  }

  function saveLegendCollapsed(collapsed) {
    const value = collapsed ? '1' : '0';
    if (uiStorage) {
      try { uiStorage.set(LEGEND_STORAGE_KEY, value); return; } catch (err) { /* 退回 localStorage */ }
    }
    writeStored(LEGEND_STORAGE_KEY, value);
  }

  // toast 也走字典：记住最后一次的 key/vars，语言切换时 applyI18n() 能重填文字
  // （只重填，不重置 2.6s 的自动消失计时，别让切换语言把提示「续命」）。
  let toastState = null;
  function toast(key, vars) {
    toastState = { key: key, vars: vars || null };
    toastEl.textContent = kgT(key, vars);
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function pathOf(id) {
    const d = NODE.get(id);
    return d && d.path ? d.path : id;
  }

  // 从任意节点回溯到根的包含链（含自己），侧栏面包屑与「上级」跳转都用它
  function chainOf(id) {
    const out = [];
    let cur = id;
    let guard = 0;
    while (cur && guard++ < 64) {
      out.push(cur);
      const n = NODE.get(cur);
      cur = n ? n.parent : null;
    }
    return out.reverse();
  }

  // ── HUD ───────────────────────────────────────────────────────────────
  // 该层「累积可见了什么」的读数。拆成两半用：levelLabel 给层级胶囊的 title（有空间，
  // 带上 LOD 前缀），levelCounts 给顶栏 #readout（空间紧张，LOD 与 z 由调用处另拼）。
  // 2026-10-24：删掉「边 N」—— 聚合边模式删除后，这一层的「边」只剩「两端都在该层
  // 以内的语义边」，首页恒为 0，而画布上同时画着全部 96 条逐条链接，读数会自相矛盾。
  // 屏幕上真正的连线数由右下角页脚的「关系 N」报（stats.edges，落笔口径）。
  function levelCounts(lv) {
    const row = LEVELS[String(lv)] || {};
    return kgT('hud.levelCounts', {
      folders: row.folders == null ? '-' : row.folders,
      notes: row.notes == null ? '-' : row.notes,
      headings: row.headings == null ? '-' : row.headings,
    });
  }

  function levelLabel(lv) {
    return 'LOD ' + lv + '/' + MAX_DEPTH + ' · ' + levelCounts(lv);
  }

  let lastReadout = '';
  let lastLevel = -1;

  function updateHud() {
    const zoom = R.camera.zoom;
    const lv = R.enterAt(zoom);
    if (lv !== lastLevel) {
      lastLevel = lv;
      Array.prototype.forEach.call($('pills').children, (el) => {
        el.classList.toggle('on', parseInt(el.dataset.level, 10) === lv);
      });
    }
    // ⚠️ 顺序有意为之：1440px 下顶栏是超额分配的（见 template.html 顶栏注释），
    // #readout 只拿得到约 200px，折两行后装不满整串文字。所以把最关键的
    // 「第几层 + z」放最前面，被省略掉的只会是末尾的计数与提示，而不是缩放值。
    const text = 'LOD ' + lv + '/' + MAX_DEPTH + ' · z=' + zoom.toFixed(3) +
      ' · ' + levelCounts(lv);
    // 第 11 带（第五轮：圆即入口）：不占层级数字（enter[] 仍是 10 项），只在提示位说一句。
    // 药丸层已删除 → 文案必须教会用户「Ctrl + 悬停标题圆」，否则功能等于不存在。
    // 提示按「一整句」进字典，不再拼中英碎片；span 是我们自己的可信常量，
    // 文案只是普通文本，仍 escapeHtml 一道，保证以后字典改动也进不了 XSS 通道。
    const hintKey = mobile ? 'hud.readout.touchPreviewHint'
      : lv < MAX_DEPTH ? 'hud.readout.deeperHint' : 'hud.readout.previewHint';
    const hint = ' <span style="color:#7e879a">' + escapeHtml(kgT(hintKey)) + '</span>';
    if (text !== lastReadout) {
      lastReadout = text;
      $('readout').innerHTML = text + hint;
    }
  }

  // 页脚两行：第一行是读数（整句一个 key，有选中焦点时换另一句），第二行是生成
  // 时间 + 数据来源（key 约定 ui.footer，{generated} 由这里给，字典在模板流那边）。
  function statsText(stats) {
    // 选中一个元素时把焦点读数亮出来：「相关的有几条 / 一共几条 · 相邻几个元素」。
    // 没选中、或全都相关时保持原样 —— 读数不该在无事发生时也跟着变。
    const rel = stats.focusEdges;
    const focused = !!(R.selected && rel != null && rel < stats.edges);
    return kgT(focused ? 'hud.stats.focus' : 'hud.stats', {
      nodes: stats.nodes,
      edges: stats.edges,
      related: rel,
      neighbors: stats.focusNeighbors || 0,
      labels: stats.labels,
    });
  }

  function footerHtml(stats) {
    return statsText(stats) + '<br>' +
      kgT('ui.footer', { generated: escapeHtml(META.generated || '') });
  }

  let lastStats = '';
  function updateStats(stats) {
    const text = statsText(stats);
    if (text === lastStats) return;
    lastStats = text;
    $('footer').innerHTML = footerHtml(stats);
  }

  function buildPills() {
    const box = $('pills');
    box.innerHTML = '';
    for (let lv = 1; lv <= MAX_DEPTH; lv += 1) {
      const b = document.createElement('span');
      b.className = 'pill';
      b.dataset.level = lv;
      b.textContent = lv;
      b.title = levelLabel(lv);
      b.addEventListener('click', () => R.zoomToDepth(lv));
      box.appendChild(b);
    }
  }

  function buildLegend() {
    const box = $('legend-domains');
    box.innerHTML = '';
    // 2026-10-24 阶段 2：这个库一条语义边都没有时，「关系」那一整块图例文案不该出现
    // （否则面板在解释一些图里根本不存在的线）。判据用 payload 的真实边数。
    const rel = $('legend-rel');
    if (rel) rel.style.display = (EDGES && EDGES.length) ? '' : 'none';
    // 阶段 1.3：学科列表来自构建期算好的 META.domains（按笔记数降序），不再靠
    // 「扫 depth-1 的 folder 节点」猜 —— 那个猜法在「全散笔记、没有文件夹」的库上
    // 会得到空图例，在 domain 被 annotations 覆盖但目录名不同时也会漏。
    const domains = (META && META.domains) || [];
    // 阶段 2.5：学科多的时候图例改成两列 —— 30 个学科单列会变成一条长滚动条，
    // 1/3 屏高都被它占掉。12 个以内保持单列（列宽更松、更好读）。
    const multi = domains.length > 12;
    box.classList.toggle('multi', multi);
    const legendEl = $('legend');
    if (legendEl) legendEl.classList.toggle('wide', multi);
    if (!domains.length) {
      const row = document.createElement('div');
      row.className = 'row';
      const sw = document.createElement('span');
      sw.className = 'dot';
      sw.style.background = THEME.fallback || '#8B949E';
      row.appendChild(sw);
      const label = document.createElement('span');
      label.className = 'tx';
      label.textContent = kgT('hud.legend.noDomain');
      row.appendChild(label);
      box.appendChild(row);
      return;
    }
    domains.forEach((d) => {
      const row = document.createElement('div');
      row.className = 'row';
      const sw = document.createElement('span');
      sw.className = 'dot';
      sw.style.background = domainColor(d.name);
      row.appendChild(sw);
      const label = document.createElement('span');
      label.className = 'tx';
      label.textContent = d.count ? d.name + ' · ' + d.count : d.name;
      row.appendChild(label);
      box.appendChild(row);
    });
  }

  function buildFilters() {
    const sel = $('domain');
    // 阶段 1.3：学科下拉与图例同源（META.domains），不再自己扫一遍 nodes。
    const domains = ((META && META.domains) || []).map((d) => d.name);
    domains.forEach((d) => {
      const o = document.createElement('option');
      o.value = d;
      o.textContent = d;
      sel.appendChild(o);
    });
  }

  // ── 提示气泡 ──────────────────────────────────────────────────────────
  function showTooltip(node, sx, sy) {
    const bits = [];
    if (node.kind === 'note') {
      bits.push(kgT('hud.tip.note', { count: node.heading_count || 0 }));
    } else if (node.kind === 'folder') {
      bits.push(kgT('hud.tip.folder', { count: node.note_count || 0 }));
    } else {
      bits.push(kgT('hud.tip.heading', { level: node.level, line: node.line }));
    }
    bits.push(kgT('hud.depth', { depth: node.depth }));
    const parent = node.parent ? NODE.get(node.parent) : null;
    if (parent) bits.push(kgT('hud.tip.parent', { label: parent.label }));
    const size = R.size();
    tooltip.innerHTML =
      '<b>' + escapeHtml(node.label) + '</b>' +
      '<div class="sub">' + escapeHtml(bits.join(' · ')) + '</div>' +
      (node.excerpt ? '<div class="sub">' + escapeHtml(String(node.excerpt).slice(0, 120)) + '</div>' : '');
    tooltip.style.display = 'block';
    tooltip.style.left = Math.min(sx + 16, size[0] - tooltip.offsetWidth - 10) + 'px';
    tooltip.style.top = Math.min(sy + 16, size[1] - tooltip.offsetHeight - 10) + 'px';
  }

  function hideTooltip() {
    tooltip.style.display = 'none';
  }

  // ── 侧栏 ──────────────────────────────────────────────────────────────
  function edgesOf(id) {
    const out = [];
    const inc = [];
    EDGES.forEach((e) => {
      if (e.type === 'contains') return;
      if (e.s === id) out.push(e);
      else if (e.t === id) inc.push(e);
    });
    return { out: out, inc: inc };
  }

  function edgeListHtml(list, dir, selfId) {
    if (!list.length) return '<ul class="elist"><li style="color:#7e879a">—</li></ul>';
    list.sort((a, b) => (b.weight || 0) - (a.weight || 0));
    let html = '<ul class="elist">';
    list.slice(0, 60).forEach((e) => {
      const other = dir === 'in' ? e.s : e.t;
      const name = (NODE.get(other) || { label: other }).label;
      // data-self 记录「这行边属于哪个元素的边列表」：点边行的语义是「我要看这条链接」，
      // 需要把两端一起框进屏幕（fitPair），而不是只跳去目标。标题行（hlist）不写这个
      // 属性，点击仍走旧的「跳转目标元素」语义
      html += '<li data-target="' + escapeHtml(other) + '"' +
        (selfId ? ' data-self="' + escapeHtml(selfId) + '"' : '') + '>' +
        '<span class="arrow">' + (dir === 'in' ? '←' : '→') + '</span>' +
        escapeHtml(name) +
        '<span class="tag" title="' +
        escapeHtml([edgeHint(e.type), originLabel(e.origin)].filter(Boolean).join(' · ')) + '">' +
        escapeHtml(edgeLabel(e.type) || e.type) + ' ×' + (e.hits || 1) + '</span></li>';
    });
    if (list.length > 60) {
      html += '<li style="color:#7e879a">' + escapeHtml(kgT('hud.more.items', { count: list.length - 60 })) + '</li>';
    }
    html += '</ul>';
    return html;
  }

  // UI-A6：侧栏让位原来靠 CSS 结构选择器（依赖 DOM 关系），现在改成 surface 上的显式类。
  // 三处开合都走这个 helper，保证「sidebar .open」与「surface .kg-sidebar-open」永不脱节；
  // syncInsets 仍由 sidebar 的 MutationObserver 盯着，横带/图例/命中列表避让不变。
  function setSidebarOpen(open) {
    const side = $('sidebar');
    if (!side) return;
    const next = !!open;
    side.classList.toggle('open', next);
    surface.classList.toggle('kg-sidebar-open', next);
  }

  function renderSidebar(id) {
    const side = $('sidebar');
    const d = NODE.get(id);
    if (!d) {
      setSidebarOpen(false);
      return;
    }
    const kind = d.kind;
    const isNote = kind === 'note';
    const isHeading = kind === 'heading';
    const { out, inc } = edgesOf(id);
    const heads = isNote
      ? NODES.filter((n) => n.kind === 'heading' && n.note === id)
      : [];
    const chain = chainOf(id);
    const desc = R.descOf(id);

    let html = '';
    html += '<h2>' + escapeHtml(d.label) + '</h2>';
    if (mobile) html += '<button type="button" class="kg-sidebar-close" data-act="close">' + escapeHtml(kgT('hud.action.closeDetails')) + '</button>';
    html += '<div class="path">' + escapeHtml(d.path || id) + '</div>';
    html += '<div class="meta">';
    html += '<span class="chip">' + escapeHtml(kindLabel(kind) || kind) + '</span>';
    if (d.domain) {
      html += '<span class="chip" style="border-color:' + domainColor(d.domain) + '">' +
        escapeHtml(d.domain) + '</span>';
    }
    html += '<span class="chip">' + escapeHtml(kgT('hud.depth', { depth: d.depth })) + '</span>';
    if (isHeading) {
      html += '<span class="chip">h' + d.level + '</span>';
      html += '<span class="chip">L' + d.line + '</span>';
    } else if (isNote) {
      html += '<span class="chip">' + escapeHtml(kgT('hud.count.headings', { count: heads.length })) + '</span>';
    } else {
      html += '<span class="chip">' + escapeHtml(kgT('hud.count.notes', { count: d.note_count || 0 })) + '</span>';
    }
    if (desc) html += '<span class="chip">' + escapeHtml(kgT('hud.sidebar.descendants', { count: desc })) + '</span>';
    html += '</div>';

    // 面包屑：文件夹 / 笔记 / 标题都是「人为规定的存储结构」，但它是唯一能把
    // 一个深层知识点送回上下文的线索，所以在侧栏里显式给一条可点的链。
    if (chain.length > 1) {
      html += '<div class="path" style="margin-bottom:10px">';
      html += chain.map((cid, i) =>
        (i ? ' › ' : '') +
        (cid === id
          ? '<b>' + escapeHtml((NODE.get(cid) || {}).label) + '</b>'
          : '<a href="#" data-goto="' + escapeHtml(cid) + '" style="color:var(--accent);text-decoration:none">' +
            escapeHtml((NODE.get(cid) || {}).label) + '</a>')
      ).join('');
      html += '</div>';
    }

    html += '<div class="actions">';
    html += '<button data-act="focus">' + escapeHtml(kgT('hud.action.focus')) + '</button>';
    html += '<button data-act="drill">' + escapeHtml(kgT('hud.action.drill')) + '</button>';
    if (isNote || isHeading) html += '<button data-act="obsidian">' + escapeHtml(kgT('hud.action.openObsidian')) + '</button>';
    if (mobile && (isNote || isHeading) && services.preview?.isEnabled?.()) {
      html += '<button type="button" data-act="preview">' + escapeHtml(kgT('hud.action.preview')) + '</button>';
    }
    html += '</div>';

    if (isNote && d.excerpt) {
      html += '<div class="excerpt">' + escapeHtml(d.excerpt) + '</div>';
    }
    html += '<h3>' + escapeHtml(kgT('hud.sidebar.incoming', { count: inc.length })) + '</h3>' + edgeListHtml(inc, 'in', id);
    html += '<h3>' + escapeHtml(kgT('hud.sidebar.outgoing', { count: out.length })) + '</h3>' + edgeListHtml(out, 'out', id);

    if (isNote && heads.length) {
      heads.sort((a, b) => a.line - b.line);
      html += '<h3>' + escapeHtml(kgT('hud.sidebar.topics', { count: heads.length })) + '</h3>';
      html += '<ul class="elist hlist">';
      heads.slice(0, 60).forEach((h) => {
        html += '<li data-target="' + escapeHtml(h.id) + '">' +
          '<span class="hdepth">h' + h.level + '</span> ' + escapeHtml(h.title) +
          '<span class="tag">L' + h.line + '</span></li>';
      });
      if (heads.length > 60) {
        html += '<li style="color:#7e879a">' + escapeHtml(kgT('hud.more.topics', { count: heads.length - 60 })) + '</li>';
      }
      html += '</ul>';
    }

    side.innerHTML = html;
    setSidebarOpen(true);

    side.querySelectorAll('button[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if (act === 'focus') R.focusOn(id, 1.0);
        else if (act === 'drill') R.focusOn(id, 1.6, 380);
        else if (act === 'obsidian') openInObsidian(id);
        else if (act === 'preview') showPreviewFor(d, 0, 0, true);
        else if (act === 'close') { select(null); surface.focus({ preventScroll: true }); }
      });
    });
    side.querySelectorAll('[data-target]').forEach((li) => {
      li.addEventListener('click', () => {
        // 边行（带 data-self）：点击语义是「我要看这条链接」—— 选中目标但不单点跳视，
        // 改为把链接两端一起框进屏幕（fitPair），让连接它们的箭头直接可见；
        // 标题行（hlist，无 data-self）保持旧的「跳去目标元素」语义
        if (li.dataset.self != null && !li.closest('.hlist')) {
          select(li.dataset.target, false);
          R.fitPair(li.dataset.self, li.dataset.target);
        } else {
          select(li.dataset.target, true);
        }
      });
    });
    side.querySelectorAll('[data-goto]').forEach((a) => {
      a.addEventListener('click', (evt) => {
        evt.preventDefault();
        select(a.dataset.goto, true);
      });
    });
  }

  function openInObsidian(id) {
    let d = NODE.get(id);
    if (!d) return;
    if (services.openNote) { services.openNote(d); return; }
    if (d.kind === 'heading') d = NODE.get(d.note) || d;   // 标题没有自己的文件
    if (!d.path) { toast('hud.toast.noFile'); return; }
    const file = d.path.replace(/\.md$/i, '');
    const url = 'obsidian://open?vault=' + encodeURIComponent(VAULT) + '&file=' + encodeURIComponent(file);
    window.location.href = url;
  }

  function select(id, focus) {
    R.selected = id;
    if (id) {
      renderSidebar(id);
      if (focus) R.focusOn(id, 1.25);
    } else {
      setSidebarOpen(false);
    }
  }

  // ── 过滤 ──────────────────────────────────────────────────────────────
  // 判据只落在笔记上（学科是笔记的属性），命中的笔记要把它的全部标题一起留下，
  // 再沿 parent 链一路补到根 —— 否则淡入淡出会因为祖先不可见而把整条链掐断
  // （渲染器里「可见层级」是沿包含链取前缀的）。
  function computeFilterSet() {
    if (filterDomain === 'all') return null;
    const keep = new Set();
    const addSubtree = (id) => {
      keep.add(id);
      (KIDS.get(id) || []).forEach(addSubtree);
    };
    NODES.forEach((n) => {
      if (n.kind !== 'note') return;
      if (filterDomain !== 'all' && n.domain !== filterDomain) return;
      addSubtree(n.id);
      let p = n.parent;
      while (p) {
        keep.add(p);
        const pn = NODE.get(p);
        p = pn ? pn.parent : null;
      }
    });
    return keep;
  }

  function applyFilters() {
    const set = computeFilterSet();
    R.filterSet = set;
    if (!set) { toast('hud.toast.filterCleared'); return; }
    let notes = 0;
    set.forEach((id) => { if ((NODE.get(id) || {}).kind === 'note') notes += 1; });
    toast(notes ? 'hud.toast.filterKept' : 'hud.toast.filterNone', { count: notes });
  }

  // ── 搜索 ──────────────────────────────────────────────────────────────
  // 标题已经是一等节点，所以一次遍历 NODES 就同时覆盖「笔记 / 文件夹 / 知识点」，
  // 不再需要单独扫一份标题表。
  // 2026-10-25 阶段 2.5：加**防抖 + 命中上限**。旧版每敲一个键就全量扫 NODES
  // （2 万标题 = 2 万次 toLowerCase）、并把全部命中塞进 matchSet、每帧给全部命中画
  // 强调环与强制标签 —— 连续打字时主线程被占满，输入框都会掉字。
  const SEARCH_DEBOUNCE_MS = 120;
  const SEARCH_HIT_CAP = 2000;
  let searchTimer = 0;

  function runSearch(q, quiet) {
    searchQ = q;
    const matchSet = new Set();
    const hits = $('hits');
    if (!q) {
      hits.style.display = 'none';
      hits.innerHTML = '';
      R.matchSet = matchSet;
      return;
    }
    const needle = q.toLowerCase();
    const out = [];
    let truncated = false;
    for (let i = 0; i < NODES.length; i++) {
      const n = NODES[i];
      if (n.label.toLowerCase().indexOf(needle) < 0) continue;
      // 命中封顶：够多就停，不再继续扫（否则 1 个字符的查询在最坏形状上能扫全库）
      if (matchSet.size >= SEARCH_HIT_CAP) { truncated = true; break; }
      matchSet.add(n.id);
      let why;
      if (n.kind === 'heading') {
        const note = NODE.get(n.note) || {};
        why = kgT('hud.search.whyHeading', { note: note.label || n.note, level: n.level });
      } else if (n.kind === 'note') {
        why = kgT('hud.search.whyNote', { parent: n.parent || '' });
      } else {
        why = kgT('hud.search.whyFolder', { count: n.note_count || 0 });
      }
      out.push({ id: n.id, label: n.label, why: why });
    }
    R.matchSet = matchSet;
    out.sort((a, b) => a.label.length - b.label.length);
    hits.innerHTML = out.slice(0, 30).map((h) =>
      '<div class="hit" data-id="' + escapeHtml(h.id) + '">' +
      escapeHtml(h.label) + '<div class="why">' + escapeHtml(h.why) + '</div></div>').join('')
      || '<div class="hit" style="color:#7e879a">' + escapeHtml(kgT('hud.search.noMatch')) + '</div>';
    hits.style.display = 'block';
    hits.querySelectorAll('.hit[data-id]').forEach((el) => {
      el.addEventListener('click', () => select(el.dataset.id, true));
    });
    if (!quiet) toast(truncated ? 'hud.search.summaryCapped' : 'hud.search.summary', {
      count: matchSet.size, cap: SEARCH_HIT_CAP, shown: Math.min(30, out.length),
    });
  }

  function searchSoon(value) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(String(value || '').trim()), SEARCH_DEBOUNCE_MS);
  }

  // ── 渲染器 ────────────────────────────────────────────────────────────
  const layoutStore = services.layoutStore || createLayoutStore(null, async () => {});
  const layoutOwner = {};
  const layoutCommand = (kind, key, value) => layoutStore.command(layoutOwner,kind,key,value).catch(error => {
    // 保存失败时 layout-store 的 message = 本地化前缀 + error.message。判断依据是稳定的
    // messageKey（i18n-core 提供 'layout.saveFailed'），不再比对文案；万一还没提供，
    // 退而用「message 包含原始错误信息」识别 —— 两种方式都与语言无关。
    const state = layoutStore.state() || {};
    const message = String(state.message || '');
    const failedToSave = state.messageKey === 'layout.saveFailed'
      || (message && error && error.message && message.indexOf(error.message) >= 0);
    setLayoutStatusText(failedToSave ? message : ((error && error.message) || message));
  });
  const R = core.mount({
    onLayoutBegin: () => layoutStore.acquire(layoutOwner),
    onLayoutEnd: () => layoutStore.release(layoutOwner),
    onLayoutCommit: (key,value) => { void layoutCommand('edit',key,value); },
    onLayout: (message) => {
      hideTooltip();hidePreview();
      setLayoutStatusText(message);
    },
    onHover: (id, node, sx, sy) => {
      // Ctrl 模式下不弹 hover 气泡：那时是「预览模式」，气泡和预览浮层会打架
      if (R.layoutDragging || ctrlDown || !id || !node) { hideTooltip(); return; }
      showTooltip(node, sx, sy);
    },
    onSelect: (id) => select(id, false),
    onTouchPreview: (node, x, y) => {
      if (!services.preview?.isEnabled?.() || (node.kind !== 'note' && node.kind !== 'heading')) return false;
      showPreviewFor(node, x, y, true);
      return true;
    },
    onCamera: updateHud,
    onFrame: updateStats,
  });

  const editTools=$('layout-tools');
  const layoutStatus=$('layout-status');

  // 布局状态行有两种来源：布局流给的整句（原样显示）、hud 自己的提示（走字典并
  // 记下 key，语言切换时 applyI18n() 据此重翻）。layoutStatusKey 只对后者有效。
  let layoutStatusKey = null;
  function setLayoutStatusText(text) {
    layoutStatusKey = null;
    if (layoutStatus) layoutStatus.textContent = text;
  }
  function setLayoutStatusKey(key, vars) {
    layoutStatusKey = { key: key, vars: vars || null };
    if (layoutStatus) layoutStatus.textContent = kgT(key, vars);
  }
  // 「调整布局 / 结束调整」的 aria-label 与文字标签。常态复用模板流的 ui.layoutMode.*
  // （ui.* 只写在 src/i18n.ui.js），只有编辑态用 hud 自己的 key。
  function syncLayoutModeLabels() {
    const btn = $('layout-mode');
    if (!btn) return;
    btn.setAttribute('aria-label', R.editMode ? kgT('hud.action.endEditing') : kgT('ui.layoutMode.aria'));
    const label = btn.querySelector('.kg-action-label');
    const text = R.editMode ? kgT('hud.action.endEditingShort') : kgT('ui.layoutMode.label');
    if (label) label.textContent = text;
    else btn.textContent = text;
  }

  scope.cleanup(layoutStore.subscribe(state=>{
    let result={skipped:0};
    if(!state.busy)result=R.applyLayout(state.groups);
    setLayoutStatusText((services.layoutStore?state.message:kgT('hud.layout.sessionOnly'))
      +(result.skipped?' · '+kgT('hud.layout.skipped',{count:result.skipped}):''));
    $('layout-undo').disabled=state.busy||!state.canUndo;
    $('layout-redo').disabled=state.busy||!state.canRedo;
    $('layout-reset-group').disabled=state.busy||state.unsupported;
    $('layout-reset-all').disabled=state.busy||state.unsupported;
    $('layout-mode').disabled=state.unsupported;
  }));
  scope.cleanup(()=>layoutStore.release(layoutOwner));
  function runLayoutCommand(kind) {
    R.cancelLayout();
    const key=R.layoutModel.groupKey(R.selected);
    if(kind==='reset-group' && !key){setLayoutStatusKey('hud.layout.selectFirst');return;}
    hidePreview();hideTooltip();void layoutCommand(kind,key,null);surface.focus({preventScroll:true});
  }
  for(const kind of ['undo','redo','reset-group','reset-all'])scope.listen($('layout-'+kind),'click',()=>runLayoutCommand(kind));
  scope.listen($('layout-mode'),'click',()=>{
    R.setEditMode(!R.editMode);$('layout-mode').setAttribute('aria-pressed',String(R.editMode));
    syncLayoutModeLabels();
    editTools.hidden=!R.editMode;
    if (R.editMode) setLayoutStatusKey(mobile ? 'hud.layout.editHint.touch' : 'hud.layout.editHint');
    syncInsets();
    hidePreview();hideTooltip();surface.focus({preventScroll:true});
  });
  scope.listen($('layout-parent'),'click',()=>{
    R.cancelLayout();const n=NODE.get(R.selected),p=NODE.get(n?.parent);
    if(p){R.selected=p.id;setLayoutStatusKey('hud.layout.moveHandleHint');}
    else setLayoutStatusKey(n?'hud.layout.topLevel':'hud.layout.selectElement');
    surface.focus({preventScroll:true});
  });

  scope.listen(canvas, 'mouseleave', () => { R.hover = null; hideTooltip(); });

  // ── 内容区 inset（2026-10-24 阶段 1.5）──────────────────────────────────
  // 顶栏 / 页脚是覆盖在画布上的面板，侧栏打开时右侧 360px 也不可用。渲染器据此算
  // fit / home 与相机中心；这里把「看得见的那块」告诉它。侧栏开合用 MutationObserver
  // 盯 .open 类，不用在十几个调用点里各插一次 syncInsets。
  const TOP_H = 46, BOTTOM_H = 46;
  const more = $('kg-more');
  const moreVisible = () => !!more?.getClientRects().length;
  const moreOpen = () => more?.getAttribute('aria-expanded') === 'true';
  function setMoreOpen(open) {
    if (!more || moreOpen() === open) return;
    more.setAttribute('aria-expanded', String(open));
    syncInsets();
  }
  if (more) {
    scope.listen(more, 'click', () => setMoreOpen(!moreOpen()));
    scope.listen($('kg-actions'), 'click', event => {
      if (moreVisible() && event.target.closest('button') && !event.target.closest('button').disabled) {
        setMoreOpen(false);
        if (!surface.contains(document.activeElement) || document.activeElement?.closest('#kg-actions')) more.focus();
      }
    });
    scope.listen(surface, 'pointerdown', event => {
      if (moreVisible() && moreOpen() && !event.target.closest('#topbar, #hits')) setMoreOpen(false);
    });
    window.addEventListener('resize', () => {
      if (!moreVisible()) setMoreOpen(false);
    });
  }
  function syncInsets() {
    const side = $('sidebar');
    const open = !!(side && side.classList.contains('open'));
    const sideRect = open ? side.getBoundingClientRect() : null;
    const bottomSheet = mobile && open && getComputedStyle(side).getPropertyValue('--kg-sidebar-bottom').trim() === '1';
    const right = bottomSheet ? 0 : sideRect?.width || 0;
    const bottom = bottomSheet ? Math.max(BOTTOM_H, sideRect.height) : BOTTOM_H;
    // 布局工具条可见时是顶栏下方的第二条横带：把它的真实高度计入上内边距，
    // 让 fit / home 与相机中心按「真正没被盖住的矩形」算，而不是按 46px 顶栏算。
    const band = editTools && !editTools.hidden ? (editTools.getBoundingClientRect().height || 0) : 0;
    // 图例 / 搜索命中列表按同一条横带的真实高度避让（窄容器里提示文案会换行）。
    surface.style.setProperty('--kg-band-h', band + 'px');
    const top = moreVisible() ? $('topbar').getBoundingClientRect().height : TOP_H;
    surface.style.setProperty('--kg-top-h', top + 'px');
    R.setInsets({ top: top + band, bottom, right });
  }
  syncInsets();
  window.addEventListener('resize', syncInsets);
  if (typeof MutationObserver === 'function') {
    new MutationObserver(syncInsets).observe($('sidebar'), {
      attributes: true, attributeFilter: ['class'],
    });
  }

  // ── Obsidian 式预览：Ctrl + 悬停「实心圆」（2026-10-24 第五轮）──────────────
  // 药丸层已经整个删除 —— **圆自己就是入口**：
  //   * 悬停在**标题**圆上 → 预览该笔记，并从**这一节**（锚点 `pv-hN`）滚起；
  //   * 悬停在**文件夹 / 笔记**圆上 → 不预览，toast 提示「还没到标题层」；
  //   * Ctrl 松开 / 移到空白 / Esc → 收起。
  // 预览内容沿用构建期的 HTML 片段（markdown 排版 + 运行时 KaTeX + 按路径引用的图片；
  // 标题本身就是片段里的 `<hN>`，所以从这一节滚起时标题是渲染出来的）。
  const PV = $('preview');
  const pvCache = new Map();       // note id → 已含 KaTeX 结果的 innerHTML
  let ctrlDown = false;
  let pvNote = null;
  let hintNode = null;             // 上一次提示过的节点 id（避免每次移动都 toast）
  let pvPinned = false;            // 单击标题圆 = 固定预览（可以慢慢滚，Esc 关）

  services.preview?.setOnHide(() => { pvNote = null; pvPinned = false; });

  const isPreviewPinned = () => services.preview ? services.preview.state().pinned : pvPinned;

  function hidePreview() {
    if (services.preview) { services.preview.hide(); pvNote = null; pvPinned = false; return; }
    if (!PV.classList.contains('show')) return;
    PV.classList.remove('show');
    PV.innerHTML = '';
    pvNote = null;
    pvPinned = false;
  }

  function canvasPoint(evt) {
    const rect = canvas.getBoundingClientRect();
    return [evt.clientX - rect.left, evt.clientY - rect.top];
  }

  function buildPreviewHtml(note) {
    if (pvCache.has(note.id)) return pvCache.get(note.id);
    PV.innerHTML = '<div class="pv-crumbs"></div>' + note.preview +
      '<div class="pv-hint">' + escapeHtml(kgT('hud.preview.hint')) + '</div>';
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(PV, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '\\[', right: '\\]', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
          ],
          throwOnError: false,
          ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option'],
        });
      } catch (e) { /* 单个坏公式不该炸掉整个浮层 */ }
    }
    const html = PV.innerHTML;
    pvCache.set(note.id, html);
    return html;
  }

  function showPreviewFor(node, cx, cy, pinned) {
    if (services.preview) {
      hideTooltip(); services.preview.show(node, cx, cy, pinned);
      pvNote = node.note || node.id; pvPinned = !!pinned; return;
    }
    const hostRect = surface.getBoundingClientRect();
    cx -= hostRect.left; cy -= hostRect.top;
    const note = node.kind === 'note' ? node : NODE.get(node.note);
    if (!note || !note.preview) { hidePreview(); return; }
    if (pvNote !== note.id) {
      PV.innerHTML = buildPreviewHtml(note);
      pvNote = note.id;
    }
    pvPinned = !!pinned;
    hideTooltip();
    PV.classList.add('show');
    // 面包屑：滚深了也知道「哪篇笔记 › 哪一节」
    const crumbs = PV.querySelector('.pv-crumbs');
    if (crumbs) {
      crumbs.textContent = node.kind === 'heading'
        ? (note.label || note.id) + '  ›  ' + (node.label || '')
        : (note.label || note.id);
    }
    // 从这一节滚起：锚点是构建期给每个标题打的 id（拿不到就退回顶部）。
    // 注意要**给 sticky 面包屑让位** —— 只减 12px 的话，标题正好被面包屑盖住，
    // 看起来就是「预览里没有标题」（2026-10-24 实测踩到）。
    const anchorEl = node.anchor ? PV.querySelector('#' + node.anchor) : null;
    const crumbEl = PV.querySelector('.pv-crumbs');
    const crumbH = (crumbEl ? crumbEl.offsetHeight : 0) || 0;
    const padTop = parseFloat(getComputedStyle(PV).paddingTop) || 16;
    // offsetTop 是相对面板 border box 的（含 padding），sticky 面包屑又占住顶部，
    // 所以要让「padding + 面包屑 + 8px」这块空间：只减面包屑的话标题会被压住半截。
    PV.scrollTop = anchorEl ? Math.max(0, anchorEl.offsetTop - (padTop + crumbH + 8)) : 0;
    const w = PV.offsetWidth, h = PV.offsetHeight;
    let x = cx + 18, y = cy + 18;
    if (x + w > window.innerWidth - 12) x = cx - w - 18;
    if (y + h > window.innerHeight - 12) y = cy - h - 18;
    PV.style.left = Math.max(12, Math.min(x, window.innerWidth - w - 12)) + 'px';
    PV.style.top = Math.max(12, Math.min(y, window.innerHeight - h - 12)) + 'px';
  }

  function evalPreview(evt) {
    // Mouse modifiers remain correct when Ctrl was pressed before this view gained focus.
    setCtrlDown(evt.ctrlKey);
    if (evt.target !== canvas) return;
    previewAtPointer();
  }

  function setCtrlDown(value) {
    ctrlDown = !!value;
    R.setCtrlMode(ctrlDown);
    if (!ctrlDown) {
      if (!isPreviewPinned()) hidePreview();
      hintNode = null;
    }
  }

  function previewAtPointer() {
    if(R.layoutDragging)return;
    const point = scope.canvasPointer();
    if (!point) return;
    if (!ctrlDown) {
      // 固定预览（单击打开）只有 Esc / 点别处才收；普通移动不打断阅读
      if (!isPreviewPinned()) { hidePreview(); hintNode = null; }
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const node = R.hitTest(point[0] - rect.left, point[1] - rect.top);
    if (!node) { if (!isPreviewPinned()) hidePreview(); hintNode = null; return; }
    if (node.kind === 'heading' || (services.preview && node.kind === 'note')) {
      hintNode = null;
      if (!isPreviewPinned()) showPreviewFor(node, point[0], point[1], false);
      return;
    }
    // 固定预览中：随手划过别的圆不打断阅读
    if (isPreviewPinned()) return;
    // 文件夹 / 笔记：这一层还没有「标题」，没有可读的正文
    hidePreview();
    if (hintNode !== node.id) {
      hintNode = node.id;
      toast(node.kind === 'folder' ? 'hud.preview.folderHint' : 'hud.preview.noteHint');
    }
  }

  window.addEventListener('mousemove', evalPreview, true);
  window.addEventListener('keydown', (evt) => {
    if (evt.key === 'Control') {
      setCtrlDown(true);
      previewAtPointer();
    }
  }, true);
  window.addEventListener('keyup', (evt) => {
    if (evt.key === 'Control') {
      setCtrlDown(false);
    }
  });
  window.addEventListener('blur', () => { setCtrlDown(false); });

  // 单击 = **把已经打开的预览固定住**（Ctrl 悬停中单击标题圆）。
  // 注意：不抢普通单击 —— 画布单击本来就是「选中节点」，侧栏/顶栏的点击更不能吞，
  // 所以只在预览已经开着、且点在画布上的标题圆时才接管。
  document.addEventListener('click', (evt) => {
    if (evt.target !== canvas) return;               // 侧栏/顶栏的点击不碰
    if(R.suppressClick)return;
    if (!(services.preview ? services.preview.state().open : PV.classList.contains('show'))) return;
    const p = canvasPoint(evt);
    const node = R.hitTest(p[0], p[1]);
    if (node && (node.kind === 'heading' || (services.preview && node.kind === 'note'))) {
      evt.preventDefault();
      evt.stopPropagation();
      showPreviewFor(node, evt.clientX, evt.clientY, true);
      return;
    }
    if (isPreviewPinned()) hidePreview();                     // 点别处 → 收掉固定预览
  }, true);

  // 预览状态（自动化回归 / 控制台排查用；挂在文件末尾的 window.KG 上）
  function pvState() {
    if (services.preview) return { ...services.preview.state(), ctrl: ctrlDown };
    return {
      open: PV.classList.contains('show'),
      pinned: pvPinned,
      ctrl: ctrlDown,
      note: pvNote,
    };
  }

  // 浮层里的 [[链接]] 点击 → 选中目标（与画布上点圆一致）
  scope.listen(PV, 'click', (e) => {
    const wl = e.target.closest ? e.target.closest('.pv-wl[data-wl]') : null;
    if (!wl) return;
    e.stopPropagation();
    select(wl.dataset.wl, true);
  });

  // ── 事件绑定 ──────────────────────────────────────────────────────────
  function stepLevel(delta) {
    const lv = Math.max(1, Math.min(MAX_DEPTH, R.enterAt(R.camera.zoom) + delta));
    R.zoomToDepth(lv);
  }

  function dismiss() {
    if (mobile && services.preview?.state().open) {
      hidePreview();
      surface.focus({ preventScroll: true });
      return;
    }
    if (moreVisible() && moreOpen()) {
      setMoreOpen(false);
      more.focus();
      return;
    }
    if(R.cancelLayout()){hidePreview();hideTooltip();surface.focus({preventScroll:true});return;}
    const target = document.activeElement;
    const tag = (target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select') {
      target.blur(); $('hits').style.display = 'none';
    } else {
      hidePreview(); select(null); hideTooltip();
    }
    surface.focus({ preventScroll: true });
  }

  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape') {
      evt.preventDefault(); evt.stopPropagation(); dismiss(); return;
    }
    const tag = (evt.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea' || evt.target.isContentEditable) {
      return;
    }
    if(R.editMode && (evt.ctrlKey||evt.metaKey) && ['z','y'].includes(evt.key.toLowerCase())) {
      evt.preventDefault();evt.stopPropagation();runLayoutCommand(evt.key.toLowerCase()==='y'||evt.shiftKey?'redo':'undo');return;
    }
    // 方向键平移画布。放在 input/select 守卫之后，所以搜索框里按方向键仍然是移动光标。
    // 它不碰选中态 —— 这正是它存在的理由：看远处的连线时不必按住鼠标拖，也就不会因为
    // 一次不到 5px 的抖动被判成点击、把选中切到别的大父圆上，让想看的箭头被焦点过滤掉。
    const PAN = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const panDir = PAN[evt.key];
    if (panDir) {
      evt.preventDefault();                     // 别让浏览器把方向键当滚动/焦点移动
      const [vx, vy] = R.panStep(evt.shiftKey);
      R.panBy(panDir[0] * vx, panDir[1] * vy);
      return;
    }
    // Home = 回到默认视角。自由缩放之后「缩丢了」变得可能，键盘操作时不该逼人去摸鼠标。
    if (evt.key === 'Home') { evt.preventDefault(); R.resetView(); toast('hud.toast.resetView'); return; }
    if (evt.key === ']' || evt.key === '+' || evt.key === '=') stepLevel(1);
    else if (evt.key === '[' || evt.key === '-' || evt.key === '_') stepLevel(-1);
    else if (evt.key === 'l' || evt.key === 'L') toggleLegend();
    else if (evt.key === '/') {
      evt.preventDefault();
      if (moreVisible()) setMoreOpen(true);
      $('search').focus();
    }
    else if (evt.key === 'Enter' && $('search').value) runSearch($('search').value);
  });

  scope.listen($('zoomin'), 'click', () => stepLevel(1));
  scope.listen($('zoomout'), 'click', () => stepLevel(-1));
  scope.listen($('reset'), 'click', () => { R.resetView(); toast('hud.toast.resetView'); });
  // 重新构建入口常驻顶栏（宿主只在「当前库」视图注入 onRebuild）。
  // 按钮的文案/禁用态由插件按构建阶段同步，这里只负责“点了要重建”。
  const rebuildButton = $('rebuild');
  if (rebuildButton && typeof services.onRebuild === 'function') {
    rebuildButton.hidden = false;
    scope.listen(rebuildButton, 'click', () => { services.onRebuild(); });
  }
  scope.listen($('search'), 'input', (e) => searchSoon(e.target.value));
  scope.listen($('search'), 'focus', (e) => { if (e.target.value.trim()) runSearch(e.target.value.trim()); });
  scope.listen($('search'), 'blur', () => setTimeout(() => { $('hits').style.display = 'none'; }, 180));
  scope.listen($('search'), 'keydown', (e) => { if (e.key === 'Enter') runSearch(e.target.value.trim()); });
  scope.listen($('domain'), 'change', (e) => { filterDomain = e.target.value; applyFilters(); });
  scope.listen($('labels'), 'change', (e) => {
    const v = e.target.value;
    // 2026-10-24 阶段 2.1：模式「只显示选中」以前被映射成 off（一个标签都不画，选中也不画），
    // 语义是错的。现在是独立模式 'selected'：选中项 + 邻居 + 悬停项才挂标签。
    labelMode = v === 'all' ? 'on'
      : v === 'selected' ? 'selected'
      : 'auto';
    R.labelMode = labelMode;
  });

  // ── 图例收起 / 展开 ────────────────────────────────────────────────────
  // 图例的说明文字很长（可见约 20 行），挡住画布左下角时可以折成一条。状态记进
  // localStorage，下次打开还是那个状态。**只切 .collapsed 类**，不碰图例内容的
  // hidden 属性。
  function applyLegendCollapsed(collapsed) {
    $('legend').classList.toggle('collapsed', collapsed);
    const btn = $('legend-toggle');
    btn.textContent = kgT(collapsed ? 'hud.legend.expand' : 'hud.legend.collapse');
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }

  function toggleLegend() {
    const next = !$('legend').classList.contains('collapsed');
    applyLegendCollapsed(next);
    saveLegendCollapsed(next);
  }

  scope.listen($('legend-toggle'), 'click', toggleLegend);

  // ── 启动 ──────────────────────────────────────────────────────────────
  function renderSubtitle() {
    $('subtitle').textContent = kgT('hud.subtitle', {
      notes: META.note_count, headings: META.heading_total,
    });
  }

  renderSubtitle();
  buildPills();
  buildLegend();
  // 图例收起状态：默认展开（老行为和截图基线都不变），只有用户自己收过才记住。
  // 读的时候顺带做 uiStorage ← localStorage 的一次性迁移（见 loadLegendCollapsed）。
  applyLegendCollapsed(loadLegendCollapsed());
  buildFilters();
  // #footer 先按字典填「生成于 …」一行（不闪模板里的中文兜底）；第一帧后由
  // updateStats 换成「读数 + 生成信息」两行。
  $('footer').innerHTML = kgT('ui.footer', { generated: escapeHtml(META.generated || '') });
  updateHud();

  setTimeout(() => toast('hud.toast.scrollHint'), 700);

  // 语言切换时重建 hud 动态 DOM；detach 挂进 scope.cleanup，视图销毁时一并摘掉。
  scope.cleanup(kgI18nOnChange(applyI18n));

  // ── 语言切换（UI-A11）──────────────────────────────────────────────────
  // 模板静态文案由 kgI18nApply 重新 apply；hud 动态生成的 DOM 全在这里重建。
  // 只重填已存在的 DOM（不新开侧栏、不弹新 toast），别让切语言顺手改用户状态。
  function applyI18n() {
    lastReadout = '';
    lastLevel = -1;
    lastStats = '';
    pvCache.clear();                  // 预览 HTML 里嵌着提示行，缓存必须作废
    renderSubtitle();
    buildPills();
    buildLegend();
    updateHud();
    updateStats(R.stats || { nodes: 0, edges: 0, labels: 0, focusEdges: 0, focusNeighbors: 0 });
    if (R.selected && NODE.has(R.selected) && $('sidebar').classList.contains('open')) {
      renderSidebar(R.selected);
    }
    applyLegendCollapsed($('legend').classList.contains('collapsed'));
    syncLayoutModeLabels();
    if (layoutStatusKey) layoutStatus.textContent = kgT(layoutStatusKey.key, layoutStatusKey.vars);
    if ($('hits').style.display !== 'none' && $('search').value.trim()) {
      runSearch($('search').value.trim(), true);
    }
    const pvHint = PV.querySelector('.pv-hint');
    if (pvHint) pvHint.textContent = kgT('hud.preview.hint');
    if (toastState && toastEl.classList.contains('show')) {
      toastEl.textContent = kgT(toastState.key, toastState.vars);
    }
    hideTooltip();
    syncInsets();
  }

  // 调试 / 自动化验证入口 —— 也可以直接在浏览器控制台里用 KG.state() 查状态
  return {
    data: DATA,
    renderer: R,
    camera: R.camera,
    zMin: R.zMin,
    zMax: R.zMax,
    zHome: R.zHome,
    select: select,
    openNote: openInObsidian,
    showPreview: showPreviewFor,
    dismiss,
    layoutCommand: kind => {
      const target=document.activeElement;
      if(!R.editMode || ['INPUT','TEXTAREA','SELECT'].includes(target?.tagName) || target?.isContentEditable)return false;
      runLayoutCommand(kind);return true;
    },
    captureState: () => ({ camera: { ...R.camera }, selected: R.selected,
      search: $('search').value, domain: filterDomain, labels: $('labels').value }),
    restoreState: (state) => {
      filterDomain = [...$('domain').options].some(o => o.value === state.domain) ? state.domain : 'all';
      $('domain').value = filterDomain; R.filterSet = computeFilterSet();
      $('search').value = state.search || ''; runSearch($('search').value.trim());
      $('labels').value = state.labels || 'auto';
      $('labels').dispatchEvent(new surface.ownerDocument.defaultView.Event('change'));
      select(NODE.has(state.selected) ? state.selected : null, false);
      R.cancelInteraction();
      R.tweenTo({ ...state.camera, zoom: Math.max(R.zMin, Math.min(R.zMax, state.camera.zoom)) }, 0);
      R.invalidate(); updateHud();
    },
    previewState: pvState,
    runSearch: runSearch,
    applyFilters: applyFilters,
    applyI18n: applyI18n,
    setLevel: (lv) => R.zoomToDepth(lv),
    zoomToDepth: (lv) => R.zoomToDepth(lv),
    revealOf: (id) => R.revealOf(id),
    alphaOf: (id) => R.alphaOf(id),
    enterAt: (z) => R.enterAt(z),
    visible: () => R.stats,
    state: () => ({
      zoom: Math.round(R.camera.zoom * 1000) / 1000,
      level: R.enterAt(R.camera.zoom),
      shownNodes: R.stats.nodes,
      // 真正按 PAINT_MIN 以上不透明度落了笔、且几何上穿过视口的节点数。
      // 判「视口是不是空的」要看它，不能看 shownNodes（那是候选集大小，可能含
      // 中心远在屏外的大圆 —— 那种圆候选集里有、屏幕上什么都没有）。
      painted: R.stats.painted,
      shownEdges: R.stats.edges,
      focusEdges: R.stats.focusEdges,
      focusNeighbors: R.stats.focusNeighbors,
      marks: R.stats.marks,
      chips: R.stats.chips,
      shownLabels: R.stats.labels,
      selected: R.selected,
      hovered: R.hover,
      search: searchQ,
      // 阶段 2.5：命中集合大小（有上限 2000），回归据此验「封顶生效」
      searchMatches: R.matchSet ? R.matchSet.size : 0,
      labelMode: labelMode,
      filterSet: R.filterSet ? R.filterSet.size : null,
      camera: { zoom: R.camera.zoom, panX: R.camera.panX, panY: R.camera.panY },
    }),
  };
}
