---
title: "Research: aurora and light, a living lime glow that stays cheap and calm"
date: 2026-10-04
status: snapshot
---

> Research snapshot gathered on 2026-10-04 for the M9 redesign. Apple's guidance was read from
> the JSON data behind the Human Interface Guidelines (`developer.apple.com/tutorials/data/…`:
> materials, motion, color, dark-mode, accessibility, loading, branding, app-icons). Browser
> support comes from the `@mdn/browser-compat-data` 8.1.4 npm package. Four open-source
> implementations were cloned and read: `paper-design/shaders` (0.0.81), `jordienr/whatamesh`
> (a copy of Stripe's gradient code), `DavidHDev/react-bits` (its Aurora component) and
> `jacobamobin/AppleIntelligenceGlowEffect`. Two GitHub threads were read through the fetch
> tool. The spikes (§4) are two pages built for this document and run in headless Chromium 141
> on the shared 4-core container with SwiftShader, so every frame-time number is a trend, not a
> verdict. Colour, gamut and contrast values were computed with Ottosson's OKLab matrices and the
> glass compositing model of `apps/web/src/styles/tokens.test.ts`. blog.frost.kiwi, vanta.supply,
> superdesign.dev and ui-skills.com were blocked by the egress proxy, and the session's shared
> web-search budget ran out before queries on Chrome's Energy Saver, iOS Low Power Mode and the
> Arc, Linear, Vercel and Spline sites. Claims about those rest on search abstracts or
> established knowledge and are marked. Research 18 (motion), 20 (type, icons, colour), 21
> (brand) and 22 (accessible expressive UI) were written in parallel; where they touch light,
> this document aligns with them and says so. No file other than this one was changed.

# Aurora and light

## 0. Verdict

- **Build it as one small WebGL fragment shader: Recto's own code, about 3 KB gzip, no library.**
  It renders at **one eighth of the CSS size** (180 × 113 px for a 1440 × 900 window, whatever
  the DPR). The browser scales it up. Measured here, the full-resolution version costs 8× more
  per frame at DPR 1 and 29× more at DPR 2, and looks the same (§4, §5).
- **Still is the default; motion is an event.** A still aurora costs nothing: 4.4 % CPU against
  4.4 % for no aurora at all, with glass on top or not. Any moving full-screen layer costs a
  full composite on every frame, and glass over a moving backdrop costs 2.5× more again
  (152 against 62 CPU-ms per frame in the container). So the light moves when something happens:
  the app opens, a file is dragged in, a job runs, a job succeeds. Then it settles within 5 s
  (WCAG 2.2.2, research 18 §6.5). Continuous drift is an opt-in setting, capped at 15 fps.
- **"A few points" means three places in the app and one outside it.** (1) The Home and empty
  views: a dark field with one or two hot lobes. (2) Light beneath glass: under the floating tool
  bar, and in the drop overlay. (3) A light ring around running jobs, plus one success bloom.
  (4) Outside the app: the About hero and the brand stills. **Never** on or near the PDF page,
  in Arrange or Compare, behind text without glass or a scrim, or for errors and redaction (§8).
- **This answers research 13's "glass over a flat canvas is invisible".** Glass picks up the
  light only where light sits behind it. Tier 1 over a lime field at 35 % intensity moves ΔE_OK
  0.089 from its look over the canvas, four times a just-noticeable step. Primary text stays
  at 9.7:1 and secondary at 6.5:1. The `brightness()` cap means no aurora pixel can be a worse
  backdrop than a white page, so the contrast tests still hold by construction (§7).
- **Light goes beneath the glass, never inside it.** A lime layer painted *inside* the tool
  bar at only 8 % opacity, over a white page, drops secondary text to 4.07:1. The same light
  *beneath* the bar at 50 % keeps it at 5.15:1. The bar's filter clamps the light before the
  tint goes on (§7.2).
- **Colour follows intensity: teal → mint → lime → lemon.** Dim yellow-green reads as olive
  (`#415310` at L 0.41). So the dim body of the field is teal and mint, lime only appears
  where the light is strong, and lemon only in the hottest cores. On Home, light brighter than
  L 0.65 covers under 1.5 % of the window, and the mean luminance stays under 0.03. The page
  white is 1.0, so the document stays the brightest thing on screen (§6).
- **Fallbacks are free.** No WebGL, a lost context, `forced-colors` or `prefers-contrast: more`:
  a static four-gradient CSS approximation, or nothing. Reduced motion gives a still frame.
  Pressure, battery or a slow device also step the light down to still (§10).

---

## 1. What the owner asked for, and what it runs into

The owner asked for "a yellow-green, lime-coloured, moving, vivid aurora light at a few points",
glass everywhere, and motion "like butter". Three existing constraints meet that brief:

1. **DESIGN.md §1: "Nothing glows."** The document is meant to be the only bright thing on
   screen. Section 13 proposes the amendment. Light is allowed in named places, under numeric
   caps that keep the page brightest.
2. **Research 13 §0: glass over the uniform `--surface-0` canvas composites to one flat colour.**
   The aurora is the first thing Recto would have that is both behind the glass and not a page.
3. **Apple's guidance.** "Add motion purposefully… Gratuitous or excessive animation can
   distract people", and "avoid adding motion to UI interactions that occur frequently" (HIG
   Motion). "Avoid showing objects that oscillate in a sustained way… a frequency of around
   0.2 Hz" (HIG Motion, visionOS). "Avoid displaying a bright object on a very dark or black
   background, especially if the object flashes or moves" (HIG Color, visionOS). And from HIG
   Branding: "To express your brand through color, consider moving it into the content layer,
   where it scrolls beneath Liquid Glass controls and gets picked up dynamically." That last
   line is the model this document follows. Brand colour lives in a light layer *beneath* the
   glass. It never sits on the glass, and never on the document.

Research 21 independently chose "a ribbon of light shifting behind a pane of glass" (its
direction 04, "Pane") as the brand's motion motif. The aurora here is that motif, built to run.

---

## 2. Precedents: what others ship and how they keep it cheap

| Product or code | Technique | Cost controls found in the source | Licence for Recto |
|---|---|---|---|
| Stripe's hero gradient (read in `whatamesh/lib/Gradient.js`, a copy of Stripe's code) | WebGL "minigl". **Colour is computed per vertex** on a coarse mesh (density 0.06 × 0.16 segments per px), so the fragment shader only interpolates. Simplex noise with layered "wave" colours | Skips every frame whose timestamp is even (`parseInt(e) % 2 == 0`), which is roughly 30 fps. Pauses **while the page scrolls** and resumes 200 ms after. Clamps `dt` to 1000/15 ms. Pauses when hidden | None (Stripe's code). Ideas only |
| Paper Shaders (`@paper-design/shaders` 0.0.81, Apache-2.0; mount and mesh-gradient source read) | WebGL2 fragment shaders, mesh gradient = inverse-distance colour spots with warp and grain | Pauses on `visibilitychange`, and since PR #268 also off-screen through an IntersectionObserver. Speed 0 stops the rAF loop. **Defaults go the other way from what Recto needs: `minPixelRatio = 2` (renders at least 2× even on 1× screens) and `maxPixelCount = 1920 × 1080 × 4`.** Issue #188 reported a mesh gradient "depletes my laptop battery faster than it should" | Compatible, but 880 KB unpacked, and its defaults would have to be inverted |
| React Bits "Aurora" (read) | OGL, simplex noise, a three-stop ramp along x, an alpha curtain | None: full resolution, `antialias: true`, 60 fps forever, no visibility pause, rebuilds colour uniforms every frame | **MIT + Commons Clause: incompatible with ADR-0001** |
| Apple Intelligence edge glow (recreation read in `AppleIntelligenceGlowEffect/IOS.swift`; Apple publishes no spec) | Four strokes of one angular gradient: widths 6, 9, 11 and 15 pt, blurred 0, 4, 12 and 15. Stops are re-randomised every 0.5 s and animated with a 1.0 s ease-in-out | The README reports 40–60 % CPU on iPhone 12+ and 20–30 % in its low-power variant (author's claim). Abstracts say the real glow rotates about once every 1.8 s and has no published palette | Swift, not reusable; the layering is the lesson |
| "Aurora UI" (Michal Malewicz, March 2021; uxdesign.cc, abstract) | Blurred oval blobs of similar hues over near-black, usually paired with glass | Static in most uses. The abstracts' rule: "keep it to three or four hues", "never put text on the raw gradient" (superdesign.dev, abstract; the page was blocked) | — |
| Raycast, Linear, Vercel, Arc (established knowledge; their sites were not reachable) | Heroes use one large gradient or glow, then "the rest of the page returns to the austere dark surface" (Raycast, refero abstract). Arc's colour comes from user themes behind macOS vibrancy | Light only at the top of a marketing page; the product UI stays neutral | — |

Two lessons carry over. The products people admire put the light in one or two places and
keep the working surface neutral. And every implementation that drained batteries rendered at
full resolution or higher, forever.

---

## 3. Techniques compared

| Technique | Look | Cost profile | Behind `backdrop-filter` glass | Support | Verdict |
|---|---|---|---|---|---|
| **CSS gradients animated through `@property`** | Soft blobs; no curtains or warping | Registered custom properties do not animate on the compositor. Every frame restyles and **repaints at full resolution** (bram.us, abstract). Measured: 515–530 CPU-ms per frame, the worst here | Sampled | Chrome 85, Safari 16.4, Firefox 128 | Only for tiny elements. Not for a field |
| **CSS blobs: radial-gradient layers moved by `transform`** | Blobs, but cannot warp | Compositor-only. Four layers of 70 × 70 vw/vh are about 10 MB of GPU memory at DPR 1 (40 MB at DPR 2) plus fourfold overdraw. Measured 68–69 ms per frame. **With `filter: blur(48px)`: 285–291 ms** | Sampled | Everywhere | Fallback only |
| **Canvas 2D** at 1/8 size | Blobs; the 2D context cannot warp affordably, and `ctx.filter` is behind a flag in Safari 18 | 61–65 ms per frame at 1/8 (same as WebGL) | Sampled | Everywhere | No advantage over WebGL |
| **WebGL fragment shader** (fbm noise with domain warping) | Curtains, ribbons, a true aurora; colour by intensity | Cost scales with pixel count. Measured 60–64 ms per frame at 1/8, 84–89 at 1/4, 510–517 at full size, and 1731–1840 at full size with DPR 2. A still is free | **Sampled** (verified here: the navigator glass shifted from `#181a1f` to `#181f22` over the field) | WebGL 1 everywhere | **Recommended** |
| Stripe-style vertex colours (a coarse mesh) | Smooth bands; no fine ribbons | The cheapest per pixel, but needs a mesh topology | Sampled | WebGL 1 | Valid alternative; not needed at 1/8 size |
| **WebGPU** | Same as WebGL | No gain for a 20 000-pixel shader. Device loss reported in Chromium with a `backdrop-filter` overlay above a WebGPU canvas (three.js #32726, Chromium 467732049; not reproduced in Safari) | Risky | Chrome 113 (desktop; Linux from 144), Safari 26, Firefox 141 (partial: Windows only) | **Reject** |
| **OffscreenCanvas in a worker** | Same | Keeps the field moving while the main thread is busy. Costs a worker, plus messages for every state change | Sampled | WebGL in workers: Chrome 69, Firefox 105, Safari 17 (macOS Sonoma or later per abstracts) | Later, only if main-thread stalls show (§11) |
| **CSS Paint API worklet** | Any 2D drawing | Repaints on the paint path | Sampled | **Chromium only**; Firefox behind a flag, Safari none | Reject |
| **Pre-rendered loop** (VP9, H.264, animated WebP) | Exactly one loop, with a seam unless the noise is periodic in time | Tiny files: 240 frames at 360 × 224 are **22 KB VP9, 26 KB WebP, 41 KB H.264**. Decoding is cheap on real hardware, but measured here VP9 was no cheaper than the shader. **It cannot react**: no brighten on drop, no lobe placement per view, no speed change | Sampled | Everywhere (no H.264 in open-source Chromium builds) | Reject for the app; a WebP still is the poster and fallback |

Why the shader wins: it is the only option that looks like light rather than blobs, and it can
react (intensity, speed, lobe positions) through three uniforms. At 1/8 size it costs about
as much per frame as the CSS blobs, and nothing when still. The per-frame shader work is small
on a real GPU. An estimate from the operation count: about 1 300 ALU operations per pixel × 20 300
pixels = 26 M per frame, about 0.5 G per second at 20 fps. That is roughly 0.1 % of a 2018
integrated GPU's ~400 GFLOPS peak. The same shader at full size with DPR 2 needs 6.7 G per frame
(about half that GPU's peak at 30 fps), which is consistent with the battery drain reported in
Paper's issue #188. This is an estimate from established figures, not a measurement.

---

## 4. Measurements

### 4.1 Set-up

- One spike page with variants selected by query string, plus an edge-light page (§9.3). Window
  1440 × 900, DPR 1 unless noted, headless Chromium 141, ANGLE on SwiftShader (Vulkan).
  SwiftShader rasterises, runs WebGL and composites on the CPU, so the **GPU process's CPU
  time stands in for GPU work**.
- A fresh browser for every variant. A 2.5 s warm-up, then 8 s measured. CPU is summed from
  `/proc/<pid>/stat` over the browser's process tree. "CPU-ms per frame" = total CPU time ÷
  frames produced (the shader's own draws, or rAF ticks for CSS variants). Two full passes
  (load averages 4.3–6.8 and 6.1–10.2 on 4 cores, shared with other work), so absolute values
  are inflated. Read the ratios.
- The WebGL variant is the shader in Appendix A: value-noise fbm, 4 octaves, two levels of
  domain warp, two lobes, intensity 0.9.

### 4.2 Results

| Variant | CPU-ms per frame (pass 1 / pass 2) | Frames reached (target) | Reading |
|---|---|---|---|
| Nothing (canvas colour) | idle (4.6 % / 4.4 % CPU) | — | Baseline |
| Floor: one full-screen layer nudged 1 px | 18 / 19 | 60 | Cost of compositing a full frame here |
| CSS `@property` gradients | 530 / 515 | 3–4 (60) | Full repaint every frame |
| CSS blobs, `transform` | 68 / 69 | 24–26 (60) | Compositor-only, still a full frame |
| CSS blobs + `filter: blur(48px)` | 291 / 285 | 4–7 (60) | Blur on large moving layers is expensive |
| Canvas 2D, 1/8 size | 65 / 61 | 18–20 (20) | — |
| WebGL, full size | 510 / 517 | 3–4 (30) | Shader-bound |
| WebGL, 1/4 size | 89 / 84 | 15–19 (30) | — |
| **WebGL, 1/8 size** | **60 / 60** (30 fps), **64 / 62** (20 fps) | 21–28 (30), 18–20 (20) | Close to the floor plus about 43 ms of SwiftShader shading |
| **WebGL, 1/8 size, still** | **idle (4.4 % / 4.6 %)** | — | **A still is free** |
| WebGL, 1/8, only a 560 × 360 box animates | 34 / 35 | 20 (20) | Damage area matters: about half |
| Glass (four tier-1/2 surfaces), nothing behind | idle | — | — |
| Glass + still aurora | idle | — | Glass over a still costs nothing |
| **Glass + WebGL 1/8, 20 fps** | **153 / 152** | 9–12 (20) | **Every aurora frame re-filters the glass: ×2.5** |
| Glass + CSS blobs | 164 / 157 | 10–11 (60) | Same effect |
| WebGL 1/8, 20 fps, DPR 2 | 64 / 58 | 19–20 (20) | DPR-independent, as designed |
| WebGL full size, 30 fps, DPR 2 | 1840 / 1731 | ~1 (30) | 29× the 1/8 cost |

One extra run (load 9): a VP9 loop at 20 fps used 189 % CPU and an animated WebP 53 %. The
1/4-size shader in the same run used 154 %.

**What carries over to real hardware:** a still costs nothing; full-screen damage costs a full
composite; glass over anything that moves re-filters on every frame (research 14 and research
18 §6.4 measured the same); cost grows with animated area and with shaded pixels; and capping
the backing store makes the cost independent of DPR. **What does not carry over:** absolute
milliseconds, and the shader-to-composite ratio (SwiftShader shades about 100× slower than a
GPU). The pass criteria in §11 are therefore for the owner's machine.

### 4.3 Main thread

The shader's main-thread work is one uniform update and one draw call per frame. Chrome's
`TaskDuration` was 1.4–2.5 % of a core at 20–30 fps against 1.6 % idle, a probe rAF included.
Research 18 §6.3 found that rAF-driven animation loses 31 % of its frames under 50 ms long tasks.
The aurora is decorative, so dropped frames are acceptable. That is also why the progress ring
(§9.3) is a compositor `transform` animation and not the shader. It has to keep moving while the
main thread is busy.

---

## 5. Banding and dither

A dark, slow gradient in 8-bit output shows bands. The longest run of identical pixels along
rows, inside the lit area (G > 14), measured on frozen frames:

| Render | Dither | p99 run (px) | Longest run (px) |
|---|---|---|---|
| Full size | none | 40 | 130 |
| Full size | IGN ±0.5 LSB in the shader | **6** | 13 |
| 1/2 size, upscaled by CSS | IGN in the shader | 8 | 30 |
| 1/4 size, upscaled by CSS | IGN in the shader | 12 | 45 |
| 1/8 size, upscaled by CSS | IGN in the shader | 18 | 68 |
| 1/8 size, upscaled by CSS | none | 40 | 120 |
| 1/8 size + static grain layer (SVG turbulence, 4 % opacity) | grain | **4** | 7 |
| 1/8 size, two passes (8-bit low-res buffer, full-size dithered upsample) | IGN in pass 2 | 25 | 98 |

Readings:

- Dither in the shader halves the bands even when the low-res buffer is upscaled, because the
  upscaled noise still breaks band edges into wavy contours.
- A two-pass upsample does not help unless the low-res buffer is 16-bit float. An 8-bit buffer
  has already quantised the flat areas, so ±0.5 LSB of dither rounds back to the same level.
  WebGL 2 with `RGBA16F` and `EXT_color_buffer_float` would fix that, but it costs a full-size
  pass and a full-size canvas (21 MB at DPR 2 instead of 81 KB).
- A static grain layer removes banding completely. It adds one blended full-screen layer,
  measured at +34 ms per frame here (91 against 57). On a GPU that is a bandwidth cost, not a
  shading cost.
- Interleaved gradient noise (Jimenez, via the Phaser dev log and shader-tutorial.dev, both
  abstracts) is a one-line dither and was used here.

Recommendation: 1/8 size with IGN in the shader for the app. Add the 3 % grain layer only on
surfaces where the owner sees bands on his screen (likely the About hero and the empty state on
an OLED or mini-LED panel). Many laptop panels and the macOS display pipeline dither on their
own (established knowledge), so judge on the owner's display.

---

## 6. Colour

### 6.1 The ramp

| Stop | OKLCH | sRGB hex | % of sRGB max chroma | Display-P3 max chroma at this L, h | Role |
|---|---|---|---|---|---|
| Teal | `oklch(0.62 0.10 192)` | `#1f9996` | 94 | 0.143 | The dim body and the depth at the edges |
| Mint | `oklch(0.80 0.15 158)` | `#58da98` | 80 | 0.258 | The middle of the light |
| **Lime** | `oklch(0.88 0.21 124)` | `#bbed26` | 96 | 0.255 | Strong light; same hue as research 20's accent `oklch(0.92 0.21 124)` `#c8fb3d` |
| Lemon | `oklch(0.93 0.18 105)` | `#faee40` | 91 | 0.229 | Only the hottest cores ("sarı" in the brief) |
| Canvas | `#08090b` | — | — | — | Light is **added** to it in linear light |

The owner's hue range (110–135) holds the lime. Teal, mint and lemon give depth on both sides.
Every stop is inside sRGB.

**Colour follows intensity.** The shader computes an intensity `e` from 0 to 1 and picks the
colour from it: teal until 0.08, blending to mint by 0.35, to lime by 0.65, and to lemon from
0.78 to 1.0. The light added is `ramp(e) · e^1.4 · I`, where `I` is the placement's intensity.
The reason is perceptual. Yellow-green at low lightness is olive: lime at 10 % over the canvas
is `#415310` (L 0.41, h 124), which reads as army green. Mint and teal at the same lightness
read as light in the dark (`#1d4c34`, `#0c3433`). Real aurorae do the same thing: they are green
at the core and blue-violet at the fringe. Look 2 of the spike, a contour-line variant, put lime
everywhere. It covered 32 % of the window above L 0.65 and was rejected on sight.

### 6.2 How it reads on the dark field

- Lime at full strength is 13.5:1 against `#08090b`. That is far brighter than any UI text, and
  the reason the hot area must stay small. Apple's caution about bright moving objects on black
  applies.
- **Budget, measured on the spike's Home composition:** mean relative luminance 0.016; the area
  above L 0.65 is 0.47 % of the window and the area above L 0.8 is 0.07 %; 78 % of the window
  stays below L 0.25. Caps for the design: on Home, mean Y ≤ 0.03 and area above L 0.65 ≤ 1.5 %.
  On About, mean Y ≤ 0.06 and area above L 0.65 ≤ 4 %. The page (Y 1.0) stays at least 30× the
  field's mean.
- **Display-P3.** P3 gives lime 17 % more chroma at hue 125 (cusp C 0.232 → 0.271). WebGL can
  draw in P3 through `drawingBufferColorSpace = 'display-p3'` (Chrome 104, Safari 16.4, Firefox
  132 per BCD). Research 13 kept the inks in sRGB because the PDF stores DeviceRGB. The aurora
  never enters a file, so that reason does not apply. Use P3 stops when `(color-gamut: p3)`
  matches, at the same lightness and 90–95 % of the P3 cusp.
- **Colour vision.** Research 22 §11 found the lime and the yellow highlighter identical under
  protanopia (ΔE_OK 0.1). The aurora carries no meaning, so this costs nothing. It is one more
  reason never to use the light as a signal.

### 6.3 A light theme

Additive light disappears on a light field: lime at I 0.5 over `#f5f6f8` gives `#fffffa`, ΔE_OK
0.027. A light theme needs a **pigment** model: `out = bg · (1 − k · (1 − stop))` in linear
light, with darker stops: lime `oklch(0.82 0.19 128)`, mint `oklch(0.78 0.13 160)`, teal
`oklch(0.70 0.10 195)`. At k 0.45, lime gives `#d2e7c2` (ΔE 0.090) and dark text stays at
13.1:1. Cap k at 0.45, and check it again if a light theme ships.

---

## 7. How glass picks up the light

### 7.1 Tiers over the field (model)

The model is the one `tokens.test.ts` uses: `tint · a + clamp(brightness · saturate(backdrop))
· (1 − a)` per sRGB channel. The aurora pixel is the canvas plus `I` × the stop, in linear light.
ΔE is the distance from the same tier over the bare canvas; about 0.02 is just noticeable.

| Light behind | Pixel | Tier 1 (bar) ΔE · primary · secondary | Tier 2 (frame) ΔE · primary · secondary | Tier 3 (menus) ΔE |
|---|---|---|---|---|
| Teal, I 0.10 | `#0c3433` | 0.027 · 11.7 · 7.9 | 0.018 · 13.5 · 9.1 | 0.017 |
| Mint, I 0.20 | `#296a49` | 0.058 · 10.7 · 7.2 | 0.043 · 12.6 · 8.5 | 0.038 |
| Lime, I 0.20 | `#5a7314` | 0.070 · 10.3 · 7.0 | 0.053 · 12.4 · 8.4 | 0.046 |
| **Lime, I 0.35** | `#75951a` | **0.089 · 9.7 · 6.5** | 0.069 · 11.8 · 8.0 | 0.058 |
| Lime, I 0.60 | `#95bd21` | 0.114 · 8.8 · 6.0 | 0.088 · 11.1 · 7.5 | 0.074 |
| Lemon, I 0.60 (the brightest pixel the app allows) | `#c8be34` | 0.119 · 8.6 · 5.8 | 0.095 · 10.8 · 7.3 | 0.079 |
| White page (the binding case today) | `#ffffff` | — · 7.3 · 4.94 | — · 9.6 · 6.5 | — |

Light behind the glass changes its hue clearly and never lowers contrast below the white-page
case. The darker tiers dampen it: tier 2 shows about 77 % of tier 1's shift. **Measured**:
over the spike's field (mean `#112d25` behind the navigator), tier 2 rendered `#181f22` instead
of `#181a1f`, ΔE 0.018, as the model predicts for light that dim. So a lobe that should colour a
glass surface must sit directly beneath it at I ≥ 0.2.

These values are modelled. Research 22 §3.2 found that short glass leaks the unfiltered backdrop
at its edges in Chromium (the 44 px bar rendered `#5b5d61`, not the modelled `#47494d`). Its fix
(blur radius ≤ ⅕ of the short side, or a masked oversize filter layer) applies here too, and the
final check must run on rendered pixels.

### 7.2 Beneath, not inside

| Light layer (accent lime `#cef934`, `oklch(0.92 0.21 122)`) | Over a white page: primary · glass secondary · old accent | Verdict |
|---|---|---|
| Lime at 8 % **inside** tier 1 (painted over the tint) | 6.01 · **4.07** · 2.50 | Fails AA |
| Lime at 16 % inside tier 1 | 4.96 · **3.36** · 2.06 | Fails |
| Lime at 50 % **beneath** tier 1 (between page and bar, clipped to the bar) | 7.61 · 5.15 · 3.16 | Passes, ΔE 0.044 |
| Lime at 70 % beneath tier 1 | 7.71 · 5.22 · 3.20 | Passes, ΔE 0.060 |
| Lime at 50 % beneath tier 1, over the canvas instead | 10.0 · 6.78 · 4.16 | Passes, ΔE 0.078 |

A light layer beneath the glass is clamped by `brightness()` before the tint goes on, so its
worst case is still the white page. Inside the glass, nothing clamps it. The only light allowed
inside a glass surface is non-text: a 1–1.5 px rim (§9.3) or the selected chip's own fill.

### 7.3 A "lit glass" variant for light-only backdrops

Where no page can ever pass beneath a surface (Home cards, the drop zone, About), the glass can
be lighter, because the brightest thing behind it is the field's lemon peak at I 0.6 (`#c8be34`,
Y 0.49), not white (Y 1.0). A search over tint, alpha, brightness and saturation, with the
constraints primary ≥ 7, glass secondary ≥ 4.5 and separation from the canvas ≥ 1.2, gave:

| Variant | Tint | Filter | Over the brightest field pixel | Over the canvas | ΔE over lime I 0.35 | Over white |
|---|---|---|---|---|---|---|
| Tier 1 today | `rgb(48 51 58 / 0.66)` | `blur(28px) saturate(1.8) brightness(0.45)` | `#404026`: primary 8.58, secondary 5.81 | `#212328` (1.27:1) | 0.089 | `#47494d` |
| **Lit glass** | `rgb(48 51 58 / 0.58)` | `blur(28px) saturate(1.8) brightness(0.55)` | `#4d4b22`: primary 7.24, secondary 4.90, danger 4.60, lime accent `#c8fb3d` 7.39 | `#1e2025` (1.22:1) | **0.133** | `#57585d`: secondary **3.88, fails** |

Lit glass shows the light about 50 % more strongly. It is allowed **only** on surfaces that
never overlap a page or a thumbnail's white edge region, and only where the field's intensity
is capped at 0.6. The cap must be a token assertion, not a convention.

---

## 8. Placement map

"I" is the shader's intensity uniform. Lobes are given as centre (x, y with y up, in viewport
fractions), gain and radius (in viewport heights).

| Place | Aurora? | Form | Rest | Events | Notes |
|---|---|---|---|---|---|
| **Empty Home** (no file open) | **Yes, the strongest in the app** | Full-window field, 1/8 size; one lobe under the open-and-drop card (0.5, 0.35, 1.0, 0.42), one dimmer lobe at top right (0.82, 0.78, 0.6, 0.35) | Still frame, I 0.45 | Arrival on load: I 0 → 0.45 over 1.2 s while time runs, then settles (≤ 5 s). Drag-over: see §9.2 | The card and its keycaps are lit glass (§7.3) |
| **Home with files** | Yes | Same field; lobes behind the gaps between the card rows, never centred on a thumbnail | Still, I 0.40 | Combine, open, close: a 2 s drift at ambient speed. Success bloom (§9.4) | Cards: lit glass; thumbnails stay opaque white with their hairline |
| **Drag-over** (anywhere) | Yes | On Home, the field. In document views, the drop overlay shows the field **behind its scrim** (the only time the field appears in a document view) | — | See §9.2 | The overlay already hides the page |
| **Beneath the floating tool bar** | Yes, as a clipped light layer (CSS, not the shader) | Radial accent-lime gradient, 50 % at its centre, under the armed tool, clipped to the capsule | Static | Slides to the newly armed tool (spring, §9.2) | Depends on research 20's accent decision (§13). Also needs research 22's edge-leak fix |
| Behind docked panels (navigator, title bar, status bar) | **No** in document views | — | — | — | Pages pass under them (research 14); there is no field on the stage |
| **The active or selected item** | Only the bar's armed tool (above) | — | — | — | Thumbnails, cards and annotations use the selection ring. Content never gets light |
| **Processing** (OCR, export, compress, combine, batch, convert) | Yes: a light ring | 1.5 px conic ring around the progress capsule or toast (§9.3); on Home the field also runs at excited speed | — | Runs until the job ends; it is a progress indicator, so the 5 s rule's exception applies | Never on the page; never at the screen edge |
| **Success** | Yes, once | Ring bloom, plus a Home field pulse | — | §9.4 | Export saved, combine done, OCR done, signature applied. Never for errors |
| **About page hero** | **Yes, the strongest anywhere** | 1/4 size, I 0.8, lobes behind the hero clip, not behind the H1. Text sits on the dark part or on lit glass | Ambient drift allowed **with a visible pause control** (WCAG 2.2.2) | Pauses off-screen (IntersectionObserver) | Research 21 §10 rebuilds this page |
| **App icon, favicon, PWA icons, social card** | A rendered still only | One frame, exported as PNG/WebP | — | — | Research 21: the icon must work in luminance alone; the light is backing, not identity |
| Arrange (light table), Compare | **Never** | — | — | — | Content judgement, and Compare uses colour for its diffs |
| Read and Edit stage gutters | **Never** | — | — | — | The page stays the brightest thing; lime next to white also shifts how the page's white reads |
| Dialogs, sheets, menus, popovers, tooltips, inspector | **Never their own** | — | — | — | Over Home they pick up the field through their glass like anything else |
| Redaction, errors, warnings, destructive confirmations | **Never** | — | — | — | Lime reads as "go"; these must not feel celebratory |

**Never, anywhere:**

1. On the PDF page, under it within 64 px of its edge, or tinting it in any way. That includes
   thumbnails on Home and in Arrange.
2. Behind text that is not on glass or a scrim. Research 22 §3.1: on the bare canvas,
   `--text-secondary` already fails at 19.5 % of a lime core.
3. As the only signal of a state. The ring always comes with text ("Exporting… 40 %").
4. At the screen edge as a frame around the window. Apple's edge glow belongs to the system,
   and the HIG warns about motion in the periphery.

---

## 9. Motion behaviour

### 9.1 Speed

The shader's time is integrated: `t += dt · speed`, and it never jumps. Measured on the spike by
block matching across frames 5 s apart, a speed of 0.2 moves visible forms about 8.5 px/s at
1440 × 900, with a mean change of 2.2 sRGB levels per second. From that:

| State | `speed` | Visible drift | Frame cap |
|---|---|---|---|
| Still (default rest) | 0 | 0 | none drawn |
| Ambient (opt-in setting, About hero) | 0.12 | ≈ 5 px/s, ≈ 1.3 levels/s | **15 fps**: 0.33 px per frame, invisible on forms this soft (owner to confirm against 30) |
| Arrival, settle | 0.12 → 0 | — | 15 fps |
| Excited (drag-over, processing on Home) | 0.30 | ≈ 12 px/s | 30 fps |

- No periodic modulation. The noise is aperiodic, and no "breathing" loop with a period
  between 3 and 8 s is allowed (HIG: avoid sustained oscillation near 0.2 Hz).
- Time wraps every 600 s of integrated time (about 83 minutes of ambient drift), with a 400 ms
  cross-fade between two frames. This bounds the noise coordinates, so the hash keeps its
  precision in 32-bit floats (see Appendix A).

### 9.2 Reactions

All are critically damped springs (mass 1, damping = 2√stiffness) on uniforms or on CSS
`transform`. They run at display rate until within 1 % of their target, then fall back to the
cap. Research 18 defines the spring tokens for the chrome. These map onto them by duration.

| Reaction | What changes | Spring (stiffness, damping) | 95 % settle |
|---|---|---|---|
| Drag-over enters the window | `I` +0.15 (to at most 0.6); speed 0 → 0.30; the nearest lobe's radius ×1.3 | 120, 22 | 0.43 s |
| Pointer moves during drag-over | The nearest lobe's centre follows the pointer | 80, 18 | 0.53 s |
| Drag leaves or drops | Back to rest values, then speed → 0 | 60, 15.5 | 0.61 s |
| Tool armed (bar under-light) | The light layer slides under the new tool (`transform: translateX`) | 300, 35 | 0.27 s |
| Arrival on load or on entering Home | `I` 0 → rest; speed 0.12 → 0 over 4 s | 60, 15.5 for I | ≤ 5 s total |

### 9.3 The processing ring

- A ring of 1.5 px drawn as a conic gradient (transparent, lime `#c8fb3d` at 40°, mint at 60 %
  opacity at 90°, transparent from 150°) on an oversized square. It is rotated by `transform:
  rotate()` and clipped to the capsule's border with `mask-composite: exclude`. Compositor-only:
  it keeps turning during main-thread stalls.
- One turn every **2.4 s**, linear. Apple's glow is reported at about 1.8 s per cycle (abstract);
  the slower value suits a work app.
- **No blurred halo outside the capsule.** In the spike, a halo blurred by 14 px beneath the bar
  tinted the white page around it. If a glow is wanted, it goes beneath the glass and is clipped
  to the capsule (§7.2).
- The `@property --angle` version looks the same but repaints the gradient on every frame
  (88 against 59 CPU-ms per frame in the spike). Use the `transform` version.
- Under reduced motion: a static rim (the same gradient at a fixed angle) and the percentage in
  text.

### 9.4 The success bloom

- Ring opacity 0 → 1 over 180 ms (ease-out), hold 120 ms, back to 0 over 900 ms. The ring stops
  turning when the job ends.
- On Home: `I` +0.10 for 1.2 s through the 60/15.5 spring, then back.
- It is one slow rise and fall, so it never meets WCAG 2.3.1's definition of flashing (three
  flashes within one second).
- Never for errors, cancellations, redaction or deletion. A failure stops the ring and shows the
  failure in text.

### 9.5 Pauses

| Condition | Behaviour | Source of the pattern |
|---|---|---|
| `document.hidden` | Stop the rAF loop; keep the time | Paper, Stripe |
| Field off-screen (IntersectionObserver, threshold 0) | Stop | Paper PR #268 |
| Window not focused for 5 s (`blur`) | Glide to still | WinUI Acrylic falls back to solid in inactive windows (research 13 §1) |
| Ambient drift (opt-in) after 60 s without input | Glide to still; resume on input | Battery |
| Scroll, pinch-zoom, drag in Arrange, pen down, typing | Freeze; resume 300 ms after the last event | Stripe pauses while scrolling and resumes 200 ms after |
| A dialog or sheet opens over Home | Freeze (the scrim hides it anyway) | — |
| `prefers-reduced-motion: reduce` | One still frame per view; reactions become a 150 ms cross-fade of `I` or nothing | HIG Accessibility; research 22 §5 |

---

## 10. Device gates, settings and fallbacks

### 10.1 Gates

| Signal | Support (BCD 8.1.4) | Action |
|---|---|---|
| Compute Pressure `PressureObserver` ('cpu') | Chrome 125+ desktop only | `fair` → cap 10 fps; `serious` or `critical` → still |
| `navigator.getBattery()` | Chromium only (Firefox removed it in 52; never in Safari) | Discharging and below 20 % → still |
| `hardwareConcurrency ≤ 4` and `deviceMemory ≤ 4` | `deviceMemory` Chromium only | Still by default ("Auto" treats the device as low-end) |
| Runtime watchdog | Everywhere | Over a 2 s window, if the field's own frame interval p50 is more than 1.5× its target, or rAF p95 is above 50 ms, step down once per session: 30 → 15 → still |
| iOS Low Power Mode | Not detectable | iOS already caps rAF at 30 fps there (popmotion, abstract); the 15/30 caps sit at or under that |
| Chrome Energy Saver | Not detectable; not researched (search budget ran out) | Rely on the watchdog |

### 10.2 Setting

**Appearance → Ambient light: Auto · Still · Off.** Auto (default) = event motion, as above,
subject to the gates. Still = one frame per view, no motion. Off = no field, no under-light;
the ring and the bloom become a static rim. This setting is also the "mechanism" WCAG 2.2.2 asks
for, should the owner choose continuous drift on Home. It sits beside research 22's
**Clear · Tinted · Solid** transparency control and does not replace it.

### 10.3 Fallbacks

| Situation | Result |
|---|---|
| No WebGL, context creation fails, or no `highp` float in fragment shaders | A static CSS field: four `radial-gradient()` layers in the ramp's colours on the same element. Measured cost equals no aurora |
| `webglcontextlost` | Switch to the CSS field; try to restore once on `webglcontextrestored` |
| `forced-colors: active` | No field at all (research 22 §6.2: a canvas does not disappear by itself); ring → system `Highlight` outline |
| `prefers-contrast: more` | No field; glass already falls back to solid |
| Reduced transparency (in-app or media query) | Glass goes solid (existing rule), so the field shows only in open areas. Field becomes a still at `I` × 0.7 |
| `prefers-reduced-motion: reduce` | Still frames (§9.5) |
| Print, export images, screenshots taken by Recto's own media tool | No field (it is not content) |

---

## 11. Performance budget (pass criteria for the owner's machine)

| Item | Budget |
|---|---|
| Code | ≤ 4 KB gzip for the field module (the spike's shader, loop and uniforms are 2.5 KB gzip). No dependency. Lazy-loaded after first paint, when Home or the drop overlay first shows |
| Backing store | `⌈cssW / 8⌉ × ⌈cssH / 8⌉`, longest side clamped to 128–320 px (≤ 64 000 px), **independent of DPR**. About hero: `/4`, ≤ 256 000 px |
| Contexts | One WebGL context for the app; the under-light, ring and bloom are CSS |
| Frame rate | Still at rest. Ambient ≤ 15 fps, excited ≤ 30 fps, spring transitions at display rate for ≤ 600 ms |
| GPU time (Chrome Performance panel, GPU track) | Shader ≤ 0.5 ms per frame on a 2020-class integrated GPU at DPR 2 |
| Energy (macOS Activity Monitor, 10 min on Home) | Auto ≤ 1.1× Still's energy impact; ambient drift ≤ 1.3× |
| Glass over a moving field | The frame-time criteria of research 14 (H1: < 1 % of frames over 16.7 ms) hold during a drag-over on Home with lit-glass cards |
| Memory | Backing store ≤ 100 KB; no full-size buffers |
| Main thread | ≤ 0.3 ms per field frame |
| Light budget | Home: mean Y ≤ 0.03, area above L 0.65 ≤ 1.5 %. About: ≤ 0.06 and ≤ 4 % |

If the GPU or energy criteria fail on the owner's machine, drop ambient drift first, then
excited speed on Home; keep stills and the ring.

---

## 12. Recommendations

| ID | Recommendation | Section |
|---|---|---|
| **AU-1** | One WebGL 1 fragment shader, written in-house (Appendix A): value-noise fbm, 4 octaves (lacunarity 2.03, gain 0.5, 37° rotation per octave), two levels of domain warp, 1–3 Gaussian lobes, ribbons `(1 − |2f − 1|)^4 · 2.0` plus body `smoothstep(0.25, 0.75, f) · 0.8`. No library: React Bits is Commons Clause, Paper's defaults invert our needs, three.js and OGL add weight for one triangle | §2, §3 |
| **AU-2** | Backing store at 1/8 of CSS size, clamped to 128–320 px on the long side, DPR-independent; bilinear CSS upscale; `alpha: false`, `antialias: false`, `powerPreference: 'low-power'`; About hero at 1/4 | §4, §11 |
| **AU-3** | Interleaved-gradient-noise dither in the shader (±0.5 LSB); a static 3 % grain layer only where the owner sees banding | §5 |
| **AU-4** | Still by default. Motion only on events (arrival, drag-over, processing, success), settling within 5 s. Continuous drift is opt-in: 15 fps, `speed` 0.12 | §0, §9 |
| **AU-5** | Never a field on the document stage (Read, Edit), in Arrange or in Compare. In document views, light appears only beneath the tool bar, in the drop overlay and in the processing ring | §8 |
| **AU-6** | Ramp teal `oklch(0.62 0.10 192)` → mint `oklch(0.80 0.15 158)` → lime `oklch(0.88 0.21 124)` → lemon `oklch(0.93 0.18 105)`, chosen by intensity (breakpoints 0.08 / 0.35 / 0.65 / 0.78–1.0), light added in linear light over `#08090b` as `ramp(e) · e^1.4 · I` | §6.1 |
| **AU-7** | Light budget: Home mean Y ≤ 0.03 and area above L 0.65 ≤ 1.5 %; About ≤ 0.06 and ≤ 4 %; `I` ≤ 0.6 wherever glass with text can overlap the field | §6.2, §7.3 |
| **AU-8** | Light reaches glass only from beneath. No light painted inside a glass surface under text; inside, only a 1–1.5 px rim or the selected chip's fill | §7.2 |
| **AU-9** | A "lit glass" variant, `rgb(48 51 58 / 0.58)` with `blur(28px) saturate(1.8) brightness(0.55)`, for Home cards, the drop zone and About only. Add it to `tokens.test.ts` with the brightest field pixel (`#c8be34`) as its worst case, and a test that forbids it over pages | §7.3 |
| **AU-10** | The bar's under-light: a static clipped radial layer beneath the floating bar, accent lime at 50 % under the armed tool, moved by `transform` with a 300/35 spring. Subject to research 20's accent decision | §7.2, §8, §13 |
| **AU-11** | Processing ring: 1.5 px conic lime ring, rotated by `transform` at 2.4 s per turn, clipped to the capsule; no halo outside it; static rim under reduced motion; always paired with text | §9.3 |
| **AU-12** | Success bloom: 180 ms in, 120 ms hold, 900 ms out; Home field +0.10 for 1.2 s; never for errors, redaction or deletion | §9.4 |
| **AU-13** | Drag-over: `I` +0.15 (cap 0.6), speed 0.30, nearest lobe follows the pointer (80/18 spring) with radius ×1.3; back over 0.6 s. In document views, the field shows only behind the drop overlay's scrim | §9.2 |
| **AU-14** | Pauses: hidden, off-screen, unfocused for 5 s, 60 s idle, during scroll, zoom, drag, ink and typing (resume after 300 ms), dialogs over Home; reduced motion = one still frame per view | §9.5 |
| **AU-15** | Gates: Compute Pressure (`fair` → 10 fps, `serious` → still), battery under 20 % → still, low-end heuristic → still, runtime watchdog stepping 30 → 15 → still | §10.1 |
| **AU-16** | Setting "Ambient light: Auto · Still · Off", next to research 22's transparency control | §10.2 |
| **AU-17** | Fallbacks: a static four-gradient CSS field without WebGL or after context loss; nothing under `forced-colors` and `prefers-contrast: more`; no video loops in the app (a WebP still is the poster) | §3, §10.3 |
| **AU-18** | Display-P3 stops with `drawingBufferColorSpace = 'display-p3'` when `(color-gamut: p3)` matches; allowed because the light never enters a PDF | §6.2 |
| **AU-19** | Integration rules: the field canvas and every glass surface share one backdrop root, so no ancestor between them may have `filter`, `opacity < 1`, `mask`, `clip-path`, `mix-blend-mode` or `backdrop-filter`. No `mix-blend-mode` on the canvas (blend in the shader). Resize on a 150 ms debounced ResizeObserver; never animate layout | §3, §7 |
| **AU-20** | Brand: the aurora as a rendered still in the app icon's backing, the social card and the About poster; live only on About (with a pause control) and in-app Home | §8 |
| **AU-21** | Light theme (if one ships): a pigment model `bg · (1 − k(1 − stop))`, k ≤ 0.45, stops lime `oklch(0.82 0.19 128)`, mint `oklch(0.78 0.13 160)`, teal `oklch(0.70 0.10 195)` | §6.3 |
| **AU-22** | Verify on the owner's machine before the field ships: the §11 budget, the rendered contrast of lit glass and of the under-light bar, banding on his display, and 15 against 30 fps for ambient drift | §11, §14 |

---

## 13. Tensions with current decisions

1. **DESIGN.md §1, "Nothing glows."** Proposed: "Only light glows, and only in named places:
   Home and empty views, beneath the tool bar, the drop overlay, the processing ring and one
   success bloom. The document stays the brightest object (AU-7)." The reason: the owner asked
   for light explicitly, and the caps keep the original intent of a page that is never outshone.
2. **DESIGN.md §3, "Chrome is never tinted; the accent stays its only colour", and
   `--elevation-float`'s "No other shadow, glow or halo."** Light becomes a second colour
   presence. Research 20 makes lime the interactive accent (`#c8fb3d`). With that, the light
   and the accent are one hue family and the system still has one colour. If the accent stays
   periwinkle, the bar's under-light (AU-10) should be dropped, so the armed tool does not carry
   two colours.
3. **Research 13 §4.3: Home cards stay opaque.** With a lit backdrop, the Home cards can be lit
   glass (AU-9); the thumbnails inside them stay opaque.
4. **Research 13 §8: every colour stays sRGB.** That rule holds for inks; the aurora can use P3
   (AU-18), because it never enters the file.
5. **`tokens.css`: "One curve."** The field's reactions are springs on uniforms. This matches
   research 18's spring tokens, which change that rule anyway.
6. **Research 14's S2 pass criteria** cover glass over scrolling pages. A moving field under
   glass re-filters it on every frame too, so S2's frame-time test must add a drag-over on Home
   (§11).
7. **Research 18 §6.5 suggested CSS `steps()` at 30 Hz for an ambient drift.** This document
   prefers the shader with event-driven motion and a 15 fps cap. The two agree that rest is
   still and that motion settles within 5 s.

---

## 14. Open questions for the owner

1. **How strong on Home?** Rest at I 0.40–0.45 is subtle (see the composition described in §6.2).
   Should the empty Home go to 0.6?
2. **Continuous drift on Home: yes or no?** Event-only motion is calmer and costs almost
   nothing. Continuous drift needs the setting as a pause mechanism and doubles as the "living"
   look you described.
3. **The bar's under-light**: always, only in Edit, or not at all? (Lighting the bar only in Edit
   would make light a mode signal, which research 13 §5 advised against.)
4. **Is lime the accent** (research 20) **or only light?** AU-10 depends on it.
5. **About hero**: the live shader with a pause control, or a still poster?
6. **On your machine:** please run the §11 checks (GPU track, Activity Monitor energy for 10
   minutes, banding on your display), and compare 15 against 30 fps for the drift.

---

## Appendix A. Reference shader

Written for this document (Apache-2.0 with the repository). WebGL 1 with `highp` floats in the
fragment shader. The hash multiplies coordinates by about 123, which 16-bit floats cannot hold,
so where `getShaderPrecisionFormat(FRAGMENT_SHADER, HIGH_FLOAT).precision` is 0 the app uses the
CSS field instead (§10.3). The 600 s time wrap of §9.1 keeps the coordinates small.
`gl_FragCoord` has its origin at the bottom left. Uniforms come from the placement table (§8). `uRamp` holds the linear-sRGB stops: teal `0.01358, 0.31819,
0.30311`; mint `0.09708, 0.70406, 0.31446`; lime `0.49825, 0.84733, 0.01945`; lemon `0.95957,
0.85132, 0.05203`. `uBg` is `0.00243, 0.00273, 0.00335`.

```glsl
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uIntensity;
uniform vec3 uRamp[4]; uniform vec3 uBg; uniform vec4 uLobe[3]; // xy centre, z gain, w radius
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5; mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = r * p * 2.03; a *= 0.5; }
  return v;
}
vec3 ramp(float e) {
  vec3 c = mix(uRamp[0], uRamp[1], smoothstep(0.08, 0.35, e));
  c = mix(c, uRamp[2], smoothstep(0.35, 0.65, e));
  return mix(c, uRamp[3], smoothstep(0.78, 1.0, e));
}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y, uv = gl_FragCoord.xy / uRes;
  float t = uTime;
  vec2 q = vec2(fbm(p * 1.2 + vec2(0.0, 0.11 * t)), fbm(p * 1.2 + vec2(5.2, 1.3) - 0.07 * t));
  vec2 r = vec2(fbm(p + 1.8 * q + vec2(1.7, 9.2) + 0.05 * t), fbm(p + 1.8 * q + vec2(8.3, 2.8) - 0.04 * t));
  float f = fbm(p * 0.8 + 2.0 * r);
  float lobes = 0.0;
  for (int i = 0; i < 3; i++) {
    vec2 d = (uv - uLobe[i].xy) * vec2(uRes.x / uRes.y, 1.0);
    lobes += uLobe[i].z * exp(-dot(d, d) / (uLobe[i].w * uLobe[i].w));
  }
  float ribbon = pow(1.0 - abs(2.0 * f - 1.0), 4.0);
  float e = clamp((2.0 * ribbon + 0.8 * smoothstep(0.25, 0.75, f)) * lobes, 0.0, 1.0);
  vec3 lin = uBg + ramp(e) * pow(e, 1.4) * uIntensity;
  vec3 s = mix(lin * 12.92, 1.055 * pow(lin, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, lin));
  s += (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
  gl_FragColor = vec4(s, 1.0);
}
```

The loop around it: one full-screen triangle; `requestAnimationFrame` with a frame-rate gate
(`now − last ≥ 1000 / cap − 2`); `t += min(dt, 1/15) · speed` (Stripe's clamp, so a resumed tab
does not jump); stop the loop entirely when `speed` and every spring are at rest. The spike's
variant had two lobes, and its lobe gains, ribbon gain 2.0 and body gain 0.8 are the values
measured in §4–§6.

---

## Sources

Read in full (primary):

- Apple HIG, Materials — https://developer.apple.com/design/human-interface-guidelines/materials (JSON data, read in full)
- Apple HIG, Motion — https://developer.apple.com/design/human-interface-guidelines/motion (JSON, read in full)
- Apple HIG, Color — https://developer.apple.com/design/human-interface-guidelines/color (JSON, read in full)
- Apple HIG, Dark Mode — https://developer.apple.com/design/human-interface-guidelines/dark-mode (JSON, read in full)
- Apple HIG, Accessibility — https://developer.apple.com/design/human-interface-guidelines/accessibility (JSON, read in full)
- Apple HIG, Loading — https://developer.apple.com/design/human-interface-guidelines/loading (JSON, read in full)
- Apple HIG, Branding — https://developer.apple.com/design/human-interface-guidelines/branding (JSON, read in full)
- Apple HIG, App icons — https://developer.apple.com/design/human-interface-guidelines/app-icons (JSON, read in full)
- Paper Shaders source, `shader-mount.ts`, `mesh-gradient.ts`, CHANGELOG (0.0.81, commit of 2026-09-17) — https://github.com/paper-design/shaders (cloned, read)
- Paper Shaders issue #188, "Mesh Gradient performance" — https://github.com/paper-design/shaders/issues/188 (read through the fetch tool; issue body only)
- Paper Shaders PR #268 — https://github.com/paper-design/shaders/pull/268 (read through the fetch tool)
- whatamesh (copy of Stripe's gradient), `lib/Gradient.js` — https://github.com/jordienr/whatamesh (cloned, read)
- React Bits, `Aurora.tsx` and LICENSE — https://github.com/DavidHDev/react-bits (cloned, read)
- AppleIntelligenceGlowEffect, `IOS.swift` and README — https://github.com/jacobamobin/AppleIntelligenceGlowEffect (cloned, read)
- uicapsule, `liquid-orb` — https://github.com/kyh/uicapsule (cloned, skimmed)
- three.js issue #32726, WebGPURenderer and CSS backdrop-filter — https://github.com/mrdoob/three.js/issues/32726 (read through the fetch tool)
- MDN browser-compat-data 8.1.4 — https://www.npmjs.com/package/@mdn/browser-compat-data (npm package, queried)
- npm registry metadata for `@paper-design/shaders`, `ogl`, `three`, `granim` (`npm view`)
- Recto: `docs/DESIGN.md`, `docs/research/13-glass-and-modes.md`, `docs/research/14-glass-spike.md`, `docs/adr/0001-license.md`, `apps/web/src/styles/tokens.css`, `apps/web/src/styles/tokens.test.ts`, `apps/web/index.html` (CSP)
- Recto research 18, 20, 21 and 22 (verdict sections, read for alignment)

Known only from search abstracts:

- How To Create the Stripe Website Gradient Effect — https://www.bram.us/2021/10/13/how-to-create-the-stripe-website-gradient-effect/ (abstract)
- Kevin Hufnagl, Stripe gradient — https://kevinhufnagl.com/how-to-stripe-website-gradient-effect/ (abstract)
- The gotcha with @property animating custom properties — https://www.bram.us/2023/02/01/the-gotcha-with-animating-custom-properties/ (abstract)
- Aurora UI, new visual trend for 2021 — https://uxdesign.cc/aurora-ui-new-visual-trend-for-2021-c763a7daa7e2 (abstract)
- Aurora UI: the CSS gradient recipe — https://superdesign.dev/styles/aurora (abstract; fetch blocked)
- Animated backgrounds for websites: 6 approaches compared — https://vanta.supply/articles/animated-backgrounds (abstract; fetch blocked)
- How to (and how not to) fix color banding — https://blog.frost.kiwi/GLSL-noise-and-radial-gradient/ (abstract; fetch blocked)
- Shader Advanced: Color Banding and Dithering — https://shader-tutorial.dev/advanced/color-banding-dithering/ (abstract)
- Phaser 4 dev log: gradients and GPU dithering (interleaved gradient noise) — https://phaser.io/news/2026/03/phaser-4-gradients-color-ramps-dithering (abstract)
- Free blue noise textures — https://momentsingraphics.de/BlueNoise.html (abstract)
- I recreated iPhone's Apple Intelligence edge glow on Mac — https://dev.to/vector4wang/i-recreated-iphones-apple-intelligence-edge-glow-effect-on-mac-57f5 (abstract)
- Apple Intelligence UI: colors, glow and design patterns — https://artofstyleframe.com/blog/designing-for-apple-intelligence-ui-2026/ (abstract: about 1.8 s per cycle, no published palette)
- Raycast design system — https://styles.refero.design/style/3b6a17f0-3bdf-418c-a95e-0b89e5a8b2f8 (abstract)
- When iOS throttles requestAnimationFrame to 30fps — https://popmotion.io/blog/20180104-when-ios-throttles-requestanimationframe/ (abstract)
- Page Visibility API — https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API (abstract)
- Compute Pressure Level 1 — https://www.w3.org/TR/compute-pressure/ (abstract)
- Compute Pressure API — https://developer.chrome.com/docs/web-platform/compute-pressure (abstract)
- Shipping WebGPU on Windows in Firefox 141 — https://mozillagfx.wordpress.com/2025/07/15/shipping-webgpu-on-windows-in-firefox-141/ (abstract)
- OffscreenCanvas in Safari (Flutter issue #150801) — https://github.com/flutter/flutter/issues/150801 (abstract)
- Cross-browser paint worklets and Houdini.how — https://web.dev/articles/houdini-how (abstract)
- WebGL drawingBufferColorSpace — https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/drawingBufferColorSpace (abstract)
- Wide gamut 2D graphics using HTML canvas — https://webkit.org/blog/12058/wide-gamut-2d-graphics-using-html-canvas/ (abstract)
- GPU accelerated compositing in Chrome — https://www.chromium.org/developers/design-documents/gpu-accelerated-compositing-in-chrome/ (abstract)

Established knowledge, not verified this session: Chrome's Energy Saver behaviour; how Arc,
Linear and Vercel build their glows; display-pipeline dithering on macOS and laptop panels; the
UHD 620 throughput figure used in the §3 estimate.
