# G6 PC备份与共享文件触顶回执

2026-11-18。用户完成第2组至第3步，明确PC拖动后新位置保留、没有弹回；两端已点恢复备份。PC触顶报告/截图及两处PC完整备份已只读归档、核验16组通过。**本场景完成，尚未执行或验收轮换、旧端返回及最终重开。** iPad备份依据用户回报，本轮没有提供其备份正文做逐片核验。

私有证据 `.local/sync-016/g6/capacity-user-20261118-57REw3/`：`verification.json`、`verify.mjs`、报告/截图及两份完整备份；来源/长度/SHA逐份记录。原文件、库内备份和共享历史均未改写，证据不进公开包。最初核验脚本错误假定基线drafts.json为对象，实际为合法null；修正判空后退出0，未改产品/备份。

- 完整build/连接/安装身份保持基线，逻辑库97325ac3…、PC身份bdc04ee0…；sequence5→6，仅新增本地草稿事件。完整accepted凭据、1024操作正文及指纹1d928380…不变。
- 草稿b948d3cd…绑定原accepted指纹，完整schema3快照适配原图谱；只有Synthetic/A标题组几何改变，Synthetic/B及全部structures不变。报告view.groups与草稿完整几何相等，无busy/locked/unsupported。截图和用户确认支持新位置保持。
- 无error/saveError/fault/pending/pendingSave/隔离/轮换/连接待选。共享库存及PC实盘仍为1024份原字节原件，未新增发布。outcome和队列均held/attempt-file-budget，队列paused=true、running=false；生产显示推导capacity，不将本机草稿称为已共享。私有清点完整、1420839 bytes/1035文件/6事件，未暂停；这次触顶是共享物理文件数量，不是私有空间不足。
- 第一次PC备份：库外 `D:/G6/Backup/Knowledge Map Backups/5eb6bd97421e15eaa73ef4fda6ac76c1`。1034分片+manifest共1035文件，正文1066787 bytes；生产校验全部SHA/长度/完成清单，接受快照及全部1024操作匹配，无草稿/pending。
- 第二次PC备份：库内 `D:/G6/Knowledge Map G6 PC/Knowledge Map Backups/148aac14c20cb70e177e86ced3af7b74`。1035文件，正文1068736 bytes；同样完整核验，准确包含此次草稿ID、基线和完整新布局，pending为空。
- 两次导出ID不同；除drafts.json外各分片正文均相同，原配置、原始加入/配置备份和全部操作保持。归档副本再次通过生产完整导出校验。

下一步：把第二份完整备份**复制**到库外，保留库内目录供审阅校验。PC选择“将已保存但未发布的草稿明确导入为新根”，按指南第3组先取消、再明确确认，记录新ID及报告；iPad暂保留旧ID。pending=null意味着无需“放弃未写入的待发布”。若重开设置导致轮换按钮灰色，先再完整导出一次备份，再在同一设置面板继续审阅；保留先前所有备份。

本轮无运行源码、版本、服务、用户库写入或新构建/设备测试。后续轮换/旧端返回/最终重开及iPad资源体验继续待验收。

2026-11-18后续操作反馈：用户将库内第二备份改名/剪切至库外Step 2目录，轮换预览因原manifest路径缺失而拒绝（recovery-export-incomplete）。库外完整包重新生产校验通过，摘要与前次相同；不是备份损坏。指引重新在原库内目标完整导出并保留名称/位置，另存用复制，再审阅；当前未进入轮换验收。原技术码/历史成功提示的易懂性记P2于TODO，未改候选或原库。证据backup-moved-20261118-g2vl2z。
