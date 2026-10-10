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

- **Bundle budget: resolved.** The merge put the editor's initial JS at 918 KB (gate 900) and
  compact at 322 KB (gate 320). Plain lazy loading fragmented the shared chunks; the fix was a
  chunking policy in `vite.config.ts` (React, the i18n runtime and the motion core in stable
  chunks), lazy ink shapes, grid motion and library morph, and loading only the palette's 67
  keyword messages after first paint (the whole message catalog had been in the first load,
  about 90 KB). Now: editor 818.0 KB, compact 318.9 KB, first paint 119.1 KB; baseline
  re-recorded.
- **WebKit fonts check (open).** CI on 0c15e3f is green except one test on WebKit:
  `e2e/fonts.spec.ts` "preloaded once" sees the UI face's Latin file reach the network twice
  (3 of 3 attempts). No font, preload or `fonts.css` code changed in R14; the change is timing
  (the first load is about 100 KB smaller and split differently), which suggests WebKit now
  requests the face from CSS before the preload's response is in its memory cache. WebKit is
  not installed locally, so this needs the CI trace (artifact `playwright-report-webkit-1`) or a
  diagnostic run before a fix. No deploy until it is green.
- The full Chromium e2e run was not repeated in one go after the container restart. Firefox
  and WebKit were left to CI.
- Smaller items are listed in each lane's record ("Left").
