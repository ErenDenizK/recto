/**
 * The default colour of a new text box by the page under it (TXT-23): the ink black on a
 * light page, white on a dark one, so a box placed on a dark cover is not black on black.
 * Only a colour the person has not chosen is picked this way (`explicitTextColor`); the
 * page pixels are the rendered bitmap's (`viewer/page-pixels.ts`), the same the eyedropper reads.
 */
import { samplePagePixels } from '../viewer/page-pixels';
import { DEFAULT_STYLES } from './annotation-store';
import { contrastRatio, hexRgb, INK, type Rgb, WHITE } from './palette';

/** The light default for a dark page. */
export const LIGHT_TEXT = '#FFFFFF';

/** The text colour that reads better on a page of mean colour `under`; ties keep the ink black. */
export function textColorOn(under: Rgb): string {
  return contrastRatio(WHITE, under) > contrastRatio(hexRgb(INK.black), under)
    ? LIGHT_TEXT
    : INK.black;
}

/** Whether the text style's colour is the person's: picked this session, or not the default. */
export function explicitTextColor(chosen: boolean, color: string): boolean {
  return chosen || color.toUpperCase() !== DEFAULT_STYLES.text.color.toUpperCase();
}

/**
 * The mean colour of the opaque rendered pixels in a client box (a 5 × 3 grid of small
 * squares); null where no bitmap is drawn there.
 */
export function pageColorUnder(box: {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}): Rgb | null {
  const sum = [0, 0, 0];
  let n = 0;
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 3; j++) {
      const x = box.left + (box.width * (i + 0.5)) / 5;
      const y = box.top + (box.height * (j + 0.5)) / 3;
      const block = samplePagePixels(x, y, 5);
      if (!block) continue;
      for (let k = 0; k < block.data.length; k += 4) {
        if ((block.data[k + 3] ?? 0) === 0) continue;
        sum[0] = (sum[0] ?? 0) + (block.data[k] ?? 0);
        sum[1] = (sum[1] ?? 0) + (block.data[k + 1] ?? 0);
        sum[2] = (sum[2] ?? 0) + (block.data[k + 2] ?? 0);
        n++;
      }
    }
  }
  return n === 0 ? null : [(sum[0] ?? 0) / n, (sum[1] ?? 0) / n, (sum[2] ?? 0) / n];
}
