# Recto R12: innovation roadmap

Date: 2026-10-09. Status: **final proposal for the owner's review.** Nothing here is decided until
it lands in `docs/specs/redesign.md` (§10 "R12") or an ADR.

Inputs: the baseline (`baseline.md`), ten research tracks (`research/*.md`, Appendix B), about 175
findings, the draft (`roadmap-draft.md`) and a code-checked critique of that draft. Every factual
correction in the critique was verified against `apps/web/src` before it was adopted here.

---

## 0. Executive summary

1. Recto's PDF core is complete and correct. What it lacks is the feeling that the app understands the page and protects the person using it.
2. We borrow that feeling from notes apps (GoodNotes, Notability), pro tools (Procreate, Affinity, Figma, Illustrator), video editors (Final Cut, Logic, Premiere), photo apps (Lightroom, Photos), productivity tools (Raycast, Linear, Things) and Adobe Acrobat.
3. **First we finish R11 and the owner's iPad notes** (sizes, ink strip, Library, grid selection, capsule morph), on top of one foundation pass: size tokens, gesture table, key map v2, a stroke-capture page.
4. **Then twelve signature moves no PDF app combines**: Peek & Return, hold to see the original, ink that snaps to the document's own lines, scratch to erase, the capsule as source and sink, Flashback, Make fillable with My info, and more.
5. Around them, **34 excellence improvements** cover menus, the Pages grid, forms, onboarding, reading, privacy proof, and new user groups (students, lawyers, form fillers, musicians, AEC, accessibility).
6. The first visible "wow" ships in Wave 0.1: hold `B` (or the title-menu eye) to see the page without your marks.
7. Four calm rules keep this from becoming clutter: one transient chip on screen, one gesture table, one key map, and one puck.
8. Every proposal runs on the device, adds no dependency, works in Chromium, Firefox and WebKit, and hides (never advertises) single-engine extras.
9. Work runs in ten waves of at most three parallel work packages with disjoint file lanes, each with an owner task script, a bundle budget and a screenshot review.
10. Five owner decisions gate the rest (§8): local models (D-1), Flashback default (D-2), pen-gesture and tip-ring defaults (D-3), key map v2 (D-4), Turkish-keyboard twins (D-5).

---

## 1. Method (short)

1. **Cluster** the findings into initiatives. Convergence across tracks counts as evidence (Peek: four tracks; Hold to see original: three; drag-to-create: two).
2. **Filter** out what Recto already has (hold-to-straighten, two/three-finger undo/redo, lasso transform and split, eyedropper loupe, colour panel, Focus mode, history scrubber with preview, ⌘K with recents, `?` overlay, Batch recipes, pen hover cursor, save in place, Web Share, View Transitions, page scrubber, Space-to-pan) and what breaks a principle (§9).
3. **Score** 1–5 for value V, novelty N, fit F; effort S/M/L/XL = 0/1/2/3; risk L/M/H = 0/1/2.
   **P = 2V + 1.5N + F − effort − risk** (max 22.5). The score orders the list; it does not decide it. The owner's complaints override it (that is why Wave 0 exists).
4. **Tier**: Signature (N ≥ 4, visible within seconds), Excellence, Bet, Dropped.
5. **Sequence** into waves of at most three WPs, each owning a disjoint file lane (§7.1).

Corrections made in this revision: I62 rescored (18.0); I32, I42, S1 citations, S8, S11, E9 and S9 resized up; S2 phase 1 and E13 resized down; E22 and Float lowered; the critique's own scores for four new ideas corrected (Sanitize, XFDF and Quick Look are 16.5, the accessibility checker is 16.0); the table re-sorted (Appendix A).

---

## 2. Themes

| # | Theme | Promise | Main initiatives |
|---|---|---|---|
| T1 | **Ink that understands the page** | Your pen knows where the lines, boxes and fields are. | S3 snapping and QuickShape, S4 pen gestures, S6 loupe, S5 tip ring, E18 ink comfort |
| T2 | **Look before you leap** | See where a link leads, what changed and what an act will do, without losing your place. | S1 Peek & Return, S2 original and Changes lens, Before chips, S10 Pins, S9 Fold |
| T3 | **Nothing is ever lost** | Throw things away freely; they come back. | S8 Flashback and versions, undo HUD, receipts on Save |
| T4 | **Motion as meaning** | Every animation says what happened and where it went. | E3 stateful glyphs and odometer, S7 capsule source/sink, E14 trays, E12 signature ink-in, E5 pinch-scrubbed grid |
| T5 | **Pages you can hold** | Pages behave like photos on a light table. | E6 grid selection and Review pages pass, E7 outline moves pages, E26 drag a page out, S11 linked Repeat, E28 Paper |
| T6 | **Power without clutter** | Depth hides in context: the palette, the finger, one key. | E10 contextual ⌘K, '/' inserter, E15 tips and coaching, E20 style tools |
| T7 | **A library and app that feel native** | Recto behaves like an installed app that knows your files. | E8 Library, E9 triage card and search, E33 Quick Look and folders, E22 native extras |
| T8 | **Proof, not promise** | Every smart or private claim is something you can check. | E17 observed-requests ledger, E30 Remove hidden information, receipts on Save, on-device intelligence panel |
| T9 | **Built for people who live in PDFs** | The daily jobs of real groups are first-class. | S12 Make fillable + My info, E29 Performance mode, E31 Markup out/in, E32 calibrated measure, E34 accessibility checker |

---

## 3. Calm rules every work package obeys

These rules answer the critique's main structural findings. They are written into `redesign.md` §10.0 in Wave 0.0 and each has a test.

1. **One transient chip at a time.** Back, Edit shape, Select, Before, linked badge, Stay, Changes count and tips all share one chip slot beside the page pill. A priority queue decides (user-invoked > result-of-act > teaching); a tip never pre-empts anything and waits for the next calm moment. Test: a walker asserts at most one `[data-transient-chip]` in the DOM.
2. **One gesture table.** `motion/gesture/arena.ts` already exists; Wave 0.0 writes the table (every recogniser, threshold, precedence, mode) into the spec and adds arena tests. No WP adds a recogniser without a row. Decided collisions:
   - Two-finger hold (400 ms) belongs to **undo rewind** only. Hold-to-see-original has no two-finger trigger.
   - Long-press 450 ms on a page = page menu; on a link target = Peek. Pen still-press 550 ms = tip ring **only if enabled** (default off, D-3). Drag-out from the capsule = 200 ms press then 8 px move. E10 has **no** long-press path; the page context menu gains a "Search actions…" row instead.
   - Fold has no pinch in its first version (menu, scrubber marquee). Four-finger tap is prototyped before it is specced.
3. **One key map (v2, D-4).** One keymap PR in Wave 0.0, checked against `SHARED_KEYS`, with a Turkish Q layout added to the keymap tests and letters matched by `event.key`. Resolutions in §3.1.
4. **One puck.** The modifier puck (Shift/Alt for keyboardless iPads) and the Focus puck are the same object (S5). Tool switching stays on the ink strip; the tip ring is an optional accelerator; spring-loaded tools and the two-tool swap reuse existing tool keys and add none.
5. **Glass budget.** Peek card, Pins, ring, puck, minimised capsule and loupe pad are Solid or lens-based and counted by the glass walker (Q-3…Q-5).
6. **Bundle budget.** Initial JS stays within +10 % of M8 overall and grows by at most 1 % per wave. Every WP names its lazy-load boundary (dynamic `import()` at first use) in its PR.
7. **Proof of done.** Each wave has an **owner task script** run on the owner's iPad with timings (§7.2), plus CPU-throttled Chromium (4×) proxies in CI for any "mid-range iPad" timing.
8. **Cross-engine honesty.** Chromium-only features are feature-detected and hidden elsewhere, never sold as core.
9. **Storage honesty.** Snapshots, Flashback, pins, the search index and the ledger share the 500 MB cap; Settings shows each one's size.

### 3.1 Key map v2 (proposed, D-4 and D-5)

| Need | Draft claim | Collides with | Resolution |
|---|---|---|---|
| Hold to see original | hold `\`; two-finger hold | `\` needs AltGr on TR-Q; two-finger hold = rewind | **Hold `B`** (Before; free today), **Shift+B** wipe; title-menu eye; hold a Before chip |
| Peek a link by keyboard | Space hold/tap | Space = next page and list toggle (`viewer-commands.ts:121`, `keymap.ts:278`) | Tab to a link: **Enter** goes, **Shift+Enter** peeks |
| Back / forward stack | ⌘[ ⌘], Alt+←/→ | browser Back on macOS; `[`/`]` = prev/next page; Alt+←/→ = `pages.moveBackward/Forward` (`app-commands.ts:573`) | **Z** back, **Shift+Z** forward (free; echoes ⌘Z), plus the Back chip |
| Tip ring | hold Q | Q = Lasso (`tools.ts:65`) | **Hold W** (wheel), then arrows and Enter |
| Range marks | I / O | I = Image, O = Ellipse | **Shift+←/→** on the focused scrubber extends a range |
| Spring-loaded tools | hold E / L | E = Edit text, L = Line, eraser = Shift+E | Hold **any tool's own key** over 250 ms = temporary tool; release returns |
| Swap last two tools | X | X = Redact (`tools.ts:161`) | Press the **active tool's key again** returns to the previous tool; tap the active chip on touch |
| Unfold all / Focus puck | Shift+F, ⌘⇧F | F = Focus mode (`focus-mode.ts:52`) | Focus puck = **F** (Focus mode becomes the puck); Esc unfolds |
| Copy / paste style | ⌥⌘C / ⌥⌘V | ⌥⌘C opens the inspector in Chrome on macOS | Selection-bar items and ⌘K only, no default key |
| Pin a version | ⌥⌘S | needs check | **⌥⌘S**, matched by `event.code`, verified in the keymap PR |
| Insert menu | `/` | Shift+7 on TR-Q | `/` by `event.key` (works on TR-Q as Shift+7) plus the capsule **+** as its twin |
| G-sequences, Shift+H, ribbons on B | — | G = Signature; B now Before | Dropped; ribbons live in the page-pill menu |
| Review pages pass | X reject, K keep | X/K are contextual elsewhere | Scoped to the pass only: **←/→** move, **X** reject, **P** keep (Lightroom), registered in `SHARED_KEYS` |

---

## 4. Signature innovations (12)

Format: **What · Why · Inspired by · UX · Acceptance · Effort / Depends / Risks**.

### S1 · Peek & Return
- **What.** Look at any destination without leaving your place; get back with one tap. Peek works on internal links, outline rows, Find hits and thumbnails; detected "Fig. 3" / "[12]" citations come as a follow-up. Every jump goes on a back stack. Holding the page pill scrubs pages and springs back on release.
- **Why.** Papers and contracts are full of cross-references; readers fear losing their place. `viewer/LinkLayer.tsx` jumps at once and keeps no history. Four tracks proposed it independently.
- **Inspired by.** Zotero 7 citation popups, Skim and Acrobat Previous View, Arc Peek, Linear Space-peek, Notion side peek, Obsidian hover preview, Kindle Page Flip, Procreate Dreams scrub-lock, Final Cut skimmer.
- **UX.**
  - Triggers: hover 300 ms (fine pointer, off while a pen tool is armed); long-press 450 ms on a link (peek wins over the page menu, which stays on ⋯ and right-click); keyboard Shift+Enter on a focused link.
  - Card: Solid M4 card anchored to the source (anchor positioning, JS fallback), never covering the source line; a reading-size crop centred on `/XYZ top`; footer `p. 14 · Go · Pin`; ‹ › step through the other references on the page.
  - Go: the card grows into the page (shared-element View Transition ≤ 240 ms); a **Back chip** "← p. 3" takes the transient-chip slot for 8 s; `Z` / `Shift+Z` walk the stack.
  - Peek-scrub: press and hold the page pill → filmstrip above the pill, the stage follows under a peek veil; lift springs back with velocity handoff; "Stay" commits.
  - States: idle → arming → peeking → pinned | going → back-available. Esc closes; reduced motion crossfades.
- **Acceptance.** Peek in < 120 ms warm and < 300 ms cold on the throttled-Chromium proxy and the owner's iPad; stage scroll never shifts; Back restores scroll ±2 px and zoom; 50-entry stack per tab persisted in the session snapshot; citation follow-up ≥ 90 % precision on an EN+TR paper corpus, no peek below threshold; `aria-live` polite announcement; zero frames at rest; all three engines.
- **Effort** M (phase 1: link peek, stack, chip, peek-scrub); citations M; skim S. **Depends** worker crop render (exists), `navStack` in `state/view-store.ts`, page pill slot from the Frame lane. **Risks** hover noise (pen-armed rule, 300 ms), long-press conflict (table rule).

### S2 · Hold to see the original (and the Changes lens)
- **What.** Hold to see the page exactly as it was when opened. Shift adds a draggable wipe. Each sheet that changes the document gets a press-and-hold **Before** chip. Phase 3: a **Changes lens** dims the original and lights only what you changed.
- **Why.** Proves non-destructiveness with one gesture; three tracks converged; no PDF app has it.
- **Inspired by.** Snapseed and Lightroom `\`, Photos before/after, Apple Writing Tools Original ⇄ Revised, iA Writer authorship, Figma versions.
- **UX.**
  - Triggers: hold **B**; press and hold the eye in the title menu; hold a Before chip. No two-finger trigger.
  - **Phase 1 (marks only, Wave 0.1):** when only annotations changed, hide the annotation overlay layers through `annotations/layer-registry.ts`; label "Original · opened 14:02"; 120 ms crossfade.
  - **Phase 2 (Wave 1):** when text edits, crop or redaction changed the page, render the source bytes once more (visible page + one neighbour cached). Shift+B wipe: a lime hairline with a lens knob on a non-glass `clip-path` layer. Before chips on Compress, OCR, Redact, Flatten, Crop, Resize (and later Scan Looks); Compress also shows a live 100 % tile and the estimated size.
  - **Phase 3 (Changes lens):** View menu or ⌘K; original at 35 %, changes at 100 % (annotations, edited runs, filled fields, moved/rotated pages, pending redactions); "14 changes" chip; J/K step; offered in Save a copy as "Review your changes".
- **Acceptance.** Phase 1 swap < 50 ms; phase 2 original < 150 ms after first render; release always restores (including `pointercancel`); "Showing original" announced; reduced motion = instant swap.
- **Effort** phase 1 S, phase 2 M, lens M. **Depends** source bytes in the engine (exist), text-edit run rects (lens). **Risks** memory (cache limit), key conflicts (resolved by v2).

### S3 · Ink that knows the page: page-aware snapping and QuickShape
- **What.** (1) Signatures, text boxes, stamps, notes, images and shapes snap to what the PDF contains: baselines and x-heights, "Sign here ____" rules, form boxes, table edges, margins, page centre, other marks. Alt-hover measures distances. (2) A held stroke becomes a **real PDF shape** (Square, Circle, Polygon, PolyLine, Line with arrowhead), not ink.
- **Why.** Placing a signature on a line is the most common fiddly task. Snapping to the document's own structure is new for PDFs; QuickShape gives clean diagrams that stay editable in Acrobat.
- **Inspired by.** Affinity candidate snapping, Figma smart guides and Option-measure, Halide overlays, Procreate QuickShape, Apple Notes/Freeform, Notability and GoodNotes shape conversion, OneNote straighten.
- **UX.**
  - Snapping: only candidates within 1.5 line-heights; engaged snap = 1 px lime hairline + the E1 detent pulse; velocity gate (no snap above 1.2 px/ms); hold ⌘/Ctrl or the puck centre to bypass.
  - QuickShape extends hold-to-straighten (`annotations/pen/straighten.ts`): hold still 300 ms → line, arrow, rectangle (6° axis snap), ellipse/circle, triangle/polygon, polyline, check, cross; the shape follows the pointer until release; settle 1.03 → 1; an **Edit shape** chip (Circle · Rectangle · Keep as ink, 4 s). Highlighter: a held box around lines becomes a text Highlight. Lasso bar gains **Make shape**.
  - Screen readers: a snap announces "Snapped to line"; QuickShape has a lasso-bar equivalent.
- **Acceptance.** Candidates < 2 ms per move; ruled-line detection once per page in the worker < 30 ms; a signature dropped within 8 pt of a rule lands on it; **never converts without the hold**; undo restores the freehand stroke; valid annotations with appearance streams checked in pdf.js and PDFium; ≥ 95 % class accuracy on a 200-shape set and 0 conversions on the handwriting set, **both recorded on the owner's iPad** with the Wave 0.0 capture page.
- **Effort** QuickShape M (Wave 1), snapping L (Wave 3). **Depends** `annotations/page-text.ts`, engine Polygon/PolyLine/LE support (verify first), E1 detent. **Risks** sticky snapping (radius, velocity, bypass); noisy scans (confidence threshold, do nothing below it).

### S4 · Pen gestures: scratch to erase, loop to select or act
- **What.** With the pen armed, a zig-zag over ink erases it. A closed loop around marks offers Select. A loop held over text snaps to the words and opens Highlight · Redact · Comment · Copy.
- **Why.** Correction and selection stay inside the writing flow; it is the most loved notes-app helper and Recto has none.
- **Inspired by.** GoodNotes Scribble to Erase and Circle to Lasso, Nebo scratch-out, Apple Smart Script, OneNote, Photos Clean Up "circle it".
- **UX.** Scratch recogniser at release in `annotations/pen/ink-input.ts`: ≥ 4 axis reversals, path ≥ 3× the bbox diagonal, bbox < 120 pt, ≥ 30 % coverage of existing marks; marks dissolve in 160 ms; one history entry "Erased 3 strokes by scratching" with Undo; never with the Highlighter. Loop closed within 12 % of its perimeter keeps its ink and shows a **Select** chip for 1.5 s. Loop + hold 300 ms over text → glow on the words → small radial. Setting "Pen gestures" with a first-use naming tip.
- **Acceptance.** Zero false scratches on the owner-recorded handwriting set (m, w, e, l, o, shading, signatures); ≥ 95 % recall on scratches; < 1 ms; exact undo; mouse and finger behave like the pen; redaction from the radial only marks. VoiceOver/keyboard: the same acts exist on the lasso and selection bars.
- **Effort** M. **Depends** lasso hit testing and eraser split rules (exist), Wave 0.0 stroke capture. **Risks** false positives (thresholds, fixtures, D-3 default; fallback: scratch requires speed above a threshold).

### S5 · Tip ring and the one puck
- **What.** A radial tool ring at the pen tip that also works as a blind flick menu; and **one** glass puck that gives keyboardless iPads Shift and Alt and doubles as Focus mode.
- **Why.** iPad Safari exposes no Pencil squeeze, barrel or double-tap, so tool changes cost a trip to the strip; without a keyboard, constrain, duplicate and proportional resize are impossible.
- **Inspired by.** Pencil Pro squeeze palette, Procreate QuickMenu and four-finger tap, Concepts wheel, Affinity Command Controller, Fresco Touch Shortcut, Notability Focus, Muse.
- **UX.**
  - Ring triggers: pen barrel button (`buttons & 2`) where present; right-press-drag on desktop (plain right-click keeps the page menu); hold **W**; pen still-press 550 ms **only when enabled** (default off, D-3; resting pens trigger it falsely).
  - Ring: six slots (four presets, Eraser, Lasso) plus an inner ring (Undo, recent colours); drawn only after 180 ms so a fast flick fires blind; long-press a slot to assign any registry command; Solid-backed, lens not blur.
  - Puck: 44 px, Markup on coarse pointers; docked opposite the dominant hand, draggable, edge-snapping; hold centre = Shift, slide to outer ring = Alt, double-tap = lock (lime ring); one caption line says what it does for the armed tool. **F** (or the Focus row) collapses all chrome into the puck; tap the puck for the ring, tap again to restore. A `state/modifiers` store is OR'd into every `shiftKey`/`altKey` read.
- **Acceptance.** Ring opens within one frame of its threshold; blind flick < 250 ms with no ring paint; 44 px targets; keyboard parity (W, arrows, Enter); the puck never overlaps the capsule (free rect); glass count within budget.
- **Effort** M + M. **Depends** gesture table, an audit list of modifier read sites. **Risks** GoodNotes-style backlash (additive only, strip never hides presets, ring can be off).

### S6 · The writing loupe that follows the document
- **What.** A docked magnified pad for writing on small fields; its frame auto-advances along the PDF's real text lines and form fields.
- **Why.** Filling worksheets by hand on iPad means constant zooming. Zoom windows exist in notes apps; following the document's structure is new.
- **Inspired by.** GoodNotes Zoom Window and Auto Advance, Noteshelf Zoom Box.
- **UX.** "Loupe" toggle in the ink strip (medium and larger). Solid pad above the capsule, draggable height, 2–4×; lime frame on the page. Pad strokes map affinely into the normal pen path (bursts, dry ink, undo all work). Writing into the right 20 % (mirrored for left-handers) slides the frame along the PDFium line or field, then to the next line or next empty field. Finger drag or arrows move the frame. The palette collapses while the loupe is open.
- **Acceptance.** Pad ink identical to direct ink; pen preview still ≤ 1 frame; auto-advance follows line rects on the sample and the form fixture; settings persist per device; reduced motion jumps.
- **Effort** L. **Depends** page-text lines, field rects, region render. **Risks** space on 1180×820; hi-res cost (render the frame region only).

### S7 · The capsule as source and sink
- **What.** Drag new things **out** of the capsule to where they belong; throw things **into** it to delete them; `/` is the keyboard twin.
- **Why.** Creating and placing become one gesture; deleting becomes a spatial act learned once; it gives the capsule a job in motion (the owner's "Animation!").
- **Inspired by.** Things 3 Magic Plus, Instagram/Snapchat drag-to-trash, Notion `/`.
- **UX.** Press 200 ms then drag 8 px on Note, Text box, Signature, Stamp, Image or Blank page → lime ghost + insertion caret; over a page the drop snaps through S3 when available (plain placement before Wave 3); in a gap between grid cells or thumbnails a blank page is inserted there; on a sidebar thumbnail a note is attached to that page; lands with a spring settle and stays selected; Esc cancels. While an annotation, stamp, image or cell is dragged the capsule morphs (new `trash` shape in `capsule-morph.ts`) into a round well that grows magnetically within 96 px; drop dissolves the item in 180 ms with "Deleted · Undo". `/` opens an M4 menu at the last pointer point; typing filters (`/sig`, `/tarih`); Enter places.
- **Acceptance.** All creation through `commit()` and `canChange(place|pages)`; locked → refused with a shake; morph uses the capsule's own geometry, zero layouts; keyboard parity; reduced motion crossfades; pen, touch and mouse in all engines.
- **Effort** M. **Depends** dnd module, capsule shapes; S3 optional. **Risks** tap-to-arm vs drag (200 ms + 8 px rule).

### S8 · Flashback and pinned versions
- **What.** For 7 days, what you threw away is recoverable: Don't-save closes, deleted pages, Erase all, abandoned text edits and fills, undo beyond the 20-step tail. **Pinned versions** are named checkpoints that never expire and open in Compare with one tap.
- **Why.** Removes the fear of losing work, the heart of "undo, not confirmation". New for PDFs.
- **Inspired by.** Logic Pro Flashback Capture, Final Cut snapshots, Lightroom Versions, Figma version history.
- **UX.** A "Flashback" row in the Library (clock glyph, count) and ⌘K "Bring back…" open a sheet of items with thumbnail, what and when. A closed document reopens as a tab; deleted pages fly back to their index. "Pin this version…" (⌥⌘S, title menu → Versions); each pin peeks via S2's render and offers Compare with now · Save a copy from here · Restore (undoable). Library cards show "3 versions". Settings: toggle, size used, Forget now.
- **Safari honesty.** Safari deletes script-written storage after 7 days without use for sites not on the Home Screen, and grants `persist()` (already called in `session/writer.ts`) mostly to installed apps. The sheet says so; in a Safari tab it shows "Add Recto to the Home Screen to keep Flashback"; after an eviction it says so plainly.
- **Acceptance.** Capture ≤ 8 ms main thread; pruning reuses `session/retention.ts`; 500 MB cap includes Flashback (oldest first); redacted content and pages removed by Apply redactions are never captured unless the user opted in (test).
- **Effort** L (Flashback: session, history, pages, text edit and forms capture, eviction, accounting) + M (versions). **Depends** OPFS snapshot format, Compare chooser. **Risks** privacy expectation (copy, Forget now, exclusions), iPad storage pressure; D-2 decides the default.

### S9 · Fold
- **What.** Collapse a page range into a labelled seam so p. 3 sits next to p. 40; **Fold to marks** collapses the document into bands around highlights, comments and Find hits.
- **Why.** LiquidText's best idea, absent elsewhere; turns a linear document into an outline on demand; view state only.
- **Inspired by.** LiquidText collapse and Highlight View.
- **UX.** Primary paths: "Fold here" in the page menu, a marquee on the scrubber, and **Fold to marks** in the Review header (context Line · Paragraph · Page). The seam is a 28 px glass-free strip "pp. 4–17 folded · 14 pages" with a stacked-paper edge; tap springs it open; Esc or "Unfold all" leaves. A vertical-pinch trigger is a later experiment only.
- **Acceptance.** The document is untouched (no undo entry, save stays clean); 60 fps on iPad, transform-only during motion; Find, Peek and the pill report real page numbers; keyboard and VoiceOver path ("14 pages folded, button, expand").
- **Effort** XL (touches the virtualised read layout). **Depends** read-layout band list, annotation quads, Find hits. **Risks** core-reader regressions (behind a flag until the reader's tests pass); discoverability (E15).

### S10 · Pins: floating references
- **What.** Pin a page, a region, a Peek card or a page from another tab as a small floating card that stays while you scroll, mark up or fill elsewhere.
- **Why.** "See Figure 3" and copying an invoice number into a form both force flipping back and forth.
- **Inspired by.** Procreate Reference Companion, Skim snapshots, LiquidText excerpts, Document Picture-in-Picture.
- **UX.** Marquee or lasso then **Pin**; S1's Pin; page menu "Pin page". A **Solid** card in the free rect: draggable, corner-resizable, pinch-zoom inside (re-render at card size × DPR); tapping its title flies back to the source, which flashes. Up to 3 per document, in the session snapshot; auto-minimise to a chip stack while Markup is open on 1180×820. **Float this page** moves a pin into a Document PiP window on **Chromium only**; hidden elsewhere.
- **Acceptance.** Never covers the capsule or pill; re-render < 200 ms; survives reload; Float absent (not disabled) without the API.
- **Effort** M (Float S). **Depends** region render, free rect, S1. **Risks** clutter (minimise rule).

### S11 · Linked Repeat across pages
- **What.** Repeat a stamp, initials, a text box or a redaction box on all, odd, even, a range or "pages like this"; copies stay **linked** until Detach.
- **Why.** Initials on every contract page and Draft marks are daily needs; linked editing is unheard of in PDF tools.
- **Inspired by.** Illustrator on iPad Repeat (live-linked, then Expand).
- **UX.** Select a mark → "Repeat on pages…" (selection bar, ⌘K) → on-canvas widget: All · Odd · Even · Range · Similar; Same spot · Mirror for facing pages; ghosts in thumbnails; one undo step. A dashed lime "linked · 24" badge on hover (via the chip slot); editing one updates all in one step with "Changed 24 linked copies · Detach this one"; Detach / Detach all. Exported as real per-page annotations with the link id in private data.
- **Acceptance.** 500-page fan-out < 300 ms main thread (chunked); redaction repeats only mark; mirror correct; links survive reopen in Recto, plain annotations elsewhere.
- **Effort** L (link-group id, private-data round trip, similarity, mirror). **Depends** annotation store, history `coalesceKey`. **Risks** surprise edits (badge, toast).

### S12 · Make fillable and My info
- **What.** On a flat (non-interactive) form, Recto proposes real fields from the page's own lines, boxes and labels: Accept all, or review one by one. Saved **My info** cards on the device fill name, address, date, TCKN and IBAN in one tap, with checksums validated.
- **Why.** Form filling is the most common iPad PDF task, and most forms are flat scans or prints. The baseline lists field detection as a gap; no initiative in the draft covered it.
- **Inspired by.** Acrobat Prepare Form, iOS 17 PDF AutoFill, password-manager identity cards.
- **UX.** The triage card (E9a) says "Looks like a form with 14 blanks · Make fillable". Proposed fields appear as dashed outlines with type guesses (text, date, checkbox, signature); tap toggles, drag adjusts, Accept all commits through `forms/create`. My info lives in Settings → My info (on this device, never exported unless placed); in a field, the @ inserter (E25) or a "Fill from My info" chip offers matching values; TCKN and IBAN reuse `redaction/patterns.ts` validators.
- **Acceptance.** ≥ 85 % of blanks proposed with ≤ 10 % false fields on a 30-form EN/TR fixture set; created fields are valid AcroForm widgets that fill in Acrobat and Preview; My info stored with try/catch, wiped by Forget; nothing is filled without a tap.
- **Effort** M + M. **Depends** S3's ruled-line and box detector (Wave 3), `forms/create`. **Risks** wrong field types (review mode, honest "suggested" label).

---

## 5. Excellence improvements (34)

Compact format: **What / Why / Inspired by / Accept / Effort · Deps · Risks**.

### E1 · One size system and detents
- **What.** Re-derive the control scale per size class and modality (bar 44 coarse / 36 fine, icon 20/18, radius concentric from the outer piece); apply to strip pieces, Save pill, privacy/⋯ piece, palette rows, Library launcher, ink strip. Add a shared **detent** token (1-frame 1.04 knob pulse, optional 20 ms tick sound off by default) and concentric corners when `safe-area-inset-bottom > 0`.
- **Why.** The owner's main iPad complaint; Q-9 exists but is not enforced across pieces.
- **Inspired by.** Liquid Glass concentricity, HIG detents.
- **Accept.** A Q-9 walker asserts one height, radius and icon size per bar; side-by-side screenshots at 1440×900, 1180×820, 1366×1024, 820×1180; no overflow at 400 % zoom.
- **Effort** M (tokens in W0.0, application per lane in W0.1). **Risks** churn; diff against R11 branches first.

### E2 · Ink strip, one tier, done right
- **What.** One row: presets (up to 6, colour always visible), active swatches without repeats from the palette, width slider with the knob bug fixed (knob tracks the pointer, lens shows the value). The colour panel holds everything else, including "From this page" colours (I66).
- **Why.** "Empty and ugly", repeated swatches.
- **Inspired by.** Noteshelf toolbar, GoodNotes backlash (never hide colours), Material 3 neighbour squish, Procreate Harmony.
- **UX.** Press widens a swatch 6 % while neighbours give way; selected well morphs circle → squircle; long-press a preset for Duplicate · Delete · Edit; drag to reorder. (Swipe-to-restyle is dropped: it fights the slider and preset drag; E20 Copy style covers it.)
- **Accept.** No colour twice on screen; strip height = capsule bar height; readable in grayscale and forced colours; slider-math unit tests; presets migrate in place.
- **Effort** M · E1.

### E3 · Motion that shows what changed
- **What.** Stateful glyphs (Undo spins back a quarter turn, Save draws a check, Lock shackle drops, nib/highlighter/eraser animate once when chosen); odometer page number with a progress rim; undo naming HUD with a reveal flash at the changed spot. **Two-finger hold to rewind** (250 → 80 ms per step, slide sideways into the History scrubber) follows in Wave 2 after the gesture table.
- **Inspired by.** Rive icons (rebuilt as SVG + WAAPI), Family digit roll, Procreate rapid undo, iOS numeric transitions.
- **Accept.** One glyph animates at a time, 180–300 ms, zero frames at rest; reduced motion swaps instantly; glyphs in `motion/catalogue.ts`, built at compile time; rewind never passes the snapshot tail.
- **Effort** M (glyphs, odometer, HUD) + S (rewind) · E1.

### E4 · Minimised capsule (replaces hide-on-scroll)
- **What.** One chrome state machine instead of two plus a third: sustained downward scroll shrinks the capsule into a small glass pill showing the mode glyph, and the page pill slides into its row as an accessory; scroll up, hover the bottom edge or any key restores. It **replaces** `shell/frame/hide-on-scroll.ts`. The Focus side lives in S5's puck on `F`.
- **Inspired by.** iOS 26 `tabBarMinimizeBehavior` and bottom accessory.
- **Accept.** State chart specced first; free rect unchanged during minimise; zero layouts; all hide-on-scroll tests ported; "Keep tools visible" setting. The four-finger tap is a prototype, not a commitment.
- **Effort** M · E1 · Risk M (regressions in the replaced reducer).

### E5 · Pinch-scrubbed page ↔ grid
- **What.** On touch and trackpad a pinch scrubs the page-to-cell morph continuously, committing or springing back by progress and velocity; keys and buttons keep the 240 ms View Transition.
- **Inspired by.** iOS Photos, Liquid Glass gesture-driven transitions.
- **Accept.** 60 fps on iPad, zero layouts mid-gesture (target rect from grid maths); same end state as the View Transition path.
- **Effort** L · E6 · Risk M (WAAPI `currentTime` FLIP, Safari gesture events).

### E6 · Pages grid at Photos/Keynote quality
- **What.** Selected cells lift 4 px with a lime rim glow and a badge fixed to the cell; section headers and tags redesigned; drag ghosts stack with a count; spring-loaded drop targets; range brackets on the scrubber (Shift+←/→) let Pages-bar verbs act on "14–22" without opening the grid. **Review pages** is a single-page pass (← / →, X reject, P keep, "Delete 7 rejected" as one undo step) instead of a swipe in the grid.
- **Why.** Owner notes: buggy badge, crude headers, "better selection".
- **Inspired by.** iPadOS selection, Keynote light table, Darkroom and Lightroom flag/reject, LumaFusion navigator.
- **Accept.** Badge never detaches under virtualisation (test); selection readable in forced colours; pass keys scoped in `SHARED_KEYS`.
- **Effort** M (selection + headers in W0.1; drag, brackets, pass in W2). Dropped: lift-to-placeholder (I27) and scroll-linked edge depth.

### E7 · Edit the outline, move the pages
- **What.** "Arrange by contents" in the Outline: dragging a bookmark moves its page range; deleting a bookmark offers "Delete these 6 pages"; multi-select + Extract.
- **Inspired by.** Premiere text-based editing.
- **Accept.** One commit = one undo step; labels and links remapped; nested ranges correct; ⌥↑/↓ moves a section; out-of-order outlines disable the mode with an honest note.
- **Effort** M · `stage/arrange-actions.ts`, `outline/*`.

### E8 · A Library that feels alive
- **What (phase 1, W0.1).** One brand mark (strip keeps the R; the header becomes a calm greeting); compact launcher (Open + ⋯ for Combine and Batch; the whole background is the drop zone); 4:5 card frames with letterboxed thumbnails; a richer, slower aurora behind the glass; the privacy popover fits the iPad viewport.
- **What (phase 2, W4).** Progress arc per card; exact resume (page, zoom, offset); "4 pages left in Methods" on the pill; draft dot (kept on device, not yet in the file); provenance glyphs (Redacted · Signed · OCR'd · Pages changed · Filled).
- **Inspired by.** Books/Kindle resume, Threads draft glyph, C2PA honesty, Photos grids.
- **Accept.** Grid alignment for portrait, landscape and mixed fixtures; aurora ≤ 4 KB gz, ≤ 0.5 ms/frame, paused at rest; resume ±2 px.
- **Effort** M + M (was S).

### E9a · Document triage card
- **What.** At open (and on hover in the Library): "2 signature fields · 14 fields (9 required) · pages 4–7 scanned (OCR?) · looks like a flat form". Each line is a button. Grows out of `document/DocumentFacts.tsx`.
- **Inspired by.** Acrobat suggested questions.
- **Accept.** Deterministic facts < 200 ms after first render; one card per open; respects the chip rule.
- **Effort** M.

### E9b · Library search, smart collections, duplicates
- **What.** A local full-text index (text layer + OCR) with page-thumbnail results that open with Find pre-filled; smart collections (Signed · Has forms to fill · Scanned without text · Edited this week · Large); duplicates by hash or page fingerprint.
- **Inspired by.** Bear, Apple Photos Utilities.
- **Accept.** Builds at idle, cancellable; Turkish case folding (İ/ı); index < 5 % of file size, dropped with Recents.
- **Effort** L · E8.

### E10 · ⌘K that knows context and takes arguments
- **What.** Scope chip with a selection ("Highlight · p.4 ×"); arguments and ranges ("rotate 3-7 right", "çift sayfaları sil", "zoom 150", "go to Methods"); intent synonyms ("make smaller", "küçült" → Compress with "est. 4.2 → 1.1 MB"); pinned rows and Batch recipes as commands; typing in the title menu searches commands. Phase 3: plain-language plans compile into a Batch plan card shown before Run (I22).
- **Inspired by.** Raycast Action Panel, Linear, Photoshop Actions search, Obsidian pins, iPadOS 26 menu search.
- **Accept.** Parser tests over a ≥ 200-query EN/TR corpus **reviewed by the owner**; nothing runs without showing the resolved pages; on touch the page context menu gets "Search actions…" (no long-press path).
- **Effort** M (phase 3 L).

### E11 · Page themes (including scans)
- **What.** Per-document Appearance: Original · Paper · Sepia · Night · Custom. Vector content is recoloured in the worker with `FPDF_RenderPageBitmapWithColorScheme_Start`; image regions get a worker pass that only darkens photos; highlights and ink blend after the map.
- **Why.** A glaring white page in dark chrome is the biggest reading-comfort gap.
- **Inspired by.** Zotero 8 Appearance, Books themes, PDF Expert Night.
- **Rule amendment.** Night amends "the page is the brightest thing" explicitly (ADR amendment): in Night, the page stays the largest, least-tinted surface and the chrome dims one step so the page still leads.
- **Accept.** Body text ≥ 4.5:1 in Night; < 2 ms per tile; export untouched; off by default; a "Theme on" glyph in the pill.
- **Effort** M.

### E12 · Forms that pull you to the finish
- **What.** A ring on the pill ("7 of 12 required"); Tab/Return to the next empty field, page flies there, `enterkeyhint=next`; required fields pulse once if you try to leave; finish = success bloom, "Ready to sign" with Sign, dock "All 9 filled · Save a copy"; signing order and "next required" tags (DocuSign). Signature **ink-in**: a saved signature writes itself along its stroke order (~450 ms) and dries with one specular sweep.
- **Inspired by.** Duolingo progress (without streaks), Things, Ulysses goals, Family, DocuSign.
- **Accept.** Ring correct through undo; reduced motion shows text; nothing at rest; "required by the form" labelled honestly.
- **Effort** M · E3.

### E13 · Receipts on Save (was hold-to-apply)
- **What.** Apply redactions and Remove pages can be undone while the document is open (`redaction/ApplySheet.tsx:17`), so they get **no** held confirmation. The step that cannot be undone is Save/Export, so that is where the proof goes: after an Apply, the Save / Save a copy result reads "3 areas removed · searched the saved file: 0 matches remain"; every save says "Saved on this device".
- **Inspired by.** Safari Privacy Report.
- **Accept.** The receipt search runs PDFium over the output bytes; announced to screen readers.
- **Effort** S · lives in `export/*`.

### E14 · Sheets that grow, buttons that report
- **What.** Save a copy, Compress, OCR and Batch spring their height per step; the primary button keeps its place while its label morphs "Compress → Compressing 42 % → Saved 3.1 MB"; long jobs breathe the aurora with an honest line ("page 7 of 40 · on this device, 4 cores"); element-scoped View Transitions for list reorders where supported.
- **Inspired by.** Family trays, Headspace breath, Writing Tools scan (it must end).
- **Accept.** Transform-only (Q-7); determinate progress with cancel; reduced motion static.
- **Effort** M · E3.

### E15 · Tip engine and shortcut coaching
- **What.** **Minimal engine in W0.0** (TipKit-style rules: events, frequency caps, invalidation once done; first-use naming tips) so every signature ships with its teaching. **W5 adds** coaching ("Next time: H" after the third pointer use), the `?` overlay lighting used shortcuts and "Next to learn", and a one-time What's new card.
- **Inspired by.** Apple TipKit, Superhuman, Linear, Duolingo skill tree.
- **Accept.** ≤ 1 tip per session and per day; never during ink; obeys the chip rule; state in localStorage with try/catch; EN/TR copy; Settings Tips On · Off · Reset.
- **Effort** S + M.

### E16 · Teaching where the finger is
- **What.** The sample ticks itself (each instruction ring fills with a lime check, "3 of 6", "You know the basics"); errors at the fingertip (highlighting a scan offers region OCR so the highlight lands, editing a signed file says why at the pointer, typing on a flat form offers Make fillable or a text box); empty states from the document (Find suggests the file's frequent words; empty Outline offers "Make contents from headings").
- **Inspired by.** Notion Getting Started, Duolingo, HIG.
- **Accept.** Rings are an overlay; each hint once per file per act; region OCR < 3 s per paragraph; matched by sample id, not hash.
- **Effort** M · E15.

### E17 · Proof, not promise
- **What.** In the privacy popover, **"How to test: turn on Airplane Mode"** plus the `offline` event (the shield breathes once: "Everything still works"); a ledger worded like the shield: "Requests made by Recto: none observed · 37 files processed"; Settings → On-device intelligence lists each capability's source (heuristic · browser-provided · Recto model), size and storage, with a note that browser-provided models are downloaded by the browser itself.
- **Accept.** Uses the cross-origin Resource Timing the shield already measures; never claims "0 bytes sent"; ledger in IndexedDB with try/catch.
- **Effort** M (popover fit fix lands in W0.1).

### E18 · Ink comfort pack
- **What.** "Steady" smoothing per preset (one shared filter for preview and commit) and a tremor filter; eraser filter (All · Ink · Highlights · Shapes) and "Return to pen after erasing"; spring-loaded tools (hold a tool's key); two-tool swap (press the active tool's key); pen check sheet (grown from the W0.0 capture page); delegated ink trail on Chromium; hover ghosts where hover exists; ink timestamps recorded for B7.
- **Inspired by.** Procreate StreamLine, GoodNotes eraser, Notability, Logic two-slot memory, Chromium Ink API.
- **Accept.** No jump on commit; latency budget holds; hover feature-detected.
- **Effort** M (was S) · E2.

### E19 · Study and present pack
- **What.** Tape (patterned cover strips that peel; Cover all / Show all); Recall (blur highlights, "7 of 23 recalled"); Laser (lime dot with fading trail, allowed on locked files, never written); Nib pen.
- **Inspired by.** GoodNotes/Notability tape, MarginNote Recall, CollaNote, Apple reed pen.
- **Accept.** Tape exports as Square annotations or is stripped by Save a copy; Recall and Laser never touch the file; nib maths unit-tested; all under More tools.
- **Effort** M.

### E20 · Style and selection tools for marks
- **What.** Copy/Paste style (selection bar, ⌘K); Select similar; Recolour by drop (this mark → similar on page → document); colour meanings (Key, Question, Disagree) stored in `/Subj`; Isolate and roles (dim others, eye per role, "Clean copy without my private notes").
- **Inspired by.** VSCO Copy Edit, Figma Select matching, Procreate ColorDrop, Highlights, Sketch focus, FCP roles.
- **Accept.** One undo step each; meanings survive via `/Subj`; **each meaning also has a shape or pattern cue** for colour-blind users; private data cleared on clean copy.
- **Effort** M · E2.

### E21 · Notes out
- **What.** Copy as Markdown / Save notes… from Review: highlights grouped under outline headings with page, text, comment, meaning and a `file.pdf#page=N` link; optional `name.notes.md` sidecar rewritten on Save (Chromium), a download elsewhere.
- **Inspired by.** Highlights, PDF Expert summary, Skim.
- **Accept.** EN/TR headings; stable order; Turkish round trip.
- **Effort** S.

### E22 · Native extras where the platform allows (descoped)
- **What.** On Chromium desktop installs: `file_handlers` + `launch_handler` with a `launchQueue` consumer (first ⌘S saves in place); "Changed on disk" (FileSystemObserver, `lastModified` fallback) with Reload · Keep mine · Compare; Window Controls Overlay; manifest shortcuts to `?cmd=`. Everywhere it works: Wake Lock in Present and long fills. The app badge is Chromium-desktop only; **no notification permission prompt anywhere**.
- **Accept.** Each feature detected and hidden elsewhere; CSP unchanged; free rect includes `env(titlebar-area-*)`.
- **Effort** M · V3/N3 for an iPad-first product.

### E23 · Reading comfort
- **What.** Reading ruler (dims the rest 20 %); reading focus with typewriter stepping; ⌥↓ focuses a paragraph then H/U/S/C act on it; bookmark ribbons from the pill menu; phase 2 Listen with **on-device voices only** (`localService === true`) and word tracking.
- **Inspired by.** Skim reading bar, iA Focus, Readwise Reader, Books.
- **Accept.** Nothing at rest; Listen hidden without a local voice; multi-column falls back to lines.
- **Effort** M.

### E24 · Scan tools
- **What.** Straighten dial (−15°…+15°, 0.1° steps, detent at 0, Auto from baselines); Scan Looks (Paper · Ink only · Photocopy · Mono · Warm archive, Amount slider); cleanup brush for stains and punch holes; Before chip from S2.
- **Inspired by.** Photos straighten, Lightroom presets, Halide Looks, Photoshop Remove (counter-example: keep the original).
- **Accept.** OCR layer preserved; original kept for undo; "Replaces the page image"; JPEG quality control.
- **Effort** L.

### E25 · Make room and smart text
- **What.** Drag a page edge out in Markup to add margin (25 % / 50 % detents); @ inserter in text boxes and fields (Today, initials, My info, page-ref link, ✓ ✗); `;date` snippets and EN/TR natural-language dates formatted to the AFDate mask.
- **Inspired by.** Apple Notes add space, Google Docs @, Raycast snippets, Things dates.
- **Accept.** Make room = one undo step; EN/TR date parser tests; unknown masks fall back to plain text.
- **Effort** M.

### E26 · Pages leave the window
- **What.** Drag thumbnails beyond the window for a subset PDF ("Report – p3-5.pdf") via DownloadURL on Chromium; long-press → Share elsewhere. Phase 2: Lift from page (hold an image or signature, trace, drag it to a tab, the stamp tray or out as PNG).
- **Inspired by.** Gmail/Box drag-out, Photos lift subject.
- **Accept.** Blob ready at dragstart; nothing uploaded; lift non-destructive.
- **Effort** M (+L).

### E27 · Accessibility, stated and sized
- **What.** Settings → Accessibility shows Recto's own label (screen reader, keyboard only, larger text, contrast, reduced motion) with live status; chrome text size 85–200 % as a multiplier on type tokens.
- **Inspired by.** App Store Accessibility Nutrition Labels, Dynamic Type.
- **Accept.** A-gates pass at 200 %; size classes fall back gracefully on 1180×820.
- **Effort** M · E1.

### E28 · Paper: templates and note columns (new)
- **What.** Insert lined, grid, dot or Cornell pages; "Add a notes column to all pages" for lecture slides (a batch Make room).
- **Inspired by.** GoodNotes, Notability.
- **Accept.** Builds on `insertBlankAfter` (`stage/arrange-actions.ts`); templates are vector, < 2 KB each; one undo step.
- **Effort** S · P 17.5.

### E29 · Performance mode (new)
- **What.** Half-page turns (the lower half shows the next page early); edge taps turn pages; Bluetooth pedals and keys (they arrive as keystrokes and work in Safari); setlists made of Library items; Wake Lock.
- **Inspired by.** forScore.
- **Accept.** Pedal keys configurable; no chrome while performing; Esc leaves.
- **Effort** M · P 17.5.

### E30 · Remove hidden information, with a receipt (new)
- **What.** One sheet strips metadata, JavaScript, attachments, hidden optional-content layers, comments (optional) and earlier incremental revisions; it lists what it found and proves the result by re-parsing the output. Phase 2: exhibit stamps and legal page labels in furniture.
- **Inspired by.** Acrobat Sanitize; Bluebeam/legal exhibit tools.
- **Accept.** Re-parse finds none of the removed classes; the report is exportable; nothing removed without the list shown first.
- **Effort** M · P 16.5.

### E31 · Markup out and in (XFDF) (new)
- **What.** Export only the marks as a few KB to send to a colleague; import theirs as a separate role (E20) to accept or reject. Collaboration with no cloud; a cheap precursor to B6.
- **Accept.** Round-trips with Acrobat's XFDF; imported marks are one undo step; conflicts shown, never merged silently.
- **Effort** M · P 16.5.

### E32 · Calibrated measure (new)
- **What.** Set the scale from one known dimension; distance, area and perimeter written as PDF Measure annotations; extends S3's measure.
- **Inspired by.** Bluebeam.
- **Accept.** Scale stored per page in the PDF's viewport dictionary; values match Acrobat on a fixture.
- **Effort** M · P 15.0.

### E33 · Quick Look and folders in the Library (new)
- **What.** Space (when no field has focus) or long-press shows a large preview with scrub without opening; manual folders, tags and sort alongside E9b's smart collections.
- **Inspired by.** Finder Quick Look, the Files app.
- **Accept.** Preview < 300 ms from thumbnails cache; folders are local metadata; keyboard and VoiceOver paths.
- **Effort** M · P 16.5.

### E34 · Accessibility checker (new)
- **What.** A local check of tags, reading order, alt text, language tag (TR/EN) and contrast; manual alt text and heading editing; an honest report. The human-driven half of the alt-text idea parked under D-1.
- **Inspired by.** Acrobat Accessibility Check, PDF/UA.
- **Accept.** Results match a PAC-style reference on fixtures; edits write StructTree entries; the report states what was not checked.
- **Effort** L · P 16.0.

---

## 6. Bets (after the owner reviews Wave 3)

| ID | Bet | Why wait |
|---|---|---|
| B1 | Text view (local reflow) | XL; pair with M10, where it is the phone edition's core |
| B2 | Compose in Compare (swipe-comping) | Page pairing must be solid first |
| B3 | Branching time strip | Risky history-model change |
| B4 | Audio-synced markup | Microphone UX, embedded-file size |
| B5 | Meaning search with cited passages | **D-1**: needs a model dependency; if approved, one ~25 MB embedder from Recto's origin, opt-in, listed in E17 |
| B6 | Merge markups via sidecar op log | XL; E31 first |
| B7 | Replay (ink, review as video) | Needs ink timestamps (recorded from E18) |
| B9 | Browser built-in translate / summarize | Single engine; the browser downloads its model from the network, and we say so |
| B10 | Watch-folder Inbox | Chromium-only, runs only while open |
| B11 | Tidy handwriting, Nudge | Niche |
| B12 | Auto Trace scanned signature | After signature UX settles |
| B13 | Document health lane, Tape view, minimap | After E6 |
| B14 | Threads (ink links) | After S1 |
| B15 | Excerpt Shelf | XL; overlaps Pins and Notes out |
| B16 | Alternates per page | Model change |
| B17 | Split read view, multi-window | iPad render memory |
| B18 | Ink to text / handwriting search | Weak without a model (D-1) |
| B19 | RTL in text boxes, Find and text edit | Belongs with M11 i18n |

**Lab L-1:** Liquid Glass union (capsule and pill merge/split) behind a flag, measured against Q-1, Q-3, Q-6.

---

## 7. Implementation waves

### 7.1 Lanes (file ownership)

A WP owns whole lanes for its wave. A WP may take several lanes when no other WP in the same wave needs them.

| Lane | Owns |
|---|---|
| **Frame** | `shell/frame/*` (strip, title menu, page pill, DockBand, focus-mode, hide-on-scroll) |
| **Capsule** | `shell/capsule/*`, `motion/capsule-*` |
| **Markup** | `markup/*`, `annotations/pen/*`, `annotations/lasso/*`, `ui/colour/*` |
| **Annotations** | `annotations/*` outside pen and lasso (store, layers, geometry, page-text, tools) |
| **Grid** | `stage/grid/*`, `stage/Arrange*`, `stage/arrange-*`, `stage/PageCell.tsx`, `pages-sheets/*`, `outline/*`, `crop/*`, `furniture/*` |
| **Viewer** | `viewer/*`, `stage/ReadView*`, `stage/page-overlays.tsx`, `stage/PageScrubber*`, `engine/*` render paths |
| **Sidebar** | `shell/sidebar/*`, `shell/review/*`, `shell/OutlinePanel*` |
| **Library** | `home/*`, `session/library-store*` |
| **Session** | `session/*`, `history/*` |
| **Forms** | `forms/*`, `signatures/*` |
| **Trust** | `export/*`, `batch/*`, `redaction/*`, `privacy/*`, `document/*` |
| **OCR / Compare** | `ocr/*`, `compare/*` |
| **Gesture** | `motion/gesture/*`, `viewer/zoom-controller.ts` gesture hooks, `dnd/pointer-drag.ts` |
| **Platform** | `commands/*` (registry code, not entries), `settings/*`, `pwa/*`, `sample/*`, onboarding/tips, `state/*` new stores |

**Shared hot files** (`commands/keymap.ts`, the command registry entries, `messages/en.json` and `tr.json`, `styles/tokens.css`, `styles/materials.css`, `motion/catalogue.ts`): each WP **appends** only and lists its additions in its PR; the wave integrator merges in WP order and runs `pnpm --filter @pdf-editor/web i18n` once. Token renames happen only in W0.0.

**Every WP delivers:** a spec section (§10 R12) or ADR; EN/TR strings; unit/browser tests and recogniser fixtures; screenshots at 1440×900 and 1180×820 touch; Q-bar walkers green; its lazy-load boundary and initial-JS delta; Conventional Commits (`ui`, `viewer`, `light-table`, `model`, `export`…).

### 7.2 Waves

Each wave ends with: screenshots and a short screen recording, the owner task script timed on the iPad, the bundle check, and a go/no-go.

---

#### W0.0 · Foundations (one WP, serial, short)

| | |
|---|---|
| **Owner area** | Platform + Gesture + shared tokens (integrator WP) |
| **Scope** | (1) Diff R11's pending branches (task #32: sizes, library, glass, select colour, motion, palette dedupe) and list what R11 leaves open. (2) E1 size and detent tokens + Q-9 walker. (3) Gesture table in the spec + arena tests for every existing recogniser. (4) Key map v2 PR (§3.1) + TR-Q layout tests; D-4/D-5 recorded. (5) Stroke-capture page (`?pen-check`, later E18's Pen check) exporting JSON fixtures. (6) Minimal tip engine (E15 core). (7) Transient-chip slot and walker. (8) Bundle-budget script and the owner task-script template. |
| **Acceptance** | Walkers (Q-9, chip, glass) run in CI; keymap test passes with EN-US and TR-Q layouts; capture page records pressure, tilt, timestamps on iPad Safari; no visible UI change except tokens. |
| **Files** | `styles/tokens.css`, `styles/tokens.test.ts`, `motion/tokens.ts`, `motion/gesture/arena.ts` (+tests), `commands/keymap.ts`, `commands/keymap.test.tsx`, `ui/TransientChip.tsx` (new), `onboarding/tips/*` (new), `sample/` capture route, `docs/specs/redesign.md` §10.0 |
| **Owner script** | Owner records 5 min of handwriting, shading, signatures, scratches and shapes on the iPad. |

#### W0.1 · Finish R11 and the owner's notes

| WP | Owner area | Scope | Acceptance | Files likely touched |
|---|---|---|---|---|
| **a** | Frame + Capsule | Apply E1 to strip pieces, Save pill (icon + label chip), privacy/⋯ piece (one control); dock ⇄ palette morph quality ("Animation!"); "glass feels thick because of light" tuning of rims and inner light; E3 glyphs, odometer pill, undo HUD | Q-9 walker green; morph zero layouts and pixel probes green; one glyph at a time; side-by-side screenshots at four sizes | `shell/frame/TopStrip*`, `SaveButton*`, `UndoRedo*`, `PagePill*`, `LockSwitch.tsx`, `shell/capsule/Capsule*`, `capsule-morph.ts`, `motion/catalogue.ts`, `styles/materials.css` (append) |
| **b** | Markup + Annotations | E2 one-tier strip, knob fix, presets, palette rows at E1 sizes, palette dedupe; **S2 phase 1** (hold B / title-menu eye hides annotation layers) | No duplicate colour on screen; slider-math tests; original swap < 50 ms, restores on `pointercancel` | `markup/InkStrip*`, `MarkupPalette*`, `StripPiece*`, `annotations/pen/PresetEditor*`, `presets.ts`, `annotations/layer-registry.ts`, `annotations/AnnotationLayer.tsx` |
| **c** | Library + Grid | E8 phase 1 (brand, launcher, 4:5 cards, aurora, popover fit); E6 selection lift/glow, fixed badge, section headers and tags | Mixed-aspect fixture grid aligned; badge survives virtualisation; aurora budget met | `home/*`, `privacy/PrivacyShield*` (fit only, by agreement), `stage/grid/GridPieces*`, `stage/ArrangeSection.tsx`, `stage/PageCell.tsx`, `flip-cells.tsx` |

**Owner script:** "Open the sample on the iPad; go Library → document → Markup → Pages → Library; note anything mismatched in size; hold B on the annotated page." Target: zero size notes.

#### W1 · Look before you leap

| WP | Owner area | Scope | Acceptance | Files likely touched |
|---|---|---|---|---|
| **a** | Viewer (nav) + Frame slot | S1 phase 1: link peek, back stack, Back chip, peek-scrub on the pill; first-use tips | §4 S1 acceptance; stack in snapshot; Z/Shift+Z | `viewer/LinkLayer*`, `viewer/navigation.ts`, `state/view-store.ts`, `viewer/PeekCard.tsx` (new), `shell/frame/PagePill.tsx` (slot), `session/snapshot.ts` (append field) |
| **b** | Viewer render + Trust + OCR + Grid sheets | S2 phase 2: original render for text edit/crop/redaction, Shift+B wipe; Before chips on Compress, OCR, Redact, Flatten, Crop, Resize | §4 S2 acceptance; Before chip component reused by all six sheets | `engine/bitmap-cache.ts`, `stage/ReadView.tsx`, `ui/BeforeChip.tsx` (new), `export/SaveCopySheet.tsx`, `ocr/OcrSheet.tsx`, `redaction/ApplySheet.tsx`, `crop/*`, `stage/ResizeDialog.tsx` |
| **c** | Markup (pen input) | S4 scratch and loop gestures (first commit); S3 QuickShape (second commit, after S4 merges) | 0 false scratches, ≥ 95 % recall, ≥ 95 % shape class, 0 handwriting conversions, on owner fixtures | `annotations/pen/ink-input.ts`, `straighten.ts`, `eraser.ts`, `annotations/lasso/*`, `annotations/pen/recognisers/*` (new), fixtures under `apps/web/test/fixtures/strokes/` |

**Owner script:** "In the sample paper, follow 'see Fig. 2' and come back without scrolling (< 3 s). Scratch out a word you wrote. Draw a box and hold." **Checkpoint:** first public demo clip.

#### W2 · Pages you can hold; nothing is lost

| WP | Owner area | Scope | Acceptance | Files likely touched |
|---|---|---|---|---|
| **a** | Grid + Sidebar | E6 rest (drag ghosts with counts, spring-loaded targets, scrubber range brackets, Review pages pass); E7 outline moves pages; E28 Paper | One undo step per act; pass keys scoped; outline remaps labels and links | `stage/grid/*`, `stage/arrange-actions.ts`, `stage/PageScrubber*` (by agreement), `outline/*`, `shell/OutlinePanel*`, `pages-sheets/*` |
| **b** | Capsule + Frame + Gesture | S7 source and sink (drop snaps plain until W3); E4 minimised capsule replacing hide-on-scroll; E3 two-finger rewind | §4 S7 acceptance; hide-on-scroll tests ported; rewind arena tests | `shell/capsule/*`, `capsule-morph.ts` (`trash` shape), `dnd/*`, `shell/frame/hide-on-scroll.ts`, `motion/gesture/*`, `history/HistoryScrubber*` (handoff, by agreement) |
| **c** | Session + Library | S8 Flashback (L) and pinned versions (M), Safari honesty copy | Capture ≤ 8 ms; redaction exclusion test; eviction message test | `session/snapshot.ts`, `retention.ts`, `writer.ts`, `session/flashback/*` (new), `history/actions.ts`, `home/FlashbackRow.tsx` (new), `settings/` Flashback row (append) |

**Owner script:** "Select pages 3–5 and drag them after page 8; delete page 2, close without saving, then bring both back from Flashback." **Decision gate:** D-2.

#### W3 · Ink that knows the page

| WP | Owner area | Scope | Acceptance | Files likely touched |
|---|---|---|---|---|
| **a** | Annotations (place/drag) + engine worker | S3 page-aware snapping and measure; ruled-line and box detector exported for S12 | §4 S3 acceptance; detector < 30 ms per page | `annotations/geometry.ts`, `annotations/snap/*` (new), `annotations/page-text.ts`, worker `detect-rules` module, `annotations/AnnotationLayer.tsx` |
| **b** | Markup (input/ring) + Frame | S5 tip ring (still-press off by default) and the one puck (modifier + Focus on F) | §4 S5 acceptance; focus-mode tests ported | `markup/ring/*` (new), `state/modifiers.ts` (new), `shell/frame/focus-mode.ts`, modifier read sites from the audit list |
| **c** | Viewer | E11 page themes (PDFium colour scheme); S10 Pins (+ Chromium Float) | §5 E11 and §4 S10 acceptance; Night ADR amendment merged | `engine/*` render options, `viewer/page-pixels.ts`, `stage/ReadView.tsx`, `viewer/pins/*` (new), `shell/frame/PagePillMenu.tsx` (append row) |

**Owner script:** "Sign the contract on p. 4 on its line without zooming (< 10 s). Draw an arrow with the puck held." **Checkpoint: portfolio cut** — a 60-second iPad reel of S1, S2, S3, S4, S5, S7, S8. Owner chooses bets for W10+.

#### W4 · Forms and trust

| WP | Owner area | Scope | Acceptance | Files likely touched |
|---|---|---|---|---|
| **a** | Forms | S12 Make fillable + My info; E12 form progress, next-required, signature ink-in | 30-form fixture targets; ring correct through undo | `forms/create/*`, `forms/navigation.ts`, `forms/FormLayer.tsx`, `forms/my-info/*` (new), `signatures/SignaturePlate*`, `settings/` My info section (append) |
| **b** | Trust | E13 receipts on Save; E30 Remove hidden information; E14 growing sheets and reporting buttons | Receipt search over output bytes; sanitize re-parse test; transform-only sheets | `export/*`, `redaction/apply.ts`, `redaction/report-text.ts`, `document/*`, `batch/*`, `ocr/OcrSheet.tsx` (button only, by agreement) |
| **c** | Library + Frame title | E8 phase 2 (resume, progress arc, provenance glyphs, draft dot); E9a triage card | Resume ±2 px; triage facts < 200 ms | `home/LibraryCard*`, `session/library-store*`, `document/DocumentFacts*` (by agreement with b), `shell/frame/TitleMenu*` |

**Owner script:** "Open the flat-form fixture, Make fillable, fill it from My info and sign (< 60 s). Save a copy after redacting and read the receipt."

#### W5 · Guided and powerful

| WP | Owner area | Scope | Acceptance | Files likely touched |
|---|---|---|---|---|
| **a** | Platform (onboarding) | E15 coaching, `?` overlay learning, What's new; E16 sample ticks, fingertip errors, document-built empty states | Tip caps; region OCR < 3 s | `onboarding/*`, `shell/ShortcutOverlay*`, `sample/*`, `shell/sidebar/FindSection.tsx` (empty state) |
| **b** | Platform (commands) | E10 contextual ⌘K, arguments, synonyms, pins, recipes; "Search actions…" in the page menu | ≥ 200-query EN/TR corpus reviewed by owner | `shell/CommandPalette*`, `commands/*`, `commands/parse/*` (new), `stage/PageContextMenu.tsx` (append row) |
| **c** | Sidebar/Review + Annotations | E20 style tools, meanings with shape cues, roles; E21 Notes out; E31 XFDF out/in | `/Subj` round trip; XFDF round trip with Acrobat | `shell/review/*`, `annotations/actions.ts`, `annotations/selection-markup.ts`, `export/notes-md.ts` (new), `annotations/xfdf/*` (new) |

**Owner script:** "Type 'çift sayfaları sil' in ⌘K and confirm the pages shown; export your highlights as Markdown."

#### W6 · Study and reading

| WP | Owner area | Scope | Acceptance | Files likely touched |
|---|---|---|---|---|
| **a** | Viewer | S9 Fold and Fold to marks (behind a flag until the reader's suites pass) | §4 S9 acceptance | `stage/ReadView.tsx`, `viewer/read-controller.ts`, `viewer/fold/*` (new), `stage/PageScrubber*` |
| **b** | Markup | S6 writing loupe; E19 study pack | §4 S6 acceptance; Tape export rules | `markup/loupe/*` (new), `annotations/pen/ink-input.ts` (mapping), `markup/MoreTools.tsx`, `annotations/pen/presets.ts` |
| **c** | Library | E9b search, smart collections, duplicates; E33 Quick Look and folders | TR case folding; index < 5 %; preview < 300 ms | `home/*`, `home/search/*` (new), `session/library-store*` |

#### W7 · Native, repeatable, accessible

| WP | Owner area | Scope | Files likely touched |
|---|---|---|---|
| **a** | Platform + Trust (privacy) | E22 descoped native extras; E17 proof of privacy; E27 accessibility label and text size | `pwa/*`, `vite` manifest config, `privacy/*`, `settings/*`, `styles/tokens.css` (multiplier, append) |
| **b** | Markup + Annotations | S11 linked Repeat; E18 ink comfort | `annotations/annotation-store.ts`, `annotations/repeat/*` (new), `annotations/pen/ink-preview.ts`, `dry-ink.ts`, `presets.ts` |
| **c** | Grid | E5 pinch-scrubbed grid; E26 drag a page out | `stage/grid/grid-transition.ts`, `pinch-in-grid.tsx`, `stage/grid/grid-pointer-drag.ts`, `dnd/*` |

Acceptance per §5 entries. **Owner script:** "Initial every page of the 12-page contract fixture with one Repeat, then move one copy."

#### W8 · Finish the excellence list (1)

| WP | Owner area | Scope | Files likely touched |
|---|---|---|---|
| **a** | Viewer | E23 reading comfort (+ Listen); E29 Performance mode | `viewer/*`, `stage/ReadView.tsx`, `viewer/perform/*` (new) |
| **b** | Grid + OCR | E24 scan tools | `pages-sheets/*`, `crop/*`, `ocr/*`, worker image passes |
| **c** | Platform (a11y) + document | E34 accessibility checker | `document/a11y/*` (new), `shell/review/*` (report), engine StructTree access |

#### W9 · Finish the excellence list (2)

| WP | Owner area | Scope | Files likely touched |
|---|---|---|---|
| **a** | Annotations + Forms | E25 make room, @ inserter, smart dates | `stage/ResizeDialog.tsx`, `annotations/InlineEditors.tsx`, `forms/FieldEditors.tsx`, `text/dates/*` (new) |
| **b** | Annotations (measure) | E32 calibrated measure | `annotations/snap/measure*`, `annotations/tools.ts` |
| **c** | Viewer + Sidebar | S2 phase 3 Changes lens; S1 citations and skim | `viewer/*`, `text-edit/*` (run rects, read only), `compare/*` (reuse) |

#### W10+ · Bets chosen by the owner after the W3 portfolio cut.

**Why this order.** W0 fixes what the owner sees every day and lays the tokens, gesture table and key map every later WP relies on, with one wow (S2 phase 1). W1 ships the three moves that most visibly separate Recto (Peek, Original, scratch and QuickShape), all on disjoint files. W2 makes pages and the capsule physical and adds the safety net that makes bold features feel safe. Snapping (W3) comes after QuickShape and drag-to-create exist, so its drop targets are known; S12 follows in W4 because it reuses W3's detector. New user-group work (E28, S12, E30) lands in W2–W4, ahead of S9, S6 and S11.

---

## 8. Owner decisions

| ID | Decision | Recommendation |
|---|---|---|
| **D-1** | Allow any on-device model dependency (B5, B18, alt text)? | Not now. Revisit after W3 with one opt-in embedder served from Recto's origin. |
| **D-2** | Flashback on by default? | On in installed apps (persistent storage), on with a visible notice in Safari tabs; redaction "befores" never without opt-in. |
| **D-3** | Pen gestures on by default; tip-ring still-press on by default? | Gestures on (with first-use tip); still-press ring **off** (barrel, right-drag and W stay on). |
| **D-4** | Accept key map v2 (§3.1)? | Yes, as one PR in W0.0. |
| **D-5** | Turkish-keyboard twins for symbol keys? | Yes: no feature may depend on `\`, `[`, `]` or AltGr chords; every symbol key has a letter or on-screen twin. |

---

## 9. What we deliberately do not do

**Already in Recto:** hold-to-straighten, two/three-finger undo/redo, lasso transform/split, eyedropper loupe, colour panel, Focus mode (it becomes the puck), history scrubber with preview, ⌘K recents, `?` overlay, Batch recipes, pen hover cursor, save in place, Web Share, View Transitions, page scrubber, Space-to-pan.

**Breaks a principle:**
- Cloud anything: chat summaries, network TTS voices, cloud OCR, accounts, telemetry.
- New dependencies: Rive (rebuilt as SVG + WAAPI), transformers.js (parked as D-1).
- Confirmations on undoable acts (no hold-to-apply on Apply redactions or Remove pages).
- Permission prompts for delight (no notification permission to get a badge).
- Claims the browser cannot prove ("0 bytes sent", a button that "turns off the network").
- Selling Chromium-only features as core (Float, file handlers, WCO, DownloadURL, watch folders).

**Collides with the calm rules:**
- A two-finger trigger for see-original; Space-to-peek; ⌘[ ⌘] for back; Q/I/O/E/L/X/G re-bindings; G-sequences; Shift+H; ⌥⌘C/V.
- Long-press on a target opening ⌘K (the context menu already is that list).
- A tip ring that opens on every still pen by default.
- A second Focus puck, a third chrome state machine.
- Triage swipes inside the grid; swipe-to-restyle on the ink strip.

**Low value or high risk:** lift-to-placeholder (I27), scroll-linked grid edge depth, Fine-tune dial (I61), iPhone `<input switch>` haptic hack, BarcodeDetector QR hotspots, handwriting spellcheck, iA Style Check, learned reordering of selection bars, stem-splitter layers, J/K/L reading shuttle, WebGPU compositor (measure first), glass neck morphs (lab only), Year in Recto, protocol handlers (optional inside E22 at most), a pinch-to-fold trigger in Fold's first version.

---

## Appendix A · Scored catalogue (sorted by P)

V value, N novelty, F fit, Eff effort, R risk, P priority.

| ID | Initiative | Sources (track: apps) | V | N | F | Eff | R | P | Ref |
|---|---|---|---|---|---|---|---|---|---|
| I01 | Peek & Return | reading: Zotero, Skim, Acrobat, Kindle · writing: Linear, Arc, Notion, Obsidian · motion: Arc · pro-draw: Procreate Dreams · video: FCP | 5 | 5 | 5 | M | L | 21.5 | S1 |
| I02 | Hold to see original, wipe, Before chips | photo: Lightroom, Photos · onboarding: Snapseed, Figma · adobe: Writing Tools, Word | 5 | 4 | 5 | S | L | 21.0 | S2 |
| I23 | Grid selection quality + Review pages pass | photo: Darkroom, Photos · owner notes | 5 | 4 | 5 | M | L | 20.0 | E6 |
| I47 | Self-ticking sample, fingertip errors, document empty states | onboarding: Notion, Duolingo, HIG | 5 | 4 | 5 | M | L | 20.0 | E16 |
| I11 | Flashback + pinned versions | video: Logic, FCP · photo: Lightroom | 5 | 5 | 5 | L | M | 19.5 | S8 |
| I04 | Page-aware snapping + measure | pro-draw: Affinity, Figma · photo: Halide · writing: Things | 5 | 5 | 5 | L | M | 19.5 | S3 |
| I25 | Edit the outline, move the pages | video: Premiere | 4 | 5 | 5 | M | L | 19.5 | E7 |
| I34 | Document triage card | adobe: Acrobat | 4 | 5 | 5 | M | L | 19.5 | E9a |
| I48 | Proof of privacy (observed ledger, intelligence panel) | onboarding: Safari Privacy Report, Excalidraw | 4 | 5 | 5 | M | L | 19.5 | E17 |
| I68 | Make fillable + My info | critique: Acrobat Prepare Form, iOS AutoFill | 5 | 4 | 5 | M | M | 19.0 | S12 |
| I03 | Changes lens | writing: iA Writer | 4 | 5 | 5 | M | M | 18.5 | S2 ph. 3 |
| I10 | Capsule as source and sink | writing/motion: Things · photo: Instagram, Snapchat · writing: Notion | 4 | 5 | 5 | M | M | 18.5 | S7 |
| I49 | Form progress + calm completion | onboarding: Duolingo, Things · writing: Ulysses · motion: Family | 5 | 3 | 5 | M | L | 18.5 | E12 |
| I06 | Pen gestures | notes: GoodNotes, Nebo, Smart Script · adobe: OneNote · photo: Photos | 5 | 4 | 4 | M | M | 18.0 | S4 |
| I14 | Pins | pro-draw: Procreate · reading: Skim, LiquidText | 4 | 4 | 5 | M | L | 18.0 | S10 |
| I21 | Contextual ⌘K | writing: Raycast, Obsidian · motion: Linear · adobe: Photoshop | 4 | 4 | 5 | M | L | 18.0 | E10 |
| I44 | Markup style tools | photo: VSCO · pro-draw: Figma, Procreate, Sketch · reading: Highlights · video: FCP | 4 | 4 | 5 | M | L | 18.0 | E20 |
| I62 | Accessibility label + text size | onboarding: App Store labels, Dynamic Type | 4 | 4 | 5 | M | L | 18.0 | E27 |
| I16 | Linked Repeat | pro-draw + adobe: Illustrator | 4 | 5 | 5 | L | M | 17.5 | S11 |
| I17 | Page themes | reading: Zotero 8, Books, PDF Expert | 5 | 3 | 5 | M | M | 17.5 | E11 |
| I30 | Drag a page out | web-platform: Gmail, Box | 4 | 5 | 4 | M | M | 17.5 | E26 |
| I45 | Notes out | reading: Highlights, PDF Expert, Skim | 4 | 3 | 5 | S | L | 17.5 | E21 |
| I22 | Plain-language plan → Batch | adobe: Acrobat, Photoshop | 4 | 5 | 5 | L | M | 17.5 | E10 ph. 3 |
| I52 | Compose in Compare | video: Logic comping | 4 | 5 | 5 | L | M | 17.5 | B2 |
| I69 | Paper templates + note column | critique: GoodNotes, Notability | 4 | 3 | 5 | S | L | 17.5 | E28 |
| I70 | Performance mode | critique: forScore | 3 | 5 | 5 | M | L | 17.5 | E29 |
| I32 | Library layout, resume, glyphs | reading: Books, Kindle · photo: Threads, C2PA · owner notes | 5 | 2 | 5 | M | L | 17.0 | E8 |
| I08 | One puck (modifier + Focus) | pro-draw: Affinity, Fresco · adobe: Photoshop/Illustrator iPad · notes: Notability Focus | 4 | 4 | 4 | M | L | 17.0 | S5 |
| I26 | Range brackets on the scrubber | video: LumaFusion | 3 | 4 | 5 | S | L | 17.0 | E6 |
| I13 | Fold | reading: LiquidText | 4 | 5 | 5 | XL | M | 16.5 | S9 |
| I05 | QuickShape | notes: Apple Notes, Freeform, Notability · pro-draw: Procreate · adobe: OneNote | 4 | 3 | 5 | M | L | 16.5 | S3 |
| I09 | Writing loupe | notes: GoodNotes, Noteshelf | 4 | 5 | 4 | L | M | 16.5 | S6 |
| I39 | Motion-meaning pack | motion: Rive, Family, Things, iOS · onboarding: Procreate | 4 | 3 | 5 | M | L | 16.5 | E3, E14 |
| I42 | Ink comfort pack | pro-draw: Procreate · notes: GoodNotes, Notability · video: Logic | 4 | 3 | 5 | M | L | 16.5 | E18 |
| I46 | Tip engine and coaching | onboarding: TipKit, Superhuman, Linear, Duolingo | 4 | 3 | 5 | M | L | 16.5 | E15 |
| I54 | Meaning search | adobe: Acrobat AI Assistant | 5 | 5 | 3 | L | H | 16.5 | B5 (D-1) |
| I57 | Audio-synced markup | notes: Notability | 4 | 5 | 4 | L | M | 16.5 | B4 |
| I71 | Remove hidden information | critique: Acrobat Sanitize | 4 | 3 | 5 | M | L | 16.5 | E30 |
| I72 | Markup out/in (XFDF) | critique: Acrobat, Bluebeam | 4 | 3 | 5 | M | L | 16.5 | E31 |
| I74 | Quick Look + folders | critique: Finder, Files | 4 | 3 | 5 | M | L | 16.5 | E33 |
| I07 | Tip ring | notes: Pencil Pro, GoodNotes · pro-draw: Procreate, Concepts | 4 | 4 | 4 | M | M | 16.0 | S5 |
| I24 | Pinch-scrubbed grid | motion: iOS Photos | 4 | 4 | 5 | L | M | 16.0 | E5 |
| I33 | Library search, collections, duplicates | writing: Bear · photo: Photos | 4 | 4 | 5 | L | M | 16.0 | E9b |
| I75 | Accessibility checker | critique: Acrobat, PDF/UA | 4 | 4 | 5 | L | M | 16.0 | E34 |
| I40 | Minimised capsule | motion: iOS 26 tab bar | 4 | 3 | 5 | M | M | 15.5 | E4 |
| I20 | Reading ruler and focus | reading: Skim · writing: iA, Ulysses | 3 | 3 | 5 | S | L | 15.5 | E23 |
| I36 | Watch-folder Inbox | web-platform: Hazel | 3 | 5 | 4 | M | M | 15.5 | B10 |
| I53 | Merge markups via op log | web-platform: Automerge | 4 | 5 | 5 | XL | H | 15.5 | B6 |
| I58 | Replay | video: FCP Live Drawing | 3 | 5 | 4 | M | M | 15.5 | B7 |
| I63 | Tidy handwriting, Nudge | notes: Smart Script · pro-draw: Concepts, Fresco | 3 | 5 | 4 | M | M | 15.5 | B11 |
| I43 | Study pack | notes: GoodNotes, Notability, CollaNote · reading: MarginNote | 3 | 4 | 4 | M | L | 15.0 | E19 |
| I50 | Scan tools | photo: Photos, Lightroom, Halide · adobe: Photoshop | 4 | 4 | 4 | L | M | 15.0 | E24 |
| I51 | Make room, @, smart text | notes: Apple Notes · writing: Raycast, Things · adobe: Google Docs | 3 | 4 | 4 | M | L | 15.0 | E25 |
| I64 | Auto Trace signature | pro-draw: Linearity Curve | 3 | 4 | 4 | M | L | 15.0 | B12 |
| I67 | Document health lane | video: Resolve | 3 | 4 | 4 | M | L | 15.0 | B13 |
| I29 | Tape view | video: Resolve | 3 | 4 | 4 | M | L | 15.0 | B13 |
| I73 | Calibrated measure | critique: Bluebeam | 3 | 4 | 5 | M | M | 15.0 | E32 |
| I35 | Native extras (descoped) | web-platform | 3 | 3 | 5 | M | L | 14.5 | E22 |
| I31 | Lift from page | photo: Photos | 3 | 5 | 4 | L | M | 14.5 | E26 ph. 2 |
| I60 | Threads (ink links) | reading: LiquidText | 3 | 5 | 4 | L | M | 14.5 | B14 |
| I55 | Browser built-in AI | web-platform · adobe: Canva · writing: Dia | 3 | 4 | 4 | M | M | 14.0 | B9 |
| I59 | Excerpt Shelf | reading: LiquidText, MarginNote | 4 | 4 | 4 | XL | M | 14.0 | B15 |
| I66 | Colours from this page | pro-draw: Procreate, Linearity | 2 | 4 | 4 | S | L | 14.0 | E2 |
| I18 | Text view (reflow) | reading + adobe: Liquid Mode, PDF Expert, Books | 5 | 3 | 4 | XL | H | 13.5 | B1 |
| I28 | Alternates per page | video: FCP Auditions | 2 | 5 | 4 | M | M | 13.5 | B16 |
| I12 | Branching time strip | video: FCP | 3 | 4 | 4 | L | H | 12.0 | B3 |
| I37 | Multi-window | web-platform | 3 | 4 | 4 | L | H | 12.0 | B17 |
| I38 | Split read view | reading: PDF Expert · writing: Arc | 4 | 2 | 4 | L | M | 12.0 | B17 |
| I15 | Float page (Chromium only) | web-platform | 2 | 3 | 4 | M | L | 11.5 | S10 add-on |
| I56 | Ink to text | notes: Nebo · adobe: OneNote · web-platform | 4 | 3 | 3 | L | H | 11.5 | B18 |
| I19 | Listen (on-device voices) | reading: Acrobat, Books | 3 | 2 | 4 | M | M | 11.0 | E23 ph. 2 |

Dropped from the catalogue: I27 (lift to placeholder), I61 (fine-tune dial).

---

## Appendix B · Sources

Study files (all in this folder):

- Baseline: [`baseline.md`](baseline.md)
- Draft roadmap: [`roadmap-draft.md`](roadmap-draft.md)
- Research tracks:
  - Notes and ink (GoodNotes, Notability, Noteshelf, Apple Notes, Nebo, OneNote): [`research/notes-ink.md`](research/notes-ink.md)
  - Pro drawing and design (Procreate, Affinity, Figma, Illustrator, Fresco, Concepts, Linearity): [`research/pro-draw-design.md`](research/pro-draw-design.md)
  - PDF and reading (Zotero, Skim, LiquidText, PDF Expert, Books, Kindle, Readwise, MarginNote): [`research/pdf-reading-research.md`](research/pdf-reading-research.md)
  - Video and timelines (Final Cut, Logic, Premiere, LumaFusion, Resolve, Procreate Dreams): [`research/video-timeline.md`](research/video-timeline.md)
  - Writing and productivity (iA Writer, Ulysses, Bear, Things, Raycast, Linear, Notion, Obsidian, Arc, Superhuman): [`research/writing-productivity.md`](research/writing-productivity.md)
  - Photo and social (Lightroom, Photos, Darkroom, Halide, VSCO, Snapseed, Instagram, Snapchat, BeReal): [`research/photo-social.md`](research/photo-social.md)
  - Adobe pro and AI (Acrobat, Photoshop, Illustrator, Word, Canva, Writing Tools): [`research/adobe-pro-ai.md`](research/adobe-pro-ai.md)
  - Motion and interaction (Liquid Glass, iOS 26, Family, Rive, Material 3 Expressive): [`research/motion-interaction.md`](research/motion-interaction.md)
  - Web-platform firsts (Document PiP, file handlers, FileSystemObserver, built-in AI, Ink API): [`research/web-platform-firsts.md`](research/web-platform-firsts.md)
  - Onboarding and delight (TipKit, Duolingo, Notion, Safari Privacy Report, accessibility labels): [`research/onboarding-delight.md`](research/onboarding-delight.md)
- Critique of the draft (code-checked): incorporated throughout; its evidence lines cite `redaction/ApplySheet.tsx:17`, `redaction/apply.ts:35`, `shell/frame/focus-mode.ts:52`, `viewer/viewer-commands.ts:121`, `commands/keymap.ts:278`, `commands/app-commands.ts:573`, `annotations/tools.ts` (Q, I, O, L, G, E, X), `session/writer.test.ts:154`, `stage/arrange-actions.ts` (`insertBlankAfter`), `redaction/patterns.ts`.
- Repository references: `docs/VISION.md`, `docs/specs/redesign.md` §0–§9, `docs/design/redesign-2026-10/` (Q-1…Q-14), `CLAUDE.md`.
