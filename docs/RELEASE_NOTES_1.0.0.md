# Knowledge Map 1.0.0 — one-switch layout sync

Explore folders, notes and headings as nested circles, follow their links, and arrange the map yourself. This release brings the one-switch sync flow together with the published layout-recovery fixes and engineering checks.

## What changes

- Turn on layout sync once on each device. The plugin prepares and connects the default shared layout automatically, including an empty layout. No initial drag or manual ID lookup is needed. Transfer your notes and the `Knowledge Map Sync` folder with your sync tool; compatible incoming layouts update the open map automatically.
- Shorter settings guidance explains what to transfer and which note-scope settings must match. **Review and save to sync folder** identifies the action for drafts saved while sync was off. Different layouts and conflicts still require review; cancel keeps local work.
- Fixes cover a publication being interrupted by the plugin's own directory events, and graph freshness after edits to Markdown outside the included map scope. Those fixes were verified through the production paths and targeted Windows/iPad user trials.
- Upgrade reconciliation, preservation of original layout data and reviewed historical-layout recovery from 0.0.17 remain available. Recovery and sync keep their existing verification and explicit-confirmation requirements.
- A bounded replay cache reduces repeated storage reads. In a matched synthetic 406-operation Node comparison, median replay fell from 34.470 to 18.917 seconds. This is a test result, not a native Obsidian or iPad timing guarantee.
- Build, contract, packaging and bounded privacy checks run through the locked development toolchain. Runtime files have no dependency on `node_modules`. The bilingual README includes refreshed synthetic layout-avoidance media.

## Upgrade and recovery

Back up the plugin directory before upgrading. After joining layout sync, also export a complete recovery backup, keep it in place and copy the complete folder outside the vault. Preserve your app's private state: `data.json` or a recovery export alone is not a replacement device identity/private acceptance journal.

Replace only `main.js`, `manifest.json` and `styles.css`; retain your own `data.json` and app private state. Do not import another device's used profile, identity or journal. Settings, camera/view and UI state remain local. Shared layout files contain relative note paths, heading structure and coordinates; the external sync tool handles network transfer.

Read the [sync/recovery guide](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/blob/1.0.0/docs/SYNC_GUIDE.md) and [historical recovery guide](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/blob/1.0.0/docs/LAYOUT_UPGRADE_016_GUIDE.md) before recovery or rollback. Do not delete shared operation files to bypass capacity or integrity checks.

## Tested scope and remaining limits

- Recent functional trials covered Windows Obsidian 1.15.1 and iPadOS 26.5.2 / Obsidian 1.15.1 (404) / Nutstore Sync 1.6.2 in independent synthetic vaults. They covered normal reopen/save, no-bounce layout editing and Windows/iPad transfer with the open PC map following the received layout. Detailed evidence and exact-candidate boundaries are recorded in the release-preparation record.
- The declared minimum Obsidian version remains 1.6.7. Android has a separate schedule; iPhone is unverified. Minimum iPadOS, native large-history timing, objective mobile frame rate and memory ceilings remain unestablished.
- Large histories may replay slowly. The general third-party rate-limiting issue and original unassigned iPad trial anomaly remain disclosed; later successful targeted tests do not establish their universal resolution. Extremely long messages at narrow widths remain a deferred UI limitation.
- Layout editing keeps the limits of 128 siblings per group, 5000 affected nodes and 50 in-session undo steps. The map canvas stays dark.
- Independent first-use trials by two new users were explicitly deferred by the product owner on 2026-11-28, accepting the absence of that evidence for this release. Do not interpret the developer/product-owner trials as independent-new-user validation.

## 中文摘要

1.0.0整合一键布局同步、已发布的恢复修复及工程检查。每台设备各开一次同步开关，用同步工具传输笔记和`Knowledge Map Sync`文件夹，兼容布局到达并通过校验后自动更新；已有不同布局、冲突及关闭期间保存的草稿仍须审阅，取消保留工作。

升级只替换三个运行文件，保留本机data.json和App私有状态；加入同步后不能只备份data.json，也不要复制其他设备身份。支持与测试范围保持Windows/iPadOS及坚果云链路，Android独立排期、iPhone未验证。大历史性能、第三方限流及原未归因异常继续按上述边界披露；两位独立新用户试用由产品负责人明确后置。
