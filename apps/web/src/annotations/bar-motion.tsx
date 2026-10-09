/**
 * The contextual bars' motion (the annotation bar, the text selection bar; language.md §7.3
 * *popup*, *bar morph*; quality-bar Q-6; motion-2026-10 `library-capsule.md` §6).
 *
 * - **They rise from their anchor** (CSS, each bar's stylesheet): from `--enter-scale`, a
 *   `--rise-distance` toward the selection, scaled about the edge that faces it, on
 *   `--spring-quick` with the fade on `--duration-base`.
 * - **Their width follows their content on a spring** (`springWidth`, Q-6's own geometry): a
 *   selection of another type brings other controls, and the glass grows or narrows to them
 *   instead of jumping. A bar centred on its selection glides its left edge on the same spring
 *   (`glideLeft`), so it grows about its centre.
 * - **Their content cross-fades** (`BarSwap`): the old controls, cloned where they were drawn,
 *   fade out on `--duration-fast` `--ease-exit` while the new ones fade in on `--duration-base`,
 *   so one set of controls never cuts to another. The clones are inert and take no pointer.
 *
 * Under reduced motion the width is instant (the core's rule) and only the fades run (≤ 150 ms).
 */
import { Component, type ReactNode, type RefObject, useLayoutEffect } from 'react';

import { animateStyle } from '../motion/animate';
import { springWidth } from '../motion/resize';
import { duration, EASE } from '../motion/tokens';

/**
 * Makes the bar in `ref` follow its content's width on `smooth` (module header); `shown` says
 * whether the bar is mounted now, for a bar its component mounts and unmounts.
 */
export function useBarWidthSpring(ref: RefObject<HTMLElement | null>, shown = true): void {
  useLayoutEffect(() => {
    const bar = shown ? ref.current : null;
    return bar ? springWidth(bar) : undefined;
  }, [ref, shown]);
}

/**
 * Moves `bar`'s drawn left edge from `from` to where its layout now puts it (`to`) on `smooth`,
 * by transform, so a bar re-centred for a new width grows about its centre.
 */
export function glideLeft(bar: HTMLElement, from: number, to: number): void {
  if (Math.abs(from - to) < 0.5) return;
  animateStyle(bar, 'transform', [from - to, 0], [0, 0], { spring: 'smooth' });
}

/** The old controls, cloned where they were drawn in the bar. */
function cloneContent(bar: HTMLElement): HTMLElement | null {
  const children = [...bar.children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement && !child.hasAttribute(GHOST),
  );
  if (children.length === 0) return null;
  const ghost = document.createElement('div');
  ghost.setAttribute(GHOST, '');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  ghost.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
  for (const child of children) {
    const copy = child.cloneNode(true) as HTMLElement;
    for (const el of [copy, ...copy.querySelectorAll('*')]) el.removeAttribute('id');
    copy.style.position = 'absolute';
    copy.style.left = `${child.offsetLeft}px`;
    copy.style.top = `${child.offsetTop}px`;
    copy.style.width = `${child.offsetWidth}px`;
    copy.style.height = `${child.offsetHeight}px`;
    copy.style.margin = '0';
    ghost.append(copy);
  }
  return ghost;
}

/** Marks a cross-fade's clone in a bar. */
const GHOST = 'data-bar-ghost';

interface SwapProps {
  readonly bar: RefObject<HTMLElement | null>;
  /** A change swaps the bar's controls with a cross-fade (another type of selection). */
  readonly swapKey: string;
  readonly children: ReactNode;
}

/**
 * Cross-fades a bar's controls when `swapKey` changes (module header). The old controls must be
 * read before React replaces them, which only a class component's `getSnapshotBeforeUpdate`
 * can do (the capsule's `MorphBoundary`, the Library's `CardMotionBoundary`).
 */
export class BarSwap extends Component<SwapProps> {
  override getSnapshotBeforeUpdate(previous: SwapProps): HTMLElement | null {
    const bar = this.props.bar.current;
    if (!bar || previous.swapKey === this.props.swapKey) return null;
    return cloneContent(bar);
  }

  override componentDidUpdate(_p: SwapProps, _s: unknown, ghost: HTMLElement | null): void {
    const bar = this.props.bar.current;
    if (!bar || !ghost) return;
    for (const old of bar.querySelectorAll(`:scope > [${GHOST}]`)) old.remove();
    const arriving = [...bar.children];
    bar.append(ghost);
    const out = ghost.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: duration('fast'),
      easing: EASE.exit,
      fill: 'forwards',
    });
    out.onfinish = out.oncancel = () => ghost.remove();
    for (const child of arriving) {
      child.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: duration('base'),
        easing: EASE.out,
        fill: 'backwards',
      });
    }
  }

  override render(): ReactNode {
    return this.props.children;
  }
}
