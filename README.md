# Knowledge Map

**Knowledge Map turns your Obsidian vault into one map you can actually navigate.** Every folder, note and heading becomes a circle, every `[[link]]` becomes an edge, and you decide where things sit. Circles are nested the way your vault is nested, so the whole shape of what you know is visible at once instead of one folder at a time.

Available in the Obsidian community directory: [community.obsidian.md/plugins/knowledge-graph-smoke](https://community.obsidian.md/plugins/knowledge-graph-smoke) · desktop only

![The whole vault drawn as one nested map](docs/assets/knowledge-map-overview.png)

## See your knowledge layout

### The idea: containment has depth, and it has a plane

A vault is already a hierarchy. Top-level folders are your subjects, the notes inside them are topics, and the headings inside a note are details. The map draws that containment directly: a folder circle holds its notes, a note circle holds its headings. It keeps drawing outward, so you can start at the whole library and keep going until you are inside a single heading.

The same picture has a second, flat layer on top of the depth: the `[[links]]` between notes and headings. Containment answers *where something belongs*; links answer *what it is connected to*. Knowledge Map shows both at once, without summarising anything — every circle is a real folder, note or heading, and the map is built locally from your Markdown files.

### Explore it: pan, zoom, look closer

Drag the canvas to move across the map without changing level. This is how you find the region you want when the map is wider than the screen.

![Dragging the canvas to pan across the map](docs/assets/knowledge-map-pan.gif)

Scroll up on a circle to go one level deeper, scroll down to come back out. The level pills in the top bar, `[` and `]`, and `Home` do the same thing from the keyboard; `Home` returns to the default view of the current level.

![Scrolling through levels of the map](docs/assets/knowledge-map-zoom.gif)

Ctrl + hover a circle to preview the note or heading without leaving the map. The preview panel renders it natively — formulas, tables, images and embedded notes all work. Click to pin the preview while you keep moving, and press Esc to close it.

![Previewing a note with Ctrl + hover and pinning it](docs/assets/knowledge-map-preview.gif)

## See how knowledge connects

### The idea: knowledge is a chain, not a list

Notes point at each other in chains: one note states a rule, another applies it, a third records what happened when it was applied. In plain text those links are invisible until you follow them one by one, which is exactly when a map helps — the chain becomes a line you can see and follow instead of something you have to remember.

This matters most when something is wrong. If the map shows that a symptom comes from a setting, and that setting comes from a note you had forgotten, the chain gives you a path to investigate. Debugging with a visible path is more reliable than debugging from memory and reflex.

### What it looks like

![Wiki-link edges between notes and headings](docs/assets/knowledge-map-links.png)

Every `[[link]]` is one thin line, at every scale. A dot marks the source end and an arrow marks the target end; when the direction is unknown — a parallel or comparison link — the line is dashed and both ends carry a dot. Links take their subject's colour, and cross-subject links fade at both ends. Several links between the same pair of elements draw several lines, so the bundle between two notes shows how heavily they cite each other. Containment is not drawn as a net: on hover or selection, a grey dotted line traces the ancestor chain of what you are looking at.

Selecting a circle lights up only its own links and puts a blue ring on everything directly connected to it — including links to the child elements inside it, in either direction. Search hits get a yellow halo.

## Arrange the map yourself

### The effect: the important part in the middle

Automatic layout is a starting point, not a verdict. Once a region reads well — the note you open every day in the centre, the branch you rarely touch pushed out to the side, the two subjects you always use together sitting next to each other — you can drag it into that shape and keep it.

The arrangement is stored per group in the plugin's own `data.json`, **never in your notes**. It survives renames of files and headings, moves between folders, and edits to unrelated notes; when a structure changed too much to reconcile, only that group falls back to the automatic layout.

### How: enter adjust mode, drag, leave

Press ✥ **Adjust layout** in the top bar. Drag a circle, or a whole group, wherever you want it; sibling circles move aside to make room. Press ✥ again to finish. The toolbar under the top bar offers **pick a parent**, **undo**, **redo**, **restore this group** and **reset the whole library to automatic layout**; Esc cancels the drag you are in.

![Entering adjust mode, dragging a circle, and leaving the mode](docs/assets/knowledge-map-layout.gif)

![The layout toolbar while adjusting](docs/assets/knowledge-map-layout-toolbar.png)

## Quick start

1. **Install** — see [Install](#install). Desktop Obsidian 1.6.7 or newer.
2. **Build the map** — click the Knowledge Map icon in the left ribbon, or run **Build knowledge map from current vault** from the command palette.
3. **Move around** — drag to pan, scroll to go in and out of levels, `Home` to return to the default view.
4. **Read a circle** — click it: the side panel shows the note or heading, only its links stay lit, and directly connected circles get a blue ring. Double-click to focus, Esc to clear.
5. **Arrange it** — ✥ **Adjust layout**, drag what you want to move, then leave the mode.
6. **Choose the language** — Settings → Community plugins → Knowledge Map → Language: *Follow the app* (default), *中文* or *English*. The map and the settings tab re-render immediately.

| English settings | 中文设置 |
| --- | --- |
| ![English settings](docs/assets/knowledge-map-settings-en.png) | ![中文设置](docs/assets/knowledge-map-settings-zh.png) |

Beyond the three ideas above, the top bar also gives you search for notes and headings, level pills, a subject filter, label controls, and precise zoom; the settings tab controls scope (include/exclude ranges, excluded notes, folder remapping), auto-update and its debounce, and the preview budget.

## Reading the map

- **Colour = subject.** Circles take the colour of their top-level folder.
- **Size = scale.** The more elements sit underneath a circle, the larger it is.
- **Shape = kind.** Folders, notes and headings are all solid circles; the map tells them apart by level, label and size, and the legend lists the exact rules (press `L` to collapse or expand it).
- **Edges = `[[links]]`.** One thin line per link. Dot at the source, arrow at the target, dashed (dots at both ends) when the direction is unknown, and a grey dotted chain tracing containment when you hover or select.
- **Highlighting.** Yellow halo = search hit; blue ring = directly connected to the current selection, in either direction.

## Install

1. Open **Settings → Community plugins → Browse** in Obsidian and search for **Knowledge Map** (desktop only), or open the [directory page](https://community.obsidian.md/plugins/knowledge-graph-smoke) and choose *Add to Obsidian*.
2. Enable the plugin, then open the map from the ribbon icon or the command **Build knowledge map from current vault**.
3. Open the plugin settings to choose which folders take part in the map.

Manual install: copy `main.js`, `manifest.json` and `styles.css` into `.obsidian/plugins/knowledge-graph-smoke/` and enable the plugin. Release files are published on the [releases page](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/releases); since 0.0.14 a release contains exactly those three files, with checksums in the release body. See [INSTALL.md](docs/INSTALL.md) for upgrade, rollback and data details.

## Compatibility and current limits

- Desktop Obsidian **1.6.7 or newer** (`isDesktopOnly: true`). Mobile is not supported.
- Layout adjustment is supported for up to **128 siblings per group** and **5000 affected nodes**; larger groups stay on the automatic layout.
- Undo history keeps the **last 50 steps** and is cleared when the plugin reloads or the structure changes.
- Data written by 0.0.10 and older cannot be adjusted by schema-3 builds; the original data is preserved.
- The canvas is deliberately dark and does not follow a light Obsidian theme.

## 中文简介

**Knowledge Map（知识地图）** 把整个 Obsidian 库画成一张可缩放、可拖动的地图：目录、笔记、标题逐层嵌套成圆，`[[链接]]` 变成连线，圆的大小代表子结构规模、颜色对应顶层目录。它不是另一个大纲视图，而是让你一次看到整个知识结构：包含关系有纵深，链接关系有平面。

**三个用法**：① 拖动画布平移、滚轮逐层进入/退出（层级胶囊、`[` `]`、`Home` 同理）；Ctrl + 悬停圆可预览笔记内容，单击固定、Esc 关闭。② 连线就是 `[[链接]]`：圆点=起点、箭头=终点、双向链接画虚线、标题与所属笔记之间是浅色点线；选中一个圆，只有它的链接发亮、直接相连的圆加蓝环——排查问题时可以顺着链条走，不必凭记忆。③ 点顶栏 ✥「调整布局」，把常用的知识拖到中间、少用的推到两侧，再点一次 ✥ 结束；布局按组保存在插件自己的 `data.json` 里，**不写笔记**，文件改名、目录移动、无关编辑后仍保留（结构差异过大时仅该组回退自动布局）。

界面支持**英文 / 简体中文**，默认跟随 Obsidian 语言（非中文环境为英文），也可在设置里固定为「跟随应用 / 中文 / English」，切换后地图与设置页立即刷新。

- **安装**：社区插件市场搜索 **Knowledge Map**（桌面版），或把 `main.js`、`manifest.json`、`styles.css` 复制到 `.obsidian/plugins/knowledge-graph-smoke/`。
- **要求**：Obsidian 1.6.7+ 桌面版；移动端不支持。
- **限制**：布局调整支持单组 128 个同级节点、5000 个受影响节点以内；撤销保留最近 50 步。

## Data and privacy

The plugin only reads the Markdown files in the ranges you configure and writes its own settings, layout data and one piece of UI state (whether the legend is collapsed) to `.obsidian/plugins/knowledge-graph-smoke/data.json`. It does not modify notes, does not send your notes anywhere, and makes no network requests at runtime. The preview panel renders note excerpts in memory only.

## Development

The release bundle is built with the Node.js standard library only (no npm runtime dependencies, no lockfile); `node scripts/build.mjs` produces `dist/main.js`, and `node scripts/test.mjs` runs the eleven synthetic checks (`11` scripts, all passing on 0.0.14), including `scripts/i18n_check.mjs`, which keeps the English and Chinese dictionaries in sync and rejects untranslated UI strings.

- [docs/DEV_LOG.md](docs/DEV_LOG.md) — development and acceptance log for 0.0.1–0.0.13 and the 0.0.14 release (Chinese)
- [TODO.md](TODO.md) — current tasks, acceptance status and evidence
- [DEVELOPMENT.md](DEVELOPMENT.md) — build/test workflow and delivery boundaries
- [docs/INSTALL.md](docs/INSTALL.md) — install, upgrade, rollback, known limits
- [docs/RELEASE_NOTES_0.0.14.md](docs/RELEASE_NOTES_0.0.14.md) — 0.0.14 release notes
- [docs/RELEASE_CI.md](docs/RELEASE_CI.md) — tagged-release workflow and attestation verification
- [AGENTS.md](AGENTS.md) — collaboration conventions

## License

[MIT](LICENSE)
