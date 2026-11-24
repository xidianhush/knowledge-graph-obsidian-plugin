# G5 损坏与失败恢复：技术结果

日期：2026-11-17。最新状态：**G5本轮门禁验收完成**，用户PC/iPad+坚果云三类文件故障及恢复前/后重开均明确确认；12报告/4图、36组只读核验通过，详见 [验收回执](SYNC_G5_ACCEPTANCE.md)。下文保留此前技术验证与交付状态。G6–G8及P3继续保留。候选版本仍0.0.15。未改原G4/FB2验收现场或日常库，未commit/push/tag/Release。

## 实际问题与修复

持久同ID隔离原先没有正常设置页的明确解除路径。移走异常输入或重开不能解除是保留证据的预期行为，但缺少可审阅的恢复出口。新增「审阅共享文件恢复」：先恢复已接受原件或把异常输入备份到库外，再预览、取消或确认。修复记录受原私有日志链保护；原隔离证据仍保留。恢复本身只解除本机隔离，不接收新布局、不授权发布、不覆盖或删除共享原件。

恢复审阅绑定本机日志head、隔离证据摘要、完整共享库存和graph/source epoch。输入仍冲突、已接受原件缺失、已有intent同ID异文、已取消intent重新出现、图谱不兼容或保存未完成均不允许解除。库存/图谱/来源变化使原确认失效，必须重新审阅。恢复后坏字节重新出现会再次隔离。

首次加入前也可遇隔离。补齐join-required下的恢复门禁及无accepted时的审阅依据；解除后仍未加入、accepted仍为空，必须另行确认采用布局。完整浏览器复测又发现旧join-backup只允许sequence=0，与先前隔离/恢复日志不兼容；最小放宽为无receipt/pending/joining/活动隔离。此前可成立的日志事件仅隔离/恢复，未旁路加入原文备份。确认加入和冷回放已补红→绿用例。

状态页持久显示隔离/会话故障及处理步骤，不依赖短暂outcome。诊断新增受限库存/隔离证据；任意未知文件正文不被读入导出。原件缺失保留已接受布局，恢复正确原字节再检查；未知文件仍阻止共享输入。部分写、共享写完而本机提交失败、写期间图谱/源变化沿用既有intent，冷重开后须新审阅，同一逻辑操作ID不重造。

## 最终验证与范围

- `npm test`：构建及36个合成脚本通过，其中G5生产graph/store/host/history集成14组；不将此等同原生或坚果云。
- `sync_settings_browser_check.py`：16组通过。真实Chrome DOM/按钮、生产host/session及IndexedDB；新增持久隔离、未修输入拒绝、取消/重开、过期确认、正常确认和首次加入恢复全链路。App/Modal/shared adapter为注入，同页宿主重开不称完整浏览器进程重启。
- G5磁盘4项/2次强制进程退出通过；受影响host磁盘8次、自动发布磁盘14次退出回归通过，共24次。实际Node文件和签名日志，App/locks仍为合成契约，不冒称断电、服务故障。
- Windows Obsidian1.15.1独立profile原生9组通过，普通新建/导入基线与最终G5包查找/采用基线各完整运行一次。实际图谱、画布拖动、设置/恢复按钮及故障后完整退出重开。部分写用adapter写83字节后抛错，本机提交失败用真实IndexedDB日志边界注入，epoch/source变化为受控注入；均核对冷开intent ID、取消、重新确认、原件摘要与最终接受状态。不是实际硬件损坏、Nutstore或iPad测试。
- 最终包实际生成的原件/故障样本经生产host双设备配置回放5项通过：同一操作明确采用；未知文件拒绝并恢复；缺失保持、备份字节一致；同ID隔离/冷开/取消/确认；所有源码模块摘要与冻结候选匹配。
- 独立只读复核关闭两项Important：首次加入前隔离恢复不可达；历史knownIntents/cancelled信任校验遗漏。复核另以纯内存Node实际跑首次恢复→取消→修改返回预览→确认→单独加入→冷回放、历史取消intent异文拒绝。最终无新增Critical/Important；未替代原生或用户验收。旧候选对新attempt-recovery事件按unknown journal-kind拒绝回放是代码检查结论，不称旧版原生降级测试。

驱动失败如实保留：未等待原生图谱异步更新导致graph-not-ready；补canReceive门禁等待后完整通过。一次调用误用了不存在的冻结目录，未启动App；按真实preparation修正。Windows长路径导致Python复制/打包枚举失败，补已校验路径的长路径前缀后重跑通过。包回放最初错误比较设备本地revision，改为跨端比较groups/structures、每端分别保存并核对完整接受凭据；未放宽几何/原件校验。首次加入的persistence-join-state为真实程序缺口，已先复现后修。

## 证据与冻结

私有证据根 `.local/sync-016/g5/`：`join-red.log` / `join-green.log`、`integration.json`、`default-current.log`、`browser-join-fixed.log`、`disk-current.log`、`host-disk-current.log`、`queue-disk-current.log`、`native-wait-current.log`、`native-delivery-checked.log`、`delivery-verification.json`、`regression-summary.json`。旧失败日志保留但不作新通过。

最终浏览器 `unified/u4/browser-2_o3yrv8`；G5磁盘实际路径见disk-current.log；最终host `unified/u3/disk-3HsgOb`，queue `unified/u2/disk-BA6uMA`。原生普通导入 `unified/u5/registry-g5-ur5bgswm`，最终交付采用 `unified/u5/registry-g5-pct_ioxy`。这些profile、报告、截图、私有日志均不进交付包。

冻结候选 `unified/u5/pristine-tODAHI`；main SHA-256 `97b9e0b6403afe0f897f02f0cc2f45af23a52bcd70fd482d5591c4d7cbcb35f2`，styles仍为UI1已验收的 `294298902f12f24aedfa43ab5249d0a60974506747e9b5cec178ae3b60790a5f`。原生运行与包内运行文件来自同摘要。

## 交付与用户复验

交付 `.local/sync-016/unified/u5/g5-delivery-s86nl3wc/`：PC ZIP 11文件、iPad ZIP 10文件、库外故障样本ZIP 3文件，严格白名单/摘要/CRC/逐字节通过。仅全新合成笔记/设置/运行文件，PC额外一笔新生成合成共享操作；无安装身份、私有日志、接受凭据、profile、用户报告、截图或凭据。故障样本与原字节备份独立放在库外。

具体操作见交付目录的 `G5-操作指南.md`（模板 [SYNC_G5_GUIDE.md](SYNC_G5_GUIDE.md)）。新远程目录 `/KM-G5-3be202e6`，逻辑库 `f21152e4db13c16005e94b78f5d2518d`。两端查找并**采用**预置布局，不新建或导入。依次验未知输入、已接受原件缺失/恢复、同ID持久隔离的取消/确认/冷开。异常时保留现场并导出，不修改旧G4库。

此前交付要求基线、未知、缺失、隔离、最终两端报告和现象；2026-11-17用户已回交12报告/4图（含额外恢复阶段），验收见顶部回执。首次加入前恢复有宿主/浏览器回归，本轮未要求重复该场景。P3超长sticky消息、G6容量、G7旧版回退/整包、G8发布授权均未结项。
