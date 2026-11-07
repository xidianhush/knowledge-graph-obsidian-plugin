# 0.0.15 交接：先精简 README，再发布 iPadOS 支持

更新：2026-11-07。以用户本轮决定和 TODO.md 为准；HANDOFF_NEXT.md 后面的 0.0.14/移动开发起步章节是历史，不能从那些章节重新开始。

## 用户最新决定

1. README 已按 **simple and accurate** 精简约 60%，用户于 2026-11-07 明确认可；DOC-015-A1 已验收，进入 MOB-A9 发布准备。原始设计稿继续保留。
2. 然后准备并发布包含 **iPadOS 支持的 0.0.15**，保留桌面。**Android 适配移到下一版**，不再作为 0.0.15 发布门槛。iPhone 未做真机验证，应如实标注，不能把 iPad 结果推广到全部 iOS。
3. 用户随后已明确授权 commit/push、tag、Release 及门户操作。源码 `8b82e4b` 已 push，tag `0.0.15` 的 GitHub Release 已成功发布（run `42355198309`）；门户 0.0.15、审核 Completed、公开简介/README Overview 和原生安装器直连安装启用均已核对，MOB-A9 完成；详见 RELEASE_PREP_0.0.15.md。
4. 不要为了满足旧计划继续给本轮用户追加 Android 测试。原 MOB-P1 双平台首版范围与 MOBILE_PLAN §9 的 Android 硬门槛已被此决定取代。

## 首先读取

- AGENTS.md、TODO.md 顶部当前任务、本文件。
- docs/README_PLAN_0.0.15.md：桌面 TXT 的原文副本及用户最新「简短、准确」要求。
- README.md、docs/MOBILE_PLAN.md、DEVELOPMENT.md、docs/RELEASE_NOTES_0.0.15.md。
- 用户报告 product-site-acceptance/product-site-acceptance-report/v0.0.15_PRODUCT_SITE_ACCEPTANCE_REPORT.md。
- 发布流程 docs/RELEASE_CI.md、.github/workflows/release.yml、scripts/package.mjs。

## 当前代码与验收状态

- 有效仓库：D:/what_i_am_doing/Project/knowledge-graph-obsidian-plugin。D:/Documents/ChatGPT/knoeledg-graph-obsidian-plugin 是旧工作目录，不要在那里另做一份实现。
- 当前分支 codex/mobile-support；移动支持、PC 修正与文档已作为发布提交 `8b82e4b` push 到 main。tag `0.0.15` 指向该提交；后续文档记录提交以 git log 为准，不能移动正式标签。
- GitHub Release 0.0.15 已发布；工作区 manifest/package 为 0.0.15，versions.json 已新增 0.0.15:1.6.7，manifest.isDesktopOnly:false。本地候选、10 项原生回归、11 个合成脚本及三资产核验均已完成，证据与哈希见 [RELEASE_PREP_0.0.15.md](RELEASE_PREP_0.0.15.md)。
- 已验收运行文件：main.js 416,150 B，SHA-256 8801c3a3e5c2d96fcd6d230e8b703eac8472ac815e677e915c81c23249411391。
- 已验收包 .local/pc-f2/package：manifest SHA-256 82098c5d40974f00a78a672c3088b5a0439dca1d6ca03a806c42c8a99ecc60c3；styles SHA-256 50e33695e56f27070669d219d9ecf9d64f76e2359f1de1fa38fa42e30a4adb56。升版后重新生成版本与校验值。
- 本轮交接重跑 npm test：构建 + 11 个合成脚本全过，i18n 224 key / 41 绑定，main 哈希与已验收候选一致。日志 .local/handoff-015-readme-release/npm-test.log。接手及最终发布候选都要重新核对基线。
- iPad 来源是用户手动测试：iPad Pro 2022 / iPadOS 26.5.2 / Obsidian 1.15.0 (396)。加载、旋转/分屏、触屏导航、预览、单元素拖动保存/撤销重做、中英界面、软键盘/妙控键盘中文输入、浅色宿主和系统面板打断恢复已由用户报告正常。
- 85 笔记 / 3050 节点首次完成提示 0.26s、重复 0.18s；这是用户报告，不等于严格首次可交互或客观 FPS/内存峰值。
- PC-F1 缩放可见性与 PC-F2 底部连线/箭头均已用户验收，PC 支线结束。PC-F2 报告两项没有按平台单列，保留原始来源。
- iPad 取消明确未测；Worker 故障注入、分块取消和 5000 节点测试是 Windows/Node 辅助证据。iPhone、最低移动系统版本、iOS 客观 FPS/系统内存、5000 节点真机冷启动/128 兄弟保存延迟没有完整证据；如实列为未测，不能重写成通过。

## 第一步：README 改写

- 本步骤已完成并获用户认可（2026-11-07）。以下保留已采用的改写原则；不重新改写或重复请求验收。
- 主线保留三个主题：知识的层级/布局；链接形成的链条；自定义节点位置。每部分短解释配现成图片/GIF，避免长理念叙述和中英重复堆叠。
- 开头用一句准确引导；安装与上手紧凑。开发细节、存储规则、完整限制移到现有 docs/ 链接，保留读者作决定必需的兼容说明。
- 复用 docs/assets/knowledge-map-overview.png、knowledge-map-pan.gif、knowledge-map-zoom.gif、knowledge-map-preview.gif、knowledge-map-links.png、knowledge-map-layout.gif。素材来自合成库；确需新素材也用合成内容。
- 交互区分平台：桌面 Ctrl+悬停预览；iPad 用长按或 Preview。触屏布局是单元素拖动，不宣传整组/选父级。
- 核对措辞：虚线不能简单写成「双向链接」；连线有可见预算；改名保留布局存在保守回退边界。不能为简洁写成无条件保证。
- 对照实际界面核对命令名、按钮、图片链接与平台范围，给用户可审阅的结果。随后继续发布准备；不要新增没有依据的确认门禁。

## 第二步：本地完成发布候选（已完成，2026-11-07）

1. 按新范围更新 docs/INSTALL.md 和发布说明草稿；README/Release/门户表述一致：桌面 + iPadOS，Android 下一版，iPhone 未验证。
2. 核对平台展示。当前 manifest 只有 isDesktopOnly:false；该布尔值不能单独表达 iPad 与 Android 的区别。不要把可安装或平台标记等同 Android 已适配，也不要未经用户决定临时加入平台禁用交互。
3. 更新 manifest.json、package.json 到 0.0.15，versions.json 增加 0.0.15 条目；minAppVersion 当前 1.6.7，不能写成所有移动环境已验证。
4. 检查 scripts/package.mjs 中「isDesktopOnly 非 true 就提示 mobile is not validated」的旧假设，按真实验证范围调整提示；不要删掉白名单/隐私保护校验。
5. npm test → node scripts/package.mjs --out .local/release/0.0.15。校验三个运行文件、版本一致性、字节数/哈希；不要复写 .local/pc-f2 已验收包作为新版本。
6. 按变更范围做独立测试库回归，核对桌面建图、预览、拖动保存、撤销重做、重建和 iPad 已测行为；README 文案改动以内容/链接检查为主，必要时请用户核对新平台说明。
7. 准备好候选、发布说明、校验值与具体门户修改内容后，再按用户届时授权执行发布。

## 第三步：正式发布与回读（已获授权，GitHub 已发布）

- 本轮已获新的 commit/push/tag/Release/门户授权并完成 GitHub 发布；该授权不扩展到 force push 或日常库升级。审查新增文档差异后可提交发布记录，不移动已有正式标签。
- .github/workflows/release.yml 监听 0.0.* 标签；使用 0.0.15，不能加 v 前缀。该标签推送会触发正式 Release。
- Release 只含 main.js、manifest.json、styles.css；SHA256SUMS 和 notes 在正文，三资产附 attestations。回读 Actions 结果、资产数量、版本与哈希。
- 再依授权更新/核对门户的版本、平台说明和 Overview。门户不能上传仓库图标图片；当前图标不在本轮重做范围。
- 门户展示和客户端更新结果实际确认后，才把 MOB-A9 标完成；README 不能提前写成已发布。

## 本地工具、安装与边界

- Windows 热更新服务测试库：.local/mobile-a2/Knowledge Map MOB-A2 test vault/Knowledge Map MOB-A2（注意内层）。Mobile Hot Reload server 端口 18765；清单 /watched-plugins。iPad 是 client，sync data files 关闭；局域网 IP 会变，先核对当前地址。
- main.js 只做原子替换并回读服务哈希；配置/布局不随热更新分发。本地原生脚本 .local/pc-f2/native_check.py；辅助 CDP 库 .local/native/cdp_lib.py。Windows 模拟不能冒称 iPad 真机验证。
- 日常库 D:/obsidian_vault/hush-ob-bucket 已获用户本轮授权安装 PC-F2 并验收。备份 .local/daily-vault-backup-pcf2-20261107-150117-bedeba，data.json 安装前后哈希一致。此授权不自动扩展到下一位的新候选。
- 不读 Utilities/API Key.md，不写日常笔记。插件 ID、schema3 与 capture/reconcile/apply 语义保持；不顺带改 ID 或扩展 Android 功能。
- .local、data.json、vault/profile、截图和私有快照不能公开提交或打包。用户验收报告含真实笔记名，公开提交前审查/脱敏；可公开结论已汇总在 TODO/MOBILE_PLAN。README 计划副本是用户提供的产品文案设计稿。
- 没有新增依赖，不需要 npm install。Node 22+，测试 11 脚本；私有原生证据不在干净 clone 中，不能标成已重跑。

## 给下一位的开场语

请从 TODO.md 顶部和 docs/RELEASE_PREP_0.0.15.md 续接。README 已获用户认可，0.0.15 本地候选已通过 11 个合成脚本、10 项 Windows 独立库原生检查和三资产核验；main.js/CSS 与已验收 PC-F2 包相同。源码已提交为 8b82e4b 并 push 到 main，tag 0.0.15 与 Actions Release 均完成；本地仍在 codex/mobile-support。门户同步、公开页面与原生安装器分发验证已完成，MOB-A9 已完成；从 TODO 顶部和 RELEASE_PREP_0.0.15.md 续接，不移动已发布标签。Android 下一版、iPhone 与未测指标如实标注，不重做已验收任务或操作日常库。
