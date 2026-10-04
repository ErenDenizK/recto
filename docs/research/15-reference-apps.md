---
title: "Research: reference apps, their journeys and the mode question"
date: 2026-10-04
status: snapshot
---

> Research snapshot gathered on 2026-10-04 for the M9 redesign. Apple's guidance was read in full
> from the JSON behind the Human Interface Guidelines (`developer.apple.com/tutorials/data/…`:
> toolbars, materials, motion, sidebars, Apple Pencil and Scribble, launching, onboarding, undo and
> redo, file management, segmented controls, modality, going full screen, gestures) and from the
> transcripts of thirteen WWDC sessions on `developer.apple.com/videos` (listed in Sources). Three
> open-source apps were read from shallow clones: Firefox's viewer `mozilla/pdf.js` at `2581d8f`
> (2026-10-03), `tldraw/tldraw` 5.5.2 at `db1c86e` and `excalidraw/excalidraw` at `ed10ac7`. Recto's
> own flows were counted from `apps/web/e2e` and `tools/media/scenes`, and measured with a
> Playwright script against the current production build (`7d47031`, Chromium 141) at five
> viewport sizes; the script and screenshots stayed in the scratch folder. Every other product rests
> on web-search abstracts (marked **[abs]**) or established knowledge (**[EK]**, not verified this
> session). Blocked by the egress proxy: appleinsider.com, slatepad.org, macmost.com,
> support.apple.com, webflow.goodnotes.com, support.gingerlabs.com and linear.app; the session's
> shared web-search quota ran out before Raycast's and Dia's 2026 designs were searched. Markers:
> **[read]** primary source read in full, **[src]** source code read, **[measured]** measured here.
> No other file was changed.

# Reference apps: how modern document and canvas apps flow

## 0. Verdict

- **No reference app has a three-way Read · Edit · Arrange switch.** The best apps fall into two
  families. In the *Markup toggle* family (Apple Preview, Quick Look and Files, Chrome's viewer,
  Excalidraw's View mode in reverse), reading is the default and one pen button brings out the tool
  palette. In the *task tab* family (PDF Expert, Acrobat's tool panel, Xodo), the user picks a job
  first. Notability and Procreate have no mode at all; GoodNotes has one read-only toggle. Recto
  should join the Markup family (§5, RA-1 to RA-4).
- **In the Markup family, deliberate targeted acts never need the toggle.** Preview fills a form
  field on a click and highlights a selection from the main toolbar; Firefox offers Highlight,
  Comment, Text, Draw and Add signature with no mode. Only freehand drawing and placing objects need
  the palette. Recto's Read lock adds a step to exactly the acts that cannot happen by accident.
- **Recto wins merging and ties text editing, but loses the everyday jobs** (§4): sign 6 actions
  against 3 (Recto keeps no saved signature), fill a form 3 against 2, highlight and comment 7
  against 4, move a page 3 against 1, redact 5 against 3, export 3–4 against 0–2. Merging two files
  takes 3 actions against 4–6 elsewhere and is the best of the set.
- **The phone is broken today, and every reference restructures near 600 px.** At 390 × 844 the
  navigator keeps 312 px of 390, the page covers 6.2 % of the screen and the document scrolls 75 px
  sideways **[measured]**. PencilKit docks its palette at the bottom in compact widths, tldraw folds
  its style panel into one button below 640 px, and Excalidraw uses its phone layout up to
  599 px wide **[read, src]**. Layout per form factor belongs in M9's structure, not in a later M10.
- **Glass in the best apps is the control layer, quiet at rest, never the content.** Apple's
  Liquid Glass covers bars, sidebars, menus and sheets, but "in steady states … avoid intersections
  between content and Liquid Glass". A year later Apple made it diffuse content "much more
  effectively", added a clear-to-tinted slider and brought back "a more uniform toolbar" on the Mac
  for legibility **[read]**. tldraw and Excalidraw use no `backdrop-filter` at all; pdf.js uses one
  7 px blur **[src]**. "Glass everywhere" can mean every control surface, but never the page, and
  light and motion work best as a response to touch, not as decoration (RA-15 to RA-17).
- **The "expensive" feel comes from receding chrome and instant response, not from more effects.**
  Linear dims its navigation so the content stands out **[abs]**; Raycast puts every action of the
  selected item behind ⌘K **[abs]**; Things 3 and Procreate make gestures carry the work; Apple's
  2018 fluid-interface rules (1:1 tracking, interruptible motion, projection of a throw, symmetric
  paths) still describe what "flows like butter" means **[read]**.
- **Keep what is already ahead:** Home as a place, the multi-document light table, ⌘K with
  arguments, Recents with file handles, undo for everything, and the honesty notices.

## 1. Method

A **step** is one deliberate action: a click or tap, a key or chord, one drag, one system picker
(counted once), and typing into one field. Waiting is not a step. Counts for other apps come from
their help pages (mostly abstracts) and assume the shortest documented path for a returning user
with defaults. Recto's counts come from the e2e specs (`home.spec.ts` asserts 3 and 4 actions for a
merge), the demo scenes, and a scripted run of the sign, highlight and form flows at 1440 × 900
**[measured]**.

**Recto today, measured.** With one 10-page file open in Read at 1440 × 900 the screen shows 29
interactive controls; the page covers 63.3 % of the viewport, the rail and Pages panel take 312 px
(21.7 % of the width) and the title bar 40 px. Edit shows 33 controls. The empty app shows 12. At
1180 × 820 the page covers 57.1 %, at 820 × 1180 45 % (page 411 px wide at 52 % zoom), and at
390 × 844 6.2 %, with the first page starting at x = 361 and 75 px of horizontal overflow. The
layout is the same desktop layout at every size **[measured]**.

## 2. Teardowns

Each app is covered on the journey's stages: start, open, navigate, tools, modes, selection,
inspector, undo, export, many documents, devices, and glass, light and motion. Stages with nothing
notable are left out.

### 2.1 Apple Preview on macOS 26

- **Start and open.** No launcher on the Mac: a PDF opens from the Finder by double-click or from
  the Open dialog, and windows restore on relaunch, as the HIG asks ("restore the previous state")
  **[read, EK]**.
- **Navigate.** A sidebar switches between Thumbnails, Table of Contents, Highlights and Notes,
  Bookmarks and Contact Sheet (a page grid in the main area) **[abs]**.
- **Tools.** A Highlight button with a colour menu sits in the main toolbar and works without
  Markup **[EK]**. The Markup toolbar appears from the pen-tip button or ⇧⌘A **[abs]** and holds
  text and rectangular selection, Sketch, Draw, Shapes, Text, Sign, Note, Redact and the style
  controls (shape style, border, fill, text style) **[abs]**.
- **Forms.** "Click a field in the form, then type your text." No mode **[abs, Apple Support]**.
- **Sign.** Sign → a saved signature (made once with the trackpad, the camera or an iPhone/iPad) →
  drag and resize it into place **[abs]**.
- **Pages.** Drag thumbnails to reorder; drag them into another document's sidebar to copy pages
  across; drag them to the Finder to make a new PDF; Delete removes the selected pages **[abs]**.
- **Redact.** Tools ▸ Redact (or the Markup toolbar), drag over text; content is removed when the
  file is saved, with a one-time warning **[abs]**.
- **Edit text.** Not possible; only text boxes over the page **[abs]**.
- **Save and share.** Autosave with versions, Export as PDF, the Share button **[EK]**. macOS 26
  adds View ▸ "Use Dark Appearance for PDF" **[abs]**.
- **Glass.** Sidebars and toolbars float over the window in Liquid Glass **[abs]**. In macOS 27
  the toolbar becomes "more uniform … across the top of apps" and sidebars run to the window edge
  **[read, WWDC26 keynote]**.

### 2.2 Preview on iPadOS and iOS 26; Quick Look and Files Markup

- **Start.** Document apps get the system *document launcher*: "a title card that displays the app
  title and two app-specific buttons", a background with optional accessories, and a sheet with a
  file browser. The HIG allows "gentle, repeating animations" there, such as an accessory that
  appears "to breathe or sway softly" **[read, HIG File management]**. Preview's buttons are New
  Document and Scan Document; the browser has Recents, Shared and Browse **[abs]**.
- **Open.** Since iOS 26 a PDF tapped in Files opens in Preview. iPhone users disliked being bounced
  out of Files; the workaround is a long press and Quick Look **[abs, 9to5Mac]**.
- **Navigate.** A thumbnail button shows every page as a grid; a tap jumps there **[abs]**.
- **Tools.** The Markup button shows the PencilKit tool picker plus PaperKit's insertion menu (+)
  for text, shapes, signatures and images **[read, WWDC25 285; abs]**. The picker "floats above
  everything. I can drag it from edge to edge or even dock it to the bottom"; in compact widths it
  is docked at the bottom and its undo and redo buttons disappear, so the app must show its own
  **[read, WWDC19 221]**. An Auto-Minimize option shrinks it to a circle as soon as the pencil draws
  **[abs]**. With Apple Pencil Pro a squeeze shows the picker where the pencil hovers, and a long
  press on Undo opens a slider that scrubs through many undos **[read, WWDC24 10214]**.
- **Forms and signatures.** Fields are detected and AutoFill fills them from Contacts; + → Add
  Signature → a saved signature → drag **[abs]**. Files' Markup ends with **Done**, which saves in
  place **[abs]**.
- **Pencil.** The HIG: "Let people make a mark the moment Apple Pencil touches the screen … avoid
  requiring people to tap a button or enter a special mode before they can make a mark", and hover
  should preview the mark, never act **[read]**.
- **Gestures.** Three-finger swipe left and right undo and redo; three-finger pinch copies and
  pastes **[read, HIG Gestures]**.
- **Glass and motion.** Controls live on "a singular floating plane" that morphs between states; a
  menu "simply pops open" from its button; glass "illuminates from within" starting under the
  fingertip; objects "materialize in and out" by lensing rather than fading; in steady states,
  content and glass should not overlap **[read, WWDC25 219]**.

### 2.3 Apple Notes and Freeform

- Notes in iOS 26 has the full Markup palette (monoline, fountain and the new reed pen, watercolour,
  crayon) and the Liquid Glass bars **[abs]**.
- Freeform shows a floating toolbar for the selected item on iPhone and iPad with Fill, Stroke and
  Text inspectors; on the Mac the same options come from a right-click or the Format menu
  **[abs]**. PaperKit, the framework under Notes, Preview's markup and Freeform, gives each element
  "allowedInteractions" down to read-only **[read, WWDC26 372]**.

### 2.4 Notability

- **Start.** The Library is the landing page: a sidebar of Subjects grouped by Dividers, notes on
  the right. +New creates a note; a long press on +New offers Import from Files, Drive, Dropbox and
  others, and asks for a subject **[abs]**.
- **Tools.** Since version 14 a floating Toolbox holds every tool (tape, ruler and laser pointer
  included); each tool with styles has its own tray of presets; notes run full screen with the
  title above **[abs]**.
- **Modes.** None in normal use; a per-note read-only option lives in the note menu
  **[research 13]**. **Focus Mode**: a four-finger tap hides toolbars, panels and menus and leaves
  "a single active tool that can be moved to any corner"; a tap on that tool or another four-finger
  tap brings everything back **[abs]**.
- **Glass.** Flat, opaque bars **[EK]**.

### 2.5 GoodNotes 6

- **Start.** Home with a New button: Notebook, Folder, Import **[abs]**.
- **Tools.** The September 2025 toolbar floats and can be placed top, bottom, left or right; it
  hides by tapping the active Pen, Shapes or Stickers icon; a "Pin Text Tool" keeps the Text tool
  armed; customisation followed on 2025-11-20. Users split on it: some like that it only covers the
  margin, others report slower access to tools **[abs]**.
- **Modes.** Edit and Read-Only, switched with the pencil icon; links still work in Read-Only
  **[abs]**; the navigation bar changes colour by mode **[research 13]**.
- **Pages.** Sidebar thumbnails reorder by long press and drag; a check icon starts multi-select;
  Thumbnail View → Select → Move sends pages to another notebook, appended at its end **[abs]**.

### 2.6 PDF Expert (Mac, iPad, iPhone)

- **Toolbar.** Left: layout, outline, insert, delete and rotate pages. Centre: task tabs Annotate,
  Edit, Scan & OCR, Measure, Fill & Sign, Export. Right: search and an AI chat button **[abs]**. A
  permanent Tools tab beside the document tabs groups Organize, Optimize, Protect, Review, Create
  and Convert **[abs]**. Reading mode hides the toolbar **[abs]**.
- **Edit text.** Edit tab → click a paragraph (Option-click for one line) → type → click empty
  space **[abs]**.
- **Redact.** Edit tab → Redact → Blackout or Erase → select text → Redact again to leave; a search
  panel offers Erase All **[abs]**.
- **Merge.** File ▸ Merge Files, select, Merge; or Thumbnails → Append file; thumbnails drag between
  open PDFs **[abs]**.
- **Sign (iPad).** Fill & Sign → Signature → a saved signature → tap to place **[abs]**. On iPhone
  the tools sit in a bottom toolbar **[abs]**.

### 2.7 Adobe Acrobat, 2023–2026 (note, do not copy)

- An **All tools** panel on the left groups every tool by category; a floating **quick action
  toolbar** in the document can be dragged and customised from its ⋯ menu **[abs]**.
- **Selection.** Selected text gets a floating bar: Add a comment, Highlight, Underline,
  Strikethrough, Redact text, Copy, Edit a PDF. "Add a comment" highlights the text and opens the
  comment in one step; Post saves it **[abs]**.
- **Sign.** Sign → Sign yourself → a saved signature → click to place **[abs]**.
- **What went wrong.** The All tools pane could not be hidden and reopened with every PDF; the
  comment tool needed "View more"; panels swapped sides; users looked for "Disable new Acrobat"
  **[abs]**. 2025–26 adds Acrobat Studio, PDF Spaces and a prompt bar on Home **[abs]**.

### 2.8 Browser viewers: Chrome, Edge, Firefox

- **Chrome 145** (February 2026): a squiggle icon in the top row turns annotation on; pen,
  highlighter and eraser with size and colour in a right-hand panel; text highlights and notes;
  Download asks whether to keep the changes; Save to Drive **[abs]**.
- **Edge**: the Adobe-engine viewer became the default from October 2025 and the old one retired in
  September 2026 **[abs]**; the old toolbar had Draw, Highlight, Add text, Erase and Read aloud
  **[EK]**.
- **Firefox (pdf.js)**: no mode. The toolbar offers Highlight, Comment, Text, Draw, Add signature
  (saved signatures, with "Remove saved signature") and Add or edit images. Deleting shows an undo
  bar: "Highlight removed · Undo". A **Manage pages** sidebar has Select pages → Manage (Copy, Cut,
  Delete, Export selected…), Paste before or after, Add file (PDF or image), Undo and Done, and
  thumbnails reorder by drag **[src]**. That sidebar is the one place with a blur (7 px) **[src]**.

### 2.9 Figma UI3

- A slim **bottom toolbar** in every Figma product; optional property labels for newcomers;
  **Minimize UI** (⇧\) floats the panels, and a selection brings the properties back **[abs]**.
- Floating side panels shipped in the beta and were reverted: they "cramped the canvas", designs
  peeked out "in a distracting way", rulers moved away, and "the nail in the coffin was learning
  that they slowed people down" **[abs, Figma blog]**.

### 2.10 tldraw and Excalidraw (source read)

- **tldraw 5.5.2.** Tool bar at the bottom centre showing 4 to 8 tools between 310 and 470 px, the
  rest in an overflow. Below 840 px the quick actions (undo, redo, delete, duplicate) join the tool
  bar; below 640 px the style panel collapses into one colour button that opens a popover; the
  minimap shows from 840 px. Read-only hides the tools. Pen mode switches on at the first pen
  contact and then ignores other pointers **[src]**. No `backdrop-filter`; three shadow tokens;
  transitions of 80–200 ms **[src]**.
- **Excalidraw.** Form factor *phone* at ≤ 599 px wide, or under 500 px high and under 1000 px
  wide; *tablet* when the short side is ≥ 600 px and the long side ≤ 1180 px; desktop has a stored
  "compact" or "full" UI. View mode (read-only, Alt+R) hides the tools; Zen mode hides the panels.
  No `backdrop-filter` **[src]**.

### 2.11 Procreate

- Gestures carry the chrome's work: two-finger tap undoes, three-finger tap redoes, holding either
  steps quickly through history; a four-finger tap hides the interface; a three-finger swipe down
  opens copy and paste. A floating "Single Touch" companion offers the same as buttons for those
  who cannot use multi-finger gestures **[abs]**.

### 2.12 Apple Books and Kindle (reading mode)

- Both hide the chrome while reading and show it on a tap in the centre. Books keeps its controls in
  one reading menu at the bottom right and offers Slide, Curl, Fast Fade or Scroll page turns
  **[abs]**. Kindle's 2025 page view shows the full page with slivers of the previous and next
  pages **[abs]**.

### 2.13 The expensive feel: Arc and Dia, Linear, Raycast, Things 3, Craft

- **Arc**: a hideable sidebar instead of a tab strip; a Command Bar (⌘T) for tabs, history and
  actions; Little Arc for quick links **[abs]**. Dia was not searched (quota).
- **Linear**: the 2026 refresh made the navigation "slightly dimmer, allowing the main content area
  to stand out", and moved the theme system to LCH so equal lightness looks equal **[abs]**.
- **Raycast**: every item has an Action Panel on ⌘K that lists its actions with their shortcuts,
  so shortcuts are learned in passing **[abs]**.
- **Things 3**: the Magic Plus button is dragged to where the new item should go; pulling down
  anywhere opens Quick Find; drags and drops have subtle motion and haptics **[abs]**.
- **Craft**: a slash menu and floating formatting menus keep writing uninterrupted; Apple Design
  Award and Mac App of the Year 2021 **[abs]**.

## 3. Patterns across the apps

| App | Modes | How tools are reached | Selection → actions | Pages | Undo surface |
|---|---|---|---|---|---|
| Preview (Mac) | Markup toolbar toggle; forms, highlight, notes without it | Main toolbar + Markup row; menus; ⇧⌘A | Highlight from toolbar; context menu | Sidebar drag, across documents, to Finder | Edit menu, ⌘Z |
| Preview / Files (iPad) | Markup button, Done | Floating tool picker + insertion menu | Edit menu over text | Grid button | In the picker (regular width); long-press scrub |
| Notability | None (optional per-note read-only) | Floating Toolbox, presets in trays | Lasso, floating menu | Page sorter | Toolbar; gestures |
| GoodNotes 6 | Edit / Read-Only (pencil) | Floating toolbar on any edge | Lasso menu | Sidebar drag; Move to notebook | Toolbar |
| PDF Expert | Task tabs | Centre tabs + Tools tab | Popup over text | Thumbnails, Append file | ⌘Z, toolbar |
| Acrobat | Tool modes (Edit PDF explicit) | All tools panel + floating quick bar | Floating bar incl. "Add a comment" | Organize pages tool | ⌘Z |
| Chrome / Firefox | Annotation toggle (Chrome); none (Firefox) | Top row buttons | Highlight / Comment on selection | Firefox: sidebar drag, cut, paste | Undo bar toast (Firefox) |
| Figma UI3 | Design / Dev | Bottom tool bar, ⌘K | Properties panel follows selection | — | ⌘Z |
| tldraw / Excalidraw | Read-only / View mode | Bottom tool bar, keys | Style panel for selection | — | Toolbar on small screens |
| Procreate | None | Top bar + sidebar sliders | Selection tools | Gallery | 2- and 3-finger taps |
| Recto today | Read · Edit · Arrange | Floating capsule, 5 groups, keys, ⌘K | Read: Copy, Edit text, Mark up…; Edit: markups, Comment | Arrange view only | ⌘Z, History panel |

Recurring patterns, in order of how many references use them:

1. **One floating palette for tools**, movable, collapsible to the active tool (Preview iPad,
   Notability, GoodNotes, Acrobat, Figma, tldraw).
2. **Contextual bar on a selection** with the three to seven actions that apply (all except
   Procreate).
3. **Saved signatures**: create once, then Sign → pick → place (Preview, iOS Markup, PDF Expert,
   Acrobat, Firefox). Recto is the only one that asks for a new drawing every time.
4. **Reorder in the thumbnail sidebar**, no separate mode (Preview, GoodNotes, PDF Expert,
   Firefox).
5. **The document title as a menu** for whole-document actions (iPadOS editor-style bars:
   "a great place to show document metadata and surface actions that apply to the whole document"
   **[read, WWDC22 10070]**; Preview on iOS **[EK]**).
6. **Chrome that hides on demand**: Focus Mode, Minimize UI, Zen mode, reading mode, a tap in the
   centre (Notability, Figma, Excalidraw, PDF Expert, Books, Kindle).
7. **Undo you can see**: an undo toast after a removal (Firefox), a scrub slider (iPadOS), finger
   taps (Procreate), a history list (Recto, Photoshop-style apps).

## 4. Step counts: best app against Recto today

| Job | Best reference (steps) | Recto today (steps, path) | Recto proposed |
|---|---|---|---|
| Open and read one PDF | Preview: double-click in the Finder (1) [EK] | 1 by drop; 2 by Open files + picker; Recents 1–2 (permission) | 1, also from the OS (RA-10) |
| Highlight a sentence | Acrobat: select, Highlight (2) [abs]; Preview: Highlight on, drag (2) [EK] | 3: select, H (switches to Edit), H [measured] | 2: select, Highlight |
| Highlight and comment | Acrobat: select, Add a comment, type, Post (4) [abs] | 7: select, H, H, select again (the selection clears after marking), Comment, type, Esc [measured + code] | 4 (RA-6) |
| Sign with a drawn signature | Acrobat, Firefox, PDF Expert: Sign, pick saved, click (3) [abs, src] | 6, every time: Edit, Fill & sign, Signature image, draw, Use signature, click [measured]; nothing is kept [src] | 3; 5 the first time (RA-5) |
| Fill a form's first field | Preview, Chrome, Firefox: click, type (2) [abs, EK] | 3: click, the notice's Edit, type [measured] | 2 (RA-3) |
| Merge two PDFs | PDF Expert: Merge Files, select, Merge (4) [abs] | 3: drop both, Combine 2 files, Combine; 4 via Open files [e2e] | 3, keep |
| Move one page | Preview, GoodNotes, Firefox: drag in the sidebar (1) [abs, src] | 3: Arrange, drag, back to Read | 1 (RA-7) |
| Rotate one page | Preview: select thumbnail, ⌘R (2) [EK] | 3 in Arrange (3, click, R); 4 from Read via the page menu | 2 |
| Redact a phrase | Preview: Redact, drag, save (3) [abs] | 5 by keys: X, drag, Apply, confirm, Esc; 7 by mouse [code, scene 03] | 4: select, Redact, Apply…, confirm |
| Edit a line of text | PDF Expert: Edit tab, click, type, click out (3) [abs] | 3: E, click, type, Esc [scene 06] | 3, with no mode change |
| Save or export | Preview: autosave (0); Export as PDF, Save (2–3) [EK] | 3–4: Export, Export, Download (+ the save picker) [e2e] | 1 with ⌘S in place; 2 otherwise (RA-14) |

Across the eleven jobs Recto takes 40–46 steps today against 25–27 for the best reference app of
each row; the proposals bring it to 26–27. The two largest single gaps, signing and commenting, are
mostly interface and local-storage work: a saved signature list and a Comment action that writes
one Highlight annotation with its note, both kinds the engine already writes today.

## 5. The mode question

**What the references do.** Every app with a pen makes drawing an explicit state, and no PDF
editor turns a plain click on page text into editing (research 13 §5). But the state is a
*palette*, not a *mode of the document*:

- Apple shows the document, and one Markup button brings out the tools; Done puts them away. Form
  fields, text highlights and notes work without it on the Mac **[abs, EK]**.
- Chrome's squiggle button does the same; Firefox shows its editing buttons all the time and has no
  mode **[abs, src]**.
- PDF Expert and Acrobat ask for the task first, which suits long editing sessions and costs a step
  for one quick mark **[abs]**.
- GoodNotes is the only one with a read-only toggle in the main bar, and it spends a bar colour on
  it **[abs]**. Excalidraw's View mode and tldraw's read-only are mostly for shared, view-only
  links **[src]**.
- Page arranging is a *view*: Preview's Contact Sheet, the iPad grid button, GoodNotes' Thumbnail
  View, Firefox's Manage pages sidebar. Nobody makes it a peer of reading and editing.
- Apple's segmented-control guidance points the same way: segments are "closely related choices
  that affect an object, state, or view", with nouns as labels **[read]**. Read, Edit and Arrange
  mix a permission (may the page change), a palette (which tools show) and a view (pages or grid).

**What the owner asked for in October.** Protection against a pen or a stray click editing page
text, and a locked state (ADR-0019). Both can be kept without a mode on everyone's path: accidents
come from pointers that draw or edit without a target. A form field, a selected sentence and a
"Redact" button are targets. A freehand stroke and a double-click on body text are not.

**Recommendation.**

1. **Viewing is the default and is not locked.** Scroll, zoom, find, links and notes as today;
   plus the deliberate, targeted acts: click a form field and type; select text and pick Highlight,
   Comment, Redact or Edit text from its bar; right-click a page for page actions. Each is one undo
   step.
2. **Markup is one toggle.** A pen-tip button, labelled "Markup", brings out the floating palette
   (pens, Highlighter, eraser, lasso, shapes, text box, note, image, stamp, signature, redaction
   marks). Closing it returns to viewing. Tool keys open it and arm the tool, as today.
3. **The pen is its own switch on tablets.** Once a pen has been seen, a pen touch draws with the
   last pen preset even with the palette closed (the HIG's "make a mark the moment Apple Pencil
   touches the screen"), and the palette appears in its minimised form. Fingers and the mouse never
   draw without the palette.
4. **Page text changes only through the paragraph editor**, opened by Edit text on a selection, by
   E, or by a double-click with the palette open, never by a single click (ADR-0020 stays).
5. **Pages is a view of the sidebar**, not a segment: a grid button in the Pages panel, a pinch out
   past the whole page, or a key. Reordering also works by dragging in the sidebar.
6. **Lock is an option, not a mode.** "Lock document" in the title menu blocks every change for that
   document (GoodNotes' read-only); it could default to on for digitally signed files, whose
   signature any change breaks.

What this costs: the Read lock as a default goes, and with it ADR-0019's segmented control, keys 1
and 2, the "Switch to Edit to fill" notice and the collapsed Edit button. What it keeps: the
explicit drawing state, the hit order, the paragraph-editor-only rule, the pen and finger policy and
per-document memory.

## 6. Phone, tablet and desktop

| | Phone (< 600 px, or < 500 px high) | Tablet (short side ≥ 600, long side ≤ 1180) | Desktop (> 1180 px) |
|---|---|---|---|
| Apple | Bottom bar; tool picker docked at the bottom, no undo in it | Floating picker, docks to any edge; sidebar | Top toolbar; Markup row; sidebar |
| GoodNotes, Notability | iPhone apps with bottom tools [EK] | Floating toolbar on any edge | Mac apps from the iPad layout [EK] |
| tldraw | Style panel = one button < 640; quick actions in the tool bar < 840 | Same | Style panel, minimap ≥ 840 |
| Excalidraw | Phone layout ≤ 599 | Compact styles panel | Compact or full, stored |
| Recto today | Desktop layout: page 6.2 %, 75 px overflow | Page 45 % portrait, 57 % landscape | Page 63 % at 1440 × 900 |
| Recto proposed | Page full screen; top bar (Home, title menu, Markup); bottom bar 56 px (Pages, Find, Markup, Share); palette docked at the bottom; panels as sheets | Sidebar slides over the page (280 px); palette floats and docks; 44 px targets | Docked sidebar 248 px, collapsible; palette at the bottom centre; title menu |

## 7. Glass, light and motion in the references

| Where | Glass | Light | Motion |
|---|---|---|---|
| Apple 26 | Control layer only: bars, sidebars, menus, sheets. Regular for text-heavy surfaces; Clear only over media, with a 35 % dimming layer over bright content; larger surfaces read as thicker | Highlights move with interaction; glass glows from the fingertip | Controls morph on one plane; menus pop from their button; materialise by lensing |
| Apple 27 | More diffusion; clear-to-tinted slider; uniform Mac toolbar | Sidebar icons regain colour | System animations smoother |
| Figma, tldraw, Excalidraw | None (tldraw, Excalidraw: zero `backdrop-filter`) | — | 80–200 ms transitions (tldraw) |
| pdf.js | One 7 px blur on the sidebar | — | — |
| Linear, Things, Craft | None; dimmed navigation (Linear) | — | Subtle drags and haptics (Things) |
| Arc, Raycast | macOS vibrancy over the desktop [EK] | Gradient themes (Arc) [EK] | — |

Three lessons for Recto's glass direction (values belong to the glass and motion tracks):

1. **Every control surface can be glass; the page and thumbnails cannot.** That is Apple's own
   line: "Don't use Liquid Glass in the content layer" **[read]**.
2. **Glass needs something to show.** Apple extends content under sidebars and bars; research 13
   found glass over a flat canvas composites to a flat colour. Light behind the glass (the
   owner's aurora) only reads where the chrome floats over it: Home, the margins around the page
   and the palette's surroundings, not under the page.
3. **Light as a response.** Apple's glass "illuminates from within" on touch, and the launcher is
   the one place where the HIG asks for an ambient, gently moving background. A lime light that
   answers a press, a drop or a completed export is closer to the references than one that moves
   on its own over the work.

## 8. Steal, adapt, avoid

**Steal**

- The Markup toggle and Done (Apple, Chrome) → RA-1.
- Saved signatures (everyone) → RA-5.
- Comment on a selection that highlights and opens the note at once (Acrobat) → RA-6.
- Reorder by dragging in the sidebar (Preview, GoodNotes, Firefox) → RA-7.
- The document title as the document menu (iPadOS editor bars) → RA-9.
- An undo toast after any removal (Firefox), a scrub slider on long-press Undo (iPadOS),
  two-finger tap undo and three-finger tap redo (Procreate) → RA-11.
- Focus: hide everything but the active tool (Notability), a tap in the centre to bring chrome back
  (Books) → RA-12.
- A palette that docks to an edge and minimises to the active tool while drawing (PencilKit,
  GoodNotes, Notability) → RA-2.

**Adapt**

- PDF Expert's task tabs → sections inside one palette, never modes.
- Preview's Contact Sheet → Recto's light table stays the multi-document grid, reached as a view.
- tldraw's overflow rules and Excalidraw's form factors → Recto's breakpoints (RA-18).
- Raycast's Action Panel → ⌘K lists the selection's actions first (RA-22).
- Linear's dimmed navigation → the sidebar recedes one step below the page; the page stays the
  brightest thing.
- Apple's document launcher → Home's first view (RA-19).

**Avoid**

- Acrobat's tools panel that reopens with every file and hides commenting behind "View more".
- Floating side panels on the desktop (Figma reverted them).
- Tinting the chrome by mode (GoodNotes).
- Icon-only tool rows where no symbol is obvious: Recto's Fill & sign row shows five unlabelled
  icons today **[measured, screenshot]**; Apple: "When there's no clear shorthand, a text label is
  always the better choice" **[read]**.
- Hiding menu items by context: Apple asks to keep items in place and dim them, because "people
  need to re-scan the entire menu each time" otherwise **[read, WWDC25 208]**.
- Bouncing a single file through another screen (iOS Files → Preview) when the user only wanted to
  look.

## 9. Recommendations

**RA-1 · Markup toggle replaces Read · Edit · Arrange** (high). A "Markup" button (pen-tip icon and
label, `aria-pressed`) at the right of the title bar on desktop and tablet, in the bottom bar on
phones; key **M** (free in today's shortcut table). Pressed: the palette rises from the bottom
edge; released: viewing. Esc disarms the tool to Select, a second Esc closes the palette (Files'
Done). Remembered per document for the session. Keys 1 and 2 retire; 0 stays Home.

**RA-2 · One floating palette** (high). Today's 44 px capsule becomes the palette with its five
sections (Select, Write, Text, Fill & sign, Redact). On tablet and desktop it docks at the bottom
centre (default), or the left or right edge at mid-height; a drag snaps it to the dock nearest the
*projected* release point (WWDC18's projection with the scroll view's normal deceleration rate,
0.998 per ms: offset = v / 1000 × 0.998 / (1 − 0.998), about 0.5 × v px for v in px/s; the method
is [read], the formula [EK]). While a stroke continues for more than 3 s it shrinks to a 44 px chip
of the active preset; a tap restores it. On phones it docks full width at the bottom (56 px plus the safe area) and undo and redo move
to the top bar, as PencilKit does in compact widths.

**RA-3 · Viewing allows targeted acts** (high). A click on a form field focuses and fills it; text
selection gets the bar of RA-8; the page context menu offers Rotate, Delete and Crop. These go
through the existing store guard, which now checks Lock (RA-4) instead of the mode.

**RA-4 · Pages as a view; Lock as an option** (medium). Arrange becomes "Pages": a grid button in
the Pages panel header, a pinch out past the whole page on touch, and key 3. Compare stays a view
shown only while open. "Lock document" in the title menu blocks every change with one notice; it
defaults to on for files with a valid digital signature (owner question 1).

**RA-5 · Saved signatures** (high). Up to five signatures (drawn strokes, typed name or image)
stored on the device in IndexedDB (`pdf-editor:signatures:v1`), listed in the privacy popover with
a Clear button, never exported or sent anywhere. Sign (in Fill & sign and on a signature field)
opens a popover of saved signatures, newest first, plus "New signature…". A click places it 150 pt wide at
the click, or fitted to a signature field's rectangle. Result: 3 steps, 5 the first time.

**RA-6 · Comment on a selection** (high). "Comment" on a text selection creates one Highlight
annotation with `/Contents` and a `/Popup`, opens the note editor at the end of the selection's
last line, and saves on Enter or Esc, as one history entry "Comment on page N". Review lists it with
the quoted text. Highlight then Comment on the same selection reuses the new highlight.

**RA-7 · Reorder in the sidebar** (high). Thumbnails in the Pages panel drag to reorder, with the
light table's 2 px insertion bar and the existing `dnd/page-drag.ts`; Shift and Mod extend the
selection; dropping on another document's tab after a 500 ms hover moves the pages into it.

**RA-8 · Selection bar** (high). For text: Copy · Highlight (a long press or right-click shows the
four tints) · Comment · Redact · Edit text; Underline, Strikeout and Squiggly in a ⋯ overflow. At
most five visible actions, labels on desktop, icons with tooltips on phones.

**RA-9 · Title menu** (medium). The active document's name in the title bar (top bar on phones)
opens the whole-document menu with a header (first-page thumbnail, name, pages, size) and Rename,
Duplicate, Export…, Print, Document info, Lock, then today's sections. The separate "Document"
button retires.

**RA-10 · Opening from the OS and restoring** (medium). Add `file_handlers` for `application/pdf`
and `launch_handler: { client_mode: "focus-existing" }` to the manifest so an installed Recto opens
PDFs from the operating system into a tab (Chromium desktop) **[EK]**. On reload, offer "Reopen 3
documents" from kept handles, as the HIG asks to restore state.

**RA-11 · Visible undo** (high). After any removal (page, annotation, signature, combined file) a
toast "Page 3 deleted · Undo" for 6 s, as Recto's Combine toast does today. On touch devices, a
two-finger tap undoes and a three-finger tap redoes. A long press on Undo opens a scrub slider over
the History entries.

**RA-12 · Focus** (medium). F, or a four-finger tap, hides every surface but the palette chip (in
Markup) or everything (in viewing); a tap in the page's centre third, F or Esc brings it back.

**RA-13 · Selection brings back what it needs** (medium). With panels hidden, a selection shows its
contextual bar only; the inspector never opens on its own (DESIGN §2 already says so).

**RA-14 · Save in place** (medium). Where the browser gave a file handle with write permission
(Chromium), ⌘S writes back to the original and runs the verification afterwards ("Saved ·
verified"). Export… keeps the dialog for copies and other formats, and its Export and Download
merge into one button that opens the save picker first. On phones, Share uses the Web Share API
with files where `navigator.canShare` allows it **[EK]**.

**RA-15 · Glass only on the control layer** (high). Palette, bars, menus, popovers, sheets and the
docked frame may be glass; the page, thumbnails, the light table cells and text inputs stay opaque.
At rest no glass sits over page content: fit and centring keep the page clear of the palette and
bars (Apple's steady-state rule).

**RA-16 · Morph, do not swap** (medium). Palette sections morph in place (today's 160 ms); menus and
popovers grow from their button's rectangle; the Pages grid opens by zooming out of the current page
and closes back into it (symmetric paths, WWDC18).

**RA-17 · Response before animation** (high). Visual feedback on press within one frame (16 ms);
drags track 1:1; thrown objects use projection; chrome moves on critically damped springs (bounce 0,
WWDC23's "smooth"), with a small bounce (≈ 0.15) only for objects the user throws, such as the
palette; every animation can be interrupted mid-flight. Reduced motion: 120 ms cross-fades.

**RA-18 · Three form factors** (high). Excalidraw's thresholds: phone at ≤ 599 px wide or under
500 px high with under 1000 px wide; tablet when the short side is ≥ 600 px and the long side
≤ 1180 px; desktop beyond. Phone: no rail, panels as bottom sheets, page full screen. Tablet:
sidebar slides over, 44 px targets for coarse pointers. Desktop: today's docked frame.

**RA-19 · Home as a launcher** (medium). The empty Home follows Apple's document launcher: a title
card with the product name and two buttons (Open PDFs…, and the most useful second action, such as
Combine files…), a lit background (the aurora's natural home, with the HIG's "breathe or sway
softly" as the motion budget), and Recents below. With files open, Home stays today's cards.

**RA-20 · Labels where symbols are unclear** (medium). Palette sections and the Fill & sign and
Redact rows carry text labels on desktop; a setting hides them (Figma's property labels).

**RA-21 · Static menus** (low). The title menu and context menus keep their items in place and dim
unavailable ones with a reason in the tooltip, instead of adding and removing "Remove …" items.

**RA-22 · ⌘K knows the selection** (medium). With a selection, the command palette's first group is
that selection's actions (Highlight, Comment, Redact, Copy for text; Rotate, Delete, Extract for pages),
each with its shortcut, as Raycast's Action Panel does.

## 10. Questions for the owner

1. Is a locked Read state still wanted as the default, or is an optional Lock per document (on by
   default only for signed files) enough?
2. On a tablet, should a pen draw at once with the palette closed, as Apple's guidance asks?
3. Should phone support (390 px and up) be part of M9's first drop rather than M10?
4. May Recto keep up to five signatures in this browser's storage, listed and clearable in the
   privacy popover?
5. On Chromium, should ⌘S overwrite the original file, or should every save stay "export a copy"?
6. Should the empty Home become a launcher with the brand and the aurora, or stay a quiet drop
   target?

## Sources

Primary, read in full:

- Apple HIG (JSON via `developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json`):
  [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars),
  [Materials](https://developer.apple.com/design/human-interface-guidelines/materials),
  [Motion](https://developer.apple.com/design/human-interface-guidelines/motion),
  [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars),
  [Apple Pencil and Scribble](https://developer.apple.com/design/human-interface-guidelines/apple-pencil-and-scribble),
  [Launching](https://developer.apple.com/design/human-interface-guidelines/launching),
  [Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding),
  [Undo and redo](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo),
  [File management](https://developer.apple.com/design/human-interface-guidelines/file-management),
  [Segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls),
  [Modality](https://developer.apple.com/design/human-interface-guidelines/modality),
  [Going full screen](https://developer.apple.com/design/human-interface-guidelines/going-full-screen),
  [Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures) — read in full.
- WWDC transcripts — read in full:
  [Meet PaperKit (WWDC25 285)](https://developer.apple.com/videos/play/wwdc2025/285/),
  [Unwrap PaperKit (WWDC26 372)](https://developer.apple.com/videos/play/wwdc2026/372/),
  [Read between the strokes with PencilKit (WWDC26 203)](https://developer.apple.com/videos/play/wwdc2026/203/),
  [Squeeze the most out of Apple Pencil (WWDC24 10214)](https://developer.apple.com/videos/play/wwdc2024/10214/),
  [Introducing PencilKit (WWDC19 221)](https://developer.apple.com/videos/play/wwdc2019/221/),
  [Meet Liquid Glass (WWDC25 219)](https://developer.apple.com/videos/play/wwdc2025/219/),
  [Get to know the new design system (WWDC25 356)](https://developer.apple.com/videos/play/wwdc2025/356/),
  [Elevate the design of your iPad app (WWDC25 208)](https://developer.apple.com/videos/play/wwdc2025/208/),
  [Keynote, design segment (WWDC26 101)](https://developer.apple.com/videos/play/wwdc2026/101/),
  [Principles of great design (WWDC26 250)](https://developer.apple.com/videos/play/wwdc2026/250/),
  [Designing Fluid Interfaces (WWDC18 803)](https://developer.apple.com/videos/play/wwdc2018/803/),
  [Animate with springs (WWDC23 10158)](https://developer.apple.com/videos/play/wwdc2023/10158/),
  [Build a desktop-class iPad app (WWDC22 10070)](https://developer.apple.com/videos/play/wwdc2022/10070/).
- Source code — read in the files named:
  [mozilla/pdf.js](https://github.com/mozilla/pdf.js) at `2581d8f` (`web/viewer.html`,
  `l10n/en-US/viewer.ftl`, `web/pdf_thumbnail_viewer.js`, `web/views_manager.css`);
  [tldraw/tldraw](https://github.com/tldraw/tldraw) 5.5.2 at `db1c86e`
  (`packages/tldraw/src/lib/ui/constants.ts`, `components/Toolbar/DefaultToolbar.tsx`,
  `components/MobileStylePanel.tsx`, `components/InputModeMenu.tsx`, `packages/editor/editor.css`,
  `packages/editor/src/lib/editor/Editor.ts`);
  [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) at `ed10ac7`
  (`packages/common/src/editorInterface.ts`, `packages/excalidraw/components/LayerUI.tsx`,
  `packages/excalidraw/actions/shortcuts.ts`, `packages/excalidraw/locales/en.json`).
- Recto: `apps/web/e2e/{home,modes,forms,export,annotations,light-table}.spec.ts`,
  `tools/media/scenes/0{1,2,3,6,7,8}-*.clip.ts`, `apps/web/src/shell/FloatingToolbar.groups.ts`,
  `apps/web/src/annotations/{SignatureDialog.tsx,selection-markup.ts,tools.ts}`,
  `apps/web/vite.config.ts`; measured with Playwright against the build of `7d47031`.

Known only from search abstracts:

- Preview, iOS and iPadOS 26: [iGeeksBlog](https://www.igeeksblog.com/how-to-use-preview-app-on-iphone-ipad/),
  [iPhone Life](https://www.iphonelife.com/content/how-to-use-preview-app-iphone-ipad-new-ios-26),
  [Popular Science](https://www.popsci.com/diy/preview-app-iphone/),
  [9to5Mac PSA](https://9to5mac.com/2025/10/18/ios-26-preview-app-psa/),
  [Apple: forms and signatures on iPhone](https://support.apple.com/guide/iphone/fill-forms-sign-documents-create-signatures-iph1d3607e5c/26/ios/26),
  [Apple: customize the toolbar in Preview on iPad](https://support.apple.com/guide/ipad/customize-the-toolbar-ipad7796380e/ipados),
  [iDownloadBlog: tool palette](https://www.idownloadblog.com/2019/06/06/ipados-13-overview-apple-pencil/) — abstracts.
- Preview, macOS: [Apple: fill out and sign](https://support.apple.com/guide/preview/fill-out-and-sign-pdf-forms-prvw35725/mac),
  [Apple: combine PDFs](https://support.apple.com/guide/preview/combine-pdfs-prvw43696/mac),
  [Apple: add, delete or move pages](https://support.apple.com/guide/preview/add-delete-or-move-pdf-pages-prvw11793/mac),
  [Apple: annotate a PDF](https://support.apple.com/guide/preview/annotate-a-pdf-prvw11580/mac),
  [WebNots: Preview shortcuts](https://www.webnots.com/keyboard-shortcuts-for-preview-app-in-mac/),
  [Setapp: redact](https://setapp.com/how-to/redact-pdf),
  [Setapp: cannot edit text](https://setapp.com/how-to/cant-edit-pdf-files-in-mac-preview),
  [MacRumors: macOS Tahoe features](https://www.macrumors.com/2025/09/24/all-the-new-macos-tahoe-features/),
  [MacRumors: Tahoe unveiled](https://www.macrumors.com/2025/06/09/apple-unveils-macos-tahoe-26/) — abstracts.
- Notes and Freeform: [9to5Mac: Notes in iOS 26](https://9to5mac.com/2025/10/16/heres-everything-new-for-apple-notes-in-ios-26/),
  [Make Tech Easier: Freeform](https://maketecheasier.com/apple-freeform-app/) — abstracts.
- Notability: [Focus Mode](https://support.gingerlabs.com/hc/en-us/articles/11012024558106-Focus-Mode),
  [Subjects and Dividers](https://support.gingerlabs.com/hc/en-us/articles/5949216168474-Subjects-and-Dividers),
  [Importing Files](https://support.gingerlabs.com/hc/en-us/articles/206061357-Importing-Files),
  [Notability 14 (Medium)](https://medium.com/@paperlessx/whats-new-in-notability-14-paperless-x-fc251e9fee46) — abstracts.
- GoodNotes: [September 2025 update](https://webflow.goodnotes.com/blog/features-fixes-updates-september-2025),
  [toolbar feedback thread](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes-apple/suggestions/50550846--sep-2025-launch-new-toolbar-suggestions),
  [Customize the toolbar](https://support.goodnotes.com/hc/en-us/articles/8900755183631-Customize-the-toolbar),
  [Reorder pages](https://support.goodnotes.com/hc/en-us/articles/7353718659343-Reordering-pages-in-a-document),
  [Merging pages and notebooks](https://support.goodnotes.com/hc/en-us/articles/7353712020879-Merging-Pages-and-Notebooks-Together),
  [How to use GoodNotes 6](https://brandenbodendorfer.com/how-to-use-goodnotes-6/) — abstracts.
- PDF Expert: [review 2026](https://thebusinessdive.com/pdf-expert-review),
  [Tools tab on Mac](https://support.readdle.com/pdfexpert/en_US/tips-and-tricks/getting-started-with-tools-tab-on-mac),
  [Edit text](https://support.readdle.com/pdfexpert/en_US/edit-pdfs/edit-text-in-pdf-files),
  [Remove sensitive content](https://support.readdle.com/pdfexpert/en_US/edit-pdfs/remove-sensitive-content),
  [Merge PDFs](https://support.readdle.com/pdfexpert/en_US/managing-files-and-folders/merge-pdfs),
  [Sign on iPhone and iPad](https://pdfexpert.com/ios/how-to-sign-pdf),
  [Read on iPhone](https://pdfexpert.com/ios/how-to-view-pdf) — abstracts.
- Acrobat: [Learn the new Acrobat](https://helpx.adobe.com/acrobat/learn-new-acrobat.html),
  [toolbar customisation thread](https://community.adobe.com/questions-9/questions-about-new-acrobat-toggle-and-toolbar-customization-1629467),
  [Hide All tools pane thread](https://community.adobe.com/questions-9/hide-all-tools-pane-1283288),
  [NC Bar: the new interface](https://www.ncbar.org/2023/09/19/adobe-acrobat-has-a-new-interface/),
  [Add comments](https://helpx.adobe.com/acrobat/desktop/share-and-review-documents/review-documents/add-comments.html),
  [Fill and sign, new experience](https://helpx.adobe.com/acrobat/using/fill-and-sign-new-experience.html),
  [Engadget: Acrobat Studio](https://www.engadget.com/ai/acrobat-studio-is-adobes-new-ai-powered-hub-for-pdfs-130003264.html) — abstracts.
- Browsers: [9to5Google: Chrome PDF annotation](https://9to5google.com/2026/02/19/chrome-split-view-pdf/),
  [MacRumors: Chrome 145](https://www.macrumors.com/2026/02/19/chrome-split-view-pdf-annotations/),
  [MC1072406: Edge's Adobe-engine viewer](https://mc.merill.net/message/MC1072406),
  [Mozilla: Firefox's PDF viewer](https://support.mozilla.org/en-US/kb/view-pdf-files-firefox-or-choose-another-viewer) — abstracts.
- Figma: [Our approach to designing UI3](https://www.figma.com/blog/our-approach-to-designing-ui3/),
  [Behind our redesign](https://www.figma.com/blog/behind-our-redesign-ui3/),
  [Making the move to UI3](https://www.figma.com/blog/making-the-move-to-ui3-a-guide-to-figmas-next-chapter/) — abstracts.
- Procreate: [Gestures](https://help.procreate.com/procreate/handbook/interface-gestures/gestures),
  [Undo and redo](https://help.procreate.com/articles/tvicQm-undo-and-redo) — abstracts.
- Reading apps: [TidBITS: Books in iOS 16](https://tidbits.com/2022/10/03/apples-books-ios-16/),
  [Apple: read books on iPhone](https://support.apple.com/guide/iphone/iphc1af7c57/ios),
  [The eBook Reader: Kindle page view](https://blog.the-ebook-reader.com/2025/06/26/amazon-changing-page-view-on-kindles-to-look-more-like-kindle-apps/) — abstracts.
- Expensive feel: [Latenode: Arc](https://latenode.com/blog/arc-browser),
  [Linear changelog: UI refresh](https://linear.app/changelog/2026-03-12-ui-refresh),
  [Linear: a calmer interface](https://linear.app/now/behind-the-latest-design-refresh),
  [Raycast: Action Panel](https://manual.raycast.com/action-panel),
  [Things 3 review (Medium)](https://medium.com/gear-grit/things-3-for-ios-apple-watch-and-mac-57e8202893ad),
  [MacStories: Craft review](https://www.macstories.net/reviews/craft-review-a-powerful-native-notes-and-collaboration-app/) — abstracts.

Earlier Recto research cited: `docs/research/02-market-and-ux.md` §5 and
`docs/research/13-glass-and-modes.md` §1, §5–§6.
