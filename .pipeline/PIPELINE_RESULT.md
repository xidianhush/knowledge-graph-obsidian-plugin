# 阶段 4.2 纯 JS 建图与布局迁移

验收日期：2026-10-26。
项目：`D:\what_i_am_doing\Project\knowledge-graph-obsidian-plugin`。

## 完成内容

新增纯 JS 数据管线，输入为选定范围的配置和 vault 相对路径/文本记录，输出为既有 GraphCore 能直接消费的 payload：

- 扫描规则：include/exclude/exclude_notes、隐藏目录、最长前缀 remap；先过滤再读取，文件枚举顺序不影响结果。
- 解析：frontmatter 边界、围栏代码块、标题树、标题级别稠密化、重复标题 id、wikilink、摘要；YAML 解码由宿主注入，Obsidian 使用内置 parseYaml。
- 建图：目录/笔记/标题、contains、wiki/标题语义边、frontmatter、手工边和已接受候选边；保留歧义解析、索引、边合并、权重、证据和统计。
- 布局：front-chain 圆打包、包含与层级半径约束、归一化、方向、深链坐标精度、r ≥ 1e-4、LOD、home/wheel 参数和 golden-angle 色板。
- 输出：levels、heading_links、统计，以及独立可选 idx1 编码器。
- 插件：新增“从当前库构建知识图谱”命令与 ribbon 入口；Worker 完成/失败/取消均释放资源；重建替换旧 session，关闭不会留下迟到挂载；空范围有明确提示。

运行时新增第三方依赖为 0，无 Python/Node/网络服务调用。Worker 只接收已选笔记文本和配置，无 vault 读取接口。

## 验收结果

1. **12 组 Python/JS golden 全部通过**：tiny、shallow、ultra-deep、deep-chain、wide-roots、hub-dense、edge-storm、long-notes、heading-zoo、plain、remap-dup、semantic-contract。每组同时比较展开 payload 与 Python idx1 编码结果，并检查不修改输入与文件逆序后确定性。
2. **12 组真实 Chrome Worker/画布对照全部通过**：Worker 与主线程 JS 输出一致；Python payload 与 Worker payload 交由同一 GraphCore 渲染，12 组 PNG 完全一致。
3. **真实 Obsidian 当前库 16 ok / 0 fail**：直接从合成 Markdown 构建，验证宿主 YAML、标题链接、排除前置、重建、Worker 取消、读取期间关闭、空范围、恢复与无未捕获错误。
4. **原有 Obsidian 回归 24 ok / 0 fail**：同快照像素完全一致、缩放拖拽、搜索、分屏、键盘隔离、隐藏暂停和关闭清理。
5. **原有独立浏览器 17 ok / 0 fail**，核心 Node 检查与新增输入契约检查通过。

补充 semantic-contract 覆盖 frontmatter 三种关系、aliases、domain 覆盖、手工/候选边状态与合并、同名 stem、长短 remap、缺失标题、代码块内伪链接、附件、路径排序、隐藏/排除路径及非 BMP Unicode 摘要。

数值对照：x/y/r 绝对容差 1.01e-9；其他数字相对容差 1e-10（最小基准 1）。字符串、字段集合、数组顺序和结构必须一致。坐标比较容差远小于最小半径 1e-4；没有通过降低 ok 数或忽略不匹配节点放宽验收。

Python golden 在本轮重新从原实现计算，关闭 preview.enabled 后保留其完整建图/布局 payload。HTML、图片资源、公式和预览预算不属于本轮迁移，未声称完整旧 HTML 产物一致。未重跑旧 verify.py/全量 browser_check sweep，也未把上一阶段的 138 / 147 / 146 当成本轮结果。

## 测试中修正

旧快照测试启动时只关闭快照视图，新增当前库视图恢复后会使通用 DOM 选择器选中隐藏视图。现在先关闭两种图谱视图再开始旧回归。独立浏览器的双实例像素比较原来固定等待 600 ms，现改成等待动画队列结束、统一 resize/redraw 后比较；相同像素断言保留。

另外修正了 Playwright 测试表达式返回 Worker 构造函数时被自动调用的测试问题。没有因此修改产品逻辑或跳过取消检查。

## 产物与证据

- main.js：252132 bytes；SHA-256 `b65d777b648989a4993d9d56173e608d8a295437fd1e2d66665d0f8e725cf13a`。
- pipeline.mjs：33663 bytes；pipeline-worker.js：33690 bytes。
- `.local/pipeline-golden/`：本轮 Python 基准、JS 实际输出与源文件哈希。
- `.local/evidence/pipeline-golden-results.json`、`pipeline-browser-results.json`、`vault-pipeline-results.json`、`smoke-results.json`、`core-browser-results.json`。
- `.local/evidence/vault-pipeline-final.png`：真实当前库生成的图谱；`plugin-canvas.png` 与 `reference-canvas.png`：原快照像素对照。

测试仅使用合成 fixtures 与独立 test-vault；验收样例在 `test-vault/__kg_pipeline_acceptance__/`，未安装到日常库。原仓库代码没有编辑，没有 push。

## 后续边界

数据管线迁移已完成，整个插件阶段仍未完成。当前库图谱由命令触发完整重建；原生 Markdown/公式/图片预览、原笔记跳转、vault 自动变更监听与移动端验收待后续完成。Quartz scope_file 路径解析与候选挖掘工具没有搬进运行时；宿主传入已选范围配置和已接受候选即可。
