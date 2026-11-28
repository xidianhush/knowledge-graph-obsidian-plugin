# 工作区与开发基线收敛结果

日期：2026-11-24。当前工作区：Codex 5025；活动分支codex/baseline-convergence。规则见[WORKSPACE](WORKSPACE.md)，不可漂移的源commit见[BASELINE](BASELINE.json)。

## 本轮交付

- 保全253项左右混合状态之前的源码/文档快照，原工作区/其他4个worktree不写入、不删除；初始盘点记录在.local/baseline-convergence/worktrees.json。
- 明确同步体验dddf14a、恢复完整性6fdc757、已发布记录db835e1三条来源。两功能线共祖1c25526、互不包含，使用三方文本比较整合。
- 保留固定默认ID、bootstrap、自动编排/事件唤醒、一个开关/一句状态/至多一个主要操作/折叠高级区。三份easy模块与dddf14a按LF字节一致。
- 保留已发布本机布局协调、原始归档、历史布局审阅/恢复及全部检查。两份historical模块与6fdc757按LF字节一致；没有丢失后续修复。
- 冲突处理：测试清单合并两组检查；宿主保留easy内部调用包装，添加恢复导入与prepare/restore方法，避免在同一宿主队列内调用公开入队方法。
- 独立保留质量检查/CI/打包防护与公共组装器。此前手动分步UI模块保全于.local/baseline-convergence/rejected，不参与生产、静态范围或默认测试。
- 所有运行源码统一LF，工作区检查拒绝会改变provenance的CRLF；干净导出还校验main字节一致。Git工作区分支检查与便携源码检查分开，浅克隆CI不要求本地拥有其他分支对象。

## 实际验证

- npm run check：静态/格式/JSDoc、构建+45个合成脚本、打包/版本/输入/有限防漏检查通过；npm run workspace:check通过。
- 九套磁盘检查全部退出0：统一宿主、本地工作、当前加入、宿主、私有配置、生命周期、bootstrap、easy、layout upgrade。
- 原一键普通区Chrome/IndexedDB 8项检查通过，32张中英/深浅/宽窄合成截图；新增展开高级区确认历史恢复入口仍存在、普通区最多一个主要动作。不是原生设备或坚果云实传。
- 干净候选导出重跑45脚本并白名单打包；最终clean命令另检查导出bundle与当前冻结字节一致。
- 当前main.js 843977字节，SHA-256 98f4c49d9cbcdbee0c858f99b0b5f286effb1124b0e531dc8bea2e106341aa82；仅为整合候选，不能冒充已发布0.0.17资产。

## 审阅与未测项

独立审阅未发现恢复遗漏或新增队列死锁，指出LF/CRLF与旧文档问题，已修正并复测。未用此次技术结果替代用户历史体验验收；本轮不重开dddf14a已验收核心流程。未测试Windows/iPad原生组合、真实传输、升级/回退、性能或远端CI，不发布、不推送、不改日常库。

保留的小项：easy入口仍有一个未使用的旧完整面板导入（不运行、不影响接线），后续小范围清理再处理；此轮不为此增加行为修改。

## 可恢复与移交

私有证据在.local/baseline-convergence（before、refs、merge-plan、check-final、disk-results、easy-browser-final、clean-final）。拒绝UI及此前包保留作历史，不作为安装入口。

本地整合检查点只收明确公共源文件白名单；先提交经验证源码，再用不改变树的历史记录合并保留两功能分支祖先关系。ours策略仅记录已完成的手工三方合并，不代替源码整合；不更新main/origin/tag，不推送。提交ID以git log与最终交付说明为准。

下一任务仅评审一键界面的少量通俗提示。无需再建worktree；开工先workspace:check、TODO/README/WORKSPACE及状态清册。
