# G2：当前候选跨端短验准备与记录

更新：2026-11-26（Asia/Shanghai）。用户已要求开始下一步：统一按钮文案候选，准备Windows ↔ iPadOS / 坚果云短验。源码检查点`0903dbd`，同步体验保持`dddf14a`；本轮不扩展功能、不改运行源码、不触发发布。

## 当前进度

- 三运行文件与dist逐字节一致，main.js为846330字节，SHA-256 `5319a531b26c73e5a1c2f45d8caab53734dfcd109f1a05f40ba5e7175ec6b916`。manifest.json摘要`6ded0d9d7cd88de9cc94f68b133cd3435a0a40818c7220ba33fc2f284a684eee`，styles.css摘要`294298902f12f24aedfa43ab5249d0a60974506747e9b5cec178ae3b60790a5f`。版本仍为0.0.17开发候选，与已发布同名资产不同。
- 保留插件ID `knowledge-graph-smoke`，两个设备使用完全相同的三运行文件。没有套用历史SYNC-UX包的不同插件ID或旧manifest。
- 已准备仅含三运行文件及SHA256SUMS的更新ZIP，以及可选的新iPad合成库模板ZIP；后者10文件，只含相同运行文件、初始中文/范围设置、两篇合成笔记和开始说明。没有复制已用Windows库、设备身份、私有账本、共享历史、报告或同步服务配置。模板未写信任授权。
- ZIP解压CRC、成员白名单及每项解压字节核对通过，两个包中的运行文件一致。新模板的笔记与原Windows合成笔记逐字节相同，包含范围为`Synthetic/**`。
- 用户确认iPad新建独立测试库，使用Nutstore Sync；约三十个旧测试库均保留。本轮PC只复用Knowledge Map Copy Trial，iPad只新增Knowledge Map G2 iPad，其余库不操作。
- 原Windows库更新前清册记录3个共享文件、2篇合成笔记。用户还原窗口后仍有主窗口激活故障，随后用户手动关闭原独立库，工具核对无Obsidian窗口后备份原三运行文件，只替换同一三文件并核对字节。data.json、两篇合成笔记及3个共享文件摘要均不变；安装摘要已为5319a531…ec6b916。
- 使用原profile重开Obsidian 1.15.1，实际看到用户原布局的图谱及正常设置状态。后续准备进入待审状态查看新按钮时，输入再报`failed to activate captured window`，刷新捕获为时间/日期背景，已停止UI；未切换同步或修改布局，新按钮原生显示仍未核对。没有把浏览器显示检查代替该项原生观察。
- 独立PC库当前只安装Knowledge Map，尚未安装/授权Nutstore Sync。建议独立远端名称已生成在私有说明中，没有配置或上传任何远端路径；iPad安装、真实传输和双向/重开短验均未执行。两端Nutstore Sync安装和账号授权交由用户操作。

私有准备清册`.local/g2-20261126/latest.json`，包和模板位于其out所指的`short-qljhqdov`目录。运行文件ZIP摘要为`c017233e1d7c6761ce3409dbda286c29ec896be3136fc7755e9e9599ff6d8b52`，新库ZIP摘要为`424b22b182425af81c3ada585bd26b5c6cd499c94eb121af5f2b6b710b04d0af`；包摘要不等于已安装证明。

PC安装清册为`.local/g2-20261126/pc-install.json`，原三运行文件在`before-pc-update-tik_z841`；重开后文件核对为`pc-reopen-verification.json`。它们不是完整恢复导出，不包含或替代设备私有状态备份。

## 现在需要用户完成的准备

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

只有两端实际安装一致、双向接收和重开得到用户回报后，才更新G2设备验收状态。G3新用户、G4历史边界决定、G5 README最终呈现及G6最终远端门禁仍见[发布准备清单](RELEASE_READINESS_2026-11-25.md)。本轮不操作日常库，不推送、创建tag、发布Release或放行1.0。
