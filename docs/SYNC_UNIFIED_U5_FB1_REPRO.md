# U5-FB1 恢复未完成后收到另一端修改：复现结果

2026-11-15。**已稳定复现，尚未修复；U5 用户验收继续受阻。** 本轮按用户要求只定位与复现，不改运行源码、用户库、远端或交付包。

## 复现步骤与对照

1. 两个新隔离设备正常导入/采用同一布局，完成双向编辑。
2. PC 关闭同步，编辑布局，关闭并重开，再启用；审阅恢复后取消，保留本机草稿。
3. PC 继续编辑一次；另一端也编辑并自动写入共享历史，将另一端文件交付 PC。
4. 两端从普通设置检查共享布局；另一端审阅冲突，PC 重新审阅待发布布局并明确点击最终确认。

文件专项有独立对照：没有另一端新修改时，同样的取消后重新审阅确认能正常接受，清除对应草稿；有另一端同组新修改时，明确确认仍暂停。两套全新 Node 文件目录结果一致。

原生测试使用原交付候选 main SHA-256 `10b5bba00e6d98f004ad049018e831c0ec886d1f8f29fa2bb797c5a3465c8760`、Windows Obsidian 1.15.1、两个全新 profile。连接/身份/草稿/操作由正常运行入口生成，没有注入。真实鼠标拖动、设置按钮和一次 PC 进程冷开；文件由驱动显式本地复制。角色 iPad 仍运行 Windows，不是新增 iPadOS/Nutstore 验收。

## 确认的阻塞链

- 实际 receiver 的 `scan()` 发现本机 `layoutDraft`，返回 `local-layout-draft`，保留旧接受状态和本机编辑，不接受远端新布局。
- 用户明确确认恢复后，publisher 以原接受历史作为父链，准备本地操作；与已到达的另一端同组修改合成后不是单一 candidate，返回 `shared-candidate-blocked`。检查发生在 stage/写入共享文件之前，所以只有另一端新操作在共享历史内，本机草稿尚未变为共享分支。
- PC 此时审阅冲突被 `resolution-local-action-pending` 拦住；另一端只看到共享单链，`reviewSchema3Conflict()` 没有冲突域，抛 `resolution-one-domain-required`，因而没有布局选项。
- 设置状态把 `shared-candidate-blocked` 映射为“布局存在冲突……两份原始分支均保留”，但此时一份是本机草稿、一份是共享分支；文案未准确交代两者所处位置。

保护检查各自保留工作，却没有连接到可供用户明确选择的恢复路径。反复同步或补点当前确认不能解除这组阻塞。不能删除草稿/共享历史、伪造接受状态或把未接受的远端直接当父链绕过。

这证明本轮候选存在中途恢复路径缺口，**不证明用户先前曾点击最终确认后失败**；用户对那一步的记忆不确定，历史报告只能证明发布未完成。

## 证据与验证范围

- `scripts/sync_unified_incomplete_restore_repro.mjs`：诊断专项，使用实际统一 host、publisher、receiver 和 Node 私有/共享文件；App/设备后端与图谱为测试契约。断言当前未修复行为，**不纳入默认成功门禁，不作为产品通过**。
- 两次稳定结果：`.local/sync-016/unified/u5/incomplete-restore-AGcHPf/reproduction.json`、`incomplete-restore-rQYuxl/reproduction.json`。无远端修改对照返回 accepted，有远端修改返回 held/shared-candidate-blocked；取消、接收和被阻止发布之后草稿不丢，原共享文件逐字节不变。
- 原生：`.local/sync-016/unified/u5/native-1ppsncy2/incomplete-restore.json`、`peer-no-shared-conflict.png`、`PC-restore-blocked.png`，日志 `incomplete-native-exercise-2.log`。前6组建立/双向基线后，3组定向复现完成，进程退出码0，结果为 reproduced=true/productFixed=false。PC接受3条、另一端4条，差异来自已发布的一条远端修改；与用户4/5条是同一因果关系。
- 早一次原生尝试在原因文本断言处退出：原因为 details 折叠时 inner_text 不含原因，改用 text_content 并展开核对；旧失败在 `native-b0x9lirs/failure.json` 保留。未据此修改产品。两次测试 profile 均已核对路径并关闭。
- 未运行默认全套、容量、断电或实际服务专项；没有新修复/发布/用户验收结论。

## 下一执行项

补齐“本机待审草稿与新到达共享布局并存”的明确审阅路径，绑定当前草稿/共享历史与图谱代次，取消不写、过期重审，保持原分支/草稿可追溯；区分无共享冲突、本机草稿待审与真正共享冲突。先用本复现建立修复回归，再做原生验证并提供保留用户当前数据的续验包/说明。方案与实现尚未完成；用户当前继续暂停第四部分，不补最终重开，不通过删除或重置绕过。
