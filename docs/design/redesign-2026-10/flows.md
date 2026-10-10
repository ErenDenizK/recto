---
title: "M9 flows: the interaction model and target flows"
date: 2026-10-04
status: proposed
---

> Wave 2 of the M9 redesign. This file turns the lead's fourteen binding decisions of
> 2026-10-04 into the one interaction model M9 builds: Proposal A's model, the owner judge's
> surface graft from Proposal C, and named parts of B and C. Inputs: the three proposals in
> [`proposals/`](proposals/), the judges' verdicts (build: A 53, C 40, B 31; owner: C 53, A 51,
> B 46; power: A 55, C 51, B 45), [`language.md`](language.md), [`current-flows.md`](current-flows.md)
> (J1–J16, F-1…F-15, FL-R1…FL-R10), [`inventory.md`](inventory.md) (INV-*), the baseline frames and
> research 15–22. Code facts are from `develop` at `0ac4506`. No web search was used.
> **(judgement)** marks claims that rest on the author's judgement. Step counts follow
> `current-flows.md` §1 and apply every correction the judges reported (§8.3).

*Changelog, 2026-10-04 (later):* applied the lines of `docs/specs/redesign.md` §6.16 and the
departures of its §6.17: "Contents" for the outline (X27); Save allowed while locked (0032.3);
right-click on an image opens the page menu's image group and "Extract" becomes "Save image"
(04.3, 04.6); Redo folds below 336 px (01.8); no tablet throw or side dock in M9 (03.Q3); one
unapplied-marks ask (07.10); the placement rows for in-page editors, New signature and Batch
(05.13, 07.5) and short viewports; the F6 order (X9), Compare keys (06.23), Library keys (02.12)
and Alt+arrows in caret mode (05.4); J16 keyboard ≈5 (07.16); five drops, D0–D4; the ADR mapping
in §14.

# M9 flows: one interaction model

## 0. Summary

- **A document opens in viewing:** page first, not locked. Acts aimed at something work with
  no mode: fill a field, act on a text selection, use the page menu, drag a thumbnail (RA-3).
- **One creation state, Markup,** opened by the dock's labelled Markup or M (2 stays an alias),
  always with Select armed. P arms the last pen; a tool key or palette tool arms its tool in
  one press; Done or the Esc ladder closes it. The Read · Edit · Arrange control is retired.
- **Page-first glass.** A slim top strip (tabs, the active title as the document menu, Find,
  Undo, Redo, Save, privacy) and a labelled floating dock: Pages · Markup · Fill & sign · More
  (phones: Pages · Markup · Sign · More and the page pill). The dock morphs on one glass shape
  into the Markup palette (Done at its leading end), the Pages bar and the Compare bar. Fill &
  sign opens the same palette on its Sign set.
- **Protection without a mode.** Page text changes only through Edit text; a double-click opens
  the editor only in Markup with Select. The pen writes only in Markup by default; fingers draw
  only with Draw with finger; single keys on a selection only make reversible marks; E needs
  Enter. One guard, `canChange(id, act)`, fails closed, and `commit()` refuses any change to a
  locked document. Whether documents open locked is the key owner question (§15).
- **Pages.** Arrange becomes the Pages grid, a 240 ms zoom View Transition away (dock Pages, 3,
  ⊞, pinch or Mod+wheel below fit). Thumbnails drag in the sidebar; a navigating click never
  selects. Combine creates the document at once and shows it in the grid. Compare stays a
  full-screen place.
- **Nothing is lost.** Save in place on Chromium after one Replace; Save a copy… for every other
  output; OPFS snapshots within 2 s, restored on launch with a 20-step history tail; Undo and
  Redo on every width; a toast with Undo for every removal and failure.
- **Removed:** the inspector, the status bar and the navigator rail, replaced by one sidebar
  (Pages/Contents · Find · Review), a persistent page pill and one Settings sheet.
- **Steps.** Mouse over 19 job rows: about 91 today, 68 here (−25 %). Touch: about 99 with no
  page move, 72 with every job possible. Keyboard: gaps J5 and J8A close; the 16 rows with a
  path today fall from about 121 to 81 (−33 %). Seven ADRs (§14), ten asks of `language.md`
  (§13.2), three owner questions (§15).

## 1. The model

### 1.1 In one paragraph

Recto shows the page and gets out of the way. Anything a person aims at works where they find
it: click a field and type, select a sentence and comment on it, right-click a page and rotate
it, drag a thumbnail to move it. Free-form work, where the pointer itself makes the mark,
starts with one labelled control, Markup, and ends with Done; between the two, one glass
palette holds every creation tool and opens with Select armed. Page text changes only when the
person asks for Edit text. A document can be locked, and a signed one locks itself. Every
change is one step in a visible Undo, and the work is kept on the device until it is saved.

### 1.2 Principles

1. **Aim, then act.** A change needs a chosen target (field, selection, page, object, a point
   named by "Add … here") or Markup. A pointer that only lands changes nothing.
2. **One creation state, named and closable.** Markup is pressed or not (`aria-pressed`); Done
   leads the palette; Esc disarms, then closes.
3. **Page text has doors, not a lock:** Edit text (selection bar, page menu, palette), E then
   Enter, a double-click inside Markup with Select.
4. **Honest depth.** One key from viewing for every tool; by pointer, Markup then the tool (2),
   or 3 behind + (nine tools on phones). Options show on arming (FL-R2).
5. **Nothing is lost:** kept on the device within 2 s, Undo always visible (FL-R3, FL-R4).
6. **Glass floats, the page stays clear** at fit and after every jump (RA-15, `language.md`
   §2.10).
7. **One model at every size:** the size class moves surfaces, never meanings (M-1, M-12).

### 1.3 Where each part comes from

| Part | Source | Judges |
|---|---|---|
| Viewing with targeted acts; Markup; Lock with reasons; "Open documents locked"; S1–S14 | A | Build and power winner; "the cheapest migration and the most reversible" (build) |
| Top strip, title menu, labelled dock that morphs, Library launcher | C | Owner: A's reading screen "has no floating glass and no light on desktop" |
| Fill & sign as a second door into one palette; grouped palette with + | Owner blend, C | Collapses C's eight tasks; replaces A's 940 px row |
| Markup opens on Select, P arms the last pen; E then Enter | Power | A's J6 contradiction (all three); the hazard all proposals shared |
| Double-click editor only in Markup with Select | A, owner's M8 ask | Power would drop it; kept and stated (§3.2) |
| `canChange(id, act)`, Lock in `commit()`; "Add … here" as a `place` act | C, build | Page operations, furniture, OCR and crop unguarded today; C's unwritten exception |
| Pending-marks bar; Combine into the grid; History scrubber; Revert; Undo and Redo everywhere; Recents snapshots | B | All three |
| Facts chip; teaching sample; A-12 hide-on-scroll rule; empty ⌘K lists capabilities | C | All three |
| Pinch or Mod+wheel below fit with a detent | B | Owner's "signature motion"; here a 240 ms transition, not scrubbed |
| Compare as a place, not a tab | Lead | Build: tabs derive from `workspace.documentOrder` |

Rejected: B's idle pen writing by default, hold-still-to-select, the 1–3/G/S remap, four-finger
Focus, title swipes, undo gestures while reading; C's eight tasks, scrolling phone bar, F7,
Mod+Enter as Apply, `\`; A's comparison tab, 940 px row, fading pill and Info panel.

## 2. Information architecture and state

### 2.1 Places and surfaces

| | What it is | Reached by | Left by |
|---|---|---|---|
| **Library** (place; code `home`) | Launcher, open documents as cards, Recents with snapshots, Batch | ◆, `0`, "‹ N" on phones, closing the last document, first launch | A card, a tab, a Recents row, Open |
| **Document** (place) | One open PDF in viewing | A tab, a card, a Recents row, opening one file | Another tab, ◆, `0` |
| Markup (surface) | The palette; tools arm | Dock Markup, Fill & sign or Sign; M; 2; a tool key; "Mark area" | Done, Esc Esc, `1`, M |
| Pages grid (surface) | The document's pages, or every open document as sections | Dock Pages, `3`, ⊞ in the sidebar, pinch or Mod+wheel below fit, Library selection → Pages, a Combine result | Done, Esc, `3`, double-click or Enter on a page, pinch out on a cell |
| Sidebar (surface) | Pages/Contents · Find · Review ("Contents" for the file's outline, spec X27) | ▤, Mod+B, "All results" in Find | ▤, Mod+B |
| **Compare** (place) | Two documents side by side or overlaid, Changes, its own bars | Library (2 selected) → Compare; More or title menu → Compare with…; `4` | Close or Esc, back to where it came from |
| Settings (sheet) | One sheet (§9.5) | More → Settings…, Library ⋯, ⌘K | Esc, ✕ |
| About page | `/recto/about/`, outside the app | Settings → About Recto | Browser back |

### 2.2 Map

```
 launch ── restores the last session ("Restored 3 documents · Start fresh")
   │
   ▼
 LIBRARY ── card · Recent · Open · drop ──────────▶ DOCUMENT (viewing)
  ▲  │                                              │   ▲      │   ▲
  │  │   ◆ · 0 · ‹ N · last document closed ◀───────┘   │      │   │ Done · Esc · 3 ·
  │  │                                M · 2 · tool key  │      │   │ double-click a page
  │  │                       Fill & sign · Mark area    │      ▼   │
  │  │                                     ▼            │   Pages grid (zoom transition)
  │  │                     Markup palette (dock morphs) ┘
  │  │                     Done · Esc Esc · 1
  │  ├── 2 selected · Combine ──▶ new DOCUMENT, shown in its Pages grid
  │  └── 2 selected · Compare ──▶ COMPARE ◀── 4 · Compare with… ── DOCUMENT
  └──────────────────────────── Close · Esc ──┘
```

### 2.3 Documents and tabs

- **Tabs** from 600 px. `documentOrder` stays the only order: tabs, Library cards and the
  Combine order are one list, reordered by drag (INV-19). ● marks changes not yet in the file
  (kept on the device); a glyph names the lock reason; a seal marks a signed file.
- **The active title is the document menu** (RA-9): a click on the active tab (▾) opens the
  title menu (§4.6), headed like the macOS title popover (judgement): thumbnail, editable name,
  "12 pages · 2.4 MB · Edited, kept on this device", the facts, the **Lock** switch, the
  privacy line.
- **Phones:** "‹ N" returns to the Library, which lists open documents first; no swipe between
  documents (M-22). Mod+1…9 and Ctrl+Tab work only in the installed app; ⌘K "Switch to…"
  everywhere. Closing asks nothing: "Closed report.pdf · changes kept · Reopen".
- **Compare is not a tab.** Tabs derive from `workspace.documentOrder`, owned by the document
  model, history and serialisation; a comparison is a UI session (build judge). While one
  lives, More offers "Return to comparison".

### 2.4 State in code

Today `state/ui-store.ts` holds `destination: 'home' | 'document'`, a global `viewMode: 'read' |
'arrange' | 'compare'`, a per-document `documentMode: 'read' | 'edit'`, `lastView` and
`canEdit(id)`, true only in Edit. Re-checked counts (the build judge's corrections): `viewMode`
85 references in 37 files; `documentMode*` 48 in 17; `canEdit*` 49 in 14 (34 lines in 11 source
files outside tests).

```ts
// state/ui-store.ts
type Destination = 'home' | 'document' | 'compare'; // 'compare' leaves viewMode
type Surface = 'page' | 'grid';                      // replaces 'read' | 'arrange' and lastView
interface DocumentUi {
  surface: Surface;                // kept in the session snapshot
  markup: boolean;                 // false on open; never restored on launch
  paletteSet: 'draw' | 'sign';     // the compact row; the last door; session only
}
docUi: Readonly<Record<DocumentId, DocumentUi>>;
gridScope: 'document' | 'all';     // per device
chromeHidden: boolean;             // compact hide-on-scroll; false while focus is in chrome
// state/lock-store.ts (new; read by ui-store and workspace-store, no import cycle)
locks: Readonly<Record<DocumentId, 'user' | 'signed' | 'restricted' | 'default'>>;
// state/guard.ts (new): the single fail-closed API
type Act = 'targeted' | 'freehand' | 'place' | 'text' | 'pages' | 'document';
function canChange(id: DocumentId | null | undefined, act: Act): boolean; // + useCanChange
// state/input-policy-store.ts (today's edit-policy-store): penDrawsInMarkup ('auto' turns on
// at the first pen, M8), penWritesWithoutMarkup (false), drawWithFinger ('auto', M-25),
// openDocumentsLocked (owner question 1), keepToolsVisible (compact)
```

| Today | M9 |
|---|---|
| `viewMode === 'read'` (22 comparison sites) | `isPageView()`: `destination === 'document' && surface === 'page'` |
| `viewMode === 'arrange'` · `'compare'` | `docUi[id].surface === 'grid'` · `destination === 'compare'` |
| `documentModeOf(s, id) === 'edit'` where tools arm | `docUi[id].markup` |
| `canEdit(id)` where the document changes | `canChange(id, act)` with the site's act |
| `setDocumentMode(id, 'edit' \| 'read')` · `lastView` | `openMarkup(id, set)` / `closeMarkup(id)` · `docUi[id].surface` |
| `tool-store` arms only in Edit | Arms a tool other than Select only when `canChange(id, 'freehand')`; `activateTool` opens Markup first, as it enters Edit today |
| `penDrawsInEdit`; `rightPanelOpen`; navigator `'files'`, `'changes'` | `penDrawsInMarkup` (migrated once); removed; Changes lives in Compare |

Estimate: 3–4 days of mechanical change plus tests **(judgement)**; the e2e helper `enterEdit`
keeps working through `2`.

### 2.5 The guard: `canChange(id, act)`

| Act | What it covers | Allowed (not locked) | Examples |
|---|---|---|---|
| `targeted` | A change aimed at an object the person chose | Always | Type in a field, toggle a checkbox; Highlight, Comment, Underline, Strikeout or Redact a selection; move, restyle or delete a selected annotation |
| `freehand` | The pointer itself creates | Only while `markup` is true | Pen, Highlighter stroke, shapes, Eraser, lasso move, Redact drag |
| `place` | An object at a point the person named | Always with a point from "Add … here" or keyboard placement; otherwise only in Markup | Add note, text, signature, image or stamp here; a placing tool's click in Markup; Add field |
| `text` | The paragraph editor commits | Always; the doors are input rules (§3) | Edit text; E then Enter; double-click in Markup |
| `pages` | Page structure | Always, on an explicit selection or the page pointed at | Move, rotate, delete, insert, duplicate, crop |
| `document` | Whole-document operations | Always | Page numbers, Bates, watermark, OCR, Apply redactions, metadata, password, rename (spec X12) |

1. `canChange` returns false for an unknown document or act, and for any act on a locked
   document. Every committing command declares its `act` in the registry; a unit test fails
   when one does not. The same answers dim what cannot run, with the reason (RA-21).
2. **Lock is enforced in one place.** Every mutation passes `commit()` in
   `state/workspace-store.ts` (`applyOperation`, `applyComposed`, `applyEngineEdit`, the page
   operations). `commit()` refuses the next workspace when a locked document changed: its
   `documents[id]` reference differs (structural sharing makes this a pointer check) or a new
   engine edit touches a source page a locked document shows. It returns false, opens the Lock
   popover at the control that asked, and in development logs the call site, so a missed path
   fails closed and loudly. This covers the page operations, furniture, OCR and crop that
   `canEdit` misses today (build judge).
3. Engine edits run in the PDFium worker before `applyEngineEdit` records them, so the edit
   runner asks `canChange` first and replays the inverse it holds if `commit()` still refuses.
   A test drives every act against a locked document and asserts unchanged engine bytes.
4. Undo, Redo and History jumps bypass `commit()` and stay allowed while locked (ADR-0019 §3).

### 2.6 Lock

- **Reasons:** `user` (the Lock switch, ⌘K); `signed` (any change would break a digital
  signature; opens locked; unlocking warns once); `restricted` (the file forbids changes:
  "Restricted by the file · Unlock anyway" with an honesty line); `default` ("Open documents
  locked", which restores ADR-0019 and is stricter, since page structure locks too).
- **Blocks** every act of §2.5. **Keeps** reading, Find, copy, links, Review, looking at the Pages
  grid and Extract to a new document, Save (it writes the document unchanged; spec 0032.3), Save a
  copy, Compare, Undo and Redo.
- **Shown by glyph and word, never by tint** (A-19): the tab glyph, the title-menu switch, and
  the dock, where Markup and Fill & sign morph into one **Locked** button that opens the Unlock
  popover; a locked field shows "Locked · Unlock". No single key (judgement). Kept per document
  in the snapshot.

## 3. Protection against accidental edits

### 3.1 Input rules

| Input | Viewing | Markup, Select armed | Markup, a tool armed | Locked |
|---|---|---|---|---|
| Click on page text | Clears the selection | Same | Draws or places; ink never hit-tests text; a click under 2 px and 200 ms leaves no ink (B's L4) | As viewing |
| Drag over text | Selects; the selection bar appears; nothing changes yet | Same | Draws (Redact marks text or an area) | Selects; the bar offers Copy and Unlock |
| Double-click on text | Selects the word | Opens the paragraph editor at the point; nothing changes until a key | The tool acts | Selects the word |
| Hover on text for 400 ms | Nothing | Run outline in `--select` and a one-time hint | Nothing | Nothing |
| Click a form field | Focus; typing fills; a checkbox toggles; Esc restores the value while focus is inside | Same | The tool wins (hit order) | Focus ring and "Locked · Unlock" |
| Click an annotation | Selects it and shows its bar; a drag moves only one already selected | Same | Draws over it | Opens its comment, read-only |
| Right-click or long press on a page | Page menu (§4.5) | Same | Same | Same menu, change items dimmed, Unlock first |
| Direct pen on the page | Acts as a mouse: selects text, never marks | Writes with the last pen once a pen has been seen (M8 rule) | The armed tool | As a mouse |
| Pen eraser end · barrel button | Nothing | Temporary Eraser · Lasso | Same | Nothing |
| One finger | Scrolls; a long press selects a word or opens the page sheet | Scrolls | Draws if Draw with finger is on (default until a pen is seen), else scrolls | Scrolls |
| Two fingers | Pan and zoom; a pinch below fit opens the grid | Pan, zoom | Pan, zoom | Pan, zoom |
| Two- or three-finger tap | Nothing | Undo or Redo (M-17) | Same | Nothing |
| Tool key (§7.2) | Opens Markup and arms the tool, announced; nothing changes until the first stroke | Arms | Arms | Unlock popover at the Locked button |
| H U S C X on a text selection | Highlight, Underline, Strikeout, Comment, Redact mark: one press, one undo step | Same | — | Unlock popover |
| E on a text selection | Outlines the paragraph: "Enter to edit · Esc"; Enter opens the editor with the selection carried in; any other key cancels and then acts as usual | Same | — | Unlock popover |
| Delete | Acts only on a visible selection in the focused region; toast with Undo | Same | Same | Unlock popover |
| Esc | Clears the selection | Closes Markup | Disarms to Select | As viewing |

"A pen has been seen" means `pointerType === 'pen'` with `maxTouchPoints > 0` (M-24); a desktop
drawing tablet never changes what fingers do.

### 3.2 The double-click asymmetry, stated openly

In viewing a double-click on text selects a word; in Markup with Select armed it opens the
paragraph editor: the only gesture whose meaning depends on state (power judge). It stays
because the owner's M8 ask was "click a text and type" (ADR-0019 rejected tool-only editing for
that reason) and because the risky case, a reader double-clicking to copy a word, happens in
viewing, where it is harmless. Inside Markup the person has chosen to change the document: the
cursor turns to a text cursor, the 400 ms outline shows which run will open, and the editor
changes nothing until a key (Esc leaves with no history entry). In viewing Edit text is one
press after the double-click, so J9 costs 4 either way. S3 and S4 are in the five-person test.

### 3.3 Keys on a selection, and E then Enter

Single letters on a selection make only marks that can be taken back: H, U, S, C, X (a
redaction mark waits for Apply). E only outlines the paragraph; Enter, a click or Edit text
opens the editor, and any other key cancels and then acts as usual. Typing "every" over a
selection by mistake opens Markup with Rectangle armed and changes no text. Letters never fire
while focus is in a text field (C).

### 3.4 Pen, finger, mouse and keyboard

- **Pen.** Writes only inside Markup by default; the first pen touch in viewing shows one hint
  at the dock: "Writing? Tap Markup, or let the pen write anywhere in Settings." With "Pen
  writes without Markup" (off by default) a stroke in viewing writes and opens Markup as a
  preset strip (RA-2's auto-minimise); Lock still wins.
- **Mouse.** In viewing nothing reacts to hover on text (inventory 9.4's outline and hint go);
  in Markup with Select they return, because a double-click there edits.
- **Keyboard** (FL-R9). Enter on a focused page starts caret mode (arrows, Shift+arrows select,
  Esc leaves). Alt+Enter in Find turns the hit into a selection **and moves focus to the
  page**, so the next key acts on it (the judges' J5 gap). With a placing tool armed, Enter
  places at the visible centre of the focused page; arrows nudge 1 pt, Shift+arrows 10 pt;
  Enter commits.

### 3.5 Stress test against the owner's M8 wish

The wish (ADR-0019): "a pen or a stray click never edits page text by accident", and a lock.

| # | Accident | Today (ADR-0019 Read) | M9, unlocked (recommended) | M9, locked |
|---|---|---|---|---|
| S1 | A pen tip rests on the page while reading on a tablet | Selects text | Selects text; the pen writes only in Markup | Selects text |
| S2 | A stray click on body text | Nothing | Nothing | Nothing |
| S3 | A double-click on a word to copy it | Selects the word | Selects the word | Selects the word |
| S4 | A pen double-tap on text inside Markup | Draws | Draws; ink never hit-tests text | — |
| S5 | A mouse drag across text while scrolling | Selection | Selection; nothing changes until an action | Selection |
| S6 | A click on a text field | Notice | Focus only; Esc restores the value | Notice with Unlock |
| S7 | A click on a checkbox | Notice | **Toggles**: one undo step, visible | Notice |
| S8 | Right-click → Delete page by mistake | Not offered | **Deletes**; "Deleted page 7 · Undo" for 10 s | Dimmed |
| S9 | A letter typed while focus is on the page | Switches to Edit and arms | No selection: opens Markup and arms, no change. **With a selection, H U S C X act**: one undo step | Popover |
| S10 | Delete after clicking a thumbnail to navigate | **Deletes the page, even in Read** (INV-3) | Nothing: a navigating click never selects | Popover |
| S11 | A finger lands on the page on a phone | Scroll | Scroll | Scroll |
| S12 | A two-finger tap while reading | Nothing | Nothing; undo gestures live only in Markup | Nothing |
| S13 | A touch drag on the sidebar meant to scroll it | — | Scrolls; reordering needs a 450 ms lift (M-20) | No reorder |
| S14 | A drag that starts on an unselected annotation | Nothing | Nothing moves; the first press selects | Nothing |
| S15 | E and more letters typed over a selection | Switches to Edit, arms | E outlines; the next letters cancel and arm tools; page text unchanged | Popover |
| S16 | Redaction marks made and forgotten | Kept as marks, easy to miss | The pending-marks bar stays until Apply or Clear; Save names unapplied marks | — |
| S17 | Page menu → "Add note here" by mistake | Not offered | **Adds a note**: one undo step, toast | Dimmed |
| S18 | Shift+R pressed while reading | Rotates a page selected in the navigator | **Rotates the current page**; "Rotated page 3 · Undo" | Popover |

**Verdict.** Stricter than today for page text (S2–S4, S15), equal for the pen (S1); five
deliberate acts (S7, S8, S9, S17, S18) become one visible, undoable step; today's hole closes
(S10). With "Open documents locked" every row equals the right-hand column, ADR-0019's Read
without its Arrange exception. Test S7 and S9 with five people reading a form **(judgement)**.

## 4. Tool access

### 4.1 Routes

Targeted acts (field, selection bar, annotation bar, page menu, thumbnails) · the dock · the
Markup palette · the title menu, page pill and Library · ⌘K, with the selection's actions first
(RA-22), arguments (`go 42`, `rotate 3-5 90`, `move 5 before 2`, `delete 7`, `lock`, `switch to
agreement`) and, when opened empty, a list of what Recto can do · keys (§7.2).

### 4.2 The dock

- Viewing only, every size: one M2 capsule at the bottom centre of the free rectangle, 16 px
  up (`max(safe-area, 12px)` on phones); 48 px fine, 56 px coarse, 64 px on phones with labels
  under icons. Always labelled (RA-20).
- Desktop and tablet **Pages · Markup · Fill & sign · More**; phone **Pages · Markup · Sign ·
  More** with the page pill as its trailing segment.
- **Pages** opens the grid. **Markup** opens the palette on its Draw set. **Fill & sign** opens
  it on its Sign set: Select armed, saved signatures inline, the field stepper when the file
  has fields. **More** (a sheet with search on phones): Edit text, Redact, Recognize text…,
  Compare with…, Add to pages ▸, Crop pages…, Return to comparison, All commands…, Keyboard
  shortcuts, Settings….
- The same glass shape morphs into the palette, the Pages bar, the Compare bar and the Locked
  state (Pages · Locked · More).

### 4.3 The Markup palette

One capsule; **Done** (check and word; the check alone on phones) at its leading end.

| Group | Tools |
|---|---|
| Select | ↖ (V), armed when Markup opens |
| Draw | Pens 1–3 (P; again: next pen), Highlighter (H), Eraser (Shift+E), Lasso (Q) |
| Options | The armed tool's colour and width inline; full editor on a second press or ⋯; a tier above the palette on compact and medium |
| Add | Shapes ▾ (R O L A, shows the last), Text box (T), Note (N), Image (I), Stamp ▾ (Shift+I) |
| Fill & sign | Sign ▾ (G: saved signatures, New…, Certificate…), stepper ‹ n/N › (with fields), Add field ▾, Show field outlines |
| Page content | Edit text ¶ (E), Redact ▮ (X; text or areas) |
| + | Whatever is folded at this width, by group; shows the armed tool's glyph when it lives there |

Folding order: Stamp, Image, Add field, Show outlines; then Redact, Edit text, Note, Shapes,
Lasso. **xlarge** shows every group with labels (+ keeps Image, Stamp, Add field, Find sensitive
data…, Certificate…; about 900 px, judgement). **large**: Done · ↖ · ●●● ▬ · options · ⌫ ◌ ·
▭▾ T □ · Sign ▾ ‹n/N› · ¶ Edit text · ▮ · + (about 800 px). **expanded**: labels only on Done and
Sign; Edit text and Redact in +. **medium**: Done · ↖ · ●●● ▬ · ⌫ ◌ · ▭▾ T □ · Sign ▾ · +, tier
above. **compact**: two fixed sets of 44 px targets in a 360 px capsule, one per door: **Draw**
✓ · ↖ · ●●● · ▬ · ⌫ · +; **Sign** ✓ · ↖ · last signature ▾ · T · ‹n/N› · + (T folds below
380 px). The + sheet lists every tool; arming one of the other set swaps the row, only because
the person chose it. Nine tools are therefore 3 deep on phones, and counted so. On medium and
up both sets share one row; the Fill & sign door focuses Sign and opens its saved signatures
inline as chips (up to three, the rest in Sign ▾; judgement on the number).
**compact-height**: a 64 px trailing rail, Done on top, movable and remembered (M-8).

**Behaviour.** Opens with Select; P arms the last pen; a tool key arms from viewing in one
press. The armed tool is filled (I-2), with the lime under-light beneath it in the dark theme
(AU-10). Placing tools (Text box, Note, Image, Stamp, Sign) return to Select after one use;
drawing tools stay armed. Esc disarms, a second Esc closes, Done closes from any state. During a
stroke the palette fades to 20 % for 1 s, never with focus inside (MC-38, A-13). Markup is per
document, lasts the session, never restores on launch. The grid hides the palette; its Done
returns to the state that was left. The palette stays at the bottom centre (no free drag, C) on
desktops and tablets alike in M9; the tablet throw to a side dock (RA-2, B) and "Move tool bar to
▸" are M10 candidates (spec 03.Q3); the compact-height rail is the one side placement.

### 4.4 Contextual bars and the pending-marks bar

| Bar | Shows when | Actions |
|---|---|---|
| Text selection | A text selection, in viewing or Markup | Copy · Highlight ▾ (four tints on long press or right-click) · Comment (one Highlight with its note open, RA-6) · Redact · Edit text · ⋯ (Underline, Strikeout, Squiggly, Find all, Copy as Markdown) |
| Annotation | An annotation selected | Colour · width or size · Comment · Delete · ⋯ (opacity, font, author, dates) |
| Lasso | A lasso selection | As today (DESIGN §4.1), plus a rotate grip |
| Page image | An image selected: from the page menu's image group (right-click on an image opens the page menu, since a scanned page is one image; spec 04.3), or Image armed and an image clicked | Replace… · Save image (spec 04.6) · Delete · size (pt, px, dpi) |
| Pages | Pages selected in the grid, or explicitly in the sidebar (Shift- or Mod-click) | N selected · ↺ ↻ · ‹ › (move by one, INV-R8) · Delete · Extract · Duplicate · Move to ▾ · ⋯ (Insert blank after, Crop…, Copy, Paste after) |
| Created field | A created form field selected | Kind · name · Required · ⋯ (properties) |
| **Pending marks** | The active document has unapplied redaction marks, in viewing and in Markup | "2 marks · Mark area · Apply" · ⋯ (Review marks, Find sensitive data…, Clear marks); above the dock or palette; on compact inside the dock's glass |
| Form accessory | A field focused with the virtual keyboard (coarse) | ‹ › next field · Clear · Done, above the keyboard (M-28) |

Apply opens a confirmation ("Apply 2 redactions? The text and images under them are removed
from the saved file.") and ends in a toast, "2 areas redacted · Undo · Details"; it disarms the
Redact tool to Select. The first Save after applying says "Saved · 2 areas removed for good ·
verified". The inspector's Properties go; their controls live in the bar's ⋯ (INV-13).

### 4.5 The page menu

Static (RA-21); an action sheet from a long press on paper on phones.

```
Add note here                  N   │ Rotate page left · right    Shift+Alt+R · Shift+R
Add text here                  T   │ Delete page                 Delete
Add signature here           ▸ G   │ Crop page…
Add image here…                I   │ Insert blank page after
Add stamp here               ▸ ⇧I  │ Insert pages from file…
Edit text here                     │ Extract page…   Copy page   Paste pages after
Recognize text on this page        │ Show in Pages grid          3
```

"Add … here" is the explicit `place` act of §2.5: the pressed point is the target, so it needs
no Markup. When locked, the change items are dimmed with the reason and "Unlock document" heads
the menu.

### 4.6 Title menu, page pill and Library

- **Title menu** (static): the §2.3 header; **File** Save · Save a copy… · Print… · Share…
  (coarse) · Revert to the opened version… · Close; **Pages** Insert pages from file… · Combine
  with open documents… · Split… · Interleave… · Rotate all ▸ · Crop pages… · Resize pages…;
  **Add to pages** Page numbers… · Header and footer… · Bates numbering… · Watermark…;
  **Protect** Password… · Sign with certificate… · Signatures… · Find sensitive data… · Apply
  redactions… · Remove metadata…; **Convert** Recognize text… · Compress… · Export as images… ·
  Export as Markdown or text…; then Compare with… · Document info…. Remove actions live inside
  their sheets (RA-21).
- **Page pill** (M1, persistent, focusable, in the F6 cycle): "3 / 12 · 96 %"; opens Go to page,
  the top-level entries of Contents (up to 8, then All contents…), Fit width · Fit page · zoom,
  Continuous · Single · Two-up, Show field outlines, Focus. Mod+G opens it. It replaces the
  status bar's page and zoom (3.14, 3.15) and the layout switch (3.11).
- **Library:** Open PDFs…, Try the sample, Combine files…, Batch…; selection bar N selected ·
  Combine · Compare (exactly two) · Pages · Close.

### 4.7 Every tool and command: placement and depth

Depth = presses from viewing until the tool is armed or its sheet open ("sel. + n": after a
selection; pickers and typed values uncounted). Desktop is large, phone compact.

| Tool or command | Without Markup | In Markup (large) | Key | Phone route | Depth desktop / phone | Options |
|---|---|---|---|---|---|---|
| Select | — | ↖, armed on opening | V | Markup | 1 / 1 | — |
| Pens (3 presets) | — (or the pen, opt-in) | ● ● ● | P; P again: next | Markup → ● | 2 / 2 | Inline; tier on phones |
| Highlighter | sel. + Highlight | ▬ | H | sel. + Highlight; Markup → ▬ | sel. + 1, or 2 / same | Four tints, 6–18 pt |
| Eraser | Pen eraser end in Markup | ⌫ | Shift+E | Markup → ⌫ | 2 / 2 | Stroke · Partial, size |
| Lasso | Pen barrel button in Markup | ◌ | Q | Markup → + → Lasso | 2 / 3 | Lasso bar |
| Shapes (4) | — | ▭ ▾ (last shape) | R O L A | Markup → + → Shapes | 2 (+1 kind) / 3 (+1) | Stroke, width; fill in ⋯ |
| Text box | Page menu → Add text here | T | T | Long press → Add text here; Markup → + → Text | 2 / 2 (3 by +) | Size, colour |
| Note | Page menu → Add note here | □ | N | Long press → Add note here; Markup → + → Note | 2 / 2 (3 by +) | Note popup |
| Comment on text | sel. + Comment | Same | C on sel. | sel. + Comment | sel. + 1 | Note editor at the line end |
| Underline, Strikeout, Squiggly | sel. + ⋯ + kind | Same | U, S on sel. | Same | sel. + 2 (+1 by key) | Annotation bar |
| Image (add) | Page menu → Add image here… | + → Image | I | Markup → + → Image | 2 by page menu, 3 by + / 3 | Image bar |
| Page images (replace, save) | Right-click the image → image group | + → Image, click it | I | Long press the image | 2 / 2 | Image bar |
| Stamp | Page menu → Add stamp here ▸ kind | + → Stamp ▸ kind | Shift+I (last stamp) | Long press → Add stamp ▸ kind | 3 / 3 | Annotation bar |
| Signature (saved) | Dock Fill & sign → chip; a signature field → pick; page menu → Add signature here ▸ | Sign ▾ | G | Dock Sign → chip | 2 / 2 | Annotation bar |
| Fill a field | Click the field | Same | Tab | Tap the field | 0 / 0 | Accessory bar on touch |
| Field stepper | Dock Fill & sign | ‹ n/N › | Tab | Dock Sign | 1 / 1 | — |
| Create fields | — | + → Add field ▸ kind | — | Sign → + → Add field → kind | 3 / 4 | Field bar, properties |
| Show field outlines | Page pill → Show field outlines | Fill & sign group | — | Pill → Show field outlines | 2 / 2 | — |
| Edit text | sel. + Edit text; page menu → Edit text here | ¶ | E, then Enter on sel.; E alone arms ¶ | sel. + Edit text | sel. + 1 / same | Editor header (ADR-0020) |
| Redact text | sel. + Redact | Same | X on sel. | sel. + Redact | sel. + 1 | Pending-marks bar |
| Redact area | Pending bar → Mark area; More → Redact | ▮ | X | Pending bar → Mark area; Markup → + → Redact | 2 / 2 (3 by +) | Pending-marks bar |
| Find sensitive data | Title → Find sensitive data… | Pending bar ⋯ | ⌘K | Title → Find sensitive data… | 2 / 2 | Sheet |
| Apply redactions | Pending bar → Apply | Same | ⌘K "apply" | Pending bar → Apply | 1 + confirm | Confirmation |
| Rotate page | Page menu; Pages bar | — | Shift+R, Shift+Alt+R | Long press → Rotate; grid bar | 2 / 2 | — |
| Delete, insert, duplicate, extract | Page menu; Pages bar | — | Delete, Mod+D, Mod+Shift+E | Long press; grid bar | 2 / 2 | Sheets for insert, extract |
| Move pages | Drag in the sidebar or grid; Pages bar ‹ ›, Move to ▾ | — | Alt+arrows; ⌘K `move` | Pages → long-press drag | 1 (sidebar open) / 2 | — |
| Split, interleave, resize, insert images | Title → Pages → item; grid bar ⋯ | — | ⌘K | Title → item | 2 / 2 | Sheets |
| Crop | Page menu → Crop page…; title → Crop pages… | — | ⌘K | Long press → Crop page… | 2 / 2 | Crop sheet |
| Combine | Library selection → Combine; title → Combine with open documents… | — | ⌘K | Library: long press a card, tap, Combine | sel. + 1 / 3 | Toast with Undo |
| OCR | Facts chip → Recognize; Find's empty state; title or More → Recognize text… | — | ⌘K | Chip; title | 1 + confirm while the chip shows, else 2 / same | Sheet; languages in Settings |
| Compare | Library selection → Compare; title or More → Compare with… | — | 4 | Library: long press A, tap B, Compare | 2 / 3 | Compare bar |
| Page numbers, header and footer, Bates, watermark | Title → item; More → Add to pages ▸ | — | ⌘K | Title → item | 2 / 2 | Side sheet with live preview |
| Metadata | Title → Document info… | — | ⌘K | Title → Document info… | 2 / 2 | Sheet |
| Password | Title → Password…; Save a copy → Security | — | ⌘K | Title → Password… | 2 / 2 | Sheet |
| Lock | Title-menu header switch | — | ⌘K `lock` | Title header | 2 / 2 | — |
| Certificate signature | Title → Sign with certificate…; Sign ▾ → Certificate… | Sign ▾ | ⌘K | Title | 2 / 2 | Sheet, then the save picker |
| Signature validity | Facts chip "Signed by …"; title → Signatures… | — | ⌘K | Title | 1–2 / 2 | Sheet |
| Save | Save in the top strip | Same | Mod+S | Title → Save | 1 / 2 | Replace popover once |
| Save a copy; compress; images; Markdown | Title → Save a copy… (Compress… and Export… open it preset) | — | Mod+Shift+S (Chromium), ⌘K | Title → Save a copy… | 2 / 2 | Save a copy sheet |
| Print | Title → Print… | — | Mod+P | Title → Print… | 2 / 2 | Browser dialog |
| Revert to the opened version | Title → Revert… | — | ⌘K | Title | 2 / 2 | Confirmation |
| Undo, Redo | ↶ ↷ in the top strip | Same | Mod+Z, Mod+Shift+Z, Mod+Y | ↶ ↷ in the top bar | 1 / 1 | — |
| History | Long press ↶ | Same | ⌘K `history` | Long press ↶ | 1 / 1 | Scrubber |
| Find | The Find field (an icon below 1280 px) | Same | Mod+F | ⌕ | 1 / 1 | — |
| Contents | Page pill → entry; sidebar Contents | — | Mod+G, Down | Pill → entry | 2 / 2 | — |
| Review (comments, marks, fields) | Sidebar → Review | — | Mod+B | Pages sheet → Review | 2 / 2 | — |
| Go to page, zoom, layout | Page pill | Same | Mod+G, Mod+= Mod+- Mod+0 | Pill | 1–2 / 1–2 | — |
| Pages grid | Dock Pages; sidebar ⊞; pinch below fit | Pages bar replaces the palette | 3 | Dock Pages | 1 / 1 | Grid header |
| Batch | Library → Batch… | — | ⌘K | Library ⋯ → Batch… | 1 / 2 | Batch sheet |
| Settings | More → Settings…; Library | — | Mod+, where the browser leaves it; ⌘K | More → Settings… | 2 / 2 | Sheet |
| Shortcuts | More → Keyboard shortcuts | — | ? | — | 2 / — | Overlay |
| Privacy | ◎ in the top strip (medium and up); title-menu header | — | ⌘K | Title → privacy line | 1 / 2 | Popover |

## 5. Saving, restore, undo and history

### 5.1 Save and Save a copy

- **Three kinds of kept:** on this device (an OPFS snapshot within 2 s of each history step and
  on `visibilitychange: hidden`, M-34; `persist()` asked at the first edit), in the file (Save),
  a copy (Save a copy… or Share). Nothing is uploaded.
- **Save in place** (Chromium with a kept handle; RA-14, FL-R4) writes back and verifies:
  "Saved · verified" with the success bloom (AU-12). The first save over a file asks once:
  "Replace report.pdf? · Replace · Save a copy… · ☐ Don't ask again for this file", and the
  browser's write prompt can follow once per session, so a first save costs 3 presses, later
  ones 1. Without a handle, Save opens the picker and keeps the new handle (2). Without File
  System Access (Firefox, Safari, phones) Save downloads, or opens the share sheet on iOS and
  Android (M-36); the toast says where the file went.
- **Revert to the opened version…** (title menu): the opened bytes stay in the snapshot after an
  in-place save until it expires (B).
- **Save a copy…** is the export form as one sheet: Format (PDF · Images · Markdown or text),
  then Size (presets with estimates, inline: INV-18), Security, Metadata, Flatten and Signature,
  collapsed under "Same as original". Its button opens the picker first, then assembles and
  verifies. Compress…, Export as images… and Export as Markdown… open it preset; Mod+Shift+S
  where the browser leaves it (Firefox keeps it for screenshots).

### 5.2 Snapshots and restore

- **Content:** today's `SerializedWorkspaceV1` (`packages/document-model/src/serialize.ts`), the
  source bytes as opened or last saved, the edit blobs (stamp and image appearances, signatures)
  that the workspace and the history tail refer to (ADR-0032 §2.4), and per document its page, zoom, surface, sidebar
  section and lock; never Markup. Memory keeps 200 history entries (`DEFAULT_HISTORY_LIMIT`);
  the snapshot keeps the last 20 (build judge), so Undo survives a reload for those steps.
- **Launch** reopens the last session in tab order, each document where it was: "Restored 3
  documents · Start fresh" (Start fresh closes them; their snapshots stay in Recents).
- **Recents** keep each closed document's snapshot ("Edited, changes kept"); a click reopens it
  with no prompt or picker on every browser (B). Without a snapshot, Chromium uses the kept
  handle and other browsers the picker.
- **Retention** 30 days or 500 MB, oldest first **(judgement; owner question 2)**, listed with
  Clear in the privacy popover and Settings. A private window says "Changes are not kept in
  this window". iOS may clear site storage after 7 days unvisited (established knowledge), so
  the promise reads "on this device, while the browser keeps it" and installing is suggested
  once (M-35). `beforeunload` asks only while a change is not yet in the snapshot or storage is
  not persistent.

### 5.3 Undo, Redo, History and toasts

- **↶ ↷ on every width**, phone viewing included (below 336 px ↷ folds into the title menu, A-20's
  320 px case; spec 01.8), dimmed when empty, the step in the tooltip
  ("Undo pen on page 4"); undo scrolls the change into view and flashes a ring (undo reveal).
  Two- and three-finger taps undo and redo inside Markup only (S12).
- History is one list for the workspace today. When the step to undo belongs to another open
  document, the toast names it ("Undid highlight in agreement.pdf · Show") without switching tabs
  **(judgement; per-document history is a later decision, §12)**.
- A long press or right-click on ↶ opens the **History scrubber**: times and pages on fine
  pointers, a slider on coarse ones; dragging previews, release jumps (`jumpTo`).
- **Toasts** (M2, above the dock or palette, at most three; actions held ≥ 10 s and paused on
  hover or focus, in the F6 cycle, A-24) for every removal ("Deleted page 7 · Undo", "Closed
  report.pdf · changes kept · Reopen", "Combined 2 files · Undo") and failure ("Could not open
  scan.pdf: the file is damaged"). Long jobs show a progress capsule there with the ring (AU-11).

### 5.4 Signatures, redaction and signed files

Up to five saved signatures (drawn, typed or image) on the device in IndexedDB
(`pdf-editor:signatures:v1`, RA-5), cleared in Settings, written only into the PDFs they sign.
Applied redactions are undoable in the app and final in the saved file; Save and Save a copy ask
about unapplied marks with one rule ("2 marks not applied" · **Apply and save** · Save without
applying, with "The text under 2 marks is still in the file"; spec 07.10) and name applied ones
("2 areas removed for good").
Signed files open locked; unlocking warns once that saving removes the signature; Save a copy
with Signature signs again.

## 6. Layout per size class

### 6.1 Classes and shell rules

| Class | Size (CSS px) | Top | Bottom in viewing | Sidebar | Markup | Sheets |
|---|---|---|---|---|---|---|
| compact | width < 600 | Top bar 44 + safe area: ‹ N, title ▾, ⓘ, ↶ ↷, ⌕ | Dock capsule 64 with the page pill inside | Inside the Pages sheet | Palette 64, Draw or Sign set | Bottom sheets, 40 % and 92 % (M-29) |
| compact-height | height < 480 and width < 1000 (RA-18) | Top bar 44 | Dock 44, labels beside icons, pill inside | Side sheet 360 | Vertical rail 64 | Side sheets 360 |
| medium | 600–839 | Top strip 52 coarse, 44 fine, with tabs | Dock 56; page pill as an M1 chip | Overlay 320, solid on touch (M-31) | Palette 64, tier above | Tool sheets: side sheet 360, no scrim; task sheets: form sheet ≤ 640 |
| expanded | 840–1199 | Top strip 44 / 52 | Dock 48 / 56; pill | Docked 280 | Palette 48 / 64, inline options | Side sheet 400 |
| large | 1200–1599 | Top strip 44 | Dock 48; pill | Docked 280 | Palette with labels | Side sheet 400; confirmations centred |
| xlarge | ≥ 1600 | Top strip 44 | Dock 48; pill | Docked 280 | Every group shown | As large; Compare's Changes docked |

- **Sidebar** closed by default on every size, remembered per device once changed (C). **Zoom**
  fit width, capped at 1100 px of page from xlarge (M-11). **Density** follows the pointer:
  44 px targets on coarse pointers in every class (M-2).
- **Top strip** from medium: ◆, ▤, tabs with the active title menu (▾, ●, ⓘ), +, Find (an icon
  below 1280 px), ↶ ↷, Save (a dimmed "Saved" when nothing is new, so nothing reflows), ◎. No ⋯:
  view options live in the pill, app items in More.
- **Short viewports** (height < 352 px at any width, where 88 px of chrome passes A-20's 25 %):
  the top bar folds into the dock, so one 44 px capsule holds ‹ N, title ▾, ↶ and ⋯ (More takes
  the rest); tool and task side sheets become full-width bottom sheets; the Markup rail becomes a
  horizontal palette in the same capsule. At 320 × 256 chrome is about 17 % (`01-frame` F1).
- **Hide on scroll**, compact only (compact-height counts as compact: a phone on its side), in
  viewing only (M-14 with C's A-12 safeguards): after 24 px down the top bar and dock slide away and turn `inert`; they return on
  upward scroll, a tap, either end of the file, focus, a sheet or any key; never with keyboard
  modality or focus inside, in Markup, the grid or Compare, or with "Keep tools visible".

### 6.2 The rest rule

The free rectangle leaves out the top strip and the dock band (dock plus its 16 px gap). Fit
page, the first line at fit width, go to page, find hits, outline jumps, links, undo reveals and
keyboard focus (`scroll-padding`, A-12) land inside it, and the last page scrolls clear of the
dock; an open palette or pending bar adds its height (no side-docked palette in M9, spec 03.Q3).
While scrolling, pages pass under the glass, which is when it shows. At an arbitrary stop a line
may sit under the dock: about 560 × 48 px, 2.2 % of a 1440 × 900 stage **(judgement on the
width)**, far inside `language.md` §2.9's 32 %. F (Focus) hides the dock and pill (RA-12).

Legend for the wireframes: ◆ Library · ▤ sidebar · ⌕ Find · ↶ ↷ Undo, Redo · ◎ privacy ·
ⓘ facts · ▦ Pages · ✎ Markup · ✑ Fill & sign or Sign · ⋯ More · ✓ Done · ↖ Select · ● pen
preset · ▬ Highlighter · ⌫ Eraser · ◌ Lasso · ▭ Shapes · T Text box · □ Note · ¶ Edit text ·
▮ Redact · ░ aurora · ╭╮ glass capsule.

### 6.3 Phone portrait, 390 × 844 (compact)

```
Library, first visit             Library, 3 open                  Reading (viewing)
┌──────────────────────────────┐ ┌──────────────────────────────┐ ┌──────────────────────────────┐
│ ◆ Recto              EN · TR │ │ ◆ Recto                  ◎  ⋯│ │ ‹ 3  report.pdf ▾ ⓘ  ↶ ↷  ⌕  │
│░░░░░░░░ aurora, drifting ░░░░│ │░░░░░░░░ aurora, still ░░░░░░░│ │╌╌╌╌╌╌╌╌╌╌ soft edge ╌╌╌╌╌╌╌╌╌│
│░                            ░│ │ Open · 3               Select│ │ ┌──────────────────────────┐ │
│░  Read, mark up, sign and   ░│ │ ┌──────────┐ ┌──────────┐    │ │ │ page at full width,      │ │
│░  arrange PDFs. Nothing     ░│ │ │  page 1  │ │  page 1  │    │ │ │ 8 px margins             │ │
│░  leaves this device.       ░│ │ └──────────┘ └──────────┘    │ │ │                          │ │
│░                            ░│ │ report ●     agreement       │ │ │ long press → word and    │ │
│░  Try the sample ›          ░│ │ ⓘ 12 fields  Signed, locked  │ │ │ the selection bar:       │ │
│░  Combine files…            ░│ │ ┌──────────┐                 │ │ │ Copy Highlight Comment   │ │
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ │ │  page 1  │  letter-scan    │ │ │ Redact Edit text ⋯       │ │
│                              │ │ └──────────┘  No text · 2 p  │ │ │                          │ │
│                              │ │ Recent                       │ │ │                          │ │
│                              │ │ ▤ report-v2.pdf · kept · 1 d │ │ └──────────────────────────┘ │
│ ● Files stay on this device  │ │ ▤ lease.pdf · 2 d            │ │╭───────────────────────┬────╮│
│ ╭──────────────────────────╮ │ │ ╭──────────────────────────╮ │ ││   ▦     ✎     ✑    ⋯  │3/12││
│ │    Open PDFs…  (lime)    │ │ │ │        Open PDFs…        │ │ ││ Pages Markup Sign More│96 %││
│ ╰──────────────────────────╯ │ │ ╰──────────────────────────╯ │ │╰───────────────────────┴────╯│
└──────────────────────────────┘ └──────────────────────────────┘ └──────────────────────────────┘

Markup (door: Markup)            Markup (door: Sign)              Pages sheet (the grid)
┌──────────────────────────────┐ ┌──────────────────────────────┐ ┌──────────────────────────────┐
│ ‹ 3  report.pdf ▾     ↶ ↷  ⌕ │ │ ‹ 3  form.pdf ▾       ↶ ↷  ⌕ │ │ ‹ 3  report.pdf ▾     ↶ ↷  ⌕ │
│ ┌──────────────────────────┐ │ │ ┌──────────────────────────┐ │ │╭───────────── ▬ ────────────╮│
│ │ one finger draws until a │ │ │ │ Name [Ada Lovelace     ] │ │ ││ [Pages] Outline Review   ⋯ ││
│ │ pen is seen; two fingers │ │ │ │ Date [_________________] │ │ ││ This document ▾    S ─○─ L ││
│ │ pan and zoom; two-finger │ │ │ │ ☐ I agree to the terms   │ │ ││ ┌──────┐ ┌──────┐ ┌──────┐ ││
│ │ tap undoes, three redoes │ │ │ │ Sign here ┌───────────┐  │ │ ││ │  1   │ │  2   │ │  3   │ ││
│ │                          │ │ │ │           └───────────┘  │ │ ││ └──────┘ └──────┘ └──────┘ ││
│ │                          │ │ │ └──────────────────────────┘ │ ││ ┌──────┐ ┌──────┐ ┌──────┐ ││
│ └──────────────────────────┘ │ │ field 2 of 4 scrolls above   │ ││ │  4   │ │ 5 ✓  │ │  6   │ ││
│                              │ │ the keyboard (M-4)           │ ││ └──────┘ └──────┘ └──────┘ ││
│                              │ │                              │ ││ tap selects · long press   ││
│ ╭──────────────────────────╮ │ │                              │ ││ lifts · double tap opens   ││
│ │ ● ● ● ● ● ○ ━○━ 1.5 pt ⋯ │ │ │                              │ ││ 92 % detent; 40 % peeks    ││
│ ╰──────────────────────────╯ │ │                              │ ││╭──────────────────────────╮││
│╭────────────────────────────╮│ │╭────────────────────────────╮│ │││✓│1 · ↺ ↻ · ‹ › · Delete ⋯│││
││ ✓ │ ↖ │ ● ● ● ▬ │ ⌫ │  +   ││ ││ ✓ │ ↖ │Ada L.▾│ T │‹2/4›│ +││ ││╰──────────────────────────╯││
│╰────────────────────────────╯│ │╰────────────────────────────╯│ │                              │
└──────────────────────────────┘ └──────────────────────────────┘ └──────────────────────────────┘

Compare                          Tool sheet at 40 %               Reading, scrolled
┌──────────────────────────────┐ ┌──────────────────────────────┐ ┌──────────────────────────────┐
│ ✕ Close   v1 ⇄ v2         ⋯  │ │ ‹ 3  report.pdf ▾ ⓘ  ↶ ↷  ⌕  │ │ ┌──────────────────────────┐ │
│ [   A   |   B   | Changes ]  │ │ ┌──────────────────────────┐ │ │ │ top bar and dock slid    │ │
│ ┌──────────────────────────┐ │ │ │ live preview on the page │ │ │ │ away after 24 px of      │ │
│ │ B, page 3                │ │ │ │                 "1 / 12" │ │ │ │ downward scroll; both    │ │
│ │ ▒▒▒▒▒▒ changed line      │ │ │ └──────────────────────────┘ │ │ │ are inert while hidden   │ │
│ │                          │ │ │                              │ │ │                          │ │
│ │ one page at a time       │ │ │                              │ │ │ they return on upward    │ │
│ │ (M-38); swipe is not     │ │ │                              │ │ │ scroll, a tap on the     │ │
│ │ used for A and B         │ │ │╭───────────── ▬ ────────────╮│ │ │ page, an end of the file,│ │
│ └──────────────────────────┘ │ ││ Page numbers         Apply ││ │ │ focus, or a sheet        │ │
│                              │ ││ Format  [Page 1 of N ▾]    ││ │ │                          │ │
│                              │ ││ Position  ○ ○ ○ ○ ● ○      ││ │ │ never with a keyboard in │ │
│                              │ ││ Pages     All ▾            ││ │ │ use or "Keep tools       │ │
│                              │ ││ Size      10 pt ─○─        ││ │ │ visible" on          ▐   │ │
│╭────────────────────────────╮│ ││ 40 % detent: the preview   ││ │ │                          │ │
││ ‹ change 3 of 12 › · Swap  ││ ││ stays visible above        ││ │ └──────────────────────────┘ │
│╰────────────────────────────╯│ ││                            ││ │                              │
└──────────────────────────────┘ └──────────────────────────────┘ └──────────────────────────────┘
```

The Pages grid is a sheet here (92 %, or 40 % to peek), with Outline and Review as its other
sections (A). Find opens a field above the keyboard (M-4); files over 20 pages get the trailing
scrubber while scrolling (M-15). Selection bars flip below the selection near the top bar.

### 6.4 Phone landscape, 844 × 390 (compact-height)

```
Library                                           Reading (immersive)
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ ◆ Recto                              ◎   ⋯    │ │ ‹ 3  report.pdf ▾ ⓘ             ↶ ↷  ⌕        │
│░░ Open · 3 ░░░░░░░░░░░░░░░░░░░░░░░░ Select ░  │ │        ┌─────────────────────────────┐        │
│ ┌──────┐ ┌──────┐ ┌──────┐  Recent            │ │        │ page at fit width; top bar  │        │
│ │ p 1  │ │ p 1  │ │ p 1  │  ▤ report-v2 · kept│ │        │ and pill hide on scroll     │        │
│ └──────┘ └──────┘ └──────┘  ▤ lease.pdf · 2 d │ │        └─────────────────────────────┘        │
│ report ●  agreement letter                    │ │                                               │
│            ╭────────────────────╮             │ │  ╭─────────────────────────────────────────╮  │
│            │     Open PDFs…     │             │ │  │ ▦ Pages  ✎ Markup  ✑ Sign  ⋯ More │ 3/12│  │
│            ╰────────────────────╯             │ │  ╰─────────────────────────────────────────╯  │
└───────────────────────────────────────────────┘ └───────────────────────────────────────────────┘

Markup (rail)                                     Pages grid
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ ‹ 3  report.pdf ▾          ↶ ↷  ⌕   ╭───╮     │ │ ‹ 3  report.pdf ▾  [This doc|All 3]  ↶ ↷      │
│      ┌────────────────────────┐     │ ✓ │     │ │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐     │
│      │ page; rail on the      │     │ ↖ │     │ │ │ 1  │ │ 2  │ │ 3✓ │ │ 4  │ │ 5  │ │ 6  │     │
│      │ trailing edge, 64 px;  │     │ ● │     │ │ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘     │
│      │ drag to the leading    │     │ ● │     │ │                                               │
│      │ edge, remembered (M-8) │     │ ● │     │ │                                               │
│      └────────────────────────┘     │ ▬ │     │ │  ╭─────────────────────────────────────────╮  │
│      options open beside the rail   │ + │     │ │  │   ✓ Done │ 1 · ↺ ↻ · ‹ › · Delete · ⋯   │  │
│                                     ╰───╯     │ │  ╰─────────────────────────────────────────╯  │
└───────────────────────────────────────────────┘ └───────────────────────────────────────────────┘

Compare                                           Side sheet
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ ✕ Close  v1 ⇄ v2      [Side by side|Overlay]  │ │ ‹ 3  report.pdf ▾   │ Save a copy           ✕ │
│ ┌────────────────────┐ ┌────────────────────┐ │ │   ┌─────────────┐   │ Format  PDF ▾           │
│ │ A, page 3          │ │ B, page 3          │ │ │   │ page        │   │ Size    ○ Same ● Smaller│
│ │                    │ │ ▒▒▒▒ changed       │ │ │   │             │   │         about 1.1 MB    │
│ └────────────────────┘ └────────────────────┘ │ │   └─────────────┘   │ ▸ Security  ▸ Metadata  │
│                                               │ │                     │ ▸ Flatten   ▸ Signature │
│  ╭─────────────────────────────────────────╮  │ │   side sheet 360 px │           [ Save copy ] │
│  │   ‹ change 3 of 12 › · Changes · Swap   │  │ │                                               │
│  ╰─────────────────────────────────────────╯  │ │                                               │
└───────────────────────────────────────────────┘ └───────────────────────────────────────────────┘
```

Top bar and dock take 88 of 390 px (23 %, inside A-20's 25 %) and hide on scroll; Markup is a
rail so the page keeps its height.

### 6.5 Tablet portrait, 820 × 1180 (medium)

```
Library                                           Reading (viewing)
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ ◆ [Library] report ● agreement +        ◎  ⋯  │ │ ▤ ◆ [report ▾ ●] agreement +  ⌕ ↶ ↷ Save ◎    │
│░░░░░░░░░░░░░░ aurora, still ░░░░░░░░░░░░░░░░░ │ │╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ soft edge ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌  │
│░ Library      [ Open PDFs… ]  Combine files… ░│ │ [ⓘ 12 form fields · Fill & sign]  (8 s)       │
│ Open · 3 documents · 16 pages          Select │ │  ┌──────────────────────────────────────┐     │
│ ┌────────┐ ┌────────┐ ┌────────┐              │ │  │ page at fit width (772 px); the      │     │
│ │ page 1 │ │ page 1 │ │ page 1 │  lit glass   │ │  │ sidebar opens as a 320 px overlay    │     │
│ └────────┘ └────────┘ └────────┘              │ │  │ (solid on touch, M-31)               │     │
│ report ●   agreement  letter-scan             │ │  └──────────────────────────────────────┘     │
│ ⓘ 12 fields Signed    No text · 2 p           │ │                                               │
│ Recent ─────────────────────────────────────  │ │                                               │
│ ▤ report-v2.pdf · 10 p · kept · 1 d       ⋯   │ │                                  [3/12 · 96 %]│
│                                               │ │  ╭─────────────────────────────────────────╮  │
│                                               │ │  │ ▦ Pages  ✎ Markup  ✑ Fill & sign  ⋯ More│  │
│ ● Nothing is uploaded      English · Türkçe   │ │  ╰─────────────────────────────────────────╯  │
└───────────────────────────────────────────────┘ └───────────────────────────────────────────────┘

Markup                                            Pages grid
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ ▤ ◆ [report ▾ ●] agreement +  ⌕ ↶ ↷ Save ◎    │ │ ▤ ◆ [report ▾ ●] agreement +  ⌕ ↶ ↷ Save ◎    │
│  ┌──────────────────────────────────────┐     │ │ report.pdf · 12   [This document|All open 2]  │
│  │ page; once a pen is seen, a pen      │     │ │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐  S ─○─ L   │
│  │ stroke with Select armed writes with │     │ │ │ 1  │ │ 2  │ │ 3  │ │ 4  │ │ 5  │            │
│  │ the last pen; fingers pan            │     │ │ └────┘ └────┘ └────┘ └────┘ └────┘            │
│  └──────────────────────────────────────┘     │ │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│                                               │ │ │ 6  │ │ 7✓ │ │ 8  │ │ 9  │ │ 10 │            │
│                                               │ │ └────┘ └────┘ └────┘ └────┘ └────┘            │
│     ╭───────────────────────────────────╮     │ │ ┌────┐ ┌────┐                                 │
│     │  ● ● ● ● ● ● ○ │ ━━○━━ 1.5 pt │ ⋯ │     │ │ │ 11 │ │ 12 │   44 px targets; tap selects,   │
│     ╰───────────────────────────────────╯     │ │ └────┘ └────┘   long press lifts (M-20)       │
│╭─────────────────────────────────────────────╮│ │ ╭───────────────────────────────────────────╮ │
││     ✓ Done│↖│● ● ● ▬│⌫ ◌│▭▾ T □│Sign▾│ +    ││ │ │ ✓ Done │ 1 selected │ ↺ ↻ │ ‹ › │ Delete ⋯│ │
│╰─────────────────────────────────────────────╯│ │ ╰───────────────────────────────────────────╯ │
└───────────────────────────────────────────────┘ └───────────────────────────────────────────────┘

Compare                                           Tool sheet
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ ✕ Close  v1 ⇄ v2      [Side by side|Overlay]  │ │ ▤ ◆ [report ▾ ●] agreement +  ⌕ ↶ ↷ Save ◎    │
│ ┌────────────────────┐ ┌────────────────────┐ │ │ ┌──────────────────────┐ │ Page numbers   ✕   │
│ │ A · v1, page 3     │ │ B · v2, page 3     │ │ │ │ live preview on the  │ │ Format             │
│ │                    │ │ ▒▒▒▒ changed line  │ │ │ │ page       "1 / 12"  │ │ [Page 1 of N ▾]    │
│ │                    │ │                    │ │ │ │                      │ │ Position           │
│ │                    │ │                    │ │ │ │                      │ │ ○ ○ ○ ○ ● ○        │
│ └────────────────────┘ └────────────────────┘ │ │ └──────────────────────┘ │ Pages  All ▾       │
│ Changes: an overlay sheet from the trailing   │ │                          │ Size   10 pt       │
│ edge, 320 px                                  │ │  side sheet 360 px,      │                    │
│                                               │ │  no scrim: the page      │    [ Apply ]       │
│                                               │ │  stays live              │                    │
│   ╭───────────────────────────────────────╮   │ │                                               │
│   │ ‹ change 3 of 12 › · Changes · Swap ⋯ │   │ │                                               │
│   ╰───────────────────────────────────────╯   │ │                                               │
└───────────────────────────────────────────────┘ └───────────────────────────────────────────────┘
```

Three persistent glass surfaces in viewing (strip, dock, pill), inside medium's 3 + 1 budget
(`language.md` §2.9). Nothing hides on scroll from this class up.

### 6.6 Tablet landscape and small laptop, 1180 × 820 (expanded)

```
Library                                           Reading, sidebar opened
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ ◆ [Library] report ● agreement +        ◎     │ │ ◆ ▤ [report ▾ ●] agreement +  ⌕  ↶ ↷  Save ◎  │
│░░░░░░░░░░░░░░ aurora, still ░░░░░░░░░░░░░░░░░ │ │ Pages Outline│                                │
│░ Library    [ Open PDFs… ] Combine…  Batch… ░ │ │ ┌────┐       │ ┌───────────────────────────┐  │
│ Open · 3                               Select │ │ │ 1  │       │ │ page at fit width; the    │  │
│ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐       │ │ └────┘       │ │ sidebar (280 px, M3) is   │  │
│ │ p 1   │ │ p 1   │ │ p 1   │ │ Open… │       │ │ ┌────┐ ◂     │ │ closed by default and     │  │
│ └───────┘ └───────┘ └───────┘ └───────┘       │ │ │ 2  │       │ │ remembered once opened    │  │
│ Recent ─────────────────────────────────────  │ │ └────┘       │ └───────────────────────────┘  │
│ ▤ report-v2.pdf · 10 p · kept · yesterday ⋯   │ │                                               │
│                                               │ │              │ ╭─────────────────────────╮    │
│                                               │ │              │ │▦ Pages ✎ Markup ✑ Fill ⋯│3/12│
│ ● Nothing is uploaded      English · Türkçe   │ │              │ ╰─────────────────────────╯    │
└───────────────────────────────────────────────┘ └───────────────────────────────────────────────┘

Markup                                            Pages grid
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ ◆ ▤ [report ▾ ●] agreement +  ⌕  ↶ ↷  Save ◎  │ │ ◆ ▤ [report ▾ ●] agreement +  ⌕  ↶ ↷  Save ◎  │
│       ┌─────────────────────────────────┐     │ │ report.pdf · 12 [This document|All open 2] S─○│
│       │ page; Select armed: a double-   │     │ │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐     │
│       │ click on text opens the editor  │     │ │ │ 1  │ │ 2  │ │ 3  │ │ 4  │ │ 5✓ │ │ 6  │     │
│       └─────────────────────────────────┘     │ │ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘     │
│                                               │ │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐     │
│                                               │ │ │ 7  │ │ 8  │ │ 9  │ │ 10 │ │ 11 │ │ 12 │     │
│                                               │ │ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘     │
│╭─────────────────────────────────────────────╮│ │ click selects · double-click opens · drag move│
││   ✓ Done│↖│●●●▬│● 1.5▾│⌫ ◌│▭▾ T □│Sign▾│+   ││ │╭─────────────────────────────────────────────╮│
│╰─────────────────────────────────────────────╯│ ││✓ Done│1 selected│↺ ↻│Delete│Extract│Move ▾│⋯││
│  options inline; Edit text, Redact in +       │ │╰─────────────────────────────────────────────╯│
└───────────────────────────────────────────────┘ └───────────────────────────────────────────────┘

Compare                                           Task sheet (Save a copy)
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ ✕ Close  v1 ⇄ v2   [Side|Overlay]   Report…   │ │ ◆ ▤ [report ▾ ●] agreement +  ⌕  ↶ ↷  Save ◎  │
│ ┌─────────────────┐┌─────────────────┐│Changes│ │ ┌─────────────────────┐│ Save a copy        ✕ │
│ │ A · v1, page 3  ││ B · v2, page 3  ││▸ p.3  │ │ │ page                ││ Format  PDF ▾        │
│ │                 ││ ▒▒▒▒ changed    ││▸ p.4  │ │ │                     ││ Size ○ Same ● Smaller│
│ │                 ││                 ││▸ p.7  │ │ │                     ││      about 1.1 MB    │
│ └─────────────────┘└─────────────────┘│ ...   │ │ └─────────────────────┘│ ▸ Security ▸ Metadata│
│                                               │ │                        │ ▸ Flatten ▸ Signature│
│                                               │ │  side sheet 400 px     │ Name report-small.pdf│
│                                               │ │                        │        [ Save copy ] │
│    ╭─────────────────────────────────────╮    │ │                                               │
│    │    ‹ change 3 of 12 › · Swap · ⋯    │    │ │                                               │
│    ╰─────────────────────────────────────╯    │ │                                               │
└───────────────────────────────────────────────┘ └───────────────────────────────────────────────┘
```

With the sidebar open an 1180 px iPad keeps about 860 px of stage (M-10).

### 6.7 Desktop, 1440 × 900 (large)

```
Reading (viewing), sidebar closed
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◆  ▤  [report.pdf ▾ ● ⓘ] agreement  letter-scan  +          ⌕ Find in document   ↶ ↷  Save  ◎  │
│╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ soft scroll edge (G-19) ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌│
│ [ⓘ 12 form fields · Fill & sign]                                                               │
│   M1, 600 ms after open,      ┌──────────────────────────────────────────┐                     │
│   collapses into the ⓘ by     │                                          │                     │
│   the title after 8 s         │  page at fit width; nothing glass sits   │                     │
│                               │  over it at fit or after a jump; a drag  │                     │
│                               │  selects text →                          │                     │
│                               │  ╭──────────────────────────────────────╮│                     │
│                               │  │Copy Highlight▾ Comment Redact Edit ⋯ ││                     │
│                               │  ╰──────────────────────────────────────╯│                     │
│                               │                                          │                     │
│                               └──────────────────────────────────────────┘                     │
│                      ╭──────────────────────────────────────────────╮        ╭──────────────╮  │
│                      │ ▦ Pages    ✎ Markup    ✑ Fill & sign  ⋯ More │        │ 3 / 12 · 96 %│  │
│                      ╰──────────────────────────────────────────────╯        ╰──────────────╯  │
└────────────────────────────────────────────────────────────────────────────────────────────────┘

Markup (door: Markup), pending marks shown
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◆  ▤  [report.pdf ▾ ● ⓘ] agreement  letter-scan  +          ⌕ Find in document   ↶ ↷  Save  ◎  │
│                    ┌────────────────────────────────────────────────────────┐                  │
│                    │  page; the armed tool acts; ink never hit-tests text;  │                  │
│                    │  with Select armed a double-click on text opens the    │                  │
│                    │  paragraph editor and the 400 ms hover outline shows   │                  │
│                    └────────────────────────────────────────────────────────┘                  │
│                    ╭─────────────────────────────────────────────────╮                         │
│                    │ 2 marks  ·  Mark area  ·  Apply                ⋯│ only while marks wait   │
│                    ╰─────────────────────────────────────────────────╯                         │
│╭──────────────────────────────────────────────────────────────────────────────────────────────╮│
││✓ Done│ ↖ │ ● ● ● ▬ │ ● black 1.5 pt ▾ │ ⌫ ◌ │ ▭▾ T □ │ ✑ Sign▾ ‹3/12› │ ¶ Edit text │ ▮ │ +  ││
│╰──────────────────────────────────────────────────────────────────────────────────────────────╯│
│   one glass shape morphed from the dock (bar morph); lime under-light beneath the armed tool   │
└────────────────────────────────────────────────────────────────────────────────────────────────┘

Library, 2 selected                               Pages grid
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ ◆ [Library] report ● agreement letter + ◎ ⋯   │ │ ◆ ▤ [report ▾ ●] agreement + ⌕ Find ↶ ↷ Save ◎│
│░░░░░░░░░░░░ aurora field, still ░░░░░░░░░░░░░░│ │ report.pdf · 12 [This document|All open 3] S─○│
│░ Library  [ Open PDFs… ] Combine files… Batch…│ │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐     │
│ Open · 3 documents · 16 pages          Select │ │ │ 1  │ │ 2  │ │ 3  │ │ 4  │ │ 5✓ │ │ 6  │     │
│ ┌───────┐ ┌───────┐ ┌───────┐                 │ │ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘     │
│ │ p 1   │ │ p 1   │ │ p 1 ○ │ ○ hover: select │ │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│ └───────┘ └───────┘ └───────┘                 │ │ │ 7  │ │ 8  │ │ 9  │ │ 10 │ │ 11 │ │ 12 │     │
│ Recent ───────────────────────── Clear recents│ │ └────┘ └────┘ └────┘ └────┘ └────┘            │
│ ▤ report-v2.pdf · 10 p · kept · yesterday   ⋯ │ │ a drop on a tab after 500 ms moves pages there│
│╭─────────────────────────────────────────────╮│ │╭─────────────────────────────────────────────╮│
││  2 selected · Combine · Compare · Pages · ✕ ││ ││✓ Done│1 selected│↺ ↻│Delete│Extract│Move ▾│⋯││
│╰─────────────────────────────────────────────╯│ │╰─────────────────────────────────────────────╯│
└───────────────────────────────────────────────┘ └───────────────────────────────────────────────┘

Compare                                           Tool sheet
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ ✕ Close  v1 ⇄ v2   [Side|Overlay]   Report…   │ │ ◆ ▤ [report ▾ ●] agreement + ⌕ Find ↶ ↷ Save ◎│
│ ┌───────────────┐┌───────────────┐│Changes 12 │ │ ┌─────────────────────┐│ Page numbers       ✕ │
│ │ A · v1, p. 3  ││ B · v2, p. 3  ││▸ p.3 text │ │ │ live preview on the ││ Format [Page 1 of N▾]│
│ │               ││ ▒▒▒ changed   ││▸ p.4 image│ │ │ page      "1 / 12"  ││ Position ○ ○ ○ ○ ● ○ │
│ │               ││               ││▸ p.7 text │ │ │                     ││ Pages    All ▾       │
│ │               ││               ││           │ │ └─────────────────────┘│ Size     10 pt       │
│ └───────────────┘└───────────────┘│ docked    │ │                        │ Start at 1           │
│                                               │ │  side sheet 400 px,    │                      │
│                                               │ │  no scrim; confirms    │          [ Apply ]   │
│    ╭─────────────────────────────────────╮    │ │  are centred dialogs   │                      │
│    │    ‹ change 3 of 12 › · Swap · ⋯    │    │ │                                               │
│    ╰─────────────────────────────────────╯    │ │                                               │
└───────────────────────────────────────────────┘ └───────────────────────────────────────────────┘
```

With one file open, reading at rest shows 14 controls (◆, ▤, the tab, +, Find, ↶, ↷, Save, ◎,
four dock items, the pill) against 29 today (research 15 §1), with the dock and the pill
floating as glass over the stage.

### 6.8 Xlarge, 1920 × 1080

```
Library                                           Reading, sidebar remembered open
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ ◆ [Library] report ● agreement letter +  ◎ ⋯  │ │ ◆ ▤ [report ▾ ●] agreement + ⌕ Find ↶ ↷ Save ◎│
│░░░░░░░░░░░░ aurora field, still ░░░░░░░░░░░░░░│ │ Pages│      ┌──────────────────────┐          │
│░ Library  [ Open PDFs… ] Combine files… Batch…│ │ ┌──┐ │      │ page, fit width      │          │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │ │ │1 │ │      │ capped at 1100 px    │          │
│ │ p 1  │ │ p 1  │ │ p 1  │ │ p 1  │ │ p 1  │  │ │ └──┘ │      │ (M-11), centred in   │          │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘  │ │ ┌──┐ │      │ the free rectangle   │          │
│ cards cap at 6 per row; Recents in two columns│ │ │2 │ │      └──────────────────────┘          │
│                                               │ │ └──┘ │                                        │
│                                               │ │      │   ╭──────────────────────────╮         │
│                                               │ │      │   │▦ Pages ✎ Markup ✑ Fill ⋯ │ 3/12    │
│ ● Nothing is uploaded      English · Türkçe   │ │      │   ╰──────────────────────────╯         │
└───────────────────────────────────────────────┘ └───────────────────────────────────────────────┘

Markup                                            Pages grid, All open
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ ◆ ▤ [report ▾ ●] agreement + ⌕ Find ↶ ↷ Save ◎│ │ ◆ ▤ [report ▾ ●] agreement + ⌕ Find ↶ ↷ Save ◎│
│      ┌──────────────────────────────────┐     │ │ [This document | All open 3]     S ───○─── XXL│
│      │ page                             │     │ │ report.pdf · 12  ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐ │
│      └──────────────────────────────────┘     │ │                  └──┘└──┘└──┘└──┘└──┘└──┘└──┘ │
│                                               │ │ agreement.pdf · 4 ┌──┐┌──┐┌──┐┌──┐            │
│                                               │ │                   └──┘└──┘└──┘└──┘            │
│╭─────────────────────────────────────────────╮│ │ letter-scan · 2   ┌──┐┌──┐  + Insert file…    │
││✓ Done│↖│●●●▬│⌫ ◌│▭▾ T □│Sign▾│¶ Edit text│▮ ││ │                   └──┘└──┘                    │
││+ Image · Stamp · Fields · Find sensitive…   ││ │╭─────────────────────────────────────────────╮│
│╰─────────────────────────────────────────────╯│ ││✓ Done│2 selected│↺ ↻│Delete│Extract│Move ▾│⋯││
│  every group labelled; + keeps only rare tools│ │╰─────────────────────────────────────────────╯│
└───────────────────────────────────────────────┘ └───────────────────────────────────────────────┘

Compare                                           Settings sheet
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ ✕ Close  v1 ⇄ v2   [Side|Overlay]   Report…   │ │ ◆ ▤ [report ▾ ●] agreement + ⌕ Find ↶ ↷ Save ◎│
│ ┌───────────────┐┌───────────────┐│Changes 12 │ │ ┌──────────────────────┐│ Settings           ✕│
│ │ A · v1, p. 3  ││ B · v2, p. 3  ││▸ p.3 text │ │ │ page                 ││ Appearance          │
│ │               ││ ▒▒▒ changed   ││▸ p.4 image│ │ │                      ││  Theme   System ▾   │
│ └───────────────┘└───────────────┘│ docked 320│ │ └──────────────────────┘│  Glass   Clear ▾    │
│                                               │ │                         │  Light   Auto ▾     │
│                                               │ │                         │ Language · Pen      │
│                                               │ │  side sheet 480 px      │ Documents, storage  │
│    ╭─────────────────────────────────────╮    │ │                         │ Privacy · OCR · Keys│
│    │    ‹ change 3 of 12 › · Swap · ⋯    │    │ │                                               │
│    ╰─────────────────────────────────────╯    │ │                                               │
└───────────────────────────────────────────────┘ └───────────────────────────────────────────────┘
```

### 6.9 Placement matrix

| Surface | compact | compact-height | medium | expanded | large | xlarge |
|---|---|---|---|---|---|---|
| Open documents | Library via ‹ N | Same | Tabs in the strip | Tabs | Tabs | Tabs |
| Title menu | Action sheet | Action sheet | Popover menu | Menu | Menu | Menu |
| Facts chip | Above the dock, then ⓘ in the top bar | Top leading, then ⓘ | Top leading of the stage, then ⓘ by the title | Same | Same | Same |
| Undo · Redo | Top bar | Top bar | Strip | Strip | Strip | Strip |
| Save | Title menu | Title menu | Strip | Strip | Strip | Strip |
| Find | ⌕ → field above the keyboard; results sheet 40 % | ⌕ → side sheet | Icon → field | Icon → field | Field from 1280 | Field |
| Privacy | Title header, Library | Same | ◎ in the strip | ◎ | ◎ | ◎ |
| Dock (viewing) | Capsule 64, labels, pill inside, hides on scroll | Capsule 44, labels beside, hides | 56, labels | 48 / 56 | 48 | 48 |
| Page pill | In the dock | In the dock | M1 chip, bottom trailing | Same | Same | Same |
| Markup palette | 64, Draw or Sign set, + sheet | Rail 64, trailing | 64, tier above | 48 / 64, inline options | Labels | Every group |
| Pending-marks bar | Inside the dock's glass | Beside the rail | Above the dock or palette | Same | Same | Same |
| Selection, annotation, Pages bars | At the target, 44 px | Same | Same | 36 px fine, 44 coarse | Same | Same |
| Page menu | Action sheet (long press) | Same | Menu at the press | Menu | Menu | Menu |
| Sidebar | Inside the Pages sheet | Side sheet 360 | Overlay 320 | Docked 280, closed | Same | Docked, remembered |
| Pages grid | Sheet 92 % (40 % peek) | Full screen | Stage | Stage | Stage | Stage |
| Compare | A · B · Changes switch (M-38) | Side by side; Changes sheet | Side by side; Changes overlay 320 | Same | Changes docked | Changes docked |
| Tool sheets (page numbers, OCR, crop) | Bottom sheet 40 %, preview above | Side sheet 360 | Side sheet 360, no scrim | Side sheet 400 | Same | Same |
| Task sheets (Save a copy, Combine with…) | Sheet 92 % | Full sheet | Form sheet ≤ 640 | Side sheet 400 | Same | Same |
| New signature (spec 07.5) | Sheet 92 % | Full sheet | Form sheet ≤ 640; centred 520 on fine pointers | Centred 520 on fine pointers, else side sheet 400 | Same | Same |
| Batch (spec 07.5, 07.Q4) | Dimmed: "Needs a wider window" | Full sheet | Form sheet ≤ 640 | Centred 720 | Same | Same |
| In-page editors (note, text box, paragraph; spec 05.13) | Note: 40 % sheet above the keyboard; text box and paragraph editor on the page, accessory form in the dock | Same | On the page; note popup at its anchor | Same | Same | Same |
| Confirmations, password | Modal sheet | Modal sheet | Centred dialog | Centred | Centred | Centred |
| Settings | Full sheet | Full sheet | Form sheet 600 | Form sheet 600, centred (R15) | Same | Same |
| More | Sheet with search | Sheet | Menu | Menu | Menu | Menu |
| ⌘K | Search field in More | Same | Centred | Centred | Centred | Centred |
| Toasts, progress | Above the dock | Above the dock | Bottom centre above the dock | Same | Same | Same |

Short viewports (height < 352 px, any class): the top bar folds into the dock's capsule, side
sheets become full-width bottom sheets and the rail a horizontal palette (§6.1).

## 7. Gestures and keys

### 7.1 Gesture map

Thresholds from research 19 §6 (long press 450 ms, 10 px slop; double tap 300 ms, 24 px;
multi-finger taps within 150 ms, under 12 px, no pen in the last 500 ms); edges reserved per
M-22; every gesture has a button or key (WCAG 2.5.1).

| Gesture | Viewing | Markup | Pages grid | Library | Button or key |
|---|---|---|---|---|---|
| One-finger drag | Scroll | Scroll; draws with a drawing tool when Draw with finger is on | Scroll; after a long press, drag pages | Scroll | Wheel, PageDown, Space |
| Pinch | Zoom about the midpoint; released more than 15 % below fit page → grid at this page (view change, 240 ms) | Zoom | Columns or cell size; pinch out on a cell opens it | — | Mod+wheel (at fit page, a notch after a 300 ms pause enters the grid), Mod+= Mod+-, 3, dock Pages |
| Double tap | Fit width ⇄ 250 % (M-19) | Same with Select; the tool acts otherwise | Opens the page | Opens the card | Mod+0, Mod+= |
| Long press | Word and the selection bar; an annotation and its bar; paper → page sheet | Same with Select | Lifts the page | Enters Select with the card checked | Right-click, Shift+F10, Select |
| Tap | Clears; focuses a field | As viewing with Select; the tool acts otherwise | Selects (check mark) | Opens | Click |
| Two- / three-finger tap | Nothing | Undo / Redo | Nothing | — | ↶ ↷, Mod+Z, Mod+Shift+Z |
| Swipe down on a sheet | Lowers or closes it | Same | Same | Same | Esc, ✕ |
| Pen down | Acts as a mouse (writes when "Pen writes without Markup" is on) | Writes with Select once a pen has been seen, or uses the armed tool | Drags pages | As a mouse | — |
| Pen eraser end · barrel | Nothing | Temporary Eraser · Lasso | — | — | Shift+E · Q |
| Pen hover | Nothing | Ink dot preview (M-27) | — | — | — |
| Drag a sidebar thumbnail (mouse 4 px; touch after a 450 ms lift) | Reorders; a drop on a tab after 500 ms moves the pages there (RA-7) | Same | — | Drag a card to reorder | Alt+arrows, ‹ ›, Move to ▸ |

### 7.2 Key map

| Area | Keys |
|---|---|
| Places | `0` Library · `1` viewing (closes Markup and the grid; never locks) · `M` Markup (toggle), `2` alias · `3` Pages grid · `4` Compare (with exactly two documents open it compares them; otherwise the chooser) |
| Tools: open Markup and arm | `V` Select · `P` last pen (again: next pen) · `H` Highlighter · `Shift+E` Eraser · `Q` Lasso · `R O L A` shapes · `T` Text box · `N` Note · `I` Image · `Shift+I` Stamp · `G` Signature · `X` Redact · `E` Edit text tool |
| On a text selection | `H` highlight · `U` underline · `S` strikeout · `C` comment · `X` redaction mark · `E` outline the paragraph, then `Enter` opens the editor · `Mod+C` copy |
| Esc ladder | Close the top menu, popover or sheet → clear the selection → disarm to Select → close Markup. In the grid: clear the selection → leave the grid. In Compare: Close. Never leaves a document |
| Compare (spec 06.23) | `1` closes Compare · `0` the Library · `3` the origin document's grid · `4` does nothing · `J` / `K` step changes |
| Library (spec 02.12) | `F2` rename a card · `Alt+Left` / `Alt+Right` reorder cards |
| Pages | `Shift+R` rotate right · `Shift+Alt+R` left (the selection, else the current page) · `Alt+arrows` move · `Alt+Shift+arrows` to the row edge (grid) · `Mod+D` duplicate · `Mod+Shift+E` extract · `Mod+X` / `Mod+V` move between documents · `Delete` (a visible selection only) · `F2` rename a section (grid) |
| Files | `Mod+O` open · `Mod+S` save · `Mod+Shift+S` save a copy (Chromium) · `Mod+P` print · `Mod+W` close (installed app) |
| View | `Mod+F` find (`Enter` / `Shift+Enter`, `F3` / `Shift+F3` step; `Alt+Enter` turns the hit into a selection and moves focus to the page) · `Mod+G` go to page (the pill) · `Mod+=` `Mod+-` `Mod+0` zoom · `Mod+B` sidebar · `F` Focus · `Space` pan · `[` `]` previous and next page |
| Keyboard text | `Enter` on a focused page: caret, or place with a placing tool armed · arrows · `Shift+arrows` select · `Esc`; in caret mode `Alt+arrows` jump by word (the macOS text convention), while page moves keep `Alt+arrows` wherever no caret is active (spec 05.4) |
| Commands | `Mod+K` (selection first, arguments) · `?` shortcuts · `Mod+,` settings where the browser leaves it · `F6` / `Shift+F6` regions (spec X9): top strip or compact top bar → sidebar → page (the page, then caret mode or the open editor's header) → tool sheet → facts chip → pending-marks bar → dock or palette → contextual bar → page pill → toasts; modal sheets and the title menu trap focus and sit outside the cycle |
| History | `Mod+Z` · `Mod+Shift+Z` · `Mod+Y` |
| Steps in lists | `J` / `K` next and previous (Compare changes, redaction marks, OCR results) |

Avoided: Mod+1…9 and Ctrl+Tab in a browser tab (⌘K "Switch to…" instead); `\` (AltGr on a
Turkish Q keyboard); F7 (caret browsing, judgement); Alt+Shift+←/→ (the grid's row-edge chord);
Mod+Enter as Apply; no swipes between documents and no four-finger gestures.

### 7.3 Keys that change, and the migration

| Key | Today | M9 | Migration note |
|---|---|---|---|
| `1` | Read (locks) | Viewing; never locks | On the first press after the update, one toast: "1 now returns to viewing. To lock a document, use Lock in its title menu." |
| `2` | Edit | Markup (alias of M) | Kept so muscle memory and the e2e `enterEdit` helper survive |
| `3` · `4` | Arrange · Compare | Pages grid · Compare | Same intent; `4` compares at once when exactly two documents are open |
| `M` | — | Markup | New; shown in the shortcuts overlay and the dock's tooltip |
| `R` | Rectangle; rotate in Arrange | Rectangle everywhere; inert in the grid | Rotation is Shift+R everywhere (INV-3's key that changed meaning) |
| `Delete` | Deleted a page selected in the navigator, even in Read | A visible selection only | S10 |
| `H U S X` on a selection in Read | The first press switched to Edit | Act at once | — |
| `E` on a selection | Edit and the Edit text tool | Outline, then Enter opens | S15 |
| `P` again | Toggled the options tier | Next pen | Options: press the armed pen again |
| `Mod+S` | The Export dialog | Save in place | Save a copy is Mod+Shift+S and the title menu |
| `Mod+Alt+B` | Inspector | Unbound | The inspector is gone |
| `F` · `Enter` on a page · `Alt+Enter` in Find | — | Focus · caret or place · hit to selection | New |

`modes`, `tools`, `a11y` and `light-table` specs are rewritten; `helpers.ts` keeps `enterEdit`.

## 8. The sixteen jobs

Start state as `current-flows.md` §1, adapted: one document in viewing, the sidebar closed (its
default), nothing selected, large desktop. "+ save": +1 with a kept handle (3 the first time),
+2 for a new file (Save, picker), +1 where Save downloads; today +3, or +4 with the picker.

### 8.1 Paths

- **J1 First visit.** Mouse 2: Open PDFs… · pick (Try the sample 1). Keyboard 2: Enter on Open
  PDFs…, which has first focus · pick. Touch 2: Open PDFs… at the bottom · pick (1 from "Open
  with" or a share into the installed app, M-35).
- **J2 Open and read page 7.** Mouse 2: Open PDFs… · pick; the page fits the width with nothing
  to collapse; page 7 by scrolling (uncounted), +2 by the pill, +1 by a thumbnail with the
  sidebar open. Keyboard 2 (+3): Mod+O · pick, focus on the page (A-13); Mod+G, 7, Enter.
  Touch 2 (+1 by the scrubber over 20 pages).
- **J3 Combine two.** Mouse 3: Open PDFs… · pick both (both cards selected) · Combine 2 files:
  the document exists at once in card order and opens in its grid with "Combined 2 files ·
  Undo"; by drop 2. Keyboard ≈4: Mod+O · pick · Tab to Combine · Enter. Touch 3. Save +2.
- **J4 Move page 5 before 2, delete 7, keep reading.** Mouse 4: ▤ · drag thumbnail 5 above 2 ·
  right-click thumbnail 7 · Delete page; 3 with the sidebar remembered open; 5 through the grid
  (Pages · drag · click 7 · Delete · Done). Keyboard 6: Mod+K, `move 5 before 2`, Enter;
  Mod+K, `delete 7`, Enter. Touch 5: Pages · long-press drag 5 before 2 · tap 7 (a tap selects
  in the grid) · Delete · swipe the sheet down.
- **J5 Highlight and comment.** Mouse 4: drag across the sentence · Comment (one Highlight with
  its note open) · type · Esc. Keyboard 6: Mod+F · phrase · Alt+Enter (selection, focus to the
  page) · C · type · Esc. Touch 5: long press · handle · Comment · type · Done.
- **J6 Write two words in two colours.** Mouse 5: Markup (Select armed) · pen · write · red ·
  write. Mouse and keys 4: P · write · red (or P again) · write. Stylus 4: Markup · write (a pen
  stroke with Select writes with the last pen once a pen has been seen) · red · write; 3 with
  "Pen writes without Markup". Touch 5: Markup · pen · write · red · write. Keyboard n/a.
- **J7 Fill three fields and a checkbox.** Mouse 7: click field 1 · type · Tab · type · Tab ·
  type · click the box. Keyboard ≈8: Tab (from the page into field 1) · type · Tab · type · Tab
  · type · Tab · Space. Touch 7: tap · type · Next · type · Next · type · tap the box (8 when
  the box lies under the keyboard). Save +1 or +2.
- **J8A Place a saved signature.** Mouse 3: Fill & sign · the signature · click the place (or
  right-click · Add signature here ▸ · the signature; on a signature field 2). First time 5:
  Fill & sign · New signature… · draw · Done · click. Keyboard 4: G (Sign set, last signature
  armed, focus stays on the page) · Enter (placed at the centre) · arrows · Enter. Touch 3
  (first time 5).
- **J8B Certificate, saved.** Mouse 6: title ▾ · Sign with certificate… · pick the .p12 ·
  password · Sign and save a copy (the check runs here) · picker. Keyboard ≈8: Mod+K,
  `certificate`, Enter · file (≈2) · password · Enter · picker. Touch 6.
- **J9 Edit a word.** Mouse 4: double-click "2024" · Edit text (the word arrives selected) ·
  type 2025 · Esc; in Markup with Select also 4 (double-click, double-click the word, type,
  Esc). Keyboard 7: Mod+F · `2024` · Alt+Enter · E · Enter · type · Esc. Touch 4: long press ·
  Edit text · type · Done.
- **J10 Redact text and an area, apply.** Mouse 6: drag across the e-mail · Redact (the bar shows
  "1 mark · Mark area · Apply") · Mark area (Markup, Redact armed) · drag the area · Apply 2
  marks · Apply; a toast with Details follows and Redact disarms. Keys the same 6 (select · X ·
  X · drag · Apply · Apply). Keyboard ≈12: Mod+F · type · Alt+Enter · X · X · Enter (area at the
  centre) · arrows · Shift+arrows · Enter · F6 (focus on Apply) · Enter · Enter. Touch 7: long
  press · handle · Redact · Mark area · drag · Apply · Apply.
- **J11 OCR a scan.** Mouse 2 while the facts chip shows: "No text on 2 pages · Recognize" ·
  Recognize 2 pages; 3 after it collapses (ⓘ · Recognize · Recognize 2 pages, or Find's prompt).
  It runs in the background, then "2 pages recognized · Review". Keyboard ≈4: Mod+F · Tab to
  "Recognize text…" · Enter · Enter. Touch 2, or 3.
- **J12 Compare two open versions.** Mouse 3 from the Library: ○ A · ○ B · Compare (defaults:
  older as A, Swap in the bar); 3 from a document (More · Compare with… · pick). Keyboard ≈5:
  arrows · Space · arrow · Space · `4`; 1 when exactly two are open. Touch 3: long press A ·
  tap B · Compare.
- **J13A Save.** Mouse 1 (first time 3: Save, Replace, browser prompt; without a handle 2).
  Keyboard 1 (3). Touch 2: title ▾ · Save (iOS +1 for the share target).
- **J13B Compress, then save.** Mouse 5: title ▾ · Save a copy… · Size: Smaller · Save copy ·
  picker. Keyboard ≈7: Mod+K · `compress` · Enter · arrow · Tab · Enter · picker (≈5 with
  Mod+Shift+S on Chromium). Touch 5: title · Save a copy… · Smaller · Share copy · target.
- **J14 Return via Recents.** 0 if it was open when the browser closed; otherwise mouse 1 (the
  row reopens the snapshot), keyboard ≈3, touch 1.
- **J15a Find.** Mouse 3: Find field (an icon below 1280 px, still one click) · type · Enter.
  Keyboard 3. Touch 3: ⌕ · type · ↓.
- **J15b Outline entry "Terms".** Mouse 2: page pill · Terms (3 for a nested entry). Keyboard
  ≈4: Mod+G · Down · arrows · Enter. Touch 2.
- **J16 Page numbers.** Mouse 4: title ▾ · Page numbers… · "Page 1 of N" · Apply, previewed live;
  today's default preset stays (judges' correction). Keyboard ≈5: Mod+K · `page numbers` ·
  Enter · arrows · Enter (Enter submits from radios and segments, spec 07.16). Touch 4, with the preview above the 40 % sheet. Save +1 or +2.

### 8.2 Step counts

Today from `current-flows.md` §20 (today's stylus J6 is 4 under its own §1 rule: "tap the red
dot and write" is two steps). Best reference from research 15 §4; "d" = derived (judgement).

| Job | Mouse today → M9 | Keyboard today → M9 | Touch today → M9 | + save today → M9 | Best reference | Markup openings |
|---|---|---|---|---|---|---|
| J1 First visit | 2 → 2 (sample 1) | 2 → 2 | 2 → 2 | — | 1 Preview, Finder | 0 |
| J2 Open and read | 2 → 2 | ≈3 → 2 | 3 → 2 | — | 1 Preview | 0 |
| J3 Combine two | 4 → 3 (drop 2) | ≈8 → ≈4 | 4 → 3 | +3/+4 → +2 | 4 PDF Expert | 0 |
| J4 Move one page, delete one | 5 → 4 (3, sidebar open) | ≈12 → 6 | delete 4, move — → 5 | — | 3 d Preview | 0 |
| J5 Highlight and comment | 7 → 4 | — → 6 | ≈8 → 5 | — | 4 Acrobat | 0 |
| J6 Write, two colours | 5 → 5 (keys 4) | n/a | 5 → 5; stylus 4 → 4 (3 opt-in) | — | 3 Notability; 4 Preview iPad | 1 |
| J7 Fill a form | 8 → 7 | ≈11 → ≈8 | ≈9 → 7 (8) | +3 → +1/+2 | 7 d Preview | 0 |
| J8A Saved signature | 6 → 3 (first time 5) | — → 4 | 6 → 3 (5) | +3 → +1/+2 | 3 Acrobat, Firefox | 1 (0 by page menu) |
| J8B Certificate, saved | 8 → 6 | ≈12 → ≈8 | 8 → 6 | included | — | 0 |
| J9 Edit a word | 5 → 4 | ≈10 → 7 | 5 → 4 | — | 3 PDF Expert | 0 |
| J10 Redact text and area | 8 → 6 | ≈13 → ≈12 | 9 → 7 | +3 → +1/+2 | 3 Preview (phrase only) | 1 |
| J11 OCR a scan | 4 → 3 (2 while the chip shows) | ≈7 → ≈4 | 4 → 3 (2) | +3 → +1/+2 | — | 0 |
| J12 Compare | 4 → 3 | ≈7 → ≈5 (1) | 6 → 3 | — | — | 0 |
| J13A Save | 3 → 1 (first time 3) | 3 → 1 (3) | 3 → 2 | — | 0 Preview autosave | 0 |
| J13B Compress and save | 8 → 5 | ≈12 → ≈7 | 8 → 5 | included | — | 0 |
| J14 Reopen from Recents | 1–3 → 0–1 | ≈5–6 → ≈3 | 3 → 0–1 | — | 0 Preview restore | 0 |
| J15a Find a hit | 3 → 3 | 3 → 3 | 4 → 3 | — | 3 | 0 |
| J15b Outline entry | 3 → 2 | ≈6 → ≈4 | 4 → 2 | — | 2 Preview | 0 |
| J16 Page numbers | 4 → 4 | ≈7 → ≈5 | 4 → 4 | +3 → +1/+2 | — | 0 |
| **Total** | **≈91 → 68** | **16 rows ≈121 → 81; gaps J5, J8A closed** | **≈99, no page move → 72, all possible** | **+3/+4 → +1/+2** | | **3 (today 9 mode or view switches)** |

Totals use each row's conservative count (J4 4, J11 3, J13A 1, J14 1) and J8A's saved signature
(3); with a first-time signature they are 70 and 74. On research 15's eleven
everyday jobs M9 takes 26 steps (27 with the sidebar closed) against 25–27 for the best app per
row and 40–46 today; redact a phrase is 4 through the pending bar's Apply. J6, J15a and J16 stay
at today's count (Select on opening is the price of the double-click door; P makes J6 4);
nothing is worse.

### 8.3 The judges' step-count findings and how they are applied

| Finding (judge) | Applied here |
|---|---|
| A J6 counts "Markup (last pen armed)" against its own principle and table (all three) | Markup opens on Select: mouse 5, keys 4 with P |
| A J4 touch: "long press 7" lifts the page in A's own sheet (build, power) | In the grid a tap selects and a long press lifts: touch 5 |
| A depth table gives phone tools behind + depth 2 (build) | Counted 3 for the nine tools behind + (§4.3, §4.7) |
| A J11 mouse 2 holds only at ≥ 1280 px with an unspecified prompt (build, power); C J11 2 holds only within 8 s (build) | 2 while the facts chip shows, 3 after; the table uses 3 |
| A J5 and J9 keyboard need Alt+Enter to move focus (build, power) | Specified: Alt+Enter moves focus to the page (§3.4) |
| A and B J16 save a step by changing the default preset (build) | Today's default kept: 4 |
| A J4 mouse 3 holds only where the sidebar opens by default (owner, power) | Sidebar closed by default everywhere: 4, or 3 once it is remembered open |
| A J13A and B J13A first save omit the browser's permission prompt (owner) | First in-place save 3, later 1 |
| A eleven-job "redact a phrase 4" had no Apply outside Markup (owner) | The pending-marks bar's Apply: 4 holds |
| A J10 mouse 7, and one Redact tool for text and areas (owner) | One Redact tool; 6 by the pending bar and 6 through Markup |
| A J7 touch 8 against B and C 7 (build) | 7, and 8 when the checkbox lies under the keyboard |
| B J8A keyboard 3 skips the nudge and commit (build, power); C J8A keyboard ≈8 needs F6 (build), or 3–5 by G (power) | G arms and keeps focus on the page; Enter, arrows, Enter: 4 |
| B J10 keyboard lists 8 steps for ≈9 and redacts through Find sensitive data (build, power); C J10 ≈7 the same (owner) | The job as defined, text plus a keyboard-placed area: ≈12 |
| B J4 mouse: click to zoom back conflicts with click to select (build, owner, power) | Click selects in the grid; back by Done, Esc, 3 or a double-click: grid path 5 |
| B J10 touch assumes the pending bar over the collapsed chip (build) | The bar is defined above the dock and palette and, on compact, inside the dock's glass: 7 |
| B J6 stylus 3 at 390 px with a chip (build) | No chip on phones; palette row shows the presets: touch 5 |
| B J15b, B J10 mouse, B J13A counts (owner) | Not B's model; equivalent M9 rows counted from its own surfaces (pill 2, J10 6, save 1/3) |
| B's reference counts of `documentMode` and `canEdit` (build; C's were right) | 48 in 17 files and 49 in 14, re-checked by grep (§2.4) |
| C "+18 → +6" ignores the picker for new files and the first-write prompt (build, owner, power) | +2 for new files, 3 for a first in-place save, +1 after |
| C J13B mouse 4 starts from a one-click Export that does not exist (build, owner, power) | Title → Save a copy…: 5 |
| C J6 stylus 3 assumes the pen writes at once (build, owner, power) | Off by default: 4; 3 only with the opt-in setting |
| C "sign 3 against today 6" mixes saved and first-time paths (build) | Both given: 3 saved, 5 the first time; today has no saved signatures (6) |
| C J10 mouse 5 ends inside the task with drags still marking (owner) | Apply disarms Redact to Select, so no Done is needed and no hazard stays |

## 9. First run and empty states

### 9.1 The Library launcher

The empty Library is the welcome moment (RA-19, X-6): "Read, mark up, sign and arrange PDFs.
Nothing leaves this device."; **Open PDFs…** (the view's one lime element, first focus), **Try
the sample**, **Combine files…**; "or drop files anywhere" on fine pointers only; EN · TR
visible (FL-R10); the privacy line. The aurora drifts in Auto and settles after 60 s (§3.4 of
`language.md`); a dragged file brightens it (AU-13). With documents open, lit-glass cards
(AU-9) show each file's facts, then Recents.

### 9.2 The teaching sample

- A bundled four-page PDF built by `tools/fixtures`, English and Turkish, ≤ 250 KB, precached
  **(judgement on size)**. Its text teaches; no overlay tour. Page 1: "Select this sentence and
  choose Highlight. Press M or tap Markup to write." Page 2: a form with a checkbox and "Sign
  here with Fill & sign". Page 3: a scan, "Recognize text makes it searchable". Page 4: "Press 3
  or pinch to see every page. Drag a thumbnail to move it."
- Each Try the sample opens a fresh "Recto sample.pdf" that follows the lock setting.
- **Link parameter:** `?sample` (`?sample=tr` for Turkish) opens it after launch, for the About
  page's "Try it with a demo PDF" (research 21). It is removed with `history.replaceState`, so a
  reload opens no second copy; it loads only the precached file; with a restored session it
  opens as one more tab.

### 9.3 The facts chip

One fact per file, by priority: "Signed by … · locked" > "No text on N pages · Recognize" > "N
form fields · Fill & sign" > "Restored edits from 18:40 · Discard" > "Contents · N chapters". An
M1 chip at the top leading corner of the free rectangle (above the dock on compact), 600 ms
after opening, for 10 s (A-24: it carries an action) or until used; then it folds into the ⓘ by the title, which lists every
fact with its action, as does the title-menu header. Once per file per device, keyed by size
and a hash of the first 64 KB **(judgement)**; the ring circles it while its action runs.

### 9.4 Empty and edge states

| State | What shows |
|---|---|
| Library with nothing open | The launcher, then Recents if any |
| Private window or OPFS refused | "Changes are not kept in this window" (Library, privacy popover) |
| Storage not persistent | Privacy popover: "The browser may clear kept changes · Keep them" |
| Find with no hits | "No matches in report.pdf"; on textless pages "No text on these pages · Recognize text…" |
| Review empty · no outline | "No comments, marks or fields" · the pill shows no Contents; the sidebar's Contents offers "Add a bookmark here" |
| Grid scope or Compare with one document | "All open" dimmed with the reason · chooser "Choose a second file · Open…" |
| No saved signature · no form fields | The chip reads "New signature…" · the stepper is hidden |
| Locked · restricted | Dock "Pages · Locked · More", dimmed menus · "Restricted by the file · Unlock anyway" |
| Damaged file · OCR language not cached | "Could not open scan.pdf: the file is damaged" · "needs a connection once" |

### 9.5 The Settings sheet

One sheet (INV-20): **Appearance** (Theme System · Light · Dark; Glass Clear · Tinted · Solid;
Ambient light Auto · Still · Off; Reduce motion System · On; Haptics, Android only); **Language**;
**Pen and touch** (Pen writes without Markup, off; Pen draws in Markup with Select, on after the
first pen; Draw with finger; Keep tools visible, compact only); **Documents and storage** (Open
documents locked; Keep changes on this device, on; kept documents with sizes and Clear; saved
signatures with Clear); **Privacy** (what never leaves the device; no external requests); **OCR
languages**; **Shortcuts**; **About** (version, licence, About page).

## 10. Component families

| Family (inventory §) | Fate | Becomes | Code impact |
|---|---|---|---|
| 3 App frame (15) | Replace | Top strip (◆, ▤, tabs with the title menu, Find, ↶ ↷, Save, ◎), dock, page pill; progress in the toast stack. Mode switch (3.10), layout switch (3.11), Document button (3.7), Export button (3.8) and status bar (3.14) go | `TabBar.tsx` → `TopStrip`; `Stage.tsx` loses `ModeSwitch`; `StatusBar.tsx` and `viewer/LayoutSwitch.tsx` removed; new `Dock`, `PagePill`, compact top bar |
| 4 Home (5) | Keep, rework | Library: launcher, one-click cards with Select, selection bar, Recents with snapshots, Combine with no dialog, the sample | `home/*`; `EmptyState.tsx` merged; `home-actions.ts` Combine; `home-model.ts` Select mode |
| 5 Navigator (14) | Merge | One sidebar: Pages/Contents · Find · Review; the rail and the Files tab go; thumbnails drag; a navigating click never selects | `LeftRail.tsx` → `Sidebar.tsx`; `PagesPanel.tsx` with `dnd/page-drag.ts`; `FilesList` removed; `ChangesPanel` into Compare |
| 6 Inspector (7) | Remove | History → scrubber; Properties → bars; Info → Document info sheet; Signatures → title menu and facts chip; OCR → its sheet and the Review filter "Words to check" (`06-navigation` N5) | `RightPanel.tsx` deleted, sections re-hosted; `AnnotationProperties.tsx` into the bar's ⋯ |
| 7 Tool bar and tools (16) | Replace | `MarkupPalette`, one glass element with the dock; compact sets; + overflow; inline options or tier; preset strip; one Image tool (INV-15) | `FloatingToolbar*.ts(x)` → `Dock` and `MarkupPalette`; `PenBar.tsx` kept inside; `tool-store` arms on `canChange(id, 'freehand')` |
| 8 Bars, menus, popovers (21) | Keep, extend | Selection bar everywhere with Redact and Edit text; page menu with "Add … here"; title menu; Pages bar; pending-marks bar | `ReadSelectionBar.tsx` → `SelectionBar.tsx`; `PageContextMenu.tsx`; `DocumentMenu.tsx` → `TitleMenu.tsx`; new `PendingMarksBar` |
| 9 Canvas overlays (21) | Keep, re-gate | Layers ask `canChange`; the form notice becomes the Lock notice; hover hint only in Markup with Select; caret mode; keyboard placement | `FormLayer.tsx`, `TextLayer.tsx`, `AnnotationLayer.tsx`, `viewer/hit-order.ts`; new `viewer/caret.ts` |
| 10 Arrange (6) | Merge | The Pages grid surface: scope, size, Done bar, touch drag through the gesture core | `ArrangeView.tsx`, `ArrangeSection.tsx`, `PageCell.tsx` kept; routing by `surface`; R leaves `arrange-commands.ts` |
| 11 Compare (9) | Keep, move | Full-screen place with a top bar (Close, view switch, Report…) and a bottom change bar; setup only when B is unknown; A · B · Changes on compact | `compare/*` reads `destination === 'compare'`; `compare-commands.ts` stops opening the navigator |
| 12 Dialogs (27) | Replace shell, keep content | One Sheet primitive; Save a copy absorbs export, compress, images, Markdown, password; no Combine dialog; Apply redactions ends in a toast | New `ui/Sheet`; `ExportDialog.tsx` restructured; `CompressDialog`, `ImageExportDialog`, `ConvertDialog` become sections; `MergeAllDialog`'s replace outcome removed (INV-12); `SignatureDialog` stores to IndexedDB |
| 13 Palette, shortcuts (2) | Keep, extend | Arguments, selection first, capability list, §7 keys | `CommandPalette.tsx`; `commands/registry.ts` gains `act` and an argument parser |
| 14 Feedback (8) | Replace | One Toast for undo, failure, success and progress; announcements kept | New `ui/Toast`; `CombinedToast` folded in; `LiveRegion.tsx` kept |
| 15.1 Settings, privacy, brand (6) | Replace | One Settings sheet; ◎ popover with kept documents and Clear; brand per research 21 | New `settings/`, `session/`, `signatures/`; `lock-store.ts`, `guard.ts`; `edit-policy-store.ts` → `input-policy-store.ts`; `appearance-store.ts` |
| 15.2 Primitives (11) | Keep, extend | Sheet, Toast, Segmented, Chip; coarse density; two-band focus ring | `ui/*`, `tokens.css` |

## 11. What today's users relearn

- No Read · Edit · Arrange control: Edit is **Markup** (M or the dock; 2 works); `1` returns to
  viewing and no longer locks; Lock is in the title menu.
- Fields, highlights, comments and page actions need no mode. A double-click selects a word
  unless Markup is open; E on a selection needs Enter.
- Markup opens with Select; P picks the last pen, P again the next; options open on a second
  press of the armed pen.
- The Document button is the title (▾); Export is Save (in place) and Save a copy….
- The dock's Pages or `3` opens the grid; thumbnails drag; a thumbnail click only navigates;
  Shift+R rotates (R no longer does).
- No status bar, inspector, Files tab or rail: the pill, a long press on Undo, the title menu,
  the Library. Closing a tab or the browser keeps changes; Recents reopen them.

## 12. Risks and mitigations

| Risk | Likelihood · impact | Mitigation |
|---|---|---|
| Targeted acts change a file without a lock (S7, S8, S9, S17, S18) | Medium · medium | One undo step and a toast each; "Open documents locked"; a five-person test on a form before freezing **(judgement)** |
| The double-click means two things | Medium · low | Outline, cursor and hint inside Markup only; the editor changes nothing until a key; S3 and S4 in the test |
| Markup on Select costs pen users a press (J6) | High · low | P; the pen-seen rule; the opt-in pen setting |
| Nine tools are 3 deep on phones | High · low | + shows the armed tool; the row keeps its set; search in More; "Add … here" in the page sheet |
| Fill & sign reads as a second mode; a comparison is lost behind a tab | Medium · low | One palette and one Done; Fill & sign is never needed to fill · More → Return to comparison |
| Engine edits run before `commit()` | Low · high | Guard before executing, inverse on refusal, a locked-bytes test (§2.5) |
| Workspace-wide undo crosses documents | Medium · medium | The toast names the document with Show; the scrubber lists the document per entry; per-document history is a later ADR **(judgement)** |
| The dock covers a line at some scroll stops | Medium · low | Free-rectangle rule for every jump and focus; 2.2 % of the stage; F hides it |
| Save in place overwrites originals | Low · high | Replace asked once; verification; Revert to the opened version from the snapshot |
| Snapshots on shared machines, quota, eviction | Medium · medium | Listed with Clear; 30 days or 500 MB; `persist()`; private-window notice; honest wording; owner question 2 |
| Hide-on-scroll against A-12 | Low · medium | Compact only, inert, keyboard and focus rules, the setting; the accessibility track confirms |
| Touch reorder depends on the in-house gesture core (S-T4 unverified) | Medium · medium | ‹ › and Move to ▸ in the Pages bar; ⌘K `move` |
| Migration size: `viewMode` 85/37, `documentMode*` 48/17, `canEdit*` 49/14, four specs rewritten | High · medium | Five drops (D0–D4), each a working app (build judge; `docs/specs/redesign.md` §12): D0 sheets, toasts, snapshots, save; D1 targeted acts and the `commit()` lock; D2 palette, dock and Pages grid; D3 glass, light, motion; D4 the Library, first run and the presentation |
| The owner wants documents locked by default | — | One flag flips it; the structure is the same either way |

## 13. Glass, light and motion: where flows meets `language.md`

### 13.1 Where this model puts them

- **Glass** (§2.2 of `language.md`): M1 page pill, facts chip; M2 the dock and palette (one
  shape), options tier, pending-marks bar, contextual, Pages and Compare bars, toasts, progress
  capsule, Library selection bar; M3 top strip, docked sidebar, phone sheet at 40 %; M4 menus,
  popovers, ⌘K; M5 sheets and confirmations; lit glass for Library and drop cards. Pages,
  thumbnails, grid cells, editors and inputs stay solid.
- **Light** (§3.2): the aurora on the Library (drift only while empty, in Auto) and behind the
  drop overlay; the under-light beneath the palette's armed tool (dark); the processing ring on
  progress and on the facts chip; the bloom after a verified save, OCR or Combine. Never on
  pages, the grid, Compare, redaction, deletion or errors (AU-5, A-6); none under the dock in
  viewing, where nothing is armed.
- **Motion** (§7.3 names): *view change* for Library ⇄ document (MC-2, MC-3), page ⇄ grid (MC-9,
  on release, not scrubbed) and Compare (MC-10); *bar morph* for dock ⇄ palette ⇄ Pages bar ⇄
  Compare bar ⇄ Locked and the compact set swap; *tier rise*, *contextual*, *popup*, *sheet*,
  *panel*, *toast*, *undo reveal*, *lift and settle* with *reflow*, *zoom step*, *pinch, smart
  zoom*, *scroll-to*, *progress*, *success*, *light respond*, *ink*. Keys never animate tools.

### 13.2 Changes this file asks of `language.md`

1. §2.2 "Where": M1 drops "the mode thumb", adds the facts chip and the persistent page pill;
   M2's "floating tool bar" becomes "dock and Markup palette (one shape), pending-marks bar,
   Pages bar, Compare bar"; M3 drops the status bar and inspector; "title or top bar" becomes
   "top strip".
2. §2.9 coverage: drop "status bar 1000 × 28"; "title bar 1440 × 40" becomes "top strip 1440 ×
   44, σ 8, c 0.994"; add dock 560 × 48 (σ 9, c 0.992), dock coarse 600 × 56 (σ 10, c 0.995),
   phone dock 360 × 64 (σ 10, c 0.999), pending-marks bar 480 × 40 (σ 8, c 0.988), by §1.2's
   formula.
3. §2.9 compact budget: the pending-marks bar and the options tier share the dock's filtered
   element, so persistent glass stays at two (top bar, dock).
4. §2.7: G-9's own-content lens moves from the retired mode thumb to the remaining segmented
   controls (grid scope, Compare's view switch, Settings).
5. §3.2: "beneath the floating tool bar" becomes "beneath the palette's armed tool, never under
   the dock"; Processing adds the facts chip; "in Arrange" becomes "in the Pages grid".
6. §7.3: MC-8's "Read ⇄ Edit" becomes "viewing ⇄ Markup"; *bar morph* and *view change* list
   the surfaces of §13.1.
7. §7.3, new **hide on scroll**: compact (with compact-height), viewing only; top bar and dock
   translate away on `--spring-quick`, `inert` from the first frame; reduced motion: 150 ms fade.
8. §0.1 principle 8: "Read, Edit or any successor model" becomes "Markup and Lock".
9. §8: toasts sit "above the dock, the palette and the pending-marks bar".
10. §5.2 and §6.2: icons Markup `pen-nib` (pens show ink dots, so the nib is free), Fill & sign
    `signature`, Pages `squares-four`, More `dots-three`, signed `seal-check`; "Read lock"
    becomes "Lock"; densities dock 48 / 56 / 64, palette 48 / 64.

## 14. Decisions to record as ADRs

Numbers are assigned at merge, after the eight of `language.md` §11.1. **Recorded:** with the
light theme folded into ADR-0022, `language.md` §11.1's eight take seven numbers (ADR-0022 to
ADR-0028), and the seven decisions below take four: items 1, 5 and 6 are ADR-0029, item 2 is
ADR-0030, items 3 and 7 are ADR-0031, item 4 is ADR-0032 (spec §0).

1. **Viewing, targeted acts and one Markup state.** Supersedes ADR-0019 §2–§5 and DESIGN §4.8's
   Read rows; keeps ADR-0019 §1 (Home as a place, now the Library) and §6 (one hit order);
   amends ADR-0020 (the editor's doors, the selection carried in, the double-click only in
   Markup). *Rationale:* the lock added a step to exactly the acts that cannot happen by
   accident, cost a mode switch on six jobs (F-1) and still missed page structure (INV-3). The
   reference apps keep viewing open to targeted acts and put free-form creation behind one
   Markup control (research 15). The M8 protection survives as rules, and S1–S18 show it
   stricter for page text and equal for the pen.
2. **`canChange(id, act)`, with Lock enforced in `commit()`.** Replaces `canEdit`. *Rationale:* a
   guard that asks only "is the document in Edit" cannot name the change, and page operations,
   furniture, OCR and crop bypass it today. Named acts make coverage testable per command; one
   enforcement point where every mutation passes fails closed, as ADR-0019 asked.
3. **The size-class shell.** Five width classes and compact-height (M-1); top strip; labelled
   dock that morphs; one sidebar; sheets; persistent page pill; no status bar, inspector or
   rail; hide-on-scroll on compact only, with A-12's safeguards; Compare as a full-screen place.
   *Rationale:* there is no phone or tablet layout today (F-2, INV-1); one model with surfaces
   placed per class (M-12) keeps meanings stable, and the floating dock gives the owner his
   glass at rest while the free-rectangle rule keeps every jump clear.
4. **Saving, restore and history.** Save in place with one Replace and Revert; one Save a copy
   sheet; OPFS snapshots within 2 s, restore with a 20-step tail; Recents reopen snapshots;
   Undo and Redo everywhere; toasts; five saved signatures. *Rationale:* work is lost silently
   on reload and every save is a 3–4 step dialog (F-4, INV-7); a file always kept on the device
   removes the close prompt, and a bounded tail keeps snapshots small.
5. **Pages as a surface.** The Pages grid by zoom transition, sidebar drag, a navigating click
   that never selects, Combine straight into the grid. Supersedes ADR-0019 §2's Arrange view.
   *Rationale:* no reference app makes arranging a peer of reading; this meets FL-R5 and ends the
   Combine/Merge split (INV-12).
6. **Key map v2.** M; `1` viewing; `2` alias; `3`, `4`; reversible single keys on a selection;
   E then Enter; caret mode; Alt+Enter; ⌘K arguments; avoided chords. *Rationale:* keeps 2–4 for
   today's users and the e2e helpers, removes the one key path into page text, and closes the
   keyboard gaps that can close (FL-R9).
7. **Library and first run.** Launcher, teaching sample with `?sample`, facts chip. *Rationale:*
   the first visit shows nothing of what Recto does (F-14); a document that teaches needs no
   tour, and one fact routes a scan to OCR and a form to Fill & sign (FL-R7, FL-R10).

## 15. Owner questions

1. **Should documents open unlocked (recommended) or locked?** The structure is the same; only
   the default of "Open documents locked" changes. Unlocked is §3.5's middle column; locked is
   its right column, ADR-0019's Read made stricter, at two presses (Locked, Unlock) once per
   document before any change. Unlocked keeps the M8 protection for page text and the pen
   (S1–S4, S10–S15). A stray click on a checkbox toggles it (S7), and page-menu or key acts on a
   page take effect (S8, S17, S18), each as one visible step with Undo. Locked blocks these too.
2. **May open documents and their changes stay on this device, and closed ones in Recents for 30
   days or 500 MB?** On by default, listed and clearable. Keeping nothing brings back silent loss.
3. **Taste check on the wave 3 prototype:** the labelled dock floating over the page while
   reading, on desktop and phone. Recommended: always shown from medium up; hiding it there by
   itself would break A-12.

## Sources

Repository files at `0ac4506`; no web sources. Read in full: proposals A and C, the judges'
verdicts, `language.md`, `current-flows.md`, ADR-0019. Read in part: proposal B (§2.2, §3.3–§3.4,
§4, §5); `inventory.md` (§0, §2, §16, §17); research 15 §9, 16 (G list), 17 (AU list), 18 (MC
table), 19 (M list), 20 (X list), 21 (About page), 22 §13. Viewed: baseline `03-read-1440`,
`04-edit-write-390`, `18-document-menu-1440`. Code: `apps/web/src/state/ui-store.ts`,
`workspace-store.ts` (`commit`, `applyEngineEdit`, `tabItems`), `edit-policy-store.ts`,
`packages/document-model/src/serialize.ts` and `history.ts`, every `shortcut:` in
`apps/web/src`; counts by `grep` over `apps/web/src` and `apps/web/e2e`.
