---
title: "Research: brand, logo, app icon and the portfolio presentation (M9)"
date: 2026-10-04
status: snapshot
---

> Research snapshot gathered on 2026-10-04 for the M9 redesign. Apple's guidance was read in
> full from the JSON behind the Human Interface Guidelines (`app-icons`, `branding`,
> `launching`, `onboarding`, `motion`, `color`). Primary sources were read from public
> repositories cloned into a scratch folder: Ghostty's Icon Composer file and website, the
> Excalidraw, tldraw, Squoosh and Zed repositories (icons, manifests, a brand-voice guide),
> `tauri-apps/tauri-docs`, `mdn/content`, the `@vite-pwa/assets-generator` 2.0.0 tarball, and
> the five other GitHub projects named Recto. Everything else rests on search-result abstracts
> and is marked as such. WebFetch was blocked for obsidian.md, zed.dev and raycast.com; curl
> could not reach ghostty.org, tldraw.dev, excalidraw.com, linear.app, evilmartians.com,
> web.dev or stephango.com. The session's web-search budget ran out before two planned queries
> (macOS "Add to Dock" icon masking; Squoosh's landing page, read from its repository instead).
> Colour values were computed with Ottosson's OKLab matrices and the WCAG 2 contrast formula.
> The concept sketches in `docs/brand/concepts/` were drawn for this document and rendered
> with the repository's Playwright (Chromium 141, software rendering) to measure small sizes.
> No file outside this report and those five SVGs was written.

# Brand, logo and the portfolio presentation

## 0. Verdict

- **Settle the name risk before paying for a logo.** ADR-0015 says "Recto has no PDF-editor
  namesake". That is no longer true. `JaguarM/Recto` has described itself as "An extensible PDF
  editor" since 2026-07-13, and `FileSherlock/Recto` (AGPL-3.0, created 2026-09-18) is "an
  extensible PDF editor that runs entirely in the browser" where "the document you open never
  leaves your browser". That is Recto's own positioning, almost word for word. Both are small
  hobby projects. At least seven other "Recto" software products appeared in 2025–26 (§2.2).
  This is not legal advice. The owner's trademark search (ADR-0015 §5) and a keep-or-rename
  decision should come before any money is spent on brand assets.
- **The current glyph has no identity.** `icons/glyph.svg` is a filled page with a folded
  top-right corner: the generic file icon found in most icon sets. The manifest lists only SVG
  icons, and `index.html` has no `apple-touch-icon`. So Chrome lacks the 192 and 512 px PNGs it
  wants for install, and iOS before 26 ignores SVG for the Home Screen (§7.2).
- **The brand colour is lemon-lime light, not a paint.** Proposed `--brand-lime`
  `oklch(0.93 0.196 116)` (`#e2f73d`) is 16.7:1 on `--surface-0`, but only 1.19:1 on white. So
  on light backgrounds it needs a partner, `--brand-lime-ink` `oklch(0.52 0.139 132)`
  (`#49780d`, 5.28:1 on white). It shows up as light: the aurora, a glow, a lit edge of the mark.
  This follows Apple's guidance of 2026-09-09: put brand colour "into the content layer, where
  it scrolls beneath Liquid Glass controls".
- **Five mark directions were sketched and measured** (§5). The recommendation: take **03 "Leaf
  r"** (a lowercase r whose arm lifts from the stem like a leaf, with light in the slit) together
  with **05 "ct wordmark"** (the historical c–t ligature of early printed books) as one family to
  develop. Keep **04 "Pane"** (a ribbon of light shifting behind a pane of glass) as the brand's
  motion and background motif rather than the mark. Keep **02 "Spread"** as the backup that
  survives a rename. 01 is the most legible but reads as a generic document or a sticky note.
- **Design the icon for luminance, not hue.** In iOS tinted and clear appearances, lime
  (luminance 0.83) and glass white (0.91) merge: a ratio of 1.10:1, measured on greyscale
  renders. Any part of the mark that only colour sets apart disappears. Shape must carry the
  identity.
- **Web clips get Apple's glass whether we want it or not.** iOS 26 composites Liquid Glass
  over a flat web-clip icon, and there is no opt-out. A public project's commit log reports
  that the lens band greys the bottom edge. Its fix was to keep the mark within 62 % of the tile
  and at least 19 % above the bottom edge. Recto's icon puts the mark at 60 % and centres it
  (§7.3). One field report, not verified on a device.
- **/recto/about stays a sibling of the app** (ADR-0016 decision 4). It is rebuilt on the new
  design language in eight sections (§10). The **portfolio case study lives at
  `erendenizk.github.io/work/recto/`**: a path under `/recto/` would be served by the project
  site, not the portfolio. It is structured problem → principles → process → decisions with ADR
  links → before/after → measured results → what's next (§11).
- **Outside help is worth it for two things only.** First, the final mark and icon craft:
  pixel-fitting at 16 px, the Icon Composer layers and specular tuning. Second, optionally a
  type designer for the ct ligature. The colour tokens, icon pipeline, voice guide, about page,
  press kit and case study are in-house work. They come after the M9 design language settles
  and after the M9 UI is built, because the media show it (§14).

---

## 1. Where the brand stands today

| Asset | Today | Source |
|---|---|---|
| Name | Recto; descriptor "Recto PDF"; storage names stay `pdf-editor-*` | ADR-0015 |
| Address | `erendenizk.github.io/recto/`, about at `/recto/about/`, redirect folder at `/pdf-editor/` | ADR-0016 |
| Glyph | 24-unit filled page with a folded top-right corner; light and dark via `prefers-color-scheme` inside the SVG | `apps/web/public/icons/glyph.svg` |
| App icon | Same glyph at 50 % of a `#101215` square, `purpose: maskable` | `icons/app-icon.svg` |
| Manifest icons | Two SVGs (`sizes: any`), no PNG | `apps/web/vite.config.ts` |
| Head tags | `<link rel=icon>` SVG only; no `apple-touch-icon` | `apps/web/index.html` |
| Theme colours | `theme_color #181a1f`, `background_color #08090b` | `vite.config.ts` |
| Social preview | 1280×640, glyph + name + thesis, hero still bleeding right, "near-black field, no gradient" | presentation spec §4, `tools/media/social/template.html` |
| About page | Plain HTML/CSS, dark only, ≤ 300 KB without video, same CSP, clips from the media pipeline | presentation spec §3, `apps/web/about/` |
| Copy rules | Mechanism words, evidence one click away, banned-word list, no emoji or exclamation marks | presentation spec §1.2–1.3 |
| Wordmark | None. "Recto" set in Inter next to the glyph | `about/index.html` |
| Accent | `#7c8cff`, `oklch(0.681 0.169 275)`; "one accent" | `tokens.css`, research 13 §9 |

What the brief of 2026-10-04 changes: the owner wants glass, floating objects, light and
motion everywhere, and "a yellow-green, lime-coloured, moving, vivid aurora light at a few
points". The app should feel "smart, rich and expensive" on phone and desktop. The brand has
to come from the same language, or the about page and README will look like a different
product from the app.

Measured on the current glyph: when an `<img>` shows it on a dark strip under a light OS
setting, it renders dark-on-dark. The SVG follows the OS colour scheme, not the background it
sits on. This is correct for browser tabs. It means the same SVG cannot be reused inside the
app's dark UI or the about page; inline SVG with `currentColor` belongs there.

## 2. The name

### 2.1 What "recto" offers visually

The terms come from Latin *rēctō foliō*, "on the right side of the leaf" (*rectus*: straight,
right, upright), against *versō foliō*, "on the turned side". In a bound book the recto is the
right-hand page and carries the odd number. Page 1 is always a recto. On a loose sheet the
recto is the front, the side with the main image or writing. Manuscript scholars number leaves
"1r, 1v". (Wikipedia and dictionary abstracts; established bibliographic usage.)

| Motif | What it means | How a mark could use it | Risk |
|---|---|---|---|
| Right-hand page | The page you see first in a spread | Open spread, right leaf lit (direction 02) | Open-book icons are common; Apple Books uses one |
| Front of a leaf | The side facing you, or facing the light | A leaf with its lit face toward the viewer | Generic "page" |
| Turning the page | A recto is turned from its outer edge | Lower-right corner lifting (01) | Dog-ear = generic file icon; lower-right curl = sticky note |
| *rectus*: upright, straight | Right angle, upright stance | Upright stem, square terminals (03) | Too abstract on its own |
| Leaf | A sheet of two pages | The r's arm as a leaf peeling from the stem (03) | — |
| 1:√2 | ISO 216 page proportion (A4) | Every page shape in the marks is 14 × 19.8 units | Invisible to most people; a hidden rigour detail |
| "1r" foliation | Scholarly leaf numbering | A superscript r | Obscure |
| The ct ligature | A c–t ligature with a connecting arc, common in early printed books | Signature detail in the wordmark (05) | Needs drawing skill to look intentional |
| Light table | Recto's Arrange view; pages on a lit surface | The aurora behind glass (04) | Literal |

### 2.2 Namesakes found on 2026-10-04

| Project | Category | Since | Licence / model | Overlap with Recto |
|---|---|---|---|---|
| `JaguarM/Recto` | "An extensible PDF editor" (Python, Windows), 86 commits | 2026-07-13 (first commit, README already "# Recto") | MIT | **Same category** |
| `FileSherlock/Recto` | "An extensible PDF editor that runs entirely in the browser"; MuPDF and HarfBuzz in WebAssembly; "the document you open never leaves your browser"; 21 commits | 2026-09-18 | AGPL-3.0 | **Same category and same privacy claim** |
| Recto (`Veterba/Recto`) | Local-first Markdown knowledge app, Electron, "nothing is uploaded", v0.42 | active 2026-10-02 | open source | Same privacy pitch, different category |
| Recto Notes (recto-notes.com, `zabrodsk/recto`) | Notes and tasks, Mac and iPhone | 2026 | free | Known in ADR-0015 |
| Recto Agentic (`erikcheatham/Recto`, `app.recto.phone`) | Phone "signing vault for agents" | 2026 | Apache-2.0 | Uses "signing" vocabulary |
| `jensen-zheng-cmd/Recto-plugin` | Zotero PDF → Markdown in Obsidian | 2026 (abstract) | — | PDF-adjacent; Recto also exports Markdown |
| rectoapp.com | SEO internal-linking tool, $39 once | 2026 (abstract) | commercial | Different category |
| Recto Software Pvt Ltd (India), Recto Solutions | Software services | 2025 (abstract) | company | Company names |
| Recto Rush, Recto Verso (Android) | Games / utility | — (abstract) | — | Different category |

Other readings: in the Philippines "Recto" is Claro M. Recto and Recto Avenue in Manila, a
street known for bookshops, which dominates local search results (abstract). ADR-0015 already
lists the Spanish and Portuguese meanings and the Turkish "rekto-" prefix.

### 2.3 What this means (not legal advice)

The two PDF-editor namesakes are small, but they matter for three reasons. They are in the
exact category. One makes the same browser-only claim. One predates ADR-0015 by eleven weeks.
Search results, GitHub search and app-store search will place them next to Recto. A
search-snippet check is not a trademark clearance.

- **BR-N1.** Before commissioning any brand work, the owner runs the trademark searches in
  ADR-0015 §5 (USPTO classes 9 and 42, EUIPO, TÜRKPATENT) and decides: keep Recto, or switch
  to the fallback (Kerf) in the same rename pass. The cheapest moment to switch is before a
  logo, an icon and a press kit carry the name.
- **BR-N2.** If Recto stays, "Recto PDF" stays the descriptor in every metadata field where
  a search or link preview needs context (`og:site_name`, repository description, manifest
  `description`). The README's first line, the about page's `<title>` ("About Recto PDF") and
  the social card all carry the descriptor once.
- **BR-N3.** Directions 01, 02 and 04 do not depend on the name. 03 and 05 do. If the
  decision is still open when design work starts, explore one name-agnostic direction in
  parallel.

## 3. How others built their marks

| Product | Form | Idea | Taken for Recto |
|---|---|---|---|
| Apple Preview | Symbol | A loupe over photos since 2001; the iPadOS 26 app adds a draggable 3D Liquid Glass loupe "with no functional purpose" (9to5Mac, abstract) | One brand object can live in the UI as a moment of play, if it is optional and never in the way |
| Ghostty | Symbol in a device tile | A ghost in a terminal window; Liquid Glass version by an app-icon specialist "with layered specular effects… holds up across all the modes" (designer's post, abstract) | Its `Ghostty.icon` (read in full): background `fill` as a Display-P3 linear gradient; groups with `blend-mode`, `shadow {kind, opacity}`, `translucency {enabled, value: 0.5}`, `specular`; layers with `glass: true/false`, `opacity`, `position`. Raster set 16–1024 px at @1x/@2x. The website's hero is the product itself, an animated terminal at 31 ms per frame, with one sentence and two buttons |
| Obsidian | Symbol | A knapped shard of volcanic glass, drawn by the CEO in 2023, "cut through the clutter" (blog, abstract) | The name's own object, reduced to a few facets |
| tldraw | Symbol from punctuation | The ";" of "tl;dr" as a dot and comma on a white tile (read: `favicon.svg`) | A mark taken from the name's typography. tldraw ships SVG apple-touch icons with a PNG fallback, 192 and 512 PNGs with `any` and `maskable` |
| Excalidraw | Symbol | A hand-drawn pencil scribble on a rounded white tile (read: `favicon.svg`) | Ships 16, 32, 180, 192, 512 PNGs plus maskable 192/512 and a 1200×675 `og-image` (read) |
| Zed | Monogram + wordmark | A geometric Z; brand blue `#1348DC`, white, black (brand page, abstract) | A strict colour set; the repository's brand-voice guide (read, §8) |
| Raycast | Symbol, later a keycap icon | Tried "glass cubes, magnifier glasses"; chose a keycap for keyboard focus (blog, abstract) | Test several metaphors in 3D before choosing |
| Linear | Symbol + wordmark | Geometric mark, "subtle desaturated blue"; the wordmark has "stronger brand recognition" (brand page, abstract) | Lead with the wordmark where there is room |
| Arc | Monogram | Rounded A in blue and red; Marlin Soft SQ and Inter (abstract) | — |
| Things | Symbol | A checkbox on a blue tile; refined for macOS 26 with Default, Dark, Tinted and Clear variants (abstract) | Ship all appearances |
| Goodnotes | Symbol + wordmark | Ruled lines, a "smiling scribble" and a pencil; the team chose to "evolve" rather than restart (studio and blog, abstract) | — |
| Notability | Symbol | New logo and icon in 15.0, August 2025 (abstract) | — |
| PDF Expert | Symbol | Animated feature icons (OCR, Scan, Edit) as a family; user-selectable dark and tinted icons (abstract) | Animated tool glyphs belong to the icon track, not the logo |
| Squoosh | Wordmark + app | The app's first screen is the product: a drop zone, "Or try one of these" with four demo images, then three facts: Small, Simple, Secure ("Images never leave your device") (read: `Intro/index.tsx`) | A demo document one click from the first screen |

Lessons:

1. The strongest marks come from the name's own object or typography (Obsidian, tldraw,
   Ghostty), not from the product category. A page icon says "PDF tool", not "Recto".
2. Under Apple's 2025–26 icon system every icon sits in the same squircle, and macOS Tahoe
   puts non-conforming icons inside a grey squircle. Critics say this "increases visual search
   time in the Dock" (Daring Fireball, Rogue Amoeba, lapcat; abstracts). The silhouette no
   longer distinguishes an app; the inner shape and the colour have to.
3. Specialists did the Liquid Glass versions of Ghostty and many others. Specular highlights,
   translucency and per-size detail are craft work.

## 4. Brand principles

- **BR-B1. The page is the brightest thing.** Branding defers to content. HIG: "Ensure branding
  always defers to content… Resist the temptation to display your logo throughout your app." In
  the app the mark appears in four places only: the browser tab, the Home button in the title
  bar (DESIGN §2: "`0` or the app glyph"), the empty Home state and the About dialog.
- **BR-B2. Lime is light.** The brand colour appears as emitted light: the aurora behind glass,
  a glow at the mark's lit edge, the focus or "live" glints the design language allows. Flat
  lime fills are limited to the mark's small element and the about page's primary button, with
  ink text on it (16.0:1).
- **BR-B3. Proof before promise.** Every public claim links to its evidence (presentation spec
  §1.2). The brand's confidence comes from what a reader can check.
- **BR-B4. Bookish precision, used sparingly.** References from bookmaking (recto, leaf,
  gutter, the ct ligature, 1:√2) give the brand depth. Never faux-antique: no parchment
  textures, no blackletter.
- **BR-B5. One system.** App, about page, README, social card, press kit and case study share
  tokens, type, radii and motion curves. The brand is not a separate visual language.
- **BR-B6. Works at 16 px, in one colour, in grey.** A mark that needs colour or detail to be
  recognised fails in the tab strip, in iOS tinted mode and in print.

## 5. Logo and mark directions

All five are sketches to discuss, drawn on a 24-unit grid. Each file in `docs/brand/concepts/`
says on its face: "Concept sketch · not final · not for use". Colours: ink `#0e100b`, glass
white `#f4f6ee`, lime `#e2f73e`.

### 5.1 The directions

**01 Turn** (`01-turn.svg`). A 14 × 19.8 page (1:√2) with 2-unit corner radii. The lower-right
corner is cut along x + y = 33.6, and the flap is the cut corner reflected across that line, so
it lies on the page: vertices (19, 14.6), (11.6, 22), (11.6, 14.6). In colour the flap is lime,
the turned-back face catching the light. In one colour a 2.2-unit knockout separates flap and
page. *For:* the most legible at 16 px. *Against:* it is the generic file icon with the fold
moved to the bottom, which is where sticky notes curl. In grey the lime flap merges with the
page.

**02 Spread** (`02-spread.svg`). An open book from above. The left leaf (verso) is an outline
with a 1.7-unit stroke from x 2.6 to 10.9. The right leaf (recto) is filled from x 13.1 to
21.4. Top and bottom edges bow (quadratic control 1.6 units above the edge) and dip at the
gutter. *For:* it tells the name's story literally ("the right page is the one you see"),
survives grey (outline against fill), and survives a rename. *Against:* the open-book family
is crowded; Apple Books uses an orange open book on the same Home Screen.

**03 Leaf r** (`03-leaf-r.svg`). A lowercase r. The stem is 4.4 × 15.8 units with 1.1 radius,
from x-height (y 6.2) to the baseline (y 22). The arm is a leaf that starts 1.6 units away from
the stem and curves up to a vertical terminal at x 18.8, like a page edge:
`M11.6 8.9C12.9 6.9 15.2 6.1 18.8 6.2V10.6C15.9 10.5 13.3 11.2 11.6 13.2Z`. The slit between
stem and leaf is lime in the icon: light coming through between the pages. *For:* distinctive,
a true monogram, shares its r with the wordmark, fine at 16 px. *Against:* name-dependent; the
slit vanishes in grey and at 16 px (a 1.6-unit gap is 1.07 px), so a pixel-fitted 16 px master
needs a 2-unit gap. The stem carries most of the weight, so the mark needs optical centring:
an estimated 0.5–1 unit right of its geometric centre, to be set by eye.

**04 Pane** (`04-pane.svg`). A 14 × 19.8 pane with 2.2 radius, 1.6-unit outline in one colour
and a 16 % glass fill in the icon. A ribbon of light about 3.8 units thick crosses horizontally
as a gentle S-curve. Inside the pane it is shifted 2.8 units up, as if refracted. *For:* it is
the new design language in one picture: glass, light and the light table. Name-agnostic.
*Against:* in one colour it reads as a jar with a strap or a battery. Lowest crispness at 16 px.
The first draft used a diagonal band and read as a "prohibited" slash at 16 px, so any variant
must keep the light horizontal.

**05 ct wordmark** (`05-ct-wordmark.svg`). "recto" in lowercase. The c and t are joined by a
ligature arc that springs from the top of the c, loops above the x-height and lands on the top
of the t's stem. It was sketched on Inter Bold outlines (tracking −6 at 200 px, arc 19 px stroke)
and on Noto Serif Bold (arc 15 px). Both fonts are OFL and already bundled in
`packages/engine/assets/fonts`. *For:* an ownable typographic detail with real book-history
roots, and it works with any symbol. *Against:* the hand-drawn arc in the sketch is crude, and
making it look intentional is type-design work. Below about 24 px cap height the arc clutters,
so small uses take the plain wordmark.

### 5.2 Measurements

Rendered at 1× in Chromium from the glyph-only SVGs. "Crisp share" is the fraction of inked
pixels at 16 px with alpha ≥ 230, out of all pixels with alpha above 25. These are
anti-aliased vectors with no hinting, so they show a trend, not a verdict. "Grey" means a
greyscale render of the 180 px icon tile, a stand-in for iOS tinted and clear appearances.

| Direction | Crisp share at 16 px | Survives one colour | Survives grey | Name-agnostic | Distinctiveness (judgement) |
|---|---|---|---|---|---|
| Current glyph | — | yes | yes | yes | none (generic file icon) |
| 01 Turn | **0.62** | yes (knockout) | flap lost | yes | low |
| 02 Spread | 0.40 | yes | **yes** | yes | low–medium |
| 03 Leaf r | 0.41 | yes | slit lost, r stays | no | **high** |
| 04 Pane | 0.36 | weak | **yes** | yes | medium–high |
| 05 Wordmark | — | yes | yes | no | high at display sizes |

Colour facts the marks depend on: lime has relative luminance 0.830 and glass white 0.913.
Their ratio is 1.10:1, so the two read as one tone in grey. Ink is 0.005. Lime on ink is
16.0:1.

### 5.3 Recommendation

- **BR-L1.** Develop 03 + 05 as one family: the r of the monogram is the r of the wordmark,
  and the ct arc is the wordmark's signature. Give the monogram a luminance step for grey: the
  slit becomes a dark gap of at least 2 units, with lime only as a glow at its edge. It then
  survives tinted mode.
- **BR-L2.** Use 04's behaviour (a horizontal ribbon of lime light passing behind glass and
  shifting where it crosses it) as the brand motif for the about page hero, the social card and
  the empty Home state. It does not become the mark.
- **BR-L3.** Keep 02 as the name-agnostic backup in case BR-N1 ends in a rename. Drop 01.
- **BR-L4.** Every final mark ships a pixel-fitted 16 px and 32 px master. The mark is drawn
  for small sizes, not scaled down from 1024.

## 6. Colour: the lime tie-in

Proposed brand tokens, to be reconciled with the M9 colour and aurora tracks, which own the UI
palette and the aurora stops.

| Token | OKLCH | sRGB | Contrast | Use |
|---|---|---|---|---|
| `--brand-lime` | 0.93 0.196 116 | `#e2f73d` | 16.7:1 on `--surface-0`; 1.19:1 on white | Light, glow, the mark's lit element, primary button fill on the about page |
| `--brand-lime-p3` | 0.93 0.235 116 | `color(display-p3 …)` | — | Same uses under `@media (color-gamut: p3)`. The sRGB limit at this L and H is C 0.213; P3 reaches 0.247 |
| `--brand-lime-ink` | 0.52 0.139 132 | `#49780d` | 5.28:1 on white | Lime-family text and marks on light backgrounds |
| `--brand-ink` | 0.17 0.012 120 | `#0f100a` | 19.1:1 against white | Icon tile, social card field, text on lime |
| `--brand-glass` | 0.97 0.008 110 | `#f5f6f0` | 17.6:1 on ink | The mark on dark, glass highlights |

Notes:

- **Hue 116 is lemon-lime**, the owner's "sarı yeşil limon". Robinhood's 2024 "Robin Neon"
  `#ccff00` is `oklch(0.931 0.229 123)`. Every bright lime lands near it. Ours sits ΔE_OK 0.042
  away, yellower and slightly softer. A different industry carries little confusion risk, and
  no single hue is ownable. Recognition comes from the combination: lime light, ink, glass and
  the mark.
- **BR-C1.** Lime never carries text on light backgrounds; `--brand-lime-ink` does. Lime text
  on dark is allowed at display sizes only (≥ 24 px), because large saturated text vibrates on
  near-black.
- **BR-C2.** The brand lime and the UI accent should not compete. Today's periwinkle accent
  (hue 275) sits 159° away from the lime. Two saturated signatures on one screen read as two
  brands. Either the colour track makes the accent a lime-family light with ink-coloured labels
  on fills, or the accent turns neutral and lime stays brand-only. This document does not decide
  that; it flags the conflict.
- **BR-C3.** `theme_color` and `background_color` in the manifest move to the new ink tokens
  in the same change that ships the new icon, so the splash and the title bar match the tile.

## 7. App icon plan

### 7.1 Apple's 2025–26 icon system

From the HIG `app-icons` page (read in full; change log "June 8, 2026: Refined guidance for
Liquid Glass"):

- Icons are a background layer plus one or more foreground layers. The system adds "specular
  highlights, refraction, and translucency" that "adapt with the size of your icon". Icon
  Composer defines the background (solid or gradient), places the foreground, sets effects,
  "annotate[s] for default, dark, and mono appearance variants" and exports.
- "Prefer clearly defined edges in foreground layers." "Vary opacity in foreground layers to
  increase the sense of depth." "Prefer vector graphics… (such as SVG or PDF)." "Let the system
  handle blurring and other visual effects", so no baked specular, shadows, bevels or glows.
- Provide square, unmasked layers; the system masks. Layout 1024×1024 px for iOS, iPadOS and
  macOS. Appearances: default, dark, clear light, clear dark, tinted light, tinted dark. "The
  system automatically generates variants you don't provide." "Keep your icon's core visual
  features the same" across appearances. "Color backgrounds generally offer the greatest
  contrast in dark icons." Colour spaces: sRGB, Gray Gamma 2.2, Display P3.
- "Avoid… extremely thin line weights and sharp corners." "Include text only when it's
  essential."

Ghostty's `.icon` bundle (§3) shows the file format: `icon.json` plus `Assets/*.png`. Its
groups set `translucency.value` 0.5, `shadow.kind` "neutral" at opacity 0.5 or "layer-color"
at 0.2, and per-layer `glass` flags. Lighting is "individual" per group.

### 7.2 What a web app can and cannot do

| Platform | Behaviour | Source |
|---|---|---|
| iOS / iPadOS Safari | `apple-touch-icon` takes precedence over manifest icons. It must be PNG before iOS 26; 180×180 is the standard iPhone size. With no icon, iOS makes a monogram from the site's first letter. Since iOS 26 every Home Screen site opens as a web app by default | openpwa.net, webhint (abstracts) |
| Safari 26 | "Supports the SVG file format for icons everyplace there are icons", including the Home Screen and Dock | WebKit blog (abstract) |
| iOS 26 Home Screen | Composites Liquid Glass over a flat web-clip icon; no opt-out. One project measured its dark ink lifted to grey along the bottom lens band and fixed it by shrinking the mark to 0.62 of the tile, 19 % above the bottom edge, and by rendering 180/167/152/120 px sizes directly instead of letting iOS downsample the 1024 (a 5.7× reduction) | `clickconstruction/pipetooling.github.io` commits of 2026-09-28 and 09-30 (read; one field report) |
| Web clips and appearances | A web clip supplies one image. Dark, tinted and clear variants are generated by the system | HIG (system generates missing variants); inference for web clips |
| Chromium install | Wants 192 and 512 px PNG icons. SVG icons work but "stay in the state they were in at install time" | web.dev, Chrome docs (abstracts) |
| Android masking | Maskable safe zone: "a circle which diameter is 80% of the icon's minimum dimension"; opaque background; non-maskable icons sit in a white circle | MDN `define_app_icons` (read) |
| `monochrome` purpose | Solid-fill badge or notification icon; the UA picks the colour from alpha; Firefox uses it | MDN icons reference (read), Bugzilla (abstract) |
| Favicon minimum | SVG with an internal `prefers-color-scheme` query, a 32 px `favicon.ico`, a 180 px apple-touch PNG, plus manifest 192/512 and a maskable 512 (content scaled to 409 px) | Evil Martians "How to Favicon in 2026" (abstract); `@vite-pwa/assets-generator` "minimal-2023" preset: 64/192/512 transparent, `favicon.ico` 48, maskable 512, apple 180 (read) |
| github.io project path | Browsers ask for `/favicon.ico` at the origin root, which is the portfolio's, unless the page links its own | established knowledge; ADR-0016 |

### 7.3 Composition rules

- **BR-I1. Tile:** opaque, full-bleed, unmasked square. A vertical gradient from
  `oklch(0.21 0.016 120)` at the top to `--brand-ink` at the bottom. A lime radial glow, about
  50 % of the tile in radius at 35–55 % peak opacity, placed behind the mark's lit element. The
  glow is light in the content, not a baked specular.
- **BR-I2. Mark:** glass white with lime only on its small lit element. The mark spans 60 % of
  the tile at most, is optically centred, and its lowest point is at least 19 % (195 px of
  1024) above the bottom edge. This meets the iOS 26 field report and the maskable safe zone:
  a 14 × 20-unit mark at 30.7 px per unit has a half-diagonal of 375 px against a 409 px safe
  radius.
- **BR-I3. Luminance, not hue.** Every part that must stay distinct differs in relative
  luminance by at least 1.5:1 from its neighbour, or is separated by a gap of at least 2 grid
  units (61 px at 1024). Lime against glass white (1.10:1) does not count as a difference.
- **BR-I4. A dark tile.** A lime tile with a dark mark would be the most visible option, but
  web clips cannot ship a dark variant. On a dark Home Screen it would be "excessively bright"
  (HIG on dark icons). The dark tile works in both.
- **BR-I5. Per-size masters.** 180, 167, 152, 120, 64, 32 and 16 px are rendered from
  size-specific SVGs (the 16/32 pixel-fitted glyph from BR-L4), not downsampled from 1024.

### 7.4 File list (web, ships with the new mark)

| File (under `apps/web/public/`) | Size | Format | Purpose | Referenced by |
|---|---|---|---|---|
| `icons/glyph.svg` (path kept) | any | SVG, internal `prefers-color-scheme`, ≤ 2 KB | Favicon in modern browsers; manifest `any` | `index.html`, `about/index.html`, manifest |
| `favicon.ico` | 16, 32, 48 | ICO, 32 bpp | Legacy and Windows shortcuts; stops requests reaching the portfolio root | `<link rel="icon" sizes="32x32">` |
| `icons/apple-touch-icon.png` | 180 | PNG, opaque, ≤ 20 KB | iPhone Home Screen | `<link rel="apple-touch-icon">` |
| `icons/apple-touch-icon-167.png`, `-152.png` | 167, 152 | PNG | iPad Pro, iPad | `<link rel="apple-touch-icon" sizes>` |
| `icons/icon-192.png`, `icon-512.png` | 192, 512 | PNG | Chromium install, Android splash | manifest `purpose: any` |
| `icons/icon-maskable-512.png` (+192) | 512, 192 | PNG, opaque, mark ≤ 80 % circle | Android adaptive icon | manifest `purpose: maskable` |
| `icons/icon-mono.svg` | any | SVG, single fill on transparency | Badges, notifications | manifest `purpose: monochrome` |
| `icons/app-icon.svg` (path kept) | any | SVG | Chromium maskable at any size | manifest `maskable` |
| Shortcut icons (only if the flows track adds manifest `shortcuts`) | 96 | PNG/SVG | Jump-list entries | manifest `shortcuts[].icons` |
| Manifest `screenshots` | 1280×800 wide, 750×1334 narrow, 2–5 each | WebP/PNG from the media pipeline | Chrome's richer install dialog | manifest (established knowledge; verify sizes when built) |

Not shipped: `apple-touch-startup-image` sets. HIG says the launch screen should be "nearly
identical to the first screen", not branding, and a solid background colour does that.
Safari's `mask-icon` and Windows `msapplication` tiles are obsolete.

### 7.5 Native set, only when the Tauri shell starts (ROADMAP M9, ADR-0007)

- **macOS:** an Icon Composer `.icon` built from the designer's layers: background gradient in
  Display P3, a glass-white foreground group, and a lime group with specular on. Annotated for
  default, dark and mono; tested in all six appearances. Plus an `.icns` fallback, 16–1024 at
  @1x/@2x like Ghostty's set.
- **Windows:** `icon.ico` with 16, 24, 32, 48, 64 and 256 px layers, 32 px first (Tauri docs,
  read). **Linux:** 32, 128, 256 (128@2x) and 512 PNG. The Tauri `icon` command can generate
  these, but the small sizes should come from the pixel-fitted masters.

### 7.6 Pipeline

- **BR-I6.** Add `tools/brand/` beside `tools/media/`: one Playwright script renders every
  file in §7.4 from the SVG masters (as the media tool does), compresses PNGs with `oxipng`, and
  writes `budgets.json`. A test checks each file: dimensions, opaque corners where required,
  the mark's bounding box (≤ 60 % of the tile, ≥ 19 % bottom clearance, inside the 80 %
  circle), luminance separation on a greyscale render (BR-I3), and file size.

## 8. Voice and tone

The copy rules in presentation spec §1.2–1.3 already match what the best developer-tool brands
write. Zed's brand-writer guide (read in full) describes the same voice: "thoughtful,
technically grounded, and quietly confident… Never try to sell. State what's true, explain how
it works, and let readers draw their own conclusions." It scores copy on technical grounding,
natural syntax, quiet confidence and respect for the reader, 1–5 each, and passes only 4+ on
all.

- **BR-V1.** Keep §1.2–1.3 and add Zed's taboo words that are missing from Recto's list:
  robust, frictionless, leverage, unlock, supercharge, next-generation, cutting-edge,
  game-changing, groundbreaking, innovative, intuitive, elegant, world-class,
  state-of-the-art. Also ban three structures: chains of em dashes, "It's not X, it's Y", and
  three-word slogans ("Fast. Private. Free.").
- **BR-V2.** The new design language does not change the voice. A rich-looking page with
  plain sentences reads as expensive; a rich-looking page with hype reads as a template.
- **BR-V3. Turkish:** keep the polite *siz* register the app already uses (59 *siz* forms in
  `messages/tr.json`, no *sen*). Write Turkish copy fresh rather than translating sentence by
  sentence. "Recto" stays the name; "PDF düzenleyici" is the descriptor.
- **BR-V4. Names for things** stay the app's nouns: light table, Read, Edit, Arrange, Intact,
  Changed after signing, recipe.

| Instead of | Write |
|---|---|
| "The most private PDF editor." | "Your files never leave this tab. The page may connect only to its own address; check the CSP line." |
| "Blazing-fast, seamless editing." | "Pages render in a WebAssembly copy of PDFium inside the tab. Edits go into an undo history; nothing is written until you export." |
| "Gizliliğiniz bizim için önemli." | "Dosyalarınız bu sekmeden çıkmaz. Sayfa yalnızca kendi adresine bağlanabilir." |

## 9. Motion branding

- **BR-M1. No splash screen.** HIG: a launch screen "isn't a branding opportunity", and
  "people seldom need to be reminded which app they're using". The app opens straight to Home.
- **BR-M2. Logo reveal, once, on the about page hero.** For 03, the leaf lifts from the stem
  by 6° and light comes up in the slit. For 04, the ribbon slides in from the left and jogs
  where it meets the pane. 700 ms total, one movement plus the light. Use the design language's
  standard spring if it settles within that time; otherwise
  `cubic-bezier(0.16, 1, 0.3, 1)`. It plays once per session (sessionStorage, wrapped in
  try/catch). Under `prefers-reduced-motion: reduce` the final frame shows at once.
- **BR-M3. Aurora periods far from 0.2 Hz.** HIG: "Avoid showing objects that oscillate in a
  sustained way… around 0.2 Hz." Three light fields drift with periods of 23, 31 and 37 s. The
  ratios share no factor, so the pattern takes a long time to repeat. Amplitude is at most 8 %
  of the viewport width.
- **BR-M4. Stop within 5 s on public pages.** WCAG 2.2.2 requires a pause for auto-moving
  content that runs longer than 5 s next to other content. On the about page and in the case
  study the aurora animates for 5 s after load, then holds. It moves again only with scroll,
  which the user starts. In the app the aurora track decides; the in-app setting that turns off
  transparency and motion stops it too.
- **BR-M5. No animated favicon.** Chromium does not animate SVG favicons, and a moving tab
  icon competes with the document.
- **BR-M6. One playful object, optional.** Preview's loupe shows that a brand object can live
  in the UI. A Recto equivalent, for example the empty Home state's mark catching the light
  under the pointer, must be decorative, must not respond to keyboard focus, and must disappear
  under reduced motion.

## 10. /recto/about: information architecture

Constraints carried from presentation spec §3 and ADR-0016: a sibling of the app, plain HTML
and CSS with no app bundle, the same CSP, ≤ 300 KB transferred without video, `preload="none"`
videos with posters, posters only under reduced motion, English first and Turkish at
`/recto/about/tr/` once the copy settles. New: both colour schemes once the light theme ships,
and the M9 design language. Glass is honest here because the aurora is behind it, which avoids
the uniform-canvas problem in research 13.

1. **Top bar** (glass, sticky, 56 px): mark + "Recto", links Features · Privacy · Open source ·
   EN/TR, primary button "Open Recto" (lime fill, ink label).
2. **Hero:** one-line thesis at `clamp(40px, 6vw + 12px, 88px)` (the type track sets the exact
   scale), one line listing the jobs, primary "Open Recto", secondary "Try it with a demo PDF".
   The secondary needs the app to open a same-origin demo file from a URL parameter; Squoosh's
   "Or try one of these" is the precedent. That is a dependency on the flows track. The visual
   is a looping 6–8 s capture of the M9 UI on the aurora field (BR-L2), with the logo reveal
   (BR-M2). Under the hero, a proof strip: "No account · Nothing is uploaded · Works offline ·
   Apache-2.0", each item linking to its evidence.
3. **The flow in three beats:** Open → Read → Mark up or Arrange. Three short clips that
   follow the M9 user flow, so a visitor learns the app's model before opening it.
4. **Chapters, four to six:** Arrange (light table), Write and sign (pens, Highlighter,
   signatures), Fill forms, Redact, Edit text, Recognise and compare. Each has a claim, a clip,
   and one "does not do" line. The full limits move to a disclosure.
5. **Privacy you can check:** today's "Check it yourself" list as glass cards, with the request
   log link.
6. **On every screen:** real captures at 1440 × 900 and 390 × 844. No fake device hardware: HIG
   forbids replicas of Apple hardware, and presentation spec §2.1 bans fake chrome. Then how to
   install it as an app on desktop, Android and iOS.
7. **How it works:** the inline SVG architecture diagram, restyled.
8. **Open source and who made it:** Apache-2.0, NOTICE, credits (PDFium, pdf-lib, qpdf,
   tesseract, the fonts, and the designer if one is hired), "Built by Eren Deniz K." linking to
   the case study, footer with version, release notes, roadmap, press kit and licence.

- **BR-A1.** Keep `og:image` absolute and render it at 1200 × 630, the size every major preview
  consumer handles. Keep 1280 × 640 for GitHub's social preview. Both come from one template
  with a central 1080 × 560 safe area and text at least 48 px tall.
- **BR-A2.** No live embed of the app inside the about page. Clips and a link keep the page
  within budget. Separately: the app's CSP `frame-ancestors 'none'` is delivered in a `<meta>`
  tag, where browsers ignore that directive (established knowledge of CSP Level 3). So it does
  not prevent framing today. This is out of this track's scope and should go to whoever owns
  security headers.

## 11. The portfolio case study

Where: `erendenizk.github.io/work/recto/`, in the `ErenDenizK.github.io` repository. Not under
`/recto/`, because the project site claims that path (ADR-0016). The portfolio root never
registers a service worker (ADR-0016 decision 1).

Structure (the standard context, problem, process, solution, outcome shape that portfolio
guides describe; abstracts), adapted for a designer-engineer:

1. **Title and outcome line, plus a meta strip:** role (design and engineering), timeline
   (first commit 2026-09-26; M0–M8 in about nine days, 182 commits by 2026-10-04), stack,
   links to the app, the repository and the about page.
2. **The problem:** hosted PDF tools upload files; open-source toolkits are grids of
   single-purpose tools (VISION, research 02).
3. **Principles:** local first, correctness over feature count, one workspace, and the M9
   language.
4. **Process:** the research → spike → ADR → spec → build → audit loop, as a milestone
   timeline M0–M10 with dates. Counts link to the documents: 21 ADRs, 14 research reports and
   8 specs before M9, plus the M9 set.
5. **Decisions, five to seven cards:** context, options, decision, consequence, ADR link.
   Candidates: engine stack (ADR-0002), virtual document model (ADR-0005), document modes
   (ADR-0019), paragraph text editing (ADR-0020), one highlighter and the lasso (ADR-0021), the
   M9 glass language (its new ADR), the name (ADR-0015).
6. **Craft details:** low-latency ink (research 12's measured numbers), redaction verified on
   the exported bytes, glass contrast proven against the worst-case white page (research 13).
   Each gets a short clip.
7. **Before and after:** M0 shell (`docs/design/screenshots/m0-*`), M6
   (`docs/design/audit-2026-10/m6-v1-*`) and M9. Same fixture, same viewport, same state,
   captured by script, shown with a drag slider; the reduced-motion version shows side-by-side
   stills.
8. **Results that can be measured honestly:** 30 end-to-end specs and 229 unit-test files, CI
   on Chromium, Firefox and WebKit, zero requests to other origins in the media run's log, the
   bundle and precache sizes, INP and frame times measured on a named machine. No usage numbers:
   Recto has no analytics by design, and the case study says so.
9. **What I would do next:** M10 tablet and phone, the Tauri shell, the known limits.
10. **Credits and tooling.** Say plainly who did what and with which tools. A case study that
    overclaims authorship is a liability for a portfolio.

- **BR-P1.** The README stays the source text (presentation spec §1). The about page and the
  case study copy its sentences, so one fact never has two versions.
- **BR-P2.** Capture before/after images with the existing media harness: a scene per state,
  `deviceScaleFactor: 2`, fixed clock, demo fixtures. Old states come from tagged commits
  (`v1.0.0-beta.0` for M7), built and served in CI.

## 12. Press kit and social preview

- **BR-K1. Press kit** at `/recto/about/press/`, plus `recto-press-vX.Y.Z.zip` attached to the
  release by the release workflow. It contains:
  - a fact sheet: name, descriptor, a one-line, a 50-word and a 150-word description in EN and
    TR, licence, URL, version, status, maker, contact;
  - the logo pack: mark, wordmark and lockups as SVG and PNG, on dark and light, plus one
    colour;
  - app icon PNGs at 1024, 512 and 180;
  - six to ten screenshots: 1440 × 900 @2x and 390 × 844 @3x, dark and light, demo fixtures;
  - three clips as MP4;
  - colour values in OKLCH, hex and P3;
  - font credits (Inter, OFL);
  - usage rules: clear space equal to the r's x-height, minimum sizes of 16 px for the mark and
    64 px wide for the wordmark, and don'ts.

  Indie press-kit guides list the same parts: fact sheet, descriptions, screenshots, video,
  logos, contact, one-click zip (abstracts).
- **BR-K2. Brand licence.** Apache-2.0 §6 "does not grant permission to use the trade names,
  trademarks, service marks, or product names of the Licensor". The brand files should say so
  explicitly. A `TRADEMARKS.md` would allow use of the name and logo to refer to Recto, forbid
  implying endorsement, and ask forks that ship builds to rename. NOTICE and the README would
  exclude `docs/brand/` and the icon files from the code licence. This is not legal advice; the
  owner confirms.
- **BR-K3. Social card:** ink field, aurora ribbon (BR-L2), mark and wordmark, the thesis in
  two lines, the M9 UI capture bleeding off the right edge. One template renders 1280 × 640
  (GitHub) and 1200 × 630 (`og:image`). This replaces the "no gradient" rule in presentation
  spec §4.

## 13. Brief for an external designer

**Project.** The logo and app icon for Recto, a free, open-source PDF editor that runs in the
browser and never uploads a file. Apache-2.0, built by one person, public beta. The app is
being redesigned (M9) in a glass-and-light language with a lemon-lime aurora.

**Deliverables.**

1. Mark: final vector on a 24-unit grid plus a 1024 master; pixel-fitted 16 and 32 px masters.
2. Wordmark "recto", lowercase, drawn rather than typed. If the ct ligature is kept, the arc is
   designed as part of the letters.
3. Lockups: horizontal and stacked; clear-space and minimum-size rules.
4. App icon: a flat 1024 master for the web (§7.3). Layer sources for Icon Composer: a
   background spec and two or three foreground SVG layers. Default, dark and mono annotations.
   Test renders in all six iOS appearances.
5. Favicon SVG with an internal dark-mode query (≤ 2 KB) and ICO layers 16/32/48.
6. Colour spec, starting from §6: lime, lime ink, ink and glass in OKLCH, hex and P3.
7. Motion: a storyboard for the logo reveal (≤ 900 ms) and its static reduced-motion frame,
   delivered as SVG with named layer ids plus timing. We implement it in CSS or SVG; no Lottie
   runtime.
8. A short brand guide as PDF and web page: usage, clear space, don'ts.

**Constraints.**

- Recognisable at 16 px, in one colour and in greyscale (BR-B6, BR-I3).
- No text in the icon beyond a monogram.
- Avoid the generic file icon, an open book on a coloured tile (Apple Books), any diagonal
  slash, and anything close to Robinhood's neon-on-black or Google Docs.
- The mark stays within 60 % of the tile, with ≥ 19 % bottom clearance and inside the 80 %
  maskable circle.
- Inter remains the UI typeface; the wordmark may be custom.

**What we provide.** This report and the five concept sheets. Captures of the M9 UI.
`tokens.css` and the M9 design-language documents. The bundled OFL fonts. The current README and
about page. The namesake findings (§2.2). Our acceptance script (BR-I6).

**Rights.** The owner holds copyright in the final files by written assignment. Brand assets
are excluded from Apache-2.0 and published under a trademark policy (BR-K2). The designer is
credited in NOTICE and on the about page if they wish, and may show the work after launch.

**Process.** Kick-off. Two weeks to three directions (one may build on our 03/05). One week to
refine one direction. One week to produce the files. Acceptance runs BR-I6 on every file. Budget
and schedule: the owner's call.

## 14. Sequencing

| Phase | When | Work | Who |
|---|---|---|---|
| 0 | Now (M9 wave 1) | This research; BR-N1 trademark search and the keep-or-rename decision | Owner (search), lead |
| 1 | After the M9 design-language ADR settles | Brand tokens reconciled with the colour and aurora tracks (§6); voice update (§8); internal refinement of 03/05 and 02 to the BR-L1 rules; `tools/brand/` pipeline (BR-I6) with the current glyph as a stand-in; add the missing PNG icons and `apple-touch-icon` even before the new mark (§7.4) | In-house |
| 2 | After BR-N1 is resolved, in parallel with the M9 build | Designer brief (§13): mark, wordmark, icon, reveal | **Outside help** (icon and logo specialist; optionally a type designer for the ligature) |
| 3 | After the M9 UI is built and frozen | New media scenes; about page v2 (§10); social card (BR-K3); README hero; press kit (BR-K1); `TRADEMARKS.md` (BR-K2) | In-house; optional native-English copy edit |
| 4 | After M10 (tablet and phone) | Phone captures in the about page and press kit; Turkish about page; portfolio case study (§11) in the portfolio repository | In-house |
| 5 | Only if the Tauri shell starts | Native icon set (§7.5) from the designer's layers | In-house with the designer's sources |

Why this order: brand work that starts before the UI exists ends up redone, and a logo
commissioned before BR-N1 may carry a name that changes. The about page and case study show the
product, so they wait for the product. The PNG icons in §7.4 are a gap today and can ship with
the current glyph at once.

## 15. Tensions with current decisions

1. **ADR-0015** ("Recto has no PDF-editor namesake") is contradicted by `JaguarM/Recto`
   (2026-07-13) and `FileSherlock/Recto` (2026-09-18). Reopen the name risk before brand spend
   (BR-N1).
2. **DESIGN.md §1** ("Nothing glows") conflicts with the brand's light (BR-B2). This is the
   same change the M9 design language makes. Apple's branding guidance of 2026-09-09 supports
   brand colour in the content layer under glass.
3. **Presentation spec §4 and `tools/media/social/template.html`** ("near-black field, no
   gradient"): replace with the aurora card (BR-K3). §2.1's "no device frame, no fake browser
   chrome" stays.
4. **Presentation spec §3** ("Dark only"): both schemes once the light theme ships (§10).
5. **`tokens.css` accent `#7c8cff`** against a lime brand: two competing signatures (BR-C2).
6. **`vite.config.ts` manifest icons and `index.html`**: SVG-only icons and no
   `apple-touch-icon`. Add the §7.4 set; the `theme_color` and `background_color` follow BR-C3.
7. **Presentation spec §1.3** banned words: extend (BR-V1).

## 16. Open questions for the owner

1. After the trademark search: keep Recto despite the two PDF-editor namesakes, or rename to
   Kerf before any brand spend?
2. Is there a budget for an outside designer? If so, an app-icon specialist (mark and icon)
   only, or a type designer for the wordmark too?
3. Which direction to develop: 03 + 05 (recommended), 04, or 02?
4. Should lime become the UI accent, or stay brand light only (BR-C2, with the colour track)?
5. Is a custom domain wanted before the rebrand launches? ADR-0016 says a later domain move
   needs a second rename, and a brand launch is the natural moment for it.
6. Case study: English only, or English and Turkish? How should authorship and the tools used
   to build Recto be described?
7. Is there a launch plan (for example a "Show HN" post or a newsletter mention) that the press
   kit and social card should be timed for?

## Sources

Read in full (primary):

- Apple HIG JSON: [app-icons](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/app-icons.json), [branding](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/branding.json), [launching](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/launching.json), [onboarding](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/onboarding.json), [motion](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/motion.json), [color](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/color.json) (read in full)
- Ghostty `images/Ghostty.icon/icon.json` and `images/icons/`: https://github.com/ghostty-org/ghostty (read in full)
- Ghostty website `src/app/HomeContent.tsx`: https://github.com/ghostty-org/website (read in full)
- Excalidraw `public/` and `excalidraw-app/vite.config.mts`: https://github.com/excalidraw/excalidraw (read in full)
- tldraw `apps/dotcom/client/public/favicon.svg`, `manifest.webmanifest`, `index.html`, `src/utils/consoleBranding.ts`: https://github.com/tldraw/tldraw (read in full)
- Zed `docs/.conventions/brand-writer/` (SKILL, rubric, taboo phrases) and `assets/images/zed_logo.svg`: https://github.com/zed-industries/zed (read in full)
- Squoosh `src/shared/prerendered-app/Intro/index.tsx`: https://github.com/GoogleChromeLabs/squoosh (read in full)
- Tauri `src/content/docs/develop/icons.mdx`: https://github.com/tauri-apps/tauri-docs (read in full)
- MDN `web/progressive_web_apps/manifest/reference/icons` and `how_to/define_app_icons`: https://github.com/mdn/content (read in full)
- `@vite-pwa/assets-generator` 2.0.0, `dist/presets/minimal-2023.mjs`: https://www.npmjs.com/package/@vite-pwa/assets-generator (read in full)
- Namesake repositories, READMEs, licences and commit history: https://github.com/JaguarM/Recto, https://github.com/FileSherlock/Recto, https://github.com/Veterba/Recto, https://github.com/zabrodsk/recto, https://github.com/erikcheatham/Recto (read in full)
- iOS 26 web-clip field report, commit messages of 2026-09-28 (v2.4095) and 2026-09-30 (v2.4227): https://github.com/clickconstruction/pipetooling.github.io (read in full; one project's observation)
- Repository: ADR-0015, ADR-0016, ADR-0007, `docs/design/naming.md`, `docs/specs/presentation.md`, `docs/DESIGN.md`, `docs/VISION.md`, `docs/ROADMAP.md`, research 13, `apps/web/about/`, `apps/web/index.html`, `apps/web/vite.config.ts`, `apps/web/public/icons/`, `tools/media/`, `apps/web/messages/tr.json` (read in full)

Known only from search abstracts:

- Recto and verso: https://en.wikipedia.org/wiki/Recto_and_verso, https://www.dictionary.com/browse/recto
- Recto Avenue and Claro M. Recto: https://en.wikipedia.org/wiki/Recto_Avenue, https://en.wikipedia.org/wiki/Claro_M._Recto
- Other Recto products: https://rectoapp.com/, https://play.google.com/store/apps/details?id=app.recto.phone, https://recto-notes.com/, https://github.com/jensen-zheng-cmd/Recto-plugin, https://www.tofler.in/recto-software-private-limited/company/U62091OD2025PTC050778, https://tracxn.com/d/companies/recto-solutions/__oxZkglLileNRHXDOO6eRY3yY6lgOZo-_9jpQEkgaqMQ
- Obsidian icon: https://obsidian.md/blog/new-obsidian-icon/, https://commons.wikimedia.org/wiki/File:2023_Obsidian_logo.svg
- Raycast: https://www.raycast.com/blog/a-fresh-look-and-feel, https://www.behance.net/gallery/94878995/Raycast-Branding
- Ghostty icon designer posts: https://x.com/flarup/status/1936884227049406685, https://x.com/mitchellh/status/1866226936051056719
- Zed brand page: https://zed.dev/brand
- Linear brand page: https://linear.app/brand
- Arc: https://en.wikipedia.org/wiki/Arc_(web_browser), https://www.loftlyy.com/en/arc-browser
- Things icon: https://www.iosicongallery.com/icons/things-3-2025-11-06/, https://culturedcode.com/things/blog/
- Goodnotes: https://www.goodnotes.com/blog/goodnotes-new-look, https://www.underconsideration.com/brandnew/archives/new_logo_and_identity_for_goodnotes_by_motto.php
- Notability: https://en.wikipedia.org/wiki/Notability_(application)
- PDF Expert: https://dribbble.com/shots/15234831-PDF-Expert-Icon-Animations, https://9to5mac.com/2022/06/28/readdle-pdf-expert-redesign/
- Preview loupe: https://9to5mac.com/2025/08/12/ipad-ios-26-preview-app-easter-egg-liquid-glass/, https://9to5mac.com/2026/06/15/preview-on-ios-27-inherits-fun-liquid-glass-easter-egg-from-ipados-26/, https://macmost.com/10-mac-app-icons-and-what-they-represent.html
- Icon Composer guides: https://developer.apple.com/videos/play/wwdc2025/361/, https://www.createwithswift.com/crafting-liquid-glass-app-icons-with-icon-composer/
- macOS Tahoe icon criticism: https://lapcatsoftware.com/articles/2025/6/2.html, https://daringfireball.net/linked/2025/11/07/tahoes-terrible-icons, https://weblog.rogueamoeba.com/2026/06/26/free-the-icons/
- Web icons: https://web.dev/articles/maskable-icon, https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs, https://webkit.org/blog/17333/webkit-features-in-safari-26-0/, https://openpwa.net/reference/installation/ios-add-to-home-screen/, https://webhint.io/docs/user-guide/hints/hint-apple-touch-icons/, https://web.dev/learn/pwa/web-app-manifest, https://w3c.github.io/manifest/, https://bugzilla.mozilla.org/show_bug.cgi?id=1602126
- Robinhood "Robin Neon": https://robinhood.com/us/en/newsroom/a-new-visual-identity/
- Landing pages: https://evilmartians.com/chronicles/we-studied-100-devtool-landing-pages-here-is-what-actually-works-in-2025
- Portfolio case studies: https://ixdf.org/literature/article/how-to-write-great-case-studies-for-your-ux-design-portfolio
- Press kits: https://presskit.gg/blog/indie-game-press-kit-guide
- Open Graph sizes: https://opengraphchecker.com/blog/open-graph-image-size/
- Apache-2.0 §6 and ASF branding: https://www.apache.org/licenses/LICENSE-2.0, https://www.apache.org/foundation/marks/faq/
- Logo animation and WCAG 2.2.2: https://www.svg-animation.com/article/how-svg-line-drawing-animation-works

Established knowledge, not checked against a source in this session: ISO 216 page proportions;
CSP Level 3 ignoring `frame-ancestors` in `<meta>`; Chromium not animating SVG favicons; manifest
`screenshots` for Chrome's richer install dialog; Apple Books' open-book icon.
