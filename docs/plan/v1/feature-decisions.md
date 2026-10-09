# Recto: extra features, V1 or after (decision sheet)

Date: 2026-10-09 · Tree: `develop` `7697f56` · Status: **input for the owner**, who decides each row. Nothing here changes the plan until the owner marks it.

Sources: `docs/plan/v1/PLAN.md` (backlog, editions, waves), `docs/research/innovation-2026-10/ROADMAP.md` (S*, E*, bets), `docs/plan/v1/phone-edition.md` (M10), `docs/plan/v1/old-roadmap-inventory.md` (earlier plan). A Turkish copy for the owner is kept outside the repository.

## How to read this

- **Scope.** Every extra feature or innovation in the four sources: signature moves (S*), excellence items (E*), bets (B*), earlier-roadmap items, phone editing phases (M10-*) and desktop items (DT-*). Merged items keep every id (for example `E9a · D4-3`). Bug fixes, the design system and internal performance are not decisions; they are listed once under [Happening anyway](#happening-anyway).
- **Owner rules applied.** V1 is declared by the owner whenever he decides. VoiceOver and extra accessibility are not V1 requirements (so E27 and E34 sit after V1, and the V1 rows carry no VoiceOver work). The design system comes first, so every V1 row assumes the W0–W1 design pass has landed. Phone editing may or may not be V1: all phone rows are tagged **phone**, and the owner chooses when that track opens.
- **Recommendation.** `V1` · `after V1` (web, V1.x) · `desktop` (installable edition, placement rule of PLAN §1.2) · `phone` (editable phone edition, M10).
- **Necessity** 1–5: how much the item's own edition needs it (for web rows: how much V1 needs it). **Impact** 1–5: how much a user sees and feels it. **Risk**: regression, platform or tuning risk.
- **Hours** = wall-clock hours from brief to merged on `develop` with green CI, for one lane, counting the implementer, the QA lane's e2e slot, the lead's merge and one CI round. It excludes owner review and decision time. **WP** = number of agent work packages.

### How the estimates were made

- **Setup:** up to 7 implementer lanes plus one QA lane, one 4-core machine, so one heavy slot (build, Playwright, full unit suite) at a time; the lead merges and runs CI on three engines.
- **Scale, calibrated on `git log`:** the R11 pass merged about ten UI features in one day (2026-10-08/09) and the redesign drops ran at about 180 commits a day (2026-10-05/06). From that: a small item (S, part of a WP) takes 3–5 h; one WP (M) takes 6–12 h; two to four WPs (L) take 16–40 h; a track (XL) takes 48–80 h.
- **Sized from the code:** each row was checked against what exists in `apps/web/src` (for example `viewer/LinkLayer.tsx` keeps no history, `compare/CompareView.tsx` is still the 1,000-line M5 view, `forms/navigation.ts` already steps fields, `analysis/facts.ts` already computes the triage facts, `annotations/layer-registry.ts` already tracks layers, there is no `onboarding/` module, the engine has no colour-scheme render binding, `shell/compact/` is 3.4 k lines with a 60-line `CompactSheet` and no detents).
- **Group totals** add the hours (serial work). The elapsed estimate assumes about 3 lanes progress at once (the single heavy slot and the merge queue are the limit), and never less than the longest dependency chain inside the group. Days assume about 16 active pipeline hours per day.

## Summary

| Recommendation | Items | Work (h, serial) | WPs | Longest chain (h) | Elapsed (h, parallel) | ≈ Days |
|---|---|---|---|---|---|---|
| V1 | 21 | 157 | 19.5 | 24 | 53 | 3.3 |
| after V1 | 78 | 1315 | 148.5 | 102 | 439 | 27.4 |
| desktop | 16 | 498 | 52 | 84 | 166 | 10.4 |
| phone | 10 | 167 | 20 | 104 | 104 | 6.5 |
| **All** | **125** | **2137** | **240** | | | |

Reading the V1 line: the 21 V1 extras add about 53 elapsed hours (≈ 3.3 days) if they ran alone. In practice they share the W0–W4 waves with the design system and the fixes, so they lengthen the V1 path by less than that, as long as the heavy slot is not the bottleneck. The largest single V1 item is Compare as a place (24 h, 3 WPs). The ◇ candidates kept in V1 are S4 and E6b; S3-Q, S8, E8b and S7 move after V1 in this recommendation.

**Where this differs from PLAN.md's current draft:** S8 Flashback, S3-Q QuickShape, E8b Library phase 2, S7 and E16 full teaching are recommended **after V1** (PLAN keeps them as ◇ or W4 items). Reason: V1 already proves "nothing is lost" through snapshots and undo, the first-run welcome (WEL-1) covers teaching, and these five together are about 80 h of work with medium risk on top of a design-system-first V1.

## Decision table

Sorted by recommendation, then necessity (high first), then impact.

### V1 (21 items · 157 h serial · ≈ 53 h elapsed)

| Id | Name | What the user gets | Ed. | Hours | WP | Nec. | Why this necessity | Impact | Risk | Depends on | Rec. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E13 | Receipts on Save | After redacting, Save says "3 areas removed · 0 matches remain"; every save says "Saved on this device". | web | 6 | 1 | 5 | Proof at the only step that cannot be undone; part of the V1-F7 Must job. | 5 | low | — | V1 |
| D2-6 · M5-a | Compare as a place | Full-screen Compare with a file chooser (including "the file as opened"), a Changes list and J/K stepping. | web | 24 | 3 | 5 | A flagship feature still in the old M5 stage view (CompareView.tsx, ~1,000 lines); V1-F10 is a Must. | 4 | medium | — | V1 |
| S1-1 | Peek & Return | Preview where a link leads without leaving the page; a Back chip and Z / Shift+Z return you exactly. | web | 10 | 1 | 4 | Links jump today with no history (viewer/LinkLayer.tsx); losing your place is a reading bug in all but name. | 5 | low | CR-1, CR-3 | V1 |
| E12 | Forms that pull you to the finish | A "7 of 12 required" ring, Return jumps to the next empty field, a finish bloom and "Ready to sign". | web | 10 | 1 | 4 | Fill and sign is the top tablet job; forms/navigation.ts already steps fields, so this is mostly UI. | 5 | low | E3, CR-1 | V1 |
| WEL-1 | First-run welcome | A calm first visit in the Library with one "Try the sample" path and three first-use tips; never shown twice. | web | 6 | 1 | 4 | Strangers decide in the first minute; the five-person test needs a designed first visit. | 4 | low | E15a, E9a | V1 |
| E9a · D4-3 | Document triage card | On open: "2 signature fields · 14 fields · pp. 4–7 scanned (OCR?)"; each line is a button that starts the job. | web | 8 | 1 | 4 | Routes a scan to OCR and a form to Fill; the engine already computes the facts (engine analysis/facts.ts). | 4 | low | CR-1 | V1 |
| D1-6a | Pending-marks bar | A bar shows redaction marks that are not applied yet, with Apply and Clear. | web | 4 | 0.5 | 4 | Unapplied marks are easy to forget and then the file goes out unredacted. | 3 | low | — | V1 |
| S2-1a | See the original (eye) | Hold or toggle the eye in the title menu to see the page without your marks. | web | 4 | 0.5 | 3 | Cheap proof that edits are non-destructive; the annotation layer registry already exists. | 4 | low | — | V1 |
| E14 | Sheets that grow, buttons that report | Compress, OCR and Save sheets grow per step; the button reads "Compressing 42 % → Saved 3.1 MB" with cancel. | web | 8 | 1 | 3 | Long jobs without honest progress feel broken; it rides on the D1-8 dialog-to-sheet work anyway. | 4 | low | D1-8, PF-3 | V1 |
| E3 | Motion that shows what changed | Glyphs that animate once (Undo turns back, Save draws a check), an odometer page pill and an undo HUD that names the act. | web | 10 | 1 | 3 | Undo that says what it undid prevents silent mistakes; also feeds E12. | 4 | low | E1 | V1 |
| E6b | Drag ghosts and Review pages | Dragged pages show a stacked ghost with a count and spring-loaded targets; a Review pages pass (← → X P) culls pages. | web | 10 | 1 | 3 | Arranging pages is core job V1-F6; today's drag feedback is thin. (◇ candidate.) | 4 | low | CR-3 | V1 |
| S2-2 | See the original, phase 2 | Also shows the original after text edits, crop or redaction; Shift+B drags a wipe; sheets get a hold-to-compare Before chip. | web | 14 | 2 | 3 | Shows what an act will do before you commit it; needs a second render path and its memory cap. | 4 | medium | S2-1a, D1-8, BEFORE-SLOT | V1 |
| E17a | "Test it: turn on Airplane Mode" | The privacy popover tells you how to check the no-upload promise, and the shield confirms when you go offline. | web | 3 | 0.5 | 3 | Turns the main privacy claim into something a user can verify in ten seconds. | 3 | low | — | V1 |
| D1-6b | E then Enter for Edit text | Press E, then Enter on a paragraph to edit its text, shown where it can be found. | web | 3 | 0.5 | 3 | Text edit is a headline feature that keyboard users cannot reach quickly. | 2 | low | — | V1 |
| M2-c | Arrow-key nudge | Arrow keys move a selected mark by 1 pt, Shift by 10 pt. | web | 3 | 0.5 | 3 | Keyboard parity for placing marks; tiny. | 2 | low | — | V1 |
| E15a | Tip engine (minimal) | Short first-use tips with caps (at most one per session) so each new move teaches itself. | web | 4 | 0.5 | 3 | WEL-1 and every new gesture need it; there is no onboarding module in the code yet. | 2 | low | CR-1 | V1 |
| CR-9 | Storage honesty in Settings | Settings shows how much space snapshots (and later Flashback and pins) use, under one 500 MB cap. | web | 4 | 0.5 | 3 | Snapshots already use storage and Safari evicts it; users should see it. | 2 | low | — | V1 |
| S4 | Scratch to erase, loop to select | With the pen, a zig-zag over ink erases it with a preview and one-step undo; a closed loop offers Select. | web | 14 | 1.5 | 2 | Expected by notes-app users and a strong demo, but not needed for any core job; false-positive risk (D-3). (◇ candidate.) | 5 | medium | CR-2, PEN-CHECK | V1 |
| S2-1b | Hold B to see the original | Holding B shows the page without your marks; release brings them back. | web | 3 | 0.5 | 2 | Keyboard twin of S2-1a; nearly free once the eye exists. | 3 | low | S2-1a, CR-3 | V1 |
| M8-f | Live cut preview for lasso and eraser | While erasing or cutting, you see what will go before you lift the pen. | web | 4 | 0.5 | 2 | The "feel" of the eraser; small and contained in the ink lane. | 3 | low | — | V1 |
| E28 | Paper templates and a notes column | Insert lined, grid, dot or Cornell pages; add a notes column to every slide page. | web | 5 | 0.5 | 2 | Cheap (builds on insertBlankAfter) and valued by students; not required. | 3 | low | — | V1 |

### after V1 (78 items · 1315 h serial · ≈ 439 h elapsed)

| Id | Name | What the user gets | Ed. | Hours | WP | Nec. | Why this necessity | Impact | Risk | Depends on | Rec. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S12a | Make fillable | On a flat form Recto proposes real fields from the page's lines and boxes; Accept all or review one by one. | web | 20 | 2 | 3 | Most forms are flat scans; high value, but it reuses S3-S's detector and needs a 30-form fixture set. | 5 | medium | S3-S | after V1 |
| S3-S | Page-aware snapping and measure | Signatures, text boxes and shapes snap to the document's own lines, "Sign here ___" rules and boxes; Alt shows distances. | web | 30 | 3 | 3 | Biggest ink differentiator, but needs a worker line/box detector (L) and tuning against sticky snaps. | 5 | medium | S3-Q | after V1 |
| S8 | Flashback and pinned versions | For 7 days anything thrown away (closed without saving, deleted pages, old undo) can be brought back; named versions open in Compare. | web | 36 | 4 | 3 | Snapshots and undo already cover reload and crash (V1-F11); Flashback is an L with Safari eviction and privacy cases. | 5 | medium | D2-6, CR-9 | after V1 |
| E11 | Page themes (Paper, Sepia, Night) | Read the page in Sepia or Night, scans included; the saved file is untouched. | web | 12 | 1.5 | 3 | Biggest reading-comfort gap in dark mode; the PDFium colour-scheme render is not bound in the engine yet. | 4 | medium | — | after V1 |
| E30 | Remove hidden information | One sheet strips metadata, scripts, attachments, hidden layers and old revisions, and proves it by re-reading the file. | web | 10 | 1 | 3 | Valued by legal and privacy users; metadata stripping already exists, so V1 is not blocked without it. | 3 | low | E13 | after V1 |
| S3-Q | QuickShape | Draw a shape and hold: it becomes a clean, editable PDF shape (line, arrow, box, circle, polygon). | web | 10 | 1 | 2 | Builds on hold-to-straighten (pen/straighten.ts) and engine Polygon support; best shipped with S3-S. (◇ candidate.) | 4 | low | S4 | after V1 |
| S2-3 | Changes lens | Dims the original and lights only what you changed, with a "14 changes" chip and J/K stepping. | web | 10 | 1 | 2 | Strong review aid, but S2-2 and Compare already answer "what changed" for V1. | 4 | medium | S2-2, D2-6 | after V1 |
| S11 | Linked Repeat across pages | Put initials, a stamp or a box on all, odd, even or chosen pages; copies stay linked until you detach them. | web | 24 | 3 | 2 | Daily need for contracts, but needs link ids that round-trip through the PDF. | 4 | medium | — | after V1 |
| S5 | Tip ring and the one puck | A radial tool ring at the pen tip, and one floating puck that gives keyboardless iPads Shift and Alt and doubles as Focus. | web | 24 | 3 | 2 | Solves a real iPad gap (no modifiers), but touches every modifier read site; backlash risk. | 4 | medium | CR-2, CR-3 | after V1 |
| E21 | Notes out (Markdown) | Copy or save all highlights and comments as Markdown, grouped by heading, with page links. | web | 5 | 0.5 | 2 | Cheap and useful for students and researchers; a good first V1.x item, or V1 if a lane is idle. | 3 | low | — | after V1 |
| E20 | Style and selection tools for marks | Copy and paste a style, select similar marks, give colours meanings (Key, Question) and hide your private notes. | web | 10 | 1 | 2 | Helps heavy annotators; nothing in V1 depends on it. | 3 | low | E2 | after V1 |
| E18 | Ink comfort pack | Steady smoothing per preset, eraser filter (ink / highlights / shapes), spring-loaded tools and a two-tool swap. | web | 10 | 1 | 2 | Comfort for daily pen users; ink latency (M8-a) must land first. | 3 | low | E2, M8-a | after V1 |
| E8b | Library phase 2 | Each card shows reading progress and a draft dot; reopening returns to the exact page and zoom; glyphs show Redacted, Signed, OCR'd. | web | 10 | 1 | 2 | Nice polish; the Library already works and was just redesigned (R11). (◇ candidate.) | 3 | low | — | after V1 |
| S10 | Pins: floating references | Pin a page or region as a small floating card that stays while you scroll or fill elsewhere. | web | 10 | 1 | 2 | Saves flipping back and forth; clutter needs a minimise rule. | 3 | low | S1-1 | after V1 |
| D1-6c | ContextBar and "Add … here" | Bars for fields and images, and a page menu that adds a note, text or signature at the clicked spot. | web | 10 | 1 | 2 | Faster targeted acts; the selection bar already covers the common ones. | 3 | medium | — | after V1 |
| E7 · M4-b | Edit the outline to move pages | Drag a bookmark to move its pages; delete a bookmark to delete its pages; build an outline from headings. | web | 12 | 1.5 | 2 | Novel and useful for long reports; nested ranges and label remapping need care. | 3 | medium | — | after V1 |
| S1-2 | Citation peek and skim | Detected "Fig. 3" and "[12]" references peek like links; a quick skim mode flips through pages. | web | 12 | 1.5 | 2 | Great for papers, but the detector needs ≥ 90 % precision on an EN/TR corpus. | 3 | medium | S1-1 | after V1 |
| E10 · D2-8 | ⌘K v2 with arguments | Type "rotate 3-7 right" or "çift sayfaları sil" and see the pages it will touch before it runs. | web | 16 | 2 | 2 | Power-user speed; needs an EN/TR parser and a 200-query corpus the owner reviews. | 3 | medium | — | after V1 |
| E24 | Scan tools | Straighten a crooked scan, apply looks (Paper, Ink only, Mono) and brush away stains, with the original kept. | web | 24 | 3 | 2 | Scans are common, but image passes in the worker are an L and must keep the OCR layer. | 3 | medium | S2-2 | after V1 |
| E9b | Library search, smart collections, duplicates | Search inside every stored file, smart lists (Signed, Has forms, Scanned without text) and duplicate detection. | web | 24 | 3 | 2 | Matters once people keep many files in Recto; needs an idle index with Turkish case folding. | 3 | medium | E8b | after V1 |
| M3-b | Better compression | Compress keeps grayscale and CMYK images as they are and subsets fonts, so files get smaller without colour shifts. | web | 24 | 3 | 2 | Compression works and is honest today; this is quality on top. | 3 | medium | — | after V1 |
| M8-f-b | Lasso and eraser leftovers | Stamps keep orientation when rotated, line widths scale on resize, the eraser can skip highlights. | web | 8 | 1 | 2 | Small correctness polish in rare cases. | 2 | low | — | after V1 |
| M4-a | Form fidelity | Tab order (/Tabs) written, push-button actions honoured, fields survive page duplication. | web | 10 | 1 | 2 | Edge cases of real forms; the common fill path works. | 2 | medium | — | after V1 |
| M3-a | Unusual encryption via qpdf | Files with rare security handlers open through a qpdf fallback. | web | 8 | 1 | 2 | Rare files; the error message path (V1-B5) covers V1. | 1 | medium | — | after V1 |
| S7 | Capsule as source and sink | Drag a note, signature or blank page out of the capsule to place it; throw a mark into it to delete. | web | 12 | 1.5 | 1 | Pure delight with a tap-versus-drag risk; the plan already marks it first to drop. (◇ candidate.) | 4 | medium | CR-2, D1-3, E6b | after V1 |
| S9 | Fold | Fold a page range into a labelled seam so p. 3 sits next to p. 40; Fold to marks keeps only highlighted parts. | web | 60 | 6 | 1 | XL change to the virtualised reader layout; core-reader regression risk. | 4 | high | — | after V1 |
| E26 | Drag pages out of the window | Drag thumbnails to the desktop to get a PDF of just those pages; long-press to Share. | web | 8 | 1 | 1 | Chromium-only drag-out (DownloadURL); Extract already does the job. | 3 | medium | — | after V1 |
| E4 | Minimised capsule | On scroll the capsule shrinks to a small pill instead of hiding; scroll up or any key brings it back. | web | 12 | 1.5 | 1 | Replaces working hide-on-scroll code (hide-on-scroll.ts); regression risk for a small gain. | 3 | medium | E1 | after V1 |
| E31 · M11-4 | Markup out and in (XFDF) | Send only your marks as a small file; import a colleague's marks to accept or reject. | web | 12 | 1.5 | 1 | Collaboration without a cloud; needs Acrobat round-trip tests. | 3 | low | E20 | after V1 |
| E5 | Pinch-scrubbed page ↔ grid | Pinching moves continuously between the page and the grid and follows your fingers. | web | 20 | 2 | 1 | Delight only; a 240 ms transition already exists; Safari gesture events are risky. | 3 | medium | E6b | after V1 |
| E26-2 · I31 | Lift from page | Hold an image or signature on the page to lift it out and drop it into a tab, the stamp tray or a PNG. | web | 20 | 2 | 1 | Photos-style delight; needs tracing and non-destructive copy. | 3 | medium | E26 | after V1 |
| S6 | Writing loupe | A docked magnified pad for handwriting into small fields; it moves along the document's lines and fields. | web | 24 | 3 | 1 | Worksheet niche; tight on 1180×820 screens. | 3 | medium | S3-S | after V1 |
| E10-3 · I22 | Plain-language plan to Batch | Describe a job in words; Recto shows a Batch plan card you check before Run. | web | 24 | 3 | 1 | Phase 3 of ⌘K v2; no model allowed (D-1), so it is a rule parser. | 3 | medium | E10 · D2-8 | after V1 |
| B2 | Compose in Compare | Build a new file by picking, page by page, the better side of two versions. | web | 30 | 3 | 1 | Bet; page pairing must be solid first. | 3 | medium | D2-6 | after V1 |
| B17 | Split read view, multi-window | Read two places side by side, or the same file in two windows. | web | 30 | 3 | 1 | Bet; iPad render memory; desktop is the better home for multi-window. | 3 | high | — | after V1 |
| B3 | Branching time strip | History that branches: try something, go back, keep both paths. | web | 40 | 4 | 1 | Bet; risky change to the history model. | 3 | high | — | after V1 |
| B4 | Audio-synced markup | Record audio while marking up; tap a mark to hear what was said then. | web | 40 | 4 | 1 | Bet; microphone UX and file size. | 3 | medium | — | after V1 |
| B15 | Excerpt Shelf | Collect excerpts from many PDFs on a shelf that links back to each source. | web | 60 | 6 | 1 | Bet; XL and overlaps Pins and Notes out. | 3 | medium | — | after V1 |
| B6 | Merge markups via an op log | Two people mark the same file separately and Recto merges both sets. | web | 80 | 8 | 1 | Bet; XL, needs E31 first. | 3 | high | E31 · M11-4 | after V1 |
| I66 | Colours from this page | The colour panel offers colours picked from the open page. | web | 3 | 0.5 | 1 | Tiny delight; eyedropper already exists. | 2 | low | E2 | after V1 |
| E3b | Two-finger hold to rewind | Hold two fingers to rewind undo step by step, then slide into the history scrubber. | web | 4 | 0.5 | 1 | Two- and three-finger undo/redo already exist. | 2 | medium | CR-2 | after V1 |
| E6c · I26 | Range brackets on the scrubber | Shift+←/→ on the page scrubber marks "pp. 14–22" so page actions apply without opening the grid. | web | 4 | 0.5 | 1 | Small speed-up; the grid selection covers the job. | 2 | low | E6b | after V1 |
| M1-a | Split by any outline level | Split a PDF at any bookmark level, with file names from the bookmarks. | web | 4 | 0.5 | 1 | Top-level split already works. | 2 | low | — | after V1 |
| S10-F · I15 | Float a page (Chromium) | Move a pinned page into its own always-on-top window, on Chromium only. | web | 4 | 0.5 | 1 | Single-engine extra, hidden elsewhere. | 2 | low | S10 | after V1 |
| M3-c | Removable watermark | Watermarks written as /Watermark annotations, so they can be removed later. | web | 6 | 1 | 1 | Furniture watermarks already work. | 2 | low | — | after V1 |
| SIDE · M11-6 | Tablet side dock | The markup palette can dock to a side on tablets. | web | 8 | 1 | 1 | Decide together with E4; one tablet placement story. | 2 | medium | E4 | after V1 |
| E23 | Reading ruler and focus | A ruler dims everything but the current lines; a focus mode steps paragraph by paragraph. | web | 8 | 1 | 1 | Comfort for long reading; niche. | 2 | low | — | after V1 |
| E23-2 · I19 | Listen with on-device voices | Recto reads the page aloud with the device's own voices and highlights each word. | web | 8 | 1 | 1 | Only local voices are allowed, which vary by device; hidden when none exist. | 2 | medium | E23 | after V1 |
| E15b | Shortcut coaching and What's new | After the third mouse use Recto suggests the key; the ? overlay lights what you use; a one-time What's new card. | web | 8 | 1 | 1 | Nice for power users, not needed to finish a job. | 2 | low | E15a | after V1 |
| E17b | Requests ledger and on-device intelligence panel | "Requests made by Recto: none observed · 37 files processed"; Settings lists every smart feature's source. | web | 8 | 1 | 1 | E17a carries the proof for V1. | 2 | low | E17a | after V1 |
| D3-8 | Ambient light (aurora) | A soft light under the armed tool and around long jobs, with an Ambient light setting. | web | 8 | 1 | 1 | Decorative; waits for the brand kit. | 2 | low | brand mint stop | after V1 |
| M4-c | Trim to content | Crop pages to their content bounds in one step. | web | 8 | 1 | 1 | Needs image and vector bounds from the engine. | 2 | medium | — | after V1 |
| BATCH-R · RED-1 | Redaction in Batch recipes | Batch recipes can redact patterns (IBAN, TCKN) across many files. | web | 8 | 1 | 1 | Powerful but risky without per-file review; after V1. | 2 | medium | — | after V1 |
| E19 | Study and present pack | Tape to cover answers, Recall to blur highlights, a Laser pointer and a nib pen. | web | 10 | 1 | 1 | Student niche; Laser never writes to the file. | 2 | low | — | after V1 |
| E29 | Performance mode | Half-page turns, edge taps and Bluetooth pedals for musicians; setlists from the Library. | web | 10 | 1 | 1 | Clear niche (forScore users); no V1 job needs it. | 2 | low | — | after V1 |
| E25a | Make room, @ inserter, smart dates | Drag a page edge to add margin; type @ for today, initials or a page link; ";date" and EN/TR dates fill date fields. | web | 10 | 1 | 1 | Convenience; the My info row of @ belongs to desktop. | 2 | low | — | after V1 |
| E27 | Accessibility label and text size | Settings shows Recto's accessibility support and lets you scale the interface text from 85 to 200 %. | web | 10 | 1 | 1 | Owner rule: extra accessibility is not a V1 requirement. | 2 | low | E1 | after V1 |
| E33 | Quick Look and folders | Space previews a Library file without opening it; manual folders and tags. | web | 10 | 1 | 1 | Only matters with large libraries. | 2 | low | — | after V1 |
| L-1 | Liquid Glass union (lab) | The capsule and page pill merge and split like liquid, behind a lab flag. | web | 10 | 1 | 1 | Experiment; measured against the glass quality bar first. | 2 | high | ED-3 | after V1 |
| NUP · PG-1 | N-up and booklet | Print several pages per sheet, or impose a folded booklet. | web | 10 | 1 | 1 | Printing niche. | 2 | medium | — | after V1 |
| B9 | Browser built-in translate and summarize | Translate or summarise a page with the browser's own model, where it exists. | web | 10 | 1 | 1 | Chromium-only; the browser downloads its model from the network. | 2 | medium | — | after V1 |
| E32 | Calibrated measure | Set the scale from one known length, then measure distance, area and perimeter as real PDF measure marks. | web | 12 | 1.5 | 1 | Architecture and engineering niche. | 2 | medium | S3-S | after V1 |
| B12 | Auto Trace a scanned signature | Turn a photo of your signature into a clean saved signature. | web | 12 | 1.5 | 1 | Bet; after the signature UX settles. | 2 | low | — | after V1 |
| ANN-1 | Rich text in text boxes | Bold, italic and colour inside one text box. | web | 16 | 2 | 1 | Plain text boxes cover V1; needs the Unicode font work first. | 2 | medium | M2-a | after V1 |
| B13 | Document health lane, tape view, minimap | A strip beside the pages showing scanned, empty, marked or changed pages at a glance. | web | 16 | 2 | 1 | Bet; after E6. | 2 | low | E6b | after V1 |
| CERT · SIG-2 | Certification signatures | Certify a document (DocMDP), sign encrypted files, import legacy .p12 keys. | web | 24 | 3 | 1 | Professional niche; approval signatures already work. | 2 | medium | — | after V1 |
| TABLE · CONV-2 | Table extraction | Export a table on a page to CSV. | web | 24 | 3 | 1 | Heuristic and error-prone without a model. | 2 | medium | — | after V1 |
| OCR-1 | RTL and vertical OCR, editable OCR text | OCR for Arabic, Hebrew and vertical scripts, and fixing recognised words by hand. | web | 24 | 3 | 1 | Outside the EN/TR audience for now. | 2 | medium | — | after V1 |
| B19 · M11-8 | Right-to-left text | Right-to-left text in text boxes, Find and text editing. | web | 24 | 3 | 1 | Outside the EN/TR audience for now. | 2 | medium | — | after V1 |
| B7 | Replay | Play back ink and review as a video. | web | 24 | 3 | 1 | Bet; needs ink timestamps from E18. | 2 | medium | E18 | after V1 |
| B11 | Tidy handwriting, Nudge | Straighten and even out handwritten lines after writing. | web | 24 | 3 | 1 | Bet; niche. | 2 | medium | — | after V1 |
| B14 | Threads (ink links) | Draw a line that links two places in the document; tap to jump between them. | web | 24 | 3 | 1 | Bet; after Peek. | 2 | medium | S1-1 | after V1 |
| E34 | Accessibility checker | A local check of tags, reading order, alt text and language, with manual alt-text and heading editing. | web | 30 | 3 | 1 | Owner rule: extra accessibility is not V1; StructTree writing is an L. | 2 | medium | — | after V1 |
| M1-c | Warning on duplicated form pages | A badge warns when a duplicated page carries form fields. | web | 3 | 0.5 | 1 | Rare; pairs with M4-a. | 1 | low | — | after V1 |
| E22a | Installed-app extras | When installed: screen stays awake while presenting or filling, app shortcuts, title-bar overlay (where supported). | web | 4 | 0.5 | 1 | Chromium-heavy extras; hidden elsewhere. | 1 | low | — | after V1 |
| D1-4b | Lock setting, Lock in ⌘K, tab glyph | A setting to open every document locked, a Lock command in ⌘K and a lock glyph on tabs. | web | 4 | 0.5 | 1 | The lock menu already works; waits for the five-person test. | 1 | low | D1-4a | after V1 |
| EXT · M11-3 | Browser extension "Open with Recto" | Open a PDF from any web page in Recto with one click. | web | 16 | 2 | 1 | A separate product to publish and maintain. | 1 | medium | — | after V1 |
| B16 | Alternates per page | Keep several versions of one page and switch between them. | web | 24 | 3 | 1 | Bet; document-model change. | 1 | medium | — | after V1 |

### desktop (16 items · 498 h serial · ≈ 166 h elapsed)

| Id | Name | What the user gets | Ed. | Hours | WP | Nec. | Why this necessity | Impact | Risk | Depends on | Rec. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DT-1 · M11-1 | Tauri desktop app | An installable Recto for macOS and Windows: open with, save in place everywhere, signed auto-updates. | desktop | 40 | 4 | 5 | It is the desktop edition; code signing and three webviews are the risk. | 4 | medium | DT-0 | desktop |
| DT-0 | Platform refactor | Nothing visible: file, storage and update calls move behind one interface so a desktop build can swap them. | desktop | 24 | 3 | 5 | Every desktop item needs it; W1's ED-1/ED-2 fences make it safe to start later. | 1 | medium | ED-1, ED-2 | desktop |
| DT-3 · S12b · PERS-1 | My info and profiles | Saved name, address, TCKN and IBAN (validated) in the OS keychain fill forms in one tap. | desktop | 16 | 2 | 3 | Placement rule 1: personal identity data lives only on desktop. | 4 | medium | DT-1 | desktop |
| DT-5 · SIG-1 | Network signatures (LTV, timestamps, OCSP) | Long-term valid signatures with trusted timestamps and revocation checks, opt-in per service. | desktop | 40 | 4 | 3 | Professional signing needs it; network beyond the origin means desktop only. | 3 | high | DT-1 | desktop |
| DT-2 | Data bridge web ↔ desktop | Move signatures, presets, recipes and recents from the web app into the desktop app. | desktop | 10 | 1 | 3 | Storage is not shared between the two; users would otherwise start over. | 2 | low | DT-1 | desktop |
| DT-9 · CONV-1 | Office ↔ PDF conversion | Turn Word, Excel and PowerPoint files into PDF and back, with faithful DOCX export. | desktop | 80 | 8 | 2 | Often requested, but needs a heavy LibreOffice-class component (rule 3). | 4 | high | DT-1 | desktop |
| DT-4 · E22b · B10 | File watching and folder Inbox | "Changed on disk" with Reload · Keep mine · Compare; a watched folder becomes an Inbox. | desktop | 16 | 2 | 2 | OS integration (rule 4); useful for office workflows. | 3 | medium | DT-1 | desktop |
| DT-8 · BIG-1 | Very large documents (native PDFium) | Files beyond the web ceiling (over 2,000 pages or 500 MB) open and scroll with native PDFium. | desktop | 30 | 3 | 2 | The web shows an honest limit; the desktop removes it. | 3 | high | DT-1 | desktop |
| B5 | Meaning search with cited passages | Ask a question in plain words and get the passages that answer it, with page links. | desktop | 30 | 3 | 1 | Bet behind D-1 and DT-10. | 4 | high | DT-10 | desktop |
| B18 | Ink to text, handwriting search | Convert handwriting to typed text and find words you wrote by hand. | desktop | 30 | 3 | 1 | Weak without a model (D-1). | 3 | high | DT-10 | desktop |
| DT-10 | Local model runtime and alt text | An opt-in on-device model that suggests alt text and reads handwriting; the base for B5 and B18. | desktop | 40 | 4 | 1 | Owner decision D-1: no model dependency for now. | 3 | high | DT-1, D-1 | desktop |
| DT-11 | HEIC pages | Insert iPhone HEIC photos as pages. | desktop | 6 | 1 | 1 | Decoder too large for the web (rule 3). | 2 | low | DT-1 | desktop |
| DT-12 · PDFA-1 | PDF/A with a validator | Save archival PDF/A files, claimed only after a validator passes. | desktop | 16 | 2 | 1 | Archival niche; no claim without a validator. | 2 | medium | DT-1 | desktop |
| DT-6 · SIG-3 | Hardware tokens and smart cards | Sign with an e-signature token or smart card (for example a Turkish e-imza card). | desktop | 30 | 3 | 1 | No browser API exists; strong in Turkey but driver-heavy. | 2 | high | DT-1 | desktop |
| DT-7 · API-1 | API connections | Opt-in connections to outside services, keys kept in the keychain. | desktop | 30 | 3 | 1 | Owner: "much later"; network (rule 2). | 2 | high | DT-1 | desktop |
| DT-13 · M11-2 | Plugin API | Third parties add tools to Recto. | desktop | 60 | 6 | 1 | Security and support cost; no demand yet. | 2 | high | DT-0 | desktop |

### phone (10 items · 167 h serial · ≈ 104 h elapsed)

| Id | Name | What the user gets | Ed. | Hours | WP | Nec. | Why this necessity | Impact | Risk | Depends on | Rec. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| M10-3 | Phone: Fill & Sign | Tap a field, type, step with ‹ › Done above the keyboard, add a saved signature and share, in about six taps. | phone | 16 | 2 | 5 | The main reason anyone edits a PDF on a phone; Safari keyboard handling (visualViewport) is the risk. | 5 | medium | M10-0, M10-P | phone |
| M10-0 · ED-4 | Phone prep: headless markup | Nothing visible: tool logic moves out of the palette, ink strip and pen well into shared hooks; phone sheets get detents. | phone | 24 | 3 | 5 | Every phone editing phase sits on it; it touches full-shell files, so it waits for the V1 freeze. | 1 | medium | M10-P | phone |
| M10-2 | Phone: Mark mode and pen | A ✎ button turns the bottom bar into a small tool rail; one finger draws, two pan; three colours, three sizes, eraser. | phone | 16 | 2 | 4 | Core of an editable phone edition; the ink kernel already exists. | 5 | medium | M10-0, M10-P | phone |
| M10-1 | Phone: highlight from selection | Select text and tap Highlight, Underline or Note; edit notes; undo; share a copy. | phone | 8 | 1 | 4 | The smallest useful phone edit; reuses the selection bar logic. | 4 | low | M10-0 | phone |
| M10-5 | Phone polish | Landscape, Android haptics, a VoiceOver/TalkBack pass and the honest "phone marks up, fills and signs" line. | phone | 12 | 1.5 | 3 | Quality bar on phones; owner checks pen latency on his own phone. | 3 | low | M10-2, M10-3 | phone |
| M10-P | Phone prototypes A and B | Two clickable designs on the owner's phone behind a lab flag: two tools + ＋, or a five-tool rail; the owner picks. | phone | 12 | 2 | 3 | Decides the phone design cheaply; new files only, so it can run before V1 without touching the shipped reader. | 2 | low | M10-R | phone |
| M10-R | Phone study | A short report comparing how Apple Markup, PDF Expert, GoodNotes, Acrobat and others edit on phones. | phone | 4 | 1 | 3 | Read-only, can run any time, even beside V1 waves. | 1 | low | — | phone |
| B1 · M10-6 | Text view (local reflow) | The page's text reflowed to the phone's width, readable without zooming. | phone | 60 | 6 | 2 | XL and hard on real PDFs (columns, figures); later also on the web. | 4 | high | M10-5 | phone |
| M10-4 | Phone: arrange pages | Select pages in the Pages sheet; long-press drag to reorder; Rotate, Delete, Extract. | phone | 10 | 1 | 2 | Less common on phones; accidental drags while scrolling are the risk. | 3 | medium | M10-0 | phone |
| M10-ES | Phone edge slider | An optional size/opacity slider on the right edge while the pen is active (Procreate style). | phone | 5 | 0.5 | 1 | The options tier already covers it; off by default. | 2 | low | M10-2 | phone |

## Happening anyway

These are not decisions. They happen on the V1 path whatever the owner picks above, so they are
left out of the table.

- **Design system and consistency (first, per the owner):** E1 size scale and Q-9 walker, E2 ink
  strip remainder, R11 iPad notes, XD-3 review leftovers, E6a grid selection, E8a Library phase 1,
  D1-8 dialogs → sheets, D1-8b `canChange` acts in sheets, BEFORE-SLOT (sheet primitive),
  D3-9 Turkish casing ban and uppercase labels, CR-1…CR-8 calm rules, ED-1…ED-3 edition guards,
  D4-4 polish, D4-5…D4-9 media, README, About, brand, docs.
- **Core bug fixes and correctness:** D1-3 lock in `commit()`, D1-4a signed/restricted lock on
  open, M4-d unsigned `/Sig` shown as signed, M2-a Unicode free text (Turkish ğ ş ı İ),
  M1-b EXIF orientation, M1-d engine warnings in Turkish, M8-d-a IME position and false honesty
  line, M8-g inert buttons when locked, M8-i small misc, M8-d-b text-edit leftovers, M2-b stamp
  opacity, M2-d undo of imported annotation delete, P-6 Chrome 154 recheck, P-7 qpdf rebuild drift.
- **Tests and gates:** M3-d, M5-b, M8-e, PEN-CHECK, `jobs.spec.ts`, §10.5 exit gates, V1-B3 fuzz,
  V1-F14 migrations, V1-F15 offline.
- **Internal performance (no UI change):** PF-1…PF-17 (including PF-12 locale split = I18N-1 and
  PF-16 second worker), M8-a ink latency, M8-b `pointerrawupdate`, M8-h grid glass cost, M5-c,
  M5-d, MDL-1 / M11-7 model cleanup, COW / M11-5 copy-on-write sources.
- **Owner and release steps:** XD-1 five-person test, XD-2 measurements, P-1…P-5, P-8, D4-10 press
  kit, D4-11 case study, DOC-1…DOC-7.

## Notes for the owner

- **Cheap V1 additions if a lane is idle:** E21 Notes out (5 h), I66 colours from this page (3 h), M1-a split by outline level (4 h). None is needed; all are low risk.
- **Phone timing.** M10-R (4 h) and M10-P (12 h) touch no shipped code and can run beside V1 waves (PLAN O-8). M10-0 touches full-shell files and should start after the V1 UI freeze. The phone track to a usable editor (M10-R → M10-5, without B1 and the edge slider) is about 102 h of work.
- **Desktop** starts with DT-0 and DT-1 (64 h on the critical path) before any desktop feature can land.
- **Machine-readable copy:** the same rows exist as a JSON array (fields id, name_tr, desc_tr, edition, hours, wps, necessity, impact, risk, deps, rec) next to the Turkish copy.
