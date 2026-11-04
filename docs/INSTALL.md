# 安装、升级、卸载与已知限制（0.0.13）

本文面向**使用者**，说明如何把插件装进一个 Obsidian 库、升级、回退与卸载，以及当前版本的已知限制。开发与回归说明见 [DEVELOPMENT.md](../DEVELOPMENT.md)，当前进度与验收记录见 [TODO.md](../TODO.md)。

## 1. 版本与兼容

| 项 | 当前值 |
| --- | --- |
| 插件版本 | 0.0.13（`manifest.json`） |
| 最低 Obsidian 版本 | 1.6.7（`minAppVersion`） |
| 实际验证环境 | 0.0.13 界面在 Obsidian 1.15.0（合成库 vault-012 与「日常库副本」vault-013）验证；0.0.12 及更早在 1.6.7 与 1.14.5 / Electron 30.1.2 / Windows，深色与浅色主题 |
| 平台声明 | `isDesktopOnly: true`，仅支持桌面版 Obsidian；移动端未验证、不在支持范围 |
| 发布状态 | **0.0.13 已正式发布**：tag `0.0.13` + GitHub Release（https://github.com/xidianhush/knowledge-graph-obsidian-plugin/releases/tag/0.0.13），资产 `main.js` 333,570 B sha256 `37589a6f…`、`manifest.json`、`styles.css`、`SHA256SUMS`、`RELEASE_NOTES.md`；仓库含 `versions.json`。0.0.13 已修复日常库验收发现的两处问题（删除标题后整篇标题重排、编辑提示文案），并完成发布门禁 A/B/C（含同名空正文标题笔记重命名回退的同族修复）。0.0.11 仍为 GitHub pre-release。社区目录条目已上线：<https://community.obsidian.md/plugins/knowledge-graph-smoke>（自动评审已完成，仅建议项；也可在 Obsidian 内「浏览」社区插件搜索 Knowledge Map） |

## 2. 手动安装（新建独立库推荐先这样试）

插件需要以下**三个运行文件**，缺一不可：

- `main.js`
- `manifest.json`
- `styles.css`

步骤：

1. 关闭 Obsidian（或准备在安装后重启）。
2. 在目标库中创建目录 `.obsidian/plugins/knowledge-graph-smoke/`。
3. 把三个文件复制进去。**不要**复制 `dist/` 整个目录，也不要复制本地快照 `smoke-payload.json`、证据或测试配置。
4. 打开 Obsidian → 设置 → 第三方插件（Community plugins）。若列表未刷新，先关闭再打开设置，仍未出现则重启 Obsidian。
5. 找到 **Knowledge Map** 并启用。（插件内部 id 仍为 `knowledge-graph-smoke`，为兼容既有数据和命令未改名。）

> **首次在新库安装时可能先出现“你是否信任这个仓库的作者？”对话框**（Obsidian 的库级安全提示）。选择 **信任仓库作者并启用插件**，否则库会以安全模式打开、插件不会加载。这是 Obsidian 对“库内已带插件”的库的一次性确认，与本插件无关；同一库确认过后不再出现。
6. 命令面板执行 **从当前库构建知识图谱**，或用侧边栏图标打开图谱视图。

## 3. 升级

1. 先备份当前插件目录（至少 `data.json`）。
2. 用新版本的 `main.js`、`manifest.json`、`styles.css` **覆盖**旧文件；**保留 `data.json`**。
3. 在设置 → 第三方插件中关闭再开启插件，或重启 Obsidian。
4. 首次打开图谱时，旧格式（schema1/schema2）布局数据会自动迁移为 schema3。正常提示为“布局已保存；已局部适配结构变化，撤销记录已清空”。若迁移失败，插件会保留原数据并提示布局调整暂不可用。
5. 迁移后布局记录体积通常明显减小（同一笔记的多个分组共享一份身份信息），不影响已有布局。
6. 0.0.11 → 0.0.12 仅涉及 manifest 名称/平台声明与版本号变化，`main.js` 与布局数据格式不变，升级后无需迁移，保留 `data.json` 即可。
7. 0.0.12 → 0.0.13 只改界面（顶栏重建按钮、构建完成提示 2 秒消失、布局工具横带），布局数据仍为 schema3，升级无需迁移，保留 `data.json` 即可。
8. 0.0.13 候选期间修复了「删除标题后整篇笔记标题重排」与布局编辑提示文案；重新安装只需再次替换 `main.js`/`manifest.json`/`styles.css` 三文件，`data.json` 保留，无需迁移。

### 回退

- 回退版本时请**同时**恢复旧版 `data.json`（回退到 0.0.10 及更早版本时尤其重要）。
- 旧版插件读到 schema3 数据会提示“布局数据版本不受支持，调整已禁用；原数据保留”，不会损坏数据，但布局调整不可用；恢复旧版 `data.json` 即可正常使用。
- 回退前建议复制整个 `.obsidian/plugins/knowledge-graph-smoke/` 目录。

## 4. 卸载

1. 先备份 `data.json`（如需保留布局）。
2. 设置 → 第三方插件 → 禁用本插件。
3. 删除 `.obsidian/plugins/knowledge-graph-smoke/` 目录。

Obsidian 卸载插件时会连同插件目录删除 `data.json`，**已保存的布局会随之丢失且不可恢复**；笔记本身不受影响。手动删除目录同理。

## 5. 数据与隐私

- 仅**读取**库内 Markdown 文件用于建图，**不修改笔记**。
- 布局与设置只保存在本库 `.obsidian/plugins/knowledge-graph-smoke/data.json`，**不含笔记正文**。
- 笔记节点在悬停/预览时会显示正文摘要（最多 220 字符），这是既有交互的一部分；该摘要只在内存渲染，不写入 `data.json`、不写入日志或状态消息。
- 插件不发送网络请求、不上传笔记内容、不采集遥测。

## 6. 已知限制（0.0.13）

- 单组同级节点超过 128 个，或受影响节点超过修复预算（5000）时，该组回退为自动布局，不能手动调整。
- 图谱画布固定深色，不跟随 Obsidian 浅色主题；宿主界面变浅时画布仍为深色（DEC-001，已决定维持）。
- 撤销最多 50 步，且仅当前会话有效；结构重建、文件改名等会使撤销历史清空。
- 卸载插件会删除布局数据（见第 4 节）。
- 部分第三方插件弹窗（例如文件改名后的“更新链接”确认、Excalidraw 首次欢迎页）会暂时盖住图谱并拦截鼠标输入，处理完弹窗即可恢复。
- 稳定性调查 FB-006 已定因：早期原生自动化对 Obsidian 渲染页执行整页 reload 会触发宿主层告警（插件被禁用时同样出现），属测试驱动产物，不是插件缺陷；正常使用不会触发。详见 [DESKTOP_STABILITY_RESULT.md](../DESKTOP_STABILITY_RESULT.md)。
- 仅支持桌面版 Obsidian（`isDesktopOnly: true`）；移动端未验证、不在支持范围。
- 开发用的快照冒烟命令依赖本地 `smoke-payload.json`；正式交付包只含三个运行文件，不含该快照。
- 兼容性矩阵覆盖 Obsidian 1.14.5 桌面版、单显示器、核心插件与 6 个常见社区插件（Dataview、Templater、Obsidian Git、Style Settings、Omnisearch、Excalidraw），未做 WCAG/无障碍测量；详见 [COMPAT_MATRIX_RESULT.md](../COMPAT_MATRIX_RESULT.md)。

## 7. 生成交付包（维护者）

```bash
node scripts/build.mjs     # 生成 dist/
node scripts/package.mjs   # 白名单三文件 + SHA256SUMS -> .local/release/<version>/
```

`scripts/package.mjs` 会校验 `manifest.json` 与 `package.json` 版本一致、拒绝把 `smoke-payload.json` / `data.json` 打进包，并输出 `main.js` 的字节数与 SHA-256。

## 8. 反馈模板

```
版本：0.0.13 / Obsidian 1.6.7 或 1.14.5 / 操作系统
场景：
操作步骤：
实际表现：
期望表现：
是否可重复（次数/条件）：
```
