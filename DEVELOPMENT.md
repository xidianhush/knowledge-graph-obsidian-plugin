# Clone 后开发与验证

使用 Node.js 22 或更新版本。纯 JS 构建只用 Node 标准库，没有 npm 依赖安装步骤。

```sh
git clone https://github.com/xidianhush/knowledge-graph-obsidian-plugin.git
cd knowledge-graph-obsidian-plugin
npm test
```

`npm test` 先构建，再串行执行 10 个合成检查脚本：核心生命周期、管线契约、设置、原型几何、正式拖动、保存状态、基础改名、扩展改名、增删修复、schema3 迁移。无需 Obsidian、Python、网络或个人笔记。报告写入被忽略的 `.local/evidence/`。Node 性能样本随机器而变，不是速度门槛。

只构建：`npm run build`。输出 `dist/main.js`、`dist/manifest.json`、`dist/styles.css` 及供测试使用的模块；运行插件只需前三个文件。若本地存在 `.local/smoke-payload.json`，历史构建脚本会额外复制私有快照到 dist，**不能直接打包整个 dist**。

生成交付包（白名单三个运行文件 + SHA256SUMS，拒绝快照与 data.json）：

```sh
node scripts/build.mjs
node scripts/package.mjs            # 输出 .local/release/<version>/
```

使用者可见的安装/升级/卸载与已知限制见 `docs/INSTALL.md`。

当前交付版本：**0.0.13（已正式发布，tag `0.0.13`，Release 见 https://github.com/xidianhush/knowledge-graph-obsidian-plugin/releases/tag/0.0.13）**。构建 `main.js` 333,570 B sha256 `37589a6f32203026ff82a564ad83013b72dbb19c8a8180f7c04da67a49ba8ab5`；打包产物 `.local/release/0.0.13/`（三文件 + SHA256SUMS + RELEASE_NOTES），发布说明草稿 `docs/RELEASE_NOTES_0.0.13.md`。2026-11-04 修复候选验收反馈：`repairGroup` 对「同名且正文为空」标题的保守校验会把整篇笔记的 H1 组判为不可修复（笔记内 H1 全部退回自动布局），现仅在同名计数变化或 evidence 不一致时回退，纯增删保留已保存布局（新增 2 条合成回归）；编辑提示改为「再次点击顶栏 ✥ 退出」。在「日常库副本 vault-013」（Obsidian 1.15.0 / CDP 9249）原生复算 H1 相对偏差 0.0px、`errors []`。历史：0.0.12 为内部候选 2026-11-04 晚发布门禁：A 打包/版本一致、B 空白库安装建图、C 日常库副本真实数据 reconcile 4 场景全部通过；门禁 C 发现并修复同族边界（含同名空正文标题的笔记重命名会整篇回退），新增 1 条合成回归，原生复算重命名后 H1 偏差 0.0px。（已装日常库完成 1–2 天自用体验并通过，报告见 `product-site-acceptance/`）；0.0.11 已 push 并发布 GitHub pre-release；社区目录条目已于 2026-11-04 上线（<https://community.obsidian.md/plugins/knowledge-graph-smoke>），2026-11-05 目录镜像同步后客户端可搜到。0.0.12 的 manifest 名称为 Knowledge Map、`minAppVersion` 1.6.7、`isDesktopOnly: true`（0.0.13 沿用）；布局存储为 schema3，旧 schema1/2 数据会在首次协调写入时自动迁移；0.0.13 只改 HUD/样式，不改数据格式与交互契约。0.0.10 及更早版本读到 schema3 会禁用调整并保留原数据，回退须先备份 `data.json` 的 `layoutOverrides`。

当前候选：**0.0.14（已构建并完成合成/原生验证，未 tag、未 Release，待用户验收与授权）**。构建 `main.js` 396,234 B sha256 `b022a4d810c38280e23068e718e68f9e0030bd4ba763b2dc0abae0b847903dc5`；`npm test` 为 **11 个合成脚本**（新增 `scripts/i18n_check.mjs`）。0.0.14 起 Release 由 tag 触发的 GitHub Actions 产出，只上传 `main.js` / `manifest.json` / `styles.css` 三资产，`SHA256SUMS` 与发布说明写入 Release 正文并附构建来源证明（见 `.github/workflows/release.yml`、`docs/RELEASE_CI.md`）。发布说明 `docs/RELEASE_NOTES_0.0.14.md`。

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

## 交付边界

源码已 push 到公开仓库，0.0.13 为首次正式 Release（tag `0.0.13`、五资产；0.0.14 起改为三资产 + attestations，`SHA256SUMS`/说明进正文），仓库含 MIT LICENSE 与 `versions.json`。**社区目录条目已上线**（<https://community.obsidian.md/plugins/knowledge-graph-smoke>，自动评审 Completed、仅建议项）；2026-11-05 目录镜像同步后客户端「浏览」可搜到。0.0.12 候选已按 48-P2 决定收紧 manifest：名称 Knowledge Map、`minAppVersion` 1.6.7（已在 Obsidian 1.6.7 与 1.14.5 实测）、`isDesktopOnly: true`；描述已由用户确认（即 manifest 现有英文）；0.0.12 已按授权装入日常库并完成 1–2 天自用体验（2026-11-03 通过）。0.0.13 在此基础上只改 HUD 结构与样式（顶栏重建按钮、2 秒构建状态胶囊、布局工具横带、窄窗口紧凑化），布局数据与交互契约不变；本地已构建、跑完 10 个合成脚本、打包到 `.local/release/0.0.13/` 并在合成库 vault-012 + Obsidian 1.15.0 做过原生 UI 验证，0.0.13 已 push 到 GitHub 并发布首次正式 Release（资产 main.js/manifest.json/styles.css/SHA256SUMS/RELEASE_NOTES.md）；用户日常库验收已通过。社区目录提交入口已变更为官方门户 <https://community.obsidian.md>（`obsidianmd/obsidian-releases` 的 PR 通道已废弃/禁用），需 Obsidian 账号登录后提交，属 48-P3 的剩余步骤。
