# R14 motion: Library and capsule lanes

The Library (`home/`) and the capsule with its contextual bars (`shell/capsule/`,
`annotations/AnnotationBar`, `annotations/ReadSelectionBar`). Everything runs on the motion core
(`motion/`: `animateStyle`, `springWidth`, `viewTransition`, `reducedMotion()`) and the tokens in
`styles/motion.css`. Only transform and opacity move, plus a capsule's or bar's own width through
`animateStyle` (Q-6). No new tokens, no new dependencies, and nothing is left inline at rest (Q-2).

## 1. Opening a document: a shared element (`home/library-transition.ts`)

| | Before | After |
|---|---|---|
| Library → document | Root cross-fade only | The card's first page grows into the reader's page |
| Document → Library (`0`, app glyph, "Show Home") | Cut | The page shrinks back into its card |

- A View Transition (240 ms on `--ease-spring`, cut at `--vt-duration` by `viewTransition`). The
  card's sheet (`[data-library-sheet]`) and the reader's page share `library-sheet`. The name is
  set just before the old view is captured and just after React draws the new one, the same way
  `stage/grid/grid-transition.ts` does it. If either side is off screen, neither is named, so the
  view only cross-fades.
- The arriving page is the reader's first page when it is on screen, otherwise the current page
  (a document opens where it was left).
- **The old image travels alone** (`library-transition.css`). The new view is captured before the
  page's canvas renders, because rendering waits while the update runs. A cross-fade inside the
  group would therefore end on a blank sheet. Instead the old bitmap travels and the live element
  takes over as the group lands. In the open direction the image is upscaled and slightly soft
  for 240 ms, then swaps to the sharp page.
- **Fallback where View Transitions are missing** (`flipSheet`): a clone of the leaving sheet,
  with its bitmap copied, is laid fixed at the arriving box. It is moved from the leaving box by
  transform and scale on `smooth`, and fades over its last 40 %.
- Reduced motion: `motion.css` strips the names, leaving the root cross-fade (150 ms) and no
  clone.

## 2. Cards (`home/card-motion.ts`, `LibraryGrid`'s `CardMotionBoundary`)

A class boundary's `getSnapshotBeforeUpdate` reads the grid before a commit that changes the card
order. The capsule's `MorphBoundary` uses the same pattern.

- **Arriving** (files opened or dropped, a close undone): the card starts 12 px up at scale 0.90
  and springs to rest on `smooth`. Opacity runs on `quick` through `animateStyle`. Files dropped
  on the Library therefore fall into their slots.
- **Leaving** (Close, Delete): an inert clone of the card, with no role, id or test id and its
  page bitmap copied, shrinks to 0.86 and fades on `--duration-base` `--ease-exit`. It is drawn in
  a ghost layer under the cards (`isolation: isolate`, `z-index: -1`), so the neighbours closing
  the gap pass over it, never under it.
- **Making way**: a translate-only FLIP on `smooth` from each card's drawn position. A move still
  in flight carries its velocity into the next one (Q-10). Reorders by drag or Alt+arrows get
  this too.
- **Undo** reverses a close: the card grows back in at its slot while the others make way. That
  is the "Undo reverses the motion" case cheap enough to coordinate in this lane.
- **Hover and press** were already in place and are unchanged: a 2 px lift with `--e3` on
  `--spring-quick` for a fine pointer, and `--press-scale-large` on press.

## 3. Select mode

- **Check badges** fade in on `--duration-fast` and spring from half size on
  `--spring-pop`/`--ease-spring-pop` (one small glyph, the token's stated use). They are
  staggered 12 ms apart in card order for at most ten steps (MP rule), through an inline
  `--check-delay`, because a `calc(… * 12ms)` literal fails the scale gate. Leaving Select mode
  they go together, and hover shows them at once. Reduced motion: they fade together.
- **Selection bar** (`SelectionBarPresence`): it rises from the capsule's place
  (`translateY(--piece-inset + 4 × --rise-distance)`) on `--spring-quick`. Before, it was
  unmounted with a cut. Now it sinks back on `--duration-fast` `--ease-exit`, is `inert` and
  `aria-hidden` from its first leaving frame (A-13), and unmounts on `transitionend`, with a
  400 ms fallback. The entrance only translates, because `springWidth` (now on the bar, for
  "Combine 2 files" → "Combine 3 files") measures the drawn box.

## 4. Drop well

The launcher piece in the Library, and the drop card over a document, breathe while files are
over the window. The effect is a halo of rings (`--accent-muted`, `--accent-subtle` ×2, at 3, 8 and
14 px with no blur; `tokens.test` allows rings only) on an `::after`. Its opacity swings
1 → 0.35 on `--loop-pulse`, `alternate`. The animation exists only while the drag lasts. Reduced
motion holds the halo still.

## 5. Capsule: the morph flows from the pressed item (`capsule-morph.ts`, `Capsule.tsx`)

- `Capsule` records the `data-capsule-item` a pointer pressed (`onPointerDownCapture`). The
  snapshot takes it as the morph's `origin` if the press was within 1 s, else the focused piece
  (key activation), else `null` (a shortcut or a lock engaging). In that last case the morph
  reveals from the centre, as before.
- The arriving content's stagger is now ordered by distance from the origin, not the centre.
  Each part also starts `FLOW_SHARE` (18 %) of its distance back toward the origin, at most
  24 px, and settles on `smooth` (the `linear()` form, so it can wait for its turn). Markup
  visibly opens out of the Markup button. The edge rules still apply: a part fades only after
  the moving edge has passed it.
- The flow animations carry their own id (`capsule-flow`). They pause with a content that is
  turned away, resume when it is asked back, and are finished before a piece is measured for a
  slide.

## 6. Contextual bars (`annotations/bar-motion.tsx`)

- **They rise from their anchor:** `@starting-style` from `--enter-scale` and `--rise-distance`
  toward the selection. A bar placed above its selection scales about its bottom edge, one placed
  below about its top edge (`data-side`). The text bar's origin is its leading edge.
- **Width spring:** `springWidth` on both bars, so new controls grow or narrow the glass on
  `smooth`. The annotation bar is centred on its selection and positioned from `restingWidth`.
  `glideLeft` moves its left edge on the same spring, so it grows about its centre and is
  re-placed once, not every frame.
- **Cross-fade:** `BarSwap`, a class boundary keyed on the selection's type: the kinds selected,
  `lasso` or `locked` for the annotation bar, and Read or Edit for the text bar. The old controls
  are cloned at their offsets, inert, and fade out on `--duration-fast` `--ease-exit` while the
  new ones fade in on `--duration-base`.

## 7. Toasts (checked, unchanged)

They already rise 16 px from `--space-2` above the capsule or band, re-flow by FLIP on `quick`,
and fling away on touch past half their width or 800 px/s (`ui/Toast/stack-motion.ts`,
`ToastRegion.tsx`). Undo's reverse motion is covered for the Library's Close in §2. Other undo
cases belong to their lanes.

## Verification

- Unit (Chromium, `--maxWorkers=1`): `home/`, `annotations/`, `shell/capsule/`, `motion/`,
  `styles/`, Dock, MarkupPalette, read-lock, PageContextMenu, home-chrome: 62 files, 796 tests
  green. The new tests are `home/card-motion.test.ts` (clone inert and nameless, slide offset,
  arrival keyframes, bitmap copied, nothing inline at rest) and Capsule "flows from the piece
  pressed". `selection-bar.test.tsx` now waits with `settled()` for the bar's entrance.
- Format, lint (eslint on the touched folders) and typecheck are clean.
- Frame strips at 1440×900 and 1180×820 touch, taken with CDP at 0.1× and with paused,
  scrubbed View Transitions for the morph:
  `scratchpad/r14/frames-library/{desktop,tablet}-{select,close,undo,drop-fall,open,back,markup,markup-done}`.
  Seen: the thumbnail grows into the page and back with no double image; a closed card shrinks
  under the neighbour sliding over it; undo grows it back; dropped files fall in checked; the bar
  rises from the bottom edge; the drop halo breathes.

## Left / notes

- The open morph's travelling image is the card bitmap upscaled, so it is soft until the swap.
  The grid transition's "prepare first" (mount the reader hidden, draw, then transition) would
  remove that, at the cost of about 100 ms latency before the morph starts.
- A transition's shared page draws above the top strip for its 240 ms. The grid transition's
  capsule-band cut was not ported.
- The leaving card clone keeps the selected check badge it had. That is acceptable, since the
  clone fades within 180 ms.
