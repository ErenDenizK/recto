---
title: "Brand plan: name, mark, app icon, About page and portfolio (M9)"
date: 2026-10-04
status: plan
---

> This plan turns research 21 (`docs/research/21-brand-and-portfolio.md`) into steps the owner
> can take; BR-* IDs point to it. Colour and type come from research 20, the aurora from research
> 17, contrast limits from research 22. The boards in `docs/brand/concepts/` are sketches only.

# Brand plan

## 0. Summary

**Settled already.** The app is at `erendenizk.github.io/recto/`, the About page at
`/recto/about/` (ADR-0016): plain HTML and CSS, the app's CSP, ≤ 300 KB without video
(presentation spec §3). Storage names stay `pdf-editor-*` (ADR-0015 §3). Copy rules §1.2–1.3 stand.

**Recommended here, waiting for the owner.**

1. Gate 0: trademark searches, then keep Recto or rename. No brand spend before this (§1).
2. One lime for brand and product: the accent `#c8fb3d` (§4).
3. The mark: "Leaf r" with the "ct" wordmark as one family; "Pane" as the motion and background
   motif; "Spread" as the backup if the name changes (§3).
4. An icon file set, geometry rules and a `tools/brand/` render-and-check pipeline (§5).
5. The About page in eight sections once the M9 UI exists (§8); a case study at
   `erendenizk.github.io/work/recto/`, a press kit and a new social card (§9).

**Needs outside help.** The final mark and icon craft; optionally a type designer (§10).

## 1. Gate 0: the name

### 1.1 What changed since ADR-0015

ADR-0015 (2026-10-01) says "Recto has no PDF-editor namesake". Research 21 found two on
2026-10-04. Both used the name before we did.

| Project | What it is | Since | Why it matters |
|---|---|---|---|
| `JaguarM/Recto` | "An extensible PDF editor" (Python, Windows, MIT) | 2026-07-13 | Same category |
| `FileSherlock/Recto` | "An extensible PDF editor that runs entirely in the browser"; "the document you open never leaves your browser" (AGPL-3.0) | 2026-09-18 | Same category, almost our exact claim |
| `Veterba/Recto` | Local-first Markdown app, "nothing is uploaded" | active 2026-10 | Same privacy pitch |
| Recto Notes, Recto Agentic, `Recto-plugin`, rectoapp.com, two software companies, two Android apps | Notes, a signing vault, Zotero PDF to Markdown, SEO, services, games | 2025–26 | A crowded name in software |

All are small, and search snippets showed no registered mark. A snippet is not a clearance.
Search engines, GitHub and app stores will list these projects next to Recto.

### 1.2 The searches the owner runs

Search **RECTO** (exact), **RECTO\*** (prefix), **REKTO**, **RECTO PDF**, then the fallback
**KERF**. Include live, pending and dead records; save a dated screenshot of each result page.

| Registry | Address | Classes |
|---|---|---|
| USPTO Trademark Search (US) | tmsearch.uspto.gov | 9 (downloadable software), 42 (online software, SaaS) |
| EUIPO eSearch plus (EU marks) | euipo.europa.eu/eSearch | 9, 42 |
| TMview (national offices in the network) | tmdn.org/tmview | 9, 42 |
| WIPO Global Brand Database (Madrid marks) | branddb.wipo.int | 9, 42 |
| TÜRKPATENT (Turkey) | turkpatent.gov.tr, "Marka Araştırma" (the full search may ask for an e-Devlet login) | 9, 42 |

Then check use without registration: the App Store and Google Play for "Recto", GitHub for
"Recto pdf", a web search for "Recto PDF editor".

### 1.3 The decision

- **A live or pending mark for RECTO or a close variant in class 9 or 42:** rename, or ask a
  trademark lawyer before keeping the name.
- **Registries clear:** the owner chooses. Keeping Recto is defensible: the namesakes are small
  and unregistered, and "Recto PDF" plus our mark tell us apart. Renaming buys a name that stays
  clear in search. Earlier use can count without registration in some countries (the US is one).
  The cheapest moment to rename is now, before a logo, icon and press kit carry the name.

| | Keep Recto | Rename (Kerf, or Bifolio second; re-run §1.2 first) |
|---|---|---|
| ADR | Amend ADR-0015 with the namesakes and the search results | New ADR superseding ADR-0015 |
| Copy | "Recto PDF" wherever a search or preview reads metadata: `og:site_name`, repository and manifest descriptions, the README's first line, the About `<title>` "About Recto PDF", the social card (BR-N2) | Presentation spec §7 rename pass again, including the `/Producer` string in `packages/engine/src/pdflib/metadata.ts` |
| Address | No change | Repository renamed; same origin, so local data survives; a `/recto/` redirect folder with a kill-switch worker in the portfolio repository (ADR-0016 decision 6); installed copies are reinstalled. A domain, if wanted, comes in the same step |
| Mark | Develop 03 + 05 (§3) | Drop 03 and 05; develop 02 (or 04) |
| Cost | A few lines of copy | About 1.5 days in-house (presentation spec WP9, WP10) |

**This is not legal advice.** The searches show what is on record, not whether a mark can be
used or registered. Registering RECTO ourselves is a separate, optional spend.

## 2. Brand principles (BR-B1 to BR-B6)

1. **The page is the brightest thing.** The mark appears in four places, never near a document.
2. **Lime is light beneath glass.** Emitted light: the aurora, the mark's lit edge, one button.
3. **Proof before promise.** Privacy is the main claim; every claim links to its evidence.
4. **Bookish precision, used sparingly.** Leaf, spread, ct ligature, 1:√2; nothing faux-antique.
5. **One system.** Every surface shares the M9 tokens, type, radii and motion; no second language.
6. **Works at 16 px, in one colour, in grey.** Or it fails in tabs, iOS tinted mode and print.

## 3. The mark

### 3.1 The five directions

Each board shows the tile, the one-colour glyph on a 24-unit grid, 64/32/16 px and a lockup.

**01 Turn.** A 1:√2 page whose lower-right corner folds back; the flap is lime. The most legible
at 16 px (crisp share 0.62), but it is the generic file icon with the fold where sticky notes
curl, and in grey the flap merges with the page. Drop it.

**02 Spread.** An open book from above: left leaf (verso) in outline, right leaf (recto) filled.
It tells the name's story, survives grey and survives a rename. The open-book family is crowded,
and Apple Books sits on the same Home Screen. The backup.

**03 Leaf r.** A lowercase r whose arm is a leaf lifting from the stem, light in the slit. A true
monogram that shares its r with the wordmark and holds at 16 px, but it depends on the name. The
sketched slit (1.07 px at 16 px) vanishes in grey, so the final needs a dark gap of ≥ 2 units and
optical centring 0.5–1 unit right of centre. Develop it.

**04 Pane.** A 1:√2 pane of glass; a horizontal ribbon of lime light shifts upward behind it. The
design language in one picture, independent of the name. In one colour it reads as a jar or a
battery, and it is the least crisp at 16 px (0.36). A diagonal ribbon read as a "prohibited"
slash, so the light stays horizontal. A motif, not the mark.

**05 ct wordmark.** Lowercase "recto" with the c–t ligature arc of early printed books, sketched
on Inter Bold and Noto Serif Bold (OFL, bundled). Ownable, rooted in book history, pairs with any
symbol. The sketched arc is crude; drawing it well is type work. Below about 24 px cap height the
arc clutters, so small sizes take the plain wordmark. Develop it with 03.

### 3.2 Recommendation (research 21 §5.3)

- **Leaf r + ct wordmark as one family (BR-L1):** one r for both; the arc is the signature.
- **Pane as the motif (BR-L2):** a ribbon of lime light behind glass on the About hero, the
  social card and the empty Home. It never becomes the mark.
- **Spread as the rename-proof backup (BR-L3):** developed if Gate 0 ends in a rename, and in
  parallel if Gate 0 is still open when design starts.

### 3.3 What must be true

- **At 16 px:** pixel-fitted 16 and 32 px masters drawn for the size, not scaled from 1024
  (BR-L4). Every stroke and gap is at least one whole pixel on the pixel grid. The silhouette
  alone identifies the mark, in one colour, on light and on dark.
- **In greyscale:** parts that must stay distinct differ by ≥ 1.5:1 in luminance or are ≥ 2 grid
  units apart (BR-I3). Colour separates nothing: lime `#c8fb3d` and the glass white `#e8e9ec`
  have the same luminance (1.00:1).
- **In iOS tinted and clear modes** (derived by the system from the one web-clip image): shape
  carries identity, lime is only a lit edge. Test greyscale and one-hue renders; confirm on iOS 26.
- **Avoid:** text beyond the monogram, hairlines, sharp corners, the generic file icon, an open
  book on a coloured tile, a diagonal slash, anything close to Robinhood's neon on black or Google
  Docs.

### 3.4 How the owner chooses

1. The lead refines 03 + 05 and 02 to §3.3, in-house. `tools/brand/` renders a board per
   direction: 16/32 px in a tab strip (light, dark), 60 px in a Home Screen grid among other
   apps, the 180 px tile, greyscale and tinted versions, the lockup, an About hero still.
2. The owner views the boards at 100 % zoom on a phone and a laptop.
3. Five-second test with three to five people new to the project: show the grid for five
   seconds; ask which icon was the PDF editor and what it looked like; ask for a sketch.
4. Compare with the namesakes' icons and the avoid list; the owner picks a direction and a
   backup, recorded in the decision log at the end.

## 4. Colour and type for the brand

### 4.1 One lime or two

**The question.** Research 21 proposed a brand lime `#e2f73d` (oklch 0.93 0.196 116) with
`#49780d` for text on light. Research 20 set the interactive accent to `#c8fb3d` (oklch 0.921
0.210 124) with lime-800 `#446712`. Two limes 8° apart read as a mistake, not a palette.

**Recommendation: one lime, the accent `#c8fb3d`.** It sits further from the yellow highlighter
(ΔE_OK 0.076 against 0.045) and from warning amber. The owner's lemon is already in the light:
the aurora ends in lemon `#faee40` in its hottest cores (research 17 §6.1). The About button,
the icon's lit element and the app's primary action then match, and `#446712` holds 5.35:1 on
the light canvas where `#49780d` gives 4.3:1. If the owner prefers hue 116 on a side-by-side
board, it replaces 124 everywhere. Two values never ship.

| Role | Token | Value | Use |
|---|---|---|---|
| Lime | `--accent` | `#c8fb3d`; P3 variant under `(color-gamut: p3)` | Mark's lit element, About primary button, icon glow core |
| Lime on light | lime-800 | `#446712` (6.57:1 on white) | Lime-family text or marks on light |
| Ink | n1 | `#08090c` | Icon tile base, social card field, text on lime (16.4:1) |
| Tile top | n3 | `#17191e` | Top of the icon tile gradient |
| Glass white | n12 or a brighter cool white | `#e8e9ec` | The mark on dark |
| Light | aurora ramp | `#1f9996` → `#58da98` → `#bbed26` → `#faee40` | About hero, icon glow, social card |

Research 21's olive ink and warm white move to the graphite neutrals (hue 265): warm light over
cool shadow makes lime read as light. Lime never carries text on light (BR-C1), one lime fill per
view (C-5), and the manifest colours move to the ink tokens with the new icon (BR-C3).

### 4.2 The wordmark

- Lowercase **recto**, started from Inter Display (the `opsz` 32 cut of Inter 4.1, OFL) at
  weight 650–700 with tight tracking, then redrawn: the r takes the leaf arm; the c–t arc is
  drawn into the letters. A **display** version has the arc (from about 24 px cap height); a
  **text** version drops it (About top bar, README head, small lockups).
- Shipped as SVG outlines; no font loads for the logo. The OFL allows logos made from OFL fonts,
  since a logo is artwork, not a font (OFL FAQ; the owner confirms). In running text the name is
  plain "Recto" in the UI face.
- Inter stays the only face in the app. Research 20 T-11's optional Instrument Serif accent on the
  About page: recommended no, until the About v2 design shows a need.

## 5. App icon

### 5.1 Web files

Today the manifest lists two SVGs and `index.html` has no `apple-touch-icon`, so Chrome lacks its
192 and 512 px PNGs and iOS before 26 ignores SVG on the Home Screen. Paths: `apps/web/public/`.

| File | Size | Format | Purpose |
|---|---|---|---|
| `icons/glyph.svg` (kept) | any | SVG, internal `prefers-color-scheme`, ≤ 2 KB | Favicon; manifest `any` |
| `favicon.ico` | 16, 32, 48 | ICO | Legacy and Windows; keeps requests off the portfolio's root `/favicon.ico` |
| `icons/apple-touch-icon.png` | 180 | PNG, opaque, ≤ 20 KB | iPhone Home Screen |
| `icons/apple-touch-icon-167.png`, `-152.png` | 167, 152 | PNG, opaque | iPad Pro, iPad |
| `icons/icon-192.png`, `icon-512.png` | 192, 512 | PNG | Chromium install, Android splash |
| `icons/icon-maskable-192.png`, `-512.png` | 192, 512 | PNG, opaque, mark in the 80 % circle | Android adaptive icon |
| `icons/icon-mono.svg` | any | SVG, one fill | Badges, notifications (`monochrome`) |
| `icons/app-icon.svg` (kept) | any | SVG | Maskable at any size |
| Manifest `screenshots` | 1280×800, 750×1334 | WebP from the media pipeline | Chrome's richer install dialog |

Not shipped: startup images (a launch screen is not branding), Safari `mask-icon`, Windows tiles.

**Can ship now:** the PNG set, `apple-touch-icon` and `favicon.ico` from the current glyph. They
need neither the name nor the mark, and they fix install on Chrome and older iOS. The rest ships
with the new mark.

### 5.2 Native shells, later

Only if the Tauri desktop shell starts. macOS: an Icon Composer `.icon` from the designer's layers
(P3 gradient, glass-white group, lime group with specular), default, dark and mono, tested in six
appearances, plus `.icns` 16–1024 @1x/@2x. Windows: `icon.ico` with 16, 24, 32, 48, 64, 256.
Linux: PNG at 32, 128, 256, 512. Small sizes come from the pixel-fitted masters.

### 5.3 Tile and mark geometry

- **Tile (BR-I1, BR-I4):** opaque, full-bleed, unmasked square. Gradient from n3 at the top to n1
  at the bottom. One aurora glow, about 50 % of the tile in radius at 35–55 % peak opacity,
  behind the mark's lit element. No baked specular, bevel or shadow. Always dark: a web clip
  cannot ship a dark variant, and a lime tile would glare on a dark Home Screen.
- **Mark (BR-I2, BR-I3):** glass white, lime only on its small lit element; ≤ 60 % of the tile;
  optically centred; lowest point ≥ 19 % (195 px of 1024) above the bottom edge; inside the
  maskable 80 % circle; parts ≥ 1.5:1 apart in luminance or ≥ 61 px apart at 1024. The clearance
  rests on one iOS 26 field report; check it on a device.
- **Per-size masters (BR-I5):** 180, 167, 152, 120, 64, 32 and 16 px from size-specific SVGs.

### 5.4 The pipeline: `tools/brand/` (BR-I6)

- SVG masters in `docs/brand/masters/` (glyph-16, glyph-32, glyph, tile, mono, wordmark). A
  Playwright script beside `tools/media/` renders every file in §5.1 and the review boards of
  §3.4, compresses PNGs with `oxipng`, packs `favicon.ico`, writes `budgets.json`, and writes the
  path in `apps/web/src/shell/AppGlyph.tsx` (kept in sync with `public/icons/` by hand today).
- `check` fails on wrong dimensions, transparent corners where opaque is required, a mark over
  60 % of the tile, under 19 % clearance or outside the 80 % circle, parts that merge in a
  greyscale render, and files over budget. CI runs it; a designer's files pass the same check.

## 6. In-app brand moments

| Place | What appears | Size |
|---|---|---|
| Browser tab | `glyph.svg` | 16, 32 px |
| Title bar | The glyph as the Home button, `currentColor` | 16 px |
| Empty Home | The glyph; it may catch the aurora's light (BR-M6: decorative, unfocusable, still under reduced motion) | 24 px |
| About dialog | Mark and text wordmark | 20 px |
| Installed app | The app icon | OS sizes |
| Exported PDF | The name as text in `/Producer`, nothing visible | — |

**Never:** on or near the page; as a watermark or stamp in an export; in tool bars, menus,
toasts, errors, the status bar, loading states, the drop overlay, Arrange or Compare; in dialogs
other than About; as a splash screen (BR-M1). No "Made with Recto" anywhere. No animated favicon.

**Motion branding.** One logo reveal, on the About hero only, once per session (BR-M2). For 03
the leaf lifts 6° and light rises in the slit: 700 ms, on the design language's spring if it
settles in time, else `cubic-bezier(0.16, 1, 0.3, 1)`; CSS or SVG, no animation runtime.
`sessionStorage` (in try/catch) remembers it played; reduced motion shows the final frame. The
app has no reveal: the aurora's arrival on Home belongs to the design language.

## 7. Voice and tone

The voice does not change with the look. A rich-looking page with plain sentences reads as
expensive; with hype it reads as a template (BR-V2).

1. Keep presentation spec §1.2: mechanism words, evidence one click away, a limit beside each
   capability, numbers with their scope, dated comparisons, plain status, short active sentences.
2. Use the app's nouns (light table, Read, Edit, Arrange, Intact, recipe); a signature is never
   "valid", "verified" or "trusted" (BR-V4). In the app: verbs on buttons, no "we" (X-7).
3. Turkish keeps *siz*, is written fresh, and uses "PDF düzenleyici" as descriptor (BR-V3).
4. Score public copy 1–5 on technical grounding, natural syntax, quiet confidence and respect for
   the reader; publish at 4 or above on all four.

**Banned list.** Already banned (§1.3): powerful, blazing, lightning, seamless, effortless,
simply, just, magic, best-in-class, enterprise-grade, military-grade, secure (alone),
revolutionary, the only, "we're excited", exclamation marks, emoji. Add:

- **BR-V1:** robust, frictionless, leverage, unlock, supercharge, next-generation, cutting-edge,
  game-changing, groundbreaking, innovative, intuitive, elegant, world-class, state-of-the-art.
- **Invited by "expensive":** premium, luxury, luxurious, sleek, stunning, beautiful, gorgeous,
  delightful, smart (of the product), AI-powered, bank-grade.
- **Phrases:** "100% private", "completely secure", "your privacy matters to us", "trusted by".
- **Structures:** chains of em dashes; "It's not X, it's Y"; three-word slogans ("Fast. Private.
  Free."); questions as headlines.
- **Turkish:** güçlü, sorunsuz, zahmetsiz, sihirli, devrim niteliğinde, yenilikçi, sezgisel,
  kusursuz, son teknoloji, akıllı, en iyi, "gizliliğiniz bizim için önemli".

`tools/copy-check/check.ts` gains these lists, a Turkish pass for `/about/tr/` and the press kit
page. The portfolio repository runs the same check on the case study. Example: not "The most
private PDF editor" but "Your files never leave this tab; check the CSP line."

## 8. The About page at /recto/about/

GitHub Pages serves it at `/recto/about/` and redirects `/recto/about` there. It stays a sibling
of the app (ADR-0016 decision 4). Glass is honest here because the aurora is behind it.

1. **Top bar.** Glass, sticky, 56 px: mark and text wordmark; Features · Privacy · Open source ·
   EN/TR; "Open Recto" in lime with an ink label, the page's one lime element.
2. **Hero: the product and the aurora.** H1 thesis at display size, one line of jobs, "Open
   Recto" and "Try it with a demo PDF" (the app must open a same-origin demo file from a URL
   parameter; a flows-track dependency). Visual: a 6–8 s loop of the M9 UI on the aurora, with the
   logo reveal. Shader at 1/4 size, intensity 0.8, lobes behind the clip, not the H1; text on the
   dark part or lit glass, light under bare-canvas text below luminance 0.026 (research 17, 22).
3. **Proof strip.** "No account · Nothing is uploaded · Works offline · Apache-2.0", each a link
   to its evidence.
4. **Privacy you can check.** Today's three facts and "Check it yourself" as glass cards, with
   the request log, the CSP line and the offline test.
5. **The flow in three beats.** Open → Read → Mark up or Arrange, three short clips.
6. **Features shown, not told.** Arrange, Write and sign, Fill forms, Redact, Edit text,
   Recognise and compare: a claim, a clip, one "does not do" line each; limits in a disclosure.
7. **On every screen.** Real captures at 1440 × 900 and 390 × 844 (phone after M10), no fake
   device frames; how to install on desktop, Android and iOS.
8. **How it works, open source, credits.** The architecture diagram; Apache-2.0, NOTICE, engines,
   fonts, the designer if hired, "Built by Eren Deniz K." linking to the case study. Footer:
   version, release notes, roadmap, press kit, licence, trademark policy.

| Budget (`apps/web/e2e/about.spec.ts`) | Today | Version 2 |
|---|---|---|
| Transferred without video | ≤ 300 KB | ≤ 300 KB, with fonts, posters and the shader |
| Script, decoded | ≤ 4 KB | ≤ 12 KB: reduced motion, shader (about 3 KB gzip), reveal, pause control |
| Requests without video | not set | ≤ 10 before the first scroll, ≤ 25 in total |
| Other origins | 0 | 0; the app's CSP, character for character |
| Each clip | ≤ 1.5 MB, `preload="none"`, poster | Unchanged; reduced motion shows posters only |
| Aurora light | — | Mean luminance ≤ 0.06; area above L 0.65 ≤ 4 % (AU-7) |
| Motion | Clips loop | Aurora settles within 5 s or shows a pause control (WCAG 2.2.2); stops off-screen |
| Layout shift | — | None: every media box has width and height |

**Until the M9 UI is built** the page keeps its structure, copy, dark-only scheme, M8 clips and
social card; restyling it twice is waste. Allowed before then: the icon fixes (§5.1), the
copy-check lists, and the "About Recto PDF" title if Gate 0 keeps the name.

## 9. The portfolio case study

**Where.** `erendenizk.github.io/work/recto/` in the `ErenDenizK.github.io` repository; `/recto/`
belongs to the project site, and the portfolio root never registers a service worker (ADR-0016).
The README stays the source text; the case study copies its sentences (BR-P1).

1. **Title, outcome line, meta strip:** role (design and engineering), timeline (first commit
   2026-09-26; 183 commits by 2026-10-04), stack, links to app, repository and About page.
2. **Problem:** hosted tools upload files; open-source kits are grids of single-purpose tools.
3. **Principles:** local first, correctness over feature count, one workspace, the M9 language.
4. **Process:** research → spike → ADR → spec → build → audit, as a dated M0–M10 timeline with
   linked counts (21 ADRs, 22 research reports, 8 specs on 2026-10-04).
5. **Decisions, five to seven cards** (context, options, decision, consequence, link): ADR-0002
   engine stack, ADR-0005 document model, ADR-0019 modes, ADR-0020 paragraph editing, ADR-0021
   highlighter and lasso, the M9 design-language ADR, ADR-0015 and the Gate 0 outcome.
6. **Craft details:** ink latency (`docs/qa/ink-latency-baseline.md`), redaction checked on the
   exported bytes, glass contrast against the white page; a short clip each.
7. **Before and after:** M0 (`docs/design/screenshots/m0-*`), M6
   (`docs/design/audit-2026-10/m6-v1-*`), M8 (`docs/design/redesign-2026-10/baseline/`, 71 frames
   at 1440/1280/820/390 px, commit `7d47031`) and M9: same fixture, viewport and state, captured by
   script, old states re-rendered at 2× from their commits (BR-P2). A drag slider; side-by-side
   stills under reduced motion.
8. **Metrics, measured honestly:** 30 end-to-end specs; CI on Chromium, Firefox and WebKit; zero
   requests to other origins in the media log; bundle and precache sizes; INP and frame times on a
   named machine. No usage numbers: Recto has no analytics by design, and the page says so.
9. **Next:** M10 tablet and phone, the desktop shell, the known limits.
10. **Credits and tooling:** who did what, with which tools, stated plainly; the owner's wording.

Version 1 ships after the M9 UI is built, with desktop captures: M8 → M9 is the strongest story.
Version 2 adds phone captures and Turkish after M10. (Research 21 put it all after M10.)

**Press kit (BR-K1)** at `/recto/about/press/` and as `recto-press-vX.Y.Z.zip` on each release:
a fact sheet (name, descriptor, 1-line, 50- and 150-word descriptions in EN and TR, licence, URL,
version, status, maker, contact); mark, wordmark and lockups as SVG and PNG on dark, light and one
colour; icon PNGs at 1024, 512, 180; six to ten screenshots (1440 × 900 @2x, 390 × 844 @3x, dark
and light); three MP4 clips; colours in OKLCH, hex and P3; font credits; usage rules (clear space
equal to the r's x-height; minimum 16 px mark, 64 px wide wordmark; don'ts).

**Social preview (BR-K3, BR-A1).** Ink field, the Pane ribbon of light, mark, wordmark, a
two-line thesis, the M9 UI bleeding off the right. One template renders 1280 × 640 (GitHub) and
1200 × 630 (`og:image`), 1080 × 560 safe area, text ≥ 48 px; it replaces spec §4's "no gradient".

**Brand licence (BR-K2).** Apache-2.0 §6 grants no trademark rights. `TRADEMARKS.md` allows the
name and logo to refer to Recto, forbids implied endorsement, asks forks that ship builds to
rename; NOTICE and the README exclude `docs/brand/` and the icons. Not legal advice.

## 10. Outside help

**Commission:** (1) the final mark, wordmark and app icon from an app-icon specialist; (2)
optionally a type designer for the ct arc, drawn as logo artwork, not a font feature. Colour
tokens, pipeline, voice, About page, press kit and case study stay in-house.

**The brief.**

- **Project.** Logo and app icon for Recto, a free, open-source (Apache-2.0) PDF editor that runs
  in the browser and never uploads a file; one maker; redesigned in glass, lime light, graphite.
- **Deliverables.** The mark on a 24-unit grid with a 1024 master and fitted 16/32 px masters;
  the wordmark "recto" in display and text versions; horizontal and stacked lockups with clear
  space and minimum sizes; the flat 1024 web icon (§5.3) and Icon Composer layers with default,
  dark and mono annotations and renders in all six iOS appearances; the favicon SVG (≤ 2 KB,
  internal dark-mode query); a colour spec from §4.1; a reveal storyboard (≤ 900 ms) and its
  reduced-motion frame as SVG with named layers and timings; a short usage guide (web and PDF).
- **Formats.** SVG with outlined paths, no fonts or embedded rasters; vector PDF; PNG.
- **Constraints.** §3.3 and §5.3. Inter stays the UI face. No stock elements; any font used is
  OFL or licensed for logos.
- **Licence and rights.** The owner holds copyright by written assignment. Brand files sit outside
  Apache-2.0 under `TRADEMARKS.md`. The designer is credited in NOTICE and on the About page if
  they wish, and may show the work after launch. Sources are committed to `docs/brand/`.
- **We provide.** Research 21, this plan, the concept boards, M9 UI captures, `tokens.css`, the
  design-language documents, the bundled OFL fonts, the namesake findings, the `tools/brand/` check.
- **Rounds.** Kick-off; two weeks to three directions (one may build on 03/05); one week to refine
  one; one week for production files. Two revision rounds per phase, a fixed quote per phase.
  Accepted when every file passes the check and the owner signs off the review boards.

**Low-cost routes.** Brief "refine 03/05", not open exploration. Split the work: mark, wordmark
and small masters now, native layers only with the desktop shell. Buy one or two paid hours of
critique on the in-house refinement instead of a commission. Post where open-source projects find
designers (for example the Open Source Design jobs board; check its current state). Avoid logo
contests and unpaid spec work, stock marks (not ownable) and image generators (rights unsettled).

## 11. Sequencing against M9

Brand work follows the design language and the M9 UI: a logo made before Gate 0 may carry a name
that changes, and media made before the UI exists get redone.

| Phase | When | Work | Who | Spend |
|---|---|---|---|---|
| 0 | Now | Gate 0 and the decision; PNG icons, `apple-touch-icon` and `favicon.ico` from the current glyph (§5.1); copy-check lists (§7) | Owner, lead | None |
| 1 | After the design-language ADR | One lime and brand tokens with the colour track; `tools/brand/`; refine 03 + 05 and 02; review boards; owner chooses (§3.4) | Lead, owner | None |
| 2 | After Gate 0, with a budget | The brief (§10), about four weeks, beside the M9 build | Designer | Yes |
| 3 | After the M9 UI is frozen | Final icons and manifest colours; media scenes; About v2; social card; README hero; press kit; `TRADEMARKS.md`; reveal; case study v1 | Lead | None |
| 4 | After M10 | Phone captures; Turkish About page; case study v2 | Lead | None |
| 5 | If the desktop shell starts | Native icon set (§5.2) | Lead | Maybe |

**Owner decisions, in priority order.**

1. **Gate 0:** run §1.2; keep Recto or rename (Kerf or another cleared name). Blocks all spend.
2. **Outside help:** is there a budget; icon specialist only, or a type designer too?
3. **One lime or two:** recommended one, `#c8fb3d`, with the colour track (§4.1).
4. **The mark:** Leaf r + ct wordmark (recommended), Pane as motif, Spread as backup (§3.4).
5. **Custom domain before the brand launch?** A later move needs a second rename (ADR-0016).
6. **About hero motion:** aurora that settles within 5 s (recommended), live drift with a pause
   control, or a still poster.
7. **Brand licence:** approve `TRADEMARKS.md` and brand files outside Apache-2.0.
8. **Case study:** English only or English and Turkish; how authorship and tools are described.
9. **Launch timing:** a launch post or mention the press kit and social card should be ready for.
10. **Serif accent on the About page:** recommended no for now (§4.2).

**Decision log.** Empty. One line per owner decision: date, decision, link.
