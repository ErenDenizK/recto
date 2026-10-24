# Phone first load (R23, Now #5)

What a first-time phone visitor downloads, measured on a fresh `origin/develop` build
(`b962464`, `RECTO_RENDER_OVERRIDE=1 pnpm build`). The two clear wins are on branch
`r23/phone-first-load`, and the larger cuts are written up as proposals below. No bundle gate
moved (PRC-11), and the first paint is unchanged (PRC-20: 74.0 KB gzip).

## Method

- **Build**: `apps/web/dist`, as deployed. The precache list is read from `dist/sw.js`
  (`precacheAndRoute`); sizes are raw bytes (what `tools/qa/bundle-budget.ts` gates) and Node
  zlib gzip (what goes over the wire, since GitHub Pages gzips text, JS, CSS and wasm).
- **Device**: Playwright Chromium, Pixel 7 profile at 390×844, DPR 3, touch, so the edition
  rule picks the compact edition by itself (no `?edition`). CPU throttled 4× through CDP
  (`Emulation.setCPUThrottlingRate`).
- **Network, Fast 4G**: 9 Mbps down and 170 ms per request. The throttle sits in the static
  server, as one shared link with gzip like Pages and `Cache-Control: max-age=600`, because
  CDP's network emulation does not apply to the service worker's own fetches, and those
  fetches are most of the bytes. Requests whose `Referer` is `sw.js` are counted as the
  worker's.
- **Steps**: a fresh profile opens `/`, waits for `compact-library` with **Try the sample**
  ("Library"), taps it, and waits for page 1's canvas to reach `data-state="rendered"`
  ("Sample"). It then waits until the link has been quiet for 4 s ("Quiet": the precache is
  installed and the wasm is warmed). Three runs per build; the table gives the medians.
- The scripts are not in the repo (they were throwaway). They are about 150 lines: a throttled
  `http` server plus a Playwright driver.

## Before and after

| Measure                                    | Before (`develop`)   | After (branch)       | Change          |
| ------------------------------------------ | -------------------- | -------------------- | --------------- |
| Precache, entries                          | 183                  | 182                  | −1              |
| Precache, raw (budget measure)             | 13,465 KiB           | 13,197 KiB           | −268 KiB (−2 %) |
| Precache, gzip                             | 5.31 MiB             | 5.05 MiB             | −0.26 MiB       |
| Time to Library (phone, Fast 4G, 4× CPU)   | 2.3 s                | 2.4 s                | noise           |
| Bytes by Library                           | 393 KB               | 388 KB               | noise           |
| Time to the sample's first page            | 7.4 s                | 7.6 s                | noise           |
| Bytes by first page                        | 4,646 KB             | 4,641 KB             | none            |
| … of which the service worker's            | 1,012 KB             | 1,012 KB             | none            |
| Whole first visit (until quiet)            | **8,524 KB**         | **7,457 KB**         | **−1,067 KB (−12.5 %)** |
| … of which the service worker's            | 3,921 KB             | 3,652 KB             | −269 KB         |
| … of which qpdf wasm (warm-up)             | 799 KB               | 0                    | −799 KB         |
| Time until quiet (offline-ready and warm)  | 26.5 s               | 27.1 s               | noise           |
| First paint JS gzip (V1-P1)                | 73.9 KB              | 74.0 KB              | +0.1 KB         |
| Compact closure JS gzip                    | 273.6 KB             | 273.6 KB             | none            |

Reference: with the service worker blocked, the same phone reaches the Library in 2.2 s and the
sample in 7.0 s after 3,634 KB, and the visit totals 3,801 KB. So the service worker costs
**about 0.4 s on the sample's first page** (it pulls ~1 MB in parallel while the sample opens)
and **3.7 MB (before) or 3.65 MB (after) over the whole visit**.

## 1. What the service worker precaches

`apps/web/vite.config.ts` (`VitePWA`, `generateSW`): `globPatterns`
`**/*.{html,js,css,woff2,ttf}` and `sample/*.pdf`, with the manifest and (before) its icons.
Wasm, `ocr/**`, `media/**`, `lab/**`, `404.html` and EmbedPDF's `worker-engine-*` are already
excluded. Wasm is runtime-cached (`pdf-editor-wasm`, CacheFirst) and warmed by
`src/pwa/register.ts`.

| Group                            | Files | Raw        | Gzip       | Phone uses it?                                    |
| -------------------------------- | ----- | ---------- | ---------- | ------------------------------------------------- |
| JS (app, editions, workers)      | 127   | 11,007 KiB | 3,993 KiB  | partly; see §3                                    |
| Engine TTFs (Noto, Inter, Mono)  | 6     | 1,201 KiB  | 615 KiB    | yes, for text, edit text and furniture            |
| CSS                              | 34    | 466 KiB    | 96 KiB     | partly                                            |
| Teaching samples (4 PDFs)        | 4     | 343 KiB    | 312 KiB    | one of four (`recto-sample-phone-<lang>.pdf`)     |
| Manifest + icons                 | 6     | 299 KiB    | 297 KiB    | no page shows the 512 px tiles                    |
| UI fonts (woff2)                 | 4     | 116 KiB    | 116 KiB    | yes                                               |
| HTML (`index.html`, about)       | 2     | 35 KiB     | 9 KiB      | `index.html`                                      |

Not precached and fetched at runtime: `pdfium-*.wasm` 4,538 KiB raw / 2.1 MB gzip (the page
fetches it to open the sample), and `qpdf-*.wasm` 2,914 KiB raw / 0.8 MB gzip (before: warmed
on every first visit, phones included).

The largest precached JS: `src-*.js` 1,593 KiB (pkijs, fontkit and the EmbedPDF engine on the
main thread), `pdfium.worker` 1,592, `signature.worker` 1,167, `app` 859 (the full edition),
`compress.worker` 743, `assembler.worker` 645, `analysis.worker` 629, `es-*.js` 561 (pdf-lib),
and two `browser-module-*.js` at 363 each. Those two are **fontkit, bundled twice**, once for the
assembler worker and once for the analysis worker, plus a third copy inside `src-*.js`.

Workbox installs the precache **one entry at a time** (`workbox-precaching` 7.4.1,
`PrecacheController.install`, workbox#2528). On a 170 ms link, 182 entries take about 25 s
before the app is offline-ready, however few bytes they hold. The entry count matters as much
as the bytes.

## 2. What a first phone visit fetches

- **By the Library (2.3 s, 393 KB)**: the first paint (74 KB gzip of JS), `CompactApp` and its
  closure, `inter-recto-latin.woff2`, and `index.html`. The service worker has fetched only
  7 KB by then.
- **By the sample's first page (7.4 s, 4.6 MB)**: `pdfium.wasm` (2.1 MB gzip) and
  `pdfium.worker` (586 KB gzip) are the bulk. `assembler.worker` (272 KB),
  `PinchDetentChip.module` (100 KB, see P4), the phone sample (70 KB), and the precache's
  first ~1 MB arrive alongside them.
- **After that (until ~27 s)**: the rest of the precache (~2.6 MB), then (before) qpdf's wasm.
  The phone sample is fetched twice: the page asks for it before the worker has it, and the
  worker's copy carries `__WB_REVISION__`, so the HTTP cache does not serve it.

## 3. Precached bytes a phone never uses

A reachability walk from `index.html` with the full edition's `app` chunk cut finds 1,267 KiB
raw (408 KiB gzip, 18 files) that no compact code path can load: `app`, `BatchSheet`,
`SaveCopySheet`, `SettingsSheet`, `CompareView`, `ChangesPanel`, `rasterize` and their CSS. The
walk is an upper bound: every worker factory sits in one shared chunk (`session-store`), so all
workers look reachable. By reading the call sites:

- **qpdf** (`compress.worker`, 743 KiB raw, and its wasm) runs only for Compress, the repaired
  copy, Save a copy's rasterize, and an export with a compression preset. None of these exists
  on the phone, and no compact surface sets a preset.
- **About**: `about/index.html` and `about-*.css` (39 KiB raw) belong to the about page, which
  the app never opens. The About media is already outside the precache (`media/**`).
- **Samples**: the full-edition samples (`recto-sample-{en,tr}.pdf`, 202 KiB) and the other
  language's phone sample.
- **Icons**: the 512 px tiles (`icon-512.png`, `icon-maskable-512.png`, 268 KiB, already
  compressed). The browser reads them when it installs the app, online; no page uses them.
- **Fonts**: the phone uses them. Text and edit text embed the
  engine TTFs, so they stay.

## Changes made (branch `r23/phone-first-load`)

1. **The compact edition warms PDFium only** (`src/pwa/register.ts`, `warmWasmUrls`). The full
   edition still warms PDFium and then qpdf, as PF-17 asks for its Compress and repaired-copy
   jobs. A phone skips qpdf's 2.9 MB (0.8 MB gzip), which it never runs. If a future phone
   surface needs qpdf, the engine fetches it on first use into the same CacheFirst runtime
   cache. Unit test in `src/pwa/register.test.ts`.
2. **The 512 px manifest tiles leave the precache** (`vite.config.ts`: `includeManifestIcons:
   false`, plus `icons/*.svg` and `icons/icon-192.png` in `globPatterns`). The manifest, the SVG
   icons, the favicon glyph and the 192 px tile stay precached. This takes 268 KiB off every
   install, for every edition. The precache measure drops from 13,465 to 13,197 KiB.

Offline behaviour is unchanged for everything the phone uses: the app shell, every chunk, the
fonts, the samples and PDFium's wasm. `e2e/offline.spec.ts` runs the full edition, which still
warms both wasm files, and it passes (Chromium). A phone check on the branch build passed too:
one online visit (`pdf-editor-wasm` then holds only PDFium), then offline, reload, **Try the
sample**, and page 1 renders in the compact edition.

## Changes made (R25, P4)

- `targetPages` moved from `commands/app-commands` to `stage/arrange-data`. `stage/section-operations`
  and the page-drag code no longer import `app-commands`, which pulled `FurnitureDialogs`,
  `forms/create/*` and most desktop modules into the shared chunk the phone loads with the
  sample. The `editionGroups` split (PRD-26) did not cover this: the shared chunk
  `PinchDetentChip.module` was 77.5 KB gzip; it is now 7.6 KB. No `vite.config.ts` change.
- Bundle budget, before to after: first paint 74.0 to 73.9 KB; editor initial 777.0 to
  770.1 KB (50 to 44 files); compact edition 285.0 to 284.6 KB; precache 210 to 203 entries.
- Phone, unthrottled, service worker blocked, by the sample's first page: 572 KB gzip of JS
  and CSS (workers and wasm excluded); `PinchDetentChip.module` is 7.6 KB of it.

## Proposals (not done: each changes a recorded decision or needs a lane)

- **P1. Precache by edition** (needs a PF-17 amendment; owner/lead). Precache what both editions
  need. Runtime-cache the full-only chunks (`app`, the desktop sheets, Compare,
  `compress.worker`, `rasterize`) and have the full edition warm them after offline-ready, the
  way it warms the wasm. A phone would skip at least 408 KiB gzip (1.3 MiB raw) plus
  `compress.worker` (291 KiB gzip), and about 20 serial precache requests (~3.5 s of install at
  170 ms each). The desktop stays fully offline once the warm-up finishes. `bundle-budget.ts`'s
  PF-17 check and `offline.spec.ts` would read the warmed cache as well as the precache.
- **P2. One fontkit for the workers** (engine lane). The assembler and analysis workers each
  bundle fontkit (`browser-module-*`, 151 KiB gzip each), and the main thread's `src-*.js` has
  a third copy. One shared worker chunk saves ~151 KiB gzip of precache and one entry. Check
  first whether the main-thread copy can stay out of the precache path at all.
- **P3. Samples per edition** (MOB-13 says all four are precached). Precache the phone samples
  only in the compact edition, or only the launch language's file. That saves 202–272 KiB per
  install. Also let the page's sample fetch go through the worker's cache (or drop the
  revision query for it), so the phone stops downloading it twice (70 KB).
- **P4. `PinchDetentChip.module` on the phone** (bundle lane). The phone loads this 100 KiB
  gzip shared chunk when the sample opens, and it holds desktop modules (`FurnitureDialogs`,
  `forms/create/*`, `commands/app-commands`). Splitting it so the phone's lazy path gets only
  `PinchDetentChip` would cut ~80–90 KiB gzip from the time to first page.
- **P5. Start the precache after the first page** (lead, technique). Today the worker
  registers at boot (`immediate: true`) and pulls ~1 MB while the sample opens, about 0.4 s of
  the 7.4 s. Registering once the first document has rendered, or 5 s after the Library if
  none opens, would give the sample the full link. Offline-ready would come ~2–5 s later on a
  first visit.
- **P6. Smaller manifest tiles** (brand/media). Even out of the precache, `icon-512.png` is
  143 KiB and the maskable one 126 KiB. A palette-quantised PNG from `tools/media app-icons`
  would likely be under 40 KiB each.

## Changes made (R25)

Branch `r25/phone-first-load`, measured on the same profile as the table above (Pixel 7, 4× CPU,
9 Mbps and 170 ms per request, fresh profile, three runs, `RECTO_RENDER_OVERRIDE=1` builds) on a
busy shared machine, so the times below are noisy (the sample's first page ranged 6.9 to 12.8 s
within one build) and the bytes are the signal.

1. **P5, done (PF-20).** The worker registers when the first page canvas reaches
   `data-state="rendered"`, or 5 s after the edition's chunk has loaded and the Library shows
   (`src/pwa/register.ts`, `runAfterFirstPage`; the fallback clock starts in `main.tsx`). Bytes by
   the sample's first page, of which the service worker's: 3,935 KB (131 KB) on `develop`,
   3,825 KB (14 KB) with P5. The first-page time did not separate from the noise. The editor
   initial JS stays at 829.9 KB gzip (+0.1 KB). `offline.spec.ts` (2 tests), `sample.spec.ts` (7,
   including its offline test) and `compact-overview.spec.ts` on the phone project pass without a
   changed wait: the specs already wait on the worker's state, not on a clock.
2. **P4, built; held back at the gate on the R25 branch, landed on `develop` as `bf86218` (R27 check below).** The 100 KB gzip `PinchDetentChip.module` chunk existed
   because `stage/section-operations` (reached by the phone's Pages overview through `dnd/drop`)
   imported `targetPages` from `commands/app-commands`, and `app-commands` reaches almost every
   desktop module. Moving `targetPages` into `stage/arrange-data` cuts that edge: the chunk drops
   from 99.4 KB to 7.7 KB gzip, and `FurnitureDialogs`, `forms/create/*` and `app-commands` leave
   the phone's path (together with P5, 3,681 KB by the first page, 254 KB less than `develop`).
   Rolldown now cuts the desktop side along its importer sets into `app-commands` (68.7 KB gzip)
   and about nine small fragments, so the editor initial JS rises from 829.8 to 836.6 KB gzip
   (+1.4 % over the baseline, past the 1 % cap) while the compact edition falls to 278.3 KB. A
   `codeSplitting` group for the fragments recovered only 1.8 KB, and a wider group pulled
   pdf-lib, fontkit and the OCR recognizer into the editor's initial load. `tools/qa/bundle-budget.ts`
   also needed its chunk pattern to take an 8-character hash, because the new `app-commands-<hash>`
   chunk matched `app-*`. Not merged as is: it needs about 3.5 KB gzip saved elsewhere in the editor
   initial JS, or a baseline the owner accepts (PRC-11).

## Changes made (R27, P2 and P6)

Branch `r27/perf-fontkit-icons`. Measured on `RECTO_RENDER_OVERRIDE=1` builds of `develop`
(`6cc589e`) and the branch, with `tools/qa/bundle-budget.ts` and the precache list read from
`dist/sw.js` (gzip is Node zlib; PNG and woff2 counted as stored).

1. **P2, one fontkit for the app and the assembler and analysis workers.** Each `?worker` is its
   own build, so config cannot share a chunk between them. The page's build now emits fontkit once
   as the entry `assets/fontkit.js` (`sharedFontkit` in `vite.config.ts`, entry
   `packages/engine/src/fontkit-entry.ts`) and the assembler and analysis worker builds leave
   `@cantoo/fontkit` external, pointing at that file; the main thread's lazy chunks import the same
   chunk, so three copies (`browser-module-*`, 363 KiB raw each) became one. `fontkit.js` is
   unhashed, so `workbox.dontCacheBustURLsMatching` excludes it and it keeps a precache revision.
   The PDFium worker keeps its own copy: sharing pushed its gated closure to 1,603 KB (gate
   1,600), because Rolldown also split fflate out of it.

   | Measure (build report)            | `develop`  | Branch     | Change    |
   | --------------------------------- | ---------- | ---------- | --------- |
   | Precache, raw (budget measure)    | 13,340 KiB | 12,611 KiB | −729 KiB  |
   | Precache, gzip                    | 5.10 MiB   | 4.81 MiB   | −0.29 MiB |
   | Precache, entries                 | 213        | 213        | 0         |
   | Editor initial JS gzip            | 778.6 KB   | 778.7 KB   | +0.1 KB   |
   | Compact edition JS gzip           | 288.1 KB   | 288.1 KB   | none      |
   | PDFium worker script, raw         | 1,592.7 KB | 1,592.7 KB | none      |

   `compare`, `text-to-pdf` and `offline` e2e (Chromium) pass. No gate or baseline moved.
2. **P6, quantised 512 px tiles.** `tools/media/lib/app-icons.ts` now passes the two 512 px tiles
   through an ffmpeg palette step (112 colours, no dither, one transparent entry), the tool the
   media encoder already uses. `icon-512.png` 143.3 to 35.8 KiB, `icon-maskable-512.png` 125.6
   to 38.2 KiB. Side by side the gradient shows no banding (64 colours did); the rounded tile's
   anti-aliased corner edge is now one-bit alpha. The other icons and the favicon regenerate
   byte-identical.

## R27 check of P4 on `develop`

The held-back commit is already on `develop` (`bf86218`, branch `r25/phone-p4`), so the R25
item 2 gate problem no longer applies and no further change is needed. A `RECTO_RENDER_OVERRIDE=1`
build of `develop` (`6cc589e`) with `tools/qa/bundle-budget.ts`: editor initial 778.6 KB gzip in
46 files (gate 900, baseline 824.9, -5.6 %); compact edition 288.0 KB (gate 320); first paint
74.2 KB; `PinchDetentChip.module` 7.9 KB gzip (was 99.4); precache 213 files. No gate raised,
no baseline written. The phone e2e specs were not re-run: no source changed in this lane.
