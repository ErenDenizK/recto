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
