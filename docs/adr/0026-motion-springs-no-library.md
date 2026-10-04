---
title: "ADR-0026: Motion: springs on platform routes, no animation library"
date: 2026-10-04
status: accepted
---

# ADR-0026: Motion: springs on platform routes, no animation library

**Status:** accepted 2026-10-04 by the owner, with the amendments of ADR-0033, `quality-bar.md` and `components/10-ink.md` · **Date:** 2026-10-04 · **Deciders:** project lead; the owner accepts ·
**Supersedes:** DESIGN §3 "Motion: short, eased, disable-able. No bouncing, no
springs in the chrome" and the token comment "motion: one curve"; DESIGN §2's 160 ms group
morph "the capsule's width following"; the global "every duration 0.01 ms" reduced-motion rule
· **Rests on:** `language.md` §7.1–§7.6, §11.1 item 5; `flows.md` §13.1, §13.2 items 6–7;
research 18 MO-1 to MO-10, MC-2 to MC-38, MP-1 to MP-12; 22 A-9, A-10, §5.2, §5.5; 15 RA-16,
RA-17

## 0. Summary

- Seven spring tokens carry position, size and scale; four eases carry opacity and colour.
- One CSS `linear()` curve serves every zero-bounce spring; only the duration changes.
- Three routes: CSS transitions with Base UI states, View Transitions for view changes only
  (capped at 240 ms), and an in-house core under 3 KB gzip for gestures. No animation library.
- Reduced motion is defined per token, from one module, with an in-app setting.

## 1. Context

Today the chrome has one curve (`--ease-out`), 60–180 ms tweens, no springs, and most views
switch instantly. The tool bar's group morph animates `width`: 59 layouts and 119 paints per
second, where `clip-path` costs no layout and half the raster time (research 18 §6.4). The
global reduced-motion rule reaches CSS animations only; in research 22 §5.2 it left Web
Animations (2 s, infinite) and View Transitions (1.3 s) running. Six script sites read
`prefers-reduced-motion` on their own.

Research 18 measured the routes in Chromium. Under 50 ms long tasks, the shape of a document
open or a render burst, a requestAnimationFrame spring lost 31 % of its frames (42 of 60 fps);
the same motion on CSS or Web Animations lost 0–2 %. Motion for React costs 25–44 KB gzip, and
its layout and `layoutId` animations run on the main thread from zero velocity. An in-house
core prototype (analytic spring, retarget with velocity, FLIP, projection, rubber band) was
1.35 KB gzip. Research 22 §5.5 measured that clicks during a View Transition land on `<html>`
and are lost, even with `pointer-events: none` on the overlay.

## 2. Decision

1. **Tokens** (`language.md` §7.1), mass 1, `k = (2π / d)²`, `c = 4π(1 − b) / d`:

   | Token | d · bounce | 99 % settle | Use |
   |---|---|---|---|
   | `--spring-press` | 0.20 s · 0 | 212 ms | Press release, switch thumbs, check boxes |
   | `--spring-quick` | 0.28 s · 0 | 296 ms | Menus, popovers, contextual bars, tiers, toasts, zoom steps, hide on scroll |
   | `--spring-smooth` | 0.36 s · 0 | 381 ms | Bar morphs, panels, reflow, side dialogs, under-light |
   | `--spring-glide` | 0.46 s · 0 | 487 ms | Phone sheets, smart zoom, large non-blocking moves |
   | `--spring-fling` | 0.40 s · 0.15 | 285 ms | Releases above 300 px/s: drop settle, sheet throw, toast swipe, pinch end |
   | `--spring-pop` | 0.32 s · 0.25 | — | One small glyph: success check, count badge; never a surface |
   | `--spring-track` | 0.10 s · 0 | 106 ms | Things that follow the pointer |

   Zero bounce for anything a click, tap or key starts; bounce only where a gesture hands over
   momentum. Eases: 60 · 120 · 180 · 280 ms, `--ease-out`, `--ease-exit`, `--ease-standard`.
2. **CSS form** (MO-2): one 21-point `linear()` curve, `--ease-spring`, for every zero-bounce
   token, with the token's duration as the time to 99.9 %; fling and pop have their own curves.
   Script springs (`motion/springs.ts`) are the same seven, physics-defined, so they accept an
   initial velocity (MO-3).
3. **Routes** (MO-8, `language.md` §7.4): (a) CSS transitions and Base UI's
   `data-starting-style` / `data-ending-style` for popups, bars, press and feedback; (b)
   `document.startViewTransition` through a 10-line helper with `flushSync` (Zustand updates
   never drive React's `<ViewTransition>`) for view changes only; (c) `apps/web/src/motion/`:
   analytic spring with retarget and velocity hand-off onto Web Animations, FLIP, a 100 ms
   velocity tracker, projection, rubber band, `reducedMotion()`, under 3 KB gzip.
4. **View Transitions ≤ 250 ms.** `--vt-duration` is 240 ms. They run for Library ⇄ document,
   page ⇄ Pages grid (on release, not scrubbed) and Compare (`flows.md` §13.1). Glass chrome
   that must stay on top gets its own `view-transition-name` with position animation off; the
   update callback returns in under 50 ms and sets focus.
5. **Catalogue** (`language.md` §7.3) with `flows.md` §13.2: *bar morph* moves the dock ⇄
   Markup palette ⇄ Pages bar ⇄ Compare bar ⇄ Locked and the ink strip's row by the
   capsule's **own** width and height on a spring, with `contain: layout style`, a constant pill
   radius and chips by FLIP (amended 2026-10-04 by `quality-bar.md` Q-6: the prototype's
   `clip-path` morph needed its shadow on a second, stretched element, and its ends squashed;
   research 18's cost of `width` was measured on an uncontained flex bar); MC-8 is "viewing ⇄
   Markup"; a new *hide on scroll* (compact, viewing only) slides the top bar and dock on
   `--spring-quick`, `inert` from the first frame, a 150 ms fade under reduced motion. Keys
   never animate tools. Every component spec picks from the named list.
6. **Rules** (MP-1 to MP-12): animate `transform` and `opacity` only, plus the capsule's own
   geometry under `quality-bar.md` Q-6; no perpetual animation in document views; motion on or under glass ≤ 500 ms (A-10); stagger
   ≤ 10 items × 12 ms; `contain: layout paint` on animated islands; `will-change` only from
   script, on ≤ 3 elements, during a gesture.
7. **Limits** (A-10, read on the 99 % settle): input-blocking ≤ 250 ms; any transition ≤ 500 ms
   and interruptible; ζ ≥ 0.9 for surfaces of 25 % of the viewport or more; ζ ≥ 0.7 for small
   controls; travel ≤ 1/3 of the viewport.
8. **Reduced motion** (`language.md` §7.5–§7.6): spatial springs become instant with any fade
   kept; fling and pop lose their overshoot; durations 0 · 100 · 150 · 150 ms; View Transitions
   lose their names and cross-fade the root in 150 ms; projection and rubber band off; drag,
   pinch, pan and ink stay 1:1. "Reduce motion: System · On" sets `data-motion="reduced"`,
   matched by the same CSS blocks as the media query; one module is the only source for script.

## 3. Consequences

- The six script `matchMedia` checks and the global 0.01 ms rule go; `motion.css` holds the
  View Transition and reduced-motion rules.
- The bar morph is rewritten on the capsule's own contained geometry (`quality-bar.md` Q-6); the zoom controller moves the page layer by
  `transform` during a gesture and commits layout once at rest (MC-23).
- `e2e/motion.spec.ts`: zero layouts during pinch and bar morph, zero frames at rest after 2 s,
  no `::view-transition` during tool switching, an animation sweep under both reduce paths.
- Popups look done at about 175 ms (today 120–180 ms tweens); full-window moves at 285 ms.
- Each new component answers research 18's MO-10 checklist: token, interruption at 50 %,
  reduced form, motion near glass over 500 ms, layout touched.

## 4. Alternatives considered

- **Motion for React (25–44 KB gzip):** its signature layout animations run on the main thread
  from zero velocity, the pattern that lost 31 % of frames; every Base UI popup would need
  controlled state; two major versions shipped in two months. If shared moves inside
  virtualized scrolling ever appear, measure `motion`'s vanilla `animate` (20.3 KB) first.
- **react-spring 10.1.2 (17.3 KB):** requestAnimationFrame only; fails the same load test.
- **`@use-gesture/react`, `@formkit/auto-animate`:** the first adds little to the existing pinch
  and wheel code (last release 2024-03); the second has fixed easing and no velocity.
- **A 0.68 s glide for view changes with pass-through input (research 18 MC-2):** clicks are
  lost while it runs (research 22 §5.5).
- **Bounce on touch, ζ 0.6–0.8 (research 19 M-30):** momentum earns bounce, input type does not.
- **Proposal B's pinch scrubbed into the grid:** `flows.md` §1.3 keeps the pinch but runs a
  240 ms transition on release, since a View Transition cannot be scrubbed.
- **Keep DESIGN §3's tweens:** no retarget with velocity and no continuity under load.
