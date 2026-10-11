# Phone edition: visual audit (2026-10-11, develop a9c0ee7)

The compact edition was checked at 390×844, 430×932, 360×780, 844×390 and 932×430 (touch,
DPR 3), in both themes, in English and Turkish, with the sample and multi-page fixtures. The
existing `phone` and `phone-land` e2e projects pass: 38 passed, 19 skipped (full-edition-only
specs).

## Defects, ranked

| # | Severity | Defect | Likely cause |
|---|---|---|---|
| 1 | High | **No aura on phones.** The Library and the reader sit on flat `--canvas`, and the first-run Library has an empty black top half. A 600 px tablet does show the aura. This breaks DSN-24. | `shell/compact/CompactApp.module.css:22-29`; nothing in `shell/compact/` mounts `home/Aura.tsx` |
| 2 | Medium | **Find does not scroll to its hit.** Opened mid-document, it reports "2 of 3" but the hit stays off screen. Only ‹ › scroll to a hit. | `CompactChrome.tsx:155-161` and `viewer/search.ts:311-314` choose a current hit but never reveal it |
| 3 | Medium | **The sample teaches editing the phone cannot do** (Highlight, Markup, "click a field", Fill & sign), right under the "reading only" line | `src/sample/`; this goes away once the phone edits (EDN-7) |
| 4 | Low–medium | **A dark 6 px ring around the About, Info and Contents sheets after any key press.** In the light theme it reads as a black seam. | Focus lands on the sheet itself (`CompactSheet.tsx:49`), which takes the global ring from `styles/focus.css:75-81` |
| 5 | Low | **About's Appearance group is off the grid, and its segmented buttons are 40 px tall** (44 is the target). | `CompactSheets.module.css:288-296`, `ui/Segmented.module.css:12` |
| 6 | Low | **The landscape Library's top block takes about 280 of 390 px,** so only one Recent row shows. "Clear" is also larger than its section title. | compact Library layout |
| 7 | Low | **Smaller issues:** the ⋯ button's ring is clipped at the top edge; in the light theme, page text shows strongly through the bottom bar and the Find bar; black stripes show through the ⋯ menu; in mixed-size files, portrait pages draw at about 68 % width; on 600–680 px touch screens (full edition) the tab title truncates to "Rect…". | — |

## Fine

- The right edition is chosen: 599 px and every phone landscape get the compact edition; 600 px
  and up get the full one.
- No sideways overflow and no clipped Turkish text.
- Scrolling hides the bars, a tap brings them back, and pinch zooms.
- Every sheet and the note popover fit.
- No console errors.

## Not testable headless

- **Safe-area insets.** `viewport-fit=cover` is set at runtime (`CompactApp.tsx:41`), so the
  insets need a real iPhone.
- **Native text selection and Copy.**
