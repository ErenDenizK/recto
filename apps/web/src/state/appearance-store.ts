/**
 * Appearance settings (language.md §2.8, §7.6; ADR-0022 §2.4; ADR-0024 §2.4; spec D3-3, D3-4,
 * D3-7; components/07-sheets.md S3): **Theme: System · Light · Dark**, **Glass: Clear · Tinted ·
 * Solid**, **Reduce motion: System · On** and **Background glow** (on by default).
 *
 * - Theme: System follows the device's light or dark scheme, live; Light and Dark hold whatever
 *   the device says. Resolved and written by `theme.ts` (the boot script `public/theme.js` does
 *   the same before the first paint).
 * - Glass replaces M8's "Glass panels" and "Reduce transparency" switches. Until the person
 *   picks one it is `null` and the start state applies (`render-quality.ts`: Tinted on a
 *   software rasteriser, else Clear); the system's `prefers-reduced-transparency` forces Solid
 *   whatever is picked (`materials.css` and `tokens.css` read the media query, and the Settings
 *   row says "Solid, set by your system"). The old switches migrate once: Reduce transparency
 *   on becomes Solid; Glass panels has no successor (docked glass is the default, ADR-0024
 *   §2.8).
 * - Reduce motion: System follows `prefers-reduced-motion`, On reduces motion whatever the
 *   system says.
 * - Background glow (owner feedback 2026-10-09, G5, and the owner's decision that it starts on):
 *   the Library's aura, dimmer, behind the reader's canvas (`home/Aura.tsx`, shown by the app
 *   shell in the page view). On unless the stored value is `false`.
 *
 * Persisted in `pdf-editor:appearance:v1`, validated field by field. The settings reach CSS as
 * attributes on the document element, applied by `useAppearanceRoot`: `data-theme` (the theme
 * in force, `light` or `dark`, kept after unmount: the boot script owns it from the first
 * paint), `data-glass` (the
 * setting in force: `clear`, `tinted` or `solid`), `data-degrade` (the cost ladder's step,
 * absent at 0) and `data-motion="reduced"` (`motion.css`, matched by the same blocks as the
 * media query; `reducedMotion()` reads it for script).
 */
import { useLayoutEffect } from 'react';
import { create } from 'zustand';

import {
  applyDegrade,
  ensureDegradeStart,
  type GlassSetting,
  startCostLadder,
  startGlass,
  useRenderQualityStore,
} from './render-quality';
import { readJson, writeJson } from './safe-storage';
import { applyTheme, subscribeSystemTheme, THEME_SETTINGS, type ThemeSetting } from './theme';

export type { GlassSetting } from './render-quality';
export type { Theme, ThemeSetting } from './theme';

export const APPEARANCE_STORAGE_KEY = 'pdf-editor:appearance:v1';

/** Reduce motion (language.md §7.6): follow the system, or reduce it here. */
export type MotionSetting = 'system' | 'reduced';

export interface AppearanceSettings {
  /** System · Light · Dark (ADR-0022 §2.4); System until a choice is made. */
  readonly theme: ThemeSetting;
  /** The person's Glass choice; `null` until they make one (the start state applies). */
  readonly glass: GlassSetting | null;
  readonly motion: MotionSetting;
  /** The aura behind the reader's canvas (G5); on by default. */
  readonly glow: boolean;
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'system',
  glass: null,
  motion: 'system',
  glow: true,
};

const GLASS_SETTINGS: readonly GlassSetting[] = ['clear', 'tinted', 'solid'];

interface AppearanceState extends AppearanceSettings {
  setTheme(theme: ThemeSetting): void;
  setGlass(glass: GlassSetting): void;
  setMotion(motion: MotionSetting): void;
  setGlow(glow: boolean): void;
}

/**
 * Stored settings, field by field: a Glass value that is not one of the three is unset, except
 * that M8's `reduceTransparency: true` reads as Solid (the one migration, ADR-0024 §2.4).
 */
export function parseAppearance(value: unknown): AppearanceSettings {
  const record =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const stored = record.glass;
  const glass = GLASS_SETTINGS.includes(stored as GlassSetting)
    ? (stored as GlassSetting)
    : record.reduceTransparency === true
      ? 'solid'
      : null;
  const theme = THEME_SETTINGS.includes(record.theme as ThemeSetting)
    ? (record.theme as ThemeSetting)
    : DEFAULT_APPEARANCE.theme;
  return {
    theme,
    glass,
    motion: record.motion === 'reduced' ? 'reduced' : DEFAULT_APPEARANCE.motion,
    glow: typeof record.glow === 'boolean' ? record.glow : DEFAULT_APPEARANCE.glow,
  };
}

/** Whether a stored value still has M8's switches (migrated on load, once). */
function isLegacy(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('glassPanels' in value || 'reduceTransparency' in value)
  );
}

export function loadAppearance(): AppearanceSettings {
  const stored = readJson(APPEARANCE_STORAGE_KEY);
  const settings = parseAppearance(stored);
  if (isLegacy(stored)) writeJson(APPEARANCE_STORAGE_KEY, settings);
  return settings;
}

export const useAppearanceStore = create<AppearanceState>()((set) => ({
  ...loadAppearance(),
  setTheme: (theme) => set({ theme }),
  setGlass: (glass) => set({ glass }),
  setMotion: (motion) => set({ motion }),
  setGlow: (glow) => set({ glow }),
}));

useAppearanceStore.subscribe((state, previous) => {
  if (
    state.theme === previous.theme &&
    state.glass === previous.glass &&
    state.motion === previous.motion &&
    state.glow === previous.glow
  ) {
    return;
  }
  const settings: AppearanceSettings = {
    theme: state.theme,
    glass: state.glass,
    motion: state.motion,
    glow: state.glow,
  };
  writeJson(APPEARANCE_STORAGE_KEY, settings);
});

/** The Glass setting in force: the person's choice, else the start state. */
export function effectiveGlass(glass: GlassSetting | null): GlassSetting {
  return glass ?? startGlass();
}

/** Writes the settings onto `root` as the attributes the style sheets read. */
export function applyAppearance(
  root: HTMLElement,
  settings: Pick<AppearanceSettings, 'theme' | 'glass' | 'motion'>,
): void {
  applyTheme(root, settings.theme);
  root.setAttribute('data-glass', effectiveGlass(settings.glass));
  if (settings.motion === 'reduced') root.setAttribute('data-motion', 'reduced');
  else root.removeAttribute('data-motion');
}

/** Removes what `applyAppearance` and the ladder wrote, except the theme (see above). */
function clearAppearance(root: HTMLElement): void {
  root.removeAttribute('data-glass');
  root.removeAttribute('data-motion');
  root.removeAttribute('data-degrade');
}

/**
 * Keeps the document element's attributes in step with the settings and the cost ladder while
 * the caller is mounted (the app shell, the compact reader); before the first paint, so the
 * frame never flashes. It also runs the ladder's frame monitor for as long.
 */
export function useAppearanceRoot(): void {
  const theme = useAppearanceStore((s) => s.theme);
  const glass = useAppearanceStore((s) => s.glass);
  const motion = useAppearanceStore((s) => s.motion);
  const degrade = useRenderQualityStore((s) => s.degrade);
  useLayoutEffect(() => {
    ensureDegradeStart();
    return startCostLadder();
  }, []);
  useLayoutEffect(() => {
    const root = document.documentElement;
    applyAppearance(root, { theme, glass, motion });
    applyDegrade(root, degrade);
    return () => clearAppearance(root);
  }, [theme, glass, motion, degrade]);
  // System follows the device while the app runs.
  useLayoutEffect(() => {
    if (theme !== 'system') return;
    return subscribeSystemTheme(() => applyTheme(document.documentElement, 'system'));
  }, [theme]);
}
