# U1：正常连接发现与设备身份

更新：2026-11-14（Asia/Shanghai）。用户要求执行下一项，本轮范围是 [统一候选计划](SYNC_UNIFIED_CANDIDATE_PLAN.md) 的 U1。此为核心/适配契约与磁盘恢复验证，不是已接入正常 UI 或真机服务的统一候选。

## 实现

`src/sync/connection-catalog.mjs` 提供 `createSyncConnectionCatalog({adapter}).scan()`：

- 只枚举 `Knowledge Map Sync/attempts-v1` 与 `Knowledge Map Sync/v2` 两个受控根，不扫描笔记/凭据或其他探针目录。
- 完整、有界地发现命名空间并检查正文格式/因果，按传输分别返回 `candidates`；v2 为只读，attempts 为可读写传输。空目录不充当可加入的有效历史。
- 发现不是选择，也不是已应用事实。同组并发的合法历史可以被发现，是否可采用及当前图谱几何仍由后续 join/会话验证。
- 未知路径、坏正文、缺前驱、同 ID 异正文、读失败或预算耗尽均整体 held，不返回截断清单冒充完整成功。原件保持，不自行修复/删除。
- 本轮发现预算为总计 32 个命名空间、1024 个物理文件、32 MiB 正文、单文件 2 MiB。跨根/跨库合计计数；这比“每个库各自一个扫描预算”保守，不能据此承诺任意多满载库都可自动发现。后续 UI 需显示具体阻塞而不是自动清理历史。
- 正文读取使用已计入预算的同一份目录清单，末尾复核根/命名空间/ops 的拓扑变化；仍是目录观察，不宣称任意外部竞争下的原子快照。最终接受前继续走原完整 join/publish 扫描门禁。

`src/sync/connection-registry.mjs` 提供 `openSyncConnections({app,pluginId,catalog,locks,...})`：

- 复用正常 `openObsidianSyncDevice`，不依赖测试 suite/库名/marker。U3 应在用户显式启用/设置连接时调用；首次 open 可能创建设备身份，但不会自动选择库或建立接受凭据。
- 连接元数据在 App 本地键 `<plugin-id>:sync-connections-v1`，绑定 installation、历史 vault/transport、当前选择和 pending 选择；采用既有本机 HMAC seal/unseal。它不是 data.json 的共享设置，也不携带新的接受日志/草稿。
- 使用独立 Web Lock 串行保护元数据，保留设备本身的身份/会话锁。所有完整元数据写入均读回；已存在但不匹配/损坏的记录、缺失设备身份、旧连接缺绑定均暂停，不重建身份或猜测传输。
- `preview({action:'new'|'join'})` 产生一次性 token；取消 `discard(token)` 无选择写入。`confirm(token)` 重读目录与设备代次，先持久保存选择意图，再连接设备，再复核目录并提交绑定。空新库只得到本机选择，不创建共享目录/清空操作；未来首条有效布局才可被另一端发现。
- 新 ID 避开目录、既有绑定及旧进度锚；最多分配 8 次。绑定名额与所有旧锚取并集，32 个上限不删除旧锚放行。已存在锚却没有可信传输绑定的目标拒绝猜测；同一 vault 已绑定传输不允许直接改成另一传输。
- 确认后中断在冷开恢复同一意图/ID。输入改变保持 pending，`resume()` 不偷偷换成新目录事实；用 `preview({action:'resume'})` + confirm 显式重审同一选择。若新建 ID 已被其他命名空间占用或设备代次异常，继续暂停，不换 ID/清空旧状态。
- `assertSelected({write:true})` 拒绝 v2 和 pending，读写权限只是连接/传输检查；U3 不能把 selected.origin 或本地绑定当 session.initialized/已接受布局。`close()` 排空并释放本模块锁，不代替生命周期的禁用或普通会话关闭。

既有 `obsidian-host-prototype.mjs` 只新增 `anchoredVaults()` 只读 ID 枚举；设备记录格式、密钥、旧日志与锚不迁移。由于这个模块已进默认恢复构建，默认 main 会随新增方法重新构建；新 catalog/registry 尚未挂接默认产品的发布入口。

## 本轮验证

- `node scripts/sync_connection_catalog_check.mjs`：最终 **25 项**。覆盖两传输、取消/复制配置/缺绑定/旧锚、预算与扫描变化、忙会话/身份、签名元数据、读写失败/不确定确认及冷开待审。缺模块、选择后目录变动、列举增长导致读到 1400 文件、旧锚误作为新 ID、并集预算、非 Error 读异常均观察失败后修复/回归。
- `node scripts/sync_connection_catalog_disk_check.mjs`：**6 次真实子进程退出**，边界为选择意图、设备连接、元数据提交，以及相应 App 存储完整写入后的未返回点。冷开不分配新 ID，既有设备密钥、旧锚及真实签名会话日志逐文件摘要保持；未创建任何共享文件。证据 `.local/sync-016/unified/u1/disk-HuCV48/verification.json`，最终回归另见同目录汇总。
- App 存储采用文件后端替身，Web Locks 为注入契约；旧私有会话后端为实际硬链接不覆盖文件存储。进程退出不是断电验证，不证明真实 Obsidian App API、iPad 或服务保证。
- 独立源码审阅无可复现 Critical/Important；其提示的冷开输入变化、App 写入失败/读回不一致、目录读失败已补检查。适配器 reject null/字符串时原错误处理会二次抛异常，已修为返回 held 并回归。没有待延期的小项。

默认与专项回归的最终命令、退出码、脚本数和源摘要记录在 `.local/sync-016/unified/u1/regression-summary.json`；不要把早期中间脚本数作为最终结果。默认脚本集增加 connection_catalog 检查，磁盘单独入口为 `npm run test:sync-connections-disk`。

## 未完成范围与下一项

U1 还没有正常设置页或真机流程；旧连接/锚缺可信绑定、新建 ID 被外部占用或不支持的设备代次保持阻塞，显式迁移/故障 UI 留 U3/U4，不宣称本轮已有完整故障恢复产品。同步正文的删除/覆盖风险继续按 D1；有连接元数据不保证文件已上传、笔记已到或布局已应用。

下一执行项为 U2 自动发布队列，后续 U3–U5 才把本模块挂入正常宿主并做独立原生/用户验证。未改版本、README、日常库或旧 Resolve/Onboard 现场，未 commit/push/发布，也不要求用户此时再操作 iPad。
