# G2：当前候选跨端短验准备与记录

更新：2026-11-26（Asia/Shanghai）。用户已要求开始下一步：统一按钮文案候选，准备Windows ↔ iPadOS / 坚果云短验。源码检查点`0903dbd`，同步体验保持`dddf14a`；本轮不扩展功能、不改运行源码、不触发发布。

## 最新补充：自动更新验收重新打开

2026-11-26用户补充首次iPad→PC需关闭图谱标签并重新建图才更新，第二轮自动更新顺畅。此前最终一致及重开证据保留；不得再据此前“暂无异常”判自动更新通过。已用iPad库压缩包补齐原候选三资产字节核验，两端当前8份共享文件与两篇笔记相同；截图及包还证明说明文件/诊断报告实际进入传输，原“报告留本机”仅为准备建议。已复现并修复同类范围外笔记失效缺陷；随后接收链组合回归通过，e236fdc9修复候选已安装PC并原profile重开、布局保留、设置无待处理修改，笔记及8份共享文件未变。PC端Nutstore公开manifest为1.6.2；iPad暂沿用原候选作为发送端，专测PC接收，尚未记用户云端验收通过。历史当次根因未唯一定因。最新状态及验证见[调查与修复](SYNC_LIVE_UPDATE_RESULT_2026-11-26.md)。以下准备与首次回报保留原时点。

## 原候选准备进度

- 三运行文件与dist逐字节一致，main.js为846330字节，SHA-256 `5319a531b26c73e5a1c2f45d8caab53734dfcd109f1a05f40ba5e7175ec6b916`。manifest.json摘要`6ded0d9d7cd88de9cc94f68b133cd3435a0a40818c7220ba33fc2f284a684eee`，styles.css摘要`294298902f12f24aedfa43ab5249d0a60974506747e9b5cec178ae3b60790a5f`。版本仍为0.0.17开发候选，与已发布同名资产不同。
- 保留插件ID `knowledge-graph-smoke`，两个设备使用完全相同的三运行文件。没有套用历史SYNC-UX包的不同插件ID或旧manifest。
- 已准备仅含三运行文件及SHA256SUMS的更新ZIP，以及可选的新iPad合成库模板ZIP；后者10文件，只含相同运行文件、初始中文/范围设置、两篇合成笔记和开始说明。没有复制已用Windows库、设备身份、私有账本、共享历史、报告或同步服务配置。模板未写信任授权。
- ZIP解压CRC、成员白名单及每项解压字节核对通过，两个包中的运行文件一致。新模板的笔记与原Windows合成笔记逐字节相同，包含范围为`Synthetic/**`。
- 用户确认iPad新建独立测试库，使用Nutstore Sync；约三十个旧测试库均保留。本轮PC只复用Knowledge Map Copy Trial，iPad只新增Knowledge Map G2 iPad，其余库不操作。
- 原Windows库更新前清册记录3个共享文件、2篇合成笔记。用户还原窗口后仍有主窗口激活故障，随后用户手动关闭原独立库，工具核对无Obsidian窗口后备份原三运行文件，只替换同一三文件并核对字节。data.json、两篇合成笔记及3个共享文件摘要均不变；安装摘要已为5319a531…ec6b916。
- 使用原profile重开Obsidian 1.15.1，实际看到用户原布局的图谱及正常设置状态。后续准备进入待审状态查看新按钮时，输入再报`failed to activate captured window`，刷新捕获为时间/日期背景，已停止UI；未切换同步或修改布局，新按钮原生显示仍未核对。没有把浏览器显示检查代替该项原生观察。
- 准备轮PC库只安装Knowledge Map；两端Nutstore Sync安装和账号授权已交由用户操作，Codex未配置或上传远端。用户后续回报准备完成见下节，不沿用此前“尚未安装”作为当前用户状态；真实双向/重开结果仍待回报。

私有准备清册`.local/g2-20261126/latest.json`，包和模板位于其out所指的`short-qljhqdov`目录。运行文件ZIP摘要为`c017233e1d7c6761ce3409dbda286c29ec896be3136fc7755e9e9599ff6d8b52`，新库ZIP摘要为`424b22b182425af81c3ada585bd26b5c6cd499c94eb121af5f2b6b710b04d0af`；包摘要不等于已安装证明。

PC安装清册为`.local/g2-20261126/pc-install.json`，原三运行文件在`before-pc-update-tik_z841`；重开后文件核对为`pc-reopen-verification.json`。它们不是完整恢复导出，不包含或替代设备私有状态备份。

## 用户准备回报与本次短验

2026-11-26用户回报“两端准备好了”，提供iPadOS 26.5.2、Obsidian 1.15.1（404）、Nutstore Sync v1.6.2，并询问PC库名。已明确本轮配对为PC的Knowledge Map Copy Trial与iPad的Knowledge Map G2 iPad。版本来自用户回报；本轮未新增iPad运行文件/首次传输核验，也未将该Nutstore Sync版本推定为PC端版本。iPad机型本轮未补报。

后续已完成PC→iPad、iPad→PC及两端重开短验。双向和iPad重开来自用户明确回报，PC重开由Codex受托原生补验；分项证据见下节。本轮未运行新的工程套件。

## PC→iPad用户验收结果

2026-11-26用户明确回报：两端布局同步开启，PC已经结束调整，PC和iPad坚果云同步均完成，两端位置一致且无异常提示，称“同步成功”；用户说明PC保留该布局，未再修改。按这个方向和场景记录用户验收通过。

用户截图1是开启时的准备页，显示awaiting-transfer及“本机已准备好”，不据此推断传输后仍卡在该状态。截图2是同步完成后的最终图谱，Synthetic中B在上、A在下。未取得同步完成后的iPad状态报告，不将截图写成最终clean或无待审字段的技术证明；两端位置一致和无异常来自用户明确回报。原截图仅留本机，不纳入公共交付包。

本轮只读补采PC共享目录及两篇合成笔记摘要：安装main仍为5319a531…ec6b916，笔记与上一阶段一致，原3个共享文件均未变，新增恰好1条attempt记录，当前共享文件共4个。补采没有移动圆、切换同步或写测试库文件。证据为原trial的`g1-native/g2-pc-to-ipad.json`及`.local/g2-20261126/pc-to-ipad-verification.json`；文件清册支持PC写入事实，不单独证明iPad已接收。

该方向的用户验收通过保留；后续反向和重开结果如下。

## iPad→PC与两端重开结果

2026-11-26用户明确回报：在iPad移动一个圆并结束调整，经坚果云上传、PC下载后同步成功；iPad重开Obsidian后图谱无变化，暂无异常。新截图显示Synthetic中B在左、A在右，两圆位于父圆下部。按该方向及iPad重开场景记录用户验收通过。用户已经关闭PC测试库，因忘记路径而明确委托Codex重开并判断，不要求用户重复双向移动。

工具先核对没有运行中的Obsidian窗口，用原独立profile重开同一Knowledge Map Copy Trial / Windows Obsidian 1.15.1；实际画布B左/A右，与用户iPad截图一致，5节点/1关系。设置同步保持开启，显示“本机布局已保存，当前没有待处理修改。”。成功导出本轮新状态报告后关闭设置页，将图谱保留打开。没有移动圆、切换同步、重建图谱、改运行文件或读取Nutstore账号配置。

PC技术补验：

- 重开前、重开后及新报告导出后的共享目录摘要完全一致，均7个文件，两篇合成笔记及安装main摘要不变；该次重开未新增共享发布记录。
- 新报告status为ready，pending、layoutDraft、pendingSave均null，无error/saveError/attemptConflict/faulted/externalPending，共享扫描无blocker或quarantine。
- 共享扫描得到5条有效布局操作，ID集合与接受历史一致；使用原只读历史投影得到的快照等于接受快照，画布view.groups也等于该快照。恢复分组中B.x小于A.x，与原生观察一致；没有把离线投影写回视图。
- 新报告所列34个运行模块摘要逐项匹配当前源码，安装main仍为5319a531…ec6b916。iPad本轮未单独导出运行摘要，PC端Nutstore版本也未核对，不将已提供包的摘要写成iPad实际安装摘要。

私有证据：原trial的`g1-native/g2-reverse-before-reopen.json`、`g2-reverse-after-reopen.json`和`g2-reverse-final.json`；`.local/g2-20261126/pc-reverse-reopen-report.json`、`pc-reverse-reopen-verification.json`、`pc-reopen-graph-ui.txt`、`pc-reopen-clean-ui.txt`。报告原件留在独立库，截图/配置/私有原件不公开。额外生成的状态报告属于本机诊断文件，不计作共享布局操作。

当时按已收到的回报记录小规模双向布局修改及两端重开；后续补充自动更新异常，当前不能将G2整体关闭：PC→iPad、iPad→PC及iPad重开由用户确认，PC重开由Codex原生技术补验。它不证明任意规模、所有异常恢复、长期稳定性或所有设备均通过。新按钮文案本轮状态为clean，未触发待审页面，因此未另记新按钮原生显示通过。

## 已交给用户的准备步骤

1. iPad按自己熟悉的方式，将提供的全新合成库模板放入本地Obsidian库目录并打开Knowledge Map G2 iPad。确认插件实际路径为`.obsidian/plugins/knowledge-graph-smoke/`，main.js为846330字节，标准文件名未变；若出现信任或第三方插件提示，由用户检查确认。
2. 在PC的Knowledge Map Copy Trial及新的iPad测试库安装、授权Nutstore Sync。两端选择同一个本轮独立远端目录，使用双向同步。本轮先手动触发，观察首轮操作预览及完成结果。Nutstore Sync的双向策略、远端目录选择、操作预览和配置目录选项已核对[官方说明](https://github.com/nutstore/obsidian-nutstore-sync#readme)。
3. 本轮传输范围收敛为Synthetic及Knowledge Map Sync两个目录，Obsidian配置目录不同步；PC库内已有的Knowledge-Map-Sync-Report文件保留本机。首次预览核对传输清单和实际目标目录后再传输，不通过复制已用PC库或私有状态完成iPad初始化。
4. 两端均能打开图谱且首次文件传输完成后，回报“两个测试库已准备好”，附iPad机型、iPadOS、Obsidian及Nutstore Sync版本。再逐项执行下面的PC→iPad、iPad→PC及重开短验，尚未到这一步时不标设备通过。

## 安装与短验顺序

1. Windows候选安装及原profile重开已完成，原布局保留；新按钮原生显示仍待补看。
2. iPad：用户已选择全新独立库。安装同一三文件，确认实际加载的文件、笔记范围和图谱，再开始移动。
3. 外部传输：在用户使用的Nutstore Sync中配置本轮独立远端；笔记和`Knowledge Map Sync`文件夹在两端传输。本轮不要求用户手动新建共享图谱或核对ID，不把整份已用Windows库/profile复制到iPad。
4. PC移动一个圆并结束调整，等待传输完成，确认iPad显示相同位置。
5. iPad移动另一个圆并结束调整，等待传输完成，确认PC显示相同位置。
6. 两端关闭重开，确认两次位置修改均保留、无意外待审或重复发布；记录设备/Obsidian版本及用户结果。

首次加入继续采用每台一次布局同步开关；已有不同布局或冲突仍按原预览由用户决定。历史dddf14a双向/重开及G1用户流程通过继续保留，不机械重做全套历史验收。

## 证据与放行范围

本轮workspace:check通过，交付包进行上述实际字节/成员核对。源码没有变化，上一轮完整check及浏览器11项/40组合来自[按钮文案记录](SYNC_PUBLICATION_ECHO_RESULT_2026-11-26.md)，未在本轮重复计为新跑。

当前最终一致及重开分项证据保留，自动更新项已重新打开。iPad已用库包的原候选三资产现已核验；本次修复尚未安装或跨端复验，正式冻结/发布时仍需让最终源码、两端安装与构建资产对齐。G3新用户、G4历史边界决定、G5 README最终呈现及G6最终远端门禁仍见[发布准备清单](RELEASE_READINESS_2026-11-25.md)。本轮不操作日常库，不推送、创建tag、发布Release或放行1.0。
