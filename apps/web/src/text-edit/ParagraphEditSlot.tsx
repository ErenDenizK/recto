/**
 * The paragraph editor's page overlay in the full edition, loaded on first need (EDN-17): the
 * editor (`ParagraphEditor.tsx`: the glyph canvas, the engine fonts, the header) is a chunk of
 * its own, shared with the phone's Edit text chunk, so the editor's first load does not carry
 * it. It loads when Edit text is first armed (the layer then detects the page's paragraphs
 * ahead of a click, as before) or a paragraph first opens (Select's double-click on page text,
 * `entry.ts`), and stays mounted from then on. Opening never waits on it beyond the first time:
 * the editor lays the paragraph out after the engine's analysis anyway (`ParagraphEditor`).
 */
import { lazy, Suspense, useSyncExternalStore } from 'react';

import type { PageOverlayProps } from '../stage/page-overlays';
import { useToolStore } from '../viewer/tool-store';
import { useTextEditStore } from './text-edit-store';

const ParagraphEditLayer = lazy(() =>
  import('./ParagraphEditor').then((module) => ({ default: module.ParagraphEditLayer })),
);

/** Whether the editor has been wanted in this session (it then stays mounted). */
let wanted = false;
const listeners = new Set<() => void>();

function want(): void {
  if (wanted) return;
  wanted = true;
  for (const listener of listeners) listener();
}

const wantedNow = () =>
  useToolStore.getState().mode === 'edit-text' || useTextEditStore.getState().paragraph !== null;

useToolStore.subscribe(() => {
  if (wantedNow()) want();
});
useTextEditStore.subscribe(() => {
  if (wantedNow()) want();
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => wanted || wantedNow();

export function ParagraphEditSlot(props: PageOverlayProps) {
  const shown = useSyncExternalStore(subscribe, snapshot, snapshot);
  if (!shown) return null;
  return (
    <Suspense fallback={null}>
      <ParagraphEditLayer {...props} />
    </Suspense>
  );
}
