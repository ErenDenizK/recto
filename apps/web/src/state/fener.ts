/**
 * Fener, the colour system behind the Labs toggle `fener` or `?fener=1` (DSN-88: one theme
 * colour, tinted controls, neutral glass). Off, the root carries no `data-fener` and the app is
 * what `styles/tokens.css` says; on, the root carries `data-fener` and `data-accent`, which
 * `styles/fener.css` turns into the overrides.
 *
 * - **Flag:** read once, when the module loads, as `paragraph-frame-flag.ts` does: the address
 *   (`?fener=1|0`), else the Labs toggle (DSN-82). Turning it on or off takes a reload.
 * - **Preset:** Çivit (`indigo`, the default), Mor (`violet`) or Mavi (`blue`), set in Settings
 *   › Theme colour and kept per device in `pdf-editor:fener:v1` as `{ accent }`; a value that is
 *   none of the three reads as the default.
 *
 * Tiny on purpose: the app shell reads it on every start (the root attributes, the brand mark).
 */
import { create } from 'zustand';

import { labsStored } from '../labs/stored';
import { readJson, writeJson } from './safe-storage';

/** The address parameter that turns Fener on (`?fener=1`) or off (`?fener=0`). */
export const FENER_PARAM = 'fener';

/** The preset a device keeps (`{ accent }`). */
export const FENER_STORAGE_KEY = 'pdf-editor:fener:v1';

/** The presets, in the order Settings lists them: Çivit · Mor · Mavi. */
export const FENER_PRESETS = ['indigo', 'violet', 'blue'] as const;
export type FenerPreset = (typeof FENER_PRESETS)[number];

export const DEFAULT_FENER_PRESET: FenerPreset = 'indigo';

const flagged = (() => {
  try {
    const asked = new URLSearchParams(location.search).get(FENER_PARAM);
    return asked === null ? labsStored('fener', null) === '1' : asked === '1';
  } catch {
    return false;
  }
})();
let override: boolean | null = null;

/** Whether Fener is on for this page: the address, else the Labs toggle, else off. */
export function fenerEnabled(): boolean {
  return override ?? flagged;
}

/** Tests only: turns the flag on or off (null: back to the address). */
export function setFenerForTests(on: boolean | null): void {
  override = on;
}

/** The stored value as a preset; anything else is the default. */
export function parseFenerPreset(value: unknown): FenerPreset {
  const stored =
    typeof value === 'object' && value !== null ? (value as { accent?: unknown }).accent : value;
  return FENER_PRESETS.find((preset) => preset === stored) ?? DEFAULT_FENER_PRESET;
}

interface FenerState {
  readonly accent: FenerPreset;
  setAccent(accent: FenerPreset): void;
}

export const useFenerStore = create<FenerState>()((set) => ({
  accent: parseFenerPreset(readJson(FENER_STORAGE_KEY)),
  setAccent: (accent) => set({ accent }),
}));

useFenerStore.subscribe((state, previous) => {
  if (state.accent !== previous.accent) writeJson(FENER_STORAGE_KEY, { accent: state.accent });
});

/** Writes Fener onto `root` (`data-fener`, `data-accent`), or takes it off when `accent` is null. */
export function applyFener(root: HTMLElement, accent: FenerPreset | null): void {
  if (accent === null) {
    root.removeAttribute('data-fener');
    root.removeAttribute('data-accent');
    return;
  }
  root.setAttribute('data-fener', '');
  root.setAttribute('data-accent', accent);
}
