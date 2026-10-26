/**
 * The Labs panel's state (DSN-82): the toggles and the reveal, kept in `pdf-editor:labs:v1`
 * (`stored.ts`) and shared by the Settings sheets through `useSyncExternalStore`.
 *
 * - **Reveal:** the panel is hidden for normal users. Tapping the version number five times
 *   (`REVEAL_TAPS`, each within `TAP_GAP_MS` of the last) shows it for good and says so in a
 *   toast. It also shows whenever the address turns a flag on (`anyFlagOnByAddress`).
 * - A change of a flag applies at the next start: every reader decides once per page.
 */
import { useSyncExternalStore } from 'react';

import { m } from '../i18n';
import { toast } from '../ui/Toast/toast';
import { anyFlagOnByAddress, forgetOwnValue, LABS_FLAGS, type LabsKey } from './flags';
import { LABS_KEY, type LabsState, readLabs } from './stored';

export const REVEAL_TAPS = 5;
/** A tap later than this after the last starts the count again. */
export const TAP_GAP_MS = 1500;

const listeners = new Set<() => void>();
let snapshot: LabsState | undefined;

function write(next: LabsState): void {
  snapshot = next;
  try {
    localStorage.setItem(LABS_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the choice lasts until the page reloads.
  }
  for (const listener of listeners) listener();
}

/** The state now. The same object until it changes, as `useSyncExternalStore` needs. */
export function labsState(): LabsState {
  snapshot ??= readLabs();
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLabsState(): LabsState {
  return useSyncExternalStore(subscribe, labsState, labsState);
}

/** Whether the panel shows: revealed, or a flag is on by the address. */
export function useLabsVisible(): boolean {
  const { shown } = useLabsState();
  return shown || anyFlagOnByAddress(location.search);
}

/** Sets a flag's Labs toggle (a switch: `'1'` or `'0'`; a choice: its value). */
export function setLabsFlag(key: LabsKey, value: string): void {
  const state = labsState();
  write({ ...state, flags: { ...state.flags, [key]: value } });
}

/** Reset all: every toggle and everything a flag kept itself goes back to the defaults. */
export function resetLabs(): void {
  for (const flag of LABS_FLAGS) forgetOwnValue(flag);
  write({ shown: labsState().shown, flags: {} });
}

/** Shows the panel for good. */
export function revealLabs(): void {
  write({ ...labsState(), shown: true });
  toast.info(m.labs_on());
}

/** Tests: forget what this page read (the storage is the test's to clear). */
export function resetLabsStoreForTests(): void {
  snapshot = undefined;
}

/**
 * A tap counter for the version number: returns the click handler that reveals the panel on
 * the fifth tap in a row.
 */
export function createRevealTap(now: () => number = () => performance.now()): () => void {
  let count = 0;
  let last = Number.NEGATIVE_INFINITY;
  return () => {
    const at = now();
    count = at - last <= TAP_GAP_MS ? count + 1 : 1;
    last = at;
    if (count < REVEAL_TAPS) return;
    count = 0;
    revealLabs();
  };
}
