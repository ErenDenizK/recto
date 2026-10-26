---
title: "Proposal B: no modes, a pen-first studio"
date: 2026-10-04
status: proposal
---

> Interaction-model proposal for the M9 redesign (flows and IA judge panel), from the
> repository only: baseline frames, `inventory.md`, `current-flows.md`, research 15–22,
> ADR-0019 and ADR-0021, DESIGN.md §4 and the state code. No web search. Judgement, not
> evidence, is marked *(judgement)*. RA-, G-, AU-, MO-, MC-, MP-, M-, I-, C-, X- and A- ids
> cite research 15–22; F-, INV- and FL-R ids cite the baseline documents.

# Proposal B: no modes, a pen-first studio

## 0. Summary

- **No Read, Edit or Markup state.** A document is one surface with a floating **palette**
  (collapsible to a chip) whose idle tool, the **Pointer**, can never mark the page. Only an
  armed tool or a pen on a touchscreen creates: the Notability and Procreate family
  (research 15 §2.4, §2.11), tuned for PDFs from other people.
- **Protection moves from a mode to a hit model.** Five layers replace the Read lock: the
  Pointer creates nothing; page text and images change only through an Edit tool; new files
  open with the Pointer; mouse and finger taps leave no ink; and an optional per-document
  **Lock**, with a setting "Open files locked" that restores M8's behaviour (§3.2).
- **Zoom is navigation.** Pinching out past the whole page flows into the **Pages grid**
  (today's Arrange) and pinching in flows back (M-21, MC-9); Mod+wheel, Mod+-, G and a
  page-pill button do the same. Rearranging pages is never a view switch.
- **Gestures are first-class and never the only way.** Two-finger tap undoes, three-finger
  tap redoes, a pen writes, a finger scrolls, a long press selects (research 19 §6), and
  every gesture has a button and a key (WCAG 2.5.1, A-15).
- **The Library is a home.** One mobile-first place for open and recent documents with their
  last state (kept on the device in OPFS, M-34), Combine, Compare and Batch. Recents reopen
  with yesterday's annotations in one tap on every browser, phones included.
- **Steps fall by about a quarter.** Over the 19 job rows of `current-flows.md` §20 the mouse
  total drops from 91 to 66 steps, touch from 99 (with one job impossible) to 72 (none
  impossible), and keyboard-only from 122 (with two jobs impossible) to 94 for all 18
  keyboard-possible rows (§7.2). Saving drops from +3 or +4 to +1 or +2.
- **Desktop keeps everything:** a key per tool, a vertical palette in the margin,
  right-click page actions, no gesture needed (§3.6).
- **Main cost:** the safety of "a file opens untouchable" becomes opt-in, and a pen on a
  tablet writes by default. Both are owner questions (§10.4). Code impact is moderate: the
  per-document mode (66 references in 19 files) becomes a lock flag, the tool bar's group
  layer goes, and Arrange becomes a zoom level of the stage (§9).

## 1. The model

### 1.1 In one paragraph

You open a PDF and it is simply there, full width, with a small glass palette at the edge
and a page pill at the bottom. You scroll, select text, click links and fill fields;
nothing you click can draw on the page or change its text. Pick a pen, or touch the screen
with a stylus, and you write; select a sentence and press Highlight or Comment and you mark
it; pick Edit text and click a paragraph to change its words. Pinch out (or press G) and the
page shrinks into a grid of every page, where you drag, rotate, delete and split; pinch in
and you are reading again. Undo is always at the top and a two-finger tap away. The title
opens everything about the whole document: Save, Save a copy, page numbers, passwords, OCR.
Close the tab and nothing is lost: the Library shows the document where you left it.

### 1.2 Principles

| Id | Principle | What it rules out |
|---|---|---|
| P-1 | **One surface, no modes.** A document is always ready for every job; the only states are the armed tool and the zoom level, both visible. | A Read · Edit · Arrange switch; "Switch to Edit" notices (INV-2) |
| P-2 | **Only intent creates.** The idle Pointer cannot create anything. A change needs an armed tool, a direct pen, a command on an explicit selection, a form widget, or a drag past the threshold. Page text and images change only through an Edit tool. | Plain clicks, double-clicks, hovers, scrolls or long presses that change the file |
| P-3 | **Each input has one job.** A direct pen writes, a finger navigates, a mouse points, keys arm and act (research 19 §7, tldraw's direct-display rule). | A stylus that selects text (INV-8); a finger that both draws and scrolls |
| P-4 | **Zoom is navigation.** Page and grid are one continuous space; the grid is the page zoomed out. | Arrange as a peer view; Pages thumbnails repeating it (F-6, F-15) |
| P-5 | **Every page tool within two presses, options on arming.** One press shows a tool (palette slot or drawer), one arms it, and its tray opens with it (FL-R2, INV-R5). | Group → tool → press again (F-3, INV-5) |
| P-6 | **Nothing is lost, everything is undoable.** Session snapshot on the device, visible Undo on every width, a named toast for every removal and failure, Save in place where allowed (FL-R3, FL-R4). | Silent loss on reload (INV-7); spoken-only feedback (INV-6) |
| P-7 | **The Library is a home, not a file dialog.** It is the first screen, the switcher on phones and the place for jobs across files. | A drop target that says nothing of the product (F-14) |

## 2. Information architecture

### 2.1 Places

| Place | What it is | Replaces |
|---|---|---|
| **Library** | Launcher card (Open PDFs, Combine, Compare, Batch, the "On this device" privacy chip), **Open** shelf (this session's documents, unsaved dot), **Recent** shelf (closed documents with their kept state), search over names, Settings | Home (4.1–4.5), the Files tab (5.13), the empty state (4.3) |
| **Document** | The page column with the palette, page pill and top bar; two zoom **levels**: *page* and *grid* | Read, Edit, Arrange (3.10, 7.1, 10.x) |
| **Compare** | Two documents side by side or overlaid, with its bar and the Changes list | Compare view (11.x), unchanged in substance |
| **Settings** | A sheet (M5) from the Library or ⋯: Appearance, Pen and touch, Opening and saving, Language, Signatures, OCR languages, Privacy and storage, Shortcuts, About | Appearance submenu, palette-only language, OCR's language manager, author prompt (INV-20) |

Overlays that are not places: the Document menu (title), the side panel (Pages, Contents,
Find, Review), sheets for long jobs (Save a copy, page furniture, OCR, redaction), the
command palette, the shortcut overlay.

### 2.2 Moving between places

```
              ┌── Library ────────────────────────────────────────────────┐
              │ Open shelf · Recent shelf · Combine · Compare · Batch · ⚙ │
              └─────┬────────────────────┬─────────────────────┬──────────┘
 card, tab or       │  Combine:          │  Compare:           │
 Recent row         │  new doc, grid     │  2 selected         │
                    ▼                    ▼                     ▼
‹ N · 0 · glyph ◀── Document: page level ⇄ grid level ── Compare with… ──▶ Compare
                    pinch out/in · Mod+wheel past fit · G · ▦     Esc returns ◀─┘
```

| From → to | Pointer | Touch | Keys |
|---|---|---|---|
| Library → document | Click a card or Recent row (one click, not a double-click) | Tap | Arrows, Enter |
| Document → Library | App glyph or "Library" at the top leading edge | "‹ 3" (count of open documents) | 0 |
| Document ⇄ another document | Tab | Library, or swipe on the title (no edge swipes, M-22) | Mod+1…9, Ctrl+Tab |
| Page ⇄ grid | ▦ in the page pill; Mod+wheel past fit page (with a detent, §3.4) | Pinch out past fit; pinch in on a cell or tap it | G; Mod+- at fit page; Esc or Enter back |
| Document → Compare | Document menu → Compare with…; Library selection → Compare | Same | Mod+K "compare" |
| Compare → back | Close in its bar | Close | Esc |

### 2.3 Tabs and the document switcher

- **Expanded and up (≥ 840 px): tabs** in the top strip, reorderable by drag (fixes INV-19),
  each with an unsaved dot and a lock glyph when locked. The **active tab's name is the
  Document menu**: clicking it opens the menu (RA-9); middle-click closes; a drag of page
  thumbnails onto a tab moves the pages into that document after a 500 ms hover (RA-7).
- **Medium (600–839 px):** tabs when two or more documents are open, else the title.
- **Compact (< 600 px): the Library is the switcher.** The top bar's leading "‹ 3" opens it;
  a horizontal swipe on the title (not the screen edge) moves to the previous or next open
  document *(judgement; research 19 §12 leaves this open)*.
- One document is one tab. Combine always makes a new tab; "Insert pages from file…" in the
  Document menu grows the current one. Two names, two outcomes (fixes INV-12, FL-R8).

### 2.4 State model

Today (`state/ui-store.ts`): `destination: 'home' | 'document'`, `viewMode: 'read' |
'arrange' | 'compare'` (85 references in 37 files), per-document `documentMode: 'read' |
'edit'` (66 references in 19 files) and the guard `canEdit(id)` (72 references in 24 files),
which is true only in Edit. The tool store adds `barGroup` and `lastGroup`.

```ts
type Place = 'library' | 'document' | 'compare';            // replaces destination + viewMode
type Level = 'page' | 'grid';                                // replaces viewMode 'read' | 'arrange'
interface UiState {
  place: Place;
  level: Readonly<Record<DocumentId, Level>>;                // per document, session (+ snapshot)
  locked: Readonly<Record<DocumentId, LockReason | null>>;   // replaces documentMode
  palette: { dock: 'leading' | 'trailing' | 'bottom'; collapsed: boolean; labels: boolean };
  sidePanel: { open: boolean; tab: 'pages' | 'contents' | 'find' | 'review' };
  // zoom, fitMode, gridSize (replaces arrangeSize), paletteOpen (commands) … as today
}
type LockReason = 'user' | 'opened-locked' | 'signed';
// Same name, new meaning: true unless the document is locked. Still fails closed.
function canEdit(id: DocumentId | null, s = useUiStore.getState()): boolean {
  return id != null && s.locked[id] == null;
}
// tool-store: `mode` becomes per document ({ [id]: ToolMode }), a newly opened file gets
// 'select' (shown as "Pointer"); `trayOpen` replaces `optionsOpen`; `barGroup`/`lastGroup` go.
// edit-policy-store: `penDrawsInEdit` → `penWritesWhenIdle: 'auto' | boolean` ('auto' turns on
// only for a direct-display pen, M-24); new `fingerDraws: 'auto' | boolean` (M-25) and
// `twoFingerUndo: boolean`.
```

Callers of `canEdit` keep their call; readers of `documentMode` mostly asked "may a tool
arm", which becomes "not locked". `viewMode` reads map to `level` and `place`.

## 3. The mode question

### 3.1 What happens to Read, Edit and Arrange

- **Read** dissolves into the default state: Pointer armed, palette present. Everything Read
  allowed still works with no change of state. What Read prevented is now prevented by the
  hit model (§3.2); the full lock survives as **Lock** (per document) and **Open files
  locked** (a setting, off by default).
- **Edit** has no state left to enter. Its five groups become the palette's slots (§4.1);
  its interaction table (DESIGN §4.8) survives almost whole, with one change: in the idle
  Pointer a double-click on page text selects a word and does not open the paragraph editor
  (owner question 3).
- **Arrange** becomes the grid level of the document (P-4). Its grid, keyboard model,
  contextual actions and multi-document sections stay; the palette morphs into page tools
  there (§4.1).
- Keys `1`–`4` stop switching views (`1`–`3` now pick the pen presets); `0` stays Library.

### 3.2 The protection model

| Layer | Rule | Answers |
|---|---|---|
| L1 The Pointer cannot create | With the Pointer, a press on the page selects text, selects an annotation, follows a link (asks first for external ones), operates a form widget, or clears the selection. No stroke, shape, note or text edit can start from it, with any input except a direct pen (L3). | Stray click |
| L2 Content edits need an Edit tool | Page text changes only through Edit text (E); page images only through Edit image (I). Both are explicit, labelled and shown armed (lime slot, I-beam or move cursor, a chip "Editing text · Esc"). A double-click in the Pointer selects a word and shows the selection bar, which offers **Edit text**. The pen never hit-tests text while it writes (ADR-0019 §5 kept). | Double-click on text; pen on text |
| L3 A direct pen writes, other pointers do not | A pen on a touchscreen (`pointerType 'pen'`, `maxTouchPoints > 0`) writes with the last pen preset whenever the Pointer is idle ("Pen writes when idle", auto-on at the first such pen, M-24). Mouse, trackpad and desktop graphics tablets never write without an armed tool. A pen held still for 500 ms at touch-down selects (text or object) instead of writing; hold-to-straighten still applies once a stroke has moved (DESIGN §4.1) *(judgement)*. | Pen meant to scroll; Wacom users |
| L4 Fresh files open safe; taps leave no ink | Every newly opened file starts with the Pointer, whatever tool was armed elsewhere. With a drawing tool armed, a mouse click or a finger tap that moves under 2 px in under 200 ms leaves no ink (a pen tap still dots an i). Shapes need a 4 px drag. | A forgotten armed pen |
| L5 Lock | Document menu → Lock (and the lock glyph on its tab) blocks every change; the palette collapses to a lock chip; a write attempt shows a toast "report.pdf is locked · Unlock" (MC-22's pop on the chip, never a shake). Locks automatically when the setting **Open files locked** is on, and for files with a digital signature, where any change breaks it (owner question 1; RA-4). | Owner's M8 ask; signed files |

Visible undo backs every layer (named toasts, RA-11; ↶ ↷ always shown; two-finger tap).
`canEdit` checks L5 at every mutation site; L1–L4 live in `viewer/hit-order.ts`
(`liveHitKinds` per tool and pointer type) and `annotations/pen/ink-input.ts`.

### 3.3 Input rules

| Input | Pointer idle | Drawing tool armed (pens, Highlighter, Eraser, Lasso, Shapes) | Placing tool (Text box, Note, Image, Stamp, Sign, Field) | Edit text / Edit image |
|---|---|---|---|---|
| Mouse, trackpad | Click: select annotation, field, link; drag on an annotation: move it past 4 px; drag elsewhere: select text; double-click: select word; right-click: context menu | Draws; click without movement does nothing (L4) | Click places at the point, drag sizes; one-shot tools return to the Pointer | Click opens the editor at the point (E) or selects the image (I) |
| Direct pen | Writes with the last pen (L3); hold 500 ms still: select; barrel button: lasso; eraser end: erase | Draws; tap dots | Places | Acts as a pointer, never writes |
| Finger | One finger scrolls (native momentum); tap: select annotation or widget, toggle chrome on empty paper; long press 450 ms: select word or annotation, page action sheet | Before a pen is seen: one finger draws, two pan and zoom; after: fingers navigate ("Draw with finger", M-25) | Tap places | Tap opens the editor until a pen is seen, then long press (today's rule) |
| Keyboard | Letters arm tools; Enter on a focused page starts keyboard text selection (FL-R9) | Drawing needs a pointer by nature | Enter places at the focused page's centre; arrows nudge (FL-R9) | Tab between paragraphs, Enter opens, Esc returns (today) |

### 3.4 Gesture map

Thresholds from research 19 §6: long press 450 ms with 10 px slop; double tap 300 ms and
24 px; multi-finger taps need every finger down within 150 ms, all up within 300 ms, each
moving under 12 px, and no pen contact in the last 500 ms.

| Gesture | Page level | Grid level | Library | Button and key equivalent |
|---|---|---|---|---|
| One-finger drag | Scroll (momentum) or draw (finger drawing on, tool armed) | Scroll; after a long press, drag pages | Scroll | Wheel, PageDown, Space |
| Pinch | Zoom around the midpoint; release > 15 % below fit page → grid at this page; within ±4 % of fit width → snaps (M-21, research 19 §7.3) | Change columns 2–5 (phone) or cell size; pinch out on a cell → that page | — | Mod+wheel, Mod+= / Mod+-, G, ▦ in the page pill |
| Double tap | Fit width ⇄ 250 % around the tap (M-19) | Open the page | Open | Mod+0, Mod+= |
| Long press | Word → selection bar; annotation → its bar; paper → page action sheet | Lift the page (scale 1.04), drag to move; release still → page sheet | Select the card (numbered badge) | Right-click, Shift+F10 |
| **Two-finger tap** | **Undo**, toast names the step and offers Redo | Undo | — | ↶ in the top bar, Mod+Z |
| **Three-finger tap** | **Redo** | Redo | — | ↷, Mod+Shift+Z |
| Two-finger tap and hold | Undo again every 250 ms until lifted (Procreate) *(judgement on the rate)* | Same | — | Long press on ↶ opens the History scrubber |
| Four-finger tap | **Focus**: hide everything but the palette chip; again to restore (Notability's Focus Mode, RA-12) | Same | — | F |
| Swipe down on the palette | Collapse to the chip | — | — | Mod+. |
| Pen down | Write (idle) or armed tool | Drag pages directly | Acts as mouse | — |
| Pen hover | Ink dot preview of colour and width (M-27) | — | — | — |

Nothing starts within 24 px of the side edges, 34 px of the bottom or 44 px of the top on
iPad (M-22). Mod+wheel stops at fit page; only a notch after a 300 ms pause enters the
grid, so zooming out to see a whole page never overshoots *(judgement)*.

### 3.5 Stress test: accidental marks

| # | Situation | Input | What happens in B | Safety net |
|---|---|---|---|---|
| 1 | Reader clicks around a contract to dismiss a popover | Mouse, Pointer | Clears the selection; nothing changes (L1) | — |
| 2 | Double-click on a word to copy it | Mouse | Word selected; the bar offers Copy … Edit text in its fixed order | Editor never opens by itself (L2) |
| 3 | Pen pointed at a sentence to select it, on an iPad | Direct pen | Writes a stroke (L3) | Two-finger tap undo; hold-still selects; setting "Pen writes when idle: off" |
| 4 | Pen rests on the screen while the hand scrolls with a finger | Pen + finger | Finger scrolls (pen seen), palm touches > 40 px ignored | Undo |
| 5 | Left a pen armed in document A, opens a new file B | Mouse | B opens with the Pointer (L4) | — |
| 6 | Pen armed, user clicks the page to "focus" it | Mouse | No ink: click under 2 px and 200 ms (L4) | — |
| 7 | Pen armed, finger scroll on a phone | Finger, no pen seen | Draws (finger drawing on) | Two fingers scroll; toast after a stroke shorter than 40 px that ends at the screen bottom: "Scroll with two fingers · Settings" (once) *(judgement)* |
| 8 | Click on a checkbox while reading | Mouse | Toggles (targeted act, as in Preview) | Undo (↶, Mod+Z, two-finger tap); Lock |
| 9 | Drag on a note icon while selecting text | Mouse | Moves the note after 4 px | Toast "Moved note · Undo" for moves over 24 px *(judgement)* |
| 10 | Drag on a note icon | Finger | Scrolls; a note moves only after it is selected | — |
| 11 | Two fingers pinching, lifted quickly | Fingers | Zoom, not undo: the fingers moved > 12 px | — |
| 12 | Typing "hello" thinking a field was focused | Keys | Arms H (Highlighter), then L, then O… nothing touches the page; the palette shows the last armed tool and an announcement says it | Esc |
| 13 | Delete pressed with an annotation selected | Keys | Deletes it | Toast "Deleted ink · Undo" |
| 14 | Long press on page text on a phone | Finger | Selects a word | — |
| 15 | Drag in the grid that was meant as a scroll | Finger | Scrolls: a page lifts only after 450 ms | Undo |
| 16 | Signed file, user starts writing | Any | Locked by default (L5): chip pops, "Changes would invalidate the signature · Unlock" | — |

Residual risks: rows 3, 7 and 8 change the document. Row 3 is the price of pen-first (the
HIG asks for it: "make a mark the moment Apple Pencil touches the screen", research 15
§2.2); rows 7 and 8 match Notability and Preview. All three are one undo away and visible.

### 3.6 Stress test: a mouse-and-keyboard day

A lawyer on a 1440 × 900 laptop, no touch, no pen: Mod+O opens `lease.pdf` at fit width
with the Pointer armed, the palette in the left margin and no panel (Mod+B shows
thumbnails; a setting keeps them). Wheel scrolls, Space pans, Mod+wheel zooms, Mod+F finds.
She drags across a clause, presses C, types, Enter (4 steps); double-clicks "2024", presses
E, types 2025, Esc (4); presses G, drags page 9 before page 3, Shift+R on another, Esc;
Mod+S writes back to `lease.pdf` in Chromium (one confirmation per file). Nothing needs a
gesture, a mode or a hover-only control. She loses the always-open thumbnails and status
bar (now on demand and in the page pill) and the Read lock as a default (now a setting);
Mod+. collapses the palette to a chip and F hides all chrome.

## 4. Tool access

### 4.1 The palette

One glass object (M2, G-1), three docks: **leading edge, vertical** (default on medium and
up), **trailing edge, vertical** (left-handed writers, compact-height), **bottom, horizontal**
(default on compact). A drag on its grip throws it to the dock nearest the projected
release point (RA-2; `--spring-fling`). Its dock and collapsed state are kept per device and
per size class.

Slots, in order (fine pointer: 40 px slots, 36 px ink cells; coarse: 44 px):

| # | Slot | Key | Contents |
|---|---|---|---|
| 1 | **Pointer** | V | The idle tool. Pressed while armed: collapses the palette to its chip |
| 2–4 | **Pen 1, 2, 3** (ink dots: black 1.5 pt, blue 1.5 pt, red 2 pt) | P, 1, 2, 3 | P arms the last pen; P again moves to the next pen |
| 5 | **Highlighter** (tint capsule) | H | Snaps to text (ADR-0021); H over a selection highlights it |
| 6 | Eraser | Shift+E | Whole stroke or Partial, four sizes |
| 7 | Lasso | Q | Takes every kind (ADR-0021) |
| 8 | Shapes (last shape's icon, corner mark) | R, O, L, A | Flyout: Rectangle, Ellipse, Line, Arrow |
| 9 | Text box | T | — |
| 10 | **Sign** | S | Saved signatures, New signature…, With a certificate… (RA-5) |
| 11 | **Edit** (I-beam over lines) | E, I | Flyout: Edit text (E), Edit image (I) |
| 12 | Redact | X | Marks text or areas; X over a selection marks it |
| 13 | **Add** (+) | N, Shift+I | Note (N), Image… (Shift+I), Stamp ▸ (Draft, Approved, Confidential, from image…), Form field ▸ (arms the field designer) |
| — | Grip and collapse | Mod+. | Drag to dock; ⌄ collapses to the chip |

Height on a fine pointer: 568 px with padding, so it fits a 1366 × 768 laptop's stage
(724 px). On compact the horizontal capsule shows 8 slots, 352 px plus 8 px padding in a
366 px capsule at 390 px wide: **Pointer, the three pens, Highlighter, Eraser, one pinned
slot (Sign by default, since signing forms is a common phone job; long press any drawer tool
→ "Pin to tool bar") and More**. More opens the **tool drawer** above the capsule: a
labelled 4 × 3 grid of the remaining tools, Lasso first. The app never changes the pinned
slot itself, so the capsule stays predictable.

**Pending redactions.** While a document has marks that are not applied, a small M2 bar
sits above the palette: "2 marks · Mark area · Apply". It arms the Redact tool from a text
selection's Redact in one press and keeps unapplied marks from being forgotten
(`current-flows.md` J10).

**The chip** (collapsed palette, M1, 44–48 px round) shows the armed tool: an arrow for the
Pointer, the ink colour for a pen, a lock when locked. Tap or click expands; it never hides
while focus is inside it (A-13).

**At the grid level the palette morphs into page tools** (MC-11's `clip-path` morph):
Select (checkmarks), Rotate left, Rotate right, Delete, Duplicate, Extract to new document,
Insert ▸ (Blank page, Pages from file…, Images…), Split…, Move to ▸ (other open document),
Crop…, Resize…. Unavailable actions dim with a reason (RA-21). There is no second
contextual bar for pages, so options do not live in two places (INV-13).

### 4.2 The tray (tool options)

Arming a tool opens its **tray** beside the armed slot, so options show on arming (FL-R2).
The tray hides when a stroke starts (fading to 20 % first, as 7.15 does) until the armed
slot is pressed again or, with a fine pointer, hovered for 400 ms.

| Tool | Tray |
|---|---|
| Pens | 9 inks of ADR-0021 + custom; width stops 0.5, 1, 1.5, 2.5, 4 pt + slider in "More"; opacity; pressure honesty line once a pen reports pressure |
| Highlighter | 4 tints + custom; widths 6, 8, 10, 12, 15, 18 pt; "Alt draws free ink" hint |
| Eraser | Whole stroke · Partial; 6, 12, 24, 48 px |
| Lasso | none (no tray) |
| Shapes | Four shapes; stroke ink; width; fill on/off |
| Text box | Font size; ink |
| Sign | Saved signatures (up to five, newest first), New signature…, With a certificate… |
| Edit text | One line: "Click a paragraph to edit it. Esc to stop." |
| Redact | Mark text or area (one tool); Find sensitive data…; **Apply N marks** (the tray's one prominent action, G-30) |
| Form field designer | Seven field kinds; Highlight fields; Clear all; Flatten on save |

### 4.3 Contextual bars and context menus

- **Text selection bar** (RA-8, M2, above the selection, flips below near the top bar):
  Copy · Highlight · Comment · Redact · Edit text · ⋯ (Underline, Strikeout, Squiggly,
  Search for "…"). Comment creates one Highlight with its note open (RA-6, FL-R8).
- **Annotation bar**: 5 inks + more · width · Comment · Delete · ⋯ (Duplicate, Opacity,
  Details: author and dates). The inspector's Properties section goes (INV-13).
- **Lasso bar** as today, plus a rotate grip. **Image bar** (Edit image) and **field bar**
  (designer) as today.
- **Page context menu** (right-click, Shift+F10, long press): Paste · Rotate page ▸ · Delete
  page N · Crop page… · Insert blank page after · Extract page… · Show in grid ·
  Recognize text on this page. No lock row: B has no lock by default; when locked, the items
  dim with "Locked" (RA-21).

### 4.4 The Document menu (the title)

Header: first-page thumbnail, name (rename in place), "12 pages · 2.8 MB", save state
("Saved to lease.pdf · 2 min ago" or "Edited · kept on this device"), Lock switch. Then flat
sections, so every item is two steps from the page (static, RA-21):

1. **Save** (Mod+S) · **Save a copy…** (Mod+Shift+S) · Share… (coarse pointers, M-36) · Print…
2. **Pages**: Insert pages from file… · Split… · Rotate all pages ▸ · Crop pages… · Resize
   pages… · Interleave…
3. **Add to pages**: Page numbers… · Header and footer… · Bates numbering… · Watermark…
   (each "Remove …" sits inside its sheet, so the menu never changes)
4. **Protect**: Lock · Password… · Sign with certificate… · Find sensitive data… · Apply
   redactions… · Remove metadata…
5. **Improve**: Recognize text (OCR)… · Compress… · Repair (save repaired copy)… · Remove
   dead links · Add bookmark
6. **Compare with…** · **Document info…** · Close

On compact this is an action sheet with the same groups and 44 px rows (M-12).

### 4.5 Keys and the command palette

| Area | Keys |
|---|---|
| Files | Mod+O open · Mod+S save · Mod+Shift+S save a copy (Firefox keeps it for screenshots; the menu item remains) · Mod+P print · Mod+W close (the browser may keep it; ⋯ → Close is the fallback, as today) |
| Places | 0 Library · G grid ⇄ page · Mod+1…9 and Ctrl+Tab documents · Esc leaves Compare |
| View | Mod+= / Mod+- / Mod+0 zoom (Mod+- at fit page → grid) · Mod+G go to page · Mod+F find · Mod+B side panel · Mod+. palette · F focus · Space pan |
| Tools | V Pointer · P, 1, 2, 3 pens · H Highlighter · Shift+E eraser · Q lasso · R O L A shapes · T text box · N note · Shift+I image · S sign · E edit text · I edit image · X redact |
| On a selection | C comment · H highlight · U underline · Shift+S strikeout · X redact · E edit text (opens with the selection selected) · Mod+C copy · Delete |
| Pages | Shift+R rotate right · Alt+Shift+R rotate left (current page, or the grid selection) · Alt+arrows move · Mod+D duplicate · Delete (grid only) |
| History | Mod+Z · Mod+Shift+Z · Mod+Y |
| Text from the keyboard | Enter on a focused page (or F7 where the browser leaves it to the page; Firefox to verify) starts a caret; Shift+arrows select (FL-R9) |
| Esc ladder | Close a tray or menu → clear the selection → disarm to the Pointer. Never leaves a document |

R is Rectangle at both levels (inert in the grid), so no key changes meaning with the view
(INV-3). The **command palette** (Mod+K; ⋯ → Commands on touch) lists the selection's
actions first (RA-22) and takes arguments ("go 42", "rotate 3-5 90"). The top strip's
search field finds text in the document, not commands (FL-R7).

### 4.6 Where every tool lives

Depth counts presses from the page with nothing open: 1 = visible slot or bar action.
Phone counts assume the capsule is expanded; add 1 when it is a chip.

| Tool or job | Primary place | Depth (desktop / phone) | Other routes | Options |
|---|---|---|---|---|
| Pens ×3 | Palette slots | 1 / 1 | P, 1–3; direct pen writes at depth 0 | Tray |
| Highlighter | Palette slot; selection bar Highlight | 1 / 1 | H | Tray |
| Eraser | Palette slot | 1 / 1 | Shift+E; pen eraser end (0) | Tray |
| Lasso | Palette slot (phone: drawer) | 1 / 2 | Q; pen barrel button (0) | — |
| Shapes | Palette flyout | 2 / 2 (drawer) | R O L A (1) | Tray |
| Text box | Palette slot | 1 / 2 | T | Tray |
| Edit text | Palette Edit flyout; selection bar | 2 / 2 | E (1); selection → Edit text (2) | — |
| Note | Add menu; selection Comment | 2 / 2 | N; C on a selection | Note popup |
| Image (add) | Add menu | 2 / 2 | Shift+I | Image bar |
| Edit image | Palette Edit flyout | 2 / 2 | I | Image bar |
| Stamp | Add ▸ Stamp | 3 / 3 | Mod+K "stamp" | — |
| Signature | Palette Sign slot (phone: pinned slot); tapping a signature field | 2 / 2 (slot, pick) | S | Sign tray |
| Certificate signature | Sign tray → With a certificate…; Document → Protect | 2 / 3 | Mod+K "certificate" | Sheet |
| Form fill | None needed: the Pointer fills | 0 / 0 | Tab between fields | — |
| Form create | Add ▸ Form field ▸ kind | 3 / 3 | Mod+K "field" | Designer tray, field bar |
| Redact | Palette slot; selection bar Redact | 1 / 2 | X | Tray (Apply) |
| Crop | Page context menu; grid tools; Document → Pages | 2 / 2 | Mod+K "crop" | Crop sheet |
| Rotate page | Page context menu; grid tools | 2 / 2 | Shift+R (1) | — |
| Delete, duplicate, insert, extract, split, move pages | Grid tools; page context menu | 2 / 2 (G or pinch, then tool) | Delete, Mod+D, Alt+arrows | Sheets for split and insert |
| OCR | Page chip "No text · Recognize" on scans; Document → Improve; Find's empty state | 1 / 1 on scans, else 2 | Mod+K "ocr" | OCR sheet |
| Compare | Library selection; Document → Compare with… | 2 / 2 | Mod+K | Compare bar |
| Page numbers, header and footer, Bates, watermark | Document → Add to pages | 2 / 2 | Mod+K | Side sheet with live preview |
| Metadata | Document → Document info… | 2 / 2 | Mod+K | Info sheet |
| Password, remove password | Document → Protect; Save a copy → Security | 2 / 2 | Mod+K | Sheet |
| Compress | Document → Improve → Compress… (opens Save a copy at Compression) | 2 / 2 | Mod+K | Save a copy sheet |
| Export images, Markdown / text | Save a copy… → Format | 2 / 2 | Mod+K | Same sheet |
| Batch | Library launcher card and selection bar | 1 on Library | Mod+K | Batch sheet |
| Find | Top strip field (phone: page pill ⌕) | 1 / 1 | Mod+F | — |
| Outline | Page pill → Contents; side panel Contents | 2 / 2 | Mod+G then Tab | — |
| History | Long press or chevron on ↶ | 1 / 1 | Mod+K "history" | Scrubber |

## 5. Saving and safety

### 5.1 Session snapshot and restore

- After each history step (debounced 2 s) and on `visibilitychange: hidden`, each open
  document's state (bytes as last saved, operation log, scroll, tool, level) goes to OPFS
  after `navigator.storage.persist()` (M-34). Nothing leaves the device.
- On launch the last session returns as it was, with "Restored 2 documents · Start fresh"
  (X-12); an iOS jetsam reload lands in the same place (research 19 §9).
- **Recent keeps state.** A closed document stays in Recent with its snapshot, so reopening
  is one tap and yesterday's annotations are there, without a permission prompt or a picker
  on any browser (J14). Kept: the 20 most recent documents or 500 MB, oldest dropped first;
  Settings → Privacy and storage shows the size and clears it; a setting turns keeping off
  (owner question 4). OPFS is unavailable in Safari private browsing (research 03): there the
  Library says "Not kept in a private window".

### 5.2 Save, Save a copy, Share

- **Save** (Mod+S, the menu item, the top-strip button) writes back in place when a
  writable handle exists (Chromium desktop, Chrome Android 132+, OS file handler; RA-10,
  RA-14). The first in-place save of each document asks once: "Save changes into lease.pdf?
  · Save · Save a copy" (owner question 5). The original bytes stay in the snapshot
  ("Revert to the opened version" in Document info). Then "Saved · verified" (AU-12).
- Without a handle, Save opens the save picker with the name filled (Chromium), downloads
  (Firefox), or opens the share sheet (iOS, Android without the picker, M-36): 2 steps.
- **Save a copy…** is today's export form as one sheet: Format (PDF · Images · Markdown /
  text), then collapsed sections Flatten, Security, Compression (with the analysis and the
  presets of today's Compress dialog, fixing INV-18), Metadata, Signature. Compress…,
  Export as images… and Export as Markdown… open it preset. Export and Download merge into
  one button (RA-14).

### 5.3 Unsaved state

A dot on the tab, on the title and on the Library card: "Edited · kept on this device" (the
snapshot) versus "Saved to lease.pdf". `beforeunload` asks only when the snapshot failed or
storage is off (desktop; iOS has no `beforeunload`, research 19 §3.6).

### 5.4 Undo, redo and history

- **↶ ↷ in the top bar on every width** (FL-R3), enabled state visible, tooltip naming the
  step ("Undo pen on page 4").
- Long press or the small chevron on ↶ opens the **History scrubber** (RA-11): a list with
  times on fine pointers, a slider on coarse ones; dragging previews each step.
- Two-finger tap, three-finger tap, Mod+Z, Mod+Shift+Z. An undo reveals the change (scroll
  into view, MC-25) and flashes a ring for 600 ms (MC-32).
- A named toast with Undo for every removal and failure (FL-R3): pages, annotations,
  combined files, applied redactions ("2 areas redacted · Undo · Details"), a file that
  could not open ("scan.pdf could not be opened: damaged file"). Toasts with an action stay
  10 s and pause on hover or focus (A-24).

### 5.5 Lock

Lock is the protective state (L5): per document, kept in the snapshot, shown on the tab,
the title and the chip. Locked documents keep everything that does not change the file:
scroll, zoom, find, select and copy, links, Review, Save a copy, Compare.

## 6. Layout per size class

### 6.1 Rules per class (M-1)

| Class | Top | Palette | Page pill | Side panel | Sheets and dialogs |
|---|---|---|---|---|---|
| compact < 600 | 44 px + safe area: ‹ N, title ▾, ↶ ↷ ⋯; hides on downward scroll while no tool is armed (M-14) | Bottom capsule 64 px, collapsed to a chip by default for files opened from outside; the choice is remembered | 48 px: ▦ · ⌕ · 3 / 12; hidden while the palette is expanded (the scrubber shows the page) | Bottom sheet, detents 40 % and 92 % (M-29) | Sheets at the large detent; menus as action sheets |
| compact-height (< 480 high) | Hidden in reading; tap restores | Trailing vertical rail, 8 slots + More (M-8) | 40 px pill | Side sheet 360 px | Full-screen sheets |
| medium 600–839 | 52 px: ‹ Library, tabs (≥ 2 docs) or title, ⌕, ↶ ↷, Save, ⋯ | Leading vertical, expanded | Bottom centre | Overlay 320 px | Form sheets ≤ 640 px |
| expanded 840–1199 | 44 px strip with tabs | Leading vertical | Bottom centre | Overlay 320 px, or docked by the user | Dialogs |
| large 1200–1599 | Same | Same | Same | Docked 280 px when open | Dialogs |
| xlarge ≥ 1600 | Same | Same | Same | Docked; open by default if last open (M-11) | Dialogs; fit width capped at 1100 px |

The page column is inset by the palette's width plus 16 px, so at rest no glass covers the
page at fit width (RA-15, A-12): at 1440 px the page gets up to 1280 px.

### 6.2 Phone portrait (390 × 844)

```
Library                        Reading                        Marking up                     Pages grid
┌──────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
│ Recto              ⌕  ⚙  │   │ ‹ 3  lease.pdf •▾  ↶ ↷ ⋯ │   │ ‹ 3  lease.pdf •▾  ↶ ↷ ⋯ │   │ ‹ 3  lease.pdf ▾   ↶ ↷ ⋯ │
│ (still aurora field)     │   │ ╌╌╌ fading glass edge ╌╌╌│   │ ┌──────────────────────┐ │   │ 12 pages · All open (3) ▾│
│ ╭──────────────────────╮ │   │ ┌──────────────────────┐ │   │ │                      │ │   │ ┌─────┐ ┌─────┐ ┌─────┐  │
│ │Your PDFs stay on this│ │   │ │                      │ │   │ │  page, fit width     │ │   │ │  1  │ │  2  │ │ 3 ◉ │  │
│ │device.       ◉ Local │ │   │ │                      │ │   │ │                      │ │   │ └─────┘ └─────┘ └─────┘  │
│ │Combine  Compare  ⋯   │ │   │ │  page, fit width     │▐│   │ │                      │ │   │ ┌─────┐ ┌─────┐ ┌─────┐  │
│ ╰──────────────────────╯ │   │ │  8 px side margins   │ │   │ └──────────────────────┘ │   │ │  4  │ │  5  │ │  6  │  │
│ Open               Select│   │ │                      │ │   │ ╭── tray ──────────────╮ │   │ └─────┘ └─────┘ └─────┘  │
│ ┌────────┐ ┌────────┐    │   │ │                      │ │   │ │● ● ● ● ● ● ● ● ● +   │ │   │ ┌─────┐ ┌─────┐ ┌─────┐  │
│ │▒▒▒▒▒▒▒▒│ │▒▒▒▒▒▒▒▒│    │   │ │                      │ │   │ │·  •  ●  ⬤  ⬤  widths │ │   │ │  7  │ │  8  │ │  9  │  │
│ │lease • │ │report  │    │   │ └──────────────────────┘ │   │ ╰──────────────────────╯ │   │ └─────┘ └─────┘ └─────┘  │
│ └────────┘ └────────┘    │   │                          │   │ ╭──────────────────────╮ │   │ ╭──────────────────────╮ │
│ Recent                   │   │                          │   │ │ ↖  ● ● ●  ▬  ⌫  Sg  ⋯│ │   │ │✓  ↺  ↻  Del  Ext  ⋯  │ │
│ ▢ invoice.pdf       2 d  │   │ ╭─────────────╮    ╭───╮ │   │ ╰──────────────────────╯ │   │ ╰──────────────────────╯ │
│ ▢ scan-letter.pdf   5 d  │   │ │▦  ⌕  3 / 12 │    │ ✎ │ │   │  (top bar stays)         │   └──────────────────────────┘
│ ╭──────────────────────╮ │   │ ╰─────────────╯    ╰───╯ │   └──────────────────────────┘
│ │      +  Open PDF     │ │   └──────────────────────────┘
│ ╰──────────────────────╯ │
└──────────────────────────┘
Open PDF and the shelves       ✎ = palette chip (M1);         capsule 64 px: Pointer,        3 columns, cells ≈ 110 px;
sit within thumb reach         ▐ = scrubber while             3 pens, Highlighter,           the palette has morphed
                               scrolling                      Eraser, Sign (pinned),         into page tools
                                                              More (drawer)
```

The primary actions sit in the bottom 200 px (research 19 §8): Open PDF, the chip, the
capsule, the tray, sheets at 40 %. Selecting in the Library (Select, or a long press on a
card) numbers the cards in selection order and raises a bar "Combine 2 · Compare · Close".

### 6.3 Tablet portrait (820 × 1180)

```
Library                                         Reading
┌──────────────────────────────────────────┐    ┌──────────────────────────────────────────┐
│ Recto   lease • │ report │ +     ⌕   ⚙   │    │ ‹ Library │ lease •▾ │ report │ ⌕ ↶ ↷ ⋯  │
│ (still aurora field behind the card)     │    │ ╭──╮ ┌──────────────────────────────┐    │
│ ╭──────────────────────────────────╮     │    │ │↖ │ │                              │    │
│ │Recto · PDFs stay on this device  │     │    │ │● │ │                              │    │
│ │[Open PDFs] Combine Compare Batch │     │    │ │● │ │   page, fit width            │    │
│ ╰──────────────────────────────────╯     │    │ │● │ │   (inset by the palette)     │    │
│ Open                              Select │    │ │▬ │ │                              │    │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │    │ │⌫ │ │                              │    │
│ │      │ │      │ │      │ │      │      │    │ │◌ │ │                              │    │
│ │      │ │      │ │      │ │      │      │    │ │▭ │ │                              │    │
│ └──────┘ └──────┘ └──────┘ └──────┘      │    │ │T │ │                              │    │
│ Recent                                   │    │ │Sg│ │                              │    │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │    │ │Ed│ │                              │    │
│ │      │ │      │ │      │ │      │      │    │ │▮ │ │                              │    │
│ │      │ │      │ │      │ │      │      │    │ │+ │ │                              │    │
│ └──────┘ └──────┘ └──────┘ └──────┘      │    │ ╰──╯ └──────────────────────────────┘    │
└──────────────────────────────────────────┘    │           ╭───────────────────╮          │
                                                │           │▦   3 / 12   94 %  │          │
                                                │           ╰───────────────────╯          │
                                                └──────────────────────────────────────────┘

Marking up (pen armed, tray open)               Pages grid
┌──────────────────────────────────────────┐    ┌──────────────────────────────────────────┐
│ ‹ Library │ lease •▾ │ report │ ⌕ ↶ ↷ ⋯  │    │ ‹ Library │ lease •▾ │ report │ ⌕ ↶ ↷ ⋯  │
│ ╭──╮╭─────────────────╮┌──────────────┐  │    │ ╭──╮  12 pages · All open docs (2) ▾     │
│ │↖ ││● ● ● ● ● ● ● ● ●││              │  │    │ │✓ │ ┌────┐┌────┐┌────┐┌────┐┌────┐      │
│ │●◀││·  •  ●  ⬤  ⬤    ││  page        │  │    │ │↺ │ │    ││    ││    ││    ││    │      │
│ │● ││opacity ━━━━○    ││              │  │    │ │↻ │ └────┘└────┘└────┘└────┘└────┘      │
│ │● │╰─────────────────╯│  (the tray   │  │    │ │Dl│ ┌────┐┌────┐┌────┐┌────┐┌────┐      │
│ │▬ │                   │   hides on   │  │    │ │⧉ │ │    ││    ││    ││    ││    │      │
│ │… │                   │   a stroke)  │  │    │ │⇱ │ └────┘└────┘└────┘└────┘└────┘      │
│ ╰──╯                   │              │  │    │ │+ │  report.pdf · 10 pages        ▾     │
│                        └──────────────┘  │    │ ╰──╯ ┌────┐┌────┐┌────┐┌────┐┌────┐      │
│        ╭── selection bar ───────╮        │    │      │    ││    ││    ││    ││    │      │
│        │●●●● ━ Comment Delete ⋯ │        │    │      └────┘└────┘└────┘└────┘└────┘      │
│        ╰────────────────────────╯        │    │          ╭─────────────────────╮         │
└──────────────────────────────────────────┘    │          │▦  grid · size ━━○━━ │         │
                                                │          ╰─────────────────────╯         │
                                                └──────────────────────────────────────────┘
```

### 6.4 Desktop (1440 × 900)

```
Library
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ◆ Recto │ lease • │ report │ +                              ⌕ Search documents     ⚙     │
│                    (aurora field, still; the strongest light in the app)                 │
│        ╭── lit glass card ────────────────────────────────────╮                          │
│        │ Recto                              ◉ On this device  │                          │
│        │ [ Open PDFs ]   Combine   Compare   Batch            │                          │
│        ╰──────────────────────────────────────────────────────╯                          │
│        Open                                                                      Select  │
│        ┌────────┐ ┌────────┐ ┌────────┐                                                  │
│        │        │ │        │ │        │                                                  │
│        └────────┘ └────────┘ └────────┘                                                  │
│        Recent (each card keeps its last state: "Edited 2 d ago")                         │
│        ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                 │
│        │        │ │        │ │        │ │        │ │        │ │        │                 │
│        └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘                 │
└──────────────────────────────────────────────────────────────────────────────────────────┘

Reading                                                  Marking up (Highlighter armed, text selected)
┌─────────────────────────────────────────────────────┐  ┌─────────────────────────────────────────────────────┐
│ ◆ │ lease •▾ │ report │ +   ⌕ Find…   ↶ ↷  Save ⋯   │  │ ◆ │ lease •▾ │ report │ +   ⌕ Find…   ↶ ↷  Save ⋯   │
│ ╭──╮   ┌─────────────────────────────────────┐      │  │ ╭──╮╭───────────────╮┌────────────────────────────┐ │
│ │↖ │   │                                     │      │  │ │↖ ││▬ ▬ ▬ ▬  +     ││This agreement sets out     │ │
│ │● │   │  page, fit width (up to 1280 px)    │      │  │ │● ││6 8 10 12 15 18││░░░░░░░░░░░░░░░░░ (blue     │ │
│ │● │   │  runs under the 44 px strip         │      │  │ │● │╰───────────────╯│selection, never lime)      │ │
│ │● │   │  (full bleed, G-19 scroll edge)     │      │  │ │● │                 │ ╭────────────────────────╮ │ │
│ │▬ │   │                                     │      │  │ │▬◀│                 │ │Copy Highlight Comment  │ │ │
│ │⌫ │   │                                     │      │  │ │⌫ │                 │ │Redact  Edit text  ⋯    │ │ │
│ │◌ │   │                                     │      │  │ │◌ │                 │ ╰────────────────────────╯ │ │
│ │▭ │   │                                     │      │  │ │… │                 │                            │ │
│ │… │   │                                     │      │  │ ╰──╯                 │                            │ │
│ ╰──╯   └─────────────────────────────────────┘      │  │                      └────────────────────────────┘ │
│              ╭──────────────────────╮               │  │              ╭──────────────────────╮               │
│              │▦   3 / 12   94 % ▾   │               │  │              │▦   3 / 12   94 % ▾   │               │
│              ╰──────────────────────╯               │  │              ╰──────────────────────╯               │
└─────────────────────────────────────────────────────┘  └─────────────────────────────────────────────────────┘

Pages grid (G, Mod+wheel past fit page, or ▦)
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ◆ │ lease •▾ │ report │ +                        ⌕ Find in document   ↶ ↷  Save  ⋯       │
│ ╭──╮   lease.pdf · 12 pages · 2 selected        All open documents (2) ▾                 │
│ │✓ │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐             cells 144 px;  │
│ │↺ │  │  1 │ │ 2 ✓│ │ 3 ◉│ │  4 │ │ 5 ✓│ │  6 │ │  7 │ │  8 │             hover shows ↻  │
│ │↻ │  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘             and Delete in  │
│ │Dl│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                                         the label      │
│ │⧉ │  │    │ │    │ │    │ │    │                                         gutter         │
│ │⇱ │  └────┘ └────┘ └────┘ └────┘                                                        │
│ │+ │   report.pdf · 10 pages (shown because "All open documents" is on)                  │
│ ╰──╯  ┌────┐ ┌────┐ ┌────┐                                                               │
│       │    │ │    │ │    │                                                               │
│       └────┘ └────┘ └────┘                                                               │
│                        ╭─────────────────────────────╮                                   │
│                        │▦ grid · cell size ━━━○━━ ▾  │                                   │
│                        ╰─────────────────────────────╯                                   │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

The grid shows the active document; a header switch adds the other open documents as
sections, for moves between them (today's Arrange shows them all by default, `ui-store`
`arrangePinned`). The page pill becomes the cell-size control there (INV-21).

### 6.5 Placement matrix

| Surface | compact | compact-height | medium | expanded | large | xlarge |
|---|---|---|---|---|---|---|
| Switcher | ‹ N → Library | ‹ N | Tabs (≥ 2) | Tabs | Tabs | Tabs |
| Document menu | Title → action sheet | Same | Title → popover menu | Active tab name → menu | Same | Same |
| Palette | Bottom capsule, 8 slots + drawer; chip by default | Trailing rail | Leading vertical | Leading vertical | Same | Same |
| Tray | Above the capsule | Beside the rail | Beside the armed slot | Same | Same | Same |
| Selection bars | Above the selection, 44 px | Same | Same | Same, 32 px | Same | Same |
| Context menu | Action sheet (long press) | Same | Menu at the press | Menu | Menu | Menu |
| Side panel (Pages, Contents, Find, Review) | Sheet 40 / 92 % | Side sheet 360 | Overlay 320 | Overlay or docked | Docked 280 | Docked, open if last open |
| Find | ⌕ in the page pill → field above the keyboard, "3 of 41 ‹ ›" | Same | Top bar ⌕ → field | Field in the top strip | Same | Same |
| Undo / redo | Top bar | Rail top | Top bar | Top strip | Same | Same |
| Save | Title sheet (dot on title) | Same | Top bar | Top strip button | Same | Same |
| Page pill (page, zoom, layout, go to, Contents, ▦) | Bottom, 48 px | 40 px | Bottom centre | Same | Same | Same |
| Grid page tools | Capsule morph | Rail morph | Palette morph | Same | Same | Same |
| Sheets (Save a copy, OCR, furniture, redaction) | Bottom sheet (furniture at 40 % so the preview shows) | Side sheet | Form sheet ≤ 640 | Side or centred dialog | Same | Same |
| Command palette | ⋯ → Commands, sheet | Same | Centred | Centred | Same | Same |
| Toasts and progress | Above the capsule | Above the pill | Bottom leading | Same | Same | Same |
| Privacy chip | Library header; ⋯ header | Same | Library; ⋯ | Library; top strip glyph | Same | Same |
| Settings | Sheet at 92 % | Full screen | Form sheet | Dialog | Same | Same |
| Compare | One page with A · B · Changes switch (M-38) | Same | Side by side | Same | Same | Same |

## 7. The sixteen jobs

### 7.1 Paths

Start state as `current-flows.md` §1: one document open (in B: page level, Pointer, palette
expanded on medium and up, chip on compact), nothing selected. Counting rule unchanged.
"Save" in B is +1 with a writable handle, else +2 (Save, then the picker or share sheet).

- **J1 First visit.** Library launcher. Mouse 2: Open PDFs · pick (or drop: 1; or "Try a
  sample", a bundled demo, FL-R10: 1). Keyboard 2: Mod+O (focus starts on Open PDFs) · pick.
  Touch 2: Open PDF (bottom) · pick. Installed on desktop Chromium, "Open with Recto" from
  the OS: 1 (RA-10).
- **J2 Open one PDF and read.** Mouse 2: Open · pick; the page fills the width, no panel.
  Keys 1: drop. Keyboard 2: Mod+O · pick (the page takes focus; PageDown reads). Touch 2:
  Open · pick (nothing to collapse). Jump to page 7: +1 (drag the scrubber, which labels
  the page) or Mod+G · 7 · Enter.
- **J3 Open two and combine.** Mouse 3: Open · pick both (the Library opens with both
  selected, numbered 1 and 2) · Combine 2 files; the new document opens at the grid level
  with "Combined 2 files · Undo" and its order is edited there, so the order dialog goes.
  Keys 2: drop · Combine. Keyboard 3: Mod+O · pick · Enter (focus lands on Combine). Touch
  3: Open · pick both · Combine. Save +2.
- **J4 Move page 5 before 2, delete 7, keep reading.** Mouse 4: ▦ · drag 5 before 2 ·
  trash on 7 (hover action) · click any page to zoom back in. With the side panel open: 3
  (drag a thumbnail, right-click 7 → Delete). Keys 4: G · drag · trash on 7 · G.
  Keyboard ≈11: G · arrows to 5 (≈3) · Alt+Left ×3 · arrows to 7 (≈2) · Delete · Esc.
  Touch 5: pinch out · long-press-drag 5 before 2 · tap 7's check circle · Delete · tap a
  page. Delete only, from the page: right-click page 7 · Delete page 7 (2; today 4).
- **J5 Highlight and comment.** Mouse 4: drag over the sentence · Comment · type · Enter.
  Keys 4: drag · C · type · Enter. Keyboard ≈7: Enter on the page (caret) · arrows to the
  sentence (≈2) · Shift+arrows · C · type · Enter. Touch 5: long press · drag a handle ·
  Comment · type · Done.
- **J6 Write two words, two colours.** Mouse 4: Pen 1 · draw · Pen 3 (red) · draw. Keys 4:
  1 · draw · 3 · draw. Stylus 3: write (pen writes when idle) · red · write. Finger on a
  phone 5: tap the chip · Pen 1 · draw · red · draw (4 when the palette is already
  expanded). Keyboard: not applicable.
- **J7 Fill three fields and a checkbox.** Mouse 7: click field 1 · type · Tab · type · Tab
  · type · click the checkbox (no notice, RA-3). Keyboard 9: F6 to the page · Tab (fields are
  in reading order) · type · Tab · type · Tab · type · Tab · Space. Touch 7: tap field 1
  (the accessory bar with Previous, Next and Done rises above the keyboard, M-28) · type ·
  Next · type · Next · type · tap the checkbox. Save +2.
- **J8A Place a signature image.** Mouse 3: Sign · the saved signature · click the spot
  (first time 5: Sign · New signature… · draw · Save · click). Keys 3: S · Enter · click.
  Keyboard 3: S · Enter (picks the newest) · Enter (places at the focused page's centre;
  arrows nudge) (first time 5). Touch 4: tap the chip · Sign (the pinned slot) · the saved
  signature · tap the spot (first time 6); on a signature field 2: tap the field · the saved
  signature, fitted to the field (RA-5). Save +2.
- **J8B Sign with a certificate, saved.** Mouse 6: Sign · With a certificate… · pick the
  .p12 · password · Sign and save a copy · picker. Keyboard ≈8. Touch 6: title · Sign with
  certificate… · pick · password · Sign and save · share sheet.
- **J9 Edit a word in a paragraph.** Mouse 4: double-click "2024" · Edit text (the editor
  opens with the word selected, not a caret at the start) · type · click outside. Keys 4:
  double-click · E · type · Esc. Keyboard ≈7: Enter on the page · arrows (≈2) · Shift+
  Mod+Right · E · type · Esc. Touch 4: long press the word · Edit text · type · Done.
- **J10 Redact text and an area, apply.** Mouse 6: drag over the e-mail · Redact · Mark
  area (pending-redactions bar) · drag the area · Apply 2 marks · Apply (confirmation sheet);
  the result is a toast "2 areas redacted · verified · Undo · Details" instead of a result
  screen. Keys 6 (X instead of the bar's Redact). Keyboard ≈9: Mod+K · "sensitive" · Enter ·
  Tab · Enter (mark) · Tab · Enter (Apply 3 marks) · Enter (confirm). Touch 7: long press ·
  handle · Redact · Mark area · drag the area · Apply · Apply. Save +2.
- **J11 OCR a scan.** Mouse 2: Recognize on the page chip "No text on these pages" (shown on
  open when the first page has no text layer) · Recognize in the sheet; a toast "Recognized
  2 pages · 1 to review" opens Review → OCR words. Keyboard 4: Mod+K · "ocr" · Enter ·
  Enter. Touch 2. Find on a scan offers the same button instead of "No results" (FL-R7).
  Save +2.
- **J12 Compare two open versions.** From the Library, mouse 3: check A · Shift-click B ·
  Compare (runs with automatic matching; options in its bar). From a document with the
  other on disk, 3: title · Compare with… · pick. Keyboard ≈6: arrows to A · Space · arrow
  · Space · Tab to the selection bar · Enter. Touch 3: long press A · tap B · Compare.
- **J13A Save.** 1 with a handle, else 2 (Mod+S or Save; touch 2–3 via the share sheet).
  **J13B Compress, then save.** Mouse 5: title · Compress… (Save a copy at Compression) ·
  preset · Save copy · picker. Keyboard ≈7: Mod+K · "compress" · Enter · arrows · Tab ·
  Enter · Enter. Touch 5.
- **J14 Return via Recents.** 1: the Recent card opens its snapshot with yesterday's edits.
  Keyboard ≈2: 0 · Enter (focus starts on the first Recent card). Touch 1.
- **J15a Find and step to a hit.** Mouse 3: Find field · type · ↓. Keyboard 3: Mod+F · type
  · Enter. Touch 3: ⌕ in the page pill · type · ↓ (field above the keyboard, page visible).
- **J15b Jump to an outline entry.** Mouse 2: page pill · the entry under Contents. Keyboard
  ≈4: Mod+G · Tab to Contents · arrows · Enter. Touch 2.
- **J16 Page numbers.** Mouse 3: title · Page numbers… (the default preset is "Page 1 of N"
  at the bottom centre, previewed live) · Apply. Keyboard ≈5: Mod+K · "page numbers" · Enter
  · Tab · Enter. Touch 3 (the sheet stops at 40 % so the preview shows). Save +2.

### 7.2 Step counts

Today's numbers are `current-flows.md` §20; best reference from research 15 §4 (marked
[EK] where it rests on established knowledge, "—" where no reference was counted).

| Job | Mouse today → B | Keyboard today → B | Touch today → B | + save today → B | Best reference |
|---|---|---|---|---|---|
| J1 First visit | 2 → 2 | 2 → 2 | 2 → 2 | — | 1 (Preview, from the Finder) |
| J2 Open and read | 2 → 2 | ≈3 → 2 | 3 → 2 | — | 1 (Preview) |
| J3 Open two, combine | 4 → 3 | ≈8 → 3 | 4 → 3 | +3 → +2 | 4 (PDF Expert) |
| J4 Move one page, delete one | 5 → 4 (3 with panel) | ≈12 → ≈11 | delete 4, move — → 5 | — | 3 (Preview: drag, select, Delete) |
| J5 Highlight and comment | 7 → 4 | — → ≈7 | ≈8 → 5 | — | 4 (Acrobat) |
| J6 Write, two colours | 5 → 4 | n/a | 5 (stylus 3) → 5 (stylus 3) | — | 3 (Notability: pen armed) [EK] |
| J7 Fill 3 fields + checkbox | 8 → 7 | ≈11 → 9 | ≈9 → 7 | +3 → +2 | 7 (Preview: click, type, no mode) [EK] |
| J8A Signature image | 6 → 3 (first 5) | — → 3 | 6 → 4 (2 on a signature field) | +3 → +2 | 3 (Acrobat, Firefox, PDF Expert) |
| J8B Certificate, saved | 8 → 6 | ≈12 → ≈8 | 8 → 6 | included | — |
| J9 Edit a word | 5 → 4 | ≈10 → ≈7 | 5 → 4 | — | 3 (PDF Expert, in its Edit tab) |
| J10 Redact text + area | 8 → 6 | ≈13 → ≈9 | 9 → 7 | +3 → +2 | 3 (Preview, text only) |
| J11 OCR a scan | 4 → 2 | ≈7 → 4 | 4 → 2 | +3 → +2 | — |
| J12 Compare two open | 4 → 3 | ≈7 → ≈6 | 6 → 3 | — | — |
| J13A Save | 3 → 1–2 | 3 → 1–2 | 3 → 2–3 | — | 0 (Preview autosave) |
| J13B Compress, save | 8 → 5 | ≈12 → ≈7 | 8 → 5 | included | — |
| J14 Reopen from Recents | 1–3 → 1 | ≈5–6 → ≈2 | 3 → 1 | — | 1 (Preview window restore) [EK] |
| J15a Find, step | 3 → 3 | 3 → 3 | 4 → 3 | — | 3 [EK] |
| J15b Outline entry | 3 → 2 | ≈6 → ≈4 | 4 → 2 | — | 2 (Preview sidebar) [EK] |
| J16 Page numbers | 4 → 3 | ≈7 → ≈5 | 4 → 3 | +3 → +2 | — |
| **Total** (J14 taken as 2 today, J13A as 2 in B) | **91 → 66** | **122 (2 gaps) → 94 (no gaps)** | **99 (1 gap) → 72** | **+18 → +12** | |

Read across: B never takes more steps than today on any row and any input. It beats or
ties the best reference on J3, J5, J7, J8A, J14 and J15; it still loses on J4 (4 against
Preview's 3, unless the side panel is open), J9 (4 against 3, the cost of L2) and J10
(6 against 3: Preview redacts text only and has no confirmation; B keeps a confirmation
because applying removes content). Keyboard paths exist for every job but writing (FL-R9).

## 8. Glass, light and motion in this model

High level only; values belong to the design-language track.

- **Glass (G-1, G-3).** Palette, tray and toasts M2; chip and page pill M1; the top strip a
  thin M3 at σ 8 over the full-bleed page with a 40 px scroll edge (G-19); side panel M3;
  menus M4; sheets M5. Never glass: the page, thumbnails, card artwork, editors, inputs
  (G-18). σ ≤ height / 5 on bars and chips (A-2, G-32); Clear · Tinted · Solid (A-17). At
  rest no glass covers the page (RA-15), easier here because the palette lives in the margin.
- **Light (AU-4, AU-5).** The Library field (still; an arrival swell, a drag-over response,
  AU-13); a lit nib under the palette's armed slot (AU-10), the document view's one lime
  element (X-1); a processing ring on progress toasts and a bloom on "Saved · verified"
  (AU-11, AU-12). Never on the page, the grid, Compare, redaction or errors (A-6).
- **Motion (MO-8, MP-1 to MP-12).** The semantic zoom is the signature moment: during a
  pinch the page layer scales by `transform` 1:1 (MO-7); past the threshold the current
  page morphs into its grid cell with a View Transition and the other cells fade in,
  staggered by distance (MC-9, MP-11); the reverse is symmetric. A card grows into its first
  page (MC-2). The palette collapses into its chip by `clip-path` on `--spring-smooth`
  (MC-11) and throws to a dock with `--spring-fling`. The tray rises on `--spring-quick`
  (MC-12). An undo flashes a ring at the change (MC-32); a two-finger tap draws a short
  ring at the tap's midpoint (none under reduced motion) *(judgement)*. Rest is still
  (MP-4); under reduced motion everything spatial becomes a 150 ms cross-fade (A-9, MO-5).
- **Why it feels native, calm and expensive.** One object floats, one pill answers "where
  am I", everything else comes when asked and leaves after; the page is the brightest thing
  on screen (AU-7). Response precedes animation (RA-17, X-4): press feedback in one frame,
  1:1 pinch, drag and throw. The same gestures work everywhere, so the app teaches itself.
  Restraint is the finish: one lime element, three type sizes per surface (X-3), labels where
  icons are unclear (RA-20), no splash, the last state on launch (X-12).

## 9. Component families: fate and code impact

| # | Family (inventory) | Fate | What changes | Main code impact |
|---|---|---|---|---|
| 3 | App frame | **Replace** | Title bar becomes a 44/52 px glass strip (tabs, Find, ↶ ↷, Save, ⋯); the mode switch (3.10), layout switch (3.11), Document button (3.7), Export button (3.8), inspector toggle (3.9), status bar (3.14) and zoom controls (3.15) go; page, zoom and layout move into the page pill; the command search field becomes Find | `shell/AppShell.tsx`, `TabBar.tsx` rewritten; `Stage.tsx` loses `ModeSwitch`; `StatusBar.tsx` removed; new `shell/PagePill.tsx`; size classes via `useSizeClass()` (M-1) |
| 4 | Home and library | **Replace** | Library place: launcher card, Open and Recent shelves with snapshots, numbered selection, one-click open, Settings entry | `home/*` rewritten; new `session/` (OPFS snapshot, M-34); recents store gains thumbnails and snapshot ids |
| 5 | Navigator | **Merge** | Rail goes; one on-demand side panel with Pages (drag to reorder, RA-7), Contents, Find, Review (Comments, Marks, Fields, OCR words); Files tab merges into the Library; Changes moves to Compare | `shell/LeftRail.tsx` → `shell/SidePanel.tsx`; panels kept; `FilesList` removed; `leftPanelOpen` default false |
| 6 | Inspector | **Remove** (redistribute) | Selection and Properties → bars and their ⋯ Details; OCR → Review filter and OCR sheet; Signatures → the signature badge's sheet; History → the ↶ scrubber; Info → Document info | `shell/RightPanel.tsx` removed; sections reused in sheets and popovers |
| 7 | Tool bar | **Replace** | Group row, group chip and morph (7.2, 7.3), Read dock (7.1) and command buttons (7.10) go; the palette with slots, flyouts, drawer, chip and docks replaces them; options tier becomes the tray; presets, eraser tier, style controls, stroke fade and cursors kept | `shell/FloatingToolbar*.ts(x)` → `shell/palette/*`; `tool-store.ts` drops `barGroup` and `lastGroup` and keeps `mode` per document; `PenBar.tsx` and `StyleControls.tsx` kept |
| 8 | Contextual bars, menus, popovers | **Keep, merge** | Text bar gains Comment-as-highlight, Redact, Edit text; annotation bar absorbs Properties; Arrange bar (8.4) folds into grid page tools; Document menu becomes the title menu with static sections; zoom menu moves into the page pill; page menu loses its lock row | `ReadSelectionBar.tsx`, `AnnotationBar.tsx`, `DocumentMenu.tsx` reworked; `ContextualBar.tsx` removed; `PageContextMenu.tsx` simplified |
| 9 | Canvas and overlays | **Keep** | Hit order kept; `liveHitKinds` keyed by tool and pointer type instead of mode; double-click with the Pointer selects a word; pen-idle writing; tap-no-ink rule; Read notices (9.14) and the double-click hint (9.4) go; OCR chip added; keyboard caret and placement added (FL-R9) | `viewer/hit-order.ts`, `ink-input.ts`, `TextLayer.tsx`, `FormLayer.tsx`; new caret controller in `viewer/` |
| 10 | Arrange light table | **Keep as a level** | Same grid, sections and keys; entered by semantic zoom; sections of other documents behind a switch; touch drag after a long press (S-T4); check circles on coarse pointers (INV-R8) | `stage/ArrangeView.tsx` becomes `stage/GridLevel.tsx`; zoom bridge with `ReadView.tsx` (shared transform, View Transition) |
| 11 | Compare | **Keep** | Place instead of view; skips setup when two documents are given; one-page A · B · Changes on compact (M-38); Changes list in its own sheet | `compare/*` small changes; `compare-commands.ts` stops opening the navigator |
| 12 | Dialogs and sheets | **Merge** | Export, Compress, Export as images and Markdown merge into Save a copy; Combine dialog goes (order edited in the grid); Signature dialog becomes the Sign tray plus one sheet; Apply redactions' result becomes a toast with Details; all become sheets on compact (M-29) | `ExportDialog.tsx`, `CompressDialog.tsx`, `ImageExportDialog.tsx`, `ConvertDialog.tsx` → `export/SaveCopySheet.tsx`; new `ui/Sheet` on Base UI Drawer; `MergeAllDialog` removed |
| 13 | Command palette, shortcuts | **Keep** | Selection actions first (RA-22); arguments; key map updated (1–3, G, S, C) | `CommandPalette.tsx`, `commands/*`, `ShortcutOverlay.tsx` |
| 14 | Feedback | **Replace** | Visible toasts for every removal and failure (FL-R3); progress toasts replace status-bar text; live regions kept, one announcement per action (A-14) | New `ui/Toast` (sonner's constants, X-8); `CombinedToast` folds in |
| 15 | Settings, privacy, brand | **Replace** | A Settings sheet (Appearance with Glass, Light and Motion; Pen and touch; Opening and saving; Language; Signatures; OCR languages; Privacy and storage; About); privacy chip on the Library | `tools/DocumentMenu.tsx` loses Appearance; new `settings/*`; `appearance-store.ts` gains glass, light and motion (A-17, AU-16, MO-6) |
| 15.2 | Primitives | **Keep, extend** | Coarse density tokens (M-2), two-band focus ring (A-11), Phosphor icons with fill for armed (I-*), sheet and toast primitives | `ui/*`, `tokens.css`, `global.css` |

## 10. Risks, relearning, accessibility and open questions

### 10.1 Risks

| Risk | Likelihood, impact | Mitigation |
|---|---|---|
| The owner asked for a locked Read mode one day ago (ADR-0019); B makes the lock opt-in | High, high | L1–L4 prevent the accidents he named (pen or stray click editing page text); L5 restores the exact M8 behaviour with one setting; this proposal should not ship without his answer (§10.4 Q1) |
| Pen-first writes on a document the user only wanted to read (tablet) | Medium, low (one undo) | Two-finger tap; the hold-still select; "Pen writes when idle" off in one switch; signed files locked |
| A palette always on screen reads as "editor" to people who only read | Medium, medium | Chip by default on compact; Mod+. and F on desktop; the palette lives in the margin, not over text |
| Semantic zoom overshoot: zooming out to see a page lands in the grid | Medium, low | Fit-page detent with a 300 ms pause; release threshold 15 %; Esc or a click returns to the same page |
| Gestures are invisible | High, low | Every gesture has a button and a key; one-time inline hints in the page pill ("Pinch out for all pages") within DESIGN §4 principle 6 (no marketing) *(judgement)* |
| Mouse users miss the thumbnail sidebar and status bar | Medium, low | Side panel on Mod+B, kept open by a setting; page pill shows page and zoom |
| Snapshots keep copies of sensitive files on the device | Medium, medium | Stated in the Library ("Kept on this device"), size and Clear in Settings, a switch to turn it off; never in private windows; owner question 4 |
| Save in place overwrites the original irreversibly | Low, high | One confirmation per document; original kept in the snapshot with "Revert to the opened version"; verification after writing |
| Four-finger tap may collide with system gestures on some tablets | Low, low | F and the ⋯ menu; the gesture can be turned off |
| Breadth of the change: 85 `viewMode`, 66 `documentMode` and 72 `canEdit` references; e2e specs that press 0–4 and name groups | High, medium | Keep `canEdit`'s name and fail-closed guard; migrate behind a flag per surface; specs rewritten per feature as ADR-0019 did |

### 10.2 What today's users relearn

- No Read or Edit, no Edit button, no five group labels: one palette; files open unlocked
  unless "Open files locked" is on. Arrange is "zoom out" (pinch, Mod+wheel, G or ▦).
- Keys: `1`–`3` pick pens (they switched views); `G` is the grid (it was Signature, now
  `S`); Strikeout moves to `Shift+S`; `C` comments; Esc only leaves a tool or a selection.
- Double-click on page text selects a word; editing needs Edit text (E or the bar).
- The Document button is the document's name; Export is Save a copy; Mod+S saves. The status
  bar and inspector are gone: page and zoom in the pill, history behind ↶, signatures behind
  the badge, privacy in the Library.

### 10.3 Accessibility notes

- **A-12, A-13:** `scroll-padding` equals the palette and pill insets; F6 cycles top strip
  → side panel → page → palette → tray → toasts; Esc closes the topmost surface and returns
  focus; nothing auto-hides while focused.
- **A-15, M-2:** 44 px hit areas under `pointer: coarse` or `any-pointer: coarse`; ink cells
  36 px visible with 44 px hit areas; no overlapping hit areas in the 8-slot capsule (352 px).
- **A-20:** at 320 × 256 the compact layout applies: chip + pill + top bar, every tool in
  the drawer; floating chrome ≤ 25 % of the viewport.
- **WCAG 2.5.1 and 2.5.7:** two-finger and three-finger taps have ↶ ↷; pinch has ▦, G and
  zoom keys; page drags have Alt+arrows, Move to ▸ and the grid tools; the palette dock has
  "Move tool bar to ▸" in its menu.
- **FL-R9, INV-16:** caret text selection; notes, text boxes, stamps, signatures and shapes
  placed at the focused page's centre. **A-19:** lime only as the armed slot's fill with an
  ink glyph (fill icon, I-*), never on the page; page selection in `#4e61ed` (research 20).
- **A-14:** one announcement per action, said at the state change: "Pen 1, black, 1.5 pt",
  "Pages grid, 12 pages, page 3", "Undid pen stroke on page 4", "lease.pdf is locked".
- **A-7, A-9:** the Library aurora is still by default with Light Auto · Still · Off
  (AU-16); semantic zoom becomes a cross-fade under reduced motion.
- **A-21:** palette labels appear as tooltips with keycaps and, with the Labels setting, as
  a 168 px labelled column sized for Turkish at 1.8 × English.

### 10.4 Open questions for the owner

1. **Protection.** Is "no Read mode, plus a per-document Lock and an 'Open files locked'
   setting" enough, given the M8 request? If not, should "Open files locked" default to on?
2. **Pen-first.** On a tablet, should a stylus write the moment it touches the page with no
   tool chosen (Apple's guidance), or only after a pen is picked?
3. **Double-click on text.** Select a word (this proposal), or open the paragraph editor
   as in M8's Edit mode?
4. **Kept state.** May Recto keep working copies of the last 20 documents (up to 500 MB) on
   the device so Recents reopen with their edits? Default on or off?
5. **Save in place.** On Chromium, may Mod+S overwrite the original file after a one-time
   confirmation per document?
6. **Palette dock.** Vertical at the left edge on desktop and tablet (this proposal), or a
   bottom capsule as today?
7. **Gestures.** Single two-finger tap for undo (Procreate, Notability) or a double tap
   (GoodNotes)? Four-finger tap for Focus?
8. **Keys.** Accept `G` for the grid, `S` for Sign and `1`–`3` for pens, retiring the view
   keys `1`–`4`?

## Sources

All sources are files of this repository on `develop` (2026-10-04). No web sources were used.

- Read in full: `docs/design/redesign-2026-10/current-flows.md`, `inventory.md`,
  `docs/research/15-reference-apps.md`, `19-mobile-and-touch.md`, ADR-0019, ADR-0021.
- Read in part: research 22 (§0, §8–§15), 16 (§0, §7.2–§7.4, G-1 to G-32), 17 (§0, §8,
  AU-1 to AU-22), 18 (§0, tokens, §6.4–§9, MC catalogue), 20 (§0, X-1 to X-12), 21 (§0);
  `docs/DESIGN.md` §4, §4.1, §4.8, §5.
- Viewed: `baseline/README.md` and frames `02-home-files-1440`, `03-read-390`,
  `04-edit-write-1440`, `12-arrange-1440`.
- Code, cited parts: `apps/web/src/state/ui-store.ts`, `viewer/tool-store.ts`,
  `viewer/hit-order.ts`, `state/edit-policy-store.ts`, `annotations/tools.ts`; reference
  counts by `grep -c` over `apps/web/src`.
