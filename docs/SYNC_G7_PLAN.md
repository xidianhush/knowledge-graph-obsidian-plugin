# G7 旧版回退与候选包实施计划

> 执行：本会话直接推进，使用 executing-plans 与 test-driven-development；最终独立审阅。用户2026-11-19明确授权“开始G7”。

**Goal:** 在新合成库验证最新明确所选布局可导出给实际正式版0.0.15，旧版编辑/重开后回到统一候选仍保留原连接、接受历史和未发布工作。

**Architecture:** 复用完整恢复备份、私有配置投影、受控生命周期与现有兼容包格式。新增统一宿主的审阅兼容导出和正常设置入口，不覆盖工作库data.json。正式0.0.15使用本机发布三资产并核对记录摘要；回退期间编辑保存在其data.json，回升不自动把这些外部布局发布到原共享历史。

**Tech Stack:** 现有JavaScript模块、Node合成/磁盘检查、真实Chrome DOM/IndexedDB及独立Windows Obsidian profile。

**Spec:** `docs/SYNC_0.0.16_FORMAL_REVIEW.md`第7/9节、当前TODO与本轮用户已确认G7范围。实际旧版不支持新同步日志；其是否安全忽略、旧候选是否拒绝新日志必须分别验证，不能视作同一兼容承诺。

## 约束和审查重点

- 保留全部未提交/未跟踪内容和G4/G5/G6/日常库；用当前源码白名单隔离副本，不能用旧HEAD代替工作区实现。
- 版本仍0.0.15候选；不提交推送、tag/Release或升级日常库。G8/P3及G6未测资源/耗时不自动结项。
- 兼容输出含本地设置/UI/未知字段及明确选择的schema3布局；私密备份不进公开包或共享操作目录。没有设备密钥/接受凭据可移植承诺。
- 只在已关闭布局同步、已完整备份的本地会话审阅输出；不对未知/冲突/pending/未保存输入假装安全降级。取消不写，确认前源/图谱/备份/库存变化使审阅过期；完成清单写入前失败不生成清单；写入后失败不得报告成功，完整性读取须拒绝损坏包。
- 完成导出核验后用户完全退出Obsidian，再切换三运行文件及兼容data.json；回升后保持关闭，不自动发布旧版期间的改动。旧版data.json必须另存。

## Task 1：隔离基线及审阅导出

Files: `scripts/prepare_sync_g7_workspace.mjs`, `scripts/sync_g7_check.mjs`, `src/sync/obsidian-unified-host.mjs`, `src/sync/obsidian-sync-settings.mjs`, `src/i18n.sync.js`, `scripts/test.mjs`。

- [x] 保存当前源码/工作区清单和正式0.0.15三资产摘要，在新G7副本完成现有构建/测试基线。
- [x] 先写失败回归：latest accepted与原JSON不同、草稿明确选择、设置/UI/未知字段保持、启用时拒绝、取消/过期、pending/冲突拒绝、受限导出、清单前部分失败无manifest，清单后变化不报告成功、重试/正文完整校验。
- [x] 接宿主preview/confirm，绑定完整恢复包、当前本地状态/源/库存及graph epoch。输出新ID目录的`data.json`与最后写入的兼容`manifest.json`；不写原data.json。
- [x] 设置页提供明确导出选择、预览/取消/确认与核验后完整路径，说明完全退出再切换。测试正常UI和英文/中文文案。

## Task 2：实际旧版回退/回升及日志兼容

Files: `scripts/sync_g7_legacy_check.mjs`, `scripts/sync_g7_native_check.py`及必要的合成准备脚本。

- [x] 以正式发布0.0.15实际资产在VM/独立原生库读取所选输出，校验设置/UI/未知字段及schema3坐标；正常拖动保存和完整退出重开。
- [x] 相同新库先后安装候选→正式版→候选，保持同一插件ID/私有安装身份；验证回升保留原accepted/草稿和连接且不自动发布旧版工作，旧版data.json另存可读。
- [x] 验证G6新增publication-abandoned日志对旧候选的回放拒绝/不写保证；实际正式版对候选私有状态不触碰，不能伪称它支持该日志。
- [x] 真实文件部分输出/进程中断及回开验证；失败材料保留，不把VM或Node重开当原生/iPad重开。

## Task 3：回归、交付及回执

Files: `docs/SYNC_G7_RESULT.md`, `docs/SYNC_G7_GUIDE.md`, `TODO.md`, `HANDOFF_NEXT.md`及独立打包脚本。

- [x] 在当前源码隔离副本运行必要全套旧新合成/磁盘/真实浏览器和Windows原生回归，按改动扩展，取得独立审阅并修复重要问题。
- [x] 新PC/iPad白名单包、库外正式0.0.15三资产和步骤指南；核对SHA/CRC/路径，包中无安装身份、账本、报告、截图或用户数据。
- [x] 记录实际回退/回升边界、平台/资源未测范围、发布前数据披露。交用户新库体验验证，技术通过不代签iPad或总体体验。

进度和原始证据保存在新`.local/sync-016/g7/`目录；每项取得对应证据后才勾选。

2026-11-19：以上为技术执行/交付勾选，不代表用户产品验收；最终证据与未测范围见`docs/SYNC_G7_RESULT.md`，原始汇总`.local/sync-016/g7/regression-summary.json`。
