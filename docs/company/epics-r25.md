# R25 epics: what would make Recto feel clearly better

Head of product, 2026-10-21, on `develop` @ `c66d863`: a production build (`RECTO_RENDER_OVERRIDE=1`,
`vite preview`) driven by Playwright (Chromium 1194, SwiftShader) at 1440×900 dark, 1180×820 touch
light and 390×844 touch dark, with the sample and a generated 400-page text PDF (1.3 MB). The
screenshots, named below by file, are local to that session:
`/tmp/claude-0/-home-user-pdf-editor/a5e6da72-3019-5a5a-a87d-9424ebd23798/scratchpad/epics/`.
Inputs: the decisions, `specs/redesign.md`, the quality bar, R12, the experience audit, the
presentability sweep, the test kit and the roadmap. Competitors: reviewers praise PDF Expert for a
calm interface that opens big files fast, fault Acrobat as a dense panel that slows on large files,
and treat Preview as basic but always there. The busiest web tools (iLovePDF, Smallpdf) are merge,
compress, organise, JPG to PDF and sign.

**Where Recto stands.** Its features already exceed Preview's and come close to PDF Expert's, and
the glass reads as one standard. The gap is **feel**: pages arrive late, keys are lost in
transitions, the Library forgets you, ⌘K cannot take a page number, and the markup row is about
twenty wordless glyphs. Two everyday jobs are missing: **Print** and **images to PDF**. Ranked by
value ÷ effort; sizes are builder-days plus review; "tonight" means no owner answer is needed to
start. PRC-25 holds: a new flow, feature or visible redesign deploys only after the owner's yes.

| #   | Epic                                               | Size   | Tonight?                                                |
| --- | -------------------------------------------------- | ------ | ------------------------------------------------------- |
| 1   | Pages are there when you arrive (performance)      | 7–9 d  | yes, all lanes                                          |
| 2   | Every press lands (interaction feel)               | 4–5 d  | yes, all lanes                                          |
| 3   | A Home that remembers (Library and the main menu)  | 8–10 d | lanes 3a, 3c, 3d; 3b after the board's answer           |
| 4   | A command bar that does things (⌘K, the main menu) | 5–6 d  | yes                                                     |
| 5   | Print, and images in as a PDF (features)           | 5–7 d  | building yes; deploy after the board's answer           |
| 6   | Find that shows where                              | 4 d    | yes                                                     |
| 7   | A markup row people can read                       | 6–8 d  | prototype behind a flag yes; the default is the owner's |

## Epic 1 · Pages are there when you arrive (performance)

**The problem as a user feels it.** Scroll a 400-page file fast and stop: the page is bare white,
still white two seconds later on the test machine (`desk-big-fastscroll-400ms.png`,
`desk-big-fastscroll-2000ms.png`, p. 63). It opened at 169% on a 1440 laptop
(`desk-big-open-1500.png`): 28 px body text and a 760,000 px tall document, so every trip is long
and every page renders large. Find counts 22,000 hits in about 3.5 s showing only "…"
(`desk-big-find-500ms.png`). The grid is fine (`desk-big-grid-3s.png`); phone first load is in
`research/perf/phone-first-load-2026-10.md`.

**Outcome.** You never land on a white page. Something true to the page appears at once (the
grid's thumbnail scaled up, then the sharp render), and a fast scroll lets go of work it no longer
needs. A document opens at a size you can read. Long Finds show they are running and show results
as they come.

**Scope in.** A scaled thumbnail under every page that is not yet rendered. Render priority: the
landing page first, cancel what scrolled past, idle prefetch both ways. The default reading zoom
(lane 4). Find streams its count and hits. Phone first-load proposals P2, P4 and P5 (the ones
that need no amendment). **Out.** WebGPU, a new rendering engine, and raising any bundle gate
(PRC-11).

**Decisions it touches.** PRC-11 and PRC-20 (bundle and first paint; kept). MOT-12 (no stutter;
kept). Q-10/Q-11 (nothing renders at rest; kept). `05-canvas` M-11, "fit width cap 1100 px from
xlarge": **amendment** to about 900 px from large (1280) up. This is a visible default, so it is
**board question 4**; the recommended default is the cap. P1 and P3 need PF-17 and MOB-13
amendments (CEO technique calls; they stay with the perf lead).

**Lanes.**

1. _Perf lead (root-cause engineer)_: owns measurement. Their `docs/research/perf-2026-10.md` (branch
   `r25/perf`) sets the numbers below. Done: a table of time to the first true pixel after a fling,
   the open-to-first-page time and Find throughput, on desktop and on a mid phone profile. Check:
   the doc merged, and the numbers rerun on this epic's branch.
2. _Builder_: placeholder from the thumbnail (`engine/bitmap-cache.ts`, `stage/ReadView.tsx`,
   `viewer/page-pixels.ts`). Done: no page shows bare white after a fling. Check: an e2e test that
   flings 60 pages and samples the landing page's pixels within one frame (fewer than 98% white
   pixels on a text page); `glass-perf.spec.ts` stays green.
3. _Builder_: the render queue cancels and prioritises (`engine/engine-service.ts`,
   `viewer/jump-prefetch.ts`). Done: renders in flight after a fling are cancelled. Check: a unit
   test on the queue order; the perf lead's numbers improve.
4. _Builder_: the reading-zoom default as the board answers (`stage/ReadView.tsx`
   `XLARGE_FIT_CAP`). Check: `read-fit-resize.test.tsx`.
5. _Builder_: Find streams (`shell/sidebar` Find, the engine's search). Done: the count climbs and
   the first hit shows before the scan ends. Check: a unit test on the stream; e2e on the 400-page
   fixture.

**Risks.** Memory on iPad (thumbnail plus full render, B17), so the cache stays bounded. Cancelled
renders leaving holes. SwiftShader exaggerates the delay, so trust the perf lead's real-device
numbers.
**Size.** 7–9 d. **Show the owner.** A side-by-side clip of a fast scroll through 400 pages, before
and after, plus the open screenshot at the new zoom.

## Epic 2 · Every press lands (interaction feel)

**The problem.** A short walk lost or misread five inputs, none of which a screenshot review
catches. (1) After the Pages grid closed, ⌘F then "tempor": the **t** armed a Markup tool and Find
got "empor" (`desk-big-find-500ms.png`). (2) In the Find field, Ctrl+Shift+S and Ctrl+, did nothing
(`desk-big-save-copy.png`, `desk-09-settings.png`). (3) ⌘P falls through to the browser (no print; Epic 5).
(4) The sample opens with a blue box on its first link (`desk-02-sample-open.png`; focus is lime,
DSN-3, and nothing should look selected on arrival). (5) The tablet's More menu has a dark smeared
band at its divider (`tab-05-more.png`; GLS-23).

**Outcome.** Typed keys reach where the eye is: a field that is opening gets the keys typed
before it finishes animating. App shortcuts work from inside any text field where they cannot
mean text. No stray rings and no smears.

**Scope in.** Keys buffered through view changes (focus moves when a change starts); modified
shortcuts (Save, Save a copy, Settings, ⌘K) work in fields; link rings on `:focus-visible` only;
the menu smear; an input fuzzer over every transition. **Out.** New bindings beyond key map v2.

**Decisions.** INK-7 (key map v2), MOT-11 (a shortcut forgets the last press), DSN-3, GLS-23,
DSN-21 (A-gates). All kept, and these are bug fixes under PRC-25 (minor). The one amendment, a field
taking keys during its entrance, is a CEO technique call; record it as a new MOT row.

**Lanes.**

1. _Root-cause engineer_: why ⌘F loses its first key after a view change, and why modifiers die in
   Find (`commands/use-shortcuts.ts`, `commands/keymap.ts`). Done: the cause is written down.
2. _Builder_: the fix and the modifier policy. Check: `keyboard-text.spec.ts` gains "type right
   after ⌘F from the grid, the Library and the palette"; unit tests in `keymap.test.tsx`.
3. _Builder_: the link focus ring (`viewer/LinkLayer.tsx`) and the menu band (`ui/Menu`, materials).
   Check: `glass-pixels.spec.ts` gains the More menu at 1180 touch.
4. _Analyst plus builder_: an input fuzzer e2e (random taps and keys during the 12 view changes;
   asserts no key lands in a tool and no tap lands on the page under an exiting overlay, per
   MOB-4b). Check: it runs green 20 times.

**Risks.** Modifier keys inside fields can clash with text editing (⌘A, ⌘Z must stay the
field's). **Size.** 4–5 d. **Show the owner.** A 20 s clip: grid, ⌘F, type at once, the word lands
whole. Before and after.

## Epic 3 · A Home that remembers (Library and main menu)

**The problem.** The empty Library is handsome (`desk-01-first-run.png`), but once used it is a
parking lot. With one document open, a 1440 screen shows a launcher and one card over empty glass
(`desk-10-library-with-doc.png`). Open a PDF from the Library while another is open and you do
**not** see your file. The Library enters Select mode with the new card checked and a Combine bar
up (`desk-11-big-600ms.png`, `tab-08-after-open-from-library.png`). That is by design
(`home-actions.ts` `showOpened`, `02-library` L2), but every reference app opens the file. Nothing
says "continue where you left off": the session keeps page and zoom (`session/format.ts`), but the
Library never shows it. Recents are a list, with no search, sort or pins.

**Outcome.** Home is where you resume, not just where you start. The first thing is **Continue**:
the last document's cover, its page ("p. 63 of 400") and one press back to that exact place. Then
open documents and Recents as one visual grid with search by name, sort (recent, name, size) and
pinned files. Opening a file opens it.

**Scope in.** R12 E8 phase 2 (exact resume, progress, provenance glyphs) and the name half of E9b.
Opening one file goes to it. The phone gets Continue above its Recents (DSN-31/50 order otherwise
kept). **Out.** Full-text Library search (E9b phase 2), folders (E33) and smart collections; they
follow.

**Decisions.** DSN-50 (three tiers): **amended**, since Continue joins tier 2 (owner taste). The
`02-library` L2 "open lands in Select" rule and `showOpened`: **amended**, one file goes to its
page and two or more keep Select (**board question 1**). DSN-13, DSN-31, DSN-33 and PRD-8 are kept;
Recents stay on the device.

**Lanes.**

- 3a. _Builder_: one opened file goes to its page (`home/home-actions.ts`), built behind
  `?open=page` until the board answers. Check: `library.spec.ts` covers both behaviours.
- 3b. _Design director, then builder_: Continue and the unified grid (`home/LibraryView.tsx`,
  `RecentList.tsx`, `LibraryCard.tsx`, `recent-thumbs.ts`). Done: the owner approves 1440, 1180 and
  390 screenshots. Check: axe; `library.spec.ts`; Q-8 for Turkish at 390.
- 3c. _Builder_: exact resume from Recents and from Continue, to the right page, zoom and offset
  within ±2 px (E8's acceptance). Check: an e2e test that reopens at page 63.
- 3d. _Builder_: Library search and sort over names, with Turkish case folding (İ/ı). Check: unit
  tests in `home-model.test.ts`.
- 3e. _Builder_: Continue on the phone, loaded on demand (EDN-10). Check: `compact.spec.ts`.

**Risks.** The compact bundle cap (DSN-51 had 24 B of room) means phone parts load on demand. OPFS
thumbnails cost storage, so they follow retention. **Size.** 8–10 d. **Show the owner.** Three
before/after pairs (1440 with documents, 1180, 390) and a 15 s clip of "close the laptop, come
back, Continue lands on p. 63".

## Epic 4 · A command bar that does things (⌘K)

**The problem.** ⌘K is the keyboard user's main menu, but it only lists commands. "120" finds
nothing (`desk-20-palette-120.png`). "print" offers "Toggle pen draws in Edit"
(`desk-21-palette-print.png`): a fuzzy match with no meaning. With nothing typed, it opens on a
flat File list whose third row is "Clear recents" (`desk-03-palette.png`). It cannot open a recent
file or jump to a heading, and it does not know what is selected.

**Outcome.** R12 E10, phases 1–2. Numbers jump ("120", "p 120"). Ranges act ("rotate 3-7 right",
"delete 4-6", "çift sayfaları sil"). Headings jump ("go to Methods", from the outline). Recent
files open. Synonyms land ("print", "küçült", "make smaller" → Compress with its estimate). The
selection shows as a scope chip. Junk fuzzy matches are cut by a score floor. The empty state shows
recents and "suggested for this document" (fields → Fill & sign; scanned → Recognize text).

**Scope in.** The parser and the EN/TR corpus (at least 200 queries, as E10 asks). Nothing runs
without showing the resolved pages. **Out.** Phase 3, plain-language plans, which would need a
model (PRD-9).

**Decisions.** E10 (R12 accepted the waves). DSN-46 (one place per command): kept, since the
palette is a door and not a second home. D-5 (no symbol-only keys) kept. A CEO technique call. E10
asks the owner to review the corpus: send it as a read-through, not a blocker.

**Lanes.** (1) _Builder_: the query parser (`commands/fuzzy.ts`, new `commands/query.ts`), with
unit tests over the corpus. (2) _Builder_: result kinds for pages, outline, recents and documents
(`shell/CommandPalette.tsx`). Check: `menus.spec.ts` and a new palette e2e. (3) _Builder_: the
score floor and synonyms (`commands/keywords.ts`). Check: `keywords.test.ts`, "print" never returns
an unrelated row. (4) _Design director_: the empty state and the scope chip at 1440 and 1180.

**Risks.** Turkish morphology in ranges; the corpus covers it. **Size.** 5–6 d. **Show the
owner.** A 30 s clip: "120", "rotate 3-5 right", "go to Contributor agreement", "küçült".

## Epic 5 · Print, and images in as a PDF (features)

**The problem.** Two of the commonest PDF jobs are missing. **Print**: no print command exists in
`src/` (`desk-21-palette-print.png`), and ⌘P falls through to the browser, where Preview, PDF Expert and
Acrobat all print. **Images to PDF**: a JPG, PNG or HEIC cannot be opened or dropped as a PDF
(`files/file-filters.ts`). It is a top iLovePDF and Smallpdf tool, and how a phone turns a receipt
into a PDF. Recto already inserts images (`cmd_insert_images`), so the engine work mostly exists.

**Outcome.** ⌘P and File → Print… print the document, including marks, form values and
redactions as saved. This goes through a hidden iframe with the exported bytes, or rendered pages
where the browser's PDF printing is missing (iOS). Dropping or opening images makes a new
unsaved document, one page per image, fitted to A4 or Letter by locale, as PRD-19 does for text.
On the phone, "Open PDF" accepts images, and the system picker already offers the camera.

**Scope in.** Print on all three engines. Images to PDF (JPEG, PNG, and HEIC where the browser
decodes it). Orientation by EXIF. **Out.** Document scanning with edge detection (later, behind
OCR), and print presets beyond what the browser dialog gives.

**Decisions.** PRD-2 (each extra feature is measured): a new feature, so **board question 2**.
PRD-19 is the pattern to follow (opens as a new document, close warns, not in Recents). EDN-19
does not apply, since no package is downloaded. PRC-7 and PRD-12 are kept: no dependency, nothing
leaves the device. DSN-46: Print gets one home (the title menu), plus ⌘P and the palette.

**Lanes.** (1) _Root-cause engineer_: a print spike on WebKit and iPadOS (iframe vs rendered
pages, memory at 400 pages). Done: a short memo. (2) _Builder_: Print (`export/`,
`commands/export-commands.ts`, the title menu). Check: an e2e test that `window.print` is reached
with the exported bytes; i18n EN/TR. (3) _Builder_: images in (`files/file-filters.ts`, `convert/`,
the Library drop). Check: e2e on a JPEG and a PNG fixture; a unit test on EXIF rotation. (4)
_Builder_: phone, where `Open PDF` accepts images (`shell/compact/`). Check: `compact.spec.ts`;
the bundle cap is held.

**Risks.** iOS Safari printing PDFs from an iframe is unreliable, so rendered pages are the
fallback. HEIC decoding is WebKit-only, so HEIC is shown only where the browser decodes it. **Size.**
5–7 d. **Show the owner.** Screenshots of the print dialog with the sample's marks, and a 10 s
phone clip of picking a photo and getting a page.

## Epic 6 · Find that shows where

**The problem.** On the dark cover, hits are a faint blue wash you can hardly see
(`desk-08-find.png`). On white pages they read, but the current hit differs from the others only
by a thin outline (`desk-big-find-3500ms.png`). In a 400-page file, Find gives "21,946 of 22,000"
and arrows, and nothing shows _where_ the hits are or what surrounds them. The sweep's #16 ("No
text on 1 page · Recognize text…" on every sample search) is still open.

**Outcome.** Hits are a highlight that reads on any page (lime-tinted, DSN-16, with a darker
current hit), plus a results list with a line of context per hit, grouped by page. The scroll bar
carries hit ticks, so the size of the job shows at a glance (GLS-26 overlay). Find across all open
documents is one toggle.

**Decisions.** `06-navigation` N4 (the results list exists in the sidebar; reuse it). DSN-16 and
GLS-26 are kept. DSN-44 (phone keeps the found word in sight) is kept. PRD-17 (the sidebar covering
a fit-width page) is still open: the results list scrolls the hit clear of the sidebar, and this
does not decide PRD-17. The sweep's #16 is a lead taste call.

**Lanes.** (1) _Builder_: highlight contrast on light and dark pages (`viewer/SearchHighlights`).
Check: a pixel test, with the hit at 3:1 or more against both page tones. (2) _Builder_: snippets
in the Find results (`shell/sidebar`). Check: a unit test on snippet cuts. (3) _Builder_: scroll-bar
ticks (the GLS-26 overlay). Check: `glass-rest.spec.ts` stays green. (4) _Builder_: all open
documents. Check: e2e with two files.

**Size.** 4 d. **Show the owner.** Before/after screenshots of the dark cover with "the", and of
the 400-page list.

## Epic 7 · A markup row people can read

**The problem.** Markup opens one row of about twenty wordless icons, from pens to redact
(`desk-06-markup.png`; the whole tablet width in `tab-03-markup.png`). The black pen's dot vanishes
on the dark bar. Edit text and Redact are here and again under More (`tab-05-more.png`). This is
the audit's friction #5 ("18 unlabelled equal icons") back again: M6 fixed it with labelled
groups, and the redesign folded them into one row. Test goal 2 (find each core tool unaided) meets
this row first.

**Outcome.** A row that reads at a glance: four labelled groups (Draw · Comment · Sign & fill ·
Change page), each opening its 3–6 tools in place (the capsule morph, MK-2). An armed tool shows
its name. The pen dots get a hairline ring on the bar. Edit text and Redact have one place each.

**Decisions.** MK-2 (one row, groups fold by width), DSN-7 (approved concept), DSN-25 (fewer,
flatter controls), INK-2 (pens stay in the dock) and INK-4 are all touched, so this is **owner
taste: board question 3**. The recommendation is a prototype behind `?palette=groups` for the owner
to try on the iPad, with the user tests deciding. Q-9 (one control system) is kept.

**Lanes.** (1) _Design director_: two layouts (groups vs labelled row), with screenshots at 1440,
1180 and 1366 touch. (2) _Builder_: the flag variant (`markup/`, `shell/capsule/`). Check:
`markup.spec.ts`, `capsule.spec.ts`, `bar-audit.spec.ts` on both variants. (3) _Builder_: pen dot
ring and the single home for Edit text and Redact (DSN-46). Check: the menu inventory test. (4)
_Analyst_: count presses to each test-kit tool (D2–D6) in both variants.

**Risks.** Re-opening a settled look (DSN-7). This is why it sits behind a flag until the owner and
the testers choose. **Size.** 6–8 d. **Show the owner.** Both variants side by side on the iPad,
plus the press counts per task.

## Board questions

1. **The Library.** (a) Opening one file while the Library shows: recommended, go to its page (two
   or more keep Select). (b) A Continue card tops the Library (DSN-50 amended). Default: both are
   built behind `?open=page` and `?home=continue`, and today's Library ships until answered.
2. **Print and images to PDF in V1 (PRD-2).** Recommended: yes, since both are everyday jobs and
   neither needs a dependency. Default: build both now and hold the deploy for "yes".
3. **The markup row.** Recommended: try the grouped variant on the iPad, and let the user tests
   pick. Default: the flag variant is built, and today's row stays the default.
4. **Reading zoom on laptops.** Recommended: cap fit width at about 900 px of page from 1280 up
   (about 113% for A4 on a 1440 laptop instead of 169%). Default: built, off until answered.

The user tests' findings still jump this queue when they arrive (roadmap).
