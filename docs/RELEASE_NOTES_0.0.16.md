# Knowledge Map 0.0.16 — layout sync

Layout sync for Windows ↔ iPadOS using ordinary vault files transferred by your own sync service. Nutstore is the validated transport scope. Existing graph rendering, navigation, preview and layout editing are retained.

- Explicit shared-layout selection and first-join review, with local import or shared adoption.
- Local saves queued for publication while enabled; verified reception, predecessors and explicit concurrent-conflict resolution.
- Local drafts retained while sync is off. Re-enabling requires separate review before publishing them.
- Full recovery exports, capacity protection and reviewed logical-library rotation; old histories remain preserved.
- Explicit accepted/draft compatibility export for 0.0.15, with cancellation, stale-input and partial-output protection.
- Clearer page-local backup guidance, missing/damaged backup messages, disabled-state text and visible compatibility-source labels.

## Upgrade and privacy

Back up the whole plugin directory. Replace only `main.js`, `manifest.json` and `styles.css`; retain your own data and app private state. After joining sync, `data.json` alone is insufficient: preserve complete recovery exports outside the vault. Shared layout records contain relative paths, title structure and coordinates; settings/views/UI remain local. Recovery packages may contain local configuration and must stay private. See the [sync and recovery guide](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/blob/0.0.16/docs/SYNC_GUIDE.md) before joining or rolling back.

## Validation and accepted boundaries

The user accepted the overall PC/iPad candidate experience and disclosed boundaries on 2026-11-21. Candidate verification included build + 40 synthetic check scripts, 31 Chrome DOM/IndexedDB groups, four targeted Windows Obsidian groups, 18 abrupt Node process exits and exact package replay. Previously completed PC/iPad controlled rollback/return checks were retained rather than repeated. These evidence types do not imply all platforms or transports were tested.

Large synthetic histories can replay slowly: two Node-only runs at a paused 409-operation sample gave about 29–44 seconds for cold host replay. This is not an iPad benchmark or universal supported operation limit. General Nutstore rate limiting and an original iPad trial anomaly remain unresolved; a later controlled successful trial does not retroactively establish the original cause. Very long messages covering undo on narrow widths are deferred. iPad capacity/memory limits and OS free-disk measurements remain unverified.

The plugin ID and minimum Obsidian setting remain unchanged. Windows/iPadOS are the sync scope; iPhone is unverified and Android adaptation is planned for 0.0.17. Normal layout limits remain 128 siblings per group, 5,000 affected nodes and 50 in-session undo steps.
