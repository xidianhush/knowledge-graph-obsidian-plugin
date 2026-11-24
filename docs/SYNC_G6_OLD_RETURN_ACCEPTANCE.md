# G6 旧iPad返回隔离回执

2026-11-19最新进展：后续iPad明确选择新ID、采用共享布局及双端最终重开已由用户确认，2报告/3图20组核验通过。详见 [最终回执](SYNC_G6_FINAL_ACCEPTANCE.md)。下文“待加入/待重开”和目录排查是各阶段历史，不覆盖最新结果；限流体验及资源测量仍保留。

2026-11-18。用户确认iPad起初仍为旧ID、断网拖动并结束调整，再联网且两端传输完成；PC检查后新布局未变。两原报告/一张iPad图谱截图归档，16组只读核验通过。**本轮旧端返回不自动合并场景完成；iPad明确加入新ID及双端最终重开仍待验收。**

私有证据 `.local/sync-016/g6/old-return-20261118-5xWHXU/`：来源/SHA、`verify.mjs`、`verification.json`、报告/图及当前PC完整恢复备份。原来源、用户库及服务未改写，证据不进公开包。

- 两份完整build匹配436fb462…，Obsidian1.15.1，PC/mobile=false、iPad/mobile=true。各自原安装身份保持且不同，未复制身份来绕过旧端行为。
- PC仍是新ID `c0a8d052f223bde95cf38e26c64f48f8`，sequence8；单根1fba4e4e…、指纹a151df94…、完整accepted/结构/视图组保持。整份报告除timestamp外与此前PC重开报告相同，view匹配accepted，无新待办。
- iPad仍是旧ID `97325ac3b3748ea183dd23488a5bc461`，原1024操作的完整accepted/指纹1d928380…与基线相同；sequence5→6。独立草稿 `f3c377741e9df618c43c5f777718ec64` 绑定原accepted基线，只有Synthetic/B组几何改变，A组及structures保持，符合截图Third/Fourth横向排列。view.groups等于草稿，完整快照通过原图谱兼容核验。
- 两端ready，无fault/saveError/error/pending/pendingSave/隔离/轮换/连接待选；队列均未armed/paused/running/closed。PC生产状态为saved；iPad为draftReview/publication-review-required，说明旧工作仍为待审本地草稿，未当作共享成功。没有据iPad报告虚构当时出现attempt-file-budget错误。
- 各自所选库存完整保持：PC新根1份、iPad旧库1024份，无blockers/quarantined。PC实盘两个目录分别恰有1与1024原字节文件，无新增旧共享操作。iPad报告只展示旧所选目录，不据此直接声称读到了iPad新目录或云端库存。
- 私有清点均完整未暂停：PC15150 bytes/14文件/8事件；iPad1417583 bytes/1036文件/6事件。不是OS空间或heap测量。
- 当前PC恢复包92755e6b…已生产完整校验并归档：11分片+manifest共12文件，正文10458 bytes，准确包含当前单根接受状态、无草稿/pending。iPad已导出备份依据用户回报，未提供其包正文逐片核验；明确切换前仍须用户保留已完整核验的独立备份。

用户报告续传完成且本场景核验通过，解除此前本次等待障碍；不将其解释为坚果云限流策略已修好，也不推定已改用桌面客户端或更改过滤规则。

下一步仅iPad在图谱布局同步中“关闭同步，保留本地工作”→查找并审阅选择PC新ID→“审阅并加入”明确“采用共享布局”。旧草稿保留在旧库/独立备份，不自动压进新根。随后两端检查、完全退出再重开，回交报告与最终图谱。备份目录保留原位置/名称，库外另存用复制。

本轮仅报告/快照兼容与明确PC文件路径/备份只读核验、私有归档及文档更新，未操作客户端、凭据、用户库或运行代码，未新跑构建/浏览器/原生测试；G6整体及iPad资源体验、G7/G8继续保留。

2026-11-19续验阻塞：iPad查找仅列旧ID，未能选择新ID；PC新根实盘及生产目标扫描仍有效。用户随后用文件App确认当前iPad测试库attempts-v1只有旧ID目录，新目录缺失；本轮再次只读检查PC明确根路径仍存在。截图及来源SHA归档于`.local/sync-016/g6/ipad-missing-local-20261119-6qPsnw/inspection.json`。下一步检查本轮实际G6云端目录下同一attempts-v1及新根JSON，区分PC上传和iPad下载/路径环节；尚未读取云端或确认映射，不能认定限流为具体原因或发现器缺陷。保持iPad图谱布局同步关闭；本页旧端隔离结果不外推为新根已到iPad。见TODO的SYNC-G6-IPAD-DISCOVERY-MISSING，未改用户现场或候选，未新跑构建/原生套件。

2026-11-19云端续报：截图1明确显示`KM-G6-20c82efd/Knowledge Map Sync/attempts-v1`下有旧/新两个ID目录；用户确认新ID的ops内存在1fba4e4e开头JSON。截图2实际为1×1像素，不能提供文件列表独立目视证据；未下载云端正文核验长度/摘要。两附件及来源SHA归档于`.local/sync-016/g6/cloud-root-user-20261119-117Z3t/inspection.json`。据此将下一步排查转至iPad Nutstore Sync远端路径、过滤范围及下载日志：先只读核对本轮远端，路径一致时单次前台传输再查本地根文件；若路径不同或仍缺失，先收集脱敏设置/末段日志，不盲改路径或重建布局。iPad加入与最终重开继续待验，无新运行测试或用户现场修改。


2026-11-19到达续报：用户确认远端目录正确且无Knowledge Map Sync/JSON排除规则，手动iPad坚果同步完成后，本地attempts-v1出现新c0a8d052…目录；两图分别显示正确远端和本地旧/新目录。证据`.local/sync-016/g6/ipad-target-arrived-20261119-6XktW3/inspection.json`及两附件按来源SHA私有归档。目录到达障碍解除，可继续布局同步关闭时查找并审阅选择新ID，然后审阅并加入明确采用共享布局；旧备份保持。目录截图未展示ops正文，不据此称正文/发现/加入已通过；插件目标校验及用户后续报告仍必要。双端最终检查/完全退出重开与G6整体继续待验，未确定先前延迟具体原因，无用户库/传输设置修改或新运行测试。
