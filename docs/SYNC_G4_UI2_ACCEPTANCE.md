# UI2 无待办误暂停用户验收回执

2026-11-17。用户明确两端重开先进入设置，没有先建图、检查共享布局或审阅，直接显示“布局已保存到本机，当前没有待发布布局”，没有暂停或过期原因；随后打开图谱，人眼确认原无Fifth布局保持。**UI2本场景验收完成**。

2份报告及2张截图按字节归档 `.local/sync-016/g4/ui2-acceptance-20261117/`，源路径/大小/SHA-256保留；verify.py / verification.json的19项回执核验通过。iPad原文件名为U12-设置先开- iPad.json，按本轮内容和build识别为UI2回执，未要求用户重命名或改原件。

两报告完整build匹配最终7415bc13…候选；PC安装main/styles摘要分别匹配7415bc13…/29429890…。iPad未直接读取文件系统摘要，使用报告、截图和用户体验回报核验。两端Obsidian1.15.1、mobile标记false/true，原安装身份和连接保持。

每端完整accepted凭据与UI1报告相同，仍25操作，sequence分别119/47保持。跨端按ID集合及正文映射核对相同，接受groups/structures相同且无Fifth。两端ready，无error/saveError/pending/pendingSave/layoutDraft/selectionPending/fault/externalPending，队列未armed/paused/running/closed。

两端原始outcome和queue.lastResult仍为held/publication-review-required，与修复前一致；这属于有意保留的历史结果，不代表当前还有草稿。用生产deriveSyncStatus按报告字段映射重算，两端均saved/空reason且输入未改；截图均为正常无待发布提示、无过期原因。修复针对显示推导，未通过删诊断记录、自动armed或发布工作消除提示。

报告按指南在建图前导出，因此不以其view缓存宣称后续图谱几何核验完成；后续无Fifth原布局依据用户明确的人眼确认。未把本轮当作新增双向传输/冲突/损坏恢复全流程验证。

本轮仅只读附件/PC运行字节、回执对照、归档和文档更新，无源码/版本/用户库改写、运行套件/服务操作或发布。UI1/FB2/FB5验收保持。G4本轮修复续验收尾；P3超长消息仍单列，下一步建议G5损坏与失败恢复，G5–G8与发布门禁尚未放行。
