/**
 * The check badge on a thumbnail (06-navigation §2.2, PG4; 02-library L5; owner feedback F4,
 * the Photos look): a 22 px circle (26 coarse) that sits inside the page's corner, never over
 * its edge. Empty, a white rim over a light scrim with a soft shadow, legible on a white page
 * and on a dark scan alike; checked, filled `--select` with a white tick: the blue of every
 * selection mark on a page, since the badge sits on the page.
 *
 * Its place, its visibility and its hit area belong to the thumbnail that holds it (the Pages
 * grid's cell, the Library's card); the item carries the state (`aria-selected`), so the badge is
 * `aria-hidden`.
 */
import type { ComponentPropsWithoutRef } from 'react';

import styles from './CheckBadge.module.css';
import { Icon } from './Icon';

interface CheckBadgeProps extends Omit<ComponentPropsWithoutRef<'span'>, 'children'> {
  readonly checked: boolean;
}

export function CheckBadge({ checked, className, ...rest }: CheckBadgeProps) {
  return (
    <span
      {...rest}
      className={className ? `${styles.badge} ${className}` : styles.badge}
      data-checked={checked || undefined}
      aria-hidden="true"
    >
      {checked ? <Icon name="check" className={styles.glyph} /> : null}
    </span>
  );
}
