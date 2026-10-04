---
title: "ADR-0030: One change guard, canChange(id, act), with Lock enforced in commit()"
date: 2026-10-04
status: proposed
---

# ADR-0030: One change guard, `canChange(id, act)`, with Lock enforced in `commit()`

**Status:** proposed · **Date:** 2026-10-04 · **Deciders:** project lead; the owner accepts ·
**Supersedes on acceptance:** ADR-0019's consequence "a store-level guard (`canEdit(documentId)`)
backs the UI checks"; DESIGN §4.8 "Every mutation sits behind one store guard,
`canEdit(documentId)`, which fails closed"; the `canEdit`, `canEditActive` and `useCanEdit`
exports of `state/ui-store.ts` · **Keeps:** ADR-0019 §3's rule that Undo and Redo work while
locked · **Rests on:** `flows.md` §2.4–§2.6, §3.5, §12, §14 item 2; ADR-0029; ADR-0005; ADR-0011;
research 15 RA-3, RA-21; `current-flows.md` F-1, F-6; `inventory.md` INV-2, INV-3

## 0. Summary

- One question replaces "is the document in Edit": may this kind of change happen to this
  document now? `canChange(id, act)` answers it for six named acts.
- Lock is enforced in one place, `commit()`, which every mutation passes, so a missed check
  fails closed and is logged.
- Every committing command declares its act; a unit test fails when one does not.
- Engine edits ask before they run and replay their inverse when `commit()` refuses.
- Undo, Redo and History jumps stay allowed while locked.

## 1. Context

`canEdit(id)` in `state/ui-store.ts` returns `id != null && documentMode[id] === 'edit'`. It has
49 references in 14 files, 34 lines in 11 source files outside tests (`tool-store.ts`,
`FloatingToolbar.tsx`, `FloatingToolbar.stroke.ts`, `selection-markup.ts`,
`annotations/commands.ts`, `pen/highlighter.ts`, `redaction/review.ts`, `redaction/commands.ts`,
`forms/index.ts`, `forms/create/index.ts`, `ui-store.ts`). It cannot name the change, and each
site asks for itself, so a site that forgets fails open. Page operations, page furniture (page
numbers, watermark), OCR and crop never ask (build judge): with a thumbnail selected, Delete and
Shift+R change a document in Read (INV-3).

Every workspace mutation already passes one function, `commit(operation, label, coalesceKey,
coalesceWindowMs)` in `state/workspace-store.ts`: `applyOperation`, `applyComposed`,
`applyEngineEdit`, the page operations and `closeDocument` call it. Two other writers exist:
`replacePresent` (tab activation, no history entry) and `moveHistory` (undo, redo, `jumpTo`).
Content edits run in the PDFium worker before `applyEngineEdit` records them (ADR-0005,
ADR-0011), so a refusal at `commit()` alone would leave the worker changed.

ADR-0029 lets targeted acts change a document without a mode and adds Lock, so the guard must
know what kind of change is asked and whether the document is locked.

## 2. Decision

1. **API** (`state/guard.ts`, new):

   ```ts
   type Act = 'targeted' | 'freehand' | 'place' | 'text' | 'pages' | 'document';
   function canChange(id: DocumentId | null | undefined, act: Act): boolean;
   function useCanChange(id: DocumentId | null | undefined, act: Act): boolean;
   ```

   It returns false for an unknown document, an unknown act, and any act on a locked document. It
   reads `lock-store.ts` and the Markup flag of `ui-store.ts`, with no import cycle.
2. **Acts** (`flows.md` §2.5), allowed when the document is not locked:

   | Act | Covers | Allowed | Examples |
   |---|---|---|---|
   | `targeted` | A change aimed at an object the person chose | Always | Type in a field, toggle a box; Highlight, Comment, Underline, Strikeout or Redact a selection; restyle, move or delete a selected annotation |
   | `freehand` | The pointer itself creates | Only in Markup | Pens, Highlighter stroke, shapes, Eraser, lasso move, Redact drag |
   | `place` | An object at a point the person named | Always with a point from "Add … here" or keyboard placement; otherwise only in Markup | Add note, text, signature, image or stamp here; a placing tool's click in Markup; Add field (form creation; amended before acceptance to match `03-markup` §3) |
   | `text` | The paragraph editor commits | Always; its doors are input rules (ADR-0029) | Edit text, E then Enter, a double-click in Markup |
   | `pages` | Page structure | Always, on an explicit selection or the page pointed at | Move, rotate, delete, insert, duplicate, crop |
   | `document` | Whole-document operations | Always | Page numbers, Bates, watermark, OCR, Apply redactions, metadata, password, rename |

3. **Declared acts.** Every command that commits declares `act` in `commands/registry.ts`. A unit
   test walks the registry and fails on a committing command without one. Menus, bars and ⌘K use
   the same answers to dim what cannot run and say why ("Locked · Unlock", "Open Markup to draw"),
   so menus stay static (RA-21).
4. **Several documents.** A command that changes more than one document (moving pages to another
   document, a drop on a tab, Mod+X then Mod+V) asks for each document it changes. Reading a
   locked document as a source (Combine, Extract, Compare, Save a copy) is not a change.
5. **Enforcement in `commit()`** (`flows.md` §2.5 item 2). After computing the next workspace,
   `commit()` refuses it when a locked document changed: its `documents[id]` reference differs
   (structural sharing makes this a pointer check), or a new engine edit touches a source page
   that a locked document shows. A refusal returns false, opens the Lock popover at the control
   that asked, and in development logs the call site with a stack. `replacePresent` asserts the
   same in development; it may change only the active document.
6. **Engine edits.** The edit runner asks `canChange` before it posts the edit to the worker. If
   `commit()` still refuses, the runner replays the inverse it holds, so the worker returns to
   the recorded state. A test drives every act against a locked document and asserts that the
   bytes the engine saves are unchanged.
7. **History.** Undo, Redo and History jumps (`moveHistory`) bypass `commit()` and the guard, also
   while locked (ADR-0019 §3).
8. **Migration of the 34 lines:** a tool-arming site asks `freehand` (`tool-store` arms a tool
   other than Select only then, and opens Markup first); selection markup asks `targeted`; form
   filling `targeted`; form creation `place`; redaction from a selection `targeted`, an area
   `freehand`, Apply `document`. `canEdit`, `canEditActive` and `useCanEdit` are removed in the
   same drop (D1 of `flows.md` §12), so no site keeps the old question.

## 3. Consequences

- Page operations, furniture, OCR and crop become lockable for the first time, which a
  per-site guard could not promise.
- A forgotten check no longer fails open: the UI may offer an act, but `commit()` refuses it on a
  locked document and the development log names the site.
- The Lock popover becomes the one refusal surface; refusals never pass silently.
- Cost per commit is one pointer comparison per locked document, plus a source-page lookup for
  engine edits.
- Tests: the registry coverage test; a refusal test per act; the locked-bytes test per act; a
  test that Undo and Redo still move while locked.
- A later per-document history (`flows.md` §12) can reuse the acts as history labels.

## 4. Alternatives considered

- **Keep `canEdit` and add a lock flag beside it:** still one check per site, still blind to page
  operations, furniture and OCR.
- **Checks in the UI only (today):** a missed site fails open, against ADR-0019's "fails closed".
- **A check in `commit()` only:** gives no reason to dim a control with, and engine edits would
  already have run in the worker when it refuses.
- **Proposal B's hit model alone (an idle Pointer that cannot mark):** protects pointer input,
  not keys, menus or ⌘K; B itself kept a Lock.
- **One boolean "mutates" flag per command:** cannot tell a targeted act (always allowed) from a
  freehand one (Markup only).
- **Freezing locked documents at runtime (`Object.freeze`, proxies):** costs on every read and
  does nothing for engine edits in the worker.

## 5. Issues for the lead

1. **Closing a locked document.** `closeDocument` passes `commit()` and removes `documents[id]`,
   so the pointer check as written would refuse it. This ADR decides: `commit()` compares only
   documents present in both workspaces; removal is not a change to the document. Its lock stays
   in its snapshot (ADR-0032), and undoing the close restores it locked.
2. **Saved state must live outside the document.** `VirtualDocument.clean` (`markDocumentClean`,
   unused today) is part of `documents[id]`; marking a locked document saved would trip the
   check. This ADR decides: saved state is a per-document "saved at history entry" mark outside
   the model (ADR-0032); `markDocumentClean` is not used.
3. **Shared source pages.** Combine's copies keep the same source references
   (`mergeDocuments` with `keepSources`, `packages/document-model/src/pages.ts`), and engine edits
   are keyed by source and page index (`EngineEdit`). So after Combine, locking an input refuses
   annotations on the shared pages of the combined document. This ADR keeps `flows.md` §2.5's
   rule and says so: "This page is shared with locked report.pdf". Copy-on-write sources would
   remove the case; that is a model change for a later ADR.
4. **Rename** is not in `flows.md` §2.5. This ADR files it under `document`: dimmed when locked.
