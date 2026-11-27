# G4 冷回放阶段定位结果

日期：2026-11-27（Asia/Shanghai）。仅定位，未修改生产运行代码；方案见[G4阶段定位方案](G4_PROFILE_PLAN_2026-11-26.md)。

已定位到本地日志回放中的重复历史材料读取与校验。探针重放124.487秒，其中session.open占124.325秒；这条宿主启动路径未创建新图谱模型，不能拿它评估画布渲染性能，也不能将本轮写成性能问题已修复。

## 对照与边界

新导出样本含406条已接受操作、405次本地保存，2438条日志事件、4065份私有文件，准备在480.973秒停止，原因为prepare-wall-limit。状态ready，未触容量暂停，草稿为null；它不是上一轮409操作/paused/非空草稿样本。只验证本轮null字段保持，不新增非空草稿保全结论。

源码对应174b57f保留的e236fdc9候选，Node v24.18.0、Windows x64、i7-13700H。main.js SHA-256为`e236fdc9697b6d535a415802b70df19cf8344f802eb8e24c6beb847e154754a4`，另两资产摘要见私有源清册和[上一轮记录](G4_MEASUREMENT_RESULT_2026-11-26.md)。原先中断目录及后续导出字段错误均保留；导出字段修正后先用3操作小样本验证完整链路，再执行本次定位。它们不是产品测试失败。

无源码探针对照重放133.245秒；阶段探针及CPU采样重放124.487秒。每次均新开Node进程，fixture JSON读入/恢复和静态模块导入在计时外，计时覆盖createUnifiedSyncHost异步构造；接受历史及状态与样本相同，共享写入被适配器明确禁止。两组各一次，不用探针比对照更快来宣称加探针提速或估计开销；也不是前轮同进程三次计时的同条件复测，不替换原数值或推断某次提交的回归倍率。

## 阶段计时

以下为嵌套inclusive时间；父阶段包含子阶段，不能相加。多次调用的累计时间也不是一次调用延迟。

- host.ensure：1次，累计124.481秒。
- session.open：1次，累计124.325秒。
- journal.read：2438次，累计2.038秒。
- journal.apply：2438次，累计122.229秒。
- loadReceipt：406次，累计91.196秒。
- loadBlob：85060次，累计66.796秒。
- projectAcceptedSchema3History：1217次，累计42.033秒。
- inspectSchema3History：1217次，累计41.823秒。
- projection.setup：1次，累计0.045秒。
- validateSchema3Snapshot：1次，累计0.003秒。
- model.build、probeSchema3Snapshot：本轮均未调用，不能写成模型创建或几何校验耗时为零。

projection.setup只是私有配置/文档投影的打开与观察；已接受布局的历史重建计在projectAcceptedSchema3History中，不能因setup小就说“布局投影全都很快”。本轮没有计时Obsidian界面启动、实际IndexedDB事务、图谱建模或画布绘制。

## 热点怎样形成

[持久化会话](../src/sync/persistence-prototype.mjs)open逐条读取和应用日志。每次accept事件调用loadReceipt，加载该回执引用的快照及完整操作前缀，再调用projectAcceptedSchema3History；stage阶段的validateIntent也分别重建之前与之后的历史。406条唯一操作因此触发406次回执加载、1217次历史重建及85060次blob加载调用。调用数量不等于唯一文件数，loadBlob时间包含设备绑定验证、JSON处理和哈希等，不是磁盘I/O的独立耗时。

[布局历史模块](../src/sync/layout-prototype.mjs)的projectAcceptedSchema3History包含inspectSchema3History，后者占其累计时间中的41.823秒。它校验记录、依赖闭合和事务前沿，再组装已接受快照；不是当前图谱的几何应用。loadReceipt的91.196秒同时包含材料加载和历史重建，不能把这些数字相加。可以确认主要耗时落在日志应用链，暂不能把全部余量精确分配给某个加密调用。

## V8采样热点

5ms采样只辅助定位，不代表完整墙钟分摊，也不覆盖所有原生/worker活动。文件位置来自私有探针副本。

- visit（src/sync/causal-prototype.mjs）：叶帧采样占比16.42%。
- structuredClone（node:internal/worker/js_transferable）：叶帧采样占比13.12%。
- (idle)（V8）：叶帧采样占比9.18%。
- 匿名（src/sync/causal-prototype.mjs）：叶帧采样占比8.23%。
- 匿名（src/sync/causal-prototype.mjs）：叶帧采样占比4.09%。
- (program)（V8）：叶帧采样占比3.02%。
- fields（src/sync/obsidian-host-prototype.mjs）：叶帧采样占比2.72%。
- cloneBoundedSyncJson（src/sync/causal-prototype.mjs）：叶帧采样占比2.71%。

## 适配器能力对照

源码表明真实IndexedDB后端声明immutableBlobsUnderLease与stableInventoryUnderLease，原testMemoryStore没有声明。恢复私有副本原源码、沿用同一fixture，仅给受控内存适配器声明这两项能力，对照重放为118.898秒，状态/接受历史/草稿不变。此对照不是实际IndexedDB实测；不以它直接承诺客户端耗时，也不把两个能力各自贡献混为已独立证明。

三组均退出0。最后一组恢复的三个模块逐项核对与冻结摘要一致。原回放缓存只有8项/512KiB；本次联合能力对照仍存在分钟级等待，未证明现有缓存可以消除该样本热点，也没有独立测出两项能力分别的作用。

## 下一步建议与边界

建议下一小批先围绕已验证材料在同一持有期内的复用，减少重复读取和复制，并评估历史前缀重复校验的消除方式；当前仅为优化方向，尚未实施或承诺提速。先用本次固定fixture做无探针对照，再验证收益及内存边界；正式性能结论需要重复测量。

任何实现须保留每条日志的顺序/锚点验证、首次材料认证、内容哈希及预算、依赖/事务校验、损坏拒绝和重开隔离。缓存只能在后端明确保证材料不可变且设备/连接仍有效时复用，并有容量上界；不跨重开沿用旧信任，不通过删历史、调高配额或跳过校验换取时间。改变回放算法前需补篡改、连接撤销、损坏日志及接受快照等价验证。维持dddf14a同步体验和当前简洁界面。

G4-D2定位完成；G4性能处置仍待下一小批，不记为性能通过或用户已接受新等待量级。未扩大为真实设备/服务压力，不要求用户重做已通过的G2流程。

## 证据

私有证据位于`.local/g4-profile-20261126/run-dczz68q0`：fixture.json、source-manifest.json、seed.log、control.json、profile.json、capability-control.json、cold.cpuprofile、instrumentation.json、analysis.json及各阶段退出码。合成App中也有生成的设备凭据，原件保持私有，不进入公开包。

原始驱动与分析脚本留在同一私有目录的drivers中；provenance.json记录脚本/输入摘要。fixture恢复后的会话状态断言、各次退出码与能力对照恢复源码摘要均保留。私有驱动不作为长期公开自动门禁；未来重放须先核对冻结源清册，不能用后来工作区代码静默替换本次源码。summary中的11-26日期沿用方法模板，本次运行与报告日期为11-27，不能据该模板日期混合两轮结果。

## 收尾验证

- 测量子进程均结束后运行npm run check，退出0；保留完整检查日志，没有与正式重放并行运行工程检查。
- 5份受影响文档的46个本地链接、选定数字转录与有限公开文本检查通过；282个冻结源/构建输入和3项运行资产摘要保持一致。有限文本检查不等于全面秘密审计。
- 独立只读方法审阅未发现阻断交付的问题，核对了原始JSON、探针与源码路径；已澄清嵌套计时、两能力联合对照、null草稿与零调用等边界。审阅未另跑性能测试，不计作重复测量。

本次未执行优化、设备库升级、推送、版本变更或正式发布。
