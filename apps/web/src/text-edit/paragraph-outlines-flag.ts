/**
 * The paragraph outlines' gate (TXT-25, behind the Labs toggle `paragraph-outlines` or
 * `?paraoutlines=1`): off is today's Edit text exactly. Read once when the module loads, as
 * `paragraph-precompute.ts` reads `textpre`; turning it on or off takes a reload.
 */
import { labsStored } from '../labs/stored';

/** The address parameter that turns the outlines on (`?paraoutlines=1`). */
export const PARAGRAPH_OUTLINES_PARAM = 'paraoutlines';

const flagged = (() => {
  try {
    const asked = new URLSearchParams(location.search).get(PARAGRAPH_OUTLINES_PARAM);
    return asked === null ? labsStored('paragraph-outlines', null) === '1' : asked === '1';
  } catch {
    return false;
  }
})();
let override: boolean | null = null;

/** Whether the outlines are on (the address or the Labs toggle, read once). */
export function paragraphOutlinesEnabled(): boolean {
  return override ?? flagged;
}

/** Tests only: turns the flag on or off (null: back to the address). */
export function setParagraphOutlinesForTests(on: boolean | null): void {
  override = on;
}
