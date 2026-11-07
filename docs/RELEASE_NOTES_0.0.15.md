# Knowledge Map 0.0.15 — iPadOS support

## Changes

- Touch navigation: tap to select, drag to pan, pinch to zoom, double-tap to focus or reset, and long-press or the Preview button to read a note or heading.
- Single-element layout adjustment with save, undo and redo. Touch group dragging and parent selection are deferred.
- Compact mobile toolbar, a details drawer for narrow windows, and preview controls for opening notes and returning to the map.
- English and Chinese hints appropriate to touch input, with improved separation from Obsidian's sidebar gestures.
- Worker failures fall back to cooperative graph construction with progress and cancellation. Both paths share graph and layout operations.
- Desktop and mobile share the smoother layer fades and top-level visibility behavior.
- Links and arrowheads extend to the canvas bottom alongside nodes, fixing the premature cutoff near footer information.
- A shorter README presents the hierarchy, connections and layout controls with six existing demos.

## Validation and limits

User-reported testing covers iPad Pro 2022 / iPadOS 26.5.2 / Obsidian 1.15.0 (396): loading, navigation, preview, single-element adjustment, layout persistence, rotation, narrow windows, host themes, Chinese composition with the soft keyboard and Magic Keyboard, and recovery after system-panel interruptions.

In the user's 85-note / 3,050-node test vault, build completion messages reported 0.26s initially and 0.18s on rebuild. The user described full-screen and narrow-window interaction as smooth. These are device-specific reports; completion-message times are not a time-to-interactive measurement or an FPS/memory benchmark.

Windows Obsidian 1.15.0 tests cover Worker failure and cancellation, 5,000-node synthetic graphs, and footer link/arrow pixels. The latest PC-F2 technical run passed the 11 synthetic check scripts. User acceptance also covers the desktop zoom and footer fixes.

Final 0.0.15 candidate checks passed the build and 11 synthetic scripts, plus 10 checks in a fresh Windows Obsidian 1.15.0 synthetic vault: three-file installation, empty-state handling, graph construction, native preview, drag persistence, undo/redo, rebuild, map reopening and plugin disable/enable. No captured runtime errors or warnings. The runtime JavaScript and CSS match the user-accepted PC-F2 package byte for byte; this final packaging step changes the manifest version. This is desktop evidence, not a new iPad test.

iPad cancellation remains explicitly untested in the report. iOS Worker failure injection, objective mobile FPS and system-memory peaks, the planned minimum mobile OS versions, and iPhone hardware have not been validated. The user has scoped 0.0.15 to desktop and iPadOS; Android adaptation and validation are scheduled for the following version and are no longer a gate for this release. iPhone remains unverified; iPad results must not be presented as validation of all mobile platforms.

Layout editing retains the limit of 128 siblings per group and 5,000 affected nodes. Undo keeps the last 50 steps within a session and clears on structural changes or plugin reload. The canvas remains dark with a light host theme.

## Upgrade

The plugin ID (`knowledge-graph-smoke`), data location and schema 3 are unchanged. Back up your plugin directory, replace only `main.js`, `manifest.json` and `styles.css`, and keep your own `data.json`. Restart Obsidian or disable and re-enable the plugin. See the [installation guide](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/blob/main/docs/INSTALL.md).

`minAppVersion` remains 1.6.7, a host compatibility setting rather than a verified minimum iPadOS version. `isDesktopOnly: false` enables mobile installation but cannot express iPad-only validation. iPhone is unverified and Android adaptation is planned for the next version.
