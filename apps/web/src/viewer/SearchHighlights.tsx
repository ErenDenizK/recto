/**
 * Search hits drawn over a page (spec §1): a lime fill per match that reads on a light or a dark
 * page, the current match deeper and ringed so it is not told apart by colour alone (DSN-16,
 * DSN-62).
 */
import type { Rect } from '@pdf-editor/document-model';
import { useEffect, useRef, useState } from 'react';

import type { PageOverlayProps } from '../stage/page-overlays';
import { useWorkspaceStore } from '../state/workspace-store';
import { userRectToCss } from './geometry';
import { pageFrame } from './page-frame';
import { useSearchStore } from './search';
import styles from './SearchHighlights.module.css';

/** Below this median lightness (sRGB, 0..1) under a hit it is lifted (screen), not darkened. */
const DARK_UNDER = 0.4;
/** The page bitmap is read once per measure at this width, however large it rendered. */
const PROBE_WIDTH = 512;

/**
 * Whether each hit of `layer` lies on a dark part of its page, from the median lightness of the
 * page bitmap under it (DSN-62: a hit keeps the text under it only when it darkens a light
 * ground or lifts a dark one, so it has to know which; a dark callout on a white page counts).
 * `undefined` while the bitmap is not rendered (a zoom's preview).
 */
function darkUnder(layer: HTMLElement): boolean[] | undefined {
  const canvas = layer.closest('[data-page-index]')?.querySelector('canvas');
  if (canvas?.dataset.state !== 'rendered' || canvas.width === 0 || !layer.clientWidth)
    return undefined;
  const w = Math.min(PROBE_WIDTH, canvas.width);
  const h = Math.max(1, Math.round((canvas.height * w) / canvas.width));
  const probe = document.createElement('canvas');
  probe.width = w;
  probe.height = h;
  const ctx = probe.getContext('2d');
  if (!ctx) return undefined;
  ctx.drawImage(canvas, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const sx = w / layer.clientWidth;
  const sy = h / layer.clientHeight;
  return [...layer.children].map((el) => {
    const box = el as HTMLElement;
    const x0 = Math.max(0, Math.floor(box.offsetLeft * sx));
    const y0 = Math.max(0, Math.floor(box.offsetTop * sy));
    const x1 = Math.min(w, Math.max(x0 + 1, Math.ceil((box.offsetLeft + box.offsetWidth) * sx)));
    const y1 = Math.min(h, Math.max(y0 + 1, Math.ceil((box.offsetTop + box.offsetHeight) * sy)));
    const light: number[] = [];
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4;
        light.push(
          (0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0)) /
            255,
        );
      }
    }
    light.sort((p, q) => p - q);
    return (light[light.length >> 1] ?? 1) < DARK_UNDER;
  });
}

export function SearchHighlights(props: PageOverlayProps) {
  const hits = useSearchStore((s) => s.hits);
  const current = useSearchStore((s) => s.current);
  const documentId = useSearchStore((s) => s.documentId);
  const active = useWorkspaceStore((s) => s.workspace.activeDocument);
  const [tones, setTones] = useState<readonly boolean[]>([]);

  const mine: { index: number; rects: readonly Rect[] }[] = [];
  if (hits.length > 0 && documentId === active) {
    hits.forEach((hit, index) => {
      if (hit.pageId === props.pageId) mine.push({ index, rects: hit.rects });
    });
  }
  const count = mine.reduce((n, { rects }) => n + rects.length, 0);
  const layer = useRef<HTMLDivElement>(null);
  // Measured when the layer mounts or its hits change, and whenever the page's bitmap finishes
  // rendering. A zoom's `preview` keeps the last known tones.
  useEffect(() => {
    const el = layer.current;
    const canvas = el?.closest('[data-page-index]')?.querySelector('canvas');
    if (!el || !canvas || count === 0) return;
    const measure = () => {
      const next = darkUnder(el);
      if (next) {
        setTones((was) =>
          was.length === next.length && was.every((v, i) => v === next[i]) ? was : next,
        );
      }
    };
    measure();
    const observer = new MutationObserver(measure);
    observer.observe(canvas, { attributes: true, attributeFilter: ['data-state'] });
    return () => observer.disconnect();
  }, [count, props.pageId]);
  if (count === 0) return null;
  const frame = pageFrame(props);
  let k = 0;
  return (
    <div ref={layer} className={styles.layer} aria-hidden="true" data-testid="search-highlights">
      {mine.flatMap(({ index, rects }) =>
        rects.map((rect, i) => {
          const box = userRectToCss(frame, rect);
          const dark = tones[k++];
          return (
            <div
              key={`${index}:${i}`}
              className={styles.hit}
              data-tone={dark ? 'dark' : undefined}
              data-current={index === current || undefined}
              style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
            />
          );
        }),
      )}
    </div>
  );
}
