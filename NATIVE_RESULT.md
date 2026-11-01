# 阶段 4.3 验收：原生预览、笔记跳转与自动更新

日期：2026-10-26。项目：`D:\what_i_am_doing\Project\knowledge-graph-obsidian-plugin`。

## 完成行为

- 当前库图谱支持 Ctrl + 悬停笔记/标题圆的原生预览。预览出现时点击圆或浮层即可固定；Esc / 关闭按钮收起。
- 使用 Obsidian `MarkdownRenderer.render` 和视图拥有的 `Component`。公式由宿主渲染，库内图片由宿主解析为资源 URL；没有打包第二份 Markdown/数学渲染器。
- 浮层在 ItemView 的 light DOM 内，独立于 Canvas/HUD 的 Shadow DOM，使用 Obsidian 主题变量；容器尺寸变化会重新约束浮层位置。
- 侧栏与预览打开按钮在新标签页打开笔记。标题使用当前 Markdown 重新解析的源行号定位，支持同名标题。预览的临时定位标记按源行插入，避免按标题文字找到错误重复项。
- 预览中的内部链接按源笔记解析，图谱标签页保留；嵌入笔记中的链接按嵌入来源逐层解析。
- 监听 Vault 的 create / modify / delete / rename；350 ms 防抖，按当前范围过滤 Markdown 事件。文件夹变动也会触发重建。排除笔记的修改不触发建图。
- 新事件立即使旧任务失效并终止正在运行的 Worker；新数据构建完成后才替换旧图。相机、搜索输入、学科过滤、标签模式、有效选中项恢复；删除项清除选中。
- 构建失败保留上次成功图谱并显示错误。删除最后一篇范围内笔记后显示空状态，监听继续工作，新建笔记可自动恢复。
- 关闭视图取消防抖计时器、读取后续工作、Worker、Vault/workspace 订阅、原生预览组件、监听和 ResizeObserver。异步读取迟到不会重新挂载 DOM。

## 预算与边界

预览按需读取，不把全库正文 HTML 加入 payload。默认每次渲染约 60000 字符；正数 `pipeline.config.preview.max_note_chars` 覆盖上限。按整行截取，必要时补闭合代码围栏。目标标题超过预算时，从该标题处截取并提示查看全文。旧导出器的 `total_chars_budget` 全库预算不用于此按需浮层。

自动更新仍是 Worker 完整重建，未实现逐节点增量布局。更新或隐藏图谱时关闭原生预览，避免保留过期内容；快照模式没有 Vault 自动更新。源文件移动/标题删除而新图尚未就绪时，跳转给出提示。

本轮验证 Windows 桌面 Obsidian 1.14.5，使用独立 test-vault/test-profile。移动端、触摸、浅色主题、弹出窗口和大量第三方 Markdown 后处理插件尚未验收。没有向日常库安装，也没有修改原 `D:\obsidian_vault\knowledge-graph` 实现。

## 实测结果

- `native_check.py`：31 ok / 0 fail。包含原生公式、app:// 图片资源、重复标题行 130 → 编辑器行 129、Ctrl 临时预览、组件卸载、256 字符截取、内部链接跳转、保存合并、自动增删改名、旧图保留、状态恢复、过时 Worker 取消、删空/重建与关闭时迟到读取。
- `vault_pipeline_check.py`：原有 16 ok / 0 fail。
- `browser_core_check.py`：原有 17 ok / 0 fail。
- `smoke_check.py --reload-plugin`：原有 24 ok / 0 fail；冻结快照在同尺寸/DPR/相机条件下，Canvas PNG 与原实现逐像素一致。
- `core_check.mjs`：通过。

总计 88 项集成断言通过，另有 Node 核心检查。没有删减原有断言。测试曾分别误用渲染中途的 DOM 和 Obsidian 返回状态的 `line` 字段，已改为等待原生渲染就绪、检查实际 `cursor.from.line`；标题位置与像素判据均保留。

本轮没有修改 `src/pipeline/` / `src/core/`，没有重跑阶段 4.2 的 12 组 Python/JS golden、Worker/画布对照，也没有把历史结果算入以上 88 项。

## 复现与产物

```powershell
node scripts/build.mjs
python scripts/prepare_smoke.py
python scripts/native_check.py
python scripts/vault_pipeline_check.py
python scripts/smoke_check.py --reload-plugin
python scripts/browser_core_check.py
node scripts/core_check.mjs
```

测试只读写独立测试库中的合成样例。`native_check.py` 为验证空库恢复会删除其自建的 Alpha/Beta 测试笔记，再生成 Again.md；重新执行会重建这些专用样例。

- `dist/main.js`：265680 bytes，SHA-256 `9cace914dd9aafd3522ea87e85c93731ecb5d82d8749bbcfd7daa45413cff323`。
- `.local/evidence/native-results.json`、`native-preview-heading.png`、`native-auto-update-final.png`。
- 既有回归证据：`vault-pipeline-results.json`、`core-browser-results.json`、`smoke-results.json`、`plugin-canvas.png` / `reference-canvas.png`。
- 当前活动代码：`src/adapters/obsidian-native.js`、`src/plugin.js`、HUD/browser 的可选 services 注入和 `styles.css`。

接口依据：[Obsidian 官方 API 类型定义](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts)，本轮核对 MarkdownRenderer.render 的 sourcePath/component 与 WorkspaceLeaf.openFile 的打开状态接口。
