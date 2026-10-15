# Teaching sample v2: visual direction ("One night at Cape Ardıç")

Status: a direction for the owner and the lead. It does not replace MOB-11/12/13: the content,
lessons, copy fitting and editability rules stay as they are. v2 adds a layer on top: light,
grain, colour over time, and refined type. Every construct below was built in a sandbox copy of
the generator (`tools/fixtures/sample/`, built byte-identical to today's files first, then
changed). The copy was rendered with PDFium 153 (pypdfium2) and its bytes and render times were
measured. Nothing in the repo was edited.

  `01-cover-en.png`, `03-feature-en.png`, `07-invoice-en.png`, `04-contact-sheet-en.png`,
  `sequence-full-en.png`, `sequence-phone-en.png` and `before-after-cover-feature-invoice.png`.
- The prototype source is a unified diff against `tools/fixtures/sample/`:
  `node --experimental-strip-types tools/fixtures/drive.ts out en:full,…` runs it.


---

## 1. The idea in one paragraph

The issue is **one night at the cape, cut as a title sequence**. Each page is one frame of that
night, from **18:52** (the lamp comes on, the cover) to **06:41** (the blue hour, the flatplan,
"that is the whole issue"). The lighthouse beam is the motion. On the cover it leaves the lamp
and runs out by the spine, into the magazine. After that the light lives on three things:

- the fore-edge, as a **lamp tab** that steps down the edge page by page and cools from lemon to
  teal;
- the **lower third** at the foot of each page (the try slip, now a small night window with the
  lamp lit in it);
- the **photographs**, which are now night photographs whose only light sources are the lamp's.

The white pages stay white and solid (DSN-2: the page is the brightest thing on screen). Lime is
never paint on them. It is always light seen through a dark opening: the tab, the lower third or
a plate. That is how the lime is earned: Cape Ardıç's light characteristic is **Fl(3) G 10s**,
three green flashes every ten seconds. The cover prints it like a chart label. The lime is that
lamp.

Why this is not a template look:

- There is no gradient wash, no purple and no cream. The night is the brand's own cool graphite
  (hue 265).
- The colour shift runs through the brand's own aurora ramp (teal → mint → lime → lemon) used
  as **time**.
- The light behaves physically: it falls off with distance, it is additive, and the type is lit
  by it.

## 2. Light: the rules of this world

1. **One source.** Every light on every page comes from the lamp, or is the lamp seen through
   something (the lens, a window, a door slit, a film frame). There are no decorative glows.
2. **Light is additive.** Black means "no light". A glow is a screen, never a lime fill. Where the
   renderer makes screening expensive, the generator composites the light itself (§5.4).
3. **Light falls off.** The beam's intensity follows `1.15 · (1 − 0.66·t^0.8)` along its length
   and a sum of Gaussians across it. Halation is a radial with a tight core and a long tail.
4. **The type is lit too.** The masthead is filled with a radial centred on the lamp: the letters
   nearer the lamp are warmer and brighter (`#FFFFF4`), the far ones cooler (`#A7ADB6`).
5. **Colour is time.** The hour sets each frame's light colour, sampled from the ramp in §3.2.
   Its ground is sampled from the sky ramp.
6. **Grain lives in the dark**, as on film: on the cover, on the plates and on the film strip.
   The white paper of the content pages carries no grain. It would read as dirt, the owner's
   2026-10-04 complaint. Q-1 as amended by DSN-22 ("no texture that renders wrong, and no
   banding") is met because the grain masks the dark gradients' 8-bit steps, and it renders at
   about device resolution. It is painted over gradients the renderer has already quantized, so
   it does not dither them in the strict sense: a band-pass of the cover still finds one-level
   contour rings in the bloom and steps in the sky under the noise (critique B13). At 1× and 2×
   they are not visible; noise baked into a lattice's vertices would only make blotches, since
   Gouraud interpolation smooths between them.

## 3. Palette

### 3.1 Fixed values

| Token | Value | Use |
|---|---|---|
| Paper | `#FFFFFF` | content pages (unchanged) |
| INK / BODY / MUTED / RULE / PALE | `#17191E` / `#33373F` / `#6B7079` / `#D6D9DE` / `#F3F4F6` | unchanged (design §2) |
| LIME-800 | `#446713` | kicker, timecode in the running head, quote rule (on white) |
| Lamp lime | `#C8FB3D` | the lamp dot in the lower third; cover numerals and issue line |
| Sky top / mid / low | `#040507` / `#080A0E` / `#10151C` (axial, stops 0 / .55 / 1) | cover sky; grain lifts the top to about `#0B0C0E`, the old cover ground |
| Sea far → near | `#0A0D11` → `#030405` | cover sea |
| Sea lines | `#1C232C` → `#0B0D11`, 0.35 → 0.8 pt | perspective, brighter near the horizon (Fresnel) |
| Dusk | aurora teal `#1F9996` at 26 % → 11 % → 3 % → 0 | the last of the day, low on the west horizon |
| Beam ramp (along) | `#FBFFE0` 0 · `#EDFA6D` .05 · `#CBFF5F` .30 · `#69EAA3` .75 · `#69EAA3` 1 | the mark's own gradient, laid along the light's path |
| Lower third | `#15171C`, text `#F4F5F7` (16:1), label lime (14:1) | try slip on white pages |
| Film base | `#17191E` + grain | contact sheet |
| Night grade (contact frames) | multiply `#666B78` | turns the graphite frames into low-key night photographs |

### 3.2 The night ramps (frame colour by hour)

`f` = minutes since 18:52 / 732 (07:04 lamp off).

| Ramp | Stops |
|---|---|
| Light (tab, plate, edge print) | `#EDFA6D` 0 → `#C8FB3D` .30 → `#69EAA3` .72 → `#1F9996` 1 |
| Ground (tab, sky of the hour) | `#151A21` 0 → `#08090C` .45 → `#18222A` 1 |

| Page | Hour | f | Light | Tab centre y |
|---|---|---|---|---|
| Cover | 18:52 | 0 | lemon | 772 |
| Editor's letter | 19:40 | .07 | lemon-lime | 729 |
| Feature | 21:15 | .20 | lime-lemon | 643 |
| Contact sheet | 23:30 | .38 | lime | 521 |
| Agreement | 01:10 | .52 | lime-mint | 431 |
| Scan | 03:20 | .69 | mint | 314 |
| Invoice | 05:05 | .84 | mint-teal | 219 |
| Flatplan (both) | 06:41 | .97 | teal | 133 |

The hour belongs to the **page id**, not to the page number. A page therefore draws the same in
both cuts, and the phone's six frames still read dusk → dawn.

## 4. Grain recipe (verified)

- **Tile:** 96 × 96 px, 2 bits a pixel, DeviceGray. Its levels are a binomial(3, ½) bell, a soft
  grain and not white noise. Seeded `seededRandom('recto-sample-grain')`. `/Decode [0.125 0.875]`,
  `/Interpolate true`.
- **Bytes:** 2,184 B (pako Flate). It is **one object per file**, shared by every page through
  one Pattern.
- **Pattern:** a coloured tiling pattern, `PatternType 1 PaintType 1 TilingType 1`,
  `BBox [0 0 1 1]`, `XStep 1 YStep 1`, `Matrix [36 0 0 36 0 0]`, content `/G Do`. That gives
  96 px per 36 pt, 2.67 px/pt, about 192 dpi: device resolution at 1440 × 900 at fit width on a
  2× display. It never scales past about 1.3× until zoom passes 200 %.
- **Blend: Normal, `ca` = 0.057** (0.26 × 0.22). Measured: σ about 2 levels on the sky, which
  is enough to mask an 8-bit gradient's steps (see rule 6). The Overlay variant (mean-preserving, `BM /Overlay`
  `ca .26`) looks marginally richer but costs 2 to 4× the render time in PDFium (§5.4). The
  Normal grain lifts black by about 7 levels, so the grounds are set that much darker (`#040507`
  renders as `#0B0C0E`).
- **Per page intensity:**

  | Where | ca (Normal) |
  |---|---|
  | Cover, full page, under the type | .057 |
  | Lens plate, clipped to the plate | .07 |
  | Film strips, clipped to the strips | .053 |
  | White content pages | none |
  | Lower thirds, tabs | none (they are too small to band) |

- **Operators:** `q /Gr gs /Pattern cs /PGrain scn x y w h re f Q`, drawn **under** any text
  and always over a painted ground.

## 5. Light constructs (exact PDF), and what PDFium does with them

### 5.1 The beam: a Gouraud lattice (ShadingType 5)

This is the best construct in the set. One lattice-form mesh fans out from the lamp:

- **Columns** are angles across the beam: ±20, 15.5, 12, 9, 7, 5.5, 4.2, 3.2, 2.4, 1.7, 1.1,
  0.6, 0.25 and 0°.
- **Rows** are distances along it: 0, .015, .05, .12, .22, .36, .52, .70, .86 and 1.
- **Each vertex** gets
  `colour = ramp(t) · falloff(t) · Σ wᵢ·exp(−(θ/σᵢ)²) · (1−(θ/20)²)²`. The terms are
  (w, σ) = (1, .42°), (.62, 2.4°), (.30, 5.2°) and (.12, 10°). The window factor takes it to
  zero at the edge.
- **Encoding:** `BitsPerCoordinate 16`, `BitsPerComponent 8`, `VerticesPerRow 27`,
  `Decode [xmin xmax ymin ymax 0 1 0 1 0 1]`. That is 270 vertices × 7 B, Flate about 1.2 KB.

Gouraud interpolation is exact between samples, so the beam is smooth. Stacked wedges
(today's construct and my first try) step visibly.

### 5.2 Halation, bloom, streak

These use one radial shading each (Type 3, `Coords [0 0 0 0 0 1]`, a stitched Type 3 function
of Type 2 segments, `Extend [true false]`), placed by `cm`, under `/BM /Screen`:

| Construct | Radius | Stops |
|---|---|---|
| Halo | 46 | `#FFFFFF` 0 · `#F6FCC4` .07 · `#6E8A1E` .24 · `#16200A` .6 · black 1 |
| Bloom | 150 | `#2B3A0E` 0 · `#111906` .35 · black 1 |
| Anamorphic streak | 240 × 3.4 | `#E6FFF0` 0 · mint × .55 at .1 · mint × .12 at .45 · black 1; `cm` y-scale .014 |

The anamorphic streak is the cinema signature.

**Each one is clipped to its own box** (`x y w h re W n` before `sh`), for the reason in §5.4.

### 5.3 Other constructs

- **Lit type:** the masthead stays **real text**. Inter Bold comes from the file's own subset, so
  it adds 0 glyph bytes, and Find and the H1 tag keep "Margin". It is set in **render mode 7**
  (clip), then `/ShType sh`, a radial centred on the lamp with r = 640 and stops `#FFFFF4` 0 ·
  `#F6F8F0` .42 · `#E1E4E8` .62 · `#A7ADB6` 1.
  - An outlined Inter Display SemiBold is a finer cut. I prototyped it at +1 KB a file. It would
    need the face as a generator input, and the text would become a figure, so I do **not**
    recommend it.
- **Precomposited ground:** a 11 × 6 lattice over the dusk area paints the sky with the dusk
  already screened in. It replaces a screened radial over the sky.
- **Lamp tab (fore-edge):**
  - A 9 × 64 pt capsule (full radius) 3 pt inside the trim, x 583.28 to 592.28, filled with the
    hour's ground. It was first a bleed tab; in the app a dark pill at the page's edge read as a
    scroll thumb (critique B5, MOB-15), so it now stands inside the page as a lamp window. The
    owner may still choose a light-only tab.
  - Inside it, a 0.8 × 41 pt slit in the hour's light down its middle, plus a vertical screened
    glow of the same colour: the unit radial with `cm 4 0 0 38.4 …`, clipped to the capsule.
  - About 150 B of content a page, plus one shading.
  - An earlier three-dot version read as a "⋮ more" menu icon, so it was dropped.
- **Lower third:**
  - The slip ground `#15171C`, r 6.
  - The lamp dot is a 2.6 pt disc of lime mixed 35 % toward white, over a screened unit glow of
    r 15 (**one shared shading per file**).
  - Clipped to the slip's own rounded path.
- **Night grade** (contact frames): a `Multiply` rect over each frame, then the light sources put
  back with the same shared unit radial placed by `cm`.

### 5.4 Two PDFium findings that shape every recipe (measured)

1. **Blend modes composite against a transparent page, not paper white.** Screen of `#990000`
   over an unpainted area of a page renders `#990000`. It should render white
   on white paper; this happened to the lower third's glow before it was clipped.
   - **Rule:** every blended object lies wholly on a ground painted in the same page, and is
     clipped to it.
2. **Every blended object costs an offscreen group the size of its bounds.** An unclipped `sh` is
   bounded only by the page. The first cover rendered in **1,271 ms** at 2× (today's cover:
   28 ms). The fixes, measured:
   - clip each glow to its box: 1,271 → 371 ms;
   - Normal-alpha grain instead of Overlay: −150 ms;
   - composite the beam and the dusk on the sky in the generator and paint them Normal (the
     sky is a known function of y, `skyAt()`): −90 ms;
   - composite the lens plate's rings on the eye glow: page 3 went 195 → 42 ms.

   **Final render times, ms, PDFium native:**

   | Scale | Edition | p1 | p2 | p3 | p4 | p5 | p6 | p7 | p8 |
   |---|---|---|---|---|---|---|---|---|---|
   | 2× | today | 28 | 6 | 16 | 9 | 7 | 54 | 5 | 7 |
   | 2× | v2 | **120** | 8 | **42** | **35** | 7 | 42 | 8 | 9 |
   | 0.3× (thumbnails) | v2 | 7 | 2 | 4 | 6 | 1 | 17 | 1 | 1 |

   - **Rule:** blend modes only for small, clipped glows. Anything large is composited by the
     generator and painted Normal.
   - **Budget:** page 1 ≤ 3× today's own time, measured in the app's PDFium worker on a
     mid-range phone. The cover is at 4.3×, which is the remaining risk, with this fallback
     ladder:
     1. no grain on the sea half (−8 ms);
     2. bloom out (−15 ms);
     3. halo and streak composited into the beam mesh's first rows (−15 ms).

**Editability (checked in `blocks.ts` and `paragraph-input.ts`):**

- `wrapRight` boxes come only from **top-level filled or stroked path objects**. v2 adds none
  that holds a paragraph: the tab is outside the measure, the plate already existed, and the
  slip box is unchanged.
- `gapBelow` counts graphics that overlap a paragraph horizontally unless they contain its
  centre. The tab (x > 586) overlaps nothing.
- Grain and glows are never drawn over or around edit targets. No text is put inside a clip, a
  pattern or a form.
- The text layers diff only in additive furniture: the timecodes, the cover's slate and chart
  line, and the invoice's labels (`difflib` over all eight pages).
- The feature page's paragraphs, fitting and stretch assertions are untouched. The generator's
  `SAMPLE_FIT` assertions still pass, because the build ran without throwing.

## 6. Type system

**Faces stay the bundled three:** Inter Regular, Inter Bold and Noto Serif Regular (MOB-13).

- **No new embedded face.** Each one costs about 9.5 KB × 4 files, which is a quarter of the
  whole v2 budget.
- The cover's chart line ("Fl(3) G 10s 42 m 22 M") is set in the already embedded Noto Serif:
  chart labels are serif, and Inter's `l` reads as `I`.
- Optional, owner's taste: an outlined masthead in Inter Display (OFL, the same Inter project).
  It is +1 KB a file and loses real text, so it is not recommended (§5.3).

**Scale: √2 per two steps (the A-series ratio), from body 9.5.** The page (1:√2), the body
leading (9.5 × √2 = 13.43 ≈ the 13.5 grid) and the type scale are one ratio, which is BR-B4's
"1:√2" made literal. Steps are 9.5 · 2^(n/4):

| n | pt | Role | Today → v2 |
|---|---|---|---|
| −3 | 5.65 | edge print on film | 5.5 → 5.65 |
| −2 | 6.75 | labels, running head, slate | 6.5 → 6.75, Tc +12 % (0.81) |
| −1 | 8 | kicker, caption, footnote, folio | kicker 8 ✓; caption 7.5 → 8 (refit) |
| 0 | 9.5 | body (serif), UI, lower third | slip 9 → 9.5 (check two-line fit) |
| 1 | 11.3 | letter body, intro | 11 / 11.5 → 11.25 |
| 2 | 13.5 | deck | ✓ |
| 3 | 16 | pull quote, H2, invoice total, cover lines | 15 → 16 |
| 4 | 19 | printer's name | 18 → 19 (done in the frame) |
| 6 | 27 | cover numerals | 26 → 27 (done) |
| 7 | 32 | H1 | 34 → 32 keeps the 36 pt leading and never adds height to a fitted page |
| 14 | 107.5 | Kenar masthead floor | |
| 16 | 152 | masthead | 150 (capped to the measure for "Margin") |

**Tracking:**

- labels +12 %; kicker +12 %; issue line +12 %;
- masthead −3 % (it is a logo; render mode 7 allows Tc there);
- **0 on every edit target** (unchanged rule).

**Leading:** body 13.5, deck 19, quote 20, H1 36 (all unchanged, all ≤ 1.5 × size, MOB-13).

**Numerals:**

- Inter `tnum` throughout (DSN-6).
- **No old-style figures in Noto Serif body**, although they would be more literary. The editor
  types through the cmap, so a rewritten "1987" would come out lining next to old-style
  untouched lines. Rejected for honesty of edits.

**Kerning:** none in edit targets; the editor rewrites with font advances (as today). Display
lines that are not edit targets (masthead, cover lines) may take kerned TJ.

## 7. Grid, rhythm, shapes

- **Grid** unchanged: margins 56, two columns of 233.64 with a 16 pt gutter, baseline 13.5. v2
  is a light layer, not a relayout. The fitted copy and the TXT rules depend on the grid.
- **Rhythm:**
  - The running head carries the **slate**: section, a 9 pt gap, the hour in LIME-800, 6.75 pt.
  - The fore-edge tab steps down 660 pt over the night.
  - The lower third closes every page. Together they read as a broadcast frame: slate top
    right, lower third bottom, tab at the edge.
- **Shapes:**
  - Radii 4 (tab), 6 (slip, cards) and 10 (form card) follow Recto's radius ladder.
  - Hairlines step 0.35 / 0.5 / 0.75 / 1 pt.
  - The only "icons" are drawn things from the world:
    - the printer's **registration target** (Saltmarsh Press's mark);
    - the **step wedge**;
    - sprocket holes;
    - the lamp dot.
  - No characters as icons (charter rule 4).

## 8. Page by page (full cut; what changes vs today)

### 1. Cover, 18:52 "lamp on" (key frame)

Built: `01-cover-en.png`, `01-cover-tr.png`, `detail-cover-lamp-4x.png`.

- **Composition:**
  - The horizon is raised to 336, so the sea gives the cover lines room.
  - The lamp sits at (462, 393). The beam rises 4.8° to the left and leaves by the spine.
  - The masthead stays top-left: real text, lit.
  - "Fl(3) G 10s 42 m 22 M" sits top right in serif, the chart label.
  - The slate "18:52 / LAMP ON" (TR "FENER YANDI") is set beside the lamp on a 0.4 pt leader.
- **Scene, back to front:**
  1. Sky axial.
  2. The dusk lattice (teal, west).
  3. The beam mesh, clipped to the sky.
  4. 34 sea lines, bucketed.
  5. Horizon hairline, an axial brighter under the dusk.
  6. Two headland planes.
  7. A silhouette tower rim-lit by the dusk, with the lamp room.
  8. 58 glints, bucketed and screened: the lamp's glitter column, and the beam on the far
     water.
  9. Bloom, halo and streak.
  10. Grain.
  11. Type.
- **Links, tags, alt, outline** unchanged. Add the slate and chart line as artifacts.
- **TR:** the "Kenar" masthead is the same size, left-aligned, and does not stretch to the
  measure. More sky, which suits it.

### 2. Editor's letter, 19:40

- Running-head slate, the tab, the lower third.
- Proposal: the contents rows carry each page's hour, right-aligned in MUTED tnum (artifact) as
  a "schedule of the night". The rows stay links. This needs a check of the 30 pt pitch (R-14).

### 3. Feature, 21:15

Built: `03-feature-en.png`, `detail-lens-plate-4x.png`.

The lens plate becomes a night photograph. It is composited Normal except the halo and streak:

- dark glass barrel `#0B0D10`;
- the bull's-eye lit by the flame;
- 6 dioptric rings, then the prism rings, each lit by its radius;
- prism flashes at top and bottom: short arcs at 90° / 270°, span 30 → 12°, glint following
  sin(πt);
- the brass cage dark in front with a lit edge;
- halation and a short streak clipped to the plate;
- grain .07.

The text is untouched (H1 32 optional, see §6).

### 4. Contact sheet, 23:30

Built: `04-contact-sheet-en.png`.

- **Film base:**
  - grain .053;
  - **edge printing in the hour's light**: edge codes are exposed onto film by light, so lime
    is literally light here.
- **Frames** night-graded, with screened glows on frame 1 (the lens), 4 (the gas flame), 6 (the
  lamp, r .43w), 7 (the LED), 9 (the lamp and the beam on the water) and 11 (the door slit,
  vertical glow).
- **Production:** don't multiply. Draw the frames with a graded palette, `NIGHT_N3…N9` = N × the
  `#666B78` grade, which removes 12 offscreen groups (35 → about 12 ms).

### 5. Agreement, 01:10

- Slate, tab, lower third. Nothing near the fields.
- The PALE card stays: the form must read as a form, and nothing is blended under widgets.

### 6. Scan, 03:20

- **Bytes:** the raster becomes **2-bit Indexed** (`[/Indexed /DeviceGray 3 <3399EEFF>]`, the
  same four tones). Identical pixels, verified by a render diff: 25,643 → 20,138 B with pdf-lib's
  pako (17,739 B with zlib level 9).
- The tab is drawn as vectors; there is still no text layer.
- The routing label is the dark lower third.

### 7. Invoice, 05:05

Built: `07-invoice-en.png`.

- **Saltmarsh Press letterhead:**
  - a registration-target mark (one ink);
  - the name at 19 pt;
  - an "INVOICE" label over the number at 16 Bold;
  - a printer's double rule (1 + 0.35 pt).
- **Total** at 16 Bold under a 1 pt rule.
- A **control strip**: an 11-step wedge from paper to solid, a 0.35 pt frame and a registration
  target, labelled "Control strip · proof 2" (TR "Kontrol şeridi · prova 2"). It is the press
  world's own ornament, kept far from the bank details.
- Payment details are still label over value (the finder needs it). The new text ("05:05",
  "INVOICE", "2026-0412") matches no finder pattern (checked in `patterns.ts`).
- The copy lane should re-check `copy.invoice.number`, which is now split into a label and a
  number.

### 8. Flatplan, 06:41, the end card

Built: `08-flatplan-en.png`.

- The miniatures carry their own tabs, so **the whole night is visible in one view**: the tabs
  step down and cool across the eight tiles.
- The cover miniature reuses the cover's beam mesh object through `cm`, at 0 extra bytes for the
  shading.
- The miniature slips are dark, as on the real pages.
- Proposal: the closing line becomes "That is the whole issue." followed by a MUTED "Lamp off
  07:04."

### Phone flatplan (6 frames)

- The same frame logic at 06:41, with 6 tiles in a 3 × 2 grid carrying their tabs.
- The phone's sequence is 18:52 → 19:40 → 21:15 → 23:30 → 01:10 → 06:41: still dusk to dawn.

## 9. Owner questions (taste)

1. **Lower third dark (recommended) or pale** (`alt-03-feature-pale-slip.png`)?
2. "Fl(3) G" makes the lamp green in the story. Keep it, or "Fl(3) W" (white, and the lime then
   stays only the brand's)?
3. Hour stamps on the contents rows (§8 p2) and "Lamp off 07:04" on the flatplan: yes or no?

## 10. Bytes

Measured in the sandbox, the final prototype:

| File | Today | v2 | Δ | Cap |
|---|---|---|---|---|
| `recto-sample-en.pdf` | 95,092 | 101,595 | +6.5 KB | 125 KB ✓ |
| `recto-sample-tr.pdf` | 96,973 | 103,228 | +6.3 KB | 125 KB ✓ |
| `recto-sample-phone-en.pdf` | 59,436 | 70,144 | +10.7 KB | 90 KB ✓ |
| `recto-sample-phone-tr.pdf` | 59,933 | 70,628 | +10.7 KB | 90 KB ✓ |
| **All four** | 311,434 | **345,595** | **+34.2 KB** | 312 KiB ✗ |

Per construct, EN full (content streams are compressed, measured per page):

| Construct | Bytes | Shared? |
|---|---|---|
| Grain tile + pattern | 2,184 + ~90 | once per file |
| p1 cover content (scene, slate, chart line) | +1,071 | |
| p1 shadings (sky, sea, lattice 66 v, beam mesh 270 v, glows, type, tower, horizon) | ~1,900 in object streams | |
| p2 / p5 furniture (slate, tab, lower third) | +230 each | |
| p3 plate + furniture | +957 | |
| p4 film grade, glows, edge print | +492 | |
| p6 scan: 2-bit Indexed | **−5,505** | |
| p6 tab + label glow | +157 | |
| p7 letterhead, control strip, furniture | +629 | |
| p8 miniature tabs, beam reuse | +945 | |
| Lamp tab shading, one per page | ~70 each | |
| Lower-third glow shading, ExtGStates | ~150 | once per file |

**Proposal (a decisions row, sample lane):**

- Raise `SAMPLE_TOTAL_MAX_BYTES` from 312 KiB to **344 KiB** (352,256 B).
  - The precache grows by about 34 KB, 0.23 % of the 14.68 MB gate and well inside a wave's
    1 % (PRC-11).
  - The per-file caps are unchanged.
- The phone file is the real cost: +10.7 KB, 70 KB, still 22 % under its cap. That is about
  +55 ms on a 1.6 Mbps first open, which is precached after the first visit.
- **If 312 KiB must hold**, cut in this order:
  1. glints and sea lines halved (−0.5 KB × 4);
  2. no grain on the phone cut, only dither-free gradients there (−2.3 KB × 2);
  3. flatplan miniature tabs dropped (−0.9 KB × 4);
  4. the contact sheet back to 9 frames (−2 KB × 4, already MOB-13's fallback).

  That is about −17 KB, which still leaves about +17 KB, so 312 cannot hold the full direction.

## 11. Implementation checklist (sample lane)

**`tools/fixtures/sample/light.ts`** (new; the prototype is in the patch):

- `ramp(stops)`: a Type 3 stitched function of Type 2 segments, colours at 3 decimals.
- `grainTile(doc)` / `grainPattern(doc, cell = 36)`: one object per file, **via
  `doc.context.flateStream` (pako), never `node:zlib`**, so the bytes are deterministic across
  Node versions.
- `grain(w, amount, box)`: `q /Gr gs /Pattern cs /PGrain scn … re f Q`, Normal, `ca = 0.22 ×
  amount`.
- `gs(w, name, opts)`: ExtGStates deduplicated per file (WeakMap on the doc).
- `sharedShading(w, key, stops)`: a unit radial `Coords [0 0 0 0 0 1]`, once per file, placed by
  `cm`.
- `radialShading` / `axialShading`: always `context.register(...)`. An inline shading in a page
  dict stays outside object streams; this cost +6 KB in the first try.
- `glow(w, name, cx, cy, r, stops, {squash})`: **clipped to its box**, Screen.
- `beamMesh(w, name, lamp, axis, reach, {angles, rows, profile, along, falloff, backdrop})`:
  ShadingType 5, 16-bit coordinates, 8-bit colours. Painted Normal when `backdrop` is given (the
  generator screens the light onto it).
- `latticeShading(w, name, box, cols, rows, colorAt)`: a composited ground.
- `Strokes`: path bucketing by (colour, width), one `S` a bucket, one decimal a coordinate. This
  cut the cover's content from 7.1 to 3.0 KB.
- `circle1` / `arc1`: path strings at one decimal.
- `FRAME_TIME`, `nightOf(id)`, `lightAt(id)`, `groundAt(id)`, `lampTab(w, id)`.
- `shareCover(doc, …)` / `coverOf(doc)`: the cover's scene as one Form XObject (sky, dusk, sea,
  headland, tower, beam, glows; the grain stays on the page), its masthead fill and masthead
  text, for the flatplan's cover tile and the contact sheet's frame 9, painted by `cm` with no
  new bytes (MOB-15).

**`context.ts`:**

- `furniture()` draws the slate (the hour right-aligned in LIME-800, the section 9 pt before it)
  and `lampTab`.
- `trySlip()` becomes the dark lower third, with the glow **clipped to the slip's rounded path**.

**Pages:** cover (whole scene), feature (`lensPlate` v2, composited), contact (graded palette,
glows, film grain, edge print in light), invoice (letterhead, total, control strip), flatplan
(tabs, cover beam, dark slips), scan (`pack2` Indexed, `lampTab` after its own `Resources` are
set: `scanPage` replaces the resource dictionary).

**Asserts to add:**

1. Every blended op lies inside a clip whose box lies on a painted ground. This is a generator
   self-check: track the "painted" rects per page.
2. No path object added by v2 holds an edit-target paragraph's box (`wrapRight`).
3. The tab x is ≥ the measure + 40.
4. Page-1 render ≤ 3× today's in the app worker. Add a timing log to the sample spec, not a
   gate, at first.
5. The four-file cap (new value) and the two per-file caps.
6. Byte-identical rebuild.

**Tests:** `sample-fixture.test.ts` keeps "no BT on the scan page". The masthead is now
render-mode 7 text; tests that read page 1's text still find "Margin". The manifest changes only
in hashes and sizes.

**Docs:**

- A decisions row: SMP-x "Sample v2 light" covering the hours, the tab, the lower third, grain
  in the dark only, the cap of 344 KiB, and the two PDFium rules of §5.4.
- Amend design.md §2 (colours, slip), §4 page notes and §6 budget.

## 12. "Not just the PDF": the product moments (proposals only; those files belong to another session)

1. **Library sample card (desktop).** The card shows page 1 as its art: the night, the beam, the
   masthead. Draw it from the PDF's own thumbnail (PDFium at card size takes 7 ms), not a
   hand-drawn copy. A drawing goes stale, as `CompactLibrary.tsx`'s SVG of the old page 1 shows.
   - The card's hover state can "turn the lamp": a 600 ms cross-fade from the 18:52 thumbnail
     to the 06:41 one (page 8), on the `glide` spring.
   - It is still at rest. The still twin is just the cover.
2. **Phone Library (DSN-31).** Redraw `SamplePage` as the new cover. A simple vector of the dark
   ground, the beam as a single linear-gradient wedge and the masthead bar is enough at 64 to
   120 px.
3. **First open of the sample.** When page 1 first paints, the aurora's event pulse (DSN-5,
   "answers events") fires once in the lamp's lemon-lime: the app's light and the cover's lamp
   come on together, and settle in ≤ 5 s. Reduce motion and Ambient Off get no pulse.
4. **Pages grid / phone overview.** No app change is needed: the fore-edge tabs make the grid
   show the night as a frame sequence by themselves. This is the "flip-book" payoff and the
   reason the tab exists.
5. **Media.** `tools/media/family` should reshoot the signature clip on the new sample. The light
   table frame (Pages bar) is where the sequence reads best.

## 13. Risks

| Risk | Status | Mitigation |
|---|---|---|
| Render time of page 1 (4.3× today in native PDFium) | open | Measure in the WASM worker on a phone; fallback ladder §5.4 |
| Screened glow outside a painted ground draws dark | found, fixed | Clip to the ground; assert |
| Grain reading as dirt | avoided | Not on white paper; σ about 2 levels; Normal alpha |
| Dark lower third read as a redaction box on the invoice | low | Rounded, lit dot and text; redaction marks are square black without text; owner A/B |
| Total cap | open | New cap 344 KiB, or the cut order in §10 |
| Engine-level paragraph check not run in the sandbox | open | Run `analyzeParagraphs` on the built feature page (technical.md §4) before merge |
