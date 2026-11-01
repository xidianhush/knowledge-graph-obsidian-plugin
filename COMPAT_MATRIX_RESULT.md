# Step 4.6：扩展环境兼容矩阵（46-A2 / 46-A4）

日期：2026-11-01。用户已确认本轮矩阵范围：**阶段一**核心环境（深色/浅色、主窗口分屏、弹出独立窗口与跨窗移动、预览、资源释放），**阶段二**在独立测试库中安装用户指定的 6 个社区插件后重复核心场景。技术验证在本地独立库完成，**未修改日常库、未改动用户笔记、未 push**。

运行环境：Obsidian 应用 **1.14.5**（安装程序 1.6.7、Electron 30.1.2）、插件 **0.0.11**（main.js SHA-256 `205b1bd0383a223f92aef6f09e36327882bd081f3c707bab725fb47b9d3bf049`）、Windows、DSH 会话内 CDP 驱动。测试库为 `.local/native/vault-011`（阶段一）与 `.local/native/vault-012`（阶段二，7 篇合成笔记，其中 1 篇 228 标题长笔记）；独立 profile、独立 CDP 端口（9247 / 9248）。

阶段二插件组合（用户指定，版本为实际安装版本）：

| 插件 | ID | 版本 |
| --- | --- | --- |
| Knowledge Graph Smoke（被测） | knowledge-graph-smoke | 0.0.11 |
| Dataview | dataview | 0.5.68 |
| Obsidian Git | obsidian-git | 2.41.1 |
| Style Settings | obsidian-style-settings | 1.0.9 |
| Excalidraw | obsidian-excalidraw-plugin | 2.28.1 |
| Templater | templater-obsidian | 2.26.0 |
| Omnisearch | omnisearch | 1.32.0 |

## 阶段一：核心环境（9247）

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| A 深色基线：视图挂载、图渲染、节点/边数量 | 通过；1 个视图、294 节点、314 边，`canvasLum` 46.2 | `phase1.json`、`p1-a-dark.png` |
| B 切浅色主题后的可读性与画布 | 通过（可读）；应用 chrome 变浅，**图谱画布仍为深色**（`canvasLum` 46.1，Δ=-0.1）；属 DEC-001 待产品决定项 | `phase1.json`、`p1-b-light.png` |
| C 主窗口分屏（vertical）两个图谱实例 | 通过；2 个视图各自独立画布、节点数一致，深浅两版均正常 | `p1-c-split-dark.png`、`p1-c-split-light.png` |
| D 拖动保存与撤销（单视图路径） | 通过；拖动一条笔记后 `revision 1039→1040`、`groups 30→31`、提示“布局已保存”、`canUndo=true`；撤销后 `revision 1041`、`groups 30` | `phase1.json`、`p1-d-after-drag.png`、`p1-d-after-undo.png` |
| E 弹出独立窗口、跨窗口移动与关闭 | 通过；弹窗内可显示图视图；移动到主窗口后主窗口 1 个图视图、弹窗 2 个；关闭弹窗后主窗口保留 1 个视图、页面目标回到 1 个 | `p1-e-popout.png`、`p1-e-after-move.png` |
| F Ctrl 悬停预览与 Esc 关闭 | 通过；`previewState()` 由 `{open:false}` → `{open:true,ctrl:true,note:"长笔记/Long Note"}` → Esc 后 `{open:false}` | `p1-f-preview.png`、`p1-f-after-esc.png` |
| G 释放全部视图后重新打开 | 通过；`hosts 0`、`leaves 0`、`busy/locked false`；重开后 294 节点、保存布局不变 | `p1-g-reopen.png` |

## 阶段二：7 插件组合（9248）

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 环境：7 个插件全部 loaded、被测插件启用 | 通过 | `phase2.json` |
| A 基线：新库首次建图 | 通过；299 节点、`schema 3`、`rev 0`、`groups 0` | `phase2.json` |
| B 拖动保存与撤销 | 通过；`rev 0→1`、`groups 1`、“布局已保存”、`canUndo` true；撤销后 `rev 2`、`groups 0` | `phase2.json` |
| C 追加标题后重建 | 通过；节点 299→300，`rev 2` | `phase2.json` |
| D 标题改名后重建 | 通过；节点数不变，无异常 | `phase2.json` |
| E 笔记文件改名（Beta.md → Beta-renamed.md） | 通过；Obsidian 的“更新链接”弹窗按“仅此一次”应答后 1.3 s 完成 | `phase2.json` |
| F 文件夹改名（项目/实验记录 → 实验记录-renamed） | 通过；1.3 s 完成 | `phase2.json` |
| G 新建并删除临时笔记 | 通过；节点 300→302→300 | `phase2.json` |
| H Ctrl 预览与 Esc | 通过；`open:true`、`ctrl:true`、目标笔记正确，Esc 关闭 | `phase2.json` |
| I 插件禁用/启用 | 通过；禁用后 `loaded=false`、视图 0；启用后重建正常 | `phase2.json` |
| J 磁盘布局数据 | `data.json` 410 B、`schemaVersion 3`、`revision 2`、`groups 0` | `phase2.json` |
| 改名后的布局身份迁移（带已保存布局） | 通过；拖 Beta 标题得到组键 `["heading","笔记/Beta.md","#Beta Note"]`，文件改名后组键、structures 键同步迁移为 `笔记/Beta-renamed.md`，重建后布局保留；目录改名同理（`项目/实验记录/记录A.md` → `项目/实验记录-renamed/记录A.md`，提示“图谱结构已变化”，重建后保留） | `phase2b.json` |
| Markdown 预览内容（公式/表格/图片/双向链接/Dataview/Callout/Templater） | 通过；`math/table/img/internalLink/dataview/callout` 均渲染，Dataview 渲染为 Alpha/Beta-renamed 列表，Templater 占位符原样显示，未触发截断提示 | `phase2c.json`、`p2c-1-preview.png` |
| 真实 Ctrl+Z 快捷键撤销 | 通过；拖动保存 `rev 7→8`、`groups 2→3`，按 Ctrl+Z 后 `rev 9`、`groups 2` | `phase2c.json`、`p2c-2-ctrl-z.png` |
| 卸载与重装 | 通过（行为符合宿主语义）；卸载后插件目录与 `data.json` 一并删除、视图释放；重装三文件并启用后重新挂载 309 节点，布局数据为空（`data.json` 不存在） | `phase2c.json`、`p2c-3-uninstalled.png`、`p2c-3-reinstalled.png` |

三个阶段脚本报告的未捕获异常均为 0（阶段一 22 条噪声全部计入 benign：启动恢复快照视图的 `smoke-payload.json` ENOENT 与画布像素采样的 `willReadFrequently` 警告，均为测试环境自造；阶段二/2b/2c 为 0）。

## 关键发现

1. **第三方插件模态框会拦截全部鼠标事件**。Excalidraw 首次启动的“欢迎使用 Excalidraw”模态、以及 Obsidian 文件改名时的“更新链接”模态，都会覆盖画布；`document.elementFromPoint()` 返回 `modal-button-container`，`fileManager.renameFile()` 的 Promise 会一直不 resolve（约 20 s 超时，历史稳定性测试中的同名现象同因）。矩阵脚本已改为先关闭/并发应答模态再继续；这不是插件缺陷。
2. **浅色主题下应用 chrome 变浅而图谱画布保持深色**（`canvasLum` 46.2 → 46.1），属 DEC-001 产品待决定项；本轮只记录现状并确认可读性，不在技术轮改视觉契约。
3. **卸载会删除插件数据**：Obsidian 社区插件卸载会删掉插件目录（含 `data.json`），因此卸载即丢失已保存布局；属宿主预期行为，需写入安装/升级/卸载文档。
4. 预览打开/关闭、真实 Ctrl+Z、改名映射、分屏与弹窗在多插件环境下的行为与核心环境一致；未观察到插件特定冲突。

## 局限

- 单实例、单显示器、单次会话；未测多显示器/不同 DPI 缩放、未测移动端。
- 输入由 CDP 合成（真实窗口非 headless），未覆盖触摸与输入法。
- 社区插件只验证上表版本与默认设置下的共存，未穷举各插件自身功能与图谱的交叉交互；未开启 Obsidian 同步类服务端功能。
- 浅色可读性以截图与画布亮度为依据，未做 WCAG 对比度测量。
- 卸载/重装验证的是宿主删除数据行为，不是升级路径（升级保留 `data.json` 已由日常库 0.0.11 升级与 schema3 冷启动证据覆盖）。

## 证据位置

- 机器可读结果：`.local/evidence/compat-matrix/{phase1.json,phase2.json,phase2b.json,phase2c.json}`。
- 截图：`.local/native/evidence/shots/p1-*.png`、`p2c-*.png`。
- 驱动脚本：`.local/native/lead_matrix_phase1.py`、`lead_matrix_phase2.py`、`lead_matrix_phase2b.py`、`lead_matrix_phase2c.py`、`probe_phase2_fix.py`、`prepare_vault012.py`、`cdp_lib.py`。
- 测试库：`.local/native/vault-011`、`.local/native/vault-012`（后者在卸载/重装后布局为空态）。

## 结论

46-A2（浅色主题、分屏、弹出窗口）与 46-A4（指定 7 插件组合中的 Markdown 预览与卸载）**技术验证通过**，范围限定为本轮版本与合成库；46-P2（桌面主题与窗口体验的产品确认，含“图谱是否跟随主题”）仍**待用户验收**。不把本轮结果扩大为“所有插件组合兼容”或移动端结论。
