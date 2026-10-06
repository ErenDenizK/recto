/**
 * The active tool. Minimal API shared by the viewer (text selection) and the annotation tools
 * (spec §2): `mode` and `setMode`. Drawing tools stay armed until Esc, which returns to
 * `select`; placing tools return to Select once they have placed their object (`03-markup` §3,
 * `finishOneShot`).
 *
 * It also holds what the Markup palette remembers for the session (`03-markup` §7): the pen
 * P arms (`lastPen`, MK-6), the shape kind and built-in stamp its choice tools show
 * (`lastShape`, `lastStamp`, MK-9), and whether the armed tool's editor is open (`editorOpen`,
 * MK-8: a second press of the armed tool or of its key opens it).
 *
 * Arming is guarded by the change guard (flows §2.4, ADR-0030): a tool other than Select arms
 * only when `canChange(id, 'freehand')`, that is in Markup and not locked, and the tool goes
 * back to Select whenever that stops holding for the active document (Markup closed, the
 * document locked, another tab). Callers that arm from viewing open Markup first
 * (`activateTool`).
 *
 * The armed tool's options need no request: its ink strip follows arming (`10-ink` §2.3). Its
 * full editor opens on request and closes when another tool arms or the tool disarms.
 *
 * The eraser's options (craft spec §5.6) live here too: Stroke or Partial (`eraserMode`) and
 * the eraser's diameter on screen (`eraserSize`), persisted per device beside the pen
 * presets (`ERASER_STORAGE_KEY`).
 */
import { create } from 'zustand';

import { canChange } from '../state/guard';
import { useLockStore } from '../state/lock-store';
import { readJson, writeJson } from '../state/safe-storage';
import { useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';

export type ToolMode =
  | 'select'
  | 'highlight'
  | 'underline'
  | 'strikeout'
  | 'squiggly'
  | 'ink'
  | 'eraser'
  /** Lasso (experience-redesign spec §6.5): selects pen strokes by drawing around them. */
  | 'lasso'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'text-box'
  | 'note'
  | 'stamp'
  | 'signature'
  /** Redaction marks (redaction spec §1.1): by text or by area. */
  | 'redact'
  /** In-place text editing (redaction-and-text-editing spec §2.2): one line at a time. */
  | 'edit-text'
  /** Image objects (M4 §3): select, move, resize, replace, extract, delete. */
  | 'image';

/**
 * The Markup palette's groups (`03-markup` MK-2, flows §4.3), in palette order. Select is the
 * idle tool and leads the palette after Done.
 */
export const PALETTE_GROUP_IDS = ['select', 'draw', 'add', 'sign', 'page'] as const;
export type PaletteGroup = (typeof PALETTE_GROUP_IDS)[number];

/** The kinds the Shapes button arms (MK-9), in its menu's order. */
export const SHAPE_MODES = ['rectangle', 'ellipse', 'line', 'arrow'] as const;
export type ShapeMode = (typeof SHAPE_MODES)[number];

export function isShapeMode(mode: ToolMode): mode is ShapeMode {
  return (SHAPE_MODES as readonly ToolMode[]).includes(mode);
}

/** A pen preset slot (`annotations/pen/presets.ts`): three pens, then the Highlighter. */
export type PenSlot = 0 | 1 | 2 | 3;

/**
 * What the eraser takes (craft spec §5.6): whole strokes, or only the parts of pen strokes
 * under its circle.
 */
export type EraserMode = 'stroke' | 'partial';

/** The eraser's diameters (CSS px on screen), smallest first. */
export const ERASER_SIZES = [6, 12, 24, 48] as const;
export type EraserSize = (typeof ERASER_SIZES)[number];
/** 12 px: the reach of the eraser before it had a size (6 px either side of the pointer). */
export const DEFAULT_ERASER_SIZE: EraserSize = 12;

/** Where the eraser's options persist per device, with the pen's settings. */
export const ERASER_STORAGE_KEY = 'pdf-editor:ui:eraser:v1';

interface EraserSettings {
  readonly eraserMode: EraserMode;
  readonly eraserSize: EraserSize;
}

/** The stored eraser options; anything unknown falls back to the defaults. */
function readEraserSettings(): EraserSettings {
  const raw = readJson(ERASER_STORAGE_KEY);
  const value = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const size = ERASER_SIZES.find((s) => s === value.size);
  return {
    eraserMode: value.mode === 'partial' ? 'partial' : 'stroke',
    eraserSize: size ?? DEFAULT_ERASER_SIZE,
  };
}

function writeEraserSettings(settings: EraserSettings): void {
  writeJson(ERASER_STORAGE_KEY, { v: 1, mode: settings.eraserMode, size: settings.eraserSize });
}

/** Tools that place one object and give the pointer back to Select (`03-markup` §3). */
export const ONE_SHOT_MODES: ReadonlySet<ToolMode> = new Set<ToolMode>(['stamp', 'signature']);

interface ToolState {
  readonly mode: ToolMode;
  /** The tool armed before the current one. */
  readonly previousMode: ToolMode;
  readonly eraserMode: EraserMode;
  readonly eraserSize: EraserSize;
  /** The writing pen armed last this session (never the Highlighter): P arms it (MK-6). */
  readonly lastPen: PenSlot;
  /** The shape kind the Shapes button shows and arms (MK-9). */
  readonly lastShape: ShapeMode;
  /** The built-in stamp the Stamp button shows (MK-9); null until one is chosen. */
  readonly lastStamp: string | null;
  /** Whether the armed tool's editor is open (MK-8); arming another tool closes it. */
  readonly editorOpen: boolean;
  setMode: (mode: ToolMode) => void;
  /** Opens or closes the armed tool's editor. */
  setEditorOpen: (open: boolean) => void;
  /** Remembers the writing pen P arms next. */
  setLastPen: (slot: PenSlot) => void;
  setLastStamp: (name: string) => void;
  /** Stroke or Partial; remembered per device. */
  setEraserMode: (mode: EraserMode) => void;
  /** The eraser's diameter on screen; remembered per device. */
  setEraserSize: (size: EraserSize) => void;
  /** After a placing tool placed its object: back to Select (`03-markup` §3). */
  finishOneShot: () => void;
}

/**
 * Whether no tool but Select may arm for the active document: the pointer may not create
 * there (`canChange(id, 'freehand')` is false: Markup closed, or locked). With no document open
 * there is no page to change, and the tool state is only remembered.
 */
function locked(): boolean {
  const id = useWorkspaceStore.getState().workspace.activeDocument;
  return id !== undefined && !canChange(id, 'freehand');
}

const SESSION = {
  mode: 'select',
  previousMode: 'select',
  lastPen: 0,
  lastShape: 'rectangle',
  lastStamp: null,
  editorOpen: false,
} as const;

export const useToolStore = create<ToolState>()((set, get) => ({
  ...SESSION,
  ...readEraserSettings(),
  setMode: (mode) =>
    set((s) =>
      s.mode === mode || (mode !== 'select' && locked())
        ? s
        : {
            mode,
            previousMode: s.mode,
            editorOpen: false,
            ...(isShapeMode(mode) ? { lastShape: mode } : {}),
          },
    ),
  setEditorOpen: (editorOpen) => set((s) => (s.editorOpen === editorOpen ? s : { editorOpen })),
  setLastPen: (lastPen) => set((s) => (s.lastPen === lastPen ? s : { lastPen })),
  setLastStamp: (lastStamp) => set((s) => (s.lastStamp === lastStamp ? s : { lastStamp })),
  setEraserMode: (eraserMode) => {
    if (get().eraserMode === eraserMode) return;
    set({ eraserMode });
    writeEraserSettings(get());
  },
  setEraserSize: (eraserSize) => {
    if (get().eraserSize === eraserSize) return;
    set({ eraserSize });
    writeEraserSettings(get());
  },
  finishOneShot: () => {
    if (ONE_SHOT_MODES.has(get().mode)) get().setMode('select');
  },
}));

// Nothing stays armed where the pointer may not create: Markup closed, or the document locked.
const disarmWhenLocked = () => {
  if (useToolStore.getState().mode !== 'select' && locked()) {
    useToolStore.getState().setMode('select');
  }
};
useUiStore.subscribe((state, previous) => {
  if (state.docUi !== previous.docUi) disarmWhenLocked();
});
useLockStore.subscribe((state, previous) => {
  if (state.locks !== previous.locks) disarmWhenLocked();
});
useWorkspaceStore.subscribe((state, previous) => {
  if (state.workspace.activeDocument !== previous.workspace.activeDocument) disarmWhenLocked();
});

/** Tests: the state of a fresh session (the eraser's options read back from storage). */
export function resetToolStore(): void {
  useToolStore.setState({ ...SESSION, ...readEraserSettings() });
}
