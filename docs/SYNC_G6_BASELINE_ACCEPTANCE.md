# G6 两端基线验收回执

2026-11-18（Asia/Shanghai）。用户明确完成指南第1组，两端图谱相同，并回交PC/iPad各一份报告和一张图谱截图。**本轮仅两端基线验收完成**；备份、触顶草稿、轮换、旧端返回、最终重开及iPad资源体验仍待后续，不提前关闭G6门禁。

两份原JSON和两张截图按原字节归档 `.local/sync-016/g6/baseline-20261118-M2OTHn/`，来源/长度/SHA256见 `verification.json`。`verify.mjs`退出0，22组只读核验通过。原来源、用户库、截图均未改写；证据不进公开包。

- 完整build均匹配436fb462…候选；两端Obsidian1.15.1，报告mobile分别false/true。PC安装main/styles实盘摘要匹配交付；iPad依据报告、截图和用户回报，不声称读取其文件系统。
- 同一逻辑库 `97325ac3b3748ea183dd23488a5bc461`，连接均join/attempts-v1，两端安装身份不同、sequence均5。完整accepted凭据跨端相同，指纹 `1d928380fd1187fc8dec60c4f78622c9656effcabcf130a4da2555d1ea6999f0`。
- 各自恰有1024个不同操作ID，全部完整正文/appliedIds与预置历史相同，没有新增本地导入。生产投影重算等于accepted快照；两组groups/structures及种子快照摘要匹配。
- 每端库存1024、路径/正文SHA/长度与种子逐份匹配，无blockers/quarantined；PC只读实盘恰有1024份原字节原件。
- 两端ready、无error/saveError/fault/pending/layoutDraft/pendingSave/selectionPending/externalPending/attemptConflict/rotationPending；队列未armed/paused/running/closed。view.groups匹配各自accepted，无busy/locked/unsupported。view没有structures字段，结构一致来自完整接受快照，不冒称直接存在该视图字段。
- 私有清点均完整且未暂停：PC1418160 bytes/1033文件/5事件；iPad1414892 bytes/1034文件/5事件。文件数不同不影响相同接受布局；这些是私有存储计数，不是heap或OS空间。
- 历史publication-review-required仍在原队列诊断中；生产显示推导为saved、空reason，并未删除后台记录。截图为图谱页面，不把推导结果说成截图里的同步状态文字。

截图均显示First/Second与Third/Fourth两组排列，与用户“两端图谱确实相同”的明确确认一致；本机缩放、视角及UI不同允许保持本地。没有新提交冷重开报告，不把本轮扩大为重开或性能验收。

下一步按 [G6指南](SYNC_G6_GUIDE.md) 第2组：两端完整恢复备份、另存完整目录到库外，仅PC拖动触发共享数量门禁。正常提前门禁仅保存草稿、pending=null，无放弃按钮是预期；有实际pending才另行审阅保全处置。继续保留所有原件与基线身份/接受凭据作为后续对照。

本轮仅原文件读取/归档、生产报告投影核验和文档更新，未新跑构建/合成/浏览器/原生套件，未注入故障、改运行代码/版本/用户库或操作服务。
