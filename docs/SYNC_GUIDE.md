# Layout sync and recovery — 0.0.16

Windows ↔ iPadOS with Nutstore is the validated transport scope. Android is planned for 0.0.19; iPhone is unverified. The plugin writes ordinary vault files; your external sync tool transfers them. Configure the same note scope on both devices and let notes arrive before applying layouts.

## First join and local work

**SYNC-UX ease-of-use update (core flow user-accepted 2026-11-24; targeted for 0.0.17, not yet released):** build the map, then turn on **Layout sync** once in plugin settings. With no manual adjustment the plugin prepares a fixed default shared layout and writes an immutable initialization record under `Knowledge Map Sync/bootstrap-v1`, so an empty layout is discoverable. When only one valid writable shared layout exists it is selected automatically; when none exists the default is prepared and connected; when several exist a single readable choice is shown (IDs in details). After your sync tool transfers the shared files, an empty local layout adopts the shared layout (an empty shared layout can also be joined), a local-only manual layout is imported once, and semantically identical layouts adopt shared without republishing — each after backup and full verification. Differing layouts or conflicts still show both previews for you to decide. No prior drag, manual ID lookup, or empty-layout confirmation is required. Both devices must use the same build scope, and the sync tool must include the `Knowledge Map Sync` folder.

**Advanced / existing path:** you can still create a shared layout on the first device, then review joining it and choose whether to import your local layout or adopt the shared layout. On another device, discover/select that same logical ID, then separately review and confirm joining. Selection alone does not join or apply history. Independent test libraries need not share IDs.

While enabled, a compatible ordinary layout save is kept locally and queued for publication. A transferred file is not automatically a valid accepted layout: predecessors, content, graph compatibility and conflicts are checked. Concurrent alternatives remain available for explicit resolution. Turning sync off keeps local work and blocks shared I/O. Re-enabling does not silently publish saved drafts; review pending layouts separately.

## Backups and storage

- Before upgrading, back up the complete plugin directory. Replace only `main.js`, plugin `manifest.json` and `styles.css`; retain your own `data.json` and the app's private state.
- After joining, `data.json` alone is not a complete backup. The app also keeps device-local identity and a verified private journal. Do not copy another device's identity or private journal into yours.
- Export a complete recovery backup in settings. Keep the whole exported folder in place and **copy**, rather than move, it outside the vault. A status report is separate and cannot restore your work. Recovery exports do not include a device key or acceptance ledger; they are preserved recovery material, not a replacement private journal.
- The backup reference belongs to the current settings page. Reopening settings or changing the destination clears it while retaining existing files. Export again on that page before compatibility review or rotation. Reviews recheck the whole backup; missing or damaged content cannot authorize an operation.
- Shared files under `Knowledge Map Sync` include note-relative paths, title structure and coordinates. Settings, views and UI remain local. Recovery/compatibility packages can contain configuration and unknown fields; keep them private. Hashes check integrity, not encryption or authenticity.
- Your external tool determines which folders it transfers. Including large recovery backups can add substantial file traffic. Keep backup folders separate from shared operation directories. The plugin does not manage third-party network queues or rate limits.

## Compatibility export and rollback

Turn layout sync off and export a complete recovery backup on the same settings page. Under **Layout to export for 0.0.15**, choose the accepted layout or the saved unpublished draft, then review. The preview identifies the source, geometry and full output path. Cancel does not request export; confirm writes a separate compatibility `data.json` with a completion manifest, never overwriting the working plugin data.

Keep the complete compatibility and recovery folders, copy both outside the vault, and fully quit Obsidian. To test rollback, install the actual published 0.0.15 three runtime files and explicitly chosen compatibility data in an independent vault. A recovery manifest is not the plugin manifest. Preserve all originals and app private state.

If editing in 0.0.15, separately preserve its new working `data.json`. To return to 0.0.16, replace only the three runtime files and retain that data and the original app private state. Original candidate history/drafts remain independent; old-version edits are not automatically merged or published. Review recovery choices before further work.

On iPad, verify the actual open vault and target plugin directory, complete the file manager's copy confirmation, and check standard filenames, sizes and, when needed, SHA-256. Numbered copies are not loaded. Reopen and verify the actual plugin name/version/interface before editing; correct source files do not prove installation succeeded. Do not remove files without a complete backup.

## Protection limits and disclosed limitations

Keep originals and backups when capacity or integrity checks pause an operation. Use reviewed recovery/rotation to a new logical library when appropriate; each device must explicitly select and join the new ID. Offline old devices may continue the old history, which does not automatically merge into the new one. Do not delete operation files to bypass limits.

The user accepted these release boundaries: large synthetic histories have slow replay (about 29–44 seconds for a 409-operation Node host sample; not an iPad benchmark); general Nutstore rate limiting remains unresolved; an original iPad trial anomaly remains unassigned despite a later controlled successful rollback/return trial; extremely long messages may cover undo controls at narrow widths. Objective iPad capacity timing, OS free disk and mobile memory ceilings remain unmeasured. A small iPad test backup felt under a second with no stall, which is subjective and does not establish large-history performance.

中文：SYNC-UX 易用性改造（2026-11-24 核心流程用户真机验收通过，定版 0.0.17，尚未发布）只需先构图，再点一次「开启布局同步」；插件自动准备默认共享布局、连接并接收后续布局，无需先拖动一个圆、查找共享 ID 或手动确认空布局；两端须用相同建图范围，同步工具须传输 Knowledge Map Sync 文件夹。已有不同布局或冲突仍展示双方预览由你决定。高级路径仍可手动新建/选择共享布局并审阅加入；选择本身不等于加入或应用历史。关闭同步保留本机草稿，重新启用后另行审阅。完整备份请原位保留并另复制到库外；退出重进设置需重新导出以取得本页凭据。兼容来源在“导出给0.0.15的布局”下选择草稿或已接受布局，预览后可取消。回退/回升前完整外备，核对实际安装；旧版新工作不会自动合入同步历史。较大历史回放、第三方限流和已披露未归因异常仍有边界。
