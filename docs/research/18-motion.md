---
title: "Research: motion — springs, continuity and a system that feels like butter"
date: 2026-10-04
status: snapshot
---

> Research snapshot gathered on 2026-10-04 for the M9 redesign. Apple's guidance was read from
> the JSON data behind the Human Interface Guidelines and the SwiftUI and Core Animation
> reference (`developer.apple.com/tutorials/data/…`), and from the full transcripts of WWDC18
> session 803 "Designing Fluid Interfaces" and WWDC23 session 10158 "Animate with springs"
> (fetched from their `developer.apple.com/videos` pages with curl). Material 3 values come
> from the generated token sources in `androidx/androidx` (raw GitHub). Libraries were read from
> their npm tarballs (`motion`, `framer-motion`, `motion-dom` 14.0.0, `@react-spring/core` and
> `@react-spring/web` 10.1.2, `@formkit/auto-animate` 0.10.0,
> `@atlaskit/pragmatic-drag-and-drop-flourish` 3.2.4), from a shallow clone of
> `motiondivision/motion` (CHANGELOG, source, plans) and from the `@base-ui/react` 1.8.0 and
> `react` 19.3.0 packages installed in this repository. Browser support comes from
> `@mdn/browser-compat-data` 8.1.4 and `web-features` 3.40.1 (both published 2026-10-01).
> Bundle sizes, interruption traces and compositor costs were measured for this document in
> headless Chromium 141 on a shared 4-core container with a software compositor (§6); those
> numbers are trends, not budgets. motion.dev, developer.chrome.com, webkit.org, MDN, w3.org,
> nngroup.com, m3.material.io and apple.com were not fetched (the team's notes list them as
> blocked); chromium.googlesource.com refused a curl request (403). The session's web-search
> quota ran out before two late queries, so the UIScrollView rubber-band constant (§9) and the
> React `useSyncExternalStore` caveat (§4.5) rest on established knowledge and are marked so.
> No file other than this report was written.

# Motion: springs, continuity and a motion system for Recto

## 0. Verdict

- **"Butter" is continuity, not length or bounce.** Apple's fluid-interfaces talk reduces it to:
  respond at once, let every motion be redirected or interrupted, carry the gesture's momentum,
  resist softly at limits, and think in behaviours rather than canned animations. Springs are
  "the only type of animation that maintains continuity both for static cases and cases with
  an initial velocity" (WWDC23). Recto's chrome today has one tween curve, 60–180 ms, no
  springs, and most views, panels and tabs switch instantly (§1, §10).
- **Seven spring tokens and four ease tokens.** Spatial motion (position, size, scale) uses
  springs: zero bounce for anything a click, tap or key starts, bounce 0.15 only where a gesture
  hands over momentum, 0.25 for one small success glyph and never a surface. Bigger things move
  slower: press 0.20 s, quick 0.28 s, smooth 0.36 s, glide 0.46 s perceptual duration. Opacity
  and colour use eased tweens. A critically damped spring has a single shape, so **one 21-point
  CSS `linear()` curve serves every zero-bounce token**; only the duration changes (§3).
- **Route: hybrid, without an animation library.** (1) CSS transitions with `linear()` springs
  and Base UI's `data-starting-style`/`data-ending-style` for popups, bars and chrome, 0 kB JS;
  (2) `document.startViewTransition` for three continuity moments (Home ⇄ document, Read/Edit ⇄
  Arrange, Compare), 0 kB, in Chromium 111, Safari 18 and Firefox 144; (3) a small in-house core
  (analytic spring, velocity hand-off onto Web Animations, FLIP, velocity tracker, projection,
  rubber band) for gestures. The prototype core is **1.35 kB gzip**. Motion for React costs
  25–44 kB gzip, and its layout and `layoutId` animations run in its JavaScript frame loop and
  start with zero velocity (§5).
- **Measured: the main thread is the enemy.** Under 50 ms long tasks (what a document open or a
  render burst looks like), a requestAnimationFrame spring lost 31 % of its frames (42 of
  60 fps); the same motion as a CSS or Web Animations `linear()` animation lost 0–2 % (§6.3).
  Motion's interruption trace confirms that only physics-defined springs (stiffness, damping,
  mass) keep velocity; its duration-defined springs drop it by design (§6.2).
- **Glass and motion.** Anything that moves on or under a glass surface re-runs its backdrop
  blur on every frame: 130–370 ms of compositor time per second for one 600 × 56 px capsule on
  the software renderer. At rest the cost is zero (no frames are drawn). So rest is still, motion
  near glass stays under ~600 ms, and **the tool bar morph must stop animating `width`**: it
  costs 59 layouts and 119 paints per second; `clip-path` costs no layout and half the raster
  time (§6.4). Never animate `backdrop-filter` values.
- **Aurora.** It should move in response to events and settle within 5 s: WCAG 2.2.2 requires
  a pause mechanism for auto-moving content that lasts longer, and the HIG warns against
  sustained oscillation near 0.2 Hz. If the owner wants an ambient drift on Home, step it to
  30 Hz with `steps()`: that halved compositor cost in the measurement (484 → 240 ms/s) (§6.5).
- **View transition pitfalls, measured.** A glass title bar without its own
  `view-transition-name` vanishes under a morphing element for the whole transition; with a
  name it stays on top and its blur stays live (Chromium 141). Transitions block input and pause
  rendering until the DOM update returns, so the update must stay under 50 ms and the overlay
  gets `pointer-events: none`. Zustand updates cannot drive React 19.3's `<ViewTransition>`
  (external-store updates are never transitions); call `document.startViewTransition` with
  `flushSync` instead (§4.5).
- **Reduced motion becomes token-level.** Replace today's blanket "every duration 0.01 ms" rule:
  spatial springs become cross-fades of ≤ 150 ms, 1:1 tracking stays, the aurora stands still,
  and an in-app "Reduce motion" setting joins "Reduce transparency" (§8).

---

## 1. What "flows like butter" means

### 1.1 Apple, "Designing Fluid Interfaces" (WWDC18, transcript read in full)

The talk is the best primary source for the owner's word "butter". Its claims, quoted:

| Principle | What the talk says | Consequence for Recto |
|---|---|---|
| Response | "people are really, really sensitive to latency… look for delays everywhere. It's not just swipes. It's taps, it's presses" | Press states appear on pointer-down in ≤ 1 frame; no animation delays an action |
| Redirection and interruption | "we built a fully redirectable interface"; "the thought and gesture happen in parallel" | Every spatial animation can be retargeted mid-flight from its current value and velocity |
| Hinting | objects "grow up and out towards your finger in the direction of the final state" | Menus scale from their anchor (`transform-origin` at the trigger); sheets follow the finger |
| Lightweight input, amplified output | the system builds "an inertial profile of this gesture" and transfers momentum | Flings project to an end point (§9); pinch keeps a little momentum |
| Rubber-banding | "softly indicating boundaries… it's tracking you throughout" | Zoom limits, sheet detents and list ends resist instead of stopping hard |
| Smooth frames | "it's not just about framerate. It's what's in the frames" | Limit distance per frame: large moves get longer springs |
| Behaviour over animation | "a ball attached to a spring"; "we like to avoid using duration… The spring is always moving, and it's ready to move somewhere else" | Tokens are springs with a target, not timelines |
| Damping choice | "start with 100% damping, or no overshoot"; "if a gesture has momentum… reward that momentum with a little bit of overshoot". Music: tap to open uses 100 %, swipe to dismiss 80 % | Zero bounce for clicks and keys; bounce only after a fling |
| One family | "treat behaviors as a family… once they learn one behavior of your app, they can pick up another" | One token set across every surface |
| Gesture detection | swipe "hysteresis… is usually 10 points in iOS"; "never use the center of the image as the dragging point"; "use the history of the touch" for velocity | Drag thresholds and velocity tracking in §9 |

The companion sample code (`nathangitter/fluid-interfaces`, read) converts the designer
parameters with `stiffness = (2π / response)²`, `damping = 4π · dampingRatio / response` and
projects a throw with `(v / 1000) · rate / (1 − rate)`, where `rate` is UIScrollView's
deceleration rate: 0.998 (normal) or 0.99 (fast). Its picture-in-picture throw uses damping 1.0,
response 0.4 with the finger's velocity; its rubber band is `offset^0.7` and springs back with
damping 0.6, response 0.3.

### 1.2 Apple, "Animate with springs" (WWDC23, transcript read in full)

- Animations should have continuous position *and* velocity. Ease-in-out is continuous from
  rest but "jerks to a halt as the gesture ends" because a Bézier "is just a prespecified
  curve, so there's no way to represent an initial velocity".
- A spring uses its velocity at the moment it is retargeted as the initial velocity towards the
  new target, which "makes these kind of interruptions feel smooth and natural".
- Two parameters, **duration** (perceptual, "chosen to be predictable and not move around")
  and **bounce** (−1 to 1). "A small bounce, like around 15%, doesn't feel very bouncy yet";
  30 % is noticeable; "be cautious about using values higher than around 0.4"; "When you're not
  sure, use a spring with bounce 0".
- Do not wait for a spring's settling time for user-facing changes; it is unpredictable. Use
  the perceptual duration.

### 1.3 Apple Human Interface Guidelines (JSON read)

- Motion: "Don't add motion for the sake of adding motion"; "avoid adding motion to UI
  interactions that occur frequently"; "Let people cancel motion… don't make people wait for an
  animation to complete"; "Make motion optional". Liquid Glass "responds to direct touch
  interaction with greater emphasis… but produces a more subdued effect when a person interacts
  using a trackpad". The visionOS section warns against sustained oscillation "around 0.2 Hz".
- Accessibility, Reduce Motion: reduce "automatic and repetitive animations, including
  zooming, scaling, and peripheral motion"; tighten springs to reduce bounce; keep "tracking
  animations directly with people's gestures"; replace x/y/z transitions with fades; avoid
  "animating into and out of blurs".
- Drag and drop: show the drag image after "about three points"; on a failed drop the item
  moves back or "scale[s] up and fade[s] out"; keep the dropped content selected.
- Undo: "Show the results of an undo or redo… you might scroll the document to show the
  restored paragraph."
- Progress: prefer determinate indicators; "Keep progress indicators moving"; even out the pace.
- Popovers: "animate the change [of size] to avoid giving the impression that a new popover
  replaced the old one."
- Launching: the first frame should match the first screen to avoid a flash.
- SF Symbols animations name the icon vocabulary Recto can copy: appear, disappear, bounce,
  scale, pulse, replace (down-up, up-up).

### 1.4 Material 3 and M3 Expressive (AndroidX token sources read)

Material splits springs into **spatial** (position, size, shape; may overshoot) and **effects**
(colour, opacity; never overshoot), each in fast, default and slow. Generated values
(`ExpressiveMotionTokens.kt`, `StandardMotionTokens.kt`, v0_14_0):

| Scheme | Fast spatial | Default spatial | Slow spatial | Effects (fast / default / slow) |
|---|---|---|---|---|
| Standard | k 1400, ζ 0.9 | k 700, ζ 0.9 | k 300, ζ 0.9 | k 3800 / 1600 / 800, ζ 1.0 |
| Expressive | k 800, ζ 0.6 | k 380, ζ 0.8 | k 200, ζ 0.8 | same as standard |

The tween easings in `MotionTokens.kt` include `EasingEmphasized = cubic-bezier(0.2, 0, 0, 1)`,
which is exactly Recto's `--ease-out`, and `EasingEmphasizedAccelerate = (0.3, 0, 0.8, 0.15)`
for exits. The guidance that small elements use fast and large ones slow is from the M3 blog
abstract; it matches Apple's practice.

### 1.5 Recto's motion principles (MO-1)

1. **Continuity.** Things come from where they were and go to where they will be. No
   teleporting surfaces except under Reduce Motion.
2. **Interruptible always.** Any spatial animation can be grabbed, reversed or retargeted from
   its current value and velocity. No input is ever ignored because something is animating.
3. **Momentum earns bounce.** Clicks, taps and keys get zero overshoot. Only a release with
   velocity may overshoot, and the overshoot comes from the velocity, not from the token.
4. **Bigger is slower.** Press 0.20 s → quick 0.28 → smooth 0.36 → glide 0.46 s.
5. **Rest is still.** When nothing happens, nothing animates: no shimmer, no perpetual
   drift in document views.
6. **Frequent is instant.** Tool switching by key, palette navigation, hover and focus do not
   move anything.
7. **One family.** The same tokens on every surface, in CSS and in script.

---

## 2. Springs: one model, four vocabularies

Mass is 1 everywhere. For a perceptual duration *d* and bounce *b* (SwiftUI, Core Animation):

- stiffness `k = (2π / d)²`
- damping ratio `ζ = 1 − b` for `b ≥ 0`, and `ζ = 1 / (1 + b)` for `b < 0`
- damping `c = 2ζ√k`, which for `b ≥ 0` is `4π(1 − b) / d`

SwiftUI's `Spring` reference page gives the check value: `Spring(duration: 0.5, bounce: 0.3)`
→ mass 1.0, stiffness 157.9, damping 17.6. The formula above reproduces it. Apple's "response"
(WWDC18, UIKit) is the same *d* for `b ≥ 0`, and "dampingFraction" is ζ. Motion's own
`bounceToDampingRatio` is documented in its source as mapping bounce "as SwiftUI does", but its
`visualDuration` uses `k = (2π / (1.2 · visualDuration))²`, so **Motion `visualDuration` = d / 1.2**.
react-spring's `tension` and `friction` are k and c.

SwiftUI's defaults, read from the declarations: `.smooth`, `.snappy` and `.bouncy` all default to
duration 0.5 with base bounce 0, 0.15 and 0.3; `interactiveSpring` is response 0.15, damping
fraction 0.86, blend 0.25; `.spring(response:dampingFraction:)` defaults to 0.5 and 0.825;
`Animation.default` has been a spring with response 0.55 and damping fraction 1.0 since iOS 17.

Every preset in one table (computed for this document; overshoot and settling times are for a
step from rest):

| Preset | k | c | ζ | Overshoot | Within 1 % | Within 0.1 % |
|---|---|---|---|---|---|---|
| SwiftUI `.smooth` | 157.9 | 25.1 | 1.00 | 0 % | 528 ms | 734 ms |
| SwiftUI `.snappy` | 157.9 | 21.4 | 0.85 | 0.6 % | 355 ms | 696 ms |
| SwiftUI `.bouncy` | 157.9 | 17.6 | 0.70 | 4.6 % | 523 ms | 818 ms |
| SwiftUI `interactiveSpring` | 1754.6 | 72.0 | 0.86 | 0.5 % | 109 ms | 209 ms |
| SwiftUI `Animation.default` | 130.5 | 22.8 | 1.00 | 0 % | 581 ms | 808 ms |
| M3 standard fast / default / slow spatial | 1400 / 700 / 300 | 67.3 / 47.6 / 31.2 | 0.90 | 0.2 % | 137 / 194 / 296 ms | 224 / 317 / 484 ms |
| M3 expressive fast spatial | 800 | 33.9 | 0.60 | 9.5 % | 221 ms | 359 ms |
| M3 expressive default spatial | 380 | 31.2 | 0.80 | 1.5 % | 326 ms | 435 ms |
| M3 default effects | 1600 | 80.0 | 1.00 | 0 % | 166 ms | 231 ms |
| Motion physics default | 100 | 10 | 0.50 | 16.3 % | 878 ms | 1270 ms |
| react-spring `default` | 170 | 26 | 1.00 | 0 % | 505 ms | 701 ms |

Two observations shape the tokens. First, for zero bounce the 1 % settling time is almost
exactly the perceptual duration, and 90 % of the distance is covered at 0.62 *d*: a 0.28 s spring
looks done after ~175 ms. Second, Motion's physics default (ζ 0.5, 16 % overshoot) is far
bouncier than any platform preset; Recto must never rely on library defaults.

---

## 3. Recto's motion tokens

### 3.1 Springs (spatial)

| Token | d | Bounce | k | c | ζ | Overshoot | 90 % at | 99 % at | CSS duration | Use |
|---|---|---|---|---|---|---|---|---|---|---|
| `--spring-press` | 0.20 s | 0 | 987 | 62.8 | 1.00 | 0 | 124 ms | 212 ms | 300 ms | Button and chip release, switch thumbs, check boxes |
| `--spring-quick` | 0.28 s | 0 | 504 | 44.9 | 1.00 | 0 | 174 ms | 296 ms | 420 ms | Menus, popovers, contextual bars, options tier, toasts, tab moves, zoom steps |
| `--spring-smooth` | 0.36 s | 0 | 305 | 34.9 | 1.00 | 0 | 223 ms | 381 ms | 530 ms | Tool bar morph, panels, Arrange reflow (FLIP), side dialogs, mode switch |
| `--spring-glide` | 0.46 s | 0 | 187 | 27.3 | 1.00 | 0 | 285 ms | 487 ms | 680 ms | Home ⇄ document, Read ⇄ Arrange, sheets on phones, smart zoom |
| `--spring-fling` | 0.40 s | 0.15 | 247 | 26.7 | 0.85 | 0.6 % | 203 ms | 285 ms | 560 ms | Release with velocity: drop settle, sheet throw, toast swipe, pinch end, snap back from a limit |
| `--spring-pop` | 0.32 s | 0.25 | 386 | 29.5 | 0.75 | 2.8 % | 143 ms | — | 410 ms | One small glyph: success check, count badge, the Edit hint. Never a surface |
| `--spring-track` | 0.10 s | 0 | 3948 | 125.7 | 1.00 | 0 | 62 ms | 106 ms | 150 ms | Smoothing for things that follow the pointer but may lag (resize ghost, lifted cell catching up) |

"CSS duration" is the time to come within 0.1 % of the target, rounded up to 10 ms; at that
point the residual on a 1000 px move is 1 px. In script the same springs run analytically and
end when position and speed are under 0.5 px and 2 px/s.

### 3.2 Eases (effects: opacity, colour, shadows)

| Token | Value | Use |
|---|---|---|
| `--duration-instant` | 60 ms (unchanged) | Hover colour, press-in (pointer-down) |
| `--duration-fast` | 120 ms (unchanged) | Exits, tooltip fade, icon replace |
| `--duration-base` | 180 ms (unchanged) | Enter fades, scrims |
| `--duration-slow` | 280 ms (new) | Cross-fades of large regions, aurora response fade-out |
| `--ease-out` | `cubic-bezier(0.2, 0, 0, 1)` (unchanged; M3 emphasized) | Entering fades |
| `--ease-exit` | `cubic-bezier(0.3, 0, 0.8, 0.15)` (new; M3 emphasized accelerate) | Leaving fades and scales |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` (new) | Symmetric moves without a spring (progress fills) |
| `--ease-spring` | the zero-bounce `linear()` below (new) | Every zero-bounce spring token in CSS |

Exits are shorter than entries (about 60 %) and use fades, because once a person has dismissed
something they are no longer watching it.

### 3.3 CSS form (MO-2)

A critically damped spring released from rest has one shape; only its time scale changes with
*d*. So one curve plus a duration per token covers four tokens. The curves below were generated
from the analytic solution and reduced with Ramer–Douglas–Peucker at a tolerance of 0.25 % of
the distance:

```css
:root {
  /* zero bounce: shared by press, quick, smooth, glide, track */
  --ease-spring: linear(0, 0.005 1.2%, 0.02 2.3%, 0.046 3.7%, 0.084 5.2%, 0.159 7.7%,
    0.366 13.8%, 0.461 16.8%, 0.556 20.2%, 0.639 23.5%, 0.709 26.8%, 0.767 30.2%,
    0.817 33.7%, 0.861 37.5%, 0.9 42%, 0.93 46.8%, 0.954 52.3%, 0.971 58.5%, 0.983 65.3%,
    0.991 73.7%, 1);
  --ease-spring-fling: linear(0, 0.006 1.3%, 0.024 2.7%, 0.055 4.2%, 0.094 5.7%, 0.189 8.7%,
    0.413 15%, 0.514 18%, 0.61 21.2%, 0.694 24.3%, 0.765 27.5%, 0.824 30.7%, 0.873 34%,
    0.914 37.5%, 0.946 41.3%, 0.971 45.5%, 0.988 50.2%, 1 55.7%, 1.006 67.7%, 1);
  --ease-spring-pop: linear(0, 0.007 1.5%, 0.026 3%, 0.058 4.7%, 0.105 6.5%, 0.209 9.8%,
    0.453 16.8%, 0.559 20%, 0.659 23.3%, 0.742 26.5%, 0.809 29.5%, 0.868 32.7%, 0.915 35.8%,
    0.954 39.2%, 0.984 42.8%, 1.006 46.7%, 1.02 50.8%, 1.027 55.7%, 1.027 63.3%,
    1.008 84.2%, 1);
  --spring-press: 300ms;  --spring-quick: 420ms;  --spring-smooth: 530ms;
  --spring-glide: 680ms;  --spring-fling: 560ms;  --spring-pop: 410ms;  --spring-track: 150ms;
}
/* use: transition: transform var(--spring-quick) var(--ease-spring),
                    opacity var(--duration-base) var(--ease-out); */
```

The three curves add about 0.6 kB of CSS before compression. `linear()` is Baseline widely
available (Chrome 113, Safari 17.2, Firefox 112; Baseline high since 2026-06-11). The curve
differs from today's `--ease-out` at the same total duration by at most 8.3 % of the distance,
so swapping it in will feel like the same family, only softer at the end.

### 3.4 Script form (MO-3)

`apps/web/src/motion/springs.ts` exports the same seven springs as `{ stiffness, damping, mass: 1 }`
(the "Motion config" column of §3.1), computed from *d* and *b* by the formula in §2, plus
`reducedMotion()`. Script springs must be physics-defined so they can take an initial velocity.

### 3.5 Choosing a token

- Size: press for ≤ 40 px controls, quick for popups and bars, smooth for panels and bars that
  change shape, glide for anything taking most of the window.
- Input: a click, tap or key → a zero-bounce token. A release with velocity above 300 px/s →
  `--spring-fling` with that velocity. Below 300 px/s, use the zero-bounce token for the size.
- Distance: if a move is over 1.5 window heights, do not animate it across; cross-fade or jump
  most of the way (see scrolling, MC-25).

---

## 4. Platform routes

### 4.1 Support (BCD 8.1.4, web-features 3.40.1) against Recto's policy

`docs/ARCHITECTURE.md` supports Chromium 125+, Firefox current and ESR, and Safari 18+.

| Feature | Chrome | Safari | Firefox | Baseline | Usable in Recto |
|---|---|---|---|---|---|
| Web Animations `animate()`, `getAnimations()`, `commitStyles()` | 84 | 14 | 75 | high | Yes |
| `animation-composition` / `composite: 'add'` | 112 | 16 | 115 | high | Yes |
| `linear()` easing | 113 | 17.2 | 112 | high (2026-06-11) | Yes |
| `@starting-style` | 117 | 17.5 | 129 | low (2024-08-06) | Yes |
| `transition-behavior: allow-discrete` | 117 | 17.4 | 129 | low | Yes |
| Transitioning `display` itself | 117 | 18 | **no** | no | Firefox snaps exits; keep Base UI's mount handling |
| `overlay` property | 117 | no | no | no | No |
| `interpolate-size` / `calc-size()` | 129 | no | no | no | No (do not animate to `auto`) |
| Same-document View Transitions | 111 | 18 | 144 | low (2025-10-14) | Yes; Firefox ESR older than 144 falls back to instant |
| `view-transition-class` | 125 | 18.2 | 144 | low | Yes, with names as fallback on Safari 18.0–18.1 |
| `ViewTransition.types`, `:active-view-transition-type()` | 125 | 18.2 | 147 | low (2026-01-13) | Yes, with a callback-only fallback |
| `view-transition-name: match-element` | 137 | 18.4 | 144 | — | Yes for grid cells |
| Nested view transition groups (`view-transition-group`) | 140 | no | no | — | No |
| Element-scoped `element.startViewTransition()` | 147 | no | no | no | Later; would lift the whole-page input block |
| Scroll-driven animations (`animation-timeline`) | 115 | 26 | preview only | no | Progressive enhancement only |
| `@property` registered custom properties | 85 | 16.4 | 128 | low | Yes (animating a typed `--aurora-strength`) |
| `prefers-reduced-motion` | 74 | 10.1 | 63 | high | Yes |

### 4.2 CSS transitions with `linear()` springs and Base UI

Base UI's handbook (in `node_modules`) recommends transitions over keyframes "because a
transition can be smoothly cancelled midway": a popup closed while opening animates back from
where it is. It exposes `[data-starting-style]` and `[data-ending-style]` and waits on
`element.getAnimations()` before unmounting, which also covers Firefox's missing `display`
transition. Recto's Menu, Popover, Tooltip, Command palette, Shortcut overlay and side dialogs
already use these attributes (32 selectors), so the new tokens drop in without new components.

Limits: a CSS transition that is interrupted restarts from the current value with the curve's
initial velocity, which is zero for a spring curve. The measured trace (§6.2) shows the
reversal is immediate and kinked. That is acceptable for popups (short distances, rarely
reversed) and not for gestures.

### 4.3 `@starting-style` and `transition-behavior`

Use `@starting-style` for elements that appear without Base UI: the options tier, contextual
bars, toasts, the page indicator. For exits, keep the element mounted until `transitionend`
(one hook, like today's `useRetained`), because Firefox cannot transition `display: none`.
Avoid `overlay` and `interpolate-size`: Chromium-only.

### 4.4 Web Animations: FLIP and retargeting

Web Animations run `transform` and `opacity` on the compositor, accept the `linear()` strings
and can be cancelled and replaced. With `composite: 'add'`, X and Y can run as separate
animations with separate velocities over the element's own transform. This is the engine for
FLIP (measure, mutate, invert, play) and for every gesture release in §9. Recto already uses it
for the tool bar morph (`useBarMorph` in `FloatingToolbar.tsx`), but animates `width` there
(§6.4).

### 4.5 View Transitions

What they give: the browser snapshots the old state, runs the DOM update, snapshots the new
state, and morphs named elements between their old and new boxes while cross-fading the rest.
The animations are CSS animations on pseudo-elements, so they run on the compositor and survive
a busy main thread once started. That fits Recto's heaviest moment, opening a document.

What they cost:

- **Input is blocked** during the transition; a new `startViewTransition` skips the running one
  to its end (search abstracts: vtbag.dev, css-tricks). The css-tricks abstract describes
  keeping the page interactive by letting pointer events through the overlay:
  `::view-transition { pointer-events: none; }`, so clicks reach the live new DOM underneath.
- **Rendering is paused** between the old snapshot and the end of the update callback
  (established knowledge of the specification). A 300 ms React mount is a 300 ms frozen frame.
  The update must render cheap placeholders (sized sheets, reused thumbnails) and stay under
  50 ms; page bitmaps fill in after.
- **Stacking**: all named groups paint above the root snapshot. Measured in Chromium 141
  (§6.6): an unnamed glass title bar disappears under a morphing card for the whole transition
  and pops back at the end; a named one stays on top and its backdrop blur keeps working on the
  card passing beneath. So glass chrome that must stay on top gets its own name
  (`chrome-title`, `chrome-tools`, `chrome-status`), with its group's position animation off
  and only a 150 ms cross-fade of its content.
- **Snapshots are images.** Text inside a growing snapshot scales as a bitmap; keep growth ratios
  moderate or let the new image cross-fade early.

React 19.3 (released 2026-09-09 per the React blog abstract; the installed `react@19.3.0` exports
`ViewTransition` and `addTransitionType` as stable names) offers `<ViewTransition>`, which only
animates updates inside `startTransition`, Suspense reveals or `useDeferredValue`. Recto's view
state lives in Zustand, read through `useSyncExternalStore`, and React performs
external-store updates as blocking even inside a transition (established knowledge of React's
documented caveat). So `<ViewTransition>` would never fire for Recto's view switches. The route
is a 10-line helper (MO-4):

```ts
// Reduced motion is handled in CSS (MO-5): names removed, root cross-fade of 150 ms.
const typed = typeof ViewTransition !== 'undefined' && 'types' in ViewTransition.prototype;
export function viewTransition(update: () => void, types: string[] = []) {
  if (!document.startViewTransition) return void update();          // Firefox ESR before 144
  const run = () => flushSync(update);
  return typed
    ? document.startViewTransition({ update: run, types })           // Chrome 125, Safari 18.2, Firefox 147
    : document.startViewTransition(run);                              // Safari 18.0–18.1, Firefox 144–146
}
```

### 4.6 Scroll-driven animations

Chrome 115 and Safari 26 ship them; Firefox has them only in preview. Use them only where the
fallback (no effect) is fine: the title bar's tint growing by 0.08 alpha over the first 24 px of
scroll under it (a scroll-edge effect), and the page-number pill. Drive styles with them, not
script callbacks: Motion 13.4.4 removed `ScrollTimeline` for JS callbacks after it "benchmarked
no improvement" over main-thread scroll tracking.

### 4.7 FLIP in virtualized grids

Arrange, the Pages rail and Home render through TanStack Virtual. View Transitions would need a
name per visible cell and block input; Motion's layout animations need stable mounted nodes.
Plain FLIP over the visible cells, keyed by page id, works with virtualization: cells that
enter the window are not animated. Atlassian's own post-move pattern for Pragmatic drag and drop
is a `backgroundColor` flash via `element.animate` after a reorder
(`triggerPostMoveFlash`, read), not a positional animation, because the native drag preview is
browser-drawn.

---

## 5. Libraries

### 5.1 Bundle cost (measured)

esbuild, minified, `gzip -9`, React external, entry points written for this document; the right
column is Motion's own CI budget from `framer-motion/package.json` (zlib default level).

| Option | Min | Gzip | Motion's budget |
|---|---|---|---|
| `motion/react` `<motion.div>` | 125.2 kB | 41.3 kB | 39.05 kB |
| `LazyMotion` + `m` shell only | 13.7 kB | 5.6 kB | 5 kB |
| `m` + `domAnimation` | 76.9 kB | 27.3 kB | 25.5 kB |
| `m` + `domMax` (layout, `layoutId`, drag) | 125.5 kB | 41.4 kB | 39.15 kB |
| `domMax` + `AnimatePresence` + `LayoutGroup` + `MotionConfig` | 131.3 kB | 43.6 kB | — |
| `motion` vanilla `animate` (hybrid, keeps velocity) | 55.2 kB | 20.3 kB | 18.45 kB |
| `motion/mini` `animate` (Web Animations only) | 8.5 kB | 3.4 kB | 3.2 kB |
| `motion/mini` + `spring` generator | 12.6 kB | 5.1 kB | — |
| `spring` generator alone | 4.3 kB | 2.0 kB | — |
| `animateView` (vanilla View Transition helper) | 17.1 kB | 6.7 kB | — |
| `AnimateView` (`motion/react-animate-view`) | 8.4 kB | 3.5 kB | — |
| `@react-spring/web` `useSpring` + `animated` | 42.8 kB | 17.3 kB | — |
| `@use-gesture/react` drag + pinch | 25.4 kB | 8.2 kB | — |
| `@formkit/auto-animate` | 7.9 kB | 3.2 kB | — |
| React 19.3 `ViewTransition` / `document.startViewTransition` | 0 | 0 | — |
| In-house core prototype (§5.5) | 2.4 kB | 1.35 kB | — |

The common claim that `LazyMotion` brings Motion down to "under 5 kB" is true only for the shell;
any feature bundle adds 24–38 kB. For scale, the current `main-*.js` in `apps/web/dist` is
4.06 MB minified, 1.32 MB gzip, so `domMax` would add about 3 %. Size is not the deciding factor;
behaviour is (§5.2).

### 5.2 Motion 14.0.0 (source read)

- **Release pace.** 13.0.0 on 2026-08-05, 14.0.0 on 2026-10-02, with dozens of patch releases
  between, including fixes to `AnimatePresence`, layout and `Reorder`. A dependency that Recto
  would hand its whole chrome to moves fast.
- **What is hardware-accelerated.** `supportsBrowserAnimation` only hands `opacity`, `clipPath`,
  `filter`, `transform` (as one string) and `backgroundColor` to Web Animations, and not when an
  `onUpdate` is attached. Motion's `x`, `y` and `scale` values are composed into `transform` in its
  JS frame loop, so `<m.div animate={{ x: 100 }}>` runs on the main thread.
- **Layout and `layoutId` animations** run `animateSingleValue(..., { velocity: 0, isSync: true,
  onUpdate })` in `create-projection-node.ts`: always main-thread, always from zero velocity.
  These are Motion's signature feature and the reason to pick it; they are also exactly the
  pattern that lost 31 % of frames under load (§6.3).
- **Velocity.** `spring.ts`: "Time-defined springs ignore inherited velocity. Velocity from
  interrupted animations causes massive oscillation on small-range animations." Only
  `stiffness`/`damping`/`mass` springs hand velocity over (measured, §6.2).
- **Reduced motion.** `MotionConfig reducedMotion="user"` blocks `positionalKeys` (width, height,
  top, left, right, bottom and the individual transform keys), not a `transform` string. An app
  that uses `transform` strings for acceleration must handle reduced motion itself.
- **Base UI integration** needs controlled `open`, `keepMounted` on the portal and the `render`
  prop (Base UI handbook). Recto's popups would all need rewriting to get what CSS gives today.
- **React 19 and the React Compiler.** The repository lints with `eslint-plugin-react-compiler`,
  fixed "animations replay when Suspense reveals memoized content" in 13.4.3 with a test that
  names compiler memoization (issue #3832), and has React 19 strict-mode fixes. No open
  incompatibility was found, but the search for one returned nothing conclusive.
- **`AnimateView`** (13.4.0) is built on React's `ViewTransition`, so it inherits the
  external-store limitation of §4.5.

### 5.3 react-spring 10.1.2

All animation runs in its own requestAnimationFrame loop (`@react-spring/rafz`); no Web
Animations path. Presets: default 170/26, gentle 120/14, wobbly 180/12, stiff 210/20, slow 280/60,
molasses 280/120. It retargets with velocity natively and has `skipAnimation` and
`useReducedMotion`. 17.3 kB gzip, no layout animations, no presence beyond `useTransition`.
Main-thread only, so it fails the load test the same way.

### 5.4 Smaller tools

`@use-gesture/react` (8.2 kB, last release 2024-03) normalises drag and pinch; Recto already
handles wheel, Safari gesture events and two-pointer pinch in `ReadView.tsx` and needs only a
velocity tracker on top. `@formkit/auto-animate` (3.2 kB) is FLIP on a MutationObserver with
fixed easing and no velocity, which is too little control for Arrange.

### 5.5 In-house core (prototype measured)

A prototype written for sizing (`scratchpad/m9/motion/proto/motion-core.js`, not in the
repository) contains: `spring(d, b)`; an analytic solver for the under-, critically and
over-damped cases returning position and velocity at *t*; settling time; a `linear()` generator
with Ramer–Douglas–Peucker reduction; `animateAxis()` on Web Animations with `composite: 'add'`
and `retarget()` that reads the current position and velocity analytically and starts the next
spring from them; `flip()`; a 100 ms least-squares velocity tracker; `project()`;
`rubberBand()`; `reducedMotion()`. It is **2.4 kB minified, 1.35 kB gzip**, and its retarget
trace in Chromium matches Motion's physics springs (§6.2). Production code with types, tests
and the zoom controller would plausibly stay under 3 kB gzip.

### 5.6 Comparison

| | CSS + Base UI | View Transitions | In-house core | Motion (React) | react-spring |
|---|---|---|---|---|---|
| JS cost (gzip) | 0 | 0 | ~1.4–3 kB | 25–44 kB | 17 kB |
| Runs on | compositor | compositor (after snapshot) | compositor (Web Animations) | main thread for layout, x/y/scale | main thread |
| Survives long tasks | yes | yes, once started | yes | no (layout) | no |
| Interruption | reverses from current value, velocity resets | skips to end | retarget with velocity | retarget with velocity (physics springs only) | retarget with velocity |
| Shared element | no | yes, cross-browser | via FLIP | `layoutId` | no |
| Reduced motion | token-level CSS | skip or cross-fade | `reducedMotion()` | blocks positional keys only | `skipAnimation` |
| Fits Recto for | popups, bars, hover, press, toasts | Home ⇄ document, view switches | gestures, FLIP, zoom, sheets | (nothing it does better here) | — |

---

## 6. Measurements

### 6.1 Method

Headless Chromium 141 (`/opt/pw-browsers/chromium-1194`), Playwright 1.63, 1440 × 900 at DPR 1
(spot checks at DPR 2 gave the same order), shared 4-core container, software compositor. A test
page draws two white "pages" of text with a photo-like gradient, a 600 × 56 glass capsule
(`blur(28px) saturate(1.8)`, 60 % tint) and, for aurora tests, a 1200 × 700 soft lime blob.
Each scenario ran 3 s after a 0.5 s warm-up, two repetitions, traced through a browser-level
CDP session: draws per second and `Display::DrawAndSwap` time in the GPU process (compositing),
and `Paint`, `Layout` and raster time in the renderer. "Busy" adds a 50 ms busy loop every 66 ms
on the main thread. Scripts are in `scratchpad/m9/motion/bench/`. Software-composited numbers
exaggerate blur and blending costs; compare rows, not absolute values.

### 6.2 Interruption: who keeps velocity

A box moves 0 → 400 px; at 150 ms it is sent back to 0 (positions per frame, px):

| ms | CSS transition, `linear()` spring | Motion `animate`, stiffness 246.7 / damping 31.4 | Motion `animate`, visualDuration 0.333 / bounce 0 |
|---|---|---|---|
| 141 | 272.2 | 258.1 | 258.3 |
| 158 | 293.9 | 282.3 | 282.5 |
| — | retarget to 0 | retarget to 0 | retarget to 0 |
| 174 | 285.3 | **310.2** | 273.4 |
| 191 | 265.3 | 308.0 | 256.6 |
| 208 | 239.4 | 290.6 | 230.9 |
| 241 | 183.1 | 236.5 | 177.4 |

The physics spring carries its forward speed past the reversal point and turns smoothly; the
CSS transition and Motion's duration-defined spring reverse within one frame. The in-house
prototype behaves like the physics column (294 → 314 → 315 → 297 px at the same moment).

### 6.3 The same motion under a busy main thread

| Scenario (glass capsule moving 120 px, 600 ms loop) | Draws/s | Dropped/s |
|---|---|---|
| CSS animation, `linear()` spring | 60.3 | 0 |
| CSS animation, main thread busy | 60.7 | 0 |
| Web Animations `linear()`, main thread busy | 59.0 | 1.0 |
| requestAnimationFrame spring | 60.3 | 0 |
| requestAnimationFrame spring, main thread busy | **42.0** | **18.7** |

### 6.4 What animating near glass costs

| Animated property (the glass capsule) | Compositing ms/s | Paint ms/s | Layout ms/s | Raster ms/s |
|---|---|---|---|---|
| nothing (static) | 0 | 0 | 0 | 0 |
| `transform` (moves 120 px) | 312–328 | 0 | 0 | 0 |
| `opacity` | 270–278 | 0 | 0 | 0 |
| `backdrop-filter` blur 0 → 28 px | 133–136 | 0 | 0 | 0 |
| `width` 360 → 600 px (today's morph technique) | 158–168 | 7–8 (119 paints/s) | 6–8 (59 layouts/s) | 59–67 |
| `clip-path: inset(… round 999px)` | 153–161 | 8–9 (120 paints/s) | 0 | 27–30 |

Every animation of a glass surface re-runs its blur on every frame; what differs is the
main-thread work on top. Animating the blur radius was not more expensive here (the radius
averages 14 px over the loop), but it is still ruled out: intermediate radii let page text show
through the glass, and the HIG asks to avoid "animating into and out of blurs".

### 6.5 Aurora variants (1200 × 700 lime blob drifting 400 px over 8 s)

| Variant | Draws/s | Compositing ms/s |
|---|---|---|
| radial gradients + `filter: blur(80px)`, alone | 60 | 632–654 |
| radial gradients, no filter, alone | 60 | 476–496 |
| pre-blurred PNG, alone | 60 | 436–486 |
| gradients under the glass capsule | 57 | 658–695 |
| gradients, `steps(240)` (30 Hz), alone | **30** | **235–246** |
| gradients, `steps(120)` (15 Hz), alone | 15 | 113–125 |
| gradients, 30 Hz, under the glass capsule | 30 | 320–373 |

Chromium skips frames when a stepped animation's value does not change, so the cost falls in
proportion to the step rate. At 30 Hz a 50 px/s drift moves 1.7 px per step under an 80 px soft
edge, which reads as smooth. A live `filter: blur()` on a moving layer adds about a third; the
soft shape should come from gradients or a pre-blurred image.

### 6.6 A glass title bar during a view transition

A 160 × 210 card morphs to full screen under a 120 px glass title bar (3 s linear, screenshot at
2.6 s). With the bar unnamed, the card covers the bar completely (bar region mean luminance
145, standard deviation 100: raw stripes). With `view-transition-name` on the bar, the bar stays
on top and blurs the stripes passing under it (mean 94, deviation 25, versus 107 and 22 at rest
after the transition). Chromium only; Safari and Firefox need the same check on the owner's
machines.

---

## 7. Performance rules

- **MP-1 Compositor properties only.** Animate `transform` and `opacity`. `clip-path` is allowed
  on chrome-sized elements (≤ 800 × 80 px) for shape morphs. Never animate `width`, `height`,
  `top`, `left`, `margin`, `padding`, grid tracks or `font-size`; never trigger layout on the
  stage during an animation.
- **MP-2 Glass values are constants.** `backdrop-filter` parameters never animate. To change a
  surface's density, cross-fade the opacity of a tint pseudo-element above the fixed blur. Never
  fade an ancestor of a glass surface (it becomes the backdrop root; research 13 §2).
- **MP-3 Motion near glass is short.** Anything moving on or under a glass surface runs ≤ 600 ms
  and never loops. Large glass (panels) moves only on open and close.
- **MP-4 Rest is free.** No perpetual animation in Read, Edit, Arrange or Compare. A static
  scene drew zero frames (§6.4); keep it that way. Spinners exist only while work runs.
- **MP-5 Ambient motion is stepped.** Any ambient animation (only the optional Home aurora)
  uses `steps()` at ≤ 30 Hz and stops when the tab is hidden or after 5 s without input.
- **MP-6 Main-thread animation only for 1:1 tracking.** Anything not directly following a
  pointer is handed to CSS or Web Animations (§6.3). Gesture code reads input in
  `pointermove` (with `getCoalescedEvents()`) and writes one `transform` per frame.
- **MP-7 Time, not frames.** Chrome drives 120 Hz displays; Safari keeps web content near 60 fps
  unless a hidden feature flag is turned off (search abstracts, Safari 26.3). Springs are
  evaluated against `performance.now()`; per-frame main-thread work stays under 2 ms (a 120 Hz
  frame is 8.3 ms).
- **MP-8 Layout once per gesture.** Pinch, zoom steps and panel resizes animate a `transform`
  and commit the real layout once at the end (today every wheel event re-lays-out the column,
  `ReadView.tsx`).
- **MP-9 `will-change` hygiene.** No `will-change` in stylesheets. Script may set
  `will-change: transform` on at most three elements for the duration of a gesture and removes
  it on release; animations promote their own layers.
- **MP-10 View transitions stay cheap.** The update callback renders placeholders and returns in
  under 50 ms; name only the shared element and the chrome that must stay on top (≤ 6 names
  plus `match-element` cells in a view switch); one transition at a time.
- **MP-11 Stagger is bounded.** At most 10 items × 12 ms (120 ms in total); later items appear
  with the last step.
- **MP-12 Contain animated islands.** `contain: layout paint` on the tool bar, tiers, toasts and
  popups so their paint never invalidates the stage.

---

## 8. Reduced motion and accessibility

Today `global.css` sets every animation and transition to 0.01 ms under
`prefers-reduced-motion: reduce`, and `tokens.css` zeroes the durations. That removes fades too,
which the HIG offers as the replacement for movement, and it cannot be switched per app.

- **MO-5 Token-level reduction.** Under reduced motion: spring durations → 0 and spatial
  offsets (`--rise-distance`, scale factors) → none; entry fades stay at 150 ms and exits at
  100 ms; view transitions become a 150 ms cross-fade of the root with no named groups
  (`view-transition-name: none` on everything); FLIP and morphs are instant; 1:1 tracking of a
  finger or pen stays; projection and momentum are off (a release stops where it is, then snaps
  without overshoot); the aurora stands still and its responses are opacity changes of ≤ 200 ms;
  spinners keep turning (they carry information) but at one turn per 1.6 s.
- **MO-6 In-app setting.** Appearance gets "Reduce motion" (`data-motion="reduced"` on the root)
  beside "Reduce transparency", for people who want it in Recto only.
- **WCAG** (established knowledge of WCAG 2.2): 2.2.2 Pause, Stop, Hide (level A) applies to
  content that moves automatically for more than 5 s in parallel with other content, which an
  ambient aurora is; 2.3.3 Animation from Interactions (AAA) asks that interaction-triggered
  motion can be disabled, which MO-6 provides; 2.3.1 forbids more than three flashes per second,
  which no Recto flash approaches (the undo flash is one 600 ms pulse).
- **Focus never animates.** The focus ring appears in the same frame as focus.
- **Nothing is conveyed only by motion.** Every animated state change also changes text, an
  icon or a live-region message (as the M8 announcer does).

---

## 9. Gestures: tracking, velocity, projection, rubber band

- **Start thresholds.** Pan or drag starts after 4 px with a mouse, 3 px with a pen and 10 px
  with touch (the WWDC18 "10 points" hysteresis; the HIG's "about three points" for a drag
  image). Below the threshold a press is still a click.
- **Tracking.** Content moves 1:1 with the pointer from the start point, keeping the grab
  offset ("never use the center… as the dragging point").
- **Velocity.** Least squares over the last 100 ms of samples, including coalesced events. If the
  last sample is older than 50 ms at release, velocity is 0 (the person stopped).
- **Projection.** `end = x + (v / 1000) · r / (1 − r)` with `r = 0.998` for throws of things
  (≈ v × 0.5 s: a 1000 px/s flick projects 499 px) and `r = 0.99` for zoom and fine controls
  (≈ v × 0.1 s). Pick the snap target nearest the projected end, then spring there with
  `--spring-fling` and the release velocity, normalised to the remaining distance.
- **Rubber band.** Past a limit, show `f(x) = (1 − 1 / (x · 0.55 / D + 1)) · D`, where *x* is
  the overshoot and *D* the dimension (UIScrollView's constant, established knowledge; the
  WWDC18 sample uses `x^0.7`). Release springs back with `--spring-fling`.
- **Pinch zoom (MO-7).** During the gesture, scale the page layer with `transform` around the
  pinch centre; commit zoom and layout at the end and re-render sharper bitmaps after the
  existing 160 ms debounce. On release, take the velocity of log2(zoom), project with
  `r = 0.99`, snap to fit width, fit page or 100 % if the projection lands within 6 %
  (|log2 ratio| < 0.084), rubber-band past `MIN_ZOOM`/`MAX_ZOOM` in log space with
  `shown = limit · 2^(L · (1 − 1 / (1 + e / L)))`, `e = log2(raw / limit)`, `L = 0.25`
  (at most 19 % past the limit), and settle with `--spring-fling`. Trackpad ctrl+wheel
  (small, continuous deltas) tracks 1:1; a mouse notch (|deltaY| ≥ 50 in pixel mode, or line
  mode) animates one ×1.26 step with `--spring-quick`, and further notches retarget with
  velocity.
- **Touch input feels more.** Following the HIG's Liquid Glass note: press scale 0.94 for touch
  and pen, 0.97 for mouse; the glass highlight under a finger is twice as bright as under a
  cursor.

---

## 10. Catalogue of Recto's transitions

Token columns: perceived "done" time (90 %) and CSS duration from §3.1. "RM" is the
reduced-motion alternative. Route: **C** CSS transition or `@starting-style`, **B** Base UI
attributes, **V** view transition, **W** Web Animations through the in-house core, **G** gesture
code plus W.

### 10.1 Navigation and documents

| Id | Transition | Trigger | What moves | Token | Interruption | RM | Route |
|---|---|---|---|---|---|---|---|
| MC-1 | Launch | first paint | Shell appears in its final layout (no splash, per HIG "launching"); aurora fades 0 → rest strength over 600 ms `--ease-out` after fonts load | ease | — | aurora appears in 150 ms | C |
| MC-2 | Home card → document | click/Enter on a card, `Mod+O` result, tab from Home | Card thumbnail morphs into page 1 at its fitted rectangle (`doc-<id>`); other cards fade and scale to 0.98 with the root; chrome cross-fades 150 ms in place | glide (285 / 680 ms) | Esc or another navigation calls `skipTransition()`; clicks pass through the overlay | root cross-fade 150 ms | V |
| MC-3 | Document → Home | close last view, `0`, app glyph | Reverse of MC-2 into the card (type `back`); the card list's scroll keeps the card in view first | glide | as MC-2 | cross-fade 150 ms | V |
| MC-4 | Tab switch | tab click, `Mod+1…9`, `Ctrl+Tab` | Stage content swaps instantly with a 120 ms fade of the incoming page; the selected-tab pill slides (FLIP on its `transform`) | quick | pill retargets with velocity | pill jumps | W + C |
| MC-5 | Tab open | file opened, Combine result | New tab scales 0.9 → 1 with opacity; neighbours slide (FLIP) | quick | retarget | instant | W |
| MC-6 | Tab close | × or `Mod+W` | Ghost of the tab fades in 100 ms `--ease-exit`; neighbours slide in. While the pointer stays in the strip, tab widths stay frozen so the next × lands under it; reflow 300 ms after the pointer leaves | quick | retarget | instant | W |
| MC-7 | Tab reorder | drag (native preview) | Insertion gap opens under the pointer (neighbours slide); on drop the tab flies from the pointer to its slot | quick; fling at drop | retarget | instant | W |
| MC-8 | Read ⇄ Edit | segment, `1`/`2`, a tool key in Read | The one-button "Edit" capsule morphs into the full bar (`clip-path` on the glass layer, chips by FLIP, 15 ms stagger); the lock glyph does an icon "replace" (down-up, 120 ms); the page never moves | smooth (223 / 530 ms) | retarget from current shape | 120 ms cross-fade | W + C |
| MC-9 | Read/Edit ⇄ Arrange | segment, `3` | Current page morphs into its grid cell (`page-current`); visible cells fade in, staggered by distance from it (MP-11); reverse on return | glide | skip to end | cross-fade 150 ms | V |
| MC-10 | Compare open/close | Compare command, `4` | Current page morphs into the left pane; the second pane slides 24 px + fades in | glide | skip | cross-fade | V |

### 10.2 Tools and chrome

| Id | Transition | Trigger | What moves | Token | Interruption | RM | Route |
|---|---|---|---|---|---|---|---|
| MC-11 | Tool bar group morph | group chip, group key | Glass background changes shape by `clip-path: inset(0 Lpx 0 Rpx round 999px)`; the chosen chip slides by FLIP; others fade and slide 8 px (replaces today's `width` animation) | smooth | retarget mid-morph | instant | W |
| MC-12 | Options tier | armed tool pressed again | Rises from the bar's top edge: `translateY(8px) scale(0.98)` + opacity → rest; exit 100 ms fade; switching tools while open cross-fades content in 80 ms and morphs the tier's shape | quick (174 / 420 ms) | reverses from current | fade only | C |
| MC-13 | Contextual bar at a selection | selection made, page menu | Appears from the anchor side: 4 px + `scale(0.96)` + opacity, `transform-origin` at the anchor; moves < 200 px when the selection changes, else fades out 80 ms / in 120 ms; hidden while the selection is dragged, back 150 ms after | quick | retarget | fade only | C + W |
| MC-14 | Menus and popovers | click, keyboard | `[data-starting-style]`: `scale(0.96)` + 4 px toward the anchor + opacity 0; `transform` on `--spring-quick` with `--ease-spring`, opacity 120 ms; `[data-ending-style]`: opacity 100 ms + `scale(0.98)` on `--ease-exit`. Submenus opened by hover within 300 ms of a sibling do not animate | quick | reverses from current | 120 ms fade | B |
| MC-15 | Tooltips | 500 ms hover, then 0 ms while warm | opacity + `scale(0.98)` 120 ms (unchanged); no animation when warm | ease | — | fade | B |
| MC-16 | Command palette | `Mod+K` | `scale(0.98)` + opacity on quick; scrim 180 ms; results and the selection highlight never animate (typing speed) | quick | reverses | fade | B |
| MC-17 | Dialogs | command | Centre: `scale(0.96)` + opacity on quick, scrim 180 ms, exit 120 ms. Side dialogs: 24 px from their edge + opacity on smooth | quick / smooth | reverses | fade | B |
| MC-18 | Sheets (phone ≤ 600 px) | open, drag handle | From `translateY(100%)` to the medium (50 %) or large (92 %) detent on glide; 1:1 drag; rubber band above large; release projects with `r = 0.998` to a detent or dismiss below half of medium, `--spring-fling` with velocity | glide / fling | grab at any time | fade 150 ms, drag still 1:1 | G |
| MC-19 | Panel open/close | rail button, `Mod+Alt+B` | Panel slides its own width by `transform`; the stage's free rectangle switches once at the start and the page column slides from its old to its new place (FLIP), in sync | smooth | retarget | instant | W |
| MC-20 | Panel resize | handle drag | Panel edge 1:1; pages stay where they are (the stage already runs under the panel) and re-fit once at release by FLIP; double-click resets on smooth | smooth at release | — | re-fit instant | G |
| MC-21 | Press feedback | pointer-down / up | Scale to 0.97 (mouse) or 0.94 (touch, pen) in 60 ms `--ease-out`; release on `--spring-press`; glass buttons light a highlight under the pointer | press | release mid-press reverses | colour change only | C |
| MC-22 | Read-lock hint | a write attempt in Read | The Edit button pops once (scale 1 → 1.06 → 1) with a short tooltip, never a shake | pop | — | 600 ms ring | C |

### 10.3 Pages, zoom and drag

| Id | Transition | Trigger | What moves | Token | Interruption | RM | Route |
|---|---|---|---|---|---|---|---|
| MC-23 | Zoom by button or key | `Mod+=`/`Mod+-`, status-bar buttons | Page layer scales around the viewport centre by `transform`; layout commits at rest; repeated presses retarget | quick | retarget with velocity | instant | W |
| MC-24 | Pinch, ctrl+wheel, smart zoom | trackpad, touch, mouse notch, double-click/tap | As MO-7; double-click zooms so the clicked text block's width fills the view minus 32 px (from the text layer), double-click again returns to the previous zoom | track → fling; glide for smart zoom | grab mid-settle | 1:1 kept; no momentum; smart zoom instant | G |
| MC-25 | Programmatic scroll | go to page, find, outline, links, undo reveal | Native smooth scroll up to 1.5 window heights; farther, jump to 1 window height before the target, then smooth scroll | browser | user scroll cancels | instant | C |
| MC-26 | Scroll snapping | — | None in continuous Read. Single-page layout and phone paging: `scroll-snap-type: x mandatory; scroll-snap-stop: always` | native | native | native | C |
| MC-27 | Arrange reorder | drop, keyboard move, Reverse | Visible cells slide to new places (FLIP) on smooth; the dropped cell flies from the pointer to its slot on fling, then a 600 ms accent flash; cells entering the virtual window are not animated | smooth / fling | retarget | instant + flash | W |
| MC-28 | Arrange delete, rotate, split, merge | commands | Deleted cell: `scale(0.9)` + fade 120 ms `--ease-exit`, neighbours slide; rotate: thumbnail turns 90° on smooth, then swaps to the new bitmap; sections slide apart/together | smooth | retarget | instant | W |
| MC-29 | Drag lift and settle | 3–10 px move (§9), 300 ms long-press on touch | Native drag preview (browser-drawn, static); the source dims to 40 % in 100 ms; valid drop settles by FLIP (MC-27); invalid drop restores the source in 150 ms; files from outside: overlay fades 120 ms and the aurora brightens | fling | — | instant | W |
| MC-30 | Page bitmaps and thumbnails | render finished | Thumbnails fade in 120 ms; a sharper page bitmap replaces the stretched one instantly (same geometry, no flash); placeholders are plain sheets, no shimmer | ease | — | instant | C |

### 10.4 Feedback

| Id | Transition | Trigger | What moves | Token | Interruption | RM | Route |
|---|---|---|---|---|---|---|---|
| MC-31 | Toasts | undo-able action, completion | Enter 16 px from the bottom + opacity on quick; exit 120 ms; stacked toasts slide (FLIP); swipe dismisses when the projection (`r = 0.998`) passes half the toast or speed > 800 px/s; the timer pauses on hover and focus | quick / fling | grab at any time | fade | C + G |
| MC-32 | Undo / redo | `Mod+Z`, toast Undo | Reveal the change (MC-25), then a 600 ms accent ring flash (80 ms in, 200 ms hold, 320 ms out); Arrange cells re-enter by `scale(0.92)` → 1 on smooth | smooth | — | ring only | W |
| MC-33 | Loading | engine work | Determinate bar fills by `transform: scaleX()`, 200 ms `--ease-standard` per update to even out the pace; indeterminate spinner 0.9 s per turn, linear; same place every time (status area) | ease | — | 1.6 s per turn | C |
| MC-34 | Processing done, success | OCR, compress, export, redact applied | Spinner → check by icon "replace" (down-up, 120 ms); the check pops; aurora response (MC-36) | pop | — | icon swap only | C |
| MC-35 | Find | next/previous match | Page scrolls (MC-25); the current-match highlight pops once | pop | next press retargets | none | C |
| MC-36 | Aurora response | open (MC-2), success (MC-34), file drag-over (MC-29) | Opacity of a pre-rendered aurora layer (typed `@property --aurora-strength`) rises +0.3 on glide, holds, falls over `--duration-slow` and a further 800 ms; for opens it also drifts 24 px toward the opened card. Responses never overlap: a new one retargets the strength | glide in, ease out | retarget | opacity ≤ 200 ms, no drift | C |
| MC-37 | Ambient aurora (only if the owner wants it, §12) | Home visible | Two or three soft layers drift ±40 px on incommensurate periods (23, 37, 53 s; all far from 0.2 Hz), `steps()` at 30 Hz; pauses when hidden or after 5 s without input; Appearance offers "Ambient light: moving / still" | linear drift | — | still | C |
| MC-38 | Ink | pen down | No animation on the stroke (latency first); the bar and tiers fade to 20 % over 120 ms during a stroke and 1 s after (unchanged) | ease | — | unchanged | C |

---

## 11. Recommendation

**MO-8 Decision: hybrid, no animation library.** CSS + Base UI for popups, bars, press and
feedback; `document.startViewTransition` through the helper in §4.5 for MC-2, MC-3, MC-9 and
MC-10; an in-house `apps/web/src/motion/` module (~1.4–3 kB gzip) for FLIP, retargeting, zoom and
sheets. Reasons, in order:

1. Recto's main thread is busiest exactly when its big transitions run (document open, render
   bursts, React mounts). Compositor-driven routes held 59–61 fps under 50 ms long tasks;
   main-thread springs dropped to 42 fps (§6.3). Motion's distinctive features (layout,
   `layoutId`, `AnimatePresence` exits driven by its own values) are main-thread and start from
   zero velocity (§5.2).
2. The two hard problems are owned by the platform or by a few hundred lines: shared-element
   continuity by View Transitions (all three engines since Firefox 144), velocity hand-off by an
   analytic spring on Web Animations (§5.5, §6.2).
3. Base UI already gives interruptible enter and exit through CSS; Motion would require
   rewriting every popup around controlled state and `keepMounted`.
4. Zero to 3 kB instead of 25–44 kB, and no dependency on a library that shipped two major
   versions in two months.

**When to revisit.** If the redesign adds shared-element moves inside scrolling, virtualized
content that View Transitions cannot express, or nested shared layouts beyond FLIP, measure
`motion` vanilla `animate` (20.3 kB, Web Animations with velocity) before the React layer.

**Adoption order (each step is shippable on its own).**

1. Tokens (MO-2, MO-3), token-level reduced motion and the setting (MO-5, MO-6).
2. Popups, tiers, contextual bars and toasts on the new tokens (MC-12–MC-17, MC-31).
3. The tool bar morph to `clip-path` + FLIP (MC-11, MC-8).
4. The motion core with tests: spring solver against the SwiftUI check value (157.9 / 17.6),
   `linear()` output, retarget continuity, projection, rubber band.
5. Zoom controller (MO-7, MC-23, MC-24): transform during gestures, one layout per gesture.
6. View transitions for Home ⇄ document and the view switches (MO-4, MC-2, MC-3, MC-9, MC-10),
   with named chrome (§4.5).
7. FLIP for tabs, panels and Arrange (MC-4–MC-7, MC-19, MC-20, MC-27, MC-28).
8. Aurora responses (MC-36), then MC-37 if the owner chooses it.

**MO-9 Tests.** A Playwright trace test per view asserts zero layouts during a pinch and during
the tool bar morph, zero frames drawn at rest after 2 s, and that every spatial transition has
an instant or fade path when `data-motion="reduced"`. The glass and motion budgets of research
14 are re-measured on the owner's machines with these animations running.

**MO-10 Motion review checklist** (for each new component): which token and why; what happens
if it is interrupted at 50 %; what it does under reduced motion; does it move anything near
glass for longer than 600 ms; does it touch layout.

---

## 12. Open questions for the owner

1. **Ambient aurora.** Event-driven only (moves on open, success, drag-over and settles within
   5 s; no control needed), or also a slow drift on Home (needs an "Ambient light: moving /
   still" control for WCAG 2.2.2, and costs a constant 30 Hz of compositing while Home is open)?
2. **Bounce.** Is a 0.6 % overshoot after flings and 2.8 % on one success glyph acceptable, or
   should nothing overshoot at all? The proposal uses velocity-driven overshoot only.
3. **Speed.** Popups that look done at ~175 ms and full-window moves at ~285 ms are slower than
   today's 120–180 ms tweens and faster than Apple's 0.5 s defaults. Should Recto lean faster
   (pro tool) or softer (consumer feel)?
4. **Input block during the open zoom.** With pass-through pointer events the new document is
   usable during the 0.68 s morph; without them clicks are lost for that time. Pass-through is
   proposed.
5. **Devices.** A ProMotion Mac or iPad with Safari's "near 60 fps" flag on and off, and the
   owner's main laptop, to replace the software-renderer trends in §6 with real budgets.

---

## Sources

Read in full (primary):

- Apple HIG, read through the JSON data behind each page:
  [Motion](https://developer.apple.com/design/human-interface-guidelines/motion),
  [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility),
  [Materials](https://developer.apple.com/design/human-interface-guidelines/materials),
  [Drag and drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop),
  [Undo and redo](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo),
  [Loading](https://developer.apple.com/design/human-interface-guidelines/loading),
  [Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators),
  [Launching](https://developer.apple.com/design/human-interface-guidelines/launching),
  [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback),
  [Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers),
  [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets),
  [Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures),
  [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars),
  [Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics),
  [SF Symbols](https://developer.apple.com/design/human-interface-guidelines/sf-symbols)
- SwiftUI and Core Animation reference (JSON):
  [Spring](https://developer.apple.com/documentation/swiftui/spring),
  [smooth(duration:extraBounce:)](https://developer.apple.com/documentation/swiftui/animation/smooth(duration:extrabounce:)),
  [snappy(duration:extraBounce:)](https://developer.apple.com/documentation/swiftui/animation/snappy(duration:extrabounce:)),
  [bouncy(duration:extraBounce:)](https://developer.apple.com/documentation/swiftui/animation/bouncy(duration:extrabounce:)),
  [spring(duration:bounce:blendDuration:)](https://developer.apple.com/documentation/swiftui/animation/spring(duration:bounce:blendduration:)),
  [spring(response:dampingFraction:blendDuration:)](https://developer.apple.com/documentation/swiftui/animation/spring(response:dampingfraction:blendduration:)),
  [interactiveSpring](https://developer.apple.com/documentation/swiftui/animation/interactivespring(response:dampingfraction:blendduration:)),
  [Animation.default](https://developer.apple.com/documentation/swiftui/animation/default)
- [WWDC18 803, Designing Fluid Interfaces](https://developer.apple.com/videos/play/wwdc2018/803/) (transcript)
- [WWDC23 10158, Animate with springs](https://developer.apple.com/videos/play/wwdc2023/10158/) (transcript)
- [nathangitter/fluid-interfaces](https://github.com/nathangitter/fluid-interfaces) (sample code: spring conversion, projection, rubber band)
- AndroidX Material 3 tokens:
  [ExpressiveMotionTokens.kt](https://github.com/androidx/androidx/blob/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/ExpressiveMotionTokens.kt),
  [StandardMotionTokens.kt](https://github.com/androidx/androidx/blob/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/StandardMotionTokens.kt),
  [MotionTokens.kt](https://github.com/androidx/androidx/blob/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/MotionTokens.kt)
- [motiondivision/motion](https://github.com/motiondivision/motion): `CHANGELOG.md`,
  `packages/motion-dom/src/animation/generators/spring.ts`,
  `packages/motion-dom/src/animation/waapi/supports/waapi.ts`,
  `packages/motion-dom/src/animation/waapi/utils/accelerated-values.ts`,
  `packages/motion-dom/src/projection/node/create-projection-node.ts`,
  `packages/motion-dom/src/render/utils/keys-position.ts`,
  `plans/035-bundle-size-budget-enforcement.md`; npm
  [motion 14.0.0](https://www.npmjs.com/package/motion),
  [framer-motion 14.0.0](https://www.npmjs.com/package/framer-motion) (`bundlesize` budgets)
- npm [@react-spring/core 10.1.2](https://www.npmjs.com/package/@react-spring/core),
  [@react-spring/web 10.1.2](https://www.npmjs.com/package/@react-spring/web),
  [@formkit/auto-animate 0.10.0](https://www.npmjs.com/package/@formkit/auto-animate),
  [@use-gesture/react 10.3.1](https://www.npmjs.com/package/@use-gesture/react),
  [@atlaskit/pragmatic-drag-and-drop-flourish 3.2.4](https://www.npmjs.com/package/@atlaskit/pragmatic-drag-and-drop-flourish)
- `@base-ui/react` 1.8.0, `docs/react/handbook/animation.md` (installed package);
  `react` 19.3.0 and `@types/react` 19.3.0 exports (installed packages)
- [@mdn/browser-compat-data 8.1.4](https://www.npmjs.com/package/@mdn/browser-compat-data) and
  [web-features 3.40.1](https://www.npmjs.com/package/web-features) (`data.json`)
- Recto: `docs/DESIGN.md` §1, §3; `docs/ARCHITECTURE.md` (browser policy);
  `docs/research/13-glass-and-modes.md`, `docs/research/14-glass-spike.md`;
  `apps/web/src/styles/tokens.css`, `apps/web/src/styles/global.css`,
  `apps/web/src/shell/FloatingToolbar.tsx`, `apps/web/src/stage/ReadView.tsx`,
  `apps/web/src/stage/ArrangeView.tsx`, `apps/web/src/dnd/page-drag.ts`

Known only from search abstracts:

- [React 19.3 release post](https://react.dev/blog/2026/09/09/react-19-3) (release date,
  `<ViewTransition>` stable, triggers)
- [M3 Expressive motion blog](https://m3.material.io/blog/m3-expressive-motion-theming) and
  [M3 motion overview](https://m3.material.io/styles/motion/overview/how-it-works) (spatial vs
  effects, speed by size)
- [Chromium `core/animation` README](https://chromium.googlesource.com/chromium/src/+/master/third_party/blink/renderer/core/animation/README.md)
  (transform, opacity, filter and backdrop-filter can run on the compositor)
- [View Transitions: What Could Possibly Go Wrong?](https://vtbag.dev/tips/view-transition-fails-and-fixes/),
  [Keeping the page interactive while a View Transition is running](https://css-tricks.com/keeping-the-page-interactive-while-a-view-transition-is-running/),
  [What's new in view transitions (2025)](https://developer.chrome.com/blog/view-transitions-in-2025),
  [Element-scoped view transitions](https://developer.chrome.com/docs/css-ui/view-transitions/element-scoped-view-transitions),
  [Firefox 144 release notes](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/144)
  (input blocking, skipping, nested groups in Chrome 140, Firefox 144 support; support versions
  confirmed in BCD)
- Safari 120 Hz: [MacRumors](https://www.macrumors.com/how-to/enable-smoother-120hz-browsing-in-safari/),
  [Birchtree](https://birchtree.me/blog/how-to-enable-120hz-mode-in-safari-mac-iphone-and-ipad/),
  [Letem světem Applem, 2026-01-25](https://www.letemsvetemapplem.eu/en/2026/01/25/jak-zapnout-plynulejsi-prohlizeni-webu-na-iphone-a-macu-mame-reseni/)
- Backdrop-filter animation cost:
  [codefronts](https://codefronts.com/motion/css-transition-designs/glassmorphism-hover-transition/),
  [allocsys/ai-campaign-builder#122](https://github.com/allocsys/ai-campaign-builder/pull/122)

Established knowledge (not verified this session): the View Transitions rendering pause during
the update callback; React's rule that `useSyncExternalStore` updates are not transitions;
UIScrollView's rubber-band constant 0.55; WCAG 2.2 success criteria 2.2.2, 2.3.1 and 2.3.3.
