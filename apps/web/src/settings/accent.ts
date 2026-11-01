/**
 * Theme colour's words and setter (DSN-88), apart from `shell/appearance-commands.ts` so the
 * first load never carries them: only the Settings row (`AccentRow.tsx`) imports this file.
 */
import { m } from '../i18n';
import { announce } from '../shell/announcer';
import { crossFade } from '../shell/appearance-commands';
import { type FenerPreset, useFenerStore } from '../state/fener';

/** Each theme colour's name, for what it announces and the Settings row. */
export const ACCENT_NAME: Record<FenerPreset, () => string> = {
  indigo: () => m.settings_accent_indigo(),
  violet: () => m.settings_accent_violet(),
  blue: () => m.settings_accent_blue(),
};

/** Sets Fener's theme colour as one root cross-fade and announces it ("Theme colour: Violet"). */
export function setAccent(accent: FenerPreset): void {
  crossFade(() => useFenerStore.getState().setAccent(accent));
  announce(m.announce_accent({ name: ACCENT_NAME[accent]() }));
}
