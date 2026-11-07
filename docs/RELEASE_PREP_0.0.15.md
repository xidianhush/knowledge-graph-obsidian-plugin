# 0.0.15 发布记录

更新：2026-11-07（Asia/Shanghai）。本文件记录候选核验与正式发布结果；执行状态以 TODO.md 的 MOB-A9 为准。用户明确授权的 commit/push、tag、Release、门户更新与分发核验已完成。

## 已执行发布（2026-11-07）

- 源码/文档发布提交 `8b82e4bc18912f0e75c03d8bd704c589da42f7b9` 已快进推送到远端 `main`；annotated tag `0.0.15` 对象 `4662962fbd5816e3966c3ac96e275c2546fe84d3` 指向该提交。未 force push。
- [GitHub Release 0.0.15](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/releases/tag/0.0.15) 已由 [Actions run 42355198309](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/actions/runs/42355198309) 发布，工作流成功，构建、三资产和 attestation 生成步骤均通过。
- 已下载三项官方资产，字节数/SHA-256 全部与下方候选相同，Release 正文含对应校验值，下载的 manifest 为 0.0.15。证据 `.local/release-015/remote-verify.json`。
- GitHub 对三项摘要各返回构建来源证明；payload 的仓库、workflow、tag、源提交及三资产 digest 一致。证据 `.local/release-015/attestation-summary.json`；此为来源记录/payload 一致性核对，不冒称执行了独立密码学验签。
- 从官方 Release 下载的三文件在另一套独立 Windows Obsidian 1.15.0 合成库手动安装，10 项回归再次通过、异常/警告 0。证据 `.local/release-015/published-client/native-gate.json`。这是公开文件的实际安装验证，不等于社区客户端自动发现更新已验证，也不是 iPad 重测。
- 门户 Check for new releases 已完成：Current release 0.0.15 / Nov 7, 2026；源提交 8b82e4b 的审核为 Completed，JS/CSS 的 GitHub attestation 为 Pass。短/长描述保存成功；公开条目显示新简介、精简 README Overview、iPadOS 0.0.15 及未测平台范围，Desktop only 标记已消失。证据 `.local/release-015/portal-management.json`、`portal-public.json`、`portal-verify.json`。
- 另一套全新 Windows Obsidian 1.15.0 合成库经 `app.plugins.installPlugin` 原生安装器直连下载 0.0.15、启用及空库建图通过。未使用 DNS/TLS 代理或覆盖下载内容；证据 `.local/release-015/community-client/result.json`。这验证客户端原生安装分发路径；不冒称既有日常库自动升级或 iPad App Store 客户端本轮更新已实测。
- MOB-A9 已完成。门户自动审核仍有非阻断建议/警告，见下文；不把 Completed 扩大为所有环境兼容保证。

## 范围与候选

- 用户已认可精简 README（「这一版 README.md 我感觉好多了」）。DOC-015-A1 已验收。
- 本版为桌面 + iPadOS；Android 适配下一版，iPhone 未验证。最低 iPadOS、客观移动帧率/内存峰值及 iPad 取消/Worker 故障注入等未测项如实保留。
- 分支 `codex/mobile-support`，准备起点 HEAD `b75aa40`；移动实现和文档随后已提交到 `8b82e4b`，正式 tag 指向该发布提交。
- `manifest.json` / `package.json` 候选 0.0.15，`versions.json` 新增 `0.0.15: 1.6.7`。ID、schema3、最低 Obsidian 1.6.7 保持，`isDesktopOnly:false` 不等于所有移动平台已适配。
- 本地输出 `.local/release/0.0.15/`；上传资产只能是 `main.js`、`manifest.json`、`styles.css`，本地 SHA256SUMS 和文档不上传为额外资产。
- 候选技术检查、正式发布与分发验证均已完成。正式 tag 保持指向源提交；后续只提交收尾文档，不重打标签。

## 本轮核验（2026-11-07）

- `npm test`：构建 + 11 个合成脚本全部通过，i18n 224 key / 41 绑定；日志 `.local/readme-015/release-npm-test.log`。
- `node scripts/package.mjs --out .local/release/0.0.15`：三运行文件 + 本地 SHA256SUMS，无私有 payload/data.json；manifest/package/versions/dist 一致，二次构建字节一致，落盘安装哈希与包相同。证据 `.local/release-015/package-gate.json`。
- 独立合成库 Windows Obsidian 1.15.0：10 项通过（安装空状态、17 节点/20 边建图、标题原生预览关闭、鼠标拖动保存、撤销、重做、重建保留、关图重开、禁用启用冷加载、无捕获异常/警告）。证据 `.local/release-015/native-gate.json`，脚本 `.local/release-015/native_gate.py`。未整页 reload，未操作日常库；本轮没有重跑 iPad 真机或历史桌面最低版本矩阵。
- `main.js` 与 `styles.css` 和已由用户验收的 `.local/pc-f2/package` 逐字节相同；运行三文件仅 manifest 版本变化。包结果不等同最终 Actions/社区客户端已验证。
- 当前差异 `git diff --check` 通过；11 份相关文档中的 43 个本地链接/素材路径有效，证据 `.local/release-015/doc-links.json`。0.0.15 含真实笔记名的原始验收报告新增精确 gitignore 规则；截图、vault/profile、私有证据仍不公开。

候选文件：

- `main.js`：416,150 B，SHA-256 `8801c3a3e5c2d96fcd6d230e8b703eac8472ac815e677e915c81c23249411391`
- `manifest.json`：309 B，SHA-256 `67f707c580bb80580bffd0c005e719292d887c346883f3c708b440bbd4ae0b43`
- `styles.css`：2,918 B，SHA-256 `50e33695e56f27070669d219d9ecf9d64f76e2359f1de1fa38fa42e30a4adb56`

## 社区门户（已保存并公开回读）

现有条目 Knowledge Map、ID `knowledge-graph-smoke`、图标/背景色、分类和免费设置保持。表单短描述上限 200 字符、长描述上限 1000 字符；已按实际表单压缩文案。公开 Overview 当前自动渲染仓库新版 README（含六张演示），不是直接用长描述替代 README。

短描述：

> Explore folders, notes and headings as a nested map with links, previews and editable layouts. Desktop and iPadOS.

长描述：

> Explore knowledge through nested circles for folders, notes and headings, with wiki-links between them. Pan, zoom, preview notes and arrange elements. English and Simplified Chinese.
>
> 0.0.15 adds iPadOS support: one-finger pan, pinch zoom, long-press preview and single-element layout editing with undo/redo. User-tested on iPad Pro 2022 / iPadOS 26.5.2 / Obsidian 1.15.0. iPhone is unverified; Android adaptation is planned for the next version. Minimum iPadOS and objective mobile performance limits are unverified.
>
> Map building is local; notes are neither modified nor uploaded. Saved layouts are reused where edits can be reconciled. Editing supports 128 siblings per group and 5,000 affected nodes. See the repository README for demos and installation.

实际门户当前版本为 0.0.15，公开页面已无 Desktop only 标记；README 与描述保留 iPhone 未验证、Android 下一版及 iPad 性能/最低系统未测边界。不把可安装的平台标记当作全平台验证。没有上传私有截图。

## 社区审核建议（非本轮新承诺）

0.0.15 审核 Completed，无阻断；仍有 Vault Enumeration / Local Storage 行为建议、无 lockfile 的 Build Verification 建议，以及 `src/host.css:56` 的 display:contents 对 Obsidian 1.6.5 部分支持警告。本插件声明最低 1.6.7，构建没有 npm 依赖；这些扫描结论与实际验证范围分别保留，未在正式 tag 后改动运行代码。后续是否处理由用户决定，不伪称全部扫描无警告。

## 已执行流程（保留作发布复盘）

1. 审查全部待提交源码/文档与远端最新状态；排除 `.local`、vault/profile、data.json、截图、私有快照以及含真实笔记名的用户验收报告。该报告可本地保留；公开结论已汇总于 TODO/MOBILE_PLAN。
2. 移除 README、INSTALL、发布说明中的候选/未发布提示时，与实际发布动作一并核对；保留平台未测边界。将此次验证过的源码/文档提交到正式发布来源分支（现为 main），核对远端提交与候选哈希；不 force push。
3. 对最终提交创建并推送标签 `0.0.15`（不带 v）。这会触发 `.github/workflows/release.yml` 正式发布；本地不手动上传资产。
4. 等待 Actions 完成，回读三资产文件名、版本、字节数、SHA-256 及 attestations；与本地候选比对。不得用本地产物覆盖 CI 产物。
5. 按授权更新/核对现有社区门户 Overview、版本和平台范围；从独立测试库检查桌面客户端发现更新/安装。移动客户端检查若需要由用户完成，记录来源，不冒称已执行。
6. Release、门户展示与客户端更新确认后再将 MOB-A9 标完成。若外部同步延迟，保留具体待确认状态。

官方规则参考（2026-11-07 查阅）：[发布插件](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)、[Manifest](https://docs.obsidian.md/Reference/Manifest)、[Versions](https://docs.obsidian.md/Reference/Versions)。GitHub Release 标签必须与 manifest 版本匹配，客户端从 Release 下载三运行文件；`isDesktopOnly` 是桌面限制布尔值，不能表达只验证 iPad；versions 映射维持本仓库逐版记录惯例。
