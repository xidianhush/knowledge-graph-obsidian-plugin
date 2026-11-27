# G4 优化候选独立测试库短验

日期：2026-11-27（Asia/Shanghai）。用户已要求开始短验，候选源码5c8364a。沿用dddf14a同步体验和现有Windows/iPad独立测试库，不新建库，不操作日常库。

## 当前状态：PC原生重开/保存/再重开技术通过，iPad更新及跨端体验待用户验收

PC沿用Knowledge Map Copy Trial与其原隔离profile；iPad继续使用Knowledge Map G2 iPad。新main.js SHA-256为`5fca5ac3c9ac2d73e23887105754bd210a7e5fcdbeae30ccf44d0bf050e2e9a7`，0.0.17开发候选，见[优化结果](G4_OPTIMIZATION_RESULT_2026-11-27.md)。

用户要求继续后，已实际看到原隔离库A左/B右布局及“本机布局已保存，当前没有待处理修改”。原生导出报告与先前PC报告的设备身份和连接一致，7条已接受操作完整，画布与接受快照一致，无pending、草稿、保存错误或共享阻断；报告内模块摘要与当前源码逐项相同。未因默认profile那次首次开启提示而创建新设备或加入记录。

在原生调整模式中拖动一个合成圆并结束调整，页面显示“共享文件已写入，传输由你的同步工具完成”。新报告确认接受操作7→8，前7条逐项不变，快照有实际变化且画布一致，无待处理工作。随后通过正常窗口关闭使Obsidian完全退出，原profile再开；画布可见且第三份报告的整个接受对象与保存后完全相同，身份/连接保持、状态ready、无重复发布或错误。正常冷重开这一步没有强制结束进程。

原9份共享文件及两篇Synthetic笔记、START-HERE.md摘要均保持，仅新增1份共享操作，共10份。该变化来自本轮合成布局短验，不是云端传输。新导出的3份诊断报告已校验后移到库外私有证据目录；旧报告未移动，不能据此断言Nutstore将只传某类文件。PC图谱保持打开，尚未执行任何坚果云上传/下载。

以上为Codex观察的Windows Obsidian 1.15.1小规模原生技术短验，既不是406操作的原生性能测量，也不是用户体验验收。iPad尚未装此候选或测试本轮传输。下面保留最初准备和窗口恢复过程。

已通过进程查询确认Obsidian退出，备份并只替换PC独立库的main.js、manifest.json、styles.css。插件data.json、两篇Synthetic笔记、START-HERE.md及9份共享文件共13份保护文件，在完整长路径清册中前后摘要相同。原隔离profile和设备私有状态留原处，不复制到iPad。没有读取Nutstore账号配置。

初次普通路径glob漏列长共享文件名。尚未启动应用时已恢复原三运行文件，改用Windows扩展路径采集完整备份/清册，再安装相同候选并核对13项不变；初次记录保留，不将漏列的空清册当成保全证明。运行文件/保护文件快照不是完整私有恢复导出。

原隔离profile只登记这个测试库。启动后已观察到Obsidian 1.15.1仓库选择器和原同名库，点击后捕获报`foreground window did not report a process id`，刷新仍未列出可操作的Obsidian主窗口。当时已停止界面输入，并请用户将该测试库还原到前台；该时点尚未核验原生恢复、模块加载、保存或同步，不计通过。

用户随后回报已打开，已实际观察到同名图谱和设置窗口。但同步页显示“开启布局同步”，进程归属核对确认前台窗口属于未指定user-data-dir的默认profile，而原隔离profile进程仍在后台。因此该次画布不作为原配对库重开证据；没有点击同步开关、创建新身份、编辑或传输布局。已请用户完全退出Obsidian，再以原隔离profile可见方式重开。原设备状态没有删除/迁移，默认profile配置未由Codex编辑。

用户回报已关闭后，进程查询确认默认实例已退出，剩余的是本次由Codex启动的隔离后台进程。普通退出失败后，经单独获准，只结束该已核对的进程树；没有清理profile或重置身份/账本。确认Obsidian进程全部退出后，备份原隔离profile的obsidian.json，只将其中唯一测试库的open标记设为true，并使用原user-data-dir以可见方式发起重开。此后首次窗口查询返回“Computer Use was stopped by the user with the physical Escape key”，已立即停止电脑操作。尚未观察重开结果或确认原接受状态恢复，未执行拖动、保存或云端传输，不能记为原生或体验通过。

## 短验范围与当前进度

1. 已完成：原profile恢复、候选模块核对、7操作与原设备连接核对、原生保存到8操作、正常退出后冷重开接受对象/画布保持。
2. 待用户：完全退出iPad的Obsidian，在Knowledge Map G2 iPad的`.obsidian/plugins/knowledge-graph-smoke/`仅替换包内main.js、manifest.json、styles.css，保留data.json及本机设备状态；重新打开后回报布局是否保留、有无异常。包不含设备身份，不导入PC已用库或profile。
3. 再安排：两端同候选确认后，按原Nutstore配对做一次布局传输并观察目标当前画布；当前未执行，不预记通过。
4. 本轮不扩成长历史设备压力、G2整轮重做或全部发布放行。

## 候选包与私有证据

iPad更新ZIP已准备，仅含main.js、manifest.json、styles.css和SHA256SUMS，CRC及逐项字节与dist核对通过；没有data.json、PC profile、已用设备身份/账本、笔记或同步账号配置。本轮尚未替换iPad文件，也未执行云端传输。

私有证据位于`.local/g4-native-20261127/smoke-g3krd8ea`：原运行文件与13项完整保护文件备份、初次路径限制记录、最终install.json及候选ZIP。不会加入公开提交或交付包。后续观察追加在本记录，不覆写已发生的准备与窗口阻断。

新增原件：native-before.json、native-saved.json、native-reopened.json及pc-native-verification.json，3份导出原件保留在native-exported-originals。当前PC可见图谱与设置观察均来自原隔离profile；本轮未另存桌面截图到仓库或公开包，也未读取服务账号配置。

准备阶段npm run check退出0；2份当前文档29个链接、安装三资产及候选包摘要核对通过。这些检查不替代原生运行或用户体验验收。

继续短验后再次运行npm run check退出0（构建及46个合成检查脚本等现有门禁）；3份受影响文档46个本地链接、安装三资产/更新包摘要及原生验证记录检查通过。有限公开文本检查不等于全面秘密审计。运行源码未在短验中修改，后续仍待用户完成iPad更新与跨端体验回报。
