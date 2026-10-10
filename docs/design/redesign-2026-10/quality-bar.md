# Quality bar: what the prototype got wrong, and the gates that keep it out of the product

**Status:** accepted 2026-10-04 · **Applies to:** every M9 work package and both editions
(ADR-0033) · **Amends:** `language.md` §2.3 (the prototype's grain tile removed; Q-1, corrected 2026-10-10), §7.2's *bar morph* row (Q-6);
ADR-0024 §2 item 6; ADR-0026 §2 items 5 and 6; spec X1 and D2-2

The owner reviewed the concept prototype on 2026-10-04 and accepted the direction (in
translation):

> There were some small faults, but I expect they will not be in the real product: some
> mismatched buttons, glass surfaces that break and look grainy, a bottom menu whose
> animations are broken… The visuals, optimisation and usage, the text, the animations have
> certain problems and optimisation issues in the prototype, but they must not be in the main
> product!

This file turns that sentence into rules with tests. The rules are not new taste; they say how
the specified language is built so it renders the same on every engine. Each rule names its
test and the work package that first carries it.

## 1. What went wrong, and why (the lead's diagnosis from the prototype source)

| Seen by the owner | Cause in `concept/` | Rule |
|---|---|---|
| Glass looks grainy | Sheets and side sheets carried a 128 px noise tile at 2.5 % (`--grain-img`, `language.md` G-7). It was generated at 1× and scaled on HiDPI screens, so it read as dirt, not texture: a wrong render, not grain as such (owner, 2026-10-10) | Q-1 |
| Glass breaks | Glass sat inside ancestors that start a new backdrop root (a phone frame with `clip-path`, transformed demo cards), so it blurred only its parent. Small moving parts carried their own `backdrop-filter`. Glass was nested inside glass | Q-2, Q-3, Q-4, Q-5 |
| The bottom menu's animation is broken | The capsule morph clipped the glass with `clip-path` while its shadow lived on a separate element stretched with `scaleX`, so the rounded ends squashed. The rim was hidden during the morph and popped back after. The tools moved as cloned "ghosts" over the real ones. Shape, shadow and rim never shared one geometry | Q-6, Q-7 |
| Mismatched buttons | Controls of 28, 32, 36 and 44 px in the same bar; three radii; icons at 16, 18 and 20 px; hand-written buttons beside the primitive ones | Q-9 |
| Text | Labels set at different sizes and weights per screen, some under 11 px on glass; Turkish strings clipped; transforms left on text after animations (soft text) | Q-8 |
| Optimisation | One 550 KB page; up to nine `backdrop-filter` surfaces at once; the aurora and several blurred layers animating together; `will-change` left on at rest | Q-10, Q-11 |

## 2. Rules

**Q-1 No texture that renders wrong, and no banding.**
- Nothing on a surface is drawn below the device's resolution or scaled past it, and nothing
  reads as dirt. The prototype's G-7 tile (made at 1×, scaled up on HiDPI) is removed; glass
  ships smooth at every tier today.
- Gradients and light must not band. The aurora keeps its in-shader dither of ±0.5 LSB (AU-3).
- A grain or dither layer is allowed where banding shows and it fixes it: made at device
  resolution (or in a shader), measured against the banding it removes (research 17 §5, AU-3's
  3 % layer is the reference), with a solid twin, behind the glass pixel tests (Q-2 to Q-6).
  Each such layer is a decisions-log row and a named exception in the test.
- *Correction, 2026-10-10 (owner):* this rule first read "No grain, no noise, no raster texture
  on any surface". The owner's 2026-10-04 complaint (quoted above) asked to fix glass that
  rendered wrong and banded, not to ban grain. The quote stays as said; the rule is reworded
  (option B of `docs/family/README.md` §6) and ADR-0024 is amended to match.
- *Test:* `materials.test.ts` fails on `background-image` with `url(` or `image-set(` in any
  `.mat*` rule and on a live `feTurbulence` anywhere in `src/`, unless the rule is on the test's
  list of measured layers (empty today). *First:* D0-1.

**Q-2 Glass rests crisp.**
- At rest a glass element has `transform: none` (or an integer translate) and no `will-change`.
- Its position rounds to whole device pixels.
- Animations clear their transforms and `will-change` when they end.
- *Test:* `glass-rest.spec.ts` walks every `[data-glass]` after `document.getAnimations()`
  settles. *First:* D0-12 (the motion core clears its own) and D0-1 (the registry).

**Q-3 One backdrop root.**
- No ancestor of a glass element between it and the page canvas may have `filter`, `opacity < 1`,
  `mask`, `clip-path`, `mix-blend-mode`, `backdrop-filter`, or `will-change` naming one of these
  (`language.md` AU-19, restated as a gate).
- Entrances animate the glass element itself, never a wrapper.
- *Test:* the same walker, also run mid-animation for sheets, popovers, the capsule and toasts.
  *First:* D0-1.

**Q-4 No glass in glass.**
- A glass element contains no glass descendant.
- Rows, tiers, wells and chips inside glass use tint fills.
- *Test:* the walker. *First:* D0-1.

**Q-5 Small moving parts never blur.**
- Knobs, thumbs, drag ghosts, the eyedropper loupe and the page pill while scrubbing draw their
  "lens" from a copy of the content beneath them (`10-ink` §3.2), not `backdrop-filter`.
- Only surfaces of at least 32 px in both directions may be glass.
- *Test:* the walker checks the rendered size of every `backdrop-filter` element. *First:*
  D0-3.

**Q-6 A shape changes through its own geometry.**
- The capsule (dock ⇄ palette ⇄ Pages bar ⇄ Compare bar ⇄ Locked, and the ink strip's second
  row) is one fixed element with `contain: layout style`.
- Its **own** width and height animate on a spring through the motion core, with `border-radius:
  999px` (the pill) throughout.
- Backdrop, rim, inner light and shadow belong to that one element, so they follow by
  construction.
- Contents are positioned by FLIP inside it, and leaving items fade out in place. There are no
  clones, `clip-path`, `scaleX` on glass, or rim hidden mid-shape.
- This replaces the `clip-path` morph of ADR-0026, `language.md` §7.2 and spec X1. One contained
  element's layout costs well under 0.2 ms a frame; correctness on every engine is worth it.
- *Test:* `capsule.spec.ts` takes screenshots at 25, 50 and 75 % of a morph in Chromium, Firefox
  and WebKit. At each, the pixel 1 px outside the pill's curve equals the unblurred page within
  ±4/255, the pixel inside is blurred, and the shadow is present along the whole edge. The node
  stays the same. *First:* D2-2.

**Q-7 Sheets, bars and menus move by transform only.**
- Open, close and detent changes translate a panel that already has its final size.
- Content never reflows during motion.
- A drag hands its velocity to the spring.
- The scrim is a separate element that fades.
- Menus and popovers open from their trigger by the container transform (decision MOT-5,
  2026-10-09): a `clip-path` inset from the trigger's rounded rect plus a translate, never a
  scale, so text is never squashed; they close back into the trigger. This replaces the
  earlier "scale from the anchor (0.96 → 1)". Nothing animates `height` or `top` on glass.
- *Test:* `sheets.spec.ts` samples `getBoundingClientRect` sizes every frame of an open and a
  detent change: sizes are constant, only the transform moves, and a `ResizeObserver` on the
  content fires zero times. *First:* D0-4.

**Q-8 Text is set once and stays sharp.**
- One type scale (`language.md` §4), with no text under 11 px on glass.
- Weights are 400, 500 and 600 only.
- No text rests under a scale transform.
- Every label that can be long truncates with an ellipsis and carries its full text in the
  tooltip or accessible name.
- Chrome fonts are preloaded with metric-matched fallbacks (`size-adjust`), so a cold load shifts
  nothing.
- *Test:* layout-shift entries on load sum to 0 for chrome; the Turkish screenshot run at 1.8×
  length clips nothing (A-21); a computed-style scan finds no font size below 11 px inside
  `[data-glass]`. *First:* D0-3 (type) and D3-5 (fonts).

**Q-9 One control system.**
- Every control comes from `ui/`.
- Controls are 32 px (fine) or 44 px (coarse), in floating pieces of 40 or 48 (`--piece-h`,
  owner feedback 2026-10-09, G1): the top strip's pieces, the capsule and what it hosts, the
  page pill, the grid's corner pieces, the ink strip, the contextual bars and the Library's
  pills share one height, inset, radius, glyph and label per pointer class, and a coarse
  control's hit area never drops under 44.
- Radii are only pill or `--radius-control` (10).
- Icons are 20 px in controls and 16 px in menus and rows.
- *Amended 2026-10-09 (decision DSN-20, Audit §3):* the final system adds concentric radii, three
  control sizes (S/M/L) and icon sizes {12 badges, 16, 20, 32}. Where the two lists differ, the
  tokens and DSN-20 win.
- Popovers, menus, sheets, toasts, sliders and swatches each have one primitive (`10-ink` §7).
- In a bar every control shares one centre line.
- *Test:* `bar-audit.spec.ts` runs on every `role="toolbar"`, `[data-bar]`, menu and popover in
  both editions, in both pointer densities. Within each container the control heights are one
  value in {32, 44}, vertical centres agree within 0.5 px, radii come from the set, and icon boxes
  are in {16, 20}.
- An ESLint rule bans `<button>` and `<input>` with a `className` outside `ui/` once D2 has
  migrated the last ones; until then the audit catches the mismatch.
- *First:* D0-3; the rule at D2-QA.

**Q-10 Motion is calm, interruptible and idle at rest.**
- Durations and curves come only from the seven springs and four eases.
- Every animation retargets from where it is.
- Nothing animates while the app is idle: no frames at rest, the aurora included (still by
  default, ADR-0025). One exception, the owner's (2026-10-09, G3): the Library's aura drifts
  slowly (37–59 s loops) by CSS animations of transform and opacity alone, on layers painted
  once, so no frame callback runs and nothing lays out or paints; it pauses while the document
  is hidden and is still under reduced motion. A document view stays at zero: the reader's
  Background glow (G5) is the same light, still.
- Layout properties animate only under Q-6.
- *Test:* `motion.spec.ts` counts frames for 2 s of idle with no input and expects 0 (A-23) and
  no animation but the aura's drift, and
  interrupts every catalogue animation mid-way and checks it settles at the new target. *First:*
  D0-12.

**Q-11 Budgets.**
- At most four `backdrop-filter` surfaces visible at rest (top strip, dock, page pill, one
  more), and at most six during a transition.
- The floating sidebar has a slot of its own while it shows (2026-10-10, owner, DSN-22): five
  at rest and seven in a transition then, so it never takes the "one more".
- The pieces of one surface count once (2026-10-08, owner feedback F1): the top strip's two
  floating pieces are the "top strip", and the Pages grid's scope and size pieces are one
  surface. Each pair covers less than the band it replaced. They carry `data-glass-group`.
- σ only from the tier table.
- Chrome interactions respond within 100 ms (INP).
- Sheets, panels and the colour panel load on first use.
- The compact edition's JS loads without the full shell.
- *Test:* the walker counts surfaces; `glass-perf.spec.ts` keeps its frame budget; the build's
  size check names a ceiling per entry. *First:* D0-1 (count) and D0-14 (split).

**Q-12 Drawing is code.**
- Gradients, SVG and the token colours draw the UI.
- No bitmap backgrounds, no inline PNGs, no icon fonts. The one exception is a measured
  grain or dither layer that Q-1 allows.
- *Test:* the copy-check list bans `data:image/png` and `url(*.png)` in CSS under `src/`.
  *First:* D0-1.

**Q-13 Screens are pinned.**
- Each surface has a screenshot baseline in both themes at 1440 × 900 and 820 × 1180 (tablet),
  in Chromium, plus the compact edition at 390 × 844.
- A change to one shows the before and after in its report.
- *Test:* `surfaces.visual.spec.ts`, whose baselines are updated only by the lead. *First:*
  D0-3 (primitives), growing per drop.

**Q-14 States are complete.**
- Every interactive element shows rest, hover (fine pointers), pressed, focus, disabled and
  selected or armed where it applies, from the shared state tokens.
- No browser default leaks: native focus outlines, select arrows, number spinners, the blue tap
  highlight.
- *Test:* the primitives' browser-mode suite renders each state; `-webkit-tap-highlight-color`
  is transparent globally. *First:* D0-3.

## 3. How a drop proves it

Every drop's exit includes the Q-gates first carried in that drop or earlier, blocking in CI. The
independent reviewer of each drop (spec XD-3) opens the deploy at 1440 × 900 and on a tablet,
and reads this file before reading the diff.
