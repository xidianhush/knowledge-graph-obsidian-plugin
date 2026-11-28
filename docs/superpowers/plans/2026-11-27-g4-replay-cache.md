# G4 bounded replay cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this single task inline. Track verification here and in TODO.md.

**Goal:** Reduce repeated authenticated blob reads during cold journal replay while preserving the accepted state and all existing rejection rules.

**Architecture:** Reuse the existing cache only during session.open and only for stores exposing checkReplayCacheAccess. Replace its eight-entry FIFO policy with at most 1024 entries and least-recently-used eviction under the existing 512 KiB serialized UTF-8 content budget. Keep cloning on hits, live access checks, journal reads and history validation unchanged.

**Tech Stack:** Existing JavaScript modules and Node synthetic checks; no dependencies or storage-format changes.

**Spec:** [G4 profiling result](../../G4_PROFILE_RESULT_2026-11-27.md), user authorization on 2026-11-27 to begin one minimal optimization batch.

## Scope and approaches

The user authorized the previous recommendation to reduce repeated processing with safeguards. This first batch selects material-cache reuse as an implementation decision: its existing authentication/lease boundary is already defined. Incremental history validation would affect a broader trust algorithm and is deferred. A larger FIFO alone permits frequently reused operations to age out behind one-use snapshots; LRU addresses that while keeping the byte ceiling. The count ceiling bounds per-entry metadata; serialized bytes do not equal total JavaScript heap use.

## Global constraints

- Keep dddf14a one-switch sync UX and recovery contracts; no UI or protocol change.
- No cache sharing across sessions, no journal-event cache, no skipping first authentication or content hash.
- Hits must still check live device/connection/lease and return detached values.
- Maximum retained serialized UTF-8 blob content 512 KiB; maximum 1024 entries. Oversize values remain readable but uncached.
- No backend capability means the original authenticated read path on every access.
- No device installation, cloud pressure, version bump, push or release in this batch.

## Review focus

- Hot data must survive a working set greater than eight while cold data is evicted under byte pressure.
- UTF-8 bytes and per-entry metadata must both remain bounded.
- Altered authenticated blob/journal data on a fresh open must fail closed.
- Revoking the identity immediately before a cache hit must be detected by the live check.
- Exact accepted operations/snapshot and local state must equal the frozen fixture; no shared or private writes on replay.

### Task 1: Improve lease-scoped replay reuse and verify the fixed sample

**Files:**
- Modify: src/sync/persistence-prototype.mjs (cache limits/hit recency only).
- Create: scripts/sync_replay_cache_check.mjs (signed-store synthetic regression checks).
- Modify: scripts/test.mjs (include the new checks).
- Create: docs/G4_OPTIMIZATION_RESULT_2026-11-27.md.
- Modify: TODO.md and docs/RELEASE_READINESS_2026-11-25.md (current status).

**Interfaces:** Keep createDurableSyncSession and store interfaces unchanged. Tests count real authenticated backend reads; private measurement restores the existing 406-operation fixture into isolated before/after source copies.

- [x] Add a failing test: 32 distinct small local-state blobs repeated in one open are each read once with immutable capability. Run node scripts/sync_replay_cache_check.mjs and observe the old eight-entry policy fail the read-count assertion.
- [x] Add protection checks: fallback re-reads; LRU hot value survives two roughly 320 kB cold values; UTF-8 oversize blobs are uncached; 1025 tiny blobs evict old entries; blob/journal corruption and revoked identity fail closed; fresh open re-verifies.
- [x] Change cache entry limit to 1024 and promote hits to most-recent position, preserving byte accounting and detached results. Run the targeted checks and existing local-work checks.
- [x] Register checks in scripts/test.mjs. Compare unchanged before and optimized copies on the same frozen fixture using fresh Node processes, three capability-enabled runs per version interleaved, each capped at 300 seconds. No phase timers or CPU profiler; both versions share the same backend-read counters. Assert states and input inventories unchanged; capture process memory outside the timer. Do not extrapolate actual IndexedDB or iPad performance.
- [x] Run npm run check and appropriate disk-backed corruption/reopen checks after measurements; verify public document figures and links (final document check recorded with the result).
- [x] Request one independent final review, address material issues, record exact asset identity and measurements. No merge/push/release; save the reviewed batch as one local commit at delivery.

Expected: targeted and engineering checks exit 0; cold replay read counts decrease while all equivalence/refusal checks remain. Report all before/after times, including any outlier. If the cache alone leaves history validation slow, retain that limitation instead of expanding this batch.

Result: [first optimization batch](../../G4_OPTIMIZATION_RESULT_2026-11-27.md). Eight targeted checks, local-work27, full check46 scripts and disk12/65 checks passed; six paired runs preserved inputs. This plan's implementation/technical validation is complete; device experience is pending user acceptance.
