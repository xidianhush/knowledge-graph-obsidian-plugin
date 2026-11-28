# G5 损坏与失败恢复用户验收回执

2026-11-17。用户完成新G5合成库PC↔iPad+坚果云基线、未知文件、已接受原件缺失/原字节恢复、同ID持久隔离及明确恢复，最后完全退出重开两端。用户明确确认两端图谱相同，连接ID仍为 `f21152e4db13c16005e94b78f5d2518d`；另补确认：移走03样本并同步后，**恢复确认前**也曾完全退出重开两端，仍保持隔离。结合既有六类故障技术验证，**G5本轮门禁验收完成**。G6–G8及P3仍待办，不表示正式发布批准。

12份原JSON和4张截图按字节归档至 `.local/sync-016/g5/acceptance-20261117/`，来源、摘要、检查明细见 `verification.json`；只读核验脚本 `verify.mjs` 退出0，36组核验通过。iPad文件名中的空格按内容识别，无需重交。原报告/截图/PC现场不改写，私有证据不加入公开包。本轮未运行新增合成/原生套件、未注入故障、未改运行源码/版本或操作同步服务。

## 报告与实盘事实

- 所有报告完整build匹配交付候选；PC实际安装main/styles SHA-256分别为 `97b9e0b6403afe0f897f02f0cc2f45af23a52bcd70fd482d5591c4d7cbcb35f2` / `294298902f12f24aedfa43ab5249d0a60974506747e9b5cec178ae3b60790a5f`。iPad依据完整build报告、mobile=true、截图及用户回报，未声称直接读取其运行文件摘要。两端Obsidian1.15.1。
- 两端各自安装身份在全部阶段保持，且两端身份不同；连接均为join/attempts-v1，同一逻辑库。每端完整accepted凭据始终与自身基线相同，仅接受原操作 `50f9df8011a51dc7f5a278069e6d3875`；规范正文摘要与交付原件 `7b0ed17174c50edce809bca5461b51767d5946927e6558d4bbfbd6b1b8ed590e` 相同，没有通过重造ID或再发布掩盖故障。
- 所有接受历史均经生产投影重算匹配snapshot；跨端操作正文/groups/structures一致。每份view.groups与自身accepted.groups匹配，view非busy/locked/unsupported。view不含structures字段，未冒称该字段直接存在；结构一致依据完整接受凭据。截图/用户确认四标题、无Fifth，视觉布局相同，允许本机视角与缩放不同。
- 基线每端sequence=5、库存1个原件、noop、无隔离。未知阶段sequence仍5，库存2且含unknown-file-name阻塞；缺失阶段仍5、库存0，accepted-record-missing。两类故障期间完整接受凭据/视图组均保留。用户明确移走未知文件后检查恢复；复制同名原字节后也恢复，图谱不变。这两个中间恢复点没有单独报告，不将后续恢复报告冒充当时导出。
- 隔离阶段每端sequence=6、库存2，同一原ID的正文摘要分别为原件7b0ed171…和样本55497a28…；attemptConflict证据、quarantined数组及attempt-conflict-review均一致。原接受正文仍为7b0ed171…，没有采用异常样本。报告库存与交付样本文件名/正文摘要完全对应。
- 恢复及最终报告每端sequence=7、库存仅原件、隔离清空、noop。最终PC实盘ops恰有一个原件，逐字节与交付原件相同。恢复→最终重开完整accepted/安装身份/连接保持，未新增接受操作。5→6→7符合隔离及明确恢复的预期增量，未直接读取用户私有日志事件正文。
- 全12份报告ready、faulted=false，无error/saveError/pending/layoutDraft/pendingSave/selectionPending/externalPending，队列未armed/paused/running/closed。故障阶段的held为共享输入拒绝，不是私有会话损坏。原始队列lastResult仍可保留publication-review-required；生产deriveSyncStatus在基线/恢复/最终均为saved且空reason，与两端设置截图一致，推导不修改报告或队列授权。

## 用户体验依据与边界

用户明确基线两端相同；未知/缺失都出现预期原因，恢复后布局保持；隔离按钮可用，取消仍保留隔离和布局，重新审阅确认并检查后正常；恢复前重开仍隔离、恢复后最终重开仍正常。取消和恢复确认前重开没有单独报告，依据用户明确回报，不虚构独立JSON或自动化证据。

G5的部分写、本机提交失败、写期间图谱/源变化及首次加入前隔离恢复的技术范围见 [技术结果](SYNC_G5_RESULT.md)。本轮真机验收只覆盖指南三类可操作文件故障；不冒称iPad发生真实断电、硬件损坏或任意外部写者绝不丢失。用户按新库进行测试，已验收G4/FB2/日常库不受本轮核验影响。

下一阶段为 **G6有限容量可恢复**：多笔不同操作/多组/私有草稿的容量、空间不足提示与恢复出口、旧离线端返回及iPad开销。G7旧版回退/整包、G8发布授权、P3超长消息仍保留。此处只记录下一阶段，不将其视为已实施或已通过。
