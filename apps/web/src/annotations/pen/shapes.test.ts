/**
 * Hold to shape (motion-2026-10/ink-shapes.md): the recogniser over a synthetic corpus.
 * Near misses (handwritten letters and words, signatures, scribbles, ticks) never snap; clean
 * and sloppy shapes (lines, rectangles, squares, rotated rectangles, triangles, circles,
 * ellipses, pentagons, hexagons, arrows) snap to the right kind, keep their size and
 * orientation, and snap angles only within 5°.
 */
import { describe, expect, it } from 'vitest';

import type { Point } from '../ink';
import {
  axisAligned,
  outline,
  recognizeShape,
  type ShapeKind,
  snapDelta,
  transformShape,
} from './shapes';

// ---------------------------------------------------------------------------
// The corpus
// ---------------------------------------------------------------------------

/** A seeded PRNG (mulberry32), so the corpus is the same on every run. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Hand {
  /** Per-point jitter (CSS px). */
  readonly jitter?: number;
  /** Low-frequency wobble across the stroke (CSS px). */
  readonly wobble?: number;
  readonly seed?: number;
}

/** A polyline walked at ~2 px steps, as pointer events arrive, with a hand's noise. */
function walk(path: readonly Point[], hand: Hand = {}): Point[] {
  const rnd = random(hand.seed ?? 7);
  const out: Point[] = [];
  let s = 0;
  const total = path.reduce(
    (acc, p, i) => (i === 0 ? 0 : acc + Math.hypot(p.x - path[i - 1]!.x, p.y - path[i - 1]!.y)),
    0,
  );
  const phase = rnd() * 6;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(len / 2));
    const nx = -(b.y - a.y) / (len || 1);
    const ny = (b.x - a.x) / (len || 1);
    for (let k = i === 1 ? 0 : 1; k <= steps; k++) {
      const t = k / steps;
      const u = (s + t * len) / (total || 1);
      const w =
        (hand.wobble ?? 0) * (Math.sin(u * 7 + phase) * 0.7 + Math.sin(u * 17 + phase) * 0.3);
      const j = hand.jitter ?? 0;
      out.push({
        x: a.x + (b.x - a.x) * t + nx * w + (rnd() - 0.5) * 2 * j,
        y: a.y + (b.y - a.y) * t + ny * w + (rnd() - 0.5) * 2 * j,
      });
    }
    s += len;
  }
  return out;
}

/** Catmull–Rom through control points: the shape of a written letter. */
function spline(control: readonly Point[], scale: number, at: Point = { x: 100, y: 100 }): Point[] {
  const pts = control.map((p) => ({ x: at.x + p.x * scale, y: at.y + p.y * scale }));
  const out: Point[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    for (let k = 0; k < 8; k++) {
      const t = k / 8;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/** A hold at the end: the pointer stays where it is, jittering by a pixel. */
function held(points: Point[]): Point[] {
  const last = points[points.length - 1]!;
  return [
    ...points,
    { x: last.x + 0.6, y: last.y - 0.4 },
    { x: last.x - 0.3, y: last.y + 0.5 },
    last,
  ];
}

const rot = (p: Point, c: Point, deg: number): Point => {
  const a = (deg * Math.PI) / 180;
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return {
    x: c.x + dx * Math.cos(a) - dy * Math.sin(a),
    y: c.y + dx * Math.sin(a) + dy * Math.cos(a),
  };
};

/** A closed polygon drawn from vertex `from` (or the middle of its first edge), with overshoot. */
function polygon(
  vertices: readonly Point[],
  hand: Hand,
  options: { fromMiddle?: boolean; overshoot?: number; gap?: number } = {},
): Point[] {
  const v = options.fromMiddle
    ? [
        { x: (vertices[0]!.x + vertices[1]!.x) / 2, y: (vertices[0]!.y + vertices[1]!.y) / 2 },
        ...vertices.slice(1),
        vertices[0]!,
      ]
    : [...vertices];
  const first = v[0]!;
  const second = v[1]!;
  const path = [...v, first];
  if (options.overshoot) {
    path.push({
      x: first.x + (second.x - first.x) * options.overshoot,
      y: first.y + (second.y - first.y) * options.overshoot,
    });
  }
  if (options.gap) {
    const last = path[path.length - 2]!;
    path[path.length - 1] = {
      x: first.x + (last.x - first.x) * options.gap,
      y: first.y + (last.y - first.y) * options.gap,
    };
  }
  return held(walk(path, hand));
}

function rectangle(cx: number, cy: number, w: number, h: number, deg = 0): Point[] {
  const c = { x: cx, y: cy };
  return [
    { x: cx - w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx - w / 2, y: cy + h / 2 },
  ].map((p) => rot(p, c, deg));
}

function regular(n: number, cx: number, cy: number, r: number, deg = -90): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((deg + (360 * i) / n) * Math.PI) / 180;
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return out;
}

function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  deg: number,
  hand: Hand,
  turns = 1,
  start = 0,
): Point[] {
  const out: Point[] = [];
  const n = Math.ceil((Math.PI * (rx + ry) * turns) / 2);
  const c = { x: cx, y: cy };
  for (let i = 0; i <= n; i++) {
    const t = start + (2 * Math.PI * turns * i) / n;
    out.push(rot({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) }, c, deg));
  }
  return held(walk(out, hand));
}

const SLOPPY: Hand = { jitter: 0.8, wobble: 2.5, seed: 3 };
const CLEAN: Hand = { jitter: 0.3, seed: 11 };

/** Letters as written (control points, about 20 units high, y down). */
const LETTERS: Record<string, Point[]> = {
  e: [
    { x: 0, y: 10 },
    { x: 8, y: 8 },
    { x: 16, y: 4 },
    { x: 18, y: -2 },
    { x: 14, y: -8 },
    { x: 8, y: -9 },
    { x: 3, y: -5 },
    { x: 2, y: 2 },
    { x: 6, y: 9 },
    { x: 13, y: 11 },
    { x: 20, y: 8 },
  ],
  o: [
    { x: 10, y: -10 },
    { x: 4, y: -9 },
    { x: 0, y: -3 },
    { x: 2, y: 4 },
    { x: 8, y: 6 },
    { x: 13, y: 2 },
    { x: 13, y: -5 },
    { x: 10, y: -10 },
    { x: 14, y: -11 },
    { x: 22, y: -10 },
  ],
  m: [
    { x: 0, y: 10 },
    { x: 1, y: 0 },
    { x: 3, y: -6 },
    { x: 7, y: -8 },
    { x: 10, y: -4 },
    { x: 10, y: 10 },
    { x: 11, y: 0 },
    { x: 13, y: -6 },
    { x: 17, y: -8 },
    { x: 20, y: -4 },
    { x: 20, y: 10 },
    { x: 22, y: 8 },
  ],
  l: [
    { x: 0, y: 10 },
    { x: 8, y: 0 },
    { x: 12, y: -14 },
    { x: 11, y: -22 },
    { x: 7, y: -22 },
    { x: 5, y: -14 },
    { x: 6, y: 0 },
    { x: 8, y: 10 },
    { x: 13, y: 8 },
  ],
  two: [
    { x: 0, y: -12 },
    { x: 5, y: -17 },
    { x: 11, y: -16 },
    { x: 13, y: -11 },
    { x: 10, y: -4 },
    { x: 4, y: 3 },
    { x: 0, y: 8 },
    { x: 7, y: 8 },
    { x: 15, y: 8 },
  ],
  a: [
    { x: 12, y: -6 },
    { x: 6, y: -8 },
    { x: 1, y: -3 },
    { x: 2, y: 4 },
    { x: 8, y: 4 },
    { x: 12, y: -6 },
    { x: 12, y: 4 },
    { x: 15, y: 6 },
  ],
  tick: [
    { x: 0, y: 0 },
    { x: 6, y: 7 },
    { x: 10, y: 10 },
    { x: 16, y: 0 },
    { x: 24, y: -14 },
  ],
  six: [
    { x: 10, y: -20 },
    { x: 4, y: -12 },
    { x: 0, y: -2 },
    { x: 1, y: 6 },
    { x: 7, y: 9 },
    { x: 12, y: 5 },
    { x: 11, y: -2 },
    { x: 5, y: -3 },
    { x: 1, y: 1 },
  ],
  eight: [
    { x: 10, y: -10 },
    { x: 4, y: -14 },
    { x: 4, y: -19 },
    { x: 10, y: -21 },
    { x: 15, y: -18 },
    { x: 13, y: -12 },
    { x: 5, y: -5 },
    { x: 3, y: 2 },
    { x: 9, y: 6 },
    { x: 15, y: 2 },
    { x: 14, y: -5 },
    { x: 10, y: -10 },
  ],
  s: [
    { x: 12, y: -8 },
    { x: 6, y: -9 },
    { x: 2, y: -6 },
    { x: 4, y: -2 },
    { x: 10, y: 1 },
    { x: 12, y: 5 },
    { x: 7, y: 9 },
    { x: 0, y: 7 },
  ],
  c: [
    { x: 12, y: -6 },
    { x: 7, y: -9 },
    { x: 2, y: -6 },
    { x: 0, y: 0 },
    { x: 3, y: 6 },
    { x: 9, y: 8 },
    { x: 13, y: 5 },
  ],
  d: [
    { x: 12, y: -4 },
    { x: 6, y: -7 },
    { x: 1, y: -3 },
    { x: 2, y: 4 },
    { x: 8, y: 5 },
    { x: 12, y: -2 },
    { x: 13, y: -20 },
    { x: 13, y: 0 },
    { x: 13, y: 6 },
    { x: 16, y: 5 },
  ],
  w: [
    { x: 0, y: -8 },
    { x: 3, y: 8 },
    { x: 7, y: -4 },
    { x: 11, y: 8 },
    { x: 15, y: -8 },
  ],
  z: [
    { x: 0, y: -8 },
    { x: 12, y: -8 },
    { x: 0, y: 8 },
    { x: 12, y: 8 },
  ],
  four: [
    { x: 9, y: -20 },
    { x: 0, y: 2 },
    { x: 14, y: 2 },
    { x: 9, y: 2 },
    { x: 9, y: -8 },
    { x: 9, y: 10 },
  ],
  star: [
    { x: 10, y: -20 },
    { x: 16, y: 8 },
    { x: -8, y: -10 },
    { x: 28, y: -10 },
    { x: 4, y: 8 },
    { x: 10, y: -20 },
  ],
};

/** A word: letters joined in one stroke, `scale` units per letter. */
function word(letters: readonly string[], scale: number): Point[] {
  const out: Point[] = [];
  letters.forEach((l, i) => {
    const pts = spline(LETTERS[l]!, scale, { x: 100 + i * 22 * scale, y: 100 });
    out.push(...pts);
  });
  return out;
}

function signature(seed: number): Point[] {
  const rnd = random(seed);
  const out: Point[] = [];
  const a = 2 + rnd();
  for (let i = 0; i <= 400; i++) {
    const t = (i / 400) * 6 * Math.PI;
    out.push({
      x: 100 + t * 14 + 14 * Math.sin(a * t),
      y: 200 + 22 * Math.sin(1.7 * t) * Math.cos(0.3 * t) - 6 * Math.cos(a * t),
    });
  }
  return held(walk(out, { jitter: 0.5, seed }));
}

function scribble(): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < 14; i++) out.push({ x: 100 + (i % 2) * 60 + i * 3, y: 100 + i * 4 });
  return held(walk(out, { jitter: 0.6, seed: 5 }));
}

interface Case {
  readonly name: string;
  readonly points: Point[];
  readonly strict?: boolean;
}

const NEAR_MISSES: Case[] = [
  ...['e', 'o', 'm', 'l', 'two', 'a', 'six', 'eight', 's', 'c', 'd', 'w', 'z', 'four'].flatMap(
    (l) =>
      [1, 2, 3].map((s) => ({
        name: `"${l}" at ${20 * s} px`,
        points: held(walk(spline(LETTERS[l]!, s), CLEAN)),
      })),
  ),
  ...['e', 'o', 'a'].map((l) => ({
    name: `"${l}" at 40 px after another stroke`,
    points: held(walk(spline(LETTERS[l]!, 2), CLEAN)),
    strict: true,
  })),
  { name: 'star in one stroke', points: held(walk(spline(LETTERS.star!, 4), CLEAN)) },
  { name: 'tick, small', points: held(walk(spline(LETTERS.tick!, 1), CLEAN)) },
  { name: 'tick, large', points: held(walk(spline(LETTERS.tick!, 4), CLEAN)) },
  { name: 'word "mel"', points: held(walk(word(['m', 'e', 'l'], 1.2), CLEAN)) },
  { name: 'word "lame"', points: held(walk(word(['l', 'a', 'm', 'e'], 2), CLEAN)) },
  { name: 'word "oe"', points: held(walk(word(['o', 'e'], 2.5), CLEAN)) },
  { name: 'signature 1', points: signature(1) },
  { name: 'signature 2', points: signature(2) },
  { name: 'signature 3', points: signature(9) },
  { name: 'scribble', points: scribble() },
  {
    name: 'figure of eight',
    points: held(
      walk(
        Array.from({ length: 80 }, (_, i) => {
          const t = (i / 79) * 2 * Math.PI;
          return { x: 200 + 50 * Math.sin(t), y: 200 + 40 * Math.sin(2 * t) };
        }),
        CLEAN,
      ),
    ),
  },
  { name: 'spiral (two laps)', points: ellipse(200, 200, 60, 50, 0, CLEAN, 2.1) },
  {
    name: 'wavy underline',
    points: held(
      walk(
        Array.from({ length: 60 }, (_, i) => ({ x: 100 + i * 4, y: 200 + 6 * Math.sin(i * 0.8) })),
        CLEAN,
      ),
    ),
  },
  {
    name: 'curve (a bow, not a line)',
    points: held(
      walk(
        Array.from({ length: 40 }, (_, i) => ({
          x: 100 + i * 5,
          y: 200 - 30 * Math.sin((i / 39) * Math.PI),
        })),
        CLEAN,
      ),
    ),
  },
  {
    name: 'open "u" shape',
    points: held(
      walk(
        [
          { x: 100, y: 100 },
          { x: 100, y: 200 },
          { x: 200, y: 200 },
          { x: 200, y: 100 },
        ],
        CLEAN,
      ),
    ),
  },
  { name: 'dot-sized circle', points: ellipse(100, 100, 8, 8, 0, CLEAN) },
];

interface ShapeCase extends Case {
  readonly kind: ShapeKind;
}

const SHAPES: ShapeCase[] = [
  {
    name: 'line',
    kind: 'line',
    points: held(
      walk(
        [
          { x: 100, y: 100 },
          { x: 320, y: 160 },
        ],
        CLEAN,
      ),
    ),
  },
  {
    name: 'sloppy line',
    kind: 'line',
    points: held(
      walk(
        [
          { x: 100, y: 100 },
          { x: 320, y: 160 },
        ],
        SLOPPY,
      ),
    ),
  },
  {
    name: 'short line',
    kind: 'line',
    points: held(
      walk(
        [
          { x: 100, y: 100 },
          { x: 140, y: 102 },
        ],
        CLEAN,
      ),
    ),
  },
  { name: 'rectangle', kind: 'rectangle', points: polygon(rectangle(250, 200, 220, 120), CLEAN) },
  {
    name: 'sloppy rectangle, from mid-edge, overshooting',
    kind: 'rectangle',
    points: polygon(rectangle(250, 200, 220, 120, 2), SLOPPY, {
      fromMiddle: true,
      overshoot: 0.15,
    }),
  },
  {
    name: 'rectangle with a gap at the close',
    kind: 'rectangle',
    points: polygon(rectangle(250, 200, 200, 140), SLOPPY, { gap: 0.15 }),
  },
  {
    name: 'rectangle rotated 20°',
    kind: 'rectangle',
    points: polygon(rectangle(250, 200, 200, 110, 20), CLEAN),
  },
  {
    name: 'sloppy rectangle rotated 33°',
    kind: 'rectangle',
    points: polygon(rectangle(250, 200, 200, 110, 33), SLOPPY),
  },
  { name: 'square', kind: 'square', points: polygon(rectangle(250, 200, 150, 150), CLEAN) },
  {
    name: 'sloppy square',
    kind: 'square',
    points: polygon(rectangle(250, 200, 150, 142, -3), SLOPPY),
  },
  {
    name: 'diamond (square at 45°)',
    kind: 'square',
    points: polygon(rectangle(250, 200, 120, 120, 45), CLEAN),
  },
  { name: 'triangle', kind: 'triangle', points: polygon(regular(3, 250, 200, 90), CLEAN) },
  {
    name: 'sloppy triangle',
    kind: 'triangle',
    points: polygon(regular(3, 250, 200, 90, -84), SLOPPY),
  },
  {
    name: 'right triangle',
    kind: 'triangle',
    points: polygon(
      [
        { x: 100, y: 100 },
        { x: 100, y: 260 },
        { x: 300, y: 260 },
      ],
      SLOPPY,
      { overshoot: 0.1 },
    ),
  },
  { name: 'circle', kind: 'circle', points: ellipse(250, 200, 80, 80, 0, CLEAN) },
  { name: 'sloppy circle', kind: 'circle', points: ellipse(250, 200, 80, 76, 10, SLOPPY, 1.08, 1) },
  {
    name: 'circle short of closing',
    kind: 'circle',
    points: ellipse(250, 200, 70, 70, 0, SLOPPY, 0.9, 2),
  },
  { name: 'ellipse', kind: 'ellipse', points: ellipse(250, 200, 120, 60, 0, CLEAN) },
  {
    name: 'ellipse rotated 30°',
    kind: 'ellipse',
    points: ellipse(250, 200, 120, 60, 30, SLOPPY, 1.05),
  },
  { name: 'pentagon', kind: 'pentagon', points: polygon(regular(5, 250, 200, 90), CLEAN) },
  {
    name: 'sloppy pentagon',
    kind: 'pentagon',
    points: polygon(regular(5, 250, 200, 90, -95), SLOPPY),
  },
  { name: 'hexagon', kind: 'hexagon', points: polygon(regular(6, 250, 200, 90, 0), CLEAN) },
  { name: 'sloppy hexagon', kind: 'hexagon', points: polygon(regular(6, 250, 200, 90, 3), SLOPPY) },
  {
    name: 'arrow in one stroke',
    kind: 'arrow',
    points: held(
      walk(
        [
          { x: 100, y: 200 },
          { x: 300, y: 200 },
          { x: 270, y: 180 },
          { x: 300, y: 200 },
          { x: 270, y: 222 },
        ],
        CLEAN,
      ),
    ),
  },
];

// ---------------------------------------------------------------------------
// The corpus results
// ---------------------------------------------------------------------------

describe('near misses never snap', () => {
  for (const c of NEAR_MISSES) {
    it(c.name, () => {
      const result = recognizeShape(c.points, { strict: c.strict === true });
      expect(result.fits.map((f) => f.kind)).toEqual([]);
    });
  }
});

describe('shapes snap to their kind', () => {
  for (const c of SHAPES) {
    it(c.name, () => {
      const result = recognizeShape(c.points);
      expect(result.fits[0]?.kind, JSON.stringify(result.fits.map((f) => [f.kind, f.score]))).toBe(
        c.kind,
      );
    });
  }
});

describe('the fits', () => {
  it('keep the drawn size and orientation; a rectangle snaps level only within 5°', () => {
    const level = recognizeShape(polygon(rectangle(250, 200, 220, 120, 3), CLEAN)).fits[0];
    expect(level?.geometry.type).toBe('polygon');
    if (level?.geometry.type !== 'polygon') return;
    expect(axisAligned(level.geometry.vertices)).toBe(true);
    const xs = level.geometry.vertices.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(205);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(235);
    const tilted = recognizeShape(polygon(rectangle(250, 200, 220, 120, 12), CLEAN)).fits[0];
    if (tilted?.geometry.type !== 'polygon') throw new Error('not a polygon');
    expect(axisAligned(tilted.geometry.vertices)).toBe(false);
    const [a, b] = tilted.geometry.vertices;
    const deg = (Math.atan2(b!.y - a!.y, b!.x - a!.x) * 180) / Math.PI;
    expect(Math.abs((((deg % 90) + 90) % 90) - 12)).toBeLessThan(3);
  });

  it('a circle keeps its centre and radius', () => {
    const fit = recognizeShape(ellipse(250, 200, 80, 80, 0, SLOPPY)).fits[0];
    if (fit?.geometry.type !== 'ellipse') throw new Error('not an ellipse');
    expect(fit.geometry.cx).toBeCloseTo(250, -1);
    expect(fit.geometry.cy).toBeCloseTo(200, -1);
    expect(Math.abs(fit.geometry.rx - 80)).toBeLessThan(5);
    expect(fit.geometry.rx).toBe(fit.geometry.ry);
  });

  it('a rotated ellipse keeps its angle; one within 5° of level snaps', () => {
    const turned = recognizeShape(ellipse(250, 200, 120, 60, 30, CLEAN)).fits[0];
    if (turned?.geometry.type !== 'ellipse') throw new Error('not an ellipse');
    expect((turned.geometry.angle * 180) / Math.PI).toBeCloseTo(30, 0);
    const near = recognizeShape(ellipse(250, 200, 120, 60, 4, CLEAN)).fits[0];
    if (near?.geometry.type !== 'ellipse') throw new Error('not an ellipse');
    expect(near.geometry.angle).toBeCloseTo(0, 6);
  });

  it('a line snaps to 45° steps only within 5°', () => {
    const near = recognizeShape(
      held(
        walk(
          [
            { x: 100, y: 100 },
            { x: 300, y: 112 },
          ],
          CLEAN,
        ),
      ),
    ).fits[0];
    if (near?.geometry.type !== 'line') throw new Error('not a line');
    expect(near.geometry.b.y).toBeCloseTo(near.geometry.a.y, 6);
    const far = recognizeShape(
      held(
        walk(
          [
            { x: 100, y: 100 },
            { x: 300, y: 140 },
          ],
          CLEAN,
        ),
      ),
    ).fits[0];
    if (far?.geometry.type !== 'line') throw new Error('not a line');
    expect(far.geometry.b.y - far.geometry.a.y).toBeGreaterThan(30);
  });

  it('offers next-best fits to cycle through, best first', () => {
    const fits = recognizeShape(ellipse(250, 200, 120, 70, 0, SLOPPY)).fits;
    expect(fits[0]?.kind).toBe('ellipse');
    for (let i = 1; i < fits.length; i++) {
      expect(fits[i]!.score).toBeLessThanOrEqual(fits[i - 1]!.score);
    }
    const square = recognizeShape(polygon(rectangle(250, 200, 150, 146), CLEAN)).fits.map(
      (f) => f.kind,
    );
    expect(square.slice(0, 2)).toEqual(['square', 'rectangle']);
  });

  it('a writing context needs a stricter fit', () => {
    // A lumpy circle (radius ±6 % three times round) passes on its own and fails right
    // after another stroke.
    const lumpy = Array.from({ length: 120 }, (_, i) => {
      const t = (i / 119) * 2 * Math.PI;
      const r = 60 * (1 + 0.06 * Math.sin(3 * t));
      return { x: 250 + r * Math.cos(t), y: 200 + r * Math.sin(t) };
    });
    const sloppy = held(walk(lumpy, CLEAN));
    expect(recognizeShape(sloppy).fits[0]?.kind).toBeDefined();
    expect(recognizeShape(sloppy, { strict: true }).fits).toEqual([]);
  });

  it('a hold-drag scales and rotates the shape about its centre', () => {
    const g = { type: 'polygon' as const, vertices: rectangle(0, 0, 100, 50) };
    const moved = transformShape(g, { x: 0, y: 0 }, 2, Math.PI / 2);
    if (moved.type !== 'polygon') throw new Error('not a polygon');
    const xs = moved.vertices.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(100, 6);
    const ys = moved.vertices.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(200, 6);
  });

  it('snapDelta snaps within 5° only', () => {
    expect(snapDelta((4 * Math.PI) / 180)).toBeCloseTo((-4 * Math.PI) / 180, 9);
    expect(snapDelta((44 * Math.PI) / 180)).toBeCloseTo((1 * Math.PI) / 180, 9);
    expect(snapDelta((10 * Math.PI) / 180)).toBe(0);
  });

  it('outlines close their shapes', () => {
    const square = outline({ type: 'polygon', vertices: rectangle(0, 0, 10, 10) });
    expect(square).toHaveLength(5);
    expect(square[4]).toEqual(square[0]);
    const arrow = outline({ type: 'line', a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, arrow: true }, 2);
    expect(arrow).toHaveLength(5);
  });
});
