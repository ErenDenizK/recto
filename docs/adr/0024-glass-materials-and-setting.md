---
title: "ADR-0024: Glass materials: five densities, lit glass, a coverage rule and one setting"
date: 2026-10-04
status: accepted
---

# ADR-0024: Glass materials: five densities, lit glass, a coverage rule and one setting

**Status:** accepted 2026-10-04 by the owner, with the amendments of ADR-0033, `quality-bar.md` and `components/10-ink.md` · **Date:** 2026-10-04 · **Deciders:** project lead; the owner accepts ·
**Supersedes:** DESIGN §2 "Floating chrome is frosted glass; everything docked is
opaque" and "Glass panels (a trial, default off)"; DESIGN §3 "Translucency only for floating
chrome" and "Glass panels (trial, pending S2)"; the `--glass`, `--glass-menu`, `--glass-frame`
tokens and the "Glass panels" and "Reduce transparency" switches · **Rests on:** `language.md`
§2.1–§2.10, §11.1 item 3, §11.2 Q1; `flows.md` §13.1, §13.2 items 1–4; research 14 (S2); 16
G-3 to G-13, G-21 to G-25, G-32; 22 A-1, A-2, A-17, §3.2 · **Amended before acceptance**
(`docs/specs/redesign.md` §6.16): refraction on fixed-size M1 chips only (X20), the σ steps of X6,
glass on every pointer for the top strip and compact top bar, and a test-only render override.

## 0. Summary

- One glass material in five densities, M1 chip to M5 sheet, plus lit glass where no page can
  pass under it.
- A coverage rule caps the blur on short surfaces so the page cannot leak through.
- One setting, Glass **Clear · Tinted · Solid**, and a separate automatic cost ladder.
- Backdrop refraction only in Chromium, on fixed-size M1 chips only (the page pill and facts
  chip); none on the dock, palette or bars.
- Docked glass (top strip, docked sidebar) on by default on fine pointers, pending the owner's
  S2 check.

## 1. Context

Today three rules exist: `.glass` (66 % tint, blur 28 px, brightness 0.45) on floating chrome,
`.glass-menu` on menus, and `.glass-frame` on the docked frame behind "Glass panels", default
off, pending spike S2 on the owner's machine (research 14). Research 22 §3.2 rendered the 44 px
bar over a white page at `#5b5d61`, not the modelled `#47494d`: the blur loses coverage at its
edges, so secondary labels fall to 3.61:1 and the armed fill to 2.22:1. axe reports nothing.

Research 16 set the ceiling: dark glass with light text must composite to L ≤ 0.062 over a
white page; the only free dial is transmission `k = (1 − alpha) × brightness`. Its Table 7
ramp (M3 k 0.17) lets a current row's secondary text fall to 3.98:1 (`language.md` §2.6). It
also found that backdrop refraction renders only in Chromium, and that Safari and Firefox drop
the whole declaration, blur included, when it holds `url()`. Static glass costs nothing; moving
content under glass costs per frame in proportion to blurred area (+18 % per 10 % of viewport).

## 2. Decision

1. **Tiers** (`language.md` §2.2, dark values; light tints at alpha 0.70–0.88 with the floor
   of ADR-0022):

   | Tier | Where (with `flows.md` §13.1) | σ | k | Over white |
   |---|---|---|---|---|
   | M1 chip | Page pill, facts chip, single floating buttons | 5–8 by size (28 px chips 5) | 0.210 | `#454648` |
   | M2 bar | Dock and Markup palette (one shape), options tier, pending-marks, contextual, Pages and Compare bars, toasts, progress capsule | 7–10 (36 px bars 7) | 0.198 | `#444548` |
   | M3 panel | Top strip (σ 8), docked sidebar, phone sheet at 40 % | 40; coarse 20 | 0.117 | `#34363a` |
   | M4 menu | Menus, popovers, ⌘K, preset editors | 24; 92–120 px tall 16; under 92 px 12 | 0.108 | `#36383c` |
   | M5 sheet | Sheets, dialogs, confirmations | 48; under 260 px tall 24; coarse 20 | 0.070 | `#34363b` |
   | Lit | Library and drop cards, About; dark only | 28 | 0.231 | forbidden |

2. **Rules** (`language.md` §2.1): tints neutral; no clear variant; no glass on glass; shape
   from a dark outer edge, a lit inner rim and one shadow per tier (§2.4); filters never
   animate, glass moves by `transform` and `opacity` on itself, never on an ancestor, and the
   capsule changes shape through its own width and height (G-13, G-21; amended by
   `quality-bar.md` Q-3 and Q-6); no grain on any tier (G-7 removed by `quality-bar.md` Q-1,
   2026-10-04: the owner found the prototype's grain made glass look dirty); the `-webkit-`
   line holds literal values and a test keeps it equal to the unprefixed line (G-22).
3. **Coverage rule** (A-2): `c = erf(h / 2√2σ) · erf(w / 2√2σ) ≥ 0.985` at the smallest size a
   surface renders at; in practice σ ≤ height / 5 for bars and ≤ side / 5.5 for square chips,
   and σ ≥ 16 above about 200 px of height. A registry in `tokens.test.ts` holds every surface;
   component specs extend it. `flows.md` §13.2 item 2 adds: top strip 1440 × 44 σ 8 (c 0.994),
   dock 560 × 48 σ 9 (0.992), coarse dock 600 × 56 σ 10 (0.995), phone dock 360 × 64 σ 10
   (0.999), pending-marks bar 480 × 40 σ 8 (0.988); the status bar row goes.
4. **Glass setting Clear · Tinted · Solid** (`language.md` §2.8). Clear: blur, plus lenses where
   allowed. Tinted: every text-bearing tier at alpha 0.90, blur and rim kept, lenses off; also
   the start state when WebGL names a software rasteriser (G-32). Solid: solid tokens, rim and
   shadow kept, no filters; forced by `prefers-reduced-transparency` ("Solid, set by your
   system") and by missing `backdrop-filter`. `prefers-contrast: more`: solid, strong border, no
   shadow. Forced colours: `Canvas`, `backdrop-filter: none` set explicitly. The old switches
   migrate once (reduce transparency on → Solid). Tests run with a test-only render override
   (`window.__rectoRender = { degrade: 'off', glass: 'clear', light: 'auto' }`, set by a Playwright
   init script, read by the start-state detector and the cost ladder, stripped from the deploy
   build), because every CI browser renders in software and would start at Tinted; one spec runs
   without it and asserts that a software rasteriser starts at Tinted and `hardwareConcurrency ≤ 4`
   at ladder step 2.
5. **Cost ladder**, separate from the setting: while the user scrolls, zooms or pans, if more
   than 25 % of frames exceed 20 ms in a 2 s window, step once and hold for the session: (1)
   lenses off, (2) Ambient light Still, (3) M3 to its solid token, (4) everything solid.
   `deviceMemory ≤ 4` or `hardwareConcurrency ≤ 4` start at step 2. The setting is untouched.
6. **Refraction** (`language.md` §2.7): a backdrop lens on fixed-size M1 chips only (page pill,
   facts chip), Chromium only; no lens on the capsule (dock, palette, bars), since a line may rest
   under the dock and the morph must never change the filter (spec X20); added by a class that script sets after detection, never in the
   base declaration; bezel 10–12 px, pull ≤ 6 px; at most three on screen; off on coarse
   pointers, under Tinted, Solid or Reduce motion, and while the surface animates. An
   own-content lens on segmented and slider thumbs in all engines, now on the grid scope,
   Compare's view switch and Settings (`flows.md` §13.2 item 4). None on panels, menus, sheets
   or toasts.
7. **Budget per size class** (`language.md` §2.9): blurred surfaces persistent + transient
   2 + 1 (compact), 3 + 1 (medium), 5 + 2 (expanded), 6 + 2 (large, xlarge); persistent glass
   over moving content ≤ 25 % below 840 px, ≤ 32 % above; lenses only from 840 px; M3–M5 at
   σ 20 below 840 px. On compact the pending-marks bar and options tier share the dock's
   filtered element (`flows.md` §13.2 item 3).
8. **Docked glass by default.** M3 surfaces where the stage runs under them: the top strip and
   the compact top bar are M3 glass on every pointer (σ 8 fine, 10 coarse); the docked sidebar is
   glass on fine pointers and the overlay sidebar is solid on coarse ones (M-31). Over the bare canvas M3
   composites to the solid frame colour (dark n3 exactly), so nothing changes at rest. This
   default is frozen only after the owner's S2 check; if S2 fails, M3 starts at ladder step 3.
9. **What stays solid** (`language.md` §2.10): content, in-place editors, text inputs as
   opaque wells, tooltips (solid with the rim), the dialog scrim (dim only, no blur), the phone
   sheet once it settles at 92 %, overlay sidebars on coarse pointers. At rest no glass sits
   over page content (RA-15; the free rectangle of ADR-0031).

## 3. Consequences

- `materials.css` composes the `.mat-*` rules; `.glass`, `.glass-frame` and `.glass-menu`
  leave `global.css`. σ 8 on today's 44 px bar fixes its rendered 3.61:1 in migration step 1.
- Tests: the coverage term, prefixed and unprefixed lines equal, M3 over the canvas equal to
  `--surface-frame` ± 1/255, lit glass over `#c8be34`, and `e2e/glass-pixels.spec.ts` in three
  engines plus a Chromium project without GPU compositing (ADR-0028).
- Lit glass reads only over the field; a source scan keeps `.mat-lit` out of stage and page
  modules.
- Frame cost on a real GPU stays unknown until the owner runs S2; the ladder bounds the risk.

## 4. Alternatives considered

- **Research 16's Table 7 densities (M3 0.17, M4 0.16, M5 0.09):** current rows drop secondary
  text to 3.98:1; denser tiers keep row states AA.
- **28–40 px blur on bars (research 13, 14):** leaks the page on the software compositor (22
  §3.2). **σ ≤ h / 5 alone:** fails square chips (c 0.975).
- **Research 22's oversized masked filter layer everywhere:** failed on wide bars in research
  16 §6.3; kept only for a surface that must look frostier than its size allows.
- **One "Reduce transparency" switch (M8):** cannot express Tinted, which Apple added after
  the iOS 26 backlash.
- **Docked frame opaque, or Tinted by default (DESIGN M8 trial; research 22 Q4):** M3 already
  equals the solid frame at rest; the owner's brief asks for glass at rest; S2 decides cost.
- **SVG refraction in every engine:** Safari and Firefox drop the whole declaration (16 §4.2).

## 5. Issues for the lead

1. **Lit glass has no light-theme twin.** `language.md` §2.5 makes it dark-only, while
   `flows.md` §9.1 puts lit cards on the Library. This ADR decides: in the light theme Library
   and drop cards use light M2 (floored over black, so it holds over any pigment field).
2. **S2 must cover the dock.** Research 14's S2 protocol measures the docked frame. The floating
   dock (M2, with a lens on Chromium) sits over scrolling pages at every size in viewing; the
   owner's run should add it, and the palette with the under-light, to the same scroll scenes.
