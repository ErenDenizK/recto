# Recto in the family

**Status:** proposal, 2026-10-09. Nothing here is binding until the owner accepts it, and
nothing here changes the product. **Rests on:** the maker's family vision ("Kept light",
portfolio repo `docs/design/family.md`), the family audit (`docs/research/2026-10-family-audit.md`
there) and the portfolio brief §7, 2026-10-09 (late), which says each app keeps its own fonts,
the family kit comes first, light is the shared origin, `edk.` appears in apps only at exits,
and Recto's recorded grain ban is a misrecording (§6 below). **Files:** `world.json` (Recto's
world for the portfolio's embassy, valid against `kit/world.schema.json`; §3), `tokens.json`
(the rest of Recto's tokens the schema has no place for), `SESSION-PROMPT.md` (the prompt for
the owner's Recto session), `kit/` (the shared family kit; §7), and the capture tool in
`tools/media/family/` (§5).

The family vision says it in one line: the products come from the same place, but each is
original in its own way. The portfolio adapts first; the apps only ever opt in, one move at a
time, each with the owner's yes. This document is Recto's side of that: what Recto already is,
what it never gives up, and the few small moves it could make.

## 1. Recto's DNA, from its own tokens

Every value below is read from the repo, not from the audit; `world.json` holds them as data.

| Facet | Recto | Source |
|---|---|---|
| Ground | Cool graphite, OKLCH hue 265: canvas n1 `#08090c`, frame n3 `#17191e`, raised n4 `#1f2227`; light theme equal from day one (canvas `#e6e8eb`) | `styles/tokens.css` §1, §2 |
| Ink | n12 `#e8e9ec`, n10 `#a1a5ab`, n9 `#91949a`; on glass, secondary steps up to n11 `#bbbec3` | `tokens.css` `--text-*` |
| Accent | One lime `#c8fb3d` (oklch 0.921 0.210 124), ink `#08090c` on it at 16.42:1; the armed tool and the one primary action of a view, the focus ring's light band; never on the page | `tokens.css` `--lime-300`, `--accent*`; ADR-0023 |
| Content | The page is white `#ffffff`, never themed, the brightest thing on screen; selection blue `#4e61ed` | `--page-background`, `--select` |
| Light | The aurora: teal `#1f9996` → mint `#58da98` → lime `#bbed26` → lemon `#faee40`, an in-house WebGL field with ±0.5 LSB dither. Still at rest, answers events, settles within 5 s, never within 64 px of a page. The Library's aura is its static CSS twin in the mark's colours | `--aurora-*`, `--aura-*`; ADR-0025 |
| Glass | One glass, five densities: M1 chip `/.50`, M2 bar `/.55`, M3 panel `/.74`, M4 menu `/.78`, M5 sheet `/.86`, each with its `saturate()·brightness()`; σ per surface from the coverage registry; no glass in glass; every tier has a solid twin | `--glass-*`, `materials.css`; ADR-0024 |
| Type | `'Inter Recto'` (Inter 4.1 subset), 400/500/600, 11 to 40 px (56 on About), sentence case, `tnum` on changing numbers | `--font-ui`, `--type-*`; ADR-0027 |
| Shape | Radii 2 · 4 · 6 · 10 · 999; every bar, chip and text button a capsule | `--radius-*` |
| Motion | Seven springs from one function (mass 1): press, quick, smooth, glide, fling, pop, track; zero bounce except fling (0.15) and pop (0.25, one glyph); press scale .97 mouse / .94 touch; View Transitions 240 ms; idle frames = 0 | `styles/motion.css`, `motion/springs.ts`; ADR-0026 |
| Signature | The capsule morph: one glass pill changes its own width and height between dock, Markup palette, Pages bar, Compare and Locked, radius 999 throughout | `shell/capsule/`; quality bar Q-6 |
| Mark | The owner's "Dengeli" R; gradient mint `#69EAA3` → lime `#CBFF5F` @ 59 % → yellow lime `#EDFA6D` at 46.75°; mono `#0B0C0E`; wordmark lowercase "recto" | `docs/brand/README.md` |
| Promise | "Nothing leaves this device." (Library); Turkish "Hiçbir şey bu cihazdan çıkmaz." | `messages/*.json` `library_line` |

Two limes, two jobs: `#c8fb3d` is the action (it touches ink), `#bbed26` is the aurora's light.
A family page that shows "Open Recto" uses `#c8fb3d` with an `#08090c` label, never `#bbed26`.

## 2. Untouchables

From the family vision §2.3, checked against the repo. A family idea that touches one of these
loses.

- One lime `#c8fb3d`, always touching ink, one fill per view, never on the page.
- The white page as the brightest thing.
- The morphing glass capsule (dock ⇄ palette ⇄ pages ⇄ compare ⇄ locked).
- Glass M1–M5 and its rules: no glass in glass, at most four glass surfaces at rest.
- The aurora as event light, still at rest.
- Zero-bounce surfaces; idle frames = 0.
- The "Dengeli" R, its gradient and its usage rules (no effects on the mark; the owner designed it).
- Inter Recto, sentence case, Phosphor outline → fill.
- The accessibility gates A-1…A-24 and every effect's solid twin.

The family vision also lists "no grain, no noise, no raster texture (Q-1)" here. The owner has
since said that record is wrong in intent; see §6. Until the owner decides, Q-1 stays as it is.

## 3. `world.json` and `tokens.json`

`world.json` is Recto's entry for the portfolio's embassy (family vision §3.1: a project view
that enters the app's own world inside the portfolio's frame), in the kit's format
(`kit/presentation.md` §2) and valid against `kit/world.schema.json`. It copies ground, ink, the
accent and its job sentence (`accent.color` `#c8fb3d`, with `accent.light` `#bbed26` for the
aurora's lime), the light field (event behaviour, the four aurora colours, settle 5 s), Inter
Recto, the four family spring roles read from Recto's tokens, the promise line with its
evidence, and the captures, with `source.commit` naming the commit they come from. One value is
marked estimated: `light.cap`, the kit's 0.42 ceiling, since Recto's aurora has its own intensity
model (`light.note` says so).

The schema has no place for glass, so `tokens.json` carries what the embassy may want next: the
five glass densities and the lit tier with their filters, rims and depth, all seven springs
with k and c, shape, the mark's gradient and rules, and the voice. Both files are data the
portfolio reads; nothing in Recto reads them. When a token changes in `tokens.css` or
`motion.css`, the same change goes into both, and `world.json`'s `source.commit` moves.

To check `world.json` against the schema (no dependency added; any JSON Schema 2020-12
validator works), for example:

```sh
python3 -c "import json,jsonschema; jsonschema.Draft202012Validator(json.load(open('docs/family/kit/world.schema.json'))).validate(json.load(open('docs/family/world.json')))"
```

## 4. Candidate moves, smallest first

Each needs the owner's OK, each is one change, and none touches §2. Ranked by size, then value.

1. **`world.json` and captures (done here, documentation only).** The portfolio's embassy
   copies tokens and shows real screens instead of mock UI. No product change.
2. **The family grammar for the springs, as a mapping only.** The family names four springs:
   press, settle, glide, pop (F1). Recto's seven already cover them: press → `press`, settle →
   `smooth`, glide → `glide`, pop → `pop` (one small glyph, never a surface); `quick`, `fling`
   and `track` stay Recto's own. A table in `motion/springs.ts`'s doc comment or in
   `language.md` §7 would record it. No value, name or curve changes.
3. **A credits line on About, in Recto's style.** The About footer already links "Credits" to
   `NOTICE`. The move: one line at the foot, set in Inter Recto at footnote size, ink n10, with
   `edk.` whose dot is the lime `#c8fb3d` (the family's maker's dot at an exit point, V3). Only
   on About, never in the working UI.
4. **About itself is behind.** `/recto/about/` is still the pre-M9 page (the audit's C10): it
   opens with "A PDF editor that runs entirely in your browser. Nothing is uploaded." and the
   old presentation, while the app now says "Nothing leaves this device." About v2 waits on
   the owner's brand kit (drop D4). When it comes, the credits line of move 3 is its last
   line. This is the largest move and the owner's to schedule.
5. **Social card and press kit in the family format** (1200 × 630 on the product's ground, the
   R left, `edk.` small bottom right), made by the existing `tools/media` pipeline
   (`lib/social.ts`). Only after move 4, so the press kit shows the new About.

Not proposed: a dot on the "recto" wordmark (the owner, as the mark's designer, decides), any
change to the lime, the capsule, the springs' values or the aurora's behaviour.

## 5. Captures

`tools/media/family/` shoots the kit's screens and signature clip (`kit/presentation.md` §3–§5)
from the production build with the teaching sample, the way the media scenes do (Glass Clear
through the test-only render override, a fixed clock, English):

```sh
pnpm --filter @pdf-editor/media-tool family                        # builds the app first
FAMILY_SKIP_BUILD=1 pnpm --filter @pdf-editor/media-tool family    # reuses a RECTO_RENDER_OVERRIDE=1 build
```

| Output (`tools/media/out/family/`, gitignored) | What |
|---|---|
| `recto-library-<size>@2x.png` | The Library on first visit: the welcome card on the aura |
| `recto-document-<size>@2x.png` | The sample open, the dock at rest |
| `recto-markup-palette-<size>@2x.png` | The dock become the Markup palette |
| `recto-capsule-morph-<size>@2x.png` | The morph dock → palette held at half its duration |
| `recto-light-table-<size>@2x.png` | The sample's four pages, the capsule as the Pages bar |
| `recto-signature-1440x900@2x-poster.png`, `.av1.mp4`, `.hevc.mp4`, `.h264.mp4`, `.webm` | The capsule morph, dock → Markup palette → dock → Pages bar → dock, starting and ending on the dock at rest |

Sizes: 1440 × 900 and 1180 × 820 (touch, coarse pointer), both at device scale 2, as lossless
PNG masters (the portfolio derives AVIF and WebP). Every still waits until no animation runs;
the one exception is the morph still, paused the way `e2e/capsule.spec.ts` reads the morph.

The clip is made from frames, as the kit asks: every animation runs at a twentieth of its speed
(CDP `Animation.setPlaybackRate`), the pointer and the holds are slowed to match, full 2x
screenshots are stamped with their time, and ffmpeg plays them back at the real rate at 60 fps
(AV1 10-bit, HEVC Main 10 `hvc1`, H.264, BT.709; a VP9 WebM besides). Work that is not an
animation (rendering the grid's thumbnails) is not slowed, so in the clip it looks a twentieth as
long as it took; nothing on screen is faked. On this runner (no GPU) a 2x frame takes about
340 ms, so the 7.8 s clip has 245 captured frames (about 32 per second) resampled to 60 fps;
a faster machine gives more. The clip ends on the dock as it starts, but returning from the
light table leaves the page about 30 px lower than at the start, so a loop shows a small jump. The phone capture of the compact edition, which the
kit lists for Recto, is not made yet (desktop and tablet come first).

## 6. Correction to verify with the owner

**What the owner said (portfolio brief §7, 2026-10-09, late):** "Recto's 'grain ban' is a
misrecording: the owner had asked to fix the glass object's wrong render and its banding, not
to ban grain."

**What the repo records.** On 2026-10-04 the owner reviewed the concept prototype and said,
in translation, that it had "glass surfaces that break and look grainy". The lead's diagnosis
was right about the cause: the prototype's sheets carried a 128 px noise tile made at 1× and
scaled up on HiDPI screens, so it read as dirt (`quality-bar.md:24`). The record then went one
step further than the request and turned "this grain renders wrong" into "no grain, ever"
(Q-1). The owner's clarification is that the complaint was about a wrong render (and banding),
not about grain as such.

The rule that carries the ban is **quality bar Q-1, `docs/design/redesign-2026-10/quality-bar.md:33`**
(the family kit names it too). **Every place that records the ban** (found by searching docs, specs, quality gates and
source for grain, noise, raster texture, dither and Q-1):

| File:line | What it says |
|---|---|
| `docs/design/redesign-2026-10/quality-bar.md:4` | Header: "Amends `language.md` §2.3 (grain removed)" |
| `docs/design/redesign-2026-10/quality-bar.md:11` | The owner's quote: "glass surfaces that break and look grainy" (the source of the record; correct as a quote) |
| `docs/design/redesign-2026-10/quality-bar.md:24` | Diagnosis row "Glass looks grainy" → rule Q-1 |
| `docs/design/redesign-2026-10/quality-bar.md:33-38` | **Q-1 "No grain, no noise, no raster texture on any surface."**; G-7 removed; the aurora's ±0.5 LSB dither "the only dither in Recto"; the test |
| `docs/design/redesign-2026-10/language.md:384-385` | "No tier carries grain or noise (G-7 removed 2026-10-04, `quality-bar.md` Q-1), and never a live `feTurbulence`" |
| `docs/adr/0024-glass-materials-and-setting.md:63-64` | "no grain on any tier (G-7 removed by `quality-bar.md` Q-1, 2026-10-04: the owner found the prototype's grain made glass look dirty)" |
| `docs/specs/redesign.md:56` | Quality bar summary: "Q-1 to Q-14: no grain; …" |
| `docs/specs/redesign.md:808` | Work package D0-1: "the quality-bar walker … (Q-1 …: no grain or raster texture …)" |
| `docs/specs/redesign.md:974` | Taste: "grainy and breaking glass … must not reach the product" |
| `docs/adr/0033-compact-edition.md:93` | The compact edition "held to the same quality bar … no grain" |
| `docs/DISCUSSION.md:52` | Row 34, the owner's acceptance: "glass that breaks and looks grainy" (a record of the quote) |
| `apps/web/src/styles/materials.test.ts:8-12` | Doc comment: "Q-1, no grain … the aurora's in-shader dither, AU-3, is the one dither Recto has" |
| `apps/web/src/styles/materials.test.ts:73` | **The CI gate:** `describe('materials: no grain or raster texture (quality-bar Q-1)')`, failing on raster backgrounds on `.mat*` rules and their pseudo-elements, and on `feTurbulence` in `src/` |
| `apps/web/src/home/LibraryView.tsx:75` | The aura: "no blur and no grain (Q-1)" |
| `apps/web/src/home/LibraryView.module.css:106` | The aura: "no grain, no blur filter … (Q-1, Q-10 …)" |

Related history, not a ban: `docs/research/16-glass-at-the-limit.md:263` and `:825` (G-7, the
original 2.5 % grain tile recommended against banding), `docs/research/17-aurora-and-light.md:211-222`
and `:511` (AU-3: "a static 3 % grain layer only where the owner sees banding"),
`docs/specs/redesign.md:724` (OM4, aurora banding to check on the owner's display),
`docs/ROADMAP.md:467` (the same check). Several files cite "Q-1, Q-3" for solid twins and
backdrop seams (`TitleMenu.module.css:10`, `PagePill.module.css:62`, `grid-transition.ts:16`,
`glass-rest.spec.ts:101`, `glass-pixels.spec.ts:14`): those are about glass that breaks, which
the owner did want fixed, not about grain.

**What this means, for the owner's session to decide.** Nothing above has been edited. The
two problems the owner named are still real and still covered: the wrong render (Q-2 to Q-6,
the glass pixel tests) and banding (AU-3's dither, the OM4 check). What may change is only the
wording and the gate that forbid grain outright. Options, for the owner:

- **A. Reword, keep the gate.** Q-1 becomes "no texture that renders wrong: nothing scaled
  past its native resolution, nothing that reads as dirt", with the history corrected; the
  test stays, since Recto has no grain today and nobody asked for one.
- **B. Reword and open the door.** As A, and a grain or dither layer becomes allowed where it
  is made at device resolution and measured to fix banding (research 17 §5's 3 % layer on the
  aurora, AU-3), behind the same pixel tests.
- **C. Leave Q-1 as it is** and record the owner's clarification beside it, if the owner
  prefers Recto smooth anyway.

Whatever the choice, the quote at `quality-bar.md:11` and `DISCUSSION.md:52` stays: it is what
the owner said. The correction belongs in a note beside the rule and an amendment to
ADR-0024, made in the owner's session.

## 7. The family kit

`kit/` is a copy of the shared kit as merged into the portfolio's `dev` on 2026-10-09
(portfolio repo `docs/family-kit/`): the README, the charter, `light.md` / `light.js` /
`light.css`, `motion.md` / `springs.js` / `springs.swift`, the `edk.` mark, `presentation.md`,
`world.schema.json` and `PROMPT-TEMPLATE.md`. The portfolio's copy is the source; when it
changes, copy it again rather than editing this one (Biome and ESLint skip `docs/family/kit/`,
so the copy stays byte for byte the portfolio's). Two of its files already speak about Recto:
`motion.md` §3.1 maps Recto's springs exactly as §4 move 2 does, and the kit's README lists
Recto's untouchable as "clean glass renders without banding" in place of the family vision's
"no grain" (the kit, too, names Q-1 as the rule to correct; §6). Recto's own decisions stay in
this repo's ADRs; the kit never overrides them, and where they disagree the kit is wrong.
