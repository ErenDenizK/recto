/**
 * The phone's text presets (`design/phone-2026-10/README.md` §3 row 2: "size S/M/L and
 * colour"), on the text style the full edition's text box uses (`annotation-store` `styles.text`).
 * Pure: the drawer's options (`TextOptions.tsx`) and the tool (`text-tool.ts`) apply them.
 */
import { INK } from '../../../annotations/palette';

/** The text field's least font size, CSS px: iOS zooms the page on focus below it. */
export const FIELD_MIN_PX = 16;
/** Small, medium and large, points (the desktop's default is 12). */
export const TEXT_SIZES = [12, 16, 24] as const;
/** The three writing inks, as the pen's (`ink-presets.ts`). */
export const TEXT_COLOURS = [INK.black, INK.blue, INK.red] as const;
/** A tap this close to a text box (CSS px) edits it rather than placing a new one. */
export const BOX_TOUCH_SLOP = 8;
/** A press that moved this far is not a tap, CSS px. */
export const TAP_SLOP = 10;

export interface ClientRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** The last of `boxes` (the topmost) that a tap at (x, y) reaches, with `slop` around each. */
export function boxAt<T extends { readonly rect: ClientRect }>(
  boxes: readonly T[],
  x: number,
  y: number,
  slop: number = BOX_TOUCH_SLOP,
): T | undefined {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const box = boxes[i];
    if (!box) continue;
    const r = box.rect;
    if (x >= r.left - slop && x <= r.right + slop && y >= r.top - slop && y <= r.bottom + slop) {
      return box;
    }
  }
  return undefined;
}
