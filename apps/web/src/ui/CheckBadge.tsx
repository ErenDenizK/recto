/**
 * The check badge on a thumbnail (06-navigation §2.2, PG4; 02-library L5; owner feedback F4,
 * the Photos look): a 22 px circle (26 coarse) that sits inside the page's corner, never over
 * its edge. Empty, a 1.5 px white ring between two dark hairlines over a faint scrim, so it
 * reads as an empty control on a white page and on a dark scan alike, never as a grey stain
 * (system-audit-2026-10 §3.8, I-32); checked, the app's lime with an ink tick and rim (G7).
 *
 * Its place, its visibility and its hit area belong to the thumbnail that holds it (the Pages
 * grid's cell, the Library's card); the item carries the state (`aria-selected`), so the badge is
 * `aria-hidden`.
 */
import { type ComponentPropsWithoutRef, useState } from 'react';

import styles from './CheckBadge.module.css';
import { Icon } from './Icon';

interface CheckBadgeProps extends Omit<ComponentPropsWithoutRef<'span'>, 'children'> {
  readonly checked: boolean;
}

export function CheckBadge({ checked, className, ...rest }: CheckBadgeProps) {
  // The tick grows in when the badge turns on while it is shown, not when a virtualised grid
  // mounts a cell that was already selected (plan E6a): scrolling back to a selected page
  // finds its badge in place, still.
  const [canPop, setCanPop] = useState(!checked);
  if (!checked && !canPop) setCanPop(true);
  return (
    <span
      {...rest}
      className={className ? `${styles.badge} ${className}` : styles.badge}
      data-checked={checked || undefined}
      data-pop={(checked && canPop) || undefined}
      aria-hidden="true"
    >
      {checked ? <Icon name="check-fat" filled className={styles.glyph} /> : null}
    </span>
  );
}
