# 0.0.6 交付固定与日常试用升级

日期：2026-10-30（Asia/Shanghai）。用户在真实副本验收后明确决定进入日常库试用。ME-A5 完成，日常库三个运行文件已升级。后续用户明确日常体验结束，原规划功能暂时正常、体验不错；新反馈 FB-005（笔记小改动导致布局回退）另见 LAYOUT_CONTINUITY_PLAN.md，尚未修复。首发功能冻结尚未明确决定。

## 固定产物

- 三文件包：`.local/releases/knowledge-graph-smoke-0.0.6.zip`，只含 main.js、manifest.json、styles.css。SHA-256 `f401783f972b426428de647e11e1996a0cb359b69b68388918d7fe38e98c05cb`。
- 构建源码本地归档：`.local/releases/source-0.0.6-20261030.zip`，26 个白名单构建文件，不含笔记、配置或冻结图谱；SHA-256 `2e7195425982af83791f30e74d61be9661f0a6ef5874e72f198465bf86c34e31`。解压到独立目录构建后，三个运行文件逐一与验收产物相同，不依赖 smoke-payload.json。此为本地可还原归档，未做公开仓库发布。
- 锁定回执：`.local/releases/release-lock-0.0.6.json`；核对脚本 `scripts/freeze_layout_release.py`。

本轮进行产物白名单、源码还原构建及安装校验，没有重新运行全部历史功能/性能测试。既有证据见 LAYOUT_PERSISTENCE_RESULT.md、LAYOUT_PERFORMANCE_RESULT.md；两阶段用户验收均已收到。

相对日常库 0.0.3，0.0.6 新增全层级布局调整、兄弟避让、子树/连线跟随、自动保存、整组撤销/重做及自动布局恢复。结构不兼容时回退、会话撤销上限、密集几何受限和规模上限继续保留，详见上述结果文档。

## 安装结果

安装目录为 `D:/obsidian_vault/hush-ob-bucket/.obsidian/plugins/knowledge-graph-smoke/`。安装前确认版本 0.0.3，已备份三个运行文件及 data.json 到 `.local/backups/daily-before-0.0.6-20261030T092905626/`。仅替换三个运行文件，没有读取或修改日常笔记，没有改配置、启用列表或其他插件。

安装后 main.js SHA-256 为 `48caf2479faac124bbaa8f72c952e7d731f845ee204e093252b15f1bf799b49a`；manifest.json、styles.css 也与固定产物一致。data.json 前后 SHA-256 均为 `7627987729372ef2649f2b1a971e3eb05bc4ec06247fbbb8ee853ab720641136`，已有范围与设置逐字节保留。

安装回执 `.local/daily-upgrade-0.0.6-receipt.json`；安装脚本 `scripts/upgrade_daily_006.ps1`。本次安装授权不代表公开发布或 push，未执行这些操作。

## 开始试用与回退

安装时操作指引：在日常库设置 → 第三方插件中，将 Knowledge Graph Smoke 关闭再启用，确认显示 0.0.6，再重新打开当前库图谱。无需卸载。技术侧只核验磁盘文件，没有接管日常窗口重载；后续日常体验结论来自用户明确反馈，见上文，原安装回执保留历史状态。

日常试用关注实际学习中拖动/避让是否自然、保存重开是否保留、撤销/恢复是否符合预期，以及原 Ctrl/Esc/预览是否稳定；出现问题记录场景和实际表现。

如需回退：先禁用插件，保留当前 data.json，再从上述备份目录恢复 main.js、manifest.json、styles.css 三个 0.0.3 文件，重新启用。不要默认恢复旧 data.json，以免丢失试用期间新设置；0.0.3 不应用新增的手动布局覆盖。备份配置仅用于明确需要恢复安装前配置的情况。
