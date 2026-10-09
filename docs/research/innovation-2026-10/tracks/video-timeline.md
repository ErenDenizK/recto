# Research track: video and audio timelines

**Track:** video-timeline (R12 cross-domain study) · **Date:** 2026-10-09
**Apps:** Final Cut Pro for iPad (2.3) and Mac (12.0), LumaFusion (5.4), DaVinci Resolve for iPad / Resolve 20, CapCut, VN, Logic Pro for iPad (2.2+) and Mac (11.2), with Premiere Pro as the "Adobe pro" reference.

**Method note.** Web search worked, but direct page fetches were blocked by the sandbox's egress policy (support.apple.com, provideocoalition.com, owc.com). The facts below come from search-result extracts of Apple's user guides and release notes, Blackmagic's product pages, LumaTouch's announcement and reviews. Each claim links its source. Where sources disagree or are thin, the text says so.

**What Recto already has (I checked so the ideas below don't repeat it):**

- A History scrubber under ↶ (`apps/web/src/history/`). It shows a list on fine pointers and a 360 × 120 slider on coarse ones. You can preview a step, keep it, or cancel. Previews are throttled to 100 ms. Undo history keeps a 20-step tail in OPFS snapshots.
- A trailing page scrubber thumb for documents over 20 pages (`stage/PageScrubber.tsx`).
- Two-finger tap for Undo and three-finger tap for Redo in Markup (`motion/gesture/multi-finger-tap.ts`).
- A Pages grid with the Photos selection model, pinch to change columns, and dividers for Combine sources.
- Compare as a place, with a Changes list and J/K navigation. The page-map strip was removed in 06.16.
- Outline drag-and-drop. It moves bookmarks only, not pages.
- Lasso for ink.

None of the ideas below rebuilds these. Most of them extend these surfaces.

---

## 1. Final Cut Pro for iPad (2.3, Sept 2025) and Final Cut Pro for Mac (12.0, Jan 2026)

- **Jog wheel.** A collapsible rotary control docked at the screen edge. You open it from the More menu, expand it from the side, and drag its handle to either edge. It has two modes. *Playhead* mode scrubs frame by frame. *Nudge* mode moves a selected edit point, connected clip or keyframe by one frame per detent. Shift-W toggles the mode. Control-Shift-W shows or hides the wheel, and Control-W expands or collapses it. A fast flick spins the playhead toward the end and decelerates. Reviewers say scrubbing with it "feels far more detailed and precise than … a trackpad or mouse". One complaint: it has no Cut button on the wheel itself.
- **Skimmer as a second playhead.** With Apple Pencil hover, or a trackpad, you can skim clips "without ever touching the screen" while the real playhead stays where it is. It must be turned on under Timeline options › Trackpad & Pencil Skimming. Reviewers were split: "a little aggressive" versus "very cool".
- **Live Drawing.** Pencil strokes are recorded as a *Live Drawing clip* on the timeline. On playback they animate with a "draw-on" effect. Seven tools are available (pen, highlighter, pencil, monoline, fountain pen, watercolor, crayon), and pressure needs a Pencil.
- **Lift and replace-with-gap edits.** Version 2.2 (March 2025) added shortcuts for nudging, *replace with gap* and *lift/overwrite*. These are the counterpart to the magnetic ripple: removing a clip leaves a gap instead of closing it.
- **Version 2.3** added a menu bar for iPadOS 26 that exposes all commands and shortcuts. Version 2.2 added portrait orientation.
- **On the Mac:** *Timeline index* (Shift-⌘-2) lists clips, tags and *roles*. Roles are coloured category labels, and turning one off hides those clips from playback and export. *Auditions* stack alternative clips in one slot so you can cycle through them. *Project snapshots* are frozen copies of a project at a point in time. *Transcript Search* (12.0) finds spoken words or related concepts and returns hits with a few seconds of context on each side.

Sources: [Jog wheel guide](https://support.apple.com/guide/final-cut-pro-ipad/make-precise-edits-with-the-jog-wheel-dev06c7d60ae/ipados) · [Keyboard shortcuts](https://support.apple.com/guide/final-cut-pro-ipad/use-keyboard-shortcuts-dev2fb3e1503/ipados) · [Live Drawing](https://support.apple.com/guide/final-cut-pro-ipad/dev49da6afbf/ipados) · [FCP iPad release notes](https://support.apple.com/en-us/102731) · [MacRumors, Sept 2025](https://www.macrumors.com/2025/09/19/final-cut-pro-iphone-17-pro-prores-raw/) · [ProVideo Coalition review](https://www.provideocoalition.com/review-final-cut-pro-for-ipad/) · [MacStories first impressions](https://www.macstories.net/stories/first-impressions-final-cut-pro-for-ipad/) · [T3 on Pencil](https://t3.com/features/final-cut-pro-for-ipad-is-finally-here-and-its-secret-weapon-is-the-apple-pencil) · [Play media / skimming](https://support.apple.com/en-lb/guide/final-cut-pro-ipad/dev0dc51a7ad/ipados) · [Roles and timeline index](https://support.apple.com/guide/final-cut-pro/ver0753c4884/mac) · [FCP Mac release notes (12.0 Transcript Search)](https://support.apple.com/102825) · [Find clips (Transcript)](https://support.apple.com/en-ae/guide/final-cut-pro/ver65764b45/mac)

## 2. LumaFusion (5.4, 2025)

- **Multiselect vocabulary.** Version 2.3 introduced four complementary ways to select:
  1. Select a range with handles in the *timeline navigator* (a mini-map of the whole timeline).
  2. Lasso-select in the timeline.
  3. Tap clips to add them to or remove them from the selection.
  4. Drag several clips at once.

  Selections can be moved, copied, deleted, given attributes, or pasted into another project.
- **Timeline model.** The timeline is both track-based and magnetic. You choose per edit whether it ripples.
- **Version 5.4** added keyboard shortcuts for every timeline action, and all menus now appear in the macOS menu bar. The lesson is that touch-first apps still reach full keyboard and menu parity.

Sources: [LumaTouch announcement](https://luma-touch.com/lumafusion-adds-multiselect-editing-features-and-frame-io-integration-within-the-timeline-in-new-release/) · [No Film School](https://nofilmschool.com/lumafusion-adds-multiselect-editing-version) · [ProVideo Coalition v2.3](https://www.provideocoalition.com/lumafusion-v2-3-new-features-and-deep-integration-with-frame-io/) · [App Store listing](https://apps.apple.com/ly/app/id1062022008)

## 3. DaVinci Resolve for iPad / Resolve 20

- **Source Tape.** Every clip in a bin plays as *one continuous tape*. White bars mark where each clip starts and ends. You scrub one long strip instead of hunting through thumbnails. It now scopes itself to the current folder and the folders below it.
- **Smart indicator.** A timeline marker shows *where the next smart edit will land* before you commit it. It follows the nearest edit point as you scroll. Smart Insert then places the shot there.
- **Boring Detector.** It highlights clips that run longer than a threshold you set, and jump cuts that are too short. It is analysis drawn as an overlay on the timeline.
- **Sync Bin and Close Up.** Sync Bin shows the camera angles that line up with the playhead and lets you cut by tapping one. Close Up reframes a wide shot into a close-up using face detection.
- **Resolve 20 IntelliScript** builds a timeline from a script and puts alternative takes on extra tracks for review.
- **Touch complaints.** Buttons are small. Swipe gestures are "location specific", so they only work on a small part of the screen. Users are steered toward the Speed Editor hardware.

Sources: [Blackmagic Cut page](https://www.blackmagicdesign.com/products/davinciresolve/cut) · [Ripple Training, 16.1 Cut page](https://www.rippletraining.com/blog/davinci-resolve/resolve-16-1-cut-page-enhancements/) · [Videomaker, Boring Detector](https://www.videomaker.com/news/davinci-resolve-16-1-beta-will-tell-you-if-your-video-is-boring/) · [TourBox Cut page tutorial](https://www.tourboxtech.com/en/news/cut-page-davinci-resolve.html) · [Resolve 20 announcement](https://secure.businesswire.com/news/home/20250404998243/en/Blackmagic-Design-Announces-DaVinci-Resolve-20) · [TechRadar review](https://www.techradar.com/pro/software-services/davinci-resolve-for-ipad-review) · [Medium update review](https://medium.com/@mukund.shyam/davinci-resolve-on-ipad-an-update-ab8a571ec387)

## 4. Logic Pro for iPad (2.2+) and Logic Pro for Mac (11.2)

- **Flashback Capture** (iPad 2.2 and Mac 11.2, May 2025). Logic records silently in the background while the transport plays. If you forgot to press Record, one command or control-bar button recovers the performance, MIDI or audio. In Cycle mode it puts several takes in a take folder. The point is that you don't lose work you never meant to save.
- **Quick Swipe Comping.** Open a take folder and *swipe across the part of any take you want*. The comp is built from the swiped sections. Lengthening one section shortens its neighbour, so there is never a gap. Apple suggests duplicating a comp to keep alternates.
- **Pencil double-tap** toggles between *two remembered edit modes*, which Logic stores in two memory slots. It works in Tracks, Live Loops, Editors and the Mixer. Hover is supported on M2+ iPad Pro. Reviewers single out drawing automation curves with the Pencil.
- **Stem Splitter** splits a mixed recording into vocals, drums, bass and other parts, each editable on its own.
- Reviewers call it "touch-first" and say drag-and-drop of patches and loops "works beautifully".

Sources: [Macworld, Flashback Capture](https://www.macworld.com/article/2796556/apple-just-launched-a-new-logic-pro-feature-that-records-even-if-you-forget.html) · [Logic Studio Training, iPad 2.2](https://logicstudiotraining.com/logic-pro-for-ipad-2-2-update/) · [Logic iPad release notes](https://support.apple.com/en-us/101628) · [Logic iPad guide, comping](https://support.apple.com/guide/logicpro-ipad/lpipf8218b82/ipados) · [Use Apple Pencil with Logic Pro for iPad](https://support.apple.com/en-asia/guide/logicpro-ipad/lpip4fee4417/ipados) · [Sound On Sound review](https://www.soundonsound.com/reviews/apple-logic-pro-ipad) · [MusicTech review](https://musictech.com/reviews/digital-audio-workstations/apple-logic-pro-ipad-daw-review/)

## 5. CapCut and VN (mobile)

- **Fixed centre playhead.** The playhead stays in the middle and the timeline slides under it. You swipe until the moment you want meets the line, then pinch for precision. This needs half a viewport of padding at each end. A known problem: a scroll swipe can catch trim handles on dense timelines, so scrolling has to be kept clearly separate from trimming.
- **Contextual bottom toolbar.** Split, Speed and the keyframe diamond appear only when a clip is selected. To remove a keyframe, park on it and tap the diamond again. The toolbar overflows horizontally.
- **VN.** Yellow trim handles, hold-and-drag to reorder, pinch to zoom the timeline, and layers for main footage, B-roll, titles and music.

Sources: [CapCut playhead guide](https://capcutguide.com/capcut-playhead/) · [IMG.LY, Designing a timeline for mobile](https://img.ly/blog/designing-a-timeline-for-mobile-video-editing/) · [Filmora, CapCut timeline settings](https://filmora.wondershare.com/advanced-video-editing/capcut-timeline.html) · [CapCut keyframes guide](https://videowizardtools.com/keyframes-in-capcut/) · [Primal Video, VN tutorial](https://primalvideo.com/video-creation/editing/vn-video-editor-2025-complete-tutorial-for-beginners)

## 6. Premiere Pro (the "Adobe pro" reference)

- **Text-Based Editing.** Cutting or deleting words in the transcript removes those clips and applies a ripple edit automatically. A filter highlights every pause so you can delete them all at once. Selecting text and choosing Insert adds those clips to the sequence.

Sources: [Adobe Help, Text-Based Editing](https://helpx.adobe.com/se/premiere/desktop/edit-projects/edit-video-using-text-based-editing/edit-sequences-using-text-based-editing.html) · [Newsshooter](https://www.newsshooter.com/2023/04/13/adobe-premiere-pro-text-based-editing/)

---

## Patterns that carry over

1. **Precision on glass comes from a control, not from finger accuracy.** The jog wheel and the keyframe diamond replace "hit a 1-frame target" with "turn until it is right".
2. **Preview is separate from commit.** The skimmer and the smart indicator show the result before you act. Recto's History scrubber already does this, so this pattern should extend to more places.
3. **The whole is shown as one strip.** Source Tape and the timeline navigator turn many items into one scrubbable continuum.
4. **Nothing is lost.** Flashback Capture, auditions, snapshots and duplicated comps all keep alternatives instead of overwriting.
5. **Analysis appears as lanes, not dialogs.** Boring Detector, roles and transcript hits are drawn on the timeline.
6. **Several ways to select.** LumaFusion offers handles, lasso, tap-toggle and drag, and you use whichever suits the moment.

---

## Ideas for Recto (ranked)

Ranking weighs novelty in a PDF app first, then impact, then fit with local-only and the calm glass style.

### 1. Flashback: nothing you discard is gone (from Logic Flashback Capture)
Recto quietly keeps what you throw away for 7 days in OPFS:
- documents closed with "Don't save"
- pages deleted
- ink cleared with "Erase all"
- a text edit or form fill that was abandoned
- a redaction applied (the before state, held locally)
- the 21st and older undo steps that fall off the 20-step tail

⌘K "Bring back…" and a *Flashback* row in the Library open a glass sheet that lists them in time order with thumbnails. One tap restores an item as a new tab, or as pages inserted at their old place. A settings toggle and a "Forget now" button stay honest about it. Redaction "befores" are kept only if the user opts in, because keeping them would defeat the point of redacting.

### 2. Swipe to compose two versions (from Logic Quick Swipe Comping)
In Compare, add **Compose**. The A and B pages appear as two takes stacked like a take folder. Swiping across a page, or across a region of a changed page in the Changes list, picks that side for the result. The result track at the top fills in, coloured by source. Export writes the composite. This turns Compare from a report into a merge tool, a "track changes accept/reject" for PDFs that no PDF app has. Version 1 works per page; a later version could work per annotation.

### 3. Fine-tune dial (from the FCP jog wheel)
A glass rotary that docks at the trailing edge, opened from the ⋯ menu or a key. It has two modes:
- **Move.** Nudges the selected annotation, image or text box by 0.5 pt per detent. Holding a modifier rotates it by 1° or scales it by 1%.
- **Step.** Steps through pages, find hits, Changes or history steps.

A flick spins with inertia and decelerates. The value floats above the knob ("+3.5 pt"). Mode switches with a tap on the hub or with Shift-W. It solves precise placement on iPad without zooming to 400%.

### 4. Time strip: a visual, branching history (from timelines, FCP snapshots and Logic comps)
Upgrade the History scrubber popover into a horizontal **time strip** of small thumbnails of the affected page at each step. Each step is tinted by act type:
- ink: lime
- pages: blue
- text: violet
- forms: amber

Undoing and then making a new edit no longer destroys the old future. It becomes a **branch** drawn as a fork that you can step into. A long press on a step offers "Pin as version…" (see idea 5).

### 5. Pinned versions, compared in one tap (from FCP project snapshots)
"Pin this version" names a checkpoint ("Before legal review"). It is stored as a full snapshot in OPFS, so it is not pruned with the 20-step tail. Pins appear as flags on the time strip and in the title menu's Versions list. Any two pins, or a pin and Now, open in Compare. "Save as copy" from a pin writes that state out.

### 6. Edit the outline, move the pages (from Premiere Text-Based Editing)
In the Contents section, add an "arrange by contents" mode. Dragging a bookmark moves *its page range* along with it. Deleting a bookmark offers "Delete these 6 pages" and the rest close up (ripple). Selecting several bookmarks and choosing Extract gives a new document. The outline becomes a script for the document's structure. Today outline drag only moves bookmarks.

### 7. Alternates: auditions for pages and signatures (from FCP Auditions)
A page cell can hold **alternates**: the original scan, the OCR'd version, a re-rendered or cropped version, or a page dropped in with Replace. A small stack badge marks such a cell. You cycle with a swipe on the cell or with ⌥← and ⌥→. Export uses the chosen one. The same model works for stamps and signatures: tap a placed signature to audition your other saved signatures in place.

### 8. Tape: all open documents as one strip (from Resolve Source Tape and the smart indicator)
In the Pages grid, a **Tape** view lays every open document's pages end to end in one horizontal filmstrip, with source dividers (the existing Combine dividers). Scrubbing it shows a large loupe. A lime **insert indicator** in the target document shows where "Insert here" (key `I`) will land before you press it. Building a combined document from five PDFs becomes a scrub-and-tap job.

### 9. Skim with Pencil hover or the pointer, keeping your place (from FCP skimming)
In the thumbnail list, the Pages grid and the page scrubber track, hovering with the Pencil or the mouse shows a **skim loupe**: a large preview of the page under the pointer. The page view does not move, because the skimmer is a second playhead. A tap commits. In Compare, skimming the Changes list previews both sides. On fine pointers it can be turned off.

### 10. Range handles and In/Out marks for pages (from LumaFusion's timeline navigator and pro I/O keys)
On the page scrubber track, or a navigator strip above the Pages grid, two lime **range brackets** select a page range. `I` and `O` set the range start and end at the current page while you read, so "Extract pages 14–22" can be done without the grid. The range shows as a band on the page pill ("14–22"). The Pages bar acts on it.

### 11. Document health lane (from Resolve Boring Detector, FCP roles and markers)
While the page scrubber is dragged, a thin lane beside the thumb shows ticks at pages that have:
- comments
- empty required fields
- find hits
- blank pages
- un-OCR'd scans
- very large images
- different page sizes or rotation

The ticks are tinted by kind. Dragging snaps to ticks. It shows only while scrubbing, so it is calm at rest, which keeps the spirit of 06.16's removal of the page-map strip.

### 12. Roles for marks: show, hide and export by category (from FCP roles and the timeline index)
Marks carry a role: an author, a type (review, personal, signature) or a custom coloured tag. The Review section lists roles with eye toggles. A hidden role disappears from the page *and* from print and export, if the user chooses. "Export a clean copy without my private notes" becomes one switch.

### 13. Lift or ripple when deleting pages (from FCP 2.2 replace-with-gap and lift)
Deleting pages in the grid has two variants. **Delete** closes up, as now. **Lift** leaves a blank placeholder (shortcut ⌥⌫) that keeps page numbers, duplex sides and label ranges intact. Dropping a page onto a placeholder fills it.

### 14. Replay: watch the marks being made (from FCP Live Drawing)
Ink keeps per-point timestamps, in session data and an optional private PieceInfo. **Replay** draws the marks on in the order they were made, at 1×, 2× or 4×, with a little transport. Uses: a teacher showing how they solved a problem, a reviewer walking through feedback, or simply being delighted by it. It could later export as WebM through `MediaRecorder` on the page canvas.

### 15. J/K/L reading shuttle (from pro transport controls)
While reading, L starts a smooth auto-scroll, and pressing it again goes faster (1×, 1.5×, 2×). K pauses and J reverses. On touch, a long press on the page pill reveals a small shuttle. It is useful for reading aloud, rehearsing a presentation and accessibility. It respects `prefers-reduced-motion` by paging instead of scrolling.

### 16. Two-slot tool memory (from Logic's Pencil double-tap)
Recto remembers the last two tools. A tap on the active tool's chip, or the `X` key, swaps between them (for example Pen and Eraser, or Highlighter and Select). This is the double-tap pattern without the hardware event, which Safari does not expose.

### 17. Layers from a page (from Logic Stem Splitter)
"Split page into layers" separates a page into text, images, vector art and annotations using PDFium page objects. Each layer gets an eye toggle and its own export. Examples: hide images to print text only, pull out every image, or remove a background.

### 18. A contextual bar that follows selection (from CapCut, polish)
When one page cell, annotation or image is selected, the capsule shows only the 3–5 verbs that act on it, in the place the eye already rests. The keyframe-diamond rule applies: the same chip toggles on and off. The redesign is already heading this way. The polish is in the strict "verbs for this thing only" rule and in keeping chip order stable across versions.

### Feasibility notes (browser, local)

- **Pencil hover** reaches Safari as `pointerType: 'pen'` pointer events before contact, on hover-capable iPads. The design must not depend on it, so a fallback is needed: long-press-and-slide gives the loupe.
- **Pencil double-tap and squeeze** are not exposed to the web, hence idea 16.
- **Haptics** are not available in iOS Safari. Use a visual detent pulse and a soft tick sound that is off by default.
- **OPFS** storage quota is plentiful, but Flashback and pinned versions must show their size and support "Forget now".
- **Rotary input** is pointer angle math (`atan2`) plus the in-house spring core. Wheel events also drive the dial.
