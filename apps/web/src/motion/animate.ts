/**
 * Spring animation with retarget and velocity hand-off (language.md §7.4; ADR-0026 §2 item 3c;
 * research 18 §4.4, §5.5, §6.2–§6.3, MP-6, MP-7, MP-9; quality-bar.md Q-2, Q-6, Q-10;
 * 09-primitives §31).
 *
 * Two drivers share one analytic segment model:
 * - `animate()` moves numbers, or tuples of numbers, for script consumers (the zoom controller's
 *   scale, the light field's uniforms) on one shared requestAnimationFrame loop that runs only
 *   while something moves: zero frames at rest (Q-10, A-23).
 * - `animateStyle()` moves an element's `transform` or `opacity`, or a contained capsule's own
 *   `width` and `height` (Q-6), on Web Animations, so the motion keeps its frames while the main
 *   thread is busy: under 50 ms long tasks a requestAnimationFrame spring lost 31 % of its frames
 *   where Web Animations lost 2 % (research 18 §6.3, MP-6). Its keyframes are the analytic spring
 *   sampled at 120 Hz. At rest it removes the inline property it animated (Q-2: no transform left
 *   on glass or text), and `will-change` is set only while it moves, on at most three elements
 *   at a time (MP-9).
 *
 * Both retarget from where they are: `retarget()` reads position and velocity analytically at
 * the present moment and starts the next segment from them, so a reversal carries its speed
 * through the turn (research 18 §6.2) instead of jumping or restarting. Time is
 * `performance.now()` or the animation's own clock, never frame counts (MP-7). A segment ends
 * when each channel's energy x² + (v / ω)² has fallen to 0.1 % of where it started, then snaps
 * exactly to the target (the 0.1 % "CSS duration" rule of language.md §7.1).
 *
 * Under reduced motion (§7.5) a segment is instant and carries no momentum; a fade (opacity, or
 * a number marked `fade`) is kept, without overshoot, on `REDUCED_FADE`: `track`'s shape a
 * little shorter, so that its last 120 Hz keyframe still lands inside A-9's 150 ms (D3-4).
 */
import { reducedMotion } from './reduced-motion';
import { energy, type Spring, type SpringName, solve, spring, springOf } from './springs';

/** A number, or a tuple of numbers moving together on one spring (`[x, y, scale]`). */
export type MotionValue = number | readonly number[];

/** `number` for a number (not the literal `0` that `animate(0, 100)` would infer). */
type Widen<T extends MotionValue> = T extends number ? number : readonly number[];

/** A running or resting spring animation (09-primitives §31). */
export interface Motion<T extends MotionValue = number> {
  /** The value now, read analytically between frames. */
  readonly value: T;
  /** The velocity now, in units per second. */
  readonly velocity: T;
  /** Resolves when the motion comes to rest or is stopped; a later retarget starts a new one. */
  readonly finished: Promise<void>;
  /** Heads for `to` from the present position and velocity (or `velocity`, units per second). */
  retarget(to: T, velocity?: T): void;
  /** Stops where it is (the cancel), returning position and velocity for a gesture to take over. */
  stop(): { value: T; velocity: T };
}

interface Options<T extends MotionValue> {
  /** A token of language.md §7.1, or a spring. */
  readonly spring: SpringName | Spring;
  /** Initial velocity in units per second, such as a drag's release velocity (MC-18). */
  readonly velocity?: T;
  /** Called once when the motion comes to rest at its target, not on `stop()`. */
  readonly onComplete?: () => void;
}

/** Options of `animate()`. */
export interface AnimateOptions<T extends MotionValue> extends Options<T> {
  /** Called every frame with value and velocity, and last with the exact target at rest. */
  readonly onUpdate?: (value: T, velocity: T) => void;
  /** The value is a fade, kept under reduced motion (§7.5) instead of jumping. */
  readonly fade?: boolean;
}

/** The properties `animateStyle()` writes: compositor ones, plus Q-6's own geometry. */
export type StyleProperty = 'transform' | 'opacity' | 'width' | 'height';

/** Options of `animateStyle()`. */
export interface StyleOptions<T extends MotionValue> extends Options<T> {
  /**
   * Leaves the target written inline at rest instead of removing the property. Without it the
   * element returns to its stylesheet value, which must be the target: the FLIP contract, by
   * which Q-2's transforms clear themselves (default).
   */
  readonly keep?: boolean;
}

/** An element that has an inline style. */
export type Styled = Element & ElementCSSInlineStyle;

type Vec = number[];
type State = [value: Vec, velocity: Vec, settled: boolean];

/**
 * The reduced fade (§7.5): critically damped like `track` (d 0.10 s), at d 0.09 s, so it settles
 * (0.1 % energy) in about 140 ms where `track`'s 120 Hz keyframes ran to 158 ms.
 */
const REDUCED_FADE = spring(0.09);

/** A segment ends when its energy has fallen to this fraction (0.1 % of the amplitude, squared). */
const PRECISION = 1e-6;
/** Keyframe rate of `animateStyle()`. */
const FPS = 120;
/** `will-change` on at most this many elements at once (MP-9). */
const MAX_PROMOTED = 3;

/** One channel of a segment: displacement and velocity as it starts, and its settled energy. */
type Channel = [x: number, v: number, e: number];

/** One spring move from the moment it starts; `s` null is instant, at its target at once. */
interface Segment {
  readonly s: Spring | null;
  readonly to: Vec;
  readonly c: Channel[];
}

const vec = (v: MotionValue): Vec => (typeof v === 'number' ? [v] : [...v]);

function segment(s: Spring | null, from: Vec, to: Vec, velocity: Vec): Segment {
  const c = to.map((target, i): Channel => {
    const x = (from[i] ?? target) - target;
    const v = velocity[i] ?? 0;
    return [x, v, s ? energy(s, x, v) * PRECISION : 0];
  });
  return { s, to, c };
}

const rest = (g: Segment): State => [g.to, g.to.map(() => 0), true];

/** Value, velocity and whether the segment has settled, `t` seconds into it. */
function sample(g: Segment, t: number): State {
  const { s, to } = g;
  if (!s) return rest(g);
  let settled = true;
  const now = g.c.map(([x, v, e]) => {
    const xv = solve(s, x, v, t);
    if (energy(s, ...xv) > e) settled = false;
    return xv;
  });
  return settled ? rest(g) : [now.map(([x], i) => (to[i] ?? 0) + x), now.map(([, v]) => v), false];
}

/** What a motion shares with its driver. */
interface Core<T extends MotionValue> {
  /** The segment being driven. */
  g: Segment;
  readonly out: (v: Vec) => T;
  /** The driver came to rest or was halted. */
  readonly done: () => void;
}

/** How a motion is put on screen: a requestAnimationFrame step or a Web Animation. */
interface Driver {
  /** Seconds into the current segment. */
  time(): number;
  /** Drives `core.g`, which has just begun (a start or a retarget). */
  play(): void;
  /** Stops driving, leaving the value at `value`. */
  halt(value: Vec): void;
}

/**
 * A motion resting at `from`; its first `retarget()` starts it. Position and velocity are read
 * analytically at the driver's present time, so a retarget starts the next segment exactly where
 * the last one is (research 18 §6.2).
 */
function motion<T extends MotionValue>(
  from: T,
  o: Options<T>,
  fade: boolean,
  driver: (core: Core<T>) => Driver,
): Motion<T> {
  let busy = false;
  let finished = Promise.resolve();
  let resolve: (() => void) | undefined;
  const core: Core<T> = {
    g: segment(null, [], vec(from), []),
    out: (v) => (typeof from === 'number' ? v[0] : v) as T,
    done() {
      busy = false;
      resolve?.();
    },
  };
  const d = driver(core);
  const at = () => (busy ? sample(core.g, d.time()) : rest(core.g));
  return {
    get value() {
      return core.out(at()[0]);
    },
    get velocity() {
      return core.out(at()[1]);
    },
    get finished() {
      return finished;
    },
    retarget(to, velocity) {
      const [value, current] = at();
      const v = velocity === undefined ? current : vec(velocity);
      // §7.5: under reduced motion a spatial move is instant and a fade runs on `track`; neither
      // carries momentum.
      core.g = reducedMotion()
        ? segment(fade ? REDUCED_FADE : null, value, vec(to), [])
        : segment(springOf(o.spring), value, vec(to), v);
      if (!busy) finished = new Promise((r) => (resolve = r));
      busy = true;
      d.play();
    },
    stop() {
      const [value, velocity] = at();
      if (busy) d.halt(value);
      core.g = segment(null, [], value, []);
      core.done();
      return { value: core.out(value), velocity: core.out(velocity) };
    },
  };
}

// ---------------------------------------------------------------------------
// Numbers on one requestAnimationFrame loop
// ---------------------------------------------------------------------------

const live = new Set<(now: number) => void>();
let frame = 0;

// Every step reads `performance.now()`, the clock `retarget()` reads too, not the frame's stamp:
// under load a frame can be stamped well before a retarget made in the same frame, and mixing
// the two clocks drew that frame from the new segment's future (a visible jump).
function tick() {
  frame = 0;
  const now = performance.now();
  for (const step of live) step(now);
  // A motion started inside a step (an `onComplete` that plays another) has asked for the next
  // frame already; asking again would run every step twice a frame.
  if (live.size) frame ||= requestAnimationFrame(tick);
}

/**
 * Animates `from` → `to` on a spring, calling `onUpdate` every frame; for script values, while
 * elements go through `animateStyle()`. An instant motion (reduced motion) calls `onUpdate` and
 * `onComplete` before it returns.
 */
export function animate<T extends MotionValue>(
  from: T,
  to: Widen<T>,
  o: AnimateOptions<Widen<T>>,
): Motion<Widen<T>> {
  let t0 = 0;
  // A frame can be stamped a little before the event that started the motion: clamp at 0.
  const time = (now = performance.now()) => Math.max(0, now - t0) / 1000;
  const m = motion(from as Widen<T>, o, !!o.fade, (core) => {
    const step = (now: number) => {
      const [value, velocity, settled] = sample(core.g, time(now));
      if (settled) {
        live.delete(step);
        core.done();
      }
      o.onUpdate?.(core.out(value), core.out(velocity));
      if (settled) o.onComplete?.();
    };
    return {
      time,
      play() {
        t0 = performance.now();
        live.add(step);
        if (!core.g.s) step(t0);
        else frame ||= requestAnimationFrame(tick);
      },
      halt() {
        live.delete(step);
      },
    };
  });
  m.retarget(to, o.velocity);
  return m;
}

// ---------------------------------------------------------------------------
// Elements on Web Animations
// ---------------------------------------------------------------------------

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const px = ([v = 0]: Vec) => `${r3(Math.max(0, v))}px`;

/**
 * How values are written: `transform` takes `[x, y]` in px with an optional `scale`, or
 * `[sx, sy]`, after them; `opacity` is clamped to 0–1; `width` and `height` are px.
 */
const formats: Partial<Record<StyleProperty, (v: Vec) => string>> = {
  transform: ([x = 0, y = 0, sx = 1, sy = sx]) =>
    `translate(${r3(x)}px, ${r3(y)}px) scale(${r3(sx)}, ${r3(sy)})`,
  opacity: ([v = 1]) => `${r3(Math.min(1, Math.max(0, v)))}`,
};

/** The running style motions per element and property. */
const runs = new WeakMap<Element, Map<StyleProperty, Motion<MotionValue>>>();
const promoted = new Set<Element>();

/** `will-change` names what moves on the compositor now, or goes (Q-2, MP-9). */
function promote(el: Styled) {
  const moving = (['transform', 'opacity'] as const).filter((p) => runs.get(el)?.has(p)).join(', ');
  if (moving && !promoted.has(el) && promoted.size >= MAX_PROMOTED) return;
  el.style.willChange = moving;
  if (moving) promoted.add(el);
  else promoted.delete(el);
}

/**
 * Animates one style property of `el` on a spring (09-primitives §31; Q-6, Q-7). A run already
 * moving the same property is stopped where it is first; use `retarget()` to keep its velocity.
 * At rest the inline property is removed (or, with `keep`, left at the target) and `will-change`
 * goes, so a resting element has `transform: none` (Q-2). `stop()` leaves the value it stopped
 * at written inline, for the gesture that takes over.
 */
export function animateStyle(
  el: Styled,
  prop: 'transform',
  from: readonly number[],
  to: readonly number[],
  o: StyleOptions<readonly number[]>,
): Motion<readonly number[]>;
export function animateStyle(
  el: Styled,
  prop: 'opacity' | 'width' | 'height',
  from: number,
  to: number,
  o: StyleOptions<number>,
): Motion;
export function animateStyle(
  el: Styled,
  prop: StyleProperty,
  from: MotionValue,
  to: MotionValue,
  o: StyleOptions<number> | StyleOptions<readonly number[]>,
): Motion<MotionValue> {
  runs.get(el)?.get(prop)?.stop();
  const write = formats[prop] ?? px;
  let anim: Animation | null = null;
  const m = motion<MotionValue>(from, o, prop === 'opacity', (core) => {
    /** Back to rest: the inline value left at `value` (or removed), the run forgotten. */
    const end = (value?: Vec) => {
      const a = anim;
      anim = null;
      el.style.setProperty(prop, value ? write(value) : '');
      a?.cancel();
      runs.get(el)?.delete(prop);
      promote(el);
      core.done();
    };
    const settle = (complete: boolean) => {
      end(o.keep ? core.g.to : undefined);
      if (complete) o.onComplete?.();
    };
    return {
      time: () => Number(anim?.currentTime ?? 0) / 1000,
      play() {
        const frames: Keyframe[] = [];
        for (let i = 0; ; i++) {
          const [value, , settled] = sample(core.g, i / FPS);
          frames.push({ [prop]: write(value) });
          if (settled) break;
        }
        if (!anim) {
          let props = runs.get(el);
          if (!props) runs.set(el, (props = new Map<StyleProperty, Motion<MotionValue>>()));
          props.set(prop, m);
          promote(el);
        }
        anim?.cancel();
        anim = null;
        if (frames.length < 2) {
          settle(true);
          return;
        }
        const next = el.animate(frames, {
          duration: ((frames.length - 1) * 1000) / FPS,
          fill: 'forwards',
        });
        anim = next;
        // Cancelled from outside (not by a retarget or stop): back to rest without `onComplete`.
        next.onfinish = next.oncancel = (event) => {
          if (next === anim) settle(event.type === 'finish');
        };
      },
      halt: end,
    };
  });
  m.retarget(to, o.velocity);
  return m;
}

/**
 * Stops the transform motion running on `el`, if any, and removes its inline transform so the
 * element can be measured at its layout box; returns where it was (for `flip()`'s hand-off).
 */
export function stopTransform(el: Styled): { value: Vec; velocity: Vec } | undefined {
  const run = runs.get(el)?.get('transform');
  if (!run) return undefined;
  const state = run.stop();
  el.style.removeProperty('transform');
  return state as { value: Vec; velocity: Vec };
}
