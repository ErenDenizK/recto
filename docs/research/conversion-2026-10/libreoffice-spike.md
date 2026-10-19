# LibreOffice WASM spike: on-device Office to PDF (R23-11, 2026-10-19)

Board-approved spike (2026-10-19) following `memo.md`. Research only; runs were in a scratch dir.

## Verdict

**Conditional go for desktop and tablet; no-go for iPhone.** A real build converts a 5-page DOCX
to a correct 5-page PDF in 1.4 s (0.2 s warm) in Chromium. The cost is a 77 MB download
(about 60 MB at best), about 1.2 GB of peak memory, and cross-origin isolation. Conditions are at
the end. Effort: about 3 weeks for the integration, plus 2 to 4 weeks only if we make our own
smaller build.

## 1. Builds

| Build | Licence | Raw | gzip -9 | brotli 9 | Convert-only? |
|---|---|---|---|---|---|
| `@matbee/libreoffice-converter` 2.7.2 (npm, 2026-07-21; LO 24.8, Emscripten 3.1.74), **measured** | MPL-2.0 | wasm 147.4 MB + data 99.7 MB = **247 MB** | 48.6 + 28.5 = **77.1 MB** | 38.8 + 17.9 = **56.7 MB** | Yes, already headless: `--disable-gui`, no Qt/Java/scripting/DB, LibreOfficeKit only |
| BentoPDF | app AGPL-3.0; binary is the same matbee build (`package.json` `^2.5.0`, ships `soffice.wasm.gz` 48.8 MB + `soffice.data.gz` 28.6 MB) | as above | 77.4 MB | n/a | same |
| ZetaOffice (allotropia) | LO core MPL-2.0, zetajs MIT; CDN on cdn.zetaoffice.net (blocked from this environment) | not measured | not measured | allotropia, SFSCON 2024: "32 MB binary + 15 MB data" | headless use supported (zetajs `convertpdf` example); built with Qt for UI |
| LibreOffice's own port (`static/README.wasm.md`) | MPL-2.0 | n/a | n/a | n/a | Qt5 GUI build (Writer only); or headless: `--disable-gui --with-wasm-module=writer` (or `all` for Calc and Impress) |

BentoPDF is not a separate build: its "LibreOffice WASM" is the matbee package, so it is one option,
not two.

**Smallest realistic package (Writer, Calc and Impress filters plus PDF export):** the data file is
mostly fonts (matbee's `docs/OPTIMIZATION.md`: 53 MB of fonts). Keeping only Liberation, Carlito,
Caladea, DejaVu and Noto Sans/Serif cuts about 40 MB raw, giving about **60 MB gzip or 50 MB brotli
(about 200 MB on the device once inflated)**. GitHub Pages cannot send `Content-Encoding: br` for
our files and `DecompressionStream` only does gzip in all three engines, so plan on gzip. The wasm
is 147 MB raw, over GitHub's 100 MB file limit, so we ship it pre-gzipped (as BentoPDF does) and
inflate it in the browser. Inflating takes 1.2 s for both files (Node zlib). Going below about
45 MB needs our own LO build. (hours long; may not fit a GitHub runner).

## 2. Cross-origin isolation

**Required.** Every build above uses pthreads: `soffice.js` creates `new WebAssembly.Memory({initial: 1 GiB,
maximum: 4 GiB, shared: true})`, with `PTHREAD_POOL_SIZE=4` and `PROXY_TO_PTHREAD`. LO's README:
"you can't use modules and threads", and LO's VCL needs threads. No non-threaded LO WASM build
exists, and making one is an unknown-size porting job. Our run confirmed `crossOriginIsolated === true`
was needed.

GitHub Pages cannot send COOP/COEP. The **service-worker shim** (coi-serviceworker technique) is
viable because Recto already has a Workbox service worker that controls every page. The worker
re-serves navigations with `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`. This is our own worker; we do not add coi-serviceworker.
What it breaks or costs:

- **The first visit is not isolated.** The page has to reload once after the worker takes control.
  We do this after the consent, never on a cold start.
- **No service worker, no conversion.** Firefox private windows and some managed browsers have no
  service worker.
- **COOP severs `window.opener`.** Recto only opens with `noopener` (`app-commands.ts`, `deliver.ts`),
  so nothing breaks today.
- **COEP blocks cross-origin subresources without CORP.** Recto has none: the CSP is
  `default-src 'self'`, with `font-src 'self'`, `connect-src 'self'` and `img-src 'self' blob: data:`.
  Fonts are self-hosted (`public/fonts`), and the privacy indicator counts external requests. Only
  the `og:image` meta in `index.html` is absolute, and it is never fetched. **COEP would block
  nothing in the app.** Safari has no `credentialless`, so we use `require-corp`.
- **Reload loops.** Guard the reload with a sessionStorage flag, and add the headers only once
  the package is installed, so users who never convert keep today's behaviour.

## 3. Memory and time (measured)

Machine: 4 cores, 15 GB of RAM, shared with other lanes. Input: a generated
5-page A4 DOCX (Calibri/Cambria body, a Calibri Light heading, an 8×5 table, header, PAGE field,
Turkish text). Package served from localhost with COOP/COEP, so download time is excluded.

| Runtime | Init (fetch from localhost + compile + LOK) | First convert | Warm convert | Peak memory |
|---|---|---|---|---|
| Chromium 141 headless (3 runs) | 2.4–2.7 s | 1.4–1.6 s | 0.19–0.23 s | about +1.2 GB over baseline across browser processes (670 → 1,840–1,900 MB); renderer high-water 751 MB |
| Node 22 (9 runs) | 2.4–3.7 s | 1.8–3.5 s | 0.26–0.9 s | RSS 1.1–1.35 GB |

Every output was a 5-page PDF with fonts embedded. The same build also converted a 13-slide PPTX
(4.2 s) and an XLSX (0.4 s). Download time on top of this: 77 MB is about 12 s at 50 Mbit/s and
about 60 s at 10 Mbit/s.

**Deadlock found.** With the shipped `pthreadPoolSize=4`, Chromium hung for good at "Loading
document" in 2 of 2 runs, more than 10 minutes each. Node stalled for about 60 s in 2 of 9 runs. The
cause is the one LO's README describes: the pre-spawned worker pool runs out while the LO thread
blocks. Patching a scratch copy to `pthreadPoolSize=16` fixed it in 3 of 3 runs. Shipping the build
means changing `soffice.js` (an MPL file, so we publish the change) or rebuilding it.

**iPhone: no-go with any current build.** The module reserves 1 GiB of shared memory before it
starts, and peaks near 1.2 GB. WebKit publishes no per-tab cap. Instead of failing
`memory.grow()`, iOS kills the tab (WebKit bug 221530). Reports show about 1 GB on a first load,
but only 300–500 MB after a reload (bug 269777), and jetsam kills at about 1.5 GB (bug 227636).
Safari supports shared memory with COOP/COEP from iOS 15.2, but a 1 GiB shared allocation plus
200 MB of inflated package is not realistic on a phone. matbee tests no WebKit. iPad (M-series, 8 GB or more) and
macOS Safari are plausible but unmeasured: test on a device before claiming them. The compact
edition should not offer conversion.

## 4. Fidelity

What we saw: Calibri→Carlito and Cambria→Caladea (metric-compatible, so the 5-page pagination
held), and Turkish glyphs were fine. **"Calibri Light" fell back to Noto Serif**, so headings
switched to a serif face. Fonts users will notice:

- **Aptos**, the Microsoft 365 default since 2023. It has no metric-compatible free font, so
  recent documents reflow and page counts can change. This is the biggest single issue.
- **Calibri Light, Segoe UI, Century Gothic, Garamond, Georgia, Verdana, Tahoma.** These need
  substitution entries; the default fallback is DejaVu or Noto.
- **CJK.** Not bundled; matbee's CJK pack is about 250 MB. Offer it as a separate optional pack, or
  not at all.

Bundle Liberation (Arial, Times, Courier), Carlito, Caladea, DejaVu and Noto Sans/Serif (Latin,
Greek, Cyrillic), plus a substitution table (Calibri Light→Carlito; Aptos→Carlito, accepting the
reflow). Known LO import gaps (not measured here): SmartArt, floating text boxes, complex
tables, TOC fields, chart effects. Label the result "converted with LibreOffice; check the
layout" rather than calling it exact.

## 5. Integration sketch

- **Package.** Put it in `convert/<lo-version>/` on our origin (`soffice.js`, `soffice.worker.js`,
  `soffice.wasm.gz`, `soffice.data.gz`, `lock.json` with SHA-256). Fetch, pin and verify it in CI
  from the npm tarball, the way `packages/engine/ocr/fetch.ts` does for OCR (ADR-0012), and never
  commit it. Keep it out of the precache and the bundle budget, with its own runtime-cache rule
  matched before the wasm rule, like `ocr/`. The same-origin location keeps the CSP
  (`connect-src 'self'`) and the privacy indicator at zero.
- **Storage.** Use Cache Storage `pdf-editor-convert`, with the gzip files as fetched (77 MB, not
  247 MB). Inflate with `DecompressionStream` at load (about 1 s) and check SHA-256 as `ocr/packs.ts`
  does. Request `navigator.storage.persist()` at consent; an installed PWA is exempt from Safari's
  7-day eviction. Settings gets "Remove conversion package".
- **Worker.** Load a module worker by dynamic import only when an Office file arrives. It owns the
  LibreOfficeKit instance and runs one conversion at a time. Terminate it after idle to give back
  the memory, about 1 GB.
- **Consent and progress.** On a .docx/.xlsx/.pptx drop or pick (extend `partitionFiles` with an
  `office` group), show a sheet with the size ("77 MB, once; works offline after"), the licence
  link, and Download/Cancel. Progress comes from the `fetch` body; Cancel is an `AbortController`. After that, a one-time reload into the isolated mode, then
  "Converting…".
- **Open path.** Wrap the PDF bytes as `new File([bytes], name.replace(/\.\w+$/, '.pdf'))` and pass
  it to `openDocuments([file])` (`commands/app-commands.ts`), so recents, failure toasts and
  announcements stay as they are.
- **Licences.** LO core and the matbee wrapper are MPL-2.0. We ship them unmodified except for the
  pool-size patch, which we publish (link the patched file and the upstream tag). The package has
  no `LICENSE`/`CREDITS` files, so About gets a "Conversion package" entry with the MPL-2.0 text,
  LibreOffice's third-party notices for the bundled externals, the font licences (OFL, Apache, Bitstream Vera), and a source
  link to the exact LO tag and the matbee commit. MPL is file-level, so Recto's own code keeps its
  licence.

## Conditions for go

1. The board accepts a 77 MB first download (60 MB after font trimming) and about 1.2 GB of peak
   memory. GitHub Pages' soft bandwidth of 100 GB/month covers about 1,300 first-time downloads a
   month.
2. Isolation goes through our own service worker, only after the package is installed, with an
   e2e on all three engines.
3. Fix the pool deadlock (`pthreadPoolSize` ≥ 16, or our own build) and add a conversion timeout.
4. Office conversion only on desktop and tablet; nothing on phones.
5. Fidelity is labelled honestly, and there is a substitution table for Aptos and Calibri Light.

**Effort:** CI fetch, pin and verify, 2 days; service-worker isolation and e2e, 4 days; worker
and storage, 3 days; consent and progress UI with i18n, 3 days; open path and notices, 2 days;
font table and fidelity fixtures, 2 days. That is about 3 weeks. An own slim build (about 45 MB,
lower `INITIAL_MEMORY`) adds 2 to 4 weeks and may need a larger runner than GitHub's.

Sources: npm `@matbee/libreoffice-converter` 2.7.2 (measured) and its repo
(`build/autogen.input`, `docs/OPTIMIZATION.md`); BentoPDF repo (`libreoffice-loader.ts`,
`public/libreoffice-wasm/`, README); LibreOffice `static/README.wasm.md`; zetajs README; allotropia
SFSCON 2024 slides; WebKit bugs 221530, 269777, 227636.
