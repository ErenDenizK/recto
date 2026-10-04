---
title: "M9 component spec 05: canvas, page overlays and editors"
date: 2026-10-04
status: proposed
---

# Component spec 05: canvas, page overlays and editors

## 0. Summary

- **Scope.** Everything drawn on or over the page in a document view: the page view and its
  free rectangle, the page surface, zoom, scroll, the hit router with `canChange`, page focus and
  caret mode, the text layer, selection frames, the annotation, ink, lasso, image and created
  field layers, keyboard placement, the three in-place editors (text box, note, paragraph), form
  widgets with the Lock notice and the on-page field stepper, search hits, links, redaction marks,
  crop, furniture preview and the OCR ring. 26 components (§1.4); inventory family 9 (21 items)
  is fully covered, one item is removed (9.14).
- **Content stays solid.** The page is `#ffffff` in both themes, with a hairline and no shadow.
  Marks on it use the selection blue `--select` `#4e61ed` (4.93:1 on white) or the user's inks.
  No lime, no light and no glass is ever part of the page (`language.md` §1.1, §2.10, §3.2).
- **Never under glass at rest.** Fit, centring and every jump land in the free rectangle; tool
  sheets inset it too, so a live preview is never covered (§2). Transient glass anchored at a
  target (a bar, a chip, an editor header) may cover other page content; it never covers its own
  target.
- **Zoom moves pixels, not layout.** Pinch, trackpad and Mod+wheel scale one zoom layer by
  `transform` and commit zoom and layout once at rest; detents at fit width, fit page and 100 %;
  a release 15 % below fit page opens the Pages grid (§4).
- **One hit router.** The order annotation → form widget → link → image → text run → text
  selection, with a live-kind matrix per state (viewing, Markup with Select, a tool, locked) and
  one `canChange` act per press (§6). The Read lock in the layers (`useCanEdit`) goes.
- **Keyboard parity.** Enter on the focused page starts caret mode; Alt+Enter in Find hands the hit
  to the page as a selection; Enter with a placing tool places a ghost at the centre of the
  visible page, arrows nudge 1 pt (Shift 10 pt), Enter commits (§7, §14). This closes INV-16.
- **Editors.** The paragraph editor keeps ADR-0020's engine and overflow decision, gains a single
  header component (M4) placed beside, above or below the paragraph, and on touch an accessory bar
  above the keyboard (M-28). Text box and note keep one-history-step commits.
- 17 issues for the lead and 5 open questions close the file.

## 1. Family overview

### 1.1 How the parts work together

The page view is one virtualized scroll container. Each page hosts the registered overlays
(`stage/page-overlays.tsx`). Every overlay root is `pointer-events: none`; only targets that the
hit router makes live take a press. The router asks `canChange(id, act)` before any change, and
`commit()` refuses a locked document anyway (`flows.md` §2.5).

| z (in a page) | Layer | Live when | Act it asks |
|---|---|---|---|
| 0 | Page surface (canvas or tiles) | Never (decorative) | — |
| 1 | Text layer, search hits, furniture preview, OCR ring | Text selection: always except with a drawing tool | — |
| 1 | Redaction marks | Redact armed: captures the page | `freehand` (area), `targeted` (X on text) |
| 1 | Annotation layer, dry ink, ink preview | Annotations: viewing and Select; a drawing tool captures the page | `targeted`, `freehand` |
| 2 | Form widgets, created fields, link hotspots, image layer | Per §6 matrix | `targeted`, `freehand`, `place` |
| 2 | Edit text targets, paragraph editor, crop layer | Edit text armed, an editor open, crop drawing | `text`, `pages` |
| 3 | Selection frame, lasso box, placement ghost, hover outline | With their selection or tool | as the object's act |
| — (portal, page coordinates) | Inline editors' headers, Lock chip, E chip, link popover, note popover | With their target | — |

The shell (family 03) supplies the free rectangle: top strip, dock band, palette, pending bar and
tool sheets, each as an inset (§2). Bars at a selection (selection, annotation, image, lasso bars,
form accessory) belong to family 08 and anchor to rectangles this family publishes.

### 1.2 Composition

Desktop, large 1440 × 900, viewing, a paragraph open from Markup with Select:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ top strip 44 (M3)                                          inset top 44      │
├──────────────────────────────────────────────────────────────────────────────┤
│ free rectangle: 1440 × 792 (900 − 44 strip − 48 palette − 16 gap)            │
│           ┌──────────────────────────── page 1100 max, #fff, hairline ─┐     │
│           │ The parties                      ╭ header M4, beside ────╮ │     │
│           │ ┊┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┊  │ Esc or click outside  │ │     │
│           │ ┊ This agreement sets out the|┊  │ to apply          ⓘ   │ │     │
│           │ ┊ terms on which the Club …  ┊  ╰───────────────────────╯ │     │
│           │ ┊┄┄┄┄┄ 1 px --select, 4 px out┊                           │     │
│           │ [Name ▒▒▒▒▒▒▒▒]  field: 2-band focus ring when focused    │     │
│           │ ▬▬▬ search hit --select-wash   ◇ link hotspot             │     │
│           └───────────────────────────────────────────────────────────┘     │
│ 16 gap ───────────────────────────────────────────────────────────────────── │
│              ╭ palette 48 (M2), Done │ ↖ │ ●●● … ╮      ╭ 3 / 12 · 96 % ╮     │
└──────────────────────────────────────────────────────────────────────────────┘
```

Phone, compact 390 × 844, viewing, a field focused with the keyboard up:

```
┌──────────────────────────────┐
│ ‹ 3  form.pdf ▾  ↶ ↷  ⌕      │ top bar 44 + safe area
│ ┌──────────────────────────┐ │ page at 374 px (8 px gutters)
│ │ Name [Ada Lovelace     ] │ │ field editor magnified to 16 px text
│ │ Date [▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒] │ │ ← focused, scrolled into the free rect
│ └──────────────────────────┘ │   above the keyboard (visualViewport)
│ ╭ ‹  › · Clear · Done ─────╮ │ form accessory (family 08), 44
│ ╰──────────────────────────╯ │
│ ░░░░░░ keyboard ░░░░░░░░░░░░ │
└──────────────────────────────┘
```

### 1.3 Shared rules and new tokens

| Rule | Value |
|---|---|
| Page colour | `--page-background: #ffffff`, both themes; "dim pages" stays a dark-theme compositing option |
| Page edge | `--page-hairline`: dark `--border-hairline`, light `rgb(21 23 28 / 0.14)`; `--radius-page` 2; e0 |
| On-page selection | `--select` `#4e61ed`; `--select-wash` `#d3d8fb` (multiply, 0.25); `--select-wash-strong` `#afb8f7` (0.45) |
| Editor surface (new) | `--editor-surface: #ffffff`, `--editor-ink: #15171c`, both themes (`language.md` §2.10 "page white with page ink") |
| Handles (new) | `--handle-size` 9 px fine / 13 px coarse, `--handle-hit` 24 / 44, `--handle-stroke` 1.5 px `--select`, fill `--page-background`, e1 |
| Redaction on page (new) | `--redact-page: #c21725` both themes (the page is always white, 6.10:1), hatch 45° 6 px at 18 % |
| Crop dim (new) | `--crop-dim: rgb(21 23 28 / 0.45)` outside the kept area, preview only |
| Focus on page | §9.2 two-band ring; on-page targets `scroll-margin` = 8 px plus the free-rect insets |
| Motion | No animation on content itself; only `transform` on the zoom layer, rings and frames |

### 1.4 Component index

| § | Component | Replaces (inventory) | Fate |
|---|---|---|---|
| 2 | Page view and free rectangle | 9.1 Read view, `stage-bleed.ts`, `ScrollProxies.tsx` | Rework |
| 3 | Page surface | 9.2 Page canvas and tiles | Keep, restate |
| 4 | Zoom controller | 9.1 zoom code, 8.6 zoom menu's role (menu moves to the pill) | New |
| 5 | Scroll, momentum, page scrubber | 9.1 scroll; M-15 | Rework, new scrubber |
| 6 | Hit router | `viewer/hit-order.ts`, `edit-policy.ts` | Re-gate |
| 7 | Page focus and caret mode | — (INV-16) | New |
| 8 | Text layer and selection | 9.3 | Re-colour |
| 9 | Hover outline and edit hint | 9.4 | Re-gate |
| 10 | Selection frame | 9.7, 9.9, 9.15, 9.16 handles | New shared |
| 11 | Annotation layer and undo reveal | 9.7 | Re-gate |
| 12 | Ink preview, dry ink, pen hover dot | 9.8 | Keep, add dot |
| 13 | Lasso | 9.9 | Keep, re-colour |
| 14 | Placement ghost | 9.15 keyboard placement, generalised | New |
| 15 | Text box editor | 9.10 | Keep |
| 16 | Note editor | 9.11 | Rework |
| 17 | Paragraph editor and doors | 9.18, 8.19, 9.17 line editor | Rework header |
| 18 | Edit text targets | 9.17 targets | Keep |
| 19 | Form widgets, Lock notice, field stepper | 9.13, 9.14 | Rework |
| 20 | Created fields layer | 9.15 | Re-gate |
| 21 | Image layer | 9.16 | Re-gate |
| 22 | Search highlights | 9.5 | Re-colour |
| 23 | Link hotspots and link popover | 9.6, 8.18 | Re-gate |
| 24 | Redaction marks | 9.12 | Re-colour |
| 25 | Crop layer and draw banner | 9.19 | Rework banner |
| 26 | Furniture preview | 9.20 | Keep, inset rule |
| 27 | OCR word ring | 9.21 | Re-colour |

## 2. Page view and the free rectangle

**Role.** The document's reading surface (J2, J15a, J15b and every job that happens on a page);
`flows.md` §1.2 principle 6, §6.2. Replaces 9.1 `stage/ReadView.tsx`, `stage/stage-bleed.ts` and
`stage/ScrollProxies.tsx`.

**Anatomy.** The scroll container covers the whole window under the glass (full bleed, as
today). The page column is laid out in the free rectangle.

| | compact | medium | expanded | large / xlarge |
|---|---|---|---|---|
| Side gutter (min) | 8 | 16 | 24 | 32 |
| Gap between pages | 8 | 12 | 16 | 16 |
| First page top | inset + 8 | inset + 12 | inset + 16 | inset + 16 |
| Bottom pad after last page | dock band + 8 | dock band + 16 | same | same |
| Fit width cap | none | none | none | 1100 px of page from xlarge (M-11) |

Insets (CSS px): top = top strip 44 (52 coarse) or compact top bar 44 + safe area; bottom = dock
band (dock 48 / 56 / 64 + 16 gap, or `max(safe-area, 12px)` on phones), plus the palette's delta
over the dock, the options tier 40 + 8 and the pending-marks bar 40 + 8 when shown; leading = a
docked sidebar 280; trailing = a tool or task side sheet (360 / 400 / 480) or Compare's docked
Changes. Overlay sidebars, contextual bars and toasts do not inset.

**Material and light.** None: the stage background is `--canvas` (dark n1, light n4). Glass
floats above; the free rectangle keeps it off the page at every rest.

**States.**

| State | What changes |
|---|---|
| Rest | Pages at fit width, centred in the free rectangle; the current page is the one whose area in the free rectangle is largest |
| Scrolling | Pages pass under the glass; light paused (AU-14) |
| Inset change (palette opens, sheet opens) | The column re-centres by FLIP in sync with the surface (*panel*), no reflow of the current anchor |
| Chrome hidden (compact) | Insets stay at the shown values, so nothing re-lays out on hide or show |
| Locked | No visual change on the page (A-19); glyphs elsewhere |
| Empty (0 pages) | Not reachable: a document always has ≥ 1 page |
| Error (engine lost) | Each page shows §3's error state; a toast "The PDF engine stopped · Reload" |

**Content and copy.** Region name "Pages of {title}" / "{title} sayfaları" (existing
`a11y_pages_viewport`); each page "Page {n} of {total}" / "Sayfa {n} / {total}", with "labelled
{label}" / "etiketi {label}" when page labels differ.

**Behaviour.** Layouts Continuous · Single · Two-up from the page pill. Single uses
`scroll-snap-type: x mandatory` on touch (MC-26). Every programmatic move (go to page, Find,
outline, links, undo reveal, focus) passes `scrollIntoFreeRect(rect)`, which uses
`scroll-padding` equal to the insets. Focus entering the viewport by Tab or F6 lands on the
current page. Edge: a page taller than the free rectangle aligns its top to the inset top.

**Motion.** *panel* (smooth) for inset changes; *scroll-to* for jumps. RM: instant.

**Accessibility.** `role="region"`, focusable (axe scrollable-region-focusable); A-12 (no focus
under chrome), A-13, A-20 (at 320 × 256 the compact gutters apply).

**Implementation.** Rename `stage/ReadView.tsx` → `stage/PageView.tsx` (Read retires). New
`viewer/free-rect.ts` (replaces `stage-bleed.ts`'s frame measurement with a registry: each floating
surface calls `useFreeRectInset(side, px)`). `ScrollProxies.tsx` kept on fine pointers. Tests:
unit for `free-rect` sums and the column maths per class; browser-mode: opening a side sheet
re-centres without moving the anchor line > 1 px; e2e `rest-rule.spec.ts`: after go to page, Find,
outline and undo, the target rect is ≥ 50 % outside every floating chrome rect at 1440 × 900,
820 × 1180 and 390 × 844 (A-12).

## 3. Page surface

**Role.** The rendered page, the brightest thing on screen (`language.md` §0.1 principle 2);
all jobs. Replaces 9.2 `pages/PageCanvas.tsx`, `pages/TiledPage.tsx` (kept).

**Anatomy.** A sheet at the page's display size, bitmap at exact device scale, tiles above
16 MP. Coarse pointers keep about 40 MP live, 1 page of overscan (M-33).

```
┌────────────────────────┐ ← 1 px --page-hairline, radius 2, no shadow
│ white sheet at aspect  │   skeleton: white, no grey bars
│        ◌ (after 400 ms │   24 px neutral activity glyph, n8 on white
│         in the centre) │
└────────────────────────┘
```

**Material and light.** Solid content. Never glass, never tinted (except "dim pages" in dark),
light never within 64 px (A-6). Forced colours: the bitmap stays (it is content); the hairline
becomes `CanvasText`.

**States.**

| State | Look |
|---|---|
| Loading | White sheet at once; low-resolution bitmap, then sharp (X-5); first bitmap fades in over `--duration-fast` (120 ms); later swaps are instant |
| Busy > 400 ms | 24 px `circle-notch` glyph, `#a8abb1` on white, opacity pulse 1.6 s (no rotation, no lime) |
| Error | `warning` glyph and "Page {n} could not be shown · Try again" / "{n}. sayfa gösterilemedi · Yeniden dene" in `#c21725` on white (6.10:1), the link a 44 px target on coarse |
| Zoom gesture | Bitmap stretched by the zoom layer's transform; re-rendered 160 ms after commit |
| Locked, hover, focus | Unchanged; focus ring belongs to §7 |

**Behaviour.** Canvas is `aria-hidden`; the page's text layer gives its content. A page without
text is `role="img"` named "Page {n}, no text" / "Sayfa {n}, metin yok".

**Motion.** Fade-in only (*progress* rule: no spinner before 400 ms). RM: fade 100 ms.

**Accessibility.** A-6 pixel test; the error link has a name and focus ring.

**Implementation.** `PageCanvas.tsx`, `TiledPage.tsx` keep; `PageCanvas.module.css` adopts
`--page-hairline`. Tests: rendered-pixel "page corners identical with light on and off" and "page
`#ffffff` in light, dark and Solid"; unit for the 400 ms busy gate.

## 4. Zoom controller

**Role.** Zoom by pinch, trackpad, Mod+wheel, keys, double tap and the pill, at 60–120 fps with
no layout per frame (MP-8, MO-7, MC-23, MC-24); the gesture into the Pages grid (`flows.md` §7.1,
MC-9). J2, J15. Replaces the zoom effect in `ReadView.tsx` (lines 607–676: `setZoom` per event,
a full re-layout each time).

**Anatomy.** One zoom layer wraps the virtualized column. During a gesture it carries
`transform: translate(tx, ty) scale(s)` about the anchor; at rest it has no transform.

```
pinch below fit page by > 15 %:            fine and coarse alike
      ┌───────┐ ┌───────┐
      │ page  │ │ page  │   ╭──────────────────────────────╮
      └───────┘ └───────┘   │ ▦  Release to see all pages  │ M1 chip, 36 / 44 high,
                            ╰──────────────────────────────╯ 24 px above the midpoint
```

**Material and light.** The page stays solid. The detent chip is M1 (σ 7 at 36 px, 8 at 44 px,
c ≥ 0.990), e2, transient; Solid: n4 / light n1 with rim; forced colours: `Canvas` with border.

**States.**

| State | What happens |
|---|---|
| Rest | Zoom committed in `ui-store`; fit mode (width or page) kept while the window resizes |
| Gesture (pinch, trackpad ctrl+wheel, Safari `gesture*`) | 1:1 scale about the midpoint; range extended so placeholders cover `viewport / s`; text selection, hover outline and light paused; `will-change: transform` on the layer only |
| Past a limit | Rubber band in log space, `L = 0.25` (≤ 19 % past 25 % or 500 %) |
| Below fit page | Soft limit at fit page with the same rubber band; past 15 % the chip shows, Android vibrates 8 ms once (snap, M-37) |
| Release | Velocity of log2(zoom) projected with r 0.99; snap to fit width, fit page or 100 % within 6 %; settle on `--spring-fling`, then one commit; past 15 % below fit page → Pages grid at this page (*view change*, 240 ms) |
| Mouse notch | One ×1.26 step on `--spring-quick`; more notches retarget with velocity; at fit page, a notch after a 300 ms pause enters the grid |
| Keys | Mod+= / Mod+- next `ZOOM_LEVELS` step (25 %…500 %) about the free-rect centre (*zoom step*); Mod+0 fit width |
| Double tap (touch) | Fit width ⇄ 250 % about the tap (M-19, *smart zoom*, glide); with a drawing tool and finger drawing on, the tool acts |
| Locked | Everything works |
| Busy (bitmaps re-rendering) | Stretched bitmap shows; no indicator unless > 400 ms (§3) |

**Content and copy.** Chip: "Release to see all pages" / "Tüm sayfaları görmek için bırakın"
(`squares-four`, 20 px). Announcement after commit, debounced 500 ms, polite: "Zoom {percent}" /
"Yakınlaştırma {percent}" (`formatPercent`, so Turkish reads "%150"); "Fit width" / "Genişliğe
sığdır", "Fit page" / "Sayfaya sığdır" at detents. Tabular figures in the pill.

**Behaviour.**

| Input | Effect | Guard |
|---|---|---|
| Two fingers (any state, any tool) | Pan and zoom; never ink (`flows.md` §3.1) | none |
| Trackpad pinch (ctrl+wheel, small deltas) | 1:1; gesture ends 150 ms after the last event | none |
| Mod+wheel notch | Step, as above | none |
| Pen | Never zooms | — |
| Commit | `setZoom(z, anchor)` once; scroll set so the anchor's content point stays under the same screen point; transform removed in the same frame | — |

Focus does not move. The stage keeps `touch-action: pan-x pan-y` (M-18); browser zoom is never
disabled. Edge cases: a pinch that starts on a selection handle is a pinch (second finger wins
within 150 ms); a resize during a gesture ends it at the current scale; Safari `gestureend` and a
lost pointer both end the gesture.

**Motion.** *pinch, smart zoom* (track → fling; glide), *zoom step* (quick), *view change* for the
grid. Interruption: a new gesture grabs the settling spring at its value and velocity. RM: 1:1
kept, no momentum, release snaps instantly, steps instant, grid by 150 ms cross-fade.

**Accessibility.** Every gesture has keys or the pill (WCAG 2.5.1); the chip is `aria-hidden`
(the grid announces itself, family 10); A-9 (no programmatic zoom animation under RM), A-10 (no
`::view-transition` during zoom steps).

**Implementation.** New `viewer/zoom-controller.ts` (pure maths: projection, detents, rubber band,
anchor) on `motion/springs.ts`; the M-16 recogniser (pointer pairs, Safari events, wheel
classification) lives with every other recogniser in `motion/gesture/` (spec X5), and the viewer
only hit-tests. `ui-store.setZoom(z, anchor)` called once per gesture.
Tests: unit for snapping, rubber band, notch vs trackpad classification and anchor maths; e2e
`motion.spec.ts` "zero layouts during pinch" (PerformanceObserver on `layout-shift` and a forced
style-recalc counter), CDP two-touch pinch below fit opens the grid at the current page,
Mod+wheel pause rule; browser-mode: commit keeps the anchor within 1 px.

## 5. Scroll, momentum and the page scrubber

**Role.** Moving through the document (J2, J4, J15) and the trailing scrubber for long files on
touch (M-15, `flows.md` §6.3). Replaces 9.1's scrolling and INV-8's lost one-finger scroll.

**Anatomy.**

```
compact / medium coarse, file > 20 pages, while scrolling:
                         ┌────┐
   page …                │ 47 │ ← thumb 44 × 32, M1, inset 16 from the trailing edge,
                         └────┘   travels the free rectangle's height
```

**Material and light.** Thumb M1 (σ 6, c ≥ 0.990 at 32 px), e2. Solid: n4 / n1. Forced colours:
`ButtonFace` with `ButtonText`.

**States.**

| State | Look and rule |
|---|---|
| Native scroll | Wheel, keys, one finger in viewing and in Markup with Select, two fingers always; `overscroll-behavior: contain` (M-23) |
| Own pan | Only when one finger draws (Markup, Draw with finger on): two fingers pan with 0.998/ms decay and a 0.55 rubber band (M-26) |
| Scrubber hidden | At rest and on fine pointers (fine pointers keep `ScrollProxies`) |
| Scrubber shown | 0 → 1 over 120 ms on scroll; hides 1.5 s after the last scroll; while dragged, the label shows the page number (tabular) |
| Hide-on-scroll signal | The view emits `scrollIntent` (down after 24 px, up) for family 03; it never emits with keyboard modality or focus in chrome |

**Content and copy.** Scrubber `role="slider"`, name "Scrub pages" / "Sayfalarda gezin",
`aria-valuetext` "Page {n} of {total}" / "Sayfa {n} / {total}".

**Behaviour.** Space and Shift+Space page, `[` `]` previous and next page, Home and End. Dragging
the scrubber jumps (no smooth scroll) and releases on the page under it. Arrow keys on the
scrubber step one page. Guard: none.

**Motion.** Native momentum; own pan uses projection and *sheet*-like rubber band. Scrubber fade
`--duration-fast`. RM: no momentum on own pan; fades kept.

**Accessibility.** Scrubber thumb 44 × 44 hit area (A-15); it is never the only way (the pill's
Go to page is).

**Implementation.** New `viewer/PageScrubber.tsx`; own pan in `annotations/pen/ink-input.ts`
(two-finger branch); `scrollIntent` in `viewer/read-controller.ts`. Tests: CDP touch scroll with
Pen armed and finger drawing on (two fingers pan, one draws); scrubber appears only above 20 pages
and on `hasTouch` projects.

## 6. Hit router: hit order with `canChange`

**Role.** One answer to "what does this press mean" (ADR-0019 §6 kept, `flows.md` §2.5, §3.1).
Replaces `viewer/hit-order.ts`'s `liveHitKinds(mode, editable)` and the Read checks in each layer.

**Anatomy.** No pixels. Order: **annotation → form widget → link → image → text run → text
selection** (link is new; today links sit outside the order).

**Live kinds per state** (`liveHitKinds({ markup, tool, locked })`):

| State | Annotation | Form widget | Link | Image | Text run | Text selection |
|---|---|---|---|---|---|---|
| Viewing | Select on press; drag moves only if already selected | Focus, fill | Follow | Context menu only | — | Drag selects; double-click selects word |
| Markup, Select | Same | Same (created fields: §20) | Follow | Context menu only | Double-click opens editor; 400 ms outline (§9) | Same |
| Markup, Select, pen input once a pen has been seen | — (the pen draws with the last pen; ink never hit-tests; a pen double tap never opens the editor, MK-18, S4) | — | — | — | — | — |
| Markup, drawing tool | — (ink never hit-tests) | — | — | — | — | — |
| Markup, placing tool (T, N, I, stamp, G, field) | — | — | — | — | — | — |
| Markup, Image tool | — | — | — | Select, move, resize | — | — |
| Markup, Edit text tool | — | — | — | — | Click opens; Tab to paragraphs | — |
| Markup, Redact | — (layer captures text or area) | — | — | — | — | — |
| Locked (any) | Opens its comment read-only | Focus, Lock chip | Follow | Context menu only | — | Drag selects |

**Press → act** (asked before anything changes; on false the Lock chip or the Unlock popover
opens at the control that asked, `flows.md` §2.6):

| Press | Act |
|---|---|
| Type in a field, toggle a box, pick a choice, sign a signature field | `targeted` |
| Move, resize, restyle, delete a selected annotation, image or created field | `targeted` |
| H U S C X on a text selection | `targeted` |
| Stroke, shape, eraser, lasso move, Redact drag | `freehand` |
| "Add … here", keyboard placement (§14), a placing tool's click in Markup (field kinds included) | `place` |
| Paragraph or line editor commit | `text` |
| Crop drawn on the page | `pages` |
| Furniture Apply, Apply redactions | `document` |

Input rules that the router enforces: a navigating press never selects (S10); a drag that starts
on an unselected annotation moves nothing (S14); a click under 2 px and 200 ms with a drawing tool
leaves no ink (B's L4); a pen in viewing acts as a mouse (S1); finger rules from
`input-policy-store` (Draw with finger, pen seen, M-24). Link vs selection: a press on a link that
moves ≥ 4 px (mouse), 3 px (pen) or 10 px (touch) becomes a text selection and does not follow.

**States, copy, motion.** None of its own; it drives the Lock chip (§19) and the Unlock popover
(family 07) on refusal. Announcement on refusal: "Locked. Unlock to change it." / "Kilitli.
Değiştirmek için kilidi açın."

**Accessibility.** The same matrix decides which targets are in the Tab order (§7).

**Implementation.** `viewer/hit-order.ts` gains `link` and the state object; `viewer/edit-policy.ts`
→ `viewer/input-policy.ts` (names only, plus M-24 detection); layers call `useCanChange(id, act)`
from `state/guard.ts`. Delete every `useCanEdit` in `forms/`, `annotations/`, `text-edit/`,
`image-objects/`, `redaction/`, `viewer/`. Tests: unit for the full matrix (9 states × 6 kinds) and
for "every committing command declares an act" (registry test, `flows.md` §2.5); e2e
`input-rules.spec.ts` drives S1–S18 rows that touch the page (S1–S7, S9, S10, S14–S17) in the
unlocked and locked columns and asserts unchanged engine bytes when locked, plus a pen double tap
on text in Markup with Select after a pen has been seen: ink, no editor (spec 05.12).

## 7. Page focus, caret mode and Alt+Enter

**Role.** Keyboard reading and selecting on the page (FL-R9, `flows.md` §3.4, §7.2): J5 and J9
keyboard paths (6 and 7 steps), J10's keyboard area. New; closes INV-16. Code: new
`viewer/caret.ts` (named in `flows.md` §10).

**Anatomy.**

```
focused page (keyboard only):            caret mode:
┏━━━━━━━━━━━━━━━━━━━━━━┓  2 px ink,         This agreement sets out the terms
┃ ┌──────────────────┐ ┃  2 px lime,        on which the Club lets the River|side
┃ │ page             │ ┃  2 px ink,         ▒▒▒▒▒▒▒▒▒▒▒▒▒ ← Shift+arrows: --select-wash
┃ └──────────────────┘ ┃  outside the       caret 2 px × line height, --select, steady
┗━━━━━━━━━━━━━━━━━━━━━━┛  hairline (offset 4)
```

**Material and light.** Ring per §9.2 (lime band between ink bands; worst best band 4.07:1 over
`--select`). Caret `--select` on white 4.93:1. No glass, no light. Forced colours: system outline;
caret `Highlight`; selection `Highlight` / `HighlightText` via `::selection`.

**States.**

| State | Look | Notes |
|---|---|---|
| Page focused (Tab, F6, Mod+O landing) | Ring around the current page | Never after a click (`data-focus-ring` rule kept) |
| Caret mode | Caret at the start of the first text line inside the free rectangle | Enter on the focused page; announced |
| Caret selection | `--select-wash` multiply under text (ink 12.42:1) | Shift+arrows, Shift+Home/End |
| No text on page | Enter announces "No text on this page · Recognize text…" and stays | Link to OCR sheet |
| Placing tool armed | Enter starts placement (§14), not caret | — |
| Locked | Caret and selection work; H U S C X E open the Unlock popover | — |

**Content and copy.**

| Event | English | Turkish |
|---|---|---|
| Caret on | Caret on page {page}. Arrows move, Shift with arrows selects, Esc leaves. | İmleç {page}. sayfada. Oklar imleci taşır, Shift ile oklar seçer, Esc çıkar. |
| Selection | Selected “{text}” on page {page} | {page}. sayfada “{text}” seçildi |
| Caret off | Caret mode off | İmleç modu kapandı |
| No text | No text on this page · Recognize text… | Bu sayfada metin yok · Metni tanı… |

`{text}` is cut at 80 characters with an ellipsis.

**Behaviour.**

| Key | Effect |
|---|---|
| Enter (page focused) | Caret mode, or placement with a placing tool armed |
| ← → / ↑ ↓ | Character / line, in the text layer's reading order; crosses to the next page at the end |
| Mod+← → (Windows, Linux), Alt+← → (macOS) | Word; in caret mode this wins over `Alt+arrows` page move (issue 4) |
| Home / End | Line start / end |
| Shift + any of these | Extends the selection |
| H U S C X | Act on the selection (`targeted`), one undo step each; caret stays at the selection end |
| E | Outlines the paragraph (§17); Enter opens the editor with the selection carried in |
| Mod+C | Copy |
| Esc | Clears a selection; with none, leaves caret mode; focus stays on the page |
| Alt+Enter in Find | The current hit becomes the selection, focus moves to the page in caret mode at the hit's end, the hit scrolls into the free rectangle, "Selected …" is announced |

**Motion.** None: the caret does not blink (principle 5) and keys never animate. Moving to an
off-screen line uses *scroll-to*. RM: same.

**Accessibility.** The page keeps `role="region"`; the caret is decorative (`aria-hidden`), the
selection is a real DOM `Selection` on the text layer so screen readers and `Mod+C` see it; A-11,
A-12 (the caret line scrolls into the free rectangle), A-13.

**Implementation.** `viewer/caret.ts` (model: position as span index + offset; navigation over
`TextLayer` spans; DOM `Selection` sync) and `viewer/Caret.tsx` overlay. The Find panel (sidebar
family) calls `caret.selectRange(range, { focusPage: true })` on Alt+Enter. Tests: unit for
navigation across lines, columns and pages; e2e `keyboard-text.spec.ts`: J5 keyboard (Mod+F,
phrase, Alt+Enter, C, type, Esc = 6 steps) and J9 keyboard (7 steps) on `demo-agreement`; axe in
caret mode EN and TR.

## 8. Text layer and text selection

**Role.** Transparent spans for selection, copy, find and assistive technology; the start of
every selection act (J5, J9, J10). Replaces 9.3 `viewer/TextLayer.tsx` (kept).

**Anatomy, material.** Spans over the text; selection `::selection` background `--select-wash`
(`#d3d8fb`, ink 12.42:1). Content, solid. On touch the browser's own handles and callout appear;
`-webkit-touch-callout: none` on pages suppresses the iOS callout so the selection bar (family 08)
is the only menu (M-20). Forced colours: `Highlight`.

**States.** Rest: invisible. Selecting: wash. Locked: same. Drawing tool armed: spans inert
(`pointer-events: none`). Busy (page text not yet extracted): selection starts after extraction;
nothing announced.

**Content.** None visible. Spans carry the text; the page region's name gives the page.

**Behaviour.** Drag selects (all states except a drawing tool); double-click selects a word, also
in Markup with Select when the press misses a run (the run case opens the editor, §17); long press
selects a word on touch (450 ms, 10 px slop). The selection publishes its client rects for the
selection bar. Copy keeps reading order (`installCopyHandler`). Guard: none.

**Motion.** None. **Accessibility.** Real text in the DOM; `lang` from the PDF when known.

**Implementation.** `TextLayer.module.css` swaps `--accent-*` for `--select-wash`; the hover
outline code moves to §9's component. Tests: rendered-pixel wash colour on white; e2e long-press
selection on the touch project shows the selection bar and not the iOS callout.

## 9. Hover outline and edit hint

**Role.** Shows which paragraph a double-click will open, only where a double-click edits:
Markup with Select (`flows.md` §3.1 row "Hover on text", §3.4 Mouse). J9. Replaces 9.4 (today
also shown with Edit text in Edit mode).

**Anatomy.**

```
 ┌┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┐  1 px --select, solid, 2 px outside the paragraph box
 ┆ This agreement sets out the  ┆
 └┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘
   ╭ Double-click to edit text ╮   tooltip (solid), 8 px below, once per device
```

**Material.** Outline is content (on the page). The hint uses the tooltip primitive: solid n4
(light n1) with the glass rim, not glass (`language.md` §2.10). Forced colours: outline
`Highlight`; tooltip `Canvas`/`CanvasText` with border.

**States.** Shown after 400 ms of idle mouse or hovering-pen hover with no button down, never
within 500 ms of a pen lift, never from touch (`hoverAllowed`). Hidden over an annotation or a
widget (hit order), over an open editor, with any tool but Select, in viewing, when locked.
Blocked run: the outline is dashed 4 3 and the tooltip says "“{text}” is not editable: {reason}"
(existing `text_edit_run_blocked`).

**Copy.** "Double-click to edit text" / "Metni düzenlemek için çift tıklayın" (existing). The
same hint shows once below a line on the first single click on text in Markup with Select.

**Behaviour.** Cursor `text` over runs in Markup with Select. Guard: none (it changes nothing).

**Motion.** *hover* (60 ms fade in, none out); hint *tooltip*. RM: no scale.

**Accessibility.** Pointer-only aid; keyboard users get §17's paragraph targets and E then Enter.
`aria-hidden` outline; the tooltip is not announced (it repeats a visible door).

**Implementation.** New `viewer/HoverOutline.tsx` split out of `TextLayer.tsx`; gate
`markup && tool === 'select' && !locked`. Delete the Edit-text-tool hover branch (the tool's own
hatching stays, §18). Tests: unit for the gate matrix; e2e: no outline in viewing after 600 ms
hover, outline in Markup with Select.

## 10. Selection frame: outlines and handles

**Role.** One frame for every selected object: annotation, image, created field, lasso group,
crop box, placement ghost (J5, J6, J8A, J10). New shared component; replaces four
implementations (`AnnotationLayer` handles, `LassoSelection` handles, `ImageLayer` HANDLE_SIZE 8,
`CreatedFieldLayer`).

**Anatomy.**

```
             ◯  rotate grip 10 px, stem 16 px (lasso, image)
             │
 ◯╌╌╌╌╌╌╌╌╌╌╌◯╌╌╌╌╌╌╌╌╌╌╌◯     outline 1.5 px --select, dashed 4 3
 ┆                       ┆     handles: circles 9 px fine / 13 px coarse,
 ◯       selected        ◯     page-white fill, 1.5 px --select stroke, e1
 ┆                       ┆     hit squares 24 / 44, pushed outward, never overlapping
 ◯╌╌╌╌╌╌╌╌╌╌╌◯╌╌╌╌╌╌╌╌╌╌╌◯     line and arrow: two end handles only
```

Below 32 × 32 CSS px of object, only the four corners show; below 16 px, none (move only) and the
contextual bar offers size in ⋯.

**Material and light.** Content. Strokes `vector-effect: non-scaling-stroke`. Forced colours:
outline and stroke `Highlight`, fill `Canvas`. `prefers-contrast: more`: outline 2 px solid.

**States.**

| State | Change |
|---|---|
| Selected | Outline + handles appear (no animation) |
| Hover on a handle (fine) | Handle fill `--select-wash`; resize cursor per direction |
| Pressed / dragging | Outline solid; the contextual bar hides (*contextual*); live size readout in pt in the bar on release |
| Focus-visible (box focused) | §9.2 ring around the box, offset 6 px |
| Locked | Outline only, no handles; drag refused (Lock chip) |
| Multiple selected | One frame around the union |

**Copy.** Box name from the object ("Ink, 3 strokes", lasso `lasso_box_label`), plus "Arrow keys
move it, Shift and arrows resize it, Alt and arrows rotate it" / existing Turkish. Size readout
"{width} × {height} pt", tabular.

**Behaviour.** Arrows 1 pt, Shift+arrows 10 pt (move); Shift+arrow resizes when the box is
focused and Alt+arrows rotates where rotation exists (keys from `lasso/keys.ts`); Delete deletes
with a toast "Deleted ink · Undo". Shift keeps aspect on corner drags; Alt resizes from the
centre. Every change asks `targeted` and is one undo step. Focus stays on the box after each key.

**Motion.** None during direct manipulation (1:1). The contextual bar follows its *contextual*
rule. RM: same.

**Accessibility.** Hit areas 24 / 44 (A-15); handle stroke 4.93:1 on white (≥ 3:1, 1.4.11); the
box is one Tab stop with a full name.

**Implementation.** New `annotations/SelectionFrame.tsx` + `selection-frame.ts` (handle layout,
hit boxes from `lasso/geometry.ts handleHitBox`); used by annotation, lasso, image, created
field, crop and placement layers. Tests: unit for handle visibility by size and non-overlapping
hit boxes at 44 px; rendered-pixel handle colours; e2e target audit on the touch project.

## 11. Annotation layer and undo reveal

**Role.** Hit targets for annotations, creation feedback for shapes and markup, and the on-page
undo flash (J5, J6, J10; `flows.md` §5.3 undo reveal). Replaces 9.7 `annotations/AnnotationLayer.tsx`
(kept, re-gated: no longer inert in viewing).

**Anatomy, material.** Annotations render as their appearance (content). Hover in viewing and
Select: the hit target's fill `--select-wash` at 0.5 (fine pointers only). Creation preview for
shapes: the shape in its style with a 1 px `--select` dashed bounding box. Undo flash: a 2 px
`--select` ring 4 px outside the changed bounds.

**States.**

| State | Behaviour |
|---|---|
| Viewing / Select | Press selects (frame §10, annotation bar); double-click opens its comment (§16); a drag moves only an already-selected one |
| Drawing tool | Targets inert; the tool captures the page |
| Locked | Press opens the comment read-only; no frame handles |
| Empty | Nothing |
| Undo / Redo | *scroll-to* the change, then the ring flash |

**Copy.** Target names "{kind} by {author}, {date}" / "{author}, {date} · {kind}"; announcements
on select "Selected {kind}" / "{kind} seçildi".

**Behaviour.** Tab (inside the page, §19 order) reaches annotations after fields and links; Enter
opens the comment; Delete deletes (`targeted`). `touch-action: none` only while a drawing tool is
armed (so one finger scrolls in viewing).

**Motion.** *undo reveal* (80 in, 200 hold, 320 out, `--select` on the page). RM: ring without
motion. **Accessibility.** A-11 rings on targets; INV-16 keyboard creation is §14.

**Implementation.** Swap `--accent` for `--select` in `AnnotationLayer.module.css`; mount
`SelectionFrame`; `touch-action` by tool. New `viewer/UndoReveal.tsx` (page ring; chrome ring is
family 14). Tests: e2e S14 (drag on unselected moves nothing); undo of a pen stroke on page 4
scrolls it into the free rectangle and shows the ring once (`getAnimations` length 1, 500 ms).

## 12. Ink preview, dry ink and pen hover dot

**Role.** Latency-first ink (J6). Replaces 9.8 `pen/ink-preview.ts`, `pen/DryInkLayer.tsx` (kept);
adds the pen hover dot (M-27).

**Anatomy.** Live stroke canvas over the page; committed strokes until the bitmap shows them.
Hover dot: a disc of the preset's colour at its on-screen width, with a 1 px white ring and a
1 px `rgb(21 23 28 / 0.5)` ring outside it, so it shows on any ink.

**Material.** Content. No glass, no light (light pauses during ink, A-23). Forced colours: dot
`Highlight` ring.

**States.** Hover dot only in Markup with a pen tool armed (or Select when the pen writes, the M8
rule); hidden in viewing. While a stroke runs the palette fades (family 07, *ink*). Locked: no
ink; first pen touch opens the Unlock popover.

**Behaviour.** Pen writes in Markup only (default); eraser end = temporary Eraser, barrel =
Lasso; iOS pen double-tap loupe cancelled; lone Android `pointercancel` = palm (M-27). Asks
`freehand` at pen down; a refusal draws nothing.

**Motion.** *ink*: no animation on the stroke. **Accessibility.** Ink has no keyboard path
(`flows.md` J6 keyboard n/a); shapes and text do.

**Implementation.** `ink-input.ts` (hover dot and palm rules), `DryInkLayer.tsx` unchanged. Tests:
e2e pen hover dot visible in Markup, absent in viewing (CDP pen events); latency spec unchanged.

## 13. Lasso

**Role.** Select strokes, shapes and notes by drawing around them (J6 follow-ups). Replaces 9.9
`annotations/lasso/LassoSelection.tsx` (kept).

**Anatomy.** Trace: 1 px `--select` dashed 4 3, area `--select-wash`. Result: §10 frame with the
rotate grip, lasso bar above (family 08).

**States.** Tracing; selected; moving (1:1); empty result announces "Nothing to select inside the
lasso" / "Kementin içinde seçilecek bir şey yok" (existing). Locked: lasso tool cannot arm.

**Behaviour.** Q or the pen barrel arms it in Markup; moves, resizes, rotates ask `freehand` (the
lasso is a Markup tool, `flows.md` §2.5); keys as §10. Esc clears, then disarms.

**Motion.** None (direct). **Accessibility.** The box is focusable with its full name (existing).

**Implementation.** Colour swap; handles through `SelectionFrame`. Tests: existing lasso suites
plus a pixel check of the trace colour.

## 14. Placement ghost: keyboard placement and "Add … here"

**Role.** Places a text box, note, signature, image, stamp or field from the keyboard at the
centre of the visible page, and at a named point from the page menu (`flows.md` §2.5 `place`,
§3.4, J8A keyboard 4 steps, J10 keyboard area). New; generalises 9.15's field placement.

**Anatomy.**

```
 visible part of the focused page
 ┌───────────────────────────────────────┐
 │            ┌┄┄┄┄┄┄┄┄┄┄┄┄┄┐            │  ghost: the object at 60 % opacity
 │            ┆  Ada L.      ┆ ← centre   │  inside a §10 frame (no handles)
 │            └┄┄┄┄┄┄┄┄┄┄┄┄┄┘            │
 │   ╭ Enter places it here; arrow keys  │  M2 chip 36 / 44, below the ghost,
 │   ╰ move it (Shift: 10 pt). Esc cancels│  flips above near the free-rect bottom
 └───────────────────────────────────────┘
```

Default sizes: text box 160 × 24 pt; note icon 24 × 24 pt; signature at its saved aspect, 160 pt
wide; image at natural size capped at 50 % of page width; stamp at its preset; fields per kind
(existing `field-model.ts`).

**Material and light.** Ghost: content. Chip: M2 (σ 7 at 36 px, 8 at 44), e3; Solid n4 / n1;
forced colours `Canvas` with border.

**States.** Armed + Enter on the focused page → ghost at the centre of the page's part inside the
free rectangle; arrows move; at the page edge it clamps and announces "At the page edge" / "Sayfa
kenarında"; Enter commits; Esc cancels (and disarms a placing tool to Select). Locked: Enter opens
the Unlock popover. "Add … here" from the page menu skips the ghost and commits at the pressed
point (centred on it), then selects nothing (creation does not select, amendment A2) except text
box and note, which open their editors.

**Copy.**

| | English | Turkish |
|---|---|---|
| Chip | Enter places it here; arrow keys move it (Shift: 10 pt). Esc cancels. | Enter buraya yerleştirir; ok tuşları taşır (Shift: 10 pt). Esc iptal eder. |
| Placed | Placed {kind} on page {page} | {kind}, {page}. sayfaya yerleştirildi |
| Cancelled | Placement cancelled | Yerleştirme iptal edildi |

**Behaviour.** Guard: `place` (allowed without Markup when the point comes from "Add … here" or
this ghost). After commit, a placing tool returns to Select (`flows.md` §4.3); focus goes to the
created object's editor (text box, note) or to the object's frame (signature, image, stamp,
field), so a second Enter does nothing unexpected. The pointer path is unchanged: a click in
Markup places.

**Motion.** Ghost appears instantly; arrows move it instantly (keys never animate); chip
*contextual*. RM: chip fade.

**Accessibility.** Ghost `role="img"` named "{kind} to place" / "Yerleştirilecek {kind}",
`aria-live` polite for placed and cancelled; A-12 (the ghost stays in the free rectangle).

**Implementation.** New `viewer/placement.ts` (centre of the visible page part, clamping, nudge)
and `viewer/PlacementGhost.tsx`; `CreatedFieldLayer`'s keyboard placement moves onto it. Tests:
unit for centre and clamp under rotation; e2e J8A keyboard (G, Enter, arrows, Enter = 4) and the
J10 keyboard area; S17 row.

## 15. Text box editor

**Role.** Type a free-text annotation in place (J5 variants, J8 typed text). Replaces 9.10
`annotations/InlineEditors.tsx` FreeTextEditor (kept).

**Anatomy.** The box draws the text in its own font, size and colour on `--editor-surface`,
growing with content; min 120 × 24 pt; 1 px `--select` dashed border 2 px outside while editing.

**Material.** Solid editor (page white, `--editor-ink` placeholder `#5d6067`, 6.30:1). Forced
colours: `Field` / `FieldText`.

**States.** Editing; empty on commit → dropped with no history entry; locked → cannot open
(Unlock popover); coarse with keyboard → the box scrolls above the keyboard (`--vv-bottom`, M-4)
and the form accessory shows Done.

**Copy.** Accessible name "Text box text" / "Metin kutusu metni" (existing).

**Behaviour.** T then click (or drag to set width) in Markup; "Add text here"; ghost Enter.
Enter is a newline; Esc, Mod+Enter or a press outside commits one history step (`place` on
create, `targeted` on edit); a press with a drawing tool commits and continues
(`commitOpenEditor`). Focus after commit: the page (caret off), or the next field when opened
from the stepper.

**Motion.** None. **Accessibility.** 16 px input text on coarse even when the box is smaller
(the box draws the real size; the hidden input is 16 px to stop iOS zoom).

**Implementation.** `InlineEditors.tsx` adopts `--editor-*` and `visualViewport`. Tests: existing
note-editor and writing suites; iOS WebKit e2e that the page does not zoom on focus.

## 16. Note editor

**Role.** Write or read a note's text and any annotation's comment, including Comment on a
selection (one Highlight with its note open, RA-6; J5). Replaces 9.11 note popup.

**Anatomy.**

```
medium and up: popover at the icon or the highlight's end      compact: sheet at 40 %
╭───────────────────────────────╮ 280 fine / 320 coarse       ╭──────── ▬ ──────────╮
│ Ada Lovelace · 18:40          │ footnote, n11               │ Ada Lovelace · 18:40│
│ ┌───────────────────────────┐ │                             │ ┌─────────────────┐ │
│ │ Add a comment             │ │ well: --editor-surface,     │ │ Add a comment   │ │
│ └───────────────────────────┘ │ 72–240 px then scroll       │ └─────────────────┘ │
│ 🗑            Cancel   Save    │ 28 / 44 buttons             │ 🗑     Cancel  Save │
╰───────────────────────────────╯                             ╰─────────────────────╯
```

**Material and light.** Frame M4 (σ 24; 16 under 120 px), e4; the well is solid page white with
`--border-strong` (inputs inside glass, G-18). Compact: M3 sheet at the 40 % detent, above the
keyboard. Solid: n4 / n1. Forced colours: `Canvas`, well `Field`.

**States.** Editing; read-only (locked, or the comment of a signed file): text without well,
footer "Locked · Unlock" / "Kilitli · Kilidi aç"; empty new note on save → dropped; error saving
→ inline `warning` line, text kept.

**Copy.** Placeholder "Add a comment" / "Yorum ekle"; "Save" / "Kaydet"; "Cancel" / "İptal";
delete icon `trash`, name "Delete note" / "Notu sil". Save is a neutral filled button (n5), not
lime, so the armed tool keeps the view's one lime (`language.md` §0.1 principle 3).

**Behaviour.** Esc or a press outside saves; Cancel discards; Mod+Enter saves. Opens from N then
click, "Add note here", the ghost, Comment on a selection, C on a selection, double-click on any
annotation, Enter on a focused annotation. Guard: `place` (new), `targeted` (edit). Focus returns
to the annotation's target (or the page when it was a new note).

**Motion.** *popup* from the icon (quick); compact *sheet* (glide). RM: fade 120 ms.

**Accessibility.** `role="dialog"` non-modal, name "Comment" / "Yorum"; Tab cycles inside; F6
leaves; A-12 (the popover flips to stay in the free rectangle).

**Implementation.** `InlineEditors.tsx` NoteEditor moves into `annotations/NoteEditor.tsx` on Base
UI Popover (fine) and `ui/Sheet` (compact). Tests: existing `note-editor.test.tsx`; e2e J5 mouse
(4) and touch (5); axe EN/TR.

## 17. Paragraph editor and its doors

**Role.** Change page text (J9), the only way page text changes (`flows.md` §1.2 principle 3,
§3.2, §3.3; ADR-0020 amended). Replaces 9.18 `text-edit/ParagraphEditor.tsx` (engine kept), its
header and 8.19 info popover; the line editor of 9.17 stays as the fallback inside the same shell.

### 17.1 Doors

| Door | Where | Opens with |
|---|---|---|
| Edit text on the selection bar | Viewing and Markup | The selection carried in |
| Page menu → Edit text here | Viewing and Markup | Caret at the pressed point |
| E on a selection, then Enter | Keyboard | The selection carried in |
| Double-click on text | Markup with Select only (mouse; a pen only while no pen has been seen, as on desktop tablets; never touch) | Caret at the point, word selected |
| Palette ¶ Edit text tool, then click | Markup | Caret at the point |
| Tab to a paragraph target, Enter | Edit text tool armed | Caret at the start |

### 17.2 E outline (the step before Enter)

```
 ┌┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┐  1.5 px --select dashed, 4 px outside the paragraph
 ┆ This agreement sets out …  ┆
 └┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘
      ╭ Enter to edit · Esc ╮      M2 chip, 28 fine / 44 coarse, 8 px above
```

Copy: "Enter to edit · Esc" / "Düzenlemek için Enter · Esc". Enter or a click inside opens; Esc
or any other key cancels, then that key acts as usual (S15). Announced: "Paragraph outlined. Enter
to edit." / "Paragraf işaretlendi. Düzenlemek için Enter." Blocked paragraph: chip reads
"Paragraph editing is not available here: {reason}" (existing `paragraph_refused`).

### 17.3 Anatomy of the open editor

```
desktop, header beside (trailing margin ≥ 280 px):
 ┌┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┐   ╭ header M4, 240–360 px ───────────╮
 ┆ This agreement sets out the┆   │ Esc or click outside to apply  ⓘ │ hint, footnote n11
 ┆ terms on which the Club le|┆   │ “ğ” uses Inter because the       │ honesty, body
 ┆ ts the Riverside Room …    ┆   │ original font does not include it│
 └┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘   ╰──────────────────────────────────╯
  1 px --select solid, 4 px out; caret 2 px --select, steady

overflow decision (on leaving), header grows:
 ╭──────────────────────────────────────────────────────────╮
 │ ⚠ The paragraph now runs into the content below it.       │ warning glyph + words
 │   Tighten it, let it overlap or keep editing.             │
 │ [ Tighten to fit ]  [ Let it overlap ]  [ Keep editing ]  │ 28 / 44; Keep editing
 ╰──────────────────────────────────────────────────────────╯ default and focused

compact: header becomes the accessory above the keyboard
 ╭────────────────────────────────────╮
 │ ⓘ   Tap outside or Done to apply Done│ 44, M2 inside the dock's filtered element
 ╰────────────────────────────────────╯ choices rise as a tier above it
```

Placement order: beside (trailing, then leading) when the margin outside the page is ≥ 280 px;
else above the paragraph if the free rectangle has room; else below; never over the paragraph or
within 8 px of it. Compact: accessory (M-28).

**Material and light.** Canvas and plate: solid page white, the page's own ink. Outline content.
Header M4 (it holds secondary sentences; rows with secondary text live on M3–M5, `language.md`
§2.6), radius `--radius-md` (16 squircle), e4, σ 24 (16 under 120 px). Compact accessory M2 in the
dock's element (σ 10). Solid: n4 / n1 with rim; forced colours `Canvas`, buttons `ButtonFace`.

### 17.4 States

| State | Look and copy |
|---|---|
| Loading | Header hint "Preparing the paragraph…" / "Paragraf hazırlanıyor…"; typing waits; `aria-busy` |
| Editing | Hint "Esc or click outside to apply" / "Uygulamak için Esc tuşuna basın ya da dışarı tıklayın"; compact "Tap outside or Done to apply" / "Uygulamak için dışarı dokunun ya da Bitti'ye basın"; the button "Done" / "Bitti" |
| Preview (300 ms pause) | Glyphs replaced by the rendered dry run; no visual jump |
| Honesty | `paragraph_honesty_one` / `_many` lines (existing) |
| Spacing tightened | "Spacing tightened by {percent}" (existing) |
| Ragged | "Some lines could not stay justified" (existing) |
| Overflow choice | `paragraph_overlap_choice` or `_no_fit` with the three buttons (existing strings) |
| Off page | `warning` + "This text no longer fits on the page; shorten it or move content" (existing), assertive; nothing written; focus stays in the text |
| Busy | "Applying…" / "Uygulanıyor…"; text read-only |
| Error | `role="alert"` line with `paragraph_commit_failed`; text kept |
| Locked while open | The open editor leaves first (normal commit path); an undecided overlap is kept for the return and comes back on Unlock with `paragraph_returned` |
| Line editor fallback | Same header with font line (`text_edit_font_*`), badge (`text_edit_badge_*`), fit choices "Shrink to {percent}" · "Let it run over", hint "Enter to apply · Esc to cancel" (existing) |

### 17.5 Behaviour

Full text keys, IME and clipboard through the hidden mirror (`role="textbox"`, multi-line). Nothing
changes until a key; Esc with no change leaves with no history entry. Leaving (Esc, a press
outside, focus leaving) commits one history step "Edit text on page {page}" / "{page}. sayfada
metin düzenlendi" after `canChange(id, 'text')`. Tab inside the overflow choice cycles its
buttons; Esc on the choice = Keep editing. Focus after commit returns to the selection's start in
caret mode (keyboard doors), to the paragraph target (Edit text tool), or to the page (pointer
doors). Edge: the page scrolls away → the draft is kept (existing); another paragraph opens → the
first commits.

**Motion.** E chip and header *contextual* (quick; moves < 200 px follow, larger fade); compact
choices *tier rise*. Canvas none. RM: fades.

**Accessibility.** Mirror name "Paragraph on page {page}" (existing), described by the header
group "Paragraph editing"; choice group named by `paragraph_overflow`; header primary 9.68:1, glass
secondary 6.30:1 over white (M4); buttons 28 / 44; A-12 (header in the free rectangle), A-13 (header
in F6 while open), A-21 (Turkish lines wrap, no fixed widths: the longest, `paragraph_overlap_choice_no_fit`
in Turkish at 158 characters, wraps to three lines at 360 px).

**Implementation.** Split `ParagraphEditor.tsx` (1605 lines) into `ParagraphEditor.tsx` (canvas,
mirror), new `text-edit/EditorHeader.tsx` (shared with `TextEditor.tsx`), new
`text-edit/EOutline.tsx`; `entry.ts` gains `openWithSelection(range)`; `lucide` `Info` → Phosphor
`info`. `useCanEdit` → `useCanChange(id, 'text')`. Tests: existing `ParagraphEditor.test.tsx` and
`TextEditor.test.tsx`; unit for header placement (beside, above, below, compact); e2e J9 mouse 4,
keyboard 7, touch 4; S3, S4, S15; "double-click in viewing selects the word and opens nothing";
axe on the overflow choice in EN and TR.

## 18. Edit text targets

**Role.** With the ¶ Edit text tool armed, every run is a pointer target and every paragraph a
keyboard target (J9). Replaces the target part of 9.17 `text-edit/TextEditLayer.tsx` (kept).

**Anatomy, material.** Targets are invisible until hover: 1 px `--select` outline (as §9); runs
that cannot be edited are hatched 45° at 4 px in `--select` 0.25 with a tooltip giving the reason.
Paragraph targets ≥ 24 × 24 px; the focused one shows the §9.2 ring.

**States.** Armed only in Markup; locked → the tool cannot arm (Unlock popover); finger opens with
a tap until a pen is seen, then with a long press.

**Copy.** Layer "Editable text of page {page}"; targets "Edit paragraph “{text}”", "Edit
“{text}”", blocked "“{text}” is not editable: {reason}" (all existing, EN and TR).

**Behaviour.** Click opens at the point; double-click with the word selected; Tab moves between
paragraphs; Enter or Space opens. Guard: `text` at commit (§17). Focus returns per
`focusReturnRun` (existing).

**Motion.** *hover*. **Accessibility.** Runs inside a paragraph are pointer-only and hidden from
assistive technology (existing); A-12 for each focused target.

**Implementation.** Colour swap and gate on `markup`. Tests: existing `TextEditLayer.test.tsx`.

## 19. Form widgets, field editors, the Lock notice and the on-page field stepper

**Role.** Fill forms with no mode (RA-3, `flows.md` §3.1 rows "Click a form field", S6, S7; J7,
J8A on a signature field); the on-page side of the stepper ‹ n/N › (`flows.md` §4.3). Replaces
9.13 `forms/FormLayer.tsx`, `forms/FieldEditors.tsx` and removes 9.14 (the "Switch to Edit to
fill" notice; INV-2).

### 19.1 Anatomy

```
fine, at 100 %:                         coarse, widget text < 16 px at this zoom:
 Name [Ada Lovelace|        ]           Name ┌──────────────────────────────┐
      ↑ in-place input, widget size          │ Ada Lovelace|                │ magnified editor:
 ☑ I agree to the terms                      └──────────────────────────────┘ 16 px text, ≥ 44 high,
                                             anchored at the widget's left and top, page white,
outlines on (Fill & sign open or the         1.5 px --select border, e1; the widget below shows
"Show field outlines" switch):               the live value
 Name ┌┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┐ 1 px --select, fill --select 0.08 multiply; required 1.5 px
      └┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘
locked, after a press:                    unsigned signature field:
 Name [Ada Lovelace        ]               ┌┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┐
 ╭ 🔒 Locked · Unlock ╮ M2 chip 28 / 44,    ┆   ✍ Sign here      ┆ dashed --select, label n9 on white
 ╰────────────────────╯ 6 px below          └┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘ (6.30:1), 13 / 15 px
```

### 19.2 Material and light

Widgets, editors and outlines are content (page white, `--editor-ink`). The Lock chip is M2 (σ 5 at
28 px, c 0.995; σ 8 at 44), e3, transient at its target. Solid: n4 / n1. Forced colours: editors
`Field` / `FieldText`, outlines `Highlight`, chip `Canvas` with border.

### 19.3 States

| State | Look | Notes |
|---|---|---|
| Rest | The field's appearance; no outline unless outlines are on | Outlines auto-on while Fill & sign is open (issue 9) |
| Hover (fine) | Outline appears on that field only | Cursor `text` or `pointer` |
| Focus-visible | §9.2 ring, offset 2 px, around the widget | Also after a stepper move, as `data-current-field` |
| Editing | In-place input (fine) or magnified editor (coarse, small text) | `visualViewport` keeps it above the keyboard (M-4) |
| Checkbox, radio | Toggle on click or Space; one undo step each (S7) | `targeted` |
| Choice | Native `<select>` on coarse (OS picker); Base UI Select on fine | `targeted` on pick |
| Read-only | No editor; tooltip "Read-only" / "Salt okunur" | Name "{name} (read-only)" |
| Required | 1.5 px outline when outlines show; "Required" in the name | No red until a save names empty required fields (family 12) |
| Signature field, unsigned | "Sign here" plate; click opens the signature picker (M4 menu): saved signatures, "New signature…" / "Yeni imza…" | `targeted`; the signature fits the field |
| Signature field, signed | Its appearance; click opens Signatures… (family 12) | — |
| Button with actions | Press shows a toast "Buttons with actions are not run in this app" (existing) | — |
| Locked | Focus and value show; any change opens the Lock chip; Tab from the field reaches Unlock | Signed reason reads "Signed · Unlock" / "İmzalı · Kilidi aç" |
| XFA-only form | Fields inert; facts chip explains (existing `forms_xfa_only`) | — |
| Empty (no fields) | Stepper hidden (`flows.md` §9.4) | — |
| Error (value refused by the engine) | Inline `warning` line under the editor, value kept | — |

### 19.4 Content and copy

| String | English | Turkish |
|---|---|---|
| Lock chip | Locked · Unlock | Kilitli · Kilidi aç |
| Signature plate | Sign here | Burayı imzalayın |
| Stepper move (announce) | Field {n} of {total}: {name}, {state} | Alan {n} / {total}: {name}, {state} |
| Value restored | Value restored | Değer geri yüklendi |
| Existing kept | `forms_fill`, `forms_checked`, `forms_unchecked`, `forms_empty`, `forms_required`, `forms_read_only`, `forms_signature_field` | existing |

Icons: `lock-simple`, `seal-check` (signed), `signature`. Turkish lock chip is 18 characters
against 15: the chip has no fixed width.

### 19.5 Behaviour

| Input | Effect |
|---|---|
| Click or tap a text field | Focus; typing fills; Esc restores the value while focus is inside |
| Tab / Shift+Tab | Next and previous field in the PDF's tab order; from the focused page, Tab enters field 1 (J7) |
| Enter (single line) | Commits and stays; in a multi-line field it is a newline |
| Stepper ‹ › (palette or accessory) | Moves focus to the field, scrolls it into the free rectangle (above the keyboard on touch), shows the current-field ring, announces |
| Tab order inside a page | Fields, then links (§23), then annotations (§11) |
| A drawing tool armed | The tool wins (hit order); fields do not take the press |

Each committed change is one history step "Fill {name}" with `targeted`. Focus after commit stays
in the field.

### 19.6 Motion, accessibility, implementation

**Motion.** Lock chip *contextual*; magnified editor *popup* from the widget (quick); stepper
*scroll-to*. RM: fades and instant scroll.

**Accessibility.** Real `<input>`, `<textarea>`, `<select>` (M-28); names from the field;
`aria-required`, `aria-readonly`; chip button 44 on coarse; ring per A-11; A-12 test on
`forms-a.pdf` (each focused field ≥ 50 % outside chrome); 16 px text on coarse.

**Implementation.** `FormLayer.tsx`: delete the notice (`data-form-lock-notice`) and
`form_switch_to_edit` (EN, TR); `useCanEdit` → `useCanChange(id, 'targeted')`; new
`forms/LockChip.tsx` (shared with the note editor's read-only footer), `forms/MagnifiedEditor.tsx`,
`forms/SignaturePlate.tsx`; `forms/navigation.ts` gains `stepTo(n)` for the palette and accessory.
Tests: `forms.test.tsx` updated (fill in viewing); e2e J7 mouse 7, keyboard ≈8, touch 7; S6, S7
unlocked and locked; the magnified editor appears at fit width on a 390 px project and iOS does
not zoom; axe on a locked field with the chip.

## 20. Created fields layer

**Role.** Draw and change fields created in the app (Add field ▸ kind); J7 authoring. Replaces
9.15 `forms/create/CreatedFieldLayer.tsx` (kept).

**Anatomy, material.** Fields drawn like their export; placing preview a dashed `--select`
rectangle; selected → §10 frame and the created-field bar (family 08). Content.

**States.** Placing (Markup, a field kind armed: click or drag; Enter → ghost, §14); selected;
filling. In viewing a created field fills like any field. In Markup with Select a click selects it
(frame and bar) and a double-click or Enter focuses it to fill (issue 6). Locked: fills refused
with the Lock chip; no frame handles.

**Copy.** Existing `forms_create_*` strings (widget, add, move, resize, delete, duplicate);
`forms_create_placing_keys` is replaced by §14's chip.

**Behaviour.** Place asks `freehand` (click in Markup) or `place` (ghost); move, resize, Mod+D,
Delete ask `targeted`. After placing, the field is selected and the tool returns to Select.

**Motion.** None. **Accessibility.** Existing widget names with their key hints.

**Implementation.** Keyboard placement moves to `PlacementGhost`; handles to `SelectionFrame`;
gate on `markup`. Tests: existing `create.test.tsx` with the new gate.

## 21. Image layer

**Role.** Select, move, resize, replace, extract and delete page images (one Image tool,
INV-15); right-click an image in any state for the image bar. Replaces 9.16
`image-objects/ImageLayer.tsx` (kept).

**Anatomy, material.** Hover outline 1 px `--select` (Image tool only); selection §10 frame; the
image bar (family 08) reads size in pt, px and dpi (tabular). Content.

**States.** Viewing and Select: context menu on an image opens the image bar with the image
selected (`targeted` for its actions). Image tool: hover outline, click selects. Locked: bar shows
Extract only; Replace and Delete dimmed with "Locked".

**Copy.** Existing image bar strings. **Behaviour.** Arrows nudge, Mod+arrows resize, Delete
deletes (toast with Undo). **Motion.** None.

**Accessibility.** Selected image box is one Tab stop named "Image, {w} × {h} pt".

**Implementation.** Handles to `SelectionFrame`; `HANDLE_SIZE` removed; gate by the §6 matrix.
Tests: existing `handles.test.ts`; e2e right-click image in viewing shows the bar.

## 22. Search highlights

**Role.** Show every Find hit and the current one (J15a; J5 and J9 keyboard via Alt+Enter).
Replaces 9.5 `viewer/SearchHighlights.tsx`.

**Anatomy, material.** Hits `--select-wash` (multiply, ink 12.42:1); current hit
`--select-wash-strong` (ink 9.13:1) plus a 2 px `--select` outline offset 1 px, so the outline
sits on page white (4.93:1) and not on the strong wash (2.59:1). Content. Forced colours: hits
`Mark`, current `Highlight` outline.

**States.** No hits (nothing on the page; Find says so); current changes on Enter, F3; the
current hit always lands in the free rectangle (scroll-to). Locked: same.

**Copy.** None on the page; Find's own count. **Behaviour.** No pointer behaviour; Alt+Enter hands
the current hit to caret mode (§7).

**Motion.** On each step: *scroll-to*, then the *undo reveal* ring around the current hit once
(issue 2). RM: ring without motion.

**Accessibility.** Shape and strength, not colour alone (outline on current). A-12.

**Implementation.** CSS tokens swap (`--accent-highlight*` → `--select-wash*`). Tests: rendered
pixel of both washes; e2e Find step keeps the hit outside chrome.

## 23. Link hotspots and the link popover

**Role.** Follow internal links, confirm external ones (`flows.md` §2.6 keeps links when locked).
Replaces 9.6 `viewer/LinkLayer.tsx` and 8.18 link popover; links are live in viewing (today only
with Select in Edit).

**Anatomy.** Hotspots invisible; hover: cursor `pointer` and a 1 px `--select` underline along
the hotspot's bottom edge (fine pointers); focus: §9.2 ring. External: popover M4 260 px:

```
╭──────────────────────────────────╮
│ Open this link in a new tab?     │ title3
│ It leaves this app and contacts  │ body, n11
│ example.org.                     │
│                  Cancel   Open ↗ │ Open: neutral filled, `arrow-square-out`
╰──────────────────────────────────╯
```

**Material.** Hotspots content; popover M4 (σ 16 under 120 px, else 24), e4; Solid n4 / n1;
forced colours `Canvas`.

**States.** Live in viewing, Markup with Select, locked; inert with any other tool. Missing
target: toast "This link points to a page that is not in this document" (existing). Unsupported:
"This link type cannot be opened" (existing).

**Copy.** Existing `viewer_link_*` strings in EN and TR ("Bu bağlantı yeni sekmede açılsın mı?",
"Uygulamadan çıkar ve {host} ile bağlantı kurar.", "Aç"); "Cancel" / "İptal".

**Behaviour.** Click, tap or Enter follows: internal → *scroll-to* into the free rectangle and the
target page becomes current; external → popover, Open uses `noopener`. A drag past the slop selects
text (§6). Tab order after fields. Guard: none.

**Motion.** Popover *popup*. **Accessibility.** Hotspots are links named "Go to page {page}" or
"External link: {uri}" (existing); 24 / 44 px minimum hit, grown around small hotspots without
overlapping neighbours.

**Implementation.** `LinkLayer.tsx` gate change, `link` kind in the router, popover on Base UI
Popover. Tests: existing `LinkLayer.test.ts`; e2e link in viewing and when locked.

## 24. Redaction marks

**Role.** Show pending redaction marks, by text and by area, until Apply (J10; S16). Replaces 9.12
`redaction/RedactionLayer.tsx`.

**Anatomy.**

```
 ┌───────────────────────┐ 1.5 px --redact-page (#c21725), solid
 │╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱│ hatch 45°, 6 px pitch, 1 px, 18 % (text under it 13.1:1)
 └───────────────────────┘ left out: dashed 4 3, hatch 6 %; current under review: 2.5 px
 drawing: dashed preview, fill 22 %
```

**Material.** Content. Red with a hatch (shape) and the pending-marks bar's words (family 08), so
colour is never alone (A-19). Forced colours: border `CanvasText`, hatch `GrayText`.

**States.** Pending; left out; current (J/K under review); drawing (Redact armed: the layer takes
the page with `crosshair`); applied → the content is removed and the area painted by the engine
(the marks go). Locked: marks visible, X and Redact refused (Unlock popover).

**Copy.** Mark names "Redaction mark {n} of {total}, not applied" / "Karartma işareti {n} /
{total}, uygulanmadı"; left out "…, left out" / "…, dışarıda bırakıldı".

**Behaviour.** X on a selection marks text (`targeted`); Redact drag marks an area or text
(`freehand`); Enter with Redact armed → ghost area (§14, `place`), Shift+arrows resize. J/K step.

**Motion.** None (destructive work gets no light or flourish, `language.md` §8).

**Accessibility.** Marks are focusable in review (J/K) with the names above; red 6.10:1 on white.

**Implementation.** `RedactionLayer.module.css` uses `--redact-page` and an SVG hatch pattern.
Tests: rendered pixel (hatch present, page outside the mark untouched); e2e J10 mouse 6 and
keyboard ≈12.

## 25. Crop layer and draw banner

**Role.** Draw the crop area on a page for the Crop sheet (page menu "Crop page…", title "Crop
pages…"). Replaces 9.19 `crop/CropLayer.tsx`, `crop/CropDrawBanner.tsx`.

**Anatomy.** Kept area: §10 frame with eight handles; outside: `--crop-dim`. Banner: M2 capsule
centred at the top of the free rectangle, 36 / 44 high: "Drag a rectangle on a page to set the
crop area. · Cancel".

**Material.** Layer content; banner M2 (σ 7 / 8), e3; Solid n4 / n1.

**States.** Drawing; drawn (handles adjust); locked → "Crop page…" is dimmed upstream, so the
layer never opens.

**Copy.** Existing `crop_draw_hint` (EN, TR) and "Cancel" / "İptal"; layer `crop_draw_layer`.

**Behaviour.** Drag draws; Esc or Cancel returns to the sheet; the sheet's Apply asks `pages`.
Enter with the page focused → ghost box at the centre (§14). The side sheet insets the free
rectangle (§2), so the page is never under it.

**Motion.** Banner *tier rise*. **Accessibility.** Banner in the F6 cycle; Cancel 44 on coarse.

**Implementation.** Banner moves onto the shared M2 bar shell; handles to `SelectionFrame`. Tests:
existing `crop.test.tsx`; e2e at 390 px: the page stays visible above the 40 % sheet.

## 26. Furniture preview

**Role.** Live preview of page numbers, header and footer, Bates and watermark while their sheet
is open (J16). Replaces 9.20 `furniture/FurnitureLayer.tsx` (kept).

**Anatomy, material.** SVG drawn on the page as it will be written. Content. Fixes INV-1's covered
preview: the side sheet insets the free rectangle (medium and up) and the 40 % sheet leaves the
page above it (compact, `flows.md` §6.3).

**States.** Previewing; none. Locked: the sheet's Apply is dimmed with "Locked"; the preview still
shows.

**Copy.** "Previewed on the pages. Nothing changes until you apply." / existing Turkish, shown in
the sheet. **Behaviour.** No input; Apply asks `document`. **Motion.** None.

**Accessibility.** `aria-hidden` preview; the sheet describes it.

**Implementation.** No change in the layer; the inset comes from `free-rect.ts`. Tests: e2e J16
at 390 × 844 and 820 × 1180: the previewed number on page 1 is visible and not under the sheet.

## 27. OCR word ring

**Role.** Mark the focused word while reviewing OCR results (J11). Replaces 9.21
`ocr/OcrLayer.tsx`.

**Anatomy, material.** 1.5 px `--select` ring, 2 px outside the word box (today 1 px accent).
Content.

**States.** Focused word; none. Locked: review is read-only (OCR results are `document`).

**Copy.** Existing `ocr_word_announce` ("Word {index} of {total}: {word}, {confidence}
confidence" / "Sözcük {index} / {total}: {word}, güven {confidence}").

**Behaviour.** J/K step; *scroll-to* into the free rectangle. **Motion.** None.

**Accessibility.** Announced per step (polite). **Implementation.** Colour swap. Tests: existing
OCR suites plus a pixel check of the ring colour.

## 28. Removed and moved

| Today | Fate | Where its function went |
|---|---|---|
| 9.14 "Switch to Edit to fill" notice | Removed | Fields fill in viewing; the Lock chip (§19) when locked |
| 9.4 hover outline with the Edit text tool | Removed | The tool's own target hover (§18) |
| 8.6 zoom menu (status bar) | Moved | Page pill (family 03); the gestures and keys are §4 |
| 8.19 paragraph info popover | Merged | `EditorHeader` ⓘ (§17) |
| `form_switch_to_edit`, `pen_draws_in_edit*`, `edit_text_hint` gating | Strings removed or renamed | `input-policy` names; the hint string stays |
| `useCanEdit` in page layers | Removed | `useCanChange(id, act)` (§6) |
| `--accent` and `--accent-highlight*` on the page | Removed | `--select`, `--select-wash*` |
| Read-only inert annotation layer | Removed | Live in viewing for targeted acts |

## 29. Test matrix

| Kind | Files | Proves |
|---|---|---|
| Unit | `hit-order.test.ts`, `zoom-controller.test.ts`, `caret.test.ts`, `placement.test.ts`, `free-rect.test.ts`, `selection-frame.test.ts`, `editor-header.test.ts` | Matrix, maths, placement, insets |
| Component (jsdom) | Existing `forms.test.tsx`, `ParagraphEditor.test.tsx`, `TextEditLayer.test.tsx`, `note-editor.test.tsx`, lasso, crop suites, re-gated | Behaviour without the Read lock |
| Browser mode | Zoom commit anchor; side-sheet re-centring; caret DOM `Selection` sync | Real layout |
| e2e | `input-rules.spec.ts` (S-rows), `keyboard-text.spec.ts` (J5, J9, J10 keys), `rest-rule.spec.ts` (A-12), `forms`, `annotations`, `motion.spec.ts` (zero layouts during pinch, no `::view-transition` on zoom steps), touch project for pinch, scrubber, long press | Jobs and safeguards |
| Rendered pixel | `glass-pixels.spec.ts` additions: page white per theme and Glass value, `--select` handles, washes, redaction hatch, page corners with light on and off | A-1, A-3, A-6 |
| axe | Caret mode, open paragraph editor with choice, locked field with chip, note editor, link popover; EN and TR; default, Solid, more contrast, forced colours | A-14, A-16, A-18, A-21 |

## 30. Issues for the lead

1. **Ownership of two surfaces.** The form accessory bar is in `flows.md` §4.4 (family 08); this
   spec only feeds it (stepper, Done, Clear). The trailing page scrubber (M-15, `flows.md` §6.3)
   appears in no family list; it is specified here (§5) unless reassigned to family 03. Two family-08 items are absorbed here because they live at the page: 8.18 link popover (§23)
   and 8.19 paragraph info popover (§17).
2. **No find-hit transition in `language.md` §7.3.** Research 18's MC-35 pops the current hit;
   the catalogue has no such entry. This spec uses *undo reveal*'s ring after *scroll-to* on each
   Find step (§22). Add a line to the catalogue or accept the reuse.
3. **Red on the page.** `language.md` §1.1 puts status colour "next to a glyph and words, never as
   a wash", yet redaction marks are a red mark on the page and §2.10 calls them content. Decided:
   new token `--redact-page: #c21725` in both themes (the page is always white, 6.10:1), with a
   45° hatch as the shape cue and the pending bar's words. Also new: `--crop-dim` outside a crop
   preview, a deliberate darkening of the page during a preview of removal.
4. **Alt+arrows in caret mode.** `flows.md` §7.2 gives Alt+arrows to page moves; on macOS
   Alt+←/→ is the word jump. Decided: in caret mode the text convention wins; page moves keep
   Alt+arrows wherever no caret is active.
5. **Tool sheets inset the free rectangle.** `flows.md` §6.2 lists the palette, pending bar and a
   side-docked palette as insets but not side sheets. Decided: tool and task side sheets inset the
   trailing edge, so live previews (furniture, crop) are never under a sheet; the column re-centres
   on *panel*.
6. **Created fields in Markup with Select.** `flows.md` §3.1 says a field click in Markup with
   Select behaves "Same" as viewing (focus, fill), but the created-field bar (§4.4) needs a way
   to select one. Decided: in Markup with Select a click selects a created field, a double-click
   or Enter fills it; source fields always fill.
7. **Links join the hit order.** `hit-order.ts` has no link kind today. Decided: annotation →
   form widget → link → image → text run → text selection; a drag past the slop that starts on a
   link selects text.
8. **Header tier.** The paragraph editor header holds sentences of secondary text; `language.md`
   §2.6 requires M3–M5 for rows with secondary text, so it is M4 although it behaves like a
   contextual bar (M2). The compact accessory form stays M2 inside the dock's element.
9. **Field outlines while Fill & sign is open.** Not in `flows.md` §4.3. Decided: outlines turn
   on while the Fill & sign door is focused and off when it closes (the switch still pins them).
10. **Steady caret.** Caret mode and the editors' caret do not blink (`language.md` §0.1
    principle 5, A-9). Native `<input>` carets in form fields keep the browser's blink.
11. **Pinch detent chip.** "Release to see all pages" (M1, during the gesture only) is not in
    `flows.md` §7.1; it makes the 15 % threshold visible before release. It counts as the one
    transient blurred surface in the compact budget (`language.md` §2.9: 2 + 1).
12. **Double-click and smart zoom.** Research 18 MC-24 zooms on double-click; `flows.md` §3.1
    keeps double-click for word selection (viewing) and the editor (Markup with Select). Decided:
    smart zoom only on a touch double tap (fit width ⇄ 250 %); a pen double tap acts as a mouse.
13. **Compact note editor as a sheet.** The placement matrix (`flows.md` §6.9) has no row for
    in-page editors. Decided: on compact the note editor is a 40 % sheet above the keyboard; the
    text box and paragraph editor stay on the page with the accessory bar.
14. **Pill and chip heights.** `language.md` §11.3 issue 4 assumed 36 / 44 px chips; this spec
    uses 36 / 44 for the detent chip and the placement chip, and 28 / 44 for the Lock chip and the
    E chip (σ 5, c 0.995 at 28 × ≥ 120; σ 6 would give 0.980 and fail A-2). The coverage registry needs the 28 px chip row.
15. **Rename `ReadView` to `PageView`.** "Read" retires as a word (`flows.md` §11); the rename
    touches 5 test files (`stage/read-*.test.tsx`). Optional; recommended in D1.
16. **Turkish "%" placement.** Zoom announcements and the pill must use `formatPercent` (Intl),
    which writes "%150" in Turkish; a lint check for hand-built "{n} %" strings would catch the
    rest.
17. **`flows.md` §7.2 F6 order** lists "page" once; caret mode and the open editor header both
    need to sit inside the page region of the cycle (header right after the page). Stated here;
    the shell spec should match.

## 31. Open questions

1. **Handle shape.** Circles (Apple's style, chosen here) or today's squares? A taste check on the
   wave 3 prototype; sizes and hit areas do not change.
2. **The 15 % pinch threshold and the 250 % double-tap target** need the device runs of S-T1 to
   S-T4 (research 19 §12) before they freeze.
3. **Field outlines by default** for files whose facts chip says "N form fields": on while the
   chip shows, or only with Fill & sign? The five-person form test (`flows.md` §12) can answer it.
4. **Caret mode discoverability.** Announced and listed in the shortcuts overlay only. Is a
   one-time hint on the first Enter on a page wanted, or is the announcement enough?
5. **Magnified field editor threshold.** 16 px text at the current zoom is the iOS rule; on
   Android and in the desktop touch project a smaller threshold (13 px) may read better. Needs the
   same device runs.
