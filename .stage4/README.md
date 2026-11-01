# Knowledge Graph Obsidian Plugin — 阶段 4.0 冒烟

项目目录：`D:\what_i_am_doing\Project\knowledge-graph-obsidian-plugin`。

本轮验证现有 Canvas2D 图谱能否运行在真实 Obsidian `ItemView` 中。当前使用本地冻结的 payload，保留原渲染器与交互层；还没有移植扫描、建图、布局管线，因此不是阶段 4 的完整插件。

## 运行

独立测试库在 `test-vault/`，插件已安装在该库的 `.obsidian/plugins/knowledge-graph-smoke/`。打开测试库后，通过侧边栏网络图标或命令面板中的 **Knowledge Graph Smoke: 打开知识图谱冒烟** 打开图谱。

交互沿用原页面：滚轮缩放、拖拽平移、单击选中、搜索、学科过滤、层级胶囊。窄分屏的顶栏可以横向滚动；图例可以收起。键盘快捷键只在图谱获得焦点后生效。

构建只需本机 Node.js，无 npm 安装步骤：

```powershell
cd D:\what_i_am_doing\Project\knowledge-graph-obsidian-plugin
node scripts/build.mjs
```

产物在 `dist/`：`main.js`、`manifest.json`、`styles.css`、`smoke-payload.json`。运行时只依赖 Obsidian API；Node/Python 都只用于开发与测试。

本地快照 `.local/smoke-payload.json` 来自作者 private 图谱，生成时间为 2026-10-25 14:07，含 3515 个节点。`.local/`、`dist/`、测试库和测试配置均已列入 `.gitignore`。这些目录含本地内容，不属于可公开发布的插件源码。

## 测试

自动测试使用 Python、Playwright 和 Pillow，连接独立 Obsidian 实例。不会把插件装入日常使用的 `hush-ob-bucket`。

```powershell
# 首次准备测试库并启动独立 Obsidian 配置；端口 9237 仅绑定本机。
python scripts/prepare_smoke.py --launch

# 实例已经启动时运行；修改插件后先构建、复制 main.js 到测试库，使用 --reload-plugin 刷新。
python scripts/smoke_check.py

# 原项目既有 verify 与 private/public 浏览器基线；日志保存在本项目。
python scripts/baseline.py
```

所有证据保存在 `.local/evidence/`。`smoke-results.json` 每项检查后立即落盘，`obsidian-final.png`、`obsidian-split.png` 是真实 Obsidian 截图。`plugin-canvas.png` 与 `reference-canvas.png` 用于同尺寸画布比较。

截图比较固定同一份 payload、同一渲染器、同一尺寸、同一 DPR、同一相机和悬停状态。基准代码放在仅用于测试的临时参考 frame 中，插件自身使用原生 canvas 和 Shadow DOM，没有 iframe。原项目会自动重建产物，不能直接把不同时间的 HTML 与 JSON 当作同一份基准；`reference-snapshot.json` 记录这一差异。

## 代码位置

- `upstream/`：来自原源码仓库 `29d6a287493bf1ffbb5ae399ba3a15490657a9dc` 的 `render.js`、`app.js`、`template.html`，逐字节保留；`provenance.json` 记录 SHA-256。
- `src/plugin.js`：原生 ItemView、快照加载、ResizeObserver、DPR 与可见性适配、视图释放。
- `src/scope.js`：每视图独立的 DOM/事件/计时器/rAF 管理。关闭移除全局监听并断开 observer；不可见时暂停 rAF，恢复时继续。
- `src/host.css`：窄分屏的顶栏滚动与图例宽度。
- `scripts/build.mjs`：把已有代码静态包进局部宿主作用域，生成 CommonJS `main.js`，不使用 eval。构建时仅调整 CSS 根选择器与容器单位，以及预览浮层的宿主坐标转换。

完整样式位于 Shadow DOM；全局 `styles.css` 只匹配本插件视图，不修改 Obsidian 的全局 `body`、按钮或面板。未往宿主 `window` 写入 `KG` 或 `createRenderer`。

## 已知边界与下一步

1. 当前只显示固定快照，不监听真实 vault 变化，不扫描用户笔记。
2. 预览仍来自旧 payload 的 HTML。Obsidian `MarkdownRenderer`、公式、图片 `getResourcePath`、原笔记跳转尚未接入；快照中的跳转入口只提示当前限制。
3. 画布保持深色视觉。浅色主题配色、触摸操作、移动端和弹出独立窗口尚未验收；`isDesktopOnly: false` 表示没有 Node/Electron 运行时依赖，不代表移动端验证完成。
4. 此次未执行 11 个 fixture 的全量浏览器 sweep，也未运行 JS/Python golden payload 比较，因为没有修改或移植构图布局逻辑。
5. 后续先抽显式 GraphCore 生命周期和宿主接口，逐步替换临时局部作用域包装；再移植纯 JS 建树、建边、布局、LOD，使用 fixtures 做 golden payload 比较。

一个本轮确认的宿主约束：不要把自己的生命周期对象命名为 `view.scope`。该字段由 Obsidian 的键盘系统使用；本实现使用 `graphHostScope`，并以真实键盘事件和零未捕获异常检查守住。

API 依据：[Obsidian 官方 API 声明](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts) 中的 `Plugin.registerView`、`ItemView.contentEl`、`Workspace.getLeaf` 与视图生命周期。
