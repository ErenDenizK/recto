# Office to PDF, phase 2: the plan (2026-10-21)

Plan for the lead, after phase 1 (PR #45, ADR-0035) landed behind `?office=1`. It turns the
phase 2 list in ADR-0035 into settled lanes for builders, records the technique as decision rows
(PRC-26, PRD-20 to PRD-22, EDN-20) and asks the board four questions. Desktop and tablet only
(EDN-19). No code changes in this document.

## What was measured for this plan

The pinned tarball (`@matbee/libreoffice-converter` 2.7.2) was read locally; its `sha512` matches
`office.lock.json`. `soffice.data` is an Emscripten file package: its table of contents is the
single `loadPackage({files:[…],remote_package_size:99735918})` call in `soffice.js` (1,904
entries, no package UUID, no IndexedDB preload cache), so the data file can be rewritten
deterministically. Each font's licence was read from its own `name` table (IDs 0, 13, 14).

| Group (files) | Raw MB | gzip -9 MB | Licence in the file | Plan |
|---|---|---|---|---|
| Linux Libertine G, Biolinum G (10) | 20.16 | 5.80 | "GPL with font-exception and OFL" (dual) | Drop (size) |
| Noto Sans/Serif + Arabic, Armenian, Georgian, Hebrew, Lao, Lisu (32) | 9.48 | 4.61 | OFL 1.1 | Keep |
| DejaVu Sans, Serif, Sans Mono (12) | 5.35 | 2.93 | Bitstream Vera, DejaVu changes public domain | Keep |
| DejaVu Sans/Serif Condensed, Sans ExtraLight (9) | 4.28 | 2.26 | as DejaVu | Keep Sans Condensed (Tahoma), drop the rest |
| Liberation Sans, Serif, Mono 2.x (12) | 4.36 | 2.40 | OFL 1.1 | Keep (Arial, Times, Courier) |
| Amiri, Scheherazade, Reem Kufi, Noto Kufi/Naskh Arabic (13) | 4.22 | 1.87 | OFL 1.1 | Keep (Arabic documents) |
| Carlito, Caladea (8) | 3.01 | 1.28 | OFL 1.1; Apache 2.0 | Keep (Calibri, Cambria) |
| Gentium Basic, Gentium Book Basic (8) | 2.08 | 0.82 | OFL 1.1 | Drop (size) |
| Alef, David Libre, Frank Ruhl Hofshi, Miriam Libre, Rubik (12) | 1.24 | 0.62 | OFL 1.1 (Alef, Frank Ruhl Hofshi: no licence record in the file; OFL upstream) | Keep (Hebrew) |
| **Culmus**: David, Frank Ruehl, Miriam, Miriam Mono, Nachlieli CLM (18) | 0.79 | 0.43 | **"GNU General Public License version 2"**; the font exception is not in the file | Drop (BQ-1) |
| DejaVu Math TeX Gyre (1) | 0.58 | 0.27 | points at the DejaVu licence (upstream: GUST) | Keep |
| **Liberation Sans Narrow 1.x** (4) | 0.48 | 0.29 | **"Liberation Fonts license"** (GPLv2 with exceptions) | Drop (BQ-1) |
| OpenSymbol (2 copies) | 0.41 | ~0.1 | LibreOffice's own (MPL-2.0) | Keep (bullets, math) |
| All fonts (137) | 55.05 | 23.20 | | |

Findings that change the phase-1 assumptions:

- **About 60 MB is not reachable by trimming fonts.** The wasm alone is 49.7 MB gzip; fonts are
  23.2 of the data's 28.7 MB. The trim above saves about 9.5 MB: the package becomes **about
  69–70 MB** (from 78.9). A smaller package needs our own LibreOffice build (ADR-0035 §1, "later").
  The other large part of the data, `share/config/soffice.cfg` (20 MB raw of UI definitions,
  XML that compresses well), is not touched in phase 2: a headless build may still read it.
- **`NOTICE.txt` is wrong in two places:** Liberation Sans Narrow is listed as OFL (it is the
  GPL-based Liberation 1.x licence), and OpenSymbol is not listed. Lane C corrects both.
- **Every served file is under GitHub's 100 MB file limit:** the largest is `soffice.wasm.gz`
  (49.7 MB), then `soffice.data.gz` (28.7 MB); the rest are under 0.5 MB. A full `dist/` with the
  package is about 120 MB, far below the 1 GB Pages site limit.
- **The substitution hook exists:** `/instdir/share/fonts/truetype/fc_local.conf` (868 bytes) is a
  fontconfig file that already aliases Calibri→Carlito, Cambria→Caladea and Arial
  Narrow→Liberation Sans Narrow. Recto's table replaces this one file.

## Lanes

Order: A first; C and D in parallel with A; B after A; E after C. Each lane is one PR (PRC-17).

### Lane A: the package in CI and in the deploy (PRC-26) — S, 1.5 days

- **Files:** `.github/workflows/deploy.yml`, `.github/workflows/ci.yml` (the `verify` job and
  the upload steps only), `packages/engine/office/assets.ts`.
- **Work.** Both workflows restore `actions/cache` for `packages/engine/office/vendor`, keyed
  `office-vendor-${{ hashFiles('packages/engine/office/office.lock.json',
  'packages/engine/office/fetch.ts') }}`, then run `node --experimental-strip-types
  packages/engine/office/fetch.ts` (a hit verifies offline; a miss downloads, checks the
  `sha512`, patches and writes). The build then runs with `RECTO_OFFICE_REQUIRED=1`, which makes
  `assets.ts` fail instead of skipping when the package is missing, so a deploy never ships
  without it silently. `assets.ts` also refuses any emitted file of 100 MB or more and warns
  above 90 MB (the Pages gate). In CI, `web-dist` excludes `convert/` (`!apps/web/dist/convert`)
  and a separate `office-package` artifact carries it, so the 13 regular e2e jobs do not
  download 79 MB each and `office.spec` stays skipped there.
- **Done when** a `develop` CI run shows a cache hit on the second run, the bundle budget passes
  unchanged with the package in `dist/`, and a dispatched deploy serves
  `convert/lo-2.7.2-r1/soffice.wasm.gz` from github.io (curl `-I` shows 200 and its size).
- **Check:** `curl` exists in the Playwright image (`fetch.ts` uses it); if not, the lane stops
  and asks (a `fetch()` fallback changes `fetch.ts`, Lane C's file).
- **Risk:** a cold cache adds about a minute (79 MB download, gzip -9 of 247 MB) to a 15-minute
  job; Pages bandwidth (soft 100 GB/month) is spent by users, not by deploys.

### Lane B: other engines, the tablet and iPad (EDN-20) — M, 2–3 days, after A

- **Files:** `apps/web/e2e/office.spec.ts`, `apps/web/playwright.config.ts` (one `ipad` project:
  WebKit with an iPad descriptor, touch, office spec only), `ci.yml` (a new `e2e-office` job),
  `docs/qa/office-ipad-checklist.md`.
- **Work.** `e2e-office` downloads `web-dist` and `office-package` and runs `office.spec` on
  `chromium`, `firefox`, `webkit`, `tablet` and `ipad`. The spec drops its Chromium-only skip and
  asserts, after the reload, `crossOriginIsolated`, `typeof SharedArrayBuffer === 'function'`,
  and that the PDF opened; it adds one `.xlsx` and one `.pptx` case (builders from Lane E's
  support file once it lands; until then `.docx` only). Peak memory per engine is sampled from
  the host (`ps` RSS of the browser processes every 500 ms) and written as a test annotation.
  Required checks: Chromium, Firefox and tablet. WebKit and ipad are required if they pass in
  the lane; if WebKit cannot isolate through a service worker or lacks shared memory, the job is
  marked `continue-on-error` with the reason in the spec header and the iPad check list carries
  the claim.
- **iPad check list (the owner, 20 minutes, an M-series iPad, Safari, iPadOS 17 or later):**
  open the live site; pick a `.docx` from Files; consent on Wi-Fi; the page reloads once; the
  PDF opens; convert an `.xlsx` and a `.pptx`; convert three files in a row without the tab
  reloading; leave the tab for five minutes and convert again; convert in airplane mode;
  Settings, Office conversion package, Remove; reopen and confirm a PDF opens as before; the same on the
  home-screen app. Each step is pass or fail with the iPad model and iPadOS version.
- **Done when** the job is green on its required engines on three consecutive `develop` runs and
  the memory and timings per engine are in the results table below.
- **Risk:** WebKit on Linux is not iPad Safari (memory, jetsam); only the owner's device answers
  that. Firefox private windows have no service worker: the sheet's existing message covers it.

### Lane C: package r2, trimmed fonts and the substitution table (PRD-20) — M, 3 days

- **Files:** `packages/engine/office/fetch.ts`, `office.lock.json`, `NOTICE.txt`,
  `packages/engine/office/data/fc_local.conf` (new), the root `NOTICE` entry.
- **Work.** The lock gains a `data` section: `drop` (exact font paths) and `replace` (a data path
  and the committed file that replaces it). `fetch.ts` rewrites `soffice.data` keeping entry order
  and the `loadPackage` table in `soffice.js` (offsets and `remote_package_size`), asserting the
  table occurs once; it is a second change to an MPL file, published like the first. The revision
  becomes 2 (`lo-2.7.2-r2`); `installPackage` already removes an older package's entries. The new
  `fc_local.conf` keeps the existing aliases and adds Recto's table:

| Font in the document | Substitute | Basis |
|---|---|---|
| Calibri, Calibri Light | Carlito | metric-compatible with Calibri; Light loses its weight (Lane E measures the widths) |
| Cambria | Caladea | metric-compatible |
| Arial, Times New Roman, Courier New | Liberation Sans, Serif, Mono | metric-compatible (fontconfig's own aliases) |
| Arial Narrow | Liberation Sans Narrow if BQ-1 keeps it, else Liberation Sans | |
| Aptos, Aptos Display, Aptos Narrow | chosen by Lane E: Carlito or Liberation Sans, whichever keeps page counts closer | no metric-compatible free font exists |
| Segoe UI | Noto Sans | closest humanist face shipped (BQ-3: Selawik) |
| Verdana, Tahoma | DejaVu Sans, DejaVu Sans Condensed | Verdana and Vera share widths |
| Georgia, Garamond | Noto Serif | not metric-compatible (BQ-3: Gelasio) |
| Century Gothic | DejaVu Sans | not metric-compatible |
| David, Miriam, FrankRuehl | David Libre, Miriam Libre, Frank Ruhl Hofshi | OFL successors of the Culmus faces |

- **NOTICE:** every kept font listed with the licence its file states, OpenSymbol added, the
  dropped faces removed, both modified files named; notices re-pinned in the lock.
- **Done when** `fetch.ts --pin` then `--verify` pass, the served total is about 70 MB (recorded
  in ADR-0035's size line and the consent copy's number), the phase-1 spec converts with r2, and
  a test lists the font files in the rewritten table and compares them with the NOTICE list.
- **Risk:** LibreOffice may read a dropped font at start (its VCL default lists name Linux
  Libertine G for its own templates); a Writer, Calc and Impress conversion each must still
  succeed. Fontconfig fallback, not a crash, is the expected result.

### Lane D: Settings "Remove Office package" and About notices (PRD-21) — S, 1.5 days

- **Files:** `apps/web/src/settings/sections.tsx`, `pages.tsx`, a new
  `apps/web/src/settings/OfficePackageRow.tsx`, `apps/web/messages/en.json`, `tr.json`,
  `apps/web/src/office/package-store.ts` (a `packageStoredBytes()` read only).
- **Work.** In Settings, beside Recents (`RecentsRow`), a row "Office conversion package", shown when the package is
  installed (or the flag is on), with its stored size and **Remove**; Remove confirms, calls
  `removePackage()` (deletes the cache, refreshes the service worker), then says that the app
  stops being isolated at the next load. In About, a "Conversion package licences" row opens the
  stored `NOTICE.txt` (offline, from the cache) or, when not installed, the served one. The
  Office code stays a lazy chunk: the row imports nothing from `office/` until shown.
- **Done when** a unit test removes a stubbed package and the next `isPackageInstalled()` is
  false, an e2e step at the end of `office.spec` (added after Lane B merges, so the two do not edit
  the spec at once) removes the real one and a reload is not isolated, and
  bundle gates hold with no change (PRC-11).
- **Risk:** small. Copy in EN and TR goes through the copy check.

### Lane E: fidelity fixtures and the Aptos choice — M, 2 days, after C

- **Files:** `apps/web/e2e/support/office-fixtures.ts` (builders for `.docx`, `.xlsx`, `.pptx`
  beside `docx.ts`), `apps/web/e2e/office-fidelity.spec.ts`, the results table below.
- **Work.** Generated at test time (the corpus stays PDFs from a generator): six documents of
  4–12 pages, each set in one face (Calibri with Calibri Light headings, Cambria, Arial, Times
  New Roman, Aptos, Segoe UI), with a table, a header and a PAGE field and Turkish text; one
  `.xlsx` with two sheets and a print area; one `.pptx` with 13 slides. For metric-compatible
  faces, the expected page count is computed from the layout (fixed lines per page with explicit
  page breaks, so it is known without Word). If the owner supplies Microsoft 365 references
  (BQ-4), their `docProps/app.xml` `<Pages>` is the truth. Aptos is measured against both
  candidates and the closer one goes into Lane C's table (a one-line follow-up in `data/`).
- **Done when** every metric-compatible fixture matches its page count exactly, the `.pptx`
  gives 13 pages, the Aptos and Segoe UI deltas are recorded, and the toast's "check the layout"
  stays.
- **Risk:** synthetic fixtures miss real-world layout (SmartArt, floating boxes, TOC fields);
  the owner's references are the only check on those.

## Board questions

1. **BQ-1, GPL fonts.** The package carries Culmus (five Hebrew families whose files say only
   "GPL version 2") and Liberation Sans Narrow (GPLv2 with exceptions). Shipping them unmodified
   as separate files beside MPL code is aggregation and is generally fine, but it adds GPL duties
   (licence text, source offer) to a package that is otherwise MPL, OFL, Apache and public
   domain, and Culmus's font exception is only upstream, not in the files. **Recommendation:
   drop both** (0.7 MB): Hebrew documents use the OFL David Libre, Miriam Libre and Frank Ruhl
   Hofshi; Arial Narrow documents get Liberation Sans and may gain a page. Linux Libertine G is
   dual GPL/OFL, so it raises no question; it goes for size. **Default if unanswered: drop.**
2. **BQ-2, the size.** About 70 MB, not 60: the wasm alone is 49.7 MB. **Recommendation:
   accept about 70 MB**; consider our own build (2–4 weeks) only if testers stop at the download.
   **Default: 70 MB.**
3. **BQ-3, two new free fonts.** Selawik (OFL, Microsoft's metric-compatible Segoe UI stand-in)
   and Gelasio (OFL, metric-compatible with Georgia) would improve those documents, but each is a
   new third-party file. **Recommendation: not now**; revisit if testers send such files.
   **Default: no.**
4. **BQ-4, reference documents.** Twenty minutes of the owner's time: save the six Lane E
   documents in Word, Excel and PowerPoint (Microsoft 365) with their PDF exports. **Recommended**,
   because only they show real Aptos reflow. **Default: synthetic fixtures only.**

The flag itself stays the owner's call (ADR-0035, PRD-18); PRD-22 lists what must be true first.

## Dropping `?office=1` on desktop and tablet (PRD-22)

All of these, then the owner says so:

1. The deploy ships the package (Lane A) and a download from github.io completes and verifies.
2. `e2e-office` is green on Chromium, Firefox and tablet on three consecutive `develop` runs;
   WebKit and ipad are green or their gap is written down.
3. The owner's iPad check list passes on one M-series iPad.
4. Package r2 is in (Lane C): every shipped font checked against its file, NOTICE accurate,
   BQ-1 answered or defaulted.
5. Settings removal and About notices are in (Lane D).
6. Lane E's metric-compatible fixtures match; the Aptos and Segoe UI deltas are published.
7. Users without the package see no change: the full e2e suite, the bundle gates and the phone
   guidance (EDN-19) unchanged.

Then the intake is on by default in the full edition. `?office=0` stays one release as a
per-browser off switch, then the flag code goes.

## Results (filled in by the lanes)

| Engine | Isolated | Shared memory | Init + first convert | Peak memory | Notes |
|---|---|---|---|---|---|
| Chromium | yes (phase 1) | yes | download and reload 5.3 s, start and convert 5.6 s; then xlsx 1.3 s, pptx 2.3 s (local, Lane B) | 3.2 GB (host RSS sum of all browser processes, over-reads) | local run, not CI |
| Firefox | | | | | |
| WebKit | | | | | |
| tablet (Chromium) | yes | yes | download and reload 5.2 s, start and convert 5.8 s; then xlsx 2.1 s, pptx 1.2 s (local, Lane B) | 3.2 GB (same sampling) | local run, not CI |
| ipad (WebKit) | | | | | |
| iPad Safari (owner) | | | | | |
