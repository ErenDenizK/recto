/**
 * Frame meter: the interval between animation frames over the last second (fps, median and
 * 95th percentile), counted only while a frame was requested anyway, so a page at rest reads
 * "idle" instead of a made-up 60. The lab's own rAF loop calls `tick` each frame it runs.
 */
export interface FrameStats {
  readonly fps: number;
  readonly p50: number;
  readonly p95: number;
  readonly frames: number;
}

export class FrameMeter {
  private readonly times: number[] = [];
  private last = 0;

  tick(now: number): void {
    if (this.last !== 0 && now - this.last < 2000) this.times.push(now - this.last);
    this.last = now;
    if (this.times.length > 240) this.times.splice(0, this.times.length - 240);
  }

  /** Forget the history (between measured runs). */
  reset(): void {
    this.times.length = 0;
    this.last = 0;
  }

  /** Marks a pause: the next tick does not count the gap. */
  pause(): void {
    this.last = 0;
  }

  stats(): FrameStats {
    const sorted = [...this.times].sort((a, b) => a - b);
    const pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    const p50 = pick(0.5) ?? 0;
    return {
      fps: p50 > 0 ? 1000 / (sorted.reduce((s, t) => s + t, 0) / sorted.length) : 0,
      p50,
      p95: pick(0.95) ?? 0,
      frames: sorted.length,
    };
  }
}
