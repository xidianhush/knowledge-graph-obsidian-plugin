# SYNC-UX 同步易用性改造 — 本轮实施与验证结果（2026-11-24）

> 本文只记录**本轮实际运行**的结果。未执行的测试明确标注，不继承历史通过数字。候选为**同步体验候选**，不是正式发布；未 commit/push、未移动正式 tag、未发布 Release、未升级日常库。
>
> 配套：[实施计划存档](SYNC_UX_EASY_SETUP_PLAN.md)、[设计与受影响协议条款](SYNC_UX_EASY_SETUP_DESIGN.md)、[用户验收指南](SYNC_UX_EASY_SETUP_GUIDE.md)、[协议 v2（含 SYNC-UX 修订）](SYNC_PROTOCOL_V2.md)。

## 1. 目标与达成

首次使用只需在每台设备点一次“开启布局同步”：自动准备默认布局、写入可传输初始化资料、发现并连接同一共享图谱、保存和接收修改。移除“先手动移动一个圆 / 新建查找核对 ID / 手动确认空布局”的旧准备要求。保留操作历史、私有账本、布局校验与恢复机制及全部现有门禁。技术实现与合成/磁盘/浏览器验证已完成；**Windows↔iPadOS+坚果云核心流程已于 2026-11-24 用户真机验收通过（见 §6），可选分支未真机执行（自动化已覆盖）；正式版本号与发布待用户授权**。

## 2. 修改摘要

新增源码：
- `src/sync/default-layout-bootstrap.mjs` — 固定默认 ID（SHA-256("KM-SYNC-DEFAULT-LAYOUT-1") 前 32 位 = `71e90242bea19488f2a16c60f78fcabc`）、规范正文、`bootstrap-v1/<ID>/<sha256>.<attempt-id>.json` 不可变初始化记录、写后读回、同正文去重、残片/损坏保护。
- `src/sync/easy-sync-setup.mjs` — 设备绑定密封授权（localStorage `<pluginId>:easy-sync-v1`，不进 data.json）+ phase 常量。
- `src/sync/obsidian-easy-settings.mjs` — 精简设置面板（开关 + 状态一句 + 至多一个主要操作 + 折叠“高级与恢复”），`describeEasySync` 状态映射，复用现有审阅。

修改源码：
- `src/sync/connection-catalog.mjs` — bootstrap-v1 根扫描，`bootstrapOnly:true/false` 候选，计入预算与 fingerprint。
- `src/sync/obsidian-unified-host.mjs` — `startEasySync()/resumeEasySync()/stopEasySync()/easySyncState()`；previewJoin/confirmJoin/confirmSelection 抽为内部函数供编排复用；编排在单个已入队任务内调内部函数与 registry/lifecycle 自有队列（防死锁）。
- `src/sync/obsidian-unified-entry.js` — 设置页改挂 easy 面板；未加入前共享目录文件事件合并唤醒（250ms 去抖 + single-flight，仅授权后）。
- `src/i18n.sync.js` — `sync.easy.*` 中英文键。
- `scripts/build_sync_a3_probe.mjs` — 统一候选 bundle 显式纳入 easy-settings。

新增测试/交付脚本：`scripts/sync_bootstrap_check.mjs`、`scripts/sync_bootstrap_disk_check.mjs`、`scripts/sync_easy_setup_check.mjs`、`scripts/sync_easy_setup_disk_check.mjs`、`scripts/sync-easy-settings-sketch-fixture.mjs`、`scripts/sync_easy_settings_sketch_check.py`、`scripts/prepare_sync_ux_candidate.mjs`、`scripts/sync_ux_delivery_check.mjs`、`scripts/package_sync_ux.py`；扩展 `scripts/sync_unified_candidate_check.mjs`（9→11 契约）。`scripts/test.mjs` 注册 bootstrap/easy 合成检查；`package.json` 增 `test:sync-bootstrap-disk`/`test:sync-easy-disk`/`test:sync-easy-sketch`/`test:sync-ux-delivery`/`prepare:sync-ux`。

文档：修订 `docs/SYNC_PROTOCOL_V2.md`（§1/§4/§6，标注 SYNC-UX-A1/A2 修订）；更新 `README.md`/`docs/INSTALL.md`/`docs/SYNC_GUIDE.md`（移除旧手动准备要求、Android 0.0.17→0.0.19）；`docs/MOBILE_PLAN.md` 加 2026-11-24 排期更新；新增本结果与验收指南。历史 Release Notes/HANDOFF/G* 指南作为当时记录不改写。

## 3. 候选包与摘要（本轮实际构建）

- 候选名称：**Knowledge Map Sync UX Candidate**；插件 ID `knowledge-map-sync-ux`；manifest 版本 **0.0.16**（保留当前版本，不占用正式版本号）。
- 构建标识：unified build `version:6`；footerSha256 `77d33081800049b6fee147f5b2ea5dda89c9c2cae8a08407cca05772d2b7f7b7`；graphHostSha256 `a6e0aa3287b96f9f25e1850ba5de852a222131a38d4620862de863e08cd65a03`；bundle 含 easy-settings/easy-sync-setup/default-layout-bootstrap/unified-host（逐模块 SHA 见 preparation.json）。

运行文件（PC/iPad 一致）：

| 文件 | 字节 | SHA-256 |
| --- | --- | --- |
| main.js | 824187 | `e2d7487b0825933c2b5e3b46414629a67c2e173921f678dd3480ddcd0e66e4fc` |
| styles.css | 3055 | `294298902f12f24aedfa43ab5249d0a60974506747e9b5cec178ae3b60790a5f` |
| manifest.json | 269 | `2e96449840b8b9680b3472f302cef3f98ca80277464c65b999cb68705a4da1ba` |

独立合成测试库（pristine，两端均无手动布局）：`.local/sync-ux/a5/pristine-mLTtaW/`（Knowledge Map Sync UX PC / iPad）；远端 `/KM-SYNC-UX-b85ef010`。

交付 ZIP（白名单 10 文件 + OPEN-FIRST，CRC/字节/SHA 核验通过）：

| 包 | 字节 | SHA-256 |
| --- | --- | --- |
| Knowledge-Map-SyncUX-20261124-PC.zip | 249232 | `fc41d7afacf44ad5c5d8b4ce7ca7a6a1ee387fb70459659b88f5af3d36078a6f` |
| Knowledge-Map-SyncUX-20261124-iPad.zip | 249272 | `4213ab0095e91031e373719cb4d636ff38ebccc3116fef53ca69000554034f63` |

交付目录：`.local/sync-ux/a5/delivery-j9vtkeu7/`（含 package-verification.json、OPEN-FIRST.md）。复现：`npm run test:sync-ux-delivery`（构建+pristine+校验），`python scripts/package_sync_ux.py <pristine-dir>`（打包）。

## 4. 本轮测试证据（区分验证层级）

| 套件 | 层级 | 本轮结果 |
| --- | --- | --- |
| 全量 `npm test`（构建 + 44 合成脚本，含 bootstrap 12 项 / easy 13 项 / 候选 11 契约） | 本地文件模拟 + vm | 退出 0（日志 `.local-a3b-test.log`） |
| `sync_bootstrap_check.mjs` 12 项 | 合成适配 | 全过 |
| `sync_bootstrap_disk_check.mjs` 5 案例 / 3 次进程退出 | 真实文件 + 进程退出 | 退出 0（`.local/sync-ux/a1-disk/disk-QwARdN`） |
| `sync_easy_setup_check.mjs` 13 项 | 合成适配 | 全过 |
| `sync_easy_setup_disk_check.mjs` 3 案例 | 真实文件 + 进程退出 | 退出 0（`.local/sync-ux/a2-disk/disk-uU79vA`） |
| `sync_unified_candidate_check.mjs` 11 契约 | vm 真实 entry + fake App | 退出 0 |
| A4 磁盘回归 11 套件（persistence/join/host/config/lifecycle/local-work/connections/bootstrap/easy/auto-publish/unified） | 真实文件 + 进程退出 | 全部退出 0 |
| `sync_easy_settings_sketch_check.py` 7 项 / 32 截图 | 自有无头 Chrome + IndexedDB | pass:true（`.local/sync-ux/a3-sketch/sketch-a55ji5em`） |
| `sync_settings_browser_check.py` 31 项（高级面板回归） | 自有无头 Chrome + IndexedDB | 退出 0（`.local/sync-016/unified/u4/browser-1nf8a4pr`） |
| `sync_ux_delivery_check.mjs` 4 项 + `package_sync_ux.py` 2 包 | 本地文件 + ZIP | pass:true / CRC 字节 SHA 通过 |
| Windows Obsidian 独立库原生测试（候选 PC 库，Obsidian 1.15.1） | Windows 原生 | **用户已执行核心流程**（2026-11-24，见 §6） |
| Windows ↔ iPadOS + 坚果云真实跨端测试 | 真实跨端传输 | **用户已执行核心流程**（2026-11-24，双向同步 + 重开保持，见 §6）；可选分支未真机执行 |

scope 说明：合成/磁盘为本地文件模拟（file-backed App + 注入锁；设备交换为本地 copyFile，非坚果云/iPad/真实传输）；浏览器为自有无头 Chrome 真实 DOM/按钮 + IndexedDB（注入 App/shared-file/Modal）。均不代表原生 Obsidian 或真实跨端送达。

覆盖场景（合成/磁盘）：全新双端无拖动；两端离线同时开启交换后同一默认图谱、重复初始化不冲突；首次真实编辑 A→B/B→A 重开保留；本机独有/共享独有/相同/不同/旧布局校验问题分支；多候选选择；仅 v2 只读；旧连接升级不换 ID/不重加入/不改启用；关闭再开启草稿保留不自动发布；授权/选择/加入各阶段退出恢复幂等；损坏 bootstrap 暂停不重新初始化；容量/残片/写后读回保护。

## 5. 已知限制

- 原生 Obsidian 渲染与真实跨端传输未由开发侧执行；候选加载/接线/合并唤醒已在 vm 真实 entry 与自有浏览器验证，原生体验以用户验收为准。
- 旧客户端不支持空图谱初始化（bootstrap-only 发现）；有真实布局操作后仍可发现相同历史。
- 验证范围限 Windows ↔ iPadOS + 坚果云；不宣称任意同步工具均已验证；不控制坚果云队列、不加云账号设置。
- 验收所用候选字节为 manifest 0.0.16 标签（main.js SHA `e2d7487b…`，见 §3）；核心验收通过后，用户于 2026-11-24 授权将正式版本号对齐为 **0.0.17**（暂不发布）。源码 `manifest.json`/`package.json` 已置 0.0.17，README/INSTALL/SYNC_GUIDE 标注“定版 0.0.17，尚未发布”。0.0.17 正式发布重建（正式名称/ID + 完整验证 + commit/push/tag/Release）待用户另行逐项授权；功能代码与已验收候选一致，仅版本标签不同。

## 6. 用户验收结果（2026-11-24，核心流程通过）

用户回交验收报告 ZIP（报告 md + 8 张 HEIC 截图，已转 PNG 核对，存 `.local/sync-ux/acceptance-report/`），在两端全新独立测试库（Knowledge Map Sync UX PC / iPad，候选 `knowledge-map-sync-ux`，Windows Obsidian 1.15.1 + iPadOS）经坚果云实测，明确未做可选部分。

实测序列与状态文案逐项吻合设计：

| 步骤 | 设备 | 面板状态 | 详情原因码 |
| --- | --- | --- | --- |
| 先构图再开启布局同步 | iPad | 已准备共享资料。请让同步工具传输 Knowledge Map Sync 文件夹。 | `awaiting-transfer` |
| 未开图谱先开启布局同步 | PC | 正在准备图谱…… | `graph-unavailable` |
| 开图谱并移动元素 | PC | 正在等待对应笔记或较早的布局记录。（中间态，随后完成发布） | `waiting` |
| 坚果云传输后布局与 PC 一致 | iPad | 本机布局已保存，当前没有待处理修改。 | `clean` |
| 调整布局并发布 | iPad | 本机布局已保存，当前没有待处理修改。 | `clean` |
| 再传输后布局与 iPad 一致 | PC | 本机布局已保存，当前没有待处理修改。 | `clean` |

用户回报：①确实无需拖动/选 ID 即双向同步；②重开保持；③无错误原因文案。普通区始终单开关 + 状态一句 + 至多一个主要操作（检查共享布局）+ 折叠“高级与恢复”，技术原因码放详情；无“已连接另一台设备/两端已同步完成”虚假文案（截图右下角“同步完成”HUD 属独立 Nutstore Sync 插件，非本面板）。

**判定：计划验收重点（两台全新设备一次开启、无预拖动/选 ID、共享文件传到后双向使用、重开保持）达成，核心体验用户验收通过。** 可选真机分支（已有布局六分支/冲突/关闭再开启/高级恢复）本轮未在真机执行，已由 easy 合成 13 项 + 11 磁盘回归覆盖；不据此宣称这些分支真机通过。证据截图：F7A4A72F / A48442CF / A7916E20 / DEADB06A / 875525D7 / D8D5E689 / DFD80BCC / 41B110A3。

## 7. 用户验收步骤（指南）

见 [验收指南](SYNC_UX_EASY_SETUP_GUIDE.md)。重点：两台未装过插件的设备，安装启用后分别开启布局同步，无需预先拖动/选择新建/核对 ID，即可在共享文件传到后开始双向使用；需要处理已有布局时，界面能解释原因并保护双方工作。回交两端状态截图、当前共享 ID、双向同步与重开保持结果、任何错误原因文案。

## 8. 约束遵守

未升级日常库；**已 commit 于分支 `sync-ux-easy-setup`（2026-11-24 用户授权）但未 push**（push 由用户另行安排）；未移动正式 tag；未发布 Release；私有笔记/截图/配置未加入公开交付包（`.local/` 已 gitignore，验收截图/交付 ZIP/日志均未提交）；优先独立测试库。源码/文档修改均在独立 worktree `.agents/worktrees/sync-ux-easy-setup`（分支 sync-ux-easy-setup，base 1c25526），主工作区现场未动。