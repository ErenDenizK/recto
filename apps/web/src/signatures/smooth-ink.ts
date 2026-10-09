/**
 * The signature's line, smoothed as the pen smooths its ink (motion-2026-10 forms-compact §2;
 * the pen's curve finish, `annotations/pen/`): the points a pointer reports are joined by
 * quadratic curves through their midpoints, so a fast stroke reads as one curve, not as the
 * straight runs between samples. The pad, the saved plate and the placed image all trace with
 * it, so the signature looks the same in each.
 */

/** Where a trace draws: a canvas context, or `svgPath()`'s string builder. */
export interface PathSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/** Traces one stroke into `sink`: a dot for one point, a curve through the midpoints else. */
export function traceSmooth(sink: PathSink, points: readonly Point[]): void {
  const first = points[0];
  if (!first) return;
  sink.moveTo(first.x, first.y);
  if (points.length === 1) {
    sink.lineTo(first.x + 0.1, first.y);
    return;
  }
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i] as Point;
    const q = points[i + 1] as Point;
    sink.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
  }
  const last = points[points.length - 1] as Point;
  sink.lineTo(last.x, last.y);
}

const r = (n: number) => Math.round(n * 100) / 100;

/** The SVG path data of `strokes`, each a flat [x, y, x, y, …] list, traced smooth. */
export function svgPath(strokes: readonly (readonly number[])[]): string {
  const parts: string[] = [];
  const sink: PathSink = {
    moveTo: (x, y) => parts.push(`M${r(x)} ${r(y)}`),
    lineTo: (x, y) => parts.push(`L${r(x)} ${r(y)}`),
    quadraticCurveTo: (cx, cy, x, y) => parts.push(`Q${r(cx)} ${r(cy)} ${r(x)} ${r(y)}`),
  };
  for (const stroke of strokes) {
    const points: Point[] = [];
    for (let i = 0; i + 1 < stroke.length; i += 2) {
      points.push({ x: stroke[i] as number, y: stroke[i + 1] as number });
    }
    traceSmooth(sink, points);
  }
  return parts.join('');
}
