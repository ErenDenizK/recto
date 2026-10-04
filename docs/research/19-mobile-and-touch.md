---
title: "Research: mobile, tablet and touch, one app from phone to desktop"
date: 2026-10-04
status: snapshot
---

> Research snapshot gathered on 2026-10-04 for the M9 redesign. Apple's guidance was read from
> the JSON behind the Human Interface Guidelines (`developer.apple.com/tutorials/data/…`:
> toolbars, tab bars, sheets, layout, gestures, Apple Pencil and Scribble, pointing devices,
> windows, the menu bar, materials, buttons, accessibility, search fields, popovers, undo and
> redo, file management, motion, haptics, drag and drop). Material 3 values come from the
> `material-components-android` sources on GitHub (docs and `res/values` token files). Browser
> support comes from MDN `browser-compat-data` (`main`, commit of 2026-10-03) and the
> `mdn/content` sources. tldraw's pen and touch handling was read in its `main` branch; Base
> UI's Drawer from the `@base-ui/react` 1.8.0 package in this repository; `ios-haptics` 3.2.0
> from npm. Recto was measured with Playwright against the production build at six viewport
> sizes in headless Chromium 141 with touch emulation. WebFetch was blocked for slatepad.org,
> igeeksblog.com and tldraw.dev when tried; webkit.org, developer.chrome.com, MDN's site,
> apple.com and w3.org are blocked in this session, so their content was read through mirrors
> or is known only from search abstracts. The session's web-search budget ran out before two
> queries on touch-initiated HTML drag and drop, so that point is marked unverified. Claims
> resting on abstracts or established knowledge are marked. No other file was changed.

# Mobile, tablet and touch: one app from phone to desktop

## 0. Verdict

- **Below 700 px Recto is not usable today.** On a 390 × 844 phone the navigator takes 313 px,
  so the page gets 77 px (20 % of the width); the tab strip is 4 px wide, the mode control is
  clipped, the status bar overflows and half of the tool bar is off-screen (§1). On a touch
  tablet none of the title-bar, status-bar or tool-bar targets reaches 44 px.
- **Design five width classes now, not in M10.** Use Material's breakpoints in CSS px: compact
  < 600, medium 600–839, expanded 840–1199, large 1200–1599, xlarge ≥ 1600, plus a
  compact-height flag below 480 px (phone landscape). Size picks the structure; the input
  (`pointer: coarse`) picks the density (44 px targets, 16 px inputs). Never branch on device
  or user agent (§4).
- **On phones, one bottom capsule carries the mode.** Read shows a glass capsule with Pages,
  Find, a prominent **Edit** pill and Share. Edit morphs the same capsule into the tool palette,
  with **Done** in the slot where Edit was. Panels become bottom sheets with two detents, menus
  become action sheets and dialogs become full-height sheets. This follows iOS Markup, Preview
  and Notability, and keeps every per-page action within the thumb's reach (§5, §8).
- **Touch needs its own gesture map**, and it must avoid the system's: one finger scrolls with
  momentum, pinch zooms the page (never the chrome), double-tap toggles fit-width and 2×, a
  450 ms long press selects or opens the context menu, two-finger tap undoes and three-finger
  tap redoes, with visible Undo and Redo buttons as the accessible alternative. No custom
  swipe starts within 24 px of a screen edge (§6).
- **ADR-0019's pen rule is right but too broad.** "Once a pen has been seen" should mean a
  pen on a touchscreen (`pointerType === 'pen'` and `maxTouchPoints > 0`), as tldraw does. A
  Wacom tablet on a desktop is a precise mouse with pressure, not a reason to change what
  fingers do. Recto's own finger pan also needs momentum (§7).
- **Mobile browsers kill background tabs, and iOS has no `beforeunload`.** Without a local
  session snapshot, a phone user who switches to Messages can lose every edit. Snapshot open
  documents to OPFS on `visibilitychange` (local only, still nothing uploaded) and offer
  "Restore" on the next launch (§3.6).
- **Glass on phones has a tighter budget.** At most two blurred surfaces while scrolling (top
  edge and bottom capsule), blur ≤ 20 px on coarse pointers, sheets solid at their large
  detent, and a paused aurora while the user scrolls, pinches or draws. The container cannot
  measure mobile GPU cost (§3.5), so a device check gates the defaults.
- **PWA features worth adopting:** `file_handlers` with `launch_handler` (desktop Chromium:
  Recto in "Open with"), `share_target` (Android), `shortcuts`, PNG and maskable icons plus an
  `apple-touch-icon`, and Web Share with files as the primary export on touch devices. iOS 26
  opens any site added to the Home Screen as a web app, so a one-time hint is enough there
  (§3.7, §10).

---

## 1. What breaks today (measured)

Production build served by `vite preview`, opened in headless Chromium 141 with
`isMobile`/`hasTouch` emulation, two fixtures (`many-pages.pdf`, `annotations.pdf`). Frames are
in the scratch folder only; no file in the repository changed.

| Viewport (CSS px) | Stage in Read/Edit | Tab strip | Mode control (226 px) | Status bar | Edit tool row (436 px) |
|---|---|---|---|---|---|
| 375 × 667 (iPhone SE) | **62 px** (17 %) | **4 px** wide, content 230 | Centred over the 62 px stage, clipped | **386 px in 375** | Centred on the stage, x 256–432, half off-screen |
| 390 × 844 (iPhone 16e class) | **77 px** (20 %) | **4 px** | Clipped to "R" | **398 px in 390** | x 264–440, half off-screen |
| 844 × 390 (phone landscape) | 531 px (63 %) | 269 px | Fits | Fits | Fits; title 40 + status 28 + bar 44 = **29 % of the height** |
| 820 × 1180 (iPad portrait) | 507 px (62 %) | Fits | Fits | Fits | Fits |
| 1180 × 820 (iPad landscape) | 867 px (73 %) | Fits | Fits | Fits | Fits |
| 1440 × 900 (laptop) | 1127 px (78 %) | Fits | Fits | Fits | Fits |

Target sizes on a 1180 × 820 touch viewport in Edit with Write open (smaller side of each
target):

| Region | Targets | < 24 px | < 32 px | < 44 px | Typical size |
|---|---|---|---|---|---|
| Title bar | 7 | 0 | 7 | 7 | 28 × 28 |
| Navigator rail | 9 | 0 | 3 | 3 | rail tabs 56 × 48 (pass), panel chips 24 high |
| Floating tool bar | 8 | 0 | 0 | 8 | 36 high, presets 32 × 32 |
| Status bar | 4 | 4 | 4 | 4 | 22 × 22 |

Findings, with ids that later documents can cite:

- **B-1 The navigator is 313 px at every width** (`--rail-width` 64 + `LEFT_PANEL_WIDTH`
  default 248, minimum 200, `ui-store.ts`), and the Pages panel opens with a document.
- **B-2 The tab strip collapses to 4 px** below about 480 px; the open documents become
  unreachable except through Home.
- **B-3 The mode control and the layout switch overlap** at compact width (both centred or
  right-aligned over a 62–77 px stage).
- **B-4 The status bar overflows** at 375 and 390 px, and its targets are 22 px.
- **B-5 The tool bar is centred on the stage, not the screen.** At 390 px the Edit row starts at
  x 264, so most of it is off-screen, and the 359 px Write row spans x 172–531, 141 px past the
  screen edge. Group labels hide below 640 px (`FloatingToolbar.module.css`). At 820 and 844 px
  both rows fit.
- **B-6 Only the four rail tabs reach 44 px** on a touch tablet. DESIGN §5 sets ≥ 24 × 24,
  which passes WCAG 2.5.8 but not Apple's 44 pt or WCAG 2.5.5 (AAA).
- **B-7 No edge-to-edge support.** The viewport meta is `width=device-width,
  initial-scale=1.0` without `viewport-fit=cover`; `html, body, #root` use `height: 100%`;
  there is no `env(safe-area-inset-*)` anywhere in `apps/web/src`.
- **B-8 Inputs are 13 px** (`--text-md`). iOS Safari zooms the page when an input under 16 px
  takes focus (established knowledge), so tapping Find or rename on an iPhone zooms the whole
  app.
- **B-9 Pinch in Read depends on the browser.** The Read viewport keeps `touch-action: auto`
  (computed), and `ReadView.tsx` zooms from Safari `gesturechange` events and from pairs of
  touch pointers. A synthesized 2× touch pinch in mobile-emulated Chromium moved Recto's zoom
  by only 2–4 %, with or without `touch-action: none` forced, so the synthesized gesture is not
  a reliable stand-in. This needs a check on a real iPhone and Android phone.
- **B-10 No touch route to the page context menu.** It opens on right-click, Shift+F10 or the
  Menu key (`PageContextMenu.tsx`). iOS Safari fires no `contextmenu` on a long press
  (established knowledge), and Recto has no long-press handler.
- **B-11 Arrange's page drag relies on native HTML drag and drop**
  (`@atlaskit/pragmatic-drag-and-drop`); the marquee correctly ignores touch. Whether a
  touch-initiated HTML drag starts reliably on Android Chrome is unverified (search budget ran
  out); there is no long-press lift.
- **B-12 The copy assumes a desk.** The empty state says "Drop PDFs to start" and shows Ctrl+O,
  Ctrl+K and ? keycaps on a phone; the title bar shows a "Search commands Ctrl K" field.
- **B-13 No session persistence.** Edits live in memory. Mobile systems discard background tabs,
  and `beforeunload` does not exist on iOS Safari (BCD), so work can vanish without a prompt.
- **B-14 Export ignores the share sheet.** `export/deliver.ts` uses `showSaveFilePicker` or an
  `<a download>`; on iOS the file lands in Downloads after a prompt, never AirDrop, Mail or a
  chosen Files folder.
- **B-15 The manifest is desktop-only.** SVG icons only, no `apple-touch-icon`, no
  `file_handlers`, `launch_handler`, `share_target`, `shortcuts` or `screenshots`.
- **B-16 Any pen flips "Pen draws in Edit"**, including a desktop Wacom (DESIGN §4.8).
- **B-17 Recto's own finger pan has no inertia** (`pen/ink-input.ts`: "our own pan … no
  inertia"), so the one place where Recto replaces native scrolling feels the least native.

---

## 2. Platform patterns

### 2.1 Apple, iOS 26 and iPadOS 26 (HIG, read in full unless marked)

| Topic | What Apple says | Consequence for Recto |
|---|---|---|
| Tab bar (iOS) | "Floats above content at the bottom of the screen" on Liquid Glass; can minimize on scroll, with an accessory that moves inline; "use a tab bar to support navigation, not to provide actions" | Recto has no top-level sections to navigate on a phone, so its bottom element is a **toolbar**, not a tab bar. It may borrow the minimize-on-scroll behaviour. |
| Toolbars | Leading: back and sidebar toggle, then title and a document menu ("Duplicate, Rename, Move, and Export"); centre: common controls that overflow automatically; trailing: inspector buttons and one `.prominent` primary action such as Done. "Aim for a maximum of three" groups. On iOS, "prioritize only the most important items" and use a More menu | The phone top bar is leading Library back, title with a document menu, trailing ⋯. Done is the one prominent action. Three groups at most. |
| Toolbars, appearance | "Reduce the use of toolbar backgrounds and tinted controls"; use a scroll edge effect to separate controls from content; "consider temporarily hiding toolbars for a distraction-free experience … and offer ways to reliably restore" them | Glass capsule, no slab; a fading top edge instead of a solid bar; hide on scroll in Read with tap-to-restore. |
| Sheets | Detents: large (full) and medium (about half); "include a grabber"; "support swiping to dismiss"; a nonmodal sheet lets people act on the parent view (Notes formatting); "display only one sheet at a time"; on iPad prefer page or form sheets | Navigator panels become nonmodal bottom sheets with two detents; dialogs become modal sheets; never stack two sheets. |
| Popovers | "Avoid displaying popovers in compact views … use a sheet instead" | Every menu and popover turns into a sheet or action sheet below 600 px. |
| Search | "Place search at the bottom if there's room"; a bottom search button "animates into a search field above the keyboard" | Find is a bottom capsule button that becomes a field above the keyboard. |
| Size classes | "Determine layout based on size classes, not device type or orientation"; "keep functionality the same as size classes change" | Classes by available width and height; every feature reachable in every class. |
| Safe areas | Respect safe areas; extend full-screen content under bars | `viewport-fit=cover` and `env(safe-area-inset-*)`. |
| Targets | Hit region "at least 44x44 pt"; about 12 pt padding around bezelled elements, 24 pt around unbezelled ones; contiguous hit regions in bars | Coarse-pointer density token (§4.3). |
| Windows (iPadOS 26) | Full screen or windowed, "freely resize"; window controls sit at the leading edge of the toolbar, so "move [buttons] inward when the window controls appear" | Expect any width from about 320 px up on iPad; keep the leading 80 px of the top bar free of essential controls. |
| Menu bar (iPadOS 26) | Hidden until the pointer reaches the top edge or a swipe down; "ensure that people can access all of your app's functions through its UI" | A web app cannot add to it (established knowledge); Recto keeps its own menus. |
| Gestures | Three-finger swipe undo and redo, three-finger pinch copy and paste, shake to undo; "avoid conflicting with gestures that access system UI"; custom gestures must not be "the only way to perform an important action" | Do not redefine system gestures; every gesture has a button. |
| Undo | "Show the results of an undo or redo", scrolling to the change if it is off screen; "avoid redefining standard gestures for undo" | Undo names the step and scrolls to it. |
| Apple Pencil | "Let people make a mark the moment Apple Pencil touches the screen", without a mode; hover previews the mark (size and colour) and never starts an action; double tap and squeeze are user-configured and must not modify content; "design a great left- and right-handed experience"; in compact width the PencilKit picker has no undo, so add undo buttons and support the three-finger gesture | Pen draws in Edit at once; hover shows an ink dot; Undo and Redo buttons on phones; the vertical tool rail can dock left or right. |
| Scribble | Works "in editable fields in web content" except password fields; keep fields still while writing; give enough space | Recto's text fields get Scribble for free; do not move or resize a focused field while a pen writes. |
| Pointer (iPad) | Hover reveals minimized toolbars; highlight, lift and hover effects; contiguous hit regions; magnetism | With a trackpad, hovering the collapsed capsule expands it. |
| Drag and drop | "Display a drag image as soon as people drag a selection about three points"; offer menu alternatives; support undo | Lift threshold 3–8 px after the long press; Move to… in the page menu. |
| Document launcher (iOS 18+) | Title card with two buttons over a themed background and a file browser sheet | Home on a phone: brand moment plus Open PDF and a recent list. |

Device sizes used below (established knowledge; the HIG layout page dropped its device table in
the 2026-09-09 update): iPhone SE 375 × 667 pt; iPhone 16e 390 × 844; iPhone 17 and 17 Pro
402 × 874; iPhone 17 Pro Max 440 × 956; iPad mini 744 × 1133; iPad and iPad Air 11-inch
820 × 1180; iPad Pro 13-inch 1032 × 1376; Pixel-class Android phones 412 × 915 dp. Safe areas on
Face ID iPhones are about 59–62 pt at the top and 34 pt at the bottom in portrait, and 59–62 pt
at the sides and 21 pt at the bottom in landscape (established knowledge).

### 2.2 Android, Material 3 Expressive

| Item | Value | Source |
|---|---|---|
| Width classes | compact < 600 dp, medium 600–839, expanded 840–1199, large 1200–1599, extra-large ≥ 1600 | developer.android.com (abstract) |
| Height classes | compact < 480 dp (99.78 % of phones in landscape), medium 480–899, expanded ≥ 900 | same (abstract) |
| Floating toolbar | 64 dp high, full (stadium) shape, 8 dp leading and trailing padding, 16 dp from the window edge (24 dp when vertical), elevation level 3, horizontal or vertical, optional FAB 8 dp away; can hide on scroll, **disabled when TalkBack is on**; pad the content when it does not hide | MDC `FloatingToolbar.md`, `floatingtoolbar` dimens (read) |
| Docked toolbar | Full width, 64 dp, replaces the bottom app bar; for "global actions"; the floating one is "for contextual actions relevant to the body content" | MDC `DockedFloatingToolbars.md` (read) |
| Navigation rail | 80–96 dp wide, items 60–64 dp high; the expanded rail replaces the drawer | MDC `NavigationRail.md` (read) |
| Bottom sheet | Max width 640 dp, drag handle 32 × 4 dp, peek ≥ 64 dp, half-expanded ratio 0.5, standard (coexists with content) or modal (scrim, tap outside dismisses) | MDC bottom sheet `dimens.xml`, `tokens.xml`, `BottomSheet.md` (read) |
| Springs, Expressive scheme | spatial fast 800 / ζ 0.6, default 380 / 0.8, slow 200 / 0.8; effects fast 3800 / 1.0, default 1600 / 1.0, slow 800 / 1.0 | MDC `motion/res/values/tokens.xml` (read) |
| Springs, Standard scheme | spatial 1400 / 0.9, 700 / 0.9, 300 / 0.9; effects as above | same |

A search abstract gave the Standard values as "Expressive"; the token file is authoritative.
Computed for unit mass, the Expressive default spatial spring settles within 0.5 % in 370 ms
with 1.5 % overshoot; fast spatial in 321 ms with 9.5 %; default effects in 185 ms with none.

### 2.3 Note-taking and PDF apps on phones and tablets

| App | Tools | Pages | Gestures | Pen versus finger |
|---|---|---|---|---|
| Preview, iOS and iPadOS 26 (new on iPad and iPhone; abstracts) | Markup palette: pencil, pen, marker, highlighter, eraser, lasso, ruler, colours; shapes, text, signatures, stickers; form autofill | Rearrange and delete pages; scan | System standard | Pencil or finger can draw (Apple Support, abstract) |
| Files and Quick Look Markup, iPhone (established knowledge) | A pen-tip button enters Markup; the tool picker docks at the bottom; Done leaves | Thumbnails sidebar on iPad | Two-finger scroll while a tool is armed | "Only Draw with Apple Pencil" setting |
| Notability (support pages, abstracts) | iPhone toolbar redesigned in 15.3.1 (Dec 2025): Record, Insert and a secondary tool drawer; a movable Toolbox with four slots | Page sorter | Two-finger tap undo, three-finger tap redo, three-finger swipes; hold to straighten a line or snap a shape; two fingers scroll while a tool is armed | Finger writes unless set otherwise |
| GoodNotes 6 (support, abstracts) | Moved to a floating toolbar, which drew complaints and requests to make it optional | Page overview | **Double** tap with two fingers undoes, with three redoes; no setting to turn them off; conflicts with Windows three-finger gestures | Read Only mode hides the tools |
| PDF Expert (abstracts) | Annotate, Edit, Fill & Sign, Export tabs at the top on iPad; customizable toolset | On iPhone, thumbnails at the bottom | Standard | Pen-first |
| Procreate (handbook, abstract) | Brush, smudge, eraser at the top; sliders on the side | Gallery | Two-finger tap undo, hold to undo repeatedly; three-finger tap redo; touch and hold for the eyedropper | Finger painting is opt-in |
| Freeform (abstract) | PencilKit picker | Boards | Two-finger tap undo; two-finger hold scrubs back | Pencil Pro squeeze supported |

**What carries over.** (1) The tool palette sits at the bottom on phones and floats on tablets.
(2) Leaving a markup state is an explicit Done, never an implicit tap. (3) Two-finger tap undo
is the shared convention; GoodNotes' double tap is the cautious variant. (4) When a finger can
draw, two fingers scroll; when a pen is present, fingers navigate. (5) Every app keeps visible
undo controls because gestures are invisible.

---

## 3. Web platform status (October 2026)

Support from BCD unless marked. "Safari" covers iOS and iPadOS.

### 3.1 Viewport, safe areas, keyboard

| Feature | Support | Recto consequence |
|---|---|---|
| `viewport-fit=cover` + `env(safe-area-inset-*)` | Safari iOS 11, Chrome Android 135, Firefox Android 79; `env()` everywhere | Adopt; pad bars with `max(env(…), 12px)` |
| `dvh` / `svh` / `lvh` | Chrome 108, Firefox 101, Safari 15.4 | `#root { height: 100dvh }` with a `100%` fallback |
| `interactive-widget=resizes-content` | Chrome Android 108, Firefox Android 133; **not Safari** | Adopt: on Android the layout shrinks, so bottom bars rise above the keyboard |
| VirtualKeyboard API, `keyboard-inset-*` | Chromium 94 (useful on Android and ChromeOS); **not Safari, not Firefox** | Optional on Android; iOS needs `visualViewport` |
| `visualViewport` | Chrome 61, Firefox 91, Safari 13 | The iOS path: keep `--vv-bottom = innerHeight − (vv.height + vv.offsetTop)` in a custom property on `resize` and `scroll` |
| `user-scalable=no`, `maximum-scale` | Ignored by iOS 10+ by default (MDN) | Never set them (WCAG 1.4.4); scope app pinch with `touch-action` |
| `-webkit-text-size-adjust` | (established knowledge) iOS inflates text in landscape without it | Set `text-size-adjust: 100%` with the prefix |

**iOS keyboard quirks** (established knowledge plus abstracts). Focusing an input under 16 px
zooms the page. `position: fixed` bars stay attached to the layout viewport, so the keyboard
covers a bottom bar unless it follows `visualViewport`. Safari 26 in a browser tab floats its
own Liquid Glass bar over the page: `env(safe-area-inset-bottom)` covers only the home
indicator, not that bar, and returns 0 when the toolbar hides (Apple forums 716552, abstract).
Safari 26 also ignores `theme-color` and tints its bars by sampling a fixed or sticky element at
the viewport edge, else the `<body>` background (Ben Frain, 1ar.io, abstracts), and a fixed
full-screen layer at `opacity: 1` can leave a gap above the floating bar (WebKit bug 297779,
abstract). Base UI 1.8's `Drawer.VirtualKeyboardProvider` (in this repository) keeps a focused
field in a bottom sheet visible and exposes `--drawer-keyboard-inset`.

### 3.2 Pointer input

| Feature | Support | Notes |
|---|---|---|
| `pointerType`, `pressure`, `tiltX/Y`, `width/height` | Chrome 55, Firefox 59, Safari 13 | Research 12 §2.3 has the per-platform pressure table |
| `altitudeAngle` / `azimuthAngle` | Chrome 86, Firefox 131, Safari 18.2 | Later: broad-nib highlighter |
| `getCoalescedEvents` / `getPredictedEvents` | Chrome 58/77, Firefox 59/89, Safari 18.2 | In use |
| `touch-action` (incl. `pinch-zoom`) | Chrome 36/56, Firefox 52/85, Safari iOS 9.3/13 | The main tool for separating app gestures from browser zoom |
| `Touch.touchType` (`"stylus"`) | **Safari iOS only** (10+) | Lets a `touchstart` listener cancel scrolling for the Pencil only, so fingers keep native momentum scrolling (§7.3) |
| Apple Pencil hover | Safari 16.1 on M2-class iPads (MacRumors, abstract) | Pointer moves with `pointerType: 'pen'` and `buttons === 0` |
| Pencil double tap, squeeze, barrel roll | Not exposed to the web (established knowledge) | Offer the eraser and lasso as palette buttons |
| Palm rejection | Android 13+ cancels palm-only touches with `ACTION_CANCEL` (Android docs, abstract), seen as `pointercancel`; Chrome on Android reports stylus contacts with 0 width and height (Chromium review, abstract) | Keep Recto's rules: ignore touches larger than 40 px and touches during or just after a pen stroke |
| Safari Pencil double-tap loupe | tldraw cancels `touchstart`/`touchend` for pen events to stop iOS's zoom window (`useFixSafariDoubleTapZoomPencilEvents.ts`, read) | Copy it |
| Rate | Safari caps `requestAnimationFrame` at 60 Hz on ProMotion iPads by default (research 12 §2.1) | A web pen on iPad is a 60 Hz pen |

tldraw's model, read in source: pen mode turns on for a **direct-display** pen only
(`isDirectDisplayPen`: `pointerType === 'pen'` on a touch device), and in pen mode touch input on
the canvas is ignored and an in-progress touch interaction is interrupted. Desktop tablet pens
"still draw as pens, but should not auto-enable pen mode".

### 3.3 Pinch zoom versus browser zoom

Three zooms compete on a phone: the browser's visual-viewport zoom (accessibility, must stay
available), Recto's page zoom, and Safari's double-tap zoom. Rules that keep them apart:

1. The page stage owns two-finger pinch: `touch-action: pan-x pan-y` on the Read viewport
   removes the browser's pinch zoom there while keeping native one-finger scrolling. Safari
   additionally delivers `gesturestart`/`gesturechange` (already handled). Whether Chrome on
   Android then delivers both touch pointers without a `pointercancel` when the two fingers
   also move together is the open question of spike S-T1 (§12); the fallback is
   `touch-action: none` with Recto's own pan, which then needs momentum (§7.3).
2. Chrome (title, sheets, capsule) keeps `touch-action: manipulation`, so a pinch there zooms
   the whole app as the user expects, and taps lose the double-tap delay.
3. Mod+wheel and trackpad pinch (`ctrlKey` wheel) zoom the page, as today.

### 3.4 Haptics

`navigator.vibrate` works in Chrome on Android only (Firefox removed it in 129; Safari never had
it). iOS has no API. Since Safari 18, toggling `<input type="checkbox" switch>` plays the system
tick; libraries used a hidden switch clicked from script, and iOS 26.5 closed that programmatic
path (haptics.kushagragolash.dev, abstract). `ios-haptics` 3.2.0 (source read) now lays a
transparent switch over the tapped element, so only a **direct tap** can tick. Consequence:
haptics on iOS can confirm a tap on a control at most, never a snap during a drag; Android can
have short pulses (8–12 ms) for lift, snap and drop.

### 3.5 Glass on phones

- WebKit cannot cache the blurred backdrop behind a fixed or sticky layer, so it re-blurs on
  every scroll frame, "the single biggest cause of janky scrolling"; one fix cut blur from 20
  to 8 px for "−60 % GPU cost per element" (GitHub PRs domi-ops#57 and others, abstracts).
- Research 13 §2 and 14 already cover desktop cost, the backdrop-root rule and geometry gating.
- **Measured here: nothing usable.** Scrolling 40 white pages at 390 × 844, DPR 3, under one or
  two 56 px glass capsules with blur 0–40 px, or a 320 px full-height glass panel, gave a 16.7 ms
  median and p95 in every case: the headless loop is vsync-capped and software-rendered, so it
  hides GPU cost. A real-device check (S-T2, §12) decides the defaults below.
- Area matters: on a 402 × 874 phone a 56 px capsule with 16 px margins plus a 44 px top edge
  covers about 15 % of the screen; full-height side panels would cover 80 %.

### 3.6 Memory and lifecycle

| Limit | Value | Consequence |
|---|---|---|
| One canvas on iOS | 16,777,216 px (pqina, abstract) | Equal to Recto's `MAX_BITMAP_PIXELS` (4096², `engine-service.ts`); above it Recto already tiles (`TiledPage`, 1024 px tiles) |
| All canvases on iOS | 224–384 MB depending on version and device (pqina, WebKit bug 195325, Apple forums, abstracts) | One full-size canvas is 64 MB; budget live canvases on coarse devices (§9) |
| Freeing canvases | Setting a canvas to 0 × 0 releases its memory promptly; garbage collection may not (pqina, abstract) | Zero out canvases that leave the virtualized window |
| Web content process | No fixed limit; exceeding the jetsam limit reloads the page with a "significant memory" message and **no exception** (HN 39039593, abstract) | A reload must be recoverable (session snapshot) |
| PDFium wasm memory | Declares 284 pages minimum (17.75 MiB) and **32768 pages maximum (2 GiB)**; measured from `pdfium.wasm` here | iOS 16.4 and earlier refused 2 GiB maxima on imported memories (godot#70621, abstract); confirm on iOS 18 and 26 with a 200-page, 50 MB file |
| Background tabs | Mobile systems discard them; `beforeunload` absent on iOS (BCD); `pagehide` and `visibilitychange` everywhere | Snapshot on `visibilitychange: hidden` |
| OPFS | `getDirectory` Chrome 86 / Android 109, Firefox 111, Safari 15.2; unavailable in Safari private browsing (research 03) | Session snapshots go to OPFS; ask `navigator.storage.persist()` first |

### 3.7 PWA and files

| Member or API | Support | Use in Recto |
|---|---|---|
| Install | iOS 26: any site added to the Home Screen opens as a web app by default (heise, WebKit Safari 26.0 post, abstracts); Chrome prompts on desktop and Android | One-time iOS hint; keep `display: standalone` |
| `display_override` with `window-controls-overlay` | Chrome 105 desktop only | Optional: tabs in the OS title bar on installed desktop |
| `file_handlers` + `launchQueue` | Chrome 102 desktop; **not Android, not Safari** | Adopt for `.pdf`; installed Recto appears in "Open with" |
| `launch_handler.client_mode` | Chrome 110 | `focus-existing`, so a second PDF opens as a tab in the running window |
| `share_target` | Chrome Android 76 | Adopt: "Share → Recto" from Files or Gmail |
| `shortcuts` | Chrome 96, Chrome Android 84, Safari macOS 17.4; not iOS | Open PDF, Combine files |
| `showOpenFilePicker` / `showSaveFilePicker` | Chrome 86, **Chrome Android 132**; not Safari, not Firefox | Recents with handles also work on Android |
| `navigator.share` with files | Chrome 89, Chrome Android 76, Safari 14 | Primary "Share…" on coarse pointers |
| `icons` | Safari iOS uses them only without an `apple-touch-icon` and with purpose `any` (BCD note); Safari 26 added SVG icon support (WebKit post, abstract) | Ship PNG 192, 512, maskable 512 and a 180 px `apple-touch-icon` |
| `setAppBadge` | Chrome desktop, Safari 16.4+ | Not needed |

---

## 4. Size classes and breakpoints

### 4.1 Classes

| Class | Width (CSS px) | Typical windows | Shell |
|---|---|---|---|
| **compact** | < 600 | Phones in portrait, narrow iPad windows, desktop at 300–400 % zoom | One document; top bar plus bottom capsule; sheets |
| **compact-height** (flag) | any width, height < 480 | Phones in landscape (844–956 × 390–440) | Immersive Read; vertical tool rail; side sheets |
| **medium** | 600–839 | iPad mini and 11-inch iPad in portrait (744, 820), foldables unfolded | Tabs on top; overlay navigator; bottom capsule |
| **expanded** | 840–1199 | iPads in landscape (1133–1210), split desktop windows, 1280 laptops at 125 % zoom | Docked navigator (collapsible); floating bar; overlay inspector |
| **large** | 1200–1599 | iPad Pro 13 landscape (1376), 13–14-inch laptops (1280–1512) | Today's desktop layout |
| **xlarge** | ≥ 1600 | External monitors (1920+) | Navigator and inspector both docked by default |

CSS px are close enough to Apple's pt and Android's dp for this purpose. The classes also serve
WCAG 1.4.10 (reflow at 320 CSS px): a 1280 px laptop at 400 % zoom is compact.

### 4.2 Mechanics

- One source of truth: `useSizeClass()` in `state/ui-store.ts`, fed by `matchMedia` for
  `(min-width: 600px)`, `(min-width: 840px)`, `(min-width: 1200px)`, `(min-width: 1600px)` and
  `(max-height: 479px)`, mirrored to `data-size` and `data-short` on `:root` for CSS. Structural
  switches (which component renders: sheet or panel) read the hook; styling reads the
  attributes or plain media queries with the same numbers.
- Inside panels and sheets use container queries (`@container`, Safari 16+), so the Pages grid
  adapts to a 320 px sidebar and a 390 px sheet alike.
- Keep state across class changes: rotating a phone or resizing an iPad window must not close
  the document, lose the scroll anchor or reset the tool. An open sheet becomes the equivalent
  panel and back.
- Hysteresis is unnecessary for widths (resizes are deliberate), but the hide-on-scroll and
  sheet detents must re-measure on `visualViewport` resize.

### 4.3 Density by input

| Token | Fine pointer (today) | Coarse pointer (`pointer: coarse`) |
|---|---|---|
| Hit area | ≥ 24 × 24 | **≥ 44 × 44** (the visible control can stay 36–40) |
| Bar control height | 28 (`--control-height`) | 44 |
| Floating capsule height | 44 | 56 (compact and medium), 64 when it holds the tool palette (Material floating toolbar) |
| List row | 28–32 | 44 |
| Gap between adjacent targets | 2–4 | ≥ 8, or contiguous hit areas |
| Input text | 13 px | **16 px** (iOS auto-zoom) |
| UI label text | 13 px (`--text-md`) | 15 px; captions 12 px |
| Keycaps in menus and tooltips | Shown | Hidden until a physical key is pressed in this session |
| Hover reveals (⋯ on rows, × on tabs) | On hover or focus | Always visible (`hover: none`), as `TabBar` and `FileRow` already do in places |

A coarse primary pointer with a fine secondary (iPad with trackpad, touch laptop) keeps coarse
sizes and also enables hover effects through `(any-hover: hover)`.

---

## 5. Layout for each class

### 5.1 Phone portrait (compact)

```
Read                                   Edit (same capsule, morphed)
┌──────────────────────────────┐       ┌──────────────────────────────┐
│ ‹ 3   report.pdf ▾        ⋯  │ 44+sa │ ‹ 3   report.pdf ▾   ↶  ↷  ⋯ │
│ ╌╌ (fading glass edge) ╌╌╌╌╌ │       │ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ │
│  ┌────────────────────────┐  │       │  ┌────────────────────────┐  │
│  │                        │  │       │  │                        │  │
│  │    page, fit width     │ ▐│scrub  │  │    page, fit width     │  │
│  │    (16 px margins)     │  │       │  │                        │  │
│  │                        │  │       │  │                        │  │
│  └────────────────────────┘  │       │  └────────────────────────┘  │
│                              │       │      ╭─ options tier ─╮      │
│ ╭──────────────────────────╮ │       │ ╭──────────────────────────╮ │
│ │ ▦  ⌕   [ ✎ Edit ]   ⇪  3/12│ │56    │ │✓Done│ ●●●▬ ⌫ ◌ ▭ T ✍ ⊘ › │ │64
│ ╰──────────────────────────╯ │       │ ╰──────────────────────────╯ │
└──────────────────────────────┘ +sa   └──────────────────────────────┘
```

- **Top bar** (44 px + safe area, glass with a fading bottom edge, no slab): leading
  "‹ 3" returns to Home and shows the open-document count (Safari's tab-count idea); the title
  opens the Document menu as an action sheet (Rename, Document info, Export, Print, Protect,
  Page numbers…); trailing ⋯ holds Find in document, Compare, Appearance, Shortcuts and About.
  In Edit, Undo and Redo join the trailing group (HIG: compact PencilKit has no undo).
- **Bottom capsule** (56 px, 12 px side margins, `max(safe-area, 12px)` below): Pages (opens
  the Pages sheet; long press opens Arrange), Find, the prominent **Edit** pill, Share, and the
  page pill "3 / 12" (tap: go-to-page sheet). The capsule is centred on the **screen**, never on
  the stage (B-5).
- **Edit** morphs the capsule in place (Expressive default spatial spring): the Edit pill
  becomes **Done** at the leading end, the rest becomes the tool palette: the three pens and the
  Highlighter as ink dots, Eraser, Lasso, Shapes ▾, Text ▾ (Edit text, Text box, Note, Image),
  Fill & sign, Redact. The row scrolls horizontally with a 24 px fade when it overflows; the
  armed tool scrolls into view. Pressing the armed tool again opens its options tier above the
  capsule (DESIGN §2's rule, unchanged).
- **Arrange** opens full screen from Pages (long press) or a pinch below fit (§6): a grid of
  3 columns at 390 px (cells about 110 px wide), 2 at < 360, pinch changes 2–5 columns; its own
  bottom capsule carries Select, Rotate, Delete, Extract and Done.
- **Home**: a document-launcher-like title area (brand, "Open PDF" primary button at the
  bottom, within reach), then open documents as 2-column cards (3:4 thumbnails) and Recents as
  44 px rows. Combine starts from a Select button: cards get check marks and a bottom action bar
  "Combine 2 files". The drop target text appears only where dropping is possible
  (`hover: hover` or medium and up).
- **Hide on scroll in Read**: after 24 px of downward scroll the top bar slides up and the
  capsule shrinks to a 36 px page pill; any upward scroll of 24 px, a tap on the page, reaching
  the first or last page, focus entering the chrome or an open sheet restores it. Never in Edit.
  With `prefers-reduced-motion` the bars fade instead of sliding.
- **Scrubber**: in documents over 20 pages a 44 × 32 px tab with the page number appears on the
  trailing edge while scrolling, inset 16 px from the safe edge (clear of Safari's forward
  swipe), and hides 1.2 s after scrolling stops.

### 5.2 Phone landscape (compact-height)

Height is the scarce axis (390–440 px). Read is immersive: the top bar hides by default and the
capsule is a 44 px pill (page number, Edit). Edit uses a **vertical** tool rail, 64 px wide,
24 px from the trailing safe edge (Material's vertical floating toolbar), with Done at its top;
the user can drag it to the leading edge (left-handed writers) and the side is remembered.
Sheets become side sheets 360 px wide from the trailing edge.

### 5.3 Tablet portrait (medium)

Top bar 52 px: document tabs (≥ 2 documents) or the title, mode control **Read · Edit ·
Arrange** at the trailing side (iPad has the room), Document and ⋯. The navigator is an
**overlay sidebar** 320 px wide that slides over the page from the leading edge and closes on a
tap outside or a swipe toward the edge; it never squeezes the page. The tool capsule floats at
the bottom centre (56 or 64 px). The inspector, menus and popovers stay popovers (they fit).
Dialogs are form sheets, at most 640 px wide.

### 5.4 Tablet landscape and small laptops (expanded)

The navigator docks (rail 64 px plus a 248 px panel, collapsible to the rail with one button);
the stage runs full bleed under it (DESIGN §2). The inspector opens as an overlay side sheet
320 px from the trailing edge rather than docking, so a 1180 px iPad keeps at least 760 px of
page. The floating bar shows group labels from 960 px up.

### 5.5 Large and xlarge

Large keeps today's layout (DESIGN §2). Xlarge docks the inspector by default when it was last
open, and caps fit-width pages at 1100 px wide with the stage centring them, so a 2560 px
monitor does not render a 2400 px-wide line of text.

### 5.6 Placement matrix

| Surface | compact | compact-height | medium | expanded | large / xlarge |
|---|---|---|---|---|---|
| Open documents | "‹ N" back to Home; Home is the switcher | same | Tabs in the top bar | Tabs | Tabs |
| Mode Read · Edit · Arrange | Capsule: Edit pill ⇄ Done; Arrange from Pages | Rail: Edit ⇄ Done | Segmented control, top trailing | Segmented control over the stage (today) | same |
| Tool palette | Bottom capsule, scrolls | Vertical rail, trailing (movable) | Bottom floating capsule | Bottom floating bar (today) | same |
| Tool options tier | Above the capsule, full width minus 24 px | Beside the rail | Above the capsule | Above the bar (today) | same |
| Pages / Bookmarks | Nonmodal bottom sheet, detents 40 % and 92 % | Side sheet 360 px | Overlay sidebar 320 px | Docked panel | Docked panel |
| Find | Field above the keyboard; results in the sheet at 40 % | Side sheet | Overlay sidebar | Docked panel | Docked panel |
| Review | Bottom sheet | Side sheet | Overlay sidebar | Docked panel | Docked panel |
| Inspector (Selection, History) | Bottom sheet | Side sheet | Popover from its button | Overlay side sheet | Docked (xlarge default) |
| Document menu, ⋯ menu | Action sheet (bottom, grouped, 44 px rows) | Action sheet | Popover menu | Menu (today) | Menu |
| Page context menu | Action sheet from a long press | same | Menu at the press point | Menu | Menu |
| Text selection bar, contextual bars | Above the selection, 44 px targets; flips below near the top bar | same | same | Today | Today |
| Dialogs (Export, Combine, Page numbers, OCR…) | Modal sheet at the large detent, Cancel leading and Done trailing | Full-screen sheet | Form sheet ≤ 640 px | Dialog (today) | Dialog |
| Command palette | Sheet at the large detent from ⋯ "Search commands" | same | Centred, top third | Today | Today |
| Toasts | Above the capsule, centred | Above the pill | Bottom leading | Bottom leading (today) | same |
| Zoom readout | In the page-pill sheet | same | Status line in the overlay | Status bar | Status bar |
| Privacy indicator | ⋯ menu header line and Home | same | Status line | Status bar | Status bar |

---

## 6. Gesture map

"Pen seen" means a direct-display pen has been used in this session (§7.2). Thresholds:
long press 450 ms with 10 px slop (UIKit uses 500 ms, Android 400 ms; established knowledge);
double tap within 300 ms and 24 px; multi-finger taps need every finger down within 150 ms,
all lifted within 300 ms of the first contact, each moving less than 12 px, no pen in contact
and no pen lift in the previous 500 ms.

| Gesture | Read | Edit, no pen seen | Edit, pen seen | Arrange | Home |
|---|---|---|---|---|---|
| One finger drag | Scroll, native momentum | Draws with a drawing tool armed; scrolls with Select or a text tool | Scrolls (momentum) | Scrolls; after a long press, drags the page | Scrolls |
| One finger tap | Follow link; toggle chrome on empty paper; on a field: "Switch to Edit to fill" | Select tool: select annotation or clear; other tools act | Same as no pen | Select page (toggle in Select mode) | Open the document |
| Double tap | Toggle fit-width ⇄ 2× (phone 250 %) around the tap, 280 ms | Text box or note: edit its text; else nothing while a drawing tool is armed | Toggle zoom, as in Read | Open the page in Read | — |
| Long press (450 ms) | On text: select the word, show the selection bar; on empty paper: page action sheet (read-only items) | On an annotation: select it and show its bar; on paper: page action sheet | Same | Lift the page (scale 1.04, Android 10 ms pulse); move > 8 px drags; release without moving opens its action sheet | Card action sheet (Remove from recents, Close, Combine with…) |
| Two-finger drag | Scroll | Pan (momentum) | Pan | Scroll | Scroll |
| Pinch | Page zoom around the midpoint; below fit by > 15 % at release → Arrange grid at this page | Page zoom | Page zoom | Change columns 2–5; pinch out on a page → Read at that page | — |
| Two-finger tap | — | **Undo**, with a toast naming the step and Redo | Undo | Undo | — |
| Three-finger tap | — | **Redo** | Redo | Redo | — |
| Pen down | Selects text like a mouse; never marks | Draws with the armed drawing tool; acts like a mouse otherwise | Draws with the armed preset even with Select armed ("Pen draws in Edit") | Drags pages directly (no long press) | Acts like a mouse |
| Pen hover | Nothing | Ink dot preview of colour and width at the tip | Same | Nothing | Nothing |
| Pen eraser end / barrel button | — | Temporary eraser / lasso (ADR-0019) | Same | — | — |
| Swipe down on a sheet's grabber or content at top | Lower one detent, or dismiss | same | same | same | same |
| Edge swipes | Left to the system (back), never captured | same | same | same | same |

Rules:

- **No custom swipe starts within 24 px of the left or right edge** (Safari back and forward,
  Android back) or within 34 px of the bottom (home indicator) or the top 44 px on iPad (menu
  bar swipe in iPadOS 26).
- **Undo is never gesture-only.** Compact Edit shows Undo and Redo in the top bar; medium and up
  keep them in the bar's overflow and History. WCAG 2.5.1 requires single-pointer alternatives
  for multipoint gestures; zoom has buttons in the page-pill sheet.
- **Show the result** (HIG undo): the toast says "Undid pen stroke on page 4", and an undone
  change off screen scrolls into view.
- **No pull-to-refresh.** `overscroll-behavior: none` on `html` and `body`, `contain` on every
  scroller, so an overscroll at the top of Home or a sheet never reloads the app on Android.

---

## 7. Input rules

### 7.1 Mouse and trackpad

As today (DESIGN §4): click, double-click on page text opens the paragraph editor in Edit,
right-click menus, Space pans, Mod+wheel and trackpad pinch zoom under the pointer, Safari
gesture events for trackpad pinch. Trackpad two-finger scroll stays native. On an iPad with a
trackpad, hovering the collapsed capsule expands it (HIG pointing devices).

### 7.2 Pen

- **Direct-display pen detection.** Auto-enable "Pen draws in Edit" and the finger rules only for
  `pointerType === 'pen'` when `navigator.maxTouchPoints > 0` (tldraw's `isDirectDisplayPen`).
  A pen on a non-touch screen (Wacom) draws with pressure but changes nothing about fingers and
  never flips the setting. This amends ADR-0019 §5 and DESIGN §4.8.
- **Mark at first contact**, no mode step (HIG): the first pen touch in Edit draws with the last
  preset, including with Select armed while "Pen draws in Edit" is on.
- **Hover**: show a dot of the preset's colour and mid-pressure width at the tip; never act on
  hover; no preview for the mouse (HIG). Hide it 300 ms after the pen leaves.
- **Safari**: cancel `touchstart` and `touchend` default for pen touches on the stage to stop the
  iOS double-tap loupe; let Scribble work in Recto's own text fields; never move or resize a
  focused field while the pen writes.
- **Palm**: keep "touches larger than 40 px, and touches during and just after a pen stroke, are
  ignored"; treat a lone `pointercancel` on Android as a rejected palm, not an end of gesture.
- **Hardware gestures the web lacks** (double tap, squeeze, barrel roll): the palette exposes
  Eraser and Lasso as buttons; the eraser end and barrel button keep working where the
  platform sends them (`buttons & 32`, button 2).

### 7.3 Touch

- **Before a pen is seen** (phones, most tablets): in Edit with a drawing tool armed, one finger
  draws and two fingers pan and zoom (Notability, Preview). A "Draw with finger" switch in the
  pen options tier lets the user make one finger scroll instead; the choice is remembered per
  device.
- **After a pen is seen**: fingers navigate (one finger scrolls, two pan and zoom), and "Draw
  with finger" defaults to off.
- **Native scrolling where possible.** On Safari, keep `touch-action: pan-x pan-y` on the stage
  in Edit too and call `preventDefault()` on `touchstart` only when every changed touch has
  `touchType === 'stylus'`: the Pencil draws while fingers keep native momentum. Chrome on
  Android has no `touchType`, so there Recto needs `touch-action: none` and its own pan.
- **Own pan, when needed, gets inertia**: velocity from the last 100 ms of samples, decay
  0.998 per ms (UIScrollView's normal rate; established knowledge), so the time constant is
  about 500 ms and a 1 px/ms flick travels about 500 px; stop below 0.02 px/ms; at the edges,
  rubber-band with a 0.55 factor and spring back with the Expressive default spatial spring.
- **Pinch** clamps to the zoom range with 15 % of rubber band and springs back; within ±4 % of
  fit-width at release it snaps to fit-width.
- **Never hover on touch**: no run outlines, no tooltips (the long-press action sheet carries
  labels), no double-tap hint.
- **Selection handles**: page-text selection on touch shows two 44 px handle targets; the
  selection bar appears 8 px above the selection and flips below it near the top bar.

### 7.4 Keyboard on tablets

Hardware keyboards on iPad and Android tablets send the same shortcuts; keycaps appear after the
first physical key press. A focused in-page editor on a coarse device turns the capsule into an
**accessory bar** pinned above the software keyboard (following `--vv-bottom` on iOS and the
resized layout on Android), carrying Done and the editor's header lines (honesty note, overflow
choices). Form fields stay real `<input>` elements in reading order, so Safari's own form
assistant (previous, next, Done) works.

---

## 8. One-hand reach

- On a 402 × 874 phone held in one hand, the thumb covers the bottom third and the centre
  easily, and the top corners poorly (Hoober's 2013 field study: about half of observed use was
  one-handed; established knowledge). Rule: **every action used per page or per stroke lives in
  the bottom 200 px**: the capsule, its options tier, the selection bar's second position, the
  sheet at its 40 % detent, Find's field above the keyboard.
- The top bar holds identity and rare actions only: back to Home, the title and Document menu,
  ⋯, Undo and Redo (also reachable by two-finger tap).
- Sheets open at 40 % of the visual viewport height (the page stays visible above them, as in
  Maps); the large detent is 92 %. Primary sheet actions sit at the bottom of the sheet, not in
  its header, when the sheet is a task (Combine, Export).
- Tablets: the floating capsule sits bottom centre in portrait; in landscape the vertical rail
  can dock to either side, because a writing hand covers the bottom corner on its own side
  (HIG Pencil).

---

## 9. Motion and resources on touch

- **Springs for direct manipulation** (sheets released from a drag, the capsule morph, pinch
  rubber band): Expressive default spatial, stiffness 380, damping ratio 0.8 (370 ms, 1.5 %
  overshoot); small chips and the options tier: fast spatial 800 / 0.6 (321 ms, 9.5 %); opacity
  and colour: default effects 1600 / 1.0 (185 ms). A CSS stand-in for 380 / 0.8 over 370 ms:
  `linear(0, 0.080, 0.249, 0.439, 0.611, 0.750, 0.853, 0.924, 0.969, 0.996, 1.009, 1.014,
  1.015, 1.013, 1.010, 1.007, 1)` (`linear()`: Chrome 113, Firefox 112, Safari 17.2). Base
  UI's Drawer default, `cubic-bezier(0.32, 0.72, 0, 1)` over 450 ms, is an acceptable
  non-spring fallback. Releases inherit the finger's velocity. Reduced motion: snap with a
  120 ms fade.
- **Glass budget on coarse pointers**: two blurred surfaces at most while content scrolls (the
  top edge and the capsule); blur ≤ 20 px (desktop tiers use 28–40 px); the top edge uses one
  `backdrop-filter` with `mask-image: linear-gradient(#000 60%, transparent)` for Apple's scroll
  edge look; sheets use the dense menu tier at the 40 % detent and turn solid at the large
  detent, where nothing behind them is visible; overlay sidebars and side sheets stay solid on
  compact and medium. Never animate the filter (research 13 §4.2).
- **Aurora on phones**: only on Home and behind the stage margins, built from transformed and
  faded layers (compositor-only), paused with `animation-play-state: paused` while the user
  scrolls, pinches, drags or draws and for 600 ms after, and off under reduced motion and
  Reduce transparency.
- **Canvas budget on coarse pointers**: keep at most about 40 MP of live page and tile canvases
  (about 160 MB), for example the visible tiles plus one page of overscan instead of two; set
  canvases that leave the window to 0 × 0; render Pages-sheet and Arrange thumbnails at 1× DPR
  on phones and keep them as `<img>` blob URLs rather than canvases.
- **Recoverable reloads**: with the session snapshot (§3.6) a jetsam reload shows "Recto was
  closed by the system. Restore 2 documents?" instead of an empty app.

---

## 10. PWA features worth adopting

| Feature | Platforms | Priority | Detail |
|---|---|---|---|
| `viewport-fit=cover`, safe-area padding, `interactive-widget=resizes-content`, `text-size-adjust: 100%` | All mobile | P0 | §3.1 |
| PNG icons 192, 512, maskable 512; `apple-touch-icon` 180; `screenshots` (narrow and wide) | All | P0 | With the brand track; screenshots enable the richer install sheet on Chrome Android (established knowledge) |
| Session snapshot in OPFS, `persist()`, Restore prompt; `beforeunload` guard on desktop | All | P0 | §3.6 |
| Web Share with files as "Share…" on coarse pointers; Save to device stays | iOS, Android, desktop Safari | P1 | `navigator.canShare({ files })` gate |
| `file_handlers` (`application/pdf`, `.pdf`) + `launch_handler: { client_mode: "focus-existing" }` + `launchQueue` | Desktop Chromium | P1 | Each launched file opens as a tab in the running window |
| `share_target` (POST, `multipart/form-data`, `files: [{ name: "pdf", accept: ["application/pdf", ".pdf"] }]`) | Android Chrome | P1 | Needs a service-worker route that stores the file in Cache or IndexedDB and redirects to the app; works on GitHub Pages |
| `shortcuts`: Open PDF, Combine files | Chrome desktop and Android, Safari macOS | P2 | Opens with a query the app reads once |
| One-time "Add to Home Screen" hint on iOS Safari after the second visit with a document | iOS | P2 | Dismissible; never on the first visit |
| `display_override: ["window-controls-overlay", "standalone"]` | Desktop Chromium | P3 | Only if the tab strip is designed for `titlebar-area-*` |
| `protocol_handlers`, `note_taking`, badges, orientation lock | — | No | No use |

---

## 11. Recommendations

| Id | Recommendation | Applies to |
|---|---|---|
| M-1 | Five width classes at 600 / 840 / 1200 / 1600 px plus compact-height < 480 px, exposed as `useSizeClass()` and `data-size`/`data-short` on `:root`; container queries inside panels; no device or UA checks | `state/ui-store.ts`, `styles/tokens.css`, shell |
| M-2 | Coarse-pointer density tokens: 44 px hit areas, 44 px bar controls and rows, 56 / 64 px capsule, ≥ 8 px gaps, 16 px inputs, 15 px labels; keycaps only after a physical key press; hover-only affordances always visible under `hover: none` | `tokens.css`, `ui/*`, menus, tooltips |
| M-3 | `viewport-fit=cover`; bars padded with `max(env(safe-area-inset-*), 12px)`; `#root` at `100dvh`; `text-size-adjust: 100%`; `interactive-widget=resizes-content` | `index.html`, `global.css` |
| M-4 | iOS keyboard: track `visualViewport` into `--vv-bottom`; anchor the capsule and accessory bar to it while an input is focused; Base UI `Drawer.VirtualKeyboardProvider` in sheets with inputs | shell, sheets, Find, paragraph editor |
| M-5 | Safari 26 browser tab: add the obscured bottom height to the capsule offset; keep the `body` background `--surface-0` so Safari's sampled tint matches; test fixed scrims against WebKit bug 297779 | shell, scrims |
| M-6 | Phone shell: top bar (‹ N to Home, title as Document menu, ⋯; Undo and Redo in Edit) and a bottom glass capsule (Pages, Find, Edit pill, Share, page pill), centred on the screen | new compact shell |
| M-7 | Edit morphs the capsule in place: Edit pill → Done at the same position; the tool palette scrolls with a fade; options tier above it | `FloatingToolbar` |
| M-8 | Phone landscape: immersive Read; vertical 64 px tool rail, movable to either side and remembered; side sheets 360 px | compact-height shell |
| M-9 | Medium: tabs and the mode control in a 52 px top bar; navigator as a 320 px overlay sidebar; capsule bottom centre; popovers kept; form sheets ≤ 640 px | medium shell |
| M-10 | Expanded: docked, collapsible navigator; inspector as an overlay side sheet; group labels from 960 px | expanded shell |
| M-11 | Xlarge: inspector docked when last open; fit-width capped at 1100 px of page | stage fit |
| M-12 | Adopt the placement matrix of §5.6 as the contract for every surface | all surfaces |
| M-13 | Phone Home: brand title area, bottom "Open PDF", 2-column cards, Recents rows, Select → "Combine N files" bar; touch-appropriate copy (no "Drop", no keycaps) | `home/*`, `EmptyState` |
| M-14 | Hide on scroll in Read on compact and medium (24 px threshold; restore on upward scroll, tap, ends, focus, sheets); never in Edit | Read view, capsule |
| M-15 | Trailing-edge page scrubber (44 × 32 px, inset 16 px) for documents over 20 pages | Read view |
| M-16 | The gesture map of §6, with its thresholds, as the single touch contract; one gesture recogniser module next to `viewer/hit-order.ts` | `viewer/` |
| M-17 | Two-finger tap undo and three-finger tap redo with a naming toast and scroll-to-change; visible Undo and Redo on compact Edit | history, toast |
| M-18 | Stage `touch-action: pan-x pan-y` with app-owned pinch (Safari gesture events plus pointer pairs); chrome keeps `manipulation`; never disable browser zoom | `ReadView.tsx`, CSS |
| M-19 | Double tap toggles fit-width ⇄ 2× (250 % on phones) in Read and in pen-seen Edit | Read view |
| M-20 | 450 ms long press: word selection, annotation selection, page and card action sheets, Arrange lift; `-webkit-touch-callout: none` on pages, thumbnails and cards | viewer, Arrange, Home |
| M-21 | Pinch below fit opens Arrange at the current page; pinch out on an Arrange cell opens it in Read; both also have buttons | Read, Arrange |
| M-22 | Reserve edges: no custom swipe within 24 px of the sides, 34 px of the bottom, 44 px of the top on iPad | gesture module |
| M-23 | `overscroll-behavior: none` on `html`/`body`, `contain` on all scrollers | `global.css`, scrollers |
| M-24 | Direct-display pen detection (`pen` and `maxTouchPoints > 0`) for "Pen draws in Edit" and the finger rules | `edit-policy-store.ts`, `ink-input.ts` |
| M-25 | "Draw with finger" switch in the pen options tier; default on before a pen, off after | pen options |
| M-26 | Safari: cancel `touchstart` only for `touchType === 'stylus'` so fingers keep native momentum; elsewhere own pan with 0.998/ms decay and 0.55 rubber band | `ink-input.ts`, stage |
| M-27 | Pen hover dot preview; cancel the iOS pen double-tap loupe; keep palm rules; treat lone Android `pointercancel` as a palm | pen layer |
| M-28 | Accessory bar above the keyboard for in-page editors on coarse devices; real `<input>`s for form fields | paragraph editor, forms |
| M-29 | Bottom sheets on Base UI Drawer: detents 0.4 and 0.92 of the visual viewport, grabber 36 × 5 px, swipe to lower or dismiss, nonmodal for Pages, Find and Review, modal for dialogs; max width 640 px; one sheet at a time | new `ui/Sheet` |
| M-30 | Touch springs: 380 / 0.8 spatial, 800 / 0.6 for chips, 1600 / 1.0 effects, velocity-inheriting; `linear()` stand-in; reduced motion snaps | motion tokens |
| M-31 | Glass on coarse pointers: ≤ 2 blurred surfaces while scrolling, blur ≤ 20 px, masked top edge, sheets solid at the large detent, overlay sidebars solid; gated by S-T2 | glass tokens |
| M-32 | Aurora on phones only on Home and stage margins, compositor-only, paused during scroll, pinch, drag and draw | aurora |
| M-33 | Canvas budget on coarse pointers (~40 MP live, 1 page overscan, 0 × 0 on release, 1× thumbnails as blob URLs) | `ReadView.tsx`, thumbnails |
| M-34 | Session snapshot to OPFS on `visibilitychange: hidden` and after each history step (debounced 2 s), `persist()`, Restore prompt; `beforeunload` guard on desktop | new `session/` module |
| M-35 | Manifest: PNG and maskable icons, `apple-touch-icon`, `screenshots`, `file_handlers` + `launch_handler` + `launchQueue`, `share_target` with a service-worker route, `shortcuts` | `vite.config.ts`, service worker |
| M-36 | "Share…" via Web Share with files as the primary export on coarse pointers; "Save to device" kept | `export/deliver.ts`, `tools/deliver-file.ts` |
| M-37 | Haptics: Android `vibrate(8–12)` for lift, snap and drop only; nothing programmatic on iOS; a Haptics switch in Appearance | gesture module |
| M-38 | Compare on compact: one page at a time with an A · B · Changes segmented switch instead of side by side | Compare view |
| M-39 | Device test matrix and spikes S-T1 to S-T4 (§12) before the touch defaults are frozen | QA |

Confidence: high for M-1 to M-4, M-6, M-7, M-12, M-16 to M-18, M-20, M-22 to M-24, M-29,
M-34 to M-36; medium for M-5, M-8 to M-11, M-13 to M-15, M-19, M-21, M-25 to M-28, M-30 to
M-33, M-38, M-39; low for M-37.

---

## 12. Open questions and device checks

- **S-T1 Pinch ownership.** On an iPhone (iOS 26) and a mid-range Android phone (Chrome), does
  `touch-action: pan-x pan-y` on the Read viewport deliver both touch pointers of a pinch
  without `pointercancel`, while one-finger scroll stays native? If not on Android, switch that
  platform to `touch-action: none` with M-26's own pan.
- **S-T2 Glass on phones.** Safari's Web Inspector timeline on an iPhone 13-class device and
  Chrome's frame meter on a 2022 mid-range Android: Read scrolling at fit-width with the masked
  top edge and the capsule at blur 12, 20 and 28 px. Accept a blur value only at ≥ 58 fps with
  no dropped frames during a 2 s fling.
- **S-T3 Memory.** Open a 200-page, 50 MB scanned PDF on an iPhone with 6 GB RAM, zoom to 400 %
  and fling through it; record reloads. Confirm that PDFium's 2 GiB declared maximum
  instantiates on iOS 18 and 26.
- **S-T4 Arrange drag.** Does the native HTML drag of pragmatic-drag-and-drop start from a long
  press on iOS 26 Safari and Android Chrome? If either fails, replace it on touch with a
  pointer-driven drag after the 450 ms lift.
- Should two-finger tap undo be single (Procreate, Notability, Freeform) or double (GoodNotes)?
  This document picks single, with the naming toast as the safety net; the owner's tablet
  try-out decides.
- Is the capsule's "‹ N" document count enough of a switcher on phones, or do phones need a
  swipe between open documents (which would conflict with edge rules)?
- iPad with a Magic Keyboard: does Safari report `(pointer: fine)` as primary? The density rule
  in §4.3 assumes coarse primary with fine `any-pointer`; verify on a device.

---

## Sources

Read in full or in the relevant part (primary):

- Apple HIG JSON: [toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars), [tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars), [sheets](https://developer.apple.com/design/human-interface-guidelines/sheets), [layout](https://developer.apple.com/design/human-interface-guidelines/layout), [gestures](https://developer.apple.com/design/human-interface-guidelines/gestures), [Apple Pencil and Scribble](https://developer.apple.com/design/human-interface-guidelines/apple-pencil-and-scribble), [pointing devices](https://developer.apple.com/design/human-interface-guidelines/pointing-devices), [windows](https://developer.apple.com/design/human-interface-guidelines/windows), [the menu bar](https://developer.apple.com/design/human-interface-guidelines/the-menu-bar), [materials](https://developer.apple.com/design/human-interface-guidelines/materials), [buttons](https://developer.apple.com/design/human-interface-guidelines/buttons), [accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields), [popovers](https://developer.apple.com/design/human-interface-guidelines/popovers), [undo and redo](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo), [file management](https://developer.apple.com/design/human-interface-guidelines/file-management), [motion](https://developer.apple.com/design/human-interface-guidelines/motion), [playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics), [drag and drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop) — read in full via `developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json`.
- Material components for Android: [DockedFloatingToolbars.md](https://github.com/material-components/material-components-android/blob/master/docs/components/DockedFloatingToolbars.md), [FloatingToolbar.md](https://github.com/material-components/material-components-android/blob/master/docs/components/FloatingToolbar.md), [BottomSheet.md](https://github.com/material-components/material-components-android/blob/master/docs/components/BottomSheet.md), [NavigationRail.md](https://github.com/material-components/material-components-android/blob/master/docs/components/NavigationRail.md), [motion tokens.xml](https://github.com/material-components/material-components-android/blob/master/lib/java/com/google/android/material/motion/res/values/tokens.xml), floating toolbar and bottom sheet `res/values` — read.
- MDN browser-compat-data, `main` of 2026-10-03: [repository](https://github.com/mdn/browser-compat-data) (viewport meta members, VirtualKeyboard, visualViewport, PointerEvent members, Touch.touchType, touch-action, dvh, env(), overscroll-behavior, manifest members, File System Access, Web Share, OPFS, beforeunload, linear(), container queries) — read.
- mdn/content: [viewport meta](https://github.com/mdn/content/blob/main/files/en-us/web/html/reference/elements/meta/name/viewport/index.md), [VirtualKeyboard API](https://github.com/mdn/content/blob/main/files/en-us/web/api/virtualkeyboard_api/index.md) — read in full.
- tldraw `main`: [useCanvasEvents.ts](https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/hooks/useCanvasEvents.ts), [useFixSafariDoubleTapZoomPencilEvents.ts](https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/hooks/useFixSafariDoubleTapZoomPencilEvents.ts), [utils/pointer.ts](https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/utils/pointer.ts), [useGestureEvents.ts](https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/hooks/useGestureEvents.ts), `Editor.ts` pen-mode block — read in part.
- `@base-ui/react` 1.8.0 `docs/react/components/drawer.md` (this repository's `node_modules`) — read in part (snap points, non-modal, swipe area, virtual keyboard, API).
- [`ios-haptics` 3.2.0](https://www.npmjs.com/package/ios-haptics) README and `dist/index.js` — read in full; [`web-haptics` 0.0.6](https://www.npmjs.com/package/web-haptics) — registry metadata only.
- `@embedpdf/pdfium` 2.15.1 `pdfium.wasm` memory section — measured.
- Recto: `apps/web/index.html`, `vite.config.ts`, `src/styles/global.css`, `tokens.css`, `shell/*.module.css`, `stage/ReadView.tsx`, `stage/ArrangeView.tsx`, `state/ui-store.ts`, `engine/engine-service.ts`, `pages/TiledPage.tsx`, `annotations/pen/ink-input.ts`, `viewer/hit-order.ts`, `export/deliver.ts`; docs `DESIGN.md`, `ROADMAP.md`, ADR-0019, research 03, 12, 13.

Known only from search abstracts or established knowledge:

- iOS 26 tab bar minimize: [Donny Wals](https://www.donnywals.com/exploring-tab-bars-on-ios-26-with-liquid-glass/), [Create with Swift](https://www.createwithswift.com/making-the-tab-bar-collapse-while-scrolling/) — abstract.
- iPadOS 26 windowing and menu bar: [MacStories review](https://www.macstories.net/stories/ios-and-ipados-26-the-macstories-review/9/), [Wikipedia](https://en.wikipedia.org/wiki/IPadOS_26) — abstract.
- Window size classes: [Android developers](https://developer.android.com/develop/ui/views/layout/use-window-size-classes) — abstract.
- M3 toolbar overview: [m3.material.io](https://m3.material.io/components/toolbars/overview); spring tokens summary: [m3-expressive-react#319](https://github.com/minop1205/m3-expressive-react/pull/319) — abstract (superseded by the token file).
- Preview on iPad and iPhone: [Engadget](https://www.engadget.com/mobile/smartphones/apple-is-bringing-preview-to-ipados-175643371.html), [AppleInsider](https://appleinsider.com/inside/ios-26/tips/inside-preview-in-ios-26---how-to-edit-pdfs-sign-documents-and-scan-files), [Apple Support](https://support.apple.com/guide/ipad/annotate-a-pdf-or-image-ipad158dad0a/ipados) — abstract.
- Notability: [settings and gestures](https://support.gingerlabs.com/hc/en-us/articles/5955260981786-Settings-Appearances-Tools-Gestures), [app update history](https://support.gingerlabs.com/hc/en-us/articles/5293937538586-App-Update-History) — abstract.
- GoodNotes: [quick gestures for undo and redo](https://support.goodnotes.com/hc/en-us/articles/14069931315983-Quick-gestures-for-Undo-and-Redo), [floating toolbar feedback](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes-apple/suggestions/50579222-please-make-the-new-floating-toolbar-optional-and) — abstract.
- PDF Expert: [9to5Mac](https://9to5mac.com/2022/06/28/readdle-pdf-expert-redesign/), [PCWorld](https://www.pcworld.com/article/819837/pdf-expert-pdf-editor-review-2.html) — abstract.
- Procreate: [undo and redo](https://help.procreate.com/articles/tvicQm-undo-and-redo), [gestures](https://help.procreate.com/procreate/handbook/interface-gestures/gestures) — abstract. Freeform two-finger tap: [Threads post](https://www.threads.com/@hrswatigupta_official/post/DdDMXpGm22q/the-two-finger-undo-in-notes-freeform-and-most-drawing-apps-a-two-finger-tap/) — abstract.
- iOS 26 web apps: [heise](https://www.heise.de/en/news/iOS-26-and-iPadOS-26-Changed-web-app-behaviour-on-the-home-screen-10749652.html), [iDownloadBlog](https://www.idownloadblog.com/2025/06/17/apple-ios-26-safari-web-apps-home-screen-bookmarks/), [WebKit features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) — abstract.
- Safari 26 toolbar tinting and fixed layers: [Ben Frain](https://benfrain.com/ios26-safari-theme-color-tab-tinting-with-fixed-position-elements/), [1ar.io](https://1ar.io/updates/safari-26-liquid-glass-web/), [Edoardo Lunardi](https://www.edoardolunardi.dev/blog/safari-26-and-the-strange-case-of-fixed-overlays), [WebKit bug 297779](https://bugs.webkit.org/show_bug.cgi?id=297779), [Apple forums 716552](https://developer.apple.com/forums/thread/716552) — abstract.
- iOS keyboard and fixed elements: [DEV Community](https://dev.to/deanliu/the-ios-safari-keyboard-scroll-bug-fixed-with-one-line-of-css-1353), [saricden](https://saricden.com/how-to-make-fixed-elements-respect-the-virtual-keyboard-on-ios) — abstract.
- Canvas and memory limits: [pqina, canvas area](https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/), [pqina, total canvas memory](https://pqina.nl/blog/total-canvas-memory-use-exceeds-the-maximum-limit/), [WebKit bug 195325](https://bugs.webkit.org/show_bug.cgi?id=195325), [Apple forums 112218](https://developer.apple.com/forums/thread/112218), [godot#70621](https://github.com/godotengine/godot/issues/70621), [HN 39039593](https://news.ycombinator.com/item?id=39039593) — abstract.
- Backdrop blur on iOS scrolling: [domi-ops#57](https://github.com/mwhobrey/domi-ops/pull/57), [journal-pwa#4](https://github.com/itexpert120/journal-pwa/pull/4) — abstract.
- Pencil hover in Safari 16.1: [MacRumors](https://www.macrumors.com/2022/10/24/apple-safari-16-1-launch/) — abstract.
- Stylus and palm handling: [Chromium review 2925883003](https://codereview.chromium.org/2925883003), [Android input compatibility](https://developer.android.com/develop/ui/compose/touch-input/input-compatibility-on-large-screens), [jot#14 (S Pen scrolls)](https://github.com/bverbeken/jot/pull/14), [touchType article](https://www.javaspring.net/blog/javascript-touch-event-distinguishing-finger-vs-apple-pencil/) — abstract.
- Web haptics: [WebKit Safari 18 beta](https://webkit.org/blog/15443/news-from-wwdc24-webkit-in-safari-18-beta/), [ionic#29942](https://github.com/ionic-team/ionic-framework/issues/29942), [haptics.kushagragolash.dev (iOS 26.5 change)](https://haptics.kushagragolash.dev/) — abstract.
- Established knowledge, not re-verified here: device point sizes and safe-area insets; iOS input auto-zoom under 16 px; no `contextmenu` on iOS long press; Safari edge swipes for history; UIKit 500 ms and Android 400 ms long-press defaults; UIScrollView deceleration 0.998 and 0.55 rubber band; Hoober's one-handed use study (UXmatters, 2013); Chrome's richer install sheet with `screenshots`; web apps cannot extend the iPadOS menu bar; Pencil double tap, squeeze and barrel roll are not exposed to the web.
