/**
 * Glass on whole pixels (quality-bar Q-2: "its position rounds to whole device pixels"; V2 review
 * item 16). A surface placed by its own size, centred by auto margins or a flex row, or held by
 * its far edge, lands wherever its content's fractional size puts it: the dock at x 517.72 for
 * its 404.56 px of labels, the page pill at x 1314.69, a dialog at y 174.09 for its 551.81 px of
 * content. `snapToWholePixels` raises the element's `min-width` or `min-height` by under two
 * device pixels so its size is whole and, centred in a container, leaves an even remainder, so
 * both edges rest on whole device pixels. Nothing moves by transform (Q-2 keeps rest transforms
 * whole), and a size held by `max-width` or `max-height` is left alone (already whole there).
 */

export type SnapAxis = 'width' | 'height';

export interface SnapOptions {
  /**
   * The room the element is centred in, along the axis (undefined: not centred now, so only
   * its size rounds, as for an element held by one edge).
   */
  readonly container?: (() => number | undefined) | undefined;
}

/** The size to give a box of `natural` size so it rests on whole device pixels. */
export function wholePixelSize(natural: number, dpr: number, container?: number): number {
  const scale = dpr > 0 ? dpr : 1;
  // A hair over a whole device pixel is layout noise, not a pixel to add.
  let device = Math.ceil(natural * scale - 0.01);
  if (container !== undefined) {
    const room = container * scale;
    // A container off whole pixels cannot centre on them; a whole one needs an even remainder.
    if (Math.abs(room - Math.round(room)) < 0.01 && (Math.round(room) - device) % 2 !== 0) {
      device += 1;
    }
  }
  return device / scale;
}

/**
 * Keeps `element`'s size along `axis` on whole device pixels while it lives; returns a
 * disposer that removes the minimum it set.
 */
export function snapToWholePixels(
  element: HTMLElement,
  axis: SnapAxis,
  options: SnapOptions = {},
): () => void {
  const property = axis === 'width' ? 'min-width' : 'min-height';
  const limit = axis === 'width' ? 'maxWidth' : 'maxHeight';
  const fit = () => {
    element.style.removeProperty(property);
    const style = getComputedStyle(element);
    // The used size, untouched by a transform in flight (an entrance's scale).
    const natural = Number.parseFloat(axis === 'width' ? style.width : style.height);
    if (!Number.isFinite(natural) || natural <= 0) return;
    const max = Number.parseFloat(style[limit]);
    if (Number.isFinite(max) && natural >= max - 0.01) return;
    const target = wholePixelSize(natural, window.devicePixelRatio || 1, options.container?.());
    if (target - natural > 0.001) element.style.setProperty(property, `${target}px`);
  };
  fit();
  const observer = new ResizeObserver(fit);
  observer.observe(element);
  // The content changes the natural size without resizing the element once its minimum holds.
  for (const child of Array.from(element.children)) observer.observe(child);
  window.addEventListener('resize', fit);
  return () => {
    observer.disconnect();
    window.removeEventListener('resize', fit);
    element.style.removeProperty(property);
  };
}

/**
 * The room a surface centred in its parent leaves its content (`content` inside the surface
 * `closest(selector)` finds): the parent's width less the surface's border and padding. The
 * capsule's contents (the dock's bar, the Markup palette) round against it, so the capsule,
 * which rests at its content's size, lands on whole pixels too.
 */
export function centredRoom(content: HTMLElement, selector: string): number | undefined {
  const surface = content.closest<HTMLElement>(selector);
  const parent = surface?.parentElement;
  if (!surface || !parent) return undefined;
  const style = getComputedStyle(surface);
  const chrome = ['borderLeftWidth', 'borderRightWidth', 'paddingLeft', 'paddingRight'] as const;
  return chrome.reduce(
    (room, side) => room - (Number.parseFloat(style[side]) || 0),
    parent.clientWidth,
  );
}
