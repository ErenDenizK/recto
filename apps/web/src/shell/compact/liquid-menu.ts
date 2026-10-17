/**
 * The split top's menus come out of their button (DSN-39; owner's choice DSN-37, "the ⋯ menu
 * opens over its circle"): the ⋯ menu and the file menu grow out of the control that opened
 * them and go back into it, on the compositor (MOT-13; R22 brief C-5). Until R22 the menu's
 * glass was masked each frame by a traced union of the button and a blob (`liquid-mask.ts`);
 * on the owner's iPhone that ran as script, style and a fresh clip of a backdrop-filtered layer
 * on every frame, and stuttered whenever the main thread was busy (the menu mounting with it).
 *
 * - **Open.** The menu, laid out at its place over its button, grows from `startScale()` (about
 *   the button's size) to 1 about the button's centre on `fling` (one small overshoot, the
 *   springier curve that reads at 30 fps), as one Web Animation of `transform`, and fades in
 *   over the first `FADE_IN_MS`. While it grows it is its tier's solid twin (MOT-12,
 *   `glass-moving.ts`); once it rests its glass clears. The content never scales on its own
 *   and only fades in once the body has left the button (`CONTENT_DELAY_MS`).
 * - **Close.** Content first, then the body back into the button on `press`, whole until the
 *   last part of the way, where it fades into the button. Base UI waits for the popup's Web
 *   Animations before it unmounts it. A turn mid-way starts from where the body is, with its
 *   velocity (`animateStyle`'s retarget).
 * - **At once** (no motion) for a keyboard or dismissal close (`data-instant`) and the menu →
 *   sheet hand-off (`ui/menu-handoff.ts`, Q-7). Reduced motion: a fade, 150 ms in, 100 ms out
 *   (A-9).
 * - Transform and opacity only: nothing is traced, masked or clipped per frame, no layout and no
 *   script run while it moves. At rest no transform, origin, attribute or inline style (Q-2).
 *
 * These menus do not carry `ct-popup`: the container transform (DSN-36) serves the capsule
 * top's ⋯ and every other popup. This module loads lazily, once the browser is idle
 * (`liquid-ref.ts`), outside the compact chunk.
 */
import { animateStyle, type Motion } from '../../motion/animate';
import { reducedMotion } from '../../motion/reduced-motion';
import { clamp } from '../../motion/velocity';
import { glassMoving, glassSettle } from '../../ui/glass-moving';

/** The content fades in once the body has left the button, ms. */
export const CONTENT_DELAY_MS = 90;
const CONTENT_IN_MS = 200;
const CONTENT_OUT_MS = 90;
/** The body's fade in, ms: it is whole well before it has grown. */
export const FADE_IN_MS = 90;
/** A close's fade, ms (`press` settles in 212 ms); the body is whole for its first 55 %. */
const CLOSE_FADE_MS = 220;
const FADE_OUT_FROM = 0.55;
/** The smallest start: a whole menu in a speck would read as a pop, not a growth. */
const MIN_SCALE = 0.2;

/** A rect in viewport px. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The menu's scale over its button: the button's size along the menu's shorter side. */
export function startScale(button: Box, menu: Box): number {
  if (menu.width <= 0 || menu.height <= 0) return 1;
  return clamp(Math.max(button.width / menu.width, button.height / menu.height), MIN_SCALE, 1);
}

/** The point the menu grows from, in its own box (px from its top left): the button's centre. */
export function growOrigin(button: Box, menu: Box): readonly [number, number] {
  return [
    clamp(button.x + button.width / 2 - menu.x, 0, menu.width),
    clamp(button.y + button.height / 2 - menu.y, 0, menu.height),
  ];
}

/**
 * Serves one menu popup from mount to unmount; returns the cleanup. `trigger` is read when the
 * popup has been placed (its control may name it only in the same commit).
 */
export function liquidPopup(popup: HTMLElement, trigger: () => HTMLElement | null): () => void {
  const root = document.documentElement;
  const positioner = popup.parentElement ?? popup;
  let frame = 0;
  let body: Motion<readonly number[]> | null = null;
  let fade: Animation | null = null;
  let scale = 1;
  let opener: HTMLElement | null = null;

  const atOnce = () => popup.hasAttribute('data-instant') || root.hasAttribute('data-menu-handoff');
  const content = () => [...popup.children] as HTMLElement[];

  /** Back to rest, open: nothing of the motion is left (Q-2). */
  const clean = () => {
    cancelAnimationFrame(frame);
    body?.stop();
    body = null;
    fade?.cancel();
    fade = null;
    for (const child of content()) for (const a of child.getAnimations()) a.cancel();
    popup.style.removeProperty('transform');
    popup.style.removeProperty('transform-origin');
    popup.style.removeProperty('will-change');
    delete popup.dataset.liquid;
    glassSettle(popup);
  };

  if (reducedMotion()) {
    // §7.5: the fade alone.
    popup.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' });
    const watch = new MutationObserver(() => {
      if (!popup.hasAttribute('data-ending-style') || fade) return;
      fade = popup.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: atOnce() ? 1 : 100,
        easing: 'ease-in',
        fill: 'forwards',
      });
    });
    watch.observe(popup, { attributes: true, attributeFilter: ['data-ending-style'] });
    return () => watch.disconnect();
  }

  // Hidden until placed and started (the stylesheet's entrance steps aside under `data-liquid`).
  popup.dataset.liquid = '';
  popup.style.setProperty('opacity', '0');

  const run = (opening: boolean) => {
    opener ??= trigger();
    const control = opener;
    if (!control) {
      popup.style.removeProperty('opacity');
      clean();
      return;
    }
    // The laid-out box: the positioner's, which no animation of the popup moves.
    const menuBox = positioner.getBoundingClientRect();
    const button = control.getBoundingClientRect();
    // A turn mid-way starts from where the body is, with its speed; else from the button
    // (opening) or from rest (closing).
    const turning = body !== null;
    if (!turning) {
      scale = startScale(button, menuBox);
      const [ox, oy] = growOrigin(button, menuBox);
      popup.style.transformOrigin = `${ox}px ${oy}px`;
    }
    const from: readonly number[] = body?.value ?? [0, 0, opening ? scale : 1];
    const velocity = body?.velocity;
    const shown = turning ? Number(getComputedStyle(popup).opacity) : opening ? 0 : 1;
    body?.stop();
    fade?.cancel();
    for (const child of content()) for (const a of child.getAnimations()) a.cancel();
    popup.style.removeProperty('opacity');
    if (opening) {
      glassMoving(popup);
      fade = popup.animate([{ opacity: shown }, { opacity: 1 }], {
        duration: Math.max(1, FADE_IN_MS * (1 - shown)),
        easing: 'ease-out',
      });
      for (const child of content()) {
        child.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: CONTENT_IN_MS,
          delay: CONTENT_DELAY_MS,
          easing: 'ease-out',
          fill: 'backwards',
        });
      }
      const motion = animateStyle(popup, 'transform', from, [0, 0, 1], {
        spring: 'fling',
        ...(velocity ? { velocity } : {}),
      });
      body = motion;
      void motion.finished.then(() => {
        if (body === motion && !popup.hasAttribute('data-ending-style')) clean();
      });
      return;
    }
    // Closing: the content goes first, the body shrinks back whole and fades over the last of
    // the way, so Base UI unmounts the popup as it reaches the button.
    for (const child of content()) {
      child.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: CONTENT_OUT_MS,
        easing: 'ease-in',
        fill: 'forwards',
      });
    }
    body = animateStyle(popup, 'transform', from, [0, 0, scale], {
      spring: 'press',
      ...(velocity ? { velocity } : {}),
      keep: true,
    });
    fade = popup.animate(
      [{ opacity: shown }, { opacity: shown, offset: FADE_OUT_FROM }, { opacity: 0 }],
      { duration: CLOSE_FADE_MS, fill: 'forwards' },
    );
  };

  const begin = () => {
    if (!popup.isConnected) return;
    if (popup.hasAttribute('data-ending-style') || popup.hasAttribute('data-instant')) {
      popup.style.removeProperty('opacity');
      clean();
      return;
    }
    run(true);
  };

  // Base UI's positioner rests at opacity 0 until it has placed the popup.
  let placed: MutationObserver | null = null;
  if (positioner.style.opacity === '0') {
    placed = new MutationObserver(() => {
      if (positioner.style.opacity === '0') return;
      placed?.disconnect();
      placed = null;
      begin();
    });
    placed.observe(positioner, { attributes: true, attributeFilter: ['style'] });
  } else {
    frame = requestAnimationFrame(begin);
  }

  const ending = new MutationObserver(() => {
    const closing = popup.hasAttribute('data-ending-style');
    if (closing) {
      if (atOnce()) {
        clean();
        fade = popup.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: 'forwards' });
        return;
      }
      popup.dataset.liquid = '';
      run(false);
    } else if (fade || body) {
      // Reopened while it closed: back out from where it is.
      run(true);
    }
  });
  ending.observe(popup, { attributes: true, attributeFilter: ['data-ending-style'] });

  return () => {
    placed?.disconnect();
    ending.disconnect();
    cancelAnimationFrame(frame);
  };
}

/** The control that opened `popup`: Base UI's trigger names it in `aria-controls`. */
function triggerOf(popup: HTMLElement): HTMLElement | null {
  if (!popup.id) return null;
  return document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(popup.id)}"]`);
}

/** Serves `popup` grown out of the control that opened it (`liquid-ref.ts` attaches it). */
export function liquidPopupFor(popup: HTMLElement): () => void {
  return liquidPopup(popup, () => triggerOf(popup));
}
