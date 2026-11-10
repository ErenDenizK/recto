/**
 * The Recto mark in the app (docs/brand/README.md "The mark: files and usage"; brand plan §6):
 * inline SVG from `mark.ts`, cropped to the mark's own square so it fills its box like an icon.
 *
 * - `gradient` and `auto` (default): the mark's teal → mint → lime gradient, on the dark ground
 *   that is the only one (PRD-42). The ◆ Library button and the Library's brand header use it.
 * - `mono`: one fill in `currentColor`, so it takes its control's ink.
 *
 * Decorative: `aria-hidden`, never focusable; the control or the wordmark beside it names it.
 */
import { useId } from 'react';

import styles from './BrandMark.module.css';
import { MARK_GRADIENT, MARK_PATHS, MARK_VIEWBOX } from './mark';

function Ramp({ id, gradient }: { readonly id: string; readonly gradient: typeof MARK_GRADIENT }) {
  return (
    <linearGradient
      id={id}
      x1={gradient.x1}
      y1={gradient.y1}
      x2={gradient.x2}
      y2={gradient.y2}
      gradientUnits="userSpaceOnUse"
    >
      {gradient.stops.map((stop) => (
        <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
      ))}
    </linearGradient>
  );
}

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
          <Ramp id={id} gradient={MARK_GRADIENT} />
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
