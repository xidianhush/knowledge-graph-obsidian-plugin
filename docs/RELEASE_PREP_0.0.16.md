# 0.0.16 release record

2026-11-21 (Asia/Shanghai). The user explicitly accepted the overall PC/iPad G8 experience and disclosed boundaries, and requested continuation of the planned release/distribution work. This does not authorize daily-vault upgrades or rewriting old tags.

## Pre-publication verification

- Public source is selected explicitly: runtime modules, build/test dependencies, version files and public usage/release documentation. Private receipts, device identities, screenshots, profiles, configuration and unrelated dirty files/media are excluded and preserved locally. Existing LICENSE and packaging-script content is retained in the release tree.
- Manifest/package version is 0.0.16, versions mapping retains minAppVersion 1.6.7; the plugin ID and platform flag are unchanged.
- Exact public source-tree build + 40 synthetic check scripts passed. Default build equals the unified host generator. The published npm browser-test command has its sanitized synthetic harness and fixture included.
- Twenty-nine runtime modules and the unified footer match the user-accepted G8 candidate after Git LF normalization. Normalization changes embedded source/provenance bytes; runtime behavior is preserved. Formal name/version use the production manifest.
- Exact formal runtime files passed four targeted checks in a fresh Windows Obsidian synthetic vault/profile: disabled draft guidance, source preview/cancel, moved-backup invalidation and full process reopen. This is not another iPad or cloud test, and does not repeat the prior full rollback exercise.
- Packaging preserves the three runtime-file whitelist. Release files must be produced by the tagged CI job, then independently downloaded and checked; local files must not replace CI assets.

Expected formal SHA-256:

```
8c575cfa5203233ea07487590ea37e9b1bda77819840bb747ad9e868cf489a98  main.js
18d115712f43e5d7528aaae588687060af36fc4e9b3494f7fb10ba6b1da3ba91  manifest.json
294298902f12f24aedfa43ab5249d0a60974506747e9b5cec178ae3b60790a5f  styles.css
```

## Accepted limits

Windows ↔ iPadOS with Nutstore is the sync scope; iPhone remains unverified and Android is planned for 0.0.17. Large synthetic Node histories can take about 29–44 seconds to replay. General Nutstore throttling and the original iPad trial anomaly remain unassigned; acceptance does not establish their causes or close them as fixed. Very long narrow-window messages covering undo are deferred. Small-vault iPad backup feedback was subjectively under one second without a stall, not a large-history benchmark.

## Publication and distribution

- Published [GitHub Release 0.0.16](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/releases/tag/0.0.16) from source commit `da0a59fda27b0900ce3cafd8157066786c180e7a`. Annotated tag object `4106eb3963282d645b14e716843dbc696f8530e8` targets that commit. The main branch and new tag were pushed atomically without force; old tags remain unchanged.
- [Actions run 44864419889](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/actions/runs/44864419889) completed successfully, including build, three-file guard, provenance generation and publication. Published at 2026-11-21T04:06:24Z. Release assets are exactly main.js (773756 bytes), manifest.json (309 bytes), styles.css (3055 bytes).
- Independently downloaded all three assets; every SHA matches the expected values above, manifest version is 0.0.16. No local file replaced a CI asset.
- Provenance generation succeeded in CI. Independent unauthenticated attestation reads returned HTTP403 rate-limit errors. This record does not claim independent cryptographic signature verification or successful payload retrieval.
- A fresh Windows Obsidian 1.15.1 synthetic profile used the native installer with the explicit repository and 0.0.16 version. Installation succeeded; actual manifest/CSS bytes match the Release, and the JavaScript matches exactly except the host-appended 18-byte `\n/* nosourcemap */` marker. Installed JS SHA is `886b832149cea5f3d1df1fc2911cebb50bc493f2761b1fb2add1782d900a7244`; removing precisely that observed marker yields the Release SHA. Enable, version/unselected state, settings save and synthetic-scope map build passed. This verifies direct native installation, not automatic update discovery or mobile distribution.
- Test-driver failures were retained: the first comparison did not account for the host marker; a later fresh-profile trust-author prompt was initially unhandled; the empty/default scope and an unsaved direct test-setting assignment were replaced with an explicit synthetic scope through the normal save API. Final installation verification passed; runtime assets were not changed for those driver fixes.
- **Portal still pending:** a live public-page fetch still reports Current version 0.0.15. The browser bridge was unavailable; native-window binding failed and in-app-browser creation/reconnection repeatedly timed out. No authenticated management refresh, new review result or updated description is claimed. This is a concrete external/UI blocker, not full distribution completion. The existing listing/icon are preserved. A signed-in maintainer should check for new releases in the existing plugin management page and confirm the version/review result.
- iPad/mobile official-client distribution remains unverified; prior private-candidate acceptance is separate. No daily vault was upgraded.

Private execution evidence stays under `.local/release-016/` (source verification, download verification, CI metadata, attestation errors and owned-profile installer result). See [release notes](RELEASE_NOTES_0.0.16.md) and [sync/recovery guide](SYNC_GUIDE.md).
