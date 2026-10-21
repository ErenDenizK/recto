---
title: "ADR-0035: On-device Office to PDF with LibreOffice, downloaded on consent"
date: 2026-10-20
status: accepted
---

# ADR-0035: On-device Office to PDF with LibreOffice, downloaded on consent

**Status:** accepted · **Date:** 2026-10-20 · **Deciders:** the owner as the board (PRD-18,
2026-10-19: "Yes, desktop + tablet"); project lead (the technique below, EDN-19) ·
**Amends:** ADR-0001 (LibreOffice WASM was "out"; it is now allowed as a separately
downloaded, consented package under MPL-2.0 with one published change), ADR-0004 ("no
cross-origin isolation in v1": isolation is now opt-in, after the package is installed) ·
**Rests on:** `docs/research/conversion-2026-10/memo.md` and `libreoffice-spike.md` (the
measured spike); PRC-11 and PRC-20 (bundle gates); PRD-4 (the URL stays on github.io);
PRD-12 (nothing leaves the device)

## Context

Testers ask whether Recto converts Word files to PDF. The spike measured the only realistic
on-device route: LibreOffice compiled to WebAssembly, as published by
`@matbee/libreoffice-converter` 2.7.2 (MPL-2.0, LibreOffice 24.8, headless LibreOfficeKit). It
converts a 5-page DOCX in 1.4 s in Chromium, but it is 247 MB raw (77 MB gzip), needs about
1.2 GB at its peak, runs on pthreads (so `SharedArrayBuffer`, so `crossOriginIsolated`), and
deadlocks with its shipped pool of 4 pre-started threads. GitHub Pages cannot send headers
(ADR-0004), and the owner's rule is no new dependencies. The board approved this as the first
exception, for desktop and tablet.

## Decision

### 1. Obtaining the package: vendored at build time, pinned, served from our origin

Options weighed:

| Option | Verdict |
|---|---|
| npm runtime dependency (`import … from '@matbee/libreoffice-converter/browser'`) | Rejected. It enters `package.json`, the lockfile and the module graph (its wrapper and `zod` would be one careless static import away from a gated closure), Renovate bumps it like any library, and the 147 MB wasm would still need hosting. |
| Commit the files (or Git LFS) | Rejected. The wasm is over GitHub's 100 MB file limit, and the history would carry 77 MB per bump. |
| A third-party CDN (ZetaOffice, jsDelivr) | Rejected. Breaks `connect-src 'self'`, the privacy indicator's zero and PRD-12; another origin would also need CORP under isolation. |
| Our own LibreOffice build (about 45 MB) | Later. 2–4 weeks and maybe a larger runner than GitHub's; the pinned build can be swapped for it behind the same lock. |
| **Vendored at build time from the npm tarball, pinned by checksum, served from `convert/<directory>/`** | **Chosen.** |

How it works (`packages/engine/office/`), the same shape as OCR's packs (ADR-0012) and the qpdf
artifact:

- `office.lock.json` pins the tarball by npm's `sha512` integrity and every served file by the
  SHA-256 of its content (after the patch; inflated for the gzip files), with the patch and the
  directory name (`lo-2.7.2-r2`; a new package or patch gets a new directory).
- `fetch.ts` downloads the tarball, refuses it unless the integrity matches, takes five files
  (`browser.worker.global.js`, `soffice.js`, `soffice.worker.js`, `soffice.wasm`,
  `soffice.data`), applies the patch (§3), gzips the two large ones (level 9) and writes
  `vendor/<directory>/` (git-ignored). `--verify` checks without the network; `--pin` re-pins.
- `assets.ts` is a Vite plugin: it serves the package in dev and copies it into
  `dist/convert/<directory>/` at build, checking every file against the lock first. A build
  without the vendored files still succeeds and ships no `convert/`; the download then reports
  the package missing.
- Nothing imports the package. The app talks to the package's own worker
  (`browser.worker.global.js`) through its message protocol (`init`, `convert`).

Served sizes (r2, PRD-20): 49.7 MB + 20.4 MB gzip for the wasm and data, 0.6 MB for the rest:
**70.6 MB** (70,609,657 bytes; r1 was 78.9 MB with the data at 28.7 MB).

### 2. Licences

LibreOffice and the converter are MPL-2.0, which ADR-0001 already admits for unmodified files;
MPL is file-level, so Recto's own code keeps Apache-2.0. With the package go
`convert/<directory>/NOTICE.txt` (LibreOffice, the converter, the one modified file, and the
fonts in `soffice.data` with their licences) and `MPL-2.0.txt`, both committed in
`packages/engine/office/`. The consent sheet links the notice; the root `NOTICE` has a
"Downloaded on demand" entry. The fonts include GPL-with-font-exception faces (Culmus, Linux
Libertine G), shipped unmodified as separate data files (aggregation, not linking); phase 2
checks each font's licence against its file and trims the set (spike §1), and adds an
About entry with the texts.

### 3. The threads patch

`soffice.js` sets `var pthreadPoolSize=4;`. LibreOffice blocks its main thread while it starts
more threads, the four pre-started workers run out, and "Loading document" never ends (spike
§3: 2 of 2 Chromium runs hung). `fetch.ts` replaces it with `var pthreadPoolSize=16;`, asserting
the site occurs exactly once, and the lock records the patch and why. Being a change to an MPL
file, the modified file is published: it is served beside the notice, and the patch is in this
repository. The converter host also has timeouts (3 min to start, 2 min per file) that terminate
the worker, so a deadlock of any other kind cannot hang the app.

### 4. Storage and cross-origin isolation through our own service worker

- **Storage: Cache Storage**, cache `pdf-editor-office`, not OPFS: the service worker must
  answer the converter's requests with `Response`s and headers, which a cache holds as they are.
  Files are stored as fetched (gzip, 70.6 MB) under the names the converter asks for, marked
  `X-Recto-Encoding: gzip`; the worker inflates them with `DecompressionStream` on the way out.
  Each file is accepted only if its content's SHA-256 matches the lock (the app's own code is
  the trust anchor). **Integrity is checked once, at download** (`package-store.ts`,
  `checkFile`), before a file is stored; the service worker serves the stored copy without
  hashing it again on each request, so the cache itself is trusted from then on (same-origin
  storage only the app can write). The notices are stored with the package, so the licence
  link works offline. A stopped download resumes at the file it stopped in, and
  `navigator.storage.persist()` is asked for once all are in. The marker
  `convert/installed.json`, written last, means "installed". Nothing under `convert/` is
  precached, and the Workbox wasm rule excludes it.
- **Isolation: `public/sw-office.js`**, loaded by the generated Workbox worker with
  `importScripts`, before Workbox's own listeners. It serves `convert/**` from the cache (with
  COOP, COEP and CORP headers, so the converter's workers may run in an isolated page), leaves
  the `*.gz` downloads to the network so Cancel stops the transfer, and, **only once the marker
  is in**, answers the app's own page (the entry URL) and every same-origin worker script with
  `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`
  (Safari has no `credentialless`). Each such response is what Workbox would have given (any
  cache's entry, the runtime caches included, such as OCR's worker in `pdf-editor-ocr`; else
  the precache's revisioned page; else the network, an OCR file then going into OCR's cache as
  Workbox's rule would put it) with headers added. Pages beside the app (about, lab) and
  ordinary subresources are untouched.
- **When it reads the marker.** At worker start, asynchronously. A navigation that arrives
  before the read lands is left to Workbox (not isolated). A worker script must be answered at
  once or not at all, so in that window it is answered with Workbox's own response (every cache,
  then the network) and the headers wait for the read: an isolated page whose service worker the
  browser restarted still gets `require-corp` on its next worker, and nobody else's worker
  changes (`sw-office.test.ts` loads the OCR worker offline with and without the marker). Once
  the read says "not installed", nothing but `convert/**` is answered. The page tells the worker
  after an install and after a removal (`RECTO_OFFICE_REFRESH`).
- **The one reload.** When an Office file arrives and the page is not isolated, the files are
  stashed in the cache, the page reloads once (a `sessionStorage` flag), and the flow resumes
  from the stash. Open documents come back through the session snapshots (ADR-0032 §2.4). A
  second miss is a failure ("This browser can't run the converter here"), never a loop.
- **Effect on the rest of the app**, measured in Chromium under isolation (`e2e/office.spec.ts`):
  the PDFium worker and its wasm, Save a copy (assembler and analysis workers), the self-hosted
  fonts, and zero requests to another origin. Recto has no cross-origin subresources (the CSP is
  `default-src 'self'`), and it opens other windows only with `noopener`, so COEP and COOP block
  nothing it uses. Users who never install the package keep today's behaviour exactly: without
  the marker the script answers nothing but `convert/**`.
- **Without a service worker** (Firefox private windows, some managed browsers) there is no
  isolation and no conversion; the sheet says so.

### 5. The flow and the open path

On a drop or a pick of `.docx`, `.xlsx` or `.pptx` (`office/intake.ts`, split off in
`openDocuments` and the window drop), the full edition opens **Convert to PDF**: if the package is
missing, "A one-time conversion package (~67.3 MB) is needed. Download it?" (70.6 million
bytes, in the app's binary units) with what it means,
the licence link, and Download or Cancel; then one progress bar with Cancel download; then the
reload when needed; then "Converting report.docx…". The converter runs in the package's worker,
one file at a time, terminated after a minute idle (it holds about 1 GB). Each PDF becomes
`new File([bytes], 'report.pdf')` and goes through `openDocuments`, so Recents, failure toasts
and announcements stay as they are; a toast then says it was converted with LibreOffice and to
check the layout (spike §4: fidelity is labelled honestly). All of it but the intake is a lazy
chunk.

### 6. Editions and the flag

Desktop and tablet only (EDN-19). On the phone edition an Office file gets guidance ("Word,
Excel and PowerPoint files open on a computer or tablet. Or save the file as PDF in Word, then
open the PDF here.") and never a download: the module reserves 1 GiB before it starts and iOS
kills such a tab (spike §3). Until phase 2 all of it is behind `?office=1` (kept in
`localStorage`; `?office=0` turns it off). Off, an Office file is ignored as before.

### 7. Bundle gates are unaffected

The package is never in a bundle: nothing imports it, it lives under `convert/` (outside
`assets/`, so outside the budget's PF-17 check), and it is not precached. The office code is a
lazy chunk loaded when the sheet first mounts; the open path carries only the intake (the flag,
the extension test, a small store), about 1 KB gzip. Measured on the phase-1 build (gzip):
first paint 73.9 KB (unchanged), editor 827.0 → 828.1 KB, compact 273.8 → 274.8 KB, precache
13,197.6 → 13,227.3 KB raw; every gate and growth cap holds without a change (PRC-11).

## Consequences

- A user who converts once downloads 70.6 MB and keeps it (about 71 MB in Cache Storage);
  GitHub Pages' soft 100 GB/month covers about 1,400 first downloads a month.
- The site grows by 71 MB per deploy that carries the package (Pages' limit is 1 GB). Phase 1
  does not wire the deploy: CI fetches and serves the package in phase 2.
- After an install, the app's page and workers are cross-origin isolated. Anything added later
  that loads from another origin needs CORP, or it breaks for those users.
- A patched third-party file is carried until upstream (or our own build) fixes the pool.
- Fidelity is LibreOffice's: Aptos and Calibri Light substitute, and complex layouts can shift.

## Phase 2

The deploy job fetches and verifies the package (cached by the lock's hash) and the e2e runs in
CI; Firefox and WebKit isolation and memory runs; Settings gets "Remove conversion package" and
its size; About gets the notices; a font substitution table (Aptos, Calibri Light) and fidelity
fixtures; font trimming toward about 60 MB. **Before the flag comes off**, each bundled font's
licence is checked against its file, and the GPL-with-font-exception faces (Culmus, Linux
Libertine G) are either confirmed acceptable under ADR-0001 as separate data or removed; only
then does the flag come off, when the owner says so.

## Alternatives considered

See §1's table for packaging. Others: a DOCX parser with our own layout (months, low fidelity);
HTML and the browser's print (no bytes to verify); server-side conversion (breaks PRD-12).
Isolating every navigation from the first visit (coi-serviceworker's way) was rejected: it
would change how the app loads for everyone, for a feature few use.
