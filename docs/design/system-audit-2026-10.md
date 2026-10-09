# Visual system audit (2026-10-09): one system for every surface

**Status:** proposal for the owner and the lead · **Applies to:** both editions, every surface ·
**Reads with:** `redesign-2026-10/language.md`, `redesign-2026-10/quality-bar.md` (Q-1…Q-14),
`redesign-2026-10/components/09-primitives.md`, `components/07-sheets.md`, `components/10-ink.md`
· **Screenshots:** `system-audit-2026-10/` (this audit, production build of `develop` at
`7697f56`, Chromium, 1440 × 900 fine and 1180 × 820 touch, dark and light; the phone at
390 × 844) and the owner's annotated iPad captures of 2026-10-08/09

The owner's priority is that the visual design system settles first. The system *is* mostly
specified (language.md, Q-9, G1), and the floating chrome (top strip, capsule, page pill) already
follows it closely. What breaks the "one Apple-grade system" feeling is everything around that
core: the token file says one scale while modules use another, a dozen surfaces still use the
pre-M9 dialog recipe, the Library and the ink strip invent their own sizes, three different
"armed" and two different "selected" looks coexist, and the light theme loses the lime that every
focus and selection signal relies on.

This file has four parts: the system as it is (§1), every inconsistency found (§2), a proposed
final system (§3) and a work breakdown by lane (§4). §0 maps the owner's annotations to the
findings.

---

## 0. What the owner marked, and where it lands

From the nine annotated iPad screenshots (in translation where Turkish):

| Owner's note | Seen on | Finding | Fixed by |
|---|---|---|---|
| "Better UI" on the source-group headers; "buggy" check disc; "better selection / highlight" | Pages grid, All open | I-31, I-32, I-33 | §3.8, lane *pages* |
| "This is very thick, twice too much" (the scope segmented and size slider band) | Pages grid | Since fixed by the corner pieces (G1); the pieces are now right. The grid content itself still floats top-left at small size (I-34) | lane *pages* |
| "Is it fixed or floating, piece by piece?" (top strip) | Reader | Resolved: floating pieces (F1). The pieces are the most consistent part of the app today | — |
| "Two rows maybe separable"; "different solution"; "empty and ugly"; "glass hover slider?"; slider "bug" | Ink strip over the palette | I-21…I-25 | §3.7, lane *ink* |
| "Inconsistent", "too big?", "repeat?", "moves to the new one" (recents repeating the pen colours) | Ink strip, palette | I-21, I-22, I-23 | lane *ink* |
| "Glass feels thick because of light"; "more bg = better glass" | Library, palette | I-41, I-42 | §3.5, lane *platform* |
| "Some pop-ups don't fit"; dock "almost the same" as the panel | Privacy popover | I-27, I-28 | §3.6, lane *frame* |
| "Repetitive" (Library pill + Library title + logo); "better branding"; "maybe too big"; "inconsistent sizes and not properly arranged"; "bug on different ratios"; "missing / more alive aura" | Library | I-35…I-39 | §3.9, lane *library* |
| "Animation!!"; "aura? test? option" | Reader top | Out of scope for the visual system (motion and the reader glow); noted under lane *viewer* | — |
| "Improve overall design" (top-right piece: Save, undo/redo) | Reader | I-03, I-04 | lane *frame* |

---

## 1. The system as it is

### 1.1 Type

One family, `'Inter Recto'` with a metric-matched fallback (`styles/fonts.css`). Weights 400 ·
500 · 600 only (Q-8). The scale (`tokens.css` §3, coarse in §4):

| Token | Fine | Coarse | Used for (as specified) | Var uses in CSS |
|---|---|---|---|---|
| `--type-caption` | 11/14 | 12/16 | badges, counts, keycaps | 14 (+38 via alias `--text-xs`) |
| `--type-footnote` | 12/16 | 13/18 | secondary lines, section labels | 85 (+137 via `--text-sm`) |
| `--type-body` | 13/18 | 15/20 | rows, menus, buttons | 21 (+37 via `--text-md`) |
| `--type-callout` | 15/20 | 17/22 | sheet body, empty states | 10 (+4 via `--text-lg`) |
| `--type-title3` | 17/22 | 19/24 | panel and sheet titles | 1 |
| `--type-title2` | 22/28 | 24/30 | dialog titles, Library section heads | 0 |
| `--type-title1` | 28/36 | 30/38 | Library greeting | 1 |
| `--type-display` / `-lg` | 40/44, 56/60 | same | Library title, About | 1 |

Tracking per step (dark tracks +0.005 em more at ≤ 13 px). The M8 aliases (`--text-xs/sm/md/lg`,
`--leading-tight/base`, `--tracking-ui`, `--tracking-label`) are still the majority of uses.

### 1.2 Space

`--space-1…12`: 4, 8, 12, 16, 20, 24, 32, 48. language.md §6.2 specifies a 4 px grid with a 2 px
half-step (2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64); 2, 6, 40 and 64 have no token, so modules
write them as literals (`gap: 6px` alone appears in 20+ rules).

### 1.3 Radii

| Token | Value | Var uses |
|---|---|---|
| `--radius-page` | 2 | 28 |
| `--radius-xs` (`--radius-1`) | 4 | 4 + 37 |
| `--radius-sm` (`--radius-2`) | 6 | 4 + 59 |
| `--radius-md` (`--radius-3`) | 10 | 1 + 13 |
| `--radius-control` | 10 | 32 |
| `--radius-capsule` / `--radius-pill` / `--radius-round` | 999 | 8 + 44 + 32 |

What modules actually write as literals (§2.2): **8** (tooltip), **12** (settings groups,
thumbnails, find hits, review rows), **16** (menus, popovers, Library cards, note popups,
paragraph editor), **20** (sheets, launcher, overlay sidebar, recents, drop overlay), **28**
(bottom sheet). That is language.md §6.1's scale (sm 8, md 12, lg 16, xl 20, 2xl 28) — the
de-facto system — while `tokens.css` still carries the M8 6/10 and says "until the shape step".

### 1.4 Pieces and controls

| Token | Fine | Coarse | Notes |
|---|---|---|---|
| `--piece-h` (`--bar-h`) | 40 | 48 | every floating piece (G1) |
| `--piece-inset` | 16 | 16 | distance from the window edges |
| `--control-h` (`--bar-button`) | 32 | 44 | buttons, fields, segmented, menu rows |
| `--control-h-lg` | 36 | 52 | large buttons |
| `--control-height` | 28 | 28 | M8 row height, still read by 9 rules |
| `--chip-h` | 28 | 36 | chips |
| `--hit-min` | 24 | 44 | |
| `--check` | 16 | 20 | checkbox |
| `--switch-w/h` | 36/20 | 52/32 | |
| `--field-text` | 13 | 16 | iOS zoom guard |

Measured in the build (computed styles and boxes read from the DOM): top strip pieces 40/48 at x = y = 16,
dock 40/48 with 32/44 items, page pill 40/48, palette 40/48, segmented 32/44 with 28/40 segments,
fields 32/44 wells, menu rows 32/44, switch 36 × 20 / 52 × 32. The floating chrome is on the scale.

### 1.5 Icons

Phosphor regular + fill, generated (`ui/icons.generated.tsx`), `<Icon>` defaults to 16; tokens
`--icon-sm` 16 and `--icon-md` 20; Q-9 allows {16, 20} only (32 in empty states).

### 1.6 Materials and elevation

Five glass tiers plus lit (`--glass-{chip,bar,panel,menu,sheet,lit}-*`, `styles/materials.css`
generated from the coverage registry, σ per surface): M1 chip 0.50, M2 bar 0.55, M3 panel 0.74, M4
menu 0.78, M5 sheet 0.86 tint alpha in dark; light 0.70–0.88 with a `contrast(0.45)
brightness(1.4)` floor. Rims per tier, shadows e0–e5, Glass setting Clear · Tinted · Solid,
reduced transparency and more contrast fall back to solids.

### 1.7 Colour roles

- **Interaction:** one lime `#c8fb3d`; dark: lime fill with ink label; light: ink fill with lime
  label. `--accent-ring` (lime / lime-800) for the current thumbnail, selected card, drop lines.
- **Selection of whole pages and files:** `--select-ring` = `--accent-ring`, check badge lime
  with ink tick (G7).
- **Selection on the page:** `--select` `#4e61ed` and its washes.
- **Focus:** two bands, lime 2 + ink 2 (outset, inset, gap forms in `styles/focus.css`).
- **Status:** danger, warning, success (+ glass variants). Six tag colours.

### 1.8 Motion

Seven springs as `linear()` curves (`--spring-press 300`, `quick 420`, `smooth 530`, `glide 680`,
`fling 560`, `pop 410`, `track 150`), four eases, durations 60/120/180/280, press scales
0.97/0.94 (large 0.98/0.96), entrance 0.96 → 1 with a 4 px rise, sheet push 24 px; all zeroed
or shortened under reduced motion (`styles/motion.css`).

---

## 2. Every inconsistency found

Severity: **A** breaks the one-system feel at first glance; **B** visible on inspection; **C**
code hygiene that lets A and B come back. Screenshot names are files in
`system-audit-2026-10/`.

### 2.1 The token file disagrees with the code and the spec

| # | Sev | Where | Finding |
|---|---|---|---|
| I-01 | A | `styles/tokens.css` §3 radius block | Tokens say 6/10 (M8), language.md §6.1 says 8/12/16/20/28, modules hard-code 8/12/16/20/28 (40 literal radii, §2.2). Nothing names the menu, card, sheet or phone-sheet radius, so each module re-types it. |
| I-02 | B | `tokens.css` `--radius-md: 10` = `--radius-control: 10` | Two names, one value, two meanings (a container radius and the control radius). |
| I-03 | B | `tokens.css` `--control-height: 28px` | The M8 row height is still read by 9 rules beside `--control-h` 32; `--chip-h` 28/36 is a third control height. Q-9 allows {32, 44}. |
| I-04 | B | `tokens.css` `--control-h-lg` 36/52 vs `home/Launcher.module.css:156` and `home/LibraryFooter.module.css:9` | The Library redefines `--control-h-lg` / `--control-h` to `--piece-h`, so its buttons are 40/48 (measured: launcher buttons 36 on the empty state, 40 with documents, 52 / 48 on touch). A piece height is being used as a control height. |
| I-05 | C | aliases at the end of `tokens.css` §1 and §3 | Migration step 11 never ran: `--text-sm` (137 uses), `--radius-2` (59), `--radius-1` (37), `--radius-round` (32), `--text-xs` (38) outnumber their real names. Two vocabularies for one scale. |
| I-06 | C | `tokens.css` §3 | No tokens for 2, 6, 40, 64 spacing, for the icon box 12, for the toast, tooltip or popover heights, nor for the sheet's `--sheet-pad` / `--sheet-radius` (both private to `ui/sheet/Sheet.module.css:27-29`). |
| I-07 | B | language.md §6.2 vs G1 | The spec table still lists dock 48/56/64 and contextual bars 36 / 56; G1 and the code say 40/48. The doc is stale, so new work reads two answers. |

### 2.2 Hard-coded sizes (from a scan of all 148 CSS files, `materials.css` excluded)

Totals: 63 literal font sizes, 40 literal radii, 13 off-scale weights, 33 literal durations,
2 literal shadows, ~140 sizes and ~100 paddings/gaps off the 4 px grid (2 px half-steps counted as
on-grid).

**Literal font sizes** (outside the compact edition):

| File:line | Selector | Value | Should be |
|---|---|---|---|
| `ui/Menu.module.css:57` | `.popup` (coarse) | 15px | `--type-body` (already 15 coarse) |
| `ui/MenuButton.module.css:42` | `.button` | 15px | `--type-body` |
| `ui/Select.module.css:50` | `.trigger` | 15px | `--type-body` |
| `ui/sheet/Sheet.module.css:189, 212, 224` | `.title`, `.dialogTitle` | 17 / 19 / 22px | `--type-title3`, `--type-title2` |
| `ui/Slider.module.css:548` | `.bubble` | 13px | `--type-body` |
| `ui/colour/ColourPanel.module.css:104,111` | `.sizer` | 13 / 15px | `--type-body` |
| `ui/colour/ColourSliders.module.css:81,89,100` | `.hex`, `.error` | max(13px,…), 16px, 12px | `--field-text`, `--type-footnote` |
| `ui/Segmented.module.css:13,50,68`; `ui/Popover.module.css:19,49` | private `--seg-text`, `--pop-title` | 13 / 15 | `--type-body` |
| `markup/InkStrip.module.css:94` | `.readout` | 15px | `--type-body` |
| `shell/frame/CompactTopBar.module.css:96,113` | `.backCount`, `.title` | 15px | `--type-body` |
| `settings/Settings.module.css:326` | `.aboutName` | 17px | `--type-title3` |
| `stage/ArrangeView.module.css:466` | `.insertionBar[data-duplicate]::before` | 12px | `--type-footnote` |
| `privacy/PrivacyShield.module.css:64` | `.badge` | 11px | `--type-caption` |
| `batch/Batch.module.css:247` | `.code` | 11px | `--type-caption` |

**The compact edition has its own type system in rem** (`shell/compact/*.module.css`, 36
declarations: `0.9375rem` = 15, `0.8125rem` = 13, `1rem` = 16). It never reads `--type-*`, so a
change to the ramp skips the phone.

**Literal radii** (all should be tokens):

| Value | Where |
|---|---|
| 16 | `ui/Menu.module.css:43`, `ui/Popover.module.css:36`, `home/LibraryCard.module.css:19`, `annotations/AnnotationLayer.module.css:262` (note popup), `text-edit/ParagraphEditor.module.css:84`, `shell/compact/CompactChrome.module.css:62` |
| 20 | `ui/sheet/Sheet.module.css:27`, `home/Launcher.module.css:16`, `home/RecentList.module.css:13`, `home/DropOverlay.module.css:29`, `shell/sidebar/Sidebar.module.css:47` |
| 28 | `ui/sheet/Sheet.module.css:88` (bottom sheet) |
| 12 | `settings/Settings.module.css:76`, `shell/sidebar/ThumbnailList.module.css:46`, `shell/sidebar/FindSection.module.css:145,234`, `shell/review/ReviewPanel.module.css:82` |
| 10 | `ui/colour/ColourPanel.module.css:243`, `ui/colour/ColourSpectrum.module.css:12`, `ui/colour/ColourSliders.module.css:77` |
| 8 | `ui/Tooltip.module.css:19` |
| 11 | `dnd/dnd.module.css:49` (`.previewBadge`, off every scale) |
| 999 | `ui/Segmented.module.css:29,76,94`, `ui/ScrollArea.module.css:101`, `ui/Slider.module.css:276,543` |

**Off-scale weights:** 450 `ui/Notice.module.css:66`; 550 in `document/DocumentInfoSheet.module.css:22`,
`document/DocumentTools.module.css:81`, `shell/review/ReviewPanel.module.css:61,135`,
`annotations/AnnotationProperties.module.css:62`, `redaction/ApplySheet.module.css:30`,
`signatures/Signatures.module.css:25,133`, `ocr/Ocr.module.css:23`; 650
`pages-sheets/PagesSheets.module.css:166`. Q-8 rounds to 400/500/600; with a variable font these
render visibly heavier than their neighbours.

**Literal durations** (Q-10 says springs and eases only): `ui/ScrollArea.module.css:64` 120ms,
`ui/Progress.module.css:47` 200ms, `ui/Switch.module.css:141` 120ms, `ui/Checkbox.module.css:99`
and `ui/RadioGroup.module.css:91` 240ms, `ui/Slider.module.css:581` 100ms,
`ui/Toast/Toast.module.css:339` 200ms, `export/SaveCopySheet.module.css:77,214` 120ms,
`shell/frame/SaveButton.module.css:109` 1200ms, `settings/Settings.module.css:106` 1200ms,
`stage/ArrangeView.module.css:427` 120ms (loops — spinners 0.8–2.4 s, the aura 37–59 s — are fine
but should be named).

**Off-scale component metrics:**

| File:line | Value | Problem |
|---|---|---|
| `markup/MarkupPalette.module.css:37,54` | `--palette-control` 30 / 40 | the drawn fill of a palette control is 30 / 40, the dock's is 32 / 44; on touch the palette's visible target is under 44 |
| `markup/MarkupPalette.module.css:41,55` | `--palette-ring` 24 / 30 | armed-pen ring off every scale |
| `ui/Toast/Toast.module.css:23,58` | `--toast-h` 48 / 56 | a floating piece 8 px taller than every other piece (G1 says 40 / 48) |
| `ui/Toast/Toast.module.css:26,59` | `--toast-action-h` 28 / 36 | action off the control scale |
| `ui/Tooltip.module.css:9,33` | `--tip-h` 26 / 28 | |
| `shell/frame/Dock.module.css:113,121` | 56 − 2 and 44 (labels under) | when a sheet narrows the free rectangle on a tablet the dock turns into a 56 px bar with 12 px labels (`settings-1180x820t-dark.png`): a second dock size |
| `shell/ShortcutOverlay.module.css:51,66` | header 52, close 28, radius `--radius-2` | M8 dialog header and a 28 px close beside 32/44 controls |
| `export/ExportDialog.module.css:39` | input `height: 32px` at every density | a 32 px field on touch (Q-9: 44) |
| `home/LibraryCard.module.css:17,197` | 284 / 312 fixed card height | text in the card can clip in Turkish (A-21) |
| `stage/grid/GridPieces.module.css:89,94` | `16rem`, `19rem` | rem in a px system |
| `shell/frame/TopStrip.module.css:436` | tab close 24 × 24 | fine-pointer only; inside a 32 tab it is OK, but it has no coarse size |

**Icon boxes off {16, 20}:** 14 px in 18 rules (`shell/FormsPanel.module.css:31,102,145,231`,
`shell/OutlinePanel.module.css:112`, `shell/CommentsPanel.module.css:86`,
`shell/panels/RedactionsPanel.module.css:81`, `shell/sidebar/ThumbnailList.module.css:112`,
`outline/Outline.module.css:38`, `document/DocumentTools.module.css:330`,
`text-edit/TextEdit.module.css:175`, `signatures/Signatures.module.css:237`,
`image-objects/ImageObjects.module.css:135`, `batch/Batch.module.css:194`,
`forms/FormLayer.module.css:186`, `forms/create/CreatedFields.module.css:162,341`,
`annotations/AnnotationLayer.module.css:221`); 12 px in 7 (badges, `ui/Switch.module.css:113`,
`ui/NumberField.module.css:58`, `ui/Avatar.module.css:70`, `signatures/Signatures.module.css:253`,
`forms/FormLayer.module.css:149`, `annotations/AnnotationLayer.module.css:178`); 10 px in
`ui/colour/ColourPanel.module.css:322`.

### 2.3 Mixed icon weights

Phosphor regular is a filled outline (no stroke). These surfaces draw their own stroked SVGs, so
the line weight differs from the Phosphor glyph beside them:

- `shell/frame/TopStrip.module.css:449` tab close, `stroke-width: 1.75` (the tab's ✕ is visibly
  heavier than the strip's Phosphor glyphs, `reader-1440x900-dark.png`).
- `shell/CommandPalette.module.css:59` search glyph 1.75.
- `stage/ArrangeView.module.css:414` 1.75; `stage/PageContextMenu.module.css:6` 1.5.
- `privacy/PrivacyShield.module.css:22` shield 1.5 at 20 px (Phosphor 20 px = 1.25).
- `ui/colour/ColourPanel.module.css:191, 326` 1.75 / 1.5; `ui/Activity.tsx:51` 1.5;
  `ui/Toast/Toast.module.css:111` 1.5; `ui/Checkbox.tsx:76` 2; `ui/Chip.module.css:84` 2.
- The palette's flyout corner marks (the tiny ◥ beside Rectangle, Stamp, Sign, Insert page in
  `crop-palette.png`) are drawn at about 1 px, finer than the 1.25 px glyphs.
- The armed Rectangle shows the **fill** twin (a solid black square inside a lime disc,
  `crop-shape.png`); with Lasso and Edit text already excepted (10-ink §2.4), the shapes read as a
  different icon when armed too.

### 2.4 Mismatched radii and heights between siblings

| # | Sev | Surfaces | Finding | Screenshot |
|---|---|---|---|---|
| I-08 | A | Sheets vs old dialogs | Sheets are radius 20, M5 glass; old dialogs radius 10 (`--radius-3`), solid `--surface-frame`, an M8 header with a divider | `settings-1440x900-dark.png` vs `dlg-password-1440x900-light.png` |
| I-09 | A | Menus 16, popovers 16, command palette ≈ 10, shortcuts overlay 10, page-pill popover 16 with 8 px padding | Three popup radii and two paddings | `command-palette-1440x900-dark.png`, `page-pill-menu-1440x900-dark.png` |
| I-10 | B | Fields | The strip's Find field and Settings' search are both search fields: one is a pill, one a 10 px rectangle; the title menu's name field is 10 px with 600 weight | `reader-1440x900-dark.png`, `settings-1440x900-dark.png`, `title-menu-1440x900-dark.png` |
| I-11 | B | Segmented controls | 32 / 44 in sheets and the page-pill menu, 40 / 48 in the Library footer and grid corner (piece height), with 28 vs 36 segments | `settings-…`, `library-docs-…` |
| I-12 | B | Library launcher | Empty state: a 20 px card with a dashed 36 px drop capsule and 36 px buttons; with documents: a 64 px capsule (72 touch) with 40 px (48 touch) buttons. Same actions, two shapes and three sizes | `library-empty-1440x900-dark.png`, `library-docs-1440x900-dark.png` |
| I-13 | B | Toast vs pieces | Toast 48 (56 touch) stacked over the 40 (48) Pages bar | `toast-1440x900-light.png` |
| I-14 | B | Thumbnails | Sidebar and grid cells have a 12 px ring round the cell; the phone's pages sheet has a square ring; Library cards 16 | `sidebar-…`, `grid-selected-…`, `phone-contact-dark.png` |
| I-15 | B | Side-sheet inset | Sheets sit 8 px from the strip, the edge and the bottom (`ui/sheet/Sheet.module.css:50-53`); every piece sits 16 px from the window (G1) | `settings-1440x900-dark.png` |

### 2.5 The old dialogs that have not become sheets

07-sheets §1.3 lists every dialog's fate. Still on the M8 `Dialog.Popup` recipe
(`shell/ShortcutOverlay.module.css` popup + `export/ExportDialog.module.css` form parts):

| Spec id | Today | File | What is wrong visually |
|---|---|---|---|
| S5 Password (set, remove) | centred dialog | `document/DocumentDialogs.tsx:215, 303` | radius 10, solid, native checkboxes (13 px on touch, `dlg-password-1180x820t-dark.png`), 32 px fields at every density |
| — Strip metadata | centred dialog | `document/DocumentDialogs.tsx:372` | same recipe, native checkboxes |
| S8 Sign with certificate | centred dialog | `signatures/SignDialog.tsx:182` | the browser's native **"Choose File / No file chosen"** button leaks (Q-14), native checkbox (`dlg-sign-1440x900-light.png`) |
| S11 Page furniture ×4 | right-side panel, not a sheet | `furniture/FurnitureDialogs.tsx:154` (+ `FurnitureDialogs.module.css`) | UPPERCASE tracked section labels (`:45`, against T-9), radius 6 chips, a square close button, native checkboxes, no scrim; on touch the number fields collapse and their ± buttons overlap the value, and the footer clips off-screen (`dlg-page-numbers-1180x820t-dark.png`, `crop-pn.png`) |
| S12 Crop | centred dialog | `crop/CropDialog.tsx` via `stage/OperationDialogFrame.tsx` | the `Frame` of `OperationDialogFrame.tsx` is the old popup |
| S17 Resize | a Sheet, but the content is the old form | `stage/ResizeDialog.tsx:35` imports `ExportDialog.module.css` | native radios and checkboxes inside a new sheet (`dlg-resize-1440x900-light.png`) |
| S22 Shortcuts overlay | a Sheet, old popup styles | `shell/ShortcutOverlay.module.css:20-75` | radius 10, solid frame, 52 px header, 28 px close |
| Command palette | own dialog | `shell/CommandPalette.tsx` | radius ≈ 10, own header; acceptable as a centred M4 popup but should share the menu's radius and row metrics |

Native form controls still rendered outside `ui/` (Q-9, Q-14): `<input type="checkbox|radio|file">`
or `<select>` in `furniture/FurnitureDialogs.tsx` (9), `stage/ResizeDialog.tsx` (5),
`batch/StepForm.tsx` (4), `document/DocumentDialogs.tsx` (4), `forms/create/FieldProperties.tsx`
(3), `shell/panels/RedactionsPanel.tsx` (3), `crop/CropDialog.tsx`, `signatures/SignDialog.tsx`,
`compare/CompareView.tsx`, `ocr/OcrLanguages.tsx`, `document/ExportSections.tsx` (2 each). Hand-
written `<button>` outside `ui/`: 151, led by `batch/BatchSheet.tsx` (22).

### 2.6 Inconsistent paddings and layout grammar in sheets, menus and popovers

| # | Sev | Finding | Files |
|---|---|---|---|
| I-16 | A | **Three sheet grammars.** Settings uses inset grouped lists (12 px groups, 44 px rows, title + description left, control right). Save a copy uses a label column (Format, Size, Security…) with hairline rows and no groups. Document info uses a label column with bold section heads and bare fields. The owner sees three different apps in three sheets (`settings-…`, `save-copy-…`, `doc-info-…`). | `settings/Settings.module.css`, `export/SaveCopySheet.module.css`, `document/DocumentInfoSheet.module.css` |
| I-17 | B | Sheet header: Settings' title sits 27 px from the top (no subtitle), Save a copy's 20 px with a subtitle; the close button is a 32 px quiet button in sheets, a 28 px rounded-rect in the shortcuts overlay, a lime-ringed square in furniture. | `ui/sheet/Sheet.module.css:143-212`, `shell/ShortcutOverlay.module.css:62`, `furniture/FurnitureDialogs.module.css` |
| I-18 | B | Popover padding: `ui/Popover.module.css:33` 12; the page-pill popover `shell/frame/PagePill.module.css:77` 8; the privacy popover 16 with its own section rhythm; menus 6. | |
| I-19 | B | Menu content: the title menu carries a document header, a Lock switch with a lock glyph *inside the thumb*, a facts row and sections with labels; the dock's More menu is bare rows without icons; the phone's More menu has icons on every row (`dock-more-…`, `phone-contact-dark.png`). | `shell/frame/TitleMenu.module.css`, `shell/frame/Dock.tsx`, `shell/compact/CompactChrome.module.css` |
| I-20 | B | Section labels: footnote 600 sentence case in menus and Settings; footnote **uppercase tracked** in `export/ExportDialog.module.css:226`, `furniture/FurnitureDialogs.module.css:45`, `privacy/PrivacyShield.module.css:128`, `session/KeptOnDevice.module.css:17`, `compare/ChangesPanel.module.css:116`, `markup/MarkupPalette.module.css:252` (T-9 removed them). | |

### 2.7 The ink strip and the palette

| # | Sev | Finding | Screenshot |
|---|---|---|---|
| I-21 | A | **Three armed looks in one bar.** Select armed = a grey disc; a shape armed = a lime disc with the fill glyph; a pen armed = a 2 px ring round the colour dot with no fill. The armed tool is the one place lime belongs at rest (ADR-0023). | `crop-palette.png`, `crop-shape.png`, `markup-1180x820t-dark.png` |
| I-22 | A | The strip's content changes per tool: a pen shows one well + width; a shape shows the well, four recents (which repeat the pen colours, the owner's "repeat?") and the width; widths are 200 / 240 px, so the strip piece changes width and position between tools. | `crop-palette.png`, `crop-shape.png` |
| I-23 | B | The strip piece is centred over the palette, not anchored to the armed tool or the capsule's edge; on a tablet it floats over the page text with empty glass either side ("empty and ugly"). | `markup-pen-1180x820t-light.png` |
| I-24 | B | Slider: the track is a tapered wedge under a glass-lens knob whose dot reads as a red dot (the current colour) — new language seen nowhere else; tick marks under the track at 1 px. | `crop-palette.png` |
| I-25 | B | The palette mixes icon-only tools, labelled groups ("Sign ▾", "Edit text", "Redact"), a field stepper "‹ 3 fields ›" and a trailing "+": four control grammars in one capsule; separators at 16 px. | `markup-pen-1440x900-dark.png` |

### 2.8 Frame

| # | Sev | Finding | Screenshot |
|---|---|---|---|
| I-26 | B | Top strip right piece: "Saved / Save" is a text button whose width changes with its label, beside icon buttons; the privacy shield draws its own stroked glyph (I-2.3). | `reader-1440x900-dark.png` |
| I-27 | A | The privacy popover is a long text document in an M4 popover: on a tablet it runs from the strip to the dock and over the page pill; it has no scroll fade, uppercase section labels and a 16 px rhythm of its own ("some pop-ups don't fit"). | `privacy-1180x820t-light.png` |
| I-28 | B | The page-pill popover's "Go to page" field is auto-focused on open, so it always opens with the lime ring, and its padding (8) differs from the popover primitive (12). | `page-pill-menu-1440x900-dark.png` |
| I-29 | B | The sidebar's two stacked segmented controls (Pages · Find · Review, then Thumbnails · Contents) are two rows of the same control at the same height: a hierarchy without a step. | `sidebar-1440x900-dark.png` |
| I-30 | C | The phone's top bar is a flat full-width bar; the tablet's is two floating pieces. Fine by ADR-0033, but the phone bar's title and back count use literal 15 px (`CompactTopBar.module.css:96,113`). | `phone-contact-*.png` |

### 2.9 Pages grid and selection

| # | Sev | Finding | Screenshot |
|---|---|---|---|
| I-31 | A | **Current and selected look the same.** The current page and a selected page both get the 2 px lime ring round the whole cell (`--select-ring` = `--accent-ring`); only the badge tells them apart. In light, both rings are lime-800, which reads as olive grey. | `grid-1440x900-dark.png`, `grid-selected-1180x820t-dark.png` |
| I-32 | A | The unselected check badge in selection mode is an empty grey disc on the page's top-right — it reads as a stain, not a control (the owner's "buggy"). | `grid-selected-1180x820t-dark.png` |
| I-33 | B | Source-group headers in All open: a title, a dot, a count and two outlined tags ("has form", "tagged") in a different type size, with a full-width hairline — the busiest line on the screen (owner's capture). | owner capture `160364df` |
| I-34 | B | At the default size the grid packs four small thumbnails into the top-left of a 1440 px window, leaving 80 % empty; it is not centred and not sized to the free rectangle. | `grid-1440x900-dark.png` |

### 2.10 Library

| # | Sev | Finding | Screenshot |
|---|---|---|---|
| I-35 | A | "Library" three times: the strip's Library pill, the 40 px display title, and the subtitle; with the logo in both the pill and (empty state) the card. | `library-docs-1440x900-dark.png` |
| I-36 | A | Two grids: the strip pieces sit 16 px from the window; the Library column starts at x = 128 (32 on tablet), and its footer pills sit in the column, not at the 16 px inset. | `library-docs-1440x900-dark.png` |
| I-37 | B | The launcher (I-12) and the cards (16 px, 12 px padding, fixed 284 px height) share no radius family with the pieces; the card's 40 px corner checkbox sits inside its 12 px padding. | `library-docs-…` |
| I-38 | B | Display 40 px title + title1 28 px empty-state headline + callout + footnote + body: five sizes on one screen (X-3 says at most three). | |
| I-39 | B | In light, the brand mark becomes flat ink (`library-docs-1180x820t-light.png`), and the aura becomes a pastel wash; the brand loses its gradient in exactly the theme where it would carry most. | |

### 2.11 Light-theme problems

| # | Sev | Finding |
|---|---|---|
| I-40 | A | **The lime vanishes, so focus reads as a black box.** The light band (lime, 1.21:1 on white) disappears on white wells and paper glass; only the 2 px ink band shows, so every focused field looks like a thick black rectangle (`dlg-password-1440x900-light.png`, `settings-1440x900-light.png`). Same for the "PDF" segment in Save a copy. |
| I-41 | A | Light glass reads as opaque paper. With tints at 0.70–0.88 and the contrast floor, every piece and sheet is near-white with a faint shadow; nothing of the canvas or aura shows through, so the Liquid Glass feel is absent in light (`reader-1180x820t-light.png`, `library-docs-1180x820t-light.png`). |
| I-42 | B | Dark glass over the near-black canvas is indistinguishable from the canvas (M1/M2 differ by 1.06–1.08:1, language.md §2.2): the pieces exist only as a rim. The owner's "more bg = better glass": the material only shows over the aura or a page. |
| I-43 | B | The selection ring and current-thumbnail ring in light are lime-800 (`#446713`), which reads as dark olive or grey, not as "selected" (`grid-…-light`, `sidebar-1180x820t-light.png`). |
| I-44 | B | The light scrim (ink 0.28) greys the whole stage including the top strip, which then looks disabled (`settings-1440x900-light.png`). |
| I-45 | C | The primary button in light is an ink pill with a lime label (ADR-0023); next to the lime-free light chrome, the Library's "Open PDFs…" is the heaviest object on the screen. Correct by the ADR; listed so the owner can confirm it. |

### 2.12 Focus and selection styles

| # | Sev | Finding |
|---|---|---|
| I-46 | A | **Focus rings on pointer-opened surfaces.** Opening Settings, Document info, Go to page, Set password or the shortcuts overlay by pointer focuses the first field with a visible ring (`initialFocus` on a field). On iPad and macOS a sheet opened by pointer does not light a ring; on touch it should not raise the keyboard either. |
| I-47 | B | Twelve modules draw a focus ring themselves instead of using a `focus.css` form (`ui/Field.module.css:106,208`, `ui/NumberField.module.css:91`, `ui/Slider.module.css:481`, `ui/ScrollArea.module.css:34`, `ui/ResizeHandle.module.css:86`, `ui/colour/ColourSpectrum.module.css:66`, `ui/sheet/SheetField.module.css:39`, `shell/frame/TopStrip.module.css:574`, `shell/frame/TitleMenu.module.css:94`, `shell/frame/PagePill.module.css:120`, `shell/sidebar/FindSection.module.css:59`, `furniture/FurnitureDialogs.module.css:125,176`). They agree today, but nothing keeps them in step. |
| I-48 | B | The phone's Pages sheet ring (`shell/compact/CompactSheets.module.css:43,49`: a 3 px `--surface-active` outline plus a 2 px `--accent-ring`) is a fourth selection form. |
| I-49 | B | Selection colours: whole pages and files are lime (G7), text and marks on the page are blue `--select`, the palette's chosen swatch is a primary-text ring, the armed tool is lime or grey (I-21). Four "this is the chosen one" signals. |

---

## 3. Proposed final system

The aim is a small set of tokens and rules that every surface obeys, close to what the
floating chrome already does, so most of the change is naming and removing exceptions, not a new
look.

### 3.1 Grid and spacing

- **One 4 px grid with a 2 px half-step** for optical fixes only. Tokens:

  | Token | px | Typical use |
  |---|---|---|
  | `--space-half` | 2 | segment inset, gap between tabs |
  | `--space-1` | 4 | gap between controls in a piece, menu inset 6 = 4 + 2 rim |
  | `--space-1h` | 6 | label ↔ glyph gap inside a button, menu padding |
  | `--space-2` | 8 | gap between pieces, sheet group inset |
  | `--space-3` | 12 | row padding, popover padding, card padding |
  | `--space-4` | 16 | piece inset, sheet padding (coarse), section gap |
  | `--space-5` | 20 | sheet padding (fine) |
  | `--space-6` | 24 | between sheet sections, dialog padding |
  | `--space-8` | 32 | Library gutters |
  | `--space-10` | 40 | Library section gap |
  | `--space-12` | 48 | |
  | `--space-16` | 64 | Library top margin |

- **Every surface aligns to the piece inset.** The window has one margin, `--piece-inset` (16):
  pieces, side sheets (today 8), toasts, the Library column's left edge and its footer pills
  all start there. A side sheet is `--piece-inset` from the edge and `--space-2` under the strip.

### 3.2 Concentric radii

Rule (S-1): **inner radius = outer radius − inset**, rounded to a token; anything that floats
is a capsule.

| Token | px | Role |
|---|---|---|
| `--radius-page` | 2 | pages, on-page marks |
| `--radius-xs` | 4 | keycaps, small badges, tick marks |
| `--radius-sm` | 8 | tooltips, swatch cells, thumbnails' inner image |
| `--radius-control` | 10 | text fields, menu rows (16 − 6), list rows, thumbnail cells, stepper wells |
| `--radius-md` | 12 | grouped lists and wells inside sheets (20 − 8), settings groups |
| `--radius-lg` | 16 | menus, popovers, command palette, note popups, Library cards |
| `--radius-xl` | 20 | sheets, dialogs, the floating sidebar, the Library launcher card, drop overlay |
| `--radius-2xl` | 28 | phone bottom sheets |
| `--radius-capsule` | 999 | every piece, bar, toast, button, segmented control, search field, chip |

Consequences: the command palette and the shortcuts overlay go to 16 and 20; old dialogs to 20;
the tooltip keeps 8 but by token; settings groups sit at an 8 px inset (not 20) so 20 − 8 = 12 is
true; `--radius-md` changes meaning from 10 to 12 (the control keeps `--radius-control`). Squircles
(language.md S-2) stay an optional `@supports` enhancement on `--radius-lg` and up.

### 3.3 Three control sizes

Pieces stay at `--piece-h` 40 / 48 (G1). Inside them, and everywhere else, a control has one of
three sizes:

| Size | Fine | Coarse | Glyph | Label | Use |
|---|---|---|---|---|---|
| **S** | 24 | 32 visual, 44 hit | 16 | footnote | inline: tab close, keycap button, field stepper, toast close, card corner check |
| **M** (default) | 32 | 44 | 20 (controls), 16 (rows) | body 500 | buttons, icon buttons, fields, segmented, menu and list rows, dock and palette items, toast action |
| **L** | 40 | 52 | 20 | callout 500 | at most one per screen: the Library's primary start, a phone sheet's footer action |

Rules:

- A control never takes `--piece-h` as its height: the Library's launcher buttons and footer
  pills become M controls inside a piece (or the primary an L), the dock's "labels under" mode
  keeps the 48 px piece.
- Every control's visible fill equals its box (the palette's 30 / 40 fills become 32 / 44).
- Retire `--control-height` (28), `--chip-h` (chips become S or M), `--bar-button` (= M).
- Segmented controls are M; inside a piece the piece adds its rim, not a bigger control.

### 3.4 Type ramp

Keep language.md §4.2's eight steps; add rules for where each may appear:

| Surface | Allowed steps |
|---|---|
| Floating chrome (pieces, capsule, pill, toasts, tooltips) | caption, footnote, body |
| Menus and popovers | footnote (section labels, secondary), body (rows) |
| Sheets | footnote, body, callout (body copy), title3 (title); title2 only in a centred confirmation |
| Library and About | footnote, body, title1 (one heading), display (one title) |

- Section labels are footnote 600 in secondary colour, sentence case, never uppercase.
- Weights 400 · 500 · 600 only; 450/550/650 map to 400/500/600.
- Every literal size is replaced by its token; the compact edition reads `--type-*` (its rem
  values equal the coarse steps already).

### 3.5 Materials, elevation and colour

- **Materials:** keep the five tiers. Two proposals for the owner's "more background = better
  glass", each gated by `tokens.test.ts`:
  1. **Dark:** let the canvas carry light. The reader glow (G5) and the Library aura are the only
     things glass can show; make the reader's glow default on at the stage edges in Glass Clear,
     so M1/M2 pieces always have colour under them, rather than lowering tint alphas (which the
     contrast tests forbid over a white page).
  2. **Light:** lower M1/M2 light tint alpha from 0.70/0.72 to the minimum the test allows and add
     a 1 px white inner rim at 0.9 (already in the rim tokens) plus e3 for M2, so light pieces read
     as glass over the aura rather than as paper. Sheets (M5) stay paper.
- **Elevation:** unchanged (e0–e5). Old dialogs move from solid `--surface-frame` to M5 + e5.
- **Colour roles, tightened:**
  - *Armed and on* (the one tool, the one primary action): `--tool-active-fill` disc for every
    armed tool, including Select and the pens.
  - *Selected* (whole pages, files, the chosen swatch): a 2 px `--select-ring` ring **plus** the
    filled check badge; in light, the ring is `--n12` (ink) with the lime badge, not lime-800.
  - *Current* (the page you are on, the open document): a 1 px `--border-strong` ring and the
    label in 600; never the selection ring.
  - *Hover / pressed:* `--surface-hover` / `--surface-active` washes only.
  - *On the page:* `--select` blue, unchanged.

### 3.6 Surfaces: one recipe each

| Surface | Material | Radius | Padding | Rows | Header | Notes |
|---|---|---|---|---|---|---|
| Piece | M1/M2 | capsule | `--piece-pad` | M controls | — | 40 / 48 |
| Toast | M2 | capsule | 0 `--space-4` | M action, S close | — | **40 / 48** (was 48 / 56) |
| Tooltip | M4 solid-ish | 8 | 4 / 8 | — | — | 24 / 28, footnote |
| Menu | M4 | 16 | 6 | M rows (32 / 44), 16 glyph, every row may carry a glyph | optional footnote section labels | one recipe for title, More, context and phone menus |
| Popover | M4 | 16 | 12 | M rows | footnote label or title3 | the page-pill and privacy popovers adopt it; content taller than the room scrolls with the menu's edge fade |
| Sheet (side, form, dialog) | M5 | 20 (28 phone bottom) | 20 / 16 | grouped lists | title3 + optional footnote subtitle, S/M close at the trailing edge, one height (56 / 64) | one grammar, §3.6.1 |
| Command palette | M4 | 16 | 6 | M rows | search field (capsule) | centred |
| Card (Library) | lit / M2 | 16 | 12 | — | — | no fixed height |

#### 3.6.1 The sheet grammar (replaces three)

1. Header: title3, optional footnote subtitle; close as an M quiet icon button; 56 px fine,
   64 coarse; no divider (the content scrolls under a soft edge).
2. Body: **inset grouped lists**, Settings' recipe: group radius 12 at an 8 px inset, rows M
   height (44 / 56 for two-line rows), title + description leading, control or value trailing,
   hairlines between rows inset by the row padding.
3. Section labels: footnote 600, secondary, sentence case, 8 px above the group.
4. Fields sit as trailing controls in a row, or as a full-width row inside a group; never a bare
   field on the sheet.
5. Footer: secondary info leading in footnote, actions trailing (standard + prominent), M size
   fine, L on phones.

Save a copy's label column becomes groups (Format · Size · Protection · Name); Document info's
facts become a group of value rows and its metadata a group of field rows; furniture, password,
strip, sign, crop, resize and shortcuts adopt it as they move onto `ui/sheet`.

### 3.7 Ink: palette and strip

- One armed form (§3.5); pens show their colour dot inside the armed disc.
- The strip has **one layout for every tool**: well · four recents (never repeating the armed
  pen's own colours) · hairline · width slider · readout, at one width; tools without a colour
  show the slider only, in the same piece position.
- The strip anchors to the capsule's leading edge above the palette (not centred over the page),
  so its position does not jump between tools; it is the same piece height and capsule radius.
- The slider is the `ui/Slider` primitive's plain track (no wedge) with the lens knob; the knob's
  dot is neutral, not the ink colour.
- Groups that carry a label keep it (Sign, Edit text, Redact); the rest are icon-only with a
  tooltip; flyout marks become a 16 px caret at the label's cap height (10-ink §2.4) or are
  dropped where a long-press opens the flyout.

### 3.8 Focus and selection

- **Focus:** keep the two-band ring and its three forms, applied only through `focus.css`
  classes; the twelve hand-drawn rings (I-47) compose `focus-inset`.
- **Light theme focus** (I-40), for the owner to choose:
  - *A (recommended):* in light, the light band stays lime but the ring is always **outset** on
    fields and segments (2 px ink at the edge, lime outside on the glass), so the lime sits on the
    tinted glass where it shows, not on the white well;
  - *B:* in light, `--focus-light` becomes `--lime-500` with the ink band; still C40-compliant
    (6.0:1 between bands) and visible on white.
- **Pointer-opened surfaces focus the surface, not a field** (I-46): `initialFocus` goes to the
  sheet or popover when opened by pointer or touch, to the field when opened by keyboard.
- **Selection:** §3.5's three forms (armed, selected, current), the same on the grid, sidebar,
  Library and phone; the unselected badge in selection mode is a 1.5 px white ring with a 0.24
  scrim (visible, clearly empty), not a grey disc.

### 3.9 Library

- One title: the strip's Library pill names the place; the page keeps the brand lock-up (mark +
  "Recto") at title1 and the one-line promise in callout, and drops the second "Library".
- One launcher shape in both states: a capsule piece holding the L primary and M secondaries;
  the empty state centres it, the populated state places it under the lock-up. No separate dashed
  drop capsule: the whole window is the drop target, the piece says so in footnote.
- The column's left edge, the footer pills and the strip pieces share `--piece-inset` (wide
  windows centre a max-width column whose edge is the pieces' inner edge).
- Cards: radius 16, padding 12, height from content, title body 500 + footnote meta; the corner
  check is an S control.
- The brand mark keeps its gradient in both themes.

### 3.10 Icons

- Sizes {16, 20} in the UI, 32 in empty states, **12 only inside badges** (named
  `--icon-xs`); 10 and 14 go.
- Phosphor only: every hand-drawn stroked SVG listed in §2.3 becomes a Phosphor glyph (or a
  custom glyph on the 256 grid with a 16-unit stroke, I-7).
- Outline at rest, fill when selected, except action glyphs, Lasso, Edit text **and the
  shapes** (whose fill twins read as different icons).

### 3.11 Gates that keep it settled

No new dependencies; extend what exists:

1. `styles/css-scale.test.ts` (new, beside `focus-scan.test.ts`): parses every module and fails
   on a literal `font-size`, `border-radius`, `font-weight` outside {400, 500, 600}, a duration
   outside the motion tokens, an SVG box outside {12 in badges, 16, 20, 32}, `stroke-width` on a
   UI glyph, `text-transform: uppercase`, and spacing literals off the 2/4 grid. Starts as a
   ratchet (a committed allow-list that may only shrink).
2. `tokens.test.ts`: the radius, space and control tokens of §3.1–§3.3; aliases deleted
   (migration step 11).
3. `e2e/bar-audit.spec.ts`: add the Library, sheets, popovers and toasts to the containers it
   walks; assert piece heights ∈ {40, 48} and control heights ∈ the three sizes.
4. ESLint (Q-9's planned rule): `<input type=checkbox|radio|file>`, `<select>` and classed
   `<button>` outside `ui/` are errors once lane work lands.
5. `surfaces.visual.spec.ts` (Q-13): add the light baselines and one sheet, one menu, one
   popover, the palette with its strip, the grid in selection mode.

---

## 4. Work breakdown by lane

Each lane conforms its surfaces to §3. *Platform* goes first (tokens and primitives); the other
lanes can run in parallel once its tokens land, each behind the §3.11 ratchet.

### Platform (first)

Tokens, primitives, gates and the compact edition's adoption of the tokens.

- `apps/web/src/styles/tokens.css`, `token-registry.ts`, `tokens.test.ts`: §3.1 spacing (2, 6,
  40, 64), §3.2 radii (sm 8, md 12, lg 16, xl 20, 2xl 28), §3.3 sizes (S/M/L, retire
  `--control-height`, `--chip-h`, `--bar-button`), `--icon-xs`, `--toast-h` = `--piece-h`,
  `--sheet-pad`/`--sheet-radius` as public tokens; delete the aliases (migration step 11) with a
  codemod across `src/**/*.module.css`.
- `styles/motion.css`: name the loop durations (spinner, ring, bloom, reveal) and replace the
  literals in `ui/ScrollArea`, `ui/Progress`, `ui/Switch`, `ui/Checkbox`, `ui/RadioGroup`,
  `ui/Slider`, `ui/Toast`.
- `styles/focus.css`: the light-theme choice of §3.8; `ui/Field`, `ui/NumberField`, `ui/Slider`,
  `ui/ScrollArea`, `ui/ResizeHandle`, `ui/colour/ColourSpectrum`, `ui/sheet/SheetField` compose
  the shared forms.
- `styles/controls.css`: S/M/L classes (`btn-sm`, default, `btn-lg` 40/52), gap `--space-1h`,
  padding tokens.
- `ui/Menu.module.css`, `ui/MenuButton.module.css`, `ui/Select.module.css`,
  `ui/Popover.module.css`, `ui/Segmented.module.css`, `ui/Tooltip.module.css`,
  `ui/Slider.module.css`, `ui/colour/*.module.css`, `ui/sheet/Sheet.module.css`: literal sizes,
  radii and private type variables to tokens; Sheet header to §3.6.1; side sheet inset to
  `--piece-inset`; popover content scroll with the menu's edge fade.
- `ui/Toast/Toast.module.css`: 40 / 48 piece, M action, S close.
- `ui/sheet/`: a `SheetGroup` / `SheetRow` pair implementing §3.6.1 (Settings' recipe lifted
  from `settings/Settings.module.css`), and the pointer-vs-keyboard `initialFocus` rule.
- `styles/css-scale.test.ts` (new), `e2e/bar-audit.spec.ts`, `e2e/surfaces.visual.spec.ts`,
  `eslint.config.js` (Q-9 rule as a warning, error at the end).
- Compact edition: `shell/compact/*.module.css`, `shell/frame/CompactTopBar.module.css` read
  `--type-*` instead of rem/px; `CompactSheets.module.css:43,49` take the §3.8 selection form;
  `CompactChrome.module.css:62` takes `--radius-lg`.
- `docs/design/redesign-2026-10/language.md` §6.1–§6.2: replace the stale dock/bar table with
  G1's sizes and this file's radius and size tables.

### Frame

Top strip, title menu, page pill, privacy, sidebar.

- `shell/frame/TopStrip.module.css`: tab close as an S control with a Phosphor ✕ (drop the
  1.75 stroke), `--space-*` for the 6 px and 4 px literals; Save/Saved as a fixed-width M button
  so the piece does not resize.
- `shell/frame/TitleMenu.module.css`, `TitleMenu.tsx`, `TitleMenuItems.ts`, `LockSwitch.tsx`: the
  menu recipe of §3.6; glyphs on rows consistently; Lock as a plain row with a trailing switch
  (no glyph in the thumb); own focus ring removed.
- `shell/frame/PagePill.module.css`, `PagePillMenu.tsx`: the popover recipe (12 padding), no
  auto-focus on pointer open, own focus ring removed.
- `shell/frame/Dock.module.css`, `Dock.tsx`: keep one piece height when labels go under (48, not
  56); the More menu gets row glyphs like the phone's.
- `privacy/PrivacyShield.module.css`, `PrivacyShield.tsx`: popover recipe, scrolling within
  the room, sentence-case section labels, Phosphor shield.
- `shell/sidebar/Sidebar.module.css`, `ThumbnailList.module.css`, `FindSection.module.css`: the
  primary switch (Pages · Find · Review) as the segmented control, the secondary
  (Thumbnails · Contents) as a smaller text tab row, so the two levels differ; §3.8 current vs
  selected rings; radius tokens.
- `shell/ShortcutOverlay.module.css`, `ShortcutOverlay.tsx`, `shell/CommandPalette.module.css`:
  sheet grammar for the overlay, radius 16 and Phosphor search glyph for the palette.

### Capsule

The morphing bottom element and everything it hosts besides the ink tools.

- `shell/capsule/Capsule.module.css`, `capsule-content.ts`: verify every shape (dock, palette,
  pages, compare, locked) uses `--piece-h` and M controls; no size change when a sheet narrows the
  free rectangle.
- `stage/grid/PagesBar.module.css`, `PagesBar.tsx`: separators and the 12 px glyph to tokens;
  Delete in danger only when enabled.
- `home/SelectionBar.module.css`: same recipe as the Pages bar.
- `ui/Toast/ToastRegion.tsx` stacking: toasts align to the capsule's width band at
  `--space-2` above it.

### Ink

Palette, ink strip, colour and width controls.

- `markup/MarkupPalette.module.css`, `ToolButton.tsx`, `ChoiceTool.tsx`, `SignGroup.tsx`: one
  armed form (§3.5) for Select, pens, shapes and groups; `--palette-control` 32 / 44;
  `--palette-ring` removed; outline glyph for armed shapes; flyout marks per §3.7; the uppercase
  label at `:252` to sentence case.
- `markup/InkStrip.module.css`, `InkStrip.tsx`, `StripPiece.module.css`, `anchor.ts`,
  `ink-recents.ts`: one layout and one width for every tool, recents never repeating the armed
  pens, anchored to the capsule's leading edge, readout at `--type-body`.
- `ui/Slider.module.css`: plain track, neutral knob dot, tick marks to tokens, bubble type token.
- `ui/Swatch.module.css`, `ui/colour/*`: radius and type tokens, the literal shadow at
  `Swatch.module.css:119` to a token.
- `annotations/pen/PenWell.module.css`: the chisel mark's literal radius and light shadow to
  tokens.

### Pages

Grid, thumbnails, page operations and their sheets.

- `stage/ArrangeView.module.css`, `ArrangeView.tsx`, `stage/grid/GridPieces.module.css`,
  `flip-cells.tsx`: §3.8 selection (selected ring + badge, current 1 px ring + bold number, light
  ring in ink), unselected badge per §3.8 (`ui/CheckBadge.module.css`), group headers as one line
  (title body 600 · count footnote · tags as footnote text, no outlined chips, no full-width rule),
  grid sized and centred in the free rectangle; rem widths to px tokens; the 1.75 stroke glyph to
  Phosphor.
- `ui/CheckBadge.module.css`, `ui/CheckBadge.tsx`: the empty state.
- `stage/ResizeDialog.tsx` (+ `.module.css`), `stage/OperationDialogs.tsx`,
  `stage/OperationDialogFrame.tsx`, `crop/CropDialog.tsx`: Crop onto `ui/sheet` (S12); Resize's
  content to §3.6.1 with `ui/RadioGroup`, `ui/Checkbox`, `ui/Select`; delete `OperationDialogFrame`
  and stop importing `export/ExportDialog.module.css`.
- `pages-sheets/*.module.css`: weight 650 → 600, radius tokens, §3.6.1 groups.
- `stage/PageContextMenu.module.css`: Phosphor glyphs (drop the 1.5 stroke).
- `dnd/dnd.module.css`: the 11 px badge radius to capsule.

### Viewer

The page, text selection, find, review, compare.

- `viewer/*.module.css`, `shell/Stage.module.css:128`: the stage's selection outline uses the
  §3.8 forms.
- `text-edit/ParagraphEditor.module.css`, `TextEdit.module.css`: radius 16 → `--radius-lg`, 14 px
  badge glyph → 16.
- `annotations/ReadSelectionBar.tsx`, `annotations/AnnotationLayer.module.css`: note popup radius
  token, 12/14 px glyphs to the icon scale; bar buttons via `ui/`.
- `shell/review/ReviewPanel.module.css`, `shell/CommentsPanel.module.css`,
  `shell/OutlinePanel.module.css`, `shell/FormsPanel.module.css`,
  `shell/panels/RedactionsPanel.module.css`, `outline/Outline.module.css`: 550 → 500/600, 14 px
  glyphs → 16, radius tokens, native controls → `ui/`.
- `compare/CompareView.tsx`, `compare/ChangesPanel.module.css`: native controls → `ui/`,
  uppercase label → sentence case.
- The owner's "animation!!" and "aura? option" notes on the reader belong here as motion work
  (not part of the visual system), tracked separately.

### Library

- `home/LibraryView.tsx`, `LibraryView.module.css`, `LibraryHead.module.css`,
  `Launcher.module.css`, `Launcher.tsx`, `LibraryFooter.module.css`, `LibraryCard.module.css`,
  `LibraryGrid.module.css`, `RecentList.module.css`, `DropOverlay.module.css`, `lit.module.css`,
  `Aura.module.css`: §3.9 — one title, one launcher shape, L primary and M secondaries (stop
  redefining `--control-h` as `--piece-h`), column and footer on the piece inset, cards from
  content height, radius tokens, at most three type sizes per state; the brand mark keeps its
  gradient in light (`brand` assets in `docs/brand/`).
- `shell/frame/LibraryButton.tsx`: the pill shows the mark and "Library" only when the page does
  not repeat it (decide with the owner, I-35).
- `session/KeptOnDevice.module.css`: uppercase label → sentence case.

### Forms

Fill & sign, form fields, signatures, and the content of every remaining dialog and sheet.

- `document/DocumentDialogs.tsx` → `document/PasswordSheet.tsx` (S5) and a strip-metadata sheet,
  on `ui/sheet` with `ui/Checkbox`, `ui/TextField`; delete their use of
  `shell/ShortcutOverlay.module.css` and `export/ExportDialog.module.css`.
- `signatures/SignDialog.tsx` → `signatures/CertificateSheet.tsx` (S8): a `ui/` file picker row
  (a standard button that opens the hidden input, the file name as the row value) instead of the
  native "Choose File"; `signatures/Signatures.module.css` weights and glyph sizes.
- `furniture/FurnitureDialogs.tsx`, `FurnitureDialogs.module.css` → `furniture/FurnitureSheet.tsx`
  (S11): sheet grammar, `ui/NumberField` at coarse sizes (fixes the overlapping ± on touch),
  `ui/Checkbox`, `ui/Segmented` for the format presets, sentence-case labels, a scrim, the
  footer inside the scroll room.
- `export/SaveCopySheet.module.css`, `SaveCopySections.tsx`, `document/DocumentInfoSheet.module.css`,
  `document/ExportSections.tsx`, `settings/Settings.module.css`, `redaction/ApplySheet.module.css`,
  `ocr/Ocr.module.css`, `batch/Batch.module.css`, `batch/BatchSheet.tsx`, `batch/StepForm.tsx`,
  `batch/RecipeEditor.tsx`: §3.6.1 groups, weights, native controls → `ui/`, hand-written
  buttons → `ui/Button`; then delete `export/ExportDialog.module.css`.
- `forms/FormLayer.module.css`, `forms/create/CreatedFields.module.css`,
  `forms/create/FieldProperties.tsx`, `forms/FieldEditors.tsx`: glyph sizes, native controls →
  `ui/`.
- `image-objects/ImageObjects.module.css`, `document/DocumentTools.module.css`: glyph sizes,
  weights.

### Order and exit

1. Platform tokens and the ratchet (one drop), then the primitives (one drop).
2. Frame, Capsule, Ink, Pages, Viewer, Library, Forms in parallel; each lane's exit is: the
   ratchet's allow-list has no entry under its files, `bar-audit` passes on its containers, and
   its surfaces have light and dark baselines at 1440 × 900 and 1180 × 820 touch.
3. Platform closes with the ESLint rule as an error and `export/ExportDialog.module.css`,
   `stage/OperationDialogFrame.tsx` and the `ShortcutOverlay` popup styles deleted.

### Decisions for the owner

1. Light-theme focus: option A (outset ring, lime on glass) or B (`--lime-500` light band), §3.8.
2. Light glass: lower M1/M2 tints toward the test floor for a glassier light theme, §3.5.
3. Dark glass: default the reader glow on at the stage edges so pieces have colour under them.
4. Library: drop the second "Library" title in favour of the brand lock-up, §3.9.
5. Selected vs current: lime ring + badge for selected, a neutral 1 px ring for current, §3.5.

### Lead's resolution of the decisions (2026-10-09)

1. Light focus: option A, the outset ring, so focus reads the same in both themes.
2. Light glass: lower the M1/M2 tints toward the test floor.
3. Reader glow: already on by default (owner decision G5); keep it on.
4. Library: keep the "Library" title; the owner asked for the mark only in the tab (G3).
5. Selected: lime ring and badge. Current: a neutral 1 px ring.
