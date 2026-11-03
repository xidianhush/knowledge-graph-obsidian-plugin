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

当前交付版本：**0.0.13**（UI/UX 打磨，本地候选，未 push/未发布，待用户日常库验收 UI-P1）。构建 `main.js` 332,269 B sha256 `5dca2bfb1783a08e17bd5b0de15c929ddd050e27c524e62524d97057b67b5e3e`；打包产物 `.local/release/0.0.13/`（三文件 + SHA256SUMS + RELEASE_NOTES），发布说明草稿 `docs/RELEASE_NOTES_0.0.13.md`。历史：0.0.12 为内部候选（已装日常库完成 1–2 天自用体验并通过，报告见 `product-site-acceptance/`）；0.0.11 已 push 并发布 GitHub pre-release；尚无任何版本提交 Obsidian 社区目录。0.0.12 的 manifest 名称为 Knowledge Map、`minAppVersion` 1.6.7、`isDesktopOnly: true`（0.0.13 沿用）；布局存储为 schema3，旧 schema1/2 数据会在首次协调写入时自动迁移；0.0.13 只改 HUD/样式，不改数据格式与交互契约。0.0.10 及更早版本读到 schema3 会禁用调整并保留原数据，回退须先备份 `data.json` 的 `layoutOverrides`。

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

源码已 push 到公开仓库并发布 GitHub pre-release v0.0.11（三个运行文件附件 + SHA256SUMS），仓库含 MIT LICENSE。**仍未提交 Obsidian 社区插件目录**。0.0.12 候选已按 48-P2 决定收紧 manifest：名称 Knowledge Map、`minAppVersion` 1.6.7（已在 Obsidian 1.6.7 与 1.14.5 实测）、`isDesktopOnly: true`；描述已由用户确认（即 manifest 现有英文）；0.0.12 已按授权装入日常库并完成 1–2 天自用体验（2026-11-03 通过）。0.0.13 在此基础上只改 HUD 结构与样式（顶栏重建按钮、2 秒构建状态胶囊、布局工具横带、窄窗口紧凑化），布局数据与交互契约不变；本地已构建、跑完 10 个合成脚本、打包到 `.local/release/0.0.13/` 并在合成库 vault-012 + Obsidian 1.15.0 做过原生 UI 验证，但**未 push、未发布、未装日常库**，待用户 UI-P1 验收。剩余公开发布与社区目录提交属 48-P3，待用户明确授权。
