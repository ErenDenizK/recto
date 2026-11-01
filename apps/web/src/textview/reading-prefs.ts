/**
 * How the Text view sets its text (DSN-84, PRD-36): size, line spacing, theme and face, kept on
 * the device in `pdf-editor:textview:v1` and shared by every document. Storage that is blocked
 * or holds something else reads as the defaults, and a write that fails keeps the choice for
 * the session. Whether the view is open is not kept (PRD-36).
 */
import { create } from 'zustand';

import type { ReadingFace, ReadingPrefs, ReadingSpacing, ReadingTheme } from './contract';

export const READING_PREFS_KEY = 'pdf-editor:textview:v1';

/** The seven text sizes in px (DSN-84); a prefs `size` indexes them. */
export const TEXT_SIZES = [15, 16, 18, 20, 22, 25, 28] as const;

export const DEFAULT_PREFS: ReadingPrefs = {
  size: 2,
  spacing: 'normal',
  theme: 'auto',
  face: 'sans',
};

/** Line height per spacing (DSN-84). */
export const LINE_HEIGHTS: Readonly<Record<ReadingSpacing, number>> = {
  tight: 1.35,
  normal: 1.5,
  loose: 1.7,
};

const SPACINGS: readonly ReadingSpacing[] = ['tight', 'normal', 'loose'];
const THEMES: readonly ReadingTheme[] = ['auto', 'light', 'dark'];
const FACES: readonly ReadingFace[] = ['sans', 'serif'];

/** The nearest valid size index; anything that is not a number is the default. */
export function clampSize(size: unknown): number {
  if (typeof size !== 'number' || !Number.isFinite(size)) return DEFAULT_PREFS.size;
  return Math.min(TEXT_SIZES.length - 1, Math.max(0, Math.round(size)));
}

function pick<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.find((item) => item === value) ?? fallback;
}

/** Prefs from stored text: each field that is missing or invalid is the default. */
export function parsePrefs(raw: string | null): ReadingPrefs {
  try {
    const parsed: unknown = JSON.parse(raw ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFS;
    const value = parsed as Record<string, unknown>;
    return {
      size: clampSize(value.size),
      spacing: pick(SPACINGS, value.spacing, DEFAULT_PREFS.spacing),
      theme: pick(THEMES, value.theme, DEFAULT_PREFS.theme),
      face: pick(FACES, value.face, DEFAULT_PREFS.face),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function read(): ReadingPrefs {
  try {
    return parsePrefs(localStorage.getItem(READING_PREFS_KEY));
  } catch {
    return DEFAULT_PREFS;
  }
}

function write(prefs: ReadingPrefs): void {
  try {
    localStorage.setItem(READING_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Blocked or full: the choice lasts for the session.
  }
}

export const useReadingPrefs = create<ReadingPrefs>()(read);

/** Changes some prefs (invalid sizes are clamped) and keeps them. */
export function setReadingPrefs(patch: Partial<ReadingPrefs>): void {
  const next = { ...useReadingPrefs.getState(), ...patch };
  const prefs: ReadingPrefs = { ...next, size: clampSize(next.size) };
  useReadingPrefs.setState(prefs);
  write(prefs);
}

/** One size step larger (+1) or smaller (-1), stopping at the ends. */
export function stepSize(direction: 1 | -1): void {
  setReadingPrefs({ size: useReadingPrefs.getState().size + direction });
}

/** Tests: back to what storage holds (or the defaults when it is empty). */
export function reloadReadingPrefs(): void {
  useReadingPrefs.setState(read(), true);
}
