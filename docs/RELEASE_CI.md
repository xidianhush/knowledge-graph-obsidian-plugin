# Release CI: tag-triggered build, three assets, artifact attestations

Status: introduced for **0.0.14** (UI-A7). Workflow: [`.github/workflows/release.yml`](../.github/workflows/release.yml).
Applies to this repository only: `xidianhush/knowledge-graph-obsidian-plugin`.

Current GitHub release: **0.0.15**, published from tag `0.0.15` / commit `8b82e4b` by successful Actions run `42355198309`. Version-specific checks, hashes, portal copy and portal/client synchronization status are tracked in [RELEASE_PREP_0.0.15.md](RELEASE_PREP_0.0.15.md). The 0.0.14 examples below document the established workflow; use `0.0.15` for the 0.0.15 release. Portal icons use a name and background colour; repository PNG/SVG uploads are not supported, and the existing icon is unchanged for 0.0.15.

This document is English-first; a short Chinese summary is at the end.

## 1. What the workflow does

A push of a release tag matching `0.0.*` (for example `0.0.14`) starts one
`ubuntu-latest` job that builds the plugin from the **tagged commit** and
publishes the GitHub Release:

| # | Step | Detail |
| --- | --- | --- |
| 1 | Check out | `actions/checkout@v4`, `fetch-depth: 0` |
| 2 | Node | `actions/setup-node@v4`, Node 22 (repo `engines` requires `>=22`) |
| 3 | Validate | `manifest.json` version == `package.json` version; tag must match both; tag must be exactly `0.0.<patch>` (no `v`, no suffix) |
| 4 | Build | `node scripts/build.mjs` — **no `npm ci` / `npm install`**: the repo has no npm runtime dependencies and no lockfile |
| 5 | Package | `node scripts/package.mjs` (whitelists `main.js`, `manifest.json`, `styles.css`; rejects `smoke-payload.json` / `data.json`), then stages exactly those three files in `release/assets/` with a hard "no other file" guard |
| 6 | Checksums | SHA-256 of the staged bytes written to `release/SHA256SUMS` and cross-checked against the hashes `package.mjs` computed from `dist/` |
| 7 | Release body | `docs/RELEASE_NOTES_<tag>.md` if present (plus SHA-256 block, source link and workflow-run link); otherwise a minimal fallback paragraph |
| 8 | Attestation | `actions/attest-build-provenance@v2` with `subject-path` pointing at the three staged files |
| 9 | Publish | `gh release create --verify-tag` when the Release is new; `gh release edit` + `gh release upload --clobber` when it already exists. Only the three files are passed to `gh` |
| 10 | Verify | Reads the published asset list back and fails unless it is exactly `main.js`, `manifest.json`, `styles.css` |

Notes:

- `SHA256SUMS` and release notes are **not assets** anymore. Checksums live in
  the Release body; notes live in `docs/RELEASE_NOTES_<tag>.md` and the body.
- Trigger is `push: tags: ['0.0.*']`. A tag like `v0.0.14` does **not** match and
  will not publish anything. A tag like `0.0.14-rc1` matches the glob but the
  validation step rejects it, because the manifest version can only be
  `0.0.<patch>`.
- `workflow_dispatch` is a **dry run only** (build + validate + stage +
  attestation attempt). It never creates or updates a Release, even when
  dispatched from a tag ref. To publish, push the tag.
- Re-running a failed tag run (Actions → *Re-run all jobs*) is safe: an existing
  Release is updated in place and assets are overwritten via `--clobber`.
- Required permissions, declared in the workflow:
  `contents: write` (Release), `id-token: write` (OIDC/Sigstore),
  `attestations: write` (store the attestation).

## 2. Responsibility boundary

| Who | Owns | Must not do |
| --- | --- | --- |
| Local maintainer / coding agent | Bump `manifest.json` + `package.json`, add `versions.json` entry, write `docs/RELEASE_NOTES_<ver>.md`, run tests and the release gate, build locally and record bytes/SHA-256 | Upload assets to the Release by hand; create the Release manually; overwrite CI-built files with local builds |
| GitHub Actions (this workflow) | The authoritative build from the tagged commit, SHA-256 text, attestations, Release creation/update, asset whitelist enforcement | Skip validation, add assets beyond the whitelist |
| User / repo owner | Explicit authorization to push the tag and publish; portal listing/icon actions after the Release | — |

The Release is the single source of truth for the three runtime files. If a
local build differs, the CI build wins and must be investigated; never replace a
published asset with a locally built file (the attestation would no longer match
the bytes).

## 3. One-time repository prerequisites

Confirm these in GitHub before relying on the workflow:

1. **Public repository.** Artifact attestations are available for public
   repositories on all current GitHub plans; private/internal repositories
   require GitHub Enterprise Cloud. This repository is public.
2. **Actions enabled** (Settings → Actions → General → Actions permissions).
3. **Workflow token permissions.** Settings → Actions → General → Workflow
   permissions must allow read and write; a repository-level "read-only"
   default caps `GITHUB_TOKEN` and `gh release create` fails with HTTP 403
   ("Resource not accessible by integration"). The three permissions declared in
   the workflow cannot exceed that repository setting.
4. **No custom secrets are required.** The workflow only uses the automatic
   `GITHUB_TOKEN` (`GH_TOKEN`). Do not add a PAT.
5. **Tag convention.** Annotated tag with the bare version (`0.0.14`), matching
   the existing 0.0.13 convention. `git push origin 0.0.14` is required — a
   pushed branch or an untagged commit triggers nothing.
6. Runner image ships Node and the GitHub CLI. `gh release create/upload --clobber`
   are used; if a future image ships an old `gh`, pin/upgrade it in the workflow
   before releasing.

The only write path to a Release is this workflow. Anything that edits assets
outside it breaks the provenance guarantee.

## 4. Publishing 0.0.14 (operator checklist)

1. Bump `manifest.json` **and** `package.json` to `0.0.14`; add
   `"0.0.14": "1.6.7"` to `versions.json`; write
   `docs/RELEASE_NOTES_0.0.14.md`. Commit and push to `main`.
2. Build and test the release candidate locally:
   `node scripts/test.mjs`, `node scripts/build.mjs`,
   `node scripts/package.mjs --notes docs/RELEASE_NOTES_0.0.14.md`, then run
   the release gate (packaging/version consistency, blank-vault install, daily
   vault copy reconcile).
3. **Get explicit user authorization to push the tag.** No agent may push a
   release tag on its own.
4. Push the tag:
   ```bash
   git tag -a 0.0.14 -m "Knowledge Map 0.0.14"
   git push origin 0.0.14
   ```
5. Watch the Actions run (*Actions → Release*). Expected artifacts:
   - Release <https://github.com/xidianhush/knowledge-graph-obsidian-plugin/releases/tag/0.0.14>
   - exactly three assets: `main.js`, `manifest.json`, `styles.css`
   - body: release notes + `## SHA-256 checksums` code block + notes/run links
6. After the Release exists, confirm the portal listing shows the new version
   and the approved Overview/platform description. The 0.0.14 icon update was
   completed by the user using the portal's icon name and background colour;
   the portal cannot upload a repository PNG/SVG. Keep that icon for 0.0.15.

Failure handling:

| Failure | Action |
| --- | --- |
| `Version mismatch` / `Tag/version mismatch` | The tag points at a commit whose manifest version differs. Fix the version commit, delete the wrong tag with authorization (`git push origin :0.0.14`), re-tag the correct commit, push. |
| Release step 403 | Repository workflow permissions are read-only — fix in Settings, then re-run the run. |
| Attestation step fails | `id-token: write` / `attestations: write` missing, or the repository is private (see §3). Fix permissions or repo visibility, then re-run. |
| Transient runner/network error | Re-run the workflow run; existing Release assets are clobbered idempotently. |
| Extra asset appears in the Release | The verify step fails. Remove the stray asset manually and re-run; never let a release keep non-whitelisted files. |

## 5. Reproduce the CI build locally

The build is deterministic for a given commit (no dependencies, no timestamps;
`scripts/build.mjs` concatenates sources in a fixed order), so a local build of
the tag commit must produce the same bytes as CI:

```bash
git fetch --tags
git checkout 0.0.14          # the exact tagged commit
node scripts/build.mjs       # prints bytes + sha256 of main.js
node scripts/package.mjs --out .local/release/0.0.14 --notes docs/RELEASE_NOTES_0.0.14.md
cat .local/release/0.0.14/SHA256SUMS
```

On Windows without `sha256sum`, use
`Get-FileHash .local/release/0.0.14/main.js -Algorithm SHA256` (and the same for
the other two files).

Compare the three hashes with the `## SHA-256 checksums` block in the Release
body. `.local/` and `dist/` are git-ignored and are never part of a Release; the
workflow only stages the three whitelisted files.

One local quirk: if `.local/smoke-payload.json` (the private demo snapshot)
exists, `node scripts/build.mjs` copies it into `dist/` and
`node scripts/package.mjs` then refuses to package ("refusing to package:
dist/smoke-payload.json must not be shipped"). That guard is intentional — remove
the payload from `dist/` before packaging. A clean CI checkout never contains
`.local/`, so the guard never fires there.

## 6. Verify a download (checksums + attestation)

SHA-256 (from the Release body, `SHA256SUMS` is intentionally not an asset):

```bash
gh release download 0.0.14 --repo xidianhush/knowledge-graph-obsidian-plugin
sha256sum main.js manifest.json styles.css
```

Build provenance (requires GitHub CLI **2.49+** and a logged-in `gh`; check with
`gh --version`):

```bash
for f in main.js manifest.json styles.css; do
  gh attestation verify "$f" --repo xidianhush/knowledge-graph-obsidian-plugin
done
```

Pin the tag to make the check stricter:

```bash
gh attestation verify main.js \
  --repo xidianhush/knowledge-graph-obsidian-plugin \
  --source-ref refs/tags/0.0.14
```

A passing verification proves: the file was built by this repository's
`Release` workflow from the tagged commit, the attestation is Sigstore-signed via
the workflow's OIDC identity, and the file digest matches the attested subject.
`gh attestation verify` exits non-zero on digest/signer mismatch.

## 7. Differences from the 0.0.13 release

| 0.0.13 (manual) | 0.0.14+ (this workflow) |
| --- | --- |
| Assets uploaded by hand: `main.js`, `manifest.json`, `styles.css`, `SHA256SUMS`, `RELEASE_NOTES.md` | CI uploads exactly `main.js`, `manifest.json`, `styles.css`; notes and checksums are in the Release body |
| No provenance | Build provenance attestations for all three assets |
| Build could come from any working tree | Built from the pushed tag, version-checked, then published |

## 8. Known risks / caveats

- **Tag pattern is broad.** `0.0.*` also matches `0.0.14-rc1`; those runs fail at
  validation by design. Use `workflow_dispatch` for rehearsals instead of pushing
  throwaway tags.
- **Attestations require a public repository on current plans.** If the repo is
  made private, the attestation step fails unless the account has GitHub
  Enterprise Cloud. The workflow intentionally does not `continue-on-error`.
- **Immutable releases.** If the repository later enables release immutability,
  the "update existing Release" path (`gh release edit` / `upload --clobber`)
  will be rejected; the first publish becomes final.
- **Repository workflow-permission setting caps the token** (§3.3). This is the
  most likely first-run failure.
- **Runner `gh` version.** `--clobber` and `gh attestation` need a reasonably
  recent `gh`; the current `ubuntu-latest` image satisfies this.
- **No lockfile / no dependency cache.** The workflow must not be "fixed" by
  adding `npm ci`; there is nothing to install. If runtime dependencies are ever
  added, add a lockfile and a cache step together.
- **Publishing requires user authorization.** Tag push, Release, and portal
  refresh are user-authorized actions; agents prepare and validate but do not
  push tags on their own.

## 9. 中文摘要

0.0.14 起发布改为 **tag 触发的 GitHub Actions**：推送 `0.0.<patch>` 标签
（如 `0.0.14`，不带 `v`）后，runner 上 `node scripts/build.mjs` 构建，校验 tag
与 `manifest.json`/`package.json` 版本一致，`scripts/package.mjs` 白名单只留
`main.js`、`manifest.json`、`styles.css` 三个文件；`SHA256SUMS` 写入 Release
正文（不再作为资产），`actions/attest-build-provenance@v2` 对三个文件生成构建
来源证明，`gh release create/edit` 只上传这三个资产，最后回读资产列表确认恰为
三项。`workflow_dispatch` 只做演练、永不发布。

发布前需确认：仓库公开（attestations 需要；私有仓库需 GitHub Enterprise
Cloud）、Actions 已启用、Settings → Actions → General → Workflow permissions
允许读写（否则 `gh release create` 会 403）。本地复刻：在 tag 对应 commit 上
`node scripts/build.mjs` + `node scripts/package.mjs --notes
docs/RELEASE_NOTES_<ver>.md`，与 Release 正文的 SHA-256 对照。校验 attestation：
`gh attestation verify main.js --repo xidianhush/knowledge-graph-obsidian-plugin`
（gh ≥ 2.49）。**推 tag 必须由用户明确授权**；agent 只准备和验证。
