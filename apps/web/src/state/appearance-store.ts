/**
 * Appearance settings (language.md §2.8, §7.6; ADR-0024 §2.4; spec D3-3, D3-4; components/
 * 07-sheets.md S3): **Glass: Clear · Tinted · Solid** and **Reduce motion: System · On**.
 *
 * - Glass replaces M8's "Glass panels" and "Reduce transparency" switches. Until the person
 *   picks one it is `null` and the start state applies (`render-quality.ts`: Tinted on a
 *   software rasteriser, else Clear); the system's `prefers-reduced-transparency` forces Solid
 *   whatever is picked (`materials.css` and `tokens.css` read the media query, and the Settings
 *   row says "Solid, set by your system"). The old switches migrate once: Reduce transparency
 *   on becomes Solid; Glass panels has no successor (docked glass is the default, ADR-0024
 *   §2.8).
 * - Reduce motion: System follows `prefers-reduced-motion`, On reduces motion whatever the
 *   system says.
 *
 * Persisted in `pdf-editor:appearance:v1`, validated field by field. The settings reach CSS as
 * attributes on the document element, applied by `useAppearanceRoot`: `data-glass` (the
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

export type { GlassSetting } from './render-quality';

export const APPEARANCE_STORAGE_KEY = 'pdf-editor:appearance:v1';

/** Reduce motion (language.md §7.6): follow the system, or reduce it here. */
export type MotionSetting = 'system' | 'reduced';

export interface AppearanceSettings {
  /** The person's Glass choice; `null` until they make one (the start state applies). */
  readonly glass: GlassSetting | null;
  readonly motion: MotionSetting;
}

export const DEFAULT_APPEARANCE: AppearanceSettings = { glass: null, motion: 'system' };

const GLASS_SETTINGS: readonly GlassSetting[] = ['clear', 'tinted', 'solid'];

interface AppearanceState extends AppearanceSettings {
  setGlass(glass: GlassSetting): void;
  setMotion(motion: MotionSetting): void;
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
  return { glass, motion: record.motion === 'reduced' ? 'reduced' : DEFAULT_APPEARANCE.motion };
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
  setGlass: (glass) => set({ glass }),
  setMotion: (motion) => set({ motion }),
}));

useAppearanceStore.subscribe((state, previous) => {
  if (state.glass === previous.glass && state.motion === previous.motion) return;
  const settings: AppearanceSettings = { glass: state.glass, motion: state.motion };
  writeJson(APPEARANCE_STORAGE_KEY, settings);
});

/** The Glass setting in force: the person's choice, else the start state. */
export function effectiveGlass(glass: GlassSetting | null): GlassSetting {
  return glass ?? startGlass();
}

/** Writes the settings onto `root` as the attributes the style sheets read. */
export function applyAppearance(root: HTMLElement, settings: AppearanceSettings): void {
  root.setAttribute('data-glass', effectiveGlass(settings.glass));
  if (settings.motion === 'reduced') root.setAttribute('data-motion', 'reduced');
  else root.removeAttribute('data-motion');
}

/** Removes what `applyAppearance` and the ladder wrote. */
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
  const glass = useAppearanceStore((s) => s.glass);
  const motion = useAppearanceStore((s) => s.motion);
  const degrade = useRenderQualityStore((s) => s.degrade);
  useLayoutEffect(() => {
    ensureDegradeStart();
    return startCostLadder();
  }, []);
  useLayoutEffect(() => {
    const root = document.documentElement;
    applyAppearance(root, { glass, motion });
    applyDegrade(root, degrade);
    return () => clearAppearance(root);
  }, [glass, motion, degrade]);
}
