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

At the time this source record was prepared, publication was pending. After the tag-triggered CI completes, record the source commit/tag, Actions result, downloaded asset hashes/provenance, independent installation and portal/client distribution status here. Keep mobile distribution evidence distinct from desktop and private-candidate acceptance. See [release notes](RELEASE_NOTES_0.0.16.md) and [sync/recovery guide](SYNC_GUIDE.md).
