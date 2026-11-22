# 0.0.17 release preparation record

2026-11-22 (Asia/Shanghai). **Status: prepared locally; NOT published.** Publication (push to main, annotated tag, CI Release, portal refresh) requires the user's explicit authorization after the independent iPad test-vault short verification of the native historical-restore entry. Android adaptation is deferred to 0.0.18 by user decision. No daily-vault operation and no old-tag rewrite are authorized or performed.

## Source and version

- Integration branch `layout-recovery-integration`, baseline `1c25526` (= origin/main; contains the full published 0.0.16 source `da0a59f` plus the later README-media/docs commits). Fix commit `3c6bd15` (27 whitelisted files) and version/short-verify commit `4187eca`, plus subsequent preparation commits on the same branch. Nothing pushed.
- `manifest.json` / `package.json` / `versions.json` at 0.0.17; minAppVersion 1.6.7 and plugin ID unchanged.
- Expected formal SHA-256, built locally from the committed LF source; the tag-triggered CI build must reproduce these bytes:

```
62c6aed7012b277c64fbf713ab8dadcaf9c2af863f0db610d3a4645b7910fe87  main.js (806991 bytes)
6ded0d9d7cd88de9cc94f68b133cd3435a0a40818c7220ba33fc2f284a684eee  manifest.json (309 bytes)
294298902f12f24aedfa43ab5249d0a60974506747e9b5cec178ae3b60790a5f  styles.css (3055 bytes)
```

- `main.js` is byte-identical to the fully re-verified integration build; the version string is not bundled. Functional identity with the user-accepted recovery candidate 2 (807891 bytes / `2248816d…`) is proven: the only differences are 900 CR bytes across four locally CRLF working-copy modules and their four embedded provenance digests. Details in [LAYOUT_UPGRADE_016_RESULT.md](LAYOUT_UPGRADE_016_RESULT.md).

## Verification already completed (against the exact release bytes)

- `npm test`: build + 43 synthetic check scripts, 18 upgrade/restore scenarios (`.local/integration-017-test.log`; earlier LF-byte run `.local/integration-final-lf-test.log`).
- Disk abrupt-exit/cold-reopen 3/3 (`disk/run-Y5XDqV`); Chrome desktop/narrow 6/6 (`browser-_eaa0qfq`); native Windows 0.0.15 → 0.0.16 → fix 4/4 (`native-gcy26xov`, runtimeSha256 = `62c6aed7…`). Evidence under `.local/layout-upgrade/` (private, never distributed).
- Formal packager dry run: `node scripts/package.mjs` produced `.local/release/0.0.17/` with exactly `main.js`, `manifest.json`, `styles.css` plus `SHA256SUMS`; version-consistency and forbidden-payload guards passed.
- iPad short-verify package prepared and readback-verified (`.local/layout-upgrade/ipad-short-verify-017/`); awaiting the user's device execution and report. The iPad native restore entry remains **not device-verified** until that report passes.

## Publication gates (none executed)

1. User completes the independent iPad test-vault short verification and reports results. Update the iPad sentence in [RELEASE_NOTES_0.0.17.md](RELEASE_NOTES_0.0.17.md) and the guide/result/TODO conclusions accordingly. On failure: stop and investigate; no release.
2. Explicit user authorization for push / tag / Release / portal.
3. Final doc-accuracy pass before pushing: README 0.0.17 feature sentence and release-notes footer link; INSTALL title/version table/publication row; SYNC_GUIDE historical-restore entry mention and title. These publication-state edits are deliberately deferred to this gate so no document asserts an unpublished release. Then commit; push main fast-forward and annotated tag `0.0.17` atomically, no force; old tags untouched.
4. Watch the tag-triggered Actions run; independently download the three assets and compare SHA-256 with the expected values above. Never replace CI assets with local builds.
5. Portal: the user checks for new releases and confirms the scan/listing; prepare version-appropriate short/long description copy for the existing listing edit (observed limits 200/1000 characters). Listing identity, icon, categories and price remain unchanged.

## Accepted limits carried forward

Windows ↔ iPadOS with Nutstore remains the sync scope; iPhone unverified; Android deferred to 0.0.18. Historical groups lost to deletion/rename/structural change are not promised unchanged (real 15-group read-only reconstruction: 6 exact / 2 adjusted / 7 unavailable). The 0.0.16 disclosed performance/transport boundaries remain open. Official mobile-client distribution and independent agent cryptographic attestation verification remain unverified.
