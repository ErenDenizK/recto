/**
 * The Recto mark in the app (docs/brand/README.md "The mark: files and usage"; brand plan §6):
 * inline SVG from `mark.ts`, cropped to the mark's own square so it fills its box like an icon.
 *
 * - `gradient`: the mark's mint → lime → yellow-lime gradient, on dark only (it is too light
 *   to read on a light canvas).
 * - `mono`: one fill in `currentColor`, so it takes its control's ink.
 * - `auto` (default): the gradient in the dark theme, mono in the light one. The ◆ Library button
 *   and the Library's brand header use it.
 *
 * Decorative: `aria-hidden`, never focusable; the control or the wordmark beside it names it.
 */
import { useId } from 'react';

import styles from './BrandMark.module.css';
import { MARK_GRADIENT, MARK_PATHS, MARK_VIEWBOX } from './mark';

export type BrandMarkTone = 'auto' | 'gradient' | 'mono';

export function BrandMark({
  size = 20,
  tone = 'auto',
  className,
}: {
  /** The square box in CSS px. */
  readonly size?: number;
  readonly tone?: BrandMarkTone;
  readonly className?: string | undefined;
}) {
  // A document-unique id: one page can draw the mark several times (strip, header, sheets).
  const id = `recto-mark-${useId().replace(/[^\w-]/g, '')}`;
  const classes = [styles.mark, className].filter(Boolean).join(' ');
  return (
    <svg
      className={classes}
      width={size}
      height={size}
      viewBox={MARK_VIEWBOX}
      aria-hidden="true"
      focusable="false"
      data-tone={tone}
    >
      {tone === 'mono' ? null : (
        <defs>
          <linearGradient
            id={id}
            x1={MARK_GRADIENT.x1}
            y1={MARK_GRADIENT.y1}
            x2={MARK_GRADIENT.x2}
            y2={MARK_GRADIENT.y2}
            gradientUnits="userSpaceOnUse"
          >
            {MARK_GRADIENT.stops.map((stop) => (
              <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
            ))}
          </linearGradient>
        </defs>
      )}
      <g className={styles.fill} fill={tone === 'mono' ? 'currentColor' : `url(#${id})`}>
        {MARK_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
