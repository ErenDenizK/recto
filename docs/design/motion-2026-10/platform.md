# R14 motion: platform lane

Owner, 2026-10-09: "things should come out of the button you pressed and go back into it."
This lane builds that once, in the shared `ui/` primitives and `motion/`, so every surface gets
it without wiring. Tokens are unchanged; everything here reads `styles/motion.css`.

## §1 Container transform

**Popups** (menus, popovers, select popups). `motion/container.ts` is the motion,
`ui/container-transform.ts` applies it.

- The menu and popover recipes (`Menu.module.css`, `Popover.module.css`, and Select's popup,
  which composes the menu's) carry the global class `ct-popup`. One document-level
  `MutationObserver` (installed by `TooltipProvider`, the app's one provider) sees those popups
  mount and enter their ending style. Callers change nothing.
- Trigger: the element that `aria-controls` the popup (Base UI's triggers), else the control
  pressed in the last 600 ms (`ui/press-origin.ts`: a popover opened by a plain button, a
  context menu on a swatch or a tab). Submenus and popups with no control (a context menu on the
  page) keep the recipe's CSS motion.
- The popup is never scaled, so text is never squashed. Its visible region is a
  `clip-path: inset(… round r)` that starts as the trigger's own rounded rect and opens to the
  popup's box plus a 40 px bleed for its shadow; a `translate` carries the region from over the
  trigger to the popup's place (the popup sits `sideOffset` away, so a clip alone cannot reach).
  Clip, translate and opacity are functions of one progress number on a spring, so a reversal
  turns from where it is, with its velocity.
- Open on `quick` (99 % at 296 ms); opacity 0 → 1 over the first 30 % of the progress, so the
  glass is whole while it grows. Close on `press` (212 ms, the quicker close of MC-16) back into
  the trigger, re-measured at the close, fading over the last 30 %. Web Animations sampled at
  120 Hz from the analytic spring (as `animateStyle()`), so Base UI waits for the close before
  it unmounts. At rest nothing is inline (`data-ct` stays; it switches the recipe's CSS
  transitions off).
- At once (unchanged): `data-instant` (keyboard opens, Esc dismissals) and the menu → sheet
  hand-off (`data-menu-handoff` now also finishes a running close).
- The trigger keeps the pressed wash while open (`data-popup-open` from Base UI, or
  `data-origin-open` written on a fallback trigger) and, when the popup has gone back in, takes
  it with the *receive* pulse: its `scale` swells 6 % on `pop` and settles (`scale`
  composes with the press transform).
- Reduced motion: opacity only, 150 ms in, 100 ms out; no pulse.

**Sheets** (`ui/sheet/Sheet.tsx`, `sheet-motion.ts`). A side or bottom sheet opened by a press on
a control (within 1 s, the same `press-origin.ts`) starts laid over that control at a uniform
scale (centres met, the panel just covering the control, at least 0.08) and settles into its
edge on `smooth`, fading in on `quick`. It closes back into the control while that is on screen,
whole for 120 ms then fading, and the control pulses. A menu item's sheet returns to the menu's
trigger (the item is gone). A swipe-close, a vanished control or reduced motion keeps the edge
exit. The control shows `data-origin-open` (pressed wash) while the sheet is open. Centred and
form sheets keep the *dialog* scale.

Clip-path is not compositor-only in every engine; it is used only for popups (small, short), as
the brief allows, and never on the sheet panel (transform and opacity only, as before).

## §2 Press and hover, one spec (`styles/controls.css` header)

| State | What | Timing |
|---|---|---|
| Hover (fine pointer) | hover wash or hover ring | `--duration-fast`, `--ease-out` |
| Press | pressed wash + `--press-scale` (0.97 / 0.94 touch); rows `--press-scale-large`; a 16–20 px box or circle presses 3× as deep | `--duration-instant` |
| Release | scale back | `--spring-press`, `--ease-spring` |
| Open | pressed wash kept (`data-popup-open`, `data-origin-open`) | — |

Applied to Button (`.btn`), IconButton, MenuButton (existing, now also `data-origin-open`), the
segments, Checkbox, RadioGroup and ListRow (new). New presses use the `scale` property so they
compose with any transform. Reduced motion rests every press scale at 1: washes only.

## §3 Choice controls

- Segmented thumb: `animateStyle()` FLIP in the thumb's own pixels (zoom-safe) on `press`; a
  second change mid-flight stops it where it is and hands its translate and width velocity to
  the next slide (was: cancel and restart from rest).
- Switch knob: `--spring-fling` with `--ease-spring-fling` (bounce 0.15), so it lands with a
  little give; the press still widens it 4 px.
- Checkbox tick: draws in by `stroke-dashoffset` (`pathLength` 1) on `--spring-quick` (was a
  0.88 scale pop).
- Radio dot: grows from 0 on `--spring-pop` (was from 0.88).

## §4 Tooltips

500 ms delay, then a fade and a 2 px rise away from the anchor (half of `--rise-distance`, so 0
under reduced motion) in `--duration-fast`; the exit is the fade alone. Warm-up: while one shows
and for 600 ms (was 400) after, the next trigger shows its tooltip at once and Base UI marks it
`data-instant`, so it jumps without a transition, as on macOS.

## Checks and frame strips

Format, lint, typecheck; unit: `src/ui`, `src/motion`, `src/styles`, `src/shell`, `src/settings`,
`src/home`, `src/markup`, `src/stage`, `src/signatures`, `src/pages-sheets` green. New tests:
`motion/container.test.ts`, `ui/container-transform.test.tsx`; `overlays.test.tsx` now asserts
the popover's entrance animates clip-path, transform and opacity only. Frame strips (animations
at 0.25×) of the dock's More menu and Save a copy… at 1440 × 900 and 1180 × 820 touch were looked
at: no jumps, no squashed text, the region grows from the trigger and returns into it.

## Not done / for other lanes

- The title menu (`shell/frame`, a popover on the document tab) unmounts without an ending style,
  so it closes at once and cannot go back into its tab. Rendering it with Base UI's exit (keep
  the `Popover.Root` mounted) would give it the return for free. Frame lane.
- Toasts, the capsule and the palette have their own motion and are outside this lane.
- e2e `motion.spec.ts` (A-9 sweep, A-10 limits) was not run locally; by construction the new
  motions are opacity-only within 150 ms under reduced motion and settle within 500 ms.
