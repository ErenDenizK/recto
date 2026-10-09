# Ink: hold to shape, and ink motion polish (R14, ink lane)

Owner request: holding still at the end of a stroke always turned it into a straight line, even
when you had just written something. Now the hold fires only on a stroke that is clearly a deliberate
shape, and it recognises lines, arrows, rectangles, squares, triangles, pentagons, hexagons, circles
and ellipses.

Code: `apps/web/src/annotations/pen/shapes.ts` (recogniser), `shape-hold.ts` (morph, adjust, chip),
`shape-commit.ts` (PDF shapes, undo), `straighten.ts` (hold rule), `ink-input.ts` (wiring),
`erase-fade.ts`, `lasso/Lasso.module.css`, `markup/MarkupPalette.module.css`.

## 1. When a hold counts

| Rule | Value | Where |
| --- | --- | --- |
| Still radius | mouse 3 px, pen 4 px, touch 6 px (CSS px) | `holdRadius` |
| Hold | 500 ms; 800 ms in a writing context | `HOLD_STRAIGHTEN_MS`, `HOLD_WRITING_MS` |
| Writing context | pressed < 600 ms after the previous stroke's release | `WRITING_GAP_MS`, `PenSession.lastStrokeUpAt` |
| Samples | every coalesced event, plus `getPredictedEvents()` points (a pointer about to move is not still) | `ink-input.ts onMove` |
| Press held before moving | never counts | `HoldStill` |

The recogniser runs once, when the hold is due (a timer, never per frame). If it finds nothing, the
stroke stays as written and that hold is spent: the pen has to move and hold again. The ink latency
path is unchanged.

We read "another stroke started within 600 ms" as the previous release falling within 600 ms of this
press. This covers the literal reading too, and it still holds when the previous stroke was long.

## 2. The recogniser (`recognizeShape`)

1. **Resample** the stroke to 128 points evenly spaced along its length (`RESAMPLE`).
2. **Measure:** box diagonal, end gap, turning (±2-point window), curvature reversals (with
   hysteresis: 25° the other way counts as one), counter-turn share (on the stroke simplified by
   RDP at 2 % of the diagonal, so jitter does not count), length over box perimeter, and
   self-crossings outside the closure zone (the first and last 25 %).
3. **Closed loop:** the stroke up to where it comes back nearest its start after 70 % of its
   length, within 25 % of the diagonal. An overshoot may stray at most 10 % of the diagonal from the
   loop; a tail that leaves it, as in an "o" joining the next letter, means writing. The loop must
   turn one lap (between 1.55π and 2.5π). A figure of eight turns about 0 and a spiral turns two laps.
4. **Handwriting gate (closed shapes):** at most 1 reversal (0 when writing), counter-turn at most
   0.2 (0.12 when writing), length over box perimeter at most 1.35, and no crossing outside the
   closure.
5. **Fits:**
   - *Line:* chord/length ≥ 0.94; residual = RMS distance from the least-squares line ÷ chord. The
     drawn line runs from the press to the pointer, as hold to straighten always did.
   - *Arrow:* RDP gives 5 vertices: shaft, barb, tip again, barb. Barbs are 8–60 % of the shaft, at
     12–70° on opposite sides.
   - *Polygon:* closed RDP (ε = 4.5 % of the diagonal) from the start and from the farthest point.
     Vertices turning < 28° or on an edge < 9 % of the perimeter are merged, flattest first. 3–6
     corners only. At least 62 % of all turning must lie within ±4 % of the length of a corner, so
     sharp corners pass and a circle does not. Regularised: 4 corners within 22° of 90° make a
     rectangle (orientation from the circular mean of 4θ, size from the opposite vertex pairs); sides
     within 12 % make a square. Sides with spread < 0.2 and angles within 20° make a regular
     triangle, pentagon or hexagon (centroid, mean radius, mean phase). Otherwise the polygon is kept
     as drawn.
   - *Ellipse:* Halir & Flusser direct least squares on the loop (points centred, unit RMS radius).
     Axes within 0.86 make a circle; minor/major below 0.18 is rejected. Residual = RMS radial
     distance ÷ √(rx·ry).
6. **Score:** fit = residual ÷ limit; a fit passes when fit ≤ 1. Limits: line 0.03, arrow 0.045,
   polygon 0.05 (over the mean box side), ellipse 0.055. In a writing context every limit is × 0.6,
   and the minimum size is × 1.5 (shape diagonal ≥ 32 px → 48 px; line ≥ 24 px → 36 px). Ranking
   adds penalties that never let a fit pass: +0.04 per corner beyond 3, +0.05 for an irregular
   polygon, −0.3 for a square or circle when one applies (what a hand draws nearly square is meant
   square). The best passing fit leads. Fits up to 1.8 × their limit follow as alternatives for the
   chip.
7. **Snapping:** a 45° multiple within 5° (`SNAP_DEG`). Residuals are read before the snap, so a snap
   costs no score. Size and orientation otherwise stay as drawn.

## 3. Preview and commit UX (`shape-hold.ts`)

- **Morph:** the stroke and the shape are each resampled to 96 points (the outline starts nearest the
  stroke's start and runs in the stroke's direction). The points move along the `smooth` spring
  (`animate`), and at rest the exact outline is drawn with sharp corners. The existing 1 px cue (120
  ms) stays. Under reduced motion there is no morph and no cue: the shape appears at once.
- **Adjust while held:** a line's end follows the pointer (snapped). An arrow's tip moves with the
  pointer. A closed shape scales (0.2–5×) and rotates about its centre, measured from the pointer's
  vector at the hold, and its angles snap within 5°.
- **Chip:** a 24 px pill (`ShapeChip.module.css`, `--glass-chip-solid`, n-tier, no accent on the page)
  sits 10 px above the shape's top centre. It fades and scales in on `quick`. A tap on it (a second
  finger while the pen holds, or the mouse within 2.5 s after the release) cycles to the next-best
  fit, for example ellipse → rectangle. It has an aria-label ("Rectangle. Tap for the next shape")
  and EN/TR strings.
- **Release:** the outline is handed over as `InkStrokeInput.points`, with `InkStrokeInput.shape`
  (kind, geometry, raw stroke). Shift still draws the 45° line.

## 4. Commit as real PDF shapes (`shape-commit.ts`)

| Fit | Annotation |
| --- | --- |
| line / arrow | /Line (arrow: `/LE` none / OpenArrow) |
| rectangle or square on the page axes | /Square, /Rect grown by half the width (border drawn inside) |
| circle, ellipse on the axes | /Circle, likewise |
| triangle, pentagon, hexagon, turned rectangle, other polygon | /Polygon |
| turned ellipse (no PDF shape carries it) | Ink of the clean outline, constant width |

**Undo:** the raw stroke is committed as its own Ink (history entry 1), then a second action deletes it
and creates the shape (entry 2, labelled "Rectangle on page 1"). One undo brings back the stroke as
drawn; a second removes it. A chip tap after the release replaces the shape inside entry 2 (same
`ink-shape:` key), so the undo story holds. The shape closes any open pen burst. Both keys start with
`ink-shape:`, which `dry-ink.ts` treats like a burst stroke. The page therefore does not re-render
between the two entries, and the raw stroke never flashes. The outline goes to the dry layer at
release, and the page bitmap takes it over (frame strips: no jump between "released" and
"committed"). The /Square's mitred corners replace the dry outline's round joins at hand-over, which is
invisible at pen widths.

`AnnotationLayer.commitInkStroke` gained one line that sends shape strokes here, after the Highlighter
(a Highlighter shape stays Highlighter ink).

## 5. Ink motion polish

- **Wet-to-dry handover:** this was already flicker-free (`dry-ink.ts`: the dry stroke is drawn in the
  release task and removed in the bitmap's own task, covered by `dry-ink-handover.test.tsx`). Shapes
  use the same path.
- **Eraser fade** (`erase-fade.ts`): at commit, a ghost SVG of every touched stroke (each path at its
  mean width, colour, opacity and blend, plus Highlight quads) is added invisible. It shows in the task
  where the page draws the bitmap without the strokes (`onPageBitmap`, revision ≥ the erase's), then
  fades on `duration('slow')` with `EASE.out` (280 ms; 150 ms when reduced) and is removed. It gives
  up after 3 s without a bitmap. A cut stroke's remaining pieces sit under the ghost, so only the
  erased spans visibly fade.
- **Lasso:** marching ants on the trail and on the selection's dashed box: `stroke-dashoffset` moves
  one dash period (7 px) per `--loop-ants` (700 ms, new loop token in `motion.css` and
  `LOOP_MS.ants`). This is paint only, on one small SVG element, and still under reduced motion.
  **Lift:** the selection root grows from 97 % on `quick` with a `--duration-base` fade, once when the
  selection appears (the root is not keyed; moves re-key only its content). Reduced motion keeps the
  fade alone.
- **Tool switch:** the armed tool's glyph pops on `--spring-pop` / `--ease-spring-pop` from 72 % and
  −10°, and a pen's dot pops from 60 %. The individual `scale` and `rotate` properties are used, so
  the chisel's 45° transform is kept. Reduced motion: none.

## 6. Corpus results (`shapes.test.ts`, 95 cases, all pass)

Synthetic point arrays walked at 2 px steps with seeded jitter (0.3–0.8 px) and a low-frequency wobble
(2.5 px for the "sloppy" shapes), each ending in a hold.

**Never snap (64):** "e", "o" (with its exit stroke), "m", "l", "2", "a", "6", "8", "s", "c", "d",
"w", "z" and "4", each at 20, 40 and 60 px; "e", "o" and "a" at 40 px right after another stroke; a
one-stroke star; small and large ticks; the words "mel", "lame" and "oe"; three signatures; a
scribble; a figure of eight; a two-lap spiral; a wavy underline; a bow; an open "u"; a dot-sized
circle. Rejections: letters and words fail the closure (open) or the handwriting gate (reversals 1–11,
counter-turn 0.2–0.5, crossings); "8" and the figure of eight turn ~0°; the star crosses itself and
runs 1.22 × its box; the spiral is 1.64 × its box.

**Snap to the right kind (24), score = 1 − ranked fit:**

| Case | First fit (score) | Next |
| --- | --- | --- |
| line / sloppy / short | line .98 / .79 / .89 | — |
| rectangle; sloppy from mid-edge with overshoot; gap at close | rectangle .87 / .79 / .78 | polygon |
| rotated 20°; sloppy rotated 33° | rectangle .92 / .83 | polygon |
| square; sloppy; diamond (45°) | square 1.21 / .99 / 1.23 | rectangle, polygon |
| triangle; sloppy; right triangle | triangle .93 / .86 / .76 | — |
| circle; sloppy (1.08 laps); 0.9 lap | circle 1.28 / .91 / 1.03 | ellipse |
| ellipse; rotated 30° sloppy | ellipse .97 / .83 | — |
| pentagon; sloppy | pentagon .77 / .74 | circle .11 / .09 |
| hexagon; sloppy | hexagon .80 / .61 | circle .50 / .49 |
| arrow in one stroke | arrow .97 | — |

Also tested: the 5° snap and the 12° no-snap for rectangles, ellipses and lines; drawn size and centre
kept; a lumpy circle passes alone but fails after another stroke; drag scale/rotate; outlines close.

**Hexagon vs circle (follow-up):** the loop's radius about its centroid is read as harmonics
(`radialHarmonics`). A 3-, 5- or 6-fold ripple of at least 1.2 % of the radius, and at least 2×
every other ripple except the ellipse's k = 2 and the ripple's own multiples (`rippleCorners`),
adds the regular polygon it shows. That polygon's corners sit where the radius peaks, and its
apothem comes from the middles of the sides, so rounded corners do not shrink it. It also removes
the circle's bias. Eight new cases all classify correctly: a hexagon with rounded corners
(hexagon .98 vs circle .40), corners cut twice (.92 vs .50), bulging sides (1.03 vs .18), small and
rounded (1.01 vs .34), and circles drawn as 10-, 12- and 16-gons or with flat spots (circle .99–1.19,
no polygon offered). The sloppy hexagon now scores 1.07 against the circle's .19, and the 64 near
misses still never snap (103 corpus cases in all).

## 7. Verification

- Unit/browser: `lasso/make-shape.test.ts` (plan, one entry and undo, notice when nothing fits),
  `pen/` (shapes, straighten on a layer: morph, chip cycling, "e" stays, writing needs
  800 ms; shape-commit on the engine: /Square, chip replace in entry 2, undo → Ink → nothing;
  erase-fade), `lasso/`, `markup/`, `src/motion`, `styles/motion.test.ts`: green.
- e2e (Chromium): `pen.spec.ts` "hold to shape" (a /Line from press to release, then two undos) and
  "handwriting held still stays as written", plus the Partial erase: green.
- Frame strips (1440×900 and 1180×820 touch): sloppy rectangle → morph → held with chip → adjusted
  → released → committed; eraser fade; lasso trail → lift → ants. No jumps, clipping or
  double-drawing seen.

## 8. Make shape (lasso bar, follow-up)

`lasso/make-shape.ts` adds a polygon-icon button between Move and Delete, shown when the selection
holds strokes. It runs each selected path through the same recogniser, in the page's CSS pixels:

- **Gates and limits:** no hold and no writing context, but the same fit limits and handwriting gate.
  Highlighter ink and locked ink are skipped.
- **Commit:** one history entry ("Make shapes"). The recognised paths leave their Ink (an Ink left
  with no paths is deleted), and the shapes are created as `shapeDraft` creates them, in the Ink's
  colour, opacity and width. The selection clears, and one undo brings the strokes back.
- **When nothing fits:** the bar's notice line says "No shape in the selection" (the same slot as
  the stamp-orientation notice) and announces it. Nothing is edited.
- **Morph:** in the task where the page draws the bitmap with the shapes, an overlay covers each new
  outline with a page-colour band and draws the stroke as it was. The stroke then morphs onto the
  outline on `smooth`, and the overlay goes once it lands. Reduced motion: no overlay.
  - Trade-off: for those ~380 ms the band also hides any text pixels the outline crosses.
- **Frame strips:** `strip-{1440,1180}-make-shape.png`.

## Left

- A rounded-rectangle family, and right-angle snapping inside generic triangles.
- Live dimming of strokes under the eraser while dragging (the fade covers the commit).
- On a touch device, the chip can be tapped while the pen holds only with a second finger. With one
  pointer, tap it after the release (2.5 s).
