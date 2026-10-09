# Photo and social apps: what Recto can borrow

Track: photo-social (R12 cross-domain study), 2026-10-09.
Apps: Apple Photos (iOS 18 / iOS 26), Lightroom mobile, VSCO, Darkroom, Halide Mark III,
Instagram (Stories, Edits), Threads, Snapchat, TikTok/CapCut, BeReal.

**Method and limits.** I used web search over release notes, help centres and reviews. Direct page
fetches failed in this sandbox because of DNS errors, so the claims rest on search excerpts. Where a
behaviour comes from general product knowledge and no source here confirms it, the text says
"(unverified)". I checked each proposal against `apps/web/src`. Recto already has a history
scrubber with preview (`history/`), a page scrubber, pinch detent chips, hold-to-straighten pen
lines, an eyedropper and colour panel, saved signatures, batch recipes (`batch/recipes-store.ts`),
Compare as a place, Web Share for Save a copy (`export/save-copy-run.ts`), and an Android-only
detent vibration (`ui/Slider.tsx`). It has none of these yet: snap guides, deskew or rotation by
any angle, Library duplicate detection, copy/paste of markup style, screen recording or replay,
and lifting an object off the page.

---

## Apple Photos (iOS 18 → iOS 26)

- **iOS 26 structure.** Tabs came back (Library and Collections) after the iOS 18 single-scroll
  design drew complaints. The Library is now full-screen, Edit moved to the bottom bar under a
  sliders glyph, and the app took on Liquid Glass styling. The edit tabs are Adjust · Filters
  (Photographic Styles on newer phones) · Crop · Markup.
  ([TechCrunch](https://techcrunch.com/2025/06/09/after-user-backlash-apple-brings-back-tabs-to-the-photos-app-in-ios-26/),
  [Tom's Guide](https://www.tomsguide.com/phones/iphones/ios-26-has-brought-yet-another-photos-app-overhaul-for-your-iphone-heres-how-its-different),
  [Tom's Guide tips](https://www.tomsguide.com/phones/iphones/im-not-a-photo-editor-but-with-the-photos-app-in-ios-26-and-these-6-tips-i-look-like-a-photoshop-pro))
- **Photographic Styles.** Intensity comes from a 2D touch pad (the "square of dots"), and Undo
  returns to the original. One pad sets two values at once (tone and colour).
- **Clean Up (iOS 18.1).** You select with "Tap, brush, or circle what you want to remove", so
  the target can be named three ways. The result is labelled as edited by Clean Up, so the
  edit's history travels with the photo.
  ([Tom's Guide](https://www.tomsguide.com/phones/iphones/how-to-use-clean-up-in-ios-18-with-apple-intelligence),
  [9to5Mac](https://9to5mac.com/ios-18-1-makes-apple-photos-better-in-three-key-ways-heres-whats-new/))
- **Lift subject (since iOS 16).** Touch and hold the subject and a glowing white outline traces
  it. Release for Copy or Share, or keep holding and drag it into another app. The gesture works
  across the system, including Files and Mail. Google Photos copied it in August 2025.
  ([MacMost](https://macmost.com/lift-the-subject-from-the-background-of-a-photo-in-ios-16.html),
  [Trusted Reviews](https://www.trustedreviews.com/how-to/how-to-lift-a-subject-from-the-background-in-photos-in-ios-16-4266810),
  [Android Authority](https://www.androidauthority.com/google-photos-lift-subjects-create-stickers-3590746/))
- **Customize & Reorder, Pinned Collections, Utilities → Duplicates → Merge.** Users choose which
  collections appear and in what order. Duplicates are found on the device and merged in one tap.
  ([MacRumors](https://www.macrumors.com/guide/ios-18-photos/))
- **Editing gestures (unverified details).** Press and hold the photo to see the original. The
  crop view has a straighten ruler: a horizontal tick dial with a centre detent, where the iPhone
  taps at 0°.

## Lightroom mobile

- **Hold to compare.** "Select and hold the photo" shows the edit before and after. A
  two-finger hold on a slider shows clipping: the screen turns black and only the clipped areas
  show. ([Adobe gestures](https://helpx.adobe.com/ee/lightroom/mobile/get-started/gesture-controls-in-lightroom-for-mobile.html),
  [Lightroom Killer Tips](https://lightroomkillertips.com/lightroom-mobile-tip-seeing-and-fixing-highlight-clipping-problems/))
- **Versions.** Auto versions are saved when you leave Edit. Named versions are ones you create.
  To return to one, open the clock icon, pick a version and tap Apply. Lightroom has no step
  history, and users have asked for one for years.
  ([Adobe Learn](https://www.adobe.com/learn/lightroom-cc/web/compare-photo-edits-lightroom-mobile?ntd=1),
  [community request](https://community.adobe.com/t5/lightroom-ecosystem-cloud-based-ideas/p-view-editing-history/idi-p/10883571))
- **Adaptive presets and the Amount slider.** One tap applies a preset. Tapping the thumbnail
  again reveals an Amount slider that softens or strengthens the preset. The preset analyses up to
  eight regions of the scene and builds masks you can then edit.
  ([Adobe Learn](https://www.adobe.com/learn/lightroom-cc/web/adaptive-landscape-presets-lightroom-mobile),
  [Adobe presets guide](https://helpx.adobe.com/lightroom-cc/using/presets-lightroom-ios.html))
- **Quick Actions (2025).** These are one-tap jobs (Auto, Subject or Sky mask, Retouch a chosen
  person). They reached iPad in December 2025.
  ([Adobe release notes](https://helpx.adobe.com/lightroom-cc/using/whats-new/release-notes.html),
  [Adobe community](https://community.adobe.com/announcements-678/lightroom-desktop-8-3-lightroom-mobile-10-3-are-here-straight-from-max-london-907569))

## VSCO

- **Recipes.** A Recipe saves an edit stack (a preset plus tools). Crop and straighten are left
  out on purpose because they belong to one photo. Applying a Recipe is one tap, and you can keep
  adjusting afterwards.
- **Copy Edit / Paste Edit.** You pick the targets, which get a green border. The paste replaces
  their edits and does not link back to the source. The web Studio supports Shift-range
  selection and an "Isolate" view of only the selected photos.
  ([VSCO Recipes](https://www.vsco.co/features/recipes),
  [Digital Trends](https://www.digitaltrends.com/?p=1270982),
  [Droid Life](https://droid-life.com/?p=163128))
- **2025.** Bloom and Halation effects were added, along with Canvas (mood boards) and Capture.
  ([VSCO 2025 recap](https://vsco.co/vsco/journal/what-we-built-together-in-2025))

## Darkroom

- **Flag and reject.** A swipe on the editing toolbar reveals the Review actions, and each tap
  moves on to the next photo. A horizontal swipe on any image starts a batch selection. The
  2025 release notes still fix these gestures, which suggests they remain central.
  ([MacStories](https://www.macstories.net/reviews/darkroom-5-2-improves-photo-management-with-new-flag-and-reject-functionality),
  [Darkroom release history](https://darkroom.co/updates/six))
- **Region curves.** The curve is split into five bands. You drag vertically inside a band, or
  tap above or below the line, and never place a control point. The brief was finger-friendly,
  one-handed use with every extra tap removed.
  ([iPhone Photography School](https://iphonephotographyschool.com/darkroom-app/),
  [Apple Design Awards](https://apps.apple.com/story/id1521324925))

## Halide Mark III (May 2026)

- The interface was rebuilt around composition and influenced by Liquid Glass. Aspect ratios
  sit in the main toolbar, and a composition overlay offers thirds, a grid, the golden ratio
  and rabatment. Users can switch back to the classic interface. Rarely used manual settings
  moved into simpler menus.
- **Photo Lab Quick Edit.** You can "audition different looks" within seconds. Looks are
  Valencia, Rembrandt, Nova, Zephyr and Chroma Noir, and their film parts (grain, halation) can be
  turned off one by one.
  ([9to5Mac](https://9to5mac.com/2026/05/27/halide-mark-iii-pro-camera-for-iphone-arrives-with-three-key-photography-upgrades/),
  [Engadget](https://engadget.com/2182499/halide-mark-iii-adds-a-built-in-editor-to-the-popular-camera-app),
  [Halide changelog](https://www.lux.camera/halide-changelog),
  [MacMagazine](https://macmagazine.com.br/post/2026/05/27/halide-mark-iii-chega-com-novo-conjunto-de-presets-visual-repaginado-e-mais/))

## Instagram (Stories, Edits) and Threads

- **Stories.** A two-finger pinch resizes and rotates text in one gesture. Tap and hold pins
  text to a moment of a video by scrubbing a slider at the bottom. Dragging a sticker shows a
  trash well at the bottom edge, and dropping it there deletes the sticker (unverified in
  sources, well known).
  ([Instagram Help](https://help.Instagram.com/314684928883274),
  [Sked Social](https://skedsocial.com/blog/instagram-story-editor.md))
- **Edits (2025–2026).** A frame-accurate multi-track timeline with layers for text, stickers,
  overlays and cutouts. Keyframes arrived in June 2025 and later covered text and stickers.
  Cutout removes the background after recording.
  ([Social Media Today](https://www.socialmediatoday.com/news/instagram-adds-new-features-edits-app-keyframes/751543/),
  [NapoleonCat](https://napoleoncat.com/blog/instagram-edits/),
  [Buffer](https://buffer.com/resources/how-to-use-instagram-edits/))
- **Threads drafts.** Swipe the composer down and the draft is saved. The compose glyph in the
  tab bar then changes to show that a draft is waiting.
  ([9to5Mac](https://9to5mac.com/2024/02/22/threads-camera-save-drafts/),
  [Social Media Today](https://www.socialmediatoday.com/news/threads-makes-drafts-and-in-stream-camera-available-to-all-users/709652/))

## Snapchat, TikTok/CapCut, BeReal

- **Snapchat.** Lenses sit in a carousel at the bottom of the camera. After capture, swiping
  sideways over the snap cycles filters, and filters can be stacked. UX critics say lenses
  cannot be reordered or favourited.
  ([UX Collective](https://uxdesign.cc/how-to-improve-the-snapchat-navigation-fb9d3786ba2a),
  [iMore](https://www.imore.com/snapchats-newest-secrets))
- **TikTok / CapCut.** The most-used AI features were Auto captions, AutoCut, Voice filter and
  text-to-speech. AI Alive output carries a C2PA label, a provenance stamp built into the
  feature itself.
  ([CapCut review](https://marcandrews.com/?p=3063),
  [AI Alive guide](https://forcreativegirls.com/use-tiktoks-ai-alive-to-create-video-content-without-lifting-a-finger-to-edit/))
- **BeReal.** The design is honest by construction. Late posts are labelled with how late they
  were, and retakes are counted and disclosed.
  ([Contrary Research](https://research.contrary.com/report/bereal))
- **Haptics on the web.** Apple HIG says system sliders and pickers play haptics on their own
  and that haptics should stay optional and causal. Safari on iOS does not support
  `navigator.vibrate`, and iPads have no Taptic Engine.
  ([HIG Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics),
  [MDN BCD issue](https://github.com/mdn/browser-compat-data/issues/29166))

---

## Ideas for Recto (ranked by novelty × impact ÷ effort)

1. **Lift from page.** Touch and hold an image, figure, signature or table on a page and a lime
   outline traces it. Drag it into another tab, into the Library, onto the desktop as a PNG, or
   into the stamp tray. Source: iOS Lift subject. No PDF app does this.
2. **Hold to peek, swipe to wipe.** Hold `\` (Lightroom's key) or press and hold the page pill
   to see the page as it was when opened, with all session changes hidden. Drag a divider for
   a split view of the change. Sources: Photos and Lightroom.
3. **Triage swipe in the Pages grid.** In a Review mode, swipe a thumbnail left to reject it
   (red veil) or right to keep it, and move on to the next page automatically. Then use
   "Delete 7 rejected pages" as one undoable step. Source: Darkroom flag and reject.
4. **Capsule as trash well.** While an annotation is being dragged, the bottom capsule morphs
   into a trash well. Dropping the annotation there deletes it with a dissolve, and Undo is
   shown. Source: Instagram Stories.
5. **Review Replay.** Export a 10–20 s WebM or MP4 that replays the review stroke by stroke,
   made from the history log on the device. Sources: TikTok, Edits and timelapse culture.
6. **Scan Looks with an Amount slider.** For scanned pages: Paper, Ink, Photocopy, Mono, Warm
   archive. Tapping a look's thumbnail again reveals Amount. Swipe over the page to audition
   looks. Sources: Lightroom adaptive presets, Halide Looks and Snapchat filter swipe.
7. **Straighten dial.** A horizontal tick ruler with a 0° detent for rotating a crooked scan by
   any angle, plus an auto-deskew suggestion. Source: the Photos crop ruler.
8. **Copy style / Paste style** for annotations (⌥⌘C / ⌥⌘V, or the selection bar), and
   "Isolate" to show only the matching marks. Source: VSCO Copy Edit.
9. **Snap guides and composition overlays** when placing stamps, signatures and text boxes:
   page centre, margins, thirds, and alignment with other marks. Source: Halide composition
   overlay and Stories guides.
10. **Named versions.** "Save a version…" names a checkpoint ("Sent to legal") in OPFS. A version
    strip in the History scrubber lets you jump between versions and peek at them. Source:
    Lightroom Versions.
11. **Swipe to restyle a selection.** With a mark selected, a horizontal swipe over the ink strip
    previews each saved style live on that mark, and lifting the finger keeps it. Source:
    Snapchat filter carousel.
12. **Library utilities: Duplicates and Smart collections**, plus Customize & Reorder and Pin.
    Source: Apple Photos.
13. **Circle to act.** In Markup, a loose circle around text snaps to the words and offers
    Highlight, Redact, Comment and Copy. Source: Clean Up's tap, brush or circle.
14. **2D style pad.** One touch pad sets size and opacity together (or hue and lightness) for the
    pen. Source: the Photographic Styles pad.
15. **Edit provenance badges.** Library cards and the title menu show small glyphs (Redacted,
    Signed, OCR'd, Pages changed), and the change summary goes into the saved file's XMP.
    Sources: Clean Up label, C2PA and BeReal honesty.
16. **Draft glyph state.** The Save button and the tab glyph change shape when a document has
    unsaved work kept on the device. Source: Threads' draft-aware compose glyph.
17. **Optional tick sounds and visual detents.** Haptics cannot reach iPad Safari, so detents get
    a 1-frame scale pulse and an optional tick sound, off by default. On iPhone Safari 18+,
    toggling a hidden `<input type=checkbox switch>` produces the native haptic, which suits the
    compact edition.
