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

**Ids.** Rows carry a log id (PRD, DSN, MOT, INK, EDN, PRC) so they never clash with the
sources' own ids (R12's D-1 to D-5, PLAN's P-1 to P-8, the feedback's F and G items), which each
row quotes.

**Adding a row.** Add it in the right area with its date and source, and mark any row it replaces
as superseded. Owner rules given only in conversation are recorded here, and this file is their
source ("owner, conversation").

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

| # | Decision | Date | Source | Status |
|---|---|---|---|---|
| PRD-1 | **Only the owner declares V1 and "beta v1".** V1 = Recto 1.0.0, when the owner says so. Nothing is tagged beta, and no release PR or tag is made, until the owner says the word. | 2026-10-04, restated 2026-10-09 | Spec §14 item 6; PLAN header, V1-R6, P-4; owner, conversation | In force |
| PRD-2 | **Each extra feature is measured** (hours, work packages, necessity, impact, risk) and reported. The owner decides V1 or later for each row. | 2026-10-09 | Sheet; owner, conversation | In force; sheet awaits the owner's marks |
| PRD-3 | **VoiceOver and extra accessibility are not V1 requirements.** E27 and E34 move after V1. V1 rows carry no VoiceOver work. The ADR-0028 CI gates still apply. | 2026-10-09 | Sheet "Owner rules applied"; owner, conversation | In force; PLAN V1-A7 to be amended to match |
| PRD-4 | **The URL stays on github.io.** No custom domain for now (PLAN P-5 stays "later"). | 2026-10-09 | Owner, conversation; PLAN V1-R5, P-5; ADR-0016 | In force |
| PRD-5 | **The name is Recto.** "Recto PDF" is the descriptor. Trademark searches are recommended before a public launch, as the owner's call. | 2026-10-01, 2026-10-04 | ADR-0015; Spec §14 item 4 | In force |
| PRD-6 | **Presentable first.** The new UI/UX (layout, look, motion, core use) is finished before rarely used features, which follow as updates. | 2026-10-05 | `specs/redesign.md` §11, "Reorder of 2026-10-05" | In force |
| PRD-7 | **Documents open unlocked** (`openDocumentsLocked` false). Signed and restricted files still open locked (W1-b). | 2026-10-04 | Spec §14 item 1; ADR-0029 | In force |
| PRD-8 | **Documents are kept on the device.** Open ones with their changes. Closed ones stay in Recents for 30 days or 500 MB, listed and clearable. | 2026-10-04 | Spec §14 item 2; ADR-0032 | In force |
| PRD-9 | **No on-device model dependency for now** (D-1). Revisit after W3 with one opt-in embedder served from Recto's origin. Models belong to desktop (DT-10). | 2026-10-09 | R12 Owner decisions D-1 | In force |
| PRD-10 | **Flashback is on** (D-2): always on in the installed app, and on with a visible storage notice in Safari tabs. Redaction "befores" are never kept without opt-in. | 2026-10-09 | R12 D-2 | In force; the sheet suggests S8 after V1, which is still open |
| PRD-11 | **Paragraph text editing:** Tier B is built. Tier C (push later blocks down) and Tier D (reflow across pages) are declined. | 2026-10-03 | ADR-0020 | In force |
| PRD-12 | **Standing promises:** no telemetry, no analytics, no account, in every edition. Web page code keeps `connect-src 'self'`. | 2026-09-26, restated 2026-10-09 | PLAN §1.2; ADR-0004 | In force |
| PRD-13 | PLAN §6 questions O-1 to O-9 (edition split, Must list, spice, ◇ candidates, perf runs, concurrency, phone pilot, desktop questions). | 2026-10-09 | PLAN §6 | Open, except as covered by EDN-1 to EDN-6 and PRC-3 below |
| PRD-14 | **W0-q findings are assigned to waves:** signed fixture opens locked and saves byte-identical (W1-a/W1-b), `truncated.pdf` repaired (W1-g), press budgets (W1-f, viewer-read, Compare as a place), "go back" after a link (S1-1, W2). | 2026-10-09 | PLAN "W0-q findings" | In force; W1-b and W1-g merged |

## Design

| # | Decision | Date | Source | Status |
|---|---|---|---|---|
| DSN-1 | **The visual design system comes first.** Invisible technical cleanup runs in the background. | 2026-10-09 | Owner, conversation; Audit intro; Sheet "Happening anyway" | In force |
| DSN-2 | **Recto Glass:** content is solid, controls are glass, light lives beneath glass. Eight principles. A light theme equal to dark. One source of values (`tokens.css`). | 2026-10-04 | ADR-0022 | In force |
| DSN-3 | **Colour roles:** one lime `#c8fb3d` for accent, focus and brand. A blue `#4e61ed` for selection on the page. Cool graphite neutrals. | 2026-10-04 | ADR-0023 | In force |
| DSN-4 | **Glass:** five tiers (M1 chip to M5 sheet) plus lit glass. A coverage rule. One setting, Clear · Tinted · Solid. A separate automatic cost ladder. No grain. | 2026-10-04 | ADR-0024; `quality-bar.md` Q-1 | In force |
| DSN-5 | **Light:** an in-house aurora that is still by default and answers events. Setting Ambient light Auto · Still · Off. | 2026-10-04 | ADR-0025 | In force |
| DSN-6 | **Type and icons:** Inter as `'Inter Recto'`, sentence case, tabular numbers. Phosphor outline at rest, fill when selected. | 2026-10-04 | ADR-0027 | In force |
| DSN-7 | **Taste:** the concept is approved (labelled dock from medium width up, lime fills, light on the empty Library, Phosphor). Its faults must not ship. Gates Q-1 to Q-14 hold. Every control, menu and bar is consistent (Q-9). | 2026-10-04 | Spec §14 item 3 | In force |
| DSN-8 | **Floating glass pieces,** no stacked bars. The top strip is pieces over the canvas. The Pages grid has no second header bar. | 2026-10-08 | R10 F1 | Done |
| DSN-9 | **Pop-ups fit.** Every popover, panel and sheet is capped to the free viewport and scrolls inside. | 2026-10-08 | R10 F2 | In force |
| DSN-10 | **Pages grid selection follows Photos.** A tap opens. Selection starts from Select, long-press, a modifier click or the hover check. The look is an accent ring and an inset check badge, no wash. | 2026-10-08 | R10 F4 | Done |
| DSN-11 | **Brand in the app:** the mark on the Library tab, the favicon and the PWA icons. The Library gets an aura from the logo's colours. | 2026-10-08 | R10 F5 | Done |
| DSN-12 | **One size scale for every floating piece** (G1): `--piece-h` 40 fine and 48 coarse, one inset, the capsule radius, 20 px glyphs, body labels. | 2026-10-09 | R11 G1; `tokens.css` | Done |
| DSN-13 | **The Library title** (G3). The tab keeps the mark. The page header has a large "Library" title, no second mark. The aura is richer and drifts slowly. | 2026-10-09 | R11 G3; Audit resolution 4 | In force |
| DSN-14 | **Glass gloss is a hairline** specular edge, not a thick white band (G4). | 2026-10-09 | R11 G4 | In force |
| DSN-15 | **The reader background glow is on by default** (subtle), with a Settings switch to turn it off (G5). | 2026-10-09 | R11 owner answer G5; Audit resolution 3 | In force; supersedes R11's first lead note (default off) |
| DSN-16 | **Selection uses the app's lime accent** (G7), consistent with the focus language but distinct from the focus ring. | 2026-10-09 | R11 G7 | In force |
| DSN-17 | **Light-theme focus: option A**, the outset ring, so focus reads the same in both themes. | 2026-10-09 | Audit resolution 1 | In force |
| DSN-18 | **Light glass:** lower the M1/M2 light tints toward the `tokens.test.ts` floor. | 2026-10-09 | Audit resolution 2 | In force |
| DSN-19 | **Selected vs current:** selected = lime ring and filled badge. Current = a neutral 1 px ring and a 600 label. | 2026-10-09 | Audit resolution 5 | In force |
| DSN-20 | **The final system** of Audit §3: 4 px grid, concentric radii, three control sizes (S/M/L), type ramp per surface, one recipe per surface, one sheet grammar, icon sizes {12 badges, 16, 20, 32}, the ratchet gates. | 2026-10-09 | Audit §3 | In force (lane work in progress) |
| DSN-21 | **Accessibility gates:** A-1 to A-24 as CI gates. One focus ring (ink, lime, ink). A "plain" project runs the whole suite. | 2026-10-04 | ADR-0028 | In force; the extra items of PRD-3 are not V1 |

## Motion

| # | Decision | Date | Source | Status |
|---|---|---|---|---|
| MOT-1 | **Springs on platform routes, no animation library.** Seven springs, four eases, View Transitions capped at 240 ms, an in-house core under 3 KB gzip. Reduced motion is defined per token. | 2026-10-04 | ADR-0026 | In force |
| MOT-2 | **Everything that changes shape animates** with the shared springs: tab switch, open and close, menus from their buttons, undo and redo, Save appearing, pieces growing. Menus scale from their anchor. Content cross-fades. Reduced motion: opacity only, at most 150 ms. | 2026-10-09 | R11 G6 | In force |
| MOT-3 | **Things come out of and go back into their triggers** (the R14 motion brief). A surface opens from the control that opened it and closes back into it. | 2026-10-09 | Owner, conversation (R14 brief); `language.md` §7.3 *popup* | In force |
| MOT-4 | **Rest is still.** Nothing loops in a document view. Motion answers an event. | 2026-10-04 | ADR-0022 principle 5 | In force |

## Ink

| # | Decision | Date | Source | Status |
|---|---|---|---|---|
| INK-1 | **One Highlighter, a lasso for every kind, one ink palette.** Variable-width ink is a standard Ink annotation with our appearance. | 2026-10-01, 2026-10-03 | ADR-0018; ADR-0021 | In force |
| INK-2 | **Pens stay in the dock.** The ink strip shows only the armed pen's colour (wheel plus a few recents, no fixed swatch row that repeats the pens) and its width, like Apple Notes. Another pen is one press in the dock, never in the strip. | 2026-10-09 | R11 owner answer G8; `components/10-ink.md` | In force |
| INK-3 | **The ink strip is its own floating piece** above the dock, hugging its content. It has a glass-lens slider thumb. The notch bug is removed, and Markup and Fill & sign get distinct glyphs. | 2026-10-08 | R10 F3 | Done; one-layout rule in Audit §3.7 |
| INK-4 | **The pen's colour and size picker gets extra thought.** Every colour option and slider is modern and Apple-like. | 2026-10-04 | Spec §14, standing requirements | In force |
| INK-5 | **Pen gestures are on, with care** (D-3). They come with a first-use tip, a confidence threshold, a visible preview before commit, one-step undo, and tests for near-miss strokes. | 2026-10-09 | R12 D-3 | In force |
| INK-6 | **The still-press tip ring is off** by default (D-3). Barrel, right-drag and hold W stay on. | 2026-10-09 | R12 D-3 | In force |
| INK-7 | **Key map v2 is accepted** (D-4) as one PR: hold B for Before, Z / Shift+Z back and forward, hold W for the ring, and the rest of R12 §3.1. | 2026-10-09 | R12 D-4, §3.1 | In force |
| INK-8 | **The TR-Q rule** (D-5). No feature depends on `\`, `[`, `]` or an AltGr chord. Every symbol key has a letter or on-screen twin. Keys are tested on a Turkish Q layout. | 2026-10-09 | R12 D-5 | In force |

## Editions

| # | Decision | Date | Source | Status |
|---|---|---|---|---|
| EDN-1 | **Three editions:** web (V1), desktop (later) and phone. One build, no fork. | 2026-10-09 | Owner, conversation; PLAN §1.1; `plan/v1/editions.md` | In force (ADR-0034 still to be written) |
| EDN-2 | **Web is V1:** desktop browsers and iPad, browser-only, nothing installed, local, fast, every core job flawless. | 2026-10-09 | Owner, conversation; `editions.md` | In force |
| EDN-3 | **Desktop comes later.** It holds My info autofill, API connectors and local models (placement rule, PLAN §1.2). API connections are "much later". | 2026-10-09 | Owner, conversation; PLAN §5.2 | In force |
| EDN-4 | **Phones get a read-only compact edition** in V1, a different interface from the desktop's. | 2026-10-04 | ADR-0033; Spec §14 | In force |
| EDN-5 | **Phone editing may become V1; research it.** M10-R (study) and M10-P (prototypes A and B behind a lab flag) may run beside V1 waves. The owner chooses when the track opens. | 2026-10-09 | Owner, conversation; PLAN O-8; Sheet "Notes" | In force (research); timing open |
| EDN-6 | **Tablets get the full edition.** Desktop and tablet come first. | 2026-10-04 | ADR-0033; `CLAUDE.md` | In force |

## Process

| # | Decision | Date | Source | Status |
|---|---|---|---|---|
| PRC-1 | **Browser (e2e) tests run last and never block work.** Implementers verify with format, lint, typecheck, focused unit tests and screenshots. The full cross-engine matrix is needed only before a deploy the owner will look at. | 2026-10-09 | Owner, conversation; Workflow "Browser tests run last" | In force |
| PRC-2 | **Lanes and the heavy lock.** Packages own disjoint lanes. Heavy commands go through `tools/dev/heavy.sh`. Platform merges first in its wave. | 2026-10-09 | Workflow | In force |
| PRC-3 | **No fixed 3-agent cap.** Concurrency follows the budget mode: Burst, Normal, or Safe/minimal. After a burst window the default is Safe until the owner raises it. | 2026-10-09 | Owner, conversation; Workflow "Budget modes" | In force; supersedes R12 §7 "at most three" and PLAN O-7 |
| PRC-4 | **Commits:** Conventional Commits with a header of at most 100 characters and a lower-case subject, using the session's trailers. | 2026-09-26, restated 2026-10-09 | ADR-0006; `CLAUDE.md`; owner, conversation | In force |
| PRC-5 | **Push only to `develop`.** No pull requests unless the owner asks. | 2026-10-09 | Owner, conversation | In force; ADR-0006's PR rule for `main` is not used until a release |
| PRC-6 | **Language:** the owner is addressed in Turkish. Repository docs, code and comments are in English. Turkish UI strings are proper Turkish. | 2026-10-09 | Owner, conversation; `CLAUDE.md` | In force |
| PRC-7 | **No new dependencies.** No AI model name in code, comments or docs. | 2026-09-26 on | `CLAUDE.md`; R12 §9 | In force |
| PRC-8 | **Mechanical work on a lighter model.** Design and interaction work uses the default model. | 2026-10-09 | Workflow "Briefs" | In force |
| PRC-9 | **Each deploy ends with an owner task script for the iPad.** | 2026-10-09 | Workflow "Merging"; PLAN §4.9 | In force |
| PRC-10 | **Work moves to production without delay** once a plan is ready, with no visual or system defects shipped. | 2026-10-04 | Spec §14, standing requirements | In force |

## Foundations (ADR titles)

Technical decisions, listed for completeness. Each ADR holds the detail.

| ADR | Decision | Date | Status |
|---|---|---|---|
| [0001](../adr/0001-license.md) | Apache-2.0; permissive dependencies only | 2026-09-26 | Accepted |
| [0002](../adr/0002-engine-stack.md) | PDFium in a worker renders and edits; pdf-lib assembles | 2026-09-26 | Accepted |
| [0003](../adr/0003-frontend-stack.md) | Vite, TypeScript, pnpm, React 19 with the React Compiler | 2026-09-26 | Accepted |
| [0004](../adr/0004-hosting-and-isolation.md) | Static hosting on GitHub Pages, workers, no cross-origin isolation | 2026-09-26 | Accepted |
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
