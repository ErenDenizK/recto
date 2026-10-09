# Recto V1: performance results

The before/after numbers for each performance item that has landed, as PLAN.md §3.2 asks ("the PR
carries before/after numbers"). Each wave adds a section. The method follows
[perf-audit.md](perf-audit.md). Units are KiB (1 KB = 1024 B), as in the plan and the audit.

## W0-b (engine lane): PF-1, PF-3, PF-10, PF-14, PF-17, E13-c, M3-d

Date: 2026-10-09. Base: `develop` at `2344d17`. Machine: 4 vCPU, 15 GB, Linux, Playwright's Chromium
(Playwright 1.63). Other worktrees were building on the same machine, so the timings are noisy.
Each timing below gives the range of three or more runs.

### Bundle (PF-1, PF-17; `tools/qa/bundle-budget.ts` on `pnpm build`)

| Measure | Before | After | Gate |
|---|---|---|---|
| First paint JS gzip (V1-P1), 7 files | 117.8 KB | 117.8 KB | ≤ 120 KB |
| **Editor initial JS gzip (V1-P2)** | **1,621.8 KB**, 51 files | **879.2 KB**, 50 files (−742.6 KB, −46 %) | ≤ 900 KB |
| Compact edition JS gzip | 305.9 KB | 305.9 KB | ≤ 320 KB |
| PDFium worker script, raw | 1,575.9 KB | 1,577.2 KB (+1.3 KB: the E13-c receipt) | ≤ 1,600 KB |
| Service-worker precache, raw | 11,826.6 KB, 113 entries | 13,031.7 KB, 120 entries | ≤ 14,336 KB |
| First paint CSS gzip (not gated) | 7.8 KB | 7.8 KB | — |

- The PF-1 result matches the audit's measurement exactly (879 KB).
- The precache grows by the engine's six bundled TTFs (1.2 MB). Before, they were missing from
  the precache, so an offline export that embedded one of them failed (PF-17).
- The baseline in `tools/qa/bundle-budget.json` is the "After" column. The growth cap is 1 % per
  wave over it.

### pdf-lib ticks (PF-3; `packages/engine/test/pdflib-ticks.test.ts`)

These run on the main thread of a Vitest browser page (Chromium). It clamps nested timers the same
way a worker does.

**100-page document** (V1-P10 size). The pages come from the corpus files with fonts, images,
annotations and fields, copied in turn.

| Pass | Before (default ticks) | After (2,000 objects per tick) |
|---|---|---|
| Assemble 100 pages | 185–189 ms | 54–70 ms |
| Redaction scrub | 300–342 ms | 198–234 ms |
| Annotation finalise | 170–182 ms | 26–90 ms |

**8,000 pages** (many-pages.pdf ×20), load then save: 4,351–5,191 ms with the defaults, against
829–993 ms with PF-3 (about 5×).

**Output.** The bytes are identical:

- The SHA-256 of assemble, scrub and finalise on the 100-page document is the same before and
  after. The values are recorded in the test as `GOLDEN`.
- A load and save over the fixture corpus, with and without object streams, writes the same bytes
  under both tick settings.

**Cancel.** While a pass runs over 8,000 pages, a message posted to the thread (as an abort reaches
a worker) is handled within 19–42 ms. The test fails at 100 ms. The caller's promise rejects at
once whatever the setting (`pdfium-proxy.ts` `invoke`).

### OCR pool (PF-10; `packages/engine/src/ocr/pool.test.ts`)

All five scan fixture pages are in flight at once, at 200 dpi.

| Pool size | Wall time |
|---|---|
| 1 | 3,026 ms |
| 2 | 1,895 ms |
| 4 | 1,390 ms (4 vCPU) |

The words, lines, boxes and quality are deep-equal at all three sizes. `ocrPoolSize()` picks 4 only
where `navigator.deviceMemory` reports 8 GB or more and the engine is not WebKit. Elsewhere it keeps
the earlier rule: 2 from 4 cores, else 1.

### Start-up and save (V1-P5, V1-P6, V1-P10 baselines; `apps/web/e2e/startup.spec.ts`)

Desktop Chromium, 1280 × 720, not throttled, cold for each test.

| Budget | Measured (W0) | Plan target | Soft ceiling in the spec |
|---|---|---|---|
| V1-P5 open → first page, 10 pages | 1,357–2,069 ms | ≤ 600 ms | 3,000 ms |
| V1-P6 open → first page, 500 pages | 1,305–1,803 ms | ≤ 1.2 s | 3,000 ms |
| V1-P10 Save a copy, 100 pages | 1,249–1,617 ms | X from this baseline | 3,000 ms |

- The open time barely depends on length. Most of it is the engine barrel and pdf-lib loading on
  the main thread, then the 4.6 MB PDFium wasm compile. PF-2 (the light client subpath) and PF-4
  (streaming compile) target that part.
- The ceilings come down as those items land.
- The 4× CPU-throttled figures are not measured yet.

### Left open

- **V1-P1 label.** PLAN.md §2.3 says "First paint JS+CSS gzip", but its 118 KB baseline is JS
  only. With CSS, first paint is 125.6 KB, over the 120 KB gate. The gate measures JS, as the
  baseline did, and prints the CSS beside it. The owner decides which one the gate means.
- **PF-1 guard allowlist.** Nine lazy modules still value-import the engine barrel. They are listed
  in `eslint.config.js` as `engineBarrelLazyModules`, and PF-2 empties that list.
- **Speed budgets** are reported soft, in the spec only. They are not part of the bundle gate.
