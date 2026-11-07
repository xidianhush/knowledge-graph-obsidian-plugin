/* i18n 字典：hud 域（UI-A11）。在 src/i18n.js 之后、业务源码之前拼接。
 *
 * 这里只放 hud.js 运行时生成的动态文案（层级胶囊 title、图例学科行/空态、tooltip、
 * 侧栏、搜索命中、toast、布局提示、预览提示、副标题）。模板静态文案（含 ui.footer、
 * ui.layoutMode.*、图例正文）在 src/i18n.ui.js，由 i18n-template 流负责，不要在这里重定义。
 *
 * 约定：zh = 现有中文原文（逐字保留，含空格/标点/`·`）；en = 地道英文。
 * 动态数字/名字用 {name} 占位；英文需要单复数时值写成 (vars) => ... 函数。
 * 唯一允许进 innerHTML 的只有这些字典常量（以及它们插值后经 escapeHtml 的数据）。
 */
kgI18nRegister('en', {
  // ── 节点种类 / 边类型 / 来源（tooltip + 侧栏 tag）──────────────────────
  'hud.kind.folder': 'Folder',
  'hud.kind.note': 'Note',
  'hud.kind.heading': 'Topic',
  'hud.edgeType.prerequisite': 'Prereq',
  'hud.edgeType.derives': 'Cites',
  'hud.edgeType.contrast': 'Parallel',
  'hud.edgeType.contains': 'Contains',
  'hud.edgeHint.prerequisite': 'source is a prerequisite of target',
  'hud.edgeHint.derives': 'source cites target',
  'hud.edgeHint.contrast': 'parallel / contrast, direction unknown',
  'hud.edgeHint.contains': 'hierarchy containment',
  'hud.origin.wiki': 'from a [[wikilink]] in the note body',
  'hud.origin.annotation': 'from a manual annotation in annotations.yaml',
  'hud.origin.frontmatter': 'from note frontmatter',
  'hud.origin.candidate': 'heuristic candidate (unconfirmed)',
  'hud.origin.hierarchy': 'folder/heading containment',
  'hud.origin.mixed': 'merged from several sources',

  // ── 顶栏读数 / 层级胶囊 ───────────────────────────────────────────────
  'hud.levelCounts': 'folders {folders} · notes {notes} · headings {headings}',
  'hud.readout.deeperHint': '— keep scrolling up to go deeper · Ctrl + hover a heading circle to preview its text',
  'hud.readout.previewHint': '— Ctrl + hover a heading circle to preview its text',
  'hud.readout.touchPreviewHint': '— pinch to zoom · hold a note or heading to preview',

  // ── 页脚（第二行是 ui.footer，模板流负责）─────────────────────────────
  'hud.stats': 'nodes {nodes} · links {edges} · labels {labels}',
  'hud.stats.focus': 'nodes {nodes} · links {related}/{edges} · neighbors {neighbors} · labels {labels}',

  // ── 图例 ──────────────────────────────────────────────────────────────
  'hud.legend.noDomain': 'No domain (this vault has no subject folders, or the notes sit at the root)',
  'hud.legend.expand': 'Expand',
  'hud.legend.collapse': 'Collapse',

  // ── tooltip ───────────────────────────────────────────────────────────
  'hud.tip.note': (vars) => 'note · ' + vars.count + (Number(vars.count) === 1 ? ' heading' : ' headings'),
  'hud.tip.folder': (vars) => 'folder · ' + vars.count + (Number(vars.count) === 1 ? ' note' : ' notes'),
  'hud.tip.heading': 'topic · h{level} · L{line}',
  'hud.tip.parent': 'in: {label}',
  'hud.depth': 'level {depth}',

  // ── 侧栏 ──────────────────────────────────────────────────────────────
  'hud.count.headings': (vars) => vars.count + (Number(vars.count) === 1 ? ' heading' : ' headings'),
  'hud.count.notes': (vars) => vars.count + (Number(vars.count) === 1 ? ' note' : ' notes'),
  'hud.sidebar.descendants': (vars) => vars.count + (Number(vars.count) === 1 ? ' element' : ' elements') + ' inside',
  'hud.sidebar.incoming': 'Incoming · what points here ({count})',
  'hud.sidebar.outgoing': 'Outgoing · what it points to ({count})',
  'hud.sidebar.topics': 'Topics (headings in the note, {count})',
  'hud.action.focus': 'Center',
  'hud.action.drill': 'Drill in',
  'hud.action.openObsidian': 'Open in Obsidian',
  'hud.action.preview': 'Preview',
  'hud.action.closeDetails': 'Close details',
  'hud.more.items': '…{count} more',
  'hud.more.topics': '…{count} more, scroll up to see',

  // ── toast ─────────────────────────────────────────────────────────────
  'hud.toast.noFile': 'This element has no file',
  'hud.toast.filterCleared': 'Filter cleared',
  'hud.toast.filterKept': (vars) => 'Kept ' + vars.count + (Number(vars.count) === 1 ? ' note' : ' notes') + ' and their headings',
  'hud.toast.filterNone': 'No notes match this filter',
  'hud.toast.resetView': 'Back to the default view',
  'hud.toast.scrollHint': 'Scroll up over the target area = drill in level by level (domain → subdomain → course → note → topic); scroll down = back out to a coarser level',

  // ── 搜索 ──────────────────────────────────────────────────────────────
  'hud.search.whyHeading': (vars) => 'topic · in "' + vars.note + '" h' + vars.level,
  'hud.search.whyNote': 'note · {parent}',
  'hud.search.whyFolder': (vars) => 'folder · ' + vars.count + (Number(vars.count) === 1 ? ' note' : ' notes'),
  'hud.search.noMatch': 'No matches',
  'hud.search.summary': (vars) => vars.count + (Number(vars.count) === 1 ? ' element' : ' elements') + ' matched, showing the first ' + vars.shown,
  'hud.search.summaryCapped': (vars) => vars.count + ' elements matched (hit the cap, only the first ' + vars.cap + ' are highlighted), showing the first ' + vars.shown,

  // ── 布局调整 ──────────────────────────────────────────────────────────
  'hud.layout.sessionOnly': 'This page session only',
  'hud.layout.skipped': (vars) => vars.count + (Number(vars.count) === 1 ? ' group' : ' groups') + ' changed structure or geometry; automatic layout used',
  'hud.layout.selectFirst': 'Select an element of the group to restore first',
  'hud.layout.editHint': 'Drag a circle or heading to reposition it; changes save automatically — click ✥ in the top bar again to exit',
  'hud.layout.editHint.touch': 'Drag one node and release to save',
  'hud.layout.moveHandleHint': 'Drag the handle labelled "move group"',
  'hud.layout.topLevel': 'Already at the top level — drag the circle or the move handle directly',
  'hud.layout.selectElement': 'Select a folder, note or topic first',
  'hud.action.endEditing': 'Finish layout editing',
  'hud.action.endEditingShort': 'Finish',

  // ── 预览 ──────────────────────────────────────────────────────────────
  'hud.preview.hint': 'Click a heading circle to pin the preview (Esc closes it) · Ctrl + hover for a temporary preview · links in the overlay are clickable',
  'hud.preview.folderHint': 'This level is a folder — no headings yet; keep zooming in to the heading circles',
  'hud.preview.noteHint': 'This is the note itself — no headings yet; keep zooming in to the heading circles',

  // ── 副标题 ────────────────────────────────────────────────────────────
  'hud.subtitle': (vars) => vars.notes + (Number(vars.notes) === 1 ? ' note' : ' notes') + ' · ' + vars.headings + (Number(vars.headings) === 1 ? ' heading' : ' headings')
});
kgI18nRegister('zh', {
  // ── 节点种类 / 边类型 / 来源（tooltip + 侧栏 tag）──────────────────────
  'hud.kind.folder': '文件夹',
  'hud.kind.note': '笔记',
  'hud.kind.heading': '知识点',
  'hud.edgeType.prerequisite': '前置',
  'hud.edgeType.derives': '引用',
  'hud.edgeType.contrast': '并列',
  'hud.edgeType.contains': '包含',
  'hud.edgeHint.prerequisite': 'source 是 target 的前置',
  'hud.edgeHint.derives': 'source 引用了 target',
  'hud.edgeHint.contrast': '并列/对比，方向未知',
  'hud.edgeHint.contains': '层级包含',
  'hud.origin.wiki': '来自笔记正文的 [[wikilink]]',
  'hud.origin.annotation': '来自 annotations.yaml 手工标注',
  'hud.origin.frontmatter': '来自笔记 frontmatter',
  'hud.origin.candidate': '启发式候选（未人工确认）',
  'hud.origin.hierarchy': '文件夹/标题的包含结构',
  'hud.origin.mixed': '多种来源合并',

  // ── 顶栏读数 / 层级胶囊 ───────────────────────────────────────────────
  'hud.levelCounts': '文件夹 {folders} · 笔记 {notes} · 标题 {headings}',
  'hud.readout.deeperHint': '— 继续向上滚可深入 · Ctrl + 悬停标题圆可预览正文',
  'hud.readout.previewHint': '— Ctrl + 悬停标题圆可预览正文',
  'hud.readout.touchPreviewHint': '— 双指捏合缩放 · 长按笔记或标题预览',

  // ── 页脚（第二行是 ui.footer，模板流负责）─────────────────────────────
  'hud.stats': '节点 {nodes} · 关系 {edges} · 标签 {labels}',
  'hud.stats.focus': '节点 {nodes} · 关系 {related}/{edges} · 相邻 {neighbors} · 标签 {labels}',

  // ── 图例 ──────────────────────────────────────────────────────────────
  'hud.legend.noDomain': '未分学科（这个库没有学科目录，或笔记直接放在根目录）',
  'hud.legend.expand': '展开',
  'hud.legend.collapse': '收起',

  // ── tooltip ───────────────────────────────────────────────────────────
  'hud.tip.note': '笔记 · {count} 个标题',
  'hud.tip.folder': '文件夹 · {count} 篇笔记',
  'hud.tip.heading': '知识点 · h{level} · L{line}',
  'hud.tip.parent': '属于：{label}',
  'hud.depth': '第 {depth} 层',

  // ── 侧栏 ──────────────────────────────────────────────────────────────
  'hud.count.headings': '{count} 个标题',
  'hud.count.notes': '{count} 篇笔记',
  'hud.sidebar.descendants': '下辖 {count} 个元素',
  'hud.sidebar.incoming': '入边 · 谁指向它（{count}）',
  'hud.sidebar.outgoing': '出边 · 它指向谁（{count}）',
  'hud.sidebar.topics': '知识点（笔记内标题，{count} 个）',
  'hud.action.focus': '居中',
  'hud.action.drill': '深入下一层',
  'hud.action.openObsidian': '在 Obsidian 打开',
  'hud.action.preview': '预览',
  'hud.action.closeDetails': '关闭详情',
  'hud.more.items': '…另有 {count} 条',
  'hud.more.topics': '…另有 {count} 个，向上滚可见',

  // ── toast ─────────────────────────────────────────────────────────────
  'hud.toast.noFile': '这个元素没有对应的文件',
  'hud.toast.filterCleared': '已取消过滤',
  'hud.toast.filterKept': '过滤后保留 {count} 篇笔记及其标题',
  'hud.toast.filterNone': '没有笔记符合这个条件',
  'hud.toast.resetView': '已回到默认视角',
  'hud.toast.scrollHint': '光标放在目标区域向上滚 = 逐层深入（学科 → 子学科 → 课程 → 笔记 → 知识点），向下滚 = 回到更粗的层级',

  // ── 搜索 ──────────────────────────────────────────────────────────────
  'hud.search.whyHeading': '知识点 · 在《{note}》h{level}',
  'hud.search.whyNote': '笔记 · {parent}',
  'hud.search.whyFolder': '文件夹 · {count} 篇笔记',
  'hud.search.noMatch': '没有匹配',
  'hud.search.summary': '匹配 {count} 个元素，列出前 {shown} 个',
  'hud.search.summaryCapped': '匹配 {count} 个元素（已到上限，只高亮前 {cap} 个），列出前 {shown} 个',

  // ── 布局调整 ──────────────────────────────────────────────────────────
  'hud.layout.sessionOnly': '仅本次页面会话',
  'hud.layout.skipped': '{count} 组结构或几何已变化，使用自动布局',
  'hud.layout.selectFirst': '先选择要恢复的组内元素',
  'hud.layout.editHint': '拖动圆或标题调整位置；改动自动保存，再次点击顶栏 ✥ 退出',
  'hud.layout.editHint.touch': '拖动单个节点，松手即保存',
  'hud.layout.moveHandleHint': '拖动标记为“移动整组”的手柄',
  'hud.layout.topLevel': '已是顶层，可直接拖圆或拖移动手柄',
  'hud.layout.selectElement': '先选择一个文件夹、笔记或知识点',
  'hud.action.endEditing': '结束布局调整',
  'hud.action.endEditingShort': '结束调整',

  // ── 预览 ──────────────────────────────────────────────────────────────
  'hud.preview.hint': '单击标题圆固定预览（Esc 关闭）· Ctrl + 悬停临时预览 · 浮层内链接可点',
  'hud.preview.folderHint': '这一层是文件夹，还没到标题 —— 继续放大到标题圆',
  'hud.preview.noteHint': '这是笔记本身，还没到标题 —— 继续放大到标题圆',

  // ── 副标题 ────────────────────────────────────────────────────────────
  'hud.subtitle': '{notes} 篇笔记 · {headings} 个标题'
});
