# U3：统一宿主与本地配置保存

更新：2026-11-14（Asia/Shanghai）。本轮按用户要求完成 [统一候选计划](SYNC_UNIFIED_CANDIDATE_PLAN.md) 的 U3 宿主与独立入口技术工作。U4 设置/状态/冲突 UI、U5 原生预检和用户包尚待执行；此处不代替用户体验验收或正式发布授权。

## 实现与边界

`src/sync/obsidian-unified-host.mjs` 将 U1 目录/签名连接、正常设备身份、签名私有账本、容量准入、配置投影、coordinator、lifecycle 和 U2 队列组合为同一宿主。可注入后端与图谱/store，生产候选使用真实 App、Web Locks、IndexedDB 和 Vault adapter；没有 suite、场景标记或脚本提供的接受凭据。

- 新库启动不创建设备或连接，不做 `explicit-empty`。只有显式 `previewSelection/confirmSelection` 才新建/选择；已有签名选择可冷开恢复。选择不代表已加入；`previewJoin/confirmJoin` 以一次性 token、当前源布局、图谱代次及完整共享摘要复核。取消不接受、不发布，也不锁死原本地编辑。未加入时关闭仍可本地工作。
- 成功加入后才打开私有配置投影/草稿协调及接收/发布。初次有效配置取确认时重新读取的当前文档，语言、UI 和未知字段不用 join 备份回写。`joinEvidence()` 只读返回原 join backup/proof；备份和凭据不混用。已有账本/设备不迁移、不删除；缺身份/进度锚或恢复失败保持 recovery-required。
- 普通布局保存走实际 quota 和 coordinator，成功保存草稿后通知 U2；私有触顶拒绝保存成功，旧接受和原件保留。新 pending 与较新草稿仍按 U2 规则分开。`saveSettings/saveUi` 使用同一私有有效文档，保留接受布局、布局草稿、未知字段及其他 UI。默认产品未接新的自动发布入口。
- 外部配置回调首先同步推进 external epoch，再读取当前 `data.json` 为输入；设置可无冲突三方合并，有冲突保留待审，不接受外来 layoutOverrides，也不向外部文件自动回写私有接受。应用实际设置变化同时失效旧图谱 epoch、取消旧交互并请求重建，防止新配置下继续使用旧模型。设置/UI 仍是本地数据。
- 关闭先停止/排空 U2，再关闭生命周期的 coordinator/projection/session/backend；disabled 下重开同一签名本地会话，草稿可可靠保存。再启用开新队列，恢复工作需明确确认；新保存不能顺带授权旧草稿。改选需先 disable，保留原逻辑库的账本、密钥和锚。
- 单一当前图谱才允许接收/发布；未打开、隐藏页面/标签、多视图、过期图谱或编辑争用均持有等待。前台、焦点、活动标签、图谱就绪/关闭触发非确认唤醒；本次已授权的普通工作可继续，恢复工作仍待审。加入已经可靠完成而图谱随后变化时只延后展示，队列仍建立，不因展示变化失去后续发布能力。
- 旧 v2 选择只读：允许明确采用/接收，不提供导入或自动发布队列；attempts-v1 才有 U2 发布能力。普通发布不替代首次导入、冲突解决或关闭期间恢复的确认。

`src/sync/obsidian-unified-entry.js` 是复用真实 Knowledge Map BasePlugin、图谱/store、设置验证和 receiver 的独立入口。`buildKnowledgeMapUnifiedCandidate(root,graphHostBundle)` 在 `scripts/build_sync_a3_probe.mjs` 中产生 version 6 候选构建。`src/adapters/obsidian-native.js` 仅新增可选 `syncSaveUi` 路由；候选 HUD 走宿主，默认插件保持原保存路径。

未加入的普通本地配置仍需保存：已有 `data.json` 使用 adapter.process 核对来自宿主同一次读取的 expected 内容，并读回；期间到达的外部文件不被旧目标覆盖。首次无文件时沿用普通 saveData 创建并读回。process 是适配器内协作核对，首次创建也不是任意 OS/同步写者下的原子 CAS；从未观察到的竞争写入可能无法恢复，D1 限制保持。加入后外部文件仅为输入，不以“排除配置同步”说明代替防护。

## 本轮验证

- `sync_unified_host_check`：**15 项**，使用真实目录/registry、签名设备/session、quota、配置投影、coordinator、lifecycle 和队列；注入 App/锁/存储契约。覆盖未选择/取消、未加入关闭、本地继续编辑、当前配置、源变化、自动发布、关闭/再启用、冷开、身份丢失、容量拒绝、设置/UI 保留草稿、外部冲突、无图谱/编辑争用、加入后图谱变化、前台恢复、旧 v2 只读和 join 原件/凭据。
- `sync_unified_candidate_check`：**9 组**入口/构建契约，真实全量候选编译及 VM 中的入口接线，包含设置/UI、条件写竞争、HUD 实际钩子、全新无配置文件、前台事件、多个视图和设置变化失效图谱。VM 使用替身 BasePlugin/App，不是 Obsidian 原生运行。
- `npm run test:sync-unified-disk`：**8 次真实进程退出**。真实文件后端的签名 registry、设备/锚及 session 贯穿草稿、stage、attempt-path、共享半写、共享完整未接受、accept、关闭意图和账本排空后中断。冷开保持 installation/密钥/逻辑库和接受集合，未自动发布；关闭恢复为同库本地会话，明确确认后完成同一历史，不生成重复导入。最终磁盘原件见回归摘要的 out 路径。
- 最终 `npm test`：构建 + **27 个合成脚本**，退出码 0。本轮未重复原生、坚果云或既有 OnboardEmpty/Both 用户测试；旧证据保留原范围。
- 独立审阅无剩余 Critical/Important。其指出的新文件保存、加入后图谱变化漏建队列、前台恢复缺唤醒均已补失败测试并修正；另补当前源条件写、旧 v2 接收、设置变化失效图谱。最终扩展的测试数以本页和回归摘要为准，审阅者独立复跑时为 14 + 8 项。

证据、日志、候选编译产物及源/默认构建摘要：`.local/sync-016/unified/u3/regression-summary.json`。磁盘首次沙箱硬链接 EPERM 不计通过，已获提权后完成最终检查。App 持久化和 Web Locks 为契约适配器；真实 Node 文件/进程退出不证明原生 IndexedDB、Nutstore/iPad、OS quota、断电或近限额性能。

## 后续

U3 宿主/入口技术完成；U4 仍需正常设置页、清楚的状态文案、外部配置冲突待审和恢复入口，并复用已有导入/冲突预览。U5 才做两套 Windows 原生预检与 PC/iPad 用户交付。容量导出/轮换、实际旧版回退和发布授权仍为独立门禁。

本轮没有安装/升级日常库、改旧测试现场、README、版本或正式发布入口，未 commit/push/发布。正式版本仍为 0.0.15；用户暂时无需操作 PC/iPad。
