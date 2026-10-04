/**
 * Saved and recent colours (`10-ink.md` §4.1), per device.
 *
 * - **Saved:** up to twelve, under `pdf-editor:ui:saved-colours:v1`, shared by every tool.
 *   [+] adds the current colour at the end; a colour already saved is not added twice; when
 *   twelve are saved, adding is refused (the panel says so) rather than dropping one.
 * - **Recent:** the last six colours committed in the colour panel, newest first, under
 *   `pdf-editor:ui:recent-colours:v1`. They also feed the ink strip's sixth swatch (§2.1).
 *
 * Storage goes through `state/safe-storage.ts`, so a private window or blocked storage
 * degrades to "not persisted". What was stored is validated when read: anything that is not
 * a `#RRGGBB` colour is dropped. Another tab's change arrives through the `storage` event.
 */
import { useSyncExternalStore } from 'react';

import { readJson, writeJson } from '../../state/safe-storage';
import { parseHex } from './colour-math';

export const SAVED_COLOURS_KEY = 'pdf-editor:ui:saved-colours:v1';
export const RECENT_COLOURS_KEY = 'pdf-editor:ui:recent-colours:v1';
export const SAVED_MAX = 12;
export const RECENT_MAX = 6;

export interface ColourLists {
  readonly saved: readonly string[];
  readonly recent: readonly string[];
}

/** Valid, upper-case, distinct colours from a stored value, at most `max`. */
function parseList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const hex = typeof item === 'string' ? parseHex(item) : null;
    if (hex && !out.includes(hex)) out.push(hex);
    if (out.length === max) break;
  }
  return out;
}

function read(): ColourLists {
  return {
    saved: parseList(readJson(SAVED_COLOURS_KEY), SAVED_MAX),
    recent: parseList(readJson(RECENT_COLOURS_KEY), RECENT_MAX),
  };
}

let lists: ColourLists | undefined;
const listeners = new Set<() => void>();

function current(): ColourLists {
  lists ??= read();
  return lists;
}

function publish(next: ColourLists): void {
  lists = next;
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent): void {
  if (event.key === SAVED_COLOURS_KEY || event.key === RECENT_COLOURS_KEY || event.key === null) {
    publish(read());
  }
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

/** The saved and recent colours, live. */
export function useColourLists(): ColourLists {
  return useSyncExternalStore(subscribe, current, current);
}

export function savedColours(): readonly string[] {
  return current().saved;
}

export function recentColours(): readonly string[] {
  return current().recent;
}

export type AddResult = 'added' | 'exists' | 'full' | 'invalid';

/** Saves a colour at the end of the list. */
export function addSavedColour(colour: string): AddResult {
  const hex = parseHex(colour);
  if (!hex) return 'invalid';
  const { saved, recent } = current();
  if (saved.includes(hex)) return 'exists';
  if (saved.length >= SAVED_MAX) return 'full';
  const next = [...saved, hex];
  writeJson(SAVED_COLOURS_KEY, next);
  publish({ saved: next, recent });
  return 'added';
}

/** Removes a saved colour (no-op when it is not saved). */
export function removeSavedColour(colour: string): void {
  const hex = parseHex(colour);
  const { saved, recent } = current();
  if (!hex || !saved.includes(hex)) return;
  const next = saved.filter((c) => c !== hex);
  writeJson(SAVED_COLOURS_KEY, next);
  publish({ saved: next, recent });
}

/** Records a colour the panel committed: first in the recents, at most six. */
export function noteRecentColour(colour: string): void {
  const hex = parseHex(colour);
  if (!hex) return;
  const { saved, recent } = current();
  if (recent[0] === hex) return;
  const next = [hex, ...recent.filter((c) => c !== hex)].slice(0, RECENT_MAX);
  writeJson(RECENT_COLOURS_KEY, next);
  publish({ saved, recent: next });
}

/** Forgets the cached lists so the next read comes from storage (tests). */
export function reloadColourLists(): void {
  publish(read());
}
