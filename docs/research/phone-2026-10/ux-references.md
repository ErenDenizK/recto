---
title: "Research: phone editing, UX references and web-platform gotchas"
date: 2026-10-11
status: snapshot
---

> Research snapshot for the editable phone edition (M10, EDN-5). It **extends**
> `docs/plan/v1/phone-edition.md` §1 (the 2026-10-09 app table) and
> `docs/research/19-mobile-and-touch.md` §2–3 (HIG, Material 3, browser support). Facts already
> in those two files are not repeated; this file points to them. The owner's brief for this
> round: full minimalism, 2–3 bottom actions, everything else in a pop-up or drawer, and only
> five compact tools: **pen, highlight, add text, edit text, signature**.
>
> Method: web search only. Page fetching was refused by the session's egress policy for every
> site tried (macmost.com, helpx.adobe.com, goodnotes.com), so all web facts come from search
> abstracts. UI details that no abstract states, or that come from older versions, are marked
> _(verify)_: check them on a real phone before a decision rests on them. Repo facts were read
> in `apps/web/src`. No code was changed.

---

## 1. What is new since the 2026-10-09 table

1. **Apple moved signature and text behind "+", and kept it there.** iOS 26 Markup and the new
   iPhone Preview app reach Signature, Text box and Shapes through the **+** button in the
   Markup toolbar. Pens and markers stay on the bar. §1 of the plan said "avoid hiding Sign
   behind +"; Apple's answer is that a + drawer is acceptable for things you do once per
   document. Recto's twist: **Sign also gets a contextual shortcut** (a signature field, or
   "Sign" in the read-mode menu), so the most important phone task is never two levels deep.
2. **Signature flow is the same everywhere:** draw once with a finger on a blank full-screen
   pad, tap Done, the signature lands on the page as one object, **drag to move, pinch or
   corner handle to resize**, two-finger twist to rotate (Markup). Saved signatures (full and
   initials) are offered next time (Preview, Smallpdf, Acrobat).
3. **Adding text is "tap to place, type at once".** PDF Expert: Annotate → Text → tap → type,
   with font, weight, size and colours **in a row on top of the keyboard**, Done saves.
   Acrobat: Text on the bottom toolbar opens an "Add text" mode whose bottom bar shows colour
   and size; an existing text box is edited through a **dialog** (delete, colour, size).
   Preview's form tool highlights real fields in blue and lets you drop a text box where there
   is none.
4. **Formatting lives on the keyboard, not the bar.** iOS 26 Notes shows an adaptive bar above
   the keyboard that changes with the task; Liquid Glass made it a compact rounded capsule.
   The lesson for Recto: while typing, the bottom bar disappears and a **keyboard accessory**
   takes over.
5. **Editing existing PDF text on a phone is a premium, rare feature.** Only PDF Expert
   (paid) and Acrobat (paid) offer it, and neither makes it a bar tool _(verify placement)_.
   Recto already has the kernel (`text-edit/TextEditor.tsx`, one-line field, honesty badge and
   fit choice; `ParagraphEditor.tsx`, hidden `contenteditable` mirror). On a phone it should be
   **contextual**: tap a text line → "Edit text", not a tool you arm.
6. **Users punish extra taps and covering toolbars.** An Acrobat user (July 2025) reports "the
   amount of clicks to do anything has doubled" and that objects can no longer just be grabbed
   and moved. Goodnotes users report the floating toolbar dropping onto the text box it should
   serve, and pen sizes needing an extra tap. Both argue for: objects are always directly
   draggable, and no chrome ever sits on top of the thing being edited.
7. **Horizontally scrolling toolbars are spreading and are a smell.** iOS 26 Notes has 18
   toolbar buttons with a sideways swipe; PDF Expert on iPhone needs a scroll to reach Note.
   Recto's rule P-2 (one row, no scroll) stands.
8. **Edit entry moved to the bottom.** iOS 26 Photos puts Edit in the bottom bar (sliders
   icon) and splits editing into a few sections (Adjust, Filters, Crop, plus Clean Up or
   Markup _(sources disagree)_). Drive keeps Annotate bottom-right. One explicit way in,
   one explicit Done out, is now universal.
9. **Undo placement.** Freeform puts Undo **top-left**, outside the tool bar. PencilKit's
   compact picker has no undo, so apps add their own (research 19 §2.1). Goodnotes uses a
   two-finger **double** tap and users ask for a single tap (Procreate style) or a setting.

---

## 2. Apps → patterns to take or avoid

Bar count is the number of always-visible items in the bottom tool bar on an iPhone-size
screen. Sources are in §6.

| App (2025–26)                                | Bar and secondary tools                                                                                                                                                                                | Text: add / edit                                                                                                                                                   | Signature                                                                                                 | Highlight, draw, undo, modes                                                                         | Take                                                                  | Avoid                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Apple Markup (iOS 26, Files/Photos/Mail)** | Bottom tool picker: pens, marker, eraser, lasso, colour; **+** opens Text, Signature, Shapes, Stickers                                                                                                 | Text box from **+**; edited in place _(verify)_                                                                                                                    | **+** → Signature → finger pad → Done; drag, corner resize, two-finger rotate                             | Freehand marker; Done leaves Markup; two-finger scroll while a tool is armed _(verify, no abstract)_ | + drawer for once-per-document items; one object, direct manipulation | Text and Sign only behind + with no other route             |
| **Preview (new on iPhone, iOS 26)**          | Markup bar as above; separate form-filling tool                                                                                                                                                        | Taps on real fields type at once; form tool adds text where no field exists; AutoFill offers contact data                                                          | Saved list (signature, initials), resize, recolour                                                        | Shapes clean themselves up after drawing                                                             | **Form fields are tappable straight away**; saved signatures          | Two tools that both "add text" (form tool and + Text)       |
| **Photos edit (iOS 26)**                     | Edit button in the bottom bar; 3–4 section tabs; one control per section                                                                                                                               | n/a                                                                                                                                                                | n/a                                                                                                       | Mode with Done/Cancel                                                                                | One button in, Done out; few sections                                 | Disagreeing labels across versions                          |
| **Adobe Acrobat (iOS/Android)**              | Newer UI: bottom "Quick actions" toolbar; tools behind an edit button; Fill & Sign via "E-sign" in the top bar (iPad 2024) _(verify current iPhone)_; AI Assistant on mobile                           | Text on the bottom bar → "Add text" mode, bar shows colour and size; existing box edited in a **dialog**; edit PDF text is paid                                    | Fill & Sign: signature and initials, place and scale                                                      | Comment tools in a bottom strip                                                                      | Text options replace the bar (one level)                              | Layout churn between versions; more taps per action; upsell |
| **PDF Expert (iPhone)**                      | Top-level Annotate / Edit / Fill & Sign; iPhone tool row **scrolls** to reach Note                                                                                                                     | Annotate → Text → tap → type; **font, size, colours above the keyboard**; tap a box → Edit in a pop-up menu, long-press to move; Edit mode changes PDF text (paid) | Fill & Sign tab _(verify flow)_                                                                           | Undo on the toolbar                                                                                  | Keyboard accessory for text formatting                                | Scrolling tool row; three modes                             |
| **Goodnotes 6 (2025)**                       | Floating toolbar on iPad, rearrangeable since late 2025; eraser moved to the main bar; Text tool can be **pinned** to make several boxes                                                               | Text box tool, pinned for repeats                                                                                                                                  | n/a (image or pen)                                                                                        | Two-finger double tap undo, three-finger redo; finger drawing on                                     | Pin a tool for repeats; eraser beside pen                             | Floating bar covering the text box; sizes one tap deeper    |
| **Notability (iPhone, redesign late 2025)**  | Main bar = **Record, Insert menu, secondary tool drawer**; Text-only view hides drawings                                                                                                               | Typing-first on iPhone                                                                                                                                             | Via Insert _(verify)_                                                                                     | Two-finger tap undo                                                                                  | **Bar with 2–3 items plus a drawer** is shipping in a top note app    | Recording (not relevant)                                    |
| **Apple Notes (iOS 26)**                     | Adaptive bar above the keyboard, 18 buttons with sideways swipe; Markup is one of the first six                                                                                                        | Formatting appears on selection                                                                                                                                    | Via Markup                                                                                                | Highlight is a text-format action                                                                    | Toolbar adapts to the task                                            | 18-button scroller                                          |
| **Freeform (iPhone)**                        | Tools in a **bottom** menu (pen, note, shapes, text, media); undo **top-left**                                                                                                                         | Tap a note → its own format bar                                                                                                                                    | n/a                                                                                                       | PencilKit picker                                                                                     | Undo outside the tool bar                                             | Many insert types                                           |
| **Google Drive PDF (Android)**               | Annotate (pen icon) bottom-right → pen, highlighter (sizes, colours), stroke eraser, undo/redo; save to original or copy                                                                               | Newer reports: add text, signature, rotate page _(verify, undated abstract)_                                                                                       | _(verify)_                                                                                                | Freehand highlighter only                                                                            | Save over or save as copy                                             | No highlight-by-selection                                   |
| **Xodo (2026.0.0)**                          | "Streamlined" new toolbar with Classic toggle; Text box, Typewriter, Callout, Sticky note in reach _(desktop; mobile verify)_                                                                          | Typewriter = free text                                                                                                                                             | Xodo Sign (paid)                                                                                          | —                                                                                                    | Offering a classic toggle eases a redesign                            | Five kinds of text tool                                     |
| **Smallpdf (web and app)**                   | Linear task flow: pick file → sign → finish → download                                                                                                                                                 | —                                                                                                                                                                  | Draw or upload, pick colour, place, resize; tap in preview to adjust; **works in Safari with no install** | —                                                                                                    | A web sign flow that already works on iPhone                          | Daily limits, account walls                                 |
| **Readdle Documents**                        | Updated to the iOS 26 look; highlight, comment, underline, strikeout                                                                                                                                   | —                                                                                                                                                                  | —                                                                                                         | Selection-based markup                                                                               | Selection markup without a mode                                       | —                                                           |
| **Microsoft Edge PDF**                       | Desktop: ink, highlight, text notes, add text, fill forms; Android support unclear _(verify)_                                                                                                          | Add text in blank areas (desktop)                                                                                                                                  | Ink only                                                                                                  | Highlight by selection                                                                               | Highlight from the selection menu                                     | No real phone UI                                            |
| **Instagram stories / Edits**                | Full-screen canvas; tool icons on the edge; text tool opens the keyboard at once with style chips and a **colour row above the keyboard**, size on a vertical slider _(established knowledge, verify)_ | Tap Aa → type → tap outside to drop; drag to move, pinch to scale                                                                                                  | n/a                                                                                                       | Draw tool with 3–4 brushes and a size slider                                                         | Type immediately, style above the keyboard, pinch to scale            | Gesture-only actions (drag to trash)                        |

**Common shape:** read view clean → one explicit edit entry → a short bar → a **+ / drawer**
for rarely used items → objects are **placed once and then directly dragged and pinched** →
text styling rides on the keyboard → Done leaves.

---

## 3. Platform patterns for a web app (extends research 19 §2.1–2.2)

| Pattern                  | Native behaviour (2025–26)                                                                                                                                                                                               | Web translation for Recto                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bar minimises on scroll  | iOS 26 `tabBarMinimizeBehavior` (`onScrollDown`, `onScrollUp`, `never`), iPhone only; M3 floating toolbar hides on scroll but **not with TalkBack on**                                                                   | Read mode: collapse to page pill + edit island on scroll down, restore on scroll up or tap. Edit mode: **never** minimise (tools must stay put). Disable hiding when a screen reader is detected through a setting. |
| Tab bar + accessory      | `tabViewBottomAccessory` is a glass capsule above the bar; when minimised it moves inline between the active tab and the separate search button                                                                          | The **options tier** (colours, sizes) is Recto's accessory: a thin capsule above the bar, only for Pen and Highlight.                                                                                               |
| Separate trailing island | iOS 26 detaches Search (`Tab(role: .search)`) into its own circle                                                                                                                                                        | Read mode: the round **✎ island** beside the capsule (as plan §3.5).                                                                                                                                                |
| Floating toolbar + FAB   | M3 Expressive: floating toolbar for contextual actions, may pair with a FAB; **vibrant colour scheme signals a temporary mode such as edit**; don't pair a toolbar with a navigation bar; overflow menu for many actions | Edit mode tints the bar (accent fill on Done or a vibrant bar) so the mode is obvious without a title.                                                                                                              |
| Sheets with detents      | Medium and large detents, grabber, swipe to dismiss, one sheet at a time (research 19)                                                                                                                                   | `CompactSheet` with two detents; the tool drawer is a **medium** sheet that never covers the page fully.                                                                                                            |
| Targets                  | 44 pt (Apple), 48 dp (Material)                                                                                                                                                                                          | 44 px minimum, 48 px for the three bar actions.                                                                                                                                                                     |
| Haptics                  | System haptics                                                                                                                                                                                                           | iOS web: none except a direct tap on a switch input; Android: `navigator.vibrate(8–12)` on snap and place (research 19 §3.4). Use a visual pulse as the universal substitute.                                       |
| Keyboard avoidance       | Native views lift above the keyboard                                                                                                                                                                                     | iOS: one `visualViewport` listener → `--kb-inset`; Android: `interactive-widget=resizes-content` (already set). See §5.                                                                                             |

---

## 4. Three candidate architectures

All three share: read mode is today's compact reader; editing code loads lazily on first use
(plan P-1); objects already on the page are always directly draggable (tap selects, drag
moves, corner scales, long-press shows Delete/Colour); a stylus draws at once from any mode
(research 19 §2.1, Apple Pencil); one finger draws only while Pen or Highlight is armed, and
two fingers always pan and zoom.

### A. "Edit island + tool drawer" (three-slot bar)

- **Read mode bar:** capsule `[Pages · 3 / 12]` and the round `(✎)` island. Two actions. Find,
  Share, Info move into the title's ⋯ menu.
- **Edit mode bar (three slots):** `[↶ Undo]  [● Pen ▾]  [✓ Done]`. The middle slot is the
  **current tool chip**; tapping it again toggles the tool off (back to "hand": one finger
  scrolls), tapping the ▾ part (or a long press, or swipe up) opens the **tool drawer**, a
  medium sheet with five large tiles: **Pen, Highlight, Text, Sign, Edit text**, plus Redo and
  Eraser as small buttons. The drawer remembers the last tool, so the second session is one
  tap.
- **Options tier** above the bar only for Pen and Highlight: 3 colours, 3 sizes, eraser toggle
  (plan §3.5).
- **Text:** pick Text → tap the page → a box appears and the keyboard opens in the same tap.
  The bar hides; a keyboard accessory shows `[A− A+] [● colour] [✓]`. Tap outside or ✓ to
  drop. Box stays draggable.
- **Edit text:** pick Edit text → text runs get a faint outline → tap one → the existing
  one-line editor opens docked above the keyboard (honesty badge as a chip), page scrolled so
  the line sits just above it. Enter or ✓ commits one history step.
- **Sign:** pick Sign → sheet with saved signatures and **Draw new** (full-width pad,
  landscape suggested) → the signature drops at the tapped point, the signature field, or the
  centre of the visible page → drag, corner scale → Done.
- **Undo:** always the left slot; Redo appears as a small chip beside it for 4 s after an undo
  and lives in the drawer. Two-finger tap = undo as a bonus.
- **Done:** right slot, tinted; leaves to read mode, snapshot saved, no dialog.
- _Pros:_ exactly the owner's "2–3 actions + drawer"; one bar shape for every tool; Pen
  (the most repeated tool) is one tap after the first use; scales if a sixth tool comes.
- _Cons:_ first use of any tool costs two taps (✎, then drawer); the tool chip must clearly
  read as a button that opens something.

### B. "Three verbs" (no generic edit mode)

- **Read mode bar:** `[Draw] [Sign] [⋯]` with the page number as a floating pill above.
  Three actions, each a verb.
- **Draw** enters a markup mode whose bar is `[↶] [Pen | Highlighter | Eraser] [✓]` (a
  segmented control in the middle).
- **Sign** goes straight to the signature sheet and placement, then back to read mode.
- **Text** is fully contextual in read mode: long-press on PDF text → selection bar
  `Highlight · Edit text · Copy`; tap on empty page space → a small pop-up `Add text here`.
  Form fields type on tap.
- _Pros:_ the two top phone jobs (sign, mark up) are one tap from read mode; no drawer at all;
  highlight-by-selection needs no mode.
- _Cons:_ "Add text" via tap-on-empty is undiscoverable and collides with "tap toggles the
  chrome"; ⋯ becomes a junk drawer (Pages, Find, Share, Info); three read-mode buttons are
  always visible, which is less calm than A; the read bar no longer hides to a single pill.

### C. "Context first, + for the rest" (most automated)

- **Read mode bar:** `[Pages · 3 / 12]` and a round `(+)`. Two actions.
- **Automation does most work:** tap a form field → type (keyboard accessory steps fields);
  tap a signature field → Sign sheet; long-press text → `Highlight · Edit text · Copy`; a
  stylus touching the page draws with the last pen.
- **+** opens a small pop-up menu: **Draw, Text, Signature**. Draw enters a mode with the bar
  `[↶] [colour dot] [✓]`; Text and Signature place one object and return to read mode.
- _Pros:_ fewest controls; mirrors iOS 26 Markup's + menu, which iPhone users now know;
  forms and signatures "just happen".
- _Cons:_ the plus menu mixes "a mode" (Draw) with "an object" (Text, Signature); edit-text
  depends on users discovering long-press; undo exists only inside Draw mode or as a toast
  after a one-shot action, so undo is not always in the same place (breaks plan principle 6).

### Recommendation: A, with C's automations

Build **A** as the frame and bolt on C's contextual shortcuts so the common jobs skip the
drawer:

1. Read mode keeps **two** bottom actions (page pill, ✎ island).
2. Edit mode keeps **three** (Undo, tool chip, Done). Everything else is in the drawer.
3. Shortcuts that bypass the drawer: long-press text → `Highlight · Edit text · Copy` (works in
   read mode, enters edit mode on use); tap a form field → type; tap a signature field or ⋯ →
   "Sign" → sign sheet; stylus → draws.
4. Undo is always the left slot whenever anything has changed, also right after a contextual
   action (the bar morphs to edit mode on the first change, so Undo is never a toast).

Why A over B and C: it is the only one where the bar has the same three slots in every tool
state, so undo and Done never move; it matches the shipping Notability iPhone bar (main
actions + drawer) and Acrobat's "tool options replace the bar"; and the drawer absorbs any
future tool without a new button. The prior plan's five-tool rail (plan §3.5) and the "two
tools + ＋" idea both collapse into A: the drawer _is_ the rail, folded away.

What needs a prototype with the owner (taste): the drawer as a sheet versus a short pop-up
above the chip; whether the tool chip shows a label or only an icon; whether a stylus may draw
from read mode without ✎ (plan §4 Q5, lean yes).

---

## 5. Web-platform gotchas and mitigations

Support facts not repeated here are in research 19 §3. Items marked (R19) extend that file.

| #   | Gotcha                                                                                                                                                                                                                                                                                                                                                                                                               | Mitigation                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Finger vs Apple Pencil.** Both arrive as pointer events; `pointerType` says `pen` or `touch`. On iPad with Pencil Pro, `pointermove` is sampled more coarsely than `touchmove` (dev forum report), so curves come out as segments.                                                                                                                                                                                 | Use `getCoalescedEvents()` (Safari 18.2+) for ink, already in the pipeline; Safari-only `Touch.touchType === 'stylus'` can gate scroll cancelling for the Pencil only (R19 §3.2).                                                                                                                                                                                                                      |
| 2   | **Page scroll and zoom while drawing.**                                                                                                                                                                                                                                                                                                                                                                              | `touch-action: none` only on the ink layer and only while Pen or Highlight is armed; elsewhere `pan-x pan-y` on the stage and `manipulation` on chrome (R19 §3.3). Never `user-scalable=no`. `preventDefault` on Safari `gesturestart` over the stage.                                                                                                                                                 |
| 3   | **Long-press loupe and callout during strokes.** `-webkit-touch-callout: none` stops the context menu but **not the magnifier**; `user-select: none` stops selection but not the loupe either (WebKit bug 231161). Pencil double-tap can open a zoom window.                                                                                                                                                         | On the armed ink layer, a non-passive `touchstart` listener that calls `preventDefault` (the workaround in that bug), plus tldraw's Pencil double-tap fix (R19 §3.2). Keep `user-select: none` and `-webkit-touch-callout: none` on chrome and the ink layer only, never on the text layer in read mode.                                                                                               |
| 4   | **iOS text-selection menu vs our selection bar.** iOS shows its own edit menu (Copy, Look Up, Share) on a native text selection; a web page cannot remove it _(verify on iOS 26)_.                                                                                                                                                                                                                                   | Place Recto's `Highlight · Edit text · Copy` bar **below** the selection (iOS puts its menu above), or offer the highlight actions after the selection settles via `selectionchange`. Test both on device.                                                                                                                                                                                             |
| 5   | **No keyboard geometry on iOS.** No VirtualKeyboard API and no `keyboard-inset-*` through Safari 26.5; `visualViewport` resize can land only at the end of the keyboard animation; its `scroll` events may fire only when scrolling stops; on iOS 26 `offsetTop` may not return to 0 after the keyboard closes (Apple forums 800125/800154); a few-pixel shift after close on Dynamic Island phones (WebKit 300523). | One `visualViewport` listener writes `--kb-inset`; also update it on `focusin`, `focusout` and `selectionchange` (the svedit approach); after `focusout`, re-read after a frame and clamp `offsetTop` drift; position the accessory by layout (`bottom: var(--kb-inset)`), not per-frame JS. Android: `interactive-widget=resizes-content` already.                                                    |
| 6   | **Focus zoom.** iOS zooms the page when an input with font size under 16 px gets focus.                                                                                                                                                                                                                                                                                                                              | All phone inputs and the edit-text field use **16 px** computed font size; show the PDF's true size through the on-page preview (glyph canvas), not the input's own font.                                                                                                                                                                                                                              |
| 7   | **Keyboard opens only from a gesture.** iOS shows the keyboard only when `focus()` runs synchronously inside the tap handler; after an `await` it does not _(established knowledge, verify on iOS 26)_.                                                                                                                                                                                                              | Create the text box and focus its field in the same `pointerup`/`click`; do engine work (run analysis) after focus, as `TextEditor` already defers `checkEditability`.                                                                                                                                                                                                                                 |
| 8   | **Focus scroll jumps.** iOS scrolls the layout viewport to reveal a focused field, shifting fixed bars; WebKit does not reveal carets inside nested scroll containers; the caret is not kept in view while typing in `contenteditable`/`textarea` (WebKit 191185, open since 2018). Scrolls issued at tap time can corrupt tap placement.                                                                            | Lock the document (`body` does not scroll; the reader scroller owns scrolling); `focus({ preventScroll: true })`; scroll the target line into the visible band ourselves at `selectionchange`, with a short guard against fighting the browser (svedit PR 352).                                                                                                                                        |
| 9   | **Hidden `contenteditable` mirror on iOS.** `ParagraphEditor` types into a hidden mirror; iOS draws the caret, selection handles, autocorrect bubbles and the loupe at the **mirror's** position.                                                                                                                                                                                                                    | On phones, prefer the one-line `TextEditor` field docked above the keyboard (no hidden mirror); if the paragraph editor is used, keep the mirror exactly over the glyphs with transparent text, and set `autocapitalize`, `autocorrect` and `spellcheck` deliberately. Scribble works in editable web fields (R19 §2.1).                                                                               |
| 10  | **Safari 26 floating tab bar** in a browser tab overlays bottom chrome; `env(safe-area-inset-bottom)` covers only the home indicator (R19 §3.1).                                                                                                                                                                                                                                                                     | Size the bar from `visualViewport.height`, keep 8–12 px above the browser's bar, test with the Safari bar expanded and collapsed.                                                                                                                                                                                                                                                                      |
| 11  | **Left-edge swipe** means back in Safari.                                                                                                                                                                                                                                                                                                                                                                            | Nothing interactive in the leftmost 20 px; the Undo slot starts at the safe-area inset + 16 px. In standalone mode there is no browser back, so the top bar keeps an explicit Library back button.                                                                                                                                                                                                     |
| 12  | **Saving on iOS.** `<a download>` and blob downloads are unreliable on iOS Safari (WebKit 167341, 263608). `navigator.share()` needs **transient activation**; files must pass `navigator.canShare({ files })`; cancelling throws `AbortError`.                                                                                                                                                                      | Export first, _then_ show a "Share PDF" button so `share()` runs synchronously in its tap (the export's await would spend the activation). The share sheet offers Save to Files _(verify on iOS 26)_. Fallback: open the blob in a new tab so Safari's PDF viewer can save it _(verify)_. Android: `showSaveFilePicker` (Chrome Android 132, R19 §3.7) or download. No "save in place" on iOS: say so. |
| 13  | **Opening files.** `<input type="file" accept="application/pdf">` must be clicked from a gesture; iOS offers Files and other providers; Android Chrome supports `share_target` for "Share → Recto" (R19 §3.7).                                                                                                                                                                                                       | Keep the existing intake; add `share_target` for Android installs.                                                                                                                                                                                                                                                                                                                                     |
| 14  | **Storage eviction.** In Safari, script-writable storage (IndexedDB, localStorage, service-worker registrations, and by extension OPFS _(verify)_) is cleared after **seven days of Safari use without visiting the site**; days without Safari do not count. Home Screen web apps keep their own counter that resets with use, and Apple called data loss there a bug.                                              | Call `navigator.storage.persist()`; snapshot to OPFS on `visibilitychange: hidden` (R19 §3.6); show an honest line ("Kept on this phone. Share a copy to keep it safe"); suggest Add to Home Screen once after the first edit.                                                                                                                                                                         |
| 15  | **PWA standalone on iOS 26:** any Home Screen site opens as a web app by default (R19 §3.7).                                                                                                                                                                                                                                                                                                                         | Detect `display-mode: standalone` to drop browser-bar allowances; same keyboard rules apply.                                                                                                                                                                                                                                                                                                           |
| 16  | **Haptics:** none on iOS web except a direct tap on a switch input; Android `navigator.vibrate` only (R19 §3.4).                                                                                                                                                                                                                                                                                                     | Visual feedback (a 120 ms scale pulse, a snap line) is primary; Android pulse is extra.                                                                                                                                                                                                                                                                                                                |
| 17  | **Memory:** iOS caps one canvas at 16.7 Mpx and all canvases at roughly 224–384 MB; exceeding it reloads the page with no exception (R19 §3.6).                                                                                                                                                                                                                                                                      | Ink preview canvas at viewport size; signature pad canvas zeroed on close; snapshot before heavy export.                                                                                                                                                                                                                                                                                               |

---

## 6. Sources

Web (all read as search abstracts on 2026-10-11; page fetches were refused by the session
policy):

- Apple Support, Use Markup on iPhone: <https://support.apple.com/en-in/119875>
- Tom's Guide, iPhone built-in signing tool: <https://tomsguide.com/phones/iphones/ditch-the-signature-apps-your-iphone-has-a-hidden-built-in-tool-to-sign-any-document>; Preview in iOS 26: <https://www.tomsguide.com/phones/iphones/ios-26-preview-7-features-to-explore-in-your-iphones-newest-app>, <https://tomsguide.com/phones/iphones/the-new-ios-26-preview-app-has-solved-one-of-my-biggest-problems-with-the-iphone>
- Techloy, signing on iPhone: <https://techloy.com/how-to-sign-a-document-on-iphone>
- MacMost, iPhone Preview in iOS 26: <https://macmost.com/an-introduction-to-the-iphone-preview-app-in-ios-26.html>, <https://macmost.com/10-tips-for-using-the-preview-app-on-your-iphone.html>
- iThinkDiff, Preview edit and sign: <https://www.ithinkdiff.com/edit-sign-pdfs-preview-app-ios26-ipados26/>; iGeeksBlog, Preview: <https://www.igeeksblog.com/how-to-use-preview-app-on-iphone-ipad/>; 9to5Mac, Preview in use: <https://9to5mac.com/2026/03/03/ios-26-adds-new-preview-app-on-iphone-heres-how-im-using-it/>
- Jotform, fill a PDF form on iPhone: <https://www.jotform.com/blog/how-to-fill-out-a-pdf-form-on-iphone/>
- AppleInsider, Photos in iOS 26: <https://appleinsider.com/inside/ios-26/tips/inside-photos-in-ios-26-macos-26----refinements-in-apples-image-and-video-management-tool>; iGeeksBlog, edit photos: <https://www.igeeksblog.com/how-to-edit-photos-on-iphone/>; TechCrunch, Photos tabs: <https://techcrunch.com/2025/06/09/after-user-backlash-apple-brings-back-tabs-to-the-photos-app-in-ios-26/>
- 9to5Mac, Notes in iOS 26: <https://9to5mac.com/2025/10/16/heres-everything-new-for-apple-notes-in-ios-26/>
- iGeeksBlog, Freeform: <https://www.igeeksblog.com/how-to-use-apple-freeform-app/>
- Adobe Help, add text (mobile): <https://helpx.adobe.com/ph_fil/acrobat/mobile/edit-text-images/add-text.html>; Reader iOS new experience: <https://helpx.adobe.com/acrobat/iOS-new-experience.html>; PDF forms on mobile: <https://helpx.adobe.com/acrobat/mobile/e-sign-documents/pdf-forms.html>; Android forms docs: <https://www.adobe.com/devnet-docs/acrobat/android/en/forms.html>; mobile FAQ: <https://helpx.adobe.com/acrobat/mobile-app-faq.html>
- Adobe Community, "Editing in Adobe is the worst" (2025): <https://community.adobe.com/t5/acrobat-reader-mobile-discussions/editing-in-adobe-is-the-worst/m-p/15476322>; Fill & Sign on iPad: <https://community.adobe.com/t5/acrobat-reader-mobile-discussions/adobe-reader-fill-amp-sign-option-on-ipad/m-p/14421766/highlight/true>
- Readdle, PDF Expert add text: <https://support.readdle.com/pdfexpert/en_US/annotate-pdfs/add-text-comments-and-pop-up-notes>; getting started: <https://support.readdle.com/pdfexpert/en_US/annotate-pdfs/getting-started-with-pdf-expert>; Documents App Store: <https://apps.apple.com/US/app/id364901807>; ReaddleDocs release: <https://readdle.com/press/release/3260>
- Goodnotes, December 2025 updates: <https://www.goodnotes.com/blog/features-fixes-updates-december-2025>; toolbar feedback: <https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes/suggestions/50555448-toolbar>; undo gesture requests: <https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes-apple/suggestions/51226636-currently-goodnotes-requires-a-two-finger-double>
- Notability iPhone app: <https://support.gingerlabs.com/hc/en-us/articles/10213191545754-Notability-iPhone-App>
- 9to5Google, Drive PDF annotate: <https://9to5google.com/2023/02/10/google-drive-pdf-annotate/>; Chrome Unboxed, sign in Drive: <https://chromeunboxed.com/you-can-finally-sign-pdfs-with-your-finger-or-a-stylus-directly-inside-google-drive/>; wwwhatsnew (undated, Drive add text/sign): <https://wwwhatsnew.com/tag/archivo-pdf/>
- Xodo 2026.0.0 toolbar: <https://support.apryse.com/support/solutions/articles/35000315891-xodo-pdf-reader-2026-0-0>
- Smallpdf, sign a PDF on iPhone: <https://smallpdf.com/blog/how-to-sign-a-pdf-on-iphone>
- Microsoft Learn, Edge PDF reader: <https://learn.microsoft.com/deployedge/microsoft-edge-pdf>
- Instagram Edits updates: <https://www.socialmediatoday.com/news/edits-gets-custom-captions-effects-color-correction/804699/>
- Tab bar accessory and minimise: <https://www.hackingwithswift.com/quick-start/swiftui/how-to-add-a-tabview-accessory>, <https://www.donnywals.com/exploring-tab-bars-on-ios-26-with-liquid-glass/>, <https://www.createwithswift.com/enhancing-the-tab-bar-with-a-bottom-accessory/>
- 9to5Google, Material 3 Expressive toolbars: <https://9to5google.com/2025/05/18/material-3-expressive-toolbars/>
- svedit PR 352 (iOS keyboard toolbar): <https://github.com/michael/svedit/pull/352>; Apple forums on `visualViewport.offsetTop`: <https://developer.apple.com/forums/thread/800125>, <https://developer.apple.com/forums/thread/800154>; WebKit bugs 300523, 191185, 231161, 167341, 263608: <https://bugs.webkit.org/show_bug.cgi?id=300523>, <https://bugs.webkit.org/show_bug.cgi?id=191185>, <https://bugs.webkit.org/show_bug.cgi?id=231161>, <https://bugs.webkit.org/show_bug.cgi?id=167341>, <https://bugs.webkit.org/show_bug.cgi?id=263608>; React Spectrum iOS 26 modal shift: <https://github.com/adobe/react-spectrum/issues/9172>
- Apple forums, Pencil Pro pointer sampling: <https://developer.apple.com/forums/thread/776468>
- MDN, `navigator.share()`: <https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share>; W3C Web Share: <https://www.w3.org/TR/2023/REC-web-share-20230530/>; MDN pointer events: <https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Using_Pointer_Events>
- Safari 7-day storage cap and Home Screen counter: <https://mjtsai.com/blog/2020/03/26/safari-13-1-third-party-cookie-blocking-and-7-day-script-writeable-storage/>, <https://www.theregister.com/2020/03/26/apple_relax_were_not_totally/>, <https://bugs.webkit.org/show_bug.cgi?id=211775>

Repo: `docs/plan/v1/phone-edition.md`, `docs/research/19-mobile-and-touch.md`,
`docs/process/decisions.md` (EDN-4, EDN-5), `apps/web/src/text-edit/TextEditor.tsx`,
`apps/web/src/text-edit/ParagraphEditor.tsx`, `apps/web/src/signatures/`,
`apps/web/src/shell/compact/`.
