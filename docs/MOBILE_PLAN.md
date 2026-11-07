# 移动端支持计划（0.0.15）

状态：**iPad 本轮功能体验、PC 支线与精简 README 已由用户验收；桌面 + iPadOS 的 0.0.15 GitHub Release、门户和原生客户端安装验证均已完成，MOB-A9 完成**（用户 2026-11-07 最新决定）。Android 适配留到下一版，不再是本版发布门槛；iPhone 未验证如实标注。当前执行清单为 TODO.md；接手入口为 docs/HANDOFF_0.0.15_README_RELEASE.md。下文保留原技术蓝图与历史证据，遇到旧双平台门槛以本次范围变更为准。

## 1. 目标与边界

目标：**0.0.15 保留桌面并加入 iPadOS 支持**，提供建图、浏览、预览和单元素触摸拖动。整组拖动与选父级后置。Android 适配移至下一版；iPhone 未做真机验证，不对外宣称已验证。平板与分屏按面板可用宽度适配。此前首版双平台目标被用户 2026-11-07 最新决定取代，Android 12+ 等原目标保留给后续版本。

不是目标（除非用户另行决定）：
- 桌面端保留平移/滚轮/双击/`[` `]`/Home/Esc/Ctrl+悬停预览操作。用户于 2026-11-07 新增 PC-F1 支线，要求桌面与 iPadOS 共用顶层可见性及层级淡入淡出曲线，回归覆盖两种输入模式。
- 不动 schema3、`capture/reconcile/apply` 语义、`upstream/` 的渲染与物理逻辑（与 0.0.14 一致）。
- 不改插件 id（`knowledge-graph-smoke`，`UI-A14` 仍暂缓）。
- 不引入运行时依赖、不引入网络/遥测。

## 2. 初始差距（2026-11-06 历史基线，非当前待办）

起步时 manifest 为 isDesktopOnly:true，源码无 Platform 检测；下表用于追溯原始差距。当前工作区已完成平台检测、isDesktopOnly:false 及主要移动实现，具体状态以 TODO 为准。

| # | 假设 | 位置 | 移动端后果 |
| --- | --- | --- | --- |
| 1 | 有悬停 | `src/adapters/hud.js:619`（tooltip）、`hud.js:713-860`（Ctrl+悬停预览） | 提示气泡与预览入口消失，功能等于不可发现 |
| 2 | 有滚轮 | `src/core/renderer.js:1713-1721`（`wheel` → `WHEEL_STEP 1.12`） | 无法缩放/换层（只剩顶栏 ± 与层级胶囊） |
| 3 | 有键盘 | `src/adapters/hud.js:921-950`（Esc、Ctrl+Z/Y、方向键、Home、`[` `]`、`L`、`/`） | Esc 关面板、快捷键全失效 |
| 4 | 有双击 | `src/core/renderer.js:1801`（`dblclick` → 聚焦） | 双击在触屏会先触发两次 tap（选中切换），需改按时间窗识别 |
| 5 | 鼠标键位 | `src/adapters/canvas-platform.js:16`（`button === 0` 起拖动）、`hud-scope.js:55-62`（`mousemove` 跟踪指针） | 合成鼠标事件能凑合，但没有捏合、没有长按、指针离开即丢状态 |
| 6 | 顶栏单行 9 个控件 | `upstream/template.html:303-327`：品牌 + `#levelbar`（−/胶囊/+）+ `#readout` + `#search` + `#domain` + `#labels` + `#rebuild` + `#layout-mode` + `#reset`；容器宽 ≤1000px 时已改成横向滚动（`src/host.css:38-46`）、≤880px 再收（`:50-53`） | 手机上 46px 横条只能滚动，主要动作被藏到屏幕外 |
| 7 | 侧栏 360px | `upstream/template.html:114-126`（`width: min(360px, 40vw)`） | 竖屏 390px 宽时占 40vw≈156px，内容挤成条 |
| 8 | 预览浮层 700px | `upstream/template.html:251-263`（`width:700px; max-width:calc(100vw - 32px); max-height:74vh`） | 可用但贴边、软键盘弹出会盖住 |
| 9 | 布局横带 38px 单行 | `src/host.css:4-12`（`#layout-options` 可换行） | 5 个按钮 + 状态在高 DPR 小屏上会换行挤压画布 |
| 10 | DPR 直采 | `src/adapters/canvas-platform.js:10`、`src/adapters/browser.js:56,65` | 手机 DPR 3 时 canvas 后备缓冲约 1170×2532×3²，内存与填充率翻倍 |
| 11 | Blob Worker | `src/adapters/vault-pipeline.js:14`（`URL.createObjectURL(new Blob([PIPELINE_WORKER_SOURCE]))`） | iOS/部分 WebView 上 Blob worker 可能不可用 → 建图直接失败，必须降级 |
| 12 | 布局上限按桌面定 | `src/core/layout-edit.js:28`（兄弟 >128 拒绝）、`:39`（子树 >5000 拒绝）、`src/core/renderer.js:1019`（可见边预算） | 手机上 5000 节点虽能跑但交互卡顿，需要移动端更保守的预算或"只读提示" |

已知**不需要改**的：持久化已在 0.0.14 从 `localStorage` 迁到 `data.json` 的 `ui`；i18n 引擎（`src/i18n.js`）与 209 个 key 可直接复用，移动端只需新增/调整少量按设备切换的提示文案；`:has` 已移除（`src/host.css:16`）。

## 3. 交互方案（触摸）

原则：**单指操作 = 桌面左键**，双指 = 缩放（替代滚轮/Ctrl），长按 = 悬停（替代 hover），可见按钮 = 键盘（替代快捷键）。

| 桌面 | 移动端 | 实现要点 |
| --- | --- | --- |
| 拖拽平移 | 单指拖动 | `pointerdown/move/up` + `touch-action: none`（加在 `#cv`），`PointerEvent.pointerType === 'touch'` 分支；不要用 `mousedown` 叠加，避免双触发 |
| 滚轮缩放 | 双指捏合 | 两个 pointer 的中点做缩放锚点，`scale` 比映射到 `zoomTo`；`pointercancel` 必须清理 |
| 单击选中 | tap | 保留现有 hitTest；tap 与拖动的判定沿用 5px 阈值（`renderer` 已有的 `dragMoved`） |
| 双击聚焦 | double-tap | 用两次 tap 的时间窗（≤300ms）+ 位移阈值识别，随后吞掉第一次的选中副作用（或允许先选中再聚焦，但要从体验上验证） |
| Ctrl+悬停预览 / 悬停 tooltip | 长按（500ms）显示预览/标签卡 | 长按期间若移动 >8px 则取消（转成拖动）；松手不关闭，点空白或关闭按钮关闭；配合 `-webkit-touch-callout:none; user-select:none` |
| Esc 关闭 | 面板统一关闭按钮 + Android 返回键（若 Obsidian 把它转成 Escape/`backbutton`） | 每个浮层（预览、侧栏、命中列表、图例展开）都要有关闭入口 |
| `[` `]` 逐层 | 顶栏 `−`/`+` 与层级胶囊（已有） | 无需新增；移动端把 `#levelbar` 固定在顶栏可见位置 |
| Home 重置 | `Reset view` 按钮（已有）+ 菜单项 | 小屏放进"更多"菜单 |
| 方向键平移 | 单指拖动（已有） | — |
| Ctrl+Z / Ctrl+Shift+Z | 布局横带的 Undo/Redo（已有） | 编辑态才显示，移动端用横向滚动条或两行 |
| `/` 聚焦搜索 | 搜索图标 → 展开输入框 | 小屏默认收起，点击展开并自动聚焦（注意软键盘顶起布局） |
| `L` 图例 | 图例头部 `Legend` 切换按钮（已有） | 移动端默认**收起**（首次进入），避免遮挡画布 |

需要写进 i18n 的设备相关文案（新增 key，遵循 `scripts/i18n_check.mjs` 门禁：en/zh 双写、模板绑定）：
- `ui.hint.touch.pan` / `ui.hint.touch.pinch` / `ui.hint.touch.longPress`（顶栏副标题与图例里的桌面话术要换掉）
- `ui.preview.pin` 的触屏变体（"点击固定"→"长按预览，点关闭")
- `ui.layout.hint.touch`（布局模式的操作提示）
切换方式：hud 启动时按 `Platform.isMobile` 选择 key 前缀（`ui.hint.*` vs `ui.hint.touch.*`），`applyI18n()` 里同步重建——不要在两套文案里各写一遍桌面文案。

## 4. 布局方案（断点）

现有断点：容器 ≤1000px（顶栏横滚 + 隐藏品牌/读数）、≤880px（收紧间距、搜索 110px）。手机竖屏容器约 390–430px，需要第三档。

建议新增 `@container (max-width: 520px)`：

- **顶栏**：品牌缩成图标/首字母；`#levelbar`（−/胶囊/+）保留；搜索、学科、标签、重置、更多全部收进右侧 **`⋯` 菜单**（点开是一个 46px 下方的下拉面板，复用现有控件 DOM，只改容器位置，避免两套 DOM）。构建按钮在手机上保留在菜单里（构建中状态仍在底部胶囊）。
- **布局横带**：`#layout-options` 改横向滚动（`overflow-x:auto; flex-wrap:nowrap`），状态文字截断；高度用 `--kg-band-h` 继续由 hud 写入，保证画布 inset 跟着变。
- **侧栏**：改为底部抽屉（`bottom sheet`，`max-height: 62vh`，可拖拽把手），宽度 100%；`kg-sidebar-open` 规则里的横带让位在手机上变成"横带上移"（`right` 改动无意义）。
- **预览**：全屏 sheet（左右 12px、上下安全区），标题栏 sticky（`Open note` / 关闭按钮），软键盘弹出时用 `visualViewport` 或 `max-height: 60vh` 兜底。
- **图例**：默认折叠；展开时最大高度 `min(70vh, 100% - 安全区)`，可滚动。
- **footer**（生成时间/统计）：手机上缩小到一行 11px，`bottom: calc(8px + env(safe-area-inset-bottom))`。
- **安全区**：所有贴边元素加 `env(safe-area-inset-*)`（iOS 刘海/Home 条、Android 手势条）；`html`/`.kg-surface` 不要用 `100vh` 而是 `100dvh` 或宿主给的容器高度（Obsidian 移动端地址栏会变）。

## 5. 平台与 API 差异

1. `manifest.json:8` → `"isDesktopOnly": false`。注意：**改这个字段等于宣布移动端可用**，社区目录与用户会按此安装；建议只在 MOB-A1…A8 通过后再发布 0.0.15。
2. 检测：`const { Platform } = require('obsidian')`，用 `Platform.isMobileApp` / `Platform.isMobile`；`Platform.isTablet` 在旧 minAppVersion（1.6.7）可能不存在，需 `typeof Platform.isTablet === 'boolean'` 兜底，或以 `window.innerWidth >= 700 && Platform.isMobileApp` 近似。
3. 生命周期：移动端切后台会触发 `visibilitychange`，`GraphCore.pause()/resume()` 已有（`src/core/graph-core.js:54-68`），浏览器适配层已监听 `visibilitychange`（`src/adapters/browser.js`），需在真机验证回来时不黑屏。
4. Worker：`src/adapters/vault-pipeline.js:14` 的 Blob URL 在 iOS 上曾出现不可用；必须 `new Worker(url)` 包 try/catch + `onerror`，失败回退到主线程分块构建（每 N 篇 `await new Promise(r => setTimeout(r, 0))` 让出主线程并更新进度）。
5. 存储：已用 `data.json`（0.0.14），不要重新引入 `localStorage`。
6. 文件系统：移动端 vault 路径由 Obsidian 管理，`vault.adapter` 语义相同；不要写插件目录外的文件。
7. 返回手势：Android back 在 Obsidian 中通常用于关面板/退出；若插件浮层打开时应先关浮层（监听 `window` 的 `keydown Escape`，Obsidian 移动端是否派发 Escape 需真机确认；如不派发，需要 `app.workspace.on('layout-change')` 或历史记录方案，**先测再定**）。
8. 图标：`addRibbonIcon` 在移动端显示在左侧抽屉，行为一致，无需改。

## 6. 性能与内存预算

原则：先测量，再定数字；不达标时通过预算（可见边、标签、DPR、上限）解决，不改布局算法。

建议先测这些基线（合成库：`.local/demo-vault` 134 节点；压力库用 3,000 / 5,000 节点的合成数据，脚本可复用 `.local/a13/build_demo_vault.py` 思路）：

| 指标 | 建议目标（中端 Android，DPR≤2，1,000 节点） |
| --- | --- |
| 视图首次可交互 | ≤ 2.0 s（134 节点 ≤ 1.0 s） |
| 平移/缩放帧率 | ≥ 50 fps（连续 10 s 拖动，无 >100ms 长任务） |
| 布局拖动保存 | ≤ 120 ms（单组 128 兄弟） |
| 内存峰值 | ≤ 250 MB（`performance.memory` 或 devtools；iOS 需真机 Instruments） |
| 冷启动建图（5,000 节点） | ≤ 6 s，期间 UI 可响应/可取消 |

实现手段（按需启用，不预先加复杂度）：
- DPR clamp：`Math.min(devicePixelRatio, 2)`（`canvas-platform.js:10` / `browser.js:56,65`），移动端强制 2 以省带宽与内存。
- 标签默认 `auto` 且移动端进一步收紧（`#labels` 值在移动端默认 `selected`）。
- 可见边预算按设备分档（`renderer.js:1019` 附近已有预算逻辑，读它再定参数）。
- 节点上限：布局编辑的 128/5000 上限在移动端保持**语义**（错误提示一致），但可以给移动端更早的"只读/提示"降级——需产品决定（MOB-P1）。

### 2026-11-07 A6/A7 辅助测试记录

来源为 Windows Obsidian 1.15.0 全合成库，DPR2 模拟移动布局；不能作为 iPad/iPhone 真机结论。

- 1,000 节点（90 笔记、900 标题、10 文件夹）：旧候选重建 101.9ms，新候选 119.1ms；10s 程序化平移/缩放约 26.5→27.1fps。
- 5,000 节点（490 笔记、4,500 标题、10 文件夹）：旧候选重建 413.3ms，新候选 388.9ms；相同采样约 17.4→19.0fps。
- 帧率未达到建议目标，也受 Windows GPU/窗口调度影响；单次辅助样本不能推定真机达标或桌面所有场景无退化。本轮保留已有 DPR、标签和边预算，待真机数据决定调整。
- 新候选运动后 JS heap 单点为 33.7 / 99.9MiB，未强制 GC、未测峰值、未计原生/显存，不代表满足 250MB App 峰值。首次可交互、冷启动和 128 兄弟保存延迟待测。
- 强制 Worker 构造失败：5,000 节点重建约 385ms，10ms 定时器实际最大间隔 16ms；布局阶段取消保留旧图，Worker active=0，控制台异常 0。Node 嵌套/平铺/单篇多标题三种 5,000 节点完整 payload 与 PC-F1 逐字一致，计时器最大间隔约 21–26ms；iOS 故障注入未验证。
- 同步与降级路径共用生成器，关联/圈打包内保留让步点，主线程约 8ms 让出一次；单次解析和排序没有 8ms 硬上限，超大单篇仍需实测。基础设施错误回退，数据错误报告，取消不发布半成品。
- 证据在 .local/evidence/mobile：a6-{1000,5000}-pc-f1.json、a7-native-{1000,5000}.json、a7-pipeline-scale.json。扩展结果一致性、阶段取消、失败清理和排除项检查后，11 个合成脚本全过。
- 候选 main.js 416,015 B，SHA-256 fa6087c4c03debb11deaa4d52c685bf3cd0837af740ec2c066af798e2fb30bce；测试热服务回读同 hash，后续 iPad 回归见下方用户结果。PC-F1 日常库支线已由用户验收结束，后续候选使用测试库。

### 2026-11-07 用户 iPad 结果与 PC-F2

用户报告来源：iPad Pro 2022 / iPadOS 26.5.2 / Obsidian 1.15.0 (396)，测试库含 85 笔记、3050 节点。首次构建提示 0.26s、重复 0.18s，用户表示无明显等待；全屏/窄窗连续操作顺畅，保存位置经三次重建保留，切后台恢复正常。长笔记小节预览补测后，用户总评测试功能正常。A7-01 明确填写取消未测；iOS Worker 故障注入仍无真机证据。提示秒数不等于严格首次可交互，主观流畅度不代表达到 50fps；5000 节点真机冷启动、128 兄弟保存延迟和系统内存峰值仍待测。

本次新反馈 PC-F2 同时影响 PC/iPad：连线错误地用 contentHeight 作为绝对 y 边界，造成底部提前截断，视觉上像被底栏盖住。共享修正令语义边和箭头使用整块画布，保持页脚 DOM 与相机 fit；11 项检查及 Windows 原生像素对照通过，后续用户体验结论见下方本轮收尾。新测试候选 main.js 416,150 B / SHA-256 8801c3a3e5c2d96fcd6d230e8b703eac8472ac815e677e915c81c23249411391，已放入原测试热服务。接续 A8 的 iPad 宿主主题、组合输入、系统打断场景；不替代 iPhone/Android 证据。

## 7. 任务分解（TODO 里的 MOB-*）

| ID | 工作 | 完成标准 |
| --- | --- | --- |
| MOB-P1 | 用户决定范围：Android 是否优先/是否必须 iOS、最低系统版本、是否接受移动端功能降级（如布局编辑只支持单元素拖动）、性能目标机型 | 有明确答复并写入 TODO；未答不擅自开工 iOS 专属优化 |
| MOB-A1 | `isDesktopOnly:false` + `Platform` 检测 + 桌面回归 | 桌面 `npm test` 11 脚本全过；Android 真机能加载插件、打开视图不报错；桌面行为无变化 |
| MOB-A2 | 响应式布局（≤520px 档 + 安全区 + 三块浮层重排） | 390×844 竖屏下顶栏动作全部可达、无控件被裁切；横屏可用；桌面 ≥880px 外观不变 |
| MOB-A3 | 触摸交互层（pointer events：拖/捏合/tap/double-tap/长按） | 真机：单指平移、双指缩放、tap 选中、双击聚焦、长按预览、拖动结束状态干净；无卡死/无双触发 |
| MOB-A4 | 快捷键的触屏等价 + 设备相关文案 | 每个桌面快捷键都有可见触屏入口；`i18n_check` 通过；中英两套无残留 |
| MOB-A5 | 预览/侧栏/图例移动化（底部抽屉、全屏预览、关闭入口） | 软键盘弹出不遮挡输入；返回键/关闭按钮可关浮层；预览内链接可跳转 |
| MOB-A6 | 移动端性能与内存实测（含 DPR/标签/边预算调整） | 达到 §6 目标或记录实测数字与偏差原因；不劣化桌面帧率 |
| MOB-A7 | pipeline worker 降级路径 | 模拟 worker 失败（禁用 Blob worker）仍能建图；进度/取消可用；5,000 节点不冻结 UI |
| MOB-A8 | 移动端兼容矩阵 + 桌面回归 | 见 §8 矩阵表逐项有截图/录屏证据；桌面 1.15.0 回归无异常 |
| MOB-A9 | 发布门禁 0.0.15 | 版本/versions.json/三资产/attestation/Release 正文/门户说明（isDesktopOnly 变更）全部完成；`npm test` 11 脚本全过 |
| MOB-A10 | 移动端 README/门户素材（可选，待用户定） | 手机截图/GIF 进 `docs/assets/`；README 增加"Mobile"小节且不夸大成"完全对等" |

## 8. 验证矩阵

环境限制（当前机器）：Windows 10 + Obsidian 桌面 1.15.0；**没有 macOS，无法跑 iOS 模拟器**；Android 需 USB 调试 + `adb`（本机是否已装 adb 待确认）。因此：

- Android：真机/模拟器 + `adb` + Chrome DevTools remote debugging（Obsidian Android 是 WebView，可 `chrome://inspect` 挂 CDP；若不允许，退回 logcat + 录屏 + 应用内 diagnostics）。
- iOS/iPadOS：由用户在 iPad 手动测试平板和分屏并提供录屏或结果；iPhone 窄屏另行收集真机证据。iPad 结果只计入对应设备与系统版本。
- 桌面：现有 CDP 流程（`.local/native/cdp_lib.py`，端口 9248/9249/9251）继续作为回归基线。

长期完整矩阵如下；0.0.15 按用户新范围覆盖桌面+iPadOS，其余平台不是本版必须补齐的验收任务。每个已测格要求记录建图、平移缩放、选中/预览与异常来源：

| 维度 | 取值 |
| --- | --- |
| 平台 | iPad Pro 2022（用户真机）、Android 手机（竖/横）、Android 平板、iPhone（用户手动）、桌面（回归） |
| 系统 | Android 12+（记录 Android API 与 WebView 提供程序及版本）、iOS/iPadOS 16.4+。用户设备为 Huawei nova 11 / HarmonyOS 4.2.0（Android API / WebView 待核实）和 iPad Pro 2022 / iPadOS 26.5.2。另补 iPhone 窄屏真机冒烟。用户设备的结果按实测版本与来源记录。 |
| 窗口 | 全屏、分屏、浮窗（若 Obsidian 支持） |
| 主题 | 深色（唯一画布主题）、宿主浅色下的界面文字可读性 |
| 键盘 | 软键盘弹出（搜索/设置页）、外接键盘（若可用） |
| 手势 | 系统返回手势、下拉通知、来电打断后恢复 |
| 规模 | 134 节点演示库、1,000 节点合成库、5,000 节点压力库 |
| 输入法 | 中文输入法（搜索框组合输入不误触快捷键） |

证据存放：`.local/evidence/mobile/<case>.json` + 截图/录屏（不入库）；用户可见结论写 TODO 对应行。

### 2026-11-07 本轮用户验收收尾

用户已在验收报告完成 PC-F2-01/02 和 A8-01…03，并在聊天确认所有本轮待测功能暂无异常。PC-F2 底部连线与屏外端点修正按用户验收通过，PC 支线结束；报告未将这两项结果按平台拆列。当前 iPad 功能用例新增通过：宿主主题切换、软键盘及妙控键盘中文组合输入、系统控制/通知面板打断后的图谱与预览恢复。来源均为用户手工验收，不是代理直接观察真机。

当前 iPad 功能体验阶段可收尾。A7-01 仍明确填写取消未测；iOS Worker 故障注入、客观 FPS/系统内存、5000 节点真机冷启动与 128 兄弟保存延迟没有新增证据。用户随后明确 0.0.15 按桌面+iPadOS 发布，Android 适配移至下一版；iPhone、最低系统版本及未测指标在发布资料中如实披露，不能据此宣布全 iOS/Android 已验证。

发布说明见 RELEASE_NOTES_0.0.15.md；README 已获用户认可。本地版本已 0.0.15，11 个合成脚本和 Windows 独立合成库 10 项原生检查通过，三资产与二次构建一致；详见 RELEASE_PREP_0.0.15.md。用户明确授权后已完成源码 commit/push、tag `0.0.15` 和 GitHub Release；Actions run `42355198309` 成功，三资产下载哈希及来源记录核对通过。门户/社区客户端状态见发布记录；本轮没有新增 iPad 真机证据。

## 9. 发布门禁（0.0.15）

1. `npm test` 11 脚本全过；`node scripts/build.mjs` 记录 bytes/sha256。
2. 本版核对桌面 + iPadOS 证据与最终候选回归，iPad 结果标注用户验证及实际设备/版本；未测项披露。用户 2026-11-07 已将 Android 适配移到下一版，取消本版 Android 真机硬门槛。iPhone 未验证，不宣称全部 iOS 设备支持已确认。
3. 桌面 1.15.0 原生回归（视图/布局/预览/撤销/重建）无回退。
4. 版本：`manifest.json` / `package.json` 0.0.15，`versions.json` 增 `"0.0.15":"1.6.7"`，`isDesktopOnly:false`。
5. `docs/RELEASE_NOTES_0.0.15.md` 写清移动端支持范围与已知限制（不要写"完全支持移动端"）。
6. 推 tag 前需用户明确授权；Release 走 `.github/workflows/release.yml`（三资产 + attestations）。
7. 门户：Edit listing 描述是否需要补 Mobile 说明；isDesktopOnly 变更会让条目从"Desktop only"变为全平台，需在发布说明里告知。

## 10. 已知风险与待确认

- **范围已定**：本版桌面+iPadOS，支持触屏单元素编辑；整组/选父级后置，Android 下一版。不要重复发起已决定的 MOB-P1。
- **性能真相**：Obsidian 移动端 WebView 版本差异大（Android System WebView 可低至 100+），5,000 节点可能无法达标；需要真机数据再定上限。
- **iOS 不可测**：本机无 macOS；iOS 只能靠用户手动验证，发布前应明确告知用户这一限制。
- **触摸误操作**：布局编辑依赖精细拖动，手指遮挡 + 5px 阈值可能误触；可能需要"选中后再拖"两段式。
- **软键盘与 canvas**：搜索框聚焦会顶起布局，需实测 `visualViewport` 行为。
- **社区评审**：`isDesktopOnly:false` 后评审可能要求移动端截图/说明；提前准备（MOB-A10）。
- **不动的东西**：schema3、`capture/reconcile/apply`、`upstream/` 渲染物理、插件 id、日常库（除用户明确授权）。

## 11. 当前执行顺序（2026-11-07 更新）

1. MOB-P1 已确认，用户最新将本版范围收窄为桌面+iPadOS，Android 下一版。不要重新询问已定范围或从 MOB-A1 重做移动开发。
2. README 已按 simple and accurate 精简并获用户认可；原始设计与结果见 docs/README_PLAN_0.0.15.md，不重复改写。
3. iPad A1/A2/A5/A3/A4、A6 主观体验和本轮 A8 功能场景，以及 PC-F1/F2 已有用户验收记录；A7 技术故障注入只有 Windows/Node 证据，iPad 取消未测。保留来源与边界。
4. MOB-A9 本地准备已完成：版本三处同步、安装/发布说明、最终测试、三运行资产、校验值与具体门户文案，见 RELEASE_PREP_0.0.15.md。GitHub 发布与下载文件安装验证已完成；门户 0.0.15 / 审核 Completed、原生安装器直连安装启用通过，详见发布记录。
5. 当前 manifest.isDesktopOnly:false 的布尔值不能区分 iPad 与 Android；核对实际平台展示，明确 Android 下一版、iPhone 未验证。不能把平台标记当作验证结果。
6. 资料和候选准备成可审阅状态后，本轮已获授权且 GitHub Release 发布成功；按发布记录完成门户及客户端同步回读。MOB-A10 素材扩充仍由用户决定。

## 12. 工具与测试技巧

- 手机侧测试安装（未发布时）：把 `main.js`/`manifest.json`/`styles.css` 放进手机端 vault 的 `.obsidian/plugins/knowledge-graph-smoke/`（Android 可用文件管理器/`adb push`；iOS 用 Obsidian Sync 或 Working Copy → 同步到 vault 内该目录），重启 Obsidian → 设置里启用。
- Android CDP：`adb devices` → Chrome `chrome://inspect` → inspect WebView（若 Obsidian 未开 debuggable，退回 `adb logcat` 过滤 `Capacitor`/`Chromium` 关键字 + 应用内 `console` 打印到状态栏的临时调试开关，记得发布前移除）。
- 触摸事件模拟（桌面辅助，不替代真机）：Chrome DevTools 的 device mode 只能验证布局与 tap，不验证性能与手势系统。
- 现有原生脚本与库：`.local/native/cdp_lib.py`、`.local/native/ui_launch.py`、`.local/a13/a13lib.py`（捕获/录屏思路可复用到手机录屏）。
- 性能采样：Android `chrome://inspect` 的 Performance 面板；内存用 `performance.memory`（Chrome）或 Android Studio Profiler（若可用）。

## 13. 交接摘要（给下一位）

- 起点：0.0.14 已发布（tag/Release/门户完成），代码 HEAD 以 `git log` 为准；`npm test` 应为 11 脚本全过。
- 先读 AGENTS.md、TODO.md 顶部、docs/HANDOFF_0.0.15_README_RELEASE.md、docs/README_PLAN_0.0.15.md，再看本文与 DEVELOPMENT.md。
- README 已验收，候选已核验；从 RELEASE_PREP_0.0.15.md 的待授权操作续接，不从历史起步计划重新开工。
- 纪律：每轮按任务 ID 更新 TODO（真实测试、证据、剩余边界）；未做真机测试不得写"已验证"；不替用户宣布体验验收通过。
