/**
 * Compare's arrival (motion-2026-10 viewer.md §7): once a step to a change (the Changes list,
 * the next and previous change keys, the page map strip) has brought its pair of pages into
 * view, the change marks of that row that are current (its changed words, or its changed
 * areas) pulse once: they dim and swell a little and come back, on `--duration-slow`
 * `--ease-standard`, so the eye finds them on both pages at once. Transform and opacity only,
 * nothing left at rest; under reduced motion the dip in opacity alone, in 150 ms.
 */
import { reducedMotion } from '../motion/reduced-motion';
import { duration, EASE } from '../motion/tokens';

/** How far a pulsing mark swells. */
const PULSE_SCALE = 1.08;
/** The lowest opacity of the pulse. */
const PULSE_DIP = 0.3;

/** Pulses the current change marks of `row` in the Compare viewport `viewport`. */
export function pulseChanges(viewport: HTMLElement, row: number): number {
  const marks = viewport.querySelectorAll<HTMLElement>(`[data-row="${row}"] [data-current]`);
  const reduced = reducedMotion();
  for (const mark of marks) {
    if (typeof mark.animate !== 'function') continue;
    mark.animate(
      reduced
        ? [{ opacity: 1 }, { opacity: PULSE_DIP }, { opacity: 1 }]
        : [
            { opacity: 1, transform: 'none' },
            { opacity: PULSE_DIP, transform: `scale(${PULSE_SCALE})` },
            { opacity: 1, transform: 'none' },
          ],
      { duration: duration('slow'), easing: EASE.standard },
    );
  }
  return marks.length;
}
