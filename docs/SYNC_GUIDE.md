# Layout sync and recovery — 0.0.17

Windows ↔ iPadOS with Nutstore is the validated transport scope. Android is planned for 0.0.18; iPhone is unverified. The plugin writes ordinary vault files; your external sync tool transfers them. Configure the same note scope on both devices and let notes arrive before applying layouts.

## First join and local work

Build the map. In plugin settings, create a shared layout on the first device, then review joining it and choose whether to import your local layout or adopt the shared layout. On another device, discover/select that same logical ID, then separately review and confirm joining. Selection alone does not join or apply history. Independent test libraries need not share IDs.

While enabled, a compatible ordinary layout save is kept locally and queued for publication. A transferred file is not automatically a valid accepted layout: predecessors, content, graph compatibility and conflicts are checked. Concurrent alternatives remain available for explicit resolution. Turning sync off keeps local work and blocks shared I/O. Re-enabling does not silently publish saved drafts; review pending layouts separately.

## Backups and storage

- Before upgrading, back up the complete plugin directory. Replace only `main.js`, plugin `manifest.json` and `styles.css`; retain your own `data.json` and the app's private state.
- After joining, `data.json` alone is not a complete backup. The app also keeps device-local identity and a verified private journal. Do not copy another device's identity or private journal into yours.
- Export a complete recovery backup in settings. Keep the whole exported folder in place and **copy**, rather than move, it outside the vault. A status report is separate and cannot restore your work. Recovery exports do not include a device key or acceptance ledger; they are preserved recovery material, not a replacement private journal.
- The backup reference belongs to the current settings page. Reopening settings or changing the destination clears it while retaining existing files. Export again on that page before compatibility review or rotation. Reviews recheck the whole backup; missing or damaged content cannot authorize an operation.
- Shared files under `Knowledge Map Sync` include note-relative paths, title structure and coordinates. Settings, views and UI remain local. Recovery/compatibility packages can contain configuration and unknown fields; keep them private. Hashes check integrity, not encryption or authenticity.
- Your external tool determines which folders it transfers. Including large recovery backups can add substantial file traffic. Keep backup folders separate from shared operation directories. The plugin does not manage third-party network queues or rate limits.

## Historical layout restore (0.0.17)

In plugin settings, **Restore historical layouts** previews selected title groups from the one-time upgrade archive (`layoutUpgradeOriginal`) or from an optional complete-backup JSON you choose. Each group is labelled unchanged / adjusted / unavailable with a three-column preview (historical / current / proposed); unavailable groups cannot be selected. Nothing is selected by default and cancel writes nothing. Confirming first writes and verifies a complete recovery backup under `Knowledge Map Backups`, then applies only the selected groups: unjoined vaults restore locally, joined sessions stage a local draft that still requires separate review and publication. Joined sessions are never re-imported and no new connection is created. Old layouts lost to deletion, rename or structural change are not promised unchanged; trust the per-group preview. The unjoined iPad native restore entry was device-verified in an independent synthetic test vault (2026-11-22); joined-state iPad restore was not separately device-tested.

## Compatibility export and rollback

Turn layout sync off and export a complete recovery backup on the same settings page. Under **Layout to export for 0.0.15**, choose the accepted layout or the saved unpublished draft, then review. The preview identifies the source, geometry and full output path. Cancel does not request export; confirm writes a separate compatibility `data.json` with a completion manifest, never overwriting the working plugin data.

Keep the complete compatibility and recovery folders, copy both outside the vault, and fully quit Obsidian. To test rollback, install the actual published 0.0.15 three runtime files and explicitly chosen compatibility data in an independent vault. A recovery manifest is not the plugin manifest. Preserve all originals and app private state.

If editing in 0.0.15, separately preserve its new working `data.json`. To return to 0.0.16, replace only the three runtime files and retain that data and the original app private state. Original candidate history/drafts remain independent; old-version edits are not automatically merged or published. Review recovery choices before further work.

On iPad, verify the actual open vault and target plugin directory, complete the file manager's copy confirmation, and check standard filenames, sizes and, when needed, SHA-256. Numbered copies are not loaded. Reopen and verify the actual plugin name/version/interface before editing; correct source files do not prove installation succeeded. Do not remove files without a complete backup.

## Protection limits and disclosed limitations

Keep originals and backups when capacity or integrity checks pause an operation. Use reviewed recovery/rotation to a new logical library when appropriate; each device must explicitly select and join the new ID. Offline old devices may continue the old history, which does not automatically merge into the new one. Do not delete operation files to bypass limits.

The user accepted these release boundaries: large synthetic histories have slow replay (about 29–44 seconds for a 409-operation Node host sample; not an iPad benchmark); general Nutstore rate limiting remains unresolved; an original iPad trial anomaly remains unassigned despite a later controlled successful rollback/return trial; extremely long messages may cover undo controls at narrow widths. Objective iPad capacity timing, OS free disk and mobile memory ceilings remain unmeasured. A small iPad test backup felt under a second with no stall, which is subjective and does not establish large-history performance.

中文：先构图，再明确选择共享布局和审阅加入。关闭同步保留本机草稿，重新启用后另行审阅。完整备份请原位保留并另复制到库外；退出重进设置需重新导出以取得本页凭据。0.0.17的"恢复历史布局"从一次性升级归档或可选完整备份JSON逐组预览（原样/调整/无法恢复），默认不选、取消零写入，确认先写并验证完整备份再应用选中组；未加入本机恢复、已加入生成本机草稿需另行发布，已加入不重新导入。兼容来源在“导出给0.0.15的布局”下选择草稿或已接受布局，预览后可取消。回退/回升前完整外备，核对实际安装；旧版新工作不会自动合入同步历史。较大历史回放、第三方限流和已披露未归因异常仍有边界。
