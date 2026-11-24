# G7 iPad R2分段验收记录

2026-11-21。原iPad P1现场及未归因结论保留，R2是独立新库，程序未改动，不代表修复原问题。

建立状态：用户启用时保存一次，关闭同步后另拖动保存；1报告/2图9组只读核验通过。证据`.local/sync-016/g7/ipad-r2-setup-20261121-M3q8Zs/verification.json`。新逻辑ID`626bf9f0cc9cbc0f1c6fe6c1c64cb9d0`，安装`269397d8fe05f047b7db3c537340c9d5`。完整build匹配G7，mobile=true/Obsidian1.15.1。三笔接受操作及指纹独立重算一致；独立草稿`1a24ea3f810cbf36b30188b98fa0eb08`、revision3，基线为当前接受，view与全草稿相同。截图1A组First上/Second下、B组Third左/Fourth右；截图2A组Second左/First右，B仍Third左/Fourth右。完整坐标同时记录A调整和B.Fourth轻微变化，不能假设只改一组。

当前local-ready、publication=null、生产状态disabled，无错误/未保存/pending/隔离，私有36154字节39文件22事件完整未暂停，报告共享仅3接受操作摘要/长度匹配。核验只读报告/图片和源代码验证器，未读取iPad实盘或新增运行套件。

下一步保持关闭，同一设置页完成恢复备份和明确草稿兼容导出，先取消再确认。预览应为A组Second左/First右、B组Third左/Fourth右；完整恢复及兼容目录原位保留、另复制库外，回交实际导出目录压缩包和取消/确认报告。暂不切正式版；随后将使用独立01-FORMAL包并在编辑前确认实际加载名称/设置与已安装文件，再继续旧版编辑重开及返回候选。

2026-11-21 R2明确兼容导出：2报告及外部复制ZIP/截图6组只读核验通过。原身份/连接/完整接受/草稿/view/build/sequence22及库存保持，无错误/pending/运行发布；取消与确认只时间和瞬时队列提示变化。完整恢复ba08e7f01a8f6f04083c37839a326818含13正文/11071字节，经生产逐份长度/SHA核验；兼容daa60aefe04dbf4cbf5a9d58d7df3a72的data.json为2070字节，SHA`5ae7644668414514cc72f41877e1fcca2dea1b1f86d68779a8099ee26f3498cc`，生产读回等于R2完整草稿及有效配置/UI/未知字段，A Second左/First右，B Third左/Fourth右。外部目录复制后改名不影响完整正文，用户确认库内原件保留。私有证据`.local/sync-016/g7/ipad-r2-export-20261121-44_2qmi5/verification.json`。

正式版核对准备：同目录新增R2-FORMAL-INSTALL.zip，仅4文件，正式发布main/manifest/styles及上述R2确切compatibility data.json，CRC和逐字节检查通过，摘要见install-verification.json；包含用户本地配置，私有保管，不公开。下一步完全退出Obsidian并外备整个R2插件目录，复制包内4文件覆盖R2同一目录后重开构图；实际插件应名Knowledge Map、无图谱布局同步设置，图谱仍为所选R2草稿。先回交实际插件目录4文件ZIP及图谱/插件名称或设置截图，再允许旧版编辑。勿从安装源包重复打包当作已安装证据；原iPad/PC/G6保持，未改产品代码/运行测试或代签加载成功。

2026-11-21实际加载检查阻塞：用户回交外备/Replace窗口/图谱/设置4图，但未回交实际目标目录4文件ZIP。图谱符合R2草稿并不能区分版本；设置图明确仍为Knowledge Map G7 Candidate，顶部完整“图谱布局同步”及启用同步/状态导出按钮可见，正式版加载未通过。Replace图显示正确源文件大小，但弹窗未关闭、右上角勾号存在且目标路径未显示，不能证明复制落盘或实际重启。证据`.local/sync-016/g7/ipad-r2-load-block-20261121-ppqv3wjt/inspection.json`。下一步只读取R2当前实际插件目录4文件副本和路径，先区分磁盘覆盖与程序加载，勿继续编辑/覆盖或恢复，不归因具体用户操作或程序缺陷。无新运行套件/用户库或源码改写。

2026-11-21已安装目录ZIP定位：四文件CRC及逐字节比对表明全部等于初始R2候选包（main770208/manifest240/styles3055/data1677字节），没有包含正式版运行文件或选中的R2兼容data2070字节。候选设置画面与磁盘副本一致，故本次R2覆盖没有落到所发目录，不能只归因进程未刷新；具体复制目标、是否完成操作仍待核对。用户文字路径在iPad与R2间含斜杠，与交付单层库名不同，但截图只有Copy File Path菜单，不显示结果，不能判断实际嵌套或文字整理。请求原样粘贴路径及确认所开R2库；路径明确后再覆盖4文件并看目标页416KB main/309B manifest，未开始旧版编辑。证据`.local/sync-016/g7/ipad-r2-installed-check-20261121-zvbgpo88/verification.json`。不重做前段，原库/备份保持，无产品代码改动，旧iPadP1具体原因未被本次证明。

2026-11-21库名确认：用户确认单层R2目标路径，截图底部明确Knowledge Map G7 iPad R2（R2自动换行）。Taio路径复制插斜杠为用户回报，未独立验证，不再据文字差异判断错库；证据`.local/sync-016/g7/ipad-r2-vault-confirm-20261121-2wd4xso7/inspection.json`。下一步只重做四文件复制落盘：退出、用新解压已校验正式安装包，向已确认R2插件目录复制并完成重名对话框确认，回目标页检查main416KB及manifest309B/Knowledge Map；先收目标页文件证据再重开，仍候选则不进行旧版编辑。无新构建/测试或用户库写入。

2026-11-21目标四文件外观检查完成：用户未开Obsidian，用Keep Both得到新旧8文件后删旧并将新4文件还原标准名称；终图仅4文件，main416KB、manifest309B/Knowledge Map、data预览g7Unknown/layoutOverrides，符合正式包特征。未再次取得最终正文SHA，实际加载待验。4图及边界归档`.local/sync-016/g7/ipad-r2-formal-files-20261121-g1m3kyx7/inspection.json`。Taio Replace未生效是用户观察，不认定第三方App根因；ZIP保留文件mtime与解压目录Created不同属可发生情况，不以时间证明版本。下一步重开R2构图，核对实际名称Knowledge Map、无布局同步区域、A Second左/First右及B Third左/Fourth右，回交两图后再旧版编辑；当前不再重做文件复制，旧库与全部备份保持。

2026-11-21正式界面加载确认：用户重开R2构图，2图显示原所选Second左/First右、Third左/Fourth右；插件设置名称Knowledge Map，设置底部结束后无图谱布局同步区域。结合前次目标文件416KB/309B图，本次正式版实际UI检查满足，覆盖/加载阻塞解除。证据`.local/sync-016/g7/ipad-r2-formal-ui-20261121-t4p6kp5j/inspection.json`。最终改名后文件字节/SHA与进程遥测未取得，结论限用户确认/界面证据；旧iPadP1和第三方App具体缺陷仍未定论。下一步在正式版改一个标题、结束调整、完全退出重开确认保留，再退出并从实际R2插件目录另复制data.json为R2-旧版期间新工作-iPad.json，回交原文件与图后才返回候选。无新运行套件或源码/用户库改写。

2026-11-21正式版新工作核验：1原JSON/3图5组核对通过，用户确认First改至Second上并完整退出重开保留。实际保存文件3222字节、SHA`919f791a9b29c948df1541b61b9b0a103a2175c71cbe08038e7eeacce87599fd`，schema3/revision5，A从原草稿横排变纵排，B完整几何及structures保持，全部有效配置/UI/未知字段与兼容导出相同，非初始配置。证据`.local/sync-016/g7/ipad-r2-formal-work-20261121-o6ae_3xk/verification.json`，旧工作原件已私有归档。返回候选三文件ZIP CRC及精确摘要也复核，无data.json。下一步只替换候选三运行文件，保留实际正式新工作data.json和App私有日志，构图应读回原候选草稿Second左/First右、Third左/Fourth右，原ID626bf9f0cc9cbc0f1c6fe6c1c64cb9d0、同步关闭；回交返回候选报告/两图。重开无进程遥测，回升/整体待验，旧iPadP1不据此归因。无新产品代码/运行套件或用户库写入。

2026-11-21返回候选最终回执：用户仅换3候选运行文件，保留正式版新工作data.json，重开R2构图恢复原草稿、原ID及同步关闭；1报告/4图8组只读核验通过。证据`.local/sync-016/g7/ipad-r2-return-20261121-H6w2Cq/verification.json`。原安装、逻辑ID、完整接受3操作/指纹、草稿1a24ea3f…、完整groups/revision3及build保持；Undo会话重置、idle提示正常。local-ready、队列unarmed/non-running，无保存错误/pending/隔离；草稿待审提示不是自动发布。私有40016字节/41文件/23事件完整未暂停，sequence22至23未读单事件归因。先前上传的完整恢复和兼容输出再经生产读取核验匹配原草稿；旧版工作JSON仍3222字节/SHA919f791a…，原附件及私有副本保持，与候选草稿不同。共享库存仍原3接受正文。回升后的实际旧版data.json留存依据用户明确回报和文件图的10:26/3KB预览，未再次取得该目标正文/运行文件SHA；无进程遥测。

本轮R2的新状态、明确导出、实际正式界面/编辑完整重开、旧工作文件保全及返回候选功能流程完成，与PC轮次共同形成G7本轮功能闭环。未追认原iPad首轮异常通过或认定其具体操作原因，R2实际覆盖未落盘已单独取得文件证据并解除，Taio是否缺陷未独立复现。实际耗时/资源和用户总体体验判断、P2/P3/G8/发布仍保留。当前保持R2/PC同步关闭、全部旧库/备份/未提交未跟踪保留，无新产品代码或运行套件、无commit/push/升版/发布。
