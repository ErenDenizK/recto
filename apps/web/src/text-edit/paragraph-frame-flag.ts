/**
 * Whether the open paragraph's frame controls are on (TXT-24, behind the Labs toggle
 * `paragraph-frame` or `?paraframe=1`): the border band and grip that move the paragraph, the
 * side bars that change its width, and the keyboard nudge. Off, the editor is what it was.
 */
import { labsStored } from '../labs/stored';

/** The address parameter that turns the frame controls on (`?paraframe=1`). */
export const PARAGRAPH_FRAME_PARAM = 'paraframe';

// Read once, when the module loads, as `textpre` is: turning the flag on or off takes a reload.
const flagged = (() => {
  try {
    const asked = new URLSearchParams(location.search).get(PARAGRAPH_FRAME_PARAM);
    return asked === null ? labsStored('paragraph-frame', null) === '1' : asked === '1';
  } catch {
    return false;
  }
})();
let override: boolean | null = null;

/** Whether the frame controls are on (the address, else the Labs toggle). */
export function paragraphFrameEnabled(): boolean {
  return override ?? flagged;
}

/** Tests only: turns the flag on or off (null: back to the address). */
export function setParagraphFrameForTests(on: boolean | null): void {
  override = on;
}
