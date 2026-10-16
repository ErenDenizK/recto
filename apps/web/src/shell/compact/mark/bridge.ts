/**
 * The bridge from the phone's edit island to the one editing gate (code-audit §2 "One gate
 * turns editing on"; `design/phone-2026-10/README.md` §2, §6). Phones edit through exactly the
 * state the full edition does, so the page layers, the change guard and the commands need no
 * phone case:
 *
 * - **Enter** (✎): Markup opens on the active document (`ui-store.openMarkup`) and the compact
 *   store shows the island with the tool off (MOB-18): one finger scrolls and selects as in
 *   reading, and the chip, showing the tool it turns on (Pen the first time, later the last one
 *   used), or a tile in the drawer arms a tool through its registry spec (`registry.ts`), which
 *   sets the tool store's mode. A way in that means a tool (Edit text, a signature field, the
 *   selection bar) arms it right after.
 * - **Arm, toggle:** the previous tool's `disarm`, then the new one's `arm`. The chip toggled off
 *   (`toolOff`) arms Select: one finger pans and selects. A `soon` tool never arms.
 * - **Leave** (Done, or the Library): an open inline editor commits, the tool store returns to
 *   Select, Markup closes and the session's snapshot is written now (`flushSession`): there is
 *   no save in place on a phone, Done keeps the changes on the device (README §6). This runs on
 *   any way out of editing, as a reaction to the compact store, so ‹ Library leaves cleanly too.
 * - **Undo, Redo:** the workspace history through `history/actions` (an open pen burst's last
 *   stroke first, as Mod+Z), never past the step the document stood at when editing first
 *   began on it in this session: the step that opened the file is not the island's to undo.
 *
 * While editing, a press outside the annotation chrome clears the annotation selection (as the
 * full edition's `annotations/index.ts`, which the phone does not load: it pulls in redaction,
 * image objects and signatures).
 */
import type { DocumentId, History } from '@pdf-editor/document-model';

import { useAnnotationStore } from '../../../annotations/annotation-store';
import { commitOpenEditor } from '../../../annotations/InlineEditors';
import { redoStep, undoStep } from '../../../history/actions';
import { m } from '../../../i18n';
import { flushSession } from '../../../session/session';
import { announce } from '../../announcer';
import { useUiStore } from '../../../state/ui-store';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { useToolStore } from '../../../viewer/tool-store';
import {
  beginEditing,
  type CompactTool,
  endEditing,
  setCompactTool,
  setDrawerOpen,
  useCompactStore,
} from '../compact-store';
import { snapshotCapsule } from '../mark-host';
import { compactTool } from './registry';

/** The document being edited: Markup is open on it. */
let editingDoc: DocumentId | undefined;

/**
 * Per document, the history's past length when editing first began on it in this session:
 * the island's Undo stops there (the file's opening is not an edit made here).
 */
const floors = new Map<DocumentId, number>();

/** Whether the island's Undo has a step to take in `history` above `floor`. */
export function canUndoAbove(history: History, floor: number): boolean {
  return history.past.length > floor;
}

/** The island's Undo is live for the document being edited. */
export function canUndoHere(history: History = useWorkspaceStore.getState().history): boolean {
  const floor = editingDoc === undefined ? undefined : floors.get(editingDoc);
  return floor !== undefined && canUndoAbove(history, floor);
}

/** Runs the armed tool's `arm` (Select when it has none, is a stub or is `soon`). */
function armBehaviour(tool: CompactTool | null): void {
  const doc = editingDoc;
  const spec = compactTool(tool);
  if (doc === undefined || !spec?.arm || spec.soon) {
    useToolStore.getState().setMode('select');
    return;
  }
  spec.arm(doc);
}

function disarmBehaviour(tool: CompactTool | null): void {
  compactTool(tool)?.disarm?.();
}

/** ✎: opens Markup on the active document, the tool off (MOB-18). */
export function enterEditing(): void {
  const doc = useWorkspaceStore.getState().workspace.activeDocument;
  if (doc === undefined || useCompactStore.getState().editing) return;
  editingDoc = doc;
  if (!floors.has(doc)) floors.set(doc, useWorkspaceStore.getState().history.past.length);
  useUiStore.getState().openMarkup(doc);
  // MOB-18: the island opens with the tool off, so one finger still scrolls the pages; the chip
  // shows the tool it turns on (Pen first, then the last one used).
  armBehaviour(null);
  beginEditing(null);
  installDeselect();
  announce(m.compact_edit_on({ tool: m.compact_tool_off() }), { key: 'tool' });
}

/** Arms `tool` (a tile, the quiet row's Eraser); the drawer closes itself. */
export function armTool(tool: CompactTool): void {
  const spec = compactTool(tool);
  if (!spec || spec.soon) return;
  const state = useCompactStore.getState();
  if (!state.editing) return;
  disarmBehaviour(state.tool);
  setCompactTool(tool);
  armBehaviour(tool);
  announce(spec.label(), { key: 'tool' });
}

/** The tool the Eraser goes back to when it is turned off. */
let beforeEraser: CompactTool = 'pen';

/** The quiet row's Eraser: on, or back to the tool it took over from. */
export function toggleEraser(): void {
  const { tool, lastTool } = useCompactStore.getState();
  if (tool === 'eraser') {
    armTool(beforeEraser);
    return;
  }
  const from = tool ?? lastTool;
  if (from !== 'eraser') beforeEraser = from;
  armTool('eraser');
}

/** The chip toggled off, or Select: one finger pans and selects. */
export function toolOff(): void {
  const state = useCompactStore.getState();
  if (!state.editing || state.tool === null) return;
  disarmBehaviour(state.tool);
  setCompactTool(null);
  armBehaviour(null);
  announce(m.compact_tool_off(), { key: 'tool' });
}

/** The chip's tap: the tool off, or the last one back on. */
export function toggleTool(): void {
  const state = useCompactStore.getState();
  if (state.tool === null) armTool(state.lastTool);
  else toolOff();
}

/** Done: leaves editing (the rest runs in `leave`, on the store's change). */
export function exitEditing(): void {
  if (!useCompactStore.getState().editing) return;
  // An open text editor commits first, as a press elsewhere would (InlineEditors).
  commitOpenEditor();
  snapshotCapsule();
  endEditing();
}

export function undo(): boolean {
  if (!canUndoHere()) return false;
  return undoStep();
}

export function redo(): boolean {
  return redoStep();
}

/** Whatever ended editing (Done, the Library): back to reading, the changes kept. */
function leave(tool: CompactTool | null): void {
  const doc = editingDoc;
  editingDoc = undefined;
  removeDeselect();
  setDrawerOpen(false);
  disarmBehaviour(tool);
  useToolStore.getState().setMode('select');
  const annotations = useAnnotationStore.getState();
  annotations.select(null);
  annotations.setEditor(null);
  if (doc !== undefined) useUiStore.getState().closeMarkup(doc);
  void flushSession();
  announce(m.compact_edit_off());
}

useCompactStore.subscribe((state, previous) => {
  if (previous.editing && !state.editing) leave(previous.tool);
});

/** Presses that keep the annotation selection (as `annotations/index.ts`). */
const KEEP_SELECTOR = '[data-annotation-keep], [role="dialog"], [data-compact-chrome]';

const onPressDeselect = (event: PointerEvent) => {
  const store = useAnnotationStore.getState();
  if (store.selection === null) return;
  const target = event.target;
  if (target instanceof Element && target.closest(KEEP_SELECTOR)) return;
  store.select(null);
};

function installDeselect(): void {
  window.addEventListener('pointerdown', onPressDeselect, { capture: true });
}

function removeDeselect(): void {
  window.removeEventListener('pointerdown', onPressDeselect, { capture: true });
}

/** Tests: forget the floors and the document. */
export function resetBridge(): void {
  editingDoc = undefined;
  floors.clear();
  removeDeselect();
}
