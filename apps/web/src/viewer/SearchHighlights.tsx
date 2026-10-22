/**
 * Search hits drawn over a page (spec §1): a lime fill per match that reads on a light or a dark
 * page, the current match deeper and ringed so it is not told apart by colour alone (DSN-16,
 * DSN-62).
 */
import type { Rect } from '@pdf-editor/document-model';
import { useState } from 'react';

import type { PageOverlayProps } from '../stage/page-overlays';
import { useWorkspaceStore } from '../state/workspace-store';
import { userRectToCss } from './geometry';
import { pageFrame } from './page-frame';
import { useSearchStore } from './search';
import styles from './SearchHighlights.module.css';

/** Below this median lightness (sRGB, 0..1) of the page bitmap a hit is lifted, not darkened. */
const DARK_PAGE = 0.4;

/**
 * Whether the page under `layer` is dark, from the median lightness of an 8 x 8 reduction of its
 * rendered bitmap (DSN-62: a hit keeps the text under it only when it darkens a light page or
 * lifts a dark one, so it has to know which).
 */
function pageIsDark(layer: HTMLElement): boolean | undefined {
  const canvas = layer.closest('[data-page-index]')?.querySelector('canvas');
  if (canvas?.dataset.state !== 'rendered' || canvas.width === 0) return undefined;
  const probe = document.createElement('canvas');
  probe.width = probe.height = 8;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  if (!ctx) return undefined;
  ctx.drawImage(canvas, 0, 0, 8, 8);
  const { data } = ctx.getImageData(0, 0, 8, 8);
  const light: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    light.push(
      (0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0)) / 255,
    );
  }
  light.sort((a, b) => a - b);
  return (light[32] ?? 1) < DARK_PAGE;
}

export function SearchHighlights(props: PageOverlayProps) {
  const hits = useSearchStore((s) => s.hits);
  const current = useSearchStore((s) => s.current);
  const documentId = useSearchStore((s) => s.documentId);
  const active = useWorkspaceStore((s) => s.workspace.activeDocument);
  const [dark, setDark] = useState(false);
  // Measured when the layer mounts and whenever the page's bitmap finishes rendering.
  const watch = (el: HTMLDivElement) => {
    const canvas = el.closest('[data-page-index]')?.querySelector('canvas');
    if (!canvas) return;
    const measure = () => setDark(pageIsDark(el) ?? false);
    measure();
    const observer = new MutationObserver(measure);
    observer.observe(canvas, { attributes: true, attributeFilter: ['data-state'] });
    return () => observer.disconnect();
  };
  if (hits.length === 0 || documentId !== active) return null;
  const mine: { index: number; rects: readonly Rect[] }[] = [];
  hits.forEach((hit, index) => {
    if (hit.pageId === props.pageId) mine.push({ index, rects: hit.rects });
  });
  if (mine.length === 0) return null;
  const frame = pageFrame(props);
  return (
    <div
      ref={watch}
      className={styles.layer}
      aria-hidden="true"
      data-testid="search-highlights"
      data-tone={dark ? 'dark' : undefined}
    >
      {mine.flatMap(({ index, rects }) =>
        rects.map((rect, i) => {
          const box = userRectToCss(frame, rect);
          return (
            <div
              key={`${index}:${i}`}
              className={styles.hit}
              data-current={index === current || undefined}
              style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
            />
          );
        }),
      )}
    </div>
  );
}
