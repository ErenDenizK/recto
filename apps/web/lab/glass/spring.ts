/**
 * A damped spring and an eased tween for the lab's morph and squish, stepped per frame at a
 * fixed 1/120 s so the result does not depend on the frame rate. The lab may not import the app's
 * motion core (a shared module would split a chunk out of the app's first-paint path), so this is
 * the textbook integrator; the spring constants are Liquid DOM's MenuDemo (MIT) and are named
 * where they are used.
 */
export interface SpringConfig {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass?: number;
}

export class Spring {
  value: number;
  velocity = 0;
  target: number;

  constructor(
    value: number,
    public config: SpringConfig,
  ) {
    this.value = value;
    this.target = value;
  }

  /** Moves the target; an initial velocity gives a launch (Liquid DOM opens its menu so). */
  to(target: number, config?: SpringConfig, velocity?: number): void {
    this.target = target;
    if (config) this.config = config;
    if (velocity !== undefined) this.velocity = velocity;
  }

  step(dt: number): void {
    const mass = this.config.mass ?? 1;
    const h = 1 / 120;
    let left = Math.min(dt, 0.064);
    while (left > 0) {
      const s = Math.min(h, left);
      const force =
        -this.config.stiffness * (this.value - this.target) - this.config.damping * this.velocity;
      this.velocity += (force / mass) * s;
      this.value += this.velocity * s;
      left -= s;
    }
  }

  get settled(): boolean {
    return Math.abs(this.value - this.target) < 0.01 && Math.abs(this.velocity) < 0.05;
  }

  snap(value: number): void {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }
}

/** A cubic Bézier ease (CSS `cubic-bezier`), solved by Newton steps. */
export function bezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const curve = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  const slope = (a: number, b: number, t: number) =>
    3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const d = slope(x1, x2, t) || 1e-6;
      t -= (curve(x1, x2, t) - x) / d;
      t = Math.min(1, Math.max(0, t));
    }
    return curve(y1, y2, t);
  };
}

export class Tween {
  value: number;
  private from: number;
  private target: number;
  private elapsed = 0;
  private duration = 0;
  private ease: (t: number) => number = (t) => t;

  constructor(value: number) {
    this.value = value;
    this.from = value;
    this.target = value;
  }

  to(target: number, duration: number, ease: (t: number) => number): void {
    this.from = this.value;
    this.target = target;
    this.elapsed = 0;
    this.duration = duration;
    this.ease = ease;
  }

  step(dt: number): void {
    if (this.elapsed >= this.duration) {
      this.value = this.target;
      return;
    }
    this.elapsed += dt;
    const t = this.duration <= 0 ? 1 : Math.min(1, this.elapsed / this.duration);
    this.value = this.from + (this.target - this.from) * this.ease(t);
  }

  get settled(): boolean {
    return this.elapsed >= this.duration;
  }

  snap(value: number): void {
    this.value = value;
    this.from = value;
    this.target = value;
    this.elapsed = this.duration;
  }
}

export const easeOut = bezier(0, 0, 0.58, 1);
export const easeIn = bezier(0.42, 0, 1, 1);
