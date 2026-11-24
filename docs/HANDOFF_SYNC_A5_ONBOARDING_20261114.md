# 同步下一轮交接：首次启用与已有布局导入

更新：2026-11-14，Asia/Shanghai。此文件是接手导航，`TODO.md` 仍是当前执行清单。用户本轮请求下一步建议和交接方案；本轮只整理交接，没有启动下述实现或新真机测试。

## 建议的下一项任务

在独立候选中接上已有 A3 首次加入/迁移核心，验证“已有手动布局如何首次启用同步”。先覆盖当前 schema3 布局；schema1/2 的已有核心转换和恢复证据保留，是否纳入这一批原生流程应明确列范围，不能混称已经真机通过。不要先扩展设置同步、升版本或发布。

推荐两组小样本，分别使用新逻辑库、新测试目录与独立坚果云远端，不改上一轮 Resolve 现场：

1. **本机有布局，另一端为空。** 保留原本机数据备份；用户预览并确认导入后才发布一笔稳定的根操作。另一端加入现有共享历史，不发布空 reset 或额外导入。取消不改变已保存布局、不产生导入操作；再次启动/重复确认/重开后不重复导入。
2. **两端都已有不同布局。** 两边原数据均保留；明确展示“采用共享”与“导入本机”的效果。不得把仅看见的共享记录当成已应用前驱。若各自导入同组旧布局，复用现有 A5 冲突审阅与解决；若采用共享，不额外发布导入操作。取消、重开、重试后的选择与接受事实应可核对。

这两组是候选建议，不代表用户已验收首次启用体验。最终文案、分组和交付用例随实现核实，先使 PC 上的具体候选可审阅，再集中给用户 iPad 操作步骤。

## 接手先读

1. 根 `AGENTS.md`、`TODO.md` 的 SYNC 部分、`README.md`。
2. `docs/SYNC_0.0.16_RESULT.md` 中 A4 尝试文件与布局候选、A5 两轮真实回执、A6 同路径竞争/容量结果；不用重读整段聊天。
3. `docs/SYNC_A3_JOIN_PROTOTYPE.md`，再按需看 `SYNC_A3_LOCAL_WORK.md`、`SYNC_A3_PRIVATE_CONFIG.md`、`SYNC_A3_HOST_PROTOTYPE.md`。
4. `docs/SYNC_A4_TRANSPORT_REVIEW.md`、`docs/SYNC_PROTOCOL_V2.md`，区分旧 v2 目录与独立 attempts-v1 候选。
5. 源码入口见下一节。`DEVELOPMENT.md`、旧 `HANDOFF_NEXT.md` 的阶段摘要部分停在更早日期，测试脚本数等以当前代码和 TODO 为准。

## 已有实现及容易走错的接入点

- `src/sync/persistence-prototype.mjs`：`join({localData,choice})`、`getJoinBackup()`、`getJoinProof()`、持久导入意图/恢复、只采用共享、版本校验、导入不重复。复用，不另写一套导入协议。既有 `scripts/sync_join_check.mjs` 包含 schema1/2 转换和真实磁盘/子进程退出用例；旧证据不能冒充新增原生覆盖。
- **当前 `src/sync/obsidian-receive-entry.js` 在 `openReceiveHost()` 中，对未初始化会话直接调用 `session.initialize({source:'explicit-empty',localBaseline:empty})`。它是独立空库候选的起点，不是旧布局首次启用流程。新候选不能先执行这条空初始化，再补一个导入按钮。** 需在接受事实建立前处理本机源、备份、选择及加入，核实图谱就绪、投影/协调器启动顺序。
- `src/sync/private-config-prototype.mjs`、`settings-coordinator-prototype.mjs`、`local-work-prototype.mjs`：复用已有数据备份、配置投影和恢复草稿语义，保留语言/UI/未知字段，不用旧备份覆盖当前非布局设置。
- `src/sync/obsidian-host-prototype.mjs`：复用 `openIsolatedSyncTestDevice` 的按套件隔离身份。旧 F2 根因是新套件误读旧连接，已经修复；匹配套件的旧身份/进度锚不能被重建掉。测试专用隔离不是正式身份迁移方案。
- `src/sync/attempt-history-prototype.mjs`、`scripts/sync-a4-attempt-candidate.mjs`：已有完整目录扫描、摘要/身份检查、同 ID 隔离、新路径重试；首次加入也必须核实它与 `join` 的接合，不能退回单文件读写。未知、损坏、缺前驱/冲突等按已有契约保留并暂停。
- `src/sync/conflict-resolution-prototype.mjs`、`obsidian-conflict-review.mjs`：A5 明确择一、取消、过期凭据、持久决定与新后继操作已实现，默认关闭，仅 Resolve 标记启用。若新导入候选复用，需明确它自己的启用边界与标记校验；不要让所有场景默认获得发布/解决能力。
- `scripts/build_sync_a3_probe.mjs`、`scripts/prepare_sync_a4_layout_candidate.mjs`：复用构建、来源摘要和合成测试包方式；当前生成器仅接受 Different/Same/Resolve，新增场景需明确支持，不能只改库名绕过入口校验。默认插件使用自己的原布局驱动，独立候选与正式宿主分开。
- `src/i18n.receive.js`：已有候选中英文提示。新流程保持本机保存、写入共享目录、对端接收的区别；不要宣称无法证实的云端成功。

## 最近已经完成的验收

- 顺序 PC↔iPad 布局实传、不同组离线合并、同组并发暂停/重开、独立尝试文件的新路径重试/后继等待/同 ID 两正文隔离已有对应范围的真机证据。
- Resolve 第一轮：PC 选择本机 A.Second 向左，iPad 接收；取消重开与最终双端重开通过，用户确认预览/提示清楚。
- Resolve 第二轮：在上述三笔历史上，B.Fourth PC 左/iPad 右；iPad 取消重开保持五份文件、原四笔接受事实，随后确认本机向右。新决定覆盖两新分支，PC 接收，最终各接受六笔、两组，双端重开稳定；A.Second 和原五份文件均保留。用户明确反馈左右可辨、点选/取消顺利、确认提示清楚；记录为本轮 iPad 审阅体验验收通过。
- 第一轮决定 ID `26eb6ca16dca3264bd5a7d8fb8f63960`；真实第二轮 PC 分支 `f96c69f5f35deeebebda305de64448fa`，iPad 分支 `b1eb31e22f1c8a3245bb16c02dfb8500`，决定 `ab2ea129169db1b7ba9558657a67d111`。不要用 Windows 预检随机 ID 冒充这些真机操作。
- **第二轮两端私有回执摘要不同是已核实的排列差异。** 确认方按扫描输入排列，接收方按因果顺序排列。验收须逐条对齐 ID/正文/前驱和完整快照，各自重算摘要，并核对各端重开精确稳定；不能直接要求私有摘要跨端相等，也不能忽略正文差异。
- 容量已有实传 1023 文件/约 32 MiB 与触顶拒绝/移出探针后恢复证据，范围是共享扫描和合成本机标记，不是 1024 条不同操作或图谱集成容量。不要重做千文件来代替本轮首次启用测试。

## 本机证据和现场

仓库工作目录为 `D:/what_i_am_doing/Project/knowledge-graph-obsidian-plugin`。

最新 Resolve 交付根：`.local/sync-016/a4/native/a6-resolve-V1UR2J/`。

- `preparation.json`：套件、模板路径和原远端；main.js SHA-256 为 `37d5ac0bb4c90e2d081768bbb70d9af3df1622454ed07ab9686bf3028bd2172c`。
- `device-evidence/verification.json`：第一轮八报告、两图、三份历史快照；**这是历史三笔状态，不能用旧 verifier 覆写现在六笔现场。**
- `ipad-led-device-evidence/verification.json`：最新第二轮八报告、四图片附件（实际两张）、六份共享文件快照；原件均已归档。
- `verify-ipad-device-evidence.mjs`：第二轮只读核对脚本，读取用户 PC 与原上传报告，再将证据写入上述忽略目录。将来现场变化后先看脚本预期，不盲目重跑。
- `pc-ipad-led-KFx7DT/verification.json` 与 `.local/sync-016/a4/check-ipad-led-resolution-native.mjs`：Windows 双实例预检，种子为真机旧三笔历史，但私有日志新建；不是 iPad 或坚果云实传。
- 用户现有 PC 库 `D:/R5/Knowledge Map A6 Resolve PC`，最终六份操作；仅保留/只读，不作为下一轮新导入的写入目标。iPad 现场由用户操作，不能靠本机附件路径宣称直接读了 iPad 文件系统。

`.local/` 和大量同步源码/文档不在既有提交中；同一台机器的同一工作区交接最稳妥。**只 clone 远端或切回 HEAD 不会获得当前工作。** 当前分支 `codex/mobile-support`、HEAD `239ddf4` 是本轮只读查看结果，接手时再核实。大量已修改/未跟踪文件属于既有工作，不清理、不 reset、不 checkout 覆盖。

交接核对清单写入 `.local/sync-016/handoff-20261114/manifest.json` 和 `working-tree-status.txt`，只记录关键文件哈希/证据路径及当时 Git 状态；它们不是完整备份，也不替代用户工作区。此轮没有 commit/push、开新会话或移交到其他机器。

## 下一位的执行顺序及完成条件

1. 确认上述事实仍与当前 TODO/文件相符，盘点已有 join 核心与 attempts-v1/原生宿主的差距；保留工作区和两轮证据。
2. 先用合成数据完成最小独立实现及有意义的核心/磁盘验证，重点是取消无导入写入、源备份、稳定 ID、采用共享不发布、重复加入不重复、输入变化/未知格式保留并暂停。不把根导入记录错误地附到未接受的共享前驱。
3. 再用 Windows 独立 Obsidian 预检真实窗口、原布局数据投影、双方文件和冷重开。若使用图谱 store 注入编辑或本地复制交接，如实写明，不称真实拖动/Nutstore/iPad。测试实例只用独立 profile；隐藏窗口的 Modal 焦点问题可参考现有驱动中的 focus 处理，不修改产品逻辑掩盖测试焦点问题。
4. 交付两组新的 PC/iPad 测试包及集中步骤，明确自动同步关闭、实际断网、发布/采用操作、同步顺序和报告阶段。包含隐藏 `.obsidian`，用白名单打包并核对 SHA-256/ZIP 内容；不带私有笔记、凭据、报告或快照。新套件/远端不复用 Resolve 现场。
5. 用户操作后对照真机报告和 PC 实盘正文/前驱/快照，再更新 TODO。产品体验待用户反馈，未执行测试不写通过。完成到“可交付用户的独立测试包/步骤”即可先交回，不自动进入发布。

当前默认 `npm test` 是构建加 23 个合成脚本，独立磁盘检查不全在默认集合里。按改动选跑并记录本轮实际结果：

```powershell
npm test
npm run test:sync-join
npm run test:sync-disk
node scripts/sync_a4_layout_candidate_check.mjs
node scripts/sync_conflict_resolution_check.mjs
```

这些只是现有入口，不是本交接轮新跑通过的记录。修改配置/生命周期/本地恢复时再加对应专项；硬链接、子进程或原生 App 受沙箱限制时按工具实际权限处理，不降级成覆盖写后宣称通过。Node >=22，无需为纯 JS 构建额外安装 npm 依赖。

## 保持的门禁和授权边界

- 正式 v2 发布门禁关闭，A3/A4/A5/A6 均不能整体结项，A7/P3/A8 仍待办。支持范围与传输契约单独评审。
- 用户只暂时接受独立候选中“外部写者抢占精确物理路径仍可能覆盖”。真实同路径探针最终只剩 iPad 正文、未见操作目录副本，扫描摘要不符阻塞；不能写成原子不覆盖或共享双正文均保留通过。
- Nutstore 限流曾在 55.71% 停留约二十分钟，后续实传完成。限流策略仍待改善，不因小样本通过而结项。
- 当前证据主要 Windows + iPad；其他服务、iPhone、Android、最低系统/集成容量与多域原生冲突等没有相同覆盖。不要扩大声明。
- 不读取 `Utilities/API Key.md`，不写日常笔记，不操作日常库升级，不用旧发布授权推定本轮 commit/push/tag/Release 授权。
- 保留现有渲染/交互契约；首次启用 UI 的新行为和回归范围需明确。清单中的建议不是已执行，也不是用户产品验收。

## 可复制给下一位的起始指令

> 请接手 Knowledge Map 的下一项：SYNC-A3/A5「首次启用同步与已有布局导入」独立候选。先读 AGENTS.md、TODO.md、README.md 和 docs/HANDOFF_SYNC_A5_ONBOARDING_20261114.md；以 TODO 为进度真相，保留全部工作区改动与旧证据。复用已有 join/迁移、attempts-v1 和冲突审阅核心，先审计当前显式空初始化与真实首次加入的差距，再完成合成验证、PC 原生预检、独立 PC/iPad 包和集中步骤。覆盖本机有布局/另一端为空，以及两端各有不同旧布局；取消不导入、重开不重复，保留原备份。使用新套件和新远端，先把 PC 能做的做完再交我 iPad 步骤。此前 PC/iPad 分别主导冲突解决的两轮已核验，无需重做。正式 v2 门禁继续关闭，不升级日常库、不发布；正式传输契约另行评审。
