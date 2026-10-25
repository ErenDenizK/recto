/**
 * The word being read, ringed on its page (PRD-34): Find's current-hit mark (`SearchHighlights`,
 * DSN-16, DSN-62), so a word read aloud looks like a word found. It brings itself into view when
 * the voice reads past the edge of the window. It takes Find's tone for the page under it
 * (`darkUnder`: the bitmap's lightness), a frame after it is drawn.
 */
import { useEffect, useRef, useState } from 'react';

import { reducedMotion } from '../../motion';
import type { PageOverlayProps } from '../../stage/page-overlays';
import { userRectToCss } from '../geometry';
import { pageFrame } from '../page-frame';
import { darkUnder } from '../SearchHighlights';
import hits from '../SearchHighlights.module.css';
import { useReadAloudStore } from './controller';

/** How far from the window's top and bottom a word counts as out of view, CSS px. */
const EDGE_TOP = 72;
const EDGE_BOTTOM = 144;

export function ReadAloudHighlight(props: PageOverlayProps) {
  const pageId = useReadAloudStore((s) => s.pageId);
  const word = useReadAloudStore((s) => s.word);
  const layer = useRef<HTMLDivElement>(null);
  const [tones, setTones] = useState<readonly boolean[]>([]);
  const mine = pageId === props.pageId && word.length > 0;
  // Find's tone: lifted (screen) on a dark part of the page, darkened (multiply) on a light one.
  useEffect(() => {
    if (mine && layer.current) setTones(darkUnder(layer.current) ?? []);
  }, [mine, word]);
  useEffect(() => {
    const box = layer.current?.firstElementChild;
    if (!mine || !box) return;
    const r = box.getBoundingClientRect();
    // Clear of the player and the capsule below it, and of the strip above.
    if (r.top < EDGE_TOP || r.bottom > window.innerHeight - EDGE_BOTTOM) {
      box.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  }, [mine, word]);
  if (!mine) return null;
  const frame = pageFrame(props);
  return (
    <div ref={layer} className={hits.layer} aria-hidden="true" data-testid="read-aloud-word">
      {word.map((rect, i) => {
        const box = userRectToCss(frame, rect);
        return (
          <div
            key={`${rect.x}:${rect.y}`}
            className={hits.hit}
            data-tone={tones[i] ? 'dark' : undefined}
            data-current
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          />
        );
      })}
    </div>
  );
}
