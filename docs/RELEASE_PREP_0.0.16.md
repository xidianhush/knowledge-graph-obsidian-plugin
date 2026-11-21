# 0.0.16 release record

2026-11-21 (Asia/Shanghai). **Release, Windows native distribution and portal verification completed; unmeasured mobile distribution and attestation-verification limits remain disclosed.** The user explicitly accepted the overall PC/iPad G8 experience and disclosed boundaries, and requested continuation of the planned release/distribution work. This does not authorize daily-vault upgrades or rewriting old tags.

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

### Portal follow-up (2026-11-21)

The user manually used Check for new releases in the existing authenticated plugin management page. The screenshot confirms that the manifest points to 0.0.16 and a scan has been queued. This supersedes the earlier inability to initiate refresh; scan completion, review outcome and the public current-version update remain unverified. The next step is to return to the dashboard and inspect its result, without repeatedly queuing scans. The screenshot remains private; no product assets or tags changed.

The subsequent authenticated dashboard screenshot identifies version 0.0.16 and source commit da0a59f. Overall review remains Pending with checks still running. The portal reports verified artifact attestations as Pass for main.js and styles.css, plus Pass for Vault Read/Write. Visible advisories are Vault Enumeration and Local Storage recommendations, and a css-display-contents compatibility warning referencing Obsidian1.6.5/src/host.css:56. Remaining lower-page checks and final completion have not been observed. Portal-reported verification is not an agent-performed cryptographic signature verification. No code, assets or tag was changed in response to this incomplete result.

After refreshing, the user supplied a dashboard screenshot showing **Completed** for version **0.0.16**, source **da0a59f**. Visible checks report Pass for main.js/styles.css provenance, Vault Read/Write and vulnerable-dependency detection. Recommendations and the CSS compatibility warning remain; Completed is scan completion, not a zero-advisory claim. The public current-version/listing text and official mobile-client distribution remain separate checks. The raw screenshot is private.

A subsequent live public-page read confirms **Current version 0.0.16**, five releases and the updated README sync section. The About/short-description fields still contain the previous 0.0.15 copy; those need a separate existing-listing edit and readback. Concrete version-appropriate short/long copy has been prepared locally within the observed 200/1000-character limits. Listing identity, icon, categories and price are to remain unchanged. Thus scan completion and public version promotion are verified, while description alignment and mobile distribution evidence remain separate.

### Final portal verification

The user edited the existing listing in Chrome. An independent live public-page read then confirmed Current version **0.0.16**, the new README sync section, and both new description fields. The 117-character short description and 909-character long description match the prepared text in full after normalizing only HTML whitespace. No additional save or scan is required. Existing listing identity, icon/categories and Free selection were retained in the supplied edit-form evidence.

GitHub publication, exact downloaded assets, desktop direct-native distribution, Completed portal scan and public listing/version/copy are now verified. This closes the release/portal work at the documented scope. It does not claim automatic upgrades of existing libraries, an official iPad-client installation, independent agent cryptographic verification, resolution of the accepted P1 causes, or removal of review recommendations/CSS warnings. All user vaults/backups and unrelated uncommitted work remain preserved; daily-vault upgrade was not performed. The release tag and CI asset bytes remain unchanged.

### README media correction (2026-11-21)

A later user screenshot revealed that the earlier README verification covered its text and sync section, but missed six locally refreshed demo assets. The local overview is the synthetic 27-note/147-heading coffee map, while the committed/public image was the older 25-note/105-heading map. This was a publication omission, not established as a browser-cache-only issue.

Commit `3cbe4e56093d61ae77cd0acd3cd6295d921c3c50` publishes the six existing local synthetic PNG/GIF assets and adds `?v=20261121` to their README image links. The original same-name files and previous Git versions were preserved. The remaining README text is unchanged. Local PNGs and sampled GIF frames were visually inspected and all image frames decoded successfully.

Remote GitHub README text now matches the local file. All six versioned raw image URLs and all six unversioned URLs actually referenced by the current community page return bytes/SHA-256 equal to the local refreshed media. The community HTML had not yet adopted the new query parameters at the verification snapshot, so we do not claim that its Markdown snapshot already includes those parameters. Its actual image URLs now serve the correct refreshed assets; browser visual confirmation may require a hard refresh. Private comparison inventories and remote checks are under `.local/release-016/readme-media-20261121-s1wup78d/`.

Only README media/documentation changed. The 0.0.16 release tag still targets da0a59f, and the three CI runtime assets remain unchanged. This adds media-publication evidence, not a new product test run.
