---
title: "M9 component spec, family 06: sidebar, Pages grid and Compare"
date: 2026-10-04
status: proposed
---

> Wave 2 component spec. Binding inputs: [`flows.md`](../flows.md) (cited as F§) and
> [`language.md`](../language.md) (cited as L§), with the ten amendments of F§13.2 applied.
> Evidence: [`inventory.md`](../inventory.md) §5 (5.1–5.14), §10 (10.1–10.6), §11 (11.1–11.9),
> §16 (INV-3, INV-9, INV-10, INV-11, INV-19, INV-21); [`current-flows.md`](../current-flows.md)
> J4, J12, J15; baseline frames `12-arrange-*`, `13-compare-*`, `14-find-*`, `15-review-1440`,
> `35-compare-setup-1440`; research 15 (RA-7, RA-21), 18 (MC-9, MC-10, MC-27–MC-29), 19 (M-9,
> M-10, M-15, M-20, M-21, M-31, M-38), 22 (A-11–A-15, A-20). Sibling specs: `01-frame.md` (F1–F13),
> `02-library.md` (L1–L12), `04-context.md` (§n), `05-canvas.md` (§n). Code read on `develop`:
> `shell/LeftRail.tsx`, `shell/PagesPanel.tsx`, `shell/panels/*`, `shell/OutlinePanel.tsx`,
> `shell/SearchPanel.tsx`, `shell/review/ReviewPanel.tsx`, `shell/files/*`, `stage/ArrangeView.tsx`,
> `stage/ArrangeSection.tsx`, `stage/PageCell.tsx`, `stage/arrange-data.ts`, `dnd/*`,
> `compare/*`, `state/ui-store.ts`, `messages/en.json`, `tr.json`. Ratios are quoted from L§1.7,
> L§2.2 and L§2.6, or computed with L§1.2's method where marked "c.". **(judgement)** marks
> unmeasured choices.

# M9 component spec, family 06: sidebar, Pages grid and Compare

## 0. Summary

- **Nineteen components in three groups.** The sidebar (N1–N6): shell, thumbnails, Contents,
  Find, Review, and the phone Pages sheet. The Pages grid (PG1–PG6): surface and transition,
  header, sections, cells, drag and drop, Combine result. Compare (CP1–CP7): place, top bar,
  chooser, panes and marks, Changes list, the compact switch, report.
- **One sidebar, closed by default.** Pages (thumbnails or Contents) · Find · Review. Docked
  280 px from expanded up, a 320 px overlay on medium, a 360 px side sheet on compact-height,
  and on phones it lives inside the Pages sheet. The rail, the Files tab and the Changes tab go.
- **A navigating click never selects** (S10). A click, tap or arrow key on a thumbnail moves
  the page view. Selection is explicit: Shift- or Mod-click, Space, or "Select" in the touch
  menu. A drag moves the page under the pointer without selecting it (RA-7).
- **The Pages grid is ArrangeView kept**, reached by a 240 ms zoom View Transition. It has a
  scope switch (This document · All open), a five-step size slider, a click that selects, a
  drag that moves, a drop on a tab after 500 ms, touch drag after a 450 ms lift, and the
  Pages bar (`04-context` §10) as the dock's morph.
- **Compare is a full-screen place** with its own top bar (Close, A ⇄ B, Side by side ·
  Overlay, Report…), the Compare bar at the bottom (`04-context` §11), a Changes list docked
  from large, and A · B · Changes on phones (M-38). It changes nothing, so it works locked.
- **No light anywhere in this family** (L§3.2: never in the grid or Compare). Glass: M3 for the
  sidebar, grid header and Compare top bar; the dock's M2 element for the bottom bars;
  thumbnails, cells and pages stay solid content.

## 1. Family overview

### 1.1 How the parts work together

| Part | Lives in | Reads and writes | Talks to |
|---|---|---|---|
| N1 Sidebar shell | Leading edge of the stage | `ui-store` `sidebar*` (per device) | ▤ and Mod+B (F3), F1 free rectangle, F6 order |
| N2 Thumbnails | N1 Pages section | `view-store` current page; `selection-store` (explicit only) | Page view scroll-to, Pages bar (✕ form), tabs as drop targets (F4) |
| N3 Contents | N1 Pages section | outline model | Page pill "All contents…" (F11) |
| N4 Find | N1 Find section; compact find bar | `viewer/search.ts` | Strip Find entry (F6), search highlights (`05-canvas` §22) |
| N5 Review | N1 Review section | annotation, redaction, form stores | Annotation bar (`04` §5), pending-marks bar (`04` §9) |
| N6 Phone Pages sheet | Compact only, bottom sheet | as N2–N5 and PG | Dock Pages (F10), Pages bar |
| PG1 Pages grid surface | Stage, `docUi[id].surface === 'grid'` | `gridScope`, `gridSize`, selection | Zoom controller (`05` §4), dock morph (F10) |
| PG2–PG6 | Inside PG1 | `workspace-store` page operations through `commit()` | Pages bar, cell and section menus (`04` §14), toasts |
| CP1–CP7 | `destination === 'compare'` | `compare-store` | Compare bar (`04` §11), Library selection (L6), More (F10) |

The sidebar and the grid share one page-selection model. Thumbnails, grid cells and the Pages bar
read `selection-store`; nothing that navigates writes to it. Selection clears when the surface
changes (page ⇄ grid), except when the Library opens the grid. Every page change runs one
registered command with `act: 'pages'` (F§2.5), passes `commit()` and is one undo step.

### 1.2 Composition, desktop (large, 1440 × 900, fine pointer)

```
Viewing, sidebar docked on Pages                     Pages grid, scope All open (3)
┌───────────────────────────────────────────────┐   ┌───────────────────────────────────────────────┐
│ ◆ ▤ [report.pdf ▾ ●] agreement + ⌕ Find ↶ ↷ Save ◎│   │ ◆ ▤ [report.pdf ▾ ●] agreement + ⌕ Find ↶ ↷ Save ◎│ F2 44
│[Pages│Find│Review 3]│                            │   │ [This document | All open 3]   ▪▫ ──○──── ▣    │ PG2 44
│(Thumbnails)(Contents)⊞│ ┌──────────────────┐     │   │ ▾ agreement.pdf · 4 pages              ⋯       │ PG2 row 2
│  ┌──────┐           │  │ page at fit width │     │   │ ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐│
│  │  1   │           │  │ in 1160 px        │     │   │ │ 1  ││ 2  ││ 3 ✓││ 4  ││ 5  ││ 6  ││ 7  ││ 8  ││ PG4
│  └──────┘ 1         │  └──────────────────┘     │   │ └────┘└────┘└────┘└────┘└────┘└────┘└────┘└────┘│
│  ┏━━━━━━┓           │                            │   │ ▾ letter-scan · 2 pages · No text      ⋯       │ PG3
│  ┃  2   ┃ lime ring │                            │   │ ┌────┐┌────┐  ┊ 2 px drop gap                  │
│  ┗━━━━━━┛ 2 current │                            │   │ │ 1  ││ 2  │                                  │
│  N1 280, M3         │ ╭───────────────────╮ ╭────╮│   │ ╭───────────────────────────────────────────╮ │
│                     │ │▦ ✎ ✑ ⋯ (labels)   │ │3/12││   │ │✓ Done│1 selected│↺ ↻│‹ ›│Delete│Extract│⋯│ │ Pages bar
└───────────────────────────────────────────────┘   └───────────────────────────────────────────────┘

Compare (place), Changes docked
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ✕ Close │ A v1.pdf ⇄ B v2.pdf │            [ Side by side | Overlay ]       │ Report… │ ⋯ │ CP2 44
│ A · v1.pdf, page 3                 │ B · v2.pdf, page 3                 │ Changes · 12          │
│ ┌──────────────────────────────┐   │ ┌──────────────────────────────┐   │ Pages: 3 changed …    │
│ │                              │   │ │ ▒▒▒▒ changed words           │   │ ▸ How this works      │ CP5 320
│ └──────────────────────────────┘   │ └──────────────────────────────┘   │ Page 3 ↔ 3            │
│               ╭────────────────────────────────────╮                    │ ~ "four" → "412"      │
│               │ ‹ change 3 of 12 › │ Swap │ ⋯      │ Compare bar (04)   │ + Added "off"         │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Composition, phone (compact, 390 × 844, touch)

```
Pages sheet, 92 % (N6 + PG)        Find above the keyboard (N4)      Compare, B (CP6)
┌──────────────────────────────┐   ┌──────────────────────────────┐  ┌──────────────────────────────┐
│ ‹ 3  report.pdf ▾     ↶ ↷  ⌕ │   │ ‹ 3  report.pdf ▾     ↶ ↷  ⌕ │  │ ✕ Close   v1 ⇄ v2         ⋯  │
│╭──────────── ▬ ─────────────╮│   │ ┌──────────────────────────┐ │  │ [   A   |   B   | Changes ]  │
││ [Pages|Contents|Review]  ✕ ││   │ │ page; current hit ▒▒▒    │ │  │ ┌──────────────────────────┐ │
││ This document ▾   ▪▫ ─○─ ▣ ││   │ └──────────────────────────┘ │  │ │ B · v2.pdf, page 3       │ │
││ ┌──────┐ ┌──────┐ ┌──────┐ ││   │╭────────────────────────────╮│  │ │ ▒▒▒▒ changed line        │ │
││ │  1   │ │  2   │ │ 3 ✓  │ ││   ││[term_______] 3/41 ‹ › ⋯ Done││  │ └──────────────────────────┘ │
││ └──────┘ └──────┘ └──────┘ ││   │╰────────────────────────────╯│  │╭────────────────────────────╮│
││╭──────────────────────────╮││   │ ░░░░ system keyboard ░░░░░░░ │  ││ ‹ 3 / 12 › │ Swap │ ⋯      ││
│││✓ │ 1 · ↺ ↻ · ‹ › · Delete⋯│││   │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  │╰────────────────────────────╯│
└──────────────────────────────┘   └──────────────────────────────┘  └──────────────────────────────┘
```

### 1.4 Components, sources and what they replace

| Id | Component | F§ | Jobs | Replaces (inventory) |
|---|---|---|---|---|
| N1 | Sidebar shell and section switch | §2.1, §6.1, §6.9 | J4, J15 | 5.1 rail, 5.3 panel frame, 5.2 rail footer (to More → Keyboard shortcuts) |
| N2 | Thumbnail list | §3.5 S10, S13; §7.1 | J2, J4 | 5.4 Pages · Bookmarks switch, 5.5 thumbnail list (INV-3, INV-9) |
| N3 | Contents tree | §4.7 "Outline" (Contents, spec X27), §9.4 | J15b | 5.6 bookmarks tree |
| N4 | Find section, compact find bar, results sheet | §4.7 "Find", §6.9 | J15a, J5/J9 keyboard | 5.7 Find panel, 5.8 Mark all matches (INV-11) |
| N5 | Review section | §4.7 "Review" | J10 review | 5.9–5.12 Review list, comment, mark and field rows |
| N6 | Phone Pages sheet | §6.3, §6.9 | J4 touch | — (INV-1) |
| PG1 | Pages grid surface, zoom transition, pinch detent | §2.1, §7.1, §13.3 | J3, J4 | 10.1 Arrange view (ADR "Pages as a surface") |
| PG2 | Grid header: scope and size | §6.5–§6.8 | J4 | 10.1 Mod+wheel-only size (INV-21), 8.13 "Hide from Arrange" |
| PG3 | Section and section header | §6.8 | J3, J4 | 10.2 section header |
| PG4 | Page cell | §7.1 | J4 | 10.3 page cell and its 20 px hover actions |
| PG5 | Drag, drop gap, drop on a tab, touch drag, marquee | §7.1, RA-7 | J4 | 10.4 drag preview, 10.5 drop gap, 10.6 marquee (INV-10) |
| PG6 | Combine result | §2.2, §8.1 J3 | J3 | INV-12's "Merge" outcome in the grid |
| CP1 | Compare place | §2.1, §2.3 | J12 | 3.10's Compare segment, 11.3 paired rows' shell |
| CP2 | Compare top bar | §6.4–§6.8 | J12 | 11.5's layout buttons, "New comparison" button |
| CP3 | Chooser | §9.4 | J12 | 11.1 setup card |
| CP4 | Panes, change marks, heat map | §6.9 | J12 | 11.3, 11.4, 11.6, 11.7 |
| CP5 | Changes list | §2.4, §6.9 | J12 | 5.14 Changes panel |
| CP6 | Compact A · B · Changes | §6.3, M-38 | J12 touch | — |
| CP7 | Report menu | §2.1 | J12 | 5.14's two export buttons |

Owned elsewhere and only cited here: the Pages bar and Compare bar content (`04` §10, §11), the
compare progress card 11.2 and stale notice 11.9 (both become Compare bar states, `04` §11), the
grid cell menu 8.11, section menu 8.12, Move to ▾ 8.16 and outline item menu 8.14 (`04` §14), the
pinch detent chip (`05` §4), ▤ (F3), the tab drop ring (F4), the dock shape (F10).

Removed with their function moved: 5.13 Files list (tabs F4 and the Library L5; multi-select on
touch is the Library's Select, L6); 5.2 rail footer (More → Keyboard shortcuts); 10.3 hover
rotate and delete (the Pages bar and the cell menu); 11.8 page map strip (CP5's page headings and
J / K); the Changes tab of the rail (CP5); "Hide from Arrange" (PG2 scope and PG3 collapse).

## 2. Shared rules

### 2.1 Material

| Surface | Tier | σ fine / coarse | c (smallest size) | Beneath | Solid twin |
|---|---|---|---|---|---|
| N1 docked (expanded and up) | M3 docked: hairline on the free edge, rim 0.20 there, no shadow | 40 / solid on coarse (M-31) | 0.9995 (280 × 600) c. | Pages run under it while scrolled or zoomed; at rest the canvas, so it equals n3 (dark) or ≈ n2 (light) | `--surface-frame` |
| N1 overlay (medium) and side sheet (compact-height) | M3 floating, inset 8, radius 20, e4 | 40 / solid on coarse | 0.9999 (320 × 600) c. | The page | n3 / light n2, rim kept |
| N6 sheet | M3 at 40 %; solid at 92 % (L§2.10) | 20 | 1.000 (390 × 338) c. | The page | n3 / n2 |
| N4 compact find bar | M2 capsule 44 | 8 | 0.994 (358 × 44) c. | The page | `--glass-bar-solid` |
| PG2 grid header (1 or 2 rows) | M3 docked band under the strip; the strip drops its hairline, the header carries it | 8 at 44, 10 at 84 | 0.994 · 0.99997 c. | Cells while scrolling | `--surface-frame` |
| CP2 top bar | M3, the strip's slot and σ (8 / 10; compact two rows 88, σ 10) | as F2 | 0.994 · 0.99997 c. | Pages | `--surface-frame` |
| CP5 docked · overlay | M3 docked · M3 floating; solid on coarse | 40 | 0.9998 (320 × 600) c. | Pages | n3 / n2 |
| Thumbnails, cells, panes, drag preview | Content, solid; page hairline, no shadow (L§1.3) | — | — | — | — |
| Wells inside glass (Find field, rename field) | Opaque well n2 / light n1, `--border-strong` (G-18) | — | — | — | same |

Rules: no glass on glass, so segmented controls, chips, the size slider and rows inside M3 use
fills (L§2.1 rule 6). Segmented thumbs (N1 switch, PG2 scope, CP2 view switch) get the
own-content lens where L§2.7 allows (fine pointer, Clear, no reduce preference). Text on M3:
primary 9.97 dark (over white) and 12.20 light (over black); glass-secondary 6.49 / 6.84; current
row (lime 0.12) primary 7.17, glass-secondary 4.67 (L§2.2, §2.6). Tinted: alpha 0.90, blur kept.
`prefers-contrast: more`: 1 px strong border, no rim or shadow. Forced colours: `Canvas`,
`CanvasText`, `backdrop-filter: none`, current and selected in `Highlight` / `HighlightText`,
rings in `CanvasText` (L§9.3). Light: none in the family (L§3.2).

### 2.2 Marks on thumbnails and cells

| Mark | Dark | Light | Ratio | Shape cue (A-19) |
|---|---|---|---|---|
| Current page | 2 px lime ring, offset 3 px | 2 px lime-800 `#446713` | 16.42 on n1 · 5.35 on the light canvas (L§1.4) | Ring plus label weight 550, `aria-current="page"` |
| Selected | 2 px `--select` ring inset 0 + check badge 20 px (24 coarse): `check` fill white on `--select`, top trailing, inset 6 | same | Ring 4.04 c. on n1 · 4.02 on the light canvas; check 4.93 | Badge, not colour |
| Current and selected | Lime ring outside, blue ring inside, badge | same | — | Both shapes |
| Drop gap | 2 px `--select` bar in the reserved gutter, 4 px end caps | same | 4.04 c. / 4.02 | Bar with caps |
| Drag source | Opacity 0.4 | same | — | Dimmed copy stays in place |
| Focus | Two-band ring L§9.2 around the row or cell, outside the marks | same | 16.42 between bands | — |

Labels under thumbnails and cells: `--type-footnote` 12/16 (13/18 coarse), `tnum`, n10 (8.05 on
dark n1, 6.30 on the light canvas n4); current in n12 at 550. Page labels from
`effectiveLabel` ("iii"). A `bookmark-simple` 12 px glyph follows the label of an outline target.

### 2.3 State tokens shared by rows and buttons in this family

| State | Token change |
|---|---|
| Rest | n12 primary, n11 secondary (on glass), n10 secondary (on canvas) |
| Hover (fine) | `--surface-hover` (white 0.045 / ink 0.04), radius 12 for rows, 8 for buttons |
| Pressed | `--surface-active` (0.075 / 0.07); *press* scale 0.97 mouse, 0.94 touch and pen |
| Focus-visible | L§9.2; inside scrollers and capsules the concentric form (`outline-offset: -2px`) |
| Current row | `--accent-muted` (lime 0.12 / ink 0.07) behind the row, glyph `-fill` |
| Disabled | `--glass-text-disabled`, `aria-disabled="true"`, focusable, reason in tooltip and `aria-describedby` |
| Busy | Spinner after 400 ms (*progress*), `aria-busy` |
| Locked | Content and navigation unchanged; change controls dim with "Locked"; a refused drag shows the Lock notice (`04` §19) at the item |

### 2.4 The page-drag model (sidebar and grid)

| Step | Mouse | Pen | Touch |
|---|---|---|---|
| Lift | 4 px of movement after press (today's pragmatic drag and drop) | 4 px, pointer path | 450 ms hold within 10 px (M-20), then movement; pointer path |
| What moves | The page under the pointer; if it is in the explicit selection, the whole selection. Lifting never selects | same | same |
| Guard | `canChange(source, 'pages')` at lift; false → no lift, Lock notice at the item | same | same |
| Feedback | Source 0.4; preview = top thumbnail, up to 2 offset sheets, count badge, scale 0.96 (10.4); gap bar | same | same; Android haptic on lift, snap and drop (L§8) |
| Auto-scroll | 48 px edge zones, speed by depth (`edgeScrollSpeed`) | same | same |
| Over a tab | 500 ms hover rings the tab (F4); drop moves the pages to the end of that document | same | — (no tabs on compact; Move to ▾) |
| Over a collapsed section | Expands after 600 ms (`EXPAND_DELAY_MS`) | same | same |
| Drop | One `movePages` or `transferPages` operation, one undo step | same | same |
| Cancel | Esc, drop outside, `pointercancel` | same | a second finger (pinch wins) |
| Copy | Alt held at drop (today) | — | — (Copy and Paste after in the Pages bar ⋯) |

Touch and pen run on a new pointer path (`dnd/pointer-drag.ts`) that reuses `dnd/geometry.ts`
hit testing and `dnd/drop.ts` transfers; mouse and OS-file drops stay on pragmatic drag and drop
(Issue 11). Announcements: within a document "Moved page 5 before page 2" / "5. sayfa, 2.
sayfanın önüne taşındı" (polite, no toast; F§5.3 keeps toasts for removals); to another document
a toast "Moved 2 pages to agreement.pdf · Undo" / "2 sayfa agreement.pdf belgesine taşındı ·
Geri al".

### 2.5 Motion used by the family

*panel* (N1 open and close, CP5), *sheet* (N6, results sheet), *view change* (PG1, CP1), *bar
morph* (dock → Pages bar, Compare bar: F10 and `04`), *reflow* (moves, deletes, inserts, section
collapse), *lift and settle* (drag), *select* (check badge, segment thumbs), *replace* (counts),
*scroll-to* (every jump), *undo reveal* (a stepped change in Compare, a moved cell), *popup*
(menus), *tier rise* (overlay opacity), *press*, *hover*. Tokens and reduced forms per L§7.3 and
§7.5. No View Transition for anything that repeats (A-10): section switches, scope switches and
size steps use FLIP or cross-fades only.

## 3. N1 Sidebar shell and section switch

**1 · Role.** The one side surface for a document: Pages (thumbnails or Contents), Find, Review.
Closed by default on every size, remembered per device once changed (F§6.1). Jobs J2, J4, J15.
Replaces the rail (5.1), its footer (5.2) and the panel frame (5.3); the Files (5.13) and
Changes (5.14) tabs go.

**2 · Anatomy.**

```
Docked, expanded and up (default 280; splitter 240–400)       Coarse: rows 44, switch 36 high
┌ 12 ┬──────────── 256 ────────────┬ 12 ┐
│    │ [ Pages │ Find │ Review  3 ] │    │ 44  segmented, 28 high (fine), fills n5 thumb
│    │ (Thumbnails) (Contents)   ⊞  │    │ 36  only in Pages; chips 28; ⊞ 32 circle
│    │ section body, scrolls         │    │
│    │ …                             │  ┃ │ splitter: 8 px hit, 1 px hairline, cursor col-resize
└────┴───────────────────────────────┴────┘
Overlay, medium: 320 fixed, inset 8 from the strip and the leading edge, radius 20, above the stage
Side sheet, compact-height: 360 from the leading edge, under the top bar, full height
Compact: no sidebar; N6 holds Pages and Contents and Review, N4 the find bar
```

The section switch is APG tabs drawn as a segmented control; counts are `tnum` badges (Review:
items; Find: matches once there is a query; none on Pages). Widths: EN "Pages · Find · Review 3"
≈ 196 px at 13 px, TR "Sayfalar · Bul · İncele 3" ≈ 206 px (c.), both inside 256.

**3 · Material and light.** §2.1. Docked M3 equals the frame colour at rest and shows glass only
where a zoomed page passes under it. Overlay on touch is solid (M-31). No light.

**4 · States.**

| State | What changes |
|---|---|
| Closed (default) | Not rendered; ▤ `aria-pressed="false"`; free rectangle without the inset |
| Open, docked | Free rectangle left inset + width (F1); the page column re-centres (*panel*) |
| Open, overlay | No inset; no scrim; light dismiss on a press outside |
| Section current | Segment thumb n5 (light n5), label n12 550, glyph none; others n11 |
| Resizing | Splitter hairline `--accent-line`; width writes once per frame; announced at the end "Sidebar 320 pixels" / "Kenar çubuğu 320 piksel" |
| In the Pages grid | Pages section not offered (the grid is it); open on Pages → hidden for the grid and back on leaving; open on Contents, Find or Review → stays and navigates cells (PG1) |
| In Compare, on the Library | Not shown (Compare has CP5; the Library has no document) |
| Locked document | Unchanged; change items inside dim (§2.3) |
| Empty document | Cannot occur (a document keeps one page) |
| Loading | Each section shows its own skeleton (N2, N5) |

**5 · Content and copy.**

| Element | English | Turkish |
|---|---|---|
| Landmark | Sidebar | Kenar çubuğu |
| Sections | Pages · Find · Review | Sayfalar · Bul · İncele |
| Section names with counts | Review, 3 items · Find, 41 matches | İncele, 3 öğe · Bul, 41 eşleşme |
| Pages views | Thumbnails · Contents | Küçük resimler · İçindekiler |
| ⊞ | Show all pages · 3 | Tüm sayfaları göster · 3 |
| Splitter | Resize sidebar | Kenar çubuğunu yeniden boyutlandır |

Icons: `squares-four` (⊞, 20 px). Sections carry words only (I-6: groups carry labels).

**6 · Behaviour.** ▤, Mod+B, Find's "All results", the pill's "All contents…", the pending bar's
"Review marks" and ⌘K open it on the named section. Mod+B moves focus to the section's current
item; ▤ keeps focus on ▤ (F3). Left / Right move between sections (automatic activation; the
body is cheap to swap). Tab moves from the switch into the body. Esc ladder inside: clear the
explicit selection → (overlay) close and return focus to ▤. Splitter: drag, or Left / Right 16
px, Home / End to the limits. Docked width is per device (`sidebarWidth`). Guard: none. F6
stop 2 (after the strip), landing on the current item.

**7 · Motion.** *panel* on `--spring-smooth` with the page column by FLIP; overlay enters by
*panel* from the leading edge; section bodies cross-fade 120 ms; thumb by *select*. RM: instant
open, 100 ms fades.

**8 · Accessibility.** `nav` "Sidebar"; switch `tablist` with `tab`s and `tabpanel`s;
`aria-keyshortcuts="Control+B"` on ▤ (F3). Targets: segments 28 fine (≥ 24), 36 coarse inside a
44 row (hit area full height, A-15); ⊞ 32 / 44. Splitter `role="separator"` with
`aria-valuenow`. A-12 (docked inset), A-13 (overlay inert when closed), A-20 (≤ 25.8 % glass at
1440 with the sidebar open, F1).

**9 · Implementation.** New `shell/sidebar/Sidebar.tsx`, `SidebarSwitch.tsx` (Base UI `Tabs`),
`Sidebar.module.css` (composes `.mat-panel`); `ui/ResizeHandle.tsx` kept. `ui-store`:
`sidebarOpen: boolean | null` (null = never changed = closed), `sidebarSection: 'pages' | 'find'
| 'review'`, `pagesView: 'thumbnails' | 'outline'`, `reviewFilter`, `sidebarWidth` (240–400,
default 280), storage `pdf-editor:ui:v3`; migration keeps view, filter and width from `ui:v2`
but not `leftPanelOpen` (Issue 17). `navigatorTarget` keeps legacy views for commands. Deleted:
`shell/LeftRail.tsx` and its rail CSS, `shell/files/FilesList.tsx`, `FileRow.tsx`,
`LeftPanelView` values `files` and `changes`. Tests: unit migration v2 → v3 and default closed;
browser-mode APG tabs, Mod+B focus target, overlay light dismiss, splitter keys; e2e per class
(docked insets the free rectangle at 1180 and 1440; overlay at 820; side sheet at 844 × 390);
rendered-pixel M3 over a white page and over black (light); axe matrix.

## 4. N2 Thumbnail list

**1 · Role.** See every page, go to one, drag one to move it (RA-7), act on an explicit
selection. J2 (+1 by a thumbnail), J4 (3–4 steps). Replaces 5.4 and 5.5; closes INV-3 (a
navigating click no longer arms Delete and Shift+R on a page) and S10, S13.

**2 · Anatomy.**

```
fine (256 wide body)                    coarse
   ┌──────────────┐                        same box; label 13/18; row ≥ 44
   │              │ box ≤ 128 × 166,       long press shows the thumbnail menu
   │      2     ✓ │ page aspect, centred   or lifts after movement
   │              │ check badge 20 (24)
   └──────────────┘
         2  ⌑      label 12/16 tnum, bookmark glyph if an outline target
   row: padding 8, gap 8, hit area the full row width; hover wash radius 12
   gap bar between rows while dragging: 2 × 120 px, caps 4 px
```

**3 · Material and light.** Thumbnails are content (solid, hairline). Marks per §2.2. Rows sit in
the sidebar's M3. No light.

**4 · States.** Rest; hover wash (fine); pressed; focus-visible ring around the row; current
(lime ring, `aria-current="page"`); selected (badge, blue ring, `aria-selected="true"`); dragging
(source 0.4); drop target (gap bar); loading (skeleton n3 dark / n5 light at the page aspect, then
low resolution, then sharp, fade 120 ms, X-5); locked (unchanged at rest; a drag or a change key
shows the Lock notice "Locked · Unlock" at the row); error (a page that fails to render shows
`warning` 16 px and "Page could not be drawn" / "Sayfa çizilemedi" in n10, still navigable).

**5 · Content and copy.**

| Element | English | Turkish |
|---|---|---|
| List name | Pages of report.pdf | report.pdf sayfaları |
| Option name | Page 3 of 12 · Page iii (3 of 12) | Sayfa 3/12 · Sayfa iii (3/12) |
| With state | …, current page · …, selected | …, geçerli sayfa · …, seçili |
| Thumbnail menu (coarse adds Select first) | Select · Rotate left · Rotate right · Delete page · Crop page… · Insert blank page after · Insert pages from file… · Extract page… · Copy page · Paste pages after · Recognize text on this page · Show in Pages grid | Seç · Sola döndür · Sağa döndür · Sayfayı sil · Sayfayı kırp… · Arkasına boş sayfa ekle · Dosyadan sayfa ekle… · Yeni belgeye çıkar… · Sayfayı kopyala · Arkasına yapıştır · Bu sayfadaki metni tanı · Sayfa ızgarasında göster |
| On a selection | Delete 3 pages · Rotate 3 pages left… | 3 sayfayı sil · 3 sayfayı sola döndür… |
| Moved | Moved page 5 before page 2 | 5. sayfa, 2. sayfanın önüne taşındı |
| Deleted (toast) | Deleted page 7 · Undo | 7. sayfa silindi · Geri al |

Icons in the menu as `04` §13 (`arrow-counter-clockwise`, `arrow-clockwise`, `trash`, `crop`,
`copy`, `scan`, `squares-four`; `check-square` for Select).

**6 · Behaviour.**

| Input | Effect | Guard | Focus, announcement |
|---|---|---|---|
| Click, tap | Page view scrolls the page into the free rectangle (*scroll-to*); never selects; an overlay sidebar stays open | none | Focus on the row; "Page 7 of 12" (polite) |
| Up / Down, Home / End | Moves focus and the page view with it (150 ms debounce on the scroll) | none | Option name |
| Enter | Goes to the page and moves focus to the page viewport | none | — |
| Shift-click · Shift+Up/Down | Explicit range from the current page (or the anchor); the dock morphs to the Pages bar with ✕ (`04` §10) | none | "3 pages selected" / "3 sayfa seçili" |
| Mod-click · Space | Toggles one page in the selection | none | same |
| Mod+A (focus in the list) | Selects every page | none | same |
| Right-click, Shift+F10, Menu key | Thumbnail menu for that page, or for the selection when it contains the page | each item's act | Focus into the menu; back to the row |
| Long press 450 ms, release without moving (touch, pen) | Thumbnail menu as an action sheet on compact-height, a menu on medium; Select first | same | same |
| Drag | §2.4 | `pages` | Focus stays on the moved row |
| Alt+Up / Alt+Down | Moves the focused page, or the selection, by one | `pages` | "Moved page 5 to position 4" / "5. sayfa 4. sıraya taşındı" |
| Delete, Backspace | Deletes the explicit selection with a toast; with none, nothing (S10) | `pages` | Focus to the next row |
| Shift+R · Shift+Alt+R | Rotates the selection, else the current page (F§7.2) | `pages` | "Rotated page 3 right" / "3. sayfa sağa döndürüldü" + toast with Undo (F§3.5 S18) |
| Esc | Clears the selection; with none, the N1 ladder | none | — |
| Pen | As a mouse (pen in the sidebar never writes) | — | — |

Edge cases: a delete that would remove every page is dimmed ("A document needs one page" /
"Belgede en az bir sayfa kalmalı"); 1 000-page files stay virtualized (TanStack, as today); a
page change in another view updates the current ring without moving focus; the list keeps the
current row in view unless focus is inside it.

**7 · Motion.** *reflow* on moves and deletes (`--spring-smooth`; the dropped row settles on
`--spring-fling`, then a 500 ms *undo reveal* ring in lime); *lift and settle*; badge by *select*;
current ring moves without animation (it follows reading). RM: instant, ring without motion.

**8 · Accessibility.** `listbox` with `aria-multiselectable="true"`, options as above; roving
tabindex. Every drag has keys and buttons (Alt+arrows, Pages bar ‹ ›, Move to ▾; WCAG 2.5.7).
Targets: rows ≥ 44 on coarse, the full row on fine. Contrast per §2.2. A-13 (menu returns focus),
A-15.

**9 · Implementation.** `shell/PagesPanel.tsx` → `shell/sidebar/ThumbnailList.tsx` (click
handler stops calling `clickSelection`; selection only through Shift, Mod, Space, Select);
`shell/panels/PagesTab.tsx` → `PagesSection.tsx` (chips via `ui/Segmented`, ⊞); new
`shell/sidebar/thumbnail-drag.ts` (pragmatic for mouse, `dnd/pointer-drag.ts` for touch and pen);
`selection-store` gains `origin: 'sidebar' | 'grid'`. Registry: `pages.delete` requires a visible
explicit selection in the focused region. Tests: unit "navigation never writes the selection";
browser-mode keys above, S10 (click then Delete changes nothing), Shift+R on the current page;
e2e J4 sidebar path (4 steps; 3 with the sidebar remembered open), drop on a tab after 500 ms,
locked drag shows the notice, touch project: long-press drag reorders and a short touch-drag
scrolls (S13); axe.

## 5. N3 Contents tree

**1 · Role.** The document's outline, labelled Contents (spec X27): jump to a chapter, edit bookmarks. J15b by the sidebar (the
pill is the 2-step path, F11). Replaces 5.6, kept with its editing.

**2 · Anatomy.** The Pages section with Contents chosen: header row "Contents" chips and a
`bookmark-simple` + button (32 / 44) "Add bookmark"; tree rows 28 fine / 44 coarse, indent 16 per
level, caret 16, title 13/18 (one line, ellipsis, full title in the name), page label trailing in
n10 `tnum`. Dead-link rows show `warning` 16 and "Target page was removed".

**3 · Material and light.** Rows in M3; current section row `--accent-muted` (7.17 / 4.67 on dark
M3; light ink 0.07 14.50 / 6.25 on n2). No light.

**4 · States.** Rest; hover; focus; current location (the deepest entry at or before the top of
the free rectangle: `--accent-muted`, `aria-current="location"`); renaming (opaque well);
dragging (row 0.4, insertion line 2 px `--select`); locked (Add, rename, delete, move dim with
"Locked"; jumping works); empty ("No contents" + "Add a bookmark here"; locked: the button dims);
error (link that leaves the app asks first, as today).

**5 · Content and copy.** Existing strings kept (`outline_*`), with the English word changed to Contents (X27): "Contents
of report.pdf" / "report.pdf içindekiler"; "Add bookmark" / "Yer imi ekle"; "No contents" /
"İçindekiler yok";
new "Add a bookmark here" / "Buraya yer imi ekle"; "Target page was removed" / "Hedef sayfa
kaldırıldı". Item menu: `04` §14 (unchanged).

**6 · Behaviour.** Click or Enter jumps (*scroll-to* into the free rectangle), focus stays in the
tree, announce "Terms, page 4" / "Terms, sayfa 4". APG tree keys, F2 rename, Delete, Alt+arrows
move and indent (today). Touch: tap jumps; long press opens the item menu as a sheet; drag after a
450 ms lift. Guard: every edit asks `canChange(id, 'document')`. In the Pages grid a jump focuses
the target page's cell instead.

**7 · Motion.** Expand and collapse by *reflow* on `--spring-quick`; *scroll-to*. RM: instant.

**8 · Accessibility.** `tree` "Contents of report.pdf"; `aria-level`, `aria-expanded`; targets 28
/ 44; A-12.

**9 · Implementation.** `shell/OutlinePanel.tsx` kept, moved under `shell/sidebar/`; edits
registered with `act: 'document'`; drag on touch through `dnd/pointer-drag.ts`. Tests:
browser-mode locked dimming and current-location tracking; e2e outline jump lands inside the free
rectangle.

## 6. N4 Find section, compact find bar and results sheet

**1 · Role.** Options and every result for the query typed in the strip's Find entry (F6): count,
stepping, results by page, the textless prompt, Mark all for redaction. J15a (3 steps), J5 and J9
keyboard (Alt+Enter). Replaces 5.7 and 5.8; ends INV-11.

**2 · Anatomy.**

```
Sidebar Find section (fine)                              Compact find bar (above the keyboard, M-4)
┌──────────────── 256 ─────────────────┐               ╭──────────────────────────────────────────╮
│ [⌕ Find in document          ✕]      │ well 28; only  │ [⌕ term____________] 3 / 41 ‹ › ⋯  Done │ 44, inset 8
│ (Match case) (Whole word)   3 of 41 ‹ ›│ below 1280 px  ╰──────────────────────────────────────────╯
│ Page 4                         2      │ heading n10     ⋯: Match case · Whole word · All results
│   …were 412 crews on a **course**…    │ rows 2 lines    All results → results sheet at 40 % (M3)
│ Page 7                         1      │
│ ⋯ Mark all 41 for redaction           │ results ⋯ menu
└──────────────────────────────────────┘
```

At 1280 px and up the strip shows the field (F6), so the section shows no field of its own: one
input, one query (Issue 20). Compact-height uses the side sheet (N1) on Find.

**3 · Material and light.** Field is an opaque well (n2 / light n1); results rows in M3; the
compact bar M2 (§2.1). Current result row `--accent-muted`. Hit words in results: weight 650 n12,
never a coloured wash (washes are for the page, L§1.5).

**4 · States.** Before a query: one line "Type to search the document's text". Searching: "…"
after 400 ms. Results: count `tnum`. No matches: "No matches in report.pdf", ‹ › disabled.
Textless pages: "No text on these pages · Recognize text…" (opens the OCR sheet; facts chip
order, F§9.3). Failed: "Search failed" with `warning`. Locked: Mark all dims with "Locked".

**5 · Content and copy.**

| Element | English | Turkish |
|---|---|---|
| Field | Find in document | Belgede bul |
| Toggles | Match case · Whole word | Büyük/küçük harf · Tam sözcük (names: Büyük/küçük harf eşleştir) |
| Count · stepping | 3 of 41 · Previous match · Next match | 3 / 41 · Önceki eşleşme · Sonraki eşleşme |
| Heading | Page 4 · Page iii (3) | Sayfa 4 · Sayfa iii (3) |
| Empty, textless | No matches in report.pdf · No text on these pages · Recognize text… | report.pdf içinde eşleşme yok · Bu sayfalarda metin yok · Metni tanı… |
| Results ⋯ | Mark all 41 for redaction | 41 eşleşmenin tümünü karartma için işaretle |
| Compact | All results · Done | Tüm sonuçlar · Bitti |

Icons: `magnifying-glass`, `x`, `caret-up`, `caret-down`, `dots-three`; toggles are text chips.

**6 · Behaviour.** Typing (in the strip or here) searches after 150 ms; Enter / Shift+Enter, F3 /
Shift+F3 step; each hit lands in the free rectangle (`05` §22). A result row click jumps and
makes it current, focus stays in the list; Alt+Enter on a row turns the hit into a selection and
moves focus to the page (F§3.4). Esc clears the query; a second Esc returns focus to the page.
Mark all asks `canChange(id, 'targeted')` and is one undo step with a toast "Marked 41 matches ·
Undo" / "41 eşleşme işaretlendi · Geri al"; the pending-marks bar appears (`04` §9). In the
Pages grid a result row focuses its page's cell. Compact: ⌕ opens the bar with the keyboard; Done
closes it, keeps the highlights until the next tap on the page; the results sheet's rows jump and
the sheet stays at 40 % so the hit shows above it. Count announced 500 ms after typing stops.

**7 · Motion.** Rows stream in without animation; *scroll-to* per hit; compact bar enters with
*tier rise* above the keyboard; results sheet by *sheet*. RM: fades.

**8 · Accessibility.** `search` landmark around a `searchbox` (16 px on coarse); results `listbox`
grouped by page (`group` with heading); count in a polite live region; toggles `aria-pressed`.
Targets 28 / 44. A-12, A-13.

**9 · Implementation.** `shell/SearchPanel.tsx` → `shell/sidebar/FindSection.tsx` (field
rendered only below 1280 px); new `shell/sidebar/CompactFindBar.tsx`, `FindResultsSheet.tsx`
(`ui/Sheet`); `redaction/MarkMatchesButton.tsx` folds into the results ⋯. Tests: browser-mode
one field at 1440 and two places below 1280 sharing one query; Alt+Enter focus move; e2e J15a on
phone (⌕ · type · ↓) and desktop; textless prompt on `letter-scan.pdf`.

## 7. N5 Review section

**1 · Role.** One list of what someone added to the document: comments and other annotations,
redaction marks, form fields, grouped by page; after OCR, the words to check. Replaces 5.9–5.12
and the inspector's OCR section (inventory 6.4; spec X33).

**2 · Anatomy.**

```
[ All 9 │ Comments 4 │ Marks 2 │ Fields 3 │ Words to check 6 ]   chips 28 / 44, radio group, tnum
                                                 counts; the fifth only after OCR has run
Page 2                                           heading n10 550, sticky inside the list
 ◷ Ada Lovelace · 14:02                          comment row: glyph 16, author 550, time n10
   "Check this figure against Q3"                 excerpt 2 lines n11
 ▮ Mark · "ada@example.com"           ⊙  ⌫       mark row: Show, Delete (danger glyph)
 ▢ Name · Ada Lovelace     Required              field row: type glyph, name, value n11
 ⌕ "Reciept" · low confidence                     word row (Words to check): page heading adds
                                                 the quality word Good · Review · Poor · No text
Marks filter header: one honesty line + Find sensitive data…
Comments: "Your name for comments [________] Save" above the first comment, once
```

**3 · Material and light.** Rows in M3; current row `--accent-muted`. Delete glyph in the glass
danger variant (`#ffa4a4` dark, `#a20519` light). No light (redaction, L§3.2).

**4 · States.** Loading "Reading the document…"; empty per filter; a filter with zero items
stays visible with "0" and shows its empty line (static, RA-21; Issue 13); Words to check
appears once OCR has run on the document and stays for the session (spec X33); current row follows
the selected annotation, the focused field and the mark J / K reached; locked: Delete, the author
prompt and Clear all values dim with "Locked", Show and jumping work; error: a row whose target
is gone shows "Target page was removed".

**5 · Content and copy.**

| Element | English | Turkish |
|---|---|---|
| Filters | All · Comments · Marks · Fields · Words to check | Tümü · Yorumlar · İşaretler · Alanlar · Kontrol edilecek sözcükler |
| Word row, page heading | Low confidence · Good · Review · Poor · No text · {n} pages recognized | Düşük güven · İyi · Gözden geçir · Zayıf · Metin yok · {n} sayfa tanındı |
| Empty | No comments, marks or fields · No comments yet · No redaction marks · No form fields | Yorum, işaret ya da alan yok · Henüz yorum yok · Karartma işareti yok · Form alanı yok |
| Marks header | A mark hides nothing until it is applied. Apply removes what lies under it from the saved file. · Find sensitive data… | İşaret, uygulanana kadar hiçbir şeyi gizlemez. Uygulandığında altındakiler kaydedilen dosyadan kaldırılır. · Hassas verileri bul… |
| Mark row | Mark · Area · Show · Delete mark | İşaret · Alan · Göster · İşareti sil |
| Field row, ⋯ | Required · Clear all values | Zorunlu · Tüm değerleri temizle |
| Author prompt | Your name for comments · Save | Yorumlarda görünecek adınız · Kaydet |

Icons: `chat-centered-text`, custom *redact*, `textbox`, `check-square`, `eye`, `trash`.

**6 · Behaviour.** Comment row: click or Enter scrolls to it and selects the annotation (a
targeted selection, F§3.1), so its bar shows; focus stays in the list; locked: opens the comment
read-only. Mark row: Show reveals with an *undo reveal* ring; Delete (`targeted`) is one undo
step with a toast; J / K step marks. Field row: focuses the field on the page (typing fills). Word row: scrolls to the word and
shows the OCR word ring of `05-canvas` §27; J / K step the words (no change, works locked).
Clear all values asks `canChange(id, 'document')` and confirms (dialogs family). Apply is not
here: the pending-marks bar applies every mark (Issue 12). Filter change announces "Showing 2
marks" / "2 işaret gösteriliyor".

**7 · Motion.** Filter change cross-fades the list 120 ms; removed rows by *reflow*. RM: instant.

**8 · Accessibility.** Chips `radiogroup` "Show"; list virtualized with page `group`s; rows
`button`-like `option`s; targets 28 / 44; danger never by colour alone (glyph and word).

**9 · Implementation.** `shell/review/ReviewPanel.tsx` → `shell/sidebar/ReviewSection.tsx`;
`CommentsPanel.tsx`, `FormsPanel.tsx` rows kept; `RedactionsPanel.tsx` loses Apply and the
ticks; `FormTools` loses Highlight fields (→ Show field outlines in the pill and palette),
Flatten on export (→ Save a copy), Edit fields and Add field (→ palette). Tests: unit counts per
filter; browser-mode static chips, locked dimming; e2e J10 "Review marks" from the pending bar
with J / K.

## 8. N6 Phone Pages sheet (compact)

**1 · Role.** The phone's sidebar and grid in one sheet: Pages (the grid), Contents, Review
(F§6.3). Opened by the dock's Pages; J4 touch (5 steps). New (INV-1).

**2 · Anatomy.**

```
╭──────────────── grabber 36 × 5 ────────────────╮  detents 40 % and 92 %; opens at 92 %
│ [ Pages │ Contents │ Review ]               ✕  │  44 row; ✕ 44 circle
│ This document ▾          ▪▫ ──○── ▣            │  44 row, Pages only: scope menu, size S·M·L
│ ┌──────┐ ┌──────┐ ┌──────┐                     │  grid: pad 16, gap 12; S = 3 columns at 390
│ │  1   │ │  2   │ │ 3 ✓  │                     │
│ └──────┘ └──────┘ └──────┘                     │
│ ╭────────────────────────────────────────────╮ │  Pages bar, Solid form (no glass on glass)
│ │ ✓ │ 1 · ↺ ↻ · ‹ › · Delete │ ⋯             │ │  64, safe area below
╰────────────────────────────────────────────────╯
```

**3 · Material and light.** M3 at 40 %, solid at 92 % once settled (L§2.10). The Pages bar inside
uses its solid twin (`--glass-bar-solid`, rim kept): one filtered element per stack (L§2.9). The
dock is covered while the sheet is open, so persistent glass stays at two (top bar, sheet).

**4 · States.** 40 % or 92 %; selection present (Pages bar shows count); locked (Pages bar locked
form, `04` §10; no lift); Contents and Review as N3 and N5 at 44 px rows.

**5 · Content and copy.** "Pages" / "Sayfalar" (sheet name); sections as N1 with Contents /
İçindekiler; ✕ "Close" / "Kapat"; scope "This document" / "Bu belge", "All open (3)" / "Açık
belgeler (3)".

**6 · Behaviour.** One meaning at both detents (Issue 6): in Pages a tap selects (check), a long
press lifts, a double tap opens the page and closes the sheet. Contents and Review rows jump and
lower the sheet to 40 % so the target shows above it. Swipe down past 40 % or ✕ closes; Android
back closes; Esc closes. Focus: on open the current page's cell; on close the dock's Pages. Guard
as PG4 and PG5.

**7 · Motion.** *sheet* (glide, fling on release, 1:1 drag, rubber band above 92 %); the solid
layer fades in over `--duration-base` at 92 %. RM: fade 150 ms, drag 1:1.

**8 · Accessibility.** `dialog` (non-modal at 40 %, modal at 92 %) named "Pages"; ✕ is the
non-gesture close (WCAG 2.5.1); targets 44; A-13 (dock inert while covered).

**9 · Implementation.** New `shell/sidebar/PhonePagesSheet.tsx` on `ui/Sheet`; renders
`PagesGrid` (PG1) with `variant="sheet"`, `OutlineSection`, `ReviewSection`. Tests: e2e phone
project J4 (Pages · long-press drag 5 before 2 · tap 7 · Delete · swipe down = 5), detent
behaviour, back button closes.

## 9. PG1 Pages grid surface

**1 · Role.** The document's pages, or every open document as sections, at thumbnail size:
select, move, rotate, delete, extract, combine by dragging between documents (F§2.1). Reached by
dock Pages, `3`, ⊞, a pinch or Mod+wheel below fit, the Library's Pages, a Combine result. Left by
Done, Esc, `3`, a double-click or Enter on a cell, a pinch out on a cell. J3 (result), J4 (5
steps). Replaces 10.1 Arrange view; ArrangeView is kept and routed by `surface`.

**2 · Anatomy.**

| Class | Where | Header (PG2) | Cell pad / gap | Default size | Bottom |
|---|---|---|---|---|---|
| compact | N6 sheet | In the sheet | 16 / 12 | S (96) | Pages bar, solid, in the sheet |
| compact-height | Full screen under the top bar | One 44 row | 16 / 12 | S | Pages bar 44 (dock element) |
| medium | Stage | 52 coarse / 44 fine | 24 / 16 | M (144) | Pages bar 56 |
| expanded and up | Stage; sidebar hidden if it was on Pages | 44 / 52; second row in All open | 32 / 20 (today) | M | Pages bar 48 / 56 |

Columns = ⌊(width − 2·pad + gap) / (cell + gap)⌋ (`gridMetrics`); at 1440 px with M: 8. Bottom
padding = the free rectangle's bottom inset + 16, so the last row clears the Pages bar.

**3 · Material and light.** The canvas (n1 / light n4) behind solid cells; no glass on the grid
itself; no light (L§3.2). The Pages bar is the dock's M2 element (F10).

**4 · States.**

| State | What shows |
|---|---|
| Entering | *view change*: the current page morphs into its cell; focus on that cell |
| Rest, nothing selected | Pages bar "Done · 12 pages · Select all · ⋯" (`04` §10) |
| Selection | Badges; Pages bar with the count |
| Dragging | §2.4; Pages bar hidden while dragging (*contextual* rule), back 150 ms after the drop |
| Busy (a page operation over 400 ms, e.g. inserting a file) | The affected cells show skeletons; the toast stack shows progress |
| Locked | Dock-element Pages bar locked form; no lift (Lock notice at the cell); keys open the Unlock popover |
| Error | A failed operation leaves the grid unchanged; toast "Could not move the pages: …" with the reason |
| Markup was open | The palette hides; Done returns to Markup (F§4.3) |
| Sidebar on Contents, Find or Review | Stays; a jump focuses the target page's cell (Issue 1) |

**5 · Content and copy.** Region name "Pages grid of report.pdf" / "report.pdf sayfa ızgarası";
All open "Pages grid of 3 documents" / "3 belgenin sayfa ızgarası". Announcement on entry:
"Pages grid. 12 pages. Page 3." / "Sayfa ızgarası. 12 sayfa. Sayfa 3."; on leaving: "Page 7 of
12" / "Sayfa 7/12".

**6 · Behaviour.**

| Input | Effect |
|---|---|
| Dock Pages, `3`, ⊞, Show in Pages grid | Enter at the current page (or the named one) |
| Pinch released > 15 % below fit page (`05` §4) | Enter at the page under the midpoint |
| Mod+wheel at fit page, after a 300 ms pause | Enter (`05` §4) |
| Done, Esc (no selection), `3` | Back to the page that was current on entry (nearest surviving page if deleted) |
| Double-click, double tap, Enter on a cell | Open that page (other section → switch to its tab) |
| Pinch in the grid | Steps the size by detent per ×1.4 of scale; past the largest size by 15 %: chip "Release to open page 7" / "7. sayfayı açmak için bırakın" (`05` §4's chip); release opens the cell under the midpoint |
| Mod+wheel in the grid | Steps the size (60 px of delta per step, today); stops at the ends |
| `1` · `0` · `M` | Viewing · Library · Markup (leave the grid first) |

Guard: entering and looking need none (allowed locked, F§2.6). Grid keys as today: arrows across
rows and sections, Shift extends, Space toggles, Home / End, Alt+arrows move, Alt+Shift+arrows to
the row or section edge, Mod+X / C / V, Shift+R, Shift+Alt+R, Delete, Mod+D, Mod+Shift+E, Mod+A,
F2 (section rename); R no longer rotates (F§7.3).

**7 · Motion.** *view change* on `--vt-duration` 240 ms: `view-transition-name: page-current` on
the current page and its cell, the root cross-fades, the strip and dock band are named with
position animation off; the dock's *bar morph* to the Pages bar runs alongside. The update
callback sets focus inside it in < 50 ms (L§7.4). Size steps reflow cells by FLIP (`--spring-
smooth`), never a View Transition. Interruption: `skipTransition()` on the next navigation. RM:
150 ms root cross-fade, no names, instant size steps.

**8 · Accessibility.** `region` named above containing a `grid` (today's pattern) with
`aria-multiselectable`; cells `gridcell` with option-style names (PG4). Every gesture has a key or
button: pinch → slider and Mod+wheel; drag → Alt+arrows, ‹ ›, Move to ▾; pinch-out → Enter.
A-10 (one 240 ms transition, none for repeated size steps), A-12 (focused cell scrolled inside
the free rectangle, `scroll-padding`), A-13, A-15.

**9 · Implementation.** `stage/ArrangeView.tsx`, `ArrangeSection.tsx`, `PageCell.tsx` kept
(display name `PagesGrid`; the file rename is optional, Issue 22); routing by `docUi[id].surface
=== 'grid'`; new `stage/grid/grid-transition.ts` (names, helper call), `stage/grid/pinch-in-grid.ts`
(size detents on `viewer/gesture.ts`); `arrange-commands.ts`: `view.grid` on `3`, rotate on
Shift+R, R removed, Enter opens; `ui-store`: `gridScope`, `gridSize` (per device, default M; S on
compact), `arrangeHidden` and `arrangePinned` deleted, `arrangeCollapsed` kept as
`gridCollapsed`. Tests: unit columns per class and size, size clamp; browser-mode enter focus,
Done returns to the entry page, Esc ladder; e2e J4 grid path (5), CDP pinch below fit enters at
the page and pinch out past XXL opens a cell, `motion.spec.ts` no `::view-transition` during size
steps; axe.

## 10. PG2 Grid header: scope and size

> **Amended 2026-10-08 (owner feedback F1).** There is no header band. The document's name and
> page count are the strip's selected tab ("report.pdf · 12 pages"), and a Combine's sources sit
> after the tabs. Scope floats at the bottom-leading corner and Size at the bottom-trailing one,
> each a small M2 glass piece (`mat mat-bar s8 c10`) the capsule's height, on its line, in the
> slot the page pill takes in the reader (`stage/grid/GridPieces.tsx`). A piece keeps 12 px from
> the capsule. Where its full form would come closer, it folds to a circle: Scope to an "All
> open" toggle, Size to a button whose popover holds the slider. Where even a circle would
> touch, both rise 8 px above the capsule. The cells scroll beneath the strip's pieces and the
> Pages bar.

**1 · Role.** Choose what the grid shows and how big the cells are, visibly (INV-21). Replaces
"Hide from Arrange" (8.13) and the hidden Mod+wheel-only size.

**2 · Anatomy.**

```
fine 44 (pad 12)                                                                  coarse 52
│ report.pdf · 12 pages   [ This document │ All open 3 ]              ▪▫ ───○──────── ▣ │
  title 13/18 550           segmented 28 (36 coarse), own-content thumb lens      slider 160 × 28
All open adds row 2 (40): │ ▾ agreement.pdf · 4 pages · ⛉ Locked                    ⋯ │  the section in view
Compact: in the N6 sheet: │ This document ▾ (menu)          ▪▫ ──○── ▣ │ slider 120, S · M · L
```

The size slider has five detents, S 96 · M 144 · L 200 · XL 280 · XXL 400 px (`ARRANGE_SIZES`),
showing only those that leave at least one column; `squares-four` 16 px (small) and 20 px (large)
glyphs at its ends. Row 2 is the sticky header of the section in view, drawn inside the same
filtered element (one per stack, Issue 8).

**3 · Material and light.** M3 band (§2.1), σ 8 at 44, 10 at 84; segmented and slider use fills
(n5 thumb, n6 track, `--accent-line` range fill). No light.

**4 · States.** Scope with one document open: "All open" dimmed with the reason "Only one
document is open" / "Yalnızca bir belge açık". Slider at an end: that end's glyph dims. Locked:
unchanged (scope and size are views). Row 2 locked section: `lock-simple` and "Locked".

**5 · Content and copy.**

| Element | English | Turkish |
|---|---|---|
| Title | report.pdf · 12 pages | report.pdf · 12 sayfa |
| Scope | This document · All open 3 | Bu belge · Açık belgeler 3 |
| Size name, values | Thumbnail size · Small · Medium · Large · Larger · Largest | Küçük resim boyutu · Küçük · Orta · Büyük · Daha büyük · En büyük |
| Combine subline (PG6) | Sources: report.pdf, agreement.pdf | Kaynaklar: report.pdf, agreement.pdf |

**6 · Behaviour.** Scope: Left / Right or click; switching keeps focus on the scope control and
scrolls the active document's section to the top; per device. Size: drag, click a detent, arrows
step, Home / End; announce "Thumbnail size Large" / "Küçük resim boyutu Büyük"; the focused cell
stays in view after reflow. Row 2: caret collapses the section; ⋯ opens the section menu (`04`
§14). Guard: none.

**7 · Motion.** Scope change: sections enter and leave by *reflow* (cells entering the virtual
window do not animate); thumb by *select* with the lens; slider thumb on `--spring-press`. RM:
instant.

**8 · Accessibility.** Scope `radiogroup` "Show pages of" / "Şunun sayfalarını göster"; slider
`role="slider"` with `aria-valuetext`. Targets 28 / 44 (slider thumb 24 fine with a 28 hit, 44
coarse).

**9 · Implementation.** New `stage/grid/GridHeader.tsx` (`ui/Segmented`, Base UI `Slider`),
`GridHeader.module.css` (`.mat-panel.s8`, `.s10`). Coverage registry: "grid header 1440 × 44 σ 8",
"grid header two rows 1440 × 84 σ 10". Tests: browser-mode scope dimming with one document,
slider keys and clamp at 390 px; rendered pixel over cells; axe.

## 11. PG3 Section and section header

**1 · Role.** In All open, one section per open document in tab order, so pages move between
documents by drag (J3 by drag, J4). Replaces 10.2.

**2 · Anatomy.** In-flow header 48 px on the canvas (no material): caret 16 · tag dot 8 · title
13/18 550 (double-click or F2 renames in place, `InlineTitleEditor`) · "4 pages" n10 `tnum` ·
honesty badges (`lock-simple` Locked, `seal-check` Signed, "No text") · ⋯ 32 / 44 at the end.
Collapsed: header only, with a 120 px drop row when dragging. In This document scope: no section
header (PG2's title stands for it). A document with no pages cannot exist; an empty drop row
reads "Drop pages here".

**3 · Material and light.** Canvas; hairline under the header (n7 at 0.5). No light.

**4 · States.** Rest; hover on ⋯ and caret; focus; collapsed; drop target (header ring 2 px
`--select` while a drag hovers to expand after 600 ms); renaming (opaque well); locked (badge;
drops refused with the Lock notice at the header).

**5 · Content and copy.** "agreement.pdf · 4 pages" / "agreement.pdf · 4 sayfa"; "Collapse
agreement.pdf" / "agreement.pdf bölümünü daralt", "Expand…" / "…genişlet"; "Drop pages here" /
"Sayfaları buraya bırakın"; badges "Locked" / "Kilitli", "Signed" / "İmzalı", "No text" /
"Metin yok". Section menu contents: `04` §14.

**6 · Behaviour.** Caret or Left / Right on the header collapses and expands; F2 renames (Enter
commits, Esc cancels): F2 asks `canChange(id, 'document')` (rename is a `document` act, spec X12,
as the title menu's name field in `01-frame` F5); on a locked document it opens the Unlock popover
at the header; ⋯ or Shift+F10 opens the section menu. From the Library's Pages with a
subset checked: scope All open, unchecked documents' sections collapsed (Issue 9).

**7 · Motion.** Collapse by *reflow* (sections slide together, MC-28). RM: instant.

**8 · Accessibility.** Header is a `rowheader`-like `button` with `aria-expanded`; the section a
`rowgroup` named by the title; targets 32 / 44.

**9 · Implementation.** `stage/ArrangeSection.tsx` kept; `hideable` and "Hide from Arrange"
removed; `SectionMenuEntries.tsx` per `04` §14. Tests: browser-mode collapse, F2, Library subset
collapse; e2e drag between sections.

## 12. PG4 Page cell

**1 · Role.** One page in the grid: shows it, takes selection, opens, drags. Replaces 10.3 and its
20 px hover actions.

**2 · Anatomy.** Thumbnail box `cell × 1.3` (page aspect inside, centred), label row 28 below
(§2.2), check badge top trailing. Whole cell is the hit area (≥ 96 × 153 at S). Rotation shows by
the thumbnail turning, then the new bitmap.

**3 · Material and light.** Content; marks per §2.2. No light.

**4 · States.** Rest; hover (fine: label row wash only, no actions); pressed; focus ring; current
(lime ring: the page you were on); selected (badge and blue ring); dragging source 0.4; loading
skeleton; rotated (bitmap swap after the turn); locked (unchanged); error (`warning` glyph, "Page
could not be drawn").

**5 · Content and copy.** Name "Page 3 of 12, selected" / "Sayfa 3/12, seçili"; in All open
"agreement.pdf, page 3 of 4" / "agreement.pdf, sayfa 3/4". Cell menu: `04` §14 (grid cell menu).

**6 · Behaviour.**

| Input | Effect | Guard |
|---|---|---|
| Click | Selects this cell only (replaces) | none |
| Shift-click · Mod-click | Range within the section · toggle | none |
| Tap (touch) | Toggles the cell (multi-select by taps, INV-R8; Issue 5) | none |
| Pen tap | As a click | none |
| Double-click, double tap, Enter | Opens the page (PG1) | none |
| Press on empty canvas and drag (mouse, pen) | Marquee (PG5) | none |
| Right-click, long press without moving, Shift+F10 | Cell menu for the cell, or the selection that contains it | items per act |
| Drag | §2.4 | `pages` |

Focus stays on the acted cell; after a delete it moves to the next cell (or the previous at the
end); announce the selection count politely.

**7 · Motion.** Badge by *select*; deletes `scale(0.9)` + fade 120 ms and neighbours by *reflow*
(MC-28); rotation turns 90° on `--spring-smooth`, then swaps the bitmap; thumbnails fade in 120
ms. RM: instant, fades kept.

**8 · Accessibility.** `gridcell` with `aria-selected`; current `aria-current="page"`; contrast
§2.2; targets ≥ 96 px; no information by hover alone.

**9 · Implementation.** `stage/PageCell.tsx` kept; hover actions deleted; badge added; touch tap
semantics in `selection-store.tapSelection`. Tests: unit tap vs click selection; browser-mode
focus after delete; rendered pixel for the badge and both rings in both themes.

## 13. PG5 Drag, drop gap, drop on a tab, touch drag, marquee

**1 · Role.** Move pages by hand in the grid and the sidebar, including between documents and
onto tabs (RA-7); select many with a rectangle. Replaces 10.4–10.6; closes INV-10 for touch.

**2 · Anatomy.** Drag preview: top thumbnail at 0.96 scale, up to two sheets offset 4 px, count
badge 20 px (n12 on n4, `tnum`) when more than one. Gap: 2 px bar in the reserved gutter (GRID
`gapX` 20), full box height, 4 px caps, `--select`. Marquee: 1 px `--select` border with
`--select-wash` at 0.25 multiply over the canvas *(judgement: the wash reads as selection, not as
a page mark)*; edge auto-scroll. Tab drop ring: F4.

**3 · Material and light.** Content colours only (`--select`), no glass, no light.

**4 · States.** Lifted; over a gap; over a collapsed section (expands at 600 ms); over a tab
(ring at 500 ms); over an invalid target (no gap; the preview stays); refused (locked target:
gap absent, the Lock notice at the section or tab after drop); dropped (settle).

**5 · Content and copy.** Preview name "Moving 3 pages" / "3 sayfa taşınıyor"; drop announcements
§2.4; OS files: "Drop to insert 2 files here" / "2 dosyayı buraya eklemek için bırakın", on the
background "Drop to open as new documents" / "Yeni belge olarak açmak için bırakın" (existing).

**6 · Behaviour.** Per §2.4. Marquee: press on empty canvas with mouse or pen, 4 px threshold,
additive with Shift or Mod; touch never marquees (taps toggle). OS files dropped on a gap insert
there (`insertFilesAt`), on the background open as documents. Esc cancels any drag; focus returns
to the source cell.

**7 · Motion.** *lift and settle* (source to 0.4 in 100 ms; valid drop FLIP on `--spring-fling`
with velocity; invalid returns in 150 ms; MC-29); gap bar moves without animation (it follows the
pointer); sections expand by *reflow*. RM: instant.

**8 · Accessibility.** Keyboard equivalents (Alt+arrows, Mod+X / Mod+V, Move to ▾); the preview
is `aria-hidden`; outcomes announced.

**9 · Implementation.** `dnd/page-drag.ts`, `dnd/drop.ts`, `dnd/geometry.ts`, `dnd/drag-store.ts`
kept; new `dnd/pointer-drag.ts` (long press from `viewer/gestures/long-press.ts`, `04` §2.3;
pointer capture; hit tests through `gapAt`); tab drop targets registered by F4's tabs. Tests:
unit gap geometry (kept) plus pointer-drag state machine; e2e mouse drop on a tab after 500 ms,
touch long-press drag across sections on the `phone` and `tablet` projects, locked target
refused.

## 14. PG6 Combine result

**1 · Role.** Show what Combine made, at once, where it can be checked and rearranged (F§2.2, J3
= 3 steps). The new document opens in its Pages grid. Ends INV-12's second outcome.

**2 · Anatomy.** PG1 in This document scope on the new tab; PG2's title row adds the subline
"Sources: report.pdf, agreement.pdf" (n10, one line, ellipsis) for the session; the toast
"Combined 2 files · Undo" (L6, `02-library`).

**3 · Material and light.** As PG1; the Library's success pulse stays on the Library (L3); none
in the grid.

**4 · States.** Large combine (> 200 pages): the Library's progress capsule, then the grid; Undo
from the toast closes the new document and returns to the Library with the cards still checked.

**5 · Content and copy.** Subline above; announcement "Combined 2 files into Combined – report +
agreement. Undo with Ctrl+Z" (L6).

**6 · Behaviour.** Focus on the first cell; nothing selected; Done goes to viewing page 1. Guard:
none (a new document, L6 Issue 8).

**7 · Motion.** Library → grid by *view change* (the first card morphs into the first cell); RM
cross-fade.

**8 · Accessibility.** As PG1; the toast's Undo in the F6 cycle (A-24).

**9 · Implementation.** `library-actions.ts` `combineNow` calls `ui.openGrid(newId)` (L6);
`docUi[newId].combinedFrom` (session only) feeds the subline. Tests: e2e J3 (3 steps) lands in
the grid with focus on cell 1 and the toast.

## 15. CP1 Compare place

**1 · Role.** Two documents side by side or overlaid, their changes listed, in a place of its
own (F§2.1, §2.3: not a tab). J12 (3 steps). Replaces the Compare segment of the mode switch
(3.10) and the view's shell.

**2 · Anatomy.**

| Class | Top | Panes | Changes | Bottom |
|---|---|---|---|---|
| compact | CP2 two rows (88 + safe area) with CP6 | One side at a time | CP6's third segment | Compare bar 64 |
| compact-height | CP2 44 | Side by side | Side sheet 360 from the trailing edge | Compare bar 44 |
| medium, expanded | CP2 52 / 44 | Side by side | Overlay 320 from the trailing edge, from the bar's Changes | Compare bar 56 / 48 |
| large, xlarge | CP2 44 | Side by side | Docked 320, open by default | Compare bar 48 |

**3 · Material and light.** Canvas behind the panes; M3 top bar and Changes; the Compare bar is
the dock's element. No light (L§3.2).

**4 · States.** Running (panes show skeleton pages at their aspect; rows fill as pairs land; the
Compare bar's running form, `04` §11); done; stale (bar tier, `04` §11); failed (toast "The
comparison failed: {reason}" with Try again; the bar shows Run again; Issue 15); a compared
document closed (Compare ends: toast "The document was closed." and back to the origin, or the
Library); locked documents (no effect: nothing changes here).

**5 · Content and copy.** Region "Comparing v1.pdf (A) with v2.pdf (B)" / "v1.pdf (A) ile v2.pdf
(B) karşılaştırılıyor"; done "Comparison done: 3 pages changed" / "Karşılaştırma bitti: 3 sayfada
değişiklik var" (existing plural strings); More item "Return to comparison" / "Karşılaştırmaya
dön".

**6 · Behaviour.**

| Entry | What happens |
|---|---|
| Library, exactly two checked → Compare | Runs at once; the older file (modified time, else card order) is A (L6) |
| `4` with exactly two documents open | Runs at once on them, active as B *(judgement: the active one is usually the newer)* |
| `4` otherwise · title or More → Compare with… | CP3 chooser with the active document as A |
| More → Return to comparison | Back to the kept result |

Close (✕), Esc, `1` → back to the origin (`compareOrigin`: the document and surface, or the
Library); `0` → Library; `3` → the origin's grid. Leaving keeps the comparison for the session;
it ends on New comparison…, when a compared document closes, or on reload. J / K step changes;
Mod+= / Mod+- / Mod+0 zoom both panes; a pinch zooms both. Guard: none anywhere (read-only).
Focus on entry: the Compare bar's next-change button; on leaving: the control that opened it, or
the origin page.

**7 · Motion.** *view change* (MC-10): the current page morphs into the A pane (into B when it is
B), the other pane slides 24 px and fades in, within 240 ms; the dock *bar morph*s to the Compare
bar; Changes docked by *panel*. RM: 150 ms cross-fade.

**8 · Accessibility.** `main` named above; F6 order: top bar → Changes → panes → Compare bar →
toasts; panes are `region`s "A · v1.pdf" / "B · v2.pdf"; one scroller, so keyboard scrolling
moves both. A-10, A-12 (a stepped change lands inside the free rectangle).

**9 · Implementation.** `ui-store`: `Destination` gains `'compare'`, `compareOrigin`; `viewMode
'compare'` goes (F§2.4). `compare/CompareView.tsx` → `compare/ComparePlace.tsx` (panes and
routing), setup and bar extracted; `compare-commands.ts` stops opening the navigator, adds
`compare.return` and the `4` rule. Tests: unit entry rules (two checked, `4` with two open, else
chooser); browser-mode Esc returns to the origin and keeps the result; e2e J12 from the Library
(3) and from a document (More · Compare with… · pick = 3), stale after an edit, closing a
compared tab ends Compare.

## 16. CP2 Compare top bar

**1 · Role.** Name the two files, leave, switch the view, export. Sits in the strip's slot (F2).
Replaces 11.5's layout buttons and the "New comparison" button.

**2 · Anatomy.**

```
fine 44 (gutter 12; coarse 52, buttons 44)
│ ✕ Close │ A ▪ v1.pdf ⇄ B ▪ v2.pdf │          [ Side by side │ Overlay ]          │ Report… │ ⋯ │
  capsule 32   names 13/18, middle ellipsis ≤ 220 each   segmented 28, centred      capsule  circle
compact (two rows): │ ✕ Close   v1 ⇄ v2                ⋯ │ then CP6's switch 36 / 44
```

A and B are 16 px letter badges (n12 on n5, `--type-caption` 550); ⇄ is a static glyph
(`arrows-left-right`, 16), not a control (Swap is in the Compare bar).

**3 · Material and light.** M3, σ 8 / 10 (compact 88 high: σ 10, c 0.99997 c.); hairline bottom.
Segmented fills with the own-content lens (L§2.7). No light.

**4 · States.** Running: the view switch works (panes re-layout); Report… disabled "Available when
the comparison is done". Stale: Report… items dim with "The documents changed. Run the comparison
again first." Overlay chosen: the overlay opacity tier rises above the Compare bar (Issue 14).

**5 · Content and copy.**

| Element | English | Turkish |
|---|---|---|
| Close | Close · Esc | Kapat · Esc |
| Names | A v1.pdf ⇄ B v2.pdf | same |
| View | Side by side · Overlay | Yan yana · Üst üste |
| Overlay tier | B opacity 50 % | B opaklığı %50 |
| Report | Report… | Rapor… |
| ⋯ | Comparison options… · New comparison… · Hide changes list · Show changes list | Karşılaştırma seçenekleri… · Yeni karşılaştırma… · Değişiklik listesini gizle · Değişiklik listesini göster |
| Reasons | Available when the comparison is done · The documents changed. Run the comparison again first. | Karşılaştırma bitince kullanılabilir · Belgeler değişti. Önce karşılaştırmayı yeniden çalıştırın. |

Icons: `x`, `arrows-left-right`, `dots-three`, custom *compare* for the region.

**6 · Behaviour.** Tab order: Close → view switch → Report… → ⋯. Comparison options… opens CP3's
options in a popover (M4) and re-runs on Compare. New comparison… opens CP3 with both pickers.
Show/Hide changes list exists from large (docked); below large the Compare bar's Changes toggles
the overlay. Guard: none.

**7 · Motion.** Named in the *view change* with position animation off; overlay tier by *tier
rise*. RM: fades.

**8 · Accessibility.** `header` "Comparison bar" / "Karşılaştırma çubuğu"; view switch
`radiogroup`; opacity tier `slider` with `aria-valuetext` "50 %" (`formatPercent`, "%50" in
Turkish). Targets 32 / 44.

**9 · Implementation.** New `compare/CompareTopBar.tsx` (`ui/Segmented`, Base UI `Menu`),
`compare/OverlayOpacityTier.tsx`. Coverage: reuses "top strip" entries; "compare top bar compact
390 × 88 σ 10". Tests: browser-mode reasons while running and stale; e2e view switch; axe.

## 17. CP3 Chooser

**1 · Role.** Pick the second document, or both, only when it is not known (F§2.1, §9.4).
Replaces the setup card 11.1.

**2 · Anatomy.** A task sheet (F§6.9: side sheet 400 expanded and up, form sheet ≤ 640 on medium,
92 % sheet on compact):

```
Compare report.pdf with                                    ✕
 ○ ▪ agreement.pdf        4 pages                          rows 44, 32 × 40 thumbnail
 ○ ▪ letter-scan.pdf      2 pages
 [ Open a file… ]   or drop a PDF here (fine pointers)
 ▸ Options   Page matching ( Automatic │ Page by page │ Best match )
             Resolution   ( 100 dpi │ 150 dpi )  150 dpi finds smaller differences and takes longer.
                                                     [ Compare ]   primary
```

With no active document both A and B lists show. With one document open and no other: "Choose a
second file" and Open a file….

**3 · Material and light.** M5 sheet; rows and radios fill inside. Compare is the sheet's primary
(lime with ink in dark; ink with lime in light; the view's one lime). No light.

**4 · States.** Compare disabled until B is chosen ("Choose a second file"); a dropped or opened
file opens as a tab and is pre-selected; open failure inline "{name} could not be opened" with
`warning`; Options collapsed by default with "Automatic · 100 dpi" as its summary.

**5 · Content and copy.** "Compare report.pdf with" / "report.pdf belgesini şununla
karşılaştırın"; "Choose a second file" / "İkinci bir dosya seçin"; "Open a file…" / "Dosya
aç…"; "or drop a PDF here" / "ya da buraya bir PDF bırakın"; "Options" / "Seçenekler"; matching
and resolution labels and hints from today's `compare_align_*` and `compare_dpi_*`; "Compare" /
"Karşılaştır".

**6 · Behaviour.** Enter on a row chooses it; Compare (or Enter on the button) runs and enters
CP1; Esc closes and returns focus to the trigger. Guard: none.

**7 · Motion.** *dialog* (side: 24 px + opacity); Options by *reflow*. RM: fade.

**8 · Accessibility.** `dialog` "Compare documents"; lists `radiogroup`; first focus on the first
row; targets 28 / 44.

**9 · Implementation.** Setup code of `CompareView.tsx` → `compare/CompareChooser.tsx` on
`ui/Sheet`. Tests: browser-mode disabled reason, drop pre-selects; e2e J12 from a document.

## 18. CP4 Panes, change marks and heat map

**1 · Role.** Show both versions page against page, or B over A, with every change marked on B.
Replaces 11.3, 11.4, 11.6, 11.7.

**2 · Anatomy.** One scroller with paired rows (today); each row: pane headers "A · v1.pdf, page
3" and "B · v2.pdf, page 3" (footnote 12/16, n10) and the pages at fit width (two columns share
the free width minus a 16 px gutter). Inserted or deleted pages show a placeholder at the
neighbour's size: "Not in A: inserted in B" / "Not in B: deleted". Overlay: B over A from the
top-left corner, B at the tier's opacity. Compact: one side's page column.

**3 · Material and light.** Pages are content. Marks (content role, L§1.5): changed area 1.5 px
`--select` dashed (4 / 3); changed words `--select-wash`; current change `--select-wash-strong` and
a 2 px solid `--select` outline offset 1 px (on white 4.93); heat map as the engine draws it, over
B only. No light.

**4 · States.** Pending pair (skeleton, "not compared yet"); identical ("no differences" in the
header); changed; inserted; deleted; heat map on; stale (pages draw the new state; the bar's tier
says so).

**5 · Content and copy.** Existing `compare_page_label`, `compare_missing_in_a`,
`compare_missing_in_b`, `compare_status_*` strings in both languages.

**6 · Behaviour.** Scrolling and zoom are shared; J / K and the Compare bar step changes with
*scroll-to* and the *undo reveal* ring in `--select`; a click on a marked area makes it current
and selects its row in CP5. Text in panes is selectable for copy (viewing rules); nothing
changes.

**7 · Motion.** *scroll-to*, *undo reveal*; layout switch by FLIP of the pane columns
(`--spring-smooth`). RM: instant, ring without motion.

**8 · Accessibility.** Marks are shapes (dash, outline) as well as washes; every change is also a
row in CP5 (non-visual path). A-12.

**9 · Implementation.** Pane code stays in `ComparePlace.tsx`; mark tokens `--accent-highlight*`
→ `--select-wash*`. Tests: rendered pixel of the three marks; e2e J / K reveal inside the free
rectangle.

## 19. CP5 Changes list

**1 · Role.** Everything the comparison found, as rows, with the summary and the honesty lines.
Replaces the Changes panel 5.14 (no longer a rail tab).

**2 · Anatomy.** 320 px (docked or overlay):

```
Changes · 12                                       title3 17/22
Pages: 3 changed · 0 inserted · 0 deleted · 7 unchanged   footnote n11, tnum
▸ How this comparison works                        collapsible: today's honesty lines
Page 3 ↔ 3                                         sticky heading n10 550
 ~ 1 changed area · 0.8 % of the page              rows 2–3 lines; glyph + − ~ 16 px n12
 ~ "four hundred crews" → "412 crews"
 + Added "off"
Document                                           facts group last
 ~ Document info: Title  "v1" → "v2"
```

**3 · Material and light.** M3 docked (hairline on the free edge) or floating; current row
`--accent-muted`. No light.

**4 · States.** Running: rows fill from the page map ("Comparing…"); no changes: "No differences
found."; stale: header line "The documents changed since this comparison." with Run again;
current row follows J / K and pane clicks.

**5 · Content and copy.** Today's `compare_*` strings (summary, signs Added · Removed · Changed /
Eklendi · Kaldırıldı · Değişti, rows, facts, notes); new "How this comparison works" / "Bu
karşılaştırma nasıl çalışır".

**6 · Behaviour.** Click, Enter: make current and reveal in the panes; focus stays. J / K from
anywhere in Compare. On compact (CP6) a row switches to the B segment at the change.

**7 · Motion.** Rows stream in; *panel* for open and close; the disclosure by *reflow*. RM:
instant.

**8 · Accessibility.** `complementary` "Changes"; `listbox` grouped by page; each row's sign read
as a word ("Changed", never the glyph alone); targets 28 / 44.

**9 · Implementation.** `compare/ChangesPanel.tsx` → `compare/ChangesList.tsx`; exports move to
CP7. Tests: unit list build (kept, `changes.test.ts`); browser-mode current row sync; axe.

## 20. CP6 Compact A · B · Changes

**1 · Role.** Compare on a phone: one page at a time with a three-way switch (M-38). New.

**2 · Anatomy.** Second row of CP2: segmented `[ A │ B │ Changes ]`, 44 high, full width minus 32;
labels "A", "B", "Changes" (TR "Değişiklikler", 13 letters, fits in 108 px at 15 px, c.). Panes:
the chosen side's page column, 8 px margins. The Compare bar below (`04` §11 compact form).

**3 · Material and light.** Fills inside the M3 bar; no lens on coarse pointers (L§2.7).

**4 · States.** A, B or Changes; overlay chosen in ⋯ (B shows over A with the opacity tier);
heat map in ⋯ (B).

**5 · Content and copy.** "Show" / "Göster" (group name); "A · v1.pdf", "B · v2.pdf" as names;
"Changes" / "Değişiklikler".

**6 · Behaviour.** Switching keeps the same pair in view at the same relative position; no
swipe between A and B (F§6.3); the Compare bar steps changes in B. Default segment: B (changes
are drawn on B).

**7 · Motion.** Content cross-fade 120 ms; thumb by *select*. RM: instant.

**8 · Accessibility.** `tablist` with three `tab`s controlling the panes; targets 44.

**9 · Implementation.** New `compare/CompareSwitch.tsx` (Base UI `Tabs`). Tests: e2e phone
project: J12 touch (long press A · tap B · Compare = 3), switching keeps the pair.

## 21. CP7 Report menu

**1 · Role.** Take the comparison away: an annotated PDF of B, or the changes as text. Replaces
5.14's two buttons.

**2 · Anatomy.** M4 menu from Report… (compact: in ⋯): "Export report (PDF)" with the secondary
line "B with every change marked" and "Export changes as text" with "A Markdown list". Rows 28 /
44, icons `file-pdf`, `file-text`.

**3 · Material and light.** M4 (σ 12 under 92 px tall per `04` Issue 2; this menu is about 80 px:
σ 12). No light.

**4 · States.** Disabled while running and when stale (reasons as CP2); busy (the progress
capsule in the toast stack, "Making the report… 40 %"); done (toast "Downloaded
v2-comparison.pdf" or "Saved …"); failed (toast "The report could not be made: {reason}").

**5 · Content and copy.** "Export report (PDF)" / "Raporu dışa aktar (PDF)"; "B with every change
marked" / "Her değişikliği işaretli B"; "Export changes as text" / "Değişiklikleri metin olarak
dışa aktar"; "A Markdown list" / "Markdown listesi".

**6 · Behaviour.** Writes through `deliverFile` (save picker on Chromium, download elsewhere, the
share sheet on phones, F§5.1); names `v2-comparison.pdf`, `v2-changes.md` (today). Guard: none
(a new file; nothing in the documents changes).

**7 · Motion.** *popup*. RM: fade.

**8 · Accessibility.** `menu`; reasons via `aria-describedby`; toasts announced politely.

**9 · Implementation.** New `compare/ReportMenu.tsx` calling `exportComparisonReport` and
`exportChangesText` (kept). Tests: e2e report download on Chromium and Firefox; disabled while
stale.

## 22. Family implementation and test plan

| Kind | Files |
|---|---|
| New | `shell/sidebar/` (`Sidebar.tsx`, `SidebarSwitch.tsx`, `PagesSection.tsx`, `ThumbnailList.tsx`, `thumbnail-drag.ts`, `FindSection.tsx`, `CompactFindBar.tsx`, `FindResultsSheet.tsx`, `ReviewSection.tsx`, `PhonePagesSheet.tsx`); `stage/grid/` (`GridHeader.tsx`, `grid-transition.ts`, `pinch-in-grid.ts`); `dnd/pointer-drag.ts`; `compare/` (`ComparePlace.tsx`, `CompareTopBar.tsx`, `OverlayOpacityTier.tsx`, `CompareChooser.tsx`, `ChangesList.tsx`, `CompareSwitch.tsx`, `ReportMenu.tsx`) |
| Changed | `state/ui-store.ts` (sidebar, grid, compare fields; `ui:v3`), `state/selection-store.ts` (`origin`, `tapSelection`), `stage/ArrangeView.tsx`, `ArrangeSection.tsx`, `PageCell.tsx`, `arrange-commands.ts`, `arrange-data.ts`, `shell/OutlinePanel.tsx`, `shell/review/*`, `shell/panels/RedactionsPanel.tsx`, `shell/FormsPanel.tsx`, `compare/compare-commands.ts`, `compare/compare-store.ts`, `messages/en.json`, `tr.json` |
| Deleted | `shell/LeftRail.tsx` (rail), `shell/files/*`, `shell/panels/PagesTab.tsx`, `shell/PagesPanel.tsx` (moved), `shell/SearchPanel.tsx` (moved), `redaction/MarkMatchesButton.tsx`, `compare/ChangesPanel.tsx` (moved), the setup and bar parts of `compare/CompareView.tsx`, `stage/TabArrangeMenu.tsx` (F4), `arrangeHidden`, `arrangePinned` |
| Unit | navigation never selects; v2 → v3 migration; grid columns, size clamp; tap vs click selection; pointer-drag machine; compare entry rules; commands declare `act` (registry test) |
| Browser-mode | sidebar APG tabs and listbox keys; S10; overlay dismiss; Find single field ≥ 1280; grid enter/leave focus; scope and size controls; chooser; compare reasons |
| e2e | J4 (sidebar 4, grid 5, keyboard 6, phone 5), J3 (3, lands in the grid), J12 (Library 3, document 3, phone 3), J15a, J15b (sidebar), S10, S13, drop on a tab, locked drag refused, pinch in and out (CDP), compact Compare switch, report export; new `phone`, `phone-land`, `tablet` projects (F1) |
| Rendered pixel | `glass-pixels.spec.ts`: sidebar M3, grid header, compare top bar over a white page and over black (light); thumbnail marks in both themes |
| Motion | `motion.spec.ts`: one 240 ms View Transition per grid entry, none for size steps or section switches; reduced-motion sweep |
| axe | matrix {default, Solid, more contrast, forced colours} × {EN, TR} × {dark, light}: sidebar on each section, grid in both scopes, Compare (side by side, compact switch), chooser |

## 23. Issues for the lead

1. **The sidebar in the Pages grid.** Not in F§. Decided: the Pages section is not offered there;
   a sidebar open on Pages hides for the grid and returns after; one open on Contents, Find or
   Review stays and its jumps focus cells. ▤ stays enabled, as F3 requires.
2. **Arrow keys in the thumbnail list navigate.** F§ says a navigating click never selects; it
   does not say what arrows do. Decided: arrows move the page view (as a click), Space and
   Shift+arrows select.
3. **Explicit selection on touch in the sidebar.** F§4.4 names Shift- or Mod-click only. Decided:
   a long press released without moving opens the thumbnail menu with Select first; then taps
   toggle until ✕.
4. **A thumbnail menu.** `04` §14 has no row for it. Decided: the page menu's page group (no "Add
   … here", no "Edit text here") plus Recognize text on this page, and Select on coarse pointers.
   `04` should add the row.
5. **Click and tap differ in the grid.** A click replaces the selection; a tap toggles (F§7.1
   "tap selects"; INV-R8 needs multi-select without modifiers). Conventional (Files, Photos), but
   two rules by pointer type.
6. **The phone Pages sheet keeps one meaning per detent.** A tap selects at 40 % and at 92 %.
   Navigation is a double tap, the pill or the scrubber. Contents and Review rows lower the sheet
   to 40 %.
7. **The Pages bar inside the phone sheet is solid.** F§6.3 draws a glass capsule inside the
   sheet. At 40 % that is glass on glass (L§2.1 rule 6) and a second filter in the stack (L§2.9).
   Decided: its solid twin. F10 and `04` §10 should note that the dock's morph moves into the
   sheet on compact.
8. **No sticky glass section headers.** A sticky M3 header over cells would stack a third frosted
   band under the strip and the grid header. Decided: in-flow headers on the canvas, and the
   section in view repeated as row 2 of the grid header (one filtered element).
9. **Library → Pages with a subset checked.** L6 says "showing the checked documents as sections".
   Decided: scope All open, unchecked sections collapsed. They stay as drop targets and need no
   third scope. `02-library` should match.
10. **The grid cells' hover actions go.** Their 20 px rotate and delete buttons (10.3) failed
    touch and A-15. The Pages bar and the cell menu cover them.
11. **Two drag paths.** Mouse and OS files stay on pragmatic drag and drop; touch and pen use a
    new pointer path (`dnd/pointer-drag.ts`), because native HTML5 drag after a long press is
    unreliable on mobile browsers (inventory 10.4). One path for all pointers is possible later,
    after spike S-T4 (F§12).
12. **Review marks lose their ticks.** Today a subset can be applied. The pending-marks bar
    (`04` §9) applies every mark. To keep a mark out, delete it. Also re-homed: Highlight fields →
    Show field outlines; Flatten on export → Save a copy; Edit fields and Add field → palette.
13. **Static Review chips.** All four always show, a zero count included (RA-21). Today only the
    kinds present show. **Amended (spec 06.13, X33):** the fifth filter, Words to check, appears
    once OCR has run.
14. **Overlay opacity.** `04` §11 lists it in the Compare bar's ⋯. A slider inside a menu is
    awkward to drag. Decided: a tier above the Compare bar while Overlay is chosen (400 × 40, σ 8,
    the options-tier row of L§2.9).
15. **Compare failure state.** `04` §11 has none. Decided: a toast with Try again, and the bar
    shows Run again.
16. **Page map strip removed** (11.8). CP5's page headings and J / K cover it, and so does the
    docked list from large. No F§ text keeps it.
17. **Sidebar default closed for existing users.** Migrating `leftPanelOpen: true` (today's
    default) from `ui:v2` would keep it open for everyone. Decided: do not migrate it. Keep only
    the view, filter and width.
18. **Sidebar width.** F§6.1 says docked 280. Decided: default 280, resizable 240–400, kept per
    device. The overlay stays 320 and fixed.
19. **"Outline" or "Contents".** F§ uses Outline for the sidebar; F11's pill menu says Contents.
    Turkish uses İçindekiler for both. Recommended: one English word, "Contents", in both places.
    **Resolved (spec X27):** "Contents" in the sidebar, the pill menu and ⌘K; this spec now uses it.
20. **One Find field.** From 1280 px the strip holds the field (F6), so the sidebar's Find section
    shows none. Below 1280 px it shows its own field. Both edit one query.
21. **Coverage registry rows to add** (L§10.2): grid header 1440 × 44 σ 8 and 1440 × 84 σ 10;
    compare top bar compact 390 × 88 σ 10; compact find bar 358 × 44 σ 8; sidebar 280 × 600 σ 40
    and overlay 320 × 600 σ 40 (panel row); Changes 320 × 600 σ 40.
22. **File names.** F§10 keeps `ArrangeView.tsx`, `ArrangeSection.tsx` and `PageCell.tsx`. The
    word Arrange retires from the UI. Renaming them to `PagesGrid*` is optional, best done in D2.
23. **Keys in Compare.** F§7.2 gives Compare only Esc. Decided: `1` closes Compare, `0` goes to
    the Library, `3` opens the origin's grid, and `4` does nothing there.
24. **Moves get no toast.** F§5.3 lists removals and failures. Moves inside a document are
    announced and shown by reflow only. A move to another document removes pages from the source,
    so it gets a toast with Undo.
25. **`4` with two documents open.** F§7.2 says it compares them at once. Decided: the active
    document is B.

## 24. Open questions

1. Should arrow keys in the thumbnail list move the page live (Preview does), or only on Enter?
   Live costs renders while holding a key; the 150 ms debounce should cover it. Prototype it.
2. Should the dock's Pages open the phone sheet at 92 % (the grid, as specified) or at 40 % to
   peek? Ask in the five-person test.
3. Compare marks use one colour, `--select`, with shapes. Do people want added, removed and
   changed in three colours? Status colours are reserved for status (L§1.1), so this would need a
   content palette of its own.
4. Should grid cells show small badges for comments and form fields on a page? This would help
   in J10 and J7 reviews, at the cost of noise at size S.
5. Should Combine's "Sources:" subline also mark where each source starts inside the grid (a
   thin label before its first cell), for the session?
