---
title: "M9 components, family 09: primitives, tokens and assets"
date: 2026-10-04
status: proposed
---

> Wave 2 component spec. Binding inputs: [`flows.md`](../flows.md) (cited F§) and
> [`language.md`](../language.md) (cited L§), with its ten §13.2 amendments applied. Evidence:
> [`inventory.md`](../inventory.md) (family 15.2, rows 15.2.1–15.2.11, 8.21, INV ids), research
> 16–22 (G, AU, MO, MP, M, T, I, X, A ids) and the sibling specs 01–05 (cited as 01§ … 05§). Code
> facts are from `develop`: `apps/web/src/ui/*`, `styles/tokens.css`, `global.css`, `fonts.css`,
> `tokens.test.ts`, `state/appearance-store.ts`, `playwright.config.ts`, `vitest.config.ts`,
> Base UI 1.8.0 (`node_modules/@base-ui/react`). Contrast ratios not in L§ were computed with the
> L§1.2 method (script in the session scratch folder). **(judgement)** marks unmeasured claims.

# Family 09: primitives, tokens and assets

## 0. Summary

- **22 primitives** in `apps/web/src/ui/`, each on a Base UI part where one exists, all sized by
  the pointer (28 px rows fine, 44 px coarse) and drawn only from tokens. They replace inventory
  15.2 (11 rows), the 12 modules that redeclare `.secondary`, the 15 that compose
  `.primary-button`, and 80 native checkbox, radio, number, colour, range and search inputs plus
  17 native `<select>`s (X-11).
- **Four button variants, one lime.** Prominent (lime with ink; ink with lime in light), standard
  (a fill), quiet (no fill) and danger (danger label, never a red fill). Filled buttons live on
  M3–M5 and solid surfaces only; on M1/M2 bars every button is quiet, so text stays ≥ 7:1.
- **On-states are neutral** (n12 fill, ink glyph) for switch, checkbox, radio, chip and
  segmented thumb, so a sheet keeps one lime element (L§0.1 p3); Issue 1.
- **One control border** (`--control-border`, dark white 0.48, light ink 0.55, ≥ 3.61:1 over the
  worst glass) for fields, boxes, radios and switch tracks; today's 0.16 hairline is 1.59:1.
- **Two-band focus ring in three forms** (outset 2 px, inset −2 px, gap 4 px) replacing 77
  `outline-offset` declarations (67 in focus rules) in 44 files.
- **Infrastructure:** `tokens.css` in three layers and both themes; `materials.css` tier × σ
  classes; a coverage registry, APCA gate and colour pairs in `tokens.test.ts`; a rendered-pixel
  harness in four Playwright projects; the `'Inter Recto'` subset pipeline (98 KB); the Phosphor
  build-time icon pipeline that removes `lucide-react` (97 names in 59 files); the `light/` aurora
  API; the `motion/` spring core and `motion/gesture/` recognisers.

## 1. Family overview

### 1.1 How the parts work together

| Layer | Parts | Rule |
|---|---|---|
| Tokens | `tokens.css` (raw → semantic → control), `materials.css`, `motion.css`, `fonts.css` | Components read semantic and control tokens only; raw steps (`--n7`, `--lime-800`) never appear in a module (source scan, §27) |
| Actions | Button, IconButton, Chip, Select / menu button | One prominent per surface; filled only on M3–M5 or solid |
| Choices | Segmented, Switch, Checkbox, Radio group, Swatch, Slider | Neutral on-state; shape plus fill twin, never colour alone (A-19) |
| Entry | Text field, Search field, Number field | Opaque well inside glass (L§2.10, G-18); 16 px text on coarse |
| Labels | Keycaps, Badge, Tag dot / Tag / Avatar, Tooltip, Empty note | Decorative parts `aria-hidden`; names live on the control |
| Structure | Focus ring, Scroll area, Resize handle, Progress bar | Shared by every family |
| Engines | `light/`, `motion/`, `motion/gesture/`, icon and font pipelines | No library; each under its budget |

Every primitive is surface-agnostic: inside a `.mat` element the glass text remaps of L§2.3 apply
(`--text-secondary` → n11, `--danger` → glass variant), so one component works on glass and solid.

### 1.2 Composition

```
Desktop 1440 × 900, fine pointer: Save a copy side sheet (M5, 400 px) over a page
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ◆ ▤ [report.pdf ▾ ●] agreement +           ⌕ Find in document   ↶ ↷  Save  ◎        │
│   ┌──────────────────────────────┐ │ Save a copy                              (✕)   │ IconButton 28
│   │ page                         │ │ Format   [ PDF | Images | Text ]               │ Segmented 28
│   │                              │ │ Size     ◉ Same as original                    │ Radio 16 in 28 row
│   │                              │ │          ○ Smaller   about 1.1 MB  ← tnum      │
│   │                              │ │ Quality  ━━━━━━━○──────  72 %                  │ Slider 4 / thumb 16
│   │                              │ │ Pages    [ All pages            ▾]             │ Select 28
│   │                              │ │ From     [  3  ]−+  to [ 12 ]−+                │ Number field 28
│   │                              │ │ ☑ Remove metadata   ☐ Flatten forms            │ Checkbox 16
│   │                              │ │ Password            ( ○━━ ) off                │ Switch 36 × 20
│   │                              │ │ Name     [ report-small.pdf          ]         │ Text field 28
│   └──────────────────────────────┘ │ ⓘ Saves a new file. Nothing is uploaded.       │ footnote n11
│                                    │                ( Cancel )  (■ Save copy ■)     │ standard + prominent
│        ╭───────────────────────────────────────╮   ╭─────────────╮                  │
│        │ ▦ Pages  ✎ Markup  ✑ Fill & sign  ⋯   │   │ 3 / 12 · 96%│                  │ quiet buttons on M2
│        ╰───────────────────────────────────────╯   ╰─────────────╯                  │
└─────────────────────────────────────────────────────────────────────────────────────┘

Phone 390 × 844, coarse pointer: Settings (full sheet, M5 solid at 92 %)
┌──────────────────────────────────────┐
│ ▬                                    │ grabber 36 × 5
│ Settings                         (✕) │ IconButton 44
│ Appearance                           │ footnote 550, n10
│ Theme  [ System | Light | Dark ]     │ Segmented 44, full width
│ Glass  [ Clear | Tinted | Solid ]    │
│ Ambient light   [ Auto          ▾]   │ Select → action sheet on compact
│ Reduce motion          ( ━━━━○ )     │ Switch 52 × 32 in a 44 row
│ Pen and touch                        │
│ Draw with finger       ( ○━━━━ )     │
│ Saved signatures  3        (Clear)   │ Badge · standard button 44
│ ╭──────────────────────────────────╮ │ scroll area, soft 12 px edges
└──────────────────────────────────────┘
```

### 1.3 Components and what they replace

| § | Component | Replaces (inventory, code) | File after M9 | Base UI part |
|---|---|---|---|---|
| 3 | Button | 15.2.9; `.primary-button` (15 modules), `.secondary` (12), FurnitureDialogs `.danger` | `ui/Button.tsx` | `button` |
| 4 | IconButton | 15.2.1 | `ui/IconButton.tsx` | `button` + `tooltip` |
| 5 | Chip | 15.2.5 RadioChips, Library and palette chips' private styles | `ui/Chip.tsx` | `toggle`, `radio-group` |
| 6 | Segmented | 3.11 layout switch, 3.10 mode switch (retired), native radio rows | `ui/Segmented.tsx` | `radio-group` or `tabs` |
| 7 | Switch | 15.1.1 check rows ("Glass panels"), native checkboxes used as settings | `ui/Switch.tsx` | `switch` |
| 8 | Checkbox | 38 native checkboxes | `ui/Checkbox.tsx` | `checkbox`, `checkbox-group` |
| 9 | Radio group | 30 native radios | `ui/RadioGroup.tsx` | `radio-group`, `radio` |
| 10 | Slider | 15.2.3 Range (3 native ranges) | `ui/Slider.tsx` | `slider` |
| 11 | Select and menu button | 17 native `<select>`; menu triggers | `ui/Select.tsx`, `ui/MenuButton.tsx` | `select`, `menu` |
| 12 | Text field | 4 text inputs, 5 textareas, password inputs | `ui/TextField.tsx` | `field`, `input` |
| 13 | Search field | Find field, palette input, 1 native search | `ui/SearchField.tsx` | `input` |
| 14 | Number field | 9 native number inputs | `ui/NumberField.tsx` | `number-field` |
| 15 | Keycaps | 15.2.2 | `ui/Keycaps.tsx` | — |
| 16 | Swatch | 5 native colour inputs, swatch rows in StyleControls and PenBar | `ui/Swatch.tsx` | `radio-group` |
| 17 | Badge | Count spans, SignatureBadge's shield word (14.5) | `ui/Badge.tsx` | — |
| 18 | Tag dot, tag, avatar | `[data-tag]` globals, author initials | `ui/Tag.tsx`, `ui/Avatar.tsx` | `avatar` |
| 19 | Focus ring | 15.2.11 | `styles/global.css`, `styles/focus.css` | — |
| 20 | Tooltip primitive | 8.21 (behaviour and copy in 04§20) | `ui/Tooltip.tsx` | `tooltip` |
| 21 | Scroll area | Global thin scrollbars | `ui/ScrollArea.tsx` | `scroll-area` |
| 22 | Empty note | 15.2.6 | `ui/EmptyNote.tsx` (from `shell/`) | — |
| 23 | Resize handle | 15.2.4 | `ui/ResizeHandle.tsx` | — |
| 24 | Progress bar and activity glyph | Dialog progress bars (14.7), ad-hoc spinners | `ui/Progress.tsx` | `progress` |

Owned elsewhere, built on these: Menu and Popover primitives, ContextBar (04§3, §12, §15; 15.2.7,
15.2.8), the dock capsule (01, 03), Sheet and Toast (Issue 4). 15.2.10 glass classes become §26.

## 2. Shared rules

### 2.1 Density by pointer (M-2, L§6.2, A-15)

Tokens live in `tokens.css` §3 with coarse overrides in §4 (`@media (pointer: coarse),
(any-pointer: coarse)`). A touch laptop is coarse everywhere, by design (M-2).

| Token | Fine | Coarse | Used by |
|---|---|---|---|
| `--hit-min` | 24 | 44 | Every target; `::after` hit extension, never overlapping |
| `--control-h` · `--control-h-lg` | 28 · 36 | 44 · 52 | Buttons, fields, rows, segmented · sheet footers, Library launcher |
| `--bar-button` · `--bar-h` · `--bar-h-context` | 32 · 44 · 36 | 44 · 56 · 44 | Quiet buttons on bars (01, 03, 04) |
| `--chip-h` | 28 | 36 visible, 44 hit | Chips |
| `--check` · `--switch-w × --switch-h` · `--thumb` · `--track` | 16 · 36 × 20 · 16 · 4 | 20 · 52 × 32 · 28 · 6 | Checkbox, radio · switch · slider |
| `--icon-sm` · `--icon-md` | 16 · 20 | 20 · 24 | Rows and menus · bars |
| `--gap-target` | 4 | 8 | Between adjacent targets |
| `--field-text` | 13 px | 16 px | Every text input (iOS zoom rule, L§4.2) |
| `--keycaps` | `inline-flex` | `none` until `[data-keys]` | Keycaps (§15) |

Hover rules sit inside `@media (hover: hover)`. Size classes change placement only: on compact a
Select opens an action sheet and a Segmented that overflows becomes a Select (§6, §11).

### 2.2 Control tokens (new, `tokens.css` §1 control block)

| Token | Dark | Light | Measured (worst backdrop) |
|---|---|---|---|
| `--control-fill` · `-hover` · `-pressed` | white 0.08 · 0.12 · 0.16 | ink 0.06 · 0.09 · 0.12 | n12 on fill: M5 7.78 · 6.86 · 6.06; M4 7.55; light M5 12.98 · 12.23 · 11.53 |
| `--control-border` · `-hover` | white 0.48 · 0.60 | ink 0.55 · 0.70 | Ring vs surface: M5 4.09, M4 4.06, n2 5.01 · light M5 3.76, M4 3.61, n1 3.95 |
| `--control-on` · `--control-on-ink` | n12 · `#08090c` | n12 · n1 | On-fill vs M5 9.96, M2 7.90; light 14.65 · glyph 16.40 / 17.65 |
| `--control-thumb-off` | n11 | n9 | vs M5 6.49 · light 5.15 |
| `--control-track` · `--control-range` | white 0.24 · `--accent-line` | ink 0.28 · `--accent-line` (lime-800) | Range fill vs M2: 3.25 · 4.22; vs M5 3.75 · 5.37 |
| `--field-well` · `--field-placeholder` | n2 · n10 | n1 · n10 | Placeholder 7.58 · 7.61; primary 15.45 · 17.65 |
| `--scroll-thumb` | white 0.40 | ink 0.50 | vs M3 worst 3.33 · 3.09 |
| `--badge-fill` | n6 | n4 | n12 on it 10.43 · 14.61 |

### 2.3 Shared states

| State | Token change (all primitives unless the section says otherwise) |
|---|---|
| Rest | Label n12; secondary n10 (n11 inside `.mat`); glyph outline |
| Hover (fine) | One step: `--surface-hover` wash for quiet, `--control-fill-hover` for filled, `--control-border-hover` for bordered; nothing moves (*hover*) |
| Pressed | `--control-fill-pressed` or `--surface-active`; *press* scale 0.97 mouse / 0.94 touch and pen; press light on glass |
| Focus-visible | Two-band ring, form per §19 |
| On / selected | `--control-on` fill, `--control-on-ink` glyph, Phosphor fill twin (I-2); rows and chips use `--accent-muted` plus a shape cue (check or ring) |
| Disabled | Label and glyph `--text-disabled` (n8; `--glass-text-disabled` in glass), fills n5; `aria-disabled="true"`, focusable (`focusableWhenDisabled`), reason via tooltip and `aria-describedby`; on touch the reason shows as a footnote under the control group, since tooltips need a long press |
| Busy | After 400 ms the leading glyph becomes the activity glyph (§24); width frozen at press; `aria-busy="true"`; input refused while busy, never queued |
| Error | `--danger` border or label plus `x-circle` or `warning` glyph and words (L§8); `aria-invalid` |
| Locked document | The caller passes `blocked={{ reason, onPress }}` from `useCanChange(id, act)`; the control looks disabled, stays pressable, and a press calls `onPress` (04§19 opens the Unlock popover there). Reason copy "Locked · Unlock" is 04's |
| Empty | Per component (Select with no options, Search with no results) |
| Forced colours | `ButtonFace`/`ButtonText`, borders `ButtonBorder`, on states `Highlight`/`HighlightText`, disabled `GrayText`; `forced-color-adjust: none` only on swatches and tag dots (content colours) |

### 2.4 Guard and focus

Primitives never import `state/guard.ts`. A caller that changes a document resolves
`useCanChange(id, act)` (F§2.5) and passes `disabled` or `blocked`; each section names the usual
act. Focus never moves on its own except where a section says; announcements are the caller's
unless listed.

### 2.5 Motion

Catalogue names (L§7.3) only: *press*, *hover*, *select*, *replace*, *popup*, *tooltip*,
*progress*, *success*. Thumbs move on `--spring-press`. Reduced motion (L§7.5): colour change
only, no scale, instant thumbs; fades ≤ 150 ms.

## 3. Button

1. **Role.** Every text action: Open PDFs… (J1), Combine 2 files (J3), Apply (J10, J16), Save
   and Replace (J13A), Save copy (J13B), Unlock, Cancel. Replaces 15.2.9: `.primary-button`
   (15 composing modules), the 12 identical `.secondary` declarations, FurnitureDialogs' `.danger`.
2. **Anatomy.** Capsule, label 13/18 at 550 fine, 15/20 coarse; optional leading glyph.

   ```
   md fine 28   ( ⬚ Save copy )   pad 12 · glyph 16 · gap 6       coarse 44  pad 16 · glyph 20
   lg fine 36   (  Open PDFs…  )  pad 16 · 15/20 label            coarse 52  full width in phone sheets
   busy         ( ◌ Saving…    )  width frozen
   ```

   Variants: **prominent** (one per surface), **standard** (fill), **quiet** (no fill), **danger**.
   Compact sheets stack footers full width, prominent last (nearest the thumb).
3. **Material and light.** No glass of its own (L§2.1 r6). Prominent: `--primary-fill`/`-ink`.
   Standard: `--control-fill`, only on M3–M5 or solid (on M2 a 0.08 fill gives n12 6.24:1, under
   A-1's 7:1 resting floor); on M1/M2 the same action renders quiet. Danger: on M3–M5 the standard
   fill under `--danger`; on M1/M2 quiet (danger glass 5.07 dark, 5.25 light). Busy prominent may
   carry the processing ring (L§3.3, §28 `ProcessingRing`) when it becomes a progress capsule.
   Tinted and Solid: unchanged (fills sit on the tier's solid). Forced colours: `ButtonFace`,
   prominent `Highlight`/`HighlightText`.
4. **States.**

   | State | Prominent dark / light | Standard | Quiet | Danger (M3–M5) |
   |---|---|---|---|---|
   | Rest | lime/ink 16.42 · n12/lime 14.79 | `--control-fill`, n12 | none, n12 | `--control-fill`, `--danger` (4.84–4.99 dark, 5.14–5.91 light) |
   | Hover | `#ddff82` 17.73 · n11 8.29 | `-hover` | `--surface-hover` | fill unchanged, 1 px `--danger` ring, glyph fill twin (0.12 would drop to 4.27) |
   | Pressed | `#b2e93c` 13.86 · `#000` 17.32 | `-pressed` | `--surface-active` | press scale and light only |
   | Disabled | n5 fill, n8 label | n5 at 0.5, n8 | n8 | n8 |
   | Busy | Activity glyph, label "{verb}…" | same | same | never busy (confirms are instant) |

   Locked: as disabled plus `blocked`. Error: none on the button; the caller shows a message.
5. **Content and copy.** Verbs with objects (X-7); ellipsis only when more input follows. The
   primitive owns: busy fallback "Working…" / "İşleniyor…"; disabled fallback reason "Not
   available now" / "Şu an kullanılamıyor". Callers pass specific reasons, shown as the touch
   footnote, e.g. "Choose at least one page" / "En az bir sayfa seçin".
   Labels size to content (L§4.4 r5, 1.8 × English); counts in labels use `tnum`.
6. **Behaviour.** Click, Enter, Space activate; touch and pen activate on release inside the hit
   area (10 px slop). Danger never takes initial focus; in a destructive confirmation focus starts
   on Cancel and Enter acts only on the focused button. Busy refuses input. After activation focus
   stays, unless the surface closes (then the surface's rescue, 04§2.6). Guard: caller's act
   (Apply → `document`; Delete page → `pages`).
7. **Motion.** *press*; busy *replace* glyph; *success* check pop when the caller reports done;
   RM colour only.
8. **Accessibility.** `button`; name = label; `aria-busy`; `aria-describedby` → reason; target
   `--control-h`; A-1, A-3, A-15, A-19 (danger has a glyph), A-21.
9. **Implementation.** `ui/Button.tsx` on Base UI `Button` (`focusableWhenDisabled`), props
   `variant`, `size`, `icon`, `busy`, `progress`, `blocked`, `reason`; global classes `.btn`,
   `.btn-prominent|standard|quiet|danger` in `styles/controls.css` for the `composes` step (§32).
   A `SurfaceTier` React context set by every `.mat` host makes standard/danger fall back to quiet
   on M1/M2. Deletes `.primary-button` from `global.css` and every module `.secondary`. Tests:
   browser mode (variant fallback on M2, busy refuses clicks, danger not autofocused, reason
   described); `tokens.test.ts` pairs of §2.2; rendered-pixel prominent on M5 over white; axe in
   the gallery (§29).

## 4. IconButton

1. **Role.** Icon-only actions where I-6 allows (close, search, undo, redo, more, share) and
   labelled-by-tooltip tools on bars. Replaces 15.2.1. Serves ↶ ↷ (F§5.3), ✕ on sheets, ◆ ▤.
2. **Anatomy.** Circle (L§6.1).

   ```
   row 28 (icon 16) · bar 32–36 (icon 20) · coarse 44 (icon 24) · floating chip 32/36/40/44
   ```

3. **Material and light.** Inherits its host. **Floating** variant (close/back on the stage,
   scroll-to-top) is an M1 chip: `.mat-chip` with σ 5/6/7/8 at 32/36/40/44 (c 0.997–0.988,
   L§2.9), e2, lens per L§2.7 on fixed sizes.
4. **States.** §2.3. `toggle` mode: on = fill twin + `--accent-muted` + `aria-pressed`; `armed`
   tone (palette tools, 03§2.3) = `--tool-active-fill`/`-ink`.
5. **Content and copy.** Label is mandatory (type-checked); tooltip "{label} · {keys}".
6. **Behaviour.** As Button; long press on coarse shows the tooltip unless the caller supplies
   `onLongPress` (↶ opens History, F§5.3). Guard: caller's.
7. **Motion.** *press*, *select* for toggles, *replace* for glyph changes.
8. **Accessibility.** `aria-label`, `aria-keyshortcuts`, `aria-pressed` in toggle mode; hit area
   ≥ `--hit-min` even when the circle is 28. A-15, I-6.
9. **Implementation.** `ui/IconButton.tsx` keeps its API; `size` becomes `row | bar | float`;
   `icon` takes an `IconName`. Tests: browser mode (long press shows tooltip and swallows the
   click; toggle states); the existing tests move from Lucide to `<Icon>`.

## 5. Chip

1. **Role.** Short choices and actions inside panels and bars: Review filters (Comments · Marks ·
   Fields), Pages · Bookmarks (sidebar), saved-signature chips (03, Sign set), Library facts
   actions. Replaces 15.2.5 RadioChips.
2. **Anatomy.** `( ✓ Marks  2 )` capsule `--chip-h`, pad 10, label 12/16 at 550 fine (13/18
   coarse), count `tnum` n10, leading check only when selected; removable variant adds `x` 16.
3. **Material and light.** Fill `--control-fill` on M3–M5 and solid; on M2 no fill at rest.
4. **States.** Selected: `--accent-muted` (n12 on it 7.17 dark, 12.73 light over M5) plus the
   check glyph and 1 px `--accent-line` ring (3.75 / 5.37 vs M5); hover one step; disabled n8.
5. **Content and copy.** Caller's labels; remove "Remove: {name}" / "Kaldır: {name}".
6. **Behaviour.** Single choice: APG radio group (one tab stop, arrows choose, Home/End), as
   RadioChips today. Multi: toggles. Remove: Delete or Backspace on the focused chip.
7. **Motion.** *select* on the check; *reflow* when chips are removed.
8. **Accessibility.** `radiogroup`/`radio` or `button[aria-pressed]`; name includes the count
   ("Marks, 2 items" / "İşaretler, 2 öğe"). A-3, A-19.
9. **Implementation.** `ui/Chip.tsx`, `ui/ChipGroup.tsx` on `radio-group` and `toggle`; deletes
   `shell/panels/RadioChips.tsx` and its module. Tests: browser-mode keyboard parity with the
   current RadioChips tests.

## 6. Segmented control

1. **Role.** Two to four mutually exclusive views or values: grid scope This document | All open
   (F§4.3, 10), Compare Side by side | Overlay and A · B · Changes (M-38), pill Fit width | Fit
   page and Continuous · Single · Two-up (01), Settings Theme, Glass (F§9.5), Save a copy Format.
   Replaces 3.11 layout switch and native radio rows; the mode switch (3.10) is retired.
2. **Anatomy.**

   ```
   fine  [▐ This document ▌ All open 3 ]   track 28, inset 2, thumb 24, label 13/18 550
   coarse[▐   System   ▌  Light  │ Dark ]   track 44, thumb 40, label 15/20; phone: full width
   ```

   Equal segment widths when the widest label fits; else sized to content; if the control still
   overflows its container (TR at 1.8 ×, compact), it renders as a Select (§11).
3. **Material and light.** Track `--control-fill` (a fill, no glass in glass). Thumb
   `rgb(255 255 255 / 0.14)` dark, n1 light with e1, plus a 1 px `--control-border` ring (the
   thumb fill alone is 1.65:1 against the track; Issue 8). Own-content lens on the thumb's
   label layer where L§2.7 allows (G-9). Forced colours: thumb `Highlight`.
4. **States.** Selected segment: thumb, label weight 650, glyph fill twin; others n10 label,
   hover one step; disabled segment n8 with reason ("All open: open a second document" / "Tümü:
   ikinci bir belge açın", F§9.4).
5. **Content and copy.** Caller's labels; counts `tnum`.
6. **Behaviour.** Click or tap a segment; drag the thumb across segments on touch (commits on
   release); arrows move and choose (radio) or move and activate (tabs, automatic activation).
   Guard: none (views and settings).
7. **Motion.** Thumb translates on `--spring-press`, retargets mid-flight; label *select*; RM
   instant.
8. **Accessibility.** `semantics="radio"` → `radiogroup` (Base UI RadioGroup); `"tabs"` → Base UI
   Tabs with `Tabs.Indicator` as the thumb. A-3 (ring 4.06 vs M4), A-15, A-21.
9. **Implementation.** `ui/Segmented.tsx` (thumb position from the checked item's box via
   ResizeObserver into `--thumb-x`, `--thumb-w`); `viewer/LayoutSwitch.tsx` deleted (01). Tests:
   browser mode (both semantics, overflow → Select at 320 px, drag on touch), rendered-pixel thumb
   ring over white.

## 7. Switch

1. **Role.** Settings that apply at once: Reduce motion, Draw with finger, Keep tools visible,
   Open documents locked (F§9.5), the title-menu **Lock** switch (F§2.3), Password in Save a copy.
   Replaces 15.1.1's check rows and settings checkboxes.
2. **Anatomy.** `( ━━━○ )` track 36 × 20 fine (thumb 16), 52 × 32 coarse (thumb 28) inside a
   44 px row; label leads, switch trails; optional glyph in the thumb (Lock: `lock-simple` 12/20).
3. **Material and light.** No glass. Off: transparent track, 1.5 px `--control-border`, thumb
   `--control-thumb-off`. On: `--control-on` track, `--control-on-ink` thumb. Forced colours: on
   `Highlight` track, `HighlightText` thumb.
4. **States.** Hover: border or fill one step; pressed: thumb widens 4 px (iOS); disabled with the
   system: "On, set by your system" / "Açık, sistem ayarınızdan" under the label (L§7.6, A-17);
   busy (Lock while a save writes): thumb shows the activity glyph, input refused.
5. **Content and copy.** No On/Off words beside it; the label names the setting.
6. **Behaviour.** Click, tap, Space toggle; a drag of the thumb toggles past half; Enter does not
   toggle (form submit stays). Guard: none for settings; Lock is allowed while locked (unlocking)
   and asks the signed-file warning first (F§2.6). Announcement: native state change only.
7. **Motion.** Thumb on `--spring-press`; track fill cross-fades 120 ms; RM instant.
8. **Accessibility.** `role="switch"` `aria-checked`; label element wraps both; ring outset.
   A-3 (border 4.09 vs M5; on-fill 9.96), A-15, A-19.
9. **Implementation.** `ui/Switch.tsx` on Base UI `Switch`; `appearance-store` drops
   `glassPanels`/`reduceTransparency` (L§10.3). Tests: browser mode (system-forced disabled,
   drag past half, Lock calls `onPress` with warning hook).

## 8. Checkbox

1. **Role.** Independent options in forms and sheets: "Don't ask again for this file" (F§5.1),
   Save a copy sections, Batch steps, Find "Match case". Not for settings (Switch). Replaces 38
   native checkboxes. PDF form checkboxes on the page are content (05), not this.
2. **Anatomy.** `☐ Remove metadata` box 16 fine / 20 coarse, radius 4, row `--control-h`,
   label 13/18 (15/20); indeterminate `−`.
3. **Material and light.** Off: 1.5 px `--control-border`; on: `--control-on` fill with `check`
   (bold, 12/16) in `--control-on-ink`.
4. **States.** §2.3; error (required and empty): border `--danger` and a message below.
5. **Content and copy.** Caller's; a group label names the set.
6. **Behaviour.** Click on box or label, Space; group via `CheckboxGroup` with a parent box for
   select all. Guard: caller's.
7. **Motion.** *select* on the check (pop curve, 240 ms); RM instant.
8. **Accessibility.** `checkbox`, `aria-checked="mixed"` for indeterminate. A-3 (on-fill 9.96;
   border 4.09), A-15.
9. **Implementation.** `ui/Checkbox.tsx` on Base UI `Checkbox`, `CheckboxGroup`. Tests: browser
   mode (indeterminate parent, label click, keyboard).

## 9. Radio group

1. **Role.** One of a few options with descriptions: Save a copy Size (Same as original ·
   Smaller, with estimates, J13B), Batch outputs, Crop scope. Two to four short options use
   Segmented instead. Replaces 30 native radios.
2. **Anatomy.** `◉ Smaller   about 1.1 MB` circle 16 / 20, row `--control-h`, description line
   12/16 n10 under the label, estimate trailing in `tnum`.
3. **Material and light.** Off: `--control-border` ring; on: `--control-on` disc with a 6 / 8 px
   `--control-on-ink` centre.
4. **States.** §2.3; a disabled option keeps its reason as its description line.
5. **Content and copy.** Caller's.
6. **Behaviour.** APG: one tab stop, arrows move and choose. Guard: caller's.
7. **Motion.** Centre dot *select*; RM instant.
8. **Accessibility.** `radiogroup` with a name; description via `aria-describedby`. A-3, A-15.
9. **Implementation.** `ui/RadioGroup.tsx` on Base UI `RadioGroup`/`Radio`. Tests: browser mode.

## 10. Slider

1. **Role.** Continuous values: pen and highlighter width (J6, 03 MK-7), opacity, grid cell size
   S ─○─ L (F§6.3, 10), image quality, History scrubber on coarse (04§18). Replaces 15.2.3 Range.
2. **Anatomy.**

   ```
   fine   ━━━━━━○──────  1.5 pt     track 4, thumb 16, width ≥ 120, readout 13/18 tnum
   coarse ━━━━━━━━◯────────  1.5 pt  track 6, thumb 28 in 44 hit, width ≥ 160
   ```

   Optional detents (stops 6 · 12 · 24 · 48) as 2 px ticks; snap within 4 px.
3. **Material and light.** Track `--control-track`, fill `--control-range`, thumb n12 dark
   (3.97 vs the track, 7.90 vs M2) / n1 light with a 1 px `--control-border` ring (white alone
   is 1.53:1) and e1. Own-content lens on the thumb (G-9). Forced colours: native-like
   `Highlight` fill.
4. **States.** Hover: thumb ring one step; dragging: thumb scale 1.1 (fine) and the readout
   follows; disabled n8 track and thumb; error n/a.
5. **Content and copy.** Readout with unit, locale numerals: "1.5 pt" / "1,5 pt"; value text
   "{value} points" / "{value} punto".
6. **Behaviour.** Drag (pointer capture; a pen or finger moves 1:1), click on the track jumps;
   arrows ± step, Shift ×10, PageUp/PageDown ×10, Home/End. Live preview during drag;
   `onValueCommitted` on release makes one history step (03 MK-7). Guard: `targeted` when it
   edits a selection, none for a tool preset.
7. **Motion.** Thumb follows the pointer 1:1; a track click moves on `--spring-quick`; RM instant.
8. **Accessibility.** `slider` with `aria-valuetext`; name via the label. A-3, A-15.
9. **Implementation.** `ui/Slider.tsx` on Base UI `Slider` (`Track`, `Indicator`, `Thumb`,
   `Value`); deletes `ui/Range.tsx` (its `rangeFill` test moves to the detent maths). Tests: unit
   (snap, locale value text), browser mode (one commit per drag; keys).

## 11. Select and menu button

1. **Role.** **Select**: one value from a list too long for Segmented: Pages "All pages ▾",
   page-number format "Page 1 of N ▾" (J16), Ambient light Auto · Still · Off, OCR language.
   **Menu button**: opens actions (Shapes ▾, Sign ▾, More, Move to ▾). Replaces 17 native
   `<select>`s and private triggers.
2. **Anatomy.** `[ All pages        ▾ ]` field-like on M3–M5: `--control-fill`, radius 8,
   height `--control-h`, value 13/18, `caret-up-down` 16 trailing. Menu button = Button (any
   variant) plus `caret-down` 12/16.
3. **Material and light.** Trigger: no glass. Popup: 04's Menu primitive (M4, σ 12–24 by height);
   on compact the Select opens 04's action sheet with radio rows.
4. **States.** §2.3; open: trigger keeps `-pressed` fill; empty list: popup shows "No options" /
   "Seçenek yok" and the trigger is disabled with that reason.
5. **Content and copy.** Placeholder "Choose…" / "Seçin…"; values `tnum` where numeric.
6. **Behaviour.** Fine pointer: popup aligns the selected item over the trigger
   (`alignItemWithTrigger`); typeahead; Enter or Space opens; Esc closes and returns focus.
   Coarse and compact: action sheet. Guard: caller's.
7. **Motion.** *popup* (04); action sheet *sheet*.
8. **Accessibility.** Base UI Select `combobox`/`listbox` semantics; menu button
   `aria-haspopup="menu"`. A-13, A-15.
9. **Implementation.** `ui/Select.tsx` on Base UI `Select` (popup styled by `ui/Menu.module.css`
   from 04), `ui/MenuButton.tsx` on `Menu.Trigger`. Tests: browser mode (typeahead, compact sheet
   at 390 px, focus return).

## 12. Text field

1. **Role.** Free text: rename a file or section (F2), password (J8B), metadata, signature name,
   comment author, Save a copy file name. Replaces 4 text inputs, 5 textareas, password inputs.
2. **Anatomy.**

   ```
   Name                          label 12/16 550 n10 above (or leading in dense rows)
   [ report-small.pdf      (✕) ]  well --control-h, radius 8, pad 8/10, text --field-text
   Saves next to the original.   description 12/16 n10 · error replaces it in --danger
   ```

   Password: trailing `eye` / `eye-slash` IconButton. Multiline: min 3 rows, grows to 8, then
   scrolls in a §21 area.
3. **Material and light.** Opaque well (L§2.10): `--field-well`, 1 px `--control-border`
   (Issue 2). No glass, no light.
4. **States.** Hover: `--control-border-hover`; focus: inset ring, caret `--text-primary`;
   disabled: n8 text, border n7; read-only (locked fields elsewhere): no border, n10 text;
   error: `--danger` border (7.00 dark on n2, 6.00 light) + `x-circle` + message; required: "Required"
   / "Zorunlu" after the label.
5. **Content and copy.** "Show password" / "Parolayı göster", "Hide password" / "Parolayı
   gizle", "Optional" / "İsteğe bağlı". File names use `cv05` `cv08` (L§4.3).
6. **Behaviour.** Enter commits single-line fields (the surface's action); Esc restores the value
   once, then closes the surface; selection on focus for rename; `autocomplete`, `inputmode`,
   `enterkeyhint` per use; letters never trigger shortcuts while focused (F§3.3). Guard: caller's
   (rename a section → `document`).
7. **Motion.** None beyond the ring (L§9.2: the ring never animates); error message fades 120 ms.
8. **Accessibility.** Base UI `Field` (`Label`, `Description`, `Error`, `aria-invalid`,
   `aria-describedby`). A-3 (border 5.01 vs well), A-15, A-21 (no fixed widths).
9. **Implementation.** `ui/TextField.tsx`, `ui/TextArea.tsx` on `Field` + `Input`. Tests: browser
   mode (Esc ladder, error wiring, 16 px font under coarse emulation).

## 13. Search field

1. **Role.** Find (J15a, sidebar and top strip), ⌘K input, More sheet search, Library filter.
2. **Anatomy.** `[ ⌕ Find in document     3 / 12 (✕) ]` well as §12, `magnifying-glass` 16
   leading, count trailing `tnum` n10, clear IconButton (24 hit fine, 44 coarse) once non-empty.
   Top strip variant: 28 tall (01); compact: full width above the keyboard (F§6.9).
3. **Material and light.** As §12.
4. **States.** §12; searching: count shows the activity glyph after 400 ms; no results: count
   reads "No results" / "Sonuç yok" in n10, field unchanged (not an error).
5. **Content and copy.** Placeholder is the caller's ("Find in document" / "Belgede bul");
   "Clear search" / "Aramayı temizle"; count "3 of 12" spoken, "3 / 12" shown in both languages.
6. **Behaviour.** Typing searches after 150 ms; Enter / Shift+Enter step (Find's handlers); Esc
   clears, a second Esc leaves; `type="search"`, `enterkeyhint="search"`; Alt+Enter is Find's
   (F§3.4). Guard: none.
7. **Motion.** Clear button *replace* in; RM instant.
8. **Accessibility.** `searchbox`; count in a polite live region owned by Find. A-15.
9. **Implementation.** `ui/SearchField.tsx` on `Input`. Tests: browser mode (Esc ladder, clear
   returns focus to the input).

## 14. Number field

1. **Role.** Exact numbers: Go to page in the pill (J2, 01), From/To pages, Start at (J16),
   font size, margins, DPI. Replaces 9 native number inputs.
2. **Anatomy.** `[  3  ]−+` fine: well 28, value centred `tnum`, unit suffix n10 ("pt", "%"),
   steppers 24 × 14 stacked trailing; coarse: `( − )[ 3 ]( + )` 44 buttons beside a 56 px well.
3. **Material and light.** As §12; steppers quiet icon buttons (`minus`, `plus`).
4. **States.** §12; out of range on blur: clamps and shows "Enter a number from 1 to 12." / "1 ile
   12 arasında bir sayı girin." for 4 s under the field; at a bound the stepper is disabled with
   that reason.
5. **Content and copy.** "Increase" / "Artır", "Decrease" / "Azalt"; clamp announcement "Set to
   12." / "12 olarak ayarlandı."; locale numerals ("1,5" in Turkish; both separators accepted on
   input when unambiguous).
6. **Behaviour.** Up/Down ± step, Shift ×10, PageUp/PageDown, Home/End to bounds; wheel only while
   focused; Enter commits, Esc restores; scrub (drag on the label) on fine pointers. Guard:
   caller's (Start at → `document`, applied by the sheet's Apply).
7. **Motion.** None; stepped values change instantly (keys never animate, F§13.1).
8. **Accessibility.** Base UI NumberField (`spinbutton`, `aria-valuenow`, `aria-valuetext` with
   unit). A-15.
9. **Implementation.** `ui/NumberField.tsx` on `number-field` (`Group`, `Input`, `Increment`,
   `Decrement`, `ScrubArea`) with `locale={getLocale()}`. Tests: unit (parse "1,5" and "1.5" in
   TR), browser mode (clamp message, bounds disable steppers).

## 15. Keycaps

1. **Role.** Show shortcuts in menus, tooltips and the shortcut overlay (I-6, F§7.2). Replaces
   15.2.2.
2. **Anatomy.** `⌘ ⇧ S` caps 18 px high (20 coarse), min width 18, radius 4, caption 11/14 at 500
   with `case`, gap 2; tones `default` (n5 fill dark / n3 light), `quiet` (no fill), `onGlass`
   (`--control-fill`).
3. **Material and light.** None.
4. **States.** Static. Shown on fine pointers; on coarse only after a physical key press sets
   `[data-keys]` on the root for the session (L§6.2, M-2).
5. **Content and copy.** Platform glyphs on Apple (`⌘ ⌥ ⌃ ⇧ ⌫ ⎋ ↵`), words elsewhere: "Ctrl",
   "Alt", "Shift", "Enter", "Esc", "Tab", "Space" / "Boşluk"; letters upper-cased with
   `toLocaleUpperCase('en')` so `i` shows `I`, not `İ` (keys are Latin labels).
6. **Behaviour.** None.
7. **Motion.** None.
8. **Accessibility.** `aria-hidden`; controls carry `aria-keyshortcuts`. Contrast n11 on n5 7.72,
   on n3 light 8.82, `onGlass` over M4 worst 4.92 / 6.33. A-21 (upper-casing rule).
9. **Implementation.** `ui/Keycaps.tsx` keeps its API; `ui/input-modality.ts` (zustand: `last:
   'mouse' | 'touch' | 'pen' | 'keyboard'`, `hadKey`) sets `data-keys` and `data-input`. Tests:
   unit (formatting per platform, Turkish locale keeps `I`), browser mode (hidden under coarse
   until a key).

## 16. Swatch

1. **Role.** Pick an ink, highlighter tint, stamp or field colour (J6, 03 MK-7, 04 colour tier).
   Replaces 5 native colour inputs and private swatch rows.
2. **Anatomy.** Dot 14 px (fine) / 20 px (coarse) centred in a 32 / 44 target; custom swatch is a
   `palette` glyph opening the editor (03 MK-8).
3. **Material and light.** Content colour: `forced-color-adjust: none`, 1 px inner ring per 03§2.3
   (dark white 0.55, light ink 0.55).
4. **States.** Selected: 2 px n12 ring with a 2 px gap (L§1.9), never lime; hover: ring n10;
   focus: inset ring (the selection ring stays outside it).
5. **Content and copy.** Names from `palette.ts` (Black / Siyah …, 03 MK-7); "Custom colour" /
   "Özel renk".
6. **Behaviour.** A radio group: arrows move and choose; click sets. Guard: `targeted` with a
   selection, none for a preset.
7. **Motion.** Ring *select*; RM instant.
8. **Accessibility.** `radio` named by colour; the name is the only cue for screen readers.
   A-3 (selected ring 7.90 vs M2), A-19.
9. **Implementation.** `ui/Swatch.tsx`, `ui/SwatchGroup.tsx` on `radio-group`. Tests: browser
   mode; rendered-pixel ring over white and black.

## 17. Badge

1. **Role.** Counts and short status beside a label: Review counts, Find hits on the sidebar
   tab, "3" saved signatures, the unsaved dot ● on tabs (01), signature status (seal + word).
   Replaces SignatureBadge's shield span (14.5) and ad-hoc counts.
2. **Anatomy.** Count: capsule 16 fine / 20 coarse, min width 16, pad 5, caption 11/14 at 600
   `tnum`. Dot: 6 / 8 px. Status: glyph 12/16 + caption, no fill.
3. **Material and light.** `--badge-fill` (n12 on it 10.43 / 14.61); dot n12; status uses
   `--success`/`--warning`/`--danger` glyph plus words (L§1.6, A-19).
4. **States.** Changing counts pop (`--spring-pop`, MC-34); zero hides the count badge.
5. **Content and copy.** Caps at "99+"; status words from the caller ("Valid" / "Geçerli").
6. **Behaviour.** None; not focusable.
7. **Motion.** *success*-style pop on increase only; RM instant.
8. **Accessibility.** Count is part of the host's name ("Review, 3 items"); the badge is
   `aria-hidden`. A-19.
9. **Implementation.** `ui/Badge.tsx`. Tests: unit (99+), browser mode (`aria-hidden`).

## 18. Tag dot, tag and avatar

1. **Role.** Source identity for pages and documents: grid section heads "● report.pdf · 12"
   (F§6.8), Library cards, Combine sources; author avatars in Review and notes. Replaces the
   `[data-tag]` globals.
2. **Anatomy.** **Tag dot** 8 fine / 10 coarse. **Tag** = dot + name (no pill, L§1.6). **Dot
   stack** (a combined document's sources) up to 3 dots overlapping 4 px with a 2 px ring in the
   host surface colour, then "+2". **Avatar** 20 / 24 / 32 disc with one initial (11/14, 13/18,
   15/20 at 600).
3. **Material and light.** Dots `--tag-0…5` (dark ≥ 6.75 on n2, ≥ 4.35 vs M3 worst; light ≥ 4.43
   on n2, ≥ 3.23 vs M3 worst), `forced-color-adjust: none` with a `CanvasText` ring. Avatar: tag
   colour fill, ink letter dark (≥ 7.16) / white letter light (≥ 4.67).
4. **States.** Static; an avatar with no author shows `user` glyph.
5. **Content and copy.** "Unknown author" / "Bilinmeyen yazar". Initials with
   `toLocaleUpperCase(getLocale())` (L§4.4 r3).
6. **Behaviour.** None.
7. **Motion.** None.
8. **Accessibility.** Dots `aria-hidden`; the name carries meaning. Avatar `img` role named by the
   author, or hidden when the name is beside it. A-19, A-21.
9. **Implementation.** `ui/Tag.tsx` (`TagDot`, `Tag`, `DotStack`), `ui/Avatar.tsx` on Base UI
   `Avatar` (`Fallback`). Tests: unit (tag index from `documentOrder` is stable), browser mode.

## 19. Focus ring

1. **Role.** Keyboard focus everywhere (A-11). Replaces 15.2.11 and the nine offset cases of
   DESIGN §5.
2. **Anatomy.** From the element out: ink 2 · lime 2 · ink 2 (L§9.2). Three forms:

   | Form | CSS | Replaces (DESIGN §5 cases) |
   |---|---|---|
   | `outset` (default) | `outline: 2px solid var(--focus-light); outline-offset: var(--focus-offset-out)` (2 px) + `box-shadow: 0 0 0 6px var(--focus-dark), var(--shadow-own)` | Buttons on solid, armed tool, cards, switches |
   | `inset` | `outline-offset: var(--focus-offset-in)` (−2 px) + `box-shadow: inset 0 0 0 4px var(--focus-dark), var(--shadow-own)` | Rows in scrollers, menu items, inputs (0, −1), segments, presets, hotspots (1), swatches, page layers, capsule chips (−2) |
   | `gap` | `outline-offset: var(--focus-offset-gap)` (4 px) + 8 px halo | Thumbnails (3), grid cells (4), anything with its own selection ring |

   Applied by `data-focus="inset|gap"` on the element, by `.capsule` and `.mat` descendants
   (inset automatically) and by `composes: focus-inset from global` in modules.
3. **Material and light.** Never glows, never animates (L§6.3 S-5). Forced colours: `outline:
   2px solid Highlight`, shadow dropped. `prefers-contrast: more`: outline 3 px (A-18).
4. **States.** Shown only on `:focus-visible`; `--shadow-own` keeps the host's shadow.
5. **Content and copy.** None.
6. **Behaviour.** Follows `:focus-visible` heuristics; programmatic focus after a keyboard action
   shows it (Base UI `focus-visible` polyfill not needed).
7. **Motion.** None (L§9.2).
8. **Accessibility.** Bands 16.42:1; worst best-band 4.07:1 over 20 backdrops (L§9.2). A-11,
   A-12 (`scroll-padding` keeps it clear of chrome, §21).
9. **Implementation.** `styles/focus.css` (imported by `global.css`): the three forms and
   tokens; deletes `--focus-ring`, keeps `--focus-offset` as an alias until step 11 (§32). A
   source scan (`styles/focus-scan.test.ts`) fails on a literal `outline-offset` inside a
   `:focus-visible` rule in any module. Tests: rendered-pixel bands over white, the select blue,
   lime fill and both canvases (four projects); axe `focus-order` in the gallery.

## 20. Tooltip primitive

1. **Role.** Names, keys and reasons (I-6, RA-21). Copy, delays, touch long press and the reason
   rule are 04§20; this section owns the primitive. Replaces 8.21's internals.
2. **Anatomy.** Per 04§20: 26 / 28 px, padding 4 / 8, max 280 px, keycaps §15.
3. **Material and light.** Solid `--surface-raised` (n4 dark, n1 light) with the M4 rim and e2
   (L§2.10, G-29); class `.mat-tooltip` (solid only, no filter, no σ entry).
4. **States.** Warm group (400 ms) shared app-wide through one `Tooltip.Provider` in `app.tsx`.
5. **Content and copy.** 04§20.
6. **Behaviour.** Hoverable, dismissible with Esc that passes on (A-24); touch path through
   `motion/gesture` long press (§31); suppressed while a drag or stroke runs.
7. **Motion.** *tooltip* (opacity + `scale(0.98)`, `--duration-fast`); RM fade.
8. **Accessibility.** 04§20. A-24.
9. **Implementation.** `ui/Tooltip.tsx` (props `label`, `shortcut`, `reason`, `side`), keycap
   visibility from `input-modality`. Tests as 04§20.

## 21. Scroll area

1. **Role.** Every scroller in chrome: sidebar lists, menus over 8 rows, sheets, the shortcut
   overlay, Recents. Not the stage (05 owns page scrolling).
2. **Anatomy.** Native scrolling viewport; overlay scrollbar 6 px fine (10 on hover), inset 2,
   thumb radius capsule; on coarse the bar shows only while scrolling. Soft edges: a 12 px
   `mask-image` fade where content continues (G-19), toggled by `data-overflow-top|bottom`.
3. **Material and light.** Thumb `--scroll-thumb` (3.33 dark, 3.09 light vs M3 worst); no track
   fill. Forced colours: native scrollbars (`scrollbar-color: auto`).
4. **States.** Thumb hover one step; dragging `--control-on` at 0.6.
5. **Content and copy.** None.
6. **Behaviour.** `overscroll-behavior: contain` (M-23); `scroll-padding` from the free
   rectangle: `var(--free-top) var(--free-end) var(--free-bottom) var(--free-start)` published by
   01's F1 on the stage and sidebar; keyboard scrolling native; virtualised lists (TanStack)
   pass the viewport ref.
7. **Motion.** Scrollbar fades 120 ms; *scroll-to* is the browser's.
8. **Accessibility.** Viewport focusable only when it has no focusable child (Base UI default);
   A-12, A-15 (thumb hit 24 / 44 when draggable).
9. **Implementation.** `ui/ScrollArea.tsx` on Base UI `ScrollArea`; the global `*
   { scrollbar-width: thin }` rule stays as the fallback. Tests: browser mode (edge attributes,
   `scroll-padding` from `--free-*`).

## 22. Empty note

1. **Role.** Two quiet lines inside a panel or popover with nothing to show: "No comments, marks
   or fields" (F§9.4), "No matches in report.pdf". Replaces 15.2.6 `shell/EmptyNote.tsx`. Large
   empty states (Library launcher) are 02's.
2. **Anatomy.** Title 13/18 at 550 n12, line 12/16 n10, optional quiet button; centred, max
   width 280; optional 32 px duotone glyph (I-3).
3. **Material and light.** None; never the aurora (L§3.2).
4. **States.** Static.
5. **Content and copy.** Caller's, one sentence that says what to do (X-7).
6. **Behaviour.** The button acts (e.g. "Recognize text…").
7. **Motion.** Fades in 120 ms.
8. **Accessibility.** `role="status"` only when it replaces results after a search. A-1.
9. **Implementation.** Move to `ui/EmptyNote.tsx`. Tests: existing.

## 23. Resize handle

1. **Role.** Resize the docked sidebar and Compare's Changes column. Replaces 15.2.4.
2. **Anatomy.** 8 px wide hit strip (16 coarse) on the divider; 2 × 24 px grip shown on hover or
   focus.
3. **Material and light.** Grip `--control-border`; no glass.
4. **States.** Hover/drag: divider `--accent-line`; focus: inset ring on the grip.
5. **Content and copy.** "Resize sidebar" / "Kenar çubuğunu yeniden boyutlandır" (accessible name).
6. **Behaviour.** APG window splitter: arrows 16 px, Home/End to min/max, Enter collapses;
   pointer drag 1:1; `touch-action: none`. Hidden on compact (no docked panels).
7. **Motion.** The panel follows 1:1; release has no momentum (MP-8 layout once at rest).
8. **Accessibility.** `separator` with `aria-valuenow` (px). A-15.
9. **Implementation.** `ui/ResizeHandle.tsx` keeps its logic; uses the gesture core's drag
   (§31). Tests: existing plus coarse width.

## 24. Progress bar and activity glyph

1. **Role.** Determinate progress inside sheets (export, OCR, batch results, 14.7) and the
   activity glyph used by busy buttons, fields and counts. Toasts and the progress capsule are
   the feedback family's.
2. **Anatomy.** Bar 4 px, radius capsule, full width of its container, label above "Exporting…
   40 %" (`tnum`). Activity glyph: 16 / 20 px `circle-notch` rotating, shown only after 400 ms
   (MC-33).
3. **Material and light.** Track `--control-track`, fill n12 (not lime: progress is not the
   primary action). The processing ring (L§3.3) belongs to capsules, not bars.
4. **States.** Indeterminate: a 30 % segment sweeping; RM: opacity pulse 1.6 s (L§7.5); done:
   *success* check replaces the glyph.
5. **Content and copy.** "Exporting… 40 %" / "Dışa aktarılıyor… %40" (Turkish puts % first, no space).
6. **Behaviour.** Updates no faster than every 200 ms.
7. **Motion.** *progress* (`scaleX`, 200 ms `--ease-standard`); glyph rotation 0.8 s linear.
8. **Accessibility.** Base UI `Progress` (`progressbar`, `aria-valuetext` "40 percent" / "yüzde
   40"). A-9.
9. **Implementation.** `ui/Progress.tsx`, `ui/Activity.tsx`. Tests: browser mode (400 ms delay,
   RM pulse).

## 25. `tokens.css`: structure, names, both themes

One file imported by the app and the test (L§10.1). Three layers; components may read only
layers 2 and 3 (source scan, §27).

| § | Block | Layer | Names (new or renamed) |
|---|---|---|---|
| 1a | `:root, [data-theme='dark']` raw | 1 | `--n1…--n12`, `--lime-50…950`, `--aurora-{teal,mint,lime,lemon}`, `--tag-0…5`, `--danger-raw`, `--warning-raw`, `--success-raw` |
| 1b | same, semantic | 2 | `--canvas`, `--surface-{frame,raised,sunken,on,hover,active}`, `--scrim`; `--border-{hairline,strong}`; `--text-{primary,secondary,tertiary,disabled}`, `--glass-text-{secondary,disabled}`; L§1.4 interaction names; `--page-background`, `--page-shadow`, `--select`, `--select-wash`, `--select-wash-strong`; `--danger`, `--warning`, `--success` and `--glass-*` variants; `--light-cap-under-glass`, `--light-home-rest`; `--glass-{chip,bar,panel,menu,sheet,lit}-{alpha,tint,filter,solid,shadow}`; `--rim-{edge,top,bottom,inner}`; `--e0…--e5` |
| 1c | same, control | 3 | §2.2 table; `--focus-light`, `--focus-dark` |
| 2 | `[data-theme='light']` and `@media (prefers-color-scheme: light) { :root:not([data-theme]) }` | 1–3 | Same names, light values; the test keeps both blocks identical |
| 3 | `:root` theme-free | 2–3 | `--font-ui`, `--type-{caption,footnote,body,callout,title3,title2,title1,display}` (+ `-lh`, `-wt`, `--track-*`), `--radius-{page,xs,sm,md,lg,xl,2xl,capsule}`, `--space-{2…64}`, §2.1 density, `--focus-offset-{out,in,gap}`, motion tokens (L§7.2) |
| 4 | `@media (pointer: coarse), (any-pointer: coarse)` | 3 | Coarse type, §2.1 density, σ caps |
| 5 | Settings | 2 | `[data-glass='tinted']` (text-bearing alphas 0.90), `[data-glass='solid']` ≡ `@media (prefers-reduced-transparency: reduce)`, `[data-motion='reduced']` ≡ `@media (prefers-reduced-motion: reduce)`, `@media (prefers-contrast: more)` (strong border 0.36, tertiary → n10, focus 3 px, no shadow), `[data-light='off'|'still']` |
| 6 | `@media (forced-colors: active)` | 2–3 | System colours; `--glass-*-filter: none` |
| 7 | `@media (color-gamut: p3)` | 1 | P3 aurora stops for the CSS fallback |
| 8 | Aliases (deleted at migration step 11) | — | `--surface-0…3`, `--text-xs…lg`, `--radius-1…3`, `--radius-round`, `--accent-highlight*`, `--glass`, `--glass-filter`, `--glass-frame*`, `--glass-menu*`, `--elevation-float`, `--focus-ring`, `--font-sans`, `--font-mono` |

Root attributes, set by `appearance-store` (`theme`, `glass`, `light`, `motion`, `haptics`, with
a one-time migration of `glassPanels` and `reduceTransparency`): `data-theme` (absent for
System), `data-glass`, `data-light`, `data-motion`, plus `data-input` and `data-keys` from
`input-modality`. `index.html` gets `<meta name="theme-color">` per scheme (`#08090c`,
`#e6e8eb`). Today's usages to move: 323 `--text-*`, 213 `--radius-1…3`, 97 `--surface-*`, 147
`--accent*`, 42 `--control-height` (aliases make each move optional until step 11).

## 26. Glass tier classes (`materials.css`)

```css
.mat            /* base: solid token, rim edge, inner light, shadow, lit rim ::before (L§2.3) */
.mat-chip  .mat-bar  .mat-panel  .mat-menu  .mat-sheet  .mat-lit   /* tier tokens */
.mat-docked     /* M3 docked: free-edge rim, hairline, no shadow (L§2.4) */
.mat-tooltip    /* solid tooltip surface with the M4 rim, e2 */
.s5 .s6 .s7 .s8 .s9 .s10 .s12 .s16 .s20 .s24 .s40 .s48   /* σ steps; literal filter per tier × σ */
.lens           /* added by script on Chromium for registered fixed-size surfaces (L§2.7) */
```

- Only tier × σ pairs present in the coverage registry (§27) are emitted, prefixed and
  unprefixed with equal literals, generated by `tools/materials/generate.ts` from the registry
  and the tier tokens, so CSS and test cannot drift. Light-theme rules use the `contrast()`
  chain. Solid, reduced transparency and more contrast reset both filter lines to `none`; Tinted
  only swaps alphas.
- Inside any `.mat`: text remaps (L§2.3); `SurfaceTier` context for §3's fallback. A React host
  `ui/Surface.tsx` (`<Surface tier="bar" sigma={9} as="div">`) sets class, context and
  `data-tier`; lint forbids hand-written `.mat-*` class strings outside it.
- `.mat-lit` is rejected in `stage/`, `viewer/`, `pages/` modules (source scan, L§10.2).
- Removes `.glass`, `.glass-menu`, `.glass-frame` and their 19 `composes:` sites.

## 27. `tokens.test.ts` changes

| Area | Change |
|---|---|
| Parsing | Both theme blocks and every settings block; the light media block equals `[data-theme='light']`; Solid equals reduced transparency; reduced-motion attribute equals the media block |
| Model | Filter chains in order with `contrast()`; ±1/255 rounding (`styles/glass-model.ts`, shared with the harness) |
| Coverage term | `styles/coverage-registry.ts`: `{ id, tier, minW, minH, sigma, owner }[]`, extended by each family (01 dock and strip, 03 palette and rail, 04 bars incl. the 56 px phone bar and σ 12 menus, 02 cards, this spec's M1 chips). Asserts `erf(h/2√2σ)·erf(w/2√2σ) ≥ 0.985` per entry and that `materials.css` holds `.mat-<tier>.s<σ>` with equal prefixed and unprefixed values |
| APCA | `styles/apca.ts` (0.0.98G constants of apca-w3 0.1.9): primary text \|Lc\| ≥ 75 fails; secondary < 60 is written to `apca-warnings.snap`, so a new warning shows in review without failing |
| Pairs | Every pair of L§1.7, §2.2, §2.6 and this spec's §2.2 table with its minimum: control fill 7.55 (M4), danger on fill 4.84, control border 3.61, on-fill 7.90, scroll thumb 3.09, range fill 3.25, tag dots 3.23, keycaps `onGlass` 4.92 |
| Focus | Bands ≥ 9:1; best band ≥ 3:1 over the 20 backdrops of L§9.2 |
| Source scans | No raw layer-1 token in modules; no literal `outline-offset` in focus rules; no `.secondary` or `.primary-button`; no `.mat-lit` in page modules; no argument-less `toLocaleUpperCase` (A-21) |
| Retired | 1.27:1 bar-to-canvas floor, single `--elevation-float`, periwinkle minima, tier-1/2/3 constants |

## 28. Rendered-pixel harness

- **Page.** `apps/web/harness/index.html` + `harness/main.tsx`, built by a separate Vite config
  (`apps/web/harness/vite.config.ts`) and served on its own port by Playwright's `webServer`, so
  the app that Playwright tests is byte-identical to the deploy build (spec 09.11, changed from a
  second entry in the app's config; Issue 11); never in the service-worker precache. Query `?tier=bar&sigma=9&theme=dark&glass=clear&
  backdrop=white` renders one surface over a full-viewport backdrop: `white`, `black`, `canvas`,
  `grey`, `lime-035`, `lemon-06`, `field-cap`, `page-text`; `?gallery` renders every primitive in
  every state for axe and focus checks.
- **Sampling.** `e2e/support/pixels.ts`: full-viewport screenshot (clipped ones skip backdrop
  filters, L§10.2), 4 × 4 median at a text-free point, compare to `glass-model.ts` within ±2/255;
  an edge sample 4 px inside each side must sit within ±4/255 of the centre (catches the leak the
  coverage term predicts); text contrast computed from the token colour and the sampled composite.
- **Specs.** `e2e/glass-pixels.spec.ts` (every registry entry × both themes × Clear, Tinted, Solid;
  focus bands; control borders and thumbs of §2.2; page-corner light check, A-6), with
  `e2e/motion.spec.ts` and the a11y matrix of L§10.2.
- **Projects.** `chromium`, `firefox`, `webkit`, and `chromium-nogpu` (`--disable-gpu-compositing`),
  added to `playwright.config.ts`; pixel specs tagged `@pixels` so local runs can skip them.

## 29. Font pipeline: `'Inter Recto'`

| Step | Tool | Output |
|---|---|---|
| Source | devDependency `inter-ui` 4.1.1 (`InterVariable.ttf`, opsz + wght) | — |
| Axis cut | `fonttools varLib.instancer opsz=14:32 wght=100:900` | temp TTF |
| Subset | `pyftsubset` with L§4.1's two Unicode sets (+ U+21B5 ↵, U+21E5 ⇥; Issue 12) and features `kern mark mkmk ccmp locl calt case tnum pnum frac cv05 cv08 ss03 zero`, `--flavor=woff2`, `--name-IDs=` private family `Inter Recto` | `public/fonts/inter-recto-latin.woff2` (≈ 73.4 KB), `-latin-ext.woff2` (≈ 24.6 KB), committed |
| Fallback | `tools/fonts/fallback.py`: `size-adjust`, `ascent-/descent-/line-gap-override` against Arial, Helvetica Neue, Roboto | `styles/fonts.css` `'Inter Recto Fallback'` faces |
| Pins | `tools/fonts/requirements.txt` (fonttools, brotli), `SHA256SUMS` | — |

`tools/fonts/subset.sh` runs all steps; `pnpm fonts:check` (CI job with Python) re-runs it and
compares checksums. `index.html` preloads the Latin file; `font-display: swap`; `font-src
'self'` unchanged; `vite.config.ts` precaches both files. A unit test
(`tools/fonts/coverage.test.ts`, fontkit) asserts every character in `messages/en.json` and
`tr.json` plus the keycap set is in the union, and the pair ≤ 100 KB. Removed:
`@fontsource-variable/inter` (import in `main.tsx`), `@fontsource-variable/jetbrains-mono` and
its two faces; 22 `--font-mono` uses in 18 modules become `--font-ui` with the `.technical`
class (`tnum`, `zero`, `cv05`, `cv08`).

## 30. Icon pipeline: Phosphor at build time

- **Inputs.** devDependency `@phosphor-icons/core` 2.1.1; `tools/icons/manifest.json` mapping app
  names to sources (`"undo": "arrow-u-up-left"`, `"redact": "custom:redact"`), with flags
  `fill` (needs the fill twin) and `duotone` (32/48 empty states); `tools/icons/custom/*.svg` on
  the 256 grid with fill twins (I-7: redact, edit-text, compare, combine, page-furniture, recto);
  `tools/icons/offsets.json` per-icon half-pixel nudges set at 2× (I-5).
- **Generator.** `tools/icons/generate.ts` reads `assets/regular/<n>.svg`, `assets/fill/<n>-fill.svg`,
  `assets/duotone/<n>-duotone.svg`, keeps path data only, fails on a missing name or twin, and
  writes `apps/web/src/ui/icons.generated.tsx`: `export const ICONS = { undo: { r, f }, … } as
  const; export type IconName = keyof typeof ICONS`. About 90 icons, ≈ 18 KB gzip (L§5.1).
- **Component.** `ui/Icon.tsx`: `<Icon name size={16|20|24|32|48} filled? label? />` →
  `<svg viewBox="0 0 256 256" fill="currentColor">`; `aria-hidden` unless `label`; whole-pixel
  box; fill swap on `filled` through *select*.
- **Checks.** `pnpm icons` regenerates; `pnpm icons:check` in CI diffs the output; ESLint
  `no-restricted-imports` for `lucide-react` and `@phosphor-icons/react`.
- **Lucide removal.** 97 names in 59 files. (1) Generate the manifest with every L§5.2 mapping
  plus the rest of today's names; (2) each family rebuild replaces its imports; (3)
  `tools/icons/codemod-lucide.ts` rewrites what remains (`<X size={16} />` → `<Icon name="x"
  size={16} />`); (4) remove the dependency and enable the lint rule. Names beyond L§5.2 (e.g.
  `caret-up-down`, `circle-notch`, `eye`, `palette`, `user`, `x-circle`, `minus`) are checked by
  the generator at step 1 (Issue 13).

## 31. Engine APIs: `light/`, `motion/`, `motion/gesture/`

**Aurora (`apps/web/src/light/`, ≤ 4 KB gzip, lazy).** Used by 02 (Library, drop overlay), 03
(none: the under-light is CSS), feedback (ring, bloom), About.

```ts
// light/field.ts
export interface Lobe { x: number; y: number; gain: number; radius: number } // 0–1 of the field
export interface FieldOptions {
  lobes: readonly Lobe[]; rest: number;            // intensity I at rest (0.40 / 0.45)
  cap?: number;                                    // --light-cap-under-glass (0.6)
  textSafe?: () => readonly DOMRect[];             // keep Y ≤ 0.026 under text (A-5)
  scale?: 8 | 4;                                   // backing store 1/8, About 1/4
}
export type LightEvent = 'arrival' | 'dragenter' | 'dragleave' | 'drop' | 'success' | 'drift';
export interface LightField {
  readonly backend: 'webgl' | 'css' | 'off';
  setLobes(lobes: readonly Lobe[]): void;
  emit(event: LightEvent): void;                   // L§3.3 springs
  follow(point: { x: number; y: number } | null): void; // drag-over lobe
  pause(reason: string): () => void;               // returns resume; AU-14 pauses stack
  destroy(): void;
}
export function createField(canvas: HTMLCanvasElement, o: FieldOptions): LightField;
// light/LightField.tsx: <LightField lobes rest textSafe /> (aria-hidden, pointer-events none)
// light/mode.ts: useLightMode() → 'auto' | 'still' | 'off' from the setting, OS prefs, gates
// light/gates.ts: Compute Pressure, battery, low-end heuristic, frame watchdog (L§3.5)
// light/ring.tsx: <ProcessingRing active bloom /> CSS conic ring (L§3.3), static rim when Off
```

**Motion (`apps/web/src/motion/`, < 3 KB gzip).**

```ts
export const springs: Record<'press'|'quick'|'smooth'|'glide'|'fling'|'pop'|'track',
  { stiffness: number; damping: number }>;          // L§7.1, mass 1
export function animate(el: Element, prop: 'transform'|'opacity'|'clip-path',
  from: string, to: string, o: { spring: keyof typeof springs; velocity?: number }): Motion;
export interface Motion { retarget(to: string, velocity?: number): void;
  stop(): { value: number; velocity: number }; finished: Promise<void> }
export function flip(els: Element[], mutate: () => void, o?: { spring?: keyof typeof springs }): void;
export function velocityTracker(windowMs = 100): { add(t: number, x: number, y: number): void;
  velocity(): { x: number; y: number } };
export function project(v0: number, velocity: number, decay = 0.998): number;
export function rubberBand(overshoot: number, size: number, c = 0.55): number;
export function reducedMotion(): boolean;          // OS query or data-motion; the only source (A-9)
export function viewTransition(update: () => void): Promise<void>; // flushSync, 240 ms, skip on RM
```

**Gesture core (`apps/web/src/motion/gesture/`).** Generic recognisers on Pointer Events with
F§7.1's thresholds as one constant set; hit-testing stays in the consumers
(`viewer/gestures/long-press.ts` of 04, `viewer/gesture.ts` pinch of 05; Issue 6).

```ts
export const GESTURE = { longPressMs: 450, slopPx: 10, doubleTapMs: 300, doubleTapPx: 24,
  multiTapMs: 150, multiTapPx: 12, penQuietMs: 500, mouseDragPx: 4,
  edge: { side: 24, bottom: 34, top: 44 } } as const;  // M-20, M-22
export function useLongPress(ref, o: { onFire(e: PointerEvent): void;
  types?: ('touch'|'pen')[]; shouldStart?(e: PointerEvent): boolean }): void;
export function useDragLift(ref, o: { lift: 'distance' | 'hold';  // mouse 4 px; touch/pen 450 ms
  onLift(e): void; onMove(e, v: { x: number; y: number }): void;
  onDrop(e, velocity): void; onCancel(): void }): void;
export function useTaps(ref, o: { onTap?(e): void; onDoubleTap?(e): void }): void;
export function useMultiFingerTap(ref, o: { enabled: boolean; onTwo(): void; onThree(): void }): void;
export function usePinch(ref, o: { onStart(origin): void; onChange(scale: number, origin): void;
  onEnd(scale: number, velocity: number): void }): void; // pointer pairs + Safari gesture events
export function haptic(kind: 'lift' | 'snap' | 'drop'): void; // Android vibrate(8–12), setting on
```

Rules: a second pointer cancels long press and taps; a pen within `penQuietMs` cancels finger
multi-taps; recognisers never `preventDefault` a scroll they did not claim; swipes refused inside
the edge bands. Tests: unit with synthetic pointer streams (thresholds, cancellation, velocity),
browser mode via CDP touch for long press and pinch, `motion.spec.ts` zero layouts during a
drag.

## 32. Migration order

Follows L§10.4; each step ships alone and keeps today's layout.

| Step | What | Files | Proof |
|---|---|---|---|
| 1 | Two-band ring in `global.css` and `focus.css`; `--focus-offset-{out,in,gap}`; `--select` on the page | 2 | Rendered bands; a11y spec |
| 2 | Token skeleton with §25 aliases; `controls.css` globals `.btn*`, `.focus-inset`, `.focus-gap` | 3 | `tokens.test.ts` parses both themes |
| 3 | **`.secondary` → `composes: btn btn-standard from global`** in all 12 modules at once (identical rules today): `home/HomeView`, `tools/ToolDialog` (both have `:disabled`, so they prove the disabled state first), `export/ExportDialog`, `shell/PasswordDialog`, `annotations/SignatureDialog`, `signatures/Signatures`, `document/DocumentTools`, `pwa/UpdateToast`, `viewer/GoToPageDialog`, `viewer/LinkLayer`, `annotations/AnnotationLayer`, `shell/OutlinePanel`; `.primary` (15) → `btn btn-prominent`; FurnitureDialogs `.danger` → `btn btn-danger` | 28 | Source scan: no `^\.secondary` rule body; screenshots of the four Home and dialog baselines |
| 4 | **`outline-offset` codemod** in focus rules (67): `-2px` (25), `0` (12), `1px` (16), `-1px` (1) → `focus-inset`; `var(--focus-offset)` (10), `2px` (5) → deleted (default); `3px`, `4px`, `calc(var(--focus-offset) + 6px)` (6) → `focus-gap`; two `calc(-1 * …)` by hand. Order: `ui/` (Range, RadioChips), glass bars (FloatingToolbar, PenBar, StyleControls, ReadSelectionBar, Lasso, ImageObjects), scrolling lists (LeftRail, SearchPanel, CommentsPanel, FormsPanel, RedactionsPanel, OutlinePanel, FileRow, ChangesPanel), page layers (ReadView, FormLayer, CreatedFields, LinkLayer, TextEdit, ParagraphEditor), ArrangeView, dialogs, then Stage, TabBar, HomeView, CompareView, PrivacyIndicator, EmptyState. The 10 non-focus outlines (selection and current rings) are re-coloured to `--select` or `--accent-line` by their families | 44 | `focus-scan.test.ts`; a11y spec per region |
| 5 | Type: `'Inter Recto'`, scale tokens, `.technical` replaces mono | ~40 | Font coverage test; layout snapshot unchanged ± 1 px |
| 6 | Materials: `materials.css`, `ui/Surface`, Glass and Reduce motion settings, cost ladder; `.glass*` removed | 19 + 3 | Pixel harness on |
| 7 | Motion tokens on the module's core (the core itself lands earlier, with the first sheets and toasts: spec D0-12); per-file `matchMedia` reduced-motion checks (3) removed | 4 | Animation sweep |
| 8 | Primitives §3–§24 replace native inputs family by family (D0 sheets first, F§12) | per family | Browser-mode suites |
| 9 | Colour after ADR-0023; light theme; icons and Lucide removal (§30) | — | Pixel matrix in both themes |
| 10 | Light and refraction | `light/` | `motion.spec.ts` |
| 11 | Delete §25 aliases, `@fontsource-*`, `lucide-react`, `--focus-offset` | — | Source scans strict |

## 33. Removed and re-homed

| Today | Fate |
|---|---|
| `.primary-button`, 12 `.secondary`, `.danger` | `ui/Button` (§3) |
| `.glass`, `.glass-menu`, `.glass-frame`, `--elevation-float` | `materials.css`, `--e0…--e5` (§26) |
| `ui/Range.tsx` | `ui/Slider` (§10) |
| `shell/panels/RadioChips.tsx`, `shell/EmptyNote.tsx` | `ui/Chip` (§5), `ui/EmptyNote` (§22) |
| `ui/Menu.module.css`, `ui/Popover.module.css` | 04§12, §15 |
| Native `<select>`, checkbox, radio, number, colour, range, search | §6–§16 |
| "Glass panels", "Reduce transparency" switches | Glass Clear · Tinted · Solid (Segmented, F§9.5) |
| `fonts.css` JetBrains Mono faces, `--font-mono` | `'Inter Recto'` + `.technical` (§29) |
| `lucide-react`, `LucideIcon` types | `ui/Icon`, `IconName` (§30) |
| Global `prefers-reduced-motion` `!important` rule | Token-level reduction (L§7.5) and `motion/reducedMotion()` |

## 34. Issues for the lead

1. **Neutral on-states.** L§1.1 lists "on states" under lime; L§0.1 p3 allows one lime fill per
   view. A sheet with three checked boxes, a switch and a lime Save copy would show five.
   Decided: switch, checkbox, radio, chip and segmented use `--control-on` (n12, ≥ 7.90:1 against
   every surface); lime stays with the prominent button, the armed tool, the focus band, the range
   fill and current rows. L§1.1 should say "on states of tools".
2. **`--control-border`.** L§2.10 gives text wells `--border-strong` (white 0.16): 1.59:1 to the
   well, and the well vs M5 over white is 1.55:1, so the field boundary fails 1.4.11. Decided: a
   new `--control-border` (white 0.48 / ink 0.55, 3.61–5.01:1) for fields, boxes, radios, switch
   tracks and thumbs on light glass.
3. **Filled buttons only on M3–M5 and solid.** On M2 a 0.08 fill puts n12 at 6.24:1 (A-1 wants
   ≥ 7 at rest) and dark danger at 4.00:1. Decided: on M1/M2 every button is quiet; danger hover
   never deepens a fill (0.12 gives 4.27–4.40). L§2.6 could state it for buttons.
4. **Sheet and Toast.** F§10 lists them under 15.2 Primitives; this task's scope does not.
   Assumed owned by the dialogs (12) and feedback (14) specs; this spec gives them Button,
   ScrollArea, Progress, focus forms and `ui/Surface`. Confirm an owner exists.
5. **Tooltip ownership.** 04§20 specifies copy and behaviour; this spec owns only `ui/Tooltip`
   internals (provider, `.mat-tooltip`, modality). Keep 04 as the source for strings.
6. **Gesture core home.** 02 says `motion/` core, 04 `viewer/gestures/long-press.ts`, 05
   `viewer/gesture.ts`. Decided: recognisers and thresholds in `motion/gesture/`; the viewer files
   add hit-testing only.
7. **Counts re-checked.** `outline-offset`: 77 declarations in 44 files (67 in focus rules), not
   65; `.secondary`: 12 modules, confirmed identical; native controls: 129 `<input>`, 17
   `<select>`, 5 `<textarea>`; Lucide: 97 names in 59 files.
8. **Segmented thumb boundary.** A wash thumb is 1.65:1 against its track; the 1 px
   `--control-border` ring is added. A taste check on the prototype may prefer an n12 thumb.
9. **Light slider and switch thumbs.** White on light M2 is 1.53:1; both get the control ring.
10. **Coverage registry entries this spec adds:** M1 floating icon buttons 32–44 (σ 5–8). The
    harness reads the registry, so families must add every glass size they render.
11. **Harness in the e2e build.** `RECTO_HARNESS=1` adds a second entry to the build Playwright
    tests, so it differs from the deploy build by one unlinked page. Accept, or build the harness
    in a separate `vite build --config harness.config.ts` step.
12. **Keycap glyphs.** L§4.1's subset lacks ↵ (U+21B5) and ⇥ (U+21E5), which Apple keycaps use.
    Decided: add both (≈ 0.2 KB *(judgement)*).
13. **Unverified Phosphor names.** `@phosphor-icons/core` is not installed and no web search was
    allowed; names outside L§5.2 are proposals the generator checks at step 1.

## 35. Open questions

1. Prominent light theme: lime label on ink (14.79:1, L§1.4) reads as brand; is white on ink
   calmer for confirmations? Taste check on the prototype.
2. Should keycaps stay visible on coarse for the whole device once a hardware keyboard is used
   (iPad with a keyboard), not just the session?
3. Coarse switch at 52 × 32 or iOS's 51 × 31: kept on the 4 px grid (52 × 32).
4. Number-field scrub on the label: useful for margins and sizes, surprising elsewhere? Enabled
   only where the caller asks.
