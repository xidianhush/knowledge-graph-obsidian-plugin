# 0.0.16 统一同步候选实施计划

2026-11-21当前：G6本轮功能及G7 PC/iPad R2回退/返回候选规定流程已完成核对，见[G7结果](SYNC_G7_RESULT.md)。10项盘点已完成，用户最新委托下一位承担必要修正/独立测试、统一候选/总体验收与最终发布，先读[专用交接](HANDOFF_SYNC_G8_RELEASE_20261121.md)和[G8清单](SYNC_G8_REMAINING_ISSUES.md)，以TODO的SYNC-G8-HANDOFF为入口。本轮只准备交接，没有实施修正或新跑产品测试；原iPad首轮/一般限流P1证据边界及最终体验/发布门禁仍在。下文各阶段状态按日期视为历史，不重复已闭环功能。

> 执行方式：在本地现有工作区按任务顺序实施，使用 executing-plans 和 test-driven-development；不因新 worktree 丢失未提交源码/证据，不 commit/push 或升级日常库。勾选状态与各阶段结果共同记录执行证据。

更新：2026-11-15（Asia/Shanghai）。

**目标**：在独立库中，以正常设置入口完成连接/加入、普通布局可靠本机保存后的自动发布、接收、冲突及关闭/恢复，不依赖 Onboard/Resolve 场景标记。

**依据**：[正式方案已确认 D1/D2/D3](SYNC_0.0.16_FORMAL_REVIEW.md) 与 [修订契约](SYNC_PROTOCOL_V2.md)。只进入统一候选；容量恢复、实际旧版回退及最终发布另有门禁。

**架构**：复用 durable session、attempt-history、private-config、settings-coordinator、connection-lifecycle 和既有图谱 store/receiver。新增正常连接目录、协调自动发布队列及候选入口；导入/解决协议不重写。首批 Windows/iPadOS+Nutstore；设置、视角和界面状态本地。

**技术栈**：现有 JS/ESM 自定义打包、Obsidian 公共 API、IndexedDB、Web Crypto/Web Locks；无新增服务依赖。普通产品包与独立候选分开，未验证前不改 0.0.15 版本或开放产品双向发布。

## 全局约束

- 普通编辑：本机持久保存成功后自动排队写共享目录；本机写入不是云端/对端完成。
- 首次加入、冲突决定、关闭期间草稿恢复保持明确确认；关闭不删除共享历史。
- 每笔已落盘 pending 保持原 ID/正文；后续新草稿独立保存，不能覆盖旧 outbox。
- 无测试套件标记作为正常连接/发布授权；使用真实设备身份，复制配置/切错传输不得冒认接受事实。
- 数据未知/损坏/缺失/超限保留并暂停；同 ID 损坏不能用普通同组冲突选择清除。
- 使用新独立库/远端/profile，不写旧 Resolve/Onboard 现场、私有笔记或凭据，不读 `Utilities/API Key.md`。

## 重点审阅场景

确认期间源/图谱/目录变化；连续两次本机保存遇到旧 pending；自动发布与接收互斥；关闭与 in-flight 写入交错；外部 data.json 与设置/UI 保存交错。每个场景必须由所属任务覆盖，不以组件 mock 调用次数冒充状态/文件正确。

## U1：正常连接发现与正式本机身份

**文件**：已新增 `src/sync/connection-catalog.mjs`、`src/sync/connection-registry.mjs`、`scripts/sync_connection_catalog_check.mjs` 和 `scripts/sync_connection_catalog_disk_check.mjs`。复用 `obsidian-host-prototype.mjs`，仅增只读 anchoredVaults()，不改写身份格式或旧私有账本；完整生命周期/设置页仍留 U3/U4。

**接口目标**：`createSyncConnectionCatalog({adapter}).scan()` 返回有界、完整、按传输分组的逻辑库候选或明确阻塞；新建逻辑 ID 和显式选择由宿主完成，目录发现不建立接受凭据。候选正式本机连接记录绑定 vault/transport，并与 device.state().connection 核对。

- [x] 先写失败用例：新设备不从 data.json 接受连接；多个命名空间不能自动选最新；v2 与 attempts 分列，旧 v2 不发布；错误身份/传输、未知目录和超出发现预算保留并阻塞，不能截断后冒充完整清单。
- [x] 实现最小目录与元数据适配，复用 App 本地身份和锁，持久选择意图与代次恢复，不采用套件隔离捷径；U3 继续协调完整生命周期。绑定名额按 bindings/anchors 并集，达到 32 个上限停止，不清理旧锚。
- [x] 验证空新库没有清空操作、空目录不作为可加入历史，已有有效首条操作才可发现。旧绑定/进度锚保留，传输不匹配拒绝；旧连接缺可信绑定时保持阻塞，迁移 UI 留 U3/U4，不冒称已能直接沿用所有旧会话。

2026-11-14：U1 核心与磁盘技术验证完成，25 项合成 + 6 次真实进程退出；默认构建 + 24 脚本及宿主/生命周期磁盘复跑通过。详见 [U1 结果](SYNC_UNIFIED_U1_RESULT.md)。App API/Web Locks 使用契约替身，未接正常 UI 或新增真机验证。

**完成条件**：纯目录/设备检查和有意义的磁盘中断恢复通过，得到 U3 可使用的受控选择结果；没有正常 UI/真机通过声明。

## U2：可靠保存后的自动发布协调

**文件**：拟新增 `src/sync/auto-publish-queue.mjs`、`scripts/sync_auto_publish_check.mjs`；复用 persistence、settings-coordinator 和 layout receiver，按需补同一宿主协调门禁。

**接口目标**：`createAutoPublishQueue({readLocal,publish,canRun,onResult})` 提供 `notifySaved()`、`resume()`、`settled()`、`close()`。`publish` 复用原 stage/publish；`canRun` 结合图谱/store/连接代次。接口可在实现时按实际协调结果收窄，不能让队列绕过会话/编辑门禁。

- [x] 失败用例先行：本机保存失败不发布；保存后自动写一笔；重复通知不重复；拖动/隐藏/图谱过期时保留草稿等待。
- [x] 覆盖旧 pending 未完成时的新编辑：旧 ID/正文不变，新草稿独立保留；完成旧接受后重新核对最新草稿和因果基线，不把旧快照套到新视图、不丢新编辑。
- [x] 覆盖冲突/未知输入/预算拒绝时有界暂停，不做立即无限重试；已登记路径中断仍用原 ID、换新路径；服务上传不由本队列调度。
- [x] 覆盖同时接收、关闭和发布：只在合法保留/排空边界继续；关闭后无新的共享 I/O，重开不自动恢复关闭期间的编辑。共享写已发生时不能假装取消。

**完成条件**：真实文件/子进程场景覆盖保存失败、共享写后未接受和并发编辑，记录原件、草稿、稳定 ID 与接受集合；正常队列运行无额外重复根/操作。

2026-11-14：U2 核心与文件恢复技术验证完成，22 项合成 + 14 次真实进程退出；默认构建 + 25 脚本及受影响磁盘专项通过。关闭的停止点为实际共享正文写入前，已开始写入允许排空，await close 后无新队列 I/O；不声明撤回已写字节。完整结果见 [U2 结果](SYNC_UNIFIED_U2_RESULT.md)。宿主/容量/配置/lifecycle 的实际统一接线与原生体验仍属 U3–U5。

## U3：统一宿主与本地配置保存

**文件**：已新增 `src/sync/obsidian-unified-entry.js`、`src/sync/obsidian-unified-host.mjs`；`scripts/build_sync_a3_probe.mjs` 增加独立统一候选构建。复用现有图谱宿主，默认产品入口不获得新发布能力。

**消费**：U1 选择/身份记录与 U2 自动队列；既有 `session.previewJoin/join`、`getJoinBackup/Proof`、private-config 文档适配、coordinator 草稿及 lifecycle 启停。

- [x] 先测正常入口未启用/未加入时不做 explicit-empty、不清空旧布局、不启接收或发布；初次取消仍可保持原本地工作。
- [x] 加入前读取可信当前源；成功建立接受事实后才启配置投影和接收；语言/UI/未知字段用当前有效文档，不用旧备份回写。
- [x] 把普通布局保存接 U2；设置/UI 保存和外部配置回调接统一版本/epoch 协调，替代测试候选中固定 external epoch 的简化做法。不得用排除配置的指南代替外部配置防护。
- [x] 验证关闭/改选/重开、身份缺失、private-paused、图谱未打开/已隐藏/多个视图、未加入时关闭；不靠重新创建身份或删除日志“修复”。私有触顶不能显示新编辑已保存。

**完成条件**：同一个宿主覆盖上述持久状态，关闭后的本地工作与再启用恢复保持已确认语义，不依赖脚本注入假凭据。

2026-11-14：U3 宿主/独立入口技术完成，宿主 15 项、入口 9 组、签名文件 8 次真实退出及默认构建 + 27 脚本通过。真实全量候选编译、入口 VM 契约与 Node 文件恢复不代替 U5 原生/服务/用户验收。接口、审阅修复与初次配置创建的外部竞争限制见 [U3 结果](SYNC_UNIFIED_U3_RESULT.md)。

## U4：正常设置页与状态/冲突入口

**文件**：已新增 `src/sync/obsidian-sync-settings.mjs`、`src/i18n.sync.js`；统一候选入口装饰原设置页 display，默认行为保持。复用 `obsidian-onboarding-review.mjs`、`obsidian-conflict-review.mjs`。

- [x] 正常设置页提供启用、新建/选择逻辑库、当前连接/状态、检查、冲突审阅、关闭/恢复入口；不向用户展示 suite 或 A4/A5 测试命令。
- [x] 中英文清楚区分本机已保存、等待发布、已写共享目录、等待前驱/笔记、冲突、损坏、容量、未保存失败；没有可靠证据不显示云端或全设备已完成。
- [x] 首次导入与冲突继续复用已验收预览/取消/确认；关闭期间草稿先审阅再恢复，取消不自动发布。
- [x] 检查桌面和 1024×768 排版/可操作性，测试真实按钮与对应持久结果；既有渲染和交互契约回归。

**完成条件**：用户能从普通入口完成流程，临时测试命令不再是唯一入口；此项完成不等于移动端体验已经由 agent 验收。

2026-11-14：U4 技术完成。状态 17 项、宿主 5 项、Chrome 真 DOM/IndexedDB 10 组、默认构建 +29 脚本、签名宿主磁盘 8 次退出通过。普通设置挂接与双语预览已有实现，桌面/1024×768 8 张截图；真实 Obsidian 入口、iPad/服务和用户体验继续留 U5。审阅发现的未完成连接选择无恢复入口、晚返回预览弹窗均已失败复现并修正。详见 [U4 结果](SYNC_UNIFIED_U4_RESULT.md)。

## U5：集成候选、PC 原生预检与用户验证交付

**文件**：已新增统一候选准备/白名单打包/原生驱动脚本、`docs/SYNC_UNIFIED_CANDIDATE_GUIDE.md`；结果与证据在 `.local/sync-016/unified/u5/`，不覆盖已归档测试。

- [x] 构建独立库中的正常 Knowledge Map 候选；版本保持现状，构建摘要明确，身份/连接由运行时真实入口建立，不预种接受状态或场景 marker。
- [x] 按改动跑默认测试、受影响 join/持久化/配置/生命周期/自动队列专项；修复后再做两套 Windows 独立 profile 的普通入口、自动发布、接收、关闭/恢复及冷开预检。
- [x] 说明哪些操作为真实 UI、哪些仅本地复制交接；新 PC/iPad 包白名单、隐藏配置、ZIP 字节/SHA-256 核对后，集中交付步骤，不将本机预检写成 Nutstore/iPad 真机。
- [x] 独立代码审阅后处理关键问题，更新 TODO。
- [x] 用户操作后核对真机原件与实盘，并保留体验判断给用户。2026-11-15：初轮FB1修复后，5报告/4截图与PC实盘16项核验通过；用户报告规定续验步骤顺利。见 [复验结果](SYNC_UNIFIED_U5_FB1_ACCEPTANCE.md)，不扩展为未执行门禁通过。

2026-11-15：技术预检及交付完成，待用户验收。默认构建+30脚本、相关磁盘专项、设置浏览器10组、实际 Windows Obsidian1.15.1 两独立 profile 原生9组通过；修复编辑锁结束漏唤醒及早释放竞态。包来自未运行 pristine，最终代码哈希与原生一致，白名单/ZIP字节/CRC/SHA核验通过。新远端 /KM-U5-5506851b。详见 [U5结果](SYNC_UNIFIED_U5_RESULT.md)。

## 本批之后仍需完成

G4 reset/undo/结构变化及多域集成技术验证完成，PC/iPad+坚果云及产品体验待验收，见 [G4结果](SYNC_G4_RESULT.md)。G5 故障与隔离恢复，G6 有限容量导出/轮换及旧离线设备返回，G7 实际 0.0.15 回退与发布候选，G8 总体验/发布授权仍待办。它们不是通过 U1–U5 自动完成，也不因 D1/D2/D3 已确认而省略。

## 执行状态

2026-11-15 当前：G4技术验证及独立包完成，默认构建+31脚本/G4集成10组、Windows原生11组及相关磁盘回归通过；最终各20操作。新空远端 /KM-G4-e9d8fed3，用户按新包OPEN-FIRST做PC/iPad联合验收；详见 [G4结果](SYNC_G4_RESULT.md)。FB1原现场已验收不覆盖，G5–G8保留。以下段落按发生时状态保留。

2026-11-15 最新：FB1 明确竞争恢复路径已修复并完成技术验证，[修复结果](SYNC_UNIFIED_U5_FB1_FIX_RESULT.md)与[续验指南](SYNC_UNIFIED_U5_FB1_RETEST.md)已交付；用户沿用原测试库/远端，仅更新三运行文件，再做iPad/Nutstore验收。下段为修复前状态；容量/实际回退/发布授权仍待办。

U1–U5 初版实现、隔离回归、Windows 原生预检与独立包为历史技术完成。用户首轮测试受阻；2026-11-15 U5-FB1 已在文件专项和原候选 Windows 两新 profile 复现，当前先修复本地待审草稿与远端新布局并存的恢复路径，见 [复现结果](SYNC_UNIFIED_U5_FB1_REPRO.md)。U5 Nutstore/iPad 与统一体验未验收，用户先保留现场暂停原流程。自动队列/设置仅挂接独立候选，发布及容量/回退门禁保持。
