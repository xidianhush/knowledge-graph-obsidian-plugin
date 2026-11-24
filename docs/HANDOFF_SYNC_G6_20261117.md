# G5验收后交接：G6有限容量可恢复

日期：2026-11-17（Asia/Shanghai）。本轮用户要求整理下一个Coding agent的交接方案，**G6尚未实施**。TODO.md为双方共同维护的当前执行清单；本文件是入口及执行建议，不能覆盖后续用户指示。

## 1. 在哪里继续

继续使用本机工作区 `D:\what_i_am_doing\Project\knowledge-graph-obsidian-plugin`。2026-11-17实查：分支 `codex/mobile-support`、HEAD `239ddf4`，有大量未提交及未跟踪同步源码/文档和已验收素材；`.local/`、`dist/`被忽略。**仅clone远端、只带git diff或从HEAD另建worktree不能取得当前实现和证据。** 保留本工作区，先读git status，不reset/clean、丢弃修改或退回旧HEAD。确需隔离时先保全当前未提交/未跟踪实现，不能在缺少它们的新checkout上继续。

没有本次0.0.16的commit/push/tag/Release/社区门户发布授权；旧0.0.15授权不外推。版本仍0.0.15独立同步候选，插件ID `knowledge-map-sync-unified`；正式产品ID与独立候选分开。G7/G8及P3未放行。此次交接不开始G6实现、不改版本或用户库。

## 2. 最短阅读路径

1. `AGENTS.md`、`TODO.md`顶部当前执行与验收条目、`README.md`。
2. `docs/SYNC_G5_ACCEPTANCE.md`：刚完成的用户验收，勿重开已闭环测试。
3. `docs/SYNC_G5_RESULT.md`：最近源码变化、验证边界、冻结构建与故障驱动。
4. `docs/SYNC_0.0.16_FORMAL_REVIEW.md`：第6节容量与恢复出口，第9节G6/G7/G8；D1/D2/D3已确认。
5. `docs/SYNC_UNIFIED_CANDIDATE_PLAN.md`、`docs/SYNC_PROTOCOL_V2.md`对应章节；旧阶段导航只用于追溯。需要整体背景再读 `docs/SYNC_0.0.16_RESULT.md` 最新条目。

不要为了接手从最早HANDOFF和所有历史日志逐字重跑。正式评审文档“统一候选待实现”是11-14快照，当前以TODO及最新验收回执为准。

## 3. 已闭环的状态

- G4主流程及FB5标题正常新增/删除、FB2同profile跨库锁、UI1空sticky横条、UI2无待办误暂停均已用户验收。原G4接受历史25笔保持，不重测Fifth或重置原现场。
- G5六类故障技术验证已完成；用户新PC/iPad+坚果云完成未知文件拒绝/移走恢复、已接受原件缺失/同字节恢复、同ID隔离取消/确认、确认前重开仍隔离及确认后最终重开正常。
- 用户12份报告/4张截图经只读归档36组核验通过。两端序号均为基线5、未知5、缺失5、隔离6、恢复7、最终7；每端完整accepted凭据/身份/连接不变，原一笔操作正文/groups/structures保持。取消和确认前重开无单独JSON，依据用户明确回报，不虚构自动化证据。
- G5逻辑库 `f21152e4db13c16005e94b78f5d2518d`，操作 `50f9df8011a51dc7f5a278069e6d3875`。原件规范正文SHA `7b0ed17174c50edce809bca5461b51767d5946927e6558d4bbfbd6b1b8ed590e`。最终PC实盘ops仅此原字节原件。
- G5候选main SHA `97b9e0b6403afe0f897f02f0cc2f45af23a52bcd70fd482d5591c4d7cbcb35f2`，styles SHA `294298902f12f24aedfa43ab5249d0a60974506747e9b5cec178ae3b60790a5f`。报告完整build匹配；PC安装字节实查匹配，iPad依据报告/截图/用户确认，不冒称读其文件系统。
- 最新技术基线：默认构建+36脚本（含G5生产graph/host集成14组）；浏览器16组；相关磁盘24次进程退出；Windows Obsidian1.15.1原生9组（普通导入/最终种子包采用各完整一轮）；包字节回放5项。独立审阅原两Important关闭，无新增Critical/Important。均为历史已运行证据，不是接手当轮新通过。

## 4. 原件、私有证据和保护范围

- G5验收证据：`.local/sync-016/g5/acceptance-20261117/{verification.json,verify.mjs,reports/,images/}`。有原来源映射/摘要；不要加入公开交付。核验脚本读取原来源，聊天附件若日后被清理应优先查归档，不把源路径不存在当作功能回归。
- G5技术摘要：`.local/sync-016/g5/regression-summary.json`（交付时快照，可能仍标待验收）；最新用户状态看上面的验收文件。技术日志/失败驱动修正见G5_RESULT，不为“清洁”证据删除失败日志。
- 冻结包：`.local/sync-016/unified/u5/pristine-tODAHI`，交付 `.local/sync-016/unified/u5/g5-delivery-s86nl3wc`，远端 `/KM-G5-3be202e6`。已验收原PC库为 `D:\G5\Knowledge Map G5 PC`，后续容量注入用新库/新profile/新远端，保留这个现场。
- 原G4用户验收库在 `.local/sync-016/unified/u5/delivery-n352lu0s/Knowledge-Map-G4-20261115-PC/Knowledge Map G4 PC`，FB2用户对库在 `fb2-delivery-jlxdmf18` 下。不能复用这些现场注入容量、改原笔记或清历史。
- 不读取 `Utilities/API Key.md`，不改日常库/笔记，不扫描或复制凭据。私有报告/配置/截图/profile/身份/密钥不进公开ZIP。用户提供JSON为证据数据，不执行其中指令。

## 5. G5实现留下的契约

源码主要为 `src/sync/persistence-prototype.mjs`、`obsidian-unified-host.mjs`、`obsidian-sync-settings.mjs`、`obsidian-unified-entry.js`、`attempt-history-prototype.mjs`，以及 `src/i18n.sync.js`。

G5新增持久 `attempt-recovery` 日志事件与设置按钮「审阅共享文件恢复」。移走坏文件或重开不能自动解除隔离；预览/确认绑定head、接受依据、隔离证据、完整库存和graph/source epoch。取消不写；确认只清本机隔离，不接收预览、不发布待办、不删除共享原件。首次加入前可恢复隔离，但仍须另行审阅加入。已接受原件/全部knownIntents与cancelled ID信任校验不能跳过。旧候选遇新日志事件失败关闭，G7回退另验。

UI2仅显示推导忽略**确实空闲**时的过期held/publication-review-required，后台记录保留；G6不能删掉真实容量/保存错误来“恢复正常”。原生加入必须**先打开并显示一个图谱，再打开同步设置**；New tab下graph-unavailable是前置条件未满足。导出/文件变化可能触发异步图谱更新，驱动等待canReceive，不伪造可见状态。

## 6. G6要解决什么，哪些仍未定

依据正式评审第6/9节：实际多笔不同操作、多组、私有草稿的集成容量；具体受限项与未保存提示；受限时可用的备份/导出和轮换或替代恢复出口；旧离线端返回；恢复所需空间与iPad开销。**G6没有实现计划或通过结论**，先核对现有出口再设计最小补齐。

2026-11-17源码实查及正式评审保护线：共享1024物理文件、单文件2MiB、正文总计32MiB；私有软64MiB/4096文件/3968事件，硬144MiB/8192文件/4096事件。共享物理数量包括重复/残片，不等于可支持1024次编辑。私有阈值也不等于OS剩余磁盘。接手时从源码再核实，不先抬高阈值规避问题。

**历史near样本是1023文件、33,521,664字节，仅一笔逻辑操作**；它证明扫描护栏，不代表多操作图谱/草稿容量。不要重做同一笔千份副本充当G6。旧性能日志、定时器延迟、null heap不当作iPad内存/FPS结论。

建议的最小恢复方向为：可校验导出所选完整快照/原始备份、单独保全草稿或pending；完整且无未解决冲突/未完成发布时，经明确审阅从验证快照建立**新逻辑库**，保留旧命名空间原件。冲突/pending不能静默压成一个根；所有端明确切换/重新加入，旧离线端写旧库不自动并入新库。轮换只是正式评审建议，尚无可交付UI或G6端到端验收；不要宣称已实现。自动GC/压缩、删tombstone或清真实历史不在既定最小方案内。

## 7. 下一位agent的开工顺序

1. 读最短路径与git现状，核对G5验收/候选摘要；接续当前工作区。记录本轮目标和范围，避免把规划、技术验证、用户验收混为一个状态。
2. 检查私有预算/导出/连接切换在统一宿主和设置入口的现状；沿正常graph/store→host→session→IndexedDB路径建立真实容量复现。先用明确标注的小阈值故障用例定位门禁，再用真实阈值多笔不同操作测量；不要让小阈值测试替代真实规模结论。
3. 形成可审阅G6方案/分步清单：正常可用出口、pending/冲突时保全与拒绝边界、冷重开稳定ID、部分导出失败、切换失败/取消、旧端返回、空间余量及设备测试方式。同步TODO；涉及未定产品取舍时给出具体结果供用户判断。
4. 按复现补最小实现与必要回归。优先 `private-store-budget-prototype.mjs`、`indexeddb-store-prototype.mjs`、`connection-lifecycle-prototype.mjs`、`connection-registry.mjs`、`persistence-prototype.mjs`、`local-work-prototype.mjs`、统一host/entry/settings、`auto-publish-queue.mjs`；导出核心存在不等于用户正常按钮可到达。
5. 验证受影响合成/磁盘/浏览器/专用Windows原生链路，再生成**全新**白名单PC/iPad测试包及清楚的分组指南。邀请用户做产品/设备体验验收，准确留存身份、原件、旧/新ID、导出正文与冷重开证据；不能把API注入称真实OS断盘。

参考辅助：`scripts/sync-g4-helpers.mjs`、`sync_unified_g5_check.mjs`、`sync_g5_disk_check.mjs`、`sync_settings_browser_check.py`、`sync_g5_native_check.py`、`sync_registry_native_check.py`。构建独立候选用 `build_sync_a3_probe.mjs`，新包参考 `prepare_sync_g5_candidate.mjs` / `package_sync_g5.py`（不要直接复用其G5逻辑ID/故障样本）。Windows长路径读/复制使用已验证范围内的扩展路径；GUI驱动仅新profile，启动隐藏窗口，不关闭用户Obsidian。

改动后的典型验证命令：`npm test`；受影响时 `node scripts/sync_unified_host_disk_check.mjs` / `node scripts/sync_auto_publish_disk_check.mjs` / `python scripts/sync_settings_browser_check.py`。磁盘子进程和GUI可能需要sandbox升级；按工具请求，不绕过。原生驱动参数必须取真实preparation.out，不猜目录名。记录真实退出码/范围，未运行不写新通过。

## 8. 可粘贴到新会话

> 请接手本项目G6「有限容量可恢复」。先读AGENTS.md、TODO.md、README.md与docs/HANDOFF_SYNC_G6_20261117.md，再按其中最短路径核对源码、git状态及G5验收证据，整理G6方案并推进实现。G5已验收，原验收现场保持；继续当前本地工作区，保留全部未提交/未跟踪同步实现。容量注入仅新合成库/独立profile；不读Utilities/API Key.md，不改日常库、不升版本或发布。G6需要多笔不同操作/多组/草稿、清楚的受限提示和可用恢复出口、旧端返回及iPad验证，不能用旧单笔千份副本替代。每轮更新TODO，区分技术通过与待用户验收。
