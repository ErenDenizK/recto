# Pinch out to overview on the phone: research

Owner (2026-10-14, translated): "there is no zooming out with two fingers to see all pages, etc. A
drawer opens instead [for pages]. Instead there could be a pop-up, or an interface that appears
directly when you pinch in with two fingers."

Paths are relative to `apps/web/src` unless they start with `docs/`, `e2e/` or `tools/`.

---

## 1. Today

### 1.1 Phone reader pinch (`shell/compact/`)

| Fact | Evidence |
|---|---|
| Zoom is relative to fit width: `MIN_ZOOM = 1`, `MAX_ZOOM = 5`, double tap toggles fit ⇄ `2` | `shell/compact/reader-layout.ts:18-21` |
| Below fit width there is **nothing**: `rubberZoom` lets a quarter of the undershoot show, and the release clamps back to 1 | `reader-layout.ts:271-280` (`rubberZoom`), `clampZoom` `:55-58` |
| The pinch is app-handled on raw TouchEvents (not the gesture core `motion/gesture/pinch.ts`), `preventDefault` on a two-touch `touchstart`/`touchmove` (`passive:false`); the stage gets `translate+scale` per rAF; on lift `zoomAbout` → `settle` (CSS transition `--duration-base --ease-out`, 320 ms timeout) → commit the layout | `CompactReader.tsx:377-469`, `settle` `:282-317` |
| `touch-action: pan-x pan-y` on the scroller: native one-finger scroll, browser pinch-zoom off there | `CompactReader.module.css:7-8, 24` |
| WebKit: `gesturestart`/`gesturechange` are `preventDefault`ed ("Safari's own pinch would zoom the whole page") | `CompactReader.tsx:554-566` |
| Viewport meta has no `maximum-scale`/`user-scalable` (iOS ignores them anyway since iOS 10); chrome buttons use `touch-action: manipulation`, so a pinch that starts on the top bar or capsule is outside the scroller and can still trigger native page zoom on iOS | `apps/web/index.html:5`; `CompactChrome.module.css:101, 317` |
| Mod+wheel / trackpad pinch (`ctrlKey` wheel) zooms per frame, clamped at fit | `CompactReader.tsx:529-552` |

apart show the stage at `scale(0.8167)` (= 1 − 0.733 × 0.25), the release springs back to
`data-zoom="1"`; `visualViewport.scale` stays 1, so the browser did not zoom. Screenshot
`02-mid-pinch-in.png`: the column just shrinks slightly with empty background around it, then
snaps back. That is the dead end the owner feels.

### 1.2 The Pages entry

- Capsule `Pages · n/N · Find`; Pages calls `openSheet('pages')` (`CompactChrome.tsx:356`).
- It opens `CompactSheet` `size="tall"` (`CompactSheets.tsx:80-88`): a Base UI **Drawer** rising
  from the bottom over a scrim, Done / swipe-down / scrim to close (`CompactSheet.tsx:1-80`).
- Content: virtualised grid, **fixed ≥ 3 columns** (`CompactSheets.tsx:128`), 104 px min cell,
  labels under; tap → `jumpTo` and the sheet closes (`:174`). Thumbnails are `PageCanvas` at
  `RENDER_PRIORITY.visible` (`:238-247`).
- Screenshot `06-pages-sheet.png`: an opaque white full-width sheet whose top sits ~100 px down,
  three columns, no motion link between the page you were reading and its tile. It is the one
  surface on the phone that is not floating glass (contrast DSN-32, EDN-8's "superb, not a
  makeshift drawer"). A pinch inside the sheet does nothing (`07-sheet-after-pinch.png`).
- (Fixed by MOB-12: the phone cut's own flatplan page says pinch.) The sample's page 4 says
  "Press 3 or pinch to see every page", which is false on a phone
  (`tools/fixtures/sample-fixture.ts`; EDN-9 rewrites the sample for phones anyway).

### 1.3 Full edition (tablet)

- Zoom controller: a pinch more than **15 % below fit page arms the Pages grid**, the detent
  chip "Release to see all pages" shows (Android haptic `navigator.vibrate`, `stage/use-canvas-zoom.ts:69, 136`),
  release opens the grid at the page under the fingers (`viewer/zoom-controller.ts:10-21, 72, 105`).
- Entering/leaving the grid is a 240 ms View Transition: the current page morphs into its cell
  (`view-transition-name: page-current`), other cells cascade (`stage/grid/grid-transition.ts:1-40`).
- Inside the grid a pinch steps cell size by one detent per ×1.4, FLIP reflow; past the largest
  size × 1.15 "Release to open page 7" and release opens it (`stage/grid/pinch-in-grid.tsx:1-50`).
- Known gap, written down: "Not done: a pinch that scrubs the cascade live (the pinch still
  commits at its threshold and then plays the way out)" (`docs/design/motion-2026-10/pages.md:68`),
  and the innovation roadmap's idea #2 "Pinch-scrubbed Pages grid … progress = scale … manual
  FLIP, not a VT, because VTs cannot be scrubbed" (`docs/research/innovation-2026-10/tracks/motion-interaction.md:88`).
- Flows gesture map: "Pinch … released more than 15 % below fit page → grid" (`docs/design/redesign-2026-10/flows.md:1017`).
- So the tablet already has the *semantics* the owner wants; the phone does not, and neither has
  the *continuous, finger-driven* morph.

### 1.4 Relevant decisions

DSN-10 (grid selection follows Photos), MOT-2 (everything that changes shape animates; reduced
motion opacity ≤ 150 ms), MOT-5 (container transform for popups/sheets), EDN-7/8 (phone: two or
three bar actions, rest in pop-up or drawer; drawer must be superb), EDN-10 (only Pages stays in
the static compact closure), PRC-11 (gates never raised), PRC-14 (motion e2e reads the Web
Animations clock). Compact gate 327 680 B, baseline 298 538 B → ~29 KB headroom (`tools/qa/bundle-budget.json`).

---

## 2. Design research

(W) = confirmed by web search this session; (K) = established knowledge, verify on device.

| Reference | What it does | Take for Recto |
|---|---|---|
| **iOS Photos** library | Pinch steps the grid through densities (1 → 3 → 5 → … columns, then month/year aggregation); the item under the fingers stays anchored while the layout changes around it, and switching Years/Months/Days keeps the focal item and relays out around it (W: Gadget Hacks iOS 13; MacStories). Interpolated collection layouts (`UICollectionViewTransitionLayout`) make it continuous (W, dev forum). | **The anchor rule**: the page under the fingers is the tile that stays under the fingers. Density detents, not free scale. |
| **Safari tab overview** | Pinch in on a page shrinks it into its card in the tab grid; pinch out on a card expands it (W: GIGA, Brave thread). WebKit bugs note the system gesture can fire despite page `preventDefault`, the workaround being `preventDefault` on the starting `touchstart` (W) — Recto already does that. | The canonical "page becomes tile" morph; the system gesture risk is a test item. |
| **Procreate gallery** | Pinch out on a thumbnail previews it full size; pinch in closes back into the stack it came from (W). | Pinch out on a tile dives back in; closing returns to where you came from. |
| **Google Photos** | Pinch changes grid density (Default / Comfortable / Full layouts) with snaps (W, TestingCatalog); third-party "pinch-grid" libraries copy it with haptic snaps (W). | Density detents with a tick. |
| **Apple Notes / Files** | Files: pinch in the icon grid changes icon size (K). Notes gallery view has no pinch morph (K). | Low value beyond density. |
| **Apple Books** | Tap reveals a bottom scrubber of page dots; drag shows a page preview bubble (K). | A *scrubber* complements the grid for long docs (already proposed: page pill hold-to-scrub, ROADMAP line 105). |
| **PDF Expert / Acrobat (phone)** | Pinch only zooms the page; page thumbnails come from a toolbar button into a separate full-screen grid; no pinch-to-grid confirmed (W: Readdle zoom modes). | Recto would be ahead of the PDF category here. |
| **Android Files / Gallery** | Pinch changes grid columns with snap (K). | Same as Google Photos. |

### 2.1 Recommended interaction ("Pinch to overview")

1. **Arm.** From fit width, two fingers closing past fit no longer just rubber-band: the stage
   follows the fingers 1:1 below fit, and the other pages fade in around the shrinking page as
   tiles, laid out in the grid it will land in (the "grid grows around the page" morph). The
   chrome cross-fades: the capsule morphs from `Pages · n/N · Find` to the grid bar (count +
   Done; later Select).
2. **Commit point.** At ~0.85 of fit (the full edition's `GRID_THRESHOLD = 0.15`, so both
   editions share one number) the gesture is *armed*; a small tick (Android vibrate when
   haptics on; visually a 1.04 receive pulse of the anchor tile and its ring appearing). Release
   while armed → spring settle into the 2- or 3-column grid; release unarmed → spring back to fit.
   Velocity counts: a fast pinch-in commits even short of the threshold (projected scale).
3. **Density detents in the grid**: 2 → 3 → 4 columns (and 5–6 for long docs), one detent per
   ×1.4 (the full edition's `GRID_PINCH_STEP`), anchored on the tile under the fingers, FLIP reflow.
   Default landing density 3 on a 390 px phone (matches today's sheet), 2 for ≤ 4 pages? (taste Q).
4. **Dive back in**: pinch out on a tile (past largest detent × 1.15) → the tile grows into the
   page, scrubbed by the fingers; tap a tile also opens it (morph, not scrubbed).
5. **A button path**: the capsule's Pages button runs the *same* morph un-scrubbed (240–320 ms
   spring) instead of raising the drawer. Pages becomes a **place** (full-screen grid over the
   aura, floating glass bar), not a drawer. This replaces the Pages drawer; the drawer is retired.
6. **Built to host page operations**: tiles carry stable `data-page-id`, a selection layer (DSN-10:
   Select / long-press, ring + check badge), a bottom bar slot that becomes the selection bar
   (Rotate · Delete · Extract · Share), drag-to-reorder using the full edition's `make-way`/`lift`
   ideas. The grid component must not assume "tap = jump" only.

Futurist extras (later, optional): pinching past 4 columns collapses into a **chapter/outline
rail** if the file has an outline (Photos' month/year aggregation analogue); a two-finger
"spread" between two tiles makes room to insert/merge (ties to the other researcher's ops).

---

## 3. Technical plan

### 3.1 Gesture state machine (pure, `shell/compact/overview-gesture.ts`)

```
idle ──2 touches──▶ pinching(reader)
pinching(reader): ratio = zoom0 · d/d0
   ratio ≥ 1          → reader zoom path (today's pinchTransform)
   1 > ratio          → overview progress p = clamp((1 − ratio)/(1 − R_FULL), 0, 1)  (R_FULL ≈ 0.45)
   armed = ratio < 1 − 0.15 (or projected ratio with velocity, r 0.99)
release: armed → settle(p→1) then commit 'overview' ; else settle(p→0) then commit reader at zoom 1
interrupt: a new touch during settle grabs the animation at its currentTime
overview: pinch → density detents (log(scale)/log 1.4); pinch-out past max·1.15 on a tile → reverse morph
```

Only when the pinch *starts at fit* (zoom ≤ 1.01) does the overview path open; a pinch from 3×
down clamps at fit first (soft floor, like `softFloor` in `zoom-controller.ts:93`), so zooming
out from a detail never overshoots into the grid by accident. Pure functions → unit tests
like `gestures.test.ts` / `reader-layout.test.ts`.

### 3.2 Rendering at 60 fps on iPhone

- **Layers, not layout.** During the gesture: (a) the existing stage keeps its single
  `transform` (anchor page under fingers); (b) an *overview layer* mounts at gesture start with
  the tiles of the ~2 screens around the anchor already placed at their final grid boxes
  (computed by a pure `gridLayout(sizes, frame, columns)`), each tile `transform`ed from
  "where the page is in the reader at scale s" to its cell, interpolated by p. Only `transform`
  and `opacity` change per frame; nothing re-lays out (same rule as `zoom-controller.ts:3-8`).
- **Drive with WAAPI, scrub by `currentTime`**: create paused `element.animate()` keyframes
  (reader box → cell box) per visible tile, set `currentTime = p · duration` each touchmove rAF;
  on release `play()` from there with a spring easing (`motion/springs.ts` sampled into
  `linear()` keyframes, as `rotate-motion.ts` does) or `reverse()`. This is what makes PRC-14
  testable (the clock *is* the gesture).
- **Thumbnails**: `PageCanvas` non-exact path draws "the best cached lower (or higher) scale at
  once, stretched by CSS" (`pages/PageCanvas.tsx:14-17`) and the service's `preview` takes any
  cached scale (`engine/engine-service.ts:138`). So the anchor tile and its neighbours show the
  reader's own bitmaps instantly; far tiles request quarter-octave buckets at
  `RENDER_PRIORITY.offscreen` → `visible` once settled. Do not request renders during the
  gesture; request on commit (debounce like the reader's zoom).
- **Virtualise**: reuse `visibleRange` over rows (as `CompactSheets.tsx:131-133`); mount ±1
  screen. Cap animated tiles at ~24; others appear by fade after settle.
- **Glass**: the grid bar is one glass piece (Q-1 one backdrop root); tiles are not glass.
- **Avoid** View Transitions for the scrubbed path (not scrubbable); keep VT only if a button
  path wants it — better to use the same WAAPI path for both so they look identical.

### 3.3 Native zoom interplay

- Scroller keeps `touch-action: pan-x pan-y`; the overview layer `touch-action: pan-y` (one
  finger scrolls the grid natively), two-finger handled by us.
- Keep `gesturestart/gesturechange` `preventDefault` on both reader and overview; also add it at
  the reader root so a pinch starting on chrome (`touch-action: manipulation`) does not zoom the
  page (verify on device; WebKit bug reports say system pinch can leak).
- Consider `touch-action: pan-x pan-y` on the chrome pieces too (buttons still click; double-tap
  zoom is already disabled by `manipulation`, which `pan-x pan-y` also prevents).
- Do not add `user-scalable=no` (a11y; iOS ignores it).

### 3.4 Accessibility

- Button path: capsule **Pages** opens the overview (same morph); Done, Esc, and a tile tap
  close it. WCAG 2.5.1 satisfied by the button.
- VoiceOver: the overview is a `role="grid"` (or list as today) with `aria-label` "Pages, 12
  pages"; focus moves to the current page's tile on entry and back to the page on exit; announce
  via `shell/announcer` ("Pages. 12 pages. Page 3." as `grid-transition.ts:23`). Density changes
  announced (`gridSizeAnnouncement`). VoiceOver users never need the pinch (VO intercepts
  two-finger gestures anyway).
- Reduced motion (`reducedMotion()`): pinch tracking stays 1:1 for the anchor page only; commit
  is a crossfade ≤ 150 ms (MOT-2); no cascade.
- Hit targets: tiles ≥ 44 px at the densest detent (4 columns on 390 px ≈ 85 px, fine; 6 columns
  ≈ 55 px still fine).

### 3.5 Bundle

- Static compact closure gains only the pure gesture maths and a lazy loader (< 2 KB gz).
- The overview (grid layout, tiles, WAAPI morph, selection later) is a **lazy chunk**
  `CompactOverview`, prefetched on idle after the reader opens (EDN-10 pattern,
  `CompactSheets.tsx:31-74`). If the chunk is not loaded when a pinch starts, the pinch shows
  today's rubber band plus the arm tick and the release opens the overview by the button morph
  once loaded (graceful).
- The current `PagesGrid` + `Thumbnail` move out of the static closure into that chunk, which
  likely *frees* bytes. Gate: `tools/qa/bundle-budget.json` `compact` (PRC-11, never raise).

### 3.6 Tests

- Unit (vitest): state machine (arm threshold, velocity projection, soft floor from >1, detent
  steps, dive-back threshold), `gridLayout` (columns per width, anchor cell), anchor preservation
  (tile under the fingers stays under them within 1 px at p=0 and p=1).
- Browser/e2e (Playwright, Chromium locally, all three in CI): two-pointer pinch via CDP
  `Input.dispatchTouchEvent` (helpers already exist: `e2e/compact.spec.ts:131-150`,
  `e2e/phone-smoke.spec.ts:169`, `e2e/compact-edit.spec.ts:79`). CDP is Chromium-only, so for
  Firefox/WebKit either skip with a reason or drive the button path; write the gesture spec as
  Chromium-tagged and the button-path spec engine-agnostic.
- PRC-14: read `document.getAnimations()` on the anchor tile mid-pinch — assert `playState
  === 'paused'` and `currentTime` proportional to progress; after release follow until
  `finished`, then assert the grid rests with no transform (Q-2) and focus on the current tile.
  Use `settled(el)` from `test/settled.ts`.
- Screenshots at 390×844 (phone) and on its side; the tablet is unaffected (full edition).

### 3.7 Files and order

1. `docs/process/decisions.md`: row EDN-19 "Pinch to overview on phones; Pages becomes a place".
2. `shell/compact/overview-gesture.ts` (+ test): pure state machine and maths.
3. `shell/compact/overview-layout.ts` (+ test): grid layout, density detents, anchor mapping
   (can share `visibleRange`).
4. `shell/compact/compact-store.ts`: `view: 'reader' | 'overview'`, `overviewColumns`; remove
   `'pages'` from `sheet` once the drawer is retired.
5. `shell/compact/CompactOverview.tsx` + `.module.css` (lazy): tiles from the current
   `CompactSheets.tsx` `Thumbnail`, WAAPI morph driver (`motion/animate.ts`, springs).
6. `shell/compact/CompactReader.tsx`: below-fit branch in `onTouchMove/onTouchEnd` hands
   progress to the overview driver instead of `rubberZoom`'s quarter band; gesturestart guard.
7. `shell/compact/CompactChrome.tsx`: Pages button → `openOverview()`; capsule morph to the
   overview bar (Q-6 bar morph).
8. `shell/compact/CompactSheets.tsx`: drop the Pages sheet.
9. i18n strings (`messages/en.json`, `tr.json`): "Pages", "Release to see all pages" reused,
   overview a11y labels.
10. e2e `e2e/compact-overview.spec.ts`; update `compact.spec.ts` / `phone-smoke.spec.ts` that
    open the Pages sheet.
11. Sample copy for phones (EDN-9): "Pinch to see every page".

### 3.8 Risks

- **iOS Safari system gestures**: a pinch that begins on chrome, or the tab-overview pinch,
  may leak; needs an iPhone hand check (CI WebKit is not iOS).
- **WebKit WAAPI scrub perf** with many tiles: keep ≤ 24 animated, transforms only.
- **Fat-finger conflicts in editing**: two fingers already pinch while editing (README §5). Should
  the overview arm while editing? Proposal: yes, but the island stays and returns on exit; or
  disable while a tool is armed (safer v1).
- **Long documents** (500 pages): the anchor neighbourhood only animates; landing scroll must
  centre the anchor row before the settle.
- **Ink / text selection**: a pinch while a selection bar is shown must dismiss it first.
- **Bitmap memory**: many thumbnails on low-memory iPhones; rely on the LRU budget.

### 3.9 Owner taste questions (max 3)

1. When you pinch out to all pages, should the grid land at **2 big tiles per row** (more
   readable) or **3** (today's sheet), with further pinching for 4?
2. Should the **Pages button** open the same full-screen overview (one place for pages), or keep
   a smaller **pop-up** (a floating glass card of thumbnails rising from the button, MOT-5) as
   the button path while the pinch opens the full grid?
3. Should the overview be where page actions live on the phone (select, reorder, rotate,
   delete), i.e. the phone's "Arrange", or stay a navigation-only view for now?

### 3.10 Recommendation on the drawer

Replace the Pages drawer with the overview place, reachable by pinch and by the Pages button
(same morph, so the button teaches the gesture). If the owner prefers a pop-up for the button, make
it a MOT-5 floating glass card (≤ 55 % height, 2-row horizontally scrolling filmstrip) and keep the
full grid for the pinch; but two different page views is more to learn, so one place is the
default proposal.

Sources (web): macstories.net iOS 13 review p.10; ios.gadgethacks.com iOS 13 Photos features;
developer.apple.com/forums/thread/827102; giga.de Safari tips; community.brave.com Safari-style
tab overview thread; bugs.webkit.org 233141 / 240892 (titles only, not reachable from here);
testingcatalog.com Google Photos grid layout; klibs.io compose-pinch-grid; Procreate gallery
guides (shrushdesign.substack.com, bardotbrush.com); support.readdle.com PDF Expert zooming modes.
