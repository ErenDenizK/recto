/**
 * Annotation commands: one per tool (spec §2 shortcuts), built-in stamps, delete, and the
 * Comments panel. Registered by `registerAppCommands` before the page commands so that
 * in Read mode R is the rectangle tool and Delete removes the selected annotation; in
 * Arrange mode the tools are unavailable and the page commands keep those keys.
 *
 * The Read lock (ADR-0019 §3): a tool key, button or palette entry pressed while the
 * document is in Read switches it to Edit and arms the tool, announced "Edit mode. Pen
 * tool"; over selected text a markup or redact key only switches, keeping the selection, so
 * marking takes a second press. Delete does nothing in Read.
 *
 * Pressing the armed tool again (its button or its key) opens its editor (`03-markup` MK-4,
 * MK-8); its ink strip shows from arming (`10-ink` §2). `P` arms the last writing pen and P
 * again the next one, never the Highlighter, and `H` the Highlighter (MK-6); each says the
 * preset it armed ("Black pen, 1.5 pt").
 *
 * The Esc ladder (`03-markup` §5): the first Esc disarms to Select and clears the selection
 * (`selection.clear`, `clearAnnotationTools`); with nothing armed, the next Esc closes Markup
 * (`markup/MarkupPalette.tsx`).
 */
// Registers the Edit text page layer (the tool itself is in ANNOTATION_TOOLS).
import '../text-edit';
// Registers the Image tool's page layer (the tool itself is in ANNOTATION_TOOLS).
import '../image-objects';
// Registers the Read selection bar (Copy, "Mark up…"; ADR-0019 §3).
import './ReadSelectionBar';

import { pickFiles } from '../files/open-files';
import { deleteImage, useImageStore } from '../image-objects';
import { m } from '../i18n';
import { announce } from '../shell/announcer';
import type { CommandRegistry } from '../commands/registry';
import { registerRedactionCommands } from '../redaction/commands';
import { markSelection } from '../redaction/marks';
import { openNewSignature } from '../signatures/new-signature';
import {
  armSavedSignature,
  loadSavedSignatures,
  useSavedSignatures,
} from '../signatures/saved-signatures';
import { type Act, canChange } from '../state/guard';
import { useLockStore } from '../state/lock-store';
import { isMarkupOpen, isPageView, useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { type ToolMode, useToolStore } from '../viewer/tool-store';
import { deleteAnnotations } from './actions';
import { commitOpenEditor } from './InlineEditors';
import { deleteLassoSelection } from './lasso/edits';
import { toolStyleGroup } from './drafts';
import { activateHighlighter } from './pen/highlighter';
import { isHighlighter, PRESET_INDICES, type PresetIndex, presetLabel } from './pen/presets';
import { activePathSelection, useAnnotationStore } from './annotation-store';
import { hasTextSelection, markupFromSelection } from './selection-markup';
import { BUILTIN_STAMPS, builtinPendingStamp, imageStamp } from './stamps';
import { ANNOTATION_TOOLS, isMarkupMode, type ToolDefinition, toolDefinition } from './tools';

const readMode = () =>
  isPageView(useUiStore.getState()) &&
  useWorkspaceStore.getState().workspace.documentOrder.length > 0;

/** Whether Markup is open for the active document (the tool bar's groups, tools arm). */
const markupOpen = () =>
  isMarkupOpen(useUiStore.getState(), useWorkspaceStore.getState().workspace.activeDocument);

/**
 * Before a tool arms: in viewing Markup opens, said first so that the tool named next follows
 * it ("Edit mode. Blue pen"). False when there is no document, or when it is locked: a tool
 * key opens nothing there (flows §3.1; the Unlock popover is the Lock UI's).
 */
export function enterEditForTool(): boolean {
  const id = useWorkspaceStore.getState().workspace.activeDocument;
  if (id === undefined) return false;
  if (!canChange(id, 'freehand', { opensMarkup: true })) return false;
  if (isMarkupOpen(useUiStore.getState(), id)) return true;
  useUiStore.getState().openMarkup(id);
  announce(m.mode_edit_long());
  return true;
}

/** Asks for an image and arms the stamp tool with it. Needs a user gesture. */
export async function pickImageStamp(kind: 'image' | 'signature' = 'image'): Promise<boolean> {
  if (!enterEditForTool()) return false;
  const [file] = await pickFiles('images');
  if (!file) return false;
  try {
    const stamp = await imageStamp(file, kind);
    useAnnotationStore.getState().setPendingStamp(stamp);
    useToolStore.getState().setMode(kind === 'image' ? 'stamp' : 'signature');
    announce(m.annot_place_stamp());
    return true;
  } catch (error) {
    console.warn('Could not read the image', error);
    announce(m.annot_image_failed({ name: file.name }));
    return false;
  }
}

/** Arms a built-in stamp (MK-9's menu and the stamp commands), remembered as the last one. */
export function armBuiltinStamp(name: (typeof BUILTIN_STAMPS)[number]['name']): void {
  const store = useAnnotationStore.getState();
  store.setPendingStamp(builtinPendingStamp(name));
  store.select(null);
  useToolStore.getState().setLastStamp(name);
  useToolStore.getState().setMode('stamp');
}

/** Activates a tool the way its button and shortcut do. */
export async function activateTool(tool: ToolDefinition): Promise<void> {
  const tools = useToolStore.getState();
  const store = useAnnotationStore.getState();
  const id = useWorkspaceStore.getState().workspace.activeDocument;
  if (id !== undefined && !isMarkupOpen(useUiStore.getState(), id)) {
    // Select is the idle tool of viewing and Markup alike: V in viewing changes nothing.
    if (tool.mode === 'select') return;
    // Viewing: open Markup and arm, synchronously so that both are said in one
    // announcement; a locked document opens nothing. Selected text stays selected and is
    // marked by a second press.
    if (!enterEditForTool()) return;
    if ((isMarkupMode(tool.mode) || tool.mode === 'redact') && hasTextSelection()) return;
  } else {
    if (isMarkupMode(tool.mode) && (await markupFromSelection(tool.mode))) return;
    // Redact: selected text becomes a mark (redaction spec §1.1); else the tool arms.
    if (tool.mode === 'redact' && (await markSelection())) return;
  }
  // Stamp (MK-9): the stamp armed last, else the last built-in one (Draft at first).
  if (tool.mode === 'stamp' && tools.mode !== 'stamp') {
    const pending = store.pendingStamp;
    if (!pending || pending.kind === 'signature') {
      const name =
        BUILTIN_STAMPS.find((s) => s.name === tools.lastStamp)?.name ?? BUILTIN_STAMPS[0]?.name;
      if (name) store.setPendingStamp(builtinPendingStamp(name));
    }
  }
  // The signature tool (D0-11, MK-12 §6): the signature of this session again, else the
  // newest saved one, else New signature (S7) to make one.
  if (tool.mode === 'signature') {
    if (store.pendingStamp?.kind !== 'signature') {
      await loadSavedSignatures();
      const newest = useSavedSignatures.getState().signatures[0];
      if (!newest || !(await armSavedSignature(newest.id))) openNewSignature();
      return;
    }
  }
  // The armed tool again (`03-markup` MK-4 §6, "a second press opens choices"): its editor,
  // for a tool with options; the pen well handles its own presets (`activatePen`, PenWell).
  if (tool.mode !== 'select' && tool.mode !== 'ink' && tools.mode === tool.mode) {
    if (!hasToolEditor(tool.mode)) return;
    const open = !tools.editorOpen;
    tools.setEditorOpen(open);
    if (open) announce(m.bar_options({ tool: tool.title() }), { key: 'tool' });
    return;
  }
  if (tool.mode !== 'select') store.select(null);
  tools.setMode(tool.mode);
  // Keyed: a more precise word said with it (the armed pen preset) replaces it.
  announce(m.announce_tool({ tool: tool.title() }), { key: 'tool' });
}

// The writing pen armed last this session (never the Highlighter; `tool-store.lastPen`): P
// arms it again.
useAnnotationStore.subscribe((state, previous) => {
  const { active, presets } = state.pen;
  if (active !== previous.pen.active && !isHighlighter(presets[active])) {
    useToolStore.getState().setLastPen(active);
  }
});

/** The writing pens, in well order (never the Highlighter). */
function writingPens(): PresetIndex[] {
  const { presets } = useAnnotationStore.getState().pen;
  return PRESET_INDICES.filter((i) => !isHighlighter(presets[i]));
}

/** The pen preset P arms: the active one when it is a pen, else the last pen used. */
export function writingPenIndex(): PresetIndex {
  const { active, presets } = useAnnotationStore.getState().pen;
  if (!isHighlighter(presets[active])) return active;
  const last = useToolStore.getState().lastPen;
  if (!isHighlighter(presets[last])) return last;
  return writingPens()[0] ?? active;
}

/** Whether a tool has an editor that a second press opens (MK-8; the pen's is its own). */
export function hasToolEditor(mode: ToolMode): boolean {
  return mode === 'ink' || toolStyleGroup(mode) !== undefined;
}

/**
 * P (`03-markup` MK-6 §6): arms the last writing pen, never the Highlighter (DESIGN §4.1);
 * P again, with a writing pen armed, arms the next one (1 → 2 → 3, wrapping). It says which
 * ("Black pen, 1.5 pt"; from viewing, "Markup on. Black pen, 1.5 pt"). Synchronous, so
 * everything is said in one message.
 */
export function activatePen(): void {
  const tools = useToolStore.getState();
  const store = useAnnotationStore.getState();
  let index = writingPenIndex();
  if (tools.mode === 'ink' && markupOpen() && !isHighlighter(store.pen.presets[store.pen.active])) {
    const pens = writingPens();
    index = pens[(pens.indexOf(store.pen.active) + 1) % pens.length] ?? index;
  }
  // The pen's path through `activateTool` never awaits, so it has armed when this returns.
  void activateTool(toolDefinition('ink'));
  if (useToolStore.getState().mode !== 'ink') return;
  useAnnotationStore.getState().armPreset(index);
  // Said instead of the generic "Pen tool" (same key).
  announce(presetLabel(index, useAnnotationStore.getState().pen.presets[index]), { key: 'tool' });
}

/**
 * The act a tool's command declares (ADR-0030 §2.2; X34): what the armed tool makes on the
 * page. Select makes nothing; Edit text commits through the paragraph editor; the Image tool
 * moves, resizes or replaces the image the person chose; the placing tools put an object at a
 * point; every other tool creates with the pointer.
 */
export function toolAct(mode: ToolMode): Act | null {
  return toolDefinition(mode).act;
}

export function registerAnnotationCommands(registry: CommandRegistry): () => void {
  const disposers = [
    ...ANNOTATION_TOOLS.map((tool) =>
      registry.register({
        id: `tool.${tool.mode}`,
        title: m.cmd_tool({ tool: tool.title() }),
        group: m.group_tools(),
        act: toolAct(tool.mode),
        // A tool key is a Markup door (ADR-0029 §2.2): it opens Markup, then arms.
        ...(tool.mode === 'select' ? {} : { via: 'markup' as const }),
        ...(tool.shortcut === undefined ? {} : { shortcut: tool.shortcut }),
        keywords: ['tool', 'annotate', 'annotation', ...(tool.keywords ?? [])],
        when: readMode,
        run: () => (tool.mode === 'ink' ? activatePen() : activateTool(tool)),
      }),
    ),
    // Highlight (H) arms the Highlighter preset (craft spec §5.4, pen/highlighter.ts).
    registry.register({
      id: 'tool.highlighter',
      title: m.cmd_tool({ tool: m.tool_highlighter() }),
      group: m.group_tools(),
      act: 'freehand',
      via: 'markup',
      shortcut: 'H',
      keywords: ['tool', 'annotate', 'annotation', 'highlight'],
      when: readMode,
      run: () => activateHighlighter(activateTool),
    }),
    ...BUILTIN_STAMPS.map((stamp) =>
      registry.register({
        id: `stamp.${stamp.name.toLowerCase()}`,
        title: m.cmd_stamp({ name: stamp.label() }),
        group: m.group_tools(),
        act: 'place',
        via: 'markup',
        keywords: ['stamp', 'annotate', stamp.name],
        when: readMode,
        run: () => {
          if (!enterEditForTool()) return;
          armBuiltinStamp(stamp.name);
          announce(m.annot_place_stamp());
        },
      }),
    ),
    registry.register({
      id: 'stamp.image',
      title: m.cmd_stamp_image(),
      group: m.group_tools(),
      act: 'place',
      via: 'markup',
      keywords: ['stamp', 'image', 'picture', 'logo'],
      when: readMode,
      run: () => pickImageStamp('image').then(() => undefined),
    }),
    registry.register({
      id: 'annotation.delete',
      title: m.cmd_delete_annotation(),
      group: m.group_edit(),
      act: 'targeted',
      shortcut: ['Delete', 'Backspace'],
      keywords: ['remove', 'annotation', 'comment'],
      // A targeted act: in viewing and Markup alike, the guard refuses it while locked.
      when: () => readMode() && useAnnotationStore.getState().selection !== null,
      run: async () => {
        const state = useAnnotationStore.getState();
        // A lasso selection deletes the taken strokes only (lasso/edits.ts).
        if (activePathSelection(state)) await deleteLassoSelection();
        else if (state.selection) await deleteAnnotations(state.selection, state.selection.ids);
      },
    }),
    registry.register({
      id: 'image.delete',
      title: m.cmd_delete_image(),
      group: m.group_edit(),
      act: 'targeted',
      shortcut: ['Delete', 'Backspace'],
      keywords: ['remove', 'image', 'picture'],
      when: () => readMode() && useImageStore.getState().selection !== null,
      run: async () => {
        const selection = useImageStore.getState().selection;
        if (selection) await deleteImage(selection.target, selection.image);
      },
    }),
    registry.register({
      id: 'view.show.comments',
      title: m.cmd_show_comments(),
      group: m.group_view(),
      act: null,
      keywords: ['panel', 'sidebar', 'annotations', 'notes'],
      run: () => useUiStore.setState({ leftPanelOpen: true, leftPanelView: 'comments' }),
    }),
    registerRedactionCommands(registry),
    watchReadLock(),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}

/**
 * The active document becoming locked (or a tab whose document is) commits an open inline
 * editor and drops the annotation selection, so nothing stays half-edited behind the lock;
 * leaving Markup drops the image selection, which belongs to Markup's Image tool (the tool
 * store disarms the tool itself). An annotation selected in viewing stays selected when Markup
 * opens or closes: selecting is not a mode (05-canvas §6).
 */
function watchReadLock(): () => void {
  const lock = () => {
    if (!markupOpen() && useImageStore.getState().selection !== null) {
      useImageStore.getState().select(null);
    }
    if (canChange(useWorkspaceStore.getState().workspace.activeDocument, 'targeted')) return;
    const store = useAnnotationStore.getState();
    if (store.editor !== null) {
      commitOpenEditor();
      useAnnotationStore.getState().setEditor(null);
    }
    if (useAnnotationStore.getState().selection !== null) store.select(null);
    if (useImageStore.getState().selection !== null) useImageStore.getState().select(null);
  };
  const offUi = useUiStore.subscribe((state, previous) => {
    if (state.docUi !== previous.docUi) lock();
  });
  const offLock = useLockStore.subscribe((state, previous) => {
    if (state.locks !== previous.locks) lock();
  });
  const offWorkspace = useWorkspaceStore.subscribe((state, previous) => {
    if (state.workspace.activeDocument !== previous.workspace.activeDocument) lock();
  });
  return () => {
    offUi();
    offLock();
    offWorkspace();
  };
}

/** Escape: back to Select, drop the annotation selection and any open editor. */
export function clearAnnotationTools(): boolean {
  const tools = useToolStore.getState();
  const store = useAnnotationStore.getState();
  const active = tools.mode !== 'select' || store.selection !== null || store.editor !== null;
  if (tools.mode !== 'select') tools.setMode('select');
  if (store.selection !== null) store.select(null);
  if (store.editor !== null) store.setEditor(null);
  return active;
}

export function hasAnnotationToolState(): boolean {
  const store = useAnnotationStore.getState();
  return (
    useToolStore.getState().mode !== 'select' || store.selection !== null || store.editor !== null
  );
}
