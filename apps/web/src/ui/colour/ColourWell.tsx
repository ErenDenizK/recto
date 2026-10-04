/**
 * The colour well (`10-ink.md` §2.1): a disc of the current colour inside a conic hue ring,
 * the one rainbow in Recto, which marks "more colours". It opens the colour panel; as a
 * plain button it can be any popover's trigger (`render={<ColourWell … />}`), and it takes
 * the trigger's props and ref.
 *
 * - Fine: a 24 px disc, a 2 px gap and a 2 px ring in a 32 px target; coarse: 28 / 2 / 3 in
 *   44. A translucent colour shows over a checkerboard; a colour that would lose its edge on
 *   the glass gets the swatch's contrast ring (§5).
 * - Its name says the colour: "Colour: Dark blue".
 */
import type { ComponentPropsWithRef, CSSProperties } from 'react';

import { m } from '../../i18n';
import { colourName, cssRgba, needsContrastRing } from './colour-math';
import styles from './ColourWell.module.css';

export interface ColourWellProps
  extends Omit<ComponentPropsWithRef<'button'>, 'children' | 'color'> {
  /** `#RRGGBB`. */
  readonly value: string;
  /** 0–1 (default 1). */
  readonly opacity?: number | undefined;
  /** Accessible name; default "Colour: {name}". */
  readonly label?: string | undefined;
}

export function ColourWell({
  value,
  opacity = 1,
  label,
  className,
  style,
  ...rest
}: ColourWellProps) {
  return (
    <button
      type="button"
      aria-label={label ?? m.colour_well({ name: colourName(value) })}
      className={[styles.well, className].filter(Boolean).join(' ')}
      style={{ ...style, '--well-colour': cssRgba(value, opacity) } as CSSProperties}
      data-ring-dark={needsContrastRing(value, 'dark') ? '' : undefined}
      data-ring-light={needsContrastRing(value, 'light') ? '' : undefined}
      data-translucent={opacity < 1 ? '' : undefined}
      {...rest}
    >
      <span className={styles.ring} aria-hidden="true" />
      <span className={styles.disc} aria-hidden="true" />
    </button>
  );
}
