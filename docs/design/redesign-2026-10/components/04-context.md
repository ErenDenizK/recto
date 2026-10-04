---
title: "M9 components, family 04: contextual bars, menus, popovers and tooltips"
date: 2026-10-04
status: proposed
---

> Wave 2 component spec. Binding inputs: [`flows.md`](../flows.md) (cited as F§) and
> [`language.md`](../language.md) (cited as L§), with its ten §13.2 amendments applied. Evidence:
> [`inventory.md`](../inventory.md) (INV ids, family 8 rows 8.1–8.21), the baseline frames
> `08-selection-bar`, `09-page-menu`, `10-annotation-selected`, `11-lasso`, `28-privacy`, and
> research 15, 18, 19, 22 (RA, MC, M, A ids). Code facts are from `develop`: `annotations/
> ReadSelectionBar.tsx`, `AnnotationBar.tsx`, `image-objects/ImageBar.tsx`, `stage/ContextualBar.tsx`,
> `stage/PageContextMenu.tsx`, `ui/Tooltip.tsx`, `ui/Menu.module.css`, `ui/Popover.module.css`,
> Base UI 1.8.0 (`toolbar`, `menu`, `popover`, `tooltip`, `context-menu`). Coverage values were
> computed with L§1.2's formula. **(judgement)** marks unmeasured claims.

# Family 04: contextual bars, menus, popovers and tooltips

## 0. Summary

- **Everything that appears at a target**: 8 bars, 1 menu primitive with 11 menus, 1 popover
  primitive with 5 popovers, the Lock notice and the tooltip. They replace inventory family 8
  (21 rows) plus 9.11 (note popup) and 9.14 (the "Switch to Edit" notice).
- **One bar at a time.** A target shows at most one contextual bar; the dock's morphs (Pages bar,
  Compare bar) and the pending-marks bar live at the bottom and never compete with it.
- **One placement engine** (`ui/anchor/place.ts`): every bar, menu and popover stays inside the
  free rectangle (F§6.2) with 8 px padding, flips before it shifts, never covers its anchor, and
  on touch puts the selection bar *below* the text because iOS and Android draw their own edit
  menu above it.
- **One long-press recogniser** (`viewer/gestures/long-press.ts`): 450 ms, 10 px slop, for
  touch and pen; iOS Safari fires no `contextmenu`, so the page menu, annotation bars, Highlight
  tints, the History scrubber and touch tooltips all come from it.
- **Static menus with reasons** (RA-21): items never appear or vanish; what cannot run is dimmed,
  stays focusable and says why. A locked document heads every menu with "Unlock document".
- **Targets**: 24 px minimum with a mouse (bars 36 px, buttons 32 px, rows 28 px); 44 px under
  any coarse pointer, hit areas never overlap (A-15).
- **Glass**: bars M2 (σ 7 at 36 px, 8 at 44 px, 10 at the 56 px phone bar), menus and popovers
  M4 (σ 12–24 by height), the Lock notice M1, tooltips solid. No light anywhere in the family.

## 1. Family overview

### 1.1 How the parts work together

| Layer | Components | Rule |
|---|---|---|
| At the target (one at a time) | Text selection bar · annotation bar (lasso variant) · image bar · field bar · Lock notice | Priority when two qualify: open editor or menu > annotation or lasso > image > field > text. A new target replaces the bar with *contextual* motion |
| At the bottom (dock band) | Pages bar · Compare bar (morphs of the dock, F§4.2) · pending-marks bar (above dock or palette) · form accessory (above the keyboard) | Never cover the free rectangle; they *define* its bottom edge |
| At a point or control | Menus (page menu and the catalogue), popovers (link, note, privacy, History scrubber, Unlock), tooltips | Above every bar; one menu or popover open at a time (a submenu is part of its menu) |

Z-order, bottom to top: page → contextual bar → dock band → top strip → menus and popovers →
sheets → tooltips. Every surface here is in the F6 cycle in the order of F§7.2 (pending-marks bar
→ dock or palette → contextual bar → …) and leaves it when it closes (A-13).

### 1.2 Composition

```
Desktop 1440 × 900 (large, fine pointer): text selected, page menu open, two marks waiting
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◆ ▤ [report.pdf ▾ ●] agreement +              ⌕ Find in document   ↶ ↷  Save  ◎      │
│        ┌──────────────────────────────────────────────────────┐   ↶ long press:      │
│        │ ╭────────────────────────────────────────────────────╮ │   History scrubber   │
│        │ │⧉ Copy ▬•Highlight▾ ◷ Comment ▮ Redact ¶ Edit text ⋯│ │   (M4 popover)       │
│        │ ╰────────────────────────────────────────────────────╯ │                      │
│        │  ░░░░ selected sentence (select wash) ░░░░  8 px gap │   free rectangle:    │
│        │                                                      │   bounds inset 8 px  │
│        │            right-click on paper ─▶ ╭──────────────────────╮                  │
│        │                                    │ Add note here      N │ page menu, M4    │
│        │                                    │ …15 static rows      │                  │
│        └────────────────────────────────────╰──────────────────────╯                  │
│              ╭──────────────────────────────────────╮                                │
│              │ ▮ 2 marks · Mark area · Apply 2     ⋯│ pending-marks bar, 40 px M2    │
│              ╰──────────────────────────────────────╯                                │
│        ╭──────────────────────────────────────────────╮            ╭──────────────╮   │
│        │ ▦ Pages   ✎ Markup   ✑ Fill & sign   ⋯ More  │            │ 3 / 12 · 96 %│   │
│        ╰──────────────────────────────────────────────╯            ╰──────────────╯   │
└──────────────────────────────────────────────────────────────────────────────────────┘

Phone 390 × 844 (compact, touch), word long-pressed
┌────────────────────────────────────────┐
│ ‹ 3  report.pdf ▾ ⓘ       ↶  ↷   ⌕     │
│   [system edit menu: Copy · Look Up]   │ ← iOS or Android, above the text
│   ░░░ selected ░░░  (native handles)   │
│ ╭────────────────────────────────────╮ │ ← ours, 8 px below, 56 px M2,
│ │  ⧉     ▬•      ◷      ▮     ¶    ⋯ │ │   344 px; 24 px icons over
│ │ Copy Highlight Comment Redact Edit │ │   12/16 captions (⋯: More)
│ ╰────────────────────────────────────╯ │
│                                        │
│╭──────────────────────────────────────╮│
││ ▮ 2 marks · Mark area · Apply 2     ⋯││ ← pending-marks row inside the
││   ▦      ✎      ✑      ⋯   │ 3/12   ││   dock's glass (one filter)
││ Pages Markup  Sign   More  │ 96 %   ││
│╰──────────────────────────────────────╯│
└────────────────────────────────────────┘
```

### 1.3 Components and what they replace

| § | Component | Replaces (inventory) | File after M9 |
|---|---|---|---|
| 3 | ContextBar primitive | Four private bar layouts, `FloatingToolbar.roving` in bars | `ui/ContextBar.tsx` (new) |
| 4 | Text selection bar | 8.3 | `selection/SelectionBar.tsx` (from `annotations/ReadSelectionBar.tsx`) |
| 5 | Annotation bar, lasso variant | 8.1, 6.3 Properties (INV-13) | `annotations/AnnotationBar.tsx` |
| 6 | Image bar | 8.2 | `image-objects/ImageBar.tsx` |
| 7 | Field bar and field properties | 8.20 | `forms/create/FieldBar.tsx` (new), `FieldProperties.tsx` |
| 8 | Form accessory | — (new, M-28) | `forms/FormAccessory.tsx` (new) |
| 9 | Pending-marks bar | 7.11, 5.11 Apply | `redaction/PendingMarksBar.tsx` (new) |
| 10 | Pages bar | 8.4 | `stage/PagesBar.tsx` (from `ContextualBar.tsx`) |
| 11 | Compare bar | 11.5, 11.9 | `compare/CompareBar.tsx` (from `CompareView.tsx`) |
| 12 | Menu primitive and action sheet | 15.2.7 | `ui/Menu.tsx` (new), `Menu.module.css` |
| 13 | Page menu | 8.10 | `stage/PageContextMenu.tsx` |
| 14 | Menu catalogue | 8.6–8.9, 8.11–8.16 | see §14 |
| 15 | Popover primitive and link popover | 15.2.8, 8.18 | `ui/Popover.tsx` (new), `viewer/LinkLayer.tsx` |
| 16 | Note popup | 9.11 | `annotations/NotePopup.tsx` (from `InlineEditors.tsx`) |
| 17 | Privacy popover | 8.17 | `privacy/PrivacyPopover.tsx` |
| 18 | History scrubber | 6.6 History | `history/HistoryScrubber.tsx` (new) |
| 19 | Lock notice and Unlock popover | 9.14 | `lock/LockNotice.tsx`, `lock/UnlockPopover.tsx` (new) |
| 20 | Tooltip | 8.21 | `ui/Tooltip.tsx` |

## 2. Shared rules

### 2.1 Placement and collision

`place(anchor, size, bounds, prefs) → { x, y, side, pinned, hidden }`, a pure function used by
bars; menus and popovers pass the same `bounds` to Base UI's Positioner as `collisionBoundary`.

| Rule | Value |
|---|---|
| Bounds | The free rectangle (F§6.2: stage minus top strip, sidebar, side sheet, dock band, open palette, pending-marks bar, keyboard via `--vv-bottom`, M-4), from today's `stage/stage-bleed.ts`, inset by 8 px |
| Gap to anchor | 8 px for bars, 6 px for menus, popovers and tooltips |
| Order | Preferred side → opposite side (flip) → shift along the axis → pinned to the bounds edge nearest the anchor's visible part. Never over the anchor, except pinned |
| Selection bar side | Fine pointer: above the first line. Coarse pointer: below the last line, because the system edit menu takes the space above (iOS, Android; established knowledge) |
| Horizontal | Centred on the anchor's first line (text) or box (objects), then shifted into bounds |
| Anchor leaves bounds | Bar hides (`hidden`, `inert`) and returns when the anchor scrolls back; menus and popovers close |
| Tracking | Re-placed on scroll, zoom and resize in one `requestAnimationFrame`; a move < 200 px follows, a larger one fades (MC-13) |
| Menus at a point | Open down and to the end from the point; flip up, then to the start; max height = bounds − 16 px, scroll inside |
| Submenus | To the end, overlapping the parent by 4 px; flip to the start |
| Compact menus | Page menu, title menu, More and every context menu become the action sheet (§12); popovers stay anchored at `min(360px, 100vw − 16px)` |

### 2.2 Targets and sizes

| | Fine pointer | Coarse pointer (any `coarse`) | Phone bar (compact, coarse) |
|---|---|---|---|
| Bar height · inset | 36 · 2 | 44 · 0 (buttons 36 visible, hit areas take the full height) | 56 · 4 |
| Bar button | 32 px high, ≥ 32 wide; label 13/18 at 550; icon 20 | 44 × ≥ 44; label 15/20; icon 24 | ≥ 48 wide; icon 24 over caption 12/16 at 500 |
| Gaps | ≥ 4 px, separators 1 × 16 px n7 | ≥ 8 px between hit areas | 0 (hit areas abut, never overlap) |
| Menu row | 28 px, icon 16, label 13/18 | 44 px, icon 20, label 15/20 | Action sheet rows 52 px |
| Popover controls | 28 px | 44 px | 44 px |
| Minimum | 24 × 24 or spaced (2.5.8) | 44 × 44 | 44 × 44 |

**Label shedding** when a bar's natural width exceeds the bounds: (1) secondary actions move into
⋯ in the order each bar lists; (2) labels drop to icons (names stay as `aria-label`, tooltips on
fine pointers, long-press labels on touch); the phone bar drops captions below 360 px of width.

### 2.3 Long-press recogniser (touch and pen; iOS)

| Step | Behaviour |
|---|---|
| Start | `pointerdown` with `pointerType` touch or pen, one pointer, not on a scrolling sheet's grabber |
| Fire | 450 ms with ≤ 10 px movement (M-20; Base UI's own 500 ms trigger is not used for pages) |
| Cancel | Movement > 10 px, a second pointer (pinch, two-finger tap), `pointerup`, `pointercancel`, a scroll start, or the pointer draws (a drawing tool armed in Markup and the pointer is a pen, or a finger with Draw with finger on; Issue 11) |
| Resolve | Hit-test the start point with `viewer/hit-order.ts`: text run → do nothing (native selection runs; the bar follows `selectionchange`); annotation → select it, show its bar; image → page menu with the image group; paper → page menu (sheet on compact); control → its long-press action, else its tooltip |
| Echoes | Android's `contextmenu` from the same touch is `preventDefault`ed and ignored within 700 ms of a fire; if it arrives first it counts as the fire. The `click` after a fired release is swallowed (capture, 400 ms) |
| CSS | `-webkit-touch-callout: none` and `-webkit-user-select: none` on the page canvas, annotation layer, images and links; never on text spans (native selection and handles stay) |
| Haptics | None (L§8: only lift, snap, drop) |
| Mouse, keyboard | `contextmenu` event; Shift+F10 or the Menu key |

### 2.4 Material

| Surface | Tier | σ (fine / coarse / phone) | c at smallest size | Beneath |
|---|---|---|---|---|
| Contextual bars, tint and colour tiers | M2 | 7 / 8 / 10 | 0.990 (180 × 36) · 0.994 (190 × 44) · 0.995 (344 × 56) | Pages, page text, the canvas |
| Pending-marks bar, form accessory | M2 | 8 / 8 / inside the dock's filter | 0.988 (480 × 40) · 0.994 (390 × 44) | Pages scrolling under |
| Pages bar, Compare bar | The dock's element (M2) | 9 / 10 / 10; 8 compact-height | L§2.9 | As the dock |
| Menus, action sheet at 40 % | M4 · M3 | 24; **12 under 92 px tall**; coarse 20 | 0.992 (200 × 64 at σ 12) | Anything |
| Popovers | M4 | 16 under 120 px, else 24; coarse 20 | ≥ 0.9995 | Anything |
| Lock notice | M1 | 5 / 8 | 0.995 (150 × 28) · 0.994 | A field on the page |
| Tooltip | Solid n4 (light n1) with the M4 rim, e2 | — | — | — |

All: L§2.3 rim and shadow per tier; Tinted alpha 0.90 with blur kept; Solid uses the tier's solid
token; `prefers-contrast: more` swaps rim and shadow for the 1 px strong border; forced colours:
`Canvas`, `CanvasText`, `ButtonBorder` 1 px, on states `Highlight`/`HighlightText`, disabled
`GrayText`, `backdrop-filter: none` set explicitly (L§9.3). No lens (L§2.7 lists none here), no
light (L§3.2: no under-light where nothing is armed; never for redaction, deletion or errors).

### 2.5 States (shared tokens)

| State | Token change |
|---|---|
| Rest | Label and glyph `--text-primary` (n12); secondary text `--glass-text-secondary` (n11); outline glyphs |
| Hover (fine) | `--surface-hover` wash (dark white 0.045, light ink 0.04), behind primary text only (L§2.6) |
| Pressed | `--surface-active` wash (0.075 / 0.07); *press* scale 0.97 mouse, 0.94 touch and pen; press light |
| Focus-visible | Concentric capsule ring, L§9.2 (`outline-offset: −2px`, inset 4 px ink) |
| On / selected | Glyph swaps to `-fill` (I-2); `--accent-muted` (lime 0.12 / ink 0.07) behind primary text only; `aria-pressed` or `aria-checked`. Never a lime fill: the view's one lime stays with the palette or primary action |
| Disabled | Glyph and label `--glass-text-disabled`; `aria-disabled="true"`, still focusable (Base UI `focusableWhenDisabled`); the reason in the tooltip and `aria-describedby` |
| Busy | After 400 ms the glyph becomes a 16 px spinner (*progress*); label kept; `aria-busy` |
| Destructive | Delete labels and glyphs in `--danger` glass variant (dark `#ffa4a4`, light `#a20519`) |
| Error | Nothing on the bar; a toast from the feedback family names the failure |
| Locked | Per component; always the glyph `lock-simple` and the word, never a tint (A-19) |

### 2.6 Guard, Lock and focus

- Every action runs a registered command whose `act` (F§2.5) is declared in the registry;
  `useCanChange(id, act)` dims it. A press on an item dimmed only by Lock opens the Unlock popover
  at that item (§19); other dimmed items do nothing but show their reason.
- A bar never takes focus when it appears (A-13). Focus enters by F6, by Tab from the page
  region's last stop, or by Shift+F10 / Menu key while a selection exists (§4).
- When a bar closes with focus inside, focus goes to the page viewport (`useFocusRescue`); a
  closing menu or popover returns focus to its trigger, or to the page for point menus.

### 2.7 Motion (shared)

Bars: *contextual* (enter 4 px + `scale(0.96)` from the anchor side on `--spring-quick`, exit
opacity 100 ms `--ease-exit`; hidden while a selection or object is dragged, back 150 ms after
release). Tiers above a bar: *tier rise*. Menus and popovers: *popup* plus *materialize*; a
submenu opened within 300 ms of a sibling does not animate (MC-14). Action sheet: *sheet*.
Buttons: *press*; toggles: *select*; glyph changes: *replace*. Reduced motion (L§7.5): fades of
100–150 ms, no scale, no travel.

## 3. ContextBar primitive

1. **Role.** One component for every bar at a target (§4–§7), so placement, focus, states and
   motion are written once. Replaces four bar layouts (BAR_HEIGHT 36, 38, 40, 40 in four files)
   and their hand-written roving tabindex.
2. **Anatomy.** `[name?] │ group │ group │ ⋯` in a capsule; optional *tier* above (tints, colour,
   width, tint row) sharing the bar's width rule; sizes per §2.2.
3. **Material.** §2.4.
4. **States.** §2.5; the bar itself has rest and *hidden* (anchor outside bounds).
5. **Copy.** Supplied by each bar; ⋯ is "More actions" / "Diğer işlemler".
6. **Behaviour.** Base UI `Toolbar.Root` (roving focus, arrows, Home, End, `focusableWhenDisabled`);
   Esc closes the tier, then clears the target (the selection, the object) and rescues focus;
   `pointerdown` on the bar never clears the page selection (`preventDefault`, as today).
7. **Motion.** §2.7; switching between two bars on one target (text → annotation after Highlight)
   keeps the element: content *replace* in 80 ms, the shape by `clip-path` on `--spring-smooth`.
8. **Accessibility.** `role="toolbar"`, `aria-label` from the bar, `aria-orientation` horizontal;
   one Tab stop; the F6 region "contextual bar".
9. **Implementation.** New `ui/ContextBar.tsx`, `ContextBar.module.css`, `ui/anchor/place.ts`;
   rendered in one portal per document view, not per page overlay (today each page mounts its
   own bar). Tests: `place.test.ts` (flip, shift, pin, hide, coarse-below, keyboard inset,
   bounds from a side sheet and `--vv-bottom`); `ContextBar.test.tsx` browser mode (one Tab
   stop, Esc ladder, focus rescue, `pointerdown` keeps selection); rendered-pixel registry adds
   180 × 36 σ 7, 190 × 44 σ 8, 344 × 56 σ 10.

## 4. Text selection bar

1. **Role.** Acts on selected page text with no mode (RA-3, RA-8, F§4.4): J5 (highlight and
   comment), J9 (edit a word), J10 (redact text), copy. Shown in viewing and in Markup with Select
   armed; never with another tool armed. Replaces 8.3 (its Read and Edit rows and "Mark up…").
2. **Anatomy.**

```
Fine, ≥ expanded (36 px, ≈ 470 px EN, ≈ 500 px TR)
╭──────────────────────────────────────────────────────────────────╮
│ ⧉ Copy │ ▬• Highlight│▾ │ ◷ Comment │ ▮ Redact │ ¶ Edit text │ ⋯ │
╰──────────────────────────────────────────────────────────────────╯
  •: 6 px dot in the current tint    ▾: 24 × 36 split segment
Tint tier (tier rise, 36 px):  ╭ ● Yellow ● Green ● Blue ● Pink ╮  four 32 px swatches

Coarse, medium and up (44 px)          Compact (56 px, 344 px wide)
╭────────────────────────────────╮     ╭──────────────────────────────╮
│ ⧉ Copy ▬• Highlight ◷ Comment  │     │ ⧉    ▬•    ◷     ▮    ¶    ⋯ │
│ ▮ Redact ¶ Edit text ⋯ (one row│     │Copy Highl. Comm. Redact Edit More│
╰────────────────────────────────╯     ╰──────────────────────────────╯
Locked:  ╭ ⧉ Copy │ ⋯ │ ⊡ Unlock ╮
```

   Shedding order (§2.2): Comment's label, Copy's label, then Edit text into ⋯. Phone captions
   below 360 px of width go.
3. **Material.** M2 per §2.4; over page text, so only primary-weight labels sit on state fills.
4. **States.** §2.5, plus: Edit text disabled when the run cannot be edited (scanned page, a font
   ADR-0020 refuses) with "This text can't be edited here"; Redact and the markups never dim
   unless locked; locked shows the locked form (no dimmed list).
5. **Content and copy.**

| Element | EN | TR | Icon |
|---|---|---|---|
| Bar name | Selected text | Seçili metin | — |
| Copy | Copy | Kopyala | `copy` |
| Highlight · split | Highlight · Highlight colour | Vurgula · Vurgu rengi | `highlighter` |
| Tints | Yellow · Green · Blue · Pink | Sarı · Yeşil · Mavi · Pembe | dots |
| Comment | Comment | Yorum | `chat-centered-text` |
| Redact | Redact | Karart | custom *redact* |
| Edit text (caption) | Edit text (Edit) | Metni düzenle (Düzenle) | custom *edit-text* |
| ⋯ items | Underline · Strikeout · Squiggly · Highlight colour ▸ · Find all · Copy as Markdown | Altını çiz · Üstünü çiz · Dalgalı çiz · Vurgu rengi ▸ · Tümünü bul · Markdown olarak kopyala | `text-underline`, `text-strikethrough`, `wave-sine`, —, `magnifying-glass`, `copy` |
| Locked | Unlock | Kilidi aç | `lock-simple-open` |
| E hint (in the bar's place) | Enter to edit · Esc | Düzenlemek için Enter · Esc | custom *edit-text* |
| Disabled reason | This text can't be edited here | Bu metin burada düzenlenemez | — |
| Announcements | Copied · Highlighted on page 3 · Marked for redaction, 2 marks waiting | Kopyalandı · 3. sayfada vurgulandı · Karartma için işaretlendi, 2 işaret bekliyor | — |

6. **Behaviour.**

| Input | Result | Act | Focus after |
|---|---|---|---|
| Copy, Mod+C | Clipboard; bar stays | — | Stays |
| Highlight (click, H) | One Highlight in the current tint, one undo step; the new highlight becomes selected and the bar turns into its annotation bar (so Comment reuses it, RA-6; fixes INV-17) | targeted | From the bar: the annotation bar's Colour; else the page |
| ▾, right-click or long press on Highlight, Alt+Down | Tint tier; a tint applies at once and becomes the current tint | targeted | Back to Highlight |
| Comment (C) | One Highlight with its note open at the end of the last line (RA-6) | targeted | Note field (§16) |
| Redact (X) | A redaction mark; the pending-marks bar appears or counts up | targeted | Page |
| Edit text | Paragraph editor with the selection carried in (F§3.3) | text | Editor |
| E | Outlines the paragraph, "Enter to edit · Esc" in the bar's place; Enter opens | text | Page |
| Underline, Strikeout, Squiggly (U, S) | As Highlight | targeted | As Highlight |
| Find all | Sidebar Find with the text as query | — | Find field |
| Unlock (locked) | Unlock popover at the button (§19) | — | Popover |
| Shift+F10 / Menu key with a selection | Focuses the bar's first item (instead of the page menu) | — | Bar |
| Esc | Tier → selection cleared → (Markup) disarm ladder | — | Page |

   Edge cases: a selection over several pages anchors to its first line inside the bounds and
   acts on every page; a selection taller than the bounds pins to the top edge; a selection
   inside an input, editor or chrome shows no bar; keyboard caret selections (F§3.4) show it
   without taking focus, and announce once per session "F6 reaches the selection actions" /
   "Seçim işlemlerine F6 ile ulaşabilirsiniz".
7. **Motion.** *contextual*; *tier rise* for tints; *select* on the chosen tint; text → annotation
   bar by §3's in-place change. RM: fades.
8. **Accessibility.** `toolbar` "Selected text"; the split segment `aria-haspopup="menu"`,
   `aria-expanded`; tints are `menuitemradio`. Keys H U S C X E stay single keys only while focus
   is on the page or the bar (F§3.3). Pairs: primary on M2 worst 7.90 (dark) / 11.53 (light);
   captions are primary, never secondary, on the phone bar. A-11, A-13, A-15, A-19, A-21.
9. **Implementation.** `selection/SelectionBar.tsx` replaces `annotations/ReadSelectionBar.tsx`
   (Read and Edit rows, `showDocumentMode`, "Mark up…" deleted); commands `selection.copy`,
   `selection.highlight`, `selection.comment`, `selection.redact`, `selection.editText`,
   `selection.underline|strikeout|squiggly`, `selection.findAll`, `selection.copyMarkdown`, each
   with its `act`; `selection-markup.ts` returns the created annotation id. Tests: unit for
   placement on coarse (below) and multi-page anchoring; browser mode for every action's act,
   locked form, focus after each action; e2e J5 (`drag · Comment · type · Esc` makes one Highlight
   with `/Contents`), J9, J10's first half; touch project (WebKit, `hasTouch`) long press on a
   word shows the bar below; axe with the bar and tier open.

## 5. Annotation bar (and lasso variant)

1. **Role.** Restyle, comment or delete one selected annotation, or what a lasso took (F§4.4).
   J5 (after Highlight), J6 (fix a stroke), J8A (the placed signature). Replaces 8.1 and the
   inspector's Properties (6.3, INV-13): its controls live in ⋯.
2. **Anatomy.**

```
Fine (36 px)
╭──────────────────────────────────────────────────────────────╮
│ Pen │ ● Colour ▾ │ ━ 1.5 pt ▾ │ ◷ Comment │ ⌦ Delete │ ⋯ │
╰──────────────────────────────────────────────────────────────╯
Colour tier: 8 inks (or 4 tints) + custom, 32 px swatches · Width tier: stops + slider
Lasso: │ 3 strokes, 1 arrow │ ● ▾ │ ━ ▾ │ ✥ Move │ ⌦ Delete │ ⋯ │
Coarse: 44 px, name hidden below 600 px; compact: 56 px stacked, Colour · Width · Comment · Delete · More
```

   "width or size" follows the kind: stroke width (ink, shapes), font size (text box), size
   (note, stamp, signature: S M L).
3. **Material.** M2 (§2.4). The colour tier shows the user's inks: content colour allowed in chrome
   as ink dots (L§1.1).
4. **States.** §2.5; the armed preset ring is 2 px n12 with a 2 px ink gap, never lime (L§1.9).
   A PDF-locked annotation (`/F` locked) shows "Locked annotation" and only Comment (read-only).
   A locked document shows no bar: a click opens the comment read-only (F§3.1), or, for an
   annotation without a comment, the Lock notice (§19).
5. **Content and copy.** Name from `annotationName` ("Pen", "Kalem"; "3 strokes, 1 arrow" /
   "3 çizgi, 1 ok"). Colour · Width · Font size · Size · Comment · Delete · Move selection: EN /
   TR Renk · Kalınlık · Yazı boyutu · Boyut · Yorum · Sil · Seçimi taşı. ⋯: Opacity, Font, Author,
   Modified, Rotate 90° left, Rotate 90° right (lasso, non-drag alternative to the grip, WCAG
   2.5.7) / Opaklık, Yazı tipi, Yazar, Değiştirilme, 90° sola döndür, 90° sağa döndür. Values in
   `tnum` ("1.5 pt", "40 %"). Icons `circle`-fill swatch, `line-segment`, `chat-centered-text`,
   `trash`, `arrows-out-cardinal`, `dots-three`.
6. **Behaviour.** Every control is `targeted`; each change is one undo step named in history
   ("Change pen colour"). Delete or the Delete key removes it with a toast "Deleted pen · Undo";
   focus goes to the page. Comment opens §16. A drag moves only an already selected object
   (S14). Esc: tier → deselect. In Markup with a drawing tool armed no annotation bar shows.
7. **Motion.** *contextual*; tiers *tier rise*; while the object is dragged the bar hides and
   returns 150 ms after the drop.
8. **Accessibility.** `toolbar` "Pen properties" / "Kalem özellikleri" (existing string);
   swatches `radio` in a `radiogroup` named "Colour"; the width slider is today's `ui/Range`
   at 44 px on coarse. Pairs as §4. A-3 (swatch rings), A-15.
9. **Implementation.** `AnnotationBar.tsx` and `lasso/LassoSelection.tsx`'s `LassoBarControls` move
   onto ContextBar; `StyleControls.tsx` splits into `ColourTier` and `WidthTier`;
   `AnnotationProperties.tsx` content moves into ⋯ as a popover (§15); `RightPanel.tsx` Properties
   deleted. Tests: browser mode per kind (which controls show), one history entry per change,
   locked document opens read-only comment; e2e annotation restyle and lasso move with keyboard
   rotate; pixel registry entry for the tier.

## 6. Image bar

1. **Role.** Replace, save or delete an image of the page content (F§4.4). Shown when the Image
   tool is armed and an image clicked, or after "Select image" in the page menu (§13; see Issue 3).
   Replaces 8.2.
2. **Anatomy.**

```
Fine (36 px):  ╭ ⇪ Replace… │ ⤓ Save image │ ⌦ Delete │ 612 × 792 pt · 1700 × 2200 px · 200 dpi ╮
Coarse (44 px): the readout moves into ⋯ below 840 px; compact 56 px: Replace · Save · Delete · More
```

3. **Material.** M2.
4. **States.** §2.5; Replace busy while decoding; an image shared by other pages (Form XObject)
   shows the warning glyph and "Also on pages 2–5" in ⋯ before Replace commits.
5. **Copy.** Replace… · Save image · Delete · "Also on pages 2–5" · readout. TR: Değiştir… ·
   Görseli kaydet · Sil · "2–5. sayfalarda da var". Readout in `tnum`. Icons `image`, `download-simple`,
   `trash`, `warning`.
6. **Behaviour.** Replace and Delete `targeted` (toast with Undo); Save image needs no guard and
   works when locked (the locked bar shows Save image and Unlock). Arrows nudge, Mod+arrows resize
   (as today); Esc deselects.
7. **Motion.** *contextual*; readout numbers change without animation.
8. **Accessibility.** `toolbar` "Image"; the readout is `aria-live="off"` while resizing and
   announced once at release. A-15.
9. **Implementation.** `ImageBar.tsx` onto ContextBar; "Extract" renamed Save image (INV-15).
   Tests: browser mode locked form; e2e replace and undo.

## 7. Field bar and field properties

1. **Role.** Edit a form field the person created (F§4.4, J7 authoring). Replaces the opaque
   field properties popover (8.20) with a bar plus an M4 popover.
2. **Anatomy.** `╭ ▭ Text field ▾ │ Name [client_name    ] │ ☐ Required │ ⋯ ╮`, 36 / 44 px; the
   name input is an opaque well (L§2.10) 160 px wide, 16 px text on coarse. ⋯ → "Properties…"
   popover (tooltip, options, tab order). Compact: Kind · Required · More; name in the popover.
3. **Material.** M2 bar, M4 popover; inputs solid.
4. **States.** §2.5; Required on = `-fill` checkbox glyph with `--accent-muted`; duplicate name:
   error text under the input in `--danger` glass variant with the cross glyph.
5. **Copy.** Kinds Text field · Checkbox · Radio button · Dropdown · List box · Signature · Button
   / Metin alanı · Onay kutusu · Seçenek düğmesi · Açılır liste · Liste kutusu · İmza · Düğme.
   Name · Required · Properties… / Ad · Zorunlu · Özellikler…. Error "Another field has this
   name" / "Bu adda başka bir alan var".
6. **Behaviour.** All `targeted`; kind change is one undo step; Enter in the name commits, Esc
   restores. Mod+D duplicates (today).
7. **Motion.** *contextual*; popover *popup*.
8. **Accessibility.** Kind is a menu button; Required a `checkbox`. Primary on M2 7.90 / 11.53.
9. **Implementation.** New `forms/create/FieldBar.tsx`; `FieldProperties.tsx` becomes popover
   content. Tests: browser mode; e2e create a field and rename it.

## 8. Form accessory

1. **Role.** Next, previous, clear and done for a focused field while the virtual keyboard is up
   (F§4.4, M-28): J7 on touch. New.
2. **Anatomy.** `╭ ‹ › │ Field 2 of 4 │ Clear │ Done ╮`, 44 px, full width minus 16 px, pinned to
   `--vv-bottom` (M-4); medium coarse: 480 px centred.
3. **Material.** M2, σ 8 (390 × 44, c 0.994).
4. **States.** ‹ or › disabled at the ends ("First field" / "Last field"); Clear disabled on an
   empty field; locked: never shown (the field shows the Lock notice instead).
5. **Copy.** Previous field · Next field · Field 2 of 4 · Clear · Done / Önceki alan · Sonraki
   alan · Alan 2/4 · Temizle · Bitti. Icons `caret-left`, `caret-right`; numbers `tnum`.
6. **Behaviour.** ‹ › move focus in the file's tab order and scroll the field into the bounds;
   Clear is `targeted` (one undo step); Done blurs and hides the keyboard. Esc restores the value
   (F§3.1).
7. **Motion.** Follows the keyboard with no animation of its own; RM same.
8. **Accessibility.** `toolbar` "Form field"; real `<input>`s stay in reading order. A-15.
9. **Implementation.** New `forms/FormAccessory.tsx`, mounted by `FormLayer.tsx` on coarse
   pointers. Tests: touch project e2e (WebKit) J7 with Next.

## 9. Pending-marks bar

1. **Role.** Keeps unapplied redaction marks visible until Apply or Clear (F§4.4, S16, J10).
   Replaces the tool bar's Apply (7.11) and the Marks header's Apply (5.11).
2. **Anatomy.**

```
Fine, medium and up (40 px, above the dock or palette, 8 px gap)
╭──────────────────────────────────────────────────╮
│ ▮ 2 marks · ▭ Mark area · Apply 2            ⋯ │   Apply: secondary button, 32 px
╰──────────────────────────────────────────────────╯
Compact: a 40 px row inside the dock's glass, above its items; compact-height: beside the rail
```

3. **Material.** M2 σ 8 (480 × 40, c 0.988); on compact it shares the dock's filtered element
   (L§2.9). No light (redaction, L§3.2).
4. **States.** Hidden with zero marks; Apply busy while the confirmation runs; locked: Mark area
   and Apply dimmed with "Locked", Unlock added.
5. **Copy.** "{n} mark(s)" with plural forms · Mark area · Apply {n} · ⋯ Review marks · Find
   sensitive data… · Clear marks / "{n} işaret" · Alan işaretle · {n} işareti uygula · İşaretleri
   gözden geçir · Hassas verileri bul… · İşaretleri temizle. Icons custom *redact*, `square`.
6. **Behaviour.** Mark area opens Markup with Redact armed (`freehand`); Apply opens the
   confirmation (dialogs family) then the toast "2 areas redacted · Undo · Details" and disarms
   Redact (F§4.4), act `document`; Clear marks: confirmation in the dialogs family, toast with
   Undo (`document`); Review marks opens the sidebar's Review on Marks (J/K steps). Focus after
   Apply: the toast's Undo is in the F6 cycle; focus returns to the page.
7. **Motion.** *tier rise* above the dock or palette; on compact the dock's clip grows by 40 px
   (*bar morph*); count changes use *replace*.
8. **Accessibility.** `region` "Redaction marks" with `aria-live="polite"` on the count only; F6
   stop before the dock (F§7.2). Pairs: primary on M2 7.90 / 11.53.
9. **Implementation.** New `redaction/PendingMarksBar.tsx`; Apply removed from
   `FloatingToolbar.tsx` and `RedactionsPanel.tsx`. Tests: browser mode count, locked form;
   e2e J10 mouse path (6 steps) and its keyboard path through F6.

## 10. Pages bar (a morph of the dock)

1. **Role.** Act on selected pages (F§4.4, J4): in the Pages grid always, in viewing when pages
   are selected explicitly in the sidebar. The dock (frame family) owns the shape and the morph;
   this section owns the content. Replaces 8.4.
2. **Anatomy.**

```
Grid, large (48 px; 56 coarse)
╭────────────────────────────────────────────────────────────────────────────────────╮
│ ✓ Done │ 3 selected │ ↺ ↻ │ ‹ › │ ⌦ Delete │ Extract │ Duplicate │ Move to ▾ │ ⋯ │
╰────────────────────────────────────────────────────────────────────────────────────╯
Nothing selected: │ ✓ Done │ 12 pages │ Select all │ ⋯ │
Viewing, sidebar selection: ✕ (clear) replaces ✓ Done; in Markup it rises as a tier above the palette
Compact (64 px): │ ✓ │ 3 · ↺ ↻ · ‹ › · Delete │ ⋯ │   (Extract, Duplicate, Move to in ⋯)
Locked: │ ✓ Done │ 3 selected │ Extract │ Copy │ ⊡ Unlock │
```

   Shedding: Duplicate, Extract, Move to into ⋯ (expanded keeps Delete, Extract, Move ▾).
3. **Material.** The dock's M2 element; *sheen* after the morph (fine, Clear).
4. **States.** §2.5; ‹ disabled at the first page ("Already first"), › at the last; Delete dims
   when every page would go ("A document needs one page").
5. **Copy.** Done · {n} selected · Rotate left · Rotate right · Move earlier · Move later · Delete
   · Extract · Duplicate · Move to · Select all · ⋯ Insert blank page after · Crop… · Copy ·
   Paste after / Bitti · {n} seçili · Sola döndür · Sağa döndür · Öne al · Geriye al · Sil · Yeni
   belgeye · Çoğalt · Taşı · Tümünü seç · Arkasına boş sayfa ekle · Kırp… · Kopyala · Arkasına
   yapıştır. Icons `check`, `arrow-counter-clockwise`, `arrow-clockwise`, `caret-left`,
   `caret-right`, `trash`, custom *extract* (fallback `file-arrow-up`), `copy`, `folder-simple`.
6. **Behaviour.** All `pages` except Extract and Copy (no change; allowed locked). Keys:
   Shift+R, Shift+Alt+R, Alt+arrows, Mod+D, Mod+Shift+E, Delete (F§7.2). Each act is one undo step
   with a toast for removals ("Deleted 3 pages · Undo"). Done leaves the grid (F§2.1); ✕ clears
   the sidebar selection. Move to ▾ lists the other open documents and "New document" (§14).
7. **Motion.** *bar morph* from the dock (`clip-path`, chips FLIP with 15 ms stagger); count
   *replace*; RM 120 ms cross-fade.
8. **Accessibility.** `toolbar` "Selected pages" / "Seçili sayfalar"; the count is announced
   politely on change. ‹ › are the non-drag reorder (WCAG 2.5.7, INV-R8).
9. **Implementation.** `stage/ContextualBar.tsx` → `stage/PagesBar.tsx`, content rendered inside
   the frame family's `Dock` morph slot. Tests: browser mode content per selection and lock; e2e
   J4 grid path (5 steps), touch reorder by ‹ ›.

## 11. Compare bar (a morph of the dock)

1. **Role.** Step through changes and adjust the comparison (F§2.1, J12). Replaces 11.5 and the
   stale notice 11.9; layout moves to Compare's top bar.
2. **Anatomy.**

```
Large (48 px):     │ ‹ change 3 of 12 › │ Swap │ ⋯ │          (Changes docked from large)
Medium, expanded:  │ ‹ change 3 of 12 › │ Changes │ Swap │ ⋯ │
Compact (64 px):   │ ‹ 3 / 12 › │ Swap │ ⋯ │                 (A · B · Changes switch at the top)
Running: │ Comparing… 40 % ▬▬▬▬░░░░ │ Cancel │    Stale tier: │ ⚠ A compared document changed · Run again │
```

3. **Material.** Dock element; no light in Compare (L§3.2), so progress is a determinate bar.
4. **States.** ‹ › disabled at the ends; zero changes: "No changes found"; heat map on uses
   `-fill` glyph and `--accent-muted`.
5. **Copy.** change {i} of {n} · Previous change · Next change · Changes · Swap · ⋯ Heat map ·
   Overlay opacity · Fit width · Fit page · Run again · Comparing… {p} % · Cancel · No changes
   found · A compared document changed / değişiklik {i}/{n} · Önceki değişiklik · Sonraki
   değişiklik · Değişiklikler · Yer değiştir · Isı haritası · Üst katman opaklığı · Sayfa genişliği ·
   Tam sayfa · Yeniden karşılaştır · Karşılaştırılıyor… %{p} · İptal · Değişiklik bulunamadı ·
   Karşılaştırılan bir belge değişti. Numbers `tnum`.
6. **Behaviour.** J / K and ‹ › step (scroll-to plus *undo reveal* ring on the change); Swap swaps
   A and B; nothing here changes a document, so no guard and it works locked. Esc in Compare
   closes Compare (F§7.2).
7. **Motion.** *bar morph* on entering Compare (with its *view change*); stale tier *tier rise*.
8. **Accessibility.** `toolbar` "Changes"; the position "change 3 of 12" is `aria-live="polite"`.
9. **Implementation.** New `compare/CompareBar.tsx` extracted from `CompareView.tsx`. Tests: e2e
   compare stepping and Swap; compact project switch.

## 12. Menu primitive and action sheet

1. **Role.** Every menu in the app (title menu contents excepted, frame family), static with
   reasons (RA-21). Replaces `ui/Menu.module.css` used by 13 menus.
2. **Anatomy.**

```
Menu (fine, M4, radius 12 → 8 px rows, min 200, max 320 px)   Action sheet (compact, M3 at 40 %)
╭──────────────────────────────────╮                         ╭────────────── ▬ ─────────────╮
│ ⊡ Unlock document               │ ← locked only, first    │ Page 3                        │
│──────────────────────────────────│                         │ Add note here                 │ 52 px rows
│ □ Add note here               N  │ keycap: n11, caption    │ Rotate page right             │
│ ✑ Add signature here          ▸  │                         │ Delete page                   │ danger
│ ↻ Rotate page right       ⇧ R    │                         │ Crop page…                    │
│ ⌦ Delete page                    │ danger glass variant   │   Locked · unlock first       │ reason line
│ ⌗ Crop page…    Locked · unlock first │ reason replaces keycap │ ╭──────── Cancel ────────╮ │
╰──────────────────────────────────╯                         ╰───────────────────────────────╯
```

3. **Material.** M4 (§2.4: σ 24, 12 under 92 px tall, 20 coarse); action sheet uses the phone
   sheet at 40 % (M3), solid at 92 % (L§2.10). Rows with secondary text sit on M4 only (L§2.6).
4. **States.** Row: rest n12 label; highlighted `--surface-active`; checked: `check` glyph
   (checkbox items) or 6 px dot (radio), never lime fill; disabled: label `--glass-text-disabled`,
   reason in `--glass-text-secondary` n11 (6.30:1 dark, 7.13:1 light on M4 worst; n9 tertiary
   would be 3.86:1, so it is not used); destructive in danger glass (6.21 / 5.79).
5. **Copy.** Sentence case, verb first, "…" when a sheet follows; reasons ≤ 32 characters EN
   (TR designed at 1.8×, L§4.4), e.g. "Locked · unlock first" / "Kilitli · önce kilidi açın".
   Keycaps per platform (`⌘ ⇧ ⌥`, "Ctrl Shift Alt"); shown on fine pointers, on coarse only after
   a physical key press (L§6.2). Action sheet ends with Cancel / Vazgeç.
6. **Behaviour.** Base UI `Menu` (controlled; point menus use a virtual anchor); arrows,
   Home/End, typeahead (Turkish-aware, locale-folded), Right/Left for submenus, Enter/Space,
   Esc closes one level and restores focus; hover opens submenus after 100 ms. Disabled items use
   `focusableWhenDisabled` so the reason is read. `presentation: 'auto' | 'menu' | 'sheet'`: auto
   is sheet on compact and compact-height for context menus, More and the title menu.
7. **Motion.** *popup* from the trigger or point (`transform-origin` there), *materialize*;
   submenu rule MC-14; sheet *sheet*. RM: 120 ms fade.
8. **Accessibility.** `role="menu"`, `menuitem` / `menuitemcheckbox` / `menuitemradio`,
   `aria-keyshortcuts` on items, keycaps `aria-hidden`, reason via `aria-describedby`; group
   headings as `group` with label. Rows 28 / 44 px. A-13, A-15, A-21 (no fixed widths; reasons
   wrap to two lines rather than clip).
9. **Implementation.** New `ui/Menu.tsx` (`Menu`, `MenuItem` with `reason`, `MenuSubmenu`,
   `MenuGroup`, `ActionSheet`) over Base UI `menu` and the dialogs family's `ui/Sheet`; one
   `MenuItem` reads `useCanChange(id, act)` and the registry's shortcut. Tests: browser mode
   (disabled focusable and described, typeahead with "İ"/"ı", sheet on compact), axe per menu in
   the a11y matrix, pixel registry 200 × 64 σ 12.

## 13. Page menu

1. **Role.** Targeted page actions and "Add … here" with no mode (F§4.5, RA-21): J4, J8A by
   page menu, S8, S17, S18. Opened by right-click, Shift+F10 / Menu key on the focused page,
   long press on paper (§2.3). Replaces 8.10 (its "Switch to Edit" dead end, INV-2).
2. **Anatomy.** One column, fine 28 px rows (≈ 470 px tall), coarse 44; action sheet on compact:

```
[⊡ Unlock document]                 (locked only)
Page 3                               heading, n11
□ Add note here                 N
T Add text here                 T
✑ Add signature here            ▸    saved signatures (≤ 5) · New signature…
⊞ Add image here…               I
✓ Add stamp here                ▸    Draft · Approved · Confidential
¶ Edit text here
⌕ Recognize text on this page
─────────────
[image group, only on an image: Select image · Replace image… · Save image · Delete image]
↺ Rotate page left         ⇧ ⌥ R
↻ Rotate page right          ⇧ R
⌦ Delete page                          danger
⌗ Crop page…
+ Insert blank page after
⇪ Insert pages from file…
─────────────
Extract page…   ·   Copy page   ·   Paste pages after          (three rows)
▦ Show in Pages grid             3
```

3. **Material.** §12.
4. **States.** Locked: change items dimmed "Locked · unlock first", Unlock heads; Edit text here
   on a page without text "No text on this page"; Recognize on a page with text "This page
   already has text"; Paste with nothing copied "Nothing copied yet"; Delete on a one-page
   document "A document needs one page"; Add signature here ▸ with no saved signature shows only
   New signature….
5. **Content and copy.**

| EN | TR |
|---|---|
| Page {n} | Sayfa {n} |
| Add note here · Add text here · Add signature here · Add image here… · Add stamp here | Buraya not ekle · Buraya metin ekle · Buraya imza ekle · Buraya görsel ekle… · Buraya damga ekle |
| New signature… · Draft · Approved · Confidential | Yeni imza… · Taslak · Onaylandı · Gizli |
| Edit text here · Recognize text on this page | Metni burada düzenle · Bu sayfadaki metni tanı |
| Select image · Replace image… · Save image · Delete image | Görseli seç · Görseli değiştir… · Görseli kaydet · Görseli sil |
| Rotate page left · Rotate page right · Delete page · Crop page… | Sayfayı sola döndür · Sayfayı sağa döndür · Sayfayı sil · Sayfayı kırp… |
| Insert blank page after · Insert pages from file… | Arkasına boş sayfa ekle · Dosyadan sayfa ekle… |
| Extract page… · Copy page · Paste pages after · Show in Pages grid | Yeni belgeye çıkar… · Sayfayı kopyala · Arkasına yapıştır · Sayfa ızgarasında göster |
| Unlock document · Cancel | Belgenin kilidini aç · Vazgeç |
| Reasons (above) | Kilitli · önce kilidi açın · Bu sayfada metin yok · Bu sayfada zaten metin var · Henüz kopyalanan bir şey yok · Belgede en az bir sayfa kalmalı |

   Icons: `note`, `textbox`, `signature`, `image`, `stamp`, custom *edit-text*, `scan`,
   `arrow-counter-clockwise`, `arrow-clockwise`, `trash`, `crop`, `file-plus`, `file-arrow-down`,
   `copy`, `clipboard`, `squares-four`, `lock-simple-open`.
6. **Behaviour.**

| Item | Act | Point | Focus after; announcement |
|---|---|---|---|
| Add note / text / signature / image / stamp here | place | The press point; from the keyboard, the caret, else the visible centre of the focused page | Note: note field; text: text editor; others: the placed object selected (arrows nudge 1 pt, F§3.4). Toast "Added note on page 3 · Undo" |
| Edit text here | text | The press point | Editor at the point |
| Recognize text on this page | document | — | OCR sheet preset to this page |
| Rotate left / right | pages | — | Page; "Rotated page 3 · Undo" toast (S18) |
| Delete page | pages | — | Page now at that position; "Deleted page 3 · Undo" for 10 s (S8) |
| Crop…, Insert…, Paste | pages | — | Their sheet, or the page |
| Extract…, Copy page, Show in Pages grid | — | — | Extract sheet; page; grid with this page focused |
| Unlock document | — | — | Unlock popover anchored at the menu's point (§19) |

   A right-click on selected text gives the selection bar's focus (§4), not this menu; inside an
   editor or input the browser's own menu stays (today's `OWN_MENU`). In Markup with a drawing
   tool armed, right-click still opens it (F§3.1). The Delete page row shows no keycap: Delete
   acts only on a visible selection (Issue 5).
7. **Motion.** *popup* from the point; action sheet *sheet*.
8. **Accessibility.** `menu` "Page 3"; keyboard opening anchors 24 px inside the focused page's
   visible corner (today). A-13, A-15, A-19.
9. **Implementation.** `stage/PageContextMenu.tsx` rebuilt on `ui/Menu`; listens through the
   long-press recogniser and `contextmenu`; `KEYBOARD_ECHO_MS` kept; new commands
   `page.addNoteHere`… with `act: 'place'` and a point argument; `arrangePage` → "Show in Pages
   grid". Tests: unit for point resolution (pointer, keyboard, caret); browser mode for every
   reason; e2e S8 and S17 (one undo step each), locked dimming, J8A by page menu; touch project:
   long press on paper opens the sheet on compact, a menu on medium; Android `contextmenu` echo
   does not open twice.

## 14. Menu catalogue

All use §12. "Trigger owner" is the family that draws the button; contents are listed here unless
another family owns them.

| Menu | Trigger (owner) | Contents | Replaces |
|---|---|---|---|
| Selection ⋯ | §4 | Underline U · Strikeout S · Squiggly · Highlight colour ▸ · Find all · Copy as Markdown | 8.3 Edit row |
| Annotation ⋯ | §5 | A popover (§15), not a menu: Opacity, Font, Author, Modified; lasso adds Rotate 90° left / right | 6.3 |
| Move to ▾ | Pages bar | Each other open document with its tag dot and page count; "New document" / "Yeni belge" | 8.16 |
| Grid cell menu | Right-click or Shift+F10 on a cell (grid family) | Pages bar actions + Copy to new document · Cut Mod+X · Copy Mod+C · Paste after Mod+V · Select odd · Select even · Reverse order | 8.11 |
| Section menu | ⋯ on a grid section header (grid family) | Rename F2 · Reverse · Interleave… · Split… · Combine into ▸ · Insert images… · Resize… · Crop… · Close; reasons as 8.12 | 8.12 |
| Tab menu | Right-click or long press on a tab (frame) | Rename F2 · Lock / Unlock · Show in Pages grid · Compare with… · Close · Close others | 8.13 |
| Outline item menu | Sidebar Outline (sidebar family) | Every bookmark edit with keys, unchanged | 8.14 |
| Recents row ⋯ | Library (Library family) | Open · Forget kept changes · Remove from Recents | 8.15 |
| Library card menu | Right-click a card (Library) | Open · Show in Pages grid · Compare with… · Combine with… · Close | — |
| Shapes ▾ · Stamp ▾ · Sign ▾ · Add field ▾ | Markup palette (palette family) | F§4.3; this family supplies the primitive only | 8.7–8.9 |
| More · page pill · title menu | Dock, pill, title (frame) | F§4.2, F§4.6; primitive only | 8.5, 8.6 |

TR for new labels: Yeni belgeye kopyala · Kes · Kopyala · Arkasına yapıştır · Tekleri seç · Çiftleri
seç · Sırayı ters çevir · Yeniden adlandır · Kilitle / Kilidi aç · Karşılaştır… · Kapat · Diğerlerini
kapat · Aç · Saklanan değişiklikleri unut · Son kullanılanlardan kaldır · Birleştir…. Tests: one
browser-mode test per menu for its reasons; axe in the matrix.

## 15. Popover primitive and link popover

1. **Role.** Non-modal panels anchored to a control or a point: link (here), note (§16), privacy
   (§17), History (§18), Unlock (§19), annotation properties (§5), field properties (§7), the
   paragraph editor's info (8.19, text-edit family, content unchanged) and Save's Replace popover
   (F§5.1, frame family, content theirs). The link popover replaces 8.18.
2. **Anatomy.** M4, radius 12 (16 with squircles), padding 12/16, width `min(320px, 100vw − 16px)`
   (privacy and History 360). Title 15/20 at 600, body 13/18, buttons 32 / 44 px, primary
   trailing.

```
╭────────────────────────────────────────╮
│ Open this link in a new tab?           │
│ It leaves Recto and contacts           │
│ example.com.                           │
│                   [ Copy link ] [ Open ]│
╰────────────────────────────────────────╯
```

3. **Material.** M4 (σ 16 under 120 px, else 24, coarse 20); body text n11.
4. **States.** §2.5 on buttons; Open is the popover's primary (ink on lime dark, lime on ink
   light: 16.42 / 14.79) because the popover is transient and the only lime on screen while open.
5. **Copy.** Title, body, Copy link, Open / "Bu bağlantı yeni sekmede açılsın mı?" · "Recto'dan
   çıkar ve example.com ile bağlantı kurar." · Bağlantıyı kopyala · Aç. Fine-pointer hover on any
   link: tooltip "Go to page 7" / "Sayfa 7'ye git" or the host and path. Missing target: tooltip
   "This link points to a page that is not in this document" (existing string).
6. **Behaviour.** Internal links jump (scroll-to); external ones open the popover (click, Enter,
   tap). Links work in viewing, in Markup with Select, and when locked; never with another tool
   armed. Focus moves to Open on open; Esc or an outside press closes and returns focus to the
   hotspot.
7. **Motion.** *popup*, *materialize*; RM fade.
8. **Accessibility.** `role="dialog"`, `aria-modal="false"`, `aria-labelledby` the title. A-13,
   A-24 (stays until dismissed).
9. **Implementation.** New `ui/Popover.tsx` (Root, Title, Body, Actions over Base UI `popover`,
   `collisionBoundary` = bounds); `Popover.module.css` rewritten; `LinkLayer.tsx` gains Copy
   link. Tests: `LinkLayer.test.ts` extended (locked, tool armed); axe.

## 16. Note popup

1. **Role.** Write or read a comment on a note or any annotation (RA-6; J5). Replaces 9.11.
2. **Anatomy.**

```
Fine (260 px; coarse 300)                       Compact: docked above the keyboard
╭───────────────────────────────╮               ╭──────────────────────────────╮
│ Ada Lovelace · 14:02       ⋯  │ n11, tnum     │ “quoted selection…”          │
│ ┌───────────────────────────┐ │               │ ┌──────────────────────────┐ │
│ │ page-white field, ink text│ │ ≥ 72 px       │ │ field                    │ │
│ └───────────────────────────┘ │               │ └──────────────────────────┘ │
│ [Delete]        [Cancel] [Done]│               │ [Delete]   [Cancel] [Done]  │
╰───────────────────────────────╯               ╰──────────────────────────────╯
```

3. **Material.** M4 frame; the field is page white with page ink (L§2.10), focus ring outside it.
4. **States.** New note: no Delete; empty Done on a new note drops it; locked: field read-only
   (text selectable), footer becomes "Locked · Unlock".
5. **Copy.** Add a comment (placeholder) · Delete · Cancel · Done · No author / Yorum ekleyin ·
   Sil · Vazgeç · Bitti · Yazar yok. Author asked once, inline (today's prompt).
6. **Behaviour.** Placement: to the end of the anchor, top edges aligned, then flip and shift
   (`placeNotePopup` moves into `place.ts`). Esc and an outside press save (today); Mod+Enter
   saves; Cancel discards edits; Done saves. Save is `targeted`, one undo step "Comment on page
   3". Focus on open: the field; after close: the annotation (selected) or the page.
7. **Motion.** *popup* from the anchor; compact docks with the keyboard, no motion of its own.
8. **Accessibility.** `dialog` "New note" / "Edit comment" (existing); field `textbox` multiline
   named by the quoted text when present. A-24.
9. **Implementation.** `annotations/NotePopup.tsx` split from `InlineEditors.tsx`. Tests: browser
   mode save paths and locked; e2e J5 keyboard path (C, type, Esc).

## 17. Privacy popover

1. **Role.** Proves "nothing leaves this device" and lists what is kept here (F§5.2, F§9.4).
   Opened by ◎ (top strip, medium and up) or the title menu's privacy line (compact: pushed inside
   the action sheet). Replaces 8.17.
2. **Anatomy.**

```
╭──────────────────────────────────────────────╮ 360 px
│ ● Nothing has left this device               │ title, `shield-check`
│ Files are read in this tab and never uploaded.│
│ External requests            None observed   │
│ Content Security Policy      Own origin only │
│ Kept on this device   3 documents · 12.4 MB  │
│                                    [Clear…]  │
│ ⚠ The browser may clear kept changes [Keep them] │ only when not persistent
│ Offline                      Ready           │
│ Recto 1.0.0 · About Recto ›                  │
╰──────────────────────────────────────────────╯
```

3. **Material.** M4 σ 24; labels n11, values n12 `tnum`.
4. **States.** External request observed: title "This page contacted other servers" with
   `shield-warning` and the list; private window: "Changes are not kept in this window" in place
   of the kept line; storage persistent: the warning row hidden.
5. **Copy.** Existing strings (`privacy_*`) plus: Kept on this device · {n} documents · Clear… ·
   The browser may clear kept changes · Keep them · Changes are not kept in this window · Ready
   to work offline · About Recto / Bu cihazda saklananlar · {n} belge · Temizle… · Tarayıcı
   saklanan değişiklikleri silebilir · Saklansın · Bu pencerede değişiklikler saklanmaz ·
   Çevrimdışı çalışmaya hazır · Recto hakkında.
6. **Behaviour.** No document act. Clear… opens a confirmation (dialogs family); Keep them calls
   `navigator.storage.persist()` and reports the answer; About opens Settings → About. Focus:
   title on open (read first), Esc returns to ◎.
7. **Motion.** *popup*.
8. **Accessibility.** `dialog` labelled by the title; the request count `aria-live="polite"`.
9. **Implementation.** `privacy/PrivacyPopover.tsx` split from `PrivacyIndicator.tsx` (the status
   bar indicator goes with the status bar). Tests: browser mode for the three storage states.

## 18. History scrubber

1. **Role.** Jump anywhere in history (F§5.3; INV-4). Long press or right-click on ↶, Shift+F10
   on ↶, or ⌘K `history`. Replaces the inspector's History (6.6).
2. **Anatomy.**

```
Fine: list popover under ↶ (360 × ≤ 400)        Coarse: slider popover (360 × 120; compact 100vw − 16)
╭──────────────────────────────────────╮         ╭──────────────────────────────────────╮
│ History · report.pdf, agreement.pdf  │         │ Pen on page 4 · 14:02                │
│ 14:05  Highlight · p. 2 · agreement  │         │ ├──┼──┼──┼──┼──●──┼──┼──┤            │
│ 14:02 ✓Pen · p. 4          (current) │         │ 12 of 20                [Cancel]     │
│ 13:58  Deleted page 7                │         ╰──────────────────────────────────────╯
│ 13:40  Opened                        │
╰──────────────────────────────────────╯
```

3. **Material.** M4 σ 24 (list), σ 16 (slider, 120 px tall, c 0.9998).
4. **States.** Current row: `check` glyph and `--accent-muted` (primary text only, L§2.6); future
   rows (redo side) n11; empty history: "Nothing to undo yet" / "Henüz geri alınacak bir şey yok".
5. **Copy.** History · {label} · p. {n} · Opened · {i} of {n} · Cancel / Geçmiş · {label} · s. {n} ·
   Açıldı · {i}/{n} · Vazgeç. Labels are today's history strings; document names show only with
   two or more documents open. Times and counts `tnum`.
6. **Behaviour.** Fine: click or Enter jumps (`jumpTo`); press and drag along the list previews
   each row, release jumps. Coarse: drag previews per detent (at most one `jumpTo` per 100 ms,
   only visible pages re-render), release keeps, Cancel restores the start. Jumps bypass
   `commit()` and work locked (F§2.5 rule 4). After a jump: *undo reveal* on the change, focus
   back to ↶. Announce on release: "Now at step 12 of 20: Pen on page 4" / "Şimdi 20 adımdan
   12.: 4. sayfadaki kalem çizimi".
7. **Motion.** *popup*; slider thumb *press*, preview without animation; *undo reveal* once.
8. **Accessibility.** List: `listbox` with `aria-activedescendant`; slider: `slider` with
   `aria-valuetext` = the step label. ↶ carries `aria-haspopup="dialog"` for the long press and
   `aria-keyshortcuts` for Mod+Z.
9. **Implementation.** New `history/HistoryScrubber.tsx`; ↶ (frame family) uses `useLongPress`.
   Tests: browser mode jump and cancel; e2e jump while locked keeps bytes unchanged except by
   history; motion sweep: no animation during preview.

## 19. Lock notice and Unlock popover

1. **Role.** Say a document is locked, at the place someone tried to change it, and offer the
   unlock (F§2.6, A-19). Replaces 9.14 ("Switch to Edit to fill").
2. **Anatomy.**

```
Lock notice (M1 chip under the field, 6 px gap; above near the bounds' bottom)
  ╭ ⊡ Locked · Unlock ╮   28 px fine (Unlock 24 high), 44 coarse

Unlock popover (anchored to the asking control: dock Locked, tab glyph, a bar's Unlock,
the Lock notice, a dimmed item, or the control whose change commit() refused)
╭──────────────────────────────────────────╮
│ ⊡ report.pdf is locked                  │
│ You locked it. Nothing changes until you │
│ unlock it.                               │
│                  [ Keep locked ] [Unlock]│
╰──────────────────────────────────────────╯
```

3. **Material.** Notice M1 (σ 5 / 8); popover M4. No warning wash; the signed and restricted
   forms carry the `seal-check` or `warning` glyph with words.
4. **States.** Per reason:

| Reason | Title | Body | Buttons (default focus first) |
|---|---|---|---|
| user | report.pdf is locked | You locked it. Nothing changes until you unlock it. | Unlock · Keep locked |
| signed | Signed by {name} · locked | Any change removes the digital signature when you save. Save a copy with Signature signs it again. | Keep locked · Unlock anyway |
| restricted | Restricted by the file | The file's author asked apps not to change it. Recto can change it anyway; other apps may still refuse the copy. | Keep locked · Unlock anyway |
| default | Documents open locked | Set in Settings. Unlock this document to change it. | Unlock · Settings… |

5. **Copy (TR).** Kilitli · Kilidi aç · "report.pdf kilitli" · "Siz kilitlediniz. Kilidi açana
   kadar hiçbir şey değişmez." · "{name} tarafından imzalandı · kilitli" · "Herhangi bir değişiklik,
   kaydettiğinizde dijital imzayı kaldırır. İmza seçeneğiyle Kopya kaydet, belgeyi yeniden
   imzalar." · "Dosya tarafından kısıtlandı" · "Dosyanın yazarı uygulamalardan değiştirmemelerini
   istemiş. Recto yine de değiştirebilir; başka uygulamalar kopyayı düzenlemeyi reddedebilir." ·
   "Belgeler kilitli açılıyor" · "Ayarlar'da belirlendi. Değiştirmek için bu belgenin kilidini
   açın." · Kilidi aç · Kilitli kalsın · Yine de kilidi aç · Ayarlar….
6. **Behaviour.** The notice shows on a click or focus of a field in a locked document (F§3.1),
   stays until focus leaves the field, and is reached by Tab right after the field. Unlock changes
   `lock-store` only (no history entry), announces "Unlocked report.pdf" / "report.pdf kilidi
   açıldı", and returns focus to the asking control so the next press acts. `signed` warns once
   per document (F§2.6). A `commit()` refusal opens this popover at the asking control (F§2.5).
7. **Motion.** Notice and popover *popup*; Locked ⇄ Markup in the dock is the frame family's *bar
   morph*.
8. **Accessibility.** Notice: `role="status"`, polite: "Locked. Unlock to fill this field." /
   "Kilitli. Bu alanı doldurmak için kilidi açın."; popover `alertdialog` only for `signed` and
   `restricted`, else `dialog`. Pairs: primary on M1 worst 7.78 / 11.18. A-19 (glyph and word).
9. **Implementation.** New `lock/LockNotice.tsx` (mounted by `FormLayer.tsx`, replacing its
   notice), `lock/UnlockPopover.tsx`, `lock/open-unlock.ts` (the one entry used by bars, menus,
   keys and `commit()`). Tests: browser mode for four reasons; e2e S6, S7 locked, every act
   refused with the popover at the asking control.

## 20. Tooltip

1. **Role.** Names and keys for controls, reasons for dimmed ones (I-6, RA-21); the first
   tooltips on touch (INV-6). Replaces 8.21.
2. **Anatomy.** `╭ Undo pen on page 4  ⌘ Z ╮` 26 px fine (28 coarse), padding 4/8, max 280 px,
   wraps to two lines; keycaps 18 px `--radius-xs`, caption 11/14 `case`.
3. **Material.** Solid n4 (light n1) with the M4 rim, e2 (G-29); no blur.
4. **States.** Label n12 (13.14:1 dark on n4; 17.65 light on n1); keycaps n11 on n5 (8.56 / 9.89);
   reason line n10 (6.45 / 7.61).
5. **Copy.** "{name}" · "{name} · {keys}" · disabled "{name}: {reason}", e.g. "Undo: nothing to
   undo" / "Geri al: geri alınacak bir şey yok"; "Highlight · H" / "Vurgula · H". Never repeats a
   visible label without adding the key or reason.
6. **Behaviour.** Fine pointer: 500 ms hover, 0 ms while warm (400 ms), 0 ms close (Base UI
   Provider as today); focus shows it at once; Esc closes it and passes the key on (today's fix).
   Hoverable and persistent (A-24). Coarse: a touch held 450 ms on an icon-only control shows it
   until release, and that release does not activate the control; controls with their own long
   press (↶, Highlight) use that instead. Keycaps hidden on coarse until a physical key press.
7. **Motion.** *tooltip*; RM fade.
8. **Accessibility.** `role="tooltip"`; the trigger keeps its own `aria-label` and
   `aria-keyshortcuts`; the reason is duplicated in `aria-describedby` (tooltips are not read
   reliably). A-24, A-15.
9. **Implementation.** `ui/Tooltip.tsx` gains `reason`, the touch path through `useLongPress`,
   and keycap visibility from an input-modality store. Tests: browser mode (Esc passes, warm
   delay, reason described, touch long press shows and cancels the click); e2e on coarse.

## 21. Removed and re-homed

| Today | Fate |
|---|---|
| 8.3 "Mark up…" and the Read/Edit rows | Gone: every markup acts from viewing |
| 8.5 Document menu · 8.6 Zoom menu | Title menu · page pill (frame family) |
| 8.10 "Switch to Edit to change pages" | Gone: page items act; Lock dims them |
| 8.13 "Hide from / Show in Arrange" | Gone with Arrange; grid scope is a segmented control (grid family) |
| 8.19 paragraph editor info | Kept on `ui/Popover`, content with text-edit family |
| 8.20 field properties (opaque) | Field bar ⋯ → M4 popover (§7) |
| 9.14 form notice | Lock notice (§19) |
| 6.3 Properties · 6.6 History | Bar ⋯ (§5) · History scrubber (§18) |
| 5.8 Mark all matches (in Find) | Find's results ⋯ "Mark all for redaction" (sidebar family); counts in §9 |
| `FloatingToolbar.roving` in bars | Base UI Toolbar |

## 22. Issues for the lead

1. **Phone selection bar at 56 px.** L§2.9 registers contextual bars at 36 and 44 px. Six labelled
   actions do not fit 358 px in one 44 px row (≈ 434 px EN). Decided: compact uses 56 px with
   captions under icons (σ 10, c 0.995 at 344 × 56); the coverage registry needs the entry.
2. **Short menus need σ 12.** L§2.2 gives M4 "under 120 px tall 16"; a two-row menu (200 × 64)
   at σ 16 has c 0.954, below A-2's 0.985. Decided: σ 12 under 92 px tall (c 0.992), 16 from 92
   to 120. L§2.9 should add the step.
3. **Right-click on an image.** F§4.4 opens the image bar on right-click, but a scanned page is one
   image, so the page menu would never open there. Decided: right-click on an image opens the page
   menu with an image group (Select image, Replace…, Save image, Delete image); the bar shows when
   the image is selected.
4. **Locked annotation without a comment.** F§3.1 says a click opens its comment read-only; ink
   and shapes usually have none. Decided: show the Lock notice at the annotation.
5. **Delete keycap in the page menu.** F§4.5 shows "Delete" beside Delete page, but Delete acts
   only on a visible selection (F§3.1, S10), so the keycap would be wrong after a right-click.
   Decided: no keycap there; the grid cell menu keeps it.
6. **"Extract" vs Save image.** F§4.4's image bar says Extract, which collides with Extract page
   (to a new document). Decided: "Save image" (INV-15).
7. **Tint and colour pickers are M2 tiers, not M4 popovers.** A 52 px popover at M4's σ 16 has c
   0.894. A tier row at σ 7–8 passes and matches the palette's options tier.
8. **Ownership to confirm.** Dock shape and morph (frame) vs the Pages and Compare bar content
   (here); the History scrubber here vs toasts in feedback; the Library selection bar (Library
   family) should use `ui/ContextBar`; the free rectangle must be exposed by the frame family as
   a rect for `place.ts` (today `stage-bleed.ts`).
9. **Long press is 450 ms, Base UI's ContextMenu uses 500 ms.** Pages use the in-house recogniser;
   Library cards and tabs should use it too so one threshold holds (M-20).
10. **Selection bar below the text on touch.** F§6.3 says bars "flip below the selection near the
    top bar"; on touch this spec puts them below by default because the system edit menu cannot
    be suppressed over a text selection (established knowledge, to verify in spike S-T3).

11. **Long press while a tool draws.** F§3.1 gives the page menu for a long press in Markup with
    a tool armed, but a finger that draws (Draw with finger on) or a pen starts a stroke when it
    holds still. Decided: a drawing pointer never long-presses; right-click, Shift+F10 and a
    finger after a pen has been seen still open the page menu.
12. **Pages bar in viewing.** F§4.4 shows the Pages bar for an explicit sidebar selection but not
    where it lives outside the grid. Decided: the dock morphs into it with ✕ in place of Done;
    in Markup it is a tier above the palette.

## 23. Open questions

1. Should Highlight on desktop keep the text selected (Preview) instead of selecting the new
   highlight? This spec selects the highlight so Comment reuses it (RA-6).
2. Tablet tooltips by long press: does the cancelled activation surprise people? Check in the
   five-person test with the S7 and S9 rows.
3. Should the page menu fold "Add … here" into one "Add here ▸" submenu on coarse pointers, where
   the flat menu is about 700 px tall? Kept flat for RA-21 until measured on a 820 px tablet.
