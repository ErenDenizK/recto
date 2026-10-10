---
title: "M9 components, family 07: the Sheet primitive and every dialog"
date: 2026-10-04
status: proposed
---

> Wave 2 component spec. Binding inputs: [`flows.md`](../flows.md) (cited F§) and
> [`language.md`](../language.md) (cited L§) with its §13.2 amendments applied. Evidence:
> [`inventory.md`](../inventory.md) family 12 (rows 12.1–12.27), 13.2, 14.7, 15.1.1, 15.1.3, 15.1.4,
> INV-1, INV-6, INV-12, INV-18, INV-20; baseline frames `21-shortcuts`, `22-export-*`, `23-combine-*`,
> `24-document-info`, `25-page-numbers`, `26-signature`, `27-about`; research 15, 16, 18, 19, 22
> (RA, G, MC, M, A ids). Code read on `develop`: `export/ExportDialog.tsx`, `export/deliver.ts`,
> `tools/CompressDialog.tsx`, `tools/compress-model.ts`, `furniture/furniture-model.ts`,
> `stage/OperationDialogs.tsx`, `stage/section-operations.ts`, `packages/document-model/src/pages.ts`
> (`interleave`), `signatures/SignDialog.tsx`, `ocr/OcrDialog.tsx`, `tools/repair.ts`,
> `i18n/locale.ts`, `messages/{en,tr}.json`, Base UI 1.8.0 `dialog`, `alert-dialog`, `drawer`.
> Sibling specs read: 01-frame (free rectangle, Save, title menu, privacy), 02-library, 03-markup
> (MK-13 owns the New signature content), 04-context (menus, Unlock popover). Coverage and contrast
> values below were computed with L§1.2's formulas. **(judgement)** marks unmeasured claims.

# Family 07: sheets and every dialog

## 0. Summary

- **One `Sheet` primitive, five presentations** chosen by kind and size class (F§6.9): side sheet,
  form sheet, centred dialog, bottom sheet with detents, full sheet. Today's 27 dialogs share one
  760 px opaque popup and have no phone layout (INV-1); here every one has a compact form.
- **Three kinds.** *Tool sheets* are non-modal and keep the page live and visible at every size
  (furniture, crop, OCR, split, Find sensitive data). *Task sheets* are modal forms (Save a copy,
  Settings, Document info, Password, certificate, page-structure sheets, Batch). *Confirmations*
  are short modal questions with one result.
- **18 sheets, the shortcuts overlay and one confirmation pattern (with the password prompt and
  Apply redactions as its forms) replace 27 dialogs, the old overlay, the Appearance submenu and
  the OCR language manager.** Removed: Compress, Export as images and
  Markdown dialogs (into Save a copy), Strip metadata (into Document info), Remove password (into
  Password), Merge into… (into the Pages grid), Go to page (into the page pill), the About dialog
  (into Settings → About).
- **Save a copy** is one sheet for every output (F§5.1): Format PDF · Images · Text, Size presets
  with estimates inline (fixes INV-18), and Security, Metadata, Flatten and Signature folded under
  their current value. The picker opens first; work runs in the toast stack. J13B: 8 → 5 presses.
- **Nothing typed is lost.** Each sheet keeps its draft per document for the session, so Esc,
  ✕ or a swipe never discards input.
- **Glass.** M5 for every sheet and dialog (σ 48 fine, 20 coarse, **24 for dialogs under 260 px
  tall**); M3 for the compact sheet at 40 %; solid at 92 % (L§2.10). Scrim only under modal
  presentations. No light of their own.
- **Results and errors are visible.** One result page replaces five result layouts (inventory
  14.7); background jobs report in the toast stack; a skipped password file shows a toast (INV-6).

## 1. Family overview

### 1.1 How the parts work together

| Kind | compact < 600 | compact-height | medium 600–839 | expanded 840–1199 | large, xlarge |
|---|---|---|---|---|---|
| Tool sheet (non-modal) | Bottom sheet, detents 40 % · 92 %, opens at 40 %, page live above | Side sheet 360, trailing | Side sheet 360, no scrim | Side sheet 400, no scrim | Same |
| Task sheet (modal) | Bottom sheet at 92 % (one detent) | Full sheet | Form sheet ≤ 640, centred, scrim | Side sheet 400, scrim | Same |
| Settings (modal) | Full sheet at 92 % | Full sheet | Form sheet 600, centred, scrim | Form sheet 600, centred, scrim (R15) | Same |
| Confirmation, password prompt | Modal sheet, content height ≤ 60 % | Modal sheet, centred 400 | Centred dialog 400 | Same | Same |
| Shortcuts overlay | Not offered without a physical key press | Same | Centred 760 | Same | Same |

Rules for the whole family:

1. **One sheet at a time** (M-29). A confirmation may stack over a task sheet; nothing else
   stacks. Opening a sheet from another replaces it (its draft stays).
2. **Opening any sheet disarms the armed tool to Select** (the palette stays), so the sheet's
   primary is the view's one lime (L§0.1 principle 3). Destructive primaries are never lime.
3. **Side sheets inset the free rectangle** when ≥ 400 px of stage remains (01-frame §16.10),
   else they overlay. While a **tool sheet** is open, Fit width and Fit page re-fit to the free
   rectangle; the earlier zoom returns on close.
4. **Guard.** A sheet that changes the document asks `canChange(id, act)` for its primary
   (F§2.5); output-only sheets (Save a copy, certificate signing) ask nothing and work while
   locked (F§2.6 keeps Save a copy). A locked sheet still opens and previews.
5. **Drafts** live in `sheet-store` per document and sheet for the session; "Reset" returns the
   defaults. Drafts never reach the OPFS snapshot.
6. **Z-order** (01-frame §1): page → bars → dock band → top strip → side sheets → menus and
   popovers → scrim → modal sheets → confirmation → tooltips → toasts.

### 1.2 Composition

```
Desktop 1440 × 900 (large, fine): tool sheet open, confirmation stacked over a task sheet elsewhere
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◆ ▤ [report.pdf ▾ ●] agreement +                ⌕ Find in document    ↶ ↷  Save  ◎           │
│                                                                    ╭──────────────────────╮  │
│        ┌────────────────────────────────────────────┐              │ Page numbers       ✕ │52│
│        │ page re-fitted to the free rectangle       │              │ Format               │  │
│        │ (1440 − 400 − 16 = 1024 px)                │              │ [Page 1 of N      ▾] │  │
│        │                                            │              │ Position  ○ ○ ○      │  │
│        │                                            │              │           ○ ● ○      │  │
│        │                "Page 1 of 12"  ← preview   │              │ Pages     All ▾      │  │
│        └────────────────────────────────────────────┘              │ Start at  [ 1 ]      │  │
│             ╭───────────────────────────────╮  ╭─────────╮         │ ▸ Font and margins   │  │
│             │ ▦ Pages ✎ Markup ✑ Fill ⋯ More│  │3/12·96 %│         │ Reset      [ Apply ] │60│
│             ╰───────────────────────────────╯  ╰─────────╯         ╰──────────────────────╯  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
  side sheet 400 × (900 − 44 − 16), floating 8 px from strip, edge and bottom, M5, radius 20

Phone 390 × 844 (compact)
 Tool sheet at 40 %                 Task sheet at 92 %                 Confirmation
┌──────────────────────────────┐   ┌──────────────────────────────┐   ┌──────────────────────────────┐
│ ‹ 3  report.pdf ▾ ⓘ  ↶ ↷  ⌕  │   │╭────────────── ▬ ───────────╮│   │ ‹ 3  report.pdf ▾ ⓘ  ↶ ↷  ⌕  │
│ ┌──────────────────────────┐ │   ││ ✕   Save a copy            ││   │ ┌──────────────────────────┐ │
│ │ page scrolled so its     │ │   ││ Format [PDF|Images|Text]   ││   │ │ page, dimmed by scrim    │ │
│ │ bottom edge shows        │ │   ││ Size  ○ Same as original   ││   │ └──────────────────────────┘ │
│ │            "Page 1 of 12"│ │   ││       ● Smaller  ≈ 1.1 MB  ││   │╭────────────── ▬ ───────────╮│
│ └──────────────────────────┘ │   ││       ○ Smallest ≈ 0.6 MB  ││   ││ Revert to the opened       ││
│╭────────────── ▬ ───────────╮│   ││ ▸ Security  Same as doc.   ││   ││ version?                   ││
││ ✕  Page numbers     Apply  ││   ││ ▸ Metadata  Kept           ││   ││ Your 14 changes since      ││
││ Format [Page 1 of N     ▾] ││   ││ Name [report-small.pdf   ] ││   ││ opening go. Undo brings    ││
││ Position ○ ○ ○ / ○ ● ○     ││   ││                            ││   ││ them back.                 ││
││ Pages    All ▾             ││   ││╭──────────────────────────╮││   ││╭──────────╮╭──────────────╮││
││ 40 % = 338 px; 415 px of   ││   │││        Share copy        │││   │││  Cancel  ││    Revert    │││
││ page stay visible above    ││   ││╰──────────────────────────╯││   ││╰──────────╯╰──────────────╯││
│╰────────────────────────────╯│   │╰────────────────────────────╯│   │╰────────────────────────────╯│
└──────────────────────────────┘   └──────────────────────────────┘   └──────────────────────────────┘
```

### 1.3 Components, sources and fate

| Id | Component | Kind | Replaces (inventory) | Main new files (under `apps/web/src/`) |
|---|---|---|---|---|
| S0 | Sheet primitive and result page | — | 12 shell, 14.7, `ToolDialog.module.css`, `Frame` in `OperationDialogs.tsx` | `ui/sheet/*` |
| S1 | Confirmation | Confirmation | Ad hoc confirms; 12.8 first step | `ui/sheet/Confirm.tsx` |
| S2 | Save a copy | Task | 12.1, 12.20, 12.21, 12.22, `CompressionExportRow`, repair command's delivery | `save-copy/*` |
| S3 | Settings | Settings | 15.1.1, 15.1.3, 15.1.4, `OcrLanguages` (12.23), 12.27 | `settings/*` |
| S4 | Document info | Task | 12.2, 12.5 | `document/DocumentInfoSheet.tsx` |
| S5 | Password | Task | 12.3, 12.4 | `document/PasswordSheet.tsx` |
| S6 | Password prompt on open | Confirmation | 12.25 | `shell/PasswordPrompt.tsx` |
| S7 | New signature (shell) | Task | 12.7 (content: 03-markup MK-13) | `signatures/NewSignatureSheet.tsx` |
| S8 | Sign with certificate | Task | 12.6, `ExportSignatureSection` | `signatures/CertificateSheet.tsx` |
| S9 | Signatures | Task | Inspector Signatures (6.x), 14.5 target | `signatures/SignaturesSheet.tsx` |
| S10 | Recognize text (OCR) | Tool | 12.23 | `ocr/OcrSheet.tsx` |
| S11 | Page furniture (4 variants) | Tool | 12.9–12.12 | `furniture/FurnitureSheet.tsx` |
| S12 | Crop pages | Tool | 12.18, `CropDrawBanner` | `crop/CropSheet.tsx` |
| S13 | Split | Tool (over the grid) | 12.15 | `pages-sheets/SplitSheet.tsx` |
| S14 | Interleave | Task | 12.16 | `pages-sheets/InterleaveSheet.tsx` |
| S15 | Combine with open documents | Task | 12.13 (Merge all outcome); 12.14 removed | `pages-sheets/CombineSheet.tsx` |
| S16 | Extract pages | Task | Extract command (new sheet) | `pages-sheets/ExtractSheet.tsx` |
| S17 | Resize pages | Task | 12.17 | `pages-sheets/ResizeSheet.tsx` |
| S18 | Insert images as pages | Task | 12.19 | `pages-sheets/InsertImagesSheet.tsx` |
| S19 | Apply redactions | Confirmation + result | 12.8 | `redaction/ApplySheet.tsx` |
| S20 | Find sensitive data | Tool | `MarkMatchesButton` results panel | `redaction/SensitiveSheet.tsx` |
| S21 | Batch and recipes | Task | 12.24 | `batch/BatchSheet.tsx` |
| S22 | Shortcuts overlay | Centred | 13.2 | `shell/ShortcutsOverlay.tsx` |
| — | Removed | — | 12.14 → grid; 12.26 → pill (01-frame F11); 12.27 → S3 About and the About page | §25 |

---

## 2. S0 Sheet primitive

**1 · Role.** One container for every dialog, with presentation picked from kind × size class
(§1.1), one header, body and footer, an optional page stack (push and back), a lock banner, a
progress state and a result page. Serves every job that opens a sheet (J8A first time, J8B, J11,
J13B, J16) and F§5.1, F§6.1, F§6.9, F§9.5. Replaces the shared shell of family 12, the `Frame`
helper and 5 result layouts (14.7).

**2 · Anatomy.**

```
Side / form / full / bottom sheet                    Centred dialog (confirmation)
╭─────────────────────────────────────────╮          ╭───────────────────────────────╮
│ ‹ Back   Title (title3)            ✕    │ header   │ Title (title2, balance)       │ 24 pad
│ subtitle (footnote, n11)                │ 52 / 56  │ Body (callout 15/20)          │
│ [⊡ report.pdf is locked · Unlock]       │ lock     │                               │
│ Section label (footnote 550, n11)       │ banner   │ ╭─────────╮ ╭───────────────╮ │
│ Row  label ............ control         │ rows     │ │ Cancel  │ │  Primary      │ │ 36 / 44
│ ▸ Disclosure       current value        │ 28 / 44  │ ╰─────────╯ ╰───────────────╯ │
│ [ input well                       ]    │          ╰───────────────────────────────╯
│ ⚠ reason or error line                  │          400 wide, height 168–360
├─────────────────────────────────────────┤
│ Reset · secondary          [ Primary ]  │ footer 60 / 72 + safe-bottom
╰─────────────────────────────────────────╯
```

| Measure | Fine | Coarse | Compact |
|---|---|---|---|
| Header · title | 52 · title3 17/22 600 | 56 · title3 19/24 | 56; grabber 36 × 5, 6 px from top, in a 20 px band |
| ✕ and ‹ Back | 32 circle, `x` / `caret-left` 20 | 44 circle, 24 | 44 |
| Body padding · section gap | 20 · 24 | 16 · 24 | 16 · 20 + safe-left/right |
| Rows · inputs | 28 · 28 high, text 13 | 44 · 44 high, text 16 (iOS zoom) | 44 · 44 |
| Footer · buttons | 60 · capsules 32 high, 12 px padding | 72 · 44 high | 72 + safe-bottom; primary fills the row beside Cancel |
| Widths | side 400, form 640 (Settings 600, R15), dialog 400, overlay 760 | same | 100 %, max 640 centred (M-29) |
| Radius | 20 (squircle 27, L§6.1); inner wells 12 | same | top corners 28 (squircle 38) |
| Placement | Side: 8 px from strip, trailing edge, bottom; form: centred, max-height 100dvh − 104 | same | Detents 0.40 and 0.92 of `visualViewport.height` |

Tool sheets on compact carry their primary in the header (trailing, beside ✕ on the leading
side), so it shows at the 40 % detent and above the keyboard; everywhere else the primary sits in
the footer. Footer order: Reset or secondary leading, Cancel then primary trailing.

**3 · Material and light.**

| Presentation | Tier | σ | Coverage (smallest size) | Beneath |
|---|---|---|---|---|
| Side, form, full sheet; overlay | M5, rim e5 (L§2.4) | 48; coarse and compact 20 | 360 × 600 at 48: 0.9998 | Canvas, pages, the Library's light (frozen while open, L§3.5) |
| Centred dialog, modal sheet (< 260 px tall) | M5 | **24** | 400 × 168 at 24: 0.9995 (at 48: 0.920, fails A-2) | Scrim over a frozen backdrop |
| Compact sheet at 40 % | M3 (F§13.1) | 20 | 390 × 338: 1.000 | Live page |
| Compact sheet at 92 % | M5, then solid `--glass-sheet-solid` fades in over `--duration-base` once settled, filter removed (L§2.10) | 20 → none | — | — |

- **Scrim** under modal presentations only: dark `rgb(5 6 8 / 0.50)`, light `rgb(21 23 28 /
  0.28)`, dim only, no blur (G-31), fades over 180 ms. Tool sheets have none.
- **Inside:** text on M5 dark: primary 9.96, glass-secondary 6.49, danger 6.39, warning 7.00,
  lime fill 9.97; light 14.65, 8.21, 6.67, 6.83, ink fill 14.65 (L§2.2). Inputs, previews, the
  signature pad and the Markdown preview are solid wells (L§2.10): dark n2 with n12 text
  (15.45:1), light n1 (17.65:1). Long lists over M5 sit in a sunken well.
- **Input boundary** `--control-border` (spec X7): dark white 0.48, light ink 0.55 (3.61–5.01:1
  over the worst glass), shared with `09-primitives`' wells, boxes, radios and switch tracks.
  L§1's `--border-strong` (0.16) is below 3:1 (Issue 2).
- **Light:** none of its own (L§3.2 "never as the own light of a dialog"). Background jobs show
  the ring and bloom on the toast-stack capsule, not on the sheet.
- **Tinted:** alpha 0.90, blur and rim kept. **Solid:** `--glass-sheet-solid`, rim and e5 kept.
  **More contrast:** solid with a 1 px strong border, no shadow. **Forced colours:** `Canvas` /
  `CanvasText`, `backdrop-filter: none` set explicitly, 2 px `CanvasText` border, scrim hidden
  (modality comes from `inert` and focus), primary `ButtonText` on `ButtonFace` with a 2 px border.

**4 · States** (shared; each sheet lists only its own differences).

| State | What shows | Tokens and attributes |
|---|---|---|
| Rest | Header, defaults or the draft, primary enabled when valid | Primary `--primary-fill` / `--primary-ink` (dark lime/ink 16.42:1; light ink/lime 14.79:1) |
| Hover · pressed | Rows and buttons one wash step; press scale 0.97 / 0.94 | `--surface-hover`, `--surface-active`; L§7.3 *press* |
| Focus-visible | Two-band ring; inside capsules concentric (L§9.2) | — |
| Selected | Segment and radio fill, icon fill (I-2) | `--accent-muted` row (lime 0.12 / ink 0.07), on M5 primary 7.17, glass-secondary 4.67 (L§2.6) |
| Disabled with reason | Control dimmed but focusable; reason line above the footer and as `aria-describedby` (RA-21) | `aria-disabled`, `--glass-text-disabled`; reason in glass-secondary |
| Busy (in-sheet work) | Primary becomes the progress capsule "Applying… 40 %" with the processing ring; inputs `inert`; ✕ stays unless the sheet says otherwise | `aria-busy`, `tnum` |
| Background job | Sheet closes; the toast stack shows the capsule (L§8) | — |
| Error | Field: `x-circle` 16 + sentence under it, `aria-invalid`. Sheet: row above the footer with glyph and sentence. No red wash, no shake (L§8) | Danger glass variant (dark `#ffa4a4`, light `#a20519`) |
| Locked document | Lock banner at the top: `lock-simple` + "report.pdf is locked · Unlock"; primary dimmed "Locked"; previews still render | Unlock opens the Unlock popover (04-context §19) at the banner |
| Empty | One sentence and, where useful, the action that fills it | callout, glass-secondary |
| Destructive primary | Secondary capsule (n5) with a danger label and glyph, never lime (L§3.2) | Danger on n5: 7.60 dark, 6.18 light |

**5 · Content and copy** (shared strings).

| Element | English | Turkish |
|---|---|---|
| Close · Back · Cancel · Done · Reset | Close · Back · Cancel · Done · Reset | Kapat · Geri · Vazgeç · Bitti · Sıfırla |
| Lock banner | report.pdf is locked · Unlock | report.pdf kilitli · Kilidi aç |
| Reason when locked | Locked | Kilitli |
| Draft restored (announcement) | Your earlier settings are back | Önceki ayarlarınız geri geldi |
| Running in background (toast) | {Job} continues in the background | {İş} arka planda sürüyor |

Icons: `x`, `caret-left`, `lock-simple`, `x-circle`, `warning`, `check-circle`, `info`. Numbers,
sizes and counts use `tnum`; Turkish percent and decimals via `Intl` ("%40", "1,1 MB").

**6 · Behaviour.**

| Input | Effect |
|---|---|
| Esc | Closes the topmost select or menu, else the top sheet (Esc ladder rung 1, F§7.2); the draft stays. Blocked only while S19 applies |
| ✕, Cancel, scrim click | Close (scrim click does nothing on confirmations, so a stray tap cannot answer them) |
| Swipe down (compact) | From the grabber, header or content scrolled to top: 1:1; release projects (r 0.998); below half of the 40 % detent, or > 800 px/s down, closes; between detents snaps. Swipe right closes a compact-height side sheet |
| Enter | In a single-line field, number field, radio or segment: runs the enabled primary (the body is a `<form>`). Not in selects, text areas or the Markdown preview. Mod+Enter is not used (F§7.2) |
| Tab | Header → lock banner → body in reading order → footer. Modal: trapped. Tool sheet: not trapped; F6 moves between page and sheet |
| Pen, finger | As mouse; inputs take the virtual keyboard; `Drawer.VirtualKeyboardProvider` keeps the focused field above it (M-4) |

- **Focus on open:** the control named by the opener (a preset, e.g. Size for Compress…), else
  the first control that needs input, else the first control. Confirmations: the primary when
  the result can be undone (a toast with Undo follows), else Cancel.
- **Focus on close:** the invoker (Base UI `finalFocus`); if the invoker is gone (a menu row),
  the title-menu trigger for title-menu sheets, the page point for page-menu sheets, the element
  focused before ⌘K for palette commands.
- **Announcements:** open: the dialog name is read by the role; a busy primary announces its
  percentage at 25 % steps (polite); results polite; blocking errors assertive (L§8).
- **Edge cases:** the active document closes while its sheet is open → the sheet closes with a
  toast "report.pdf was closed"; a tab switch keeps a modal sheet bound to its document (title
  shows "· report.pdf"); a tool sheet follows the active document and reloads its draft; the
  window crosses a size class → the sheet re-presents at once, keeping focus and scroll.

**7 · Motion.** Centred: *dialog* centre (`scale(0.96)` + opacity on `--spring-quick`, scrim
180 ms, exit 120 ms). Side and form: *dialog* side (24 px + opacity, `--spring-smooth`), with the
page column moving by *panel* FLIP when the free rectangle changes. Compact: *sheet*
(`--spring-glide`, `--spring-fling` above 300 px/s; drag 1:1 while `data-swiping`, rubber band
above 92 %). All end with *materialize*. Page stack: a proposed **sheet push** (Issue 3):
`translateX(24px)` + opacity on `--spring-smooth`, back reversed. Interruption: reverses from the
current value; a sheet can be grabbed mid-flight. Reduced motion: 150 ms fade; drag stays 1:1;
no projection. `backdrop-filter` never animates; the sheet moves on its own element (L§2.1 rule 5).

**8 · Accessibility.** Modal: `role="dialog"` `aria-modal="true"` named by its title, described by
its subtitle; outside `inert`. Tool sheet: `role="dialog"` `aria-modal="false"`, in the F6 cycle
after the page (Issue 4). Confirmation: `role="alertdialog"`. Grabber: a 44 × 24 hit area,
`aria-hidden` (✕ and Esc are the alternatives, WCAG 2.5.7). Targets 24 px fine with ≥ 4 px gaps,
44 coarse (A-15). A-2 (σ by size), A-11 ring, A-12 (side sheets inset the free rectangle so a
focused page target is never under them), A-13 (exiting sheet `inert` from its first frame), A-17,
A-18, A-20 (at 320 × 256 the compact form scrolls; header and footer stay), A-21 (labels at 1.8 ×
English, no fixed-width text boxes; title2 and title3 keep line height ≥ 1.25 × size), A-22.

**9 · Implementation.**
- `ui/sheet/Sheet.tsx` (one API: `kind`, `title`, `subtitle`, `primary`, `secondary`, `pages`,
  `lockAct`, `onClose`), `presentation.ts` (pure: kind × size class → presentation, unit-tested),
  `SheetHeader.tsx`, `SheetFooter.tsx`, `LockBanner.tsx`, `SheetResult.tsx`, `Confirm.tsx`,
  `Sheet.module.css`; `state/sheet-store.ts` (`open: { id, docId, preset } | null`, `drafts`,
  `openSheet`, `closeSheet`, `resetDraft`).
- Base UI: `Dialog` (centred, side, form; `modal={false}` for side tool sheets), `AlertDialog`
  (S1, S6), `Drawer` (compact and compact-height: `snapPoints={[0.4, 0.92]}`,
  `swipeDirection="down"` or `"right"`, `modal="trap-focus"` for tool sheets),
  `Drawer.VirtualKeyboardProvider`; `Field`, `Fieldset`, `RadioGroup`, `ToggleGroup` (segments),
  `Switch`, `NumberField`, `Select`, `Collapsible`. CSS transitions read `--drawer-swipe-strength`
  to scale the release duration on the spring curves.
- Deleted: `tools/ToolDialog.module.css`, `Frame` and the 760 px shell styles, per-module
  `.secondary` copies (15.2.9).
- Tests: unit `presentation.test.ts` (every kind × class), `sheet-store.test.ts` (one at a time,
  drafts per document, reset); browser-mode `Sheet.test.tsx` (focus on open and close, trap vs
  F6, Esc ladder, Enter submits only from allowed controls, lock banner); e2e `sheets.spec.ts` on
  the `phone`, `phone-landscape`, `tablet` and `desktop` projects (01-frame §2): open, swipe to
  40 % and 92 %, dismiss, keyboard above the field; rendered pixels in `glass-pixels.spec.ts` (M5 at
  σ 48 and 24 over a white page, compact solid at 92 %, scrim, Solid, forced colours); axe on every
  sheet in {EN, TR} × {dark, light} × {default, Solid, forced colours}; `motion.spec.ts` sweep.

## 3. S1 Confirmation

**1 · Role.** Ask once before an act that cannot be undone on the device, or that removes content
for good in the saved file. Owned uses: Revert to the opened version (F§5.1), Clear kept documents
(01-frame F8, 02-library), Remove saved signatures (S3), Remove furniture (S11), Remove crop (S12),
Remove password (S5), Apply redactions (S19, its own form). Never for deletions that a toast can
undo (S8 in F§3.5).

**2 · Anatomy.** Centred dialog 400 wide (S0); compact modal sheet. Title2 question, one or two
sentences, Cancel and the action. No checkbox except where F§5.1 names one.

**3 · Material.** M5 σ 24 (S0 table). Scrim. No light; destructive actions never lime.

**4 · States.** Rest; busy on the action for work over 400 ms; error row if the act failed (the
dialog stays). Locked document: a confirmation for a `document` act never opens; the Unlock popover
opens instead.

**5 · Copy.**

| Use | English | Turkish |
|---|---|---|
| Revert | Revert to the opened version? · Your {n} changes since opening go. Undo brings them back. · Revert | Açılan sürüme dönülsün mü? · Açtığınızdan beri yaptığınız {n} değişiklik gider. Geri al ile geri gelirler. · Geri dön |
| Clear kept | Clear 3 kept documents? · Their changes are removed from this device. Open documents stay as they are. · Clear | Saklanan 3 belge temizlensin mi? · Değişiklikleri bu cihazdan silinir. Açık belgeler olduğu gibi kalır. · Temizle |
| Remove signatures | Remove 2 saved signatures? · They are removed from this browser. Signed PDFs keep theirs. · Remove | Kayıtlı 2 imza kaldırılsın mı? · Bu tarayıcıdan silinirler. İmzalanmış PDF'lerdeki imzalar kalır. · Kaldır |

**6 · Behaviour.** Focus: Revert's action (undoable); Cancel for Clear and Remove (not undoable).
Enter activates the focused button; Esc cancels; the scrim ignores clicks. After the act: a toast
names it ("Reverted report.pdf · Undo" / "report.pdf geri döndürüldü · Geri al"). Guard: Revert asks
`canChange(id, 'document')`; Clear and Remove ask nothing (device storage).

**7 · Motion.** *dialog* centre; compact *sheet*. RM fade.

**8 · Accessibility.** `alertdialog`, `aria-describedby` the body. Danger label with `trash` or
`arrow-counter-clockwise` glyph, not colour alone (A-19).

**9 · Implementation.** `ui/sheet/Confirm.tsx` with `confirm({ title, body, action, danger,
undoable })` returning a promise. Tests: browser-mode focus target by `undoable`, scrim click
ignored; e2e Revert restores the opened bytes on Chromium.

## 4. S2 Save a copy

**1 · Role.** Every output that is not Save in place (F§5.1): a PDF with other settings, a smaller
PDF, page images, Markdown or text, a protected or signed copy, the repaired copy. Jobs J13B, J8B
(through S8), the "+ save" of jobs on browsers without File System Access. Opened by title → Save a
copy…, Mod+Shift+S (Chromium), Compress… (preset Size: Smaller, focus on Size), Export as images…
(Format: Images), Export as Markdown or text… (Format: Text), Save repaired copy (⌘K), the Replace
popover's Save a copy…. Replaces 12.1, 12.20, 12.21, 12.22, `CompressionExportRow` (INV-18).

**2 · Anatomy** (side sheet 400; form sheet 560 on medium; bottom sheet 92 % on compact).

```
╭────────────────────────────────────────────╮
│ Save a copy                             ✕  │
│ report.pdf · 12 pages · 2.4 MB             │
│ Format   [ PDF │ Images │ Text ]           │ segmented 32 / 44
│ Size     ○ Same as original     2.4 MB     │ radio rows, tnum, right-aligned
│          ● Smaller            ≈ 1.1 MB     │
│          ○ Smallest           ≈ 0.6 MB     │
│          ○ Custom…                         │
│          What gets smaller ›               │
│ ▸ Security     Same as document            │ disclosure rows: label · value
│ ▸ Metadata     Kept                        │
│ ▸ Flatten      Nothing flattened           │
│ ▸ Signature    Not signed                  │
│ Name     [ report-small.pdf            ]   │ well
│ ⚠ Existing signatures will not be in it.   │ only when relevant
├────────────────────────────────────────────┤
│ Built and checked on this device [Save copy]│
╰────────────────────────────────────────────╯
Images: Type PNG · JPEG │ Resolution 72 · 150 · 300 · Custom │ Quality (JPEG) │ Background White ·
        Transparent (PNG) │ Pages All · range │ ▸ File names {title}-{page}
Text:   Markdown · Plain text │ Pages │ ▸ Options: between pages, join hyphens, running headers,
        images (ZIP) │ ▸ Preview, first 40 lines (well, Copy)
```

**3 · Material.** S0 task sheet. Segmented Format uses the own-content lens on fine pointers (L§2.7).
Previews (Markdown, before/after) are solid wells. No light; success shows on the toast capsule.

**4 · States.**

| State | Behaviour |
|---|---|
| Estimating | Sizes read "Estimating…" (`aria-busy` on the group); the compress worker analyses at idle priority on open |
| Little to gain | Under 3 % saving: "Already compact" beside Smaller and Smallest; still selectable |
| Password chosen | Signature dimmed: "A password-protected copy cannot be signed here" (`sign_refused_encrypted`) |
| Unapplied redaction marks | The primary asks first, as Save does (spec 07.10): "2 marks not applied" with **Apply and save** as the default and "Save without applying" as the secondary, with the honesty line "The text under 2 marks is still in the file"; the M8 block goes (Issue 10) |
| Signed document | Warning row "Existing signatures will not be in this copy" unless Signature is on |
| Repaired source | Info row "This file was damaged and rebuilt on open. The copy is written from the rebuilt version." |
| Locked | Allowed (output only); no banner |
| Picker cancelled | Sheet stays, nothing announced |
| Working | Sheet closes; toast capsule "Saving copy… 40 %" with ring; Mod+Shift+S queued once |
| Done | Toast "Saved report-small.pdf · 1.1 MB · verified" with the success bloom; "· Details" when the summary lists changes |
| Failed | Persistent toast "Copy not saved: {reason} · Try again" (reopens the sheet with the draft); verification failure adds Details |

**5 · Copy.**

| Element | English | Turkish |
|---|---|---|
| Title · subtitle | Save a copy · report.pdf · 12 pages · 2.4 MB | Kopya kaydet · report.pdf · 12 sayfa · 2,4 MB |
| Format | Format · PDF · Images · Text | Biçim · PDF · Görüntüler · Metin |
| Size | Size · Same as original · Smaller · Smallest · Custom… · ≈ 1.1 MB · Estimating… · Already compact · What gets smaller | Boyut · Özgün boyut · Daha küçük · En küçük · Özel… · ≈ 1,1 MB · Hesaplanıyor… · Zaten küçük · Neler küçülür |
| Custom | Resolution (dpi) · JPEG quality · Compress images · Flatten transparent images onto white · Print (300 dpi) | Çözünürlük (dpi) · JPEG kalitesi · Görüntüleri sıkıştır · Saydam görüntüleri beyaz üzerine düzleştir · Baskı (300 dpi) |
| Security | Security · Same as document · No password · Password… · No password · the original had one | Güvenlik · Belgedeki gibi · Parolasız · Parola… · Parolasız · özgün dosyada parola vardı |
| Metadata | Metadata · Kept · Remove personal details · Choose… | Üst veriler · Korunur · Kişisel bilgileri kaldır · Seç… |
| Flatten | Flatten · Nothing flattened · Annotations · Form fields · Include comments as popups · Compatibility mode (PDF 1.4) | Düzleştir · Hiçbir şey düzleştirilmez · Ek açıklamalar · Form alanları · Yorumları açılır pencere olarak ekle · Uyumluluk modu (PDF 1.4) |
| Signature | Signature · Not signed · Sign with a certificate | İmza · İmzasız · Sertifikayla imzala |
| Name · footer | Name · Built and checked on this device | Ad · Bu cihazda oluşturulur ve denetlenir |
| Primary | Save copy · Download copy · Share copy · Preparing… 40 % | Kopyayı kaydet · Kopyayı indir · Kopyayı paylaş · Hazırlanıyor… %40 |
| Images extra | Copy to clipboard (one page) | Panoya kopyala (tek sayfa) |
| Text extra | Copy (preview) · No text on pages 3–4 · Recognize text first | Kopyala (önizleme) · 3–4. sayfalarda metin yok · Önce metni tanıyın |
| Toasts | Saving copy… 40 % · Saved report-small.pdf · 1.1 MB · verified · Details · Copy not saved: {reason} · Try again | Kopya kaydediliyor… %40 · report-small.pdf kaydedildi · 1,1 MB · doğrulandı · Ayrıntılar · Kopya kaydedilemedi: {reason} · Tekrar dene |

Name suffixes: Smaller and Smallest add "-small" (TR "-kucuk", ASCII so every share target accepts
it, judgement); Images "{title}-{page}.png" or a ZIP; Text ".md" or ".txt". Icons: `file-pdf`,
`image`, `file-text`, `download-simple`, `export` (share), `shield-check`, `seal-check`.

**6 · Behaviour.**
- **Primary by platform:** File System Access → Save copy opens `showSaveFilePicker` inside the
  press, then assembles, verifies and writes in chunks (`export/deliver.ts`); on failure the
  writable is aborted and an empty picked file is removed where `remove()` exists (Issue 7).
  Without it → Download copy. Coarse pointer with Web Share for files → Share copy (M-36); because
  sharing needs the press itself, the copy is pre-assembled 600 ms after the settings stop changing;
  if not ready, the button shows "Preparing… 40 %" and a second press shares (Issue 6).
- **Disclosures** open in place (`Collapsible`), one at a time on compact. "What gets smaller ›"
  pushes the result page with today's image table and a before/after preview of one page.
- **Security → Password…** shows S5's fields inline; values apply only to this copy.
- **Signature → Sign with a certificate** shows S8's rows inline; the press then runs the check
  before writing.
- **Keys:** J13B keyboard: Mod+K, `compress`, Enter (focus on Size), arrow, Tab, Enter, picker.
- **Guard:** none (output only). **Focus after:** the strip's Save or the title trigger; the
  toast's Details and Try again are in the F6 cycle (A-24). Announce "Saved report-small.pdf,
  verified" / "report-small.pdf kaydedildi, doğrulandı" (polite).
- **Edge:** the document changes while saving → the copy reflects the state at the press; a closed
  document cancels with "Copy not saved: report.pdf was closed".
- **Steps:** J13B mouse 8 → 5, keyboard ≈12 → ≈7, touch 8 → 5. Export as images 4 → 4 (title,
  item, Save copy, picker). Markdown 4 → 4.

**7 · Motion.** S0; Format change cross-fades the section body (120 ms) and the sheet height
follows on `--spring-smooth`; disclosures *tier rise*; estimates change by *replace*. RM: instant.

**8 · Accessibility.** Format `radiogroup` (segmented); Size `radiogroup` whose options carry their
estimate in the name ("Smaller, about 1.1 megabytes"); disclosure buttons `aria-expanded` with
the current value in the name. Preview well `role="region"` named "Preview, first 40 lines",
focusable, read-only. Contrast as S0.

**9 · Implementation.** `save-copy/SaveCopySheet.tsx`, `FormatSection.tsx`, `SizeSection.tsx`
(from `CompressDialog.tsx` presets: Smaller = 150 dpi q75, Smallest = 96 dpi q60, Print 300 dpi
q85 inside Custom), `ImagesSection.tsx` (from `ImageExportDialog.tsx`), `TextSection.tsx` (from
`ConvertDialog.tsx`), `SecuritySection.tsx` (shares `document/password-form.ts`),
`save-copy-store.ts`; `export-service.ts`, `deliver.ts`, `summary.ts` kept. Deleted:
`ExportDialog.tsx`, `CompressDialog.tsx`, `ImageExportDialog.tsx`, `ConvertDialog.tsx`,
`CompressionExportRow.tsx`. Tests: unit preset → settings, name suffixes EN/TR, primary by
capability; browser-mode Format switch keeps per-format drafts; e2e J13B on all projects (Chromium
mocked picker, Firefox download, WebKit share mocked), verification failure toast, signed-file
warning, unapplied marks ask (both answers); axe.

## 5. S3 Settings

**1 · Role.** The one place for preferences (F§9.5, INV-20). Opened by More → Settings…, Library ⋯,
Mod+, (where the browser leaves it), ⌘K, ◎ → Privacy settings…, "Recto 1.0.0" (→ About). Replaces
the Appearance submenu (15.1.1), the palette-only language switch (15.1.3), the comment-author
prompt's setting (15.1.4), the OCR language manager (12.23) and the About dialog (12.27).

**2 · Anatomy.** One scrolling grouped list at every size with a search field; four long sections
push a page (S0 page stack).

```
╭──────────────────────────────────────────────╮  form 600 centred (medium+, R15), full on compact
│ Settings                                  ✕  │
│ [ ⌕ Search settings                       ]  │
│ Appearance                                   │
│  Theme          [ ▭ System │ ☼ Light │ ☾ Dark ]
│  Glass          [ Clear │ Tinted │ Solid ]    │
│  Ambient light  [ Auto │ Still │ Off ]        │
│  Reduce motion  [ System │ On ]               │
│  Background glow                      (●  )   │ on by default (G5)
│  Haptics                              (●  )   │ Android only
│ Language         English · Türkçe · Browser   │
│ Pen and touch                                │
│  Pen writes without Markup            (  ●)   │
│  Pen draws in Markup with Select      (●  )   │
│  Draw with finger    [ Auto │ On │ Off ]      │
│  Keep tools visible                   (  ●)   │ compact only
│ Documents and storage                        │
│  Open documents locked                (  ●)   │
│  Keep changes on this device          (●  )   │
│  Kept documents       3 · 34 MB            › │ push
│  Saved signatures     2 of 5               › │ push
│  Name on comments  [ Ada Lovelace          ]  │
│  Show tips and facts again                   │
│ Privacy                                    › │ push
│ OCR languages         English, Türkçe      › │ push
│ Keyboard shortcuts                         › │ push (fine pointer or keyboard seen)
│ About Recto           1.0.0 · Public beta  › │ push
╰──────────────────────────────────────────────╯
```

**3 · Material.** S0 settings presentation. Segmented controls get the own-content lens (L§2.7,
F§13.2 item 4). The Glass control shows its own effect immediately behind the sheet.

**4 · States.** System overrides: Glass "Solid, set by your system" when
`prefers-reduced-transparency`; Reduce motion "On, set by your system"; Ambient light "Off, set
by your system" under forced colours or more contrast (L§3.4, L§7.6); each control disabled with
that line. Kept documents empty: "Nothing kept yet"; private window: "Changes are not kept in this
window" and Keep changes dimmed with that reason. Storage not persistent: row "The browser may
clear kept changes · Keep them". OCR language downloading: row progress "Downloading… 40 %". No
lock banner (no document act). Search with no match: "No setting matches “x”".

**5 · Copy.**

| Element | English | Turkish |
|---|---|---|
| Sections | Appearance · Language · Pen and touch · Documents and storage · Privacy · OCR languages · Keyboard shortcuts · About Recto | Görünüm · Dil · Kalem ve dokunma · Belgeler ve depolama · Gizlilik · OCR dilleri · Klavye kısayolları · Recto hakkında |
| Theme · Glass | Theme: System · Light · Dark · Glass: Clear · Tinted · Solid | Tema: Sistem · Açık · Koyu · Cam: Saydam · Yarı saydam · Opak |
| Light · Motion · Haptics | Ambient light: Auto · Still · Off · Reduce motion: System · On · Haptics | Ortam ışığı: Otomatik · Durgun · Kapalı · Hareketi azalt: Sistem · Açık · Dokunsal geri bildirim |
| Background glow (owner feedback 2026-10-09, G5; on by default) | Background glow · A soft light behind the pages, as in the Library. | Arka plan ışıltısı · Sayfaların arkasında, Kitaplık’taki gibi yumuşak bir ışık. |
| System line | Solid, set by your system | Opak, sisteminiz tarafından ayarlandı |
| Language | English · Türkçe · Follow the browser (English) | English · Türkçe · Tarayıcıya uy (Türkçe) |
| Pen and touch | Pen writes without Markup · Pen draws in Markup with Select · Draw with finger: Auto · On · Off · Keep tools visible | Kalem İşaretleme olmadan yazsın · Kalem, Seçim etkinken İşaretleme'de çizsin · Parmakla çiz: Otomatik · Açık · Kapalı · Araçlar hep görünsün |
| Hints | Auto turns on when a pen is first used. · Auto: fingers draw until a pen is seen. | Otomatik, kalem ilk kullanıldığında açılır. · Otomatik: kalem görülene kadar parmak çizer. |
| Documents | Open documents locked · Keep changes on this device · Kept documents · Saved signatures · 2 of 5 · Name on comments · Show tips and facts again | Belgeler kilitli açılsın · Değişiklikler bu cihazda saklansın · Saklanan belgeler · Kayıtlı imzalar · 2/5 · Yorumlardaki ad · İpuçlarını ve bilgileri yeniden göster |
| Privacy page | Nothing you open leaves this device. Requests to other sites: none. Works offline. | Açtığınız hiçbir şey bu cihazdan çıkmaz. Diğer sitelere istek: yok. Çevrimdışı çalışır. |
| About page | Version · Build · Licence Apache-2.0 · Source ↗ · Release notes ↗ · Storage in use · Offline ready · About Recto ↗ | Sürüm · Derleme · Lisans Apache-2.0 · Kaynak kodu ↗ · Sürüm notları ↗ · Kullanılan depolama · Çevrimdışına hazır · Recto hakkında ↗ |
| Search | Search settings · No setting matches “{q}” | Ayarlarda ara · “{q}” ile eşleşen ayar yok |

Icons: `gear-six`, `monitor` `sun` `moon`, `translate`, `pen`, `hard-drives`, `shield-check`, `scan`,
`keyboard`, `info`, `caret-right`. Language names stay in their own language.

**6 · Behaviour.** Every control applies at once and persists (`appearance-store`,
`input-policy-store`, `locale.ts` without a reload); no Save button. Search filters rows by EN and
TR keywords without diacritics (as ⌘K) and opens pushed sections when a row inside matches. Kept
documents page: rows "report-v2.pdf · 4.1 MB · 2 days" with Clear per row and Clear all… (S1);
Saved signatures page: previews with Remove and Remove all… (S1); OCR languages page: today's
`OcrLanguages` rows (On this device · size, Keep available offline, Remove, Import language
file…); Shortcuts page: S22's list; About: the About dialog's facts plus the About page link
(F§2.1). Guard: none, except "Open documents locked" which affects only documents opened later.
Focus: on open, the search field on fine pointers, the first row on coarse (no keyboard pops up).
Announce changes of system-overridden values only ("Glass is solid because of a system setting").
Steps: Theme 3 (More · Settings… · Light); Glass today 3 with a file open, here 3 always.

**7 · Motion.** S0; theme change cross-fades the root over `--duration-slow` (280 ms; RM 150 ms);
segment thumbs on `--spring-press`; pushed pages *sheet push*.

**8 · Accessibility.** Groups are `section`s with headings; segmented controls `radiogroup`;
switches `role="switch"`; disabled-by-system controls stay focusable with the reason. Search
`role="search"`; result count polite. Keyboard shortcuts row hidden on coarse pointers until a
physical key press (L§6.2). A-7, A-9, A-17, A-21.

**9 · Implementation.** `settings/SettingsSheet.tsx`, `settings/sections/*.tsx` (Appearance,
Language, PenTouch, Storage, Privacy, OcrLanguages from `ocr/OcrLanguages.tsx`, Shortcuts, About
from `shell/about/*`), `settings/search-index.ts`; stores `appearance-store.ts` (theme, glass,
light, motion, haptics; migration of `glassPanels`, `reduceTransparency`), `input-policy-store.ts`,
`session/storage-summary.ts`, `signatures/saved-signatures.ts`. Deleted: `shell/appearance-commands.ts`
toggles (commands now open Settings or set the value), `shell/about/AboutDialog.tsx`, the Appearance
submenu in `DocumentMenu.tsx`. Tests: unit search index EN/TR (`İ`/`ı`, diacritics); browser-mode
system overrides disable with reasons, language switch without reload; e2e theme persists across
reload on all projects; axe in both themes.

## 6. S4 Document info

**1 · Role.** Facts, metadata, protection status, removal of hidden data, diagnostics. Title →
Document info…, ⓘ facts "All details", ⌘K; title → Remove metadata… opens it at "Remove when
saving". Replaces 12.2 and 12.5; the inspector's Info (INV-13).

**2 · Anatomy.** Task sheet. Facts grid (label footnote n11 · value body, `tnum`); badges row;
Metadata fields (Title, Author, Subject, Keywords, Language) with ▸ Custom keys; Password row
(status · Change…, opens S5); Remove when saving (checklist with "{n} found" counts from
`strip_*`); ▸ Diagnostics (on demand); repaired source row with Save repaired copy (opens S2).
Footer: Reset fields · Done.

**3 · Material.** S0. Fields are wells; facts grid on M5 text.

**4 · States.** Fields commit on blur or Enter as one undo step each ("Changed title"); invalid
language tag: field error `meta_language_invalid`; checking counts: "Checking the files…"; partial
check: warning row `strip_partial`; locked: fields read-only, Remove checklist dimmed, lock banner;
diagnostics running: busy row.

**5 · Copy.** Existing `info_*`, `meta_*`, `strip_*`, `diag_*` strings. New: "Document info" /
"Belge bilgileri"; "Remove when saving" / "Kaydederken kaldır"; "All details" / "Tüm ayrıntılar";
"Change…" / "Değiştir…"; "Save repaired copy" / "Onarılmış kopyayı kaydet". Icons `info`,
`password`, `trash`, `wrench`.

**6 · Behaviour.** Guard `document` for metadata edits and removal choices (they change what Save
writes). Focus on open: Title field, or the Remove list when opened from Remove metadata….
Announce "Title changed" (polite). Steps: edit a title: title ▾ · Document info… · type · Enter = 4
(today 4 through the Document menu).

**7 · Motion.** S0; disclosures *tier rise*.

**8 · Accessibility.** Facts as a description list (`dl`); counts in each checkbox name ("XMP
metadata, 3 found").

**9 · Implementation.** `document/DocumentInfoSheet.tsx` from `DocumentDialogs.tsx`,
`MetadataEditor.tsx`, `SecurityInfo.tsx`, `Diagnostics.tsx`, `strip-items.ts`. Tests: existing
`document-tools.test.tsx` migrated; browser-mode one undo step per field; e2e locked read-only.

## 7. S5 Password

**1 · Role.** Set, change or remove the passwords and permissions that Save and Save a copy write.
Title → Password…, S4's Change…, ⌘K. Replaces 12.3 and 12.4 (remove lives inside, RA-21).

**2 · Anatomy.** Task sheet: Password to open [well] · Password to change permissions [well] ·
Show passwords · ▸ Allow (printing, copying, changing, filling forms, accessibility) · strength
meter under each password (`password-strength.ts`) · AES-256 line · footer Remove password (only
when one is set, danger) · Cancel · Set password.

**3 · Material.** S0. Strength meter: 4 segments, n7 empty, n12 filled, words beside ("Weak",
"Strong"); never colour alone.

**4 · States.** Errors `set_password_error_none`, `_same`, `_long`; random owner note when the
permissions password is empty; restricted source: info row "The file had restrictions:
{list}"; locked: banner, fields read-only.

**5 · Copy.** Existing `set_password_*`, `security_*`. New: "Password" / "Parola"; "Remove
password" / "Parolayı kaldır"; "Passwords stay on this device and are written only into saved
files." / "Parolalar bu cihazda kalır, yalnızca kaydedilen dosyalara yazılır."; strength "Weak ·
Fair · Strong" / "Zayıf · Orta · Güçlü". Icons `password`, `eye`, `eye-slash`.

**6 · Behaviour.** Guard `document`. Set password commits one undo step and a toast "Password set ·
applies when you save" / "Parola belirlendi · kaydettiğinizde uygulanır". Remove asks S1. Inputs
`type="password"`, `autocomplete="new-password"`; Show toggles both. Focus: first field. Steps:
title ▾ · Password… · type · Set password = 4, then Save 1 (today 4 + export 3).

**7 · Motion.** S0. **8 · Accessibility.** Show passwords `switch`; meter `role="meter"` with
`aria-valuetext`; errors linked. **9 · Implementation.** `document/PasswordSheet.tsx`,
`password-form.ts` shared with S2. Tests: unit validation (127 bytes, same passwords); e2e set,
save a copy, reopen asks for it.

## 8. S6 Password prompt on open

**1 · Role.** Open an encrypted file (J1, J2 with protected files). Replaces 12.25; makes Skip
visible (INV-6).

**2 · Anatomy.** Centred dialog 400 / compact modal sheet: title2 "Password required", body
"report.pdf is protected. The password is used on this device only.", well, Show, queue "1 of 3"
in the subtitle when several files wait; Skip file · Open.

**3 · Material.** M5 σ 24 over the scrim; over the Library, the field is frozen (L§3.5).

**4 · States.** Wrong password: field error `password_incorrect`, field cleared and focused; busy
on Open while PDFium tries (> 400 ms); Esc = Skip.

**5 · Copy.** Existing `password_*`. New toast: "Skipped report.pdf: it needs a password · Try
again" / "report.pdf atlandı: parola gerekiyor · Tekrar dene"; queue "1 of 3" / "1/3". Icon
`lock-key`.

**6 · Behaviour.** Enter opens; Skip shows the toast (Try again reopens the prompt for that file);
the next queued file follows. Guard: none. Focus: field; after the last file, the opened document's
page (A-13). Announce "report.pdf opened" (polite) or the skip (polite, with the toast). Steps:
+2 (type, Enter) as today.

**7 · Motion.** *dialog* centre; a wrong password changes the error line by *replace*, no shake
(L§8). **8 · Accessibility.** `alertdialog`; `autocomplete="current-password"`; error assertive
(blocking). **9 · Implementation.** `shell/PasswordPrompt.tsx` from `PasswordDialog.tsx`; queue in
`state/password-store.ts`. Tests: browser-mode wrong then right password; e2e skip toast visible.

## 9. S7 New signature (shell)

**1 · Role.** The shell for 03-markup MK-13 (draw, type or image; kept on the device). J8A first
time (5 presses). Opened by Sign ▾ → New signature…, G with none saved, a signature field's
picker, page menu → Add signature here ▸ New signature…. Replaces 12.7's shell.

**2 · Anatomy.** Task sheet, but **centred 520** on fine pointers (the pad needs width, not
height; Issue 5 lists the exception) and bottom sheet 92 % on compact, where the pad is full width
× 180 and the sheet does not move while drawing (swipe only from the grabber). Content per MK-13.

**3 · Material.** M5 σ 48; pad solid page white (L§2.10).

**4 · States.** Per MK-13; drawing on the pad sets `touch-action: none` on the pad only.

**5 · Copy.** MK-13. **6 · Behaviour.** Use signature arms the one-shot placement and closes; focus
to the page (Enter places at the centre, F§3.4). Guard: none here (placing is `place`). **7 ·
Motion.** S0; pad strokes never animate (*ink*). **8 · Accessibility.** MK-13. **9 ·
Implementation.** `signatures/NewSignatureSheet.tsx` on `ui/sheet`. Tests: MK-13's; e2e swipe on
the pad draws and does not dismiss.

## 10. S8 Sign with certificate

**1 · Role.** A digital (PAdES-B) signature on a saved copy. J8B. Title → Sign with certificate…,
Sign ▾ → Certificate…, ⌘K; also inline in S2's Signature section. Replaces 12.6 and
`ExportSignatureSection`.

**2 · Anatomy.** Task sheet: Certificate file [Choose…] with the chosen name; Password [well];
signer preview card (name, issuer, expires, `tnum` dates) with the honesty line; Show the signature
on a page (switch, off) → Page [n] · Position (four corners); ▸ Details (reason, location, contact).
Footer: Cancel · Sign and save a copy….

```
│ Certificate   ada.p12                 Change… │
│ Password      [ ••••••••               ]     │
│ ╭ seal-check  Ada Lovelace ───────────────╮  │ solid well
│ │ Issued by Example CA · expires 2027-03-01│  │
│ │ Read from the file. Nobody has verified  │  │
│ │ this identity.                           │  │
│ ╰──────────────────────────────────────────╯  │
│ Show the signature on a page          (  ●)  │
│ ▸ Details   reason, location, contact        │
```

**3 · Material.** S0; preview card a solid well. Success glyph only on a passed check.

**4 · States.** Checking (auto, 400 ms after the password stops changing): "Checking the
certificate…"; refused: field error with `sign_refused_*` (legacy encryption, wrong password,
malformed, no key, unsupported key); expired certificate: warning row "This certificate expired on
{date}"; signed document: info row "The new signature is added after the existing ones" (copy keeps
them only through an incremental save, else `signature_export_notice`); locked: allowed (output
only).

**5 · Copy.** Existing `sign_*`. Changes: primary "Sign and save a copy…" / "İmzala ve kopya
kaydet…"; "Choose…" / "Seç…"; toast "Signed and saved ada-signed.pdf · verified" / "ada-signed.pdf
imzalandı ve kaydedildi · doğrulandı". Icons `seal-check`, `certificate`, `file-arrow-up`.

**6 · Behaviour.** The press opens the save picker (gesture), waits for the check if still running,
then assembles, signs and writes; progress in the toast stack. The .p12 and password stay in memory
for the session only and are never stored (judgement on scope; today the same). Guard: none.
Focus: Choose… on open, Password after a file is chosen. Steps: J8B mouse 8 → 6, keyboard ≈12 → ≈8,
touch 8 → 6.

**7 · Motion.** S0; preview card enters by *tier rise*. **8 · Accessibility.** File button names
the chosen file; preview card `role="status"` (polite); refusals assertive. **9 · Implementation.**
`signatures/CertificateSheet.tsx` from `SignDialog.tsx`, `CertificateFields.tsx` shared with S2.
Tests: unit check scheduling; e2e J8B with the fixture .p12 on Chromium; refusal strings EN/TR.

## 11. S9 Signatures

**1 · Role.** Validity of the signatures in the file (J8B check, signed files). Title →
Signatures…, facts chip "Signed by …", the tab seal, ⌘K. Replaces the inspector's Signatures
section and the badge's target (14.5).

**2 · Anatomy.** Task sheet: one card per signature: status glyph + word (Intact · Intact, changed
later · Changed after signing · Broken · Cannot check), signer, time (claimed), revision n of N,
▸ Certificates and checks, ▸ Later changes, View signed version; honesty line at the top. Unsigned
signature fields listed last.

**3 · Material.** S0. Status uses success, warning or danger glass variants with `seal-check`,
`warning`, `x-circle` (A-19).

**4 · States.** Checking: "Checking signatures…" (busy); failed check: error row
`signature_check_failed`; empty: "This file has no digital signatures." / "Bu dosyada dijital imza
yok."; edited signed file: warning row `signature_export_notice_edited`.

**5 · Copy.** Existing `signature_*` strings (status, explain, checks, chain). Title "Signatures" /
"İmzalar".

**6 · Behaviour.** View signed version opens it as a read-only tab (today's behaviour) and closes
the sheet. Guard: none (reading). Focus: first card.

**7 · Motion.** S0. **8 · Accessibility.** Each card an `article` named by signer and status.
**9 · Implementation.** `signatures/SignaturesSheet.tsx` from `SignaturesSection.tsx`; badge code
moves to the tab seal (01-frame). Tests: existing `signatures.test.tsx`; e2e status words on the
signed fixture.

## 12. S10 Recognize text (OCR)

**1 · Role.** Make scanned pages searchable (J11). Facts chip "No text on 2 pages · Recognize"
(opens with focus on the primary), Find's empty state, title → Recognize text…, page menu →
Recognize text on this page (preset Current page), ⌘K. Replaces 12.23 (languages move to S3).

**2 · Anatomy.** Tool sheet (the page stays live; recognised words appear on the page as they
land). Pages: Without text (n) · All (n) · Current page · Range; Languages: chips of the chosen
languages with Change… (opens S3 → OCR languages); Quality Standard · High; Replace existing
invisible text (switch, shown only when some exists); download note on first use; honesty line.
Primary "Recognize 2 pages".

**3 · Material.** S0 tool sheet. Running progress lives on the toast capsule with the ring.

**4 · States.** Checking pages: busy line; no languages: primary dimmed "Choose at least one
language"; language not cached and offline: "Needs a connection once to download English
(4.1 MB)"; signed document: warning `ocr_signed_warning`; locked: banner; running: the sheet closes,
capsule "Recognizing text… 1 of 2 pages"; done: toast "2 pages recognized · Review" with bloom;
low confidence: toast "2 pages recognized · 14 words to check · Review" (Review opens the sidebar
Review on its Words to check filter, `06-navigation` N5, spec X33; J / K step).

**5 · Copy.** Existing `ocr_*` strings. Changes: primary `ocr_run` ("Recognize {count} pages" /
"{count} sayfayı tanı"); "Change…" / "Değiştir…"; toast "{n} pages recognized · Review" / "{n}
sayfa tanındı · Gözden geçir". Icon `scan`.

**6 · Behaviour.** Guard `document` (F§2.5). Esc closes; a running job continues; tapping the
capsule reopens the sheet showing progress and Cancel recognition. Focus: primary when opened
from the chip, Pages otherwise. Steps: J11 mouse 4 → 3 (2 while the chip shows), keyboard ≈7 → ≈4,
touch 4 → 3 (2).

**7 · Motion.** S0; capsule *progress*, *success*. **8 · Accessibility.** Progress announced at
page boundaries (polite); languages chips in a list with the order note. **9 ·
Implementation.** `ocr/OcrSheet.tsx` from `OcrDialog.tsx`; `OcrStatus.tsx` folds into the toast
capsule. Tests: existing `OcrDialog.test.tsx` migrated; e2e J11 path from the chip.

## 13. S11 Page furniture: page numbers, header and footer, Bates, watermark

**1 · Role.** Add page furniture with a live preview that stays visible at every size (J16). Title →
Add to pages ▸, More → Add to pages ▸, ⌘K. One component, four variants. Replaces 12.9–12.12.

**2 · Anatomy.** Tool sheet. Header title per variant; when furniture of this kind exists, the
sheet edits it and offers Remove (footer, danger).

| Variant | Controls (defaults from `furniture-model.ts`) | Primary |
|---|---|---|
| Page numbers | Format [{page} ▾: 1 · Page 1 · Page 1 of N · 1 / N · Custom…]; Position 3 × 2 grid (bottom centre); Pages All ▾ (All · All but the first · Odd · Even · Range); Start at 1; ▸ Font and margins (Inter 10 pt, black, side 36, edge 28 pt, mirror on even pages) | Apply |
| Header and footer | Six slots (top left {title}, top right {date}, bottom right {page} / {pages}), Tokens menu; Pages; ▸ Font and margins (9 pt, `#404040`) | Apply |
| Bates numbering | Prefix · Digits 6 · Start 1 · Suffix; sample "ABC000001 to ABC000012"; "Last number used with this prefix" line; Documents in tab order (when several open); Position (bottom right) | Apply |
| Watermark | Text · Image; text DRAFT, 72 pt bold `#c0392b` 20 %; Rotation 45°; Scale; Tile with gaps; Layer Over · Behind; Pages | Apply |

Preview placement: medium and up, the page column re-fits beside the sheet and the stage scrolls
so the anchored edge of the current page sits inside the free rectangle; compact, the 40 % detent
leaves 415 px above it on a 390 × 844 phone and the stage scrolls the same way; raising the sheet to
92 % shows a 120 px live thumbnail strip of the affected edge pinned under the header (judgement),
so the preview is never lost.

**3 · Material.** S0 tool sheet; preview drawn by `FurnitureLayer` on the page (content layer),
dashed `--select` outline around preview items on the current page.

**4 · States.** Invalid range: field error; image not readable: `furniture_image_failed`; Behind
layer note `furniture_behind_note`; locked: banner, preview still shows; existing furniture: title
"Edit page numbers", Remove (S1).

**5 · Copy.** Existing `furniture_*`. New: "Edit page numbers" / "Sayfa numaralarını düzenle";
"Font and margins" / "Yazı tipi ve kenar boşlukları"; toast "Added page numbers to 12 pages · Undo"
/ "12 sayfaya sayfa numarası eklendi · Geri al". Icons: `list-numbers`, `square-half-bottom`,
`barcode`, `drop-half`, custom *page furniture* (I-7) in menus.

**6 · Behaviour.** Every change previews within one frame; Apply commits one undo step and a toast,
closes the sheet, focus to the title trigger. Guard `document`. Steps: J16 mouse 4 → 4 (title ▾ ·
Page numbers… · "Page 1 of N" · Apply), keyboard ≈7 → ≈5 (Enter applies from the Format control),
touch 4 → 4.

**7 · Motion.** S0; preview updates without animation. **8 · Accessibility.** Position grid a
`radiogroup` with arrow keys and names ("Bottom centre"); preview described by
`furniture_preview_note`. **9 · Implementation.** `furniture/FurnitureSheet.tsx` and four
`*Fields.tsx` from `FurnitureDialogs.tsx`; `preview-blobs.ts`, `furniture-preview.ts` kept. Tests:
existing furniture tests; e2e J16 on phone (preview visible above the sheet: a pixel probe on the
page's bottom band) and desktop.

## 14. S12 Crop pages

**1 · Role.** Crop margins of one page or many. Page menu → Crop page… (preset this page), title →
Crop pages…, Pages bar ⋯ → Crop…, ⌘K. Replaces 12.18 and the draw banner.

**2 · Anatomy.** Tool sheet: Margins top · right · bottom · left (number fields, pt) with a link
toggle; Pages This page · Selected (n) · All; Draw crop area (button: the next drag on the page sets
the area); Also remove the content outside (switch, off) with its warning; preview line
`crop_preview`. The crop rectangle and its handles are drawn **on the page** in `--select`.

**3 · Material.** S0 tool sheet; handles on the page are content (L§1.5).

**4 · States.** `crop_error_invalid`, `crop_error_too_small`; resized pages note; remove switch on:
primary "Crop and remove" (danger) and a busy state "Removing… 40 %"; existing crop: Remove crop
(S1); locked: banner, handles hidden.

**5 · Copy.** Existing `crop_*`. Icon `crop`.

**6 · Behaviour.** Dragging a handle updates the fields; arrows on a focused handle nudge 1 pt,
Shift 10 pt. Guard `pages`. Commit: one undo step, toast "Cropped 3 pages · Undo". Focus: Top field.

**7 · Motion.** S0. **8 · Accessibility.** Handles are sliders with `aria-valuetext` "Top edge, 24
pt"; Draw crop area announces `crop_draw_started`. **9 · Implementation.** `crop/CropSheet.tsx`
from `CropDialog.tsx`; `CropLayer.tsx` gains handles; `CropDrawBanner.tsx` deleted. Tests:
existing `crop.test.tsx`; e2e handle drag on desktop and phone.

## 15. S13 Split

**1 · Role.** Cut a document into several. Title → Split…, grid bar ⋯, ⌘K. Replaces 12.15.

**2 · Anatomy.** Tool sheet **over the Pages grid** (opening Split switches the surface to the grid
with *view change*): How Every n pages · Page ranges · At top-level bookmarks · Before each selected
page; the grid shows cut lines between cells in `--select` and part labels "1 of 3". Primary
"Split into 3".

**3 · Material.** S0; cut lines are content marks in the grid. **4 · States.** `split_*` errors
(single part, invalid number, no bookmarks); selection mode with no selection: reason line; locked:
banner. **5 · Copy.** Existing `split_*`; primary "Split into {n}" / "{n} belgeye böl". Icon
`scissors`. **6 · Behaviour.** Guard `pages` (the original keeps only pages outside the ranges).
Commit: parts open as tabs, one undo step, toast "Split into 3 documents · Undo"; Done returns to the
page. Focus: How. **7 · Motion.** *view change* into the grid, cut lines fade 120 ms. **8 ·
Accessibility.** Cut positions announced ("Cut after page 4"). **9 · Implementation.**
`pages-sheets/SplitSheet.tsx`, grid overlay in `PageCell.tsx`. Tests: unit spec → cut list; e2e
every-2 on a 6-page fixture.

## 16. S14 Interleave

**1 · Role.** Merge front and back scans, or alternate two documents. Title → Interleave…, ⌘K.
Replaces 12.16.

**2 · Anatomy.** Task sheet: Second document (radio list of open documents); Order Alternate ·
Duplex scan (with hints); resulting order preview (12 small slots, "+8 more"). Primary
"Interleave".

**3 · Material.** S0; slots are solid thumbnails. **4 · States.** One document open: "Open a second
document first · Open…"; a locked source is allowed, since it is only read. **5 · Copy.** Existing `interleave_*`; title
"Interleave report.pdf" / "report.pdf belgesini harmanla"; primary "Interleave" / "Harmanla". Icon
`shuffle`. **6 · Behaviour.** Guard: none, the sources are read (spec 07.13, X32): `interleave(…, {
keepSources: true })` makes a new document after the last source and both sources stay open;
one undo step and toast
"Interleaved into report + back.pdf · Undo" (Issue 13). **7 · Motion.** S0. **8 ·
Accessibility.** Preview list named "Resulting page order". **9 · Implementation.**
`pages-sheets/InterleaveSheet.tsx`. Tests: e2e duplex order on fixtures.

## 17. S15 Combine with open documents

**1 · Role.** Combine documents that are already open into a new one, from a document (J3's
in-document route). Title → Combine with open documents…, ⌘K. The Library's Combine needs no sheet
(02-library). Replaces 12.13's Merge-all outcome; one outcome: a new document, sources kept (INV-12,
INV-R6). 12.14 Merge into… is removed (§25).

**2 · Anatomy.** Task sheet: checklist of open documents in `documentOrder` (current one checked
and first), drag handles and ‹ › to reorder, Name [report + agreement]; "Creates 1 document with 16
pages". Primary "Combine".

**3 · Material.** S0; rows 28 / 44 with thumbnails. **4 · States.** Fewer than two checked: primary
dimmed "Choose at least two documents". Locked sources: allowed (reads only). **5 · Copy.** "Combine
with open documents" / "Açık belgelerle birleştir"; "Creates 1 document with {pages} pages" /
"{pages} sayfalık 1 belge oluşturur"; primary "Combine" / "Birleştir"; toast "Combined 2 files · Undo"
/ "2 dosya birleştirildi · Geri al". **6 · Behaviour.** Guard: none (new document). Commit opens the
new document in its Pages grid (F§1.3). Reorder: Alt+arrows on a row. **7 · Motion.** S0; rows
*reflow*, drag *lift and settle*. **8 · Accessibility.** Listbox with reorder announced ("Moved
agreement.pdf to position 1"). **9 · Implementation.** `pages-sheets/CombineSheet.tsx`; `mergeAll`
keeps sources. Tests: unit order; e2e combine from a document.

## 18. S16 Extract pages

**1 · Role.** Copy or move pages into a new document. Page menu → Extract page…, Pages bar ⋯,
Mod+Shift+E opens it with the selection. New sheet (today an immediate command).

**2 · Anatomy.** Task sheet: Pages [3, 5-7] (prefilled from the selection); Keep them in
report.pdf · Remove them from report.pdf (Keep default); Name. Primary "Extract 4 pages".

**3 · Material.** S0. **4 · States.** Invalid range error; Remove while locked: that option dimmed
"Locked" (Keep stays allowed, F§2.6). **5 · Copy.** "Extract pages" / "Sayfaları ayıkla"; "Keep them
in {title}" / "{title} içinde kalsın"; "Remove them from {title}" / "{title} belgesinden çıkarılsın";
primary "Extract {n} pages" / "{n} sayfayı ayıkla". Icon `file-plus`. **6 · Behaviour.** Guard:
none for Keep; `pages` for Remove. The new document opens as a tab; toast with Undo. **7 ·
Motion.** S0. **8 · Accessibility.** Range field `aria-describedby` the example. **9 ·
Implementation.** `pages-sheets/ExtractSheet.tsx`. Tests: e2e keep and remove.

## 19. S17 Resize pages and S18 Insert images as pages

**S17 Resize pages.** 1 Role: page size change (title → Resize pages…, grid bar ⋯); replaces 12.17.
2 Anatomy: task sheet, Paper (A4 · A5 · Letter · Legal · Tabloid · Custom · Original size), width ×
height with unit mm · in · pt, Orientation, Keep each page's orientation, Content Scale · Fit ·
Canvas, 3 × 3 anchor, Apply to (selected · all · every page sized …), first-page preview well.
Primary "Resize". 3 Material: S0. 4 States: `resize_error_size`; locked banner. 5 Copy: existing
`resize_*`; icon `arrows-out`. 6 Behaviour: guard `pages`; one undo step, toast. 7 Motion: S0;
preview updates instantly. 8 Accessibility: anchor `radiogroup`. 9 Implementation:
`pages-sheets/ResizeSheet.tsx` from `ResizeDialog.tsx`; existing tests migrated.

**S18 Insert images as pages.** 1 Role: after choosing images in Insert pages from file…, set page
size; replaces 12.19. 2 Anatomy: task sheet, n images listed, Page size Fit image · A4 · Letter,
Margin. Primary "Insert 3 pages". 3–5: S0; strings from today's insert dialog; icon `image`. 6:
guard `pages`; inserts after the current page; toast with Undo. 7–8: S0. 9:
`pages-sheets/InsertImagesSheet.tsx`; e2e insert two PNGs.

## 20. S19 Apply redactions

**1 · Role.** Remove the content under redaction marks for good (J10). Pending-marks bar → Apply,
title → Apply redactions…, ⌘K `apply`. Replaces 12.8 (confirmation → self-check → result sheet).

**2 · Anatomy.** Confirmation (S1 form) 400 wide: "Apply 2 redactions?", body "The text and images
under them are removed from the saved file.", ▸ Marks (checklist, all ticked, with page numbers),
Fill colour (black · white), Cancel · Apply 2 redactions (danger label, `redact` custom glyph).
Result: the S0 result page reached from the toast's Details.

**3 · Material.** M5 σ 24 (grows to σ 48 when ▸ Marks opens past 260 px). No lime, no light (L§3.2).

**4 · States.** None ticked: primary dimmed `redaction_apply_none`; busy "Applying… 40 %", Esc and
✕ blocked with the announcement "Applying redactions; this takes a moment" (the only blocking
sheet, because the document must not change mid-apply); failed: error row `redaction_apply_failed`;
locked: never opens (Unlock popover instead).

**5 · Copy.** Existing `redaction_apply_*`, `redaction_result_*`. Title "Apply {n} redactions?" /
"{n} karartma uygulansın mı?"; toast "2 areas redacted · Undo · Details" / "2 alan karartıldı · Geri
al · Ayrıntılar".

**6 · Behaviour.** Guard `document`. Focus on the action (undoable in the app; J10 keyboard Enter ·
Enter). After: the sheet closes, toast, Redact disarms to Select (F§4.4); Details pushes the result
page (self-check list with check and cross glyphs). Steps: J10 mouse 8 → 6, touch 9 → 7.

**7 · Motion.** *dialog* centre; result *sheet push*. Neutral check only, no bloom (L§8).
**8 · Accessibility.** `alertdialog`; result as a list with pass/fail words. **9 ·
Implementation.** `redaction/ApplySheet.tsx` from `ApplyRedactionsDialog.tsx`; `apply-store.ts`
kept. Tests: existing `apply.test.ts`; e2e J10 to the toast; Esc blocked while busy.

## 21. S20 Find sensitive data

**1 · Role.** Find e-mail addresses, phone numbers, IBANs, Turkish ID numbers, card numbers and
dates, then mark them for redaction. Title → Find sensitive data…, pending bar ⋯, + on xlarge
(03-markup), ⌘K. Replaces the `MarkMatchesButton` result panel.

**2 · Anatomy.** Tool sheet: kinds as switches with counts (`redaction_pattern_*`, all on except
Dates); results grouped by page, each "Mark “ada@example.com” on page 3" checkbox; Select all;
primary "Mark 7". Hits show on the page as `--select-wash`; the current one strong.

**3 · Material.** S0 tool sheet; long result list in a sunken well (L§2.10). **4 · States.**
Searching "Searching page 3 of 12…"; none `redaction_find_none`; stale pages `redaction_find_stale`;
textless pages: "No text on 2 pages · Recognize text…"; locked: banner. **5 · Copy.** Existing
`redaction_find_*`; primary "Mark {n}" / "{n} tanesini işaretle"; toast "Marked 7 · Apply…" /
"7 tanesi işaretlendi · Uygula…". Icon custom *redact*. **6 · Behaviour.** Guard `targeted`
(marks are reversible, F§3.3). J / K step through results. Mark adds marks (one undo step), closes,
and the pending-marks bar shows "7 marks · Apply". **7 · Motion.** S0. **8 · Accessibility.**
Results `listbox` with multi-select; count polite. **9 · Implementation.**
`redaction/SensitiveSheet.tsx` using `patterns.ts`, `text-index.ts`. Tests: existing
`patterns.test.ts`; e2e marks appear in the pending bar.

## 22. S21 Batch and recipes

**1 · Role.** Run one recipe over many files on the device. Library → Batch…, Library ⋯, ⌘K.
Replaces 12.24.

**2 · Anatomy.** Task sheet in three pages: **Recipe** (saved recipes as rows with step counts, New
recipe…, Edit ›) → **Files** (Add files…, drop zone on fine pointers, list with sizes) → **Run**
(plan, Output ZIP · Folder, Run on n files). The recipe editor is a pushed page (`RecipeEditor`,
`StepForm`). Presentation: compact bottom sheet 92 %; medium form 640; expanded and up **centred
720** with Recipe and Files side by side (Issue 5).

**3 · Material.** M5; over the Library the aurora is frozen while it is open (L§3.5).

**4 · States.** No recipe: "Make a recipe to start · New recipe…"; running: the sheet stays open
with a determinate bar and Cancel (`batch_running_note`), closing moves it to the toast capsule;
summary on the result page (`batch_run_summary`) with per-file rows; OCR step downloading
languages: its progress line.

**5 · Copy.** Existing `batch_*`. New page titles "Recipe · Files · Run" / "Tarif · Dosyalar ·
Çalıştır". Icon `stack`. **6 · Behaviour.** Guard: none (files are not open documents). Focus: first
recipe; back with ‹ or Alt+Left. **7 · Motion.** *sheet push* between pages. **8 ·
Accessibility.** Page changes announce the new page title; progress `role="progressbar"`. **9 ·
Implementation.** `batch/BatchSheet.tsx` from `BatchDialog.tsx`; `RecipeEditor.tsx`, `StepForm.tsx`
kept inside. Tests: existing `BatchDialog.test.tsx` migrated; e2e run on two fixtures at phone and
desktop.

## 23. S22 Shortcuts overlay

**1 · Role.** Show every key (F§7.2) for people who use the keyboard. `?`, More → Keyboard
shortcuts, Settings → Keyboard shortcuts. Replaces 13.2.

**2 · Anatomy.** Centred 760 (max 100vw − 64), max-height 100dvh − 96; search field; groups in two
columns from 1000 px (Places · Tools · On a selection · Pages · Files · View · Commands · History),
rows "Highlighter … H" with keycaps (`Keycaps`, 18 px, `case`); footer note "Shortcuts never fire
while you type in a field". Compact: offered only after a physical key press (L§6.2); then a full
sheet.

**3 · Material.** M5 σ 48; keycaps solid n5. **4 · States.** Search empty result; platform keys
(⌘ on Apple, Ctrl elsewhere). **5 · Copy.** Group names: Places · Tools · On a selection · Pages ·
Files · View · Commands · History / Yerler · Araçlar · Seçili metinde · Sayfalar · Dosyalar ·
Görünüm · Komutlar · Geçmiş; title "Keyboard shortcuts" / "Klavye kısayolları". Icon `keyboard`.
**6 · Behaviour.** `?` toggles; typing filters; Esc closes. Guard: none. **7 · Motion.** *dialog*
centre. **8 · Accessibility.** Table semantics per group (`th` action, `td` keys); keys from the
registry's `aria-keyshortcuts`. **9 · Implementation.** `shell/ShortcutsOverlay.tsx` (renamed),
data from `commands/registry.ts`. Tests: unit every registered shortcut appears; axe.

## 24. Size of the change

| Family 12 today | M9 |
|---|---|
| 27 dialogs, 1 shell, 0 phone layouts | 18 sheets, 3 confirmation forms and the overlay on 1 shell, every one with a compact form |
| 5 result layouts | 1 result page |
| 4 separate output dialogs (export, compress, images, Markdown) | 1 Save a copy |
| Settings in 4 places | 1 Settings sheet |

## 25. Removed, and where their function went

| Today | Where it went |
|---|---|
| 12.14 Merge into… | Pages grid "All open": drag pages to another section or tab, Move to ▾, Mod+X / Mod+V (F§7.2) |
| 12.20 Compress · 12.21 Export as images · 12.22 Markdown | S2 sections; the menu items open S2 preset |
| 12.5 Strip metadata | S4 "Remove when saving"; S2 Metadata |
| 12.4 Remove password | S5 footer |
| 12.26 Go to page | Page pill (01-frame F11); Mod+G opens it |
| 12.27 About dialog | S3 → About Recto; the About page (F§2.1) |
| 15.1.1 Appearance submenu · 15.1.3 language commands | S3 (commands remain in ⌘K and set the same values) |
| `CropDrawBanner` | S12 Draw crop area on the page |
| Compress "Apply to export" / "Download copy" split | S2 Size presets |

## 26. Family implementation and test plan

1. **D0 (F§12 drop order):** `ui/sheet` with the five presentations, `sheet-store`, Confirm,
   result page; port S6 and S22 first (smallest), then S2 and S3.
2. **D1:** S4, S5, S8–S12, S19, S20 with their `canChange` acts and lock banners; the
   registry test that fails when a committing command lacks an act covers every sheet primary.
3. **D2:** S13–S18 and S21 with the Pages grid.
4. Tests listed per component; family-wide: e2e `sheets.spec.ts` (presentation per class, swipe,
   keyboard above fields on WebKit), `jobs.spec.ts` rows J8B, J11, J13B, J16 at the M9 counts,
   `glass-pixels.spec.ts` M5 σ 24 and 48, `a11y.spec.ts` matrix, `motion.spec.ts` sweep with a
   sheet open.

## 27. Issues for the lead

1. **σ 24 for short M5 surfaces.** L§2.2 gives M5 σ 48; a 400 × 168 confirmation at σ 48 has c =
   0.920 and fails A-2. This spec adds an M5 σ 24 step for dialogs and modal sheets under 260 px
   tall (c 0.9995) and a coverage registry entry.
2. **Input boundary below 3:1.** `--border-strong` (dark white 0.16) gives about 1.6:1 around input
   wells on M5. Proposed `--border-input`: dark white 0.40 (3.32:1 against `#34363b`), light ink 0.50
   (3.24:1 against `#e8e8ea`). **Resolved (spec X7):** one token, `--control-border` (dark white
   0.48, light ink 0.55); `--border-input` is not created.
3. **No catalogue entry for in-sheet navigation.** Proposed *sheet push*: `translateX(24px)` +
   opacity on `--spring-smooth`, back reversed; reduced motion 150 ms fade. Used by Settings, Batch,
   result pages.
4. **F6 order lacks side sheets.** F§7.2's region list has no sheet. Proposed: top strip → sidebar →
   page → **tool sheet** → facts chip → …; modal sheets trap focus instead.
5. **Presentations that differ from F§6.9.** New signature is a centred 520 sheet on fine pointers
   (the pad needs width); Batch is a centred 720 sheet from expanded up (two panes; it runs from the
   Library, where no page must stay visible). F§6.9 says side sheet 400 for task sheets.
6. **Share copy needs the press.** Web Share with files needs transient activation, which an async
   assembly loses. This spec pre-assembles 600 ms after the settings settle; if the copy is not ready
   the press shows progress and a second press shares. J13B touch stays 5 only when the copy is ready.
7. **Picker first leaves an empty file on failure.** Chromium creates the picked file; on a failed
   verification the writable is aborted and `remove()` is called where it exists, else the toast says
   the empty file can be deleted (judgement on wording).
8. **Settings beyond F§9.5.** Added: a search field, Name on comments (15.1.4 had no home), Show tips
   and facts again (02-library keys facts per file), Saved signatures as a pushed page, Follow the
   browser as a language choice.
9. **Ownership.** This family owns Find sensitive data (S20), Extract pages (S16), Combine with open
   documents (S15) and the Revert and Clear confirmations; no other spec defines them.
10. **Unapplied redaction marks.** F§5.4 has Save ask "2 marks not applied · Apply first?". This spec
    keeps today's block in Save a copy (primary dimmed with Apply first…) because a copy with live
    marks leaks the text under them; Save (01-frame) keeps the question. **Changed (spec 07.10):**
    one ask for both, Apply and save by default, "Save without applying" with an honesty line.
11. **Tool sheets re-fit the page.** Not in `flows.md`: while a tool sheet is open, Fit width or Fit
    page re-fits to the free rectangle, and the earlier zoom returns on close, so the preview is never
    under the sheet.
12. **Opening a sheet disarms the armed tool,** so the sheet's primary is the view's one lime.
13. **Interleave consumes both inputs** (`pages.ts`), against INV-R6's "one outcome: a new document".
    Kept for duplex scans, with Undo; Combine (S15) keeps its sources. Decide whether Interleave
    should keep them too. **Changed (spec 07.13):** Interleave keeps its sources and makes a new
    document; its guard is none (X32).
14. **Destructive primaries** (Apply redactions, Clear, Remove, Crop and remove) are secondary
    capsules with a danger label and glyph, never lime and never a red fill.
15. **Guards that differ by sheet:** Password (S5) asks `document` and is blocked while locked, while
    Save a copy's Security section is output-only and allowed; certificate signing asks nothing.
16. **Enter submits from single-line fields, radios and segments.** `flows.md` avoids only Mod+Enter.
    J16 keyboard becomes ≈5 (Enter applies from Format) against F§8.1's ≈6.
17. **Phosphor names not in L§5.2** used here: `gear-six`, `translate`, `hard-drives`, `password`,
    `lock-key`, `list-numbers`, `square-half-bottom`, `barcode`, `drop-half`, `scissors`, `shuffle`,
    `arrows-out`, `stack`, `file-plus`, `file-arrow-up`, `certificate`, `wrench`, `eye`, `x-circle`,
    `check-circle`, `caret-right`. Add them to `tools/icons/manifest.json`; the generator fails on an
    unknown name.
18. **Title sizes.** Sheets use title3, centred dialogs title2 (L§4.2 "Panel and sheet titles",
    "Dialog titles").

## 28. Open questions

1. **Size names.** "Smaller · Smallest" (this spec) or today's "E-book · Screen · Print"? Plain words
   suit J13B; test with the five people.
2. **Settings as one scroll on desktop.** Resolved by R15 (2026-10-10): a centred 600 px form sheet with
   one grouped scroll and four pushed pages, from medium up.
3. **Save a copy memory.** Drafts last the session per document. Should the last choice (for example
   Smaller) also be the default for the next document?
4. **Batch on phones.** Is Batch worth offering under 600 px, or only from medium up?
