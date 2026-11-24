# SYNC-UX 设计与实施说明：同步易用性改造（默认图谱 + 自动编排 + 精简设置）

日期：2026-11-23。任务组：`SYNC-UX-EASY-SETUP`（TODO.md）。计划原文：[SYNC_UX_EASY_SETUP_PLAN.md](SYNC_UX_EASY_SETUP_PLAN.md)。
实施副本：`.agents/worktrees/sync-ux-easy-setup`，base `1c2552681cbe9efcce0cb1f39eaf1fdb9824075c` + 主工作区未提交加入修复（184 文件白名单复制，SHA 核对）。

## 1. 架构总览

保留现有分层：`attempts-v1` 操作历史（protocol2 / layoutSchema3）、设备绑定私有存储与账本、`createDurableSyncSession` 的备份/指纹/门禁、`connection-registry` 选择事务、统一宿主串行队列。新增两层：

1. **初始化层（A1）** `src/sync/default-layout-bootstrap.mjs` + `src/sync/connection-catalog.mjs` 扩展：让"尚无布局操作的默认图谱"可被发现、可被选择，不伪造布局操作。
2. **编排层（A2）** `src/sync/easy-sync-setup.mjs` + 宿主 `startEasySync()/resumeEasySync()/easySyncState()`：把"开启→构图→准备默认→扫描→选择→加入"编排成可重入状态机，全部复用现有事务实现。

UI（A3）只消费 `easySyncState()` 与现有审阅接口，不新增接受通道。

## 2. 受影响的协议条款（docs/SYNC_PROTOCOL_V2.md）

本计划有意调整以下条款；A4 落地修订并保留变更说明（修订前原文要点）：

| 位置 | 原条款 | 调整 |
| --- | --- | --- |
| §1（line 11） | vault-id、operation-id、attempt-id 均为 Web Crypto 16 字节随机 32 位 hex | 增加唯一例外：默认图谱 vault-id 固定为 `SHA-256("KM-SYNC-DEFAULT-LAYOUT-1")` 前 32 位 = `71e90242bea19488f2a16c60f78fcabc`。operation-id / attempt-id 仍随机；高级新建其他图谱仍随机 vault-id |
| §1（line 15） | 没有候选时明确新建；仅有空布局保持本机新建待发布，另一端等待首条有效记录才能发现；不发布清空操作充当标记 | 单候选自动选择、无候选自动准备默认图谱；新增 `bootstrap-v1` 初始化记录使空布局可发现。仍不发布 reset/清空/虚假布局操作 |
| §1（line 17） | 两端同时新建可能出现两个 vault-id，须明确选择/迁移 | 默认场景因固定命名空间不再产生双随机 ID；本条继续约束高级随机新建 |
| §4（line 49） | 有不同旧布局必须明确选择；首次加入手动确认 | 用户开启授权下：空本机→自动采用共享；共享空+本机有手动布局→自动导入一次；语义相同→自动采用共享。不同布局、共享冲突仍明确选择。备份/独立根导入/凭据防重复导入不变 |
| §6（line 78） | 首次加入、冲突解决、关闭期间草稿恢复保留明确确认 | 首次加入的无歧义分支由"开启布局同步"授权覆盖；冲突解决与关闭期间草稿恢复仍明确确认 |

不变的关键契约：操作根对象字段集合、parents 只取已接受头、并发同组全保留、远端候选完整校验、共享/私有预算、outbox 先可靠保存再写尝试路径、写后读回、独立尝试路径非原子排他（F1/F2/F3 门禁结论）、本机凭据不进共享正文。

## 3. A1：默认图谱发现与初始化

### 3.1 `src/sync/default-layout-bootstrap.mjs`

- `DEFAULT_LAYOUT_VAULT_ID = '71e90242bea19488f2a16c60f78fcabc'`；模块内用 `SHA-256("KM-SYNC-DEFAULT-LAYOUT-1")` 前 32 位推导并与常量核对（测试断言一致）。
- 固定正文（唯一合法内容）：`{"version":1,"kind":"default-layout","transport":"attempts-v1","vault":"71e90242bea19488f2a16c60f78fcabc"}`。规范编码复用 `cloneBoundedSyncJson`（causal-prototype.mjs）+ `JSON.stringify`，摘要复用 `syncContentHash`（persistence-prototype.mjs:16）。
- 目录 `Knowledge Map Sync/bootstrap-v1/<default-id>/`；文件名 `<sha256>.<attempt-id>.json`（两段；attempt-id 用 `randomSyncOperationId`，author-prototype.mjs:19）。与 ops 三段名严格区分。
- `scan()`：沿用 attempt-history 的保护模式——目录范围校验、文件数/单文件/总字节预算（计入 catalog 总预算）、`readBinary` 长度与 stat 一致、文件名摘要与正文摘要一致；残片若是同摘要完整文件的字节前缀则容忍，否则阻塞；未知版本/未知字段/损坏正文→held（不当作"没有图谱"）。同正文多文件=一个初始化事实（去重），不是冲突。
- `ensure({canContinue})`：已存在有效记录→幂等返回；否则 allocate 独立尝试路径（最多 8 次随机 attempt-id 避让）→写入→读回校验（字节+摘要）→返回事实。写入前不创建任何共享文件的前提由编排层保证（仅用户开启后调用）。
- 初始化记录只证明"默认图谱存在"，不证明布局已接受或对端已收到；不承担恢复凭据职责（可由固定规则重建）。

### 3.2 `src/sync/connection-catalog.mjs` 扩展

- 新增第三根 `Knowledge Map Sync/bootstrap-v1`：只允许 `DEFAULT_LAYOUT_VAULT_ID` 命名空间；根文件/未知命名空间/命名空间内子目录→held（`catalog-bootstrap-scope` 等）。
- 有效初始化记录且该 vault 在 attempts-v1 无有效操作 → 追加候选 `{vault:DEFAULT_ID, transport:'attempts-v1', access:'read-write', operations:0, bootstrapOnly:true}`；已有历史候选补 `bootstrapOnly:false`。
- bootstrap 文件计入 files/bytes 总预算与 inventory/fingerprint（拓扑变化触发既有 scan-changed 复核）；命名空间按 vault+transport 去重计入 32 预算。
- 损坏 bootstrap 输入→整个扫描 held（沿用"暂停自动流程"原则），不降级为无图谱。

### 3.3 注册与首次加入

- `connection-registry.mjs` 选择语义不变：join 要求 `scan.candidates` 存在该 vault+transport——bootstrapOnly 候选满足；"发现/选择"不等于"已接受"（接受仍由 session 收据决定）。
- 空历史首次加入复用 `session.join`：本机空→`choice='shared'`（persistence-prototype.mjs:658 `reason='empty'`，共享空也可加入，不生成操作）；本机有手动布局+共享空→`choice='import'`（备份+独立根导入一次）；语义相同→`choice='shared'`+`expectedSharedFingerprint`（line 659 `same-layout` 路径）；不同→held `join-choice-required` 交 UI；本机旧布局校验问题→`current` 投影审阅路径。全部走现有备份、指纹复核、epoch 复核与检查点（after-join-backup / after-join-choice / before-join-adopt / after-join-adopt）。

## 4. A2：自动设置编排

### 4.1 授权与进度存储

- 设备绑定本机私有状态（sealed localStorage，模式同 connection-registry：`openObsidianSyncDevice` + `device.seal` + 写后读回），key `pluginId+':easy-sync-v1'`。不放 `data.json`（可同步，不可作可信授权）。
- 记录：`{version:1, installation, authorized:true, authorizedAt 阶段进度, phase, target:{vault,transport}|null, ...}`；授权只来自 `startEasySync()`（用户开关动作）。`resumeEasySync()` 只在已有授权时继续，不扩张授权。
- 私有身份/账本/进度缺失→恢复流程（`recovery-required`），不生成替代身份。

### 4.2 状态机（phase）

`idle(未授权) → preparing(构图/准备默认) → awaiting-transfer(本机就绪，等外部传输) → selecting(自动选择事务) → joining(自动加入事务) → active(已加入，正常自动运行) / review-required(多图谱选择/布局分歧/只读v2/旧布局问题) / paused(损坏输入/恢复/错误)`。

分支顺序（计划 §2）：已有本机连接→沿用（升级不触发重新加入/切换/发布）；单份可写共享→自动选择；无共享→ensure bootstrap→重扫→连接；多份→一次选择界面；仅 v2→只读说明+现有审阅路径；加入分支按 §3.3。连接后收到其他命名空间→保留当前连接+提示审阅入口，不静默切换。

### 4.3 宿主接入与队列纪律

- 宿主新增 `startEasySync()` / `resumeEasySync()` / `easySyncState()`，均 `enqueue` 一次；任务内只调内部实现（registry 自有队列可嵌套；不得在宿主任务内 await 宿主公开入队方法——死锁）。
- 首次无图谱复用现有 `openGraph('vault', true)` 构图入口（entry 层回调注入）；有合适图谱复用。
- 唤醒源：开启、插件重开（构造时若有授权记录则 resume）、graphReady、共享目录文件事件（去抖合并、关闭后取消、等待状态不自循环）、窗口恢复、编辑结束。无高频轮询。
- 每阶段可重入：重复点击/重复事件/重开不重复导入或重分配目标（依赖 registry pending 恢复 + session already-joined 复核 + bootstrap ensure 幂等）。
- 重要持久化步骤设退出检查点（授权落盘、bootstrap 写入、选择 intent/connect/commit、join 各既有检查点、首次发布），磁盘测试注入中断验证恢复与幂等。
- 关闭同步→现有 `disable()` 立即阻止共享读写、保留本地工作；再开启→`resumeEasySync()` 不自动发布关闭期间草稿（仍走待发布审阅）。

## 5. A3：界面

普通区=开关+状态一句+至多一个主要操作+折叠"高级与恢复"；状态文案按计划 §3 清单（不得显示未经证实的"两端已同步完成"）。技术原因码放详情。先交浏览器 fixture 可点击草图（未开启/准备完成/正常使用/冲突四状态）供用户确认，正式接入以确认结果为准。i18n 中英文同步新增（src/i18n.sync.js）。

## 6. 版本与发布

- 用户指示：版本号可能需修改，Android 适配后移 0.0.19。**已于 2026-11-24 更新** README.md、docs/INSTALL.md、docs/SYNC_GUIDE.md 的 Android 表述为 0.0.19，并在 docs/MOBILE_PLAN.md 加 2026-11-24 排期更新（保留 11-08 历史行）；历史 Release Notes/HANDOFF/G* 指南作为当时记录不改写。候选不占用正式版本号，最终版本号与发布以用户验收对齐为准。
- 候选包显示明确"同步体验候选"名称，不占用正式版本号；不 commit/push、不移 tag、不发 Release、不升级日常库（除非另获明确授权）。

## 7. 测试注册

新增 `scripts/sync_bootstrap_check.mjs`（纯逻辑+磁盘：双设备隔离/并发/重复到达/残片/重开）、`scripts/sync_easy_setup_check.mjs`（编排分支/中断/关闭再开启/旧连接升级），注册进 `scripts/test.mjs` 与 package.json scripts。既有磁盘专项全部重跑。浏览器 fixture 检查沿用 `scripts/sync_settings_browser_check.py`。Windows 原生与 Windows↔iPadOS+坚果云实测在候选交付后由用户执行，未执行明确标注。