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

当前版本号为 0.0.11（已 push 到 GitHub 并发布 pre-release；尚未提交 Obsidian 社区目录）；布局存储为 schema3，旧 schema1/2 数据会在首次协调写入时自动迁移。0.0.10 及更早版本读到 schema3 会禁用调整并保留原数据，回退须先备份 `data.json` 的 `layoutOverrides`。

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

源码已 push 到公开仓库并发布 GitHub pre-release v0.0.11（三个运行文件附件 + SHA256SUMS），仓库含 MIT LICENSE。**仍未提交 Obsidian 社区插件目录**。正式名称、manifest 描述、支持的平台与最低版本、发布渠道仍待 48-P2/48-P1 决定；manifest 当前仍声明移动端可用及最低 1.5.7，这两项声明尚无完整验收，正式发布前必须校准（移动端建议先改为 `isDesktopOnly: true` 或补测）。
