# Teaching sample v2: mechanism, blast radius, generator, plan

Technical research for one sample source whose pages each teach one feature, where each edition
opens only the pages that work there. Read-only on the repo (develop @ 48e1106, 2026-10-15).
Byte figures were measured from the committed files and from a copy of the generator run in the
any change.

---

## 1. Per-edition page subsetting

### How the sample opens today (the constraints)

- One file per locale, chosen only by locale: `sampleUrl(locale)` →
  `sample/recto-sample-${locale}.pdf` (`apps/web/src/sample/sample-file.ts:31-33`). It is fetched,
  wrapped as a `File` named for the language and stamped with `lastModified = SAMPLE_LAST_MODIFIED`
  (`sample-file.ts:80-89`). `isSampleFile` recognises it by name and date (`sample-file.ts:58-60`).
- Full edition: `openSample` → `openFiles([file])` (`sample/open-sample.ts:57-74`). Compact
  edition: `trySample` and the `?sample` link → `loadSampleFile(locale, [])` → `openPdf(file)`
  (`shell/compact/compact-actions.ts:152-156`, `shell/compact/CompactApp.tsx:95-102`).
- `openFiles` adds the whole source as one document, `addLoadedSource` → `addSource`
  (`state/workspace-store.ts:333-341`, `565-592`, `608-634`).
- **Everything that means "this document is the file as opened" requires every page of the
  source, in order:**
  - `isPristineDocument`: `source.pageCount !== doc.pages.length` → false, and
    `page.ref.index === index` (`session/snapshot.ts:199-217`).
  - `ChangeTracker.observe` marks a non-pristine document as `changedFromStart`
    (`session/snapshot.ts:231-239`).
  - The saved marks and the byte-for-byte copy: `fileSource`, `asOpenedMark`, `asOpenedSource`
    (`state/saved-store.ts:111-121`, `252-266`, `276-285`).
  - Revert (`files/revert.ts:65`). The phone's share/copy: `pristineSource` checks the page count
    again (`shell/compact/compact-actions.ts:265-280`).
- The sample joins Recents only once changed: `isUnchangedSample` combined with
  `tracker.changed` (`session/session.ts:188-203`, `222-224`).
- Every rewrite goes through the pdf-lib assembler, and **the assembler drops the structure tree**
  (`packages/engine/src/pdflib/pdflib-assembler.ts:574-579`: `catalog.delete(StructTreeRoot)`,
  with the warning "Tagged PDF structure was removed").
- The precache takes `sample/*.pdf` (`apps/web/vite.config.ts:202`). The specs say "Sample ≤ 250 KB,
  precached" (`docs/specs/redesign.md:707`, 02.14 at `:532`; `02-library.md:802-803`, `:994`). The
  e2e check counts exactly two cached sample files (`apps/web/e2e/sample.spec.ts:147-149`).
  Precache gate: 14 680 064 B, baseline 13 545 061 B, growth cap 1 % (about 135 KB a wave)
  (`tools/qa/bundle-budget.json`). PRC-11 (`decisions.md:210`) forbids raising a gate to fit a change.

### Options

**(a) One file; the app builds the edition's document from a page list at open.**

There are four places the list could live:
- A JSON beside the PDF. This is the simplest: one more fetch and a precache entry of about 200 B.
- A custom catalog key or XMP. The engine does not expose arbitrary catalog keys to the app today,
  so this needs an engine API.
- Page labels. These are wrong for the job: they show in the UI and do not hide pages.
- Optional content. This hides content, not pages.

The document would be built either the overview's way (`newEmptyDocument` + `duplicatePages`,
`shell/compact/overview/page-actions.ts:197-219`) or by deleting the other pages in the open's own
commit.

- *Save a copy / Share of an untouched sample:* the document is not pristine
  (`snapshot.ts:203`), so it is rewritten through the assembler. That loses the tags and shows a
  warning. If pristine is "fixed" to accept a subset, the copy hands out the **full** file's bytes:
  pages the edition hid, which is dishonest.
- *Page numbers:* printed folios ("3 / 7") and outline entries cannot be right in both editions.
  The phone would show "5 / 7" on its third page, and the outline would lead to removed pages (the
  export drops them). Internal links to hidden pages break. The file could print no folios, but it
  still could not have edition-specific copy ("tap" against "click or tap").
- *Session/Recents:* the subset counts as `changedFromStart`. An untouched sample would then join
  Recents, raise the before-unload prompt and get the "Edited" mark, unless an "opened as a subset"
  baseline is threaded through `snapshot.ts`, `saved-store.ts`, `revert.ts` and `compact-actions.ts`.
  Those are the most delicate modules (save, keep, revert).
- *Determinism:* the file is deterministic; the document the person gets is not a file at all.
- *Precache:* +0 KB. *First open:* the phone loads the full file, including the scan raster.
- *Tests:* each spec needs page-index mapping logic.

**(b) Generate one file per edition and locale from one source at build time (recommended).**

`recto-sample-{en,tr}.pdf` stays the full edition (desktop and tablet): same URL, about-page
links and caches. New: `recto-sample-phone-{en,tr}.pdf`.

- *Save a copy / Share:* the untouched sample is pristine, so `asOpenedSource` /
  `pristineSource` hand out the file's own bytes, byte for byte, tags kept. A changed sample is an
  ordinary rewrite, as today.
- *Page numbers:* folios, the outline, internal links and "page n of N" are true in every file,
  and copy can differ per edition (EDN-9: lessons true on a phone).
- *Session/Recents:* nothing changes. Same names and `lastModified`, so `isSampleFile` holds and
  "joins Recents only once changed" works unchanged. A kept phone sample restored with
  `?edition=full` simply shows its phone pages.
- *Sharing:* a phone-made file is complete and honest.
- *Determinism:* each file is byte-stable. Seeds and trailer IDs already derive from the file name
  (`withDeterministicRandom(file)`, `save(doc, file)`, `sample-fixture.ts:1112-1141`).
- *First open:* the phone fetches and parses a smaller file with no raster.
- *Tests:* each file describes itself, and a manifest gives each edition's facts.
- *Cost:* two more precached files. This is handled by the byte budget in §3: four files ≤ 250 KB
  in total, so the 02.14 figure holds without touching a gate. If the designer's pages cannot fit,
  the fallback is to leave `sample/*-phone-*.pdf` out of `globPatterns` and have the compact
  edition warm its file into a runtime cache when idle (the EDN-10 idle pattern). `sampleCached`
  already looks in every cache (`home/use-sample-available.ts:14-21`). That fallback needs a
  decisions row.

**(c) Other options, rejected.**

- *Derive the subset at runtime with the export pipeline:* it loses the tags (assembler, as
  above), puts the export chunk (pdf-lib) on the phone's first open, and the bytes vary by app
  version.
- *One file with the phone's pages first, opening a prefix:* it has the same pristine and folio
  problems as (a).
- *Optional content per edition:* it hides drawings, not pages; page count and thumbnails stay.

### Recommendation: (b). Exact changes

1. `tools/fixtures/sample-fixture.ts`:
   - `export type SampleEdition = 'full' | 'phone'`.
   - A page catalog: `SAMPLE_PAGES: { id, editions, outline, draw }[]`.
   - `buildSample(locale, edition)` filters the catalog and numbers folios and the outline from the
     filtered index. Today `furniture` prints the global `SAMPLE_PAGE_COUNT` (`:674`) and
     `letterLines` hard-codes the scan's folio (`:875`).
   - `sampleFile(locale, edition)` (`:74`) and `buildSamples` over 2 × 2 (`:1144-1148`).
   - `--check` and the size caps over all four files plus a combined cap (`:1150-1176`).
   - Copy keyed per edition where it differs: today's `SampleCopy` (`:89-131`) gains optional
     `phone` overrides.
   - Replace the constants `SAMPLE_SCAN_PAGE`, `SAMPLE_PAGE_COUNT` and `SAMPLE_FIELDS` (`:78-80`)
     with a per-edition manifest object, and write it as a committed JSON, e.g.
     `apps/web/test/sample-manifest.json`. It gives per file: page ids in order, page count,
     field names, scan pages, outline titles, the bytes' sha256 and size. Unit and e2e specs import
     it.
2. `apps/web/src/sample/sample-file.ts`: `sampleUrl(locale, edition, base)` and
   `fetchSampleBytes` / `loadSampleFile(locale, edition, openTitles)`. `SAMPLE_TITLES` and
   `isSampleFile` stay as they are.
3. Callers:
   - `sample/open-sample.ts:57` passes `'full'`.
   - `shell/compact/compact-actions.ts:154` and `shell/compact/CompactApp.tsx:99` pass `'phone'`.
   - `home/use-sample-available.ts:14` takes an edition (only the full Library uses it today;
     `Launcher.tsx:69`).
4. `apps/web/vite.config.ts:194-202`: the comment and, only in the fallback, a `globIgnores` entry.
5. `docs/process/decisions.md`: a new row (e.g. EDN-19 / SMP-1) recording "one source, one file
   per edition and locale" and the byte budget. It amends 02.14's "two files" wording.

---

## 2. Blast radius (what depends on today's pages, text and fields)

### Generator and fixture checks

- `tools/fixtures/sample-fixture.ts`: the whole file. Constants at `:76-80`, COPY at `:138-251`
  (Ada Lindqvist / Linden Row at `:173`, `:178`, `:220`, `:225`), the four page writers, the
  outline (`:1079`), `buildSample` (`:1112`).
- `tools/fixtures/sample-fixture.test.ts`: it asserts the four pages, the fields in order
  `[name, date, tried]` on page 2 (`widget.P() === page(1)`), "no BT on the scan page", outline
  count === `SAMPLE_PAGE_COUNT`, and tagging. **Needs:** `describe.each` over locale × edition,
  reading the manifest. It is run by `pnpm test` in CI (`.github/workflows/ci.yml:53`).
- `tools/fixtures/package.json`: the `sample` script stays; `--check` covers four files and the
  manifest.
- `apps/web/public/sample/*`: two new files, regenerated.

### App code

- `apps/web/src/sample/sample-file.ts`, `open-sample.ts`, `sample-link.ts` (the doc comment
  only), `sample-param.ts` (no change), and `shell/compact/compact-actions.ts:147-156`,
  `CompactApp.tsx:95-102`: edition parameter (§1).
- `apps/web/src/shell/compact/CompactLibrary.tsx:147-200`: `SamplePage`, **a hard-coded SVG
  drawing of today's page 1.** That includes the body bars, the highlighted sentence, the three
  numbered steps and the NOTES column (DSN-31, `decisions.md:97`). It must be redrawn to match the
  new phone page 1.
- `apps/web/src/home/Launcher.tsx:106-117`: a button, no thumbnail, so no change. The full
  Library card shows no drawing.
- `apps/web/vite.config.ts:194-202`: the precache comment ("two PDFs, ≤ 125 KB each").

### Copy (`apps/web/messages/en.json` and `tr.json`)

- `sample_announce_opened` "Opened the sample. Its pages explain what to try" (`en.json:3562`):
  still true.
- `compact_library_sample_line` "A short tour to try every tool on." (`en.json:3871`): **false
  once the phone hides pages.** Reword it, e.g. "A short tour of what your phone can do", and give
  the full edition a matching line if one is wanted.
- `cmd_try_sample`, `cmd_file_sample_keywords`, `sample_offline`, `sample_failed`: unchanged.

### Unit and browser tests (Vitest)

- `apps/web/src/sample/sample.test.ts:156-173`: it expects `pages` to have length 4
  ("opens a fresh four-page document"). **Needs:** `manifest.full.pageCount`. It also needs a
  compact-edition open case, and a test that `sampleUrl` picks the edition. Its Recents test
  (`:176-221`) rotates `pages[0]` and does not depend on content.
- `apps/web/src/shell/compact/CompactLibrary.test.tsx:49-51`: "Try the sample" card; it changes
  only if the sample line changes.
- `apps/web/src/markup/MarkupPalette.test.tsx:430`: types "Ada Lindqvist" as a signature. This is
  a name only and is independent of the PDF; renaming is optional.
- `apps/web/src/shell/frame/tab-overflow.test.ts:68-74` and `home/LibraryView.test.tsx:136`,
  `:602`: titles and button names only, unchanged.
- `apps/web/src/shell/compact/mark/tool-list-state.test.ts:61`: the `?sample` string only.

### e2e (Playwright)

These depend on content.
- `e2e/sample.spec.ts`:
  - `:70` expects the page pill to read `1 / 4 ·`.
  - `:63-83` expects the form on page index 1 (`[data-page-index="1"]`), with "Fill & sign brings
    the form into view".
  - `:147-149` expects `cached === 2` against the regex `recto-sample-(en|tr)` → it must count 4.
    The regex already misses `-phone-` files.
  - Titles at `:36`, `:55`, `:88`, `:120`, `:161` are unchanged.
- `e2e/compact-forms.spec.ts` (phone, phone-land):
  - `:44-70` expects the form on page index 1 and fields `tried` and `name`.
  - `:126-139`, `:190` read `getCheckBox('tried')`.
  - `:151` relies on the "12 pt text" fact.
  - **Needs:** the page index from the manifest, and field names kept or mapped.
- `e2e/compact-edit-text.spec.ts`:
  - `:76-90` finds page 1's first body line by `/^Recto(,| reads)/`.
  - `:365-390` expects the mirror to read `/^Recto reads/`.
  - `:403` covers Turkish ("Recto, PDF'leri").
  - **Needs:** a stable editable paragraph on the phone's page 1, or a selector from the manifest
    (e.g. `editParagraphStart`).
- `e2e/phone-smoke.spec.ts:138-148`: searches "Recto" and needs a hit. The total page count is
  read from the UI (`:72`), which is good.
- `e2e/compact.spec.ts`:
  - `:354-363` expects the heading "Recto sample" (the title is kept).
  - `:370` covers `?sample` focus.
  - The overview tests at `:495-505` use another fixture ("Page n of 3"), so they are not affected.
- `e2e/compact-drawer-list.spec.ts:34-35`, `:162`: needs any document; only light dependence.
- `e2e/jobs.spec.ts:239-305` (V1-F1, the sample tab by name) and `e2e/library.spec.ts:110-113`,
  `e2e/smoke.spec.ts:54-61`, `e2e/a11y.spec.ts:189`: button and tab names only.
- `apps/web/playwright.config.ts:163-164`: `sample.spec.ts` runs on the tablet too, which is the
  full file. `PHONE_SPECS` (`:42-51`) are the phone-file users.

### Media, docs, manual checks

- `tools/media/family/recto.capture.ts:43`, `:90`, `:203`, `:229` ("the light table: the sample's
  four pages") and the about page's clips under `media/` (deployed, not precached): reshoot.
- `docs/family/world.json:136`: alt text for "Welcome to Recto." with a capsule holding Redact
  and others; update it if page 1 changes.
- Specs and docs giving "four pages" or "two files ≤ 125 KB":
  - `docs/specs/redesign.md:532` (02.14), `:707`, `:875` (D4-2)
  - `docs/design/redesign-2026-10/components/02-library.md:37`, `:795-806`, `:994`
  - `docs/design/redesign-2026-10/flows.md:1220`
  - `docs/adr/0031-size-class-shell.md:96`
  - `docs/ROADMAP.md:448`
  - `docs/research/innovation-2026-10/baseline.md:208`
  - `docs/research/phone-2026-10/forms.md:360-371` ("one PDF serves both editions": superseded)
  - `pages.md:176-177`, `:342`
  - `pinch-overview.md:42-43`, `:234`
- `docs/plan/v1/PLAN.md:669` (owner script: "Go to page 3 by the pill, **follow a link** and come
  back"). The sample has no links today; the new sample should have at least one internal link.
- `docs/qa/iphone-phone-pages-forms-checklist.md:4-8` ("Page 2 of the sample: tap the 'I tried
  Recto' box").
- **MOB-7** (`decisions.md:165`): the overview lands at 2 columns for ≤ 4 pages and 3 above. The
  phone file's page count decides which.
- Facts chip ("No text on 1 page", 02-library §12): this is computed by the app, but the phone file
  will show a different first fact (fields), because it has no scan.

---

## 3. Generator capabilities, editability, bytes

### What `sample-fixture.ts` and `tools/fixtures/lib/*` can draw today

- **Fonts:** Inter Regular and Bold and Noto Serif Regular, embedded by pdf-lib as **Type0
  Identity-H CIDFontType2 subsets with /ToUnicode** (checked in the built file: `/Encoding
  /Identity-H`, fixed tags `RSMPAA/AB/AC`, `sample-fixture.ts:256-260`, `320-336`).
  - Each subset is pre-seeded with ASCII, the Turkish letters and the copy's typography
    (`CHARSET`, `:271`, `:333`). Edit text then finds any typed ASCII or Turkish letter in the same
    font, the tier-2 "same font" path (`editability.ts:93-108`).
  - `calt` is off (`:331`).
  - Also available: Noto Serif Bold, Noto Sans Regular, JetBrains Mono
    (`packages/engine/assets/fonts/`).
  - Simple TrueType with WinAnsi is possible (`lib/ttf.ts` `withCmap`, used by
    `edit-corpus-fixtures.ts`) but **cannot carry ğ, ş, ı, İ**, so the sample keeps Identity-H.
- **Text operators:** one `Tj` per line at an absolute `Tm`, with `Tc` tracking
  (`Writer.text`, `:482-507`).
  - No kerning and no `TJ`.
  - Alignment: left only, or right for a single line.
  - Greedy left wrap (`:510-538`).
  - **Justify and columns are not there yet.**
  - `edit-corpus-fixtures.ts:257-282` (`tjArray`) shows the `TJ` recipe to borrow: kerning pairs
    plus an offset after each space.
  - **`Tw` does nothing with Identity-H** (word spacing applies only to the 1-byte code 32), so
    justified lines must use `TJ` offsets after spaces, or one `Tm` per word group.
- **Shapes:** rect, rounded rect, circle, hairline, dashes (`:567-650`).
- **Raster:** `lib/raster.ts` `Canvas` (fills glyph outlines and polygons, coverage → grey),
  written as a FlateDecode DeviceGray image (`:954-984`). `lib/png.ts` and `lib/jpeg.ts` exist
  (baseline JPEG, RGB only; `generate.ts:847-849`).
- **Forms:**
  - Today: text fields and a checkbox, with `/TU` and a tagged `Form` OBJR (`:722-781`).
  - Radio and dropdown are already used in `generate.ts:464-472`; pdf-lib has `createOptionList`
    too.
  - **No `/Sig` field anywhere in the corpus** (`forms.md:355`). pdf-lib has no API for it, so it
    needs a raw `FT /Sig` widget dict (about 300 B). Today's sign box is drawn
    (`sample-fixture.ts:782`).
  - Field appearances use Helvetica WinAnsi (object 16), which is fine for empty fields.
- **Links:** GoTo links in `demo-fixtures.ts:664-676`, URI links in `generate.ts:287-320`. Add a
  `Link` struct element with OBJR, as the `Structure.widget` path does (`:388-391`).
- **Outline** (one level, `:1079-1108`) and **page labels** (`demo-fixtures.ts:1521`).
- **Tags:** `Structure` writes H1, H2, P, Figure (with Alt), Form (OBJR), artifacts, ParentTree,
  MarkInfo, /Lang (`:351-436`). It has no L/LI, Table or Link yet.
- **Annotations pre-filled:** none in the sample today. Highlight, Text and Link dicts exist in
  `generate.ts:1176-1290` and `tools/qa/make-annotation-sample.ts`. A pre-filled highlight or
  note is source content, so the document stays pristine and does not join Recents.
- **Redaction or compare demo pages:** these only need text (redaction marks are made by the
  person). Compare needs a second document, which a single sample cannot provide without
  shipping one more file. That is the designer's call.

### What Recto's paragraph editor needs (so the designer's pages edit well)

- **Never refused:**
  - Text must be real text in an embedded font, not paths, Type3, `3 Tr` invisible text, vertical
    text, or text inside nested forms (`editability.ts:29-36`, `blocks.ts:360-367`).
  - Do not put editable text inside a Form XObject (no tier 2 "in-form", `editability.ts:96`).
- **One tagged `/P` per paragraph** (today's `Writer.paragraph`, `:525-538`) is trusted when its
  lines are contiguous and the pitch is ≤ 2 × size (`MAX_TAG_PITCH`, `blocks.ts:213`, `:1553`).
- **Untagged geometry joins lines only at a pitch ≤ 1.6 × size** (`MAX_PITCH`,
  `blocks.ts:177`, `:1125`).
  - Today's lead style is 13.5 pt on 22 pt (1.63 ×, `:287`, `:694`, `:726`, `:1037`).
  - After a person's first Save a copy the tags are gone (assembler), so these paragraphs would
    fall apart line by line.
  - **Rule for the designer: leading ≤ 1.5 × size** (body 12.5/18, lead 13.5/20).
- **Justified (TXT-10, `decisions.md:185`):**
  - Non-final lines must share left and right edges within 0.5 pt, or within ¼ space when the
    spaces are stretched.
  - The right edge is the last glyph's advance end (TXT-11), so compute widths with the same
    advances that are drawn.
  - Keep each stretched gap under 3 × the natural space (TXT-14, `BREAK_SPACES`, `blocks.ts:168`;
    8 × with a space glyph in the gap, `:198`). That means at least 5–6 words a line in a column.
- **Columns (TXT-12):**
  - A gutter ≥ 2 × the natural word space, with the right column starting at one x (0.5 pt) on
    ≥ 3 lines and ¾ of its lines (`blocks.ts:170-173`, `:705-726`).
  - Use a gutter ≥ 18 pt and give each column ≥ 3 lines.
- **Headings:** a size of at least 1.15 × the body's, or bold short lines (`blocks.ts:221-224`).
  Keep step numbers like today's circled digits as artifacts, not as text inside the paragraph.
- **Kerning:** an optional kerned `TJ` is supported by the editor (corpus `word-export.pdf`). If
  it is added, measure with fontkit `layout` positions so the right edges stay exact.

### Bytes (measured, EN; TR is about 3–5 KB more)

| Part | Bytes |
|---|---|
| Today's file | 93 058 (TR 98 118) |
| Scan raster, 150 dpi 8-bit grey, Flate (`:954`) | 46 848 (TR 51 387) |
| Same scan, 4-bit | about 24 200 → file 71 686 |
| Same scan, 1-bit | about 6 600 → file 53 349 |
| Same scan, 120 dpi 8-bit | about 31 150 |
| Font programs, 3 subsets × ~115 glyphs | 22 631 (about 7.5 KB each) |
| Font dicts (W arrays) + ToUnicode | about 6.6 KB (about 2.2 KB a face) |
| Content streams | 1.2–1.7 KB a text page |
| Struct elements | about 90 B each |
| Field widgets with appearances | about 0.3–0.5 KB each |
| File without the scan (3 text pages) | 45 571 |
| Same, with object streams (`save(..., { objectStreams: true })`, `lib/build.ts:47-62`) | 37 044 (full file with scan: 84 335) |

**Proposed budget**, keeping 02.14's 250 KB for everything precached:

| File | Cap | Typical |
|---|---|---|
| Full (`recto-sample-{en,tr}.pdf`) | ≤ 85 KB | about 6–8 pages, one scan |
| Phone (`recto-sample-phone-{en,tr}.pdf`) | ≤ 40 KB | about 4–5 pages, no scan |
| All four | ≤ 250 KB | |
| Hard per-file cap (unchanged `SAMPLE_MAX_BYTES`) | 125 KB | |

| Per page type | Budget |
|---|---|
| Shared floor (3 faces, catalog, struct, outline) | about 30 KB a file; each extra face +9.5 KB, so prefer the three faces |
| Text page (paragraphs, list, heading) | ≤ 3 KB |
| Justified / two-column page | ≤ 4 KB |
| Form page (text, checkbox, radio ×3, choice, /Sig) | ≤ 6 KB |
| Page with pre-filled annotations | +1 KB each |
| Vector figure (miniatures, diagram) | ≤ 4 KB |
| **Scan page (OCR lesson)** | **≤ 26 KB at 4-bit grey, 150 dpi** |

- At 4-bit the paper tone and anti-aliasing survive. OCR renders the page through PDFium anyway.
  Keep 1-bit (8 KB) as the fallback if the full file runs over.
- Only one raster page fits. If redaction also wants a scan, reuse the same image XObject on both
  pages (no extra bytes) or draw the redaction page as text.
- Turn on object streams (−8.5 KB a file). PDFium and pdf-lib both read them; first confirm the
  file does not open as "repaired".

---

## 4. Order of work and test plan

### Order (implementation lane)

1. **Decision row** in `docs/process/decisions.md`: one source, a file per edition × locale, the
   names, the byte budget (four ≤ 250 KB), object streams and the 4-bit scan. It amends 02.14 /
   D4-2 wording. Ask the owner only about taste (copy per edition), not technique.
2. **Generator refactor with no content change:**
   - The edition axis, the page catalog, numbering from the filtered index, the manifest JSON.
   - Every page is in both editions at first, so the full files stay **byte-identical** to today's.
     This proves the refactor.
   - Then turn on object streams and the 4-bit scan (expected sizes about 62/66 KB) and commit the
     regenerated files.
3. **Generator capabilities** the designer's pages need: kerned or justified `TJ` lines, a
   two-column helper, list tags (L/LI), Link annotations with struct OBJR, radio / choice / `/Sig`
   fields, optional pre-filled annotations, an internal link (PLAN.md:669).
4. **App wiring:** the `edition` parameter in `sample-file.ts`, the three callers, and
   `use-sample-available.ts`. Unit tests follow.
5. **Content:** the designer's pages and the edition flags, EN and TR (siz register). Redraw
   `CompactLibrary.tsx` `SamplePage` and reword `compact_library_sample_line` (EN/TR, then
   `pnpm --filter @pdf-editor/web i18n`).
6. **Specs:** update e2e and unit tests from the manifest; reshoot media; update docs (§2 list).

### Tests

- **Fixture unit tests** (`tools/fixtures/sample-fixture.test.ts`), `describe.each` over locale ×
  edition:
  - Built twice gives the same sha256, equal to the committed file.
  - Size ≤ cap per file, and four ≤ 250 KB.
  - Page count, outline titles and folios ("n / N" from the filtered count) match the manifest.
  - Fields by name and page.
  - The scan has no `BT`, and every other page has text.
  - Tagged, with `/Lang`.
  - Phone files contain no page flagged full-only.
  - The manifest JSON equals what the generator would write.
- **`pnpm --filter @pdf-editor/fixtures-tool sample --check`:** all four PDFs and the manifest,
  byte-identical.
- **App unit (Vitest browser):**
  - `sample.test.ts`: `sampleUrl(locale, edition)`, each edition's open with
    `pages.length === manifest[edition].pageCount`.
  - An untouched sample is pristine. `isDocumentChanged` is false, and Save a copy uses
    `asOpenedSource` (the same bytes).
  - Recents join only once changed, for both editions.
  - Optional: one engine-level paragraph check per page, `analyzeParagraphs` on the built file.
    Each designed paragraph should come out as one block with the intended alignment (left or
    justify), both tagged and after stripping tags.
- **e2e, Chromium** (`sample.spec.ts` on desktop and tablet): `?sample`, `?sample=tr`, the pill's
  `1 / N` from the manifest, the form page found from the manifest, the offline precache count of
  4.
- **e2e, phone and phone-land** (`compact-forms`, `compact-edit-text`, `phone-smoke`,
  `compact.spec`): open via `?sample&lang=en|tr`; field and page indexes and the paragraph selector
  come from the manifest. Add one check that the phone's page count equals the manifest's and that
  no full-only page (scan, redaction, compare) is present.
- Screenshots at 1440×900 and 1180×820 (touch) per CLAUDE.md, plus the phone Library card.
