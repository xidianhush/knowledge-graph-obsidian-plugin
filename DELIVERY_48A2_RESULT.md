# 48-A2 交付回归与 0.0.12 候选（2026-11-02）

本文记录 48-P2 平台收紧后的 **0.0.12 交付候选**及其回归证据。当前状态：**本地候选，未 push、未发布、未提交社区目录**。日常库仍为 0.0.11，供用户自用体验。

## 1. 候选内容

| 项 | 0.0.11（已发布 pre-release） | 0.0.12（本地候选） |
| --- | --- | --- |
| manifest name | Knowledge Graph Smoke | **Knowledge Map** |
| 插件 id | knowledge-graph-smoke | **不变**（避免既有 data.json 与命令失效） |
| 版本 | 0.0.11 | 0.0.12 |
| minAppVersion | 1.5.7（未验收的声明） | **1.6.7**（已实测） |
| isDesktopOnly | false | **true** |
| 描述 | Stage 4 smoke test...（内部文案） | 暂定：Vault-wide knowledge map with drag-and-drop layout that survives file renames and folder restructures. |
| main.js | 325,976 B / `205b1bd0…` | **不变**，同上 |
| manifest.json | 262 B / `c2cc6672…` | 291 B / `6fcc0b52ec8d44a9e6f1c0749fe2e12a0ebaccf56733a76470cf85e93e39a72f` |
| styles.css | 2,255 B / `ac10538c…` | 不变，同上 |

打包：`node scripts/package.mjs` → `.local/release/0.0.12/`（`main.js`、`manifest.json`、`styles.css`、`SHA256SUMS`），校验 manifest/package 版本一致、拒绝私有快照与 `data.json`。

构建：`node scripts/build.mjs` → `{"bytes":325976,"sha256":"205b1bd0383a223f92aef6f09e36327882bd081f3c707bab725fb47b9d3bf049","payloadIncluded":false}`（manifest 元数据不影响 `main.js`，与 0.0.11 相同）。

合成回归：`node scripts/test.mjs` 10 个脚本全过（layout_state 20 项、rename 12 项、rename_extended 10 项、incremental 12 项、compact 9 项等）。

## 2. 平台声明校准证据

### 2.1 Obsidian 1.6.7（新最低版本）

环境：`profile-m67` 未放置 1.14.5 asar，因此运行 Obsidian 自带 1.6.7（About 显示 `Current version: v1.6.7` / `Installer version: v1.6.7`）；`vault-m67` 为测试库。

结果（`node .local/native/lead_compat_167.py 9251`，证据 `.local/evidence/compat-matrix/phase-167.json`）：插件 0.0.12 正常加载、图谱构建 ready（295 节点）、真实鼠标拖动后 `布局已保存`、`Ctrl+Z` 撤销生效、重建 ready、硬错误 0（仅 `willReadFrequently` 采样警告，属脚本自身读像素行为）。

对照：同一脚本在 0.0.11 上结果一致（证据 `phase-167-0.0.11.json`）。1.6.7 上三个第三方插件（obsidian-git、templater、excalidraw）自身报错与最低版本无关，故 1.6.7 用例仅启用本插件，测试库保持干净。

### 2.2 Obsidian 1.14.5（现用版本）

结果（`.local/native/lead_drag_114.py 9252`，证据 `.local/evidence/compat-matrix/drag-9252.json`）：0.0.12 加载；拖动 `rev 1051→1052`、`布局已保存`、`canUndo=true`；`Ctrl+Z` 后 `rev 1053`、`canUndo=false`；磁盘 `{schemaVersion:3, revision:1053, groups:30, structures:6}`；重建 ready；硬错误 0。

> 过程记录：首次在 9252 上拖拽未保存，根因是 **Excalidraw 首次欢迎弹窗**盖住画布并拦截鼠标（`document.elementFromPoint` 落在 `.modal-bg`）。关闭弹窗后一次通过。该现象已在 `docs/INSTALL.md` 的已知限制中说明（第三方弹窗）。

### 2.3 空白库安装与首用（48-A1 五步，0.0.12）

`vault-blank` 为空库（0 篇笔记），`.obsidian/plugins/knowledge-graph-smoke/` 仅三文件。结果 `.local/evidence/delivery-48a1/blank-vault.json` verdict **pass**：

| 检查 | 结果 |
| --- | --- |
| A 安装文件 | 仅 `main.js`/`manifest.json`/`styles.css` |
| B 空库首次构建 | 0.32 s，`phase=empty`，提示“当前范围内没有可显示的 Markdown 笔记。请检查设置中的包含与排除范围。”，无异常 |
| C 建笔记后构建 | 3 篇（含子目录）→ 11 节点；“标记正文”未写入 `data.json`/状态消息，只在 `NODES[].excerpt`（悬停摘要，内存）出现 |
| D 设置持久化 | `debounceMs=600` 写入 data.json，禁用/启用后仍为 600 |
| E 卸载 | 插件目录与 `data.json` 一并删除（Obsidian 行为） |

新库首次安装会出现“你是否信任这个仓库的作者？”提示，需选“信任仓库作者并启用插件”；已写入 `docs/INSTALL.md`。

## 3. 46-A3 长期资源观测（已完成 90 分钟，通过）

- 实例 9249（`vault-real` 授权副本，95 篇/3310 节点，0.0.11，空布局），脚本 `.local/native/lead_longrun_46a3.py`：每 10 s 采样 heap/fps/state/磁盘/异常/隐藏状态，每 60 s 重建，每 300 s 隐藏→恢复；实际运行 **5,401 s**。
- 结果（verdict **pass**）：**540 次采样、89 次重建、17 次隐藏→恢复**，`failures: []`、`newErrors` 全程 0；heap 首 10 次均值 **41.32 MB** → 末 10 次均值 **52.13 MB**（观测区间 38.12–90.99 MB，属锯齿波动、无单调增长）；fps p50 **63.9** / p95 67.0 / 最低 1.0（重建与隐藏恢复瞬间的采样值）；磁盘 `rev 83` 与 `groups 0 / structures 0` 全程不变（任务期间无编辑，属预期）；`dataBytes` 首末均为 530 B；`busy`/`unsupported` 全程 false。
- 证据：`.local/evidence/longrun-46a3/{longrun.jsonl,result.json}`；实例观测结束后已关闭（连同 9251/9252/9253 测试实例），当前无 Obsidian 测试进程。
- 结论：本观测窗口内无资源泄漏、无渲染异常、无卡死或降级提示；FB-006 保持“已定因非插件”的观察状态，46-A3 后续仅在需要时按同脚本长时复跑。

## 4. 边界与未完成

- 0.0.12 是**本地候选**：未 push、未打 tag、未发布 Release、未提交 Obsidian 社区目录。
- 描述文案为暂定，待用户确认后随最终发布定稿；如正式名称仍保留 `knowledge-map`，目录 id 与显示名可按最终决定再调（id 改名涉及 data.json 迁移，需单独评估）。
- 48-A2 的“最终交付验收”仍需用户在执行安装后确认（`docs/INSTALL.md` 已含安装/升级/卸载/回退步骤）。
- 46-A3 本轮 90 分钟观测已完成（通过）；FB-006 保持观察（勿对渲染页整页 reload）。
- 移动端未验证，manifest 已声明 `isDesktopOnly: true`。
