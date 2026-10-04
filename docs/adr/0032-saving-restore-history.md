---
title: "ADR-0032: Saving, restore and history: Save in place, snapshots on the device, visible Undo"
date: 2026-10-04
status: proposed
---

# ADR-0032: Saving, restore and history: Save in place, snapshots on the device, visible Undo

**Status:** proposed · **Date:** 2026-10-04 · **Deciders:** project lead; the owner accepts ·
**Supersedes on acceptance:** DESIGN §2's "Export" button and the Document menu's export entries;
the inspector's History section; ADR-0019's consequence on Recents ("a small IndexedDB store of
names and, where the browser keeps them, file handles"), extended here with snapshots ·
**Amends:** ADR-0005 ("persisted with source bytes to IndexedDB/OPFS for crash recovery": now
specified, with a 20-step tail of the 200 kept in memory) · **Rests on:** `flows.md` §2.6, §4.4,
§4.6, §5.1–§5.4, §8.2 (J13A, J13B, J14), §9.4, §12, §14 item 4, §15 Q2; `language.md` §3.3, §8;
research 15 RA-5, RA-10, RA-11, RA-14; 19 M-17, M-34 to M-36; 17 AU-11, AU-12; 22 A-24;
`current-flows.md` F-4, F-5, F-12, FL-R3, FL-R4; `inventory.md` INV-4, INV-6, INV-7, INV-18

## 0. Summary

- Three kinds of kept: on this device (a snapshot within 2 s), in the file (Save), a copy (Save a
  copy… or Share). Nothing is uploaded.
- **Save** writes back in place where the browser allows, after one "Replace" question per file.
- **Save a copy…** is one sheet for every other output: PDF, images, Markdown, smaller, protected.
- **OPFS snapshots** restore the last session on launch, with the last 20 undo steps; Recents
  reopen closed documents from their snapshots on every browser.
- **Undo and Redo** are visible on every width; a long press opens a History scrubber; every
  removal and failure shows a toast.

## 1. Context

Work is lost silently today (F-4, INV-7): no session persistence, no `beforeunload` guard, no
unsaved marker, and Mod+W in a browser tab closes the app. The only save is the Export dialog:
3–4 steps through a 7-section form; compress then save is 8 steps (F-12). Undo has no visible
control; History sits in the closed inspector, three steps away on touch (F-5, INV-4); failures
and deletions are spoken only (INV-6). ADR-0005 promised persistence "to IndexedDB/OPFS for
crash recovery"; it was never built.

What exists: `export/deliver.ts` writes through `showSaveFilePicker` and `createWritable()` on
Chromium and downloads elsewhere; the assembler always writes a new file and verifies it by
re-parsing; only certificate signing writes an incremental section. `files/recents.ts` keeps up
to 12 entries in IndexedDB (`pdf-editor:recents:v1`): names, sizes, dates and, where the browser
gives one, a file handle; no bytes. History keeps 200 entries in memory (`DEFAULT_HISTORY_LIMIT`).
`SerializedWorkspaceV1` (`packages/document-model/src/serialize.ts`) already serialises a
workspace. Preview saves in place and restores the last state (research 15 §4, RA-10, RA-14).

## 2. Decision

1. **Save** (`flows.md` §5.1, RA-14, FL-R4). In the top strip (title menu on phones) and Mod+S.
   - *Chromium with a kept handle:* writes back and verifies, then "Saved · verified" with the
     success bloom (AU-12). The first save over a file asks once: "Replace report.pdf? · Replace ·
     Save a copy… · ☐ Don't ask again for this file". The browser's write prompt may follow once
     per session: a first save costs 3 presses, later ones 1.
   - *Chromium without a handle:* the picker, then the new handle is kept (2 presses).
   - *No File System Access* (Firefox, Safari, phones): a download, or the share sheet on iOS and
     Android (M-36); the toast says where the file went.
   - Save and Save a copy ask about unapplied redaction marks first, with one rule: "2 marks not
     applied" with **Apply and save** as the default and "Save without applying" as the secondary,
     with the honesty line "The text under 2 marks is still in the file" (spec 07.10, amended
     before acceptance); applied ones are named after ("Saved · 2 areas removed for good · verified"). Unlocking a signed file warns
     once that saving removes the signature; Save a copy with Signature signs again.
   - The button reads a dimmed "Saved" when nothing is new, so the strip never reflows.
2. **Revert to the opened version…** (title menu): the opened bytes stay in the snapshot after an
   in-place save until the snapshot expires.
3. **Save a copy…** (`flows.md` §5.1): one sheet. Format (PDF · Images · Markdown or text); Size
   presets with estimates inline (INV-18); Security, Metadata, Flatten and Signature collapsed
   under "Same as original". Its button opens the picker first, then assembles and verifies.
   Compress…, Export as images… and Export as Markdown… open it preset; Mod+Shift+S where the
   browser leaves it. It absorbs the Export, Compress, Image export and Convert dialogs and the
   password form.
4. **Snapshots** (M-34). An OPFS snapshot within 2 s of each history step (debounced) and on
   `visibilitychange: hidden`; `navigator.storage.persist()` is asked at the first edit. Content:
   `SerializedWorkspaceV1`; each source's bytes as opened or last saved, written once per source
   since sources are immutable (ADR-0005); every edit blob (`useWorkspaceStore.editBlobs`: stamp
   and image appearances, drawn or imported signatures) that the workspace or the history tail
   refers to, content-addressed and written once each, and put back with `putEditBlob` on
   restore before any replay, so the edit runner can inline them; per document its page, zoom,
   surface, sidebar section and lock, never Markup. Memory keeps 200 history entries, the snapshot the last 20, so Undo
   survives a reload for those steps.
5. **Launch** reopens the last session in tab order, each document where it was: "Restored 3
   documents · Start fresh". Start fresh closes them; their snapshots stay in Recents.
6. **Recents** keep each closed document's snapshot ("Edited, changes kept"); a click reopens it
   with no prompt or picker on every browser. Without a snapshot, Chromium uses the kept handle
   and other browsers the picker.
7. **Retention and honesty** (`flows.md` §5.2). 30 days or 500 MB, oldest first (judgement; owner
   question 2), listed with Clear in the privacy popover and in Settings ("Keep changes on this
   device", on). A private window says "Changes are not kept in this window". iOS may clear site
   storage after 7 days unvisited, so the promise reads "on this device, while the browser keeps
   it", and installing is suggested once (M-35). `beforeunload` asks only while a change is not
   yet in the snapshot or storage is not persistent.
8. **Undo, Redo, History** (`flows.md` §5.3, RA-11, FL-R3). ↶ ↷ on every width, phone viewing
   included, dimmed when empty, the step in the tooltip ("Undo pen on page 4"); undo scrolls the
   change into view and flashes a ring. Two- and three-finger taps undo and redo inside Markup
   only (M-17). History stays one list for the workspace: when the step belongs to another open
   document, the toast names it ("Undid highlight in agreement.pdf · Show") without switching
   tabs. A long press or right-click on ↶ opens the **History scrubber**: times and pages on fine
   pointers, a slider on coarse ones; dragging previews, release jumps (`jumpTo`).
9. **Toasts** (`language.md` §8, A-24): M2 capsules above the dock, palette and pending-marks
   bar, at most three; information 4 s; with an action ≥ 10 s, paused on hover or focus, in the F6
   cycle. Every removal ("Deleted page 7 · Undo", "Closed report.pdf · changes kept · Reopen") and
   every failure ("Could not open scan.pdf: the file is damaged"); errors stay until dismissed.
   Long jobs show a progress capsule with the ring (AU-11), never a blocking dialog.
10. **Saved signatures** (RA-5): up to five (drawn, typed or image) in IndexedDB
    (`pdf-editor:signatures:v1`), cleared in Settings, written only into the PDFs they sign.

## 3. Consequences

- Steps (`flows.md` §8.2): J13A Save 3 → 1 (3 the first time); J13B compress and save 8 → 5;
  J14 reopen 1–3 → 0–1; "+ save" on edit jobs +3/+4 → +1/+2.
- New modules: `session/` (snapshots, restore, retention), `signatures/`, `ui/Toast`;
  `ExportDialog.tsx` becomes the Save a copy sheet; `CombinedToast` folds into the toast stack.
- Restore replays engine edits on the restored source bytes (reopen-and-replay, ADR-0011), so a
  large file with many edits takes longer to restore than to open.
- The snapshot format follows `SerializedWorkspaceV1`; a format change needs a migration, or the
  old snapshot is set aside with a notice, never silently dropped.
- Files now stay on the device after the tab closes: a privacy duty, so the list, the sizes and
  Clear are one step from the privacy popover. Per-document history is a later ADR (§12).

## 4. Alternatives considered

- **Autosave into the file (Preview):** needs a handle and a write permission that only Chromium
  gives, and overwrites a file someone sent without asking; Save in place after one Replace, plus
  snapshots, gives the same safety.
- **Keep Export as the only save (today):** 3–4 steps and a 7-section form for every save.
- **The full 200-step history in the snapshot:** writes grow with every step; 20 covers a reload
  (build judge). **Keep nothing on the device:** silent loss on reload and on killed phone tabs.
- **A Restore prompt before reopening (research 19 M-34):** a question on every launch.
- **Snapshots in IndexedDB:** IndexedDB keeps the small records it holds today (Recents,
  signatures); OPFS is the browser's file store for large bytes.
- **Proposal B's undo gestures while reading:** a stray two-finger tap would undo work (S12).

## 5. Issues for the lead

1. **Chromium 153 cannot read stored handles.** `files/recents.ts` never reads a handle back from
   IndexedDB on Chromium 153, which crashes the browser. After a restore on that version Save has
   no handle: it opens the picker (2 presses) and keeps the new handle for the session.
2. **Saved state lives outside the document.** `VirtualDocument.clean` changes `documents[id]`
   and would trip the Lock check of ADR-0030. This ADR decides: "saved" is a per-document mark of
   the history entry last written, kept in the session store; ● on tabs reads from it.
3. **Save while locked.** `flows.md` §2.6 lists Save a copy among what Lock keeps, not Save. This
   ADR decides: Save stays allowed, since it writes the document as it is and changes nothing; a
   document that opened `signed` or `restricted` has nothing new, so its button reads "Saved".
4. **Owner question 2** (retention, on by default) is open; the defaults above are built so that
   a different answer changes two numbers and one switch's default.
