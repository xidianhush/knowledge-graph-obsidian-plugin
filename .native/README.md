# Knowledge Graph Obsidian Plugin — 阶段 4.3 原生预览、跳转与自动更新

项目目录：`D:\what_i_am_doing\Project\knowledge-graph-obsidian-plugin`。

阶段 4.0 冒烟、4.1 GraphCore、4.2 纯 JS 建图/布局和 4.3 原生预览/跳转/自动更新已完成。插件现在可以直接读取当前 Obsidian 库的 Markdown，在 Web Worker 中生成节点、边、布局、LOD 和色板，并交给同一个 GraphCore 渲染。运行时不调用 Python、Node 或外部服务。

在命令面板运行 **Knowledge Graph Smoke: 从当前库构建知识图谱**，或点击侧边栏网络图标。打开当前库图谱后，新增、修改、删除、重命名笔记会在 350 ms 防抖后自动完整重建；手动运行命令也可刷新。新图成功后替换旧图，保留视角、搜索、学科过滤、标签模式和仍存在的选中项；失败时保留旧图并显示原因。**打开知识图谱冒烟** 仍用于冻结快照回归。

当前库模式支持 **Ctrl + 悬停笔记/标题圆** 打开原生 Markdown 预览，预览中支持公式、库内图片和内部链接；预览出现时点击圆，或点击浮层，可固定阅读。Esc / 关闭按钮收起浮层。侧栏或浮层的打开按钮在新标签页打开笔记，标题按当前源文件行号定位，重复标题也能区分。快照模式保持原来的预览行为。

原生浮层使用 Obsidian 主题变量，置于视图内的 light DOM，以使用宿主 Markdown 样式；Canvas/HUD 继续在 Shadow DOM 中。图谱更新或隐藏时关闭预览，释放组件，避免显示过期内容。整个阶段 4 的移动端、主题和独立窗口验收仍未完成。

## 当前结构

- `src/pipeline/defaults.js` / `input.js`：默认值、标准化配置校验、范围过滤、重映射、Python 一致的 Unicode 排序/取整、frontmatter 边界、标题树和 wikilink 解析。
- `src/pipeline/graph.js`：目录/笔记/标题节点、层级边、wikilink/标题边、frontmatter/手工/已接受候选边、索引、歧义解析、去重与权重合并。
- `src/pipeline/layout.js` / `palette.js`：圆打包、父子半径约束、坐标精度、半径下限、LOD 行程/滚轮参数，以及学科自动色板。
- `src/pipeline/build.js` / `encode.js`：组装 renderer 可消费的 payload、可选 idx1 编码；无 I/O 和 Obsidian 依赖。
- `src/adapters/vault-pipeline.js`：通过 Vault API 读取所选笔记，调用宿主 YAML 解析，启动/取消 Worker 并清理 URL 和资源。排除规则在文件读取前执行。
- `src/core/payload.js`：复制 JSON payload，解码 idx1；兼容未编码 payload，不修改调用方数据。
- `src/core/renderer.js`：从冻结的渲染器抽出的 Canvas2D 绘制、命中、相机与交互实现。每次创建拥有独立 inset 和缓存；平台访问全部经 `runtime` 注入。
- `src/core/graph-core.js`：管理 mount、resize、pause、resume、dispose，追踪帧和事件订阅；初始化异常也会释放资源。没有 Obsidian、全局 window/document、DOM 查询或存储访问。
- `src/adapters/canvas-platform.js`：从 canvas 所属窗口提供时钟、尺寸、DPR 和事件。所有订阅返回取消函数。
- `src/adapters/browser.js`：`mountGraph(container, payload, services?)`，建立 Shadow DOM、挂载核心/HUD、观察尺寸与可见性、处理 DPR、销毁整个实例。
- `src/adapters/hud.js` / `hud-scope.js`：原有顶栏、搜索、图例、过滤和预览。局部 DOM facade 仅供 HUD 兼容旧界面使用；核心不经过这层包装。
- `src/adapters/obsidian-native.js`：懒加载笔记、MarkdownRenderer/Component 生命周期、标题定位、内部链接跳转和容器内预览浮层。
- `src/plugin.js`：快照与当前库两个 ItemView 入口、vault/workspace 事件、防抖与过期任务取消、成功后替换、状态恢复和关闭清理。
- `upstream/`：原始 render/app/template 字节不变，保留为回归参照。修改后的活动源码在 `src/`，构建不再对 render/app 做字符串补丁。

`src/scope.js` 和 `runUpstream` 旧入口已移除。不要占用 Obsidian 的 `view.scope`；它属于宿主键盘系统。测试用 `graphHostScope` 现在指向完整挂载 session。

## 构建与运行

构建使用 Node.js 标准库，无 npm 安装步骤和新增运行时第三方依赖：

```powershell
cd D:\what_i_am_doing\Project\knowledge-graph-obsidian-plugin
node scripts/build.mjs
python scripts/export_pipeline_golden.py
node scripts/pipeline_check.mjs
node scripts/pipeline_contract_check.mjs
python scripts/pipeline_browser_check.py
node scripts/core_check.mjs
python scripts/browser_core_check.py
python scripts/prepare_smoke.py
python scripts/vault_pipeline_check.py
python scripts/native_check.py
python scripts/smoke_check.py --reload-plugin
```

第一次启动独立测试实例时运行 `python scripts/prepare_smoke.py --launch`，专用 `test-profile/` 连接 `test-vault/`，CDP 只监听 `127.0.0.1:9237`。不向日常笔记库安装插件。

产物：

- `dist/main.js`、`manifest.json`、`styles.css`、`smoke-payload.json`：Obsidian 测试插件。
- `dist/graph-core.mjs`：独立核心 ES module。
- `dist/browser.mjs`：浏览器适配层，引用相邻的 `graph-core.mjs`。
- `dist/pipeline.mjs`：纯 JS 管线和编码器。
- `dist/pipeline-worker.js`：独立浏览器 Worker 入口。插件 main.js 内联同一份 Worker 源码，通过本地 Blob 启动，无远程脚本。

当前库模式只需要安装 main.js、manifest.json、styles.css；smoke-payload.json 仅供旧快照命令使用。开发测试脚本仍使用 Python 作为独立参考实现和浏览器驱动。

## 管线 API 与配置

```js
import { buildGraph, encodeGraphPayload } from './dist/pipeline.mjs';
const payload = buildGraph({
  files: [{ path: '课程/例子.md', text: '# 标题\n正文' }],
  config: { include: ['**'], vault_name: '示例库' },
  annotations: {}, candidates: {},
  generated: '2026-10-26',
  // 原始 YAML frontmatter 存在时，传入宿主的 parseYaml 函数；
  // 或在 file.frontmatter 提供已经解析的对象。无 frontmatter 时无需解析器。
});
const transport = encodeGraphPayload(payload); // 复制后编码，不修改 payload
```

`files` 是 vault 相对路径与文本列表；函数不读磁盘。目录与文件枚举顺序不影响输出。配置接收已选定范围的对象：include、exclude、exclude_notes、remap，以及 layout/zoom/lod/theme/weight 参数。原项目的 Quartz scope_file、配置文件路径查找、候选关系挖掘命令不由此 API 自动执行；已接受的 candidates 对象可输入。

插件可在自身 data.json 的 `pipeline` 字段提供配置（通过 `loadData()` 读取）：

```json
{
  "pipeline": {
    "config": {
      "include": ["课程/**", "项目/**"],
      "exclude": ["**/草稿.md"],
      "exclude_notes": [],
      "remap": []
    },
    "annotations": {},
    "candidates": {}
  }
}
```

缺省范围为当前库全部可扫描 Markdown；隐藏目录、node_modules 等按原扫描规则排除，交接中明确禁止的 `Utilities/API Key.md` 也在读取前排除。原始 YAML 由 [Obsidian 官方 parseYaml API](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts) 解码，标题与链接解析由纯 JS 管线完成。无效 YAML 按 Python 原行为使用空 frontmatter；缺少 YAML 解析器时明确报错，不静默丢失元数据。

`buildGraph` 输出数据图谱，不生成 Markdown HTML。原生预览按需读取笔记，默认每个浮层最多向 MarkdownRenderer 传入约 60000 字符；正数 `pipeline.config.preview.max_note_chars` 可覆盖此上限。按完整行截取并闭合未完成的代码围栏；远处的目标标题从该节开始截取，浮层提示打开全文。`total_chars_budget` 属于旧导出 HTML 的总预算，原生模式不缓存全库 HTML，因此不执行这个全库分摊参数。当前库重建仍是完整计算，包含防抖与取消，尚未实现逐节点增量布局。关闭视图会终止 Worker 并移除监听与预览组件。重名 stem 保留原解析规则；重映射造成节点 id 冲突、笔记和目录 id 冲突则明确报错，避免静默覆盖。

浏览器模块通过本机 HTTP 服务加载，容器需要明确宽高：

```js
import { mountGraph } from './dist/browser.mjs';
const session = mountGraph(container, payload); // JSON 对象或 JSON 字符串
session.pause();
session.resume();
session.refresh(); // 也由 ResizeObserver/可见性/DPR 事件自动触发
session.dispose(); // 幂等；移除本实例 DOM，释放监听器、计时器、observer、帧
```

不需要 HUD 时，可以直接挂载核心：

```js
import { GraphCore } from './dist/graph-core.mjs';
import { createCanvasPlatform } from './dist/browser.mjs';
const core = new GraphCore({ canvas, payload, platform: createCanvasPlatform(canvas) });
const renderer = core.mount({ onSelect(id) { /* 宿主自己的选中行为 */ } });
renderer.setInsets({ top: 0, bottom: 0, right: 0 });
core.resize(); // 裸核心由调用方通知尺寸/DPR变化和隐藏/显示
core.pause();
core.resume();
core.dispose();
```

每个核心只能 mount 一次，替换 payload 时销毁后重新挂载。`renderer` 暴露原有相机/过滤/命中 API；dispose 后不可继续调用旧 renderer。核心清空 data/canvas/renderer/platform 引用，session 清空 graph 并清理 DOM。`diagnostics()` 在销毁后仍可读。

注入平台契约：`metrics() -> {width,height,dpr}`、`now()`、`requestFrame(fn) -> id`、`cancelFrame(id)`、`listenCanvas(type,fn,options)`、`listenGlobal(type,fn,options)`。两种 listen 必须返回取消订阅函数；帧回调应异步执行，时间戳与 `now()` 使用同一时间基准。

## 验收

2026-10-26 阶段 4.3 本轮验收：

- 新增原生功能集成：31 项通过 / 0 失败，覆盖公式、图片、重复标题、Ctrl 交互、预览预算、链接导航、自动更新、状态恢复、失败保留、过时 Worker 取消、空库恢复和关闭清理。
- 重新执行当前库 16 项、独立浏览器 17 项、快照 24 项回归，全部通过；Node 核心检查通过。快照 Canvas PNG 与原实现完全一致。
- 本轮没有修改纯 JS 建图/布局算法；以下 12 组 golden 与 Worker 对照为阶段 4.2 的已完成基线，不声称本轮再次执行。

阶段 4.2 基线与回归覆盖：

- Python/JS golden：原 11 个 fixture + 1 个补充语义契约，共 12 组；节点、边、元数据、坐标/半径、LOD/色板、levels、标题链接、统计和 idx1 编码均通过逐字段对照；输入不变，逆序文件列表输出一致。
- 实际 Chrome Worker：12 组计算结果与主线程 JS 一致；以 Python 与 Worker payload 分别挂载 GraphCore，12 组 Canvas PNG 全部完全相同。
- 真实 Obsidian 当前库：16 项通过 / 0 失败。包括原始 frontmatter、标题链接、先排除后读取、修改后重建、Worker 与读取期间取消、无迟到 DOM、空范围提示及再次构建。

- Node 核心检查通过：解码不修改输入、重复解码稳定、错误格式、暂停/恢复只调度一次、销毁拒绝新帧、初始化订阅失败清理。
- 独立 Chrome：17 项通过 / 0 失败。覆盖不依赖 Obsidian、双视图数据/inset 隔离、裸核心与 HUD 像素相同、暂停/恢复、尺寸变化、隐藏/显示、异常挂载、销毁后输入失效、DOM 释放及重新挂载。
- 真实 Obsidian 1.14.5：原有 24 项通过 / 0 失败。包括缩放、拖拽、搜索、分屏、键盘隔离、后台暂停与关闭清理。
- 相同快照、同尺寸、同 DPR、同相机状态：原始独立页面与插件的 Canvas PNG 完全相同，差异像素为 0。

证据在 `.local/evidence/pipeline-golden-results.json`、`pipeline-browser-results.json`、`vault-pipeline-results.json`、`core-browser-results.json`、`smoke-results.json` 和对应截图。原生功能详见 `NATIVE_RESULT.md`，历史管线结果详见 `PIPELINE_RESULT.md`；`GRAPHCORE_RESULT.md` 与 `SMOKE_RESULT.md` 保留为前两阶段的历史记录。

阶段 4.2 以原 Python 实现在内存中重新生成 12 组数据基准；没有重跑原 verify.py/旧 browser_check 的全量 sweep。基准两端都关闭 HTML 预览生成，因此对照覆盖建图/布局输出，不声称 HTML 预览一致。数值容差与覆盖边界详见 PIPELINE_RESULT.md。

## 边界与下一步

固定 private 快照来自 2026-10-25 14:07，含 3515 个节点。`.local/`、`dist/`、测试库和配置含本地内容，均在 `.gitignore` 中，不属于可公开发布源码。原项目会自动重建产物，像素比较必须替换为同一份冻结 payload。

原生预览、笔记跳转、vault 变更监听与防抖重建已经接入。下一步可进行设置界面、移动端/触摸与独立窗口适配，以及大库连续编辑下的性能验收；当前更新策略是 Worker 完整重建。HUD 的局部 DOM facade 仍是迁移边界，不是已完成的宿主原生 UI。

画布维持深色。浅色主题、触摸、移动端和弹出独立窗口尚未验收；manifest 的 `isDesktopOnly: false` 不等同于移动端已验证。
