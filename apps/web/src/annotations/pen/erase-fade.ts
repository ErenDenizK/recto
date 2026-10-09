/**
 * Erased strokes fade (motion-2026-10/ink-shapes.md §5): what an eraser drag removed does not
 * vanish with the page's next bitmap, it fades out over it.
 *
 * At the commit, a ghost of every touched stroke (an ink's paths at their nominal or mean
 * width, a Highlight's quads, in their colour, opacity and blend) is laid on the page's layer,
 * invisible. In the task where a Read canvas draws the first bitmap without them
 * (`onPageBitmap`, the page's revision after the erase), the ghost shows at full strength, so
 * no frame lacks the strokes, and fades out on the slow ease (150 ms under reduced motion);
 * then it goes. A cut stroke's remaining pieces are under the ghost in the new bitmap, so only
 * the erased spans visibly fade. Without a bitmap within `GHOST_WAIT_MS` the ghost just goes.
 */
import type { Annotation } from '@pdf-editor/engine';

import { getEngineService } from '../../engine/engine-service';
import { duration, EASE } from '../../motion/tokens';
import { onPageBitmap } from '../../viewer/read-controller';
import type { PageTarget } from '../annotation-store';
import { type PageFrame, rectToCss, userToCss } from '../geometry';
import { mountedLayers } from '../layer-registry';

/** How long a ghost waits for the page's bitmap before it just goes (ms). */
export const GHOST_WAIT_MS = 3000;

const SVG = 'http://www.w3.org/2000/svg';

/** The ghost of the erased annotations, drawn through `frame` (hidden until shown). */
export function ghostOf(erased: readonly Annotation[], frame: PageFrame): SVGSVGElement | null {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('data-erase-ghost', '');
  Object.assign(svg.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    overflow: 'visible',
    pointerEvents: 'none',
    opacity: '0',
  });
  let count = 0;
  for (const a of erased) {
    const g = document.createElementNS(SVG, 'g');
    g.setAttribute('opacity', String(a.opacity ?? 1));
    const color = a.color ?? '#000000';
    if (a.kind === 'ink') {
      if (a.blendMode === 'multiply') g.style.mixBlendMode = 'multiply';
      a.paths.forEach((path, i) => {
        const widths = a.widths?.[i];
        const mean =
          widths && widths.length > 0
            ? widths.reduce((s, w) => s + w, 0) / widths.length
            : a.strokeWidth;
        const line = document.createElementNS(SVG, 'polyline');
        line.setAttribute(
          'points',
          path
            .map((p) => userToCss(frame, p))
            .map((p) => `${p.x},${p.y}`)
            .join(' '),
        );
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', String(Math.max(0.5, mean * frame.scale)));
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('stroke-linejoin', 'round');
        g.appendChild(line);
        count++;
      });
    } else if (a.kind === 'highlight') {
      g.style.mixBlendMode = 'multiply';
      for (const q of a.quads) {
        const b = rectToCss(frame, q);
        const rect = document.createElementNS(SVG, 'rect');
        rect.setAttribute('x', String(b.left));
        rect.setAttribute('y', String(b.top));
        rect.setAttribute('width', String(b.width));
        rect.setAttribute('height', String(b.height));
        rect.setAttribute('fill', color);
        g.appendChild(rect);
        count++;
      }
    }
    svg.appendChild(g);
  }
  return count > 0 ? svg : null;
}

/**
 * Fades what an erase removed from `target` (`erased`: the annotations as they were before it)
 * once the page shows its bitmap without them. Call it when the erase has committed.
 */
export function fadeErased(target: PageTarget, erased: readonly Annotation[]): void {
  const layer = mountedLayers.get(target.pageId);
  if (!layer || erased.length === 0) return;
  const ghost = ghostOf(erased, layer.frame);
  if (!ghost) return;
  layer.element.appendChild(ghost);
  const revision = getEngineService().pageRevision(target.source, target.pageIndex);
  let timer = 0;
  const finish = () => {
    window.clearTimeout(timer);
    stop();
    ghost.remove();
  };
  const stop = onPageBitmap((source, pageIndex, generation) => {
    if (source !== target.source || pageIndex !== target.pageIndex || generation < revision) {
      return;
    }
    stop();
    window.clearTimeout(timer);
    // The same task as the bitmap without the strokes: the ghost stands in for them, then goes.
    ghost.style.opacity = '1';
    const fade = ghost.animate?.([{ opacity: 1 }, { opacity: 0 }], {
      duration: duration('slow'),
      easing: EASE.out,
      fill: 'forwards',
    });
    if (fade) fade.onfinish = () => ghost.remove();
    else ghost.remove();
  });
  timer = window.setTimeout(finish, GHOST_WAIT_MS);
}
