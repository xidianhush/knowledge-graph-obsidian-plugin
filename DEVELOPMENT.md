# Clone 后开发与验证

2026-11-21 最新：G8统一候选已冻结，见[结果](docs/SYNC_G8_RESULT.md)和[短验](docs/SYNC_G8_GUIDE.md)。默认 `node scripts/build.mjs` 现使用统一同步宿主生成器，与候选main逐字节一致；默认构建+40脚本及独立磁盘/DOM/Windows原生短验通过。正式版本仍0.0.15，未发布同步版；近保护暂停样本冷开超调查线、R7/R8 P1及用户总体体验待决定。旧进度如下保留。


2026-11-17 最新：[UI2两端验收完成](docs/SYNC_G4_UI2_ACCEPTANCE.md)，用户确认不先建图/检查即可正常，后续图谱仍原布局。2报告/2图19项通过，build匹配7415bc13…，原25操作完整接受凭据/身份/连接保持；历史held仍保留但两端显示推导saved，无待办或错误。仅回执/归档/文档，无新运行套件或发布。G4本轮修复续验收尾，建议下一步G5损坏与失败恢复，P3超长消息及G5–G8/发布门禁保留。以下为历史。

2026-11-17 最新：[UI2误暂停技术修复](docs/SYNC_G4_UI2_FIX_RESULT.md)完成，待用户设置先开验收。无待办的过期review held按源过滤，保留真实错误、pendingSave和closed门禁，不改授权。专项8组/默认35脚本/浏览器12组/实际Windows完整退出先开设置5项通过，独立审阅无剩余项。main7415bc13…，g4-ui2-update-nsap8qgq已核验；两端原G4三运行文件更新后回交2报告/截图，不重做同步。UI1/FB2/FB5验收及原25操作现场保持，P3/G5–G8/发布门禁保留。以下为历史。

2026-11-17 最新：[UI2补图核验](docs/SYNC_G4_UI2_INSPECTION.md)8项通过，原PC打开图谱后view匹配accepted及上次iPad布局，25操作完整凭据/sequence119保持，无待办/错误，状态推导saved。视图核对完成；无工作时历史held误显示暂停的P2缺口仍待修。仅回执归档/文档，无源码/运行套件/发布；UI1/FB2/FB5验收保持，G5–G8保留。以下为历史。

2026-11-17 最新：[UI1横条验收完成](docs/SYNC_G4_UI1_ACCEPTANCE.md)，用户明确两端空条消失、正常结果可见、清空恢复，2报告/3图及19项通过。原25操作完整接受凭据保持；PC outcome驱动暂停文案且view仍Synthetic/A，与accepted的Moved组不同，另列UI2待PC打开图谱后补报告/截图。不将UI1验收扩成当前图谱一致通过，无新源码/运行套件/发布；G5–G8门禁保留。以下为历史。

2026-11-16 最新：[G4-UI1空横条](docs/SYNC_G4_UI1_RESULT.md)技术修复及更新包完成，待用户PC/iPad显示复验。根因为空sticky消息仍有16px padding占位，新增:empty padding0保留ARIA/非空消息。原生因果取证+修复7项、浏览器先红后绿12组合、默认34脚本通过，独立审阅无关键项。main a49a3d27…不变，styles29429890…，g4-ui1-update-1q09i9bk三运行文件+指南已核验。原G4两端更新后只验滚动/检查/撤销，回交2报告及截图；FB2/FB5验收及用户现场保持，超长非空消息P3另列、G5–G8/发布门禁保留。以下为历史。

2026-11-16 最新回执：[G4-FB2独立双PC本场景验收完成](docs/SYNC_G4_FB2_ACCEPTANCE.md)。用户明确弹窗/取消/确认/同时重开顺利，4报告/3图及28项核验通过；build与候选匹配，A/B身份和连接独立，各库重开前后除timestamp外报告完全相同，无错误或待办，正常停在join-required。无需补做加入。仅回执归档/只读核验/文档，无新运行源码或测试/发布；原FB5已验收25操作现场保持。设置页横条（本次PC图也可见，根因未定）、G5–G8继续待办。以下为历史。

2026-11-16 最新：[G4-FB2跨库锁修复](docs/SYNC_G4_FB2_FIX_RESULT.md)技术完成，待用户双PC独立库验收。shared旧名兼容锁+installation exclusive锁，不改身份/格式；旧候选仍需关闭。新增6组、默认34脚本、相关磁盘、真实浏览器6组、同profile Windows原生旧版复现及修复4组+冷开2组通过。main a49a3d27…，fb2-delivery-jlxdmf18双PC白名单包已核验；无需Nutstore/iPad，按指南回交4报告。原G4-FB5已验收25操作现场保持，黑条/G5–G8及发布门禁保留。以下为历史。

2026-11-16 最新回执：G4-FB5原PC/iPad+坚果云 [本场景续验完成](docs/SYNC_G4_FB5_ACCEPTANCE.md)，6报告/6图/PC实盘10项核验通过。删除23/23、往返25/25、最终25/25，同操作/布局，无pending；用户明确无需审阅恢复，最终报告来自两端完全退出重开。28物理attempt为25操作+3份同文尝试，原22正文保持。只读核验，无新测试套件/运行改动或发布。G4主流程本次收尾，FB2锁与黑条及G5–G8继续待办，下一项优先FB2。以下为历史。

2026-11-16 最新：[G4-FB5自动完成修复](docs/SYNC_G4_FB5_FIX_RESULT.md)技术验证及更新包完成，专项8组/默认33脚本/浏览器11组/Windows原生15组及受影响磁盘通过。只完成已共享同文结构pending，不替未发布工作写文件；自有pending不误判竞争，普通恢复门禁保持。最终原生26/26，main2243e86d…；更新包g4-fb5-update-xmnvir_m。用户原22操作现场未动，按指南两端更新后先删除Fifth、往返、最终重开回交6报告；G4/iPad/Nutstore体验及FB2/G5–G8保留，未发布。以下为历史。

2026-11-15 最新：G4-FB4标题先到导致重复结构分支已修复并技术验证，见 [修复结果](docs/SYNC_G4_FB4_FIX_RESULT.md)。完整8报告/20原件回放19/18→21/21，默认构建+32脚本、新专项4组、浏览器11组、Windows Obsidian1.15.1原生13组及磁盘回归通过，最终原生24/24。确定结构ID只处理完全相同的完整内容/前驱，保留旧冲突选择编号和日志校验；不兼容卡片禁用、有效选择仍确认。main46f0634c…；g4-fb4-update-srlabbg6运行文件更新包已核验，待用户原库原远端两端更新后回交6报告。FB2锁及黑条、iPad/Nutstore/G4体验和G5–G8门禁保留。以下为早前阶段记录。

2026-11-15 当前：G4操作与结构集成技术验证完成，见 [G4结果](docs/SYNC_G4_RESULT.md)。默认构建+31脚本/G4集成10组、状态21项、浏览器10组及相关磁盘专项通过；Windows Obsidian1.15.1两新profile11组及冷重开通过，最终各20操作。多域完整选择、rename/标题增删、结构唤醒与合法贴边旧组新增标题的几何后备修复已验证。最终main 3c3e1d48…，新包delivery-n352lu0s、新空远端 /KM-G4-e9d8fed3；PC/iPad+坚果云与体验待用户按包内OPEN-FIRST验收。传输预检仅本地复制，版本/原FB1/日常库及G5–G8门禁保持。以下为此前阶段记录。

2026-11-15 当前：U5-FB1原PC/iPad+坚果云续验回执核验通过，用户规定步骤顺利，见 [复验结果](docs/SYNC_UNIFIED_U5_FB1_ACCEPTANCE.md)。5报告/4截图/PC实盘16项核验，接受4→5→7，最终两端同7操作/同布局/无待发布工作，修复构建和设备身份保持。U5本次联合验证收尾，下一阶段G4 reset/undo/结构变化/多域集成待执行，其余门禁保留。本轮无源码或新默认/原生运行回归，无升级/发布。

2026-11-15 最新：U5-FB1 [竞争恢复修复](docs/SYNC_UNIFIED_U5_FB1_FIX_RESULT.md)技术验证完成，三运行文件更新包已交付，待用户原PC/iPad现场续验。最终main f7501984…；4场景竞争磁盘专项、独立审阅边界4项、默认+30脚本、状态19项、设置浏览器10组、持久化/join/自动队列/统一宿主磁盘及Windows两新profile竞争恢复与真实冷开通过。未改wire/日志格式或给自动队列竞争权限；用户库、日常库、版本和发布门禁保持。以下为早前增量。

2026-11-15 当前：用户 U5 首轮在恢复/冲突受阻，[U5-FB1](docs/SYNC_UNIFIED_U5_FB1_REPRO.md) 已通过文件专项两次对照和原交付候选 Windows 原生两新 profile 复现，尚未修复。缺口为待审本机草稿与已到达共享新布局并存时没有可用的明确恢复路径；当前暂停用户续验，先补该路径和清楚提示。以下 U5 初版数字保留为历史通过，不当作反馈修复完成。

2026-11-15 最新增量：U5 技术预检和 PC/iPad 独立包完成，见 [U5结果](docs/SYNC_UNIFIED_U5_RESULT.md)。默认 `npm test` 构建+**30个合成脚本**，统一宿主17项、审阅宿主6项；设置浏览器10组和相关持久化/join/配置/生命周期/自动队列/统一宿主磁盘专项通过。实际 Windows Obsidian1.15.1 两新 profile 原生9组通过，修复真实编辑锁漏唤醒及早释放竞态。最终包 main 与原生哈希相同，来自未运行 pristine，白名单/ZIP字节/CRC/SHA通过。用户按交付 OPEN-FIRST 验证 Nutstore/iPad 并回交；本地复制不代表服务/移动真机，默认产品发布及后续门禁保持。

2026-11-14 较早增量（U3 完成时）：统一宿主/独立入口通过宿主 15 项、入口 9 组、签名宿主磁盘 8 次退出及当时构建 +27 脚本，见 [U3 结果](docs/SYNC_UNIFIED_U3_RESULT.md)。当前设置/UI 状态以上一段和 TODO 为准。

2026-11-14 较早增量（U2 完成时）：统一候选 U1 正常连接/本机身份、U2 自动发布队列完成核心与磁盘验证，见 [U1 结果](docs/SYNC_UNIFIED_U1_RESULT.md) / [U2 结果](docs/SYNC_UNIFIED_U2_RESULT.md)。当时默认 `npm test` 为构建 + **25 个合成脚本**，含连接 25 项和自动队列 22 项；独立 `npm run test:sync-auto-publish-disk` 为 14 次真实进程退出。当前 U3 进度以上一段和 TODO 为准。

2026-11-08 当前增量：A1/A2 完成，A3 禁用后本地工作/兼容恢复草稿第八阶段原型通过，见 [SYNC_A3_LOCAL_WORK](docs/SYNC_A3_LOCAL_WORK.md)。默认 `npm test` 构建 + **21 脚本**（同步 116 + 协调 29 + 宿主 40 + 配置 44 + 生命周期 34 + 本地工作 21）；磁盘 `test:sync-disk` 65/23、`test:sync-join` 53/19、`test:sync-host-disk` 12/6、`test:sync-config-disk` 21/16、`test:sync-lifecycle-disk` 23/18 与新 `test:sync-local-disk` 16/14 均通过，数字为检查/实际退出，共 **474 项/96 次退出**。磁盘需硬链接/子进程权限，数据 `.local/sync-016/a3/`。disabled 同库设置/UI/布局保存、再启用保留草稿而不自动发布、兼容包校验和明确恢复草稿已有隔离宿主入口；未接正式 UI，新接口/库存清点/控制流程尚无原生/iPad/OS quota/断电或近限额性能结论。A3 下一步近限额清点/重开与必要优化、独立原生候选验证，旧 schema1/2 恢复/丢失存储处理待补。正式包 0.0.15 不变，外部 data.json 自动回写与 iPad copy 最终发布 P1 门禁保留；旧原生双端探针保持历史源码范围。

下一阶段（用户 2026-11-08 决定）：**0.0.16 为 PC ↔ iOS/iPadOS 图谱布局同步，Android 0.0.17**。接手先读 TODO 与 [同步方案](docs/SYNC_PLAN_0.0.16.md)，历史交接不代表当前进度。README 与宣传视频 v3 已用户验收。当前已有 A2 纯核心与 A3 隔离磁盘原型，尚无运行包布局同步或升级版本；相关源码/文档和素材仍在本地工作区、尚未提交，远端 clone 需要另外取得这些增量。

当前 GitHub 发布为 **0.0.15**（tag `0.0.15` → `8b82e4b`；Actions run `42355198309` 成功，三资产 + attestations）。11 个合成脚本、独立库原生回归、三资产哈希及正式下载文件安装已核验；社区门户 0.0.15 / 审核 Completed、原生安装器直连安装启用已确认，详见 [发布记录](docs/RELEASE_PREP_0.0.15.md)。

使用 Node.js 22 或更新版本。纯 JS 构建只用 Node 标准库，没有 npm 依赖安装步骤。

```sh
git clone https://github.com/xidianhush/knowledge-graph-obsidian-plugin.git
cd knowledge-graph-obsidian-plugin
npm test
```

`npm test` 先构建，再串行执行 **21 个**合成检查脚本：核心生命周期、管线契约、设置、原型几何、正式拖动、保存状态、基础改名、扩展改名、增删修复、schema3 迁移、i18n 文案，以及实验同步因果、布局事务、作者、wire、结构修复、保存协调、宿主适配、私有配置、生命周期/容量及禁用后本地工作/恢复（`scripts/sync_*_check.mjs` 中的默认十项；磁盘六项单独运行）。无需 Obsidian、Python、网络或个人笔记。报告写入被忽略的 `.local/evidence/` 和 `.local/sync-016/`。Node 性能样本随机器而变，不是速度门槛。

只构建：`npm run build`。输出 `dist/main.js`、`dist/manifest.json`、`dist/styles.css` 及供测试使用的模块；运行插件只需前三个文件。若本地存在 `.local/smoke-payload.json`，历史构建脚本会额外复制私有快照到 dist，**不能直接打包整个 dist**。

生成交付包（白名单三个运行文件 + SHA256SUMS，拒绝快照与 data.json）：

```sh
node scripts/build.mjs
node scripts/package.mjs            # 输出 .local/release/<version>/
```

使用者可见的安装/升级/卸载与已知限制见 `docs/INSTALL.md`。

历史 0.0.13 交付记录：**0.0.13（已正式发布，tag `0.0.13`，Release 见 https://github.com/xidianhush/knowledge-graph-obsidian-plugin/releases/tag/0.0.13）**。构建 `main.js` 333,570 B sha256 `37589a6f32203026ff82a564ad83013b72dbb19c8a8180f7c04da67a49ba8ab5`；打包产物 `.local/release/0.0.13/`（三文件 + SHA256SUMS + RELEASE_NOTES），发布说明草稿 `docs/RELEASE_NOTES_0.0.13.md`。2026-11-04 修复候选验收反馈：`repairGroup` 对「同名且正文为空」标题的保守校验会把整篇笔记的 H1 组判为不可修复（笔记内 H1 全部退回自动布局），现仅在同名计数变化或 evidence 不一致时回退，纯增删保留已保存布局（新增 2 条合成回归）；编辑提示改为「再次点击顶栏 ✥ 退出」。在「日常库副本 vault-013」（Obsidian 1.15.0 / CDP 9249）原生复算 H1 相对偏差 0.0px、`errors []`。历史：0.0.12 为内部候选 2026-11-04 晚发布门禁：A 打包/版本一致、B 空白库安装建图、C 日常库副本真实数据 reconcile 4 场景全部通过；门禁 C 发现并修复同族边界（含同名空正文标题的笔记重命名会整篇回退），新增 1 条合成回归，原生复算重命名后 H1 偏差 0.0px。（已装日常库完成 1–2 天自用体验并通过，报告见 `product-site-acceptance/`）；0.0.11 已 push 并发布 GitHub pre-release；社区目录条目已于 2026-11-04 上线（<https://community.obsidian.md/plugins/knowledge-graph-smoke>），2026-11-05 目录镜像同步后客户端可搜到。0.0.12 的 manifest 名称为 Knowledge Map、`minAppVersion` 1.6.7、`isDesktopOnly: true`（0.0.13 沿用）；布局存储为 schema3，旧 schema1/2 数据会在首次协调写入时自动迁移；0.0.13 只改 HUD/样式，不改数据格式与交互契约。0.0.10 及更早版本读到 schema3 会禁用调整并保留原数据，回退须先备份 `data.json` 的 `layoutOverrides`。

历史 0.0.14 发布记录：**0.0.14（已 tag `0.0.14` 并由 GitHub Actions 发布，三资产 + attestations；门户图标/Overview 已更新）**。2026-11-06 之前的描述「已构建未发布」已过期。构建 `main.js` 396,234 B sha256 `b022a4d810c38280e23068e718e68f9e0030bd4ba763b2dc0abae0b847903dc5`；`npm test` 为 **11 个合成脚本**（新增 `scripts/i18n_check.mjs`）。0.0.14 起 Release 由 tag 触发的 GitHub Actions 产出，只上传 `main.js` / `manifest.json` / `styles.css` 三资产，`SHA256SUMS` 与发布说明写入 Release 正文并附构建来源证明（见 `.github/workflows/release.yml`、`docs/RELEASE_CI.md`）。发布说明 `docs/RELEASE_NOTES_0.0.14.md`。

2026-11-06 交接 **0.0.14**：用户结束 0.0.13 验收、要求图标工作到此为止，并把 0.0.14 交下一位 agent。0.0.13 之后的未发布增量只有 `src/plugin.js` 的自绘图标（`addIcon('knowledge-map')` + ribbon/tab），构建 `main.js` 334,284 B sha256 `9211f03133ac257bb596ebb48e4aecace6d3a43f29b5cf6dddd7e6849fff2245`（未升版本、未打包）。0.0.14 范围：i18n 中英双语、`:has` 改 JS 类切换、Release 精简三资产 + attestations、localStorage 审查、in-app 安装验证、README 理念教程+动图、插件 id/URL 去 smoke（需先决策迁移与门户方案）。详情与 open 项见 `HANDOFF_NEXT.md`「本版交接：0.0.14」。

首次接手读 `AGENTS.md`、`TODO.md`、`README.md`、`HANDOFF_NEXT.md`。活动构建入口是根目录 `src/`、`scripts/build.mjs` 与 `upstream/`；点目录 `.stage4/`、`.graphcore/`、`.pipeline/`、`.native/` 保留历史代码，仅供追溯。

## 可独立运行的补充测试

构建后可执行 `node scripts/layout_scale_ab.mjs`（多组规模）、`node scripts/continuous_layout_benchmark.mjs`（连续核心编辑）、`node scripts/layout_performance_check.mjs`（几何性能）。A/B 使用仓库内冻结的 0.0.9 纯核心代码，来源及哈希见 `tests/fixtures/README.md`；`node scripts/layout_scale_ab_0_0_10.mjs` 则在同机同进程内对照冻结的 0.0.10（schema2）与当前 0.0.11（schema3）。

`core_check.mjs` 默认用合成输入；只有显式添加 `--private-snapshot` 才读取本机冻结快照。合成通过不能代替历史快照逐像素回归。

## 需要另行准备的测试

- Python 集成脚本需要 Playwright；像素比较还需要 Pillow；实际依赖和启动参数看各脚本。没有锁定的 Python 环境，本轮未验证跨系统安装。
- 原生测试依赖本机 Obsidian / Chrome、独立 vault、独立 profile、CDP 端口。多数脚本按 `Path(__file__)` 定位项目，但旧脚本含 Windows 绝对路径，必须先读脚本再适配。不要照搬日常库安装、复制或启动脚本。
- 原生主窗口合成测试通常连接 9242 / `test-vault-layout-fix`；旧冒烟 9238 / `test-vault`；真实副本 9239 / `real-vault-trial`。这些目录与端口是原机器约定，clone 不包含它们，也不保证实例存在。
- `prepare_smoke.py`、`export_pipeline_golden.py`、旧像素对照等依赖原渲染项目或 `.local` 快照；缺少时应报告未执行，不能改成跳过后报全通过。
- `native_ab_check.py` 还需要 `.local/releases/` 下 0.0.9/0.0.10 冻结 ZIP；仓库没有这些本地产物。不要把当前代码打包冒充旧版。`prepare_native_ab.mjs` 可生成合成输入，但不能补齐缺失历史安装包。
- `.local` 的历史 JSON、图片、安装回执及真实副本都未提交。`*_RESULT.md` 是历史结果摘要，不代表 clone 后已复跑。

集成测试须先核对实际 vault 绝对路径、运行插件版本与设置；串行操作同一 Obsidian 实例，备份程序和配置，finally 恢复范围与布局。只编辑测试库的合成探针，不编辑日常笔记或副本原文。

## 移动端（0.0.15 iPadOS 发布交接，2026-11-07）

- 计划与差距清单：`docs/MOBILE_PLAN.md`；执行清单：`TODO.md` 的 `MOB-P1` / `MOB-A1…A10`；接手入口：docs/HANDOFF_0.0.15_README_RELEASE.md；README 计划：docs/README_PLAN_0.0.15.md。
- 2026-11-07 用户已验收 iPad 功能用例、PC-F1/PC-F2 及精简 README。0.0.15 本地候选版本/安装与发布说明/门户草稿/三资产已准备；11 脚本与 Windows Obsidian 1.15.0 独立合成库 10 项原生回归通过，三文件版本/哈希/二次构建一致。本轮明确授权后已 commit/push/tag 并发布 GitHub Release 0.0.15，门户同步状态见发布记录。Android 下一版、iPhone 与未测性能项如实披露；本轮未重测 iPad，详见 docs/RELEASE_PREP_0.0.15.md。
- 手机构建（未发布时）验证方式：把 `dist/main.js`、`dist/manifest.json`、`dist/styles.css` 放进手机端 vault 的 `.obsidian/plugins/knowledge-graph-smoke/`，重启 Obsidian 后启用；Android 可用 `adb push`，iOS 通过 Obsidian Sync 或文件 App。
- Android 调试：`adb devices` + Chrome `chrome://inspect`（WebView 可调试时）或 `adb logcat`；本机无 macOS，iOS 只能由用户手动验证，结论须如实标注。
- MOB-A7：同步 buildGraph 与分块 buildGraphAsync 共用生成器。管线契约脚本覆盖结果一致性、分阶段取消及 Worker 故障清理，仍为 11 脚本门禁；性能来源与局限见 docs/MOBILE_PLAN.md §6。
- 移动端构建/测试命令不变：`node scripts/build.mjs`、`node scripts/test.mjs`；桌面 CDP 回归继续用 `.local/native/` 下的脚本（需 danger-full-access）。

## 交付边界

源码已 push 到公开仓库，0.0.13 为首次正式 Release（tag `0.0.13`、五资产；0.0.14 起改为三资产 + attestations，`SHA256SUMS`/说明进正文），仓库含 MIT LICENSE 与 `versions.json`。**社区目录条目已上线**（<https://community.obsidian.md/plugins/knowledge-graph-smoke>，自动评审 Completed、仅建议项）；2026-11-05 目录镜像同步后客户端「浏览」可搜到。0.0.12 候选已按 48-P2 决定收紧 manifest：名称 Knowledge Map、`minAppVersion` 1.6.7（已在 Obsidian 1.6.7 与 1.14.5 实测）、`isDesktopOnly: true`；描述已由用户确认（即 manifest 现有英文）；0.0.12 已按授权装入日常库并完成 1–2 天自用体验（2026-11-03 通过）。0.0.13 在此基础上只改 HUD 结构与样式（顶栏重建按钮、2 秒构建状态胶囊、布局工具横带、窄窗口紧凑化），布局数据与交互契约不变；本地已构建、跑完 10 个合成脚本、打包到 `.local/release/0.0.13/` 并在合成库 vault-012 + Obsidian 1.15.0 做过原生 UI 验证，0.0.13 已 push 到 GitHub 并发布首次正式 Release（资产 main.js/manifest.json/styles.css/SHA256SUMS/RELEASE_NOTES.md）；用户日常库验收已通过。社区目录提交入口已变更为官方门户 <https://community.obsidian.md>（`obsidianmd/obsidian-releases` 的 PR 通道已废弃/禁用），需 Obsidian 账号登录后提交，属 48-P3 的剩余步骤。
