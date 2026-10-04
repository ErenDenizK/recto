---
title: "ADR-0028: Accessibility gates for an expressive interface"
date: 2026-10-04
status: accepted
---

# ADR-0028: Accessibility gates for an expressive interface

**Status:** accepted 2026-10-04 by the owner, with the amendments of ADR-0033, `quality-bar.md` and `components/10-ink.md` · **Date:** 2026-10-04 · **Deciders:** project lead; the owner accepts ·
**Supersedes:** DESIGN §5 "Focus ring 2px accent on 2px offset" (its per-context
offsets carry over), "reduced motion respected" as a sentence with no test, and "Every new state
passes axe in English and Turkish, with Glass panels on and with Reduce transparency"; research
14 §4.3's "contrast is final" · **Amends:** research 22 A-6, A-7, A-9, A-11, A-12, A-18 and A-20, in
the wording of `language.md` §9.1 and `docs/specs/redesign.md` §6.16 · **Rests on:** `language.md` §0.1 principle 7, §9.1–§9.3, §10.2, §11.1 item
8; `flows.md` §6.1, §6.2, §7.2, §13.2 items 7 and 9; research 22 A-1 to A-24, §3.2–§3.4, §4,
§5.2, §5.5, §6.2, §7, §9, §10, §12, §14; 19 M-2, M-14; 16 G-22

## 0. Summary

- The 24 rules A-1 to A-24 become CI gates. A rule without a test counts as not met.
- Contrast is checked on rendered pixels in three engines plus a Chromium project without GPU
  compositing, not only in the model. axe stays, but it no longer proves anything about glass.
- APCA Lc ≥ 75 for primary chrome text fails the build; secondary text under Lc 60 warns.
- One focus ring for every surface and both themes: ink, lime, ink.
- A "plain" project (Glass Solid, Reduce motion On, Ambient light Off, no `backdrop-filter`)
  runs the whole accessibility suite, so every effect has a tested solid twin.

## 1. Context

Research 22 rendered today's 44 px floating bar over a white page at `#5b5d61`, not the
modelled `#47494d`. The blur loses coverage at the bar's edges, so secondary labels fall to
3.61:1 and the accent fill to 2.22:1 (§3.2). axe 4.13 reports no violation and no
"incomplete" for that bar (§3.3). The global reduced-motion rule reaches CSS animations only:
a 2 s infinite Web Animation and a 1.3 s View Transition kept running (§5.2). In forced colours
Chromium keeps `backdrop-filter` and the tint's alpha, so glass over white renders `#d2d2d2`,
not `Canvas` (§6.2). On a 390 px touch screen 26 of 34 targets are under 44 px; at 400 % zoom
the chrome overflows by 110 px; a Turkish rail label truncates to "Dosyal…" (§9, §10, §12).
Apple's first glass release measured as low as 1.5:1 and gained a Tinted option later (§7).

Today the gates are `tokens.test.ts` (modelled ratios) and `a11y.spec.ts` (axe with the
`wcag22aa` tag, English and Turkish). The M9 language (ADR-0022 to ADR-0027) puts glass on every
control, adds a light field, springs and a second theme. Each is a new way to fail on screen
while every existing test still passes.

## 2. Decision

1. **The gates** (research 22 §13, `language.md` §9.1). Each rule maps to one file:

   | Rules | Test | What it asserts |
   |---|---|---|
   | A-1 to A-6, A-11 | `styles/tokens.test.ts` | Every pair of `language.md` §1.7, §2.2, §2.6 in both themes and every settings block; the coverage term per registered surface (A-2); APCA with `apca-w3`; focus bands ≥ 9:1 |
   | A-1 to A-3, A-5, A-6, A-11 | `e2e/glass-pixels.spec.ts` | Each tier over a white page, over black (light theme) and over the light field at its cap; full-viewport screenshots only; a 4 × 4 median in a text-free spot within ±2/255 of the model; page corners identical with light on and off |
   | A-7 to A-10, A-23 | `e2e/motion.spec.ts` | Under the media query and under `data-motion="reduced"`, every `getAnimations()` entry animates only opacity or colour for ≤ 150 ms; no `::view-transition` during tool switching; zero frames at rest after 2 s; zero layouts during pinch and bar morph; light paused while `[data-stroking]`; a 10 s flash sampler, swing < 0.10 per 341 × 256 px region |
   | A-12 to A-16, A-20, A-21, A-24 | `e2e/a11y.spec.ts` | A global `focusin` hook fails on focus inside an invisible element; F6 reaches every floating surface in `flows.md` §7.2's order; a focused field or paragraph is ≥ 50 % outside every chrome rectangle; target audit in a desktop and a touch project; forced colours give `backdrop-filter: none`, hidden light and armed = `Highlight`; no overflow at 320 × 256, 360 × 640, 720 × 450; no clipped chrome label in EN and TR with the 1.4.12 stylesheet; action toasts ≥ 10 s and paused on hover or focus |
   | A-17, A-18 | `tokens.test.ts` | Media-query and attribute blocks identical (Glass, reduced transparency, more contrast) |
   | A-19 | `annotations/palette.test.ts` | State pairs without a shape cue keep ΔE_OK ≥ 10 under protan, deutan and tritan simulation (Machado 2009) |
   | A-22 | `a11y.spec.ts`, "plain" project | The whole suite with every effect at its solid twin |

   Engines: Chromium, WebKit, Firefox, and one Chromium project with GPU compositing off, the
   renderer that showed the edge leak (A-2). Every CI browser renders in software, which would
   start the app at Glass Tinted and Ambient light Still (`language.md` §2.8), so the default,
   pixel, motion and matrix projects run with ADR-0024's test-only render override (`degrade:
   'off'`, Glass Clear, Ambient light Auto); one spec without it asserts the start states. A lint bans `text-transform: capitalize` and
   argument-less `toUpperCase` / `toLocaleUpperCase` in UI code (A-21).
2. **Matrix.** `a11y.spec.ts` runs {default, Glass Solid, more contrast, forced colours} × {EN,
   TR} × {dark, light}, plus the plain project, as research 22 asks for preferences "both
   separately and together".
3. **APCA.** Primary chrome text |Lc| ≥ 75 is a gate (the lowest today is 75, light M1). Secondary
   text under Lc 60, icons under 45 and dividers under 15 warn. Dark glass secondary sits at
   54–61 (`language.md` §9.1 A-4), so the secondary warning becomes a gate only after the grey
   ladder moves.
4. **Focus ring** (`language.md` §9.2): from the element out, 2 px ink, 2 px lime `#c8fb3d`,
   2 px ink; 16.42:1 between bands, so one band clears 3:1 on any solid colour; the weakest of 20
   backdrops is 4.07:1 (selection blue). Inside capsules and scrollers it is concentric with the
   dark band inside. It never animates and serves both themes. DESIGN §5's offsets carry over.
   Forced colours keep the system outline alone.
5. **Seven amendments to research 22's wording,** made by `flows.md`, `language.md` and the M9
   spec:
   - **A-12** "chrome never auto-hides" becomes: chrome hides only on compact (compact-height
     included), in viewing, after 24 px of downward scroll, `inert` from its first exit frame;
     it returns on upward scroll, a tap, either end of the file, focus, a sheet or any key; never
     with keyboard modality or focus inside, in Markup, the Pages grid or Compare, or with "Keep
     tools visible" (`flows.md` §6.1). The A-12 test also asserts that Tab after a hide brings
     the chrome back before focus lands.
   - **A-7** "In Read and Edit" becomes "in every document view" (viewing, Markup, the Pages
     grid, Compare): light is still there except feedback bursts ≤ 2 s.
   - **A-20** "the mode, tool and export commands" becomes "Markup and every tool, Save a copy
     and Lock".
   - **A-18** "Light at half intensity" becomes "Light Off (`display: none`)", per `language.md`
     §3.4; `tokens.test.ts` and `a11y.spec.ts` assert the light canvas is hidden under more
     contrast.
   - **A-11** "2 px light `outline` (L ≥ 0.85)" becomes "light band ≥ 9:1 against
     `--focus-dark`, and the best band ≥ 3:1 over the listed backdrops": lime `#c8fb3d` has a
     relative luminance of 0.816, and `tokens.test.ts` asserts exactly this wording.
   - **A-6** excepts the armed-tool under-light, which is clipped to the palette's capsule;
     `glass-pixels.spec.ts` also asserts that page pixels outside the palette's rectangle are
     identical with a tool armed and with Light Off.
   - **A-9** exempts progress indicators (`role="progressbar"` or an `aria-busy` activity glyph)
     whose reduced form animates opacity only with a period ≥ 1.6 s (`language.md` §7.5); the
     `motion.spec.ts` sweep lists that exemption and nothing else. Every other reduced form stays
     ≤ 150 ms of opacity or colour, or none.
6. **Manual checks once per milestone:** VoiceOver on macOS and iPadOS and NVDA on Windows
   through open → read → mark up → save; a Windows contrast theme; the owner's GPU machine for
   the edge-leak probe (research 22 §15 Q1, `language.md` §11.2 Q1).
7. **Rule for component specs:** each M9 component spec names the A ids it touches and registers
   its glass surfaces (tier, smallest size, σ) in the coverage registry. A component merges only
   with its rows in the three spec files. When a gate fails, the fallback of research 22 §13
   (Tinted, the solid token, a glyph, an overflow menu) is the fix that needs no new design.

## 3. Consequences

- Migration step 1 of `language.md` §10.4 fixes failures that are true today: `--select` on the
  page, the two-band ring, σ 8 on the 44 px bar (its rendered 3.61:1), the coverage term.
- The assertions the redesign replaces retire: the 1.27:1 bar-to-canvas floor, the single
  `--elevation-float`, the periwinkle minima (`language.md` §10.2).
- The a11y suite runs 16 combinations plus the plain project, where today it runs once with
  Turkish spot checks; the pixel spec adds four browser projects. CI time grows (§5 item 1).
- Pixel tests depend on each engine's compositor. Full-viewport screenshots, text-free 4 × 4
  spots and a ±2/255 tolerance keep them stable; clipped screenshots skip backdrop filters and
  are not used.
- The three per-file `matchMedia('(prefers-reduced-motion…)')` checks go; one module answers
  (ADR-0026).
- On acceptance the lead rewrites DESIGN §5 from `language.md` §9; its "Modes and Edit (M8)"
  paragraph moves to the Markup and Lock wording of ADR-0029.

## 4. Alternatives considered

- **The model plus axe (today):** both pass a bar that fails on screen (research 22 §3.3).
- **WCAG 2 ratios only:** WCAG overstates contrast in dark mode; secondary text passes at 7.41:1
  while it reads at Lc 49.6 (research 22 §3.4). **APCA only:** WCAG 2.2 AA stays the target;
  APCA is the second check.
- **Research 20's ring (C-7: a lime outline with 2 px ink inside):** leaves lime against the
  backdrop on the outside; dark on both sides holds 4.07:1 or more over every backdrop
  (`language.md` §0.2).
- **Effects off by default, opt-in:** the owner's brief asks for glass and light at rest; the
  settings and the tested solid twin give everyone the way out instead.
- **Pixel tests in Chromium only:** WebKit is the owner's Safari and the iPad's engine, and
  Firefox renders glass differently; the edge leak itself appeared only without GPU compositing.
- **Research 22's A-12 as written (no auto-hide anywhere):** on a phone held sideways the top bar
  and dock take 88 of 390 px (23 %); research 19 M-14 hides them on scroll, and the safeguards
  above keep focus and keyboard users safe.
- **Manual audits only:** regressions between milestones go unseen.

## 5. Issues for the lead

1. **CI budget.** Nobody has measured the matrix's run time. This ADR decides: pull requests that
   touch `styles/`, `ui/`, `shell/`, `motion/`, `light/` or the message catalogs run the full
   matrix; other pull requests run default and plain in EN and TR, dark and light. Every merge to
   `develop` runs everything.
2. **Secondary text as a gate is an owner question.** Making APCA 60 a gate needs secondary grey
   lifted to about `#b0b4ba`, which flattens the hierarchy (research 22 §15 Q5). Neither
   `language.md` §11.2 nor `flows.md` §15 asks the owner; this ADR keeps it a warning in M9.
