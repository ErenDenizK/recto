---
title: "ADR-0025: Light: an in-house aurora that answers events"
date: 2026-10-04
status: proposed
---

# ADR-0025: Light: an in-house aurora that answers events

**Status:** proposed · **Date:** 2026-10-04 · **Deciders:** project lead; the owner accepts ·
**Supersedes on acceptance:** DESIGN §1 "Nothing glows" (with ADR-0022); DESIGN §6 is kept
("no gradient" applies to the glyph; the aurora is atmosphere, not logo) · **Rests on:**
`language.md` §1.6, §3.1–§3.5, §11.1 item 4, §11.2; `flows.md` §9.1, §13.1, §13.2 item 5;
research 17 AU-1 to AU-22; 16 G-14 to G-16; 18 §6.5; 19 M-32; 22 A-5 to A-8, §5.3

## 0. Summary

- One WebGL 1 fragment shader written in-house, about 3 KB gzip, rendered at 1/8 of the CSS
  size. No library.
- Still by default. It moves on arrival, drag-over, work and success, and settles within 5 s.
- It lives in named places only: the Library, behind the drop overlay, under the palette's
  armed tool, around running jobs, a success bloom, the About page. Never near a page.
- Setting **Ambient light: Auto · Still · Off**, which is also the WCAG 2.2.2 pause.

## 1. Context

The owner asked for light and a "moving" feel. Research 17 measured the options in Chromium
(software compositor, so trends): a still field costs 4.4 % CPU, the same as no field; any
moving full-screen layer costs a full composite every frame, and glass over it costs 2.5× more
(152 against 62 CPU-ms per frame). The shader at full size costs 8× more at DPR 1 and 29× at
DPR 2 than at 1/8, and looks the same. WCAG 2.2.2 requires a pause for motion that starts by
itself and lasts more than 5 s.

Light also limits text. On the bare canvas `--text-secondary` fails at 19.5 % of a lime core's
opacity (research 22 §3.1); under glass the `brightness()` cap keeps the white page the worst
case. Light painted inside a bar at 8 % drops secondary text to 4.07:1; the same light beneath
it at 50 % keeps 5.15:1 (AU-8).

## 2. Decision

1. **Technique** (AU-1, AU-2, `language.md` §3.1): value-noise fbm, 4 octaves, two levels of
   domain warp, 1–3 Gaussian lobes, ribbons plus body. Backing store `⌈cssW / 8⌉ × ⌈cssH / 8⌉`,
   long side 128–320 px, ≤ 64 000 px, independent of DPR; About hero at 1/4. One context per
   app: `alpha: false`, `antialias: false`, `powerPreference: 'low-power'`, a Display-P3 buffer
   when `(color-gamut: p3)` matches (AU-18). Dither ±0.5 LSB. Time integrated and wrapped every
   600 s with a 400 ms cross-fade; no periodic modulation near 0.2 Hz.
2. **Colour follows intensity** (AU-6): teal until 0.08, mint by 0.35, lime by 0.65, lemon from
   0.78, added in linear light over the canvas. Light theme: pigment `bg · (1 − k(1 − stop))`
   with k ≤ 0.45 (AU-21).
3. **Still is the default; motion is an event** (AU-4). Speeds: still 0, ambient 0.12,
   excited 0.30. Frame caps: none when still, 15 fps ambient, 30 fps excited.
4. **Placement** (`language.md` §3.2 with `flows.md` §13.2 item 5):

   | Place | Rest | Events |
   |---|---|---|
   | Empty Library | Full-window field, I 0.45; ambient drift in Auto | Arrival, drag-over, success |
   | Library with documents | I 0.40, still; lobes between card rows; a `textSafe` band takes intensity to 0 within 24 px of the head row (spec 02.2) | Open, close: 2 s drift; success (no drift on Combine, which leaves the Library: spec 02.21) |
   | Drop overlay in a document view | Behind its scrim only | Drag-over |
   | Beneath the palette's armed tool (dark only) | Static CSS under-light; never under the dock | Slides to the armed tool |
   | Processing | 1.5 px conic ring on the progress capsule, toast or facts chip | Turns while the job runs |
   | Success | Ring bloom; Library pulse | Once per success |
   | About hero | I 0.8, 1/4 resolution, visible pause control | Pauses off-screen |

   **Never:** on a page or within 64 px of one, document thumbnails included (Library
   thumbnails are exempt from the 64 px distance and keep the brightness rule, and A-6's pixel
   test covers them: spec 02.1, amended before acceptance); in the Pages grid or
   Compare; in the stage of a document view at rest; as the own light of a sheet, menu or
   tooltip; for errors, warnings, redaction or destructive confirmations (lime reads "go"); as
   a frame at the screen edge; behind text on bare canvas above Y 0.026 (A-5).
5. **Events** (`language.md` §3.3): arrival I 0 → rest, speed 0.12 → 0 over 4 s; drag-over
   I +0.15 (cap 0.6), speed 0.30, nearest lobe follows the pointer; success ring 180 ms in,
   120 ms hold, 900 ms out, Library I +0.10 for 1.2 s; ring one turn per 2.4 s, clipped to its
   capsule, always next to words. The light's springs are slower than the chrome's.
6. **Ambient light: Auto · Still · Off** (AU-16, `language.md` §3.4). Auto (default): event
   motion, plus drift on the empty Library and About, gliding to still after 60 s idle and 5 s
   after the window loses focus. Still: one frame per view; events cross-fade in ≤ 150 ms (A-9). Off:
   no field, no under-light; ring and bloom become a static rim. Overrides: reduced motion →
   Still; forced colours and `prefers-contrast: more` → Off (`display: none`); Glass Solid or
   reduced transparency → Still at I × 0.7. The control says when the system decides.
7. **Budgets, pauses, gates** (`language.md` §3.5): ≤ 4 KB gzip, lazy-loaded when the Library or
   the drop overlay first shows; backing store ≤ 100 KB; ≤ 0.5 ms per frame on a 2020-class
   integrated GPU at DPR 2; Auto ≤ 1.1 × Still energy over 10 min; Library mean Y ≤ 0.03 and
   ≤ 1.5 % of the area above L 0.65; swing < 0.10 per 341 × 256 px region. Pauses (AU-14):
   hidden, off-screen, unfocused 5 s, idle 60 s, during scroll, pinch, drag, ink and typing, a
   sheet over the Library. Gates (AU-15): Compute Pressure, battery under 20 %, low-end
   heuristic, a watchdog stepping 30 → 15 → still.
8. **Integration and fallback** (AU-17, AU-19): canvas and glass share one backdrop root; no
   `mix-blend-mode` on the canvas. Without WebGL or after context loss, a static four-gradient
   CSS field in OKLCH moved only by opacity; never `filter: blur()` or `@property` positions.

## 3. Consequences

- A lazy `apps/web/src/light/` module (field, shader, gates, CSS fallback). Document views
  never load it unless a file is dragged over them.
- Tests: page-corner pixels identical with light on and off (A-6); a 10 s flash sampler over
  the brightest region (A-8); zero frames at rest after 2 s (ADR-0026).
- The under-light depends on ADR-0023's lime; with periwinkle it would carry two colours.
- The cost ladder's step 2 (ADR-0024) sets Still for the session on a slow machine.
- Before the field ships the owner checks AU-22 on his machines: the budget, banding, 15 against
  30 fps drift, and the rendered contrast of lit glass and of the under-lit palette.

## 4. Alternatives considered

- **CSS gradients animated through `@property`:** repaint at full resolution, 515–530 CPU-ms
  per frame. **CSS blobs moved by `transform`:** no warp; with `filter: blur(48px)` 285–291 ms.
  Both kept only as the static fallback's ingredients.
- **Canvas 2D:** cannot warp affordably. **CSS Paint API:** Chromium only. **WebGPU:** no gain
  for 20 000 pixels; device loss reported with a `backdrop-filter` overlay above it.
- **OffscreenCanvas in a worker:** later, only if main-thread stalls show.
- **A pre-rendered loop (22 KB VP9, 26 KB WebP):** cannot react to drag-over, work or success;
  a WebP still serves as the About poster.
- **Libraries (React Bits, Paper shaders, three.js, OGL):** Commons Clause, defaults that invert
  our needs, or weight for one triangle (AU-1).
- **Continuous drift everywhere, as "moving" might imply:** re-filters every glass surface each
  frame for hours and needs a pause anyway; drift stays on the empty Library and About.
- **Drift by CSS `steps()` at 30 Hz (research 18 §6.5):** the shader at 15 fps costs less and can
  react (research 17 §13.7).
- **Light in a document's stage margins on phones (M-32), or under the bar only in Edit
  (research 17 Q3):** the first lights the reading view at rest; the second makes light a mode
  signal, against ADR-0022 principle 8.
