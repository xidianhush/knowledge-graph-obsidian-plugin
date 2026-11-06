# Knowledge Graph — 共同计划与 TODO

最后更新：2026-11-06（Asia/Shanghai）。共同维护者：用户（产品负责人）与 Codex（技术负责人）。

## 先看这里

**2026-11-01 交接**：用户明确授权将全部可公开源码/文档提交并推送至 `git@github.com:xidianhush/knoeledg-graph-obsidian-plugin.git`，供下一位 agent clone 后继续开发。此次授权取代本次“不 push”限制；不含私有库/证据，不等于正式 Release、社区发布或日常升级授权。接手摘要和执行顺序见 HANDOFF_NEXT.md，干净环境入口见 DEVELOPMENT.md；交接任务见 HX-*。

**当前：用户于 2026-10-30 完成 0.0.6 日常体验，反馈原已规划功能暂时正常、体验不错；新增 FB-005：标题改名等小改动导致手动布局大范围回退，希望重建时尽量保留排列。用户已反馈 0.0.9 暂时符合预期，当前0.0.10记录去重候选已交付独立库，稳定性仍保持进行中；生命周期断言通过；FB-006 已于 2026-11-01 定因为测试驱动整页 reload 产物（非插件缺陷），待继续观察。历史验收保留，长期稳定性不据此宣称全部通过。**

当前计划：ME-P3 真实副本体验通过，ME-A5 交付固定完成，ME-P4 日常试用已获用户明确授权，首发功能冻结仍待决定。ME-A6 已安装日常 0.0.6，ME-P5 用户体验完成；ME-A7 诊断完成；LC-A2 局部增删调整 0.0.9 已在独立库获得本轮用户反馈，LC-P1 已验收（暂时符合预期）；46-A3 / FB-006 按用户要求保持进行中，同时推进47-A1/A2。2026-11-01：0.0.11（schema3）已 commit `13933dc` 并 push 到 origin/main，GitHub pre-release `v0.0.11` 已发布（资产 main.js/manifest.json/styles.css/SHA256SUMS/RELEASE_NOTES.md，https://github.com/xidianhush/knowledge-graph-obsidian-plugin/releases/tag/v0.0.11；社区目录提交未做）；47-A3 合成/独立复核/原生基本回归、47-A2 30 分钟原生连续压力与 schema3 冷启动已完成；2026-11-02 授权副本 30 分钟连续压力与结构/改名/泄漏验证完成（REAL_VAULT_RESULT.md）；48-A1 文档/打包/空白库验证完成（docs/INSTALL.md、scripts/package.mjs、`.local/evidence/delivery-48a1/blank-vault.json`），48-A2 待 48-P1/P2 决定后跑最终回归；FB-006 主进程日志通道已打通并于 2026-11-01 晚定因为测试驱动整页 reload 产物（非插件缺陷，证据 `.local/evidence/fb006-repro/RESULT.md`），46-A2/A4 兼容矩阵随即完成（阶段一核心环境 + 阶段二 7 插件组合均通过、未捕获异常 0，证据与局限见 `COMPAT_MATRIX_RESULT.md`；46-P2 主题/窗口体验已由用户验收（浅色下应用变浅、图谱保持深色可接受，DEC-001 已决定维持现状））。2026-11-01 用户明确授权后已将日常库升级至 0.0.11（仅替换 main.js/manifest.json/styles.css；data.json 仍为 schema1 rev87，待用户首次建图时迁移；0.0.6 四文件已备份到 `.local/backup-daily-0.0.6/`）；升级前用日常库完整副本在 9244（0.0.11）/9245（0.0.6）双实例预演：迁移成功（486KB→8.8KB）、0.0.6 对当前数据 restored 0/3、0.0.11 restored 1（因 `Analog IC.md` 自 10-30 有 10 个标题改名，0.0.6 同样不应用），无布局回退；日常库体验验收待用户，清单见 `.local/acceptance-daily-0.0.11.md`。2026-11-01 14:00 起用户在**日常库**验收 0.0.11 通过（47-P2 / 47-P3 由用户自行标记已验收，13:50–15:39 试用到的功能暂时符合预期，产品验收报告 `47-P3_PRODUCT_SITE_ACCEPTANCE_REPORT.md`）；随后进入 push/首发范围准备，push 与发布仍需用户明确授权。2026-11-02：48-P2 平台声明已按用户决定落地到 0.0.12 候选（名称 Knowledge Map、minAppVersion 1.6.7、isDesktopOnly true；main.js 与 0.0.11 相同），48-A2 候选回归在 Obsidian 1.6.7、1.14.5 与空白库通过（DELIVERY_48A2_RESULT.md）；候选未 push、未发布。46-A3 90 分钟长时资源观测已完成（通过）。2026-11-03：0.0.12 已按授权装入日常库并完成 1–2 天自用体验，产品报告 `product-site-acceptance/product-site-acceptance-report/v0.0.12_PRODUCT_SITE_ACCEPTANCE_REPORT.md`（Node 4–8 全部符合预期：重启后布局完整保留、移动笔记/改标题/加链接/调整子元素位置时只有局部变化）；48-A2 已完成，48-P3（是否公开分发/社区目录）待决定。同日产品端更正 47-P3 报告 Node 1 为“在插件设置里把 `电路进阶.md` 加入排除笔记”，并把验收报告与截图迁移至 `product-site-acceptance/`；仓库清理 72 个 Obsidian 0 字节数字占位文件。用户最新反馈 real-vault-trial 暂未发现问题；本轮核对该副本磁盘仍0.0.6，运行版本未核实，不算作0.0.9真实副本验收。受限密集组、超限拒绝、帧间隔异常及长期资源未测边界继续保留。交付、安装与回退见 RELEASE_006_RESULT.md；后续稳定性/性能及发布任务仍按原清单推进，不代表公开发布授权。 2026-11-03 晚：0.0.13 UI/UX（UI-A1/A2/A3）技术实现与原生验证完成——「重新构建」入顶栏、完成提示 2 秒消失（居中胶囊）、「调整布局」改为顶栏按钮 + 全宽工具横带（阅读态无浮层、有效显示区完整矩形）、窄容器紧凑化与图例/命中/侧栏避让；10 个合成脚本全过，构建 `main.js` 332,529 B sha256 `ab00889a…`，打包 `.local/release/0.0.13/`。合成库 vault-012 + Obsidian 1.15.0 原生验证通过；未 push、未发布、未装日常库，待 UI-P1 用户验收。 2026-11-04：0.0.13 候选在用户日常库验收（报告 `product-site-acceptance/product-site-acceptance-report/v0.0.13_PRODUCT_SITE_ACCEPTANCE_REPORT.md`）发现两问题：删除 h2 后同笔记多个 H1 位移（根因 schema3 `repairGroup` 对「同名且正文为空」标题的保守校验过严，已修复 + 2 条合成回归 + vault-013 原生复算 H1 相对偏差 0.0px）、布局提示「结束调整」指向不存在的按钮（改为「再次点击顶栏 ✥ 退出」）；构建 `main.js` 333,570 B sha256 `37589a6f…`，重新打包，2026-11-05：社区目录镜像已同步（9,971 项含本插件），Release 资产计数与门户 11 次下载吻合。2026-11-06：用户宣布 0.0.13 验收结束、图标工作到此为止，0.0.14 交下一位 agent；新增 README 理念教程+动图（UI-A13）与 id/URL 去 smoke（UI-A14，需先决策迁移与门户），交接见 HANDOFF_NEXT.md「本版交接：0.0.14」。待用户再次替换三文件继续 UI-P1 验收。 2026-11-06 晚：0.0.14 候选完成——i18n 中英双语（209 key + 模板 40 绑定 + `i18n_check` 门禁）、`:has` 移除改 JS 类、Release 三资产 + attestations workflow、localStorage→`data.json` 的 `ui`、README 理念教程 + 动图；版本升 0.0.14，构建 `main.js` 396,234 B sha256 `b022a4d8…`，`npm test` 11 脚本全过；用户验收通过（日常库装入后体验「暂时没发现问题」）并授权发布：2026-11-06 已推送 tag `0.0.14`、Release 由 Actions 发布（run 42164446268，恰三资产 + attestations）。门户侧已由用户 2026-11-06 手动完成。注意：门户条目的图标由「图标名 + 背景色」组合生成，**不能上传仓库里的 PNG/SVG**（`docs/assets/knowledge-map-icon.png` 只用于仓库与文档展示；插件内 ribbon/tab 图标仍是自绘 SVG）。

**当前阶段（2026-11-06 交接）**：0.0.14 已完整交付并发布——tag `0.0.14`、GitHub Release 三资产 + attestations、社区门户图标与 Overview 已由用户手动更新；`npm test` = 11 个合成脚本。桌面端暂无未完成项；下一阶段为 **移动端支持（0.0.15 候选）**，计划见 `docs/MOBILE_PLAN.md`、接手入口见 `HANDOFF_NEXT.md` 「下一阶段交接：移动端支持」，任务 ID 为 `MOB-P1` / `MOB-A1…A10`。**未获用户对平台范围与降级口径的答复前，不得擅自改 `isDesktopOnly` 后发布**。

### 整体计划在哪里

- **原始总路线图与设计理由**：[PLAN_APPLICABILITY.md](D:/obsidian_vault/knowledge-graph/PLAN_APPLICABILITY.md)。历史顺序为 0 → 0.5 → 1 → 2 → 3 → 4 → 5（可选）。它仍把阶段 4 标为未开始，不能据此判断当前进度。
- **当前计划、双方分工、待办及决策**：本文件。今后以这里作为执行清单，不再并行维护另一份当前进度表。
- **下一位智能体交接入口**：[HANDOFF_NEXT.md](HANDOFF_NEXT.md)，2026-11-01 更新，含 0.0.10 基线、权限边界、检查入口、后续执行顺序和可复制开场指令；旧交接已归档至 docs/history。之后仍以本文件与用户最新反馈为准。
- **新交互方案与验收定义**：[LAYOUT_EDITING_PLAN.md](LAYOUT_EDITING_PLAN.md)，区分用户已明确效果、推荐交互、实现阶段及待产品确认项。
- **使用方法、构建入口、当前能力与限制**：[README.md](README.md)。
- **已完成工作的证据**：[SMOKE_RESULT.md](SMOKE_RESULT.md)、[GRAPHCORE_RESULT.md](GRAPHCORE_RESULT.md)、[PIPELINE_RESULT.md](PIPELINE_RESULT.md)、[NATIVE_RESULT.md](NATIVE_RESULT.md)、[SETTINGS_RESULT.md](SETTINGS_RESULT.md)。结果文档保留验收日期与环境，不能把历史测试说成今天重新通过。
- `HANDOFF_STAGE4.md` 及本项目 `.stage4/`、`.graphcore/`、`.pipeline/`、`.native/` 为历史交接或增量材料，不作为当前状态表。

### 怎样一起维护

1. 任务按责任人分行。技术完成不自动代表产品验收完成；用户任务只有在用户明确反馈后才标记完成。
2. 状态使用：**已完成、待办、进行中、待用户验收、待决定、阻塞、暂缓、未记录**。未记录不等于没做过；阻塞须写清原因和解除条件。
3. 用户可以直接编辑任务、优先级、反馈和决策，也可以在聊天中说明，由 Codex同步。双方修改前先读最新文件，不整份覆盖对方的改动；发现冲突时保留内容并澄清。
4. Codex 每轮项目工作开始前读取本文件；结束前更新涉及的任务状态、验收证据和变更记录。没有开展工作的时间不会后台自动更新。
5. 开始开发前写清本轮要解决的问题和可观察的完成标准。只处理已授权范围；新想法先进入候选，不默认为本轮承诺。
6. 已完成项保留，不删除历史；细节放入结果文档，表格只写结果和证据链接。技术验收写明实际测试，不用“代码已写完”代替“验证通过”。
7. 先确定少量高优先级问题，再逐项修复、复测、体验验收。问题优先级参考：P0 数据/崩溃问题，P1 核心流程受阻，P2 体验优化；没有依据时标待定。
8. 这里的任务状态不是越权授权：日常库安装、复制范围扩展、发布和 push 仍需明确授权。不要因某一行写了“计划”就执行这些操作。

**表格符号约定（2026-11-02 起）**：✅ 已完成／已验收／已决定；⏳ 悬而未决或进行中（待决定、待补、部分完成）；❌ 未开始／未完成。

**下一阶段（2026-11-03 交接）**：功能层面用户已确认“完全符合预期”，后续不再改功能，只做 UI/UX 优化（0.0.13）与正式发布准备。该阶段交给下一位 coding agent，任务见下文 `UI-*` 与 `48-P3`；用户同时在日常库持续体验并反馈，并自行起草最终 README 与宣传材料。交接细节见 HANDOFF_NEXT.md「下一阶段交接」一节。

## 持续约束与当前试用范围

- 不读取 `Utilities/API Key.md`，不改写日常库笔记。2026-11-01 本次源码交接 commit/push 已明确授权，后续推送按最新指示；不 force push。此前已授权日常升级至 0.0.6，已备份运行文件并保留 data.json，不代表授权任意改动库内容或继续升级。2026-11-01 用户进一步明确授权将日常库升级至 0.0.11 并随后人工体验：本次仅替换三个运行文件，data.json 未主动改写，笔记未改动；升级前在完整副本上预演迁移且双实例对照，回退方式见 `.local/acceptance-daily-0.0.11.md`。2026-11-02 用户授权把 0.0.12 候选装入日常库做 1–2 天自用体验（仅三文件；`main.js` 与 0.0.11 相同、`data.json` 未动），2026-11-03 体验完成并通过，报告见 `product-site-acceptance/`。
- 日常源库：`D:/obsidian_vault/hush-ob-bucket`。已获确认的副本为本项目 `real-vault-trial/`，仅含 `Science and Tech`、`Literature History Philosophy` 及其中引用的本地图片。扩大范围前重新确认。
- 日常库安装位置为 `.obsidian/plugins/knowledge-graph-smoke/`，仅新增 main.js、manifest.json、styles.css、data.json。初始建图范围沿用两个已验收目录，排除 Utilities，自动更新开启、防抖 500 ms、预览预算 60000；用户可在插件设置中调整学习范围，禁止路径固定排除。
- 技术测试先使用独立 `test-vault/`；现有副本验收只允许操作副本中的合成测试笔记，不把源笔记作为编辑探针。
- 保留既有渲染和交互契约。要改变产品行为时先写明理由、预期变化及回归边界。
- 本地证据、截图、试用副本、测试配置和冻结私有快照不公开；安装包不包含这些材料。

## Step 0 / 0.5 / 1 / 2 / 3 — 原图谱通用化（历史）

以下技术状态来自原路线图及已有阶段记录，本轮仅核对文档，没有重跑这些历史测试。

| ID | 责任人 | 工作 | 状态 | 完成标准 / 证据 |
| --- | --- | --- | --- | --- |
| H-0 | 技术 | 配置入口解耦、形状 fixtures、回归扫描与度量 | 已完成（历史记录） | 原路线图阶段 0 |
| H-05 | 技术 | Obsidian 插件平台约束探针 | 已完成（历史记录） | 原路线图阶段 0.5 / §9 |
| H-1 | 技术 | 深度与缩放等参数派生、学科色板及退化库适配 | 已完成（历史记录） | 原路线图阶段 1 |
| H-2 | 技术 | 标签、边和复杂结构的渲染泛化 | 已完成（历史记录） | 原路线图阶段 2 |
| H-3 | 技术 | 预览预算、极深层精度、索引与 payload 编码 | 已完成（历史记录） | 原路线图阶段 3 |
| H-P | 产品 | 历史阶段的逐项体验评价与验收 | 未记录 | 不从技术结果推定用户已经满意；旧决策背景保留在原路线图 |

## Step 4.0 — 原生 Obsidian 冒烟

| ID | 责任人 | 工作 | 状态 | 完成标准 / 证据 |
| --- | --- | --- | --- | --- |
| 40-A1 | 技术 | ItemView 挂载冻结图谱，隔离样式、键盘及视图资源 | ✅ 已完成 | [冒烟结果](SMOKE_RESULT.md) |
| 40-A2 | 技术 | 验证像素、缩放、拖拽、搜索、分屏、隐藏与关闭清理 | ✅ 已完成 | 历史 24 项；4.4 又执行快照回归，逐像素相同 |
| 40-P1 | 产品 | 评价插件内的图谱是否保留预期体验 | ❌ 未记录 | 并入 4.5 的实际体验，不要求补写历史签收 |

## Step 4.1 — GraphCore 抽取

| ID | 责任人 | 工作 | 状态 | 完成标准 / 证据 |
| --- | --- | --- | --- | --- |
| 41-A1 | 技术 | 抽取共享内核、显式宿主接口与生命周期 | ✅ 已完成 | [GraphCore 结果](GRAPHCORE_RESULT.md) |
| 41-A2 | 技术 | 验证双实例隔离、浏览器复用、暂停恢复及释放 | ✅ 已完成 | 17 项浏览器集成及 Node 核心检查；4.4 回归通过 |
| 41-P1 | 产品 | 本步无单独产品操作，后续从实际体验判断结果 | ⏳ 无单独任务 | 不要求用户检查内部架构 |

## Step 4.2 — 当前库建图与布局

| ID | 责任人 | 工作 | 状态 | 完成标准 / 证据 |
| --- | --- | --- | --- | --- |
| 42-A1 | 技术 | 迁移扫描、解析、建图、布局、LOD、色板与编码 | ✅ 已完成 | [管线结果](PIPELINE_RESULT.md) |
| 42-A2 | 技术 | Vault 按范围读取、Worker 构建与取消、空状态和重建 | ✅ 已完成 | 当前库 16 项；4.4 回归通过 |
| 42-A3 | 技术 | 与原实现做 golden / Worker / 画布对照 | ✅ 已完成（4.2 历史验收） | 12 组对照；4.4 未重跑全量 golden |
| 42-P1 | 产品 | 目录、笔记、标题及双链在图中的表达符合预期 | ✅ 已验收 | 并入 45-P2 的核心场景试用 |

## Step 4.3 — 原生预览、跳转与更新

| ID | 责任人 | 工作 | 状态 | 完成标准 / 证据 |
| --- | --- | --- | --- | --- |
| 43-A1 | 技术 | 原生 Markdown、公式、库内图片与预算截取 | ✅ 已完成 | [原生功能结果](NATIVE_RESULT.md) |
| 43-A2 | 技术 | 笔记、重复标题源行、内部链接跳转 | ✅ 已完成 | 原生集成覆盖，图谱标签页保留 |
| 43-A3 | 技术 | 增删改名监听、防抖、过期任务取消、保留旧图和状态恢复 | ✅ 已完成 | 原生 31 项；4.4 回归通过 |
| 43-P1 | 产品 | 历史反馈：Ctrl 预览并非每次触发；固定阅读和跳转自然 | ✅ 已验收（修复后） | 保留原反馈背景；0.0.3 经 45-P6 / 45-P7 / 45-P8 独立库、副本与日常库用户验收，当前卡顿/漏触发未再出现 |

## Step 4.4 — 设置与真实库试用准备

| ID | 责任人 | 工作 | 状态 | 完成标准 / 证据 |
| --- | --- | --- | --- | --- |
| 44-A1 | 技术 | 范围、排除笔记、目录映射及不读正文的范围检查 | ✅ 已完成 | [设置结果](SETTINGS_RESULT.md) |
| 44-A2 | 技术 | 自动更新、防抖、预览开关和字符预算设置 | ✅ 已完成 | 设置界面与实际行为验收通过 |
| 44-A3 | 技术 | 配置持久化、旧字段保留、输入校验和写入失败保护 | ✅ 已完成 | 重载持久化与 Node 契约检查通过 |
| 44-A4 | 技术 | 构建进度、完成数量与耗时、失败、取消和重试反馈 | ✅ 已完成 | 旧图保留、迟到结果取消、状态条避让检查通过 |
| 44-A5 | 技术 | 独立测试库回归，再按已确认范围建立试用副本 | ✅ 已完成 | 原有 88 + 设置 24 项；副本 95 篇笔记 / 567 张图片 |
| 44-A6 | 技术 | 验收真实副本、记录证据与限制 | ✅ 已完成 | 副本 17 项；共 129 项集成通过（2026-10-26） |
| 44-P1 | 产品 | 提供真实库源路径 | ✅ 已完成 | 用户在本聊天确认 `D:/obsidian_vault/hush-ob-bucket` |
| 44-P2 | 产品 | 确认副本位置和复制范围 | ✅ 已完成 | 用户确认 `real-vault-trial/` 及两个目录与引用图片 |
| 44-P3 | 产品 | 实际体验设置和构建反馈，确认是否易用 | ✅ 已验收 | 用户反馈：添加 Interest 和 Medical and Health 文件夹，保存设置重新构建成功，符合预期；不代表扩大技术侧复制范围 |

## Step 4.5 — 产品体验与问题收敛（日常试用准备已完成）

本步开始把用户体验反馈作为持续输入。产品负责判断价值与优先级，技术负责把问题复现并给出实现方案；不要求产品负责人先写技术解决方案。

| ID | 责任人 | 工作 | 状态 | 完成标准 / 证据 |
| --- | --- | --- | --- | --- |
| 45-P1 | 产品 | 选出最重要的 2–3 个使用场景与期望 | ⏳ 待办 | 例如“从主题找到笔记”“看相关知识”“预览后定位标题”，可直接在反馈区填写 |
| 45-P2 | 产品 | 在日常学习中体验缩放/拖拽、搜索/过滤、预览/跳转、范围设置与自动更新 | ✅ 已验收 | 学习遇到卡点的反馈：1、`Ctrl` +悬停后预览不是每次操作都能触发，不知为啥。2、按 `Esc` 会自动跳转到知识图谱标签页左侧那个标签页对应的笔记，直接跳转出知识图谱标签页了，这是不符合预期的，体验差。3、|
| 45-A1 | 技术 | 根据需要提供启动与体验指引，将反馈整理为可复现任务 | ✅ 已完成（首批反馈） | 保留用户原始验收反馈，整理 FB-002 / FB-003；TODO 当前反馈以本地提交 bf5c3c2 建立基线，后续可 git diff |
| 45-A0 | 技术 | 核对昨日构建并安装日常试用版本，提供启用和停用方法 | ✅ 已完成 | 2026-10-27 经安装权限确认；四文件哈希核验；记录见 `.local/daily-install-receipt.json`；未自动启用 |
| 45-P0 | 产品 | 在日常库启用 Knowledge Graph Smoke，打开当前库图谱 | ✅ 已完成 | 用户明确已学习试用约 1–2 小时；本轮观察到日常库当前图谱窗口 |
| 45-A2 | 技术 | 复现已选择的问题，提出方案并估计影响范围 | ✅ 已完成初步定位；完整日常现象待复验 | 独立 Obsidian 1.14.5 复现 Ctrl 焦点漏触发和 Esc 切走标签；用户日常库“点击后也失败”尚不能由此全部解释，保留后续定位项；见 [交互修复结果](INTERACTION_RESULT.md) |
| 45-P3 | 产品 | 从已整理问题中选出本轮最重要的 1–3 项，确认涉及交互改变的方案。已发现部分问题 | ✅ 已发现问题 | 本轮范围明确；其余留在候选列表 |
| 45-A3 | 技术 | 完成选定修复、相关回归和视觉证据，交付可体验版本 | ✅ 已完成（独立库已验收） | 0.0.2：16 项新交互 + 31 项原生 + 17 项浏览器 + 24 项冒烟及 Node 检查通过，Canvas 逐像素一致；用户明确反馈独立库体验奏效，日常升级见 45-A4 |
| 45-P4 | 产品 | 对照期望复验修复，确认通过或补充问题 | ✅ 已验收（独立库） | 2026-10-27 用户反馈：“奏效了！我在独立库体验感觉非常好，顺畅多了！”并明确同意升级日常库测试；不据此宣称日常库长期使用已验收 |
| 45-A4 | 技术 | 按明确授权升级日常库至 0.0.2，备份旧版并核对配置 | ✅ 已完成（文件升级） | 只替换 main.js、manifest.json、styles.css，三文件哈希一致；data.json 前后哈希不变；旧三文件已备份，回执 `.local/daily-upgrade-0.0.2-receipt.json`；未主动重启或操作用户界面 |
| 45-P5 | 产品 | 重新加载日常库插件，持续学习并反馈 Ctrl / Esc 表现 | ✅ 已验收(日常库) | 2026-10-27 用户重新加载；进入日常学习试用后。发现：1、Esc 表现 取消选中正常了。2、Ctrl 表现 仍然不符预期，但凡按住Ctrl想预览，插件界面就会卡死，并且有具体记录后台任务管理器截图 |
| 45-A5 | 技术 | 根据日常卡死反馈验证预览负载、请求取消和资源清理，提供独立候选 | ✅ 已完成（负载保护）；完整根因继续定位 | 0.0.3：14 项新增检查、31 项原生、16 项真实键盘及三组 Node 检查通过；只有独立库升级，三个合成体验样本已打开。行为变化与限制见 [预览负载结果](PREVIEW_LOAD_RESULT.md)，不宣称日常卡死已修复 |
| 45-P6 | 产品 | 在独立 test-vault 体验 0.0.3 的短笔记、密集公式与长笔记标题预览 | ✅ 已验收 | Ctrl 松开、固定阅读、Esc，以及截取提示和目标标题定位符合预期，test-vault 体验顺畅 |
| 45-A6 | 技术 | 在已授权 real-vault-trial 副本验证 0.0.3 的真实长文、公式和图片预览 | ⏳ 版本交付完成；用户核心场景复验通过；自动检查待补 | 旧 0.0.1 已备份并同步为验收产物 0.0.3，哈希一致，data.json 不变，回执 `.local/trial-upgrade-0.0.3-receipt.json`。45-P7 用户复验通过；未通过调试接口确认运行版本，未补跑副本公式/图片、耗时及资源清理自动检查，不把用户体验扩大为全量技术验证 |
| 45-P7 | 产品 | 重载真实副本 0.0.3，并复验 Ctrl 预览与 LTI analysis 内选中后的 Esc | ✅ 已验收 | 用户本次实际反馈：1、Ctrl 卡顿消失。2、Ctrl 悬停可以预览。3、放大进入 LTI analysis 实心圆并选中内部元素后按 Esc，没有切到该笔记标签。该问题也解决。总结：目前为止，一切功能正常。【历史说明：0.0.1 是上次升级前的副本安装版本；现已同步 0.0.3，本次为同步后的用户复验。】 |
| 45-A7 | 技术 | 将已验收的 0.0.3 安装到日常库，备份三个旧运行文件并保留设置 | ✅ 已完成（文件升级） | 用户明确授权；旧 0.0.2 三文件备份至 `.local/backups/daily-plugin-before-0.0.3-20261027T122600524184Z`，替换后三文件哈希与验收产物一致，data.json 前后哈希不变。回执 `.local/daily-upgrade-0.0.3-receipt.json`；未操作用户窗口、未改笔记 |
| 45-P8 | 产品 | 在日常 hush-ob-bucket 重载 0.0.3，复验 Ctrl 预览、固定阅读及 Esc，并继续学习观察 | ✅ 已验收 | 设置 → 第三方插件 → 关闭再开启 Knowledge Graph Smoke，确认显示 0.0.3，再用“从当前库构建知识图谱”打开图谱；反馈：卡顿/漏触发问题没有出现，且暂时没有发现其他问题。 |

## Step 4.5B — 手动调整布局（0.0.6 保存与恢复已通过本轮体验验收）

用户已明确希望在正式上线前增加可移动圆、同父兄弟联动避让、连线同步调整。推荐使用显式“调整布局”模式，普通阅读模式保持 0.0.3 契约；具体模式、动效和根级范围在原型中确认。详细规格见 LAYOUT_EDITING_PLAN.md。下列任务是交接计划，不代表已经实现或授权日常库新版本安装。

| ID | 责任人 | 工作 | 状态 | 完成标准 / 证据 |
| --- | --- | --- | --- | --- |
| ME-P0 | 产品 | 提出首发前新功能及期望效果 | 已完成 | 用户明确移动圆、同父兄弟像被推开一样联动、连线跟随，强调定制、维护与交互体验 |
| ME-AH | 技术 | 核对接入点，整理产品/技术方案和下一位智能体交接 | 已完成（规划） | LAYOUT_EDITING_PLAN.md、HANDOFF_NEXT.md；只读核对坐标、命中、相机拖拽、重建和保存逻辑，未修改运行代码或新增测试 |
| ME-A0 | 技术 | 建立可还原的本地源码基线，核对稳定产物和私有文件边界 | 已完成（本地归档） | 60 文件白名单备份至 `.local/baselines/before-layout-20261029T014251900429Z/`，ZIP 解压后重建三运行文件与 0.0.3 哈希一致；未含笔记/配置/快照。Git 仍仅跟踪 TODO，公开筛选与纳入版本管理另行完成；见 LAYOUT_PROTOTYPE_RESULT.md |
| ME-A1 | 技术 | 制作合成圆/子树的可交互原型，验证密集容器中的避让可行性 | 已完成（合成原型） | `prototypes/layout-edit/`：三场景、隐藏占位、父级手柄、连线跟随、整组撤销/重做与取消。17 项几何检查含 600 次移动、17 项浏览器检查通过，用户手感反馈通过；真实 packing 可移动空间与正式集成仍待验证，见 LAYOUT_PROTOTYPE_RESULT.md |
| ME-P1 | 产品 | 体验原型并确认入口、动效和移动范围 | 手感已验收；全层级范围已明确 | 用户原型反馈好拖、让位自然、暂未发现别扭；随后明确文件夹、笔记、标题均应可调整，包含顶层。旧“根级暂不开放”建议失效；完整产品仍待后续验收 |
| ME-A2 | 技术 | 接入 GraphCore/HUD 的编辑模式、命中、几何与生命周期 | 已完成，0.0.5 全层级拖动经用户验收 | 2026-10-29 用户在 test-vault-layout-fix 和原 test-vault 确认文件夹/笔记/标题（含顶层）拖动、避让、子树及连线跟随正常，其他功能暂时正常。此前技术证据：16 浏览器+18 原生检查、60 非根/8 根级及相切回归通过，本轮未重跑。见 FB-004、LAYOUT_ROOT_FIX_RESULT.md；布局仍会话有效 |
| ME-A3 | 技术 | 实现布局持久化、撤销/重做、恢复自动布局及重建兼容 | 已完成，本轮用户体验验收通过 | 2026-10-29 用户反馈“体验结束，所有功能暂时符合预期”。0.0.6 已实现保存、50 次会话历史、局部/全库恢复、兼容重建、改名迁移、失效回退、多视图与写失败保护。此前 20 项状态、16 项浏览器、18 项原生交互、22 项原生持久化及几何/三组 Node 检查通过；本轮未重跑。详细证据/边界见 LAYOUT_PERSISTENCE_RESULT.md |
| ME-A4 | 技术 | 验证性能与完整交互，在独立库及授权副本交付候选 | 已完成（限定测试范围，2026-10-30 核对交付） | 0.0.6：8 档 Node/浏览器性能与取消清理；真实副本 95 篇/3310 节点、27 项验证通过，662 个原始文件与本轮前基线一致。128 相切组测试轨迹不能移动，200 同级/5010 子树拒绝；首场景 RAF 279.8 ms 异常及长期内存未测边界如实保留。见 LAYOUT_PERFORMANCE_RESULT.md；运行代码未变 |
| ME-P3 | 产品 | 用真实场景验收布局调整是否顺滑、可控、便于整理 | 已验收（2026-10-30） | 用户明确已体验 real-vault-trial 0.0.6，反馈“所有功能暂时都符合预期”。据此完成真实场景本轮验收，无需再重复同一轮体验；保留“暂时”的观察范围与既有结构回退、密集组受限等边界，不推定长期稳定性或日常升级授权 |
| ME-A5 | 技术 | 固定新候选版本、安装包、更新记录和回退方案 | 已完成（2026-10-30） | 固定 0.0.6 三文件包及哈希，26 个构建源文件本地归档；独立解压重建三个文件与验收产物相同。更新记录与回退说明见 RELEASE_006_RESULT.md；未发布或 push |
| ME-P4 | 产品 | 决定候选是否进入日常试用及首发功能冻结 | 日常试用已授权；首发功能冻结待决定 | 2026-10-30 用户明确“我决定进入日常库试用”。据此执行 ME-A6，不把该决定扩展成首发功能冻结或公开发布授权 |
| ME-A6 | 技术 | 按授权备份并升级日常库至 0.0.6 | 已完成（磁盘安装） | 只替换 main.js/manifest.json/styles.css，逐文件哈希匹配；data.json 前后相同，原四文件留本地备份。回执 `.local/daily-upgrade-0.0.6-receipt.json`；未操作日常笔记 |
| ME-P5 | 产品 | 在日常库重载 0.0.6 并体验学习场景 | 已完成（原规划功能暂时符合预期） | 2026-10-30 用户明确日常体验结束，反馈原规划功能暂时正常、体验不错；同时提出 FB-005，单独跟踪，不据此宣称长期稳定性全部通过 |
| ME-A7 | 技术 | FB-005 重建时布局连续性的复现与方案 | 已完成（诊断与方案） | 6 个合成场景确认标题 ID、整篇 outline 和尺寸精确比较导致过度失效；见 LAYOUT_CONTINUITY_PLAN.md。新增基线探针，不代表修复已实现 |
| LC-A1 | 技术 | 稳定布局身份、标题改名迁移与局部兼容检查 | 已完成（功能并入 0.0.9 本轮验收） | 唯一标题单次改名、父标题及后代迁移、冷启动和旧记录补齐已实现；12 新增 + 20 状态 + 16 浏览器 + 11 原生检查通过，60 非根/8 根几何通过。重复标题/单标题笔记及复杂编辑暂保守回退；详见 LAYOUT_RENAME_RESULT.md |
| LC-A1b | 技术 | 扩展改名匹配：单标题、可区分的同名标题、旁支正文编辑 | 已完成（功能并入 0.0.9 本轮验收） | 10 扩展 + 13 改名 + 20 状态 + 16 浏览器 + 16 原生检查通过；同名父级/编号迁移、单标题与旁支正文支持，歧义拒绝。详见 LAYOUT_RENAME_EXTENDED_RESULT.md |
| LC-A2 | 技术 | 增删元素与尺寸变化后的局部布局修复 | 已完成（0.0.9，本轮体验暂时符合预期） | 以旧位置为起点、空位优先和有界局部避让，保留兼容旁支；12 增量场景、28 原生、16 浏览器及状态/改名/几何回归通过。纯增删支持，混合替换/层级变化及歧义仍回退。见 LAYOUT_INCREMENTAL_RESULT.md |
| LC-P1 | 产品 | 独立库体验布局连续性改进 | 已验收（0.0.9，本轮范围） | 2026-10-30 用户明确“暂时都符合预期，开始下一步吧”。据此记录本轮候选体验通过，不扩展为复杂编辑或长期稳定性结论，也不倒填 0.0.7/0.0.8 分别体验记录 |

执行顺序：ME-A0 → ME-A1 → ME-P1 → ME-A2 / ME-A3 → ME-A4 → ME-P3 → ME-A5 / ME-P4 → ME-A6 / ME-P5 → ME-A7。新增建议：LC-A1 → LC-A1b → LC-A2（分批交付及 LC-P1 验收）→ 46-* → 47-* → 48-*。源码整理可提前，最终发布回归必须覆盖新功能候选。

## Step 4.6 — 桌面稳定性（深色主窗口验证进行中）

| ID | 责任人 | 工作 | 状态 | 完成标准 / 证据 |
| --- | --- | --- | --- | --- |
| 46-P1 | 产品 | 确认本轮目标使用环境：主题、分屏、独立窗口及常用插件组合 | ✅ 已确认（2026-11-01） | 用户明确“深色主题，主窗口内使用”；2026-11-01 用户确认第三方插件组合为 Dataview、Templater、Obsidian Git、Style Settings、Omnisearch、Excalidraw，并授权在独立测试库安装验证 |
| 46-A1 | 技术 | 核实实际运行版本，补验 Obsidian 1.14.5 | ✅ 已完成（版本核实） | 运行 0.0.9 / Obsidian 1.14.5，安装程序 1.6.7、Electron 30.1.2；深色独立库，见 DESKTOP_STABILITY_RESULT.md；稳定性异常另归 46-A3 |
| 46-A2 | 技术 | 检查浅色主题的可读性、分屏与弹出独立窗口 | ✅ 已完成（2026-11-01，独立库） | 阶段一在 9247/0.0.11/Obsidian 1.14.5 实测：A 深色基线正常；B 浅色可读、图谱画布保持深色（`canvasLum` 46.2→46.1，属 DEC-001）；C 主窗口分屏两实例各自渲染；D 拖动保存 `revision 1039→1040`、撤销回 1041；E 弹出窗口+跨窗移动+关闭后主窗口保留；F Ctrl 预览与 Esc 正常；G 全部释放后重开正常。事件/坐标/资源归属均按视图实例核对，见 COMPAT_MATRIX_RESULT.md；图谱是否跟随主题仍待产品决定 |
| 46-A3 | 技术 | 反复开关视图、切换设置、隐藏恢复、取消任务和插件重载 | ⏳ 进行中（FB-006 已定因为测试驱动 reload 产物、非插件；90 分钟长时观测已通过，按需复跑） | 30 开关、10 设置、10 竞态及10插件重载等断言通过；51 项中 50 通过，无未捕获错误项失败。app.js getZoomFactor 异常及 illegal access 原未定因，不宣称完成；见 DESKTOP_STABILITY_RESULT.md。2026-11-01 原生复跑（Obsidian 1.6.7 / Electron 30.1.2 / 插件 0.0.10，9242 未重启）：A 开→拖→存→关→重开 20/20、D 开关 30/30 + 重载 10/10、有效对照（禁用插件）20/20；历史两条异常 0 次复现，但未采集宿主主进程 stderr、运行版本≠历史版本，不宣称修复；`fileManager.renameFile` 挂起在插件禁用下同样复现→宿主/环境。缺口见 `.local/native/evidence/FB006_report.md`。2026-11-01 补宿主主进程通道（9242 带 `--enable-logging` 重启，stderr/stdout 落盘）：图谱开→关×10、About×2、快速重建竞态×8、快速抖动×8，宿主 stderr 无 `illegal access`/`getZoomFactor`/`FATAL`/`Uncaught`，渲染侧 0 异常；通道验证有效（捕获启动期 EADDRINUSE、DevTools 监听、1.14.5 更新检查），见 `.local/evidence/native-011/FB006_LOGGED_ATTEMPT.md`。2026-11-01 晚 FB-006 定因：Playwright 注入式驱动对渲染页 reload 触发 `illegal access`（插件完全禁用仍 4 条、纯 CDP 0 条、0.0.9/0.0.10 相同）→ 非插件缺陷；`getZoomFactor` 属宿主标题栏 `updateStatus` 失效窗口代理，本轮未复现。详见 FB-006 小节与 `.local/evidence/fb006-repro/RESULT.md`。2026-11-02 完成 90 分钟长时资源观测（9249，vault-real 3310 节点，0.0.11）：**5,401 s / 540 次采样 / 89 次重建 / 17 次隐藏→恢复，failures 空、渲染异常 0**；heap 首 10 次均值 41.32 MB → 末 10 次均值 52.13 MB（区间 38.12–90.99 MB 锯齿波动，无单调增长）；fps p50 63.9 / p95 67.0（最低 1.0 为重建/恢复瞬间采样）；磁盘 rev83 / groups0 / dataBytes 530 B 全程不变，busy/unsupported 全程 false；观测结束已关闭实例。证据 `.local/evidence/longrun-46a3/{longrun.jsonl,result.json}`，汇总见 `DELIVERY_48A2_RESULT.md` §3 |
| 46-A4 | 技术 | 在已确认的第三方插件组合中验证 Markdown 预览与卸载 | ✅ 已完成（2026-11-01，限独立库与所列版本） | 阶段二在 9248/vault-012 安装并加载 7 插件（knowledge-graph-smoke 0.0.11、dataview 0.5.68、obsidian-git 2.41.1、obsidian-style-settings 1.0.9、excalidraw 2.28.1、templater 2.26.0、omnisearch 1.32.0）：拖动保存/撤销、增删与改名标题、文件与目录改名后布局身份迁移、预览内容（公式/表格/图片/链接/Dataview/Callout/Templater）、真实 Ctrl+Z、禁用启用、卸载重装均通过；发现第三方模态框会拦截画布输入（Excalidraw 欢迎页、改名“更新链接”弹窗），非插件缺陷；卸载按宿主语义删除插件目录与 data.json。未把结果扩大为所有插件组合兼容，见 COMPAT_MATRIX_RESULT.md |
| 46-P2 | 产品 | 体验修复后的桌面表现，确认主题与窗口体验 | ✅ 已验收（技术已完成 2026-11-01） | 技术证据见 COMPAT_MATRIX_RESULT.md；确认：浅色主题下“应用变浅、图谱画布保持深色”可接受（DEC-001）、分屏/弹窗/跨窗移动体验、卸载会删除已保存布局符合预期 |

## Step 4.7 — 连续编辑与规模性能（首轮合成验证进行中）

| ID | 责任人 | 工作 | 状态 | 完成标准 / 证据 |
| --- | --- | --- | --- | --- |
| 47-P1 | 产品 | 说明目标使用规模和可接受等待；决定是否扩大副本范围 | ⏳ 待决定 | 当前只授权两个目录，扩大复制单独确认 |
| 47-A1 | 技术 | 给出测试规模、持续时间和指标方案，区分原路线图目标与当前已验证能力 | ✅ 已完成（首轮方案） | 首轮：合成 100/1000/5000 标题分档，每档12轮改名/增删；独立库120次自动更新短测，记录构建/布局/写盘、Worker及堆样本。不是30分钟或2万节点验收 |
| 47-A2 | 技术 | 在合成库与授权副本测连续保存、批量增删改名、重复预览和重建 | ✅ 已完成（技术验证：授权副本 30 分钟连续压力 + 结构/改名/泄漏验证，2026-11-02；体验：用户在日常库 0.0.12 的 1–2 天自用验收完成，2026-11-03） | 历史120次短测及两轮同实例分阶段A/B（NATIVE_AB_RESULT.md）；2026-10-31 5档多组核心对照（LAYOUT_SCALE_RESULT.md）；2026-11-01 原生 0.0.11（9243）30 分钟 1161 轮 0 失败（continuous-011/RESULT.md）。2026-11-01～02 授权副本（vault-real：95 篇、3310 节点、3406 边，插件 include 内合成笔记）真实 30 分钟连续压力：384 轮/1802.1s、失败 0、渲染异常 0；重建 809 次 p50 0.400s/max 0.890s；预览 38/38（中位 1.0s）、隐藏→恢复 38/38（1.69s）、拖动 38 次（9 次保存、29 次幂等“布局未改变”）；磁盘 revision 68、布局 JSON 90,459B、data.json 136,283B；渲染堆 51–170MB 锯齿无单调增长（p50 87.5MB）；帧率 p50 65.1/min 59.7；结束恢复笔记、重建 3310 节点，95 个私有 md sha256 全部未变。结构/改名（include 内合成笔记）：拖动保存 rev76→77 且重建坐标不变；加标题 rev78 局部修复位移 delta(dx 2.688,dy -0.834,rel 0.967)；笔记改名 rev79 groups 键迁移（oldKeyGone）、目录改名 rev80 键迁移、改回 rev82 键恢复；删除 rev83 清理 groups/structures；布局磁盘/状态/store 均无正文泄漏（note.excerpt 为内存悬停预览、不持久化）。证据 REAL_VAULT_RESULT.md、`.local/evidence/continuous-real/{continuous-real.jsonl,result.json,structural-v2.json}`；未运行体验验收（待用户） |
| 47-A3 | 技术 | 针对实测瓶颈优化并回归，判断是否值得引入增量策略 | ✅ 已完成（技术回归 + 用户体验验收，2026-11-01） | 2026-11-01 本地 0.0.11 完成 schema3：outline/identity 从每组记录提升为按笔记共享的 `structures[noteKey]`，组记录只留 shape/points/note/路径无关结构摘要（改名后仍可应用），schema1/2 懒迁移、写失败保留旧数据、旧版本拒绝 schema3 不毁数据。`npm test` 10 脚本全过。同机同进程 0.0.10→0.0.11：单篇5000标题/10组记录 11,496,712→875,447 B、模型+协调+JSON p50 472.5→93.1ms；1000标题/10组 2.26→0.19MB、92.3→16.7ms；50篇各1组 1.19→0.92MB、66.9→40.8ms（核心合成口径，不含 Worker/UI/磁盘）。脚本 scripts/layout_scale_ab_0_0_10.mjs，见 LAYOUT_SCALE_RESULT.md。独立复核（teammate bench-verifier，未改 src）：7 场景语义 EQUIVALENT、契约 5 项通过，5 档字节比 0.082–0.772、时间比全 <1、堆比 0.072–0.731，见 `.local/evidence/schema3/REPORT.md`。原生 0.0.11（9243，Obsidian 1.14.5 页面/Electron 30.1.2）：真实鼠标拖动→“布局已保存”→磁盘 schemaVersion=3，原生命令重建后节点 dx=dy=0.0 完全恢复；Esc 取消提示“调整中 · Esc 取消”→“已取消本次调整”、磁盘与 rev 不变；Ctrl+Z 撤销生效；同笔记两个组（note 键 + heading 键）持久化后 `structures` 仅 1 条且共享同一 noteKey。后补：30 分钟原生连续压力 1161 轮 0 失败、拖动/保存 20/20 与撤销 4/4、schema3 冷启动 rev/坐标一致（证据 `.local/evidence/continuous-011/RESULT.md`、`cold-load-011.json`）。已 commit `13933dc` 并 push 到 origin/main，GitHub pre-release `v0.0.11` 已发布（2026-11-01；日常库于同日获用户明确授权后升级至 0.0.11，见 47-A4）；47-P3 用户已于 2026-11-01 验收（13:50–15:39 试用到的功能暂时符合预期，见 `47-P3_PRODUCT_SITE_ACCEPTANCE_REPORT.md`；验收截图按私有约束仅本地保存、不入公开仓库） |
| 47-P2 | 产品 | 判断等待、卡顿和降级提示是否可接受 | ✅ 已验收(体验时间从2026/11/1/13:50-2026/11/1/15:39) | 现阶段，以现在笔记库规模，判断等待、卡顿和降级提示可接受 |
| 47-P3 | 产品 | 体验 0.0.11（schema3 多组共享），独立库或日常库 | ✅ 已安装日常库 0.0.11，已验收(2026/11/1 13:50–15:39)；2026-11-03 又完成 0.0.12 日常库 1–2 天自用体验（`product-site-acceptance/product-site-acceptance-report/v0.0.12_PRODUCT_SITE_ACCEPTANCE_REPORT.md`）。试用到的所有功能暂时符合预期 | 2026-11-01 用户明确授权直接升级日常库并随后人工体验（要求需要验收时提醒）；日常库已替换三文件，data.json 待首次建图迁移；验收步骤、预期提示与回退方式见 `.local/acceptance-daily-0.0.11.md`；产品报告已迁移至 `product-site-acceptance/product-site-acceptance-report/47-P3_PRODUCT_SITE_ACCEPTANCE_REPORT.md`（Node 1 已更正），截图在 `product-site-acceptance/product-site-img-evidence/`（仅本地，已 gitignore）。技术通过不代替体验验收 |
| 47-A4 | 技术 | 按明确授权备份并升级日常库至 0.0.11，预演迁移 | ✅ 已完成（文件升级 + 双实例预演） | 2026-11-01 用户明确授权；旧 0.0.6 四文件与 SHA256SUMS 备份至 `.local/backup-daily-0.0.6/`；日常库仅替换 main.js（sha256 `205b1bd0…`，与本地候选一致）/manifest.json（0.0.11）/styles.css，data.json 未主动改写（820,827B、schema1 rev87、3 组）。升级前以日常库完整 md 副本 + 最小 .obsidian 建 9244 预演：首次建图 schema1→3 rev87→88、groups 3、structures 0、data 486KB→8.8KB、`apply` restored 1/skipped 2；9245 对照 0.0.6：restored 0/skipped 3（`Analog IC.md` 自 10-30 有 10 个标题改名，0.0.6 同样拒绝）→ 升级不丢 0.0.6 当前已能应用的布局。两实例已关闭。回退见验收清单 |

## Step 4.8 — 桌面试用版本与交付（上线准备，发布需明确授权）

| ID | 责任人 | 工作 | 状态 | 完成标准 / 证据 |
| --- | --- | --- | --- | --- |
| 48-P1 | 产品 | 确定首个版本是仅自己使用 | ✅ 首发渠道已决定：仅自用（2026-11-02） | 当前插件仍个人试用；2026-11-01 已授权推送公开仓库供开发交接。邀请试用、正式安装包 Release / 社区目录路径仍需决定 |
| 48-P2 | 产品 | 确认正式名称为`knowledge-map`、版本范围(大于 0.0.11 )、必须修的问题(现阶段暂无)、及可接受限制(现阶段暂未发现) | ✅ 已决定（2026-11-02）：名称 `knowledge-map`（显示 `Knowledge Map`）、版本 0.0.12 候选、`minAppVersion` 1.6.7（已在 1.6.7 与 1.14.5 实测）、`isDesktopOnly: true`、首发仅自用；描述已由用户确认（2026-11-02，即 manifest 现有英文） | 有可交付的范围，不以“所有想法都做完”为结束条件 |
| 48-A1 | 技术 | 整理 manifest、安装包、安装/升级/卸载说明与已知限制 | ✅ 已完成（文档 + 打包脚本 + 空白库验证，2026-11-02） | `scripts/package.mjs` 校验 manifest/package 版本一致、拒绝 smoke-payload.json/data.json、只复制 main.js/manifest.json/styles.css 并写 SHA256SUMS 到 `.local/release/<version>/`；`docs/INSTALL.md` 覆盖安装/升级（schema1/2→3 自动迁移）/回退/卸载（会删 data.json）/库信任提示/数据与隐私/已知限制/反馈模板，README 与 DEVELOPMENT 已加入口。空白库 9250（vault-blank，只有三文件）验证 A–E 全过：仅三文件安装可见；空库首次建图 phase=empty 友好提示且无异常；建 3 篇笔记后 11 节点、`LEAK-BLANK-MARKER` 未进入 data.json/状态消息/错误（note 节点悬停 excerpt 为既有内存交互）；设置 debounceMs=600 落盘、禁用/启用后保留；卸载删除插件目录与 data.json。证据 `.local/evidence/delivery-48a1/blank-vault.json`（verdict pass）。manifest 的 name/description 仍为内部文案（Knowledge Graph Smoke / Stage 4 smoke test），待 48-P2 决定正式名称与平台声明 |
| 48-A2 | 技术 | 核对最终产物与版本，运行适合交付范围的最终回归 | ✅ 已完成（0.0.12 候选技术回归 + 用户日常库自用体验验收，2026-11-03） | 2026-11-02 候选 0.0.12：manifest 名称 `Knowledge Map`、版本 0.0.12、minAppVersion 1.6.7、isDesktopOnly true；`main.js` 不变（`205b1bd0…`/325,976 B），manifest 291 B `6fcc0b52…`；`node scripts/test.mjs` 10 脚本全过；`node scripts/package.mjs` → `.local/release/0.0.12/`（三文件 + SHA256SUMS，拒绝私有快照/data.json）。平台实测：Obsidian 1.6.7（自带）插件加载/构建就绪/拖动保存 rev1049→1050/Ctrl+Z/重建 pass（`compat-matrix/phase-167.json`）；Obsidian 1.14.5 拖动 rev1051→1052、撤销 rev1053、磁盘 schema3 rev1053 groups30 structures6（`compat-matrix/drag-9252.json`；首次失败因 Excalidraw 欢迎弹窗挡住画布）；空白库 9253 五项 A–E 全过（`delivery-48a1/blank-vault.json` verdict pass，md 0 起测）。报告 `DELIVERY_48A2_RESULT.md`。2026-11-03 用户日常库 1–2 天自用体验通过（`product-site-acceptance/product-site-acceptance-report/v0.0.12_PRODUCT_SITE_ACCEPTANCE_REPORT.md`，Node 4–8 符合预期；体验期间库内 data.json 正常增长至 rev302/groups12/structures5）。候选未 push、未发布，发布动作属 48-P3 |
| 48-P3 | 产品 | 验收正式交付包，决定是否对外发布 | ⏳ 待决定（0.0.12 自用体验已通过；UI/UX 打磨后以 0.0.13 首次正式发布，社区目录提交另定） | 已批准 0.0.6 日常试用及 2026-11-01 源码交接推送；0.0.12 已装入日常库体验通过（报告见 `product-site-acceptance/`），正式 Release / 社区目录发布仍未确认 |
| 48-A3 | 技术 | 按授权执行安装/交付操作并记录结果 | ✅ 个人安装已完成；正式交付待办 | 个人试用见 45-A0；正式包和对外分发仍依赖后续验收与授权 |

### 上线前建议（2026-10-27，待确认，不代表发布授权）

这里按“供其他人安装使用，并可能进入社区目录”提出建议。用户最新要求先完成 4.5B 新交互，再进入以下准备；用户负责首发范围、正式名称、体验接受标准及是否发布，技术负责验证、可复现构建、交付资料和问题修复。以下具体测试参数与分发方式仍为建议，未执行项目不能计为通过：

1. **确定首发范围（48-P1 / 48-P2）**：建议先桌面小范围试用，明确实际支持的平台与 Obsidian 版本，移动端和阶段 5 暂不阻塞首发。当前 manifest 为 `isDesktopOnly: false`，移动端未验收；最低版本 1.5.7 也尚无完整兼容验收。上线前补测或收紧声明。正式名称、插件 ID 与现有用户设置迁移需一起考虑。
2. **稳定性与实际规模（46-A3 / 47-A1 / 47-A2）**：建议先测试 30 次打开/关闭、隐藏恢复与重载，以及约 30 分钟连续编辑/预览，再分档测试合成规模。次数与时长是测试方案建议，不是稳定性保证；重点检查无卡死、迟到结果覆盖、持续资源累积，记录构建耗时和预览响应。用户继续自然学习即可，不要求反复触发故障。
3. **内容和边界（45-A6 / 46-A4）**：补齐真实长文、公式、图片、重复标题、缺失链接、嵌入、重命名/删除与排除范围；特别检查嵌入是否绕过排除规则。禁止路径只用合成替身验证，绝不读取实际文件。第三方插件组合仅按实际目标环境逐项验证。
4. **陌生用户首次使用（48-A1 / 48-P3）**：在空白库验证安装、首次建图、空范围提示、快捷键说明、设置保存、升级保留配置和卸载。用可公开合成示例提供短演示、已知限制和反馈模板；建议邀请 3–5 位试用者按正常学习场景体验，再决定公开发布。
5. **源码与发布工程（48-A1 / 48-A2）**：本次核对 Git 仅跟踪 TODO.md，源码、脚本和 manifest 等仍为 untracked；需先筛选可公开内容，形成可还原的源码基线，补 LICENSE 与来源说明，并验证全新检出可构建。当前构建会将本地 smoke-payload.json 放入 dist，正式包须用三运行文件白名单，不能直接发布整个 dist 或工作区；公开仓库、历史记录、README 和演示图也需检查私人内容。正式产品移除依赖本地快照的冒烟命令。
6. **社区发布准备（48-A3，依赖明确授权）**：按 [官方发布流程](https://docs.obsidian.md/plugins/releasing/submit-plugin) 准备公开源码、README、LICENSE、manifest 和与版本匹配的 GitHub Release；上传 main.js、manifest.json、styles.css 三个独立附件，经社区目录提交及审核后才进入插件市场。[提交要求](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins) 与 [开发者政策](https://docs.obsidian.md/community-directory/developer-policies) 在发布前再核对。不在本轮创建公开仓库、push、邀请他人或提交审核。

建议的首发门槛：目标环境内无未解决的阻断使用问题，安装/升级/卸载通过，长时间和目标规模检查有证据，新用户能靠说明独立完成建图与预览，产物可从已记录源码重建，公开资料不含私人内容。AI 增强、移动端和大规模架构改造可后续评估。

## 2026-11-01 — Git 源码交接

| ID | 责任人 | 工作 | 状态 | 完成标准 / 证据 |
| --- | --- | --- | --- | --- |
| HX-P1 | 产品 | 授权源码/文档 commit、关联指定远程并 push，用于下一 agent clone 接手 | 已确认 | 用户本轮明确请求；仓库 xidianhush/knoeledg-graph-obsidian-plugin；不含正式 Release 与社区发布 |
| HX-A1 | 技术 | 筛选可公开文件，更新交接和后续计划，补齐干净 clone 构建/测试入口 | 已完成 | HANDOFF_NEXT.md、DEVELOPMENT.md；工作区及干净暂存区检出 npm test 均通过（构建+10个合成脚本），主程序哈希与0.0.10一致；私有数据继续排除。见 HANDOFF_VALIDATION_RESULT.md |
| HX-A2 | 技术 | Commit、关联远程、push 并核对远端提交 | 已完成 | 2026-11-01 源码交接提交 013cbb661b103a0a406c2f4cd103162b17c7b3b2 已推送，ls-remote 确认远端默认分支 main / HEAD 与之相同。origin 为指定 SSH 地址；普通推送，未 force。后续仅补本条完成回执，最新提交以远端 main 为准 |

后续执行顺序：46-A2/A4 兼容矩阵**已完成（2026-11-01，阶段一核心环境 + 阶段二 7 插件，见 COMPAT_MATRIX_RESULT.md）**，46-P2 产品确认已完成（0.0.12 日常库自用体验亦已通过，2026-11-03，报告见 `product-site-acceptance/`）→ 48-* 最终交付 → 社区插件目录提交（等稳定性观察后再决定）；46-A3 的长期/资源边界继续追踪；FB-006 已定因为测试驱动整页 reload 产物（非插件），保持观察。47-A3 技术回归与用户体验验收已完成（0.0.11 已 push + pre-release）；47-A2 技术验证与体验均已完成（授权副本 30 分钟压力 + 结构/改名/泄漏见 REAL_VAULT_RESULT.md；体验以日常库 0.0.12 自用为准）；48-A1、48-A2 已完成 → 下一步 48-P3（正式 Release / 社区目录，待用户决定）。具体步骤、门槛及依赖见 HANDOFF_NEXT.md，不把该计划视为已测试。

## 下一阶段 — UI/UX 打磨与正式发布（0.0.13，2026-11-03 交接）

功能已由用户确认符合预期，本阶段不改变布局数据格式与交互契约，只做界面优化与发布准备。用户反馈原文意图见 HANDOFF_NEXT.md「下一阶段交接」；每轮按任务 ID 更新状态与证据。

| ID | 责任人 | 工作 | 状态 | 完成标准 / 证据 |
| --- | --- | --- | --- | --- |
| UI-A1 | 技术 | 「重新构建」按钮从底部状态栏移入顶部工具条（与「重置视角」并列）；构建完成提示改为约 2 秒自动消失 | ✅ 已完成（技术验证，2026-11-03；待 UI-P1 用户验收） | 顶栏 `#rebuild` 与「重置视角」并列，固定单字形图标（2026-11-03 日常库反馈后由「宽屏文字/窄屏图标」改为固定图标，title/aria-label 携带含义）；构建中 disabled + 转圈 + 「构建中…」，底栏保留「取消」；完成提示为画布底部居中胶囊，ready 后 2s 移除（原生观测 2.5–2.81s，含采样延迟）。原生（合成库 vault-012 / Obsidian 1.15.0，CDP 9248）：点击顶栏重建 → building → ready 全流程通过、无 console 异常。截图 `.local/native/evidence/shots/`：`ui-a1b-01-narrow.png`、`ui-a1b-02-wide.png`、`ui-a1b-03-building.png`、`ui-a1b-04-ready.png`、`ui-a1b-05-cleared.png`、`ui-a3-07-ready-pill.png` |
| UI-A2 | 技术 | 评估「调整布局」按钮位置，使图谱有效显示区成为完整矩形 | ✅ 已完成（技术验证，2026-11-03；待 UI-P1 用户验收） | 两个原型对比：P1 顶栏按钮 + 顶栏下全宽横带（`ui-a2-p1-idle.png`/`ui-a2-p1-editing.png`）vs P2 顶栏按钮 + 右上浮动面板 mock（`ui-a2-p2-editing.png`，横带仍浮在画布右上、遮住图例头部与画布）。**采用 P1**：阅读态无浮层、右上角干净、有效显示区为完整矩形；编辑态横带 x=344/w=686.3、按钮一行，退出即隐藏。侧栏打开时横带让出侧栏宽度（w 411.8、右缘 755.8 对齐侧栏左缘，`:has` 规则）；图例/搜索命中列表按 `--kg-band-h` 真实高度避让（窄容器提示换行时 58.3px 也生效）；宽 892 / 窄 686 顶栏均无溢出；浅色主题无白闪。截图 `ui-a2-wide-*.png`、`ui-a2-light-idle.png`、`ui-a3-05-editing.png`、`ui-a3-06-editing-sidebar.png` |
| UI-A3 | 技术 | UI/UX 细节打磨（间距、层级、留白、悬停/选中态、深色一致性、可读性） | ✅ 已完成（技术验证，2026-11-03；待 UI-P1 用户验收） | 构建状态由整行条改为居中胶囊（`border-radius:999px`；ready 312.7×32.9、building 193×47.3 含「取消」，2.5s 后移除），不再横向压住左下角图例；编辑提示文案与 `aria-label`（调整布局/结束调整、结束布局调整）同步；动作图标 15px 对齐、窄容器 search 110 / gap 6 / padding 8；布局横带与图例/命中列表/侧栏避让见 UI-A2。10 个合成脚本全过；截图 `ui-a3-01-idle-narrow.png`～`ui-a3-08-band-final.png`；`errors: []` |
| UI-A4 | 技术 | 修复 UI-P1 验收反馈：删除标题后同笔记标题层级整篇重排；布局编辑提示文案指向 | ✅ 已完成（技术验证，2026-11-04；待用户在 0.0.13 新构建上复验） | 根因：`src/core/layout-state.js` `repairGroup` 对重复标题要求 evidence 非空，笔记内两个「同名且正文为空」的知识点 evidence 都是 `0:811c9dc5:1505`，误判不可信 → 整组返回 null → note 的 H1 组记录被原样保留但不应用、退回自动布局（全库复算：不修复时 H1 最大重排 64.5 世界像素）。修复：仅在同名计数变化、evidence 缺失或值不同时拒绝，空正文且相等时允许修复（改名映射路径未改）。新增 `scripts/layout_incremental_check.mjs` 两条回归（`empty duplicate sections keep repair after unrelated deletion`、`duplicate deletion keeps fallback`）。原生验证：日常库副本 `vault-013`（162 篇 md + data.json rev344，Obsidian 1.15.0，CDP 9249）rebuild 后 note 组 `repair {moved:4, added:0}`、5 个 H1 与保存点相对偏差 0.0000（0.0px）、`errors []`，截图 `.local/native/evidence/shots/ui-0114-note-layout.png`。提示文案：`src/adapters/hud.js:594` 改为「拖动圆或标题调整位置；改动自动保存，再次点击顶栏 ✥ 退出」，原生核对 `aria:"结束布局调整"`、band 686.4×58，截图 `ui-0114-editing-hint.png`。`npm test` 10 脚本全过；构建 `main.js` 333,570 B sha256 `37589a6f32203026ff82a564ad83013b72dbb19c8a8180f7c04da67a49ba8ab5` |
| UI-A5 | 技术 | 正式发布前发布门禁（打包/空白库/真实数据 reconcile/同族边界修复） | ✅ 已完成（2026-11-04） | 门禁 A `.local/release_gate/gate_a.mjs`：manifest/package 0.0.13、id/name/minAppVersion/isDesktopOnly、releases 仅 5 个白名单文件、SHA256SUMS 与 dist 三文件一致、notes 含关键章节——全过。门禁 B `.local/native/gate_b_blank.py`（空白库 vault-gate-blank + profile-gate-blank，Obsidian 1.15.0，CDP 9251，仅装打包三文件）：16 项全过（插件 0.0.13 加载、空库 phase=empty 无 session、2 篇笔记后 ready 7 节点、顶栏三按钮与 aria、布局横带提示、重开图谱、console 0 异常），截图 `gate-b-empty.png`/`gate-b-graph.png`。门禁 C `.local/repro/gate_c.mjs`（日常库副本 vault-013，162 md/3082 节点/12 组保存布局）：4 场景全过——已删 h2 缺陷场景 H1 相对偏差 0.0px、删除同名标题后既有 H1 0.0px、重命名一级标题走迁移 0.0px、新增一级标题为 `repair {added:1}` 且既有 5 个 H1 0.0px；其他已保存组 bad=0。门禁 C 另发现同族边界：含「同名且正文为空」标题的笔记重命名时，改名映射的 `distinguishable` 守卫因空 evidence 拒绝 → 整篇回退；修复 `src/core/layout-state.js`（空正文同名签名在旧/新计数不变时视为可互换），新增 1 条合成回归 `rename migrates layout despite empty duplicate sections`；原生 `verify_rename.py`（vault-013，CDP 9249）重命名后 5 个 H1 偏差 0.000000（0.0px）、`errors []`、截图 `ui-0114-rename.png`。`npm test` 10 脚本全过；构建 `main.js` 333,570 B sha256 `37589a6f32203026ff82a564ad83013b72dbb19c8a8180f7c04da67a49ba8ab5`，重新打包 `.local/release/0.0.13/`。 |
| UI-P1 | 产品 | 日常库体验 0.0.13 候选并验收 UI/UX | ✅ 用户已确认验收通过（2026-11-04：本轮修改后其项目验收全部通过，报告含 Node 12 复验删除标题场景符合预期）；此后门禁 C 又修了「同名空正文标题笔记重命名回退」同族边界，构建升级为 333,570 B `37589a6f…`，用户可按需替换三文件复验 | 候选：`manifest.json`/`package.json` 0.0.13，`main.js` 333,570 B sha256 `37589a6f32203026ff82a564ad83013b72dbb19c8a8180f7c04da67a49ba8ab5`；打包 `.local/release/0.0.13/`（三文件 + SHA256SUMS + RELEASE_NOTES）。技术验证：合成库 vault-012（宽/窄顶栏、胶囊、横带）与日常库副本 vault-013（Obsidian 1.15.0，修复后 H1 偏差 0.0px）完成。用户验收报告 `product-site-acceptance/product-site-acceptance-report/v0.0.13_PRODUCT_SITE_ACCEPTANCE_REPORT.md`（Node 9/10 符合预期；Node 11 已修复待复验）。**未 push、未发布**；日常库当前仍是修复前候选，需再次替换三文件。agent 不替用户宣称通过 |
| 48-P3 | 产品 | 0.0.13 正式发布：tag、RELEASE_NOTES、三资产 Release，以及是否提交社区目录 | ✅ 已完成（2026-11-04：Release 已上线、社区目录条目已提交并通过自动评审） | 已完成：`main` push 至 `71e42cd`（含 `versions.json` `{"0.0.13":"1.6.7"}`）；annotated tag `0.0.13` 已推送（peeled `71e42cd`；不带 v 前缀，Obsidian 按 manifest 版本拼下载地址）；首次正式 Release 已上线 https://github.com/xidianhush/knowledge-graph-obsidian-plugin/releases/tag/0.0.13 ，资产 main.js（333,570 B，sha256 `37589a6f…`）/manifest.json/styles.css/SHA256SUMS/RELEASE_NOTES.md 共 5 个。社区目录：`obsidianmd/obsidian-releases` 已禁用 PR（`GET /pulls` 404、GraphQL CreatePullRequest 报 FORBIDDEN），官方入口改为门户 <https://community.obsidian.md>（`/plugins/new` 可访问，需 Obsidian 账号登录）；已提前 fork 并追加 `community-plugins.json` 条目（commit `37f94e9c`，现无用途），待用户登录门户提交或授权代交。社区目录（2026-11-04 完成）：按官方新入口在 <https://community.obsidian.md> 用 Obsidian 账号登录 → 关联 GitHub（`xidianhush`）→ Plugins → New plugin，提交仓库 URL 后发布，条目 <https://community.obsidian.md/plugins/knowledge-graph-smoke> 已上线（manifest `Knowledge Map` 0.0.13）。自动评审 Completed，无阻断项，仅建议/警告：①Release 缺少 GitHub artifact attestations；②Release 含多余文件（RELEASE_NOTES.md、SHA256SUMS，Obsidian 不会下载）；③BEHAVIOR 建议（Vault Enumeration 读取全库路径、Local Storage 使用 localStorage/sessionStorage 而非插件 data API）；④CSS LINT 警告 `:has`（`src/host.css:15`）；⑤README 无英文文本且标题与 manifest 名称不一致（本轮已改：标题 `# Knowledge Map` + 英文摘要 + 说明无 npm 运行时依赖故无 lockfile）；⑥BUILD VERIFICATION 因无 lockfile 未运行（本仓库无依赖）。多余 fork `xidianhush/obsidian-releases` 已删除（commit `37f94e9c` 一并作废）。证据：`.local/release/publish.py`、`.local/release/publish_pr.py`、`.local/release/pr_steps.json`、`.local/native/evidence/shots/cu-submit2.png`、`cu-publish.png`、`cu-entry.png`。 |

## 0.0.14 候选（社区评审建议，用户决定延后；2026-11-04 记录）

来源：社区目录自动评审（2026-11-04 Completed）与发布复盘。均为建议/警告，不阻断当前 0.0.13；用户明确「等到 0.0.14 再处理」。

| ID | 责任人 | 工作 | 状态 | 备注 / 完成标准 |
| --- | --- | --- | --- | --- |
| UI-A6 | 技术 | 用 JS 侧类切换替代 `:has` 选择器（评审警告：`src/host.css:15`，可能引发广泛失效的性能问题） | ✅ 已完成（0.0.14，待用户验收） | 实现：`src/adapters/hud.js` 新增 `setSidebarOpen(open)`，统一同步 `#sidebar.open` 与 `.kg-surface` 的 `kg-sidebar-open` 类（三处调用：renderSidebar 未知 id、select 打开、select(null) 关闭）；`src/host.css` 改 `.kg-surface.kg-sidebar-open .kg-layout-tools{right:min(360px,40cqw)}`（与原 `:has` 规则逐字同值），全仓源码 `:has` 为 0。合成证据：`npm test` 11 脚本全过、`.local/i18n/hud-harness.mjs` 7/7（含打开/关闭/未知 id 三路径的类同步）。原生证据：随 UI-A13 录制会话采集（`.local/a13/result.json` 的 `ui_a6`：侧栏开/关时 `.kg-layout-tools` 的 `getComputedStyle().right` 与 `kg-sidebar-open` 类状态） |
| UI-A7 | 技术 | Release 精简为三资产（main.js/manifest.json/styles.css），SHA256SUMS/RELEASE_NOTES 改为 Release 正文或 docs 链接；GitHub Actions 生成 artifact attestations | ✅ 已完成（0.0.14；真实 tag/Release 待授权） | 新增 `.github/workflows/release.yml`：tag `0.0.*` push 触发（`workflow_dispatch` 可演练），runner 上 `node scripts/build.mjs`，校验 tag==manifest==package 三段，`scripts/package.mjs` + find 守卫只留 `main.js`/`manifest.json`/`styles.css`（显式拒绝 smoke-payload.json/data.json），`sha256sum --text` 生成 `SHA256SUMS` 并与 package 输出交叉校验、只进 Release 正文，`actions/attest-build-provenance@v2` 对三资产 attest，`gh release create --verify-tag`（已存在则 `edit`+`upload --clobber`），末步回读资产恰三项。无 `npm ci`（无依赖无 lockfile）。文档 `docs/RELEASE_CI.md`（英文 9 节 + 中文摘要）。本地演练 `.local/ci-dry-run/` 7 种模式全 PASS、YAML 结构自查 36/36。用户侧前提：仓库 public、Actions 已启用、Settings → Actions → General → Workflow permissions 为 read-write；无需 secret；tag 用裸 `0.0.14`；`gh attestation verify` 需 gh≥2.49。**真实 push tag / Release 未执行（待用户授权）** |
| UI-A8 | 技术 | 审查 `localStorage`/`sessionStorage` 使用（评审 BEHAVIOR 建议改插件 data API），并在文档说明持久化范围 | ✅ 已完成（0.0.14，待用户验收） | 唯一持久化的 UI 状态是「图例是否收起」：hud 走 `services.uiStorage.get(key,fallback)/set(key,value)`，插件侧 `createNativeUiStorage` 写入 `data.json` 顶层 `ui`（字符串值，如 `{"kg.legendCollapsed":"0"}`）；首次加载从 localStorage（键 `kg.legendCollapsed`）迁移一次后不再读写；未注入 uiStorage 或抛错时回退 localStorage；写失败只 `console.warn` 不崩、不阻塞设置保存队列；搜索词/选中节点/层级/面板开关不持久化。0.0.13 数据兼容（`settings.language` 缺省按 auto，`ui` 缺省为空）。文档：`docs/INSTALL.md` §5、`docs/RELEASE_NOTES_0.0.14.md`。验证：`scripts/settings_check.mjs`（串行队列 + ui 保留）、`.local/i18n/hud-harness.mjs` 7/7（迁移/优先级/回退）；原生重启后保留待用户验收 |
| UI-A9 | 技术 | 目录 Overview 与发布页信息一致性巡检（README 标题、描述、分类、截图、Updates 页） | ⏳ 待开始（0.0.14 或发布后巡检） | 2026-11-04 已把 Overview 刷新为新 README（branch preview scan） |
| UI-A10 | 技术 | 社区目录 in-app 安装验证（Obsidian「浏览」搜索 Knowledge Map → 安装 → 建图） | ✅ 已完成（0.0.14 验证，待用户验收；安装下载环节为 proxy 替换，已披露） | 2026-11-06 原生验证（`.local/native/vault-a10` 空库 + 独立 profile-a10 + CDP 9261，Obsidian 窗口 1.15.0 / UA obsidian/1.6.7）：设置→第三方插件→退出受限模式→浏览→搜索 Knowledge Map（15 条结果命中 1，作者/repo 与目录一致）→详情页版本 0.0.13→「安装」Notice「成功安装插件 “Knowledge Map”」→「启用」loaded，commands=`knowledge-graph-smoke:open-graph-smoke` / `build-vault-graph`。空态 phase=empty（`当前范围内没有可显示的 Markdown 笔记…`，无 session、无横向/纵向溢出）；5 篇合成笔记→ready nodes=10/edges=12；关标签再命令重开→ready 10/12；**重启进程**后插件仍启用、`data.json` 325 B sha256 `8f1b372f…` 不变（见下）、notes 保留、重建 ready。console：安装/启用/空态/建图/重开/重启全程插件相关异常与 warning 均 0（主/设置/社区三窗口）。**环境差异（已披露，不作为插件问题）**：宿主 Obsidian 下载 github.com release 资产返回 404，而同一 URL 在沙箱 python 直连 200/333,570 B；因此安装下载阶段用本地 HTTPS 代理仅替换 `github.com` 的 DNS/TLS（`--host-resolver-rules`），served bytes 是官方 0.0.13 Release 原始字节（manifest `a25fef51…` 282 B、styles `c14381d9…` 2,400 B 与官方一致；main.js 落盘 333,588 B 比官方 333,570 B 多 18 B，已定因=Obsidian 写入时追加 `\n/* nosourcemap */`，去掉后 `37589a6f…` 一致）。代理日志证到 Obsidian 本体实际请求 `releases/download/**0.0.13**/{manifest.json,main.js,styles.css}` 三条全 200（未请求 0.0.14/latest）→ 目录侧版本解析正常。证据：`.local/evidence/ui-a10/result.json`（含 `install_download` 披露、逐条请求 path、官方 vs 安装对照、empty_state/reopen/restart/console）、23 张截图 `shots/`、官方资产自证 `release-0.0.13/`、代理日志 `logs/release-proxy.log`、分阶段 `a10-phaseA..E.json`。辅助操作说明：`data.json` 默认不存在（仅在改设置/拖布局时写），本次通过设置页把「自动更新」切关+「保存并应用」合法生成，用于验证重启后保留；这步不是安装流程必需 |
| UI-A11 | 技术 | 国际化（i18n）：UI 文案中英双语，跟随 Obsidian 语言（非中文默认英文），设置页可覆盖 | ✅ 已完成（0.0.14，待用户验收） | 实现：新增引擎 `src/i18n.js`（`kgT`、`kgI18nRegister`、`kgI18nApply`、`kgI18nAttach`、`kgI18nOnChange`、`kgI18nSetPreference`、`kgI18nSetAutoLocale`、`kgI18nRefresh`）与四域字典 `src/i18n.core.js`(27)/`src/i18n.ui.js`(41)/`src/i18n.hud.js`(66)/`src/i18n.obsidian.js`(75)，共 **209 key**，en/zh key 集合一致；`upstream/template.html` 40 个 `data-i18n*` 绑定（22 text / 9 title / 5 html / 3 aria-label / 1 placeholder）；动态拼接改整句式 `{vars}`、英文单复数用函数值、插值走 `escapeHtml`。语言策略：跟随 `moment.locale()`（非 zh 默认 en），设置页下拉 auto/zh/en 存 `settings.language`，`validateGraphSettings` 只允许三值，缺字段视为 auto（0.0.13 兼容）；保存后设置页与已打开图谱立即刷新并 Notice 提示「命令面板/标签页标题重载后更新」；视图名/命令名/ribbon 提示在 `onload` 按当前语言注册。门禁：`scripts/i18n_check.mjs`（key 集合/空值、跨文件重复、en 含 CJK、模板裸中文、模板 key 缺失、src 去注释后 CJK 字面量 + `// i18n-allow:` 白名单），输出 `i18n check: 209 keys, 40 template bindings, ok`；`npm test` 由 10 增为 **11 脚本全过**。原生：中英设置页截图见 UI-A13。遗留：hud.js 不在 `npm test` 覆盖内，回归靠 `.local/i18n/hud-harness.mjs`（7/7） |
| UI-A12 | 技术 | 自绘侧边栏插件图标（ribbon + tab + 门户 512） | ✅ 已完成（2026-11-06，用户手动操作门户） | 实现：`src/plugin.js` `addIcon('knowledge-map', …)` + ribbon + `getIcon()`（G1 描边版，`viewBox 0 0 100 100`、`currentColor`、stroke 7；左圆 `cx=13` 防裁边，左/右上连线穿环接中心、右下连线止于环）。原生验证（vault-013/Obsidian 1.15.0/CDP 9249）：ribbon/tab 均渲染 `<svg class="svg-icon knowledge-map">`，深色 `rgb(179,179,179)` 继承、浅色自动反色，`errors []`；截图 `icon-ribbon-dark.png`、`icon-app-dark/light.png`、`icon-tab-zoom.png`。构建 `main.js` 334,284 B sha256 `9211f031…`；`npm test` 10 脚本全过；commit `7e7cd96` 已 push。门户 512 图标 `docs/assets/knowledge-map-icon.png`（16,331 B，headless Chrome 渲染）+ SVG 源已入库，按用户 2026-11-06 决定随 0.0.14 发布一起上传 |
| UI-A13 | 产品+技术 | README 理念/教程改版：面向使用者的介绍 + 上手教程 + 动图（GIF） | ✅ 已完成（0.0.14，待用户验收） | README 全量重写（约 98 行，英文为主 + 中文简介）：定位句、`## The idea`（库本身即层级：顶层目录=学科、笔记=主题、标题=细节；布局存 data.json 不写笔记；结构冲突仅该组回退）、`## Try it in a minute` 六步（含滚轮/层级 pill/`[` `]`/Home、单击选中+双击聚焦+Esc、Ctrl+悬停预览、✥ 调整布局与横带、语言三选项）、`## Reading the map`、`## Features` 8 条、`## Install`（社区目录 + 手动三文件 + 0.0.14 起三资产）、`## Compatibility and current limits`、`## 中文简介`、`## Data and privacy`、`## Development`（11 个合成脚本 + i18n_check）。素材（全部合成库 `.local/demo-vault/`：4 顶层目录 / 25 篇虚构英文笔记 / 105 标题 / 73 wiki 链接 → 134 节点 203 边；无隐私内容）：`docs/assets/knowledge-map-demo.gif` 1100×688、10 fps、187 帧、18.70 s、2,372,145 B（2.37 MB ≤2.5 MB，带鼠标指针 overlay，英文界面、无烧录字幕，分镜=建图→逐层缩放→拖动调整→撤销/重做，按实现而非旧 README 描述）、`knowledge-map-layout-toolbar.png` 2880×279 @2x 426,125 B、`knowledge-map-settings-en.png` 2224×1554 @2x 383,019 B、`knowledge-map-settings-zh.png` 2224×1554 @2x 381,651 B（标题「知识图谱设置」、字段全中文）。录制方式：CDP `Page.startScreencast` 1440×900（比 captureScreenshot 的 3–3.8 fps 平滑），10 fps 时间轴重采样、1100 px/96 色/bayer 抖动。**附带原生证据**：UI-A6 `right` 三态 0px→360px→0px + `kg-sidebar-open` 类同步（截图 `a6-sidebar-*.png`）；UI-A11 英文 HUD CJK=0、不重开视图实时切中文 7 锚点全中（2.2 s）、中文页英文残留仅 `z=0.436`、切回 en CJK=0（`graph-en.png`/`graph-zh.png`）。证据：`.local/a13/result.json`、`A13_RUNBOOK.md`、`shots/`。GIF 已采用 v2 指针版：11 px 白点（实心 r=4.5 + 柔边 + 光晕 + 1 px 深色描边）与 180 ms 点击涟漪（Rebuild、调整布局各一次），轨迹取自真实 CDP 输入事件并做事件间插值，拖动段指针贴合被抓圆的抓取点；v1（无指针）保留在 `.local/a13/gif-v1.gif` 备查。发布前按用户 2026-11-06 桌面思路文件再次改版为「产品说明 + 教程」（三主题）：`# 展现知识布局`（理念：包含有纵深、链接在平面；交互：平移 / 缩放 / Ctrl+悬停预览三张 GIF）、`# 展现知识链接`（理念：知识是链条，排错要顺着链条走；静态图 `knowledge-map-links.png`）、`# 自定义知识地图元素位置`（效果举例：最核心的知识居中、细枝末节放两边；`knowledge-map-layout.gif`），hero 换 `knowledge-map-overview.png`（带顶栏与 footer，无 tooltip/侧栏/横带/选中），保留 Quick start / Reading the map / 中文简介 / Data privacy / Development。新素材 6 件（全部合成库、英文界面、指针 overlay、无烧录字幕）：overview 1760×1040 PNG8+FS 722,952 B、links 1760×1120 PNG8+FS 768,498 B、pan 1000×625 36f 3.6s 1,113,977 B、zoom 1000×625 66f 6.6s 1,346,957 B、preview 1100×688 52f 5.2s 610,094 B、layout 1100×688 46f 4.6s 1,305,965 B；证据 `.local/a13/result2.json`、`A13_RUNBOOK.md`、`shots/t8-check-sheet.png`。遗留：门户 Overview 需随 0.0.14 发布后重新评审 |
| UI-A14 | 技术+产品 | 插件 id / 社区 URL 去掉「smoke」：`knowledge-graph-smoke` → 拟定 `knowledge-map` | ⏸ 暂缓（用户 2026-11-06：0.0.14 不做，后续再看） | 动因（用户 2026-11-06）：社区 URL/安装目录带 smoke 显得草率、不像发布版本。影响面：manifest `id` 决定安装目录 `.obsidian/plugins/<id>/`、`data.json` 位置、更新匹配与门户条目身份；改 id 会让已装 0.0.13 的用户收不到更新，且门户条目 id 提交后固定，需要重新提交条目并处理旧条目（下架/保留）。设计草案：新 id + 首次加载检测旧目录 `data.json` 并导入 `settings`/`layoutOverrides`（`app.vault.adapter` 读 vault 内 `.obsidian`）+ `docs/INSTALL.md` 迁移说明 + 门户重提；`VIEW_TYPE`/命令 id 是否保留旧名一并决定（建议保留以少破坏快捷键/脚本，但命令面板会显示旧 id 前缀）。DEC-004（首发 id 不变）被本轮需求推翻，需新决策 DEC-006 并由用户拍板 |

## 下一阶段 — 移动端支持（0.0.15 候选，2026-11-06 交接）

详细计划：`docs/MOBILE_PLAN.md`（差距清单、触摸交互方案、布局断点、性能预算、验证矩阵、发布门禁）。本表是执行清单。

| ID | 责任人 | 工作 | 状态 | 完成标准 / 证据 |
| --- | --- | --- | --- | --- |
| MOB-P1 | 产品（用户） | 决定支持范围：Android 优先还是 Android+iOS；最低系统版本；是否接受移动端功能降级（如仅单元素拖动）；性能目标机型 | 待用户决定（阻塞 MOB-A1 之后的取舍，不阻塞只读勘察） | 答复写入本表；未答不擅自做 iOS 专属优化，不宣称移动端可用 |
| MOB-A1 | 技术 | `manifest.json` `isDesktopOnly:false` + `Platform` 检测 + 桌面回归 | 待开始 | 桌面 `npm test` 11 脚本全过；Android 真机能加载插件并打开视图无异常；桌面交互无变化 |
| MOB-A2 | 技术 | 响应式布局（≤520px 档、安全区、顶栏收进 `⋯` 菜单、横带横向滚动、底部抽屉侧栏、全屏预览） | 待开始 | 390×844 竖屏全部动作可达、无裁切；横屏可用；桌面 ≥880px 外观不变 |
| MOB-A3 | 技术 | 触摸交互层（Pointer Events：单指平移、双指捏合、tap 选中、double-tap 聚焦、长按预览） | 待开始 | 真机逐项通过，无卡死/无双触发；`pointercancel` 后状态干净 |
| MOB-A4 | 技术 | 快捷键的触屏等价 + 按设备切换的提示文案（新增 `ui.hint.touch.*`） | 待开始 | 每个桌面快捷键都有可见触屏入口；`node scripts/i18n_check.mjs` 通过；中英无残留 |
| MOB-A5 | 技术 | 预览/侧栏/图例/命中列表移动化（关闭入口、软键盘、返回手势） | 待开始 | 软键盘不遮挡输入；返回/关闭可关浮层；预览内链接可跳转 |
| MOB-A6 | 技术 | 移动端性能与内存实测与预算（DPR clamp、标签/可见边预算、上限策略） | 待开始 | 实测数字写回 `docs/MOBILE_PLAN.md` §6；不劣化桌面帧率 |
| MOB-A7 | 技术 | pipeline Blob Worker 的移动端降级（失败回退主线程分块构建） | 待开始 | 模拟 worker 不可用仍能建图；进度/取消可用；5,000 节点不冻结 UI |
| MOB-A8 | 技术 | 移动端兼容矩阵 + 桌面回归 | 待开始 | 按 `docs/MOBILE_PLAN.md` §8 逐项证据；iOS 结果如实标注 |
| MOB-A9 | 技术 | 发布门禁 0.0.15（版本、versions.json、三资产、attestation、Release notes、门户说明） | 待开始（需用户发布授权） | `npm test` 11 脚本全过；三资产 Release + attestation；tag/Release/门户均需用户明确授权 |
| MOB-A10 | 技术 | 移动端 README/门户素材（手机截图/GIF） | 待定（用户决定是否要） | 素材进 `docs/assets/`；README 增 Mobile 小节且如实写明限制 |

| 5-P1 | 产品 | 决定是否需要原路线图中的虚拟学科、语义分组等增强 | 暂缓 | 属于原阶段 5，可选，不混入当前移动端工作 |
| 5-A1 | 技术 | 获得确认后评估构建期聚类、命名和候选关系方案 | 暂缓（待 5-P1） | 原路线图仅作背景；不默认为运行时联网、引入 LLM 或更换核心布局 |

> 旧的可选条目 `OPT-P1` / `OPT-A1` 已被本阶段取代：用户 2026-11-06 明确要求把移动端支持作为下一阶段工作，相关范围与风险见 `docs/MOBILE_PLAN.md`。


## 反馈与待决定事项

用户可以直接加行，也可以在聊天里自然描述。建议只写“我想做什么 → 实际发生什么 → 希望怎样”，截图和复现步骤有则补充，不要求先给解决方案。

| ID | 来源 / 类型 | 问题或待决定事项 | 优先级 | 状态 / 下一步 |
| --- | --- | --- | --- | --- |
| FB-001 | 4.4 技术观察 | 副本有 1 个图片引用未能匹配；详情在本地 `.local/evidence/real-trial-copy.json` | 待定 | 待核对；仅在已授权范围排查，不擅自扩大复制或改源笔记 |
| FB-002 | 用户体验 / 缺陷 | 实际：0.0.2 日常库预览任意笔记，只停在一个圆上，按 Ctrl 就卡死，松开后不恢复；期望：稳定预览并可随时退出。此前另有焦点漏触发问题 | P1（核心流程受阻） | 已修复并通过本轮用户验收：45-P6 独立库、45-P7 真实副本及 45-P8 日常库均通过；日常反馈卡顿/漏触发未出现，暂未发现其他问题。按已报告场景关闭，若复发重新打开；不据此证明内存泄漏根因或长期资源稳定性 |
| FB-003 | 用户体验 / 缺陷 | 实际：Esc 跳到图谱左侧标签对应的笔记，离开图谱；副本步骤：放大进入 LTI analysis 并选中内部元素后，Esc 切到该笔记；期望：收起预览/选择并保留图谱标签 | 建议 P1，待产品确认 | 已修复并经用户复验：45-P5 日常 0.0.2、45-P6 独立库及 45-P7 升级后真实副本均确认正常；旧副本 0.0.1 反馈保留为历史，不判为 0.0.3 回归 |
| FB-004 | 用户体验 / 缺陷与范围澄清 | 0.0.4 标题拖动/避让/子树/连线、Ctrl/Esc 和阅读画面符合预期；笔记圆直接拖或手柄均不动，提示“根级元素暂不支持移动”。期望文件夹、笔记、标题均可选中调整 | P1（新增核心流程受阻，技术判断） | 已修复并经用户验收：2026-10-29 用户在 test-vault-layout-fix 和原 test-vault 确认全层级拖动、避让、子树及连线跟随正常，其他功能暂时正常。按已报告场景关闭；证据 LAYOUT_ROOT_FIX_RESULT.md |
| DEC-001 | 产品选择 | 图谱继续保持深色，还是跟随 Obsidian 主题？ | 已决定（2026-11-01） | 用户确认浅色主题下“应用变浅、图谱画布保持深色”可接受，即维持图谱深色、不跟随宿主主题；若日后希望跟随，作为新需求重新评估，技术轮不改视觉契约 |
| DEC-002 | 产品选择 | 首个桌面版本的用户范围、正式名称及发布形式 | 已决定（2026-11-02） | 首发渠道仅自用；用户自用 1–2 天后考虑公开分发（届时按 48-P3 再决定）；正式名称 `knowledge-map`；描述已确认（2026-11-02，即 manifest 现有英文）；桌面专用（isDesktopOnly）与最低 Obsidian 版本按实测收紧后写入 manifest |
| DEC-003 | 产品选择 | 正文摘要在图谱、布局与日志中的口径 | 已决定（2026-11-02） | 保持现有悬停摘要：note 节点在内存中携带最多 220 字符正文摘要用于悬停/预览，不写入 data.json、日志或状态消息；不因隐私顾虑移除该交互（用户决定） |
| DEC-004 | 产品选择 | 正式发布时插件 `id` 是否改名 | 已决定（2026-11-03） | 首发保持 `knowledge-graph-smoke`（避免既有 data.json/命令失效）；社区目录提交时再评估改名与迁移方案 |
| DEC-005 | 产品选择 | 0.0.12 是否单独公开发布 | 已决定（2026-11-03） | 不单独发布：0.0.12 为内部候选（已装日常库体验通过）；UI/UX 完成后以 **0.0.13** 做首次正式发布 |
| DEC-006 | 产品选择 | 0.0.14 是否把插件 id 从 `knowledge-graph-smoke` 改为 `knowledge-map`，以及迁移/门户方案 | 暂缓（2026-11-06 用户决定 0.0.14 不做，后续再看） | 用户希望 URL/安装路径去掉 smoke；代价是需要数据迁移、重新提交门户条目、既有 0.0.13 安装收不到更新。需先与用户确认：目标 id 名称、是否接受重新审核、旧条目处置、命令/视图 id 是否保留旧名。详见 HANDOFF_NEXT.md「本版交接：0.0.14」 |

### FB-006 — 桌面稳定性检查中的无栈/宿主异常

- 来源：2026-10-30 独立深色库 0.0.9 技术检查；用户未报告可见故障。
- 实际：关于页核实后、快速开关初段，间歇出现 illegal access；CDP 另捕获 app.js updateStatus 的 getZoomFactor 非函数异常。布局、资源计数与重载断言通过。
- 期望：开关、重建及重载不产生未捕获异常。优先级：待定（需确认来源与正常使用影响）。
- 状态：**已定因（2026-11-01，测试驱动方式产物，非插件缺陷；getZoomFactor 本轮未复现，按历史条件记录）**。最小复现序列＝Playwright 注入式驱动对 Obsidian 渲染页执行整页 `page.reload()` + About 读取；每次 reload 约 4 条字符串异常 `illegal access`（CDP `Runtime.exceptionThrown`，scriptId=1、url=index.html、line 0，reload 前后旧/新主世界各一批）。决定性对照：`disablePluginAndSave` 后插件完全未加载（`plugins=[]`）仍 4 条；0.0.9 与 0.0.10 相同；纯 raw CDP 复刻同一序列 0 条；去掉本仓 init script 后 Playwright 仍 3 条。`illegal access` 在 obsidian-1.14.5.asar 中出现 0 次 → Electron 原生层在渲染进程 reload 时抛出；`getZoomFactor` 属 Obsidian 自身 `app.js` 标题栏 `updateStatus` 使用 reload 后失效的窗口代理 `this.eWin`，插件不在调用栈上。正常使用路径（不 reload）在本仓 30 分钟 1161 轮、150 次混合压力、20 次拖动保存等运行中两异常均 0 次。建议原生稳定性回归不要 reload 渲染页（改用重启应用/禁用启用插件），统一用 raw CDP。证据：脚本 `.local/native/fb006_*.py`，结果 `.local/evidence/fb006-repro/`（`RESULT.md` 含对照矩阵与上下文映射）。

### FB-005 — 笔记小改动导致手动排列大范围回退

- 来源：2026-10-30 用户在日常库深度学习时使用 0.0.6 的反馈。
- 实际：在父元素内排好子元素及兄弟后，修改笔记中的标题名称等内容，重建会使大量已有排列回到自动布局。
- 期望：保留用户整理成果，笔记改动引起的图谱位置变化尽量小。
- 复现线索：同一笔记中先调整多组标题，再改其中一个标题名称；检查目标组、旁支组及另一篇未改笔记。
- 优先级：P1（技术建议，影响手动整理成果的持续可用性）。状态：6 个合成场景完成诊断；单个标题改名使同篇三组保存布局均不恢复。方案见 LAYOUT_CONTINUITY_PLAN.md；LC-A1 首批改名候选已技术验证，待 LC-P1 用户验收；复杂匹配仍有限制；LC-A2 纯增删局部修复已技术交付，待 LC-P1 用户验收。

反馈填写示例（模板，不是已存在的问题）：`新反馈 ID / 用户体验 / 我在…场景尝试…，实际…，希望… / 优先级待定 / 待技术复现`。

## 关键决策记录

| 日期 | 决策 | 来源与影响 |
| --- | --- | --- |
| 2026-10-26 | 真实库试用放在当前项目副本，仅两个知识目录及引用图片 | 用户在本聊天明确确认；日常库不安装，禁止路径不读取 |
| 2026-10-27 | 新建双方可编辑的 TODO，记录技术和产品分工及完成状态 | 用户本轮提出；从本轮开始维护，用户体验验收与技术测试分开 |
| 2026-10-27 | 4.5–4.8 建议拆分为体验、桌面稳定性、性能和交付 | Codex 建议，待用户调整/排期；未启动执行 |
| 2026-10-27 | 将昨日插件安装到日常库，用真实学习驱动反馈 | 用户本轮提出并批准安装权限；沿用已验收构建与两个目录范围，不修改笔记，启用由用户完成 |
| 2026-10-27 | 独立库验收 0.0.2 后明确授权升级日常库测试 | 用户确认修复奏效、体验顺畅；只替换三个运行文件并保留现有设置，旧运行文件留本地备份 |

## 更新记录
- **2026-11-06 晚 / DeepSeek（0.0.15 移动端交接规划）**：用户决定把「升级为移动端可用」作为下一阶段并交给下一位 coding agent，本轮只做交接规划、不改代码。新增 `docs/MOBILE_PLAN.md`（目标与边界、12 条桌面假设差距清单含 `manifest.json:8` / `hud.js:921-950` 快捷键 / `renderer.js:1713-1721` 滚轮 / `vault-pipeline.js:14` Blob Worker 等定位、触摸交互对照表、≤520px 布局断点方案、平台与 API 差异、性能内存预算、MOB-A1…A10 任务与验收、Android/iOS/桌面验证矩阵、0.0.15 发布门禁、风险与建议顺序）、`HANDOFF_NEXT.md`「下一阶段交接：移动端支持」与更新后的正式交接包/开场语；TODO 新增 MOB-P1 与 MOB-A1…A10，旧的 OPT-P1/OPT-A1 标注为被取代。声明边界：未改任何源码、未动 `isDesktopOnly`、未改版本、未推 tag；移动端公开发布仍需用户验收与明确授权。
- **2026-11-06 晚 / DeepSeek（0.0.14 候选交付）**：按用户确认范围完成 0.0.14 全部代码与文档：UI-A11 i18n（引擎 `src/i18n.js` + 四域字典 209 key + 模板 40 绑定 + `scripts/i18n_check.mjs` 门禁、语言三选项、跟随 `moment.locale()`）、UI-A6 `:has` 改 `kg-sidebar-open` 类、UI-A7 `.github/workflows/release.yml` 三资产 + attestations 与 `docs/RELEASE_CI.md`（本地演练 7/7）、UI-A8 图例状态改存 `data.json` 的 `ui`（一次性迁移）、UI-A13 README 理念教程 + 主 GIF/截图（合成演示库）、UI-A10 空白库 in-app 安装验证（见该行证据）。`npm test` 11 脚本全过（新增 i18n_check；schema3 写失败场景改为真正触发写失败）；版本升 0.0.14（package/manifest/versions.json），构建 `main.js` 396,234 B sha256 `b022a4d8…`；新增 `docs/RELEASE_NOTES_0.0.14.md`，`docs/INSTALL.md` 升版。本轮只 commit+push，tag/Release/门户待用户授权。
- **2026-11-06 晚 / DeepSeek（日常库装入 0.0.14 候选）**：用户当轮明确要求「把现在这个插件版本装到日常库先体验」，按此执行——从 `dist/` 复制 `main.js`（396,234 B `b022a4d8…`）、`manifest.json`（308 B `aa3cc460…`，version 0.0.14）、`styles.css`（2,400 B `c14381d9…`，与 0.0.13 相同）到 `D:/obsidian_vault/hush-ob-bucket/.obsidian/plugins/knowledge-graph-smoke/`；未触碰任何笔记、未读 `Utilities/API Key.md`。替换前把旧三文件与 `data.json` 备份到 `.local/daily-vault-backup-20261106/`（旧 main.js 332,824 B `e568296b…`；data.json 196,478 B `1303aadf…`）。安装后 `data.json` 哈希前后一致（1303aadf…）；用 0.0.14 的 `createLayoutStore` 离线读取该库数据：schema 3 / revision 422 / 15 组 / 5 structures / `unsupported:false`，确认 0.0.13 数据可直接沿用。插件重载（禁用→启用或重启 Obsidian）由用户执行，agent 未代操作；回滚=把备份三文件覆盖回插件目录。
- **2026-11-06 晚 / DeepSeek（0.0.14 原生与素材收尾）**：UI-A10 在 `.local/native/vault-a10` 空库完成 in-app 安装→启用→空态→5 篇笔记建图→关标签重开→重启进程复核（Obsidian 1.15.0）；宿主网络无法下载 github.com release 资产（沙箱直连同 URL 200），安装下载阶段用本地 HTTPS 代理只替换 DNS/TLS、字节为官方 0.0.13 Release 原始字节，已在 TODO 与 `.local/evidence/ui-a10/result.json` 披露；无代理时 Obsidian 实际请求为 `download/0.0.13/*`，说明目录侧版本解析正常。UI-A13 素材落地（GIF 2.26 MB / 横带 / 中英设置页，合成演示库 `Knowledge Map` 图谱 134 节点 203 边），并顺带取得 UI-A6 三态数值与 UI-A11 中英切换的原生证据。本轮未 commit/push；tag/Release/门户仍待用户授权。
- **2026-11-06 晚 / DeepSeek（0.0.14 正式发布）**：按用户授权推送 annotated tag `0.0.14`（指向 `740def8`），GitHub Actions `Release` 工作流 run 42164446268 全 10 步成功，Release 0.0.14 于 2026-11-06T04:46:21Z 发布，资产恰为 `main.js` 396,234 B `b022a4d8…`、`manifest.json` 308 B `aa3cc460…`、`styles.css` 2,400 B `c14381d9…`；正文含 notes、`## SHA-256 checksums` 与 notes/build run 链接；attestation 端点返回 200（DSSE tlog index 3709424080，builder = release.yml@refs/tags/0.0.14）。README 三主题教程与 6 件素材同 commit `740def8` 上 main。门户图标与 Overview 刷新已由用户在门户后台手动完成（本机浏览器自动化不可用，wincu 桌面后端 `spawn powershell.exe ENOENT`）；门户图标为「图标名 + 背景色」组合，不支持上传仓库 PNG/SVG。
- **2026-11-06 晚 / DeepSeek（README 产品说明+教程改版与 0.0.14 发布授权）**：用户验收 0.0.14 候选（日常库装入后体验）「暂时没发现问题」，并给出 README 改版思路文件。按该思路把 README 从「功能介绍」改为「产品说明 + 教程」三主题结构：`# 展现知识布局`（理念：包含深度 + 平面链接；交互：平移 GIF、缩放逐层 GIF、Ctrl+悬停预览并点击固定的 GIF）、`# 展现知识链接`（理念：知识环环相扣，链条为排错提供路径；静态图 `knowledge-map-links.png` 展示选中节点、蓝环相连与跨学科边）、`# 自定义元素位置`（效果：核心居中、细枝末节靠边；`knowledge-map-layout.gif` 完整演示点 ✥ 进入 → 拖动 → 再点 ✥ 结束），保留 Quick start（含中英设置页）、Reading the map、中文简介、Data privacy、Development。新增 6 件合成库素材并重录 4 段聚焦动图，hero 与 links 用 1760px PNG8+Floyd–Steinberg（消除色带，722,952 B / 768,498 B）。用户同时授权 **git tag 0.0.14 + 推送 tag**、**门户 512 图标上传与 Overview 刷新**；本轮据此执行发布。
- **2026-11-06 / DeepSeek（正式交接）**：用户决定 UI-A14（id 去 smoke）0.0.14 不做、门户图标随 0.0.14 发布一起上传，并宣布正式开始交接。`HANDOFF_NEXT.md` 更新：0.0.14 范围剔除 UI-A14、新增「门户图标随发布上传」与「正式交接包（可直接交给下一位 agent）」；open 项收敛为 UI-A13 动图指令与 0.0.14 发布授权。TODO：UI-A12 补充门户 512 图标与证据，UI-A14 置「⏸ 暂缓」，DEC-006 同步。交接时状态：HEAD 以最新 commit 为准，工作区干净，无遗留 Obsidian/CDP 实例（9249/9250/9251 关闭），`npm test` 10 脚本全过。
- **2026-11-06 / DeepSeek（0.0.13 收尾交接 0.0.14）**：用户确认 0.0.13 体验验收结束、图标工作到此为止，0.0.14 交下一位 agent；新增两项范围：README 理念/教程+动图（UI-A13，内容听用户指令）、插件 id/URL 去 smoke（UI-A14，需先确认迁移与门户方案，DEC-006）。已完成交接整理：`HANDOFF_NEXT.md` 顶部新增「本版交接：0.0.14」小节（现状、范围、i18n 落点、验证纪律、open 项、建议顺序）并替换开场语；TODO 新增 UI-A13/UI-A14 与 DEC-006，UI-A10 更新为目录已同步。图标（UI-A12）已实现并原生验证、commit `7e7cd96` 已 push，构建 `main.js` 334,284 B sha256 `9211f031…`（未升版本未发布）；门户 512 图标文件已就绪待登录上传。本轮无其他代码改动；`npm test` 此前 10 脚本全过。
- **2026-11-05 晚 / DeepSeek（自绘侧边栏图标 + 目录同步确认）**：社区目录已同步（镜像提交 `f23b14fe`，2026-11-05T13:20Z；`community-plugins.json` 9,971 项含 `knowledge-graph-smoke`），Release 资产计数（main.js 11、manifest.json 12、styles.css 10）与门户 11 次下载吻合，判定为真实安装。按用户手稿几何（左/右上连线穿大圆接中心小圆、右下连线只到大圆）重画图标，用户选定 G1 描边版并实现：`src/plugin.js` 注册 `addIcon('knowledge-map', …)` 并用于 `addRibbonIcon` 与 `getIcon()`（tab 图标一致）。原生验证（vault-013，Obsidian 1.15.0，CDP 9249）：ribbon 元素含 5 circle/3 path、28×24、`currentColor` 深/浅两主题正常，tab 图标为 `svg-icon knowledge-map`，`errors []`；截图 `icon-app-dark.png`、`icon-app-light.png`、`icon-tab-zoom.png`。门户 512 图标已导出 `docs/assets/knowledge-map-icon.png`（紫底白字形）与 `.svg` 矢量源，待登录门户 `Edit listing → Choose icon` 上传；应用内改动属 0.0.14 未发布增量（版本仍 0.0.13，未打包）。`npm test` 10 脚本全过；构建 `main.js` 334,284 B sha256 `9211f031…`。
- **2026-11-04 晚（补）/ DeepSeek（社区 Overview 刷新与条目标识说明）**：用户指出社区页 Overview 仍为开发流水账且含本机路径。已把旧 README 正文迁至 `docs/DEV_LOG.md`，新写面向使用者的英文 `README.md`（标题 `# Knowledge Map`、功能/安装/兼容与限制/隐私/开发说明，截图 `docs/assets/knowledge-map.png`），commit `dddd9f0` 已 push。门户对已发布条目没有 Publish 按钮（`/edit` 只能改图标/描述/分类，Save 不触发评审；`/check-release` 提示该版本已扫描）；改用 `/review-branch` 的「Preview a branch scan」对 `main` 跑扫描（Commit `dddd9f0`）：Completed，README 警告已消失，仅剩 CSS LINT `:has`（`src/host.css:15`）警告与 DEPENDENCIES Pass。扫描后公开页 <https://community.obsidian.md/plugins/knowledge-graph-smoke> 的 Overview 已变为新 README（旧开发日志与本机路径不再出现）。URL slug 取自 manifest `id`（`knowledge-graph-smoke`）：安装目录 `.obsidian/plugins/<id>/`、更新匹配与 `data.json` 均按 id 关联，改名会让既有安装失去更新与已保存布局，故按 DEC-004 保持 id 不变，展示名仍为 Knowledge Map。临时调试浏览器（隔离配置 `.local/chrome-cu`、CDP 9230）已关闭并删除（含登录 Cookie），已用 `--restore-last-session` 恢复用户默认 Chrome；本轮仅文档与门户操作，未改插件代码、未重跑合成脚本。
- **2026-11-04 晚 / DeepSeek（社区目录提交完成 + 自动评审结果）**：按用户授权代提交社区目录（用户在其 Chrome 中完成 Obsidian 账号与 GitHub 登录；因 Chrome 136+ 禁止默认配置开调试端口，使用隔离配置 `.local/chrome-cu` 驱动，提交后已恢复用户默认浏览器）。门户流程：关联 GitHub → New plugin → 填仓库 URL → Publish，条目 <https://community.obsidian.md/plugins/knowledge-graph-smoke> 即时上线；自动评审约 6 分钟 Completed，仅建议/警告无阻断：Release 缺 artifact attestations、Release 含 RELEASE_NOTES.md/SHA256SUMS 冗余资产、Vault Enumeration（读全库路径）、Local Storage（localStorage 持久化）、`:has` 选择器（`src/host.css:15`）、README 无英文且标题与 manifest 不一致、无 lockfile 无法字节级复现。已删除多余 fork `xidianhush/obsidian-releases`。本轮同步 README（标题改为 `# Knowledge Map`、英文摘要、说明无 npm 依赖所以没有 lockfile、补社区目录链接）与 docs/INSTALL（社区条目已上线）。后续可选改进：`:has` 改为 JS 侧类切换、localStorage 迁移到 data API、Release 精简为三资产、加 GitHub Actions 生成 attestations。**未改代码、未重跑合成脚本**（仅文档）；发布动作已完成，后续版本需用户另行授权。
- **2026-11-04 深夜 / DeepSeek（0.0.13 正式发布）**：按用户明确授权执行发布。`main` push 至 `71e42cd`（新增 `versions.json` 映射 0.0.13→1.6.7）；annotated tag `0.0.13` 已推送（peeled `71e42cd`，保留旧 `v0.0.11`）；首次正式 GitHub Release 已上线（https://github.com/xidianhush/knowledge-graph-obsidian-plugin/releases/tag/0.0.13 ），资产 `main.js` 333,570 B sha256 `37589a6f32203026ff82a564ad83013b72dbb19c8a8180f7c04da67a49ba8ab5`、`manifest.json`、`styles.css`、`SHA256SUMS`、`RELEASE_NOTES.md`。社区目录提交：实测 `obsidianmd/obsidian-releases` 已禁用 PR（`GET /repos/.../pulls` 404、GraphQL CreatePullRequest FORBIDDEN），README 指向 docs 且新入口为门户 <https://community.obsidian.md>；已 fork 并提交 `community-plugins.json` 追加（commit `37f94e9c`）但 PR 无法创建，该 fork/分支现无用途（待清理）。发布后已同步 README/DEVELOPMENT/docs/INSTALL（标题、发布状态、门户入口）。**待用户**：①登录 community.obsidian.md 提交插件（id `knowledge-graph-smoke`）或授权代交；②吊销本次提供的 GitHub PAT；③是否删除多余 fork `xidianhush/obsidian-releases`。
- **2026-11-04 晚 / DeepSeek（0.0.13 发布门禁 + 同名空正文标题重命名同族修复）**：用户确认本轮项目验收全部通过后，按其问题做最后一轮发布门禁而非历史全量重跑。A 打包/版本一致性（`.local/release_gate/gate_a.mjs`）、B 空白库首次安装/空态/建图/重开（`gate_b_blank.py`，16 项）、C 日常库副本真实数据 reconcile 4 场景（`gate_c.mjs`）全部通过；C 场景中原缺陷（已删 h2）5 个 H1 相对偏差 0.0px，删除同名标题、重命名一级标题、新增一级标题均保持既有 H1 0.0px。门禁 C 另暴露同族边界：笔记含「同名且正文为空」标题时，重命名会因改名映射 `distinguishable` 守卫拒绝空 evidence 而整篇回退；修复 `src/core/layout-state.js`（空正文同名签名在旧/新计数不变时视为可互换、仍拒绝计数变化），`scripts/layout_incremental_check.mjs` 新增回归 `rename migrates layout despite empty duplicate sections`（该脚本 15 条结果全过）。原生验证：日常库副本 vault-013（Obsidian 1.15.0，CDP 9249）重命名一级标题后 5 个 H1 偏差 0.000000（0.0px）、`errors []`，截图 `.local/native/evidence/shots/ui-0114-rename.png`；证据 `.local/evidence/release-gate/{gate-b,gate-c,gate-c-rename-native}.json`。Node 11 截图曾被用户误覆盖，已从 DSH 附件缓存用 94% 缩放副本恢复（2239×1873、2250×1864），原始分辨率不可得。`npm test` 10 脚本全过；构建 `main.js` 333,570 B sha256 `37589a6f32203026ff82a564ad83013b72dbb19c8a8180f7c04da67a49ba8ab5`，重新打包 `.local/release/0.0.13/`。**未 push、未发布**；发布仍需用户明确授权。
- **2026-11-04 / DeepSeek（0.0.13 候选修复：删除标题后整篇标题重排 + 编辑提示文案）**：用户在日常库验收 0.0.13（报告 `v0.0.13_PRODUCT_SITE_ACCEPTANCE_REPORT.md`）反馈，删除叶子 `## 第四章常见题型分析方法` 后同笔记的多个一级标题明显位移，并指出布局提示里的「结束调整」按钮不存在。排查：全库复现（`.local/repro/full_graph.mjs`，3082 节点/101 笔记/2949 标题）确认 note 组记录 UNTOUCHED、apply 跳过该组；在 `repairGroup` 注入临时 trace 后定位到重名标题守卫（原 `layout-state.js:229`），两个空正文同名标题 evidence 相同且以 `0:` 开头被判不可信。修复：`src/core/layout-state.js` 仅在同名计数变化、evidence 缺失或值不同时拒绝（空正文且相等在纯增删时允许修复），改名映射路径未改；`scripts/layout_incremental_check.mjs` 新增 2 条回归（无关删除后保留修复、删除同名标题本身仍回退）。原生验证：日常库副本 `vault-013`（Obsidian 1.15.0，CDP 9249）rebuild 后 note 组 `repair {moved:4, added:0}`、5 个 H1 相对偏差 0.0000（0.0px）、提示文案「再次点击顶栏 ✥ 退出」、`errors []`；截图 `.local/native/evidence/shots/ui-0114-note-layout.png`、`ui-0114-editing-hint.png`。`npm test` 10 脚本全过；构建 `main.js` 333,570 B sha256 `37589a6f32203026ff82a564ad83013b72dbb19c8a8180f7c04da67a49ba8ab5`，重新打包 `.local/release/0.0.13/`。**未 push、未发布**；日常库需再次替换三文件后继续 UI-P1 验收。
- **2026-11-03 / DeepSeek（0.0.13 顶栏动作按钮修正：固定图标）**：用户在日常库安装 0.0.13 候选后反馈，宽窗口顶栏「调整布局」显示为文字且被挤成两行（新按钮缺 flex/nowrap，文字方案在宽窗 + 长 LOD 读数下同样超额）。按用户选择改为**固定单字形图标**：`#rebuild`/`#layout-mode` 恒为 30px 图标（`↻`/`✥`，`.kg-action-label` 恒隐藏），含义由 `title`/`aria-label` 携带；构建中 `↻` 旋转且 `title` 改为「正在重新构建图谱」。原生验证（合成库 vault-012，Obsidian 1.15.0，CDP 9248）：1600/1440/1030 三种宽度 topbar `scrollWidth == clientWidth` 无溢出、两按钮 30×32.1、label `display:none`、icon `inline`；building 时 `disabled` + `animation:kg-spin`；ready 胶囊 2.4s 后移除；编辑横带 38px、`aria-label` 随状态同步（调整布局/结束布局调整）；`errors: []`。截图 `.local/native/evidence/shots/ui-a4-*.png`、证据 `.local/evidence/ui-a4/a4.json`。`npm test` 10 脚本全过；构建 `main.js` 332,529 B sha256 `ab00889a…`，重新打包 `.local/release/0.0.13/`。**未 push、未发布**；日常库需用户重新替换三文件后继续 UI-P1 验收。
- **2026-11-03 / DeepSeek（0.0.13 UI/UX：UI-A1/A2/A3 实现与原生验证）**：按交接清单完成三处 UI 改造：①UI-A1 顶栏新增「重新构建」（与「重置视角」并列，构建中 disabled + 转圈，底栏仍可取消），构建完成提示改为底部居中胶囊、2 秒自动消失；②UI-A2 两个原型对比后采用 P1：「调整布局」收进顶栏，编辑时顶栏下出现全宽工具横带（选父级/撤销/重做/恢复此组/全库恢复 + 状态提示），阅读态无浮层、有效显示区为完整矩形，侧栏打开时横带让位，图例/搜索命中列表/画布 inset 按横带真实高度避让；③UI-A3 状态胶囊分层、编辑提示与 aria-label、图标对齐、686px 窄容器动作按钮退化字形（不再挤出「重置视角」）、浅色主题无白闪。布局数据仍为 schema3，capture/reconcile/apply 契约与 `upstream/` 渲染/物理逻辑未改。验证：`npm test` 10 脚本全过（`Completed build and 10 synthetic check scripts.`）；合成库 vault-012（Obsidian 1.15.0，CDP 9248）原生验证构建状态流转、2s 消失、宽/窄顶栏、横带与侧栏几何、浅色主题、视图重载（`errors: []`），证据截图 `.local/native/evidence/shots/ui-a1b-*`、`ui-a2-*`、`ui-a3-*` 与 `.local/evidence/ui-a3/a3.json`。版本升 0.0.13，构建 `main.js` 332,529 B sha256 `ab00889a33f9ad7db295bcb0b022d15a8e6b7a12ff9ce35590bf8c484cea7b52`，打包 `.local/release/0.0.13/`（manifest sha `a25fef51…`、styles sha `c14381d9…`），新增发布说明草稿 `docs/RELEASE_NOTES_0.0.13.md`，同步 README/DEVELOPMENT/docs/INSTALL。**未 push、未发布、未装日常库**：待用户 UI-P1 在日常库验收，发布（tag/Release/社区目录）需用户明确授权。
- **2026-11-03 / Codex（0.0.13 UI/UX 与正式发布交接）**：用户确认 0.0.12 在日常库功能层面完全符合预期，UI 有少量可改进项，并决定把 UI/UX 优化与发布前准备交给下一位 coding agent。本轮只做交接：新增 UI-A1（重新构建按钮移入顶部工具条、完成提示 2s 自动消失）、UI-A2（调整布局按钮位置/有效显示区完整矩形）、UI-A3（细节打磨）、UI-P1（用户验收）与 48-P3（0.0.13 正式发布/社区目录）任务；记录 DEC-004（首发 `id` 保持 `knowledge-graph-smoke`）、DEC-005（0.0.12 不单独发布，0.0.13 首次正式发布）；HANDOFF_NEXT.md 增加「下一阶段交接」细节（当前基线 `0564d84` 已 push、UI 实现位置、约束、发布清单、环境提示）。本轮无代码改动；`node scripts/test.mjs` 10 脚本全过；本地提交待用户 push。
- **2026-11-03 / Codex（0.0.12 日常库自用体验验收 + 验收材料归档）**：用户完成 0.0.12 日常库 1–2 天自用体验并以产品报告记录（`product-site-acceptance/product-site-acceptance-report/v0.0.12_PRODUCT_SITE_ACCEPTANCE_REPORT.md`：Node 4 重启后布局完整保留；Node 5 移动 `半导体物理.md` 后图谱自动更新、仅局部大小变化；Node 6 修改 `LTI analysis` 标题与正文后内部仅相应圆大小变化、外部不可见；Node 7 改章节并加链接后位置大小不可见变化；Node 8 调整 `Electronic engineering basic` 子元素位置仅内部变化，均“符合预期”）。产品端同时更正 47-P3 报告 Node 1 为“在插件设置里把 `电路进阶.md` 加入排除笔记”，并把验收报告与截图迁移到 `product-site-acceptance/`（截图仍 gitignore、仅本地）；本仓库新增该目录说明、`.gitignore` 增加新截图路径、清理 72 个 0 字节 Obsidian 数字占位文件；同步 47-P3 / 48-A2 / 48-P3 行与 `DELIVERY_48A2_RESULT.md`、README、HANDOFF。本轮为文档/归档整理，未改代码；`node scripts/test.mjs` 重跑 10 脚本全过；本地 commit 未 push，等待用户手动 push；发布动作（Release/社区目录）待 48-P3 决定。
- **2026-11-02 / Codex（0.0.12 装入日常库自用体验）**：用户确认描述文案、授权 0.0.12 装日常库、`id` 保持 `knowledge-graph-smoke`。已备份 0.0.11 三文件到 `.local/backup-daily-0.0.11/`，将 `.local/release/0.0.12/` 三文件装入 `D:\obsidian_vault\hush-ob-bucket\.obsidian\plugins\knowledge-graph-smoke\`：`main.js` 哈希不变（`205b1bd0…`）、`manifest.json` 变为 0.0.12/Knowledge Map/1.6.7/桌面限定、`styles.css` 不变、`data.json` 前后哈希一致（未触发迁移）。回执 `.local/daily-upgrade-0.0.12-receipt.json`；库内仅 manifest.json 一处改动，未在库内 commit。本轮无代码改动、未重跑合成脚本；未 push/未发布。
- **2026-11-02 / Codex（46-A3 90 分钟长时观测完成）**：9249（vault-real 授权副本，3310 节点，0.0.11）连续运行 5,401 s，540 次采样、89 次重建、17 次隐藏→恢复，failures 空、渲染异常 0；heap 41.32→52.13 MB（38.12–90.99 MB 锯齿、无单调增长）；fps p50 63.9；磁盘 rev83/groups0/530 B 全程不变，busy/unsupported false。同步 `DELIVERY_48A2_RESULT.md` §3 与 46-A3 行。本轮为观测与文档更新：10 个合成脚本未改动、未重跑；平台回归仍以 1.6.7/1.14.5/空白库既有证据为准；本地提交未 push、未发布；测试实例（9249/9251/9252/9253）已全部关闭。
- **2026-11-02 / Codex（0.0.12 交付候选 + 48-A2 候选回归；46-A3 长时观测进行中）**：按用户 48-P2 决定收紧 manifest：名称 `Knowledge Map`（id 仍 `knowledge-graph-smoke`，避免既有 data.json/命令失效）、版本 0.0.12、`minAppVersion` 1.6.7、`isDesktopOnly: true`、描述暂定；package.json 同步 0.0.12。`main.js` 与 0.0.11 相同（`205b1bd0…`/325,976 B）。`node scripts/test.mjs` 10 脚本全过；`node scripts/package.mjs` 产出 `.local/release/0.0.12/`（三文件 + SHA256SUMS，拒绝私有快照/data.json）。平台回归：Obsidian 1.6.7 上插件加载/构建/拖动保存/Ctrl+Z/重建通过（`phase-167.json`，0.0.11 对照 `phase-167-0.0.11.json`）；Obsidian 1.14.5 上拖动 rev 1051→1052、撤销 1053、磁盘 schema3 rev1053 groups30 structures6（`drag-9252.json`；首次拖动失败因 Excalidraw 欢迎弹窗拦截输入，关闭后通过）；空白库 9253 五项 A–E 全过（`blank-vault.json` verdict pass）。docs/INSTALL.md 更新到 0.0.12（平台桌面专用、最低 1.6.7、升级无需迁移）、README 与 DEVELOPMENT 同步；新增 `DELIVERY_48A2_RESULT.md`。本轮另启动 46-A3 90 分钟长时资源观测（9249，vault-real）：截至约 25 分钟 178 条记录，heap 38.1–81.6 MB 无增长趋势、渲染异常 0、busy/unsupported 均 false，完整结果待收尾。候选未 push、未发布、未装日常库；48-A2 最终交付验收待用户。

- **2026-11-02 / Codex（48-P1/P2 决策同步、47-A2 体验口径、46-A3 长时观测与 48-A2 回归启动）**：用户决定首发渠道仅自用、自用 1–2 天后再考虑公开分发；正式名称 `knowledge-map`；描述暂定；isDesktopOnly 与最低版本按实测收紧；47-A2 无需副本二次体验（用户直接在日常库体验）；正文摘要保持现有悬停摘要（DEC-003）。本轮启动 46-A3 长时资源观测与 48-A2 最终回归。


- **2026-11-02 / Codex（47-A2 授权副本压力与结构/改名验证完成；48-A1 文档/打包/空白库验证完成）**：用户同时要求“数据不丢、不泄漏、改名/重构后布局键正确对应节点”。(1) 授权副本 `vault-real`（95 篇、3310 节点）真实 30 分钟连续压力 384 轮/1802.1s，失败 0、渲染异常 0，重建 809 次 p50 0.400s/max 0.890s，预览 38/38、隐藏恢复 38/38、拖动 38 次（9 保存/29 幂等），磁盘 revision 68、布局 JSON 90,459B、data.json 136,283B，渲染堆 51–170MB 锯齿无单调增长、帧率 p50 65.1fps，结束恢复笔记且 95 个私有 md sha256 全部未变。(2) include 内合成笔记结构/改名：拖动保存 rev76→77 重建坐标不变；加标题 rev78 局部修复位移 delta(dx 2.688,dy -0.834,rel 0.967)；笔记改名 rev79、目录改名 rev80 后 groups 键与 structures 键同步迁移，改回 rev82 键恢复，删除 rev83 清理；布局磁盘/状态/store 无正文泄漏（note.excerpt 为内存悬停预览、不持久化）。(3) 48-A1：`scripts/package.mjs`（版本一致校验、拒绝 smoke-payload.json/data.json、三文件白名单 + SHA256SUMS）、`docs/INSTALL.md`（安装/升级/回退/卸载/信任提示/隐私/已知限制/反馈）、README/DEVELOPMENT 入口；空白库 9250 五项验证 A–E 全过（仅三文件安装、空库友好提示、建笔记 11 节点无泄漏、设置持久化、卸载删目录与 data.json），证据 `.local/evidence/delivery-48a1/blank-vault.json`（verdict pass）。证据 REAL_VAULT_RESULT.md、`.local/evidence/continuous-real/`；`node scripts/test.mjs` 10 脚本全过、构建 main.js sha256 仍 `205b1bd0…`。**未 push、未发布；47-A2 体验与 48-P1/P2/P3 仍待用户决定；manifest 名称/描述仍为内部文案。**

- **2026-11-01 / Codex（46-P2 用户验收）**：用户确认 46-P2 通过并自行更新状态：浅色主题下“应用变浅、图谱画布保持深色”可接受（DEC-001 据此决定维持图谱深色、不跟随宿主主题，若日后跟随作为新需求重新评估）；主窗口分屏、弹出窗口与跨窗移动体验符合预期；卸载删除已保存布局的行为符合预期。技术证据见 COMPAT_MATRIX_RESULT.md；本条仅记录产品确认与决定，未新增运行测试、未 push（push 另做）。
- **2026-11-01 / Codex（46-A2/A4 兼容矩阵完成，46-P2 待用户）**：按用户确认的两阶段矩阵，在独立库 Obsidian 1.14.5 + 0.0.11 上完成技术验证。阶段一（9247/vault-011）：深色基线、浅色可读性、主窗口分屏、弹出窗口与跨窗移动/关闭、拖动保存与撤销、Ctrl 预览与 Esc、全部释放后重开均通过；实测浅色下应用 chrome 变浅而图谱画布保持深色（`canvasLum` 46.2→46.1，DEC-001 现状记录），阶段一未捕获异常 0（22 条均为测试自造噪声）。阶段二（9248/vault-012，用户指定 7 插件）：加载 dataview 0.5.68、obsidian-git 2.41.1、style-settings 1.0.9、excalidraw 2.28.1、templater 2.26.0、omnisearch 1.32.0 后，拖动保存/撤销、增删/改名标题、文件与目录改名后的组键与 structures 迁移、预览内容（公式/表格/图片/链接/Dataview/Callout/Templater）、真实 Ctrl+Z、禁用启用、卸载重装全部通过，异常 0。发现并记录：第三方模态框（Excalidraw 欢迎页、Obsidian“更新链接”）会拦截画布输入并让 `renameFile` Promise 不 resolve，属宿主/其他插件行为，非本插件缺陷；卸载按宿主语义删除插件目录与 data.json（布局随卸载丢失）。证据 `.local/evidence/compat-matrix/{phase1,phase2,phase2b,phase2c}.json`、截图 `.local/native/evidence/shots/p1-*.png`、`p2c-*.png`，汇总见 COMPAT_MATRIX_RESULT.md。46-P2（主题/窗口产品确认）转待用户；⚠ 矩阵完成后应 push，但旧 PAT 已 revoke，本次仅本地提交，push 需用户提供新凭据或自行完成。
- **2026-11-01 / Codex（FB-006 定因：测试驱动 reload 产物，非插件）**：按用户明确“开始 FB-006 定因”执行（46-A2/A4 兼容矩阵按约定等 FB-006 结论后再开始）。复现：Playwright 注入式驱动对 Obsidian 渲染页执行整页 `page.reload()` + About 读取 → 每次约 4 条无栈字符串异常 `illegal access`（CDP `Runtime.exceptionThrown`；scriptId=1、url=index.html、line 0；reload 前后旧/新主世界各一批），0.0.9 与 0.0.10 相同。对照：`disablePluginAndSave` 后插件完全未加载（`plugins=[]`）仍 4 条（决定性）；纯 raw CDP 复刻相同序列 0 条；去掉本仓 init script 的 Playwright 仍 3 条；本仓正常使用路径（0.0.10/0.0.11 的 30 分钟 1161 轮、150 次混合压力、20 次拖动保存等）两异常均 0 次。归因：`illegal access` 由 Electron 原生层在渲染进程 reload 时抛出（该字符串在 obsidian-1.14.5.asar 中出现 0 次），`getZoomFactor` 为 Obsidian 自身 `app.js` 标题栏 `updateStatus` 使用 reload 后失效的窗口代理 `this.eWin`（插件不在调用栈上），本轮未复现、按历史条件记录。结论：FB-006 非插件缺陷；原生稳定性回归不应 reload 渲染页（改用重启应用/禁用启用插件），统一用 raw CDP。证据脚本 `.local/native/fb006_*.py`、结果 `.local/evidence/fb006-repro/RESULT.md`（含对照矩阵与上下文映射）。实例 9242（0.0.10）/9246（0.0.9）仍在运行；本条目未 commit/push/发布，发布范围仍以用户授权为准。
- **2026-11-01 / Codex（0.0.11 push 与 GitHub pre-release）**：用户明确选择 A 方案（push + tag + pre-release）并要求补 MIT LICENSE。完成：`chore: add MIT license` commit `b9dbd65`；push main `3491795..b9dbd65`（含 `13933dc`/`8a3a429`/`12e6393`/`92e7c40`/`b9dbd65`）；推送注解 tag `v0.0.11`；创建 GitHub pre-release `v0.0.11`（main.js 325,976 B sha256 `205b1bd0…`、manifest.json、styles.css、SHA256SUMS、RELEASE_NOTES.md），链接 https://github.com/xidianhush/knoeledg-graph-obsidian-plugin/releases/tag/v0.0.11 。私有截图目录 `product-site-img-evidence/` 未入库；Obsidian 社区目录提交未做；FB-006 仍未定因，故标记为 pre-release。

- **2026-11-01 / Codex（仓库更名）**：GitHub 仓库由 `knoeledg-graph-obsidian-plugin` 更正为 `knowledge-graph-obsidian-plugin`（拼写修正，旧地址 GitHub 自动重定向）。本地 `origin` 已改为新地址；DEVELOPMENT.md 的 clone 命令、HANDOFF_NEXT.md 仓库地址、README.md 的 Release 链接同步更新；历史记录（docs/history、HANDOFF_VALIDATION_RESULT.md、既有 TODO 条目）保留旧名作为当时事实。tag `v0.0.11` 与 pre-release 经 API 复核仍可访问（新地址）。
- **2026-11-01 / Codex（用户验收 0.0.11 + push/首发准备）**：用户在日常库（13:50–15:39）验收 0.0.11 完成，自行更新 TODO 的 47-P2 / 47-P3 并新增 `47-P3_PRODUCT_SITE_ACCEPTANCE_REPORT.md`：①删除 `电路进阶.md` 后同级其它节点位置/大小肉眼看不出变化；②调整 `Mathematics Basic` 下笔记元素位置符合预期；③调整 `Science and Tech` 目录位置后此前两组布局无可见变化。报告引用 4 张日常库截图 `product-site-img-evidence/`（约 2.9 MB），按“私有截图不入公开交付”约束已加入 `.gitignore` 并在报告内注明仅本地保存。同时修正 `.git/info/exclude` 过宽 PID 占位模式（原 `/[0-9]*` 会误忽略以数字开头的文档，改为 `/[0-9][0-9][0-9]*`）。2026-11-01 用户明确选择首发范围 A（push + tag + GitHub pre-release）并要求补 MIT LICENSE（commit `b9dbd65`）。已完成：push main（`3491795..b9dbd65`，含 `13933dc`/`8a3a429`/`12e6393`/`92e7c40`/`b9dbd65`）、推送注解 tag `v0.0.11`、创建 pre-release 并上传 5 个资产：https://github.com/xidianhush/knoeledg-graph-obsidian-plugin/releases/tag/v0.0.11 。Obsidian 社区插件目录提交（需 LICENSE/评审/仓库根 main.js）仍未做，留待后续。

- **2026-11-01 / Codex（日常库升级 0.0.11，待用户验收）**：用户明确授权直接升级日常库并随后人工体验，要求在需要验收时提醒。仅替换 main.js（sha256 `205b1bd0383a223f92aef6f09e36327882bd081f3c707bab725fb47b9d3bf049`）/manifest.json（0.0.11）/styles.css，data.json 未主动改写（仍 schema1 rev87/3 组/820,827B）；旧 0.0.6 四文件 + SHA256SUMS 备份至 `.local/backup-daily-0.0.6/`；日常库 git 变更仅 main.js、manifest.json。升级前用日常库完整副本（143 篇 md，文件列表一致）+ 最小 .obsidian 在 9244（0.0.11）/9245（0.0.6）双实例预演：0.0.11 首次建图迁移 schema1→3、rev87→88、groups 3、structures 0、data 486KB→8.8KB、`apply` restored 1/skipped 2，提示“布局已保存；已局部适配结构变化，撤销记录已清空”；0.0.6 同数据 restored 0/skipped 3（`Analog IC.md` 自 10-30 有 10 个标题改名）→ 升级不丢 0.0.6 当前已能应用的布局。两预演实例已关闭。预期行为与回退步骤见 `.local/acceptance-daily-0.0.11.md`。**已随 0.0.11 一起 push 并发布 pre-release `v0.0.11`（2026-11-01）；体验结论以用户反馈为准，不代宣称通过。**

- **2026-11-01 / Codex（0.0.11 本地提交 + 30 分钟连续压力 + FB-006 日志通道；当日稍后完成 push 与 pre-release）**：用户指定顺序执行。(1) 本地 commit `13933dc feat(layout): schema3 note-level structure sharing (0.0.11)`（20 文件；发布三文件暂存 `.local/release/0.0.11/` 含 SHA256SUMS）；Obsidian 在仓库根生成的占位数字文件，将被占用者写入 `.git/info/exclude`，工作区恢复干净；commit 后重跑 `npm test` 10 脚本全过，main.js sha256 仍 `205b1bd0…`/325,976 B。(2) 47-A2 原生 30 分钟连续压力（9243/0.0.11，1801.4s、1161 轮）：0 失败、0 渲染异常、重建 809 次 p50 0.400s、预览 151/151（p50 1.23s）、隐藏恢复 151/151（p50 1.88s）、busy 卡死 0、revision 单调 181→931、heap 27.8→29.7MB、帧率 p50 65.6fps；拖动/保存补充 20/20、Ctrl+Z 4/4；schema3 冷启动 rev/几何/磁盘一致。证据 `.local/evidence/continuous-011/`；局限见 RESULT.md（单实例单窗体、CDP 合成输入等）。(3) FB-006：9242 带 `--enable-logging` 重启打通宿主主进程 stderr/stdout 通道，开→关×10、About×2、竞态×8、抖动×8 后历史异常 0 复现，渲染侧 0 异常；仍不宣称修复，见 `.local/evidence/native-011/FB006_LOGGED_ATTEMPT.md`。**未 push、未发布；该时点未升级任何库（同日稍后获用户授权升级日常库，见上条）；独立库/日常库体验验收待用户，不宣称体验通过。**

- **2026-11-01 / Codex（47-A3 独立复核 + 0.0.11 原生回归，未提交）**：两名 teammate 并行复核后由 Lead 统一验收。(1) 独立语义/规模复核（未改 src/tests）：新核心 vs 冻结 0.0.10 核心 7 场景语义 EQUIVALENT、契约 5 项通过；5 档字节比 0.082–0.772、p50 时间比全 <1、保留堆比 0.072–0.731，脚本 `scripts/schema3_*.mjs`，报告 `.local/evidence/schema3/REPORT.md`。(2) 原生 0.0.11（9243：Obsidian 1.14.5 页面/Electron 30.1.2/Chrome 124，插件 sha256 `205b1bd0…`）：真实鼠标拖动→HUD“布局已保存”→磁盘 `layoutOverrides.schemaVersion=3`，原生命令重建后节点 dx=dy=0.0 完全恢复；Esc 取消（“调整中 · Esc 取消”→“已取消本次调整”、磁盘/rev 不变）；Ctrl+Z 撤销生效；同笔记两个组持久化后 `structures` 仅 1 条且 note 均指向同一 noteKey（该步用 HUD 同一 `layoutStore.command('edit',…)` 提交路径配合程序化位移）。原生调试要点（沙箱内启动 Obsidian 因命名管道/mojo 限制必崩，须在沙箱外 `cmd start` 起实例；CDP 需 `Page.setWebLifecycleState active`+`Emulation.setFocusEmulationEnabled`，否则 `document.hidden` 让 renderer 监听整体失效）已记入脚本注释。(3) FB-006 原生复跑：A 20/20、D 30/30+10/10、有效对照 20/20，历史异常 0 复现但未定因；`renameFile` 挂起在禁用插件下同样复现→宿主/环境；报告 `.local/native/evidence/FB006_report.md`。**未提交、未 push、未发布、未升级任何库；30 分钟连续编辑/预览压力与独立库体验仍待补，不宣称体验验收通过。**

- **2026-11-01 / Codex（47-A3 schema3 本地实现，未提交）**：重写 `src/core/layout-state.js` 为 schema3：整篇 outline/identity 移入按笔记共享的 `structures[noteKey]`，组记录只保留 shape/points/note/结构摘要（路径无关哈希，保证改名后仍能应用），撤销/重做/改名/删除/局部修复语义保持不变；schema1/2 数据懒迁移，迁移写失败保留旧数据，写失败回滚与旧版本兼容（拒绝 schema3 但不毁数据）均有回归。同步更新 3 个测试脚本容器断言，新增 `scripts/layout_scale_ab_0_0_10.mjs` 同机对照。`npm test` 10 脚本全过，0.0.11 构建 main.js sha256 `205b1bd0383a223f92aef6f09e36327882bd081f3c707bab725fb47b9d3bf049`（325,976 B）。同机 5000 标题/10 组记录 11.50→0.88MB、模型+协调+JSON p50 472.5→93.1ms。**未提交、未发布、未升级任何库；原生交互回归与用户体验待补，不宣称 0.0.11 已验收。**

- **2026-11-01 / Codex（源码交接完成）**：按用户明确授权完成182文件源码/文档提交与指定 GitHub 推送，远端默认 main 已核对为源码提交013cbb6。更新 HANDOFF_NEXT 为0.0.10交接、归档旧交接，规划多组优化、长期压力、FB-006、兼容与交付验收；新增 DEVELOPMENT 与 npm test 合成入口，冻结旧纯核心供迁移测试。工作区和无私有数据的干净检出均构建及10个合成脚本通过；main.js 哈希与既有候选一致。此条回执另作文档提交同步；未执行新原生验收或升级日常库，未创建正式Release。

- **2026-10-31 / Codex（续接进度与多组规模对照）**：向用户说明已完成功能、0.0.10待体验与尚未完成的稳定性/性能/发布项。新增 `layout_scale_ab.mjs`，完成1000/5000标题、1/10/50组的五档核心对照；所有保存组恢复且两版几何一致。发现长笔记多组仍重复保存整篇结构，后续优先评估该瓶颈。原生调试端口未监听，本轮没有新原生测试；FB-006、长期和预览压力保持进行中。未改运行代码、未升级库、未push；详情见 LAYOUT_SCALE_RESULT.md。

- **2026-10-30 / Codex（同条件原生A/B）**：新增共同fixture与分阶段计时脚本，拆出防抖、读取、Worker生命周期、布局协调、保存、视图提交和校验；两轮交错对照各每版48个测量样本，最终中位344.5/344.9ms。当前规模整体近似持平，不将旧不同时间段的短测差距归因于版本。程序与原独立库设置/布局均恢复0.0.10，本轮未改生产代码。FB-006与稳定性继续，未升级日常/真实副本或push。见 NATIVE_AB_RESULT.md。

- **2026-10-30 / Codex（0.0.10 记录去重）**：完成0.0.9首轮分档及120次短测，针对重复outline实现组级去重和schema2保护，独立库交付0.0.10；迁移/功能回归与120次短测完成。记录缩小约66.5%，配对核心成本降低，但本轮原生端到端更慢，不宣称整体加速。恢复原测试范围及布局，46-A3/FB-006继续，真实副本与日常库未升级、未push。证据 CONTINUOUS_EDIT_RESULT.md。

- **2026-10-30 / Codex（Step 4.6 首轮）**：记录用户 0.0.9 暂时符合预期，LC-P1 本轮验收完成；确认深色主窗口目标。46-A1 版本核实完成，46-A3 30 次开关及设置/取消/重载断言通过，但无异常门槛失败，新增 FB-006 待定位。有效/无效对照和失败证据完整保留，未改运行代码或日常库，未 push。见 DESKTOP_STABILITY_RESULT.md。

- **2026-10-30 / Codex（0.0.9 局部增删调整）**：按用户明确请求实现 LC-A2，保存位置热启动、空位放置、加权局部避让、几何/规模/计算预算及局部回退，笔记删除保留存活兄弟组供修复。独立库最终构建 28 项原生、16 浏览器及新增/回归核心检查通过，交付待体验。混合增删替换、层级变化和歧义场景仍有限制。未升级日常库或 push；证据 LAYOUT_INCREMENTAL_RESULT.md。

- **2026-10-30 / Codex（0.0.8 改名扩展）**：用户要求继续开发，先补齐 LC-A1b 单标题、可区分同名标题及旁支正文变更匹配，修正重复编号迁移占用判断；新增正反核心与原生场景通过。独立库已交付 0.0.8，LC-P1 待用户体验；没有把继续开发视作 0.0.7 验收通过。LC-A2 尚未执行，未升级日常库或 push。详见 LAYOUT_RENAME_EXTENDED_RESULT.md。

- **2026-10-30 / Codex（0.0.7 标题改名候选）**：用户明确同意实施。完成单次唯一标题改名身份快照与持久化迁移、旧布局兼容补齐及失败/过期保护，交付独立库并完成相关 Node、浏览器及 11 项原生检查。LC-A1 首批待用户验收，LC-A2 未实施；单标题/重复标题/复合修改的保守边界见 LAYOUT_RENAME_RESULT.md。未升级日常库，未 push。

- **2026-10-30 / Codex（FB-005 布局连续性）**：记录用户日常体验完成、原规划功能暂时正常；ME-P5 完成。新增 FB-005 与 ME-A7，运行六场景合成基线探针，定位标题身份、整篇 outline 和尺寸精确比较导致的过度失效。新增 LAYOUT_CONTINUITY_PLAN.md，建议先做改名身份迁移，再做增删局部修复；ME-A7 诊断完成，LC-* 尚未实现/验收。本轮未改运行源码、构建产物或日常库，未 push，未重跑历史全量测试。

- **2026-10-30 / Codex（0.0.6 日常试用交付）**：收到明确日常试用授权，完成 ME-A5 源码/产物固定与独立还原构建验证；备份日常 0.0.3 三运行文件及配置后仅替换三个文件，安装哈希一致、data.json 不变。ME-A6 完成，ME-P5 待重载与体验；ME-P4 首发功能冻结仍待决定。新增 RELEASE_006_RESULT.md。未重跑全部历史功能测试，未读写日常笔记、未 push。
- **2026-10-30 / Codex（ME-P3 真实场景体验确认）**：记录用户在 real-vault-trial 0.0.6 的明确反馈“所有功能暂时都符合预期”，ME-P3 标为已验收。说明本次体验本身就是 ME-P3，下一项为 ME-A5 交付固定与 ME-P4 产品决定。本轮仅维护记录，未新增测试、修改运行代码、升级日常库或 push。
- **2026-10-30 / Codex（ME-A4 技术收尾）**：核对 10-29 已完整结束的 8 档性能及真实副本 27 项检查；今日重核 95 篇笔记/567 图片、候选/安装包哈希并重新打开 real-vault-trial 0.0.6。保留副本中先前已有的一篇内容差异，所有原始文件与本轮前基线一致。ME-A4 完成、ME-P3 待用户验收；未改运行代码、未重复宣称历史测试为今日新跑，未升级日常库或 push。限制与证据见 LAYOUT_PERFORMANCE_RESULT.md。
- **2026-10-29 / Codex（0.0.6 体验确认）**：用户明确反馈“体验结束，所有功能暂时符合预期”，据此将 ME-A3 标为已完成、本轮体验验收通过。保留“暂时”的观察范围，ME-A4 性能/真实副本与 ME-P3 真实场景完整验收仍待办。本轮仅同步文档，未新增测试、未修改运行代码、未升级日常库、未 push。
- **2026-10-29 / Codex（ME-A3 保存与恢复）**：用户明确开始后实现 0.0.6 布局持久化、撤销/重做、局部/全库恢复、重建兼容、路径迁移及多视图写入保护。独立合成库真实落盘、应用重载、磁盘失败/迟到写入与按钮可达性验证通过，技术完成待体验；完整性能和真实副本验收仍待办。三文件候选已打包，旧运行文件与配置已备份，未升级原 test-vault 或日常库、未 push。详见 LAYOUT_PERSISTENCE_RESULT.md。
- **2026-10-29 / Codex（0.0.5 双测试库体验确认）**：用户明确在 test-vault-layout-fix 和原 test-vault 完成体验，全层级拖动、兄弟避让、子树整体移动和连线跟随正常，其他功能暂时正常。ME-A2 标完成、FB-004 标已验收；ME-A3 持久化/撤销/重建兼容仍待办，ME-P3 完整产品验收未完成。本轮仅同步记录，未新增测试、未修改运行代码、未升级日常库、未 push。
- **2026-10-29 / Codex（FB-004 全层级修复）**：记录用户明确通过项与笔记拖不动反馈；用户确认两种拖动均提示根级不支持。0.0.5 取消该限制，增加固定虚拟容器、全元素手柄、选中容器拖动优先，并修复小组边界收敛不足。16 浏览器+18 原生及 Node 检查通过，待用户复验。为保留普通实例中已打开的 test-vault，另建纯合成 test-vault-layout-fix 验证；原 test-vault 仅更新运行文件，未自动重载。未升级日常库、未 push。
- **2026-10-29 / Codex（ME-A2 正式集成）**：完成正式 GraphCore/HUD 布局事务、父级手柄、显示几何联动、Ctrl 抑制及 Esc/生命周期取消。独立 test-vault 候选 0.0.4，实际 Obsidian 1.14.5；91 项浏览器/原生断言、真实 packing 60 节点检查与三组 Node 检查通过。新增 LAYOUT_INTEGRATION_RESULT.md，固定三文件候选及证据。测试标签组准备问题已修正；旧 test-profile 默认库记录已备份并纠正，具体过程见结果文档。未升级日常库、未 push，ME-A3 持久化/撤销仍待办，用户阶段体验待反馈。
- **2026-10-29 / Codex（原型手感验收）**：保留用户“好拖、让位自然、暂时没感觉哪里别扭”的明确反馈，ME-A1 标完成、ME-P1 记录手感已验收；不推定根级范围已逐项确认或正式插件验收通过。下一执行项为 ME-A2，随后 ME-A3。只读复核正式渲染器/HUD/GraphCore 接入点；本轮仅同步反馈与文档，没有新增测试、修改运行代码或升级日常库。
- **2026-10-29 / Codex（开始 M0）**：用户明确开始后完成 ME-A0 本地源码归档及恢复构建验证、ME-A1 合成原型与几何/浏览器检查，ME-P1 转待用户验收。新增 LAYOUT_PROTOTYPE_RESULT.md 记录入口、证据、可行性及局限。首次浏览器检查发现 Esc 焦点问题，修复后 17 项通过；几何 17 项含 600 次移动通过。原型与正式 src 分离，未更新日常库或 0.0.3，未执行原生回归、未 push。
- **2026-10-29 / Codex（接手核对）**：已阅读 AGENTS、README、TODO、HANDOFF_NEXT、LAYOUT_EDITING_PLAN 及预览/交互结果文档；核对 manifest/package 均为 0.0.3，发布 ZIP 的 SHA-256 与交接记录一致。Git 当前仍仅跟踪 TODO.md，已有工作区修改保留。ME-A0 / ME-A1 继续待办：本轮请求为阅读交接，文档中的示例开场指令未作为立即实施授权。未修改运行代码、未运行新测试、未操作日常库；历史体验验收与长期稳定性缺口继续保留。
- **2026-10-27 / Codex（新交互规划与交接）**：按用户最新目标将手动调整布局排在正式上线之前，新增 ME-* 技术/产品分工，创建 LAYOUT_EDITING_PLAN.md 与 HANDOFF_NEXT.md。推荐显式模式、局部避让、子树整体移动、持久化及撤销；具体交互待原型体验。记录稳定基线、代码接入点、旧测试边界和交接开场指令。本轮只写规划文档，未实现新功能、未运行新测试、未改变 0.0.3 或日常库、未 push。
- **2026-10-27 / Codex（上线前建议）**：按用户询问核对当前清单、Git 跟踪范围、manifest、构建脚本及官方发布要求，新增待确认的发布准备建议，区分必要验证与可延期功能。本轮未做运行测试、未更改插件或日常库、未发布或 push；建议不等于实施或发布授权。
- **2026-10-27 / Codex（0.0.3 日常体验确认）**：读取并保留用户 45-P8 原文及“已验收”状态，确认日常体验卡顿/漏触发未再出现、暂未发现其他问题；同步当前进度、43-P1 和 FB-002 为修复后验收通过，保留长期稳定性边界。README 与结果文档同步更新。本轮仅维护记录，未新增运行测试、未改插件或日常库、未 push。
- **2026-10-27 / Codex（0.0.3 日常升级）**：按用户明确授权备份旧版并替换日常库三个运行文件，逐文件验证与已验收 0.0.3 产物一致；data.json SHA-256 前后均为 `76279877…`。完成 45-A7，新增 45-P8 待用户重载与复验；本轮仅做安装校验，未新增运行测试，未读写笔记、未 push。
- **2026-10-27 / Codex（真实副本体验确认）**：读取用户 45-P7 的明确通过反馈，保留三项结果及总结；将原有末尾 0.0.1 重载提醒改为历史说明，避免与此次验收混淆。同步 FB-002 / FB-003、README 与结果文档；新增待决定 45-A7。仅更新记录和核对候选/副本文件哈希，未新增运行测试、未升级日常库、未 push。
- **2026-10-27 / Codex（真实副本版本纠偏）**：记录用户在副本的三项反馈于 45-P7。安装核对发现 manifest 为 0.0.1，main.js 哈希 `9d62ccd2…`，不含已验收的 0.0.3 修复；备份并同步三个运行文件，保留 data.json，未读写笔记。副本调试端口 9239 未开放，未确认重载或执行新运行验收；需要用户在已打开副本重载后复验。后续交付先说明库名、安装版本及是否确认运行重载，避免把待办验证误作可体验入口。日常库未改动、未 push。
- **2026-10-27 / Codex（0.0.3 独立体验确认）**：读取并保留用户对 45-P6 的原始验收记录，确认所列五项行为符合预期、体验顺畅；同步当前状态与 FB-002，新增待办 45-A6，继续在已授权副本验证真实内容。本轮仅同步文档，没有新增测试、没有升级日常库、未 push。
- **2026-10-27 / Codex（0.0.3 预览负载候选）**：保留 45-P5 用户原文，补充“任意笔记、一个圆、松开不恢复”的聊天反馈，重新打开 FB-002，记录 FB-003 日常体验通过。新增 45-A5 / 45-P6；独立库完成 14 + 31 + 16 项相关检查（包含规则单测及渲染替身）和三组 Node 检查，准备三个合成样本及仅三文件候选包。历史 88/129 项不计为新通过。日常库未升级，未 push；性能观察和未确认根因见 PREVIEW_LOAD_RESULT.md。
- **2026-10-27 / Codex（日常重载确认）**：根据用户“已重新加载”的明确回复，更新当前状态与 45-P5；日常学习试用进行中。本轮仅同步文档，没有新增运行检查或替用户宣称日常验收通过。
- **2026-10-27 / Codex（0.0.2 日常库升级）**：记录用户独立库体验验收通过与明确升级授权；备份旧运行文件后升级日常库的三个运行文件，逐文件哈希校验通过，data.json 哈希前后一致，未读取或修改笔记、未 push。新增 45-A4 / 45-P5；重新加载插件由用户操作。本轮只做安装校验，没有把此前集成测试记为新执行。
- **2026-10-27 / Codex（恢复开发，交互修复候选）**：完成 Ctrl 与 Esc 已复现路径修复，产出 0.0.2。独立 Obsidian 1.14.5 验证 16 + 31 + 17 + 24 项集成检查及三组 Node 检查，像素回归一致；详情见 INTERACTION_RESULT.md。未把历史 129 项计为本轮通过，未升级日常库、未 push。FB-002 完整日常现象仍需用户复验；产品验收状态保留给用户。
- **2026-10-27 / Codex（首批体验反馈与联合排查）**：保留用户对 42-P1、43-P1、44-P3、45-P2 的验收与问题记录，确认已启用，新增 FB-002 / FB-003。只观察用户选择展示的日常库图谱，不接管输入；窗口显示 Obsidian 1.14.5，不代表完成该版本兼容验收。独立无界面浏览器运行三个合成诊断场景，证据在 `.local/evidence/hover-focus-probe.json`；预览服务为测试替身，不代表原生 Markdown 测试通过。未修改插件源码或日常库、未重跑历史 129 项验收。仅 TODO 建立本地 Git 基线 bf5c3c2，未 push；本轮整理保留为可比较的工作区改动。
- **2026-10-27 / Codex（日常试用安装）**：安装阶段 4.4 的 0.0.1 到日常库专属插件目录，四文件哈希核验通过，未覆盖已有插件、未自动启用、未读写笔记。更新 45-A0 / 45-P0 及当前试用决策；昨日测试结果仍为历史验收，本轮没有重新运行集成测试。
- **2026-10-27 / Codex**：建立共同清单，关联原始总路线图与当前验收证据；录入 4.0–4.4 已完成工作、用户已确认事项及尚未记录的产品验收；提出后续步骤。本轮为文档整理，没有修改插件或重新运行技术测试。
