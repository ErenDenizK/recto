---
title: "M9 component spec 03: dock morph, Markup palette and tools"
date: 2026-10-04
status: proposed
---

> Wave 2 component spec. Binding inputs: [`flows.md`](../flows.md) (§2.4–§2.6 state and guard,
> §3 input rules, §4.2–§4.3 dock and palette, §4.7 depths, §6 size classes, §7 keys, §13) and
> [`language.md`](../language.md) (§1.4 lime, §1.9, §2 glass, §3.2–§3.3 under-light, §5 icons,
> §6 shape, §7 motion, §9 accessibility). Evidence: [`inventory.md`](../inventory.md) §7 (7.1–7.16)
> and §8.7–8.9, 9.4, 9.15, 12.7; code on `develop` (`shell/FloatingToolbar*.ts(x)`,
> `annotations/pen/PenBar.tsx`, `annotations/pen/presets.ts`, `annotations/palette.ts`,
> `annotations/tools.ts`, `viewer/tool-store.ts`, `state/edit-policy-store.ts`); ADR-0021;
> research 15 (RA-*), 18 (MC-*), 19 (M-*), 20 (I-*), 22 (A-*). No web search was used.
> **(judgement)** marks unmeasured choices.

# Dock morph, Markup palette and tools

## 0. Summary

- **One glass shape, many contents.** The dock, the Markup palette, the preset strip and the
  Locked state are one M2 element (MK-1). Opening Markup morphs the dock in place (*bar morph*,
  `clip-path`, never the filter). This spec owns that element and the palette; the dock's
  resting items and the Locked button belong to the app-frame spec, the Pages and Compare bars
  to their own specs.
- **The palette** (MK-2) is one row with **Done** at the leading end, then Select · Draw ·
  Options · Add · Fill & sign · Page content · +. Groups fold into + by **measured** width in
  flows' order, not by class alone. Phones get two fixed 8-target sets, Draw and Sign (MK-11);
  phone landscape and tablet side docks get a 64 px rail.
- **Armed = shape, not light.** Glyph tools take the lime fill with ink glyph (dark) or ink fill
  with lime glyph (light) and switch outline → fill (I-2). Pen dots are content colours, so an
  armed pen takes the n12 ring of `language.md` §1.9, never lime. The dark-theme under-light
  (MK-5) slides beneath whatever is armed, except Redact (no light for redaction, §3.2).
- **Options show on arming** (FL-R2): a tier above the palette on compact and medium (MK-7), a
  summary chip inline from expanded up; the full editor on a second press of the armed tool or
  ⋯ (MK-8). "A second press opens choices" is the one rule for pens, Shapes, Stamp and Sign.
- **Fill & sign is the second door** to the same palette: Select armed, saved signatures as chips
  (up to three), New signature…, the field stepper, Add field ▾, Show field outlines (MK-12–14).
- **Every committing tool names its act** for `canChange(id, act)` (§3): strokes and drags
  `freehand`, placing clicks `place`, bar actions on a chosen object `targeted`, the editor
  `text`. Nothing arms while locked; a tool key then opens the Unlock popover.
- **Removed:** the Read dock, group row and chip, the Write/Text/Fill/Redact groups, the two image
  tools, Highlight fields, Mark search matches and Apply in the bar (§5).

## 1. Family overview

### 1.1 How the parts work together

```
viewing: dock ──(Markup · M · 2 · tool key · Mark area)──▶ palette, Draw set focused
         dock ──(Fill & sign · Sign · G)────────────────▶ palette, Sign set focused, chips
         pen stroke with "Pen writes without Markup" ───▶ preset strip ──(All tools)──▶ palette
palette: tool ─(press)─▶ armed: fill + under-light + options (tier or chip)
         armed tool ─(press again · ⋯ · ArrowUp)─▶ editor or kind menu (M4 popover)
         placing tool used once ─▶ Select     drawing tool ─▶ stays armed
         Esc ─▶ disarm to Select ─(Esc)─▶ Done: palette morphs back into the dock
lock engages while open ─▶ palette morphs into "Pages · Locked · More"; Markup closes
```

| Id | Component | Replaces (inventory) |
|---|---|---|
| MK-1 | Capsule morph (shared glass element) | 7.1 Read dock, 7.3 group chip and morph |
| MK-2 | Markup palette (row, groups, fold, placement, rail) | 7.2 group row, the five groups |
| MK-3 | Done | 7.3's chevron chip and the second Esc |
| MK-4 | Tool button and armed state | 7.4 |
| MK-5 | Under-light | — (new, AU-10) |
| MK-6 | Pen well (three pens, Highlighter) | 7.5 |
| MK-7 | Options tier and options chip, ink swatches | 7.12, 7.13, 7.14 |
| MK-8 | Preset and style editor | 7.6 |
| MK-9 | Choice tools: Shapes ▾, Stamp ▾ | 7.7, 7.8, 8.7, 8.8 |
| MK-10 | More tools (+) | — (new) |
| MK-11 | Compact sets, Draw and Sign | — (new) |
| MK-12 | Sign group: Sign ▾, saved-signature chips | 7.4 Signature image, 7.10 Sign with certificate… |
| MK-13 | New signature sheet (content) | 12.7 Signature dialog |
| MK-14 | Field tools: stepper, Add field ▾, Show field outlines | 7.9, 8.9, 7.10 Highlight fields |
| MK-15 | Preset strip | — (new, RA-2 auto-minimise) |
| MK-16 | Pen hint | 9.4's hint, in part (the pen case) |
| MK-17 | Stroke fade | 7.15 |
| MK-18 | Tool cursors and pen hover dot | 7.16 |

Owned elsewhere and only referenced: dock items at rest and the Locked button (app frame);
pending-marks, annotation, lasso, image and created-field bars (bars spec); in-page editors,
layers, keyboard placement preview and caret mode (overlays spec); the Sheet primitive and the
certificate sheet (sheets spec); Settings → Pen and touch (settings spec).

### 1.2 Composition, desktop 1440 × 900 (large, fine, dark)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ top strip (M3)                                                                           │
│                 ┌──────────────────────── page ────────────────────────┐                 │
│                 │  pen strokes, shapes; ink never hit-tests text        │                 │
│                 └───────────────────────────────────────────────────────┘                │
│                           ╭─ options popover (M4, 2nd press) ─╮       ╭──────────────╮  │
│                           │ ● ● ● ● ● │ ● ● ● │ ○  ━━○━━ 1.5 pt │      │ 3 / 12 · 96 %│  │
│                           ╰──────────────────────────────────────╯     ╰──────────────╯  │
│ ╭───────────────────────────────────────────────────────────────────────────╮ pill rises │
│ │✓ Done│ ↖ │ ◉ ● ● ▬ │ ● Black 1.5 pt ▴│ ⌫ ◌ │ ▭▴ T □ │✑ Sign▴ ‹3/12›│¶ Edit text│▮│ + │ when it  │
│ ╰──────▲───────────▲────────────────────────────────────────────────────────╯ collides  │
│   M2, 48 px, σ 9   under-light (dark): 64 px lime radial beneath the armed pen           │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Composition, phone 390 × 844 (compact, coarse)

```
┌──────────────────────────────┐
│ ‹ 3  report.pdf ▾     ↶ ↷  ⌕ │   M3 top bar 44
│  page; one finger draws until │
│  a pen is seen                │
│ ╭──────────────────────────╮ │   options tier: inside the palette's
│ │ ● ● ● ● ● ○  ━○━ 1.5 pt ⋯ │ │   filtered element (one σ, §2.9)
│ ├──────────────────────────┤ │
│ │ ✓ │ ↖ │ ◉ ● ● │ ▬ │ ⌫ │ + │ │   palette 360 × 64, 8 hit areas of 44
│ ╰──────────────────────────╯ │   bottom: max(safe-area, 12 px)
└──────────────────────────────┘
```

## 2. Shared rules

### 2.1 Sizes

| | Fine pointer | Coarse, medium and up | Compact (phone) | Rail (compact-height, side dock) |
|---|---|---|---|---|
| Capsule | 48 high | 64 high | 360 × 64, `min(360px, 100vw − 24px)` wide | 64 wide, height by content |
| Inset · radius | 6 · capsule | 10 · capsule | 10 · capsule | 10 · capsule |
| Icon button (visible circle) | 36 | 44 | 36 | 36 |
| Hit area | 36 × 48 (full height) | 44 × 64 | 44 × 64, abutting, never overlapping | 64 × 44 |
| Glyph · label | 20 · body 13/18 at 550 | 24 · 15/20 | 24 · none (Done is the check) | 24 · none |
| Gap in a group · separator | 4 · 1 × 20 px hairline, 4 px each side | 8 · 1 × 28, 8 each side | 8 visual (hit areas abut) · drawn inside hit areas | as compact, vertical |
| Text button (Done, Sign, Edit text) | 36 high, 12 px padding | 44 high, 16 px padding | — | — |

The visible 36 px circle with an 8 px visual gap inside 44 px abutting hit areas lets 8 targets
fit 352 px (A-15, `language.md` §6.2 gaps).

### 2.2 Material

The capsule is **M2** (`.mat .mat-bar`), σ 9 fine, 10 coarse and phone, 8 rail; one σ per size for
the whole morphing element (`language.md` §2.9). Coverage at the sizes used here: palette 800–1100
× 48, σ 9, c 0.992; 851 × 64, σ 10, c 0.999; phone 360 × 64, σ 10, c 0.999; rail 64 × 316, σ 8,
c 1.000; options tier 400 × 40, σ 8, c 0.988 and 520 × 52, σ 10, c 0.991; preset strip 260 × 48,
σ 9, c 0.992. All add to the `tokens.test.ts` surface registry. Rim, edge and shadow: M2 row of
§2.4 (e3). Chromium lens on the capsule only while it rests (§2.7), off during any morph and on
coarse pointers. Beneath it: the page and stage scrolling, never the aurora; the under-light is a
sibling layer below the capsule, clipped to it. Inside: fills, never glass on glass. Tinted: alpha
0.90; Solid: `--glass-bar-solid`, rim and shadow kept; `prefers-contrast: more`: strong border, no
shadow, no under-light; forced colours: `Canvas`, 1 px `CanvasText` border, filters off
explicitly, under-light `display: none`.

### 2.3 State tokens common to every palette control

| State | Dark | Light |
|---|---|---|
| Rest | Glyph n12, label n12; no fill | Glyph n12 (`#15171c`), no fill |
| Hover (fine) | Fill `rgb(255 255 255 / 0.045)` behind glyph only | `rgb(21 23 28 / 0.04)` |
| Pressed | Fill `/ 0.075`; *press* scale 0.97 mouse, 0.94 touch and pen; press light | `/ 0.07`; ink press light at half |
| Focus-visible | Concentric ring inside the capsule (§9.2 `.capsule` form) | Same |
| Armed (Select) | Fill glyph on `--surface-on`, no lime and no under-light (spec X19, ADR-0023 §5.1) | Same |
| Armed (glyph tool, a creating tool) | `--tool-active-fill` lime, glyph `--tool-active-ink` ink, Phosphor fill twin; 16.42:1 glyph, 7.91:1 fill vs M2 over white | Ink fill n12, lime glyph; 14.79:1 glyph, 11.53:1 fill vs light M2 over black |
| Armed (pen dot, Highlighter) | 2 px n12 ring with a 2 px gap (7.90:1 vs M2 over white) | 2 px n12 ring (11.53:1) |
| Disabled | `aria-disabled`, glyph `--glass-text-disabled` `#7d8086`, focusable, reason in tooltip and `aria-description` | `#7f838a` |
| Busy | Glyph swapped to a 400 ms-delayed activity glyph (*replace*); input waits, no spinner first | Same |
| Forced colours | Armed: `Highlight` fill, `HighlightText` glyph; disabled `GrayText` | Same |

Ink swatches and pen dots carry a 1 px inner ring so dark inks show on dark glass and tints on
light glass: dark `rgb(255 255 255 / 0.55)` (4.18:1 worst, 6.16:1 over the canvas); light
`rgb(21 23 28 / 0.55)` (3.48:1 worst). Swatches set `forced-color-adjust: none` and keep a
`CanvasText` ring in forced colours (they are content colours, like an image).

### 2.4 Shared strings

| Key | English | Turkish |
|---|---|---|
| `markup_label` (toolbar name) | Markup | İşaretleme |
| `markup_done` · tooltip | Done · Close Markup (Esc) | Bitti · İşaretlemeyi kapat (Esc) |
| `markup_on` (live) | Markup on. Select armed. | İşaretleme açık. Seçim etkin. |
| `markup_off` (live) | Markup off. | İşaretleme kapandı. |
| `markup_armed` (live, tooltip suffix) | {tool} armed · Esc: Select | {tool} etkin · Esc: Seçim |
| `markup_placed` (live) | {object} added on page {page}. Select armed. | {object}, {page}. sayfaya eklendi. Seçim etkin. |
| `markup_locked_closed` (live) | Locked. Markup closed. | Kilitlendi. İşaretleme kapandı. |
| `markup_choices_hint` (tooltip line) | Press again for choices | Seçenekler için yeniden basın |
| `markup_more_tools` | More tools | Diğer araçlar |
| `markup_move_bar` · Bottom · Left · Right | Move tool bar to · Bottom · Left · Right | Araç çubuğunu taşı · Alta · Sola · Sağa |

Tool names reuse today's keys where they exist (`tool_select` Seçim, `tool_ink` Kalem,
`tool_highlighter` Fosforlu kalem, `tool_eraser` Silgi, `lasso_tool` Kement, `tool_text_box` Metin
kutusu, `tool_note` Not, `tool_image` Görsel, `tool_edit_text` Metni düzenle). Changed: `tool_stamp`
"Stamp or image" → **Stamp** / **Damga**; `tool_signature` "Signature image" → **Sign** / **İmzala**;
`tool_redact` **Redact** / **Karart** (the bar's "Mark for redaction" goes); `tool_shapes` **Shapes** /
**Şekiller**. Numbers use `formatNumber` (1.5 pt, TR 1,5 pt) and `tnum`.

### 2.5 Motion used by the family

*bar morph* (smooth; dock ⇄ palette ⇄ strip ⇄ Locked; Draw ⇄ Sign set swap), *select* (arming by
pointer; by key the fill swaps instantly, `flows.md` §13.1 "keys never animate tools"), *replace*
(+ glyph, Done check), *tier rise* (options tier, pill rising), *popup* (editor, menus, + menu),
*sheet* (+ sheet and New signature on compact), *press*, *materialize* and *sheen* (end of a morph,
fine pointer, Clear), *ink* (stroke fade), *lift and settle* with fling (tablet throw), *panel*
(page column inset for a side dock), *light respond* is not used: the under-light moves on
`--spring-smooth` by `transform`. Reduced motion: every form of `language.md` §7.5; the morph
becomes a 120 ms cross-fade, arming an instant swap, the under-light jumps.

## 3. What each tool asks of the guard

`activateTool(id, tool)` opens Markup when needed and arms only when `canChange(id, 'freehand')`
is true afterwards (`flows.md` §2.4); on a locked document it arms nothing and opens the Unlock
popover at the Locked button. Each commit then asks its own act; `commit()` still refuses any change
to a locked document.

| Tool (key) | Arms in viewing by | Page input when armed | Act at commit | After one use | Options |
|---|---|---|---|---|---|
| Select (V) | Markup opens on it | Selects text, annotations, fields; in Markup a double-click on text opens the editor (§3.2) | `targeted` for bar actions; `text` for the editor | — | — |
| Pen 1–3 (P, P again: next) | P arms the last pen | Pointer draws; click < 2 px and 200 ms leaves no ink | `freehand` | Stays | Colour, width (MK-7) |
| Highlighter (H) | H with no selection | Stroke along text (≥ 70 % glyph cover) becomes a Highlight; else free ink with Multiply; Alt forces ink (ADR-0021) | `freehand` | Stays | Four tints, 6–18 pt |
| Eraser (Shift+E; pen eraser end) | Shift+E | Erases whole strokes or parts under a 6/12/24/48 px circle | `freehand` | Stays | Whole stroke · Partial, size |
| Lasso (Q; pen barrel) | Q | Encloses ink and annotations of every kind; then the lasso bar | `freehand` to move by drag; `targeted` for bar actions | Stays | — (lasso bar) |
| Shapes (R O L A) | The letter arms that kind | Drag draws; Shift constrains | `freehand` | Stays | Stroke colour, width; fill in the editor |
| Text box (T) | T; page menu "Add text here" (`place` without Markup) | Click places and opens the inline editor | `place` | Select | Size, colour |
| Note (N) | N; "Add note here" | Click places and opens the note popup | `place` | Select | Colour |
| Image (I) | I; "Add image here…" | Click on empty paper opens the file picker and places there; click on a page image selects it with the image bar | `place` to add; `targeted` to replace, extract, delete, resize | Select after adding; stays after selecting | — (image bar) |
| Stamp (Shift+I: last stamp) | Shift+I | Click places | `place` | Select | — |
| Signature (G) | G arms the last saved signature (New signature… if none) | Click places 150 pt wide, or fitted to a signature field (RA-5) | `place` | Select | — |
| Field kind (Add field ▾) | Menu only | Click places a default-size field; drag sizes it | `place` | Select | Created-field bar |
| Edit text (E with no selection) | E | Run outlines on hover; click opens the editor; Tab between paragraphs | `text` | Stays | Editor header (ADR-0020) |
| Redact (X with no selection; Mark area) | X; pending bar "Mark area" | Drag over text marks words; elsewhere an area; Alt forces an area | `freehand` (a mark waits for Apply, `document`) | Stays; Apply disarms to Select | — (pending-marks bar) |

Keyboard placement (all `place` tools, Redact, field kinds): Enter on a focused page puts a preview
at the visible centre; arrows nudge 1 pt, Shift+arrows 10 pt (resize for Redact and fields with
Alt); Enter commits; Esc cancels with no history entry (`flows.md` §3.4). A unit test asserts that
every tool's commit path declares one of these acts in the registry.

## 4. Components

### MK-1 Capsule morph

*Amended 2026-10-04:* the shape changes through the capsule's own width and height, not
`clip-path` (`quality-bar.md` Q-6); read every `clip-path` below as that.

1. **Role.** The single M2 element that is the dock in viewing and becomes the palette, the preset
   strip, the Pages bar, the Compare bar or the Locked state; this spec owns the element and the
   dock ⇄ palette ⇄ strip transitions. Serves J6, J8A, J10 (`flows.md` §4.2, §4.3, §13.1). Replaces
   7.1 (`ReadDock`) and 7.3 (`useBarMorph`).
2. **Anatomy.** One `<div class="mat mat-bar capsule">` with a clip box and a content slot; the
   content is a keyed child (`dock`, `palette`, `strip`, `pages`, `compare`, `locked`).

   ```
   dock     ╭──────────────────────────────────────────────╮  560 × 48 fine · 600 × 56 coarse
            │ ▦ Pages   ✎ Markup   ✑ Fill & sign   ⋯ More  │
            ╰──────────────────────────────────────────────╯
               ▼ clip-path inset animates outward from the dock's box; Markup's slot
                 becomes Done at the leading end; chips FLIP to their palette places
   palette  ╭──────────────────────────────────────────────────────────────────╮ 48 / 64
            │✓ Done│ ↖ │ ● ● ● ▬ │ … │ + │
            ╰──────────────────────────────────────────────────────────────────╯
   ```
3. **Material and light.** §2.2. The element keeps one σ through every morph; only its clip
   changes. The lens leaves at morph start and returns 150 ms after rest. No under-light in the
   dock or strip (nothing armed in the dock; the strip shows it only once a pen is armed).
4. **States.** Rest as dock (frame spec); *morphing* (inner content `inert`, pointer events kept on
   the outgoing content until its first exit frame, A-13); rest as palette; locked (frame's Locked
   content). Error: none of its own.
5. **Content.** None of its own beyond MK-3; the dock's labels are the frame's.
6. **Behaviour.** Morph triggers: Markup, M, 2, a tool key, Fill & sign, Sign, G, Mark area
   (dock → palette); Done, Esc at Select, 1, M (palette → dock); a pen stroke with "Pen writes
   without Markup" (dock → strip); All tools (strip → palette). Lock engaging while open
   (palette → Locked; `markup_locked_closed`). Switching tabs morphs to the other document's state
   (Markup is per document). Pages grid: the palette morphs into the Pages bar; its Done returns
   to the palette state that was left. Focus: opened by pointer or keyboard on the dock → focus
   moves to the palette's roving stop (Select); opened by a key with focus on the page → focus stays
   on the page; closed by Done or Esc from inside → focus to the dock's Markup (or Fill & sign);
   closed by a key from the page → stays on the page. Live: `markup_on` / `markup_off` once, at the
   state change (A-14).
7. **Motion.** *bar morph*: `clip-path: inset(… round 999px)` on `--spring-smooth` (530 ms CSS,
   99 % at 381 ms), chips FLIP with a 15 ms stagger (≤ 10 × 12 ms rule: groups stagger, not chips),
   then *materialize* and *sheen*; a reversal retargets from the current inset. Never `width`.
   Reduced: 120 ms cross-fade of the two contents, no clip travel.
8. **Accessibility.** The element has no role; its content does (dock: `toolbar` "Document tools";
   palette: `toolbar` "Markup"). The dock's Markup button `aria-pressed` and `aria-keyshortcuts="M"`.
   Exiting content is `inert` from its first frame. One F6 region whatever the content.
9. **Implementation.** New `shell/capsule/Capsule.tsx` (element, clip animation through
   `motion/core` with retarget, content registry keyed by `capsuleContent(id)` selector),
   `shell/capsule/capsule-morph.ts` (FLIP of keyed chips), `shell/capsule/Capsule.module.css`.
   Reads `docUi[id].markup`, `surface`, `destination`, `locks`. Deletes `ReadDock` and
   `useBarMorph` from `FloatingToolbar.tsx`. Tests: unit for the content selector (every state of
   {markup, surface, lock, strip}); browser-mode: morph keeps one element (same DOM node, filter
   unchanged), exiting content `inert`; `e2e/motion.spec.ts`: zero layouts during the morph,
   reduced-motion cross-fade only; rendered-pixel: capsule over white in both themes.

### MK-2 Markup palette

1. **Role.** Holds every creation tool in one row (RA-2), Select armed on opening. J5 (Highlighter
   path), J6, J8A, J9 (in Markup), J10 (`flows.md` §4.3, §4.7). Replaces 7.2 and
   `FloatingToolbar.groups.ts`.
2. **Anatomy.** Groups in order: Done · Select · Draw (◉●● pens, ▬, the options chip, ⌫ ◌) ·
   Add (▭▴ T □ [image] [stamp]) · Fill & sign (Sign▴ [chips] ‹n/N› [Add field▴] [outlines]) ·
   Page content (¶ Edit text, ▮) · +. Widths are estimates for fine pointers, Turkish +12 %.

   ```
   xlarge ≈1110 │✓ Done│↖│◉●●▬│● Black 1.5 pt▴│⌫ ◌│▭▴ T □│✑ Sign▴ ‹3/12› ⬚│¶ Edit text│▮ Redact│+│
   large  ≈920–1020 (with fields) │✓ Done│↖│◉●●▬│● Black 1.5 pt▴│⌫ ◌│▭▴ T □│✑ Sign▴ ‹3/12›│¶ Edit text│▮│+│
   expanded ≈700 │✓ Done│↖│◉●●▬│● 1.5▴│⌫ ◌│▭▴ T □│✑ Sign▴│+│   (Edit text, Redact in +)
   medium (coarse 64) │ ✓ Done │ ↖ │ ◉ ● ● ▬ │ ⌫ ◌ │ ▭▴ T □ │ Sign▴ │ + │   tier above
   compact Draw │ ✓ │ ↖ │ ◉ ● ● │ ▬ │ ⌫ │ + │      compact Sign │ ✓ │ ↖ │ Ada L.▴ │ T │ ‹2/4› │ + │
   rail (compact-height, side dock)  ╭──╮ ✓ ↖ ◉ ● ● ▬ + (⌫ from 400 px of height) ╰──╯
   ```

   **Fold by measurement.** Available width = free band − 2 × 16 px (12 on compact). The xlarge
   row is laid out, then items move to + in `flows.md` §4.3's order (Stamp, Image, Add field,
   Show outlines, Redact, Edit text, Note, Shapes, Lasso) until it fits; labels drop before items
   (Redact, then Edit text, then Sign, then the options chip's name). A `ResizeObserver` re-runs
   the fold, debounced to one frame; folding never happens during a stroke or while focus is
   inside. Page pill: from expanded up it stays beside the palette when palette + 16 + pill fits,
   else it rises 8 px above the palette's trailing end (*tier rise*); on medium and compact it
   hides while Markup is open (Mod+G still opens Go to page). **Placement:** desktop bottom centre,
   16 px up, no free drag; tablets (coarse, medium and expanded) can throw it to the leading or
   trailing edge, where it becomes the rail and the page column insets by 64 + 16 px (*panel*);
   compact-height: rail on the trailing edge, movable to the leading one; position remembered per
   device (`input-policy-store.paletteDock`).
3. **Material and light.** §2.2. The under-light (MK-5) beneath the armed tool, dark only.
4. **States.** Open with Select armed; armed (one tool); folding (no visible state); locked: not
   shown (MK-1 morphs to Locked); empty: never (Select always). Busy: a tool whose code chunk is
   not loaded shows armed at once and holds page input until loaded (RA-17).
5. **Content.** §2.4; group names for `role="group"`: Select · Draw · Add · Fill and sign · Page
   content (TR: Seçim · Çizim · Ekle · Doldur ve imzala · Sayfa içeriği); separators inside Draw
   set the options chip apart, as in `flows.md` §6.7.
6. **Behaviour.** Click or tap arms; a second press on the armed tool opens its choices (MK-8,
   MK-9, MK-12). Tool keys arm from anywhere but a text field. Placing tools return to Select
   after one use, drawing tools stay (§3). Arming a tool that lives in + shows its glyph on +
   (*replace*). Tablet throw: a drag that starts on the capsule's empty glass (not a button) and
   travels > 10 px lifts it; release projects with r 0.998 and settles on the nearest dock
   (bottom, leading, trailing) on `--spring-fling`; "Move tool bar to ▸" in the + menu is the
   non-drag path (WCAG 2.5.7). Right-click or long press on empty glass opens the same "Move tool
   bar to" menu.
7. **Motion.** *select* on arm, *replace* on +, *lift and settle* for the throw, *panel* for the
   inset. Reduced: instant swap, no projection, no inset animation.
8. **Accessibility.** `role="toolbar"`, `aria-label="Markup"`, `aria-orientation` horizontal or
   vertical (rail); one Tab stop; ←/→ (↑/↓ on the rail) move, Home/End jump, separators skipped;
   ↑ (← on a trailing rail) opens the focused tool's choices; `aria-keyshortcuts` on each tool.
   Groups are `role="group"` with names. Targets §2.1 (A-15); 2.5.7 by the menu; 1.4.11 by the
   armed fills of §2.3.
9. **Implementation.** New `markup/MarkupPalette.tsx`, `markup/palette-groups.ts` (replaces
   `FloatingToolbar.groups.ts`), `markup/palette-fold.ts` (pure: items, widths, order → visible and
   folded), `markup/palette-dock.ts` (throw projection, persisted dock side), `markup/roving.ts`
   (from `FloatingToolbar.roving.ts`, kept DOM-based; Base UI `Toolbar.Root`, `Toolbar.Group`,
   `Toolbar.Separator` if its roving accepts the menu-on-↑ key, else today's helper). Stores:
   `ui-store` (`docUi[id].markup`, `paletteSet`), `tool-store`, `input-policy-store`. Deletes
   `FloatingToolbar.tsx`, `.groups.ts`, `.slots.ts`, `.module.css` and the `bar_group_*` strings.
   Tests: unit `palette-fold.test.ts` (each class width, TR labels, fold order, + glyph);
   browser-mode roving and ↑ opening; e2e at 1920, 1440, 1180, 820, 390 × 844, 844 × 390
   (screenshots, no overflow at 320 × 256, A-20); axe in the a11y matrix.

### MK-3 Done

1. **Role.** Closes Markup from any state; leads the palette (`flows.md` §4.3). Replaces the
   chevron chip and the "back to groups" Esc of 7.3.
2. **Anatomy.** Fine: text button "✓ Done", 36 high, about 76 wide; coarse: 44 high; compact and
   rail: check alone, 36 circle in a 44 hit. Separator after it.
3. **Material.** A plain control on M2; never lime (it is not the view's primary action; the armed
   tool keeps the one lime).
4. **States.** §2.3; never disabled; no armed state.
5. **Content.** "Done" / "Bitti"; tooltip "Close Markup (Esc)" / "İşaretlemeyi kapat (Esc)"; glyph
   `check` (never swaps).
6. **Behaviour.** Press: disarms, ends any in-progress placement preview with no history entry,
   commits an open text box or note editor (as today's Esc), then closes Markup (MK-1). Key paths:
   Esc ladder, M, 2 toggles, 1. Focus after: the dock's Markup button.
7. **Motion.** *press*; the morph of MK-1. Reduced: colour only.
8. **Accessibility.** `button`, name "Done", `aria-description` "Closes Markup"; keyshortcuts "M".
9. **Implementation.** Part of `MarkupPalette.tsx`; `closeMarkup(id)` in `ui-store`. Test: Done
   from every armed tool and from an open note editor leaves `markup` false and commits once.

### MK-4 Tool button and armed state

1. **Role.** The one control for Select, Eraser, Lasso, shapes, Text box, Note, Image, Stamp, Edit
   text and Redact (pens: MK-6). Replaces 7.4 `ToolButton`.
2. **Anatomy.** 36 / 44 circle, 20 / 24 glyph, optional label beside (Edit text, Redact at large,
   Sign). Choice tools add a 6 px corner caret (MK-9).
3. **Material and light.** On M2; armed per §2.3; the under-light beneath (MK-5).
4. **States.** §2.3 exactly. Disabled examples with their reason: Show field outlines "This file
   has no form fields" / "Bu dosyada form alanı yok"; Image while a picture decodes (busy).
5. **Content.** Glyphs (Phosphor regular → fill when armed): Select `cursor`, Eraser `eraser`,
   Lasso `lasso`, Rectangle `square`, Ellipse `circle`, Line `line-segment`, Arrow
   `arrow-up-right`, Text box `textbox`, Note `note`, Image `image`, Stamp `stamp`, Edit text custom
   *edit-text* (fallback `cursor-text`), Redact custom *redact* (fallback `eye-slash`). Tooltip:
   name · key, plus `markup_armed` when armed and `markup_choices_hint` on choice tools.
6. **Behaviour.** §3 per tool. Press while armed: tools with options open the editor (MK-8),
   choice tools their menu; others do nothing. Pen eraser end and barrel give a temporary Eraser
   and Lasso for one stroke; the palette shows that tool armed for the stroke's length, then the
   previous one.
7. **Motion.** *press*, *select* (outline → fill 120 ms, 0.88 → 1.04 → 1 over 240 ms on the pop
   curve, pointer only). Reduced: instant swap.
8. **Accessibility.** `button` with `aria-pressed` (exactly one true across the palette and pen
   well); name = tool name; `aria-keyshortcuts`; choice tools add `aria-haspopup="menu"` or
   `"dialog"`. Contrast §2.3 (A-3). Forced colours `Highlight`.
9. **Implementation.** `markup/ToolButton.tsx` on Base UI `Toggle` inside the toolbar; reads
   `tool-store.mode`. Tests: unit for pressed exclusivity; browser-mode press-again opens choices;
   rendered-pixel armed fill vs M2 over white ≥ 7.8:1 (dark) and ink fill vs light M2 over black
   ≥ 11.1:1.

### MK-5 Under-light

1. **Role.** The light event beneath the armed tool (AU-10, `language.md` §3.2–§3.3), so arming
   reads as rich without tinting the chrome. Not a state signal: the fill and `aria-pressed` are.
2. **Anatomy.** A sibling layer below the capsule, clipped to its shape, 64 px wide (64 tall on the
   rail), centred under the armed control.
3. **Material and light.** The §3.3 radial gradient; clamped by the M2 filter above it (primary
   8.22:1, glass-secondary 5.35:1 at c 0.992). Absent: light theme, Glass Solid, `prefers-contrast:
   more`, forced colours, Ambient light Off, in the dock and strip with nothing armed, and **when
   Redact is armed** (§3.2 "never for redaction"). Tinted keeps it.
4. **States.** Present · moving · absent; no interaction states (`pointer-events: none`).
5. **Content.** None; `aria-hidden="true"`.
6. **Behaviour.** Follows `tool-store.mode` and the pen well's armed preset; jumps (no travel)
   when the palette folds or re-docks; hidden during the stroke fade with the palette.
7. **Motion.** `transform: translateX` on `--spring-smooth`; opacity in on the last 40 % of the
   palette's morph. Reduced: jumps; Ambient Still: same, no fade.
8. **Accessibility.** A-14 (decorative, pointer-transparent); never the only cue (A-19).
9. **Implementation.** `markup/UnderLight.tsx` (CSS only, no WebGL); reads `appearance-store`.
   Tests: rendered-pixel contrast of primary text over the under-lit palette on a white page;
   unit: absent for Redact, light theme, Solid, Off.

### MK-6 Pen well

1. **Role.** Three pen presets and the Highlighter in one well (ADR-0021: four presets, the fourth
   is the Highlighter). J6. Replaces 7.5 (`PenBar.tsx` radiogroup).
2. **Anatomy.** Fine: three 36 px cells with ink dots of 10 / 13 / 16 px by width, then the
   Highlighter cell (a 20 × 8 px tint capsule); coarse: 44 px cells, dots 12 / 15 / 18. Compact: the
   three pens in the Draw set, the Highlighter as its own target.

   ```
   │ ◉  ●  ●  ▬ │    ◉ armed pen: dot + 2 px n12 ring, 2 px gap
   ```
3. **Material and light.** Dots are content colours (`language.md` §1.1) with the §2.3 inner ring;
   armed ring per §1.9; under-light beneath the armed cell (dark). **Pen-seen ring:** while Select
   is armed and the pen writes with the last pen (§MK-18 rule), that pen's cell shows a 1.5 px
   n11 ring at rest so the person sees which ink the pen uses.
4. **States.** §2.3 with the ring forms; disabled never; locked: not shown.
5. **Content.** Names `pen_preset_label`: "Black pen, 1.5 pt" / "Siyah kalem, 1,5 pt"; Highlighter
   "Yellow highlighter, 12 pt" / "Sarı fosforlu kalem, 12 pt"; pen-seen description "Your pen writes
   with this" / "Kaleminiz bununla yazar". No glyphs on dots; the Highlighter cell uses its tint
   capsule (glyph `highlighter` only in + and menus).
6. **Behaviour.** Press arms; press on the armed cell opens the editor (MK-8); P arms the last
   pen, P again the next (wraps 1 → 2 → 3); H arms the Highlighter when no text is selected.
   Arming a pen updates `lastPen`; the options tier or chip follows. Live: "Red pen, 2 pt armed" /
   "Kırmızı kalem, 2 pt etkin".
7. **Motion.** *select* for the ring (scale on the dot only), *press*. Reduced: instant.
8. **Accessibility.** Cells are toolbar buttons with `aria-pressed` (not a separate radiogroup, so
   one arrow path serves the whole palette); `aria-keyshortcuts` "P" on the last pen, "H" on the
   Highlighter. Ring contrast §2.3.
9. **Implementation.** `annotations/pen/PenBar.tsx` → `annotations/pen/PenWell.tsx` (cells) and
   `PresetEditor.tsx` (MK-8); `PenBar.register.ts` and `FloatingToolbar.slots.ts` go (the palette
   renders the well directly). `annotation-store` keeps `pen`, `armPreset`, `editPreset`; new
   `tool-store.lastPen`. Tests: `PenWell.test.tsx` (P cycling, press-again, names in TR with decimal
   comma); e2e J6 mouse 5, keys 4.

### MK-7 Options tier, options chip and ink swatches

*Superseded 2026-10-04 in look and placement by `10-ink.md` §2 (the ink strip; no chip). Roles,
strings, guard rules and the tools-with-options list below stay.*

1. **Role.** Shows the armed tool's options on arming (FL-R2, INV-R5): a tier above the palette on
   compact and medium, a summary chip inline from expanded up. Replaces 7.12 tier, 7.13 eraser tier
   and 7.14 style controls in the bar.
2. **Anatomy.**

   ```
   tier, compact (inside the palette's element)    ● ● ● ● ●  ○ │ ━━○━━ 1.5 pt │ ⋯
   tier, medium (own M2, centred, 8 px above)      ● ● ● ● ● ● ● ●  ○ │ ━━○━━ 1.5 pt │ ⋯
   eraser tier                                     [Whole stroke | Partial] │ ○6 ○12 ●24 ○48 │
   highlighter tier                                ▬ ▬ ▬ ▬ │ ━○━ 12 pt │ ⋯
   chip, expanded / large                          ● 1.5 ▴    ·    ● Black 1.5 pt ▴
   ```

   Tier height 40 fine (32 px swatch targets), 52 coarse (44 targets); swatches 14 px dots in their
   targets; compact shows the five writing inks, medium all eight; ○ (custom colour, `palette`
   glyph) opens the editor; slider 120 px fine, 160 coarse, with a `tnum` readout; ⋯ opens the full
   editor. Text box: size stepper and colour; Note: colour; Shapes: stroke colour and width (fill in
   the editor). Tools without options (Select, Lasso, Image, Stamp, Sign, field kinds, Edit text,
   Redact): no tier, the chip slot collapses.
3. **Material and light.** Compact: inside the palette's filtered element (one σ, `language.md`
   §2.9), separated by a 1 px hairline; medium: its own M2, σ 8 fine / 10 coarse (transient, inside
   medium's 3 + 1). Chip: a fill well (n5 dark / n5 light at rest) inside the palette, no glass.
4. **States.** §2.3; selected swatch: 2 px n12 ring with 2 px gap; a slider thumb uses the
   own-content lens where §2.7 allows; with a selection, the tier edits the selection (as today's
   `applyStyle`: selection wins, else the tool); locked: not shown.
5. **Content.** Colour names from `palette.ts` (Siyah, Mavi, Kırmızı, Yeşil, Mor, Turuncu, Pembe,
   Camgöbeği; tints Sarı, Yeşil, Mavi, Pembe); "Width" / "Kalınlık"; "Opacity" / "Opaklık"; "Whole
   stroke · Partial" / "Tüm çizgi · Kısmi"; "{size} px" / "{size} piksel"; "Font size" / "Yazı
   boyutu"; "Custom colour" / "Özel renk"; "{tool} options" / "{tool} seçenekleri"; chip name
   "Black · 1.5 pt" (TR "Siyah · 1,5 pt"), drops the colour name below 160 px.
6. **Behaviour.** Appears on arming a tool with options, disappears on disarm or Select; a swatch
   press sets the colour of the armed preset (or the selection) as one history step when a
   selection exists; the slider commits on release (one step). Chip press opens the editor
   (MK-8) as a popover anchored to it. Focus: Tab from the palette enters the tier; Shift+Tab
   returns. During a stroke the tier fades with the palette.
7. **Motion.** *tier rise* (`translateY(8px) scale(0.98)` + opacity, `--spring-quick`; exit 100 ms);
   chip text *replace* when the preset changes. Reduced: fade.
8. **Accessibility.** Tier `role="toolbar"`, name `{tool} options`; swatches `radio` in a
   `radiogroup` named "Colour" (arrows inside, the toolbar's roving skips into the group as one
   stop); slider Base UI `Slider` with `aria-valuetext` "1.5 points"; chip `button`
   `aria-haspopup="dialog"`. Swatch ring contrast §2.3; targets A-15.
9. **Implementation.** `markup/OptionsTier.tsx`, `markup/OptionsChip.tsx`; `annotations/StyleControls.tsx`
   kept as the control set, re-skinned for glass and coarse density; `EraserTier` moves out of
   `PenBar.tsx`. Removes `tool-store.optionsOpen` (the tier follows arming) and adds
   `editorOpen`. Tests: unit (which tools have options); browser-mode tier appears on arming, not on
   Select; a swatch with a lasso selection makes one history entry; rendered-pixel tier inside the
   compact palette shares one filter (one `backdrop-filter` element in the stack).

### MK-8 Preset and style editor

*Superseded 2026-10-04 in its parts by `10-ink.md` §4 and §6 (the colour panel and the preset
editor built from it). Strings and behaviour rules below stay.*

1. **Role.** The full options of the armed tool (7.6's preset editor and the inspector's style),
   on a second press, the chip or ⋯. J6.
2. **Anatomy.** M4 popover 280 wide fine, 320 coarse, opening upward from its anchor; on compact a
   bottom sheet at the 40 % detent (M3).

   ```
   ╭ Edit black pen ───────────────── ✕ ╮
   │ Writing  ● ● ● ● ●   Accent ● ● ●  │
   │ Custom colour  [ #1A1A1A ]  ○       │
   │ Width   0.5 1 [1.5] 2 3 5 8 12      │
   │         ━━━━○━━━━━━  1.5 pt          │
   │ Opacity ━━━━━━━━━○   100 %          │
   │ Width changes are stored in the     │
   │ stroke's appearance… (honesty line) │
   │ Draw with finger            [ on ]  │  coarse only
   │ Reset to default                    │
   ╰─────────────────────────────────────╯
   ```
3. **Material and light.** M4 (σ 24, 16 under 120 px, 20 coarse); bottom sheet M3 at 40 %; text
   input as an opaque well (`language.md` §2.10).
4. **States.** Open · closed; Reset disabled when the preset equals the default, with "Already the
   default" / "Zaten varsayılan"; Draw with finger shows "Off after a pen was used" / "Kalem
   kullanıldıktan sonra kapalı" when `auto` resolved to off.
5. **Content.** Existing `pen_editor_*` keys ("Edit {name}" / "{name} düzenle", "Width" /
   "Kalınlık", "Reset to default" / "Varsayılana sıfırla", `pen_width_note`); new "Writing" /
   "Yazı", "Accent" / "Vurgu", "Draw with finger" / "Parmakla çiz"; widths `tnum`; glyph `x` for
   close, `hand-pointing` beside Draw with finger.
6. **Behaviour.** Edits apply live to the preset (persisted per device as today); Esc or ✕ closes
   only the editor (Esc ladder step 1); focus returns to the armed tool. Draw with finger toggles
   `input-policy-store.drawWithFinger` (also in Settings).
7. **Motion.** *popup* (`--spring-quick`, origin at the anchor); compact *sheet*. Reduced: fade.
8. **Accessibility.** Base UI `Popover` (non-modal, `role="dialog"`, labelled by its title); width
   stops a `radiogroup`; slider with value text; switch `role="switch"`. A-24 (dismissible).
9. **Implementation.** `annotations/pen/PresetEditor.tsx` (from `PenBar.tsx`),
   `annotations/StyleEditor.tsx` for shapes, text box and note (absorbs `AnnotationProperties`'
   tool-default half; the selection half moves to the annotation bar's ⋯, bars spec). Tests:
   browser-mode Esc closes only the editor; edits persist across reload; TR layout at 320 px wide.

### MK-9 Choice tools: Shapes ▾ and Stamp ▾

1. **Role.** One button for four shapes and one for three stamps (7.7, 7.8). J6-adjacent markup.
2. **Anatomy.** The last kind's glyph with a 6 px caret at the top trailing corner (`caret-up`).
   Menu M4: Rectangle R · Ellipse O · Line L · Arrow A; Stamp: Draft · Approved · Confidential, each
   with a 40 × 16 preview of the stamp as content.
3. **Material.** Button on M2; menu M4 (σ 16 for under 120 px tall, else 24).
4. **States.** §2.3; armed when any of its kinds is armed; menu item for the armed kind shows a
   check.
5. **Content.** Shapes: "Shapes: Rectangle" / "Şekiller: Dikdörtgen" (`tool_shapes_menu`); kinds
   from `tool_rectangle` etc.; stamps "Draft · Approved · Confidential" / "Taslak · Onaylandı ·
   Gizli". "Image…" leaves the stamp menu (one Image tool, INV-15).
6. **Behaviour.** Press arms the shown kind; press again (or ↑, right-click, long press 450 ms)
   opens the menu; a letter arms a kind directly (R O L A; Shift+I the last stamp). Choosing closes
   the menu and arms; focus returns to the button. Stamp places once, then Select.
7. **Motion.** *popup* from the button; glyph *replace* when the kind changes.
8. **Accessibility.** `button` `aria-pressed` + `aria-haspopup="menu"`; Base UI `Menu` with
   `menuitemradio` items and keycaps on fine pointers only (`language.md` §6.2).
9. **Implementation.** `markup/ChoiceTool.tsx` (one component, two configs); `tool-store.lastShape`,
   `lastStamp`. Tests: R arms rectangle from viewing (opens Markup); press-again opens the menu;
   Stamp returns to Select after placing.

### MK-10 More tools (+)

1. **Role.** Whatever is folded at this width, by group; on xlarge the rare tools (Image, Stamp,
   Add field, Find sensitive data…, Certificate…). Keeps every tool reachable (A-20).
2. **Anatomy.** Button `plus`, or the armed tool's glyph when it lives here (filled, armed). Menu
   M4 on medium and up (sections by group, each item with its key); bottom sheet at 40 % on compact
   with all tools in a 4-column grid of 72 × 72 cells, group headings, and "Move tool bar to" absent
   (phones do not move it).

   ```
   compact + sheet (40 %)              medium+ menu
   ╭──────────── ▬ ────────────╮       ╭ Draw ─────────────────╮
   │ Draw   ◌ Lasso  ⌫ Eraser   │       │ ◌ Lasso            Q  │
   │ Add    ▭ Shapes T Text □ Note│     │ Add                    │
   │        ▣ Image  ◈ Stamp    │       │ ▣ Image            I  │
   │ Sign   ✑ Sign  ⬚ Add field │       │ ◈ Stamp ▸      ⇧I     │
   │ Page   ¶ Edit text ▮ Redact│       │ Page content           │
   ╰────────────────────────────╯       │ ¶ Edit text  E · ▮ Redact X │
                                        │ Move tool bar to ▸      │ (tablets)
                                        ╰────────────────────────╯
   ```
3. **Material.** Button on M2; menu M4; compact sheet M3 at 40 % (§2.2), solid at 92 % if dragged up.
4. **States.** §2.3; armed glyph when the armed tool is folded; never disabled.
5. **Content.** "More tools" / "Diğer araçlar"; group headings as MK-2; "Find sensitive data…" /
   "Hassas verileri bul…"; "Certificate…" / "Sertifikayla imzala…".
6. **Behaviour.** Choosing an item arms it (or opens its sheet); on compact, choosing a tool of the
   other set swaps the row (MK-11). Focus: into the menu's first item; after choosing, to the + button
   (or the swapped row's armed tool on compact).
7. **Motion.** *popup*; compact *sheet*; + glyph *replace*.
8. **Accessibility.** `button` `aria-haspopup="menu"` (compact: `"dialog"`), name "More tools" plus
   ", {tool} armed" when it shows a tool; Base UI `Menu` / `Drawer`.
9. **Implementation.** `markup/MoreTools.tsx`, fed by `palette-fold.ts`'s folded list. Tests: every
   tool reachable at 320 × 256 and at each class; the + glyph shows the folded armed tool.

### MK-11 Compact sets: Draw and Sign

1. **Role.** Two fixed rows on phones, one per door (`flows.md` §4.3, `paletteSet`); no scrolling
   row (C rejected). J6, J7–J8A on phones.
2. **Anatomy.** 8 hit areas of 44 in a 360 × 64 capsule. Draw: ✓ · ↖ · ◉ ● ● · ▬ · ⌫ · +. Sign:
   ✓ · ↖ · [last signature ▴] (96 wide, a page-white plate 64 × 24 with the signature as content) ·
   T · ‹ n/N › (124: 44 + 36 readout + 44) · +. Fold ladder on narrow phones: Sign drops T below 380
   px of viewport; Draw drops ⌫ below 384 px and ▬ below 340 px; both go to +.
3. **Material.** §2.2, one element with the tier.
4. **States.** §2.3; Sign without saved signature: the chip reads "New signature…"; without fields
   the stepper is absent and T stays.
5. **Content.** As MK-6, MK-12, MK-14; Done is the check alone (name "Done").
6. **Behaviour.** Markup and P open Draw; Sign (dock) and G open Sign; the set lasts the session per
   document. Arming a tool of the other set from + swaps the row, only because the person chose it;
   live "Sign tools shown" / "İmza araçları gösteriliyor".
7. **Motion.** *bar morph* for the swap (chips FLIP). Reduced: cross-fade.
8. **Accessibility.** As MK-2; the swap moves focus to the newly armed tool.
9. **Implementation.** `markup/CompactSet.tsx`; `ui-store.docUi[id].paletteSet`. Tests: e2e at
   390 × 844, 360 × 640, 320 × 568: no overflow, every tool reachable, swap keeps focus.

### MK-12 Sign group: Sign ▾ and saved-signature chips

1. **Role.** Places a saved signature in 2–3 presses (J8A: mouse 3, keys 4, first time 5), RA-5.
   Replaces 7.4 Signature image and 7.10 Sign with certificate… in the bar.
2. **Anatomy.** `Sign ▴` text button (glyph `signature`, label from large up). With the Fill & sign
   door: up to three chips, newest first, each a 72 × 28 page-white plate with the signature in its
   ink, inside a 36 (fine) or 44 (coarse) fill well: inline in the row on large and xlarge; on
   expanded and medium in the options-tier slot (Select has no options); on compact the last one is
   the Sign set's chip. Menu M4: saved signatures (≤ 5, plate + "Remove" `x`), separator, New
   signature… (`plus`), Certificate… (`seal-check`).
3. **Material.** Plates are content (solid white, `--radius-sm`); chips are fill wells; menu M4.
4. **States.** §2.3; armed chip = the §2.3 ring form (content inside, so no lime fill); storage
   refused: chips absent, menu line "Signatures are not kept in this window" / "İmzalar bu pencerede
   saklanmıyor"; locked: not shown.
5. **Content.** "Sign" / "İmzala"; chip name "Signature, added {date}" / "İmza, {date} eklendi";
   "New signature…" / "Yeni imza…"; "Certificate…" / "Sertifikayla imzala…"; "Remove" / "Kaldır";
   toast "Removed a saved signature · Undo" / "Kayıtlı imza kaldırıldı · Geri al".
6. **Behaviour.** A chip press arms that signature as a one-shot `place` tool; a click places it
   150 pt wide, or fitted to a signature field under the pointer; then Select (`markup_placed`). G
   arms the last; Enter places at the focused page's centre, arrows nudge, Enter commits (J8A keys
   4). With no saved signature, Sign and G open New signature (MK-13). Remove deletes from IndexedDB
   with a 10 s Undo. Certificate… opens the certificate sheet (sheets spec).
7. **Motion.** Chips enter with *tier rise* (expanded/medium) or the morph's FLIP (large); *popup*.
8. **Accessibility.** Chips are toolbar buttons with `aria-pressed`; menu `menuitem`s with the
   plate `alt` = "Signature, added 3 Oct"; Remove is a separate `menuitem` "Remove signature from 3
   Oct".
9. **Implementation.** New `signatures/saved-signatures.ts` (IndexedDB `pdf-editor:signatures:v1`,
   ≤ 5, newest first, Clear from Settings), `markup/SignGroup.tsx`. Tests: unit store (cap, order,
   refused storage); e2e J8A mouse 3 and keyboard 4; first time 5; reload keeps signatures.

### MK-13 New signature sheet (content)

1. **Role.** Draw, type or pick a signature and keep it (J8A first time). Replaces 12.7
   (`SignatureDialog.tsx`, session-only).
2. **Anatomy.** Sheet (sheets spec shell): centred dialog fine, bottom sheet 92 % compact. Segmented
   Draw · Type · Image; pad 440 × 160 (fine) or full width × 180 (compact), page white; Clear;
   "Keep on this device" checkbox, on; honesty line; [Cancel] [Use signature].
3. **Material.** M5 shell; pad and inputs solid (§2.10).
4. **States.** Empty (Use disabled: "Draw, type or choose a signature first" / "Önce bir imza çizin,
   yazın ya da seçin"); at five kept: the checkbox reads "Keep on this device (replaces the oldest)" /
   "Bu cihazda sakla (en eskisinin yerine)"; image error toast "Could not read photo.heic: choose a
   PNG or JPEG." / "photo.heic okunamadı: PNG ya da JPEG seçin."
5. **Content.** "New signature" / "Yeni imza"; "Draw · Type · Image" / "Çiz · Yaz · Görsel"; "Sign
   here" / "Buraya imzalayın"; "Clear" / "Temizle"; "Your name" / "Adınız"; "Choose image…" /
   "Görsel seçin…"; "Kept only in this browser and written only into the PDFs you sign." / "Yalnızca
   bu tarayıcıda saklanır, yalnızca imzaladığınız PDF'lere yazılır."; existing
   `tool_signature_tooltip` as the honesty line; "Use signature" / "İmzayı kullan"; "Cancel" /
   "Vazgeç".
6. **Behaviour.** Use: stores (if kept), arms it as the one-shot signature, closes; focus to the
   page so a click or Enter places. The pad takes pen, finger and mouse regardless of Draw with
   finger. Typed names use Inter (no script font).
7. **Motion.** *dialog* / *sheet*.
8. **Accessibility.** Pad `role="img"` with a live "Signature drawn, 3 strokes" / "İmza çizildi, 3
   çizgi"; Type is the keyboard path; segmented control per the primitives spec.
9. **Implementation.** `signatures/NewSignatureSheet.tsx` (from `annotations/SignatureDialog.tsx`,
   drawing and typing code kept). Tests: browser-mode keyboard-only path (Type → Use); at five kept,
   the oldest goes.

### MK-14 Field tools: stepper, Add field ▾, Show field outlines

1. **Role.** Step through a form (J7), create fields, see where they are. Replaces 7.9, 8.9 (one
   menu, not two) and 7.10 Highlight fields (INV-15).
2. **Anatomy.** Stepper `‹ 3/12 ›`: two 28 (fine) / 44 (coarse) carets around a `tnum` readout,
   96 / 124 wide; before any field is focused the readout shows "12 fields" on large, "12" elsewhere.
   Add field ▴ (`plus-square`): menu Text field (`textbox`), Checkbox (`check-square`), Radio button
   (`radio-button`), Dropdown (`caret-circle-down`), List box (`list`), Signature field
   (`signature`), Button (`cursor-click`). Show field outlines (`selection`): a toggle.
3. **Material.** Controls on M2; menu M4.
4. **States.** Stepper absent without fields; at the ends the carets wrap (no disabled state);
   outlines `aria-pressed`, disabled with "This file has no form fields"; locked fields: not
   reachable (Markup closed).
5. **Content.** "Field {n} of {total}: {name}" / "Alan {n}/{total}: {name}"; "Previous field ·
   Next field" / "Önceki alan · Sonraki alan"; "{count} fields" / "{count} alan"; "Add field" /
   "Alan ekle"; kinds "Text field, Checkbox, Radio button, Dropdown, List box, Signature field,
   Button" / "Metin alanı, Onay kutusu, Seçenek düğmesi, Açılır liste, Liste kutusu, İmza alanı,
   Düğme"; "Show field outlines" / "Alan çerçevelerini göster".
6. **Behaviour.** ‹ › move to the previous or next field in tab order, scroll it into the free
   rectangle (*scroll-to*), and focus it so typing fills (`targeted`; Tab and Shift+Tab are the key
   paths; on touch the form accessory bar takes over, bars spec). Add field: choosing a kind arms a
   one-shot `place` tool; click places a default size, drag sizes it; then Select and the
   created-field bar. Outlines toggle the same flag as the page pill's item.
7. **Motion.** *scroll-to*, then the field's focus ring (no animation); *popup*.
8. **Accessibility.** Stepper is a `group` "Fields" with two buttons and an `aria-live="polite"`
   readout; the readout's name carries the field's name; outlines `button` `aria-pressed`.
9. **Implementation.** `markup/FieldStepper.tsx`, `markup/AddFieldMenu.tsx` (uses
   `forms/create` `FIELD_KINDS`); `form-store` gains `fieldOrder` and `focusedFieldIndex`. Deletes
   the Fields-filter copy of the menu (`shell/FormsPanel.tsx`'s entry). Tests: e2e J7 via stepper;
   field creation by keyboard (kept from 9.15).

### MK-15 Preset strip

1. **Role.** With "Pen writes without Markup" on, a pen stroke in viewing writes and the dock
   becomes a slim strip (RA-2's auto-minimise, `flows.md` §3.4). J6 stylus 3.
2. **Anatomy.** `✓ │ ◉ ● ● ▬ │ ⌃ All tools` — fine 260 × 48, coarse 316 × 64; Done, the well, an
   expand button (`caret-up`, label on medium and up).
3. **Material.** The MK-1 element; under-light beneath the armed pen (dark).
4. **States.** §2.3; locked: the stroke never starts (Lock wins), the pen acts as a mouse.
5. **Content.** "All tools" / "Tüm araçlar".
6. **Behaviour.** Opens Markup with the last pen armed at the first stroke; Done closes; All tools
   morphs it into the palette with the same pen armed. Focus is not moved (the pen is writing).
7. **Motion.** *bar morph* both ways. Reduced: cross-fade.
8. **Accessibility.** Same toolbar semantics as MK-2, name "Markup".
9. **Implementation.** `markup/PresetStrip.tsx`; `docUi[id].markupForm: 'palette' | 'strip'`
   (session only); `input-policy-store.penWritesWithoutMarkup`. Tests: e2e with a CDP pen: one
   stroke in viewing with the setting on writes and shows the strip; with Lock nothing is written.

### MK-16 Pen hint

1. **Role.** The first pen touch in viewing (setting off) tells the person how to write
   (`flows.md` §3.4). Replaces the pen half of 9.4's one-time hint.
2. **Anatomy.** M4 callout, 280 wide, 8 px above the dock's Markup button with a 12 px arrow; text,
   [Settings] [Got it].
3. **Material.** M4; not over the page at rest (anchored to the dock band).
4. **States.** Shown once per device (`input-policy-store.penHintShown`); never when locked.
5. **Content.** "Writing? Tap Markup, or let the pen write anywhere in Settings." / "Yazmak mı
   istiyorsunuz? İşaretle'ye dokunun ya da Ayarlar'dan kalemin her yerde yazmasına izin verin.";
   "Settings" / "Ayarlar"; "Got it" / "Anladım"; glyph `marker-circle` (Markup's).
6. **Behaviour.** Appears on the first pen pointerdown on a page in viewing (`pointerType ===
   'pen'`, `maxTouchPoints > 0`); the pen still selects text as a mouse. Stays until dismissed or
   Markup opens; never takes focus. Settings opens Settings at Pen and touch.
7. **Motion.** *popup*. Reduced: fade.
8. **Accessibility.** `role="status"` callout, announced politely once; buttons reachable by F6
   (it joins the dock's region); dismissible with Esc (A-24).
9. **Implementation.** `markup/PenHint.tsx`. Test: shows once; not with a mouse or a desktop
   tablet (`maxTouchPoints === 0`).

### MK-17 Stroke fade

1. **Role.** While a stroke runs and 1 s after, the palette and tier fade to 20 % and let the
   pointer through, so a hand near the bottom never hits a preset (MC-38). Replaces 7.15.
2. **Anatomy.** No new element: `data-stroking` on the capsule.
3. **Material.** Opacity on the element itself, never on an ancestor of the backdrop root
   (`language.md` §2.1 rule 5); the filter is untouched.
4. **States.** Faded · normal; **never** while focus is inside the palette or tier (A-13).
5. **Content.** None; no announcement.
6. **Behaviour.** A stroke is today's `isStrokePress` with `canEditActive()` replaced by
   `docUi[id].markup && canChange(id, 'freehand')`; pen eraser end and barrel count; the pen-seen
   Select stroke counts.
7. **Motion.** *ink*: 120 ms to 20 %, back over 120 ms after the 1 s linger. Reduced: same (opacity
   is not motion).
8. **Accessibility.** `pointer-events: none` while faded; no `inert` (keyboard unaffected).
9. **Implementation.** `markup/stroke-fade.ts` (from `FloatingToolbar.stroke.ts`, same capture-phase
   listener). Tests: kept unit tests, plus "no fade with focus inside".

### MK-18 Tool cursors, pen hover dot and the pen-seen rule

1. **Role.** Shows where ink will land and keeps pen behaviour predictable (M-24, M-25, M-27).
   Replaces 7.16.
2. **Anatomy.** Pen: a dot of the preset's colour at its on-screen width (3–32 px) with a 1 px
   white-0.6 outline; Highlighter: a tint bar; Eraser: hollow ring 6–48 px; placing tools:
   crosshair; Edit text: text cursor; Redact: crosshair, I-beam over text.
3. **Material.** Page layer (content); never glass.
4. **States.** Pen hover dot (M-27) appears while a pen hovers in Markup with a drawing tool.
5. **Content.** None.
6. **Behaviour.** **Pen-seen rule** (`flows.md` §3.1, §3.4): a pen is seen at the first `pen`
   pointer with `maxTouchPoints > 0`. Then `penDrawsInMarkup` `auto` turns on: in Markup with Select
   armed, a pen stroke writes with the last pen (Select stays armed, MK-6's pen-seen ring shows
   which ink) and a pen double-tap never opens the editor; `drawWithFinger` `auto` turns off: one
   finger scrolls, two fingers pan and zoom. Before a pen is seen one finger draws with a drawing
   tool armed. Desktop tablets (`maxTouchPoints === 0`) change nothing. Two- and three-finger taps
   undo and redo only in Markup (M-17).
7. **Motion.** None on the stroke (*ink*).
8. **Accessibility.** Cursors are decorative; the armed tool is announced instead.
9. **Implementation.** `annotations/pen/ink-input.ts` (`pointerRole` reads `drawWithFinger`),
   `viewer/edit-policy.ts` renamed to `viewer/input-policy.ts`; `state/edit-policy-store.ts` →
   `state/input-policy-store.ts` with a one-time migration of `penDrawsInEdit`. Tests: unit
   `pointerRole` matrix (pen seen × setting × tool); `e2e/pen.spec.ts` keeps its CDP cases, renamed.

## 5. Esc ladder and keyboard

| Step | Esc does | Focus after |
|---|---|---|
| 1 | Closes the top menu, editor popover, + sheet or callout | Its anchor |
| 2 | Cancels a keyboard placement preview or an in-progress shape drag (no history); else clears the selection | Page |
| 3 | Disarms to Select (tier goes) | Unchanged |
| 4 | Closes Markup (MK-1) | Dock's Markup if focus was in the palette, else the page |

Keys: §3's tool keys, `M`/`2` toggle, `1` closes, `V` Select, P cycling, ↑ opens choices, Tab into
the tier, F6 to the next region (`flows.md` §7.2). Letters never fire in text fields or open
editors. Tool letters on a text selection act on it instead (H U S C X; E outlines) and never arm.

## 6. Removed and moved

| Inventory | Fate |
|---|---|
| 7.1 Read dock | Gone; the dock (frame spec) and MK-1 |
| 7.2 Group row, 7.3 chip and morph | Gone; one row (MK-2), Done (MK-3) |
| 7.4 Signature image (G) | Sign (MK-12); "Image" and "Stamp or image" become one Image tool and Stamp (INV-15) |
| 7.10 Highlight fields | Show field outlines (MK-14) and the page pill |
| 7.10 Sign with certificate… | Sign ▾ → Certificate…, title menu |
| 7.10 Find sensitive data | + on xlarge, pending-marks bar ⋯, title menu |
| 7.10 Mark search matches | Leaves the palette; proposed as "Mark all for redaction" in Find's results (Issue 6) |
| 7.11 Apply redactions button | Pending-marks bar's Apply (bars spec) |
| 7.12–7.14 tier and style controls | MK-7, MK-8 |
| 8.9 second Add field menu (Fields filter) | One menu (MK-14) |
| 12.7 Signature dialog | MK-13 |
| Edit fields mode | Created fields are selected with Select (bars spec) |

## 7. Implementation (family)

| Add | Change | Delete |
|---|---|---|
| `shell/capsule/{Capsule.tsx, capsule-morph.ts, Capsule.module.css}`; `markup/{MarkupPalette, ToolButton, UnderLight, OptionsTier, OptionsChip, ChoiceTool, MoreTools, CompactSet, SignGroup, FieldStepper, AddFieldMenu, PresetStrip, PenHint}.tsx`, `markup/{palette-groups, palette-fold, palette-dock, roving, stroke-fade}.ts`; `signatures/{saved-signatures.ts, NewSignatureSheet.tsx}`; `annotations/pen/{PenWell, PresetEditor}.tsx`; `annotations/StyleEditor.tsx` | `viewer/tool-store.ts` (arms on `canChange(id,'freehand')`; drops `barGroup`, `lastGroup`, `optionsOpen`; adds `lastPen`, `lastShape`, `lastStamp`, `lastSignatureId`, `editorOpen`); `annotations/tools.ts` (Phosphor names, groups `select·draw·add·sign·page`, act per tool); `commands/registry.ts` (`act`); `edit-policy-store.ts` → `input-policy-store.ts`; `StyleControls.tsx` (glass, coarse); `messages/*.json` | `shell/FloatingToolbar.tsx`, `.groups.ts`, `.slots.ts`, `.module.css`, `.test.tsx` (rewritten as `markup/*.test.tsx`); `annotations/pen/PenBar.tsx`, `PenBar.register.ts`; `annotations/SignatureDialog.tsx`; `bar_*` strings |

Tests that prove the family: unit (`palette-fold`, act registry coverage, `pointerRole`, saved
signatures); browser-mode (roving, ↑ choices, press-again, tier on arming, Esc ladder, morph keeps
one node); e2e (`e2e/markup.spec.ts` replaces `modes` and `tools`: J6, J8A, J10 at large and
compact; `e2e/pen.spec.ts`; `helpers.ts` `enterEdit` via `2`); rendered-pixel (`glass-pixels`:
palette, tier and strip over white and black, under-lit palette, armed fills in both themes);
`motion.spec.ts` (no layout during morph, sweep under reduced motion, no `::view-transition`
when arming); `a11y.spec.ts` matrix {default, Solid, more contrast, forced colours} × {EN, TR} ×
{dark, light} with the palette open and a tool armed.

## 8. Issues for the lead

1. **Who owns the shared element.** `flows.md` §10 puts `Dock` in the app frame and
   `MarkupPalette` here, but `language.md` §2.9 makes the dock, palette, Pages bar, Compare bar and
   Locked one element. Decided here: this spec owns `shell/capsule/Capsule.tsx` (element and
   morph); other specs supply contents.
2. **Widths are larger than `flows.md` §4.3 says.** Measured with §2.1's sizes, large is about
   920–1020 px (flows: about 800) and xlarge about 1110 (flows: about 900). Decided: fold by
   measured width in flows' order, so the class names only seed the starting set.
3. **The page pill in Markup.** `flows.md` is silent and its wireframes drop the pill in Markup.
   Decided: beside the palette when it fits, else risen above its trailing end (expanded up);
   hidden on medium and compact while Markup is open (Mod+G still works).
4. **Armed pens cannot take the lime fill.** `flows.md` §4.3 says "the armed tool is filled";
   `language.md` §1.9 gives armed ink presets an n12 ring. Decided: glyph tools fill (lime/ink),
   pen dots, the Highlighter and signature chips take the ring; the under-light marks both.
5. **No under-light for Redact.** `language.md` §3.2 forbids light for redaction; §3.3 places it
   under "the armed tool". Decided: absent while Redact is armed; the lime fill stays (interaction,
   not light).
6. **Mark search matches** (7.10) has no home in `flows.md`. Proposed for the Find spec: "Mark all
   for redaction" in Find's results, and ⌘K.
7. **Saved-signature chips on medium and expanded.** "Inline" chips do not fit those rows; decided:
   they take the options-tier slot (Select armed has no options); inline on large and xlarge.
8. **Options tier size.** `language.md` §2.9 registers the tier at 400 × 40; coarse needs 52 high
   for 44 px targets (σ 10, c 0.991). Add 520 × 52 to the registry.
9. **Compact fold ladder below 384 px** (360 and 320 px phones, A-20): not in `flows.md`. Decided:
   Draw drops ⌫ (< 384) then ▬ (< 340); Sign drops T (< 380, as flows).
10. **Phosphor names not in `language.md` §5.2**: `check-square`, `radio-button`,
    `caret-circle-down`, `list`, `cursor-click`, `plus-square`, `selection`, `palette`,
    `hand-pointing`, `caret-up`. Believed present in 2.1.1 (judgement; not installed here); verify
    when the manifest is built.

## 9. Open questions

1. Three inline signature chips is `flows.md`'s judgement; two may read calmer at large. Test in
   the wave 3 prototype.
2. Should the pen-seen ring on the last pen (MK-6) also appear on phones, where space is tight and
   the pen is rarer? Recommended yes; confirm on an iPad and an Android tablet (S-T1).
3. Tablet throw to a side dock: worth its cost in M9, or bottom-only with the "Move tool bar to"
   menu later? The rail exists anyway for compact-height.
4. Edit text stays armed after a commit (repeated fixes are common, judgement); the five-person
   test should check that people find Esc or Done to leave it.
