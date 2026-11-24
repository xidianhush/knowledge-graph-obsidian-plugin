# U2：可靠保存后的自动发布队列

更新：2026-11-14（Asia/Shanghai）。用户要求执行 [统一候选计划](SYNC_UNIFIED_CANDIDATE_PLAN.md) 的 U2。本轮完成核心协调与真实文件/进程退出验证；正常宿主接线为 U3，设置入口为 U4，原生与用户体验验收为 U5。

## 行为与接口

新增 `src/sync/auto-publish-queue.mjs`：

- `createAutoPublishQueue({readLocal,publish,canRun,onResult,maxBatch})` 提供 `notifySaved(draftId)`、`resume({confirmed})`、`settled()`、`close()`、`state()`。`readLocal` 同步返回 durable session 状态，`canRun` 同步返回 true 或带 reason 的拒绝；构造不发布。
- 普通保存必须先 await coordinator 的可靠本机草稿保存，再通知对应 draft ID。重复/过时通知不重复发布；通知与当前可靠草稿 ID 不符时拒绝，不把 UI 尚未保存的值当凭据。失败保存不通知。
- 每个队列只保存请求标志，合并连续保存；同时只有一个发布任务，单批最多 4 次进展。结果不前进、冲突、未知输入、预算或写失败会有界暂停。后续保存保留最新草稿，不热循环重试失败 pending；`resume()` 在同一次已授权运行内重试。
- 新队列若发现恢复的 pending/草稿，即使收到一笔新保存通知，也需 `resume({confirmed:true})`。无恢复工作的新队列可由新保存授权；直接 resume 仍要求明确确认。首次加入和冲突决定不经过普通编辑自动授权。
- 隐藏/禁用的准入拒绝不写共享目录，临时恢复后可重试。队列 `close()` 立即拒绝新通知并等待已开始任务排空；在发布意图或路径登记后、实际共享正文写入前关闭也会停下。已经进入适配器写入的任务允许写完并校验/接受，不声称撤销已发生的共享写；await close 返回后无后续队列共享 I/O。
- `onResult` 抛错不会重发已经完成的操作。队列只写库内共享目录，不调度坚果云上传。

`createLayoutDraftPublisher({session,coordinator,attemptHistory,vault,createModel,getEpoch,reserve,runExclusive,nextId})` 是真实发布适配：

- host 注入图谱/store/连接门禁与可选的容量/宿主串行 `runExclusive(fn)`；`reserve()` 返回 `{isCurrent,release}`，忙编辑/接收时不进入，finally 释放。U3 负责接入实际 lifecycle、目录权限、quota 和外部配置代次；U2 的直接存储测试不冒充已经集成。
- 用实际完整 attempts 扫描与原 author/session 的 stage/publish。只以原本机接受集合为父因果；对端文件到达不等于已经接受。已知冲突在暂存前暂停；后到输入继续由 session 校验。
- 已有普通 pending 原 ID、正文、备份保持不变，重试沿用原操作并分配新的 attempt 路径。不能让较新草稿改写旧 pending。普通发布拒绝未初始化、冲突解决 pending、尚未结束的本机配置保存。
- 从不把较旧的已接受快照 apply 到活动布局 store。较新草稿保留，待旧操作可靠接受后按下述证据核对，再生成下一笔因果延续操作。

## 草稿与接受的原子协调

`persistence-prototype.mjs` 新增只读 `readLocalPublication(baseFingerprint)` 与 `compareAndSetLocalState(expected,value,{acceptedFingerprint})`。前者只从经过验证的普通本机 accept 日志导出相邻转换，冷开回放重建；只有其 after fingerprint 仍是当前接受时才返回。join、外部 receive 和冲突解决不能产生这类授权。后者在 session 同一队列内核对完整旧 localState 和当前接受指纹，再写原有 local-state 事件；不相符返回 false，不把新草稿、设置/UI 或接受变化覆盖掉。

coordinator 新增 `settlePublishedLayoutDraft()`，在自己的草稿保存队列内执行。草稿与当前接受同基线可继续；只有上面的相邻本机发布证据允许推进草稿基线。值已经相同才清除，否则保留相同 draft ID 和完整新值。外部接受即使几何相同也不能悄悄授权旧草稿。v1 local-state 继续用原有 v2 只读映射比较，CAS 仍核对原始旧值；没有新增持久格式、共享协议版本或设备密钥迁移。

`session.publish({canContinue})` 与 `attemptHistory.write(name,text,{canContinue})` 新增可选的准入回调，原调用默认允许。U2 把关闭、图谱代次和 store 门禁传到实际正文写入前；已有导入/解决调用保持原流程。

## 本轮技术验证

- `node scripts/sync_auto_publish_check.mjs`：**22 项**。覆盖本机保存实际失败、重复通知、多笔记所属结构、最新草稿与旧 pending、失败后保存不热重试、恢复确认、foreign accept、完整状态 CAS、旧 v1、编辑争用、未知文件/预算/冲突、写入期间新保存、关闭排空、接收/发布两种先后顺序、图谱过期和 observer 异常。
- `npm run test:sync-auto-publish-disk`：**14 次真实子进程退出**，使用真实 Node 私有存储和共享文件。覆盖本机临时文件半写、可靠草稿已写未通知、intent/stage、publish intent、attempt-path、共享半写、共享完整但未接受、accept 后草稿尚未处理；另含 4 个较新草稿恢复边界。冷开不自动发布，确认后原 ID/正文保持、完整和半写原件不覆盖、新草稿接在旧操作之后，第二次冷开接受集合稳定。半写场景最后 2 个物理文件、1 个逻辑操作。
- 默认 `npm test`：构建 + **25 个合成脚本**；持久化磁盘 **65 项/23 次退出**、加入磁盘 **53 项/19 次退出**复跑通过。其他实际专项结果见最终回归摘要，不把历史数字当本轮新通过。
- 既有 attempts 导入专项 **18 项/6 次真实退出**、冲突解决专项 **11 项**完成结果已读回；冲突解决的中断为注入异常，不计作进程退出。这两项的工具完成回执在会话交接后不可恢复，最终摘要明确记录成功末尾标记，不虚填退出码。
- 独立只读审阅无剩余 Critical/Important。审阅发现的“登记发布意图后关闭仍开始共享写”先由失败测试复现，再补最终写入准入检查；其建议的两种接收/发布顺序已补并通过，审阅者独立复跑 22 项通过。

最终命令、退出码、日志、磁盘目录及源/构建摘要：`.local/sync-016/unified/u2/regression-summary.json`。新专项默认合成入口加入 `scripts/test.mjs`；磁盘单独入口加入 package scripts。首次沙箱执行硬链接 EPERM 不算测试通过，提权后最终运行另有记录。

## 当前边界

这是注入适配器下的核心与文件恢复检查，不是新的 Obsidian 原生、iPad、坚果云传输、OS quota、断电或近限额性能验收。D1 条件保证保持，不把 attempt 路径/摘要校验宣称为任意外部竞争下的原子不覆盖。存储故障和容量达到边界继续保留原件并暂停。

新增队列没有接入默认产品的自动发布入口；默认恢复 bundle 因复用 persistence/coordinator 而重建，正式版本仍为 0.0.15。未修改日常库、既有 Onboard/Resolve 现场、README 或版本，未 commit/push/发布。U2 技术工作完成，统一体验待 U3–U5 集成与用户验收；下一执行项为 U3。用户此时无需操作 PC/iPad 或重跑已有两组测试。
