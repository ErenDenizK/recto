# R12 research track: notes and ink apps

Track: **notes-ink**. Date: 2026-10-09. Scope: iPad handwriting and note apps (GoodNotes 6 / the
unnumbered 2025 "Goodnotes 7" release, Notability 16.x, Apple Notes and Markup on iPadOS 18/26,
Nebo, now called MyScript Notes, Noteshelf 3, CollaNote, Freeform, Muse) and what Recto can take from them.

**Method.** I ran web searches against release notes, help centres, press releases and reviews.
Several help-centre hosts would not resolve from the sandbox, so some facts come from search
snippets of those pages. Each claim links its source. I then checked each idea against Recto's
code and specs so the list does not propose what Recto already has.

**What Recto already has.** Recto already has a strong pen core, so none of this is proposed again:
- **Writing:** pen bursts (one annotation per written word or line), a dry-ink hand-over, coalesced and predicted events.
- **Straight lines and erasing:** hold-to-straighten and Shift 45° snapping. The eraser has Stroke and Partial modes with a size circle.
- **Lasso:** lasso with transform and split.
- **Tool UI:** the ink strip with per-tool recent colours, a log-scale width slider and a colour panel with an eyedropper.
- **Pen handling:** the stroke fade of the palette, the pen-seen rule, the pen hover dot (MK-18), and two-finger and three-finger taps for undo and redo in Markup.

The gaps are the gestures and helpers that make notes apps feel effortless:
- pen gestures (scratch out, circle to select)
- smart shapes beyond a straight line
- writing at a comfortable size (zoom window)
- study and presenting tools (tape, laser)
- ink understanding (convert, tidy)
- time (audio-synced replay)

---

## 1. GoodNotes 6 → the 2025 release ("Goodnotes 7")

- **Pen gestures (since GoodNotes 6, 2023).**
  - **Scribble to Erase:** scribble over ink with the pen to delete it, without switching tools.
  - **Circle to Lasso:** draw a loop around content to select it, still with the pen
    ([GoodNotes 6 launch](https://goodnotes.com/blog/introducing-goodnotes-6),
    [TechCrunch](https://techcrunch.com/2023/08/09/goodnotes-biggest-update-in-four-years-brings-ai-powered-handwriting-features-and-a-digital-marketplace)).
  - The 2025 Android notes list Circle to Lasso again, plus **"change shapes of existing
    strokes"**, dotted and dashed lines, and copy and paste of a page
    ([changelog via APKMirror](https://www.apkmirror.com/?p=7194356)).
- **Eraser.**
  - **Three styles:** Precision (only what is inside the circle), Standard (a short segment) and Stroke (the whole stroke).
  - **Auto-Deselect:** the tool returns to the last tool when the stylus lifts.
  - **Erase Filter:** toggles for Pen, Pencil, Highlighter and Tape.
  - **Clear Page.**
  - Source: [GoodNotes help: Erasing content](https://support.goodnotes.com/hc/en-us/articles/7353718249231).
- **Zoom Window.**
  - A magnified writing strip docked at the bottom. A box on the page shows which region it writes into.
  - **Auto Advance:** once the pen crosses the middle of the window, a blue area appears. Writing in it moves the box forward, and at the end of a line it drops to the next line.
  - Users asked for:
    - a toggle in the window itself
    - a movable advance zone for left-handers
  - Sources: [GoodNotes help](https://support.goodnotes.com/hc/en-us/articles/7353756826383),
    [Zoom Window guide](https://goodnotes-team.notion.site/The-Zoom-Window-Tool-717ad56b3bf54d2980229503367beb16),
    [feedback](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes/suggestions/36998023-place-auto-advance-box-towards-the-center-or-right).
- **Apple Pencil Pro (May 2024).**
  - **Palette:** a squeeze opens a palette *at the pen tip*, with tools, undo, thickness and colour.
  - **Dynamic Ink:** barrel roll changes the fountain pen's flow.
  - **Hover preview:** a stroke-width preview shows while the pen hovers.
  - Source: [GoodNotes press](https://goodnotes.com/press/new-features-apple-pencil-pro-palette-dynamic-ink).
- **Writing aids.**
  - **Handwriting spellcheck:** red underlines appear on written words. Tapping a suggestion writes the corrected word *in your handwriting*. It runs on device.
  - **Word Complete** was discontinued on 31 March 2025.
  - **Smart Ink** straightens and aligns handwriting, adjusts spacing and reflows paragraphs.
  - Sources: [Writing Aids](https://goodnotes-team.notion.site/Writing-Aids-74c7ca2d2b194c95b138f430ad0d907f),
    [MacRumors](https://www.macrumors.com/2023/08/09/goodnotes-6-ai-powered-handwriting-spellcheck/),
    [Smart Ink page](https://goodnotes.com/features/tablet-stylus-experience).
- **The September/October 2025 toolbar backlash.** This is a cautionary tale. The new floating toolbar:
  - grouped tools behind extra taps
  - showed six colours instead of eight
  - put the lasso before the pen
  - left the eraser armed after using the lasso
  - covered the writing area

  Users asked for a revert
  ([feedback thread](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes-apple/suggestions/50579222--toolbar-make-the-new-floating-toolbar-optional?page=3),
  [AlternativeTo](https://alternativeto.net/news/2025/10/goodnotes-update-brings-new-plans-ai-features-whiteboards-and-text-documents)).
  Users also complained about:
  - the pen being half a second behind the tip on an M4 iPad
  - a shape tool that turns every freehand shape into a perfect one

  **Lesson:** never hide colours or presets behind grouping, and never make shape conversion unavoidable.

## 2. Notability 16.x

- **Focus Mode.**
  - A four-finger tap, or ⌘⇧F, hides toolbars, panels and menus. One active tool is left, and it can be dragged to any corner.
  - Tapping that tool, or a second four-finger tap, brings everything back.
  - The gesture can be set to None in Settings.
  - Source: [Notability help: Focus Mode](https://support.gingerlabs.com/hc/en-us/articles/11012024558106-Focus-Mode),
    [shortcuts](https://intercom.help/notability/en-us/articles/16300139-keyboard-shortcuts).
- **Audio-synced notes and replay.**
  - Everything written, typed, highlighted or drawn during a recording is linked to it.
  - On playback the ink lights up as the audio reaches it, and tapping a word or a stroke seeks there.
  - There is a scrub control (dragging back slows it) and ±10 s jumps.
  - Source: [U Calgary guide](https://ucalgary.ca/student-services/access/technology/assistive-software-options/ipad-audio),
    [WSU](https://tech.medicine.wsu.edu/technology/digital-notetaking/notability/),
    [Colorado College guide (PDF)](https://www.coloradocollege.edu/offices/accessibilityresources/images/quickstartguides/Notability%20Quick%20Start%20Guide.pdf).
- **Tape tool.**
  - Tape covers a term; a tap reveals it. Students use it for self-quizzing on imported slides.
  - 16.8.1 added 12 tape widths.
  - GoodNotes users ask for "show/hide all tapes at once".
  - Source: [Colorado College guide](https://www.coloradocollege.edu/offices/accessibilityresources/images/quickstartguides/Notability%20Quick%20Start%20Guide.pdf),
    [GoodNotes tape blog](https://www.goodnotes.com/blog/tape-tool-tips-tricks),
    [feedback](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes-apple/suggestions/50543646-tape-update).
- **2026 releases.**
  - A **Calligraphy Pen** whose width follows stroke angle (16.9).
  - Pencil Pro hover and haptics (16.2.1).
  - Improved freehand selection (16.2.3).
  - Source: [Notability update history](https://support.gingerlabs.com/hc/en-us/articles/5293937538586-App-Update-History).
- **Shapes and highlighter.**
  - Draw, then hold to detect a shape.
  - Users report that Notability's eraser takes highlights first.
  - Source: [GoodNotes feedback](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes/suggestions/42292912-erase-highlight-without-having-to-change-a-setting).

## 3. Apple Notes, Markup and Freeform (iPadOS 18 → 26)

- **Smart Script (iPadOS 18).**
  - Handwriting is refined in real time, made "smoother, straighter, more legible" while keeping your style.
  - Scratch out a sentence to delete it.
  - Touch and drag to add space, and the paragraph reflows.
  - Paste typed text in your own handwriting.
  - Auto-refine is a toggle in the tool picker's ⋯ menu.
  - Sources: [Apple newsroom](https://www.apple.com/newsroom/2024/06/ipados-18-introduces-powerful-intelligence-features-and-apps-for-apple-pencil/),
    [MacRumors guide](https://www.macrumors.com/guide/ios-18-notes-app),
    [MacStories review](https://www.macstories.net/stories/ipados-18s-smart-script-a-promising-start-but-dont-toss-your-keyboard-out-yet/).
- **Math Notes.**
  - Write `=` and the answer appears in your handwriting.
  - iPadOS 26 adds 3D graphs and shares Math Notes with Calculator
    ([iGeeksBlog](https://www.igeeksblog.com/how-to-use-math-notes-on-ipad-iphone/)).
- **Reed pen (iPadOS 26).**
  - A calligraphy nib in the PencilKit picker. Double-tap it to choose one of five nib angles.
  - It is available in Notes, Preview, Freeform and Journal, and to every PencilKit app.
  - It is hidden at the left end of the scrolling tool row.
  - Sources: [AppleInsider](https://appleinsider.com/articles/25/06/18/the-ipados-26-reed-pen-tool-is-a-great-calligraphy-addition),
    [TechRadar](https://www.techradar.com/tablets/ipad/ipados-26-public-beta-added-a-new-pencil-tool-and-now-im-obsessed-with-learning-calligraphy),
    [9to5Mac Notes in iOS 26](https://9to5mac.com/2025/07/17/heres-everything-new-for-apple-notes-in-ios-26/).
- **Apple Pencil Pro system behaviour.**
  - Squeeze opens a palette under the tip.
  - Barrel roll rotates shaped nibs.
  - A haptic click confirms a squeeze, a double tap or a shape snap.
  - Source: [GSMArena](https://www.gsmarena.com/apple_pencil_pro_brings_squeeze_and_roll_gestures_haptic_feedback-news-62758.php),
    [Procreate help](https://help.procreate.com/articles/LA4SAi-apple-pencil-pro-procreate).
- **Freeform connectors.**
  - Selecting an item shows four arrows. Dragging one creates a connector, and releasing in empty space offers a shape menu.
  - Dropping the connector on an existing item links the two.
  - Connection points sit at the centre, top, bottom and sides.
  - Source: [Apple Support: Freeform diagrams](https://support.apple.com/guide/freeform/frfm1e6c3d3e/mac).
- **Web limits (important for Recto).**
  - Safari does not expose Pencil hover, squeeze or barrel roll to web pages.
  - A WebKit bug from August 2025 asks for barrel roll as `twist` and for hover.
  - A developer reports that Safari samples `pointermove` from the Pencil Pro at a lower rate than `touchmove`.
  - Sources: [WebKit bug 296943](https://bugs.webkit.org/show_bug.cgi?id=296943),
    [Apple forums](https://developer.apple.com/forums/thread/776468).

## 4. Nebo, now MyScript Notes

- **Gestures.**
  - Scratch out or strike through to erase.
  - A downward vertical stroke breaks a word, line or paragraph; an upward stroke joins them.
  - Underline, strike-through and framing (highlight) are gestures too.
  - Source: [MyScript: pen gestures](https://help.myscript.com/nebo/edit-content/pen-gestures-and-interactions),
    [MyScript Notes](https://help.myscript.com/notes/edit-content/pen-gestures-and-interactions/).
- **On PDFs.**
  - Lasso handwriting, then choose Convert. The result is editable text, and it can be reverted to ink.
  - Hold after drawing to get a perfect shape you can move, resize and rotate.
  - There is a smart highlighter for PDF text.
  - A ruler came in 7.2 (March 2026).
  - It was renamed MyScript Notes in September 2025.
  - Source: [MyScript iOS versions](https://help.myscript.com/notes/versions/ios/),
    [PDF help](https://app-support.myscript.com/support/solutions/articles/16000166993).
- **6.7 (January 2025):** two-finger and three-finger taps for undo and redo.

## 5. Noteshelf 3, CollaNote, Muse

- **Noteshelf 3.**
  - A customisable toolbar (add, remove and reorder tools).
  - A **Zoom Box** that carries its own toolbar, so tools can be switched while zoomed.
  - Coloured, named page bookmarks.
  - Source: [Paperlike review](https://www.paperlike.com/blogs/paperlikers-insights/noteshelf-review),
    [App Store](https://apps.apple.com/us/app/noteshelf-3-digital-notes/id6458735203?l=en).
- **CollaNote.**
  - Free, with 25+ pens.
  - A **laser pointer**, an automatic shape tool, a fill tool, a curve tool, a ruler and a translate tool
  ([Overoptimize](https://overoptimize.substack.com/p/collanote-a-truly-free-note-taking),
  [8bitvoid](https://8bitvoid.substack.com/p/i-tried-note-taking-apps-for-the-iPad)).
- **Muse.**
  - Chromeless by design: "no omnipresent toolbar".
  - The ink toolkit appears only briefly when summoned. Dragging the Pencil in from outside the screen edge opens the handwriting menu.
  - Nearly every action is a gesture.
  - Source: [museapp.com](https://museapp.com),
    [Gigazine review](https://gigazine.net/gsc_news/en/20210124-muse),
    [Muse 1.5 memo](https://allume.com/memos/2021-03-flex-boards/).

---

## Ideas for Recto (ranked)

Ranking weighs novelty in a PDF app, user impact, and fit with Recto's principles: local only,
a calm glass interface, iPad and desktop. Effort is S (days), M (about a week), L (several weeks) or XL.

### 1. Ink gestures: scratch to erase and circle to select (from GoodNotes, Nebo, Apple Smart Script) — Impact 5, Novelty 4, Effort M

**Pattern.** With any pen armed, scribble back and forth over ink to delete it, or draw a loop
and tap inside it to select. You never switch tools.

**Proposal for Recto.** Add a gesture recogniser in `annotations/pen/ink-input.ts` that runs at
release, before the stroke commits.
- **Scratch.** The stroke counts as a scratch when all of these hold:
  - it has at least 4 direction reversals along its main axis
  - its path length is at least 3× the diagonal of its bounding box
  - its bounding box is under about 120 pt
  - it overlaps existing ink, shapes or highlights by at least 30 % of their bounds

  Instead of committing a stroke, it erases what it covers, using the eraser's Stroke rule and the split rule.
  - **Feedback:** the deleted marks dissolve (opacity and blur over 160 ms; none under reduced motion).
  - **Undo:** an Undo toast, and a single history entry ("Erased 3 strokes by scratching").
  - **Exclusion:** the gesture never runs with the Highlighter.
- **Loop.** A stroke counts as a loop when:
  - it is nearly closed (its end is within 12 % of its perimeter from its start)
  - it encloses at least one mark
  - it drew no ink over a mark

  Such a stroke stays as ink, and a small glass **Select** chip appears at its end point for
  1.5 s. Tapping the chip turns the loop into a lasso selection, using the existing `lasso/`
  module. Ignoring the chip keeps the ink.

Both gestures can be turned off in pen settings. Turkish and English labels are needed.

**Browser feasibility.** It is pure geometry on points Recto already collects, with no
dependencies, and it works the same with a mouse. The risks are false positives. The tests
should use real handwriting fixtures: shading, cursive "m" and "w", and loops in letters such as "e", "l" and "o".

### 2. Smart shapes: hold to shape, plus "Make shape" in the lasso (from Apple Notes, Freeform, Notability, Nebo and GoodNotes 2025) — Impact 4, Novelty 3, Effort M

**Proposal.** Extend `straighten.ts`. When the pointer holds still and the stroke is a candidate
shape, the stroke snaps to the shape:
- an ellipse or circle
- a rectangle, square or rounded rectangle (snapped to page axes within 6°)
- a triangle or polygon
- an arrow (a line with a "v" at its end)

The snapped shape follows the pointer until release. It commits as a real PDF annotation, keeping
the stroke's preset colour and width:
- Circle for an ellipse
- Square for a rectangle
- Polygon for a triangle or polygon
- Line with `/LE OpenArrow` for an arrow

Recto's existing 1 px cue becomes a shape "settle": a short scale from 1.03 to 1, standing in for the Pencil Pro haptic.

The lasso's action bar gets **Make shape**, which converts already-drawn strokes after the fact
(GoodNotes 2025). Apply GoodNotes' lesson: never convert without the hold, and undo restores the
freehand stroke.

**Browser feasibility.** Fit the shapes with plain math: corner detection with RDP, then a
least-squares ellipse fit. The annotations are already supported by the engine.

### 3. A writing loupe that follows the PDF's lines, for handwriting at a comfortable size (from GoodNotes Zoom Window and Noteshelf Zoom Box) — Impact 4, Novelty 5, Effort L

**Pattern.** A docked, magnified pad. You write large, and it lands small on the page. It auto-advances along the line.

**Proposal.** A **Loupe** toggle in the ink strip on medium and large classes.
- **Layout.** A glass sheet docked above the capsule shows the region under a frame on the page
  at 2–4×, and its height can be dragged. Strokes written in the pad are mapped into page space
  and committed through the normal pen path, so bursts, dry ink and undo all keep working.
- **What is new for PDFs.** Auto-advance follows the document's real structure, not ruled paper.
  - The frame snaps to the PDF text line or form field under it, using PDFium text rects, which `page-text.ts` already has.
  - When the pen reaches the advance zone, the frame moves along the line, then to the next line or the next empty field.
  - The advance zone mirrors for left-handers.
  - This makes handwriting answers into a worksheet, or filling a scanned form by hand, effortless.
- **Moving the frame.** It can be dragged with a finger. Arrow keys move it on desktop.

**Browser feasibility.**
- The pad canvas reuses the page bitmap cache at a higher scale.
- Pointer mapping is an affine transform.
- No new APIs are needed.

### 4. A tool ring at the pen tip on press-and-hold (the web stand-in for squeeze palettes, from GoodNotes Palette and Apple Pencil Pro) — Impact 4, Novelty 4, Effort M

**Pattern.** Tools appear where the pen already is, not at a toolbar on the edge.

**Proposal.** Pen-down that stays still *before any movement* for 550 ms opens a small glass
radial ring around the tip. Hold-to-straighten deliberately ignores presses held still before
movement, so this gesture is free.
- **Contents:**
  - the four pen presets
  - the eraser
  - the lasso
  - undo
  - colour recents
- **Choosing:** slide out and lift to choose (marking-menu style, like Procreate's QuickMenu), or tap a segment.
- **Also opens with:**
  - the pen's barrel button (`buttons & 2` with `pointerType 'pen'`), on Windows and Wacom
  - right-click with a mouse in Markup
- **Glass:** the ring uses Glass Clear and morphs from a dot to the ring with the spring tokens.

**Browser feasibility.** Pointer events alone are enough. Squeeze is not exposed in Safari, so
press-and-hold is the universal trigger.

### 5. Audio-synced markup: "Record while you annotate" (from Notability) — Impact 4, Novelty 5, Effort L

**Pattern.** Lecture audio is linked to the ink, and tapping a stroke jumps to that moment.

**Proposal.** A **Record** button in the Markup palette's More menu.
- **Recording.** Audio is recorded locally with `MediaRecorder`, as Opus/WebM, or as AAC/MP4 on Safari.
- **Timestamps.** Every annotation created or changed during the recording is stamped. Stamps
  live in the annotation's private data and in a sidecar; for bursts, per path.
- **Playback.**
  - A glass transport rides in the page pill, with play, ±10 s and a scrubber.
  - Marks made after the playhead dim to 25 %; marks being "written" brighten as the audio reaches them.
  - Tapping any mark with Select seeks there.
- **Saving.** The audio and its index are embedded in the PDF as an embedded file. Recto writes
  the attachment, so the file carries its lecture with it. Other readers still show all the ink.

It is privacy-preserving by construction: nothing leaves the device. A later option is local transcription.

**Browser feasibility.**
- `MediaRecorder` is in Chromium, Firefox and Safari 14.1+.
- OPFS holds long recordings.
- PDFium can write file attachments.
- The microphone needs a permission prompt, and it works offline.

### 6. Tidy handwriting: straighten, align to the text line, even spacing (from Apple Smart Script auto-refine and GoodNotes Smart Ink) — Impact 3, Novelty 5, Effort M

**Proposal.** A lasso action **Tidy**, and an optional "Tidy as you write" switch that runs when a burst closes.
- **Geometry.** For a burst (one word or line):
  1. Estimate the baseline by robust regression through the lowest points of each stroke.
  2. Rotate the burst so the baseline is level, or parallel to the PDF text line underneath when one exists.
  3. Snap its vertical position to sit on that line.
  4. Even the inter-word gaps between connected components to their median.
- **Motion.** The ink eases into place over 220 ms with the "settle" spring, so the change is
  visible and trustworthy, and undo is one step.

No ML is needed. It is deterministic geometry on paths Recto already stores, with per-point widths kept.

**Browser feasibility.** Plain TypeScript. Writing transformed paths reuses `lasso/transform.ts`.

### 7. Ink to text: lasso handwriting, then Convert to text box; handwriting search (from Nebo/MyScript, GoodNotes and Freeform Scribble) — Impact 4, Novelty 3, Effort L

**Proposal.**
- **Convert.** Lasso some ink and choose **Convert to text**. A FreeText annotation replaces the
  ink at the same position and size, in Inter Recto, with **Revert to ink**: the original paths
  are kept in the FreeText's private data until export.
- **Recognition (tiered, all local):**
  1. Chromium's `navigator.createHandwritingRecognizer` where `queryHandwritingRecognizer` reports support (ChromeOS today).
  2. Otherwise, rasterise the ink at 300 dpi and run the existing Tesseract pipeline. It is decent for print-style handwriting, and Recto must say so honestly.
  3. Later, an on-device stroke model in WASM. That is an owner decision, because it is a new dependency.
- **Search.** Find gains "Search handwriting" over the recognised text index, which is never written to the PDF unless the user asks.

**Browser feasibility.** Possible today with the honest-quality caveat. True cursive quality needs a model.

### 8. A calligraphy (reed) pen whose width follows the stroke angle (from the iPadOS 26 reed pen and the Notability 16.9 Calligraphy Pen) — Impact 3, Novelty 3, Effort S

**Proposal.** A new pen preset kind, **Nib**.
- **Width.** Width = w·(|sin(θ_stroke − θ_nib)|·(1−k) + k), computed per point. Recto's ink already stores per-point widths, so this needs no new engine work.
- **Settings.** The preset editor offers five nib angles (0°, 30°, 45°, 60°, 90°), the way Apple does.
- **Pen rotation.** When `PointerEvent.twist` or `altitudeAngle`/`azimuthAngle` is present (Surface or Wacom, and future WebKit), the nib follows the real pen.

It makes signatures and margin notes look beautiful, which is a brand moment for a "calm, crafted" app.

**Browser feasibility.** Only the outline maths in `ink-preview.ts` and `inkOutlineOps` changes. It degrades gracefully without tilt.

### 9. Erase filter, highlights first, and a spring-loaded eraser (from GoodNotes Auto-Deselect and Erase Filter, and Notability) — Impact 4, Novelty 2, Effort S

**Proposal.** The eraser's options in the ink strip gain three things:
- **Erases:** All · Ink · Highlights · Shapes, as a segmented control.
- **Return to pen after erasing**, which also applies to the lasso. This is the auto-deselect behaviour of GoodNotes and of the Pencil's "switch to previous" double-tap.
- **Smart default:** when the eraser circle covers both a highlight and pen ink, the first pass takes the highlight only, as Notability does.

**Desktop.** Holding `E` arms the eraser temporarily and releasing it returns to the previous
tool, a spring-loaded tool in the Figma/Photoshop style. The same applies to `L` for the lasso.

**Browser feasibility.** Trivial. The filter is a predicate in `eraser.ts`.

### 10. Focus: one floating tool puck, chrome gone (from Notability Focus Mode and Muse) — Impact 3, Novelty 3, Effort M

**Proposal.**
- **Entering.** A four-finger tap (touch), ⌘⇧F, or a page-pill menu item collapses the top strip, sidebar, page pill and palette.
- **The puck.** One small glass puck remains: the armed tool's icon and colour dot. It can be dragged to any corner, where it docks magnetically.
- **Using it.** Tapping the puck opens the tool ring (idea 4) in place. Tapping it again, or another four-finger tap, restores the chrome.
- **Motion.** The pieces fly into the puck along their own geometry (Q-5), using View Transitions under 240 ms.
- **Muse touch.** Dragging the pen in from the screen edge (pointerdown within 8 px of the
  viewport edge, then moving inward) temporarily summons the full palette.

**Browser feasibility.** CSS and state only. A four-finger tap needs touch events with
`touches.length === 4`, and iPadOS reserves four- and five-finger *swipes* only when multitasking
gestures are on. A key and a button keep it accessible.

### 11. Tape: cover and reveal, to study any PDF (from Notability, GoodNotes and Drawboard) — Impact 3, Novelty 4, Effort M

**Proposal.** A **Tape** tool in More tools.
- **Placing tape.** Drag over an area, or over a text selection, to lay an opaque tape strip in a
  soft pattern. It is a Square annotation with a Recto `/NM` tag and its own appearance.
- **Revealing.** Tapping peels it with a quick fold animation; tapping again covers.
- **All at once.** "Show all / Cover all" sits in the page menu and Review, which is the feature GoodNotes users ask for.
- **Export.** Tape is kept as Square annotations that other readers show as solid boxes, or it
  can be stripped in Save a copy.

This turns any textbook, slide deck or vocabulary list into flash cards with no account and no upload.

**Browser feasibility.** Existing annotation infrastructure. The reveal state is per session.

### 12. Laser pointer and vanishing ink for presenting and screen sharing (from CollaNote and Notability presentation) — Impact 3, Novelty 3, Effort S

**Proposal.** **Laser** in More tools.
- **The pointer.** A glowing lime dot with a short comet trail follows the pointer.
- **Vanishing ink.** Pressing draws strokes that fade out 1.2 s after release and are never written to the document.
- **Rules.** It never touches history and never needs Markup's change guard, so it works even on a locked file.
- **Use.** Ideal for walking a colleague through a contract over a call.

**Browser feasibility.**
- One overlay canvas.
- `desynchronized` ink.
- No document writes.

### 13. Callout connectors: drag a handle to point a note at something (from Freeform connectors) — Impact 3, Novelty 4, Effort M

**Proposal.** A selected text box or note shows small arrow handles on its four sides.
- **Dragging a handle** to a point on the page turns it into a PDF **FreeText callout** (`/IT /FreeTextCallout` with `/CL` leader points and `/LE`).
- **Snapping.** The leader snaps to the nearest text line or shape it lands on.
- **Into empty space.** Dropping the handle in empty space creates a new text box connected to the first.

This gives Freeform's fluid connect gesture a standards-conformant PDF result that other readers render.

**Browser feasibility.** It needs engine support for writing callout FreeText with an appearance
stream. That is moderate work in the engine layer.

### 14. A hover ghost: what the pen will do before it lands (from GoodNotes hover preview and Apple Pencil hover) — Impact 3, Novelty 4, Effort S

**Proposal.** Extend MK-18's hover dot so that, when hover events exist, it previews the effect
before the pen touches:
- **Highlighter over text:** a translucent bar snapped to the text line it would highlight.
- **Eraser:** the marks under the ring tint red at 30 %.
- **Lasso:** marks under the pointer get a hairline outline.

**Browser feasibility.** It works with the mouse, Wacom and Surface pens on desktop now.
- **iPad.** Safari does not expose Pencil hover to the web yet (WebKit bug 296943), so on iPad it
  appears for mouse or trackpad only. Behind feature detection, it lights up for free when WebKit
  ships hover.
- **Cost.** It reuses the text rects and hit testing.

### 15. Spelling hints for handwritten notes (from GoodNotes handwriting spellcheck) — Impact 2, Novelty 4, Effort L

**Proposal.** This depends on idea 7's recogniser. When it is confident, a misspelt word in a
closed burst gets a dotted underline. Tapping it offers corrections that are inserted *as typed
text* in a FreeText, or, later, as glyph-matched handwriting. It is off by default.

**Browser feasibility.** The quality of the recogniser limits it. Treat it as a later experiment.

### 16. Make room: pull a page edge to add a writing margin (from Apple Notes add-space and Nebo break/join) — Impact 4, Novelty 4, Effort M

**Pattern.** Notes apps let you push content apart to make space. PDFs have no room to write.

**Proposal.**
- **Gesture.** In Markup, dragging a page's right or bottom edge outward (or "Add margin ▸ Right / Bottom / Both" in the page menu) grows the page's MediaBox and CropBox.
- **Live feedback.** A live dimension readout shows during the drag, and it snaps to 25 %, 50 % or a "Letter → Legal" size.
- **Look.** The new area is plain paper, with optional faint ruled lines drawn as a page-level ink background, not baked in.
- **Undo.** One step.

**Browser feasibility.** Recto already resizes pages (`ResizeDialog`, `stage/ResizedContent`).
This is a direct-manipulation front end on that same operation.

### 17. A customisable pen well, without the GoodNotes 2025 mistakes — Impact 3, Novelty 2, Effort S

**Proposal.**
- **Presets.** Let users add up to six pen presets in the well, drag to reorder, and long-press for "Duplicate / Delete".
- **Colours.** Keep every preset's colour visible. Never group presets behind a disclosure.
- **Moving the palette.** Keep "Move tool bar to…" (M11) as the only placement option.

**Browser feasibility.** State and UI only.

### 18. Visible latency honesty: a pen-feel self-test — Impact 2, Novelty 4, Effort S

Users blamed GoodNotes 7 for half a second of lag. Recto can win trust by measuring latency.
- **The test.** A hidden "Pen check" sheet in Settings asks the user to draw a circle. It shows:
  - the measured input-to-paint latency (`event.timeStamp` to the rAF paint)
  - the sample rate, coalesced and predicted
  - whether `desynchronized` is active
- **Reuse.** It uses `ink-stats.ts`, which already exists.
- **Copy.** Include it in a bug report as a copy-to-clipboard block.

**Browser feasibility.** It reuses existing instrumentation.

---

### Not proposed (already in Recto)

- pen bursts, as one annotation per written word or line
- dry ink
- hold-to-straighten and Shift snap
- Partial and Stroke eraser
- lasso split and transform
- per-tool recent colours
- the lens slider and colour panel with eyedropper
- two-finger and three-finger tap undo and redo
- the pen-seen rule and the palette stroke fade

### Cautions from the field

- **Toolbar regroupings anger users.** GoodNotes 2025 grouped its tools behind extra taps and had to answer requests for a revert.
- **Mandatory shape conversion frustrates users.** Recto should never convert a shape without the hold.
- **Ink lag is the first thing users notice.** GoodNotes 7 drew complaints of a half-second delay on an M4 iPad.
- **iPad Safari exposes no hover, squeeze or barrel roll.** Every Pencil-Pro-style idea needs a pointer-event-only trigger, such as press-and-hold.
