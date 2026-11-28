# UI2 PC打开图谱后的核验

后续（2026-11-17）：用户明确授权后，[误暂停程序修复](SYNC_G4_UI2_FIX_RESULT.md)技术完成，待两端设置先开短复验；以下为修复前回执核对。

2026-11-17。新增1报告及1图按字节归档 `.local/sync-016/g4/ui2-user-20261117/`；verify.py / verification.json的8项核验通过。截图显示Moved下的Third/Fourth、Second/First，无Fifth，与报告匹配。

PC打开图谱后view.groups与其accepted.groups完全一致，也与上一份iPad报告的view完全相同。完整accepted凭据仍与UI1 PC报告相同，25操作，sequence仍119；构建、身份、连接保持，无pending/draft/pendingSave/错误/fault。此次正确显示未增加接受操作或新发布记录；不支持此前布局已丢失的判断，原设置阶段导出的旧Synthetic/A视图已在打开图谱后正确投影。

outcome从held/publication-review-required变成noop/receive，生产deriveSyncStatus重算saved/空原因。队列armed=false、lastResult仍为同一历史held且paused=false，说明当前正常文案不等于已修复首次空闲时的误提示。UI2视图核对完成，保留无待发布工作时被outcome/lastResult误称暂停的P2显示缺口，尚未修代码。

本轮仅只读附件、对照、归档与文档，无新运行套件、用户库改写、版本或发布。比较对象为上一份iPad报告，不冒称本轮同时两端重新同步或重新验收全部流程。UI1/FB2/FB5既有验收保持，超长消息P3、G5–G8继续待办；用户无需重置、审阅、重新加入或补做横条测试。
