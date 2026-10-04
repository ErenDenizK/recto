---
title: Engine track beside the M9 redesign
date: 2026-10-04
status: plan
---

# Engine track beside the M9 redesign

Two lines of work run on `develop` at the same time:

- **UI track (lead session):** the M9 experience redesign. It covers glass, motion, the light
  theme, the brand and the tablet and phone layouts (`docs/design/redesign-2026-10/`, research
  15–22).
- **Engine track (this plan):** correctness, security, rendering and performance under the
  UI. It changes no pixels a designer chose and no component structure.

This page says who owns what, how the two lines meet, and what the engine track does next.

## 1. Ownership

| Area | Owner | Files |
|---|---|---|
| Components, layout, CSS, tokens, copy, icons, motion | UI | `apps/web/src/**/*.tsx`, `**/*.module.css`, `apps/web/src/styles/`, `apps/web/messages/`, `docs/DESIGN.md` |
| Engines, workers, adapters, writers, verifiers | Engine | `packages/engine/`, `packages/document-model/` |
| Non-visual app logic | Engine | `apps/web/src/engine/`, `*-model.ts`, `*-store.ts` internals, `export/`, `batch/` runner and steps, `privacy/` |
| Tests of the above | Same as the code | `*.test.ts` beside the file; `*.test.tsx` only by appending a case |
| Roadmap, decisions, owner log | Lead | `docs/ROADMAP.md`, `docs/DISCUSSION.md`, ADRs |

Rules for the engine track:

1. Never edit a `.tsx` or `.css` file except to append a test case to an existing `.test.tsx`.
   When a fix needs a component change, write it up in §4 and leave it to the UI track.
2. Public shapes stay compatible. Store actions, `EngineService` methods, model operations and
   exported types only gain optional fields or new functions. A rename or a removal goes
   through the lead first.
3. User-visible strings are UI. A new error or notice message gets a key proposal in §4,
   not an edit in `messages/*.json`.
4. One fix per commit, with a regression test that fails without it. Run the package's tests,
   lint and typecheck before pushing.

## 2. How the lines meet

- The engine branch is rebuilt on the latest `develop` before each merge. Before starting
  work, check the dates with `git fetch && git for-each-ref --sort=-committerdate refs/remotes`.
- Engine changes reach `develop` as small pull requests that the lead merges between UI
  waves. They are never mixed into a UI commit.
- When both lines need the same file (for example `engine-service.ts` for a phone memory
  budget that a layout needs), the engine track lands the logic first behind an optional
  parameter with its default unchanged. The UI track then passes the new value from its
  component.
- A finding in the other line's area is reported, not fixed: as a line in §4 here, or a note
  for the lead.

## 3. Done on `claude/trusting-keller-g7gwp9` (2026-10-04)

| Commit | What |
|---|---|
| `dc6bb44` | Paragraph editor: typing after deleting the whole paragraph drew every letter on the first letter's spot. The typed text took the style id `''`, which has no advances. The state now remembers the style an empty paragraph types in (the deleted text's style). |
| `9319a1d` | Test: an image watermark in the document furniture survives garbage collection and exports on every page. |
| `192d165` | Markdown export writes only `http`, `https` and `mailto` links. `javascript:`, `data:` and `file:` links from a crafted PDF become plain text. |
| `c8b0fe0` | Recipe images that declare more than 4096 × 4096 pixels are refused (a 1 MB decompression bomb could exhaust the assembler worker on every batch run). |
| `473292d` | A clipped repaint patches the scales used last (cache hits count), so the bitmap on screen is patched instead of dropped and rendered whole. |

## 4. Engine backlog, in order

Each item is engine-only unless it says otherwise.

1. **Undo of a content edit re-renders everything.** `reopenSource` drops every cached bitmap
   of the source and bumps every page's revision before the edit runner replays the remaining
   edits. Pages with no edits re-render for nothing, and edited pages can briefly show without
   their annotations. Move the cache drop and the revision bump after the replay, for the
   touched pages only. Files: `apps/web/src/engine/engine-service.ts` and
   `apps/web/src/annotations/edit-runner.ts`. Add the first `reopenSource` tests.
2. **Renders during a reopen fail as errors.** Cancel the source's queued jobs before the
   awaits in `reopenSource`, not in its `finally`. This removes an error flash in
   `PageCanvas` with no change to that component.
3. **Bookkeeping that never shrinks.** The `rendered` map, `generations` and the `painted`
   ledger in `viewer/read-controller.ts` should drop entries on LRU eviction and on close. This
   matters for long sessions on 1,000-page files.
4. **Device-aware memory (prepares M10).** The bitmap cache budget is a fixed 150 MB, and the
   bitmap cap is 4096². Phones at device scale 3 can be killed by the operating system
   earlier. Derive the budget from `navigator.deviceMemory` (where it exists) and the screen,
   through the existing optional `cacheBudgetBytes`. The UI track only decides when the phone
   layout ships. The default stays as it is.
5. **Worker privacy.** The CSP is a `<meta>` tag, and workers do not inherit it. The privacy
   indicator only watches the main thread. Report each worker's Resource Timing entries to the
   main thread so the indicator counts them, and test that no worker makes an external
   request. A real CSP header for workers needs a host that sends headers, which GitHub Pages
   does not; that is for the lead to decide.
6. **Outline cycles.** Check whether PDFium stops on a `/Next` loop in the outline. If not,
   guard the bookmark read in the PDFium adapter with a depth and visit limit. Start with a
   fixture that has a self-referencing outline.
7. **Proxy and rasterize hygiene.** Skip posting a render the caller aborted before the
   worker was ready (`pdfium-proxy.ts`). Close the remaining tile bitmaps when
   `encodeRasterPage` throws.
8. **Flaky timing tests.** `TextEditor.test.tsx` "analyses once on open…" fails on a loaded
   machine on `develop` too. Count the pauses the machine actually made, as the paragraph
   editor tests now do.
9. **Paragraph editor, engine side of what M8 left open.** Join and Split of paragraphs, and
   Word and LibreOffice exports in the corpus goldens. The UI for Join and Split belongs to the
   UI track; the engine track provides the model operations and the writer first.
10. **Input latency (P14).** `pointerrawupdate` and the Ink API for the pen are input
    plumbing in the stroke model, not its look. Measure before and after with the existing
    latency harness.

Proposals for the UI track (found while working, not done here):

- The ZIP name for exported images strips fewer characters than other output names
  (`tools/rasterize.ts`). Use `safeFileStem`.
- A recipe file is read with no size limit before parsing (`BatchDialog.tsx`). Check the size
  first.

## 5. What the redesign needs from the engine

| Redesign item | Engine part | When |
|---|---|---|
| Tablet and phone layouts (M10) | Item 4 (memory budget); exact-scale renders at device scale 2–3 stay under the bitmap cap through tiles, which already exist | Before the phone layout ships |
| Light theme | None: page bitmaps are the file's own colours. The canvas behind the pages is CSS. | — |
| Glass and motion | None. Fewer re-renders (items 1–3) keep animations smooth while scrolling and undoing. | Any time |
| Touch input | Items 9–10 for the pen. Gestures themselves are UI. | With the pen work |
