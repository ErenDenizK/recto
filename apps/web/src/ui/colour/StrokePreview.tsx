/**
 * The colour panel's live stroke preview (`10-ink.md` §4.1): one stroke on paper white, at
 * the preset's width and opacity, at 100 % zoom.
 *
 * The outline is the ink pipeline's own: `inkOutlineOps` (`@pdf-editor/engine/ink-outline`),
 * the function the live preview canvas fills (`annotations/pen/ink-preview.ts`) and the
 * engine writes into the PDF, so the preview has the stroke's real shape, joins and caps.
 * It is drawn as one SVG path rather than on a canvas: the panel's preview is static between
 * changes and an SVG stays sharp at every device pixel ratio without a redraw. A pen draws an
 * S-curve; the Highlighter draws a straight stroke over a line of grey "text", with
 * Multiply, so the blend that keeps text readable shows.
 */
import { inkOutlineOps } from '@pdf-editor/engine/ink-outline';

import { m } from '../../i18n';
import { cssRgba } from './colour-math';
import styles from './ColourPanel.module.css';

/** CSS px per point at 100 % zoom. */
const PX_PER_PT = 96 / 72;
const HEIGHT = 56;

export interface StrokePreviewProps {
  /** `#RRGGBB`. */
  readonly colour: string;
  /** 0–1. */
  readonly opacity: number;
  /** Nominal width, points. */
  readonly width: number;
  readonly kind: 'pen' | 'highlighter';
  /** The preview's width in CSS px. */
  readonly size: number;
}

/** PDF path operators (`m l c h`) as an SVG path. */
export function opsToSvgPath(ops: string): string {
  const out: string[] = [];
  const args: string[] = [];
  for (const token of ops.split(/\s+/)) {
    if (token === '') continue;
    switch (token) {
      case 'm':
        out.push(`M${args.join(' ')}`);
        break;
      case 'l':
        out.push(`L${args.join(' ')}`);
        break;
      case 'c':
        out.push(`C${args.join(' ')}`);
        break;
      case 'h':
        out.push('Z');
        break;
      default:
        args.push(token);
        continue;
    }
    args.length = 0;
  }
  return out.join('');
}

/** Points along a cubic Bézier. */
function bezier(
  p0: readonly [number, number],
  p1: readonly [number, number],
  p2: readonly [number, number],
  p3: readonly [number, number],
  steps: number,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    points.push({
      x: a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
      y: a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    });
  }
  return points;
}

/** The preview's centre line for a box `size` px wide. */
function centreLine(kind: 'pen' | 'highlighter', size: number, w: number) {
  const left = Math.max(16, w / 2 + 8);
  const right = size - left;
  if (kind === 'highlighter') {
    return bezier([left, 30], [left + size * 0.3, 27], [right - size * 0.3, 31], [right, 28], 24);
  }
  const span = right - left;
  return bezier([left, 38], [left + span * 0.32, -4], [left + span * 0.62, 64], [right, 16], 48);
}

export function StrokePreview({ colour, opacity, width, kind, size }: StrokePreviewProps) {
  const w = Math.max(0.5, width * PX_PER_PT);
  const points = centreLine(kind, size, w);
  const d = opsToSvgPath(
    inkOutlineOps(
      points,
      points.map(() => w),
    ),
  );
  return (
    <div className={styles.preview} role="img" aria-label={m.colour_preview()}>
      <svg
        className={styles.previewArt}
        viewBox={`0 0 ${size} ${HEIGHT}`}
        width={size}
        height={HEIGHT}
        aria-hidden="true"
        focusable="false"
      >
        {kind === 'highlighter' ? (
          <g className={styles.previewText}>
            {[
              [20, 46],
              [74, 30],
              [112, 58],
              [178, 40],
              [226, 44],
            ].map(([x = 0, length = 0]) =>
              x + length <= size - 16 ? (
                <rect key={x} x={x} y={24} width={length} height={8} rx={2} />
              ) : null,
            )}
          </g>
        ) : null}
        <path
          d={d}
          fill={cssRgba(colour)}
          fillOpacity={kind === 'highlighter' ? 1 : opacity}
          style={kind === 'highlighter' ? { mixBlendMode: 'multiply' } : undefined}
        />
      </svg>
    </div>
  );
}
