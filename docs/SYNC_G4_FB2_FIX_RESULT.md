# G4-FB2 跨库连接锁修复

2026-11-16。技术修复及独立双PC库交付完成，随后用户按指南复验并明确三项体验顺利，**本场景验收完成**，见 [回执核验](SYNC_G4_FB2_ACCEPTANCE.md)。4报告/3图归档，28项通过。D1/D2/D3不变；G4-FB5原PC/iPad+坚果云25操作验收保持，用户现场未改动。版本仍0.0.15独立候选，无commit/push/tag/Release或日常库升级。下文为技术交付记录。

## 问题与修改

原registry按pluginId长持有全局exclusive Web Lock，App本地存储却按库区分。同一Obsidian profile两个独立库共享锁域，后开库点「新建共享布局」无法弹窗，设置页报 `connections-registry-busy`。此前两个独立profile预检未覆盖这个维度。

`src/sync/connection-registry.mjs` 保留原锁名，改为shared兼容保护，再按已有installation持有exclusive锁。独立新候选库可并行，同库和复制相同身份的库仍互斥；初始化/第二把锁失败释放已取得的锁。存储key、签名、身份、连接格式和共享路径不变，不迁移或清理用户数据。

旧候选持有原exclusive锁，会阻塞新版shared兼容锁，反向也互斥。这保留新旧同库混用的保护；**不承诺旧全局锁版本与新版独立运行**。复验应先关闭全部旧候选，再同时打开包内两个新库。

## 验证

- 先红后绿：原实现两个App本地存储/同一锁管理器用例失败于registry-busy，修复后通过。`scripts/sync_registry_scope_check.mjs` 共6组，含独立库、同库/复制身份、双向旧版互斥、获取失败/坏签名释放、shared/exclusive及FIFO。默认 `npm test` 构建+34脚本退出0。
- 磁盘回归：连接目录6检查/6次退出、统一宿主8检查/8次退出、生命周期23检查/18次退出通过。
- `scripts/sync_registry_browser_check.py`：同context同origin三个页面的真实Web Locks，6组通过，含锁清单、同库拒绝、旧新互斥、单库关闭重开。不使用用户浏览器。
- `scripts/sync_registry_native_check.py`：Windows Obsidian1.15.1、**同profile两个库窗口**。旧候选明确复现registry-busy；修复4组通过：双库预览/取消、各自确认/不同身份与连接、真实锁清单、关闭A宿主不影响B。完整退出自建profile后同时重开2组通过：身份/选择不变、两个shared锁重新取得。真实清单为2个shared旧名锁+2个不同installation的exclusive锁。
- 独立只读代码审阅无剩余Critical/Important；另查同步抛错/异步拒绝/不可用锁释放、坏签名不重写及20独立存储并开。审阅不替代原生或产品验收。

原生驱动增补时修正错误字段断言（原因属于设置页lastError而非host.error）、首次信任插件的renderer重载等待及退出对话框处理竞争。保留失败日志，最终完整对照退出0，无生产代码为测试时序作改动。以上不包含新Nutstore/iPad、断电或并发文档编辑结论。

证据：`.local/sync-016/g4/fb2-fix/regression-summary.json`、`scope.json`、`default.log`、`native-final-stable.log`；最终原生 `registry-legacy-rq844src` / `registry-fixed-55yxicmu` 的verification/cold-verification，浏览器 `browser-sa4tlufx/verification.json`。私有本地证据不加入公开交付包。

## 交付

main SHA-256：`a49a3d2790c4970ec5e1fb46df5e8c052e5e16f3058d104a18a560895a987e13`，来源 `pristine-SX7QkJ`，原生运行与交付字节一致。

`scripts/package_sync_registry.py` 仅允许全新合成库10文件白名单，每库替换START-HERE为本轮指南；ZIP共21文件，CRC/逐字节/哈希通过。包 `.local/sync-016/unified/u5/fb2-delivery-jlxdmf18/Knowledge-Map-G4-FB2-20261116-PC-pair.zip`，441620字节，SHA-256 `560d311d708a792362984be1eaf5ba85449c306d138d314046429e19c2746787`。无profile、身份、接受历史、报告、凭据或私有笔记。

用户已按 [双PC复验指南](SYNC_G4_FB2_RETEST.md) 完成并回交4报告，本场景已验收，无需补做加入、iPad/坚果云或重做G4主流程。黑条、G5–G8及发布门禁独立保留。
