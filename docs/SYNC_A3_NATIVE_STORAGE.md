# SYNC-A3 第五阶段：Windows / iPad 原生私有存储验证通过

更新：2026-11-08（Asia/Shanghai）。A3 整体仍进行中；当前状态见 [TODO](../TODO.md)。上一阶段是 [宿主门禁/设备凭据](SYNC_A3_HOST_PROTOTYPE.md)。本阶段实现真实 Web 平台私有存储后端和独立原生探针，Windows 与用户 iPad 报告均完成 18 项检查；iPad copy 行为不满足不覆盖发布契约，详见下文。**尚未接正式插件，不是正式布局同步验收**。

## 已实现的私有后端

`src/sync/indexeddb-store-prototype.mjs` 提供 `openIndexedDbSyncStore`，满足现有 A3 的 read/create/list/acquire 接口。使用原生 IndexedDB、IDBKeyRange 和 Web Locks，没有 Node、网络或 Vault 文件写入。数据库固定 `knowledge-map-sync-v2-private`，键前缀来自可信本机 installation / 已选逻辑库；对同源其他逻辑库保持隔离，不从共享配置指定任意存储目标。

新增记录用 readwrite 事务的 add，拒绝覆盖同名值；create 只在 transaction complete 后报告成功，不在 request success 时提前确认。约束冲突返回 exists，其余中止返回错误；显式中止不留部分记录。申请 strict durability，报告实际返回的模式；缺少该选项时明确记录默认模式，不据此宣称抗断电。单条限 8 MiB + 封装余量、单次枚举最多 4096，错误不返回已读子集。完整私有日志/备份的总量门禁仍未完成，不能据这些单项上限宣称无限容量。

该后端与上一阶段 `createDeviceBoundPrivateStore` 组合：外层仍做 HMAC、设备来源、最高事件进度锚和连接租约，底层换成浏览器事务，不再要求移动端实现 Node 硬链接。版本改变关闭旧连接，活动租约不得直接关闭；没有删除数据库、自动 GC 或清理用户记录。测试用同步 `beforeCreateCommit` 钩子只用于 request success 后中止事务，异步钩子不会被当作可靠事务等待。

技术依据：[IndexedDB 规范](https://www.w3.org/TR/IndexedDB-3/)的事务 complete/abort 和 durability 定义。strict 仍是宿主实现的耐久性提示，不替代实际电源故障测试。公开 App 本地存储和 DataAdapter 行为依据 [Obsidian API](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts)，实际可用性以本轮原生结果为准。

## Windows 原生实测（上一实施轮）

新建 `.local/sync-016/a3/native/probe-YGhXwF/Knowledge Map A3 Native/` 和专用 profile，只有探针插件，无正式 Knowledge Map 或 Nutstore；不使用 A1 或日常库。用户本人处理 Obsidian 仓库信任提示后运行。探针直接捆绑当前 causal / host / IndexedDB 原型源文件，报告包含模块及 footer 摘要，避免把另一版测试实现当作源码验证。

Windows / Obsidian **1.15.0** 实际读取到 App 本地存储、Web Locks、IndexedDB、WebCrypto 和 secureContext 可用；首次引导留下合成记录，再关闭库窗口、仅终止命令行匹配专用 profile 的残留进程，完整重新启动。最终 **18 项通过、失败 0、待重开 0**，面板也实际显示同一结果。原设备 installation 相同，旧私有记录读回；没有靠重复点击替代进程重开。

检查覆盖事务中止、两个同名 add 竞争、重复记录不覆盖、不同逻辑库隔离、超限读取拒绝但不截断数据、双后端租约排他、签名文件名变更拒绝、设备禁用/恢复、本机日志锚及 **1,280,394 B** 中文/emoji 数据精确读回。普通 Vault.create 对已有文件拒绝覆盖；本次 Windows DataAdapter.copy 也拒绝覆盖并保留目标。这两项观察不证明部分文件安装不可见、断电安全或云同步写者参加同一事务。

外部配置未知时的暂停回写，以及显式“本独立库配置无外部写者”条件下的 process 保存/epoch 失效检查通过。报告 externalNotifications=0：**没有测试真实 OS/Nutstore 改 data.json 后的回调时序**；探针主动调用 notifyExternalChange 的检查不能冒称外部文件同步通过。

最初引导版报告显示 14 项，其中重开项 detail.observed=false；它只能作为 13 项观察和一次待重开记录，不能算持久性通过。最终报告已改为未执行项 passed=null，并加 4 项事务/隔离检查，全部由最终 18 项报告和当前源码摘要验证。

证据：`probe-YGhXwF/Knowledge Map A3 Native/SYNC-A3-native-PC-2fec754b66c88e6180dafc9d48a85cff.json`；来源摘要、干净包一致性与最终核验在 `.local/sync-016/a3/native/native-verification.json`。Windows 最终探针 main.js SHA-256 `f1ea3d6a24025ac696723c868a5598bcc897d56e1daf9dc858c5f3a81ce34057`。

## 外部配置同步下的保存策略

已落实的变化是把**私有事实、备份、outbox 和草稿的底层接口**提供为 IndexedDB 事务后端，避免要求 `.obsidian` 文件本身承载设备来源和私有原子日志。此处不是把本机密钥或整份日志塞到 localStorage。

data.json 的跨工具条件写问题仍保留上一阶段门禁：未知外部写者时暂停自动回写，设置/UI 意图及布局草稿保留。不能因为 Windows 上 copy 拒绝同名或 process 单次读回一致，就取消门禁。

下一实现路线是先在私有事务存储保留本机有效设置/UI/接受缓存，再把外部 data.json 当作待校验的输入做协调；需要单独完成私有配置文档的版本/恢复绑定、外部设置草稿合并和关闭兼容导出。**这些尚未实现**，不把它们写成已经解决跨工具 CAS；也不替 SYNC-P2 决定是否向其他设备共享建图设置。正式宿主接入前仍须完成这个门禁及原有生命周期/规模工作。

## iPad 交付与用户实测（2026-11-08）

干净 iPad 包由 `node scripts/prepare_sync_a3_native.mjs` + `python scripts/package_sync_a3_native.py <生成目录>` 制作；只有八个白名单文件，保留 `.obsidian`，无 profile、本机身份/密钥、IDB 数据、PC 报告、账号或笔记。CRC 和逐字节核验通过，包内 main.js 与 Windows 已测代码摘要相同；套件 ID 不同，设备来源不从 PC 复制。

交付 `.local/sync-016/a3/native/probe-CunbTk/Knowledge Map A3 Native test vault.zip`；操作步骤见 [iPad 检查指南](SYNC_A3_NATIVE_TEST_GUIDE.md)。用户本轮确认完成解压/打开，首张截图为 **17 通过 / 0 失败 / 待重开 1**；从 App 切换器划掉 Obsidian 后再打开，第二张截图和上传 JSON 均为 **18 通过 / 0 失败 / 待重开 0**。

已核对 `SYNC-A3-native-mobile-4130a01f4a1fc51cad4f7f7928ccee58.json`：suite 匹配干净 iPad 包；三模块及 footer 摘要逐一匹配当前源码和 Windows 报告；Obsidian 1.15.0；18 个检查名/顺序完整且无失败/跳过。sameIdentityAsPrior=true、prior private record observed=true，枚举到两份合成小记录；iPad installation 与 PC 不同。首次 JSON 未提供，首轮计数来自截图；真实划掉 App 的动作来自用户陈述，代理没有独立操控 iPad，不将其写成代理重跑。

报告确认 App 本地存储、Web Locks、IndexedDB、WebCrypto、secureContext 可用，strict-requested 与 powerLossVerified=false；1,280,394 B 合成 Unicode 读回精确。外部通知计数仍为 0，不算真实 OS/同步工具回调时序验证。第二次报告完成时间为北京时间 **2026-11-08 20:36:09**。

原 JSON 与两张截图逐字节归档于 `.local/sync-016/a3/native/ipad/`，核验脚本 `verify_ipad.py`、摘要 `ipad/ipad-verification.json`。JSON SHA-256 `608ffa6da0ea64cf8a76a9dc1c2f13a5793e1b2110a7dd60e456ea1503d9b232`。原 Windows 核验报告保留上一轮范围，不覆盖成新的 iPad 结论。本轮只核验用户报告/截图、源码摘要、版本和文档，没有重跑 npm、磁盘套件、Windows 或 iPad 检查。

## SYNC-NATIVE-F1：iPad copy 不满足不覆盖发布（P1 设计门禁）

实际：同一段探针代码先创建 source=`source`、已有 target=`target`，再调用 DataAdapter.copy。Windows 报告 refused=true / originalRetained=true；用户 iPad 报告 **refused=false / originalRetained=false / eligibleForNoReplace=false**。即 iPad 未拒绝复制，原目标也未保留。普通 Vault.create 的已有目标拒绝检查在两端都通过，但仍不证明任意中断下完整安装原子性。

期望：A3/A4 的 sharedStore.create 必须满足完整安装且同名不替换，不能让重复发布改写另一笔或损坏已有记录。复现入口是 `scripts/sync-a3-native-probe/main.js` 的 `observe DataAdapter.copy existing-destination behavior`，同源码、同 Obsidian 版本的跨端报告已保留。

这项检查是**行为观测**，不是要求 copy 拒绝覆盖的断言，所以面板仍显示 18 项通过；不得把它解读为 18 项存储保证全部满足。当前 IndexedDB 私有后端不调用 copy，私有事务/重开结果不受影响。现有正式包也未接入该发布实现，本轮没有生产覆盖事故。

处置：A4 不得用 DataAdapter.copy 或 exists + copy 实现最终不覆盖发布，不因 Windows 单端结果而放行。最终共享文件发布仍需选择并验证另一条符合契约的路径，包括同名并发和部分文件/中断；未实现前保持门禁。该限制已同步 TODO 的 A4 和协议，不修改探针原报告、既有操作或格式以掩盖差异。

## 当前边界与下一步

Windows / 用户 iPad 的本轮环境中，私有存储与重开验证已具备证据；不外推 iPhone、最低 iOS、后台、内存压力、系统清理或断电。第五阶段实现轮曾运行 `npm test` 构建 + **18 脚本通过**（A2 116 + 协调 29 + 宿主 40）；三套磁盘 65/53/12、48 次进程退出和原 315 项隔离检查继续保留历史标签，本轮报告核验没有重跑。两端各 18 项探针与 315 项隔离检查分开记录，不累计重复运行。

后续实施进度：私有有效配置/外部输入协调已在[第六阶段](SYNC_A3_PRIVATE_CONFIG.md)完成隔离原型及磁盘恢复验证，本页前述“下一实现路线”保留其提出时范围；新配置逻辑仍未做原生/iPad/OS 回调测试。接着补完整关闭/改选/兼容导出恢复、私有存储规模保护；A4 的最终共享发布保持上述 P1 门禁。main.js 416,150 B / SHA-256 `8801c3a3e5c2d96fcd6d230e8b703eac8472ac815e677e915c81c23249411391`、manifest/package 0.0.15 保持。没有修改正式保存路径、日常库/A1 库、已验收素材或发布版本；A3 尚未整体完成。
