# Knowledge Graph Obsidian Plugin — 阶段 4.1 GraphCore

项目目录：`D:\what_i_am_doing\Project\knowledge-graph-obsidian-plugin`。

阶段 4.0 的真实 ItemView 冒烟已完成；阶段 4.1 已抽出 GraphCore，浏览器与 Obsidian 使用同一份核心和界面适配层。当前仍加载冻结快照，还没有迁移扫描、建树、建边、布局和 LOD 计算管线，因此不是阶段 4 的完整插件。

## 当前结构

- `src/core/payload.js`：复制 JSON payload，解码 idx1；兼容未编码 payload，不修改调用方数据。
- `src/core/renderer.js`：从冻结的渲染器抽出的 Canvas2D 绘制、命中、相机与交互实现。每次创建拥有独立 inset 和缓存；平台访问全部经 `runtime` 注入。
- `src/core/graph-core.js`：管理 mount、resize、pause、resume、dispose，追踪帧和事件订阅；初始化异常也会释放资源。没有 Obsidian、全局 window/document、DOM 查询或存储访问。
- `src/adapters/canvas-platform.js`：从 canvas 所属窗口提供时钟、尺寸、DPR 和事件。所有订阅返回取消函数。
- `src/adapters/browser.js`：`mountGraph(container, payload)`，建立 Shadow DOM、挂载核心/HUD、观察尺寸与可见性、处理 DPR、销毁整个实例。
- `src/adapters/hud.js` / `hud-scope.js`：原有顶栏、搜索、图例、过滤和预览。局部 DOM facade 仅供 HUD 兼容旧界面使用；核心不经过这层包装。
- `src/plugin.js`：Obsidian 薄适配层，只负责读取快照、ItemView、workspace 事件与关闭释放。
- `upstream/`：原始 render/app/template 字节不变，保留为回归参照。修改后的活动源码在 `src/`，构建不再对 render/app 做字符串补丁。

`src/scope.js` 和 `runUpstream` 旧入口已移除。不要占用 Obsidian 的 `view.scope`；它属于宿主键盘系统。测试用 `graphHostScope` 现在指向完整挂载 session。

## 构建与运行

构建使用 Node.js 标准库，无 npm 安装步骤和新增运行时第三方依赖：

```powershell
cd D:\what_i_am_doing\Project\knowledge-graph-obsidian-plugin
node scripts/build.mjs
node scripts/core_check.mjs
python scripts/browser_core_check.py
python scripts/prepare_smoke.py
python scripts/smoke_check.py --reload-plugin
```

第一次启动独立测试实例时运行 `python scripts/prepare_smoke.py --launch`，专用 `test-profile/` 连接 `test-vault/`，CDP 只监听 `127.0.0.1:9237`。不向日常笔记库安装插件。

产物：

- `dist/main.js`、`manifest.json`、`styles.css`、`smoke-payload.json`：Obsidian 测试插件。
- `dist/graph-core.mjs`：独立核心 ES module。
- `dist/browser.mjs`：浏览器适配层，引用相邻的 `graph-core.mjs`。

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

2026-10-26 最终构建：

- Node 核心检查通过：解码不修改输入、重复解码稳定、错误格式、暂停/恢复只调度一次、销毁拒绝新帧、初始化订阅失败清理。
- 独立 Chrome：17 项通过 / 0 失败。覆盖不依赖 Obsidian、双视图数据/inset 隔离、裸核心与 HUD 像素相同、暂停/恢复、尺寸变化、隐藏/显示、异常挂载、销毁后输入失效、DOM 释放及重新挂载。
- 真实 Obsidian 1.14.5：原有 24 项通过 / 0 失败。包括缩放、拖拽、搜索、分屏、键盘隔离、后台暂停与关闭清理。
- 相同快照、同尺寸、同 DPR、同相机状态：原始独立页面与插件的 Canvas PNG 完全相同，差异像素为 0。

证据在 `.local/evidence/core-browser-results.json`、`smoke-results.json`、`plugin-canvas.png`、`reference-canvas.png`、`obsidian-final.png`。详见 `GRAPHCORE_RESULT.md`；`SMOKE_RESULT.md` 是阶段 4.0 的历史记录。

本轮没有重跑原 Python verify/11 fixtures 的全量 sweep；它们不执行新抽取的核心。没有修改原仓库和构图布局算法。阶段 4.0 的 verify 138、browser private 147 / public 146 属于上轮读数，不作为本轮重新执行的结果。

## 边界与下一步

固定 private 快照来自 2026-10-25 14:07，含 3515 个节点。`.local/`、`dist/`、测试库和配置含本地内容，均在 `.gitignore` 中，不属于可公开发布源码。原项目会自动重建产物，像素比较必须替换为同一份冻结 payload。

下一步是纯 JS 建树、建边、布局、LOD 管线，并用 fixtures 对照 Python golden payload。当前不监听 vault 变化；预览仍使用旧 HTML，MarkdownRenderer、公式、图片 getResourcePath、原笔记跳转尚未接入。HUD 的局部 DOM facade 仍是迁移边界，不是已完成的宿主原生 UI。

画布维持深色。浅色主题、触摸、移动端和弹出独立窗口尚未验收；manifest 的 `isDesktopOnly: false` 不等同于移动端已验证。
