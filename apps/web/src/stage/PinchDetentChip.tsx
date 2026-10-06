/**
 * The pinch detent chip (05-canvas §4, spec 05.11): "Release to see all pages" while a pinch
 * below fit page would open the Pages grid on release. Decorative for assistive technology
 * (`aria-hidden`: the grid announces itself when it opens). The canvas zoom
 * (`use-canvas-zoom.ts`) shows, places and fades it by attributes and `transform`, never by a
 * render, so a pinch's frames lay nothing out; see the CSS module for the material.
 */
import { LayoutGrid } from 'lucide-react';
import type { Ref } from 'react';

import { m } from '../i18n';
import styles from './PinchDetentChip.module.css';

export function PinchDetentChip({ ref }: { readonly ref: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className={styles.chip} data-testid="pinch-detent-chip" aria-hidden hidden>
      <LayoutGrid className={styles.icon} aria-hidden="true" />
      {m.zoom_grid_chip()}
    </div>
  );
}
