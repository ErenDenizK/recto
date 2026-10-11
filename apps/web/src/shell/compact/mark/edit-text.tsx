/**
 * Edit text on the phone (`design/phone-2026-10/README.md` §3 row 1, §4; code-audit §6 WP5;
 * EDN-17), registered over the "Soon" stub (`tools.ts`) when the editing chunk loads.
 *
 * - **The tool** arms the full edition's Edit text mode (`edit-text` in the tool store): the
 *   page's runs become targets (`TextEditLayer`), and a tap on a paragraph opens the full
 *   edition's paragraph editor on it (`ParagraphEditor`), or the line editor on a run outside
 *   any paragraph. Nothing is forked: the phone adds a page layer around them.
 * - **Its own chunk.** The editors (engine fonts, the glyph canvas) load lazily from
 *   `edit-text-layer.tsx`, prefetched as the tool arms, so a tap finds them here.
 * - **The keyboard** rises in the tap itself: a stand-in takes the focus inside the tap's
 *   handling and hands it to the editor once it is ready (`keyboard-hold.ts`).
 *
 * `editTextAt` is the selection bar's Edit text (README §4): it holds the keyboard in the
 * button's own click, arms the tool and opens the editor at the selection.
 */
import { type ComponentType, useSyncExternalStore } from 'react';

import { m } from '../../../i18n';
import type { PageOverlayProps } from '../../../stage/page-overlays';
import { useToolStore } from '../../../viewer/tool-store';
import { useCompactStore } from '../compact-store';
import { registerCompactOverlay } from '../mark-host';
import { armTool, enterEditing } from './bridge';
import { holdKeyboard, releaseKeyboard } from './keyboard-hold';
import { registerCompactTool } from './registry';
import type * as EditTextModule from './edit-text-layer';

type EditTextChunk = typeof EditTextModule;

let loading: Promise<EditTextChunk> | undefined;
let loaded: EditTextChunk | null = null;
const listeners = new Set<() => void>();

/** Fetches the editors' chunk once (a failed fetch is tried again on the next arm). */
export function loadEditText(): Promise<EditTextChunk> {
  loading ??= import('./edit-text-layer').then(
    (chunk) => {
      loaded = chunk;
      for (const listener of listeners) listener();
      return chunk;
    },
    (error: unknown) => {
      loading = undefined;
      throw error;
    },
  );
  return loading;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => loaded;

/** The page slot: the chunk's layers once it is here (it renders nothing until it is used). */
function EditTextSlot(props: PageOverlayProps) {
  const chunk = useSyncExternalStore(subscribe, snapshot, snapshot);
  if (!chunk) return null;
  const Layers: ComponentType<PageOverlayProps> = chunk.EditTextLayers;
  return <Layers {...props} />;
}

EditTextSlot.displayName = 'EditTextSlot';

/**
 * The selection bar's Edit text, at `at` (client px, on the selection): the keyboard is held
 * now, in the press; editing begins with Edit text armed, and the editor opens on the paragraph
 * there once its chunk is here.
 */
export function editTextAt(at: { readonly x: number; readonly y: number }): void {
  holdKeyboard(at);
  if (!useCompactStore.getState().editing) enterEditing();
  armTool('edit-text');
  void loadEditText().then(
    (chunk) => chunk.openAt(at),
    () => releaseKeyboard(),
  );
}

registerCompactTool({
  id: 'edit-text',
  glyph: 'edit-text',
  label: m.compact_tool_edit_text,
  place: 'tile',
  order: 50,
  hint: m.compact_edit_text_hint,
  arm: () => {
    useToolStore.getState().setMode('edit-text');
    void loadEditText().catch(() => undefined);
  },
});

registerCompactOverlay(EditTextSlot);
