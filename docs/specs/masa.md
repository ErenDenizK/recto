# Masa (the desk): the new Home, build spec

Decision id: **DSN-87**. Written 2026-10-31 against `origin/develop` at `80a5b90d`. The owner
approved the move. This spec settles the technique, names the taste questions the owner still has
to answer (§6), and splits the work into four implementer lanes (§5). Colour is deliberately
absent: every surface names a material tier or a semantic token (`--page-background`,
`--accent-fill`, lit glass, M2), because a separate colour lab is redefining the palette.

Sources read: `CLAUDE.md`; `docs/process/decisions.md` and `decisions/design.md` (DSN-13, -31,
-33, -46, -50, -64, -66, -74, -78, -82, -83); `docs/design/redesign-2026-10/components/02-library.md`
(L1, L2, L7, L8, L10); `docs/research/perf-2026-10.md`; `apps/web/src/home/*`, `files/recents.ts`,
`session/{session,restore,resume,resume-view,storage,retention}.ts`, `engine/bitmap-cache.ts`,
`pages/placeholder.ts`, `scan/scan-flag.ts`, `labs/flags.ts`, `shell/compact/{CompactLibrary,
ContinuedLibrary,compact-resume}.tsx|ts`, `commands/keywords.ts`, `markup/doors.ts`,
`tools/qa/bundle-budget.{ts,json}`, `tools/perf/baseline.ts`; e2e `library.spec.ts`,
`open-light.spec.ts`, `session.spec.ts`, `compact.spec.ts`. Today's Home was screenshotted at
1440×900, 1180×820 (touch) and 390×844 from the local build (Home visible in 600–710 ms there,
an unthrottled local server).

---

## 1. Current state

### 1.1 What Home is today

| Piece | File | What it does |
|---|---|---|
| Library view | `home/LibraryView.tsx` | Two shapes. **Empty** (no open document): Continue slot (flag), the launcher card (mark, headline, promise, actions), Recents (`variant="empty"`), the sample card centred. **With documents**: Continue slot, the launcher row, the open-documents head and card grid, Recents, the sample card at the column's edge. Column max 1184 px, scrolls under the strip. |
| Launcher | `home/Launcher.tsx` | One lit capsule: **Open files…** (the view's one primary, first focus with quiet focus, J1 = 2), **Combine files…**, **Batch…**, **Scan…** (only under `?scan=1`), drop line "or drop files anywhere". Drag-over lifts it and rewrites the headline. Drops to the standard fill while the Continue card shows (`continue-shown.ts`). |
| Open cards | `home/LibraryGrid.tsx`, `LibraryCard.tsx`, `LibraryHead.tsx`, `SelectionBar.tsx`, `library-store.ts`, `home-cards.ts` | One card per open document (cover rendered live through the engine by `PageThumb`), Select mode, Combine/Compare/Pages/Close bar, drag reorder. Behind the Continue flag a card shows the page left and a 3 px progress bar. |
| Recents | `home/RecentList.tsx`, `files/recents.ts` | Lit panel of rows (32×40 thumb, name, pages · size · hint · time, ⋯). Store: IndexedDB `pdf-editor:recents:v1` (version 2: `entries` and `handles`), at most `RECENTS_LIMIT = 12`, memory fallback, "no file bytes and no thumbnails are stored here". Identity of a file is name + size (`sameRecentFile`). A row reopens its kept snapshot (no prompt), else its stored handle (permission inside the click), else the file dialog ("Open again…"). |
| Row thumbnails | `home/recent-thumbs.ts` | Only for rows with a kept snapshot: reads `kept/<id>.json` and `sources/<id>.pdf` from OPFS, **opens the source in PDFium**, renders one page, closes it. In-memory cache for the session only. Nothing persistent. |
| Sample | `home/SampleCard.tsx`, `sample/SampleCover.tsx`, `use-sample-available.ts` | Lit card with a static drawing of the sample's cover (no engine); dimmed with a reason offline. Hidden once the sample is open or in Recents (`sampleOnScreen`). |
| Aura | `home/Aura.tsx` | CSS light behind the column, laid by the shell (DSN-24). |
| Phone Library | `shell/compact/CompactLibrary.tsx` | DSN-31/DSN-50/DSN-33 composition: mark + wordmark + promise, the four tool chips and the EDN-15 line, the sample card, Recents as rows (glyph, no thumbnail), "No files yet" before the first file, Open PDF in a floating dock (the one primary), gear to settings. Page scrolls itself. |

### 1.2 The three flags

| Flag | Reader | What it already does | Status |
|---|---|---|---|
| `?home=continue` (DSN-66; Labs `home-continue`, "soon") | `home/home-flags.ts` `HOME_CONTINUE_FLAG`; lazy chunks `ContinueDesk.tsx` (full), `shell/compact/ContinuedLibrary.tsx` (phone) | The **Continue card** (`ContinueView.tsx`): the page left as an 88×116 thumbnail, name, "Page 4 of 8", progress bar, pending lines (changes not saved, signature fields, comments), one primary "Continue". Source: the open document read last (`ContinueCard.useOpenSource`), else the newest Recents row with a kept snapshot (`ContinueDesk.useKept`, place read from OPFS, page **rendered through PDFium** by `recentThumb`). **Exact resume**: `session/resume.ts` keeps page, zoom, fit and offset per open document in memory and in the snapshot (`DocumentPlace.resume`); `resume-view.ts` restores zoom, page, then nudges the scroll until it holds for four frames, the view held transparent meanwhile. Cards show progress and the page left. Kept rows reopen at zoom and offset. The one-primary swap. | Built, e2e `library.spec.ts` "R26: Continue returns to page 4…" (in-session only). |
| `?open=light` (DSN-64; Labs `open-light`, "prototype") | `home-flags.ts` `OPEN_LIGHT_FLAG`, `library-transition.ts` `growInto`, `open-light.ts` | Opening a Library card clones its sheet over the window, veils the Library copy, grows the clone into the reader's page on `glide` and dissolves at 85–97 %; the reader is held invisible meanwhile; the light pulses once per session after the sharp render. Phone rows grow a paper sheet out of the glyph. **Waits only ~30 frames** for the arriving page, then drops the clone (a Recents reopen, which takes longer, gets no grow). The "never bare white" ladder (cached bitmap, quarter-scale render, paper tone) is in force without the flag. | Built, e2e `open-light.spec.ts`. |
| `?scan=1` (DSN-78, PRD-34; Labs `scan`, "prototype") | `scan/scan-flag.ts` | A **Scan…** button in the launcher and ⌘K "Scan document…"; one overlay sheet (camera, review, corners). Desktop and tablet only; the phone's scan is a later lane (EDN-22). | Prototype, owner taste open. |

### 1.3 Reusable as is

- `ContinueView` (drawing), `ProgressBar`, `continue-shown.ts` (one-primary swap), `resume.ts` /
  `resume-view.ts` / `compact-resume.ts` (exact resume), `resumeDocument`, `openRecent`,
  `openRecentAgain`, `removeRecentEntry`, `combineFiles`, `openPdfs`, `trySample`.
- `growInto`, `ghostOf`, `lightPulse`, `backToLibraryMorph`, `paint-fade.ts`,
  `pages/placeholder.ts`.
- `recents.ts` access states (`granted`/`prompt`/`unavailable`), notes, Clear and its
  confirmation, retention (30 days or 500 MB) and the private-window behaviour.
- `home-model.ts` `gridStep`, `middleTruncate`, `relativeTime`, `visibleRecents`,
  `sampleOnScreen`.
- The palette's catalog keywords already carry "pdf to jpg", "images to pdf", "txt to pdf", "pdf
  to markdown" (`messages/*.json`, `commands/keywords.ts`).
- `markup/doors.ts` `openMarkupDoor('sign')` (Fill & sign, DSN-75).

### 1.4 Missing

1. **No persistent covers.** Every cover today is rendered through PDFium (open cards: the live
   engine; kept rows and Continue: a fresh engine open from OPFS bytes). On a cold start that
   means starting the PDFium worker (1.6 MB wasm) before the first cover can show, which rules
   out the 1 s desk. Plain recents (no snapshot) have no picture at all.
2. **No progress on plain recents.** The place lives only in kept records (OPFS JSON, one read per
   row) and in memory.
3. **Continue only after a kept snapshot or for an open document**; nothing for a file reopened
   through its handle or the file dialog.
4. **The launch preempts the desk.** `session.ts` restores the last session's `destination`; a
   person who was reading lands in the document, so the desk is seen only by people who left from
   the Library or closed everything (owner question Q1).
5. **No "Sign" door on Home**, no named conversions when no document is open: ⌘K "PDF to JPG"
   finds `document.exportImages`, which needs an open document (`when: hasPages`).
6. **The grow cannot wait** for a reopen, and the arriving page has nothing to show but a
   quarter-scale render or paper tone: a Recents open still has a near-white moment.
7. **No e2e for continue across a close or a cold start**, no paint-time measure for Home with
   covers, no check that the desk starts no engine.
8. Copy: `continue_title` in Turkish reads "Kaldığın yer" (sen); DSN-74 wants *siz*:
   "Kaldığınız yer".

---

## 2. The design

### 2.1 Principles

- **The desk is where you were, then what you can start, then what you had.** Top to bottom:
  the hero (Continue, or the sample on a first visit), the intents, the open documents (only when
  some are open), Recent as covers.
- **One geometry for first visit and return.** The hero slot has the same size whether it holds
  the sample or Continue, so the desk does not re-flow when the first document arrives.
- **Nothing on the desk's first paint needs the engine.** Covers are small images on the device,
  read in one IndexedDB transaction.
- **One primary per view** (ADR-0023, DSN-66): Continue when it shows, else Open files….
- **Calm copy, sentence case, no hype.** No new promise lines; the existing headline and
  "Nothing leaves this device." stay for the first visit only.

### 2.2 Desktop (large and xlarge, 1440×900 reference)

Column: today's (`--piece-inset` from the window's edges, max 1184 px, centred), on a 12-column
grid with 24 px gutters. The strip's pieces float above as today; the column scrolls under them.

**Returning desk** (anything to continue, or any recents, or any open document):

```
◆ Library   [tabs…]                                                          ⋯
┌──────────────────────────────── 8 cols ─────────┐ ┌──────── 4 cols ─────────┐
│ Where you left off                              │ │ ▢ Open files…  ▢ Sign a │
│ ┌────────┐ report-v2.pdf                        │ │   PDFs, images   PDF…   │
│ │ page   │ Page 4 of 10 · yesterday             │ ├────────────┬────────────┤
│ │ left   │ ▬▬▬▬▬▬▬▬▬───────────────             │ │ ▢ Combine  │ ▢ Scan…    │
│ │132×172 │ • Changes not saved  ✑ 1 to sign     │ │   files…   │            │
│ └────────┘ [Continue]                            │ │            │            │
└─────────────────────────────────────────────────┘ └────────────┴────────────┘
  ⤓ or drop files anywhere · More ways… ▾                    (one quiet line)

Open · 2 documents · 18 pages                                          Select
[card][card]                                     (today's grid, unchanged)

Recent                                                         Clear recents
[cover][cover][cover][cover][cover][cover]       (6 per row at 1184, ≤ 12)
[cover][cover]…                                  [Try the sample] as the last tile
Kept on this device while the browser keeps it · Manage
```

- **Hero height** 220 px (Continue card) at large; the intents grid matches its height (two rows
  of 98 px tiles with a 24 px gap). At 1440×900 the strip, hero, the drop line, the Recent head
  and the first row of covers are all above the fold (about 72 + 220 + 24 + 40 + 40 + 280 = 676 px).
- **Continue card** (`ContinueView`, `variant="desk"`, enlarged): the page left at **132×172**
  (was 88×116); name in title3, "Page 4 of 10 · yesterday" in callout with tabular numbers, the
  bar, pending lines, **Continue** (prominent, size M). Lit glass, as today.
- **Intent tiles**: four lit tiles in a 2×2 grid (`role="group"`, label "Ways to start"): a 32 px
  Phosphor glyph, the label (body 600) and a one-line hint (footnote, secondary text). Open files…
  is the prominent fill when no Continue shows, else the standard fill; the other three are
  standard. Scan… appears only where scan is on (owner question Q4); with three intents, Open
  spans the top row.
- **More ways… ▾** (a quiet text button on the drop line, Base UI `Menu`): Batch…, Images to PDF…,
  PDF to images…, Text to PDF…, Markdown to PDF…, and Office to PDF… where `?office` is on. Each
  row runs a registered command, so the same names are found in ⌘K (§2.9).
- **Open documents**: today's head, grid, Select mode and bar, untouched. A card whose document
  is the Continue document still shows (it is a tab), with its progress bar.
- **Recent**: the shelf of covers (§2.4), replacing `RecentList`'s rows. "Clear recents", the
  confirmation, the footnote and the notes stay as they are (02-library L7).
- **Try the sample**: on a returning desk it is the shelf's last tile (the sample's cover drawn by
  `SampleCover`, "Try the sample", "A small magazine to try every tool on."), shown only while
  `sampleOnScreen` is false; this replaces the separate card after Recents (DSN-50 order kept:
  your files above the sample).

**First visit** (recents loaded and empty, nothing open, nothing to continue):

```
                          [mark 56]
              Read, mark up, sign and arrange PDFs.
                   Nothing leaves this device.
┌──────────────────────────────── 8 cols ─────────┐ ┌──────── 4 cols ─────────┐
│ ┌────────┐ Try the sample                       │ │ ▣ Open files…  ▢ Sign a │
│ │ sample │ A small magazine to try every tool   │ │   (primary)      PDF…   │
│ │ cover  │ on. 8 pages.                         │ ├────────────┬────────────┤
│ │132×172 │ [Open the sample]                    │ │ ▢ Combine  │ ▢ Scan…    │
│ └────────┘                                      │ │   files…   │            │
└─────────────────────────────────────────────────┘ └────────────┴────────────┘
  ⤓ or drop files anywhere · More ways… ▾
```

- The identity block (mark, headline, promise) stays for the first visit only, a third of the way
  down as today; on a returning desk it goes (the strip's "◆ Library" names the place, DSN-50).
- The **sample hero** takes the Continue slot: the same card size, a large static cover, the
  name, the line, and **Open the sample** as a standard button (the primary stays on Open files…,
  first focus, J1 = 2). The whole card is one press target, as the sample card is today. This is
  the "strong first step": the biggest picture on the screen is the sample.
- No Recent section (today's rule: nothing to list, no placeholder).

### 2.3 Tablet (expanded, 1180×820 touch reference; medium 600–839)

- **Landscape, expanded (840–1199)**: the desktop layout with the column at the window's width
  minus the inset (1148 px at 1180). Hero 8/4 split kept; tiles grow to the coarse sizes (52 px
  minimum target, 108 px tile). Covers: 5 per row. Everything else as desktop; hover rules are
  replaced by press (MOT-10).
- **Portrait or medium (600–839)**: the hero stacks. Continue (or the sample hero) full width
  (180 px tall, page 104×136), then the four intents as **one row of four** tiles (two rows of two
  under 720 px), then the drop line. Covers: 4 per row (3 under 720 px).
- iPadOS drag-in of files works as today (the whole window is the target).

### 2.4 The cover shelf (Recent)

- **Tile**: the cover (first page, or the page left when past page 1, as DSN-66 does for cards)
  on a sheet with the page's own hairline and `--page-shadow`, fitted in a 152×200 box at large;
  under it the name (two lines, middle-truncated, `middleTruncate`), one meta line ("Page 4 of
  10 · yesterday", or "8 pages · yesterday" when never read past page 1), and the 3 px neutral
  progress bar (DSN-66: progress is never the accent). A **badge** on the meta line says what a
  press will need: "Edited, changes kept", "Needs permission", "Open again…" (today's
  `recentHint` strings). The tile is lit glass like a Library card; the cover inside is content
  (solid).
- **Cover missing** (encrypted source, image failed, not captured yet): the sheet in paper tone
  (`--page-background` mixed as DSN-64's paper tone) with the file glyph centred; never blank and
  never a shimmer (MOT-4).
- **⋯ on a tile**: Remove from Recent, Remove and delete kept changes (as today); shown on hover
  and focus on fine pointers, always on coarse ones.
- **Order**: newest first, kept rows not hoisted (one shelf, one order); files open right now are
  hidden (`visibleRecents`), the open grid already shows them.
- **Many documents**: Recents stay capped at 12 (`RECENTS_LIMIT`, spec M5), so the shelf is at
  most two rows at large and three at medium; no paging, no "show all". Open documents have no
  cap (today's grid).
- `?home=search` (3d) keeps working on the shelf: its tools sit on the Recent head row; it stays
  behind its flag (not part of this move).

### 2.5 Phone (compact, 390×844 reference)

The phone keeps its own composition (DSN-31, DSN-33: the page scrolls itself, Open PDF floats in
the dock) and takes the desk's order.

**First visit**: unchanged (DSN-31, DSN-50): identity in the upper third, the four tool chips and
"Every tool on a computer or tablet.", Try the sample before the "No files yet" card, Open PDF the
one primary in the dock. Masa adds nothing here, so the first phone load stays as it is.

**Returning**:

```
[R] Recto                                   (⚙)     header row, mark 28
Where you left off
┌────────────────────────────────────────┐
│ [page 68×90]  report-v2.pdf            │
│               Page 4 of 10             │
│               ▬▬▬▬▬▬────────           │
│ [            Continue             ]    │  primary, full width
└────────────────────────────────────────┘
[✑ Sign a PDF…]  [⌗ Scan…]                 two tiles (Scan only with phone scan)
Recent                                Clear
┌────────────────────────────────────────┐
│ [44×58] lease.pdf                       │  cover rows (owner question Q3)
│         Page 2 of 4 · yesterday         │
│         ▬▬▬──                           │
├────────────────────────────────────────┤
│ …                                       │
└────────────────────────────────────────┘
[Try the sample]  (while not on screen)
Pen · Highlight · Text · Sign
Every tool on a computer or tablet.
                [ Open PDF ]                dock, standard while Continue shows
```

- The identity folds into a header row (mark 28 px and the wordmark in headline, gear trailing),
  as the landscape phone already does (DSN-31 item 6); the promise line goes on a returning
  phone (it is in About and on the first visit).
- Continue is today's phone card (`variant="phone"`), now fed by the kept fallback too (§3.2),
  which the phone lacks today.
- Intents: **Sign a PDF…** (opens the picker, then the reader with the edit island's Sign armed,
  EDN-14) and **Scan…** only once the phone's scan ships (EDN-22 lane L4); with Sign alone the
  tile spans the row. Open stays in the dock (thumb reach). No Combine on the phone (MOB-10 keeps
  it in the title menu).
- Recents rows gain a 44×58 cover and the bar under the meta line; "Reading now" keeps its rule
  (hidden while Continue shows it).
- The tool chips and the EDN-15 line move to the end on a returning phone: they explain the phone
  to a newcomer, a returning person already knows.
- Landscape phone: two columns as today; Continue and intents in the first, Recents in the second.

### 2.6 States

| State | Desktop and tablet | Phone |
|---|---|---|
| **Loading** (Recents not read yet) | Identity-free desk skeleton: the hero slot is held at its size with an empty lit card (no text, no shimmer); intents render at once (they need no data). If the read takes more than 300 ms the slot falls back to the first-visit sample hero. Covers show paper tone with the glyph until their image decodes; an image that arrives after first paint fades in on `quick`, one that is there at first paint just shows. | The plain screen renders meanwhile (today's `Suspense` fallback); Continue and covers join when read. |
| **First visit** | §2.2 first visit. | Unchanged. |
| **Returning, nothing to continue** (recents but none read past page 1 and nothing open) | Continue needs a place, so there is no card. The hero slot holds the sample hero while the sample is not on screen; otherwise the slot collapses and the intents become one row of four across the column. | Continue absent; intents first. |
| **Many documents** | 12 recents max (2 rows), open grid uncapped, the page scrolls; first row of covers above the fold at 1440×900. | 12 rows, page scroll (DSN-33), the dock floats over. |
| **Needs permission** (stored handle, `access: 'prompt'`) | Badge "Needs permission". Press: `openRecent` is called first, synchronously in the handler, so `requestPermission` keeps the activation; the grow holds (§2.7). Denied or moved: the tile's badge becomes "Open again…" and the note line under the shelf says why (today's `recents_note_unavailable`); the clone settles back. | Same, in the row. |
| **No handle, no snapshot** (Firefox, Safari, Chromium 153) | Badge "Open again…"; press opens the file dialog with the note (today's `openRecentAgain`). The cover still shows, so the person recognises the file they must pick. If the picked file matches (name + size) and the entry has a place, the document opens at that place (§3.2). | Same. |
| **Kept snapshot expired** (retention) | The `kept` field goes; the tile reopens like a plain recent; the place kept on the entry still drives page-level resume. | Same. |
| **Private window / storage refused** | OPFS refused: no snapshots, so Continue only for documents open in this tab; footnote "Changes are not kept in this window" (`session_not_kept`). IndexedDB refused too: recents and covers live in memory for the tab (today's fallback, extended to covers). | Same. |
| **Encrypted file** | No cover is ever stored for a source flagged encrypted (it could be read without its password); glyph sheet with the lock glyph. Continue shows the name and page, the glyph as its page. | Same. |
| **Offline** | Sample hero dimmed with the reason (DSN-50) when the sample was never loaded. | Same. |
| **Drag-over** | The intents grid lifts 2 px with the e3 shadow and the dashed edge (today's launcher rule moves to it); the drop line says "Drop to open 2 files". | No drag on phones. |
| **Errors** | Cover read fails: glyph, no message. Cover write fails (quota): skipped, `console.warn` once. Reopen fails: today's toasts. | Same. |

### 2.7 The opening transition

The move makes DSN-64's grow the default (`?open=light` on by default, `?open=0` turns it off) and
finishes it for reopens.

1. **Press** (pointer up, Enter or Space) on Continue, a cover tile, an open card, or the sample
   hero. The handler calls the open action **first and synchronously** (permission prompts and
   file dialogs need the activation), then starts the motion.
2. **Lift** (≤ 1 frame): the pressed tile's cover is cloned (`ghostOf`), laid fixed over it
   (`placeAt`), and the desk's copy fades under it (the veil, as `growInto` does). The clone lifts
   to scale 1.02 on `quick` (MOT-19's slight bounce allowed).
3. **Hold** (new): while the document is not ready (a kept snapshot reopening, a handle being read,
   the engine replaying edits), the clone stays lifted over its tile. After 400 ms the tile's
   busy ring shows under it (today's busy state; announced "Opening report-v2.pdf"). The desk stays
   visible underneath; nothing else is pressable on that tile. The hold ends when the open action
   resolves, or after 15 s (then as a failure).
4. **Seed** (new): before the page view mounts, the cover image the clone shows is registered as
   the arriving page's first placeholder (`pages/placeholder.ts` gains a seed rung above "best
   cached bitmap", keyed by source id and page index, dropped when a real render lands). So the
   reader page arrives showing the same pixels the clone shows: the dissolve is invisible and the
   page is never bare white, cold or warm.
5. **Grow**: once the reader page is laid out, the clone grows into it on `glide` (DSN-64), the
   page dissolves in from 85 % to 97 %, the sharp render cross-fades over the seed
   (`paint-fade.ts`), and on the session's first open the light pulses once (`lightPulse`).
6. **Cancel or fail**: the picker cancelled, permission denied, a reopen failure: the clone settles
   back into its tile on `smooth` and is removed; the view never changed; today's note or toast
   says why.
7. **Back to the desk** (`0`, ◆ Library, Esc ladder unchanged): the page shrinks into the Continue
   card's page when the document is the Continue document, else into its open card
   (`backToLibraryMorph`'s target resolution extended).
8. **Reduced motion**: the root cross-fade (150 ms), no clone, no lift, no pulse (A-9); the seed
   still applies (it is not motion).
9. **"Open again…"** (file dialog): no clone; the dialog covers the moment; the page arrives with
   the DSN-64 ladder (and the seed if the cover matched the picked file).

### 2.8 Keyboard and screen reader

- **Landmarks and headings**: the desk is the existing `section aria-label="Library"`, with a
  visually hidden `h1` "Library" (DSN-13 removed the visible title; a heading for navigation
  stays). `h2`s: "Where you left off", "Ways to start" (visually hidden), "Open" (the head),
  "Recent". The first-visit headline is the `h1` there, as today.
- **First focus** (quiet focus, no ring until a key, as today): Continue's button when it shows,
  else Open files…. After returning with `0`, focus goes to the card of the document just left
  (today), or to Continue when that is the document.
- **Tab order**: Continue → intents group → More ways… → open-documents head and grid → Recent's
  Clear → the shelf → the footnote's Manage.
- **Intents**: one tab stop; Left/Right/Up/Down move inside the 2×2 (roving tabindex, `gridStep`
  with 2 columns); Enter or Space runs. ⌘O stays Open files….
- **Shelf**: a `ul` of tiles with a roving tabindex; arrows move in two dimensions (`gridStep`
  with the live column count), Home/End to the ends, Enter or Space opens, Delete or Backspace
  removes (the toast's Undo as today), Shift+F10 or the context-menu key opens the tile's ⋯
  menu. The ⋯ button is `tabIndex={-1}` (pointer and touch reach it; keys use Shift+F10), so the
  shelf stays one tab stop.
- **Labels**: a tile reads as one sentence, the visible parts `aria-hidden`: "report-v2.pdf, page
  4 of 10, 40 percent read, edited, changes kept, yesterday" ("Needs permission" or "Open again"
  added when they apply). The progress bar inside a tile is `aria-hidden` (its value is in the
  label); Continue keeps its labelled bar. The sample hero: "Try the sample, a small magazine to
  try every tool on".
- **Announcements**: "Opening report-v2.pdf" after 400 ms of hold; today's "Opened …" on arrival;
  "Removed … from Recent"; nothing on the desk's own paint.
- Gates: A-1…A-24 (DSN-21), axe on all three states (first visit, returning, many), targets 44 px
  coarse, the focus ring of DSN-17.

### 2.9 Conversions findable by name

- New commands, registered at launch, **enabled with no document open**:
  - `file.imagesToPdf` "Images to PDF…" (pick images, open them as one new unsaved document, the
    existing image-pages path; PRD-24's board answer governs whether it is announced as a
    conversion, the door itself already exists through Open).
  - `file.pdfToImages` "PDF to images…" (pick one PDF, open it, then `openSaveCopy(id, 'images')`).
  - `file.signPdf` "Sign a PDF…" (pick one PDF, open it, `openMarkupDoor('sign')`; on the phone the
    edit island with Sign armed).
  - Text to PDF…, Markdown to PDF…, Combine files…, Batch…, Scan… already exist.
- Keywords: `file.pdfToImages` takes `document.exportImages`' catalog words ("pdf to jpg, pdf to
  png, pdf to image…"); `file.imagesToPdf` takes `section.insertImages`' ("images to pdf, jpg to
  pdf…"); both languages. With a document open, ⌘K shows both the document command and the file
  command; the document one ranks first (score order unchanged).
- The More ways… menu lists the same commands by the same names, so a person who scans the desk
  for "PDF to JPG" finds "PDF to images…" with "JPG, PNG" in its hint line.
- DSN-46 (one place per command): the desk's intents and More ways… are the Library launcher's
  successors, so Open, Combine, Batch and Scan keep one home (DSN-78's Scan home moves with the
  launcher). Sign a PDF… is a recorded second door to Fill & sign (the dock's Fill & sign stays
  the first), as DSN-68 recorded Save a copy's.

### 2.10 Greeting

Optional per the brief; owner question Q2. Recommendation: none. The Continue card's eyebrow,
"Where you left off", is the greeting.

### 2.11 Copy (EN / TR, DSN-74)

| Key (new unless noted) | English | Turkish |
|---|---|---|
| `continue_title` (fix) | Where you left off | Kaldığınız yer |
| `desk_intents_label` | Ways to start | Başlama yolları |
| `desk_open_hint` | PDFs, images and text | PDF, görsel ve metin |
| `desk_sign` | Sign a PDF… | PDF imzala… |
| `desk_sign_hint` | Fill in fields and sign | Alanları doldurun ve imzalayın |
| `desk_combine_hint` | Several files into one PDF | Birden çok dosyadan tek PDF |
| `desk_scan_hint` | Paper to PDF with the camera | Kamerayla kâğıttan PDF |
| `desk_more` | More ways… | Diğer yollar… |
| `cmd_images_to_pdf` | Images to PDF… | Görsellerden PDF… |
| `cmd_pdf_to_images` | PDF to images… | PDF’ten görsel… |
| `desk_pdf_to_images_hint` | JPG or PNG, one per page | Her sayfa için bir JPG veya PNG |
| `desk_sample_open` | Open the sample | Örneği aç |
| `desk_tile_label` | {name}, page {page} of {total}, {percent} percent read, {time} | {name}, {page}. sayfa / {total}, yüzde {percent} okundu, {time} |
| `desk_tile_label_unread` | {name}, {pages}, {time} | {name}, {pages}, {time} |
| `desk_opening` | Opening {name} | {name} açılıyor |

Existing strings reused: `library_open`, `library_combine_files`, `scan_button`, `cmd_batch`,
`cmd_text_to_pdf`, `cmd_markdown_to_pdf`, `cmd_try_sample`, `library_sample_line`,
`continue_*`, `recents_*`, `session_not_kept`, `library_drop_hint`.

---

## 3. Data: covers and places

### 3.1 The cover store

- **Database** `pdf-editor:covers:v1` (IndexedDB, its own database so Recents' database and its
  version are untouched, and a cover failure can never cost Recents), store `covers`, keyPath
  `key`. Pinned in `shell/about/names.test.ts`.
- **Key**: the Recents identity, `${name}\u0000${size}` (`sameRecentFile`), plus the kind: `first`
  (page 1) or `left` (the page left, only when past page 1). Keying by identity instead of entry id
  means a reopen that replaces an entry keeps its covers with no move step, and a kept row named
  by `recentRowOf` (title-based for combined or split documents) gets its own.
- **Record** `{ key, kind, page, width, height, type: 'image/jpeg', bytes: ArrayBuffer, at }`.
  Bytes as an ArrayBuffer (not a Blob) to stay clear of WebKit's Blob-in-IndexedDB history.
- **Size**: `first` at 2× the large shelf box (304×400 device px max), `left` at 2× the Continue
  box (264×344). JPEG quality 0.8 (`OffscreenCanvas.convertToBlob`, falling back to a canvas'
  `toBlob`): about 10–25 KB each, at most 24 records, under 0.6 MB in all. JPEG on every engine
  (WebKit does not encode WebP).
- **Lifecycle**: at Recents load the store deletes every cover whose identity is in no entry (the
  orphan sweep), so Remove, Clear recents and the 12-entry cap take covers with them without a
  cross-database transaction. `clearKeptChanges` (the privacy popover's and Settings' Clear)
  also clears the store. Memory fallback when IndexedDB is refused, as Recents does.
- **Never stored**: an encrypted source's pages; a document from the sample is stored like any
  other (it is ours).

### 3.2 Capture

- **`first`**: when a document from one file opens (`recordRecent` resolves), and the source is
  not encrypted, render page 1 once at the cover scale through the running engine at
  `RENDER_PRIORITY.offscreen` after the first visible page has rendered (never ahead of it),
  encode, write. Skipped if a `first` cover exists for that identity and `at` is newer than the
  file's `lastModified`.
- **`left`**: when the resume point is captured on leaving the page view or closing a document
  (`resume.ts`'s capture moments), take `BitmapCache.best` for that page synchronously (it is on
  screen, so it is cached), downscale into an OffscreenCanvas, encode off the critical path,
  write. No engine work.
- **Place on the entry**: `RecentEntry` gains `place?: { page, total, zoom, fit, offset, at }`
  (parsed leniently like `DocumentPlace.resume`; a bad one is dropped, the entry kept). Written by
  `attachKept` from the kept record, and debounced (2 s, the writer's rhythm) from the resume
  store for the open document's entry. This is a field of the existing record, not a new key
  (DSN-66's rule holds). It gives the shelf its progress without OPFS reads and lets a plain
  reopen (handle or file dialog) land on the exact place when the file is the same (name + size).
- **Backfill** (people who already have kept rows): on the full edition only, at idle after the
  desk's first paint plus 3 s, one row at a time, rows missing a `first` cover and holding a kept
  snapshot are rendered by today's `recent-thumbs.ts` path and written. Never on the phone (it
  would start PDFium on a phone's Library); phone covers arrive the next time a file is opened.

### 3.3 Continue's source

In order: the open document read last (today); else the newest entry with a `place` past page 1
(was: with a kept snapshot), its page drawn from the `left` cover (was: PDFium render), its press
running `openRecent` then the exact resume (today's 3c path, now without the flag). Pending lines
for a closed document: "Changes kept" when `kept.changed`; signatures and comments only for an
open document (today's limit).

---

## 4. Performance plan: the desk in under 1 s

**Target, defined.** From navigation start to the desk painted with its hero, intents and the
visible covers decoded, on a **cold start with the service worker in control** (a new tab or a
browser launch with storage present: the "repeat visit" row of `perf-2026-10.md`): ≤ 1000 ms on
the desktop profile and on the phone profile (4× CPU). First visits over the network are out of
scope (they are bound by the 4G link; the phone's first visit is 3 s today and is PF-23's
business). Today's repeat visit: Home visible at 481 ms (desktop) and 695 ms (phone), so the
covers have roughly 300–500 ms.

**Rules.**

1. **No engine on the desk's path.** The desk never starts the PDFium worker: covers are images,
   Continue's page is the `left` cover, the sample is `SampleCover`. The open grid's live covers
   (`PageThumb`) only exist when documents are open, i.e. the engine is already running.
2. **Read early, once.** A small `home/desk-prefetch.ts`, imported by `LibraryView`'s module
   (so it runs when the app chunk evaluates, before React renders), starts `loadRecents()` and one
   covers read (`getAll` on the store; at most 24 small records) in parallel. Nothing is added to
   `main.tsx` or the first-paint closure (PRC-20, V1-P1).
3. **Decode off the main thread.** `Blob` → `URL.createObjectURL` → `<img decoding="async"
   width height>` with the box sizes set, so no layout shift; object URLs revoked on unmount.
   The desk marks itself painted after `img.decode()` of the visible covers or 150 ms, whichever
   is first (a slow decode never holds the mark hostage; it then fades in).
4. **No entrance choreography at launch.** The first paint has no transition (02-library L8); the
   Continue card's rise (DSN-66) plays only when it arrives after first paint (a desk revisited in
   the session).
5. **Bundle.** The desk replaces `Launcher`'s actions and `RecentList`'s rows, so most of its code
   is a swap, not an addition. Budgets: the editor closure has a 1 % growth cap (≈ 8 KB gzip over
   its 844 KB baseline), the phone's `compactSession` 1 % (≈ 4 KB). The covers reader and the
   shelf are eager on the full edition (they are the first paint); on the phone the cover rows
   load with `ContinuedLibrary`'s chunk, which loads only when Recents hold an entry (the first
   visit pays nothing). If a lane cannot fit, it stops and reports (PRC-11: gates are not raised;
   only the owner accepts a baseline growth).
6. **Measure.** `performance.mark('recto:desk-painted')` (rule 3). `tools/perf/baseline.ts` gains
   "Desk painted" in the first and repeat visit rows. `e2e/masa.spec.ts` asserts the mark exists
   and is under 2500 ms in CI (noise; shared runners), and that no `.wasm` request happened before
   the first open. The 1 s target is checked on the perf baseline run, recorded in the PR.

---

## 5. Lanes

Four implementer lanes, each one pull request into `develop` (PRC-17, PRC-18 body), Conventional
Commits. Implementers stay inside their files and stop on an unsettled decision (PRC-23). Run
only the tests that cover the change; heavy commands through `tools/dev/heavy.sh`; never vitest
alongside typecheck, lint or build.

**Order**: M1 first (data). M2 and M4 in parallel after M1 merges. M3 after M2 merges (it grows
from M2's tiles); its seed and landing parts may start beside M2 against the tile contract below.

**Tile contract** (M2 provides, M3 and M4 rely on): a shelf tile is `li > button[data-desk-tile]
[data-recent-id]` holding the cover in `[data-library-sheet]`; Continue's page is
`[data-testid="continue-card"] [data-library-sheet]`; the sample hero is
`[data-testid="desk-sample"] [data-library-sheet]`. Cover images are `img[data-cover]` with a
`blob:` URL.

### M1. Covers and places (data)

- **Owns**: `home/covers.ts` (new: store, memory fallback, read hook `useCovers`, orphan sweep,
  `clearCovers`), `home/cover-capture.ts` (new: `first` at open, `left` at leave, backfill),
  `home/desk-prefetch.ts` (new), `files/recents.ts` (the `place` field: parse, write, keep on
  replace), `session/session.ts` (`attachKept` writes `place`; `clearKeptChanges` calls
  `clearCovers`; the debounced place write for the open document's entry), `home/recent-thumbs.ts`
  (backfill writes through), `shell/about/names.test.ts` (pin `pdf-editor:covers:v1` and store
  `covers`), their unit tests.
- **Done when**: opening a file stores its `first` cover; leaving the page view past page 1
  stores `left`; Remove, Clear recents, the cap and the privacy Clear leave no cover behind;
  encrypted sources store none; a private window keeps covers in memory; a bad `place` is dropped
  and the entry kept; `useCovers` returns object URLs from one transaction; no PDFium start from
  any read path.
- **Tests**: `home/covers.test.ts` (fake IndexedDB as `recents.test.ts` does: sweep, clear,
  memory fallback, encrypted skip), `files/recents.test.ts` (place parse, keep across
  `addRecentEntry`), `session/session-*.test.ts` touch only where `attachKept` changes, a browser
  vitest for encode size and type (`OffscreenCanvas`), `names.test.ts`.
- **Depends on**: nothing.

### M2. The desk (full edition)

- **Owns**: `home/LibraryView.tsx` and `.module.css` (the desk's structure), `home/Desk*.tsx`
  (new: `DeskHero`, `Intents`, `MoreWays`), `home/RecentShelf.tsx` and `.module.css` (new,
  replaces `RecentList.tsx`'s rows; the head, Clear, notes and footnote move over unchanged),
  `home/Launcher.tsx` (removed or reduced to the first-visit identity), `home/SampleCard.tsx`
  (hero and tile forms), `home/ContinueView.tsx`, `ContinueDesk.tsx`, `ContinueCard.module.css`
  (larger page, kept fallback from `place` and the `left` cover, no PDFium), `home/home-flags.ts`
  (`home=continue` and `open=light` default on; `?home=0`, `?open=0` turn them off), `labs/flags.ts`
  (both to status "default"), `commands/app-commands.ts` (`file.signPdf`, `file.imagesToPdf`,
  `file.pdfToImages`, enabled without a document), `messages/en.json`, `tr.json` (§2.11), tests.
- **Done when**: §2.2–§2.4, §2.6, §2.8–§2.11 hold at 1440×900, 1180×820 touch and 820×1180;
  first focus and the one-primary rule hold in both states; the shelf is one tab stop with 2D
  arrows; ⌘K "pdf to jpg" and "images to pdf" find a command with nothing open; screenshots at
  the three sizes in the PR.
- **Tests**: `home/LibraryView.test.tsx` (first visit, returning, nothing to continue, loading
  fallback at 300 ms, one primary, focus), `home/RecentShelf.test.tsx` (badges for kept, prompt,
  unavailable; keys; labels), `commands/*` for the three commands' `when`, `keywords.test.ts`;
  e2e `library.spec.ts` updated (launcher testids move to the intents), axe in `a11y.spec.ts`
  for the three states.
- **Depends on**: M1 (`useCovers`, `place`). Owner answers Q2 and Q4 (defaults applied if not
  yet answered: no greeting; Scan only while its flag is on).

### M3. Opening, exact resume and the paint budget

- **Owns**: `home/library-transition.ts` (lift, hold, settle-back, the target resolution for
  back), `home/open-light.ts`, `pages/placeholder.ts` (the seed rung), `home/home-actions.ts`
  (`openRecent` and friends call the motion wrapper; the plain-reopen exact resume from `place`),
  `session/session.ts` launch landing **only if the owner picks Q1 B** (coordinate with M1, which
  must have merged), `tools/perf/baseline.ts` (the "Desk painted" row), e2e
  `e2e/masa.spec.ts` (new) and `e2e/open-light.spec.ts` (default-on update).
- **Done when**: every open from the desk grows from its tile (Continue, cover, open card, sample
  hero) with no near-white frame; a reopen holds, then grows; a cancel settles back; reduced
  motion cross-fades; `masa.spec.ts` passes on Chromium, Firefox and WebKit:
  1. **Continue after close**: open the sample, zoom in, sit 90 px into page 4, close the
     document; the desk's Continue shows page 4 from a `blob:` cover; Continue lands on page 4 at
     the same zoom, offset within ±2 px.
  2. **Continue after a cold start**: as 1, then close the page, open a new page in the same
     context (the tab lock is released, so the launch restores or keeps the session); per Q1,
     either the document is at the exact place (A) or the desk shows with Continue focused and
     Enter lands there (B), ±2 px.
  3. **Covers from cache**: after the cold start every visible cover is a `blob:` image and no
     `.wasm` was requested before the first open.
  4. **Never white**: sampling the reader page during the grow of a reopen finds no frame whose
     page area is the bare paper colour across more than 90 % (the `open-light.spec.ts` sampler).
  5. **Paint**: `recto:desk-painted` exists and is under 2500 ms (CI); the 1 s result from the perf
     baseline run is in the PR body.
- **Tests**: unit for the hold/settle state machine and the seed rung (`placeholder.test.ts`);
  the e2e above; `open-light.spec.ts`.
- **Depends on**: M2 (tiles), M1 (covers for the seed); Q1 for the landing part only.

### M4. The phone desk

- **Owns**: `shell/compact/CompactLibrary.tsx`, `.module.css`, `.test.tsx`,
  `shell/compact/ContinuedLibrary.tsx` (loads when Recents hold an entry, not only behind the
  flag; adds the kept fallback from `place` and the `left` cover), `shell/compact/compact-actions.ts`
  (Sign a PDF…: pick, open, edit island with Sign armed), `messages/*` keys prefixed
  `compact_desk_` only, e2e `compact.spec.ts` (Library parts).
- **Done when**: §2.5 holds at 390×844 and on its side; the first visit is pixel-identical to
  today (`compact.spec.ts` screenshot or element checks); the returning phone shows Continue for
  a closed kept document; the 12-row swipe of DSN-33 still reaches the last row; `tools/qa/
  bundle-budget.ts` passes (`compact` gate and the `compactSession` cap) without a baseline change.
- **Tests**: `CompactLibrary.test.tsx` (first visit unchanged, returning order, header fold, Sign
  intent, Scan hidden without phone scan), e2e `compact.spec.ts` on `phone` and `phone-land`.
- **Depends on**: M1. Owner answer Q3 (default applied if not answered: cover rows).

### Records each lane adds

M2 adds the DSN-87 row and index line (§8) in its PR; M3 amends it with the landing choice when
Q1 is answered; each lane updates `docs/process/agent-metrics.md` with its row. DSN-66 and DSN-64
get "flag lifted by DSN-87" in their status cells; DSN-50's "three tiers" and DSN-78's "Scan in
the launcher" are amended by DSN-87 (the launcher's role moves to the desk's intents).

---

## 6. Owner questions (taste)

**Q1. Where does a launch land when there was a document open?**
- A. In the document, as today (the session restores `destination`). The desk is seen when you go
  to the Library or close everything.
- B. **On the desk** for a new launch (a new tab or browser start); the documents are restored
  behind it as open cards, Continue has first focus, one Enter or tap lands on the exact place. A
  reload of the same tab still restores into the document (it keeps its tab id).
- C. On the desk, and the last session's documents go to Recent instead of reopening.
- *Recommendation: B.* It makes the desk the first ten seconds the move asks for, at the price of
  one press for a returning reader, and keeps reload behaving as people expect.

**Q2. A greeting line above the desk?**
- A. **None**; "Where you left off" is the greeting.
- B. A time-of-day line ("Good evening.") in the identity's place.
- C. A quiet fact line ("3 documents on this device").
- *Recommendation: A.* Calm and plain; B is a common pattern but adds a line that says nothing new.

**Q3. Phone Recent as covers: which form?**
- A. **Rows with a 44×58 cover** and the bar under the meta line (today's rows, with pictures).
- B. A two-column grid of covers.
- C. A horizontal shelf of covers under Continue.
- *Recommendation: A.* Twelve files stay scannable in one thumb scroll; B doubles the page length,
  C hides most files sideways.

**Q4. Scan on the desk.**
- A. **The Scan tile ships with the desk and scan's flag lifts at the same switch** on desktop and
  tablet, shown only where the browser reports a camera (`enumerateDevices` lists a
  `videoinput`), on the condition that `scan.spec.ts` is green on all three engines.
- B. The tile shows only while `?scan=1` or Labs has it on, until the scan sheet's own taste
  review; three intents meanwhile.
- C. No Scan tile; Scan stays in More ways… and ⌘K.
- *Recommendation: A.* The approved move names Scan as an intent; the camera check keeps a
  dead tile off desktops without one. If the scan sheet's taste is not settled yet, B is the safe
  default the lanes apply.

---

## 7. Risks and cuts

**Risks**

1. **Q1 left open or answered A.** The desk then rarely shows on a launch, and the "first ten
   seconds" claim is only true for first visits and people who left from the Library. Biggest
   product risk; it is one owner sentence.
2. **Budgets.** The editor closure and `compactSession` have 1 % growth caps. The desk is mostly
   a swap, but the motion hold, three commands and the covers module are additions. Mitigation:
   phone code lazy behind "Recents hold an entry"; the lanes measure early and stop rather than
   raise a gate.
3. **Cover privacy.** Covers are pictures of documents kept on the device. They follow Recents'
   lifecycle, the privacy Clear and retention, and never exist for encrypted files; still, they
   are new stored content and the PR must say so. Snapshots already keep the full bytes, so the
   exposure does not grow in kind.
4. **The hold on slow reopens.** A large kept document can take seconds to replay; a lifted card
   that hangs reads as frozen. The 400 ms busy ring and the "Opening…" announcement carry it; a 15 s
   cap fails it visibly.
5. **IndexedDB on WebKit and Firefox private windows.** Behaviour differs by version; the memory
   fallback must be exercised by unit tests, not trusted.
6. **Test churn.** `library.spec.ts`, `a11y.spec.ts` and the visual snapshots key on the launcher's
   testids; M2 keeps `library-open`, `library-combine-files`, `library-batch`, `library-scan` on the
   intents to limit churn.
7. **Scale of `left` capture.** `BitmapCache.best` may hold only a tile-sized or quarter-scale
   bitmap at leave time on a zoomed page; the cover is then soft. Acceptable (it is 132 px wide);
   if visibly poor, M1 renders the page once at cover scale through the still-running engine.

**Cuts (not in this move)**

- Recents search and sort stay behind `?home=search`.
- No cloud, no cross-device recents (PRD-8, PRD-12).
- No more than 12 recents; no "show all" page.
- No covers for files never opened in this browser; no folder watching.
- The horizontal offset is still not kept (DSN-66's limit).
- Phone Scan and phone Combine wait for their own lanes (EDN-22, MOB-10).
- The open-documents grid, Select mode and its bar are not redesigned.
- Greeting variants beyond Q2's answer.

---

## 8. Decision record

**Index line** (`docs/process/decisions.md`, Design table):

```
| [DSN-87](decisions/design.md) | Masa: Home becomes a desk (Continue, intents, Recent as cached covers); Continue and the open grow lose their flags | In force; Q1–Q4 open to the owner | 2026-10-31 |
```

**Full row** (`docs/process/decisions/design.md`):

```
| DSN-87 | **Masa: the Library becomes a desk, the first ten seconds of the product.** Top to bottom on desktop and tablet: a hero slot (the Continue card of DSN-66, its page 132×172, or on a first visit the sample as a large card with "Open the sample", same size, so the desk does not re-flow when the first document arrives), beside it four intent tiles in a 2×2 group (Open files…, Sign a PDF…, Combine files…, Scan… where scan is on) and a "More ways…" menu (Batch…, Images to PDF…, PDF to images…, Text to PDF…, Markdown to PDF…, Office to PDF… where on), the drop line, then the open documents' grid as today, then Recent as a shelf of covers (at most 12, the page left past page 1, a 3 px neutral progress bar, a badge for what a press needs: changes kept, permission, the file dialog), the sample as its last tile while not on screen. Medium widths stack the hero over one row of four intents. The phone keeps its first visit (DSN-31, DSN-50) and, for a returning person, folds the identity into a header row and puts Continue, Sign a PDF… (Scan… once the phone has it), Recent rows with 44×58 covers, the sample, then the tool chips; Open PDF stays in the dock. One primary per view: Continue when it shows, else Open files…. *Technique:* covers are JPEG images (2× their box, about 10–25 KB) in their own IndexedDB database `pdf-editor:covers:v1`, keyed by the Recents identity (name and size) and kind (`first`, `left`); `first` is rendered once by the running engine after a document's first visible page, `left` is taken from the bitmap cache when the reader is left; covers whose identity left Recents are swept at load, the privacy Clear clears them, encrypted sources never get one, a refused database keeps them in memory. A Recents entry gains an optional `place` (page, total, zoom, fit, offset), so progress needs no OPFS read and a plain reopen of the same file lands on its place. The desk never starts the engine; it reads Recents and covers once when the app chunk evaluates and marks `recto:desk-painted`; target ≤ 1 s from navigation on a cold start with the service worker in control (perf baseline, desktop and phone profiles). `?home=continue` and `?open=light` become defaults (`?home=0`, `?open=0` turn them off). Opening from the desk lifts the tile's cover, holds it while a reopen runs, seeds the arriving page with the same image (a new first rung of DSN-64's ladder), then grows on `glide`; a cancel settles it back; reduced motion cross-fades. Three file commands work with nothing open and carry the conversion names people search for: `file.signPdf`, `file.imagesToPdf`, `file.pdfToImages`. DSN-46: the intents succeed the launcher as the one home of Open, Combine, Batch and Scan (DSN-78's Scan home moves with it); Sign a PDF… is a recorded second door to Fill & sign. Amends DSN-50 (tiers) and DSN-78 (Scan's place); lifts the flags of DSN-64 and DSN-66. Open to the owner: Q1 where a launch lands (lead recommends the desk with Continue focused for a new launch, the document for a reload), Q2 greeting (none), Q3 the phone's Recent form (cover rows), Q4 Scan's tile (ships where a camera exists, with scan's flag). | 2026-10-31 | Owner (Masa move approved); lead spec `vision/specs/masa.md` | In force; Q1–Q4 open to the owner |
```
