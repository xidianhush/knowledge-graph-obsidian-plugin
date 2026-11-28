# SYNC-A3 第四阶段：宿主保存门禁与设备本地凭据

更新：2026-11-08（Asia/Shanghai）。这是未打包的宿主适配原型，**A3 整体仍进行中**。当前任务见 [TODO](../TODO.md)，前三阶段见 [磁盘恢复](SYNC_A3_PERSISTENCE_PROTOTYPE.md)、[保存协调](SYNC_A3_COORDINATION_PROTOTYPE.md)、[首次加入](SYNC_A3_JOIN_PROTOTYPE.md)。本轮不改正式保存路径或 v2 共享正文。

## 源码与复跑

`src/sync/obsidian-host-prototype.mjs` 提供三个独立接口：

- `openObsidianSyncDevice({app,pluginId,locks,cryptoProvider})`：使用宿主 App 本地存储，保留本机 installation、随机签名密钥、连接状态与日志进度锚。对外 state 不返回密钥；不从 data.json 读取设备、连接或接受标记。
- `createDeviceBoundPrivateStore({store,device,vault})`：把设备/逻辑库/文件名/全文绑定到 HMAC-SHA256；底层仍须提供完整文件不覆盖安装、限额读取和排他租约。它没有凭空给普通 Vault write 增加原子性。
- `createObsidianSettingsDocument({plugin,configurationIsLocal})`：只访问本插件自己的配置路径，通过 DataAdapter.process 做合作写者的条件修改，并检测外部事件和读回结果。默认不允许写入。

`npm test` 先构建再执行 **18 个合成脚本**；新 `scripts/sync_host_check.mjs` **40 项**。独立真实磁盘脚本 `npm run test:sync-host-disk`（`node scripts/sync_host_disk_check.mjs`）**12 项**，含 **6 次真实子进程退出**；需要硬链接/子进程权限，数据只写 `.local/sync-016/a3/host/`。另两套磁盘回归分别为 `npm run test:sync-disk` / `npm run test:sync-join`。宿主 App、本地存储和 Web Locks 使用契约测试替身；真实磁盘脚本只把底层存储与进程中断换成真实 Node 实现，不把替身说成真机。

## API 核对与能力门禁

本轮核对 [Obsidian 官方 API 定义](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts)：App.loadLocalStorage/saveLocalStorage 是按库区分的 localStorage 接口，自 1.8.7 提供；Plugin.onExternalSettingsChange 自 1.5.7 提供；saveData 没有条件版本参数。DataAdapter.process 文档提供原子读改写，但没有承诺未参与该接口的云同步/操作系统写者也在同一事务内。

现有最低宿主仍为 1.6.7，本轮不提高 manifest，也不假装旧宿主具备设备 API。原型在缺少 App 本地 API、安全随机/WebCrypto 或 Web Locks 时停止；不降级为同步配置里的 ID、时间戳租约、单进程变量或不安全随机数。Web Locks 可用性和同库窗口覆盖范围仍需 Windows/iPad 原生验证。

## 本机来源、复制配置和旧副本

本地键为 `knowledge-graph-smoke:sync-v2:device`，只经宿主 App 本地存储读写，包含一个 128 位 installation 和独立 256 位 HMAC 密钥。初始化/生命周期改变用身份锁串行化，写入后精确读回；已有损坏/未知记录不会被当成空记录重建。连接和密钥不写到插件 data.json、普通共享目录或报告。

私有文件封装使用 `KM-SYNC-PRIVATE-1` 头、installation、vault、相对文件名、MAC 与原正文。它是来源/完整性校验，**不是加密**；备份仍包含原插件数据，不能作为公开材料。共享操作正文仍是原 v2 JSON，没有签名头、本机标记或导入备份。底层目录必须由可信的本机 installation/vault 选择，不能从同步来的配置指定。

复制 data.json、其他设备的整个私有目录，甚至只抄相同 installation 而没有本机密钥，都不能建立本机已接受凭据。篡改正文、移动文件名、换逻辑库和无签名文件均拒绝，保留原文件；不会自动给旧的未绑定 A3 测试目录补签或认领。

仅验证签名不能发现“整段日志被换成自己的旧有效副本”。因此本机 localStorage 另外记录每个逻辑库的最高事件序号及完整封装摘要。完成事件安装并精确读回后才更新本机锚；锚写失败不报告完成。获取私有租约时先检查锚对应文件存在且逐字节摘要一致，较旧的完整前缀也会停在 private-rollback。中断后多出一条已经完整安装但尚未写锚的有效事件，可在认证读取时前移锚，不回退锚；后续完整哈希链仍由原 A3 会话验证。损坏输入可能导致保守暂停，不能借暂停回退旧接受状态。

本机锚最多保留 **32 个逻辑库**、每库事件序号最多 **4096**；触顶不淘汰旧锚、不清空私有日志。它只是轻量进度引用，完整快照/备份/草稿仍在私有日志中，没有搬入 localStorage。整份宿主 localStorage 连同配置一起复制/回滚，或本机存储完全丢失，超出此来源证明范围；不得从旧 data.json 自动恢复接受凭据。真实设备清理/恢复体验及持久性还需验证。

## 连接恢复与排他

连接状态只保存逻辑库与 enabled。重复连接同一库幂等，重新打开设备接口保留禁用状态；不会仅因发现共享文件或配置缓存而开启。活动会话持有设备锁，再持有底层私有存储租约；另一会话、禁用或切换均暂停。调用方必须先关闭/排空会话，再禁用；切换到另一逻辑库须先禁用，原文件、备份和各库进度锚不删除。重新打开同一连接后，接受事实仍从认证的 A3 日志恢复，而非连接标记。

另一句柄改动本地记录、密钥被删除/替换或连接来源变化，会使旧句柄失效。底层租约失败会释放设备锁，重试不永久占锁。这里实现的是持久状态门禁和资源顺序，尚无关闭/改选/取消导入/恢复备份的完整产品界面，也不假装撤销已发布操作。

## 保存范围与仍未解决的外部写入

配置路径固定从可信 host 的 configDir 与本插件 ID 构造；不读取笔记或其他插件配置。读前检查文件大小，读后检查 JSON/预算；缺文件、坏 JSON、非对象根、路径越界均停止，**没有 saveData/write 覆盖降级或隐式建空文件**。

版本 token 是该文档实例发出的不透明令牌，绑定原始文本和外部变更 epoch。process 回调同步比较当前全文/token，再作修改；保存后重新读取确认。宿主需在 onExternalSettingsChange 回调一进入就调用 notifyExternalChange，之后才安排队列重读，不能等重读排到队尾后再失效令牌。接入正式插件属于后续任务，本轮没有接回调。

只有 `configurationIsLocal === true` 才开放写入；它必须来自宿主侧明确的本机配置条件，不能从刚同步来的 data.json 自证。未排除 `.obsidian` 外部同步写者时，返回不可重试的 `external-writer-not-excluded`；协调器保留 pending、设置草稿与 UI 意图，明确暂停，不把它误报成普通文件竞态并反复写入。

该门禁是有意保留的功能缺口：**本轮没有解决任意工具同时写 data.json 的跨工具 CAS，也没有提供“同步 .obsidian 仍可无条件安全回写”的方案**。即使一次读回/通知检查通过，也不足以证明从未发生未被观察到的 OS 写入。需在正式接入前选定数据投影/本机保存策略并验证；不以取消护栏放行。当前用户 A1 没有核实 `.obsidian` 是否同步，本轮不替用户推定它未同步。

保存协调器本身继续以私有接受凭据作为布局权威，只合并设置、UI 和布局缓存各自拥有的字段。新测试包含 fresh merge、外部同字段冲突、过程内通知、写后替换、最终读回期间通知、失败保留与冷恢复。原有生产路径/设置体验未被本原型替换。

## 本轮结果与下一步

新增 **40 + 12 = 52 项**，磁盘中的 **6 次进程退出已包含其中**。默认构建 + 18 脚本通过（原 A2 116 + 协调 29 + 新宿主 40）；原磁盘 65 / 加入 53 项通过，连同新宿主磁盘 12 项，同步细项合计 **315**，实际退出共 **23 + 19 + 6 = 48 次**。最初一个测试访问了已经失效的旧设备句柄，后按实际失效契约修正测试；补进度锚后冲突文件的预期也改为拒绝，不放松来源验证。新增磁盘脚本首次因沙箱拒绝硬链接退出，按工具审批在沙箱外复跑通过。

证据 `.local/sync-016/a3/host/{host-check,host-disk-check,regression-summary}.json` / `regression.log`；原磁盘结果仍在 `external-persistence-check.json` / `join/join-check.json`。main.js 416,150 B / SHA-256 `8801c3a3e5c2d96fcd6d230e8b703eac8472ac815e677e915c81c23249411391`、版本 0.0.15 保持。A2 资源规模没有重跑；没有新原生、iPad、Nutstore、断电或产品验收结论。

下一步仍在 A3：落实 Windows/iPad 底层完整文件安装/本机存储能力及真实原生探针，解决外部配置写入下的保存策略，补齐关闭/改选/取消/备份恢复与私有日志规模触顶。之后 A4 接真实事件、视图和交互；A5 产品体验与 A6 真链路/资源回归另行验证。正式包、日常库、A1 库和已验收素材均未改。
