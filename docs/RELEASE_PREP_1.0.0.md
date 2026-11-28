# Knowledge Map 1.0.0 发布准备

日期：2026-11-28（Asia/Shanghai）。GitHub正式发布、三资产下载核对及社区1.0.0审核/公开条目更新均已完成，G6关闭。G3独立新用户试用按用户决定后置，其他已披露边界保留。

## 正式发布结果

用户明确回复“确认发布”，授权合并main、推送1.0.0 tag、正式Release及现有社区条目收尾。[PR #1](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/pull/1)按预期head 1138d83合并为e17f44d，合并树与已批准候选完全相同；[main CI](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/actions/runs/46094798473)成功。固定tag `1.0.0`指向e17f44d，未移动旧tag或覆盖旧Release；本地活动分支仅快进，5025工作区保留。

[正式Release](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/releases/tag/1.0.0)于2026-11-28 09:50:45（Asia/Shanghai）发布，非draft、非prerelease。[正式流水线46095082819](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/actions/runs/46095082819)全部成功，包含构建来源证明和三资产白名单回读。实际下载main.js、manifest.json、styles.css，逐字节等于下节冻结值、本地交付包及iPad回传安装文件；分别846913、308、3055字节。tag/默认分支manifest均为1.0.0。

用户登录社区后，在原条目请求Check for new releases；门户识别manifest 1.0.0，先排队，随后版本1.0.0/commit e17f44d的审核显示Completed，Current release更新为1.0.0。main.js与styles.css的GitHub来源证明均Pass，无漏洞依赖与无混淆检查Pass，Build verification明确逐字节复现正式main.js。没有阻断错误；保留Vault Enumeration与Local Storage两项Recommendation，以及src/host.css:56中display:contents对Obsidian 1.6.5部分支持的既有Warning。未为消除非阻断提示改变功能或最低版本声明。

社区[既有公开条目](https://community.obsidian.md/plugins/knowledge-graph-smoke)已实际回读Current version 1.0.0，Add to Obsidian入口存在。只将原998字符的0.0.17长说明更新为1000字符的1.0.0说明，保留一键流程、范围/备份与平台边界；短说明、Visualization/Outlining分类、Free类型及原图标保留，未新增截图或申请权限。保存后公开About逐字回读一致。README已同步新稿，6份媒体均加载成功；布局GIF源为knowledge-map-layout.gif?v=20261127-avoidance，自然尺寸1100×688，与你验收的引用一致。公开评分仍为Health Excellent / Review Satisfactory，不将其扩大为全面安全或设备认证。

下方保留准备、复核与安装证据；其中原先的“未发布/待授权”是正式授权前的执行记录，当前状态以上节正式结果与TODO为准。

## 授权与范围

用户已确认GIF通过，G5关闭；明确将两位独立新用户试用后置，接受本轮缺少该证据，并要求继续G6发布准备。此前有条件的发布意向保留，不能将未完成的技术验证写成通过。活动分支`codex/baseline-convergence`、工作区5025不变。

G3记录为明确后置，不写成试用完成。原计划核对及既有证据见[最终门槛核对](RELEASE_GATE_REVIEW_2026-11-28.md)。本批不新增功能或重做同步机制，不操作日常库。

## 版本与候选

manifest、package、package-lock根及根包版本、versions映射和BASELINE运行版本已统一为1.0.0；最低Obsidian保持1.6.7，插件ID不变。基线合同仅将严格期望版本0.0.17改为1.0.0，固定体验/恢复/已发布参考commit和一键模式保持。现有版本合同先按新版本运行失败，再更改严格守卫后通过，没有放宽为任意版本。

[正式说明](RELEASE_NOTES_1.0.0.md)及README/安装/同步指南只校准发布版本上下文，保留G5已验的产品文字和GIF。文档不预报社区或远端验证已通过。

重新构建的main.js仍为846913字节，SHA-256 `5fca5ac3c9ac2d73e23887105754bd210a7e5fcdbeae30ccf44d0bf050e2e9a7`；styles.css仍为`294298902f12f24aedfa43ab5249d0a60974506747e9b5cec178ae3b60790a5f`。这两份运行资产与G4用户验收候选逐字节相同。manifest仅version从0.0.17改为1.0.0，不由版本号推断其他资产相同。

1.0.0 manifest SHA-256为`39021d32bcb96601234ffc5db8a3ced0c320b6dea6ada176ca922cdb68a80da7`。私有runtime ZIP为247266字节，仅三运行文件与SHA256SUMS，不含配置、身份或账本；正式Release仍只附三运行文件。Release工作流新增保留7天的同一三资产artifact，供手动演练后下载逐字节比较，既有tag触发、只在tag推送时发布及拒绝覆盖规则不变。

## 执行清单

- 已完成：G3明确后置记录、版本/严格基线守卫、发布说明、首次构建与运行代码不变核对。
- 已完成：完整check和test:clean退出0（构建及46个合成脚本等门禁），干净导出main与当前冻结字节相同；最终白名单打包及runtime ZIP的CRC/摘要核对。一次独立复核已完成，发现的文档路径遗漏已按下节修正并完成RED/GREEN、完整check及干净导出复验。
- 已完成：候选源码提交58c004c及专用codex分支推送；该提交的[远端Checks](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/actions/runs/46089719835)成功。防漏修正340171d亦已推送，其[远端Checks](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/actions/runs/46090744095)独立成功。
- 已完成：用户完成登录后，从候选分支手动触发[Release演练46092147436](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/actions/runs/46092147436)，精确源码340171d，输入1.0.0，事件workflow_dispatch；构建、检查、三资产打包及来源证明步骤成功，正式发布/Release资产回读步骤均跳过。下载artifact 15242071568，ZIP摘要与GitHub记录一致，CRC通过，恰好main.js/manifest.json/styles.css，全部与本地冻结文件及交付包逐字节相同。
- 已完成：PC原独立测试库三文件升级至1.0.0，原profile保留；原生设置实际显示v1.0.0并启用，原同步设置保持“本机布局已保存，当前没有待处理修改”，重新打开图谱仍为A左上/B右下。14份合成笔记/说明/共享JSON摘要保持，安装三文件等于本地和远端冻结值。此次未再拖动或传输，不冒充双向同步重新验收。
- 已完成：用户回传iPad安装后的测试库ZIP及插件列表截图，明确确认替换并显示v1.0.0，截图中Knowledge Map处于启用状态。仅定向读取其中插件目录的main.js/manifest.json/styles.css（各条目CRC通过），三份字节均与本地冻结、PC实际安装及远端演练记录一致，补齐当前缓存候选iPad运行字节证据；包内账号配置/设备身份/私有账本未检查。未由版本截图推定新一轮拖动、传输或冷启动体验通过，已有功能验收按原日期保留。
- 已完成：正式1.0.0 tag/Release及实际三资产下载核对、社区新版本检查/自动审核和原条目更新回读，见本页正式结果。未新申请同ID插件，未移动旧tag或覆盖旧Release。

默认分支对齐已整理为[发布PR #1](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/pull/1)，base main保持db835e1，未合并；GitHub确认无合并冲突。最终完整本地check再次退出0，安装证据文档提交76b4d06的[分支CI](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/actions/runs/46093795136)通过，PR独立检查及后续文档提交检查以PR当前结果为准。演练340171d之后仅TODO/准备记录变化，运行源码/工作流/三资产未变；没有重复演练同一运行字节。G6准备材料已具备审阅条件，正式合并main、推1.0.0 tag触发Release及社区操作留待用户最终明确授权；不从原交接push授权推定正式发布。

本地冻结核对：首次11份受影响文档133个本地链接检查通过；版本/lock/映射/BASELINE一致，固定来源不变；三资产与包内摘要相同，GIF摘要保持。Release YAML已解析核对，artifact仅取release/assets、保留7天，并按run_attempt区分重跑，避免覆盖前次证据。

远端ZIP为249638字节，SHA-256 `2f63fc26cef2d8676cd35ee148c04c231c31abda77521bfa0c02fee2bae852eb`，保留至2026-12-05；ZIP编码/压缩与本地交付ZIP不同，不能比较压缩包摘要来代替三文件字节比较。本次已实际逐文件比较全部内容，无差异。

PC安装过程先停用Knowledge Map，备份旧三文件，再替换候选三文件、重新扫描清单并启用；Nutstore Sync未停用/改配置。原设置窗口为独立原生窗口，首次操作错误目标只切回主画布，未改变插件或布局，定位设置窗口后完成操作。保护摘要首次因Windows长路径读取失败，改用扩展路径后完整采集14份，再执行替换；未把失败的预检记作通过。此次是插件卸载/重载后的原生检查，不宣称整应用冷启动已重测。

## 独立复核与修正

一次独立复核未发现Critical问题；Important为旧归档TODO仍含本机用户目录和测试同步映射，原防漏脚本仅扫源码/运行文件而未覆盖文档。复核结束前专用分支推送已经完成，属于执行顺序遗漏；正式tag/Release未创建。现以普通后续提交将归档中的目录和映射改为占位符，并把docs（含archive）及根用户文档纳入守卫。新增真实CLI正反例：旧脚本对归档样本未拒绝，扩展后能拒绝归档/README中的用户目录，脱敏样本通过。现场守卫也曾正确拒绝原归档，脱敏后通过219份公开文件；这仍是有限防漏检查，不是完整秘密审计。

修正后完整check与test:clean均退出0，三运行资产摘要保持上节冻结值。Minor为DEVELOPMENT与RELEASE_CI的旧版本上下文，已局部校准；不改既有用户验收文字或功能。历史提交中的原始路径仍可能被检索到，普通后续提交不消除历史；没有擅自改写远端历史。

复核提出的远端演练/字节核对和PC/iPad安装对齐已完成；用户正式授权后的默认分支对齐、tag/Release和社区条目更新/回读也已完成，G6关闭。G3由用户明确后置；大历史原生性能、Android/iPhone等既有边界继续保留，不扩展本轮范围或开启重复优化/复核。

## 工具与保全

GitHub连接可做只读运行/资产核对，但当前工具未提供workflow dispatch；本机gh不在PATH。最终由浏览器页面选择候选分支/1.0.0并提交演练，页面明确成功排队，随后连接器核对精确源码运行成功并下载产物。下载本地产物遭沙箱网络阻止后获准重跑成功，未扩大账号权限或建立新凭据。

私有原件、升版前文件、资产摘要、RED/GREEN日志及执行账本保存在`.local/g6-100`，不进入公开包。用户库/身份、App私有状态与服务账号不复制到候选包。
