---
title: "Research: type, icons, colour and the expensive feel"
date: 2026-10-04
status: snapshot
---

> Research snapshot gathered on 2026-10-04 for the M9 redesign. Apple's guidance was read in full
> from the JSON data behind the Human Interface Guidelines (`developer.apple.com/tutorials/data/…`:
> materials, color, typography, sf-symbols, icons, dark-mode, layout, buttons, toolbars, branding,
> feedback, loading, launching, onboarding, playing-haptics, writing). Fonts were measured from the
> npm tarballs (`@fontsource-variable/*` 5.3.x, `inter-ui` 4.1.1, `geist` 1.7.2) with fontTools:
> axes, OpenType features, Turkish coverage, metrics and woff2 sizes, plus custom subsets cut with
> `pyftsubset`. Icon sets were compared from their `@iconify-json/*` packages, `lucide-react`
> 1.52.0 and `@phosphor-icons/react` 2.1.10; animated icons from a clone of `pqoqubbw/icons`;
> toast and sheet constants from clones of `emilkowalski/sonner` and `emilkowalski/vaul`; browser
> support from `@mdn/browser-compat-data` 8.1.4 (2026-10-01); reference scales from `tailwindcss`
> 4.3.3 and `@radix-ui/colors` 3.0.0. Specimens, icon sheets, colour mocks and squircle tests were
> rendered in headless Chromium 141 and inspected. All contrast ratios, OKLCH values and glass
> composites were computed for this document with the same sRGB compositing model as
> `apps/web/src/styles/tokens.css` (backdrop × brightness, then the tint over it; OKLCH with
> Ottosson's matrices; APCA 0.0.98G constants). rsms.me and linear.app were blocked by the egress
> proxy, and the session's web-search budget ran out part-way, so claims about Linear, Things,
> Notability, Arc, Family and Inter's dynamic metrics rest on search abstracts or established
> knowledge and are marked as such. No other file was changed.

# Type, icons, colour and the expensive feel

## 0. Verdict

- **Keep Inter, but ship it properly.** No open-licensed face beat Inter on the things Recto
  needs at 11–13 px (x-height 0.546 em, the tallest of 26 families measured, tied with Inter
  Tight; tabular figures; full Turkish; an optical-size axis). What Recto lacks is the delivery: Fontsource's Inter has
  no `opsz` in the file Recto imports and strips every stylistic set and `case`. A self-hosted
  subset of upstream Inter 4.1 with `opsz` and the needed features is 73.4 KB for Latin plus
  24.6 KB for Turkish (today: 47.1 KB, and 130.2 KB once a Turkish character appears).
- **Switch icons to Phosphor, regular + fill.** All six major sets cover Recto's 39 core
  concepts, but only Phosphor has a designed fill variant for every one of them (Tabler: 23 of
  39, Lucide: none). Apple's rule is outline at rest and fill for selection; with it the armed
  tool reads at a glance. Generate the ~90 icons Recto uses at build time (about 18 KB gzip of
  path data); do not use `@phosphor-icons/react`, which ships all six weights in every icon.
- **Lime becomes the interactive accent in the chrome, and stops being the page selection
  colour.** `#c8fb3d` (oklch 0.92 0.21 124) as a fill with an ink label is 16.4:1, and it holds
  7.4:1 against the floating glass over a white page, where today's periwinkle manages 3.03:1.
  That frees the glass from the accent constraint that research 13 hit. On paper lime fails
  (1.21:1 on white) and collides with the yellow and green highlighters, so selection on the
  page gets its own colour, `#4e61ed` (4.93:1 on white), as macOS separates accent and
  highlight colours. Today's periwinkle rings on the page are 2.98:1, just under WCAG 1.4.11.
- **"Lime always touches ink."** Dark theme: lime fill, ink label. Light theme: ink fill, lime
  label or glyph (14.8:1). Lime is never text on a light surface and never a wash on paper.
- **Four colour roles that never mix:** atmosphere (the aurora), interaction (lime), content
  (ink palette of ADR-0021, the page and its selection colour) and status (danger, warning,
  signature validity). Neutrals are a cool graphite (hue 265, chroma ≤ 0.012), so the warm lime
  light sits on cool shadows.
- **The aurora is the reason glass exists, and also the reason text must sit on glass.** Over
  the bare dark canvas, an aurora above 15 % opacity drops tertiary text below 4.5:1, and at
  45 % even primary text falls to 4.2:1. Under glass, the brightness cap keeps the white page the
  worst case (primary 10.5:1 over the aurora's peak).
- **Shape:** a 4/8/12/16/20/28 + capsule radius scale with concentric nesting; squircles
  (`corner-shape`, Chromium 139+ only) as an enhancement at radius × 1.35, never on capsules;
  a two-layer glass edge (inner rim plus outer ring) and a five-step elevation scale. Controls
  never glow; light belongs only to the atmosphere layer. That is how "nothing glows" survives.
- **The expensive feel is mostly restraint and finish,** not effects: one lime element per view,
  three type sizes per surface, optical centring, tabular numbers, choreographed loading, and
  empty states with one sentence and one action. No sound. Haptics only through Android's
  Vibration API; iOS Safari has none that a script can rely on.

---

## 1. What changes and what does not

| Area | Today (DESIGN.md, tokens.css) | Brief (2026-10-04) | This document |
|---|---|---|---|
| Intent | "Quiet, dense, professional; nothing glows" | Glass everywhere, lights, aurora, motion, "smart, rich, expensive" | Controls stay quiet; light lives in the atmosphere behind glass (§4.7, §5.4) |
| Accent | One periwinkle `#7c8cff` for focus, selection, primary action (ADR-0021 §4) | Lime aurora | Lime for chrome interaction; a separate blue for content selection (§4.3, §4.4) |
| Type | Inter (Fontsource `wght` only), 13/12/11 px, uppercase tracked labels | Native, mobile-comfortable | Inter 4.1 subset with `opsz`; a scale from 11 to 56 px; a touch scale (§2) |
| Icons | Lucide, 1.5 stroke, 16/20 px, no fill states | Native feel like Preview/Notability | Phosphor regular + fill, 16/20/24 px, fill on selection (§3) |
| Themes | Dark only | Mobile and PC, presentable | Dark first, light equal (§4.9) |
| Shape | 2/4/6/10/capsule; one elevation | Floating objects | 4–28 + capsule, concentric; e0–e4 (§5) |

Unchanged: the page is never themed or tinted; ink and highlighter colours stay those of ADR-0021
(they are user content, stored as DeviceRGB); every glass tier keeps a luminance cap and a solid
fallback; `tokens.test.ts` keeps asserting every ratio.

---

## 2. Typography

### 2.1 Candidates

All 26 families below are OFL-1.1 and contain every Turkish letter (ğ Ğ ş Ş ı İ ç Ç ö Ö ü Ü).
Sizes are the Fontsource 5.3 woff2 files for the weight axis (`wght`), Latin and Latin-Ext
subsets; "width" is the advance width of "Page 12 of 48 · Edit, Sign, Highlight, Compare" at
13 px and weight 450, relative to Inter. Measured for this document.

| Family | Axes (Fontsource) | x-height (em) | Width vs Inter | tnum | Latin + Latin-Ext KB | Notes |
|---|---|---|---|---|---|---|
| **Inter** | wght; opsz 14–32 in the opsz file | **0.546** | 100 % | yes | 47.1 + 83.1 | Upstream 4.1 adds cv01–cv14, ss01–ss08, `case`, `zero`; Fontsource strips them |
| Geist | wght 100–900 | 0.530 | 96.9 % | yes | 28.7 + 16.1 | Upstream 1.7.2: ss01–ss11, `case`, TRK/AZE `locl`; I and l identical by default |
| Instrument Sans | wght 400–700, wdth 75–100 | 0.510 | 95.1 % | yes | 29.4 + 10.9 | Tight at 13 px; no weight below 400 |
| Manrope | wght 200–800 | 0.540 | 94.9 % | yes | 24.3 + 14.8 | Geometric; I, l and 1 close |
| Figtree | wght 300–900 | 0.500 | 94.5 % | yes | 19.7 + 10.0 | Smallest file; friendly, smaller x-height |
| Onest | wght 100–900 | 0.527 | 97.7 % | yes | 33.0 + 27.8 | Distinctive y; slightly wide spacing |
| Plus Jakarta Sans | wght 200–800 | 0.536 | 98.2 % | yes | 26.7 + 21.2 | Widest figures (0.728 em) |
| Schibsted Grotesk | wght 400–900 | 0.527 | 95.7 % | yes | 45.7 + 20.4 | Serifed I separates I/l; newspaper voice |
| Hanken Grotesk | wght 100–900 | 0.493 | 93.3 % | **no** | 33.9 + 19.1 | Narrowest; no tabular figures |
| DM Sans | wght, opsz 9–40 | 0.504 | 94.9 % | **no** | 36.1 + 17.8 | No tabular figures |
| Google Sans Flex | wght, wdth, opsz, GRAD, ROND, slnt | 0.510 | 94.2 % | yes | 49.6 + 25.0 (wght) | Full axes file 2,040 KB; Google's voice |
| Mona Sans | wght 200–900, wdth 75–125 | 0.517 | 96.3 % | yes | 38.9 + 15.2 | Single-storey a; GitHub's voice |
| Public Sans, Albert Sans, Golos, Funnel Sans, Host Grotesk, Wix Madefor, Red Hat Text, IBM Plex Sans, Rethink Sans | wght | 0.488–0.530 | 93.9–100.8 % | mixed | 26–75 total | No advantage over Inter for a dense UI |

Display candidates (brand and about page only): Inter's own Display optical size (free with
`opsz`); Instrument Serif (static regular + italic, 20.5 + 11.3 KB); Bricolage Grotesque (opsz
12–96, wdth; 75.1 + 30.0 KB); Newsreader (opsz 6–72; 128.9 + 84.6 KB); Fraunces (opsz, SOFT,
WONK; 65.7 + 58.0 KB).

Specimens rendered at 11, 12, 13 and 28 px on the dark field showed: at 13 px Inter and Geist
are the most even; Instrument Sans and Plus Jakarta crowd; Figtree and Hanken look a size
smaller (x-height 0.49–0.50); only Schibsted (and Inter with `cv05`/`cv08`) tell `I`, `l` and
`1` apart, which matters for file names, passwords and Turkish capitals.

### 2.2 Decision and delivery

**T-1 Keep Inter as the only UI face.** It has the tallest x-height measured (tied with Inter
Tight; more legible at 11–13 px), is already in every screenshot test, and its 4.x `opsz` axis
gives a true display cut for headings. Geist is the strongest alternative (smaller files, TRK
`locl`), but it is about 3 % narrower with a lower x-height (0.530 em), and it now signals one
company's products. Switching faces would not add "expensive"; finishing the one we have will.

**T-2 Self-host one custom subset of upstream Inter 4.1** (`inter-ui` 4.1.1, OFL), cut with a
committed `pyftsubset` script (`tools/fonts/subset.sh`), served from the origin (the CSP already
says `font-src 'self'`):

| File | Unicode | Axes | Features kept | woff2 |
|---|---|---|---|---|
| `inter-latin.woff2` | U+0000–00FF, U+0131, U+0152–0153, U+2000–206F, €, ™, arrows U+2190–2199, − ∕, ⌘ ⌥ ⌃ ⇧ ⌫ ⎋ | opsz 14–32, wght 100–900 | kern, mark, mkmk, ccmp, locl, calt, case, tnum, pnum, frac, cv05, cv08, ss03, zero | **73.4 KB** |
| `inter-latin-ext.woff2` | U+0100–017F (less the above), U+0218–021B, ₺ | same | same | **24.6 KB** |

For comparison: today's `wght.css` loads 47.1 KB, plus 83.1 KB when a Turkish character shows,
without `opsz` (so `font-optical-sizing: auto` in `global.css` does nothing today) and without
`case`, `cv05`, `cv08`, `ss03` or `zero`. A single file with both ranges is 92.2 KB; a
weight-only version 60.5 KB; all features 124.5 KB. Declare the faces under a private family
name (`'Inter Recto'`) so a locally installed Inter can never substitute.

**T-3 No italic file.** The UI uses italic in two places (the Recents hints). Replace them with
the tertiary colour. An italic file would cost 83.3 KB, and synthetic oblique looks cheap.

**T-4 Drop JetBrains Mono from the app** (54 KB) and set technical strings (origins, byte
counts, versions, hashes) in Inter with `tnum` and `zero`. Keep a monospace only if diagnostics
later show code.

### 2.3 Scale, weight, tracking

Apple's macOS text styles run Body 13/16, Callout 12/15, Subheadline 11/14, Title 3 15/20,
Title 2 17/22, Title 1 22/26, Large Title 26/32; iOS starts Body at 17/22 and sets the
minimum at 11 pt (HIG Typography). Recto today uses 12 px 187 times, 13 px 72 times and 11 px
58 times in its CSS: the UI is a size small for touch and for presentation.

**T-5 Type scale** (pointer: fine / pointer: coarse):

| Token | Fine | Coarse | Weight | Tracking | Use |
|---|---|---|---|---|---|
| `--type-caption` | 11/14 | 12/16 | 500 | +0.010 em | Badges, counts, keycaps |
| `--type-footnote` | 12/16 | 13/18 | 450 | +0.005 em | Secondary lines, metadata |
| `--type-body` | 13/18 | 15/20 | 450 | 0 | UI base: rows, menus, buttons |
| `--type-callout` | 15/20 | 17/22 | 450 | −0.005 em | Sheet body, empty-state text |
| `--type-title3` | 17/22 | 19/24 | 600 | −0.010 em | Panel and sheet titles |
| `--type-title2` | 22/28 | 24/30 | 650 | −0.015 em | Dialog titles, Home section heads |
| `--type-title1` | 28/34 | 30/36 | 650 | −0.020 em | Home greeting, about sections |
| `--type-display` | 40/44 · 56/60 | same | 700 | −0.022 em | About page only (opsz 32 applies itself) |

Text inputs use 16 px on coarse pointers whatever their role: iOS Safari zooms the page into any
field set smaller (established knowledge; research 19 asks for the same).

The tracking values follow Inter's published "dynamic metrics" curve,
tracking = −0.0223 + 0.185·e^(−0.1745·size) em (constants from rsms.me, established knowledge;
the page was blocked): +0.005 em at 11 px, 0 at 12, −0.003 at 13, −0.009 at 15, −0.018 at 22,
−0.021 at 28, rounded above. **T-6** In the dark theme add +0.005 em at 13 px and below: light
text on a dark field reads heavier and tighter (today's `--tracking-ui` +0.01 em does the same).

**T-7 Weights:** 450 for running UI text, 550 for buttons and labels, 600–650 for titles, 700
for display; never below 400 (HIG: "avoid light font weights"). Measured Inter stems: 1.14 px
at 13 px/400, 1.27 px at 13 px/450, 1.40 px at 13 px/500. 450 is the weight that matches a
20 px icon's 1.25 px stroke (§3.3).

**T-8 Numerals and features:** `tnum` on every number that changes (page counts, zoom, sizes,
timers; already on 30 rules); `case` on keycaps and on text set in capitals; `cv05` + `cv08`
(tailed l, serifed I) only where characters must be told apart: file names, the Find field,
passwords, metadata fields and page labels. `zero` only in technical strings.

**T-9 Hierarchy without capitals:** replace the uppercase tracked section labels ("PAGES",
"SELECTION", "HISTORY", "FILE"; the baseline audit counts five in the Document menu alone)
with sentence-case `--type-footnote` at 550 in secondary colour. Turkish capitalisation of i/ı
is a constant source of bugs in uppercase transforms, and Apple's current menus and sidebars
use sentence case.

**T-10 Text layout:** `text-wrap: balance` on titles (all engines); `text-wrap: pretty` on
paragraphs (Chrome 117, Safari 26; Firefox falls back harmlessly); `text-box: trim-both cap
alphabetic` inside capsules and buttons so labels centre on the cap height rather than the
line box (Chrome 133, Safari 18.2, Firefox 154 per BCD). `lang="tr"` on the root for Turkish
so `text-transform` and hyphenation pick the right i.

**T-11 Brand display face (about page only, owner's choice).** Default: Inter at `opsz` 32.
Optional accent: Instrument Serif italic for one to three words in a headline (31.9 KB, full
Turkish, loaded only by the about entry). "Recto" is a printing term (the right-hand page), so a
serif accent ties the name to books without entering the app. The brand track decides.

---

## 3. Icons

### 3.1 Sets compared

Counts and licences from the `@iconify-json` packages; "concepts" is how many of Recto's 39
core concepts (select, pen, highlighter, eraser, lasso, shapes, edit text, text box, note,
signature, stamp, redact, underline, strikeout, squiggly, find, lock, pages, arrange, compare,
rotate, crop, merge, split, OCR, watermark, page number, password, compress, export, undo,
comment, form field, home, sidebar, privacy shield, command, image, bookmark) have a fitting
glyph; "fill" is how many of them have a designed filled twin.

| Set | Licence | Icons | Grid, construction | Concepts | Fill | Path data per icon (raw) |
|---|---|---|---|---|---|---|
| Lucide (in use) | ISC | 1,866 | 24, stroke 2 (Recto sets 1.5) | 39 | 0 | 254 B (`lucide-react` module: 0.43 KB gzip) |
| **Phosphor** | MIT | 9,072 (≈1,512 × 6 weights) | 256, outlines; thin 8, light 12, regular 16, bold 24 units | 39 | **39** | 450 B per weight (`@phosphor-icons/react` module, all six weights: 1.1 KB gzip) |
| Tabler | MIT | 6,220 | 24, stroke 2 | 39 | 23 | 286 B |
| Fluent System | MIT | 19,876 | 16/20/24/28 designed per size; regular + filled | 38 (no stamp) | all | 540 B |
| Material Symbols | Apache-2.0 | 15,717 | 24; variable FILL, wght, GRAD, opsz | 39 | via FILL axis | 431 B, or a font |
| Hugeicons (free) | MIT | 6,065 | 24, stroke 1.5, rounded | 38 (no squiggly) | 0 in free tier | 514 B |
| Iconoir, Remix, Heroicons, Solar, MingCute | MIT / Apache / CC BY | 1,288–8,706 | — | not mapped; a keyword scan of 20 PDF concepts missed 3 (Iconoir) to 11 (Heroicons) | partial | — |

Rendered side by side on a glass capsule over the aurora at 20 px (active tool on lime): the
Phosphor fill glyph reads as "on" before the colour does; Lucide's outline on lime reads as the
same icon on a coloured disc. Material Symbols looks heavier and unmistakably Google; Fluent is
crisp but Windows-flavoured; Hugeicons' text tools are boxed and hard to tell apart.

### 3.2 Decision

**I-1 Adopt Phosphor (MIT), regular and fill, generated at build time.** A small script reads
`@phosphor-icons/core` SVGs for the icons Recto names in one manifest and writes a single
`ui/icons.generated.tsx` with two paths per icon and one `<Icon name weight size>` component.
Measured on the 39 core concepts: Phosphor regular + fill is 8.0 KB gzip of path data against
2.0 KB for Lucide, so about 18 KB against 5 KB for the ~90 icons in use. The 13 KB difference
is small next to the engine. Do not import `@phosphor-icons/react`: each icon module there
carries all six weights (`PenNib`: 3.8 KB raw, 1.36 KB gzip).

*Fallback if the owner prefers Lucide's crisper, more technical line:* keep Lucide at 1.5 and
draw filled twins for the ~16 tools and navigation icons in house. Cheaper in bytes, dearer in
design time, and the fills will never match Lucide's own line as closely as Phosphor's do.

### 3.3 Rules on glass

**I-2 Outline at rest, fill when selected.** HIG SF Symbols: "use the fill variant to indicate
selection"; "an iOS tab bar prefers the fill variant, whereas a toolbar takes the outline
variant". In Recto: fill for the armed tool, the current navigator tab, the on segment of
Read · Edit · Arrange, toggled switches with glyphs, and the current Home filter. Action glyphs
(chevrons, close, plus, check, arrows, more) never swap, because Phosphor's fill for those is an
enclosed shape (measured: `minus-fill` is a filled square with the bar knocked out).

**I-3 Sizes and weights.** The icon's stroke should match the adjacent text (HIG Icons: "match
the weights of interface icons and adjacent text"). Phosphor regular is 1/16 of the icon size:

| Size | Stroke | Pairs with | Where | Hit target (fine / coarse) |
|---|---|---|---|---|
| 16 px | 1.00 px | 12 px text | Menus, rows, inline status | 24 / 44 px |
| 20 px | 1.25 px | 13 px text at 450 (stem 1.27 px) | Glass bars, navigator, title bar | 32–36 / 44 px |
| 24 px | 1.50 px | 15–17 px text | Touch bars, Home actions, sheets on phones | 44 px |
| 32 / 48 px | duotone | Titles | Empty states, onboarding, about page | — |

**I-4 Colour on glass.** Icons are monochrome: primary text colour at rest, the glass-disabled
colour when unavailable (`#7d8086`, 2.3:1 over the worst-case glass, visible but clearly off).
The armed tool's glyph is ink on lime (dark theme) or lime on ink (light theme). Status colour
appears on a glyph only for the destructive menu item and the honesty-notice warning. Duotone's
second layer is `currentColor` at 20 %, or lime at 25 % in empty states; never multicolour.

**I-5 Optical alignment.** Keep icon boxes on whole pixels (no `translate(0.5px)` from centring
odd sizes). Keep a per-icon offset map in the manifest for asymmetric glyphs (HIG Icons gives the
download arrow as the example). Starting values to verify: play and send glyphs +0.5 px right,
download and upload ±0.5 px vertically, the pen nib +0.5 px down-left. Measure each against its circle in the 36 px bar
button at 2× before shipping.

**I-6 Labels.** Groups and uncommon tools carry a text label or a tooltip with the key: the
baseline audit found the Fill & sign and Text groups "icons only… hard to tell apart" and the
Edit-text icon obscure. Icon-only is reserved for universal actions: close, search, undo, redo,
more, share/export.

**I-7 Custom glyphs** (drawn on Phosphor's 256 grid, 16-unit stroke, round caps and joins, each
with a fill twin): Redact (text lines with a solid bar), Edit text (paragraph with an I-beam),
Compare (two pages with a difference mark), Combine (two pages merging), Page furniture (page
with header, footer and number marks), and the Recto glyph for the Home position. Six glyphs,
one designer-day; the brand track owns the last one.

### 3.4 Animated icons

SF Symbols ships Appear, Disappear, Bounce, Scale, Pulse, Variable colour, Replace, Magic
Replace, Wiggle, Breathe, Rotate and Draw On/Off, and asks to "apply symbol animations
judiciously" (HIG). On the web the options are a motion library (`lucide-animated`: 468 icons,
each a ~4 KB React component on Motion, springs at stiffness 200 and damping 25, hover-driven),
Lottie files, or CSS on the two Phosphor paths. Phosphor glyphs are filled outlines, so a
stroke draw-on is not available; that costs nothing Recto needs.

**I-8 Three CSS-only icon effects, nothing on hover:**

| Effect | When | Recipe | Reduced motion |
|---|---|---|---|
| Select | Outline → fill on arm, select, toggle | Cross-fade the two paths over 120 ms; scale 0.88 → 1.04 → 1 over 240 ms with a spring-shaped `linear()` easing | Instant swap |
| Replace | A glyph changes meaning (lock ⇄ unlocked, play ⇄ pause in Compare overlay) | Outgoing scale 1 → 0.8 and fade, 90 ms; incoming 0.8 → 1, 150 ms (SF's down-up) | Instant swap |
| Activity | Work longer than 1 s (OCR, compress, export verify) | Opacity 1 ⇄ 0.55, 1.6 s period, on the tool's glyph | Static glyph with a progress label |

Only `opacity` and `transform` animate, so the compositor does the work. The motion track owns
the spring curves; this table only fixes which icons move and when.

---

## 4. Colour

### 4.1 Roles

**C-1 Four roles, kept apart in tokens and in review:**

| Role | What | Colour | Where it may appear |
|---|---|---|---|
| Atmosphere | The aurora: light, not information | Lime, yellow, mint (+ teal) at low alpha, blurred | Canvas, Home, about page; always under glass, never on the page |
| Interaction | Focus, armed tool, primary action, on states, current item | Lime (`--accent`), with ink | Chrome only |
| Content | The page, its inks and highlighters (ADR-0021), selection on the page | Page white; ADR-0021 inks; `--select` blue | The page and on-page handles |
| Status | Destructive, honesty notices, signature validity | Danger, warning, success | Next to a glyph and words, never alone |

HIG Color: "Avoid using the same color to mean different things." HIG Branding (refined
2026-09-09): "Apply your app's accent color judiciously… To express your brand through color,
consider moving it into the content layer, where it scrolls beneath Liquid Glass controls and
gets picked up dynamically." The aurora is exactly that move.

### 4.2 Neutrals

Today's surfaces are already a cool grey: `#08090b` is oklch(0.139 0.005 263), `#181a1f`
oklch(0.218 0.010 268). Four hues were mocked at chroma 0.010 under the same aurora and glass:
cool graphite (265), green-grey (160), olive (115) and pure grey. At these lightnesses the
differences are subtle. Graphite makes the lime look cleaner (near-complementary hue); green-grey
is harmonious but flattens the lime; olive reads muddy; pure grey looks unfinished.

**C-2 Cool graphite, hue 265, chroma ≤ 0.012.** Reasons: warm light over cool shadow is the
oldest way to make light look like light; the lime gains saturation by contrast; tokens and
tests barely move; and in the light theme a cool canvas keeps the untinted white page looking
clean, where a green tint would look like dirty paper next to it. Ramps (12 steps, Radix-like
roles: 1–2 backgrounds, 3–6 surfaces and controls, 7–8 borders and disabled, 9–12 text):

| Step | Dark OKLCH | Dark hex | Light OKLCH | Light hex | Role |
|---|---|---|---|---|---|
| n1 | 0.140 0.006 | `#08090c` | 0.995 0.002 | `#fdfdff` | Dark: canvas · Light: raised cards |
| n2 | 0.180 0.008 | `#101215` | 0.975 0.003 | `#f6f7f9` | Sunken wells · Light: frame |
| n3 | 0.215 0.010 | `#17191e` | 0.955 0.004 | `#eff0f3` | Frame solid (glass fallback) |
| n4 | 0.250 0.011 | `#1f2227` | 0.930 0.005 | `#e6e8eb` | Raised, inputs · Light: canvas |
| n5 | 0.285 0.012 | `#272a30` | 0.905 0.006 | `#dee0e4` | On state, hover fill solid |
| n6 | 0.320 0.012 | `#303339` | 0.880 0.007 | `#d5d7dc` | Glass tint base (dark), strong control |
| n7 | 0.380 0.012 | `#3f4249` | 0.830 0.008 | `#c5c7cd` | Opaque border |
| n8 | 0.460 0.012 | `#55585f` | 0.740 0.010 | `#a8abb1` | Disabled text and icons |
| n9 | 0.665 0.010 | `#91949a` | 0.490 0.012 | `#5d6067` | Tertiary text |
| n10 | 0.720 0.010 | `#a1a5ab` | 0.440 0.013 | `#4f535a` | Secondary text |
| n11 | 0.800 0.008 | `#bbbec3` | 0.380 0.013 | `#3f424a` | Secondary text on glass |
| n12 | 0.935 0.004 | `#e8e9ec` | 0.205 0.010 | `#15171c` | Primary text, ink |

Measured: dark primary on n1–n6 16.4–10.4:1 (APCA Lc 93–88); secondary 8.1–5.1:1; tertiary
6.6:1 on n1 and 4.73:1 on n5 (the darkest surface it may sit on). Light primary 17.7–12.5:1;
secondary ≥ 5.85:1 on n1–n5; tertiary 5.13:1 on the canvas (n4) and 4.76:1 on n5.

### 4.3 The lime accent

The sRGB gamut for yellow-greens peaks high: at hue 123 the cusp is L 0.930, C 0.228 (`#ccff00`);
Display P3 reaches C 0.263. A lime is only vivid when it is light, which is why it works as a
fill with dark text and fails as text on white. For reference, Tailwind 4.3 `lime-300` is
oklch(0.897 0.196 127) and Radix's dark `lime9` is `#bdee63`, with a lighter `lime10`
`#d4ff70` for hover; Radix groups lime with the bright scales that take dark text (established
knowledge).

| Candidate | OKLCH | Ink on it | vs tier-1 glass over white | vs canvas | On white |
|---|---|---|---|---|---|
| `#d1fd2e` | 0.931 0.215 122 | 16.7:1 | 7.65:1 | 16.9:1 | 1.18:1 |
| **`#c8fb3d`** | **0.921 0.210 124** | **16.2:1** (APCA 93) | **7.44:1** | **16.4:1** | 1.21:1 |
| `#c0f447` | 0.900 0.201 125 | 15.3:1 | 6.99:1 | 15.4:1 | 1.29:1 |
| `#bef264` (Tailwind lime-300) | 0.897 0.179 127 | 15.1:1 | 6.90:1 | 15.3:1 | 1.31:1 |
| `#7c8cff` (today's accent) | 0.681 0.169 275 | 6.7:1 | **3.03:1** | — | 2.98:1 |

**C-3 Accent `#c8fb3d`, oklch(0.921 0.210 124),** 8 % under the gamut edge so it does not
vibrate on OLED; hover `#ddff82` (0.95 0.195 122; ink 17.5:1), pressed `#b2e93c` (0.865 0.20 126;
ink 13.7:1). Label colour `--accent-ink: #08090c`. Alphas: subtle 0.08, muted 0.16, line 0.50
(4.49:1 on n3). A current row on lime-muted keeps primary text at 9.4:1, and tertiary text in
it must step up to secondary (4.63:1; n9 would be 3.77:1), as DESIGN §3 already requires.

The armed fill now clears 3:1 against glass by more than double. Research 13 §9 and research 14
§4.3 held tier-1 glass at `brightness(0.45)` because periwinkle fell below 3:1 above it. With
lime, the bound becomes text: at 0.50 the white-page composite is `#4b4d51`, primary 6.98:1,
glass-secondary 4.54:1, lime 6.99:1. The glass track may take that room or keep 0.45. These are
modelled composites; research 22 §3.2 renders the 44 px bar over white lighter, at `#5b5d61`,
because the blur loses coverage at its edges. Lime still holds 5.44:1 there (periwinkle 2.22:1),
while glass-secondary drops to 3.54:1, so the text needs research 22's blur fix and the accent
does not.

**C-4 Lime always touches ink.** Dark theme: lime fill with an ink label or glyph. Light theme:
ink fill (`#15171c`) with a lime label or glyph, 14.8:1 (hover `#3f424a`, 8.3:1; pressed
`#000`). Four light-theme treatments were mocked: a lime fill with a hairline reads like a
highlighter stroke; an ink fill with a white label is correct but anonymous; a deep olive
(`#446712`, 6.6:1 on white) looks dated; the ink fill with lime label carries the brand and is
the one recommended. In light theme, 1 px rings use lime-800 `#446712` (6.57:1 on white, 5.35:1
on the canvas), and lime is never text.

**C-5 Lime budget.** At rest, at most one lime-filled element per view: the primary action (Home,
dialogs) or the armed tool (Edit), never both in the same region. Beyond that only the focus
ring, the 2 px current-thumbnail ring and indicator dots up to 8 px. No lime text larger than
13 px, no lime wash over more than a row. The armed ink preset in the pen bar gets an n12 ring
with a 2 px ink gap, not a lime ring: lime sits within ΔE_OK 0.08 of both highlighter tints
(0.076 to yellow `#FFEA00`, 0.074 to green `#8CF26B`), so a lime ring around them would vanish. HIG Liquid Glass colour: "apply color to the
background rather than to symbols or text… Refrain from adding color to the background of
multiple controls."

**Lime ramp** (for illustrations, brand and charts; chroma 92 % of the sRGB maximum):

| Step | OKLCH | Hex | On white | On canvas |
|---|---|---|---|---|
| 50 | 0.975 0.062 123 | `#effed1` | 1.06 | 18.7 |
| 100 | 0.955 0.121 123 | `#e1fea2` | 1.11 | 17.9 |
| 200 | 0.935 0.193 123 | `#d2fe59` | 1.16 | 17.1 |
| **300** | 0.920 0.210 124 | `#c8fb3d` | 1.21 | 16.4 |
| 400 | 0.885 0.205 125 | `#bbef39` | 1.35 | 14.7 |
| 500 | 0.830 0.197 127 | `#a5dd34` | 1.62 | 12.3 |
| 600 | 0.700 0.168 128 | `#80b127` | 2.55 | 7.8 |
| 700 | 0.580 0.142 129 | `#608a1c` | 4.08 | 4.9 |
| 800 | 0.470 0.116 130 | `#446712` | 6.57 | 3.0 |
| 900 | 0.370 0.092 130 | `#2f490a` | 10.1 | 2.0 |
| 950 | 0.270 0.068 131 | `#1a2d04` | 14.8 | 1.4 |

### 4.4 Selection on the page

**C-6 A content-selection colour, `--select: #4e61ed`, oklch(0.561 0.210 272).** macOS keeps an
accent colour for controls and a separate highlight colour for selected text (established
knowledge). Recto needs the same split: lime is 1.21:1 on white, and as a multiply wash it lands
between the yellow highlighter `#FFEA00` (oklch 0.925 0.194 103) and the green `#8CF26B`
(0.870 0.197 139), so a search hit would look like the user's own highlight.

| Use | Value | Measured |
|---|---|---|
| Lines, handles' strokes, lasso box, hover outline on page text | `#4e61ed` solid | 4.93:1 on white (today's `#7c8cff`: 2.98:1, under the 3:1 of WCAG 1.4.11) |
| Text selection, lasso area tint | `rgb(78 97 237 / 0.25)` multiply | `#d3d8fa` on white; black text stays black |
| Current search hit | 0.45 | `#afb8f7`; black text 11.0:1 |
| Other search hits | 0.25 | as text selection |

Its hue is 10° from the blue writing ink `#1760ee`; form separates them (dashed boxes, handles
and washes are never strokes of ink). Focus on page objects uses the focus ring of C-7, not this
colour.

### 4.5 Focus

**C-7 One two-tone focus ring for both themes:** 2 px lime outside, 2 px ink inside
(`outline: 2px solid var(--accent); outline-offset: 2px; box-shadow: 0 0 0 2px var(--focus-inner)`
with `--focus-inner: #08090c`). On dark surfaces the inner band disappears and the lime shows at
13.2:1 on n4; on the page or in the light theme the ink band carries 19.9:1 against white. The
ring follows `border-radius` and `corner-shape` in Chromium 141 (§5.2). The existing per-context
offsets of DESIGN §5 stay.

### 4.6 Status and tags

**C-8 Status colours.** Warning moves from hue 86 to 72 so it separates from the aurora yellow
(108) and the lime (124). Success is used only for signature validity and a verified export;
other confirmations are neutral text with a check glyph.

| Token | Dark | On n3 | Glass variant (dark) | Light | On canvas | Light-glass variant |
|---|---|---|---|---|---|---|
| danger | `#fd7273` (0.72 0.17 22) | 6.56 | `#ffa4a4` (0.81 0.11 20): 4.77 at b 0.45, 4.48 at 0.50 | `#c21725` (0.52 0.20 25) | 4.97 | `#a20519` (0.45 0.18 25): 4.64 |
| warning | `#ffb756` (0.83 0.14 72) | 10.2 | itself: 5.22 | `#985600` (0.52 0.12 62) | 4.67 | `#754100` (0.43 0.10 62): 4.75 |
| success | `#56d1a3` (0.78 0.13 165) | 9.25 | itself: 4.74 | `#007654` (0.50 0.11 165) | 4.60 | `#005c41` (0.42 0.09 165): 4.57 |

If the glass track raises tier 1 to `brightness(0.50)`, glass-danger becomes `#ffa8a8`.

**C-9 Tags.** Tag 4, olive `#a6b27c`, has hue 118, the accent's own hue; replace it with lilac
`#b1a1d1` (0.739 0.070 300; 6.75:1 on n4). The other five stay. Light-theme tag colours are the
same hues 0.18 darker in L and 0.02 richer in C: `#327f6e`, `#966b21`, `#945067`, `#5d728e`,
`#7c68a1`, `#965c39` (4.75–5.83:1 on white).

**C-10 `contrast-color()`** is now in all three engines (Chrome 147, Firefox 146, Safari 26 per
BCD). Use it for the check mark on a user's custom ink swatch, where the colour is unknown.

### 4.7 The aurora's colours

**C-11 Aurora palette** (atmosphere may use Display P3; content stays sRGB per ADR-0021):

| Light | sRGB | OKLCH | P3 chroma available |
|---|---|---|---|
| Lime | `#c8fb3d` | 0.921 0.210 124 | 0.267 |
| Yellow | `#f8f337` | 0.939 0.190 108 | 0.235 |
| Mint | `#57f9b0` | 0.880 0.170 160 | 0.231 |
| Teal (depth, optional) | `#16bbbc` | 0.719 0.120 196 | 0.165 |

Use `@media (color-gamut: p3)` to raise chroma to about 95 % of the P3 maximum on wide-gamut
screens. The rendering technique, motion and cost belong to the aurora track.

**C-12 Text over the aurora sits on glass.** Text directly on the dark canvas, over an aurora
blob of opacity *a*:

| a | Lime under text | Primary | Secondary | Tertiary |
|---|---|---|---|---|
| 0.15 | `#252d13` | 11.8 | 5.80 | 4.72 |
| 0.20 | `#2e3916` | 10.1 | 4.95 | **4.03** |
| 0.30 | `#42521b` | 7.05 | **3.46** | 2.81 |
| 0.45 | `#5e7622` | **4.23** | 2.07 | 1.69 |

Rule: where the aurora exceeds 0.15 at a point, no text may sit on the bare canvas there. Text
over it sits on glass, whose brightness cap keeps the white page the worst case: tier 1 over
the 0.45 peak composites to `#2e342b` (primary 10.5:1, secondary 5.2:1). In the light theme the
aurora multiplies; tertiary text stays ≥ 4.5:1 up to 0.45 for lime and yellow and 0.30 for mint.

### 4.8 Colour on glass

**C-13 Glass tints are neutral; colour arrives from behind.** Dark tiers keep the graphite tint
(tier 1 n6 at 0.66; menus n5 at 0.80; frame n3 at 0.80) and the `saturate()` that lets the
aurora's hue through. Over the aurora a tier-1 bar turns olive-grey (`#2e342b`), over the canvas
`#212327`, over a white page `#47494d`: the bar visibly takes the colour of the light it floats
in, which is the effect the owner described. Text mapping on glass stays: secondary and tertiary
→ `--glass-text-secondary` (n11), danger → its glass variant, lime only as fill or as ≤ 13 px
link text (7.44:1 at the worst case).

**C-14 Light glass needs a floor, not a cap.** With dark text, the worst backdrop is black (a
photo or a black heading under the bar). Proposed light tier 1: tint `rgb(251 251 253 / 0.70)`,
`backdrop-filter: blur(28px) saturate(1.6) contrast(0.6) brightness(1.25)`. `contrast(0.6)` lifts
black to 0.2 before the brightness, so black under the bar composites to `#c3c3c4`: primary
10.2:1, glass-secondary (n11) 5.71:1, secondary (n10) 4.39:1 (so secondary maps to n11 on light
glass too); over the light canvas the bar is 1.15:1 lighter and needs its ring and shadow for an
edge. Same sRGB model and caveat as research 13 §3; the glass track should verify it in Safari.

### 4.9 Light theme and themes

**C-15 Light is an equal theme,** not an M9 extra: phones and tablets are often in light mode,
and the about page and screenshots need both. Follow `prefers-color-scheme`; offer System,
Light and Dark in settings. HIG Dark Mode advises against app-specific appearance settings;
browsers have no per-site appearance switch, though, so the override is the only way to read in
a dark Recto on a light system. It defaults to System. The page is never themed in either; the "dim pages" comfort option stays dark-only.

**C-16 Tests.** Extend `tokens.test.ts` per theme: every text token on n1–n6; every glass tier
over white, black, `#808080`, the canvas and the 0.45 aurora composite; the accent fill against
each glass composite (≥ 3:1); `--select` on white (≥ 3:1); the focus inner band on white; each
status colour and its glass variant (≥ 4.5:1). Under `prefers-contrast: more`, raise tertiary to
n10, borders to 0.22/0.36 alpha, and make glass solid, as today.

---

## 5. Shape and depth

### 5.1 Radius and concentricity

The baseline audit counts three radii on the floating bars alone (an 8 px selection bar, a
capsule tool bar and the Edit pill). HIG Toolbars: "standard buttons… have corner radii that
are concentric with bar corners. If you need to create a custom component, ensure that its
corner radius is also concentric." HIG Buttons (visionOS): prefer circles for icon-only buttons
and capsules for text buttons in rows; "the more rounded a button's shape, the easier it is for
people to look steadily at it".

**S-1 Radius scale and nesting rule** (inner radius = outer radius − inset):

| Token | Value | Use |
|---|---|---|
| `--radius-page` | 2 px | Page sheets, on-page marks (unchanged) |
| `--radius-xs` | 4 px | Badges, keycaps, swatch wells' inner marks |
| `--radius-sm` | 8 px | Rows, inputs, menu items, small square buttons |
| `--radius-md` | 12 px | Menus, popovers, tooltips, thumbnails' cards |
| `--radius-lg` | 16 px | Home cards, toasts, wells inside panels |
| `--radius-xl` | 20 px | Dialogs, sheets, floating panels (desktop) |
| `--radius-2xl` | 28 px | Phone sheets, about page cards |
| `--radius-capsule` | 999 px | Every bar, text button, chip, segmented control |

Examples: a 12 px menu with a 4 px inset gives 8 px items; a 20 px panel with an 8 px inset gives
12 px wells; a 44 px capsule bar with a 4 px inset gives 36 px circular buttons (Recto's bar does
this today). Contextual bars become capsules, so every floating bar shares one shape.

### 5.2 Squircles

`corner-shape` ships in Chromium 139+; Firefox and Safari have it only in preview (BCD 8.1.4).
Geometry: a circular corner of radius *r* cuts 0.293 *r* at 45°; `superellipse(1.5)` cuts
0.218 *r* and `squircle` (= `superellipse(2)`) 0.159 *r*. Rendered in Chromium 141, a squircle at
the same radius looks like a sharper corner; `superellipse(1.5)` at 1.35 × matches the circle's
visual size with a smoother start, which is closer to Apple's continuous corners. Outline (and
so the focus ring), border, box-shadow and the backdrop clip all follow the shape there.

**S-2 Progressive squircles:** inside `@supports (corner-shape: superellipse(1.5))`, set
`corner-shape: superellipse(1.5)` and multiply the radius by 1.35 on `--radius-md` and larger
(menus 16, cards 22, dialogs 27). Never on capsules (verified: a capsule turns into a rounded
rectangle), never on the page. Safari and Firefox users see circular corners at the base radius.

### 5.3 Edges on glass

**S-3 A glass edge has two layers plus one shadow:**

| Layer | Dark | Light | Why |
|---|---|---|---|
| Inner rim | 1 px, top `rgb(255 255 255 / 0.16)` fading to 0.04 at the bottom (masked gradient border on `::before`) | top `rgb(255 255 255 / 0.85)` to 0.4 | The specular edge that makes it read as glass, lit from above |
| Outer ring | `0 0 0 1px rgb(0 0 0 / 0.5)` | `0 0 0 1px rgb(15 17 22 / 0.10)` | Holds the edge over a white page (dark) or the light canvas |
| Shadow | by elevation (S-4) | by elevation, hue-265 tinted | Separates from content |

One light direction for the whole app: from above. A rim that turns towards the nearest aurora
blob is tempting but makes every bar look different; reject.

### 5.4 Elevation and light

**S-4 Elevation scale** (dark values; light uses `rgb(21 23 28 / α)` at 40 % of each α):

| Token | Value | Use |
|---|---|---|
| e0 | none | Docked frame, cards resting on the canvas |
| e1 | `0 1px 2px rgb(0 0 0 / 0.30)` | Small controls on content (handles, page badges) |
| e2 | `0 8px 24px -8px rgb(0 0 0 / 0.55)` | Floating bars (today's `--elevation-float` shadow) |
| e3 | `0 16px 40px -12px rgb(0 0 0 / 0.60)` | Menus, popovers, palette |
| e4 | `0 32px 80px -24px rgb(0 0 0 / 0.70)` | Dialogs, sheets |

**S-5 Controls never glow.** No coloured outer shadow on buttons, tools or focus. Light belongs
to the atmosphere layer only (the aurora behind glass). This keeps DESIGN §1's "nothing glows"
true for everything a user operates, while the app as a whole gains light.

### 5.5 Spacing and density

**S-6 4 px grid with a 2 px half-step** for optical fixes: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40,
48, 64. **Two densities by input:** `pointer: fine` keeps 28 px controls, 32–36 px bar buttons,
44 px bars and 13 px text; `pointer: coarse` switches to 44 px controls and bar buttons, 56 px
bars, 15 px text and 16 px gutters. HIG minimums: 28 × 28 pt on macOS, 44 × 44 pt on iOS.

---

## 6. The expensive-feel checklist

Each line is a rule the component specs can test. Examples are established knowledge unless a
source is given.

| ID | Quality | Rule for Recto | Seen in |
|---|---|---|---|
| X-1 | Restraint | One lime element per view; at most three aurora blobs; chrome ≤ 30 % of a 1440 px viewport (the baseline measured 41 % with the inspector, 72 % at 820 px) | Linear's single accent and its "calmer interface" refresh (title from search); Apple Preview's bare window |
| X-2 | Alignment | One left edge per column (the baseline found Home cards and Recents on two axes); numbers right-aligned and tabular; icon boxes on whole pixels; labels cap-centred with `text-box` | Things 3, Raycast lists |
| X-3 | Hierarchy | Three type sizes per surface at most; weight before size; sentence case, no tracked capitals | macOS sidebars and menus (HIG text styles) |
| X-4 | Response | Every press answers within 100 ms: pressed state (scale 0.97, 100 ms) before work starts; hover is one step; icons morph on selection (I-8) | iOS buttons; Family's wallet (established knowledge) |
| X-5 | Loading choreography | Never a blank: page skeletons at the page's real aspect ratio, then a low-resolution render, then sharp; no spinner before 400 ms; lists stagger 30 ms per item, capped at 8 items | HIG Loading: "show something as soon as possible" |
| X-6 | Empty states with character | One 48 px duotone glyph (lime second layer), one sentence, one primary action; keycaps only on a fine pointer; the aurora is brightest on the empty Home, the one welcome moment | HIG Writing: "provide clear next steps on any blank screens"; Arc's onboarding |
| X-7 | Copy | Verbs on buttons ("Combine 3 files"); ellipsis only when more input follows (HIG); errors say what to do; no "we" (HIG Writing); EN and TR written, not translated word by word | Apple Style Guide via HIG Writing |
| X-8 | Toasts and sheets | Toast: 4 s, at most 3 stacked, 14 px gap, swipe away at 45 px, 200 ms exit (sonner's constants); sheets on the iOS curve `cubic-bezier(0.32, 0.72, 0, 1)` over 500 ms (vaul) | `emilkowalski/sonner`, `emilkowalski/vaul` (read in source) |
| X-9 | Sound | None. PDF work happens in offices, libraries and meetings; Preview, Notability's editor and Acrobat are silent; Recto already announces outcomes to screen readers | HIG Feedback asks for several channels; visual plus announcements already cover it |
| X-10 | Haptics | Android only, through `navigator.vibrate(8)`: tool armed, highlighter snap, page dropped in Arrange, delete. Off with reduced motion and behind a setting. Safari has no Vibration API (BCD); the `<input type=checkbox switch>` trick fires only on direct taps since iOS 26.5 (search abstracts), so do not build on it | HIG Playing haptics: "use haptics consistently… avoid overusing… make haptics optional" |
| X-11 | Finish | No native `<select>`, checkbox, radio or colour input visible (the baseline finds all four in dialogs and panels); every control in the token system; the same shape for every bar | Linear, Raycast |
| X-12 | Speed as a feature | Restore the last state on reopen (HIG Launching: "restore the previous state"); no launch splash; the first paint shows Home or the last document | HIG Launching |

---

## 7. Token proposal

Hex is the stored value (the contrast tests parse hex and the values are already clamped to
sRGB); OKLCH is in the comments and in §4. Only the colour, type, radius and elevation parts
are shown; motion and glass filters belong to their tracks.

```css
:root, [data-theme='dark'] {
  color-scheme: dark;
  /* neutrals, hue 265 */
  --n1: #08090c;  /* 0.140 0.006 */  --n2: #101215;  /* 0.180 0.008 */
  --n3: #17191e;  /* 0.215 0.010 */  --n4: #1f2227;  /* 0.250 0.011 */
  --n5: #272a30;  /* 0.285 0.012 */  --n6: #303339;  /* 0.320 0.012 */
  --n7: #3f4249;  /* 0.380 0.012 */  --n8: #55585f;  /* 0.460 0.012 */
  --n9: #91949a;  /* 0.665 0.010 */  --n10: #a1a5ab; /* 0.720 0.010 */
  --n11: #bbbec3; /* 0.800 0.008 */  --n12: #e8e9ec; /* 0.935 0.004 */
  --canvas: var(--n1); --surface-frame: var(--n3); --surface-raised: var(--n4);
  --surface-on: var(--n5); --border-opaque: var(--n7);
  --text-primary: var(--n12); --text-secondary: var(--n10); --text-tertiary: var(--n9);
  --text-disabled: var(--n8); --glass-text-secondary: var(--n11);
  --glass-text-disabled: #7d8086; /* 2.28:1 on dark glass over white, 2.25:1 on light glass over black */
  /* interaction */
  --accent: #c8fb3d;          /* 0.921 0.210 124 */
  --accent-hover: #ddff82;    /* 0.950 0.195 122 */
  --accent-pressed: #b2e93c;  /* 0.865 0.200 126 */
  --accent-ink: #08090c;      /* label and glyph on the accent */
  --accent-subtle: rgb(200 251 61 / 0.08);
  --accent-muted: rgb(200 251 61 / 0.16);
  --accent-line: rgb(200 251 61 / 0.5);
  --tool-active-fill: var(--accent); --tool-active-ink: var(--accent-ink);
  --primary-fill: var(--accent); --primary-ink: var(--accent-ink);
  --focus-outer: var(--accent); --focus-inner: #08090c;
  /* content (the page) */
  --page-background: #ffffff;
  --select: #4e61ed;          /* 0.561 0.210 272: on-page lines and handles */
  --select-wash: rgb(78 97 237 / 0.25);
  --select-wash-strong: rgb(78 97 237 / 0.45);
  /* status */
  --danger: #fd7273; --glass-danger: #ffa4a4;
  --warning: #ffb756; --warning-line: rgb(255 183 86 / 0.35);
  --success: #56d1a3;
  /* tags */
  --tag-0: #7db3a4; --tag-1: #c8a46e; --tag-2: #c58b9d;
  --tag-3: #9aa8ba; --tag-4: #b1a1d1; --tag-5: #c7967a;
  /* atmosphere */
  --aurora-lime: #c8fb3d; --aurora-yellow: #f8f337; --aurora-mint: #57f9b0; --aurora-teal: #16bbbc;
  --aurora-max-under-text: 0.15;
  /* edges and elevation */
  --rim-top: rgb(255 255 255 / 0.16); --rim-bottom: rgb(255 255 255 / 0.04);
  --ring-outer: rgb(0 0 0 / 0.5);
  --e1: 0 1px 2px rgb(0 0 0 / 0.3);
  --e2: 0 8px 24px -8px rgb(0 0 0 / 0.55);
  --e3: 0 16px 40px -12px rgb(0 0 0 / 0.6);
  --e4: 0 32px 80px -24px rgb(0 0 0 / 0.7);
  /* type; dark tracking includes T-6's +0.005 em at 13 px and below */
  --font-ui: 'Inter Recto', ui-sans-serif, system-ui, sans-serif;
  --type-caption: 500 11px/14px var(--font-ui);   --track-caption: 0.015em;
  --type-footnote: 450 12px/16px var(--font-ui);  --track-footnote: 0.01em;
  --type-body: 450 13px/18px var(--font-ui);      --track-body: 0.005em;
  --type-callout: 450 15px/20px var(--font-ui);   --track-callout: -0.005em;
  --type-title3: 600 17px/22px var(--font-ui);    --track-title3: -0.01em;
  --type-title2: 650 22px/28px var(--font-ui);    --track-title2: -0.015em;
  --type-title1: 650 28px/34px var(--font-ui);    --track-title1: -0.02em;
  /* shape and space */
  --radius-page: 2px; --radius-xs: 4px; --radius-sm: 8px; --radius-md: 12px;
  --radius-lg: 16px; --radius-xl: 20px; --radius-2xl: 28px; --radius-capsule: 999px;
  --space-0-5: 2px; --space-1: 4px; --space-1-5: 6px; --space-2: 8px; --space-3: 12px;
  --space-4: 16px; --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
  --space-12: 48px; --space-16: 64px;
  --control-height: 28px; --bar-button: 36px; --bar-height: 44px;
  --icon-sm: 16px; --icon-md: 20px; --icon-lg: 24px;
}

[data-theme='light'] { /* and @media (prefers-color-scheme: light) when the setting is System */
  color-scheme: light;
  --n1: #fdfdff; --n2: #f6f7f9; --n3: #eff0f3; --n4: #e6e8eb; --n5: #dee0e4; --n6: #d5d7dc;
  --n7: #c5c7cd; --n8: #a8abb1; --n9: #5d6067; --n10: #4f535a; --n11: #3f424a; --n12: #15171c;
  --canvas: var(--n4); --surface-frame: var(--n2); --surface-raised: var(--n1);
  --tool-active-fill: var(--n12); --tool-active-ink: var(--accent);
  --primary-fill: var(--n12); --primary-ink: var(--accent);
  --accent-line: #446712;     /* lime-800, 6.57:1 on white */
  --accent-subtle: rgb(21 23 28 / 0.04); --accent-muted: rgb(21 23 28 / 0.07);
  --track-caption: 0.01em; --track-footnote: 0.005em; --track-body: 0;
  --focus-inner: #08090c;     /* the ink band carries the ring on light surfaces */
  --danger: #c21725; --glass-danger: #a20519;
  --warning: #985600; --warning-line: rgb(152 86 0 / 0.35); --success: #007654;
  --tag-0: #327f6e; --tag-1: #966b21; --tag-2: #945067;
  --tag-3: #5d728e; --tag-4: #7c68a1; --tag-5: #965c39;
  --rim-top: rgb(255 255 255 / 0.85); --rim-bottom: rgb(255 255 255 / 0.4);
  --ring-outer: rgb(15 17 22 / 0.1);
  --e1: 0 1px 2px rgb(21 23 28 / 0.12);
  --e2: 0 8px 24px -8px rgb(21 23 28 / 0.22);
  --e3: 0 16px 40px -12px rgb(21 23 28 / 0.24);
  --e4: 0 32px 80px -24px rgb(21 23 28 / 0.28);
}

@media (pointer: coarse) {
  :root {
    --type-caption: 500 12px/16px var(--font-ui);  --type-footnote: 450 13px/18px var(--font-ui);
    --type-body: 450 15px/20px var(--font-ui);     --type-callout: 450 17px/22px var(--font-ui);
    --control-height: 44px; --bar-button: 44px; --bar-height: 56px;
  }
}

@media (color-gamut: p3) {
  :root {
    --aurora-lime: oklch(0.921 0.25 124); --aurora-yellow: oklch(0.939 0.22 108);
    --aurora-mint: oklch(0.88 0.22 160);
  }
}
```

---

## 8. Tensions with current decisions

1. **DESIGN §1 "Nothing glows."** Amend to "No control glows; light lives only in the atmosphere
   layer behind glass" (S-5, C-12).
2. **ADR-0021 §4 and DESIGN §3 "one accent, `#7c8cff` stays."** Replace with lime for chrome
   interaction and `#4e61ed` for selection on the page (C-3, C-6). This needs an ADR that
   supersedes ADR-0021 §4. The ink palette of ADR-0021 §3 is unchanged.
3. **DESIGN §3 "Chrome colour is for state; the accent is never text."** Keep in spirit; allow
   lime as link text up to 13 px in the dark theme only (7.44:1 at worst) and never in light.
4. **DESIGN §3 on-page rings in the accent:** `#7c8cff` is 2.98:1 on white, under WCAG 1.4.11.
   Fixed by C-6 regardless of the rest of this document.
5. **DESIGN §3 "Icons: Lucide or Phosphor, 1.5 px, 16 and 20 px."** Becomes Phosphor regular and
   fill, 16/20/24, fill on selection (I-1 to I-3).
6. **DESIGN §3 "Typography: 13/12/11, labels with tracking."** Becomes the scale of T-5, a touch
   scale, and sentence-case headings (T-9). `@fontsource-variable/inter` and
   `@fontsource-variable/jetbrains-mono` leave `package.json` (T-2, T-4).
7. **tokens.css radius scale 2/4/6/10/capsule and "one elevation token."** Becomes S-1 and the
   e0–e4 scale of S-4; docked surfaces still get none.
8. **DESIGN §3 "A light theme is an M9 item, not a v1 blocker."** Light becomes an equal theme
   (C-15).
9. **Tag 4 olive** shares the accent's hue (C-9).
10. **DESIGN §6 "no gradient" for the brand glyph** stays compatible: the aurora is atmosphere,
    not logo. The brand track decides whether the glyph itself ever carries it.

## 9. Open questions for the owner

1. Lime as the interactive accent (recommended), or lime only as aurora with periwinkle kept for
   controls? The mock shows both; periwinkle next to a lime aurora reads as two brands.
2. Neutral hue: cool graphite (recommended) or green-grey? A side-by-side mock exists.
3. Light theme: ink buttons with lime labels (recommended), or lime fills with a hairline?
4. Phosphor's softer, friendlier line instead of Lucide's crisper one: approve the switch?
5. An Instrument Serif italic accent on the about page only: yes or no?
6. No UI sounds, and haptics on Android only: agreed?
7. One lime or two? Research 21 proposes the brand lime `#e2f73d` (oklch 0.93 0.196 116, a
   lemon-lime) with `#49780d` as its ink partner. This document keeps the interactive accent at
   hue 124 (`#c8fb3d`), which sits further from the yellow highlighter (ΔE_OK 0.076 against
   0.045) and the warning amber, and prefers `#446712` for text on light surfaces (5.35:1 on the
   light canvas, where `#49780d` gives 4.3:1). Suggested split: 116 is the aurora's lemon light
   and the brand's, 124 is the accent; or pick one value for both before the tokens are cut.

## Sources

Primary sources read in full or measured:

- Apple Human Interface Guidelines, JSON data, read in full, each at
  `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json`: [materials](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/materials.json), [color](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/color.json), [typography](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/typography.json), [sf-symbols](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/sf-symbols.json), [icons](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/icons.json), [dark-mode](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/dark-mode.json), [layout](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/layout.json), [buttons](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/buttons.json), [toolbars](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/toolbars.json), [branding](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/branding.json), [feedback](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/feedback.json), [loading](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/loading.json), [launching](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/launching.json), [onboarding](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/onboarding.json), [playing-haptics](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/playing-haptics.json), [writing](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/writing.json).
- npm tarballs, measured with fontTools: `@fontsource-variable/*` 5.3.x (inter, geist,
  instrument-sans, manrope, figtree, onest, plus-jakarta-sans, schibsted-grotesk, hanken-grotesk,
  dm-sans, google-sans-flex, mona-sans, hubot-sans, public-sans, albert-sans, golos-text,
  funnel-sans, funnel-display, host-grotesk, wix-madefor-text, red-hat-text, ibm-plex-sans,
  inter-tight, outfit, sora, rethink-sans, bricolage-grotesque, newsreader, fraunces,
  source-serif-4, geist-mono, jetbrains-mono), `@fontsource/instrument-serif` 5.3.0,
  [`inter-ui` 4.1.1](https://www.npmjs.com/package/inter-ui), [`geist` 1.7.2](https://www.npmjs.com/package/geist).
- Icon packages, measured: `@iconify-json/{lucide 1.2.139, ph 1.2.2, tabler 1.2.41, fluent
  1.2.59, material-symbols 1.2.94, hugeicons 1.2.35, iconoir, ri, heroicons, solar, mingcute}`,
  [`lucide-react` 1.52.0](https://www.npmjs.com/package/lucide-react),
  [`@phosphor-icons/react` 2.1.10](https://www.npmjs.com/package/@phosphor-icons/react).
- [`@mdn/browser-compat-data` 8.1.4](https://www.npmjs.com/package/@mdn/browser-compat-data)
  (corner-shape, oklch, contrast-color, text-wrap, text-box, prefers-reduced-transparency,
  Navigator.vibrate, input switch), read in full for those keys.
- [`tailwindcss` 4.3.3 `theme.css`](https://www.npmjs.com/package/tailwindcss) and
  [`@radix-ui/colors` 3.0.0](https://www.npmjs.com/package/@radix-ui/colors), read in full for
  the lime and neutral scales.
- [pqoqubbw/icons](https://github.com/pqoqubbw/icons) (cloned; 468 icons, Motion springs),
  [emilkowalski/sonner](https://github.com/emilkowalski/sonner) (cloned; `src/index.tsx`
  constants), [emilkowalski/vaul](https://github.com/emilkowalski/vaul) (cloned;
  `src/constants.ts`, `src/style.css`).
- Repository: `apps/web/src/styles/tokens.css`, `docs/DESIGN.md`,
  `docs/research/13-glass-and-modes.md`, `docs/research/14-glass-spike.md`,
  `docs/adr/0021-one-highlighter-lasso-palette.md`, the baseline screenshots in
  `docs/design/redesign-2026-10/baseline/` with the audit's review notes, and the verdicts of the
  sibling M9 tracks `docs/research/18-motion.md`, `19-mobile-and-touch.md`,
  `21-brand-and-portfolio.md` and `22-accessible-expressive-ui.md` (read for alignment only).

Known only from search abstracts:

- [web.dev, New to the web platform in August 2025](https://web.dev/blog/web-platform-08-2025)
  (corner-shape in Chrome 139).
- [Squircle.js, Squircles in CSS (2026)](https://squircle.js.org/blog/squircles-in-css);
  [Smashing Magazine, Beyond border-radius (2026-03)](https://www.smashingmagazine.com/2026/03/beyond-border-radius-css-corner-shape-property-ui/);
  [Frontend Masters, Understanding corner-shape](https://frontendmasters.com/blog/understanding-css-corner-shape-and-the-power-of-the-superellipse/).
- [rsms/inter discussion #493, Inter v4 beta](https://github.com/rsms/inter/discussions/493);
  [Pimp my Type, Inter 4.0](https://pimpmytype.com/inter-v4/) (Inter Display folded into `opsz`).
- [lucide-animated](https://icons.pqoqubbw.dev/);
  [Vercel community post](https://community.vercel.com/t/lucide-animated-an-open-source-collection-of-smooth-animated-lucide-icons-for-your-projects/29428).
- [Phosphor guide, iconoop](https://iconoop.com/phosphor-icons.html);
  [allsvgicons Phosphor guide](https://allsvgicons.com/blog/phosphor-icons-complete-guide/).
- [Google Fonts, Material Symbols guide](https://developers.google.com/fonts/docs/material_symbols)
  (FILL axis for state transitions).
- [ios-haptics](https://www.npmjs.com/package/ios-haptics);
  [web-haptics-polyfill](https://github.com/doublej/web-haptics-polyfill);
  [haptics on iOS 26.5+](https://haptics.kushagragolash.dev/) (the switch trick, patched to
  direct taps only in iOS 26.5).
- [Linear, How we redesigned the Linear UI (part II)](https://linear.app/now/how-we-redesigned-the-linear-ui)
  (LCH themes from three variables: base, accent, contrast);
  [Linear, A calmer interface for a product in motion](https://linear.app/now/behind-the-latest-design-refresh)
  (title only; the page was blocked).
- [Evil Martians, Exploring the OKLCH ecosystem](https://evilmartians.com/chronicles/exploring-the-oklch-ecosystem-and-its-tools).

Established knowledge, not verified this session: Inter's dynamic-metrics constants (rsms.me,
blocked); macOS's separate Accent and Highlight colour settings; Radix's grouping of lime with
the scales that take dark text; the design habits of Things 3, Notability, Apple Preview, Arc,
Raycast and the Family wallet app cited in §6.
