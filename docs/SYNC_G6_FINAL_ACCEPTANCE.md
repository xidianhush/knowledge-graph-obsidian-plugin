# G6 明确加入与双端重开验收回执

2026-11-19（Asia/Shanghai）。用户明确确认：iPad能够发现并选择PC轮换后的新ID，审阅并加入时选择“采用共享布局”，随后两端布局一致；已提交重开后的两份状态报告和三张截图。**结合此前基线、触顶保全、PC取消/确认轮换、旧端返回隔离，本轮G6功能验收流程完成。** 导出/冷开耗时、iPad资源及一般传输体验仍按实际证据范围保留，不能外推为所有G6指标或发布门禁通过。

私有证据：`.local/sync-016/g6/final-adoption-20261119-hDRYGG/`，含两原JSON、三原图、来源SHA、`verify.mjs`及`verification.json`。本轮20组只读核验通过；用户原件未修改，私有附件不进入公开交付包。

- 两端完整29模块build、graph host/footer摘要匹配已交付G6候选，Obsidian均1.15.1；PC/mobile=false、iPad/mobile=true。各自原安装身份保持且彼此不同，未通过复制身份完成加入。
- 两端均选择新逻辑库`c0a8d052f223bde95cf38e26c64f48f8`，PC为origin=new、iPad为origin=join。各自仅接受原根`1fba4e4e970f28ec0924bcc05a9a556d`，parents为空、包含两组变化；完整operation/appliedIds一致，没有额外旧端导入操作。
- 两端所选共享库存一致：恰1个1846-byte正文，SHA256为`14d83618d334e6b2ea6932380e2e361dce7870c8d32ba38e0ad1cf07f42db8cb`，无blockers/quarantined。PC实盘原件哈希、长度匹配；iPad依据其报告的完整接受操作及库存，不冒称直接读取iPad文件系统或云端正文。
- 完整groups/structures/schemaVersion一致，坐标及形状逐项相同；两端view.groups各自等于accepted投影，原图谱模型兼容检查通过。iPad采用PC根布局，没有将旧端B组离线草稿自动并入新根。两张最终图谱的相对布局与用户确认一致；屏幕比例、视角及标签显隐不作为共享字段比较。
- PC snapshot/view revision为1，iPad为0；接受指纹分别a151df94…与21f35672…。源码按本地revision投影，接受指纹涵盖快照摘要；独立重算两端指纹均准确，将iPad revision归一至PC值后指纹完全相同。因此不把这两个本地字段差异误判为共享正文或坐标分歧，也不声称完整接受凭据逐字节相同。
- PC完整报告除timestamp外与11-18旧端返回隔离时相同，sequence仍8；iPad新库sequence为5，不能与旧库sequence6作单一会话倒退比较。两端ready，无error/saveError/fault/pending/pendingSave/layoutDraft/selection/rotation/attemptConflict/externalPending；生产显示推导均为saved。未授权队列保留的历史publication-review-required在当前空闲条件下被正确忽略，无自动发布授权。
- 私有清点完整且未暂停：PC15150 bytes/14文件/8事件，iPad9416 bytes/11文件/5事件，无触发项。此为所选库私有库存，不是OS余量、全部历史占用、heap或FPS。
- PC实盘旧97325ac3…库仍恰1024份原字节文件，与基线逐份SHA/长度相符；新库仍仅原根。iPad旧草稿的当前私有域和完整备份正文未在本轮直接读取，保全依据此前旧端报告、独立备份回报及既有技术验证，不能用新库draft=null解释为旧草稿被删除。

截图1属于发现新ID、尚未切换的旧库阶段，显示受限列表和容量提示符合当时情境；最终状态以两份重开报告核验，没有将阶段截图的旧ID/容量横幅当作最终故障。用户重开操作依据其明确回报及重开后报告，不伪造进程遥测。

目录未到达障碍已随iPad手动坚果传输、重新发现和明确加入解除；未确定此前延迟的具体原因，不能据本轮成功宣称一般限流体验已修好或用户已切换PC桌面客户端。

后续保留：本轮iPad恢复包正文独立校验、实际导出/冷开耗时与资源体验未新增测量；P2备份路径提示改进、一般传输限流体验、P3、G7/G8及发布门禁仍保留。无需重复已闭环的四组功能操作，继续保留两端测试库、旧/新历史及库内外完整备份。

本轮仅只读报告/图谱兼容/已知PC共享文件核验、私有证据归档及项目文档更新。未新跑构建/浏览器/原生回归套件，未更改运行源码、版本、用户库、客户端/服务配置，未提交推送或发布。
