/**
 * Mounts read aloud (PRD-34, `?read=1`): the player and the page layer that rings the word. Loaded
 * only when the flag is on and the browser can speak, so the default adds nothing to the first
 * load.
 */
import { useLayoutEffect } from 'react';

import { registerPageOverlay } from '../../stage/page-overlays';
import { stopFollowing, watchReadAloudDocument } from './controller';
import { ReadAloudHighlight } from './ReadAloudHighlight';
import { ReadAloudPlayer } from './ReadAloudPlayer';

export default function ReadAloudHost() {
  useLayoutEffect(() => registerPageOverlay(ReadAloudHighlight), []);
  useLayoutEffect(() => watchReadAloudDocument(), []);
  // A hand on the scroll (wheel, touch, a drag on the bar) ends the page's following of the voice.
  useLayoutEffect(() => {
    const events = ['wheel', 'touchmove'] as const;
    for (const name of events) addEventListener(name, stopFollowing, { passive: true });
    return () => {
      for (const name of events) removeEventListener(name, stopFollowing);
    };
  }, []);
  return <ReadAloudPlayer />;
}
