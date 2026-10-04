---
title: Visual baseline before the M9 redesign
date: 2026-10-04
status: snapshot
---

> Captured on 2026-10-04 from the production build of `develop` at `7d47031`, served by
> `vite preview` on port 4611 and driven by Playwright 1.63 with headless Chromium 141 (build
> 1194, software GPU; `backdrop-filter` renders). Every frame below was looked at by eye.
> Sizes and colours come from `getComputedStyle` and `getBoundingClientRect`. Nothing in the
> app was changed. Motion could not be captured: these are stills.

# Visual baseline before the M9 redesign

## 0. Verdict

- The app works, but it looks like a dense desktop tool in grey: one 13 px text size, a
  `#181a1f` frame on a `#08090b` canvas, uppercase 11 px labels and one periwinkle accent.
  Nothing on screen says "Recto": the app glyph is a generic file icon.
- Glass is used on five surfaces (floating bar, options tier, selection bar, menus, palette)
  and reads as flat grey slabs. Over a white page it is mid grey; over the canvas it looks
  solid; menus and the palette let the content behind them ghost through, which costs
  legibility without giving depth. "Glass panels" makes the frame two-tone where a page
  passes under it.
- Floating chrome sits on the content at rest (the Read "Edit" pill and the Edit bar cover
  text at the bottom of the view), and three bars overflow their own capsule (swatches wrap
  out of the tier and the lasso bar; the Compare bar is clipped at 820 px).
- There is no tablet or phone layout. Rail (64 px), navigator (248 px) and inspector (280
  px) keep their desktop widths at every size. At 390 px the page area is 77 px wide and the
  shell scrolls sideways by 75 to 204 px. At 820 px with the inspector open, chrome takes
  72 % of the width.
- No light theme ships; the light-scheme frames match the dark ones.

## 1. How the set was made

- Build: `pnpm --filter @pdf-editor/web build`, then
  `pnpm --filter @pdf-editor/web preview --port 4611 --strictPort`, base path `/`.
- Viewports, all at device scale factor 1, `prefers-color-scheme: dark`, `?lang=en`, motion
  not reduced (each shot waits 450 to 900 ms after the last action so transitions finish):
  - desktop 1440×900 and small laptop 1280×800 (mouse);
  - tablet portrait 820×1180 and phone 390×844 (`hasTouch`, `isMobile`).
- Files: the fictional demo PDFs in `test/fixtures/demo/` (report v1 and v2, agreement,
  letter scan), opened through "Open files" with `showOpenFilePicker` hidden, as
  `apps/web/e2e/helpers.ts` does. For Recents, report v2 was opened and closed first.
- Read frames at 1440, 820 and 390 use the report cover (a navy page). Edit frames at 1440
  and 1280, Read at 1280 and the light-scheme frames use the agreement (a white page), so the
  glass is also seen over white.
- The Write group's options tier is shown with the Rectangle (R pressed twice): the pen's
  tier only opens after a pen with pressure has been seen.
- File names are `NN-surface-width.png`. `NN` is the surface and keeps its number at every
  size. 70 PNGs, 9.1 MB in total, the largest 234 KB, so none needed cropping or
  compression (neither `pngquant` nor `oxipng` is installed here).
- The capture script lives outside the repository. To repeat it: one fresh browser context
  per viewport (resizing a live page leaves page 1 blank in Read, see `smoke.spec.ts`), the
  selectors of `apps/web/e2e/` (`document-menu`, `options-tier`, `annotation-bar`,
  `page-context-menu`, `merge-all-dialog`, `export-dialog`, `about-dialog`, `compare-setup`),
  keys `0`–`4` for Home, Read, Edit, Arrange and Compare, Ctrl+K for the palette, `?` for the
  shortcuts, Ctrl+F for Find, Ctrl+Alt+B for the inspector, `G` for the signature dialog, and
  `localStorage['pdf-editor:appearance:v1'] = {"glassPanels":true,…}` for Glass panels.

## 2. Measurements

At 1440×900 unless noted.

| Element | Size | Style |
|---|---|---|
| Title bar | 40 px high | solid `#181a1f`, 13 px text |
| Status bar | 28 px high | solid `#181a1f`, 12 px text |
| Rail + navigator panel | 64 + 248 px (313 px with the border) | solid `#181a1f` |
| Inspector | 280 px | solid `#181a1f` |
| Chrome width with both side panels | 593 px | 41 % of 1440, 46 % of 1280, 72 % of 820 |
| Stage canvas | rest of the window | `#08090b` |
| Mode switch (Read / Edit / Arrange) | 226×30 px | solid `#181a1f`, radius 6 px |
| Floating bar in Read (the Edit pill) | 76×44 px | `rgb(48 51 58 / 0.66)`, `blur(28px) saturate(1.8) brightness(0.45)`, radius 999 px |
| Options tier | 508×40 px | same glass, radius 999 px |
| Text selection bar | 250×36 px | same glass, radius 10 px, 12 px labels |
| Document menu | 240×764 px, 21 items + 5 headers, 28 px rows | `rgb(40 43 50 / 0.8)`, `blur(32px) saturate(1.6) brightness(0.5)`, radius 6 px |
| Dialogs (shortcuts) | 760×640 px | solid `#181a1f`, radius 10 px, no glass |
| Document tabs | 26 px high, 152 px wide (110 px at 390) | below a 44 px touch target |
| Rail items | 56×48 px | |
| Shell width at 390 px | `scrollWidth` 465 px in Read, 594 px with the inspector | 75 and 204 px of sideways scroll; the mode switch starts at x = 239 |
| Focus after `?` opens the shortcuts | the dialog element (`role=dialog`) | hence the 2 px accent ring round the whole dialog |

## 3. Screenshots

| File | Surface | Size | What is visibly weak or dated |
|---|---|---|---|
| [01-home-empty-1440](01-home-empty-1440.png) | Home, no file | 1440×900 | A 440 px card centred in a 1376×832 near-black field. Generic file glyph, no product name. A 4-line grey paragraph explains combining before any file is open. The rail shows Pages, Find, Review and Files, which do nothing without a file. Status bar says "0 files". |
| [01-home-empty-820](01-home-empty-820.png) | Home, no file | 820×1180 | Desktop layout unchanged on a touch tablet. Ctrl O, Ctrl K and ? keycaps and a keyboard icon on a touch device. Search field cut to "Search comm…". |
| [01-home-empty-390](01-home-empty-390.png) | Home, no file | 390×844 | Rail takes 64 px (16 %). The paragraph wraps to 7 lines in a 276 px card. Keycaps on a phone. |
| [02-home-files-1440](02-home-files-1440.png) | Home, 3 files and Recents | 1440×900 | Cards start at x = 136 while Recent is a centred 440 px column: two alignment axes. All three cards selected (accent rings) at rest. Four equal-weight buttons, "Close" next to "Combine". About 60 % of the field is empty. Focus ring left on the "+" tab button after a tab closed. "Open again…" in italics. |
| [02-home-files-1280](02-home-files-1280.png) | Home, 3 files and Recents | 1280×800 | Same as 1440; nothing grows to use the width. |
| [02-home-files-820](02-home-files-820.png) | Home, 3 files and Recents | 820×1180 | Tab titles cut to "demo-…". Close × always visible on touch. Focus ring on "+". |
| [02-home-files-390](02-home-files-390.png) | Home, 3 files and Recents | 390×844 | Tab strip empty, only "+". Buttons wrap to two rows. One 194 px card per row with about 65 px dead margins; the third card is cut by the status bar. |
| [03-read-1440](03-read-1440.png) | Read | 1440×900 | Three chrome strips (title bar, mode-switch row, status bar). "Pages" said three times (rail, panel label, sub-tab). Page at 130 % with 48 px side margins runs off the bottom. The only glass is the 76 px Edit pill. Flat grey frame. |
| [03-read-1280](03-read-1280.png) | Read | 1280×800 | Fit width 110 %. The Edit pill sits on a table row ("celebration"). |
| [03-read-820](03-read-820.png) | Read | 820×1180 | Rail and navigator take 312 px (38 %). Page 410 px wide at 52 %. |
| [03-read-390](03-read-390.png) | Read | 390×844 | Broken. Page area 77 px wide, page a sliver at 25 %. Mode switch clipped under the layout buttons ("R"). Tab title shows one letter. Edit pill half off-screen. Status text cut ("No external"). |
| [04-edit-write-1440](04-edit-write-1440.png) | Edit, Write group, options tier | 1440×900 | Tier (508 px) wider than the bar and offset to the left: two stacked pills on different axes. Glass is mid grey over the white page. Icon-only tools. Tier and bar cover a table row. |
| [04-edit-write-1280](04-edit-write-1280.png) | Edit, Write group, options tier, inspector open | 1280×800 | The tier holds 2 swatches; red and green wrap below it onto the Write chip. The same Rectangle style shows twice (tier and inspector Properties). |
| [04-edit-write-820](04-edit-write-820.png) | Edit, Write group, options tier | 820×1180 | Same swatch wrap under the tier. Tier covers the page's text. |
| [04-edit-write-390](04-edit-write-390.png) | Edit, Write group, options tier | 390×844 | Bar cut at the right edge: eraser, lasso and shapes unreachable. Tier reduced to one swatch in a small capsule. |
| [05-edit-text-1440](05-edit-text-1440.png) | Edit, Text group | 1440×900 | Four icon-only tools. The Edit text glyph (an I-beam in a box) does not explain itself. Armed state is an accent disc. |
| [06-edit-fill-1440](06-edit-fill-1440.png) | Edit, Fill & sign group | 1440×900 | Five icon-only tools whose 16 px glyphs (field, add field, signature, stamp, certificate) look alike. |
| [06-edit-fill-820](06-edit-fill-820.png) | Edit, Fill & sign group | 820×1180 | Fits; same icon-only row. |
| [07-edit-redact-1440](07-edit-redact-1440.png) | Edit, Redact group | 1440×900 | Four icons, one dimmed with no visible reason. Nothing on screen says what redaction will do. |
| [08-selection-bar-1440](08-selection-bar-1440.png) | Read, text selection bar | 1440×900 | 10 px radius and 12 px labels: a third shape beside the pill bars and 6 px menus. Reads well over the navy cover. |
| [08-selection-bar-820](08-selection-bar-820.png) | Read, text selection bar | 820×1180 | The bar covers the line above the selection (the club name). |
| [09-page-menu-1440](09-page-menu-1440.png) | Page context menu, Edit | 1440×900 | Translucent menu over a white page: the paragraph behind ghosts through its top rows. 28 px rows. No header naming the page. |
| [10-annotation-selected-1440](10-annotation-selected-1440.png) | Selected rectangle and its bar | 1440×900 | One 660 px row holds a label, 9 swatches, two sliders, comment and delete, over the paragraph. The tool bar fades to 20 % but stays as a ghost over page text. |
| [11-lasso-1440](11-lasso-1440.png) | Lasso selection and its bar | 1440×900 | The 8th swatch wraps out of the bar and hangs below its edge. Ghost tool bar again. The bar covers the heading. |
| [12-arrange-1440](12-arrange-1440.png) | Arrange, two documents | 1440×900 | The navigator repeats the thumbnails the light table shows. Six columns leave a 130 px right gutter. Stray hover icons beside page 7. Status zoom "130 %" means nothing here. Layout buttons vanish; the mode switch changes width between views. |
| [12-arrange-1280](12-arrange-1280.png) | Arrange, two documents | 1280×800 | Five columns; same duplication. |
| [12-arrange-820](12-arrange-820.png) | Arrange, two documents | 820×1180 | Two columns because the navigator stays; its thumbnails are as large as the light-table cards. |
| [12-arrange-390](12-arrange-390.png) | Arrange, two documents | 390×844 | One cut column in a 77 px page area. |
| [13-compare-1440](13-compare-1440.png) | Compare, side by side | 1440×900 | A fifth rail item appears. The changes list is dense quoted text with "~" markers. Eleven tiny "= / ~" squares serve as a page map. A third floating-bar style. Zoom shown twice (bar 65 % and status 65 %). The bar covers the page bottom. |
| [13-compare-1280](13-compare-1280.png) | Compare, side by side | 1280×800 | As 1440, at 55 %. |
| [13-compare-820](13-compare-820.png) | Compare, side by side | 820×1180 | The Compare bar is wider than the stage: next, previous and refresh are clipped. Pages at 26 %. |
| [13-compare-390](13-compare-390.png) | Compare, side by side | 390×844 | The changes panel fills the screen; the comparison is a sliver. |
| [14-find-1440](14-find-1440.png) | Find panel | 1440×900 | Aa and ab toggles about 20 px. Hit highlight faint on the navy page. Uppercase "PAGE I (1)" group labels. The privacy pill in the status bar stays highlighted. |
| [14-find-820](14-find-820.png) | Find panel | 820×1180 | As 1440; page 410 px. |
| [15-review-1440](15-review-1440.png) | Review panel, empty | 1440×900 | Text-only empty state, an "All 0" chip alone, 248 px of empty panel. |
| [16-files-panel-1440](16-files-panel-1440.png) | Files panel | 1440×900 | Native checkboxes. "Show Home" is the only underlined, link-styled action in the app. Primary button small and left-aligned. |
| [17-inspector-1440](17-inspector-1440.png) | Inspector open | 1440×900 | Two of four sections are placeholders ("Nothing selected", "No properties"). History lists file opens and closes with times. Opening it re-zooms the page from 130 % to 95 %. Chrome now 593 px (41 %). The Edit pill sits on a text line. |
| [17-inspector-1280](17-inspector-1280.png) | Inspector open | 1280×800 | Page at 74 %, 590 px wide. Chrome 46 %. |
| [17-inspector-820](17-inspector-820.png) | Inspector open | 820×1180 | Broken. Page area about 228 px; the layout buttons are drawn over the mode switch; page at 25 %; chrome 72 %. |
| [17-inspector-390](17-inspector-390.png) | Inspector open | 390×844 | Broken. Shell 594 px wide, scrolled sideways; rail and navigator off-screen; inspector 70 % of the width. |
| [18-document-menu-1440](18-document-menu-1440.png) | Document menu | 1440×900 | 764 px tall (85 % of the window), 21 items under 5 uppercase headers, no icons, every label ends in "…". Mixes document tasks with Appearance and About. Layout buttons and cover art ghost through its edge. |
| [18-document-menu-820](18-document-menu-820.png) | Document menu | 820×1180 | Covers the mode switch; cover art shows through. |
| [18-document-menu-390](18-document-menu-390.png) | Document menu | 390×844 | Fits at 240 px; reaches the status bar. |
| [19-appearance-submenu-1440](19-appearance-submenu-1440.png) | Appearance submenu | 1440×900 | App settings (Glass panels, Reduce transparency, Pen draws in Edit) sit two levels inside the Document menu. Empty square checkboxes. The submenu flips left. |
| [20-palette-1440](20-palette-1440.png) | Command palette, empty query | 1440×900 | 600 px, flat grey over a 50 % scrim. No icons. "Clear recents" is the second row. "About Recto" and "About this app" both listed. No recent or suggested commands. |
| [20-palette-1280](20-palette-1280.png) | Command palette, "merge" | 1280×800 | Top hit is "Export document…"; "Show all documents in Arrange" with scattered per-letter highlights; the two Merge commands rank 3rd and 4th. Page text ghosts through the panel. |
| [20-palette-820](20-palette-820.png) | Command palette | 820×1180 | Navigator thumbnails show through the left third as lighter blocks. Keycaps on touch. |
| [20-palette-390](20-palette-390.png) | Command palette | 390×844 | View scrolled sideways about 13 px; the palette runs past the right edge. |
| [21-shortcuts-1440](21-shortcuts-1440.png) | Keyboard shortcuts | 1440×900 | A 2 px accent ring round the whole 760×640 dialog (focus lands on the dialog element). Rows carry documentation-style sub-lines. Rows with no key (Clear recents, two Abouts, Close document). |
| [22-export-1440](22-export-1440.png) | Export dialog | 1440×900 | Scrolls inside: content is cut above the footer. Native checkboxes. Uppercase section labels. Every option has a grey sub-line. No preview or size estimate. |
| [22-export-1280](22-export-1280.png) | Export dialog | 1280×800 | Same. |
| [22-export-820](22-export-820.png) | Export dialog | 820×1180 | Desktop modal unchanged. |
| [22-export-390](22-export-390.png) | Export dialog | 390×844 | Meets the right edge with no margin; sideways scroll. |
| [23-combine-1440](23-combine-1440.png) | Combine dialog | 1440×900 | Text rows with ↑ and ↓ buttons; no thumbnails, no drag handle. It covers the cards it is about. |
| [23-combine-390](23-combine-390.png) | Combine dialog | 390×844 | Fits (358 px). Reorder arrows are about 24 px targets. |
| [24-document-info-1440](24-document-info-1440.png) | Document info | 1440×900 | 400 px sheet with a scrim over everything, title bar included. The focused Title field shows its end ("rbourlight…"); Creator is clipped. A dense form: 7 fields, custom keys, password. |
| [25-page-numbers-1440](25-page-numbers-1440.png) | Page numbers | 1440×900 | Non-modal panel overlapping the layout buttons. It says "Previewed on the pages", but the page footer is off-screen at 130 %, so no preview is visible. Native select, checkboxes and colour input; pt fields. |
| [26-signature-1440](26-signature-1440.png) | Signature dialog | 1440×900 | Opens with a yellow-outlined disclaimer. A stark white 470×170 pad with no signing line or hint. Grey disabled "Use signature". Focus ring on ×. |
| [27-about-1440](27-about-1440.png) | About dialog | 1440×900 | Generic file glyph, "Recto" and a "Public beta" pill; monospace version rows; accent ring round the dialog. No logo or wordmark. |
| [28-privacy-1440](28-privacy-1440.png) | Privacy popover | 1440×900 | About 20 lines of engineering copy (resource timing, CSP, `connect-src 'self'`). Navigator thumbnails ghost through its left half. |
| [29-toast-1440](29-toast-1440.png) | Toast after Combine | 1440×900 | A 230 px toast at the bottom left over the navigator, far from the Combine button (top right). Underlined "Undo". The new tab's title is truncated. |
| [30-glass-panels-1440](30-glass-panels-1440.png) | Read, Glass panels on, scrolled, inspector open | 1440×900 | The frame changes only where the page passes: the title-bar and status-bar strips over the page turn mid grey while the rest stays dark, a two-tone frame that reads as a rendering fault. No visible blur. The heading is cut by the title bar. |
| [31-home-light-1440](31-home-light-1440.png) | Home, OS light scheme | 1440×900 | Identical to dark: no light theme. Document colour dots differ from 02 (colours follow open order). |
| [32-read-light-1440](32-read-light-1440.png) | Read, OS light scheme | 1440×900 | Identical to dark. The Edit pill covers table text. |
| [33-edit-light-1440](33-edit-light-1440.png) | Edit, Write, OS light scheme | 1440×900 | Identical to dark. |
| [34-about-page-1440](34-about-page-1440.png) | /about/ page | 1440×900 | Generic glyph. Left-aligned 3-line headline with the right half empty. The hero media box is empty here (media are added by the deploy workflow). No imagery. |
| [34-about-page-390](34-about-page-390.png) | /about/ page | 390×844 | Responsive and readable. The video shows native controls at 0:00 (no media locally). |
| [35-compare-setup-1440](35-compare-setup-1440.png) | Compare setup | 1440×900 | A form card with native selects and radios, a dashed drop zone and a yellow-outlined note, beside a "No comparison yet" panel. |
| [36-edit-groups-1440](36-edit-groups-1440.png) | Edit, group row | 1440×900 | Five labelled groups, Select pressed. Grey slab over the white page. "Edit" is also shown in the mode switch above. |
| [37-read-scrolled-1440](37-read-scrolled-1440.png) | Read, scrolled, Glass panels off | 1440×900 | The page slides under solid dark capsules (mode switch, layout buttons). 16 px black gaps between pages. Status reads "Page 1 (3 of 10)". |

## 4. The ten most important visual problems

Ranked by how much of the product they touch.

1. **No tablet or phone layout.** No breakpoint collapses the rail, navigator or inspector.
   At 390 px the page area is 77 px and the page renders at 25 % (03-390, 12-390, 13-390);
   the shell scrolls sideways by 75 to 204 px (17-390, 20-390, 22-390). At 820 px with the
   inspector open, chrome is 72 % of the width (17-820).
2. **No brand.** The app glyph is the generic lucide file icon (01, 27, 34). "Recto" appears
   only in the About dialog and on the about page. The empty Home does not say what the app
   is or does in one look.
3. **Glass that reads as grey slabs and ghosting.** Over a white page the bar is mid grey
   (04, 36, 10); over the canvas it looks solid. Menus, the palette and the privacy popover
   let content behind them show through as faint text and lighter blocks (09, 18, 20-1280,
   20-820, 28): lower legibility without depth. Glass panels makes a two-tone frame (30).
   Dialogs, the largest surfaces, are not glass at all.
4. **Floating chrome covers the content at rest.** The Read Edit pill and the Edit bar sit on
   body text at the bottom of the view (03-1280, 17, 32, 37). During a selection the bar fades
   to 20 % but stays as a ghost over the text (10, 11).
5. **Bars overflow their capsules.** Swatches wrap out of the tier and the lasso bar (11,
   04-1280, 04-820); the Edit bar is cut at 390 (04-390); the Compare bar is clipped at 820
   (13-820). The tier is wider than the bar it belongs to and off its axis (04-1440).
6. **Flat, monotone hierarchy.** One 13 px size, grey on near-black, uppercase 11 px labels
   on every panel and dialog section, one accent. Home with files is three small cards in a
   black field with about 60 % empty (02); the empty Home is a 440 px card in a 1376×832 void
   (01). Nothing feels rich or lit.
7. **Duplicated controls and labels.** "Pages" three times (03); the same thumbnails in the
   navigator and the light table (12); zoom twice in Compare (13); Edit in the mode switch and
   again as the group bar (36); the tool style in the tier and the inspector at once
   (04-1280); "About Recto" and "About this app" (20, 21).
8. **The Document menu is a 764 px junk drawer.** 21 text-only items under 5 headers, each
   ending in "…", mixing document tasks with app settings and About (18, 19). Settings have
   no home of their own.
9. **Forms look like web forms.** Native selects, checkboxes, radios and colour inputs (16,
   22, 25, 35); a grey explanatory sub-line under nearly every option; dialogs that scroll
   inside (22); about 20 lines of engineering copy in the privacy popover (28). Three
   different secondary surfaces: centred modal (22), side sheet with a full scrim (24) and a
   non-modal panel overlapping controls (25).
10. **Inconsistent shapes and stray states.** Pill bars, a 10 px selection bar and 6 px menus
    and mode switch; a 2 px accent ring round whole dialogs after a keyboard open (21, 27); a
    focus ring left on "+" after a tab closes (02); every Home card selected at rest (02);
    stray hover icons in Arrange (12); two of four inspector sections empty (17).

## 5. What breaks at tablet width (820×1180, touch)

- The desktop layout is used unchanged: rail and navigator take 312 px (38 %) and the page
  renders at 52 % (03-820).
- Inspector open: the page area is about 228 px, the layout buttons are drawn over the mode
  switch, the page is at 25 % and chrome is 72 % of the width (17-820).
- Tab titles are cut to "demo-…" (02-820). Tabs are 26 px high, menu rows 28 px: under a 44 px
  touch target.
- The Compare bar is wider than the stage: next, previous and refresh are clipped (13-820).
- The options tier wraps swatches under itself onto the bar (04-820).
- Arrange shows two columns because the navigator stays, and the navigator's thumbnails are as
  large as the light-table cards (12-820).
- Keyboard hints on a touch device: Ctrl K in the search field, Ctrl O, Ctrl K and ? in the
  empty card, keycaps in palette rows, a keyboard icon in the rail (01-820, 20-820).
- The selection bar covers the line above the selection (08-820).

## 6. What breaks at phone width (390×844, touch)

- Every document view has a 77 px page area; the page renders at 25 % (03-390). Arrange is one
  cut column (12-390). Compare is the changes panel and a sliver (13-390).
- The shell is wider than the screen: `scrollWidth` 465 px in Read because the 226 px mode
  switch starts at x = 239, and 594 px with the inspector (17-390). The palette and the Export
  dialog run past the right edge (20-390, 22-390); the shortcuts dialog's right edge is at
  412 px.
- Tabs disappear: one letter in Read, none on Home (02-390, 03-390).
- The mode switch is clipped under the layout buttons (03-390).
- The Edit bar is cut at the right edge, so eraser, lasso and shapes cannot be reached; the
  tier shrinks to one swatch (04-390).
- The text selection bar was created but is not visible: the selection happens in the 77 px
  sliver. That frame matched 03-390 and was dropped; so was Find at 390 (the panel fills the
  navigator, as in 14-820, beside the same sliver).
- Home buttons wrap to two rows; one 194 px card per row with about 65 px dead margins
  (02-390). The status bar text is cut ("No external").
- What works: the Combine dialog (358 px, 23-390, though its reorder arrows are about 24 px
  targets) and the separate about page (34-390).

## 7. Not captured

- **Motion.** None of it: the bar morph between groups (160 ms), the tier, the 20 % fade
  during a stroke, menus, the palette, toasts and dialog entrances. A video pass is needed
  to judge "flows like butter".
- **Light theme.** None ships (`tokens.css`: "Only the dark theme ships in v1"). 31 to 33 were
  taken with `prefers-color-scheme: light` and match the dark frames.
- **About page media.** The deploy workflow records them into `media/`; they are not in a
  local build, so the hero frames are empty here. The live site has them.
- **The pen's own options tier.** It opens only after a pen with pressure has been seen; the
  Rectangle's tier stands in for it.
- **Outside the brief's list:** the drag-over state of Home, the paragraph editor, form
  creation, OCR, redaction apply, Batch, password, crop and split dialogs, tooltips, hover
  states and the Turkish UI.
