# 下一位 Coding Agent 交接入口

交接日期：2026-11-01（Asia/Shanghai），最后更新 **2026-11-07**（README 精简与 0.0.15 iPadOS 发布交接）。仓库：https://github.com/xidianhush/knowledge-graph-obsidian-plugin （2026-11-01 由拼写错误的 `knoeledg-graph-obsidian-plugin` 更名，旧链接由 GitHub 重定向）。本文是接手摘要，**TODO.md 是唯一当前执行清单**。原 2026-10-27 交接文档已归档至 `docs/history/HANDOFF_2026-10-27.md`，不能照其旧步骤重新开发。


## 最新交接：README 精简 → 0.0.15 桌面 + iPadOS 发布（2026-11-07）

先读 [详细交接](docs/HANDOFF_0.0.15_README_RELEASE.md) 与 [README 修改计划原文副本](docs/README_PLAN_0.0.15.md)，再以 TODO.md 顶部为当前执行清单。

- README 已按 **simple and accurate** 精简并获用户认可（DOC-015-A1 已验收）；0.0.15 桌面+iPadOS 已完成 GitHub Release、门户同步与原生客户端安装验证，MOB-A9 已完成。Android 适配下一版，iPhone 未验证。当前步骤见 [发布准备](docs/RELEASE_PREP_0.0.15.md)。
- iPad 本轮功能体验与 PC-F1/PC-F2 支线已用户验收。发布源码提交 `8b82e4b` 已 push 到 main，tag `0.0.15` 指向该提交；本地仍在 codex/mobile-support。manifest/package/versions 为 0.0.15、isDesktopOnly:false。GitHub Release 已正式发布；门户同步状态见发布记录。
- 本轮候选 npm test 构建及 11 个合成脚本全过，独立 Windows Obsidian 1.15.0 原生回归 10 项通过、异常/警告 0；三资产/版本/哈希/二次构建核验通过。main.js 416,150 B / SHA-256 8801c3a3e5c2d96fcd6d230e8b703eac8472ac815e677e915c81c23249411391，与用户验收 PC-F2 包相同；本轮没有重跑 iPad 真机。
- 用户已明确授权并完成源码 commit/push、tag 和 GitHub Release；Actions run `42355198309` 成功，三资产下载哈希及来源 payload 一致，官方三文件独立库安装通过。门户短/长描述已保存，公开 Overview 为新版 README，当前版本 0.0.15、审核 Completed；原生安装器直连安装/启用/空库建图通过。详见 docs/RELEASE_PREP_0.0.15.md；保留未测平台边界。
- 以下旧交接章节保留追溯。「未开始移动开发」「先重新询问 MOB-P1」「Android 必须先测才能发 0.0.15」不再代表当前任务。

## 历史交接：0.0.14（2026-11-06）

### 本轮交付结果（2026-11-06，0.0.14 已 tag 并发布）

- 发布：tag `0.0.14`（annotated，指向 `740def8`）已推送；GitHub Actions `Release` 工作流 run [42164446268](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/actions/runs/42164446268) 全 10 步成功（Build/Validate/Package/Attest/Release/Verify）；GitHub Release [0.0.14](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/releases/tag/0.0.14) published 2026-11-06T04:46:21Z，资产**恰三项**：`main.js` 396,234 B `b022a4d810c38280e23068e718e68f9e0030bd4ba763b2dc0abae0b847903dc5`、`manifest.json` 308 B `aa3cc460b8e50a16b35ac72f9df5476de19c4a17df149382239b5eefb636b1e8`、`styles.css` 2,400 B `c14381d9c9844151ac037a6164bd25b606dfe21f7b51cc417c0dea19570a450b`；Release 正文含完整 notes、`## SHA-256 checksums` 与 notes/build run 链接（`SHA256SUMS` 不作为资产上传）；attestation 已生成（`GET /attestations/sha256:b022a4d8…` 返回 200，DSSE tlog index 3709424080，builder = `.github/workflows/release.yml@refs/tags/0.0.14`）。

- 版本：`package.json`、`manifest.json` 已升 **0.0.14**，`versions.json` = `{"0.0.13":"1.6.7","0.0.14":"1.6.7"}`；manifest description 已改为 `Vault-wide knowledge map with drag-and-drop layout that survives file renames and folder restructures. UI in English or Chinese.`
- 构建：`node scripts/build.mjs` → `{"bytes":396234,"sha256":"b022a4d810c38280e23068e718e68f9e0030bd4ba763b2dc0abae0b847903dc5","payloadIncluded":false}`；`node scripts/package.mjs --out .local/pkg-014` 三资产 + SHA256SUMS 一致（manifest 308 B、styles.css 2400 B）。
- UI-A11 i18n：新增 `src/i18n.js`（引擎）+ `src/i18n.core.js` / `src/i18n.ui.js` / `src/i18n.hud.js` / `src/i18n.obsidian.js`（四域字典，en/zh key 集合一致，共 209 key）；全部用户可见文案与 `upstream/template.html`（40 个 `data-i18n*` 绑定）走 `kgT()`；语言跟随 `moment.locale()`（非 zh 默认 en），设置页三选项「跟随应用 / 中文 / English」存 `settings.language`，缺字段视为 auto（0.0.13 兼容）；`scripts/i18n_check.mjs` 六项门禁；`npm test` 现在 11 个合成脚本。
- UI-A6：`src/host.css` 的 `:has()` 已删，改 `.kg-surface.kg-sidebar-open .kg-layout-tools`，由 `hud.setSidebarOpen()` 同时切换 `#sidebar.open` 与 `kg-sidebar-open`；偏移值与原规则相同。
- UI-A8：图例收起状态改存 `data.json` 顶层 `ui`（`{"kg.legendCollapsed":"0"}`，字符串值），首次加载从 `localStorage` 迁移一次后不再读写；写入失败只 `console.warn`；未扩大持久化范围（搜索、选中、层级、面板不持久化）。
- UI-A7：新增 `.github/workflows/release.yml` + `docs/RELEASE_CI.md`；tag `0.0.*` 触发，runner 构建、三段版本校验、只上传三资产、SHA256SUMS/notes 进正文、`attest-build-provenance@v2`、末步回读资产恰三项；本地演练 `.local/ci-dry-run/` 7/7 通过。
- UI-A13：README 已按用户 2026-11-06 产品思路重写为「产品说明 + 教程」三主题（展现知识布局 / 展现知识链接 / 自定义知识地图元素位置，每个主题「理念 + 交互演示」），hero 与教程素材由 `.local/demo-vault`（25 篇合成英文笔记，图谱 134 节点 203 边）录制，放 `docs/assets/`：`knowledge-map-overview.png`、`knowledge-map-links.png`、`knowledge-map-pan.gif`、`knowledge-map-zoom.gif`、`knowledge-map-preview.gif`、`knowledge-map-layout.gif`，另保留 `knowledge-map-layout-toolbar.png` 与中英设置页截图。
- UI-A10：在 `.local/native/vault-a10` 空库（独立 profile、CDP 9261、Obsidian 1.15.0）走「设置 → 第三方插件 → 浏览 → 搜索 Knowledge Map → 安装 → 启用」原生流程：安装 Notice 成功、版本 0.0.13、commands 注册、空态 `phase=empty`、5 篇合成笔记 `ready nodes=10 edges=12`、关标签重开恢复、**重启进程**后仍启用且数据保留；console 插件相关异常 0。**重要披露**：宿主 Obsidian 下载 github.com release 资产返回 404（同一 URL 在沙箱 python 直连 200），安装下载阶段用本地 HTTPS 代理只替换该域名的 DNS/TLS，served 字节为官方 0.0.13 Release 原始字节（manifest/styles 与官方 sha256 相同；main.js 落盘多 18 字节，已定因为 Obsidian 写入时追加 `
/* nosourcemap */`，剥离后一致）；无代理时 Obsidian 实际请求为 `download/0.0.13/*`，目录侧版本解析正常。证据：`.local/evidence/ui-a10/result.json` 与 `shots/`（均不入库）。
- 文档：`docs/RELEASE_NOTES_0.0.14.md` 已写；`docs/INSTALL.md` 升 0.0.14（发布状态如实写明「0.0.13 为当前正式发布，0.0.14 候选未发布」，含语言设置与 `ui` 持久化说明）。
- **门户（UI-A12）已完成**：用户 2026-11-06 在社区门户后台手动更新了条目图标并刷新 Overview。门户图标由「图标名 + 背景色」组合生成，**没有上传本地 PNG/SVG 的入口**（`docs/assets/knowledge-map-icon.png` 仅用于仓库/文档展示）；插件内 ribbon 与标签页图标仍是自绘 SVG。

### 交接时的真实现状

- **代码 HEAD 以 `git log --oneline -5` 为准**；0.0.14 的代码、文档、tag、Release、门户更新均已落地（见上节）。
- **0.0.14 已正式发布**（tag `0.0.14` 指向 `740def8`；Release 三资产 + attestations；门户图标与 Overview 已由用户手动更新）。以下 0.0.13 信息保留作历史基线：
- 0.0.13（历史）：annotated tag `0.0.13`：annotated tag `0.0.13`（peeled `71e42cd`，不带 v 前缀）、<https://github.com/xidianhush/knowledge-graph-obsidian-plugin/releases/tag/0.0.13>（资产 `main.js` 333,570 B sha256 `37589a6f32203026ff82a564ad83013b72dbb19c8a8180f7c04da67a49ba8ab5`、`manifest.json`、`styles.css`、`SHA256SUMS`、`RELEASE_NOTES.md`）；仓库根 `versions.json` = `{"0.0.13":"1.6.7"}`；0.0.11 仍为旧 pre-release。
- **社区目录条目已上线并同步**：<https://community.obsidian.md/plugins/knowledge-graph-smoke>；镜像 `community-plugins.json` 于 2026-11-05T13:20Z（commit `f23b14fe`）已含该 id（9,971 项），客户端「浏览」可搜到 Knowledge Map。Release 资产计数 main.js 11 / manifest.json 12 / styles.css 10，与门户 11 次下载吻合，判断已有真实安装（无遥测，只能按计数推断）。
- **自动评审 Completed，无阻断**，剩余建议：Release 缺 GitHub artifact attestations；Release 含多余资产（`RELEASE_NOTES.md`/`SHA256SUMS`，客户端不会下载）；BEHAVIOR 建议（读取全库路径 Vault Enumeration、localStorage 持久化）；CSS LINT `:has`（`src/host.css:15`）；README 无英文（已修）；无 lockfile（本仓库无 npm 运行时依赖，构建不使用依赖）；BUILD VERIFICATION 未跑。
- 0.0.13 之后有**已进入 0.0.14 的增量**：①图标 `src/plugin.js` 注册 `addIcon('knowledge-map', …)` 并用于 ribbon 与 `getIcon()`（G1 描边版，深/浅主题原生验证通过）；②本次文档/TODO。构建 `main.js` 334,284 B sha256 `9211f03133ac257bb596ebb48e4aecace6d3a43f29b5cf6dddd7e6849fff2245`，**未升版本、未打包发布**（`dist/` 不入库；要发布必须按 0.0.14 流程升版本）。
- **日常库** `D:/obsidian_vault/hush-ob-bucket`：2026-11-06 11:30 按用户当轮明确指示装入 **0.0.14 候选**（`main.js` 396,234 B `b022a4d8…`、`manifest.json` 308 B `aa3cc460…` version 0.0.14、`styles.css` 2,400 B `c14381d9…`）；替换前旧三文件 + `data.json` 备份在 `.local/daily-vault-backup-20261106/`（旧 `main.js` 332,824 B `e568296b…`，`data.json` 196,478 B `1303aadf…`）。安装前后 `data.json` 哈希未变；离线校验 `createLayoutStore` 读该库数据：schema 3、revision 422、15 组 / 5 structures、`unsupported:false`（0.0.13→0.0.14 无需迁移）。插件重载需用户操作（日常库实例未开 CDP，agent 无法代劳）。回滚：把备份目录的 main.js/manifest.json/styles.css 覆盖回插件目录即可。

### 0.0.14 范围（用户已确认）

原有（社区评审）：UI-A6 `:has` 改 JS 侧类切换；UI-A7 Release 精简三资产 + GitHub Actions attestations（先与用户确认是否接受 Actions 构建）；UI-A8 localStorage 审查/文档说明；UI-A10 in-app 安装验证（目录已同步，可在空白库「浏览」搜 Knowledge Map → 安装 → 建图 → 重开）；UI-A11 i18n 中英双语。

2026-11-06 用户新增：
- **UI-A13 README 理念/教程 + 动图**：把当前英文 README 升级为「理念 + 上手教程 + 动图」；具体脚本、分镜、动图内容**等用户指令**，不要擅自定稿；图片/GIF 放 `docs/assets/`，控制体积（GIF 建议 ≤2–3 MB，用合成库录制，避免隐私内容）。
- **UI-A14 插件 id / URL 去「smoke」——已决定 0.0.14 不做**（用户 2026-11-06）：先维持 `knowledge-graph-smoke`，后续再看情况。若将来要做，方案与影响记录在 DEC-006：改 id 会改变安装目录 `.obsidian/plugins/<id>/`、`data.json` 位置、更新匹配与社区条目身份；门户条目 id 提交后固定，需要重新提交并处理旧条目；可行设计是新 id + 首次加载从旧目录导入 `settings`/`layoutOverrides` + `docs/INSTALL.md` 迁移说明 + 门户重提。**0.0.14 不要动 id。**
- **门户图标上传并入 0.0.14 发布动作**（用户 2026-11-06）：`docs/assets/knowledge-map-icon.png`（512，紫底白字形）已就绪；发布 0.0.14 后登录 <https://community.obsidian.md> → Edit listing → Choose icon 上传（不再单独提前上传）。

### i18n 落点（UI-A11）

- 现状 223 条中文字符串：`src/adapters/hud.js` 96、`src/settings.js` 37、`src/plugin.js` 29、`src/adapters/obsidian-native.js` 14、`src/core/layout-state.js` 14，其余分散；`upstream/template.html` 图例/提示约 1,584 汉字。
- 建议：新增 `src/i18n.js`（en/zh 字典 + `t(key, vars)`），语言跟随 Obsidian（`moment.locale()`，非 zh 默认 en），设置页加「跟随应用 / 中文 / English」；模板文案改占位符运行时代入；`scripts/build.mjs` 打入 main.js；补合成检查（两字典 key 集合一致）与原生中/英截图回归。
- 用户可见文案（manifest description、README、Release notes）英文优先；中文只作为第二语言出现。

### 验证与操作纪律（务必遵守）

- 当前验证纪律：`npm test` 必须 **11** 个合成脚本全过（build + 10 checks + `i18n_check`，含 layout-incremental 15 条）；`node scripts/build.mjs` 记录 bytes/sha256；发布用 `node scripts/package.mjs --notes docs/RELEASE_NOTES_0.0.14.md` → `.local/release/0.0.14/`（或直接推 tag 让 `.github/workflows/release.yml` 在 runner 上构建并发布）。
- 原生环境：Obsidian **1.15.0** 在 `D:\Obsidian`；测试库 `.local/native/vault-012`（9 篇合成）、`vault-013`（日常库副本 162 md + data.json rev344/345）、`vault-gate-blank`（空白库，装打包三文件）；profile 同名目录；启动 `.local/native/ui_launch.py 9248` / `ui_launch13.py 9249` / `.local/native/gate_b_blank.py`（9251），均需 `danger-full-access`（`powershell Start-Process`；直接启动会崩）。
- CDP：`.local/native/cdp_lib.py`（`Cdp(port, page_url_prefix='app://')`；`js/wait_js/screenshot/errors/take_events`）；连接后先 `Page.setWebLifecycleState active` + `Emulation.setFocusEmulationEnabled`；**不要对渲染页 `page.reload()`**（FB-006 根因，禁用/启用插件或 Restart 代替）；`Emulation.setDeviceMetricsOverride` 必须 `mobile:false`；局部放大截图用 `Page.captureScreenshot` 的 `clip`。
- 发布：tag 与 manifest 同版本（`0.0.14`，不带 v）；0.0.14 起 Release 只放三资产，`SHA256SUMS`/`RELEASE_NOTES` 改放正文或 docs；`versions.json` 增 `"0.0.14":"1.6.7"`；发布前跑门禁（`.local/release_gate/gate_a.mjs` 思路）；**push / tag / Release / 门户刷新都需用户明确授权**（上一轮授权只到 0.0.13），不要 force push。
- 数据契约：schema3、`capture/reconcile/apply` 语义、`upstream/` 渲染与物理逻辑不改；只动 HUD/样式/文案。改布局行为必须补 `scripts/layout_incremental_check.mjs` 回归。
- 隐私：`.local`、vault/profile、`data.json`、验收截图不入公开仓库；不读 `Utilities/API Key.md`；不主动升级或修改日常库（仅可读副本）。
- 每轮按任务 ID 更新 TODO（实际测试、版本、日期、证据路径、剩余边界），不替用户宣称体验验收通过。

### 待用户决定（open）

1. ~~UI-A14 id 改名~~ → 已定：0.0.14 不做，后续再议（DEC-006）。
2. ~~UI-A13 分镜/素材~~ → 已定并执行：主 GIF 18–22s（建图→逐层缩放→拖动调整→撤销/恢复）+ 布局横带、中英设置页两张截图；英文界面、合成库、无烧录字幕（2026-11-06 用户答复 A）。
3. ~~是否现在替换门户图标~~ → 已定：随 0.0.14 发布一起上传（见上）。
4. ~~0.0.14 的发布授权（tag/Release/门户刷新）~~ → **已完成（2026-11-06）**：用户授权后推了 annotated tag `0.0.14`，workflow run 42164446268 全 10 步成功，Release 三资产 + attestations 已上线；门户图标与 Overview 由用户手动完成（门户图标是「图标名 + 背景色」，不支持上传本地 PNG）。
5. **移动端范围（当前唯一 open 项）**：见下一节 `MOB-P1`——Android 优先还是 Android+iOS、最低系统版本、是否接受功能降级、性能目标机型。

### 建议接手顺序（0.0.15 移动端阶段）

1. 读 `docs/MOBILE_PLAN.md`（实施蓝图）与本节「下一阶段交接：移动端支持」；`npm test` 核对基线（应 **11** 个合成脚本全过）；`git log --oneline -5` 确认 HEAD。
2. **先问用户 `MOB-P1`**：Android 优先还是 Android+iOS、最低系统版本、是否接受功能降级（如移动端只支持单元素拖动/只读浏览）、性能目标机型。拿到答复前只做只读勘察与桌面侧准备，不改 `isDesktopOnly` 发布。
3. 按 `MOB-A1 → A2/A5 → A3/A4 → A6/A7 → A8` 顺序实现；每步用 Android 真机（或可用模拟器）验证，桌面回归用现有 CDP 流程。
4. 全部通过且用户验收后，按 `MOB-A9` 走 0.0.15 发布门禁；tag/Release/门户仍需用户明确授权，不 force push、不自动升级日常库。

### 正式交接包（2026-11-06 更新：0.0.14 已发布；下一阶段 = 移动端支持 0.0.15）

```
项目：D:\what_i_am_doing\Project\knowledge-graph-obsidian-plugin
仓库：https://github.com/xidianhush/knowledge-graph-obsidian-plugin
交接 HEAD：以 git log 最新为准（0.0.14 发布与门户记录均已 push）
当前发布版：0.0.14（tag 0.0.14 → 740def8；Release 三资产 main.js 396,234 B b022a4d8… / manifest.json 308 B / styles.css 2,400 B；attestation tlog 3709424080）
  构建：node scripts/build.mjs → 396,234 B sha256 b022a4d810c38280e23068e718e68f9e0030bd4ba763b2dc0abae0b847903dc5
  测试：npm test = 11 个合成脚本（build + core/pipeline/settings/layout×6 + i18n_check）
  门户：条目 knowledge-graph-smoke，「图标名 + 背景色」图标与 Overview 已由用户更新
下一阶段：移动端支持（0.0.15 候选）。计划 docs/MOBILE_PLAN.md；TODO 任务 MOB-P1 + MOB-A1…A10
  当前状态：仅规划，未改任何源码；manifest.json 仍是 isDesktopOnly:true
  第一步：问用户 MOB-P1（平台范围/最低系统/降级口径/性能机型），再动 MOB-A1
先读：AGENTS.md、HANDOFF_NEXT.md「下一阶段交接：移动端支持」、docs/MOBILE_PLAN.md、TODO.md（MOB-*）、DEVELOPMENT.md
边界：不动 schema3/capture-reconcile-apply/upstream/渲染物理；不改插件 id；不升级或修改日常库；不推 tag/发 Release/刷新门户，除非用户明确授权
```

## 下一阶段交接：移动端支持（0.0.15 候选，2026-11-06）

用户 2026-11-06 明确要求：把插件升级为移动端也可用，并把这部分交给下一位 coding agent。用户给出的预计工作项（原文要点）：① `isDesktopOnly` 改 false，重做移动端布局（顶栏 7 个控件在手机上放不下，需要折叠菜单）；② 触摸交互替代拖动/悬停/中键（双指缩放、长按拖动、无悬停时图例与提示降级）；③ 移动端性能与内存预算重测（现按桌面 5000 节点 / 128 子节点）；④ 手机端 Obsidian 插件 API 差异与安全区适配；⑤ 重走移动端兼容矩阵和发布门禁；⑥ 其他可能要做的事（可随机应变）。

**完整实施蓝图见 `docs/MOBILE_PLAN.md`**（差距清单、交互与布局方案、性能预算、任务验收、验证矩阵、发布门禁、风险、建议顺序）。执行清单见 `TODO.md` 的 `MOB-P1` / `MOB-A1…A10`。

### 当前基线（动手前必读）

- 0.0.14 已发布（见上节），代码 HEAD 以 `git log` 为准；`npm test` 11 脚本全过；没有未提交改动。
- `manifest.json:8` 是 `"isDesktopOnly": true`，源码无任何 `Platform` 检测；`src/plugin.js:1` 的 `require('obsidian')` 解构里需要加 `Platform`。
- 交互现状（触摸会踩到）：悬停 tooltip 与 Ctrl+悬停预览（`src/adapters/hud.js:619`、`hud.js:713-860`）；滚轮缩放（`src/core/renderer.js:1713-1721`，`WHEEL_STEP 1.12`）；键盘快捷键（`src/adapters/hud.js:921-950`：Esc、Ctrl+Z/Y、方向键、Home、`[` `]`、`L`、`/`）；双击聚焦（`renderer.js:1801`）；鼠标键位/指针跟踪（`src/adapters/canvas-platform.js:16,22`、`src/adapters/hud-scope.js:55-62,104`）。
- 布局现状：顶栏 9 个控件单行（`upstream/template.html:303-327`），已有容器查询 ≤1000px 横向滚动、≤880px 收紧（`src/host.css:38-53`），但手机 390–430px 仍不够用；侧栏 `min(360px,40vw)`（`template.html:114-126`）、预览 `700px / max-width:calc(100vw - 32px)`（`:251-263`）、布局横带 38px（`src/host.css:4-12`）。
- 性能相关：DPR 直采（`src/adapters/canvas-platform.js:10`、`browser.js:56,65`）；Blob Worker（`src/adapters/vault-pipeline.js:14`）在 iOS 上可能不可用，必须降级；布局上限 128 兄弟 / 5000 子树（`src/core/layout-edit.js:28,39`）；可见边预算在 `src/core/renderer.js:1019` 附近。
- 已就绪、不要重做：i18n 引擎与 209 key、`data.json` 的 `ui` 持久化、`:has` 已移除、Release CI 三资产 + attestations、桌面原生 CDP 流程。

### 第一件事：问用户 MOB-P1

不要先写代码。先确认：Android 优先还是必须覆盖 iOS；最低 Android/iOS 版本与目标机型；是否接受移动端功能降级（例如第一版只读浏览 + 单元素拖动，不做整组/选父级）；是否要求平板与分屏。答复直接决定 MOB-A2/A3/A6 的范围与工时。

### 验证与发布纪律

- 移动端证据：Android 真机/模拟器（`adb` + `chrome://inspect` 若可用，否则 logcat + 录屏）；**本机没有 macOS，iOS 只能请用户手动验证并如实标注「用户验证/未验证」**，不得写成 agent 已验证。
- 桌面回归：`npm test` 11 脚本 + 现有 CDP 原生流程（`.local/native/cdp_lib.py`，端口 9248/9249/9251）。
- 发布 0.0.15 需用户明确授权；不要自己改 `isDesktopOnly:false` 后立刻发版——该字段等于向社区目录宣布移动端可用。
- 不动 schema3 / capture-reconcile-apply / upstream / 插件 id；不升级或修改日常库（需用户单独授权）。

## 先做什么

> 2026-11-06 起，**当前阶段是移动端支持（0.0.15）**，先看上一节「下一阶段交接：移动端支持」与 `docs/MOBILE_PLAN.md`；下面 1–5 条是长期通用的接手纪律，其中提到的 0.0.11/0.0.12/0.0.13 版本状态均为历史背景。

1. 读 `AGENTS.md`、`TODO.md`、`README.md` 和 `DEVELOPMENT.md`，检查当前分支、工作区和 manifest；不要覆盖用户改动。
2. 用 Node 22+ 执行 `npm test`，确认干净 clone 可构建且合成回归通过。GitHub 交接基线为 **0.0.10**；本地已在基线之上实现 **0.0.11（schema3）** 并 commit `13933dc`，已于 2026-11-01 push 到 origin/main 并发布 GitHub pre-release `v0.0.11`（社区目录未提交）；原生拖/存/重建/Esc/撤销基本回归、30 分钟连续压力与 schema3 冷启动已完成；用户体验验收已于 2026-11-01 完成（47-P2/47-P3，报告 `47-P3_PRODUCT_SITE_ACCEPTANCE_REPORT.md`），该版本为 pre-release，不是社区目录正式发布。 2026-11-02：47-A2 授权副本 30 分钟连续压力与结构/改名/泄漏验证完成（`REAL_VAULT_RESULT.md`），48-A1 文档/打包/空白库验证完成（`docs/INSTALL.md`、`scripts/package.mjs`、`.local/evidence/delivery-48a1/blank-vault.json`），48-A2 最终回归已完成。 2026-11-02 晚：48-P2 平台声明已落地到 **0.0.12 本地候选**（manifest 名称 Knowledge Map、minAppVersion 1.6.7、isDesktopOnly true；`main.js` 与 0.0.11 相同 `205b1bd0…`），候选回归在 Obsidian 1.6.7 / 1.14.5 / 空白库通过，见 `DELIVERY_48A2_RESULT.md`；46-A3 90 分钟长时观测已完成（通过）。 2026-11-03：0.0.12 已按授权装入日常库，完成 1–2 天自用体验并通过（48-A2 完成），当前候选与文档已 push（HEAD `0564d84`）；功能层面用户确认符合预期，**下一阶段为 0.0.13 UI/UX + 正式发布**，见本文件「下一阶段交接」一节。
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
- 原机器独立 `test-vault-layout-fix` 安装 0.0.10；real-vault-trial 磁盘版本为 0.0.6；**日常库于 2026-11-01 获用户明确授权升级至 0.0.11**（仅替换 main.js/manifest.json/styles.css；0.0.6 四文件备份在 `.local/backup-daily-0.0.6/`，验收清单 `.local/acceptance-daily-0.0.11.md`）。**2026-11-02 用户再次授权把 0.0.12 候选装入日常库做 1–2 天自用体验**（仅三文件，`main.js` 与 0.0.11 相同、`data.json` 未动；回执 `.local/daily-upgrade-0.0.12-receipt.json`、备份 `.local/backup-daily-0.0.11/`），2026-11-03 体验通过。不要把用户后续“副本没问题”当成 0.0.9/0.0.10 真实验收，也不要假定新机器有这些库。

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

遗留观察项：46-A3 的长期资源/隐藏恢复/多视图边界与真实窗口下的极端序列仍需按原计划补测；不因 FB-006 定因就把 46-A3 整体标为完成。2026-11-02 已补一轮 **90 分钟长时观测**（9249/vault-real，5,401 s、540 次采样、89 次重建、17 次隐藏→恢复；failures 空、渲染异常 0；heap 41.32→52.13 MB 锯齿无单调增长；fps p50 63.9；rev83/groups0/530 B 不变），证据 `.local/evidence/longrun-46a3/`，汇总见 `DELIVERY_48A2_RESULT.md` §3；结论“本窗口内无泄漏/无异常”，不等于无限期保证，后续按需复跑。

历史线索（保留）：稳定性主脚本 51 项断言中 50 通过、1 失败；自有资源清理与竞态通过，但出现无栈 `illegal access` 和宿主 app.js 的 `t.webContents.getZoomFactor is not a function`。过去一次“禁用插件后重载”对照因重载后插件仍启用而无效，本轮已用 `disablePluginAndSave` 补齐有效对照。

### 3. 47-A2 / 47-P2：连续编辑、预览与规模验收

**2026-11-02 更新：技术验证已完成（授权副本真实 30 分钟连续压力 + include 内合成笔记的结构/改名/泄漏验证，报告 `REAL_VAULT_RESULT.md`，机器证据 `.local/evidence/continuous-real/`）；体验验收仍待用户。**

首轮建议 30 分钟，固定 seed 与操作序列，在合成库循环正文保存、标题改名、添加/删除、预览打开/固定/关闭、重建/取消、隐藏/恢复；覆盖 1000/5000 标题及多保存组。更大规模根据用户 47-P1 的实际需求决定，不默认已支持 2 万节点。

记录请求到视图提交、Worker 启动到返回、模型/布局协调、saveData、帧间隔、错误与自有资源；每隔数分钟采样堆和保存队列。阶段可能嵌套，不能重复相加；提交完成不等于第一帧。回收后的持续趋势和保留对象才有助于判断泄漏，单次峰值不足。

通过门槛：无卡死、迟到结果覆盖、布局/配置丢失、无界队列或持续资源累积；磁盘与内存状态一致。报告 p50/p95/max、最长停顿和环境，等待是否可接受交给用户。合成通过后才在已授权副本添加合成探针，原文不改。历史约一分钟短测不能代替本项。

历史同实例原生 A/B（约千标题）两版整体延迟约 344.5/344.9 ms，近似持平；它排除了旧的非同时段比较，不能宣称新版整体提速。

### 4. 46-A2 / 46-A4 / 46-P2：兼容矩阵（技术已完成 2026-11-01，产品确认已完成 2026-11-02）

用户指定组合为 Dataview、Templater、Obsidian Git、Style Settings、Omnisearch、Excalidraw，并授权在独立测试库安装。已在独立库 Obsidian 1.14.5 + 0.0.11 完成两阶段验证：阶段一核心环境（浅色可读性、主窗口分屏、弹出窗口与跨窗移动/关闭、拖动保存与撤销、Ctrl 预览与 Esc、全部释放后重开）；阶段二 7 插件组合（拖动保存/撤销、增删与改名标题、文件/目录改名后的布局身份迁移、Markdown 预览内容、真实 Ctrl+Z、禁用启用、卸载重装）。结果与证据见 `COMPAT_MATRIX_RESULT.md`；异常 0，机器可读证据在 `.local/evidence/compat-matrix/`。

现状与边界：浅色主题下应用 chrome 变浅而图谱画布保持深色（`canvasLum` 46.2→46.1），是否跟随主题仍是 DEC-001 产品待决定项；卸载会按宿主语义删除插件目录与 `data.json`（已保存布局随之丢失），需写入安装/升级/卸载说明；第三方插件模态框（Excalidraw 欢迎页、Obsidian“更新链接”）会拦截画布输入并让 `renameFile` 长时间不 resolve，属宿主/其他插件行为，测试须先关闭或应答模态框，不是本插件缺陷。46-P2 主题/窗口体验已由用户确认（2026-11-02，DEC-001 决定维持图谱深色、不跟随宿主主题）；不把本轮结果扩大为“所有插件组合兼容”或移动端结论。Obsidian 最近实测为应用 1.14.5、安装程序 1.6.7、Electron 30.1.2；新环境先重新核实。

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
- 用户 2026-11-02 决定：描述文案采用上述英文；**0.0.12 已按授权装入日常库用于 1–2 天自用体验**（仅替换三文件；`main.js` 与 0.0.11 完全相同、`data.json` 未改动，回执 `.local/daily-upgrade-0.0.12-receipt.json`、备份 `.local/backup-daily-0.0.11/`）；`id` 保持 `knowledge-graph-smoke`，无需迁移。
- 用户 2026-11-03 完成日常库 1–2 天自用体验并给出验收：Node 4 重启后布局完整保留、Node 5 移动笔记后图谱自动更新、Node 6 改标题/正文后仅相应元素局部变化、Node 7 改章节加链接后位置大小不变、Node 8 调整子目录子元素位置仅内部变化，均“符合预期”；报告 `product-site-acceptance/product-site-acceptance-report/v0.0.12_PRODUCT_SITE_ACCEPTANCE_REPORT.md`（截图在 `product-site-acceptance/product-site-img-evidence/`，仅本地、已 gitignore）。**48-A2 完成**。
- 边界：候选与文档已 push（HEAD `0564d84`），但**未打 tag、未发布 Release、未提交社区目录**；描述已定稿；id 不改。剩余动作属 48-P3（0.0.13 正式发布与社区目录），待用户决定。下一阶段（0.0.13 UI/UX）见本文件「下一阶段交接」。

## 下一阶段交接：0.0.13 UI/UX + 正式发布（2026-11-03）

### 当前基线（下一位从这开始）

- HEAD `0564d84` 已由用户 push 到 `origin/main`（`git rev-parse origin/main` = `0564d84`）。
- 版本状态：仓库内 `manifest.json`/`package.json` 为 **0.0.12（内部候选，从未公开发布）**，已装日常库完成 1–2 天自用体验（报告 `product-site-acceptance/product-site-acceptance-report/v0.0.12_PRODUCT_SITE_ACCEPTANCE_REPORT.md`）；GitHub 上现有的是 **v0.0.11 pre-release**。`main.js` 自 0.0.11 起未变（`205b1bd0…`，325,976 B）。
- 功能状态：用户 2026-11-03 确认“功能层面完全符合预期”；本阶段**不做功能改动**（除非验收发现回归）。
- 版本决策：0.0.12 不单独发布（DEC-005）；UI/UX 完成后升 **0.0.13**，做首次正式（非 pre-release）Release。`id` 首发保持 `knowledge-graph-smoke`（DEC-004），社区提交时再评估改名。

### 用户明确的 UI/UX 需求（2026-11-03）

1. 「重新构建」按钮与构建完成提示现常驻底部一整横栏，挤占图谱有效显示面积 → 把「重新构建」移到**顶部工具条、与「重置视角」并列**；构建完成提示改为约 **2 秒自动消失**（构建中/取消/失败状态仍需可见）。
2. 「调整布局」按钮看看能否换位置；若能，图谱有效信息区就是一个完整矩形。若无更优位置可以保持不变——先做原型对比再定。
3. 节奏：不着急，持续打磨，保持功能不变。

### 实现位置（动手前先读）

- 顶部工具条：`upstream/template.html`（`#reset`＝重置视角在 :319；构建时由 `scripts/build.mjs` 把 template 内联进 `main.js`）。改这里要同步 build 并记录在案。
- HUD 增量 UI：`src/adapters/hud.js`（`:567` 创建 `.kg-layout-tools`；`:568` 内含 `#layout-mode`「调整布局」与选项；`:544-581` 订阅 layoutStore 状态）。已有 `toast()`/`.kg-toast` 可复用做 2 秒提示，注意与 `#layout-status`（操作结果，非构建提示）区分。
- 浮动面板样式：`src/host.css`（`.kg-layout-tools { position:absolute; right:12px; top:54px; … }`）——移动「调整布局」时同步改。
- 底部构建状态栏：`src/plugin.js` `progress()`（约 :51-75 创建 `.kg-build-status` 与「取消/重新构建」按钮；:140 构建完成文案）与 `styles.css:30` `.kg-build-status`（绝对定位 bottom:56px）。
- 构建/测试/打包：`node scripts/build.mjs`、`node scripts/test.mjs`（10 脚本）、`node scripts/package.mjs` → `.local/release/<version>/`。

### 约束

- 不改布局数据格式或语义（schema3、capture/reconcile/apply 契约）；不改 `upstream/` 的渲染与物理逻辑，只允许调整 HUD 结构与样式。
- 原生测试纪律：**不要对渲染页 `page.reload()`**（FB-006 根因）；每次 CDP 连接后 `Page.setWebLifecycleState active` + `Emulation.setFocusEmulationEnabled`；第三方弹窗先 `close_modals()`。
- 不 push、不发布：由用户手动 push；发布前需要用户明确授权。每轮按任务 ID 更新 TODO 并写证据路径。
- 隐私：`.local`、vault/profile、`data.json`、`product-site-acceptance/product-site-img-evidence` 截图不入公开仓库；不读 `Utilities/API Key.md`；不主动升级日常库——UI 先在独立测试库验证，再交用户在日常库体验。

### 发布准备（UI 通过后）

1. `manifest.json`/`package.json` 升 0.0.13；`node scripts/build.mjs` 记录 `main.js` sha256；`node scripts/package.mjs`。
2. 打 tag `v0.0.13`（与 manifest 版本一致）+ 首次正式 Release（非 pre-release），资产 `main.js`/`manifest.json`/`styles.css`/`SHA256SUMS`/`RELEASE_NOTES.md`；说明含功能概览、0.0.12→0.0.13（UI）变更、已知限制（勿整页 reload、128 节点/5000 预算、撤销 50 步仅会话、仅桌面、悬停摘要口径）、安装/升级/回退链接 `docs/INSTALL.md`。
3. 社区目录提交（等用户定）：官方要求仓库根 `manifest.json` + Release 资产三文件；建议**单仓库 + 根 manifest + Release 资产**，不把 `main.js`/`styles.css` 提交入库；若审核要求根文件再评估独立服务仓库/CI 同步。提交前核对 `id` 不变。
4. 检查 GitHub 上 `v0.0.11` pre-release 的标注（可注明已被 v0.0.13 取代）。

### 环境提示

- Obsidian 实测为 1.15.0（窗口标题），安装在 `D:\Obsidian`；沙箱内直接启动会崩（`FATAL:platform_channel.cc(83) Check failed ... 拒绝访问`），需 `danger-full-access` 用 Python detached `Popen` 或 `powershell -NoProfile -Command "Start-Process ..."` 启动；`--remote-debugging-port` 自定，`--enable-logging` 可拿宿主 stderr。
- **git push 的凭据问题（2026-11-06 实测）**：`origin` 是 HTTPS，但沙箱内 `git push` 拿不到凭据（`fatal: unable to get password from user`，GCM 无法交互）；本机 `~/.ssh/id_rsa` 已通过 GitHub 认证，所以推送用 `git push git@github.com:xidianhush/knowledge-graph-obsidian-plugin.git main`（不改 remote 配置也可）。推之前先 `GIT_TERMINAL_PROMPT=0 git ls-remote origin refs/heads/main` 核对远端 HEAD。
- 宿主网络无法访问 `github.com` 的 release 资产下载（Obsidian 内 in-app 安装会 404，而沙箱 python 直连同一 URL 200）；需要验证安装时用 `.local/native/a10_launch_proxy.py` 的本地 HTTPS 代理只替换该域名的 DNS/TLS，并在结论里如实披露。
- 可复用 CDP 脚本：`.local/native/cdp_lib.py`、`lead_matrix_phase1.py`、`lead_compat_167.py`、`lead_drag_114.py`。UI 改动至少覆盖：打开图谱、拖动保存、重建、Esc/撤销、分屏、浅色主题、空白库首用。
- git 若遇 `.git/index.lock` 幻影锁：把 `.git/*.lock` 移到 `.git/locks-quarantine/` 后立即执行命令。
- 用户验收方式：用户在日常库 `D:\obsidian_vault\hush-ob-bucket` 体验并在 `product-site-acceptance/` 写报告；agent 不替用户宣称通过。
- 仓库根会反复出现 0 字节纯数字文件（Obsidian/Chromium 运行期日志与占位残留）；`.gitignore` 已加 `/[0-9][0-9][0-9]*`，关闭 Obsidian 后可直接 `rm`。

## 权限与协作习惯

- 用户负责目标、优先级、体验结论；agent 负责实现、技术证据、清单维护。用户的“暂时正常”保留其范围。
- 2026-11-01 用户明确授权本次 commit 和 push 到指定 GitHub 仓库。旧文档中的“不 push”是历史约束，本次已被取代；后续推送看新授权。不 force push。
- 不读取 `Utilities/API Key.md`，不写日常笔记，不擅自扩大真实副本范围或升级日常库。原授权副本只涉及两个指定目录及引用图片，细节见 TODO。2026-11-01 用户单独授权将日常库升级至 0.0.11（仅本次三文件替换，不扩展为其它库操作）。
- 不把 `.local`、vault/profile、data.json、截图或私有快照加入 Git。原始证据不可跨机器获得时，如实保留摘要与未复跑状态。
- 网络中断后先读 TODO 和 git status，续接未完工作，不从历史交接重做已验收功能。

## 历史开场语（2026-11-06；已由顶部 2026-11-07 交接取代）

请先读 `AGENTS.md`、`HANDOFF_NEXT.md`「下一阶段交接：移动端支持」、`docs/MOBILE_PLAN.md`、`TODO.md`（`MOB-*`）和 `DEVELOPMENT.md`，然后运行 `npm test` 核对基线（**11** 个合成脚本应全过）并用 `git log --oneline -5` 确认 HEAD。背景：0.0.14 已 tag 并发布（Release 三资产 + attestations，门户图标/Overview 已由用户手动更新），桌面端暂无未完成项；用户要求下一阶段把插件升级为**移动端可用**并交给你做。当前只做了规划：`manifest.json` 仍 `isDesktopOnly: true`，源码未改，`TODO.md` 新增 `MOB-P1` 与 `MOB-A1…A10`。**第一件事不是写代码，而是先问用户 MOB-P1**：Android 优先还是必须覆盖 iOS、最低系统版本、是否接受功能降级（如移动端只读/单元素拖动）、性能目标机型。拿到答复后按 `docs/MOBILE_PLAN.md` §11 的顺序做：MOB-A1 平台检测与 `isDesktopOnly`（先在本地验证，不急着发布）→ A2 响应式布局 → A5 浮层 → A3 触摸 → A4 文案与快捷键等价 → A6/A7 性能与 worker 降级 → A8 矩阵 → A9 发布门禁（tag/Release/门户仍需用户明确授权）。未做真机测试不得写“已验证”，iOS 结果必须如实标注来源；不 force push、不自动升级日常库、不代替用户确认体验验收；每轮按任务 ID 更新 TODO 并写证据路径。
