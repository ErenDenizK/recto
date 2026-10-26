/**
 * Sign on the phone (`design/phone-2026-10/README.md` §3 row 2, §4; code-audit §2 "Signature",
 * WP6): registered over the WP1 stub (`tools.ts`) when the editing chunk loads.
 *
 * - **The tile** arms Sign and the drawer stays open, as for every tile (EDN-18), on its second
 *   row: the saved signatures as tiles and New (`sign-options.tsx`, its own chunk, prefetched as
 *   Sign arms). Until a signature is chosen one finger pans and selects, as Select.
 * - **A saved tile** arms it as the one-shot signature tool (`armSavedSignature`) and the drawer
 *   stays open, so another can be chosen; the first press on the page closes it and places the
 *   signature (`drawer-close.ts`). **New** closes it, since its pad needs the screen, and opens
 *   New signature (S7), lazily, the full edition's form in the phone's one sheet (DSN-53,
 *   `new-signature.tsx`); its Use arms what was drawn the same way.
 * - **The next tap** on a page places the signature (AnnotationLayer's `signature` act), which
 *   is selected at once with the phone's touch handles (`touch-chrome.ts`) to move and scale it,
 *   then Select returns (`finishOneShot`); Undo removes it.
 * - **Disarming** (another tool, the chip off, Done) drops a signature still waiting to be
 *   placed.
 *
 * New signature's sheet is mounted by `SignHost` while editing, beside the drawer: the drawer
 * closes as the sheet opens, so the sheet cannot live in it.
 */
import { lazy, Suspense, useSyncExternalStore } from 'react';

import { useAnnotationStore } from '../../../annotations/annotation-store';
import { m } from '../../../i18n';
import { useSheetStore } from '../../../ui/sheet/sheet-store';
import { useToolStore } from '../../../viewer/tool-store';
import { setDrawerOpen } from '../compact-store';
import { useBackgroundLock } from './background-lock';
import { registerCompactTool } from './registry';
import styles from './sign.module.css';

const loadOptions = () => import('./sign-options');
const LazyOptions = lazy(loadOptions);
const LazyTray = lazy(() => loadOptions().then((module) => ({ default: module.SignTray })));
const LazyHost = lazy(() => import('./new-signature'));

/** The drawer's second row for Sign; a row's height of room while its chunk arrives. */
function SignOptions() {
  return (
    <Suspense fallback={<div className={styles.loading} aria-busy="true" />}>
      <LazyOptions />
    </Suspense>
  );
}

/** The single capsule's tray for Sign (EDN-24); a tray's height of room while its chunk arrives. */
function SignTrayContent() {
  return (
    <Suspense fallback={<div className={styles.loading} aria-busy="true" />}>
      <LazyTray />
    </Suspense>
  );
}

/** Whether New signature has been asked for in this session (its host then stays mounted). */
let requested = false;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => requested;

/** New: the drawer closes and New signature opens (S7), its code loaded on first use. */
export async function openNewSignatureSheet(): Promise<void> {
  setDrawerOpen(false);
  if (!requested) {
    requested = true;
    for (const listener of listeners) listener();
  }
  const { openNewSignature } = await import('../../../signatures/new-signature');
  openNewSignature('use');
}

/**
 * Mounts New signature's host once it has been asked for (rendered while editing). While it,
 * or any sheet, is open, the pages behind stay still (`background-lock.ts`): signing on a phone
 * on its side never scrolls them.
 */
export function SignHost() {
  const asked = useSyncExternalStore(subscribe, snapshot, snapshot);
  const sheetOpen = useSheetStore((s) => s.open !== null);
  useBackgroundLock(asked && sheetOpen);
  if (!asked) return null;
  return (
    <Suspense fallback={null}>
      <LazyHost />
    </Suspense>
  );
}

/**
 * A signature placed (the layer selects what it places): Select comes back with the signature
 * still selected, so its touch handles move and scale it at once (README §4). The full
 * edition's palette rule (`markup/palette-groups.ts`) deselects instead; the phone never loads
 * it.
 */
useAnnotationStore.subscribe((state, previous) => {
  if (state.selection === null || state.selection === previous.selection) return;
  if (useToolStore.getState().mode !== 'signature') return;
  useToolStore.getState().finishOneShot();
});

registerCompactTool({
  id: 'sign',
  glyph: 'signature',
  label: m.compact_tool_sign,
  place: 'tile',
  order: 40,
  Options: SignOptions,
  Tray: SignTrayContent,
  arm: () => {
    useToolStore.getState().setMode('select');
    void loadOptions().then((module) => module.loadSignatures());
  },
  disarm: () => {
    const annotations = useAnnotationStore.getState();
    if (annotations.pendingStamp?.kind === 'signature') annotations.setPendingStamp(null);
    useToolStore.getState().finishOneShot();
  },
});
