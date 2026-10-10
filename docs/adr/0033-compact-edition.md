---
title: "ADR-0033: Two editions: the full app on desktops and tablets, a read-only compact edition on phones"
date: 2026-10-04
status: accepted
---

# ADR-0033: Two editions: the full app on desktops and tablets, a read-only compact edition on phones

**Status:** accepted · **Date:** 2026-10-04 · **Deciders:** the owner (review of the M9 plan
and the concept prototype, 2026-10-04); project lead · **Amends:** ADR-0031 §2 items 1–3, 5, 7
and 9 (their phone rules move to M10), ADR-0029 (no Markup, Lock or targeted acts on phones) ·
**Rests on:** the owner's review of 2026-10-04 (in translation below); research 19 M-1, M-12,
M-14; research 22 A-15, A-20; `docs/design/redesign-2026-10/quality-bar.md` Q-11

## 0. Summary

- Edition is chosen once per launch by device, not by window width. **Phones** get the
  **compact edition**: a read-only PDF reader with a simple, collapsible bottom bar. **Everything
  else** gets the **full edition** at every window size.
- M9 builds and polishes the full edition for widescreen desktops and tablets. The compact
  edition ships early (D0-14), small and finished. Its real design, done with the owner, is M10.
- The full edition keeps its narrow-window layouts so a desktop at 400 % zoom (A-20) keeps every
  function. Those layouts aim for parity, not phone polish.

## 1. Context

The owner reviewed the plan and the concept prototype on 2026-10-04 and accepted every
recommendation, with one change of scope (in translation):

> For now, on phones, keep it a read-only PDF opener and hide the features. The bottom bar
> should probably open and close, built more simply: an interface entirely different from the
> computer and wide screens. Maybe we should learn from apps like Procreate. Features may be
> missing if need be, but on phones what is there must work fully and as intended. The phone
> interface needs fine tuning; we will plan and build it ourselves at the end. First let us get
> a version that works properly on widescreen computers and tablet screens. So: phone equals a
> compact edition, only the basic features, a radically simplified UI, worked on after the
> widescreen side is done.

The M9 plan put phones into the same model as desktops: one model, with surfaces placed per
size class (ADR-0031, research 19 M-12). The owner's view is that a phone deserves a different
interface, not a reflowed desktop one. The phone rules in ADR-0031 cost much and were judged
least certain: dock labels under icons, the compact Draw and Sign sets, the phone Pages sheet,
hide on scroll and bottom-sheet detents. The prototype's phone frames had the most visible
defects (`quality-bar.md` §1).

Width alone cannot pick the edition. If it did, a desktop zoomed to 400 % (320 CSS px wide,
A-20, WCAG 1.4.10) would lose editing. That would fail reflow, which requires the same function
without two-dimensional scrolling.

## 2. Decision

1. **Edition by device.** `edition = 'compact'` when the primary pointer is coarse **and** the
   screen's shorter side is under 600 CSS px:

   ```
   matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600
   ```

   Otherwise `edition = 'full'`.
   - It is read once at launch. Rotation, window resizing and browser zoom never switch the
     edition.
   - `?edition=compact|full` overrides it, for tests and for support, and is kept for the session
     only.
   - `data-edition` is set on `:root`.
   - Results: phones in either orientation are compact. iPad mini (744) and up, 600 px Android
     tablets, touch laptops and every desktop window are full.
2. **Full edition.** It is everything ADR-0029 to ADR-0032 describe. M9's design, tests and
   polish target the **expanded, large and xlarge** classes (840 px and up) and the **tablet**
   (`medium` and up with a coarse pointer).
   - The compact and compact-height classes stay inside the full edition for narrow windows and
     400 % zoom. They keep every function reachable (A-20, A-12) and use the specified layouts.
   - They are tested at 320 × 256 and 390 × 844 with a **fine** pointer. Touch-phone polish for
     them is not an M9 goal.
3. **Compact edition (M9, interim, D0-14).** A read-only reader, built as its own small shell
   (`shell/compact/`). It reuses the viewer, engine and stores and never mounts the full shell.
   - **Library:** **Open PDF** (the one lime element) and Recents.
   - **Reading:** continuous vertical pages at fit width; pinch zoom; double tap between fit and
     2×; links; text selection with Copy. Forms, annotations and signatures render but do not
     take input; a note shows its text on tap.
   - **Chrome.** Two pieces, both collapsible together. A tap on the page, or a scroll, hides or
     shows them; while hidden, a small page pill fades in for 1.5 s on scroll.
     - Top bar: back to the Library, the title, and ⋯ with Find, Contents (when the file has
       one), Go to page, Share or Download a copy, Document info and About.
     - Bottom bar, one floating capsule: Pages, "3 / 12", Find.
   - **Pages** is a sheet of thumbnails to jump.
   - **Find** replaces the top bar with a field, the hit count and ‹ ›.
   - **Hidden:** Markup, the dock, tabs (one document at a time; the Library lists the rest),
     page operations, Save in place, Compare, conversions and every editing sheet.
   - **Snapshots (ADR-0032).** Kept documents still restore. A document with changes made in the
     full edition on the same device opens with them and offers Download a copy, so nothing is
     lost or hidden.
4. **What "works fully" means here.** The compact edition is held to the same quality bar as
   the full one (`quality-bar.md`): no texture that renders wrong, one control system, transforms only in its
   animations, and 44 px targets. Its own e2e projects are `phone` (390 × 844) and `phone-land`
   (844 × 390), with a touch emulator and `?edition` unset.
5. **M10, the phone edition, comes after M9's widescreen work.** It is planned with the owner
   and starts from the compact edition. Candidates include marking up with a finger or pen, a
   Procreate-style edge control for size and opacity, the dock's phone form, the Pages grid on a
   phone and the phone sheets of `07-sheets`. ADR-0031's phone rules are input to M10, not
   decisions.

## 3. Consequences

- **Spec:** new D0-14 (the compact edition). The phone parts of D2-3 (compact sets and ladder),
  D2-4 (phone Pages sheet), D2-5 (phone grid count) and D2-6 (phone Compare) move to M10.
  `jobs.spec.ts` counts phones only for the reading jobs (J2, J15b).
- **Tests:** the `tablet` project (820 × 1180, touch) runs the full edition. The phone projects
  run the compact edition.
- **Two shells to keep in step:** the compact edition shares the viewer, stores, engine, i18n,
  tokens and primitives, so a fix there reaches both. Only the chrome is separate.
  `AppShell.test.tsx` gains an edition switch test.
- **Accessibility:** a 400 % zoom on a desktop keeps the full edition. A low-vision phone user
  gets a reader with large targets and system text scaling (A-14), and no editing until M10.
- **Honesty:** the Library on a phone says "Reading only on phones for now. Open this file on a
  computer or tablet to mark it up." (TR: "Telefonda şimdilik yalnızca okuma. İşaretlemek için
  dosyayı bir bilgisayarda ya da tablette açın."). It shows once, as an empty-state line, never
  a modal.

## 4. Alternatives considered

- **Edition by width (< 600 px):** breaks A-20 on desktops and flips the edition when a window
  is resized mid-edit.
- **Hiding tools in the full shell on phones (CSS only):** keeps the desktop chrome's weight and
  its phone defects. A separate small shell is less code than a full shell with phone
  exceptions.
- **No phone support until M10:** a phone visitor from the About page would meet a broken
  desktop layout. A reader that works is the honest minimum.
- **A "Desktop version" switch in the compact edition:** it brings the phone defects back
  through the side door. Revisit in M10.
