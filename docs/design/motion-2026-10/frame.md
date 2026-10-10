# Motion sprint R14: the frame lane

The choreography of the frame: the sidebar, the command palette, Find, the page pill, Save,
undo and redo, the tabs and "Hide markup". Everything runs on the motion core (`src/motion/`)
and the tokens in `styles/motion.css`. Moves are by transform (or the individual `translate` and
`scale` properties) and opacity. Every motion can be interrupted and leaves nothing inline at
rest. Under reduced motion, only opacity changes, in 150 ms or less (A-9).

The shared "emerge from the trigger" transform for popovers, menus and sheets belongs to the
platform lane. The page pill's menu and the title menu inherit it, and this lane does not
duplicate it.

## 1. Sidebar

| What | How | Token |
|---|---|---|
| Open | The panel slides in from the leading edge (`translateX(-(width + inset))` → 0). | `smooth` |
| Content parallax | The content starts 12 px behind the panel and fades in. | `glide` (it arrives a beat later), opacity `smooth` |
| Close | The panel slides back out and its content fades. The panel stays drawn while it leaves: `inert`, `aria-hidden`, no `id`, no `data-region` and no `data-frame-layer`. It unmounts when the slide ends. | `smooth`, opacity `quick` |
| Canvas reflow | `frame/frame-reflow.ts`. See below. | `smooth` as a `linear()` curve |
| ▤ morph | Phosphor's sidebar-simple, drawn inline. Its leading pane fills from its edge (`scaleX` 0 → 1 on the pane's own box) and empties on close. | `--spring-smooth`, opacity `--duration-fast` |

- **How the reflow works.** The free rectangle's `--free-left` changes at once, and the Read
  view re-lays the pages out in the same frame. A fit-width page changes size as well
  (1344 → 1064 px at 1440 × 900). `captureReflow()` reads the reference page and the band's
  pieces in the sidebar's layout effect, before the free rectangle is written.
  `whenStageResized()` plays the FLIP in the stage's first `ResizeObserver` callback, which
  comes after the new layout and before paint, so no frame of the jump is ever drawn. The Read
  view's content is moved and scaled by `translate` and `scale` about the page's new centre.
  The dock and the pill only move, because glass never scales (Q-6). The trailing pill does not
  move, so it is left alone.
- **Interruption.** A reversal mid-flight retargets the slide from its drawn position and
  velocity. A reflow that starts while another runs reads the drawn boxes, cancels the running
  one and starts from there.
- **No slide** happens when the sidebar mounts together with its document (a restored session),
  when the user leaves for the Library or the grid, or when its form changes (docked or
  overlay).
- `frame-insets.ts` now also re-measures when a `data-frame-layer` attribute changes. This lets
  a leaving sidebar give its inset back on the first frame.
- Before: the panel and the canvas cut in a single frame.

## 2. Command palette (⌘K)

- **Popup.** It opens from `scale(var(--enter-scale))` with `transform-origin: 50% 0`, on
  `--spring-quick`, with the entry fade on `--duration-base`. It closes toward
  `--exit-scale` on `--duration-fast` `--ease-exit`. Before this change it rose 4 px on a 120 ms
  ease.
- **Scrim.** The scrim dims only and its opacity fades it in and out. A first cut gave it a
  fixed `backdrop-filter: blur(6px)`; the QA run removed it, since scrims are dim only (G-31)
  and the blur made a fifth glass surface at rest (Q-11, `glass-rest.spec.ts`).
- **Rows.** The first six rows (and their group headings) come in 20 ms apart
  (`--row-index` ≤ 5). The step is a third of `--duration-instant`, so it is 0 under reduced
  motion. Each rises `--rise-distance` with a `--duration-base` fade. Rows past the
  sixth come in with the sixth.
- **Selection pill.** The selected row draws a `.fill`. When the selection moves, the new fill
  starts at the last fill's drawn offset, carries its velocity, and springs home on `quick`
  (`usePaletteFill`). This works for keys and hover alike.

## 3. Find

- **Field morph.** The trailing piece's `springWidth()` (`smooth`) was already correct in both
  directions (strips at 1180 × 820). The only flaw was that the growing edge cut through the
  placeholder one letter at a time. The well's contents now fade in on `--duration-slow`, 60 ms
  behind the edge (`TopStrip.module.css`).
- **Eased step.** The viewer lane owns reader scrolling. Its `ScrollRequest.motion` (`'jump' |
  'step' | 'instant'`, `viewer/jump.ts`, `viewer/landing.ts`) animates Find's steps and waits
  for the scroll to land before ringing the hit. This lane's own glide (`viewer/eased-scroll.ts`
  and its `ReadView.showPage` wiring) was removed in favour of it.
- **Hit pulse.** `revealHit()` pulses the hit once its ring has started (`revealWhenShown`
  resolves with the flash), so the pulse never depends on how the scroll lands and needs no
  change to `ReadView`. The pulse is `scale` 1 → 1.18 → 1 in `--spring-pop`'s 410 ms: out on
  `--ease-out`, home on the spring curve. There is no pulse under reduced motion; the still
  ring stays. Once the viewer lane's landing wait merges, the ring (and so the pulse) comes
  after the step has landed.

## 4. Page pill

- **Odometer.** `pillParts()` formats the message with private-use marks in place of the page
  and the percentage, so each locale keeps its own order. `PillRoll.tsx` renders the page as
  tabular cells. Only the cells that changed roll: the old character goes out up and the new
  one comes in from below, on `--spring-quick`. When the number falls, the direction reverses.
  The outgoing text is removed on its fade's `animationend`, so the pill's text content is never
  stale.
- **Zoom.** The percentage cross-fades in one cell: the old value fades out on
  `--duration-fast`, the new one fades in on `--duration-base`.
- **Menu.** It grows from the pill through the shared popup transform (platform lane).
- Reduced motion: the roll distance is 0, so the cells cross-fade.

## 5. Save

- **Saving.** A light band sweeps across the capsule once per `--loop-sweep`, under the
  processing ring. It is drawn in `--accent-ring` at 22 %, by transform, and clipped to the
  capsule. It is not shown under reduced motion or on Glass Solid.
- **Label changes overlap.** Every label stays in the cell. The one shown fades in on
  `--duration-base` while the one leaving fades out on `--duration-fast` `--ease-exit` and only
  then turns hidden, so the button is never blank between "Saving" and "Saved". Before, the old
  label went at once and the new one faded in from 0, which left one blank frame. Labels not
  shown are `aria-hidden`, so the accessible name changes on the first frame.
- **Saved.** "Saved" and "Saved ✓" are one label, so the word never cross-fades with itself. The
  check hangs after the word, and the pair is centred by a half-check shift. The check draws in
  from its leading end (`clip-path` inset on `--spring-quick`) with the existing pop, 60 ms
  (`--duration-instant`) after the label. It holds for `CHECK_HOLD_MS` (1600 ms). Then it fades
  and the word slides back to the centre on `--spring-quick`. A hidden "Saved ✓" reserves the
  cell's width, so the button never resizes.
- **Receipt toast.** A new `origin` option on toasts (`ui/Toast`) takes an element id. The
  toast starts a twentieth of the way toward that control (at most 32 px) as it rises, so the
  receipt comes from Save's side. `files/save.ts` passes `save-button` for all three receipts.
- Strip (fake file handle, 2.5 s write): Save → 0 % with the sweep → 95 % → Saved ✓ with the
  bloom → Saved.

## 6. Undo and redo: `pdf-editor:history-applied`

The existing glyph nudge stays. In addition, the affected object flashes once the step has been
brought into view.

```ts
window.addEventListener('pdf-editor:history-applied', (event) => {
  const { direction, documentId, kind, pageIds, annotationIds } = event.detail;
  // Draw your own flash on what you render, then take the default one over:
  event.preventDefault();
});
```

- **Module:** `history/history-applied.ts`. The `WindowEventMap` entry gives listeners the type.
- **When it fires:** once per ↶, ↷ or kept scrubber jump in the active document, after the page
  is laid out and the scroll has landed (`reveal.ts`). It never fires for the scrubber's live
  preview or for a step in another document.
- **Detail:** `direction` is `undo` or `redo`. `pageIds` lists the revealed page first, then
  every page that came, went or changed. `annotationIds` lists the annotations of the engine
  edits that one workspace has and the other has not, strokes included. The ids are the ones
  the DOM carries (`data-page-id`, `data-annotation-id`). A removed object is listed even though
  it is no longer on the page.
- **Cancelable.** Without `preventDefault()`, `flashChanged()` runs. It puts a tint in
  `--select` (22 %, with a 2 px ring) over each listed annotation found on the page, following
  the undo reveal's 80 / 160 / 260 ms. With no annotation found, it rings the page as before.
  The flash is opacity only and is removed at its end.
- **Canvas lanes** (ink, pages, forms): subscribe when your layer can draw a better flash, such
  as a stroke's own path or a grid cell, and call `preventDefault()`. Read `reducedMotion()`
  yourself.

## 7. Tabs

- **Closing the active tab.** This already worked through `useTabMotion`: the new fill starts
  where the closed tab's fill rested and rides its neighbour as the closed tab collapses. Strips
  show a continuous slide, so nothing changed here.
- **Drag to reorder** (`tab-reorder.ts`, new). Tabs were already pragmatic-drag-and-drop
  draggables (dragged onto the grid).
  - The drag preview is now a lifted copy: `--surface-raised` with `--e3`, held at the grab
    offset.
  - The tab's slot stays as a place-holder at 35 % opacity.
  - While the pointer is over the tab list, the place-holder travels to the landing slot and
    the tabs in between slide aside by its width. They move by the `translate` property with a
    `--spring-smooth` transition, which retargets.
  - On a drop on the list, `reorderDocuments()` runs and every tab FLIPs from its drawn box
    (`flip()`, `smooth`). The move is announced as the tab menu announces it.
  - Off the list, everything slides back. A drop on the grid behaves as before.
  - A tab's name fades in once (`tab-name-in`) and is then marked `data-in`. Moving the tab in
    the DOM restarted that fade, which left only the dot showing for a frame after a drop.

## 8. "Hide markup"

`PageCanvas.crossFade()` copies the shown pixels to a still canvas laid over the page and draws
the bare (or full) bitmap beneath it. The copy then fades out on `--duration-slow`
(`--ease-standard`), which is 150 ms under reduced motion. The page text is identical in both
bitmaps, so there is no double drawing; only the marks fade. Tiled, deep-zoom pages
(`TiledPage`) still swap at once. That is left for the viewer lane.

## Checks

- Format, lint and typecheck are clean.
- Focused unit tests: `PagePill`, `SaveButton`, `ui/Toast`, `sidebar/*`, `frame-insets`,
  `glass-frame`, `AppShell`, `history/*` (including the new `history-applied.test.ts`),
  `tab-motion`, `tab-reorder` (new), `viewer/search`, `PageCanvas` and `command-acts`.
- Frame strips at 1440 × 900 and 1180 × 820 touch are in the session scratchpad
  (`r14/frame/shots/*-sheet.png`).

## Left

- Tab drag reorder was checked with a mouse only. On touch, a long press still opens the tab
  menu, as before.
- The hit pulse and the tint flash are generic. Canvas lanes may replace them through the event.
- Deep-zoom tiles still swap at once on "Hide markup".
- TODO (after the viewer lane's `ScrollRequest.motion` reaches develop): `history/reveal.ts`
  should pass `motion: 'step'` to `scrollToPage()` so the undo reveal glides like a Find step.
