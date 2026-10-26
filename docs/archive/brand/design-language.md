---
title: "Recto design language: an exportable summary"
date: 2026-10-09
status: reference
---

# Recto design language

A short, portable summary of how Recto looks and moves. The owner is bringing his apps and his
portfolio site into one family, **shared but not identical**. Use this page as the starting point
for that family. Each section marks what could be **Shared** across the apps and what is
**Recto**-specific.

- **Shared:** a good default for every app in the family. Change it only for a reason you can
  name.
- **Recto:** belongs to a PDF editor (a white page at the centre, ink, documents). Another app
  replaces it with its own equivalent.

Recto's own sources win over this summary. Values come from `apps/web/src/styles/tokens.css` and
`styles/motion.css`. The rules come from `docs/design/redesign-2026-10/language.md`,
`docs/design/system-audit-2026-10.md` §3 and ADR-0022 to ADR-0028. Brand files are in
`docs/brand/README.md`.

---

## 1. Principles

| # | Principle | Scope |
|---|---|---|
| 1 | **Content is solid, controls are glass, light lives beneath glass.** No glass on content or in inputs. No light inside a glass surface under text. | Shared |
| 2 | **The content is the brightest thing.** In Recto that is the white page: light stays at least 2.5:1 below it and never within 64 px of it. | Shared idea; numbers are Recto |
| 3 | **One accent element per view at rest:** the armed tool or the primary action. Beyond that, only the focus ring and small indicators. | Shared |
| 4 | **Bigger is denser and slower.** Small glass lets more through than large glass. A press settles faster than a full-window move. | Shared |
| 5 | **Rest is still; motion answers.** Nothing loops where people work. Light and glass move because something happened. | Shared |
| 6 | **Continuous and interruptible.** Every spatial animation can be grabbed or retargeted. Nothing blocks input for more than 250 ms. | Shared |
| 7 | **Every effect has a solid twin.** With solid glass, reduced motion, no ambient light and no `backdrop-filter`, the app is complete. | Shared |
| 8 | **State is shape and words, never colour or light.** A mode shows as a glyph, a label and a control's shape. Chrome is never tinted by state. | Shared |
| 9 | **One system for every surface.** Floating pieces, menus, sheets and cards share one scale of sizes, radii and spacing. Exceptions are bugs. | Shared |
| 10 | **Things come out of and go back into their triggers.** See §5. | Shared |

Voice (brand plan §7): calm, plain and exact. No hype words, no exclamation marks, no emoji,
sentence case everywhere. **Shared.**

## 2. Scales

### 2.1 Type

One face: **Inter**, self-hosted (Recto's subset is `'Inter Recto'`, with Turkish). Weights
400 · 500 · 600 only. Tabular numbers. Sentence case; section labels are never uppercase.
**Shared:** the ramp, the weights, the case rule. **Recto:** the subset name and file.

| Step | Fine pointer | Coarse pointer | Use |
|---|---|---|---|
| caption | 11 / 14 | 12 / 16 | badges, counts, keycaps (500) |
| footnote | 12 / 16 | 13 / 18 | secondary lines, section labels (600) |
| body | 13 / 18 | 15 / 20 | rows, menus, buttons (500): the UI base |
| callout | 15 / 20 | 17 / 22 | sheet body, empty states |
| title3 | 17 / 22 | 19 / 24 | panel and sheet titles (600) |
| title2 | 22 / 28 | 24 / 30 | centred confirmations, section heads (600) |
| title1 | 28 / 36 | 30 / 38 | one page heading (600) |
| display | 40 / 44 (56 / 60 large) | same | one title per page, never in a clipping box |

Size / line height in px. A coarse pointer moves every step one size up. Fields use 16 px on
touch, because iOS zooms into anything smaller.

Where each step may appear: floating chrome uses caption, footnote and body. Menus use footnote
and body. Sheets use footnote, body, callout and title3. A landing page uses footnote, body, one
title1 and one display.

### 2.2 Spacing

One **4 px grid** with a 2 px half-step for optical fixes. **Shared.**

| Token | px | Typical use |
|---|---|---|
| `--space-half` | 2 | segment inset, gap between tabs |
| `--space-1` | 4 | gap between controls in a piece |
| `--space-1h` | 6 | label to glyph in a button; menu padding |
| `--space-2` | 8 | gap between pieces; a sheet group's inset |
| `--space-3` | 12 | row, popover and card padding |
| `--space-4` | 16 | **the window margin** (`--piece-inset`); coarse sheet padding |
| `--space-5` | 20 | fine sheet padding |
| `--space-6` | 24 | between sheet sections |
| `--space-8` / `-10` / `-12` / `-16` | 32 / 40 / 48 / 64 | page gutters, section gaps, top margin |

Every floating surface starts at the one window margin (16 px).

### 2.3 Radii

**Concentric:** an inner radius is the outer radius minus the inset between them, rounded to a
step. **Anything that floats is a capsule.** **Shared.**

| Token | px | Role |
|---|---|---|
| `--radius-page` | 2 | pages and marks on them (Recto) |
| `--radius-xs` | 4 | keycaps, small badges |
| `--radius-sm` | 8 | tooltips, swatches, a thumbnail's image |
| `--radius-control` | 10 | fields, menu and list rows (16 − 6) |
| `--radius-md` | 12 | grouped lists inside a sheet (20 − 8) |
| `--radius-lg` | 16 | menus, popovers, command palette, cards |
| `--radius-xl` | 20 | sheets, dialogs, floating sidebar |
| `--radius-2xl` | 28 | phone bottom sheets |
| `--radius-capsule` | 999 | every piece, bar, toast, button, segmented control, chip |

### 2.4 Pieces, controls and icons

A **piece** is a floating glass capsule that holds controls: the top strip's clusters, the dock,
the page pill, toasts. Inside a piece and everywhere else, a control has one of three sizes. A
control never takes the piece's height. **Shared.**

| Element | Fine | Coarse | Notes |
|---|---|---|---|
| Piece (`--piece-h`) | 40 | 48 | inset 16 from the window, capsule radius |
| Control S | 24 | 32 (44 hit) | tab close, stepper, toast close, card check |
| Control M (default) | 32 | 44 | buttons, fields, segmented, menu and list rows |
| Control L | 40 | 52 | at most one per screen: the primary start |
| Sheet header | 56 | 64 | title3, close at the trailing edge |
| Sheet row | 44 | 56 | inset grouped lists |
| Tooltip | 24 | 28 | footnote label |
| Minimum hit area | 24 | 44 | a hit area may extend past the visible glass |

**Icons:** Phosphor, regular at rest and fill when selected (action glyphs, the lasso and shapes
stay outline). Sizes: **20** in controls, **16** in rows and menus, **32** in empty states, **12**
only inside badges. No hand-drawn stroked glyphs. **Shared.**

## 3. Materials

### 3.1 Glass tiers

One glass material in five densities, plus lit glass. Tints are neutral. No glass on glass. Shape
comes from a dark outer edge, a hairline lit inner rim (a specular edge, never a thick white
band) and one shadow per tier. Filters never animate: glass moves by `transform` and `opacity`.
No grain. **Shared:** the tiers, the rules and the setting. **Recto:** the exact alphas, which
are tuned so text stays legible over a white page.

| Tier | Where | Blur σ | Dark tint alpha | Shadow |
|---|---|---|---|---|
| M1 chip | small single pieces (page pill) | 5–8 | 0.50 | e2 |
| M2 bar | dock, palette, toasts, contextual bars | 7–10 | 0.55 | e3 |
| M3 panel | top strip, docked sidebar | 8 (strip) to 40 | 0.74 | e4 |
| M4 menu | menus, popovers, command palette | 12–24 | 0.78 | e4 |
| M5 sheet | sheets, dialogs | 20–48 | 0.86 | e5 |
| Lit | cards no content passes under (Library, About); dark only | 28 | 0.58 | e3 |

**Coverage rule:** a surface's blur must cover its own size (σ at most about height / 5 for bars),
so content cannot leak through a short surface. **Elevation** e0–e5; docked surfaces sit at e0.

**What stays solid:** content, editors, text inputs (opaque wells), tooltips, the dialog scrim
(dim only, no blur).

### 3.2 The Glass setting and the cost ladder

- **Setting, Glass: Clear · Tinted · Solid.** Clear blurs. Tinted sets every text-bearing tier to
  alpha 0.90. Solid uses each tier's solid colour, keeping rim and shadow.
  `prefers-reduced-transparency` forces Solid, and `prefers-contrast: more` turns everything
  solid with a strong border. **Shared.**
- **Cost ladder**, automatic and separate from the setting. While the user scrolls, zooms or
  pans, if more than 25 % of frames take over 20 ms in a 2 s window, step down once and hold for
  the session: (1) lenses off, (2) ambient light still, (3) panels solid, (4) everything solid.
  Devices with 4 GB or less, or 4 cores or fewer, start at step 2. **Shared.**
- **Budget:** a few blurred surfaces at once (5 persistent and 2 transient on a large window), and
  persistent glass over moving content at most 25–32 % of the window. **Shared.**

### 3.3 Light

An in-house aurora (one small WebGL shader, no library) in teal, mint, lime and lemon. It sits
**beneath** glass in named places only: the Library, the drop overlay, under the armed tool, and
around running jobs. In Recto it also forms a subtle reader background glow, on by default and
switchable off. It is still by default, moves when something happens, and settles within 5 s.
Setting: **Ambient light Auto · Still · Off.** **Shared:** the idea and the setting. **Recto:**
the placements.

## 4. Colour, focus and selection

### 4.1 Roles

Four roles that never mix. **Shared.**

| Role | What | Recto values |
|---|---|---|
| Atmosphere | the aurora light | teal `#1f9996`, mint `#58da98`, lime `#bbed26`, lemon `#faee40` |
| Interaction | the accent: armed tool, primary action, focus, selection in the chrome | lime `#c8fb3d` |
| Content | the document and selection on it | white page; selection blue `#4e61ed` |
| Status | danger, warning, success | `#fd7273`, `#ffb756`, `#56d1a3` (dark) |

- **Neutrals:** cool graphite (hue 265), n1–n12 in both themes. Dark canvas `#08090c`, light
  canvas `#fdfdff`. **Shared** as the family's neutral ramp.
- **The accent lime** `#c8fb3d` is the product accent and the brand colour. Ink text on lime is
  16.4:1. Lime fails on white (1.2:1), so in the light theme an armed tool is an **ink disc with
  a lime glyph**, and lime lines use `--lime-800` `#446713`. **Shared candidate:** one bright
  accent per app, used the same way. Whether every app uses lime, or each app has its own accent
  inside the family's neutrals, is the owner's call.
- **Selection on content** is a separate blue, as macOS splits accent and highlight colours.
  **Recto** (it exists because lime is close to the highlighter inks).
- **Only light glows:** the aurora and the glass rims. Controls never glow and never have a
  coloured outer shadow. **Shared.**
- A light theme equal to dark, following the system. **Shared.**

### 4.2 Focus

One ring for every surface and both themes: **2 px ink, 2 px lime, 2 px ink**, from the element
outward. Lime and ink differ by 16.4:1, so one band clears 3:1 on any background. Inside a capsule
or a scroller the ring is drawn inset. In the light theme it is drawn outset on fields and
segments, so the lime sits on the glass, not on a white well. The ring appears with focus and
never animates. A surface opened by pointer focuses the surface. A surface opened by keyboard
focuses its first field. **Shared.**

### 4.3 Selection

Three forms, the same everywhere (grid, sidebar, Library, phone). **Shared.**

| Form | Look |
|---|---|
| **Armed** (the one tool, the one primary action) | the accent-filled disc (ink disc with a lime glyph in light) |
| **Selected** (pages, files, the chosen swatch) | a 2 px lime ring plus a filled check badge |
| **Current** (the page you are on, the open document) | a neutral 1 px ring and the label at 600, never the selection ring |

Hover and press are washes only. Selection on the page is the blue (§4.1).

## 5. Motion

### 5.1 Principles

- **Things come out of and go back into their triggers** (the R14 brief). A menu grows from its
  button with `transform-origin` at the trigger and shrinks back into it. A sheet rises from the
  control that opened it. A toast leaves toward where it came from. The ink strip grows out of
  the dock. Nothing appears from nowhere or leaves toward an unrelated place. **Shared.**
- **Springs carry position, size and scale. Eases carry opacity and colour.** **Shared.**
- **Everything that changes shape animates its size** (a piece growing for Find, Save appearing,
  the dock morphing into the palette) and content cross-fades. **Shared.**
- **Interruptible:** every spatial animation reverses or retargets from its current value and
  velocity. View Transitions are capped at 240 ms because input is lost while one runs. **Shared.**
- **Animate only `transform`, `opacity` and `clip-path`** on chrome, never layout properties.
  Glass moves itself, never through an ancestor. Motion on or under glass lasts at most 500 ms.
  **Shared.**
- **No animation library.** CSS `linear()` springs, View Transitions for view changes, and a
  core of a few KB for gestures. **Shared.**
- **Reduced motion is per token:** spatial springs become instant, fades stay at 100–150 ms, press
  and entrance scales go to 1. There is an in-app setting as well as the system query. **Shared.**

### 5.2 Tokens

**Shared**: the values are the family's defaults.

| Spring | Duration | Curve | Use |
|---|---|---|---|
| `--spring-press` | 300 ms | `--ease-spring` | press release, switch thumbs, checks |
| `--spring-quick` | 420 ms | `--ease-spring` | menus, popovers, contextual bars, toasts |
| `--spring-smooth` | 530 ms | `--ease-spring` | bar morphs, panels, reflow, side sheets |
| `--spring-glide` | 680 ms | `--ease-spring` | phone sheets, double-tap zoom, large moves |
| `--spring-fling` | 560 ms | `--ease-spring-fling` (bounce 0.15) | releases faster than 300 px/s |
| `--spring-pop` | 410 ms | `--ease-spring-pop` (bounce 0.25) | one small glyph (a success check), never a surface |
| `--spring-track` | 150 ms | `--ease-spring` | things that follow the pointer |

`--ease-spring` is one critically damped curve written as `linear()`; only the duration changes.
Durations are the time to settle within 0.1 %, so springs look done well before they end.

| Ease | Value | Use |
|---|---|---|
| `--duration-instant` | 60 ms | hover, press down |
| `--duration-fast` | 120 ms | exits, tooltips, icon replace |
| `--duration-base` | 180 ms | entry fades, scrims |
| `--duration-slow` | 280 ms | large cross-fades |
| `--ease-out` | `cubic-bezier(0.2, 0, 0, 1)` | entries |
| `--ease-exit` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | exits (about 60 % of the entry) |
| `--vt-duration` | 240 ms | every View Transition |

Press scale 0.97 (mouse) and 0.94 (touch); 0.98 / 0.96 for surfaces of 120 px or more. A popup
enters from `scale(0.96)`, 4 px toward its anchor, and leaves to `scale(0.98)` in 120 ms. A
pushed sheet page slides 24 px.

## 6. The brand mark

The mark is the owner's geometric capital **R** ("Dengeli"): a chamfered top-left corner, a
round bowl, and a notch that turns the leg into a page corner. The files and rules are in
`docs/brand/README.md`, "The mark: files and usage". **Recto**, though the rules below are the
family's pattern for any app's mark.

- **Gradient**, linear at 46.75° from bottom left to top right: mint `#69EAA3` → lime `#CBFF5F`
  at 59 % → yellow-lime `#EDFA6D`. It needs a dark ground. On light grounds use the light-ground
  gradient (`#178A6E` → `#4F8F12` → `#738A0C`), at least 3.3:1 on light glass.
- **One-ink versions:** black `#0B0C0E` for light grounds and print; white for photos and dark
  grounds where the gradient would compete.
- **Clear space:** about 14 % of the mark's height on every side. Never under 16 px. From 16 to
  48 px use the app tile or the cropped glyph.
- **Never** recolour the gradient, rotate, outline, add shadows or effects, or box the mark in
  anything other than the app tile.
- **In the app** the mark appears once, on the Library tab (the home button), and never near a
  page.
- The aurora light (§3.3) takes its colours from the same mint-lime-yellow family, so the brand
  and the atmosphere read as one. **Shared candidate:** each app in the family has its own mark
  with its own gradient, all drawn from one family of light colours over the shared graphite.

## 7. Carrying it to another app

1. Take the **Shared** rows as they are: principles, the type ramp, the 4 px grid, concentric
   radii, piece and control sizes, icon sizes, glass tiers and settings, the focus ring, the
   three selection forms, and the motion principles and tokens.
2. Replace the **Recto** rows: what counts as content (Recto's white page), selection on content,
   the light's placements, and the mark.
3. Decide the accent with the owner: lime everywhere, or one accent per app.
4. Keep the gates. Recto's are `tokens.test.ts`, `motion.test.ts` and the CSS-scale ratchet, so
   the scales stay settled as the app grows.
