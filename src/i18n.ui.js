/* i18n 字典：ui 域（UI-A11）。在 src/i18n.js 之后、业务源码之前拼接。
 *
 * 本文件只放模板静态文案（upstream/template.html 的 data-i18n*）与 #footer 这一条
 * 运行期文案（模板只留中文兜底，hud 用 kgT('ui.footer', {generated}) 填）。
 * hud 动态重建的 DOM（层级胶囊、图例学科行、侧栏、tooltip、toast）不在这里，
 * 由 i18n.hud.js 负责。
 *
 * 约定：zh = 模板里的中文原文（逐字保留）；en = 地道英文。
 * 含 <b>/<strong> 的值只允许走 data-i18n-html。
 */
kgI18nRegister('en', {
  // ── 顶栏 ──────────────────────────────────────────────────────────────
  'ui.zoomOut': 'Zoom out one level ([)',
  'ui.zoomIn': 'Zoom in one level (])',
  'ui.search.placeholder': 'Search notes / headings…',
  'ui.domain.all': 'All subjects',
  'ui.labels.title': 'Label display strategy (Auto = compete by on-screen density)',
  'ui.labels.auto': 'Auto',
  'ui.labels.all': 'Show all',
  'ui.labels.selected': 'Selected only',
  'ui.rebuild.title': "Rebuild this vault's graph (no need to close and reopen the view)",
  'ui.rebuild.aria': "Rebuild this vault's graph",
  'ui.rebuild.label': 'Rebuild',
  'ui.layoutMode.title': 'Enter/exit layout editing: drag nodes, adjust whole groups',
  'ui.layoutMode.aria': 'Adjust layout',
  'ui.layoutMode.label': 'Adjust layout',
  'ui.reset.title': "Return to this level's default view",
  'ui.reset.label': 'Reset view',

  // ── 布局工具条 ────────────────────────────────────────────────────────
  'ui.layout.parent': 'Pick parent',
  'ui.layout.undo': 'Undo',
  'ui.layout.redo': 'Redo',
  'ui.layout.resetGroup.title': 'Restore the selected element and its siblings under the same parent; adjustments inside child groups are kept',
  'ui.layout.resetGroup.label': 'Restore group',
  'ui.layout.resetAll.title': 'Discard every saved layout adjustment in this vault; undoable for this session',
  'ui.layout.resetAll.label': 'Reset vault layout',

  // ── 图例（静态说明，hud 只重建「学科」列表与折叠状态）──────────────────
  'ui.legend.title': 'Legend',
  'ui.legend.toggleTitle': 'Collapse / expand legend (L)',
  'ui.legend.domainsHeading': 'Subjects (top-level folders)',
  'ui.legend.relationsHeading': 'Relations (one thin line per [[link]], at any scale)',
  'ui.legend.linkColor':
    'Links <strong>colour = subject colour</strong>: same colour within one subject, cross-subject links fade at both ends; storage granularity (note-level / heading-level) does not affect colour — type is shown by line style and endpoint markers',
  'ui.legend.parallel': 'Parallel / comparison (direction unknown) — dashed line, only dots at both ends',
  'ui.legend.endpoints': 'Both ends of a link line: dot = source, arrow = target (the line stops at the circles’ edges, never enters the centre)',
  'ui.legend.strength':
    '<b>Number of lines between the same pair of elements = link strength</b>: at note level, that bundle of thin lines between two notes is how heavily they cite each other',
  'ui.legend.zoom':
    'Zooming <b>only changes line length and shape</b> — not colour, not opacity, not the number of lines. A link runs from one heading to another and must not vanish when you zoom out',
  'ui.legend.contains':
    'Containment is not drawn as a net; on hover/selection a grey <b>dotted line</b> traces the ancestor chain — dotted means “where you are”, solid means “who links to whom”',
  'ui.legend.nodesHeading': 'Nodes (always solid circles)',
  'ui.legend.nodeColor': 'Colour = subject (top-level folder)',
  'ui.legend.nodeSize': 'Size = scale (the more elements beneath, the larger)',
  'ui.legend.nodeSearch': 'Yellow halo = search hit',
  'ui.legend.nodeConnected': 'Blue ring = directly connected to the selection (including links to its child elements, in either direction)',
  'ui.legend.hint':
    'Hover a node and <b>scroll up = drill in level by level</b>, scroll down = back to a coarser level · drag to pan, ' +
    'or pan with the <b>arrow keys</b> (hold <b>Shift</b> for 4× speed; no clicking, no change to the selection) · ' +
    'click for details (<b>only its links stay lit</b>, everything else fades almost away; connected elements get a blue ring) · ' +
    'double-click to drill in · <b>Esc</b> collapses the selection and restores all links · <b>[</b> <b>]</b> step through levels · ' +
    '<b>Home</b> returns to the default view (zoom limits no longer apply — if you get lost, press it)',

  // ── 预览 / 页脚 ───────────────────────────────────────────────────────
  'ui.preview.aria': 'Note preview',
  'ui.footer': 'Generated {generated} · Data from the Obsidian vault (built locally, no server)'
});
kgI18nRegister('zh', {
  // ── 顶栏 ──────────────────────────────────────────────────────────────
  'ui.zoomOut': '缩小一层（[）',
  'ui.zoomIn': '放大一层（]）',
  'ui.search.placeholder': '搜索笔记 / 标题…',
  'ui.domain.all': '全部学科',
  'ui.labels.title': '标签的显示策略（自动 = 按屏幕密度竞争）',
  'ui.labels.auto': '自动',
  'ui.labels.all': '全部显示',
  'ui.labels.selected': '只显示选中',
  'ui.rebuild.title': '重新构建当前库的图谱（不用关开视图）',
  'ui.rebuild.aria': '重新构建当前库的图谱',
  'ui.rebuild.label': '重新构建',
  'ui.layoutMode.title': '进入/退出布局调整：拖动节点、调整整组',
  'ui.layoutMode.aria': '调整布局',
  'ui.layoutMode.label': '调整布局',
  'ui.reset.title': '回到该层默认视角',
  'ui.reset.label': '重置视角',

  // ── 布局工具条 ────────────────────────────────────────────────────────
  'ui.layout.parent': '选父级',
  'ui.layout.undo': '撤销',
  'ui.layout.redo': '重做',
  'ui.layout.resetGroup.title': '恢复所选元素及其同父兄弟；保留内部子组调整',
  'ui.layout.resetGroup.label': '恢复此组',
  'ui.layout.resetAll.title': '清除本库全部已保存的布局调整；本会话可撤销',
  'ui.layout.resetAll.label': '全库恢复自动布局',

  // ── 图例（静态说明，hud 只重建「学科」列表与折叠状态）──────────────────
  'ui.legend.title': '图例',
  'ui.legend.toggleTitle': '收起 / 展开图例（快捷键 L）',
  'ui.legend.domainsHeading': '学科（顶层目录）',
  'ui.legend.relationsHeading': '关系（每处 [[链接]] 各画一条细线，任何尺度都在）',
  'ui.legend.linkColor':
    '链接<strong>颜色 = 学科色</strong>：同一学科内同色，跨学科链接两端渐变；存储粒度（整篇级/标题级）不参与配色，类型看线型与端点标记',
  'ui.legend.parallel': '并列/对比（方向未知）—— 虚线段，两端都只标圆点',
  'ui.legend.endpoints': '链接线的两端：圆点 = 出发点，箭头 = 指向处（线在两个圆的边界处截断，不插进圆心）',
  'ui.legend.strength':
    '<b>同一对元素之间线的条数 = 关联强度</b>：缩到文件级时两篇笔记之间那一束细线，就是它们互相引用的分量',
  'ui.legend.zoom':
    '缩放<b>只改线的长度和形状</b>，不改颜色、不改浓淡、不减少条数 —— 链接本来就是从一个标题指向一个标题的，不该因为缩小而消失',
  'ui.legend.contains':
    '包含：不画成网，悬停/选中时只用灰色<b>点线</b>画出祖先链 —— 点线是「你在哪」，实线才是「谁链接谁」',
  'ui.legend.nodesHeading': '节点（一律实心圆）',
  'ui.legend.nodeColor': '颜色 = 学科（顶层目录）',
  'ui.legend.nodeSize': '大小 = 规模（下辖元素越多越大）',
  'ui.legend.nodeSearch': '黄色光环 = 搜索命中',
  'ui.legend.nodeConnected': '蓝色圆环 = 与选中元素直接相连（含其内部子元素的链接，出入向都算）',
  'ui.legend.hint':
    '光标放在节点上<b>向上滚 = 逐层深入</b>，向下滚 = 回到更粗的层级 · 拖拽平移，\n' +
    '或用<b>方向键</b>平移（按住 <b>Shift</b> 快 4 倍，不用点任何东西、不会改选中）·\n' +
    '单击看详情（<b>只留下与它相关的连线</b>，其余淡到近乎消失；相连的元素亮蓝环）·\n' +
    '双击深入 · <b>Esc</b> 收起并恢复全部连线 · <b>[</b> <b>]</b> 逐层切换 ·\n' +
    '<b>Home</b> 回到默认视角（缩远缩近都不再受限，缩丢了就按它）',

  // ── 预览 / 页脚 ───────────────────────────────────────────────────────
  'ui.preview.aria': '笔记预览',
  'ui.footer': '生成于 {generated} · 数据来自 Obsidian vault（本地构建，无服务器）'
});
