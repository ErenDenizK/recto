# R13: an editable phone edition (M10 concept)

Date: 2026-10-09. Input to the integrated roadmap. Scope: **phones only** (ADR-0033 device rule:
coarse pointer and shorter screen side < 600 CSS px). Tablets stay in the full edition. Nothing
here touches M9/V1 work. M10 starts only when the owner says so (ADR-0033 §2.5).

Sources: web research (links at the end) plus product knowledge of the apps named. The web
results on 2025–26 phone toolbars were thin, so treat any UI detail marked *(verify)* as
something to check on a real device before a decision rests on it.

---

## 1. What the best phone apps teach (condensed)

| App | Pattern worth taking | Pattern to avoid |
|---|---|---|
| **Apple Photos edit (iOS 18+)** | Editing is a separate **mode** you enter with one button and leave with **Done/Cancel**. The bottom area shows a short row of categories, then one control for the chosen category (a dial or slider). The image stays the hero. | Hidden long-press behaviour that nobody finds. |
| **Instagram / CapCut editors** | **Bottom tool rail**: one horizontal row of icon + one-word label. Tap a tool and the rail is **replaced** by that tool's options, with a ✓ or back chevron to return. Only one level is visible at a time. | Rails that scroll sideways through 20+ tools (CapCut). They are fine for power users and confusing for everyone else. |
| **Apple Markup (Files/Mail/Photos), PencilKit on iPhone** | The tool picker is **docked at the bottom** on iPhone and fills the available width (WWDC24 10214). It holds a few pen types and a colour well, with undo/redo at the top. Finger drawing is on while Markup is open. Two fingers scroll. | Signature and Text hidden behind "+". People don't find them. |
| **PDF Expert (iPhone)** *(verify)* | Separate top-level modes (Annotate / Edit / Fill & Sign). Each has its own single-row toolbar. Reading is the default and stays clean. | Too many modes. People get lost about which one they're in. |
| **Adobe Acrobat mobile** | One floating **edit (pencil) button**, bottom right, opens the tools. *Fill & Sign* is a first-class path, because signing is the top phone task. | The UI moves between versions (users report the button "disappearing", Adobe community, 2024). Upsell surfaces everywhere. |
| **Adobe Scan / Microsoft Lens** | A strict **linear flow** with a single big primary action at the bottom (capture → crop → save). There are no tool palettes. | n/a (they are capture apps). |
| **Goodnotes / Notability (iPhone)** | Pen, highlighter, eraser, lasso and colour in **one compact bar**. Colour and size are **3 presets per tool**, so you never open a picker mid-writing. | Floating toolbars on small screens, which Goodnotes users call "cramped". |
| **Procreate Pocket** | **Edge sliders** for size/opacity, with sideways drag for fine steps. **Two-finger tap = undo**, three-finger = redo. **QuickMenu** on a gesture. A four-finger tap hides all UI. | Gesture-only features with no visible equivalent. |
| **Apple Notes (iPhone)** | Plus-style **insert menu** for rare things (attachments, checklists). Common things are always one tap away. | n/a |
| **Google Drive PDF (Android)** | Annotate button bottom right, then a small pen/highlighter/eraser bar that can be moved by long press. Form filling is a **separate button** with Save → overwrite or copy. | Stroke-only eraser is fine, but there is no signing at all. |
| **iOS 26 / Liquid Glass bars** | A floating bottom bar inset from the edges that **minimises to a pill on scroll** and comes back on reverse scroll or tap, with a **separate circular "island"** for the trailing action. 2–5 items, one-word labels. | Opaque custom bars. Fixed bars feel dated. |

**What the patterns have in common:**

1. **Read mode is the default.** Editing is one explicit button away and has an explicit way out.
2. The bottom shows **one row of 4–5 tools**. A tool's options replace the row or sit as a thin
   tier above it. Only one level is visible at a time.
3. Tool options use **presets** (three colours, three sizes), not pickers.
4. **Sign and Fill are their own fast path**, because "I received a form and must sign it" is
   the main reason anyone edits a PDF on a phone.
5. While drawing, **one finger draws and two fingers pan/zoom**. A stylus draws in any mode.
6. **Undo is always visible.** Gesture undo is a bonus, never the only way.

---

## 2. Where Recto starts (as built)

The `shell/compact/` code is about 4.9 k lines. It is a finished, read-only reader with its own
shell (`CompactApp`, `CompactReader`, `CompactChrome`, `CompactSheets`, `CompactSheet`,
`compact-store`, `compact-actions`, pure `gestures.ts` and `reader-layout.ts`). It covers:

- Library (Open PDF, Recents, the "reading only" line).
- Reader: continuous fit-width pages, pinch zoom, double-tap fit ⇄ 2×, links, text selection
  with Copy, read-only notes (`NoteLayer`).
- Chrome: top bar (back, title, ⋯) and one bottom capsule (Pages · "3 / 12" · Find). Both hide
  together on scroll or tap, and a page pill lingers for 1.5 s.
- Sheets: Pages, Contents, Go to page, Info, About. Share or Download a copy goes through
  export when the document has changes.
- Snapshots restore, so changes made in the full edition survive.

It already shares the engine, the workspace store, file intake, Recents, the page renderer,
search, the outline, i18n and the tokens. The editing kernel is in place but **not yet mounted
on phones**: `annotations/` (store, actions, commands, `pen/ink-input`, `dry-ink`,
`highlighter`, `eraser`, `straighten`, `presets`), `forms/` (FormLayer, form-store),
`signatures/`, `history/`, the page operations behind `stage/`, and `export/`.

That makes M10 mostly a **new chrome over existing kernels**, not new engine work. That is
exactly the split ADR-0033 chose.

---

## 3. Proposal

### 3.1 Principles

- **P-1 Reading first.** A phone user who never taps "Mark" sees today's reader, unchanged and
  just as fast. Editing code loads **lazily on the first Mark tap**, in its own chunk.
- **P-2 One bar, one level.** The bottom shows at most one row of controls, plus one optional
  thin options tier.
- **P-3 Five tools, not fifty.** Anything else stays a full-edition feature, and the phone
  says so honestly.
- **P-4 A visible equivalent for every gesture.** (WCAG 2.5.1, and our own Q-bar.)
- **P-5 Same kernel, own chrome.** No phone exceptions in full-shell components, and no
  editing logic forked into the phone shell.

### 3.2 Minimal tool set (phone M10 V1)

| Tool | How it works on a phone | Kernel reused |
|---|---|---|
| **Highlight** | Two ways in. (a) **Read mode:** long-press to select text; the selection bar offers *Highlight · Underline · Copy · Note*. This is Apple Books' pattern and needs no mode. (b) **Mark mode:** the highlighter tool. A finger drag snaps to text lines (the existing `highlighter.ts`); on scans, it falls back to a freehand marker. | `selection-markup.ts`, `pen/highlighter.ts`, `ReadSelectionBar` logic |
| **Pen** | Finger draws. Three preset colours and three sizes in the options tier. **Eraser is a toggle inside Pen** (a stroke eraser, like Drive), not a separate tool. Straighten-on-hold comes for free. | `pen/ink-input`, `dry-ink`, `eraser`, `straighten`, `presets` |
| **Sign** | Opens a sheet: saved signatures, or **Draw new** on a full-width pad. Landscape is suggested, not forced. You place the signature with one tap, drag it to move and use the corner handle to scale. Initials and date are chips in the same sheet. | `signatures/`, saved-signature store (D0) |
| **Fill** | Tap a form field and the keyboard opens with an **accessory row: ‹ › Done** that steps field to field (`forms/navigation.ts`). Checkboxes and radios toggle in place, and choice fields open a sheet. For a flat PDF with no fields, "Add text" places a text box at the tap point. | `forms/FormLayer`, `form-store`, `navigation.ts`; text box from annotations |
| **Note** | Tap to drop a sticky note. A sheet takes the text. In read mode, notes already show their text on tap. | annotations note editor, `NoteLayer` |

**Phase 2 (not in the first drop): Pages arrange.** The Pages sheet gains a "Select" toggle.
You long-press and drag to reorder, and the selection bar offers *Rotate · Delete · Extract*.
This reuses the `stage/` page operations and the grid selection model. Insert, combine, crop
and resize stay full-edition only.

### 3.3 What stays read-only or absent on phones

These stay off the phone: editing a PDF's own text, redaction, Compare, conversions and OCR,
crop and resize, combine and batch, creating form fields, image objects, header/footer
furniture, shapes and stamps beyond the signature chips, the history scrubber (phones get plain
undo/redo), the preset editor, the multi-document tabs and the Light Table.

**Honesty line** (replaces today's "Reading only" copy): "Phone marks up, fills and signs. For
page tools and text editing, open the file on a computer or tablet." EN and TR wording to be
written then.

### 3.4 Navigation model

```
Library ──open──▶ Reader (read mode, default)
                    │  tap ✎ Mark (bottom-right island)
                    ▼
                  Mark mode ──Done──▶ Reader (changes kept; snapshot saved)
                    │
                    └─ Sign / Fill / Pages / Share open as sheets over either mode
```

- **Two modes only:** Read and Mark. There is no separate "Fill & Sign" mode. Fill and Sign
  are tools inside Mark, and a form field is also tappable straight from Read. Tapping a field
  in Read enters Fill, because that is what the user means.
- **Done** is always top-right in Mark mode, and **Undo/Redo** top-left. The title hides, so
  the mode is obvious at a glance.
- Leaving with changes shows no dialog. Changes live in the snapshot (ADR-0032). The ⋯ menu
  and the Library row get a "Changed · Share copy" affordance.

### 3.5 The one bottom bar

**Read mode** is today's capsule plus a separate trailing island, following iOS 26: the capsule
holds **[Pages] [3 / 12] [Find]**, and the round **island** holds **(✎)**.

- Hide on scroll works as today. Minimised, the bar collapses to the page pill plus the ✎
  island, which never fully disappears in a document that can be edited.

**Mark mode** morphs the capsule (we have the morph machinery from `shell/capsule/`) into a
**tool rail** of five icons with one-word labels:

```
 ┌─────────────────────────────────────────────┐
 │  ● ● ●   ▁ ▂ ▃   ⌫eraser          (options) │  ← thin tier, only for Pen/Highlight
 ├─────────────────────────────────────────────┤
 │ Highlight   Pen    Sign    Fill    Note     │  ← rail (one row, 44 pt targets)
 └─────────────────────────────────────────────┘
```

- On a 375 pt wide phone, five tools at 44 pt with labels fit without scrolling. **No sideways
  scrolling rail.**
- The **options tier** shows only for Pen and Highlight: three colours, three sizes, and Eraser
  for Pen. Long-press a colour to change that preset, which opens a small sheet with the
  existing ink colour controls. Sign, Fill and Note go straight to a sheet or to the page and
  need no tier.
- **Alternative to test with the owner (the "two tools" idea):** a rail of **[Pen] [Sign]
  [＋]**, where ＋ opens a small picker sheet (Highlight, Fill text, Note, Pages). It is even
  more minimal, at the cost of one extra tap for Highlight. Both should be prototyped. My lean
  is the five-tool rail, because Highlight and Fill are as frequent as Pen.
- **Edge control (Procreate):** an optional size/opacity slider on the **right** edge while Pen
  is active. The left edge conflicts with Safari's swipe-back gesture, so it cannot go there.
  It is off by default and turned on in About → Settings. The options tier already covers the
  need.

### 3.6 Gestures

| Gesture | Read mode | Mark mode (Pen/Highlight) |
|---|---|---|
| 1-finger drag | scroll | **draw** (`touch-action: none` on the ink layer only) |
| 2-finger drag / pinch | zoom/pan | zoom/pan |
| Stylus (`pointerType: 'pen'`) | draws with the last pen, which enters Mark mode | draws |
| Tap | toggle chrome / follow link / open note | select a mark (shows its selection bar) |
| Double tap | fit ⇄ 2× | fit ⇄ 2× (off while drawing a stroke) |
| Long press | select text, then the selection bar | the mark's context bar (Colour · Delete · Note) |
| **2-finger tap** | — | **Undo** (the button is always visible too) |
| 3-finger tap | — | Redo |

There is no swipe-to-turn-page: pages scroll continuously, as they do today. Keep the pure-
function style of `gestures.ts` so every rule stays unit-tested.

### 3.7 Sheets

All sheets use one `CompactSheet` component, extended with **two detents (medium, large)**, a
grabber, swipe-down to dismiss, and focus return. The phone sheets are:

- **Sign:** saved list, Draw new, Initials, Date.
- **Colour:** long-press from the options tier.
- **Note text.**
- **Choice field.**
- **Pages:** today's sheet plus Select in phase 2.
- **Share/Save:** Share copy (`navigator.share` with files), Download, Keep on device. Phones
  have no File System Access, so phones have **no Save in place**, and the sheet says so.

The keyboard must never cover the field being filled. `interactive-widget=resizes-content` is
already set for Chrome on Android. Safari ignores it, so the field has to be scrolled into
view from the `visualViewport` resize event.

### 3.8 Code sharing (how it stays one app)

- **Shared, unchanged:** engine and worker, `document-model`, the workspace and annotation
  stores, `annotations/actions` and commands, the ink pipeline, signatures, the forms
  kernel, history (undo/redo), export, snapshots, i18n, tokens, materials, motion and `ui/`
  primitives.
- **Phone-only:** `shell/compact/` grows a `mark/` folder for the rail, the options tier, the
  phone sheets and the phone gesture rules. The edition flag stays `compact` (perhaps renamed
  `phone`).
- **The one refactor needed up front ("headless markup"):** find every place where a tool's
  *state machine* lives inside a full-shell React component (the palette, `InkStrip`,
  `PenWell`, `AnnotationBar`). Move the logic into stores or hooks that both shells call. This
  is a no-visible-change refactor of the internals, which fits the owner's "optimise the inside
  without changing the UI" direction. It also pays off for the desktop edition later.
- **Bundle:** the reader chunk stays as it is. Mark mode gets a lazy `import()`, and its
  first open is prefetched on idle after the first page renders. Budget: Mark chunk ≤ 120 kB
  gz *(to be measured)*.
- **Tests:** the existing `phone` and `phone-land` Playwright projects. Each phase adds the
  jobs it enables to `jobs.spec.ts` (sign a form, highlight a sentence, fill and share).

### 3.9 Phased plan (after V1, when the owner opens M10)

| Phase | Content | Exit |
|---|---|---|
| **M10-0 Prep** (can run late in M9: internals only, no UI) | Headless-markup refactor; extend `CompactSheet` with detents; measure input latency of the ink path on a mid-range Android device and an iPhone | Full edition unchanged (visual baselines equal); ink latency on phone ≤ desktop + 1 frame |
| **M10-1 Highlight from selection** | The selection bar on phones gets Highlight, Underline and Note; notes become editable; Undo; Share copy with changes | A user highlights, notes and shares in under 20 s |
| **M10-2 Mark mode + Pen** | The ✎ island, the rail morph, the options tier, finger and stylus drawing, Eraser, two-finger undo | The jobs suite's "annotate" job passes on phone and phone-land |
| **M10-3 Fill & Sign** | Field stepping with the keyboard accessory, the Sign sheet, placing and scaling, initials and date, text box on flat PDFs | Job "receive form → fill → sign → share" in ≤ 6 taps beyond typing |
| **M10-4 Pages arrange** | Select in the Pages sheet: reorder, rotate, delete, extract | The reorder job passes; no accidental drags while scrolling |
| **M10-5 Polish** | Landscape, haptics (`navigator.vibrate` on Android only; iOS has none in web), the optional edge slider, a VoiceOver/TalkBack pass, honesty copy | Quality bar Q-1…Q-14 on phone; owner review on his own phone |

### 3.10 Phone-web constraints to design around

- **iOS Safari:** a left-edge swipe means *back*, so nothing interactive goes on the left
  edge. The bottom toolbar floats and collapses, so use `env(safe-area-inset-bottom)` and
  `dvh`. There is no `navigator.vibrate`. Finger touches report no pressure, so ink width must
  come from velocity (the current pipeline already supports this). `navigator.share` with files
  works.
- **Android Chrome:** stylus (`pointerType: 'pen'`) and palm events, and a three-button nav
  bar. Test with gesture nav and with three-button nav.
- **Memory:** cap the render resolution, as the DPR-3 fix in task #25 did. Keep
  stroke-preview canvases at viewport size, never at page size.

---

## 4. Decisions for the owner (when M10 opens)

1. Five-tool rail, or the "two tools + ＋ picker" rail? (Prototype both; my lean is the
   five-tool rail.)
2. Should tapping a form field in Read go straight into Fill? (My lean: yes.)
3. Is Pages arrange in the first phone release, or later? (My lean: phase 2.)
4. Optional Procreate edge slider: build it in M10-5, or drop it?
5. Should a stylus draw from Read mode without tapping ✎? (My lean: yes, like Goodnotes and
   Apple Markup.)

## 5. Edition fit (web / desktop / phone)

The phone edition is a **web** edition: browser-only, nothing installed, local. It uses no
personal-data features ("My info" autofill and API connections belong to the future desktop
edition). Signatures stay as today: kept on the device only, opt-in. If a desktop (installable)
edition later adds profile autofill to Fill, the phone's Fill tool is where a "suggest from My
info" chip would go. That is out of scope here.

## Sources

- [Procreate Pocket handbook: Interface](https://help.procreate.com/pocket/handbook/interface-gestures/interface), [QuickMenu](https://help.procreate.com/pocket/handbook/interface-gestures/quickmenu), [Gestures](https://help.procreate.com/pocket/handbook/interface-gestures/gestures)
- [Apple: PKToolPicker](https://developer.apple.com/documentation/pencilkit/pktoolpicker), [Configuring the PencilKit tool picker](https://developer.apple.com/documentation/pencilkit/configuring-the-pencilkit-tool-picker), [WWDC24 10214 Squeeze the most out of Apple Pencil](https://developer.apple.com/videos/play/wwdc2024/10214), [WWDC25 285 (PaperKit)](https://developer.apple.com/videos/play/wwdc2025/285/), [WWDC25 284 (tab bars, minimise on scroll)](https://developer-mdn.apple.com/videos/play/wwdc2025/284)
- [Create with Swift: tab bar collapse while scrolling](https://www.createwithswift.com/making-the-tab-bar-collapse-while-scrolling/)
- [Google Drive: annotate PDFs on Android](https://support.google.com/drive/answer/13207179), [9to5Google: Drive PDF draw/highlight](https://9to5google.com/2023/03/02/google-drive-pdf-draw-highlight/), [Xataka: Drive form filling](https://www.xatakandroid.com/productividad-herramientas/google-drive-para-android-permite-rellenar-formularios-pdf)
- [Adobe: sign a document on iPhone](https://www.adobe.com/acrobat/business/resources/sign-document-on-iphone.html), [Adobe community: Fill & Sign on iPad UI change](https://community.adobe.com/t5/acrobat-reader-mobile-discussions/adobe-reader-fill-amp-sign-option-on-ipad/m-p/14421766/highlight/true)
- [AlternativeTo: Goodnotes 2025 toolbar redesign](https://alternativeto.net/news/2025/10/goodnotes-update-brings-new-plans-ai-features-whiteboards-and-text-documents), [Goodnotes feedback: toolbar customisation](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes-apple/suggestions/50583833--toolbar-support-customization)
- [MacStories: PDF Expert annotation features](https://www.macstories.net/news/pdf-expert-adds-new-annotation-features/), [Readdle: PDF Expert 5.1 universal](https://readdle.com/blog/announcing-universal-pdf-expert-51)
- Repo: `docs/adr/0033-compact-edition.md`, `apps/web/src/shell/compact/*`, `docs/ROADMAP.md` §M10, `apps/web/src/annotations/pen/*`, `apps/web/src/forms/*`
