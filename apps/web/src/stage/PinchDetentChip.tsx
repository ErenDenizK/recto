/**
 * The pinch detent chip (05-canvas §4, spec 05.11): "Release to see all pages" while a pinch
 * below fit page would open the Pages grid on release. Decorative for assistive technology
 * (`aria-hidden`: the grid announces itself when it opens). The canvas zoom
 * (`use-canvas-zoom.ts`) shows, places and fades it by attributes and `transform`, never by a
 * render, so a pinch's frames lay nothing out. An M1 `Surface` (no lens: it moves with the
 * fingers); the CSS module composes the same classes for the coverage registry.
 */
import type { Ref } from 'react';

import { m } from '../i18n';
import { Icon } from '../ui/Icon';
import { Surface } from '../ui/Surface';
import styles from './PinchDetentChip.module.css';

export function PinchDetentChip({ ref }: { readonly ref: Ref<HTMLDivElement> }) {
  return (
    <Surface
      tier="chip"
      sigma={7}
      coarse={8}
      ref={ref}
      className={styles.chip}
      data-testid="pinch-detent-chip"
      aria-hidden
      hidden
    >
      <Icon name="squares-four" className={styles.icon} />
      {m.zoom_grid_chip()}
    </Surface>
  );
}
