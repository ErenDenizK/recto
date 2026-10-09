# Recto today: baseline for the R12 cross-domain innovation study

Date: 2026-10-09. Sources: docs/VISION.md, docs/ROADMAP.md (M0–M11), docs/specs/redesign.md (§1–§9),
docs/design/redesign-2026-10/ (flows, language, quality-bar Q-1…Q-14, components 01–10),
apps/web/src tree and command registry, final screenshots (scratchpad/final/), the owner's
annotated iPad Safari screenshots of 2026-10-08/09.

## 1. What Recto is

A free, open-source, browser-only PDF workspace (static files on GitHub Pages, installable PWA,
offline). Nothing leaves the device: no backend, no account, no telemetry, no cloud AI, strict CSP,
a live "external requests: none observed" counter. Thesis: one coherent document workspace instead
of "forty single-purpose tools" (iLovePDF/Smallpdf upload model; Stirling/PDF24 tool-grid model).
Stack: Vite 8, React 19 + React Compiler, TypeScript, Zustand, Base UI primitives, CSS modules on
tokens, PDFium (@embedpdf/pdfium) + pdf-lib + qpdf wasm in a worker, tesseract.js for OCR,
pragmatic-drag-and-drop, TanStack Virtual, Paraglide i18n (EN/TR). Packages: `engine`,
`document-model` (non-destructive virtual document, undo across all ops). Status: M0–M8 built,
1.0.0-beta.0 live; M9 redesign (D0–D4) largely built and iterating on owner feedback (R10, R11);
M10 phone edition and M11 ecosystem planned.

## 2. Feature inventory by area

**Chrome / shell** (`shell/frame`, `shell/capsule`, `shell/sidebar`)
- Floating glass top strip in pieces: left piece (R mark/Library button, sidebar toggle, document
  tabs with ● unsaved dot, tab menu, +), right piece (Find entry, Undo, Redo, Save/Saved, privacy
  shield). Title menu per tab (rename, Save a copy, Revert, info, close…). Tab overflow menu.
- One morphing bottom capsule: Dock (Pages · Markup · Fill & sign · More) ⇄ Markup palette ⇄
  Pages bar ⇄ Compare bar ⇄ Locked. Morph via own width/height spring + FLIP contents (Q-6).
- Page pill (bottom right: "2 / 4 · 50%") with menu (fit, zoom, go to page); page scrubber;
  pinch detent chip; hide-on-scroll; focus mode; soft edges; free-rectangle layout (`--free-*`) so
  every fit/jump lands in unobscured space.
- One sidebar: Pages (thumbnails with drag, menu), Find, Review (comments, redactions, OCR words to
  check, filters). Outline/bookmarks panel with editing and drag.
- Size classes (compact/medium/expanded/large/xlarge + compact-height), input modality
  (fine/coarse), two editions (ADR-0033): phones get a read-only compact reader (Open, Recents, fit
  width, pinch, find, Pages sheet, collapsible bars, download a copy).
- ⌘K command palette (fuzzy, EN/TR keywords), shortcut overlay on `?`, toasts above the dock,
  sheets (5 presentations by size class), Lock switch (user/signed/restricted/default).

**Ink** (`annotations/pen`, `markup/InkStrip`, `PresetEditor`)
- Pen, highlighter (straight-line snapping, behind-text), eraser (stroke/partial), lasso
  (select, move, transform, split strokes). Pen presets/wells (recents), ink strip second row with
  swatches (7 colours + colour panel with page eyedropper) and a log-scale width slider with a
  glass lens knob ("1.25 pt"). Dry-ink layer with low-latency preview (≤1 frame preview, ≤50 ms
  commit), bursts, straighten-on-hold, stroke fade into capsule. Pencil vs finger: pen writes only
  in Markup by default; finger scrolls.

**Markup** (`annotations`, `markup/MarkupPalette`)
- Select, shapes (rect/ellipse/line/arrow via choice tool), text box, sticky note/comment,
  stamps (incl. image stamp), highlight/underline/strike/squiggly on text selection, callouts.
- Read selection bar on text selection: H U S C X (highlight, underline, strike, comment, redact),
  copy; targeted acts keep the result selected (highlight → comment). Annotation properties
  (style controls). All written as real PDF annotations with appearance streams.
- Palette measured folding ("More tools"), roving focus, doors (Markup door vs Fill & sign door).

**Forms / sign** (`forms`, `signatures`)
- AcroForm fill (text, checkbox, radio, choice), field navigation ("‹ 3 fields ›" in palette),
  form creation (`forms/create`), Forms panel. Signature: draw/type/image New signature sheet,
  up to five saved signatures on device, signature plate placement; digital signature status
  and validity (certificate sheet, "signed" lock), export signature section.

**Text edit** (`text-edit`)
- Edit existing PDF text: single run and paragraph editor (reflow within paragraph), font name
  mapping, glyph canvas preview, substitution honesty notice. Entry only via "Edit text" (E then
  Enter, or double-click in Markup+Select) so stray clicks never change page text.

**Pages** (`stage`, `stage/grid`, `pages-sheets`, `crop`, `furniture`)
- Pages grid (light table) with 240 ms zoom transition from the page, size slider, "This document
  / All open" segmented control (multi-document sections with tags "has form", "tagged"),
  marquee/checkbox selection, drag reorder across documents, FLIP cells, pinch in grid.
- Pages bar: Done, N selected, rotate L/R, move prev/next, Delete, Extract, Duplicate, Move to,
  ⋯ (cut/copy/paste, resize, crop, insert images, split, interleave, reverse, rename section,
  combine). Sheets: Combine, Extract, Split (preview), Interleave, Insert images. Crop (draw or
  dialog), resize. Furniture: page numbers, headers/footers, watermark, Bates numbering.

**Reading / navigation**: virtualized tiled rendering (PDFium worker), continuous scroll, fit
width/page/actual, ⌘± zoom, pinch zoom with detents, page scrubber, outline, page labels, links,
keyboard nav, hide-on-scroll chrome, Focus mode, light/dark (page brightest).

**Search**: Find in strip (field on desktop, icon on tablet) and sidebar section, next/previous,
hit list; ⌘K for commands. No semantic/fuzzy content search.

**OCR** (`ocr`): tesseract.js locally, language packs (EN/TR…), OCR sheet with job progress,
invisible text layer, "Words to check" review with confidence thresholds; also a Batch step.

**Compare** (`compare`): full-screen Compare place, document chooser, text/visual change list
(Changes panel), J/K through changes, export change report.

**Redact** (`redaction`): mark areas/text, Find sensitive data (email, phone incl. Turkish, IBAN
mod-97, TCKN checksum, card Luhn, dates), review marks, Apply sheet that truly removes content,
report text.

**Export / save** (`export`, `session`): Save in place (File System Access where available,
verified write, Replace popover), Save a copy sheet (PDF, images, text, smaller/compressed with
honest numbers, password-protected, OCR words), Revert to opened version. Snapshots in OPFS within
2 s, restore on launch with 20-step history tail, kept 30 days / 500 MB. History list + scrubber
with previews. Convert (images ↔ PDF). Batch recipes (steps: OCR, compress, Bates, watermark,
export; zip delivery). Document info/metadata, password, compress.

**Library** (`home`): Recto mark + "Nothing leaves this device", launcher row (Open PDFs… lime
primary, drop zone, Try the sample, Combine files…, Batch…), Open/Recent grid of cards
(thumbnail, pages, size, "Edited"), Select mode with selection bar, drop overlay, aurora light
background, footer ("Nothing is uploaded", EN/TR switch).

**Settings** (`settings`): one sheet, searchable: Appearance (theme, Glass Clear/Tinted/Solid,
Reduce motion, ambient light), saved signatures, privacy/kept on device, language, About.

**Onboarding**: teaching sample (4 pages EN/TR, `?sample`: Welcome, Fill in a form, a letter,
Arrange pages) with numbered prompts on the page ("Press M or tap Markup…"); facts chip (scan →
OCR, form → Fill & sign); keycaps hidden on touch. No guided tour, no progressive tips.

## 3. Interaction model

- **Places**: Library, a document (page, Pages grid, sidebar, Markup palette), Compare. Keys `1`–`4`
  / `0` for places (key map v2), View Transitions ≤240 ms between them.
- **Viewing works without a mode** (ADR-0029): type in fields, act on text selection, page context
  menu (right-click / long-press 450 ms), drag thumbnails. One creation state: Markup (M; tool keys;
  P = last pen) opens the palette with Select armed; Done or Esc Esc closes. Fill & sign opens the
  same palette on its Sign set.
- **Guard**: `canChange(id, act)` over targeted/freehand/place/text/pages/document; Lock refuses in
  `commit()`. Undo not confirmation; visible Undo/Redo on every width.
- **Esc ladder**: menu → selection → disarm tool → close Markup → leave Focus.
- **Keys**: every command has a ⌘K entry, most a shortcut (registry is source of truth;
  `keymap.ts` groups: places, tools, selection, pages, files, view, commands, history). H U S C X on
  selection, J/K step lists, Mod+S save, Shift+R, Alt+Enter, caret mode, keyboard placement.
- **Gestures** (gesture core, research 19 thresholds): pinch zoom with detent chip, long press,
  double tap, two-/three-finger taps (undo/redo), drag to reorder, marquee, Pencil draws while
  finger scrolls in Markup. No Pencil squeeze/barrel/hover use (Safari exposes limited Pencil
  data: pressure, tilt, pointerType "pen"; no hover/squeeze APIs).
- **Menus**: title menu, tab menu, page pill menu, page context menu, thumbnail menu, Pages bar ⋯,
  Move to popover, Base UI popovers scaling from anchor (0.96→1).

## 4. Visual and motion language ("Recto Glass", ADR-0022…0028)

- Apple "Liquid Glass"-like floating pieces; page is the brightest thing on screen; dark default,
  light equal and system-following. Colour roles never mix: atmosphere (lime aurora), interaction
  (one lime that touches ink; selection blue `#4e61ed` on the page), content, status. Graphite
  neutrals hue 265. Lime never on the page.
- Materials: five densities (chips 0.21 → sheets 0.07 transmission), coverage rule (σ ≤ height/5),
  rims and inner light, e0–e5 elevation, Glass Clear/Tinted/Solid + cost ladder that steps down
  when frames exceed 20 ms. Gates: no grain (Q-1), crisp at rest (Q-2), one backdrop root (Q-3), no
  glass in glass (Q-4), small moving parts use lenses not blur (Q-5), shapes morph by own geometry
  (Q-6), transform-only sheets (Q-7), one control size/radius/icon size per bar (Q-9).
- Light: 1/8-resolution aurora shader in named places (Library, drop overlay, under armed tool,
  processing ring, success bloom); never within 64 px of a page; pauses at rest.
- Type 'Inter Recto' (98 KB incl. Turkish), sentence case, tabular numbers; Phosphor icons
  (regular at rest, fill selected); radius scale 4–28 px concentric; 24 px fine / 44 px coarse.
- Motion: springs via own motion core (<3 KB), `linear()` curves, FLIP, velocity handoff, rubber
  band, View Transitions; reduced motion per token; zero frames at rest.

## 5. Known weaknesses and gaps

**Owner's iPad annotations (2026-10-08/09), in his words translated:**
- "Inconsistent" sizes everywhere: top strip pieces, Save pill vs icon buttons, palette rows,
  Library cards ("inconsistent sizes and not properly arranged"), "too big" chrome on iPad
  (top strip pieces, Library launcher, ink strip), "maybe too big" privacy/⋯ piece.
- "Animation!" — the dock/palette morph and other transitions still don't feel alive or correct;
  "animations" around undo/redo/Save. Wants motion that clearly communicates change.
- Glass: "glass feels thick because of light"; Library wants "more alive aura" and "more bg =
  better glass" (glass reads flat over a plain dark background). Earlier: "gloss/hover slider"
  idea for the width slider; asked whether the top bar should be fixed or floating in pieces.
- Ink strip: two-tier palette "empty and ugly" ("Boş ve çirkin"), swatches repeated between the
  palette row and the strip ("repeat?"), "maybe moves to the new one"; slider knob bug; "maybe
  two tiers could separate"; "improve overall design".
- Library: repetitive brand (R mark in strip + big Recto header), launcher too big, cards bug on
  different aspect ratios.
- Pages grid: section headers and tags look crude ("Better UI"), selection badge buggy, wants
  "better selection / highlight" (selected page should glow/lift like a native iPadOS selection).
- Popovers that don't fit (privacy sheet overflowed the viewport on iPad); the dock is covered.
- "option?" / "aura? test?" — unclear affordances and test-looking screens.

**Structural gaps (from specs, inventory and the study brief):**
- The product is still a feature-complete PDF tool that looks like an editor; little delight,
  personality or "wow" moments; the dock labels (Pages · Markup · Fill & sign · More) are plain.
- Pencil experience is basic next to Notability/GoodNotes/Procreate: no shape recognition beyond
  straighten, no scribble-to-erase, no handwriting search, no ruler/lasso-recolour, no pressure
  curves UI, no zoom-writing box, no infinite margin/paper insertion, no palm-rest UX polish.
- Reading is basic next to Apple Books/Kindle/Readwise/LiquidText: no reading mode/reflow, no
  annotation summary export, no tabs-as-workspace overview, no excerpt/collect, no split view of two
  places in one document, no TTS.
- Navigation: no visual history ("back to where I was"), no minimap, no search-in-thumbnails.
- Pages grid lacks Keynote/Photos-quality selection, drag ghosts with stack counts, spring-loaded
  drop targets, and lacks a "story" of the document (sections, colours).
- Onboarding: the sample is good but static; no contextual tips, no empty-state teaching.
- No local "smart" features (no on-device ML beyond OCR): no auto form-field detection, no
  table extraction, no summarization (cloud AI forbidden; small local models would be new ground).
- Collaboration only via files; no share-sheet integration polish, no annotation import/export UX.
- Library is a flat card grid: no folders/tags, no search, no sort, no stacks.
- Haptics impossible in Safari (no Vibration API on iOS); sound unused.
- Pending: XD-3 tablet tab strip/bar heights, compact sheets see-through, history scrubber dims,
  glass seams, text preview order (task 28); R11 sizes/library/glass/motion/palette dedupe.

## 6. Constraints

- **Local only**: no server, accounts, cloud AI, telemetry, CDN engines; CSP `connect-src 'self'`.
  Any intelligence must run in wasm/WebGPU on device, lazy-loaded, within size budgets. Never add
  dependencies without owner sign-off (CLAUDE.md: "Never add dependencies").
- **Browser**: Chromium, Firefox, WebKit all in CI; must be engine-agnostic. File System Access is
  Chromium-only (Safari falls back to download/share). OPFS for snapshots; Safari may evict storage.
  View Transitions, `backdrop-filter`, `linear()`, Pointer Events with pressure/tilt available;
  no Pencil hover/squeeze/double-tap, no haptics, limited share target, PWA install on iPad via
  Add to Home Screen. Safari URL bar eats vertical space on iPad.
- **iPad first** (with desktop): touch + Pencil, 44 px targets on coarse pointers, 1180×820 and
  1366×1024 tablet sizes, portrait 820×1180. Phones read-only until M10.
- **Performance budgets** (spec §9.1): blurred surfaces ≤ 5+2 expanded / 6+2 large; persistent
  glass ≤ 25–32 % of area; blur never animated; zero animation frames at rest; zero layouts during
  morphs/pinch; View Transitions 240 ms; aurora ≤ 4 KB gz, ≤ 0.5 ms/frame; motion core < 3 KB;
  fonts 98 KB; icons ~18 KB; sample ≤ 250 KB; snapshot writes ≤ 8 ms main thread; pen preview ≤ 1
  frame, committed stroke ≤ 50 ms; initial JS ≤ +10 % over M8; phones ≥ 58 fps fling.
- **Accessibility**: A-1…A-24 gates (two-band focus ring, contrast ≥ 4.5/3:1 incl. on glass, axe,
  reduced motion, 400 % zoom, WCAG 1.4.12 spacing, Turkish casing), keyboard path for every action.
- **Process**: EN/TR strings in messages, Conventional Commits, ADRs, specs cite sections,
  quality bar tests (glass walker, capsule pixel probes), screenshots at 1440×900 and 1180×820.
- **Principles to preserve**: one workspace not forty tools; correctness over feature count;
  honest UI; undo not confirmation; page is brightest; one accent; no monetization friction.
