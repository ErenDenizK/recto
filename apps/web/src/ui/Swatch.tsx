/**
 * One colour choice (`10-ink.md` §5; supersedes `09-primitives` §16): a dot of the colour in
 * a 32 / 44 px target, a `radio` inside a `SwatchGroup`.
 *
 * - **Dot.** 18 px (fine) or 22 px (coarse). A colour whose edge would fall below 3:1 on the
 *   theme's glass (black on dark glass, white on light glass; `needsContrastRing`) gets a
 *   1 px inner contrast ring, white 0.55 on dark and ink 0.55 on light.
 * - **Selected.** The dot shrinks to 14 / 18 px inside a 2 px ring in the primary text colour
 *   (n12, never lime) with a 2 px gap: the armed pen's ring in the palette's pen well, so the
 *   tool row and the ink strip mark a chosen colour alike (owner feedback F3). A ring of the
 *   colour itself (§5's first form) left black on dark glass as an empty grey circle that read
 *   as a second control beside the colour well. `prefers-contrast: more` adds an outer ring.
 * - **Hover** grows the dot 1.08 on the press spring; a press shrinks it to 0.94.
 * - **No fill** (`NO_FILL`): a white dot with a red diagonal, named "No fill".
 * - **Names.** The accessible name is the caller's (`name`, e.g. the palette's "Blue"), else
 *   the nearest colour name in the active language (`colourName`); it is also the tooltip.
 */
import { Radio } from '@base-ui/react/radio';
import type { CSSProperties } from 'react';

import { m } from '../i18n';
import { colourName, needsContrastRing } from './colour/colour-math';
import styles from './Swatch.module.css';
import { Tooltip } from './Tooltip';

/** The value of the "No fill" swatch. */
export const NO_FILL = 'none';

export interface SwatchProps {
  /** `#RRGGBB`, or `NO_FILL`. */
  readonly value: string;
  /** Accessible name and tooltip; default: the colour's nearest name. */
  readonly name?: string | undefined;
  readonly disabled?: boolean | undefined;
  /** Show the name as a tooltip after the delay (default true). */
  readonly tooltip?: boolean | undefined;
  readonly className?: string | undefined;
}

export function swatchName(value: string): string {
  return value === NO_FILL ? m.colour_no_fill() : colourName(value);
}

export function Swatch({ value: raw, name, disabled, tooltip = true, className }: SwatchProps) {
  const none = raw === NO_FILL;
  const value = none ? raw : raw.toUpperCase();
  const label = name ?? swatchName(value);
  const swatch = (
    <Radio.Root
      value={value}
      disabled={disabled}
      aria-label={label}
      className={[styles.swatch, className].filter(Boolean).join(' ')}
      data-none={none ? '' : undefined}
      data-ring-dark={!none && needsContrastRing(value, 'dark') ? '' : undefined}
      data-ring-light={none || needsContrastRing(value, 'light') ? '' : undefined}
      style={none ? undefined : ({ '--swatch': value } as CSSProperties)}
    >
      <span className={styles.ring} aria-hidden="true" />
      <span className={styles.dot} aria-hidden="true" />
    </Radio.Root>
  );
  return tooltip ? (
    <Tooltip label={label} side="top">
      {swatch}
    </Tooltip>
  ) : (
    swatch
  );
}
