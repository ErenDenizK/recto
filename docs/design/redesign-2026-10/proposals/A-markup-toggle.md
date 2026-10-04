---
title: "Proposal A: viewing by default, one Markup toggle"
date: 2026-10-04
status: proposal
---

> Interaction-model proposal for the M9 redesign, written for the judge panel of wave 2. It
> rests on the wave 1 evidence in this repository: `baseline/` (70 frames, looked at),
> `inventory.md` (INV-*), `current-flows.md` (J1–J16, F-1…F-15, FL-R*) and research 15–22
> (RA-*, G-*, AU-*, MO-*/MC-*/MP-*, M-*, T-*/I-*/C-*/X-*, BR-*, A-*). Code facts come from
> `apps/web/src/state/ui-store.ts` at `7d47031` (22 `viewMode ===` sites, 39 references to
> `canEdit` and `documentModeOf`). No web search was used. Step counts follow the counting rule
> of `current-flows.md` §1. Claims marked **[judgement]** are the author's, not measured.

# Proposal A: viewing by default, one Markup toggle

## 0. Summary

- **A document opens ready to read and ready for any act aimed at something.** A click on a
  form field fills it; a text selection offers Highlight, Comment, Redact and Edit text; a
  right-click or long press on a page offers page actions and "Add … here"; thumbnails in the
  sidebar drag. None of these needs a mode (RA-3, RA-8).
- **Free-form creation lives behind one toggle, Markup** (pen-tip button, key M). It shows one
  floating palette: pens, Highlighter, Eraser, Lasso, Shapes, Text box, Note, Edit text, Sign,
  Stamp, Image, Fields, Redact, Done. Two levels at most: Markup, then the tool (RA-1, RA-2).
- **Read · Edit · Arrange goes.** Read becomes "viewing", which is the default and is not
  locked. Edit becomes the Markup palette. Arrange becomes the Pages grid: the Pages sidebar
  widened over the stage (RA-4). Compare becomes its own tab.
- **The M8 protection survives, mostly stricter.** Page text changes only through Edit text,
  never from a plain click, a pen or a finger; a double-click opens the paragraph editor only
  inside Markup. The pen writes only in Markup by default. Lock is a per-document state, on by
  itself for signed files, and the setting "Open documents locked" restores ADR-0019's locked
  default (stricter: page structure is locked too). The cost: three targeted acts (a checkbox
  click, a page-menu Delete, a key on a selection) now change the document in one step, each
  visible and undoable (§3.5).
- **Saving stops being a dialog.** Save writes back where the browser allows; every change is
  kept on the device within 2 s (OPFS snapshot), so a reload or a closed tab loses nothing;
  Undo and Redo are always visible (RA-11, RA-14, M-34, FL-R3, FL-R4).
- **Step counts:** the 19 job rows of `current-flows.md` §20 take about 91 mouse steps today and
  65 in this model (−29 %). On a touch phone the 18 rows that have a path today take 95 steps
  and 70 here (−26 %), and moving a page becomes possible (5 steps). The two keyboard gaps a
  keyboard can close (J5, J8A) close; writing stays pointer-only (§7).
- **One model at every size.** Size picks the layout, never the model: a bottom capsule on
  phones, a top bar with tabs from 600 px, a docked sidebar from 840 px (M-1, M-6, M-12).

## 1. The model

### 1.1 In one paragraph

Recto shows the page and gets out of the way. Anything a person aims at works where they find
it: they click a field and type, select a sentence and comment on it, right-click a page and
rotate it, drag a thumbnail to move it. Freehand work, where the pointer itself makes the mark,
starts with one button, **Markup**, and ends with **Done**; between the two a single palette
holds every creation tool, with the armed tool's options in view. The page text itself changes
only when the person asks for Edit text. A document can be locked when it must not change, and
a signed one locks itself. Whatever happens is one step in a visible Undo, and the work is
kept on the device until it is saved to a file.

### 1.2 Principles

1. **Aim, then act.** A change needs a target the person chose (a field, a selection, a
   page, an object) or the Markup palette. A pointer that only lands never changes anything
   (RA §5).
2. **One switch, named for what it shows.** Markup is a palette, not a state of the document.
   It is pressed or not, and Done always closes it (RA-1; HIG segmented controls in RA §5).
3. **Page text is protected by a door, not a lock.** The paragraph editor opens only through
   Edit text (selection bar, page menu, key E, the palette tool) or a double-click inside Markup
   (ADR-0019 §5, ADR-0020).
4. **Two levels, options on arming.** Every tool is armed in at most two choices from the page
   at rest (Markup, then the tool, which keeps its last kind), or with one key; another shape,
   stamp or field kind, or another saved signature, is one more choice. Options show when a
   tool is armed, not on a second press (FL-R2, INV-R5).
5. **Nothing is lost, everything is undoable.** Changes are kept on the device at once, Undo
   is always on screen, destructive steps show a toast with Undo (DESIGN §4.4, RA-11, M-34).
6. **The page is the brightest, calmest thing.** At rest nothing floats over the page on
   tablet and desktop; glass is the control layer and light answers events (RA-15, BR-B1,
   AU-4).
7. **Same model, every size.** The size class moves surfaces, never meanings (M-1, M-12).

## 2. Information architecture

### 2.1 Places

| Place | What it is | Reached by | Left by |
|---|---|---|---|
| **Home** | The library: open documents as cards, Recents, a launcher (Open PDFs…, Try a sample, Combine files…), Batch | ◆ mark, key `0`, "‹ N" on phones, closing the last tab, first launch | A card, a tab, a Recents row, Open |
| **Document** | One open PDF: page view, sidebar (Pages, Outline, Review), Markup palette, Info panel | A tab, a card, a Recents row, opening a file | Another tab, ◆ |
| **Pages grid** | The document's pages as a grid, or every open document as sections (today's light table) | ⊞ in the sidebar header, key `3`, pinch below fit, pulling the phone's Pages sheet to full height | Esc, `3`, ✕, Enter or double-click on a page, pinch out |
| **Comparison** | A tab that compares two documents (A ↔ B) with its own bar and Changes list | Home (2 selected) → Compare, title menu → Compare with…, ⌘K | Closing the tab |
| **Settings** | One sheet: Appearance, Language, Pen and touch, Documents and storage, Privacy, OCR languages, Shortcuts, About | ⋯ → Settings, ⌘K, Mod+, | Esc, Done |
| About page | `/recto/about/`, outside the app (BR §10) | ⋯ → About Recto | Browser back |

Markup, the sidebar, the Info panel and sheets are surfaces inside a place, not places.

```
 launch, restoring the last session
   │
   ▼
 Home ─────── card · Recents · Open ───────▶ Document ── 3 · ⊞ · pinch ──▶ Pages grid
  ▲ │                                        │ │ ▲   ◀── Esc · 3 · ✕ · Enter ──
  │ │                                        │ M │ Done · Esc Esc
  │ │                                        │ ▼ │
  │ │                                        │ Markup palette (a surface, not a place)
  │ └─ Compare ─▶ Comparison tab             │
  └──────── ◆ · 0 · last tab closed ─────────┘
```

### 2.2 Tabs and the document switcher

- **A tab is one open item: a document or a comparison.** Tabs sit in the title bar from
  600 px up, reorder by drag (fixes INV-19), carry a ● while changes are not in the file, a
  lock glyph while locked and the signature glyph for signed files. Mod+1…9 and Ctrl+Tab move
  between them in the installed app; in a browser tab those keys belong to the browser, and
  ⌘K "Switch to…" covers them.
- **The active tab's title is the document menu** (RA-9). A click on an inactive tab activates
  it; a click on the active tab, which shows a ▾, opens the title menu. Its header follows the
  macOS document title popover **[judgement, EK]**: first-page thumbnail, an editable name,
  "12 pages · 2.4 MB · Edited", and a **Lock** switch. The "Document" button retires.
- **On phones Home is the switcher** (M-6): "‹ 3" returns to Home, which shows the open
  documents first. No swipe between documents (it would fight the edge rules of M-22).
- The Files navigator tab goes: Home and the tabs show the same list, and Home's Select button
  gives touch its multi-select (INV-10, INV-R8).

### 2.3 State model

Today: `destination: 'home' | 'document'`, a global `viewMode: 'read' | 'arrange' | 'compare'`,
a per-document `documentMode: 'read' | 'edit'`, `lastView`, and `canEdit(id)` that is true only
in Edit. Proposed:

```ts
// state/ui-store.ts (sketch)
type Destination = 'home' | 'document';            // kept (ADR-0019 §1)
type Surface = 'page' | 'grid';                    // grid = Pages sidebar widened (was 'arrange')
type LockReason = 'user' | 'signed' | 'restricted' | 'default'; // 'default': "Open documents locked"
interface DocumentUi {
  surface: Surface;                                // per document, session
  markup: boolean;                                 // palette shown; never restored on launch
  lock: LockReason | null;                         // kept in the session snapshot
}
type TabRef = { kind: 'document'; id: DocumentId } | { kind: 'comparison'; id: ComparisonId };
gridScope: 'document' | 'all';                     // global, remembered
// guards
canEdit(id)     = id is open && docUi[id].lock === null;   // fails closed, as today
canFreeform(id) = canEdit(id) && docUi[id].markup;         // tools other than Select arm only here
```

- `viewMode` and `documentMode` leave the store; `lastView` becomes `surface`. The 22
  `viewMode ===` sites read `surface` or `isPageView()`; the 39 `canEdit` and
  `documentModeOf` references split into `canEdit` (may it change: Lock) and `canFreeform`
  (may the pointer create: Markup) **[judgement: about 2 days of mechanical change]**.
- `canEdit` keeps its single-guard, fail-closed role from ADR-0019; only its question changes
  (RA-3). Whole-document operations with a dialog also ask it, so Lock blocks them too.
- Comparisons move from `viewMode` to `workspace-store` tabs, with the compare session keyed
  by comparison id (today's `compare/` store keeps its logic).
- `sizeClass` (M-1) and the sidebar and Info panel open states per size class join the store;
  the session snapshot (§5) serialises `tabs`, `DocumentUi` minus `markup`, history and pages.

## 3. The mode question

### 3.1 What happens to Read · Edit · Arrange

| Today | Proposal A | Why |
|---|---|---|
| Read: locked default; one Edit button; notices on fields and the page menu | **Viewing**: the default, unlocked; targeted acts work; nothing floats over the page | The lock adds a step to exactly the acts that cannot happen by accident (RA §5, F-1) |
| Edit: five groups, Esc ladder, mode stays until `1` | **Markup palette**: one flat row, Done closes it, remembered per document for the session | Two levels instead of three (F-3); a button that shows a palette is what Preview, Files and Chrome do |
| Arrange: a view peer of Read and Edit, a second copy of the pages | **Pages grid**: the sidebar's Pages widened; same selection, same drag, same bar | Nobody makes arranging a peer of reading (RA §5); Pages no longer repeats the light table (F-15) |
| Compare: a fourth segment that appears and disappears | **Comparison tab** | A view that comes and goes is hard to predict; a tab has a name and a close button |
| Read lock | **Lock**, optional per document; automatic for signed files; "Open documents locked" setting | Keeps the owner's M8 state for those who want it (§3.4) |
| Keys `1` `2` `3` `4` | `1` and `2` retire; `3` toggles the Pages grid; Compare has no key (⌘K) | RA-1, RA-4 |

### 3.2 Input rules

| Input | Viewing | Markup, Select armed | Markup, drawing tool armed | Locked |
|---|---|---|---|---|
| Mouse click on page text | Places nothing, clears the selection | Same | Draws; ink never hit-tests text | Same as viewing |
| Mouse drag over text | Selects text; the selection bar appears; nothing changes yet | Same | Draws | Selects; bar offers Copy only, plus "Unlock" |
| Mouse double-click on text | Selects the word; the bar shows Edit text | Opens the paragraph editor at the point (ADR-0019 §5) | — | Selects the word |
| Click on a form field | Focuses it; typing fills; a checkbox toggles | Same | The drawing tool wins (hit order) | Focus ring and one line "Locked · Unlock" |
| Click on an annotation | Selects it and shows its bar; a drag moves only an already selected one | Same | Draws over it | Opens its comment, read-only |
| Right-click or long press on a page | Page menu (§4.4) | Same | Same | Same menu, change items dimmed "Locked", first item Unlock |
| Pen on a touchscreen | Acts like a mouse: selects text, never marks (default) | Writes with the last pen (today's "Pen draws in Edit") | Uses the armed tool | Acts like a mouse |
| Pen eraser end · barrel button | Nothing | Temporary Eraser · Lasso (DESIGN §4.1) | Same | Nothing |
| One finger | Scrolls with momentum; long press selects a word or opens the page sheet | Scrolls | Draws until a pen has been seen ("Draw with finger", M-25); then scrolls | Scrolls |
| Two fingers | Pan, pinch zoom; pinch below fit opens the grid (M-21) | Pan, zoom | Pan, zoom | Pan, zoom |
| Two- / three-finger tap | Nothing | Undo / Redo (M-17) | Undo / Redo | Nothing |
| Tool letters (P H R O L A T N I G X Q E, Shift+E, Shift+I) | Open Markup and arm the tool, announced; nothing changes until the first stroke | Arm | Arm | Popover at the Markup button: "Locked · Unlock" |
| H C X E U S with a text selection | Highlight, Comment, Redact, Edit text, Underline, Strikeout, in one press | Same | — | Same popover |
| Delete with pages selected in the sidebar or grid | Deletes them; toast "Deleted page 7 · Undo" | Same | Same | Popover |
| Space · Esc | Pan · clear the selection | Pan · disarm to Select, then close Markup | Same | Same as viewing |

"Pen seen" means a direct-display pen (`pointerType === 'pen'` and `maxTouchPoints > 0`,
M-24); a Wacom tablet on a desktop never changes what fingers do.

### 3.3 The pen, the finger, the mouse and the keyboard

- **Pen, default.** Writes only inside Markup. A first pen touch on the page while viewing
  shows one hint at the Markup button: "Writing? Tap Markup. Or let the pen write anywhere
  in Settings." It never repeats.
- **Pen, "Pen writes without Markup" on** (Settings → Pen and touch). A pen stroke while
  viewing writes with the last pen and shows the palette in its minimised form, a **preset
  strip** of the four ink dots plus an expand button (RA-2's auto-minimise, RA §5 point 3).
  Lock still wins. This is Notability's and the HIG's behaviour, offered, not imposed.
- **Finger.** Never creates outside Markup. In Markup with a drawing tool and no pen seen, one
  finger draws and two fingers pan (Notability, Preview); "Draw with finger" in the options
  tier makes one finger scroll instead (M-25).
- **Mouse.** Hover shows nothing on page text while viewing (today's 400 ms outline and the
  "Double-click to edit text" hint are dropped, inventory 9.4); inside Markup with Select, the
  hover outline returns, because a double-click there does edit.
- **Keyboard.** Every pointer act has a key path (DESIGN §4 principle 1, FL-R9): caret mode on
  the text layer (Enter on a focused page places a caret at its first visible line; arrows
  move, Shift+arrows select, Esc leaves); Alt+Enter in the Find field turns the current hit
  into a selection; placeable objects (note, text box, stamp, signature, image, redaction area)
  appear at the focused page's centre on Enter, move with arrows, resize with Shift+arrows,
  commit with Enter, as created form fields do today (inventory 9.15).

### 3.4 Lock

- **States.** Off (default) · On by the user · On because the file carries a digital
  signature that any change would break (RA-4) · On because the file's permissions forbid
  changes (shown as "Restricted by the file", with "Unlock anyway" and an honesty line) · On
  because "Open documents locked" is set.
- **Where.** The Lock switch in the title-menu header; ⌘K "Lock document" / "Unlock document";
  the tab's lock glyph; the Markup button becomes a "Locked" button (lock glyph and label) that
  opens the Unlock popover. No single key: locking should be deliberate **[judgement]**.
- **What it blocks.** Everything `canEdit` guards: annotations, fields, text, page structure,
  whole-document operations. Undo and Redo stay allowed, as in ADR-0019 §3. Reading, Find,
  copy, links, Review, Save a copy and Compare stay.
- **How it reads.** Lock is shown by glyph and label, never by tinting the chrome (ADR-0019
  alternatives, A-19).

### 3.5 Stress test against the owner's M8 wish

The wish (ADR-0019, 2026-10-03): "a pen or a stray click never edits page text by accident",
and a locked state. Each row is an accident that could happen to a reader.

| # | Accident | Today (ADR-0019) | A, default | A, locked |
|---|---|---|---|---|
| S1 | A pen tip rests on the page while reading on a tablet | Selects text | Selects text; the pen writes only in Markup | Selects text |
| S2 | A stray click on body text | Nothing | Nothing | Nothing |
| S3 | A double-click on a word to copy it | Selects the word | Selects the word; the editor never opens outside Markup | Selects the word |
| S4 | A pen double-tap on text inside Markup | Draws (pen draws in Edit) | Draws; ink never hit-tests text | — |
| S5 | A mouse drag across text while scrolling | Selection | Selection; nothing changes until an action is chosen | Selection |
| S6 | A click on a text field | Notice | Focus only; nothing changes until a key is typed | Notice with Unlock |
| S7 | A click on a checkbox | Notice | **Toggles**: one undo step, visible on the page | Notice with Unlock |
| S8 | Right-click → Delete page chosen by mistake | Not offered | **Deletes**; toast "Deleted page 7 · Undo" for 10 s | Dimmed |
| S9 | A letter typed while focus is on the page | Switches to Edit, arms | No selection: opens Markup, arms, no change. **With a selection: acts** (H highlights): one undo step | Popover |
| S10 | Delete after clicking a thumbnail to navigate | **Deletes the page, even in Read** (INV-3) | A navigation click does not select; Delete needs an explicit page selection with focus in the list | Popover |
| S11 | A finger lands on the page on a phone | Scroll | Scroll; a finger never creates outside Markup | Scroll |
| S12 | A two-finger tap while reading | Nothing | Nothing; the undo gesture lives only in Markup | Nothing |
| S13 | A touch drag on the sidebar meant to scroll it | — | Scrolls; reordering needs a 450 ms lift (M-20) | No reorder |
| S14 | A drag that starts on an unselected annotation | Nothing | Nothing moves; the first click only selects | Nothing |

**Verdict.** For page text, A is stricter than today: no click, pen or finger reaches it, and
the double-click door exists only inside Markup (S2–S4). For the pen it equals today by default
(S1). It relaxes three deliberate acts (S7–S9), which become one visible, announced, undoable
step each; it fixes one hole the lock has today (S10). With "Open documents locked" on, every
row equals the right-hand column, which is ADR-0019's Read without its Arrange exception.
**Residual risk to test:** S7 and S9 in a moderated session with five people reading a form
**[judgement]**.

## 4. Tool access

### 4.1 Routes

1. **Targeted acts, no mode:** the field itself, the selection bar, the annotation bar, the
   page menu (right-click, long press, Shift+F10), the thumbnail bar.
2. **The Markup palette:** M or the Markup button, then the tool.
3. **Menus:** the title menu (whole document), Save ▾ (files out), ⋯ (view, app).
4. **⌘K:** every command, with arguments (`go 42`, `rotate 3-5 90`, `move 5 before 2`,
   `delete 7`, as DESIGN §2 promised); with a selection its actions come first, with keys
   (RA-22).
5. **Keys:** single letters for tools and selection actions (§3.2), Mod chords for files and
   view.

### 4.2 The Markup palette

One flat row; no group level. Bottom centre by default; drag docks it at the left or right
edge, vertical, chosen by the projected release point (RA-2, M-8). Desktop order:

```
╭ ↖ │ ● ● ● ▬  ⌫  ◌ │ ▭▾  T  □  ¶ │ Sign▾  Stamp▾  ▣  Fields▾ │ Redact │ Done ╮
  ↖ Select  ● pens 1–3  ▬ Highlighter  ⌫ Eraser  ◌ Lasso  ▭ Shapes (R O L A)
  T Text box  □ Note  ¶ Edit text  ▣ Image: a click on a page image edits it, a click on
  empty paper adds one there (one image tool instead of two, INV-15)
```

- 40 px buttons (44 px hit areas on coarse pointers, M-2), about 940 px wide with labels on the
  four menu buttons (RA-20); below the available width the least used (Fields, ▣, Stamp) fold
  into a "More ▾" at the end, as tldraw's overflow does.
- **Compact and medium widths use the iOS split** (PaperKit's + menu, RA §2.2): `Done │ ● ● ● ▬
  │ ⌫ ◌ │ +`, 8 items, 360 px; + opens a sheet with Shapes, Text box, Note, Edit text, Sign,
  Stamp, Image, Fields, Redact area. Medium shows Shapes, Text and Note in the row as width
  allows.
- **Options tier on arming.** Arming a tool with options shows its tier above the palette
  (colours, width or size, the eraser's mode, "Draw with finger"); ⋯ in the tier opens the
  full preset editor (custom colour, slider, opacity). Tapping the armed preset again also
  opens the editor (today's habit). The tier and palette fade to 20 % during strokes (inventory
  7.15).
- **Done** closes Markup and disarms; Esc disarms to Select, a second Esc closes (RA-1).
  Markup is remembered per document for the session and is never restored on launch.
- Inside the palette, roving arrows; the palette is an F6 region (A-13).

### 4.3 Contextual bars

| Bar | Shows when | Actions |
|---|---|---|
| Text selection | A text selection, any state | Copy · Highlight (long press or right-click: four tints) · Comment · Redact · Edit text · ⋯ (Underline, Strikeout, Squiggly, Find in document) (RA-8) |
| Annotation | An annotation selected | Colour · width or size · Comment · Delete · ⋯ (opacity, font, author, dates) |
| Lasso | A lasso selection | As today (DESIGN §4.1) |
| Page image | Right-click on an image, or ▣ armed | Replace… · Extract · Delete · size readout |
| Pages | Pages selected in the sidebar or grid | N selected · ↺ ↻ · ‹ › (move, for touch, INV-R8) · Delete · Extract · Duplicate · Move to ▾ · ⋯ |
| Created field | A created field selected | Kind · name · Required · ⋯ (properties popover, now glass) |

Comment on a selection creates one Highlight annotation with its note open (RA-6); the
Properties section of the inspector goes, its controls live in the bar's ⋯ (INV-13).

### 4.4 Page menu (static, RA-21)

```
Add note here                N     │  Rotate page left · right   Shift+Alt+R · Shift+R
Add text here                T     │  Delete page                Delete
Add signature here         ▸ G     │  Crop page…
Add image here…              I     │  Insert blank page after
Add stamp here             ▸ ⇧I    │  Insert pages from file…
Edit text here               E     │  Extract page…   Copy page   Paste pages after
───────────────────────────────────│  Show in Pages grid          3
```

"Add … here" places the object at the pressed point: aiming is the target, so a note, a text
box, a signature or a stamp needs no Markup. Locked: every change item is dimmed with the
reason, and "Unlock document" heads the menu.

### 4.5 Every tool, where it lives

Depth = clicks or taps from the page at rest to the tool armed or its sheet open, not counting
the selection a targeted act starts from; the Key column is the one-press route.

| Tool or job | Without Markup | In Markup | Key | Phone | Depth | Options live in |
|---|---|---|---|---|---|---|
| Pens (3 presets) | — (or pen writes, setting) | ● | P (last pen) | Markup → ● | 2 | Tier; editor via ⋯ |
| Highlighter | Selection → Highlight | ▬ | H | Selection bar; Markup → ▬ | 1–2 | Tier (4 tints, 6–18 pt) |
| Eraser | Pen eraser end | ⌫ | Shift+E | Markup → ⌫ | 2 | Tier (whole/partial, size) |
| Lasso | Pen barrel button | ◌ | Q | Markup → ◌ | 2 | Lasso bar |
| Shapes | — | ▭ (last shape); ▾ → kind | R O L A | Markup → + → Shapes | 2 (+1 kind) | Tier |
| Text box | Page menu → Add text here | T | T | Long press → Add text | 2 | Tier; annotation bar |
| Edit text | Selection → Edit text; page menu → Edit text here | ¶; double-click with Select | E | Long press word → Edit text | 1–2 | Editor header (ADR-0020) |
| Note | Page menu → Add note here | □ | N | Long press → Add note | 2 | Note popup |
| Comment | Selection → Comment | Same | C (selection) | Selection bar | 1 | Note popup |
| Underline, Strikeout, Squiggly | Selection → ⋯ | Same | U, S | Selection ⋯ | 2 | Annotation bar |
| Image (add) | Page menu → Add image here… | ▣, then a click on empty paper | I | Long press → Add image | 2 | Annotation bar |
| Page images (replace, extract) | Right-click the image | ▣, then a click on the image | I | Long press the image | 2 | Image bar |
| Stamp | Page menu → Add stamp here → kind | Stamp (last stamp); ▾ → kind | Shift+I | Long press → Add stamp | 2 (+1 kind) | Annotation bar |
| Signature (saved, RA-5) | Click a signature field → pick; page menu → Add signature here → pick | Sign (last signature); ▾ → another, New…, Certificate… | G | Long press → Add signature | 2 (+1 another) | Annotation bar |
| Fill a form | Click the field | Same | Tab | Tap the field | 0 (the field is the target) | — |
| Create fields | — | Fields (last kind); ▾ → kind | — | Markup → + → Fields | 2 (+1 kind) | Field bar, properties popover |
| Show field outlines | ⋯ → View | Fields▾ | — | ⋯ → View | 2 | — |
| Redact text | Selection → Redact | Same | X (selection) | Selection bar | 1 | — |
| Redact area | — | Redact | X | Markup → + → Redact | 2 | Tier: Apply N marks…, Find sensitive data… |
| Find sensitive data, Apply redactions | Title menu → Protect | Redact tier | — | Title → Protect | 2 | Sheet |
| Crop | Page menu → Crop page…; title menu → Crop pages… | — | — | Long press → Crop | 2 | Sheet |
| Rotate | Page menu; Pages bar | — | Shift+R, Shift+Alt+R | Long press; Pages bar | 1–2 | — |
| Delete, insert, extract, duplicate, move pages | Pages bar or page menu; drag in the sidebar or grid | — | Delete, Mod+D, Mod+X/V, Alt+arrows | Pages sheet bar | 1–2 | Sheets for Insert from file, Extract |
| Split, Interleave, Resize, Insert images | Title menu → Pages; grid section ⋯ | — | ⌘K | Title → Pages | 2 | Sheets |
| Combine | Home → Combine N files; title menu → Combine with open documents… | — | ⌘K | Home → Select → Combine | 1–2 | Toast: Change order, Undo |
| OCR | Find field "Recognize text…" on a scan; title menu → Convert | — | ⌘K | Find → Recognize; title | 1–2 | Sheet; results in Info |
| Compare | Home (2 selected) → Compare; title menu → Compare with… | — | ⌘K | Home → Select → Compare | 1–2 | Compare bar |
| Page numbers, header and footer, Bates, watermark | Title menu → item (Pages section) | — | ⌘K | Title → item | 2 | Side sheet with live preview |
| Metadata | Title menu → Document info…; Protect → Remove metadata… | — | ⌘K | Title | 2 | Sheet |
| Password, Lock | Title menu → Password… (Protect section); header Lock switch | — | ⌘K | Title | 2 | Sheet |
| Sign with certificate | Title menu → Protect; Sign▾ → Certificate… | Sign▾ | ⌘K | Title | 2 | Sheet, then save picker |
| Save, Save a copy | Save (title bar); Save ▾ → Save a copy… | — | Mod+S, Mod+Shift+S | Share → … | 1–2 | Save a copy sheet |
| Compress | Save ▾ → Compress… | — | ⌘K | Share → Compress | 2 | Sheet |
| Export as images, Markdown or text | Save ▾ → item | — | ⌘K | Share → item | 2 | Sheet |
| Print | Save ▾ → Print; title menu | — | Mod+P | Share → Print | 2 | Browser dialog |
| Batch | Home → Batch…; ⌘K | — | — | Home → ⋯ → Batch | 2 | Sheet (two panes) |
| Find, outline, review | Find field; sidebar Outline, Review | — | Mod+F, Mod+B | Capsule Find, Pages sheet | 1–2 | Sidebar |
| Bookmark edits | Outline ⋯, F2, Alt+arrows | — | As today | Outline sheet ⋯ | 2 | — |
| Go to page, zoom, layout | Page pill; ⋯ → View | — | Mod+G, Mod+= / Mod+-, Mod+0 | Page pill sheet | 1–2 | — |

## 5. Saving and safety

- **Three kinds of kept.** *On this device*: every change is written to an OPFS snapshot within
  2 s and on `visibilitychange: hidden` (M-34), with `navigator.storage.persist()` requested on
  the first edit. *In the file*: Save. *A copy*: Save a copy… or Share. Nothing is uploaded in
  any of the three.
- **Save in place** (RA-14, FL-R4). With a kept handle and write permission (Chromium), Save or
  Mod+S writes back to the original, then verifies; toast "Saved · verified" with the success
  bloom (AU-12). The first save over a file opened from disk asks once, in a popover on Save:
  "Replace report.pdf? · Replace · Save a copy…", with "Don't ask for this file". Without a
  handle, the first Save opens the save picker and keeps the handle; without the File System
  Access API (Firefox, Safari, phones) Save downloads "report.pdf" and the toast says where.
- **Save a copy…** keeps today's export form as a sheet with the six sections collapsed under
  "Same as original" and **Compression presets inline** (fixes INV-18). Its one button opens the
  picker first, then assembles and verifies (RA-14). Compress… is the same sheet opened on
  Compression with the analysis. Its key, Mod+Shift+S, is taken by Firefox's screenshot tool;
  ⌘K covers it there.
- **Unsaved state.** A ● on the tab and "Edited · kept on this device" in the title-menu
  header. Closing a tab with changes asks nothing: toast "Closed report.pdf · changes kept ·
  Reopen", and the row in Recents says "Edited, changes kept". Snapshots of closed files stay
  30 days or until 500 MB, listed with Clear in the privacy popover **[judgement on the
  numbers]**. A `beforeunload` guard runs only while a change is not yet in the snapshot or
  storage is not persistent: when nothing can be lost, the browser does not nag.
- **Session restore** (RA-10, X-12). Launch reopens the tabs in their order, each at its page,
  zoom, sidebar state and Lock, with its history, so Undo works after a reload. Markup is never
  restored. Toast: "Restored 3 documents · Start fresh". iOS Safari may evict a website's
  storage after 7 days without a visit **[EK]**; the restore promise is worded "on this device,
  while the browser keeps it", and installing the app is suggested once (M-35).
- **Undo and Redo are always visible** in the title bar from 600 px; on phones in the top bar
  whenever the document has history (FL-R3). A long press on Undo opens the History popover
  (last 20 entries with page numbers; a click jumps, RA-11); the full list is the Info panel's
  History section. Every destructive step and every failure gets a toast (A-24: actions stay
  10 s and pause on hover or focus); an undone change off screen scrolls into view (M-17).
- **Redaction and signatures.** Apply redactions is undoable in the app and final in the saved
  file; the first Save after applying names it: "Saved · 2 areas removed for good · verified".
  A signed file opens locked; unlocking says once that saving removes the signature.

## 6. Layout per size class

### 6.1 Classes

| Class | Width | Shell in this model |
|---|---|---|
| compact | < 600 | Top bar (‹ N, title ▾, ↶, ⋯) and bottom capsule (Pages, Find, Markup, Share, page pill); sheets |
| compact-height | height < 480 | Immersive viewing: top bar hidden, capsule as a 44 px pill (page, Markup); Markup as a 64 px vertical rail at the trailing edge, movable; side sheets 360 px (M-8) |
| medium | 600–839 | Top bar 52 px with tabs, Find icon, ↶ ↷, Share, Markup; sidebar as a 320 px overlay; palette floating at the bottom |
| expanded | 840–1199 | Title bar 44 px; sidebar docked 248 px, closed by default; Info panel as an overlay sheet |
| large | 1200–1599 | Sidebar docked and open by default for documents over one page; Info panel docked when opened |
| xlarge | ≥ 1600 | Info panel docked if last open; fit-width capped at 1100 px of page (M-11) |

### 6.2 Desktop, 1440 × 900 (large)

```
Home with three documents
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ◆ │ report-v1 ● │ agreement │ letter-scan │ +                              ⌕ Find  ⋯     │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│░░░░░░░░░░░░░░░░░░░ aurora, still (AU-4), lobes between the card rows ░░░░░░░░░░░░░░░░░░░░│
│  3 documents · 16 pages                       [ Open… ]  [ Compare ]  [ Combine 3 files ] │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                                                │
│  │          │  │          │  │          │   cards: lit glass (AU-9), thumbnails opaque;  │
│  │  page 1  │  │  page 1  │  │  page 1  │   one click opens; ☐ on hover selects;         │
│  │          │  │          │  │          │   drag reorders (sets the Combine order)       │
│  └──────────┘  └──────────┘  └──────────┘                                                │
│  report-v1 ●    agreement     letter-scan                                                │
│  Recent ──────────────────────────────────────────────────────────────── Clear recents   │
│  ▤ report-v2.pdf    10 pages · yesterday · Edited, changes kept on this device     ⋯     │
│  ● Files open on this device. Nothing is uploaded.        English · Türkçe   Batch…      │
└──────────────────────────────────────────────────────────────────────────────────────────┘

Reading (viewing)
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ◆ ▤ │ report-v1 ▾ ● │ agreement │ +     ⌕ Find in document   ↶ ↷   Save ▾   ✎ Markup   ⋯ │
├────────────────────────┬─────────────────────────────────────────────────────────────────┤
│ Pages·Outline·Review ⊞ │                                                                 │
│      ┌──────────┐      │         ┌───────────────────────────────────────────┐           │
│      │    1     │      │         │                                           │           │
│      └──────────┘      │         │  page at fit width; nothing floats over   │           │
│      ┌──────────┐ ◂    │         │  it at rest; a drag selects text; a click │           │
│      │    2     │      │         │  on a field fills it; right-click: page   │           │
│      └──────────┘      │         │  menu                                     │           │
│      ┌──────────┐      │         │                                           │           │
│      │    3     │      │         └───────────────────────────────────────────┘           │
│ 248 px, M3 glass       │                                    3 / 12 · 130 % (page pill)   │
└────────────────────────┴─────────────────────────────────────────────────────────────────┘

Markup (sidebar closed by the user)
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ◆ ▤ │ agreement ▾ ● │ report-v1 │ +     ⌕ Find in document   ↶ ↷   Save ▾  [✎ Markup]  ⋯ │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                    ┌─────────────────────────────────────────────────┐                   │
│                    │                                                 │                   │
│                    │  page; the armed pen writes; ink never hit-tests│                   │
│                    │  text; Select + double-click opens the editor   │                   │
│                    │                                                 │                   │
│                    └─────────────────────────────────────────────────┘                   │
│                      ╭ ● ● ● ● ● ● ● ○ │ ━━○━━ 1.5 pt │ ⋯ ╮   options tier, M2           │
│          ╭ ↖ │ ● ● ● ▬  ⌫  ◌ │ ▭▾  T  □  ¶ │ Sign▾  Stamp▾  ▣  Fields▾ │ Redact │ Done ╮ │
│           palette, M2 glass, lime under-light beneath the armed tool (AU-10)             │
└──────────────────────────────────────────────────────────────────────────────────────────┘

Pages grid (the sidebar widened)
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ◆ ▤ │ report-v1 ▾ ● │ agreement │ +     ⌕ Find in document   ↶ ↷   Save ▾   ✎ Markup   ⋯ │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Pages·Outline·Review ⊞  [ This document │ All open (2) ]   Size ──○──   Select all    ✕  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                 │
│  │  i   │ │  ii  │ │  1   │ │  2 ✓ │ │  3 ✓ │ │  4   │ │  5   │ │  6   │                 │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                 │
│  ┌──────┐ ┌──────┐                                                                       │
│  │  7   │ │  8   │    opaque cells, no aurora (AU-5); drag reorders; a drop on a tab     │
│  └──────┘ └──────┘    after 500 ms moves pages into that document (RA-7)                 │
│                                                                                          │
│              ╭ 2 selected │ ↺ ↻ │ Delete │ Extract │ Duplicate │ Move to ▾ │ ⋯ ╮         │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

The title bar holds, left to right: Home (◆), sidebar (▤), tabs, +, the Find field (document
search, Mod+F; it shrinks to an icon below 1280 px; the count and ↑ ↓ sit in the field, and
"All results" opens a Results section in the sidebar while the search lasts), ↶ ↷, Save ▾,
Markup, and ⋯ (View: layout, zoom, Focus F, Show field outlines; Commands ⌘K; Info panel Mod+Alt+B; Shortcuts ?; Settings;
About; a privacy header). From 1200 px a 24 px shield beside ⋯ opens the privacy popover. The
status bar goes: the page pill (page and zoom, a click opens Go to page) shows while scrolling
or zooming and 1.5 s after, then fades out; long jobs show a progress capsule at the bottom
leading corner with the processing ring (AU-11).

### 6.3 Tablet portrait, 820 × 1180 (medium)

```
Home                                            Reading
┌────────────────────────────────────────────┐ ┌────────────────────────────────────────────┐
│ ◆ │ report-v1 │ agreement │ +        ⌕  ⋯  │ │ ▤ ◆ │ report-v1 ▾ ● │ +   ⌕  ↶ ↷  ⇪  ✎  ⋯  │
├────────────────────────────────────────────┤ ├────────────────────────────────────────────┤
│░░░░░░░░░░░░ aurora, still ░░░░░░░░░░░░░░░░░│ │   ┌────────────────────────────────────┐   │
│ 2 documents                Select  Combine │ │   │                                    │   │
│ ┌────────┐ ┌────────┐ ┌────────┐           │ │   │  page at fit width; the sidebar    │   │
│ │ page 1 │ │ page 1 │ │  Open  │           │ │   │  opens as a 320 px overlay and     │   │
│ └────────┘ └────────┘ └────────┘           │ │   │  never squeezes the page           │   │
│ Recent                                     │ │   │                                    │   │
│ ▤ report-v2.pdf · Edited, changes kept  ⋯  │ │   └────────────────────────────────────┘   │
│ ● Nothing is uploaded   English · Türkçe   │ │                            3 / 12 · 96 %   │
└────────────────────────────────────────────┘ └────────────────────────────────────────────┘

Markup                                          Pages grid
┌────────────────────────────────────────────┐ ┌────────────────────────────────────────────┐
│ ▤ ◆ │ report-v1 ▾ ● │ +   ⌕  ↶ ↷  ⇪ [✎]  ⋯ │ │ ▤ ◆ │ report-v1 ▾ ● │ +   ⌕  ↶ ↷  ⇪  ✎  ⋯  │
├────────────────────────────────────────────┤ ├────────────────────────────────────────────┤
│   ┌────────────────────────────────────┐   │ │ Pages·Outline·Review ⊞  This doc │ All  ✕  │
│   │  page; one finger draws until a    │   │ │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│   │  pen is seen; two fingers pan      │   │ │ │  1   │ │  2   │ │  3 ✓ │ │  4   │        │
│   └────────────────────────────────────┘   │ │ └──────┘ └──────┘ └──────┘ └──────┘        │
│       ╭ ● ● ● ● ● ○ │ ━○━ 1.5 pt │ ⋯ ╮     │ │ ┌──────┐ ┌──────┐                          │
│  ╭ Done │ ● ● ● ▬ │ ⌫ ◌ │ ▭▾ T □ │ + ╮     │ │ │  5   │ │  6   │   44 px targets          │
│   64 px, 44 px targets, centred on screen  │ │ ╭ 1 selected │ ↺ ↻ │ ‹ › │ Delete │ ⋯ ╮    │
└────────────────────────────────────────────┘ └────────────────────────────────────────────┘
```

### 6.4 Phone portrait, 390 × 844 (compact)

```
Home                                Reading
┌────────────────────────────────┐ ┌────────────────────────────────┐
│ ◆ Recto                     ⋯  │ │ ‹ 3   report-v1 ▾        ↶  ⋯  │ 44 + safe area
│░░░░░░░ aurora, still ░░░░░░░░░░│ │╌╌╌╌╌╌ soft glass edge ╌╌╌╌╌╌╌╌╌│
│ Open documents         Select  │ │ ┌────────────────────────────┐ │
│ ┌────────────┐ ┌────────────┐  │ │ │                            │ │
│ │   page 1   │ │   page 1   │  │ │ │  page at full width,       │ │
│ └────────────┘ └────────────┘  │ │ │  8 px margins; bars hide   │ │
│ report-v1 ●    agreement       │ │ │  after 24 px of scroll     │ │
│ Recent                         │ │ │  (M-14)                    │ │
│ ▤ report-v2.pdf · Edited    ⋯  │ │ └────────────────────────────┘ │
│ ● Nothing is uploaded          │ │ ╭────────────────────────────╮ │
│ ╭────────────────────────────╮ │ │ │ ▦   ⌕   [✎ Markup]  ⇪  3/12│ │ 56, M2 glass
│ │       Open PDFs… (lime)    │ │ │ ╰────────────────────────────╯ │
│ ╰────────────────────────────╯ │ └────────────────────────────────┘
└────────────────────────────────┘

Markup                              Pages overview (sheet at 92 %)
┌────────────────────────────────┐ ┌────────────────────────────────┐
│ ‹ 3   report-v1 ▾     ↶  ↷  ⋯  │ │ ‹ 3   report-v1 ▾        ↶  ⋯  │
│ ┌────────────────────────────┐ │ │ ╭──────────── ▬ ─────────────╮ │
│ │                            │ │ │ │ Pages  Outline  Review   ☐ │ │
│ │  one finger draws, two     │ │ │ │ ┌──────┐ ┌──────┐ ┌──────┐ │ │
│ │  fingers pan and zoom;     │ │ │ │ │  1   │ │  2   │ │  3 ✓ │ │ │
│ │  two-finger tap undoes     │ │ │ │ └──────┘ └──────┘ └──────┘ │ │
│ └────────────────────────────┘ │ │ │ ┌──────┐ ┌──────┐ ┌──────┐ │ │
│ ╭────────────────────────────╮ │ │ │ │  4   │ │  5 ✓ │ │  6   │ │ │
│ │ ● ● ● ● ● ○  ━○━ 1.5 pt  ⋯ │ │ │ │ └──────┘ └──────┘ └──────┘ │ │
│ ╰────────────────────────────╯ │ │ │╭ 2 · ↺ ↻ · ‹ › · Delete ⋯ ╮│ │
│ ╭────────────────────────────╮ │ │ ╰────────────────────────────╯ │
│ │ Done │ ● ● ● ▬ │ ⌫  ◌ │  + │ │ │ at 40 %: two rows over the page│
│ ╰────────────────────────────╯ │ │ ☐ = Select; long press lifts   │
└────────────────────────────────┘ └────────────────────────────────┘
```

On phones the Pages sheet *is* the pages overview: at its 40 % detent it shows two rows of
thumbnails over the page, pulled to 92 % it is the full grid, and a pinch below fit opens it at
92 % (M-21, M-29). The capsule's Markup pill becomes Done in the same place (M-7). Selection
bars float above the selection and flip below it near the top bar.

### 6.5 The other classes

- **compact-height (phone landscape).** Viewing hides the top bar; the capsule is a 44 px pill
  (page number, Markup). Markup is a vertical 64 px rail on the trailing edge, Done at its top,
  draggable to the leading edge and remembered (M-8). Sheets are side sheets of 360 px.
- **expanded (840–1199).** As large, with the sidebar closed by default and the Info panel as a
  320 px overlay sheet, so a 1180 px iPad keeps at least 760 px of page (M-10). Palette labels
  show from 960 px.
- **xlarge (≥ 1600).** As large; the Info panel docks when it was last open; fit-width stops at
  1100 px of page with the stage centring it (M-11).

### 6.6 Placement matrix

| Surface | compact | compact-height | medium | expanded | large | xlarge |
|---|---|---|---|---|---|---|
| Open documents | Home ("‹ N") | Home | Tabs, top bar | Tabs, title bar | Tabs | Tabs |
| Document menu | Title ▾, action sheet | Same | Active tab ▾, popover menu | Active tab ▾, menu | Same | Same |
| Markup toggle | Capsule pill ⇄ Done | Pill ⇄ rail Done | Top bar, icon + label | Title bar, icon + label | Same | Same |
| Markup palette | Bottom, docked, 64 px, + menu | Vertical rail, trailing | Floating bottom, + menu | Floating bottom, overflow | Floating bottom, full | Same |
| Options tier | Above the palette | Beside the rail | Above | Above | Above | Above |
| Undo · Redo | Top bar (with history) | Top bar on reveal | Top bar | Title bar | Title bar | Title bar |
| Find | Capsule → field above the keyboard | Pill → side sheet | Icon → field | Field (icon < 1280) | Field | Field |
| Sidebar (Pages, Outline, Review) | Sheet 40 % / 92 % | Side sheet | Overlay 320 px | Docked 248 px, closed | Docked, open | Docked, open |
| Pages grid | Sheet at 92 % | Full screen | Overlay widened | Stage | Stage | Stage |
| Info panel (facts, History, Signatures, OCR) | Sheet from title menu | Side sheet | Popover | Overlay sheet | Docked when open | Docked if last open |
| Selection, annotation, pages bars | Above target, 44 px | Same | Same | Above target | Same | Same |
| Page menu | Action sheet (long press) | Same | Menu at the press | Menu | Menu | Menu |
| Save ▾ / Share | Capsule Share → share sheet | ⋯ | Top bar ⇪ | Save ▾ | Save ▾ | Save ▾ |
| Task sheets (Save a copy, Page numbers, OCR…) | Modal sheet, large detent; preview sheets at 40 % | Full-screen sheet | Form sheet ≤ 640 px | Dialog or side sheet | Same | Same |
| Command palette | ⋯ → Search commands, sheet | Same | Centred | Centred | Centred | Centred |
| Toasts, progress capsule | Above the capsule | Above the pill | Bottom leading | Bottom leading | Same | Same |
| Page pill (page, zoom) | In the capsule | In the pill | Stage corner, fades | Same | Same | Same |
| Privacy | Home, ⋯ header, Share header | Same | ⋯ header | ⋯ header | Shield + ⋯ | Same |
| Settings | Full-screen sheet | Same | Form sheet | Dialog | Dialog | Dialog |

## 7. The sixteen jobs

Start state as in `current-flows.md` §1: one document open, nothing selected; in A it opens in
viewing, sidebar per §6.1. "+ save" in A is +1 for a file with a kept handle (+1 once for the
Replace popover) or where Save downloads, and +2 for a new file (Save, picker); today it is +3
(+4 with the picker).

- **J1 First visit.** Mouse 2: (1) Open PDFs… · (2) pick; or (1) Try a sample (opens the bundled
  demo, FL-R10). Keyboard 2: (1) Mod+O · (2) pick (Open PDFs… has the first focus). Touch 2:
  (1) Open PDFs… at the bottom · (2) pick; or 1 from "Open with" or Android share (M-35).
- **J2 Open and read page 7.** Mouse 2 (+1): open, pick; thumbnail 7. Keyboard 2 (+3): Mod+O,
  pick, focus lands on the page (A-13); Mod+G, 7, Enter. Touch 2: open, pick; the page is full
  width with nothing to collapse.
- **J3 Combine two.** Mouse 3: (1) Open PDFs… · (2) pick both (Home, both selected) · (3)
  Combine 2 files: the new document opens in Home's card order, toast "Combined 2 files · Change
  order · Undo"; by drop 2. Keyboard ≈4: Mod+O, pick, Tab, Enter. Touch 3: open, pick both,
  Combine. Save +2.
- **J4 Move page 5 before 2, delete page 7.** Mouse 3: (1) drag thumbnail 5 above 2 · (2)
  right-click thumbnail 7 · (3) Delete page. Keyboard 6: (1–3) Mod+K, `move 5 before 2`, Enter ·
  (4–6) Mod+K, `delete 7`, Enter. Touch 5: (1) Pages · (2) long-press drag 5 before 2 · (3) long
  press 7 · (4) Delete · (5) swipe the sheet down.
- **J5 Highlight and comment.** Mouse 4: (1) drag across the sentence · (2) Comment · (3) type ·
  (4) Esc. Keyboard 6: (1) Mod+F · (2) type the phrase · (3) Alt+Enter · (4) C · (5) type ·
  (6) Esc. Touch 5: (1) long press · (2) drag a handle · (3) Comment · (4) type · (5) Done.
- **J6 Write two words in two colours.** Mouse 4: (1) Markup (last pen armed) · (2) write · (3)
  red preset · (4) write. Stylus 4, or 3 with "Pen writes without Markup" (write, red in the
  preset strip, write). Touch 4: Markup, write, red, write; two fingers scroll. Keyboard n/a.
- **J7 Fill three fields and a checkbox.** Mouse 7: (1) click field 1 · (2) type · (3) Tab ·
  (4) type · (5) Tab · (6) type · (7) click the checkbox. Keyboard ≈9: F6, Tab, type, Tab, type,
  Tab, type, Tab, Space. Touch ≈8: tap field 1, type, Next, type, Next, type, Done, tap the
  checkbox (the field scrolls above the keyboard, M-4). Save +1 or +2.
- **J8A Place a saved signature.** Mouse 3: (1) right-click at the place · (2) Add signature
  here · (3) the saved signature; or 2 on a signature field (click, pick). First time 5: (1)
  right-click · (2) Add signature here · (3) New signature… · (4) draw · (5) Save and place.
  Keyboard 4: (1) G · (2) Enter on the saved one (it appears at the page centre) · (3) arrows ·
  (4) Enter. Touch 3: long press, Add signature, pick; first time 5.
- **J8B Sign with a certificate, saved.** Mouse 6: (1) title ▾ · (2) Sign with certificate… ·
  (3) pick the .p12 · (4) password · (5) Sign and save (the check runs here) · (6) picker.
  Keyboard ≈8: Mod+K, "certificate", Enter, file (2), password, Enter, picker. Touch 6.
- **J9 Edit a word.** Mouse 4: (1) double-click "2024" · (2) Edit text (the editor opens with
  the word selected) · (3) type 2025 · (4) Esc. In Markup with Select: double-click, double-click
  the word, type, Esc (4). Keyboard 6: Mod+F, type, Alt+Enter, E, type, Esc. Touch 4: long press,
  Edit text, type, Done.
- **J10 Redact text and an area, apply.** Mouse 7: (1) drag across the e-mail · (2) Redact ·
  (3) Markup · (4) Redact tool · (5) drag the area · (6) Apply 2 marks… (tier) · (7) Apply; the
  result is a toast with Details, not a sheet to close. Mouse and keys 6 (X arms the tool).
  Keyboard ≈12: Mod+F, type, Alt+Enter, X; X, Enter (area at the page centre), arrows,
  Shift+arrows, Enter; Tab, Enter (Apply…), Enter. Touch 9: long press, handle, Redact, Markup,
  +, Redact area, drag, Apply…, Apply.
- **J11 OCR a scan.** Mouse 2: the Find field reads "No text on these pages · Recognize text…";
  (1) Recognize text… · (2) Recognize 2 pages (defaults as today); toast "2 pages recognized ·
  Review" opens the Info panel's results. Keyboard 4: Mod+F, Tab, Enter, Enter. Touch 3: Find,
  Recognize text…, Recognize.
- **J12 Compare two open versions.** From Home, mouse 3: (1) ☐ card A · (2) ☐ card B · (3)
  Compare: the comparison tab runs with defaults (older file as A, a Swap button in the bar).
  From a document with B on disk: title ▾, Compare with…, pick (3). Keyboard ≈6: Mod+K,
  "compare", Enter, choose B (2), Enter. Touch 4: Select, A, B, Compare.
- **J13A Save.** Mouse 1 (2 the first time: Replace, or the picker): Save. Keyboard 1: Mod+S.
  Touch 2: Share, Save to Files (one system confirm may follow).
- **J13B Compress, then save.** Mouse 5: (1) Save ▾ · (2) Compress… · (3) a preset · (4) Save
  compressed copy · (5) picker. Keyboard ≈7: Mod+K, "compress", Enter, arrow, Tab, Enter,
  picker. Touch 5: Share, Compress…, preset, Share copy, destination.
- **J14 Return via Recents.** 0 if the file was open when the browser closed (session restore).
  Otherwise mouse 1: the row "Edited, changes kept" reopens from the snapshot with no prompt.
  Keyboard ≈3. Touch 1.
- **J15a Find and step to a hit.** Mouse 3: Find field, type, Enter. Keyboard 3: Mod+F, type,
  Enter. Touch 3: Find, type, ↓ (the page stays visible above the keyboard).
- **J15b Jump to an outline entry.** Mouse 2: Outline (sidebar), the entry. Keyboard ≈5: Mod+K,
  "outline", Enter, arrows, Enter. Touch 3: Pages, Outline, the entry (the sheet closes itself).
- **J16 Page numbers.** Mouse 3: (1) title ▾ · (2) Page numbers… (opens on "Page 1 of N",
  previewed) · (3) Apply. Keyboard ≈5: Mod+K, "page numbers", Enter, Tab, Enter. Touch 3: title,
  Page numbers…, Apply (the sheet sits at 40 %, so the preview shows above it). Watermark: 4
  (title, Watermark…, type, Apply). Save +1 or +2.

### 7.1 Step counts

| Job | Mouse today | Mouse A | Keys today | Keys A | Touch today | Touch A | Best reference (research 15) | Mode switches A |
|---|---|---|---|---|---|---|---|---|
| J1 First visit | 2 | 2 (1 sample) | 2 | 2 | 2 | 2 | 1 Preview, Finder [EK] | 0 |
| J2 Open and read | 2 | 2 | ≈3 | 2 | 3 | 2 | 1 Preview | 0 |
| J3 Combine two | 4 | 3 | ≈8 | ≈4 | 4 | 3 | 4 PDF Expert | 0 |
| J4 Move one, delete one | 5 | 3 | ≈12 | 6 | delete 4, move — | 5 | 3 Preview (drag; select, Delete) | 0 |
| J5 Highlight and comment | 7 | 4 | — | 6 | ≈8 | 5 | 4 Acrobat | 0 |
| J6 Write, two colours | 5 | 4 | n/a | n/a | 5 | 4 | 3 Notability; 4 Preview iPad | 1 (Markup) |
| J7 Fill a form | 8 | 7 | ≈11 | ≈9 | ≈9 | ≈8 | 7 Preview | 0 |
| J8A Signature image | 6 | 3 (5 first) | — | 4 | 6 | 3 (5 first) | 3 Acrobat, Firefox | 0 |
| J8B Certificate, saved | 8 | 6 | ≈12 | ≈8 | 8 | 6 | — | 0 |
| J9 Edit a word | 5 | 4 | ≈10 | 6 | 5 | 4 | 3 PDF Expert | 0 |
| J10 Redact, apply | 8 | 7 | ≈13 | ≈12 | 9 | 9 | 3 Preview (phrase only) | 1 (Markup) |
| J11 OCR a scan | 4 | 2 | ≈7 | 4 | 4 | 3 | — | 0 |
| J12 Compare | 4 | 3 | ≈7 | ≈6 | 6 | 4 | — | 0 |
| J13A Save | 3 | 1 (2 first) | 3 | 1 | 3 | 2 | 0 Preview autosave | 0 |
| J13B Compress and save | 8 | 5 | ≈12 | ≈7 | 8 | 5 | — | 0 |
| J14 Reopen from Recents | 1–3 | 0–1 | ≈5–6 | ≈3 | 3 | 0–1 | 0 Preview window restore | 0 |
| J15a Find a hit | 3 | 3 | 3 | 3 | 4 | 3 | 3 | 0 |
| J15b Outline entry | 3 | 2 | ≈6 | ≈5 | 4 | 3 | 2 Preview | 0 |
| J16 Page numbers | 4 | 3 | ≈7 | ≈5 | 4 | 3 | — | 0 |
| **Total** | **≈91** | **65** | 2 gaps (+ J6) | **J6 only** | **95 + J4 impossible** | **70 + J4 in 5** | | 2 |

Today's mode or view switches on these jobs: 9 (current-flows §20). A has two, both the Markup
toggle for freehand work. On research 15's eleven everyday jobs A totals 26 steps against 25–27
for the best app of each row (open 1 by drop, highlight 2, comment 4, sign 3, first field 2,
combine 2 by drop, move a page 1, rotate 2, redact a phrase 4, edit a word 4, save 1).
Saving adds +1 or +2 where today adds +3 or +4, on the eight jobs that leave a file.

## 8. Glass, light and motion in this model

High level only; values belong to the design-language track.

- **Glass marks the control layer and nothing else** (RA-15, G-1). Title bar and sidebar M3
  (pages scroll under them, which is what makes the glass visible, research 14); palette,
  options tier, contextual bars, capsule, toasts and the page pill M2; menus and the command
  palette M4; sheets M5; Home cards lit glass (AU-9). Pages, thumbnails, grid cells and editors
  stay opaque (G §7.9). One prominent action per surface (G-30). Clear · Tinted · Solid in
  Settings (G-11, A-17).
- **At rest nothing glass covers the page on tablet and desktop.** Viewing has no floating bar
  (today's Edit pill covers text, baseline verdict); the palette exists only while Markup is
  open; the page pill fades out at rest. On phones the capsule floats, and hides on scroll
  (M-14).
- **Light.** The aurora is strongest on Home and the empty launcher (AU §8), sits under the
  Markup palette as a clipped lime under-light beneath the armed tool (AU-10), shows behind the
  drop overlay (AU-13), circles the progress capsule while a job runs (AU-11), and blooms once
  on a verified save, a finished OCR or a combine (AU-12). Never on the stage gutters, the
  Pages grid, Compare, redaction or errors (AU-5, A-6).
- **Motion tells where things come from** (MO-1). Markup: the palette rises 24 px from the
  bottom edge on the smooth spring, its tools stagger 12 ms (MP-11), the Markup button's icon
  swaps to a pressed state; Done reverses the same path. Home ⇄ document: the card morphs into
  page 1 (MC-2, MC-3). Page ⇄ Pages grid: the current page shrinks into its cell and the
  sidebar widens with it (MC-9, View Transition). Comparison: the page slides into the left
  pane (MC-10). Menus grow from their button (MC-14); sheets follow the finger (MC-18).
  Tool switching by key moves nothing (MO-1 rule 6).
- **Why it feels native, calm and expensive [judgement].** The page alone at rest; chrome that
  appears where the person asked, from the control they touched; the operating system's own
  vocabulary (right-click, long press, pinch, Done, title menus, share sheet); no save dialogs
  and no lost work; one lime element per view (X-1); light only as an answer. The "expensive"
  part is restraint plus the absence of friction, not more effects (RA §0).

## 9. Component families

| Family (inventory §) | Verdict | Main change | Code impact |
|---|---|---|---|
| 3 App frame | **Replace** | Title bar with ◆, ▤, tabs (reorderable, title menu on the active tab), Find field, ↶ ↷, Save ▾, Markup, ⋯; mode switch (3.10), layout switch (3.11), Document button (3.7), Export button (3.8) and status bar (3.14) go; page pill and progress capsule replace the status bar | `shell/TabBar.tsx` rewritten; `Stage.tsx` loses `ModeSwitch`; `StatusBar.tsx` removed; new compact top bar and capsule (M-6) |
| 4 Home | **Keep, rework** | Launcher card with sample and language (FL-R10, RA-19); single-click open; hover checkbox and Select mode; Combine without a dialog; Recents with "changes kept"; Batch | `home/*`, `EmptyState.tsx`; Combine path in `home-actions.ts`; sample file shipped with the app |
| 5 Navigator | **Merge** | Rail goes; one sidebar with Pages · Outline · Review and a grid toggle; Find's full list appears as a fourth section, Results, while a search is active; Files tab goes (Home); thumbnails drag (RA-7); a click navigates, selection is explicit (INV-3) | `LeftRail.tsx` → `Sidebar.tsx`; `PagesPanel.tsx` gains `dnd/page-drag.ts`; `FilesList.tsx` removed |
| 6 Inspector | **Merge** | "Info panel": Document facts, History, Signatures, Text recognition; Selection and Properties go to the contextual bars (INV-13) | `RightPanel.tsx` slimmed; `AnnotationProperties.tsx` folded into the bar's ⋯ popover |
| 7 Tool bar and tools | **Replace** | `FloatingToolbar` becomes `MarkupPalette`: flat row, + menu on narrow widths, options tier on arming, preset strip, docking; one Image tool instead of Image and Stamp-or-image (INV-15); Read dock (7.1), group row and chip (7.2, 7.3) go | `FloatingToolbar*.ts(x)`, `PenBar.tsx` (kept inside), `tool-store.ts` arms only when `canFreeform` |
| 8 Contextual bars, menus | **Keep, extend** | Selection bar for every state with C/H/X/E; page menu gains "Add … here" and pages items, static with dimming; title menu replaces the Document menu (8.5), regrouped; Arrange bar becomes the Pages bar with ‹ › | `ReadSelectionBar.tsx` → `SelectionBar.tsx`; `PageContextMenu.tsx`; `DocumentMenu.tsx` → `TitleMenu.tsx` |
| 9 Canvas and overlays | **Keep, re-gate** | Layers ask `canEdit`/`canFreeform`; form notice (9.14) becomes the Lock notice; hover hint (9.4) only in Markup; caret mode and keyboard placement added (FL-R9) | `FormLayer.tsx`, `TextLayer.tsx`, `AnnotationLayer.tsx`, `viewer/hit-order.ts`; new caret module |
| 10 Arrange | **Merge** | Light table becomes the Pages grid: same sections, cells, marquee and keys, hosted by the sidebar; a size control (INV-21) | `ArrangeView.tsx` re-hosted; `Stage.tsx` routing by `surface` |
| 11 Compare | **Keep, move** | Runs in a comparison tab; setup card only when B is unknown; A · B · Changes switch on phones (M-38) | `compare/*` keyed by comparison id; `workspace-store.ts` tab kinds |
| 12 Dialogs | **Replace shell, keep content** | Every dialog on one Sheet primitive (M-29); Export → Save a copy with inline compression; Signature (12.7) → saved signatures (RA-5); Apply redactions ends in a toast; Combine dialog only for "Change order" | new `ui/Sheet`; `ExportDialog.tsx`, `CompressDialog.tsx`, `SignatureDialog.tsx`, `ApplyRedactionsDialog.tsx` |
| 13 Palette and shortcuts | **Keep, extend** | Arguments; selection actions first (RA-22); trigger in ⋯ and as a title-bar button; shortcuts overlay lists M, C, `3`, caret mode | `CommandPalette.tsx`, `commands/registry.ts` (argument parser) |
| 14 Feedback | **Replace** | One toast system (undo, failure, success) replacing the two toasts and the spoken-only feedback (INV-6); progress capsule; History popover on long-press Undo | `LiveRegion.tsx` kept for announcements; new `ui/Toast`; `CombinedToast.tsx` folded in |
| 15 Settings, privacy, brand | **Replace** | One Settings sheet (INV-20); privacy shield and popover with storage and snapshots; brand per research 21 | `appearance-store.ts`, `edit-policy-store.ts` ("Pen writes without Markup", "Open documents locked"); new `session/` and `signatures/` stores |
| 15.2 Primitives | **Keep, extend** | Sheet, Toast, Switch, Segmented; coarse density tokens (M-2); two-band focus ring (A-11) | `ui/*`, `tokens.css` |

ADR consequences: supersedes ADR-0019 §2–§4 and the Read rows of DESIGN §4.8; keeps ADR-0019
§1 (Home as a place), §5 inside Markup (double-click door, pen and finger policy, amended by
M-24) and §6 (one hit order); ADR-0020 keeps its editor and gains the selection carried into
it; ADR-0021 is untouched except by the accent decision of research 20.

## 10. Risks, relearning, accessibility, questions

### 10.1 Risks

1. **Targeted acts without a lock (S7–S9).** A stray checkbox click or a key on a selection now
   changes the document. Mitigation: one undo step, a toast for anything destructive, the
   setting "Open documents locked". Test with five people before freezing **[judgement]**.
2. **Free-form tools behind one button.** People who never press Markup never see the pens.
   Mitigation: a labelled button (icon and "Markup"), tool keys open it, ⌘K lists every tool,
   the first-run sample shows a pen stroke.
3. **Context menus carry real work.** Right-click is invisible to some mouse users and iOS
   Safari fires no `contextmenu` on long press; the app needs its own 450 ms recogniser (M-20).
   Every "Add … here" item is also in the palette.
4. **Save in place overwrites originals.** Mitigated by the one-time Replace popover, the
   verification pass, and the snapshot that keeps the previous state for Undo in the session.
5. **Snapshots hold document bytes in browser storage.** Shared computers, quota and Safari's
   eviction. Mitigated by the privacy popover listing them with Clear, a 30-day limit, and an
   owner question on the default.
6. **Tab kinds.** A comparison tab changes the workspace model that today only knows
   documents; reorder, close and restore must handle both.
7. **Touch reordering** depends on native drag from a long press (S-T4, unverified); the ‹ ›
   buttons in the Pages bar are the fallback.
8. **Width of the desktop palette** (about 940 px) leaves little room at 840–1199 with the
   sidebar open; the overflow rule must be tested in EN and TR (A-21).

### 10.2 What today's users relearn

- No Read · Edit · Arrange control; keys `1` and `2` do nothing; `3` still opens the grid.
- "Edit" becomes **Markup** (M); fields, highlights, comments and page actions need nothing.
- A double-click on text selects a word unless Markup is open; Edit text is in the selection bar.
- The Document button becomes the active tab's title (▾); Export becomes Save and Save a copy….
- The Files tab, the status bar and the inspector's Properties are gone (Home, page pill and
  privacy shield, contextual bars).
- A thumbnail click no longer selects the page for Delete; Shift-click or right-click does.

### 10.3 Accessibility notes

- **Focus never hidden (A-12):** while Markup is open the stage's `scroll-padding-bottom`
  equals the palette and tier height; the page pill never takes focus.
- **Keyboard through floating chrome (A-13):** palette, tier, contextual bars and the progress
  capsule are F6 regions; Esc closes the top one; exiting surfaces are `inert` at once.
- **Announcements (A-14):** "Markup on. Black pen, 1.5 pt." · "Markup off." · "Locked:
  signed file." · "Deleted page 7. Undo with Mod+Z." One per action.
- **Targets (A-15):** 44 px under coarse pointers for the capsule, palette, bars, tabs and
  rows; the palette's + menu exists so 44 px targets fit 390 px.
- **Reflow (A-20):** at 320 × 256 the palette collapses to Done, the active preset and +; the
  title bar folds Find, Save and Markup into ⋯ before anything overflows.
- **Turkish (A-21):** labels sized at 1.8 × English ("Markup" ≈ "İşaretleme", "Save a copy…" ≈
  "Kopyasını kaydet…"); no fixed-width label boxes in the palette.
- **State not by colour (A-19):** Lock is a glyph and a word; the armed tool has fill and
  shape; the pressed Markup button has `aria-pressed` and a filled shape.
- **Reduced motion and plain mode (A-9, A-22):** every morph above becomes a ≤ 150 ms fade;
  the model works unchanged with Glass Solid, Motion Reduced and Light Off.
- **Keyboard parity (FL-R9):** caret mode and placement at the page centre close the two
  keyboard gaps that can close (J5, J8A); writing stays pointer-only.

### 10.4 Open questions for the owner

1. Should documents open **unlocked** (this proposal, with the "Open documents locked" setting
   for your M8 behaviour), or locked as today?
2. On a tablet, should the pen write **only in Markup** (this proposal's default) or anywhere,
   as in Notability and Apple's guidance?
3. May Recto keep open documents and their changes in this browser's storage between visits,
   on by default, listed and clearable in the privacy popover?
4. May Recto keep up to five saved signatures on the device (RA-5)?
5. On Chromium, should Save overwrite the original after a one-time Replace confirmation?
6. Is Compare as its own tab acceptable, instead of a view of a document?
7. Should Combine create the new document at once in Home's card order (Undo and Change order
   in the toast), with no dialog?
8. Can the status bar go, with the page pill, the privacy shield and the progress capsule in
   its place?

## Sources

All sources are files of this repository at `7d47031` (2026-10-04); no web sources were used.

- `docs/design/redesign-2026-10/current-flows.md` (§1 counting rule, J1–J16, §19 F-1…F-15,
  §20 table, §21 FL-R1…FL-R10) and `inventory.md` (families §3–§15, INV-1…INV-24, INV-R1…R8):
  read in full.
- `docs/design/redesign-2026-10/baseline/README.md` and frames `02-home-files-1440`,
  `03-read-1440`, `03-read-390`, `04-edit-write-1440`, `12-arrange-1440`: viewed.
- `docs/research/15-reference-apps.md` read in full (RA-1…RA-22, §4 step counts, §5);
  `19-mobile-and-touch.md` §0, §4–§12 (M-1…M-39); `16-glass-at-the-limit.md` §0, §7, §8
  (G-1…G-32); `17-aurora-and-light.md` §0, §8, §12 (AU-1…AU-22); `18-motion.md` §0, §1.5, MC
  table; `20-type-icons-colour.md` §0, §6, §8; `21-brand-and-portfolio.md` §0, §4, §10;
  `22-accessible-expressive-ui.md` §0, §13 (A-1…A-24).
- `docs/adr/0019-document-modes.md`, `0020-paragraph-text-editing.md` (context),
  `0021-one-highlighter-lasso-palette.md`; `docs/DESIGN.md` §4, §4.1, §4.8.
- `apps/web/src/state/ui-store.ts` (types, `canEdit`), registered shortcuts across
  `apps/web/src/commands`, `annotations/tools.ts`, `viewer/`: read in the cited parts.
