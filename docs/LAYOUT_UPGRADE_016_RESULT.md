# 0.0.15 → 0.0.16 布局连续性修复结果

更新：2026-11-22。状态：**Science and Tech四目标分组的PC日常库恢复、共享发布、iPad接收及双端重开保持已用户验收通过；候选2尚未正式发布。**

后续交接（2026-11-22）：用户明确委托下一位coding agent处理下一部分。专用交接与开场指令保留在本地（不随公开仓库分发）；源码整合与最终实际构建验证的结果见下文「源码整合与最终字节验证」。该交接轮只整理交接与源码检查点，未重新运行产品测试或执行新发布。

用户验收增量（2026-11-22）：PC独立Synthetic Vault中，用户完成新拖动、逐组预览、勾选确认恢复，明确回报恢复与候选一致、重开保持、暂未发现错误，本项用户验收通过。截图中备份目录可见，未独立读取新备份内容。此项不覆盖日常四个真实分组、已加入恢复草稿发布或iPad真机流程，其余待验收范围保持。

真实笔记副本验收增量（2026-11-22）：用户明确找回Science and Tech内四个目标文件夹的原来自定义排列、重开保持、暂未发现错误，本项PC副本验收通过。只读核验保存中心与原记录完全一致，完整15组原始归档保留，恢复前完整配置备份的字节/摘要通过。私有证据在.local/layout-upgrade/daily-copy-zYcruo/user-restoration-verification.json。当时原日常库未安装或确认恢复，原PC已加入会话及iPad流程继续待验收。

原PC安装增量（2026-11-22）：用户明确授权且回报完全退出后，进程门禁通过，完整备份日常库Knowledge Map插件目录4文件，仅替换三运行文件。备份位于.local/layout-upgrade/daily-install-20261122-eyiytzk2/plugin-before；installation.json及independent-verification.json记录全量备份一致、data.json不变、三运行文件与交付候选摘要一致。CSS内容相同，实际内容变化仅main.js/manifest.json；显示名Knowledge Map Layout Recovery Candidate，版本仍0.0.16。未启动Obsidian，未操作App身份/私有日志、共享文件、恢复或发布，iPad未安装。安装后重开、原共享ID核对与Science and Tech历史预览待用户回报；此为文件安装校验，不宣称实际恢复或新的用户验收通过。

原PC预览增量（2026-11-22）：用户确认重开日常库加载恢复候选，自行关闭图谱同步，原共享ID保持不变。Science and Tech历史/候选显示原四目标排列，提示可保留原中心，当前仍为重置排列；用户明确未选择或确认。相关截图为私有验收线索，不随公开仓库分发。下一步保持同步关闭，仅恢复该组选中布局到本机草稿，待用户核对实际位置与重开保持，再另行审阅发布；尚不宣称原库恢复或iPad接收通过。本轮只读代码核对与文档记录，无新产品测试或代理日常库写入。

## 已加入会话恢复阻塞的续验修正

2026-11-22用户在原PC关闭图谱同步、仅选择Science and Tech并确认后，实际仍为重置布局。代理用computer-use复现，设置Details显示 `layout-identity`。原data.json仍与安装前相同；没有启用同步、发布或换文件。只读诊断表达式被DevTools粘贴保护阻止，未绕过，工具已关闭。

独立Windows Obsidian使用既有102笔记副本、原始布局及全新身份重建“以当前布局加入→关闭同步→替换候选1→冷开”，复现同错。接受和显示中均只有1个标题布局，排除了早期“15组旧缓存混入”的假设：`store.state()`为HUD状态，只含groups而不含structures。恢复合并误将显示状态当完整快照，丢失未选择标题分组的身份表，在完整静态校验阶段被拦住，尚未写入恢复备份或草稿。

修正新增 `store.snapshot()` 独立复制完整持久布局，恢复的预览、审阅基线摘要、重验和合并均使用该快照。HUD状态及其复制成本不变，未选组/身份表保留，共享静态/几何校验、备份后变更及另行发布门禁保持。

- 新增完整快照隔离、已加入关闭状态保留未选标题布局的2项先失败后通过；升级/恢复共18项，构建+43脚本通过。日志 `joined-restore-debug/red.log`、`green.log`、`full-test.log`。
- 磁盘3项进程退出/冷开重跑通过：`disk/run-8sGuul/verification.json`。第一次受沙箱硬链接EPERM阻止，实际权限重跑后通过。
- Chrome桌面/窄屏6项重跑通过：`browser-s5rekhgs/verification.json`。第一次沙箱进程阻塞，已核对并仅结束该测试进程后实际权限重跑。
- Windows真实笔记副本实际按钮确认、完整备份11份内容摘要、原有标题身份及接受记录保持、实际图谱与候选一致、关闭同步冷开保持、原配置/连接不变通过：`joined-native-Opv3Tx/verification.json`。早期原生脚本定位独立设置窗口失败、沿用旧renderer引用导致的测量失败均保留；改读当前渲染器后通过，未用测量错误指导产品改动。
- 独立只读审查无需修正的问题，另行检查schema1/2/3快照复制与保留、嵌套隔离和预留锁稳定性。

以上是技术验证；原PC恢复、发布至iPad及重开保持的后续用户验收见下文。

候选2原PC安装增量（2026-11-22）：用户回报已退出，实际权限环境进程门禁通过后，沿用明确授权完整备份插件4文件，再仅替换三运行文件；CSS内容相同，实际内容变化仅main/manifest。安装及独立只读核验均通过，data.json字节/摘要及其余文件不变，三运行文件匹配候选2。备份在.local/layout-upgrade/daily-install-recovery2-20261122-f42a3w9l/plugin-before，installation.json及independent-verification.json为证据。显示名Knowledge Map Layout Recovery Candidate 2，版本仍16。未启动Obsidian、写笔记、操作App身份或共享文件，未执行恢复/发布。本次仅文件安装校验；原PC重新审阅、实际恢复与重开保持待用户回报。

候选2原PC用户验收增量（2026-11-22）：用户确认安装名Knowledge Map Layout Recovery Candidate 2、原共享ID保持不变；确认Science and Tech恢复后找回0.0.15自定义排列，重开后仍保留，明确“这就是想要的效果”。相关截图为私有线索。原PC已加入关闭同步状态的该组恢复/重开保持用户验收通过；不扩展为全部历史组、已发布或iPad接收通过。用户未另行报告错误情况，本轮未代理检查私有日志或运行新测试。下一步导出含当前恢复草稿的完整备份并复制库外，再启用同步、只审阅待发布布局，确认发布及跨端验收留待后续。

发布前审阅增量（2026-11-22）：用户已导出恢复后完整备份并复制到库外，回交待发布预览四图。只读核验最新恢复备份（备份ID私有）及库外备份目录同ID副本，13份内容及manifest完整、逐项字节/摘要匹配，双副本一致且逻辑ID保持。备份接受/草稿各3组，仅Science and Tech记录变化，其他分组及标题身份表完全相同，无设置草稿或pending；恢复中心与原始join-backup一致。证据.local/layout-upgrade/publication-review/backup-verification.json、draft-comparison.json。截图中的最新草稿为已验收排列，当前共享布局仍为重置排列，指引用户点击Confirm后经坚果云传输，再iPad Check for layouts及重开验收。用户尚未回报发布确认或iPad接收；本轮无代理发布、设备操作、日常库写入或新产品测试。

双端用户验收完成（2026-11-22）：用户明确回报坚果云双端同步完成后，iPad共享ID保持不变，四个目标分组恢复原排列，重开后保持不变，并确认“全部是预期的效果”。结合此前原PC恢复与重开保持，Science and Tech四目标的“恢复→备份→审阅发布→外部传输→iPad接收→重开保持”产品验收完成。此为用户真机回报，本轮未重新运行测试或核验私有账本，不宣称iPad已安装候选2或测试过iPad本机恢复入口、全部旧组、并发及新反向编辑。源码整合与正式Release仍单独处理；未执行新的设备操作、库写入、commit/push/Release。

## 根因闭环

旧布局记录按父圆保存归一化坐标及成员半径。即使成员没有变化，内容变化也会改变圆的相对大小。核心 `apply()` 在半径/身份不匹配时安全跳过整个分组；旧版本在显示前调用 `reconcile()` 协调，正式 0.0.16 因接入同步驱动跳过原调用，而未加入状态的宿主没有补上这一步。

在独立 Windows Obsidian 中实际拖动、保存并重开 0.0.15，随后只替换三运行文件：结构相同的正式升级保持布局；给一个同级笔记新增标题、使同组半径变化后，正式 0.0.16 跳过旧布局。相同数据使用修复候选，在挂载前完成本地协调且未加入同步，重开仍保持。这确认的是一条升级回归路径，不声称所有历史失配都由升级导致，也不声称旧坐标数据被删除。

## 实现

- 驱动在挂载图谱前调用 `prepareLocalGraph`，仅对从未加入的状态进行条件保存与本地协调；原始全量布局保留在 `layoutUpgradeOriginal`，失配或畸形记录不删除。已加入（包括关闭同步）继续走共享接受/草稿路径。
- 未加入的普通编辑只验证修改的分组，保留未改变的失配历史；共享快照与远端输入校验保持严格。
- 新增“恢复历史布局”：逐组默认不选择，显示历史、当前和候选，说明原样、调整或无法恢复及移动量。来源可为本机持久原始记录，或用户选择的原始配置/加入备份 JSON。
- 审阅绑定来源摘要、当前配置/布局、图谱 epoch、会话和共享清单；确认前重新计算候选。先完成并读回验证恢复备份，再变更本机布局；已加入只生成持久布局草稿，重新建立未授权自动发布的队列，发布另行审阅。不恢复设置、UI、设备身份或接受账本。
- 不新增共享协议或接受账本格式。核心 `capture(key, includeAutomatic=false)` 增加只读预览用途的可选参数，已有调用语义不变。

## 本轮实际验证

- `npm test`：构建与 **43 个合成脚本**通过，包括新增 **16 项升级/恢复场景**。
- `node scripts/layout_upgrade_disk_check.mjs`：真实子进程分别在备份部分写入、备份完成、草稿持久提交后退出；**3 项**冷开与发布门禁通过。
- `python scripts/layout_upgrade_browser_check.py`：独立 Chrome/IndexedDB 的桌面与窄屏 **6 项**实际按钮流程通过，已目视窄屏预览。不是 iPad 真机结论。
- `python scripts/layout_upgrade_native_check.py`：独立 Windows Obsidian 配置、真实 0.0.15 拖动及升级对照 **4 项**通过。测试启动等待、首次信任提示定位的早期失败已保留，不作为产品通过证据。
- 独立审查发现两项 P2：畸形旧 shape 阻断协调、无关损坏结构表使预览崩溃。均先复现失败、修复、回归通过，审查者独立复核关闭。

本地证据目录 `.local/layout-upgrade/`：`baseline-test.log`、`red.log`、`review-red.log`、`review-green.log`、`final-test.log`、`check.json`；磁盘 `disk/run-cIJfd2/verification.json`；浏览器 `browser-hj92nnpv/verification.json`；原生 `native-ikqm5ebg/verification.json`。原生验证 main.js SHA256：`8c42f8b9fc29c573c3bd9da50b4e3fb21e9c99d824824b448b0f5eb0a60c3b5e`。

## 源码整合与最终字节验证（2026-11-22）

- 整合基线为 HEAD `1c25526`（已含正式 0.0.16 `da0a59f` 全部源码及其后的 README 媒体/文档提交），在独立分支 `layout-recovery-integration` 按 **27 文件白名单**（16 修改 + 11 新增）整合，逐文件 SHA256 与源工作树一致；包含此前已验收的 join identity/current-layout 修正与本轮恢复修正。排除：接手前已截断的 3 个空文件（`LICENSE`、`COMPAT_MATRIX_RESULT.md`、`scripts/package.mjs`，保留 HEAD 版本）、2 个绑定本地证据的一次性候选打包器、专用交接/计划文档（本地保留）及约 180 项历史未跟踪内容。
- 最终构建（与提交 blob 一致的规范 LF 源码）：`dist/main.js` **806991 字节**，SHA256 `62c6aed7012b277c64fbf713ab8dadcaf9c2af863f0db610d3a4645b7910fe87`；`styles.css` 3055 字节 `29429890…`；`manifest.json` 309 字节 `18d11571…`（整合时为 0.0.16；版本决定见下节）。仓库 `.gitattributes` 规定 `eol=lf`：复制源工作字节后的首次构建为 807855 / `127f446b…`（混合行尾），把工作树规范化为提交 LF blob 后重建得到上述规范字节；CI 从提交源码将复现 `62c6aed7…`。
- 与已验收候选 2 字节（807891 / `2248816d…`）的关系：唯一差异是 4 个模块的本地工作副本为 CRLF 行尾——`src/sync/recovery-export.mjs`（36 个 `\r`）、`src/i18n.sync.js`（164）、`src/sync/obsidian-sync-settings.mjs`（166）、`src/sync/obsidian-unified-host.mjs`（534），共 900 个 CR 字节——及其在构建溯源清单中的 4 处摘要。去除 CR 并替换该 4 处摘要后，两份 main.js 逐字节相等——**功能恒等已证明，不宣称字节相同**。
- 对最终规范字节重跑验证（本整合轮新通过）：`npm test` 构建 + **43 脚本**（含 18 项升级/恢复场景，日志 `.local/integration-final-lf-test.log`）；磁盘真实退出/冷开 **3 项**（`disk/run-Y5XDqV`）；Chrome 桌面/窄屏 **6 项**（`browser-_eaa0qfq`）；原生 Windows Obsidian 真实 0.0.15 拖动→正式 0.0.16 对照→修复候选 **4 项**（`native-gcy26xov`，`runtimeSha256` 即 `62c6aed7…`）。此前 `run-aDJJ01`/`browser-bb2kudbe`/`native-tar7z8k4` 为对中间混合行尾构建 `127f446b…` 的重验。磁盘/浏览器/原生检查因沙箱命名管道限制需实际权限运行，与历史记录同类边界。
- 公开文档已脱敏：新增内容不含共享布局 ID、备份 ID、绝对用户路径或日常库名；私有证据仍只在 `.local/`。本地 commit 于整合分支完成；**未 push/tag/Release**。iPad 本机历史恢复入口仍未真机验收。

## 版本决定与 iPad 短验准备（2026-11-22）

- 用户决定：以 **0.0.17** 作为修复发布，Android 适配顺延 **0.0.18**；先在独立 iPad 测试库短验本机历史恢复入口，通过后再经明确授权发布。push/tag/Release/门户尚未执行，仍待最新明确授权。
- 版本升级已本地完成：`manifest.json`/`package.json`/`versions.json` → 0.0.17（minAppVersion 仍 1.6.7）。重建确认 `main.js` 字节不变（806991 / `62c6aed7…`，版本号不进入 bundle）；新 `manifest.json` 309 字节，SHA256 `6ded0d9d7cd88de9cc94f68b133cd3435a0a40818c7220ba33fc2f284a684eee`。`npm test` 构建 + 43 脚本（18 项升级/恢复场景）复验通过（`.local/integration-017-test.log`）。
- iPad 短验包（本地证据，不随公开仓库分发）：`.local/layout-upgrade/ipad-short-verify-017/KM-iPad-Restore-Short-Verify-0.0.17-20261122.zip`，241225 字节，SHA256 `f94c7c7264c519727f71ad94b0f086ef99efbbd4905aee908fd6ab2fa3d41378`，解压读回逐文件摘要一致（回执 `delivery.json`）。内容：即将发布的三运行文件（正式名称与 0.0.17 版本）、START-HERE.md、SHA256.json、合成笔记 Synthetic/A、B、C 与合成历史来源 historical-source.json（取自 `native-gcy26xov` 已验证归档，经契约校验）；全部合成数据，不含私有笔记/配置/身份/日志。
- 同日应用户要求另备开箱即用测试库包：`.local/layout-upgrade/ipad-short-verify-017/KM-iPad-Restore-Vault-0.0.17-20261122.zip`，242029 字节，SHA256 `ea0e67b29e8c6d1795bf2c83400d99efcb342ff94517858343211236bd49ccd5`，12 文件，解压读回逐文件摘要一致（回执 `delivery-vault.json`）。顶层文件夹 `KM Restore Check` 即完整独立测试库：插件三运行文件已装入 `.obsidian/plugins/knowledge-graph-smoke/` 并经 `community-plugins.json` 预启用、`app.json` safeMode:false（沿用 `native-gcy26xov` 已验证配置）、Synthetic 三笔记与 historical-source.json 就位、库内 START-HERE.md 说明；不含 data.json/workspace.json（保持全新未加入状态）。用户在文件 App 解压后以 Obsidian“打开文件夹作为仓库”即可直接测试；原分步安装包仍有效。
- 短验由用户在 iPad 真机执行：全新独立测试库→安装→构图→选择历史 JSON→逐组预览（预期 Synthetic 单组“调整”/移动 3/最大位移父半径 8.172%）→备份并恢复→冷开保持；仅覆盖未加入状态入口，已加入状态的 iPad 本机恢复不在本次范围。通过前维持“iPad 本机历史恢复入口未真机验收”。

## 验收与交付边界

用户旧截图和备份只用作私有证据，没有加入公开夹具或候选。只读管线重建的可恢复性统计是参考，不能替代真实宿主预览和用户判断。本次四目标PC恢复、发布后的iPad接收及重开已获用户明确验收；iPad本机历史恢复入口、全部历史组及并发冲突仍未覆盖，此前普通双向移动的结论不扩展为本轮新反向编辑测试。

日常库仅在用户明确授权并退出后安装上述三运行文件；数据文件保持不变，未操作共享连接，无 commit/push/tag/Release 操作。独立 worktree 保留现有候选基础及本轮增量，原源码工作区现场不变。交付步骤见 [验收指南](LAYOUT_UPGRADE_016_GUIDE.md)。

候选包：`.local/layout-upgrade/PC-iPad-Layout-Recovery-20261122-1.zip`。严格白名单为三运行文件、START-HERE.md、SHA256.json；安装显示 **Knowledge Map Layout Recovery Candidate**，ID不变、版本号仍16、isDesktopOnly=false。main807758字节与上述原生验证摘要一致；ZIP SHA256为 `0571e9724533a903870820a795979aa7d25165a086ce4703ba7fba4edc0f2043`。不含配置、密钥、身份、私有日志、截图或报告。打包回执 `.local/layout-upgrade/delivery.json`。

续验使用候选2：`.local/layout-upgrade/PC-iPad-Layout-Recovery-20261122-2.zip`，显示名 **Knowledge Map Layout Recovery Candidate 2**，同ID/版本16。main807891字节，SHA256 `2248816dca7e6ec62f225e92acf6c563fc168689f25d35c4760d16aec0797438`；ZIP SHA256 `c6b3ba4a2bfde10027889697867344901302b2907af513846308e7d0f22fb9a9`。相同五文件白名单，无配置或私有证据，回执 `delivery-2.json`。候选1保留作复现证据，已知上述恢复缺陷，不用于继续验收。
