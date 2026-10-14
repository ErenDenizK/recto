/**
 * The full edition's field editors (`forms/FieldEditors.tsx`), loaded apart from the field
 * layer (MOB-1; research phone-2026-10/forms.md §2 "Bundle impact"): check boxes and radios
 * need none, so they load when a page with a text or choice field mounts, ahead of the tap.
 * A tap that comes first holds the keyboard while they arrive (EDN-17, `keyboard-hold.ts`).
 */
import { useSyncExternalStore } from 'react';

import type * as EditorsModule from '../../../../forms/FieldEditors';

export type Editors = typeof EditorsModule;

let loaded: Editors | null = null;
let loading: Promise<Editors> | undefined;
const listeners = new Set<() => void>();

/** Fetches the editors once; a failed fetch is retried next time. */
export function loadEditors(): Promise<Editors> {
  loading ??= import('../../../../forms/FieldEditors').then(
    (module) => {
      loaded = module;
      for (const listener of listeners) listener();
      return module;
    },
    (error: unknown) => {
      loading = undefined;
      throw error;
    },
  );
  return loading;
}

/** The editors if they are here. */
export function editorsNow(): Editors | null {
  return loaded;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => loaded;

/** The editors once loaded, else null; re-renders when they arrive. */
export function useEditors(): Editors | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
