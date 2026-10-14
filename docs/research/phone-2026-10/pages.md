# Pages system: desktop audit, phone today, phone page management proposal

Research of 2026-10-14 against `develop` at 7462113, using the prebuilt `dist-research`
served by `vite preview` on :4812. This was a read-only pass: nothing in the repo was edited.
Every exported PDF was reopened in Node with `@cantoo/pdf-lib`, which gave the page count,
`/Rotate` and MediaBox, and with pdfjs-dist, which gave the text marker on each page.

## 0. Specs and decisions that define "the pages system"

- ADR-0029 and spec redesign §B3: the Pages grid is a surface.
- `components/06-navigation.md`:
  - PG1–PG6 (grid, header pieces, sections, cell, drag, Combine result).
  - N6, the phone Pages sheet. N6 is unbuilt and was overtaken by ADR-0033 (read-only phone).
- `components/04-context.md`:
  - §10 Pages bar.
  - §13 page menu.
  - §14 menu catalogue (Move to ▾, cell menu, section menu).
- `components/07-sheets.md`: S13 Split, S14 Interleave, S15 Combine, S16 Extract, S18 Insert images.
- `components/01-frame.md` F5, the title menu's Pages section:
  "Insert pages from file… · Combine with open documents… · Split… · Interleave… · Rotate all ▸ ·
  Crop pages… · Resize pages…" (01-frame.md:564).
- `decisions.md`:
  - DSN-8: no header band.
  - DSN-10: Photos-style selection.
  - EDN-4: phones are read-only. EDN-7 supersedes it: radically simple, 2–3 actions in a bar.
  - EDN-10: phone sheets load lazily.
  - EDN-14: phone Share and Save a copy.
  - PRC-11: the bundle gates are never raised.

How it is built. The pure page operations live in `packages/document-model/src/pages.ts`:
- `movePages` :215, `deletePages` :255, `duplicatePages` :273, `rotatePages` :311
- `insertBlankPage` :534, `reversePages` :576, `interleave` :596, `splitDocument` :769,
  `mergeDocuments` :846

App actions:
- `apps/web/src/stage/arrange-actions.ts` (extract, Move to, blank, paste, reverse)
- `stage/arrange-commands.ts`
- `commands/app-commands.ts:503-581` (rotate, delete, duplicate, ‹ ›)
- `dnd/drop.ts` (`transferPages`, and `insertFilesAt` :178 for OS files)
- `stage/section-operations.ts`
- `pages-sheets/*`

Bytes are produced only at export: `export/export-service.ts` `prepareExport` :610, then the
engine's assembler worker.

## 1. Desktop audit

### 1a. What works (verified on exported bytes)

All checks below ran at 1440×900 in Chromium (`ops.mjs`):

| Flow | Result |
|---|---|
| Merge (title ⋯ › Merge files… with one doc open → picker → Combine sheet → Combine) | New document "Combined – rotated-pages + simple-text", 7 pages, sources kept (INV-12), opens in the grid. Export: 7 pages; rotations 0/90/180/270 preserved; sizes kept (595×842, 612×792). |
| Rotate (select, Shift+R), Delete (bar), Duplicate (bar), Insert blank + Ctrl+Z, ‹ › Move later | Export matches the grid exactly: `R2(90) R1(90 = 0+90) R2' R4(270) S1 S2 S3`. Undo removed the blank page. |
| Extract (Keep, the default) of 2 pages | New tab "… (extract)" with 2 pages and their rotation; the source is unchanged. |
| Extract by range `380-382` from many-pages.pdf | Inherited `/Rotate 90` on 381–382 is materialised (0/90/90); size 200×100 kept. |
| Split, Every n pages (default 4) | Two tabs "(1 of 2)", "(2 of 2)"; the part exports correctly; one Ctrl+Z restores the original. |
| OS file dropped on a grid gap (`insertFilesAt`, synthetic DataTransfer) | 5 pages of mixed-sizes.pdf inserted at index 1. Export keeps each page's MediaBox and /Rotate (A4, Letter, rot 90, 842×595, 200×200). |
| Mouse drag reorder; touch long-press drag (tablet, CDP) | Both reorder correctly (`drag2/3.mjs`, `tablet.mjs`). |
| Delete guard (every page selected) | Delete dims; toast "Deleted page 2 · Undo". |

The engine side is sound: page count, order, rotation and size survive export in every case I tried.

### 1b. Divergences and bugs (with repro)

**B1. "Insert pages from file…" does not exist.** This is the real "merge into this document" flow.

- Spec: title menu Pages (01-frame.md:564), page menu (04-context.md:625, :647), thumbnail menu
  (06-navigation.md:359), and S18's own entry ("after choosing images in Insert pages from file…",
  07-sheets.md:952).
- What the code has:
  - The title menu has `{ kind: 'merge' }` "Merge files…" (`TitleMenuItems.ts:81`, `menu_merge`
    en.json:3724).
  - ⌘K "insert" offers only Paste, Insert blank page, and Insert images as pages.
  - The only route that inserts a PDF into a document at a position is an OS drag onto a grid gap
    (`ArrangeView.tsx:696` → `insertFilesAt`). There is none on touch and none from a picker.
- Repro: open simple-text.pdf. Search the title menu, ⌘K "insert", the Pages bar ⋯, and a page's
  right-click menu: no entry inserts pages from a PDF.

**B2. "Merge files…" makes a new third document, and its order is surprising.**

The routing is in `TitleMenuItems.ts:260-268` and the order comes from `initialCombineOrder`
(`CombineSheet.tsx:44-52`).

- With one document open it opens the picked file as a tab, which becomes the active one.
- The Combine sheet then puts the *active* (newly picked) file first. The user's own document ends
  up second ("Combined – rotated-pages + simple-text"), and three tabs remain open.
- With two or more documents already open it skips the picker entirely and checks every open
  document. So "Merge files…" never asks for a file then.
- The label also contradicts the spec, which has "Combine with open documents…" plus
  "Insert pages from file…". "Combine with open documents…" itself is not in the title menu; it is
  reachable only from ⌘K.
- Repro: open simple-text → title menu → Merge files… → pick rotated-pages → Combine → page 1 is
  rotated-pages' page 1.

**B3. Move to ▾ disappears when the bar folds.**

- `PagesBar.tsx:179-185` re-adds only Extract and Duplicate to ⋯. `<MoveToMenu>` renders only when
  `fold === 'full'` (:314-324).
- The header comment (:22) and 04-context §10 both say "Move to into ⋯".
- Repro, tablet with touch: select a page at 1024×768 or 820×1180. The bar shows
  `done, ↺, ↻, ‹, ›, delete, (extract), more` and ⋯ has no Move to (`tablet.mjs`).
- On touch there is no tab drop either (`pages-grid.spec.ts` skips it: "Move to instead"). So the
  portrait iPad has no way to move pages to another document (Cut then Paste after is the only
  workaround).

**B4. The page menu is much thinner than §13.**

- `PageContextMenu.tsx:326-365` has: Edit text here, Rotate ×2, Delete, Crop…, Show in Pages grid.
- Missing against the spec: Insert blank page after, Insert pages from file…, Extract page…,
  Copy page, Paste pages after, and the "Add … here" rows.
- The thumbnail menu (`ThumbnailMenu.tsx:190-225`) has Insert blank, Extract, Copy and Paste, but
  lacks Insert pages from file… and Recognize text on this page.

**B5. A tooltip sticks on touch.**

After tapping Select and a cell on the tablet (1180×820, touch), the "Extract" tooltip stays shown
above the bar (`shots/tablet-grid-selected.png`). A Base UI tooltip is opening from a touch focus or
hover.

**B6. The Undo toast goes stale and then reads oddly.**

Delete page 2, then rotate page 1 (Shift+R). The delete toast becomes "Newer changes came after this
· History" (`toasts.mjs`). That is defensible, but rotation in the grid has no toast or undo
affordance of its own, while the page menu's rotate says "Rotated page 3 · Undo" (§13). The grid
and the page menu are inconsistent.

**B7. One mouse drag did not reorder (intermittent, not reproduced).**

- In `ops.mjs`, a drag of cell 5 before cell 2 right after Combine, Save a copy and ⌘K did not
  change the order. The exported order proves it.
- Six later attempts (`drag2/3.mjs`, same sequence) all worked.
- While moving, the `insertion-bar` index read for the same point varied between 1, 2 and 3.
- Low confidence; worth a watch in CI's J4.

**B8. Small layout gap.**

On an empty grid with a few pages there is no visible "add pages" affordance (`desktop-grid-rest.png`).
Drop on a gap is the only insert, and nothing invites it.

**B9. Test gaps: the e2e passes but would not catch regressions.**

- `jobs.spec.ts:689-693` (V1-F6 rotate) asserts only "1 selected", not the rotation.
- Extract and split assert only tab counts.
- On the tablet, extract, delete and split are skipped (`barAct`, :698-701).
- No e2e exports after reorder, delete or duplicate and checks order with pdf-lib.
  `save-copy.spec.ts:58` covers rotate only.
- Nothing covers "Insert pages from file", Move to on a folded bar, or the phone.
- Unit coverage of the model is good: `document-model/src/__tests__/pages.test.ts`, `move.test.ts`,
  `reshape.test.ts`; app side `arrange-actions.test.ts`, `operation-plans.test.ts`,
  `section-operations.test.tsx`, `light-table.test.tsx`, `dnd/*.test.ts`.

**Not bugs (as specified):**
- Split replaces the original with its parts. With Every n pages no pages stay outside the ranges
  (S13).
- Extract defaults to Keep (S16).
- Combine always makes a new document (INV-12).

## 2. Phone today

- **Pages.** The capsule is `Pages · n/N · Find` plus ✎ (`CompactChrome.tsx:356-372`).
  - Pages opens `compact-pages-sheet`, a tall CompactSheet with "Pages" and Done and a
    virtualised 3-column thumbnail grid (`CompactSheets.tsx:80-180`).
  - A tap jumps to the page (`onPick={() => jumpTo(doc, index)}` :174). A long press also just
    jumps and closes the sheet (`phone.mjs`).
  - There is no selection, menu, reorder, rotate, delete, insert, extract or split. Contents,
    Go to page, Info and About are lazy in `CompactMoreSheets` (EDN-10).
  - The N6 design (Pages | Contents | Review, Pages bar ↺ ↻ ‹ › Delete) was never built.
- **⋯ menu:** Find, Contents, Go to page, Download a copy (Share or Save a copy once the document
  has changed, EDN-14), Document info, About.
- **Editing island (EDN-8 to EDN-18):** pen, highlight, text, sign, edit text. No page acts.
- **One document at a time.** `openPdf` → `closeOpenDocument` → `resetWorkspace()`
  (`compact-actions.ts:96-112`). So any act that makes new documents (Extract, Split, Combine) has
  nowhere to live as a tab on the phone.
- **The sample on a phone tells a lie.** Page 4 says "Press 3 or pinch to see every page. Drag a
  thumbnail to move it." (`tools/fixtures/sample-fixture.ts`); EDN-9 already covers the rewrite.
- **Bundle.** The compact gate is 320 KiB against a 291.5 KiB baseline, with a growth cap of 1 % per
  wave (`tools/qa/bundle-budget.json`). There is about 3 KiB of headroom per wave, so page work must
  be a lazy chunk, as `mark-host.ts:22` and `CompactSheets.tsx:35` already do.

## 3. UX research (phone page management)

Sources: web search on 2026-10-14 (links below), plus prior knowledge where marked [K].

- **iOS Files / Quick Look (iOS 15+)**
  - Swipe from the left edge for a thumbnail sidebar.
  - Long-press or ⋯ on a thumbnail gives Rotate Left/Right, Insert Blank Page, Insert from File,
    Scan Pages, Delete.
  - Press, hold and drag reorders.
  - Changes save on Done. Delete cannot be undone, which is a known complaint.
  - Takeaway: one context menu per page, and insert-from-file sits *at a position*.
- **Adobe Acrobat mobile, Organize Pages** (subscription)
  - The thumbnail grid opens as a mode. Select pages, then a bottom bar with rotate, delete,
    extract, insert (blank, from file, scan) and a reorder drag.
  - Combine files is a separate tool that picks files from recents or storage and orders them as a
    list [K, partly confirmed].
- **PDF Expert (iOS)**
  - The thumbnail icon opens a full-page grid. Long-press and drag reorders.
  - Select (top right) → tap pages, with odd/even and range helpers → a bar with Rotate, Extract,
    Copy, Delete. Extract saves a new file.
  - No auto-split: split means select and Extract.
  - Merge comes from the file manager (Select files → More → Merge) or Tools › Merge.
- **Google Drive** [K]: viewing only on phone. No page organisation. Its PDF tools are on the web.
- **Samsung Notes** [K]: imported PDFs show a page grid. Long-press for multi-select, drag to
  reorder, add page, delete; share as PDF.

**Patterns to borrow**
- The page grid is a full-screen *mode*, not a small sheet.
- Long-press starts selection (Photos and Files); a long press *and move* lifts a page for dragging.
- Edge autoscroll while dragging.
- Selection actions sit in a bottom bar of three or four glyphs, with a ⋯ for the rest.
- Insert from file asks *where*, and uses the system picker.
- Extract and split produce a *file* that goes straight to the share sheet. iOS phone users expect
  the result in Files or the share sheet, not another tab.

**On Web Share**
- `navigator.share({ files })` works on iOS Safari 15+ and Android Chrome. It needs a user
  activation, hence `prepareCopy` before the tap (EDN-14).
- Several files can be shared at once on both, so the split parts can go out together.
- Where `canShare` is false: download each file.

Sources:
- https://www.macrumors.com/how-to/edit-pdf-documents-files-app
- https://9to5mac.com/2021/07/07/how-to-edit-pdfs-with-iphone-ipad-in-ios-15/
- https://pdfexpert.com/ios/how-to-rearrange-pages
- https://pdfexpert.com/how-to-split-pdf-pages
- https://pdfexpert.com/ios/how-to-merge-pdf
- https://support.readdle.com/pdfexpert/managing-files-and-folders/add-delete-and-rearrange-pdf-pages
- https://www.adobe.com/acrobat/hub/rearrange-pdf-pages-on-iphone.html
- https://www.adobe.com/acrobat/hub/how-to-split-a-pdf-on-an-iphone.html
- https://community.adobe.com/t5/acrobat-discussions/delete-pages-pdf-document-on-iphone/m-p/11729741

## 4. Proposal: the phone Pages grid ("Sayfalar")

### 4.1 Shape (EDN-7: two or three actions, the rest in a pop-up or drawer)

Pages becomes a **full-screen grid place** instead of a tall jump-only sheet. It is the same grid
whether the user reaches it from the capsule's Pages button or by pinching out past fit, which is
the other researcher's gesture. The grid's `enter(atPage)` gives that gesture one door.

**At rest:**

```
 ‹ report.pdf · 12 pages            Select      top capsule (DSN-32 glass)
 ┌────┐ ┌────┐ ┌────┐
 │ 1  │ │ 2  │ │ 3  │    3 columns at 390 (2 at large text), pinch steps S/M/L
 └────┘ └────┘ └────┘
        ╭──────────────────────────╮
        │  ＋ Add   ·   ⤴ Share     │   bottom capsule: 2 actions
        ╰──────────────────────────╯
```

- **Tap** a page: it opens there (back to the reader, morph).
- **Long-press, released:** selection mode with that page selected (Photos, DSN-10).
- **Long-press and move:** lifts the page and drags it, with a gap bar and edge autoscroll. This
  reuses `dnd/pointer-drag.ts` and `dnd/geometry.ts` (`gapAt`, `edgeScrollSpeed`).
- **＋ Add** opens a small glass drawer (the edit drawer's grammar, EDN-18):
  - Pages from a file… (system picker, several PDFs or images) inserts after the current page,
    or at the end.
  - Blank page.
  - From Recents (a list of the phone Library's Recents) adds that document's pages.

  This drawer is *the phone's merge*: one document grows, which fits the one-document model.
- **⤴ Share:** the existing `shareOrDownload` (EDN-14).

**In selection mode:**

```
 Done        3 selected        Select all
        ╭───────────────────────────────╮
        │  ↻ Rotate · 🗑 Delete · ⋯      │   3 actions
        ╰───────────────────────────────╯
 ⋯ action sheet: Rotate left · Duplicate · Move to start / end · Extract as new file… ·
   Split here (starts a new file at each selected page)… · Share these pages
```

**Split, the whole-document form:** the top capsule's ⋯ → "Split into files…" opens a sheet:
- Every n pages, Ranges, or Before each selected page.
- Its preview reuses `split-preview.ts`.
- The result goes **to the share sheet as N files**, or downloads. No tabs.

**Extract** builds one file and shares it; the open document is untouched. Option: "Remove from
this document" (S16's Remove).

**Undo:**
- Every act is one history step.
- The grid shows an Undo toast for 4 s, as EDN-13's selection bar does.
- The top capsule keeps ↶ while in the grid, because the island is not mounted there. `canUndoHere`
  must be extended to accept page steps.

### 4.2 Engine and model calls to reuse unforked

| Act | Call |
|---|---|
| rotate | `useWorkspaceStore.getState().rotatePages(ids, ±90)` |
| delete | `deletePages(ids)` |
| duplicate, move | `applyOperation` with `duplicatePages` / `movePages` (or `transferPages` from `dnd/drop.ts`, which also selects and announces) |
| insert from file | `insertFilesAt(files, {document, index})` (`dnd/drop.ts:178`: PDFs and images, one history step, bookmarks carried) |
| insert blank | `insertBlankPage` |
| from Recents | the snapshot or file reopen paths in `compact-actions.ts` produce a `File`, then `insertFilesAt` |
| extract / split to files | create the documents in the workspace (`newEmptyDocument` + `duplicatePages`, or `splitDocument` on a temporary copy), `prepareExport(docId)` for each, share the `File[]`, then close the temporary documents |

For extract and split there are two options:

1. **Preferred:** a small pure helper. Build the export plan for a page subset, `export-plan.ts`
   with a page filter, so no temporary document ever enters the workspace or history.
2. **Simpler:** use temporary documents and roll back with `closeDocument`. This must not reach
   Recents or the snapshot.

Option 1 needs a check that `prepareExport` can take a page subset. If it cannot, add an
`options.pages` to `ExportOptions` in `export-service.ts`, shared by both editions.

### 4.3 Implementation steps, in order

1. **Desktop fixes first.** They share code and decide the vocabulary:
   - B1: an `pages.insertFromFile` command. Picker, then `insertFilesAt` after the focused or
     current page. Add it to the title menu, the page menu, the thumbnail menu and the Pages bar's ⋯.
   - B2: split "Merge files…" into Insert pages from file… and Combine with open documents…; keep
     the user's document first.
   - B3: Move to in ⋯ when folded.
   - B4: page-menu rows.
   - B5: the touch tooltip.
   - Files: `stage/arrange-commands.ts`, `shell/frame/TitleMenuItems.ts`,
     `stage/PageContextMenu.tsx`, `shell/sidebar/ThumbnailMenu.tsx`, `stage/grid/PagesBar.tsx`,
     `messages/en.json` and `tr.json`.
2. **Phone grid shell (lazy):**
   - New `shell/compact/pages/` chunk: `PagesPlace.tsx`, `pages-actions.ts`, `PagesBar.tsx`,
     `AddDrawer.tsx`, `SplitSheet.tsx`.
   - It is loaded by `import()` from a tiny `pages-host.ts`, the `mark-host.ts` pattern.
   - The static `CompactSheets.tsx` Pages sheet stays as the fallback until the chunk loads, or the
     grid replaces it once loaded (prefetch on idle, as EDN-10 does).
   - `compact-store.ts` gains `place: 'reader' | 'pages'`, `selection` and `selecting`.
3. **Selection and acts:** rotate, delete, duplicate, move, with Undo toast and ↶ in the top capsule.
4. **Touch drag:** reuse `dnd/pointer-drag.ts` and `geometry.ts`. Write a compact `phone-grid-drag.ts`
   modelled on `stage/grid/grid-pointer-drag.ts`. Do not import `ArrangeView` (1142 lines, full
   shell stores).
5. **Add drawer:** from file, blank, from Recents.
6. **Extract and split to files**, plus multi-file share (`compact-actions.ts` `shareOrDownload`
   generalised to `File[]`).
7. **Pinch door:** expose `openPagesPlace(atPage)` for the pinch researcher.
8. **Sample page 4 copy for phones** (EDN-9). Add a decisions row (EDN-19) for the phone pages
   place and the "results go to the share sheet" rule.

### 4.4 Bundle

- Keep the static path at a loader of about 1 KB plus the ⊞ entry.
- Estimate the chunk at roughly 25–40 KB min: grid, bar, drawer, split sheet, drag recogniser.
  `document-model` and the workspace store are already in the compact closure.
- `prepareExport` is already lazy (`compact-actions.ts:301`).
- Watch that `dnd/drop.ts` imports `ui-store`, `selection-store` and `announcer`. Check they are not
  full-edition-heavy, or wrap `insertFilesAt`'s core in a store-light module.
- Measure with `tools/qa/bundle-budget.ts`. Never raise the gate (PRC-11).

### 4.5 Tests

- **Unit:** `pages-actions.test.ts` (plan for rotate, delete and move; split ranges → files;
  extract subset), compact-store place and selection, drag state on synthetic streams (as
  `pointer-drag.test.ts`).
- **e2e, `phone` and `phone-land` projects:** a new `compact-pages.spec.ts`, added to
  `PHONE_SPECS` in `playwright.config.ts`. Each flow exports and checks the bytes with pdf-lib.
  - Open the grid, long-press 3, Rotate, Delete, Undo.
  - CDP long-press drag 5 → before 2, with autoscroll on many-pages.
  - Add › from file (mixed-sizes) at a position.
  - Extract 2 pages → stubbed `navigator.share` receives 1 file with 2 pages.
  - Split every 2 on simple-text → 2 files.
  - Bundle gate in CI.
- **Desktop:** e2e for Insert pages from file…, Move to at the 820 fold, and V1-F6 checking bytes.

### 4.6 Risks

- **iOS Safari activation.** A share after an async export loses user activation. Fix: build the
  file(s) when the act is chosen, then show a "Share 2 files" button (second tap), or fall back to
  download (EDN-14 precedent).
- **Long-press conflicts** with iOS callout and text selection on thumbnails. Use
  `-webkit-touch-callout: none` and the gesture core's recogniser, as the page menu does.
- **Memory on phones.** Inserting large PDFs, or splitting a 400-page file into many exports. Run
  exports sequentially and show progress.
- **Snapshots.** Page acts mark the document changed. "Changed on this device" and the Recents
  snapshot must cover inserted sources (multi-source documents on the phone are new territory).
- **Gesture overlap with the pinch door.** In the grid, pinch should step cell size (PG1), not
  re-enter. Coordinate with the pinch researcher.

### 4.7 Owner taste questions (at most 3)

1. Should the results of Split and Extract on a phone go straight to the share sheet as files
   (proposed), or open as the phone's new current document?
2. Should the grid's bottom capsule at rest be "＋ Add · Share" (proposed), or "＋ Add · Select"
   with Share left in ⋯?
3. Should merge on the phone be "add pages into this document" only (proposed: Add › from file or
   Recents), or also a Library-level "Combine files" that makes a new document from several Recents?
