# Spec: Redesign (M9): one interaction model and the Recto Glass language

**Status:** approved by the owner 2026-10-04, with one change of scope (phones get a read-only
compact edition, ADR-0033; §14) · **Milestone:** M9 (five drops, D0–D4, each a working app;
nothing is tagged until the owner says "beta v1") ·
**Owner:** project lead

**Inputs:** the owner's brief of 2026-10-04 (in translation; §1.1); research 15–22
(`docs/research/15-reference-apps.md` to `22-accessible-expressive-ui.md`); the visual baseline
and today's flows ([`baseline/README.md`](../design/redesign-2026-10/baseline/README.md),
[`inventory.md`](../design/redesign-2026-10/inventory.md),
[`current-flows.md`](../design/redesign-2026-10/current-flows.md)); proposals A, B and C
([`proposals/`](../design/redesign-2026-10/proposals/A-markup-toggle.md)) and the three judges'
verdicts summarised in `flows.md`'s header; the chosen model
[`flows.md`](../design/redesign-2026-10/flows.md); the language
[`language.md`](../design/redesign-2026-10/language.md); the nine component specs
[`components/01-frame.md`](../design/redesign-2026-10/components/01-frame.md) to
[`09-primitives.md`](../design/redesign-2026-10/components/09-primitives.md) and
[`10-ink.md`](../design/redesign-2026-10/components/10-ink.md); the quality bar
[`quality-bar.md`](../design/redesign-2026-10/quality-bar.md); ADR-0022 to ADR-0033 (accepted
2026-10-04); the brand plan [`docs/brand/README.md`](../brand/README.md); the issues
the nine component authors and the ADR author raised for the lead (§6); `docs/DESIGN.md`;
[`craft.md`](craft.md) (M8) and [`experience-redesign.md`](experience-redesign.md) (M6).

M8 made every feature work; the owner's verdict was that nothing feels native yet, and the
brief of 2026-10-04 asks for the whole interface to be rethought. This spec is the build plan:
a page-first app with no Read · Edit · Arrange control, one Markup state, a Lock that holds,
a shell for phones and desktops, saving that never loses work, and the Recto Glass language
(content solid, controls glass, lime light beneath). It cites the source documents and does
not repeat them; where it departs from them, §6 says so. Paths are under `apps/web/src/`
unless they start with a top-level directory. The former M10 "Tablet and phone" is folded in
here (phones narrowed to a read-only compact edition, with their real interface in M10, by
ADR-0033); the former M9 "Ecosystem" becomes M11.

## 0. Decisions this spec builds on

| Topic | Decision | Where decided |
|---|---|---|
| Design language | Three layers: content solid, controls glass, light beneath; eight principles; "only light glows"; a light theme from day one | ADR-0022; `language.md` §0, §0.1 |
| Colour | One lime `#c8fb3d` for interaction, focus and brand; selection blue `#4e61ed` on the page; graphite neutrals | ADR-0023; `language.md` §1 |
| Materials | M1 chip to M5 sheet plus lit glass; coverage c ≥ 0.985 per surface; Glass Clear · Tinted · Solid; cost ladder | ADR-0024; `language.md` §2 (lens amended in §6, X20) |
| Light | In-house WebGL aurora, still by default, moves on events; Ambient light Auto · Still · Off | ADR-0025; `language.md` §3 |
| Motion | Seven springs, four eases, `linear()` curves, View Transitions ≤ 240 ms, in-house core, reduced motion per token | ADR-0026; `language.md` §7 |
| Type and icons | `'Inter Recto'` subset with optical sizes; Phosphor regular and fill built at compile time | ADR-0027; `language.md` §4–§5 |
| Accessibility | A-1 to A-24 as CI gates; rendered pixels in three engines plus a no-GPU project; the "plain" project | ADR-0028; research 22 §13; `language.md` §9 |
| Interaction model | Viewing with targeted acts; one Markup state opened with Select; Lock with four reasons; the Pages grid as a surface; key map v2 | ADR-0029; `flows.md` §1–§4, §7 |
| Change guard | `canChange(id, act)` for six acts; Lock enforced once in `commit()` | ADR-0030; `flows.md` §2.5 |
| Shell | Five width classes and compact-height; top strip, labelled dock that morphs, one sidebar, sheets, page pill; Compare a place; Library as the welcome | ADR-0031; `flows.md` §6, §9 |
| Saving | Save in place, one Save a copy sheet, OPFS snapshots with a 20-step tail, visible Undo, toasts, saved signatures | ADR-0032; `flows.md` §5 |
| ADR mapping | `flows.md` §14's seven decisions are ADR-0029 (items 1, 5, 6), ADR-0030 (2), ADR-0031 (3, 7), ADR-0032 (4); `language.md` §11.1's eight are ADR-0022 to ADR-0028 (the light theme folded into 0022) | ADR-0029 §5.3; `language.md` §11.1 |
| Components | Nine families, cited by file name (`01-frame` … `09-primitives`) | §5; §6 X3 |
| Brand and About | The owner keeps the name Recto and supplies the mark and brand kit ("Dengeli" R, mono and aurora; brand plan, status of 2026-10-04). The copy-check lists stay in D0-13; icon files, manifest colours, About v2 and the press kit are made from the owner's kit (D4-7, D4-8, D4-10); the lead's mark boards (former D3-10) are cancelled | owner, 2026-10-04; brand plan §11 |
| Versioning | Drops are planning units; no tag until the owner says "beta v1" | brief; ADR-0017 |
| Editions | Phones get a read-only compact edition (D0-14); M9 builds and polishes the full edition for widescreen desktops and tablets; the phone edition is M10, planned with the owner | ADR-0033 (owner, 2026-10-04) |
| Ink | Colour and size one press away: the ink strip, one Slider with a lens knob and log widths, the colour panel (Grid · Spectrum · Sliders, eyedropper, saved colours) | `10-ink.md` (owner, 2026-10-04) |
| Quality bar | Q-1 to Q-14: no grain; one backdrop root; no glass in glass; shapes change through their own geometry; transforms only for sheets; one control system; idle at rest; budgets; pinned screens | `quality-bar.md` (owner, 2026-10-04) |

## 1. Problem

### 1.1 The owner's brief (2026-10-04, in translation, condensed)

Rethink the whole UI and UX from scratch in a language of glass, light ("a yellow-green,
lime-coloured, moving, vivid aurora light at a few points") and motion ("like butter"). Simple,
native and natural, like Apple Preview and Notability; few, predictable steps; phone and desktop;
"smart, rich and expensive". Plan with research, notes, ADRs and decision files. Plan the
branding and the portfolio and About page, but do not build them yet. Draw the roadmaps. No beta
tag until the owner says "beta v1".

### 1.2 The ten visual problems (baseline §4)

| # | Problem | Evidence |
|---|---|---|
| V1 | No tablet or phone layout: at 390 px the page area is 77 px and the shell scrolls sideways 75–204 px; at 820 px chrome takes 72 % | frames 03-390, 17-390, 17-820 |
| V2 | No brand: a generic file glyph; the empty Home does not say what the app does | 01, 27, 34 |
| V3 | Glass reads as grey slabs and ghosting; Glass panels makes a two-tone frame; dialogs are not glass | 04, 09, 18, 20, 30 |
| V4 | Floating chrome covers text at rest (the Read Edit pill, the Edit bar) | 03-1280, 17, 37 |
| V5 | Bars overflow their capsules (swatches, lasso bar, Compare bar at 820) | 04-820, 11, 13-820 |
| V6 | Flat, monotone hierarchy: one 13 px size, uppercase 11 px labels, one accent | 01, 02 |
| V7 | Duplicated controls: "Pages" three times, zoom twice in Compare, Edit twice | 03, 12, 13, 36 |
| V8 | The Document menu is a 764 px junk drawer with settings and About | 18, 19 |
| V9 | Forms look like web forms; three kinds of secondary surface | 16, 22, 24, 25 |
| V10 | Inconsistent shapes and stray states (2 px ring round dialogs, every card selected at rest) | 02, 12, 17, 21 |

### 1.3 The fifteen flow frictions (current-flows §19)

| Id | Friction (short) | Answered by |
|---|---|---|
| F-1 | The Read lock gates every change and still misses page structure | ADR-0029, ADR-0030 (D1) |
| F-2 | No phone or tablet layout | ADR-0031 (D0 classes, D2 shell) |
| F-3 | Tools three levels deep | Markup palette (D2) |
| F-4 | Saving is a dialog; work is lost silently on reload | ADR-0032 (D0) |
| F-5 | No visible Undo; feedback only spoken | Undo/Redo, toasts (D0) |
| F-6 | Page operations scattered; keys change meaning | Pages grid, sidebar drag, key map v2 (D2) |
| F-7 | Touch cannot multi-select, drag or scroll while drawing | gesture core (D1), grid and sidebar (D2) |
| F-8 | Find and OCR hard to find | Find in the strip, facts chip (D2, D4) |
| F-9 | Combine and Merge: three names, two outcomes | one outcome (D2; §6 07.13) |
| F-10 | Highlight and comment are two objects | selection bar keeps the highlight (D1) |
| F-11 | "Sign" is four things; signatures last one session | Fill & sign door, saved signatures (D0, D2) |
| F-12 | Long jobs end in long dialogs | Sheets, one result page, toasts (D0, D1) |
| F-13 | Keyboard-only gaps | caret mode, Alt+Enter, keyboard placement (D2) |
| F-14 | First visit gives no orientation | launcher, sample, facts chip (D4) |
| F-15 | Results and the safety net hide in panels | scrubber, title menu, Review filters (D0, D2) |

### 1.4 Phone and tablet breakage (baseline §5–§6, research 22 §0)

- 390 × 844: the page renders at 25 %; `scrollWidth` 465 px in Read and 594 px with the
  inspector; the Edit bar is cut so eraser, lasso and shapes cannot be reached; tabs vanish; the
  selection bar renders in a 77 px sliver; 26 of 34 targets are under 44 px.
- 820 × 1180: rail and navigator take 38 %; tab titles cut to "demo-…"; 26 px tabs and 28 px rows;
  the Compare bar clips next, previous and refresh; keycaps shown on touch.
- 400 % zoom overflows the chrome by 110 px; under WCAG 1.4.12 spacing the Turkish rail label
  truncates to "Dosyal…".

### 1.5 Contrast defects found in research 20 and 22

| Defect | Measured | Source | Fixed by |
|---|---|---|---|
| On-page rings, handles, lasso box and hover outline in `#7c8cff` | 2.98:1 on white, under WCAG 1.4.11 | research 20 §8 #4, 22 §4 | D0-1: `--select` `#4e61ed` (4.93:1) |
| The shipped 44 px floating bar renders `#5b5d61` over a white page, not the modelled `#47494d` (blur leaks at the edges) | secondary labels 3.61:1, accent fill 2.22:1; axe reports nothing | research 22 §3.2–§3.3 | D0-1: σ ≤ height / 5 on today's bars; D3: coverage registry and pixel tests |
| Focus ring `2px solid #7c8cff` | 2.98:1 on white, 2.22:1 on the rendered bar, 2.40:1 on a 35 % aurora | research 22 §4, §14 #5 | D3-2: two-band ring (lime, ink; 16.42:1 between bands) |
| `--text-secondary` and `--text-tertiary` under APCA | Lc 43–50 | research 22 §3.4 | D3-2: new ladder; secondary Lc 60 stays a warning (§6 0028.2) |
| Text wells and boxes with `--border-strong` | 1.59:1 to the well | `09-primitives` §34 #2, `07-sheets` §27 #2 | D3-2: `--control-border` (§6 X7) |
| Lime on paper; lime vs the yellow highlighter under protanopia | 1.21:1 on white; ΔE_OK 0.1 | research 20 §0, 22 §11 | ADR-0023: lime never on the page |

## 2. Principles kept and amended

**Kept:** the page is the brightest thing on screen; one accent; a keyboard path and a ⌘K entry
for every action; undo, not confirmation; inline honesty; chrome never tinted by state; no
marketing surface inside the app; nothing leaves the device; the M8 protection for page text (a
pen or a stray click never edits it, ADR-0019's wish) survives as input rules and Lock.

**Amendments** to `docs/DESIGN.md`, applied by D4-9 when the parts are built (until then §1–§9
describe the shipped app; DESIGN §10 points here):

| # | DESIGN § | Was | Becomes | Decided in |
|---|---|---|---|---|
| B1 | §1 Intent | "Quiet, dense, professional … Nothing glows"; references Linear, Raycast, Preview | Simple, native, natural (Preview, Notability, Freeform); the page brightest; only light glows (the aurora and glass rims), controls never glow | ADR-0022 §2.3; research 15 |
| B2 | §2 Layout | 3 × 3 grid: title bar, rail, navigator, inspector, status bar | Size-class shell: top strip, dock, one sidebar, sheets, page pill; the free rectangle | ADR-0031 |
| B3 | §2 Views | Home, Read (locked) · Edit · Arrange, Compare; keys `0`–`4` | Library place; document in viewing with targeted acts; Markup surface; Pages grid surface; Compare place; Lock per document | ADR-0029 |
| B4 | §2 Tool bar | Five groups in Edit; one Edit button in Read | Labelled dock (Pages · Markup · Fill & sign · More) that morphs into one Markup palette opened with Select | ADR-0029, ADR-0031 |
| B5 | §2–§3 Glass | Floating chrome glass, docked opaque; Glass panels trial; Reduce transparency | M1–M5 and lit glass with a coverage rule; docked glass by default on fine pointers pending OM1; Glass Clear · Tinted · Solid | ADR-0024 |
| B6 | §3 Colour | `#7c8cff` accent; dark only | One lime, selection blue, graphite; light and dark equal, following the system | ADR-0022 §2.4, ADR-0023 |
| B7 | §3 Elevation | One elevation token for floating chrome | e0–e5 and per-tier rims | ADR-0024; `language.md` §6.3 |
| B8 | §3 Motion | "Short, eased … no springs in the chrome" | Springs on platform routes; View Transitions ≤ 240 ms; reduced motion per token; rest is still, motion answers | ADR-0026 |
| B9 | §3 Type, icons | 13/12/11 px, uppercase labels; Lucide | `'Inter Recto'` scale with a coarse step, sentence case; Phosphor regular and fill | ADR-0027 |
| B10 | §4.1 | "Esc always clears tool and selection" | The Esc ladder: menu → selection → disarm → close Markup (→ leave Focus) | `flows.md` §7.2; §6 01.14 |
| B11 | §4 "Creating never selects" | Every creation leaves nothing selected | Free-form creation never selects; a targeted act on a text selection keeps its result selected so the next act reuses it (Highlight then Comment) | §6 04.Q1 |
| B12 | §4.8 | Read, Edit and `canEdit(id)` | Input rules (`flows.md` §3.1), `canChange(id, act)`, Lock in `commit()` | ADR-0029, ADR-0030 |
| B13 | §2 Export, §4 saving | An Export dialog; no restore | Save in place, Save a copy…, snapshots on the device, visible Undo and History | ADR-0032 |
| B14 | §5 Accessibility | 2 px accent ring; "reduced motion respected"; axe per state | A-1 to A-24 as gates; the two-band ring; the plain project | ADR-0028 |
| B15 | §6 Naming and brand | Name settled, glyph generic | Brand per `docs/brand/README.md` after Gate 0 (D4) | brand plan §1, §11 |

## 3. The model in one page

The model is [`flows.md`](../design/redesign-2026-10/flows.md); this section is its index.

- **Places and surfaces** (flows §2.1–§2.2): the Library (code `home`), a document, Compare;
  inside a document the page, the Pages grid, the sidebar and the Markup palette. Settings is one
  sheet; the About page lives outside the app.
- **Viewing works** (flows §3.1, ADR-0029): a document opens on its page, not locked. Acts aimed
  at a target need no mode: type in a field, act on a text selection (H U S C X), use the page
  menu, drag a thumbnail. A navigating click never selects (S10).
- **One creation state** (flows §4.2–§4.3): the dock's Markup, M (2 stays an alias) or a tool
  key opens the palette with Select armed; P arms the last pen; Done or Esc Esc closes it. Fill &
  sign opens the same palette on its Sign set.
- **Protection without a mode** (flows §3, §3.5): page text changes only through Edit text; a
  double-click opens the editor only in Markup with Select; the pen writes only in Markup by
  default; E needs Enter. S1–S18 show the result stricter than ADR-0019's Read for page text and
  equal for the pen; five deliberate acts become one visible, undoable step.
- **Lock** (flows §2.6, ADR-0029): `user`, `signed`, `restricted`, `default`; blocks every act;
  shown by glyph and word; the default is owner question 1.
- **Guard** (flows §2.5, ADR-0030): `canChange(id, act)` over `targeted`, `freehand`, `place`,
  `text`, `pages`, `document`; `commit()` refuses any change to a locked document.
- **Saving** (flows §5, ADR-0032): kept on the device within 2 s, in the file by Save, as a copy
  by Save a copy…; restore on launch with a 20-step history tail; Undo and Redo on every width.
- **Layout** (flows §6, ADR-0031): six classes, a placement matrix (§6.9) and the rest rule
  (§6.2): every fit, jump and focus lands in the free rectangle.
- **Keys and gestures** (flows §7): key map v2 and its migration (§7.3); thresholds from research 19.
- **Steps** (flows §8): mouse ≈ 91 → 68 over 19 job rows; touch ≈ 99 (no page move) → 72; the
  keyboard gaps J5 and J8A close; three Markup openings where today needs nine mode switches.
- **First run** (flows §9): the launcher, the teaching sample with `?sample`, the facts chip.

## 4. The language in one page

The language is [`language.md`](../design/redesign-2026-10/language.md); this section is its index.

- **Colour** (§1): four roles (atmosphere, interaction, content, status) that never mix; one lime
  that always touches ink; `--select` on the page; graphite neutrals at hue 265; every pair in §1.7
  asserted.
- **Materials** (§2): five densities with transmission falling from chips (0.21) to sheets
  (0.07); the coverage rule (σ ≤ height / 5 for bars, ≤ side / 5.5 for chips); lit glass only
  where no page passes; the Glass setting and the cost ladder (§2.8); the budget per class (§2.9);
  what stays solid (§2.10).
- **Light** (§3): a 1/8-resolution field in named places (the Library, the drop overlay, under
  the armed tool, the processing ring, the success bloom, About); never within 64 px of a page;
  pauses and gates (§3.5).
- **Type** (§4): `'Inter Recto'`, 98 KB with Turkish, 11–56 px, tabular numbers, the Turkish
  rules of §4.4.
- **Icons** (§5): Phosphor regular at rest, fill when selected; the mapping of §5.2.
- **Shape, space, depth** (§6): a 4–28 px radius scale with concentric nesting; density by
  pointer (24 px fine, 44 px coarse).
- **Motion** (§7): tokens, the catalogue of §7.3 (with the additions of §6 X8, 02.5, 02.6, 05.2),
  reduced motion per token, the Reduce motion setting.
- **Feedback** (§8) and **accessibility** (§9): toasts above the dock; the non-negotiables and
  the two-band ring.
- **Implementation** (§10): `tokens.css` in seven blocks, `materials.css`, `motion.css`,
  `fonts.css`, `tokens.test.ts` with the coverage registry, the rendered checks, and the
  migration order that D0-1 and D3 follow.

## 5. Components

| File | Family | Delivers | Drops |
|---|---|---|---|
| [`01-frame.md`](../design/redesign-2026-10/components/01-frame.md) | App frame | F1–F13: free rectangle and safe areas, top strip, Library/sidebar/Undo/Redo buttons, tabs, title menu with the Lock switch, Find entry, Save, privacy shield ◎, compact top bar, dock at rest, page pill, hide on scroll, overlay slots; removes the mode switch, layout switch, Document and Export buttons, status bar | D0 (classes, Undo/Redo, Save), D2 |
| [`02-library.md`](../design/redesign-2026-10/components/02-library.md) | Library and first run | L1–L12: Library view, launcher, light field, head, cards, selection bar, Recents with snapshots, restore and Start fresh, drop overlay, teaching sample, facts chip, Library menu and footer | D0 (restore UI), D4 |
| [`03-markup.md`](../design/redesign-2026-10/components/03-markup.md) | Markup | The shared capsule and its morph (§6 X1), the Markup palette with measured folding, compact sets, options tier and chip, preset strip, Fill & sign door, saved-signature chips, field stepper; the act each tool declares | D2 |
| [`04-context.md`](../design/redesign-2026-10/components/04-context.md) | Context | The ContextBar primitive and eight bars (selection, annotation, image, field, form accessory, pending marks, Pages, Compare), the menu primitive and 11 menus, the page menu, popovers, note popup, privacy popover, Lock notice and Unlock popover, tooltip, `ui/anchor/place.ts` | D1, D2 |
| [`05-canvas.md`](../design/redesign-2026-10/components/05-canvas.md) | Canvas | 26 parts on and over the page: free rectangle, zoom controller, scroll and page scrubber, hit router with `canChange`, caret mode, selection frames, ink, lasso, placement ghost, three editors and their doors, form widgets with the Lock notice, links, redaction marks, crop, furniture, OCR ring | D1, D2 |
| [`06-navigation.md`](../design/redesign-2026-10/components/06-navigation.md) | Navigation | N1–N6 sidebar (Contents/thumbnails, Find, Review, phone Pages sheet); PG1–PG6 Pages grid (transition, header, sections, cells, drag, Combine result); CP1–CP7 Compare place | D1 (S10), D2 |
| [`07-sheets.md`](../design/redesign-2026-10/components/07-sheets.md) | Sheets | One Sheet primitive in five presentations; 18 sheets, one confirmation pattern and the shortcuts overlay replacing 27 dialogs; Save a copy; Settings; one result page | D0, D1, D2 |
| [`08-feedback.md`](../design/redesign-2026-10/components/08-feedback.md) | Feedback | ⌘K with arguments and selection first, keycaps, one Toast system, progress capsule and ring, success bloom, History scrubber, error presentation, honesty notice, live announcements, empty states, the light-event service, haptics | D0, D2, D3, D4 |
| [`09-primitives.md`](../design/redesign-2026-10/components/09-primitives.md) | Primitives | 22 primitives on Base UI; tokens in both themes; `materials.css`; the coverage registry; the rendered-pixel harness; the font and icon pipelines; the `light/`, `motion/` and `motion/gesture/` APIs; the migration order | D0, D3 |

## 6. Decisions on the open issues

Every item the component authors (each file's "Issues for the lead" and "Open questions"), the
ADR author (each ADR's §5) and the language author (`language.md` §11.3) raised gets one
resolution here. **Ids:** `02.15` is issue 15 of `02-library`; `02.Q3` its open question 3;
`0030.2` is ADR-0030 §5 item 2; `L.3` is `language.md` §11.3 item 3. **Verdicts:** **A** the
author's decision stands; **C** changed here; **O** sent to the owner (§14); **T** decided by a
test, with the default built until then: **P** the wave 3 concept prototype
([`concept/index.html`](../design/redesign-2026-10/concept/index.html)), **5** the five-person
test (§10.4), **D** the phone and tablet run (OM5, §9.2). Where a resolution needs a line in a
source document, §6.16 lists it; those lines were applied on 2026-10-04.

### 6.1 Cross-spec decisions

| # | Question | Decision | Adjust |
|---|---|---|---|
| X1 | Who owns the shared glass element (dock, palette, preset strip, Pages bar, Compare bar, Locked) | `03-markup` owns `shell/capsule/` (element, `clip-path` morph, one σ per size). `01-frame` supplies the dock's resting items and the Locked button (`Dock.tsx`; its `dock-shape.ts` folds into `capsule-morph.ts`); `04-context` the Pages and Compare bar contents; `06-navigation` the phone Pages sheet's solid twin | 01 §15; 04 §10, §11, §22 #8 |
| X2 | History scrubber specified twice | `08-feedback` §8 (FB7) is the source; `04-context` §18 shrinks to a pointer | 04 §18 |
| X3 | Family numbers collide (inventory vs file) | Specs cite each other by file name (`01-frame` … `09-primitives`); inventory numbers appear only as "inventory §n" | 01, 05, 08 |
| X4 | Lock popover in `01-frame` (`shell/frame/LockPopover.tsx`) and in `04-context` §19 (`lock/`) | One module `lock/` (`LockNotice.tsx`, `UnlockPopover.tsx`, `open-unlock.ts`) with `04-context` §19's copy and reasons; `01-frame` keeps the title menu, tab menu and Lock switch, which call `open-unlock`; `lock-popover-store.ts` is not created | 01 §6, §15 |
| X5 | Gesture core home (02: `motion/`; 04: `viewer/gestures/`; 05: `viewer/gesture.ts`) | `motion/gesture/` holds every recogniser and threshold (long press 450 ms and 10 px slop, double tap, multi-finger taps, pinch); viewer files only hit-test; cards, tabs, ↶ and thumbnails use it instead of Base UI ContextMenu's 500 ms | 02, 04 §2, 05 |
| X6 | New σ steps | Accepted together: M5 σ 24 for dialogs and modal sheets under 260 px tall (a 400 × 168 confirmation: c 0.9995 instead of 0.920); M4 σ 12 under 92 px tall, σ 16 from 92 to 120 px; M1 28 px chips at σ 5; M2's range 7–10 (36 px bars at σ 7); M2 phone selection bar 344 × 56 at σ 10 | `language.md` §2.2, §2.9; registry |
| X7 | `--border-input` (07) and `--control-border` (09) | One token, `--control-border` (dark white 0.48, light ink 0.55; 3.61–5.01:1 over the worst glass) for wells, boxes, radios, switch tracks and light thumbs; `--border-input` is not created; wells leave `--border-strong` | 07 §27 #2; `language.md` §2.10 |
| X8 | In-sheet navigation has no transition | A named *sheet push*: `translateX(24px)` plus opacity on `--spring-smooth`; reduced motion a 150 ms fade | `language.md` §7.3 |
| X9 | F6 order with sheets, caret mode and editors | Top strip (or compact top bar) → sidebar → **page** (the page, then caret mode or the open editor's header) → **tool sheet** → facts chip → pending-marks bar → dock or palette → contextual bar → page pill → toasts. Modal sheets and the title menu trap focus and sit outside the cycle. One implementation in `shell/frame/regions.ts` | `flows.md` §7.2; 01 §15 |
| X10 | `HistoryEntry.meta` (a packages change) | Accepted for D0: `meta?: { documentId; page? }`, filled by every push that knows its target; the scrubber and "Undid … in agreement.pdf" read it (§7) | 08 §17 #3 |
| X11 | Combine's shared sources and Lock | ADR-0030 §5.3 stands for M9: a locked input refuses annotations on the shared pages of a combined document, saying "This page is shared with locked report.pdf"; the combined document's page structure stays free. Copy-on-write sources are a later model ADR (M11 candidate) | ADR-0030 |
| X12 | Closing, reordering and Combine with locked documents in `commit()` | `commit()` compares only documents present before and after; a close, a `documentOrder` change and a new document are not changes to a locked document; undoing a close restores it locked; rename is a `document` act | ADR-0030 §5.1, §5.4; 02 #8 |
| X13 | The saved mark | Outside the model: `state/saved-store.ts` maps each document to the history entry last written; tab ● and Save's "Saved" read it; `markDocumentClean` and `VirtualDocument.clean` stay unused | ADR-0030 §5.2; ADR-0032 §5.2 |
| X14 | Base UI Toast against A-14 and the F6 cycle | Build our own toast region (about 200 lines) on the toast store from the start; Base UI's Toast viewport is not used, so no ARIA overrides or capture-phase F6 interception to maintain | 08 §17 #6 (changed) |
| X15 | Link popover in 04 §15 and 05 §23 | `05-canvas` §23 owns the link popover and the paragraph info popover; `04-context` §15 keeps the popover primitive and points to 05 | 04 §15 |
| X16 | Tooltip | `04-context` §20 owns strings and behaviour; `09-primitives` owns `ui/Tooltip` internals | — |
| X17 | Owners of Sheet and Toast | `07-sheets` (Sheet) and `08-feedback` (Toast), built on `09-primitives`' Button, ScrollArea, Progress, focus forms and `ui/Surface` | 09 #4 |
| X18 | Owner of the snapshot engine | Package D0-7 owns `session/` (snapshots, restore, Recents snapshots, retention) under ADR-0032; `01-frame` and `02-library` consume its API | 02 #16 |
| X19 | Is Select lime when armed | ADR-0023 §5.1 stands: Select armed shows its fill glyph on `--surface-on`, no lime and no under-light; lime and the under-light start with a creating tool | 03 §2 |
| X20 | The lens at rest (L.3, 01 #13) | No lens on the capsule (dock, palette, bars): a line may rest under the dock, and the morph must never change the filter. The Chromium lens stays on fixed-size M1 chips (page pill, facts chip); segmented controls keep the own-content lens | `language.md` §2.7, §11.3; ADR-0024 (amend before acceptance) |
| X21 | Where the Pages bar lives | Viewing: the dock morphs into it, with ✕ in place of Done; Markup: a tier above the palette; compact: inside the Pages sheet as its solid twin | 04 #12; 06 #7; 01 F10 |
| X22 | Mark search matches (inventory 7.10) | "Mark all for redaction" in the Find section's results (`06-navigation` N4) and in ⌘K | 03 #6 |
| X23 | Sheets and the free rectangle | Tool sheets inset the free rectangle when at least 400 px of stage remains, else overlay; the column re-centres on *panel*; Fit re-fits to the free rectangle and the earlier zoom returns on close; modal sheets never inset | 01 #10; 05 #5; 07 #11 |
| X24 | The coverage registry | One registry that every family extends for each glass size it renders; `tokens.test.ts`, the generated `materials.css` steps and the pixel harness read it | 09 #10 |
| X25 | Renames `ReadView` → `PageView`, `Arrange*` → `PagesGrid*` | Not in M9: they churn tests and history for no user gain; code comments carry the new words | 05 #15; 06 #22 |
| X26 | Storage names | New stores keep the `pdf-editor` prefix (ADR-0015 §3): `pdf-editor:facts-seen:v1`, `pdf-editor:signatures:v1`, `pdf-editor:ui:v3`, `pdf-editor:palette-recents:v1`, OPFS `pdf-editor-session/` | 02 #15 (changed) |
| X27 | "Outline" or "Contents" | One word: **Contents** in the sidebar, the pill menu and ⌘K (Turkish "İçindekiler" in both); departs from flows' "Outline" | `flows.md` §2.1; 01 F11; 06 #19 |
| X28 | Device spike ids | Research 19's S-T1 to S-T4 keep their meaning; the touch selection-bar check is **S-T5** (04 #10 called it S-T3, which is the memory check) | 04 #10 |
| X29 | Privacy popover specified twice (01 F8 at 340 px, 04 §17 at 360 px, different copy) | `04-context` §17 owns the popover's content, copy (one EN and TR table), width (360 px) and `privacy/PrivacyPopover.tsx`; `01-frame` F8 owns the ◎ button and its states and opens it | 01 §9; 04 §17 |
| X30 | A-20's 320 × 256 case | Under 01's classifier it is compact-height, where top bar 44 + dock 44 + offset 12 take 39 % of the height. **Short viewports** (height < 352 px, any width; `data-tight`): the top bar folds into the dock, one 44 px capsule (σ 8) holds ‹ N, title ▾, ↶ and ⋯; side sheets become full-width bottom sheets; the rail becomes a horizontal palette in the same capsule. At 320 × 256 chrome is about 17 % | `flows.md` §6.1, §6.9; 01 §2; `language.md` §2.9, §9.1 |
| X31 | Rename guards differ by entry point | Rename is a `document` act at every entry point (X12, 0030.4): the title-menu name field (01 F5; read-only with "Locked · Unlock" when locked), a card's F2 (02 L5) and a grid section's F2 (06 PG3, which opens the Unlock popover at the header when locked); `guard.test.ts` has a case for each | 01 §6; 06 §11 |
| X32 | Acts of Split, Interleave and Combine | Split declares `pages` (it removes its pages from the original); Interleave and Combine declare none (they make a new document and read their sources, 07.13) | 01 §6; 07 §16 |
| X33 | OCR results have no Review filter (inventory 6.4) | A fifth Review filter, **Words to check** ("Kontrol edilecek sözcükler"), shown only after OCR has run: rows by page with the quality word (Good · Review · Poor · No text), J / K step the `05-canvas` §27 word ring; the OCR toast's Review opens it | 06 §7; 07 §12 |
| X34 | Act of a placing tool's click and of Add field | `place` (allowed in Markup, and outside it with "Add … here" or keyboard placement), as `03-markup` §3 lists; ADR-0030 §2 items 2 and 8 and `05-canvas` §6 are amended | ADR-0030; 05 §6 |
| X35 | Transient blur count with toasts | A toast stack renders inside one filtered container shaped to the toasts, so it counts as one transient surface in every class; on compact and medium a toast that appears while a contextual bar shows uses the M2 solid token | 08 §5; `language.md` §2.9 |
| X36 | CI browsers render in software | Every CI browser would start at Glass Tinted and Ambient light Still (`language.md` §2.8). D3-3 adds a test-only render override (`window.__rectoRender = { degrade: 'off', glass: 'clear', light: 'auto' }`, set by a Playwright init script, stripped from the deploy build); the default, pixel, motion and matrix projects use it; one spec without it asserts the start states | ADR-0024 §2.4; ADR-0028 §2.1 |

### 6.2 Model, guard, Lock and saving

| Id | Item | Resolution | V |
|---|---|---|---|
| 02.7 | Snapshot lacks the place | The snapshot stores `destination` and the active document; Compare is not restored and falls back to document A | A |
| 02.8 | `commit()` and Library acts on locked documents | X12 | A |
| 02.10 | Combine files… outcome | Only the combined document opens, one composed history step; the picked sources go to Recents (unchanged, no snapshot) | A |
| 02.15 | Facts chip once per file; seen-key store | "Restored edits" shows on every restore; keys (size plus a hash of the first 64 KB) in `pdf-editor:facts-seen:v1`, not `recto:…` (X26); cleared with Clear recents, with Clear kept documents, and by "Show tips and facts again" in Settings (07.8) | C |
| 02.16 | Owner of `session/` | X18 | A |
| 02.Q4 | Twelve Recents rows beside 30 days or 500 MB of snapshots | Kept documents are listed separately and all of them within retention, first; plain recents stay at 12 | A |
| 02.Q5 | "Delete kept changes" on Start fresh | No: Start fresh closes and keeps; Clear lives in the privacy popover and Settings, which shared machines need anyway | A |
| 0029.1 | Lock also blocks `document` acts | Accepted; owner question 1 names both ways the locked default is stricter than ADR-0019's Read (page structure and whole-document operations) | O |
| 0029.2 | Lock while an editor is open | The Lock switch is dimmed with "Finish editing first" while the paragraph editor, a note or a text box is being typed in; `signed` and `restricted` start only on open | A |
| 0029.3 | ADR numbering note in flows | Recorded in §0; the lead adds the note to `flows.md` §14 (§6.16) | A |
| 0030.1 | Closing a locked document | X12 | A |
| 0030.2 | Saved state outside the document | X13 | A |
| 0030.3 | Shared source pages after Combine | X11 | A |
| 0030.4 | Rename | A `document` act, dimmed when locked, at every entry point (X31) | A |
| 0031.3 | Facts-seen record | `pdf-editor:facts-seen:v1` (X26), cleared with Clear recents, with Clear kept documents, and by "Show tips and facts again" in Settings (07.8) | A |
| 0032.1 | Chromium 153 cannot read stored handles | After a restore there, Save opens the picker (2 presses) and keeps the new handle for the session | A |
| 0032.2 | Saved mark | X13 | A |
| 0032.3 | Save while locked | Save stays allowed: it writes the document unchanged; a document opened `signed` or `restricted` reads "Saved". Departs from flows §2.6's list (§6.17) | A |
| 0032.4 | Retention on by default | Owner question 2; the build changes two numbers and one default if the answer differs | O |
| 07.10 | Unapplied redaction marks: flows has Save ask, 07 keeps Save a copy's block | One rule for Save and Save a copy: "2 marks not applied" with **Apply and save** as the default and "Save without applying" as the secondary with the honesty line "The text under 2 marks is still in the file"; the M8 block goes | C |
| 07.13 | Interleave consumes both inputs | Interleave keeps its sources and makes a new document, like Combine (INV-R6, INV-12): `interleave` gains `keepSources` (§7), the app always passes it; its guard is none (X32) | C |
| 07.15 | Guards per sheet | Password asks `document` and is blocked while locked; Save a copy's Security is output-only and allowed; certificate signing (an output) asks nothing | A |
| 08.3 | `HistoryEntry.meta` | X10 | A |
| 08.9 | Update toast copy | Reloading no longer closes documents; the old warning shows only when nothing is kept (private window, storage refused) | A |
| 06.17 | Migrating `leftPanelOpen: true` | Not migrated from `ui:v2`: the sidebar starts closed for everyone once | A |
| 07.Q3 | Last Save a copy choice as the next default | No: drafts are per document per session; every new document starts at "Same as original" | A |

### 6.3 Glass, coverage and tokens

| Id | Item | Resolution | V |
|---|---|---|---|
| 02.3 | Lit glass in light theme and on coarse pointers | Light theme uses light M2; lit glass σ 20 on compact, compact-height and coarse pointers | A |
| 02.4 | Launcher row at σ 28 leaks (c 0.80) | σ 16 (c 0.994), registered | A |
| 03.8 | Options tier on coarse pointers | 520 × 52 at σ 10 (c 0.991), registered | A |
| 04.1 | Phone selection bar | 56 px stacked labels, σ 10 (X6), registered | A |
| 04.2 | Short menus | X6 | A |
| 04.7 | Tint and colour pickers | M2 tiers, not M4 popovers (a 52 px popover at σ 16 is c 0.894) | A |
| 05.8 | Paragraph editor header tier | M4 (it holds secondary sentences); the compact accessory form stays M2 inside the dock's element | A |
| 05.11 | Pinch detent chip | Allowed; it is the compact class's one transient blurred surface | A |
| 05.14 | 28 px Lock and E chips | σ 5 (X6), registered | A |
| 06.21 | Navigation coverage rows | Registered: grid header 1440 × 44 σ 8 and 1440 × 84 σ 10; compact Compare top bar 390 × 88 σ 10; compact find bar 358 × 44 σ 8; sidebar 280 and 320 × 600 σ 40; Changes 320 × 600 σ 40 | A |
| 07.1 | M5 σ 24 | X6 | A |
| 07.2 | `--border-input` | X7 | C |
| 09.1 | Lime on-states would multiply lime | Switch, checkbox, radio, chip and segmented thumb use neutral `--control-on` (n12); lime stays with the prominent button, armed tool, focus band, range fill and current rows; `language.md` §1.1 reads "on states of tools" | A |
| 09.2 | `--control-border` | X7 | A |
| 09.3 | Filled buttons on M1/M2 | Every button on M1/M2 renders quiet; danger hover never deepens a fill | A |
| 09.8 | Segmented thumb boundary 1.65:1 | 1 px `--control-border` ring on the thumb | A |
| 09.9 | Light slider and switch thumbs 1.53:1 | The same ring | A |
| 09.10 | Who registers sizes | X24 | A |
| 0024.1 | Lit glass has no light twin | Light M2 in the light theme (02.3) | A |
| 0024.2 | S2 must cover the dock | OM1 includes the floating dock and the palette with the under-light (§9.2) | A |
| L.1 | Compact-height dock 44 or 48 | 44 (σ 8, c 0.994); its buttons' hit areas take the full capsule height to reach 44 px | A |
| L.2 | Contextual bars at 36 px on fine pointers | Allowed: σ 7, c 0.990 | A |
| L.3 | The dock's lens at rest | X20 | C |
| L.4 | Pill and chip heights | 36 px fine, 44 px coarse (confirmed by `01-frame` F11) | A |
| L.6 | Two corrected §2.9 values | `tokens.test.ts` uses c 0.991 for the 40 × 40 chip and σ 85 as the sheet's largest | A |
| 01.13 | Lens on the dock in viewing | X20 | C |
| 06.7 | Pages bar inside the phone sheet | Its solid twin (no glass on glass at 40 %); X21 | A |
| 06.8 | Sticky glass section headers in All open | None; section headers sit in the flow; the section in view is row 2 of the grid header | A |
| 09.Q1 | Light theme prominent button | Lime label on ink (14.79:1, `language.md` §1.4); taste check | T·P |
| 09.Q3 | Coarse switch size | 52 × 32 on the 4 px grid | A |

### 6.4 Light and colour

| Id | Item | Resolution | V |
|---|---|---|---|
| 02.1 | The 64 px rule against lit Library cards | Library thumbnails are exempt from the 64 px distance and keep the brightness rule (I 0.6 cap under lit glass, Library mean Y ≤ 0.03); but A-6's pixel test **also covers Library thumbnails**: they are opaque content, so their pixels must be identical with light on and off | C |
| 02.2 | Text-safe band | A `textSafe` rect uniform (up to four rects) takes intensity to 0 within 24 px; a pixel test checks Y ≤ 0.026 behind the head row | A |
| 02.21 | Drift on Combine is never seen | No drift on Combine; the toast's success bloom carries it | A |
| 03.4 | Armed pens cannot be lime | Glyph tools take the fill; pen dots, the Highlighter and signature chips take the n12 ring; X19 for Select | A |
| 03.5 | Under-light and Redact | No under-light while Redact is armed; the lime fill stays | A |
| 05.3 | Red on the page; crop dimming | `--redact-page` `#c21725` in both themes (6.10:1 on white) with a 45° hatch and the pending bar's words; `--crop-dim` outside a crop preview; both are content tokens, not status washes | A |
| 08.8 | Processing as a light hook | Processing drives rings, never the field | A |
| 08.11 | Empty-state duotone vanishes on light | lime-800 at 25 % in the light theme | A |
| 0023.1 | Select armed | X19 | A |
| 06.Q3 | One Compare colour or three | One (`--select`) with shapes and words (A-19); revisit only if the five-person test (session 2, D2 build) shows confusion | T·5 |

### 6.5 Motion

| Id | Item | Resolution | V |
|---|---|---|---|
| 02.5 | Press scale on large surfaces | 0.98 / 0.96 for surfaces of 120 px or more, a row in *press* | A |
| 02.6 | No *fold* | Reuse approved: *popup* exit toward the ⓘ plus the *undo reveal* ring, listed in the catalogue as "fold (composite)" with no new token | A |
| 05.2 | Find hit has no transition | Reuse approved: *scroll-to* then *undo reveal*, listed as "find step (composite)" | A |
| 05.10 | Steady caret | Caret mode and the editors' caret do not blink (A-9); native form inputs keep the browser's blink | A |
| 07.3 | In-sheet navigation | X8 | A |

### 6.6 Type, icons, copy and language

| Id | Item | Resolution | V |
|---|---|---|---|
| 03.10, 07.17, 09.13 | Phosphor names outside `language.md` §5.2, unverified (no package installed) | One merged list in `tools/icons/manifest.json`; the generator fails on an unknown name, so D3-6 verifies every name before any family migrates; a missing name gets the nearest Phosphor glyph, chosen by the lead | A |
| 09.12 | Keycap glyphs ↵ and ⇥ | Added to the Latin subset (about 0.2 KB) | A |
| 07.18 | Sheet and dialog titles | Sheets title3, centred dialogs title2 | A |
| 02.13 | Three privacy wordings | "Nothing leaves this device." (launcher), "Nothing is uploaded" (footer chip), "Kept on this device while the browser keeps it" (kept documents) | A |
| 02.20 | Turkish name for Library | "Kitaplık" | A |
| 01.16 | Restricted-lock honesty copy needs owner or legal review | No legal review: the copy states a fact and makes no claim; it goes through `tools/copy-check` in EN and TR and the owner sees it in the D1 build | C |
| 05.16 | "%" placement in Turkish | Zoom announcements and the pill use `formatPercent` ("%150"); a lint rule bans hand-built `{n} %` strings | A |
| 06.19 | Outline or Contents | X27 | C |
| 04.6 | "Extract" on the image bar | "Save image" (INV-15) | A |
| 07.14 | Destructive primaries | Secondary capsules with a danger label and glyph, never lime and never a red fill | A |
| 07.Q1 | Size preset names | Plain "Smaller · Smallest" with the estimate beside each (INV-18) | A |

### 6.7 Frame and layout

| Id | Item | Resolution | V |
|---|---|---|---|
| 01.1 | Order of ◆ and ▤ | Library, then sidebar, at every size | A |
| 01.2 | Title menu, tab menu and Lock popover | `01-frame` owns the title and tab menus; the popover is X4 | C |
| 01.3 | Title menu role | A non-modal dialog (Base UI Popover) containing one menu list | A |
| 01.4 | Rename | In the title-menu header; a double-click on a tab no longer renames; F2 and Rename… focus the field | A |
| 01.5 | Dock labels on narrow widths | Labels stack under icons when they do not fit beside them; if the dock still touches the pill, the pill rises above it | A |
| 01.6 | Pill and chip sizes; collisions | 36 / 44 px; the pill rises 8 px above any palette or bar it would touch | A |
| 01.7 | Compact-height sidebar | The top bar gets ▤ | A |
| 01.8 | Compact folding | ⓘ folds below 360 px; Redo moves into the title menu below 336 px (A-20's 320 px case); departs from flows' "on every width" (§6.17) | A |
| 01.9 | Soft scroll edge | 24 px; jumps land 24 px below the strip | A |
| 01.10 | Side sheets and the free rectangle | X23 | A |
| 01.11 | Undo and Redo in the Library | None in the Library strip; Mod+Z works; removals carry Undo toasts | A |
| 01.12 | Save colour | Never lime; a neutral capsule | A |
| 01.14 | Focus on touch | From the pill menu; a tap on the page leaves; the Esc ladder gains "leave Focus" after clearing the selection | A |
| 01.Q1 | Tab overflow | A "N more" menu (`TabOverflow.tsx`) by default; check six or more documents at 820 px | T·P |
| 01.Q3 | "Fit" or a percentage | Always the percentage; the pill menu marks "Fit width" as current | A |
| 01.Q4 | Dock always shown from medium up | Owner question 3; built as recommended | O |
| 01.Q5 | Find field width | Fixed 280 px (no strip layout work on focus) | A |
| 0031.1 | Sizes flows leaves open | L.1, L.2, L.4 | A |
| 0031.2 | The dock's taste check | Owner question 3 | O |
| 03.3 | Page pill in Markup | From expanded up beside the palette if it fits, else above its trailing end; hidden on medium and compact while Markup is open (Mod+G still works) | A |
| 05.13 | Compact note editor | A 40 % sheet above the keyboard; a row for in-page editors joins the placement matrix | A |
| 07.5 | New signature and Batch presentations | New signature: centred 520 sheet on fine pointers; Batch: centred 720 sheet from expanded up; departs from flows §6.9 | A |

### 6.8 Markup and tools

| Id | Item | Resolution | V |
|---|---|---|---|
| 03.1 | Shared element ownership | X1 | A |
| 03.2 | Palette wider than flows estimated | Fold by measured width in flows' order | A |
| 03.6 | Mark search matches | X22 | A |
| 03.7 | Saved-signature chips on medium and expanded | The options-tier slot (Select armed has no options); inline from large up | A |
| 03.9 | Phones under 384 px | Draw drops Eraser below 384 px, then Highlighter below 340 px; Sign drops T below 380 px | A |
| 05.6 | Created fields in Markup with Select | A click selects a created field; double-click or Enter fills it; source fields always fill | A |
| 05.9 | Field outlines | On while the Fill & sign door is open | A |
| 07.12 | A sheet and the armed tool | Opening a sheet disarms to Select so one lime shows per view; a tool sheet that draws on the page (crop) arms its own tool | A |
| 03.Q1 | Two or three inline signature chips at large | Three | T·P |
| 03.Q2 | Pen-seen ring on phones | Yes | T·D |
| 03.Q3 | Tablet throw to a side dock | Not in M9: bottom only; the rail exists for compact-height; "Move tool bar to" is an M11 candidate | A |
| 03.Q4 | Edit text stays armed after a commit | Stays armed; decided in the five-person test's session 2 on the D2 build | T·5 |

### 6.9 Bars, menus and gestures

| Id | Item | Resolution | V |
|---|---|---|---|
| 04.3 | Right-click on an image | The page menu gains an image group (Select image, Replace…, Save image, Delete image); the image bar shows once the image is selected; departs from flows §4.4 | A |
| 04.4 | Locked annotation without a comment | The Lock notice at the annotation | A |
| 04.5 | Delete keycap in the page menu | None there (Delete acts only on a visible selection, S10); the grid cell menu keeps it | A |
| 04.8 | Ownership | X1 (changed: the capsule is `03-markup`'s, not the frame's), X2, X21; the Library selection bar uses `ui/ContextBar`; `01-frame` publishes the free rectangle from `shell/frame/frame-insets.ts` for `place()` | C |
| 04.9 | Long-press threshold | 450 ms everywhere through X5 | A |
| 04.10 | Selection bar below the text on touch | Below, because the system edit menu cannot be suppressed above it; verified in S-T5 (X28) | C |
| 04.11 | Long press while a tool draws | A drawing pointer never long-presses; right-click, Shift+F10 and a finger once a pen has been seen still open the page menu | A |
| 04.12 | Pages bar in viewing | X21 | A |
| 05.12 | Double-click and smart zoom | Word selection in viewing, the editor door in Markup with Select; smart zoom (fit width ⇄ 250 %) only on a touch double tap. Once a pen has been seen, a pen double tap in Markup with Select writes like any pen stroke and never opens the editor (MK-18, S4); a pen acts as a mouse only while no pen has been seen (desktop tablets). `05-canvas` §6 gains the pen-seen row and §17.1 limits the double-click door to the mouse and an unseen pen | C |
| 06.3 | Explicit selection on touch in the sidebar | A long press released without moving opens the thumbnail menu with Select first; moving after the lift drags | A |
| 06.4 | Thumbnail menu | A row in `04-context` §14: the page menu's page group without "Add … here" and "Edit text here", plus Recognize text on this page, plus Select on coarse pointers | A |
| 09.5 | Tooltip ownership | X16 | A |
| 09.6 | Gesture core home | X5 | A |
| 04.Q1 | After Highlight, text or highlight selected | The new highlight stays selected so Comment reuses it (RA-6, F-10); DESIGN amendment B11 | A |
| 04.Q2 | Tablet tooltips cancel activation on long press | Keep; watch in the tablet session | T·5 |
| 04.Q3 | A 700 px flat page menu on coarse pointers | Flat (RA-21); fold "Add … here ▸" only if it exceeds an 820 px tablet's viewport | T·D |

### 6.10 Canvas and editors

| Id | Item | Resolution | V |
|---|---|---|---|
| 05.1 | Form accessory, page scrubber, popovers | The form accessory is `04-context` §8, fed by 05; the trailing page scrubber stays in `05-canvas` §5; link and paragraph info popovers X15 | A |
| 05.4 | Alt+arrows on macOS | In caret mode the text convention wins (word jump); page moves keep Alt+arrows wherever no caret is active | A |
| 05.5 | Tool sheets inset the free rectangle | X23 | A |
| 05.7 | Links in the hit order | After form widgets; a drag past the slop that starts on a link selects text and does not follow it | A |
| 05.15 | Rename `ReadView` | X25 | A |
| 05.17 | F6 and the page region | X9 | A |
| 05.Q1 | Handle shape | Circles; sizes and hit areas unchanged either way | T·P |
| 05.Q2 | 15 % pinch-to-grid and 250 % double tap | Built as stated; frozen after S-T1 to S-T4 | T·D |
| 05.Q3 | Field outlines by default for forms | Only with Fill & sign open or "Show field outlines"; decided in the five-person test's session 2 on the D2 build | T·5 |
| 05.Q4 | A hint on the first Enter on a page | No visual hint: the announcement and the shortcuts overlay | A |
| 05.Q5 | Magnified field editor threshold | 16 px everywhere in M9 (iOS's zoom rule); the device run may lower Android and desktop touch to 13 px | T·D |

### 6.11 Navigation, Pages grid and Compare

| Id | Item | Resolution | V |
|---|---|---|---|
| 06.1 | Sidebar in the grid | The Pages section hides in the grid and returns after; Contents, Find or Review stay and their jumps focus cells; ▤ stays enabled | A |
| 06.2 | Arrow keys in the thumbnail list | Navigate the page view (as a click); Space and Shift+arrows select | A |
| 06.5 | Click and tap in the grid | A click replaces the selection; a tap toggles it | A |
| 06.6 | Phone Pages sheet | A tap selects at both detents; double tap opens the page; Contents and Review rows lower the sheet to 40 % | A |
| 06.9 | Library → Pages with a subset checked | Scope All open with the unchecked sections collapsed; `02-library` L6 matches | A |
| 06.10 | Hover rotate and delete on cells | Removed (baseline V10); the Pages bar and cell menu cover them | A |
| 06.11 | Two drag paths | Pragmatic drag and drop for mouse and OS files, a pointer path for touch and pen; unify only if S-T4 allows | A |
| 06.12 | Review marks lose partial apply | Accepted: the pending-marks bar applies every mark; unwanted marks are deleted first (J/K steps through them); re-homings as listed | A |
| 06.13 | Static Review filter chips | The four content filters always show, zero counts included; Words to check appears after OCR has run (X33) | C |
| 06.14 | Overlay opacity | A tier above the Compare bar (400 × 40, σ 8); `04-context` §11 drops it from ⋯ | A |
| 06.15 | Compare failure | A toast with Try again; the bar shows Run again | A |
| 06.16 | Page map strip | Removed; the Changes list's headings and J/K cover it | A |
| 06.18 | Sidebar width | Default 280, resizable 240–400, kept per device; the overlay stays 320 and fixed | A |
| 06.20 | One Find field | From 1280 px the strip holds the field and the sidebar's Find section shows none; below, the section has its own; one query | A |
| 06.22 | Rename `Arrange*` | X25 | A |
| 06.23 | Keys in Compare | `1` closes Compare, `0` goes to the Library, `3` opens the origin document's grid, `4` does nothing | A |
| 06.24 | Toasts for moves | None inside a document; an Undo toast for a move to another document | A |
| 06.25 | `4` with exactly two documents | Compares them with the active one as B | A |
| 06.Q1 | Thumbnail arrows live or on Enter | Live, as Preview | A |
| 06.Q2 | Dock Pages on phones | Opens the sheet at 92 % (the grid) | T·P |
| 06.Q4 | Badges on grid cells | None in M9; Review filters cover comments and fields | A |
| 06.Q5 | Marking where each Combine source starts | Yes, cheaply: a divider before each source's first page, for the session, beside the "Sources:" line | A |

### 6.12 Sheets

| Id | Item | Resolution | V |
|---|---|---|---|
| 07.4 | F6 and sheets | X9 | A |
| 07.6 | Web Share needs the press | Share pre-assembles the copy 600 ms after settings settle; if not ready, the press shows progress and a second press shares | A |
| 07.7 | Empty file after a failed verification (Chromium, picker first) | Abort the write and call `remove()` where it exists; otherwise the toast says so | A |
| 07.8 | Settings beyond flows §9.5 | Accepted: search field, Name on comments, Show tips and facts again, Saved signatures as a pushed page, "Follow the browser" language | A |
| 07.9 | Ownership claims | Find sensitive data (S20), Extract pages (S16), Combine with open documents (S15), the Revert and Clear confirmations are `07-sheets`' | A |
| 07.11 | Fit while a tool sheet is open | X23 | A |
| 07.16 | Enter submits | From single-line fields, radios and segments; never Mod+Enter | A |
| 07 §25 | Go to page dialog and About dialog | Removed: the page pill and Mod+G; Settings → About Recto | A |
| 07.Q2 | Settings on desktop | One grouped scroll in a 480 px side sheet with pushed pages | T·P |
| 07.Q4 | Batch under 600 px | Dimmed with "Needs a wider window" (RA-21) | A |

### 6.13 Feedback and ⌘K

| Id | Item | Resolution | V |
|---|---|---|---|
| 08.1 | Family numbers collide | X3 | A |
| 08.2 | Two scrubber specs | X2 | A |
| 08.4 | Scrim behind ⌘K | None; it floats like an M4 menu and an invisible backdrop closes it | A |
| 08.5 | Persistent toasts vs the cap of three | Timed toasts are evicted first; persistent ones wait behind "+N waiting" | A |
| 08.6 | Base UI Toast conflicts | X14 | C |
| 08.7 | Assertive failures | Only storage full, engine stopped and an unsaved stroke; a failed Save is polite | A |
| 08.10 | ⌘K recents | Per device in `pdf-editor:palette-recents:v1`, ids only | A |
| 08.12 | A "What happened" sheet | `07-sheets`' one result page | A |
| 08.Q1 | Info toast length for Turkish | 4 s plus 1 s per 30 characters beyond 60, capped at 8 s | A |
| 08.Q2 | A bare number goes to that page | Kept; "Go to page N" first, commands with the number below | A |
| 08.Q3 | Toast order | Newest nearest the dock | T·P |
| 08.Q4 | +15 boost for selection actions | Kept; ranking unit tests on a fixed EN and TR query list | A |
| 08.Q5 | Haptic tick on sheet detents | Off by default (haptics on success, failure and lift only) | T·D |

### 6.14 Library and first run

| Id | Item | Resolution | V |
|---|---|---|---|
| 02.9 | Combine order | Card order of the checked cards | A |
| 02.11 | Static selection bar | Compare and Combine always present, dimmed with a reason; flows' "exactly two" is the enabling condition | A |
| 02.12 | Right-click on a card; Library keys | Right-click enters Select; F2 renames and Alt+Left/Right reorder join key map v2 | A |
| 02.14 | Sample size and precache | Two files (EN, TR), ≤ 125 KB each; `globPatterns` adds `sample/*.pdf`; the sample joins Recents only once changed | A |
| 02.17 | Phone selection count | The count moves into the Library head; the bar holds four labelled icons | A |
| 02.18 | Library ⋯ | Try the sample · Combine files… · Batch… · Settings… · Keyboard shortcuts (fine pointer) · About Recto | A |
| 02.19 | Dropping 2+ files | On a document: open as tabs, stay, toast "Opened 3 files · Show in Library"; on the Library: the new cards are selected | A |
| 02.Q1 | Recents thumbnails | Yes for rows with a snapshot: 32 × 40, rendered on demand from the kept bytes when visible; others keep the glyph (D4) | A |
| 02.Q2 | Tag dot beside the edited ● | Kept: a tag is the person's own label, ● is state | A |
| 02.Q3 | Batch on the empty launcher | Only in the ⋯ menu: the launcher keeps three actions and one lime | A |

### 6.15 Accessibility, CI and tooling

| Id | Item | Resolution | V |
|---|---|---|---|
| 0028.1 | Matrix CI time | Pull requests touching `styles/`, `ui/`, `shell/`, `motion/`, `light/` or the message catalogs run the full matrix; others run default and plain in EN and TR, dark and light; every merge to `develop` runs everything; D3-9 measures the time and may split shards | A |
| 0028.2 | Secondary text APCA 60 as a gate | Stays a warning in M9 (lifting the grey to about `#b0b4ba` flattens the hierarchy); the lead revisits after the five-person test; not an owner question | A |
| 01.15 | Research 22's A-12 still says "chrome never auto-hides" | The gate's wording is ADR-0028's and `language.md` §9.1's (compact hide on scroll with its safeguards); research documents stay as written | C |
| 09.4 | Sheet and Toast owners | X17 | A |
| 09.7 | Re-checked counts | Used for sizing: 77 `outline-offset` declarations in 44 files (67 in focus rules); `.secondary` in 12 modules; 129 `<input>`, 17 `<select>`, 5 `<textarea>`; `lucide-react` 97 names in 59 files | A |
| 09.11 | Harness as a second Vite entry | A separate Vite config (`apps/web/harness/vite.config.ts`) served on its own port, so the app Playwright tests is byte-identical to the deploy build | C |
| 09.Q2 | Keycaps on coarse pointers after a hardware keyboard | Shown for the device once a hardware keyboard is used (remembered per device) | A |
| 09.Q4 | Number-field scrub on the label | Opt-in per caller | A |
| L.5 | ADR count in flows §14 | §0 and §6.16 | A |
| 01.Q2 | Is the changes dot read as "at risk" | The header's status line explains it | T·5 |

### 6.16 Lines for the lead to apply at merge

**Applied on 2026-10-04.** Every line below is now in its source document, together with the
lines the review of this plan added (X29–X36 and the rows marked "review"); the sources say so in
their changelogs or with "spec" references. The table stays as the record of what changed where.

| Document | Line |
|---|---|
| `flows.md` | §14: the ADR mapping of §0; §0, §2.1, §4.6, §4.7, §9.3, §9.4, §10: "Contents" (X27); §2.5: `place` for a placing tool's click and Add field, rename a `document` act (X34, X12); §2.6: Save allowed while locked (0032.3); §4.3, §6.2: no tablet throw or side dock in M9 (03.Q3); §4.4, §4.7: image right-click and "Save image" (04.3, 04.6); §5.2: edit blobs in the snapshot (review); §5.3: Redo below 336 px (01.8); §5.4: one unapplied-marks ask (07.10); §6.1, §6.9: short viewports (X30); §6.9: rows for in-page editors (05.13), New signature and Batch (07.5); §7.2: F6 order (X9), Compare keys (06.23), F2 and Alt+Left/Right in the Library (02.12), Alt+arrows in caret mode (05.4); §8.1, §8.2, §0: J16 keyboard ≈5 and the total 81 (07.16); §9.3: facts chip 10 s (A-24); §10: Review's Words to check (X33); §12: five drops, D0–D4; §15 Q1: what unlocked lets through (review) |
| `language.md` | §1.1 "on states of tools" (09.1), §1.5 redaction and crop tokens (05.3); §2.2, §2.9 σ steps and registry rows (X6, 02.4, 03.8, 06.21, L.6, X30); §2.5 light twin and coarse σ (02.3); §2.7, §7.3, §11.3 lens (X20); §2.8 the CI render override (X36); §2.9 one filter per toast stack (X35); §2.10, §9.1 `--control-border` (X7); §3.1–§3.3 `textSafe`, thumbnail exemption, no drift on Combine, the under-light's A-6 exception (02.1, 02.2, 02.21); §3.4, §7.3, §7.5 reduced light responses ≤ 150 ms and progress under A-9's exemption; §5.1 lime-800 duotone (08.11); §7.3 *sheet push*, fold, find step, large press (X8, 02.5, 02.6, 05.2); §7.3, §7.4 undo reveal and sheen 500 ms (A-10); §9.1 A-6, A-11, A-20 |
| ADR-0022 | §2.2 principle 2: Library thumbnails exempt from the 64 px rule, pixel test kept (02.1) |
| ADR-0024 | Refraction on fixed-size M1 chips only (X20); X6's σ steps; item 8: the top strip and compact top bar glass on every pointer (review); item 4: the CI render override (X36) |
| ADR-0025 | §2 items 4 and 6: no drift on Combine (02.21), `textSafe` (02.2), the Library-thumbnail exemption (02.1), Still cross-fades ≤ 150 ms |
| ADR-0026 | §2 item 6: motion on or under glass ≤ 500 ms (A-10) |
| ADR-0028 | §2.1 the CI render override (X36); §2.5 amendments to A-6, A-9, A-11 and A-18; §3: three per-file `matchMedia` checks |
| ADR-0029 | §3: keyboard total 81 (07.16) |
| ADR-0030 | §2 items 2 and 8: Add field and a placing tool's click are `place` (X34) |
| ADR-0031 | §2.4–§2.6: Contents (X27), Words to check (X33); §2.13: facts chip 10 s; §3: three touch projects, other sizes as viewports; §5.3: facts-seen clearing (02.15) |
| ADR-0032 | §2.1: one unapplied-marks ask (07.10); §2.4: edit blobs in the snapshot (review) |
| `01-frame` | §2 short viewports (X30); §6, §15: `lock/` (X4), `dock-shape.ts` into `capsule-morph.ts` (X1); §6 name field `document` (X31), Pages row acts (X32); §9 the ◎ button only (X29); §12 Contents (X27); §14 drop of two or more files (02.19); §15 F6 order (X9) |
| `02-library` | L11: `pdf-editor:facts-seen:v1` (X26) and its clearing (02.15); rest 10 s (A-24); Contents (X27); fold flash 500 ms |
| `03-markup` | §2.3: Select armed is a fill glyph on `--surface-on`, no lime (X19) |
| `04-context` | §2.3 recogniser in `motion/gesture/` (X5); §10, §11 (X1, 06.14); §14 catalogue rows (02.12, 01.2, 12.14, X27); §15 (X15); §17 owns the privacy popover (X29); §18 pointer (X2); §22 #8 (X1), #10 S-T5 (X28) |
| `05-canvas` | §4 recogniser in `motion/gesture/` (X5); §6 pen-seen row and `place` for placing clicks (05.12, X34); §11 undo reveal 500 ms; §17.1 the double-click door (05.12) |
| `06-navigation` | N1, N3, N6 and elsewhere: Contents (X27); N5 Words to check (X33); PG3 rename asks `document` (X31); thumbnail drop ring 500 ms |
| `07-sheets` | §2 S0 `--control-border` (X7); §4 S2 the unapplied-marks ask (07.10); §12 S10 Review's Words to check (X33); §16 S14 guard none (07.13, X32); §27 #2, #10, #13 resolved |
| `08-feedback` | §5 FB4: own region (X14), one filter per stack (X35); §17 #6 changed |
| `09-primitives` | §28: a separate Vite config (09.11) |
| `docs/brand/README.md` | §4.1 and §11 decision 3: one lime settled by ADR-0023, no P3 variant, lime-800 `#446713`; §6: Library button 20 px, launcher 48 px, Settings → About Recto (no About dialog); §7 item 2 nouns; §8 items 5–7; §9 items 7 (70 frames) and 9, the version 2 line, and §11 phase 4: "after M9 D4" (phones are in M9) |
| `docs/ROADMAP.md`, `docs/DESIGN.md`, `docs/DISCUSSION.md` | M9 packages and drops as §11–§12, the brand track, M11 candidates; DESIGN §10: amendments applied together by D4-9; DISCUSSION #33 question 6 |

### 6.17 Where this spec departs from `flows.md` and `language.md`

| Source | Says | This spec | Why |
|---|---|---|---|
| flows §2.6 | Lock keeps Save a copy | Save also stays allowed | It writes the document unchanged (0032.3) |
| flows §2.6, §3.5, §15 Q1 | The locked default is stricter in page structure | Also in whole-document operations | ADR-0030's `document` act (0029.1) |
| flows §4.4 | Right-click on an image opens the image bar | The page menu with an image group | A scanned page is one image (04.3) |
| flows §4.4, §4.7 | The image bar's "Extract" | "Save image" | Extract means a new document elsewhere (04.6) |
| flows §4.3, §6.2 | On tablets a drag throws the palette to an edge; a side dock insets the column | Bottom only in M9; "Move tool bar to" is an M11 candidate | 03.Q3 |
| flows §6.1, A-20 | At 320 × 256 the compact layout holds | Short viewports fold the top bar into the dock | Chrome ≤ 25 % (X30) |
| flows §8.1, §8.2 | J16 keyboard ≈6 | ≈5; total 81 | Enter submits from radios and segments (07.16) |
| flows §12 | Four drops | Five, D0–D4 | The Library and presentation are their own drop (§12) |
| flows §10 | OCR → "a Review filter" | Words to check, shown after OCR | Review had no OCR kind (X33) |
| flows §5.3, §6.1 | Undo and Redo on every width | Redo folds into the title menu below 336 px | A-20 at 320 px (01.8) |
| flows §5.4 and `07-sheets` | Save asks; Save a copy blocks | One ask for both, Apply by default | One rule (07.10) |
| flows §2.1, §4.6 | "Outline" | "Contents" | One reader's word (X27) |
| flows §6.9 | Every task sheet a side sheet from expanded | New signature centred 520; Batch centred 720 | Pad width; two panes (07.5) |
| flows §7.2 | F6 order without sheets; Compare keys only Esc | X9; 06.23 | Every floating surface in the cycle (A-13) |
| flows §10 | Interleave unchanged | Interleave keeps its sources | One outcome (07.13) |
| `language.md` §2.7, §11.3 | Lens on the dock and palette | Lens on fixed-size M1 chips only | Rest rule and morph (X20) |
| `language.md` §2.2, §2.9 | M5 σ 48, M4 σ 16 floor, M2 σ 8–10 | New σ steps | Coverage (X6) |
| `language.md` §2.10 | Wells with `--border-strong` | `--control-border` | WCAG 1.4.11 (X7) |
| `language.md` §1.1 | "On states" under lime | Neutral on-states for controls | One lime per view (09.1) |
| `language.md` §3.2 | Nothing within 64 px of a page | Library thumbnails exempt, pixel test kept | Lit cards (02.1) |
| `language.md` §3.2 | Combine drifts 2 s | No drift on Combine | It leaves the Library (02.21) |
| `language.md` §7.3 | No *sheet push*, *fold*, find step | Added | X8, 02.6, 05.2 |
| `language.md` §7.3, §7.4 | Undo reveal and sheen 600 ms; motion on glass ≤ 600 ms | 500 ms | A-10's limit |
| `language.md` §3.4, §7.5 | Light responses ≤ 200 ms under reduced motion | ≤ 150 ms | A-9's limit |

## 7. Model and engine changes

Additive; persisted keys versioned and validated field by field, as in M8. **Packages** first,
then the app's state.

| Package · file | Change | Why | WP |
|---|---|---|---|
| `packages/document-model/src/types.ts`, `history.ts` | `HistoryEntry.meta?: { documentId: DocumentId; page?: number }`; `pushHistory(…, { meta })`; `historyEntries` returns it | Scrubber rows, "Undid … in agreement.pdf" (X10) | D0-6 |
| `packages/document-model/src/serialize.ts` | `serializeHistoryTail(history, n)` and `deserializeHistoryTail`: a new `SerializedHistoryV1 { version: 1; documents; entries }` that stores each structurally shared document once and entries by reference; `SerializedWorkspaceV1` unchanged | Restore with the last 20 steps (ADR-0032) | D0-7 |
| `packages/document-model/src/selectors.ts` | `sourcePagesShownBy(ws, id)` and `documentsSharingSource(ws, sourceId, pageIndex)` | `commit()`'s engine-edit check and the shared-page message (X11) | D1-3 |
| `packages/document-model/src/pages.ts` | `interleave(…, { keepSources })`: the result is a new document after the last source; the default stays as today for recipes | One outcome (07.13) | D2-5 |
| `packages/document-model/src/workspace.ts` | None: `markDocumentClean` and `VirtualDocument.clean` stay, unused by the app (a removal is a breaking change for later) | X13 | — |
| `packages/engine` | None required. Gate 0, if it renames, touches the `/Producer` string in `src/pdflib/metadata.ts` | brand plan §1.3 | D4-8 |
| Copy-on-write sources | Not in M9; a later model ADR | X11 | — |

```ts
// state/ui-store.ts (persisted 'pdf-editor:ui:v3'; leftPanelOpen not migrated, 06.17)
type Destination = 'home' | 'document' | 'compare';
type Surface = 'page' | 'grid';
interface DocumentUi { surface: Surface; markup: boolean; paletteSet: 'draw' | 'sign' }
docUi: Readonly<Record<DocumentId, DocumentUi>>;   // viewMode, documentMode, lastView removed
gridScope: 'document' | 'all'; sidebar: { open: boolean; section: 'pages' | 'find' | 'review'; width: number };
chromeHidden: boolean; focusMode: boolean;
// state/lock-store.ts (new; session, and in the snapshot)
locks: Readonly<Record<DocumentId, 'user' | 'signed' | 'restricted' | 'default'>>;
// state/guard.ts (new)
type Act = 'targeted' | 'freehand' | 'place' | 'text' | 'pages' | 'document';
function canChange(id: DocumentId | null | undefined, act: Act): boolean;  // + useCanChange
// state/saved-store.ts (new, X13): Record<DocumentId, { entryAt: number; handleKept: boolean }>
// state/input-policy-store.ts (renamed from edit-policy-store.ts; penDrawsInEdit migrated once)
penDrawsInMarkup: 'auto' | boolean; penWritesWithoutMarkup: boolean; drawWithFinger: 'auto' | boolean;
openDocumentsLocked: boolean;  // owner question 1; default false as recommended
keepToolsVisible: boolean;
// state/appearance-store.ts: theme, glass, light, motion, haptics (glassPanels and
// reduceTransparency migrated once, language.md §10.3)
// commands/registry.ts: every committing command declares { act }, plus reason, args, selection, icon
// session/ (OPFS 'pdf-editor-session/'): workspace, history tail, source bytes, every edit blob
//   (useWorkspaceStore.editBlobs) the workspace or the tail refers to, content-addressed and
//   written once, restored with putEditBlob before any replay (ADR-0032 §2.4); per document
//   { page, zoom, surface, sidebar, lock }, destination and active document (02.7); never Markup
// IndexedDB: 'pdf-editor:signatures:v1' (≤ 5), 'pdf-editor:facts-seen:v1'; localStorage
//   'pdf-editor:palette-recents:v1' (ids only)
```

`workspace-store.ts` `commit()` gains the Lock check of ADR-0030 with X12's rule; the edit
runner asks `canChange` before an engine edit and replays its inverse if `commit()` refuses.
Counts to migrate (flows §2.4): `viewMode` 85 references in 37 files, `documentMode*` 48 in 17,
`canEdit*` 49 in 14.

## 8. Accessibility

A-1 to A-24 (research 22 §13, `language.md` §9.1, ADR-0028) are CI gates: a rule without a
test counts as not met. Each becomes **blocking** in the drop that first ships what it guards;
before that it runs as a warning.

| Gates | Proves | Where tested | Blocking from |
|---|---|---|---|
| A-2 (model), A-3 on the page, A-11 (model) | Coverage term for every surface on `.glass`, `.glass-menu` or `.glass-frame`; `--select` ≥ 3:1 on white and both tints; the two-band ring's bands ≥ 9:1 | `tokens.test.ts`, `focus-scan.test.ts` | D0 |
| A-13, A-14, A-15, A-24 | F6 reaches every floating surface; one announcer; 24 / 44 px targets; toasts ≥ 10 s and paused | `a11y.spec.ts`, browser-mode suites | D0 (sheets, toasts) |
| A-12, A-20, A-21 | Focus never under chrome (rest rule); 320 × 256 and 360 × 640 without overflow, chrome ≤ 25 %; Turkish and 1.4.12 spacing | `frame-layout.spec.ts`, `rest-rule.spec.ts`, `a11y.spec.ts` | D2 |
| A-1, A-2 (rendered), A-3, A-4, A-5, A-6, A-11 (rendered) | Rendered contrast in three engines plus `chromium-nogpu`; APCA primary ≥ 75; text never on bare light; light never on pages (A-6's Library-thumbnail clause blocks from D4, when lit cards ship; 02.1); two-band ring over the listed backdrops | `glass-pixels.spec.ts`, `tokens.test.ts` | D3 (Library thumbnails D4) |
| A-7, A-8, A-9, A-10, A-23 | Pauses; no flash; reduced motion per token; transition limits; effects never cost input | `motion.spec.ts` | D3 |
| A-16, A-17, A-18, A-19 | Forced colours; Glass Clear · Tinted · Solid; more contrast; colour never alone (Machado matrices) | `a11y.spec.ts`, `tokens.test.ts`, `palette.test.ts` | D3 |
| A-22 | Every effect has a solid twin: the whole a11y suite in the "plain" project | `a11y.spec.ts` (plain) | D3 |

**Matrix scope** (ADR-0028): {default, Solid, more contrast, forced colours} × {EN, TR} × {dark,
light}, 16 combinations, over the states each family lists in its test plan (Library, viewing,
title menu, pill menu, Lock popover, palette open with a tool armed, each contextual bar, page
menu, caret mode, open paragraph editor, sidebar sections, grid in both scopes, Compare, every
sheet presentation, ⌘K, toast stack, scrubber, phone with bars hidden), plus the plain project.
Until D3 ships the light theme, the matrix runs dark only. CI budget: 0028.1. **Manual, once per
drop from D2:** VoiceOver (macOS, iPadOS) and NVDA through open → read → mark up → save; a
Windows contrast theme. Secondary-text APCA stays a warning (0028.2).

## 9. Performance

### 9.1 Budgets

| Area | Budget | Source | Test |
|---|---|---|---|
| Blurred surfaces, persistent + transient | Compact 2 + 1 · medium 3 + 1 · expanded 5 + 2 · large and xlarge 6 + 2; a toast stack counts as one (X35); short viewports keep one persistent (X30) | `language.md` §2.9 | `frame-layout.spec.ts` counts, including Highlight on a phone (toast plus the selected highlight's bar) |
| Persistent glass area over moving content | ≤ 25 % compact and medium, ≤ 32 % from expanded (50 % hard ceiling with sidebar and side sheet) | §2.9, A-20 | same |
| Blur | c ≥ 0.985 per registered size; never animated; no `will-change: backdrop-filter`; one filtered element per stack | A-2, §2.9 | `tokens.test.ts`, pixels |
| Lenses | 0 on compact and medium; ≤ 3 from expanded, on fixed-size M1 chips only | X20 | `frame-layout.spec.ts` |
| At rest | Zero animation frames in a document view | A-7, principle 5 | `motion.spec.ts` |
| Morphs and gestures | Zero layouts during the bar morph, hide on scroll and pinch | `language.md` §7.4 | `motion.spec.ts` |
| View transitions | 240 ms, user-initiated view changes only; update callback < 50 ms | A-10, §7.4 | `motion.spec.ts` |
| Cost ladder | Steps when > 25 % of frames exceed 20 ms in 2 s; low-memory devices start at step 2 | §2.8 | unit + `glass-perf.spec.ts` trend |
| Light | ≤ 4 KB gzip, lazy; backing store ≤ 100 KB; shader ≤ 0.5 ms per frame on a 2020 iGPU at DPR 2; ≤ 0.3 ms main thread; energy Auto ≤ 1.1 × Still, drift ≤ 1.3 ×; Library mean Y ≤ 0.03 | §3.5 | unit; OM4 |
| Motion core | < 3 KB gzip | §7.4 | size check |
| Fonts | 98 KB (Latin 73.4 + Turkish 24.6), replacing 130 KB plus 54 KB of mono | §4.1 | size check |
| Icons | About 18 KB gzip of generated paths; `lucide-react` removed | research 20; `09-primitives` §30 | size check |
| Sample | ≤ 250 KB, precached | 02.14 | build check |
| About page | ≤ 300 KB without video | presentation spec §3 | `about.spec.ts` |
| Snapshots | Written within 2 s of each history step and on `visibilitychange: hidden`; ≤ 8 ms main-thread time per write, serialisation in a worker above 1 MB of changes **(judgement)** | ADR-0032 | `session.spec.ts` |
| Pen | M8 targets kept: preview ≤ 1 frame, committed stroke visible ≤ 50 ms, no long task in a 64-path burst; the capsule's stroke fade costs no layout | ROADMAP M8; `qa/ink-latency-baseline.md` | `ink-latency.spec.ts` |
| Initial JS | ≤ 10 % more gzip than M8's build at D3 exit **(judgement)** | — | build size report |
| Phones | ≥ 58 fps with no dropped frame in a 2 s fling at the chosen blur | research 19 S-T2 | OM5 |

### 9.2 Measurements only the owner can run

Headless Chromium uses a software compositor; these need the owner's machines. Each has a
default that ships if it is not run.

| # | Check | How | Decides | Default if not run |
|---|---|---|---|---|
| OM1 | S2 glass frames | Research 14 §3 and §11 on Chrome with a GPU and on Safari: M3 sidebar and strip as glass over scrolling pages, **plus the floating dock and the palette with the under-light** (0024.2) | Docked glass by default on fine pointers (ADR-0024) | Docked M3 ships as glass on fine pointers (ADR-0024 item 8); the cost ladder's step 3 makes it solid at run time on a slow device |
| OM2 | Edge-leak probe | Research 22 §3.2 one-page probe, Chrome GPU and Safari, one minute | Whether the coverage rule binds on GPU paths too | The rule stays (conservative) |
| OM3 | Safari `var()` check | Does `-webkit-backdrop-filter` accept `var()` (research 16 G-22)? | Whether literal values are required | Literals everywhere, as planned |
| OM4 | Aurora banding, energy, drift | Research 17 §11 on the D4-1 build (the launcher and its field exist from then): banding on the owner's display, 10 minutes of energy, drift at 15 against 30 fps | Drift frame rate; intensity on the empty Library | 15 fps; I 0.45; glide to still after 60 s |
| OM5 | Phone and tablet run | An iPhone (iOS 26), a mid-range Android phone, an iPad with a pen, an Android tablet: S-T1 pinch ownership, S-T2 glass on phones (blur 12, 20, 28), S-T3 memory (200-page scan), S-T4 drag from a long press, S-T5 selection bar against the system edit menu (X28); also 05.Q2, 05.Q5, 03.Q2, 04.Q3, 08.Q5, the iPad keyboard pointer | Touch thresholds, phone blur, the drag path | Built as specified; touch defaults are marked provisional in the as-built notes |
| OM6 | M8 carry-over | Pen latency on the owner's laptop and the mouse and tablet try-out (ROADMAP M8) | Confirms M8's ink targets under the new shell | — |

## 10. Tests and acceptance

### 10.1 Unit and component

| Area | Tests |
|---|---|
| Model and guard | `guard.test.ts` (every act × lock reason, unknown ids fail closed; a case for each rename entry point, X31); registry coverage (a committing command without `act` fails); `commit()` lock check including X12; locked engine bytes unchanged for every act; `serializeHistoryTail` round trip and size; `HistoryEntry.meta` |
| State migration | `ui:v2` → `v3`; `edit-policy` → `input-policy`; `glassPanels`/`reduceTransparency` → Glass; `isPageView()` replacing the 22 comparison sites |
| Frame and layout | Size classes; free insets; label fit; tab overflow; hide-on-scroll reducer; regions order (X9) |
| Tokens and materials | `tokens.test.ts`: both themes, settings blocks identical, coverage registry, APCA gate, colour pairs, focus bands, `--control-border`; `focus-scan.test.ts`; `palette.test.ts` with CVD matrices |
| Feedback | Toast queue and eviction; announcer timing; ⌘K parser EN/TR; ranking list; light state machine |
| Canvas | `hit-order`, `zoom-controller`, `caret`, `placement`, `free-rect`, `selection-frame`, `editor-header` |

### 10.2 Browser mode

Real layout and focus: roving tabindex in the dock and palette; the morph keeps one node; tier on
arming; title menu focus and switch; Lock popover anchored at the asker; sidebar APG tabs and
listbox; grid enter and leave focus; Sheet presentations per class; toast F6 and Esc; scrubber
keys; zoom commit anchor; side-sheet re-centring; caret DOM `Selection` sync.

### 10.3 End to end

New Playwright projects: `phone` (390 × 844, touch) and `phone-land` (844 × 390), which run the
compact edition (ADR-0033), `tablet` (820 × 1180, touch, the full edition), `chromium-nogpu`, and `plain` (Solid, reduced motion, light off). Pixel specs are
tagged `@pixels`. The rendered-pixel harness has its own Vite config (09.11). Expanded (1180 ×
820), xlarge (1920 × 1080) and 320 × 256 run as viewports inside `frame-layout.spec.ts` (ADR-0031
§3). The default, pixel, motion and matrix projects run with the test-only render override of
X36; one spec without it checks the software-rasteriser start states.

| Spec | Change | WP |
|---|---|---|
| `modes.spec.ts`, `tools.spec.ts` | Replaced by `markup.spec.ts` (J6, J8A, J10, Esc ladder, `2` alias) and `input-rules.spec.ts` (S1–S18, both lock defaults) | D1-QA, D2-QA |
| `a11y.spec.ts` | The matrix, the plain project, new surfaces; group loops removed | each drop |
| `light-table.spec.ts` | Becomes `pages-grid.spec.ts` (J4, drop on a tab, pinch in and out, locked drag refused) | D2-QA |
| `home.spec.ts` | Becomes `library.spec.ts` (launcher, cards, Combine without a dialog, Recents with snapshots, sample, `?sample`) | D4 |
| `compare.spec.ts` | Compare as a place, chooser, keys of 06.23, compact switch | D2-QA |
| `export.spec.ts` | Becomes `save.spec.ts` (Save in place, Replace, verify, download fallback) and `save-copy.spec.ts` (J13B) | D0-QA |
| `viewer.spec.ts`, `resize.spec.ts`, `crop.spec.ts`, `furniture.spec.ts`, `document-tools.spec.ts`, `convert.spec.ts`, `batch.spec.ts`, `ocr.spec.ts` | Status bar, layout switch and dialogs gone; sheets and the pill instead; key presses `0`–`4` per key map v2 | D0–D2 |
| `annotations.spec.ts`, `forms.spec.ts`, `redaction.spec.ts`, `signatures.spec.ts`, `pen.spec.ts`, `image-objects.spec.ts` | No Edit step for targeted acts; pending-marks bar; saved signatures; Markup for the pen | D1-QA, D2-QA |
| `text-edit.spec.ts`, `paragraph-edit.spec.ts` | The doors: E then Enter, double-click only in Markup with Select | D1-QA |
| `outline.spec.ts`, `outline-i18n.spec.ts` | Sidebar Contents (X27) | D2-QA |
| `glass-perf.spec.ts` | Extended to the dock, palette and docked M3 (OM1's headless trend) | D3 |
| `offline.spec.ts`, `smoke.spec.ts`, `about.spec.ts` | Sample precache; new shell; About v2 | D4 |
| New | `frame-layout`, `rest-rule`, `keyboard-text`, `sheets`, `session`, `jobs` (every row of flows §8.2 at its M9 count), `glass-pixels`, `motion` | as listed in §11 |
| `helpers.ts` | `enterEdit` keeps working through `2` | D1 |

### 10.4 The five-person test

Two sessions, five people who have not used Recto each time, at large desktop size, one also on a
tablet; think aloud; the lead observes. **Session 1**, on the D1 build (unlocked default), before
owner question 1 is closed and before D2 freezes (§12): copy a word by double-click (S3); fill a
form with a checkbox (S7); highlight a sentence and comment on it, then type a letter with a
selection still active (S9); say what the tab's ● means (01.Q2); on the tablet, long-press a
control for its tooltip (04.Q2). **Session 2**, on the D2 build before D2-QA closes (so before
D3 starts), because these tasks need D2's palette, Fill & sign door and Compare place: fix a word
with E then Enter, then leave the editor (03.Q4); find a form's fields (05.Q3); compare two
versions (06.Q3). **Decision rule:** if two or more of five make a change
they do not notice in S7 or S9, the lead recommends the locked default (or a checkbox that needs
focus first) to the owner; if two or more cannot leave the editor, Edit text disarms after a
commit; each other item keeps its default unless two or more stumble.

### 10.5 Acceptance (M9 exit)

Every drop's exit (§12) met; flows §8.2's step counts proved by `jobs.spec.ts` in Chromium and the
tablet project (the phone projects prove the compact edition's reading jobs); A-1 to A-24 blocking and green in three engines plus `chromium-nogpu` and `plain`;
the budgets of §9.1 met on CI; the five-person test recorded and its decisions applied; OM1–OM5
run or their defaults recorded; an independent review per drop finds no blocker; DESIGN, ROADMAP
and this spec's §15 written.

## 11. Work packages

Sizes: **S** ≤ 2 days · **M** ≤ 1–2 weeks · **L** > 2 weeks. Files are the main ones; each
family's implementation table (§5) has the full list. Rules as in M4–M8: one implementer per
package, no edits outside owned paths (shared stores take additive edits merged by the lead),
the lead commits, every review finding gets a test.

### 11.1 D0: independent of the redesign (lands on the M8 shell)

| Id | Scope | Files | Depends on | Size | Acceptance |
|---|---|---|---|---|---|
| D0-1 | The quality-bar walker and registry (Q-1, Q-3, Q-4, Q-11, Q-12: no grain or raster texture, one backdrop root, no glass in glass, surface count) over every `.glass*` surface, plus the pre-redesign accessibility fixes (`09-primitives` §32 step 1, `language.md` §10.4 step 1): `--select` `#4e61ed` for every on-page ring, handle, lasso box and hover outline; the coverage rule on **every** surface that composes `.glass`, `.glass-menu` or `.glass-frame` (about nineteen modules: floating bar, options tier, selection, annotation and image bars, TextLayer hint, FormLayer notice, Arrange bar, crop banner, Compare toolbar, `ui/Menu`, `ui/Popover`, TabBar, StatusBar, LeftRail), by lowering the three tokens (`--glass-filter` blur 7 px for bars ≥ 36 px, `--glass-menu-filter` blur 12 px for menus ≥ 58 px, `--glass-frame-filter` σ ≤ height / 5 of the shortest frame bar), each surface in the D0 coverage registry; the two-band focus ring with `styles/focus.css` (outset, inset and gap forms, `--focus-offset-{out,in,gap}`, `--focus-light` / `--focus-dark`); the `chromium-nogpu` project and research 22 §3.2's full-viewport screenshot helper | `styles/tokens.css`, `styles/global.css`, `styles/focus.css`, `styles/tokens.test.ts`, `styles/focus-scan.test.ts`, the page-layer CSS modules using the accent, `FloatingToolbar.module.css`, `ReadSelectionBar.module.css` and the other `.glass*` modules, `playwright.config.ts`, `e2e/support/pixels.ts` | — | M | A full-viewport screenshot of the bar over a white page within ±2/255 of the model on `chromium-nogpu`; every `.glass*` surface in the registry at c ≥ 0.985; `--select` ≥ 3:1 on white and both tints; no `#7c8cff` in page layers; `focus-scan.test.ts` and band ratio ≥ 9:1 |
| D0-2 | Size classes, input modality and the edition (ADR-0033 §2.1: coarse pointer and a screen side under 600 px, read once, `?edition`), no visual change on the full edition: `size-class.ts`, `frame-insets.ts`, `input-modality.ts`, `edition.ts`; the `phone`, `phone-land` and `tablet` Playwright projects | `shell/frame/`, `playwright.config.ts` | — | M | Class, modality and edition unit tests (rotation and zoom never switch the edition); `tablet` runs the smoke spec on the full edition |
| D0-3 | Primitives on today's tokens (`09-primitives` migration steps 2–4): token skeleton with aliases, `controls.css`, `.secondary` → `btn`, the `outline-offset` codemod onto D0-1's focus forms, and every primitive of `09-primitives` §3–§24 with `10-ink` §3–§5 replacing Slider and Swatch, plus `ui/colour/` (the colour panel and the page eyedropper, `10-ink` §4) replacing the native colour inputs (22: Button, IconButton, Chip, Segmented, Switch, Checkbox, Radio, Slider, Select and menu button, Text, Search and Number fields, Keycaps, Swatch, Badge, Tag dot, the focus ring of D0-1, Tooltip internals (X16), ScrollArea, EmptyNote, ResizeHandle, Progress) | `ui/*`, `styles/controls.css`, 12 + 15 modules, 44 files for focus | D0-1 | L | Browser-mode suite per primitive and every state (Q-14); `focus-scan.test.ts`; `bar-audit.spec.ts` (Q-9) on today's bars; Q-13 baselines for the primitives; screenshots of four baselines unchanged ± 1 px except the ported controls |
| D0-4 | Sheet primitive in five presentations, `sheet-store`, Confirm, one result page; port S6 (password prompt) and S22 (shortcuts) | `ui/sheet/`, `shell/ShortcutOverlay.tsx`, `shell/PasswordDialog.tsx` | D0-2, D0-3, D0-12 | M | `sheets.spec.ts` presentation per class, swipe, focus trap, drafts kept on Esc; Q-7 (sizes constant during motion, zero content resizes) |
| D0-5 | Toast system on our own region (X14), progress capsule, job store, error presentation; replaces the Combined and Update toasts | `ui/Toast/`, `jobs/job-store.ts`, `errors/present.ts`, `shell/announcer.ts`, `pwa/register.ts` | D0-3, D0-12 | M | One announcement per toast; F6 reaches toasts; A-24 hover hold; damaged-file toast (INV-6) |
| D0-6 | Visible Undo and Redo, the History scrubber (`08-feedback` FB7), undo reveal; `HistoryEntry.meta` | `shell/frame/UndoRedo.tsx`, `history/`, `packages/document-model/src/history.ts`, `types.ts` | D0-3 | M | Undo on touch in one press; a scrubber jump in M8 Read mode leaves bytes unchanged except by history (the four lock reasons are tested in D1-QA); tooltip names the step |
| D0-7 | OPFS snapshots and restore (X18): writer within 2 s and on hidden, `persist()`, 20-step tail, the edit blobs it refers to (ADR-0032 §2.4), restore on launch with "Restored 3 documents · Start fresh", Recents reopen snapshots, retention (30 days or 500 MB, owner Q2), private-window notice, `beforeunload` rule, Clear in the privacy popover | `session/`, `files/recents.ts`, `packages/document-model/src/serialize.ts`, `privacy/` | D0-5 | L | `session.spec.ts`: edit, reload, same page and zoom, Undo works for 20 steps; place a stamp and a saved image signature, reload, Undo across them, then Save succeeds; a closed document reopens from Recents with no picker on Firefox and WebKit; Clear is final |
| D0-8 | Save in place (ADR-0032): Save, Replace popover, write and verify, saved mark (X13), Revert to the opened version, Mod+S, download or share fallback, the Chromium 153 rule; unapplied-marks ask (07.10) | `shell/frame/SaveButton.tsx`, `ReplacePopover.tsx`, `state/saved-store.ts`, `files/save.ts` | D0-5, D0-7 | M | J13A: 3 presses first, 1 after (Chromium); "Saved · verified"; ● clears from the saved mark; a document in M8 Read mode saves (0032.3; the four lock reasons are tested in D1-QA) |
| D0-9 | Save a copy sheet (S2), absorbing Export, Compress, Export as images and Markdown; presets with estimates; picker first; Web Share (07.6) | `export/` (restructured), `ui/sheet/` | D0-4, D0-5 | L | J13B 8 → 5 (`jobs.spec.ts`); the empty-file rule (07.7); the old dialogs removed |
| D0-10 | Settings sheet (S3): today's settings in one home with 07.8's additions; About Recto inside it; the Appearance submenu and About dialog go | `settings/`, `shell/appearance-commands.ts` | D0-4 | M | Every setting reachable from ⌘K and the sheet; search finds each row in EN and TR |
| D0-11 | Saved signatures: up to five in `pdf-editor:signatures:v1`, New signature (S7) and the Settings → Saved signatures pushed page (07.8) in today's signature tool | `signatures/NewSignatureSheet.tsx`, `settings/SavedSignatures.tsx`, `annotations/SignatureDialog.tsx` (replaced) | D0-4, D0-10 | M | J8A 6 → 4 with a saved signature on today's shell (3 is proven in D2-3); Clear in Settings |
| D0-12 | Motion core (`09-primitives` §31): `apps/web/src/motion/` with the seven springs, animate and retarget, `flip()`, `velocityTracker`, `project`, `rubberBand`, `reducedMotion()` reading the OS query and `data-motion`, and the `viewTransition()` helper at 240 ms | `motion/` | — | M | Unit tests per helper; < 3 KB gzip; `reducedMotion()` answers both paths; Q-2 (transforms and `will-change` cleared at the end) and Q-10 (retarget mid-way, zero idle frames) |
| D0-13 | Copy-check lists (brand plan §7) with Q-12's and `10-ink` §7's bans; the icon files wait for the owner's kit (D4-8) | `tools/copy-check/` | — | S | Copy-check clean in EN and TR |
| D0-14 | The compact edition (ADR-0033 §2.3): `shell/compact/` with its Library (Open PDF, Recents, the reading-only line), reader (fit width, pinch, double tap, links, Copy), collapsible top bar and bottom capsule, Pages sheet, Find, ⋯ menu (Contents, Go to page, Share or Download a copy, Document info, About); read-only layers; its own entry chunk | `shell/compact/`, `app.tsx`, `main.tsx` | D0-2, D0-12 | M | `compact.spec.ts` on `phone` and `phone-land`: open, scroll, pinch, find, jump, download; no editing control reachable; a restored document with changes offers Download a copy; Q-gates; the full shell's chunk is not loaded |
| D0-QA | Specs of §10.3 for D0; `save.spec.ts`, `save-copy.spec.ts`, `session.spec.ts`, `sheets.spec.ts`, `compact.spec.ts`, `bar-audit.spec.ts`, `glass-rest.spec.ts` | `apps/web/e2e/` | each | M | D0 exit (§12) |

### 11.2 D1: targeted acts in viewing, `canChange` and Lock in `commit()`

| Id | Scope | Files | Depends on | Size | Acceptance |
|---|---|---|---|---|---|
| D1-1 | State migration (§7): `destination`, `surface`, `docUi`; `viewMode`, `documentMode`, `lastView` removed; `ui:v3`; `input-policy-store`. `canEdit(id)` stays as a shim with today's meaning, reading `docUi[id].markup` (true only in Markup), so the pen and page text stay protected until D1-5 deletes it | `state/ui-store.ts`, `state/input-policy-store.ts`, 37 + 17 files | D0 | L | Migration tests; every existing e2e green through `2` and the M8 control; the M8 input-rule specs pass on the shim |
| D1-2 | `canChange` and `lock-store`; `act` on every committing command with the registry test | `state/guard.ts`, `state/lock-store.ts`, `commands/registry.ts`, every `*-commands.ts` | D1-1 | M | Registry test fails on a missing act; dimmed items carry their reason |
| D1-3 | Lock in `commit()` with X12; engine edits ask first and replay the inverse on refusal; dev logging; the shared-page rule (X11) | `state/workspace-store.ts`, `engine/engine-service.ts`, `packages/document-model/src/selectors.ts` | D1-2 | L | For every act, a locked document's engine bytes are unchanged; closing and undoing a close keeps the lock |
| D1-4 | Lock UI (X4): `lock/` notice, popover, `open-unlock`, four reasons, signed and restricted on open, the switch dimmed while typing (0029.2), "Open documents locked" setting. **Interim control:** the M8 segments read View · Markup · Arrange; `1` no longer locks (migration toast, flows §7.3); Lock in the Document menu, the tab glyph and ⌘K | `lock/`, `shell/Stage.tsx`, `tools/DocumentMenu.tsx`, `forms/FormLayer.tsx` | D1-2 | M | e2e S6, S7 locked; every refusal opens the popover at the asking control; every existing e2e green through the interim control; the scrubber jump and Save while locked (moved from D0-6, D0-8) |
| D1-5 | Hit router and input rules (`05-canvas` §6; deletes D1-1's `canEdit` shim): one order with links, a live-kind matrix per state, the pen as a mouse in viewing with the first-pen hint, hover outline only in Markup with Select, the double-click asymmetry, a drawing pointer never long-presses | `viewer/hit-order.ts`, `viewer/TextLayer.tsx`, `annotations/AnnotationLayer.tsx`, `forms/FormLayer.tsx`, `image-objects/ImageLayer.tsx` | D1-2 | L | `input-rules.spec.ts` S1–S18 in both lock defaults |
| D1-6 | Targeted acts (`04-context` §3–§9, §12–§16, §20): the ContextBar, the selection bar everywhere (Highlight, Underline, Strikeout, Comment, Redact, Edit text, Copy), H U S C X, E then Enter, annotation, image, field and form-accessory bars, the menu primitive and catalogue, the page menu with "Add … here" and the image group, the popover primitive, the note popup, tooltip strings and behaviour, the pending-marks bar, `ui/anchor/place.ts` | `ui/ContextBar/`, `ui/Menu.tsx`, `ui/Popover.tsx`, `ui/Tooltip.tsx`, `annotations/SelectionBar.tsx`, `annotations/NotePopup.tsx`, `stage/PageContextMenu.tsx`, `redaction/PendingMarksBar.tsx`, `ui/anchor/` | D1-5, D0-5 | L | J5 7 → 4, J9 5 → 4, J10 via the pending bar (`jobs.spec.ts`); one undo step and a toast for S7, S8, S9, S17, S18 |
| D1-7 | Gesture core (X5): long press, double tap, multi-finger taps, pinch recognisers and thresholds | `motion/gesture/` | D0-12 | M | Unit tests per recogniser; long press opens the page menu on WebKit touch |
| D1-8 | Sheets with acts (`07-sheets` §26 step 2): S4, S5, S8–S12, S19, S20 with their `canChange` acts and lock banners | `ui/sheet/` users in `document/`, `furniture/`, `crop/`, `ocr/`, `redaction/`, `signatures/` | D0-4, D1-2 | L | J8B and J16 at the M9 counts (J11 moves to D2-4 and D4-3); registry test covers every sheet primary |
| D1-9 | Navigator safety: a navigating click never selects (S10); Delete acts only on a visible selection | `shell/PagesPanel.tsx`, `state/selection-store.ts` | D1-2 | S | e2e S10: click a thumbnail, press Delete, nothing changes |
| D1-QA | `input-rules.spec.ts`, locked-bytes test, rewrites of `modes`, `annotations`, `forms`, `redaction`, `text-edit`, `paragraph-edit` | `apps/web/e2e/` | each | M | D1 exit; the five-person test runs on this build (§10.4) |

### 11.3 D2: Markup palette and dock morph, Pages grid, Compare place, key map v2

| Id | Scope | Files | Depends on | Size | Acceptance |
|---|---|---|---|---|---|
| D2-1 | The frame (`01-frame` F1–F13): AppShell as layers, top strip, tabs with overflow, title menu with rename and the Lock switch, Find entry, Save, ◎, compact top bar, page pill, hide on scroll, overlay slots, Focus, `regions.ts` (X9); status bar, rail, mode switch, layout switch, Document and Export buttons removed | `shell/frame/`, `shell/AppShell.tsx`, `shell/Stage.tsx`, `stage/ReadView.tsx` | D1 | L | `frame-layout.spec.ts` (A-12 rects per class, sidebar open and closed); A-20 at 320 × 256; jobs J2, J13A, J15a, J16 per class |
| D2-2 | The capsule (X1) and the dock at rest: one element whose own width and height morph in `contain: layout style` (Q-6), one σ per size, the Locked state; no lens (X20) | `shell/capsule/`, `shell/frame/Dock.tsx` | D2-1, D0-12 | M | Morph keeps one node; layout confined to the capsule; `capsule.spec.ts` (Q-6) mid-morph pixels in three engines; Locked replaces Markup and Fill & sign |
| D2-3 | Markup palette and tools (`03-markup`): groups and measured fold, the ladder (03.9) for narrow windows (the phone's compact sets move to M10, ADR-0033), the ink strip and preset editor (`10-ink` §2, §6) in place of the options tier and chip, preset strip, Fill & sign door with saved-signature chips, field stepper, Add field, P next pen, stroke fade; `tool-store` arms on `canChange(id, 'freehand')` | `markup/`, `viewer/tool-store.ts`, `annotations/tools.ts`, `annotations/pen/` | D2-2, D1 | L | J6 5 (keys 4), J8A 3, J10 6 at large and on the tablet (`markup.spec.ts`); colour and width one press from an armed pen |
| D2-4 | Sidebar (`06-navigation` N1–N6): Contents and thumbnails with drag, Find (one field from 1280 px, "Mark all for redaction"), Review with static chips (the phone Pages sheet moves to M10); rail, Files tab and Changes tab removed | `shell/sidebar/`, `dnd/pointer-drag.ts`, `shell/OutlinePanel.tsx`, `shell/review/` | D2-1, D1-7 | L | J4 sidebar 4, J15b 2, S13; J11 3 by the Find section's "Recognize text…" prompt; Review's Words to check (X33); listbox keys; width kept per device |
| D2-5 | Pages grid (PG1–PG6) with the Pages bar (X21), 240 ms grid transition, pinch in and out, drop on a tab, Combine straight into the grid with one outcome (INV-12), Interleave keeping its sources (07.13), page-structure sheets S13–S18 | `stage/ArrangeView.tsx`, `stage/grid/`, `stage/OperationDialogs.tsx`, `packages/document-model/src/pages.ts` | D2-2, D2-4, D2-10 | L | J4 grid 5 (tablet 5); Combine with open documents straight into the grid (J3 3 from the Library is D4-1's); the Merge dialog's replace outcome gone; `pages-grid.spec.ts` |
| D2-6 | Compare place (CP1–CP7) with the Compare bar, chooser, Changes list, compact A · B · Changes, report; keys 06.23; failure state 06.15 | `compare/` | D2-1, D2-2 | M | J12 3 from a document and on the tablet (from the Library in D4-1) |
| D2-7 | Key map v2 (flows §7.2–§7.3, 02.12, 05.4, 06.23): M, `1`–`4`, Shift+R, Mod+S, F, `[` `]`; caret mode, Alt+Enter, keyboard placement (`05-canvas` §7, §14); the `1` migration toast; the shortcuts overlay | `commands/`, `viewer/caret.ts`, `viewer/placement.ts`, `shell/ShortcutOverlay.tsx` | D2-3 | M | `keyboard-text.spec.ts` (J5 6, J8A 4, J9 7 by keyboard); no key arms a tool while focus is in a field |
| D2-8 | ⌘K v2 (`08-feedback` FB1–FB3): selection first, arguments in EN and TR, capability list, keycaps, recents per device; no scrim | `shell/palette/`, `commands/args/` | D2-7 | M | J4, J8B, J13B, J16 by ⌘K in three engines; parser tables |
| D2-9 | Inspector removal and re-homing (History → scrubber, Properties → bars' ⋯, Info → S4, Signatures → title menu and facts, OCR → its sheet and Review); Batch (S21) | `shell/RightPanel.tsx` (deleted), `annotations/AnnotationProperties.tsx`, `batch/` | D2-1 | M | No function lost (inventory family 6 checklist; OCR results in Review's Words to check, X33); Batch from ⌘K (from the Library ⋯ in D4-1) |
| D2-10 | Canvas zoom and scroll (`05-canvas` §4, §5): the zoom controller with projection, detents and the pinch detent chip (05.11), the gesture into the grid, the trailing page scrubber (05.1) | `viewer/zoom-controller.ts`, `stage/PageScrubber.tsx` | D1-7, D0-12 | M | Zero layouts during pinch; commit keeps the anchor within 1 px; J2 touch by the scrubber |
| D2-QA | Rewrites of §10.3 for D2; `jobs.spec.ts` at the M9 counts for D2's rows (§12) | `apps/web/e2e/` | each | L | D2 exit; the five-person test's session 2 runs on this build (§10.4) |

### 11.4 D3: the language

| Id | Scope | Files | Depends on | Size | Acceptance |
|---|---|---|---|---|---|
| D3-1 | Rendered-pixel harness with its own Vite config (09.11), extending D0-1's `e2e/support/pixels.ts` and `chromium-nogpu` project, `glass-pixels.spec.ts` over the registry | `apps/web/harness/`, `apps/web/e2e/` | D0-1 | M | Every registry entry sampled in three engines plus no-GPU within ±2/255; edge samples within ±4/255 |
| D3-2 | Tokens and colour (ADR-0023): `tokens.css` in seven blocks, graphite neutrals, lime (the two-band ring is D0-1's), `--control-border`, `--control-on`, `--redact-page`, `--crop-dim`, tags, status; `tokens.test.ts` with registry, APCA and colour pairs; aliases removed at the end | `styles/tokens.css`, `styles/tokens.test.ts`, `styles/global.css`, `annotations/palette.ts` | D3-1 | L | A-1, A-3, A-4, A-11, A-19 green in dark |
| D3-3 | Materials (ADR-0024): `materials.css` generated from the registry, `ui/Surface`, lit glass, Glass Clear · Tinted · Solid replacing Glass panels and Reduce transparency, the cost ladder, lens on M1 chips only, literal `-webkit-` values; the test-only render override (X36), stripped from the deploy build | `styles/materials.css`, `ui/Surface.tsx`, `state/appearance-store.ts`, `shell/frame/`, `e2e/support/render-override.ts` | D3-2 | L | A-2 rendered, A-17; the ladder steps in a throttled run; one spec without the override: a software rasteriser starts at Tinted and `hardwareConcurrency ≤ 4` at step 2; the `.glass*` rules gone |
| D3-4 | Motion tokens (ADR-0026) on D0-12's core: the `linear()` token curves in `motion.css`, reduced motion per token, the Reduce motion setting, the catalogue additions (X8, 02.5, 02.6, 05.2); the three per-file `matchMedia` checks removed | `styles/motion.css`, `settings/` | D0-12, D2 | M | `motion.spec.ts`: A-7 to A-10, A-23; zero frames at rest |
| D3-5 | Type (ADR-0027): `tools/fonts/subset.sh`, `'Inter Recto'` subsets with ↵ and ⇥, scale tokens, `.technical` replacing mono; `@fontsource-*` removed | `tools/fonts/`, `apps/web/public/fonts/`, `styles/fonts.css` | D3-2 | M | Font coverage test (EN, TR); 98 KB; layout snapshots within ± 1 px |
| D3-6 | Icons (ADR-0027): `tools/icons/` generator and the merged manifest, verified names first, `ui/Icon.tsx`, outline at rest and fill when selected; `lucide-react` removed | `tools/icons/`, `ui/icons.generated.tsx`, 59 files | D3-2 | M | Generator fails on an unknown name; no `lucide-react` import |
| D3-7 | Light theme (ADR-0022 §2.4): every token in both themes, light glass floor, Theme System · Light · Dark, `theme-color` per scheme | `styles/tokens.css`, `index.html`, `settings/` | D3-2, D3-3 | L | The pixel matrix and a11y matrix green in light |
| D3-8 | Light (ADR-0025), with the mint stop of the owner's aurora treatment decided when the brand kit arrives: `light/` field and CSS fallback, gates and pauses, `textSafe` (02.2; the Library head-row rect is wired by D4-1), the light-event service (FB12), under-light, processing ring, success bloom; Ambient light Auto · Still · Off | `light/`, `ui/ProcessingRing.tsx`, `ui/SuccessCheck.tsx` | D3-3, D3-4 | L | A-5, A-6 (pages; Library thumbnails in D4-1), A-8 sampler; ≤ 4 KB lazy |
| D3-9 | Accessibility gates in CI (ADR-0028): the matrix, the plain project, target audit, Turkish and 1.4.12 checks, the `capitalize` and argument-less `toUpperCase` bans, the CI rule of 0028.1. Before the ban blocks: the uppercase section labels (`text-transform: uppercase`) become footnote 550 (`language.md` §4.3); a lint allowlist for non-UI data (hex colours, IBAN, stamp names) that passes `'en'` explicitly; `document/strip-items.ts`'s hand-built capitalise fixed | `apps/web/e2e/a11y.spec.ts`, CI workflow, lint config, the modules with uppercase labels, `document/strip-items.ts` | D3-2 to D3-8 | M | Every gate of §8 blocking; the ban's first run is clean |
| ~~D3-10~~ | Cancelled 2026-10-04: the owner supplies the mark (brand plan, status) | — | — | — | — |

### 11.5 D4: Library, first run, polish and the presentation

| Id | Scope | Files | Depends on | Size | Acceptance |
|---|---|---|---|---|---|
| D4-1 | Library (`02-library` L1–L9, L12): launcher, field, head, lit cards with one-click open and Select, static selection bar, Combine without a dialog in card order, Recents with snapshots and thumbnails (02.Q1), drop overlay with light, ⋯ menu and footer | `home/` | D3, D0-7 | L | J1 2, J3 3 (2 by drop), J12 3 from the Library, J14 0–1 (`library.spec.ts`); the `textSafe` head-row rect; A-6 on Library thumbnails blocking; OM4 runs on this build |
| D4-2 | Teaching sample: four pages in EN and TR built by `tools/fixtures`, precached, `?sample` and `?sample=tr` | `tools/fixtures/`, `apps/web/public/sample/`, `vite.config.ts` | D4-1 | M | ≤ 250 KB; `?sample` opens once and is removed from the address |
| D4-3 | Facts chip and its ⓘ fold (L11), `pdf-editor:facts-seen:v1` | `home/facts/`, `shell/frame/` | D2-1 | M | J11 2 while the chip shows (10 s, A-24); once per file; Restored edits every restore |
| D4-4 | Polish: empty states (FB11), honesty notice (FB9), haptics (FB13, Android), copy-check EN and TR, the decisions from the five-person test and the prototype checks | across families | D3 | M | Copy-check clean; every T·5 and T·P default confirmed or changed and recorded in §15 |
| D4-5 | Media re-recording: the scripted scenes and social image through the M9 shell, both themes | `tools/media/` | D4-1 | M | Deploy workflow records every scene |
| D4-6 | README: hero and screens of the M9 app, every claim backed by a test or source file | `README.md` | D4-5 | S | Link check clean |
| D4-7 | About page v2 in eight sections (brand plan §8) with the owner's mark, aurora that settles within 5 s or a poster per the owner, ≤ 300 KB | `apps/web/about/` | D4-5, the owner's kit | M | `about.spec.ts` budget; A-gates on the page |
| D4-8 | Brand from the owner's kit (brand plan, status of 2026-10-04): PNG icon set, `apple-touch-icon`, `favicon.ico`, maskable icon and manifest colours rendered by `tools/brand/`, social card, wordmark in the app glyph, `TRADEMARKS.md` if approved | `tools/brand/`, `apps/web/public/`, `index.html` | the owner's kit | M | The brand plan's checks (§3.3, §5) |
| D4-9 | Docs: DESIGN amendments B1–B15, ROADMAP, this spec's §15, changeset | `docs/DESIGN.md`, `docs/ROADMAP.md`, `docs/specs/redesign.md`, `.changeset/` | all | S | Links and screenshots current |
| D4-10 | Press kit (brand plan §9, BR-K1) at `/recto/about/press/` and a zip per release | `apps/web/about/press/`, `tools/media/` | D4-5, the owner's kit | S | Fact sheet in EN and TR; every asset listed in the brand plan |
| D4-11 | Case study v1 in the portfolio repository (brand plan §9), after the UI freeze | portfolio repository (outside this one) | D4-5 | S | Copy-check clean; every claim linked |

### 11.6 Across drops

| Id | Scope | When | Size |
|---|---|---|---|
| XD-0 | Concept screens: the product frames `concept/index.html` still lacks (its Screens section holds placeholders), built from flows §6.3–§6.7: reading at 1440 × 900 with the dock and page pill; the Markup palette with a tool armed and the under-light; the empty Library with the drifting field; the Pages grid; 390 × 844 phone frames; an 820 px strip with six tabs; the Settings side sheet; handles; a toast stack | Before the owner's approval (§14 Q3) | M |
| XD-1 | Five-person test (§10.4) | Session 1 on the D1 build, before D2 freezes; session 2 on the D2 build, before D2-QA closes | S |
| XD-2 | Owner measurements OM1–OM6 (§9.2) | OM3 and OM2 before D3-3; OM1 on the D3 build; OM4 on the D4-1 build; OM5 on the D2 build | — (owner) |
| XD-3 | Independent reviews, correctness and experience, by reviewers who did not build the drop | After each drop | S each |

**Order.** XD-0 is done (the concept prototype, approved 2026-10-04). D0-1, D0-2, D0-12 and D0-13
start at once, and D0-14 follows D0-2 and D0-12;
D0-3 follows D0-1, and the rest of D0 runs in parallel after D0-3 and D0-12. D1 starts when
D0-4 and D0-5 land; D1-7 can start once D0-12 lands. D2 starts after D1-QA and XD-1's first
session. D3-1 and D3-10 may start during D2; the rest of D3 follows D2-1, and XD-1's second
session closes before D3 starts. D4-1 to D4-4 follow D3; D4-5 to D4-8, D4-10 and D4-11 follow
the UI freeze, D4-7, D4-8 and D4-10 also the owner's brand kit. M10 (the phone edition) follows M9.

**Reorder of 2026-10-05 (owner: presentable first).** The owner asked for the whole new UI/UX
(layout, look, motion, core use) to be finished and presentable before rarely used features; those
follow as updates. The foundations they need are in: D0, D1-1 (state model) and D1-2 (`canChange`,
`lock-store`, `act` on every command). From here:

1. **V1, core use:** D1-5 (input rules) and D1-9 (navigator safety) finish; D0's deploy.
2. **V2, the look and the shell, built once in the final language.** D3-2 (tokens and colour),
   D3-5 (type) and D3-6 (icons) move ahead of D2-1 so the shell is built in Recto's language
   rather than re-skinned after; then D2-1 (frame), D2-2 (capsule and dock), D2-3 (Markup palette
   and the ink strip), D2-4 (sidebar), D2-5 (Pages grid), D2-10 (done), D3-3 (materials), D3-4
   (motion tokens), D3-7 (light theme), D2-9 (inspector removal), a lean D2-7 (key map), D4-1
   (Library), D4-2 (sample) and D4-4 (polish). D3-8 (aurora) waits for the brand kit's mint stop.
   The remaining dialogs move to sheets inside D2-x as each area is rebuilt (the presentation half
   of D1-8).
3. **Updates after V2:** D1-3 (lock at commit), D1-4 (the Lock UI beyond the title menu's switch,
   which D2-1 keeps), D1-6 (targeted acts beyond today's selection bar), the act half of D1-8,
   D2-6 (Compare as a place), D2-8 (⌘K v2), D3-9 (CI gates beyond today's), D4-3, D4-5 to D4-11.

No package is dropped; the slots these later features use (title menu, sheet primaries, the
guard's reasons) are kept by V2, so adding them later does not move the layout. At most three
implementers run at once, so the work flows without stopping on usage limits.

**Counts:** D0 15 packages, D1 10, D2 11, D3 9, D4 11; 56 in all, plus 4 across drops.

## 12. Drops

Each drop is a working app, deployable on its own; none is tagged until the owner says "beta v1".

| Drop | Contents | What a person sees | Exit |
|---|---|---|---|
| **D0** Independent | D0-1 to D0-14, D0-QA | On phones, a finished read-only reader (the compact edition). Elsewhere, the M8 shell with sheets instead of dialogs, toasts, visible Undo and Redo with a scrubber, work restored after a reload, Save in place, one Save a copy, Settings in one place, saved signatures; the selection blue on pages, glass that no longer leaks, the two-band focus ring, one slider, swatch and colour panel | J13A, J13B, J14 at their M9 counts; restore survives a reload with 20 undo steps; the A-gates of §8 for D0 blocking; review finds no blocker |
| **D1** Targeted acts and Lock | D1-1 to D1-9, D1-QA | Fields, highlights, comments and page actions work without switching to Edit; the M8 control reads View · Markup · Arrange; Lock in the Document menu, tab and ⌘K; `1` never locks | S1–S18 in both defaults; locked bytes unchanged for every act; J5 and J9 at M9 counts; five-person test run |
| **D2** The model's shell | D2-1 to D2-10, D2-QA | The top strip, the labelled dock that morphs into the Markup palette, the sidebar, the Pages grid, Compare as a place, the page pill, the tablet layout and narrow-window parity, key map v2, ⌘K with arguments; still today's colours and type | Every row of flows §8.2 at its M9 count except the Library paths (J1, J3, J12 from the Library, J14's Recents row), which D4-1 proves; A-12, A-20, A-21 blocking; no inspector, status bar, rail or mode switch left; the five-person test's session 2 run |
| **D3** The language | D3-1 to D3-10 | Recto Glass: lime, graphite, five glass densities, the aurora, springs, `'Inter Recto'`, Phosphor, a light theme following the system, the Glass, Ambient light, Reduce motion and Theme settings | Every gate of §8 blocking in both themes (A-6's Library-thumbnail clause from D4); budgets of §9.1; OM1–OM3 run or defaults recorded |
| **D4** Library and presentation | D4-1 to D4-11 | The launcher, lit cards, the teaching sample, the facts chip, polish; new media, README, the case study, and (with the owner's kit) About v2, the press kit and the brand | The Library rows of flows §8.2 (J1, J3, J12, J14); OM4 run or its default recorded; §10.5 |

## 13. Risks

| Risk | Likelihood · impact | Mitigation |
|---|---|---|
| Migration size: `viewMode` 85/37, `documentMode*` 48/17, `canEdit*` 49/14; most e2e specs rewritten | High · medium | Five drops, each a working app; D1 keeps `2` and an interim control so specs move in steps; `enterEdit` survives |
| The owner wants documents locked by default | Medium · low | One flag (`openDocumentsLocked`); S1–S18 tested in both defaults |
| Targeted acts change a file unnoticed (S7, S9) | Medium · medium | One undo step and a toast each; the five-person test's decision rule (§10.4) |
| Glass costs frames on the owner's GPU or on phones | Medium · medium | Coverage rule, cost ladder (step 3 makes docked M3 solid at run time on a slow device), Tinted and Solid; OM1 confirms the glass default |
| Safari ignores `var()` in the prefixed filter | Medium · low | Literal values everywhere (OM3 only confirms) |
| The aurora bands, drains battery or looks cheap | Medium · medium | Still by default; gates and pauses; Off and Still settings; OM4; the CSS fallback |
| Rendered pixels differ by engine or GPU path | Medium · medium | Three engines plus no-GPU; the ±2/255 tolerance; the model and pixels both gate |
| The capsule morph is complex (one element, many contents, fold by measurement) | Medium · medium | `clip-path` only, never the filter; one owner (X1); browser-mode tests that the node is kept |
| Base UI upgrades fight our regions and announcer | Low · medium | Own toast region (X14); Popover for the title menu; overrides tested |
| Snapshots on shared machines, quota and iOS eviction | Medium · medium | Listed with Clear; retention; `persist()`; private-window notice; honest wording; owner question 2 |
| Chromium 153 and stored handles | Known · low | The ADR-0032 rule (0032.1); recheck on Chrome 154 (DISCUSSION #32) |
| Touch thresholds and drag on real devices | Medium · medium | S-T1 to S-T5 (OM5); two drag paths; ‹ › and Move to ▸ as fallbacks |
| Turkish lengths overflow compact chrome | Medium · low | 1.8 × design length; stacked dock labels; the phone selection bar at 56 px; A-21 checks |
| Unverified Phosphor names | Medium · low | D3-6 verifies first; nearest glyph by the lead |
| Gate 0 renames the product late | Low · medium | Brand and About wait for Gate 0 (D4-7, D4-8); storage names never change |
| Interim UI in D1 confuses anyone using develop | Low · low | D1 is short; the migration toast; D2 follows |
| The a11y matrix makes CI slow | Medium · low | 0028.1's split; shards |
| Scope creep from 200 decisions | Medium · medium | §6 closes them; new ideas go to M11 candidates |

## 14. The owner's answers (2026-10-04)

The owner reviewed the plan and the concept prototype on 2026-10-04 and accepted every
recommendation ("apply all your recommendations, professionally"), with one change of scope and
three standing requirements. The questions as asked are in git history (commit `bcef46b`).

1. **Documents open unlocked.** `openDocumentsLocked` defaults to false. The five-person test
   still reports on S7 and S9 (§10.4), and its decision rule stands.
2. **Documents are kept on the device:** open ones with their changes, closed ones in Recents for
   30 days or 500 MB, listed and clearable (D0-7).
3. **Taste:** the concept is approved: the labelled dock always shown from medium up, the lime
   fills, the light on the empty Library, Phosphor. The prototype's faults (mismatched buttons,
   grainy and breaking glass, the bottom menu's animation, text, optimisation) must not reach
   the product. `quality-bar.md` names their causes and gates Q-1 to Q-14.
4. **The name:** the owner keeps Recto and has designed the brand and mark ("Dengeli" R, mono
   and aurora), which arrive in the next phase. The trademark searches of the brand plan §1.2
   remain recommended before a public launch, as the owner's call (brand plan, status).
5. **Machine checks (OM1–OM5):** not run yet. Each keeps its safe default (§9.2) until it is
   run.
6. **"beta v1" waits for the redesign:** recommended at D4-4. The lead asks for the word then,
   and nothing is tagged before the owner says "beta v1".

**Change of scope: phones (ADR-0033).** On phones, Recto stays a read-only PDF reader with the
features hidden, behind a simpler, collapsible bottom bar: a different interface from the
desktop's, after apps like Procreate. Phones may have fewer features, but what is there must
work fully. M9 first delivers a version that works properly on widescreen desktops and tablets.
The phone edition is designed with the owner afterwards, as M10.

**Standing requirements.**
- The pen's colour and size picker gets extra thought (`10-ink.md`). Every colour option and
  slider is modern and Apple-like.
- Every control, menu and bar is consistent (Q-9).
- Work runs to plan and moves to production without delay once a plan is ready, with no visual
  or system defects shipped.

## 15. As built

*Empty until M9 is built.* What each work package delivered, where it differs from this plan,
the five-person test's results, the owner's measurements and the defaults that shipped in their
place.
