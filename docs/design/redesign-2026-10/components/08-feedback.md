---
title: "M9 component spec, family 08: command palette, toasts, progress and feedback"
date: 2026-10-04
status: proposed
---

> Family 08 of the M9 component specs. It covers what `flows.md` §10 calls rows "13 Palette,
> shortcuts" (less the shortcuts overlay, which belongs to the sheets family) and "14 Feedback".
> Binding inputs: `flows.md` §4.1, §4.7, §5.3, §6.9, §7.2, §8.1, §9.4, §12, §13 and
> `language.md` §2.2, §2.6, §2.9, §3.2–§3.5, §4, §5, §7.3, §7.5, §8, §9 (with `flows.md` §13.2
> applied). Evidence: `inventory.md` §13, §14, §15.2.2, §15.2.6, INV-4, INV-6, INV-11, INV-20;
> research RA-21, RA-22 (15), G-29 (16), AU-11–AU-14 (17), MC-31–MC-34 (18), M-4, M-29, M-37
> (19), X-4, X-5, X-6, X-8, X-9 (20), A-11, A-13, A-14, A-15, A-24 (22). Code read on `develop`:
> `shell/CommandPalette.tsx`, `commands/registry.ts`, `fuzzy.ts`, `keywords.ts`,
> `shell/announcer.ts`, `LiveRegion.tsx`, `home/CombinedToast.tsx`, `pwa/UpdateToast.tsx`,
> `ocr/OcrStatus.tsx`, `shell/EmptyNote.tsx`, `ui/Keycaps.tsx`, `shell/RightPanel.tsx` (History),
> `packages/document-model/src/history.ts`, `state/ui-store.ts`, `messages/en.json`, `tr.json`,
> and Base UI 1.8 `toast/*`. Ratios come from `language.md` §1.7, §2.2, §2.6, or are computed
> with its §1.2 method ("c."). **(judgement)** marks unmeasured choices. Sibling specs cite
> these parts by inventory number ("family 14"); this file is component family 08.

# M9 component spec, family 08: command palette, toasts, progress and feedback

## 0. Summary

- **Thirteen parts** (FB1–FB13): the ⌘K action panel, its argument grammar and keycaps; one
  Toast system with its stack, the progress capsule and processing ring, the success check and
  bloom; the History scrubber; error presentation; the honesty notice; live announcements; the
  empty-state primitive; the light-event service that drives the aurora's four hooks; Android
  haptics.
- **⌘K knows what is selected** (RA-22). The selection's actions come first, typed arguments
  run in one line (`move 5 before 2`, `taşı 5 2 önüne`), and an empty panel lists twelve things
  Recto can do. Disabled rows say why. On phones the same results live in the More sheet's
  search field.
- **One toast, five kinds:** info 4 s, action ≥ 10 s, success 4 s, failure until dismissed,
  progress until done. At most three, newest nearest the dock band, 14 px apart, paused on
  hover, focus, a hidden tab or an open sheet. M2, σ 9. A toast never takes focus; F6 reaches it.
- **Spoken equals shown.** Every toast is announced once, through the one announcer, at the state
  change; the toast region itself is silent. Only three failures are assertive (§11).
- **Light is a service, not a component.** `light/light-events.ts` takes arrival, drag-over,
  processing and success events and applies every pause and gate of `language.md` §3.4–§3.5 in
  one state machine; the Library field, drop overlay, ring, bloom and under-light only listen.
- **Removed:** the Combined toast (14.2), the Update toast's own banner (14.3), status-bar
  progress (14.4), the five dialog result layouts (14.7), `EmptyNote` (15.2.6), the scrim behind
  ⌘K, and the History section of the inspector (6.6).

## 1. Family overview

### 1.1 How the parts work together

| Part | Lives in | Talks to |
|---|---|---|
| FB1 Command palette | Top layer, centred (medium up); More sheet search (compact) | `commandRegistry`, selection stores, `canChange`, FB2, FB3, FB10 |
| FB2 Arguments | Inside FB1 | Workspace page counts, `canChange(id, act)`, page commands |
| FB3 Keycaps | FB1 rows, menus, tooltips, shortcuts overlay | `shortcuts.ts`, input modality |
| FB4 Toast and stack | Frame slot F13 (`01-frame.md` §14) | `toast-store`, history, FB10, FB12 |
| FB5 Progress capsule and ring | In place on the starting control, else FB4's stack | Job runners (OCR, save, export, combine, restore), FB12 |
| FB6 Success | On the capsule, toast or control that finished | FB12 (bloom, Library pulse) |
| FB7 History scrubber | Popover from ↶ (frame F3) | `history.ts` `jumpTo`, undo reveal (family 09 canvas) |
| FB8 Errors | Inline at the cause, else a failure toast, else a dialog | FB4, FB9, FB10 |
| FB9 Honesty notice | Inside sheets, popovers, editor headers, bars | Tokens only |
| FB10 Announcer | Two hidden live regions in `AppShell` | Every family |
| FB11 Empty state | Panels, sheets, the grid, Compare, ⌘K | Owners pass glyph, sentence, action |
| FB12 Light events | `light/` module, no DOM of its own | Library field and drop overlay (family 02, 01), FB5, FB6, palette under-light (family 03) |
| FB13 Haptics | `motion/haptics.ts` | Gesture core (drag lift, snap, drop) |

Z-order (from `01-frame.md` §1.1): toasts sit above contextual bars and below side sheets,
menus, ⌘K and dialogs. ⌘K sits with menus (M4). The scrubber is a popover (M4).

### 1.2 Composition

Desktop, large, 1440 × 900, viewing, three toasts and ⌘K open (fine pointer):

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◆  ▤  [report.pdf ▾ ● ⓘ] agreement  +                      ⌕ Find in document   ↶ ↷  Save ◎ │ 44
│                ╭────────────────────────────────────────────────────────────╮                │
│                │ ⌕ [3 pages ✕] move 5 before 2▏                              │ FB1 M4, 640    │
│                │ ↦ Move page 5 before page 2                          ↵      │ top = free.top │
│                │ For 3 selected pages                                        │       + 64     │
│                │ ↻ Rotate right                                     ⇧ R      │                │
│                │ …                                                           │                │
│                ╰────────────────────────────────────────────────────────────╯                │
│                          ╭ ✕ Could not open scan.pdf: the file is damaged.  ✕ ╮ oldest      │
│                          ╭ ◌ Recognizing text… 3 of 12 pages  25 %  Cancel    ╮ FB5 capsule │
│                          ╭ Deleted page 7                         Undo     ✕  ╮ newest      │
│                                         12 px                                                │
│                   ╭──────────────────────────────────────────────╮      ╭──────────────╮     │
│                   │ ▦ Pages   ✎ Markup   ✑ Fill & sign   ⋯ More  │      │ 3 / 12 · 96 %│     │
│                   ╰──────────────────────────────────────────────╯      ╰──────────────╯     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Phone, compact, 390 × 844, viewing (coarse): the toast spans the width above the dock; ⌘K is
the search field at the top of the More sheet.

```
┌──────────────────────────────┐   ┌──────────────────────────────┐
│ ‹ 3  report.pdf ▾ ⓘ  ↶ ↷  ⌕  │   │ ‹ 3  report.pdf ▾    ↶ ↷  ⌕  │
│ ┌──────────────────────────┐ │   │╭─────────── ▬ ──────────────╮│ More sheet, 92 %
│ │ page                     │ │   ││ ⌕ Search commands…         ││ input 44, 16 px
│ │                          │ │   ││ For the selected text      ││
│ └──────────────────────────┘ │   ││ ◇ Highlight            H   ││ rows 44; keycaps only
│╭────────────────────────────╮│   ││ ◇ Comment              C   ││ after a hardware key
││ Deleted page 7   Undo   ✕  ││ 56││ More                       ││
│╰────────────────────────────╯│   ││ ◇ Edit text                ││
│╭──────────────────────┬─────╮│   ││ ◇ Redact                   ││
││  ▦     ✎     ✑    ⋯  │3/12 ││   ││ ◇ Recognize text…          ││
││Pages Markup Sign More│96 % ││   ││ ◇ All commands…            ││
│╰──────────────────────┴─────╯│   │╰────────────────────────────╯│
└──────────────────────────────┘   └──────────────────────────────┘
```

### 1.3 Components, sources and what they replace

| Id | Component | flows.md | Jobs | Replaces (inventory) |
|---|---|---|---|---|
| FB1 | Command palette | §4.1, §4.7, §6.9, §7.2 | J4, J8B, J12, J13B, J16 keyboard; "Switch to…" | 13.1 `shell/CommandPalette.tsx`; the language switch that lived only here (INV-20, now Settings too) |
| FB2 | Arguments | §4.1, §8.1 J4 | J4, J2 | None (DESIGN §2 promised them; INV §13.1 debt) |
| FB3 | Keycaps | §7.2 | All keyboard rows | 15.2.2 `ui/Keycaps.tsx` |
| FB4 | Toast and stack | §5.3, §2.3, §4.4 | Every removal; J3, J10, J11, J13, J14 | 14.2 Combined toast, 14.3 Update toast; INV-4, INV-6 |
| FB5 | Progress capsule and processing ring | §5.3, §9.3 | J11, J13, J3, J14 | 14.4 status-bar progress, `ocr/OcrStatus.tsx`; the progress parts of 14.7 |
| FB6 | Success check and bloom | §5.1, §13.1 | J3, J11, J13A, J13B | The result screens of 14.7 |
| FB7 | History scrubber | §5.3, §4.7 "History" | Any undo beyond one step | 6.6 inspector History |
| FB8 | Error presentation | §5.3, §9.4 | J1, J2, J13 | Spoken-only failures (INV-6) |
| FB9 | Honesty notice | §2.6, §4.4, §5.2 | J8B, J10, J14 | 14.6 honesty notices |
| FB10 | Live announcements | §2.3, §5.3 | All | 14.1 `shell/LiveRegion.tsx`, `announcer.ts` (kept, extended) |
| FB11 | Empty state | §9.4 | J11, J15a | 15.2.6 `shell/EmptyNote.tsx` |
| FB12 | Light events | §9.1, §13.1 | J1, J3, J11, J13 | None (new) |
| FB13 | Haptics | §7.1 | J4 touch | None (new) |

## 2. FB1 Command palette

**1 · Role.** The keyboard's route to every command and the one place that takes typed
arguments (`flows.md` §4.1). It serves the keyboard paths of J4 (`move 5 before 2`, `delete 7`),
J8B (`certificate`), J13B (`compress`), J16 (`page numbers`), `lock`, `history` and "Switch to…"
(§2.3: Mod+1…9 only in the installed app). It replaces 13.1 and keeps its strengths: ~150
commands, fuzzy matching that folds case, diacritics and Turkish ı/İ (`fuzzy.ts`), catalog
keywords in every UI language (`keywords.ts`), the APG combobox.

**2 · Anatomy.**

```
medium and up, fine pointer (coarse: rows 44, input 48, footer hidden)
╭──────────────────────────────────────────────────────────────╮  M4, 640 wide (medium: viewport − 48),
│  ⌕  [▢ 3 pages ✕]  rotate 3-5 90▏                         ✕  │  max height min(560, 70 % of free height)
│──────────────────────────────────────────────────────────────│  input row 52: well 40 high, n2, --border-strong
│  ↻  Rotate pages 3–5 right                             ↵     │  argument row 44 (FB2), only when parsed
│  For 3 selected pages                                        │  section head 28, footnote 550, n11
│  ↻  Rotate right                                     ⇧ R     │  row 36: glyph 16 · title body 13/18 ·
│  ↺  Rotate left                                    ⌥ ⇧ R     │  hint footnote n11 · keycaps (FB3)
│  ⌫  Delete pages                    Locked · Unlock first    │  disabled row: reason replaces keycaps
│  Recent                                                      │
│  ⤓  Save a copy…                       File          ⇧ ⌘ S   │  hint = group, shown for Recent only
│  What Recto can do                                           │
│  ⇥  Go to a page                       go 42                 │  example in tnum, n11
│  …  Show all commands                                        │
│──────────────────────────────────────────────────────────────│
│  ↑ ↓ Navigate    ↵ Run    esc Close                          │  footer 32, fine pointer only, aria-hidden
╰──────────────────────────────────────────────────────────────╯
```

Placement: horizontally centred on the free rectangle, top at `free.top + 64` (desktop) or
`free.top + 24` (medium), so it never covers the strip. Compact and compact-height: no popup; the
More sheet (sheets family, 92 % detent) gains a search field at its top, and typing turns its
item list into these sections (`flows.md` §6.9). The scope chip `[▢ 3 pages ✕]` is 28 high (fine)
or 36 (coarse), radius capsule, fill n5.

**3 · Material and light.** M4 (`flows.md` §13.1): σ 24, coarse 20; 640 × 400 gives c ≥ 0.9998.
Rim and e4 per `language.md` §2.4. The input is an opaque well inside the glass (§2.10). No scrim:
the popup floats over the live page like a menu, and an invisible backdrop catches outside
presses **(judgement; Issue 4)**. Over the Library it picks up the aurora through its glass; it
emits no light of its own. Tinted: alpha 0.90. Solid: n4 (dark), n1 (light). Forced colours:
`Canvas`, 1 px `CanvasText` border, active row `Highlight`/`HighlightText`, filters off.

**4 · States.**

| State | Look | Tokens |
|---|---|---|
| Rest (open, nothing typed) | Sections of §6 below | rows transparent, title n12, hint n11 |
| Active row (pointer over or arrow keys) | Fill; with keyboard modality also the capsule ring inset | `--accent-muted` (dark lime 0.12, light ink 0.07); ring per `language.md` §9.2 `.capsule` form |
| Pressed | Press scale on the row content, 0.97 / 0.94 | `--press-scale-*` |
| Focus-visible | Focus stays in the input (combobox); the active row carries the visible ring | input well: no ring while open (it always has focus) **(judgement)** |
| Scoped | Scope chip shown; Selection section only, plus matching commands under it | chip n5 / n12 |
| Disabled row | Title `--glass-text-disabled`; reason in n11 where keycaps sit; still navigable | `aria-disabled`, reason in `aria-describedby` |
| Busy | Never: commands that take time close the palette first and report through FB5 | — |
| Error | Argument row shows the reason with `warning` glyph (FB2) | `--warning` |
| Locked document | First section "This document is locked" with "Unlock report.pdf…"; guarded rows disabled with "Locked · Unlock first" | — |
| Empty result | FB11 inside the list: magnifying glass, sentence, "Search report.pdf for “…”" | — |

**5 · Content and copy.** Icons: the command's own Phosphor glyph (16), else none; input
`magnifying-glass`; scope chip glyph by kind (`file`, `text-aa`, `highlighter`, `squares-four`).

| Element | English | Turkish |
|---|---|---|
| Placeholder | Search commands, or type go 12 | Komut arayın ya da git 12 yazın |
| Section: selection | For the selected text · For 3 selected pages · For the selected highlight · For 2 selected documents | Seçili metin için · Seçili 3 sayfa için · Seçili vurgu için · Seçili 2 belge için |
| Section: lock | This document is locked · Unlock report.pdf… | Bu belge kilitli · report.pdf kilidini aç… |
| Section: recent · documents · capabilities · all | Recent · Open documents · What Recto can do · Show all commands | Son kullanılanlar · Açık belgeler · Recto ile neler yapabilirsiniz · Tüm komutları göster |
| Scope chip name | Actions for 3 pages. Backspace shows every command. | 3 sayfaya ait eylemler. Tüm komutlar için geri silme tuşuna basın. |
| Disabled reasons | Locked · Unlock first · Select some text first · Needs two open documents · Open a document first · Not available in this browser | Kilitli · Önce kilidi açın · Önce metin seçin · İki açık belge gerekir · Önce bir belge açın · Bu tarayıcıda kullanılamaz |
| No match | No commands match “{query}”. · Search report.pdf for “{query}” | “{query}” ile eşleşen komut yok. · report.pdf içinde “{query}” ara |
| Footer | Navigate · Run · Close | Gezin · Çalıştır · Kapat |

Capabilities (empty panel, in this order; example arguments in `tnum`):

| # | English · example | Turkish · example |
|---|---|---|
| 1 | Go to a page · go 42 | Sayfaya git · git 42 |
| 2 | Rotate pages · rotate 3-5 90 | Sayfaları döndür · döndür 3-5 90 |
| 3 | Move pages · move 5 before 2 | Sayfaları taşı · taşı 5 2 önüne |
| 4 | Delete pages · delete 7 | Sayfaları sil · sil 7 |
| 5 | Combine documents | Belgeleri birleştir |
| 6 | Compare two versions | İki sürümü karşılaştır |
| 7 | Fill and sign | Doldur ve imzala |
| 8 | Recognize text in scans | Taramalardaki metni tanı |
| 9 | Redact text and areas | Metni ve alanları karart |
| 10 | Make the file smaller | Dosyayı küçült |
| 11 | Add page numbers | Sayfa numarası ekle |
| 12 | Lock this document | Bu belgeyi kilitle |

Turkish lengths: the longest section head ("Recto ile neler yapabilirsiniz", 30 characters) fits
640 px at 12 px in about 190 px **(c., Inter 12/550 ≈ 6.2 px per character)**.

**6 · Behaviour.**

| Input | Result |
|---|---|
| Mod+K (any place, also in a text field: `allowInInputs`) | Opens; focus in the input. Again: closes. Compact: opens More at 92 % with the field focused |
| More → All commands… · Library ⋯ → Search commands | Same |
| Typing | Re-ranks on every key (`useDeferredValue`); FB2 parses first; no animation per key (A-10) |
| Up / Down, Home / End, PageUp / PageDown | Move the active row over enabled and disabled rows alike (disabled rows must be readable, A-14) |
| Enter, click, tap | Runs an enabled row: palette closes, then the command runs in the same task (pickers keep user activation, as today) |
| Enter on a row disabled by Lock | Closes and opens the Unlock popover at the dock's Locked button (frame F10), as a tool key does (`flows.md` §3.1) |
| Enter on another disabled row | Nothing; the reason is announced |
| Backspace in an empty input with a scope chip | Removes the chip: every command again |
| Tab | Moves to ✕ (clear, shown once text exists), then wraps; no other stops (one input, one list) |
| Esc | Clears the text if any; else closes. Focus returns to the element that had it, or the page |
| Pointer outside | Closes, focus returns |
| Pen | As mouse. Touch on compact: the sheet's own drag and swipe rules |

Sections, top to bottom, when the input is empty: (1) Lock section if the active document is
locked; (2) Selection: the actions of the current selection (text: Highlight, Comment, Redact,
Copy, Edit text, Underline, Strikeout, Find all; annotation: Comment, Delete, Copy; pages: Rotate
right, Rotate left, Delete, Extract, Duplicate, Move to…; Library cards: Combine, Compare, Pages,
Close), in the order of the matching context bar (family 04); (3) Recent, up to 5 command ids,
kept per device in `localStorage`, never with arguments, since page numbers belong to one
document **(judgement)**; (4) Open documents when two or more are open, up to 4, then "Switch
to…"; (5) What Recto can do; (6) Show all commands, which expands today's grouped list in place.
With text typed: the argument row, then Selection matches, then all matches by score. A selection
action gets +15 score so it outranks a same-score global command **(judgement)**.

Guard: the palette asks nothing itself; each row shows `commandRegistry.isEnabled` and the new
`reason()`, and every committing command declares its `act` (`flows.md` §2.5 rule 1).
Announcements (FB10): result count 500 ms after the last key, key `palette-count`: "12
results" / "12 sonuç", "No results" / "Sonuç yok". The command announces its own outcome; the
palette never says "Ran …".

**7 · Motion.** *popup* from the top centre (origin top centre, 4 px down, `scale(0.96)`),
*materialize*; scope chip *replace*; close: exit fade 100 ms. Reduced: 120 ms fade. Compact: the
More sheet's *sheet*.

**8 · Accessibility.** Base UI `Dialog` (modal, `aria-label` "Command palette" / "Komut
paleti"); input `role="combobox"`, `aria-expanded="true"`, `aria-controls`, `aria-activedescendant`;
`listbox` with `group`s labelled by their heads; options carry `aria-keyshortcuts` and, when
disabled, `aria-disabled` and `aria-describedby` → reason. Rows 36 fine (A-15: ≥ 24), 44 coarse.
Contrast (dark M4 worst over white / light M4 worst over black): primary 9.68 / 12.71, n11 6.30 /
7.13; active row primary 7.03, n11 4.58 (dark), 14.50 / 6.25 (light, `language.md` §1.7). Matched
characters use weight 650, never colour. A-11, A-13, A-14, A-15, A-21 (no `capitalize`;
`toLocaleUpperCase(getLocale())` only).

**9 · Implementation.** Rewrite `shell/CommandPalette.tsx` into `shell/palette/`:
`CommandPalette.tsx` (Base UI `Dialog`, transparent backdrop), `PaletteResults.tsx` (shared with
the More sheet), `palette-sections.ts` (today's `buildSections` plus lock, selection, documents,
capabilities), `selection-actions.ts` (selection kind → command ids, read from the context
bars' item lists), `capabilities.ts`. `commands/registry.ts` gains `act?: Act`, `reason?: () =>
string | null`, `args?: ArgSpec` (FB2), `selection?: SelectionKind[]`, `icon?: IconName`.
`ui-store.recents` persists through `safe-storage.ts`. Delete the `barGroupLabelOfCommand` hint
(the Markup palette's group names replace it) and the backdrop styles. Tests: unit
`palette-sections` order per state; registry test that every command with a mutating `run`
declares `act` (`flows.md` §2.5); browser-mode combobox keys, disabled reasons read, Backspace
removes scope, Enter on a locked row opens the Unlock popover, focus return; e2e J4 keyboard
(6 steps), J8B, J13B, J16 keyboard paths in Chromium, WebKit, Firefox; `phone` project: More
search; axe; `glass-pixels.spec.ts` M4 over a white page (dark) and black (light).

## 3. FB2 Arguments

**1 · Role.** One typed line instead of a dialog for page work (`flows.md` §4.1, J4 keyboard 6).
New; INV §13.1 lists the gap.

**2 · Anatomy.** The argument row (44 high, first in the list) restates the parse in words with
the target's glyph and ↵: "↦ Move page 5 before page 2 ↵". Invalid: `warning` glyph, the reason,
no ↵, row not actionable. Numbers `tnum`; ranges render with an en dash (3–5).

**3 · Material and light.** A row of FB1; same fills.

**4 · States.** Parsed (enabled) · parsed but guarded (reason, as a disabled row) · invalid
(reason) · partial (only a verb typed: the capability row with its example, no reason yet).

**5 · Content and copy.** Grammar; tokens are case- and diacritic-folded (`foldForSearch`); EN
and TR verbs work in both UI languages, as keywords do today.

| Verb (EN · TR) | Arguments | Act | Row (EN · TR) |
|---|---|---|---|
| go, page · git, sayfa | N, `last`/`son`, a page label | — | Go to page 42 · 42. sayfaya git |
| (a bare number) | N | — | Go to page 42 · 42. sayfaya git |
| rotate · döndür | [range] [90 · 180 · 270 · -90 · left/sol · right/sağ], default right | pages | Rotate pages 3–5 right · 3–5. sayfaları sağa döndür |
| move · taşı | range, before/önüne · after/arkasına/sonrasına, N; or `to end` / `sona` | pages | Move page 5 before page 2 · 5. sayfayı 2. sayfanın önüne taşı |
| delete · sil | range | pages | Delete page 7 · 7. sayfayı sil |
| extract · çıkar | range | — (allowed when locked, §2.6) | Extract pages 3–5 to a new document · 3–5. sayfaları yeni belgeye çıkar |
| duplicate · çoğalt | range | pages | Duplicate page 4 · 4. sayfayı çoğalt |
| zoom · yakınlaştır | 25–800, `fit`/`sığdır`, `width`/`genişlik` | — | Zoom to 150 % · Yakınlaştırmayı %150 yap |
| find · bul | text | — | Find “invoice” · “invoice” ifadesini bul |
| switch to · geç | part of a document name | — | Switch to agreement.pdf · agreement.pdf belgesine geç |
| lock · kilitle; unlock · kilidi aç | — | — (Unlock warns on signed files, frame F5) | Lock report.pdf · report.pdf dosyasını kilitle |
| history · geçmiş | — | — | Open history · Geçmişi aç |

Range: `3`, `3-5` or `3–5`, `3,5,7`, `3-5 8`, `last`/`son`; with no range and a page selection,
the selection; with neither, the current page (as Shift+R, `flows.md` §3.5 S18). The TR relation
word may come before or after the target ("taşı 5 2 önüne", "taşı 5 önüne 2").

| Reason (EN) | Turkish |
|---|---|
| report.pdf has 12 pages. There is no page 40. | report.pdf 12 sayfadan oluşuyor; 40. sayfa yok. |
| A document keeps at least one page. | Belgede en az bir sayfa kalmalı. |
| Type a page number, for example go 12. | Bir sayfa numarası yazın, örneğin git 12. |
| No open document is called “lease”. | “lease” adında açık belge yok. |
| Open a document first. | Önce bir belge açın. |
| Locked · Unlock first | Kilitli · Önce kilidi açın |

**6 · Behaviour.** Parsing is synchronous and pure (`parseArgs(text, locale, context)`). Numbers
are page positions; a token that is not a number but equals a page label exactly (`iv`) resolves
to that page **(judgement)**. Enter runs the parsed command with its arguments as one history
step; destructive ones (delete) run without a dialog and leave an FB4 action toast, exactly as
the page menu does (S8). After running, focus goes to the page; the moved or rotated pages get
*undo reveal*. Announce the command's result ("Moved page 5 before page 2") and, for an invalid
line, the reason 500 ms after the last key (key `palette-args`).

**7 · Motion.** The argument row appears without motion (it updates per key).

**8 · Accessibility.** The argument row is the first `option`; its name is the full sentence.
Reasons are text, never colour alone (A-19).

**9 · Implementation.** `commands/args/parse.ts`, `grammar-en.ts`, `grammar-tr.ts`,
`range.ts` (shared with today's `range_error_*` messages). Tests: unit table of ~80 lines per
language (ranges, relations, labels, out of range, last page, locked); e2e J4 keyboard path.

## 4. FB3 Keycaps

**1 · Role.** Show the key next to a command in ⌘K, menus, tooltips and the shortcuts overlay
(`flows.md` §7.2). Replaces 15.2.2 (which shows on touch devices too).

**2 · Anatomy.** One cap per key: height 18 (fine), min width 18, padding 0 4, radius-xs 4, gap 2;
caption 11/14 weight 500 with `case` and `tnum`. Apple: ⌘ ⌥ ⇧ ⌃ ↵ ⌫ esc; others: Ctrl, Alt, Shift,
Enter, Backspace, Esc. Turkish keyboards: letters shown as typed (`ı` and `İ` never swapped).

**3 · Material and light.** A fill inside glass (no glass on glass): n5 with n11 text (7.72 dark,
7.60 light, c.). Forced colours: `CanvasText` 1 px border, no fill.

**4 · States.** Shown on fine pointers; on coarse pointers only after a physical key press in this
session (`language.md` §6.2). Inside an active row: unchanged. Disabled row: hidden (the reason
takes the place).

**5 · Content and copy.** Key names come from `shortcuts.ts`; spoken names via
`aria-keyshortcuts` on the control ("Control+Shift+S"), not from the caps.

**6 · Behaviour.** Decorative; never clickable.

**7 · Motion.** None.

**8 · Accessibility.** `aria-hidden="true"`; the control carries `aria-keyshortcuts`.

**9 · Implementation.** `ui/Keycaps.tsx` restyled; `useInputModality()` (frame
`input-modality.ts`) gates coarse display. Tests: unit labels per platform; browser-mode hidden on
coarse until a key press.

## 5. FB4 Toast and the toast stack

**1 · Role.** The one visible voice for outcomes (`flows.md` §5.3, `language.md` §8): every
removal with Undo, every failure, results, and progress. It closes INV-6 (failures were spoken
only) and with ↶ ↷ closes INV-4. Serves J3, J10, J11, J13, J14 and every delete. Replaces 14.2
`home/CombinedToast.tsx` and 14.3 `pwa/UpdateToast.tsx`.

**2 · Anatomy.**

```
fine: 360–480 × 48 (two lines 64)                       coarse and compact: min(viewport − 24, 480) × 56
╭──────────────────────────────────────────────╮       ╭────────────────────────────────────────╮
│ ◇  Deleted page 7                 ( Undo )  ✕│       │ ◇  Deleted page 7        ( Undo )   ✕  │
╰──────────────────────────────────────────────╯       ╰────────────────────────────────────────╯
 pad 16 · glyph 20 (status kinds only) · gap 12 · text body 13/18 (coarse 15/20), ≤ 3 lines ·
 action: secondary capsule 28 (coarse 36, hit 44) · ✕ 24 circle (coarse hit 44)
```

| Kind | Timer | Glyph | Action | ✕ |
|---|---|---|---|---|
| Info | 4 s | none | none | On hover or focus (fine); always (coarse) |
| Action (Undo, Reopen, Show, Start fresh) | 10 s | none | one; two at most ("Undo · Details") | Same |
| Success | 4 s (10 s with an action) | `check`, `--success` only beside "verified" or a valid signature | optional | Same |
| Failure | Until dismissed | `x-circle` (danger glass variant) or `warning` | optional ("Save a copy…", "Retry") | Always |
| System (update ready) | Until acted on | `arrow-clockwise` | Reload · Later | No (Later is the dismiss) |
| Progress | Until the job ends | FB5 ring | Cancel | No |

Stack: bottom centre of the free rectangle, 12 px above the band (dock, palette, pending-marks
bar, Library selection bar), per frame F13; newest nearest the band, older above, 14 px apart;
three at most. A fourth evicts the oldest timed toast early; failures, system and progress
toasts never leave early; if all three are persistent, newer ones wait and the top toast shows
"+2 waiting" **(judgement)**.

**3 · Material and light.** M2 (`flows.md` §13.1, G-29): σ 9 at 48 (c 0.992), σ 10 at 56 (c.
0.995), e3, lit rim. May sit over pages, the grid, Compare and the Library. Light: only the
processing ring (FB5) and the success bloom (FB6) on its rim; never for failures, deletion or
redaction (AU-12). Tinted alpha 0.90; Solid n4 / light M2 solid; `prefers-contrast: more`: strong
border, no shadow; forced colours: `Canvas`, `CanvasText` border, action `ButtonFace`/`ButtonText`.

**4 · States.**

| State | Look | Tokens |
|---|---|---|
| Rest | As anatomy | text n12; secondary text n11 |
| Hover (fine) | ✕ appears; timer paused | action wash white 0.045 behind primary text only (`language.md` §2.6) |
| Pressed (action, ✕) | Press scale, press light | 0.97 / 0.94 |
| Focus-visible | Capsule ring on the action or ✕; timer paused | §9.2 |
| Paused | Hover, focus within, `document.hidden`, a sheet or dialog open, a pointer down on it | timers freeze, never restart from zero |
| Action no longer valid | Undo after newer steps becomes "History" (opens FB7 at that entry) | — |
| Disabled action (guard) | Kept; opens the Unlock popover anchored at the toast | — |
| Locked document | Undo works (history bypasses `commit()`, `flows.md` §2.5 rule 4) | — |
| Error | Failure kind | glyph + words, no red wash |

**5 · Content and copy.** Verb and object, past tense, no "successfully"; the object's name in
weight 550 (`cv05`, `cv08` for file names). Strings owned by other families are listed there
(frame: Save, close; Library: Combine, restore, Recents; context: add note, apply redactions);
this family adds:

| Toast | English | Turkish |
|---|---|---|
| Delete | Deleted page 7 · Undo / Deleted 3 pages · Undo | 7. sayfa silindi · Geri al / 3 sayfa silindi · Geri al |
| Rotate | Rotated page 3 · Undo | 3. sayfa döndürüldü · Geri al |
| Move | Moved page 5 before page 2 · Undo | 5. sayfa 2. sayfanın önüne taşındı · Geri al |
| Undo in another document | Undid highlight in agreement.pdf · Show | agreement.pdf içindeki vurgu geri alındı · Göster |
| Stale Undo | Newer changes came after this · History | Bundan sonra yeni değişiklikler yapıldı · Geçmiş |
| Copy | Text copied | Metin kopyalandı |
| OCR done | 2 pages recognized · Review | 2 sayfa tanındı · İncele |
| OCR stopped | Stopped recognizing text · 5 of 12 pages done | Metin tanıma durduruldu · 12 sayfadan 5'i tamamlandı |
| Update | Update ready · Your documents reopen where they were. · Reload · Later | Güncelleme hazır · Belgeleriniz kaldığınız yerde yeniden açılır. · Yeniden yükle · Sonra |
| Update, nothing kept | Update ready · Reloading closes open documents. · Reload · Later | Güncelleme hazır · Yeniden yüklemek açık belgeleri kapatır. · Yeniden yükle · Sonra |
| Key migration (`flows.md` §7.3) | 1 now returns to viewing. To lock a document, use Lock in its title menu. | 1 artık görüntülemeye döner. Bir belgeyi kilitlemek için başlık menüsündeki Kilitle'yi kullanın. |
| Waiting | +2 waiting | +2 bekliyor |
| Region name | Notifications | Bildirimler |
| ✕ name | Dismiss | Kapat |

Turkish at 1.8 × English (`language.md` §4.4 rule 5): the longest action toast, "agreement.pdf
içindeki vurgu geri alındı · Göster", needs about 300 px at 13 px (c.), inside 480; beyond that
the text wraps to a second line, never truncates.

**6 · Behaviour.**

| Input | Result |
|---|---|
| Click, tap, Enter, Space on the action | Runs it (Undo calls `undo()` only if the toast's history entry is still the newest; else the label is "History"); the toast leaves; focus returns to where it was before F6, else the page |
| ✕, Esc while focus is inside | Dismisses; focus as above |
| F6 / Shift+F6 | The region is the last stop of the cycle (`flows.md` §7.2); lands on the newest toast's action |
| Up / Down inside the region | Moves between toasts **(judgement)** |
| Swipe left or right (touch, pen) | Dismisses past half the width or above 800 px/s (MC-31); below that, springs back |
| Mod+Z | Same step as the newest Undo toast; that toast leaves |
| Hide on scroll, Focus (frame F12, F13) | Toasts stay, re-anchored to `max(safe-bottom, 12px)` |

Keys: a toast with the same `key` replaces the earlier one and restarts its 10 s; counts merge only
when history merged the steps (`coalesceKey`), so one Undo always undoes exactly what the toast
says. A toast that belongs to a document that closes leaves with it, except Reopen. No toast
takes focus, ever (`language.md` §8).

Announcements: the toast is announced once by FB10, same task as the change: text plus, for Undo,
"Undo with Control Z" / "Geri almak için Control Z"; for other actions, "F6 reaches the
notification" / "Bildirime F6 ile ulaşabilirsiniz", said only the first time in a session.

**7 · Motion.** *toast*: 16 px up + opacity on `--spring-quick`; stack re-flows by FLIP; exit
120 ms; swipe on `--spring-fling`. *materialize* at the end of entry. Reduced: fades only.

**8 · Accessibility.** Region `role="region"`, `aria-label` "Notifications", not live (FB10
speaks); each toast `role="group"` named by its text. Targets 28 visible / 24 min fine (spaced 8 px),
44 hit coarse (A-15). Contrast on dark M2 worst / light M2 worst: primary 7.90 / 11.53, n11 5.14 /
6.46, danger 5.07 / 5.25, warning 5.55 / 5.37, success 5.04 / 5.18 (c.); action label n12 on n6
10.43 / 12.45 (c.). A-13 (an exiting toast is `inert` from its first exit frame), A-14, A-24.

**9 · Implementation.** `ui/Toast/` : `toast-store.ts` (Base UI `Toast.createToastManager`
with `limit: 3`; our own pause reasons), `toast.ts` (`toast.info | action | success | failure |
system | progress`, each `{ text, key?, documentId?, action?: { label, run, act? } }`),
`ToastRegion.tsx` (Base UI `Toast.Provider`, `Viewport`, `Root`, `Action`, `Close`), placed in
frame slot F13. Base UI 1.8 makes the viewport `aria-live="polite"`, roots `role="dialog"`, and
listens for F6 globally (read in `toast/viewport/ToastViewport.js`): override `aria-live="off"`
and `role="group"`, and stop F6 in `regions.ts` in the capture phase (Issue 6). Delete
`home/CombinedToast.tsx`, `home/combined-toast.ts` (copy moves to family 02), `pwa/UpdateToast.tsx`
(its store stays in `pwa/register.ts`). Tests: unit queue, eviction, keys, stale Undo, timers
paused by each reason; browser-mode F6 lands on the newest action, Esc returns focus, swipe;
e2e "Deleted page 7 · Undo" ≥ 10 s while hovered (A-24), toast above palette and pending bar
(frame), a damaged file shows a visible failure toast (INV-6); axe; rendered pixels: toast over a
white page (dark) and black (light) in Clear, Tinted, Solid.

## 6. FB5 Progress capsule and processing ring

**1 · Role.** Show work that takes longer than 400 ms without blocking (`language.md` §8, F-12):
opening many files, restore, OCR, Save, Save a copy, Combine, compress, Apply redactions, batch.
Replaces 14.4 (status-bar text) and `ocr/OcrStatus.tsx`; dialog progress screens (14.7) close
into it.

**2 · Anatomy.**

```
╭── 1.5 px conic ring on the border ──────────────────────────╮   40 fine / 48 coarse; 240–420 wide
│  Recognizing text… 3 of 12 pages        25 %     ( Cancel ) │   label body, percentage tnum n11
│  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁   │   2 px track inset 16, n7; fill n11
╰─────────────────────────────────────────────────────────────╯
```

Where it shows: in place on the starting control while that control stays on screen (Save in the
strip: "Saving… 40 %"; the facts chip: the ring around it; a sheet's primary button while the
sheet is open); otherwise as a capsule in the FB4 stack. One capsule per job; two jobs show two.
A job in a background document names it: "agreement.pdf · Recognizing text… 3 of 12".

**3 · Material and light.** M2, σ 8 at 40 (c 0.988), σ 9 at 48. Ring per `language.md` §3.3
(AU-11): lime at 40°, mint 60 % at 90°, transparent from 150°, one turn per 2.4 s, clipped to the
border, no halo; always beside text. Off (Ambient light Off, Solid, forced colours): a static 1 px
`--accent-line` rim. Forced colours: `CanvasText` border, percentage only.

**4 · States.**

| State | Look |
|---|---|
| Waiting (< 400 ms) | Nothing; the starting control shows its pressed state (X-4) |
| Indeterminate | Ring; label without percentage; no track |
| Determinate | Ring, percentage, track fill by `scaleX` |
| Hover / focus | Cancel wash, ring on Cancel; the capsule body opens the job's sheet where one exists (OCR) |
| Cancelling | Label "Stopping…" / "Durduruluyor…", Cancel disabled |
| Done | Hands over to FB6 in place, then a success or failure toast |
| Locked | Jobs that change the document cannot start; read-only jobs (Save a copy, Compare, Find sensitive data) run |

**5 · Content and copy.** Label pattern "{Verb}ing… {n} of {N} {unit}"; existing strings where they
exist (`ocr_status`, `compress_phase_*`). New: Opening 3 files… 1 of 3 · Restoring 3 documents… ·
Saving… · Combining 2 files… · Applying redactions… · Cancel · Stopping… / 3 dosya açılıyor… 3
dosyadan 1'i · 3 belge geri yükleniyor… · Kaydediliyor… · 2 dosya birleştiriliyor… · Karartmalar
uygulanıyor… · Vazgeç · Durduruluyor…. Turkish percent "%40" via `formatPercent`.

**6 · Behaviour.** Click on the body: opens the job's sheet (OCR) or nothing. Cancel: stops at
the next safe point, then the "Stopped … · n of N done" toast. A job's start, every 25 % no more
often than every 10 s, and its end are announced (FB10). Edge: closing the document cancels its
OCR with a toast; closing the tab during Save finishes Save first (frame F7).

**7 · Motion.** *progress*: fill 200 ms `--ease-standard` per update; ring rotation linear;
appearing as *toast*, or *replace* on the starting control. Reduced: static rim, text percentage,
indeterminate as a 1.6 s opacity pulse (`language.md` §7.5).

**8 · Accessibility.** `role="progressbar"`, `aria-valuemin` 0, `aria-valuemax` 100,
`aria-valuenow` (determinate), `aria-valuetext` = the label; ring `aria-hidden`. Track fill vs track
5.40 dark, 5.95 light (c.; non-text 3:1). A-7, A-9, A-14.

**9 · Implementation.** `ui/Toast/ProgressCapsule.tsx`, `ui/ProcessingRing.tsx` (CSS only,
reads FB12's `ring` state), `jobs/job-store.ts` (id, documentId, label, progress, cancel) used by
OCR, save, export, combine, restore, batch. Delete `ocr/OcrStatus.tsx`. Tests: unit 400 ms gate,
announcement cadence; e2e OCR job reports in the capsule and survives closing the OCR sheet;
motion sweep: ring stops under both reduce paths.

## 7. FB6 Success: check, bloom and Library pulse

**1 · Role.** Say "done" once, richly where it is earned (`language.md` §8, AU-12, MC-34): a
verified Save or Save a copy, OCR finished, Combine, a session restored, a certificate signature
that validates, compress finished. Replaces the five result layouts of 14.7: details move into
one "Details" sheet (dialogs family) opened from the toast.

**2 · Anatomy.** On the finishing surface (capsule, Save, facts chip, or the success toast): the
spinner or ring *replace*s to a 16 px `check` that pops; the ring blooms on the border; on the
Library the field pulses.

**3 · Material and light.** Bloom: ring opacity 0 → 1 in 180 ms, hold 120 ms, out over 900 ms
(`language.md` §3.3); Library I +0.10 for 1.2 s via FB12. Never for redaction applied, deletion,
Clear, Revert, Start fresh or any error: those get the neutral check and words only. Off or Solid:
static rim for 1 s. Forced colours: check glyph only.

**4 · States.** Eligible success · neutral success (check, no bloom) · suppressed (reduced
motion: icon swap, no bloom movement; Ambient light Off: static rim).

**5 · Content and copy.** The toast names the result ("Saved · verified", frame F7; "2 pages
recognized · Review"); "verified" carries `--success` with the check. Details sheet title "What
happened" / "Neler yapıldı".

**6 · Behaviour.** One bloom per job; jobs finishing within 1 s share one. Announced with the toast.

**7 · Motion.** *success* (`--spring-pop` on the check), ring bloom, *light respond*. Reduced:
icon swap.

**8 · Accessibility.** Glyph `aria-hidden`; the word carries the meaning (A-19). Flash rule A-8:
the bloom changes a 1.5 px rim only.

**9 · Implementation.** `ui/SuccessCheck.tsx`, bloom as a class on `ProcessingRing`;
`light/light-events.ts` `success` (FB12). Tests: unit eligibility table (redaction never blooms);
rendered pixels: page corners unchanged during a bloom (A-6).

## 8. FB7 History scrubber

**1 · Role.** Go back further than one step, and see what each step was (`flows.md` §5.3; INV-4).
Long press 450 ms or right-click on ↶, Shift+F10 or the Menu key on ↶, ⌘K `history`. Replaces
6.6 (inspector History, `shell/RightPanel.tsx` `HistorySection`). `04-context.md` §18 sketches
the same part; this section is the full form and keeps its choices (Issue 2).

**2 · Anatomy.**

```
fine: list popover under ↶, 360 × ≤ 400                coarse: slider popover 360 × 120 (compact: viewport − 16)
╭──────────────────────────────────────╮               ╭──────────────────────────────────────╮
│ History                 2 documents  │               │ Pen on page 4 · 14:02                │
│ 14:05  Highlight · p. 2 · agreement  │ future: n11   │ ├──┼──┼──┼──┼──●──┼──┼──┤            │
│ 14:02 ✓ Pen · p. 4         (current) │ row 36 / 44   │ 12 of 20             ( Cancel )      │
│ 13:58  Deleted page 7                │               ╰──────────────────────────────────────╯
│ ─── kept after a reload above ───    │ 20-step tail
│ 13:40  Opened                        │
╰──────────────────────────────────────╯
```

Newest at the top. Document names appear only with two or more documents open (`flows.md` §12).
The rule marks the snapshot's 20-step tail (`flows.md` §5.2).

**3 · Material and light.** M4, σ 24 (list), σ 16 (slider, 120 high, c 0.9998), e4. No light.
Solid and forced colours per tier.

**4 · States.** Current row: `check` + `--accent-muted`, primary text only on it (`language.md`
§2.6); future rows n11; previewing: the page shows the previewed state and the popover title reads
"Previewing step 12" / "12. adım önizleniyor"; empty: FB11 "Nothing to undo yet." with no action
(the one exception to "one action", since none exists); locked: allowed.

**5 · Content and copy.**

| Element | English | Turkish |
|---|---|---|
| Title · count | History · 2 documents | Geçmiş · 2 belge |
| Row | {time} {label} · p. {n} · {document} | {time} {label} · s. {n} · {document} |
| First row | Opened | Açıldı |
| Tail rule | Kept after a reload above this line | Bu çizginin üstündekiler yeniden yüklemeden sonra da saklanır |
| Slider value | {i} of {n} | {n} adımdan {i}. |
| Cancel | Cancel | Vazgeç |
| Empty | Nothing to undo yet. | Henüz geri alınacak bir şey yok. |

Times `tnum`, 24-hour by locale (`Intl.DateTimeFormat`); labels are today's history strings.

**6 · Behaviour.** Opening records the start step. Fine: Up/Down move the active row and preview
it after the key settles (at most one `jumpTo` per 100 ms, only visible pages re-render); click or
Enter keeps; Esc, a press outside or closing restores the start step. Coarse: drag previews per
detent, release keeps, Cancel restores. A preview that crosses an engine edit (paragraph, OCR,
redaction) waits for release **(judgement: replaying engine inverses per frame is too slow)**.
History jumps bypass `commit()` and work while locked (`flows.md` §2.5 rule 4). After keeping:
*undo reveal* on the change, focus back to ↶, announce "Now at step 12 of 20: Pen on page 4" /
"Şimdi 20 adımdan 12. adımdasınız: 4. sayfadaki kalem".

**7 · Motion.** *popup*; slider thumb *press*; preview without animation; *undo reveal* once on
keep. Reduced: popup fade.

**8 · Accessibility.** List: `listbox` with `aria-activedescendant`, options named "{label}, page
{n}, {time}"; slider: `role="slider"`, `aria-valuetext` = step label. ↶ has `aria-haspopup="dialog"`.
Rows 36 fine, 44 coarse.

**9 · Implementation.** `history/HistoryScrubber.tsx`, `HistoryList.tsx`, `HistorySlider.tsx`;
↶ (frame F3) uses `useLongPress`. Model change: `HistoryEntry` gains `meta?: { documentId, page? }`
written by `pushHistory` callers (`packages/document-model/src/history.ts`; Issue 3). Delete
`HistorySection` with the inspector. Tests: unit preview throttle and restore; browser-mode keys,
Esc restores; e2e jump while locked leaves the engine bytes as history says; motion sweep: no
animation during preview.

## 9. FB8 Error presentation

**1 · Role.** Say what went wrong and what to do, where it happened (`language.md` §8). Ends
spoken-only failures (INV-6): a corrupt or skipped file showed nothing on screen.

**2 · Anatomy.** Three places, picked in this order:

| Where | When | Form |
|---|---|---|
| Inline at the cause | The cause is on screen (a field, a sheet, an argument row, a page that failed to render) | `x-circle` or `warning` 16 + one sentence under or beside it, footnote/body |
| Failure toast | The cause is not on screen or has gone (open, save, background job, restore) | FB4 failure kind, until dismissed |
| Dialog | The person must choose before anything continues (password, Replace, unsaved marks) | Sheets family; never for a plain failure |

**3 · Material and light.** Inline: on whatever surface hosts it, no fill, no red wash; danger
text uses the glass variant inside glass (`--danger` glass: 5.07 dark, 5.25 light on M2 worst).
Never light, never shake (`language.md` §8).

**4 · States.** Recoverable (`warning`) · failed (`x-circle`) · blocking (assertive announcement,
§11). An inline error clears as soon as the input changes.

**5 · Content and copy.** Pattern: "Could not {verb} {object}: {reason}." then, if any, one
action. Reasons from the existing `failure_*` strings. New:

| Case | English | Turkish | Action |
|---|---|---|---|
| Damaged file | Could not open scan.pdf: the file is damaged. | scan.pdf açılamadı: dosya bozuk. | — |
| Not a PDF | photo.heic is not a PDF or a supported image. | photo.heic bir PDF ya da desteklenen bir görsel değil. | — |
| Storage full | Changes can no longer be kept on this device: storage is full. | Değişiklikler artık bu cihazda saklanamıyor: depolama alanı dolu. | Manage storage · Depolamayı yönet |
| Engine stopped | The PDF engine stopped. | PDF motoru durdu. | Reload · Yeniden yükle |
| OCR language | Recognizing Turkish text needs a connection once to download it. | Türkçe metni tanımak için dil dosyasını bir kez indirmek gerekir; internet bağlantısı gerekli. | Retry · Yeniden dene |
| Several files | 2 of 5 files could not be opened. | 5 dosyadan 2'si açılamadı. | Details · Ayrıntılar |

**6 · Behaviour.** Focus is never moved to an error, except inside a form after submit (focus the
first invalid field). Many failures from one action become one toast with Details. Announce
polite; assertive only for storage full, engine stopped, and a stroke that could not be saved (today's
assertive case).

**7 · Motion.** Inline: fade in 120 ms; toast: *toast*. No shake. Reduced: fade.

**8 · Accessibility.** Inline errors `aria-describedby` from the input, `aria-invalid`; glyph +
words (A-19, warning vs danger identical under deuteranopia, `language.md` §1.8).

**9 · Implementation.** `ui/InlineError.tsx`; `errors/present.ts` (`presentError(error, context)`
chooses the place); `commands/app-commands.ts` `openDocuments` calls it for skipped and failed
files. Tests: unit placement; e2e damaged file shows a visible toast in three engines.

## 10. FB9 Honesty notice

**1 · Role.** Say a limit plainly where a person might assume more (`flows.md` §2.6, §4.4, §5.2):
redaction marks hide nothing until applied, unlocking a signed file, a restricted file, kept
changes not persistent, private windows, iOS eviction, paragraph edits that change look, OCR
quality. Replaces 14.6's scattered forms (tooltips absent on touch).

**2 · Anatomy.**

```
┌────────────────────────────────────────────────────────┐ 1 px --warning-line, radius-sm 8, pad 8 12
│ ⚠  Marks hide nothing until you apply them.  Why?      │ warning 16 · footnote 12/16 (coarse 13/18)
└────────────────────────────────────────────────────────┘ "Why?" a text button that expands one paragraph
```

**3 · Material and light.** Hairline only, no fill (today's rule kept): `--warning` 1 px (dark
`#ffb756` 10.18 on n3; light `#985600` 5.64 on n1, c.). Text n12/n11 on the host surface. Forced
colours: `CanvasText` border.

**4 · States.** Collapsed · expanded ("Why?" → "Less" / "Daha az") · dismissed where allowed
(private-window line in the Library: ✕, per device).

**5 · Content and copy.** Existing: `redaction_honesty_short`, `redaction_honesty_more`,
`paragraph_honesty_*`. New: Saving removes the signature from agreement.pdf. / Kaydetmek
agreement.pdf üzerindeki imzayı kaldırır. · Changes are not kept in this window. / Bu pencerede
değişiklikler saklanmaz. · The browser may clear kept changes. / Tarayıcı saklanan değişiklikleri
silebilir. · On iPhone and iPad, kept changes last while the browser keeps them. / iPhone ve iPad'de
saklanan değişiklikler, tarayıcı onları tuttuğu sürece kalır.

**6 · Behaviour.** Static; no announcement on show (it is read with its surface); "Why?" toggles
`aria-expanded`.

**7 · Motion.** Expand by height on `--spring-quick` inside sheets only. Reduced: instant.

**8 · Accessibility.** `role="note"`; the glyph `aria-hidden`; text ≥ 12 px weight ≥ 500 on glass.

**9 · Implementation.** `ui/Notice.tsx` (`tone="honesty" | "info"`). Tests: unit tones; axe in
sheets.

## 11. FB10 Live announcements

**1 · Role.** One voice for screen readers, said at the state change, once (A-14). Replaces 14.1 as
code is extended, not rewritten: `shell/announcer.ts` already joins messages in one task and keys
replacements.

**2 · Anatomy.** Two visually hidden regions in `AppShell`: polite (`role="status"`) and
assertive (`aria-live="assertive"`, no `alert` role, as today).

**3 · Material and light.** None.

**4 · States.** Polite · assertive · suppressed (a message equal to what focus will say).

**5 · Content and copy.** Owned by each family; this family fixes the rules and the timing:

| Event | When | Politeness | Example (EN / TR) |
|---|---|---|---|
| A change with a toast | Same task as the change | Polite | Deleted page 7. Undo with Control Z. / 7. sayfa silindi. Geri almak için Control Z. |
| Undo, redo | After the reveal | Polite | Undid pen on page 4 / Geri alındı: 4. sayfadaki kalem |
| Palette count, argument reason | 500 ms after the last key | Polite, keyed | 12 results / 12 sonuç |
| Job | Start; every 25 %, ≥ 10 s apart; end | Polite | Recognizing text, 6 of 12 pages / Metin tanınıyor, 12 sayfadan 6'sı |
| Success | End | Polite | Saved report.pdf, verified / report.pdf kaydedildi, doğrulandı |
| Failure | At failure | Polite | Could not open scan.pdf: the file is damaged. |
| Blocking failure | At failure | Assertive | The PDF engine stopped. Reload to continue. / PDF motoru durdu. Devam etmek için yeniden yükleyin. |
| Tool armed, Markup opened | At the change | Polite | as family 03 |

**6 · Behaviour.** Rules: one announcement per action; never on hover; never what the newly
focused element's name already says; a burst within one task joins (existing); the same key
within 250 ms replaces (new); polite text clears after 10 s so a later identical message repeats.
Toasts never speak themselves.

**7 · Motion.** None.

**8 · Accessibility.** A-14; WCAG 4.1.3. Tests run `ariaSnapshot()` with the regions excluded.

**9 · Implementation.** `shell/announcer.ts` gains `debounceMs`, the 250 ms key window and the
clear timer; `toast.ts` calls `announce()`. Tests: unit timing with fake timers; browser-mode one
message per toast.

## 12. FB11 Empty state

**1 · Role.** One glyph, one sentence, one action wherever a list or surface has nothing (X-6,
`flows.md` §9.4). Replaces 15.2.6 `EmptyNote` (two quiet lines, no action) and the stage's "No
pages left". The empty Library is the launcher (family 02), not this.

**2 · Anatomy.** Centred column, max 320 wide: glyph (Phosphor duotone, 32 in panels and sheets,
48 on the stage), 12 gap, sentence (callout 15/20, n10, `text-wrap: pretty`), 16 gap, action
(secondary capsule 28 fine / 44 coarse). Keycap after the action label on fine pointers only.

**3 · Material and light.** Sits on its host; no glass of its own. Duotone second layer lime 25 %
(dark), lime-800 25 % (light) **(judgement)**; forced colours: `CanvasText` only.

**4 · States.** Rest · action disabled with reason (locked: "Locked · Unlock first") · loading
(the host shows skeletons first; an empty state never flashes before data arrives: 300 ms delay).

**5 · Content and copy.**

| Where | Glyph | Sentence (EN / TR) | Action (EN / TR) |
|---|---|---|---|
| Find, no hits | `magnifying-glass` | No matches for “{term}” in report.pdf. / report.pdf içinde “{term}” için eşleşme yok. | Search all open documents / Tüm açık belgelerde ara |
| Find on textless pages | `scan` | These pages have no text to search. / Bu sayfalarda aranacak metin yok. | Recognize text… / Metni tanı… |
| Review empty | `chat-centered-text` | No comments, marks or fields yet. / Henüz yorum, işaret ya da alan yok. | Open Markup / İşaretlemeyi aç |
| Outline none | `bookmark-simple` | This document has no outline. / Bu belgenin içindekiler bölümü yok. | Add a bookmark here / Buraya yer imi ekle |
| Pages grid, no pages | `squares-four` | No pages left. / Sayfa kalmadı. | Undo / Geri al |
| Sidebar, no document | `files` | Open a PDF to see its pages. / Sayfalarını görmek için bir PDF açın. | Open PDFs… / PDF aç… |
| Saved signatures | `signature` | No saved signatures yet. / Henüz kayıtlı imza yok. | New signature… / Yeni imza… |
| Compare, one document | custom *compare* | Compare needs a second file. / Karşılaştırma için ikinci bir dosya gerekir. | Open… / Aç… |
| ⌘K, no match | `magnifying-glass` | No commands match “{query}”. | Search report.pdf for “{query}” |
| History | `arrow-u-up-left` | Nothing to undo yet. / Henüz geri alınacak bir şey yok. | — |
| Kept documents (Settings) | `hard-drives` | Nothing is kept on this device. / Bu cihazda saklanan bir şey yok. | — |

**6 · Behaviour.** The action runs its command (with its guard); focus stays where it was when the
state appears; the host decides whether the action takes first focus (Find: no; the grid: Undo).

**7 · Motion.** Fade in `--duration-base`. Reduced: 150 ms fade.

**8 · Accessibility.** Sentence is plain text (not a heading), glyph `aria-hidden`; action is a
`button`. A-15 targets.

**9 · Implementation.** `ui/EmptyState.tsx` (`glyph`, `sentence`, `action?`); delete
`shell/EmptyNote.tsx` and its CSS. Tests: unit renders one action at most; axe per host.

## 13. FB12 Light events: the aurora hooks as a service

**1 · Role.** One module decides when light moves, so every surface obeys the same pauses and gates
(`language.md` §3.3–§3.5, AU-13, AU-14). Families 01, 02 and 03 render the field, drop overlay and
under-light; FB5 and FB6 render ring and bloom; none decides timing.

**2 · Anatomy.**

```
 emitters                        light-events.ts (state machine)              listeners
 Library mount ── arrival ──▶  ┌──────────────────────────────────┐ ──▶ LibraryField (02): I, speed, lobes
 drag over window ─ drag* ──▶  │ mode: auto · still · off         │ ──▶ DropOverlay (01): field behind scrim
 job-store ── processing ───▶  │ paused: Set<reason>              │ ──▶ ProcessingRing (FB5): rotate or rim
 FB6 ── success ────────────▶  │ gates: pressure, battery, low-end│ ──▶ Bloom (FB6), Library pulse
 card open/close ── drift ──▶  │ effective(event) → response      │ ──▶ Under-light (03): enabled or not
                               └──────────────────────────────────┘
```

**3 · Material and light.** None of its own; it carries `language.md` §3.3's values (arrival I 0 →
rest over 4 s; drag-over I +0.15 capped 0.6; success I +0.10 for 1.2 s; processing ring 2.4 s per
turn). Processing moves only rings; the field does not react to work **(judgement, §3.2)**.

**4 · States.**

| Mode | Source | Responses |
|---|---|---|
| Auto | Ambient light Auto | Events animate; drift on the empty Library and About, still after 60 s idle or 5 s unfocused |
| Still | Setting, OS or app reduced motion, low-end start, battery < 20 %, Compute Pressure `serious`, watchdog | One frame per view; events as ≤ 200 ms opacity |
| Off | Setting, forced colours, `prefers-contrast: more` | Field `display: none`; ring and bloom as static rims; no under-light |
| Paused (any mode) | Hidden tab; field off-screen; unfocused 5 s; scroll, pinch, zoom, drag, pen down, typing (resume 300 ms after); a sheet or dialog over the Library | No frames |

**5 · Content and copy.** Settings line under Ambient light when the system decides: "Still, set by
your system" / "Durgun, sisteminiz tarafından ayarlandı"; "Off, set by your system" / "Kapalı,
sisteminiz tarafından ayarlandı".

**6 · Behaviour.** API: `emitLight(event, detail?)` with `arrival`, `dragEnter`, `dragMove {x, y}`,
`dragLeave`, `drop`, `processingStart {jobId}`, `processingEnd {jobId}`, `success {source}`,
`drift`; `useLightState()` returns `{ mode, paused, reasons, ringRunning }`. Successes from
ineligible sources (redaction, delete) are ignored here too (defence in depth). No guard.

**7 · Motion.** *light respond* on the light springs; reduced: still frame.

**8 · Accessibility.** Everything it drives is `aria-hidden` and pointer-transparent (A-14);
A-5–A-8, A-23; the setting is WCAG 2.2.2's pause.

**9 · Implementation.** `light/light-events.ts`, `light/light-gates.ts` (Compute Pressure,
battery, `deviceMemory`, watchdog), `light/use-light-state.ts`. Tests: unit every pause reason and
gate; `motion.spec.ts` zero field frames at rest in a document, after 60 s idle, under both reduce
paths; flash sampler during drag-over and bloom.

## 14. FB13 Haptics

**1 · Role.** A short tick for lift, snap and drop on Android (M-37, `language.md` §8). Serves J4
touch (drag a page), Library card and tab reorder.

**2 · Anatomy.** No visual part. Events: lift 10 ms (long press lifts a page, card or tab), snap
8 ms (a drag crosses into a new drop slot; a sheet reaches a detent; a pinch crosses into the Pages
grid), drop 12 ms (a valid drop settles).

**3 · Material and light.** None.

**4 · States.** On (default where supported) · Off (setting) · unsupported (no `navigator.vibrate`,
or iOS: the setting row is hidden).

**5 · Content and copy.** Settings row (sheets family): Haptics · Short vibrations when you lift,
snap and drop pages. / Titreşim · Sayfaları kaldırırken, yerine oturturken ve bırakırken kısa
titreşimler.

**6 · Behaviour.** Never on taps, tool arming, long-press menus, invalid drops, success or errors;
at most one per 100 ms; never the only signal (each event also moves or changes something).

**7 · Motion.** Fires at the frame the *lift and settle* transition starts or ends.

**8 · Accessibility.** Optional, redundant channel (M-37).

**9 · Implementation.** `motion/haptics.ts` (`haptic('lift' | 'snap' | 'drop')`), called by the
gesture core; `appearance-store.haptics`. Tests: unit throttle and gating with a stubbed
`navigator.vibrate`.

## 15. Removed and re-homed

| Today (inventory) | Fate | Where it went |
|---|---|---|
| 13.1 Command palette | Rebuilt | FB1–FB3 |
| 13.2 Shortcut overlay | Moved | Sheets family (keycaps from FB3) |
| 14.1 Live regions | Kept, extended | FB10 |
| 14.2 Combined toast | Folded | FB4; copy in `02-library.md` L6 |
| 14.3 Update toast | Folded | FB4 system kind |
| 14.4 Status-bar progress, `OcrStatus` | Removed | FB5 |
| 14.5 Signature badge | Moved | Frame F4 seal and the facts chip (families 01, 02) |
| 14.6 Honesty notices | Unified | FB9 |
| 14.7 Dialog progress and result screens | Replaced | FB5 while running; FB6 and a "What happened" Details sheet (dialogs family) after |
| 14.8 Drag states | Moved | `02-library.md` L9 and frame F13 drop overlay; light through FB12 |
| 15.2.2 Keycaps | Restyled | FB3 |
| 15.2.6 EmptyNote | Replaced | FB11 |
| 6.6 Inspector History | Replaced | FB7 |
| Palette scrim | Removed | FB1 floats without one |

## 16. Family implementation and test plan

| Area | Files |
|---|---|
| New | `shell/palette/` (`CommandPalette.tsx`, `PaletteResults.tsx`, `palette-sections.ts`, `selection-actions.ts`, `capabilities.ts`); `commands/args/` (`parse.ts`, `grammar-en.ts`, `grammar-tr.ts`, `range.ts`); `ui/Toast/` (`toast-store.ts`, `toast.ts`, `ToastRegion.tsx`, `ProgressCapsule.tsx`); `ui/ProcessingRing.tsx`, `ui/SuccessCheck.tsx`, `ui/InlineError.tsx`, `ui/Notice.tsx`, `ui/EmptyState.tsx`; `jobs/job-store.ts`; `errors/present.ts`; `history/` (`HistoryScrubber.tsx`, `HistoryList.tsx`, `HistorySlider.tsx`); `light/light-events.ts`, `light-gates.ts`, `use-light-state.ts`; `motion/haptics.ts` |
| Changed | `commands/registry.ts` (`act`, `reason`, `args`, `selection`, `icon`), `shell/announcer.ts` (debounce, key window, clear), `ui/Keycaps.tsx`, `state/ui-store.ts` (recents persisted), `packages/document-model/src/history.ts` (`meta`), `commands/app-commands.ts` (`presentError`), `pwa/register.ts` (toast), `messages/en.json`, `tr.json` |
| Deleted | `shell/CommandPalette.tsx` + CSS (moved), `home/CombinedToast.tsx` + CSS, `home/combined-toast.ts`, `pwa/UpdateToast.tsx` + CSS, `ocr/OcrStatus.tsx`, `shell/EmptyNote.tsx` + CSS, `RightPanel` `HistorySection`, `palette_navigate`-style strings that change, `combined_toast_dismiss` |
| Unit | sections; parser (EN/TR tables); registry `act` coverage; toast queue, eviction, keys, stale Undo, pause reasons; job cadence; success eligibility; scrubber throttle; announcer timing; light state machine; haptics gating |
| Browser-mode | combobox keys and reasons; scope chip; toast F6 and Esc; swipe; scrubber keys and restore; one announcement per toast |
| e2e | J4, J8B, J13B, J16 keyboard via ⌘K (three engines); `phone`: More search, toast above the dock and above the hidden-dock inset; damaged file toast (INV-6); A-24 hover hold; OCR capsule; jump while locked |
| Rendered pixels | `glass-pixels.spec.ts`: ⌘K (M4), toast and capsule (M2) over a white page (dark) and black (light), Clear · Tinted · Solid, the no-GPU project; page corners unchanged during bloom |
| Motion | `motion.spec.ts`: no frames at rest; ring and bloom stop under both reduce paths; no animation per keystroke in ⌘K or during scrubber preview |
| axe | `a11y.spec.ts`: ⌘K open, toast stack with three kinds, scrubber open, each empty state host; {default, Solid, more contrast, forced colours} × {EN, TR} × {dark, light} |

## 17. Issues for the lead

1. **Family numbers collide.** `01-frame.md` and `05-canvas.md` call toasts "family 14" and the
   context bars "family 08" (inventory numbering). This file is component family 08. Suggest the
   lead rename references to file names (`08-feedback.md`, `04-context.md`) at merge.
2. **Two specs for the History scrubber.** `04-context.md` §18 sketches it; this task assigns it
   here. §8 keeps every choice of §18 and adds the 20-step rule, preview and restore, engine-edit
   handling and the model change. Recommended: §18 shrinks to a pointer to this file.
3. **History entries need a document and a page.** `history.ts` stores `label` and `at` only, yet
   `flows.md` §5.3 and §12 want pages and document names in the scrubber and in "Undid … in
   agreement.pdf". Proposed: `HistoryEntry.meta?: { documentId, page? }`, set by `pushHistory`
   callers. That is a `packages/` change this task may not make.
4. **No scrim behind ⌘K.** `flows.md` §13.1 puts ⌘K in M4 with menus; today's code has a scrim.
   Decided: no scrim, an invisible backdrop closes it. If the lead prefers the dim scrim of
   dialogs, the popup reads the same; only the page dims.
5. **Persistent toasts against the three-toast cap.** `language.md` §8 says failures stay until
   dismissed and at most three show. Decided: timed toasts are evicted first; persistent ones
   queue behind "+N waiting".
6. **Base UI Toast conflicts.** In Base UI 1.8 the toast viewport is `aria-live="polite"`, roots are
   `role="dialog"`/`alertdialog`, and the viewport binds F6 globally. Each fights a rule here (one
   announcer, A-14; the app's F6 cycle, `flows.md` §7.2). Decided: override the attributes and stop
   F6 in `regions.ts` in the capture phase. If overriding proves brittle, use an in-house region of
   about 200 lines on the same store.
7. **Which failures are assertive.** `language.md` §8 says "only blocking errors"; frame F7 makes a
   failed Save polite. Defined here: storage full, engine stopped, a stroke not saved. Everything
   else polite.
8. **Processing is not a field event.** The task names four aurora hooks; `language.md` §3.2 gives
   processing only the ring. Kept: `processingStart`/`End` drive rings, never the field.
9. **Update toast copy depends on snapshots.** With session restore, reloading no longer closes
   documents; the old warning stays only when nothing is kept (private window, storage refused).
10. **Recents persistence.** `ui-store.recents` lives in memory today (5 ids). Decided: persist per
    device in `localStorage`, ids only, no arguments.
11. **Empty-state duotone in light.** `language.md` §5.1 gives lime 25 % for the second layer; on
    light surfaces that is invisible. Decided: lime-800 25 % in light. A `language.md` note is needed.
12. **A Details sheet for results.** Replacing the five result layouts (14.7) needs one "What
    happened" sheet in the dialogs family; this file assumes it exists.

## 18. Open questions

1. **Info toast length.** 4 s (`language.md` §8, X-8) may be short for Turkish two-line toasts. Try
   4 s + 1 s per 30 characters beyond 60 in the wave 3 prototype.
2. **Bare numbers as "go".** Typing `42` goes to page 42. Does it surprise people who search for
   a command with a number in its name ("Rotate 90")? Watch in the five-person test.
3. **Toast order.** Newest nearest the dock (closest to the hand on phones) or newest on top
   (reading order)? This spec picks nearest the dock; prototype both.
4. **Selection boost.** Is +15 enough for "Delete pages" (selection) to beat "Delete comment"
   (global) when someone types "del"? Tune against a log of real queries from the prototype.
5. **Haptic snap on sheet detents.** Useful, or noise on every sheet drag? Decide on an Android
   device.
