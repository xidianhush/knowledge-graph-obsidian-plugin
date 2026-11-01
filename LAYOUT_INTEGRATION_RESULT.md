# ME-A2：正式图谱布局编辑集成

日期：2026-10-29（Asia/Shanghai）。状态：技术验证完成，待用户阶段体验。源码与独立测试库候选为 **0.0.4**；日常库继续使用已验收 0.0.3。ME-A3 持久化、撤销/重做尚未实现。

## 实现与行为边界

- 新增 `src/core/layout-edit.js`，正式 GraphCore 构建包含该模块。以同父组建立事务，在归一化父圆内有界求解；接受前验证包含和不重叠。真实 packing 存在相切圆，不强加原型固定间距，保留 payload 舍入的明确容差（世界坐标 0.002，归一化至少 1e-8；相对容差超过 0.002 的组拒绝编辑）。
- renderer 增加“阅读平移 / 编辑圆移动”的事件分流，5 CSS px 启动阈值、父级拖动手柄、父容器高亮、受限反馈。拖动移动同组兄弟及其完整子树，坐标始终由事务起点加总位移得到，防止累计漂移。
- 线端点、箭头/圆点标记、标签、LOD 裁剪、命中、聚焦继续读取同一份显示节点坐标。半径、结构和输入 payload 不变；语义边仍由既有 renderer 绘制。
- HUD 增加“调整布局 / 结束调整”和“选父级”。空闲时 Ctrl 预览与点击固定保留；拖动期间收起预览并抑制新请求，松手不误固定预览。普通模式画布像素与 0.0.3 相同输入一致。
- Esc 优先取消未提交事务，保持当前图谱；空闲 Esc 沿用既有 dismiss。失焦、pointercancel、暂停/隐藏、resize、卸载取消并恢复坐标，重建启动前也先取消旧事务。拖动期间滚轮和键盘平移不改变相机。
- 当前候选根级不开放，同父超过 128 个或受影响子树超过 5000 个拒绝编辑并提示。这是保守上限，不代表性能认证。超出初始几何容差的组也拒绝编辑；不会缩小圆、扩大祖先或改层级。
- **已提交位置仅保留在当前图谱会话内，重建/关闭后重置。** UI 持续说明这一点。正式插件尚无撤销/重做、保存、覆盖迁移与多视图同步；这些属于 ME-A3。原型已有的撤销按钮不能算成正式插件已经支持。

## 本轮验证

环境：Windows；独立 `test-vault` / `test-profile` / CDP 9238。插件运行 manifest 确认为 0.0.4；设置“关于”页显示运行版本 **Obsidian 1.14.5**、安装程序版本 1.6.7，不能将两者混淆。关于页证据在 `.local/evidence/layout-integration/trial-ready.json`。

实际执行：

- `node scripts/core_check.mjs`、`pipeline_contract_check.mjs`、`settings_check.mjs` 通过。
- `node scripts/layout_edit_check.mjs`：真实 buildGraph/packing 生成 12 篇合成笔记，遍历 60 个可编辑节点，每节点 10 次有界移动；全部发生有效位移、父级包含/同级分离成立，取消后全部坐标精确恢复，根级受保护。
- `python scripts/browser_core_check.py`：17 项原有浏览器检查通过（挂载隔离、同输入像素、暂停/恢复、卸载清理）。
- `python scripts/layout_edit_browser_check.py`：14 项新增正式 GraphCore/HUD 检查通过，包括与保存的 0.0.3 基线逐像素比较、实际鼠标移动、相机不漂移、输入不变、新位置命中、线标记变化、父级/后代同步、Esc/失焦/暂停/卸载恢复、拖动禁缩放。
- `python scripts/native_check.py`：31 项原生预览、公式/图片、跳转、自动更新与资源清理回归通过。
- `python scripts/interaction_check.py`：16 项真实 Ctrl/Esc 键盘回归通过，含命令面板与笔记标签隔离。
- `python scripts/layout_edit_native_check.py`：13 项编辑模式原生检查通过，含空闲 Ctrl、固定阅读、原生 View.scope Esc 取消、拖动抑制预览、释放后不误开、移动后预览、pointercancel 和重建前取消。

共 91 项浏览器/原生断言，另有上述 Node 检查；不是全部都在 Obsidian 原生环境运行。证据固定于 `.local/evidence/layout-integration/`，含结果 JSON、源码哈希、产物哈希与截图。已查看正式浏览器和独立库体验截图。

没有新增运行真实副本压力、全部 golden、完整快照冒烟、设置集成或大规模性能测试。像素比较使用真实算法生成的合成输入，不宣称覆盖所有旧私有快照。密集组可移动并不保证任意换位。弹出窗口跨屏手动体验、所有取消事件组合和真实库复杂规模仍留后续验证；未替用户宣称体验通过。

## 测试准备问题与修正

初次启动前端口未开放；旧 test-profile 的启动记录指向真实副本。关闭本轮刚启动的进程后，备份该配置并改为只打开 test-vault，随后所有自动脚本均先核对 vault 绝对路径。没有向真实副本安装候选或运行增删测试，没有重启用户日常实例；该次短暂启动不当作副本验收。

重复测试遇到关闭最后一个图谱后无标签组，以及旧 noteLeaf 无法激活。测试脚本改为先保留基础标签再关闭图谱，并显式 revealLeaf；这是测试准备修复，没有更改插件标签导航语义。原生专用脚本还修正了初始加载等待、版本记录模块读取方式。最终行为套件完整通过，早期中断未计为通过。体验准备脚本已经打开样例并写回执后，控制台打印多语言关于页触发 GBK 编码异常；已将打印改为 ASCII 转义，准备成功由已保存回执与截图确认。

## 候选与体验

- 本地三文件包：`.local/releases/knowledge-graph-smoke-0.0.4-me-a2.zip`。仅 main.js、manifest.json、styles.css，不含笔记、配置或私有快照。
- main.js：288314 bytes，SHA-256 `f81ab58faf2e4e8c819474c3b174bb445f9eafd2408b02f3505f184e408f42aa`，独立测试库同哈希。
- ZIP SHA-256：`aecdc5a00f1e817bd6e5e744d06793aff0e4a7dbc7ebb72fdb2e5b85715f4201`。
- 测试库旧运行文件与旧 profile 配置备份在 `.local/backups/test-before-layout-0.0.4/`。已验收 0.0.3 ZIP 哈希仍为 `aa69534f823364f90f15ddb1ab4530651209e6874a7d26be6b40652af89a5d70`。
- 已用 `scripts/prepare_layout_trial.py` 打开 test-vault 的 `__kg_layout_trial__`：8 篇合成笔记、41 节点、56 条总边（16 条语义边）。试用范围和关闭自动更新只设置在内存，没有保存到插件 data.json；重载后可再次运行此脚本。

请在 **Obsidian 的 test-vault 窗口**体验：右上角“调整布局” → 拖 Example / Summary 圆 → “选父级”后拖“移动整组”手柄；空闲 Ctrl 看预览，拖动中 Esc 取消。聊天旁的 9241 页面仍是上一阶段原型，不是此候选。

日常库未升级、未改日常笔记、未读取禁止路径、未 push。下一技术项 ME-A3；完整产品体验仍留 ME-P3。
