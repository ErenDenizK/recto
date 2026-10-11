# Phone editing: code audit (M10, 2026-10-11)

Read-only audit of how the compact phone reader (`apps/web/src/shell/compact/`) becomes the
minimal editable edition of EDN-7 (pen, highlight, add text, edit text, signature). Line
references are as of develop `85524db`.

## 1. Where the compact edition stands

- **Entry.** `shell/frame/edition.ts` chooses the edition once: a coarse pointer and a short
  screen side under 600 px, with a `?edition` override. `main.tsx` lazy-loads `CompactApp`.
  `startSession({ edition: 'compact' })` already writes snapshots on phones.
- **Store.** `compact-store.ts` has no mode or tool field.
- **Reader.** Scrolling is native (`touch-action: pan-x pan-y`). Pinch zoom runs on TouchEvents
  and transforms the stage. Tap and double-tap come from `gestures.ts`.
- **Page.** `CompactPage.tsx` has a fixed list of overlays and no registry slot (the full
  edition has one in `stage/page-overlays.tsx`).
- **Conflicts with drawing.**
  - A one-finger stroke can pass as a tap, so a dot toggles the chrome and two dots zoom.
  - The compact pinch runs alongside ink-input's own touch rules.
  - `touch-action: none` on a drawing layer blocks native two-finger panning.
  - The chrome hides on scroll.

## 2. Reuse per feature

**One gate turns editing on.** `viewer/input-state.ts`, `state/guard.ts` and
`annotations/commands.ts` all read `isMarkupOpen(ui-store)` and the tool store's mode. A bridge
in the lazy chunk can open Markup on the document, set the tool, and mount the overlays. Import
`AnnotationLayer` directly, never `annotations/index.ts`: that barrel pulls in redaction,
image objects and signatures.

| Feature | Reuse | New for phones |
|---|---|---|
| Pen | `AnnotationLayer`, `pen/ink-input` (a finger draws until a pen is seen, then the finger pans `[data-read-viewport]`; a second finger drops the stroke), `dry-ink`, eraser, presets | Chips for 3 colours × 3 sizes (PenWell and PresetEditor are desktop UI) |
| Highlight | `pen/highlighter.ts` (freehand that snaps to lines); `selection-markup.ts` (needs `AnnotationLayer` mounted) | A small selection bar, loaded on the first selection (`ReadSelectionBar` pulls in the command registry); it must not fight the iOS callout |
| Add text | The `text-box` tool plus `InlineEditors` (commits on blur) | Keep the box clear of the keyboard; check that focus opens the keyboard on iOS |
| Edit text | `text-edit/TextEditLayer`, `ParagraphEditor` (heavy: engine fonts, glyph canvas) | **Synchronous focus inside the tap**: today focus lands after an async load, so iOS likely shows no keyboard. Fix it in the shared component. Compact must write the `--free-*` vars and the keyboard inset that the header reads |
| Signature | `signatures/saved-signatures`, `NewSignatureSheet` (already a 92 % bottom sheet in compact windows), `AnnotationLayer`'s `signature` act | A saved-signatures sheet; touch-size handles to move and scale |
| Keyboard | `useVisualViewportHeight` in `frame-insets.ts` | A keep-in-view helper on visualViewport resize, for iOS and Android |

## 3. Undo and saving

- **Undo.** Compact has no undo UI today. `workspace-store.undo` and `history/actions` exist;
  load them in the lazy chunk.
- **Save.** Pristine documents share their own bytes; changed ones go through `prepareExport`.
  Share uses `navigator.share` and falls back to download.
- **Bug to fix before editing ships.** The copy cache is keyed per document object, and the ⋯
  menu prepares a copy when it opens. Annotation edits change `engineEdits`, not the document
  object, so Share could hand out a stale copy. Key the cache on the edits.
- **Change cue and Done.** Use `isDocumentChanged` for the "changed" cue, and run
  `flushSession()` on Done.
- **No save in place.** Phones have no file-system access, so a save is always a copy plus the
  kept snapshot.

## 4. Bundle (gate 320 KB, about 1.1 KiB headroom, never raised: PRC-11)

- **(a) Free room first.** Lazy-load the Contents, Info, About and Go-to sheets.
- **(b) The static path gains only** the edit button, the mode and tool fields, an overlay slot
  and the tap-rule change.
- **(c) Everything else goes in `import('./mark/…')`,** with text-edit, signatures and the
  selection bar each split again. Prefetch the Mark chunk when the browser is idle.
- **Check after every package.** Run `tools/qa/bundle-budget.ts`. The shared-chunk policy in
  `vite.config.ts` can drag a shared module into a static chunk.

## 5. Tests

- **Unit tests:**
  - gesture rules in edit mode
  - the bridge sets and clears editing state
  - the keep-in-view helper
  - the copy-cache key
  - the selection bar
- **e2e:** `compact-edit.spec.ts` in the `phone` and `phone-land` projects, driving CDP touch.
  - a stroke, then undo and redo
  - a pinch never draws
  - highlight a selection
  - place a text box and type in it
  - edit a paragraph
  - place a saved signature
  - Share includes the edits
- **By hand.** The iOS keyboard can only be checked on an iPhone, in the owner's task script.

## 6. Work packages (each at most one agent-day)

| Package (lane) | Owns | After | Acceptance |
|---|---|---|---|
| WP0 (A, shell) | the `CompactSheets` split, `compact-store`, `CompactReader`, `CompactPage` overlay slot, `gestures`, `CompactChrome` edit button, `mark/MarkHost`, `mark/bridge` | — | Bundle gate passes; read mode unchanged; the Mark chunk loads only on tap |
| WP1 (A) | the edit-mode bar (Undo · tool · Done), the tool drawer, the options row | WP0 | 44 px targets; bar-audit passes; Done flushes the session |
| WP2 (B, ink) | pen and eraser wiring | WP0 | A stroke commits and repaints; undo removes it; a pinch never draws |
| WP3 (B) | lazy selection bar, freehand highlight | WP0 | Highlighting works from a selection and freehand |
| WP4 (C, text) | `mark/keyboard.ts` (keep in view, `--free-*` writer), text-box wiring | WP0 | A box is placed and typed into, and the keyboard never covers it |
| WP5 (C) | lazy TextEditLayer, synchronous focus in `ParagraphEditor` | WP4 | A paragraph edit commits; the full edition's paragraph-edit spec stays green |
| WP6 (D, sign) | saved-signatures sheet, lazy NewSignatureHost, placement | WP0 | Draw → save → place → move or scale → undo |
| WP7 (A) | `compact-actions` copy cache keyed on edits, the changed cue | WP0 | Share after an edit includes the edit |
| WP8 (E, QA) | `compact-edit.spec.ts`, config, unit tests, bundle check | each package | The phone projects are green and the gate holds |

**Risks:**

- bundle headroom
- the iOS keyboard in ParagraphEditor
- gesture conflicts
- AnnotationBar handles too small for touch
- a stale Share copy
- `messages/*.json` edited by every lane: each lane gets its own key prefix and the lead merges
- ParagraphEditor's cost on mid-range phones
