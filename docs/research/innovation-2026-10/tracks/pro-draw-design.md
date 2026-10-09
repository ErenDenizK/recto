# Track: pro drawing and design tools

Research date: 2026-10-09. Apps: Procreate 5.4 / Procreate Dreams 2, Affinity (V2 for iPad and the
unified Affinity by Canva 3.0), Figma (UI3, Draw, smart selection), Linearity Curve (Liquid Glass
release), Adobe Fresco 7.x and Illustrator on iPad, Concepts 6.28, Sketch 2025 (Athens, Copenhagen).

Method note: the sandbox's egress policy blocked direct page fetches (help.procreate.com, figma.com,
sketch.com, linearity.io all refused), so the facts below come from search-result extracts of the
official help centres and release notes, cross-checked where two sources disagreed. Each claim links
its source. Things to verify on a device are flagged.

What Recto already has (checked in the repo, so not proposed again): hold-to-straighten and Shift
45 deg lines (`annotations/pen/straighten.ts`), two/three-finger tap undo/redo
(`motion/gesture/multi-finger-tap.ts`), lasso with transform, partial-ink split
(`annotations/lasso/`), pen bursts as one annotation, pen-hover cursor that follows the preset
(`ink-input.ts`), a page eyedropper with a 96 px loupe (`ui/colour/Eyedropper.tsx`), a colour panel
with Grid, Spectrum, Sliders and 12 saved colours, the Slider with a lens knob, stroke fade of the
palette, Focus mode (F), a command palette. Missing: shape recognition beyond the line, any snapping
or alignment guides for annotations and images, a radial menu, an on-screen modifier, distribute or
tidy, select-similar, vector nudge of ink, stroke stabilisation choice, a floating reference view.

---

## Procreate 5.4 and Procreate Dreams 2

- **QuickMenu**: a radial menu of six buttons, any action per button. Invoked by a gesture chosen in
  Gesture Controls (touch-and-hold, a button, a Pencil double tap...). Keep the finger down and drag
  toward a button: the selection happens on lift, so with practice it becomes a directional *flick*
  in muscle memory. Press-and-hold a button to reassign it from a "Set Action" list.
  ([Handbook: QuickMenu](https://help.procreate.com/procreate/handbook/interface-gestures/quickmenu),
  [Procreate insight](https://procreate.com/insight/2020/quickmenu-your-workflow-quick-as-flick))
- **QuickShape**: finish a stroke and hold; the stroke snaps to a line, arc, ellipse, rectangle,
  triangle or polyline. An "Edit Shape" chip then appears at the top to adjust nodes, size and to
  convert an ellipse to a circle; a second finger while holding constrains (perfect circle, 15 deg
  line). ([Procreate 4.2 notes, 9to5Mac](https://9to5mac.com/2018/11/06/procreate-for-ipad-4-2-update/),
  [workflow enhancements](https://procreate.com/insight/2022/workflow-enhancements))
- **Eyedropper**: touch-and-hold anywhere; a loupe whose top half shows the new colour and bottom half
  the current one; lift to keep. Modifier-button + tap as an alternative; Apple Pencil Pro squeeze can
  pick colour. ([Colors interface](https://help.procreate.com/procreate/handbook/colors/colors-interface),
  [Procreate 5.4 at a glance](https://help.procreate.com/articles/Ls9oMu-procreate-5-4-update-at-a-glance))
- **ColorDrop with threshold**: drag the colour well onto the art; keep holding and slide left/right
  to set a fill threshold shown as a bar at the top; lift commits; the last threshold is remembered.
  ([ColorDrop help](https://help.procreate.com/articles/zmlayd-fill-an-area-using-colordrop))
- **Color Harmony**: one wheel with Complementary, Split complementary, Analogous, Triadic, Tetradic;
  linked reticles move together. ([Handbook: Harmony](https://help.procreate.com/procreate/handbook/5.0/colors/colors-harmony))
- **Stabilisation**: per brush StreamLine, Stabilisation (speed dependent) and *Motion filtering*,
  which deletes tremor extremes and is designed for hand tremor (accessibility).
  ([Brush Studio settings](https://help.procreate.com/procreate/handbook/brushes/brush-studio-settings),
  [Beebom guide](https://beebom.com/how-draw-smooth-lines-stroke-stabilization-procreate/amp/))
- **Reference Companion**: a floating, resizable, draggable window showing the live canvas, an
  imported image, or FacePaint. ([Reference Companion](https://help.procreate.com/articles/ZWopfZ-reference))
- **Gestures**: three-finger swipe down opens Cut/Copy/Copy All/Duplicate/Paste; four-finger tap
  hides the whole interface (full screen) and a small indicator brings it back; a quick pinch fits the
  canvas. ([Gestures](https://help.procreate.com/procreate/handbook/interface-gestures/gestures),
  [Copy, paste](https://help.procreate.com/articles/RXHMJm-copy-paste-duplicate))
- **Page Assist**: a PDF import becomes a multi-page artwork with a page strip; exports back to PDF.
  ([Page Assist](https://help.procreate.com/procreate/handbook/page-assist/interface))
- **Procreate Dreams 2 (Dec 2025)**: Compose / Perform / Keyframe modes; a *mini Flipbook* that can be
  moved anywhere; tapping its scrub wheel locks the frame so you scrub, look, and *snap back on
  release*. ([Creative Bloq](https://www.creativebloq.com/art/animation/procreate-dreams-2-makes-the-ipad-animation-app-even-more-powerful-and-versatile),
  [Dreams what's new](https://procreate.com/dreams/whats-new))

## Affinity (Designer/Photo/Publisher 2 for iPad; Affinity by Canva 3.0)

- **Command Controller**: an on-screen radial puck with four keyboard modifiers (Shift, Cmd, Alt,
  Ctrl). Hold-and-drag onto a segment to engage temporarily, or lock one or several on. Shift
  constrains rotation to 15 deg; Cmd-drag duplicates. Long-press the centre to move the puck.
  ([Interface reference](https://affinity.help/designer2ipad/English.lproj/pages/Workspace/interface.html),
  [App Store listing](https://apps.apple.com/us/app/affinity-designer-2-for-ipad/id1616833418))
- **Quick Menu**: a three-finger swipe opens clipboard options plus nine customisable shortcuts.
  Two-finger tap undo, three-finger redo; swipe on the History studio scrubs history in real time.
  ([9to5Mac tips](https://9to5mac.com/2018/07/12/affinity-designer-for-ipad-tips-tricks-video/))
- **Snapping candidates**: snapping considers only "candidate" objects (recently hovered/touched ones,
  or the current layer), shows a yellow node on key points (centres) and geometry; a magnet button
  toggles it. ([Snapping](https://affinity.help/designer2ipad/en-US.lproj/pages/DesignAids/snapping.html))
- **Context toolbar** per tool at the top. **Studios** in 3.0: Vector, Pixel and Layout studios;
  panel setups can be saved, shared and downloaded.
  ([CGPress](https://cgpress.org/archives/canva-reimagines-affinity-studio-and-releases-it-free-to-all-users.html),
  [Quick Grids](https://www.affinity.studio/help/object-control-object-grids/))
- The unified 3.0 app shipped for Mac/Windows on 29 Oct 2025; iPad is announced for 2026.

## Figma (UI3, Draw, smart selection)

- **UI3 lesson**: floating Layers/Properties panels were withdrawn weeks after launch because "the
  canvas felt smaller" and "the gaps were distracting"; floating stays only in *Minimize UI*
  (Shift+\). ([uxdesign.cc](https://uxdesign.cc/figma-scrapes-ui3s-floating-panels-44303803c1ad),
  [Figma blog](https://www.figma.com/blog/our-approach-to-designing-ui3/))
- **Smart selection / Tidy up**: equally spaced objects get pink spacing handles between them; drag
  one to change all gaps (a tooltip shows the value); a pink centre ring lets you drag an item to
  reorder; Tidy up (Ctrl+Opt+T) evens a messy selection.
  ([Smart selection](https://help.figma.com/hc/en-us/articles/360040450233-Arrange-layers-with-Smart-selection))
- **Measure and smart guides**: Option-hover shows red distance lines between the selection and the
  hovered object; while dragging, equal-spacing guides appear and snap.
  ([Measure distances](https://help.figma.com/hc/en-us/articles/360039956974-Measure-distances-between-layers))
- **Scrubby numbers**: hold Option over a numeric field and drag to change it; distance from the
  field changes speed. ([forum answer](https://forum.figma.com/suggest-a-feature-11/type-sizing-with-mouse-dragging-57230))
- **Multiplayer**: cursor chat (/), Spotlight me, follow by clicking an avatar.
  ([Spotlight](https://help.figma.com/hc/en-us/articles/24260248467735-Spotlight-yourself-or-other-presenters))
- **Figma Draw (Config 2025)**: vector brushes (stretch, scatter), variable-width strokes with a width
  profile settable at any point, lasso of nodes, shape builder.
  ([Introducing Figma Draw](https://www.figma.com/blog/introducing-figma-draw/),
  [plugin update 123](https://developers.figma.com/docs/plugins/updates/2026/01/26/version-1-update-123))

## Linearity Curve (2025 Liquid Glass release)

- Two-column **Inspector** on iPad that adapts to the window; content-aware Quick Actions appear only
  for the selection (mask, align, colour). **Auto Trace** converts a selected raster image to vectors
  on device (CoreML) with modes Sketch, Illustration, Photo, Basic shapes. On-device Apple
  Intelligence palette generation and translation.
  ([Liquid Glass post](https://www.linearity.io/blog/linearity-just-got-a-new-look-liquid-glass/),
  [Auto Trace](https://www.linearity.io/academy/curve/ipad/user-guide/images/auto-trace),
  [Node tool colours](https://linearity.io/academy/curve/ipad/user-guide/vector-editing/editing-tools/))

## Adobe Fresco 7.x and Illustrator on iPad

- **Touch Shortcut**: a small circle at the lower left. Hold the centre = primary state (brush becomes
  eraser); slide to the outer ring = secondary state (e.g. trim a vector stroke by crossing it);
  double tap locks it (centre turns blue). Help > Touch Shortcut shows a map per tool.
  ([Fresco UI](https://helpx.adobe.com/fresco/using/getting-started-with-user-interface.html))
- Fresco 7.0 (Oct 2025): reposition individual strokes while keeping proportions; 7.2 (Feb 2026):
  posing pins points automatically when you drag a stroke. Motion presets (bob, breathe, bounce).
  ([What's new](https://helpx.adobe.com/fresco/using/whats-new.html),
  [IT Brief](https://itbrief.com.au/story/adobe-fresco-becomes-free-adds-new-motion-symmetry-tools))
- **Illustrator iPad Repeat**: Radial, Grid and Mirror repeat with on-canvas widgets for count and
  spacing; double tap to edit again.
  ([Adobe how-to](https://helpx.adobe.com/ph_fil/illustrator/how-to/transform-vector-shapes-symmetry.html))

## Concepts 6.28

- **Tool wheel**: ring-based, eight tool slots plus undo/redo, ten docking spots, fades when the pen
  approaches. **Precision** menu: Grid, Snap (to grid / align to grid), Measure, Shape guides.
  **Nudge** pushes strokes into place without redrawing; **Slice** cuts strokes.
  Liquid Glass redesign with softer rounded edges (Oct 2025).
  ([MacStories](https://www.macstories.net/reviews/concepts-for-ipad-an-adaptable-infinite-canvas-to-suit-anyones-needs/),
  [Precision tools](https://concepts.app/en/manual/precision-tools),
  [Nudge](https://concepts.app/en/tutorials/nudge-tool/),
  [iOS 26 update](https://concepts.app/en/event/ios-26-updates))

## Sketch (Athens, Barcelona, Copenhagen 2025)

- Copenhagen (macOS 26 redesign): a toolbar that changes with the selection and the active tool; a
  layer list *focus mode* that shows only the selected layers and their context; a rewritten
  Inspector with floating colour panels and numeric fields you can drag without focusing them;
  multi-paste. Athens: stacks (wrap in Copenhagen), frames and graphics.
  ([Copenhagen changelog](https://www.sketch.com/changelog/copenhagen/),
  [Sketch in 2025](https://www.sketch.com/blog/sketch-in-2025/))

## Web feasibility notes

- Safari on iPadOS dispatches `pointerType: "pen"` and pen hover events (iPad Pro M2+ / Pencil 2 and
  Pro). Barrel roll and squeeze are **not** exposed to the web; tilt during hover is an open WebKit
  gap; pointermove sampling with Pencil Pro was reported lower than touchmove.
  ([WebKit 296943](https://bugs.webkit.org/show_bug.cgi?id=296943),
  [Apple forums 776468](https://developer.apple.com/forums/thread/776468),
  [760238](https://developer.apple.com/forums/thread/760238))
- So anything built on squeeze or barrel roll must have a touch or on-screen equivalent; the ideas
  below avoid them.

---

## Ideas for Recto (ranked)

Score = impact x novelty, tempered by effort. N = novelty in a PDF app (5 = never seen), I = impact.

### 1. Snap to the document: content-aware guides (N5 I5, L)
Signature, text box, stamp, note, image and shape moves snap to what the PDF *contains*, not only to
other marks: text baselines and x-heights (a text box lands on the line), ruled lines and underscores
("Sign here ____"), form-field boxes, table cell edges, page margins and centre. Affinity's
*snapping candidates* rule keeps it calm: only lines within ~1.5 line-heights of the pointer are
candidates, shown as a 1 px lime hairline with a ringed key point, plus a light haptic-like
1 px thickening (the straighten cue already does this). Hold the on-screen modifier or Cmd to bypass.
Feasible: PDFium gives text boxes (Recto already has `page-text.ts`); rules come from a cheap scan of
the rendered bitmap row/column darkness in a worker (horizontal runs > 40 pt). All local.

### 2. QuickShape for markup: draw it, hold, it becomes a real shape (N4 I5, M)
Extend hold-to-straighten: a held stroke is fitted to line, arrow (line + chevron), rectangle,
ellipse/circle, polyline, check mark, cross, bracket or cloud. The result is a *real* PDF Square,
Circle, Line (with /LE arrowhead), PolyLine or Ink annotation, not a bitmap. An "Edit shape" glass
chip appears at the stroke end for 4 s: Circle, Rectangle, Keep as ink. A second finger while holding
constrains (circle, square, 15 deg). Highlighter variant: a held box around a paragraph becomes a
text Highlight of those lines. Feasible: $1/$P recognisers or least-squares ellipse/corner fitting in
TS, < 2 ms per stroke; no dependency needed.

### 3. Flick menu (QuickMenu/marking menu) on the page (N4 I4, M)
A six-slot radial glass menu at the point of contact: desktop = right-button press-drag-release (a
right *click* without drag still opens the page menu); iPad = a two-finger long press or a pen
double-tap-hold on the page in Markup; keyboard = hold Q. Drag toward a slot and lift; experts flick
without the menu ever drawing (menu appears only after 180 ms of stillness, as in marking menus).
Slots default to Highlight, Pen, Text, Note, Sign, Undo; long-press a slot to reassign from the
command registry. Feasible: pure pointer events and the existing gesture arena; the menu is one M2
glass piece with a spring scale-in from the press point.

### 4. Modifier puck for keyboardless iPads (N4 I4, M)
Affinity's Command Controller and Fresco's Touch Shortcut, reduced to Recto's calm: a 44 px glass
disc docked at the screen edge opposite the dominant hand, only in Markup on coarse pointers. Hold
centre = Shift (constrain 45 deg, proportional resize, add to selection); slide to the outer ring =
Alt (duplicate on drag, temporary eraser while drawing); double tap locks (lime ring). A one-line map
of what it does for the armed tool shows while held. Feasible: plain DOM; tools already read Shift
from events, so a `modifiers` store merges the puck state into those reads.

### 5. Floating reference: pin any page or region (N5 I4, M)
Procreate's Reference Companion for documents: "Pin as reference" on a page, a lasso region or a page
of *another* open tab creates a small floating glass window (draggable, resizable, pinch to zoom
inside) that stays while you scroll, fill a form or annotate elsewhere. Typical use: copy numbers from
an invoice into a form; keep a figure visible while reading its discussion pages later. Feasible: a
second render of a cached page bitmap into a canvas; position in the free rect; per-window state.

### 6. Peek-and-return scrub (N5 I4, S)
Procreate Dreams' scrub-lock: press and hold the page pill (or the trailing PageScrubber) and drag to
preview other pages in a large glass peek; release snaps back to where you were. Tap during the peek
to commit the jump. Ideal for "see figure 3 and come back". Feasible: thumbnails already exist; the
peek is a View Transition-free overlay; reduced motion = instant.

### 7. Recolour by dropping a colour (ColorDrop for marks) (N5 I3, S)
Drag a swatch from the ink strip onto a highlight, shape, text box or ink: it recolours that mark.
Keep holding and slide right: the scope grows ("this mark" -> "all marks like it on this page" ->
"in the document"), shown as a small lime bar with the label, the Procreate threshold idea turned
into scope. Drop onto selected text = highlight in that colour. Feasible: existing dnd layer + hit
testing; one undo step via coalesceKey.

### 8. Select similar and smart spacing for marks (N4 I4, M)
Figma's Select matching / smart selection for annotations: "Select similar" (Cmd+Opt+A, and in the
selection bar) picks all marks of the same type and colour on the page or document, then batch edit
colour, opacity, author or delete. For stamps, notes and text boxes that are roughly aligned, show
Figma-style spacing handles and a Tidy button that aligns and evens them; margin note icons get
"Tidy margin notes" into a neat column. Feasible: annotation store queries; geometry only.

### 9. Measure on hover (N4 I3, S)
With a mark or image selected, hold Alt (or the puck's outer ring) and hover another mark or the page
edge: lime distance lines in points/mm (user units), as Figma's Option-hover. Useful for
layout fixes on letters and forms. Feasible: geometry from the store, a single SVG overlay.

### 10. Vectorise a scanned signature (Auto Trace) (N4 I4, M)
Linearity's Auto Trace, for the one image every PDF user has: a photo of a signature. Import ->
threshold with a live slider -> trace to smooth Bezier ink paths -> save as a vector signature that
stays crisp at any zoom and is tiny in the file. Also "Trace" on a pasted logo for stamps. Feasible:
a potrace-like tracer (marching squares + curve fitting) written in TS in a worker; no dependency.

### 11. Nudge ink (soft move with falloff) (N5 I3, M)
Concepts' Nudge and Fresco 7.2's auto-pin posing: a Nudge mode in the lasso/selection tools where
dragging over handwriting pushes nearby points with a soft radius (others stay pinned), to fix a
crossing letter, close a gap in a circle, or move one word's tail without redrawing. Feasible: Ink
paths are point arrays; a Gaussian falloff displacement; commit through the existing ink edit.

### 12. Steady hand: stabilisation and motion filtering per preset (N3 I4, S)
Procreate's three controls, simplified to one "Steady" slider per pen preset (StreamLine-style
lag-smoothing) plus an accessibility toggle "Filter tremor" (motion filtering: drop high-frequency
outliers). Signatures and arrows look intentional; users with tremor can write. Feasible: a
one-euro or lazy-brush filter in `ink-input.ts`; the preview and commit share it as today.

### 13. Repeat a mark across pages (Illustrator Repeat for documents) (N4 I4, M)
Select a stamp, initials, text box or image -> "Repeat on pages..." with an on-canvas widget: all
pages / odd / even / range, same position, or mirrored for facing pages (Mirror repeat for binding
margins). Contracts need initials on every page; reports need a "Draft" mark. Created as linked
annotations so editing one updates all until "Detach". Feasible: model batch op, one undo step.

### 14. Four-finger tap for Focus (N2 I3, S)
Procreate's four-finger tap hides the interface; Recto's multi-finger recogniser already counts
fingers and ignores four. Map four to Focus on/off (viewing and Markup), with the naming toast the
first time. Feasible: one consumer change in `multi-finger-tap.ts`.

### 15. Split-loupe eyedropper and pick-to-match (N3 I2, S)
Recto's loupe already samples page pixels; add Procreate's split disc: top half the colour under the
loupe, bottom half the current colour, so the change is visible before lift. On touch, a hold with a
second finger on the colour well enters the eyedropper (Procreate's modifier+tap). Feasible: CSS
only in `Eyedropper.tsx`.

### 16. Harmony from the document (N4 I3, S)
The colour panel gains a fourth view or a row "From this page": five colours extracted from the
rendered page (k-means on a 64 px thumbnail), plus Procreate-style harmony partners (complementary,
analogous) of the selected one, so a stamp or text box matches the document's brand colour.
Feasible: worker k-means on an existing thumbnail; local.

### 17. Isolate marks (Sketch's layer focus mode) (N3 I3, S)
In the Review panel, a long-press (or Alt-click) on a type or author chip isolates it: every other
mark on the canvas dims to 25 % and does not hit-test, so you can edit only highlights, or only
Ahmet's comments, without disturbing the rest. Esc ends. Feasible: a filter on the annotation layer's
opacity and hit order.

### 18. Scrub numbers in place (N2 I2, S)
Sketch Copenhagen and Figma: numeric fields in the properties sheet (size, opacity, rotation, line
width) scrub with a horizontal drag on their label without taking focus; desktop uses pointer lock so
the cursor never hits the screen edge; Shift = x10. Feasible: Pointer Lock API (desktop); plain drag
on touch.

### Do not copy
- Floating *panels* for properties (Figma withdrew them; Recto's sheets are right).
- Anything gated on Pencil squeeze or barrel roll (not exposed to Safari).
