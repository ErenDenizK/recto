/**
 * A morph asked from inside a content (`Capsule.tsx` slot API, `morphKey`; `03-markup` MK-1 §6):
 * a content whose own state reshapes it (the grouped Markup palette opening a group in place,
 * `markup/task-groups.ts`) names that state here, and the capsule morphs when it changes while
 * that content shows, as it does for the dock's `morphKey`.
 *
 * The content must change this key in the same update as the state that reshapes it (one
 * event, so React renders both in one commit): the capsule reads its snapshot before that commit.
 */
import { useSyncExternalStore } from 'react';

import type { CapsuleShape } from './capsule-content';

let keys: Partial<Record<CapsuleShape, string>> = {};
const listeners = new Set<() => void>();

/** Names the state of `shape`'s content that its size follows. */
export function setContentMorphKey(shape: CapsuleShape, key: string | undefined): void {
  if (keys[shape] === key) return;
  keys = { ...keys, [shape]: key };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The key `shape`'s content set, if any. */
export function useContentMorphKey(shape: CapsuleShape): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => keys[shape],
    () => keys[shape],
  );
}
