---
title: "Research: glass at the limit — materials, refraction, light and cost on the web"
date: 2026-10-04
status: snapshot
---

> Research snapshot gathered on 2026-10-04 for the M9 redesign. It extends research 13 (glass
> and modes) and 14 (the glass spike) and does not repeat them. Apple's guidance was read from the
> JSON data behind the Human Interface Guidelines and the developer documentation
> (`developer.apple.com/tutorials/data/…`), and the WWDC25 sessions "Meet Liquid Glass" (219)
> and "Get to know the new design system" (356) from the transcripts on their video pages.
> Microsoft's Acrylic recipe was read from `MicrosoftDocs/windows-dev-docs` and the
> `microsoft-ui-xaml` source; browser support from MDN `browser-compat-data` (`main`, read that
> day). Twelve open-source liquid-glass repositories were shallow-cloned and six of them read
> (§4.4, Sources). Measurements come from spike pages run in headless Chromium 141 on SwiftShader in a
> shared 4-core container (§5); they are **trends, not verdicts**. Contrast values were computed
> with the compositing model of research 13 §3, and that model was checked against Chromium's
> real pixels (§6.3). kube.io, bugzilla.mozilla.org, bugs.webkit.org, nngroup.com and apple.com
> were blocked by the egress proxy, and the session's web-search budget ran out midway, so
> claims about the iOS 26 criticism, iOS 27 and some browser bugs rest on search-result
> abstracts or on summaries of GitHub pages, and are marked as such. No file other than this
> report was written.

# Glass at the limit: materials, refraction, light and cost on the web

## 0. Verdict

- **Glass can go on every functional surface, but never on content.** Bars, chips, panels,
  menus, popovers, sheets, toasts and the palette can all be glass. Pages, thumbnails, Home card
  artwork, in-place editors and text inputs cannot. That is exactly Apple's own line ("Don't use
  Liquid Glass in the content layer"), and it is the line Apple retreated to after the iOS 26
  legibility backlash, not a timid version of it.
- **Light is what makes glass visible.** Research 13 found that glass over the flat canvas
  composites to a flat colour. Two things fix it: content moving underneath (pages under the
  frame, research 14) and a light source behind the glass (the lime aurora of research 17, on
  Home and beneath the tool bar). Glass shows the light as a smoked green blur with a lit rim.
  DESIGN §1's "Nothing glows" has to become "only light glows": the aurora and the glass rims,
  nothing else.
- **The white page sets one hard ceiling.** For light text to stay AA (and primary text at 7:1),
  every dark glass must composite to relative luminance ≤ 0.062 over a white page, about
  `#454648`, whatever its tint, alpha or brightness. So over a page all compliant glass looks
  much the same mid-grey smoke, and the only way out of that "slab" is layout: at rest, keep
  pages out from under glass (Apple's steady-state rule). The only free dial is
  **transmission** `k = (1 − alpha) × brightness`: how much of a darker backdrop (canvas,
  aurora) shows through. §7 proposes a ramp from k = 0.21 (chips) to 0.09 (sheets), five
  densities of one material, and every value passes (§6.1, Table 7).
- **Refraction is real but Chromium-only for backdrops.** `backdrop-filter: url(#lens)` renders
  in Chromium 141 (verified here) and nowhere else; Safari and Firefox drop the **whole**
  declaration, blur included, if `url()` is in it. Use it as a progressive enhancement on a few
  fixed-size controls (6 px rim bend), gated in JavaScript, and refract Recto's own control
  content with `filter: url()` (works in all three engines) for selection thumbs.
- **Small glass needs a small blur.** With GPU compositing, Chromium 141 rendered every tier
  exactly as the model predicts, down to a 28 px bar at σ 40. Chromium's software compositor
  (blocklisted GPUs, some VMs) lets the unfiltered page leak in when σ is large against the
  element's height, as research 22 found: a 44 px bar at σ 24 drops secondary text to 3.7:1. So
  keep σ ≤ height / 5 on bars and chips (σ 8–10, close to Apple's measured 5.4 pt), keep large
  blurs for panels and sheets, and start in Tinted when WebGL reports a software renderer (§6.3).
- **Static glass is free; moving things under glass are not.** When nothing on screen changes,
  Chromium draws no frames at all, so glass costs nothing at rest (§5.2). In every frame where
  something changes, the cost grows with the blurred **area** (about +18 % compositor work per
  10 % of the viewport), not with the blur radius. A continuously moving aurora under glass
  therefore costs every frame, for hours; this supports research 17's "still by default, motion
  as an event", and if drift is ever on, updating it at 15 Hz cut GPU time per second by 4×.
- **Apple's own adjustments are the best guide to the limit.** iOS 26.1 added a Tinted option,
  and iOS 27 (WWDC26) added a clear-to-tinted slider, stronger diffusion, a darkened edge and
  brighter specular highlights (abstracts). Recto should copy the endpoint, not the iOS 26.0
  launch look: dense enough to read, a dark outer edge plus a lit inner rim, and an in-app
  three-step Glass setting, Clear · Tinted · Solid (research 22's control).
- **What must not be glass** is short and firm (§7.9): the page and anything drawn on it, text
  fields and editors, thumbnails and Home artwork, tooltips (solid with a glass rim), the dialog
  scrim (dim only), and anything nested inside another glass surface.

---

## 1. What this changes in research 13 and 14

| Research 13 / 14 said | Now | Why |
|---|---|---|
| Glass only works where content moves behind it (13 §0) | Content moving **or a light source** behind it | The aurora (research 17) gives Home and the tool bar's surroundings structure and colour. Apple's large surfaces show "light from colorful content nearby" spilling onto them (WWDC25 219). |
| Three tiers: floating, docked frame, menus (13 §4.1) | Five densities M1–M5 of one material, plus the aurora field M0 | The redesign puts glass on sheets, toasts, chips and phone sheets too. Apple scales the material with size ("thicker" when glass grows into a menu). |
| Tier 1 must keep its 1.27:1 separation from the canvas (14 §4.3) | Separation comes from the rim and the aurora, so the tint may sink towards the canvas | iOS 27 replaced the iOS 26 hairline with a darkened edge and brighter specular (abstract). §7.4 gives a rim that reads over white, canvas and aurora. |
| Accent 3:1 against tier 1 over white was the binding constraint (14 §4.3) | Still binding for the blue accent; if the colour track picks a light (lime) accent, primary text at 7:1 binds instead | Table 7: a lime accent clears 7:1 on every tier. |
| Tooltips and toasts stay opaque (13 §4.3) | Toasts become M2 glass; tooltips stay solid but get the glass rim | Toasts are small floating bars. Tooltips appear often and must read instantly; a solid fill reads the same over any backdrop and costs nothing. |
| Geometry gate removed, frame always blurs (14 §6) | Blur is free when nothing moves; what costs is motion under glass, so light behind glass stays still unless an event moves it | §5.2 static scenes draw zero frames; §5.5 |
| Blur radii 28–40 px on bars (13 §4.1, today's tokens) | σ ≤ height / 5 on bars and chips (8–10 px); large σ only on surfaces taller than about 200 px | §6.3: the model holds on GPU compositing at any size; the software compositor leaks the page in under short, strongly blurred glass (research 22 §3.2) |
| No adaptive tint (13 §3) | Still no adaptive tint | Unchanged: the luminance cap already guarantees contrast, and a light/dark flip mid-scroll is a visible jump. Apple flips only small elements, and never sidebars or menus (WWDC25 219). |

---

## 2. Apple Liquid Glass, from the primary sources

### 2.1 The material

From "Meet Liquid Glass" (WWDC25 219, transcript read in full) and the HIG Materials page:

- **Layers.** Lensing (light is bent and concentrated at the edge rather than scattered),
  highlights from light sources that "respond to geometry" and sometimes to device motion,
  an adaptive shadow, and a tint whose "dynamic range shift[s]" to keep labels legible. On
  touch the material "illuminates from within", starting under the finger.
- **Adaptive shadow.** "The element … increases the opacity of its shadow when it is over text.
  Conversely, it lowers the opacity of its shadow when it is over a solid light background."
- **Size.** Small elements (nav bars, tab bars) flip between light and dark with the backdrop.
  "Bigger elements, like menus or sidebars … don't flip from light to dark. Their surface area
  is too big and transitions like these would be distracting." When glass grows (a menu from a
  toolbar button) "it casts deeper, richer shadows, has more pronounced lensing and refraction
  effects, and a softer scattering of light". HIG Color: "Liquid Glass appears more opaque in
  larger elements like sidebars."
- **Variants.** *Regular* "blurs and adjusts the luminosity of background content"; use it
  wherever there is significant text (alerts, sidebars, popovers). *Clear* is "permanently more
  transparent", has no adaptive behaviour, and is allowed only when the element is over
  media-rich content, a dimming layer will not hurt the content, and the content on top is bold
  and bright. For bright backdrops the HIG gives a number: "consider adding a dark dimming layer
  of 35% opacity". The two "should never be mixed".
- **Glass on glass.** "Always avoid glass on glass … use fills, transparency, and vibrancy for
  the top elements to make them feel like a thin overlay that is part of the material."
- **Steady state.** "In steady states, such as when an app first launches, avoid intersections
  between content and Liquid Glass." Recto's Read view already fits pages in the rectangle the
  chrome leaves free (14 §2); keep that rule for every view.
- **Motion.** Glass "materialize[s] in and out by gradually modulating the light bending and
  lensing" instead of fading; a menu "pops open" from its button; controls "morph" between
  states on "a singular floating plane". Reduce Motion "disables any elastic properties".
- **Accessibility modifiers.** Reduce Transparency makes the glass "frostier"; Increase Contrast
  makes elements "predominantly black or white" with "a contrasting border". The HIG's
  Reduce Motion list adds "avoiding animating into and out of blurs".
- **Performance.** "Creating too many Liquid Glass effect containers and applying too many
  effects to views outside of containers can degrade performance. Limit the use of Liquid Glass
  effects onscreen at the same time" (Applying Liquid Glass to custom views). A
  `GlassEffectContainer` renders several shapes as one, which also lets them merge and morph.

### 2.2 Shapes and layout

- **Three shape types** (WWDC25 356): *fixed* (constant radius), *capsule* (radius = half the
  height) and *concentric* (radius = parent radius − padding), with "a concentric shape with a
  fallback radius" for components used both nested and alone. On macOS, Mini to Medium
  controls stay rounded rectangles because capsules suit touch layouts, "but in dense desktop
  environments, they're best used for standout actions".
- **Toolbars:** "standard buttons … have corner radii that are concentric with bar corners";
  at most three groups; "Reduce the use of toolbar backgrounds and tinted controls" and use
  the scroll edge effect instead of a solid backing.
- **Scroll edge effects:** a *soft* effect "gently dissolves the content into the background"
  under a bar, switching to "a subtle dimming" over dark content; a *hard* effect is uniform
  across the bar plus pinned accessory views. visionOS uses "a variable blur in the bar
  background".
- **Content under chrome:** extend full-bleed backgrounds under sidebars and toolbars; where
  that hides content, a background extension effect mirrors and blurs the adjacent content.
- **Sheets:** "half sheets are inset from the edge of the display to allow content to peek
  through … When a half sheet expands to full height, it transitions to a more opaque
  appearance" (Adopting Liquid Glass).
- **Colour on glass:** "Apply color sparingly … To emphasize primary actions, apply color to
  the background rather than to symbols or text"; prefer a monochrome toolbar over colourful
  content.

### 2.3 Measured numbers (third party)

Apple publishes no material constants. The `ios27-design-system` repository solved them from a
simulator screenshot of `.glassEffect` over known colour bands (iOS 26.5, iPhone 17 Pro, light
appearance), fitting a Gaussian step to get the blur:

| | Veil alpha (mean) | Blur σ | CSS equivalent |
|---|---|---|---|
| `.regular` | 0.729 (tint about `rgb(248 243 239)`) | 5.4 pt | `rgb(255 255 255 / 0.72)` + `blur(5.4px)` |
| `.clear` | 0.075 | 1.4 pt | `rgb(255 255 255 / 0.075)` + `blur(1.4px)` |

Two things follow. Apple's regular glass is a **72 % veil with a small blur**, not a 20–40 px
frost: the "glassy" web demos copy *clear*, a variant Apple restricts to media. And the
repository found saturation is chroma-dependent (≈0.8 for grey, 2.4 for magenta), which a single
`saturate()` cannot reproduce. Its figures for the iOS 27 kit's dark regular glass are a
`#1a1a1a` fill at 0.7, a 48 pt shadow at 0.45, and corner radius 34 pt for large glass. The
kit draws the iOS 27 edge as "zero-blur drop shadows with positive spread" (a light grey ring,
`#a6a6a6` in dark) plus dark top and bottom inner shadows, while Apple's keynote wording is "a
darkened edge" (abstract); Recto's rim (§4.3) uses both a dark outer edge and a light inner
rim. Simulator and Figma approximations, not device measurements; treat as indicative.

The same repository measured that CSS `blur(L)` uses L as the **standard deviation** in
Chromium (σ/L = 0.97–0.985). Blur values in this document are standard deviations.

### 2.4 The criticism and Apple's retreat

| When | What | Source quality |
|---|---|---|
| June 2025, iOS 26 beta 1 | Notification Center and Control Center hard to read; beta 2 raised opacity and blur of Control Center | Abstracts (MacRumors guide, Wikipedia) |
| Sept 2025 | Users criticise legibility "particularly in low-contrast conditions such as direct sunlight" and animation lag | Abstract (MacRumors) |
| Oct 2025 | NN/g, "Liquid Glass Is Cracked, and Usability Suffers in iOS 26": translucent controls over busy backgrounds, crowded tab bars, small targets | Abstract (anderegg.ca, HN) |
| Nov 2025, iOS 26.1 | Settings → Display & Brightness → Liquid Glass: **Clear** or **Tinted** ("increases opacity and adds more contrast") | Abstracts (Engadget, MacRumors, TechCrunch) |
| Nov 2025 – Feb 2026, macOS Tahoe | Sidebar search field "incomprehensible" over scrolled content; Reduce Transparency broken in 26.1–26.2, working again in 26.3 | Abstracts (Eclectic Light, OSXDaily) |
| June 2026, iOS 27 (WWDC26) | Continuous slider "from ultra clear to fully tinted"; "stronger diffusion"; "a darkened edge around Liquid Glass elements, along with brighter specular highlights"; reduced default transparency; uniform toolbar when content scrolls under it; gyroscopic icon shimmer removed | Abstracts (MacRumors 2026-06-10, BGR, urdesignmag) and the ios27-design-system notes |

**Lessons for Recto.** (1) Legibility over busy content, not the material itself, drew the
criticism; text-heavy surfaces need density. (2) Every Apple fix moved towards *more* diffusion,
a defined edge and user control. (3) A setting is expected: Apple went from a binary
accessibility switch to Clear/Tinted to a slider within a year. (4) Motion-driven light
(gyroscope shimmer) was removed from the most-seen surface, the icons.

---

## 3. Other systems, briefly

- **visionOS.** Windows use one "unmodifiable" glass that "limits the range of background color
  information so a window can continue to provide contrast" and adapts to the luminance behind
  it, with no separate dark mode. Buttons on glass use the *thin* material; specular
  reflections and shadows communicate "scale and position" (HIG Materials, Windows). The
  "limits the range" phrasing is the same idea as Recto's brightness cap.
- **Windows Acrylic** (`acrylic.md`, read in full; `AcrylicBrush.h`): the recipe is background
  → blur → exclusion blend → tint → **noise**; WinUI's constants are `sc_blurRadius = 30.0f`
  and `sc_noiseOpacity = 0.02f`. Acrylic is for transient, light-dismiss surfaces; "Avoid
  layering multiple acrylic surfaces"; no edge-to-edge acrylic panes (seams); it switches off
  in Battery Saver, with Transparency effects off, and on low-end hardware. Mica (long-lived
  base surfaces) samples the wallpaper once and is effectively opaque.
- **Material 3** has no translucent material (research 13).

Lesson: both desktop vendors switch the material off under power or capability pressure, and
both add grain. Recto has no battery signal on most browsers, so it needs its own
frame-time-based degrade (G-23).

---

## 4. Web mechanics in 2026

### 4.1 Support

| Feature | Chromium | Safari | Firefox | Source |
|---|---|---|---|---|
| `backdrop-filter` (blur, saturate, brightness, contrast) | 76 | 18 unprefixed, `-webkit-` since 9 | 103 (all GPUs from 123) | BCD |
| `backdrop-filter: url(#svg-filter)` | Renders (verified in 141 here) | Dropped silently (WebKit bug 245510; a software-path patch, PR 68614, open and unmerged on 2026-09-20) | Parsed, renders nothing (bug 1995195, abstract) | §4.2 |
| `filter: url(#svg-filter)` on HTML (displacement on an element's own pixels) | Yes | Yes, with caveats (§4.4) | Yes | samasante `BROWSERS.md` |
| `corner-shape: squircle` / `superellipse()` | 139 | Technology Preview only | Nightly/preview only | BCD |
| `@property` (animatable custom properties) | 85 | 16.4 | 128 | BCD |
| `prefers-reduced-transparency` | 118 | No | Behind a pref | Research 13 |
| `mask-image` unprefixed | 120 | 15.4 | 53 | BCD |

**The Safari prefix and `var()`.** An open BCD issue (#25914) reports that on Safari 18.3 the
unprefixed property did not work and `-webkit-backdrop-filter` worked **only with literal
values**, not with `var()`. Recto's `global.css` writes `-webkit-backdrop-filter:
var(--glass-filter)` (line 157) and `var(--glass-frame-filter)` (line 229). This is unverified
here (no WebKit in the container) but cheap to make safe: write literal filter values per tier
class on the prefixed line (G-22), and check on the owner's Safari.

### 4.2 The declaration-drop trap

A `backdrop-filter` value is one declaration. If an engine rejects one function in it, the whole
declaration is dropped. Safari and Firefox reject `url()` there, so `backdrop-filter: url(#lens)
blur(12px) saturate(1.8)` gives them **no blur at all**, a fully transparent panel (huozhi/vaso
#11, read via a fetch summary). `@supports (backdrop-filter: url(#a))` does not help: Firefox
parses it as valid (abstract, buildmvpfast). Two safe patterns:

1. **Engine-gated single layer** (preferred): the base rule carries the blur recipe for every
   engine; only when JavaScript has identified Chromium (`navigator.userAgentData?.brands`
   contains "Chromium") does a class add `url(#lens)` to the front of the list.
2. **Split layers**: a lens layer with only `url()` under a sibling blur layer. It works without
   detection but costs a second backdrop pass (§5.3).

### 4.3 Rim, edge and specular in CSS

- **Darkened edge** (iOS 27): an outer `0 0 0 0.5px rgb(0 0 0 / 0.55)` ring holds the shape over
  a white page; Recto's `--elevation-float` already has a 1 px black ring at 0.5.
- **Lit rim:** a pseudo-element with `padding: 1px`, a top-weighted linear gradient, and
  `mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite:
  exclude` (the technique in liquid-glass-react's border layers). Unlike `border-image` it
  follows `border-radius` and `corner-shape`, and it does not tint the body as a border-box
  background under a translucent fill would.
- **Inner light:** `inset 0 1px 0 rgb(255 255 255 / 0.12)` (top) and `inset 0 -1px 0
  rgb(255 255 255 / 0.04)` (bounce) give the "lit from above" read at no cost.
- **Grain:** a static 128 × 128 monochrome noise tile as a second background layer at 2–3 %
  (WinUI uses 0.02) removes 8-bit banding in large blurred gradients. A live `feTurbulence`
  filter does the same at a high per-frame cost; never use it live.

### 4.4 Four ways to refract on the web

| Approach | How | Engines | What it bends | Fit for Recto |
|---|---|---|---|---|
| A. Backdrop lens | `backdrop-filter: url(#f)` with `feImage` (map) + `feDisplacementMap` (Shu Ding's `liquid-glass.js`, kube.io's article) | Chromium only | The live backdrop: pages, aurora | Progressive enhancement on a few fixed-size controls (G-8) |
| B. Filter on a blurred layer | A child with `backdrop-filter: blur()` and `filter: url(#f)` (liquid-glass-react) | Displacement Chromium only; Safari/Firefox show blur (its README) | The blurred backdrop | No: same reach as A, more layers |
| C. Own-content lens | `filter: url(#f)` on the element whose pixels are bent (samasante/liquid-glass; Aave's technique per glass-of-web) | All three, with WebKit fixes: render at 1×, regenerate the map only when the **shape** changes, bump the filter id on each change | Recto's own DOM under a control | Yes, for selection thumbs over labels (G-9) |
| D. WebGL snapshot | Rasterise the page into a texture, refract in a shader (liquidGL 3.0) | All, WebGPU/WebGL | A **stale** snapshot; "unstable" in Safari above 50 % of the viewport (its README) | No: page bitmaps change on every zoom and scroll |

**Lens maps.** All working implementations encode a displacement field from a rounded-rect
signed distance: red and green hold x/y around 128, and only a band near the rim bends (kube.io:
a convex-squircle bezel refracted with Snell's law, n = 1.5, abstract). The production values
glass-of-web lifted from Aave are small: **4 px** for a 36 px slider thumb, **5 px** for a
104 × 64 toggle group, **8 px** for a 64 px switch, 15 px for a 200 px hero lens, with chromatic
spread "SUBTLE: ±4–8 % around base scale". samasante warns that one stretched map on a very wide
bar "blooms an oval"; a map computed at the bar's exact size and bending only the rim avoids
that. This spike built such a map (`lens.js`: 14 px bezel, up to 18 px pull, convex profile).
Chromium 141 bent only the rim; the centre pixels were identical to the unfiltered backdrop
(§6.3).

### 4.5 Light and motion techniques

| Technique | Mechanism | Cost class (§5) | Use |
|---|---|---|---|
| Pointer-following rim light | JS writes `--px/--py` (rAF-throttled); a `radial-gradient(160px circle at var(--px) var(--py), …)` on a pseudo-element | Repaints the pseudo-element each pointer frame | Fine pointers only, within 120 px of the control (G-26) |
| `@property` sheen | Register `--ang` as `<angle>`, animate a `conic-gradient(from var(--ang) …)` rim | Repaint every frame while it runs | One-shot on materialize or morph only (G-27) |
| Press glow | Radial gradient at the press point, opacity 0 → 0.12 → 0 | One short repaint | Every glass control (G-26) |
| Gooey merge | `feGaussianBlur` + alpha-threshold `feColorMatrix` | Filters the element's own pixels | Not for glass: it cannot shape a backdrop-filter region. Use one element that morphs (G-13) |
| Morph by `clip-path` | A glass element at its final size revealed by animating `clip-path: inset(… round r)` | §5.4 | Menus and popovers growing from their button |
| `corner-shape: squircle` | Superellipse corners; Chromium 139+ | Free; verified that the blurred backdrop is clipped to the squircle (§6.3) | Panels, menus, sheets (not capsules) with radius × 1.8 (G-20) |

The backdrop-root rule from research 13 still holds: an ancestor with `opacity < 1`, `filter`,
`mask` or its own `backdrop-filter` makes descendants blur only that ancestor's pixels. Animate
opacity on the glass element itself, never on a wrapper.

---

## 5. Cost

### 5.1 Method

Spike pages in the session scratch folder `scratchpad/m9/glass/spike/` (not in the repository;
`harness.mjs`, `scenes*.mjs`, `run3.mjs`, `pixels.mjs`, `vis2.mjs`, `look.mjs`, `lens.js`): a column of fourteen
816 × 1056 pages (text, and a striped and coloured image block on every second page) on the
`#08090b` canvas at 1440 × 900, DPR 1. Headless Chromium 141 with GPU compositing on SwiftShader
(`--use-angle=swiftshader --enable-gpu-rasterization`), so every pixel of GPU work runs on the
CPU. Each scene ran 120 frames after a warm-up; scrolling scenes moved the column 24 px per frame
back and forth inside an already rastered range, so new tile raster does not pollute the result.
A Chromium trace gave the GPU main thread's busy time per drawn frame (almost all of it is the
SwiftShader flush at swap). Every round measured the reference scene before and after the other
scenes, and each result is reported as a **ratio to that round's reference**, median of four
rounds, so the load from parallel jobs (load average 1–7 on 4 cores) cancels out.
Reference for scrolling scenes: the bare page column. Reference for idle scenes: the same page
with one 4 px animated square, which forces 60 frames per second of near-zero work.

SwiftShader is a CPU rasteriser: absolute times are far above a real GPU's (by a factor not
measured here), and its costs do not model a mobile GPU's memory-bandwidth limits. Read the **ratios and their order**,
not the milliseconds.

### 5.2 Blur: area matters, radius barely does

Scrolling the page column under glass (reference: the same column with no glass, 42.6 ms of
SwiftShader GPU time per frame, n = 8, range 42.0–44.2). "Area" is the share of the 1440 × 900
viewport that is blurred. Every surface uses the tier-1-like recipe `rgb(40 43 50 / .66)` with
`saturate(1.8) brightness(.5)` and the stated blur.

| Scene | Surfaces | Area | σ | GPU work vs no glass, median [min–max] of 4 |
|---|---|---|---|---|
| Floating bar 800 × 64 | 1 | 4 % | 8 | 1.15 [1.13–1.18] |
| Floating bar 800 × 64 | 1 | 4 % | 24 | 1.10 [1.05–1.20] |
| Floating bar 800 × 64 | 1 | 4 % | 48 | 1.10 [1.06–1.14] |
| Four capsules 560 × 52 | 4 | 9 % | 24 | 1.28 [1.23–1.37] |
| Eight capsules 560 × 52 | 8 | 18 % | 24 | 1.53 [1.50–1.59] |
| Side panel 320 × 828 | 1 | 20 % | 8 | **1.73** [1.69–1.82] |
| Side panel 320 × 828 | 1 | 20 % | 24 | 1.36 [1.35–1.37] |
| Side panel 320 × 828 | 1 | 20 % | 48 | 1.39 [1.36–1.39] |
| Docked frame: title, two panels, status (research 14's layout) | 4 | 46 % | 24 | 1.85 [1.78–2.10] |
| Docked frame + floating bar | 5 | 50 % | 24 | 1.97 [1.90–2.07] |
| Full-viewport sheet | 1 | 100 % | 24 | 2.80 [2.71–2.87] |
| **Nothing moving** (static page, docked frame + bar) | 5 | 50 % | 40 / 28 | **No frames drawn** (run 1) |

Reading:

1. **Cost follows blurred area**, roughly `1 + 1.8 × area + 0.04 per extra surface` in this
   setup. Eight capsules cost more than one panel of the same area: every surface is its own
   render pass and backdrop read-back.
2. **Radius is nearly free above σ ≈ 16, and small blurs on large surfaces are the expensive
   case.** σ 8 on the panel cost more than σ 24 or 48 (1.73 against 1.36–1.39). Skia's GPU blur
   downsamples for large sigmas, so a large blur is computed on fewer pixels (established
   knowledge about Skia, consistent with this result). Never put a small blur on a large surface
   (σ ≥ 16 above about 200 px of height, Table 7). On a bar the radius made no difference
   (1.10–1.15), so small surfaces can take the small blurs that §6.3 asks of them.
3. **At rest, glass is free.** With nothing changing, Chromium produced no frames at all. Cost
   appears only in frames where something changes. Research 14's slower tail in Arrange appeared
   while the light table scrolled beside the frame; whether Chromium re-filters a backdrop when
   the damage lies outside it was not isolated here.

### 5.3 Refraction

The 800 × 64 bar over the scrolling column, same reference.

| Variant | GPU vs no glass | Renderer main thread per frame |
|---|---|---|
| `blur(12px) saturate(1.8) brightness(.5)` | 1.05 [1.03–1.14] | 0.8 ms |
| `url(#lens)` only | 1.07 [1.03–1.10] | 3.2 ms |
| `url(#lens) blur(12px) …` in one declaration | 1.14 [1.10–1.17] | 3.2 ms |
| Split: lens layer + sibling blur layer | 1.17 [1.12–1.24] | 3.3 ms |
| `filter: url(#lens)` on a blurred layer (liquid-glass-react) | 1.16 [1.14–1.18] | 3.4 ms |

The lens adds about 9 % GPU work on a 4 % surface, and the split-layer pattern costs another
3 %. The larger signal is the **main thread**: with a reference filter on screen it did about
four times the work per scrolled frame (3.2 against 0.8 ms), which suggests Chromium re-runs part
of the paint pipeline for the SVG filter on every frame. Recto's main thread also runs React and
the viewer's scheduling, so this caps the lens at a few small surfaces. Verify on real hardware
with the Performance panel before shipping G-8.

### 5.4 Moving glass

A static page with one moving element (reference: the page with a 4 px animated square, 16.6 ms
per frame, which isolates "drawing a frame at all").

| The moving element (800 × 64 unless noted) | GPU vs reference |
|---|---|
| Opaque-ish tinted bar, `transform: translateX` | 1.16 [1.15–1.21] |
| Glass bar (σ 28), `transform: translateX` | 1.29 [1.20–1.31] |
| Glass bar, `width` 300 → 800 px | 1.19 [1.17–1.21] |
| Glass bar, `transform: scale` 0.4 → 1 | 1.17 [1.13–1.25] |
| Glass menu 280 × 380 (σ 32), `clip-path: inset(… round)` reveal | 1.25 [1.23–1.35] |
| Glass bar, `border-radius` 32 → 8 px | 1.35 [1.30–1.36] |

Moving a glass element costs only about 10 % more than moving a tinted one; the differences
between transform, width, scale and `clip-path` are small at these sizes. Animating
`border-radius` was the most expensive. In Recto, `width` also re-lays out the bar's React
subtree, which this spike does not model; prefer `transform` and `clip-path` (G-13).

### 5.5 The aurora under glass

Static page; the aurora is the only thing that moves. "+ glass" adds a frame of title bar,
inset navigator panel (292 × 812) and status bar (σ 40) and an M2-like bar (σ 24): four
surfaces, about 30 % of the viewport.

| Aurora implementation | Alone | + glass | Frames drawn in 120 |
|---|---|---|---|
| Three 1100 px pre-blurred OKLCH radial gradients, moved by CSS `transform` | 2.01 [1.97–2.11] | 3.66 [3.61–3.71] | 120 |
| The same shapes as solid circles with `filter: blur(140px)`, moved by `transform` | **6.59** [6.47–6.68] | — | 120 |
| Gradient positions animated through `@property` (repaint every frame) | **6.28** [6.12–6.37] | **7.84** [7.71–8.01] | 120 |
| A 180 × 112 canvas (1/8 scale) redrawn every frame, CSS-scaled to full size | 1.78 [1.69–1.79] | 3.46 [3.26–3.49] | 120 |
| The same canvas redrawn at **15 Hz** | — | 3.35 per drawn frame | **30** |

Reading:

1. `filter: blur()` on moving shapes and `@property`-driven repaints cost three times as much
   as moving pre-blurred gradients. Never build the aurora either way.
2. Glass over a moving aurora roughly doubles the aurora's own cost, because every glass
   surface is re-filtered every frame.
3. **Updating the aurora at 15 Hz instead of 60 Hz cut the GPU time per second by about 4×**
   (30 drawn frames instead of 120 at the same cost each). At 23–37 s periods a blob moves at
   most about 35 px per second, so a 15 Hz step is about 2 px on a gradient several hundred
   pixels wide. That should be invisible, but it is a hypothesis to check by eye on the owner's
   screen.

### 5.6 Light effects

Same static reference.

| Effect on one 800 × 64 glass bar | GPU vs reference |
|---|---|
| `@property` conic sheen on the rim, looping (6 s) | 1.61 [1.59–1.70] |
| Pointer-following radial light, updated every frame | 1.44 [1.43–1.46] |

Both are repaints of a small area every frame, so they keep the compositor busy for as long as
they run. That is why the sheen is a one-shot and the pointer light runs only while the pointer
is near the control (G-26, G-27).

### 5.7 Higher density and phone size

Two smaller runs (two and three rounds). Their references behaved oddly: the no-glass scrolling
reference cost **less** GPU time at DPR 2 (17.0 ms per frame) and at a 390 × 844 viewport at
DPR 3 (5.0 ms) than at 1440 × 900 at DPR 1 (42.6 ms), which this method cannot explain, so the
ratios are not comparable across densities. The **added** milliseconds per frame are:

| Scene | DPR 1 (§5.2) | DPR 2 |
|---|---|---|
| Floating bar 800 × 64, σ 24 | +4.2 ms | +4.9 ms |
| Side panel 320 × 828, σ 24 | +15.4 ms | +17.5 ms |
| Docked frame, σ 24 | +36.7 ms | +39.0 ms |
| Full-viewport sheet, σ 24 | +77.2 ms | +78.1 ms |

At four times the device pixels the blur added about the same time for the same CSS area. That
fits Skia scaling its downsampling with the sigma in device pixels; it suggests DPR is not the
multiplier one might fear, but it needs confirming on a real Retina machine (research 14 §4.1).

Phone size (390 × 844, DPR 3, page column scrolling): a 358 × 56 bottom bar (σ 20, 6 % of the
screen) added nothing measurable (0.96 [0.90–1.14] of the reference); an inset sheet at the
medium detent (374 × 420, σ 32, about half the screen) added 12.9 ms per frame (3.52×). On
phones the sheet, not the bar, is the expensive glass, and only while content moves under it.

### 5.8 What could not be measured

GPU memory (not exposed to a headless page; research 14 §3.3 has the manual method), real
mobile GPUs, Safari's Core Animation backdrop path and Firefox's WebRender path. Public sources
on mobile cost are mostly unmeasured advice ("cap blur under about 20 px on large surfaces",
"three or four glass layers per viewport", abstracts in Sources); one public fix found that
`will-change: backdrop-filter` caused severe frame drops on iOS WebKit (guitarbeat PR, abstract).
Recto's own `glass-perf.spec.ts` and research 14 §4.1 remain the way to get real numbers.

---

## 6. Contrast at the limit

### 6.1 The ceiling over a white page

With the compositing model of research 13 §3, `result = a·tint + (1 − a)·b·sat(backdrop)` per
channel. For light text the worst backdrop is the brightest one. Over a white page the
composite must stay at or below:

| Text or mark | Requirement | Max luminance of the composite |
|---|---|---|
| `--text-primary #e6e7ea` | 7:1 (kept above AA on glass for 11–13 px labels) | 0.0707 |
| `--glass-text-secondary #bcc0c6` | 4.5:1 | 0.0767 |
| Accent `#7c8cff` as an armed-tool fill | 3:1 (WCAG 1.4.11) | **0.0667** |
| A lime accent (e.g. `#c6f24a`), if adopted | 3:1 | 0.23 (not binding) |

So with today's accent every tier must composite to L ≤ 0.062 over white (a small margin under
0.0667), about `#454648`. **That ceiling does not depend on the recipe.** What the recipe
chooses is the split between the tint's own body and what passes through:

```
composite(white)  = a·T + k·255          k = (1 − a)·b   ("transmission")
composite(canvas) = a·T + k·8            (canvas #08090b)
composite(white) − composite(canvas) ≈ 247·k
```

With the white composite pinned near `#45`, a glass that transmits more (higher k) must have a
darker body over the canvas, and vice versa. Today's tier 1 (k = 0.153) has a visible body over
the canvas (`#212328`) and passes little aurora; a k = 0.22 glass is almost invisible over the
bare canvas but shows the aurora strongly. Rim and shadow, not the body, then carry the shape
(G-5). Table 7 picks a ramp.

### 6.2 The aurora as a backdrop

- **White still binds.** The brightest aurora colours proposed here, lime `#bff538`
  (oklch 0.90 0.21 125, L = 0.76) and yellow-green `#ecf33c` (oklch 0.93 0.19 112, L = 0.83),
  are darker than white, and `saturate()` keeps Rec. 709 luma except where channels clip
  (checked: §6.3, lime row). So the white-page proof covers the aurora, whatever it does.
- **Page primacy.** DESIGN §1 keeps "the document is the brightest thing". Lime composited over
  the canvas reaches L = 0.26 at 60 % and 0.36 at 70 %; the white page then stands 3.4:1 and
  2.6:1 above the brightest light. Research 17 keeps the field off the document stage, in Arrange
  and in Compare; wherever light and a page still share the screen (the drop overlay, the bar's
  under-light), keep the brightest light at least 2.5:1 below the page (G-15).
- **The olive trap.** Fading lime towards transparent in sRGB over near-black passes through
  `#647f22` at 50 %: khaki, not light. Three renders of the same composition (sRGB fade, OKLCH
  fade, OKLCH with a hue turn) showed the fix: interpolate in OKLCH, let the falloff turn
  towards emerald (hue 142–165) before it reaches transparent, and keep yellow hues out of the
  falloff entirely, since a dimmed yellow is olive in any colour space. §7.7 gives the stops
  (G-16). Gradient interpolation in OKLCH is supported in current Chromium, Safari and Firefox
  (established knowledge).
- **What glass shows of it.** Through M2 (k ≈ 0.20) a lime core arrives as `#334515`, a dim
  green smoke; through M5 (k = 0.09) as `#313927`. The aurora reads most vividly around glass and
  through chips, as it should: glass "defers" to what is behind it.

### 6.3 The model matches Chromium

Glass tiles over flat colours, screenshotted in Chromium 141 and sampled at the centre, against
the model:

| Recipe | White | Grey `#808080` | Canvas | Black | Lime `#bff538` |
|---|---|---|---|---|---|
| Today's tier 1, rendered | `#47494d` | `#34363a` | `#212328` | `#202226` | `#3a4926` |
| Today's tier 1, model | `#47494d` | `#33353a` | `#212328` | `#202226` | `#394926` |
| Today's frame tier, rendered | `#36383d` | `#26282d` | `#181a1f` | `#17191e` | `#2d381e` |
| Today's frame tier, model | `#36373c` | `#27282d` | `#181a1f` | `#17191e` | `#2d371e` |
| `rgb(14 15 18 / .45)` + `blur(24px) saturate(1.8) brightness(.45)`, rendered | `#454647` | `#262728` | `#08090b` | `#060708` | `#304608` |
| same, model | `#454647` | `#262628` | `#08090b` | `#060708` | `#304608` |

Every channel agrees within 1/255, including the lime column, where `saturate(1.8)` clips. The
same page confirmed three more facts in Chromium 141: `backdrop-filter: url(#lens)` bends only
where the map says (centre rows identical to the bare backdrop, rim displaced); the blurred
backdrop is clipped to a `corner-shape: squircle` outline (a probe inside the squircle but
outside the round curve was dark with squircle, white without); and `clip-path: inset(… round
r)` clips the backdrop output. `tokens.test.ts` can keep using this model with confidence (G-28),
with one condition, below.

**Short glass and the software compositor.** Research 22 (§3.2) measured, on Chromium's CPU
renderer, that glass short relative to its blur renders lighter than the model, because the
blurred backdrop loses coverage at the element's edges and the unfiltered page shows through.
The same test here, with the tiers of Table 7 over white, centre pixel:

| Surface | σ | GPU compositing (SwiftShader) | Software compositor | Secondary text, software |
|---|---|---|---|---|
| M1 chip 120 × 40 | 16 | `#444548` (model) | `#535457` | 4.14 ✗ |
| M1 chip 44 × 44 | 16 | `#444548` | `#595a5d` | 3.77 ✗ |
| M2 bar 600 × 44 | 24 | `#454648` (model) | `#5a5b5d` | 3.72 ✗ |
| M3 status bar 1000 × 28 | 40 | `#434449` (model) | `#626368` | 3.28 ✗ |
| M3 panel 300 × 600 | 40 | `#434449` | `#434448` | 5.34 |
| M4 menu 280 × 360 | 32 | `#424347` | `#424347` | 5.41 |
| M5 sheet 560 × 400 | 48 | `#38393e` | `#38393e` | 6.30 |
| M1 chip 120 × 40, filter on an element oversized by 3σ and shaped with `mask` (research 22's fix) | 16 | `#444548` | `#444548` | 5.25 |

The same oversized-mask construction on 600 px and 1000 px wide bars rendered solid black on both
paths in this harness, unexplained; research 22 measured it working on a 436 px bar, so test it
in the real app before relying on it. So the GPU path follows the specification (mirror edges)
and the model holds at every size; the software path does not. Real users reach the software compositor on blocklisted GPUs and drivers,
in some virtual machines and after repeated GPU process crashes (established knowledge). Recto
cannot rule that out, so: σ ≤ height / 5 on short surfaces (research 22 measured that this
matches the model on the CPU path: 44 px at σ 8, 28 px at σ 4), the oversized masked layer where
a stronger frost is wanted, and a start in Tinted when WebGL's unmasked renderer names a software
rasteriser (SwiftShader, llvmpipe, "Software", Microsoft Basic Render Driver) (G-32).

### 6.4 If a light theme comes back

Recto ships dark only. For light glass the worst backdrop is **black** (a dark photo in a PDF),
and dark text needs a floor, which `brightness()` cannot give. `contrast(0.45) brightness(1.4)`
in the filter chain does: it maps black to 0.385 and white to 1.0. Even then, over black a
`#f6f7f9 / 0.55` bar reaches only `#b3b4b5`, enough for primary text (8.1:1) but not for a
`#55585f` secondary (3.4:1) or a mid-blue accent (3.1:1). Light glass forces the secondary text
to about `#45474c`, which nearly erases the text hierarchy. Without a floor, a white veil must
reach alpha 0.72 before a mid-grey secondary label (`#4a4c52`) is AA over black, which is
exactly Apple's measured regular veil (§2.3). A light theme with glass is possible but is a separate
design problem (G-25).

### 6.5 Scrims and scroll edges

- **Scroll edge (soft).** A 40 px gradient from `--surface-0` at 0.85 to transparent, under the
  title bar and above the bottom bar, pointer-transparent, over the stage. It darkens what the
  glass samples near its edge at zero cost, which is Apple's soft scroll edge effect (G-19).
- **Hard edge** for pinned headers (Compare's column headers, Arrange's group headers): a uniform
  band, Apple's "hard style".
- **Dialog scrim:** dim only, `rgb(5 6 8 / 0.50)`, no backdrop blur; the M5 sheet blurs its own
  area. Apple's clear-glass guidance ("a dark dimming layer of 35% opacity") is the floor for
  bright content (G-31).

---

## 7. A material system for Recto

### 7.1 Principles

1. One material, five densities, M1–M5. No clear variant in the app (Apple: never mix; clear
   only over media).
2. Bigger is denser: transmission falls from 0.21 (chips) to 0.09 (sheets).
3. Every tier composites to L ≤ 0.062 over white; tested, not eyeballed.
4. The tint stays neutral; colour on glass comes only from light behind it (the aurora) and
   from one prominent action per surface (Apple: tint the background of the primary action).
5. Shape is carried by the rim (dark outer edge + lit inner rim) and the shadow, not the body.
6. Glass never animates its filter; it moves, scales, clips and fades.

### 7.2 The tiers

Table 7. Proposed tiers (dark theme). Contrast is the worst case, over a white page.

| Tier | Surfaces | Tint | Filter (σ in px) | k | Over white | Over canvas | Over lime | Primary | Secondary | Danger | Blue accent | Lime accent |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **M1 Chip** | Zoom pill, page pill, the Read-mode Edit button, mode switch, stage close and back buttons, scroll-to-top | `rgb(30 32 37 / 0.50)` | `blur(8px) saturate(1.9) brightness(0.42)` | 0.210 | `#454648` | `#111215` | `#324612` | 7.64 | 5.17 | 4.85 | 3.17 | 7.29 |
| **M2 Bar** | Floating tool bar and options tier, text-selection bar, contextual bars, crop banner, toasts, phone bottom bar | `rgb(32 34 39 / 0.55)` | `blur(10px) saturate(1.8) brightness(0.44)` (σ 8 at 44 px) | 0.198 | `#444548` | `#131418` | `#334515` | 7.75 | 5.25 | 4.92 | 3.22 | 7.40 |
| **M3 Panel** | Navigator, inspector, title bar, status bar, phone sheet at the medium detent | `rgb(35 37 44 / 0.66)` | `blur(40px) saturate(1.5) brightness(0.50)`; title bar σ 8, status bar σ 5 | 0.170 | `#424448` | `#181a1f` (= `--surface-1`) | `#35441d` | 7.89 | 5.34 | 5.01 | 3.28 | 7.53 |
| **M4 Menu** | Menus, context menus, popovers, the command palette, the pen preset editor | `rgb(38 40 46 / 0.68)` | `blur(24px) saturate(1.6) brightness(0.49)`; σ 16 under 120 px tall | 0.157 | `#424347` | `#1b1d21` | `#35431f` | 7.99 | 5.41 | 5.08 | 3.32 | 7.62 |
| **M5 Sheet** | Dialogs, Document info, Combine, export and batch sheets, phone sheet at full height | `rgb(40 42 48 / 0.82)` | `blur(48px) saturate(1.4) brightness(0.50)` | 0.090 | `#38393e` | `#212328` | `#313927` | 9.32 | 6.30 | 5.92 | 3.87 | 8.89 |

Contrast does not depend on σ over a uniform backdrop, so the columns hold for any σ that keeps
full coverage (σ ≤ height / 5, §6.3). M0, the aurora field, is not glass; research 17 specifies
it and §7.7 lists what glass needs from it. Disabled text `#787c84` is 2.26–2.75:1 on
these tiers, as today (WCAG exempts disabled controls; keep icons visible). `--warning #f5c451`
is 5.80–7.07:1. M3 composites over the bare canvas to exactly `--surface-1`, so a docked panel
at rest looks as it does today and changes only where a page or the aurora passes under it.

### 7.3 CSS recipe

```css
:root {
  /* M1–M5: tint, filter, opaque fallback. Filter values are standard deviations; keep
     σ ≤ height / 5 (title bar 8, status bar 5, small popovers 16). */
  --m1-tint: rgb(30 32 37 / 0.5);  --m1-filter: blur(8px) saturate(1.9) brightness(0.42);  --m1-solid: var(--surface-2);
  --m2-tint: rgb(32 34 39 / 0.55); --m2-filter: blur(10px) saturate(1.8) brightness(0.44); --m2-solid: var(--surface-2);
  --m3-tint: rgb(35 37 44 / 0.66); --m3-filter: blur(40px) saturate(1.5) brightness(0.5);  --m3-solid: var(--surface-1);
  --m4-tint: rgb(38 40 46 / 0.68); --m4-filter: blur(24px) saturate(1.6) brightness(0.49); --m4-solid: var(--surface-2);
  --m5-tint: rgb(40 42 48 / 0.82); --m5-filter: blur(48px) saturate(1.4) brightness(0.5);  --m5-solid: #212328;

  /* Rim: dark outer edge (holds over white) + lit inner rim (holds over canvas and aurora). */
  --rim-edge: 0 0 0 0.5px rgb(0 0 0 / 0.55);
  --rim-light: linear-gradient(180deg, rgb(255 255 255 / 0.34), rgb(255 255 255 / 0.10) 35%,
               rgb(255 255 255 / 0.05) 70%, rgb(255 255 255 / 0.14));
  --rim-inner: inset 0 1px 0 rgb(255 255 255 / 0.12), inset 0 -1px 0 rgb(255 255 255 / 0.04);

  /* Shadows, tuned for the page case; over the dark canvas they vanish, which is the adaptive
     shadow Apple describes, for free. */
  --m1-shadow: 0 4px 12px -4px rgb(0 0 0 / 0.5);
  --m2-shadow: 0 10px 28px -10px rgb(0 0 0 / 0.6), 0 2px 6px -2px rgb(0 0 0 / 0.35);
  --m3-shadow: 0 18px 48px -18px rgb(0 0 0 / 0.6);           /* floating panels only */
  --m4-shadow: 0 16px 40px -12px rgb(0 0 0 / 0.62);
  --m5-shadow: 0 30px 80px -20px rgb(0 0 0 / 0.7);
}

.mat { position: relative; background: var(--mat-solid);
       box-shadow: var(--rim-edge), var(--rim-inner), var(--mat-shadow); }
.mat::before { /* lit rim, follows border-radius and corner-shape */
  content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px;
  background: var(--rim-light); pointer-events: none;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
}
@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  .mat { background: var(--mat-tint); backdrop-filter: var(--mat-filter); }
  /* Literal values on the prefixed line (BCD #25914), one rule per tier: */
  .mat-1 { -webkit-backdrop-filter: blur(8px) saturate(1.9) brightness(0.42); }
  .mat-2 { -webkit-backdrop-filter: blur(10px) saturate(1.8) brightness(0.44); }
  /* … .mat-3 to .mat-5 likewise. */
}
.mat-1 { --mat-tint: var(--m1-tint); --mat-filter: var(--m1-filter); --mat-solid: var(--m1-solid); --mat-shadow: var(--m1-shadow); }
/* … .mat-2 to .mat-5 likewise; M3–M5 add the grain tile as a second background layer at 2.5 %. */
```

Inside any `.mat`: secondary and tertiary text map to `--glass-text-secondary`, danger to
`--glass-danger` (today's `.glass` rule). Labels at 12 px or smaller use weight ≥ 500; no text
smaller than 11 px on M1/M2. No `mix-blend-mode` vibrancy on text: blend modes create extra
render surfaces per node and make contrast non-deterministic.

### 7.4 Rim, highlight and shadow per tier

| Tier | Outer edge | Lit rim (top / bottom alpha) | Inner light | Shadow | Grain |
|---|---|---|---|---|---|
| M1 | 0.5 px black at 0.55 | 0.34 / 0.14 | top 0.12 | `--m1-shadow` | No |
| M2 | 0.5 px black at 0.55 | 0.34 / 0.14 | top 0.12 | `--m2-shadow` | No |
| M3 docked | Hairline divider only (no ring on a docked edge) | 0.20 / 0 on the free edge only | top 0.06 | None | 2.5 % |
| M3 floating (inset 8 px) | 0.5 px black at 0.55 | 0.24 / 0.08 | top 0.08 | `--m3-shadow` | 2.5 % |
| M4 | 0.5 px black at 0.6 | 0.30 / 0.10 | top 0.10 | `--m4-shadow` | 2.5 % |
| M5 | 0.5 px black at 0.6 | 0.24 / 0.08 | top 0.08 | `--m5-shadow` | 2.5 % |

`prefers-contrast: more` and the Solid setting replace the lit rim with a 1 px
`rgb(255 255 255 / 0.36)` border (today's high-contrast border) and drop the shadow; forced
colours use `Canvas` and `CanvasText` as today.

### 7.5 Refraction: where, how, and the fallback

| Where | Kind | Recipe | Off when |
|---|---|---|---|
| M1 chips (fixed size) | Backdrop lens (A), Chromium only | `url(#lens-<size>)` placed **before** the M1 filter list; map at the chip's exact size; bezel 10 px; max pull 6 px; convex profile `t^2.2`; no chromatic split | Non-Chromium, coarse pointer only (phones), any Reduce setting, Tinted or Solid glass, while the chip animates |
| M2 floating tool bar | Backdrop lens (A), Chromium only | Same, map at the bar's exact size, bezel 12 px, max pull 6 px; regenerated 150 ms after a shape change, removed during the group morph | As above |
| Mode switch thumb, zoom slider thumb | Own-content lens (C), all engines | `filter: url(#thumb-lens)` on the track's label layer, region = thumb; pull 4–5 px (Aave's slider and toggle values), chroma spread ≤ 5 %; WebKit: 1× filter resolution, map regenerated only on shape change, filter id bumped per change | Any Reduce setting, Solid glass |
| Panels, menus, sheets, toasts | None | — | — |

Map generation is a one-off canvas job (an 800 × 64 map is 51 200 pixels; cache per size). The
lens must never cover page text at rest: a 6 px pull at the rim of a bar that sits over a page
mostly bends the page edge and white space, and the bar's own labels are not refracted (they are
above the backdrop).

### 7.6 Support and fallback ladder

| Level | Rendering | When |
|---|---|---|
| L3 Lens + glass | Backdrop lens on M1/M2, own-content lens on thumbs, blur on all tiers | Chromium, fine pointer, Glass: Clear, no reduce or contrast preference, GPU compositing, no degrade |
| L2 Glass | Blur recipes M1–M5, own-content thumb lens | Safari, Firefox, phones, or Glass: Clear without L3's conditions |
| L1.5 Tinted | Text-bearing glass at tint alpha ≥ 0.90 (research 22), blur kept; backdrop lens off | Glass: Tinted, the automatic degrade (G-23), a low-end device or a software renderer at start (G-32) |
| L1 Solid | All `--mN-solid`, rims kept as the high-contrast border | Glass: Solid, `prefers-reduced-transparency`, `prefers-contrast: more`, no `backdrop-filter` support |
| L0 Forced colours | `Canvas` / `CanvasText` | `forced-colors: active` |

The in-app setting is research 22's **Glass: Clear · Tinted · Solid** (A-17), replacing today's
"Glass panels" and "Reduce transparency" switches, in Settings and the palette, defaulting to
Clear (Tinted on low-end devices and software renderers). That mirrors iOS 26.1's Clear/Tinted
and iOS 27's slider in a form that can be tested. The aurora has its own control (research 17
AU-16, Ambient light: Auto · Still · Off).

### 7.7 The aurora field (M0) and the performance budget

**What glass needs from the aurora (M0).** Research 17 owns the aurora: a 1/8-scale WebGL
field, still by default, moving only on events, never on the document stage, in Arrange or in
Compare, with a teal → mint → lime → lemon ramp chosen by intensity. From the glass side, this
research adds four constraints and two pieces of evidence:

- **Light only beneath glass, never inside it.** The `brightness()` cap clamps what is behind
  the glass; light painted inside a glass surface under text bypasses the cap (research 17 AU-8
  measured the loss). Nothing here changes that.
- **Freeze under large glass.** Moving light under docked glass re-filters every surface every
  frame (§5.5: glass over a moving field cost about 1.8× the field alone). Freeze the field
  while any M5 sheet, full-height phone sheet or menu over Home is open, and during scroll, zoom,
  drag, ink and typing (research 17 AU-14).
- **If it moves continuously, 15 Hz.** Updating at 15 Hz cut GPU time per second by 4× (§5.5);
  research 17 caps opt-in drift at 15 fps. At its slowest speeds a lobe moves a few pixels per
  update on a gradient hundreds of pixels wide; whether that reads as smooth is for the owner's
  eyes.
- **Never `filter: blur()` on moving shapes and never `@property`-driven positions** for any
  light layer, including the CSS fallback: both cost about three times a transform-moved
  pre-blurred gradient (§5.5).
- **Evidence: the olive trap.** Three renders of one composition (sRGB fade, OKLCH fade, OKLCH
  with a hue turn) showed that a yellow-green blob dimmed by alpha turns khaki in either colour
  space, while a lime core whose falloff turns to emerald and teal stays light-like. This agrees
  with research 17's ramp (lime and lemon only where the light is strong). Candidate stops for
  research 17's static CSS fallback, measured here: Home
  `radial-gradient(closest-side in oklch, oklch(0.92 0.20 128 / 0.85), oklch(0.78 0.19 138 / 0.55) 22%, oklch(0.58 0.15 152 / 0.28) 55%, oklch(0.40 0.09 165 / 0))`
  (brightest rendered pixel `#9cb646`, L = 0.41); a dimmer variant
  `oklch(0.90 0.21 130 / 0.62)`, `oklch(0.74 0.18 142 / 0.34) 22%`, `oklch(0.56 0.14 155 / 0.16) 55%`
  (brightest `#618f33`, L = 0.224, a page beside it 3.8:1 brighter).
- **Evidence: glass shows the light.** Through M2 a lime core arrives as `#334515`, through M3
  as `#35441d` (§6.2): a dim green smoke, enough to make glass read as glass over the field.

**The budget.**

| Rule | Value | Basis |
|---|---|---|
| Persistent glass over moving content (default layout) | ≤ 32 % of the viewport (≈ 1.6–1.7× the no-glass compositor work while scrolling) | §5.2 fit; title bar + navigator + status bar + floating bar at 1440 × 900 are 31 % |
| Persistent glass, hard ceiling | ≤ 50 % (both panels open, ≈ 2×) | §5.2: docked frame + bar 1.97× |
| Full-viewport glass | Only transient and only over a frozen backdrop (sheets freeze the aurora) | 2.8× while anything moves; free when nothing does |
| Backdrop surfaces on screen | ≤ 6 persistent, counting each chip (title, navigator, status, tool bar, zoom pill, page pill) + 2 transient; a rail and its panel share one filtered element (research 13) | Per-surface overhead (eight capsules 1.53× against one panel's 1.36× at similar area) |
| Blur σ | σ ≤ height / 5 everywhere (M1 8, M2 8–10, title bar 8, status bar 5, small popovers 16); σ ≥ 16 on surfaces taller than about 200 px (M3 panels 40, M4 menus 24, M5 sheets 48; phones: M3 and M4 24, M5 32) | §6.3 coverage on the software compositor; §5.2: small blurs on large surfaces cost most; phone values from unmeasured mobile advice |
| Backdrop lenses | ≤ 3 on screen, fixed size, none on phones | §5.3: +9 % GPU and about 4× main-thread work per scrolled frame |
| Aurora under glass | Still by default (research 17); 15 Hz if drifting; frozen under sheets and during interaction | §5.5: 4× less GPU time per second at 15 Hz |
| `will-change` | `transform` on aurora layers and on glass only while it animates; never `will-change: backdrop-filter` | iOS WebKit regression (abstract) |
| Automatic degrade | > 25 % of frames over 20 ms in a 2 s window while scrolling, zooming or panning → Tinted for the session | G-23 |

### 7.8 How glass moves

Research 18 owns the springs and the choreography (MP-1 to MP-3, MC-8, MC-11, MC-14, MC-21).
The material adds these rules, which agree with it:

- **Constant material.** Tint, filter and rim never animate (research 18 MP-2; HIG: avoid
  animating into and out of blurs). A glass surface appears and disappears with opacity and
  transform on the element itself, never on an ancestor (backdrop root).
- **Materialize.** When a glass surface has finished its entrance (research 18 MC-14 for menus:
  `scale(0.96)` + 4 px toward the anchor + opacity), its lit rim's alpha rises from 0 to its
  value over the last 40 % of the entrance. That is the cheap web stand-in for Apple's
  "modulating the light bending". Reduce Motion: no rim animation.
- **Shape changes** use `clip-path` on the glass layer (research 18 MC-8, MC-11), measured here
  at 1.25× the idle reference against 1.35× for `border-radius` (§5.4). The backdrop lens is
  removed for the morph and restored 150 ms after it ends.
- **Press light.** With research 18's press scale (MC-21: 0.97 mouse, 0.94 touch and pen), a
  radial glow at the press point, white, 0 → 0.12 → 0 (0.24 under a finger), 120 ms in and
  240 ms out: the web version of "illuminates from within".
- **Sheen.** One conic sweep of the rim (600 ms) at the end of a materialize or a morph; never a
  loop (research 18 MP-3: nothing on or under glass loops).

### 7.9 Where glass must not go

| Surface | Why |
|---|---|
| The PDF page, its annotations, form fields, redaction marks and selection overlays | Content. The page is never themed (DESIGN §3) |
| In-place editors (paragraph editing, free text, notes being typed) | Opaque page white with page ink; a caret over a moving blur keeps the compositor busy (research 13) |
| Text inputs, the find field, rename and number fields, the palette's input | An opaque `--surface-2` well inside the glass, with the control border (G-18) |
| Thumbnails, the Arrange grid cells, Home card artwork, Recents rows' glyphs | Content layer; also hundreds of nodes |
| Tooltips | Solid `--surface-2` fill with the glass rim and edge; they must read instantly and appear often |
| The dialog scrim | Dim only (`rgb(5 6 8 / 0.5)`); a full-viewport blur is the most expensive glass (§5.2) |
| Anything inside another glass surface | Apple: no glass on glass. Segments, wells, chips inside a bar use fills (`--surface-hover`, `--surface-active`, `--surface-3`) |
| Long dense lists inside M3/M4 (Review rows, the outline, Changes) | Stay on the tier fill; if a list still reads busy over a page, give the list a `--surface-1` well (research 13) |
| Code and diagnostics | `--surface-2` well |
| The About page's text columns | Marketing glass (clear variant, refraction, bold aurora) belongs in its hero only |

---

## 8. Recommendations

| Id | Recommendation | Applies to |
|---|---|---|
| G-1 | Glass on every functional surface, none on content; the list in §7.9 is the boundary | DESIGN §1–§3 |
| G-2 | Amend DESIGN §1: "Nothing glows" → "Only light glows: the aurora field and the glass rims. Text, icons and buttons never glow." | DESIGN §1 |
| G-3 | One material in five densities M1–M5 (Table 7, §7.3), no clear variant; replace tokens `--glass`, `--glass-frame`, `--glass-menu` | `tokens.css`, `global.css` |
| G-4 | Test the white-page ceiling: every tier ≤ L 0.062 over white, primary ≥ 7:1, secondary and danger ≥ 4.5:1, accent fill ≥ 3:1, over white, `#808080`, canvas, black and the aurora peak | `tokens.test.ts` |
| G-5 | Every floating glass surface gets the darkened outer edge plus the lit inner rim (§7.3–7.4) | All `.mat` surfaces |
| G-6 | One shadow per tier, tuned for the page case; no other shadow, glow or halo | `tokens.css` |
| G-7 | A static 128 px grain tile at 2.5 % on M3–M5 (research 17 dithers its field in the shader); never a live `feTurbulence` | `tokens.css` |
| G-8 | Backdrop lens on fixed-size M1 chips and the M2 tool bar, Chromium only, JS-gated, `url()` never in the base declaration; 10–12 px bezel, 6 px pull | `stage/`, tool bar |
| G-9 | Own-content lens for the mode-switch thumb and the zoom slider thumb, all engines, 4–5 px pull, with the WebKit fixes | Mode switch, zoom control |
| G-10 | No refraction on panels, menus, sheets or toasts | — |
| G-11 | The five-level ladder (§7.6) behind research 22's setting Glass: Clear · Tinted · Solid, replacing "Glass panels" and "Reduce transparency" | `appearance-store.ts`, Settings, palette |
| G-12 | Performance budget as in §7.7 | All glass |
| G-13 | Glass moves by transform, opacity and `clip-path` only (research 18 MP-1, MP-2); never animate blur, saturate, brightness or the rim's shape; the lit rim fades in at the end of an entrance | Motion spec |
| G-14 | Glass constraints on the aurora (research 17 owns it): light only beneath glass; frozen under sheets and during interaction; 15 Hz if it drifts; never `filter: blur()` or `@property` positions, also in the CSS fallback | Research 17, `AuroraField` |
| G-15 | Keep every light layer's brightest composite below the white page by at least 2.5:1 wherever glass and pages share the screen (the dimmer stops in §7.7 give 3.8:1); research 17's light budget already keeps light off the document stage | Research 17 |
| G-16 | Any CSS light gradient interpolates in OKLCH and turns from lime to emerald and teal as it dims, never fading a yellow by alpha; candidate fallback stops in §7.7 | Research 17's CSS fallback |
| G-17 | Fixed glass text tokens; weight ≥ 500 at ≤ 12 px; no text under 11 px on M1/M2; no blend-mode vibrancy | Typography spec |
| G-18 | Opaque wells for every text input and editor inside glass | Find, rename, palette, number fields |
| G-19 | Soft scroll edge (40 px, `--surface-0` 0.85 → 0) under the title bar and above the bottom bar; hard edge for pinned headers | Stage |
| G-20 | Concentric radii: capsules for M1/M2 and their chips; floating panels 16 px inset 8 px, controls inside 8 px; menus 14 px with 8 px items at 6 px inset; sheets 24 px with 12 px cards at 12 px inset. Under `@supports (corner-shape: squircle)`, non-capsule shapes get `corner-shape: squircle` and radius × 1.8, clamped to half the shorter side (same 45° apex: 0.293·r vs 0.159·R) | All shapes |
| G-21 | Keep the backdrop-root discipline: portal glass, fade the glass element itself, no filtered or faded ancestors | All glass |
| G-22 | Literal values on every `-webkit-backdrop-filter` line (no `var()`), one rule per tier; verify on the owner's Safari, including today's `global.css` lines 157 and 229 | `global.css` |
| G-23 | Automatic degrade: a frame-time monitor while scrolling, zooming or panning; if more than 25 % of frames exceed 20 ms in a 2 s window with glass on, drop to Tinted for the session; start in Tinted when `navigator.deviceMemory ≤ 4` or `hardwareConcurrency ≤ 4` (Chromium only) | `appearance-store.ts` |
| G-24 | Phones: panels become sheets (M3 at the medium detent, inset 8 px; M5 at full height); blur values from §7.7; no backdrop lens; aurora frozen while a sheet is open | Mobile spec |
| G-25 | If a light theme returns: add `contrast(0.45) brightness(1.4)` to every tier filter and re-derive the text steps; not in this redesign | Future |
| G-26 | Press glow on every glass control (0.12, 0.24 under a finger) with research 18's press scale; pointer-following rim light only for fine pointers, within 120 px, rAF-throttled, off under Reduce Motion | Controls |
| G-27 | `@property` sheen only as a one-shot (materialize, end of morph), never a loop at rest | Motion spec |
| G-28 | Tests: extend `tokens.test.ts` to M1–M5 (model verified to ±1/255, §6.3); add a Playwright pixel check that renders each tier over white and canvas and compares with the model; extend `glass-perf.spec.ts` with the aurora scenes of §5.5 | Tests |
| G-29 | Tooltips solid with the glass rim; toasts M2 | Overlays |
| G-30 | One prominent (accent-backed) action per glass surface at most; the rest monochrome | Bars, sheets |
| G-31 | Dialog scrim `rgb(5 6 8 / 0.50)`, no backdrop blur; any light layer frozen while an M5 sheet is open | Dialogs |
| G-32 | Keep σ ≤ height / 5 on bars and chips, or use research 22's oversized masked filter layer; start in Tinted when WebGL's unmasked renderer names a software rasteriser; add a rendered-pixel test on the software path | `tokens.css`, `appearance-store.ts`, tests |

---

## 9. Open questions

1. Does the redesign keep panels docked (M3 with a hairline edge) or float them inset (M3 with
   rim and shadow)? Figma tried floating panels in UI3 and went back because "designs seemed to
   peek out from behind them in a distracting way" (research 13, abstract). Glass makes that
   peeking stronger.
2. Is Chromium-only refraction acceptable, with Safari and Firefox users seeing blur-only glass
   that is otherwise identical?
3. Over a white page every compliant dark glass is a mid-grey slab (§6.1). Is that acceptable
   while pages scroll under the bars, provided layout keeps pages out from under glass at rest,
   or does the owner want the bars to sit beside the page (over the canvas) at fit width?
4. Does the colour track keep the blue accent? A light accent relaxes the binding constraint
   from the accent to primary text (Table 7).
5. A light theme: the owner's references (Preview, Notability) are mostly light. Glass in light
   is harder (§6.4); decide before tokens are written.

---

## Sources

Read in full (primary):

- Apple HIG, via the JSON data behind each page: [Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [Color](https://developer.apple.com/design/human-interface-guidelines/color), [Layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars), [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars), [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars), [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets), [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons), [Motion](https://developer.apple.com/design/human-interface-guidelines/motion), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Windows](https://developer.apple.com/design/human-interface-guidelines/windows) (Menus, Popovers, Segmented controls, Search fields and Dark Mode were read for glass references only). Change logs: Materials and Motion updated 2025-09-09; Color, Toolbars and Tab bars 2025-12-16.
- Apple developer documentation, via JSON: [Applying Liquid Glass to custom views](https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views), [Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass), [Liquid Glass overview](https://developer.apple.com/documentation/technologyoverviews/liquid-glass), [`Glass`](https://developer.apple.com/documentation/swiftui/glass), [`GlassEffectContainer`](https://developer.apple.com/documentation/swiftui/glasseffectcontainer).
- WWDC25 transcripts from the video pages: [Meet Liquid Glass (219)](https://developer.apple.com/videos/play/wwdc2025/219/) (in full); [Get to know the new design system (356)](https://developer.apple.com/videos/play/wwdc2025/356/) (shape and layout passages).
- Microsoft: [acrylic.md](https://github.com/MicrosoftDocs/windows-dev-docs/blob/docs/hub/apps/design/style/acrylic.md) (in full); [AcrylicBrush.h](https://github.com/microsoft/microsoft-ui-xaml/blob/main/controls/dev/Materials/Acrylic/AcrylicBrush.h) and `AcrylicBrush.cpp` (constants and the tint-opacity logic).
- MDN browser-compat-data `main`: [backdrop-filter](https://github.com/mdn/browser-compat-data/blob/main/css/properties/backdrop-filter.json), [corner-shape](https://github.com/mdn/browser-compat-data/blob/main/css/properties/corner-shape.json), [@property](https://github.com/mdn/browser-compat-data/blob/main/css/at-rules/property.json), [mask-image](https://github.com/mdn/browser-compat-data/blob/main/css/properties/mask-image.json).
- Cloned repositories, source and docs read: [rdev/liquid-glass-react](https://github.com/rdev/liquid-glass-react) (`src/index.tsx`, README); [samasante/liquid-glass](https://github.com/samasante/liquid-glass) (README, `BROWSERS.md`); [shuding/liquid-glass](https://github.com/shuding/liquid-glass) (`liquid-glass.js`); [naughtyduk/liquidGL](https://github.com/naughtyduk/liquidGL) (README); [anubhavaanand/glass-of-web](https://github.com/anubhavaanand/glass-of-web) (README, `SKILL.md`, benchmark); [seunghan91/ios27-design-system](https://github.com/seunghan91/ios27-design-system) (`docs/whats-new-in-ios27.md`, `docs/native-glass-measurement.md`, `packages/tokens/src/materials.json`). Also cloned but not used: nikdelvin/liquid-glass, Amir-Abushanab/liquid-glass-js, ALEXalesha/LiquidGlass, rizroze/liquid-glass, archisvaze/liquid-glass, ybouane/liquidglass.
- Recto: `docs/research/13-glass-and-modes.md`, `docs/research/14-glass-spike.md`, `docs/DESIGN.md`, `apps/web/src/styles/tokens.css`, `apps/web/src/styles/global.css`; written in parallel and cross-checked for consistency: `docs/research/17-aurora-and-light.md` (§0, §8, §10, §12), `docs/research/18-motion.md` (§0, MP and MC rows), `docs/research/22-accessible-expressive-ui.md` (§3.2, A-2, A-17).

Read through a fetch summary (GitHub pages, summarised by the fetch tool rather than read verbatim):

- [mdn/browser-compat-data#25914](https://github.com/mdn/browser-compat-data/issues/25914) — Safari 18 prefix and `var()`.
- [mdn/browser-compat-data#24110](https://github.com/mdn/browser-compat-data/issues/24110) — SVG filters in `backdrop-filter`, closed as not planned.
- [huozhi/vaso#11](https://github.com/huozhi/vaso/issues/11) — the declaration drop and the split-layer fix.
- [WebKit/WebKit#68614](https://github.com/WebKit/WebKit/pull/68614) — software path for reference backdrop filters, unmerged.
- [w3c/svgwg#1142](https://github.com/w3c/svgwg/issues/1142) — proposal for interoperable backdrop displacement.

Known only from search abstracts:

- [MacRumors: iOS 26 Liquid Glass critiques](https://www.macrumors.com/2025/09/17/ios-26-liquid-glass-critiques/); [MacRumors guide](https://www.macrumors.com/guide/ios-26-liquid-glass/); [Wikipedia: Liquid Glass](https://en.wikipedia.org/wiki/Liquid_Glass).
- [Engadget: adjust Liquid Glass in iOS 26.1](https://www.engadget.com/mobile/smartphones/how-to-adjust-the-liquid-glass-effect-in-ios-261-203634681.html); [MacRumors: iOS 26.1 toggle](https://www.macrumors.com/how-to/ios-26-1-reduce-liquid-glass-effects/); [TechCrunch](https://techcrunch.com/2025/11/04/ios-26-1-lets-you-turn-down-liquid-glass-transparency); [TidBITS](https://tidbits.com/2025/10/21/ios-26-1-to-add-optional-opacity-to-liquid-glass/).
- [anderegg.ca on NN/g's iOS 26 article](https://anderegg.ca/2025/10/12/nielsen-norman-group-on-ios-26-usability); [Hacker News thread](https://news.ycombinator.com/item?id=45560593).
- [Eclectic Light: Tahoe 26.1 appearance](https://eclecticlight.co/2025/11/05/appearance-revisited-get-tahoe-26-1-looking-in-better-shape/); [OSXDaily: Reduce Transparency works again in 26.3](https://osxdaily.com/2026/02/13/reduce-transparency-works-again-in-macos-tahoe-26-3/); [Michael Tsai: Liquid Glass disbelief](https://mjtsai.com/blog/2025/12/29/liquid-glass-disbelief/).
- [MacRumors: how Liquid Glass is changing in iOS 27](https://www.macrumors.com/2026/06/10/how-liquid-glass-is-changing-in-ios-27/); [BGR: iOS 27 Liquid Glass fix](https://www.bgr.com/2191219/ios-27-liquid-glass-fix-customization/); [urdesignmag: iOS 27 slider](https://www.urdesignmag.com/ios-27-liquid-glass-slider-apple-design-wwdc26/); [Tech Times](https://www.techtimes.com/articles/317975/20260608/apple-liquid-glass-ios-27-wwdc-2026-brings-refinements-developers-must-adopt-today.htm).
- [kube.io: Liquid Glass in the browser](https://kube.io/blog/liquid-glass-css-svg/) (blocked; surface function and Snell's law parameters from the abstract and two pull requests citing it).
- [LogRocket: liquid glass with CSS and SVG](https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/); [buildmvpfast: backdrop-filter recipes and guardrails](https://www.buildmvpfast.com/blog/liquid-glass-css-backdrop-filter-recipes-2026) (Firefox parses `url()` and renders nothing; mobile blur advice, unmeasured).
- [WebKit bug 245510](https://bugs.webkit.org/show_bug.cgi?id=245510); [Firefox bug 1995195](https://bugzilla.mozilla.org/show_bug.cgi?id=1995195); [Firefox bug 1787623](https://bugzilla.mozilla.org/show_bug.cgi?id=1787623) (bug trackers blocked).
- [Chromium intent to ship corner-shape](https://groups.google.com/a/chromium.org/g/blink-dev/c/OoX4xjqSPt4); [squircle.js: corner-shape support 2026](https://squircle.js.org/blog/squircles-in-css).
- [Microsoft: materials overview](https://learn.microsoft.com/en-us/windows/apps/develop/ui/materials).
- Performance folklore, recorded but not relied on: [guitarbeat/personal-website#1072](https://github.com/guitarbeat/personal-website/pull/1072) (iOS `will-change: backdrop-filter` regressions); glassmorphism guides claiming "15–25 % more GPU" and "12 fps drops" without a method.

Blocked: kube.io, bugzilla.mozilla.org, bugs.webkit.org, nngroup.com, apple.com (WebFetch). The
web-search budget for the session ran out before the sections on progressive blur, Safari mask
bugs and iOS Safari 26 performance could be researched; those are left open.
