/**
 * The phone's ink presets (`design/phone-2026-10/README.md` §3 row 2: "three colour swatches
 * and three sizes; presets, never a picker"), on the full edition's pen presets
 * (`annotations/pen/presets.ts`), so a phone and a computer draw with the same inks:
 *
 * - **Pen:** the colours are the three writing pens (presets 0–2: black, blue and red by
 *   default); a colour arms its preset, and a size sets the armed preset's width. Each pen
 *   keeps its own width, as on the desktop.
 * - **Highlight:** the Highlighter preset (the fourth); a colour is one of three tints (yellow,
 *   green, pink) and a size its width.
 *
 * Pure: the drawer's options (`InkOptions.tsx`) and the tool specs (`tools.tsx`) apply them.
 */
import {
  isHighlighter,
  type PenSettings,
  PRESET_INDICES,
  type PresetIndex,
} from '../../../annotations/pen/presets';
import { TINT } from '../../../annotations/palette';

/** The pen's three widths, points: fine, medium, bold. */
export const PEN_SIZES = [1, 2, 4] as const;
/** The Highlighter's three widths, points (within its 6–18 pt range). */
export const HIGHLIGHTER_SIZES = [8, 12, 18] as const;
/** The Highlighter's three tints. */
export const HIGHLIGHTER_TINTS = [TINT.yellow, TINT.green, TINT.pink] as const;

/** The writing pens' presets, at most three, in preset order. */
export function writingSlots(pen: PenSettings): PresetIndex[] {
  return PRESET_INDICES.filter((i) => !isHighlighter(pen.presets[i])).slice(0, 3);
}

/** The Highlighter's preset, if one is set. */
export function highlighterSlot(pen: PenSettings): PresetIndex | undefined {
  return PRESET_INDICES.find((i) => isHighlighter(pen.presets[i]));
}

/**
 * The writing pen Pen arms: the armed preset when it is a pen, else `lastPen` when that is a
 * pen, else the first pen (as the full edition's P, `annotations/commands.ts`).
 */
export function penToArm(pen: PenSettings, lastPen: PresetIndex): PresetIndex {
  if (!isHighlighter(pen.presets[pen.active])) return pen.active;
  if (!isHighlighter(pen.presets[lastPen])) return lastPen;
  return writingSlots(pen)[0] ?? pen.active;
}

/** The index of the size nearest `width` in `sizes`. */
export function nearestSize(width: number, sizes: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < sizes.length; i++) {
    if (Math.abs((sizes[i] ?? 0) - width) < Math.abs((sizes[best] ?? 0) - width)) best = i;
  }
  return best;
}
