# Knowledge Map 0.0.17 — layout upgrade continuity and historical restore

A fix release for layout continuity across upgrades. Existing graph rendering, navigation, preview, layout editing and the 0.0.16 reviewed sync behavior are retained.

- Custom layouts now survive upgrades even when note edits changed a parent's local radius: compatible saved geometry is reconciled before the graph mounts, instead of silently skipping the whole group. Verified on the real Windows 0.0.15 → 0.0.16 → 0.0.17 upgrade path with cold reopen.
- The complete original layout is archived once before reconciliation. Incompatible or malformed historical records are preserved, not discarded.
- New reviewed historical-layout restore in settings: choose a full recovery backup (or an optional JSON source), preview each group as exact / adjusted / unavailable with history / current / proposed columns, select groups explicitly, then confirm. A verified full backup is written before anything is applied.
- Unjoined libraries restore locally. Joined libraries stage a local draft that still requires the separate reviewed publication step; nothing is auto-published. Restored layouts persist across a full reopen.
- Joined sessions, including sync turned off, are never re-imported or re-connected by the upgrade.
- First shipped release of the previously accepted join improvements: a current-layout join option when historical import is incompatible, plus strictly bounded identity normalization with unchanged point geometry.

## Upgrade and privacy

Back up the whole plugin directory. Replace only `main.js`, `manifest.json` and `styles.css`; retain your own data and app private state. After joining sync, `data.json` alone is insufficient: preserve complete recovery exports outside the vault. Shared layout records contain relative paths, title structure and coordinates; settings/views/UI remain local. Recovery packages may contain local configuration and must stay private. See the [sync and recovery guide](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/blob/0.0.17/docs/SYNC_GUIDE.md) and the [upgrade and historical restore guide](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/blob/0.0.17/docs/LAYOUT_UPGRADE_016_GUIDE.md) before upgrading, restoring or rolling back.

## Validation and accepted boundaries

Verified against the exact release bytes: build + 43 synthetic check scripts (18 upgrade/restore scenarios), 3 abrupt-exit disk cold-reopen checks, 6 Chrome desktop/narrow-viewport checks, and 4 native Windows Obsidian checks covering real 0.0.15 dragging, the 0.0.16 upgrade and the fix upgrade with cold reopen. The user accepted daily-vault recovery, explicit shared publication, transport and iPad reception on a functionally identical local candidate; the release bytes differ from that candidate only by line-ending normalization, proven at byte level.

Historical groups whose notes were deleted, renamed or structurally changed are not promised to restore unchanged: a read-only reconstruction of one real 15-group history gave 6 exact, 2 adjusted and 7 unavailable groups. The per-group preview is authoritative.

iPadOS shared-layout reception is user-verified. The iPad native historical-restore entry (unjoined local restore) was device-verified by the user in an independent synthetic test vault on iPadOS on 2026-11-22: per-group preview, cancel without writing, a verified backup before applying, restore, and cold-reopen persistence; the returned post-test vault ran the exact release bytes. Joined-state iPad restore (draft plus separate publication) was not separately device-tested. Android adaptation is deferred to 0.0.18; iPhone remains unverified. Previously disclosed 0.0.16 boundaries remain open: large synthetic histories can replay slowly, general Nutstore rate limiting and the original iPad trial anomaly remain unassigned, and very long narrow-window messages covering undo are deferred.

The plugin ID and minimum Obsidian setting (1.6.7) remain unchanged. Normal layout limits remain 128 siblings per group, 5,000 affected nodes and 50 in-session undo steps.
