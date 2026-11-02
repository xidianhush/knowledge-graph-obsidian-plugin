# 下一位 Coding Agent 交接入口

交接日期：2026-11-01（Asia/Shanghai）。仓库：https://github.com/xidianhush/knowledge-graph-obsidian-plugin （2026-11-01 由拼写错误的 `knoeledg-graph-obsidian-plugin` 更名，旧链接由 GitHub 重定向）。本文是接手摘要，**TODO.md 是唯一当前执行清单**。原 2026-10-27 交接文档已归档至 `docs/history/HANDOFF_2026-10-27.md`，不能照其旧步骤重新开发。

## 先做什么

1. 读 `AGENTS.md`、`TODO.md`、`README.md` 和 `DEVELOPMENT.md`，检查当前分支、工作区和 manifest；不要覆盖用户改动。
2. 用 Node 22+ 执行 `npm test`，确认干净 clone 可构建且合成回归通过。GitHub 交接基线为 **0.0.10**；本地已在基线之上实现 **0.0.11（schema3）** 并 commit `13933dc`，已于 2026-11-01 push 到 origin/main 并发布 GitHub pre-release `v0.0.11`（社区目录未提交）；原生拖/存/重建/Esc/撤销基本回归、30 分钟连续压力与 schema3 冷启动已完成；用户体验验收已于 2026-11-01 完成（47-P2/47-P3，报告 `47-P3_PRODUCT_SITE_ACCEPTANCE_REPORT.md`），该版本为 pre-release，不是社区目录正式发布。 2026-11-02：47-A2 授权副本 30 分钟连续压力与结构/改名/泄漏验证完成（`REAL_VAULT_RESULT.md`），48-A1 文档/打包/空白库验证完成（`docs/INSTALL.md`、`scripts/package.mjs`、`.local/evidence/delivery-48a1/blank-vault.json`），48-A2 待 48-P1/P2 决定后跑最终回归。 2026-11-02 晚：48-P2 平台声明已落地到 **0.0.12 本地候选**（manifest 名称 Knowledge Map、minAppVersion 1.6.7、isDesktopOnly true；`main.js` 与 0.0.11 相同 `205b1bd0…`），48-A2 候选回归在 Obsidian 1.6.7 / 1.14.5 / 空白库通过，见 `DELIVERY_48A2_RESULT.md`；候选未 push、未发布、未装日常库；46-A3 90 分钟长时观测进行中。
3. 读 `LAYOUT_SCALE_RESULT.md`、`NATIVE_AB_RESULT.md`、`CONTINUOUS_EDIT_RESULT.md` 和 `DESKTOP_STABILITY_RESULT.md`。47-A3 的 schema3 已在本地 0.0.11 实现（commit `13933dc`，已发布 pre-release `v0.0.11`）并完成独立语义/规模复核、原生基本回归、30 分钟连续压力与冷启动，用户体验验收已完成；FB-006 已定因为测试驱动整页 reload 产物（非插件缺陷，详见 §2 与 `.local/evidence/fb006-repro/RESULT.md`），保持观察。
4. 先建立本机合成独立库，再执行原生测试。原机器的 vault/profile、历史 ZIP、私有证据没有随 Git 传输；缺少环境不是测试通过。具体可运行/需准备的脚本见 DEVELOPMENT。
5. 每轮按任务 ID 局部更新 TODO，记录实际测试、版本、日期和未完成项；产品体验验收由用户决定。

## 已实现与验收边界

- 原生 Obsidian 视图、当前库建图、范围设置、搜索/过滤、缩放、Ctrl 预览、点击固定阅读、标题跳转和 Esc 取消已实现。
- 0.0.5 起，文件夹/笔记/标题含顶层都可在“调整布局”模式拖动，兄弟避让、整棵子树移动、连线跟随。不要恢复旧的“根级不允许移动”限制。
- 0.0.6 增加布局保存、会话内最多 50 次撤销/重做、恢复此组/全库自动布局、兼容重建和失败保护。用户已验收独立库、真实副本及本轮日常使用。
- 0.0.7–0.0.9 实现可信标题改名迁移、可区分重复标题以及纯增删/尺寸变化后的局部布局修复。用户对 0.0.9 反馈“暂时符合预期”；混合替换、层级变化、歧义仍保守回退，不能承诺任何编辑都保留。
- 0.0.10 将同组成员重复的 outline 提升到组级，布局存储 **schema2**，兼容旧 schema1 读取和迁移，写失败保留旧状态。技术回归完成，**用户体验仍待完成**。
- 本地 0.0.11（commit `13933dc`，已推送并发布 pre-release `v0.0.11`）把 identity 提升为**笔记级共享**（`structures[noteKey]`），组记录只留 `shape/points/note/structure`，留一个路径无关的结构摘要做守卫；schema1/2 懒迁移，写失败保留旧数据，旧版本读 schema3 会禁用调整但不毁数据。合成回归 10 脚本全过；独立复核（新核心 vs 冻结 0.0.10 核心）7 场景语义 EQUIVALENT、5 档字节比 0.082–0.772、堆比 0.072–0.731（见 `.local/evidence/schema3/REPORT.md`）。原生（9243，Obsidian 1.14.5/Electron 30.1.2）已验证真实拖动→保存→重建恢复（dx=dy=0）、Esc 取消、Ctrl+Z 撤销，以及同笔记两组共享 1 条 structures；30 分钟连续压力（1161 轮 0 失败、重建 p50 0.400 s、预览 151/151、隐藏恢复 151/151、heap 27.8→29.7 MB）与 schema3 冷启动（rev/几何一致）已完成；用户已于 2026-11-01 在日常库完成体验验收（47-P2/47-P3）。
- 原机器独立 `test-vault-layout-fix` 安装 0.0.10；real-vault-trial 磁盘版本为 0.0.6；**日常库于 2026-11-01 获用户明确授权升级至 0.0.11**（仅替换 main.js/manifest.json/styles.css，data.json 保留 schema1 rev87、首次建图时迁移；0.0.6 四文件备份在 `.local/backup-daily-0.0.6/`，验收清单 `.local/acceptance-daily-0.0.11.md`）。不要把用户后续“副本没问题”当成 0.0.9/0.0.10 真实验收，也不要假定新机器有这些库。

0.0.10 main.js 历史验收 SHA-256：`ff171eee6be55bbad81579c1f4bbabb26f7b583754d936ee9f2d9b34fa8ddd55`。本地已提交的 0.0.11 构建（manifest 0.0.11，commit `13933dc`）main.js SHA-256：`205b1bd0383a223f92aef6f09e36327882bd081f3c707bab725fb47b9d3bf049`（325976 B；技术回归与用户体验验收均已完成，2026-11-01 发布 pre-release）。构建会复制本地存在的私有快照，打包时只能白名单取 main.js、manifest.json、styles.css，不能直接公开 dist 全目录。0.0.12 候选 manifest（291 B，sha256 `6fcc0b52ec8d44a9e6f1c0749fe2e12a0ebaccf56733a76470cf85e93e39a72f`）与 0.0.11 的差异仅为名称/最低版本/桌面声明/版本号，`main.js`、`styles.css` 未变。schema2 降级仅替换旧二进制不够：旧版会拒绝新结构写入，应先另存新配置，再恢复对应旧版程序及升级前配置；这会失去备份之后的调整，不能静默执行。

## 关键实现位置

- `src/core/layout-edit.js`：拖动事务、容器边界、兄弟避让、子树移动及取消。
- `src/core/layout-state.js`：组级记录、改名身份匹配、增删修复、apply/reconcile、保存串行队列、历史和 schema 迁移。下一性能改进主要从这里入手。
- `src/core/graph-core.js` 与 `src/adapters/hud.js`：编辑入口、命中、快捷键、状态和渲染集成。
- `src/adapters/vault-pipeline.js`：先过滤再读正文、完整 Worker 重建、取消与资源清理；当前不是增量建图。
- `src/adapters/obsidian-native.js`：按需预览、截取预算、请求取消与原生 Markdown 生命周期。
- `src/plugin.js`、`src/settings.js`：视图、自动更新、设置和持久化；`src/pipeline/`：纯建图算法。
- `upstream/` 为原渲染器冻结源码，构建仍用其 template；四个点目录是历史增量，不作为活动实现。

## 后续执行顺序与完成标准

### 1. 47-A3：长笔记多组成本（0.0.11 已实现、push 并发布 pre-release `v0.0.11`；技术回归与用户体验验收均已完成）

2026-11-01 本地实现 schema3：`outline`/`identity` 从每组记录提升为按笔记共享的 `structures[noteKey]`，组记录只留 `shape/points/note/structure`（路径无关结构摘要，改名后仍可 apply）；身份与歧义保护未删除。同机同进程 0.0.10→0.0.11：单篇 5000 标题/10 组记录 11,496,712→875,447 B、模型+协调+JSON p50 472.5→93.1 ms；1000 标题/10 组 2.26→0.19 MB、92.3→16.7 ms；50 篇各 1 组 1.19→0.92 MB、66.9→40.8 ms（核心合成口径，不含 Worker/UI/磁盘）。证据见 `LAYOUT_SCALE_RESULT.md` 与 `scripts/layout_scale_ab_0_0_10.mjs`；实现位置 `src/core/layout-state.js`，本地构建 main.js sha256 `205b1bd0383a223f92aef6f09e36327882bd081f3c707bab725fb47b9d3bf049`，manifest 0.0.11。

已回归：schema1→3 与 schema2→3 冷载迁移、同笔记多组共享一条 `structures`、迁移写失败保留旧数据、旧版本拒绝 schema3 但不毁数据、撤销/重做、单组/全库恢复、改名与部分范围保留、增删局部修复（`npm test` 10 个合成脚本全过）。独立复核（bench-verifier，未改 src/tests）：新核心 vs 冻结 0.0.10 核心 7 场景语义 EQUIVALENT、契约 5 项通过；5 档字节比 0.082–0.772、p50 时间比全 <1、保留堆比 0.072–0.731，脚本 `scripts/schema3_*.mjs`，报告 `.local/evidence/schema3/REPORT.md`。原生 0.0.11（9243，Obsidian 1.14.5 页面/Electron 30.1.2/Chrome 124）：真实鼠标拖动→“布局已保存”→磁盘 `schemaVersion=3`，原生命令重建后节点 dx=dy=0.0 恢复；Esc 取消（“调整中 · Esc 取消”→“已取消本次调整”、磁盘/rev 不变）；Ctrl+Z 撤销生效；同笔记 note 组 + heading 组持久化后 `structures` 仅 1 条且 note 指向同一 noteKey。已完成：30 分钟原生连续压力（1161 轮 0 失败/0 渲染异常、预览 151/151、隐藏恢复 151/151、busy 卡死 0、rev 单调、heap 无攀升）；拖动/保存补充 20/20、Ctrl+Z 4/4；schema3 冷启动 rev/几何/磁盘一致（证据 `.local/evidence/continuous-011/RESULT.md`、`cold-load-011.json`）；本地 commit `13933dc`（已 push 并发布 pre-release `v0.0.11`）；同日另提交 `8a3a429`（文档）。**用户体验验收：用户已于 2026-11-01 在日常库完成（47-P2/47-P3，13:50–15:39，报告 `47-P3_PRODUCT_SITE_ACCEPTANCE_REPORT.md`）。** 2026-11-01 用户授权将日常库升级至 0.0.11 并随后人工体验：已替换三文件、备份 0.0.6 四文件、用日常库完整副本在 9244（0.0.11）/9245（0.0.6）双实例预演迁移（0.0.6 同数据 restored 0/3，0.0.11 restored 1，无布局回退），预期提示与回退步骤见 `.local/acceptance-daily-0.0.11.md`。不得因技术通过宣称 47-A3 已完成或已交付。

### 2. 46-A3 / FB-006：偶发异常定位（FB-006 已定因，46-A3 长时边界继续）

**FB-006 状态：已定因（2026-11-01，测试驱动方式产物，非插件缺陷）**。历史 51 项断言中的 `illegal access` 与 `getZoomFactor` 已复现并归因：只有用 Playwright 注入式驱动对 Obsidian 渲染页执行整页 `page.reload()` 时才出现（每次约 4 条字符串异常 `illegal access`，CDP `Runtime.exceptionThrown`，scriptId=1/url=index.html/line 0，reload 前后旧/新主世界各一批）。决定性对照：插件 `disablePluginAndSave` 后完全未加载（`plugins=[]`）仍 4 条；0.0.9 与 0.0.10 相同；纯 raw CDP 复刻相同序列 0 条；去掉本仓 init script 的 Playwright 仍 3 条；本仓正常使用路径（30 分钟 1161 轮、150 次混合、20 次拖动保存）两异常均 0 次。`illegal access` 字符串在 obsidian-1.14.5.asar 中出现 0 次 → Electron 原生层在渲染进程 reload 时抛出；`getZoomFactor` 属 Obsidian 自身 `app.js` 标题栏 `updateStatus` 在 reload 后使用失效窗口代理 `this.eWin`，插件不在调用栈上（本轮未复现，按历史条件记录）。结论与建议：原生稳定性回归不要 reload 渲染页（改用重启应用或禁用/启用插件），统一 raw CDP；历史 host 异常不作为插件缺陷计入。证据：脚本 `.local/native/fb006_*.py`，结果 `.local/evidence/fb006-repro/RESULT.md`。

遗留观察项：46-A3 的长期资源/隐藏恢复/多视图边界与真实窗口下的极端序列仍需按原计划补测；不因 FB-006 定因就把 46-A3 整体标为完成。

历史线索（保留）：稳定性主脚本 51 项断言中 50 通过、1 失败；自有资源清理与竞态通过，但出现无栈 `illegal access` 和宿主 app.js 的 `t.webContents.getZoomFactor is not a function`。过去一次“禁用插件后重载”对照因重载后插件仍启用而无效，本轮已用 `disablePluginAndSave` 补齐有效对照。

### 3. 47-A2 / 47-P2：连续编辑、预览与规模验收

**2026-11-02 更新：技术验证已完成（授权副本真实 30 分钟连续压力 + include 内合成笔记的结构/改名/泄漏验证，报告 `REAL_VAULT_RESULT.md`，机器证据 `.local/evidence/continuous-real/`）；体验验收仍待用户。**

首轮建议 30 分钟，固定 seed 与操作序列，在合成库循环正文保存、标题改名、添加/删除、预览打开/固定/关闭、重建/取消、隐藏/恢复；覆盖 1000/5000 标题及多保存组。更大规模根据用户 47-P1 的实际需求决定，不默认已支持 2 万节点。

记录请求到视图提交、Worker 启动到返回、模型/布局协调、saveData、帧间隔、错误与自有资源；每隔数分钟采样堆和保存队列。阶段可能嵌套，不能重复相加；提交完成不等于第一帧。回收后的持续趋势和保留对象才有助于判断泄漏，单次峰值不足。

通过门槛：无卡死、迟到结果覆盖、布局/配置丢失、无界队列或持续资源累积；磁盘与内存状态一致。报告 p50/p95/max、最长停顿和环境，等待是否可接受交给用户。合成通过后才在已授权副本添加合成探针，原文不改。历史约一分钟短测不能代替本项。

历史同实例原生 A/B（约千标题）两版整体延迟约 344.5/344.9 ms，近似持平；它排除了旧的非同时段比较，不能宣称新版整体提速。

### 4. 46-A2 / 46-A4 / 46-P2：兼容矩阵（技术已完成 2026-11-01，产品确认待用户）

用户指定组合为 Dataview、Templater、Obsidian Git、Style Settings、Omnisearch、Excalidraw，并授权在独立测试库安装。已在独立库 Obsidian 1.14.5 + 0.0.11 完成两阶段验证：阶段一核心环境（浅色可读性、主窗口分屏、弹出窗口与跨窗移动/关闭、拖动保存与撤销、Ctrl 预览与 Esc、全部释放后重开）；阶段二 7 插件组合（拖动保存/撤销、增删与改名标题、文件/目录改名后的布局身份迁移、Markdown 预览内容、真实 Ctrl+Z、禁用启用、卸载重装）。结果与证据见 `COMPAT_MATRIX_RESULT.md`；异常 0，机器可读证据在 `.local/evidence/compat-matrix/`。

现状与边界：浅色主题下应用 chrome 变浅而图谱画布保持深色（`canvasLum` 46.2→46.1），是否跟随主题仍是 DEC-001 产品待决定项；卸载会按宿主语义删除插件目录与 `data.json`（已保存布局随之丢失），需写入安装/升级/卸载说明；第三方插件模态框（Excalidraw 欢迎页、Obsidian“更新链接”）会拦截画布输入并让 `renameFile` 长时间不 resolve，属宿主/其他插件行为，测试须先关闭或应答模态框，不是本插件缺陷。46-P2 主题/窗口体验待用户确认；不把本轮结果扩大为“所有插件组合兼容”或移动端结论。Obsidian 最近实测为应用 1.14.5、安装程序 1.6.7、Electron 30.1.2；新环境先重新核实。

### 5. 48-*：最终交付与发布验收

在上述阻断问题有明确结论后，与用户确定首发范围、正式名称/ID、邀请试用或公开分发，以及可接受限制。当前 ID 暂不改；若改名需规划配置迁移。

补齐安装/升级/卸载、空白库首次使用、无结果/失败提示、保留配置与回退文档；校准 manifest 平台与最低版本；核对许可证和上游代码分发条件。对最终 commit 构建三文件包，记录哈希、干净重建与关键回归，公开合成示例并排除私有内容。用户验收正式包后再按明确授权创建 Release 或提交社区目录。此次源码 push 不等于这些动作获批。

## 48-A1 交付材料现状（2026-11-02）

- `scripts/package.mjs`：校验 `manifest.json` 与 `package.json` 版本一致、拒绝把 `smoke-payload.json`/`data.json` 打进包、只复制 `main.js`/`manifest.json`/`styles.css` 到 `.local/release/<version>/` 并写 SHA256SUMS。
- `docs/INSTALL.md`：手动安装（三文件）、升级（保留 data.json，schema1/2→3 自动迁移）、回退、卸载（宿主会删除 data.json，布局随之丢失）、**新库首次打开会出现 Obsidian 的“你是否信任这个仓库的作者？”提示，需选择信任否则插件不加载**、数据与隐私（布局不含笔记正文；笔记节点悬停摘要最多 220 字符、仅内存、不写 data.json/日志）、已知限制、维护者打包命令、反馈模板。
- 空白库验证（`.local/native/vault-blank` + 9250）：仅三文件安装可见；空库首次建图 `phase=empty` 友好提示且无异常；建 3 篇笔记后 11 节点、正文标记未进入 data.json/状态/错误；设置 `debounceMs` 落盘并在禁用/启用后保留；卸载删除插件目录与 data.json。证据 `.local/evidence/delivery-48a1/blank-vault.json`（verdict pass）。
- 仍待 48-P2：manifest 的 `name`（Knowledge Graph Smoke）/`description`（Stage 4 smoke test…）为内部文案，`isDesktopOnly:false` 与 `minAppVersion:1.5.7` 尚未按正式范围校准。

## 48-A2 交付候选现状（2026-11-02）

- 本地候选 **0.0.12**：`manifest.json` 名称 **Knowledge Map**（内部 id `knowledge-graph-smoke` 不变，避免既有 data.json/命令失效）、`version` 0.0.12、`minAppVersion` 1.6.7、`isDesktopOnly: true`、描述暂定；`package.json` 同步 0.0.12；`main.js` 不变（`205b1bd0…`，325,976 B）。
- 打包：`node scripts/package.mjs` → `.local/release/0.0.12/`（`main.js`/`manifest.json`/`styles.css`/`SHA256SUMS`）；`node scripts/test.mjs` 10 脚本全过。
- 平台回归：Obsidian 1.6.7（自带）插件加载、构建、拖动保存 rev1049→1050、Ctrl+Z、重建通过；Obsidian 1.14.5 拖动 rev1051→1052、撤销 rev1053、磁盘 schema3 rev1053/groups30/structures6；空白库五项 A–E 通过（md 0 起测）。证据 `.local/evidence/compat-matrix/{phase-167.json,drag-9252.json}` 与 `.local/evidence/delivery-48a1/blank-vault.json`，报告 `DELIVERY_48A2_RESULT.md`。
- 边界：候选**未 push、未打 tag、未发布 Release、未提交社区目录、未装日常库**；描述文案待用户定稿；id 改名涉及 data.json 迁移，暂不改。48-A2 最终交付验收待用户执行安装后确认。

## 权限与协作习惯

- 用户负责目标、优先级、体验结论；agent 负责实现、技术证据、清单维护。用户的“暂时正常”保留其范围。
- 2026-11-01 用户明确授权本次 commit 和 push 到指定 GitHub 仓库。旧文档中的“不 push”是历史约束，本次已被取代；后续推送看新授权。不 force push。
- 不读取 `Utilities/API Key.md`，不写日常笔记，不擅自扩大真实副本范围或升级日常库。原授权副本只涉及两个指定目录及引用图片，细节见 TODO。2026-11-01 用户单独授权将日常库升级至 0.0.11（仅本次三文件替换，不扩展为其它库操作）。
- 不把 `.local`、vault/profile、data.json、截图或私有快照加入 Git。原始证据不可跨机器获得时，如实保留摘要与未复跑状态。
- 网络中断后先读 TODO 和 git status，续接未完工作，不从历史交接重做已验收功能。

## 可直接交给下一位的开场语

请读取 AGENTS.md、TODO.md、README.md、DEVELOPMENT.md 和 HANDOFF_NEXT.md，先运行 npm test 核对基线。本地 0.0.11 已 commit `13933dc` 并 push，GitHub pre-release `v0.0.11` 已发布：47-A3 schema3 多组共享的合成/独立复核/原生回归/30 分钟压力/冷启动均已完成，用户体验验收已完成（日常库已于 2026-11-01 升级至 0.0.11，用户 13:50–15:39 验收通过，报告见 `47-P3_PRODUCT_SITE_ACCEPTANCE_REPORT.md`）；46-A3 的长期/资源边界继续追踪；FB-006 已定因为测试驱动整页 reload 产物（非插件）。先使用合成独立库，不自动升级日常库，不代替我确认体验验收。每轮更新 TODO 并说明实际测试和剩余边界。
