# Recto internals: performance and code-quality audit (r13)

Date: 2026-10-09. Tree: `develop` at `8a78589`. Scope: internals only (engine, workers, render
pipeline, caches, text, search, OCR, ink, serialisation, export, storage, startup and bundle,
memory). Nothing here changes the UI. Where a change could be visible (a loading moment, a
cache that re-renders more often), the risk line says so.

## How this was measured

- Production build (`pnpm build`, Vite 8.3.1 / Rolldown 1.2.11), plus a sourcemap build in the
  scratchpad. Gzip sizes come from Node's zlib on the emitted files. The import closure of an
  entry is the transitive set of static `import`/`from "./x.js"` edges between emitted chunks
  (script: `scratchpad/closure.mjs`).
- Bundle experiments ran in a throwaway detached worktree, one change at a time, then the
  worktree was removed.
- pdf-lib yield cost: a Node benchmark loads and saves an 8,000-page, 16,043-object document
  built from `test/fixtures/many-pages.pdf` and counts the `setTimeout` ticks.
- Ink commit cost: `finishInkStroke` (apps/web/src/annotations/ink.ts) run in Node on a
  synthetic 5,000-sample cursive stroke.
- Existing evidence: `docs/qa/ink-latency-baseline.md` (P7 to P9) and the ink-latency and
  glass-perf e2e specs.
- Not measured here (needs the browser engine harness): text extraction, render copies and
  wasm compile time. Those items say "measure first" and name the harness to use.

### Baseline numbers (today)

| What loads | Files | Raw | Gzip |
|---|---|---|---|
| First paint (`main` closure: library shell) | 7 | 368 KB | 118 KB |
| Editor (`app` closure, everything static from the app chunk) | 51 | 4,839 KB | 1,622 KB |
| Compact edition (`CompactApp` closure) | 23 | 902 KB | 306 KB |
| PDFium worker script (before the first render) | 1 | 1,576 KB | — |
| `pdfium.wasm` (runtime-cached, not precached) | 1 | 4,647 KB | — |
| Service-worker precache (113 entries) | — | 11.5 MB | — |

The biggest pieces of the editor closure are `src-*.js`, the engine barrel (1,640 KB raw /
505 KB gz: pkijs, fontkit, EmbedPDF engines, PDFium glue, brotli, text-edit, redaction,
signatures), `app-*.js` (1,218 KB / 410 KB), pdf-lib `es-*.js` (561 KB / 243 KB) and the
Paraglide message registry (322 KB / 91 KB).

---

## Ranked optimisations

The ranking weighs gain against effort and risk, so the quick, certain wins come first.
Effort: XS < ½ day, S ≈ 1 day, M ≈ 2–4 days, L ≈ a week or more.

### 1. One constant import pulls the whole engine onto the editor's critical path (measured: −46 % editor JS)

- **What.** `apps/web/src/text-edit/model.ts` imports the value `TEXT_EDIT_SHRINK_FLOOR` from
  the `@pdf-editor/engine` barrel. It is the only static value import of the barrel in the
  editor's static graph, so the 1.6 MB barrel chunk and pdf-lib, which the barrel imports
  statically, become static dependencies of `app`. The engine is meant to load lazily (the doc
  comments in `edit-runner.ts` and `assembler-client.ts` say "its own chunk"); this one import
  undoes that.
- **Where.** `apps/web/src/text-edit/model.ts:9-20` and `packages/engine/src/types.ts:1123`.
  Move the constant to a light module, for example a new `@pdf-editor/engine/constants`
  subpath or the existing `./fonts` entry, or pass it in. Then guard against a repeat (below).
- **Evidence.** Rebuilt with only this change (`import type {…}` and the constant moved out):
  editor closure **4,839 KB → 2,650 KB raw, 1,622 KB → 879 KB gz (−743 KB gz, −46 %)**,
  51 → 50 files. The first-paint closure is unchanged (118 KB gz).
  - Trap found on the way: under `verbatimModuleSyntax` (tsconfig.base.json), a specifier
    list made only of inline `type` modifiers (`import { type A, type B } from 'x'`) still
    emits a bare `import 'x'`, which kept the barrel in the closure. The fix has to be a real
    `import type {…}`.
  - The repo already enforces `consistent-type-imports` with `separate-type-imports`, which
    keeps this right.
  - Turning off Rolldown's `chunkOptimization` or adding a manual `codeSplitting` group did
    nothing by itself. The import is the whole cause.
- **Guard.**
  1. Add an ESLint `no-restricted-imports` entry for `@pdf-editor/engine` with
     `allowTypeImports: true`, scoped to `apps/web/src/**`. Dynamic `import()` is not
     affected. Value imports move to light subpaths.
  2. Add a CI bundle budget (see item 14).
- **Gain.** About 2.2 MB less JS to download, parse and compile before the editor first
  renders. The page stays the same; it simply arrives sooner, most of all on iPad and on a
  first visit.
- **Risk.** Very low. The constant's value is unchanged.
- **Effort.** XS (the guard is S).
- **No quality loss.** `pnpm typecheck`, the text-edit unit tests
  (`text-edit/model.test.ts`, `paragraph-model.test.ts`), and a re-run of the closure script
  showing app ≤ 900 KB gz.

### 2. Each lazy engine use loads the whole engine barrel and pdf-lib on the main thread, and delays the PDFium wasm fetch

- **What.** 31 call sites `await import('@pdf-editor/engine')`. They include
  `getEngineService().createRenderer`, which runs
  `Promise.all([import('@pdf-editor/engine'), getAssembler()])` before
  `createPdfiumProxy(...)`, and `getAssembler()`, which is itself a barrel import. So opening
  the first document loads the 1.64 MB barrel and the 561 KB pdf-lib chunk on the main thread
  (about 750 KB gz). The main thread needs only the Comlink proxies (`create*Proxy`) and a
  handful of pure helpers.
  - Worse, the PDFium worker's `configure()`, which starts the wasm fetch and compile
    (`pdfium.worker.ts` `configure` → `host()`), is posted only after that chunk loads. The
    4.6 MB wasm download waits behind 2.2 MB of main-thread JS.
- **Where.** `apps/web/src/engine/engine-service.ts:1436-1445` (and 598, 1465, 1575, 1676),
  `apps/web/src/engine/assembler-client.ts:17`, `apps/web/src/tools/compress-client.ts:16`,
  and the 25 other dynamic-import sites (`grep "import('@pdf-editor/engine')"`). Add light
  entries to `packages/engine/package.json` `exports`:
  - `./client`: the `create*Proxy` functions, `EngineError`, the protocol types, and the pure
    helpers the UI calls (`parsePageRange`, `presetSettings`, `estimateCompression`,
    `rasterFileName`, `textEditFailureReason`, OCR thresholds, `isReplayRequired`,
    `layoutParagraph`/`decideOverflow`).
  - Heavy main-thread uses stay on the barrel: `applyEngineEditWithResult`,
    `RedactedStringMatcher`, and `validateSignatures` if still main-thread.
- **Gain.**
  - First document open: about −2.2 MB raw / −750 KB gz of main-thread JS.
  - The wasm fetch starts as soon as the worker script runs, not after the barrel loads, which
    is a straight cut to time-to-first-page.
  - Later tool uses (annotate, OCR, compress) stop paying for pkijs and fontkit on the main
    thread.
- **Risk.** Low to medium. Each call site must keep its behaviour. A wrong subpath fails
  typecheck, not at runtime.
- **Effort.** S for the proxies and the engine service (most of the gain); M to move every
  call site.
- **Measure first, then after.** Add `performance.mark`s for `open-click`, `worker-configured`,
  `wasm-ready` and `first-page-bitmap`. The dev timings in engine-service are the pattern;
  enable them in the `RECTO_RENDER_OVERRIDE` test build. Compare on the e2e Chromium harness at
  1440 × 900 with CPU throttling ×4.
- **No quality loss.** The engine-service tests (`engine-service.test.ts`,
  `clipped-repaint.test.ts`), the viewer e2e, and the export e2e.

### 3. pdf-lib yields to the event loop every 50 to 100 objects inside workers (measured: 4.5× in Node, about 3 s of timer floor in browsers)

- **What.** pdf-lib's `load()` yields every `parseSpeed` objects (default `Slow` = 100) and
  `save()` every `objectsPerTick` (default 50), through `setTimeout(0)`. In browsers, nested
  timers are clamped to ≥ 4 ms after 5 levels, and workers clamp too. All our pdf-lib work
  runs in workers (assembler, analysis, compress, signature, PDFium-worker finalisers), where
  there is no UI to keep responsive, so every yield is dead time. Only `signatures/sign.ts`
  and `signatures/fields.ts` already pass `Fastest`/`Infinity`.
- **Where.** The 20 `PDFDocument.load(` sites and 8 `.save(` sites in `packages/engine/src`:
  - `pdflib/pdflib-assembler.ts:570,604`
  - `annotations/finalize.ts:245,328`
  - `text-edit/finalize.ts:91,100`
  - `redaction/scrub.ts:107,223,269,293`
  - `pdflib/inspect.ts:348,365`
  - `compress/compress.ts:99`
  - `ocr/layer.ts:265`
  - `pdfium/form-finalize.ts:145,256`
  - `image-objects/finalize.ts:21`
  - `pdflib/compare-report.ts:527,617`
  - `annotations/conformance.ts:238`
  - `text-edit/content.ts:94`

  Add one helper, `PDFLIB_WORKER_LOAD = { parseSpeed: ParseSpeeds.Fastest }` and
  `objectsPerTick: Infinity`, and use it everywhere.
- **Evidence.** 8,000 pages, 16,043 objects, load then save:
  - Default: 160 + 641 = **801 ticks**, 1,267 ms in Node, where a tick costs about 1 ms.
  - Fastest/Infinity: **0 ticks, 279 ms**.
  - In a browser worker, 801 ticks × 4 ms adds **about 3.2 s of idle floor** on top of the
    work. An export usually runs 2 to 4 such passes (inspect, annotation finalise, assemble,
    scrub).
- **Gain.** Exporting, saving, compressing and redacting large documents gets several times
  faster. Small documents are unchanged.
- **Risk.** Low. Cancellation is the one thing to check: an abort is now seen between passes,
  not inside one. If a pass must stay abortable mid-way, use a large finite value (for example
  5,000) instead of Infinity.
- **Effort.** XS–S.
- **No quality loss.** Output bytes are identical (the tick count does not change
  serialisation). Prove it by hashing the outputs before and after on the fixture corpus
  (golden tests already re-parse every structural operation), plus `export` e2e.

### 4. Stream-compile PDFium once and share the compiled module between workers

- **What.**
  - `initPdfiumModule` (`packages/engine/src/pdfium/host/hosted-engine.ts:142-156`) does
    `fetch → arrayBuffer → init({ wasmBinary })`. Compilation therefore starts only after all
    4.6 MB have arrived, and V8's wasm code cache (which keys on streaming compiles) is never
    used, so every session and every worker compiles from scratch.
  - Three workers each instantiate their own PDFium: the PDFium worker, the compress worker
    (`compress/pdfium-decoder.ts:46`) and the signature worker (`signatures/visual.ts`,
    `pdfiumWasmUrl`).
- **Where.** `hosted-engine.ts` and `compress/pdfium-decoder.ts`. Pass Emscripten's
  `instantiateWasm(imports, done)` hook, using `WebAssembly.instantiateStreaming(fetch(url),
  imports)` and falling back to the current path when the MIME type is not `application/wasm`
  or streaming is unavailable. Optionally compile once (`WebAssembly.compileStreaming`) in the
  PDFium worker or the main thread, and post the `WebAssembly.Module` to the other workers,
  since modules are structured-cloneable to dedicated workers.
- **Gain.**
  - Cold start: compile overlaps the download, which typically saves 100–400 ms on a 4.6 MB
    module on mid-range hardware.
  - Warm starts: V8 can serve the cached machine code.
  - Compress and signature workers: no second or third compile.
- **Risk.** Low to medium. GitHub Pages serves `application/wasm`; the Workbox `CacheFirst`
  response keeps headers. Safari supports streaming. Keep the fallback.
- **Effort.** S (streaming); M (shared module).
- **Measure first.** Marks `wasm-fetch-start`, `wasm-compiled` and `engine-ready` in the
  worker, compared over 5 cold and 5 warm loads (Chromium e2e).
- **No quality loss.** The engine browser tests (`pdfium/host/host.test.ts`) and the full e2e:
  same module, same imports.

### 5. Slim the PDFium worker's start-up script (1.6 MB before the first render)

- **What.** `pdfium.worker.ts` imports, statically, everything the worker might ever do:
  - pdf-lib (1.16 MB source)
  - fontkit (543 KB)
  - text-edit (399 KB)
  - redaction (155 KB)
  - brotli (133 KB)

  The worker must parse and compile all of it before its first message, though opening and
  rendering need only EmbedPDF, the PDFium glue and the adapter. `getTextEditor()` and
  `getImageEditor()` are already lazy *functions* but not lazy *imports*.
- **Where.** `packages/engine/src/worker/pdfium.worker.ts` (imports at the top),
  `pdfium/pdfium-adapter.ts` (redaction, form finalise and annotation finalise, which use
  pdf-lib). Turn the text editor, image editor, redaction pass, OCR layer and form/annotation
  finalisers into `await import()` inside the worker. `worker.format: 'es'` already permits
  code-split workers.
- **Gain.** Roughly −1 MB of worker script on the first-open critical path, partly hidden
  today by the wasm download. Item 4 shortens that download, which exposes it.
- **Risk.** Low. The first text edit or redaction pays a one-off chunk load (tens of ms;
  precached).
- **Effort.** M.
- **No quality loss.** Engine browser tests, plus text-edit, redaction and save e2e.

### 6. Text extraction does one wasm round trip and one malloc per character (measure first)

- **What.** `PdfiumAdapter.getPageText`
  (`packages/engine/src/pdfium/pdfium-adapter.ts:568-648`) asks EmbedPDF for
  `getTextSlices` with **one slice per character**. Each slice does `malloc`,
  `FPDFText_GetText` and `UTF16ToString`, then `free`. `getPageGlyphs` does about 6
  `malloc`s per character in `readGlyphInfo`, and `getPageTextRuns` walks the text page again.
  A dense page (3,000–6,000 chars) makes about 50,000 small wasm calls.
  - Callers: the text layer (each page that scrolls in), search highlights, redaction capture,
    compare facts and text-edit location, all on the one PDFium worker. While it runs, renders
    wait.
- **Where.** Re-implement on the raw-access path the adapter already has (`rawTask` /
  `withRawTask`, `pdfium/host/hosted-engine.ts`): one text-page load, one reusable scratch
  buffer, `FPDFText_GetUnicode` per index (no malloc), `FPDFText_GetCharBox` into the scratch
  buffer, and font size and name per run from the same pass.
- **Expected gain.** 2–5× faster `getPageText`, which also frees the worker sooner for renders
  while scrolling text-heavy files. The figure is an estimate.
- **Risk.** Medium. Character and surrogate parity (`FPDFText_GetUnicode` returns one code
  unit per index, the same indexing `getTextSlices` uses), and the `stripPdfUnwantedMarkers`
  behaviour must be mirrored.
- **Effort.** M.
- **Measure first.** A Vitest browser bench in `packages/engine` on `text-edit-fonts.pdf`,
  `scan-text.pdf` and a dense generated page, timing `getPageText` before and after.
- **No quality loss.** A golden test asserting `getPageText` output is deep-equal (text,
  glyph rects to 1e-6, font size and name) on the whole corpus, old against new, before the old
  path is deleted.

### 7. One fewer full-page pixel copy per render (measure first)

- **What.** The render path makes three full-size buffers: PDFium renders into the wasm heap,
  EmbedPDF copies it into a fresh `Uint8ClampedArray` (`renderRectEncoded`), and the adapter
  wraps that in `ImageData` and calls `createImageBitmap` (a second copy).
  - At DPR 2, a Letter page is about 1,700 × 2,200 px, so each copy is 15 MB. At the 4,096²
    cap it is 64 MB.
- **Where.** `pdfium-adapter.ts:532-557`. Render through the raw path:
  `FPDFBitmap_CreateEx` on our own heap buffer, then
  `new ImageData(new Uint8ClampedArray(HEAPU8.buffer, ptr, bytes), w, h)`, `createImageBitmap`,
  then `free`. Keep `FFLDraw` for forms, as EmbedPDF does. Consider
  `createImageBitmap(…, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })` for
  opaque renders, after checking pixel parity.
- **Gain.** Saves one 15–64 MB copy and its allocation per render: a few ms per page and lower
  peak memory, which matters most in tiled zoom and on iPad.
- **Risk.** Medium. Fidelity: the flags and matrix must match EmbedPDF's `renderRectEncoded`
  exactly.
- **Effort.** M.
- **No quality loss.** A pixel-exact comparison (`pixelmatch` threshold 0) of old against new
  bitmaps over the corpus at three scales and four rotations, with clips and forms.

### 8. Size the bitmap cache to the device and trim it under pressure

- **What.** `DEFAULT_CACHE_BUDGET_BYTES` is a fixed 150 MB on every device
  (`apps/web/src/engine/bitmap-cache.ts:48`). On top of it, each visible canvas keeps its own
  copy of the pixels, and the clipped repaint allocates a full `OffscreenCanvas` per patch.
  `render-quality.ts` already detects small devices (deviceMemory ≤ 4 or cores ≤ 4) but the
  cache ignores that. iPad Safari has a hard total canvas/bitmap memory ceiling, and a
  tab over it is reloaded.
- **Where.**
  - `engine-service.ts:483-486`: pass `cacheBudgetBytes` from the size class and
    deviceMemory, for example 64 MB on small devices and the compact edition, 150 MB by
    default, 256 MB at ≥ 8 GB.
  - Drop offscreen entries on `visibilitychange: hidden`.
  - Drop the oldest half when a render fails with `out-of-memory` (the worker already maps
    `RangeError` to it).
- **Gain.** Fewer iPad tab reloads on long sessions and big zooms. Desktop is unchanged.
- **Risk.** Low. A smaller cache means scrolling back re-renders sooner (the lower-resolution
  preview covers it).
- **Effort.** S.
- **No quality loss.** `bitmap-cache` unit tests, plus a long-scroll e2e at tablet size
  (1180 × 820, touch) watching `usedBytes`.

### 9. Background engine work competes with the visible page on one worker

- **What.** Everything shares the single PDFium worker and its source locks:
  - OCR rasterisation (`renderForOcr`)
  - text extraction for compare and redaction
  - search batches (EmbedPDF runs 25-page chunks as one synchronous task at LOW priority)
  - offscreen thumbnails
  - visible-page renders

  `EngineService` prioritises only its own render jobs. During a 300-page OCR run or a search,
  scrolling waits behind whole chunks.
- **Where.**
  - Short term (S): in `engine-service.ts`, gate OCR and compare page work behind the render
    queue (yield while any priority-3 job is pending). Lower the search chunk size by driving
    `searchBatch` per 5 pages from the adapter instead of `searchAllPages`
    (`pdfium-adapter.ts:650-685`).
  - Later (L, after V1): a second, read-only PDFium worker for background jobs on devices with
    ≥ 8 GB. It costs memory and must reopen after content edits.
- **Gain.** Scrolling stays smooth during OCR, search or compare (fewer long frames).
- **Risk.** Low (short term) or medium (second worker).
- **Effort.** S, or L.
- **Verify.** Long-animation-frame count during "scroll while OCR runs" in a new e2e, with the
  same harness style as `ink-latency.spec.ts`.

### 10. OCR pool capped at two recognisers

- **What.** `packages/engine/src/ocr/recognizer.ts:71,136` uses two workers when
  `hardwareConcurrency ≥ 4`, else one, and the comment records 1.65× on 4 vCPU. 8- to 12-core
  desktops leave most cores idle on multi-page OCR.
- **Where.** `recognizer.ts`: `min(4, floor(cores / 2))` when `deviceMemory ≥ 8` (or unknown
  on desktop), else today's rule. `apps/web/src/ocr/ocr-run.ts:59` (pages in flight) follows.
- **Gain.** About 1.4–1.8× on multi-page OCR on desktop (estimate; measure).
- **Risk.** Memory: each Tesseract worker holds tens of MB plus the language pack.
- **Effort.** XS.
- **Verify.** Recognised text is identical (each page is recognised independently). Time the
  `recognize.test.ts` corpus with pool sizes 2, 3 and 4.

### 11. Split rarely used editor surfaces out of the 1.2 MB app chunk

- **What.** After item 1, `app-*.js` (1,218 KB raw / 410 KB gz) is most of the editor's JS.
  It statically holds surfaces most sessions never open: Compare view, Batch, furniture
  dialogs, signature dialogs, convert, the history scrubber. Several sheets are already lazy
  (`BatchSheet`, `OcrSheet`, `SaveCopySheet`).
- **Where.** Check the app chunk's sourcemap for the largest `apps/web/src/*` modules. Give
  each heavy surface a `lazy()` boundary at its existing open command, with the chunk
  prefetched on hover or idle so nothing visibly waits.
- **Gain.** An estimated 100–200 KB gz less on editor open.
- **Risk.** Low to medium: a first-open flash if prefetch misses. No layout change.
- **Effort.** M.
- **Verify.** The bundle budget (item 14) and the e2e for each surface.

### 12. Paraglide registry: both locales of every message load eagerly

- **What.** `registry-*.js` holds 1,600 message modules (2 MB source; 322 KB raw / 91 KB gz),
  pulled in by `commands/registry.ts`, which imports every command label. Each message
  function carries EN and TR.
- **Where.** `apps/web/src/commands/registry.ts` and the Paraglide compile options. Evaluate
  per-locale output, or lazy labels for commands that are not on screen.
- **Gain.** About 40–50 KB gz.
- **Risk.** Low to medium: i18n plumbing; nothing user-visible.
- **Effort.** M. **Low priority.**

### 13. Long-stroke commit: profile before optimising

- **What.** A 5,000-sample stroke still takes 165–230 ms to "committed visible"
  (ink-latency-baseline, P8). `finishInkStroke` itself measures **15–43 ms** in Node on a
  5,000-sample cursive stroke (dedupe, Catmull-Rom, Douglas–Peucker with width), so most of the
  time is elsewhere (outline, store update, the dry layer's first draw). Short strokes and
  bursts already meet the ≤ 50 ms target.
- **Where.** Capture a Chromium performance trace of the 5,000-sample case in
  `e2e/ink-latency.spec.ts`. If simplification shows up, make it incremental over the stable
  prefix while the pen is down (the preview already bakes its stable part).
- **Effort.** S to profile. **Low priority**: it affects only very long single strokes.

### 14. Guard rails: bundle and start-up budgets in CI

- **What.** `docs/ARCHITECTURE.md` §8 promises "a Lighthouse CI budget on total JS+WASM bytes
  and interaction latency", but nothing in `.github/workflows` or `tools/` enforces one. The
  regression in item 1 went in unnoticed.
- **Where.** A small `tools/qa/bundle-budget.ts`, with the closure walk from this audit, run
  after `pnpm build` in CI. Suggested limits, gzip:
  - first paint ≤ 130 KB
  - editor ≤ 900 KB after item 1, ≤ 650 KB after item 11
  - first-open main-thread engine ≤ 120 KB after item 2
  - PDFium worker script ≤ 700 KB raw after item 5

  Also add a `startup.spec.ts` e2e (Chromium, one worker) that records click-to-first-page
  marks and soft-fails at about 2× the measured value, as `ink-latency.spec.ts` does.
- **Effort.** S.
- **Risk.** None to users.

### 15. Smaller hygiene items (do opportunistically)

- `packages/engine/package.json` has no `sideEffects` field. After auditing modules with
  top-level effects, declare `"sideEffects": false` (or a list). Rolldown can then tree-shake
  the barrel for the remaining heavy dynamic imports.
- `EngineService.next()` scans every job and every subscriber per pump: O(n) per dequeue,
  O(n²) per burst. Fine at today's job counts (overscan-bounded), but a bucketed queue (three
  priorities, FIFO each) is simpler and O(1).
- `tools/repair.ts` is imported both statically (`tool-commands.ts`) and dynamically
  (`document/diagnostics.ts`), so the dynamic import does nothing (build warning). Pick one.
- fontkit is imported statically by `text-edit/finalize.ts` and `text-edit/fonts.ts` but
  dynamically elsewhere (build warning). After item 5, make the text-edit side dynamic too.

---

## Checked and found sound (no change recommended)

- **Ink pipeline.** P7–P9 already deliver:
  - the dry layer (committed visible p95 21–39 ms)
  - append-in-place for bursts (6–7 ms against 25–32 ms)
  - clipped repaints (0.3 ms against 16–19 ms)
  - `getCoalescedEvents`/`getPredictedEvents` and a `desynchronized` preview canvas
- **Bitmap cache and tiles.**
  - Exact-scale keys with quarter-octave buckets for thumbnails.
  - A 4,096² cap with tiles (`TiledPage`), and a 2,048² cap in the compact edition.
  - Lower-resolution previews while a sharp render runs.
  - Stale-job guards on revision changes.
- **Session snapshots.** `serializeHistoryTail` interns sources, documents, pages and edits
  by identity, so 20 history steps do not mean 20 copies. Writes are debounced (700 ms,
  ≤ 1.8 s) and immutable source bytes are written once. The OPFS writer runs in a worker.
- **Text layer.** One span per line, with memoised width measurement (`viewer/text-spans.ts`).
- **List virtualisation.** Thumbnails, Find results, Review and Outline all use
  `@tanstack/react-virtual` with bounded overscan.
- **Service worker.** Registered from an idle callback (10 s timeout), so the 11.5 MB precache
  does not compete with the first load. Wasm, OCR and media are runtime-cached, not
  precached. EmbedPDF's own `worker-engine-*.js` is never fetched and is excluded.
- **First paint.** 118 KB gz, with the UI font preloaded.

## Suggested order for the V1 run

1. **Wave A (about a day, highest certainty):**
   - item 1 (constant + lint guard)
   - item 3 (pdf-lib ticks)
   - item 14 (budgets, so A's gains are locked in)
   - item 10 (OCR pool)
2. **Wave B:**
   - item 2 (engine client entry + earlier wasm fetch)
   - item 4 (streaming compile)
   - item 8 (adaptive cache)
3. **Wave C (measure first, golden-gated):**
   - item 6 (text extraction)
   - item 7 (render copy)
   - item 5 (worker slimming)
   - item 9 short term
4. **Later:** items 11, 12, 13, 15; the second PDFium worker after V1.

Each wave ends with:

- `pnpm typecheck`, `pnpm lint`
- the touched Vitest suites (`--maxWorkers=1`)
- the bundle-budget script
- the viewer, export, text-edit and ink-latency e2e on Chromium
- screenshots at 1440 × 900 and 1180 × 820 (touch) to confirm the UI is unchanged
