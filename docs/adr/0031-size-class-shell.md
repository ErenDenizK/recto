---
title: "ADR-0031: The size-class shell: top strip, dock, sidebar, sheets, page pill, Library"
date: 2026-10-04
status: proposed
---

# ADR-0031: The size-class shell: top strip, dock, sidebar, sheets, page pill, Library

**Status:** proposed · **Date:** 2026-10-04 · **Deciders:** project lead; the owner accepts ·
**Supersedes on acceptance:** DESIGN §2's layout diagram and its bullets "Home is the first
view…", "Home's chrome is Home's own", "Navigator", "Inspector", "Floating tool bar", "Document
menu", "Status bar" and "The stage runs under the docked chrome" (replaced by the free
rectangle) · **Amends:** ADR-0019 §1 (Home becomes the Library place; `0` and the app glyph stay)
· **Rests on:** `flows.md` §2.1–§2.3, §4.2, §4.6, §6, §9, §10, §13.1, §14 items 3 and 7, §15 Q3;
`language.md` §2.9, §2.10, §6.2, §11.3 items 1, 2 and 4; research 19 M-1 to M-15, M-22, M-29,
M-31, M-35, M-38; 15 RA-9, RA-12, RA-15, RA-18 to RA-20; 20 X-6; 22 A-12, A-15, A-20;
`current-flows.md` F-2, F-14, F-15, FL-R6, FL-R7, FL-R10; `inventory.md` INV-1, INV-13, INV-14,
INV-20, INV-21, INV-24

## 0. Summary

- Five width classes and compact-height move surfaces, never meanings.
- A slim top strip (a top bar on phones) with tabs and the title menu; a labelled floating dock
  that morphs into the Markup palette; one sidebar; one sheet primitive; a persistent page pill.
- The status bar, the inspector, the navigator rail and the mode switch go.
- Compare is a full-screen place, not a tab.
- The Library is the welcome: a launcher, a teaching sample (`?sample`) and a facts chip.

## 1. Context

There is no phone or tablet layout today (F-2, INV-1): on a 390 px phone the navigator takes
312 px, the page sits at 25 %, and 26 of 34 targets are under 44 px (research 22 §9). Reading at
1440 × 900 shows 29 controls (research 15 §1). Results and the safety net hide in the closed
inspector (F-15); the status bar is outside F6 (INV-14); options and facts repeat (INV-13). The
first visit says "Drop PDFs to start" on every device, with no sample (F-14, INV-20).

Research 19 proposes one model with surfaces placed per class (M-1, M-12). The owner judge
found Proposal A's reading screen "has no floating glass and no light on desktop" and preferred
C's top strip, dock and Library. `language.md` §2.10 needs one layout rule from the shell: at
rest, no glass sits over page content (RA-15).

## 2. Decision

1. **Classes** (`flows.md` §6.1, M-1), in CSS px so 400 % zoom reaches compact (A-20): compact
   < 600; compact-height (height < 480 and width < 1000, a phone on its side); medium 600–839;
   expanded 840–1199; large 1200–1599; xlarge ≥ 1600. `useSizeClass()` with `data-size` and
   `data-short` on `:root`; container queries inside panels. Density follows the pointer, not the
   width: 44 px targets on coarse pointers in every class (M-2, A-15).
2. **Top.** Compact: a 44 px top bar plus the safe area, with ‹ N (to the Library), title ▾, ⓘ,
   ↶ ↷, ⌕. From medium: a top strip (44 fine, 52 coarse) with ◆, ▤, tabs, +, Find (an icon below
   1280 px), ↶ ↷, Save (a dimmed "Saved" when nothing is new, so nothing reflows) and ◎; no ⋯. The
   active tab's title is the static document menu (RA-9, RA-21): header with thumbnail, name,
   facts, the Lock switch and the privacy line; then File, Pages, Add to pages, Protect, Convert.
   Tabs and Library cards are one order, `documentOrder`, reordered by drag (INV-19).
3. **Dock** (`flows.md` §4.2): viewing only, one M2 capsule at the bottom centre of the free
   rectangle, 16 px up; 48 px fine, 56 coarse, 64 on phones with labels under icons, 44 with
   labels beside on compact-height. Always labelled (RA-20): **Pages · Markup · Fill & sign ·
   More**; on phones **Pages · Markup · Sign · More** with the page pill as its trailing segment.
   The same element morphs into the Markup palette, the Pages bar, the Compare bar and the Locked
   state (ADR-0026 *bar morph*). From medium up it is always shown (owner question 3).
4. **Page pill:** M1, persistent, focusable, in the F6 cycle; "3 / 12 · 96 %". It opens Go to
   page, up to 8 outline entries, fit and zoom, Continuous · Single · Two-up, Show field outlines
   and Focus; Mod+G. It replaces the status bar's page and zoom and the layout switch.
5. **Sidebar:** one, with Pages/Outline · Find · Review. Closed by default everywhere,
   remembered per device once changed. Inside the Pages sheet on compact, a 360 px side sheet on
   compact-height, a 320 px overlay on medium (solid on touch, M-31), docked 280 px from
   expanded. The rail, its Files tab (the Library lists files) and Changes (into Compare) go.
6. **Removed:** the inspector (History → the scrubber, ADR-0032; Properties → each bar's ⋯; Info
   → the Document info sheet; Signatures → title menu and facts chip; OCR → its sheet and a Review
   filter), the status bar, the rail, the Read · Edit · Arrange switch, the layout switch, the
   Document and Export buttons. Reading at 1440 × 900 shows 14 controls against 29.
7. **Sheets:** one `ui/Sheet` primitive. Compact: bottom sheets at 40 % and 92 % (Base UI Drawer,
   M-29). Medium: tool sheets as 360 px side sheets with no scrim, task sheets as form sheets ≤
   640 px. Expanded and up: 400 px side sheets, Settings 480 px, confirmations centred (modal
   sheets on compact). Tool sheets keep the page live with a preview.
8. **The free rectangle** (`flows.md` §6.2, `language.md` §2.10): fit, the first line at fit
   width, go to page, find hits, outline jumps, links, undo reveals and keyboard focus land in the
   rectangle the top strip and the dock band leave free (`scroll-padding`, A-12). The last page
   scrolls clear of the dock; an open palette or pending-marks bar adds its height. At an
   arbitrary scroll stop a line may sit under the dock, about 2.2 % of a 1440 × 900 stage
   (judgement); F hides the dock and pill (RA-12).
9. **Hide on scroll,** compact and compact-height only, in viewing only (M-14 narrowed; the rules
   of ADR-0028 §2 item 5). Nothing hides from medium up.
10. **Compare is a place:** `destination: 'compare'` beside `'home'` and `'document'`, never a
    tab, because tabs derive from `workspace.documentOrder` and a comparison is a UI session. Its
    own top bar (Close, view switch, Report…) and bottom change bar; A · B · Changes on compact
    (M-38); Changes docked from large. More offers "Return to comparison" while one lives.
11. **Library and first run** (`flows.md` §9, §14 item 7). The Library (code `home`) empty is the
    welcome (RA-19, X-6): "Read, mark up, sign and arrange PDFs. Nothing leaves this device.";
    **Open PDFs…** (the view's one lime element, first focus), Try the sample, Combine files…;
    "or drop files anywhere" on fine pointers only; EN · TR visible; the privacy line; the aurora
    of ADR-0025. With documents: cards with facts, Recents with snapshots (ADR-0032), a selection
    bar (N selected · Combine · Compare · Pages · Close), Batch.
12. **Teaching sample:** a bundled four-page PDF, English and Turkish, built by `tools/fixtures`,
    ≤ 250 KB (judgement), precached. Its text teaches (select and Highlight; M for Markup; a form
    to fill and sign; a scan for Recognize text; 3 for the grid); no overlay tour. Each Try the
    sample opens a fresh "Recto sample.pdf" that follows the lock setting. `?sample` (`?sample=tr`)
    opens it after launch for the About page's demo link; `history.replaceState` removes it.
13. **Facts chip:** one fact per file, by priority: signed > no text (Recognize) > form fields
    (Fill & sign) > restored edits > outline. M1, top leading corner of the free rectangle, 600 ms
    after opening, for 8 s or until used; then it folds into the ⓘ by the title. Once per file per
    device, keyed by size and a hash of the first 64 KB (judgement). **Settings** is one sheet
    (`flows.md` §9.5, INV-20).

## 3. Consequences

- Code (`flows.md` §10): `TabBar.tsx` → `TopStrip`; `Stage.tsx` loses `ModeSwitch`; `StatusBar.tsx`
  and `viewer/LayoutSwitch.tsx` go; new `Dock`, `PagePill`, compact top bar, `ui/Sheet`,
  `ui/Toast`; `LeftRail.tsx` → `Sidebar.tsx`; `RightPanel.tsx` is deleted and its sections move.
- Glass budget (`language.md` §2.9): compact shows two persistent surfaces (top bar, dock with the
  pill inside), medium three (strip, dock, pill); the compact-height bars take 88 of 390 px (23 %).
- Every job of `current-flows.md` §20 gets a touch path; J2 and J4 lose the step that collapsed
  the navigator on phones; J11 costs 2 while the facts chip shows.
- e2e gains a project per class at `flows.md` §6's six frames, plus 320 × 256 for A-20.

## 4. Alternatives considered

- **Today's docked desktop frame plus a separate phone shell (research 19 M-6, M-9):** two models
  to learn and test; M-12's placement matrix keeps one.
- **Proposal A's reading screen (no floating glass on desktop):** the owner judge's objection;
  the dock gives glass at rest while the free rectangle keeps jumps clear.
- **Hiding the dock on desktop when idle, or A's fading pill:** breaks A-12. **Proposal C's
  scrolling phone bar:** hides tools off screen; two fixed sets plus + count every depth.
- **Compare as a tab (Proposal A):** tabs derive from the document model; a comparison is not one.
- **The inspector as an overlay side sheet (M-10, M-11):** keeps the repetition of INV-13; each
  item has a better home.
- **Sidebar open by default:** 312 of 390 px on phones. **Hide on scroll on medium (M-14):**
  medium fits three persistent surfaces in its budget, and every hide is an A-12 risk.
- **An onboarding tour or coach marks:** they cover the page; a document that teaches does not.

## 5. Issues for the lead

1. **Sizes `flows.md` leaves open,** taken from `language.md` §11.3: the compact-height dock stays
   44 px (σ 8), its hit areas taking the full capsule height to reach 44 px; contextual bars are
   36 px on fine pointers (σ 7); the page pill and the facts chip are 36 px fine and 44 px coarse.
2. **The dock's taste check** (`flows.md` §15 Q3) is open; this ADR builds "always shown from
   medium up", the recommended answer, and never an auto-hiding dock above compact.
3. **Facts-seen record.** `flows.md` §9.3 needs storage it does not name. This ADR decides: an
   IndexedDB store `pdf-editor:facts-seen:v1` of size-and-hash keys, cleared with the kept
   documents in Settings.
