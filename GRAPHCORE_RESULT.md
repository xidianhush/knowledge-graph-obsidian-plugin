# 阶段 4.1 GraphCore 验收记录

日期：2026-10-26。项目位于 `D:\what_i_am_doing\Project\knowledge-graph-obsidian-plugin`。

## 交付

GraphCore 接收 canvas、payload 和显式 platform，独立管理解码、渲染、相机及帧/输入事件生命周期。核心没有 Obsidian 导入或全局 DOM 依赖。浏览器 adapter 和 ItemView adapter 使用同一份核心；HUD 从核心中分离，并保留原视觉与交互。

原始 `upstream/render.js`、`app.js`、`template.html` 字节不变。实际代码位于 `src/core/` 与 `src/adapters/`，不再由构建脚本动态 patch 原 renderer/app。移除旧 `src/scope.js` 与 `runUpstream` 入口。

相较阶段 4.0，补上每实例 payload 深复制、可重复解码、显式暂停/恢复/销毁、部分初始化异常清理、canvas 直接监听器释放、销毁后清空 HUD 与 DOM。隐藏时保留待执行帧但取消实际 rAF，恢复后执行一次；关闭后所有待执行资源归零。

## 最终实测

- `node scripts/core_check.mjs`：通过。检查真实 idx1 快照解码、未编码再输入、输入不变、未知 codec 拒绝、幂等 pause/resume/dispose、销毁后拒绝新帧、模拟订阅失败清理。
- `python scripts/browser_core_check.py`：17 ok / 0 fail。安装的 Chrome、DPR 1.5；独立 ES modules，不加载 Obsidian。
- `python scripts/smoke_check.py --reload-plugin`：24 ok / 0 fail。独立 test-vault、Obsidian 1.14.5；DPR 1.8450000286102295，完整窗格 CSS 692×733、backing 1277×1352，分屏宽 346。
- 像素比较：`fractionDifferentOver3 = 0.0`，`exactEqual = true`。参考页面使用冻结源代码 + 相同冻结 payload，避免作者库后台重建造成输入不一致。
- 无未捕获浏览器错误；分屏各有独立相机/inset；销毁后 listeners、frames、timers、observers 都为 0。

初始化失败回归采用主动注入订阅错误；销毁后输入回归向已释放 canvas 发送 wheel，旧相机保持不变。裸核心像素比较先对双方执行同等 resize/redraw，避免将 HUD 已多次重绘的画面与裸核心首次绘制混为同一帧。

## 产物

- `dist/main.js`：179640 bytes。
- SHA-256：`527143d8ad58fa49964d17305d7c7e0f328fc14e367fe97cc5bdeb4896df4851`。
- `dist/graph-core.mjs`：103705 bytes。
- `dist/browser.mjs`：73305 bytes。

运行时新增依赖为 0。Node/Python/Playwright 仅用于开发和测试。

## 范围

本轮完成 GraphCore 抽取，不包含 JS 构图管线、vault 实时更新、宿主原生 Markdown/图片/笔记跳转，以及移动端/浅色主题/独立弹窗验收。未运行原 Python verify 和 11 fixtures 全量 sweep，未声称这些是本轮新结果。

原仓库仍为 `29d6a287493bf1ffbb5ae399ba3a15490657a9dc`，未修改或推送。下一步建议迁移 JS 数据管线并建立 Python golden 对照；复用本轮的 17 + 24 项宿主回归。
