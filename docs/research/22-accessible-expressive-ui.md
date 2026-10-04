---
title: "Research: accessible glass, light and motion (the non-negotiables for M9)"
date: 2026-10-04
status: snapshot
---

> Research snapshot gathered on 2026-10-04 for the M9 redesign. WCAG 2.2 text, Understanding
> documents, techniques and definitions were read in full from the `w3c/wcag` repository (`main`,
> shallow clone that day). Spec text was read from `w3c/csswg-drafts` (`filter-effects-2`,
> `css-color-adjust-1`, `mediaqueries-5`, `css-view-transitions-1`). Apple's guidance was read
> from the JSON behind the Human Interface Guidelines (accessibility, materials, motion, color,
> dark-mode, buttons, layout, toolbars). Browser support comes from `@mdn/browser-compat-data`
> 8.1.4 (published 2026-10-01). APCA levels come from the `apca-w3` 0.1.9 package and its docs;
> axe and Base UI behaviour from the `axe-core` 4.13.0 and `@base-ui/react` 1.8.0 sources in this
> repository. **Measurements** were taken in headless Chromium 141 (SwiftShader, CPU rendering,
> DPR 1) against hand-built probe pages and against the current production build of Recto
> (`apps/web/dist`, served locally); they are exact for that renderer and unverified on a GPU, in
> Safari and in Firefox. WebFetch was blocked for infinum.com, anderegg.ca, macrumors.com and
> rogerwong.me, and the session's web-search budget ran out part-way, so everything about
> Liquid Glass's reception rests on search abstracts, and vestibular guidance beyond Apple's and
> W3C's text rests on established knowledge; both are marked. Contrast ratios use the WCAG 2.2
> formula; OKLCH uses Ottosson's matrices; colour-vision simulation uses Machado, Oliveira and
> Fernandes (2009) at severity 1.0 in linear RGB. No file other than this report was written.

# Accessible glass, light and motion: the non-negotiables

## 0. Verdict

- **Glass everywhere, a moving lime aurora and fluid motion are compatible with WCAG 2.2 AA**,
  but only as a layer on top of a complete solid interface. Every expressive effect needs a
  named fallback, and the fallbacks are what the tests guarantee (§13, A-1 to A-24).
- **The contrast model Recto tests against is optimistic for small glass.** In Chromium the
  backdrop blur of a short element loses coverage at its edges, and the unfiltered page shows
  through. Rendered here, the shipped 44 px floating bar over a white page is `#5b5d61`, not the
  modelled `#47494d`. That puts its secondary labels at **3.61:1** and the accent fill at
  **2.22:1**. A transparent-edge Gaussian predicts every measured value within ±1/255 (§3.2).
  The fixes are a blur radius of at most a fifth of the element's short side, or an oversized
  filter layer shaped with `mask-image`. Contrast must be tested on rendered pixels, because
  axe reports no violation on that bar (§3.3).
- **Aurora under glass is safe, aurora under text is not.** The `brightness()` cap means no
  aurora colour can be a worse backdrop than a white page. Directly on the canvas, though,
  `--text-secondary` fails at 19.5 % of a lime core's opacity and the focus ring at 28 %
  (§3.1). Text never sits on bare light.
- **The current focus ring fails on the new backgrounds.** `#7c8cff` gets 2.98:1 against a white
  page, 2.22:1 against the bar as rendered and 2.40:1 against a 35 % aurora. A two-band ring
  (light outline plus 2 px dark halo, ≥ 9:1 between them, W3C technique C40) holds at least
  4.0:1 against every backdrop tested, inks and aurora included (§4).
- **Motion needs one switch and one module.** Recto's global reduced-motion CSS rule reaches CSS
  animations only. In the measurements it left Web Animations (2 s, infinite) and View
  Transitions (1.3 s) running. A moving aurora needs an in-app control under WCAG 2.2.2, and
  View Transitions swallow clicks while they run (§5).
- **Forced colours do not flatten glass by themselves.** Chromium keeps `backdrop-filter`
  and the tint's alpha, so glass over white renders `#d2d2d2` instead of `Canvas`. Gradients
  disappear automatically; a canvas or WebGL aurora does not (§6.2).
- **Lime is a good light and a poor signal.** Under protanopia, the proposed lime and the yellow
  highlighter differ by ΔE_OK 0.1, which makes them identical. Lime and the warning colour
  differ by 5.1 under deuteranopia. Lime never marks the page and never carries state on its own
  (§11).
- **Apple's Liquid Glass year is the cautionary tale.** Reviewers measured contrast as low as
  1.5:1, and controls that collapse and move were criticised. Apple answered with a Tinted
  option and accessibility settings that override the look (abstracts, §7). Recto should ship
  the same three states from the start: **Clear · Tinted · Solid**.
- **The current layout fails touch, zoom and Turkish text spacing.** On a 390 px touch screen,
  26 of 34 targets are under 44 px and the bar runs off screen. At 400 % zoom the chrome
  overflows by 110 px. Under 1.4.12 spacing the Turkish rail label truncates to "Dosyal…"
  (§9, §10, §12). M9 has to treat these as layout requirements, not polish.

---

## 1. Scope and method

This track sets the rules that keep the M9 design language accessible: glass on every chrome
surface, floating objects, light (a yellow-green aurora) and fluid motion. It does not choose
the language's values. The design-language and performance tracks do. Each rule below says what
must hold, how a test proves it and what the effect falls back to.

Measured here (scripts kept outside the repository, in the session scratch folder):

| # | Measurement | Where |
|---|---|---|
| M1 | Glass composites over white, lime and grey, varying element height (28–480 px) and blur radius (4–56 px) | Probe pages, Chromium 141 |
| M2 | The real floating bar's composite over a white page; targets; zoom; Turkish widths; text spacing | `apps/web/dist`, `simple-text.pdf`, Edit mode |
| M3 | Forced-colours computed styles and pixels; `prefers-*` emulation | Probe page |
| M4 | View Transition hit-testing, focus and reduced-motion behaviour; Web Animations under Recto's global rule | Probe page |
| M5 | axe 4.13 `color-contrast` and `target-size` on the Edit state | `apps/web/dist` |
| M6 | Turkish/English string lengths (2,245 strings), casing, Inter glyph extents | `apps/web/messages/*.json`, probe page |
| M7 | Contrast (WCAG and APCA), aurora limits, focus-ring bands, CVD distances, flash | Computed, `apca-w3` 0.1.9 |

---

## 2. The criteria that bind

| SC | Level | Normative core (quoted or condensed from `w3c/wcag`) | What it means for glass, light and motion |
|---|---|---|---|
| 1.4.3 Contrast (Minimum) | AA | Text 4.5:1; large text (≥ 24 px, or ≥ 18.66 px bold) 3:1. Ratios are not rounded ("4.499:1 would not meet") | Holds on every frame and every backdrop the glass can sit on. The test must use the worst rendered composite. |
| 1.4.6 Contrast (Enhanced) | AAA, our target | 7:1 and 4.5:1 | Target for primary text on resting surfaces. Today 14.08:1 on `--surface-1` and 7.29:1 modelled on tier 1 over white. |
| 1.4.11 Non-text Contrast | AA | 3:1 "against adjacent color(s)" for component boundaries, states and focus | Armed-tool fill against the bar, control outlines on glass, the focus ring against whatever it sits on |
| 1.4.12 Text Spacing | AA | Line height 1.5, paragraphs 2 em, letters 0.12 em, words 0.16 em: "no loss of content" | Compact glass chips and fixed-width rails clip first. Turkish is longer still (§12). |
| 1.4.10 Reflow | AA | 320 CSS px wide without 2-D scrolling. Exempt: content that needs a 2-D layout, including "interfaces where it is necessary to keep toolbars in view while manipulating content" | The PDF page may pan in 2-D. The chrome may not overflow. |
| 1.4.13 Content on Hover or Focus | AA | Dismissible, hoverable, persistent | Glass tooltips and hover cards |
| 2.2.2 Pause, Stop, Hide | A | Motion that starts automatically, lasts > 5 s and runs beside other content needs "a mechanism for the user to pause, stop, or hide it". Indirect triggers such as hover or scrolling count as automatic | A continuously drifting aurora needs a control, or must stop within 5 s |
| 2.3.1 Three Flashes or Below Threshold | A | No more than 3 general flashes per second, a flash being opposing changes of ≥ 0.10 relative luminance where the darker state is < 0.80; area threshold is 25 % of a 10° field ≈ 341 × 256 px | Aurora pulses, shimmer and highlight sweeps |
| 2.3.3 Animation from Interactions | AAA, adopted | "Motion animation triggered by interaction can be disabled". Motion animation excludes "changes of color or opacity" that do not alter size, shape, position or depth | Cross-fades are the legal replacement for every spatial transition |
| 2.4.7 Focus Visible | AA | A visible keyboard focus indicator | Including on glass, aurora and the page |
| 2.4.11 Focus Not Obscured (Minimum) | AA | The focused component is "not entirely hidden due to author-created content". Understanding: translucent or blurred overlays may pass this SC "but may separately fail 1.4.11", so the indicator is judged as seen through the overlay | Floating bars, sheets and toasts over the page and over form fields |
| 2.4.13 Focus Appearance | AAA, our target | Indicator area ≥ a 2 px perimeter, 3:1 between focused and unfocused pixels. Shadows and glows outside the component do not count | Glow rings are decoration. The outline carries the requirement. |
| 2.5.8 Target Size (Minimum) | AA | 24 × 24 CSS px, or 24 px spacing circles that do not intersect | Desktop floor. Touch needs 44 (2.5.5 AAA; Apple HIG 44 × 44 pt). |
| 4.1.3 Status Messages | AA | Status reachable by assistive technology without focus | Live-region timing around animations (§8) |

**APCA as a second check.** Apple's HIG names APCA next to WCAG ("Two popular standards of
measure for color contrast are the [WCAG] and the Accessible Perceptual Contrast Algorithm
(APCA)"). The levels in `APCA_in_a_Nutshell.md` are: Lc 90 preferred for body text and for
"non-body text with a font no smaller than 12px/400"; **Lc 75** the minimum for non-body text
of 15 px/400 or more; **Lc 60** the minimum for "text you want people to read"; **Lc 45** for
large text and "smaller outline icons"; **Lc 30** absolute minimum for spot text such as
placeholders; **Lc 15** for non-text that only needs to be discernible. APCA is still a beta
method and not a conformance requirement, so Recto uses it as a gate for primary text and a
warning for secondary text (§3.4).

---

## 3. Contrast over translucent and moving backdrops

### 3.1 The worst-case method, extended to light

Research 13 §3 models glass per channel as `a·tint + (1 − a)·b·backdrop`. With light text, the
binding backdrop is the brightest one, and `brightness(b)` caps it at `b·255`. That makes a white
page the provable worst case. The aurora changes nothing under glass: it is never brighter than
white, and `saturate()` keeps luma (computed, tier model as in `tokens.test.ts`, lime core
`oklch(0.93 0.21 122)` = `#d1fd39`):

| Tier | Over white (model) | Over the 35 % aurora | Over the pure lime core | `--text-primary` worst | `--glass-text-secondary` worst | Accent worst | ΔE_OK the aurora shows through (35 % / core) |
|---|---|---|---|---|---|---|---|
| 1 floating | `#47494d` | `#2b3126` | `#3d4926` | 7.29 (white) | 4.94 (white) | 3.03 (white) | 5.6 / 14.5 |
| 2 frame | `#36373c` | `#20241e` | `#2f371e` | 9.60 | 6.50 | 3.99 | 4.2 / 11.6 |
| 3 menus | `#393c42` | `#272c28` | `#343c28` | 8.94 | 6.05 | 3.71 | 3.5 / 9.7 |

The last column matters to the owner's brief. The light does show through: a ΔE_OK of 2 is
about one just-noticeable step, and tier 1 shows the 35 % aurora at 5.6. Contrast still holds,
so **light behind glass is the safe way to make glass visible.** Research 13's finding that
glass over a uniform canvas is invisible is answered by light, not by thinner glass.

For **dark text on light glass** (a light theme, or lime-filled controls), the rule mirrors:
the binding backdrop is black, and the composite over black is `a·tint`. A white tint needs
`a ≥ 0.72` for `#1d1d1f` text at 8.48:1, but a mid-grey secondary text (`#5b5e66`) fails until
`a ≥ 0.86`. Compressing the backdrop first (`contrast(0.5) brightness(1.3)`, a luminance
*floor* instead of a cap) gets the same 8.67:1 at `a = 0.60`. Whichever theme ships, the test
evaluates the bound end of the backdrop range: white for light text, black for dark text.

**Text directly on light, with no glass, is the unsafe case.** Lime core over `--surface-0`,
the opacity at which each token stops passing:

| Token on the canvas + aurora | Fails above core opacity | Backdrop there | Its Y |
|---|---|---|---|
| `--text-primary` `#e6e7ea` at 4.5:1 | 0.420 | `#5c6f1e` | 0.137 |
| `--text-primary` at 7:1 (AAA) | 0.290 | `#425018` | 0.070 |
| `--text-secondary` `#9a9ea6` at 4.5:1 | 0.195 | `#2f3914` | 0.036 |
| `--text-tertiary` `#8f949c` at 4.5:1 | 0.160 | `#283012` | 0.026 |
| `--accent` focus ring at 3:1 | 0.280 | `#404d18` | 0.065 |

So where text or focusable controls sit on the bare canvas (Home headings, empty states, the
About page), the light must stay under **Y 0.026**, the tertiary-text limit. Or it is masked
out of that region, or the text gets a glass or solid plate. A text-free canvas margin can take
the light at any intensity.

### 3.2 Measured: small glass is lighter than the model

The model assumes the blur leaves a uniform backdrop unchanged. The Filter Effects 2 spec says
the same: backdrop blur uses `edgeMode="mirror"` at the border box, and "filter functions must
operate in the sRGB color space". In Chromium 141 (M1, CPU renderer) it does not hold for
elements that are short relative to the blur radius. A grid of tier-1 bars over a white field,
red channel shown (the model gives 71):

| Height \ blur σ | 4 | 8 | 12 | 16 | 20 | 28 | 40 |
|---|---|---|---|---|---|---|---|
| 28 px | 71 | 74 | 82 | 89 | 94 | 101 | 106 |
| 36 px | 71 | 71 | 77 | 83 | 89 | 96 | 102 |
| 44 px | 71 | 71 | 73 | 79 | 84 | **91** | 99 |
| 56 px | 71 | 71 | 71 | 74 | 78 | 86 | 94 |
| 72 px | 71 | 71 | 71 | 71 | 74 | 80 | 88 |
| 120 px | 71 | 71 | 71 | 71 | 71 | 72 | 77 |

A transparent-edge Gaussian predicts every cell within ±1. The filtered backdrop has coverage
`c = erf(h / (2√2·σ)) · erf(w / (2√2·σ))`, and the unfiltered page shows through the rest:

```
backdrop = c · b · saturate(B) + (1 − c) · B        (B = the backdrop pixel)
```

**The shipped bar** (M2: 436 × 44 px, `blur(28px) saturate(1.8) brightness(0.45)`, over the
page in Edit) renders `#5b5d61` at its middle and `#5e6064`–`#606266` near its edges. That gives:

| Composite | `--text-primary` | `--glass-text-secondary` | `--glass-danger` | `--warning` | Accent fill | APCA primary / secondary |
|---|---|---|---|---|---|---|
| Model `#47494d` | 7.29 | 4.94 | 4.63 | 5.54 | 3.03 | 79.6 / 55.6 |
| **Rendered `#5b5d61`** | 5.34 | **3.61 ✗** | **3.39 ✗** | 4.05 ✗ | **2.22 ✗** | 72.1 / 48.2 |
| Rendered edge `#606266` | 4.94 | 3.34 ✗ | 3.14 ✗ | 3.75 ✗ | 2.05 ✗ | 70.1 / 46.2 |

Other surfaces as rendered over white: a 40 px tier-2 title bar `#424449` (primary 7.88,
secondary 5.33, still AA), a 28 px status bar `#45474c`, a 120 px tier-3 popover `#3b3d43`. Tall
surfaces (≥ 240 px) match the model exactly.

What fixes it (measured, 44 px bar over white):

| Variant | Composite | Verdict |
|---|---|---|
| Filter on the element, σ = 28 (today) | `#5b5d61` | Fails |
| σ = 8 on the element | `#47494d` | Matches the model |
| Oversized child (inset −84 px) inside `overflow: hidden` | `#5b5d61` | The ancestor clip also clips the backdrop |
| Oversized element, shaped with `clip-path` | `#5b5d61` | Same |
| **Oversized element (h + 6σ), shaped with `mask-image`** | `#46484d` | Matches; masks apply after filtering (spec step 6) |
| Tint alpha raised to 0.90, any σ | `#45474e` even unfiltered | Filter-independent: this is the Tinted mode |

Two more test-engineering facts from M1. A **clipped** Playwright screenshot (`clip:` option)
returned the unfiltered colours, as if no backdrop filter ran, so pixel tests must take
full-viewport screenshots and crop. The rendered result also depends on the renderer: this is
CPU rendering at DPR 1. The filter graph is built the same way for GPU rasterisation, so the
same loss is likely there, but Safari, Firefox and a GPU have to be measured on the owner's
machine. Both remedies are safe under either behaviour.

### 3.3 What automated tools see

- **axe 4.13 passes the failing bar.** Run on the Edit state (M5), `color-contrast` reported no
  violation and no "incomplete" for the bar's labels. Its only incompletes were the page's
  text-layer spans (`bgOverlap`). axe flattens CSS colours and knows nothing of
  `backdrop-filter`, so it judged the labels against the tint stacked on what lies beneath.
  Research 14 already said axe "cannot see through `backdrop-filter`". The new finding is that
  it does not even flag the case as incomplete.
- **`target-size` does run in Recto's suite**, because `a11y.spec.ts` uses `runOnly` with the
  `wcag22aa` tag, which enables the rule despite its `enabled: false` default.
- So contrast on glass needs two layers of test: the model in `tokens.test.ts` (extended with
  the coverage term, §13 A-2), and a **rendered-pixel spec** that samples each glass surface over
  a white page and over the aurora at its maximum, in every Playwright engine.

### 3.4 APCA on the current ladder

| Text | On `--surface-0` | On `--surface-1` | On tier 1 over white (model / rendered) |
|---|---|---|---|
| `--text-primary` `#e6e7ea` | Lc 92.2 (16.11:1) | 91.0 | 79.6 / 72.1 |
| `--text-secondary` `#9a9ea6` (glass: `#bcc0c6`) | **49.6** (7.41:1) | **48.3** | 55.6 / 48.2 |
| `--text-tertiary` `#8f949c` | **44.3** (6.53:1) | 43.1 | — |
| `--accent` `#7c8cff` (non-text) | 45.5 | 44.3 | — |
| `--warning` `#f5c451` | 74.9 | 73.7 | 62.3 / — |

WCAG overstates contrast in dark mode, and APCA does not. The secondary step passes WCAG at
7.41:1 but is under Lc 60. Greys of Recto's slight blue cast that reach a target:

| Target | `--surface-0` | `--surface-1` | Tier 1 over white | Tier 2 over white |
|---|---|---|---|---|
| Lc 60 | `#aeb2b8` | `#b0b4ba` | `#c4c8ce` | `#babec4` |
| Lc 75 | `#c8ccd2` | `#caced4` | `#dde1e7` | `#d3d7dd` |
| Lc 90 | `#e0e4ea` | `#e2e6ec` | `#f4f8fe` | `#ebeff5` |

Raising secondary text to about `#b0b4ba` narrows the primary/secondary gap from 2.17:1 to
1.68:1 in WCAG terms. The design-language track has to accept that, or carry hierarchy with
weight and size instead of grey.

---

## 4. Focus on glass, on light and on the page

| Ring | Worst ratio over 14 backdrops* | Where it fails |
|---|---|---|
| `#7c8cff` (today) | 1.00 (an accent fill); **2.98** on a white page; **2.22** on the rendered bar; 2.40 on a 35 % aurora | Page widgets, glass, light |
| Lime `#b3f428` alone | 1.00 (a lime fill); 1.07 on the yellow highlight; 1.32 on a white page | Page, highlights |
| White + `#08090b` (19.9:1 between bands) | 4.67 | — |
| **Lime + `#08090b`** (15.1:1) | **4.03** (over blue ink) | — |
| Accent + `#08090b` (6.69:1) | 3.03 | Below C40's 9:1, so not guaranteed |

\* Canvas, `--surface-1`, tier 1 over white (model and rendered), tier 1 over the lime core,
aurora at 25 % and 50 %, the lime core, a white page, the yellow and green highlighter tints,
blue ink, mid-grey, the accent fill and a lime fill.

W3C technique C40: "As long as the two indicator colors have a contrast ratio of at least 9:1
with each other, at least one of the two colors is guaranteed to meet 3:1 contrast with any
solid background color." It warns that "user agents commonly suppress the box-shadow property
in forced-color modes". So the light band is the `outline`, and the dark halo is the
`box-shadow`, which forced colours remove. That leaves a system-coloured outline, which is
what Windows users expect.

**Recipe.** `outline: 2px solid var(--focus-light); outline-offset: 2px;` plus
`box-shadow: 0 0 0 6px var(--focus-dark)`. The outline paints over the shadow, so the dark
colour shows in the 2 px gap and as a 2 px band outside the outline: dark, light, dark, each
2 px. Here `--focus-light` has L ≥ 0.85 (lime `#b3f428` if lime becomes the
accent, otherwise `#e6e7ea`) and `--focus-dark` is `#08090b`. Inside the capsule bar, where
DESIGN.md §5 uses a −2 px offset, the dark band goes inside the outline (inset shadow) so the
ring stays concentric. A glow may be added outside for brand, but it counts for nothing
(2.4.13 excludes "shadow and glow effects").

**Focus not obscured.** Floating chrome over the page can cover a focused form field, link,
annotation or paragraph target. The Understanding text names "sticky headers… and non-modal
dialogs" and accepts scroll padding as the fix (technique C43). The stage scroller gets
`scroll-padding` equal to the chrome insets, and focusable page targets get `scroll-margin`.
When focus lands under a floating surface, the stage scrolls it into the free rectangle; the
chrome never auto-hides to make room, because hiding moves the controls (§7). Seen through
glass, the focused item must still show a 3:1 indicator (Understanding 2.4.11, quoted in §2).

**Morphing chrome.** The bar morphs between groups, sheets rise and capsules expand.

- Focus stays on a node that persists across the morph, or moves to its declared counterpart.
- An exiting element is `inert` from the first frame of its exit. Base UI 1.8 already sets
  `inert` on closed popovers and dialog portals (`PopoverPositioner.js`, `DialogPortal.js`), but
  custom morphs must do the same.
- No element holds focus while `checkVisibility({ opacityProperty: true, visibilityProperty:
  true })` is false. That is one line in a test hook.

---

## 5. Motion: vestibular safety, replacements and control

### 5.1 What triggers symptoms, and what reduced motion replaces

Apple's HIG (Accessibility, read in full) lists what Reduce Motion should do: "reducing automatic
and repetitive animations, including zooming, scaling, and peripheral motion", "Tightening
animation springs to reduce bounce effects", "Tracking animations directly with people's
gestures", "Avoiding animating depth changes in z-axis layers", "Replacing transitions in x-,
y-, and z-axes with fades", "Avoiding animating into and out of blurs". Its Motion page adds
"Let people cancel motion… don't make people wait for an animation to complete". The visionOS
section warns against sustained oscillation "around 0.2 Hz" and against bright moving objects
in the periphery; its Color page warns against "a bright object on a very dark or black
background, especially if the object flashes or moves". That describes a vivid lime light on
near-black. W3C's Understanding 2.3.3 names parallax and scroll-linked movement. The vestibular
trigger list (scaling, spinning, parallax, multi-speed and multi-direction movement, large
displacement relative to the viewport) is established knowledge, from Val Head's *Designing
Safer Web Animation for Motion Sensitivity* (A List Apart, cited by the Understanding page).

| Effect in an expressive Recto | Full motion (limits) | Reduced motion (replacement) |
|---|---|---|
| Aurora drift | Period ≥ 20 s (≤ 0.05 Hz); blob centre ≤ 8 px/s at 1440 px; luminance swing per 341 × 256 px region < 0.10 | One still frame, no motion; opacity may settle once over 600 ms |
| Sheet, panel or popover entry | ≤ 240 ms, travel ≤ 24 px or from its anchor; spring ζ ≥ 0.9 for surfaces ≥ 25 % of the viewport | Cross-fade ≤ 150 ms, no travel |
| Bar morph between groups | ≤ 200 ms, width follows; ζ ≥ 0.8 | Instant swap or 100 ms cross-fade |
| Small control feedback (press, toggle) | Scale 0.96–1.0, spring ζ ≥ 0.7 (overshoot ≤ 5 %) | Colour or opacity change only |
| Programmatic zoom (keys, fit) | ≤ 200 ms ease-out, no overshoot | Snap |
| Pinch, pan, drag, ink | Tracks the gesture 1:1 | Unchanged (direct manipulation is essential) |
| Scroll to a search hit or outline target | Smooth ≤ 300 ms | Jump (`scroll-behavior: auto`) |
| View change (Home ↔ document, mode) | Shared-element morph ≤ 250 ms | Cross-fade ≤ 150 ms, or none |
| Blur in or out (frosting a surface) | Never animate the filter (research 13 §4.2.5); fade the surface | Same |
| Parallax or scroll-linked light | Not allowed | Not allowed |
| Spinner | Rotation | Determinate bar or an opacity pulse ≥ 1 s period (opacity is not motion per WCAG) |

Spring arithmetic, for whichever library is chosen: the damping ratio is `ζ = c / (2√(k·m))`
and the overshoot is `exp(−πζ / √(1 − ζ²))`. Stiffness 400, damping 40, mass 1 gives ζ = 1.0:
no overshoot, 2 % settling in about 0.29 s. Stiffness 500, damping 32 gives ζ = 0.72: 4.0 %
overshoot, 2 % settling in about 0.25 s.

### 5.2 Measured gaps in today's reduced-motion handling

M4, Chromium 141 with `prefers-reduced-motion: reduce` emulated and Recto's global rule
(`*, *::before, *::after { animation-duration: 0.01ms !important; … }`) in place:

| Animation kind | Result under the rule |
|---|---|
| CSS animation (3 s infinite) | 0.01 ms, 1 iteration: stopped |
| Web Animations API (`el.animate`, 2 s infinite) | **2000 ms, infinite: still running** |
| View Transition (1.2 s group animation) | **1292 ms: still running.** The selector does not match `::view-transition-*`, and the browser does not shorten transitions by itself (1523 ms with no rule at all) |

`FloatingToolbar.tsx`, `page-drag.ts` and `straighten.ts` each check `matchMedia` themselves
today. The redesign will add a spring library, a JS-driven aurora and View Transitions, so
**one `motion` module** must be the only source of truth. It reads the media query and the
in-app setting, and every JS animation asks it. A test sweeps `document.getAnimations()` after
each state change to prove it (§13 A-9).

### 5.3 The aurora and 2.2.2

A drifting light starts automatically and runs beside the work, so after 5 s WCAG requires "a
mechanism for the user to pause, stop, or hide it". The Understanding page recommends "a single
mechanism… that affects all these elements at the same time", and says that pausing only while
something has focus does not count. Recto therefore gets a **Motion** setting (Settings →
Appearance and the palette: *System · Reduced*), stored as `data-motion` on the root next to
`data-transparency`, and matched by the same CSS blocks as the media query. `navigator.preferences`
from Media Queries 5 would let a site override the media query itself, but it exists only behind
Chromium's experimental flag (BCD) and is undefined in Chromium 141.

The stricter policy this track recommends, for attention as well as WCAG: **ambient light
moves only on Home, on empty states and on the About page.** In Read and Edit it is a still
frame that changes only as feedback (a drop, a mode change, an export), in bursts of 2 s or
less. It also pauses on `visibilitychange` and while a stroke, drag or pinch is in progress, so
it never competes with ink latency.

### 5.4 Flash and oscillation, computed

Lime core over the canvas, opacity modulated sinusoidally:

| Opacity | Period | Y range | Max change within 1 s | General flash? |
|---|---|---|---|---|
| 0.20 ± 0.10 | 24 s | 0.014–0.073 | 0.009 | No: the swing is under 0.10 |
| 0.25 ± 0.15 | 12 s | 0.014–0.127 | 0.033 | A 0.113 swing, but 0.08 per second |
| 0.35 ± 0.25 | 5 s | 0.014–0.283 | 0.178 | 0.2 Hz, Apple's sensitive band |
| 0.35 ± 0.35 | 1 s | 0.003–0.392 | 0.389 | 1 per second, below the 3/s limit but far too strong |

Keeping each region's swing under 0.10 relative luminance means nothing can ever count as a
flash, at any speed. That is a stronger and simpler rule than counting flashes. With the core
lime it means opacity amplitude ≤ ±0.10 around ≤ 0.20.

### 5.5 View Transitions and input

Measured (M4): while a transition animates, `elementFromPoint` returns `<html>`, and a click
lands on `<html>` and is lost. Adding `::view-transition { pointer-events: none }` did not
change this. That matches the spec: during rendering suppression, "all pointer hit testing must
target its document element", and captured elements "do not respond to hit-testing". Focus set
inside the update callback is live at once (`activeElement` was the new button), and the spec
says the transition tree "is not exposed to the accessibility tree". So:

- View Transitions only for navigation-level changes the user just triggered, ≤ 250 ms.
- Never for things that repeat quickly, such as tool and group switching, the palette, menus or
  page flips. Those animate with per-element transforms that do not block input.
- Focus is set inside the update callback, never after `finished`.

---

## 6. User preferences and platform settings

### 6.1 Support (BCD 8.1.4, 2026-10-01)

| Feature | Chrome / Edge | Firefox | Safari / iOS | Consequence |
|---|---|---|---|---|
| `prefers-reduced-motion` | 74 / 79 | 63 | 10.1 / 10.3 | Universal |
| `prefers-reduced-transparency` | 118 | 113 **behind** `layout.css.prefers-reduced-transparency.enabled` | **No** ([WebKit 175497](https://webkit.org/b/175497)) | The in-app setting stays mandatory |
| `prefers-contrast` | 96 | 101 | 14.1 / 14.5 | macOS and iOS Increase Contrast reach CSS |
| `forced-colors` | 89 / 79 | 89 | 16 (never active: no forced-colours mode on Apple platforms) | Windows contrast themes |
| `forced-color-adjust` | 89 | 113 | No | — |
| `backdrop-filter` | 76 | 103 (unknown GPU vendors only from 123) | 18, `-webkit-` from 9 | Keep the `@supports` gate |
| View Transitions (same-document) | 111 | 144 | 18 | Usable everywhere, with §5.5's limits |
| `@starting-style` | 117 | 129 | 17.5 | Entry fades without JS |
| `inert` | 102 | 112 | 15.5 | Exit-phase inertness |
| `contrast-color()` | 147 | 146 | 26 | Too new to rely on |
| `navigator.preferences` (override API) | 120 behind a flag | No | No | Not usable |

### 6.2 Forced colours, measured

Chromium 141 with `forcedColors: 'active'` emulated (M3), on a glass element:

| Property | Computed | Spec (`css-color-adjust-1`) |
|---|---|---|
| `background-color: rgb(48 51 58 / .66)` | `rgba(255, 255, 255, 0.66)`: **alpha kept** | "its alpha channel is taken from the original" |
| `backdrop-filter` | **unchanged** (`blur(28px) brightness(0.45)`) | Not in the forced list |
| `filter` | unchanged | Not in the list |
| `box-shadow` | `none` | Forced to `none` |
| `background-image: linear-gradient(…)` | `none` (kept under `forced-color-adjust: none`) | `none` "unless … url()" |
| `outline-color`, `border-color`, `color` | System colours | Forced |
| Rendered glass over a white page | `#d2d2d2`, not `Canvas` `#ffffff` | — |

So glass must be flattened explicitly. `tokens.css` already sets every tier to `Canvas` with
`filter: none` under `forced-colors: active`, which is right; the new surfaces must keep doing
it. A CSS-gradient aurora disappears by itself, but **a canvas, WebGL or SVG-filter aurora does
not**, so it gets `display: none` under forced colours. The two-band focus ring loses its
`box-shadow` band and keeps the system-coloured outline, as intended. Under emulation,
`prefers-contrast: more` also matched.

### 6.3 Recto's settings model

Apple ended up with three looks: Clear, Tinted, and Reduce Transparency as an accessibility
override (§7). Microsoft falls back to solid under Battery Saver, transparency off and on
low-end hardware (research 13 §1). Recto today has one switch (Reduce transparency) and the
trial "Glass panels". Proposed:

| Setting | Values | Default | Overridden by |
|---|---|---|---|
| **Glass** | *Clear* (the M9 look) · *Tinted* (tint alpha ≥ 0.90 on text-bearing glass: AA whatever the filter does, §3.2) · *Solid* (every tier on its solid token, rings kept) | Clear | `prefers-reduced-transparency: reduce` → Solid; `prefers-contrast: more` → Solid with strong borders; forced colours → `Canvas` |
| **Motion** | *System* · *Reduced* | System | `prefers-reduced-motion: reduce` → Reduced |
| **Light** (the aurora) | *On* · *Still* · *Off* | On | Reduced motion → Still; forced colours → Off; more contrast → intensity × 0.5 |

As on iOS 26.1, the Glass picker reads "Solid (set by your system)" and is disabled while an OS
preference forces it. Each value is a root attribute (`data-glass`, `data-motion`, `data-light`),
matched by the same blocks as the media queries; `tokens.test.ts` keeps them identical, as it
does today for transparency.

---

## 7. Liquid Glass: the public criticism and Apple's answer

All rows rest on search abstracts except the HIG quotes, which were read in full.

| What happened | Source | Lesson for Recto |
|---|---|---|
| NN/g ("Liquid Glass Is Cracked, and Usability Suffers in iOS 26", Raluca Budiu, Oct 2025): "shrunken and crowded tab bars, collapsing navigation, touch targets that no longer meet the 0.4cm minimum spacing threshold, and translucent controls that blend into visually noisy backgrounds"; the interface is "restless, needy, less predictable, less legible" | WebProNews, anderegg.ca, Roger Wong (abstracts) | Chrome keeps its place and size: no collapsing or shrinking on scroll. Ambient motion stays still during work. Targets keep their spacing. |
| Infinum measured some screens at 1.5:1 | WebProNews / Infinum (abstract) | Test the rendered worst case, not the intended one (§3.2) |
| iOS 26.1 added Settings → Display & Brightness → Liquid Glass: *Clear* or *Tinted*; Tinted "increases opacity and adds more contrast" | Engadget, MacRumors, Stuff, Tom's Guide (abstracts) | Ship Clear · Tinted · Solid from day one (§6.3) |
| The picker cannot be changed while Reduce Transparency or Increase Contrast is on | Engadget, MacRumors (abstracts) | Accessibility preferences override aesthetic ones, and the UI says so |
| Reduce Transparency makes menus and buttons solid; Increase Contrast adds borders | TechRadar, webnots (abstracts); research 13 §1 | Keep both and go further: solid plus strong borders under `more` |
| Low-vision users called it "distracting and an accessibility nightmare" | Apple Community, New England Low Vision (abstracts) | Treat Solid as a first-class look, designed and screenshotted, not a degraded mode |
| HIG, Sep 2025: "Liquid Glass appears more opaque in larger elements like sidebars"; "make sure its default or resting state… maintains clear legibility"; for clear glass over bright content, "consider adding a dark dimming layer of 35% opacity" | HIG Color and Materials (read in full) | Bigger glass is denser. The resting state is the legibility test. Bright backdrops get a dimming layer, which is Recto's `brightness()` cap. |

---

## 8. Screen readers, live regions and keyboard through floating chrome

- **Decorative layers are invisible to assistive technology.** That covers the aurora, glass
  highlight and edge layers, and the masked filter layer of §3.2: `aria-hidden="true"`, no role,
  `pointer-events: none`. A test asserts they are absent from `ariaSnapshot()`.
- **Announce at the state change, not at the animation's end.** The current announcer
  (`shell/announcer.ts`) batches messages within a task and replaces keyed ones. Keep that: one
  announcement per user action, so a morph never delays or doubles speech.
- **When an action moves focus, the focused control's name carries the news.** A mode change
  focuses the segment named "Edit mode", rather than also saying "Edit mode" in the live region.
  Screen readers can drop a polite message that arrives with a focus change; this is established
  practice, to be verified with VoiceOver and NVDA.
- **Keyboard first.** Every floating surface is a member of the F6 cycle (today: title bar →
  navigator → stage → tool bar → inspector). Esc closes the topmost floating surface and returns
  focus to its trigger. Chrome never auto-hides while focus or the pointer is inside it. Roving
  tabindex stays inside capsules (DESIGN.md §5).
- **Time-boxed glass.** Toasts with an action stay at least 10 s, pause on hover and focus, and
  can be reached with F6. Apple: "Minimize use of time-boxed interface elements… Prefer
  dismissing views with an explicit action."

---

## 9. Targets on a dense pro tool, by pointer

Apple's minimums are 28 × 28 pt default and 20 × 20 pt minimum on macOS, and 44 × 44 pt default
and 28 × 28 pt minimum on iOS and iPadOS. Its padding guidance is about 12 pt around bezeled
elements and 24 pt around bezel-less ones (HIG Accessibility). WCAG sets 24 px (AA) and 44 px
(AAA).

Measured on the shipped Edit state (M2):

| Context | Targets | < 24 px | < 32 px | < 44 px | Notes |
|---|---|---|---|---|---|
| 1440 × 900, mouse | 34 | 5 (navigator resize handle 7 px wide; privacy readout, zoom −, zoom value, zoom + at 22 px tall) | 21 | 26 | axe `target-size` passes all of them via the spacing exception |
| 390 × 844, touch, `isMobile` | 34 | 5 | 21 | 26 | **The same desktop sizes.** There is no `pointer: coarse` adaptation. The mode control is overlapped and the bar runs off the right edge. |

Rule: the fine-pointer layout may stay dense (28 px controls, 24 px swatches), but under
`(pointer: coarse)` or `(any-pointer: coarse)` every target is at least 44 × 44 CSS px. Hit areas
may extend beyond the visible shape with a pseudo-element, but must not overlap one another.
Hybrid devices (an iPad with a trackpad, a Surface) report `any-pointer: coarse` and get the
large targets.

---

## 10. Low-vision zoom (200–400 %) with floating chrome

Browser zoom shrinks the CSS viewport, so breakpoints in CSS px are what make zoom work. Measured
on the shipped build:

| Viewport | Equivalent | Horizontal overflow | Visible page area | Bar |
|---|---|---|---|---|
| 720 × 450 | 200 % of 1440 × 900 | 14 px | 47 % | 436 × 44, whole |
| 320 × 256 | 400 % of 1280 × 1024 | **110 px** | 39 % | Clipped (176 px visible); mode control off-screen |
| 360 × 225 | 400 % of 1440 × 900 | 90 px | 35 % | Clipped |

The page is exempt from Reflow, but the chrome is not ("interfaces where it is necessary to
keep toolbars in view" excuses the toolbar existing, not it being cut off). At 320 × 256 the
redesign must show the phone layout: one bar of at most 5 visible controls plus an overflow menu,
and no title-bar row beyond a back button and a title. All floating chrome together covers at
most 25 % of the viewport, and a pan or zoom of the page is never needed to reach a control.
Floating surfaces anchor to the viewport, not to the page, so zooming the page never carries
chrome off-screen.

---

## 11. Colour-blind safety of a lime accent

Candidates in sRGB gamut: aurora core `oklch(0.93 0.21 122)` = `#d1fd39`, lime accent
`oklch(0.89 0.22 127)` = `#b3f428` (15.03:1 on `--surface-0`, 1.33:1 on white, `#08090b` labels
on it 15.03:1, APCA 87.8).

ΔE_OK × 100 between pairs (normal / protan / deutan / tritan):

| Pair | Distances | Reading |
|---|---|---|
| Lime vs yellow highlighter `#FFEA00` | 9.7 / **0.1** / 3.8 / 9.3 | Identical under protanopia |
| Lime core vs yellow highlighter | 7.0 / 2.8 / 1.6 / 6.9 | Indistinguishable for both red-green types |
| Lime vs green highlighter `#8CF26B` | 5.2 / 4.0 / 5.2 / 5.3 | Close for everyone |
| Lime vs `--warning` `#f5c451` | 15.6 / 10.5 / **5.1** / 14.8 | Poor under deuteranopia |
| Lime vs `--success` `#5fd39a` | 16.7 / 15.5 / 17.2 / 13.5 | Distinct |
| Lime vs `--danger` `#ff6b6b` | 36.5 / 32.1 / 19.1 / 33.6 | Distinct |
| Lime vs `--accent` `#7c8cff` | 43.0 / 40.8 / 41.1 / 23.3 | Distinct |
| `--success` vs `--danger` (today) | 30.3 / 19.8 / **7.5** / 35.1 | Already weak under deuteranopia |
| Green ink vs red ink (today) | 32.6 / 12.3 / **6.9** / 34.2 | Already weak; the inks are content, so names and dots carry them |

Simulated, the lime becomes `#ffe300` (protan) and `#f8df42` (deutan): a yellow. Rules:

- **Lime never marks the page.** Search hits, the current hit, text selection and drop targets
  on the page keep a hue far from the highlighter tints. A lime selection over a yellow
  highlight would be invisible to about 1 % of men (protan prevalence, established knowledge).
- **Lime never carries state alone.** It is never paired with warning as two meanings. Success
  carries a check glyph, warning a triangle, danger a cross or the word.
- **Lime text needs a dark lime on light grounds**: `oklch(0.55 0.16 128)` = `#568100` gives
  4.63:1 on white, if a light theme ships.

---

## 12. Turkish in compact glass chrome

Measured on `apps/web/messages` (2,245 string pairs, placeholders replaced by one character):

| Statistic | TR/EN length |
|---|---|
| Median | 1.09 |
| 75th / 90th / 95th percentile | 1.30 / 1.57 / 1.78 |
| Short labels (≤ 12 EN characters, n = 923): median / 90th percentile | 1.13 / 1.78 |
| Extremes | "Zoom" → "Yakınlaştırma" 3.25; "Resize" → "Yeniden boyutlandır" 3.17; "Rename" → "Yeniden adlandır" 2.67 |
| All characters | +8.2 % |

Rendered (M2): the tool bar is 435.6 px in English, 456.0 px in Turkish (+4.7 %), and 503.1 px
in Turkish under 1.4.12 spacing (+15.5 %). The mode control (Okuma · Düzenleme · Sıralama) fits
at 247 px in both. **Under text spacing, the 64 px navigator rail truncates "Dosyalar" to
"Dosyal…"**, a loss of content under 1.4.12.

Casing (M6, Chromium 141):

| Input | CSS | Result | Correct? |
|---|---|---|---|
| "içindekiler ilk ışık", `lang="tr"` | `uppercase` | İÇİNDEKİLER İLK IŞIK | Yes |
| same, `lang="en"` | `uppercase` | IÇINDEKILER ILK IŞIK | No |
| "İÇİNDEKİLER ILIK", `lang="tr"` | `lowercase` | içindekiler ılık | Yes |
| "ilk ışık", `lang="tr"` | `capitalize` | **Ilk Işık** | No (İlk Işık) |

Recto sets `<html lang>` per locale (`i18n/locale.ts`), so the 17 uppercase labels in the CSS
modules are right. `capitalize` is not, and neither is any JS `toUpperCase()` without a locale.
`model.ts` and `labels.ts` already pass `getLocale()`. `viewer/search.ts` and
`navigation.ts` call `toLocaleLowerCase()` with no argument, so the browser's locale decides
how "İ" folds. That is outside this track; noted for the i18n owner.

Glyph extents, Inter 500 (M6): at 13 px, "İ" and "Ğ" rise 13 px above the baseline against 9 px
for "I", and "Ş" and "Ç" descend 3 px. In a 13/16 line box the top edge sits 13 px above the
baseline, which leaves **no headroom** for the dot of İ. At 12/16 the headroom is 0.5 px. Any
chrome text inside `overflow: hidden`, `text-overflow: ellipsis` or a `text-box-trim` box needs a
line height of at least 1.25 × the font size, or the dots and breves clip.

---

## 13. The non-negotiables

Each rule has an id for later design documents. **Test** is how CI proves it; **Fallback** is
what the effect collapses to when the rule cannot be met, or when a preference asks for it.

| Id | Rule | Test | Fallback |
|---|---|---|---|
| **A-1** | Every text token passes 4.5:1 (3:1 at ≥ 24 px, or ≥ 18.66 px bold) on the **rendered** worst-case backdrop of every surface it is used on: white for light text, black for dark text, and the aurora at its maximum intensity. Primary text targets 7:1 on resting surfaces. | `tokens.test.ts` model plus a new `e2e/glass-pixels.spec.ts`: each glass surface over a white-page fixture and over the aurora at maximum, full-viewport screenshot, median of a 4 × 4 patch in a text-free spot, ratios computed from the sample; Chromium, WebKit and Firefox | The surface's solid token |
| **A-2** | Glass keeps its luminance cap: blur σ ≤ min(w, h) / 5 for the surface's smallest rendered size, **or** the filter sits on an oversized decorative layer (box + 3σ each side, `mask-image` shaped, `pointer-events: none`, `aria-hidden`) | `tokens.test.ts` adds the coverage term `c = erf(h/(2√2σ))·erf(w/(2√2σ))` and asserts c ≥ 0.985 per surface; the pixel spec asserts the composite within ±2/255 of the model | Tinted (tint alpha ≥ 0.90) |
| **A-3** | Component boundaries, the armed state, icons and selected states reach 3:1 against their adjacent rendered colours (1.4.11); the armed fill against the bar as rendered | Pixel spec samples the armed chip and the bar beside it | 1 px `--surface-0` ring round the armed fill (research 13 §9, option C) |
| **A-4** | APCA second check on the worst case: primary chrome text \|Lc\| ≥ 75 (gate), secondary ≥ 60 (warning until the ladder moves, then a gate), icons ≥ 45, dividers ≥ 15 | `tokens.test.ts` computes Lc with `apca-w3` next to every WCAG ratio | Lift the grey (§3.4) |
| **A-5** | No text, icon or focusable control sits on bare light. On the canvas, wherever text or controls sit, the aurora keeps Y ≤ 0.026 (lime core ≤ 16 % opacity), or is masked out there | Pixel spec: Home and empty states with Light On at maximum; sample behind each text box and compare with Y ≤ 0.026 | Glass or solid plate under the text |
| **A-6** | Light never touches a PDF page: no tint, glow, blend or reflection on pages or thumbnails, and the aurora renders below the page layer | Pixel spec: page-corner pixels identical with Light On and Off | — |
| **A-7** | Ambient motion that lasts more than 5 s has a pause: the Motion and Light settings (palette and Settings), plus OS reduced motion. In Read and Edit, ambient light is still except for feedback bursts ≤ 2 s. It pauses on `visibilitychange` and during strokes, drags and pinches | e2e: with Light On, aurora animations are paused after 5 s in Read; `playState` is paused while `[data-stroking]`; the setting stops them | Light: Still |
| **A-8** | No flash at any speed: the relative-luminance swing in any 341 × 256 px region < 0.10; ambient cycles ≥ 20 s (≤ 0.05 Hz, away from 0.2 Hz); no saturated-red transitions | e2e frame sampler: 10 s of screenshots at ~10 fps over the aurora's brightest region; assert swing < 0.10 | Light: Still |
| **A-9** | Reduced motion (OS or in-app) replaces every spatial transition with a cross-fade ≤ 150 ms or nothing: no travel, scale, rotation, overshoot, parallax, blur animation, smooth scrolling or programmatic zoom animation. Direct manipulation is unchanged. One `motion` module is the only source for JS | e2e with `reducedMotion: 'reduce'`, and again with `data-motion="reduced"`: after each state change, every `document.getAnimations()` entry animates only `opacity` or colour and lasts ≤ 150 ms; View Transition pseudo-elements have `animation: none`; unit test for the module | Instant change |
| **A-10** | Full-motion limits: transitions that block input ≤ 250 ms; any transition ≤ 500 ms and interruptible; surfaces ≥ 25 % of the viewport ζ ≥ 0.9 (no visible overshoot); small controls ζ ≥ 0.7; travel ≤ 1/3 of the viewport; nothing linked to scroll position; View Transitions only for user-initiated view changes, never for repeated actions | Lint list in the motion module (allowed presets only); e2e asserts no `::view-transition` during tool and group switching | The reduced variant |
| **A-11** | Focus indicator: 2 px light `outline` (L ≥ 0.85) plus 2 px dark `#08090b` band, ≥ 9:1 between them (C40); visible on keyboard focus everywhere, including page targets and glass; glows are extra | `tokens.test.ts`: band ratio ≥ 9; pixel spec: the ring over white, the bar and the aurora ≥ 3:1 for at least one band | Forced colours: the system outline alone |
| **A-12** | A focused element is never hidden by chrome (2.4.11; target 2.4.12): the stage has `scroll-padding` equal to the chrome insets, page targets have `scroll-margin`, focus under a floating surface scrolls into the free rectangle, and chrome never auto-hides | e2e: Tab through `forms-a.pdf` fields and paragraph targets in Edit with the bar over the page; for each, the focused rect is ≥ 50 % outside every floating chrome rect | — |
| **A-13** | Keyboard through floating chrome: every floating surface is in the F6 cycle; Esc closes the top one and restores focus; exiting surfaces are `inert` from their first exit frame; no focus on an element whose `checkVisibility({opacityProperty: true, visibilityProperty: true})` is false | Global `focusin` hook in e2e failing on invisible focus; the existing F6 test extended to the new surfaces | — |
| **A-14** | Assistive technology: decorative layers `aria-hidden` and out of the tab order; one announcement per action, said at the state change; focus set in the View Transition update callback; status via the polite region (4.1.3) | `ariaSnapshot()` excludes decor; announcer unit tests; axe on every state in EN and TR | — |
| **A-15** | Targets ≥ 24 × 24 or spaced (2.5.8) with a fine pointer; ≥ 44 × 44 under `pointer: coarse` or `any-pointer: coarse`; hit areas never overlap | e2e target audit in two projects: desktop, and touch (`hasTouch`, `isMobile`); axe `target-size` stays on | — |
| **A-16** | Forced colours: every glass tier `Canvas` with filters off; aurora `display: none`; armed and selected states in `Highlight` / `HighlightText`; nothing relies on `box-shadow` or `background-image` | e2e with `forcedColors: 'active'`: computed `backdrop-filter: none` on every glass, aurora hidden, armed chip background equals `Highlight`; axe passes | — |
| **A-17** | Glass setting Clear · Tinted · Solid; `prefers-reduced-transparency` forces Solid where supported; the picker says when the system decides | `tokens.test.ts`: media and attribute blocks identical; e2e per value | Solid |
| **A-18** | Increased contrast (`prefers-contrast: more`): solid surfaces, `--border-strong` 0.36, lifted text ladder, no highlight, Light at half intensity, focus outline 3 px | `tokens.test.ts` block assertions; e2e screenshot set | — |
| **A-19** | Colour is never the only signal (1.4.1). Lime is never used on the page and never as a state colour next to warning. State-colour pairs that co-occur without a shape cue keep ΔE_OK ≥ 10 under protan, deutan and tritan simulation | Palette test (like `palette.test.ts`) with Machado 2009 matrices over the declared state pairs | Add a glyph or label |
| **A-20** | Zoom and reflow: breakpoints in CSS px; at 320 × 256 and 360 × 640 no horizontal overflow of the chrome, every control reachable (visible or in an overflow menu), floating chrome ≤ 25 % of the viewport; floating surfaces anchor to the viewport | e2e at 320 × 256, 360 × 640 and 720 × 450: `scrollWidth ≤ innerWidth`; reachability of the mode, tool and export commands; chrome-area sum | Overflow menu |
| **A-21** | Text spacing and Turkish: no fixed-width text containers in chrome; labels designed at 1.8 × English length; never `text-transform: capitalize`; uppercase only under `lang`; JS case mapping always passes the locale; line height ≥ 1.25 × font size where text can clip | e2e in EN and TR, with and without the 1.4.12 stylesheet: no chrome label with `scrollWidth > clientWidth`; grep check bans `capitalize` and argument-less `toUpperCase` / `toLocaleUpperCase` in UI code | Icon plus tooltip, with the full name as the accessible name |
| **A-22** | Every expressive effect is an enhancement over a complete solid UI: with Glass Solid, Motion Reduced, Light Off and no `backdrop-filter` support, the app is fully usable and passes A-1 to A-21 | The whole a11y spec runs in a second "plain" project | — (this *is* the fallback) |
| **A-23** | Effects never cost input: no ambient animation under a blurring surface while content scrolls; light paused during ink, drag and pinch; glass over moving content is measured by research 14's method before it ships | e2e as in A-7; performance spec trend | Light Still, then Glass Tinted |
| **A-24** | Hover and focus content (glass tooltips, cards) is dismissible with Esc, hoverable and persistent (1.4.13); toasts with actions stay ≥ 10 s and pause on hover or focus | e2e on the tooltip and toast primitives | — |

### Test plan in files (names proposed)

- `apps/web/src/styles/tokens.test.ts`: the coverage term (A-2), APCA (A-4), the two-band ring
  (A-11), the three settings blocks (A-17, A-18), and dark-text worst cases if a light theme ships.
- `apps/web/e2e/glass-pixels.spec.ts`: A-1, A-3, A-5, A-6 and A-11, in all three engines,
  full-viewport screenshots only.
- `apps/web/e2e/motion.spec.ts`: A-7 to A-10, A-23; the animation sweep and the frame sampler.
- `apps/web/e2e/a11y.spec.ts` (extended): A-12 to A-16, A-20, A-21, A-24; the "plain" project
  for A-22; a matrix of {default, Solid, more contrast, both, forced colours} × {EN, TR}, as the
  HIG asks ("both separately and together").
- Manual, once per milestone: VoiceOver (macOS and iPadOS) and NVDA on Windows through
  open → read → edit → export; a Windows contrast theme; the owner's GPU machine for A-2.

---

## 14. Tensions with current decisions

1. **Research 14 §4.3 calls contrast "final".** It was modelled, not rendered. The rendered
   floating bar fails 1.4.3 and 1.4.11 in Chromium (§3.2). Reopen it. The cheapest correct
   change today is blur 8 px on the 44 px bar, or Tinted.
2. **`tokens.test.ts`'s premise**, "Uniform backdrops are the worst cases: a large white area
   stays white under any blur", holds in the spec but not in the rendered result for short
   elements. Add the coverage term.
3. **DESIGN.md §1, "Nothing glows".** The owner's brief replaces it. This track's condition is
   that light lives behind glass and in text-free canvas, never on pages or under text (A-5,
   A-6).
4. **DESIGN.md §3 text ladder.** It passes WCAG, but `--text-secondary` and `--text-tertiary`
   reach only Lc 43–50 under APCA (§3.4). Lifting them compresses the ladder.
5. **DESIGN.md §5 focus ring** (`2px solid var(--accent)`, 2.98:1 on a white page, 2.22:1 on the
   rendered bar) becomes the two-band ring (A-11).
6. **DESIGN.md §3 motion: "No bouncing, no springs in the chrome."** Springs with ζ ≥ 0.7 to 0.9
   are acceptable under A-10, with no overshoot on large surfaces and none at all under reduced
   motion.
7. **Reduce transparency as a single switch** becomes Glass Clear · Tinted · Solid, plus Motion
   and Light settings (§6.3).
8. **"Glass panels" (default off, trial)** depends on A-2 for its 28–40 px bars.

---

## 15. Open questions for the owner

1. Is the edge loss of §3.2 present on your machine (Chrome on a GPU, Safari)? The probe is
   one page and takes a minute to run.
2. Should the accent become lime? If so, which hue moves away from the highlighter yellow for
   on-page marks (§11)?
3. Is a still aurora in Read and Edit acceptable, with motion only on Home, empty states and
   About plus brief feedback (§5.3)? WCAG allows continuous motion only with a pause control.
4. Should Tinted be the default for the docked frame and Clear for floating chrome, mirroring
   Apple's "more opaque in larger elements"?
5. Can secondary text be lifted to about `#b0b4ba`, accepting a flatter grey hierarchy, so
   that APCA becomes a gate?

---

## Sources

Read in full (primary sources, local clones or packages):

- WCAG 2.2 success criteria, Understanding documents, techniques C39, C40, C41, C43, C44, C45,
  G18, G145, G195, G207 and the definitions of *motion animation*, *general flash and red flash
  thresholds*, *blinking* and *relative luminance*: [github.com/w3c/wcag](https://github.com/w3c/wcag) (`guidelines/sc/*`, `understanding/*`, `techniques/*`, `guidelines/terms/*`)
- Filter Effects 2, backdrop-filter operation and edge mode: [csswg-drafts/filter-effects-2](https://github.com/w3c/csswg-drafts/tree/main/filter-effects-2)
- CSS Color Adjustment 1, properties affected by forced colours: [csswg-drafts/css-color-adjust-1](https://github.com/w3c/csswg-drafts/tree/main/css-color-adjust-1)
- Media Queries 5, `prefers-reduced-transparency`, `prefers-contrast`, PreferenceManager: [csswg-drafts/mediaqueries-5](https://github.com/w3c/csswg-drafts/tree/main/mediaqueries-5)
- CSS View Transitions 1, hit testing and the accessibility tree: [csswg-drafts/css-view-transitions-1](https://github.com/w3c/csswg-drafts/tree/main/css-view-transitions-1)
- Apple HIG (JSON data): [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [Motion](https://developer.apple.com/design/human-interface-guidelines/motion), [Color](https://developer.apple.com/design/human-interface-guidelines/color), [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode), [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons), [Layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)
- `@mdn/browser-compat-data` 8.1.4: [npmjs.com/package/@mdn/browser-compat-data](https://www.npmjs.com/package/@mdn/browser-compat-data)
- `apca-w3` 0.1.9 README, `docs/APCA_in_a_Nutshell.md`, `src/apca-w3.js`: [github.com/Myndex/apca-w3](https://github.com/Myndex/apca-w3)
- `axe-core` 4.13.0 (`axe.js`: `target-size`, `color-contrast`, `ruleShouldRun`) and `@base-ui/react` 1.8.0 (`PopoverPositioner.js`, `DialogPortal.js`), from this repository's `node_modules`
- Recto sources: `docs/DESIGN.md` §1–§5, `docs/research/13-glass-and-modes.md` §3–§4, `docs/research/14-glass-spike.md` §4, `apps/web/src/styles/{tokens.css,global.css,tokens.test.ts}`, `apps/web/e2e/a11y.spec.ts`, `apps/web/src/shell/{announcer.ts,LiveRegion.tsx}`, `apps/web/messages/{en,tr}.json`

Known only from search abstracts:

- NN/g on iOS 26 (Raluca Budiu, "Liquid Glass Is Cracked, and Usability Suffers in iOS 26"), via [anderegg.ca](https://anderegg.ca/2025/10/12/nielsen-norman-group-on-ios-26-usability), [WebProNews](https://www.webpronews.com/apples-ios-26-liquid-glass-design-draws-usability-critique-from-experts/) and [Roger Wong](https://rogerwong.me/2025/10/liquid-glass-is-cracked-and-usability-suffers-in-ios-26)
- [Infinum: "Apple's iOS 26 Liquid Glass: Sleek, Shiny, and Questionably Accessible"](https://infinum.com/blog/apples-ios-26-liquid-glass-sleek-shiny-and-questionably-accessible/)
- iOS 26.1 Clear/Tinted: [Engadget](https://www.engadget.com/mobile/smartphones/how-to-adjust-the-liquid-glass-effect-in-ios-261-203634681.html), [MacRumors](https://www.macrumors.com/how-to/ios-26-1-reduce-liquid-glass-effects/), [Stuff](https://www.stuff.tv/news/ios-26-1-liquid-glass-clear-tinted/), [Tom's Guide](https://www.tomsguide.com/phones/iphones/ios-26-1-lets-you-adjust-liquid-glass-transparency-on-your-iphone-heres-how-to-do-it), [Gulf News](https://gulfnews.com/technology/companies/apple-yields-tinted-control-in-ios-261-beta-4-tones-down-liquid-glass-after-backlash-1.500315176), [Yahoo Tech](https://tech.yahoo.com/ai/apple-intelligence/articles/ios-26-1-beta-4-100125001.html)
- Reduce Transparency and Increase Contrast with Liquid Glass: [TechRadar](https://www.techradar.com/phones/ios/not-vibing-with-liquid-glass-in-ios-26-heres-how-to-make-it-easier-on-the-eyes), [webnots](https://www.webnots.com/how-to-reduce-liquid-glass-effect-on-iphone-and-mac/), [OS X Daily](https://osxdaily.com/2026/04/20/how-to-disable-liquid-glass-on-ios-26-for-iphone-as-much-as-possible/), [New England Low Vision](https://nelowvision.com/apples-ios-26-design-changes-a-game-changer-for-low-vision-users-and-accessibility-innovation/), [Apple Community thread](https://discussions.apple.com/thread/256136970)

Established knowledge (not fetched this session):

- Val Head, [Designing Safer Web Animation for Motion Sensitivity](http://alistapart.com/article/designing-safer-web-animation-for-motion-sensitivity), and Eric Bailey, [An Introduction to the Reduced Motion Media Query](https://css-tricks.com/introduction-reduced-motion-media-query/), both cited by WCAG Understanding 2.3.3
- Machado, Oliveira and Fernandes, "A Physiologically-based Model for Simulation of Color Vision Deficiency" (IEEE TVCG, 2009), severity-1.0 matrices
- Björn Ottosson, [A perceptual color space for image processing](https://bottosson.github.io/posts/oklab/) (OKLab)
- [WebKit bug 175497](https://webkit.org/b/175497) (`prefers-reduced-transparency`), linked from BCD
