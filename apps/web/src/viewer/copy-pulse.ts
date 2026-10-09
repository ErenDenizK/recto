/**
 * Copy confirms on the selection (motion-2026-10 viewer.md §5): once page text is copied (the
 * selection bar's Copy, or Mod+C), the selected lines pulse once in the page's selection blue,
 * so the eye sees what went to the clipboard where it looked. The pulse is a box per selected
 * line, laid in the page it belongs to (so it passes under the glass with the page), that rises
 * to a light wash on `--duration-fast` and fades on `--duration-slow`; the boxes go when it
 * ends. Opacity only; under reduced motion the whole pulse takes 150 ms (A-9).
 */
import { reducedMotion } from '../motion/reduced-motion';
import { duration, EASE } from '../motion/tokens';
import styles from './CopyPulse.module.css';

/** The pages the selection's lines are in, with their client rects. */
function selectedLines(selection: Selection): Map<HTMLElement, DOMRect[]> {
  const lines = new Map<HTMLElement, DOMRect[]>();
  if (selection.isCollapsed || selection.rangeCount === 0) return lines;
  const range = selection.getRangeAt(0);
  const root = range.commonAncestorContainer;
  const scope =
    (root instanceof Element ? root : root.parentElement)?.closest('[data-read-viewport]') ??
    root.ownerDocument;
  if (!scope) return lines;
  const pages = scope.querySelectorAll<HTMLElement>('[data-page-id]');
  const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
  for (const page of pages) {
    if (!selection.containsNode(page, true)) continue;
    const box = page.getBoundingClientRect();
    const inside = rects.filter(
      (r) =>
        r.left >= box.left - 1 &&
        r.right <= box.right + 1 &&
        r.top >= box.top - 1 &&
        r.bottom <= box.bottom + 1,
    );
    if (inside.length > 0) lines.set(page, inside);
  }
  return lines;
}

/** Pulses the lines of `selection` once (module header); returns the number of boxes. */
export function pulseSelection(selection: Selection | null): number {
  if (!selection) return 0;
  let count = 0;
  // Under reduced motion the whole pulse fits A-9's 150 ms.
  const total = reducedMotion() ? duration('base') : duration('fast') + duration('slow');
  const fadeIn = reducedMotion() ? total / 3 : duration('fast');
  for (const [page, rects] of selectedLines(selection)) {
    const box = page.getBoundingClientRect();
    // The page's own scale: a transformed column (a zoom in flight) shows it scaled.
    const scale = page.offsetWidth > 0 ? box.width / page.offsetWidth : 1;
    const layer = page.ownerDocument.createElement('div');
    layer.className = styles.layer ?? '';
    layer.dataset.copyPulse = '';
    layer.setAttribute('aria-hidden', 'true');
    for (const r of rects) {
      const line = page.ownerDocument.createElement('div');
      line.className = styles.line ?? '';
      Object.assign(line.style, {
        left: `${(r.left - box.left) / scale}px`,
        top: `${(r.top - box.top) / scale}px`,
        width: `${r.width / scale}px`,
        height: `${r.height / scale}px`,
      });
      layer.append(line);
      count += 1;
    }
    page.append(layer);
    if (typeof layer.animate !== 'function') {
      layer.remove();
      continue;
    }
    const pulse = layer.animate(
      [
        { opacity: 0, easing: EASE.out },
        { opacity: 1, offset: fadeIn / total, easing: EASE.standard },
        { opacity: 0 },
      ],
      { duration: total },
    );
    pulse.onfinish = pulse.oncancel = () => layer.remove();
  }
  return count;
}
