# Knowledge Map

[English](README.md) · [简体中文](README.zh-CN.md)

**Explore the hierarchy and connections in your Obsidian knowledge as a map you can arrange.** Folders, notes and headings form nested circles; wiki-links connect them.

![Folders, notes and headings in one nested map](docs/assets/knowledge-map-overview.png?v=20261121)

## Explore the hierarchy

See where knowledge belongs, from a subject down to a heading. Colour follows the top-level folder; circle size reflects the structure beneath it.

**Pan** — drag the canvas to explore another region; on iPad, use one finger.

![Dragging the canvas to pan](docs/assets/knowledge-map-pan.gif?v=20261121)

**Zoom** — on desktop, scroll over a circle to explore deeper levels or come back out. On iPad, pinch to zoom or tap − / + to change levels. Use **Reset view** to return to the current level's default view.

![Zooming through the hierarchy on desktop](docs/assets/knowledge-map-zoom.gif?v=20261121)

**Preview** — on desktop, hold Ctrl and hover over a note or heading; click the circle to pin its preview. On iPad, hold a note or heading, or select it and tap **Preview**. Close the preview with its close button (or Esc on desktop).

![Previewing and pinning a note on desktop](docs/assets/knowledge-map-preview.gif?v=20261121)

## Follow the connections

See the chain between related ideas and follow it when investigating a question or tracing a problem.

![Links between notes and headings](docs/assets/knowledge-map-links.png?v=20261121)

A dot marks a link's source and an arrow its target. Dashed lines mark parallel / contrast relations. Select a circle to highlight its links and connected elements; a grey dotted line traces its ancestors. Visible links depend on zoom, filters and drawing limits.

## Arrange what matters

Put core ideas in the centre and supporting details around them.

Press ✥ **Adjust layout**, drag a circle, then press ✥ again to finish. The layout toolbar provides undo, redo and reset controls. Desktop also supports group dragging; touch layout editing moves one element at a time.

![Adjusting circle positions on desktop](docs/assets/knowledge-map-layout.gif?v=20261127-avoidance)

Layouts are saved separately from your notes and reused after edits where they can be reconciled. Incompatible groups fall back to automatic layout.

## Install and start

1. In **Settings → Community plugins → Browse**, search for **Knowledge Map**, install and enable it. You can also use the [directory page](https://community.obsidian.md/plugins/knowledge-graph-smoke).
2. Choose the folders to include in the plugin settings.
3. Click the ribbon icon or run **Build knowledge graph from current vault** from the command palette. The interface supports **English and 简体中文**, following the app language by default.

For manual installation, copy `main.js`, `manifest.json` and `styles.css` from a [release](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/releases) into `.obsidian/plugins/knowledge-graph-smoke/`. See the [installation guide](docs/INSTALL.md) for upgrades, backups and rollback.

This branch describes an **unreleased one-switch sync candidate**. Installing from the community directory or an existing release may give you a different interface. The published 0.0.17 recovery release and this candidate have different assets; see the [version and installation details](docs/INSTALL.md#1-版本与兼容).

## Optional: share layouts between Windows and iPad

Keep the same notes on both devices and match **Include scope**, **Exclude scope** and **Excluded notes** in plugin settings. Turn on **Layout sync** once on each device. The plugin prepares and connects the default shared layout automatically; you do not need to create or look up an ID.

Use your sync tool to transfer your notes and the **`Knowledge Map Sync` folder**. Compatible saved edits are queued automatically while sync is on. After the files arrive and pass validation, the receiving map updates automatically. Differing existing layouts, multiple candidates, conflicts and drafts saved while sync was off require a choice or review. Turning sync off keeps local work.

The tested transport is **Windows ↔ iPadOS with Nutstore Sync**. Settings, views and UI stay local. Local saving, writing shared files and applying them on the other device are separate steps. See the [sync and recovery guide](docs/SYNC_GUIDE.md) for setup, backups and recovery.

## Platforms and limits

- **Desktop:** the declared minimum is Obsidian 1.6.7; recent Windows testing used Obsidian 1.15.1.
- **iPadOS:** tested on iPad Pro 2022 / iPadOS 26.5.2. Recent sync testing used Obsidian 1.15.1 (404) and Nutstore Sync 1.6.2. This does not establish support for every device or app version. The demos show desktop controls.
- **Other mobile devices:** iPhone is unverified; Android adaptation has a separate schedule. Minimum iPadOS and objective iPad frame-rate / memory limits have not been established.
- Layout editing supports up to **128 siblings per group** and **5000 affected nodes**. Undo keeps **50 steps** within the session and clears on structural changes or plugin reload.
- The map canvas stays dark, including with a light Obsidian theme. Large sync histories can take longer to replay; third-party rate limits and the original unassigned iPad trial anomaly remain disclosed limitations. See the [sync guide](docs/SYNC_GUIDE.md#protection-limits-and-disclosed-limitations).

## Data and development

Map building happens locally within your configured scope. The plugin does not modify your notes or make network uploads. Before sync is joined, local settings and layouts use the plugin's `data.json`; sync additionally keeps device-local identity and a private journal, and writes layout records to `Knowledge Map Sync`. Your external sync tool transfers shared files, which include relative paths, heading structure and coordinates. Keep full recovery backups and copy them outside the vault; `data.json` alone is not a complete sync backup.

[Installation and rollback](docs/INSTALL.md) · [Data boundaries](docs/DATA_SAFETY.md) · [Report an issue](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/issues) · [Build and test](DEVELOPMENT.md) · [Contribute](CONTRIBUTING.md) · [MIT license](LICENSE)

For contributors: this candidate retains the one-switch sync experience from `dddf14a` and the published recovery fixes. See [workspace rules](docs/WORKSPACE.md) and [current tasks](TODO.md).
