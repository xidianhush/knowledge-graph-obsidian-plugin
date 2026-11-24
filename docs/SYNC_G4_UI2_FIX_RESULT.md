# UI2 无待办误暂停修复结果

2026-11-17。技术修复和更新包交付后，用户两端“设置先开”明确正常，2报告/2图及19项核验通过，**本场景验收完成**，见 [回执](SYNC_G4_UI2_ACCEPTANCE.md)。不改队列授权、自动发布、明确恢复或共享协议；原25操作接受凭据保持，UI1/FB2/FB5验收保持，版本仍0.0.15独立候选，无commit/push/发布。下文为技术交付历史。

## 根因与修复

队列未armed时保留held/publication-review-required，页面原来直接取result→outcome→queue.lastResult显示。用户PC会话ready且没有工作，也会被历史结果误称暂停；打开图谱后receive noop覆盖outcome才正常。

仅修改 `src/sync/obsidian-sync-settings.mjs` 的deriveSyncStatus：ready且session已初始化、未faulted/closed，无error/saveError、pending/layoutDraft/pendingSave，队列未paused/running/closed时，逐层忽略这一种held/publication-review-required，再取后面的有效源。清除过期原因文字。直接操作异常、真实待办、保存错误、恢复/容量、冲突/缺前驱/损坏和未知held仍可见。没有写入状态或自动armed。

## 验证

- `sync_idle_status_check.mjs` 新8组，加入默认测试。首轮红例确认空闲误报及遮住后续有效错误；独立审阅发现pendingSave边界，再补红例后收紧pendingSave/session.closed。最终默认构建+35脚本退出0。
- 用户UI1 PC原报告只读回放：现得saved/空reason，输入未改变；不改原报告或用户现场。
- 真实Chrome DOM设置流程12组通过，含生产host/session/IndexedDB重建后设置先开，记录/共享文件不变且armed=false；原导入、普通发布、草稿恢复取消/过期/确认、冲突、外部设置及选择中断恢复保留。此为同一浏览器页重开宿主，不称完整浏览器进程重启。
- 实际Windows Obsidian1.15.1专用profile中5项通过：普通新连接/审阅导入1操作，关闭图谱后完整退出，再重开先看设置。身份/连接/完整接受凭据保持，后台仍保留原held结果，但DOM直接saved且无过期原因；pending/draft为空、armed=false，全部共享文件摘要不变。不是Nutstore/iPad验证。
- 独立只读审阅29项补充断言通过；pendingSave（Important）和session.closed（Minor）已修，最终无剩余Critical/Important/Minor。审阅没有重跑原生。

驱动失败保留：浏览器首版直接读取空localState导致异常，改为可选读取；原生读取超长Windows文件路径失败，补长路径前缀；正常Browser.close的连接关闭通知按预期处理。最终收紧后的浏览器/原生均重新完整运行并退出0，不用旧构建结果代替。

证据 `.local/sync-016/g4/ui2-fix/regression-summary.json`、`default-final.log`、`status.json`、`review-red.log`、`browser-guarded.log`、`native-guarded.log`。最终browser-nx73ua95、registry-idle-ui2-qm4r0w26的JSON/截图属于私有本地证据。冻结pristine-fVfMxe、27源码模块、实际原生运行和交付字节摘要已核对。

## 交付与复验

main SHA-256 `7415bc13e073a4832a16606fe81c2cb43fc15fa2c580f6226bd7736ba103c30c`；styles仍为UI1已验收的29429890…。

包 `.local/sync-016/unified/u5/g4-ui2-update-nsap8qgq/Knowledge-Map-G4-UI2-20261117-Update.zip`，SHA-256 `9dd000b6f3cbed4bcc8b416630be6c2961b1b134e321f7d0b505055106099572`。仅main.js/manifest.json/styles.css和指南，CRC/逐字节/摘要通过，无data.json/身份/笔记/报告/凭据。

按 [短复验指南](SYNC_G4_UI2_RETEST.md) 原两端关闭图谱并退出，替换三运行文件；重开先看设置，不先建图或点检查/审阅。无工作时应直接正常，回交2报告及截图；再打开图谱即可，无需重新加入、编辑或同步。UI2用户体验待验收，G5–G8及P3超长消息门禁保留。
