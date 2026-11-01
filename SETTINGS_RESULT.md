# 阶段 4.4 验收：设置界面、持久化、构建反馈与真实库副本

日期：2026-10-26（Asia/Shanghai）。活动项目：`D:/Documents/ChatGPT/knoeledg-graph-obsidian-plugin`。

## 接手核对

工作区初始只有 `.stage4/`、`.graphcore/`、`.pipeline/`、`.native/` 历史增量。完整项目位于文档所指的 `D:/what_i_am_doing/Project/knowledge-graph-obsidian-plugin`；本轮将完整源码、脚本、冻结参照整理到当前工作区根目录，后续修改与测试均在当前工作区进行，没有反向覆盖原项目。

阅读并以完整项目 README、NATIVE_RESULT、PIPELINE_RESULT 和实际源码为依据。没有用历史 HANDOFF_STAGE4 判断当前进度。接手时构建 265680 bytes，SHA-256 `9cace914dd9aafd3522ea87e85c93731ecb5d82d8749bbcfd7daa45413cff323`，与阶段 4.3 文档一致；修改前核心、管线契约与原生 31 项基线重新通过。修改后重新执行完整 88 项回归。

## 完成内容

- 原生 `PluginSettingTab`：包含/排除规则、排除笔记、目录映射、自动更新开关、防抖时长、原生预览开关、单次字符预算。
- 草稿编辑与明确的保存并应用；范围检查只枚举 Markdown 路径，不读正文。空范围规则、绝对/越级路径、无效 glob、目录映射 JSON 与数值范围在保存前报错。
- 兼容旧 `pipeline` 配置；保留 annotations、candidates、未知字段及高级配置。通过 `loadData`/`saveData` 持久化，串行保存；磁盘写入失败不发布新配置，不触发重建。
- 保存后重建已打开的当前库视图，关闭旧预览、取消过期任务；自动更新关闭后不响应笔记变动，手动重建仍可用。
- 预览关闭时不读取正文；范围变化后的旧节点不能继续触发范围外读取。固定禁止路径仍在读取前排除。
- 等待、读取数量、布局、完成、空范围、失败、取消反馈；支持取消与重试。完成显示笔记/节点/边数量、耗时与自动更新关闭状态。状态条留出原图谱底部信息及折叠图例控制的位置。
- 保留旧图直到新图成功；失败保留旧图。相机、搜索、过滤、标签模式、有效选中与释放契约继续由原有实现处理。

## 本轮验收

独立测试库 `test-vault/`，独立配置 `test-profile/`，CDP `127.0.0.1:9238`。所有操作 Obsidian 的验收脚本在操作前核对库的绝对路径。

- `native_check.py`：31 通过 / 0 失败。
- `vault_pipeline_check.py`：16 通过 / 0 失败。
- `smoke_check.py --reload-plugin`：24 通过 / 0 失败，快照画布 PNG 逐像素相同。
- `browser_core_check.py`：17 通过 / 0 失败。
- `settings_integration_check.py`：24 通过 / 0 失败。覆盖真实设置页、无正文范围预览、无效草稿、开关与防抖、排除前置、映射与源路径、手动重建、取消迟到读取、保存失败、空范围、重载持久化、关闭清理及状态条避让。
- `real_trial_check.py`：17 通过 / 0 失败，范围与详情见下节。
- `core_check.mjs`、`pipeline_contract_check.mjs`、`settings_check.mjs`：全部通过。设置 Node 检查覆盖旧配置补默认、未知字段保留、相对路径与映射规范化、非法参数拒绝、强制排除、写入失败与串行保存。

共 **129 项集成断言通过**（原有 88 + 设置 24 + 真实副本 17），另有上述 Node 检查。没有删减旧断言。原生测试中“成功后状态条不存在”的断言因新功能而更新为“新 session 已替换、状态 ready、失败文案消失”。设置测试最初的两次启动等待错误已修正为等待 app/workspace/layoutReady，最终完整跑通。

未修改 `src/core/`、`src/pipeline/`、共享 browser/hud/canvas 适配器及冻结 upstream 源码；已逐文件与接手源码比较字节一致。本轮没有重跑阶段 4.2 的 12 组 Python/JS golden、Worker/画布全量对照，也没有把历史结果算入本轮统计。

## 用户确认的真实库试用

源库：`D:/obsidian_vault/hush-ob-bucket`。用户明确同意目标 `real-vault-trial/`，选择 `Science and Tech` 和 `Literature History Philosophy`，以及其中引用的本地图片。

独立测试验收通过后，按该范围复制：

- Markdown 95 篇：两个目录分别 85、10 篇。
- 本地引用图片 567 张，共 420159458 bytes（约 400.7 MiB）。
- 1 个图片引用缺失或有歧义，未擅自扩展复制范围；详细引用在 `.local/evidence/real-trial-copy.json`，不写入公开源码结果。
- 不复制源库 `.obsidian`、`.git`、`.trash`，不复制其余笔记目录。`Utilities/API Key.md` 没有读取或复制。只对选定源文件读取/复制，没有向日常库安装或写入配置。

副本启用独立 `real-trial-profile/` 与 CDP `127.0.0.1:9239`，只安装当前插件和基础核心插件。当前设置：已确认的两个目录、自动更新开启、防抖 500 ms、原生预览开启、预算 60000 字符。

实测生成 **3310 节点、3406 边**，两次观察构建约 **0.22–0.26 秒**。这是当前机器、当前范围的实测，不代表全库或持续编辑性能保证。原生图片资源、真实公式、标题源行跳转、自动增删后的状态保留与配置重载均通过。测试只在副本创建/删除合成探针笔记；测试后 95 篇副本 Markdown 与复制清单哈希全部一致，567 张图片也按清单校验一致。

## 产物与本地证据

- `dist/main.js`：276757 bytes，SHA-256 `9d62ccd2ee22f2b93fe144ee4ed7929b06b1fc81f0b06cfaadfa89f99d3a4129`。
- 两个测试库的已安装 main.js 与上述哈希一致。
- `.local/evidence/stage44-summary.json`：结果计数、产物哈希、未改动契约文件清单。
- `.local/evidence/settings-results.json`、`settings-tab.png`、`settings-build-ready.png`。
- `.local/evidence/real-trial-results.json`、`real-trial-copy.json`、`real-trial-final.png`、`real-trial-image-preview.png`。
- 原有 native/vault-pipeline/core-browser/smoke 的结果 JSON 与像素截图。

真实副本、测试库、两组独立配置、证据、dist 都已 gitignore，且已验证忽略生效。没有 push。当前工作区原本就是未跟踪的阶段文件，本轮没有为其提交 Git commit。

## 保留边界

本轮完成阶段 4.4 的设置与试用准备，并完成所确认范围的真实副本试用。更新仍为 Worker 完整重建；移动端、触摸、浅色主题、独立窗口、第三方 Markdown 后处理插件、大库长期连续编辑仍待验收。

本轮新建测试配置的实际应用标题为 Obsidian 1.6.7；应用日志显示后台下载了 1.14.5，但未将未重启后的版本视为本轮验证版本。阶段 4.3 文档中的 1.14.5 是此前验收记录。
