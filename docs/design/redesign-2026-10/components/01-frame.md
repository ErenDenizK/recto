---
title: "M9 component spec 01: the frame"
date: 2026-10-04
status: proposed
---

> Family 01 of the M9 component specs. It turns `flows.md` §2.3, §4.2, §4.6, §5.1, §5.3, §6 and
> §10 (row "3 App frame") into buildable parts, in the materials, light, type and motion of
> `language.md`. Inputs: `inventory.md` §3, §8.5, §8.13, §8.17, §14.4–14.5, §15.1.2; the baseline
> frames `03-read-*`, `18-document-menu-*`, `28-privacy-1440`; research 15 (RA-*), 16 (G-*),
> 19 (M-*), 22 (A-*). Code facts are from `develop` (`shell/AppShell.tsx`, `shell/TabBar.tsx`,
> `shell/Stage.tsx`, `shell/StatusBar.tsx`, `stage/stage-bleed.ts`, `shell/LeftRail.regions.ts`,
> `privacy/PrivacyIndicator.tsx`, `messages/*.json`). Ratios are from `language.md` §1.7, §2.2,
> §2.6, or computed with its §1.2 method where marked "c.". **(judgement)** marks unmeasured
> claims. Decisions that `flows.md` and `language.md` leave open are taken here and listed in §16.

# M9 component spec 01: the frame

## 0. Summary

- **Thirteen parts** (F1–F13): the window layout and its free rectangle, the top strip, its
  buttons, the document tabs, the title menu with Lock, Find, Save, the privacy shield, the
  compact top bar, the dock at rest, the page pill, hide on scroll, and the overlay slots
  (toasts and progress, facts chip, drop overlay, Focus).
- **One grid becomes one stage with floating layers.** Today's 3 × 3 grid (40 px title bar,
  64 px rail, inspector, 28 px status bar) goes. The page scroller fills the window; the strip,
  sidebar, dock, pill and sheets float above it, and `frame-insets.ts` publishes the free
  rectangle that every fit, jump and focus lands in (A-12).
- **Sizes.** Strip 44 fine / 52 coarse, M3 σ 8 / 10. Compact top bar 44 + safe area. Dock 48 /
  56 / 64 (phone) / 44 (compact-height), M2, σ 9 / 10 / 10 / 8. Page pill 36 fine / 44 coarse,
  M1, σ 7 / 8 (this confirms `language.md` §11.3 item 4).
- **Persistent glass in viewing:** 2 surfaces on compact (top bar, dock with the pill inside),
  3 on medium (strip, dock, pill), 3–4 from expanded (plus the docked sidebar). Area: 17.8 % of a
  390 × 844 phone, 7.3 % of a 1440 × 900 desktop with the sidebar closed, 25.8 % with it open,
  inside `language.md` §2.9's 25 % and 32 %.
- **No lime in the frame at rest.** Save, tabs and the dock use neutral fills; lime is the focus
  ring's band and, in transient menus, a switch's on state. The view's one lime stays with the
  armed tool or the Library's Open PDFs….
- **Removed:** the mode switch (3.10), layout switch (3.11), Document button (3.7), Export
  button (3.8), inspector toggle (3.9), command search field (3.6), stage header, status bar
  (3.14) with its zoom (3.15), progress (14.4), signature badge (14.5) and privacy text (15.1.2).

## 1. Family overview

### 1.1 How the parts work together

| Part | Lives in | Talks to |
|---|---|---|
| F1 Layout and free rectangle | `AppShell` | Every floating part reports its box; F1 publishes `--free-*` and `scroll-padding` to the page scroller (family 09) |
| F2 Top strip (medium and up) | Top layer | Holds F3, F4, F6, F7, F8; opens F5 |
| F3 Strip buttons ◆ ▤ + ↶ ↷ | F2, F9 | Library place; sidebar (family 05); open picker; history (family 14 owns the scrubber) |
| F4 Document tabs | F2 | `workspace.documentOrder`; the active tab opens F5; drop target for pages (family 10) |
| F5 Title menu and Lock | Popover from F4 or F9 | `lock-store`, `canChange`, sheets (family 12), facts (family 04) |
| F6 Find entry | F2, F9 | Find section of the sidebar (family 05) |
| F7 Save | F2; F5 on compact | Save pipeline, Replace popover, progress (F13) |
| F8 Privacy shield ◎ | F2; F5 header and Library on compact | external-request monitor, session storage |
| F9 Compact top bar | Top layer, compact and compact-height | Same parts as F2, fewer |
| F10 Dock at rest | Bottom layer | Morphs into the palette, Pages bar, Compare bar (families 07, 08, 10, 11) on one shape defined here |
| F11 Page pill | Bottom trailing; inside F10 on compact | View store (page, zoom, layout), outline (family 05) |
| F12 Hide on scroll | F9 and F10 on compact | `ui-store.chromeHidden`, input modality |
| F13 Overlay slots | Above the dock band | Toasts and progress (family 14), facts chip (family 04), drop overlay, Focus |

Stacking (bottom to top): light field (Library only) · page scroller · soft scroll edge · sidebar
· top strip and dock band · contextual bars · toasts · side sheets · menus and popovers ·
dialogs and their scrim · tooltips. One backdrop root holds the scroller and every glass
surface (no filtered ancestor between them, `language.md` §3.1 "Integration").

### 1.2 Composition

Desktop, large, 1440 × 900, viewing, sidebar closed (fine pointer):

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◆  ▤ │ ▪ report.pdf ● ▾ ⓘ ✕ │ ▪ agreement ⛉ │ ▪ letter-scan │ +    ⌕ Find in document  ↶ ↷ Save ◎ │ 44 F2 (M3)
│╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ soft scroll edge 24 px, only once scrolled ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌│
│ [ⓘ 12 form fields · Fill & sign]  ← F13 facts-chip slot: free.top + 12, free.left + 16          │
│                        ┌───────────────────────────────────────────┐                         │
│                        │ page column: free width − 2 × 24 px,      │   free rectangle        │
│                        │ fit width; jumps land at free.top + 24    │   1440 × 792            │
│                        └───────────────────────────────────────────┘                         │
│                          toasts and progress: bottom centre, 12 px above the dock (F13)       │
│                  ╭────────────────────────────────────────────────╮        ╭───────────────╮ │
│                  │ ▦ Pages   ✎ Markup   ✑ Fill & sign   ⋯ More     │        │ 3 / 12 · 96 % │ │ 48 F10 (M2) · 36 F11 (M1)
│                  ╰────────────────────────────────────────────────╯        ╰───────────────╯ │
│                                       16 px                                         16 px     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Legend as `flows.md` §6.2, plus ▪ tag dot, ● changes not yet in the file, ⛉ lock glyph (a seal
on signed files), ✕ close.

Phone, compact, 390 × 844, viewing (coarse; iPhone safe areas top 47, bottom 34):

```
┌──────────────────────────────┐
│░ status bar, safe area 47 ░░░│
│ ‹ 3  report.pdf ▾ ⓘ  ↶ ↷  ⌕  │ 44 F9 (M3)
│╌╌╌╌╌╌ soft edge 24 ╌╌╌╌╌╌╌╌╌╌│
│ ┌──────────────────────────┐ │
│ │ page, 8 px margins       │ │ free rectangle 390 × 655
│ │                          │ │
│ └──────────────────────────┘ │
│   toasts 12 px above dock    │
│╭──────────────────────┬─────╮│
││  ▦     ✎     ✑    ⋯  │3/12 ││ 64 F10 (M2) with F11 inside
││Pages Markup Sign More│96 % ││
│╰──────────────────────┴─────╯│
│      max(safe 34, 12)        │
└──────────────────────────────┘
```

### 1.3 Components, sources and what they replace

| Id | Component | flows.md | Jobs | Replaces (inventory) |
|---|---|---|---|---|
| F1 | Window layout, free rectangle, safe areas, soft edge, scroll proxies, scrubber | §6.1, §6.2, §6.9 | All; J2, J15 jumps | 3.1 shell grid, 3.13 scroll proxies, stage header in `Stage.tsx` |
| F2 | Top strip | §2.3, §6.1 | All | 3.1 title row of the grid (`TabBar.tsx` `header`) |
| F3 | Strip buttons ◆ ▤ + ↶ ↷ | §2.1, §5.3 | J2, J4, J14, all edits | 3.2 Home button, 3.5 Open, 3.9 inspector toggle (gone; ▤ toggles the sidebar), 5.1 rail toggle, INV-4 |
| F4 | Document tabs, overflow, tab menu | §2.3, §7.1 | J3, J12, J14 | 3.3 tab, 3.4 tab rename field (rename moves to F5), 8.13 tab context menu |
| F5 | Title menu, its header, Lock switch, Lock popover | §2.3, §2.6, §4.6, §15 q1 | J8B, J11, J13, J16 | 3.7 Document trigger, 8.5 Document menu, 15.1.1 Appearance submenu (moves to Settings) |
| F6 | Find entry | §4.7 "Find", §6.9 | J15a | 3.6 command search field (⌘K stays a key and a More item) |
| F7 | Save and the Replace popover | §5.1 | J13A, J13B | 3.8 Export button |
| F8 | Privacy shield ◎ and popover | §4.7 "Privacy", §5.2 | trust; J14 | 15.1.2 privacy indicator, 8.17 privacy popover |
| F9 | Compact top bar | §6.1, §6.3, §6.4 | All on phones | none (INV-1) |
| F10 | Dock at rest and its shared shape | §4.2, §6.9 | J4, J6, J8A, J10 | 3.10 mode switch, the at-rest form of 7.x floating tool bar |
| F11 | Page pill and its menu | §4.6 | J2, J15b | 3.11 layout switch, 3.14 page readout, 3.15 zoom, 8.6 zoom menu |
| F12 | Hide on scroll | §6.1 | Reading on phones | none |
| F13 | Overlay slots: toasts and progress, facts chip, drop overlay, Focus | §5.3, §9.3, §6.2 | J11, all removals | 3.12 drop overlay, 14.4 status-bar progress, 14.5 signature badge (to F4 seal and the facts chip) |

Removed with no successor in this family: the stage header (48 px), the status bar's selection
summary (the Pages bar says "N selected", family 08), "N documents shown" (grid header, family
10), the rail's shortcuts footer 5.2 (More → Keyboard shortcuts), the command search field's
look-alike of Find (INV-11).

## 2. F1 Window layout, free rectangle and safe areas

**1 · Role.** One layout for every size class (ADR "size-class shell", `flows.md` §14.3). It
places the floating parts, computes the free rectangle (§6.2's rest rule, RA-15) and makes every
jump, fit and focus land inside it (A-12). Serves every job; replaces the `AppShell` grid and
`stage-bleed.ts`'s "unobscured rectangle = stage box below its header".

**2 · Anatomy.** Insets of the free rectangle (CSS px):

| Inset | Value |
|---|---|
| top | strip 44 / 52, or compact bar 44 + `safe-top`; `safe-top` alone while F12 hides the bar |
| left | `safe-left` + 280 when the sidebar is docked (expanded and up); overlays do not inset |
| right | `safe-right` + side-sheet width when a tool or task side sheet is open and ≥ 400 px of stage remains (else it overlays) |
| bottom | offset + band: offset 16 (medium up) or `max(safe-bottom, 12)` (compact); band = max(dock 48 / 56 / 64 / 44, palette 48 / 64) + open options tier or pending-marks bar + 8 each |

Derived: `scroll-padding` = top + 24 (the soft edge), right + 16, bottom + 16, left + 16. Page
column margins 24 fine, 16 coarse, 8 compact; fit width capped at 1100 px of page from xlarge
(M-11). The scroller's bottom padding equals the bottom inset + 16, so the last page rests above
the dock.

| Class, reference size | Top | Bottom band | Free rectangle, sidebar closed | Sidebar open | Glass in viewing |
|---|---|---|---|---|---|
| compact 390 × 844 | 44 + 47 | 64 + 34 | 390 × 655 | Inside the Pages sheet (no inset) | 2 surfaces, 17.8 % |
| compact-height 844 × 390 | 44 | 44 + 21 | 750 × 281 (safe sides 47) | Side sheet 360, overlay | 2, 19.3 % c. |
| medium 820 × 1180, coarse | 52 | 56 + 16 | 820 × 1056 | Overlay 320, solid on touch: 820 × 1056 | 3, 8.4 % c. |
| expanded 1180 × 820, coarse | 52 | 56 + 16 | 1180 × 696 | Docked 280: 900 × 696 | 3–4 |
| large 1440 × 900, fine | 44 | 48 + 16 | 1440 × 792 | 1160 × 792 | 3 (7.3 %), 4 (25.8 %) |
| xlarge 1920 × 1080, fine | 44 | 48 + 16 | 1920 × 972, page ≤ 1100 | 1640 × 972 | 3–4 |

Layout with the sidebar open, expanded and up (docked) and medium (overlay):

```
expanded 1180, docked                         medium 820, overlay (solid on touch)
┌──────────────────────────────────────────┐  ┌──────────────────────────────────────┐
│ ◆ ▤ [report ▾ ●] agreement +  ⌕ ↶ ↷ Save ◎│  │ ◆ ▤ [report ▾ ●] agreement + ⌕ ↶ ↷ Save ◎│
│ Pages Outline│ ┌──────────────────────┐   │  │┌──────────────┐ ┌─────────────────┐    │
│ ┌──┐         │ │ page column centred  │   │  ││ sidebar 320  │ │ page unchanged:  │    │
│ │1 │  280 M3 │ │ in 900 px            │   │  ││ over the     │ │ no reflow        │    │
│ └──┘         │ └──────────────────────┘   │  ││ stage, scrim │ └─────────────────┘    │
│              │ ╭──────────────────╮ ╭────╮│  ││ none         │ ╭──────────────╮ ╭────╮│
│              │ │▦ ✎ ✑ ⋯ (labels)   │ │3/12││  │└──────────────┘ │▦ ✎ ✑ ⋯       │ │3/12││
└──────────────────────────────────────────┘  └──────────────────────────────────────┘
```

**3 · Material and light.** F1 itself draws two things. The **soft scroll edge** (G-19): a 24 px
band under the strip, `linear-gradient(var(--canvas) / 0.85 → 0)`, `aria-hidden`, pointer-
transparent, shown only while `scrollTop > 0`; jumps land below it, so it never covers a target.
The **canvas**: `--canvas` (dark n1, light n4), the `body` background too, so Safari's sampled
tint matches (M-5). No light in a document view except behind the drop overlay (F13). Solid,
forced colours: the soft edge is `display: none`.

**4 · States.** Rest: insets as above. Sidebar opening: the column re-centres by FLIP with the
panel (catalogue *panel*). Side sheet opening: right inset grows only if ≥ 400 px remains.
Virtual keyboard open (`visualViewport.height` drops by > 150 px, compact): bottom inset becomes
the keyboard top (`--vv-bottom`, M-4), the dock hides, the form accessory bar (family 08) takes
the band. Focus (F13): bottom inset falls to offset only; top stays. F12 hidden: top and bottom
insets fall to the safe areas; the page does not reflow.

**5 · Content and copy.** None of its own.

**6 · Behaviour.** Any jump (go to page, Find hit, outline entry, link, undo reveal, Alt+Enter,
Tab into a field) calls `revealInFree(rect)`: if the target is not wholly inside the free
rectangle minus padding, scroll by the smallest amount that puts it there (catalogue
*scroll-to*). Keyboard focus inside the page uses native `scroll-padding` plus
`scroll-margin: 16px` on page targets. Window resize, sidebar resize and sheet open re-measure on
one `ResizeObserver` (as today's `useStageBleed`), debounced to one frame.

**Short viewports** (height < 352 px at any width, `data-tight` on `:root`; 352 is where 88 px of
chrome reaches A-20's 25 %): the top bar folds into the dock, so one 44 px capsule (σ 8) at the
bottom holds ‹ N, title ▾, ↶ and ⋯ (More takes ↷, ⌕, ⓘ and the rest of the top bar); tool and
task side sheets become full-width bottom sheets; the Markup rail becomes a horizontal palette in
the same 44 px capsule (the compact sets of `03-markup`, folded by width). At 320 × 256 (400 %
zoom) that is 44 + 12 of 256 px, about 17 % of the area, with no horizontal chrome overflow
(A-20; `flows.md` §6.1).

**Scroll proxies (3.13)** stay: native-looking scroll bars drawn at the free rectangle's right and
bottom edges where the platform has classic bars (`scrollbarSize() > 0`); none on overlay-bar
platforms. **Page scrubber** (M-15), compact and compact-height, documents over 20 pages: a
44 × 32 thumb on the trailing edge, inset 16 px inside the free rectangle, shown while scrolling
and 1 s after; dragging shows a bubble "7 / 120" (`tnum`) and jumps on release; `role="slider"`,
`aria-valuetext` "Page 7 of 120" / "Sayfa 7/120"; hidden from keyboard (the pill's Go to page is
the keyboard path).

**7 · Motion.** *panel* (sidebar), *scroll-to*, *view change* for Library ⇄ document with the
strip, dock and pill named and position-animation off (`language.md` §7.4). Soft edge fades over
`--duration-base`. Reduced motion: instant re-centre; root cross-fade 150 ms.

**8 · Accessibility.** Landmarks: `header` (strip or bar), `nav` (sidebar), `main` (stage,
labelled by the active tab), `region` "Document tools" (dock). A-12 (free rectangle, padding),
A-13 (F6 order of `flows.md` §7.2), A-20 (CSS-px classes; glass ≤ 25 % / 32 %), A-15 (density by
pointer, not width). Safe areas: `viewport-fit=cover`, bars padded with `max(env(safe-area-
inset-*), 12px)` on the sides of compact and compact-height, `#root` at `100dvh`,
`interactive-widget=resizes-content`, `text-size-adjust: 100%` (M-3); edges reserved per M-22.

**9 · Implementation.** New `shell/frame/size-class.ts` (`useSizeClass()`, `data-size` and
`data-short` on `:root`, M-1; thresholds 600 / 840 / 1200 / 1600, compact-height `height < 480 &&
width < 1000`); new `shell/frame/frame-insets.ts` (`useFreeRect()`, `revealInFree()`, writes
`--free-top|right|bottom|left` on the shell; replaces `stage/stage-bleed.ts` measurement, keeps
`scrollbarSize` and `scrollbarsNeeded`); `AppShell.tsx` becomes `stage` + `chrome` layers (grid
areas `title/left/right/status` deleted); `index.html` viewport meta and `theme-color` per scheme
(`#08090c` / `#e6e8eb`); `global.css` `100dvh`, `overscroll-behavior: none` (M-23); tokens
`--strip-height`, `--dock-height`, `--pill-height`, `--frame-offset`, `--soft-edge`; delete
`--titlebar-height`, `--statusbar-height`, `--rail-width`. Tests: unit `frame-insets.test.ts`
(every class × sidebar × sheet × palette × pending bar; keyboard; F12); unit `size-class.test.ts`
(boundaries 599/600, 839/840, 1199/1200, 1599/1600, 479 × 999, height 351/352 for `data-tight`); browser-mode: resize re-measure;
e2e `frame-layout.spec.ts` on new projects `phone` (390 × 844, coarse, touch), `phone-land`
(844 × 390), `tablet` (820 × 1180, coarse), `desktop` (1440 × 900): for go to page, a Find hit,
an outline entry, undo reveal and Tab through `forms-a.pdf`, the target rect lies inside the free
rectangle and intersects no glass rect (A-12); at 320 × 256 the short-viewport layout keeps chrome
≤ 25 % (A-20); a safe-area run with `--safe-*` overridden through
a test hook; axe at each class.

## 3. F2 Top strip

> **Amended 2026-10-08 (owner feedback F1, "no stacked bars").** The strip is no longer a
> full-width docked band. On medium and up it is two floating glass pieces over the canvas,
> inset 16 px from the window's edges like the dock: a leading piece (◆, ▤, the tabs and +) that
> hugs its tabs up to 760 px and a trailing piece (Find, ↶ ↷, Save, ◎). Both are the capsule's
> M2 material (`mat mat-bar s9 c10`), height (`--bar-h`) and pill radius. The page scrolls
> beneath them and the bare canvas between them. The header's box (inset and piece) is the free
> rectangle's top inset. The two pieces count as one surface of Q-11's budget. Under a modal
> scrim they rest on their solid twin. The docked sidebar now runs the window's full height,
> with the leading piece floating over its top. The compact bar (F9) is unchanged. The anatomy
> below still gives the controls, their order and their sizes inside the pieces.

**1 · Role.** The slim frame on medium and up (`flows.md` §6.1): ◆, ▤, tabs with the active
title, +, Find, ↶ ↷, Save, ◎. No ⋯ in a document (view options live in the pill, app items in
More). On the Library: ◆ Library (current), tabs, +, ◎, ⋯ (Library menu, family 04). In Compare
its slot holds Compare's own top bar (family 11) at the same height and material. Serves every
job; replaces `TabBar.tsx`'s header.

**2 · Anatomy.**

```
fine, 44 px (gutter 12)                                                      coarse, 52 px (gutter 16)
┌─12─┬32┬4┬32┬8┬─ tabs 32 high, 112–220 wide, gap 2 ─┬32┬ flex ┬─Find 280×28─┬32┬32┬ Save ┬32┬12┐
│    │◆ │ │▤ │ │▪ report.pdf ● ▾ ⓘ ✕│▪ agreement ⛉│ + │      │⌕ Find in document│↶ │↷ │ Save │◎ │  │
└────┴──┴─┴──┴─┴──────────────────────────────────────┴──┴──────┴──────────────┴──┴──┴──────┴──┴──┘
coarse: buttons 44, tabs 44 high, 128–240 wide, gaps 8; Find is an icon below 1280 px
Library: ◆ Library │ ▪ report ● │ ▪ agreement │ +                                     ◎ │ ⋯
```

Every button is a 32 px circle (fine) or 44 px circle (coarse); Save is a capsule. Priority when
space runs out (narrowest first): Find field → ⌕ icon (below 1280 px); other tabs → "N more"
overflow (F4); the active tab never truncates below 112 px; ◆ ▤ ↶ ↷ Save ◎ never fold.

**3 · Material and light.** M3 docked (`.mat-panel`, σ 8 at 44, σ 10 at 52, c 0.994 / 0.991,
`language.md` §2.9): hairline on the bottom edge only, rim 0.20 on that edge, inner light 0.06,
no shadow (§2.4). The page passes beneath while scrolling; at rest nothing sits under it (the
free rectangle starts below it). M3 over the bare canvas equals the frame colour (dark n3, light
≈ n2), so the strip looks solid at rest. Primary text 9.97 (dark, over white) and 12.20 (light,
over black); glass-secondary 6.49 / 6.84. No light. Tinted: alpha 0.90. Solid: `--surface-frame`
(dark n3, light n2), rim kept. More contrast: 1 px strong border, no rim. Forced colours:
`Canvas`, bottom border `CanvasText`, `backdrop-filter: none`.

**4 · States.** Rest as above. Library: no ▤, Find, ↶ ↷, Save; ◆ shows its label and the
current fill. Markup: unchanged (the strip never signals Markup, `language.md` §0.1 principle 8).
Pages grid: unchanged; the grid header sits below it (family 10). Locked document: unchanged
except the tab glyph (F4). Busy (a document opening): unchanged; the tab shows activity. Empty
(no documents): Library state. Hidden: never on medium and up.

**5 · Content and copy.** Landmark `header`, no visible title; `aria-label` "Document bar" /
"Belge çubuğu" (Library: "Library bar" / "Kitaplık çubuğu").

**6 · Behaviour.** Tab order inside: ◆ → ▤ → active tab (one stop, APG) → overflow → + → Find →
↶ → ↷ → Save → ◎. F6 lands on the active tab (Library: ◆). A double-click on empty strip space
does nothing (no window manager here). File drop on the strip behaves as on the stage (F13).

**7 · Motion.** Named in the Library ⇄ document *view change*, position animation off, so it
stays put. Its items cross-fade 120 ms (document set ⇄ Library set). Nothing else moves.
Reduced motion: instant.

**8 · Accessibility.** Targets 32 px fine (≥ 24, A-15), 44 coarse with 8 px gaps. Contrast above.
A-11 ring inside capsules (`.capsule :focus-visible`). A-21: no fixed-width text boxes; Save and
"N more" grow with Turkish.

**9 · Implementation.** New `shell/frame/TopStrip.tsx` + `TopStrip.module.css` (composes
`.mat-panel.s8`, `.s10` under coarse). Deletes `shell/TabBar.tsx`, `TabBar.module.css`, the
`search` field, the inspector toggle and `DocumentMenu` trigger. Registry: coverage entries
"top strip 1440 × 44 σ 8", "coarse 1440 × 52 σ 10" in `tokens.test.ts`. Tests: browser-mode
`TopStrip.test.tsx` (item set per destination and class, Tab order, F6 landing), pixel
`glass-pixels.spec.ts` strip over a white page and over black (light), axe both themes.

## 4. F3 Strip buttons: Library, Sidebar, Open, Undo and Redo

**1 · Role.**

| Button | Does | Jobs | Replaces |
|---|---|---|---|
| ◆ Library | Goes to the Library place (`0`) | J1, J3, J12, J14 | 3.2 Home button (`AppGlyph.tsx`) |
| ▤ Sidebar | Toggles the sidebar (Mod+B), document only, medium and up; also in the compact-height bar (§16 item 7) | J4, J15b | 5.1 rail toggle; 3.9 inspector toggle is removed with the inspector |
| + Open | Opens the file picker (Mod+O) | J2, J3 | 3.5 |
| ↶ Undo · ↷ Redo | One history step; long press or right-click on ↶ opens the History scrubber (family 14) | All edits | INV-4 (no visible undo) |

**2 · Anatomy.** Circles of 32 px (fine) or 44 px (coarse); glyph 20 px (fine) or 24 px (coarse).
◆ uses the Recto glyph from the brand track (research 21; interim the current glyph), 20 px, with
the label "Library" beside it on the Library on medium and up (13 px, 550).

**3 · Material and light.** Fills inside M3, no glass of their own. Hover wash white 0.045
(light ink 0.04), pressed 0.075 / 0.07, on-state `--surface-on` (n5) for ◆ on the Library and ▤
when pressed. Forced colours: `ButtonText` glyphs, pressed in `Highlight`.

**4 · States.**

| State | ◆ | ▤ | + | ↶ ↷ |
|---|---|---|---|---|
| Rest | glyph n12 | `sidebar-simple` | `plus` | `arrow-u-up-left` · `arrow-u-up-right` |
| Hover · pressed | wash · wash 0.075 + press scale | same | same | same |
| Selected | On the Library: n5 fill, glyph filled, `aria-current="page"` | Open: n5 fill, `aria-pressed="true"`, glyph filled | — | — |
| Disabled | never | never in a document | never | Empty history: `aria-disabled`, glyph `--glass-text-disabled`, tooltip "Nothing to undo" |
| Busy | — | — | — | During an undo of an engine edit: ignores repeats until done (≤ 1 frame normally) |
| Locked document | — | — | — | Stays enabled (undo bypasses `commit()`, `flows.md` §2.5 rule 4) |

**5 · Content and copy.**

| Element | English | Turkish | Icon |
|---|---|---|---|
| ◆ name, tooltip | Library · 0 | Kitaplık · 0 | Recto glyph |
| ▤ name | Show sidebar · Hide sidebar (tooltip adds Ctrl B / ⌘B) | Kenar çubuğunu göster · Kenar çubuğunu gizle | `sidebar-simple` |
| + name | Open PDFs… | PDF aç… | `plus` |
| ↶ tooltip | Undo pen on page 4 · Ctrl Z | Geri al: 4. sayfadaki kalem · Ctrl Z | `arrow-u-up-left` |
| ↶ other document | Undo highlight in agreement.pdf | Geri al: agreement.pdf içindeki vurgu | |
| ↷ tooltip | Redo pen on page 4 · Ctrl Shift Z | Yinele: 4. sayfadaki kalem · Ctrl Shift Z | `arrow-u-up-right` |
| Disabled | Nothing to undo · Nothing to redo | Geri alınacak bir şey yok · Yinelenecek bir şey yok | |
| ↶ description | Right-click or hold for history | Geçmiş için sağ tıklayın ya da basılı tutun | |

**6 · Behaviour.** ◆: click, Enter, `0` → Library (*view change*); focus to the Library's first
focus (Open PDFs… when empty, else the active document's card). ▤: toggles; focus stays on ▤;
opening by Mod+B moves focus into the sidebar's current item. +: picker; on success the new tab is
active and focus goes to the page. ↶ ↷: Mod+Z, Mod+Shift+Z, Mod+Y; focus stays; the change is
revealed in the free rectangle (*undo reveal*); announce "Undid pen on page 4" / "Geri alındı:
4. sayfadaki kalem" (polite). When the step belongs to another document, the toast "Undid
highlight in agreement.pdf · Show" (family 14) and no tab switch. Long press 450 ms (10 px slop),
right-click, Shift+F10 or the Menu key on ↶ opens the scrubber; release without moving does
nothing. Guard: none (history jumps are allowed when locked).

**7 · Motion.** *press*; *hover*; *select* for ▤ and ◆ fill; ↶ ↷ enabled ⇄ disabled by a 120 ms
colour change, never *replace*. Reduced motion: colour only.

**8 · Accessibility.** `button` each; ▤ `aria-pressed`, `aria-controls="sidebar"`,
`aria-keyshortcuts="Control+B"` (Meta on Apple); ↶ `aria-keyshortcuts="Control+Z"`,
`aria-describedby` the history hint; ◆ `aria-keyshortcuts="0"`. Disabled ↶ stays focusable
(`aria-disabled`) so its tooltip reads. Disabled glyph 2.42:1 worst, exempt and visible
(`language.md` §2.3). Icon-only is allowed for undo and redo (I-6); ◆ and ▤ carry tooltips with
keys.

**9 · Implementation.** `shell/frame/LibraryButton.tsx` (replaces `AppGlyph.tsx` `HomeButton`),
`SidebarToggle.tsx`, `UndoRedo.tsx` (reads `history` from `workspace-store`; label from the
entry's description, as History rows today). Base UI: plain buttons; `Tooltip` from `ui/`.
Tests: unit labels per history entry and document; browser-mode long press opens the scrubber,
right-click too, disabled state focusable; e2e undo reveal lands inside the free rectangle.

## 5. F4 Document tabs

**1 · Role.** Switch between open documents on medium and up; show each one's state (● changes not
yet in the file, lock reason, seal); the active tab is the title menu trigger (RA-9). One order
with Library cards and Combine (`documentOrder`, INV-19), reordered by drag. A drop target for
pages dragged from the sidebar or grid (RA-7). Jobs J3, J12, J14. Replaces 3.3, 3.4, 8.13.

**2 · Anatomy.**

```
fine 32 high, 112–220 wide                       coarse 44 high, 128–240 wide
╭───────────────────────────────────────────╮
│ ▪ report.pdf ● ⛉  ▾  ⓘ  ✕ │  active: n5 fill  ▪ 8 px tag dot · name 13/18 (15/20 coarse),
╰───────────────────────────────────────────╯   middle ellipsis · ● 6 px · lock or seal 14 px ·
╭────────────────────────╮                       ▾ caret 12 px · ⓘ 16 px in a 24 px hit
│ ▪ agreement ⛉        ✕ │  inactive: no fill,   (44 coarse) · ✕ 16 px in 24 px hit (44
╰────────────────────────╯  ✕ on hover or focus  coarse; always shown on coarse)
[ 3 more ▾ ]  overflow chip, capsule 32 / 44 high, after the last visible tab
```

▾ and ⓘ show on the active tab only; ⓘ only when the file has facts (`flows.md` §9.3). Overflow
starts when the visible tabs would fall under their minimum width: the active tab and its nearest
neighbours stay; the rest go into "N more ▾" (an M4 menu of every open document in order).

**3 · Material and light.** Fills inside M3. Active: `--surface-on` (dark n5 `#272a30`, light n5
`#dee0e4`): primary 11.85 dark, 13.57 light (c.); ● and secondary text n10: 5.81 dark, 5.85 light
(c.), above 3:1 for a non-text mark. Inactive: no fill, text n11 (glass-secondary 6.49 dark over
white). Hover wash. Drop-armed: 2 px `--accent-line` inset ring (lime 0.50 dark, lime-800 light)
and the label "Move 2 pages here". No light. Forced colours: active `Highlight` / `HighlightText`,
others `ButtonText`, glyphs keep shape.

**4 · States.**

| State | Look | Notes |
|---|---|---|
| Rest | As anatomy | — |
| Hover | Wash; ✕ appears (fine) | — |
| Pressed | Wash 0.075; press scale on the tab | A drag starts after 4 px (mouse) or a 450 ms lift (touch) |
| Focus-visible | Capsule ring inside | Roving: only the active tab has `tabindex="0"` |
| Selected (active) | n5 fill, ▾, ⓘ | `aria-selected="true"`; none selected on the Library |
| Changed | ● n10 after the name | "changes not yet in the file (kept on this device)" |
| Locked | `lock-simple` 14 px; signed: `seal-check` instead | Reason in the name; never a tint (A-19) |
| Loading | 12 px activity dot in place of ●: opacity pulse 1.6 s, after 400 ms | `aria-busy="true"` on `main` |
| Error | `warning` glyph (warning colour) | Restore failed: the title menu header says what and offers "Open the original" |
| Drag lifted | Source 40 % opacity; a ghost follows | *lift and settle* |
| Drop-armed | Ring + label after 500 ms of pages hovering | Dropping moves the pages (act `pages` on both documents) |
| Disabled | Never | — |

**5 · Content and copy.**

| Element | English | Turkish |
|---|---|---|
| Tab list name | Open documents | Açık belgeler |
| Tab name | report.pdf, edited, locked · …, signed and locked | report.pdf, düzenlendi, kilitli · …, imzalı ve kilitli |
| Active tab description | Document menu | Belge menüsü |
| ⓘ name | File facts | Dosya bilgileri |
| ✕ (pointer only) | Close report.pdf | report.pdf belgesini kapat |
| Overflow | 3 more ▾ (name: 3 more open documents) | 3 daha ▾ (3 açık belge daha) |
| Drop label | Move 2 pages to agreement.pdf | 2 sayfayı agreement.pdf belgesine taşı |
| Close toast | Closed report.pdf · changes kept · Reopen | report.pdf kapatıldı · değişiklikler saklandı · Yeniden aç |
| Tab menu | Rename… · Lock · Show in Pages grid · Move left · Move right · Close · Close other documents | Yeniden adlandır… · Kilitle · Sayfa ızgarasında göster · Sola taşı · Sağa taşı · Kapat · Diğer belgeleri kapat |

**6 · Behaviour.**

| Input | Inactive tab | Active tab |
|---|---|---|
| Click, tap, Enter, Space | Activates (no transition; repeated action, A-10); focus stays on the tab | Opens the title menu (F5) |
| Left / Right, Home / End | Move focus and activate (APG automatic) | Same |
| Delete | Closes the focused tab | Same |
| F2 | — | Opens the title menu with the name field focused and selected |
| Middle click, ✕ | Closes | Closes |
| Right-click, long press 450 ms, Shift+F10 | Tab menu (M4; action sheet on coarse) | Same |
| Drag (4 px; touch after a lift) | Reorders; others reflow | Same |
| ⓘ click | — | Opens the title menu scrolled to its facts |
| Pages hovering 500 ms, then drop | Moves the pages there | — (already here) |

Close asks nothing; focus goes to the next tab to the right, else the left, else the Library's
first focus; announce "Closed report.pdf. Changes kept." / "report.pdf kapatıldı. Değişiklikler
saklandı." (polite) with the visible toast. Mod+W closes only in the installed app. Reordering
emits one `reorderDocuments` operation (not a history step; order is UI state kept in the
snapshot) and announces "report.pdf moved to position 2 of 3" / "report.pdf, 3 belge içinde 2.
sıraya taşındı". Guard: closing and reordering need none; the drop needs `canChange(target,
'pages')` and `canChange(source, 'pages')`, else the drop is refused, the ring turns neutral and
the Lock popover opens at the tab.

**7 · Motion.** Active fill moves by FLIP (`--spring-quick`); open and close by *reflow*
(`--spring-smooth`, a closed tab `scale(0.9)` + fade 120 ms); drag by *lift and settle*; lock
glyph and seal by *replace*. Reduced motion: instant, fades kept.

**8 · Accessibility.** APG Tabs (today's pattern kept): `tablist`, `tab` with `aria-selected`,
`aria-controls="stage"`, `aria-keyshortcuts="Delete F2"`; ✕ stays `aria-hidden` (closing by
Delete or the tab menu) as today. Targets 24 px for ✕ fine (spaced), 44 coarse. Long names:
middle ellipsis with the full name in `title` and the accessible name.

**9 · Implementation.** `shell/frame/DocumentTabs.tsx`, `TabOverflow.tsx`, `TabMenu.tsx`
(replaces `stage/TabArrangeMenu.tsx`; its "Hide from Arrange" goes with the grid's scope switch,
family 10); `workspace-store.ts` gains `reorderDocuments(from, to)` (INV-19); drag through
`dnd/` with the gesture core's long press on touch. `InlineTitleEditor` leaves the tab (kept for
grid section headers). Tests: unit close-focus target and overflow split at 600, 840, 1200 px
with EN and TR titles; browser-mode APG keys, F2 → name field, tab menu by Shift+F10; e2e drag
reorder updates Library order and the Combine default; drop on a locked tab refused with the
popover; axe.

## 6. F5 Title menu and Lock

**1 · Role.** The document's one menu (RA-9, `flows.md` §4.6), headed like the macOS title
popover: thumbnail, editable name, size, the status of the changes, the facts, the **Lock**
switch and the privacy line. Then File · Pages · Add to pages · Protect · Convert and Compare
with… · Document info…. Static: items stay, dim with a reason (RA-21). On compact it is the
only home of Save. The **Lock popover** (shared with the dock's Locked button, locked fields and
`commit()` refusals) is `04-context` §19's, in the one module `lock/` (spec X4); the switch here
and the tab menu call `lock/open-unlock.ts`. Jobs J8B, J11, J13A (touch), J13B, J16. Replaces 3.7, 8.5,
and moves 15.1.1 to Settings.

**2 · Anatomy.** Fine 320 px wide, coarse 360; max height `min(640px, 100dvh − strip − 32px)`;
below the active tab, start-aligned, 8 px collision padding. Compact: a bottom sheet at the 92 %
detent with the header pinned (M-29).

```
╭──────────────────────────────────────────╮
│ ┌────┐  [ report.pdf              ]      │ name: opaque well 28 (44 coarse)
│ │    │  12 pages · 2.4 MB                │ footnote, tnum
│ │48×62│ Edited, kept on this device      │ footnote, n11
│ └────┘                                   │
│ ⓘ 12 form fields           Fill & sign › │ facts rows, 28 / 44
│ ⓘ No text on 2 pages         Recognize › │
│ ⛉ Lock                         ( ●──── ) │ switch 32 × 20 (44 hit)
│   Signed file: changes break the signature│ reason line when locked
│ ◎ On this device · nothing uploaded    › │ opens F8
├──────────────────────────────────────────┤
│ File                                     │ section label: footnote 550, n11
│   Save                           Ctrl S  │ rows 28 fine / 44 coarse, keycaps fine only
│   Save a copy…             Ctrl Shift S  │
│   Print…  · Share… (coarse) · Revert… · Close
│ Pages  · Add to pages · Protect · Convert│
│ Compare with… · Document info…           │
╰──────────────────────────────────────────╯
```

**3 · Material and light.** M4 menu (σ 24; 16 when under 120 px; coarse 20), rim 0.30 / 0.10,
e4. Compact sheet M5, solid layer fading in at the 92 % detent (`language.md` §2.10). Thumbnail
solid (content), radius 2, page hairline. Name field: opaque well (dark n2, light n1) with
`--border-strong` (G-18). Current row lime 0.12 (dark) / ink 0.07 (light): primary 7.03,
glass-secondary 4.58 on M4 (§2.6). Switch on: lime fill with ink thumb (dark), ink with lime
(light), 14.79–16.42:1 between fill and thumb; it is the menu's only lime and the menu is
transient. Danger: none in this menu (removals live in their sheets). Tinted 0.90; Solid n4 /
light n1; forced colours `Canvas`, switch in `Highlight`.

**4 · States.**

| State | Look and tokens |
|---|---|
| Rest, hover, pressed | Rows: wash 0.045 / 0.075 behind primary text (M4 allows secondary: 5.49 / 4.99) |
| Focus-visible | Row: inset ring; name field: ring outside the well |
| Selected | Lock on: switch filled, thumb right, `aria-checked="true"`, glyph `lock-simple` filled |
| Disabled with reason | `aria-disabled`, label `--glass-text-disabled`, reason as description and tooltip: "Locked · turn off Lock to change pages", "Nothing changed since opening" (Revert), "No redaction marks" (Apply redactions), "Open another document first" (Combine with open documents…), "No signatures in this file" (Signatures…) |
| Locked | Change items dim with "Locked"; the name field is read-only with "Locked · Unlock" (rename is a `document` act); Save, Save a copy…, Print, Share, Close, Compare, Document info (read), Signatures stay |
| Busy | Save row shows "Saving…" and the ring (F7); other rows stay usable |
| Error | Restore failed: header status reads "Could not restore changes" with "Open the original" |
| Empty | No facts: the facts rows collapse; a zero-page document dims Pages items needing a page |

Status line (one of): "No changes" · "Edited, kept on this device" · "Edited, not kept in this
window" (private window, OPFS refused) · "Saved to the file at 18:40".

**5 · Content and copy.**

| Element | English | Turkish | Icon | Key | Act |
|---|---|---|---|---|---|
| Popover name | report.pdf document menu | report.pdf belge menüsü | — | — | — |
| Name field label | Name | Ad | — | F2 | `document` (rename, spec X12, 0030.4); locked: read-only with "Locked · Unlock" |
| Size line | 12 pages · 2.4 MB | 12 sayfa · 2,4 MB | — | — | — |
| Status | No changes · Edited, kept on this device · Edited, not kept in this window · Saved to the file at 18:40 | Değişiklik yok · Düzenlendi, bu cihazda saklanıyor · Düzenlendi, bu pencerede saklanmıyor · 18.40'ta dosyaya kaydedildi | — | — | — |
| Lock | Lock | Kilitle | `lock-simple` | ⌘K `lock` | none |
| Lock reasons | You locked it · Signed file: changes break the signature · The file restricts changes · "Open documents locked" is on | Siz kilitlediniz · İmzalı dosya: değişiklik imzayı bozar · Dosya değişikliğe izin vermiyor · "Belgeleri kilitli aç" açık | | | |
| Privacy line | On this device · nothing uploaded | Bu cihazda · hiçbir şey yüklenmedi | `shield-check` | — | — |
| File | Save · Save a copy… · Print… · Share… · Revert to the opened version… · Close | Kaydet · Kopya kaydet… · Yazdır… · Paylaş… · Açılan sürüme dön… · Kapat | `download-simple`, `copy`, —, `export`, `arrow-counter-clockwise`, `x` | Mod+S, Mod+Shift+S, Mod+P | Revert `document` |
| Pages | Insert pages from file… · Combine with open documents… · Split… · Interleave… · Rotate all ▸ · Crop pages… · Resize pages… | Dosyadan sayfa ekle… · Açık belgelerle birleştir… · Böl… · Sayfaları harmanla… · Tümünü döndür ▸ · Sayfaları kırp… · Sayfaları yeniden boyutlandır… | custom *combine*, `arrow-clockwise`, `crop` | ⌘K | `pages` (Split removes its pages from the original; Combine with open documents… and Interleave… make new documents and keep their sources: none; spec X32) |
| Add to pages | Page numbers… · Header and footer… · Bates numbering… · Watermark… | Sayfa numaraları… · Üst bilgi ve alt bilgi… · Bates numaralandırma… · Filigran… | custom *page furniture* | ⌘K | `document` |
| Protect | Password… · Sign with certificate… · Signatures… · Find sensitive data… · Apply redactions… · Remove metadata… | Parola… · Sertifikayla imzala… · İmzalar… · Hassas verileri bul… · Karartmaları uygula… · Üst verileri temizle… | `seal-check`, custom *redact* | ⌘K | `document` (Sign with certificate saves a signed copy: none) |
| Convert | Recognize text… · Compress… · Export as images… · Export as Markdown or text… | Metni tanı… · Sıkıştır… · Görüntü olarak dışa aktar… · Markdown ya da metin olarak dışa aktar… | `scan` | ⌘K | Recognize `document`; the rest open Save a copy preset: none |
| Last | Compare with… · Document info… | Şununla karşılaştır… · Belge bilgisi… | custom *compare*, `info` | `4`, ⌘K | none (editing metadata inside: `document`) |

Lock popover: titles, bodies and buttons per reason are `04-context` §19's (spec X4).

**6 · Behaviour.** Opens from: a click, tap, Enter or Space on the active tab; F2 (name focused);
ⓘ (facts in view); on compact the title ▾. On open, focus goes to the first menu row (Save), not
the name (no keyboard pops up on phones, no stray rename). Tab moves header controls → menu;
inside the menu arrows, Home / End and typeahead; Right or Enter opens "Rotate all ▸". Name
(asks `canChange(id, 'document')`; on a locked document it is read-only and Enter or a click
opens the Unlock popover at the field): Enter commits (`renameDocument`, announced "Renamed to lease.pdf" / "Adı lease.pdf olarak
değiştirildi"), Esc reverts and keeps the menu open; an empty name reverts. Lock switch: Space
or click toggles at once for `user`; turning it off for `signed` or `restricted` shows the
popover's body inline under the switch with its button, once per document per session
(`flows.md` §2.6); announce "report.pdf locked" / "report.pdf kilitlendi", "unlocked" / "kilidi
açıldı". Activating a dimmed row does not close the menu; it announces its reason. Choosing a
row closes the menu and opens its sheet (family 12); focus moves into the sheet and returns to
the active tab after it. Esc closes and returns focus to the trigger. Lock popover: opened by
`commit()` refusal (`flows.md` §2.5 rule 2), the dock's Locked button, a locked field's "Unlock",
a tool key while locked; Unlock runs `unlock(id)` and returns focus to the control that asked;
Keep locked or Esc closes. Edge cases: two documents with the same name show the folder-free
name plus "(2)" in tabs only; a document closed while its menu is open closes the menu.

**7 · Motion.** *popup* from the active tab (`transform-origin` at the caret), exit 100 ms;
*materialize*; switch thumb on `--spring-press`; inline unlock warning by *tier rise*; compact
*sheet* (`--spring-glide`, drag 1:1). The tab's lock glyph changes by *replace*. Reduced motion:
fades only.

**8 · Accessibility.** Not `role="menu"` as a whole, because it holds a text field and a switch:
the popover is a non-modal `dialog` named "report.pdf document menu", with the header controls
first and one `role="menu"` list of `menuitem`s (grouped with `role="group"` and `aria-label` per
section). Lock is `role="switch"` with `aria-describedby` the reason. Dimmed rows
`aria-disabled="true"` with `aria-description` the reason. Targets 28 px fine rows (≥ 24),
44 coarse; switch hit 44 on coarse. Keycaps only on fine pointers or after a key press (M-2).
A-13 (Esc restores focus), A-19 (lock by glyph and word), A-21 (Turkish rows wrap to two lines
before truncating; menu grows to 360 px).

**9 · Implementation.** `shell/frame/TitleMenu.tsx` (Base UI `Popover`; compact Base UI
`Drawer`), `TitleMenuHeader.tsx`, `TitleMenuItems.ts` (data: id, label, icon, key, act, sheet,
`disabledReason(state)`), `LockSwitch.tsx`; the popover is `lock/UnlockPopover.tsx`, opened
through `lock/open-unlock.ts` at "the control that asked" (spec X4; no `lock-popover-store.ts`);
"Rotate all ▸" as a nested Base UI `Menu`. Reads `lock-store.ts`, `guard.ts` (`useCanChange`),
`session/` status. Deletes `tools/DocumentMenu.tsx` and its Appearance submenu
(`shell/appearance-commands.ts` items move to Settings, family 15). Tests: unit every item's act
and reason against unlocked, `user`, `signed`, `restricted`, `default` (fails when a new item has
no act); browser-mode focus on open, Tab order, name commit and revert, switch keys, inline
warning once; e2e J13B and J16 paths, Lock blocks a page rotate and the popover opens at the
asking control; axe with the menu open (dialog + menu roles), EN and TR, forced colours.

## 7. F6 Find entry

**1 · Role.** One press to search the document (J15a), in the strip where people look for it, in
place of today's command field that looked like Find (INV-11). Results, options and the textless
prompt live in the sidebar's Find section (family 05).

**2 · Anatomy.** Large and xlarge: a field 280 × 28 (fine) in the strip, opaque well, `magnifying-
glass` 16 px leading, placeholder "Find in document", count "3 of 41" trailing (`tnum`), ‹ › 24 px
buttons once there is a query. Below 1280 px: a ⌕ 32 / 44 px button; pressing it shows the same
field over the strip's tab area, anchored to the ⌕'s trailing edge, 280 px wide (240 at medium).
Compact: ⌕ in F9 opens the field above the keyboard (M-4, family 05).

**3 · Material and light.** Field: opaque well (G-18: dark n2, light n1, `--border-strong`)
inside M3. On medium and expanded the opened field is the same well laid over the strip's tab
area, not a second glass surface (no glass on glass). Count text n11: 10.06:1 on the dark n2 well
(c.), 9.89:1 on light n1. Placeholder n9: 6.17 dark (c.), 6.20 light. Forced colours: `Field` /
`FieldText`.

**4 · States.** Rest: placeholder n9. Focus: ring outside the well. Typing: results after 150 ms
debounce. No matches: count reads "No matches", ‹ › disabled. Textless pages: count "No text"
with a link "Recognize text…" in the sidebar. Busy: the count shows "…" after 400 ms. Locked:
unchanged. Empty document: field disabled "No pages".

**5 · Content and copy.** Placeholder and name: "Find in document" / "Belgede bul"; ⌕ name "Find" /
"Bul"; count "3 of 41" / "3 / 41"; "No matches" / "Eşleşme yok"; "No text" / "Metin yok"; ‹ ›
"Previous match" / "Önceki eşleşme", "Next match" / "Sonraki eşleşme"; "All results" / "Tüm
sonuçlar".

**6 · Behaviour.** Mod+F focuses the field (opening it below 1280 px) and selects its text. Enter
/ Shift+Enter and F3 / Shift+F3 step; each hit lands in the free rectangle. Alt+Enter turns the
hit into a selection and moves focus to the page (`flows.md` §3.4). Down arrow or "All results"
opens the sidebar on Find with the list focused. Esc clears the query, a second Esc closes the
overlay field and returns focus to ⌕ (or the page when opened by Mod+F). Announce the count,
polite, 500 ms after typing stops. Guard: none.

**7 · Motion.** Overlay field by *popup* from ⌕ (`clip-path` reveal, never `width`); hits by
*scroll-to*. Reduced motion: fade.

**8 · Accessibility.** `role="search"` around a `searchbox`, `aria-keyshortcuts="Control+F"`,
`aria-controls` the sidebar list when open; count in a polite live region. Input 16 px on coarse
(iOS zoom). A-12 for hits.

**9 · Implementation.** `shell/frame/FindEntry.tsx` sharing `viewer/search.ts` with the sidebar's
Find section. Tests: browser-mode Mod+F at 1440 and 1000 px, Esc ladder, Alt+Enter focus move;
e2e J15a three steps per class.

## 8. F7 Save

**1 · Role.** Save in place on Chromium with a kept handle; otherwise picker or download
(`flows.md` §5.1, RA-14). In the strip on medium and up, in the title menu everywhere (only there
on compact). The button itself becomes the progress capsule while it works (`language.md` §8).
Jobs J13A, and the "+ save" of J3, J7, J8A, J10, J11, J16. Replaces 3.8 Export.

**2 · Anatomy.** Capsule 32 high (fine) / 44 (coarse), padding 12 / 16, label 13 / 15 px at 550,
no icon at rest; width grows with the label (never fixed; "Kaydediliyor…" is the longest, about
96 px at 13 px). The **Replace popover** (M4, 320 px) anchors below it.

```
 Save        Saved ✓        Saving… ◜        Saved ✓ (bloom)
╭──────╮    ╭─────────╮    ╭─────────────╮    ╭─────────╮
│ Save │    │ Saved   │    │ Saving… 40 %│    │ Saved ✓ │
╰──────╯    ╰─────────╯    ╰─────────────╯    ╰─────────╯
```

**3 · Material and light.** A neutral capsule fill inside M3: `--surface-on` (n5) with n12 text
(11.85 dark, 13.57 light c.); never lime (one lime per view stays with the armed tool or the
Library's primary). While saving: the 1.5 px processing ring around the capsule (`language.md`
§3.3); after a verified save, the success bloom once. Forced colours: `ButtonFace` /
`ButtonText`; ring off, text percentage kept.

**4 · States.**

| State | Look | Tokens |
|---|---|---|
| Rest, changes not in the file | "Save" | n5 fill, n12 |
| Rest, nothing new | "Saved", `aria-disabled`, tooltip "Everything is in report.pdf" | no fill, `--glass-text-secondary`; same width class, nothing reflows |
| Hover · pressed | Wash on n5 (n6) · n6 + press scale | — |
| Focus-visible | Capsule ring | — |
| Busy | "Saving… 40 %" (`tnum`), ring | input ignored until done; Mod+S queued once |
| Success | Label *replace* to "Saved", check pops, bloom; toast "Saved · verified" | success glyph only beside "verified" |
| Error | Back to "Save"; persistent toast "Could not save report.pdf: the file was moved or deleted · Save a copy…" | no red wash (`language.md` §8) |
| Locked | Allowed; locking changes nothing in the file | — |
| Unapplied redaction marks | Pressing Save first asks "2 marks not applied · Apply first?" (family 08 copy) | — |

**5 · Content and copy.**

| Element | English | Turkish |
|---|---|---|
| Labels | Save · Saved · Saving… 40 % | Kaydet · Kaydedildi · Kaydediliyor… %40 |
| Tooltip | Save · Ctrl S · Everything is in report.pdf | Kaydet · Ctrl S · Tüm değişiklikler report.pdf dosyasında |
| Toasts | Saved · verified · Downloaded report.pdf · Saved · 2 areas removed for good · verified | Kaydedildi · doğrulandı · report.pdf indirildi · Kaydedildi · 2 alan kalıcı olarak kaldırıldı · doğrulandı |
| Error toast | Could not save report.pdf: {reason} · Save a copy… | report.pdf kaydedilemedi: {reason} · Kopya kaydet… |
| Replace popover | Replace report.pdf? · Recto writes your changes into the file you opened. You can still revert to the opened version on this device. · Replace · Save a copy… · Don't ask again for this file | report.pdf değiştirilsin mi? · Recto değişikliklerinizi açtığınız dosyaya yazar. Açılan sürüme bu cihazda yine dönebilirsiniz. · Değiştir · Kopya kaydet… · Bu dosya için bir daha sorma |

Turkish percent follows `formatPercent` (Intl: "%40").

**6 · Behaviour.** Click, Enter, Mod+S. First in-place save shows Replace (focus on Replace);
then the browser's write prompt can follow once per session. Without a handle: picker, keep the
handle. Without File System Access: download, or the share sheet on iOS and Android (M-36), and
the toast says where. Focus stays on Save; announce "Saved report.pdf, verified" / "report.pdf
kaydedildi, doğrulandı" (polite), failures polite with the persistent toast (only blocking
errors are assertive). Guard: none (writing the file is not a document change); `commit()` is
not involved. Edge: saving while an engine edit runs waits for it; closing the tab during a save
finishes the save first.

**7 · Motion.** *progress* (ring), *success* (pop, bloom), *replace* for the label; Replace
popover *popup*. Reduced motion: static rim and percentage, icon swap.

**8 · Accessibility.** `button`, `aria-keyshortcuts="Control+S"`; "Saved" is `aria-disabled` and
focusable; busy `aria-busy="true"` with the percentage in the name. Contrast above; A-24 for the
action toasts.

**9 · Implementation.** `shell/frame/SaveButton.tsx`, `ReplacePopover.tsx` (Base UI `Popover`),
`save/save-in-place.ts` (family 12 owns Save a copy). Tests: unit state mapping (changes, busy,
verified, error); e2e Chromium with a mocked handle (Replace once, then one press), Firefox and
WebKit download path; pixel check that no lime appears in the strip at rest.

## 9. F8 Privacy shield ◎

**1 · Role.** Keeps the product's promise visible (research 21; FL-R10): nothing leaves the
device, and what is kept on it can be cleared. ◎ in the strip on medium and up; the title-menu
header line and the Library on compact. Replaces 15.1.2; the popover it opens (8.17) is
`04-context` §17's, which owns its content, copy, width (360 px) and `privacy/PrivacyPopover.tsx`
(spec X29). This section owns the button and its states.

**2 · Anatomy.** A 32 / 44 px circle with `shield-check` (20 / 24 px). With external requests:
`shield-warning` in the warning colour and a count badge (11 px, `tnum`). It opens the popover of
`04-context` §17 (compact: a sheet at 40 %).

**3 · Material and light.** Button: fill inside M3. Warning glyph on M2/M3 over white 5.55:1
(dark, `language.md` §2.2), with its triangle shape (A-19). No light. Forced colours: system
colours, warning by shape and words.

**4 · States.** Rest clean; hover, pressed, focus as F3. External (count > 0): warning glyph and
badge. Busy: none. Disabled: never.

**5 · Content and copy.**

| Element | English | Turkish |
|---|---|---|
| Name (clean · external) | Privacy: nothing has left this device · Privacy: 2 requests to other sites | Gizlilik: bu cihazdan hiçbir veri çıkmadı · Gizlilik: diğer sitelere 2 istek |

**6 · Behaviour.** Click, Enter or Space opens `04-context` §17's popover; Esc there returns focus
to ◎. Guard: none.

**7 · Motion.** The glyph change clean → external by *replace*; the popover's *popup* is
`04-context` §17's. Reduced motion: fade.

**8 · Accessibility.** `button` with `aria-haspopup="dialog"`. Count badge in the name, not alone.
Targets as F3.

**9 · Implementation.** `privacy/PrivacyShield.tsx` (the button, renamed from
`PrivacyIndicator.tsx`, keeps `useExternalRequests`, `documentCsp`, `serviceWorkerLabel` for the
popover to read); adds `session/storage-summary.ts` (count, bytes, `persisted()`). Tests:
existing `external-requests.test.ts`, `csp.test.ts`; browser-mode button states; e2e offline
spec reads the popover.

## 10. F9 Compact top bar

**1 · Role.** The phone frame (`flows.md` §6.1, §6.3, §6.4; M-6): back to the Library with the
open count, the title as the document menu, facts, Undo, Redo, Find. Compact and compact-height.
Hides on scroll (F12). Library variant: "◆ Recto", ◎ (or EN · TR on first visit, family 04), ⋯.
Every job on phones; nothing replaced (INV-1).

**2 · Anatomy.** 44 px + `safe-top`; side padding `max(safe-left|right, 8px)`; buttons 44 × 44.

```
390 px:  │ ‹ 3 │ report.pdf ▾ │ ⓘ │ ↶ │ ↷ │ ⌕ │      ‹ 3: 52 × 44, caret 20 + count 15 px tnum
          52     flex ≥ 64     44  44  44  44         title 15/20 at 600, middle ellipsis
Markup:  │ ‹ 3 │ report.pdf ▾ │ ↶ │ ↷ │ ⌕ │           ⓘ hides in Markup and the grid
landscape (compact-height): │ ‹ 3 │ ▤ │ report.pdf ▾ │ ⓘ │      ↶ │ ↷ │ ⌕ │
Library: │ ◆ Recto                     │ ◎ │ ⋯ │
```

Folding below 360 px: ⓘ goes (facts stay in the title menu header). Below 336 px: ↷ goes and the
title menu gains a first row "Redo …" (two- and three-finger taps still work in Markup). The title
keeps at least 64 px.

**3 · Material and light.** M3 (σ 8 at 44; the safe-area part shares the element, c computed at
44 px: 0.994), hairline bottom edge, no shadow; the page passes under it while scrolling. Same
Tinted, Solid, contrast and forced-colours forms as F2.

**4 · States.** As F2 and F3 per button. Title: rest n12; pressed wash; focus ring; locked adds
`lock-simple` (or `seal-check`) before ▾; changed adds ● after the name; loading shows the
activity dot. Hidden (F12): translated out, `inert`.

**5 · Content and copy.** "‹ 3" name "Library, 3 open documents" / "Kitaplık, 3 açık belge"; title
name "report.pdf, document menu" / "report.pdf, belge menüsü"; ⓘ "File facts" / "Dosya bilgileri";
↶ ↷ ⌕ as F3, F6; "◆ Recto" is the Library's `h1` text, not a button.

**6 · Behaviour.** ‹ N → Library (*view change*; focus to the active document's card). Title ▾ →
title menu sheet. ⓘ → title menu scrolled to facts. ↶ ↷ as F3, with long press for the scrubber
(slider form). ⌕ → Find field above the keyboard. Selection bars flip below a selection near the
bar (family 08). No swipe between documents (M-22).

**7 · Motion.** *press*; *hide on scroll* (F12); *view change*. Reduced motion as F12.

**8 · Accessibility.** `header` landmark; 44 px targets, 8 px gaps at 390 px width (the five
44 px buttons and the title leave ≥ 4 px only below 360, where ⓘ folds to keep 8 px). A-12
via F12's safeguards; A-20 at 320 × 256.

**9 · Implementation.** `shell/frame/CompactTopBar.tsx`, sharing `UndoRedo`, `FindEntry` trigger,
`TitleMenu`. Tests: browser-mode folding at 359 / 335 px; e2e phone project: J13A touch (title ▾
→ Save, 2), J15a (⌕ → type → ↓, 3), ‹ N back with focus on the card; axe on `phone`.

## 11. F10 Dock at rest

**1 · Role.** The labelled floating entry to everything that changes the document (`flows.md`
§4.2, RA-20): Pages · Markup · Fill & sign · More (phones: Pages · Markup · Sign · More with the
page pill as its trailing segment). Viewing only. It defines **the shared glass shape** that the
Markup palette (family 07), the Pages bar (10), the Compare bar (11) and the Locked state morph
into. Jobs J4 (grid route), J6, J8A, J10. Replaces 3.10 the mode switch and the at-rest form of
today's floating bar.

**2 · Anatomy.** Anchor: bottom centre of the free rectangle; offset 16 px (medium up) or
`max(safe-bottom, 12px)` (compact). Clamp: ≥ 16 px from the free rectangle's leading edge and
≥ 12 px from the pill; if it cannot fit with labels beside the icons, labels stack under them.

| Class | Height | Inset | Items | Label form | Item hit | Max width |
|---|---|---|---|---|---|---|
| compact | 64 | 4 | Pages · Markup · Sign · More · pill | Under, caption 12/16 | ≥ 56 × 56 | viewport − 24 (360 at 390) |
| compact-height | 44 | 4 | same | Beside, 13/18 | 36 visible, 44 tall hit (full capsule height) | 600 |
| medium | 56 (coarse) · 48 (fine) | 4 | Pages · Markup · Fill & sign · More | Beside when it fits, else under (TR usually under) | 48 / 40 | 600 / 560 |
| expanded and up | 48 fine · 56 coarse | 4 | same | Beside, 13/18 at 550 (15/20 coarse) | 40 / 48 | 560 / 600 |

```
fine 48, labels beside (EN ≈ 422 px, TR ≈ 490 px)
╭─4─────────────────────────────────────────────────────────────────╮
│ ( ▦ Pages ) ( ✎ Markup ) ( ✑ Fill & sign ) ( ⋯ More )               │ items: capsules 40 high,
╰─────────────────────────────────────────────────────────────────────╯ padding 12, icon 20, gap 4
labels under (stacked), 56 coarse or 48 fine
╭───────────────────────────────────╮
│   ▦        ✎          ✑        ⋯  │  icon 24 (20 fine) over caption 12/16 (11/14)
│ Sayfalar İşaretle Doldur ve  Diğer│  segment ≥ 64 wide, label + 16
│                     imzala        │  (a label may wrap to two lines at 56 px)
╰───────────────────────────────────╯
phone 64:  ╭──────────────────────────┬──────╮  1 px divider, then the pill segment (F11)
           │ ▦     ✎      ✑      ⋯    │ 3/12 │
           │Pages Markup Sign  More   │ 96 % │
           ╰──────────────────────────┴──────╯
Locked:    ╭──────────────────────────────────╮
           │ ( ▦ Pages ) ( ⛉ Locked ) ( ⋯ More )│  Markup and Fill & sign morph into Locked
           ╰──────────────────────────────────╯
```

The shared shape: one element, `border-radius: 999px`, height per class above, clipped by
`clip-path: inset(… round 999px)` for every morph (never `width`, `language.md` §7.3 *bar
morph*); one σ per class (9 fine, 10 coarse and phones, 8 compact-height); the anchor point
(bottom centre, offset) is the same for every bar it becomes; the pill and pending-marks bar
position against its current clip box.

**3 · Material and light.** M2 bar (`.mat-bar`), rim 0.34 / 0.14, inner 0.12, e3. Over white:
primary 7.90, glass-secondary 5.14 (dark); 11.53 / 6.46 (light). Labels are primary text (n12),
not secondary, so they stay ≥ 7:1. Chromium lens on fine pointers (`language.md` §2.7; see §16
item 13). No light: no under-light under the dock, which arms nothing (§3.2). What may pass
beneath: pages while scrolling; at an arbitrary stop a line (2.2 % of the stage, `flows.md` §6.2).
Tinted 0.90; Solid `--glass-bar-solid` (dark n4, light n1), rim and shadow kept; more contrast:
strong border, no shadow; forced colours: `Canvas`, 1 px `ButtonText` border, items `ButtonText`.

**4 · States.**

| State | Look and tokens | Reason shown |
|---|---|---|
| Rest | Glyphs and labels n12; no item filled | — |
| Hover | Item wash white 0.045 behind primary text (M2 rule) | — |
| Pressed | Wash 0.075, press scale 0.97 / 0.94, press light at the contact point | — |
| Focus-visible | Inset capsule ring on the item | — |
| Selected | None at rest; when Markup opens the dock is gone (morph) | — |
| Disabled | Markup, Fill & sign `aria-disabled`, glyph and label `--glass-text-disabled` | "No pages to mark up" (zero pages); "Opening…" until the model loads |
| Busy | As disabled while opening; Pages and More stay | — |
| Error | No dock (a document that failed to open has no view) | — |
| Locked | Pages · Locked · More (bar morph) | Locked opens the Lock popover |
| Empty (0 pages) | Pages enabled (insert pages); Markup, Fill & sign disabled | as above |
| Hidden | Compact F12; Focus (F13); virtual keyboard open; Pages grid, Markup and Compare (morphed) | — |

**5 · Content and copy.**

| Element | English | Turkish | Icon | Tooltip key |
|---|---|---|---|---|
| Toolbar name | Document tools | Belge araçları | — | — |
| Pages | Pages | Sayfalar | `squares-four` | 3 |
| Markup | Markup | İşaretle | `pen-nib` | M |
| Fill & sign · Sign | Fill & sign · Sign | Doldur ve imzala · İmzala | `signature` | G (arms the signature) |
| More | More | Diğer | `dots-three` | Ctrl K lists all commands |
| Locked | Locked (name: "Locked: report.pdf. Unlock…") | Kilitli ("Kilitli: report.pdf. Kilidi aç…") | `lock-simple` | — |
| First-pen hint | Writing? Tap Markup, or let the pen write anywhere in Settings. · Settings | Yazmak mı istiyorsunuz? İşaretle'ye dokunun ya da kalemin her yerde yazmasına Ayarlar'dan izin verin. · Ayarlar | — | — |

**6 · Behaviour.**

| Input | Pages | Markup | Fill & sign · Sign | More | Locked |
|---|---|---|---|---|---|
| Click, tap, Enter, Space | Grid (*view change*); focus to the current page's cell | Opens Markup on Draw, Select armed; focus to the palette's Select | Opens the palette on Sign; focus to the first saved signature, else Select | Menu (sheet with search on compact), `flows.md` §4.2 list | Lock popover |
| Key | `3` | `M`, `2` | `G` arms the last signature | — | — |
| Long press · right-click | Nothing extra | Nothing extra | Nothing extra | Nothing extra | Nothing extra |
| Pen | As mouse | As mouse | As mouse | As mouse | As mouse |
| Guard | none (viewing the grid is allowed locked) | `canChange(id, 'freehand')` to arm beyond Select; if false the dock is already Locked | same | items per their act | — |

Arrows move between items (roving, one Tab stop; on compact the pill is the last stop). F6 lands
on the last focused item, else Pages. The first pen touch in viewing shows the hint above Markup
once per device for 6 s or until used (`flows.md` §3.4), a tooltip-styled popover with a link.
Announce on Markup: "Markup on. Select armed." / "İşaretleme açık. Seçim etkin." (family 07
owns the palette's announcements). Edge: when even stacked labels leave less than 12 px to the
pill (a narrow expanded window with the sidebar docked), the dock stays centred and the pill
rises 8 px above it at the trailing edge, as it does above the palette; the bottom inset grows by
the pill's height + 8 (§16 item 5).

**7 · Motion.** *materialize* at the end of the document's *view change*; *press*; *bar morph*
into the palette, the Pages bar, the Compare bar and Locked (`--spring-smooth`, chips by FLIP
with 15 ms stagger, lens off during and back 150 ms after), *sheen* once after a morph (fine,
Clear); label form changes (beside ⇄ under) on resize without animation. Interruption: a morph
retargets from the current clip. Reduced motion: 120 ms cross-fade, no sheen.

**8 · Accessibility.** `role="toolbar"`, `aria-label` "Document tools", `aria-orientation=
"horizontal"`; Markup `aria-pressed="false"` with `aria-keyshortcuts="M"`; More
`aria-haspopup="menu"` (compact `"dialog"`); Locked `aria-haspopup="dialog"`. Labels always
visible (RA-20); the accessible name equals the label. Targets 40 fine, 48 coarse, 56 phone
(A-15), 44 in compact-height through the full-height hit. Contrast above (A-1, A-3). A-13: in
the F6 cycle; `inert` while hidden or morphing out. Turkish two-line labels keep line height
16 at 12 px (≥ 1.25 ×, A-21).

**9 · Implementation.** `shell/frame/Dock.tsx` + `Dock.module.css` (`.mat-bar.s9`, `.s10`,
`.s8`), the dock's resting items rendered in `03-markup`'s capsule (`shell/capsule/`; the
anchor, height per class, `clipFor(box)` and σ class that this spec first put in
`dock-shape.ts` fold into `capsule-morph.ts`, spec X1), `first-pen-hint.ts`. Replaces
`shell/FloatingToolbar.tsx`'s rest state and `ModeSwitch` in `Stage.tsx` (deleted with
`ModeSwitch.test.tsx`). Coverage registry: dock 560 × 48 σ 9, 600 × 56 σ 10, 360 × 64 σ 10,
600 × 44 σ 8. Tests: unit label-form decision (EN, TR at 600, 700, 840 px, sidebar open);
browser-mode roving and F6; e2e `3`, `M`, `2` from the dock, Locked popover, hint once; pixel dock
over a white page in Clear, Tinted, Solid × dark, light; motion spec: zero layouts during the
morph.

## 12. F11 Page pill

**1 · Role.** The persistent, focusable place for page and view (`flows.md` §4.6): "3 / 12 · 96 %";
opens Go to page, the top entries of Contents (the file's outline), zoom and fit, layout, Show field outlines, Focus.
Mod+G. In the F6 cycle. Jobs J2, J15b. Replaces 3.11, 3.14's page readout, 3.15 and 8.6.

**2 · Anatomy.** Medium and up: an M1 capsule 36 px (fine) / 44 px (coarse), bottom trailing of
the free rectangle, 16 px inset (+ `safe-right`), vertically centred on the dock; label 13/18 at
550 (15/20 coarse), `tnum`; min width set by the digit count of the page total so scrolling never
changes its width. Compact and compact-height: the dock's trailing segment, two lines ("3/12" over
"96 %", caption 12/16, 64 × 56 hit). Page labels: "iii (3 / 12) · 96 %". If a palette or bar in
the band would come within 12 px, the pill rises to sit 8 px above that bar.

```
╭───────────────╮      menu (M4, 300 px fine / 340 coarse; compact sheet at 40 %)
│ 3 / 12 · 96 % │      ╭──────────────────────────────────╮
╰───────────────╯      │ Go to page [ 3 ] of 12      Go   │ number field 16 px coarse
                       │ Contents                         │
                       │   1  Introduction           1    │ up to 8 top entries, tnum page
                       │   2  Terms                  4    │
                       │   All contents…                  │ opens the sidebar on Contents
                       │ Zoom  ( − ) 96 % ( + )           │
                       │ [ Fit width | Fit page ]         │ segmented, fill thumb
                       │ [ Continuous | Single | Two-up ] │
                       │ ☐ Show field outlines            │ only with fields
                       │ Focus                         F  │
                       ╰──────────────────────────────────╯
```

**3 · Material and light.** M1 chip (`.mat-chip`), σ 7 at 36, 8 at 44 (c 0.990 / 0.994), rim
0.34 / 0.14, e2. Primary 7.78 (dark over white), 11.18 (light over black). Chromium lens on fine
pointers (fixed size between zoom changes; map regenerated 150 ms after a width change). Menu M4.
Segmented controls use the own-content thumb lens (G-9) where allowed. No light. Tinted 0.90;
Solid `--glass-chip-solid` (dark n4, light n1); forced colours `Canvas` with `ButtonText` border.

**4 · States.** Rest; hover wash; pressed wash + scale; focus ring outside (it floats); open:
`aria-expanded="true"`, n5-equivalent wash 0.075 held. Disabled: never (the menu still offers
layout); zero pages: "– / 0", Go to page disabled "No pages". Loading: "– / 12" until the first
page lays out. Locked: unchanged. Field-outline row: checked state with `check` glyph. Focus mode:
hidden with the dock. Error: an out-of-range page number shows "Pages 1–12" under the field and
keeps focus.

**5 · Content and copy.**

| Element | English | Turkish |
|---|---|---|
| Pill text | 3 / 12 · 96 % · iii (3 / 12) · 96 % | 3 / 12 · %96 · iii (3 / 12) · %96 |
| Name | Page 3 of 12, zoom 96 %. Page and view options | Sayfa 3/12, yakınlaştırma %96. Sayfa ve görünüm seçenekleri |
| Go to page | Go to page · of 12 · Go · Pages 1–12 | Sayfaya git · / 12 · Git · Sayfa 1–12 arası |
| Contents | Contents · All contents… | İçindekiler · Tüm içindekiler… |
| Zoom | Zoom · Zoom in · Zoom out · Fit width · Fit page | Yakınlaştırma · Yakınlaştır · Uzaklaştır · Genişliğe sığdır · Sayfaya sığdır |
| Layout | Continuous · Single page · Two pages | Sürekli · Tek sayfa · İki sayfa |
| Fields | Show field outlines | Alan çerçevelerini göster |
| Focus | Focus · F | Odak · F |

Icons: `magnifying-glass-minus`, `magnifying-glass-plus`, `check`; none on the pill.

**6 · Behaviour.** Click, tap, Enter, Space open the menu with focus on the first control; Mod+G
opens it with the page field focused and selected; typing a number and Enter jumps (into the
free rectangle) and closes, focus to the page. Contents entry: jump, close, focus to the page,
announce "Terms, page 4" / "Terms, sayfa 4". Zoom buttons keep the menu open; Mod+= Mod+- Mod+0
work anywhere and update the text without animation. Layout and fit are radio groups. Focus
closes the menu and enters Focus (F13). Esc closes, focus to the pill. While Focus hides the pill,
Mod+G shows the menu anchored where the pill was and Focus resumes after it closes. Guard: none.
Edge: Contents with more than 8 entries shows the first 8 at the top level; nested entries are only in
the sidebar.

**7 · Motion.** *popup* from the pill; *zoom step* on the page; the rise above a bar by
`--spring-smooth`; numbers never animate. Reduced motion: fades, instant rise.

**8 · Accessibility.** `button` with `aria-haspopup="dialog"` and `aria-keyshortcuts="Control+G"`;
the menu is a `dialog` (it holds a number field and radio groups). The pill text is not a live
region; jumps announce "Page 7 of 12" / "Sayfa 7/12" (polite). F6 stop. Targets 36 fine, 44
coarse. A-12, A-13, A-15.

**9 · Implementation.** `shell/frame/PagePill.tsx`, `PagePillMenu.tsx` (Base UI `Popover`, Radio
groups from `ui/Segmented`, compact `Drawer`); reads `view-store`, `viewer/navigation.ts`
(`documentLabels`), outline. Deletes `viewer/LayoutSwitch.tsx`, `viewer/GoToPageDialog.tsx`
(its field moves here), `shell/StatusBar.tsx` and `StatusBar.module.css`. Coverage: pill 36 σ 7,
44 σ 8. Tests: unit label formatting (labels, TR percent, digit-width class); browser-mode Mod+G,
Enter jump, Esc; e2e J15b (pill → Terms, 2), pill rises above the palette at 1180 px; axe.

## 13. F12 Hide on scroll (compact)

**1 · Role.** Gives a phone reader the whole screen while scrolling down, with A-12's safeguards
(`flows.md` §6.1, M-14, C's rule; `language.md` §7.3 *hide on scroll*). Compact and
compact-height, viewing only. Nothing hides by itself from medium up.

**2 · Anatomy.** The top bar moves up by 44 + `safe-top`; the dock (with the pill) moves down by
its height + offset. Toasts stay (they re-anchor to `max(safe-bottom, 12px)`), so an Undo toast
is never hidden.

**3 · Material and light.** Unchanged glass while moving; filters never animate (only
`transform`). Solid and forced colours behave the same.

**4 · States.**

| State | Condition |
|---|---|
| Shown | Default; also always when any "never" condition holds |
| Hiding | 24 px of cumulative downward scroll (reset on direction change) in viewing |
| Hidden | `chromeHidden = true`; both bars `inert` from the first frame |
| Showing | Upward scroll of 8 px, a tap on the page that is not a target, scroll at either end of the file, any focus moving into chrome, a sheet or menu opening, any key press |
| Never hides | Keyboard modality (last input a key), focus inside the top bar or dock, Markup, the grid, Compare, a sheet open, a selection bar shown, the virtual keyboard open, "Keep tools visible" on, files of one screen or less |

**5 · Content and copy.** None visible. The Settings switch (family 15): "Keep tools visible" /
"Araçlar hep görünsün".

**6 · Behaviour.** A small state machine on the scroller's `scroll` events (passive), reading
`ui-store` and an input-modality tracker (`pointerdown` sets pointer, `keydown` sets keyboard).
Focus never lands in a hidden bar: F6 and Tab first show the bars (any key shows them), then
move. Screen-reader swipes move focus, which shows them. No announcement (the bars are not gone,
only moved). A jump from Find or the pill is made from visible chrome, so it starts shown.

**7 · Motion.** *hide on scroll*: `transform` on `--spring-quick`, reversible from the current
position; `inert` from the first frame of hiding. Reduced motion: 150 ms fade, same inert rule.

**8 · Accessibility.** A-12 (focused element never hidden: hidden bars hold no focus, and they
never hide with focus inside), A-13 (`inert` at the first exit frame; `checkVisibility` hook in
e2e finds no focus on invisible elements), A-20 (glass ≤ 25 % when shown). The accessibility
track confirms the rule (`flows.md` §12).

**9 · Implementation.** `shell/frame/hide-on-scroll.ts` (pure reducer + hook), `ui-store`
`chromeHidden`, `input-modality.ts`; `input-policy-store` `keepToolsVisible`. Tests: unit reducer
(24 px, 8 px, ends, every "never" condition); browser-mode: hidden bars `inert`, a key shows
them; e2e `phone`: scroll 24 px hides, Tab shows before focusing, Markup never hides, a toast's
Undo stays reachable; motion spec under both reduce paths.

## 14. F13 Overlay slots: toasts and progress, facts chip, drop overlay, Focus

**1 · Role.** Where transient and semi-persistent overlays sit so they never fight the dock or
the page at rest. Contents belong to their families: toasts and the progress capsule to family
14, the facts chip to family 04. This section owns placement, the document drop overlay (3.12)
and Focus (RA-12). Replaces 14.4 (status-bar progress), 14.5 (signature badge, now the tab seal
and the facts chip "Signed by … · locked"), 3.12.

**2 · Anatomy.**

| Slot | Position | Size |
|---|---|---|
| Toast stack and progress capsule | Bottom centre of the free rectangle, 12 px above the top of the band (dock, palette, pending bar, or the Library selection bar); at most 3, 14 px apart; on compact above the dock including the pill; while F12 hides the dock, at `max(safe-bottom, 12px)` | Toast 360 × 48 fine (max 480), compact `viewport − 24`; capsule 40 / 48 |
| Facts chip | Top leading corner of the free rectangle: free.top + 12, free.left + 16; compact: above the dock, 12 px | 36 fine / 44 coarse (same as the pill) |
| Drop overlay (document view) | Whole stage, scrim + the light field behind a lit-glass card, centred | Card 320 × 160 |
| Focus | Hides dock and pill; strip stays (medium up); on compact the top bar hides too | — |

**3 · Material and light.** Toasts and capsule M2 (σ 9 at 48, 8 at 40), e3; processing ring and
success bloom on the capsule (`language.md` §3.3). Facts chip M1 with the ring while its action
runs. Drop overlay: dim-only scrim, the field behind it (`language.md` §3.2, the one time light
enters a document view), lit-glass card (dark), M5 card in light. Solid forms per tier.

**4 · States.** Toasts and capsule: per family 14. Drop overlay: shown while files are dragged over
a document view; "Release to open" when over it. Focus: on, off.

**5 · Content and copy.** Drop overlay "Drop to open in new tabs" / "Yeni sekmelerde açmak için
bırakın" (existing strings). Focus: announce "Focus on. Press F or Esc to show the tools." /
"Odak açık. Araçları göstermek için F ya da Esc tuşuna basın." (touch: "Tap the page to show the
tools." / "Araçları göstermek için sayfaya dokunun."); "Focus off" / "Odak kapalı".

**6 · Behaviour.** Toasts are in the F6 cycle (A-24) after the page pill; actions held ≥ 10 s and
paused on hover or focus. Focus: F, or the pill menu's Focus (the touch route); leaves by F, Esc
(after menus and the selection in the Esc ladder), a tap on the page that is not a target, or any
chrome shortcut (Mod+G shows the pill only for its menu). Focus is per window, not kept in the
snapshot. Drop: a single file opens and becomes active; two or more open as tabs, the current
document stays active, and the toast reads "Opened 3 files · Show in Library" (spec 02.19).

**7 · Motion.** *toast*, *progress*, *success*; Focus: dock and pill fade and move 8 px down over
`--duration-fast` (`--ease-exit`), return on `--spring-quick`; drop overlay *light respond*.
Reduced motion: fades.

**8 · Accessibility.** Toasts `role="status"` (failures that block: `alert`); capsule
`role="progressbar"` with `aria-valuetext`; drop overlay `aria-hidden`; Focus keeps the strip on
medium and up, so ◆, Find, Save and ↶ stay reachable. A-13, A-24.

**9 · Implementation.** `shell/frame/overlay-slots.ts` (slot coordinates from `useFreeRect()` and
`capsule-morph.ts`), `shell/frame/focus-mode.ts` (`ui-store.focusMode`), drop overlay moved from
`Stage.tsx` into `shell/frame/DropOverlay.tsx`. Tests: unit slot positions per class and band;
e2e toast above the palette and the pending bar, Focus by F and by the pill on `phone`.

## 15. Family implementation and test plan

| Area | Files |
|---|---|
| New | `shell/frame/` (`size-class.ts`, `frame-insets.ts`, `TopStrip.tsx`, `CompactTopBar.tsx`, `LibraryButton.tsx`, `SidebarToggle.tsx`, `UndoRedo.tsx`, `DocumentTabs.tsx`, `TabOverflow.tsx`, `TabMenu.tsx`, `TitleMenu.tsx`, `TitleMenuHeader.tsx`, `TitleMenuItems.ts`, `LockSwitch.tsx`, `FindEntry.tsx`, `SaveButton.tsx`, `ReplacePopover.tsx`, `Dock.tsx`, `first-pen-hint.ts`, `PagePill.tsx`, `PagePillMenu.tsx`, `hide-on-scroll.ts`, `input-modality.ts`, `overlay-slots.ts`, `focus-mode.ts`, `DropOverlay.tsx`, `regions.ts`); `privacy/PrivacyShield.tsx` (the button; the popover is `04-context` §17's, spec X29); `session/storage-summary.ts`. The Lock popover is `lock/` (`04-context` §19, spec X4) and the dock's shape is `03-markup`'s `shell/capsule/` with `capsule-morph.ts` (spec X1) |
| Changed | `shell/AppShell.tsx` (layers, not a grid), `shell/Stage.tsx` (no header, no `ModeSwitch`, no drop overlay), `stage/ReadView.tsx` (free insets, scroll padding), `stage/ScrollProxies.tsx` (free edges), `state/ui-store.ts` (`chromeHidden`, `focusMode`, `sidebarOpen` per device; `rightPanelOpen` gone), `workspace-store.ts` (`reorderDocuments`), `index.html`, `styles/tokens.css`, `styles/global.css`, `messages/en.json`, `tr.json` |
| Deleted | `shell/TabBar.tsx`, `TabBar.module.css`, `shell/StatusBar.tsx`, `StatusBar.module.css`, `shell/AppGlyph.tsx` (glyph moves to `LibraryButton`), `shell/ModeSwitch.test.tsx`, `viewer/LayoutSwitch.tsx`, `viewer/GoToPageDialog.tsx`, `tools/DocumentMenu.tsx`, `stage/TabArrangeMenu.tsx`, `privacy/PrivacyIndicator.tsx`, `stage/stage-bleed.ts` measurement (helpers move), `shell/LeftRail.regions.ts` (to `regions.ts`), tokens `--titlebar-height`, `--statusbar-height`, `--rail-width`, messages for the mode switch, status bar and command field |
| F6 order | `regions.ts` (spec X9): top strip or compact top bar → sidebar → page (the page, then caret mode or the open editor's header) → tool sheet → facts chip → pending-marks bar → dock or palette → contextual bar → page pill → toasts; modal sheets and the title menu trap focus and sit outside the cycle; landing targets: active tab, sidebar current item, page viewport, the sheet's first control, chip, Apply, last focused dock item, bar, pill, newest toast |
| Unit | size classes; free insets; label-form decision; tab overflow; close focus; title-menu acts and reasons; save states; pill labels; hide-on-scroll reducer; slots; coverage registry rows for strip, bar, dock (four), pill (two), toast, capsule |
| Browser-mode | strip Tab order and F6; APG tabs; title menu focus and switch; Lock popover anchored at the asker; dock roving; pill Mod+G; hidden bars inert |
| e2e | new projects `phone`, `phone-land`, `tablet` beside the three desktop engines; `frame-layout.spec.ts` (A-12 rects per class, sidebar open and closed); jobs J2, J13A, J13B, J15a, J15b, J16 on each; `modes.spec.ts` rewritten for Markup and Lock (flows §7.3) |
| Rendered pixels | `glass-pixels.spec.ts`: strip, compact bar, dock (fine, coarse, phone, compact-height), pill over a white page (dark) and black (light), in Clear, Tinted, Solid, plus the no-GPU Chromium project |
| Motion | `motion.spec.ts`: no frames at rest in a document; zero layouts during the dock morph and hide on scroll; animation sweep under both reduce paths |
| axe | `a11y.spec.ts` matrix {default, Solid, more contrast, forced colours} × {EN, TR} × {dark, light} for Library, viewing, title menu open, pill menu open, Lock popover, phone with bars hidden |

## 16. Issues for the lead

1. **Order of ◆ and ▤.** `flows.md` §6.5 draws "▤ ◆", §6.1 and §6.6–§6.8 "◆ ▤". This spec uses
   ◆ ▤ at every size.
2. **Who owns the title menu.** `flows.md` §10 lists `DocumentMenu.tsx → TitleMenu.tsx` under
   family 8; this task gives the title menu, its header and Lock to family 01. This spec owns
   the whole title menu, the tab menu (inventory 8.13) and the Lock popover. Family 08 should
   point here rather than restate them. **Resolved (spec 01.2, X4):** the title and tab menus stay
   here; the Lock popover is `04-context` §19's, in `lock/`.
3. **The title menu is not a `role="menu"`.** The macOS-style header holds a text field and a
   switch, so the popover is a non-modal dialog with one menu list inside (§6). Adjust any spec
   that assumes Base UI `Menu` for it.
4. **Rename moves into the header.** A click on the active tab opens the menu, so a double-click
   no longer renames a tab (today's 3.4). F2 and the tab menu's Rename… focus the name field.
5. **Dock labels on narrow widths.** `flows.md` says only "labels". When labels beside icons do
   not fit next to the pill (Turkish at 600–839 px; narrow expanded windows with the sidebar
   docked), labels stack under the icons; if that still touches the pill, the pill rises above
   the dock.
6. **Pill and facts chip sizes.** 36 px fine, 44 px coarse, as `language.md` §2.9 assumed
   (its §11.3 item 4). The pill rises above any bar it would touch (not in `flows.md`).
7. **Compact-height top bar gets ▤.** `flows.md` §6.1 gives that class a 360 px side-sheet
   sidebar but no button for it; without ▤ only Mod+B reaches it.
8. **Compact folding below 360 px.** ⓘ folds below 360 px; ↷ moves into the title menu below
   336 px (A-20's 320 px case). `flows.md` says Undo and Redo show on every width; Undo still does.
9. **Soft scroll edge 24 px.** Research G-19 asks for 40 px. This spec uses 24 px and lands jumps
   24 px below the strip so the edge never covers a target.
10. **Side sheets and the free rectangle.** Not in `flows.md`: a side sheet insets the free
    rectangle when ≥ 400 px of stage remains, else it overlays.
11. **No Undo or Redo in the Library's strip.** `flows.md` does not say. Mod+Z still works there,
    and Library removals carry their own Undo toasts.
12. **Save never takes lime.** One lime per view goes to the armed tool or the Library's Open PDFs….
    Save is a neutral capsule. The proposals drew it lime in places.
13. **The dock's lens at rest.** `language.md` §11.3 item 3 is still open. A line can rest under the
    dock, and the Chromium lens would bend it. Recommended: keep the lens on the pill (no text
    rests under it, since it sits in the dock band) and drop it on the dock in viewing. Keep it
    on the palette. **Resolved (spec X20):** no lens on the capsule, palette included; the lens
    stays on fixed-size M1 chips (the pill, the facts chip).
14. **Focus on touch.** RA-12's four-finger tap was rejected (`flows.md` §1.3). Here, Focus is
    reached from the pill menu and left with a tap on the page. The Esc ladder (`flows.md` §7.2)
    needs one more rung: leave Focus, after clearing the selection.
15. **A-12 text in research 22** still says "chrome never auto-hides". `language.md` §9.1 amends
    it for compact. The accessibility track should update its source line so the gate matches.
16. **Restricted lock wording.** `flows.md` §2.6 asks for an "honesty line". The copy in §6 is
    the author's (judgement); legal or owner review is advised before it ships in TR and EN.

## 17. Open questions

1. **Tab overflow form.** "N more ▾" (a menu) or a horizontally scrolling strip? Test with six or
   more documents at 820 px in the wave 3 prototype.
2. **Reading ●.** Do people read ● as "at risk" even though changes are kept on the device? The
   header's status line explains it. Watch for this in the five-person test.
3. **Zoom in the pill at fit width.** Show "Fit" instead of a percentage while at fit width? It
   is shorter and clearer, but the number then jumps on the first zoom.
4. **Dock always shown from medium up** (owner question 3 in `flows.md` §15). This spec assumes
   yes.
5. **Find field width on large screens.** 280 px fixed, or growing to 360 px on focus? Growth
   causes layout in the strip; prototype both.
