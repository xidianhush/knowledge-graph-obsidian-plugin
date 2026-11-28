# G6 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans in this session, task by task. Preserve this ledger and all pre-existing work.

**Goal:** 可校验完整备份、准确容量提示与可恢复的新逻辑库轮换。
**Architecture:** 复用已认证session、lifecycle导出、registry选择与首次加入；控制意图先持久，新连接先提交，新根后写。目标扫描隔离各命名空间正文预算。
**Tech Stack:** JavaScript modules / Obsidian Vault / IndexedDB / Web Locks。
**Spec:** [SYNC_G6_PLAN.md](SYNC_G6_PLAN.md)，用户2026-11-17明确选择推荐路线。

## Global Constraints

- 当前工作区原位开发；独立新合成测试，不改G4/G5/日常库；不读Utilities/API Key.md。
- 不升版本，不commit/push/发布；旧历史原位保留。
- 共享1024物理文件/2MiB单份/32MiB正文；私有软64MiB/4096文件/3968事件、硬144MiB/8192文件/4096事件不变。
- 用户体验和iPad验收留用户；未执行的测试不写通过。

## Review Focus

- 私有软暂停有草稿时仍能备份并明确选择草稿新根。
- 备份缺分片/异文/清单被改时拒绝轮换。
- 共享旧库触顶不阻断目标新库；未知根拓扑仍失败关闭。
- 选择/写根/接受提交中断后沿原target/root ID明确审阅恢复。
- 旧离线端返回仍写旧库，不污染新库，pending/冲突拒绝轮换。

## Tasks

### 1. 完整备份和预算

Files: `src/sync/recovery-export.mjs` (包校验及Vault目的地), `connection-lifecycle-prototype.mjs`, `obsidian-unified-host.mjs`, `scripts/sync_g6_check.mjs`。
Interface: `host.exportRecovery({destination,id})`, `verifyRecoveryExport({source,id})`; `host.diagnostics().privateBudget`。

- [x] 写红例：暂停可导出原备份/accepted/草稿/pending；改字节/部分失败无完成；私有后端不新增文件。
- [x] 实现固定正文任务、逐分片SHA/长度回读、manifest最后写、目标路径限制。
- [x] 运行 `node scripts/sync_g6_check.mjs` 验证绿例。

### 2. 有界目标扫描

Files: `connection-catalog.mjs`, `connection-registry.mjs`, `scripts/sync_g6_check.mjs`。
Interface: `catalog.scan({target:{vault,transport}})`；`registry.preview({action:'new',vault})`允许控制意图固定ID；无target保留现有全局发现护栏并明确受限。

- [x] 写红例：旧库满+新库根仍可明确选择，新目标损坏/根拓扑非法拒绝。
- [x] 选择/恢复使用目标正文及全根拓扑fingerprint；每命名空间保持原护栏。
- [x] 运行专项及catalog/registry既有合成回归。

### 3. 受控轮换

Files: `src/sync/rotation-control.mjs` (签名小控制意图), `obsidian-unified-host.mjs`, `scripts/sync_g6_check.mjs`。
Interface: `host.previewRotation({destination,id,choice})`, `host.confirmRotation(token)`, `host.previewRotationResume({destination})`；取消复用 `discardReview`。

- [x] 写红例：最新accepted/基线匹配草稿新根、pending/冲突拒绝、取消/过期、旧source回归、各停止点冷开稳定ID及旧库不变。
- [x] 备份验证后控制域保存稳定target/root ID与备份摘要；先disable再registry选择，提交选择后才用稳定ID首次导入新根；恢复须重新审阅。
- [x] 校验目标只含本次根；完成前不启动自动队列。旧库不新增事件或清草稿；新库设置来自已导出有效配置。
- [x] 运行专项；旧端返回经两端合成核对，三角色/设备体验交用户指南，不将其冒称三真机已验。

### 4. 正常UI和集成

Files: `obsidian-sync-settings.mjs`, `obsidian-unified-entry.js`, `i18n.sync.js`, browser/native/packaging G6 scripts。

- [x] 红例验证正常备份/轮换按钮、容量具体项及恢复/取消入口。
- [x] 接入明确目标备份目录、快照选择、old/new ID/风险提示和完成状态。
- [x] 默认构建/受影响磁盘/浏览器IndexedDB/新Windows profile检查；输出全新G6目录。
- [x] 生成新PC/iPad白名单包与分组指南；技术结果/更新TODO；设备体验标待用户验收。

## Ledger

- 2026-11-17 用户选择推荐路线；路线批准与体验验收分开。
- Ruling: 使用当前工作区，不创建旧HEAD worktree，遵从用户保全现有实现的指示。
- Ruling: 本机按计划直接执行；不再次询问已授权路线，技术实现细节由Codex负责。
- Ruling: 新根只在registry选择提交后写入，从顺序上避免origin=new自占用。恢复仍校验控制意图、稳定ID/正文和全部目标库存。
- Tasks 1–3核心及正常UI已实现，`sync_g6_check`25组红转绿，失败及后续驱动错误保留在新G6目录。具体成功摘要路径见G6结果，不重写旧G5证据。
- 默认构建+37脚本、G6 25组、浏览器22组、磁盘36次退出、Windows最终1024不同操作包7组与白名单包核验通过；源码与冻结/原生/包main436fb462…一致。详见SYNC_G6_RESULT，设备体验待用户验收。
- Ruling: 尚未切换的控制意图提供明确取消后重开旧会话，防库存变化将用户锁住；已切换目标仍只按原ID恢复。
- Ruling: 添加publication-abandoned签名日志事件，只针对已完整备份、普通version1且从无attempt-path/共享正文的pending；不放弃已写或不确定发布，原正文与草稿均保留。新事件旧候选回退须留G7验证。
- Ruling: 所有全套/历史脚本在 `.local/sync-016/g6/workspace-wmbqNx` 当前源码白名单副本执行，避免旧证据固定路径被覆写；副本包括未跟踪当前源码，不从HEAD检出。此目录及所有失败材料保留，不执行技能建议的清理/commit，遵从用户保全指示。
