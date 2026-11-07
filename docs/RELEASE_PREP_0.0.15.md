# 0.0.15 发布准备

更新：2026-11-07（Asia/Shanghai）。本文件是候选核验与待发布操作说明；执行状态以 TODO.md 的 MOB-A9 为准。用户于本轮明确授权 commit/push、tag、Release 及门户操作；正在执行，最终结果待下文记录。

## 范围与候选

- 用户已认可精简 README（「这一版 README.md 我感觉好多了」）。DOC-015-A1 已验收。
- 本版为桌面 + iPadOS；Android 适配下一版，iPhone 未验证。最低 iPadOS、客观移动帧率/内存峰值及 iPad 取消/Worker 故障注入等未测项如实保留。
- 分支 `codex/mobile-support`，准备起点 HEAD `b75aa40`；移动实现和文档仍在未提交工作区，不能只对 HEAD 打标签。
- `manifest.json` / `package.json` 候选 0.0.15，`versions.json` 新增 `0.0.15: 1.6.7`。ID、schema3、最低 Obsidian 1.6.7 保持，`isDesktopOnly:false` 不等于所有移动平台已适配。
- 本地输出 `.local/release/0.0.15/`；上传资产只能是 `main.js`、`manifest.json`、`styles.css`，本地 SHA256SUMS 和文档不上传为额外资产。
- 本地候选技术检查已完成，发布授权已获得；正在执行发布和线上验证。

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

## 社区门户文案（可直接审阅，尚未提交）

保留名称 Knowledge Map、ID `knowledge-graph-smoke`、现有图标和仓库地址。更新现有条目，不重复提交新插件。

Overview 英文正文：

> Explore the hierarchy and connections in your Obsidian knowledge as a map you can arrange. Folders, notes and headings form nested circles; wiki-links connect them. Pan and zoom, preview notes, and move elements to arrange the map. The interface supports English and Simplified Chinese.
>
> Version 0.0.15 adds iPadOS support alongside desktop: one-finger pan, pinch zoom, long-press preview and single-element layout editing with undo and redo. Tested by the user on iPad Pro 2022 with iPadOS 26.5.2 and Obsidian 1.15.0. iPhone is unverified; Android adaptation is planned for the next version. Minimum iPadOS and objective mobile performance limits remain unverified.
>
> Map building happens locally. The plugin does not modify or upload notes; layouts and settings are saved separately. Layout editing supports up to 128 siblings per group and 5,000 affected nodes. See the repository README for demos and installation details.

版本栏如由仓库自动同步，应核对为 0.0.15；若需门户刷新，按实际界面操作。平台说明采用「Desktop + iPadOS; iPhone unverified; Android adaptation planned」。门户若只提供 Desktop/Mobile 分类，Mobile 仅代表可安装，Overview 必须保留以上范围；不将分类当成 Android/iPhone 已验证。图标保持现有「图标名 + 背景色」，不上传仓库 PNG/SVG。

## 授权后执行

1. 审查全部待提交源码/文档与远端最新状态；排除 `.local`、vault/profile、data.json、截图、私有快照以及含真实笔记名的用户验收报告。该报告可本地保留；公开结论已汇总于 TODO/MOBILE_PLAN。
2. 移除 README、INSTALL、发布说明中的候选/未发布提示时，与实际发布动作一并核对；保留平台未测边界。将此次验证过的源码/文档提交到正式发布来源分支（现为 main），核对远端提交与候选哈希；不 force push。
3. 对最终提交创建并推送标签 `0.0.15`（不带 v）。这会触发 `.github/workflows/release.yml` 正式发布；本地不手动上传资产。
4. 等待 Actions 完成，回读三资产文件名、版本、字节数、SHA-256 及 attestations；与本地候选比对。不得用本地产物覆盖 CI 产物。
5. 按授权更新/核对现有社区门户 Overview、版本和平台范围；从独立测试库检查桌面客户端发现更新/安装。移动客户端检查若需要由用户完成，记录来源，不冒称已执行。
6. Release、门户展示与客户端更新确认后再将 MOB-A9 标完成。若外部同步延迟，保留具体待确认状态。

官方规则参考（2026-11-07 查阅）：[发布插件](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)、[Manifest](https://docs.obsidian.md/Reference/Manifest)、[Versions](https://docs.obsidian.md/Reference/Versions)。GitHub Release 标签必须与 manifest 版本匹配，客户端从 Release 下载三运行文件；`isDesktopOnly` 是桌面限制布尔值，不能表达只验证 iPad；versions 映射维持本仓库逐版记录惯例。
