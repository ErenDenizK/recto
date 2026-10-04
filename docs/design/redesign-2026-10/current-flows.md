---
title: Current user flows (M9 redesign baseline)
date: 2026-10-04
status: snapshot
---

> **How this was gathered.** Each job was traced through the code at commit `7d47031`
> (`develop`, 2026-10-04): the command registrations and their `when` conditions, the
> click and key handlers of every surface on the path, and the end-to-end specs and demo
> scenes that drive the same flow (cited per job; those paths are executed in CI on desktop
> Chromium, Firefox and WebKit). The app was not run for this track. Phone paths are read
> from pointer handlers and CSS, checked against four 390 px frames of the screenshot track
> (`baseline/01-home-empty-390.png`, `03-read-390.png`, `04-edit-write-390.png`,
> `12-arrange-390.png`); where a step depends on browser behaviour (long press, native drag,
> double tap, file pickers) it rests on established knowledge and is marked "unverified".
> No web sources were needed, so none were blocked. Component ids (3.10, 8.3, …) and debt
> ids (INV-n) refer to [`inventory.md`](inventory.md).

# Current user flows

## 0. Verdict

- **Every job that changes a page passes the Read lock first.** A file opens in Read; the
  first highlight, stroke, fill, signature, text edit or redaction costs one extra step
  (Edit, a "Switch to Edit" notice or a mode-changing key), and in three places the first
  attempt ends on a notice instead of the action (form fields, the page menu, a stylus that
  selects text instead of writing). Page structure is not behind the lock, so the rule is
  hard to predict (F-1).
- **Tools are three levels deep and save is a dialog.** Edit → group → tool → press again
  for options; and every job that should leave a file behind ends with Export → Export →
  Save, a 7-section form with a verification pass. Work that is not exported is lost on
  reload with no warning (F-3, F-4).
- **On a phone the app is a desktop layout at 390 px.** The navigator opens by default and
  leaves about 78 px for the page; the tab strip shows one letter; the Write row is cut off;
  multi-select and page reordering have no touch path; there is no visible Undo (F-2, F-5,
  F-7).
- **Mouse step counts are moderate (2–8 per job, 3–11 with saving).** The longest are
  redaction (8, 11 with saving), compress-then-export (8), highlight with a comment (7) and
  fill a form (8). Keyboard-only paths run 6–13 steps for the jobs that change a document, and three jobs
  have none: highlight
  and comment (no keyboard text selection), placing a signature image, and writing (needs a
  pointer by nature). Totals are in §20.
- **Vocabulary splits jobs.** Combine and Merge are the same dialog with two outcomes;
  "Mark up…" annotates while "Mark" redacts; "Comment" in the selection bar creates a
  separate note; the title bar's search field searches commands, not the document.
- The 15 biggest frictions are ranked in §19 (F-1 to F-15); targets the redesign can be
  held to are in §21 (FL-R1 to FL-R10).

## 1. Method

**Counting rule.** A step is one click or tap, one key or chord, one drag, one filled
field (typing a value counts once, whatever its length) or one choice in an operating
system dialog (a file picker or the save picker counts once). Waiting, scrolling to read
and the content itself (how many fields, how many words) are not counted. Step counts are
the shortest path a person who knows the app would take; where the path a newcomer is
likely to try first is longer or fails, that is described under "Discoverability".

**Paths.** *Mouse*: pointer only, no shortcuts. *Mouse and keys*: the fastest path with a
mouse and single-key or chord shortcuts. *Keyboard only*: no pointer; Tab counts are
estimates where the start of focus depends on the previous action (marked ≈). *Touch
phone*: a 390 × 844 px viewport, one finger, no stylus unless stated, Chrome on Android
or Safari on iOS.

**Start state.** Unless a job says otherwise: one document already open, shown in Read
(how every file opens), navigator open on Pages (its default), inspector closed, nothing
selected. "Save" means the export dialog to a downloaded or picked file: Export (1),
Export (2, assemble and verify), Save or Download (3, a second click the save picker needs),
plus the save picker itself in Chromium (4).

## 2. The map a person meets

```
 empty app ──open 1 file──▶ Read (locked) ◀──1──▶ Edit ◀──3──▶ Arrange
     │                         ▲     │ ▲            │
     └─open/drop 2+ files─▶ Home ◀─0─┘ └──tab click─┘ (last view and mode)
                               │
                               └─Compare (2 cards) ─▶ Compare view ◀──4── any document view
```

- Four destinations (Home, the page view, Arrange, Compare) and, inside the page view, two
  modes (Read and Edit). One control (3.10) carries both the lock and the view; the Edit
  button in the floating bar (7.1) repeats one of its segments.
- Tools are reached through the floating bar's five groups (7.2), 16 single-letter keys
  (plus Shift+E and Shift+I), the page context menu (8.10, Edit only), the text selection bar (8.3), the
  Document menu (8.5, 20+ items) and the command palette (about 151 commands).
- Results land in four other places: the navigator (Find, Review), the inspector (History,
  OCR, Signatures; closed by default), dialogs, and visually hidden announcements.

## 3. J1 — First visit

*Scenario: a person types the address, reads the screen and gets a PDF on screen.*

- **What they see** (`01-home-empty-390.png`; desktop the same, centred): a near-black field;
  title bar with the glyph, "+" and "Search commands… Ctrl K"; a 64 px rail with Pages, Find,
  Review and Files although nothing is open; a card "Drop PDFs to start", "Files open on this
  device and are never uploaded.", a 37-word sentence about combining, arranging and
  comparing, and three rows Open files (Ctrl O), Search commands (Ctrl K), Keyboard
  shortcuts (?); status bar "0 files · ● Local only · No external requests".
- **Mouse (2):** (1) Open files · (2) pick the file. Or (1) drag a file from the desktop.
- **Mouse and keys (1–2):** drag (1), or Mod+O (1) and pick (2).
- **Keyboard only (2):** (1) Mod+O · (2) pick in the system dialog.
- **Touch phone (2):** (1) tap Open files · (2) pick in the system picker.
- **Mode and view:** none until the file opens; then Read for one file, Home for two or more
  (`home/home-actions.ts`, `showOpened`).
- **Discoverability:** the screen says what the app does not do (upload) but shows nothing
  of what it does: no sample document, no glimpse of tools. "Drop" and the keycaps assume a
  desktop. The four rail tabs open panels that say "No document open". The Document menu,
  Export and the inspector toggle appear only after a file opens. The language follows the
  browser and can be changed only from the palette. The about page (`/recto/about/`) that
  explains the product is reachable only from the palette or the Document menu, which is
  hidden here.
- **Dead ends and inconsistencies:** a corrupt PDF, a non-PDF or a skipped password is
  reported only to the screen reader; on screen nothing happens (INV-6). The same action
  (open) lands in Read for one file and on Home for two.

## 4. J2 — Open one PDF and read it

*Scenario: open a 12-page report and read page 7 at a comfortable size.*

- **Mouse (2 to the first page, +1 per jump):** (1) Open files · (2) pick · the file opens in
  Read, fitted to the width, with the Pages thumbnails open · (3) click thumbnail 7. Zoom:
  status bar − / + (22 px) or the % menu (Fit page); layout: three icons at the stage's top
  right.
- **Mouse and keys (1):** drop the file; PageDown / Space, `[` `]`, Mod+G for a page number,
  Mod+wheel to zoom under the pointer.
- **Keyboard only (≈3):** (1) Mod+O · (2) pick · (3) F6 to the pages · PageDown; Mod+G and
  type 7 to jump.
- **Touch phone (3, pinch unverified):** (1) Open files · (2) pick · the page is drawn at 25 %
  beside the open navigator (`03-read-390.png`) · (3) tap the Pages tab to collapse the
  navigator, the page re-fits to about 326 px. Pinch: the viewport keeps
  `touch-action: auto`, so Android Chrome is likely to zoom the whole interface instead of
  the page; iOS gesture events are handled (`stage/ReadView.tsx`).
- **Mode and view:** Read, with a lock glyph on the "Read" segment and one Edit button at
  the bottom: two controls for the same switch.
- **Discoverability:** zoom is bottom right, layout top right, Find in the navigator, the page
  number bottom left and not clickable. Go to page exists only as Mod+G and a palette
  command.
- **Dead ends and inconsistencies:** a thumbnail click also *selects* the page ("1 selected"
  appears in the status bar), which silently changes what Shift+R and Delete do (INV-3).

## 5. J3 — Open several and combine

*Scenario: two PDFs on disk become one new PDF.*
Evidence: `e2e/home.spec.ts`, "a new user merges two dropped files in under five actions"
(asserts 3) and "…opened with Open files…" (asserts 4).

- **Mouse (4, +3 to save):** (1) Open files · (2) pick both · Home shows two cards, both
  selected · (3) Combine 2 files · the dialog lists the order (up and down buttons) and the
  title "Combined – A + B" · (4) Combine · a new tab opens in Read, the sources stay open, a
  toast says "Combined 2 files · Undo" · (5–7) save.
- **Mouse and keys (3, +3):** (1) drop both · (2) Combine 2 files · (3) Combine · Mod+S,
  Enter, Enter.
- **Keyboard only (≈8, +3):** (1) Mod+O · (2) pick · (3–6) ≈4 Tabs to Combine on Home ·
  (7) Enter · (8) Enter in the dialog. The palette's matching command, "Merge all open
  documents…" (keyword "combine"), opens the same dialog without an order, which *replaces*
  the two files with one instead of adding a new document (INV-12).
- **Touch phone (4, +3):** (1) Open files · (2) pick both (iOS needs "Select" in the Files
  picker first, unverified) · (3) Combine 2 files · (4) Combine. Dragging one card onto
  another (the desktop shortcut into the same dialog) is HTML5 drag and drop, unreliable on
  phones (unverified).
- **Mode and view:** Home → dialog → Read on the new document.
- **Discoverability:** strong on Home. From inside a document the job is called "Merge
  files…" (Document menu, first item); with only one file open it first asks for files.
- **Dead ends and inconsistencies:** three names (Combine, Merge files, Merge all open
  documents) and two outcomes from one dialog (`stage/OperationDialogs.tsx`, `combining =
  given !== undefined`). The default order is the tab order, and tabs cannot be reordered
  (INV-19). The new document exists only in memory until saved (INV-7).

## 6. J4 — Reorder and delete pages

*Scenario: in one document, move page 5 before page 2 and delete page 7, then keep reading.*
Evidence: `e2e/light-table.spec.ts`, `e2e/export.spec.ts` (Arrange, click, R).

- **Mouse (5):** (1) Arrange segment · (2) drag page 5 into the gap before page 2 · (3) click
  page 7 · (4) its trash icon (hover only) or Delete in the contextual bar · (5) Read segment.
  The navigator's Pages panel stays open in Arrange, showing the same pages a second time.
- **Mouse and keys (5):** (1) `3` · (2) drag · (3) click · (4) Delete · (5) `1`.
- **Keyboard only (≈12):** (1) `3` · (2) F6 to the grid · (3–5) arrows to page 5 · (6–8)
  Alt+Left three times · (9–10) arrows to page 7 · (11) Delete · (12) `1`. Alt+Shift+arrow
  jumps to a row edge; Mod+X / Mod+V move across documents.
- **Touch phone (delete 4; move: no reliable path):** (1) collapse the navigator (the mode
  switch is cut to "Re" while it is open) · (2) Arrange · (3) tap page 7 · (4) Delete in the
  contextual bar. Moving needs a native long-press drag (support varies, unverified); the
  contextual bar has no move-left or move-right; the context menu's Cut and Paste need a
  long press that iOS Safari does not turn into `contextmenu` (unverified).
- **From the page view instead:** Read: right-click page 7 (1) → the only row is "Switch to
  Edit to change pages" (2) → right-click again (3) → Delete page 7 (4). Pages cannot be
  moved from the page view at all.
- **Mode and view:** two view switches (to Arrange and back), or Read → Edit in the page view.
- **Discoverability:** the navigator's thumbnails look like Preview's sidebar but cannot be
  dragged. The Arrange cell actions show only on hover. The contextual bar's eight icons are
  named only in tooltips.
- **Dead ends and inconsistencies:** with a thumbnail selected in the navigator, Delete
  deletes that page and Shift+R rotates it even in Read, while R arms the Rectangle tool and
  switches to Edit (annotation commands register first; `commands/app-commands.ts`); in
  Arrange R rotates. Document menu → Rotate pages ▸ turns every page when none is selected.
  A deletion is confirmed only by an announcement; Undo is Mod+Z or the History list in the
  closed inspector (INV-4, INV-6).

## 7. J5 — Highlight and comment

*Scenario: highlight a sentence and attach a comment to it.*
Evidence: `e2e/modes.spec.ts` (selection bar), `e2e/annotations.spec.ts` ("selected text,
then U").

- **Mouse (7):** (1) drag across the sentence · the selection bar offers Copy, Edit text,
  Mark up… · (2) Mark up… (switches to Edit, keeps the selection) · (3) Highlight (the
  selection is cleared) · (4) click the new highlight · (5) Comment in its contextual bar ·
  (6) type · (7) Esc or click outside.
- **Mouse and keys (7):** (1) drag · (2) H (Edit, selection kept) · (3) H (highlights) ·
  (4–7) as above.
- **With the Highlighter pen (7):** (1) Edit · (2) Write · (3) Highlighter dot · (4) drag along
  the line (it snaps into a Highlight when 70 % runs along text) · (5–7) select, Comment,
  type, Esc.
- **Keyboard only: no path.** Page text cannot be selected from the keyboard, and the Note
  tool (N) places only with a click (INV-16).
- **Touch phone (≈8, unverified):** (1) long press to select · (2) adjust the handles · the
  browser's own selection menu appears next to the app's bar · (3) Mark up… · (4) Highlight ·
  (5) tap the highlight · (6) Comment · (7) type on the virtual keyboard · (8) tap outside.
- **Mode and view:** Read → Edit.
- **Discoverability:** "Mark up…" is the only word for "annotate" in Read. In Edit the
  selection bar's **Comment** creates a separate sticky note at the end of the line, not a
  comment on a highlight (INV-17); Review then lists two rows for one intent.
- **Dead ends and inconsistencies:** a key pressed over a selection in Read (H, U, S, X)
  switches to Edit and does nothing else; the second press acts. "Highlight" also names the
  Highlighter preset and "Highlight fields" (INV-15).

## 8. J6 — Write with the pen (mouse, stylus, finger)

*Scenario: write a word in the default black pen, then one in red.*
Evidence: `e2e/pen.spec.ts` (presets, bursts, Highlighter, finger after pen), `tools.spec.ts`.

- **Mouse (5):** (1) Edit · (2) Write (arms the active pen) · (3) draw · (4) red dot · (5) draw.
  Changing a preset's colour or width: (6) tap the armed dot again · (7) choose · (8) Esc.
- **Mouse and keys (4):** (1) P (Edit and the last pen, "Edit mode. Black pen, 1.5 pt") ·
  (2) draw · (3) red dot · (4) draw. P again toggles the pen's options tier, empty until a
  pressure pen has been seen.
- **Stylus on a tablet (3):** in Read a stylus selects text like a mouse; (1) tap Edit · then
  "Pen draws in Edit" turns on by itself when a pen is first seen and the stylus draws with
  Select armed · (2) write · (3) tap the red dot and write. The eraser end erases and the
  barrel button lassos in any tool.
- **Finger on a phone (5, plus 3 per scroll):** (1) Edit · (2) Write · (3) draw · (4) red dot,
  if visible: at 390 px the Write row runs past the right edge and the fourth preset, the
  eraser, lasso and shapes are off screen (`04-edit-write-390.png`) · (5) draw. While a pen
  tool is armed one finger draws and two fingers only zoom, so scrolling costs ‹ Write ·
  Select · scroll · Write (INV-8).
- **Keyboard only:** not applicable for drawing; presets arm with arrows and Enter.
- **Mode and view:** Read → Edit.
- **Discoverability:** "Write" is the second of five groups and only reachable after Edit.
  Preset options open on a second tap of the armed dot, which nothing announces visually.
- **Dead ends and inconsistencies:** the bar sits bottom centre, under a writing hand; it
  fades to 20 % during strokes and for 1 s after. Esc is a ladder (disarm, then back to the
  group row), so leaving Write takes two presses.

## 9. J7 — Fill a form

*Scenario: three text fields and one checkbox, then save.*
Evidence: `e2e/modes.spec.ts` ("form fields are read-only in Read"), `e2e/forms.spec.ts`.

- **Mouse (8, +3):** (1) click field 1 · "Switch to Edit to fill" appears under it · (2) Edit in
  the notice · the editor opens on field 1 · (3) type · (4) Tab · (5) type · (6) Tab · (7) type ·
  (8) click the checkbox · (9–11) save (flattening is a checkbox in the export dialog or
  "Flatten on export" in the Review tab's Fields filter).
- **Mouse and keys (8, +3):** (1) `2` · (2) click field 1 · (3–8) as above.
- **Keyboard only (≈11, +3):** (1) `2` · (2) F6 to the pages · (3) Tab to field 1 · (4) Enter ·
  (5) type · (6) Tab · (7) type · (8) Tab · (9) type · (10) Tab · (11) Space.
- **Touch phone (≈9, +3):** (1) collapse the navigator (the field editor is the widget's size
  at the current zoom: tiny at 25 %) · (2) tap field 1 · (3) Edit · (4) type · (5) tap field 2
  · (6) type · (7) tap field 3 · (8) type · (9) tap the checkbox. The virtual keyboard can
  cover the field: nothing reads `visualViewport`.
- **Mode and view:** Read → Edit, through a notice.
- **Discoverability:** filling needs only the Select tool, but the bar's group is called
  "Fill & sign", which suggests a tool is needed; "Highlight fields" is a toggle in that group
  and in the Fields filter.
- **Dead ends and inconsistencies:** the first click on a field in Read always ends on the
  notice (INV-2). XFA-only forms cannot be filled (said honestly in the Fields filter).

## 10. J8 — Sign

*Scenario A: place a handwritten signature on page 4. Scenario B: sign with a certificate.*
Evidence: `e2e/tools.spec.ts` (Fill & sign group), `e2e/signatures.spec.ts` (B), demo
scene 07.

- **A, mouse (6, +3):** (1) Edit · (2) Fill & sign · (3) Signature image · the dialog opens on
  Draw · (4) draw on the 440 × 160 pad · (5) Use signature · (6) click the place on page 4 ·
  (7–9) save. The placed signature is not selected (one-shot tool); resizing it costs a click
  on it and a handle drag.
- **A, mouse and keys (4, +3):** (1) G (Edit and the dialog) · (2) draw · (3) Use · (4) click.
- **A, keyboard only: no path to place it.** G, the Type tab and Enter make the signature,
  but stamps and signature images are placed only by a click (INV-16).
- **A, touch phone (6, +3):** as mouse, finger on the pad (it scales to the dialog width).
- **A, return use:** the signature stays armed for the session (the next G reuses it) and is
  gone after a reload.
- **B, mouse (8 including the save):** (1) Document · (2) Sign with certificate… · (3) pick
  the .p12 · (4) password · (5) Check certificate · (6) Use for export · the export dialog
  opens with "Sign the exported file" ticked · (7) Export · (8) Save. Also from the export
  dialog: tick Sign, then the same nested dialog.
- **B, keyboard only (≈12):** palette "sign" (3) · file input and picker (2) · password (1) ·
  Check (2) · Use (2) · Export (1) · Save (1).
- **B, touch phone (8):** as mouse; the .p12 comes from the Files app.
- **Mode and view:** A: Read → Edit. B: none (allowed in Read).
- **Discoverability:** the Fill & sign group holds three sign-like controls side by side —
  Signature image (G), Stamp or image (Shift+I) and Sign with certificate… — plus a
  "Signature" kind in Add field. The palette's "sign" finds both meanings.
- **Dead ends and inconsistencies:** a certificate signature is added only at export; any
  later edit and re-export removes it (said in the Signatures section, which lives in the
  closed inspector).

## 11. J9 — Edit a line of text

*Scenario: change "2024" to "2025" inside a paragraph.*
Evidence: `e2e/modes.spec.ts` ("a Read selection offers Edit text", "a first click on text
says Double-click"), `e2e/paragraph-edit.spec.ts`, demo scene 06.

- **Mouse (5):** (1) double-click "2024" · (2) Edit text in the selection bar (Edit, the
  paragraph editor opens with the caret at the start of the word, not the word selected) ·
  (3) double-click the word in the editor · (4) type 2025 · (5) Esc or click outside (one
  history entry). In Edit with Select: (1) double-click opens the editor · (2) double-click
  selects the word · (3) type · (4) Esc.
- **Mouse and keys (5):** (1) E (Edit and the Edit text tool) · (2) click before the word ·
  (3) Shift+Right ×4 counted once as a selection · (4) type · (5) Esc. Demo scene 06 uses
  Home and four Shift+Right presses.
- **Keyboard only (≈10):** (1) E · (2–3) ≈2 Tabs to the paragraph target ("Edit paragraph
  …") · (4) Enter (caret at the paragraph start) · (5–7) arrows or End to the word ·
  (8) Shift+arrows · (9) type · (10) Esc.
- **Touch phone (5, unverified):** (1) long press the word · (2) Edit text · (3) double tap
  the word · (4) type · (5) tap outside. In Edit with the Edit text tool a tap opens the
  editor until a stylus has been seen, then only a long press. The virtual keyboard can cover
  the editor's header.
- **Mode and view:** Read → Edit.
- **Discoverability:** three entries that differ by click count and tool: double-click with
  Select, one click with Edit text (Text group or E), Edit text in the Read selection bar. A
  single click with Select only shows the hint "Double-click to edit text".
- **Dead ends and inconsistencies:** text that would run into the next block keeps the editor
  open with "Tighten to fit / Let it overlap / Keep editing"; text that would leave the page
  is refused. Neither is a dead end, but each needs a decision in a glass header beside the
  paragraph.

## 12. J10 — Redact

*Scenario: remove an e-mail address and a signature area, apply, save.*
Evidence: `e2e/redaction.spec.ts` (selection + X, area, search, apply), demo scene 03
(Find sensitive data reached through the palette).

- **Mouse (8, +3):** (1) Edit · (2) Redact (the group arms nothing) · (3) Mark for redaction ·
  (4) drag across the e-mail (marks the text) · (5) drag the area · (6) Apply redactions (the
  navigator switches to Review → Marks and the dialog opens) · (7) Apply · (8) Close the
  result · (9–11) save.
- **Mouse and keys (8, +3):** the pointer path above is the shortest. The key route is 9:
  (1) select the e-mail · (2) X (Edit, selection kept) · (3) X (mark; the tool does not arm)
  · (4) Esc · (5) X (arm the tool) · (6) drag the area · (7) Apply redactions · (8) Apply ·
  (9) Close (`e2e/redaction.spec.ts` presses Esc before arming).
- **Find sensitive data (7, +3):** (1) Edit · (2) Redact · (3) Find sensitive data · review the
  list · (4) Mark N selected · (5) Apply redactions · (6) Apply · (7) Close.
- **Keyboard only (≈13, +3):** (1) `2` · (2–4) palette "find sensitive" · (5–7) ≈3 Tabs to
  "Mark N selected" · (8) Enter · (9–10) ≈2 Tabs to Apply redactions · (11) Enter ·
  (12) Enter to confirm · (13) Close.
- **Touch phone (9, +3):** collapse the navigator (1), then as mouse (8); finger drags mark
  (the layer is `touch-action: none`).
- **Mode and view:** Read → Edit; the navigator jumps to Review → Marks.
- **Discoverability:** the Read selection bar offers no redaction; marking a selection needs
  X or the tool. Redaction lives in four places (Redact group, Find's "Mark all matches",
  Review → Marks, the apply dialog), and "Mark" also appears in "Mark up…" (annotate).
- **Dead ends and inconsistencies:** applying is undoable in the app and final only in the
  exported file; the result sheet lists 9 self-checks before anything is saved. Marks made
  but not applied survive export as marks (honest, but a second pass is easy to forget).

## 13. J11 — OCR a scan

*Scenario: a scanned letter becomes searchable, then is saved.*
Evidence: `e2e/ocr.spec.ts`, demo scene 04.

- **Likely first attempt (dead end):** Find tab, type a word: "No results", with no mention of
  OCR; dragging over the text selects nothing.
- **Mouse (4, +3):** (1) Document · (2) Recognize text (OCR)… (section "Convert and export") ·
  defaults: pages without text, the UI language and English · (3) Recognize 2 pages · the run
  continues if the dialog is closed (status bar "Recognizing text: 1 of 2 pages") ·
  (4) Show results · the OCR section of the inspector lists page quality · (5–7) save.
- **Mouse and keys (4, +3):** palette "ocr" (3) · Recognize (1).
- **Keyboard only (≈7, +3):** (1–3) Mod+K, "ocr", Enter · (4–5) ≈2 Tabs · (6) Enter ·
  (7) Enter on Show results.
- **Touch phone (4, +3):** as mouse; the side dialog is 358 px wide at 390 px, so it covers
  the page.
- **Mode and view:** none (allowed in Read).
- **Discoverability:** nothing in the page view says a page has no text; OCR sits between
  "Export as Markdown / text…" and "Compress…". Another language needs "Manage languages…"
  inside the dialog, the app's only settings screen.
- **Dead ends and inconsistencies:** "Show results" opens the inspector on the OCR section;
  a dialog closed any other way (×, Esc, or left running) leaves the results in the closed
  inspector, with the status bar as the only sign that a run finished.

## 14. J12 — Compare two versions

*Scenario A: both versions are open, starting on Home. Scenario B: one is open in Read, the
other is on disk.*
Evidence: `e2e/compare.spec.ts`, demo scene 05.

- **A, mouse (4):** (1) click card A · (2) Mod-click or Shift-click card B · Compare appears
  (only with exactly two selected) · (3) Compare · (4) Compare in the setup card (A and B
  filled in) · J / K or the Changes rows step through the result.
- **B, mouse (5):** (1) Document · (2) Compare with… · (3) Open file… for Revised (B) ·
  (4) pick · (5) Compare.
- **Mouse and keys (≈3):** (1) `4` · (2) choose B if needed · (3) Compare.
- **Keyboard only (≈7):** (1) `4` · (2–3) Tab to A and choose · (4–5) Tab to B and choose ·
  (6) Tab to Compare · (7) Enter.
- **Touch phone (6):** a tap selects one card only, so A uses the Files tab: (1) Files ·
  (2) tick A · (3) tick B · (4) Show Home · (5) Compare · (6) Compare. Or Document → Compare
  with… and the two selects (≈5). Entering Compare opens the navigator on Changes
  (`compare/compare-commands.ts`), so at 390 px the result shows two page columns in the
  remaining ~78 px until the panel is collapsed.
- **Mode and view:** a fourth view; its segment appears in the mode switch only while a
  comparison exists; Esc leaves.
- **Discoverability:** from a document, Compare is in the Document menu under "Combine and
  split"; the `4` key also starts it with no comparison open.
- **Dead ends and inconsistencies:** if a compared document changes, a notice offers Run again
  and the report export is withdrawn.

## 15. J13 — Save, export and compress

*Scenario A: save the edited document. Scenario B: make it smaller, then save.*
Evidence: `e2e/export.spec.ts`, `e2e/tools.spec.ts` ("compress images.pdf with the Screen
preset").

- **A, mouse (3, +1 picker):** (1) Export (download icon, title bar) · the form: file name,
  Security, Annotations, Forms, Compression, Metadata, Signature · (2) Export · assembly and
  verification, then a summary of what was kept, rewritten or removed · (3) Save (or
  Download) · (4) the system save picker in Chromium, starting in the last folder used in this session.
- **A, mouse and keys / keyboard only (3, +1):** Mod+S · Enter · Enter.
- **A, touch phone (3):** as mouse; the file goes to the browser's downloads or share sheet.
- **B, mouse (8, +1):** (1) Document · (2) Compress… · analysis runs · (3) a preset ·
  (4) Compress · (5) Apply to export · (6) Export · (7) Export · (8) Save. Or (5) Download copy
  for a separate small file.
- **B, keyboard only (≈12, +1):** palette "compress" (3) · Tab and arrows to a preset (2) ·
  Tab and Enter on Compress (2) · Tab and Enter on Apply (2) · Mod+S, Enter, Enter (3).
- **Mode and view:** none.
- **Discoverability:** there is no "Save"; Mod+S opens Export. The export form's Compression
  section is an empty heading until a preset was applied in another dialog (INV-18).
- **Dead ends and inconsistencies:** every save writes a new file through the picker or a
  download; nothing writes back to the original. Closing the browser tab, or pressing Mod+W,
  which the browser keeps, discards every unsaved change without a warning (INV-7).

## 16. J14 — Return visit via Recents

*Scenario: the next day, continue with yesterday's file.*
Evidence: `e2e/home.spec.ts` ("Recents remember a closed file across a reload").

- **Mouse (1–3):** Chromium with a kept file handle: (1) click the row · (2) Allow, if the
  browser asks · opens in Read. Without a handle (Firefox, Safari, files from an input):
  (1) click the row · (2) the file dialog opens with the note "Open again…" · (3) pick.
- **Keyboard only (≈5–6):** ≈4 Tabs past the three hint rows · Enter · Allow.
- **Touch phone (3):** mobile browsers have no File System Access API (established
  knowledge), so every row is (1) tap · (2) file dialog · (3) pick.
- **Mode and view:** Home → Read.
- **Discoverability:** Recents show only on Home, under the open cards; from a document it is
  0 or the glyph first.
- **Dead ends and inconsistencies:** what comes back is the original file, not yesterday's
  state: annotations, fills and edits that were not exported are gone, and nothing said so
  when the tab closed (INV-7).

## 17. J15 — Find text and navigate the outline

*Scenario: find "liability", step through the hits, then jump to the chapter "Terms" in the
outline.*
Evidence: `e2e/viewer.spec.ts` ("finds text, steps through the hits"), `e2e/outline.spec.ts`.

- **Find, mouse (3):** (1) Find tab · (2) type · (3) the ↓ button per hit. A newcomer is likely
  to click the title bar's "Search commands…" field first, the more prominent search box,
  which lists commands (+2 to back out).
- **Find, mouse and keys / keyboard only (3):** (1) Mod+F · (2) type · (3) Enter or F3; Esc
  clears and closes the panel.
- **Find, touch phone (4):** (1) Find tab · (2) type · (3) ↓ · (4) collapse the panel to see the
  page (it leaves about 78 px).
- **Outline, mouse (3):** (1) Pages tab · (2) Bookmarks chip · (3) the entry.
- **Outline, keyboard only (≈6):** palette "outline" (3) · Tab into the tree (1) · arrows ·
  Enter (1).
- **Outline, touch phone (4):** as mouse, then collapse the panel.
- **Mode and view:** none.
- **Discoverability:** the magnifier icon means "commands" in the title bar and "find" in the
  navigator. The outline sits behind a chip inside the Pages tab, with no count saying a
  document has one.

## 18. J16 — Add page numbers or a watermark

*Scenario: "Page 1 of N" at the bottom of every page, then save.*
Evidence: `e2e/furniture.spec.ts`.

- **Mouse (4, +3):** (1) Document · (2) Page numbers… (section "Add to pages") · the side
  dialog previews on the pages · (3) the "Page 1 of N" preset · (4) Apply. Watermark: (1)
  Document · (2) Watermark… · (3) type the text · (4) Apply.
- **Keyboard only (≈7, +3):** palette "page numbers" (3) · Tab and arrows to a preset (2) ·
  Tab and Enter on Apply (2).
- **Touch phone (4, +3):** as mouse, but the side dialog is `100vw − 32px` wide and covers the
  page, so the live preview it exists for cannot be seen.
- **Mode and view:** none: allowed in Read, while a highlight is not.
- **Discoverability:** good once the Document menu is known; "Remove page numbers" appears
  only after some were added.

## 19. The 15 biggest flow frictions, ranked

Ranked by how many jobs each touches, how often those jobs happen, and the steps or
failures it causes.

| Rank | Id | Friction | Jobs | Cost |
|---|---|---|---|---|
| 1 | F-1 | **The Read lock gates every change and is not consistent.** Files open in Read; the first annotation, stroke, fill, signature, text edit or redaction needs Edit, a "Switch to Edit" notice or a key that switches silently; page structure is outside the lock (Delete and Shift+R act in Read through a navigator selection); a stylus in Read selects text | J5–J10 | +1 step on 6 jobs; 3 notice detours; unpredictable keys |
| 2 | F-2 | **No phone or tablet layout.** Navigator open by default (312 of 390 px), page at 25 %, one letter of the tab strip, mode switch cut, Write row cut off, side dialogs covering the page, 20–28 px targets | all on phones | +1 step on J2, J4, J7, J10, J15; tools unreachable in J6 |
| 3 | F-3 | **Tools are three levels deep.** Edit → group → tool, options on a second press; changing group costs chip + group + tool; Redact arms nothing on opening | J5, J6, J8, J10 | 3 steps before the first mark; 5 actions for a stamp after the eraser (`annotations.spec.ts`) |
| 4 | F-4 | **Saving is a dialog and work is lost silently.** No Save, only Export (3–4 steps, 7-section form); no session restore, no unsaved marker, no `beforeunload` guard; Mod+W closes the app tab; Recents reopen the original file | J3, J7, J8, J10, J11, J13, J14, J16 | +3–4 steps on 8 jobs; total loss on reload |
| 5 | F-5 | **No visible Undo; feedback is spoken.** No Undo/Redo control; History in the closed inspector; failures, skips and deletions announced only to screen readers | J1, J3, J4, all edits | Undo on touch: inspector toggle + History + a row (3 steps) |
| 6 | F-6 | **Page operations are scattered and keys change meaning.** Arrange (drag, hover icons, bar, menu, keys), page menu (Edit only), Document menu (Rotate pages ▸ turns all pages when none is selected); navigator thumbnails do not drag; R rotates in Arrange and arms Rectangle in the page view | J4 | 2 view switches for a reorder; 4 steps to delete from the page view |
| 7 | F-7 | **Touch cannot multi-select, drag or scroll while drawing.** Shift/Mod and the marquee are the only multi-select; drags are native HTML5; a finger with a pen tool armed draws and two fingers only zoom | J3, J4, J6, J12 | Compare from Home on a phone: 6 steps via the Files tab; page moves have no reliable touch path |
| 8 | F-8 | **Find and OCR are hard to find.** The prominent search field searches commands; Find is a navigator tab; a scan answers "No results" with no pointer to OCR, which sits under Convert and export | J11, J15 | A failed first attempt before 4 steps of OCR |
| 9 | F-9 | **Combine and Merge: three names, two outcomes.** Home and Files keep the sources and add a document; Document menu and palette replace the sources, through the same dialog | J3 | Keyboard users get the other outcome |
| 10 | F-10 | **Highlight and comment are two objects.** The selection bar's Comment makes a note at the line end; Highlight clears the selection; commenting on a highlight needs selecting it again | J5 | 7 steps; two Review rows for one intent |
| 11 | F-11 | **"Sign" is four things.** Signature image, Stamp or image, Sign with certificate… and a Signature form field; the image signature lasts one session and cannot be placed from the keyboard | J8 | Choice before action; no keyboard path |
| 12 | F-12 | **Long jobs end in long dialogs.** Export (7 sections), compress → apply → export (8 steps), apply redactions (3 screens), OCR (side dialog); five result layouts | J10, J11, J13 | 8 steps for compress-and-save |
| 13 | F-13 | **Keyboard-only gaps.** No keyboard text selection; annotations, stamps and signature images cannot be placed; the status bar is outside F6; keyboard paths run 6–13 steps | J5, J8, J10 | 3 jobs without a keyboard path |
| 14 | F-14 | **First visit gives no orientation.** "Drop PDFs to start" on every device, keycaps on phones, no sample, four rail tabs with nothing to show, Document menu and language hidden | J1 | Unknown features stay unknown |
| 15 | F-15 | **Results and the safety net hide in panels.** History and Signatures live in the closed inspector, and OCR results too unless "Show results" is used; the outline sits behind a chip; Pages repeats Arrange; Compare forces the navigator open; panels take the page's width | J4, J8, J11, J12, J15 | Results of 3 jobs need a panel the person must know to open |

**Also noted (smaller).** Zoom ± in Arrange changes the hidden Read zoom and Arrange cell
size has no control (INV-21). The Compare segment appears and disappears. Tabs cannot be
reordered (INV-19). The palette takes no arguments although DESIGN.md §2 says it does. Two
image tools in two groups (Image in Text, Stamp or image in Fill & sign). Home cards open on
double click, a desktop gesture. The page number in the status bar is not a control.
"Mark up…" (annotate) and "Mark" (redact) share a verb.

## 20. Step counts per job

Steps to the job's result in the app; "+ save" adds Export, Export, Save (and the save
picker in Chromium) where the job is meant to leave a file. ≈ marks estimated Tab counts.
"—" means no path.

| Job | Mouse | Mouse and keys | Keyboard only | Touch phone | + save | Mode / view switches | Dialogs |
|---|---|---|---|---|---|---|---|
| J1 First visit (to the first page) | 2 | 1 | 2 | 2 | — | 0 | system picker |
| J2 Open one PDF and read | 2 | 1 | ≈3 | 3 | — | 0 | system picker |
| J3 Open two and combine | 4 (3 by drop) | 3 | ≈8 | 4 | +3 | Home → Read | 1 |
| J4 Move one page, delete one | 5 | 5 | ≈12 | delete 4, move — | — | 2 | 0 |
| J5 Highlight and comment | 7 | 7 | — | ≈8 | — | 1 | 0 |
| J6 Write two words, two colours | 5 | 4 | n/a | 5 (stylus 3) | — | 1 | 0 |
| J7 Fill 3 fields and a checkbox | 8 | 8 | ≈11 | ≈9 | +3 | 1 (via a notice) | 0 |
| J8A Place a signature image | 6 | 4 | — | 6 | +3 | 1 | 1 |
| J8B Sign with a certificate (saved) | 8 | 8 | ≈12 | 8 | included | 0 | 2 |
| J9 Edit a word in a paragraph | 5 | 5 | ≈10 | 5 | — | 1 | 0 |
| J10 Redact text and an area, apply | 8 | 8 | ≈13 | 9 | +3 | 1 | 1 |
| J11 OCR a scan | 4 | 4 | ≈7 | 4 | +3 | 0 | 1 |
| J12 Compare two open versions | 4 | ≈3 | ≈7 | 6 | — | 1 (Compare) | 0 |
| J13A Save | 3 | 3 | 3 | 3 | — | 0 | 1 |
| J13B Compress, then save | 8 | 8 | ≈12 | 8 | included | 0 | 2 |
| J14 Reopen from Recents | 1–3 | 1–3 | ≈5–6 | 3 | — | Home → Read | permission or picker |
| J15a Find and step to a hit | 3 | 3 | 3 | 4 | — | 0 | 0 |
| J15b Jump to an outline entry | 3 | 3 | ≈6 | 4 | — | 0 | 0 |
| J16 Page numbers | 4 | 4 | ≈7 | 4 | +3 | 0 | 1 |

Read across: the mouse column is 2–8 steps, and 3–11 once saving is included; the keyboard
column runs to 13 and has three gaps; the touch column adds a step wherever the navigator
must be collapsed and has two gaps of its own (moving pages, and in practice scrolling while
writing).

## 21. Targets the redesign can be held to

- **FL-R1** A file opens ready to mark up: highlighting, writing, filling and signing work
  from the view a file opens in, with no mode switch. J5 ≤ 4 mouse steps, J6 ≤ 2 (pick a pen,
  draw), J7 ≤ 1 + one step per field. Answers F-1.
- **FL-R2** The first mark of any tool in at most 2 steps from the page (show tools, pick
  tool), with its options visible on arming. Answers F-3.
- **FL-R3** One visible Undo and Redo pair on every width, and a visible toast for every
  destructive step and every failure ("Deleted page 7 · Undo", "Could not open scan.pdf:
  damaged file"). Answers F-5.
- **FL-R4** Save without a dialog: one step (Mod+S or a Save control) writes back where the
  browser allows it (a kept handle with permission) and falls back to the current export
  flow elsewhere; the full export form stays for "Save a copy…". Session restore for open
  files and history on this device; an unsaved dot on tabs; a `beforeunload` guard while
  changes are unsaved. Answers F-4.
- **FL-R5** Page structure from the reading view: thumbnails in the side panel drag to
  reorder and take Delete and Rotate, with the same lock rule as everything else. J4 ≤ 3
  mouse steps with no view switch. Answers F-6.
- **FL-R6** Phone layout at < 600 px: no panel open by default, the page fitted to the full
  width, tools in a bottom bar that fits 390 px without clipping, sheets from the bottom for
  panels and dialogs, 44 px targets, multi-select by a Select control with checkmarks, page
  moves by buttons as well as drag. Every job in §20 possible on touch. Answers F-2, F-7.
- **FL-R7** One document search where people look for it (the top bar), separate from the
  command palette; a scan offers "Recognize text" when Find has nothing to search. Answers
  F-8.
- **FL-R8** One word per job: Combine everywhere, always producing a new document; Comment
  attaches to the highlight it was made from; one "Sign" entry that then asks "Your
  signature" or "Certificate". Answers F-9, F-10, F-11.
- **FL-R9** Keyboard parity: page text selectable from the keyboard (a caret mode over the
  text layer), and every placeable object (note, text box, stamp, signature, shape) placeable
  at the focused page's centre with Enter and nudged with arrows, as created form fields are
  today. Answers F-13.
- **FL-R10** A first-run view that shows what the app does on a bundled sample document
  without uploading anything, works without drag and drop, and carries a visible language
  switch. Answers F-14.

## Sources

All sources are files of this repository at commit `7d47031`
(https://github.com/ErenDenizK/pdf-editor). No web sources were used.

- `apps/web/e2e/home.spec.ts` (merge flows, Files tab, keyboard path, Recents): read in the
  cited tests.
- `apps/web/e2e/modes.spec.ts`: read in full for the Read lock, form notice, page menu,
  selection bar and double-click tests.
- `apps/web/e2e/annotations.spec.ts`, `tools.spec.ts`, `export.spec.ts`,
  `signatures.spec.ts`, `redaction.spec.ts`, `ocr.spec.ts`, `compare.spec.ts`,
  `furniture.spec.ts`, `viewer.spec.ts`: read in the cited tests. Test lists of all 30 specs
  read; `helpers.ts` and `playwright.config.ts` read.
- `tools/media/scenes/03-redact.clip.ts`, `04-recognise-scan.clip.ts`, `05-compare.clip.ts`,
  `06-edit-text.clip.ts`, `00-hero.still.ts`: actions read; headers of all 9 scenes read.
- `apps/web/src/commands/app-commands.ts` (registration order, `targetPages`, `pages.*`,
  `tab.close`), `commands/use-shortcuts.ts` (first enabled match wins),
  `annotations/commands.ts` (`activateTool`, `readMode`, `activatePen`): read in the cited
  parts.
- `apps/web/src/home/home-actions.ts`, `home/home-model.ts` (`clickSelection`),
  `home/HomeView.tsx`: read.
- `apps/web/src/shell/FloatingToolbar.tsx`, `FloatingToolbar.groups.ts`, `Stage.tsx`,
  `TabBar.tsx`, `StatusBar.tsx`, `LeftRail.tsx`, `LeftRail.regions.ts`, `PagesPanel.tsx`,
  `SearchPanel.tsx`, `RightPanel.tsx`: read in full.
- `apps/web/src/stage/OperationDialogs.tsx` (`MergeAllDialog`), `stage/ArrangeView.tsx`
  (marquee, Mod+wheel), `stage/ReadView.tsx` (pinch and gesture handlers),
  `annotations/pen/ink-input.ts` (pointer roles), `annotations/AnnotationLayer.module.css`
  (`touch-action`), `annotations/selection-markup.ts`, `annotations/ReadSelectionBar.tsx`,
  `annotations/SignatureDialog.tsx`, `export/ExportDialog.tsx`,
  `tools/CompressionExportRow.tsx`, `tools/DocumentMenu.tsx`, `state/ui-store.ts` (defaults,
  `zoomIn`), `viewer/tool-store.ts` (one-shot tools): read in the cited parts.
- `apps/web/messages/en.json`: searched for every quoted string.
- `apps/web/src/i18n/locale.ts`, `i18n/language-commands.ts`: read.
- `docs/DESIGN.md` §2, §4, §4.8: read in full.
- `docs/design/redesign-2026-10/baseline/01-home-empty-390.png`, `03-read-390.png`,
  `04-edit-write-390.png`, `12-arrange-390.png`, `04-edit-write-1440.png` (screenshot
  track): viewed.
