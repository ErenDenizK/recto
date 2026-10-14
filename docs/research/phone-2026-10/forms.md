# Phone form filling: research and proposal

Scope: why the owner cannot tick the sample's checkbox on an iPhone, what the full edition
already has, what the phone can reuse, how other phone PDF apps fill forms, and a concrete
design. Read-only research; nothing in the repo was changed. All paths are under
`/home/user/pdf-editor/` and refer to `develop` at `7462113`.

---

## 0. The short answer

On the phone, form fields are only pixels. `CompactPage` mounts the text, Find, link and note
layers in reading and, while editing, only the layers the `mark/` chunk registers (dry ink,
annotations, Text, Edit text). No form layer is mounted in either state, so a tap on the
checkbox goes to the reader's tap handling (toggle the chrome) or to the armed tool (a Pen dot).

- `apps/web/src/shell/compact/CompactPage.tsx:4-6`: "Forms, annotations and signatures are in
  the bitmap."
- `apps/web/src/shell/compact/CompactPage.tsx:136-146`: the overlays are `CompactTextLayer`,
  `SearchHighlights`, `LinkLayer` and `NoteLayer`, plus the editing slot.
- `apps/web/src/shell/compact/NoteLayer.tsx:2-6`: "none of them takes input here".
- `apps/web/src/shell/compact/mark/index.ts:149-151`: editing registers only `DryInkLayer` and
  `AnnotationLayer` (Text and Edit text add their own).

I checked this in the production build: iPhone viewport 390×844 at DPR 3 with touch, `?sample`,
page 2. `document.querySelectorAll('[data-field-name]').length` was 0 both in reading and with
✎ and Pen armed. A tap on the checkbox changed nothing on the page. Screenshots are in

The design already promised this and nobody built it:

- README §4: "Tapping a form field starts typing, and tapping a signature field opens Sign"
  (`docs/design/phone-2026-10/README.md:94`).
- EDN-14 left it open: "A signature form field opening Sign waits for forms on phones"
  (`docs/process/decisions.md:145`).

Even with a layer, the sample's fields are far too small for a finger at fit width. The page is
374 css px wide for 595 pt, a scale of about 0.63:

| Field | Size in the PDF | Size on screen at fit width |
|---|---|---|
| Checkbox `tried` | 15×15 pt | about 9.4 css px |
| Text fields `name`, `date` | 28 pt tall | about 17.6 css px tall |

The full edition's `TextEditor` sizes its font to the widget: 12 pt × 0.63 ≈ 7.5 px. iOS zooms the
whole page for any focused editable under 16 px. `index.html:5` has no `maximum-scale`, so that zoom
would fight Recto's own zoom (the reader owns zoom, `reader-layout.ts:18-19`).

---

## 1. What exists

### 1.1 The full edition's form filling (`apps/web/src/forms/`)

| Piece | File:line | What it does |
|---|---|---|
| Registration | `forms/index.ts:26-28` | `registerPageOverlay(FormLayer)` and `CreatedFieldLayer` into the full edition's `stage/page-overlays` registry. Also closes the editor on view, tool or document change (`:30-42`). |
| Field cache | `forms/form-store.ts:181-221` | Zustand store. `sources[source].fields` comes from the engine (`editor.listFormFields`, `:197-198`). Holds `active`, `highlight` and `flattenOnExport`. It reloads on every engine edit (`onPagesChanged`, `:324-329`), re-renders the pages of changed widgets (`:207-215`), and drops a closed source (`:314-321`). |
| Document order | `form-store.ts:245-293` | `fieldStops`: page by page, rows within 4 pt, left to right, then created fields. `isFillable` (`:296-305`) covers text, checkbox, radio, combobox and listbox. |
| Fill as history | `forms/actions.ts:372-390` | `fillField`: one `form.set-value` engine edit in the annotation edit runner's queue, one history entry "Fill Name". `commitFieldValue` (`:396-400`) routes created fields to the model. `clearAllFields` (`:430-459`) is one entry. |
| Engine edit | `packages/engine/src/edits/apply.ts:242-250`, `payloads.ts:11,135-143` | Applies the value and returns the previous value as the inverse, so undo and redo come free. Serialised in `document-model/src/serialize.ts:603`, so the session snapshot and the phone's copy cache (`Workspace.engineEdits`, EDN-14) carry fills. |
| Layer | `forms/FormLayer.tsx:50-109` | One button per widget at the widget's exact box (`userRectToCss`). Live per the hit router. |
| Widget behaviour | `FormLayer.tsx:118-327` | Checkbox and radio toggle on click (`:233-284`) with the `TickIn` glyph. Text, combobox and listbox open an editor (`:170-181`, `:309-325`). A push button is inert with a tooltip (`:285-295`). A signature field shows a notice about what the engine read, never validated (`:296-308`, `:357-393`). When locked, the field focuses and shows a notice (`:137-142`, `:221-230`). |
| Tick motion | `forms/TickIn.tsx:1-40` | `fillAndPaint` commits, then a glyph stands until `whenPainted` (motion forms-compact §2). |
| Editors | `forms/FieldEditors.tsx:527-693` | `TextEditor` handles single line, multiline, password, maxLength, comb and datalist for an editable combo. `ChoiceEditor` uses a native `<select>`. Keys: Enter commits, Esc reverts, Tab and Shift+Tab move (`:463-488`). Blur commits (`:512-523`). The font fits the widget (`:454-460`, the iOS zoom problem). It focuses in `useEffect` (`:556-562`), after the tap, which is too late for the iOS keyboard. |
| Navigation | `forms/navigation.ts:490-533` | `activeStops`, `openField` (`showSurface('page')`, `setMode('select')`, leaves design mode, `scrollToPage`) and `moveField` (wraps). |
| Hit router | `viewer/hit-order.ts:192-232` | `viewing` and `markup-select` mean `fill`; drawing and placing tools mean `null` (the tool wins); `locked` means `focus`. A fill is a `targeted` act (`viewer/input-state.ts:38-49`). |
| Panel, export | `shell/FormsPanel.tsx`, `export/SaveCopySheet.tsx:133`, `SaveCopySections.tsx:351` | Desktop only: the field list, "Highlight fields" and "Flatten on export". |
| Field creation | `forms/create/*` | Desktop design mode. Out of scope for phones. |

Tests: `forms/forms.test.tsx` (423 lines), `forms/create/create.test.tsx`, `forms/Odometer.test.tsx`
and `e2e/forms.spec.ts`, which uses `test/fixtures/forms-a.pdf`.

### 1.2 The compact edition today

- **Reading** shows the fields only as bitmap (see §0). The reader treats a tap on
  `button, a, input, textarea, select, [role=button], [data-compact-interactive]` as that
  element's own (`shell/compact/CompactReader.tsx:102-104`, `:498`). A field layer of buttons
  would therefore not toggle the chrome, with no change to the reader.
- **Editing** works through the full edition's gate (`mark/bridge.ts:1-22`): Markup open, the tool
  store's mode set. With Pen, Highlight, Text or Sign armed the hit matrix gives form widgets no
  meaning, and the same rule would hold on the phone. With the chip off (Select) the state is
  `markup-select`, where widgets `fill`. No layer is mounted, so nothing happens.
- **Keyboard pieces** come from EDN-12, EDN-17 and TXT-5, and are all reusable:
  - `mark/keyboard-hold.ts:58-98` focuses a 16 px stand-in inside the tap so iOS raises the
    keyboard; the real editor takes focus later.
  - `mark/keyboard.ts:101-122` writes `--kb-inset` and `--free-*` from `visualViewport`.
  - `keepInView` (`:196-230`) scrolls `[data-read-viewport]` so the field sits between the top
    bar and the keyboard's Done.
  - `TypingBar` (`mark/TextLayer.tsx:146-184`) is the Done bar that rides on the keyboard;
    `setTyping` sends the island away (`compact-store.ts:185-188`, `capsuleAway` `:93`).
  - `setMinFieldFontPx` (`mark/text-tool.ts:14-23`) lays the field out at 16 px or more and
    scales it back to the page.
- **Undo** belongs to the island (`bridge.ts`, the floor at the first edit of the session). In
  reading, the only undo is the selection bar's 4 s Undo after a Highlight (EDN-13).
- **Signature fields:** EDN-14 deferred them; the Sign flow (`mark/sign.tsx`, `NewSignatureHost`)
  exists.

### 1.3 The sample (`tools/fixtures/sample-fixture.ts`, shipped in `apps/web/public/sample/`)

- Page 2, "Fill in a form", is built by `formPage` (`sample-fixture.ts:722-813`). Its "Guest book"
  card holds:
  - **`name`**: text field, 28 pt tall, /TU "Name" (`:743-761`).
  - **`date`**: text field, 132 pt wide, /TU "Date" (`:762`).
  - **`tried`**: checkbox, 15×15 pt, /TU "I tried Recto." (`:764-780`). This is the box the owner
    tried to tick.
  - **Signature**: a drawn dashed box with an × and "Sign here with Fill & sign", deliberately
    *not* a /Sig field, so Fill & sign places the signature there (`:782-812`).
- `SAMPLE_FIELDS = ['name', 'date', 'tried']` (`:80`).
- The lessons that mention fields:
  - Page 2's intro: "Click a field and type. The fields belong to the PDF…" (EN `:160`, TR `:212`).
  - Page 2: "Leave your name, then sign." and "Sign here with Fill & sign."
  - Page 1's tries: "Press M or tap Markup…" and "Right-click or long-press…" (`:151-154`). These
    are desktop wording too.
- The visual audit already flags that the sample teaches editing the phone cannot do,
  including "click a field" and Fill & sign (`docs/research/phone-2026-10/visual-audit.md:14`).
- EDN-9 (`decisions.md:140`): rewrite the sample for phones once phone editing ships. Nothing in
  the fixture has changed since then (`git log` on the fixture shows only older commits).

### 1.4 Budget

- `tools/qa/bundle-budget.json`: the compact gate is 327 680 B (320 KB), baseline 298 538. That
  leaves about 29 KB of headroom, and the growth cap is 1 % per wave (about 3 KB).
- PRC-11: gates are never raised; split or lazy-load instead.
- The `CompactApp` chunk's static imports are only i18n, react, preload-helper, session-toast and
  rolldown-runtime (checked in `dist-research`). `edit-runner` is its own chunk, which the `mark`
  chunk pulls in.
- `FormLayer.tsx` imports `showMarkup` from `home/home-actions` (`FormLayer.tsx:25`). That module
  pulls in compare, file opening and the session. It also imports Base UI's `Tooltip`. **The phone
  must not import `FormLayer.tsx` or `forms/index.ts` as they are.** `forms/index.ts` also imports
  `../annotations` (redaction, image objects, signatures), which `mark/index.ts:128` avoids on
  purpose.

---

## 2. Reuse plan

### Reuse unforked

| Piece | Why it is safe on the phone |
|---|---|
| `forms/form-store.ts` (`useFormStore`, `useSourceFields`, `widgetsOf`, `fieldStops`, `isFillable`) | It imports only zustand, `annotations/edit-runner` (already in the mark chunk), `engine-service` and `create/field-model` (types plus a small mapper). |
| `forms/actions.ts` (`fillField`, `commitFieldValue`, `emptyValue`, `fieldLabel`) | One history entry per fill. Undo, redo, the snapshot, the copy cache and "Changed on this device" all work with no phone code. `create/field-actions` comes along (it imports announcer, workspace-store and create-store, all small). |
| `forms/TickIn.tsx` (`fillAndPaint`, `TickIn`) | The tick motion, the same on both editions (Q-6). It imports `motion` and `viewer/read-controller` (`whenPainted`); check that the phone's `PageCanvas` reports paints to it. If not, the glyph falls back to its hold, which is still fine. |
| `forms/FieldRing.tsx` | The ring around the active field. |
| `forms/FieldEditors.tsx` `TextEditor` and `ChoiceEditor` | The logic (commit-once, revert, comb, maxLength, multiline, native select) can be reused if three small hooks are added: a minimum font on phones like `setMinFieldFontPx`, focus in the same task (`flushSync`) instead of `useEffect`, and a "move" callback so the phone's bar can drive Next and Previous. |
| `viewer/hit-order.ts` | The matrix already says what a press means in each state. The phone layer should read `isLive('form-widget', state)` through `usePageInput`, like `FormLayer`. |
| `forms/navigation.ts` `activeStops`, `moveField` | Reuse the order. `openField` calls `showSurface('page')`, `setMode('select')` and `scrollToPage`, which would disarm a phone tool behind the compact store's back. The phone needs its own open that goes through the bridge and the reader's reveal. Split `openField` into a pure "activate" and a "show" that each edition supplies. |
| `mark/keyboard-hold.ts`, `mark/keyboard.ts`, `TypingBar`'s pattern, `setTyping` | All of the iOS keyboard handling (EDN-12, EDN-17). |

### Phone-specific

1. **`CompactFieldLayer`** in `shell/compact/mark/fields/`:
   - Buttons only: no `EditNotice`, no `Tooltip`, no `home-actions`. Extract the toggle logic from
     `FieldWidget` into a pure `forms/field-press.ts` that both layers call:
     `pressToggle(here, field, placed) → value | undefined`.
   - **Hit targets of at least 44 px** (Q-9), centred on the widget, as `NoteLayer`'s
     `MIN_TARGET = 44` does (`NoteLayer.tsx:27-28`).
   - Where grown targets overlap (radio groups, tight forms), the press goes to the nearest
     widget centre, using the pattern of `text-presets.ts` `boxAt` with `TAP_SLOP`.
   - The drawn ring stays the widget's real box.
2. **When the layer mounts.** It must be live in **reading** (README §4), not only while editing,
   and it must stay off the static path. Add a "reading" flag to the compact overlay slot:
   `registerCompactOverlay(layer, { reading: true })` in `mark-host.ts`, rendered by `CompactPage`
   when the mark chunk has loaded, whether or not editing is on. This costs about 0.2 KB static.
   The chunk is prefetched when the browser is idle (`mark-host.ts:51-64`), so the targets appear
   within seconds of opening. `SelectionHost` is the precedent (EDN-13: "mounted by the edit chunk
   in reading and editing alike").
3. **Live states on phones:**
   - Reading: fill.
   - Editing with the chip off: fill.
   - Pen, Highlight, Text or a placed signature armed: the tool wins, as in the matrix.
   - Edit text armed: no fill.
   - Locked: the field focuses and does not fill. The phone shows a toast, not desktop's notice.
4. **The fill bar** ("Next ›" riding on the keyboard). The phone version of `TypingBar` holds
   ‹ · the field's label and `n / N` · › · Done, at `bottom: --kb-inset`. It replaces Tab and
   Shift+Tab. Done commits and closes. ‹ and › commit and move, holding the keyboard in their own
   press (`onPointerDown` preventDefault, then `flushSync` and focus the next editor in the click).
5. **Reveal and auto-zoom.** The reader needs a "show this rect at a readable size" request:
   - Zoom so the field's text renders at about 16 px or more, capped at 2.5×.
   - Scroll it into the band (`keepInView`).
   - Today `zoomAbout` is private to `CompactReader`'s effect (`CompactReader.tsx:308`). Expose a
     `requestReveal(rect, minPx)` through the compact store or `jump.ts`, so the zoom keeps the
     reader's own settle path.
6. **Copy** in `messages/en.json` and `tr.json` (see §4.5).
7. **Undo in reading:** see §4.1.

### Bundle impact

| Where | What | Size |
|---|---|---|
| Static compact path | The reading-overlay flag in `mark-host.ts` and `CompactPage` | Under 0.3 KB gzip. Fits the 1 % cap. |
| `mark` chunk | The layer, form-store, actions, TickIn, FieldRing and the fill bar | Roughly 6–9 KB gzip, estimated from line counts. `edit-runner` is already there. |
| Separate `fields-editor` chunk | `FieldEditors`, loaded when the first text or choice field is tapped | Under the keyboard hold, the delay is invisible (the EDN-17 pattern). |

Checkboxes and radios need no editor chunk at all. Verify with
`tools/dev/heavy.sh pnpm build`, then `tools/qa/bundle-budget.ts`. The compact gate must not
move.

---

## 3. UX research: phone PDF apps

Sources:

- Web search on 2026-10-14 (links at the end).
- The repo's own survey, `docs/research/phone-2026-10/ux-references.md:75-87,157-188`.
- From memory, marked *(memory)*; verify those on a device.

| App | Tapping a field | Moving between fields | Checkboxes | Notes |
|---|---|---|---|---|
| **Apple Preview on iPhone (iOS 26)** and Files Quick Look Markup | Real fields are tappable straight away and you type at once (ux-references:75). AutoFill offers contact data (ux-references:75). | The system keyboard's ‹ › form assistant *(memory: in WKWebView and PDFKit forms the input accessory shows up and down chevrons and Done)*. | Tap toggles. | A separate "form filling" tool adds text where there is no field. Two tools that both "add text" is the confusion the survey notes. |
| **Adobe Acrobat (iOS)** | Tap a text field and the device keyboard opens ([Adobe help](https://helpx.adobe.com/acrobat/mobile/e-sign-documents/pdf-forms.html), updated June 2026). | **Previous and Next** above the keyboard on iOS, arrows on Android ([Adobe community](https://community.adobe.com/t5/acrobat-reader-mobile-discussions/it-s-easy-to-work-with-pdf-forms-on-acrobat-reader-mobile/td-p/11204109)). Older versions had a "form field mode" that zoomed to each field *(memory)*. | Tap toggles. | Suggests earlier entries (can be turned off). No XFA on mobile. Form JavaScript is limited to calculations, validation and formatting. |
| **PDF Expert (iPhone)** | Tap a field and the keyboard appears; Done to finish ([PDF Expert](https://pdfexpert.com/ios/how-to-fill-pdf)). | Tab and arrows only with a hardware keyboard on iPad. Tapping each field is the documented way on iPhone. | "Tap the appropriate box." | An optional "Highlight form fields" setting. Text, ✓ and ✗ stamps for flat forms. |
| **PDF Reader Pro, PDFgear** | Blue bars mark fillable fields ([PDF Reader Pro](https://pdfreaderpro.com/ios/help/How-to-Fill-out-PDF-Forms-on-iPhone-and-iPad)). Tap to edit. | Tap. | Tap ticks. | PDFgear needs Edit, then Fill & Sign, first ([PDFgear](https://www.pdfgear.com/ios-user-guide/fill-and-sign-pdf-ios.htm)). Reset Form is offered. |
| **Google Drive / Files viewer (Android)** *(memory)* | Fill on tap in Drive's viewer; fields have a tint. | Keyboard IME "Next" moves forward. | Tap toggles. | Save prompts for a copy. |

What the best ones share:

- A field fills on tap with no mode or tool first.
- Checkboxes toggle on tap.
- The keyboard carries ‹ › and Done, so a whole form fills without aiming at tiny boxes.
- An optional tint shows where the fields are.

What the weaker ones get wrong:

- An "Edit → Fill & Sign" mode before you can tick a box (PDFgear, older Acrobat).
- Two separate "add text" tools.
- Aiming at 9 px boxes at fit width.

### Ideas that fit Recto's "radically simple" rule (EDN-7)

1. **A tap fills, in reading. No tool, no mode.** A checkbox or radio ticks with the `TickIn` motion
   on a 44 px target; a text field opens its keyboard in the same tap. This is the README §4
   promise and what Preview and Acrobat do.
2. **The fill bar rides the keyboard:** `‹  Name · 1 / 3  ›   Done`. It is the phone's Tab key and
   turns a form into a flow (Acrobat's Previous and Next, done the way Recto does chrome: one
   small M2 bar, Done lime).
   - Checkboxes and radios are stops too. On a toggle stop the keyboard goes down and the bar
     stays at the bottom: › moves on, and the box shows a "Tap to tick" ring.
   - Choice fields open the iOS picker (native `<select>`).
3. **Auto-zoom to the focused field** (iOS Safari's own zoom-to-input, done properly):
   - The reader zooms so the field's text is about 16 px and keeps it between the top bar and the
     bar.
   - Done zooms back to where you were, like the Contents jump's return.
   - Fixes the 7.5 px text and lets the editor's font match the page.
4. **A "Fill" chip when the document has fields** (owner taste):
   - Shown once per document on the first page that has fields, a small pill above the capsule:
     "3 fields · Fill".
   - A tap starts the flow at the first empty field.
   - It goes away after first use or on scroll, and never comes back for that document.
   - This is the phone's version of "Highlight fields": discoverable without a permanent tint.
5. **A tint while filling.** While the fill bar is up, every fillable widget gets a faint lime
   wash (Recto's light), so the next target is obvious. Off in reading, so pages stay the file's.
6. **Signature fields open Sign** (README §4, EDN-14):
   - A /Sig field, or a created signature placeholder, opens the Sign drawer's options, and the
     chosen signature places into the field's box, fitted to it.
   - Phones do not sign digitally, same as desktop (`forms_signature_not_validated`).
7. **Smart, local hints, not My info** (EDN-3 keeps My info autofill desktop-only):
   - A field whose /AA format is a date (`AFDate_*`), or whose label matches Date or Tarih, offers
     a one-tap **Today** chip in the fill bar. It is computed, nothing is stored.
   - Combo boxes show their options as chips.
   - The iOS contact AutoFill (`autocomplete="name"` or `email`) is the OS's feature, not Recto
     storing data. It is still personal-data autofill, so keep `autoComplete="off"` as today
     unless the owner says otherwise (taste question 3).
8. **Done means done.** A fill made from reading morphs the capsule into the island (tool off), so
   Undo is in its usual place and Done leaves, as ux-references recommendation 4 says ("the bar
   morphs to edit mode on the first change, so Undo is never a toast").

---

## 4. Proposal

### 4.1 States and gestures

| State | What shows | Tap on a field | Other gestures |
|---|---|---|---|
| **Reading** (no edits yet) | The page, the capsule (Pages · n/N · Find) and ✎. Fields have invisible 44 px targets. On the first page with fields, the "3 fields · Fill" chip shows once (if the owner wants it). | **Checkbox or radio:** toggles with `TickIn`, a fill entry, and the capsule morphs to the island (Undo · chip off · Done). **Text field:** the keyboard rises in the same tap; the reader zooms and reveals; enters **Filling**. **Choice field:** the native picker in the tap; enters Filling. **Signature field:** the Sign options open; the chosen signature lands in the field. **Read-only field:** a toast says it is read-only. **Push button:** nothing (inert). | Pinch and double-tap still zoom. A tap off a field toggles the chrome as now. |
| **Filling** (a field editor open) | The island steps away (`setTyping(true)`). The fill bar sits on the keyboard: `‹` · label · `n / N` · `›` · **Done**. The active field has its ring, and all fillable fields a faint wash. | Another field: commit and move. | Done or a tap on empty page: commit and close, the zoom returns, and the island comes back with Undo live. Keyboard dismissal by swipe also commits (blur). |
| **Toggle stop in Filling** (› landed on a checkbox) | No keyboard; the fill bar sits at the screen's foot; the field has its ring and a "Tap to tick" hint. | Tap the box toggles; › moves on. | |
| **Editing**, chip off (Select) | The island. | Same as reading: fields fill. | |
| **Editing**, Pen, Highlight or Text armed | The island. | The tool wins (`hit-order.ts:212-215`): a dot of ink or a text box. Matches the desktop rule. | |
| **Locked** | | A short toast: "This document is locked." No fill. | |

Undo after a fill always lives in the island's leading slot. Leaving with Done flushes the
session as today (`bridge.ts`).

### 4.2 Layout (390×844)

- The fill bar is M2 like the capsule (`mat mat-bar`), 52 px high (`ACCESSORY_HEIGHT`),
  `bottom: max(--kb-inset + 8px, safe-area, 12px)` as in `TextLayer.module.css:15`, 16 px side
  insets.
  - Leading: ‹ and › as 44 px circles.
  - Middle: the label in footnote, truncated, with `n / N` under it in caption.
  - Trailing: lime **Done**, the only "Done" on screen.
- `keyboard.ts` already computes the band above this bar (`read()` with `typing`). The bar reuses
  `data-testid` conventions: `compact-fill-bar`, `compact-fill-next`, `compact-fill-prev`,
  `compact-fill-done`.
- The optional chip is a lit pill above the capsule, like the page pill, with a form glyph and
  "3 fields · Fill".

### 4.3 iOS mechanics (the risks, with the fix for each)

| Risk | Fix |
|---|---|
| The keyboard only rises for a focus inside the tap. | For a text field, call `holdKeyboard(at)` in the target's `pointerup`/`click`, then mount the editor (its own chunk) and let it take the focus; the EDN-17 path. Prefer `flushSync` and a direct focus when the editor chunk is already loaded. Same for ‹ and › in the bar. |
| iOS zooms the page for fonts under 16 px. | The editor is laid out at 16 px or more, scaled back to the widget with a transform (the `setMinFieldFontPx` technique), *and* the reader zooms the field up (§3 idea 3), so the scale-back is small. Never set `maximum-scale` (it breaks accessibility zoom). |
| Safari's own form assistant shows ‹ › and Done above the keyboard for a focused `<input>`. Its arrows move through DOM-order focusables, and with one editor mounted they are greyed out. | Our bar sits just above the keyboard's accessory; that is acceptable. Hand-check whether iOS 26 still shows the assistant row in web content (*(memory)*: it can be hidden only in native apps). If it shows, put the bar's ‹ › on our row and accept the system Done as a second commit path (blur commits). |
| `visualViewport` reports late or `offsetTop` does not reset (WebKit 300523, Apple forums 800125). | Already handled in `keyboard.ts:44-55,135-142`. |
| Native `<select>` on iOS opens a wheel or menu, and blur fires late. | `ChoiceEditor` commits on change for a pointer pick (`FieldEditors.tsx:662-673`). Check that iOS's picker "Done" fires change before blur. |
| Hit targets overlap the text selection's long-press. | The field targets are buttons, so long-press on them must not start a text selection: `-webkit-touch-callout: none; user-select: none` on targets only. |
| A pinch-zoomed reader and fixed bars. | `keyboardInset` already returns 0 under a pinch scale; the reader's zoom is its own, not the browser's. |
| Engine latency on a big form: `listFormFields` per source on open. | Lazy `ensureSource` for pages near the view, as `NoteLayer` caches per page. The store already loads once per source. |
| Same-named fields on several pages. | `reloadSource` invalidates every widget page (`form-store.ts:207-215`). Fine. |
| Forms with JavaScript (calculate, format) and XFA-only forms. | Recto runs no scripts (desktop shows "not run" for buttons). XFA without AcroForm has no targets. Same on phones. |

### 4.4 Implementation steps, in order

1. **Split the shared core out of `FormLayer`** (no behaviour change on desktop):
   - `forms/field-press.ts`: the toggle and edit decisions per kind, pure.
   - `FormLayer.tsx` keeps `EditNotice`, `Tooltip` and `showMarkup`.
   - `forms/navigation.ts`: split `openField` into `activateField(stop)` (store only) and the
     desktop `showField`.
   - `FieldEditors.tsx`: add optional props `minFontPx`, `onMove(direction)` and
     `focusNow` (layout-effect focus), defaulting to today's behaviour.
   - Tests: `forms/forms.test.tsx` stays green; add unit tests for `field-press`.
2. **The reading overlay slot:**
   - `shell/compact/mark-host.ts`: `registerCompactOverlay(layer, { reading?: boolean })`.
   - `shell/compact/CompactPage.tsx:141-145`: render reading layers whenever the chunk is here.
   - Test: `shell/compact/CompactApp.test.tsx` or a new `mark-host.test.ts`.
3. **`shell/compact/mark/fields/FieldLayer.tsx`** (+ `.module.css`), registered from
   `mark/index.ts` with `reading: true`:
   - 44 px targets, nearest-centre resolution, `TickIn`, `FieldRing`, live per `usePageInput`.
   - A fill from reading calls a new `bridge.ts` entry `enterEditingQuietly()`: the island with the
     chip off and no drawer, so Undo appears. Pick its floor *before* the fill.
   - Test: `mark/fields/field-layer.test.tsx` (Vitest browser) on `test/fixtures/forms-a.pdf` and
     the sample:
     - Targets are at least 44 px.
     - A tap on the checkbox commits one "Fill" entry, and Undo removes it.
     - With Pen armed a tap leaves ink, not a fill.
     - Locked: no fill.
4. **The fill flow:**
   - `mark/fields/FillBar.tsx` (the bar, `setTyping`, `keepInView`).
   - `mark/fields/fill-flow.ts` (stops via `activeStops`, next and previous, the keyboard hold
     across moves).
   - A lazy `mark/fields/editor.tsx` that wraps `TextEditor`/`ChoiceEditor` with the phone props.
   - Tests: `mark/fields/fill-flow.test.ts`, pure (order, wrap, skipping read-only, the toggle-stop
     state).
5. **Reveal and zoom:**
   - `shell/compact/compact-store.ts`: a `revealRequest`.
   - `CompactReader.tsx`: honour it through `zoomAbout` and the settle path; return on Done.
   - `reader-layout.ts`: a pure `fieldZoom(rectPt, pageScale, minPx, maxZoom)`.
   - Tests: `reader-layout.test.ts`.
6. **Signature fields:** a press on a /Sig widget or a created placeholder opens Sign's options with
   a pending target rect; the chosen signature places fitted to the rect (`mark/sign.tsx`).
   Closes EDN-14's "waits for forms". Tests: extend `e2e/compact-sign.spec.ts` with a fixture
   that has a /Sig field (none in `test/fixtures/` today; add one through `tools/fixtures/`).
7. **Optional, owner taste:** the "Fill" chip (`mark/fields/FillChip.tsx`, shown once per
   document, kept in `sessionStorage` behind try/catch) and the Today chip.
8. **Copy:** `apps/web/messages/en.json` and `tr.json`, then
   `pnpm --filter @pdf-editor/web i18n`.
9. **The sample for phones (EDN-9)** in `tools/fixtures/sample-fixture.ts`, rebuilt into
   `public/sample/`. It must stay under 125 KB per file (`:75`). Use edition-neutral copy (one
   PDF serves both editions):
   - EN: "Tap or click a field and type. Tap the box to tick it. What you enter belongs to the
     PDF, so it is saved in the file and shows in any reader."
   - TR: "Bir alana dokunun ya da tıklayın ve yazın. İşaretlemek için kutuya dokunun. Girdikleriniz
     PDF’in bir parçasıdır; dosyaya kaydedilir ve her okuyucuda görünür."
   - Signature hint, EN: "Sign here: choose Sign, then tap the box."
   - Signature hint, TR: "Buraya imza atın: İmza’yı seçip kutuya dokunun."
   - Optionally make the checkbox 20 pt and the text fields 32 pt. That is still small at fit
     width, but it shows good form design; the 44 px targets carry the phone either way.
   - Update `sample.test.ts`, `e2e/sample.spec.ts` and the desktop forms tests that read
     `SAMPLE_FIELDS`.
10. **e2e** in a new `e2e/compact-forms.spec.ts`. Add it to `PHONE_SPECS` in
    `playwright.config.ts:37-45`, which also covers `phone-land`. It checks:
    - `?sample`, page 2, a tap on the checkbox ticks it: the `[data-field-name="tried"]` target has
      `aria-checked="true"`, and Undo in the island unticks it.
    - A tap on Name focuses an `input` whose computed font-size is 16 px or more; the fill bar
      shows; › moves to Date, then to the checkbox (toggle stop); Done closes.
    - With a simulated keyboard (the visual viewport shrunk, as in `compact-text.spec.ts`) the
      field stays above the bar.
    - Values survive Done and a reload (`waitForSnapshot`).
    - Share or Save a copy carries the value (parse the copy with pdf-lib, as `forms.spec.ts` does).
    - Run: `RECTO_RENDER_OVERRIDE=1 tools/dev/heavy.sh pnpm build`, then
      `E2E_SKIP_BUILD=1 E2E_PORT=… pnpm exec playwright test compact-forms --project=phone --workers=1`.
11. **Decision row** in `docs/process/decisions.md`, as **EDN-19**: phone form filling — a tap fills
    in reading, 44 px targets, the fill bar, auto-zoom, signature fields open Sign, and the morph
    to the island on the first fill. Also a README §4 note.
12. **The owner's iPhone hand check**, a checklist like `docs/qa/iphone-text-edit-checklist.md`:
    - The keyboard rises in the tap.
    - No Safari zoom.
    - ‹ › keep the keyboard.
    - The iOS form assistant row's interplay with our bar.
    - The `<select>` picker.

### 4.5 Copy suggestions (EN / TR)

| Key | EN | TR |
|---|---|---|
| `compact_fill_bar` (aria) | Form filling | Form doldurma |
| `compact_fill_next` | Next field | Sonraki alan |
| `compact_fill_prev` | Previous field | Önceki alan |
| `compact_fill_count` | {n} of {count} | {n} / {count} |
| `compact_done` (exists) | Done | Bitti |
| `compact_fill_chip` | {count} fields · Fill | {count} alan · Doldur |
| `compact_fill_today` | Today | Bugün |
| `compact_fill_tap_to_tick` | Tap to tick | İşaretlemek için dokunun |
| `compact_fill_read_only` | This field can’t be changed. | Bu alan değiştirilemez. |
| `compact_fill_locked` | This document is locked. | Bu belge kilitli. |

Reuse existing strings where they fit: `forms_fill` ("Fill {name}", the history label),
`forms_radio_option`, `forms_signature_field` and `forms_choose`.

### 4.6 Owner taste questions (at most 3)

1. **What should the first fill from reading do?**
   - (a) Morph the capsule into the edit island (Undo · tool off · Done), so Undo is in its usual
     place. This is the lead's lean, per ux-references recommendation 4.
   - (b) Stay in reading with a 4 s Undo toast, as Highlight from the selection bar does.
2. **Should the "N fields · Fill" chip appear?** A once-per-document pill that starts the
   field-by-field flow. Or only the tap and the bar's ‹ ›, with no chip.
3. **Should iOS's own contact AutoFill be allowed on name and email fields** (OS data, nothing
   stored by Recto)? Or keep it off, in the spirit of EDN-3, until desktop's My info exists?

---

## Sources

- Adobe Help, "PDF Forms in Acrobat on mobile" (updated 12 Jun 2026):
  https://helpx.adobe.com/acrobat/mobile/e-sign-documents/pdf-forms.html
- Adobe Community, "It's easy to work with PDF forms on Acrobat Reader mobile" (Previous/Next on
  iOS, arrows on Android):
  https://community.adobe.com/t5/acrobat-reader-mobile-discussions/it-s-easy-to-work-with-pdf-forms-on-acrobat-reader-mobile/td-p/11204109
- Adobe Community, auto-advance scripts not run on mobile:
  https://community.adobe.com/t5/acrobat-sdk-discussions/go-to-next-fields-javascript-on-mobile-fail/td-p/10627286
- PDF Expert, fill PDF forms on iPhone and iPad: https://pdfexpert.com/ios/how-to-fill-pdf
- Readdle support, Fill and sign PDFs: https://support.readdle.com/pdfexpert/en_US/fill-and-sign-pdfs
- PDF Reader Pro, fill forms on iPhone:
  https://pdfreaderpro.com/ios/help/How-to-Fill-out-PDF-Forms-on-iPhone-and-iPad
- PDFgear iOS guide: https://www.pdfgear.com/ios-user-guide/fill-and-sign-pdf-ios.htm
- The repo's own survey: `docs/research/phone-2026-10/ux-references.md` (Preview on iOS 26, Acrobat,
  PDF Expert rows, and the Jotform and Adobe links at `:239-244`).
- *(memory)* items in §3 and §4.3 are unverified and are to be checked on the owner's iPhone.
