/**
 * The lab's settings: the tier, the backdrop and the sliders. One object, read by every module;
 * `main.ts` writes it from the panel (and from `window.__glassLab` for the measuring script).
 */
import type { BackdropKind, Theme } from './backdrop';

/**
 * The tiers (docs/research/23-liquid-glass-lab.md §5): `current` is materials.css as it ships;
 * T0 CSS only (every engine); T1 T0 plus an SVG displacement lens (Chromium); T2 WebGL2.
 */
export type Tier = 'current' | 't0' | 't1' | 't2';

export interface LabState {
  tier: Tier;
  theme: Theme;
  backdrop: BackdropKind;
  /** Blur σ of a bar, CSS px; chips, menus and capsules scale it (KIND_SIGMA). */
  blur: number;
  /** Bezel width, CSS px. */
  bezel: number;
  /** Refraction, 0–1.5: the ray's depth through the glass, 80 px at 1 (ior 1.5). */
  refraction: number;
  /** Rim specular, 0–1. */
  spec: number;
  /** Tint alpha as a multiple of the tier token's (1 = materials.css). */
  tint: number;
  /** Dispersion, 0–1. */
  chroma: number;
  /** Smooth-union distance for merges, CSS px. */
  k: number;
  /** Light direction, degrees; 0 is up, −45 is the top left. */
  light: number;
  autoScroll: boolean;
  edge: boolean;
  shadow: boolean;
  /**
   * The adaptive look (iOS 26: small controls turn light over white paper and dark over a dark
   * page). A taste question for the owner (research 16 kept "no adaptive tint"); off by default.
   */
  adaptive: boolean;
}

export const state: LabState = {
  tier: 't0',
  theme: 'dark',
  backdrop: 'paper',
  blur: 6,
  bezel: 16,
  refraction: 0.75,
  spec: 0.7,
  tint: 1,
  chroma: 0,
  k: 26,
  light: -45,
  autoScroll: false,
  edge: true,
  shadow: true,
  adaptive: false,
};

/** The depth the refracted ray travels, CSS px, and the largest pull. */
export const depth = (): number => state.refraction * 80;
export const MAX_PULL = 28;
export const IOR = 1.5;
