/**
 * A piece that follows its content's width on a spring (language.md §7.3 *bar morph*, the
 * floating pieces' form of it; quality-bar Q-6; owner feedback 2026-10-09 G6): the top strip's
 * pieces when Save, Find or a tab comes or goes, the Pages grid's corner pieces as they fold.
 *
 * - **Its own width, through the motion core.** The piece rests at its content's width (no
 *   inline size, Q-2). When that width changes, the change is drawn on `smooth` by
 *   `animateStyle(el, 'width', …)` from the width on screen, so backdrop, rim and shadow follow
 *   by construction; nothing is cloned, scaled or clipped by `clip-path` (Q-6).
 * - **No layout thrash.** The change is seen by a `ResizeObserver`, after layout and before
 *   paint, so the first frame drawn is already the start of the motion; mid-flight a content
 *   change (a `MutationObserver` on the piece) costs one extra layout, never one per frame.
 * - **Contents keep their size.** While the width moves the piece carries `data-resizing`, its
 *   direct children are held at the widths they rest at (`flex: 0 0 <px>`) and the piece clips
 *   to its own rounded box (the stylesheet's `[data-resizing]` rule), so a label never
 *   re-truncates frame by frame; the moving edge reveals or covers them.
 * - **The resting width** is on `data-target-width` while it moves (`restingWidth()`), so a
 *   neighbour that measures the piece (DocumentTabs, GridPieces) reads where it is going, not
 *   a frame of the way.
 * - **Interruptible** (Q-10): a change mid-flight retargets from the width on screen with the
 *   velocity it has. A window resize is followed at once, never animated.
 * - **Reduced motion** (§7.5): spatial change is instant, so the piece is simply its content's
 *   width (`animateStyle` makes the segment instant).
 */
import { animateStyle, type Motion } from './animate';
import { reducedMotion } from './reduced-motion';

/** Width changes smaller than this (CSS px) are not animated. */
const STILL = 0.5;

/** The attribute a piece carries while its width moves (styles clip and hold the contents). */
export const RESIZING = 'data-resizing';
/** The attribute that holds a moving piece's resting width (px). */
export const TARGET_WIDTH = 'data-target-width';

/** The width `el` rests at: where its width is going while it moves, else its own (px). */
export function restingWidth(el: HTMLElement): number {
  const target = Number.parseFloat(el.getAttribute(TARGET_WIDTH) ?? '');
  return Number.isFinite(target) ? target : el.offsetWidth;
}

export interface SpringWidthOptions {
  /**
   * While this returns true the content is moving the piece's width itself (a tab growing in
   * on its own spring): the piece follows its layout frame by frame and starts nothing.
   */
  readonly hold?: () => boolean;
}

/**
 * Makes `el` follow its content's width on `smooth`. Returns the disposer, which stops any
 * motion and leaves the piece at its content's width.
 */
export function springWidth(el: HTMLElement, o: SpringWidthOptions = {}): () => void {
  let drawn = el.getBoundingClientRect().width;
  let motion: Motion | null = null;
  let viewport = window.innerWidth;
  let held: HTMLElement[] = [];

  const release = () => {
    for (const child of held) child.style.removeProperty('flex');
    held = [];
    el.removeAttribute(RESIZING);
    el.removeAttribute(TARGET_WIDTH);
  };

  /** Reads the piece's resting width and its children's, with no motion on it. */
  const rest = (): { width: number; children: number[] } => {
    const kids = [...el.children] as HTMLElement[];
    return {
      width: el.getBoundingClientRect().width,
      children: kids.map((child) => child.getBoundingClientRect().width),
    };
  };

  const start = (from: number, to: number, children: readonly number[], velocity?: number) => {
    el.setAttribute(RESIZING, '');
    el.setAttribute(TARGET_WIDTH, String(to));
    held = [...el.children] as HTMLElement[];
    held.forEach((child, i) => child.style.setProperty('flex', `0 0 ${children[i] ?? 0}px`));
    const next = animateStyle(el, 'width', from, to, {
      spring: 'smooth',
      ...(velocity === undefined ? {} : { velocity }),
    });
    motion = next;
    void next.finished.then(() => {
      if (motion !== next) return;
      motion = null;
      release();
      drawn = el.getBoundingClientRect().width;
    });
  };

  /** The content changed while the width moves: retarget from where it is drawn. */
  const retarget = () => {
    const running = motion;
    if (!running) return;
    const { value, velocity } = running.stop();
    motion = null;
    release();
    el.style.removeProperty('width');
    const now = rest();
    if (reducedMotion() || Math.abs(now.width - value) < STILL) {
      drawn = now.width;
      return;
    }
    start(value, now.width, now.children, velocity);
  };

  const resized = new ResizeObserver(() => {
    if (motion) return;
    const width = el.getBoundingClientRect().width;
    const from = drawn;
    drawn = width;
    const resizedWindow = window.innerWidth !== viewport;
    viewport = window.innerWidth;
    if (resizedWindow || o.hold?.() || reducedMotion() || Math.abs(width - from) < STILL) return;
    if (from <= 0 || width <= 0) return;
    start(from, width, rest().children);
  });
  resized.observe(el);

  let queued = 0;
  // The piece's own attributes and inline styles are this motion's writes, not content.
  const content = (record: MutationRecord) =>
    record.type !== 'attributes' || (record.target !== el && record.attributeName !== 'style');
  const mutated = new MutationObserver((records) => {
    if (!motion || queued || !records.some(content)) return;
    queued = requestAnimationFrame(() => {
      queued = 0;
      if (o.hold?.()) {
        // The content takes over: the piece follows its layout from here.
        motion?.stop();
        motion = null;
        release();
        el.style.removeProperty('width');
        drawn = el.getBoundingClientRect().width;
        return;
      }
      retarget();
    });
  });
  mutated.observe(el, { childList: true, subtree: true, characterData: true, attributes: true });

  return () => {
    resized.disconnect();
    mutated.disconnect();
    if (queued) cancelAnimationFrame(queued);
    motion?.stop();
    motion = null;
    release();
    el.style.removeProperty('width');
  };
}
