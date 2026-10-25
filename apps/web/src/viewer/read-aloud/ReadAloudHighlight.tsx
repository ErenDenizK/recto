/**
 * The sentence and the word being read, marked on their page (PRD-34). Find's lime, lighter: a
 * soft tint over the whole sentence (the mark that stays when a voice sends no word events) and a
 * translucent fill with an underline on the word, so a short word on a light page stays legible.
 * The tone follows the page under it (`darkUnder`, Find's: the bitmap's lightness), drawn a
 * frame after the mark. While the page follows the voice, the word comes into view when it
 * leaves the window or sinks under the player.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { reducedMotion } from '../../motion';
import type { PageOverlayProps } from '../../stage/page-overlays';
import { userRectToCss } from '../geometry';
import { pageFrame } from '../page-frame';
import { darkUnder } from '../SearchHighlights';
import { useReadAloudStore } from './controller';
import styles from './ReadAloudHighlight.module.css';

/** Clear space from the window's top, and above the player (or the capsule), CSS px. */
const EDGE_TOP = 72;
const EDGE_GAP = 16;
const EDGE_BOTTOM_FALLBACK = 144;

/** The word counts as out of view below this line: the player's measured top less a margin. */
export function bottomEdge(): number {
  const player = document.querySelector('[data-read-aloud-player]');
  return player
    ? player.getBoundingClientRect().top - EDGE_GAP
    : window.innerHeight - EDGE_BOTTOM_FALLBACK;
}

export function ReadAloudHighlight(props: PageOverlayProps) {
  const pageId = useReadAloudStore((s) => s.pageId);
  const word = useReadAloudStore((s) => s.word);
  const sentence = useReadAloudStore((s) => s.sentence);
  const following = useReadAloudStore((s) => s.following);
  const layer = useRef<HTMLDivElement>(null);
  const [tones, setTones] = useState<readonly boolean[]>([]);
  const mine = pageId === props.pageId && (word.length > 0 || sentence.length > 0);
  useLayoutEffect(() => {
    if (mine && layer.current) setTones(darkUnder(layer.current) ?? []);
  }, [mine, word, sentence]);
  useEffect(() => {
    const box = layer.current?.querySelector('[data-word]');
    if (!mine || !box || !following) return;
    const r = box.getBoundingClientRect();
    if (r.top < EDGE_TOP || r.bottom > bottomEdge()) {
      // Centred in the room above the player.
      box.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  }, [mine, word, following]);
  if (!mine) return null;
  const frame = pageFrame(props);
  const place = (rect: (typeof word)[number]) => {
    const box = userRectToCss(frame, rect);
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  };
  return (
    <div ref={layer} className={styles.layer} aria-hidden="true" data-testid="read-aloud-word">
      {sentence.map((rect, i) => (
        <div
          key={`s${rect.x}:${rect.y}`}
          className={styles.sentence}
          data-tone={tones[i] ? 'dark' : undefined}
          style={place(rect)}
        />
      ))}
      {word.map((rect, i) => (
        <div
          key={`w${rect.x}:${rect.y}`}
          className={styles.word}
          data-word=""
          data-tone={tones[sentence.length + i] ? 'dark' : undefined}
          style={place(rect)}
        />
      ))}
    </div>
  );
}
