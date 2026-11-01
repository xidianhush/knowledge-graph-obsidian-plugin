# 阶段 4.0 冒烟验收 — 2026-10-25

结论：**通过。原图谱可在真实 Obsidian 原生 ItemView 中复用。阶段 4 尚未全部完成。**

验证环境为 Windows、Obsidian 1.14.5，使用本项目的独立 `test-vault` 与 `test-profile`。日常笔记库没有安装本插件，原源码仓库没有由本轮写入变更。

## 实测结果

- 本插件集成检查：**24 ok / 0 FAIL**，包括原生 canvas、全局对象隔离、宿主键盘作用域、3515 节点快照、像素落笔、滚轮、拖拽、DPR、搜索、分屏、独立相机、窄面板按钮可达、图例收起、隐藏暂停/恢复、关闭清理、重开与零未捕获异常。
- 同 payload、同尺寸、同 DPR、同相机、同悬停状态：**插件与原页面的 canvas PNG 逐字节相同**。
- CSS 画布尺寸 686×727，DPR 1.8450000286102295，实际 backing store 1266×1341；分屏后原画布宽度自动变为 343。
- 关闭视图后：已登记的 frames / timers / observers / listeners 均为 0。隐藏视图保留待续的帧回调但不执行，重新显示后恢复。
- 原项目起点回归：verify **69+69=138 ok / 0 FAIL**；browser private **147/0/0 skip**，public **146/0/1 skip**。日志采集时间为本轮开始后的 2026-10-25 14:35–14:37。
- `main.js` 为 **175265 bytes**；独立的本地快照为 **4296497 bytes**。本轮不内联 KaTeX，不新增第三方运行时包。

## 可复查证据

- `.local/evidence/smoke-results.json`：最终 24 项逐项结果。
- `.local/evidence/baseline.json` 与 `baseline-*.log`：原项目回归结果。
- `.local/evidence/obsidian-final.png`：真实 Obsidian 最终画面。
- `.local/evidence/obsidian-split.png`：两个原生图谱分屏。
- `.local/evidence/plugin-canvas.png`、`reference-canvas.png`：同尺寸透明画布。
- `.local/evidence/reference-snapshot.json`：快照一致性控制记录。
- `upstream/provenance.json`：原仓库提交与三个原始文件的 SHA-256。

## 本轮发现与修正

1. 原渲染器绑定全局事件，原交互层直接查询全局 DOM。现在每个视图拥有独立作用域，样式置于 Shadow DOM，事件/observer/计时器/rAF 随视图释放。
2. Obsidian `view.scope` 是键盘系统使用的字段；最初的同名生命周期字段导致 `i.handleKey is not a function`。已更名为 `graphHostScope`，真实键盘检查与异常检查均通过。
3. 原网页顶栏在 343px 分屏会重叠。插件窄面板增加横向滚动，保持 46px 顶栏高度，重置按钮可达。
4. 对照时出现约 3% 的边缘像素差异，绘图指令跟踪证明是不同快照的坐标、半径所致。插件使用 14:07 的固定快照，原 HTML 已于 21:37 重建。统一 payload 后差异为 0，没有放宽像素验收门槛。
5. CSS 根选择器的宽泛替换误匹配 `legend-body`，造成图例按钮切换但正文不收起。转换已收紧为行首的 `body` 规则，新增实际显示状态断言通过。

## 后续边界

本轮未移植 JS 构图/布局，未接入实时笔记更新、原生 Markdown 预览、图片资源与笔记跳转，未验收移动端、浅色主题与弹出窗口，也未重跑 11 个 fixture 的完整 sweep。

下一步：抽显式 GraphCore 生命周期与宿主接口，再移植 JS 建树/建边/布局/LOD，以同输入的 golden payload 对比防止漂移。不要把本轮临时作用域包装视作最终架构。
