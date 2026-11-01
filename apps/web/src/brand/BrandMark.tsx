/**
 * The Recto mark in the app (docs/brand/README.md "The mark: files and usage"; brand plan §6):
 * inline SVG from `mark.ts`, cropped to the mark's own square so it fills its box like an icon.
 *
 * - `gradient`: the mark's mint → lime → yellow-lime gradient, for a dark ground.
 * - `mono`: one fill in `currentColor`, so it takes its control's ink.
 * - `auto` (default): the gradient in both themes (system-audit-2026-10 §3.9), the source's on
 *   dark and its deepened twin (`MARK_GRADIENT_LIGHT`) on light, where the source's stops would
 *   fall under 1.3:1. The ◆ Library button and the Library's brand header use it.
 * - With the Labs flag `fener` on (DSN-88) both grounds wear Fener's ramp instead, indigo →
 *   cerulean → green (`MARK_GRADIENT_FENER_LIGHT`, `MARK_GRADIENT_FENER_DARK`).
 *
 * Decorative: `aria-hidden`, never focusable; the control or the wordmark beside it names it.
 */
import { type CSSProperties, useId } from 'react';

import { fenerEnabled } from '../state/fener';
import styles from './BrandMark.module.css';
import {
  MARK_GRADIENT,
  MARK_GRADIENT_FENER_DARK,
  MARK_GRADIENT_FENER_LIGHT,
  MARK_GRADIENT_LIGHT,
  MARK_PATHS,
  MARK_VIEWBOX,
} from './mark';

type Gradient =
  | typeof MARK_GRADIENT
  | typeof MARK_GRADIENT_LIGHT
  | typeof MARK_GRADIENT_FENER_DARK
  | typeof MARK_GRADIENT_FENER_LIGHT;

function Ramp({ id, gradient }: { readonly id: string; readonly gradient: Gradient }) {
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
  // With Fener on (DSN-88) the mark wears its indigo → cerulean → green ramp on both grounds.
  const fener = fenerEnabled();
  const onDark = fener ? MARK_GRADIENT_FENER_DARK : MARK_GRADIENT;
  const onLight = fener ? MARK_GRADIENT_FENER_LIGHT : MARK_GRADIENT_LIGHT;
  // The light twin is drawn for `auto` only; the theme picks it through --mark-light
  // (BrandMark.module.css), so a theme change repaints without a render.
  const style =
    tone === 'auto' ? ({ '--mark-light': `url(#${id}-light)` } as CSSProperties) : undefined;
  return (
    <svg
      className={classes}
      width={size}
      height={size}
      viewBox={MARK_VIEWBOX}
      aria-hidden="true"
      focusable="false"
      data-tone={tone}
      style={style}
    >
      {tone === 'mono' ? null : (
        <defs>
          <Ramp id={id} gradient={onDark} />
          {tone === 'auto' ? <Ramp id={`${id}-light`} gradient={onLight} /> : null}
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
