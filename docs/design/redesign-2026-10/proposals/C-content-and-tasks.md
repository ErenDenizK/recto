---
title: "Proposal C: content first, context and task sheets"
date: 2026-10-04
status: proposal
---

> Interaction-model proposal for the M9 redesign. Evidence: the baseline frames (`../baseline/`),
> [`../inventory.md`](../inventory.md) (ids 3.1–15.2.11, INV-n),
> [`../current-flows.md`](../current-flows.md) (J1–J16, F-n, FL-Rn), research 15–22 (ids RA, G,
> AU, MO, MC, M, T, I, C, S, BR, A) and the state code. No web search was used. Claims resting on
> my own judgement are marked **(judgement)**. Step counts follow `current-flows.md` §1.

# Proposal C: content first, context and task sheets

## 0. Summary

- **The page is the interface.** A document opens as plain reading with three pieces of chrome:
  a 44 px top strip, a four-item dock and a page pill. With one file open at 1440 × 900 that is
  14 controls (15 once edited) against 29 today (research 15 §1), and the page covers about 85 %
  of the window against 63.3 % (estimates from the wireframe in §6).
- **Everything else comes from what you select or from a task.** A selection gets a glass action
  bar; Mod+K lists that selection's actions first. Jobs that need their own tools run as one of
  eight **tasks**, each with a visible **Done**: Mark up, Fill & sign, Redact, Edit text, Pages,
  Compare (stage tasks), and Combine and Export (sheet tasks).
- **Read · Edit · Arrange are retired, and the lock's protection stays as a rule.** No free
  gesture on bare content can change the page outside a task. Targeted acts (a selected
  sentence, a clicked form field, a selected page) work from reading. Page text changes only in
  the Edit text task or from an explicit Edit text action. An optional per-document **Lock**
  keeps ADR-0019's hard read-only for those who want it.
- **Tasks do not add steps to everyday jobs.** Highlight takes 2 steps (today 3), highlight and
  comment 4 (today 7), sign with a saved signature 3 (today 6), fill a form 7 (today 8).
  Over all 16 jobs the mouse total falls from 90–92 to 64 steps, and from 108–110 to 70 with
  saving. On a phone, every job has a path; today moving a page has none.
- **Home becomes the Library**, a launcher with the aurora, the sample document, Restore,
  open cards and Recents. Single click opens a card; selection is explicit, so phones can
  Combine and Compare.
- **Saving is one step.** Mod+S writes back where the browser allows it. Export becomes the
  "Save a copy" task sheet. Every change is snapshotted to this device (OPFS), so a reload, a
  killed phone tab or a closed document never loses work.
- **Biggest risks:** the owner asked for a locked Read mode on 2026-10-03, which this proposal
  replaces by a rule plus an optional Lock (§3); more state is implicit (which task is active);
  and the state migration touches every reader of `viewMode`, `documentMode` and `canEdit`.

## 1. The model

### 1.1 In one paragraph

A document is shown as plain reading: the page, and almost nothing else. You act on what you
point at. Select a sentence and a small glass bar offers Highlight, Comment, Redact and Edit
text; click a form field and type; select a page in the thumbnails and rotate or delete it. When
a job needs its own tools, you enter a **task** from the dock, a key or the action panel: Mark
up, Fill & sign, Redact, Edit text, Pages, Compare, Combine or Export. A task brings its tool bar
in place of the dock, labels itself, keeps its tools armed, and ends with **Done**, which returns
you to plain reading. Nothing on the page changes by a stray click, a double-click or a pen
resting on text, because outside a task the bare page does not edit. Home is a Library you
launch from and return to.

### 1.2 Principles

1. **Content first.** The page is the brightest and largest thing on screen (BR-B1). Chrome
   exists at rest only where it carries identity (title), safety (Undo, Save) or entry (dock).
2. **Act on what you point at.** Selection is the main verb. Every selection kind (text,
   annotation, ink, image, field, page, card) gets one action bar and the same actions at the
   top of Mod+K (RA-8, RA-13, RA-22).
3. **Targeted acts need no task; free gestures need one.** A click on a field, a chosen
   sentence, a chosen page or a chosen annotation is deliberate. A stroke, a placement on empty
   paper and a click into body text are not, so they only act inside a task (research 15 §5).
4. **Every task names itself and ends with Done.** One task at a time per document. The bar
   says which task is active; Esc twice or Mod+Enter or Done leaves it. A task entered from a
   selection ends by itself when that act is complete (§2.4).
5. **One step to undo, one step to save.** Undo and Redo are always visible; destructive steps
   and failures show a toast with Undo (FL-R3). Saving is Mod+S, not a dialog (FL-R4).
6. **Same thing, same name, same place.** Combine always makes a new document; Comment
   always attaches to its highlight; Sign always opens saved signatures (FL-R8). Menus keep
   their items in place and dim what does not apply (RA-21).
7. **Calm until touched.** Nothing moves at rest; light and motion answer events (MO-1
   principle 5, AU-4). Facts about the file appear as one quiet chip at a time, never a tour.

## 2. Information architecture

### 2.1 Places

| Place | What it is | Reached from |
|---|---|---|
| **Library** | Launcher and library: title card, Open PDFs…, Try the sample, Restore, open documents as cards, Recents, Batch… | Launch; `0`; the mark at the top left; "‹ 3" on phones; closing the last document |
| **Document** | One open document in plain reading, or in one of its stage tasks | A card, a Recent, a dropped or opened file, the document chips |
| **Compare** | Two documents side by side or overlaid, with changes; the one task that is also a place, because it spans two documents | Library with two cards selected; Compare from a document; `4` |
| **Settings** | A sheet: appearance, language, pen, privacy and storage, OCR languages, author, shortcuts, About | ⚙ on the Library; the title menu; Mod+K |

There is no navigator rail, no inspector and no status bar. Their contents move into the
sidebar, sheets, the page pill and toasts (§9).

### 2.2 Map

```
 launch ──▶ LIBRARY ──card · Recent · Restore · drop──▶ DOCUMENT (plain reading)
              ▲   │                                      │   ▲
              │   ├─ 2 selected · Combine ─▶ new document│   │ Done · Esc Esc · Mod+Enter · 1
              │   ├─ 2 selected · Compare ─▶ COMPARE ◀───┤   │
              │   └─ Batch… (sheet)                      ▼   │
              └──── 0 · mark · ‹ 3 ◀──────────── stage tasks: Mark up · Fill & sign ·
                                                 Redact · Edit text · Pages
                                                 sheet tasks: Export · Combine with…
                                                 tool sheets: Page numbers, OCR, Crop…
```

Costs: Library ⇄ document 1 step; reading → task 1 (dock item or key); task → reading 1 (Done
or `1`); task → task 1 key, or 2 clicks through the task name menu in the bar (today: chip,
group, tool = 3, INV-5).

### 2.3 Document switcher

- **Document chips** replace the tab strip on medium and wider when two or more documents are
  open: title, unsaved dot, × on hover or focus (always on `hover: none`), 28 px high fine,
  44 px coarse, 112–200 px wide. Chips drag to reorder (fixes INV-19); chip order is Library
  order and Combine order.
- **The active chip is the title menu** (RA-9): it carries a ▾ and opens the document menu
  (§4.1). With one document, only the title chip shows.
- **Overflow:** beyond 6 chips, or when chips would truncate under 112 px, a "+N" chip opens a
  switcher popover (open documents, then Recents). Phones show "‹ 3", back to the Library with
  the open-document count (M-6); there the Library is the switcher.
- **Keys:** previous or next document Alt+Shift+← / → **(judgement: browsers reserve Ctrl+Tab
  and Mod+1…9 in a normal tab; verify the chord in all three engines)**; Mod+K lists open
  documents by name; in an installed window Ctrl+Tab also works.

### 2.4 Tasks

| Task | Kind | Key | Tools it brings | What Done does |
|---|---|---|---|---|
| Mark up | stage | `M`, `2` | Pens ×3, Highlighter, Eraser, Lasso, Select, Shapes ▾, Text, Note, Insert ▾ (Image, Stamps, Signature) | Returns to reading; everything is already in History |
| Fill & sign | stage | `F` | Saved signatures, New signature, Text, field stepper ‹ n/N ›, Show fields, Add field ▾, Certificate… | Returns; asks nothing |
| Redact | stage | `X` | Mark (text or area), Find sensitive…, Mark matches, Marks list, **Apply n…** | With unapplied marks: "Apply 3 redactions now?" Apply… · Keep as marks |
| Edit text | stage | `E` | Text (paragraph outlines, the paragraph editor and its header) · Images (replace, extract, delete page images): the page's own content | Commits the open paragraph, returns |
| Pages | stage | `3` | Grid of this document (+ other documents as sections), Select, rotate, delete, duplicate, extract, insert, split, size | Zooms back into the current or selected page |
| Compare | place | `4` | Side by side · Overlay, opacity, heat map, ‹ change ›, Changes, Report | Returns to the document it came from |
| Export | sheet | `Mod+Shift+S` | Format, size, password, metadata, flatten, certificate, file name | Save copy (or Share) closes the sheet |
| Combine with… | sheet | Mod+K | Files in order, Add files…, name, Keep originals open | Combine opens the new document |

**Two ways in.** An **explicit** entry (dock, key, Mod+K, More) keeps the task until Done. A
**transient** entry comes from a targeted act: Redact or Edit text on a selection, Sign on a
signature field, Comment's note editor. A transient task shows no tool bar for Edit text and
Sign, only the editor or picker, and returns to reading when the act is complete. Redact is the
exception: its marks wait for Apply, so a transient entry shows the Redact bar and stays.

**Tools are shared, names are not duplicated.** Text (a free text box) appears in Mark up and
in Fill & sign; Signature appears in Fill & sign and in Mark up's Insert menu; both open the same
tool. A tool key pressed in reading enters the task that owns it and arms the tool (P → Mark up
with the last pen; G → Fill & sign with the signature list open; R → Mark up with Rectangle).

### 2.5 State model

Today: `destination: 'home' | 'document'`, `viewMode: 'read' | 'arrange' | 'compare'`,
`documentMode: Record<DocumentId, 'read' | 'edit'>` and the guard `canEdit(id)` (true only in
Edit). `viewMode` is read in 37 files (11 outside tests), `documentMode` in 17 (7), and
`canEdit` appears on 34 lines in 11 source files; `tool-store` arms a tool only in Edit.

Proposed:

```ts
type Place = 'library' | 'document' | 'compare';
type StageTask = 'markup' | 'fill' | 'redact' | 'text' | 'pages';
type SheetTask = 'export' | 'combine';
type Act = 'targeted' | 'freehand' | 'place' | 'text' | 'pages' | 'document';

interface UiState {
  place: Place;                                   // replaces destination + viewMode
  task: Readonly<Record<DocumentId, { id: StageTask; entry: 'explicit' | 'transient' }>>;
  sheet: SheetTask | null;                        // one sheet task at a time
  locked: Readonly<Record<DocumentId, boolean>>;  // optional Lock (§3.3)
  comparison: CompareSessionId | null;
  sidebar: { open: boolean; section: 'pages' | 'contents' | 'review' | 'history' };
}
// Replaces canEdit(id). Fails closed for an unknown act.
function canChange(id: DocumentId, act: Act): boolean;
```

- `viewMode 'read'` → `place 'document'` with no task; `'arrange'` → task `'pages'`;
  `'compare'` → `place 'compare'`. `documentMode` is removed; `lastView` becomes the last task
  per document (session only).
- `canChange(id, act)`: false for every act on a locked document; `targeted` and `document`
  acts allowed otherwise; `freehand` and `place` only while Mark up or Fill & sign is active;
  `text` only in Edit text (explicit or transient); `pages` for a visible page selection in the
  sidebar or the Pages task. The store guard still backs every UI check (ADR-0019 consequence),
  but asks "is this act allowed here" instead of "is the document in Edit".
- `tool-store` arms a tool only while its task is active; arming from a key enters the task
  first (today's `activateTool` already enters Edit first).
- `viewer/hit-order.ts` keeps the order annotation → form widget → image → text run → text
  selection; the live targets per state become: reading: text selection, links, form widgets,
  annotations (select first, then act); Mark up: the armed tool's targets; Edit text: paragraph
  or image targets. A full-page scan image is never a target in reading.

## 3. The mode question

### 3.1 Read · Edit · Arrange

| Today | In C | Why |
|---|---|---|
| Read (locked, default) | Plain reading, not locked, but bare content does not edit | No reference app locks by default; deliberate acts never need a toggle in the Markup family (research 15 §0, §5) |
| Edit (5 groups) | Split into Mark up, Fill & sign, Redact, Edit text, plus targeted acts from reading | A task names the job; groups named tools (INV-5, INV-15) |
| Arrange (view) | The Pages task, also reached by zooming out (pinch below fit, Mod+- at 25 %) | Page arranging is a view of the document everywhere else (research 15 §5) |
| Compare (4th segment) | Compare place, entered as a task | It spans two documents |
| Lock glyph, keys 1/2/3/4 | Optional Lock; `1` = reading (Done), `2` Mark up, `3` Pages, `4` Compare | Keys 2–4 keep roughly their meaning for today's users |

Adopted: RA-3 (targeted acts in viewing), RA-4 (Pages as a view, Lock as an option), RA-7.
Adapted: RA-1 (one Markup toggle) becomes one of eight tasks, because Redact, Edit text and
Pages have tools that would overload one palette (today's five groups prove the overload).
Rejected: MC-22 (the Read-lock hint) except under Lock.

### 3.2 Protection without a lock

The owner's M8 request was that "a pen or a stray click never edits page text by accident". C
keeps that as a rule enforced by `canChange` and the hit order:

| Accident | Today (Read / Edit) | In C |
|---|---|---|
| Single click on body text | Nothing / hint "Double-click to edit text" | Nothing (clears the selection) |
| Double-click on body text | Selects a word / **opens the paragraph editor** | Selects a word; never opens the editor (stricter than today's Edit) |
| Pen tip resting on text | Selects text / draws | Draws ink only if "Pen writes immediately" is on; ink never touches text (§3.4) |
| Drag starting on an annotation | Nothing / moves it | First press selects; only a selected annotation moves |
| Delete with nothing visibly selected | Deletes a navigator-selected page, even in Read (INV-3) | Nothing. Delete acts only on the visible selection in the focused region, with "Deleted page 7 · Undo" |
| Letter key over a selection | Switches to Edit, second press acts | H, U, S, C, X, E act on the selection at once; toast with Undo |
| Click on a form field | "Switch to Edit to fill" notice | Focus; nothing changes until a character is typed; Esc restores the value |
| Tool key with no selection | Switches to Edit, arms | Enters the task, arms; nothing changes until the first stroke |

Every change is one History entry and one visible toast where it removes something. A thumbnail
click navigates and selects visibly: the page action bar appears beside it, so no hidden
selection changes what Delete does.

### 3.3 Optional Lock

- Title menu → **Lock editing** (Mod+Shift+L **(judgement, verify)**). The title chip shows a
  lock glyph; the dock becomes [Pages] [Unlock] [More]; every targeted act shows one line,
  "Locked · Unlock", with the Unlock button reachable by Tab. Remembered per document for the
  session, or per file name with the drafts (owner question 1).
- Default on for files with a digital signature, whose signature any change breaks (RA-4).
  The facts chip says "Signed by … · Locked to keep the signature".

### 3.4 Pen, finger, mouse and keyboard

- **Mouse (reading):** click clears; drag on text selects; double and triple click select word
  and line; click on a field focuses it; click on an annotation selects it (bar: style, Comment,
  Delete); right-click opens the page menu (§4.1); Space+drag pans; Mod+wheel zooms under the
  pointer; Mod+- at the smallest zoom step enters Pages. **In a task:** only the
  armed tool acts; Esc arms Select, a second Esc is Done.
- **Pen** (direct-display only, `pointerType === 'pen'` and `maxTouchPoints > 0`, M-24):
  with **Pen writes immediately** on, a pen touch in reading enters Mark up with the last pen
  and that first stroke is kept (HIG: mark at first contact; research 15 §5, item 3). The eraser
  end enters Mark up erasing; the barrel button lassos (ADR-0019 §5). The pen never hit-tests
  text in Mark up; in Edit text it is a pointer; a tap on a field focuses it (Scribble works).
  Hover shows the ink dot (M-27). With the setting off, a pen selects text like a mouse.
- **Finger (reading):** one finger scrolls with momentum (M-26); tap on empty paper toggles
  the chrome on compact and medium (M-14); long press 450 ms selects a word or an annotation,
  or opens the page action sheet (M-20); double tap toggles fit-width and 2× (M-19); pinch
  zooms the page, never the chrome (M-18); pinch below fit opens Pages at this page (M-21).
  **In Mark up:** before a pen is seen one finger draws and two fingers pan; after a pen is seen
  fingers navigate; "Draw with finger" sits in the pen options (M-25). Two-finger tap undoes,
  three-finger tap redoes, with visible buttons as the alternative (M-17).
- **Keyboard:** F6 cycles top strip → sidebar (if open) → page → facts chip → dock or task bar
  → action bar → toasts (A-13). The page takes focus when a document opens. **F7 toggles caret
  mode** over the text layer: arrows move a caret, Shift+arrows select, so every selection
  action has a keyboard path (FL-R9; F7 is Firefox's caret-browsing key, which supports the
  choice **(judgement)**). Placement tools (Text, Note, Stamp, Signature, Shape) place at the
  centre of the focused page's visible part on Enter; arrows nudge 1 pt, Shift+arrows 10 pt;
  Enter commits, as created form fields do today.

## 4. Tool access

### 4.1 Five routes

1. **Dock and task bars.** In reading the dock (M2 glass, 48 px fine, 56 px coarse) holds
   **Mark up · Fill & sign · Pages · More**. More opens a menu of the other tasks (Redact, Edit
   text, Compare, Export, Combine with…) with one-line descriptions and keys, and "All actions…
   Mod+K". Entering a task morphs the dock into that task's bar (§8).
2. **Action bars** for selections (M2, 36 px fine, 44 px coarse, 8 px above the anchor, flips
   below near the top strip):
   - Text: Copy · Highlight ▾ (four tints) · Comment · Redact · Edit text · ⋯ (Underline,
     Strikeout, Squiggly, Find all, Copy as Markdown). Labels on fine pointers; icons with
     long-press names on touch (RA-8, I-6).
   - Annotation or lasso selection: colour · width or size · Comment · Duplicate · Delete · ⋯.
   - Page image (Image tool target): Replace… · Extract · Delete · size readout (pt, px, dpi).
   - Page (sidebar thumbnail or Pages cell): ⟲ · ⟳ · Delete · ⋯ (Duplicate, Extract…,
     Insert blank after, Crop…, Move to document ▸).
   - Form field (focused, coarse pointer): an accessory bar above the keyboard: ‹ › next field,
     Clear, Done (M-28).
   - Library cards: Combine · Compare (exactly 2) · Pages · Close.
3. **Context menus** (M4) with static items, dimmed with a reason when they do not apply
   (RA-21): page menu (Rotate left/right, Delete page, Duplicate, Extract…, Crop…, Insert
   blank page after, Add note here, Add text here, Open in Pages); annotation menu; chip
   menu (Rename, Duplicate, Close, Show in Pages).
4. **The title menu** (the active chip): header with thumbnail, name, pages, size and the
   privacy line "On this device · nothing uploaded"; then Rename · Save · Save a copy… ·
   Print · Lock editing; **Document**: Document info and metadata, Password…, Signatures;
   **Add to pages**: Page numbers…, Header and footer…, Bates…, Watermark…; **Convert**:
   Recognize text…, Export as images…, Export as text…; **Combine and split**: Combine with…,
   Split…, Compare with…; then Settings…, About. Items keep their place; "Remove page numbers"
   is a state of the Page numbers sheet, not an appearing item (RA-21).
5. **Actions panel (Mod+K)**, Raycast's Action Panel adapted (RA-22): the first group is the
   current selection's actions with their keys; then a "Find '…' in document" row; then tasks;
   then document actions, open documents, settings. It accepts arguments: "go 42",
   "rotate 3-5 90", "delete 7", "move 5 before 2" (promised in DESIGN §2, not built today).
   On phones it is the search field at the top of the More sheet.

### 4.2 Task bar anatomy

`[✓ Done] [Task name ▾] │ tools … │ inline options of the armed tool │ ⋯`

- **Done** is a neutral glass chip with a check glyph and its label, always at the leading end.
  Mod+Enter triggers the bar's prominent action (Done; Apply in Redact), unless an editor has
  focus, which it commits first (text box, note, paragraph).
- **Placement (RA-2, adapted):** bottom centre on desktop, no free drag (Figma reverted floating
  panels, research 15 §2.9); a vertical rail on either side on tablet landscape and
  compact-height (M-8). The stroke fade (MC-38) replaces RA-2's auto-minimise.
- **Task name ▾** opens the other tasks (switch without leaving).
- **Inline options (FL-R2):** the armed tool's two most-used options sit inside the bar beside
  it: pens show their colour and width; the Highlighter its four tints; shapes stroke colour and
  width; Text its size and colour. Pressing the armed tool again opens the full editor popover
  (today's preset editor, 7.6). Nothing rises over the page by itself (craft review finding 5).
- **Colour budget (C-5):** at most one lime element per bar: the armed tool when it is not an
  ink preset; an armed ink preset gets the n12 ring instead, and then nothing is lime. In Redact
  the prominent action is Apply in the danger colour; nothing is lime.

### 4.3 Every tool: where it lives and how deep

Depth = presses from plain reading until the tool is armed or the action runs (a file picker or
typed value not counted). "Sel." = needs a selection first, which is the first press.

| Tool or action | Home | Fastest route | Depth | Key | Options live |
|---|---|---|---|---|---|
| Pen (3 presets) | Mark up | Dock → Mark up (last pen armed) | 1 (other preset 2) | P (repeat cycles presets), M, 2 | Inline colour + width; full editor on second press |
| Highlighter | Mark up; text bar | Sel. → Highlight | 2 | H | Inline tints |
| Highlight with comment | Text bar | Sel. → Comment | 2 | C | Note editor at the line end (RA-6) |
| Underline, Strikeout, Squiggly | Text bar ⋯ | Sel. → ⋯ → kind | 3 (2 by key) | U, S | Colour in its annotation bar |
| Eraser | Mark up | Mark up → Eraser | 2 | Shift+E | Inline Stroke · Partial, size |
| Lasso | Mark up | Mark up → Lasso | 2 | Q | Selection bar |
| Shapes (rect, ellipse, line, arrow) | Mark up | Mark up → Shapes (last shape shown) | 2 (other shape 3) | R, O, L, A | Inline stroke, width; fill in ⋯ |
| Text box | Mark up, Fill & sign | Mark up → Text | 2 (or page menu → Add text here) | T | Inline size, colour |
| Note | Mark up | Mark up → Note | 2 (or page menu → Add note here) | N | Note popup |
| Image (insert) | Mark up → Insert | Mark up → Insert → Image… | 3 | Shift+I | Image bar |
| Image (page images: replace, extract, delete) | Edit text | Edit text → Images → click an image | 2 | I | Image bar |
| Stamp (Draft, Approved, Confidential) | Mark up → Insert | Insert menu shows the three stamps as chips | 3 | — | Annotation bar |
| Signature | Fill & sign; Insert | Fill & sign → saved signature | 2 (field: click it, 1) | G | Signature sheet (Draw, Type, Image, up to 5 saved, RA-5) |
| Edit text | Text bar; Edit text task | Sel. → Edit text | 2 | E | Editor header (ADR-0020) |
| Form fill | Page | Click the field | 0 | Tab | Accessory bar on touch |
| Form create (7 kinds) | Fill & sign | Fill & sign → Add field ▾ → kind | 3 | — | Field properties popover (8.20) |
| Show fields | Fill & sign | Fill & sign → Show fields | 2 | — | — |
| Redact text or area | Text bar; Redact | Sel. → Redact; or Redact → drag | 2 | X | Marks list in the sidebar's Review |
| Find sensitive data, mark matches | Redact | Redact → Find sensitive… | 2 | — | Review list |
| Apply redactions | Redact | Redact → Apply n… → confirm | 2 from the task | Mod+Enter | Confirm sheet; report linked from the toast |
| Crop | Page menu; Pages ⋯ | Right-click → Crop… | 2 | — | Crop sheet (margins, draw area) |
| Rotate page | Page bar; page menu | Select thumbnail → ⟳ | 2 | Shift+R, Shift+Alt+R | — |
| Delete, duplicate, extract, insert | Page bar; Pages | Select thumbnail → action | 2 | Delete, Mod+D, Mod+Shift+E | — |
| Move page | Sidebar; Pages | Drag the thumbnail | 1 | Alt+arrows | — |
| Split, interleave, reverse, resize, merge into | Pages ⋯; title menu (Split) | Pages → ⋯ → item | 3 | — | Sheets (12.14–12.17) |
| OCR | Facts chip; title menu | Chip "No text on 2 pages · Recognize" | 1 (+ confirm) | — | Tool sheet; languages in Settings |
| Compare | More; Library | More → Compare | 2 (key 1) | 4 | Compare bar |
| Page numbers, header and footer, Bates, watermark | Title menu | Title → item | 2 | — | Tool sheet with live preview |
| Metadata | Title menu | Title → Document info | 2 | — | Info sheet fields |
| Password, remove password | Title menu; Export | Title → Password… | 2 | — | Sheet; or Export option |
| Sign with certificate | Fill & sign; Export | Fill & sign → Certificate… | 2 | — | Step inside Export ("Sign and save copy") |
| Compress | Export | Export → Size: Smaller | 2 | — | Export sheet with estimates |
| Export, convert (PDF, images, text) | Export sheet; title menu | Export → Format | 2 | Mod+Shift+S | Export sheet |
| Batch | Library; Mod+K | Library → Batch… | 1 | — | Batch sheet (12.24) |
| Find | Top strip | Find | 1 | Mod+F | Inline in the top strip; results popover |
| Go to page, outline, layout, zoom | Page pill | Page pill → item | 2 | Mod+G, Mod+=, Mod+-, Mod+0 | Page pill popover |

No tool is deeper than 3 presses from reading; today the floor is 3 (Edit → group → tool).

### 4.4 Key map

| Keys | Meaning |
|---|---|
| `0` · `1` · `2`/`M` · `3` · `4` | Library · reading (Done) · Mark up · Pages · Compare |
| `F` · `X` · `E` | Fill & sign · Redact (marks a selection) · Edit text (opens a selection) |
| `P` `H` `Shift+E` `Q` `R` `O` `L` `A` `T` `N` `I` `Shift+I` `G` `V` | Tool keys as today; each enters its task |
| `H` `C` `U` `S` `X` `E` with a text selection | Highlight · Comment · Underline · Strikeout · Redact · Edit text |
| `Mod+S` · `Mod+Shift+S` · `Mod+K` · `Mod+F` · `Mod+G` · `Mod+B` | Save · Export (judgement: Firefox binds Ctrl+Shift+S to screenshots; verify) · Actions · Find · Go to page · sidebar |
| `Esc` | Clears the top thing: menu, selection, armed tool (to Select), then the task |
| `Mod+Enter` | The task bar's prominent action |
| `F7` · `\` · `?` | Caret mode · hide all chrome (Focus, RA-12) · shortcuts |

Keys `2`, `3`, `4` change little for today's users; `1` now means "leave the task" instead of
"lock". Number keys never fire while focus is in a text field.

## 5. Saving and safety

- **Save in place.** Mod+S or Save (in the top strip once edited) writes back to the original
  where a File System Access handle with write permission exists (Chromium desktop; the first
  write in a session shows the browser's prompt), then verifies: "Saved · verified" (RA-14).
  Without a handle, Save opens the save picker once and keeps the new handle; Firefox and Safari
  download a file with the same name. On phones Share sends the PDF through the Web Share API,
  with Save to device as the fallback (M-36).
- **Save a copy** is the Export sheet task: format, size, password, metadata, flatten,
  certificate, name. It merges today's export, compress, images, text and password dialogs
  (12.1, 12.3, 12.5, 12.20–12.22) and removes the empty Compression heading (INV-18).
- **Drafts.** After every History step (debounced 2 s) and on `visibilitychange: hidden`, open
  documents and their History are snapshotted to OPFS, on this device only (M-34). The Library
  shows "Continue · 2 edited documents · 18:40 · Restore" on the next launch; Recents reopen the
  draft, not the original, with "draft" on the row (fixes INV-7, F-4). Drafts expire after 30
  days, are listed in Settings → Privacy and storage, and clear with one button (owner question 5).
- **Unsaved state** is a dot on the chip and "Edited" beside the title; a `beforeunload` guard
  runs on desktop while edits are not saved, even with a draft (M-34). Closing a document keeps
  its draft and shows "Closed report.pdf · draft kept · Undo".
- **Undo and Redo** sit in the top strip on every size, dimmed when empty (FL-R3; phones in
  reading show Undo once there is history, and Redo joins in tasks). A long press
  on Undo opens a History scrubber; History is also a sidebar section with times (RA-11). Every
  destructive step and every failure shows a toast: "Deleted page 7 · Undo", "Could not open
  scan.pdf: damaged file" (INV-6). An undone change off screen scrolls into view (MC-32).
- **Redaction** stays undoable in the app and final in the saved file. Leaving Redact with
  unapplied marks asks once; the saved file states whether marks remain.

## 6. Layout per size class

### 6.1 Classes

Size classes from research 19 (M-1): compact < 600, medium 600–839, expanded 840–1199, large
1200–1599, xlarge ≥ 1600, plus compact-height below 480 px. Density follows the pointer (M-2):
44 px targets and 16 px inputs on coarse pointers.

- **Top strip:** 44 px fine (M3 glass, σ 8, fading bottom edge, G-19); 52 px on medium coarse;
  44 px plus safe area on compact.
- **Dock:** 48 px fine, 56 px coarse, centred on the screen 16 px above the bottom edge
  (`max(safe-area, 12px)` on phones). **Task bar:** 48 px fine, 64 px coarse.
- **Page pill:** M1 chip, 32 px fine, 44 px coarse, bottom trailing, 16 px inset: "3 / 12 ·
  130 %"; opens Go to page, Contents (when the file has an outline), Fit width, Fit page, zoom
  steps, Continuous · Single · Two-up. It replaces the status bar's page and zoom (3.14, 3.15)
  and the layout switch (3.11).
- **Sidebar:** one panel, sections Pages · Contents · Review · History; docked 280 px on
  expanded and wider, overlay 320 px on medium, bottom sheet (40 % and 92 % detents) on compact.
  Closed by default, remembered per device.
- **Hiding:** on compact and medium the top strip and dock hide after 24 px of downward scroll
  in reading and return on upward scroll, a tap on the page, focus or a sheet (M-14). On
  expanded and wider nothing hides by itself; `\` hides all chrome by choice (RA-12). Task bars
  never hide. See §10.3 on A-12.

### 6.2 Library

```
Phone 390 (first visit)            Phone 390 (with files)
┌──────────────────────────────┐   ┌──────────────────────────────┐
│ ◆ Recto           EN ▾    ⚙  │   │ ◆ Recto                ⌕  ⚙  │
│░░░░░░░ aurora, still ░░░░░░░░│   │ ┌ Continue ────────────────┐ │
│░░  Read, mark up, sign  ░░░░░│   │ │ 2 edited documents 18:40 │ │
│░░  and arrange PDFs.    ░░░░░│   │ │              [ Restore ] │ │ lime
│░░  Nothing leaves this  ░░░░░│   │ └──────────────────────────┘ │
│░░  device.              ░░░░░│   │ Open                 Select  │
│                              │   │ ┌──────────┐ ┌──────────┐    │
│        Try the sample ›      │   │ │  thumb   │ │  thumb   │    │ 3:4, 2 cols
│                              │   │ │ report • │ │ agreement│    │ • unsaved
│                              │   │ └──────────┘ └──────────┘    │
│                              │   │ Recent                       │
│                              │   │ ▤ report-v2.pdf   draft · 1 d│ 44 px rows
│ ╭──────────────────────────╮ │   │ ▤ lease.pdf             2 d  │
│ │       + Open PDF         │ │56 │ ╭──────────────────────────╮ │
│ ╰──────────────────────────╯ │   │ │       + Open PDF         │ │ neutral here
└──────────────────────────────┘   └──────────────────────────────┘
 Select: cards get check circles; the bottom button becomes [Combine 2] [Compare] [Close].

Tablet portrait 820
┌──────────────────────────────────────────────────┐
│ ◆ Recto                         EN ▾   ⚙   ⌘K    │
│░░░░░░░ Read, mark up, sign and arrange PDFs. ░░░░│
│░░░░░░░ [ + Open PDFs… ]   Try the sample     ░░░░│
│ Continue: 2 edited documents · 18:40  [Restore]  │
│ Open (3)                       Select   Batch…   │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │ 4 cols, 160 px
│ │ card │ │ card │ │ card │ │ card │              │
│ └──────┘ └──────┘ └──────┘ └──────┘              │
│ Recent ··········································│
└──────────────────────────────────────────────────┘

Desktop 1440
┌──────────────────────────────────────────────────────────────────────────────┐
│ ◆ Recto                                              EN ▾    ⚙    ⌘K         │
│░░░░░░░░░░░░░░░░░░░░░ aurora field: still, moves on events ░░░░░░░░░░░░░░░░░░ │
│░░░░░░░░  Read, mark up, sign and arrange PDFs. Nothing leaves this device.  ░│
│░░░░░░░░  [ + Open PDFs… ]   Try the sample   · or drop files anywhere       ░│
│  ┌ Continue · 2 edited documents · 18:40 ─────────────────── [ Restore ] ┐   │
│  Open (3)                                              Select    Batch…      │
│  ┌────────┐ ┌────────┐ ┌────────┐   one click opens; ○ on hover selects;     │
│  │  card  │ │  card  │ │  card  │   drag a card to reorder (= Combine order) │
│  └────────┘ └────────┘ └────────┘                                            │
│  Recent                                                                      │
│  ▤ report-v2.pdf     10 pages · draft kept · yesterday                  ⋯    │
│  ▤ lease.pdf          4 pages · 2 days ago                              ⋯    │
│              ╭────────────────────────────────────────────────╮              │
│              │ 2 selected   Combine   Compare   Pages   Close │              │ M2, on selection
│              ╰────────────────────────────────────────────────╯              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 A document being read

```
Phone 390                          Tablet portrait 820
┌──────────────────────────────┐   ┌──────────────────────────────────────────────┐
│ ‹ 3   report.pdf ▾  ↶  ⌕   ↑ │   │ ◧ ◆ [report.pdf ▾] agreement  +  ↶ ↷ ⌕ ⌘ ↑   │ 52
│╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌│   │╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌│
│ ┌──────────────────────────┐ │   │   ┌──────────────────────────────────────┐   │
│ │                          │ │   │   │                                      │   │
│ │  page, fit width,        │▐│   │   │  page, fit width (772 px)            │   │
│ │  8 px margins            │ │   │   │                                      │   │
│ │                          │ │   │   │  [facts chip: 12 form fields ·       │   │
│ │                          │ │   │   │   Fill & sign]  (once, top leading)  │   │
│ └──────────────────────────┘ │   │   └──────────────────────────────────────┘   │
│                    ╭───────╮ │   │                                   ╭────────╮ │
│                    │ 3 / 12│ │   │                                   │ 3 / 12 │ │
│ ╭──────────────────────────╮ │   │    ╭──────────────────────────────────╮      │
│ │ Pages Mark up  Sign  More│ │56 │    │ Mark up   Fill & sign   Pages  ⋯ │      │ 56
│ ╰──────────────────────────╯ │   │    ╰──────────────────────────────────╯      │
└──────────────────────────────┘   └──────────────────────────────────────────────┘
 ▐ = scrubber for files over 20 pages (M-15). Top strip and dock hide on scroll down.

Desktop 1440
┌──────────────────────────────────────────────────────────────────────────────┐
│ ◧ ◆ [report.pdf ▾] agreement  letter-scan  +          ↶ ↷   ⌕ Find   ⌘K   ↑  │ 44
│╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ fading glass edge ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌  │
│        ┌──────────────────────────────────────────────────────────┐        ▕ │
│        │                                                          │        ▕ │ edge
│        │   page, fit width (1100 px cap from xlarge, M-11)        │          │ scrubber
│        │                                                          │          │
│        │   select text → [Copy  Highlight▾  Comment  Redact  Edit text  ⋯]   │
│        │                                                          │          │
│        └──────────────────────────────────────────────────────────┘          │
│                ╭──────────────────────────────────────────────╮  ╭────────╮  │
│                │  Mark up    Fill & sign    Pages    More ⋯   │  │ 3 / 12 │  │ 48
│                ╰──────────────────────────────────────────────╯  ╰────────╯  │
└──────────────────────────────────────────────────────────────────────────────┘
 ◧ sidebar toggle (Mod+B). "Save" appears left of ↑ once the document is edited.
```

### 6.4 A document being marked up

```
Phone 390                          Tablet portrait 820
┌──────────────────────────────┐   ┌──────────────────────────────────────────────┐
│ ‹ 3   report.pdf ▾    ↶   ↷  │   │ ◧ ◆ [report.pdf ▾] •   Save   ↶ ↷  ⌕  ⌘  ↑   │
│ ┌──────────────────────────┐ │   │   ┌──────────────────────────────────────┐   │
│ │  one finger draws,       │ │   │   │  pen draws at first contact; fingers │   │
│ │  two fingers pan, zoom   │ │   │   │  navigate once a pen has been seen   │   │
│ │                          │ │   │   │                                      │   │
│ └──────────────────────────┘ │   │   └──────────────────────────────────────┘   │
│ ╭──────────────────────────╮ │   │ ╭──────────────────────────────────────────╮ │
│ │ ● ● ● ● ● ● ●  ── 1.5 pt │ │44 │ │[✓ Done] Mark up ▾│●●●▬│● 1.5│⌫ ◌│▭▾ T ▢ +│ │ 64
│ ╰──────────────────────────╯ │   │ ╰──────────────────────────────────────────╯ │
│ ╭──────────────────────────╮ │   └──────────────────────────────────────────────┘
│ │[✓]│ ● ● ● ▬ ⌫ ◌ ▭ T ▢ + ›│ │64  Tablet landscape or compact-height: the bar can become a
│ ╰──────────────────────────╯ │    64 px vertical rail on either side, Done at its top (M-8).
└──────────────────────────────┘
 Options row appears when the armed tool is tapped again; the bar scrolls with a 24 px fade.

Desktop 1440
┌──────────────────────────────────────────────────────────────────────────────┐
│ ◧ ◆ [report.pdf ▾] •  agreement  +        Edited  Save   ↶ ↷   ⌕ Find  ⌘K  ↑ │
│        ┌──────────────────────────────────────────────────────────┐          │
│        │  armed pen draws; text is never hit-tested; Esc → Select │          │
│        │  → Esc → Done                                            │          │
│        └──────────────────────────────────────────────────────────┘          │
│      ╭──────────────────────────────────────────────────────────────────╮    │
│      │[✓ Done] Mark up ▾ │ ● ● ● ▬ │ ● 1.5 pt │ ⌫  ◌  ↖ │ ▭▾  T  ▢ │ + ▾│    │ 48
│      ╰──────────────────────────────────────────────────────────────────╯    │
│              (lime under-light beneath the armed non-ink tool, AU-10)        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.5 The pages overview (Pages task)

```
Phone 390                          Tablet portrait 820
┌──────────────────────────────┐   ┌──────────────────────────────────────────────┐
│ ‹ 3   report.pdf ▾    ↶   ↷  │   │ ◧ ◆ [report.pdf ▾]             ↶ ↷  ⌕  ⌘  ↑  │
│ 12 pages            S ──●─ L │   │ report.pdf · 12 pages              S ──●── L │
│ ┌──────┐ ┌──────┐ ┌──────┐   │   │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
│ │  1   │ │  2   │ │  3   │   │   │ │ 1  │ │ 2  │ │ 3  │ │ 4  │ │ 5  │           │ 5 cols
│ └──────┘ └──────┘ └──────┘   │   │ └────┘ └────┘ └────┘ └────┘ └────┘           │
│ ┌──────┐ ┌──────┐ ┌──────┐   │   │ ┌────┐ ┌────┐ ┌────┐                         │
│ │  4   │ │ ✓ 5  │ │  6   │   │   │ │ 6  │ │✓ 7 │ │ 8  │   + Show agreement.pdf  │
│ └──────┘ └──────┘ └──────┘   │   │ └────┘ └────┘ └────┘                         │
│ ╭──────────────────────────╮ │   │  ╭────────────────────────────────────────╮  │
│ │[✓]│ ◀ ▶  ⟳  Delete  ⋯    │ │64 │  │[✓ Done] 1 selected │ ⟲ ⟳ │ Delete │ ⋯  │  │ 56
│ ╰──────────────────────────╯ │   │  ╰────────────────────────────────────────╯  │
└──────────────────────────────┘   └──────────────────────────────────────────────┘
 Phone: tap selects (check marks), long press lifts and drags (in-house gesture core, not
 HTML5 drag), ◀ ▶ move the selection one place for one-handed reordering (INV-R8).

Desktop 1440
┌──────────────────────────────────────────────────────────────────────────────┐
│ ◧ ◆ [report.pdf ▾]  agreement  +                    ↶ ↷   ⌕ Find   ⌘K   ↑    │
│  report.pdf · 12 pages                                     S ────●──── XXL   │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                     │
│  │ 1  │ │ 2  │ │ 3  │ │ 4  │ │✓ 5 │ │ 6  │ │ 7  │ │ 8  │                     │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                     │
│  agreement.pdf · 4 pages (shown as a section)                         ⋯      │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐            + Show letter-scan.pdf  + Insert file│
│  └────┘ └────┘ └────┘ └────┘                                                 │
│     ╭──────────────────────────────────────────────────────────────────╮     │
│     │[✓ Done] Pages ▾ │ 1 selected │ ⟲ ⟳ │ Delete  Duplicate  Extract ⋯│     │
│     ╰──────────────────────────────────────────────────────────────────╯     │
└──────────────────────────────────────────────────────────────────────────────┘
 Enter: the current page shrinks into its cell (MC-9). Done, a double-click or a pinch out
 on a cell grows it back into reading at that page.
```

### 6.6 Placement matrix

| Surface | compact | compact-height | medium | expanded | large | xlarge |
|---|---|---|---|---|---|---|
| Open documents | "‹ N" → Library | same, top bar hidden | Chips ≥ 2 docs | Chips | Chips | Chips |
| Title menu | Action sheet from the title | Action sheet | Popover menu | Menu | Menu | Menu |
| Undo / Redo | Top bar: Undo once there is history; Redo too in tasks | Rail top | Top strip | Top strip | Top strip | Top strip |
| Find | Top bar ⌕; field above keyboard, results in a 40 % sheet | Side sheet | Inline in top strip | Inline | Inline, labelled | Inline, labelled |
| Actions (Mod+K) | Search field in the More sheet | same | Centred, top third | Centred | Centred | Centred |
| Save / Share | Share (↑) in top bar | Pill ⋯ | Save + ↑ | Save + ↑ | Save + ↑ | Save + ↑ |
| Dock (reading) | Bottom capsule 56, hides on scroll | 44 px pill: page · Mark up · ⋯ | Bottom 56, hides on scroll | Bottom 48 | Bottom 48 | Bottom 48 |
| Task bar | Bottom capsule 64, scrolls | Vertical rail 64, either side | Bottom 64; rail in landscape | Bottom 48 | Bottom 48, group labels | same |
| Tool options | Row above the bar on second tap | Beside the rail | Inline + popover | Inline + popover | Inline + popover | same |
| Action bar | At the selection, 44 px targets | same | same | 36 px | 36 px | 36 px |
| Sidebar | Bottom sheet 40 % / 92 % | Side sheet 360 | Overlay 320 | Docked 280 | Docked 280 | Docked 280, open by default if last open |
| Page pill | Above the dock while scrolling; scrubber | Pill | Bottom trailing | Bottom trailing | same | same |
| Facts chip | Above the dock | Top leading | Top leading | Top leading | same | same |
| Tool sheets (page numbers, OCR, crop) | Bottom sheet 40 %, preview above | Side sheet | Side sheet 360, no scrim | same | same | same |
| Task sheets (Export, Combine) | Full sheet, action at the bottom | Full sheet | Form sheet ≤ 640 | Side sheet 400 | Side sheet 400 | same |
| Confirmations, password | Modal sheet | Modal sheet | Centred dialog | Centred | Centred | Centred |
| Toasts | Above the dock, centred | Above the pill | Bottom leading | Bottom leading | same | same |
| Settings | Full sheet | Full sheet | Form sheet | Side sheet 480 | same | same |

## 7. The sixteen jobs

### 7.1 Paths

Start state as in `current-flows.md` §1, adapted: one document open in plain reading, sidebar
closed, nothing selected. "+ save" is Mod+S in place (1); the save picker adds 1 where there is
no handle.

- **J1 First visit.** Mouse 2: Open PDFs… · pick (drop 1; Try the sample 1). Keyboard 2: Enter
  on the focused Open PDFs… · pick. Touch 2: Open PDF (thumb zone) · pick. Installed: Open with
  or Share to Recto opens directly (M-35).
- **J2 Open one PDF, read page 7.** Mouse 2 + 1 per jump (scrubber or thumbnail). Keyboard 2
  (the page has focus on open) + 2 per jump (Mod+G, "7⏎"). Touch 2 + 1 (scrubber).
- **J3 Open two, combine.** Mouse 3: Open PDFs… · pick both · Combine 2 files; by drop 2. No
  dialog: card order is the order; originals stay open; "Combined 2 files · Undo". Keyboard ≈3:
  Mod+O · pick · Enter (focus lands on Combine 2 files). Touch 3: Open PDF · pick both · Combine.
- **J4 Move page 5 before 2, delete 7.** Mouse 4: sidebar ◧ · drag thumbnail 5 before 2 ·
  click 7 · Delete in its bar; no view switch (FL-R5); 3 with the sidebar open. Keyboard ≈11:
  Mod+B · arrows to 5 (≈3) · Alt+Up ×3 · arrows to 7 (≈2) · Delete · Esc; ≈6 with arguments
  (Mod+K "move 5 before 2" ⏎, Mod+K "delete 7" ⏎). Touch 5: Pages · long-press-drag 5 before
  2 · tap 7 · Delete · Done.
- **J5 Highlight and comment.** Mouse 4: drag across the sentence · Comment (one highlight with
  its note, RA-6) · type · Esc or click outside. Keyboard ≈7: F7 · arrows (≈2) · Shift+arrows ·
  C · type · Esc. Touch 5: long press · adjust handles · Comment · type · Done (accessory bar).
- **J6 Write two words, two colours.** Mouse 4: Mark up (last pen) · draw · red · draw. Keyboard:
  n/a. Touch 4 (presets lead the bar, so all fit); stylus 3: write (opens Mark up) · red · write.
- **J7 Fill three fields and a checkbox.** Mouse 7: click field 1 · type · Tab · type · Tab ·
  type · click the box. Keyboard ≈8: Tab (≈1) · type · Tab · type · Tab · type · Tab · Space.
  Touch 7: tap · type · Next · type · Next · type · tap; a field under 12 px zooms to 16 px text
  on focus (judgement); the accessory bar follows `visualViewport` (M-4).
- **J8A Place a signature.** Mouse 3: Fill & sign · saved signature · click the spot; first time
  5: Fill & sign · New signature · draw · Save · click. On a signature field 2: click it · pick.
  Keyboard ≈7: F · F6 to the bar · arrow to the signature · Enter (arms) · Enter (places at the
  page centre) · arrows (≈1) · Enter. Touch 3 (first time 5).
- **J8B Sign with a certificate, saved.** Mouse 6: Fill & sign · Certificate… · pick the .p12 ·
  password · Sign and save copy (Check, Use and Export merged) · picker. Keyboard ≈8: Mod+K
  "certificate" ⏎ (≈3) · pick (≈2) · password · Mod+Enter · picker. Touch 6.
- **J9 Edit a word.** Mouse 4: double-click "2024" (selects) · Edit text (the editor opens with
  the word selected, not the caret at the start) · type 2025 · Esc or click outside; the
  transient task ends. Keyboard ≈7: F7 · arrows (≈2) · Shift+Mod+Right · E · type · Esc.
  Touch 4: long press · Edit text · type · Done.
- **J10 Redact text and an area, apply.** Mouse 5: select the e-mail · Redact (marks it, opens
  Redact with Mark armed) · drag the area · Apply 2… · Apply; a toast "2 redactions applied ·
  Report" replaces the result sheet's Close. Keyboard ≈7: X · Find sensitive… (≈2) · Mark N
  (≈2) · Mod+Enter · Enter; text plus a keyboard-drawn area ≈12. Touch 6: long press · handles ·
  Redact · drag the area · Apply 2… · Apply.
- **J11 OCR a scan.** Mouse 2: the facts chip "No text on 2 pages · Recognize text" · Recognize
  2 pages; it runs in the background with a ring on the chip (AU-11) and a toast when done; Find
  on a textless page offers the same button (FL-R7). Keyboard ≈3: F6 to the chip · Enter ·
  Enter. Touch 2.
- **J12 Compare two open versions.** Mouse 3 from the Library: check A · check B · Compare
  (defaults run at once). From a document with B on disk 3: More · Compare · pick. Keyboard ≈5:
  arrows and Space for A and B (≈4) · `4`. Touch 3: long press A (enters Select) · tap B ·
  Compare; compact shows one page at a time with A · B · Changes (M-38).
- **J13A Save.** Mouse 1: Save; +1 for the first permission prompt or picker. Keyboard 1
  (Mod+S). Touch 2: Share · target.
- **J13B Compress, then save.** Mouse 4: Export · Size: Smaller · Save copy · picker. Keyboard
  ≈5: Mod+Shift+S · Tab to Size · Right · Mod+Enter · picker. Touch 5: title · Save a copy… ·
  Smaller · Share · target.
- **J14 Return via Recents.** Mouse 1: the row "draft · yesterday" reopens the draft on every
  browser (original: 1–2 with a handle, 2 without), or Restore on launch. Keyboard ≈1–3 (focus
  starts on Restore). Touch 1 (2 without a draft).
- **J15a Find and step.** Mouse 3: Find · type · Enter. Keyboard 3: Mod+F · type · Enter. Touch
  3: ⌕ · type · Search key; no panel covers the page.
- **J15b Jump to an outline entry.** Mouse 2: page pill · Contents entry. Keyboard ≈4: Mod+G ·
  Down into Contents · arrows · Enter. Touch 3: Pages · Contents (remembered) · entry.
- **J16 Page numbers.** Mouse 4: title · Page numbers… · "Page 1 of N" · Apply, previewed live.
  Keyboard ≈5: Mod+K "page numbers" ⏎ (≈3) · arrow · Mod+Enter. Touch 4; the preview stays
  visible above the 40 % sheet (INV-1).

### 7.2 Step counts

Today from `current-flows.md` §20; best reference from research 15 §4 (— where it has none;
"d" = derived from its per-action counts, judgement).

| Job | Mouse today → C | Keyboard today → C | Touch today → C | + save today → C | Best reference |
|---|---|---|---|---|---|
| J1 First visit | 2 → 2 | 2 → 2 | 2 → 2 | — | 1 (Preview, Finder) |
| J2 Open and read | 2 → 2 | ≈3 → 2 | 3 → 2 | — | 1 (Preview) |
| J3 Open two, combine | 4 → 3 (drop 2) | ≈8 → ≈3 | 4 → 3 | +3 → +1 | 4 (PDF Expert) |
| J4 Move one page, delete one | 5 → 4 (3 open sidebar) | ≈12 → ≈11 (≈6 args) | 4 + no move → 5 | — | 3 d (Preview: drag, select, Delete) |
| J5 Highlight and comment | 7 → 4 | — → ≈7 | ≈8 → 5 | — | 4 (Acrobat) |
| J6 Write, two colours | 5 → 4 | n/a | 5 (stylus 3) → 4 (3) | — | 3 d (Notability, no mode) |
| J7 Fill 3 fields, 1 box | 8 → 7 | ≈11 → ≈8 | ≈9 → 7 | +3 → +1 | 7 d (Preview: click, type per field) |
| J8A Signature | 6 → 3 (first 5) | — → ≈7 | 6 → 3 | +3 → +1 | 3 (Acrobat, Firefox, PDF Expert) |
| J8B Certificate, saved | 8 → 6 | ≈12 → ≈8 | 8 → 6 | included | — |
| J9 Edit a word | 5 → 4 | ≈10 → ≈7 | 5 → 4 | — | 3 (PDF Expert) |
| J10 Redact text + area | 8 → 5 | ≈13 → ≈7 | 9 → 6 | +3 → +1 | 3, phrase only (Preview) |
| J11 OCR | 4 → 2 | ≈7 → ≈3 | 4 → 2 | +3 → +1 | — |
| J12 Compare two open | 4 → 3 | ≈7 → ≈5 | 6 → 3 | — | — |
| J13A Save | 3 → 1 | 3 → 1 | 3 → 2 | — | 0 (Preview autosave) |
| J13B Compress, save | 8 → 4 | ≈12 → ≈5 | 8 → 5 | included | — |
| J14 Reopen from Recents | 1–3 → 1 | ≈5–6 → ≈1–3 | 3 → 1 | — | 1 (Preview restores windows) |
| J15a Find, step | 3 → 3 | 3 → 3 | 4 → 3 | — | — |
| J15b Outline entry | 3 → 2 | ≈6 → ≈4 | 4 → 3 | — | — |
| J16 Page numbers | 4 → 4 | ≈7 → ≈5 | 4 → 4 | +3 → +1 | — |
| **Total** | **90–92 → 64** | **gaps on J5, J8A → none** | **≈99 + 1 gap → 70** | **+18 → +6** | |

On research 15's eleven-job set (§4) C takes 26–30 steps against 25–27 for the best app of each
row and 40–46 for Recto today. C is one step behind on editing a line (Edit text stays a separate
act, by design), redacting a phrase (Apply is a confirmed step, not a side effect of saving) and
moving a page with the sidebar closed; it is level or better elsewhere. The FL-R targets are met
except two clauses: FL-R1's "J7 ≤ 1 + one step per field", which no reference app meets under
the counting rule either (C is level with Preview), and FL-R5's 3 steps, met only with the
sidebar open (4 when closed).

### 7.3 Why tasks add no steps to everyday jobs

- **Highlight, comment, underline, redact, edit text** start from a selection, which every app
  needs. The action bar is the second step; no task is entered (2 steps; Acrobat 2).
- **Filling** is a click into a field, as in Preview, Chrome and Firefox (research 15 §0). The
  task Fill & sign is never needed to fill.
- **Signing**: the first press is "Fill & sign", the step every reference spends on "Sign". The
  saved signatures sit inline in the bar, so the second press is the signature and the third
  is the click (3 = Acrobat, Firefox, PDF Expert). A signature field skips the task (2).
- **Writing**: Mark up is the pen-tip button of Preview and Chrome (one press), with the last
  pen already armed; a stylus skips it.

### 7.4 Discovery

**First visit.** The Library launcher (RA-19) says what Recto does in one line, offers Open
PDFs… and **Try the sample**, shows EN · TR and "Nothing leaves this device" (FL-R10). The
sample is a short bundled PDF built from the demo fixtures (fields, a paragraph, a signature box,
a scanned page) whose own text invites the everyday acts: "Select this sentence and choose
Highlight", "Click a field and type", "Sign on page 3", "This page is a scan: try Recognize
text". The document teaches; there is no overlay tour.

**First document.** The dock shows its labels and does not hide until it has been used once.
One **facts chip** may appear 600 ms after opening, chosen from what the file contains: "12 form
fields · Fill & sign", "No text on 2 pages · Recognize text", "Signed by … · Signatures",
"Outline · 8 chapters", "Restored edits from 18:40 · Discard". One at a time, once per file,
collapsing to an icon after 8 s. The first text selection shows the labelled action bar; tooltips
carry keys (I-6). Mod+K with nothing typed lists the tasks with one-line descriptions, which
answers "what can this app do?" in one press.

**On a phone.** The capsule labels its four items (Pages, Mark up, Sign, More; Turkish
Sayfalar, İşaretle, İmzala, Daha fazla). More opens task tiles with one line each and a search
field for every action. Long press on an icon names it (tooltips never show on touch, INV-6).
Text selection shows the app's bar (`-webkit-touch-callout: none`, M-20); whether Android
Chrome's own selection menu still appears is unverified.

## 8. Glass, light and motion in this model

The design language is specified separately; this is where C puts each effect.

- **Glass (G-1, G-3).** M1 chips (title, page pill, facts, Done); M2 bars (dock, task bars,
  action bars, toasts, Library selection bar); M3 top strip and sidebar; M4 menus, popovers and
  the Actions panel; M5 sheets and confirmations. Never on pages, thumbnails, card art, editors
  or inputs (research 16 §7.9, A-6); σ ≤ height / 5 on bars (G-32); Clear · Tinted · Solid
  (G-11, A-17).
- **Steady state (RA-15).** In reading on expanded and wider, only the dock and the page pill
  float, and fit-page leaves a 72 px bottom inset so the page clears them. On phones the chrome
  hides on scroll. Task bars float over the page by necessity and fade to 20 % during strokes
  (MC-38).
- **Light.** The aurora's field lives on the Library (AU-4, AU-5, AU-7 budget). In a document
  the only light is beneath glass: the under-light below the armed tool of a task bar (AU-10),
  the processing ring on the dock or facts chip while OCR, Compare or export runs (AU-11), and
  the drop overlay (AU-13). Success blooms on the Library after Combine and Restore and as a rim
  on the Save chip after a verified save (AU-12); never for redaction or deletion. Light never
  touches a page (A-6).
- **Motion (MO-1).** The dock morphs into a task bar and back by `clip-path` on one glass shape,
  not a swap (MC-8, MC-11, `--spring-smooth`). Reading ⇄ Pages is a zoom: the page shrinks into
  its cell and grows back (MC-9, view transition, `--spring-glide`). Library card ⇄ document
  (MC-2, MC-3). Action bars grow from the selection's edge (MC-13). Sheets follow the finger and
  project their throw (MC-18). Toasts (MC-31), undo reveal (MC-32), press (MC-21). Tool switching
  by key never animates (MO-1 principle 6). Reduced motion: cross-fades ≤ 150 ms (A-9).
- **Native, calm and expensive (judgement, from research 15 §2.13 and research 20 §0).** The
  page is the only bright, large thing. Reading has no lime; a task has at most one lime element
  (C-5). Things return the way they came (Done reverses the morph, Pages the zoom). The app speaks
  in facts, one at a time; saving is a word changing to "Saved", not a form; every task ends the
  same way. Sentence case, three type sizes per surface (T-5, T-9); Phosphor outline at rest,
  fill when armed (I-1, I-2).

## 9. Component families

| Family (inventory §) | Fate | Becomes | Main code impact |
|---|---|---|---|
| 3 App frame | Replace | Top strip (mark, chips, title menu, Undo, Redo, Find, Save, Share, Actions); stage without header; page pill | `shell/AppShell.tsx` grid from 3 × 3 to stage plus overlays; `TabBar.tsx` rewritten as `TopStrip`; `ModeSwitch` in `Stage.tsx` and `viewer/LayoutSwitch.tsx` removed; `StatusBar.tsx` removed (zoom and page to `PagePill`, progress to toasts and the ring, privacy to the Library and title menu); scroll proxies and drop overlay kept |
| 4 Home | Replace | Library: launcher, Restore, cards (single click opens, check circle selects), Recents with drafts, selection bar, Batch… | `home/HomeView.tsx` rewritten; `shell/EmptyState.tsx` merged into the launcher; `home-model.ts` `clickSelection` gains a Select mode; card drag to reorder |
| 5 Navigator | Merge | One sidebar: Pages (draggable), Contents, Review, History; Find moves to the top strip; Files list and Changes leave | `LeftRail.tsx` → `Sidebar.tsx`; `PagesPanel.tsx` gains drag (existing `dnd/page-drag.ts`) and a visible selection bar; `SearchPanel.tsx` → `FindField` + results popover; `FilesList` removed; `ChangesPanel` moves into Compare |
| 6 Inspector | Remove | Properties → annotation bar popover; OCR → OCR sheet and a Review filter; Signatures → title menu sheet and facts chip; History → sidebar; Info → Document info sheet; Selection → action bar label | `RightPanel.tsx` deleted; its sections re-hosted unchanged |
| 7 Tool bar | Replace | Dock (reading) and one task bar per task, sharing tool buttons, the pen preset well, shapes, stamps and fields menus | `FloatingToolbar.tsx` and `.groups.ts` → `Dock`, `TaskBar`, `tasks.ts` registry; options tier → inline options plus the existing editor popover; `tool-store` `barGroup` → task; width morph → `clip-path` (MC-11); stroke fade kept |
| 8 Bars, menus, popovers | Keep, extend | Action bars for text, annotation, ink, image, page, card, field; title menu (absorbs the Document menu, static items); page menu with page actions in reading | `ReadSelectionBar.tsx` gains Comment-as-highlight (RA-6), Redact, ⋯; `ContextualBar.tsx` reused for the sidebar's page selection; `DocumentMenu.tsx` → `TitleMenu`; Appearance submenu → Settings; privacy popover → Settings and title menu header |
| 9 Canvas overlays | Keep | All 15 overlays; caret mode added; notices removed | `FormLayer.tsx` loses the "Switch to Edit" notice (9.14); `TextLayer.tsx` loses the double-click hint (9.4), gains caret mode; `AnnotationLayer.tsx` selects in reading, creates only in tasks; `hit-order.ts` live targets per state |
| 10 Arrange | Merge, rename | The Pages task grid: sections per document, visible size slider, Select mode with checks, move buttons, touch drag | `ArrangeView.tsx`, `ArrangeSection.tsx`, `PageCell.tsx` kept; entry by task and zoom (view transition); touch drag in the gesture core; hover actions shown on coarse pointers as the selection bar |
| 11 Compare | Keep | Compare place; setup skipped when two documents are chosen; bar → task bar with Done; compact A · B · Changes | `CompareView.tsx` kept; setup card becomes a chooser shown only when needed; `compare-commands.ts` stops forcing the navigator open |
| 12 Dialogs (27) | Merge | Export sheet absorbs 12.1, 12.3, 12.5, 12.20–12.22; Combine immediate from the Library, sheet from a document (12.13, one outcome); furniture, OCR and crop as tool sheets; Signature sheet with saved signatures; Apply redactions → one confirm plus toast; Go to page → page pill; Settings sheet new | `ExportDialog.tsx` restructured; `CompressDialog`, `ImageExportDialog`, `ConvertDialog` become sections; `MergeAllDialog` loses the replace outcome (INV-12); `SignatureDialog` adds IndexedDB storage; all dialogs on one Sheet primitive (Base UI Drawer on compact, M-29) |
| 13 Palette, shortcuts | Extend | Actions panel: selection first, arguments, tasks, documents; shortcut overlay kept | `CommandPalette.tsx` gains a selection provider and an argument parser; registry entries gain `task` and `selectionKind` |
| 14 Feedback | Replace | One Toast with action (Undo, Report, Retry) for every destructive step and failure; progress as ring plus toast; honesty notices kept | `LiveRegion.tsx` kept and paired with visible toasts; `CombinedToast` → generic `Toast`; result screens → toasts with links |
| 15.1 Settings, brand | Replace | Settings sheet (appearance, language, pen, privacy and storage, OCR languages, author, shortcuts, About); privacy line on the Library and the title menu | New `settings/`; `appearance-store` gains Glass, Motion, Ambient light, Theme (C-15); language switch made visible (INV-20); brand per BR-L1, BR-M1 |
| 15.2 Primitives | Keep, extend | IconButton 32 fine / 44 coarse; keycaps hidden on touch until a key is pressed; Segmented replaces RadioChips; glass M1–M5; two-band focus ring; new Sheet, Toast, Chip, TaskBar, ActionBar | `ui/*`, `global.css`, `tokens.css` (G-3, A-11, C-7, M-2) |

## 10. Risks, relearning, accessibility and open questions

### 10.1 Risks

1. **It reverses the owner's newest decision.** ADR-0019 is one day old and asked for a locked
   Read mode. C keeps the protection as a rule (§3.2) and offers Lock, but no longer opens files
   locked. Mitigation: owner question 1, and Lock as a remembered default if he prefers it.
2. **Implicit state.** A task is less visible than a three-word segmented control. The bar's
   "Done · Task name" and the under-light carry it; a user may forget Mark up is on and draw while
   trying to select. Mitigation: Esc twice always returns to reading; a stroke is one Undo.
3. **Hidden things stay hidden.** No rail, no inspector, no status bar, a closed sidebar.
   Mitigation: labelled dock that waits for first use, facts chips, the sample document, Mod+K
   listing tasks, the title menu as a single home for file actions. Measure with first-run tests
   on the sample (owner question 8).
4. **Pen writes immediately** can leave stray marks from a resting pen: one Undo, and a setting
   (owner question 2).
5. **Save in place overwrites originals.** Mitigation: verification after write, the draft as a
   backup, a one-time "Save over report.pdf?" per file (owner question 4). **Drafts** raise
   privacy and quota questions (iOS may evict OPFS): local only, listed, clearable, 30 days.
6. **Migration cost.** `viewMode`, `documentMode` and `canEdit` reach 11, 7 and 11 source files;
   `modes.spec.ts`, `tools.spec.ts`, `a11y.spec.ts` and `light-table.spec.ts` are rewritten;
   the floating bar, Home, navigator, inspector and status bar are rebuilt. Estimate (judgement):
   the largest single piece of M9 implementation.
7. **New engineering the model depends on:** caret mode (F7), keyboard placement for all
   placeable objects, palette arguments, touch drag in the gesture core, OPFS drafts, saved
   signatures. Each has a fallback path, but J5's and J8A's keyboard paths need the first two.

### 10.2 What today's users relearn

- No Read · Edit · Arrange control: Mark up (`2`) is the old Edit for drawing; Fill & sign,
  Redact and Edit text are tasks; Pages (`3`) is the old Arrange; `1` leaves a task.
- A double-click on text selects a word and never opens the editor; use Edit text.
- The Document menu is the title; Export is Save a copy; Mod+S saves in place. Thumbnails and
  History live in the sidebar (Mod+B), page and zoom in the page pill, Find in the top strip.
- Library cards open on one click; Combine there no longer asks. P again cycles pens.

### 10.3 Accessibility notes

- **A-12 and hiding.** A-12 says chrome never auto-hides; M-14 hides it on scroll on phones. C
  hides only on compact and medium, only in reading, never while focus or keyboard modality is
  in the chrome, makes hidden chrome `inert` (A-13), keeps `scroll-padding` equal to the shown
  chrome, and offers "Keep tools visible" in Settings. Expanded and wider never auto-hide. The
  accessibility track should confirm this reading of A-12.
- **A-13, A-14, FL-R9.** Every floating surface is in the F6 cycle, including the facts chip and
  the action bar; a task change is one announcement ("Mark up. Black pen. Escape twice to
  finish."). Caret mode and keyboard placement close two of F-13's three gaps (J5, J8A).
- **A-15, A-20, A-21.** 44 px targets on coarse pointers; at 320 px the compact layout reflows
  with every action reachable through More; dock labels are designed at 1.8 × English length,
  with short forms on compact.
- **A-9, A-10.** View transitions only for Library ⇄ document, reading ⇄ Pages and Compare,
  never for tool or task switching by key; updates under 50 ms (research 18 §4.5).
- **A-19, A-24, A-22.** Done carries a check glyph and a label; toasts with Undo stay ≥ 10 s and
  pause on hover and focus; with Glass Solid, Motion Reduced and Light Off nothing changes.

### 10.4 Open questions for the owner

1. Do you accept files opening unlocked, with the rule "nothing on the bare page changes outside
   a task" plus an optional Lock (on by default for signed files)? Or should Lock be the
   default for every file?
2. On a tablet, should a pen write at once when it touches a page (Apple's guidance), or only
   after Mark up is chosen?
3. Should the dock and top strip hide while scrolling on phones and tablets (M-14), and stay on
   desktop?
4. On Chromium, may Mod+S overwrite the original file (with a local draft as a backup)?
5. May Recto keep drafts of edited documents on this device for 30 days, and up to five saved
   signatures (RA-5), both listed and clearable in Settings?
6. Keep document chips (tabs) on tablets and desktops, or use only the Library and a switcher?
7. Should Combine from the Library act at once (card order, Undo), or keep the order dialog?
8. Is a bundled sample document on first visit worth its offline cache size (about 100–300 KB,
   judgement)?

## Sources

Repository files at `develop`, 2026-10-04; no web sources. `current-flows.md` (§1–§21),
`inventory.md` (§2–§17) and seven baseline frames (`02-home-files-1440`, `03-read-1440`,
`03-read-390`, `04-edit-write-1440`, `08-selection-bar-1440`, `12-arrange-1440`,
`18-document-menu-1440`); research 15 (§0–§10), 16 (§0, §7, §8), 17 (§0, AU list), 18 (§0, §1.5,
§3, §10), 19 (§0, §4–§11), 20 (§0, T, I, C, S lists), 21 (§0, BR lists), 22 (§0, §13);
`docs/DESIGN.md` §4.8; ADR-0019, ADR-0020, ADR-0021; `apps/web/src/state/ui-store.ts`,
`viewer/tool-store.ts` and every `shortcut:` in `apps/web/src`, with reference counts by `grep`.
