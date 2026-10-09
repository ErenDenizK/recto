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

## W1-g (engine lane): PF-2, PF-4, M2-a, M1-b, M1-d, P-7, B5 repair

Date: 2026-10-09. Base: `develop` at `e3af449`, built from a clean copy beside the branch, so
both builds ran on the same machine (4 vCPU, Playwright's Chromium 1194). Other worktrees were
running builds and e2e at the same time; the open times below come in interleaved rounds (base,
then after, then base…) so each round shares the same load.

### Bundle (`tools/qa/bundle-budget.ts` on `pnpm build`)

| Measure | Before | After | Gate |
|---|---|---|---|
| First paint JS gzip (V1-P1) | 117.9 KB, 7 files | 118.4 KB, 7 files | ≤ 120 KB |
| Editor initial JS gzip (V1-P2) | 877.4 KB, 48 files | 880.3 KB, 50 files | ≤ 900 KB |
| **First-open engine JS gzip, main thread** (new: `engineClient`) | **777.4 KB**, 6 files (the barrel and pdf-lib) | **21.7 KB**, 5 files (`@pdf-editor/engine/client`) | ≤ 120 KB |
| Compact edition JS gzip | 314.0 KB | 315.3 KB | ≤ 320 KB |
| PDFium worker script, raw | 1,577.3 KB | 1,585.7 KB | ≤ 1,600 KB |
| Service-worker precache, raw | 13,000.0 KB | 13,037.4 KB | ≤ 14,336 KB |

- **PF-2's delta after PF-1.** PF-1 had already taken the barrel off the editor's initial path, so
  the editor closure barely moves (+2.9 KB: the Turkish export warnings, EXIF sizing, the start-up
  marks). PF-2's gain is on the first open: −755.7 KB gzip of main-thread JS before the first page.
  On the wire, the scripts the main thread fetched during an open went from 743.2 KB to 20.2 KB
  gzip. Proposed V1-P2 gates: the editor stays at ≤ 900 KB, and the first-open engine at ≤ 120 KB
  (now gated as `engineClient`); editor plus first open went from ≈ 1,655 KB to ≈ 902 KB. The
  ≤ 600 KB working target needs PF-5 and PF-11.
- The compact edition was already over the 1 % growth cap against the W0 baseline before this
  package (314.0 KB against 305.9 KB, from other W0/W1 merges); W1-g adds 1.3 KB.
- The PF-1 lint allowlist (`engineBarrelLazyModules`, nine modules) is gone: they all take their
  values from the client entry.

### Open → first page (V1-P5; a probe with the start-up spec's method, and `e2e/startup.spec.ts`)

The probe opens a 10-page document (many-pages.pdf pages 1–10) through the Open button in a new
browser context per run (cold HTTP cache, no service worker), 1440 × 900, and times the input's
`change` to the first `main canvas[data-state="rendered"]`, as the start-up spec does. Five runs
per build per round.

| Round | Before (develop) | PF-4 + PF-2, worker compiles | After (final: the app starts the wasm download, the proxy compiles it) |
|---|---|---|---|
| 1 | 807–984, median 922 ms | 633–810, median 682 ms | — |
| 2 | 718–894, median 840 ms | 618–720, median 707 ms | — |
| 3 | 1,052–1,391, median 1,194 ms | 761–1,139, median 921 ms | 780–965, median 842 ms |
| 4 | 819–1,001, median 952 ms | 575–650, median 636 ms | 556–577, median 565 ms |

Rounds 3 and 4 together: before 1,026 ms, after 679 ms (median of 10), **−34 %**; in the quiet
round 4 the open is 565 ms, inside the 600 ms target, and −41 %.

Where the final open's time goes (round 4, the `pdf-editor.startup.*` marks, ms after `change`):

| Mark | ms |
|---|---|
| `engine-requested` (first open; the wasm download starts) | 6–8 |
| `worker-configured` (client chunk loaded, PDFium proxy made) | 22–33 |
| `wasm-compiled` (module stream-compiled, worker configured and running on it) | 302–350 |
| `document-opened` | 312–364 |
| `first-page-bitmap` | 550–567 |

Before, the barrel and pdf-lib (2.3 MB raw) loaded and compiled on the main thread first, and only
then was the worker configured and the wasm fetched, then compiled after its last byte arrived.
Now the wasm download starts with the open and compiles as it streams; what remains is the
compile itself (≈ 300 ms here) and the first render (≈ 200 ms). Next steps for V1-P5: start the
download on an idle moment once the editor is up or when the file picker opens, and PF-5 (the
worker script).

`e2e/startup.spec.ts`, single runs (soft, noisy): V1-P5 891 and 1,496 ms before, 889 and 620 ms
after; V1-P6 (500 pages) 956 and 1,521 ms before, 931 and 861 ms after; V1-P10 (save a copy of 100
pages) 1,088 and 1,618 ms before, 1,143 and 1,054 ms after (PF-2 does not touch the save path).

### No quality loss

- **Saved bytes:** `pdflib-ticks.test.ts` (SHA-256 `GOLDEN` of assemble, scrub and finalise on the
  100-page document), `merge-golden.test.ts` and `furniture-golden.test.ts` pass unchanged: images
  without an EXIF orientation take the same drawing path (M1-b), and PF-2/PF-4 change no engine
  output.
- **PF-4:** compress output with the shared module is byte-identical to the URL path; the
  signature worker's visual comparison gives the same pages; a worker whose own URL serves nothing
  opens and renders on the posted module (`wasm-module.test.ts`).
- **Engine suite:** 77 files, 885 tests pass.

### The other W1-g items

- **M2-a** (Turkish free text): a text box outside WinAnsi gets an appearance in an embedded
  subset of the bundled face (Inter, Noto Serif, JetBrains Mono) under the /DA font name. The saved
  file lists the same text in PDFium and pdf.js, the appearance's glyphs extract to it in both
  (ToUnicode), and the structure Acrobat relies on is checked (`free-text-unicode.test.ts`).
  WinAnsi text keeps PDFium's own appearance.
- **M1-b** (EXIF): pages, overlays and stamps from a camera JPEG show what the browser shows for
  all eight orientations, from the JPEG's own bytes (`jpeg-orientation.test.ts`).
- **M1-d:** the export summary shows every assembler warning in Turkish (`engine-warnings.ts`; the
  test reads the warnings from the engine source).
- **P-7:** the weekly qpdf rebuild differed only by libjpeg-turbo's build date (`build 20260927`);
  `build.sh` pins it, so the committed wasm is unchanged and reproducible (`qpdf-build.test.ts`).
- **B5 (W0-q):** `truncated.pdf` now opens, badged as repaired, with the pages, text and Info of
  the whole file (`structure/tail-repair.ts`, MuPDF's catalog-from-scan repair); a file cut inside
  its objects is still refused.

### Left open

- The 4× CPU-throttled open time is still not measured.
- `PdfiumProxy.compiledWasm` and the posted module rely on structured cloning of a
  `WebAssembly.Module` to dedicated workers; `postableModule` falls back to the URL where a browser
  refuses it. CI's Firefox and WebKit runs exercise that path.
