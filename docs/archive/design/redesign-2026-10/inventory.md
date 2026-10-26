---
title: Component inventory (M9 redesign baseline)
date: 2026-10-04
status: snapshot
---

> **How this was gathered.** By reading the source of `apps/web/src` at commit `7d47031`
> (`develop`, 2026-10-04): 117 component files (`.tsx`, tests excluded), 79 CSS modules
> (12,360 lines), `styles/tokens.css` and `styles/global.css`, the command registrations, the
> 30 end-to-end specs in `apps/web/e2e` and the 9 demo scenes in `tools/media/scenes`. The app
> was not run for this track. Four phone-width frames written by the screenshot track
> (`baseline/01-home-empty-390.png`, `03-read-390.png`, `04-edit-write-390.png`,
> `12-arrange-390.png`) and `04-edit-write-1440.png` were looked at to check estimates made
> from CSS widths; every other touch and narrow-screen statement is read from media queries
> and pointer handlers, not observed. Claims that depend on how a browser behaves (long press,
> native drag, double tap) rest on established knowledge and are marked so. No web sources
> were needed, so none were blocked.

# Component inventory

## 0. Verdict

- **168 user-facing components in 14 families** (§2). The largest are dialogs and sheets (27),
  contextual bars, menus and popovers (21) and page overlays (21). There are 29 modal or
  side dialogs in all (27 in §12 plus the command palette and the shortcut overlay),
  13 menus with 4 submenus, 4 contextual bars and 15 registered page overlays.
- **Glass today is a thin layer on a dark, opaque frame.** 16 surfaces compose the tier-1
  `.glass` rule (tool bar, options tier, 4 contextual bars, palette, crop banner, Compare's
  bar and progress card, 6 page-anchored notices and headers); every menu and 4 popovers use
  the denser tier-3 menu glass. The title bar, navigator, inspector, status bar, Home, its
  cards, all 27 dialogs, tooltips and both toasts are opaque. The "Glass panels" trial
  (default off) only swaps the docked frame for a glass that equals `--surface-1` over the
  canvas.
- **There is no phone or tablet layout.** The CSS has 7 `max-width` rules in 6 files and 4
  `hover: none` rules; no rule moves or hides the navigator, the inspector or the title bar
  actions. At 390 px the navigator (64 px rail plus a 248 px panel, open by default) leaves
  about 78 px for the page, the tab strip shows one letter, the mode switch is cut to "Re",
  and the Write row runs past the right edge (`baseline/03-read-390.png`,
  `04-edit-write-390.png`). All three Playwright projects are desktop devices; no spec runs
  below 1024 px.
- **Targets are desktop-sized.** Chrome controls are 28 px (`--control-height`), status bar
  controls 22 px, a tab's close button 20 px, the light table's hover actions 20 px, mode
  segments 24 px high; only the floating bar's buttons reach 36 px. Apple's and Google's
  touch minimums are 44 pt and 48 dp (established knowledge).
- **The keyboard model is thorough where it exists** (F6 regions, roving tab stops, APG
  tabs, listbox, grid and tree patterns, an Esc ladder), with five gaps: page text cannot be
  selected from the keyboard, annotations, stamps and signatures cannot be placed from it
  (form fields can), the status bar is outside the F6 cycle, the Arrange cell actions are
  pointer-only by design, and the command palette does not take the arguments DESIGN.md §2
  promises ("rotate 3-5 90", "go 42" are not implemented).
- **Feedback is mostly spoken, not shown.** Opened, skipped and failed files, deletions with
  their undo key, mode changes and armed tools go to visually hidden live regions. The only
  visible toasts are "Combined N files · Undo" and "Update available". There is no visible
  Undo or Redo control in the chrome.
- **The biggest structural debts** are listed with ids in §16 (INV-1 to INV-24); the flows
  they cause are in [`current-flows.md`](current-flows.md).

## 1. Method and labels

A **component** here is a surface or control a person sees or operates: a bar, a panel, a
menu, a dialog, a page overlay, a reusable control. Store modules, workers and pure
helpers are left out. Each table row gives:

- **Files**: paths under `apps/web/src/` unless another root is given.
- **Shows, when**: content and the condition that mounts it.
- **Surface**: `G1` the floating glass (`.glass`: 66 % tint, `blur(28px) saturate(1.8)
  brightness(0.45)`, `--elevation-float`); `G3` the menu glass (`.glass .glass-menu`: 80 %
  tint, `blur(32px) saturate(1.6) brightness(0.5)`); `Fr` the docked frame (`.glass-frame`:
  opaque `--surface-1`, tier-2 glass only with the Glass panels trial on); `O` opaque; `Page`
  drawn on the page in page colours. Every glass surface turns solid under
  `prefers-reduced-transparency`, `prefers-contrast: more`, forced colours and the in-app
  Reduce transparency switch.
- **Keyboard**: how a keyboard user reaches and operates it.
- **Touch / narrow**: what the CSS and pointer code do for `hover: none`, touch pointers or
  narrow viewports. "No rule" means the desktop layout is used unchanged.
- **Debts**: problems found in the code, with a §16 id where they recur.

Counts per family are in §2; a component is counted once, in the family that owns it, and
cross-referenced elsewhere.

## 2. Families at a glance

| # | Family | Components | Surface today | Main files |
|---|---|---|---|---|
| 3 | App frame (title bar, stage header, status bar, layout) | 15 | Fr, O | `shell/AppShell.tsx`, `shell/TabBar.tsx`, `shell/Stage.tsx`, `shell/StatusBar.tsx` |
| 4 | Home and library | 5 | O | `home/HomeView.tsx`, `shell/EmptyState.tsx` |
| 5 | Navigator and its panels | 14 | Fr | `shell/LeftRail.tsx` and its panels |
| 6 | Inspector | 7 | Fr | `shell/RightPanel.tsx` |
| 7 | Tool bar, tools, options tier, pen presets, ink palette | 16 | G1, G3 | `shell/FloatingToolbar*.ts(x)`, `annotations/pen/PenBar.tsx`, `annotations/StyleControls.tsx` |
| 8 | Contextual bars, menus, popovers | 21 | G1, G3, one O | `annotations/AnnotationBar.tsx`, `ui/Menu.module.css`, `ui/Popover.module.css` |
| 9 | Canvas and page overlays | 21 | Page, G1 notices | `stage/ReadView.tsx`, 15 overlays via `stage/page-overlays.tsx` |
| 10 | Arrange light table | 6 | O, G1 bar | `stage/ArrangeView.tsx`, `stage/ArrangeSection.tsx`, `stage/PageCell.tsx` |
| 11 | Compare | 9 | O, G1 bar | `compare/CompareView.tsx` |
| 12 | Dialogs and sheets | 27 | O | `stage/OperationDialogs.tsx`, `export/ExportDialog.tsx`, … |
| 13 | Command palette and shortcut overlay | 2 | G1, O | `shell/CommandPalette.tsx`, `shell/ShortcutOverlay.tsx` |
| 14 | Feedback (live regions, toasts, progress, notices, drag states) | 8 | O | `shell/LiveRegion.tsx`, `home/CombinedToast.tsx`, `pwa/UpdateToast.tsx` |
| 15 | Settings, appearance, privacy, brand | 6 | Fr, G3 | `privacy/PrivacyIndicator.tsx`, `tools/DocumentMenu.tsx`, `apps/web/about/` |
| 15.2 | Primitives (`ui/` and global classes) | 11 | mixed | `ui/*.tsx`, `styles/global.css` |
| | **Total** | **168** | | |

## 3. App frame (15)

The shell is a 3 × 3 CSS grid: title bar (40 px), navigator · stage · inspector, status bar
(28 px). In Read and Edit the page canvas runs under the docked frame ("full bleed",
`stage/stage-bleed.ts`), which stacks above it.

| # | Component | Files | Shows, when | Surface | Keyboard | Touch / narrow | Debts |
|---|---|---|---|---|---|---|---|
| 3.1 | App shell | `shell/AppShell.tsx`, `AppShell.module.css` | Grid, window-wide file drop (Home with new cards when 2+ files arrive on an empty app), appearance flags on the root, the global shortcut listener | O (`--surface-0`) | F6 / Shift+F6 cycle title bar → navigator → stage → tool bar → inspector (`LeftRail.regions.ts`) | No breakpoint; rail column always 64 px; no `env(safe-area-inset-*)`, no `viewport-fit`, no `visualViewport` handling (virtual keyboard) | Status bar is not an F6 region (INV-14); no phone layout (INV-1) |
| 3.2 | Home button (app glyph) | `shell/AppGlyph.tsx` | Placeholder page-with-fold glyph in a 64 px column over the rail; shows Home; `aria-current` on Home | Fr | Tab; `0` | 28 px target; tooltip "Home" never shows on touch | Placeholder brand (INV-22); with the Files tab's "Show Home" the only pointer route to Home, and unlabelled |
| 3.3 | Document tab | `shell/TabBar.tsx` | One per open document: tag dot, title (112–220 px), signature glyph, close × (hover, focus or selected); none selected on Home | Fr (selected: `--surface-2` with hairline) | APG tabs: Left/Right activate, Home/End, Delete closes, F2 renames; middle click closes; × hidden from assistive tech | `hover: none` shows × always (20 px); at 390 px about one letter of the strip is visible (`03-read-390.png`); context menu needs a right click or a long press (browser behaviour) | Tabs cannot be reordered (no model operation), yet tab order sets Home order and the default merge order (INV-19); no unsaved marker (INV-7) |
| 3.4 | Tab rename field | `stage/InlineTitleEditor.tsx` | In place of the tab (double click, F2) and in the Arrange section header | O | Enter commits, Esc cancels | Double tap may zoom or not fire `dblclick` (browser behaviour) | Rename is only by double click, F2 or the tab menu |
| 3.5 | Open files (+) | `shell/TabBar.tsx` | Icon button after the tabs | Fr | Tab; Mod+O | 28 px; no visible name on touch | Icon only |
| 3.6 | Command search field | `shell/TabBar.tsx` | "Search commands… Ctrl K"; opens the palette; label hidden ≤ 760 px | Fr (`--surface-0` well) | Mod+K | ≤ 760 px icon plus keycaps only; keycaps shown on touch devices | Looks like document search but searches commands; Find is elsewhere (INV-11) |
| 3.7 | Document menu trigger | `tools/DocumentMenu.tsx` | "Document" with icon; only once a file is open | Fr | Tab, Enter; menu keys (§8) | 28 px | Hidden on an empty app, so Batch (which needs no open file) is reachable only from the palette |
| 3.8 | Export button | `shell/TabBar.tsx` | Download icon; opens the export dialog | Fr | Mod+S | 28 px, icon only | The only "save" in the app is this dialog (INV-7) |
| 3.9 | Inspector toggle | `shell/TabBar.tsx` | Panel icon; `aria-pressed` | Fr | Mod+Alt+B | 28 px, icon only | Hides History, the only visible undo list (INV-4) |
| 3.10 | Mode switch | `shell/Stage.tsx` (`ModeSwitch`) | Read (lock glyph) · Edit · Arrange, plus Compare only while a comparison is open; centred in a 48 px stage header, not on Home | O (`--surface-1`, on: `--surface-3`) | APG radio group; `1` `2` `3` `4`; the checked segment does nothing | 72 px minimum segments: cut to "Re" at 390 px with the navigator open (`03-read-390.png`) | Two axes in one control (lock and view, INV-2); Compare segment appears and disappears |
| 3.11 | Layout switch | `viewer/LayoutSwitch.tsx` | Continuous · Single · Two-up icons, right of the mode switch, Read and Edit only | O | Radio group arrows | 28 × 24 px; overlaps the mode switch at 390 px | DESIGN.md §2 places layout and fit in the title bar; they are in the stage header and the status bar (INV-21) |
| 3.12 | Stage drop overlay | `shell/Stage.tsx` | Dashed accent frame and "Drop to open" over the page view while files are dragged | O on scrim | n/a | n/a (no file drag on phones) | Arrange and Compare draw their own targets |
| 3.13 | Scroll proxies | `stage/ScrollProxies.tsx` | Native scroll bars at the edges of the unobscured rectangle (the real viewport hides its own) | O | Decorative; the viewport keeps keyboard scrolling | Pointer only | Two scroll bars to keep in step |
| 3.14 | Status bar | `shell/StatusBar.tsx` | Left: "Page 3 of 12" (labels), search count, selection summary, "Opening N", OCR progress, signature badge, privacy indicator. Right: zoom. Home: "N files" | Fr | Tab only (not F6) | Truncates with `overflow: clip`; "No external" cut at 390 px | Mixes status, navigation (zoom) and settings (privacy) |
| 3.15 | Zoom controls | `shell/StatusBar.tsx` | − · "94 %" menu (Fit width, Fit page, 50–200 %) · + | Fr; menu G3 | Mod+= / Mod+- / Mod+0 | 22 px buttons | In Arrange they change the hidden Read zoom; thumbnail size has no control (Mod+wheel or the palette only) (INV-21) |

## 4. Home and library (5)

Home is a view, not a mode: the open files as cards in tab order, or the empty state.

| # | Component | Files | Shows, when | Surface | Keyboard | Touch / narrow | Debts |
|---|---|---|---|---|---|---|---|
| 4.1 | Home header | `home/HomeView.tsx` | "3 files · 18 pages", "2 selected"; buttons Open files, Arrange pages, Compare (exactly 2 selected), Close (any selected), primary **Combine N files** (2+ files) | O | Tab row before the grid | No rule; buttons wrap | Five buttons appear and vanish with the selection; "Combine" here keeps the sources, "Merge" elsewhere replaces them (INV-12) |
| 4.2 | Home card | `home/HomeView.tsx` | 192 px card: first-page thumbnail (160 × 200), tag dot, name (middle-truncated), "6 pages · 6.1 KB", modified date; dropping one card on another shows "Combine with …" | O (`--surface-2`) | Multi-select listbox: arrows, Shift+arrows, Space, Mod+A, Enter opens in Read, Esc clears | A tap selects one card; Shift/Mod are the only multi-select, so phones cannot pick two (INV-10); opening needs a double click or Enter; card-on-card drop is HTML5 drag and drop (unreliable on phones, browser behaviour) | Double click to open is a desktop gesture |
| 4.3 | Empty state card | `shell/EmptyState.tsx` | Glyph, "Drop PDFs to start", two sentences, three hint rows: Open files (Ctrl O), Search commands (Ctrl K), Keyboard shortcuts (?) | O | Tab through hint buttons | Fills the stage beside the 64 px rail, whose four tabs show although nothing is open (`01-home-empty-390.png`); "Drop" and keycaps mean nothing on a phone | No sample file, no feature preview, no language control (INV-20) |
| 4.4 | Recents section | `home/HomeView.tsx` | "Recent" heading, "Clear recents", up to 12 rows; notes when a file must be picked again or a clear failed | O | Rows: Up/Down/Home/End, Enter, Delete, Right to the ⋯ | `hover: none` shows ⋯ | Only names, sizes and handles are kept: reopening opens the original file, not the edited state (INV-7) |
| 4.5 | Recent row | `home/HomeView.tsx` | Generic page glyph, name, "3 pages · 6.1 KB · 5 minutes ago", italic hint "Needs permission" or "Open again…"; ⋯ menu "Remove from recents" | O | As 4.4 | Without the File System Access API (Firefox, Safari, mobile browsers: established knowledge) every row means "pick the file again" | A permission prompt or a file dialog on most reopens |

## 5. Navigator and its panels (14)

A 64 px rail with four labelled tabs (Pages, Find, Review, Files; Changes in Compare) and a
resizable panel, 200–420 px, 248 px by default, **open by default**. Choosing the open tab
again collapses it. On Home only Files is offered; with no file open the panel stays
collapsed but the rail shows.

| # | Component | Files | Shows, when | Surface | Keyboard | Touch / narrow | Debts |
|---|---|---|---|---|---|---|---|
| 5.1 | Rail | `shell/LeftRail.tsx` | Icon, 11 px label, count badge (pages, matches, review items, files; "99+") | Fr | Vertical tablist: Up/Down/Home/End, Enter; Tab goes into the panel; Mod+B toggles | 56 px tabs; no rule; shown with nothing open | Shown on the empty app with four tabs that have nothing to show |
| 5.2 | Rail footer: shortcuts | `shell/LeftRail.tsx` | Keyboard icon at the rail's foot; opens the shortcut overlay | Fr | `?` | Shown on touch devices | Keyboard help is a permanent rail item |
| 5.3 | Panel frame | `shell/LeftRail.tsx`, `ui/ResizeHandle.tsx` | Panel title, body, splitter | Fr | Splitter: Left/Right 16 px, Home/End | 248 px panel plus rail = 312 px of a 390 px screen (INV-1) | Opens by default and in Arrange too, where Pages repeats the light table (`12-arrange-390.png`) |
| 5.4 | Pages · Bookmarks switch | `shell/panels/PagesTab.tsx`, `panels/RadioChips.tsx` | Two chips; remembered | Fr | Radio group arrows | No rule | The outline is one level down |
| 5.5 | Thumbnail list | `shell/PagesPanel.tsx` | Virtualized thumbnails at 60 % of the panel width, label with tag dot, current page ring | Fr; sheets Page | Listbox: Up/Down/Home/End, Shift extends, Space toggles; click selects and scrolls | Tap selects and scrolls | Thumbnails cannot be dragged to reorder (Preview's main gesture) (INV-9); a selected thumbnail turns Shift+R into "rotate page" and Delete into "delete page", also in Read (INV-3) |
| 5.6 | Bookmarks tree | `shell/OutlinePanel.tsx`, `outline/OutlineMenu.tsx`, `outline/OutlineRenameField.tsx` | Outline tree; "Add bookmark"; rename in place; drag to move; dead-link warning; external links ask first | Fr | APG tree; F2, Delete, Alt+arrows move/indent; context menu Shift+F10 lists every edit with its key | Drag uses pragmatic drag and drop (native, browser behaviour) | Editing is hidden behind keys and the context menu |
| 5.7 | Find panel | `shell/SearchPanel.tsx`, `viewer/search.ts` | Field with Match case and Whole word toggles; hint line before a query; "3 of 41", previous/next; results grouped by page | Fr | Mod+F focuses; Enter / Shift+Enter, F3 / Shift+F3; Esc clears and closes | Panel width leaves ~78 px of page at 390 px | Second tab of a panel, while the title bar's search field searches commands (INV-11); a scan says "No results" with no word about OCR (INV-11) |
| 5.8 | Mark all matches | `redaction/MarkMatchesButton.tsx` | "Mark all N matches for redaction" under the Find field, Edit only | Fr | Tab | No rule | A redaction action inside Find |
| 5.9 | Review list | `shell/review/ReviewPanel.tsx` | Filter chips All · Comments · Marks · Fields with counts (only kinds present); rows grouped by page; virtualized | Fr | Chips radio group; rows Tab/Enter; J/K in Marks | No rule | One tab for three different jobs |
| 5.10 | Comment rows and author prompt | `shell/CommentsPanel.tsx`, `shell/comment-author.ts` | Kind, author, date, text; the author name asked once, inline, above the first comment | Fr | Enter selects the annotation (Edit) or shows it (Read) | No rule | A pen burst is one row (fixed in M8) |
| 5.11 | Mark rows and Marks header | `shell/panels/RedactionsPanel.tsx` | One-line honesty with "Why?", "Find sensitive data" (a review list of matches, "Mark N selected"), mark rows with tick, reveal, delete; "Apply redactions" | Fr | J/K review; Tab | `hover: none` shows delete | Apply lives here and in the tool bar's Redact group |
| 5.12 | Field rows and Fields toolbar | `shell/FormsPanel.tsx` | Type icon, name, value, required marker; Highlight fields, Clear all, Flatten on export, Edit fields, Add field (menu) | Fr | Enter opens the field's editor | No rule | "Flatten on export" set here is read by the export dialog, a second place for one option |
| 5.13 | Files list | `shell/files/FilesList.tsx`, `files/FileRow.tsx` | Rows: checkbox (Home's selection), tag, name, "12 pages · 2.8 MB", close; "Combine N files"; "Show Home" | Fr | Rows and checkboxes by Tab | `hover: none` shows checkbox and close | The only touch path to selecting several files (INV-10); repeats Home and the tabs |
| 5.14 | Changes panel | `compare/ChangesPanel.tsx` | Compare only, last tab: summary, honesty lines, two exports, rows per change with + − ~ glyphs | Fr | J/K steps; rows Enter | No rule | Appears and disappears with the view; entering Compare forces the navigator open on it (`compare/compare-commands.ts`) |

## 6. Inspector (7)

Closed by default; opened only by its toggle (Mod+Alt+B) or a status-bar badge; 240–440 px.

| # | Component | Files | Shows, when | Surface | Keyboard | Touch / narrow | Debts |
|---|---|---|---|---|---|---|---|
| 6.1 | Inspector frame | `shell/RightPanel.tsx` | Scrolling stack of sections with a splitter | Fr | F6 region when open | 280 px default; no rule | (INV-13) |
| 6.2 | Selection | `shell/RightPanel.tsx` | "4 pages from 2 documents", labels; or "N annotations" | Fr | Read-only | — | Repeats the status bar's selection summary |
| 6.3 | Properties | `annotations/AnnotationProperties.tsx` | The selection's style controls plus kind, author, dates, comment; with nothing selected and a tool armed, that tool's style | Fr | Tab | — | Repeats the options tier and the contextual bar (INV-13) |
| 6.4 | OCR | `ocr/OcrSection.tsx` | Page quality (Good, Review, Poor, No text), languages, dpi, low-confidence words; recognised pages by quality | Fr | J/K words | — | The OCR dialog's "Show results" opens the inspector here; any other way out leaves the results in a closed panel |
| 6.5 | Signatures | `signatures/SignaturesSection.tsx` | Per signature: status (never "valid"), honesty line, signer, time, revisions, certificates, checks; "View signed version" | Fr | Tab | — | Reached through the status bar badge or the toggle only |
| 6.6 | History | `shell/RightPanel.tsx` | Every history entry with time; click jumps | Fr | Buttons | — | The only visible undo list, hidden by default (INV-4) |
| 6.7 | Info | `shell/RightPanel.tsx` (`DocumentFacts`) | Name, files, size, pages, modified, honesty badges with tooltips; "Document info…" | Fr | Tab | Badge explanations are tooltips, absent on touch | Repeats the Document info sheet |

## 7. Tool bar, tools, options tier, pen presets, ink palette (16)

A capsule, 44 px high, 20 px above the stage's bottom edge, centred. Read shows one Edit
button; Edit shows five groups; a group morphs the capsule into its tools (160 ms); the armed
tool pressed again opens the options tier above it. Arrange and Compare do not show it.

| # | Component | Files | Shows, when | Surface | Keyboard | Touch / narrow | Debts |
|---|---|---|---|---|---|---|---|
| 7.1 | Read dock | `shell/FloatingToolbar.tsx` (`ReadDock`) | One "Edit" button (pencil and label) | G1 | F6 reaches it; `2` | Label kept ≤ 640 px; floats off-centre at 390 px (`03-read-390.png`) | Read offers nothing else here (INV-2) |
| 7.2 | Group row | `FloatingToolbar.tsx`, `FloatingToolbar.groups.ts` | Select · Write · Text · Fill & sign · Redact; Select pressed while idle | G1 | One Tab stop (last group), arrows, Enter; V | Labels hidden ≤ 640 px (icons only, names kept for assistive tech) | Five labels to learn before any tool (INV-5) |
| 7.3 | Group chip and morph | `FloatingToolbar.tsx` (`useBarMorph`) | The picked group as a chip "‹ Write" at the left; tools slide in; chip returns to the row | G1 | Esc ladder: disarm, then back to the row | No rule | Changing group costs chip + group + tool (INV-5) |
| 7.4 | Tool button | `FloatingToolbar.tsx` (`ToolButton`), `annotations/tools.ts` | 36 px round icon: Eraser, Lasso, Edit text, Text box, Note, Image, Signature image, Mark for redaction; armed = accent fill; tooltip "· Esc: Select" | G1 | Roving arrows; tool keys (Shift+E, Q, E, T, N, I, G, X) | 36 px; tooltips absent on touch, so icon meaning is unlabelled | Two image tools in two groups: "Image" (I, edit existing, Text group) and "Stamp or image" (Shift+I, add, Fill & sign) |
| 7.5 | Pen preset well | `annotations/pen/PenBar.tsx` | Three pen dots (10/13/16 px by width) and the Highlighter capsule in one well; armed = 2 px accent ring | G1 | Radiogroup: arrows, Enter arms, Enter on armed opens editor; P, H | 32 px cells; the Write row is about 350 px wide and its options tier about 510 px at 1440 (`04-edit-write-1440.png`); the row is clipped at 390 px | — |
| 7.6 | Pen preset editor | `PenBar.tsx` | Popover from the dot: 8 inks or 4 tints, custom colour, width stops and 0.25–24 pt slider, opacity, Reset; pressure honesty line | G3 | Esc closes only the editor | No rule | Editing a preset needs "tap the armed one again", an invisible gesture |
| 7.7 | Shapes menu button | `FloatingToolbar.tsx` (`ShapesMenu`) | Last shape's icon with a corner chevron; menu Rectangle R, Ellipse O, Line L, Arrow A | G1; menu G3 | Enter opens; letters arm | No rule | — |
| 7.8 | Stamp menu button | `FloatingToolbar.tsx` (`StampMenu`) | "Stamp or image": Image…, Draft, Approved, Confidential | G1; menu G3 | Enter opens | No rule | Signature image (7.4) and Sign with certificate (7.10) sit beside it: three "sign"-like things in one group |
| 7.9 | Add field menu button | `FloatingToolbar.tsx` (`FieldsMenu`) | Text, Checkbox, Radio, Dropdown, List box, Signature, Button | G1; menu G3 | Enter; placing then works by keyboard | No rule | Also in the Fields filter (5.12) |
| 7.10 | Command buttons | `FloatingToolbar.tsx` (`CommandButton`) | Highlight fields (toggle), Sign with certificate…, Find sensitive data, Mark search matches (disabled until a search has hits) | G1 | Roving | No rule | "Highlight fields" collides with the Highlight markup and the Highlighter (INV-15) |
| 7.11 | Apply redactions button | `FloatingToolbar.tsx` | Shield icon; opens the Marks filter and the apply dialog | G1 | Roving | No rule | Two places to apply (here and 5.11) |
| 7.12 | Options tier | `FloatingToolbar.tsx` (`Tier`), `annotations/StyleControls.tsx` | Second capsule above the bar: the armed tool's colour, opacity, width or font size; opens only when the armed tool is pressed again | G1 | Tab from the bar; roving | Scrolls horizontally when too wide | Options exist in three places: tier, contextual bar, Properties (INV-13); the "press again" rule is invisible |
| 7.13 | Eraser tier | `PenBar.tsx` (`EraserTier`) | Whole stroke / Partial; four sizes | G1 | Radio groups | No rule | — |
| 7.14 | Style controls | `annotations/StyleControls.tsx`, `annotations/palette.ts` | 14 px swatches in 24 px targets (8 inks or 4 tints), custom colour ring, opacity, width, font size, comment, delete | inherits | Roving within the bar | 24 px targets | — |
| 7.15 | Stroke fade | `shell/FloatingToolbar.stroke.ts` | While drawing and 1 s after, bar and tier fade to 20 % and let the pointer through | G1 | n/a | Helps palms; the bar still sits where a right-handed writer's hand rests (bottom centre) | — |
| 7.16 | Pen and eraser cursors | `annotations/pen/ink-input.ts`, `annotations/pen/eraser.ts` | Dot of the preset's colour at its on-screen width (3–32 px); hollow eraser ring (6–48 px) | Page | n/a | No cursor on touch | — |

## 8. Contextual bars, menus, popovers (21)

| # | Component | Files | Shows, when | Surface | Keyboard | Touch / narrow | Debts |
|---|---|---|---|---|---|---|---|
| 8.1 | Annotation bar (and lasso variant) | `annotations/AnnotationBar.tsx`, `annotations/lasso/LassoSelection.tsx` | Above an explicit selection: name ("Ink", "3 strokes, 1 arrow"), style controls, comment, move grip (lasso), delete | G1 | One Tab stop, arrows, Esc deselects | Positioned within the page; no rule | Edit only |
| 8.2 | Image bar | `image-objects/ImageBar.tsx` | Replace…, Extract, Delete, size readout (pt, px, dpi) | G1 | One Tab stop, arrows | No rule | Reached only through the Image tool (I) |
| 8.3 | Text selection bar | `annotations/ReadSelectionBar.tsx` | Read: Copy, Edit text, Mark up…. Edit with Select: Highlight, Underline, Strikeout, Squiggly, Comment | G1 | Reachable by Tab after a selection; but page text cannot be selected from the keyboard (INV-16) | Shows after pointer up; on touch the browser's own selection callout also appears (browser behaviour) | "Comment" makes a separate note, not a comment on the highlight (INV-17); "Mark up…" (annotate) vs "Mark" (redact) |
| 8.4 | Arrange contextual bar | `stage/ContextualBar.tsx` | "N selected": rotate left/right, delete, duplicate, move to new document, insert blank, Move to… (menu), properties | G1 | One Tab stop, arrows | No move-left/right buttons, so no touch reorder without drag | — |
| 8.5 | Document menu | `tools/DocumentMenu.tsx` | Sections: Combine and split (Merge files…, Split…, Compare with…, Rotate pages ▸) · Add to pages (Page numbers…, Header and footer…, Bates…, Watermark…, "Remove …" when present) · Protect and sign (Set password…, Remove password…, Sign with certificate…, Strip metadata…) · Convert and export (Export…, Export as images…, Export as Markdown / text…, Recognize text (OCR)…, Compress…, Batch…) · Document (Document info…, Add bookmark, Remove dead links, Save repaired copy, Appearance ▸, About this app) | G3 | Menu keys; every item is also a palette command | 240 px min; long list on a phone | 20+ items mixing jobs, settings and help; OCR sits under "Convert and export" (INV-11); "Rotate pages" turns every page when none is selected |
| 8.6 | Zoom menu | `shell/StatusBar.tsx` | Fit width (key), Fit page, 50–200 % | G3 | Menu keys | Opens upward | — |
| 8.7 | Shapes menu | `shell/FloatingToolbar.tsx` | See 7.7 | G3 | Menu keys | — | — |
| 8.8 | Stamp menu | `shell/FloatingToolbar.tsx` | See 7.8 | G3 | Menu keys | — | — |
| 8.9 | Add field menu (bar and Fields filter) | `FloatingToolbar.tsx`, `shell/FormsPanel.tsx` | Seven field kinds | G3 | Menu keys | — | Same menu twice |
| 8.10 | Page context menu | `stage/PageContextMenu.tsx` | Edit: Edit text here (E), Rotate page N left/right, Delete page N, Crop…, Arrange. Read: one row "Switch to Edit to change pages" (lock, `2`) and Arrange | G3 | Shift+F10 or Menu key with focus in the pages | Needs `contextmenu` on long press: Android Chrome fires it, iOS Safari does not (browser behaviour) | The Read row is a dead end that costs a second right click (INV-2) |
| 8.11 | Arrange context menu | `stage/ArrangeContextMenu.tsx` | The bar's actions plus Copy to new document, Cut/Copy/Paste, select all from this source, odd/even, reverse order; Move to ▸ | G3 | Shift+F10 | Base UI ContextMenu (long press support depends on the browser) | — |
| 8.12 | Section menu | `stage/ArrangeSection.tsx`, `stage/SectionMenuEntries.tsx` | ⋯ on a section header: Reverse, Interleave…, Split…, Merge into ▸, Insert images…, Resize…, Crop…, Rename, Close; disabled items say why | G3 | Menu keys | — | Same entries as 8.13 |
| 8.13 | Tab context menu | `stage/TabArrangeMenu.tsx` | Hide from / Show in Arrange plus the section operations | G3 | Shift+F10 on a tab | Long press (browser behaviour) | Arrange visibility is controlled from the tab bar |
| 8.14 | Outline item menu | `outline/OutlineMenu.tsx` | Every bookmark edit with its keycaps | G3 | Shift+F10 | — | — |
| 8.15 | Recents ⋯ menu | `home/HomeView.tsx` | Remove from recents | G3 | Right arrow from the row | `hover: none` shows the ⋯ | — |
| 8.16 | Move to… menu | `stage/ContextualBar.tsx` | Other open documents | G3 | Menu keys | — | — |
| 8.17 | Privacy popover | `privacy/PrivacyIndicator.tsx` | Observed external URLs (expected none), CSP in one sentence and `connect-src`, offline status, version (opens About), Recents line with Clear | G3 | Enter on the indicator | `min(360px, 100vw − 16px)` | A trust feature hidden behind 12 px status text |
| 8.18 | Link popover | `viewer/LinkLayer.tsx` | "Open link" confirmation naming the URL | G3 | Enter on the hotspot | — | Links live only with Select |
| 8.19 | Paragraph editor info popover | `text-edit/ParagraphEditor.tsx` | What the editor keeps and changes | G3 | Tab | — | — |
| 8.20 | Field properties popover | `forms/create/FieldProperties.tsx` | Name, tooltip, required, options, tab order of a created field | O | Enter on the selected field | — | The one opaque popover |
| 8.21 | Tooltip | `ui/Tooltip.tsx` | Label and keycaps after hover or focus | O | Focus shows it; Esc closes without eating the key | Never on touch: every icon-only button is unnamed there (INV-6) | — |

## 9. Canvas and page overlays (21)

The page view is one virtualized scroll container (`stage/ReadView.tsx`); each page hosts the
registered overlays in this order: text layer, search highlights, links, text edit,
paragraph editor, crop, annotations, dry ink, text selection bar, redaction, furniture,
image, OCR, form, created fields.

| # | Component | Files | Shows, when | Surface | Keyboard | Touch / narrow | Debts |
|---|---|---|---|---|---|---|---|
| 9.1 | Read view | `stage/ReadView.tsx`, `stage/stage-bleed.ts` | Continuous, single or two-up; fit width by default; zoom anchored under the pointer; Space pans | Page on `--surface-0` | Focusable viewport; PageUp/Down, Space, Home/End, `[` `]`, Mod+G | Pinch is handled for two touch pointers, but the viewport keeps `touch-action: auto`, so Android Chrome may pinch-zoom the whole page instead (browser behaviour, to verify); Safari gesture events are handled | Fit width at 390 px with the navigator open draws the page at 25 % (`03-read-390.png`) |
| 9.2 | Page canvas and tiles | `pages/PageCanvas.tsx`, `pages/TiledPage.tsx` | Bitmap at exact device scale; tiles above 16 MP | Page (hairline, no shadow) | Canvas decorative; page is a region with its text | — | — |
| 9.3 | Text layer | `viewer/TextLayer.tsx` | Transparent spans for selection, copy, find and assistive tech | Page | No keyboard text selection (INV-16) | Native long-press selection (browser behaviour) | — |
| 9.4 | Hover outline and "Double-click to edit text" hint | `viewer/TextLayer.tsx` | Edit with Select or Edit text: after 400 ms idle hover, a 1 px run outline; once per device a small hint | Page outline; hint G1 | n/a | Never from touch | A hint is needed because a single click does not edit (INV-2) |
| 9.5 | Search highlights | `viewer/SearchHighlights.tsx` | Accent fill per hit; current hit stronger and outlined | Page | Follows Find | — | — |
| 9.6 | Link hotspots | `viewer/LinkLayer.tsx` | Internal links scroll; external ask first (8.18) | Page | Focusable hotspots | Live only with Select | — |
| 9.7 | Annotation layer | `annotations/AnnotationLayer.tsx`, `annotations/geometry.ts` | Hit targets, selection with handles, creation feedback; inert in Read | Page | Selection by Review row or Tab; Delete; arrows | `touch-action: none` on the layer; creating with a finger works before a pen is seen | Annotations cannot be created from the keyboard (INV-16) |
| 9.8 | Ink preview and dry ink | `annotations/pen/ink-preview.ts`, `annotations/pen/DryInkLayer.tsx` | Live stroke canvas; committed strokes until the bitmap shows them | Page | n/a | Finger draws until a pen is seen, then pans; with a finger there is no one-finger scroll while a drawing tool is armed, and two fingers only zoom (INV-8) | — |
| 9.9 | Lasso selection | `annotations/lasso/LassoSelection.tsx` | Traced paths, dashed box, eight 8 px handles with 24 px hit areas, rotation grip | Page | The box is focusable: arrows move, Shift+arrows resize, Alt+arrows rotate | 24 px hit areas | — |
| 9.10 | Text box editor | `annotations/InlineEditors.tsx` | Auto-growing box in page white and ink | Page | Esc or Mod+Enter commits | Virtual keyboard may cover it (no `visualViewport` handling) | — |
| 9.11 | Note popup | `annotations/InlineEditors.tsx` | 240 px popup; saves on Esc and press outside; Cancel discards | G1 frame, page-white field | Esc saves | Flips near edges; no keyboard-overlap handling | — |
| 9.12 | Redaction marks | `redaction/RedactionLayer.tsx` | Translucent red areas with red outline; dashed when left out; strong outline under review | Page | J/K from Marks | With X a finger drag marks text or an area | — |
| 9.13 | Form widgets and field editors | `forms/FormLayer.tsx`, `forms/FieldEditors.tsx` | Hit targets; in-place input, textarea, select sized to the widget | Page | Tab between fields; Enter, Esc, Tab commit | Editor is the widget's size at the current zoom (small at fit width on a phone) | — |
| 9.14 | "Switch to Edit to fill" notice | `forms/FormLayer.tsx` | In Read, a click on a fillable field shows one line and an Edit button under it | G1 | Tab from the field reaches Edit | — | Every first fill costs a detour (INV-2) |
| 9.15 | Created fields layer | `forms/create/CreatedFieldLayer.tsx` | Fields drawn like their export; place by click or drag; Edit fields: select, drag, handles, Mod+D | Page | Full keyboard placement (Enter/Space, arrows) | `touch-action: none` | The only object kind placeable by keyboard |
| 9.16 | Image layer | `image-objects/ImageLayer.tsx` | Image tool: hover outline, selection box, eight handles | Page | Arrows nudge, Mod+arrows resize, Delete | `touch-action: none` | — |
| 9.17 | Text edit targets, line editor and header | `text-edit/TextEditLayer.tsx`, `text-edit/TextEditor.tsx` | Edit text: run targets (hatched when not editable), paragraph targets for the keyboard; line editor with a header (font, honesty badge, fit choice) | Page; header G1 | Tab between paragraphs, Enter opens, Esc returns | A tap opens until a pen is seen, then a long press | — |
| 9.18 | Paragraph editor | `text-edit/ParagraphEditor.tsx` | Glyph canvas over the paragraph, hidden mirror textbox, header beside the paragraph (honesty, spacing, overflow choices) | Page; header G1 | Full text editing keys; Esc commits | `touch-action: none` on the canvas; header falls back to above the bar | — |
| 9.19 | Crop layer and draw banner | `crop/CropLayer.tsx`, `crop/CropDrawBanner.tsx` | While "Draw crop area" is on: rectangle drag; banner with Cancel | Page; banner G1 | Esc cancels | `touch-action: none` | — |
| 9.20 | Furniture preview | `furniture/FurnitureLayer.tsx` | Page numbers, headers, Bates, watermark drawn as SVG, live while a dialog is open | Page | n/a | Side dialog covers the preview below 432 px (INV-1) | — |
| 9.21 | OCR word ring | `ocr/OcrLayer.tsx` | 1 px accent ring on the focused OCR word | Page | J/K | — | — |

## 10. Arrange light table (6)

| # | Component | Files | Shows, when | Surface | Keyboard | Touch / narrow | Debts |
|---|---|---|---|---|---|---|---|
| 10.1 | Arrange view | `stage/ArrangeView.tsx` | Every open document as a section (unless hidden); marquee with edge auto-scroll; Mod+wheel changes cell size | O | Grid: arrows across rows and sections, Shift extends, Space, Home/End, Enter opens in Read, Alt+arrows move, Alt+Shift+arrows to edges, Mod+X/C/V, R, Delete, Mod+D, Mod+A | Marquee ignores touch; tap selects one; no multi-select on touch (INV-10) | Cell size has no visible control (INV-21) |
| 10.2 | Section header | `stage/ArrangeSection.tsx` | Sticky: title (double click renames), page count, tags, honesty badges, collapse, ⋯ menu | O | Tab; F2 | — | — |
| 10.3 | Page cell | `stage/PageCell.tsx` | Thumbnail, label, tag; hover actions rotate and delete in the label gutter | O; sheet Page | Grid cell; actions are pointer-only by design (R, Delete instead) | Hover actions shown only with `hover: hover`, so absent on touch | 20 px hover actions |
| 10.4 | Drag preview | `dnd/page-drag.ts` | First thumbnail, stacked sheets and a count, 0.96 scale, 0.9 opacity | O | Keyboard moves instead (Alt+arrows, cut/paste) | Native HTML5 drag (pragmatic drag and drop): long-press drag support varies by mobile browser (browser behaviour); untested | — |
| 10.5 | Drop gap and file drop zone | `dnd/drop.ts`, `dnd/geometry.ts`, `dnd/dnd.module.css` | Insertion gap between cells; OS files insert at the gap | O | n/a | As 10.4 | — |
| 10.6 | Marquee | `stage/ArrangeView.tsx` | Accent rectangle; additive with Shift or Mod | O | n/a | Disabled for touch pointers | — |

The Arrange contextual bar (8.4) and context menu (8.11) are counted in §8.

## 11. Compare (9)

| # | Component | Files | Shows, when | Surface | Keyboard | Touch / narrow | Debts |
|---|---|---|---|---|---|---|---|
| 11.1 | Setup card | `compare/CompareView.tsx` | "Compare two documents": Original (A), Revised (B) selects or "Open file…"/drop, matching (auto, page by page, best match), 100/150 dpi | O | Tab, selects | ≤ 640 px presets in one column | Entered by `4`, Home's Compare (2 selected) or Document menu → Compare with… |
| 11.2 | Progress card | `compare/CompareView.tsx` | Phases (text, thumbnails, align, visual, text diff, facts) with Cancel | G1 | Tab | — | — |
| 11.3 | Paired rows | `compare/CompareView.tsx` | A │ B per page-map row, synced scroll and zoom | O; pages Page | Shell zoom keys | Two columns at phone width | — |
| 11.4 | Overlay (onion skin) | `compare/CompareView.tsx` | B over A with an opacity slider | Page | Slider | — | — |
| 11.5 | Compare bar | `compare/CompareView.tsx` | Layout (side by side, overlay), opacity, heat map, previous/next, zoom | G1 | J/K, Esc leaves | No rule | A second floating bar with its own vocabulary |
| 11.6 | Heat map | `compare/CompareView.tsx` | Pixel-difference heat map over B | Page | Toggle | — | — |
| 11.7 | Change marks | `compare/CompareView.tsx` | Changed areas outlined, changed words marked, current change stronger | Page | J/K | — | — |
| 11.8 | Page map strip | `compare/CompareView.tsx` | ~ − = + buttons per row | O | Buttons | — | — |
| 11.9 | Stale notice | `compare/CompareView.tsx` | "A compared document changed" with Run again | O | Tab | — | — |

## 12. Dialogs and sheets (27)

Every dialog is a Base UI dialog with a focus trap, Esc and focus return, styled on the
shortcut overlay's popup: `min(760px, 100vw − 32px)` wide, centred, opaque `--surface-1`, a
scrim at 56 %. Side dialogs dock right at `min(400px, 100vw − 32px)` (OCR 420 px) with no scrim so the
page shows the preview. None has a phone layout beyond three width rules (Compress presets
in two columns ≤ 640 px, the Markdown preview in one column ≤ 760 px, Batch panes stacked
≤ 720 px).

| # | Dialog | Files | Opened from | Kind | Notes and debts |
|---|---|---|---|---|---|
| 12.1 | Export | `export/ExportDialog.tsx`, `document/ExportSections.tsx`, `signatures/ExportSignatureSection.tsx`, `tools/CompressionExportRow.tsx` | Title bar Export, Mod+S, Document menu | Centred, 480 px; form → progress → verification summary → Save/Download (second click for the save picker) | Seven sections (Output, Security, Annotations, Forms, Compression, Metadata, Signature); Compression shows only an empty heading until a preset is applied in 12.20 (INV-18) |
| 12.2 | Document info sheet | `document/DocumentDialogs.tsx`, `MetadataEditor.tsx`, `SecurityInfo.tsx`, `Diagnostics.tsx` | Document menu, Info section, palette | Side sheet | Facts, badges, metadata fields, passwords, diagnostics on demand |
| 12.3 | Set password | `document/DocumentDialogs.tsx` | Document menu, info sheet, export | Centred | Nested in export when opened from it |
| 12.4 | Remove password | `document/DocumentDialogs.tsx` | Same | Centred | Shown only when there is a password |
| 12.5 | Strip metadata | `document/DocumentDialogs.tsx` | Document menu | Centred | — |
| 12.6 | Sign with certificate | `signatures/SignDialog.tsx` | Document menu, Fill & sign bar, export checkbox | Centred | .p12/.pfx, password, reason, visible signature; continues into export |
| 12.7 | Signature (image) | `annotations/SignatureDialog.tsx` | Signature image tool (G) | Centred, 520 px | Draw / Type / Image tabs; 440 × 160 pad; kept for the session only, not across reloads |
| 12.8 | Apply redactions | `redaction/ApplyRedactionsDialog.tsx` | Marks header, Redact bar | Centred; cannot close while running | Confirmation → self-check → result sheet |
| 12.9 | Page numbers | `furniture/FurnitureDialogs.tsx` | Document menu | Side, no scrim | Live preview on pages; covers the page below 432 px |
| 12.10 | Header and footer | `furniture/FurnitureDialogs.tsx` | Document menu | Side | Same |
| 12.11 | Bates numbering | `furniture/FurnitureDialogs.tsx` | Document menu | Side | Same |
| 12.12 | Watermark | `furniture/FurnitureDialogs.tsx` | Document menu | Side | Same |
| 12.13 | Combine / Merge all | `stage/OperationDialogs.tsx` (`MergeAllDialog`) | Home or Files "Combine N files" (keeps sources), Document menu "Merge files…" and palette "Merge all open documents…" (replace sources) | Centred, wide | One dialog, two outcomes by entry point (INV-12) |
| 12.14 | Merge into… | `stage/OperationDialogs.tsx` | Section and tab menus | Centred | — |
| 12.15 | Split… | `stage/OperationDialogs.tsx` | Document menu, section menu | Centred | Every N pages, ranges, by outline, selection; inline errors |
| 12.16 | Interleave… | `stage/OperationDialogs.tsx` | Section menu, palette | Centred | — |
| 12.17 | Resize pages… | `stage/ResizeDialog.tsx` | Section menu, palette | Centred | Preset or custom size, Scale/Fit/Canvas, 3 × 3 anchor, preview |
| 12.18 | Crop pages… | `crop/CropDialog.tsx` | Page menu (Edit), section menu, Document menu | Centred | Margins, preview with handles, Draw crop area, optional content removal through redaction |
| 12.19 | Insert images: size | `stage/OperationDialogs.tsx` | Section menu → Insert images | Centred | — |
| 12.20 | Compress | `tools/CompressDialog.tsx` | Document menu | Centred | Analysis, presets with estimate, run, before/after table and compare view; "Apply to export" or "Download copy" |
| 12.21 | Export as images | `tools/ImageExportDialog.tsx` | Document menu | Centred | Format, dpi, quality, background, range, name template |
| 12.22 | Export as Markdown / text | `convert/ConvertDialog.tsx` | Document menu | Centred; one column ≤ 760 px | Preview of 40 lines; no Copy button (the demo scene notes it) |
| 12.23 | Recognize text (OCR) and Manage languages | `ocr/OcrDialog.tsx`, `ocr/OcrLanguages.tsx` | Document menu, status bar progress | Side | Pages, languages, quality; runs in the background; the language manager is the app's only settings screen |
| 12.24 | Batch and recipe editor | `batch/BatchDialog.tsx`, `batch/RecipeEditor.tsx`, `batch/StepForm.tsx` | Document menu (with a file open), palette | Centred, two panes (one ≤ 720 px) | Recipes, files, plan, run, ZIP or folder |
| 12.25 | Password prompt | `shell/PasswordDialog.tsx` | Opening an encrypted file | Centred | Skip leaves the file closed; the skip is only announced (INV-6) |
| 12.26 | Go to page | `viewer/GoToPageDialog.tsx` | Mod+G, palette | Centred | Accepts numbers and labels |
| 12.27 | About | `shell/about/AboutDialog.tsx` | Palette, privacy popover version | Centred | Version, build, licence, storage use, offline status |

## 13. Command palette and shortcut overlay (2)

| # | Component | Files | Shows, when | Surface | Keyboard | Touch / narrow | Debts |
|---|---|---|---|---|---|---|---|
| 13.1 | Command palette | `shell/CommandPalette.tsx`, `commands/fuzzy.ts`, `commands/registry.ts` | About 151 commands (enabled ones listed) in groups, recents first, keycaps; matches EN and TR keywords without diacritics | G1 over the scrim | Mod+K; APG combobox; Up/Down, Enter, Esc | `min(600px, 100vw − 32px)`; triggered by the title bar field | No arguments ("go 42", "rotate 3-5 90" in DESIGN.md §2 are not implemented); the language switch lives only here |
| 13.2 | Shortcut overlay | `shell/ShortcutOverlay.tsx` | Every command grouped, with keycaps and the tool bar group of each tool; in-widget keys | O | `?` | Shown via the rail footer on touch devices too | — |

## 14. Feedback (8)

| # | Component | Files | Shows, when | Surface | Keyboard | Touch / narrow | Debts |
|---|---|---|---|---|---|---|---|
| 14.1 | Live regions | `shell/LiveRegion.tsx`, `shell/announcer.ts` | Polite and assertive, visually hidden: opened, skipped and failed files, closes, deletions with the undo key, mode changes, armed tools, group changes, burst summaries | hidden | — | — | Sighted users get none of it: a corrupt or skipped file shows nothing on screen (INV-6) |
| 14.2 | Combined toast | `home/CombinedToast.tsx` | "Combined 2 files · Undo" bottom left, 10 s unless hovered or focused | O | Tab into it | No rule | The only visible undo affordance besides History |
| 14.3 | Update toast | `pwa/UpdateToast.tsx` | "Update available" with Reload / Later | O | Tab | No rule | — |
| 14.4 | Status bar progress | `shell/StatusBar.tsx`, `ocr/OcrStatus.tsx` | "Opening N files", "Recognizing text: 3 of 12 pages" (click reopens the OCR dialog), search count | Fr | Tab | Truncated on phones | Long operations report in 12 px text |
| 14.5 | Signature status badge | `signatures/SignatureBadge.tsx` | Shield and status word; tab glyph; "export removes signatures" when edited | Fr | Tab | — | Opens the hidden inspector |
| 14.6 | Honesty notices | `styles/tokens.css` (`--warning-line`), Info badges, text-edit and paragraph headers, dialog notes | Warning hairline around text, no tint | varies | — | Badge explanations are tooltips (absent on touch) | — |
| 14.7 | Dialog progress and result screens | export, redaction, compress, OCR, batch, crop dialogs | Progress, verification summary, self-check lists, before/after | O | In dialog | — | Five different result layouts |
| 14.8 | Drag states | `shell/EmptyState.tsx`, `shell/Stage.tsx`, `dnd/` | "Release to open", dashed frames, drop-to-combine label | O | n/a | n/a on phones | — |

Panel empty states use `EmptyNote` (§15.2).

## 15. Settings, appearance, privacy, brand (6) and primitives (11)

### 15.1 Settings, appearance, privacy, brand (6)

The app has no settings screen. Settings are spread over a menu, the palette and inline
prompts.

| # | Component | Files | Shows, when | Surface | Keyboard | Touch / narrow | Debts |
|---|---|---|---|---|---|---|---|
| 15.1.1 | Appearance submenu | `tools/DocumentMenu.tsx`, `shell/appearance-commands.ts`, `viewer/edit-policy.ts` | Glass panels, Reduce transparency, Pen draws in Edit as 14 px check rows; also palette commands | G3 | Menu keys | Hidden until a file is open | Settings inside a document menu (INV-20) |
| 15.1.2 | Privacy indicator | `privacy/PrivacyIndicator.tsx` | "● Local only · No external requests" in the status bar; popover 8.17 | Fr | Tab | 22 px | The product's main promise is 12 px status text |
| 15.1.3 | Language switch | `i18n/language-commands.ts`, `i18n/locale.ts` | Palette commands "English", "Türkçe"; `?lang=`; browser language by default | — | Palette | — | No visible control (INV-20) |
| 15.1.4 | Comment author | `shell/CommentsPanel.tsx`, `shell/comment-author.ts` | Asked inline once; "Set comment author name…" in the palette | Fr | Tab | — | — |
| 15.1.5 | About page | `apps/web/about/index.html`, `about.css` (4 media queries) | Static page at `/recto/about/`: thesis, "Three things you can check", Arrange, Redact, Recognise and compare, Sign and export, How it works | own styles | Links | Has its own responsive rules | Separate visual language from the app |
| 15.1.6 | Brand glyph and icons | `shell/AppGlyph.tsx`, `public/icons/glyph.svg`, `public/icons/app-icon.svg` | Placeholder page-with-fold; theme colour `#181a1f` | — | — | — | Wordmark and final icon open (DESIGN.md §6) (INV-22) |

### 15.2 Primitives (11)

The Tooltip is counted once, as 8.21.

| # | Primitive | Files | Use and notes |
|---|---|---|---|
| 15.2.1 | IconButton | `ui/IconButton.tsx` | 28 px square (36 px "toolbar"), icon 16/20 px, tooltip; never changes its box on hover |
| 15.2.2 | Keycaps | `ui/Keycaps.tsx` | 18 px caps, three tones; decorative (controls carry `aria-keyshortcuts`); shown on touch devices too |
| 15.2.3 | Range | `ui/Range.tsx` | 2 px track, 12 px thumb (14 px hover), native under forced colours |
| 15.2.4 | ResizeHandle | `ui/ResizeHandle.tsx` | APG window splitter, 16 px steps, `touch-action: none` |
| 15.2.5 | RadioChips | `shell/panels/RadioChips.tsx` | Chips with radio semantics (Review filters, Pages · Bookmarks) |
| 15.2.6 | EmptyNote | `shell/EmptyNote.tsx` | Two quiet lines inside panels |
| 15.2.7 | Menu surface | `ui/Menu.module.css` | G3 popup, items, check, separators, keycaps, rise-in 4 px over 120 ms |
| 15.2.8 | Popover surface | `ui/Popover.module.css` | G3 popup |
| 15.2.9 | Primary and secondary buttons | `styles/global.css` (`.primary-button`), module `.secondary` classes | Accent fill / hairline outline; 12 CSS modules re-declare their own `.secondary` |
| 15.2.10 | Glass classes | `styles/global.css` (`.glass`, `.glass-menu`, `.glass-frame`), `styles/tokens.css` | Three tiers with solid fallbacks; filters never animate; no glass in glass |
| 15.2.11 | Focus ring | `styles/global.css`, DESIGN.md §5 | 2 px accent, 2 px offset; DESIGN.md §5 documents nine offset cases, the CSS has 65 `outline-offset` declarations |

Motion today: one curve `cubic-bezier(0.2, 0, 0, 1)`, durations 60/120/180 ms, a 160 ms bar
morph through the Web Animations API, 4 px rise-ins, 0.98 scale for dialogs and tooltips,
no springs (DESIGN.md §3 forbids them in the chrome).

## 16. Cross-cutting debts

| Id | Debt | Where | Evidence |
|---|---|---|---|
| INV-1 | No phone or tablet layout: the navigator (312 px with the rail) opens by default, title bar actions keep ~278 px, the mode switch has 72 px segments, side dialogs take `100vw − 32px` | `ui-store.ts` (`leftPanelOpen: true`), `TabBar.module.css`, `Stage.module.css`, `FurnitureDialogs.module.css`, `Ocr.module.css` | `baseline/03-read-390.png`, `04-edit-write-390.png`, `12-arrange-390.png`; 7 width rules in 6 files |
| INV-2 | Read is a lock that every change must pass: a click on a field, a right click on a page and a pen on the page in Read all lead to a "Switch to Edit" step; tool keys switch silently | `forms/FormLayer.tsx`, `stage/PageContextMenu.tsx`, `annotations/commands.ts` | `e2e/modes.spec.ts` |
| INV-3 | The lock does not cover page structure, and keys change meaning with the selection: with a thumbnail selected in the navigator, Shift+R rotates and Delete deletes that page, also in Read, while R arms the Rectangle (annotation commands register before `pages.rotateRight`); in Arrange R rotates | `commands/app-commands.ts` (no `canEdit` in `pages.*`; `registerAnnotationCommands` at line 366) | From code; not verified in the running app |
| INV-4 | No visible Undo or Redo; History is in the inspector, closed by default | `shell/RightPanel.tsx`, no undo control in any bar | Grep finds no undo button outside `CombinedToast` |
| INV-5 | Tools sit three levels deep: Edit → group → tool, and options need a second press; changing group costs chip + group + tool | `shell/FloatingToolbar.tsx` | `e2e/annotations.spec.ts` (stamp after eraser: 5 actions) |
| INV-6 | Feedback is spoken, not shown (failures, skips, deletions, mode changes); tooltips never show on touch, so icon-only buttons are unnamed there | `shell/LiveRegion.tsx`, `commands/app-commands.ts` (`openDocuments`), `ui/Tooltip.tsx` | — |
| INV-7 | Work is lost silently: no session persistence, no `beforeunload` guard, no unsaved marker; Mod+W in a browser tab closes the whole app; the only save is the export dialog | `state/*` (only recents and recipes use IndexedDB), `commands/app-commands.ts` (`cmd_close_tab_note`) | — |
| INV-8 | Writing on touch: a stylus in Read selects text; with a finger and a drawing tool armed there is no one-finger scroll and two fingers only zoom | `annotations/pen/ink-input.ts` (`pointerRole`), `stage/ReadView.tsx` | `e2e/pen.spec.ts` covers pen and finger through CDP only |
| INV-9 | Page operations are scattered: Arrange (bar, cell hover, context menu, keys), page context menu (Edit only), Document menu (Rotate pages ▸ applies to all pages when none is selected), navigator thumbnails (no drag) | `stage/*`, `tools/DocumentMenu.tsx`, `shell/PagesPanel.tsx` | — |
| INV-10 | Multi-select needs Shift/Mod or a marquee; touch has neither (marquee ignores touch); drags are native HTML5 | `home/home-model.ts` (`clickSelection`), `stage/ArrangeView.tsx`, `dnd/page-drag.ts` | No touch device project in `playwright.config.ts` |
| INV-11 | Find is a navigator tab while the title bar search field searches commands; a scan gives "No results" with no pointer to OCR, which is under Document → Convert and export | `shell/TabBar.tsx`, `shell/SearchPanel.tsx`, `tools/DocumentMenu.tsx` | Demo scene 03 reaches Find sensitive data through the palette |
| INV-12 | "Combine" and "Merge": three names, two outcomes from one dialog (Home/Files keep sources; Document menu and palette replace them) | `stage/OperationDialogs.tsx` (`combining = given !== undefined`) | — |
| INV-13 | Options and facts repeated: options tier, contextual bar and Properties; Selection repeats the status bar; Info repeats the Document info sheet | `shell/RightPanel.tsx`, `annotations/AnnotationProperties.tsx` | — |
| INV-14 | Status bar not in the F6 cycle | `shell/LeftRail.regions.ts` | — |
| INV-15 | Overloaded words: Edit (mode, Edit text, Edit fields, Edit text here), Mark (Mark up…, Mark for redaction, Marks, Mark search matches), Highlight (Highlighter, Highlight markup, Highlight fields), Image (Image tool, Stamp or image, Signature image) | `messages/en.json` | — |
| INV-16 | Keyboard gaps: no keyboard text selection; annotations, stamps and signature images cannot be placed from the keyboard | `viewer/TextLayer.tsx`, `annotations/AnnotationLayer.tsx` | DESIGN.md §4 principle 1 says every action has a keyboard path |
| INV-17 | Highlight and comment are separate objects: the selection bar's Comment adds a note at the line end; after Highlight the selection is cleared | `annotations/ReadSelectionBar.tsx`, `annotations/selection-markup.ts` | — |
| INV-18 | Export form shows a Compression heading with nothing under it until a preset is applied in another dialog | `export/ExportDialog.tsx`, `tools/CompressionExportRow.tsx` | — |
| INV-19 | Tabs cannot be reordered, yet tab order drives Home order and the default merge order | `state/workspace-store.ts` (no reorder) | — |
| INV-20 | No settings surface: appearance in the Document menu (hidden with no file), language in the palette, author inline, OCR languages inside the OCR dialog; the empty state has no language or sample | `tools/DocumentMenu.tsx`, `i18n/language-commands.ts` | — |
| INV-21 | View controls in the wrong place for the view: zoom ± in Arrange change the Read zoom; Arrange cell size has no control; layout in the stage header, fit in the zoom menu, Find in the navigator, while DESIGN.md §2 says the title bar | `shell/StatusBar.tsx`, `state/ui-store.ts` (`zoomIn`) | — |
| INV-22 | Brand is a placeholder glyph; the about page has its own visual language | `shell/AppGlyph.tsx`, `apps/web/about/` | DESIGN.md §6 |
| INV-23 | No install prompt, file handler or share target, so a phone cannot "open with" or share a PDF into Recto | `vite.config.ts`, `pwa/register.ts` | Grep finds no `beforeinstallprompt`, `launchQueue` or `share_target` |
| INV-24 | Desktop-sized targets: 20–28 px for most chrome, 36 px in the bar | `styles/tokens.css` (`--control-height: 28px`) | §0 |

## 17. What the inventory implies for the redesign

Each item names a measurable target so the design specs can cite it.

- **INV-R1** One shell, three widths: phone (< 600 px: no docked panels; navigator,
  inspector and the Document menu become sheets from the bottom), tablet (600–1024 px: one
  docked panel at most) and desktop (> 1024 px: today's frame). Answers INV-1.
- **INV-R2** Touch targets of at least 44 × 44 px on phones and tablets for every control
  in §3, §5 and §7 (the visible shape may stay smaller; the hit area may not). Answers
  INV-24.
- **INV-R3** A visible Undo and Redo pair on every width, with the last action named in a
  visible toast for destructive steps ("Deleted page 3 · Undo"), the same toast that carries
  failures today only announced. Answers INV-4 and INV-6.
- **INV-R4** One lock rule that covers page structure too, or no lock: page operations,
  annotations and form fills follow the same gate. Answers INV-2 and INV-3.
- **INV-R5** Tool access in at most two presses from the page (one to show a tool's group,
  one to arm), and options visible on arming instead of on a second press. Answers INV-5.
- **INV-R6** One name per job across Home, menus, palette and dialogs (Combine everywhere,
  one outcome: a new document; replacing sources is a separate, named choice). Answers
  INV-12 and INV-15.
- **INV-R7** Session restore (open files and history, stored on this device) and an unsaved
  marker on tabs, with a `beforeunload` guard while there are unexported changes. Answers
  INV-7.
- **INV-R8** Multi-select on touch: a Select mode with checkmarks on Home cards and Arrange
  cells, and move-left / move-right in the Arrange bar. Answers INV-10.

## Sources

All sources are files of this repository at commit `7d47031`
(https://github.com/ErenDenizK/pdf-editor). No web sources were used.

- `apps/web/src/shell/*.tsx`, `shell/**/*.tsx` and their CSS modules: read in full
  (AppShell, TabBar, StatusBar, LeftRail, LeftRail.regions, Stage, FloatingToolbar and its
  `.groups`, `.slots` modules, RightPanel, PagesPanel, PagesTab, SearchPanel, EmptyState,
  EmptyNote, CommandPalette head, LiveRegion); headers and handlers read for ReviewPanel,
  CommentsPanel, FormsPanel, RedactionsPanel, FilesList, FileRow, OutlinePanel,
  ShortcutOverlay, PasswordDialog, AboutDialog.
- `apps/web/src/home/HomeView.tsx`, `home-actions.ts`, `home-model.ts` (`clickSelection`),
  `CombinedToast.tsx`: read in full or in the cited part.
- `apps/web/src/styles/tokens.css`, `global.css`: read in full.
- `apps/web/src/commands/app-commands.ts`, `use-shortcuts.ts`, `registry.ts`; every
  `register(` site in `src/`: read in the cited parts.
- `apps/web/src/annotations/tools.ts`, `commands.ts`, `AnnotationBar.tsx` (head),
  `SignatureDialog.tsx`, `selection-markup.ts` (cited lines), `pen/ink-input.ts` (head);
  module headers of every other `.tsx` under `annotations/`, `stage/`, `viewer/`, `pages/`,
  `forms/`, `signatures/`, `redaction/`, `text-edit/`, `compare/`, `crop/`, `furniture/`,
  `ocr/`, `batch/`, `tools/`, `document/`, `export/`, `convert/`, `privacy/`, `pwa/`,
  `outline/`, `image-objects/`, `ui/`: read.
- `apps/web/src/tools/DocumentMenu.tsx`: read in full. `export/ExportDialog.tsx`: read in
  the cited parts. `stage/OperationDialogs.tsx`: read in the cited parts.
- `apps/web/src/state/ui-store.ts`, `state/workspace-store.ts`, `viewer/tool-store.ts`:
  read in the cited parts.
- All `@media` rules and `touch-action` declarations in `apps/web/src/**/*.css`: listed by
  search and read.
- `apps/web/e2e/*.spec.ts`: test lists of all 30 specs; flows read in `home`, `modes`,
  `annotations`, `tools`, `export`, `signatures`, `redaction`, `ocr`, `compare`,
  `furniture`, `viewer`; `helpers.ts` read in full; `playwright.config.ts` projects read.
- `tools/media/scenes/*.ts`: headers of all 9 scenes; actions of 00, 03, 04, 05, 06 read.
- `apps/web/messages/en.json`: searched for the strings cited.
- `apps/web/about/index.html`: headings read.
- `docs/DESIGN.md`: read in full. `docs/design/experience-audit-2026-10.md`: §1–§2 read.
- `docs/design/redesign-2026-10/baseline/01-home-empty-390.png`, `03-read-390.png`,
  `04-edit-write-390.png`, `12-arrange-390.png`, `04-edit-write-1440.png` (screenshot
  track): viewed.
