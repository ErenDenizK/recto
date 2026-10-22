# Decisions log

One place for every decision the owner or the lead has made, so the work stays consistent when
context resets or an outside brief arrives. Each row names its source. **The source wins over
this log.** If they disagree, fix the log.

**Who decides.** The **owner** decides product scope, V1, releases, taste and defaults. The
**lead** settles open design and process questions inside what the owner has decided, and
records each one here. A proposal is not a decision. PLAN, the feature sheet and the R12
roadmap stay proposals until the owner marks a row.

**Status values.** *In force*: applies now. *Done*: decided and built. *Superseded*: replaced by
the row it names. *Open*: asked, not yet answered. Do not act on an open row; keep its safe
default.

**Ids.** Rows carry a log id (PRD, DSN, MOT, GLS, INK, EDN, PRC, TXT, MOB, PF, RED) so they never clash with the
sources' own ids (R12's D-1 to D-5, PLAN's P-1 to P-8, the feedback's F and G items), which each
row quotes.

**Reading and adding.** This file is the index: one line per decision, grouped by area. Find the
row you need, then open its area file in [`decisions/`](decisions/) for the full row (text, date,
source, status). To add a row, put the full row in the right area file with its date and source,
add its one-line entry (`Id | Decision | Status | Date`, the decision at most 120 characters) to
the matching table here, and mark any row it replaces as superseded in both places. Owner rules
given only in conversation are recorded in the area file, and that file is their source ("owner,
conversation"). `tools/qa/decisions-index.ts` checks that the index and the area files agree.

Sources, by short name:

- **R12**: [`research/innovation-2026-10/ROADMAP.md`](../research/innovation-2026-10/ROADMAP.md),
  §8 and "Owner decisions (2026-10-09)".
- **PLAN**: [`plan/v1/PLAN.md`](../plan/v1/PLAN.md) (R13), §1, §6 and "W0-q findings".
- **Sheet**: [`plan/v1/feature-decisions.md`](../plan/v1/feature-decisions.md).
- **Audit**: [`design/system-audit-2026-10.md`](../design/system-audit-2026-10.md), "Lead's
  resolution".
- **Spec §14**: [`specs/redesign.md`](../specs/redesign.md) §14, the owner's answers of 2026-10-04.
- **R10** / **R11**: the owner's annotated iPad feedback of 2026-10-08 (F1–F5) and 2026-10-09
  (G1–G8), with the lead's decisions. These are session notes outside the repository. Their
  results are cited in the audit, `components/10-ink.md`, `07-sheets.md` and `quality-bar.md`.
- **Workflow**: [`process/agent-workflow.md`](agent-workflow.md).
- **ADR-n**: [`adr/`](../adr/README.md).

---

## Product

Full rows: [`decisions/product.md`](decisions/product.md).

| Id | Decision | Status | Date |
|---|---|---|---|
| [PRD-1](decisions/product.md) | Only the owner declares V1 and "beta v1" | In force | 2026-10-04, restated 2026-10-09 |
| [PRD-2](decisions/product.md) | Each extra feature is measured | In force; sheet awaits the owner's marks | 2026-10-09 |
| [PRD-3](decisions/product.md) | VoiceOver and extra accessibility are not V1 requirements | In force; PLAN V1-A7 to be amended to match | 2026-10-09 |
| [PRD-4](decisions/product.md) | The URL stays on github.io | In force | 2026-10-09 |
| [PRD-5](decisions/product.md) | The name is Recto | In force | 2026-10-01, 2026-10-04 |
| [PRD-6](decisions/product.md) | Presentable first | In force | 2026-10-05 |
| [PRD-7](decisions/product.md) | Documents open unlocked | In force | 2026-10-04 |
| [PRD-8](decisions/product.md) | Documents are kept on the device | In force | 2026-10-04 |
| [PRD-9](decisions/product.md) | No on-device model dependency for now | In force | 2026-10-09 |
| [PRD-10](decisions/product.md) | Flashback is on | Superseded on timing by PRD-15 | 2026-10-09 |
| [PRD-11](decisions/product.md) | Paragraph text editing: Tier B is built | In force | 2026-10-03 |
| [PRD-12](decisions/product.md) | Standing promises: no telemetry, no analytics, no account, in every edition | In force | 2026-09-26, restated 2026-10-09 |
| [PRD-13](decisions/product.md) | PLAN §6 questions O-1 to O-9 (edition split, Must list, spice, ◇ candidates, perf runs, concurrency, phone pilot… | Open, except as covered by EDN-1 to EDN-6 and PRC-3 below | 2026-10-09 |
| [PRD-15](decisions/product.md) | Flashback joins V1 only if it is easy | In force | 2026-10-11 |
| [PRD-16](decisions/product.md) | Dictation (voice input) is after V1 | In force | 2026-10-11 |
| [PRD-17](decisions/product.md) | Parked until the owner tests on a large screen: the sidebar covering a fit-width page (scroll a hit or jump clear of… | Open | 2026-10-11 |
| [PRD-18](decisions/product.md) | On-device Office to PDF, desktop and tablet: LibreOffice WASM on consent, the first dependency exception (board) | In force; phase 1 behind a flag | 2026-10-19 |
| [PRD-19](decisions/product.md) | Text (.txt) to PDF: engine layout in Noto Sans with the paragraph line-breaker, UTF-8 or windows-1254, opens as a new document; Office results too (CEO) | In force | 2026-10-20 |
| [PRD-20](decisions/product.md) | Office package r2: fonts trimmed (GPL faces out by default), Recto's substitution table, about 70 MB | In force; BQ-1 to BQ-3 open to the board, defaults applied | 2026-10-21 |
| [PRD-21](decisions/product.md) | Settings removes the Office package; About lists its licences | In force | 2026-10-21 |
| [PRD-22](decisions/product.md) | What must be true before `?office=1` goes on desktop and tablet; then the owner decides | In force; the switch is the owner's | 2026-10-21 |
| [PRD-23](decisions/product.md) | The palette reads a query with a rule grammar (typed intents carrying resolved pages), a score floor and catalog synonyms; no model | In force; the owner reads the corpus through | 2026-10-21 |
| [PRD-14](decisions/product.md) | W0-q findings are assigned to waves: signed fixture opens locked and saves byte-identical (W1-a/W1-b), truncated.pdf… | In force; W1-b and W1-g merged | 2026-10-09 |
| [PF-18](decisions/product.md) | A closed document's source is parked; the engine worker ends when none is open | In force | 2026-10-22 |
| [PF-19](decisions/product.md) | Read mode's whole-page bitmap is capped at 4 MP on every edition; tiles keep the visible page 1:1 | In force | 2026-10-22 |
| [PF-22](decisions/product.md) | In WebKit page renders leave the worker as RGBA pixels and the main thread makes the bitmap (a transferred ImageBitmap can carry a later same-size tile's pixels); other engines keep the transferred bitmap | In force | 2026-10-22 |

## Design

Full rows: [`decisions/design.md`](decisions/design.md).

| Id | Decision | Status | Date |
|---|---|---|---|
| [DSN-1](decisions/design.md) | The visual design system comes first | In force | 2026-10-09 |
| [DSN-2](decisions/design.md) | Recto Glass: content is solid, controls are glass, light lives beneath glass | In force | 2026-10-04 |
| [DSN-3](decisions/design.md) | Colour roles: one lime #c8fb3d for accent, focus and brand | In force | 2026-10-04 |
| [DSN-4](decisions/design.md) | Glass: five tiers (M1 chip to M5 sheet) plus lit glass | In force; "no grain" was a misrecording, see DSN-22 | 2026-10-04, amended 2026-10-10 |
| [DSN-5](decisions/design.md) | Light: an in-house aurora that is still by default and answers events | In force | 2026-10-04 |
| [DSN-6](decisions/design.md) | Type and icons: Inter as 'Inter Recto', sentence case, tabular numbers | In force | 2026-10-04 |
| [DSN-7](decisions/design.md) | Taste: the concept is approved (labelled dock from medium width up, lime fills, light on the empty Library, Phosphor) | In force | 2026-10-04 |
| [DSN-8](decisions/design.md) | Floating glass pieces | Done | 2026-10-08 |
| [DSN-9](decisions/design.md) | Pop-ups fit | In force | 2026-10-08 |
| [DSN-10](decisions/design.md) | Pages grid selection follows Photos | Done | 2026-10-08 |
| [DSN-11](decisions/design.md) | Brand in the app: the mark on the Library tab, the favicon and the PWA icons | Done | 2026-10-08 |
| [DSN-12](decisions/design.md) | One size scale for every floating piece | Done | 2026-10-09 |
| [DSN-13](decisions/design.md) | The Library title | In force | 2026-10-09 |
| [DSN-14](decisions/design.md) | Glass gloss is a hairline | In force | 2026-10-09 |
| [DSN-15](decisions/design.md) | The reader background glow is on by default | In force; supersedes R11's first lead note (default off) | 2026-10-09 |
| [DSN-16](decisions/design.md) | Selection uses the app's lime accent | In force | 2026-10-09 |
| [DSN-17](decisions/design.md) | Light-theme focus: option A | In force | 2026-10-09 |
| [DSN-18](decisions/design.md) | Light glass: lower the M1/M2 light tints toward the tokens.test.ts floor | In force | 2026-10-09 |
| [DSN-19](decisions/design.md) | Selected vs current: selected = lime ring and filled badge | In force | 2026-10-09 |
| [DSN-20](decisions/design.md) | The final system | In force (lane work in progress) | 2026-10-09 |
| [DSN-22](decisions/design.md) | Grain is not banned (option B) | In force | 2026-10-10 |
| [DSN-23](decisions/design.md) | Settings opens in the centre | In force | 2026-10-10 |
| [DSN-24](decisions/design.md) | The background light is always behind the app | In force | 2026-10-10 |
| [DSN-25](decisions/design.md) | Fewer, flatter controls | In force | 2026-10-10 |
| [DSN-21](decisions/design.md) | Accessibility gates: A-1 to A-24 as CI gates | In force; the extra items of PRD-3 are not V1 | 2026-10-04 |
| [DSN-26](decisions/design.md) | The sidebar is one floating glass panel | In force | 2026-10-10 |
| [DSN-27](decisions/design.md) | The pill's Contents row never does nothing | In force | 2026-10-10 |
| [DSN-28](decisions/design.md) | The maker's credits line at About's foot | In force | 2026-10-10 |
| [DSN-29](decisions/design.md) | The page pill's menu is small glass | In force | 2026-10-11 |
| [DSN-30](decisions/design.md) | Floating chrome is glass; solid only with a reason | In force | 2026-10-11 |
| [DSN-31](decisions/design.md) | The phone Library is a composed home, not a button on an empty canvas | In force | 2026-10-11 |
| [DSN-32](decisions/design.md) | The phone reader's top bar is a floating glass capsule, not a band | In force | 2026-10-12 |
| [DSN-33](decisions/design.md) | The phone Library scrolls the page itself | In force | 2026-10-12 |
| [DSN-34](decisions/design.md) | A split top for the phone reader, behind ?top=split, beside the capsule top (DSN-32) until the owner chooses | In force (the default since DSN-37; `?top=capsule` keeps DSN-32) | 2026-10-15 |
| [DSN-35](decisions/design.md) | The split top's scroll-edge fade is a tint, softened by a masked blur | In force, amended by DSN-38 (lighter), DSN-40 (superseded) and GLS-21 (the theme's canvas, denser) | 2026-10-15 |
| [DSN-36](decisions/design.md) | The phone's menus grow out of their button | In force | 2026-10-15 |
| [DSN-37](decisions/design.md) | The owner's choices for the phone top (R18 decision page) | In force, amended by GLS-20 (the fade takes the theme, not the page) | 2026-10-15 |
| [DSN-38](decisions/design.md) | The split top's title is centred and cut in its middle; the fade is lighter (DSN-37) | In force | 2026-10-15 |
| [DSN-39](decisions/design.md) | How the phone top's liquid menus and keyboard Find are built (DSN-37) | In force, amended by MOT-13 (the menus grow out on the compositor; no traced mask) | 2026-10-15 |
| [DSN-40](decisions/design.md) | The scroll edge follows the page, not the theme (DSN-37) | Superseded by GLS-20 | 2026-10-15 |
| [DSN-41](decisions/design.md) | The split top's header has the row's box | In force | 2026-10-15 |
| [DSN-42](decisions/design.md) | A liquid body keeps its rim while it moves | Superseded by MOT-13 and MOT-14 (no traced outline left to stroke) | 2026-10-16 |
| [DSN-43](decisions/design.md) | The capsule and ✎ morph as one liquid body (DSN-37's "merge") | In force, amended by MOT-14 (the merge on the compositor) | 2026-10-16 |
| [DSN-44](decisions/design.md) | Find on the phone keeps a found word in sight | In force | 2026-10-16 |
| [DSN-45](decisions/design.md) | The desktop page pill's adaptive look is on; the strip as GLS-9 left it | Superseded by GLS-20 | 2026-10-16 |
| [DSN-46](decisions/design.md) | One place per command, language in Settings (owner, R21 brief B-7, B-8, B-13) | In force (built: DSN-47, DSN-48; inventory `design/audit-2026-10-16-menus.md`) | 2026-10-16 |
| [DSN-47](decisions/design.md) | The title menu and the full edition's other menus under DSN-46 | In force | 2026-10-16 |
| [DSN-48](decisions/design.md) | The phone's menus under DSN-46 | In force; the phone Library's route to settings: DSN-51 | 2026-10-16 |
| [DSN-49](decisions/design.md) | The desktop and tablet top strip in separate glass pieces (owner, R21 brief B-4: "parça parça") | In force | 2026-10-16 |
| [DSN-50](decisions/design.md) | The Library in three tiers for the user tests (owner, R21 brief B-12, B-13, B-16) | In force; the owner's taste: the sample as a card after Recents, and the phone's new order | 2026-10-16 |
| [DSN-51](decisions/design.md) | The phone Library's way to settings (audit 2026-10-16, open question 1; DSN-46, DSN-48) | In force; amended 2026-10-17 (owner, R22 brief C-2: "Ayarlar simgesi dişli olsun"): the circle draws the icon set's gear (`gear-six`…) | 2026-10-16 |
| [DSN-52](decisions/design.md) | The QA read-through's rules (R21 brief B-16: "remove repeated text, everything tidy") | In force (`design/qa-2026-10-16.md`) | 2026-10-16 |
| [DSN-53](decisions/design.md) | One phone panel language: menus for commands, one sheet for everything else (owner, R22 C-11 option A) | Built (DSN-55) | 2026-10-17 |
| [DSN-54](decisions/design.md) | Said once, cancelled as its siblings (owner and lead, R22 brief C-3, C-4) | In force | 2026-10-17 |
| [DSN-55](decisions/design.md) | How the phone's one sheet is built (DSN-53) | In force; taste open: clear glass at rest, the drawer's rise from the edge, no ⋯ circle | 2026-10-17 |
| [DSN-56](decisions/design.md) | On the phone, toasts step aside for a scrim sheet | In force; taste settled by DSN-57 | 2026-10-17 |
| [DSN-57](decisions/design.md) | R22's open taste questions, settled by the lead under the owner's delegation | In force | 2026-10-18 |
| [DSN-58](decisions/design.md) | Modal sheets and dialogs say `aria-modal` (DSN-56's finding); toasts keep off a modal sheet | In force | 2026-10-19 |
| [DSN-59](decisions/design.md) | The grouped Markup palette (four labelled groups) is a prototype behind `?palette=groups` | Prototype; board question 3 | 2026-10-22 |
| [DSN-60](decisions/design.md) | Reading zoom stays uncapped on laptops (the R25 proposal to hold the page near 900 px is declined) | In force | 2026-10-22 |

## Motion

Full rows: [`decisions/motion.md`](decisions/motion.md).

| Id | Decision | Status | Date |
|---|---|---|---|
| [MOT-1](decisions/motion.md) | Springs on platform routes, no animation library | In force | 2026-10-04 |
| [MOT-2](decisions/motion.md) | Everything that changes shape animates | In force | 2026-10-09 |
| [MOT-3](decisions/motion.md) | Things come out of and go back into their triggers | In force | 2026-10-09 |
| [MOT-4](decisions/motion.md) | Rest is still | In force | 2026-10-04 |
| [MOT-5](decisions/motion.md) | One container transform for every popup and sheet | Done; its "never a scale" amended by MOT-9 | 2026-10-09 |
| [MOT-6](decisions/motion.md) | Owners of shared motion | In force | 2026-10-09 |
| [MOT-7](decisions/motion.md) | Scrims dim, they never blur | In force | 2026-10-10 |
| [MOT-8](decisions/motion.md) | B-2's cause: the phone's liquid motions drew nothing in WebKit; there they are clipped, not masked | Superseded by MOT-13 and MOT-14 (nothing is masked or clipped per frame) | 2026-10-16 |
| [MOT-9](decisions/motion.md) | Popups and sheets come out of the box (owner, R21 brief B-3) | In force | 2026-10-16 |
| [MOT-10](decisions/motion.md) | A mouse press is 0.96 (owner, R21 brief B-11: "a small springy scale") | In force | 2026-10-16 |
| [MOT-11](decisions/motion.md) | A shortcut forgets the last press | In force | 2026-10-16 |
| [MOT-12](decisions/motion.md) | Motion that never stutters (owner, R22 brief C-5): what cost frames, and the rule that follows | In force | 2026-10-17 |
| [MOT-13](decisions/motion.md) | The split top's menus grow out of their button on the compositor (C-5) | In force | 2026-10-17 |
| [MOT-14](decisions/motion.md) | The capsule and ✎ morph as one body on the compositor (C-5, DSN-43) | In force | 2026-10-17 |
| [MOT-15](decisions/motion.md) | The tabs' fill slides by one transform (C-5) | In force | 2026-10-17 |
| [MOT-16](decisions/motion.md) | The phone chrome hides and returns on a spring the scroll starts (owner, R22 brief C-6) | In force | 2026-10-17 |
| [MOT-17](decisions/motion.md) | Keys typed during a view change go where focus is going (Epic 2) | In force | 2026-10-21 |

## Glass

Full rows: [`decisions/glass.md`](decisions/glass.md).

| Id | Decision | Status | Date |
|---|---|---|---|
| [GLS-1](decisions/glass.md) | The glass lab is a page beside the app, never part of it | Done | 2026-10-15 |
| [GLS-2](decisions/glass.md) | Three tiers that degrade honestly, Current as the reference | In force | 2026-10-15 |
| [GLS-3](decisions/glass.md) | One optics model for every tier: the rounded-rect SDF with a polynomial smooth minimum for fused shapes; the… | In force | 2026-10-15 |
| [GLS-4](decisions/glass.md) | A backdrop-filtered layer is shaped by a mask, not by clip-path: path() | In force (WebKit clips instead, MOT-8) | 2026-10-15 |
| [GLS-5](decisions/glass.md) | GPU glass draws on change only | In force (lab) | 2026-10-15 |
| [GLS-6](decisions/glass.md) | How glass cost is measured in the lab: headless Chromium on SwiftShader, the production build, the backdrop… | In force | 2026-10-15 |
| [GLS-7](decisions/glass.md) | The glass direction the owner chose (R18 decision page) | In force | 2026-10-15 |
| [GLS-8](decisions/glass.md) | CSS+, the material every surface wears outside the GPU glass | In force, amended by GLS-17, GLS-21 (chip and bar tints), GLS-22 (the soft rim) and GLS-23 (menus on CSS+) | 2026-10-15 |
| [GLS-9](decisions/glass.md) | The adaptive look, technique | Superseded by GLS-20 (fixed tone) | 2026-10-15 |
| [GLS-10](decisions/glass.md) | The softened cost ladder, the iPhone start and the glass tier | In force | 2026-10-15 |
| [GLS-11](decisions/glass.md) | The Chromium lens on bars and capsules | In force | 2026-10-15 |
| [GLS-12](decisions/glass.md) | How GPU glass is built | Done | 2026-10-15 |
| [GLS-13](decisions/glass.md) | Who gets GPU glass, and the fallback | In force | 2026-10-15 |
| [GLS-14](decisions/glass.md) | What the GPU sees, and the legibility floor | In force | 2026-10-15 |
| [GLS-15](decisions/glass.md) | GPU glass optics and the scroll edge | In force, amended by GLS-18 (GPU blur at 0.8 σ) and GLS-22 (a 2.5 px soft rim band) | 2026-10-15 |
| [GLS-16](decisions/glass.md) | The adaptive turn fades tint, text and rim; the filter chain changes at once | Superseded by GLS-20 (no turn left to fade) | 2026-10-15 |
| [GLS-17](decisions/glass.md) | The light look of chips and bars takes a 0.50 tint (GLS-8 had 0.45), so its text holds AA in axe's own model | Superseded by GLS-21 (light tint 0.80, no turned piece for axe to measure) | 2026-10-16 |
| [GLS-18](decisions/glass.md) | GPU glass blurs at 0.8 of the piece's CSS σ | In force | 2026-10-16 |
| [GLS-19](decisions/glass.md) | GPU glass and liquid bodies; GPU glass follows the adaptive turn | In force for liquid bodies; its adaptive-turn half superseded by GLS-20 | 2026-10-16 |
| [GLS-20](decisions/glass.md) | The glass tone is fixed to the theme (owner, R21 brief B-1) | In force | 2026-10-16 |
| [GLS-21](decisions/glass.md) | How the fixed tone is built (GLS-20) | In force | 2026-10-16 |
| [GLS-22](decisions/glass.md) | The soft rim (owner, R21 brief B-5: "a thick line … it needs a soft falloff") | In force | 2026-10-16 |
| [GLS-23](decisions/glass.md) | One glass standard (owner, R21 brief B-10: "the pen preset menu still wears the old glass") | In force | 2026-10-16 |
| [GLS-24](decisions/glass.md) | One scroll bar, app-wide (owner, R21 brief B-6: "both in the PDFs and in every menu") | Amended by GLS-26 (the overlay replaces the CSS bar and the WebKit case) | 2026-10-16 |
| [GLS-25](decisions/glass.md) | Glass buttons: a lens of the same glass (owner, R21 brief B-11: "buttons that suit the glass … hover and click") | In force | 2026-10-16 |
| [GLS-26](decisions/glass.md) | A scroll bar worth having: one overlay of the glass for every scroller (owner, R22 brief C-10: "the point is that it… | In force (amends GLS-24) | 2026-10-17 |
| [GLS-27](decisions/glass.md) | The light theme's hover is a soft ink wash (lead's call, R22 brief C-7; owner: "a dark shade could work; I never use… | In force | 2026-10-17 |

## Ink

Full rows: [`decisions/ink.md`](decisions/ink.md).

| Id | Decision | Status | Date |
|---|---|---|---|
| [INK-1](decisions/ink.md) | One Highlighter, a lasso for every kind, one ink palette | In force | 2026-10-01, 2026-10-03 |
| [INK-2](decisions/ink.md) | Pens stay in the dock | In force | 2026-10-09 |
| [INK-3](decisions/ink.md) | The ink strip is its own floating piece | Done; one-layout rule in Audit §3.7 | 2026-10-08 |
| [INK-4](decisions/ink.md) | The pen's colour and size picker gets extra thought | In force | 2026-10-04 |
| [INK-5](decisions/ink.md) | Pen gestures are on, with care | In force | 2026-10-09 |
| [INK-6](decisions/ink.md) | The still-press tip ring is off | In force | 2026-10-09 |
| [INK-7](decisions/ink.md) | Key map v2 is accepted | In force | 2026-10-09 |
| [INK-8](decisions/ink.md) | The TR-Q rule | In force | 2026-10-09 |
| [INK-9](decisions/ink.md) | Hold to shape | Done | 2026-10-09 |
| [INK-10](decisions/ink.md) | A zoom in the middle of a stroke spends its hold | Done | 2026-10-12 |
| [INK-11](decisions/ink.md) | Before a pen is seen, every finger draws; the palm size rule needs a pen | In force | 2026-10-19 |
| [INK-12](decisions/ink.md) | App shortcuts that work from inside a text field: an allowlist (Save, Save a copy, Settings, ⌘K, Find, Open; Epic 2) | In force | 2026-10-22 |

## Editions

Full rows: [`decisions/editions.md`](decisions/editions.md).

| Id | Decision | Status | Date |
|---|---|---|---|
| [EDN-1](decisions/editions.md) | Three editions: web (V1), desktop (later) and phone | In force (ADR-0034 still to be written) | 2026-10-09 |
| [EDN-2](decisions/editions.md) | Web is V1: desktop browsers and iPad, browser-only, nothing installed, local, fast, every core job flawless | In force | 2026-10-09 |
| [EDN-3](decisions/editions.md) | Desktop comes later | In force | 2026-10-09 |
| [EDN-4](decisions/editions.md) | Phones get a read-only compact edition | In force | 2026-10-04 |
| [EDN-5](decisions/editions.md) | Phone editing may become V1; research it | In force (research); timing open | 2026-10-09 |
| [EDN-6](decisions/editions.md) | Tablets get the full edition | In force | 2026-10-04 |
| [EDN-7](decisions/editions.md) | The phone edition becomes editable, radically simple | In force; supersedes EDN-4's read-only rule once it ships | 2026-10-11 |
| [EDN-8](decisions/editions.md) | Phone editing takes architecture A, with a designed drawer | In force | 2026-10-11 |
| [EDN-9](decisions/editions.md) | The sample PDF is rewritten for phones | In force | 2026-10-11 |
| [EDN-10](decisions/editions.md) | The phone's rarely used sheets load on demand | In force | 2026-10-11 |
| [EDN-11](decisions/editions.md) | Phone editing's foundation (WP1) works through the full edition's gate and presets | In force | 2026-10-11 |
| [EDN-12](decisions/editions.md) | Adding text on phones (WP4): the island steps away while typing and a small Done rides on the keyboard | In force | 2026-10-11 |
| [EDN-13](decisions/editions.md) | Phone ink and highlight (lane B) | In force | 2026-10-11 |
| [EDN-14](decisions/editions.md) | Phone signing and saving (WP6, WP7) | In force; the drawer's closing superseded by EDN-18 | 2026-10-11 |
| [EDN-15](decisions/editions.md) | The phone Library's line names what the phone can do: "Pen, highlight, text and signature on your phone | In force; wording open to the owner | 2026-10-11 |
| [EDN-16](decisions/editions.md) | Two phone tool drawers, the owner picks after an iPhone test | In force; variant choice open to the owner; the close after the arming pulse superseded by EDN-18 | 2026-10-11 |
| [EDN-17](decisions/editions.md) | Editing text on phones (WP5) | In force; the iOS keyboard hand check is the owner's | 2026-10-11 |
| [EDN-18](decisions/editions.md) | The phone tool drawer stays open on a tap | In force | 2026-10-12 |
| [EDN-19](decisions/editions.md) | Office conversion is for desktop and tablet; the phone gets guidance, never the download | In force | 2026-10-19 |
| [EDN-20](decisions/editions.md) | iPad is claimed for Office conversion only after the owner's device check | In force; the check is the owner's | 2026-10-21 |

## Phone work

Full rows: [`decisions/phone-work.md`](decisions/phone-work.md).

| Id | Decision | Status | Date |
|---|---|---|---|
| [MOB-1](decisions/phone-work.md) | Forms fill on the phone by a tap, in reading too | In force (built, MOB-5) | 2026-10-14 |
| [MOB-2](decisions/phone-work.md) | Pinch out to see every page | In force (built 2026-10-14; column count and the button's form are the owner's to change). Technique (lane O): the morph completes at 45… | 2026-10-14 |
| [MOB-3](decisions/phone-work.md) | The overview is the phone's place for pages | In force (built 2026-10-14). Technique (lane O): in the overview's lazy chunk (`overview/page-actions.ts`, `tile-press.ts`…) | 2026-10-14 |
| [MOB-4](decisions/phone-work.md) | Desktop pages fixes before the phone uses them | In force (built; MOB-4a) | 2026-10-14 |
| [MOB-4a](decisions/phone-work.md) | How MOB-4 lands (technique, Lane D) | In force | 2026-10-14 |
| [MOB-4b](decisions/phone-work.md) | B7: a press during an overlay's exit reaches the page | In force | 2026-10-14 |
| [MOB-5](decisions/phone-work.md) | How phone form filling is built (MOB-1) | In force | 2026-10-14 |
| [MOB-6](decisions/phone-work.md) | Undo after a phone fill is the standard Undo toast, not the edit island | In force | 2026-10-15 |
| [MOB-7](decisions/phone-work.md) | The overview lands at 3 columns, or 2 for a document of 4 pages or fewer | In force (built 2026-10-15: `overviewColumns()` in `overview-gesture.ts`; the store keeps the pinched count, null until then) | 2026-10-15 |
| [MOB-8](decisions/phone-work.md) | Extract and Split on the phone go to the share sheet only | In force | 2026-10-15 |
| [MOB-9](decisions/phone-work.md) | The overview's resting bar has a visible Select | In force (built 2026-10-15: `OverviewBar.tsx`; the grid is named "Pages, 12 pages") | 2026-10-15 |
| [MOB-10](decisions/phone-work.md) | The title menu's Pages rows follow 01-frame §5: Insert pages from file… and Combine with open documents…; Merge files…… | In force (built: Lane D; Combine with open documents… with one document open asks for files) | 2026-10-15 |
| [MOB-11](decisions/phone-work.md) | The teaching sample becomes Margin No. 07 (TR Kenar), a magazine's press-week folder, one feature per page | In force (building; the owner approves the result) | 2026-10-15 |
| [MOB-12](decisions/phone-work.md) | One source, one file per edition and language | In force (building) | 2026-10-15 |
| [MOB-13](decisions/phone-work.md) | How MOB-11/12 are built (technique, sample lane) | In force | 2026-10-15 |
| [MOB-14](decisions/phone-work.md) | The sample's visual system v2: one night at Cape Ardıç | In force (building) | 2026-10-15 |
| [MOB-15](decisions/phone-work.md) | How MOB-14 is built (technique, sample lane) | In force | 2026-10-15 |
| [MOB-16](decisions/phone-work.md) | Dark reading (a night mode for the page itself): proposed, not built | Open: step 1 (Dim pages) built, MOB-17; step 2 (Dark pages) waits on the owner | 2026-10-15 |
| [MOB-17](decisions/phone-work.md) | How Dim pages is built (MOB-16 step 1; technique, on the lead's recommendation the owner left to the lead) | In force (built) | 2026-10-16 |
| [MOB-18](decisions/phone-work.md) | Phone edit mode scrolls (owner, R21 brief B-9): ✎ opens the edit island with the tool off | In force (built: `mark/bridge.ts` `enterEditing`; `compact-edit.spec.ts` scrolls with one finger before the chip arms Pen) | 2026-10-16 |

## Text editing

Full rows: [`decisions/text-editing.md`](decisions/text-editing.md).

| Id | Decision | Status | Date |
|---|---|---|---|
| [TXT-1](decisions/text-editing.md) | An emptied paragraph types in the style it had | In force | 2026-10-12 |
| [TXT-2](decisions/text-editing.md) | The layout never measures text with zero width | In force | 2026-10-12 |
| [TXT-3](decisions/text-editing.md) | Growth room counts what is drawn below, wherever it is drawn | In force | 2026-10-12 |
| [TXT-4](decisions/text-editing.md) | Substitute advances are measured as the written font draws them: whole thousandths of the em, truncated, as… | In force | 2026-10-12 |
| [TXT-5](decisions/text-editing.md) | The paragraph mirror lies on the drawn lines, topmost and hit-testable | In force; the iPhone hand check is the owner's | 2026-10-12 |
| [TXT-6](decisions/text-editing.md) | The mirror's DOM positions are read by counting text, and input acts on the browser's target range | In force | 2026-10-12 |
| [TXT-7](decisions/text-editing.md) | Code 32 is the space whenever the text page reads it as one | In force | 2026-10-12 |
| [TXT-8](decisions/text-editing.md) | Rewritten lines write a real space glyph at every word gap the font can draw | In force | 2026-10-12 |
| [TXT-9](decisions/text-editing.md) | The writer's verification checks the origins of glyphs with ink only | In force | 2026-10-12 |
| [TXT-10](decisions/text-editing.md) | A paragraph is justified however the stretch is made | In force | 2026-10-12 |
| [TXT-11](decisions/text-editing.md) | A line's right edge is its last glyph's advance end | In force | 2026-10-12 |
| [TXT-12](decisions/text-editing.md) | A straight gutter splits columns even when narrower than twice the page's space: at least twice the region's natural… | In force | 2026-10-12 |
| [TXT-13](decisions/text-editing.md) | The rewrap's word gap is the natural gap, never a stretched one | In force | 2026-10-12 |
| [TXT-14](decisions/text-editing.md) | A line is split into blocks only at gaps over 3 × the larger of the page's space and the line's own drawn word space | In force | 2026-10-12 |
| [TXT-15](decisions/text-editing.md) | A rewritten justified line may stretch as far as its paragraph's untouched lines do: the cap is the larger of 1.5 ×… | In force (lane 2 building) | 2026-10-12 |
| [TXT-16](decisions/text-editing.md) | Justified lines write their space glyphs too | In force | 2026-10-12 |
| [TXT-17](decisions/text-editing.md) | A double space reads back as two spaces | In force | 2026-10-12 |
| [TXT-18](decisions/text-editing.md) | The mirror's clipboard, compositions and clicks do not depend on its DOM or the engine | In force | 2026-10-12 |
| [TXT-19](decisions/text-editing.md) | A word wider than its line breaks inside itself, as CSS overflow-wrap: break-word does | In force | 2026-10-12 |
| [TXT-20](decisions/text-editing.md) | The sample's feature page sends the reader through Edit text, never a double-click | In force | 2026-10-22 |

## Redaction

Full rows: [`decisions/redaction.md`](decisions/redaction.md).

| Id | Decision | Status | Date |
|---|---|---|---|
| [RED-1](decisions/redaction.md) | A mark drawn over a redaction after it was applied does not stop the copy (unless flattened: refused, explained) | In force | 2026-10-22 |

## Process

Full rows: [`decisions/process.md`](decisions/process.md).

| Id | Decision | Status | Date |
|---|---|---|---|
| [PRC-1](decisions/process.md) | Browser (e2e) tests run last and never block work | In force | 2026-10-09 |
| [PRC-2](decisions/process.md) | Lanes and the heavy lock | In force | 2026-10-09 |
| [PRC-3](decisions/process.md) | No fixed 3-agent cap | In force; supersedes R12 §7 "at most three" and PLAN O-7. **Mode in force from 2026-10-10: Normal, started low** (2–3 agents; the lead…) | 2026-10-09 |
| [PRC-4](decisions/process.md) | Commits: Conventional Commits with a header of at most 100 characters and a lower-case subject, using the session's… | In force | 2026-09-26, restated 2026-10-09 |
| [PRC-5](decisions/process.md) | Two branches per project: dev and main | In force; ADR-0006's PR rule for `main` is not used until a release | 2026-10-09, restated 2026-10-10 |
| [PRC-6](decisions/process.md) | Language: the owner is addressed in Turkish | In force | 2026-10-09 |
| [PRC-7](decisions/process.md) | No new dependencies | In force | 2026-09-26 on |
| [PRC-8](decisions/process.md) | Mechanical work on a lighter model | In force | 2026-10-09 |
| [PRC-9](decisions/process.md) | Each deploy ends with an owner task script for the iPad | In force | 2026-10-09 |
| [PRC-10](decisions/process.md) | Work moves to production without delay | In force | 2026-10-04 |
| [PRC-11](decisions/process.md) | Bundle gates are not raised to fit a change | In force | 2026-10-10 |
| [PRC-13](decisions/process.md) | The family | In force | 2026-10-10 |
| [PRC-12](decisions/process.md) | Push a verified merge promptly | In force | 2026-10-10 |
| [PRC-14](decisions/process.md) | Motion e2e tests read the animation's clock, not frames | In force | 2026-10-11 |
| [PRC-15](decisions/process.md) | An e2e test that counts network fetches counts them at a server, not with page.route | In force | 2026-10-12 |
| [PRC-16](decisions/process.md) | The UI face's preload matches the engine's font fetch mode, so every engine fetches the file once | In force | 2026-10-12 |
| [PRC-17](decisions/process.md) | Work lands through pull requests, authored by the owner | In force | 2026-10-16 |
| [PRC-18](decisions/process.md) | What a pull request carries (R21 brief B-15) | In force | 2026-10-16 |
| [PRC-19](decisions/process.md) | settled() reads rest across a frame | In force | 2026-10-16 |
| [PRC-20](decisions/process.md) | What the first paint loads, and how a growth is traced (R22 bundle lane, C-9 B1/B3) | In force | 2026-10-17 |
| [PRC-21](decisions/process.md) | An e2e wait names the condition it stands for, never a fixed pause | In force | 2026-10-17 |
| [PRC-22](decisions/process.md) | One copy of the tiny helpers; dead exports go; observers and listeners audited (R22 X1–X3) | In force | 2026-10-17 |
| [PRC-23](decisions/process.md) | Model routing for agent lanes (owner) | In force | 2026-10-17 |
| [PRC-24](decisions/process.md) | Recto runs itself; the owner is the board | In force | 2026-10-18 |
| [PRC-25](decisions/process.md) | Minor quality changes ship without asking; major ones wait for the owner | In force | 2026-10-20 |
| [PRC-26](decisions/process.md) | The Office package in CI and the deploy: cached fetch, a required-package build, a 100 MB file gate, its own e2e job | In force | 2026-10-21 |
| [PRC-27](decisions/process.md) | Company reports in English; one small HQ improvement a day | In force | 2026-10-21 |
| [PRC-28](decisions/process.md) | Major work runs as epics; deep cycles, heartbeats and lane-sized check-ins; a daily fresh-eyes check | In force | 2026-10-21 |
| [PRC-29](decisions/process.md) | Agent skills adopted as our own texts (lean-change, verify-before-done, root-cause); Graphify skipped | In force | 2026-10-21 |

## Foundations (ADR titles)

Technical decisions, listed for completeness. Each ADR holds the detail.

| ADR | Decision | Date | Status |
|---|---|---|---|
| [0001](../adr/0001-license.md) | Apache-2.0; permissive dependencies only | 2026-09-26 | Accepted; amended by 0035 |
| [0002](../adr/0002-engine-stack.md) | PDFium in a worker renders and edits; pdf-lib assembles | 2026-09-26 | Accepted |
| [0003](../adr/0003-frontend-stack.md) | Vite, TypeScript, pnpm, React 19 with the React Compiler | 2026-09-26 | Accepted |
| [0004](../adr/0004-hosting-and-isolation.md) | Static hosting on GitHub Pages, workers, no cross-origin isolation | 2026-09-26 | Accepted; amended by 0035 (isolation after the Office package is installed) |
| [0005](../adr/0005-virtual-document-model.md) | Virtual document model; bytes produced once at export | 2026-09-26 | Accepted |
| [0006](../adr/0006-branching-and-versioning.md) | `main` releasable, `develop` integration, Conventional Commits | 2026-09-26 | Accepted (see PRC-5) |
| [0007](../adr/0007-delivery-targets.md) | Web first, desktop as escalation path | 2026-09-26 | Accepted; to be amended by ADR-0034 (EDN-1) |
| [0008](../adr/0008-qpdf-deferred.md) | qpdf built from source, behind `PdfPlumber` | 2026-09-26 | Done |
| [0009](../adr/0009-headless-primitives.md) | Base UI for dialogs, menus, popovers and more | 2026-09-27 | Accepted |
| [0010](../adr/0010-i18n-and-pwa.md) | Paraglide i18n; vite-plugin-pwa offline | 2026-09-27 | Accepted |
| [0011](../adr/0011-engine-hosting-for-content-editing.md) | Own PDFium worker with raw access | 2026-09-27 | Accepted |
| [0012](../adr/0012-ocr-hosting-and-language-packs.md) | Tesseract, self-hosted, opt-in language packs | 2026-09-28 | Accepted |
| [0013](../adr/0013-signature-validation-and-signing.md) | Validation on open that never says "valid"; PAdES-B signing | 2026-09-28 | Accepted |
| [0014](../adr/0014-recipe-format.md) | Batch recipe JSON format | 2026-09-28 | Accepted |
| [0015](../adr/0015-product-name.md) | The product name is Recto | 2026-10-01 | Accepted (owner) |
| [0016](../adr/0016-addresses-and-migration.md) | Portfolio root on github.io, project paths, migration | 2026-10-01 | Accepted (owner); custom domain later (PRD-4) |
| [0017](../adr/0017-versioning-and-releases.md) | `1.0.0-beta.N` first | 2026-10-01 | Accepted; the beta tag waits for the owner (PRD-1); PLAN DOC-5 proposes an amendment |
| [0018](../adr/0018-variable-width-ink.md) | Variable-width ink as a standard Ink annotation | 2026-10-01 | Accepted |
| [0019](../adr/0019-document-modes.md) | Home as a view; Read or Edit; Arrange as a view | 2026-10-03 | §2–§5 superseded by ADR-0029 |
| [0020](../adr/0020-paragraph-text-editing.md) | Paragraph editing Tier B; no reflow | 2026-10-03 | Accepted (owner) |
| [0021](../adr/0021-one-highlighter-lasso-palette.md) | One Highlighter, a lasso for every kind, one palette | 2026-10-03 | Accepted (owner); §4 superseded by ADR-0023 |
| [0022](../adr/0022-recto-glass-design-language.md) to [0028](../adr/0028-accessibility-gates-expressive-ui.md) | The Recto Glass language: layers, colour, glass, light, motion, type, accessibility | 2026-10-04 | Accepted (owner) |
| [0029](../adr/0029-viewing-markup-and-lock.md) | Viewing with targeted acts, one Markup state, Lock, Pages grid | 2026-10-04 | Accepted (owner) |
| [0030](../adr/0030-can-change-guard.md) | `canChange(id, act)`; Lock enforced in `commit()` | 2026-10-04 | Accepted (owner) |
| [0031](../adr/0031-size-class-shell.md) | Size-class shell: top strip, dock, sidebar, sheets, page pill, Library | 2026-10-04 | Accepted (owner) |
| [0032](../adr/0032-saving-restore-history.md) | Save in place, snapshots on the device, visible Undo | 2026-10-04 | Accepted (owner) |
| [0033](../adr/0033-compact-edition.md) | Full app on desktops and tablets; read-only compact edition on phones | 2026-10-04 | Accepted (owner) |
| [0034](../adr/0034-editions.md) | Editions: full app on desktops and tablets, the phone edition editable since EDN-7, desktop later; amends 0033 and 0007 | 2026-10-17 | Accepted (records EDN-1 to EDN-3, EDN-7) |
| [0035](../adr/0035-on-device-office-conversion.md) | On-device Office to PDF: LibreOffice pinned and served from our origin, on consent, isolation by our service worker; amends 0001 and 0004 | 2026-10-20 | Accepted (records PRD-18, EDN-19) |
