/**
 * The soft scroll edge (`components/01-frame.md` F1 §3; research 16 G-19; spec 01.9): a 24 px
 * band under the strip, the canvas colour fading to nothing, shown only once the page has
 * scrolled, so text passing under the strip dissolves instead of being cut. Jumps land 24 px
 * below the strip (the reader's scroll padding), so it never covers a target. Pointer-
 * transparent and `aria-hidden`; gone in forced colours. Its visibility is an attribute set
 * from the reader's scroll, not React state: scrolling renders nothing.
 */
import { useEffect, useRef } from 'react';

import styles from './DockBand.module.css';

export function SoftEdge() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const edge = ref.current;
    if (!edge) return;
    const onScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.hasAttribute('data-read-viewport')) return;
      edge.toggleAttribute('data-shown', target.scrollTop > 0);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, true);
  }, []);
  return <div ref={ref} className={styles.softEdge} aria-hidden="true" />;
}
