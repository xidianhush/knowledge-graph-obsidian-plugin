# 0.0.17 release preparation record

2026-11-22 (Asia/Shanghai). **Status: PUBLISHED.** main fast-forwarded `1c25526..76460f2` and annotated tag `0.0.17` (object `2a5cae63166a688ed6e5d0542752d3de2e702eee`) pushed atomically (no force, old tags untouched); tag-triggered Release run [45012479778](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/actions/runs/45012479778) completed **success**; GitHub Release [0.0.17](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/releases/tag/0.0.17) (id 454365046, "Knowledge Map 0.0.17", published 2026-11-22T10:27:03Z) carries exactly three assets whose independently downloaded SHA-256 match the expected values and the local build. The independent iPad test-vault short verification (unjoined native restore entry) passed by user report on 2026-11-22. Android adaptation is deferred to 0.0.18 by user decision. No daily-vault operation and no old-tag rewrite performed. Remaining user-side step: community-portal listing description refresh (gate 5).

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
- Release workflow re-checked against `.github/workflows/release.yml`: tag `0.0.17` matches the `0.0.*` trigger and the version guards; CI builds from the tagged commit, uses `docs/RELEASE_NOTES_0.0.17.md` as the release body, enforces exactly three assets and cross-checks SHA-256; `workflow_dispatch` is dry-run only.
- iPad short-verify package prepared and readback-verified (`.local/layout-upgrade/ipad-short-verify-017/`), including a ready-to-use test-vault package that passed a desktop first-use smoke (5/5) against the exact release bytes. The user executed the short verification on iPadOS and reported pass on 2026-11-22 (preview / cancel-without-write / verified backup / restore / cold-reopen persistence; three screenshots). The returned post-test vault `KM Restore Check Acceptance.zip` (257580 bytes, SHA-256 `fc81b41b8ad1d30ab8a98be6c7a75d47715ba718a29b35074157f777b4edc93f`; read-only inspection under `.local/layout-upgrade/ipad-short-verify-017/acceptance-vault/`) ran the exact release bytes (`main.js` `62c6aed7…`, manifest 0.0.17), stayed unjoined, archived `layoutUpgradeOriginal` v1, wrote two hash-verified `unjoined-config-recovery` backups, left the synthetic notes unchanged, and contains `workspace-mobile.json` (iPadOS). The unjoined iPad native restore entry is now **device-verified by user report**; joined-state iPad restore was not separately device-tested.

## Publication gates (none executed)

1. ~~User completes the independent iPad test-vault short verification and reports results.~~ **Done 2026-11-22 (pass).** The iPad sentence in [RELEASE_NOTES_0.0.17.md](RELEASE_NOTES_0.0.17.md) and the guide/result/TODO conclusions have been updated to record the unjoined-entry device verification and its scope. On any later failure: stop and investigate; no release.
2. ~~Explicit user authorization for push / tag / Release / portal.~~ **Granted 2026-11-22** (user selected "授权发布 0.0.17").
3. Final doc-accuracy pass before pushing: README 0.0.17 feature sentence and release-notes footer link; INSTALL title/version table/publication row; SYNC_GUIDE historical-restore entry mention and title. **Done in commit `76460f2`.** Pushed main fast-forward and annotated tag `0.0.17` atomically, no force; old tags untouched. **Done 2026-11-22.**
4. Watch the tag-triggered Actions run; independently download the three assets and compare SHA-256 with the expected values above. Never replace CI assets with local builds. **Done 2026-11-22:** run 45012479778 success; assets downloaded to `.local/release-017/downloaded/` and hashed — main.js 806991/`62c6aed7…`, manifest.json 309/`6ded0d9d…`, styles.css 3055/`29429890…`, all equal to expected and to the local `dist/` build.
5. Portal: the user checks for new releases and confirms the scan/listing; prepare version-appropriate short/long description copy for the existing listing edit (observed limits 200/1000 characters). Listing identity, icon, categories and price remain unchanged. Copy already drafted locally at `.local/release-017/portal-copy-0.0.17.md`: short 117/200 (unchanged from 0.0.16), long base 935/1000, and a long variant 998/1000 with the iPad-restore swap sentence. The short-verification report passed on 2026-11-22, so the 998/1000 variant is the version to use at publication.

## Accepted limits carried forward

Windows ↔ iPadOS with Nutstore remains the sync scope; iPhone unverified; Android deferred to 0.0.18. Historical groups lost to deletion/rename/structural change are not promised unchanged (real 15-group read-only reconstruction: 6 exact / 2 adjusted / 7 unavailable). The 0.0.16 disclosed performance/transport boundaries remain open. Official mobile-client distribution and independent agent cryptographic attestation verification remain unverified.
