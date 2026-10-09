/**
 * *Rotate* in the Pages grid (docs/design/motion-2026-10/pages.md; 06-navigation PG4 §7): a
 * rotated page turns on a spring through its quarter (or half) turn instead of swapping to its
 * new shape.
 *
 * The cell lays out the new shape at once (its sheet's box swaps width and height); the sheet
 * then starts turned back by the rotation, scaled to the old box, so the first frame looks like
 * the page before, and springs to rest on `smooth`'s curve, on Web Animations (the compositor). A
 * sheet turned again mid-flight starts the next turn from where it is drawn. The page's bitmap is redrawn for the new rotation (`PageCanvas` clears it
 * meanwhile), so a still copy of the old bitmap, turned to match, covers the sheet until the new
 * one is drawn, then fades. Nothing is left on the sheet at rest (Q-2). Under reduced motion the
 * page swaps (§7.5).
 */
import { reducedMotion } from '../../motion/reduced-motion';
import { springToLinear } from '../../motion/springs';
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

const spins = new WeakMap<HTMLElement, Animation>();
const covers = new WeakMap<HTMLElement, { el: HTMLCanvasElement; turn: number }>();
/** How long the old bitmap may cover the sheet while the new one is drawn, ms. */
const COVER_MAX_MS = 1500;

/** The turn (degrees) and scale `sheet` is drawn at now, read from its computed transform. */
function pose(sheet: HTMLElement): [angle: number, scale: number] {
  const value = getComputedStyle(sheet).transform;
  if (!value || value === 'none') return [0, 1];
  const m = new DOMMatrixReadOnly(value);
  return [(Math.atan2(m.b, m.a) * 180) / Math.PI, Math.hypot(m.a, m.b)];
}

/** Turns `sheet` (the cell's `[data-thumb]`, already in its new shape) by `turn` degrees. */
export function spinSheet(sheet: HTMLElement, turn: number, before: SheetSize): void {
  if (turn === 0 || reducedMotion() || typeof sheet.animate !== 'function') return;
  const width = sheet.offsetWidth;
  const height = sheet.offsetHeight;
  if (width === 0 || height === 0) return;
  const quarter = Math.abs(turn) % 180 === 90;
  const scale = before.width / (quarter ? height : width);
  // A sheet still turning goes on from where it is drawn (its old box is the turning one).
  const running = spins.get(sheet);
  const [angle, size] = running ? pose(sheet) : [0, 1];
  running?.cancel();
  cover(sheet, turn, width, height);
  const smooth = springToLinear('smooth');
  const spin = sheet.animate(
    [
      { transform: `rotate(${angle - turn}deg) scale(${size * scale})` },
      { transform: 'rotate(0deg) scale(1)' },
    ],
    { duration: smooth.duration, easing: smooth.easing },
  );
  spins.set(sheet, spin);
  const done = () => {
    if (spins.get(sheet) === spin) spins.delete(sheet);
  };
  spin.finished.then(done, done);
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
