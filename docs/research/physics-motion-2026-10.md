# Physics-based motion: audit, system and migration (R26, 2026-10)

The owner asked for the whole animation system to move from time-based tweens to physics:
springs with stiffness, damping and mass, velocity handed over from gestures, every move
interruptible and retargetable, objects moving as they really would. This note audits what the
app does today, sets the system that every motion uses from now on, records wave 1 (landed
on `r26/physics-motion`) with its before/after measurements, and plans the waves that follow.
Decision: MOT-18, in force for wave 1 (`docs/process/decisions/motion.md`).

**The headline finding.** Recto is already mostly physics. MOT-1 (ADR-0026) put every position,
size and scale move on seven analytic springs in `src/motion/` with velocity retarget, and the
CSS side on `linear()` curves written from the same solution. So the work is not a rewrite: it is
closing the places where a tween, a restart from rest, or a dropped velocity still shows, and
giving the remaining tween sites one route onto the springs.

## 1. Audit

Method: every `transition:` / `animation:` declaration and `@keyframes` block in
`apps/web/src/**/*.css` (comments stripped), every Web Animations call (`.animate(`) and every
`animate()` / `animateStyle()` call in `apps/web/src/**/*.ts(x)` (tests excluded), at
`origin/develop` 9bef0fd. A CSS site is spatial when it transitions `transform`, `translate`,
`scale`, a size or an inset; a script site when its keyframes move one of those. The script
split is by reading each call's easing; counts there are ±5.

| Kind | (a) physics / spring | (b) should be a spring with hand-off | (c) colour/opacity ease, fine |
|---|---|---|---|
| CSS transitions (225 declarations) | 63 (`--spring-*` with `--ease-spring*`, the chrome's scroll springs, the phone sheet's release curves) | 18 | 144 (incl. 17 press-downs on `--duration-instant`, which §7.3 keeps as a tap's instant) |
| `@keyframes` (56) | 7 spring-shaped glyph flourishes (`pop`, check-in, tool-arm …) | 9 entrance rises (pill roll-in/out, palette rows, selection bars, find rise, lasso lift) | 40 (34 opacity/colour, 6 loops: spinner, sweep, shimmer, aura) |
| Script (`animate`, `animateStyle`, WAAPI) | ≈ 171 (155 core calls + 16 WAAPI on sampled springs) | ≈ 20 WAAPI transforms on cubic eases | ≈ 50 opacity fades |
| **Total** | **≈ 241** | **≈ 47** | **≈ 234** |

Wave 1 also found four defects inside bucket (a), where a spring existed but lost its velocity
or held still; they are fixed here and counted with (b) in spirit:

1. **Every Web Animations retarget held still for a frame.** `animateStyle()` cancelled the old
   animation and started a new one, which stays *pending* until the next frame and then draws its
   time 0, the turn's position, once more; after a long task the hold lasts the whole task. Seen
   in the recordings as two identical frames at each turn (desk capsule reverse: 798, 798 px).
2. **The capsule let go into a jump** when its content changed size after the morph measured it
   (a group that loads late): the springs settled on the old size and the capsule then snapped
   to the new one (one recording: 937 → 1058 px in a frame, 200 ms after the morph "ended").
3. **The tool drawer dropped the finger's speed** on both a swipe that springs back and a throw
   that closes; the close also judged the throw by the swipe's average, not its release.
4. **The page pill's rise restarted from rest** at every turn (a CSS transition reversing), a
   corner in its path whenever a morph widened the dock and turned back.

The 15 most visible motion sites, by how often a user sees them and how large they are:

| # | Site | Where | Bucket |
|---|---|---|---|
| 1 | Capsule morph (dock ⇄ palette ⇄ Pages ⇄ Locked) | `shell/capsule/capsule-morph.ts` | a (+ defects 1, 2) |
| 2 | Desktop sheets (side, bottom, dialog, form; out of a control) | `ui/sheet/sheet-motion.ts` | a (+ defect 1) |
| 3 | Phone sheets (Base UI drawer, release curves) | `shell/compact/sheet-release.ts` | a; reversal mid-flight restarts (b) |
| 4 | Phone tool drawer | `shell/compact/mark/drawer-motion.ts` | b (defect 3) |
| 5 | Page pill rise and Focus step | `shell/frame/PagePill.module.css`, `DockBand` | b (defect 4) |
| 6 | Menus and popovers out of their trigger | `ui/container-transform.ts`, `Menu/Popover.module.css` | a open, b exit (ease-exit scale) |
| 7 | Page zoom (pinch, smart zoom, wheel) | `viewer/`, `motion/gesture/` | a |
| 8 | Pages grid reflow, lift and drop | `stage/grid/cell-motion.ts`, `lift.ts` | mixed: FLIP a, ghost and drop b |
| 9 | Tabs' fill slide and tab growth | `shell/frame/tab-motion.ts` | a |
| 10 | Phone chrome hide on scroll | `CompactChrome`, `mark/chrome-spring.ts` | a |
| 11 | Toast stack | `ui/Toast/stack-motion.ts`, `Toast.module.css` | a stack, b progress |
| 12 | Library ⇄ document view transition | `home/library-transition.ts` | a (VT on the spring curve) |
| 13 | Phone menus (⋯, file) | `shell/compact/liquid-menu.ts` | b (ease-in/out keyframes) |
| 14 | Contextual bars' entrance | `annotations/bar-motion.tsx` | b exit, a entry |
| 15 | Signature flight onto the page | `signatures/flight.ts` | b |

## 2. The system

### 2.1 Spring presets as tokens

The seven tokens stay (MOT-1, language.md §7.1); they are now published with their physics.
Mass is 1 for every token: with a velocity handed over as a kinematic speed (px/s), only k / m and
c / m shape a move, so a token's mass is a parametrisation, not a second knob. `preset(name)`
returns them; the `Spring` type takes an optional `mass` that the solver normalises, so a
heavier preset later is the same API.

| Token | k | c | m | ζ | 99 % settle | CSS duration | Replaces / used for |
|---|---|---|---|---|---|---|---|
| press | 987 | 62.8 | 1 | 1 | 212 ms | 300 ms | press release, switch thumbs |
| quick | 504 | 44.9 | 1 | 1 | 296 ms | 420 ms | menus, popovers, bars, toasts, pill rise; `--duration-fast` moves |
| smooth | 305 | 34.9 | 1 | 1 | 381 ms | 530 ms | capsule morph, panels, FLIP reflow, drawer open; `--duration-base` moves |
| glide | 187 | 27.3 | 1 | 1 | 487 ms | 680 ms | phone sheets, smart zoom, large moves; `--duration-slow` moves |
| fling | 247 | 26.7 | 1 | 0.85 | 285 ms | 560 ms | releases faster than 300 px/s |
| pop | 386 | 29.5 | 1 | 0.75 | — | 410 ms | one small glyph |
| track | 3948 | 125.7 | 1 | 1 | 106 ms | 150 ms | things that follow the pointer |

Mapping today's ease tokens for any spatial move that migrates: `--duration-instant` stays an
instant (the press-down); `--duration-fast` → `quick`; `--duration-base` → `smooth`;
`--duration-slow` → `glide`; an exit on `--ease-exit` → `quick` toward the exit with `keep`
(MC-16's quicker close is `quick` against `smooth`). Colour and opacity keep the four eases.

### 2.2 One engine API on `src/motion`

No new dependency; the core stays under MOT-1's 3 KB.

- **Imperative springs** (transforms and Q-6 sizes): `animateStyle(el, prop, from, to,
  { spring, velocity, keep })` on Web Animations, keyframes sampled from the analytic solution at
  120 Hz; `animate()` for script values on one rAF loop. Both `retarget(to, velocity?)` from the
  present position and velocity and `stop()` returning both for a gesture to take over.
  `prop` now includes `translate`, which composes with a stylesheet `transform`.
- **`shift(el, dx, dy, spring)`** (new): a place the stylesheet owns just moved; draw the element
  where it was and spring it home on `translate`, adding to and keeping the velocity of a shift
  in flight. The route for every CSS state change that should stay interruptible (the pill's
  rise today; the Focus step, bars' rise and grid pieces next).
- **`startOnThisFrame(animation, el)`** (new): the segment that replaces one already moving is
  pinned to the present frame's timeline time, so a retarget never draws a held frame. A start
  from rest is not pinned: it keeps the browser's start (the next frame), shared with the fades
  and slides a choreography starts beside it. Pinning those too ran the capsule's slides a frame
  (or a long task) ahead of the fades that clear their path, so Pages slid over a still-opaque
  Markup (`capsule.spec.ts`, dock → Locked); round 2 narrowed the pin to turns.
- **CSS curves:** `springToLinear(token, velocity)` writes `linear()` stops from the solution
  (D3-4 wrote `--ease-spring*` with it); `springEasing(token, velocity)` (new) answers the same
  where `linear()` parses and a fitted `cubic-bezier()` otherwise.
- **Gestures:** `velocityTracker()` (least squares over 100 ms), `project()`, `rubberBand()`;
  a release hands its velocity to the spring, capped at 20 distances/s toward the rest and 3 away
  (the phone sheet's and now the drawer's rule).

**`linear()` support.** Chromium 113, Firefox 112, Safari 17.2 (Baseline high since 2026-06).
Before them, a transition whose timing function does not parse is dropped (the move jumps) and
`element.animate()` throws on the easing. Fallback: `styles/motion.css` §5 sets the three curves
to `cubic-bezier()` stand-ins under `@supports not (transition-timing-function: linear(0, 1))`,
fitted within 3 % (zero bounce held at 1, so it never overshoots):
`--ease-spring: cubic-bezier(0.29, 0.486, 0.03, 1)`, fling `(0.262, 0.373, 0.046, 1.166)`, pop
`(0.295, 0.423, 0.055, 1.218)`; script asks `springEasing()`, which bends the stand-in's first
control point to the release slope v · duration. `animateStyle()` needs neither: its keyframes are
the sampled spring.

**Scope of the fallback in wave 1:** the three CSS curves (`--ease-spring`, `-fling`, `-pop`, so
every stylesheet transition on a spring token) and the capsule's flow (`SMOOTH`). The script
sites that still hand `springToLinear()` straight to an easing are wave 2; on an engine without
`linear()` a Web Animation there throws and an inline transition is dropped (12 call sites in 8
files): `viewer/search.ts` (find pulse), `shell/compact/overview/tile-press.ts`,
`CompactOverview.tsx`, `overview/morph.ts`, `shell/compact/mark/chrome-spring.ts` (the chrome's
scroll springs), `shell/compact/sheet-release.ts` (the release's open and close curves),
`stage/grid/lift.ts` (two) and `stage/grid/cell-motion.ts` (three, with the pop).

### 2.3 Reduced motion

Unchanged in principle (§7.5, A-9), now stated per route: a spatial spring is instant and carries
no momentum (`animateStyle`, `shift` and the drawer jump to their end); a fade stays, ≤ 150 ms, on
the reduced-fade spring; `project()` and `rubberBand()` are 0; CSS spring durations are 0 ms, so
any `linear()` or stand-in curve is moot. A gesture stays 1:1.

### 2.4 Deterministic tests

- Analytic first: anything about shape is tested on `solve()`, `progressFrames()`, `handOff()`,
  `springToLinear()` and `preset()`, with no clock (`springs.test.ts`, `drawer-motion.test.ts`).
- The rAF loop (`animate()`) runs on a fake clock: `performance.now` and `requestAnimationFrame`
  are stubbed and frames are stepped by the test (`animate.test.ts`).
- Web Animations are driven on their own clock: a test pins `animation.currentTime` (or pauses
  every animation, as `capsule.spec.ts`'s `pauseMorphAt`), and every motion reads position and
  velocity from that clock, so a pinned frame is exact. `startOnThisFrame` keeps this: a new
  segment starts at the timeline's time, never pending.
- e2e read the result, not wall time: settle with `settled(el)` / `atRest()`, and sample frames
  in the page (`sheets.spec.ts`' `sample`).

## 3. Migration plan

| Wave | Scope | Done when | Check |
|---|---|---|---|
| **1 (landed)** | Tokens with k/c/m (`preset`), `springEasing` + CSS `@supports` fallback, `startOnThisFrame`, `shift`; capsule follows late size changes and hands a flow's speed to a slide; drawer release velocity; pill rise on `shift` | All listed defects gone in frame recordings; motion unit tests, capsule, sheets, glass-perf green; first paint ≤ +0.7 KB, editor ≤ +2 KB gzip | `vitest src/motion …`, `capsule.spec`, `sheets.spec`, `glass-perf.spec`, `bundle-budget.ts`, recordings §4 |
| **2** | Popups' exits and entrance keyframes onto springs: Menu/Popover/CommandPalette exits (`quick` with `keep`), the 9 entrance keyframes as `shift()` or `animateStyle`; phone menus (`liquid-menu.ts`); the phone sheet's reversal mid-open keeps its speed (write a release curve when `data-ending-style` lands on a running transition); the 12 script `springToLinear()` easings listed in §2.2 → `springEasing()` (fallback scope) | No spatial `@keyframes` outside loops and glyphs; grep finds no spatial `.animate(` on a cubic ease in these files | `menus.spec`, `compact-top-split.spec`, `compact.spec`, `motion.spec` (interrupt every catalogue animation) |
| **3** | Pages grid (`cell-motion.ts`, `lift.ts`): drop and ghost on `fling` with the drag's velocity; signature flight; compare; card exit; text-edit motion; Focus step and grid pieces' rise on `shift` | Bucket (b) script count 0 | `pages-grid.spec`, `signatures.spec`, `compare.spec`, `library.spec`, recordings of a drop |
| **4** | Taste and tuning with the owner: whether a press-started move may carry a small bounce (language.md §7.1 says none; the owner's "boing" in MOT-16 and this brief's "as they really would" may say otherwise); heavier presets for large surfaces | Owner's call recorded | Owner review on the iPhone and the Mac |

## 4. Wave 1 evidence

Recorded on the production build (`RECTO_RENDER_OVERRIDE=1`), Playwright Chromium 1194 headless
(SwiftShader), per animation frame in the page: the capsule's drawn width and the pill's
transform and translate; a sheet's transform and opacity. Each scenario opens the sample, warms
the morph once, then records. Settle is 99 % of the move; "held frames" are frames at a turn that
repeat the previous position while the motion should be moving.

Three runs per build and size (before: `origin/develop` 9bef0fd; after: wave 1), medians
unless stated. The frames are stamped on the document timeline (the clock Web Animations sample
on), not on `performance.now()`: the first round stamped them with `performance.now()` inside the
rAF callback, which split one frame into two and counted holds that were not drawn; round 2
switched the clock and re-recorded both builds.

| Scenario | Measure | 1440 × 900 before → after | 1180 × 820 touch before → after |
|---|---|---|---|
| Capsule dock → palette, reversed by `2` after ≈ 130 ms | time held still mid-flight (ms, per run) | 167, 50, 50 → 33, 17, 0 | 50, 50, 50 → 0, 33, 0 |
| same | frames around the turn (ms : px, run 1) | 200:918 217:918 283:918 300:923 317:892 | 183:946 200:945 233:859 (no hold; the turn is a rounded peak) |
| same, page pill's rise | velocity jump at the turn ÷ peak speed | — | 1.14, 1.48, 1.48 → 1.16, 0.84, 0.98 |
| same, page pill's rise | path through the turn (ms : px, run 2) | — | −24.1, −30.5, **−26.0** (a corner) → −36.7, −44.8, −40.0, −27.9 (carries on, then turns) |
| Capsule dock → palette | overshoot · 99 % settle | 0 % · 383 → 383 ms | 0 % · 383 → 383 ms |
| Capsule, first open of a session (cold) | largest one-frame step in the last 15 % | 3 %, 3 %, 3 % → 3 %, 4 %, 3 % | 5 %, 3 %, 4 % → 3 %, 3 %, 3 % |
| Save a copy side sheet (by its shortcut) | overshoot · 99 % settle | 0 % · 450 → 367 ms | 0 % · 617 → 417 ms |

Reading them:

- **Holds at a turn are gone.** Before, every reversal of the capsule stood still for two to
  three frames (50–167 ms) at the width it had when the key landed, then set off back; after,
  the width carries through the turn. The remaining "held" milliseconds after are sub-pixel
  creep in the last 1 % (two frames at 1057 px, one rounded pixel short), not holds.
- **The pill turns on a curve.** Before, a reversal turned the pill in one frame from rising at
  ≈ 390 px/s to falling at ≈ 270 px/s; after, it keeps rising for a frame, then comes back on
  the spring, and the turn's velocity jump falls by about a third.
- **No overshoot anywhere and the settle unchanged**, as zero-bounce tokens should be: the system
  changed how moves hand over, not their shape. The sheet's settle differences are within the
  harness's frame noise (SwiftShader draws a frame every 17–120 ms while a sheet mounts).
- **The late snap (defect 2) was seen once** (the first recording, 937 → 1058 px, 200 ms after
  the springs had settled), not again in three cold runs on either build: it needs a content to
  grow while the morph is in flight. It is held by a unit test instead (`Capsule.test.tsx`,
  "follows a content that grows after the morph measured it"), which fails without the fix.
- **A sheet turned back mid-entrance could not be provoked here:** the close a key asks for
  lands after the entrance has finished in this harness, so the sheet's turn is covered by
  `sheets.spec.ts` ("a detent change grabbed mid-flight turns from where it is") and by the
  `animate.test.ts` case for `startOnThisFrame`.
- The drawer is a phone surface (390 px) and is checked by `drawer-motion.test.ts`: a release at
  −4 distances/s moves 4 / 120 of the way in the first 120 Hz frame where a start from rest moves
  under 1 %, never past the rest.

Tests on wave 1: the motion, capsule, frame, drawer, phone-sheet and sheet unit tests
(529, plus the new mass, fallback, `shift`, drawer hand-off and capsule-follow cases, the last
failing without its fix); `capsule.spec`, `sheets.spec` and `glass-perf.spec` on Chromium, 44
passed and 3 skipped, after round 2 narrowed `startOnThisFrame` to turns (round 1's version
failed `capsule.spec`'s dock → Locked overlap check twice). Lint, typecheck and format clean.

Budgets of wave 1 (`tools/qa/bundle-budget.ts`, no baseline written): first paint JS 74.1 → 74.2 KB gzip
(within its ≈ 0.7 KB headroom), editor initial 774.4 → 775.5 KB (+1.1 KB, cap +2 KB), compact
286.5 → 287.0 KB, first-paint CSS 9.0 KB unchanged.


## 5. What did not change

The seven tokens' values, every duration in `motion.css` §1, reduced motion's blocks, the View
Transitions, the desktop sheet's and the chrome's own logic, and every bucket (c) ease.
