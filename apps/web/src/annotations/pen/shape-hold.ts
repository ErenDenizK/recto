/**
 * A stroke held into a shape (motion-2026-10/ink-shapes.md §3): what `ink-input.ts` draws
 * between the hold and the release.
 *
 * - **Morph.** The stroke morphs into the fit on the `smooth` spring: both are resampled to
 *   `MORPH_POINTS` points by length, the outline starting where the stroke started and turning
 *   the way it turned, and each frame draws the points in between. At rest the outline itself
 *   is drawn (sharp corners). Reduced motion: no morph, the shape is there at once.
 * - **Adjust.** While the pen stays down, the shape follows it: a line's end is the pointer;
 *   a closed shape scales and rotates about its centre by the pointer's move from where the
 *   hold fired (as in Apple Notes), its angles snapping to 45° steps within 5°.
 * - **Chip.** A small pill above the shape names it ("Rectangle"); a tap on it (another
 *   finger while the pen holds, or the mouse within `CHIP_LINGER_MS` of the release) cycles
 *   to the next-best fit (`ShapeFit`s past the first). The chip fades in on `quick` and out.
 */
import { m } from '../../i18n';
import { animate, type Motion } from '../../motion/animate';
import { reducedMotion } from '../../motion/reduced-motion';
import type { Point } from '../ink';
import styles from './ShapeChip.module.css';
import {
  centreOf,
  outline,
  resample,
  type ShapeFit,
  type ShapeGeometry,
  type ShapeKind,
  transformShape,
} from './shapes';

/** Points the stroke and its shape are matched by while they morph. */
export const MORPH_POINTS = 96;
/** How long the chip stays after the release to be tapped (ms). */
export const CHIP_LINGER_MS = 2500;
/** The chip sits this far above the shape (CSS px). */
export const CHIP_GAP_PX = 10;
/** The drag scales between these factors. */
const MIN_SCALE = 0.2;
const MAX_SCALE = 5;
/** Below this distance from the centre (CSS px) the hold point cannot scale or rotate. */
const MIN_LEVER_PX = 8;

/** The shape's name (the chip; history labels use the annotation kinds). */
export function shapeName(kind: ShapeKind): string {
  const names: Record<ShapeKind, () => string> = {
    line: m.ink_shape_line,
    arrow: m.ink_shape_arrow,
    triangle: m.ink_shape_triangle,
    rectangle: m.ink_shape_rectangle,
    square: m.ink_shape_square,
    pentagon: m.ink_shape_pentagon,
    hexagon: m.ink_shape_hexagon,
    polygon: m.ink_shape_polygon,
    circle: m.ink_shape_circle,
    ellipse: m.ink_shape_ellipse,
  };
  return names[kind]();
}

function signedArea(points: readonly Point[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i] as Point;
    const b = points[(i + 1) % points.length] as Point;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/**
 * The outline resampled to `n` points to match `from` (the drawn stroke): a closed outline
 * starts at its point nearest the stroke's start and runs the way the stroke turns.
 */
export function morphTarget(g: ShapeGeometry, from: readonly Point[], n = MORPH_POINTS): Point[] {
  const line = outline(g);
  if (g.type === 'line') return resample(line, n);
  const loop = resample(line.slice(0, -1), n, true);
  if (Math.sign(signedArea(loop)) !== Math.sign(signedArea(from)) && signedArea(from) !== 0) {
    loop.reverse();
  }
  const start = from[0] ?? { x: 0, y: 0 };
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  loop.forEach((p, i) => {
    const d = Math.hypot(p.x - start.x, p.y - start.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  const out = [...loop.slice(best), ...loop.slice(0, best)];
  // The stroke ends where it started: so does its shape, closing the loop.
  out.push(out[0] as Point);
  return resample(out, n);
}

/** The pill that names the shape. */
class ShapeChip {
  readonly element: HTMLButtonElement;
  private fade: Motion | null = null;
  private hideTimer = 0;
  onTap: (() => void) | null = null;

  constructor(host: HTMLElement) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = styles.chip ?? '';
    el.setAttribute('data-annotation-keep', '');
    el.setAttribute('data-shape-chip', '');
    el.style.opacity = '0';
    // Its own press: the pen layer below must not start a stroke from it.
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.onTap?.();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.onTap?.();
      }
    });
    host.appendChild(el);
    this.element = el;
    this.fadeTo(1);
  }

  set(label: string, at: Point): void {
    this.element.textContent = label;
    this.element.setAttribute('aria-label', m.ink_shape_next({ shape: label }));
    this.element.style.left = `${Math.round(at.x)}px`;
    this.element.style.top = `${Math.round(at.y)}px`;
  }

  private fadeTo(to: number, done?: () => void): void {
    const el = this.element;
    const from = Number.parseFloat(el.style.opacity || '0');
    this.fade?.stop();
    this.fade = animate(from, to, {
      spring: 'quick',
      fade: true,
      onUpdate: (v) => {
        el.style.opacity = `${Math.min(1, Math.max(0, v))}`;
        el.style.transform = `translate(-50%, -100%) scale(${0.92 + 0.08 * v})`;
      },
      onComplete: () => {
        if (to === 1) el.style.transform = 'translate(-50%, -100%)';
        done?.();
      },
    });
  }

  /** Fades out after `ms` (0: now) and leaves the DOM. */
  dismiss(ms = 0): void {
    window.clearTimeout(this.hideTimer);
    const go = () => this.fadeTo(0, () => this.element.remove());
    if (ms > 0) this.hideTimer = window.setTimeout(go, ms);
    else go();
  }

  destroy(): void {
    window.clearTimeout(this.hideTimer);
    this.fade?.stop();
    this.element.remove();
  }
}

/** The held shape of one stroke (CSS px at the stroke's starting zoom). */
export class ShapeHold {
  index = 0;
  /** The pointer now. */
  private pointer: Point;
  /** What the morph starts from: the stroke, or the shape shown when the fit changed. */
  private from: Point[];
  private progress: number;
  private motion: Motion | null = null;
  private chip: ShapeChip | null = null;

  constructor(
    readonly fits: readonly ShapeFit[],
    stroke: readonly Point[],
    /** Where the pointer was when the hold fired. */
    readonly anchor: Point,
    /** Asks for a frame. */
    private readonly redraw: () => void,
    /** Where the chip goes (the layer); none in tests that do not need it. */
    host: HTMLElement | null,
    /** CSS px of the layer per CSS px at the starting zoom. */
    private zoom = 1,
  ) {
    this.pointer = anchor;
    this.from = resample(stroke, MORPH_POINTS);
    this.progress = reducedMotion() ? 1 : 0;
    this.play();
    if (host) {
      this.chip = new ShapeChip(host);
      this.chip.onTap = () => this.next();
      this.placeChip();
    }
  }

  get fit(): ShapeFit {
    return this.fits[this.index] as ShapeFit;
  }

  /** The morph is still running. */
  get morphing(): boolean {
    return this.progress < 1;
  }

  /** The pointer moved (CSS px at the starting zoom). */
  move(p: Point, zoom = this.zoom): void {
    this.pointer = p;
    this.zoom = zoom;
    this.placeChip();
  }

  /** The current fit as the pointer has adjusted it. */
  geometry(): ShapeGeometry {
    const g = this.fit.geometry;
    if (g.type === 'line') {
      // A line's end is the pointer; an arrow's tip moves with it (the pen rests on a barb).
      const end = g.arrow
        ? { x: g.b.x + this.pointer.x - this.anchor.x, y: g.b.y + this.pointer.y - this.anchor.y }
        : this.pointer;
      return g.arrow && end.x === g.b.x && end.y === g.b.y ? g : transformShape(g, g.a, 1, 0, end);
    }
    const c = centreOf(g);
    const v0 = { x: this.anchor.x - c.x, y: this.anchor.y - c.y };
    const v1 = { x: this.pointer.x - c.x, y: this.pointer.y - c.y };
    const lever = Math.hypot(v0.x, v0.y);
    if (lever < MIN_LEVER_PX || Math.hypot(v1.x, v1.y) < 1) return g;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.hypot(v1.x, v1.y) / lever));
    const angle = Math.atan2(v1.y, v1.x) - Math.atan2(v0.y, v0.x);
    if (Math.abs(scale - 1) < 1e-3 && Math.abs(angle) < 1e-3) return g;
    return transformShape(g, c, scale, angle);
  }

  /** What to draw now: the outline at rest, the points in between while morphing. */
  points(): Point[] {
    const g = this.geometry();
    if (this.progress >= 1) return outline(g);
    const to = morphTarget(g, this.from);
    const t = this.progress;
    return this.from.map((p, i) => {
      const q = to[i] ?? p;
      return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
    });
  }

  /** The next-best fit, morphing from what is drawn now. */
  next(): void {
    if (this.fits.length < 2) return;
    this.from = resample(this.points(), MORPH_POINTS);
    this.index = (this.index + 1) % this.fits.length;
    this.progress = reducedMotion() ? 1 : 0;
    this.play();
    this.placeChip();
    this.redraw();
  }

  private play(): void {
    this.motion?.stop();
    this.motion = null;
    if (this.progress >= 1) return;
    this.motion = animate(0, 1, {
      spring: 'smooth',
      onUpdate: (v) => {
        this.progress = v;
        this.redraw();
      },
      onComplete: () => {
        this.progress = 1;
        this.motion = null;
        this.redraw();
      },
    });
  }

  private placeChip(): void {
    const chip = this.chip;
    if (!chip) return;
    const pts = outline(this.geometry());
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
    }
    chip.set(shapeName(this.fit.kind), {
      x: ((minX + maxX) / 2) * this.zoom,
      y: minY * this.zoom - CHIP_GAP_PX,
    });
  }

  /**
   * The release: the morph jumps to its end (the commit draws the shape) and the chip stays
   * `CHIP_LINGER_MS` for `onTap` (a later fit), then fades. Returns the chip's tap hook.
   */
  release(onTap: ((hold: ShapeHold) => void) | null): void {
    this.motion?.stop();
    this.motion = null;
    this.progress = 1;
    const chip = this.chip;
    if (!chip) return;
    if (!onTap || this.fits.length < 2) {
      chip.dismiss();
      return;
    }
    chip.onTap = () => {
      this.index = (this.index + 1) % this.fits.length;
      this.placeChip();
      onTap(this);
      chip.dismiss(CHIP_LINGER_MS);
    };
    chip.dismiss(CHIP_LINGER_MS);
  }

  /** The chip goes now (the commit failed, or there is nothing to cycle to). */
  dismissChip(): void {
    this.chip?.dismiss();
  }

  /** The stroke was dropped. */
  destroy(): void {
    this.motion?.stop();
    this.motion = null;
    this.chip?.destroy();
    this.chip = null;
  }
}
