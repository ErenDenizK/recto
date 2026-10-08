# Family 10: ink, colour and size

**Status:** accepted 2026-10-04 (the owner's review of the M9 plan) · **Supersedes:** the look
and behaviour of `03-markup` MK-7 (options tier and chip) and MK-8 (preset and style editor), and
`09-primitives` §10 (Slider) and §16 (Swatch). Their roles, strings, guard rules and stores stay.
· **Rests on:** `language.md` §1, §2.7, §7; `09-primitives` §2; `quality-bar.md`; research 15
(Apple Markup, Freeform, GoodNotes, Notability, Procreate) and 19 M-2; ADR-0021 (one ink palette)

The owner, 2026-10-04 (in translation): "Think extra about the colour and size picker for the
pen; in every version it has been inadequate. Every colour option and slider must be extremely
modern and Apple-like. Every UI element, menu and bar must be consistent."

## 0. Summary

- **Colour and size are never more than one press away.**
  - The armed pen's **ink strip** shows a colour well, six swatches and a width slider with a live
    preview.
  - From large (≥ 1200 px) the strip sits inline in the palette. Below that it is a second row of
    the same capsule.
  - There is no summary chip and no hidden tier.
- **One Slider for the whole app.**
  - The track is a pill: 6 px fine, 8 px coarse.
  - The knob is solid at rest. While held it turns into a clear lens that magnifies the track.
  - Detents are magnetic, the value bubble follows the knob, and the ends stretch elastically.
  - Every slider in Recto uses it: width, opacity, hue, grid size, image quality and the History
    scrubber.
- **The width slider shows the stroke.**
  - The track tapers from thin to thick.
  - The knob is a disc of the ink's colour, sized as the stroke will draw at the current zoom.
  - The scale is logarithmic, so 0.25–2 pt gets half the travel.
- **The colour panel follows Apple's three views: Grid, Spectrum and Sliders (H, S, B, hex).**
  - It adds an opacity slider on a checkerboard and a live stroke preview on paper.
  - It has an eyedropper that samples the page itself, recent colours and up to twelve saved
    colours.
- **Pen presets stay the model:** three pens and the Highlighter, each with its own colour, width
  and opacity. The strip edits the armed preset, or the selection when one exists, as today.

## 1. Reference: what works elsewhere

| App | Colour | Size | What we take |
|---|---|---|---|
| Apple Markup (iOS, iPadOS, macOS Preview) | Colour well with a conic ring → system picker: Grid · Spectrum · Sliders, opacity, eyedropper, saved swatches | Second tap on a tool: width presets and opacity | The well, the three views, the saved row, the second-tap rule (kept as the preset editor) |
| Freeform | Same picker | Five stroke bars | The stroke shown as itself, not a number |
| GoodNotes 6 | Three colours per tool always in the toolbar | Three widths per tool always in the toolbar | Options always visible while a tool is armed |
| Notability | Favourites row in the toolbar | Presets in the toolbar | Swatches one press away; recents |
| Procreate | Disc, Classic (plane + sliders), Value; history row | Vertical edge sliders with a live brush preview bubble | The preview that follows the knob; a plane with a round loupe |
| iOS 26 controls | — | Slider knob becomes a glass lens while held, track stretches past its ends | The lens knob and the elastic end |

## 2. Ink strip (replaces MK-7's tier and chip)

### 2.1 Anatomy

```
large and up, inline after the tools, behind a 1 px divider:
  … tools … │ ◉  ● ● ● ● ● ●  │  ╺━━━━━━━●━━━━━━━━━━╸  1.5 pt │

medium and expanded, a second row inside the same capsule (one glass element, one σ):
  ┌───────────────────────────────────────────────────────┐
  │ ◉  ● ● ● ● ● ●  │  ╺━━━━━━━●━━━━━━━━━━╸  1.5 pt          │  ink strip
  │ ↖  ✎ ✎ ✎ ▬  ⌫  T  ◻ ▾  ✍ ▾  +           │  Done          │  tools
  └───────────────────────────────────────────────────────┘
```

- **◉ Colour well.** A 24 px disc of the current colour inside a 2 px conic hue ring (fine; 28 /
  3 px coarse) in a 32 / 44 target. It opens the colour panel (§4). A custom colour shows in the
  disc. The ring is the only rainbow in Recto, and it marks "more colours".
- **Swatches, six.** For a pen: black, blue, red, green, purple, then the **last custom colour**,
  or orange while there is none. For the Highlighter: the four tints, the last custom tint, then
  a 50 % grey. For shapes: the pen six plus ⊘ (no fill) in the fill row of the panel. Swatches
  are 18 px dots (fine) or 22 px (coarse) in 32 / 44 targets (§5).
- **Width slider.** Tapered track (§3.3), 160 px fine, 200 px coarse. The readout is `tnum`,
  13 / 18 px, in locale numerals ("1.5 pt", "1,5 pt").
- **Opacity** is not in the strip. Pens are opaque by default. Opacity lives in the panel and
  the preset editor, and the strip's knob shows it.
- **Per tool.**
  - Highlighter: tints and width, 6–18 pt.
  - Eraser: the strip becomes [Whole stroke · Partial] and the size slider (6–48 px, detents 6 ·
    12 · 24 · 48).
  - Text box: colour and a font-size stepper.
  - Note: colour.
  - Shapes: stroke colour and width, with fill in the panel.
  - Tools without options (Select, Lasso, Image, Stamp, Sign, field kinds, Edit text, Redact) have
    no strip; the medium row collapses with *bar morph*.

### 2.2 Material and layout

- **Its own floating piece** (owner feedback F3, 2026-10, replacing the second row inside the
  palette's glass): a small glass piece of the capsule's material (M2, σ 9 / 10 / 8) and pill
  radius, one bar tall, centred 8 px above the capsule and hugging its content, so no glass
  stands empty beside the strip (`markup/StripPiece.tsx`). It is a sibling of the capsule, never
  inside it (Q-4), and counts with the capsule as Q-11's dock. It rises in (opacity and 6 px on
  `--spring-smooth`) when a tool with options arms and drops out when the strip goes; between
  tools it morphs its own width. Reduced motion: the fade alone, within 150 ms.
- **The capsule's maximum width** is the free rectangle less 32 px. When the inline strip does not
  fit, the second row is used; the fold is measured, never guessed (03.9).
- **No label text inside the strip.** Accessible names carry the meaning, and tooltips name each
  control after the delay.

### 2.3 Behaviour

- Arming a tool with options shows its strip, and the content cross-fades between tools. Select
  or disarm hides it.
- **A swatch press** sets the armed preset's colour. With a selection, it sets the selection's
  colour as one history step (`applyStyle`'s rule: the selection wins).
- **The slider** previews live: the next stroke preview and the selection's appearance follow
  the knob. It commits on release: one step, or one preset write.
- **During a stroke** the whole palette, strip included, fades to 20 % (MK-17).
- **Keyboard:** Tab from the tools enters the strip, the swatches form one radio stop, and `[`
  and `]` step the width by one detent while a pen is armed (key map v2).

## 3. Slider (replaces `09-primitives` §10)

### 3.1 Anatomy

```
rest        ╺━━━━━━━━━━●━━━━━━━━━━━━━━━╸        track 6 / 8, knob 22 / 28 (hit 32 / 44)
held        ╺━━━━━━━━━(◯)━━━━━━━━━━━━━━╸        knob 1.25×, clear lens over the track
                     ┌──────┐
                     │1.5 pt│                     value bubble 8 px above the knob
                     └──────┘
```

- **Track:** a pill. The fill runs from the start to the knob in `--control-range` (n12 dark, n2
  light, never lime: `language.md` §1.2). The rest is `--control-track`. A gradient track (hue,
  saturation, brightness, opacity, width taper) has no fill, because the track itself is the
  scale.
- **Knob:** a liquid-glass lens (owner feedback F3, 2026-10, replacing the white disc): clear
  glass over a CSS copy of the track magnified 1.28, a faint tint brighter at the top and the
  rim, a 1 px rim with a top highlight and an inner shadow, and a two-layer drop shadow; no
  backdrop filter (Q-5). It grows 1.15 under a hovering pointer and 1.25 held on the press
  spring, and clears further while held. A colour slider's knob shows the selected colour inside
  a 3 px ring of the glass; the width knob keeps its ink dot (§3.3).
- **Value bubble:** an M1 chip (`language.md` §2.1, σ 8) with the readout, shown while held. It
  always shows on coarse pointers, where the finger hides the knob, and on fine pointers when the
  slider has no readout beside it. It is clamped inside the viewport.
- **Detents:** optional 2 px ticks under the track, n8, which brighten when the knob passes.

### 3.2 States and feel

| State | What changes |
|---|---|
| Rest | Solid knob, shadow e1 |
| Hover (fine) | Knob shadow e2 |
| Held | Knob scales 1.25 on `--spring-snappy` and becomes the **lens**: background transparent, a 1 px white 0.7 rim, an inner light top 0.35, and inside it a copy of the track scaled 1.6× and offset to stay aligned (a CSS copy, no `backdrop-filter`; Q-5). The bubble rises (`--spring-quick`) |
| Detent | Within 4 px (fine) or 6 px (coarse) of a detent the value snaps. The knob ticks 1 → 1.06 → 1 (60 ms), and Android vibrates for 8 ms when haptics are on (FB13) |
| Past the end | The track stretches up to 6 px along the drag (`rubberBand`, motion core) and springs back on release (`--spring-bouncy`) |
| Track press | The knob springs to the point (`--spring-quick`); a drag can continue from there |
| Focus | Outset ring on the knob (two bands, D0-1) |
| Disabled | Track and knob n8; no lens |
| Reduced motion | Lens, stretch and tick are off; the value still snaps |

### 3.3 Scales

- **Linear** for opacity, saturation, brightness, hue and quality.
- **Logarithmic** for widths. `t = ln(w / min) / ln(max / min)`, so the pen range of 0.25–24 pt
  puts 0.25–2 pt in the first 45 % of the travel.
- **Detents** for the pen at 0.5, 1, 1.5, 2, 3, 5, 8 and 12 pt.
- **Stops** for a width with detents (the pen, the Highlighter, a shape's stroke; D4-4): the
  ends and the detents sit at equal shares of the travel, logarithmic within each span, so the
  ticks under the track are evenly spaced at the preset widths and 0.25–2 pt still keeps 4 of 9
  spans (44 %). Each tick sits on a whole pixel.
- **The width track tapers.** Its height grows from 2 px to 12 px (fine) or 3 px to 16 px
  (coarse) along its length, drawn as one SVG path in `--control-track`.
- **The width knob holds the preview.** It is the round white knob of every slider (22 / 28 px,
  e1 with a soft ambient shadow) with a dot of the ink's colour at the ink's opacity inside it,
  diameter `width × zoom × 96/72` px clamped to the knob's inside, 2–14 px (coarse 3–20), so a
  ring of white always frames it and the knob never changes size (D4-4: the stroke-sized knob
  with its "+" / "−" notch read as a notched, uneven thumb).

### 3.4 Accessibility

- `role="slider"` (Base UI `Slider`) with `aria-valuetext`: "1.5 points", "60 percent", "Hue 210
  degrees".
- Keys: arrows ± one step (a width moves to the next detent), Shift × 10, PageUp and PageDown × 10,
  Home and End.
- The bubble is `aria-hidden`; the value text carries the value.
- Targets meet A-15. The rendered knob ring is ≥ 3:1 against the track in both themes (A-3).

### 3.5 Implementation

- `ui/Slider.tsx` on Base UI `Slider`, with props `scale: 'linear' | 'log'`, `detents`, `track:
  'fill' | 'gradient' | 'taper'`, `gradient` (CSS), `knobColor`, `bubble: 'auto' | 'always' |
  'never'` and `format`.
- `ui/slider-math.ts` (pure) holds the log mapping, detent snapping, the rubber band and the
  knob-diameter clamp.
- It deletes `ui/Range.tsx`.
- **Tests:**
  - unit: the mapping round-trips within 0.01 pt, snapping, locale value text;
  - browser mode: one commit per drag, keys, the bubble is clamped at the viewport edge, a
    reduced-motion run has no lens;
  - rendered pixels: knob ring contrast in both themes.

## 4. Colour panel (replaces MK-8's colour rows and every native colour input)

### 4.1 Anatomy

M4 popover, 320 px fine, 360 coarse, anchored to the well and opening away from the palette. It
uses the `ui/Popover` primitive, the same as every popover (Q-9).

```
╭───────────────────────────────────────────╮
│ ⊙                 Colour              ✕   │  ⊙ eyedropper
│ [   Grid   |  Spectrum  |  Sliders   ]    │  Segmented (09 §6)
│ ┌───────────────────────────────────────┐ │
│ │                                       │ │  view area 288 × 192 (coarse 328 × 220)
│ │          (the chosen view)            │ │
│ └───────────────────────────────────────┘ │
│ Opacity ╺▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒●╸   100 %    │  checkerboard gradient track
│ ┌───────────────────────────────────────┐ │
│ │  ～～～～～～～  (stroke on paper)         │ │  live preview, 56 px, paper white
│ └───────────────────────────────────────┘ │
│ ● ● ● ● ● ● ● ● ● ● ● ●  [+]              │  saved (≤ 12) + add current
│ Recent  ● ● ● ● ● ●                       │  last 6 custom colours used
╰───────────────────────────────────────────╯
```

- **Grid.** 12 hue columns × 9 rows of lightness and saturation, with a top row of 12 greys (white
  to black): Apple's grid layout, computed in OKLCH and clamped to sRGB.
  - The cells are a CSS grid of rounded squares with 1 px gaps; the outer corners take the
    panel's inner radius.
  - The selected cell shows a 2 px white ring with a 1 px dark ring inside it.
- **Spectrum.** A plane of hue across and lightness down at full chroma (Apple's spectrum),
  with a 28 px round loupe that shows the colour under it.
  - The plane is drawn with three stacked CSS gradients: no canvas, no image (Q-12).
- **Sliders.** Hue, Saturation and Brightness, each a gradient-track `Slider` whose gradient
  updates live, then a hex field (`#1A1A1A`; it accepts 3 or 6 digits, with or without `#`, and
  ignores case).
- **Eyedropper.** It turns the cursor (or the finger's offset point on touch) into a 96 px loupe
  over the page, showing 11 × 11 page pixels at 8× with the centre pixel ringed. A press picks the
  colour, and Esc cancels.
  - It samples the rendered page bitmap, not the screen, so the result matches the PDF's
    colours on every browser. The system `EyeDropper` is never used, so the behaviour is the same
    everywhere.
- **Opacity.** Hidden for the Highlighter, which is always opaque with Multiply (ADR-0021), and
  for text box text.
- **Preview.** One S-curve stroke drawn with the actual ink pipeline (`ink-preview.ts`) at the
  preset's width and opacity, on paper white at 100 % zoom. For the Highlighter it is drawn over
  a line of grey text, so Multiply is visible.
- **Saved.** Up to twelve per device in `pdf-editor:ui:saved-colours:v1`.
  - [+] adds the current colour; a long press or right click on a saved colour offers Remove.
  - They are shared by every tool.
- **Recent.** The last six custom colours used, per device; they also feed the strip's sixth
  swatch.
- **Shapes.** A "Stroke · Fill" segmented control above the views picks which colour the panel
  edits. Fill offers ⊘ (no fill) as the first saved swatch.

### 4.2 Behaviour

- Changes apply live: the preset or the selection previews, and closing the panel or a pause of
  600 ms commits one history step for a selection. Esc reverts to the colour from when the panel
  opened, and closes.
- The last view (Grid, Spectrum or Sliders) is remembered per device.
- Light theme: the panel is light glass (M4 light), with the preview on paper white in both
  themes.
- Colours stay sRGB `#RRGGBB` (the PDF stores DeviceRGB). OKLCH is only how the grid is
  computed.

### 4.3 Accessibility

- Every view has a full keyboard path:
  - Grid is a `radiogroup` with 2-D arrows and Home and End per row.
  - Spectrum's loupe is a 2-D slider with two named axes ("Hue", "Lightness"): arrows move it 1
    unit, Shift 10.
  - The Sliders view is three sliders and a text field.
- Each colour announces a **name** from a nearest-name table of 30 entries in EN and TR ("dark
  blue" / "koyu mavi"), plus the hex on request. Colour is never the only cue.
- The eyedropper is reachable by keyboard: arrows move the loupe over the page, Enter picks.
- The panel is a non-modal dialog labelled "Colour" ("Renk"). Focus returns to the well.

### 4.4 Implementation

- New files under `ui/colour/`:
  - `ColourWell.tsx`, `ColourPanel.tsx`, `ColourGrid.tsx`, `ColourSpectrum.tsx`,
    `ColourSliders.tsx`;
  - `Eyedropper.tsx` (the page loupe; it reads the viewer's page canvas through
    `viewer/page-pixels.ts`);
  - `colour-math.ts` (sRGB ⇄ HSB ⇄ OKLCH, hex parsing, the grid table, the nearest name);
  - `saved-colours.ts`.
- **Replaces** the native `<input type="color">` instances (five today) and the custom-colour row
  of `StyleControls.tsx`.
- **Tests:**
  - unit: conversions round-trip, hex parsing, the grid is the same on every engine, names in EN
    and TR;
  - browser mode: Esc reverts, live preview, saved colours persist and cap at 12, keyboard paths
    in all three views;
  - e2e: eyedropper picks a known page colour within ±1/255.

## 5. Swatch (replaces `09-primitives` §16)

- **Dot:** 18 px fine, 22 px coarse, in a 32 / 44 target. Content colour with a 1 px inner ring
  (white 0.55 in dark, ink 0.55 in light) so black reads on dark glass and white on light glass.
- **Selected:** the dot shrinks to 14 / 18 px inside a 2 px ring in the primary text colour (n12),
  with a 2 px gap: the armed pen's ring in the palette's pen well, so the tool row and the strip
  mark a chosen colour alike, never lime. (Owner feedback F3, 2026-10: a ring of the colour itself
  left black on dark glass as an empty grey circle beside the colour well.)
  `prefers-contrast: more` adds an outer ring.
- **Hover:** the dot grows 1.08 (`--spring-snappy`); press 0.94.
- **⊘ No fill:** a white dot with a red diagonal, named "No fill" / "Dolgu yok".
- **Accessibility:** a `radio` named by colour inside a `radiogroup`. The selected ring passes
  3:1 against the glass behind it in both themes (A-3).
- **Implementation:** `ui/Swatch.tsx` and `ui/SwatchGroup.tsx`.

## 6. Preset editor (MK-8, kept, rebuilt from these parts)

A second press on an armed pen opens the preset editor: the same M4 popover as the colour panel,
with the title "Edit black pen". From top to bottom it holds:

- the six swatches and the well (the well opens the colour views in place, with a back chevron);
- the width slider;
- the opacity slider;
- the stroke preview;
- Draw with finger (coarse only);
- Reset to default.

It is the same component as the colour panel, so the pen has one editor, not two.

## 7. Consistency rules this family sets for the app (Q-9)

- **One slider and one swatch everywhere.** That covers zoom in the page pill menu, grid size,
  image quality, the History scrubber on coarse pointers, the stamp and field colours, and
  Settings.
- **One popover** (`ui/Popover`): the same M4 material, radius 16, 12 px padding, title row of
  44 px with ✕, and the same entry motion (*popup* from the anchor).
- **Control heights** are only 32 (fine) and 44 (coarse) inside bars of 44 and 56. Icons are 20
  px in controls and 16 px in menus. Readouts are 13 px `tnum` (fine) or 15 px (coarse).
- **No native colour or range inputs** remain (the copy-check list gains `type="color"` and
  `type="range"` outside `ui/`).

## 8. Work packages

| Id | Scope | Drop |
|---|---|---|
| D0-3a | `ui/Slider` (§3), `ui/Swatch` (§5), `slider-math.ts`; ports every range and swatch row on today's shell | D0 (inside D0-3) |
| D0-3b | `ui/colour/` (§4) with the eyedropper; replaces the native colour inputs on today's shell | D0 (inside D0-3) |
| D2-3 | The ink strip (§2) in the palette; the preset editor (§6) | D2 |
