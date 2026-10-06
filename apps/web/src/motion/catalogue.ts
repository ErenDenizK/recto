/**
 * The catalogue entries that run from script (language.md §7.3; spec redesign D3-4 and §6.5: X8,
 * 02.5, 02.6, 05.2). Each one is a name components pick, with its token, its interruption and
 * its reduced form, so the same motion never gets written twice (Settings and the pen's preset
 * editor used to carry their own copies of the sheet push).
 *
 * | Entry | What moves | Token | Interruption | Reduced (§7.5) |
 * |---|---|---|---|---|
 * | `sheetPush` (X8) | The page that comes in: `translateX(±24px)` and opacity in | smooth | A new push starts from the opacity the last one reached | Fade, ≤ 150 ms |
 * | `ringFlash` (*undo reveal*) | A ring on the target: 80 in, 160 held, 260 out (A-10) | — | A new flash replaces the last | The ring held still 500 ms, then removed |
 * | `revealWhenShown` (*find step*, 05.2) | *scroll-to* happened; the ring flashes once the target is laid out | browser | — | Instant scroll, still ring |
 * | `fold` (02.6) | *popup* exit toward the ⓘ, then `ringFlash` on the ⓘ | quick | — | Fade, still ring |
 *
 * The large press of 02.5 is CSS (`--press-scale-large`, `styles/motion.css`), with
 * `pressScale()` in `tokens.ts` for script. Nothing here leaves a transform, an outline or
 * `will-change` on its element at rest (Q-2), and nothing runs after it ends (Q-10).
 */
import { animateStyle, type Motion } from './animate';
import { reducedMotion } from './reduced-motion';
import { duration, EASE, ENTER_SCALE, RING_FLASH, SHEET_PUSH_PX } from './tokens';

/** The fades of running sheet pushes, so the next push starts from where one got to. */
const pushes = new WeakMap<Element, Motion>();

/**
 * *Sheet push* (X8; 07-sheets §27.3): navigation inside a sheet or a popover (Settings pages,
 * the pen's preset editor, Batch, result pages). The page that comes in slides 24 px from the
 * side it comes from (`direction` 1: from the trailing side, a push; −1: from the leading side,
 * Back) and fades in, on `--spring-smooth`. A push that interrupts another starts its fade from
 * the opacity the other had reached, so the swap never flashes. Under reduced motion only the
 * fade runs, within 150 ms.
 */
export function sheetPush(element: Element | null, direction: 1 | -1): void {
  if (!(element instanceof HTMLElement) || typeof element.animate !== 'function') return;
  const from = pushes.get(element)?.value ?? 0;
  if (!reducedMotion()) {
    animateStyle(element, 'transform', [SHEET_PUSH_PX * direction, 0], [0, 0], {
      spring: 'smooth',
    });
  }
  const fade = animateStyle(element, 'opacity', from, 1, {
    spring: 'smooth',
    onComplete: () => pushes.delete(element),
  });
  pushes.set(element, fade);
}

/** The ring colour of a reveal: the page's selection blue, or the lime of the chrome (§7.3). */
export type RingColour = 'select' | 'chrome';

/** Running flashes, so a new one replaces the last on the same element. */
const flashes = new WeakMap<Element, Animation>();

/**
 * *Undo reveal*'s ring (§7.3, MC-32; A-10): a 3 px ring 3 px outside `element`, `--select` on a
 * page and the lime focus colour in the chrome, 80 ms in, 160 held and 260 out, 500 ms in all.
 * It is an outline on Web Animations, so nothing is left on the element and nothing runs after
 * it. Under reduced motion the ring is held still for the same 500 ms and then removed, without
 * animating (no keyframe changes its colour).
 */
export function ringFlash(element: Element, colour: RingColour = 'select'): Animation | undefined {
  if (!(element instanceof HTMLElement) || typeof element.animate !== 'function') return undefined;
  const token = colour === 'select' ? '--select' : '--focus-light';
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const ring = value === '' ? 'Highlight' : value;
  const clear = 'rgb(0 0 0 / 0)';
  const frame = (outlineColor: string, offset: number): Keyframe => ({
    offset,
    outlineColor,
    outlineStyle: 'solid',
    outlineWidth: '3px',
    outlineOffset: '3px',
  });
  const { inMs, holdMs, totalMs } = RING_FLASH;
  const frames = reducedMotion()
    ? [frame(ring, 0), frame(ring, 1)]
    : [
        frame(clear, 0),
        frame(ring, inMs / totalMs),
        frame(ring, (inMs + holdMs) / totalMs),
        frame(clear, 1),
      ];
  flashes.get(element)?.cancel();
  const flash = element.animate(frames, { duration: totalMs, easing: 'linear' });
  flashes.set(element, flash);
  flash.onfinish = () => {
    if (flashes.get(element) === flash) flashes.delete(element);
  };
  return flash;
}

/** How many frames `revealWhenShown` waits for its target to be laid out. */
const MAX_WAIT_FRAMES = 30;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * The second half of the *find step* (05.2) and *undo reveal* composites: once *scroll-to* has
 * been asked for, waits for `find()` to return the target (it may mount as its page renders),
 * gives the scroll two frames to land, then flashes the ring once. Resolves with the flash, or
 * undefined if the target never showed within half a second of frames.
 */
export async function revealWhenShown(
  find: () => Element | null,
  colour: RingColour = 'select',
): Promise<Animation | undefined> {
  let seen = 0;
  for (let frame = 0; frame < MAX_WAIT_FRAMES; frame++) {
    await nextFrame();
    const target = find();
    if (!target) continue;
    seen += 1;
    if (seen >= 2) return ringFlash(target, colour);
  }
  return undefined;
}

/**
 * *Fold* (02.6, "fold (composite)"; no new token): a surface leaves toward `into` with the
 * *popup* exit, shrinking to `--enter-scale` toward the target's centre and fading on
 * `--duration-fast` `--ease-exit`, then `into` takes the undo reveal's ring in the chrome's lime.
 * The facts chip folding into ⓘ (02-library) is its first user. `onGone` runs when the surface
 * has faded out, for the caller to unmount it. Under reduced motion it fades in place and the
 * ring is held still.
 */
export function fold(surface: Element, into: Element, onGone?: () => void): Animation | undefined {
  if (!(surface instanceof HTMLElement) || typeof surface.animate !== 'function') {
    onGone?.();
    return ringFlash(into, 'chrome');
  }
  const from = surface.getBoundingClientRect();
  const to = into.getBoundingClientRect();
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const reduced = reducedMotion();
  // The exit travels a short way toward the ⓘ, as a popup leaves toward its anchor (§7.3).
  const toward = (d: number) => Math.sign(d) * Math.min(Math.abs(d), 16);
  const end: Keyframe = reduced
    ? { opacity: 0 }
    : {
        opacity: 0,
        transform: `translate(${toward(dx)}px, ${toward(dy)}px) scale(${ENTER_SCALE})`,
      };
  const start: Keyframe = reduced ? { opacity: 1 } : { opacity: 1, transform: 'none' };
  const exit = surface.animate([start, end], {
    duration: duration('fast'),
    easing: EASE.exit,
    fill: 'forwards',
  });
  exit.onfinish = () => {
    onGone?.();
    exit.cancel();
    ringFlash(into, 'chrome');
  };
  return exit;
}
