# Motion sprint R14 (2026-10-09/10)

The owner's brief: no new features; animations and choreography that make the app feel right.
Things come out of the control you pressed and go back into it (decisions MOT-3, MOT-5), and
hold-to-shape ink with fewer false triggers and more shapes (INK-9). Eight lanes ran in
parallel; each wrote its own record:

| Lane | Record | Headline |
|---|---|---|
| platform | [platform.md](platform.md) | container transform for popups and sheets, one press/hover spec, controls, tooltips |
| frame | [frame.md](frame.md) | palette, sidebar, page pill odometer, Save sweep and check, history-applied event, tab reorder, hide-markup cross-fade |
| viewer | [viewer.md](viewer.md) | eased jumps with landing ring and prefetch, zoom springs, bitmap fades, thumbnail ring, compare |
| pages | [pages.md](pages.md) | grid enter/exit cascade, drag lift and make-way, delete/insert, extract and Move to flights, rotate |
| library and capsule | [library-capsule.md](library-capsule.md) | card-to-page morph under the chrome, card add/close, drop halo, dock-origin morph, contextual bars |
| ink | [ink-shapes.md](ink-shapes.md) | hold to shape (recogniser, corpus, chip, real PDF shapes), Make shape, eraser fade, lasso ants |
| forms and compact | [forms-compact.md](forms-compact.md) | field ring, tick-in, signature flights, sheet disclosure, settings push, shake, compact release |

## Merge notes (lead)

- Merged in lane order, platform first. Conflicts: find (viewer owns the step scroll, frame
  keeps the hit pulse after the ring), the text selection bar (capsule lane's entrance kept,
  viewer's duplicate removed, copy pulse kept), and two `receivePulse` functions (the barrel's is
  the trigger's, `motion/receive.ts`; the chip's lives in `motion/feedback.ts`).
- The `recto:history-applied` event was renamed `pdf-editor:history-applied` (ADR-0015 §3).
- QA on the merged tree fixed eight e2e failures, three of them real regressions: the palette
  scrim's blur (MOT-7), a capsule stagger finishing past 500 ms (A-10), and find starting from
  the scrolled-to page instead of the target page.

## Open after the sprint

- **Bundle budget:** the editor's initial JS is 918 KB against the 900 KB gate (compact 320.7
  KB vs 320). Plain lazy loading fragmented the shared chunks; a chunking policy in
  `vite.config.ts` plus the lazy splits on `perf/r14-budget-lazy` is the fix in progress
  (PRC-11). CI stays red at the budget step, and no deploy goes out, until it is green.
- The full Chromium e2e run was not repeated in one go after the container restart. Firefox
  and WebKit were left to CI.
- Smaller items are listed in each lane's record ("Left").
