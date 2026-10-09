# Earlier planning: inventory of planned but unfinished ideas (r13)

Date 2026-10-09, tree `8a78589` (develop). Sources: `docs/ROADMAP.md` (M1–M11), `docs/DISCUSSION.md`,
`docs/VISION.md`, `docs/specs/*.md` (redesign §9–§15 especially), `docs/design/redesign-2026-10/`,
`docs/adr/0007`, the specs' "Out of scope" sections and the deferred and follow-up notes in docs.
Status was checked against `apps/web/src`, `packages/*` and `git log`, not taken from the docs.

**Status:** done · partial (what is missing) · not started.
**Edition:** `web-v1` (needed for, or cheap and valuable before, V1 on desktop browsers and iPad) ·
`web-later` (web, after V1) · `desktop` (installable edition: personal data, profiles, network,
native capabilities, heavy components) · `phone` (M10 editable phone edition) · `owner` (an action
or a decision only the owner can take).

**Out of date in the docs:** the ROADMAP's M9 table still says "planned" for every D-row,
although D0, most of D1 and the V2 set (D2-1…D2-5, D2-7, D2-9, D2-10, D3-1…D3-7, D4-1, D4-2)
are built and deployed. The spec's §15 "As built" is empty. VISION's non-goal "native desktop
apps (a Tauri wrapper is a v3 consideration)" and §11.6's "at most three implementers" no longer
match the owner's direction of 2026-10-09. ADR-0007 (web first; desktop = the same UI with extra
capabilities, chosen at run time) already matches the new two-edition direction and can anchor it.

---

## A. M9 packages parked as "updates after V2" (redesign §11.6, reorder of 2026-10-05)

| Id | Title | What | Status (code-checked) | Edition |
|---|---|---|---|---|
| D1-3 | Lock in `commit()` | Every committing act refused for a locked document inside `workspace-store.commit()`; engine edits ask first and replay their inverse on refusal; X11 shared-page rule | **not started**: the lock is enforced through `canChange` (`state/guard.ts`) at command and tool level; `workspace-store.ts` reads the lock store only for `lockOpened` (l. 592), and the guard's comment still says "From D1-3" | web-v1 (correctness: "locked bytes unchanged" is a promise the UI already makes) |
| D1-4 | Lock UI beyond the title menu | Four reasons; `signed` and `restricted` locked on open; Unlock popover at the refusing control; "Open documents locked" setting; Lock in ⌘K; tab glyph | **partial**: `shell/frame/LockSwitch.tsx` (reasons, "Unlock anyway" for signed/restricted), tab-menu lock, Library card badges, tab names "…, locked". Missing: nothing ever locks with `signed`/`restricted` (only `'user'` is passed); no setting UI for `openDocumentsLocked` (store only); no ⌘K Lock command; no popover at the refusing control | web-v1 (signed-on-open protects signatures); setting and ⌘K web-later |
| D1-6 | Targeted acts | ContextBar; selection bar everywhere (Highlight, Underline, Strikeout, Comment, Redact, Edit text, Copy); H U S C X; E then Enter; field/image bars; page menu "Add … here"; pending-marks bar; `ui/anchor/place.ts` | **partial**: selection bar (`annotations/ReadSelectionBar.tsx`) and keymap rows for highlight, underline, strikeout, redact (`commands/keymap.ts` 222–240). Missing: no ContextBar, no "Add … here" page-menu strings, no pending-marks bar (only a comment in `shell/review/ReviewPanel.tsx`), no E-then-Enter | web-v1 for the pending-marks bar and E→Enter (fast, high value); rest web-later |
| D1-8 | Sheets with acts | Document info, password, certificate, signatures, furniture, crop, OCR, apply redactions, find sensitive data as sheets with `canChange` acts and lock banners | **partial**: sheets for OCR, Apply redactions, Document info, Save a copy, Batch, page-structure sheets, New signature; lock banner strings exist (`sheet_locked`). Still Base UI dialogs: `furniture/FurnitureDialogs.tsx`, `crop/CropDialog.tsx`, `stage/ResizeDialog.tsx`, `signatures/SignDialog.tsx`, `shell/PasswordDialog.tsx`, `stage/OperationDialogs.tsx` | web-v1 (consistency, Q-9: dialogs left over in a sheet-based app read as unfinished) |
| D2-6 | Compare as a place | Full-screen Compare with chooser, Changes list, Compare bar, compact A · B · Changes, report, failure state | **not started**: `compare/CompareView.tsx` is still the M5 stage view (setup form, side by side, onion skin) | web-v1 (a flagship feature in README and media; it must match the new shell) |
| D2-8 | ⌘K v2 | Selection-first results, typed arguments in EN and TR ("rotate 3 left", "go 12"), capability list, keycaps, per-device recents, no scrim | **partial**: palette with fuzzy search, keycaps, recents and palette groups (`shell/CommandPalette.tsx`); no argument parser, no selection-first ranking | web-later (overlaps innovation E10) |
| D3-8 | Light (aurora) | `light/` field and CSS fallback, gates and pauses, `textSafe`, light-event service, under-light beneath the armed tool, processing ring, success bloom; Ambient light Auto · Still · Off | **partial**: Library aura (`home/Aura.tsx`, CSS), `home/text-safe.ts`, Save's success bloom (`SaveButton.tsx`). Missing: no `light/` module, no under-light, no light-event service, no Ambient light setting. Waits for the brand kit's mint stop | web-later (decorative; budget ≤ 4 KB) |
| D3-9 | Accessibility gates in CI | A-1…A-24 blocking; 16-combination matrix; plain project; target audit; Turkish casing and 1.4.12 checks; bans on `capitalize` and argument-less `toUpperCase()`; uppercase section labels removed | **partial**: `e2e/a11y.spec.ts`, focus scan, contrast tests in `styles/tokens.test.ts`. Missing: no lint ban (25 files call `toUpperCase()`, 4 use `capitalize`), 6 CSS rules still `text-transform: uppercase`, no matrix project | web-v1 (Turkish casing is a correctness bug for a TR app: `i`→`I` instead of `İ`) |
| D4-3 | Facts chip | One fact per file on open routes a scan to OCR, a form to Fill & sign; once per file (`facts-seen:v1`) | **not started** (Document info has `DocumentFacts.tsx`; no chip, no seen key) | web-v1 (onboarding flow; overlaps innovation E9a triage card) |
| D4-4 | Polish | Empty states, honesty notice, haptics (Android), copy-check EN/TR, decisions from the five-person test and prototype checks | **partial**: `ui/EmptyNote.tsx` in ten places, haptics in drag, slider, zoom and straighten; the five-person-test decisions do not exist (test not run) | web-v1 |
| D4-5 | Media | Scenes and social image re-recorded through the new shell, both themes | **partial**: scenes re-recorded through V2 (commits `3824703`, `791d441`); not after the R11/R12 visual changes, no light-theme pass | web-v1 (after the UI freeze) |
| D4-6 | README | Hero and screens of the redesigned app, every claim backed | **partial**: README links live media; hero is the old Pages-grid shot | web-v1 (after freeze) |
| D4-7 | About page v2 | Eight sections with the owner's mark, settling aurora or poster, ≤ 300 KB | **partial**: `apps/web/about/` has 7 h2 sections, a glyph SVG, light scheme; not the brand plan §8 structure, no mark artwork | web-v1 (after freeze) |
| D4-8 | Brand | Icon set, apple-touch, favicon, maskable, manifest colours, social card, wordmark, `TRADEMARKS.md` | **partial**: icons and favicon from the owner's logo (`e6619a3`, `apps/web/public/icons/`), manifest colours set (`vite.config.ts` 152). Missing: social card from the kit, wordmark, `TRADEMARKS.md` | web-v1 (rest of kit) |
| D4-9 | Docs | DESIGN amendments B1–B15, ROADMAP current, redesign §15 "As built", changeset | **not started** (§15 empty; ROADMAP M9 rows stale) | web-v1 |
| D4-10 | Press kit | `/recto/about/press/`, fact sheet EN/TR, zip per release | **not started** | web-later (owner kit) |
| D4-11 | Case study v1 | In the portfolio repository after the UI freeze | **not started** (the portfolio repo `ErenDenizK.github.io` does not exist yet) | owner + web-later |

## B. The rest of M9 that is not finished

| Id | Title | What | Status | Edition |
|---|---|---|---|---|
| XD-1 | Five-person test | Two think-aloud sessions (S3, S7, S9, tab ●, tablet tooltips; E→Enter, form fields, Compare) with a decision rule on the lock default | not started | owner (recruiting) · web-v1 input |
| XD-2 / OM1–OM6 | Owner measurements | OM1 glass frames with dock and palette (Chrome GPU, Safari); OM2 edge-leak probe; OM3 Safari `var()` in `-webkit-backdrop-filter`; OM4 aurora banding and energy; OM5 phone and tablet run (S-T1…S-T5); OM6 pen latency on the owner's laptop and the mouse/tablet try-out | not run; safe defaults ship (§9.2) | owner · web-v1 (OM1, OM5 tablet, OM6 matter most) |
| XD-3 rest | Review tracks left (task 28) | Tablet tab strip (B2), bar heights, focus after open; compact sheets see-through; Library empty state; history scrubber dims; glass seams; text preview order | partial (open in the task list) | web-v1 |
| R11 | Owner's iPad notes | Sizes, Library, glass, selection colour (A); motion (B); palette dedupe (C) | partial: commits up to `fc52682` merged the size scale, Library title and aura, glow, lime selection, motion pass; task 32 still open | web-v1 |
| §10.5 | M9 exit | Every drop's exit; `jobs.spec.ts` step counts in Chromium and tablet; A-1…A-24 blocking in three engines plus `chromium-nogpu` and `plain`; §9.1 budgets on CI; reviews without blocker | partial: `jobs.spec.ts` exists; no budget job in `ci.yml`; A-gates not all blocking | web-v1 (becomes part of the V1 criteria) |
| §9.1 | Performance budgets in CI | Initial JS ≤ +10 % over M8, fonts 98 KB, icons ~18 KB, sample ≤ 250 KB, zero frames at rest, snapshot writes ≤ 8 ms | partial: `motion.spec.ts`, `glass-perf.spec.ts`, about-page budget; no bundle or load-time gate | web-v1 (the "super fast" promise needs a gate) |

## C. Follow-ups left in the earlier milestones (M1–M8)

| Id | Title | What | Status | Edition |
|---|---|---|---|---|
| M1-a | Deeper split by outline | Split at any outline level; titles from bookmarks in every mode | not started (top level only) | web-later |
| M1-b | JPEG EXIF orientation; GIF/HEIC pages | Rotate camera JPEGs per EXIF when inserted; accept GIF, HEIC | not started (no EXIF code anywhere) | web-v1 for EXIF (phone photos come in sideways, cheap); HEIC desktop (decoder size) |
| M1-c | Form-widget warning on duplicated pages | Badge when a duplicated page carries fields (light-table spec §5) | not started | web-later |
| M1-d | Engine warnings in TR | Export-summary engine warnings are English only | not started | web-v1 (complete Turkish is a 1.0 criterion) |
| M2-a | Unicode free text | Embedded font for FreeText; today standard fonts only (`pdfium/annotation-mapping.ts` 105–113, WinAnsi) | not started (to verify in the app with ğ ş ı İ, which WinAnsi lacks) | **web-v1** (Turkish text boxes) |
| M2-b | Stamp opacity | Opacity on stamps without a post-pass | not started | web-later |
| M2-c | Arrow-key nudge; multi-select across pages | Nudge selected annotations; selection over several pages | partial (lasso moves; no arrow nudge confirmed) | web-v1 (keyboard parity, cheap) |
| M2-d | Undo of a delete on an imported annotation | Restores custom appearances, rich text, unmapped keys | not started (rebuilt from mapping) | web-later (engine) |
| M3-a | Exotic encryption via qpdf | qpdf fallback for unusual security handlers | not started | web-later |
| M3-b | Compression | Gray/CMYK kept as such (today re-encoded as RGB); font subsetting | not started | web-later (optimisation track) |
| M3-c | Removable watermark | `/Watermark` annotation mode | not started | web-later |
| M3-d | Repair e2e | End-to-end test for Save repaired copy | not started | web-v1 (test only) |
| M4-a | Forms | `/Tabs` written; push-button actions; fields on duplicated pages | not started | web-later |
| M4-b | Outline from headings | Generate bookmarks from headings or the structure tree | not started | web-later (overlaps innovation E7) |
| M4-c | Trim to content | Crop to content bounds (needs image and vector bounds from the engine) | not started (`crop/CropDialog.tsx` 18) | web-later |
| M4-d | Text-edit edge cases | Lines split into several runs; `checkEditability` outside the queue; `/Sig` placeholders read as signed | partial | web-v1 for the `/Sig` misreport (wrong status shown), rest web-later |
| M5-a | Compare "as opened" side | Compare a document with its state at open | not started | web-v1 if D2-6 is done (cheap with snapshots; overlaps innovation S2 Changes lens) |
| M5-b | OCR engine tests in Firefox and WebKit | Spec asks for three engines | not started (Chromium only) | web-v1 (test) |
| M5-c | Signature visual check cost | Every page rendered once per signature at 50 dpi | open | web-later (optimisation) |
| M5-d | Language pack "kept offline" vs cached | Store cannot tell them apart | open | web-later |
| M6-a | Pen burst defaults on a real tablet | N 1.5 s, D 36 pt to try with the owner | not run | owner (OM6) |
| M6-b | Variable width in other editors | Viewers that rebuild ink show one width | by design, honesty line | — |
| M8-a | Event-to-draw p95 and long tasks | 11–18 ms vs 4 ms; 4–5 long entries per 64-stroke burst; 5,000-sample stroke settles in 165–229 ms; tiles re-render at tiled zoom | open | **web-v1 optimisation** (internal, no UI change) |
| M8-b | P14 `pointerrawupdate`, Ink API | Lower input latency where supported | not started (conditional on OM6) | web-later (single-engine extra, hidden) |
| M8-c | Tag dots at full chroma, raised accent alphas | Palette leftovers | not done; partly superseded by D3-2 lime | — (check against D3-2, likely drop) |
| M8-d | Paragraph editor leftovers | Join with next, Split here (hidden); IME candidate window at the caret; ligatures written as two glyphs; serif paragraph refuses an arrow Inter has; false honesty line for full fonts; ragged line after a TeX hyphen; close commits a non-overlapping draft; two substitute fonts listed under one | not started | web-v1 for IME position (CJK/TR input methods) and the false honesty line; rest web-later |
| M8-e | Real Word and LibreOffice exports in the corpus | Golden read-backs on the most common producers | not started | web-v1 (test coverage of the headline text-edit claim) |
| M8-f | Lasso and eraser leftovers | Stamps keep orientation under rotation (needs `/Matrix`); line and shape widths do not scale on resize; no highlighter erase filter; no live cut preview | not started | web-later (live cut preview web-v1 if cheap: it is the "feel" of the eraser) |
| M8-g | Policy leftovers | First-click hint covers next line; Forms panel's Add field and Clear visible but inert when locked; note click while locked opens no read-only popover; one-line editor header under the title bar | partial (some superseded by the M9 shell) | web-v1 (re-check each in the V2 shell; inert visible buttons fail "flawless") |
| M8-h | Glass cost in the Pages grid | p95 frame time rises with docked glass | open (cost ladder from D3-3 mitigates) | web-v1 optimisation (measure on OM1) |
| M8-i | Small misc | `4` announces in Compare; Compare's second file not in Recents; flaky timing test | open | web-v1 (cheap) |

## D. Release, presentation and owner steps (DISCUSSION #26–#34)

| Id | Title | What | Status | Edition |
|---|---|---|---|---|
| P-1 | Trademark search | RECTO in USPTO 9/42, EUIPO, TÜRKPATENT before a public launch | not done | owner |
| P-2 | Portfolio repository | Create `ErenDenizK.github.io` with the `/pdf-editor/` redirect folder and kill-switch worker (`tools/portfolio-redirect/`) and a root `404.html`; then drop the lychee exclusions | not done (old address answers 404) | owner |
| P-3 | Repository settings | Description, topics, social preview from `media/social.png` | not done | owner |
| P-4 | Release | `develop` → `main` release PR; `v1.0.0-beta.0` (and later beta tags) only when the owner says "beta v1" | pending owner | owner |
| P-5 | Custom domain | Later, per ADR-0016 (`rectopdf.*` looked free on 2026-10-01) | deferred | owner · web-later |
| P-6 | Chrome 154 recheck | Stored-handle crash gate is for Chromium 153 only; recheck when 154 ships | open | web-v1 (watch item) |
| P-7 | qpdf weekly rebuild hash drift | Weekly rebuild differs from the committed wasm since 09-28 (task 26) | open | web-v1 (reproducibility claim in README) |
| P-8 | Turkish About page, light-theme `<picture>` pair in README, hosted tour video | Presentation spec §10 "later" | not started | web-later |

## E. 1.0 exit criteria from ADR-0017 (ROADMAP "Exit criteria for 1.0") as a V1 checklist

| Criterion | Status |
|---|---|
| Every VISION v1.0 success criterion as an automated test on Chromium, Firefox and WebKit | partial: merge golden tests and e2e exist; Firefox and WebKit run in CI, but OCR engine tests are Chromium only |
| Final name and domain; load time and zero external requests measured in CI | partial: name settled; GitHub Pages address, no domain (owner said fine for now); `offline.spec.ts` covers offline, no load-time gate |
| Stored formats versioned with migration tests | partial: presets, tool styles, palette, ui, input policy, appearance have migration tests; check session snapshots, recipes and Recents DB v2 |
| Four weeks and two betas without an open blocker or major bug | not started (no beta tagged by the owner) |
| Accessibility pass, complete EN and TR, docs current, independent review of the beta | partial (D3-9, M1-d, D4-9 above) |

These are a good seed for the V1 criteria the owner asked to discuss; the "two betas and four
weeks" rule should be restated in the owner's terms (only the owner declares V1).

## F. Phone edition (M10, planned with the owner after M9)

| Id | Title | What | Status | Edition |
|---|---|---|---|---|
| D0-14 | Compact read-only reader | Open and Recents, fit width, pinch, find, Pages sheet, collapsible bars, Download a copy | done (`shell/compact/`, `e2e/compact.spec.ts`, DPR-3 render cap) | phone (shipped) |
| M10-1 | Phone interface from scratch | Own UI after Procreate-style apps: minimal icons, minimal bottom bar, two tools or tools from a pop-up | not started | phone |
| M10-2 | ADR-0031 phone rules | Dock labels under icons, Draw and Sign sets, phone Pages sheet, hide on scroll, bottom-sheet detents | not started (specs exist in `components/`) | phone |
| M10-3 | Phone compact sets of the palette (moved from D2-3) and phone Pages sheet (moved from D2-4) | | not started | phone |
| M10-4 | Procreate-style edge control for size and opacity | `components/10-ink.md` | not started | phone (also a candidate for iPad) |
| M10-5 | `07-sheets` compact presentations with detents | | partial (sheets have compact forms; no detents) | phone |
| M10-6 | Phone captures, case study v2 (brand phase 4) | | not started | phone · owner |
| B1 (R12) | Text view (local reflow) as the phone edition's core | Innovation bet B1 pairs it with M10 | not started | phone |

## G. Ecosystem (M11), deferred candidates and out-of-scope lists, by edition

| Id | Title | Source | Status | Edition |
|---|---|---|---|---|
| M11-1 | Optional Tauri desktop shell with file associations | ROADMAP M11, ADR-0007 | not started | **desktop** (the installable edition the owner now wants; ADR-0007 §4: same UI, extra capabilities detected at run time) |
| M11-2 | Plugin API for tools | ROADMAP M11 | not started | desktop (or web-later behind no network) |
| M11-3 | Browser extension "open with" | ROADMAP M11 | not started | web-later (Chromium extras, hidden) |
| M11-4 | Annotation set export/import as files | ROADMAP M11, viewer-annotations §10 | not started | web-later (= innovation E31 XFDF) |
| M11-5 | Copy-on-write sources for combined documents | redesign X11 | not started | web-later (model ADR) |
| M11-6 | "Move tool bar to" and a tablet side dock for the palette | redesign 03.Q3 | not started | web-later (iPad) |
| M11-7 | Remove `markDocumentClean` / `VirtualDocument.clean` | redesign §7 (breaking) | not started | web-later (cleanup) |
| M11-8 | RTL in text boxes, Find and text edit | innovation B19 "belongs with M11 i18n" | not started | web-later |
| SIG-1 | LTV, RFC 3161 timestamps, OCSP/CRL revocation, trust lists (AATL/EUTL) | recognize-and-compare §7, ADR-0007 trigger (b) | not started | **desktop** (needs network without CORS) |
| SIG-2 | Certification signatures (DocMDP), signing encrypted files, legacy `.p12` | recognize-and-compare §7, ADR-0013 | not started | web-later (pure crypto, no network) |
| SIG-3 | Hardware tokens and smart cards | recognize-and-compare §7 | not started | **desktop** (no browser API) |
| CONV-1 | Office ↔ PDF conversion | VISION non-goal, ADR-0007 trigger (b) | declined for web | **desktop** (LibreOffice-class component) |
| CONV-2 | DOCX export, table extraction, tagged reading order in Markdown | recognize-and-compare §7, M5 notes | not started | web-later (tables) · desktop (DOCX fidelity) |
| BIG-1 | Documents > 1 GB, native PDFium, threads | ADR-0007 | not started | **desktop** |
| OCR-1 | Handwriting OCR, RTL and vertical OCR layers, editing OCR text | recognize-and-compare §7 | not started | web-later (vertical/RTL); handwriting needs a model (D-1 said no for now) → desktop candidate |
| ANN-1 | Rich text in FreeText; measurement tools | viewer-annotations §10 | not started | web-later (= innovation E32 calibrated measure) |
| PG-1 | N-up and booklet imposition | light-table §9 | not started | web-later |
| RED-1 | Redaction in batch recipes; even-odd clip in redaction | recognize-and-compare §7, redaction spec | not started | web-later |
| PDFA-1 | PDF/A claims | VISION non-goal (no validator) | declined | desktop only if a validator ships there |
| PERS-1 | "My info" autofill of personal details; profiles | innovation S12 (second half) | not started | **desktop** (owner direction 2026-10-09: personal data lives in the installed edition; the web keeps "Make fillable" without stored profiles) |
| API-1 | API connections | owner direction 2026-10-09 | not planned before | desktop (far later) |
| I18N-1 | Per-locale message splitting | ADR-0010 (deferred until more locales) | not started | web-v1 optimisation if the TR catalogue weighs on the initial bundle (measure first) |
| Tier C/D | Same-page push-down, cross-page reflow | ADR-0020 | declined by the owner | — |

## H. Overlaps with the R12 innovation roadmap (for the merge)

| Earlier item | R12 item | Note |
|---|---|---|
| D2-8 ⌘K v2 | E10 contextual ⌘K | same work; keep one id |
| D4-3 facts chip | E9a triage card | E9a is the richer form; D4-3's routing (scan → OCR, form → Fill & sign) is its first slice |
| D4-2 sample, D4-4 empty states | E16 teaching where the finger is (self-ticking sample) | extend the built sample |
| D2-6 Compare place, M5-a "as opened" side | S2 hold to see the original, Changes lens | S2 phase 1 is cheap once snapshots exist; build the Compare place first or with it |
| D0-6 scrubber, D0-7 snapshots | S8 Flashback and pinned versions | Flashback reuses the snapshot store; owner D-2 sets the default |
| D3-8 light, D3-4 motion | T4 motion as meaning (E3, S7, E14) | motion pieces exist; aurora waits for the kit |
| M4-b outline from headings | E7 edit the outline, move the pages | |
| M11-4 annotation sets | E31 Markup out and in (XFDF) | |
| ANN-1 measure | E32 calibrated measure | |
| D3-9 a11y gates | E27, E34 accessibility label and checker | |
| M8-a latency, M8-b P14 | E18 ink comfort, S6 loupe | latency first: every pen feature sits on it |
| M11-6 side dock | E4 minimised capsule | decide one tablet placement story |
| M8-h glass cost, §9.1 budgets | E29 performance mode | performance mode should be the cost ladder made visible, not a second system |
| M11-1 desktop shell | E22 native extras (descoped) | E22's Chromium-only extras move to the desktop edition |
| S12 My info | PERS-1 | split: Make fillable → web, My info → desktop |

## Suggested short list for web V1 from the earlier plan (fast, useful, professional)

1. D1-8 presentation half: move the six remaining dialogs to sheets (consistency; no new UI language).
2. D2-6 Compare as a place (flagship feature still in the old shell).
3. D1-3 lock in `commit()` and D1-4's signed/restricted lock on open (a promise the UI already makes).
4. D3-9 Turkish casing ban and uppercase labels (correctness in a TR app), M1-d and M2-a Turkish gaps.
5. D4-3 facts chip as the first slice of E9a, and D1-6's pending-marks bar.
6. M8-a ink latency and tiled-zoom re-render, M8-h glass cost, §9.1 bundle and load-time gates in CI (internal optimisation, no UI change).
7. M1-b EXIF orientation, M2-c arrow nudge, M8-i small misc, M5-b and M8-e test coverage (cheap).
8. XD-3 rest and R11 (task 28, task 32), then D4-5…D4-9 after the owner's UI freeze.
