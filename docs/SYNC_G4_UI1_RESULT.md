# G4-UI1 设置页空横条修复

2026-11-17用户回执：[横条本场景验收完成](SYNC_G4_UI1_ACCEPTANCE.md)，2报告/3图及19项通过，原25操作接受凭据保留。PC状态提示和导出旧view另列UI2待核对，未推定当前PC图谱已正确投影；无需重做横条测试。以下为技术交付历史。

2026-11-16。技术修复、独立验证和运行文件更新包完成，**待用户PC/iPad显示复验**。FB2双PC及FB5原25操作验收保持，用户现场与日常库未改动；版本仍0.0.15独立候选，无commit/push/发布。

## 根因与最小修复

横条来自原设置页 `.kg-settings-message`，不是共享布局下拉框或坚果云。`src/settings.js` 创建空的 `role=status / aria-live=polite` 区域；原样式无论有无文字都给予上下8px内边距，并sticky吸附在顶部、按主题背景绘制。因此深色主题呈黑/深色条，浅色呈白条，滚动时遮住下方设置。

独立Windows Obsidian1.15.1中，实测文字为空、padding=8px 0、position=sticky，高约15.989px（显示缩放舍入）、宽602.134px；命中对象就是kg-settings-message。仅在该自建窗口临时将padding改为0，高度立即归零，排除传输/下拉框依赖。原生前后截图已查看。

生产修改仅 `styles.css` 增加 `.kg-settings .kg-settings-message:empty { padding: 0; }`。保留原节点、ARIA、sticky消息、背景、非空8px内边距、错误颜色及事件；空状态没有遮挡面积，有文字时仍显示原有提示。不新增保存/加入流程，不修改JS或同步协议。

## 验证与边界

- 浏览器先红后绿：旧样式12组合均因空区16px失败；最终12组合通过，覆盖1360×960桌面、1194×834/390×844触屏视口，深浅色、中英文。使用生产settings.js/CSS和真实Chrome DOM，Obsidian Setting由合成适配器提供。正常检查/错误/修正/撤销用真实按钮，人工注入长文仅验证换行与程序清空；不是原生iPad测试。
- 实际Windows Obsidian独立合成profile中7项通过：滚动后的空消息高度0、正常检查消息sticky可见、撤销无残条、非法设置错误、修正后正常消息、保存确认、新建共享布局预览与取消。最后一项只验证新建预览/取消，不据此扩大已有连接选择、确认或同步全流程的重测范围。
- 本轮 `npm test` 构建+34合成脚本退出0。纯CSS小修未重跑磁盘退出/坚果云/原生iPad，不把既往结果算作新增通过。
- 独立只读审阅无Critical/Important；建议收窄最后一项检查描述，本文已明确新建预览/取消的范围。审阅未重跑原生。

驱动过程记录：首版浏览器适配器与生产Setting重名导致初始化失败，已改名；英文撤销按钮按真实字典纠正为Discard changes；原生16px断言改为容差以容纳15.989px显示舍入。失败日志保留，最终浏览器/原生均退出0。

初版额外注入约1200字符非空sticky消息，在390px窄屏可遮挡撤销按钮；这是非空消息原有布局边界，最终检查明确只验证其几何/程序清空，不以改测试声称超长消息可操作。另列P3待评估，不扩大本轮空状态修复或称其已解决。

证据 `.local/sync-016/g4/ui1-fix/regression-summary.json`、`default.log`、`browser-red-debug.log`、`browser-final.log`、`native-before-final.log`、`native-after.log`。原生旧/新位于 `registry-settings-ui1-before-pokikxqy` / `registry-settings-ui1-after-91kh2bnr`；浏览器最终 `browser-e7q5sq9f/verification.json`。均为私有证据。

## 交付

main与已验收FB2候选相同：`a49a3d2790c4970ec5e1fb46df5e8c052e5e16f3058d104a18a560895a987e13`。新styles SHA-256：`294298902f12f24aedfa43ab5249d0a60974506747e9b5cec178ae3b60790a5f`；旧styles为50e33695…。当前源码、dist、冻结pristine-XTNunV、实际原生运行库与ZIP样式逐字节/摘要匹配，27模块build摘要匹配。

更新包 `.local/sync-016/unified/u5/g4-ui1-update-1q09i9bk/Knowledge-Map-G4-UI1-20261116-Update.zip`，SHA-256 `a713fe93dddf7917c87bf8d582da1c93e86b19c1485750428eeea3fc5fe01196`。白名单仅main.js/manifest.json/styles.css和OPEN-FIRST.md，CRC/逐字节/摘要通过；无data.json、身份、笔记、报告或配置。

按 [复验指南](SYNC_G4_UI1_RETEST.md) 在原G4 PC/iPad仅替换三运行文件，检查空状态滚动→检查范围文字→撤销清空后无残条，回交2报告和两端无文字设置截图。不需重做同步、重新加入或更换远端。iPad实际显示待用户验收，G5–G8与发布门禁保留。
