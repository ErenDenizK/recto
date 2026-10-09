# Viewer lane: reading and navigating (R14 motion sprint)

Owner goal for R14: reading should feel smooth and spatial. Every jump shows where it went, zoom
grows about where you look, bitmaps arrive without a cut, and nothing stays animated at rest.
Everything below uses the motion core (`src/motion/`) and the tokens in `styles/motion.css`. It
moves only transform and opacity, picks up from where it is when interrupted, and leaves no
transform or `will-change` behind at rest. Under reduced motion only opacity changes, for 150 ms
at most (A-9).

## 1. Jumps (`viewer/jump.ts`, `viewer/landing.ts`, `stage/ReadView.tsx`)

**Before:** Go to page, outline entries, links, find hits, thumbnails and PageUp/PageDown/Space
cut straight to the target. **After:**

| Distance | Motion | Timing |
|---|---|---|
| Up to 3 screens | Scroll on an ease-out cubic (`--ease-out`'s shape). Its duration grows with distance: `200 + 125·log2(1 + screens)` ms. | 200 ms for a hop, 325 ms for one screen, capped at 450 ms |
| Over 3 screens | Fade-through: the page column fades out on `--duration-fast` `--ease-exit`. The view then lands half a screen short of the target, on the side it came from, and glides the rest while the column fades back in on `--duration-base` `--ease-out`. | about 120 + 275 ms |

- **Retarget:** a new jump continues from where the scroll is and keeps its velocity (a
  Hermite-style velocity term in `jumpAt`). PageDown pressed while a step is still moving starts
  from where that step is heading, so steps add up.
- **Cancel:** a wheel, a touch, a press or an arrow key stops the jump where it is. A fade in
  progress snaps back to opaque.
- **Landing highlight:** after landing, a soft ring in the page's selection blue appears around
  the page, or around the revealed region (an outline or link destination, a review row). It
  fades in over 120 ms, holds 260 ms and fades out over 280 ms, then the element is removed.
  Under reduced motion it holds still and is then removed, like the undo reveal's ring.
- **`ScrollRequest.motion`** (`state/view-store.ts`, an additive field) says how each request
  moves:
  - `jump`, the default, animates and highlights the landing.
  - `step` animates without the highlight. It is used for `[`/`]`, the thumbnail list's arrow
    keys, the scrubber's keys, and find hits. A find hit flashes its own ring, so the search
    now waits for the jump to land (`afterJump()`) before ringing it.
  - `instant` lands at once. It is used for a scrubber drag, a page view that is mounted but not
    shown yet, and the first 300 ms after mount (the view change from the Pages grid).
- **Landing prefetch** (`viewer/jump-prefetch.ts`): when a jump covers more than one screen, it
  asks for the target page at the exact scale its canvas will want, and for the pages on either
  side at a quarter of that scale. Requests go in at the render queue's `page` priority, and a
  newer jump aborts an older jump's requests. The canvas then finds a cached bitmap when it
  mounts.

  Measured on `many-pages.pdf` (400 pages) at 1440×900 in Chromium, Go to page 150, 300, 60
  and 380, three runs each (12 jumps):

  | | White frames during the glide | Target page shows content |
  |---|---|---|
  | Before | 70 of 407 frames (17 %) | about 470 ms after Enter (median, range 333–618) |
  | After | 0 of 407 | about 280 ms after Enter (range 258–331) |

  A white frame is one where a page in the viewport still shows a placeholder while the page
  column is more than 30 % opaque.
- **Layout change mid-jump:** if the zoom changes while a jump is in flight (a panel opens and
  the fit follows the new free rectangle), the jump lands at once on the new layout rather than
  stopping halfway. Found by `viewer.spec` (a find step followed at once by opening the Find
  section).
- **Single-page layout:** the incoming page uses the catalogue's *sheet push* (24 px plus a
  fade on `smooth`) from the side it lies on.

## 2. Zoom (`stage/ReadView.tsx`, `viewer/space-pan.ts`)

- **Pinch, trackpad pinch, Mod+wheel notch, touch double tap:** unchanged. These already run on
  the zoom controller's springs (`fling`, `quick`, `glide`) about the fingers or the pointer.
- **Zoom morph (new):** zoom keys (Mod+= / Mod+−), the pill's zoom buttons, and choosing Fit
  width or Fit page used to jump. Now the new zoom is laid out first, and the column, shown at
  the old size about the anchor (the viewport centre, or its top while fitting), then scales
  into place on `--spring-quick`.
  - It runs on the transform only, under the canvas zoom's existing clip (`data-zooming`), so
    the scroll extent never changes mid-flight.
  - Extra rows are rendered while zooming in, so a shrunk column still covers the viewport.
  - A second key press while it runs starts from the size currently on screen.
  - Skipped for a gesture's own commit, a fit that follows a window or panel resize, a view
    that is not shown yet, and reduced motion.
- **Double click:** there is no mouse double-click zoom; double-click selects a word. The touch
  double tap (fit width ⇄ 250 %) already animates on `glide`.
- **Fling:** native scrolling already coasts on touch and trackpad. A Space drag (the hand pan)
  used to stop dead on release. It now keeps the release velocity: projected with 0.998
  (`project()`), it coasts on `glide`. A press or a wheel stops it. Reduced motion: no
  projection. Probe: a 150 px drag in about 160 ms (roughly 940 px/s) coasts another 180 px. The
  scroll position never reverses, and the coast settles within about 500 ms.

## 3. Page render (`pages/paint-fade.ts`, `PageCanvas.tsx`, `TiledPage.tsx`)

- The first bitmap of a page (placeholder to rendered) fades in over the white sheet on
  `--duration-base` `--ease-out`. A cache hit, drawn synchronously, does not fade.
- A sharper render after a zoom draws underneath while a copy of the stretched preview fades
  out above it (`crossFadeFrom`), so the page sharpens with no blink. This happens only when the
  scale changes. New content (fresh ink) still swaps in the same frame, because the dry-ink
  handover needs that (craft §5.3 item 7). No copy is made above 16 MP.
- High-zoom tiles fade in over the capped bitmap.

## 4. Sidebar thumbnails (`shell/sidebar/ThumbnailList.tsx`)

- **Sliding ring:** the current-page ring is now one element (`.currentRing`) that slides
  between thumbnails through `flip()` on `smooth`, resizing along the way between portrait and
  landscape. It still steps aside when the page is selected or its row has keyboard focus
  (`:has()`), and it is hidden while its row is outside the virtual window.
- **Follow scroll:** the list follows the page being read with the same eased jump,
  retargeting as you read on. Its first follow, when the list opens, lands at once. A wheel, a
  touch or a press on the list stops it.

## 5. Text selection (`annotations/ReadSelectionBar.*`, `viewer/copy-pulse.ts`)

- **Selection bar:** it grows out of the selection, from `--enter-scale` about the corner
  nearest the selected line, rising `--rise-distance` away from it. That is a transform on
  `--spring-quick` with a fade on `--duration-base`, via `@starting-style`. When the bar sits
  below the selection, it emerges downward.
- **Copy:** the bar's Copy button or Mod+C pulses the copied lines once: a selection-blue wash
  inside each page, 120 ms in and 280 ms out, or 150 ms in total under reduced motion.
- **Handles:** selection handles are the platform's own (iOS and Android draw them), so there is
  nothing of ours to scale in. If custom handles ever land, they should use *popup* entry
  (`--enter-scale`, `quick`).

## 6. Text edit (`text-edit/edit-motion.ts`, `ParagraphEditor.*`)

- **Entering:** the paragraph's frame, a 1 px selection-blue hairline 3 px out, unfolds from the
  first line to the whole paragraph (scaleY on `smooth`, fade `--duration-fast`). The header
  emerges beside it (the `scale` property on `--spring-quick`, so the left-side `translate`
  stays put).
- **Applying:** what the editor showed (the glyph canvas or the dry run's bitmap) is copied over
  the page until `whenPainted` reports the edited bitmap. Then the copy fades out on
  `--duration-base`, so the old text never flashes back while the page re-renders.

## 7. Compare (`compare/CompareView.tsx`, `compare/compare-motion.ts`)

- **Changing pair:** stepping to a change (the Changes list, the next/previous keys, the page
  map strip) scrolls the single scroll container that holds both pages with the eased jump, so
  A and B slide in sync. Far steps fade through.
- **Change pulse:** on arrival, the row's current change marks (words or areas) pulse once:
  opacity dips to 0.3 and they swell to 1.08, over `--duration-slow` `--ease-standard`. Under
  reduced motion only the opacity dips, in 150 ms.

## 8. Undo and redo (`pdf-editor:history-applied`)

The frame lane dispatches the event once a step is in view, and flashes the changed
annotations or the page by default. This lane adds two things and leaves the default flash
alone:

- the thumbnails of the changed pages (`detail.pageIds`) flash the undo reveal's ring;
- a jump's landing highlight still on screen is cleared, so one step never shows two
  highlights.

## Checks and frame strips

- Unit: `viewer/jump.test.ts` (timing, fade-through, cancel, reduced) and
  `viewer/landing.test.ts` (landing, cross-fade copy, copy pulse ≤ 150 ms reduced). The
  selection-bar and Space-pan tests were updated (the bar is read at rest with `settled()`; a
  pan held still before release does not coast).
- Frame strips (Playwright, fake clock, Web Animations stepped 30–60 ms) at 1440×900 and
  1180×820 touch. Checked: no blank frame, no double drawing, and the column clip holds during
  the zoom morph.
- **Left open:**
  - The Pages-grid door and Library ⇄ document transitions belong to other lanes.
  - The history reveal (`history/reveal.ts`, frame lane) may want to pass `motion: 'step'`,
    since it flashes the page itself.
  - Frame strips added for the single-page slide (`single-desk-next`, `single-desk-prev`) and
    for the Space-pan coast (`coast-desk-fling`, plus the scroll-position probe above).
