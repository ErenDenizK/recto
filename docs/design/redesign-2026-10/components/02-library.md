---
title: "M9 component spec, family 02: Library and first run"
date: 2026-10-04
status: proposed
---

> Wave 2 component spec. Binding inputs: [`flows.md`](../flows.md) (§2.1–§2.3, §4.6, §5.2–§5.3,
> §6.3–§6.9, §7, §9, §10 row 4) and [`language.md`](../language.md) (with the ten amendments of
> `flows.md` §13.2). Evidence: [`inventory.md`](../inventory.md) §3.1, §3.12, §4, §14.2, §14.8,
> §15.1.3, [`current-flows.md`](../current-flows.md) J1, J3, J12, J14, the baseline frames
> `01-home-empty-*`, `02-home-files-*`, and research 15 (RA-19), 17 (AU-4, AU-9, AU-12, AU-13),
> 18 (MC-2, MC-3, MC-27–MC-31), 19 (M-13, M-20, M-34, M-35), 20 (X-5–X-7), 21 (BR-V1–BR-V3, About
> hero), 22 (A-5, A-13). Code read: `home/HomeView.tsx`, `home/home-model.ts`,
> `home/home-actions.ts`, `home/combined-toast.ts`, `shell/EmptyState.tsx`, `shell/AppShell.tsx`,
> `files/recents.ts`, `state/ui-store.ts`, `tools/fixtures/demo-fixtures.ts`, `vite.config.ts`,
> `messages/en.json` and `tr.json`. Contrast and coverage values not quoted from `language.md`
> were computed with its §1.2 method in the session scratch folder. **(judgement)** marks
> unmeasured choices.

# M9 component spec, family 02: Library and first run

## 0. Summary

- **Twelve components** replace today's five Home components (INV 4.1–4.5), the stage drop
  overlay (3.12), the drag states (14.8) and the Combined toast's copy (14.2): Library view,
  launcher, Library field, open-documents head, Library card, selection bar, Recents, restore
  and Start fresh, drop overlay, teaching sample, facts chip with its ⓘ fold, Library menu and
  footer.
- **One click opens a card.** Selection is a mode: the ○ on a card (hover), Select, a long
  press, right-click, Space or Shift/Mod-click. The selection bar is static: Combine · Compare ·
  Pages · Close, dimmed with a reason when a count does not fit (RA-21).
- **Combine asks nothing.** It makes the new document in card order, opens it in its Pages
  grid and shows "Combined 2 files · Undo" (INV-12, J3 = 3 mouse steps, 2 by drop).
- **Every Library text sits on glass or a masked band.** Launcher, cards and Recents are lit
  glass (dark) or M2 (light); footer items are M1 chips; the field is masked under the one
  bare head row (A-5).
- **The sample teaches by its text** (four pages, EN and TR, 250 KB both); `?sample` opens it
  from the About page.
- **Twenty-one issues for the lead** (§15), the largest: the 64 px light rule against lit
  Library cards, a text-safe mask the light module lacks, and `commit()` having to allow
  closing and reordering locked documents.

## 1. Family overview

### 1.1 How the parts work together

| Moment | Components in play | Result |
|---|---|---|
| First launch, nothing kept | L1 view, L2 launcher (empty), L3 field drifting, L12 footer | Open PDFs… has first focus and is the view's one lime (J1 = 2) |
| Try the sample, or `?sample` | L2 → L10 | A fresh "Recto sample.pdf" opens in viewing; L11 chip 600 ms later |
| Open or drop 2+ files | L9 → L1 with L5 cards checked, L6 bar up | Combine 2 files is lime (J3 = 3, by drop 2) |
| Return with `0`, ◆ or "‹ N" | L1, L4, L5, L7 | Focus on the card of the document just left (MC-3) |
| Launch with a kept session | L8 | The last place, each document where it was; toast "Restored 3 documents · Start fresh" |
| Reopen yesterday's work | L7 row | The snapshot opens with no prompt or picker (J14 = 1) |
| Files dragged over any view | L9, L3 | The field brightens; release opens |

### 1.2 Composition, desktop (large, 1440 × 900, three documents open, two selected)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ◆ [Library] report ● agreement letter-scan +                              ◎   ⋯    (F03)│ top strip 44, M3
│░░░░░░░░░░░░░░░░░░░░░░░░ L3 field, I 0.40, still ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░ ╭ L2 launcher row, lit glass, 88 high ──────────────────────────────────────────────╮ ░│
│░░ │ Library     [ Open PDFs…  ⌘O ]   Try the sample   Combine files…   Batch…        │ ░│
│░░ ╰───────────────────────────────────────────────────────────────────────────────────╯ ░│
│   L4 Open · 3 documents · 16 pages                                   [Done] Select all   │ masked band
│░░ ╭──────────╮ ╭──────────╮ ╭──────────╮                                                ░│
│░░ │◉┌──────┐ │ │◉┌──────┐ │ │○┌──────┐ │   L5 cards 184 × 284, lit glass, gap 16        ░│
│░░ │ │page 1│ │ │ │page 1│ │ │ │page 1│ │                                                ░│
│░░ │ └──────┘ │ │ └──────┘ │ │ └──────┘ │                                                ░│
│░░ │report ●  │ │agreement │ │letter-sc…│                                                ░│
│░░ │12 p · 2.4│ │4 p · 45 K│ │2 p · 315K│                                                ░│
│░░ │Edited·12…│ │✓Signed·🔒│ │No text…  │                                                ░│
│░░ ╰──────────╯ ╰──────────╯ ╰──────────╯                                                ░│
│░░ ╭ L7 Recent, lit glass ───────────────────────────────────────────── Clear recents ─╮ ░│
│░░ │ ▤ report-v2.pdf   10 pages · 2.4 MB · Edited, changes kept · yesterday         ⋯  │ ░│
│░░ │ Kept on this device while the browser keeps it · Manage                           │ ░│
│░░ ╰───────────────────────────────────────────────────────────────────────────────────╯ ░│
│      ╭ L6 selection bar, M2 44 ────────────────────────────────────────────────╮         │
│      │ 2 selected │ Combine 2 files │ Compare │ Pages │ Close │ ✕               │         │
│      ╰──────────────────────────────────────────────────────────────────────────╯        │
│ (● Nothing is uploaded)                                        (English · Türkçe)   L12 │ M1 chips
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Composition, phone (compact, 390 × 844)

```
First visit                      Three open, Select mode          Drag-over (any view, fine pointer
┌────────────────────────────┐  ┌────────────────────────────┐   or iPad drag)
│ ◆ Recto      ◎  EN · TR  ⋯ │  │ ◆ Recto              ◎  ⋯  │  ┌────────────────────────────┐
│░░░░░ field drifting ░░░░░░░│  │ 2 selected          Done   │  │▓▓▓▓ scrim, field bright ▓▓▓│
│░╭────────────────────────╮░│  │╭─────────╮ ╭─────────╮     │  │▓ ╭────────────────────╮ ▓▓▓│
│░│ Read, mark up, sign    │░│  ││◉ page 1 │ │◉ page 1 │     │  │▓ │   ⤓  (tray-arrow)  │ ▓▓▓│
│░│ and arrange PDFs.      │░│  ││report ● │ │agreement│     │  │▓ │ Drop to open 2     │ ▓▓▓│
│░│ Nothing leaves this    │░│  │╰─────────╯ ╰─────────╯     │  │▓ │ files              │ ▓▓▓│
│░│ device.                │░│  │╭─────────╮                 │  │▓ │ Nothing is uploaded│ ▓▓▓│
│░│ ╭────────────────────╮ │░│  ││○ page 1 │                 │  │▓ ╰────────────────────╯ ▓▓▓│
│░│ │   Open PDFs…  lime │ │░│  │╰─────────╯                 │  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│░│ ╰────────────────────╯ │░│  │╭ Recent ─────────────────╮ │  │                            │
│░│ Try the sample ›       │░│  ││▤ report-v2.pdf · kept·1d│ │  │                            │
│░│ Combine files…         │░│  │╰─────────────────────────╯ │  │                            │
│░╰────────────────────────╯░│  │╭──────────────────────────╮│  │                            │
│ (● Nothing is uploaded)    │  ││ ⧉       ◫       ▦      ✕  ││  │                            │
│                            │  ││Combine Compare Pages Close││  │                            │
└────────────────────────────┘  │╰──────────────────────────╯│  └────────────────────────────┘
                                └────────────────────────────┘
```

On compact the launcher card holds Open PDFs… (M-13 puts it in thumb reach as the card's last
row, 56 px from the bottom of the card); with documents open, Open PDFs… becomes the bottom M2
capsule that morphs into the selection bar (L6).

## 2. L1 Library view (place)

**1. Role.** The place `destination === 'home'` (code name kept) for J1, J3, J12, J14 and every
Library route of `flows.md` §2.1–§2.2, §4.6, §9.1. Replaces 4.1 (`home/HomeView.tsx` header and
layout) and the Home half of 3.1's drop logic.

**2. Anatomy.** One scroll column, max 1184 px (6 cards × 184 + 5 × 16), centred.

| Class | Gutter | Order top to bottom | Cards per row | Recents |
|---|---|---|---|---|
| compact | 16 + safe area | top bar (F03) · launcher (empty) or head · cards · Recent · bottom capsule | 2 | 1 column, compact rows |
| compact-height | 16 + safe area | top bar · head and cards left, Recent right (40 %) | 3–6 at 120 px | beside |
| medium | 24 | top strip · launcher row · head · cards · Recent · footer | 3 | 1 column |
| expanded | 32 | same | 4 | 1 column |
| large | 32 | same | 5 | 1 column |
| xlarge | 32 | same | 6 (cap) | 2 columns |

**3. Material and light.** The view itself is the canvas (`--canvas`, solid) with L3 behind its
content and no glass of its own; each child takes its tier (L2, L5, L7 lit; L6 M2; L12 M1).

**4. States.** Empty (L2 card, Recents if any) · with documents (launcher row, head, cards) ·
Select mode (`librarySelecting`) · drag-over (L9) · restoring (cards as skeletons, L8) · private
window (L7 note). No disabled or locked state at view level.

**5. Content and copy.** `aria-label` "Library" / "Kitaplık". Window title "Library · Recto" /
"Kitaplık · Recto".

**6. Behaviour.** Reached by ◆, `0`, "‹ N", closing the last document, first launch. Left by a
card, a tab, a Recents row, Open (one file), Try the sample. F6 regions on the Library: top strip
→ Library main (launcher, head, cards, Recent, footer) → selection bar → toasts. Tab order inside
main: launcher actions → Select → cards (one stop) → Clear recents → Recent rows (one stop) →
footer chips. First focus: Open PDFs… when no document is open (J1); otherwise the card of the
document last shown. Esc in the Library: clears the selection, then leaves Select mode; never
navigates.

**7. Motion.** *view change* Library ⇄ document (MC-2, MC-3): the card's thumbnail morphs to page
1 (`view-transition-name: doc-<id>`), root cross-fade, 240 ms; Recents rows and Try the sample
have no shared element (root cross-fade). Reduced: 150 ms root cross-fade, no names.

**8. Accessibility.** `<main aria-label>`; one `h1` (visually the launcher headline when empty,
visually hidden "Library" otherwise); A-12 (`scroll-padding-bottom` = bottom capsule or bar + 16),
A-13 (exiting bar `inert`), A-20 (no horizontal scroll at 320 × 256: cards drop to 1 column under
352 px).

**9. Implementation.** `home/LibraryView.tsx` replaces `home/HomeView.tsx`; layout in
`LibraryView.module.css` with container queries on the column. Store: `ui-store` keeps
`destination`, `homeSelection`, `homeAnchor`; adds `librarySelecting: boolean` (session only).
Tests: browser-mode `LibraryView.test.tsx` (first focus per case, F6 order, Esc ladder); e2e
`library.spec.ts` (routes in and out, focus after `0` lands on the last card); axe on empty,
with files and Select mode.

## 3. L2 Launcher

**1. Role.** The welcome moment (RA-19, X-6, FL-R10) and the Library's open actions: Open PDFs…,
Try the sample, Combine files…, Batch…. J1, J3, flows §9.1, §4.6. Replaces 4.3
(`shell/EmptyState.tsx`) and 4.1's Open files button.

> **2026-10-09 (owner feedback G3).** With documents open the view no longer repeats the mark:
> the Library tab keeps it, and the view heads itself with a large "Library" title (display,
> 600) and "Nothing leaves this device." under it. The row is one lit surface of equal buttons,
> one piece high (`--piece-h`: 40 fine, 48 coarse, the strip's pieces and the footer's pills
> alike): Open PDFs… first and lime, Try the sample · Combine files… · Batch… after it, and the
> drop line trailing; the whole row is the drop target (a dashed accent line while dragging),
> so the dashed well stays in the empty card only.

**2. Anatomy.**

```
Empty, fine (expanded and up), centred at 35 % height over the field lobe (0.5, 0.35)
╭──────────────────────────── 560 ────────────────────────────╮
│  [Recto glyph 48, duotone]                                    │ 32 pad
│  Read, mark up, sign and arrange PDFs.        title1 28/36    │
│  Nothing leaves this device.                  callout 15/20   │
│                                                               │
│  [ ⌂ Open PDFs…   ⌘O ]   Try the sample ›   Combine files…    │ 36 fine / 44 coarse
│  or drop files anywhere                       footnote, n11   │ fine pointer only
╰───────────────────────────────────────────────────────────────╯ about 320 high
With documents (medium and up): one row, lit glass, 88 high (96 coarse), full column width
╭─────────────────────────────────────────────────────────────────────────────────╮
│ Library  title2   [ Open PDFs…  ⌘O ]   Try the sample   Combine files…   Batch…  │
╰─────────────────────────────────────────────────────────────────────────────────╯
Compact, empty: card 358 wide, text left-aligned, buttons stacked full width 56 high,
Open PDFs… last (thumb reach), then Try the sample ›, Combine files… as 44 px text rows.
Compact with documents: no launcher; Open PDFs… is the bottom capsule; Try the sample,
Combine files… and Batch… move to the Library menu (L12).
```

**3. Material and light.** Lit glass (§2.5): no page ever passes under it and it is the field's
natural frame. σ 28 for the card (c 1.000 at 560 × 320 and 358 × 300); σ 16 for the 88 px row
(c 0.994; σ 28 would give 0.80, see Issue 4). Rim and shadow as M2, shadow e0 (it rests on the
canvas). Light theme: M2 light tier (lit glass is dark-only). Tinted: alpha 0.90. Solid: n4 (dark),
n1 (light) with rim. Forced colours: `Canvas` with a 1 px `CanvasText` border.

**4. States.**

| State | Change |
|---|---|
| Rest | Open PDFs… `--primary-fill` / `--primary-ink` (the view's one lime) unless Select mode is on, when it turns secondary (n5 fill, n12 text) |
| Hover | Buttons: one fill step (`--accent-hover` on the primary; white 0.045 wash on secondary, behind primary text only, §2.6) |
| Pressed | *press*: scale 0.97 mouse, 0.94 touch; primary fill `--accent-pressed` (light: `#000`) |
| Focus-visible | Two-band ring, capsule form (inset), §9.2 |
| Disabled | Combine files… never disabled; Batch… is disabled only offline before its worker is cached: "Batch needs to load once with a connection" |
| Busy | After a pick: Open PDFs… becomes a progress capsule "Opening 3 files… 1 of 3" with the ring (no spinner before 400 ms, MC-33) |
| Error | None in place; failures are toasts (L9 table) |
| Drag-over | Copy changes (L9); the card lifts 2 px, shadow e3 |
| Empty | It is the empty state |

**5. Content and copy.**

| Element | English | Turkish | Icon |
|---|---|---|---|
| Headline | Read, mark up, sign and arrange PDFs. | PDF'leri okuyun, işaretleyin, imzalayın ve düzenleyin. | Recto glyph |
| Line | Nothing leaves this device. | Hiçbir şey bu cihazdan çıkmaz. | — |
| Primary | Open PDFs… | PDF aç… | `folder-open` |
| Secondary | Try the sample | Örnek belgeyi deneyin | `book-open-text` |
| Secondary | Combine files… | Dosyaları birleştir… | custom *combine* (fallback `stack`) |
| Secondary | Batch… | Toplu işlem… | `list-checks` |
| Hint (fine only) | or drop files anywhere | ya da dosyaları istediğiniz yere bırakın | — |
| Row title | Library | Kitaplık | — |

The Turkish headline is 55 characters against 37: at 28 px it wraps to two lines inside 496 px,
balanced (`text-wrap: balance`); on compact three lines at 28/36. Keycaps (⌘O, Ctrl O) only after
a physical key press on coarse pointers (§6.2).

**6. Behaviour.**

| Input | Open PDFs… | Try the sample | Combine files… | Batch… |
|---|---|---|---|---|
| Click, tap, Enter, Space | System picker, multiple; 1 file → document (viewing); 2+ → Library with the new cards checked (Select mode, L6 up) | L10 | Picker, multiple; 2+ → one new document, combined in pick order, opened in its Pages grid; sources are not opened as documents (Issue 10); 1 file → opened, toast "Choose two or more files to combine" | Batch sheet (family 12) |
| Key | Mod+O anywhere | ⌘K "sample" | ⌘K "combine files" | ⌘K "batch" |

Guard: none of the four change an open document. Focus after: the page of the opened document
(A-13); the first new card when 2+ arrive; the first cell of the combined grid; the sheet's
first field. Announcements (polite): "Opened report.pdf", "Opened 3 files, 3 selected",
"Combined 2 files into Combined – a + b. Undo with Ctrl+Z" (EN/TR via Paraglide plurals).

**7. Motion.** Entrance on arrival: *materialize* (rim 0 → value over the last 40 %) while L3
plays *light respond* arrival; *press*; *view change* to the opened document; Open PDFs… to
progress capsule by *replace* on its glyph and *progress*. Reduced: fades only.

**8. Accessibility.** Buttons with visible names; Open PDFs… `aria-keyshortcuts="Control+O"` or
`Meta+O`. Targets 36 fine / 44 coarse (56 on compact). Pairs: ink on lime 16.42; lime fill vs lit
glass over the field peak 7.39 (computed); primary text on lit 7.38, glass-secondary 4.80 (§2.2).
Light: lime on ink 14.79. A-3, A-5, A-11, A-15, A-21 (Turkish wraps, no fixed widths).

**9. Implementation.** `home/Launcher.tsx` + `Launcher.module.css` (replaces
`shell/EmptyState.tsx`, its CSS and the Keycaps hint rows); `library-actions.ts`
`openPdfs()`, `combineFiles()` (open, `mergeAll`, close sources in one composed history step:
`applyComposed`). Base UI: plain buttons. Tests: unit `combineFiles` makes one history entry and
one document; browser-mode first focus and the lime moving to Combine in Select mode; e2e J1 (2
steps), "Combine files…" (2 steps + picker) on Chromium, WebKit, Firefox; rendered-pixel lit card
over the field cap (`glass-pixels.spec.ts`).

## 4. L3 Library field

**1. Role.** The aurora's place on the Library and the drop overlay (`language.md` §3.2, AU-4,
AU-13); the only light on the Library. New; nothing replaced.

> **2026-10-09 (owner feedback G2, G3, G5).** Until the WebGL field lands, its CSS form
> (`home/Aura.tsx`) is richer and slowly alive: five soft lobes drift on 37–59 s loops by
> transform and opacity alone, paused while the document is hidden, still under reduced motion
> (quality-bar Q-10's one exception). The view reaches up under the top strip, so no band of
> bare canvas shows between the pieces. Settings › Background glow (on by default) shows the
> same aura, dimmer and still, behind the reader's canvas.

**2. Anatomy.** Full-window WebGL canvas behind the Library column (backdrop root shared with
every Library glass, §3.1). Lobes: empty (0.5, 0.35, gain 1.0, r 0.42) under the launcher card,
(0.82, 0.78, 0.6, 0.35); with documents, lobes between card rows, never centred on a thumbnail
(positions recomputed on a 150 ms ResizeObserver). A **text-safe band** multiplies intensity to 0
within 24 px of the L4 head row (one rect uniform; Issue 2).

**3. Material and light.** Rest I 0.45 empty (Auto drifts, settles after 60 s idle), I 0.40 with
documents (still). Under lit glass the field is capped at I 0.6 (`--light-cap-under-glass`).
Light theme: pigment (§1.6). Ambient light Still: one frame; Off, forced colours, more contrast:
`display: none`; Glass Solid: Still at I × 0.7.

**4. States.**

| State | Change (§3.3 springs) |
|---|---|
| Arrival | I 0 → rest, speed 0.12 → 0 over 4 s (60, 15.5) |
| Drag-over | I +0.15 (cap 0.6), speed 0.30, nearest lobe ×1.3 and follows the pointer (80, 18) |
| Card opened, closed, reordered | 2 s drift at 0.12 |
| Success (Combine undo restored, sample opened, session restored) | Library I +0.10 for 1.2 s |
| Paused | Hidden tab, unfocused 5 s, scroll, drag of a card, a sheet over the Library, battery < 20 % |
| Error, deletion | No response (A-6, AU-12) |

**5. Content and copy.** None; `aria-hidden="true"`.

**6. Behaviour.** Pointer-transparent. Lazy-loaded (≤ 4 KB gzip) when the Library or the drop
overlay first shows; CSS four-gradient fallback without WebGL.

**7. Motion.** *light respond*; reduced: still frame, ≤ 200 ms opacity responses.

**8. Accessibility.** A-5 (no text on bare light above Y 0.026: the text-safe band), A-6, A-7
(Ambient light pauses the drift, WCAG 2.2.2), A-8, A-14, A-23.

**9. Implementation.** `light/LibraryField.tsx` mounting `light/field.ts` with a `lobes` and a
`textSafe` prop. Tests: `motion.spec.ts` zero frames after 60 s idle and under both reduce paths;
`glass-pixels.spec.ts` Library mean Y ≤ 0.03 and Y ≤ 0.026 under the head row; the flash sampler.

## 5. L4 Open documents head

**1. Role.** Names the open set and holds the Select toggle (M-13, flows §6.5–§6.8 "Open · 3
documents · 16 pages · Select"). Replaces 4.1's summary text.

**2. Anatomy.** One row, 32 px fine / 44 coarse: leading "Open · 3 documents · 16 pages"
(footnote 550, n10 on the masked canvas band); trailing **Select** (text button), in Select mode
**Done** and **Select all**. Compact: "Open · 3" leading; in Select mode the leading text becomes
"2 selected" and the trailing button Done (the count leaves the phone bar, Issue 17).

**3. Material and light.** No glass: text on the canvas inside the field's text-safe band.

**4. States.** Select: `aria-pressed=false/true`; on Done label swaps by *replace*. Select all
disabled when every card is checked ("All documents are selected"). Hover: white 0.045 wash
(dark), ink 0.04 (light). Focus: two-band ring.

**5. Content and copy.**

| English | Turkish |
|---|---|
| Open · 3 documents · 16 pages | Açık · 3 belge · 16 sayfa |
| Select · Done · Select all | Seç · Bitti · Tümünü seç |
| 2 selected | 2 seçili |

Numbers in `tnum`.

**6. Behaviour.** Select toggles `librarySelecting`; entering shows ○ on every card, leaving
clears the selection. Keys: none of its own (Space on a card enters Select). Announcements:
"Select mode. Space checks a document, Enter opens it" / "Seçim modu. Boşluk belgeyi işaretler,
Enter açar"; "Select mode off". Focus stays on the button.

**7. Motion.** *replace* on the label; ○ appear by *select* fade (120 ms). Reduced: instant.

**8. Accessibility.** Toggle button with `aria-pressed`; n10 on canvas 8.05 (dark n1), 7.61
(light n1). A-13, A-15.

**9. Implementation.** In `home/LibraryHead.tsx`; Base UI `Toggle`. Tests: browser-mode toggle and
announcements; phone project head swap.

## 6. L5 Library card

**1. Role.** One open document: one click opens it (flows §4.6), ○ selects it, drag reorders
`documentOrder` (INV-19, the same order as tabs and Combine). Serves J2, J3, J12, J14. Replaces
4.2 and its card-on-card combine drop.

**2. Anatomy.**

```
Fine 184 × 284                  Coarse 200 × 312            Compact (390) 173 × 262
╭──────────────────────╮        thumb 176 × 220             thumb 157 × 196, pad 8
│◯┌──────────────────┐ │ 12 pad name 15/20, lines 13/18     name 15/20 one line
││ │                  │ │                                    line 2 13/18
│  │ first page,      │ │ ○ 24 visual, 8 in from the
│  │ 160 × 200 box    │ │ thumbnail's top-leading corner;   Compact-height 120 × 176, σ 20
│  │ (solid content)  │ │ hit 32 fine / 44 coarse            name only, line 2 on focus
│  └──────────────────┘ │
│ ● report.pdf      ●  │ ← tag dot · name 13/18 550 middle-truncated · edited ●
│ 12 pages · 2.4 MB    │ ← footnote 12/16 500, glass-secondary
│ Edited · 12 fields   │ ← state · top fact, one line, end-truncated
╰──────────────────────╯ radius-lg 16 (22 squircle)
```

**3. Material and light.** Lit glass (AU-9): the card frames an opaque thumbnail and no page
passes under it. σ 28 (c 0.999 fine, 0.998 compact), σ 20 in compact-height (c 0.997). Shadow e0
at rest. The thumbnail is content: page white, light hairline, never themed. Light theme: M2
light tier. Tinted 0.90; Solid n4 / n1 with rim; forced colours `Canvas`, 1 px `CanvasText`,
selected 3 px `Highlight`.

**4. States.**

| State | Change |
|---|---|
| Rest | `.mat-lit`, e0, ○ hidden (fine, not selecting) |
| Hover (fine) | Lift: `translateY(-2px)`, e0 → e3 (no wash, §2.5); ○ fades in (the empty check badge, `06` §2.2, legible over white) |
| Pressed | *press*: scale 0.98 mouse, 0.96 touch (Issue 5); press light white 0.12 / 0.24 |
| Focus-visible | Two-band ring, `outline-offset: 2px`, follows the radius; ○ shown |
| Selected | Amended 2026-10-08 (owner feedback F4): the Pages grid's look (`06` §2.2): the check badge filled `--select` inside the first page's top-trailing corner (inset 6, 40 px hit, 48 coarse), never over the card's text, and a 2 px `--select` ring 2 px out around the page; `aria-selected="true"` |
| Select mode, unselected | ○ always shown |
| Disabled | Never |
| Loading (opening, restoring) | Name shown; skeleton at the page's aspect ratio (n3 dark, `#eff0f3` light), then low resolution, then sharp, fade 120 ms (X-5); line 3 "Opening…" |
| Error | No card; a toast (L9) |
| Locked | Line 3 starts with `lock-simple` + "Locked", `seal-check` + "Signed · locked", or "Restricted by the file"; no tint (A-19) |
| Edited | ● after the name and "Edited" in line 3; "Edited · not kept in this window" with `warning` when storage is off |
| Dragging (reorder) | Source 40 % opacity; a 2 px `--accent-line` insertion caret between cards |

**5. Content and copy.**

| Item | English | Turkish |
|---|---|---|
| Line 2 | 12 pages · 2.4 MB | 12 sayfa · 2,4 MB |
| States | Edited · Locked · Signed · locked · Restricted by the file · Opening… | Düzenlendi · Kilitli · İmzalı · kilitli · Dosya kısıtlıyor · Açılıyor… |
| Facts (short) | 12 form fields · No text on 2 pages · Contents · 8 chapters | 12 form alanı · 2 sayfada metin yok · İçindekiler · 8 bölüm |
| Accessible name | report.pdf, 12 pages, 2.4 MB, edited, kept on this device, 12 form fields | report.pdf, 12 sayfa, 2,4 MB, düzenlendi, bu cihazda saklanıyor, 12 form alanı |
| Check (○) | Select report.pdf | report.pdf belgesini seç |

Line 3 at 12 px holds about 26 characters in 160 px; "Düzenlendi · 12 form alanı" is 26.
The full line is the tooltip and part of the name. Sizes use `formatFileSize` (locale decimal),
`tnum`.

**6. Behaviour.**

| Input | Not selecting | Select mode |
|---|---|---|
| Click / tap on the card | Opens in viewing (*view change*) | Toggles |
| Click on ○ | Checks it and enters Select mode | Toggles |
| Shift-click · Mod-click | Range from the anchor · toggle; enters Select mode | Same |
| Double-click / double tap | Opens (one click already did; no second action) | Opens |
| Long press 450 ms (M-20) · right-click · Shift+F10 | Enters Select mode with this card checked | Toggles |
| Drag (mouse 4 px; touch after a 450 ms lift) | Reorders the cards (= tabs, = Combine order) | Same |
| Pen | As mouse | As mouse |
| Arrows · Home · End | Move focus (grid step by measured columns) | Same |
| Shift+arrows | Extend from the anchor; enters Select mode | Same |
| Space | Checks and enters Select mode | Toggles |
| Enter | Opens | Opens |
| Mod+A | Selects all; enters Select mode | Same |
| Alt+Left / Alt+Right | Moves the card one place (2.5.7 alternative to drag) | Same |
| F2 | Renames inline under the thumbnail (Enter commits, Esc cancels) | — |
| Delete | — (no selection visible) | Closes the selection (= L6 Close) |
| Esc | — | Clears, then leaves Select mode |

Guard: opening, selecting, reordering and closing change no document and need no
`canChange` (Issue 8); F2 asks `canChange(id, 'document')` and on a locked document opens the Lock
popover. Focus after: opening → the page; close → the card now at the same index, else the
previous, else Open PDFs…; reorder → the moved card. Announcements: "report.pdf, 1 of 3
selected"; "Moved report.pdf to position 2 of 3"; "Renamed to …". `-webkit-touch-callout: none`
on cards (M-20).

**7. Motion.** Hover lift on `--spring-quick`; *press*; *select* on ○; *lift and settle* + *reflow*
for reorder (MC-27, MC-29, fling at the drop); close by *reflow* (deleted card `scale(0.9)` + fade
120 ms); *view change* into the document. Interruption: hover retargets; a drag cancels the
press. Reduced: lift becomes the e3 shadow only; reorder and close instant.

**8. Accessibility.** `role="option"` in a `listbox aria-multiselectable` with roving tabindex
(today's model kept); ○ is `aria-hidden` (the option carries the state). Hit areas: card whole;
○ 32 / 44. Pairs: primary on lit 7.38, glass-secondary 4.80 (worst, field peak); light: ink on
M2 11.53, n11 6.46. Selection ring lime vs lit 7.39, lime-800 vs light M2 4.22 (≥ 3:1). A-3,
A-11, A-15, A-19, A-21.

**9. Implementation.** `home/LibraryCard.tsx`, `home/LibraryGrid.tsx` (listbox, roving,
long-press through `motion/` gesture core, drag via `dnd/` with pointer events, not HTML5
`draggable`); `home/library-model.ts` (from `home-model.ts`: keeps `clickSelection`,
`toggleSelection`, `gridStep`, `rangeBetween`, `formatFileSize`, `middleTruncate`; adds
`cardFacts()`, `cardState()`; deletes `dropOrder`). `workspace-store` gains `moveDocument(id,
toIndex)` (document-model operation, one history entry "Moved report.pdf"). Tests: unit
`library-model.test.ts`; browser-mode keys, long press, Alt+arrows, focus after close; e2e
reorder by drag changes tab order; phone project long-press select; axe; rendered-pixel card over
the field at its cap.

## 7. L6 Selection bar

**1. Role.** Acts on checked cards: Combine · Compare · Pages · Close (flows §4.6; J3, J12).
Replaces 4.1's buttons, the merge dialog from Home (12.13's "keep sources" path) and "Arrange
pages".

**2. Anatomy.**

```
Medium and up, fine 44 high (coarse 56), bottom centre, 16 px above the window edge
╭──────────────────────────────────────────────────────────────────────────╮
│ 2 selected │ [⧉ Combine 2 files] │ ◫ Compare │ ▦ Pages │ ✕ Close │  ✕   │
╰──────────────────────────────────────────────────────────────────────────╯ about 520
Compact: the bottom capsule (358 × 56 + safe area) morphs from "Open PDFs…" into four labelled
icons, 64 high, labels under icons (caption 12/16 500):
╭──────────────────────────────────────╮
│   ⧉         ◫          ▦         ✕   │
│ Combine  Compare    Pages     Close  │
╰──────────────────────────────────────╯
```

**3. Material and light.** M2 bar (it floats over cards that scroll under it). σ 8 at 44 (c
0.994), 10 at 56 (c 0.995) and on the phone capsule (c 0.995). Rim M2, e3. No light (AU-5:
none under bars that arm nothing). Tinted, Solid (`--glass-bar-solid`), forced colours `Canvas`.

**4. States.**

| Control | Enabled when | Disabled form (aria-disabled, focusable) and reason (tooltip and `aria-describedby`) |
|---|---|---|
| Combine N files | 2+ checked; lime fill (the view's one lime in Select mode) | 1 checked: `--glass-text-disabled`; "Select two or more documents to combine" |
| Compare | Exactly 2 | "Select exactly two documents to compare" |
| Pages | 1+ | — |
| Close | 1+ | — |
| ✕ | Always | — |

Busy: Combine over 200 pages becomes a progress capsule "Combining… 40 %" with the ring. Error:
toast "Could not combine: agreement.pdf could not be read". Locked sources: allowed (Combine reads
them; the new document follows "Open documents locked").

**5. Content and copy.**

| English | Turkish | Icon |
|---|---|---|
| 2 selected | 2 seçili | — |
| Combine 2 files (phone: Combine) | 2 dosyayı birleştir (telefon: Birleştir) | custom *combine* |
| Compare | Karşılaştır | custom *compare* (fallback `git-diff`) |
| Pages | Sayfalar | `squares-four` |
| Close | Kapat | `x-circle` |
| ✕ (its name): Clear selection | Seçimi kaldır | `x` |
| Toast | Combined 2 files · Undo | 2 dosya birleştirildi · Geri al |
| Toast | Closed 2 documents · changes kept · Reopen | 2 belge kapatıldı · değişiklikler saklandı · Yeniden aç |

Phone label width: "Karşılaştır" is 11 characters, about 70 px at 12/16 500, inside an 85 px slot.

**6. Behaviour.**

| Control | Does | Focus after | Announcement |
|---|---|---|---|
| Combine | New document "Combined – A + B" from the checked cards **in card order** (Issue 9), sources stay open; *view change* to its Pages grid; one history entry; toast with Undo (≥ 10 s) | First cell of the new grid | "Combined 2 files. Undo with Ctrl+Z" |
| Compare | Compare place; older file (modified time, else card order) as A; Swap in its bar | Compare bar | "Comparing a.pdf with b.pdf" |
| Pages | Pages grid, scope All open, showing the checked documents as sections | First cell | "Pages of 2 documents" |
| Close | Closes the checked documents as one step; snapshots go to Recents; toast "Closed … · Reopen" (Reopen = undo) | As L5 close | "Closed 2 documents. Changes kept" |
| ✕ | Clears and leaves Select mode | The card that had focus | "Select mode off" |

Keys: Tab moves inside the bar (Base UI Toolbar, arrows also); `4` with exactly two checked
compares; Delete closes; Mod+Z after Combine undoes it. Guard: none (Issue 8). Edge: a checked
document closed elsewhere drops out (`liveSelection`); with 0 left the bar leaves.

**7. Motion.** Medium and up: *tier rise* in, exit 100 ms; compact: *bar morph* from the Open
capsule (`clip-path`, 15 ms chip stagger), back on leaving; label count by *replace*; Combine to
progress by *replace* + *progress*; toast *toast*; success *success* on the toast's ring.
Reduced: fade; morph becomes a 120 ms cross-fade.

**8. Accessibility.** `role="toolbar"` named "Selected documents" / "Seçili belgeler"; in the F6
cycle; `inert` from its first exit frame (A-13). Targets 36 / 44 inside 44 / 56; phone slots 85 ×
64. Pairs: primary on M2 over white 7.90; ink on lime 16.42; glass-secondary 5.14. A-4, A-15, A-24.

**9. Implementation.** `home/SelectionBar.tsx` (Base UI `Toolbar`, `Tooltip` for reasons);
`library-actions.ts`: `combineNow(ids)` (calls `mergeAll(ids, combinedTitle(...), {keepSources:
true})`, then `ui.openGrid(newId)`), `compareSelected`, `pagesSelected` (replaces
`arrangeOnHome`, sets `gridScope: 'all'`), `closeSelected` (today's `closeOnHome`). Toasts through
`ui/Toast` (family 14). Delete: the `combine()` → `openOperationDialog({ kind: 'merge-all' })`
call, `home/CombinedToast.tsx`, `home/combined-toast.ts`. Tests: unit order and title; browser-mode
dimmed reasons reachable by Tab, `4` with two; e2e J3 = 3 mouse steps and 2 by drop, J12 = 3,
touch J3 = 3 in the phone project; undo of Combine removes only the new document; axe.

## 8. L7 Recents

**1. Role.** Closed documents with their snapshots ("Edited, changes kept") and files opened
lately; a row reopens the snapshot with no prompt or picker on every browser (flows §5.2; J14).
Replaces 4.4 and 4.5.

**2. Anatomy.**

```
Lit panel, column width, radius-xl 20, rows 40 fine / 52 coarse (44 min hit), up to 12 rows
╭ Recent                                                            Clear recents ╮ head 32
│ ▤  report-v2.pdf            10 pages · 2.4 MB · Edited, changes kept · yesterday  ⋯ │
│ ▤  lease.pdf                 4 pages · 1.1 MB · 2 days ago                        ⋯ │
│ Kept on this device while the browser keeps it · Manage                            │ footnote
╰─────────────────────────────────────────────────────────────────────────────────────╯
Compact: two lines per row (name 15/20; "10 p · kept · 1 d" 13/18); ⋯ always shown (44).
Xlarge: rows in two columns of 6.
```

**3. Material and light.** Lit glass panel, σ 28 (c 0.9996 at 1136 × 200); σ 20 on compact and
coarse (a two-row phone panel 358 × 132 gives 0.999; σ 28 would give 0.968). Rows are fills
inside it, not glass. Light theme M2. Tinted, Solid, forced colours as L5.

**4. States.**

| State | Change |
|---|---|
| Row hover | One fill step: white 0.045 behind primary text only (lit takes no wash on its surface, the row fill is n5 at 0.5 inside a well; judgement) |
| Row pressed · focus | *press* (0.98) · two-band ring inset (`.capsule` form) |
| Kept | Line shows "Edited, changes kept"; reopens the snapshot |
| Needs permission · Open again… | Today's hints (Chromium handle needing a grant · no handle) |
| Expired snapshot | Row drops "changes kept" and reopens like a plain recent |
| Loading | Row text "Opening…", ring on the toast's progress capsule |
| Error | Note under the row (today's `recents_note_unavailable`), plus a toast |
| Private window / OPFS refused | Panel footnote "Changes are not kept in this window" with `warning` |
| Clear failed | Today's `recents_clear_failed` note |
| Empty | Panel absent (no placeholder) |

**5. Content and copy.**

| English | Turkish |
|---|---|
| Recent · Clear recents | Son açılanlar · Son açılanları temizle |
| 10 pages · 2.4 MB · Edited, changes kept · yesterday | 10 sayfa · 2,4 MB · Düzenlendi, değişiklikler saklandı · dün |
| Needs permission · Open again… | İzin gerekiyor · Yeniden aç… |
| ⋯ Remove from Recent · Remove and delete kept changes | Son açılanlardan kaldır · Kaldır ve saklanan değişiklikleri sil |
| Kept on this device while the browser keeps it · Manage | Tarayıcı izin verdiği sürece bu cihazda saklanır · Yönet |
| Changes are not kept in this window | Bu pencerede değişiklikler saklanmaz |
| Confirm title: Clear recent files? | Son açılan dosyalar temizlensin mi? |
| Confirm body: Kept changes for 2 documents are deleted from this device. Saved files are not touched. | 2 belgenin saklanan değişiklikleri bu cihazdan silinir. Kaydedilmiş dosyalara dokunulmaz. |
| Confirm buttons: Clear · Cancel | Temizle · Vazgeç |
| Toast: Removed report-v2.pdf and its kept changes · Undo | report-v2.pdf ve saklanan değişiklikleri kaldırıldı · Geri al |

Relative times by `Intl.RelativeTimeFormat` (`relativeTime`); sizes `tnum`. Icons: row `file`
(`file-text` when kept, with a 6 px n12 dot), ⋯ `dots-three`, warning `warning`.

**6. Behaviour.** Click, tap, Enter: reopen (snapshot → document at its page, zoom, surface and
lock; handle → Chromium permission within the click; else the picker with the note). Up/Down/
Home/End move; Right reaches ⋯, Left returns; Delete removes (today's keys). Removing a kept row:
the snapshot deletion waits 10 s behind the toast's Undo, then runs. Clear recents: with any kept
rows, the confirmation (M5 centred, phones modal sheet; Clear is `--danger` text on a secondary
button, no lime); without kept rows, it clears at once with "Recents cleared · Undo". Manage
opens Settings → Documents and storage. Guard: none (device storage, not documents). Focus after:
reopen → the page; remove → next row, else previous, else Clear recents' successor. Rows matching
an open document stay hidden (`visibleRecents`). The sample enters Recents only once changed.

**7. Motion.** *press*; removal by *reflow*; *view change* (root cross-fade) on reopen; *dialog*
for the confirmation; *toast*. Reduced: instant, fades.

**8. Accessibility.** `section aria-labelledby` the heading; `ul` of buttons with roving tabindex
(today's), each with the full label ("report-v2.pdf, 10 pages, 2.4 MB, edited, changes kept,
yesterday"); ⋯ `aria-label` "More actions for report-v2.pdf". Rows 44 coarse min. Pairs as L5.
A-13, A-15, A-21, A-24.

**9. Implementation.** `home/RecentList.tsx`, `home/RecentRow.tsx` (from `HomeView.tsx`);
`files/recents.ts` records gain `kept?: { snapshotId, keptAt, bytes }`, filled by the `session/`
module (Issue 16); `library-actions.ts` `openRecent` tries the snapshot first. Confirmation through
`ui/Sheet` (Base UI `AlertDialog`). Tests: unit retention marks rows expired; e2e J14 on WebKit
and Firefox reopens an edited document after reload with no picker and the edit present; Clear with
kept rows asks, without does not; private-window project shows the note; axe.

## 9. L8 Restore on launch and the Start fresh toast

**1. Role.** "Nothing is lost": launch reopens the last session in tab order, each document where
it was (flows §2.2, §5.2; J14 = 0). New; answers INV-7.

**2. Anatomy.** No surface of its own while restoring: the last place renders at once with
skeleton pages (and skeleton cards on the Library), the active document first, the others lazily.
Then one toast (family 14 anatomy) above the dock or at the Library's bottom centre:

```
╭───────────────────────────────────────────────╮
│ ✓ Restored 3 documents          Start fresh   │ M2 toast 48 high, ≥ 10 s, paused on hover/focus
╰───────────────────────────────────────────────╯
```

**3. Material and light.** M2 toast, σ 9 (360 × 48, c 0.992). Library success pulse (I +0.10, 1.2
s) when the restored place is the Library; no light in a document view.

**4. States.**

| State | What shows |
|---|---|
| Restoring | Skeleton pages and cards; the toast stack's progress capsule after 400 ms: "Restoring 3 documents… 1 of 3" with the ring |
| Done | "Restored 3 documents · Start fresh" (one: "Restored report.pdf · Start fresh") |
| Partial | Done toast for the rest, plus an error toast that stays: "Could not restore agreement.pdf: its kept copy is damaged. The original file is unchanged." with "Open original…" when a handle exists |
| Start fresh pressed | Every restored document closes as one step; the Library launcher shows; toast "Started fresh · 3 documents kept in Recent · Undo" |
| Nothing kept, private window, storage refused | No toast; the Library (L7 note in a private window) |
| Locked documents | Restored locked (the lock is in the snapshot); Markup never restored |

**5. Content and copy.**

| English | Turkish |
|---|---|
| Restored 3 documents · Start fresh | 3 belge geri yüklendi · Baştan başla |
| Restored report.pdf · Start fresh | report.pdf geri yüklendi · Baştan başla |
| Restoring 3 documents… 1 of 3 | 3 belge geri yükleniyor… 1 / 3 |
| Started fresh · 3 documents kept in Recent · Undo | Baştan başlandı · 3 belge son açılanlarda saklanıyor · Geri al |
| Could not restore agreement.pdf: its kept copy is damaged. The original file is unchanged. · Open original… | agreement.pdf geri yüklenemedi: saklanan kopyası bozuk. Asıl dosya değişmedi. · Asıl dosyayı aç… |

**6. Behaviour.** Restores `destination` (`home` or `document`) and the active document; a
comparison is not restored (it is a UI session), so the launch lands on its document A (Issue 7).
Start fresh: click, Enter, or ⌘K "start fresh"; F6 reaches the toast (A-24). Focus is not moved to
the toast; after Start fresh, focus goes to Open PDFs…; after Undo, back to where it was. A `?sample`
in the URL opens the sample as one more tab after the restore. Announcement (polite, once): "Restored
3 documents. Start fresh is in the notice, F6". Undo after restore: the 20-step history tail
(flows §5.2) is live.

**7. Motion.** First paint has no transition; *toast* in; *progress*; *success* (check pops) on
done; Start fresh → *view change* to the Library. Reduced: fades.

**8. Accessibility.** Toast `role="status"`; error toast `role="alert"` only if the active document
failed (blocking), else `status`. Action ≥ 44 coarse. A-13, A-24.

**9. Implementation.** `session/restore.ts` (API from the saving spec: `readSession()`,
`restoreDocument()`), `home/restore-toast.ts` (copy, Start fresh = one composed close step);
`ui-store` reads `destination` from the snapshot. Tests: unit plurals EN/TR; e2e reload restores
three documents in order at their pages and Undo still works (20 steps), Start fresh then Undo,
damaged snapshot shows the error toast and keeps the others; motion sweep (no VT at launch).

## 10. L9 Drop overlay and drag-over light

**1. Role.** Files dragged from the desktop open anywhere (J1 by drop 1, J3 by drop 2). Replaces
3.12 (`Stage.tsx` overlay), 14.8 and `EmptyState`'s dragging copy; keeps 3.1's depth counter.

**2. Anatomy.**

```
Document view (viewing or Markup): scrim + field + lit card, centred in the free rectangle
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓▓▓▓▓ ╭──────────── 360 ────────────╮ ▓▓▓▓▓
▓▓▓▓▓ │      tray-arrow-down 32      │ ▓▓▓▓▓   card 360 × 200 (phone and iPad 300 × 180)
▓▓▓▓▓ │      Drop to open 2 files    │ ▓▓▓▓▓   title3 17/22
▓▓▓▓▓ │ Files open on this device    │ ▓▓▓▓▓   footnote, glass-secondary
▓▓▓▓▓ │ and are never uploaded.      │ ▓▓▓▓▓
▓▓▓▓▓ ╰──────────────────────────────╯ ▓▓▓▓▓
Library: no scrim and no new card; the launcher card (empty) or launcher row lifts and its
headline swaps to "Drop to open 2 files"; the field responds (AU-13).
Pages grid, Compare: no overlay (the grid draws insertion targets, family 10; Compare: below).
```

**3. Material and light.** Scrim dark `rgb(5 6 8 / 0.50)`, light `rgb(21 23 28 / 0.28)`, dim only
(G-31). The field renders behind the scrim, the only time it enters a document view (§3.2), lobe
under the card. Card lit glass σ 28 (c 0.9996; phone 0.9987); light theme M2 over pigment. Solid:
n4 card, field Still × 0.7. Forced colours: `Canvas` card with a 2 px `CanvasText` dashed border,
no field.

**4. States.**

| State | Change |
|---|---|
| Drag enters (files only, `dragHasFiles`) | Scrim and card in; field +0.15 |
| Moves | Nearest lobe follows the pointer |
| Count known (`items.length`) | "Drop to open 2 files"; unknown: "Drop to open" |
| Over a sidebar thumbnail or a tab | Overlay steps back to the scrim only; the drop target is the tab (family 05/03) |
| Leave, Esc | Out; field back to rest |
| Drop with no openable file | Toast "No PDF or image files in the drop" |
| Locked active document | Unchanged: dropping opens new documents, never changes the locked one |
| Compare | Scrim + card without field (no light in Compare); files open as documents, Compare stays |

**5. Content and copy.**

| English | Turkish |
|---|---|
| Drop to open · Drop to open 2 files | Açmak için bırakın · 2 dosyayı açmak için bırakın |
| Files open on this device and are never uploaded. | Dosyalar bu cihazda açılır ve hiçbir yere yüklenmez. (existing) |
| No PDF or image files in the drop | Bırakılan öğelerde PDF veya görsel yok |
| Could not open scan.pdf: the file is damaged | scan.pdf açılamadı: dosya bozuk |
| scan.pdf was not opened: it needs its password · Enter password | scan.pdf açılmadı: parolası gerekiyor · Parolayı girin |
| Opened 3 files · Show in Library | 3 dosya açıldı · Kitaplıkta göster |

**6. Behaviour.** Drop destination: on the Library, 1 file → document; 2+ → Library with the new
cards checked. In a document view, 1 file → a new tab, active; 2+ → tabs, the first active, toast
"Opened 3 files · Show in Library" (Issue 19). Password files → the password dialog; skip → the
toast above. No keyboard equivalent is needed (Open PDFs…, Mod+O). Announcements: "3 files dropped,
opening" then the open result. Pointer drags of cards and thumbnails never trigger it.

**7. Motion.** Scrim `--duration-base` fade; card *popup* from `scale(0.96)`; *light respond*
drag-over; exit 100 ms. Reduced: fades, field still with ≤ 200 ms response.

**8. Accessibility.** Overlay `aria-hidden` (drag is pointer-only); results announced. Card text:
primary 7.38, glass-secondary 4.80 (lit, field peak). A-5, A-6 (field ≥ 64 px from the page edge:
the overlay's lobe is centred on the card, and the scrim dims pages), A-8, A-14.

**9. Implementation.** `shell/use-file-drop.ts` (from `AppShell.tsx` handlers, depth counter kept,
`data-file-drop-zone` opt-out kept), `shell/DropOverlay.tsx`; deletes the Stage overlay and
`EmptyState` dragging branch. Tests: browser-mode depth counter (no flicker over children); e2e drop
two files on the Library → 2 checked cards and Combine lime; drop one in a document → new tab;
damaged file toast visible (INV-6); rendered-pixel page corners unchanged by the field under the
scrim beyond dimming.

## 11. L10 Teaching sample and `?sample`

**1. Role.** FL-R10, F-14, flows §9.2: a bundled PDF whose text teaches the everyday acts with no
overlay tour; J1 by sample = 1. New.

**2. Anatomy (the document).** Four A4 pages, Inter and Noto Serif subsets (OFL, already bundled
in `tools/fixtures`), outline with four entries, footer "Recto sample · fictional data".

| Page | Shows | English text | Turkish text | Teaches (job, flows §) |
|---|---|---|---|---|
| 1 | Title, one paragraph, a 40 % empty margin | "Welcome to Recto." "Select this sentence and choose Highlight." "Press M or tap Markup to write in the margin." "Right-click or long-press a page for more." | "Recto'ya hoş geldiniz." "Bu cümleyi seçip Vurgula'yı seçin." "Kenar boşluğuna yazmak için M tuşuna basın ya da İşaretle'ye dokunun." "Daha fazlası için sayfaya sağ tıklayın ya da basılı tutun." | J5, J6; §3.1, §4.5 |
| 2 | A form: Name, Date, a checkbox, a signature field | "Click a field and type." "☐ I tried Recto." "Sign here with Fill & sign." | "Bir alana tıklayıp yazın." "☐ Recto'yu denedim." "Doldur ve imzala ile buraya imza atın." | J7, J8A |
| 3 | A greyscale scan of a short letter (rasterised like `demo-letter-scan`) | Scanned: "This page is a picture. Recognize text makes it searchable." | Taranmış: "Bu sayfa bir resim. Metni tanı, sayfayı aranabilir yapar." | J11, facts chip |
| 4 | Four page miniatures and two short lines | "Press 3 or pinch to see every page. Drag a thumbnail to move it." "Your changes are kept on this device. Save writes them into the file." | "Tüm sayfaları görmek için 3'e basın ya da iki parmakla kıstırın. Bir küçük resmi sürükleyerek taşıyın." "Değişiklikleriniz bu cihazda saklanır. Kaydet, onları dosyaya yazar." | J4, J13A; §5.1 |

The facts chip on the sample reads "No text on 1 page · Recognize" (the priority of flows §9.3).

**3. Material and light.** The sample is content (solid page). Opening it plays the Library's
success pulse.

**4. States.** Opening (progress capsule if over 400 ms) · opened (fresh copy each time) · offline
and not yet cached (Try the sample disabled: "The sample needs to load once with a connection") ·
locked when "Open documents locked" is on.

**5. Content and copy.** Document title "Recto sample" / "Recto örnek belge"; file name "Recto
sample.pdf" / "Recto örnek belge.pdf"; announcement "Opened the sample. Its pages explain what to
try" / "Örnek belge açıldı. Sayfaları neleri deneyebileceğinizi anlatıyor".

**6. Behaviour.** Try the sample, ⌘K "sample", or `?sample` (`?sample=tr`, `?sample=en`; any other
value means the UI locale). The parameter is read once at boot, removed with
`history.replaceState`, and only ever loads `sample/recto-sample-{en,tr}.pdf` from the app's own
origin (no URL from the query is fetched). With a restored session it opens as one more tab. Each
open is a new document from the same bytes; the second is titled "Recto sample (2)". Focus: the
page. Guard: none.

**7. Motion.** *view change* (root cross-fade) from the launcher; reduced: 150 ms fade.

**8. Accessibility.** The PDF is tagged (headings, the form's field names, alt text for the
miniatures and the scan "Scanned letter, no text layer"), language set per file (`/Lang en` or
`tr`). Turkish page text keeps the *siz* register (BR-V3).

**9. Implementation.** `tools/fixtures/sample-fixture.ts` (deterministic, like
`demo-fixtures.ts`) writes `apps/web/public/sample/recto-sample-en.pdf` and `-tr.pdf`, each ≤ 125 KB
(250 KB both, judgement; flows says ≤ 250 KB). `vite.config.ts` workbox `globPatterns` gains
`sample/*.pdf` (today only html, js, css, woff2). `sample/open-sample.ts`, `sample/sample-param.ts`.
Tests: unit param parsing and `replaceState`; fixture verify (page count, fields, no text on page 3,
size cap) in `tools/fixtures/verify.ts`; e2e Try the sample = 1 step; `?sample=tr` opens the
Turkish file once, a reload opens none; offline project opens it from the precache.

## 12. L11 Facts chip and its ⓘ fold

**1. Role.** One fact per file that routes to the right act (flows §9.3; FL-R7's OCR prompt, J7,
J8A, J11 = 2 while it shows). New; takes over the status-bar signature badge's first-glance role
(14.5, the rest goes to the title menu).

**2. Anatomy.**

```
Chip, M1, 36 high fine / 44 coarse, 600 ms after opening, top leading corner of the free
rectangle (compact: centred 12 px above the dock), max 360 wide (compact: viewport − 32)
╭──────────────────────────────────────────────╮
│ ⓘ  12 form fields   ·   Fill & sign        │   glyph 16 · body 13/18 · action 13/18 550
╰──────────────────────────────────────────────╯
Fold: popover (M4, 280 wide) from the ⓘ beside the title (top strip, family 03) and the
title-menu header:
╭ About this file ─────────────────────────────╮
│ seal-check  Signed by Ada Lovelace · locked   Signatures │
│ scan        No text on 2 pages               Recognize  │
│ textbox     12 form fields                   Fill & sign│
│ list-bullets Contents · 8 chapters           Show       │
╰──────────────────────────────────────────────────────────╯
```

**3. Material and light.** M1 chip, σ 7 at 36 (c 0.990), σ 8 at 44 (c 0.994); rim M1, e2. Fold M4
σ 16 (under 120 px tall) or 24. Processing ring (1.5 px conic) around the chip while its action
runs (OCR). Tinted 0.90; Solid n4 / n1; forced colours `Canvas`, `CanvasText` border.

**4. States.**

| State | Change |
|---|---|
| Appear | 600 ms after the first page renders; at most once per file per device (key: size + SHA-256 of the first 64 KB) except "Restored edits", shown on each restore |
| Rest | 10 s (A-24: it carries an action), then folds into the ⓘ; the timer pauses on hover and while focus is inside |
| Hover · pressed · focus | Action: one fill step behind its text; *press*; two-band ring inset |
| Busy | Ring runs; text "Recognizing… 1 of 2" |
| Done | *success* bloom; text "2 pages recognized · Review" for 4 s, then folds |
| Locked | Change actions (Recognize, Discard, Fill & sign) dim with "Locked · Unlock"; Unlock opens the Lock popover |
| No facts | No chip; ⓘ hidden |

**5. Content and copy.** Priority as flows §9.3.

| Fact | English | Turkish | Action EN / TR |
|---|---|---|---|
| Signed | Signed by Ada Lovelace · locked | Ada Lovelace imzalı · kilitli | Signatures / İmzalar |
| No text | No text on 2 pages | 2 sayfada metin yok | Recognize / Metni tanı |
| Fields | 12 form fields | 12 form alanı | Fill & sign / Doldur ve imzala |
| Restored | Restored edits (18:40) | Düzenlemeler geri yüklendi (18:40) | Discard / Vazgeç |
| Contents | Contents · 8 chapters | İçindekiler · 8 bölüm | Show / Göster |
| Fold title | About this file | Bu dosya hakkında | — |

The signer's name is middle-truncated to 24 characters; times sit in brackets so no Turkish
suffix depends on the digits. Numbers `tnum`.

**6. Behaviour.**

| Action | Does | Guard |
|---|---|---|
| Signatures | Signatures sheet (family 12) | none |
| Recognize | Popover "Recognize text on 2 pages · English ▾ · Recognize 2 pages" (1 + confirm) | `document` |
| Fill & sign | Palette on its Sign set, field stepper at field 1 (= dock Fill & sign) | opens Markup; fields `targeted` |
| Discard | Returns the document to its opened or last-saved bytes as one step; toast "Discarded restored edits · Undo" | `document` |
| Show | Sidebar on Contents (spec X27) | none |

Keys: F6 reaches the chip between the page and the pending-marks bar (flows §7.2); Enter acts; Esc
folds it at once. Touch: tap acts; the chip never hides with hide-on-scroll (it lives 10 s). Focus
after an action goes where the action leads; after folding by timer, focus is never moved.
Announcement (polite, once, 600 ms after open): "This file has 12 form fields. Fill & sign is in the
facts chip, F6".

**7. Motion.** In: *popup* (origin top leading) + *materialize*; fold: *popup* exit toward the ⓘ
(transform-origin at the ⓘ, `--spring-quick`), then a 500 ms lime ring flash on the ⓘ (the chrome
form of *undo reveal*; Issue 6); *progress* ring; *success*. Reduced: fade in and out, no flash
motion (static ring for 500 ms).

**8. Accessibility.** `role="status"` region holding a button for the action; the fold is a Base UI
`Popover` with a list. Targets 36 / 44. Pairs: primary on M1 over white 7.78, glass-secondary 5.07;
light 11.18 / 6.27. A-12 (the chip sits in the free rectangle's corner, not over the first line at
fit width: it takes the top-leading 360 × 52 of the stage margin when the page column leaves it,
otherwise the first line is pushed by `scroll-padding-top` + 52 while it shows; judgement), A-13,
A-24.

**9. Implementation.** `facts/facts-model.ts` (detects from the engine's open result: signatures,
text-layer page count, field count, outline size, restored flag; priority), `facts/FactsChip.tsx`,
`facts/FactsFold.tsx`, `facts/facts-seen.ts` (IndexedDB `pdf-editor:facts-seen:v1`, spec X26; keys
only; cleared with Clear recents, with Clear kept documents, and by "Show tips and facts again" in
Settings, spec 07.8). Tests: unit priority and keying; browser-mode 600 ms and 10 s
with fake timers, hover pause, Esc; e2e sample chip → Recognize → 2 steps; signed fixture shows
"Signed … · locked"; the chip shows once across a reload; axe on chip and fold.

## 13. L12 Library menu and footer

**1. Role.** Settings, Batch and help from the Library (flows §2.1 "Library ⋯"), the visible
language switch (FL-R10, INV-20, 15.1.3) and the privacy line. Replaces the empty state's
"Search commands" and "Keyboard shortcuts" hint rows.

**2. Anatomy.** Footer (medium and up): two M1 chips at the column's bottom corners, 32 fine / 44
coarse: leading "● Nothing is uploaded" (opens the privacy popover, family 15.1), trailing
"English · Türkçe" (two-segment control). Compact: EN · TR in the top bar while nothing is open,
then in the menu; the privacy chip under the launcher card. Library ⋯ (top strip, M4 menu; phone:
sheet): Try the sample · Combine files… · Batch… · Settings… · Keyboard shortcuts (fine only) ·
About Recto.

**3. Material and light.** M1 chips σ 5 at 32 (c 0.999), 8 at 44 (c 0.994); M4 menu. Solid, Tinted,
forced colours as L11.

**4. States.** Language: current segment filled (`--surface-on`, fill glyph-free, `aria-checked`);
hover one step; focus ring. Privacy dot: `--success` with "Nothing is uploaded"; if the privacy
monitor ever counts an external request, the chip reads "1 external request" with `warning` (the
popover explains). Private window: chip text unchanged; L7 carries the note.

**5. Content and copy.**

| English | Turkish |
|---|---|
| Nothing is uploaded | Hiçbir şey yüklenmez |
| 1 external request | 1 dış istek |
| English · Türkçe (always in its own language) | English · Türkçe |
| Settings… · Keyboard shortcuts · About Recto | Ayarlar… · Klavye kısayolları · Recto hakkında |
| Language switch name: Language | Dil |

**6. Behaviour.** Language: arrows move, Enter/Space or click selects; switches at once, saves per
device, updates `lang` on the root; announced in the new language. ⋯: Base UI Menu keys. Guard: none.

**7. Motion.** *press*; *popup* for the menu and popover; the segment fill slides on
`--spring-press` with the own-content lens (§2.7); reduced: instant.

**8. Accessibility.** Radio group named Language with `lang` on each option; menu button "More" /
"Daha fazla". `--success` dark 9.25 on n3 with the word. A-13, A-15, A-21.

**9. Implementation.** `home/LibraryFooter.tsx`, `home/LibraryMenu.tsx`; `ui/Segmented` (family
15.2); `i18n/locale.ts` `setLocale`. Tests: browser-mode language switch reflows the launcher
without overflow at 390 px in TR; e2e privacy chip opens the popover; axe.

## 14. Removed or moved

| Today | Fate | Where its function went |
|---|---|---|
| 4.1 Home header buttons (Open files, Arrange pages, Compare, Close, Combine N files) | Removed | L2 Open PDFs…; L6 Pages, Compare, Close, Combine |
| 4.2 card double-click to open; card-on-card drop to combine (`HOME_CARD_TYPE`, `dropOrder`) | Removed | One click opens (L5); drag reorders; Combine in L6 |
| 4.2 "Modified {date}" line | Removed | Document info sheet and the card tooltip |
| 4.3 Empty state card and hint rows (Open files, Search commands, Keyboard shortcuts) | Replaced | L2 launcher; ⌘K in the top strip; Keyboard shortcuts in L12 ⋯ and `?` |
| 12.13 Combine dialog from Home (order, title) | Removed from the Library | Card order is the order (drag, Alt+arrows); rename by F2, the grid's section header or the title menu |
| 14.2 Combined toast | Folded | `ui/Toast` (family 14) with L6's copy |
| 3.12 stage drop overlay, 14.8 drag states | Replaced | L9 |
| 3.2 App glyph as the Home button | Moved | ◆ in the top strip (family 03) |
| 15.1.3 language only in the palette | Moved | L12 switch |

## 15. Issues for the lead

1. **Light near Library thumbnails.** `language.md` §3.2 forbids the field "within 64 px of a page,
   thumbnails included", yet §2.5 puts lit glass around Library thumbnails and §3.2 puts lobes
   "behind gaps between card rows" (16 px gaps). Decided: Library thumbnails are exempt from the
   64 px distance but keep principle 2's brightness rule, met by the I 0.6 cap under lit glass
   (composite ≥ 10:1 below white) and the Library mean Y ≤ 0.03; A-6's pixel test applies to stage
   pages. Confirm or require a thumbnail mask.
2. **Text-safe band.** The head row "Open · 3 documents" sits on bare canvas over the field; A-5
   needs Y ≤ 0.026 there. `language.md` §3 has no mask. Decided: a `textSafe` rect uniform in the
   shader (intensity to 0 within 24 px), tested by pixels. Add it to §3.1.
3. **Lit glass in the light theme and on coarse pointers.** Lit is dark-only and lists σ 28 only.
   Decided: light theme uses M2 light; lit σ 20 on compact, compact-height and coarse (budget of
   §2.9), keeping c ≥ 0.985.
4. **Launcher row σ.** An 88 px lit row at σ 28 has c 0.80. Decided: σ 16 (c 0.994). Register it.
5. **Press scale on large surfaces.** The catalogue's 0.97 / 0.94 is heavy on a 184 × 284 card.
   Decided: 0.98 / 0.96 for surfaces ≥ 120 px. Add a large-surface row to *press*.
6. **No "fold" transition.** The chip folding into the ⓘ uses *popup* exit toward the ⓘ plus a
   chrome ring flash borrowed from *undo reveal*. Add a named *fold* to §7.3 or approve the reuse.
7. **Restore destination.** flows §5.2's snapshot lists per-document state but not the place.
   Decided: the snapshot also stores `destination` and the active document; Compare is not
   restored and falls back to document A.
8. **`commit()` and the Library.** Closing (documents[id] removed), reordering (`documentOrder`) and
   Combine's new document must pass `commit()` with locked documents present; only rename is a
   `document` act. Specify that the pointer check compares ids present before and after only.
9. **Combine order.** flows §8.1 says "card order"; today's `combineScope` uses selection order.
   Decided: card order of the checked cards (visible, reorderable). Selection order is dropped.
10. **Combine files… outcome.** flows does not say whether the picked sources open too. Decided:
    only the combined document opens; one composed history step; sources go to Recents.
11. **Static selection bar.** flows says "Compare (exactly two)". Decided per RA-21: Compare and
    Combine are always present and dimmed with a reason, so the bar never reflows.
12. **Right-click on a card** enters Select (flows §7.1 gesture map) instead of a context menu; F2
    rename and Alt+Left/Right reorder are added to the key map (flows §7.2 lacks them).
13. **Privacy wording.** The wireframes use three lines ("Files stay on this device", "Nothing is
    uploaded", "Nothing leaves this device"). Decided: headline line "Nothing leaves this device.",
    footer chip "Nothing is uploaded", kept documents "Kept on this device while the browser keeps
    it" (flows §5.2's promise).
14. **Sample size and precache.** Two files (EN, TR) at ≤ 125 KB each; `globPatterns` must add
    `sample/*.pdf`. The sample joins Recents only once changed.
15. **Facts chip once per file.** "Restored edits" is exempt and shows on each restore; the seen
    keys (size + hash) are stored on the device and listed under Settings → Documents and storage.
16. **Owner of `session/`.** This family consumes the snapshot engine (restore, Recents snapshots,
    retention) but does not specify it. Assign it to the saving spec (family 14 or 15.1).
17. **Phone selection count.** The count moves into the Library head and the phone bar holds four
    labelled icons (the flows wireframe shows the count in the bar; it does not fit 358 px in
    Turkish: about 468 px needed).
18. **Library ⋯ contents** are not listed in flows; this spec sets Try the sample · Combine files… ·
    Batch… · Settings… · Keyboard shortcuts · About Recto.
19. **Drop of 2+ files in a document view.** flows §2.2 routes drops to a document. Decided: open as
    tabs, stay, toast "Opened 3 files · Show in Library"; on the Library, 2+ select the new cards.
20. **"Kitaplık"** is chosen as the Turkish for Library (Apple's Books naming); the brand owner may
    prefer "Arşiv".
21. **Combine's 2 s drift** (§3.2) happens on the Library, but Combine leaves for the Pages grid, so
    it is never seen. Decided: no drift on Combine; the toast's bloom carries success.

## 16. Open questions

1. Should Recents rows with a snapshot show a 32 × 40 thumbnail rendered on demand from the kept
   bytes (nothing new stored), instead of the generic glyph?
2. Should cards keep the tag colour dot now that tabs and cards share one order and the edited ●
   sits beside it?
3. Should Batch… stay on the empty launcher, or live only in the ⋯ menu until a file is open?
4. Twelve Recents rows (today's limit) with 30 days or 500 MB of snapshots: enough, or should kept
   rows be counted separately from plain recents?
5. Should Start fresh also offer "Delete kept changes" for shared machines, or is Clear recents
   enough?
