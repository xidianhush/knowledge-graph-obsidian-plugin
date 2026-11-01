# 阶段 4.5 首轮交互修复（候选 0.0.2）

日期：2026-10-27。状态：技术回归及用户独立库体验验收通过；经明确授权，日常库文件已升级，用户已确认重新加载，日常试用进行中。

## 用户反馈与复现

- FB-002：Ctrl 悬停偶发无正文预览。用户确认预览开启，点击标题后 `/` 能聚焦搜索；日常库中先点/不点画布均出现失败。联合观察还捕捉到一次文件夹提示。因此，不能把焦点问题当作全部现象的唯一根因。
- FB-003：Esc 离开图谱，跳到其他笔记标签。独立 Obsidian 1.14.5、只启用本插件与基本核心插件时也能复现，修复不依赖停用其他第三方插件。
- 修复前独立库记录在 `.local/evidence/interaction-results-before.json`：先按 Ctrl 再进入画布、先悬停再按 Ctrl 均未打开原生预览；先点击画布后可打开；画布、搜索框和未聚焦画布时按 Esc 都会切走。该基线测试后来在弹窗测试的模块导入处中断，不作为完整套件计数。

## 修复与交互边界

- 鼠标移动直接同步实际 `ctrlKey`；鼠标在画布上时，即使焦点在其他控件，也能接收 Ctrl 的按下和释放，不强制抢焦点。
- 按键触发预览前核对鼠标当前是否真正位于本视图画布，避免在工具栏、遮罩或其他视图上使用旧坐标命中节点。窗口失焦和视图停用清理修饰键状态。
- Esc 使用 Obsidian 的 `View.scope`，在当前图谱视图中收起预览/选择；搜索框内保持原来的退出搜索语义。浏览器适配层也阻止已处理的 Esc 继续冒泡。命令面板和其他笔记仍由各自作用域处理。
- 保留临时预览、松开 Ctrl 关闭、单击固定、原生渲染与跳转行为。未修改布局、LOD、颜色、画布渲染内核或建图管线。
- API 依据：[Obsidian 官方类型声明](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts) 中的 `View.scope`、`Scope.register` 和 `KeymapEventListener`；使用返回 `false` 的视图作用域处理。`View.scope` 公共 API 从 1.5.7 起提供，因此 manifest 最低版本由 1.5.0 调整为 1.5.7。实际本轮仅验证 1.14.5。

## 2026-10-27 实际验证

- `python scripts/interaction_check.py`：16 / 16。包含两种 Ctrl 时序、原生正文、画布/搜索/固定预览的 Esc、工具栏不误触发、10 次连续预览组件释放、窗口失焦、命令面板及其他笔记隔离。
- `python scripts/native_check.py`：31 / 31。原生公式/图片、重复标题源行、预览预算、跳转、更新及生命周期回归。
- `python scripts/browser_core_check.py`：17 / 17。双实例隔离、暂停恢复、资源清理、相同输入画面一致。
- `python scripts/smoke_check.py --reload-plugin`：24 / 24。缩放、拖拽、搜索、分屏、事件隔离、隐藏/关闭；冻结快照与原渲染器 Canvas PNG **逐像素相同**。
- Node 的 `core_check.mjs`、`settings_check.mjs`、`pipeline_contract_check.mjs` 均通过。

本轮共 88 项集成断言（16 + 31 + 17 + 24），组成与阶段 4.3 的历史 88 项不同。没有重跑完整设置集成、当前库管线集成、真实库副本或全量 golden；阶段 4.4 的历史 129 项不计为本轮新通过。

证据位于 `.local/evidence/`：`interaction-results.json`、`interaction-native.png`、`native-results.json`、`core-browser-results.json`、`smoke-results.json`。这些是本地测试材料，不纳入交付包。

## 候选产物与验收范围

- 插件 ID 与名称保持不变，版本为 `0.0.2`。
- `dist/main.js`：277481 bytes，SHA-256 `649de0be972f0824ddf6ffa413c9868060e8de9ff97049081de5d2529d857411`。
- 安装包：`.local/releases/knowledge-graph-smoke-0.0.2.zip`，仅含 `knowledge-graph-smoke/main.js`、`manifest.json`、`styles.css`，不含 data.json、冻结快照或笔记。用户独立库验收后已明确授权并完成日常库三运行文件升级；data.json 前后哈希一致，原有范围设置保留，旧运行文件已备份。升级回执 `.local/daily-upgrade-0.0.2-receipt.json`。
- FB-002 已修复稳定复现的焦点/事件路径，用户日常库的完整现象仍待候选版复验；如果“点击后仍失败”继续出现，需要记录具体节点、命中状态和预览状态，不能提前宣称完全解决。
- FB-003 在独立库技术及用户体验验收通过，待日常试用反馈。
- 移动端、独立弹出窗口、所有第三方插件组合尚未新增验收。

建议用户复验：从笔记切回图谱后直接 Ctrl 悬停；先悬停再按 Ctrl；点击固定后松开 Ctrl；分别在画布、搜索框、固定预览中按 Esc，确认图谱标签保留。产品验收结果记入 TODO 的 45-P4 / FB-002 / FB-003。

2026-10-27 用户已明确反馈独立库“奏效了”“顺畅多了”，并同意升级日常库测试；记录为独立库体验验收通过。此次安装阶段仅核对产物、备份和配置哈希，未重跑上述集成测试；未读写日常库笔记，未自动重载或重启用户的 Obsidian。
