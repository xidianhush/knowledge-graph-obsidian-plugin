# Development log（历史开发与验收流水）

> 这是 0.0.1–0.0.13 期间及 0.0.14 候选的开发/验收流水记录，原为根目录 `README.md` 正文（中文，含本机路径与本地证据引用，仅作历史参考）。面向使用者的说明见根目录 [README.md](../README.md)；当前任务、验收与证据见 [TODO.md](../TODO.md)；协作约定见 [AGENTS.md](../AGENTS.md)。

---

# Knowledge Map

Knowledge Map（仓库名仍为 `knowledge-graph-obsidian-plugin`，插件 id 仍为 `knowledge-graph-smoke`）是一个 Obsidian 桌面插件：把整个库渲染成可缩放的层级知识图谱，支持拖动布局，并在文件/标题改名、目录移动、笔记增删后保留已保存的布局。

**English summary**: Knowledge Map is a desktop-only Obsidian plugin that renders a vault as a zoomable hierarchical knowledge map. Nodes are colored by top-level folder, sized by subtree, and linked by wiki-links; drag-and-drop layout is persisted per group and survives renames, folder moves, and unrelated edits. Requires Obsidian 1.6.7+ on desktop. The released `main.js` is a self-contained bundle built by `scripts/build.mjs` with no npm runtime dependencies, so there is no lockfile. Install from the [community directory](https://community.obsidian.md/plugins/knowledge-graph-smoke), or copy `main.js`, `manifest.json` and `styles.css` into `.obsidian/plugins/knowledge-graph-smoke/`.

当前工作区：`D:/what_i_am_doing/Project/knowledge-graph-obsidian-plugin`（原开发机路径 `D:/Documents/ChatGPT/knoeledg-graph-obsidian-plugin` 仅作历史参考）。

**2026-11-01 开发交接**：从 GitHub clone 后先读 [HANDOFF_NEXT.md](HANDOFF_NEXT.md)，按 [DEVELOPMENT.md](DEVELOPMENT.md) 执行 `npm test`。该入口使用合成输入，无需个人库。源码交接不等于正式发布；原机器路径、本地证据与安装状态均须与新环境区分。

**2026-11-06：0.0.14 候选完成（未 tag / 未 Release）**。本轮按用户确认范围完成社区评审建议与新增需求：①UI-A11 i18n 中英双语——新增 `src/i18n.js` 引擎与 `src/i18n.core.js`/`i18n.ui.js`/`i18n.hud.js`/`i18n.obsidian.js` 四域字典（209 key，en/zh 集合一致），全部用户可见文案与 `upstream/template.html`（40 个 `data-i18n*` 绑定）改走 `kgT()`；语言跟随 `moment.locale()`（非中文默认英文），设置页新增「跟随应用 / 中文 / English」并存 `settings.language`（缺字段视为 auto，兼容 0.0.13）；切换后已打开的图谱与设置页立即刷新，命令面板 / ribbon 提示 / 标签页标题在重载插件后更新。②UI-A6 移除 `:has`：`src/host.css` 改 `.kg-surface.kg-sidebar-open .kg-layout-tools`，由 `hud.setSidebarOpen()` 同步类，偏移值与原规则相同。③UI-A7 Release 三资产 + attestations：新增 `.github/workflows/release.yml`（tag `0.0.*` 触发、runner 上构建、三段版本校验、只上传 main.js / manifest.json / styles.css、SHA256SUMS 与说明进 Release 正文、`attest-build-provenance@v2`）与 `docs/RELEASE_CI.md`；本地演练 7/7 通过。④UI-A8：图例收起状态改存 `data.json` 顶层 `ui`（首次从 localStorage 迁移一次），写失败仅 warn；未扩大持久化范围。⑤新增 `scripts/i18n_check.mjs` 六项门禁，`npm test` 由 10 个合成脚本增为 11 个且全过；schema3 差分检查的「写失败」场景改为真正触发写失败（原实现被单所有者守卫提前拒绝而空跑）。⑥UI-A13 README 重写为「理念 + 一分钟上手 + 图例含义 + 功能/安装/限制 + 中文简介」，配主 GIF（合成库录制）、布局横带与中英设置页截图。⑦版本升 0.0.14（`package.json`/`manifest.json`/`versions.json`），构建 `main.js` 396,234 B sha256 `b022a4d810c38280e23068e718e68f9e0030bd4ba763b2dc0abae0b847903dc5`；新增 `docs/RELEASE_NOTES_0.0.14.md`，`docs/INSTALL.md` 升版并补充语言与持久化说明。本轮仅 commit + push；**tag `0.0.14`、GitHub Release、门户 512 图标上传与 Overview 刷新均待用户验收后授权**（Actions attestations 方案用户已接受；推 tag 前需确认仓库 Settings → Actions → General → Workflow permissions 为 read-write）。

2026-11-01：47-A3 首轮实现完成——布局存储升级为 **schema3**，同一笔记的所有分组共享一份 identity，`outline` 不再逐组重复；旧 schema1/2 数据在下次协调/写入时自动迁移，失败保留原数据。0.0.11 合成回归 10 个脚本全部通过；同机 5000 标题/10 组核心记录 11.50MB→0.88MB、模型+协调+JSON p50 472.5→93.1ms，见 [LAYOUT_SCALE_RESULT.md](LAYOUT_SCALE_RESULT.md)。2026-11-01 已 commit `13933dc`，push 到 origin/main 并发布 GitHub pre-release [v0.0.11](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/releases/tag/v0.0.11)；原生 0.0.11（Obsidian 1.14.5）拖/存/重建（dx=dy=0）/Esc/撤销、同笔记两组共享 1 条 structures、30 分钟连续压力（1161 轮 0 失败、重建 p50 0.400s、预览 151/151、隐藏恢复 151/151、busy 卡死 0）、schema3 冷启动（rev/几何一致）均已完成，见 `.local/evidence/native-011/LAYOUT_NATIVE_RESULT.md` 与 `.local/evidence/continuous-011/RESULT.md`。用户已于 2026-11-01 在日常库完成 0.0.11 体验验收（47-P2/47-P3，13:50–15:39，报告 `47-P3_PRODUCT_SITE_ACCEPTANCE_REPORT.md`）。2026-11-01 用户明确授权后，日常库已升级至 0.0.11（仅替换三个运行文件，data.json 保留 schema1 rev87、首次建图时迁移；0.0.6 四文件已备份，预期提示与回退步骤见 `.local/acceptance-daily-0.0.11.md`）。

**2026-11-04 晚：0.0.13 已正式发布**。tag `0.0.13` 与首次正式 GitHub Release 已上线（https://github.com/xidianhush/knowledge-graph-obsidian-plugin/releases/tag/0.0.13），资产含 `main.js` 333,570 B sha256 `37589a6f32203026ff82a564ad83013b72dbb19c8a8180f7c04da67a49ba8ab5`、`manifest.json`、`styles.css`、`SHA256SUMS`、`RELEASE_NOTES.md`；仓库新增 `versions.json`（`{"0.0.13":"1.6.7"}`）。社区目录提交入口已从 GitHub PR 变更为官方门户 <https://community.obsidian.md>（`obsidianmd/obsidian-releases` 已禁用 PR），需用 Obsidian 账号登录提交，待用户执行或授权。**2026-11-04：0.0.13 修复日常库验收反馈**。`product-site-acceptance/product-site-acceptance-report/v0.0.13_PRODUCT_SITE_ACCEPTANCE_REPORT.md` Node 11 发现：删除 `## 第四章常见题型分析方法` 后，同一笔记的多个一级标题明显位移。根因是 schema3 局部修复对「同名且正文为空」标题的保守校验过严——`repairGroup` 要求重复标题带非空 evidence，两个空正文同名标题的 evidence 都是 `0:...`，被误判为不可信后整组修复返回 null，笔记 H1 退回自动布局。修复后这类纯增删仍保留已保存布局（同名计数变化或证据不一致仍回退），新增 2 条合成回归；在「日常库副本 vault-013」原生复算：note 组 `repair {moved:4}` 应用后 5 个 H1 相对偏差 0.0px、`errors []`。同时把布局编辑提示「点『结束调整』退出」改为「再次点击顶栏 ✥ 退出」。`npm test` 10 脚本全过；构建 `main.js` 333,570 B sha256 `37589a6f32203026ff82a564ad83013b72dbb19c8a8180f7c04da67a49ba8ab5`，重新打包 `.local/release/0.0.13/`。**日常库需再次替换三文件后继续 UI-P1 验收；发布仍需授权。** 2026-11-04 晚（发布门禁）：用户确认本轮项目验收全部通过（报告 Node 12 复验删除标题场景符合预期；Node 11 截图被误覆盖，已用 94% 缩放缓存副本恢复，原始分辨率不可得）。正式发布前做最后一轮「发布门禁」而非历史全量重跑：A 打包/版本一致性全部通过；B 空白新库安装/空态/建图/重开 16 项通过；C 真实数据（日常库副本 vault-013，rev345、12 组保存布局）reconcile 回归 4 场景全部通过——原缺陷场景 H1 相对偏差 0.0px、删除同名标题后兄弟保持 0.0px、重命名一级标题走迁移保持 0.0px、新增一级标题为新增节点且既有 5 个 H1 保持 0.0px，其他已保存组无误改。门禁 C 另暴露同族边界：笔记含「同名且正文为空」标题时，重命名会因改名映射的 distinguishable 守卫拒绝而整篇回退；已修复（空正文同名签名在计数不变时视为可互换）并新增 1 条合成回归，原生复算重命名后 5 个 H1 偏差 0.0px。

**2026-11-03 晚：0.0.13 UI/UX 打磨完成（本地候选，未 push/未发布）**。按 UI-A1/A2/A3 完成三处界面改造：①「重新构建」从底部状态条移入顶部工具条（构建中禁用并转圈，完成提示改为底部居中胶囊、2 秒自动消失）；②「调整布局」入口收进顶部工具条，编辑时顶栏下方出现全宽工具条，阅读态不再有右上浮动面板，图谱有效显示区保持完整矩形；工具条展开时图例、搜索命中列表与画布 inset 按其真实高度避让，对象详情侧栏打开时工具条自动让位；③细节打磨：顶栏两个动作按钮固定为单字形图标（悬停/aria 提示含义），宽/窄窗口都不换行、不再把「重置视角」挤出右缘（2026-11-03 日常库反馈宽窗口文字被挤成两行后改为固定图标）、状态胶囊分层、激活态高亮、编辑提示与 aria-label。布局数据仍为 schema3、capture/reconcile/apply 契约与 `upstream/` 渲染/物理逻辑未改。`npm test` 10 个合成脚本全过；原生 Obsidian 1.15.0（合成库 vault-012）验证了构建状态流转、2 秒消失、宽/窄容器顶栏、编辑态横带与侧栏避让、浅色主题、视图重载无异常（证据见 TODO UI-A1/A2/A3 行）。构建 `main.js` 332,529 B sha256 `ab00889a33f9ad7db295bcb0b022d15a8e6b7a12ff9ce35590bf8c484cea7b52`，打包产物 `.local/release/0.0.13/`（三文件 + SHA256SUMS + RELEASE_NOTES）；发布说明草稿 `docs/RELEASE_NOTES_0.0.13.md`。**待用户在 daily vault 验收（UI-P1）；tag/Release/社区目录提交需用户明确授权。**

2026-11-03：0.0.12 已装用户日常库完成 1–2 天自用体验并通过（功能层面“完全符合预期”），验收报告归档到 [product-site-acceptance/](product-site-acceptance/)；后续进入 **0.0.13 UI/UX 打磨 + 正式发布准备**，交接细节见 [HANDOFF_NEXT.md](HANDOFF_NEXT.md)「下一阶段交接」。

2026-11-02：0.0.12 交付候选准备完成（48-P2 平台收紧 + 48-A2 回归），并按用户授权装入日常库用于 1–2 天自用体验（仅元数据变化，`main.js` 与 0.0.11 相同、data.json 未动）。2026-11-03：日常库 0.0.12 自用体验完成，产品验收报告记录在 `product-site-acceptance/product-site-acceptance-report/v0.0.12_PRODUCT_SITE_ACCEPTANCE_REPORT.md`（Node 4–8 均符合预期：重启后布局保留、移动/改标题/加链接/调整子元素位置只有局部变化）；验收报告与截图已归档到 `product-site-acceptance/`（截图仅本地保存，不进公开仓库）。48-A2 已完成，48-P3（是否公开分发/社区目录）待决定。manifest 正式名称改为 **Knowledge Map**（内部 id `knowledge-graph-smoke` 不变），`version` 0.0.12、`minAppVersion` 1.6.7、`isDesktopOnly: true`；`main.js` 未改（sha256 `205b1bd0383a223f92aef6f09e36327882bd081f3c707bab725fb47b9d3bf049`，325,976 B）。本地打包产物在 `.local/release/0.0.12/`（三文件 + SHA256SUMS）。0.0.12 已在 Obsidian 1.6.7 与 1.14.5 上通过构建/拖动保存/Ctrl+Z/重建恢复，并在空白库通过安装检测/空库提示/建库建图/设置持久化/卸载五项验证，详见 [DELIVERY_48A2_RESULT.md](DELIVERY_48A2_RESULT.md)。该候选尚未 push、未发布；日常库仍为 0.0.11，供用户在自用体验期使用。46-A3 长期资源观测已启动（进行中）。

2026-10-31：继续推进 47-* 规模验证，五档多组布局核心对照完成。单篇长笔记保存多组时仍存在结构信息重复，下一步评估跨组共享与兼容迁移；尚未修改运行代码。详见 [LAYOUT_SCALE_RESULT.md](LAYOUT_SCALE_RESULT.md)。原生长测、FB-006 定位和 0.0.10 用户体验仍待完成。

**共同计划与进度入口：[TODO.md](TODO.md)**。按 Step 记录技术与产品双方的任务、完成状态、验收条件、体验反馈和待决定事项，双方均可编辑。原始总路线图在 [PLAN_APPLICABILITY.md](D:/obsidian_vault/knowledge-graph/PLAN_APPLICABILITY.md)，属于设计背景，其中阶段 4 的旧状态已过时；当前进度看 TODO 与本项目验收结果。后续协作维护规则见 [AGENTS.md](AGENTS.md)。

**手动布局开发**：**0.0.6 已通过独立库、真实副本及本轮日常体验；用户反馈原规划功能暂时正常，同时提出 FB-005：标题改名等小改动导致已有布局大范围回退**。诊断与改进方案见 [LAYOUT_CONTINUITY_PLAN.md](LAYOUT_CONTINUITY_PLAN.md)，**用户已反馈 0.0.9 暂时符合预期；0.0.10 布局记录去重候选已在独立库交付，待体验，稳定性验收保持进行中**；新增空位优先、有界局部避让和兼容旁支保留。生命周期检查发现尚未定因的 FB-006 异常，尚未全量通过，见 [DESKTOP_STABILITY_RESULT.md](DESKTOP_STABILITY_RESULT.md)。适用范围、证据和步骤见 [LAYOUT_INCREMENTAL_RESULT.md](LAYOUT_INCREMENTAL_RESULT.md)，改名历史见 [LAYOUT_RENAME_EXTENDED_RESULT.md](LAYOUT_RENAME_EXTENDED_RESULT.md)。0.0.11 使用布局 schema3（同笔记各组共享 identity），兼容 schema1/2 自动迁移；0.0.10 及更早版本读到 schema3 会禁用布局调整但保留原数据，降级须参考备份说明，见 [CONTINUOUS_EDIT_RESULT.md](CONTINUOUS_EDIT_RESULT.md)。同条件原生A/B显示当前合成规模整体更新延迟近似持平，分阶段结果见 [NATIVE_AB_RESULT.md](NATIVE_AB_RESULT.md)。real-vault-trial 磁盘仍为 0.0.6；日常库已于 2026-11-01 获用户授权升级至 0.0.11，用户同日在日常库完成 0.0.11 体验验收（47-P2/47-P3）。ME-A5 交付固定和 ME-A6 安装完成，首发功能冻结仍待决定。调整面板支持“恢复此组”和“全库恢复自动布局”；调整模式可用 Ctrl+Z、Ctrl+Shift+Z / Ctrl+Y。布局保存于本库插件 data.json，不写笔记；撤销历史最多 50 次，仅在本会话有效。候选会先尝试局部适配；无法可靠迁移、求解无解或超限时按组回退并提示。交付与回退见 [RELEASE_006_RESULT.md](RELEASE_006_RESULT.md)，功能限制见 [LAYOUT_PERSISTENCE_RESULT.md](LAYOUT_PERSISTENCE_RESULT.md)；当前状态看 TODO 的 ME-* / LC-*，9241 页面仍为旧合成原型。

阶段 4.0–4.3 已完成；本轮完成设置界面、配置持久化、构建反馈及独立测试库验收，并按用户确认的范围完成真实库副本试用。当前活动源码为根目录 `src/`，构建入口为 `scripts/build.mjs`。`.stage4/`、`.graphcore/`、`.pipeline/`、`.native/` 是接手时已有的历史增量文件，不作为当前构建入口。历史 HANDOFF_STAGE4.md 不用于判断进度。

**2026-10-30 更新（ME-A4 / ME-P3）**：性能分档及真实副本技术验证完成，用户真实场景验收通过，仍使用原 0.0.6 产物。真实副本包含 95 篇笔记、3310 个节点，27 项检查通过，原始笔记和图片未变。密集相切组仍可能放不下，超过 128 同级/5000 受影响节点不支持调整；详细测量、异常和未测范围见 [LAYOUT_PERFORMANCE_RESULT.md](LAYOUT_PERFORMANCE_RESULT.md)。体验验收不代表长期稳定性结论或日常升级授权。

本轮结果见 [SETTINGS_RESULT.md](SETTINGS_RESULT.md)。原生预览与更新契约见 [NATIVE_RESULT.md](NATIVE_RESULT.md)，纯 JS 管线历史验收见 [PIPELINE_RESULT.md](PIPELINE_RESULT.md)。

2026-10-27 阶段 4.5 首轮交互修复版为 **0.0.2**，修正已复现的 Ctrl 焦点漏触发与 Esc 离开图谱问题；独立库技术回归及用户体验验收通过。经用户明确授权，日常库运行文件已升级，保留现有配置；用户已确认重新加载，进入日常试用。见 [交互修复结果](INTERACTION_RESULT.md)。最低 Obsidian 版本为 1.5.7，本轮实际测试 1.14.5。

随后用户反馈日常库 Esc 正常，Ctrl 预览仍卡死。当前源码为 **0.0.3**，加入限量预览、120 ms 悬停等待和最新请求串行处理；14 项新增检查、31 项原生及 16 项键盘回归通过。2026-10-27 用户在 TODO 45-P6 / 45-P7 / 45-P8 依次确认独立库、真实副本与日常库体验通过；日常库升级后卡顿/漏触发未出现，暂未发现其他问题。已报告的 Ctrl / Esc 问题本轮闭环，长期稳定性仍待后续验证。详见 [预览负载结果与限制](PREVIEW_LOAD_RESULT.md)。

## 使用

**安装、升级、卸载、回退与已知限制见 [docs/INSTALL.md](docs/INSTALL.md)**（面向使用者，0.0.13）。发布说明见 [docs/RELEASE_NOTES_0.0.13.md](docs/RELEASE_NOTES_0.0.13.md)。社区插件目录条目已上线：<https://community.obsidian.md/plugins/knowledge-graph-smoke>（自动评审已完成，仅余建议项）。

**产品端验收报告见 [product-site-acceptance/](product-site-acceptance/)**：0.0.11 报告（Node 1–3，已更正 Node 1 表述）与 0.0.12 日常库自用体验报告（Node 4–8）；对应截图含真实库笔记标题，仅本地保存、不进公开仓库。

### 日常学习试用

**日常交付（2026-10-30）：日常库三个运行文件已从 0.0.3 升级到 0.0.6，用户已完成本轮体验，原规划功能暂时符合预期。** 旧运行文件和配置已备份，三个安装文件哈希与验收产物一致，data.json 前后不变。后来新增的布局连续性改进与 0.0.10 仍在独立库验证。安装回执 `.local/daily-upgrade-0.0.6-receipt.json`；源码固定、安装与回退见 [RELEASE_006_RESULT.md](RELEASE_006_RESULT.md)。没有自动操作日常运行实例。

历史：2026-10-27 日常库升级 0.0.3 并通过 45-P8 用户验收；旧版 0.0.2 留备份，原回执 `.local/daily-upgrade-0.0.3-receipt.json` 保留，不作为本轮重新执行的测试。

2026-10-27，经用户安装权限确认，将已验收的阶段 4.4 构建（版本 0.0.1）安装到 `D:/obsidian_vault/hush-ob-bucket/.obsidian/plugins/knowledge-graph-smoke/`。只新增三个运行文件及本插件的 data.json，四文件哈希核验通过；没有修改笔记、其他插件配置或启用列表。安装回执在 `.local/daily-install-receipt.json`。这是个人日常试用，尚不代表桌面稳定性与正式发布验收已经完成。

同日，用户验收独立库 0.0.2 后明确授权日常升级，现已备份并替换 main.js、manifest.json、styles.css，哈希与验收产物一致；data.json 前后哈希相同，用户扩展的范围设置保留。升级回执与旧版备份位置见 `.local/daily-upgrade-0.0.2-receipt.json`。请在第三方插件设置中关闭再开启本插件，再打开当前库图谱，使正在运行的实例加载新代码；无需卸载插件。

1. 在日常库的 **设置 → 第三方插件** 中找到并启用 **Knowledge Graph Smoke**。若列表未刷新，先关闭并重新打开设置；仍未出现时保存当前工作再重启 Obsidian。
2. 点击侧边栏网络图标，或在命令面板执行 **Knowledge Graph Smoke: 从当前库构建知识图谱**。日常安装不包含冻结快照，请使用当前库命令。
3. 初始范围为 `Science and Tech/**` 与 `Literature History Philosophy/**`；排除 `Utilities/**`，自动更新开启、防抖 500 ms、原生预览开启、预算 60000 字符。可在本插件设置里查看和调整。
4. 学习中按需要搜索/缩放、Ctrl 悬停预览、打开笔记或标题。把“场景 → 实际表现 → 希望怎样”记入 [TODO.md](TODO.md) 的反馈区，也可以直接在聊天里描述。

若影响学习，可关闭图谱标签页（停止该视图的更新监听和构建），或在第三方插件列表禁用本插件。需要卸载时，使用该插件的卸载入口；笔记不由本插件安装流程修改，卸载会移除插件配置。不要用独立库验收脚本连接日常库执行增删测试。

### 图谱操作与设置

在独立库中，通过侧边栏网络图标或命令 **Knowledge Graph Smoke: 从当前库构建知识图谱** 打开图谱。插件名称与 ID 暂时沿用既有名称以保持安装和测试兼容。

进入 **设置 → Knowledge Graph Smoke**：

- **包含范围 / 排除范围**：每行一个规则，例如 `Science and Tech/**`。`**` 明确表示全库；空包含范围不能保存。沿用管线的匹配语义：`*` 可跨目录，规则同时匹配库内相对路径和文件名，忽略大小写；不是 gitignore 语法。排除优先于包含。
- **排除笔记**：每行一个笔记名、相对路径或去掉 `.md` 的路径；笔记名会排除不同目录的同名笔记，区分大小写。
- **目录映射**：可选 JSON 数组，如 `[{"from":"课程","to":"学习"}]`。使用最长前缀，仅改变图中目录，不移动文件。冲突时构建明确报错并保留旧图。
- **自动更新 / 防抖**：默认开启、350 ms，可配置 100–10000 ms。关闭后不响应 Vault 变动，仍可用命令或状态栏手动重建。保存新设置会重建已打开的当前库视图。
- **原生笔记预览 / 字符预算**：默认开启；0 使用默认 60000 字符，可设为 0–1000000。0.0.3 实际正文另受 12000 字符、80 个公式标记和 6 个顶层嵌入标记限制（不是硬内存上限）。Ctrl + 悬停等待 120 ms 后临时预览，点击固定，Esc 关闭；关闭预览不会读取预览正文。预算按完整行截取，重笔记从目标标题开始，超出时提示打开全文。

点击 **检查范围** 只枚举路径并报告匹配数量，不读取正文；点击 **保存并应用** 才保存并触发重建。无效输入和保存失败留在设置界面，运行中配置保持不变。**撤销未保存修改** 恢复最近成功保存的配置。

隐藏目录、node_modules 等由既有管线排除，`Utilities/API Key.md` 始终在读取前排除。旧图暂时保留时，已移出范围的节点不能继续触发原生读取。

图谱显示等待防抖、读取进度、布局计算、完成、空范围、失败、取消状态；完成时显示笔记数、节点数、边数与耗时。构建中可取消，完成/失败后可重新构建。取消仅取消本次任务，后续事件仍遵循自动更新开关。失败保留上次成功图谱；关闭视图释放 Worker、计时器、订阅及预览组件。

原有滚轮缩放、拖拽、搜索、过滤、层级、选中、原生公式/图片、笔记及标题跳转契约保留。新图成功后恢复相机、搜索、过滤、标签模式和仍存在的选中项。

## 配置持久化

使用 Obsidian `loadData()` / `saveData()`，仅存入该库插件的 `data.json`。兼容原有 `pipeline.config`、`annotations`、`candidates`；保存保留未知根字段、高级布局/配色字段和旧预览预算。保存操作串行执行，写入成功后才发布运行中配置。

0.0.6 另存 `layoutOverrides: { schemaVersion: 1, revision, groups }`，与设置共用串行队列。松手后保存整组最终位置；失败时恢复上次保存的位置并提示。普通正文编辑和兼容重建保留布局；成员、标题结构或半径不兼容时该组回退。全库恢复会清除全部组覆盖（包含当前范围外的覆盖），可在本会话撤销。历史在结构变化和插件重载后清空。

```json
{
  "settingsVersion": 1,
  "settings": { "autoUpdate": true, "debounceMs": 350 },
  "pipeline": {
    "config": {
      "include": ["Science and Tech/**", "Literature History Philosophy/**"],
      "exclude": ["Utilities/**"],
      "exclude_notes": [],
      "remap": [],
      "preview": { "enabled": true, "max_note_chars": 60000 }
    },
    "annotations": {},
    "candidates": {}
  }
}
```

## 构建和测试

本机 Node.js 标准库构建，无 npm 安装步骤；插件运行时不调用 Node、Python 或网络服务，不新增第三方运行时依赖。测试脚本依赖 Python、Playwright、Pillow、本机 Obsidian 与 Chrome。

```powershell
node scripts/build.mjs
node scripts/core_check.mjs
node scripts/pipeline_contract_check.mjs
node scripts/settings_check.mjs
python scripts/prepare_smoke.py --launch
python scripts/native_check.py
python scripts/interaction_check.py
python scripts/preview_pressure_check.py
python scripts/vault_pipeline_check.py
python scripts/smoke_check.py --reload-plugin
python scripts/browser_core_check.py
python scripts/settings_integration_check.py
```

本工作区独立测试实例使用 `test-vault/`、`test-profile/` 与 `127.0.0.1:9238`。修改后将 `dist/main.js`、`manifest.json`、`styles.css` 复制到该测试库的 `.obsidian/plugins/knowledge-graph-smoke/` 后重载。所有 Obsidian 集成脚本先核对库的绝对路径，拒绝连接其他库。不要并发运行操作同一个 Obsidian 实例的脚本。

冻结快照回归使用 `.local/smoke-payload.json` 与 `upstream/` 原渲染器；prepare/smoke 历史脚本仍需要本机原渲染项目 `D:/obsidian_vault/knowledge-graph` 做来源核对。它不是日常知识库。`upstream/provenance.json` 保留冻结源码哈希。`smoke-payload.json` 只用于快照命令；当前库模式只需 main.js、manifest.json、styles.css。

2026-10-26 本轮：原有 88 项集成检查全部通过；新增设置集成 24 项、真实副本验收 17 项通过；核心、管线契约及设置 Node 检查通过。快照 Canvas PNG 逐像素一致。没有重跑阶段 4.2 的 12 组 Python/JS golden 与 Worker 全量对照，不将其历史结果算作本轮结果。

## 已确认的真实库副本

2026-10-27 版本核对：副本原先仍安装 0.0.1；已备份并同步三个运行文件至 0.0.3，保留 data.json。**用户已在 45-P7 确认复验通过**：Ctrl 不再卡顿、悬停可预览，LTI analysis 内选中后的 Esc 保留图谱。该结论来自用户体验；未补跑副本公式/图片与资源压力自动检查，未通过调试接口取得运行版本。随后日常库也按明确授权完成 0.0.3 文件升级，并通过 45-P8 用户体验验收。

用户确认源库为 `D:/obsidian_vault/hush-ob-bucket`，目标为当前项目 `real-vault-trial/`，仅包含 **Science and Tech** 与 **Literature History Philosophy** 的 Markdown 及其中引用的本地图片。

2026-10-26 已复制 95 篇笔记、567 张图片（420159458 bytes），没有复制源库 `.obsidian`、`.git`、`.trash` 或其余笔记目录。1 个图片引用未能匹配，记录在本地 `.local/evidence/real-trial-copy.json`。当时未向日常库安装；2026-10-27 的日常安装见上节。未读取 Utilities/API Key.md，没有 push。

副本使用 `real-trial-profile/`，独立端口 `127.0.0.1:9239`，只启用当前插件及基本核心插件。已实测 3310 节点、3406 边，构建约 0.22–0.26 秒（单机两次观察，不是性能保证）。副本当前自动更新开启、防抖 500 ms、预览开启、预算 60000 字符。

```powershell
# 仅在目标不存在、且独立测试已通过时使用；脚本拒绝覆盖现有副本。
python scripts/prepare_real_trial.py --launch
# 已启动副本时复验：只在副本创建/删除合成探针笔记，原始副本文字保持不变。
python scripts/real_trial_check.py
```

`real-vault-trial/`、`real-trial-profile/`、`test-vault/`、`test-profile/`、`.local/`、`dist/` 均已 gitignore。证据与截图包含本地内容，不应发布。

## 代码与边界

`src/settings.js` 负责设置草稿、校验、范围检查与原生设置页；`src/plugin.js` 负责视图、配置发布、自动更新和构建状态；`src/adapters/vault-pipeline.js` 负责先筛选后读取及 Worker；`src/adapters/obsidian-native.js` 负责按需预览和跳转。`src/core/`、纯 JS 管线算法与共享 Canvas/HUD 的活动代码保持原契约。

更新仍为 Worker 完整重建。大库长时间连续编辑、移动端、触摸、浅色主题、弹出窗口、第三方 Markdown 后处理插件组合未完成验收。2026-10-26 设置阶段的新实例运行过 1.6.7；2026-10-27 的交互及预览候选检查实际运行 1.14.5，具体覆盖范围见对应结果文档。
