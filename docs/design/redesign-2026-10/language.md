---
title: "Recto Glass: the M9 design language"
date: 2026-10-04
status: proposed
---

> Wave 2 of the M9 redesign: research 16 (glass), 17 (light), 18 (motion), 20 (type, icons,
> colour), 21 (brand) and 22 (accessibility) turned into one system, with 13–15 and 19 where they
> touch it. It defines the system, not screens, so it holds for whichever interaction model the
> flows panel picks. Every ratio, composite and coverage value was recomputed with the method of
> §1.2 (a script in the session scratch folder); `tokens.test.ts` re-asserts them (§10). Icon names
> were checked against `@phosphor-icons/core` 2.1.1. *(judgement)* marks unmeasured claims.

*Changelog, 2026-10-04:* applied the ten amendments of `flows.md` §13.2, accepted by the lead,
now that the flows panel has picked the model: viewing, Markup, Lock, the dock and palette, the
page pill and the Pages grid replace Read and Edit, the floating tool bar, the status bar, the
inspector and Arrange; Home is now the Library. Coverage recomputed (§2.9); open points in §11.3.

*Changelog, 2026-10-04 (later):* applied the lines of `docs/specs/redesign.md` §6.16 and the
review fixes that followed: the σ steps and registry rows of X6, 02.4, 03.8, 06.21 and the short
viewport; neutral on-states (09.1); `--redact-page` and `--crop-dim` (05.3); light M2 for lit glass
in the light theme (02.3); refraction on fixed-size M1 chips only (X20); `--control-border` (X7);
`textSafe`, the Library-thumbnail exemption and no drift on Combine (02.1, 02.2, 02.21);
lime-800 duotone in light (08.11); *sheet push*, *fold*, *find step* and the large press (X8,
02.6, 05.2, 02.5); one filter per toast stack; reduced-motion and duration limits held to A-9
and A-10 (undo reveal and sheen 500 ms, light responses ≤ 150 ms).

# Recto Glass: the M9 design language

## 0. Summary

- **Three layers.** The page and everything on it is *content*: solid, never themed, never
  glass. Controls float above it as *glass*: one material in five densities (M1 chip to M5
  sheet). *Light*, a lime aurora, lives beneath the glass, never inside it, never on the page.
- **One lime.** `#c8fb3d` (oklch 0.921 0.210 124) is the accent, the focus ring's light band and
  the brand's lit element. It always touches ink and never appears on the page. Selection on the
  page gets its own blue, `#4e61ed` (4.93:1 on white), replacing `#7c8cff` (2.98:1).
- **Two equal themes.** Dark (graphite, hue 265) and light follow the system. Dark glass caps
  the backdrop so a white page is the worst case; light glass floors it so black is.
- **Glass is dense where it holds text.** Chips and bars transmit 0.21 and 0.20 of the backdrop;
  panels, menus and sheets 0.12, 0.11 and 0.07, so current rows stay AA over a white page. Blur
  obeys a coverage rule (about σ ≤ height / 5) so short glass cannot leak the page.
- **Light is an event.** An in-house WebGL field at 1/8 resolution, still by default, moves on
  arrival, drag-over, work and success and settles within 5 s: the Library, beneath the
  palette's armed tool, the processing ring, and the About page.
- **Motion is springs.** Seven spring tokens, four eases, CSS `linear()` curves, View
  Transitions capped at 250 ms, a small in-house gesture core, no library, reduced motion per token.
- **Settings.** Theme System · Light · Dark; Glass Clear · Tinted · Solid; Ambient light Auto ·
  Still · Off; Reduce motion System · On; Haptics On · Off (Android). They replace "Glass panels"
  and "Reduce transparency".
- **Type and icons.** Self-hosted Inter 4.1 with optical sizes (98 KB with Turkish), 11–56 px with
  a coarse step, sentence case; Phosphor regular and fill, built at compile time.

### 0.1 Principles

1. **Content is solid, controls are glass, light lives beneath glass.** No glass on the page,
   thumbnails, inputs or editors; no light inside a glass surface under text (G-1, AU-8).
2. **The page is the brightest thing.** Light stays at least 2.5:1 below a white page wherever
   both share the screen, and never within 64 px of a page (G-15, AU-7, BR-B1).
3. **One lime element per view.** At rest, one lime fill: the armed tool or the primary action.
   Beyond that only the focus ring and small indicators (C-5, X-1).
4. **Bigger is denser and slower.** Transmission falls from chips to sheets; spring duration
   rises from 0.20 s for a press to 0.46 s for a full-window move (G-3, MO-1).
5. **Rest is still; motion answers.** Nothing loops in a document view. Light and glass move
   because something happened (MP-4, AU-4).
6. **Continuous and interruptible; nothing waits.** Every spatial animation can be grabbed or
   retargeted from its current value and velocity; no input is dropped for an animation; no
   blocking transition lasts more than 250 ms (MO-1, A-10).
7. **Every effect has a solid twin.** With Glass Solid, Reduce motion On, Ambient light Off and
   no `backdrop-filter`, the app is complete and passes every rule (A-22).
8. **State is shape and words, never colour or light.** Markup and Lock are shown by a glyph,
   a label and a control's shape; the chrome is never tinted by either and the light never
   signals them: the under-light marks the armed tool, not Markup (DESIGN §2, research 17 §14
   Q3). The language does not weaken the M8 protection (ADR-0019), which `flows.md` keeps as
   input rules and Lock.

### 0.2 Where the research disagreed

| Question | Positions | Decision | Why |
|---|---|---|---|
| One lime or two | 20: accent `#c8fb3d`, h 124. 21: brand `#e2f73d`, h 116, with `#49780d` as ink | **One**: `#c8fb3d` for accent, focus and brand. Hue 105–116 lives only in the aurora's hottest light | h 116 sits ΔE_OK 4.5 from the yellow highlighter, h 124 sits 7.6. `#49780d` gives 4.30:1 on the light canvas; lime-800 `#446713` gives 5.35:1. One value keeps app, icon and About identical (BR-B5) |
| Glass σ | 13/14: 28–40 px on bars. 16: σ ≤ h / 5. 19: ≤ 20 px on coarse | **Coverage rule** c ≥ 0.985 per surface (A-2), which is σ ≤ h / 5 for bars and σ ≤ side / 5.5 for square chips; large surfaces σ 24–48, coarse pointers 20 | σ ≤ h / 5 alone fails square chips (c = 0.975). Small blurs cost more on large surfaces (16 §5.2), so large surfaces keep σ ≥ 16 |
| Tier densities | 16 Table 7: M3 k 0.17, M4 0.16, M5 0.09 | **Denser**: M3 0.117, M4 0.108, M5 0.070 | Recomputed with row states: a current row on 16's M3 over a white page drops secondary text to 3.98:1 (§2.6) |
| Docked panels glass by default | 13: only where content moves. 16 Q1, 22 Q4 open. DESIGN: trial, off | **Glass by default** where the stage runs under them, on fine pointers, pending the owner's S2 check; solid on coarse pointers | M3 composites to the solid frame colour over the canvas, so nothing changes at rest and glass costs nothing at rest (16 §5.2) |
| Light theme | 16 G-25: not now. 20 C-15: equal. 21: About in both | **Equal, day one**, following the system | The owner's references are light apps, phones run light, and the About page and screenshots need both. Light glass is solved with a luminance floor (§2.3) |
| Light glass floor | 20 C-14: `contrast(0.6) brightness(1.25)`. 16 G-25: `contrast(0.45) brightness(1.4)` | **`contrast(0.45) brightness(1.4)`** | Only it lets primary text reach APCA Lc 75 over black at alpha 0.70 (§2.2) |
| Settings names | 17: Ambient light Auto · Still · Off. 22: Light On · Still · Off; Motion System · Reduced. 18: Reduce motion switch | Glass, Ambient light, Reduce motion, as in §0 | One control per effect, each overridable by the OS and saying so |
| Ambient drift | 17, 18: event-only by default, drift opt-in. Brief: "moving" | **Auto drifts on the empty Library and About only**, at 15 fps, gliding to still after 60 s idle | The welcome moment moves, as asked; work views never do. The setting is the WCAG 2.2.2 pause |
| View transition length | 18 MC-2: glide (0.68 s) with pass-through input. 22 §5.5: clicks are lost while a transition runs | **≤ 250 ms** per view transition | 22 measured that `pointer-events: none` does not restore input, as the spec says |
| Touch springs | 19 M-30: bounce on touch (ζ 0.6–0.8) | **Rejected**: zero bounce for taps everywhere; touch gets a deeper press and a brighter press light | MO-1 rule 3: momentum earns bounce, input type does not |
| Squircles | 16 G-20: `squircle`, radius × 1.8. 20 S-2: `superellipse(1.5)`, × 1.35 | **`superellipse(1.5)` × 1.35** | Both match the circle's 45° cut; 20 compared them rendered, and the gentler curve clamps less on 20–28 px radii |
| Focus ring | 20 C-7: lime outline, 2 px ink inside. 22 A-11: light outline over a 6 px dark halo | **22's ring with lime as the light band** | Dark on both sides of the lime: worst best-band 4.07:1 over 20 backdrops (§9.2) |
| Haptics | 20 X-10: four events. 19 M-37: lift, snap, drop | **19's three events**, Android only | HIG: avoid overuse; tool arming is frequent |

---

## 1. Colour

### 1.1 Roles

Four roles that never mix (C-1). A review rejects any colour that crosses its row.

| Role | What | Values | May appear | Never |
|---|---|---|---|---|
| Atmosphere | The aurora: light, not information | Teal, mint, lime, lemon (§1.6), P3 where available | Library, empty states, beneath the palette's armed tool, the drop overlay, the processing ring, About | On or within 64 px of a page; behind text without glass; as a signal |
| Interaction | Focus, armed tool, primary action, on states of tools, current item (switches, checkboxes, radios, chips and segmented thumbs use neutral `--control-on`, n12: spec 09.1) | Lime `--accent` with ink | Chrome only | On the page; as the only cue for a state; as text on a light surface |
| Content | The page, its inks and highlighters, selection on the page | Page white; ADR-0021 inks; `--select` blue | The page and on-page handles | In the chrome except as the user's own ink dots |
| Status | Destructive, honesty notices, signature validity, verified results | Danger, warning, success | Next to a glyph and words | Alone; as a background wash |

### 1.2 Method

- OKLCH ↔ sRGB with Ottosson's matrices, P3 through XYZ (D65); hex is the stored token. WCAG 2.2
  contrast; APCA 0.0.98G (apca-w3 0.1.9 constants) as a second check, reported as |Lc|.
- Glass: the model of `tokens.test.ts` (matches Chromium to ±1/255, 16 §6.3), extended with
  `contrast()` for the light theme and research 22's coverage term:

```text
filtered   = brightness( contrast( saturate(B) ) )          per sRGB channel, clamped, in chain order
seen       = c · filtered + (1 − c) · B                      c = erf(h / 2√2σ) · erf(w / 2√2σ)
composite  = round8( a · tint + (1 − a) · seen )             a = tint alpha
k          = (1 − a) · brightness [· contrast slope]         "transmission": how much backdrop shows
```

- Worst backdrops: white for light text, black for dark text, then `#808080`, the canvas, a
  lime fill, the aurora at lime I 0.35 (`#75951a`) and its brightest allowed pixel, lemon at
  I 0.6 (`#c8be34`, Y 0.494).
- Colour vision: Machado, Oliveira and Fernandes (2009), severity 1.0, in linear sRGB; distances
  in ΔE_OK × 100.

### 1.3 Neutrals: cool graphite, hue 265

Research 20's ramp (C-2), verified: every OKLCH value below converts to the hex shown. Roles:
1–2 backgrounds, 3–6 surfaces and controls, 7–8 borders and disabled, 9–12 text.

| Step | Dark OKLCH | Dark | Light OKLCH | Light | Dark role | Light role |
|---|---|---|---|---|---|---|
| n1 | 0.140 0.006 | `#08090c` | 0.995 0.002 | `#fdfdff` | Canvas | Raised cards, inputs |
| n2 | 0.180 0.008 | `#101215` | 0.975 0.003 | `#f6f7f9` | Sunken wells | Frame (M3 solid) |
| n3 | 0.215 0.010 | `#17191e` | 0.955 0.004 | `#eff0f3` | Frame (M3 solid) | Sunken wells |
| n4 | 0.250 0.011 | `#1f2227` | 0.930 0.005 | `#e6e8eb` | Raised, inputs, M1/M2/M4/M5 solid | Canvas |
| n5 | 0.285 0.012 | `#272a30` | 0.905 0.006 | `#dee0e4` | On state, disabled primary | On state |
| n6 | 0.320 0.012 | `#303339` | 0.880 0.007 | `#d5d7dc` | Strong control | Strong control |
| n7 | 0.380 0.012 | `#3f4249` | 0.830 0.008 | `#c5c7cd` | Opaque border | Opaque border |
| n8 | 0.460 0.012 | `#55585f` | 0.740 0.010 | `#a8abb1` | Disabled text | Disabled text |
| n9 | 0.665 0.010 | `#91949a` | 0.490 0.012 | `#5d6067` | Tertiary text | Tertiary text |
| n10 | 0.720 0.010 | `#a1a5ab` | 0.440 0.013 | `#4f535a` | Secondary text | Secondary text |
| n11 | 0.800 0.008 | `#bbbec3` | 0.380 0.013 | `#3f424a` | Secondary text on glass | Secondary text on glass |
| n12 | 0.935 0.004 | `#e8e9ec` | 0.205 0.010 | `#15171c` | Primary text, ink | Primary text, ink |

Washes: dark hover `rgb(255 255 255 / 0.045)`, pressed `/ 0.075`; light hover
`rgb(21 23 28 / 0.04)`, pressed `/ 0.07`. Scrims: dark `rgb(5 6 8 / 0.50)` (dim only, G-31),
light `rgb(21 23 28 / 0.28)` *(judgement)*. The page keeps its hairline and no shadow: dark
`--border-hairline`, light `rgb(21 23 28 / 0.14)`.

### 1.4 Interaction: the lime

| Token | Dark | Light | Notes |
|---|---|---|---|
| `--accent` | `#c8fb3d` (0.921 0.210 124) | same | 8 % under the sRGB cusp (C 0.229), so it does not vibrate on OLED |
| `--accent-hover` / `--accent-pressed` | `#ddff82` / `#b2e93c` | same | Dark primary-button states |
| `--accent-ink` | `#08090c` | `#08090c` | Label and glyph on lime |
| `--primary-fill` / `--primary-ink` | lime / ink | n12 / lime | "Lime always touches ink" (C-4); light hover n11, pressed `#000` |
| `--tool-active-fill` / `--tool-active-ink` | lime / ink | n12 / lime | The armed tool |
| `--accent-subtle` | lime / 0.08 | ink / 0.04 | Previews, drop hints |
| `--accent-muted` | lime / **0.12** | ink / 0.07 | Current rows; 0.16 in research 20 is too much on glass (§2.6) |
| `--accent-line` | lime / 0.50 | `#446713` (lime-800) | 1 px rings on non-focus states, range fill |
| `--focus-light` / `--focus-dark` | lime / `#08090c` | same | §9.2 |

Lime ramp, for illustration, brand and the light theme's line colour (chroma about 92 % of the
sRGB maximum; recomputed, so some hexes differ from research 20 by one level):

| Step | OKLCH | Hex | On white | On dark canvas | On light canvas |
|---|---|---|---|---|---|
| 50 | 0.975 0.062 123 | `#effed0` | 1.06 | 18.73 | 1.15 |
| 100 | 0.955 0.121 123 | `#e1fea1` | 1.11 | 17.91 | 1.10 |
| 200 | 0.935 0.193 123 | `#d2fe59` | 1.16 | 17.12 | 1.06 |
| **300** | 0.920 0.210 124 | `#c8fb3d` | 1.21 | 16.42 | 1.01 |
| 400 | 0.885 0.205 125 | `#bbef39` | 1.35 | 14.71 | 1.10 |
| 500 | 0.830 0.197 127 | `#a5dd34` | 1.62 | 12.32 | 1.32 |
| 600 | 0.700 0.168 128 | `#80b128` | 2.55 | 7.81 | 2.08 |
| 700 | 0.580 0.142 129 | `#5f8a1b` | 4.09 | 4.87 | 3.33 |
| **800** | 0.470 0.116 130 | `#446713` | 6.57 | 3.03 | 5.35 |
| 900 | 0.370 0.092 130 | `#2f490a` | 10.10 | 1.97 | 8.23 |
| 950 | 0.270 0.068 131 | `#1a2d04` | 14.78 | 1.35 | 12.04 |

The accent stays sRGB in every theme and file (icons, PNGs, tests). Its P3 headroom (C 0.267 at
this L and h) goes to the aurora only.

### 1.5 Content: the page and selection

- The page is `#ffffff`, never themed, inverted or tinted; "dim pages" stays a dark-theme
  compositing option. ADR-0021's inks and highlighter tints are unchanged.
- `--select: #4e61ed` (0.561 0.210 272) for every on-page selection mark: lasso box, handles'
  1.5 px stroke, hover outline of a text run, drop targets on a page, the undo flash on a page.
  4.93:1 on white, 4.00:1 on the yellow tint, 3.53:1 on the green tint.
- Washes (multiply): `--select-wash` 0.25 → `#d3d8fb` on white (ink text 12.42:1) for text
  selection, the lasso area and other search hits; `--select-wash-strong` 0.45 → `#afb8f7` (ink
  9.13:1) for the current hit.
- Two more content tokens, never status washes (spec 05.3): `--redact-page` `#c21725` in both
  themes (6.10:1 on white) for redaction marks on the page, with a 45° hatch and the pending bar's
  words; `--crop-dim` for the page area outside a crop preview.
- `--select` is 10° of hue from the blue writing ink `#1760ee` (ΔE 4.5, 0.7 under protanopia).
  Form separates them: selection is a dashed box, a handle or a wash, never a stroke of ink.

### 1.6 Status, tags, atmosphere

| Token | Dark | Glass variant (dark) | Light | Glass variant (light) |
|---|---|---|---|---|
| `--danger` | `#fd7273` (0.72 0.17 22), 6.56 on n3 | `#ffa4a4` | `#c21725`, 6.10 on white, 4.97 on n4 | `#a20519` |
| `--warning` | `#ffb756` (0.83 0.14 72), 10.18 on n3 | itself | `#985600`, 4.67 on n4 | `#754100` |
| `--success` | `#56d1a3` (0.78 0.13 165), 9.25 on n3 | itself | `#007654`, 4.60 on n4 | `#005c41` |

Warning moves from hue 86 to 72, away from the aurora's lemon and the lime (C-8). Success is for
signature validity and verified results only; other confirmations are neutral text with a check.
Tags keep research 20's six, with tag 4 changed from olive (hue 118, the accent's) to lilac
`#b1a1d1`; light tags `#327f6e #966b21 #945067 #5d728e #7c68a1 #965c39`. Tags are dots next to
a name, so they need 3:1 (all ≥ 4.43 on n2) and never carry meaning alone.

Atmosphere (research 17 owns the field, AU-6; research 20's C-11 stops are replaced by these):

| Light | sRGB | OKLCH | P3 variant (92 % of the P3 cusp) | Role |
|---|---|---|---|---|
| Teal | `#1f9996` | 0.62 0.10 192 | `oklch(0.62 0.132 192)` | Dim body, edges |
| Mint | `#58da98` | 0.80 0.15 158 | `oklch(0.80 0.238 158)` | Middle of the light |
| Lime | `#bbed26` | 0.88 0.21 124 | `oklch(0.88 0.235 124)` | Strong light |
| Lemon | `#faee40` | 0.93 0.18 105 | `oklch(0.93 0.211 105)` | Hottest cores only |

Light-theme pigment stops (AU-21): lime `#a0da3e`, mint `#61d19a`, teal `#41b2b2`, applied as
`bg · (1 − k(1 − stop))` in linear light with k ≤ 0.45.

### 1.7 Contrast results

Text on solid surfaces (WCAG / APCA |Lc|):

| Text | Dark n1 | Dark n3 | Dark n5 | Light n1 | Light n2 | Light n4 |
|---|---|---|---|---|---|---|
| Primary n12 | 16.40 / 93 | 14.48 / 92 | 11.85 / 90 | 17.65 / 104 | 16.73 / 100 | 14.61 / 91 |
| Glass secondary n11 | 10.68 / 67 | 9.43 / 66 | 7.72 / 64 | 9.89 / 92 | 9.38 / 89 | 8.19 / 80 |
| Secondary n10 | 8.05 / 53 | 7.11 / 52 | 5.81 / 50 | 7.61 / 86 | 7.21 / 82 | 6.30 / 73 |
| Tertiary n9 | 6.55 / 44 | 5.78 / 43 | 4.73 / 41 | 6.20 / 80 | 5.88 / 77 | 5.13 / 68 |
| Disabled n8 | 2.79 | 2.47 | 2.02 | 2.27 | 2.15 | 1.87 |

Tertiary never sits on n6 (4.16 dark, 4.37 light). Disabled text is exempt (WCAG 1.4.3) and
stays visible.

Fills, rings and marks:

| Pair | Ratio |
|---|---|
| Ink on lime (dark primary, armed tool) · hover · pressed | 16.42 (Lc 93) · 17.73 · 13.86 |
| Lime on ink (light primary, armed tool) · on hover n11 · on `#000` | 14.79 · 8.29 · 17.32 |
| Lime fill against each dark glass tier over white | 7.79 (M1) to 9.99 (M3) |
| Ink fill against each light glass tier over black | 11.18 (M1) to 14.65 (M5) |
| Current row lime 0.12 on n3: primary · secondary · tertiary | 10.67 · 5.23 · 4.26 (tertiary steps up to secondary) |
| Current row ink 0.07 on light n2: primary · secondary · tertiary | 14.50 · 6.25 · 5.09 |
| `--accent-line` lime 0.50 on n1 · on n3 | 4.56 · 4.49 |
| Lime-800 line on white · light canvas · light glass worst | 6.57 · 5.35 · 4.10 |
| `--select` on white · on light canvas | 4.93 · 4.02 |
| Focus bands (lime vs ink) | 16.42 (C40 needs 9) |

Glass composites and text on them are in §2.2.

### 1.8 Colour vision

| Pair | Normal / protan / deutan / tritan | Consequence |
|---|---|---|
| Lime vs yellow highlighter | 7.6 / **2.2** / **2.2** / 7.5 | Lime never marks the page (A-19) |
| Lime vs green highlighter | 7.4 / 5.3 / 6.9 / 8.4 | Same |
| Lime vs warning `#ffb756` | 19.0 / 15.2 / 9.0 / 17.9 | Better than today's `#f5c451` (deutan 7.6); still never paired as two meanings |
| Lime vs success · vs danger | 20.1 / 18.3 / 20.5 / 18.0 · 35.9 / 32.8 / 21.3 / 32.6 | Distinct |
| Success vs danger (dark) | 29.1 / 17.9 / **7.0** / 34.2 | Always with a glyph: check vs cross |
| Warning vs danger (light) | 12.7 / 7.6 / **1.3** / 10.1 | Identical for deuteranopes: triangle vs cross, and words |
| `--select` vs blue ink | 4.5 / 0.7 / 1.8 / 0.3 | Form, not hue, separates them (§1.5) |
| Aurora lemon vs yellow highlighter | 1.7 / 0.8 / 1.6 / 1.4 | Irrelevant: the light never reaches a page |

Rule (A-19): state pairs that can appear together without a shape cue keep ΔE ≥ 10 under all
three simulations; every status colour ships with its glyph (check, triangle, cross).

### 1.9 What replaces `#7c8cff`

| Use today | Dark | Light |
|---|---|---|
| Focus ring (2.98:1 on white, 2.22:1 on the rendered bar) | Two-band ring, lime + ink (§9.2) | Same |
| Armed tool, primary button | Lime fill, ink glyph or label | Ink fill, lime glyph or label |
| Current rows (`--accent-muted`) | Lime 0.12 | Ink 0.07 |
| `--accent-line` rings, range fill | Lime 0.50 | Lime-800 `#446713` |
| Current thumbnail ring (chrome) | 2 px lime | 2 px lime-800 |
| Armed ink preset in the pen bar | 2 px n12 ring with a 2 px ink gap (lime would vanish beside the highlighter tints, C-5) | 2 px n12 ring |
| On-page hover outline, handles, lasso, drop target, undo flash | `--select` | `--select` |
| Text selection, search hits | `--select-wash` / `-strong` | Same |
| Undo flash off the page | Lime ring | Lime-800 ring |

---

## 2. Materials

### 2.1 Rules

1. One material in five densities (G-3), plus the M0 light field (§3) and one *lit* variant.
   No clear variant in the app (Apple: never mix; clear only over media).
2. Every dark tier composites to L ≤ 0.062 over white, every light tier to a floor over black.
   Tested, not eyeballed (G-4).
3. Tints are neutral. Colour on glass arrives from behind (the aurora) or from the one
   accent-filled control on that surface (C-13, G-30).
4. Shape comes from the rim and the shadow, not the body (G-5).
5. Glass never animates its filter. It moves, scales, clips and fades on the element itself,
   never on an ancestor (MP-2, G-13, G-21).
6. No glass on glass. Segments, wells and chips inside glass use fills (G-1).

### 2.2 The tiers

Dark theme. "Worst" is over a white page, except lit glass (over the field's brightest pixel).

| Tier | Where | Tint | Filter after `blur(σ)` | σ | k | Over white | Over canvas | Over lime I .35 | Primary · glass-sec · danger · warning · lime fill | APCA P / S |
|---|---|---|---|---|---|---|---|---|---|---|
| **M1 Chip** | The persistent page pill (page and zoom), the facts chip, single floating buttons, close/back on the stage, scroll-to-top | `rgb(30 32 37 / 0.50)` | `saturate(1.9) brightness(0.42)` | 5–8 by size (28 px chips 5) | 0.210 | `#454648` | `#101216` | `#243212` | 7.78 · 5.07 · 4.99 · 5.47 · 7.79 | 82 / 56 |
| **M2 Bar** | Dock and Markup palette (one shape), pending-marks bar, Pages bar, Compare bar, options tier, contextual and selection bars, the Library selection bar, banners, toasts, the progress capsule | `rgb(32 34 39 / 0.55)` | `saturate(1.8) brightness(0.44)` | 7–10 by height | 0.198 | `#444548` | `#131418` | `#263315` | 7.90 · 5.14 · 5.07 · 5.55 · 7.91 | 82 / 56 |
| **M3 Panel** | Docked or overlay sidebar, top strip (the compact top bar), phone sheet at the 40 % detent | `rgb(30 32 38 / 0.74)` | `saturate(1.5) brightness(0.45)` | 40; top strip 8, 10 at 52 px; coarse 20 | 0.117 | `#34363a` | `#17191e` (= n3) | `#232a1c` | 9.97 · 6.49 · 6.40 · 7.01 · 9.99 | 87 / 61 |
| **M4 Menu** | Menus, context menus, popovers, the command palette, preset editors | `rgb(34 36 42 / 0.78)` | `saturate(1.6) brightness(0.49)` | 24; 92–120 px tall 16; under 92 px tall 12; coarse 20 | 0.108 | `#36383c` | `#1b1d22` | `#262d21` | 9.68 · 6.30 · 6.21 · 6.80 · 9.69 | 86 / 60 |
| **M5 Sheet** | Dialogs, side and bottom sheets at full height, Combine, export, batch | `rgb(40 42 48 / 0.86)` | `saturate(1.4) brightness(0.50)` | 48; dialogs and modal sheets under 260 px tall 24; coarse 20 | 0.070 | `#34363b` | `#23252a` | `#2a2f29` | 9.96 · 6.49 · 6.39 · 7.00 · 9.97 | 87 / 61 |
| **Lit** | §2.5 only | `rgb(48 51 58 / 0.58)` | `saturate(1.8) brightness(0.55)` | 28 | 0.231 | forbidden (`#57585d`, S 3.81) | `#1e2025` | `#344322` | over `#c8be34`: 7.38 · 4.80 · 4.73 · 5.19 · 7.39 | 81 / 54 |

Light theme. The floor is `contrast(0.45) brightness(1.4)` after the saturate: black under the
glass becomes 0.385 before the tint (G-25). "Worst" is over black.

| Tier | Tint | Filter after `blur(σ)` | k | Over black | Over white | Over light canvas | Primary · glass-sec · danger · warning · ink fill | APCA P / S |
|---|---|---|---|---|---|---|---|---|
| M1 | `rgb(250 250 252 / 0.69)` (system-audit-2026-10 §3.5: the Lc 75 floor) | `saturate(1.5) contrast(0.45) brightness(1.4)` | 0.189 | `#cbcbcc` | `#fcfcfd` | `#f8f8fb` | 11.06 · 6.20 · 5.04 · 5.16 · 11.06 | 75 / 63 |
| M2 | `rgb(250 250 252 / 0.69)` (was 0.72) | same | 0.176 | `#cbcbcc` | `#fcfcfd` | `#f8f8fb` | 11.06 · 6.20 · 5.04 · 5.16 · 11.06 | 75 / 63 |
| M3 | `rgb(248 249 251 / 0.76)` | `saturate(1.4) contrast(0.45) brightness(1.4)` | 0.151 | `#d4d5d6` | `#fafafc` | `#f7f8fa` (≈ n2) | 12.20 · 6.84 · 5.56 · 5.69 · 12.20 | 80 / 69 |
| M4 | `rgb(250 250 252 / 0.78)` | same | 0.139 | `#d9d9da` | `#fbfbfd` | `#f8f9fb` | 12.71 · 7.13 · 5.79 · 5.93 · 12.71 | 83 / 71 |
| M5 | `rgb(250 250 252 / 0.88)` | `saturate(1.3) contrast(0.45) brightness(1.4)` | 0.076 | `#e8e8ea` | `#fbfbfc` | `#f9f9fb` | 14.65 · 8.21 · 6.67 · 6.83 · 14.65 | 91 / 80 |

Readings. Over the canvas, M1 and M2 differ from it by only 1.06:1 and 1.08:1 in dark and 1.16:1
in light: the rim and the shadow carry their edge, and the aurora gives them colour (ΔE 13.0 and
12.4 over lime I 0.35, about six just-noticeable steps). M3 over the bare canvas equals the solid
frame colour (dark n3 exactly, light within one level of n2), so a docked panel at rest looks as
today and changes only where a page or the light passes under it. Primary text holds APCA Lc 75
on every tier in both themes; dark glass-secondary sits at Lc 56–61, a warning, not a gate (A-4).

### 2.3 CSS

Tokens hold the values; `materials.css` composes them. Alphas are separate tokens so Tinted can
override them. The prefixed line uses literal values (G-22: Safari may ignore `var()` there;
unverified), one rule per tier and σ that a surface uses, and a test keeps both lines equal.

```css
/* tokens.css, dark (light redefines the same names) */
--glass-bar-alpha: 0.55;
--glass-bar-tint: rgb(32 34 39 / var(--glass-bar-alpha));
--glass-bar-filter: saturate(1.8) brightness(0.44);
--glass-bar-solid: var(--n4);
--glass-bar-shadow: var(--e3);
--rim-edge: 0 0 0 1px rgb(0 0 0 / 0.5);          /* 0 0 0 0.5px / 0.6 at resolution >= 2x */
--rim-top: rgb(255 255 255 / 0.34);  --rim-bottom: rgb(255 255 255 / 0.14);
--rim-inner: inset 0 1px 0 rgb(255 255 255 / 0.12);

/* materials.css */
.mat { position: relative; background: var(--mat-solid);
       box-shadow: var(--rim-edge), var(--rim-inner), var(--mat-shadow); }
.mat::before {                       /* lit rim: follows border-radius and corner-shape */
  content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1px;
  background: linear-gradient(180deg, var(--rim-top), rgb(255 255 255 / 0.10) 35%,
              rgb(255 255 255 / 0.05) 70%, var(--rim-bottom));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; pointer-events: none;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); }
.mat-bar { --mat-tint: var(--glass-bar-tint); --mat-solid: var(--glass-bar-solid);
           --mat-shadow: var(--glass-bar-shadow); }
@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  :root:not([data-glass='solid']) .mat { background: var(--mat-tint); }
  :root:not([data-glass='solid']) .mat-bar.s8 {
    -webkit-backdrop-filter: blur(8px) saturate(1.8) brightness(0.44);
    backdrop-filter: blur(8px) var(--glass-bar-filter); }
  :root[data-theme='light']:not([data-glass='solid']) .mat-bar.s8 {
    -webkit-backdrop-filter: blur(8px) saturate(1.5) contrast(0.45) brightness(1.4); }
}
```

Solid, `prefers-reduced-transparency` and `prefers-contrast: more` reset both lines to `none`.
Inside any `.mat`: secondary and tertiary text use `--glass-text-secondary` (n11), danger its glass
variant, disabled glyphs `--glass-text-disabled` (dark `#7d8086`: 2.42:1 worst, 4.65:1 over the
canvas; light `#7f838a`: 2.45:1 worst, 3.68:1 typical). Labels ≤ 12 px use weight ≥ 500; no text
under 11 px on M1/M2; no `mix-blend-mode` on text (G-17). No tier carries grain or noise (G-7
removed 2026-10-04, `quality-bar.md` Q-1), and never a live `feTurbulence`.

### 2.4 Rim, edge and shadow per tier

| Tier | Outer edge | Lit rim top / bottom (dark) | Inner light | Shadow | Light theme |
|---|---|---|---|---|---|
| M1 | 1 px black 0.50 | 0.34 / 0.14 | top 0.12 | e2 | Edge `rgb(15 17 22 / 0.12)`, rim white 0.85 / 0.40, inner white 0.60, shadows at 40 % alpha in `rgb(21 23 28)` |
| M2 | 1 px black 0.50 | 0.34 / 0.14 | top 0.12 | e3 | same |
| M3 docked | Hairline divider on the free edge only | 0.20 / 0 on the free edge | top 0.06 | none | same, no shadow |
| M3 floating (inset 8 px) | 1 px black 0.50 | 0.24 / 0.08 | top 0.08 | e4 | same |
| M4 | 1 px black 0.60 | 0.30 / 0.10 | top 0.10 | e4 | same |
| M5 | 1 px black 0.60 | 0.24 / 0.08 | top 0.08 | e5 | same |

Light comes from above, everywhere (S-3). `prefers-contrast: more` swaps rim and shadow for a 1 px
`rgb(255 255 255 / 0.36)` border (light `rgb(21 23 28 / 0.40)`); Solid keeps them (22 §7).

### 2.5 Lit glass

A lighter variant (AU-9) for surfaces **no page can ever pass under**: Library cards (around opaque
thumbnails), the open-and-drop card, the drop overlay's card, About. Its worst backdrop is the
field's brightest allowed pixel, so the field under it is capped at I 0.6 by a token
(`--light-cap-under-glass`). It shows the light 7 % more than M2 (ΔE 13.3 vs 12.4) and reads over
the bare canvas (1.22:1). It takes no wash (a white wash drops glass-secondary to 4.24:1): a lit
card shows hover by lifting. Dark theme only: in the light theme these surfaces use light M2,
floored over black, so they hold over any pigment field (spec 02.3). On compact, compact-height
and coarse pointers lit glass uses σ 20; the Library's 88 px launcher row uses σ 16 (c 0.994;
spec 02.4).

### 2.6 States inside glass

Measured over the worst backdrop. These fix the tier densities.

| Fill under text | M1 / M2 | M3 | M4 | M5 | Rule |
|---|---|---|---|---|---|
| Hover, white 0.045: glass-secondary | 4.47 / 4.53 | 5.66 | 5.49 | 5.65 | M1/M2 put state fills behind primary text and glyphs only |
| Pressed, white 0.075: glass-secondary | 4.07 / 4.13 | 5.15 | 4.99 | 5.15 | Same |
| Current, lime 0.12: primary · glass-secondary | 5.75 · 3.75 / 5.84 · 3.80 | 7.17 · 4.67 | 7.03 · 4.58 | 7.17 · 4.67 | Rows with secondary text live on M3–M5 |

With research 16's M3 (k 0.17) the current row's secondary text fell to 3.98:1, and with
research 20's 0.16 lime to 3.56:1 on menus. Hence the denser tiers and the 0.12 alpha.

### 2.7 Refraction

| Where | Kind | Recipe | Off when |
|---|---|---|---|
| M1 chips of fixed size only (the page pill, the facts chip); never the capsule (dock, palette, bars), since a line may rest under the dock and the morph must never change the filter (spec X20) | Backdrop lens, Chromium only (G-8) | `url(#lens-<w>x<h>)` **prepended** by a class that JavaScript adds after detecting Chromium (`navigator.userAgentData.brands`); never in the base declaration (Safari and Firefox drop the whole declaration, 16 §4.2). Map at the exact size, bezel 10 px (chips) or 12 px (bar), pull ≤ 6 px, convex `t^2.2`, no chromatic split; regenerated 150 ms after a shape change | Not Chromium; coarse pointer; Glass Tinted or Solid; Reduce motion On; any OS reduce or contrast preference; while the surface animates; automatic degrade step 1 |
| Segmented-control thumbs (the grid's scope, Compare's view switch, Settings' choices; the mode thumb is retired), slider thumbs | Own-content lens, all engines (G-9) | `filter: url(#thumb-lens)` on the track's label layer, pull 4–5 px, ≤ 5 % chroma spread; WebKit: 1× filter resolution, map regenerated only on shape change, filter id bumped | Same, except the engine |
| Panels, menus, sheets, toasts | None (G-10) | — | — |

Budget: at most three backdrop lenses on screen (16 §5.3: +9 % GPU and four times the main-thread
work per scrolled frame). The lens never covers page text at the rests §2.10 names.

### 2.8 The Glass setting and automatic degrade

| Level | What renders | When |
|---|---|---|
| L3 Clear + lens | Tiers with blur; lenses per §2.7 | Clear, Chromium, fine pointer, GPU compositing, no preference against it |
| L2 Clear | Tiers with blur, own-content lens | Clear elsewhere (Safari, Firefox, phones) |
| L1.5 Tinted | Every text-bearing tier's alpha 0.90, blur and rim kept, lenses off | Glass: Tinted; or at start when WebGL's unmasked renderer names a software rasteriser (SwiftShader, llvmpipe, "Software", Microsoft Basic Render Driver) (G-32) |
| L1 Solid | Every tier on its solid token, rim and shadow kept, no filters | Glass: Solid; `prefers-reduced-transparency: reduce` (shown as "Solid, set by your system", picker disabled); no `backdrop-filter` support |
| L1 High contrast | Solid with the strong border, no shadow, no light | `prefers-contrast: more` |
| L0 Forced colours | `Canvas` / `CanvasText`, filters off, light `display: none` | `forced-colors: active` |

Tinted solves legibility (at alpha 0.90 the unfiltered backdrop leaking fully still gives primary
8.67–9.96:1 and glass-secondary 5.65–6.49:1 over white), not cost: it keeps the blur. Cost has its
own ladder. A frame monitor runs while the user scrolls, zooms or pans; when more than 25 % of
frames exceed 20 ms in a 2 s window, Recto takes the next step and holds it for the session,
without touching the user's setting: (1) lenses off; (2) Ambient light to Still; (3) M3 surfaces
to their solid token, which equals their composite over the canvas; (4) every surface solid.
Devices with `deviceMemory ≤ 4` or `hardwareConcurrency ≤ 4` start at step 2 (G-23, AU-15).
CI browsers render in software, so tests run with ADR-0024's test-only render override and one
spec checks these start states without it.

### 2.9 Performance budget

| Rule | Compact < 600 | Medium 600–839 | Expanded 840–1199 | Large / xlarge ≥ 1200 |
|---|---|---|---|---|
| Blurred surfaces on screen, persistent + transient | 2 + 1 | 3 + 1 | 5 + 2 | 6 + 2 |
| Persistent glass area over moving content | ≤ 25 % (A-20) | ≤ 25 % | ≤ 32 % | ≤ 32 % (hard ceiling 50 % with the sidebar and a side sheet open) |
| Backdrop lenses | 0 | 0 | ≤ 3 | ≤ 3 |
| σ on M3–M5 | 20 | 20 | tier value | tier value |

Persistent glass in viewing (`flows.md` §6): compact counts two, the top bar and the dock, with
the page pill inside the dock. On compact the pending-marks bar and the options tier render
inside the dock's (or palette's) filtered element, not as their own, so Markup with marks
waiting still counts two. Medium counts three: top strip, dock, page pill. A toast stack is one
transient surface in every class: it renders inside one filtered container shaped to the toasts
(`08-feedback` FB4); on compact and medium a toast that appears while a contextual bar shows uses
the M2 solid token. Short viewports (height < 352 px) fold the top bar into the dock, so one
persistent surface remains (`flows.md` §6.1).

For every size: σ meets the coverage rule (c ≥ 0.985 at the centre) at the smallest size a surface
renders at; σ ≥ 16 above about 200 px of height (small blurs cost most on large surfaces, 16
§5.2); `backdrop-filter` is never animated; no `will-change: backdrop-filter`; one filtered
element per stack (the compact dock with its pending-marks bar or options tier); full-viewport
glass only when transient and over a frozen backdrop. The dock, palette, Pages bar, Compare bar
and Locked state are one element, so they share one σ per size (9 fine, 10 coarse and on phones,
8 in compact-height): the morph changes the clip, never the filter (§2.1 rule 5).

Coverage, computed for the sizes the component specs are expected to use:

| Surface | σ | c | Largest σ with c ≥ 0.985 |
|---|---|---|---|
| Chip 32 × 32 / 36 × 36 / 40 × 40 / 44 × 44 | 5 / 6 / 7 / 8 | 0.997 / 0.995 / 0.991 / 0.988 | 5 / 6 / 7 / 8 |
| Page pill, facts chip: 36 or 44 high, any width ≥ 60 | 7 · 8 | 0.990 · 0.994 | 7 · 9 |
| Dock 560 × 48 · coarse 600 × 56 · phone 360 × 64 · compact-height 600 × 44 | 9 · 10 · 10 · 8 | 0.992 · 0.995 · 0.999 · 0.994 | 9 · 11 · 13 · 9 |
| Palette 800 × 48 · coarse 800 × 64 · compact-height rail 64 × 400 | 9 · 10 · 8 | 0.992 · 0.999 · 1.000 | 9 · 13 · 13 |
| Pending-marks bar 480 × 40 · options tier 400 × 40 · toast 360 × 48 | 8 · 8 · 9 | 0.988 · 0.988 · 0.992 | 8 · 8 · 9 |
| Contextual bar 360 × 36 · coarse 480 × 44 | 7 · 8 | 0.990 · 0.994 | 7 · 9 |
| Top strip 1440 × 44 (phone top bar 390 × 44 alike) · coarse top strip 1440 × 52 | 8 · 10 | 0.994 · 0.991 | 9 · 10 |
| Chip 28 × 28 (Lock and E chips) · options tier coarse 520 × 52 · phone selection bar 344 × 56 | 5 · 10 · 10 | 0.990 · 0.991 · 0.995 | 5 · 10 · 11 |
| Short menu 200 × 64 · menu 200 × 92 · confirmation 400 × 168 (M5) | 12 · 16 · 24 | 0.992 · 0.996 · 0.9995 | 13 · 18 · 34 |
| Grid header 1440 × 44 · 1440 × 84 · compact Compare top bar 390 × 88 · compact find bar 358 × 44 | 8 · 10 · 10 · 8 | 0.994 · 1.000 · 1.000 · 0.994 | 9 · 17 · 18 · 9 |
| Sidebar 280 × 600 · 320 × 600 · Changes 320 × 600 | 40 | 0.9995 · 0.9999 · 0.9999 | 57 · 65 · 65 |
| Launcher row (lit) 600 × 88 · short-viewport capsule 320 × 44 | 16 · 8 | 0.994 · 0.994 | 18 · 9 |
| Panel 300 × 600 · popover 260 × 120 · menu 240 × 320 · sheet 560 × 420 | 40 · 16 · 24 · 48 | ≥ 0.9998 | 61 · 24 · 48 · 85 |

Rule of thumb for specs: σ ≤ height / 5 for bars at least three times as wide as tall; σ ≤
side / 5.5 for square chips. Anything glass that must look frostier than its size allows uses
research 22's oversized filter layer (box + 3σ each side, shaped with `mask-image`, decorative,
`aria-hidden`), tested on rendered pixels first (16 §6.3 saw it fail on wide bars).

### 2.10 What stays solid

| Surface | Treatment |
|---|---|
| The page, its annotations, fields, redaction marks, selection overlays; thumbnails, Pages grid cells, Library card artwork | Content; never themed |
| In-place editors (paragraph, free text, a note being typed) | Page white with page ink |
| Text inputs: find, rename, number fields, the ⌘K input | Opaque well (dark n2, light n1) with `--control-border` (dark white 0.48, light ink 0.55; 3.61–5.01:1 over the worst glass; spec X7), inside the glass (G-18) |
| Tooltips · dialog scrim | Solid n4 (light n1) with the glass rim (G-29) · dim only, no blur (G-31) |
| Long dense lists in M3/M4 that still read busy over a page | A sunken well (n2 / n3) |
| Phone sheet at the 92 % detent | Its solid layer fades in over `--duration-base` once the sheet settles, then the filter is removed (Apple: full height turns more opaque) |
| Overlay sidebars on coarse pointers | Solid (M-31) |

Layout rule that the material depends on (RA-15, Apple's steady state; `flows.md` §6.2's rest
rule): fit, centring and every jump (go to page, find, outline, links, undo reveal, focus) land
in the rectangle the chrome leaves free, so at those rests no glass sits over page content.
Pages pass under glass while moving; at an arbitrary scroll stop a line may sit under the dock
(about 2.2 % of a 1440 × 900 stage), and F (Focus) hides the dock and pill.

---

## 3. Light

### 3.1 Technique

One WebGL 1 fragment shader written in-house, about 3 KB gzip, no library (AU-1): value-noise
fbm with 4 octaves (lacunarity 2.03, gain 0.5, 37° rotation per octave), two levels of domain
warp, one to three Gaussian lobes, ribbons `(1 − |2f − 1|)^4 · 2.0` plus body
`smoothstep(0.25, 0.75, f) · 0.8`. Colour follows intensity *e*: teal until 0.08, mint by 0.35,
lime by 0.65, lemon from 0.78 to 1.0, added in linear light over the canvas as `ramp(e) · e^1.4 ·
I` (AU-6), or as pigment in the light theme (§1.6); gradient-noise dither ±0.5 LSB (AU-3).

| Parameter | Value |
|---|---|
| Backing store | `⌈cssW / 8⌉ × ⌈cssH / 8⌉`, long side clamped to 128–320 px (≤ 64 000 px), independent of DPR; About hero 1/4 (AU-2) |
| Context | One for the app; `alpha: false`, `antialias: false`, `powerPreference: 'low-power'`; `drawingBufferColorSpace = 'display-p3'` when `(color-gamut: p3)` matches, with the P3 stops of §1.6 (AU-18) |
| Speeds | Still 0 · ambient 0.12 (≈ 5 px/s at 1440 px) · excited 0.30 (≈ 12 px/s) |
| Frame caps | Still: no frames · ambient 15 fps · excited 30 fps · springs at display rate for ≤ 600 ms |
| Time | Integrated (`t += min(dt, 1/15) · speed`), wraps every 600 s with a 400 ms cross-fade; no periodic modulation (HIG: nothing near 0.2 Hz) |
| Fallback | No WebGL, no `highp`, or a lost context: a static four-gradient CSS field in OKLCH whose falloff turns lime → emerald → teal (G-16), moved only by opacity; never `filter: blur()` on moving shapes, never `@property` positions (G-14) |
| Integration | The canvas and every glass surface share one backdrop root: no ancestor between them with `filter`, `opacity < 1`, `mask`, `clip-path`, `mix-blend-mode` or `backdrop-filter`; resize on a 150 ms debounced ResizeObserver (AU-19) |

### 3.2 Placement

| Place | Form | Rest | Events |
|---|---|---|---|
| **Empty Library** | Full-window field; a lobe under the open-and-drop card (0.5, 0.35, gain 1.0, r 0.42), a dimmer one top right (0.82, 0.78, 0.6, 0.35) | I 0.45; in Auto, ambient drift | Arrival; drag-over; success |
| **Library with files** | Same field; lobes behind gaps between card rows, never centred on a thumbnail | I 0.40, still | Open, close: a 2 s drift (none on Combine, which leaves the Library: spec 02.21); success |
| **Drag-over in a document view** | The field behind the drop overlay's scrim, the only time it enters a document view | — | Drag-over |
| **Beneath the palette's armed tool** (dark only), never under the dock | CSS under-light, §3.3 | Static | Slides to the armed tool |
| **Processing** | 1.5 px conic ring around the progress capsule, the toast or the facts chip | — | Runs while the job runs |
| **Success** | Ring bloom; Library pulse | — | Once per success |
| **About hero** | 1/4 resolution, I 0.8, lobes behind the clip, not the heading | Drift with a visible pause control | Pauses off-screen |
| App icon, social card, press stills | One rendered frame | — | — |

**Text-safe band** (spec 02.2): a `textSafe` uniform of up to four rects takes intensity to 0
within 24 px of text that sits on the field, such as the Library head row; a pixel test checks
Y ≤ 0.026 behind it.

**Never:** on a page or within 64 px of its edge, document thumbnails included (Library
thumbnails are exempt from the 64 px distance and keep the brightness rule, I 0.6 cap under lit
glass and Library mean Y ≤ 0.03, while A-6's pixel test covers them: spec 02.1); in the Pages grid or
Compare; in the stage of a document view at rest; under the dock; as the own light of a dialog,
sheet, menu or tooltip (over the Library they pick it up through their glass); for errors,
warnings, redaction or destructive confirmations (lime reads as "go"); as a frame at the screen
edge; behind text on the bare canvas above Y 0.026 (tertiary text n9 fails at Y 0.027, §1.7
method; A-5).

### 3.3 Event behaviour

| Event | What changes | Spring (k, c) | Settles |
|---|---|---|---|
| Arrival (load, entering the Library) | I 0 → rest; speed 0.12 → 0 over 4 s | 60, 15.5 | ≤ 5 s |
| Drag-over enters | I +0.15 (cap 0.6), speed → 0.30, nearest lobe radius × 1.3 | 120, 22 | 0.43 s |
| Pointer moves during drag-over | Nearest lobe follows the pointer | 80, 18 | 0.53 s |
| Drop or leave | Back to rest, then speed → 0 | 60, 15.5 | 0.61 s |
| Processing ring | 1.5 px conic gradient (transparent, lime at 40°, mint 60 % at 90°, transparent from 150°) on an oversized square, `transform: rotate()` once per 2.4 s, linear, clipped to the capsule's border with `mask-composite: exclude`; no halo outside the capsule; always next to text ("Exporting… 40 %") | linear | Until the job ends |
| Success bloom | Ring opacity 0 → 1 in 180 ms, hold 120 ms, out over 900 ms; Library I +0.10 for 1.2 s | ease-out; 60, 15.5 | 1.2 s |
| Armed tool under-light | A sibling *beneath* the Markup palette, clipped to its capsule: `radial-gradient(closest-side in oklch, oklch(0.92 0.21 124 / 0.5), oklch(0.78 0.19 138 / 0.3) 45%, oklch(0.58 0.15 152 / 0))`, 64 px wide, centred under the armed tool, moved by `transform` | `--spring-smooth` | 0.38 s |

The palette's filter clamps the under-light first: lime 0.5 under M2 over a white page keeps
primary at 8.32:1 and glass-secondary at 5.42:1 (8.22 and 5.35 at the fine palette's coverage,
c 0.992), and over the canvas shifts the palette by ΔE 10.6. It is absent under the dock, which
arms nothing, under Glass Solid and in the light theme (additive light vanishes on a light
field). It is the one exception to A-6 (ADR-0028 §2.5): clipped to the capsule, so page pixels
outside the palette's rectangle stay identical with a tool armed and with Light Off. The light
springs are slower than the chrome's on purpose *(judgement)*.

### 3.4 Ambient light: Auto · Still · Off

| Value | Behaviour |
|---|---|
| Auto (default) | Event motion everywhere the field is allowed, plus ambient drift on the empty Library and About, gliding to still after 60 s without input and 5 s after the window loses focus; all gates apply |
| Still | One frame per view; events change intensity by a ≤ 150 ms cross-fade (A-9) |
| Off | No field, no under-light; the ring and bloom become a static rim |

Overrides: OS reduced motion or Reduce motion On → Still; forced colours → Off
(`display: none`, since a canvas does not vanish by itself); `prefers-contrast: more` → Off;
Glass Solid or reduced transparency → Still at I × 0.7. The control says when the system decides.

### 3.5 Budgets, pauses, gates

| Item | Budget |
|---|---|
| Code · memory | ≤ 4 KB gzip, lazy-loaded when the Library or the drop overlay first shows · backing store ≤ 100 KB |
| GPU · main thread | Shader ≤ 0.5 ms per frame on a 2020-class integrated GPU at DPR 2 · ≤ 0.3 ms per field frame |
| Energy (10 min on the Library) | Auto ≤ 1.1 × Still; ambient drift ≤ 1.3 × |
| Brightness | Library mean Y ≤ 0.03, area above L 0.65 ≤ 1.5 %; About ≤ 0.06 and ≤ 4 % (AU-7) |
| Flash | Luminance swing in any 341 × 256 px region < 0.10 (A-8) |

Pauses (AU-14): hidden tab; field off-screen; window unfocused 5 s; 60 s idle (drift); scroll,
pinch, zoom, drag, pen down and typing (resume 300 ms after); a sheet or dialog over the Library.
Gates (AU-15): Compute Pressure `fair` → 10 fps, `serious` → still; battery discharging under
20 % → still; low-end heuristic → still; a watchdog steps 30 → 15 → still once per session.

---

## 4. Typography

### 4.1 Family and delivery

Inter stays the only UI face (T-1): the tallest x-height of 26 open faces measured (0.546 em),
tabular figures, full Turkish, an optical-size axis. What changes is delivery (T-2):

| File | Unicode | Axes | Features kept | woff2 |
|---|---|---|---|---|
| `inter-recto-latin.woff2` | U+0000–00FF, U+0131, U+0152–0153, U+2000–206F, €, ™, U+2190–2199, − ∕, ⌘ ⌥ ⌃ ⇧ ⌫ ⎋ | opsz 14–32, wght 100–900 | kern, mark, mkmk, ccmp, locl, calt, case, tnum, pnum, frac, cv05, cv08, ss03, zero | 73.4 KB |
| `inter-recto-latin-ext.woff2` | U+0100–017F (less the above), U+0218–021B, ₺ | same | same | 24.6 KB |

- Cut from upstream `inter-ui` 4.1.1 by a committed `pyftsubset` script, served from the origin
  (`font-src 'self'`) and cached by the service worker. Private family name `'Inter Recto'`;
  `font-display: swap`; Latin preloaded; a fallback face with `size-adjust` and ascent/descent
  overrides computed by the same script, so the swap does not move layout.
- `font-optical-sizing: auto` now works. No italic file (T-3); JetBrains Mono leaves (T-4);
  technical strings use Inter with `tnum` and `zero`. An About display accent is the brand's call.

### 4.2 Scale

| Token | Fine pointer | Coarse pointer | Weight | Tracking dark / light | Use |
|---|---|---|---|---|---|
| `--type-caption` | 11/14 | 12/16 | 500 | +0.015 / +0.010 em | Badges, counts, keycaps |
| `--type-footnote` | 12/16 | 13/18 | 450 (500 on glass) | +0.010 / +0.005 em | Secondary lines, metadata, section labels at 550 |
| `--type-body` | 13/18 | 15/20 | 450 | +0.005 / 0 em | UI base: rows, menus, buttons at 550 |
| `--type-callout` | 15/20 | 17/22 | 450 | −0.005 em | Sheet body, empty-state text |
| `--type-title3` | 17/22 | 19/24 | 600 | −0.010 em | Panel and sheet titles |
| `--type-title2` | 22/28 | 24/30 | 650 | −0.015 em | Dialog titles, Library section heads |
| `--type-title1` | 28/36 | 30/38 | 650 | −0.020 em | Library greeting, About sections |
| `--type-display` | 40/44, 56/60 | same | 700 | −0.022 em | About only, never in a clipping box |

Tracking follows Inter's dynamic-metrics curve, with +0.005 em in dark at 13 px and below (T-6).
Title 1 moves from research 20's 28/34 to 28/36 so every size that can be truncated keeps line
height ≥ 1.25 × size (A-21). Text inputs are 16 px on coarse pointers whatever their role (iOS
zooms smaller fields). At most three sizes per surface; weight before size (X-3).

### 4.3 Weights, numerals, case

- Weights (T-7): 450 running text (its 1.27 px stem matches a 20 px icon's 1.25 px stroke), 550
  buttons and labels, 600–650 titles, 700 display; never below 400.
- Numerals (T-8): `tnum` on every number that changes (pages, zoom, sizes, counts, timers);
  `case` on keycaps and capitals; `cv05` + `cv08` (tailed l, serifed I) where characters must be
  told apart: file names, Find, passwords, metadata, page labels; `zero` in technical strings.
- Case (T-9): sentence case everywhere; the uppercase tracked section labels go, replaced by
  footnote 550 in secondary colour.
- Layout (T-10): `text-wrap: balance` on titles, `pretty` on paragraphs, `text-box: trim-both
  cap alphabetic` in capsules and buttons.

### 4.4 Turkish

1. `lang` on the root follows the locale, so CSS case mapping picks İ/ı correctly.
2. Never `text-transform: capitalize` ("ilk ışık" becomes "Ilk Işık"); uppercase only under
   `lang`, and the language barely uses it (§4.3).
3. JavaScript case mapping always passes the locale (`toLocaleUpperCase(getLocale())`); a lint
   check bans argument-less calls in UI code (A-21).
4. Line height ≥ 1.25 × size wherever text can clip (`overflow: hidden`, ellipsis, `text-box`):
   at 13 px İ and Ğ rise 13 px above the baseline against 9 px for I.
5. Labels are designed at 1.8 × the English length (the 90th percentile of short labels); no
   fixed-width text containers in chrome; when a label cannot fit, icon plus tooltip, with the
   full name as the accessible name.
6. Copy keeps the *siz* register and is written, not translated (BR-V3).

---

## 5. Icons

### 5.1 Set and rules

- **Phosphor (MIT), regular and fill** (I-1). It is the only set with a designed fill twin for
  all 39 of Recto's core concepts (Tabler 23, Lucide 0).
- **Generated at build time.** A script reads `@phosphor-icons/core` (devDependency) for the
  names in `tools/icons/manifest.json` and writes one `ui/icons.generated.tsx` with two paths per
  icon and one `<Icon name filled size />` component. About 18 KB gzip for ~90 icons (Lucide:
  5 KB); never `@phosphor-icons/react`, which ships six weights per icon.
- **Outline at rest, fill when selected** (I-2): the armed tool, the current navigation item,
  the on segment of a segmented control, toggled switches with glyphs, the current filter.
  Action glyphs (close, plus, check, carets, arrows, more) never swap.
- **Sizes and stroke** (I-3): Phosphor regular is 1/16 of the size.

| Size | Stroke | Pairs with | Where | Hit area fine / coarse |
|---|---|---|---|---|
| 16 | 1.00 px | 12 px text | Menus, rows, inline status | 24 / 44 |
| 20 | 1.25 px | 13 px text at 450 | Glass bars, the dock, sidebar, top strip | 32–36 / 44 |
| 24 | 1.50 px | 15–17 px text | Coarse-pointer bars, the phone dock, Library actions, phone sheets | 44 |
| 32, 48 | duotone | Titles | Empty states, onboarding, About | — |

- **Colour** (I-4): monochrome; the armed glyph is ink on lime (dark) or lime on ink (light);
  status colour only on a destructive item and honesty warnings; duotone's second layer is
  `currentColor` at 20 %, or lime at 25 % in empty states (lime-800 at 25 % in the light theme,
where lime vanishes; spec 08.11). **Alignment** (I-5): whole-pixel boxes
  and a per-icon offset map set by eye at 2×. **Labels** (I-6): groups and uncommon tools carry a
  label or a tooltip with the key; icon-only only for close, search, undo, redo, more and share.
- **Custom glyphs** (I-7), drawn on Phosphor's 256 grid with a 16-unit stroke and a fill twin:
  Redact, Edit text, Compare, Combine, Page furniture, and the Recto glyph (brand track).
- **Motion** (I-8): select (outline → fill), replace, activity; §7.3.

### 5.2 Mapping of the main tools and chrome

Every Phosphor name was found in `@phosphor-icons/core` 2.1.1 with its `-fill` twin.

| Concept | Lucide today | Phosphor |
|---|---|---|
| Select (tool and group) · pen · highlighter · eraser · lasso | `MousePointer2` · `PenLine` · `Highlighter` · `Eraser` · `LassoSelect` | `cursor` · ink dot (`pen` where a glyph is needed) · `highlighter` · `eraser` · `lasso` |
| Dock: Pages · Markup · Fill & sign · More (new) | — | `squares-four` · `marker-circle` (was `pen-nib`, too close to `signature` at 20 px; owner feedback 2026-10-08) · `signature` · `dots-three` |
| Rectangle · ellipse · line · arrow | `Square` · `Circle` · `Minus` · `ArrowUpRight` | `square` · `circle` · `line-segment` · `arrow-up-right` |
| Edit text · text box · Text group · note | `TextCursorInput` · `Type` · `Type` · `StickyNote` | custom *edit-text* (fallback `cursor-text`) · `textbox` · `text-aa` · `note` |
| Underline · strikeout · squiggly | `Underline` · `Strikethrough` · `Waves` | `text-underline` · `text-strikethrough` · `wave-sine` |
| Image · signature · stamp · Fill & sign group | `Image` · `Signature` · `Stamp` · `FilePen` | `image` · `signature` · `stamp` · `signature` |
| Redact tool and group | `EyeOff` | custom *redact* (fallback `eye-slash`) |
| Lock · unlocked · signed file (tab seal, lock reason) | `Lock` · — · — | `lock-simple` · `lock-simple-open` · `seal-check` |
| Find · Pages grid · Files · Compare · OCR | `Search` · `LayoutGrid` · `Files` · `FileDiff` · `ScanSearch` | `magnifying-glass` · `squares-four` · `files` · custom *compare* (fallback `git-diff`) · `scan` |
| Rotate right · left · crop · delete · copy | `RotateCw` · `RotateCcw` · `Crop` · `Trash2` · `Copy` | `arrow-clockwise` · `arrow-counter-clockwise` · `crop` · `trash` · `copy` |
| Export to file · share · undo · redo (new) | `Download` · — | `download-simple` · `export` · `arrow-u-up-left` · `arrow-u-up-right` |
| Comment · add comment · bookmark · sidebar ▤ | `MessageSquare` · `MessageSquarePlus` · `Bookmark` · `PanelRight` (the inspector today) | `chat-centered-text` · `chat-centered-dots` · `bookmark-simple` · `sidebar-simple` |
| Privacy and signature valid · invalid · certificate | `ShieldCheck` · `ShieldAlert` · `BadgeCheck` | `shield-check` · `shield-warning` · `seal-check` |
| Info · warning · more · close · add · check | `Info` · `TriangleAlert` · `MoreHorizontal` · `X` · `Plus` · `Check` | `info` · `warning` · `dots-three` · `x` · `plus` · `check` |
| Carets · zoom in · out | `Chevron*` · `ZoomIn` · `ZoomOut` | `caret-*` · `magnifying-glass-plus` · `magnifying-glass-minus` |
| Shortcuts · theme System, Light, Dark (new) | `Keyboard` · — | `keyboard` · `monitor`, `sun`, `moon` |

---

## 6. Shape, space and depth

### 6.1 Radius and nesting

| Token | Value | Use |
|---|---|---|
| `--radius-page` | 2 | Pages, on-page marks |
| `--radius-xs` | 4 | Badges, keycaps |
| `--radius-sm` | 8 | Rows, inputs, menu items, small square buttons |
| `--radius-md` | 12 | Menus, popovers, tooltips, thumbnail cards |
| `--radius-lg` | 16 | Library cards, wells in panels |
| `--radius-xl` | 20 | Dialogs, desktop sheets, floating panels |
| `--radius-2xl` | 28 | Phone sheets, About cards |
| `--radius-capsule` | 999 | Every bar, chip, text button, segmented control |

Nesting (S-1): inner radius = outer radius − inset. A 12 px menu with a 4 px inset gives 8 px
items; a 20 px panel with an 8 px inset gives 12 px wells; a 44 px capsule with a 4 px inset
gives 36 px circular buttons. Icon-only buttons are circles, text buttons capsules. Every floating
bar is a capsule, so all bars share one shape.

Squircles (S-2): under `@supports (corner-shape: superellipse(1.5))` (Chromium 139+), radii from
`--radius-md` up get `superellipse(1.5)` and × 1.35 (menus 16, cards 22, dialogs 27, phone sheets
38), clamped to half the shorter side; never on capsules or pages. Ring, rim and backdrop clip
follow the shape; other engines show circular corners at the base radius.

### 6.2 Space and density

A 4 px grid with a 2 px half-step for optical fixes: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64
(S-6). Density follows the input, not the width (M-2):

| | `pointer: fine` | `pointer: coarse` or `any-pointer: coarse` |
|---|---|---|
| Controls, rows | 28 px | 44 px |
| Bar buttons · bars | 32–36 · 44 px (contextual bars 36) | 44 · 56 px |
| Dock · Markup palette | 48 · 48 px | 56 · 64 px; phones 64 · 64; compact-height dock 44, palette rail 64 wide |
| Minimum target | 24 × 24 or spaced (2.5.8) | 44 × 44, hit areas never overlap |
| Gaps between targets | ≥ 4 px | ≥ 8 px |
| Text base · inputs | 13 · 13 px | 15 · 16 px |
| Side gutter | 12–16 px | 16 px plus safe-area insets |
| Keycaps | Shown | Only after a physical key press |

### 6.3 Elevation

| Token | Dark value | Use |
|---|---|---|
| e0 | none | Docked surfaces, cards resting on the canvas, the page (hairline only) |
| e1 | `0 1px 2px rgb(0 0 0 / 0.30)` | On-page handles, page badges |
| e2 | `0 4px 12px -4px rgb(0 0 0 / 0.50)` | M1 chips |
| e3 | `0 10px 28px -10px rgb(0 0 0 / 0.60), 0 2px 6px -2px rgb(0 0 0 / 0.35)` | M2 bars, toasts |
| e4 | `0 16px 40px -12px rgb(0 0 0 / 0.62)` | M4 menus, popovers, palette, floating M3 |
| e5 | `0 30px 80px -20px rgb(0 0 0 / 0.70)` | M5 sheets and dialogs |

Light theme: the same geometry in `rgb(21 23 28)` at 40 % of each alpha. Shadows are tuned for
the page case; over the dark canvas they vanish, which is Apple's adaptive shadow for free (16
§7.3). **Controls never glow** (S-5): no coloured outer shadow on buttons, tools or focus. Only
light glows: the aurora and the glass rims (G-2).

---

## 7. Motion

### 7.1 Tokens

Springs carry position, size and scale; eases carry opacity and colour (18 §3). Mass 1;
`k = (2π / d)²`, `c = 4π(1 − b) / d`. "CSS duration" is the time to within 0.1 % of the target.

| Token | d | Bounce | k / c | 90 % at | 99 % at | CSS duration | Use |
|---|---|---|---|---|---|---|---|
| `--spring-press` | 0.20 s | 0 | 987 / 62.8 | 124 ms | 212 ms | 300 ms | Press release, switch thumbs, check boxes |
| `--spring-quick` | 0.28 s | 0 | 504 / 44.9 | 174 ms | 296 ms | 420 ms | Menus, popovers, contextual bars, tiers, toasts, zoom steps |
| `--spring-smooth` | 0.36 s | 0 | 305 / 34.9 | 223 ms | 381 ms | 530 ms | Bar morphs, panels, reflow, side dialogs, under-light |
| `--spring-glide` | 0.46 s | 0 | 187 / 27.3 | 285 ms | 487 ms | 680 ms | Phone sheets, smart zoom, large non-blocking moves |
| `--spring-fling` | 0.40 s | 0.15 | 247 / 26.7 | 203 ms | 285 ms | 560 ms | Releases with velocity > 300 px/s: drop settle, sheet throw, toast swipe, pinch end |
| `--spring-pop` | 0.32 s | 0.25 | 386 / 29.5 | 143 ms | — | 410 ms | One small glyph: success check, count badge. Never a surface |
| `--spring-track` | 0.10 s | 0 | 3948 / 125.7 | 62 ms | 106 ms | 150 ms | Things that follow the pointer but may lag |

| Ease | Value | Use |
|---|---|---|
| `--duration-instant` · `-fast` · `-base` · `-slow` | 60 · 120 · 180 · 280 ms | Hover · exits, tooltips, icon replace · entry fades, scrims · large cross-fades |
| `--ease-out` | `cubic-bezier(0.2, 0, 0, 1)` | Entering fades |
| `--ease-exit` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | Leaving fades and scales (exits ≈ 60 % of entries) |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Progress fills |
| `--vt-duration` | 240 ms with `--ease-spring` | Every View Transition (§7.4) |

Limits from A-10 are read on the 99 % settle time: input-blocking transitions ≤ 250 ms, any
transition ≤ 500 ms, ζ ≥ 0.9 for surfaces ≥ 25 % of the viewport (all zero-bounce tokens are
ζ 1.0), small controls ζ ≥ 0.7 (`--spring-pop` is 0.75), travel ≤ 1/3 of the viewport.

### 7.2 CSS form

A critically damped spring from rest has one shape, so one curve serves every zero-bounce token
(MO-2). The curves are research 18's, generated from the analytic solution and reduced to within
0.25 % of the distance:

```css
:root {
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
  --spring-press: 300ms; --spring-quick: 420ms; --spring-smooth: 530ms; --spring-glide: 680ms;
  --spring-fling: 560ms; --spring-pop: 410ms; --spring-track: 150ms;
  --press-scale-mouse: 0.97; --press-scale-touch: 0.94; --rise-distance: 4px; --enter-scale: 0.96;
}
/* transition: transform var(--spring-quick) var(--ease-spring),
               opacity var(--duration-base) var(--ease-out); */
```

Script springs (`motion/springs.ts`) are the same seven as `{ stiffness, damping, mass: 1 }`,
physics-defined so they accept an initial velocity (MO-3).

### 7.3 Catalogue

Generic transitions that every component spec picks from; the MC ids are research 18's.
"RM" is the reduced-motion form.

| Name | Trigger | What moves | Token | Interruption | RM |
|---|---|---|---|---|---|
| press | Pointer down / up | Scale to 0.97 (mouse) or 0.94 (touch, pen) in 60 ms `--ease-out`, 0.98 / 0.96 for surfaces of 120 px or more (spec 02.5); release on spring; on glass a radial press light at the contact point, white 0 → 0.12 (0.24 under a finger; ink at half those in light), 120 ms in, 240 ms out (MC-21, G-26) | press | Release mid-press reverses | Colour change only |
| hover | Pointer enters | One fill step; nothing moves | instant | — | Same |
| select | Arm, select, toggle | Outline → fill cross-fade 120 ms; scale 0.88 → 1.04 → 1 over 240 ms (I-8) | pop curve | Next arm retargets | Instant swap |
| replace | A glyph changes meaning | Out: scale 0.8 + fade, 90 ms; in: 0.8 → 1, 150 ms | fast | — | Instant swap |
| popup | Menu, popover, palette opens | From `scale(0.96)`, 4 px toward the anchor, opacity 0; `transform-origin` at the trigger; exit fade 100 ms + `scale(0.98)` (MC-14, MC-16) | quick | Reverses from current | Fade 120 ms |
| materialize | End of any glass entrance | Lit rim alpha 0 → value over the last 40 % of the entrance (16 §7.8) | — | — | None |
| tooltip | 500 ms hover; 0 ms while warm | Opacity + `scale(0.98)` (MC-15) | fast | — | Fade |
| bar morph | Dock ⇄ Markup palette ⇄ Pages bar ⇄ Compare bar ⇄ Locked; the compact Draw ⇄ Sign set swap | Glass shape by the capsule's own width and height in `contain: layout style`, pill radius constant, so backdrop, rim and shadow follow (`quality-bar.md` Q-6, amended 2026-10-04); chips by FLIP, 15 ms stagger; no lens on the capsule (X20), so the filter never changes (MC-8, here viewing ⇄ Markup; MC-11) | smooth | Retarget from the current shape | 120 ms cross-fade |
| sheen | End of a bar morph or materialize (fine pointer, Clear) | One conic sweep of the rim, 500 ms, never a loop (G-27, A-10) | — | — | None |
| sheet push | Navigation inside a sheet (Settings, Batch, result pages) | `translateX(24px)` + opacity in, back reversed (spec X8) | smooth | Reverses | Fade 150 ms |
| tier rise | A row appears above a bar | `translateY(8px) scale(0.98)` + opacity; exit 100 ms (MC-12) | quick | Reverses | Fade |
| contextual | Bar at a selection | 4 px + `scale(0.96)` from the anchor; moves < 200 px follow, larger fade out 80 / in 120 ms; hidden while the selection drags (MC-13) | quick | Retarget | Fade |
| sheet | Open, drag, release | `translateY` to the detent; 1:1 drag; rubber band above the top detent; release projects with r 0.998 and settles with the release velocity (MC-18) | glide / fling | Grab at any time | Fade 150 ms; drag stays 1:1 |
| panel | Side panel open / close | Own width by `transform`; the stage's page column by FLIP, in sync (MC-19) | smooth | Retarget | Instant |
| hide on scroll | 24 px of downward scroll in viewing, compact and compact-height only | Top bar up and dock down by their height plus the safe area, by `transform`; `inert` from the first frame; back on upward scroll, a tap, either end of the file, focus, a sheet or any key; never with keyboard modality or focus inside, in Markup, the grid or Compare, or with Keep tools visible (A-12, A-13) | quick | Reverses from the current position | 150 ms fade |
| dialog | Open / close | Centre: `scale(0.96)` + opacity, scrim 180 ms, exit 120 ms; side: 24 px + opacity (MC-17) | quick / smooth | Reverses | Fade |
| toast | Show, stack, dismiss | 16 px up + opacity; exit 120 ms; stack by FLIP; swipe dismisses past half its width or at > 800 px/s (MC-31) | quick / fling | Grab at any time | Fade |
| view change | Library ⇄ document (MC-2, MC-3); page ⇄ Pages grid, on release, never scrubbed (MC-9); into and out of Compare (MC-10) | View Transition: shared element morph plus root cross-fade, total ≤ 250 ms; named chrome stays on top | `--vt-duration` | `skipTransition()` on the next navigation | 150 ms root cross-fade, no names |
| reflow | Reorder, insert, delete in grids, lists, tabs | FLIP of visible items; items entering the virtual window do not animate; a deleted item `scale(0.9)` + fade 120 ms (MC-4–MC-7, MC-27, MC-28) | smooth; fling at a drop | Retarget with velocity | Instant |
| lift and settle | Drag start, drop | Source dims to 40 % in 100 ms; valid drop settles by FLIP; invalid drop returns in 150 ms (MC-29) | fling | — | Instant |
| zoom step | Button, key, mouse notch | Page layer `transform` about the viewport centre; layout commits once at rest (MC-23, MP-8) | quick | Retarget with velocity | Instant |
| pinch, smart zoom | Gesture, double-click or double-tap | 1:1 during; release projects with r 0.99, snaps to fit width, fit page or 100 % within 6 %, rubber-bands past the limits (MO-7, MC-24) | track → fling; smart zoom glide | Grab mid-settle | 1:1 kept, no momentum, smart zoom instant |
| scroll-to | Go to page, find, outline, undo reveal | Native smooth scroll up to 1.5 viewport heights; farther, jump to one height before, then smooth (MC-25) | browser | User scroll cancels | Instant |
| progress | A job runs | Determinate bar by `scaleX`, 200 ms `--ease-standard` per update; ring §3.3; no spinner before 400 ms (MC-33) | — | — | Static rim and percentage; indeterminate becomes an opacity pulse, 1.6 s (A-9's progress exemption, ADR-0028 §2.5) |
| success | A job ends well | Icon replace to a check that pops; ring bloom; Library light pulse (MC-34, AU-12) | pop | — | Icon swap |
| undo reveal | Undo, redo | Scroll-to, then a 500 ms ring flash (80 in, 160 hold, 260 out; A-10): `--select` on a page, lime in the chrome (MC-32) | — | — | The ring shown statically for 500 ms, then removed without animating |
| fold (composite) | The facts chip folds into ⓘ | *popup* exit toward the ⓘ, then the *undo reveal* ring on the ⓘ (spec 02.6); no new token | quick | — | Fade, static ring |
| find step (composite) | A Find hit is stepped to | *scroll-to*, then *undo reveal* on the hit (spec 05.2); no new token | browser | User scroll cancels | Instant, static ring |
| light respond | Arrival, drag-over, success | Shader uniforms on the light springs of §3.3 (MC-36) | light springs | Retarget | Still frame, ≤ 150 ms opacity |
| ink | Pen down | No animation on the stroke; chrome may fade to 20 % over 120 ms during a stroke and 1 s after, never while focus is inside it (MC-38, A-13) | fast | — | Same |

### 7.4 Engine and rules

**Decision (MO-8): CSS + View Transitions + a small in-house core, no animation library.**

- CSS transitions with `linear()` springs and Base UI's `data-starting-style` /
  `data-ending-style` for popups, bars, press and feedback: no script, compositor-run, reversible.
- `document.startViewTransition` through a 10-line helper with `flushSync` (Zustand updates never
  trigger React's `<ViewTransition>`), for view changes only.
- `apps/web/src/motion/`: analytic spring with retarget and velocity hand-off onto Web
  Animations, FLIP, a 100 ms velocity tracker, projection, rubber band, `reducedMotion()`.
  Prototype 1.35 KB gzip; production under 3 KB.

Measured (18 §5–§6): under 50 ms long tasks a requestAnimationFrame spring lost 31 % of its
frames where CSS and Web Animations lost 0–2 %; Motion's layout animations run on the main thread
from zero velocity and cost 25–44 KB gzip; the `width` morph costs 59 layouts and 119 paints per
second where `clip-path` costs no layout and half the raster time.

**View Transitions are capped at 250 ms.** Research 22 measured that clicks during a transition
land on `<html>` and are lost even with `pointer-events: none` on the overlay, as the spec
requires. So `--vt-duration` is 240 ms (90 % at about 150 ms), not research 18's 680 ms glide.
A longer hero that does not block input (a decorative FLIP overlay, or element-scoped
transitions once they leave Chromium-only) is a follow-up. Glass chrome that must stay on top
gets its own `view-transition-name` with position animation off (18 §6.6); the update callback
returns in under 50 ms and sets focus inside it (22 §5.5).

Rules (MP-1 to MP-12): animate `transform`, `opacity`, and `clip-path` on chrome-sized elements,
never layout properties; no perpetual animation in document views; motion on or under glass
≤ 500 ms (A-10); stagger ≤ 10 items × 12 ms; `contain: layout paint` on animated islands; `will-change`
only from script, on ≤ 3 elements, during a gesture; springs run on `performance.now()`.

### 7.5 Reduced motion per token

| Token or effect | Full | Reduced |
|---|---|---|
| press, quick, smooth, glide, track | Spring | Spatial change instant; any accompanying fade kept |
| fling, pop | Overshooting spring | Instant, no overshoot |
| `--duration-instant` · `-fast` · `-base` · `-slow` | 60 · 120 · 180 · 280 ms | 0 · 100 · 150 · 150 ms |
| `--rise-distance`, `--enter-scale`, press scales | 4 px, 0.96, 0.97 / 0.94 | 0, 1, 1 (colour change only) |
| View Transitions | Named morphs, 240 ms | `view-transition-name: none` everywhere; root cross-fade 150 ms |
| Projection, momentum, rubber band | On | Off: a release stops, then snaps without overshoot |
| Direct manipulation (drag, pinch, pan, ink) | 1:1 | 1:1, unchanged |
| Ambient light | Events and drift | Still frame; responses ≤ 150 ms opacity (A-9) |
| Spinner, processing ring | Rotation | Opacity pulse ≥ 1.6 s period, static rim, text percentage (opacity is not motion, WCAG 2.3.3; A-9's progress exemption, ADR-0028 §2.5) |
| Lens, sheen, materialize, press light | On | Off |

One `motion` module is the only source of truth for script: it reads the media query and the
setting, and every JavaScript animation asks it. A test sweeps `document.getAnimations()` after
each state change (A-9), because today's global CSS rule leaves Web Animations and View
Transitions running (22 §5.2).

### 7.6 The Reduce motion setting

"Reduce motion: System · On", stored as `data-motion="reduced"` and matched by the same CSS blocks
as `prefers-reduced-motion: reduce`; when the OS asks, it shows "On, set by your system", disabled.

---

## 8. Feedback

- **Haptics.** Android only, `navigator.vibrate(8–12)`, for drag lift, snap and drop. Nothing on
  iOS (no reliable API; the switch-input trick fires only on direct taps since iOS 26.5). A
  Haptics switch where the API exists, default on; never the only signal (M-37).
- **Sound: none.** PDF work happens in offices, libraries and meetings; Preview and Acrobat are
  silent; outcomes are shown and announced (X-9). Decided once, not per component.
- **Toasts.** M2 capsules at the bottom centre of the free rectangle, above the dock, the palette
  and the pending-marks bar, clear of the safe area; at most three, 14 px apart. Information
  4 s; with an action (Undo, Show, Restore) ≥ 10 s, paused on hover and focus, in the F6 cycle
  (A-24). Copy is verb and object ("Deleted page 3"); the action is a secondary button, so the
  view's one lime stays put. This is where today's spoken-only feedback becomes visible (F-5,
  INV-6).
- **Progress.** Determinate where the engine reports it. The control that started a job becomes
  its progress capsule ("Exporting… 40 %" with the ring), or the toast stack shows it; no blocking
  dialog for background work (F-12). No spinner before 400 ms; skeletons at the page's aspect
  ratio, then low resolution, then sharp; thumbnails fade in 120 ms (X-5).
- **Success.** Spinner → check by icon replace, the check pops, the ring blooms, the Library's
  light pulses, a toast names the result ("Saved · verified"). Redaction, deletion and other
  destructive work get the neutral check and words only.
- **Error.** No light, shake or red wash: a cross or triangle glyph and a sentence saying what
  happened and what to do, next to the cause or as a toast that stays until dismissed. Focus is
  not stolen; only blocking errors are announced assertively. Honesty notices keep their hairline.

---

## 9. Accessibility

### 9.1 The non-negotiables

| Id | How the language satisfies it |
|---|---|
| A-1 | Every text token is tested on the rendered worst case of every surface: §1.7, §2.2, §2.6; primary ≥ 7:1 on resting surfaces (lowest: 7.38 on lit glass over the field peak) |
| A-2 | Coverage rule c ≥ 0.985 per surface (§2.9) in `tokens.test.ts`; Tinted as the fallback |
| A-3 | Armed fills against their bars: lime 7.79–9.99, ink 11.18–14.65; control borders `--control-border` (X7); selected icons also change shape (fill) |
| A-4 | APCA primary ≥ 75 is a gate (lowest 75, light M1); secondary ≥ 60 a warning (dark glass 54–61) |
| A-5 | No text on bare light above Y 0.026; text over light sits on glass or a plate (§3.2) |
| A-6 | The field renders below the page layer, never within 64 px of a page; a pixel test compares page corners, and Library thumbnails, with light on and off; the armed-tool under-light, clipped to the palette, is the one exception (ADR-0028 §2.5) |
| A-7 | Ambient light setting; drift only on the empty Library and About; event motion settles ≤ 5 s; pauses during ink, drag, pinch and when hidden |
| A-8 | No periodic modulation; swing < 0.10 per 341 × 256 px region; nothing near 0.2 Hz; no red flashes |
| A-9 | Reduced motion per token (§7.5) from one module; animation sweep test |
| A-10 | Token limits read on the 99 % settle time (§7.1); View Transitions 240 ms; none for repeated actions |
| A-11 | Two-band ring, lime and ink, 16.42:1 between bands (≥ 9:1); worst best-band 4.07:1 (≥ 3:1, §9.2); research 22's L ≥ 0.85 clause is dropped (lime is 0.816; ADR-0028 §2.5) |
| A-12 | The free-rectangle layout rule (§2.10); `scroll-padding` equal to chrome insets; chrome auto-hides only on compact in viewing (§7.3 hide on scroll), never while focus is inside it or the keyboard is in use |
| A-13 | Exiting surfaces are `inert` from their first exit frame; no focus on invisible elements; every floating surface in the F6 cycle |
| A-14 | Light, rims, lens maps and filter layers are `aria-hidden` and pointer-transparent; announcements at the state change |
| A-15 | Density by input (§6.2): 24 px or spaced on fine pointers, 44 px on coarse |
| A-16 | Forced colours (§9.3) |
| A-17 | Glass Clear · Tinted · Solid; OS reduced transparency forces Solid and the picker says so |
| A-18 | `prefers-contrast: more`: Solid, strong border, no shadow, no light, tertiary lifted to n10, focus outline 3 px |
| A-19 | Four roles; lime never on the page or as a lone state; status glyphs always (§1.8) |
| A-20 | CSS-px size classes; at 320 × 256 the short-viewport layout (top bar folded into the dock, `flows.md` §6.1); floating chrome ≤ 25 % (§2.9); surfaces anchor to the viewport |
| A-21 | Turkish rules (§4.4) |
| A-22 | Solid twin for every effect; the a11y suite runs again in a "plain" project |
| A-23 | Light frozen during scroll and ink; automatic degrade (§2.8); budgets measured before shipping |
| A-24 | Tooltips dismissible, hoverable, persistent; action toasts ≥ 10 s and paused on hover or focus |

### 9.2 The focus ring

```css
:focus-visible {
  outline: 2px solid var(--focus-light);            /* lime #c8fb3d */
  outline-offset: 2px;
  box-shadow: 0 0 0 6px var(--focus-dark), var(--shadow-own, 0 0 #0000);   /* #08090c */
}
/* inside a capsule or a scroller: concentric, dark band inside */
.capsule :focus-visible { outline-offset: -2px;
  box-shadow: inset 0 0 0 4px var(--focus-dark), var(--shadow-own, 0 0 #0000); }
```

From the element outward: 2 px ink, 2 px lime, 2 px ink. Lime and ink differ by 16.42:1, so one
band clears 3:1 on any solid colour (C40). Over 20 backdrops the weakest were the select blue
(4.07), red ink (4.12), blue ink (4.39), the aurora at I 0.25 (4.40) and mid-grey (5.04); every
glass composite, the page, both highlighter tints, both canvases and both fills gave 5.44 or more.
The ring appears with focus, never animates and serves both themes; `--shadow-own` keeps a
surface's own shadow. DESIGN §5's per-context offsets carry over.

### 9.3 Forced colours and zoom

- Forced colours: every tier `Canvas` with `backdrop-filter: none` set explicitly (Chromium keeps
  filter and tint alpha otherwise, 22 §6.2); light `display: none`; armed and selected states in
  `Highlight` / `HighlightText`; rims and shadows drop; the ring keeps its system outline.
- Zoom: breakpoints in CSS px, so 400 % zoom reaches the compact layout; no chrome overflow at
  320 × 256; floating surfaces anchor to the viewport, so zooming the page never carries them off.

---

## 10. Implementation plan for the tokens

### 10.1 `tokens.css` structure

One file that the app and the test import, in numbered sections:

| § | Block | Contents |
|---|---|---|
| 1 | `:root, [data-theme='dark']` | `color-scheme`; `--n1…--n12`; semantic surfaces (`--canvas`, `--surface-frame`, `--surface-raised`, `--surface-sunken`, `--surface-on`, `--surface-hover`, `--surface-active`, `--scrim`); borders; text (`--text-primary/secondary/tertiary/disabled`, `--glass-text-secondary`, `--glass-text-disabled`); interaction (§1.4 names); content (`--page-background`, `--page-shadow`, `--select*`); status and glass variants; `--tag-0…5`; atmosphere (`--aurora-*`, `--light-cap-under-glass`, `--light-home-rest`); materials (`--glass-{chip,bar,panel,menu,sheet,lit}-{alpha,tint,filter,solid,shadow}`, `--rim-*`); `--e0…--e5` |
| 2 | `[data-theme='light']` and `@media (prefers-color-scheme: light) { :root:not([data-theme]) }` | The same names, light values; the test keeps the two blocks identical |
| 3 | Theme-independent `:root` | Type (`--font-ui`, `--type-*`, `--track-*`), shape (`--radius-*`), space (`--space-*`), density (`--control-height`, `--bar-button`, `--bar-height`, `--hit-min`, `--icon-*`), motion (§7.2) |
| 4 | `@media (pointer: coarse), (any-pointer: coarse)` | Coarse type, density, σ caps |
| 5 | Settings | `[data-glass='tinted']` (alphas 0.90), `[data-glass='solid']` and `@media (prefers-reduced-transparency: reduce)` (identical), `[data-motion='reduced']` and `@media (prefers-reduced-motion: reduce)` (identical), `@media (prefers-contrast: more)`, `[data-light]` hooks |
| 6 | `@media (forced-colors: active)` | System colours, filters off |
| 7 | `@media (color-gamut: p3)` | P3 aurora stops for the CSS fallback |

New sibling files: `materials.css` (the `.mat-*` rules of §2.3, tier × σ literals, lens
hooks; today's `.glass`, `.glass-frame`, `.glass-menu` leave `global.css`), `motion.css`
(View Transition rules, reduced-motion rules), `fonts.css` (`@font-face` for `'Inter Recto'`).

### 10.2 `tokens.test.ts`

- Parse both themes and every settings block; media-query and attribute blocks stay identical.
- Tier model generalised to filter chains in order, including `contrast()`, with ±1/255 rounding.
- **Coverage term:** a registry of surfaces (tier, smallest width and height, σ) that component
  specs extend; assert erf(h / 2√2σ) · erf(w / 2√2σ) ≥ 0.985 for each, and that its σ step exists
  in `materials.css` with equal prefixed and unprefixed values.
- Worst backdrops per theme (§1.2); every pair in §1.7, §2.2 and §2.6 with its minimum; APCA
  primary ≥ 75 fails, secondary < 60 warns. M3 over the canvas equals `--surface-frame` ± 1/255.
- Lit glass over `#c8be34`, `--light-cap-under-glass` ≤ 0.6, and a source scan that `.mat-lit`
  never appears in stage or page modules. Focus bands ≥ 9:1, best band ≥ 3:1 over the listed
  backdrops; `--select` ≥ 3:1 on white and both highlighter tints.
- Retire the M6/M8 assertions the redesign replaces (the 1.27:1 bar-to-canvas floor, the single
  `--elevation-float`, the periwinkle minima); their intent moves to rims and the new minima.

Rendered checks (the model cannot see the software compositor, 22 §3.2):

- `e2e/glass-pixels.spec.ts`: each tier over a white page, over black (light theme) and over the
  field at its cap; full-viewport screenshots only (clipped ones skip backdrop filters); a 4 × 4
  median in a text-free spot within ±2/255 of the model; Chromium, WebKit, Firefox and one
  Chromium project without GPU compositing (A-1, A-2, A-3, A-5, A-6, A-11).
- `e2e/motion.spec.ts`: animation sweep under both reduce paths, no `::view-transition` during
  tool switching, zero frames at rest, zero layouts during pinch and bar morph, the flash
  sampler (A-7 to A-10, A-23).
- `e2e/a11y.spec.ts`: a "plain" project and the matrix {default, Solid, more contrast, forced
  colours} × {EN, TR} × {dark, light}.

### 10.3 Files and packages

| Add | Remove |
|---|---|
| `tools/fonts/subset.sh` (+ devDependency `inter-ui` 4.1.1); `apps/web/public/fonts/inter-recto-latin.woff2`, `-latin-ext.woff2` (committed outputs) | `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono` |
| `tools/icons/generate.ts`, `tools/icons/manifest.json`, `tools/icons/custom/*.svg` (+ devDependency `@phosphor-icons/core` 2.1.1); `apps/web/src/ui/icons.generated.tsx`, `ui/Icon.tsx` | `lucide-react`, once no import remains |
| `apps/web/src/motion/` (springs, core, view-transition helper, reduced); `apps/web/src/light/` (field, shader, gates, CSS fallback) | Per-file `matchMedia('(prefers-reduced-motion…)')` checks |
| `styles/materials.css`, `motion.css`, `fonts.css`; `index.html` font preload and `theme-color` per scheme (`#08090c` / `#e6e8eb`) | `.glass*` rules in `global.css` |
| `appearance-store.ts`: theme, glass, light, motion, haptics; a one-time migration of `glassPanels` and `reduceTransparency` | "Glass panels" and "Reduce transparency" switches |

### 10.4 Migration order

Each step ships on its own and keeps today's layout until the component specs replace it.

(1) **Fixes valid today:** `--select` on the page, the two-band ring, σ 8 on today's 44 px tool bar
(its rendered 3.61:1), the coverage term. (2) **Token skeleton** with aliases of the old names, both
themes parsed, settings blocks. (3) **Type.** (4) **Materials**, the Glass and Reduce motion
settings, the cost ladder. (5) **Motion** tokens (the module's core lands earlier, with the first sheets and toasts: spec
D0-12). (6) **Colour**, after its ADR.
(7) **Icons.** (8) **Light theme.** (9) **Ambient light**: field, lit glass, under-light, ring,
bloom. (10) **Refraction.** (11) **Clean-up** of aliases and old packages.

---

## 11. Decisions and open questions

### 11.1 ADRs to record

Each supersedes the DESIGN.md text it names; the numbers recorded follow the list.

1. **Recto Glass, the M9 design language.** Three layers, the eight principles of §0.1, and
   DESIGN §1's "Nothing glows" amended to "Only light glows: the aurora and the glass rims;
   controls never glow". Replaces DESIGN §3's one-elevation, one-curve and translucency rules.
   The brief asks for glass, light and motion everywhere; the principles keep M1–M8's intent (a
   page never outshone, nothing moving at rest) inside it.
2. **One lime for interaction and brand; a blue for selection on the page.** `#c8fb3d` for the
   accent, the focus ring's light band and the brand; `#4e61ed` on pages; graphite neutrals; tag 4
   lilac. Supersedes ADR-0021 §4. Lime holds 7.8–10:1 against every glass tier where periwinkle
   held 3.03, and one value (not a separate `#e2f73d`) keeps the highlighter distance and the
   brand identical everywhere.
3. **Materials: five densities and a coverage rule.** M1–M5 and lit glass as in §2.2, centre
   coverage ≥ 0.985, Glass Clear · Tinted · Solid, a separate cost ladder, Chromium-only
   refraction on fixed-size controls, the docked sidebar glass by default pending S2. Denser than
   research 16 so row states stay AA; coverage because the software compositor leaks short glass.
4. **Light: an in-house aurora that answers events.** WebGL 1 at 1/8 resolution, still by
   default, motion on events, drift only on the empty Library and About, the placement map of
   §3.2, Ambient light Auto · Still · Off. A still costs nothing and moving light re-filters the
   glass above it every frame (17 §4); the setting doubles as WCAG 2.2.2's pause.
5. **Motion: springs, platform routes, no library.** Seven springs, four eases, `linear()`
   curves, View Transitions ≤ 250 ms, an in-house core under 3 KB, reduced motion per token.
   Supersedes DESIGN §3's "no springs in the chrome". Compositor routes survived long tasks where
   main-thread springs lost 31 % of frames; the cap follows the measured input loss.
6. **Type and icons.** Self-hosted Inter 4.1 subset `'Inter Recto'` with optical sizes, §4.2's
   scale, sentence case, no italic or monospace files; Phosphor regular and fill built at compile
   time. Three packages out, two devDependencies in; 98 KB of fonts against 130 KB (plus 54 KB of
   JetBrains Mono) today, about 13 KB more icon paths.
7. **A light theme from day one.** Equal to dark, following the system, with a Theme setting;
   light glass floors the backdrop, the light field becomes pigment, under-light and lit glass
   stay dark-only. Makes DESIGN §3's "M9 item" part of M9's definition of done.
8. **Accessibility gates for an expressive UI.** A-1 to A-24 as CI gates: rendered-pixel tests in
   three engines plus a software-compositor project, APCA as a primary-text gate, the two-band
   ring, the "plain" project. The model and axe both pass a bar that fails on screen (22 §3).

Recorded as ADR-0022 to ADR-0028: 0022 the design language, with item 7 (the light theme)
folded in; 0023 colour roles (item 2); 0024 materials (3); 0025 light (4); 0026 motion (5); 0027
type and icons (6); 0028 accessibility gates (8). The decisions of `flows.md` §14 are recorded as
ADR-0029 to ADR-0032.

### 11.2 Open questions for the owner

1. **Machine checks only you can run.** On your machines (Chrome with a GPU, Safari): research 14's
   S2 frame-time check with M3 panels as glass over scrolling pages; research 22's one-minute
   edge-leak probe; whether `-webkit-backdrop-filter` accepts `var()` in your Safari; banding in
   the field; and ambient drift at 15 against 30 fps. "Docked panels are glass by default" and the
   drift frame rate are frozen only after these.
2. **Taste, on the concept prototype (wave 3).** Lime fills on the armed tool and the primary
   action (one per view), light at I 0.45 on the empty Library with a slow drift, and Phosphor's
   softer line in place of Lucide's. These follow the research; they are yours to accept by eye.

### 11.3 Issues for the lead

Raised while applying `flows.md` §13.2; each is decided here as stated, pending the lead.
**Resolved** by `docs/specs/redesign.md` §6.3 (L.1–L.6): items 1, 2, 4 and 6 stand; item 3 goes
the other way (X20: no lens on the capsule, lens on fixed-size M1 chips only, §2.7); item 5's note
is now in `flows.md` §14.

1. **Compact-height dock.** `flows.md` §6.1 and §6.9 give it 44 px with labels beside the icons;
   §13.2 item 10 lists the dock at 48 / 56 / 64. Kept at 44 (σ 8, c 0.994). With a 4 px inset its
   buttons are 36 px, so their hit areas take the full capsule height to reach 44 px (A-15).
2. **Contextual bars at 36 px.** `flows.md` §6.9 makes selection, annotation and Pages bars 36 px
   on fine pointers; §6.2 had 44. Allowed: σ 7, c 0.990, so M2's σ range becomes 7–10.
3. **The rest rule and the lens.** `flows.md` §6.2 lets a line sit under the dock at an arbitrary
   scroll stop, and §2.10 now says so. The dock's Chromium lens (§2.7) would then bend that line
   at rest. Kept for now; the alternative is a lens on fixed-size M1 chips only.
4. **Pill and chip sizes.** `flows.md` gives no height for the page pill or the facts chip;
   §2.9 assumes 36 px fine and 44 px coarse. The component specs confirm.
5. **ADR count in `flows.md` §14.** It says its numbers follow "the eight" of §11.1; with the
   light theme folded into 0022 there are seven, and its seven decisions take four numbers
   (0029–0032). `flows.md` needs a matching note; this task may not edit it.
6. **Two corrections from the re-run of §2.9:** the 40 × 40 chip's c is 0.991 (was 0.992) and
   the sheet's largest σ is 85 (was 79). No σ token changes.
