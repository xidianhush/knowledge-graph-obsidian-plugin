# 原生审阅发布阻断：定因与复验

更新：2026-11-26（Asia/Shanghai）。修复起点为`ff5931d`，本地修复检查点为`28a5149`，继续保留`dddf14a`的一次开关体验。修复原生确认发布的自身文件事件误判，未增加设置步骤或改动图谱交互。原生确认发布、文件核对、重开及新状态报告补验完成；用户体验判断仍待用户验收。

## 实际问题与原因

11月25日在独立合成库的Windows Obsidian 1.15.1中，关闭同步→移动并保存布局→开启→审阅，入口和取消正常，确认却返回`held/publication-unavailable`。草稿和pending均保留，没有共享布局操作。历史过程见[草稿入口结果](SYNC_DRAFT_GUIDANCE_RESULT_2026-11-25.md#原生短验续报确认发布未完成)。

临时诊断构建只安装于该独立库，记录发布继续条件：图谱仍可用、gate为真，但externalEpoch在创建共享目录时增加，导致确认后的继续校验失效。原生vault监听器把插件自己创建`attempts-v1`目录的事件也当作外部变化。真实宿主回归加入适配器mkdir/write事件后，修复前同样返回held；首个回调正是自己的目录创建。不能通过移除epoch校验解决。

## 修改及约束

- 原生监听器传入事件类型、当前/旧路径及是否目录，继续调度原有观察和自动编排。
- 宿主在既有发布保留期内记录当次pending已有attempt路径和目标目录。只有实际等待mkdir/writeBinary的I/O窗口内、对应目录创建或当次新分配文件的create/modify事件，才不额外增加externalEpoch。I/O及发布保留期均以finally清理。
- 其他路径、已有attempt、删除、重命名、设置或图谱变化继续使确认失效。自己的文件事件仍进入原观察队列；重复扫描、内容摘要、字节回读、审阅清册及最终epoch检查保留。
- 普通区仍为开关、状态、一项主要操作及折叠区。协议、固定默认ID、bootstrap发现、自动加入、备份/恢复及布局schema均未改。

第一版修复曾将豁免覆盖整个发布保留期。独立审查指出：最后一次回读之后的同路径改动可能被漏判。该版本没有安装到原生库；新增回归先以accepted而非held失败，再将豁免收窄到实际I/O窗口后通过。最终只读独立审查未发现阻断问题，审查未重复执行测试。

## 本轮技术验证

- `npm run check`退出0：构建、45个合成脚本、519翻译键/41模板绑定、当前配置覆盖的静态/格式/定向类型、打包/有限防漏/基线门禁通过。不是全业务源码类型或安全审计。
- easy脚本共23场景：自身目录/文件回调能完成审阅发布；外部新文件、删除、重命名、设置、图谱变化均阻断；写入时字节损坏及最后回读后的延迟修改均阻断。修复前及过宽修复的RED证据保留。
- easy磁盘脚本4项退出0，包括真实文件关闭编辑、重开、取消不写共享、明确确认后发布，以及既有准备/双端文件交换/选择恢复。
- 设置页浏览器11项退出0：5状态×中英×深浅×宽窄共40种显示组合；真实DOM审阅、取消和确认。此检查注入宿主API，不等于原生Obsidian、iPad或坚果云验证。

私有日志为`.local/native-g1-diagnostic/`下的`regression-green.log`、`late-event-red.log`、`bounded-final-check.log`、`bounded-final-disk.log`和`bounded-final-browser.log`；磁盘目录`disk-brlXms`、浏览器目录`sketch-w11kn0hn`分别位于既有a2-disk/a3-sketch证据根目录。临时诊断代码不进入正式源码或交付包。

## 原生保留现场复验

撤下诊断构建，核对安装最终候选后，用原独立profile重开同一合成库。安装前后合成笔记、data.json及共享文件摘要一致，保留原待审草稿和pending。

1. 普通区仍显示“本机保存的工作需先审阅再发布。”与“审阅并发布”。预览显示原待完成布局及最新草稿。
2. 取消后仍可审阅；使用Windows扩展路径采集的共享清册逐字节一致，两篇合成笔记不变。
3. 重新预览并确认，页面显示“本机布局已保存，当前没有待处理修改。”，主要动作恢复“检查共享布局”。
4. 共享文件由1个变为2个：原bootstrap摘要不变，新增恰好1条布局操作；JSON内容与失败现场导出报告中保留的pending.operation一致，文件摘要吻合，两篇合成笔记不变。

这证明同一失败现场的确认发布已解除阻断。关闭/编辑/开启部分是在前一候选上完成，本轮直接复验保留现场；没有把它写成最终候选上重新完整执行了所有步骤。

确认成功后，准备导出新的同步状态报告时，窗口输入报`failed to activate captured window`；刷新窗口选择并重试一次仍失败，按computer-use恢复规则停止输入。因此没有新的原生导出报告，未据旧报告声称最终pending/layoutDraft字段已核验清空，也未执行原生重开后的持久状态复验。页面及共享文件证据与这一限制分别记录；不将窗口控制错误归为插件故障。

有效清册在原trial的`g1-native/bounded-before-confirm.json`、`bounded-after-cancel.json`、`bounded-after-confirm.json`；比较结果为`.local/native-g1-diagnostic/bounded-native-verification.json`，页面文字为`bounded-native-clean-ui.txt`。私有报告、截图、配置和笔记均不加入公共包。旧短验曾因MAX_PATH漏计文件的清册不作为本轮证据，本轮均使用扩展路径。

## 重开与新报告补验续报

用户要求先补技术验收，需要体验判断时再通知。本轮使用同一独立库及原profile，实际关闭窗口并确认退出后重新启动Obsidian。启动后窗口激活两次失败，暂停UI；用户还原到前台后恢复正常操作，成功导出新的原生同步状态报告。此窗口控制问题未改判为插件故障。

- 重开后的普通区仍为“本机布局已保存，当前没有待处理修改。”，同步保持开启。
- 新报告status为ready，pending、layoutDraft、pendingSave均null；无fault、saveError、attemptConflict或externalPending，共享扫描无blocker、无quarantine。队列未运行、未暂停；其lastResult为启动时的publication-review-required，不能将历史结果字段代替当前待审状态判断。
- 接受历史只有1条操作，接受快照与失败现场保留的pending.proposal完整相同，且与当时最新草稿分组相同；恢复后画布view.groups与接受快照分组一致。布局恢复由新报告核对，不依赖data.json推断；该文件只含此测试库的设置/范围投影。
- 关闭前、重开后及报告导出后的共享目录摘要一致，仍为1条bootstrap与1条布局操作；两篇合成笔记、data.json设置投影和安装main摘要不变，没有重复发布。新报告所列34个运行模块摘要与当前源码逐一一致，且不含临时publicationTrace。

有效文件证据为原trial的`g1-native/reopen-before.json`、`reopen-after.json`及`reopen-final.json`；新报告副本`.local/native-g1-diagnostic/reopen-native-report.json`，自动断言结果`reopen-verification.json`，页面文字`reopen-clean-ui.txt`。全部保留在私有目录。本轮workspace:check退出0，只补原生重开/报告与文件核对，没有重跑上一节完整代码、磁盘或浏览器套件，也没有改动运行源码或候选字节。

已折叠高级区，停在正常同步设置页，等待用户在当前候选上操作“关闭同步→调整图谱并保存→开启→审阅，先取消再确认”。本轮重开技术通过不等于用户体验通过，也未替用户执行此轮体验判断。

## 候选与剩余范围

最终main.js为846298字节，SHA-256：`22c773a72240d49d0607a7bd5e20709874271187868652bfe4ab1f7c03a9b096`。本轮完整检查构建、打包目录及独立库安装一致。候选位于`.local/sync-copy/candidate-publication-bounded-fix-20261126/`，只含三运行文件及摘要，版本仍为0.0.17开发候选，不能覆盖已发布同名资产。

G1的入口与原生确认阻断已技术处置，原生重开和新报告补验完成；待用户判断该提示和审阅过程是否清楚。当前最终候选跨端短验仍沿用[发布准备清单](RELEASE_READINESS_2026-11-25.md)安排。没有验证本轮真实云传输、iPad、规模边界、新用户或远端CI；没有日常库操作、版本/tag调整、推送或正式发布。1.0.0仍未放行。
