/**
 * *Rotate* in the Pages grid (docs/design/motion-2026-10/pages.md; 06-navigation PG4 §7): a
 * rotated page turns on a spring through its quarter (or half) turn instead of swapping to its
 * new shape.
 *
 * The cell lays out the new shape at once (its sheet's box swaps width and height); the sheet
 * then starts turned back by the rotation, scaled to the old box, so the first frame looks like
 * the page before, and springs to rest on `smooth`, sampled at 120 Hz onto Web Animations (the
 * compositor). A sheet turned again mid-flight retargets: its angle, scale and their velocities
 * are read analytically from the running segment, so a second press speeds the turn on through
 * instead of restarting it. The page's bitmap is redrawn for the new rotation (`PageCanvas` clears it
 * meanwhile), so a still copy of the old bitmap, turned to match, covers the sheet until the new
 * one is drawn, then fades. Nothing is left on the sheet at rest (Q-2). Under reduced motion the
 * page swaps (§7.5).
 */
import { reducedMotion } from '../../motion/reduced-motion';
import { solve, springs } from '../../motion/springs';
import { duration, EASE } from '../../motion/tokens';

/** The size a sheet had before the change (CSS px). */
export interface SheetSize {
  readonly width: number;
  readonly height: number;
}

/** The signed turn from `from` to `to` degrees, in (−180, 180]; a half turn goes clockwise. */
export function turnBetween(from: number, to: number): number {
  const d = (((to - from) % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
}

/**
 * A running turn: the spring segment it was started on (displacement from rest and velocity per
 * channel: angle in degrees, scale − 1) and its animation, so a retarget reads where the sheet is
 * and how fast it moves analytically, at the animation's own time.
 */
interface Spin {
  readonly anim: Animation;
  readonly angle: readonly [x: number, v: number];
  readonly scale: readonly [x: number, v: number];
}

const spins = new WeakMap<HTMLElement, Spin>();
const covers = new WeakMap<HTMLElement, { el: HTMLCanvasElement; turn: number }>();
/** How long the old bitmap may cover the sheet while the new one is drawn, ms. */
const COVER_MAX_MS = 1500;
/** Keyframe rate of the sampled spring (as `animateStyle`). */
const FPS = 120;

/**
 * Where the turn `spin` is now and how fast it moves: [angle, angle velocity, scale − 1, scale
 * velocity], per second.
 */
export function spinState(spin: Spin): [number, number, number, number] {
  const t = Number(spin.anim.currentTime ?? 0) / 1000;
  const s = springs.smooth;
  const [a, va] = solve(s, spin.angle[0], spin.angle[1], t);
  const [k, vk] = solve(s, spin.scale[0], spin.scale[1], t);
  return [a, va, k, vk];
}

/**
 * The spring from `angle`/`scale` (displacements from rest) with their velocities, sampled at
 * 120 Hz until it is still: the keyframes of one turn.
 */
function frames(angle: readonly [number, number], scale: readonly [number, number]): Keyframe[] {
  const out: Keyframe[] = [];
  const s = springs.smooth;
  for (let i = 0; i < FPS * 2; i++) {
    const t = i / FPS;
    const [a, va] = solve(s, angle[0], angle[1], t);
    const [k, vk] = solve(s, scale[0], scale[1], t);
    out.push({ transform: `rotate(${a.toFixed(3)}deg) scale(${(1 + k).toFixed(5)})` });
    const still =
      Math.abs(a) < 0.01 && Math.abs(va) < 1 && Math.abs(k) < 1e-4 && Math.abs(vk) < 0.01;
    if (i > 0 && still) break;
  }
  out.push({ transform: 'rotate(0deg) scale(1)' });
  return out;
}

/** Turns `sheet` (the cell's `[data-thumb]`, already in its new shape) by `turn` degrees. */
export function spinSheet(sheet: HTMLElement, turn: number, before: SheetSize): void {
  if (turn === 0 || reducedMotion() || typeof sheet.animate !== 'function') return;
  const width = sheet.offsetWidth;
  const height = sheet.offsetHeight;
  if (width === 0 || height === 0) return;
  const quarter = Math.abs(turn) % 180 === 90;
  const scale = before.width / (quarter ? height : width);
  // A sheet still turning goes on from where it is and as fast as it turns there: the new
  // layout is `turn` further on and `scale` times the old box.
  const running = spins.get(sheet);
  const [a, va, k, vk] = running ? spinState(running) : [0, 0, 0, 0];
  running?.anim.cancel();
  cover(sheet, turn, width, height);
  const angle = [a - turn, va] as const;
  const size = [(1 + k) * scale - 1, vk * scale] as const;
  const keyframes = frames(angle, size);
  const anim = sheet.animate(keyframes, {
    duration: ((keyframes.length - 1) * 1000) / FPS,
    easing: 'linear',
  });
  const spin: Spin = { anim, angle, scale: size };
  spins.set(sheet, spin);
  const done = () => {
    if (spins.get(sheet) === spin) spins.delete(sheet);
  };
  anim.finished.then(done, done);
}

/** The running turn of `sheet`, if any (for tests). */
export function runningSpin(sheet: HTMLElement): Spin | undefined {
  return spins.get(sheet);
}

/** The still copy of the old bitmap, turned by the turns since it was taken (module header). */
function cover(sheet: HTMLElement, turn: number, w: number, h: number): void {
  const canvas = sheet.querySelector<HTMLCanvasElement>('canvas:not([data-spin-cover])');
  const held = covers.get(sheet);
  let el = held?.el;
  const total = (held?.turn ?? 0) + turn;
  if (!el) {
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;
    el = document.createElement('canvas');
    el.width = canvas.width;
    el.height = canvas.height;
    el.getContext('2d')?.drawImage(canvas, 0, 0);
    el.dataset.spinCover = '';
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, { position: 'absolute', zIndex: '1', pointerEvents: 'none' });
    sheet.append(el);
    watch(sheet, canvas, el);
  }
  // Drawn at the old orientation's size, then turned into the new box.
  const turned = Math.abs(total) % 180 === 90;
  const ow = turned ? h : w;
  const oh = turned ? w : h;
  Object.assign(el.style, {
    left: `${(w - ow) / 2}px`,
    top: `${(h - oh) / 2}px`,
    width: `${ow}px`,
    height: `${oh}px`,
    transform: `rotate(${total}deg)`,
  });
  covers.set(sheet, { el, turn: total });
}

/** Fades the cover once `canvas` shows the new bitmap (or after `COVER_MAX_MS`). */
function watch(sheet: HTMLElement, canvas: HTMLCanvasElement, el: HTMLCanvasElement): void {
  let done = false;
  const fade = () => {
    if (done) return;
    done = true;
    observer.disconnect();
    window.clearTimeout(timer);
    if (covers.get(sheet)?.el === el) covers.delete(sheet);
    const out = el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: duration('fast'),
      easing: EASE.out,
      fill: 'forwards',
    });
    const gone = () => el.remove();
    out.finished.then(gone, gone);
  };
  const observer = new MutationObserver(() => {
    const state = canvas.dataset.state;
    if ((state === 'rendered' || state === 'preview') && canvas.width > 0) fade();
  });
  observer.observe(canvas, { attributeFilter: ['data-state', 'width'] });
  const timer = window.setTimeout(fade, COVER_MAX_MS);
}
