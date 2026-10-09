/**
 * The ink strip's recent colours (`10-ink` §2.1; owner answer to G8, 2026-10-09): per tool,
 * the colours that tool last had, newest first, so the strip offers the way back to them
 * beside the colour well instead of a fixed row of swatches that repeated the dock's pens.
 *
 * - **Per tool.** Each pen preset keeps its own list (`pen:0` … `pen:3`, the Highlighter
 *   included), and so do the text box, the note and the shapes (`text`, `note`, `shape`).
 * - **What goes in.** The colour a tool *leaves*: picking another colour, in the panel or from
 *   the recents, puts the one it had first. The current colour is never shown among them (the
 *   well and the dock's dot already show it), so the strip shows at most `INK_RECENT_SHOWN`.
 * - **Persisted** per device like the pen presets, under `INK_RECENTS_STORAGE_KEY`, through
 *   `state/safe-storage.ts` (a private window keeps them for the session only). What is read
 *   back is validated: unknown tools and anything not `#RRGGBB` are dropped.
 */
import { useSyncExternalStore } from 'react';

import { readJson, writeJson } from '../state/safe-storage';
import { parseHex } from '../ui/colour/colour-math';

export const INK_RECENTS_STORAGE_KEY = 'pdf-editor:ui:ink-recents:v1';
/** Recent colours the strip shows per tool (the current colour left out). */
export const INK_RECENT_SHOWN = 4;
/** Kept per tool: one more than shown, so leaving out the current colour still fills the row. */
const KEPT = INK_RECENT_SHOWN + 1;

/** Whose recents: a pen preset by index, or a style group. */
export type InkRecentKey = `pen:${0 | 1 | 2 | 3}` | 'text' | 'note' | 'shape';

const KEYS: ReadonlySet<string> = new Set([
  'pen:0',
  'pen:1',
  'pen:2',
  'pen:3',
  'text',
  'note',
  'shape',
]);

type Recents = Readonly<Partial<Record<InkRecentKey, readonly string[]>>>;

function parse(value: unknown): Recents {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const out: Partial<Record<InkRecentKey, string[]>> = {};
  for (const [key, list] of Object.entries(value)) {
    if (!KEYS.has(key) || !Array.isArray(list)) continue;
    const colours: string[] = [];
    for (const item of list) {
      const hex = typeof item === 'string' ? parseHex(item) : null;
      if (hex && !colours.includes(hex)) colours.push(hex);
      if (colours.length === KEPT) break;
    }
    out[key as InkRecentKey] = colours;
  }
  return out;
}

let recents: Recents | undefined;
const listeners = new Set<() => void>();

function current(): Recents {
  recents ??= parse(readJson(INK_RECENTS_STORAGE_KEY));
  return recents;
}

function publish(next: Recents): void {
  recents = next;
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent): void {
  if (event.key === INK_RECENTS_STORAGE_KEY || event.key === null) {
    publish(parse(readJson(INK_RECENTS_STORAGE_KEY)));
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

const EMPTY: readonly string[] = [];

/**
 * The four colours the strip shows beside the well (system-audit-2026-10 §3.7, one layout for
 * every tool): the tool's recents, newest first, then `suggested` in order to fill the row.
 * Never its current colour (the well shows it) and never one of the dock's pens (`dock`), which
 * the pens themselves show (owner feedback G8, "repeat?").
 */
export function stripColours(
  list: readonly string[],
  colour: string,
  suggested: readonly string[],
  dock: readonly string[],
): readonly string[] {
  const left = new Set([colour, ...dock].map((hex) => hex.toUpperCase()));
  const out: string[] = [];
  for (const candidate of [...list, ...suggested]) {
    if (out.length === INK_RECENT_SHOWN) break;
    const hex = candidate.toUpperCase();
    if (!left.has(hex) && !out.includes(hex)) out.push(hex);
  }
  return out;
}

/** A tool's stored recents, live (newest first; may hold its current colour). */
export function useInkRecents(key: InkRecentKey): readonly string[] {
  return useSyncExternalStore(
    subscribe,
    () => current()[key] ?? EMPTY,
    () => current()[key] ?? EMPTY,
  );
}

export function inkRecents(key: InkRecentKey): readonly string[] {
  return current()[key] ?? EMPTY;
}

/**
 * The tool `key` leaves `left` for `next`: `left` goes first in its recents and `next` (now
 * the current colour) leaves them. Nothing changes when the two are the same.
 */
export function noteInkLeft(key: InkRecentKey, left: string, next: string): void {
  const from = parseHex(left);
  const to = parseHex(next);
  if (!from || from === to) return;
  const list = inkRecents(key);
  const updated = [from, ...list.filter((c) => c !== from && c !== to)].slice(0, KEPT);
  if (updated.length === list.length && updated.every((c, i) => c === list[i])) return;
  const all = { ...current(), [key]: updated };
  writeJson(INK_RECENTS_STORAGE_KEY, all);
  publish(all);
}

/** Forgets the cached lists so the next read comes from storage (tests). */
export function reloadInkRecents(): void {
  publish(parse(readJson(INK_RECENTS_STORAGE_KEY)));
}
