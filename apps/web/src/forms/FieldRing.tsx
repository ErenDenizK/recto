/**
 * The active field's ring, one shared element across fields and pages (motion-2026-10
 * forms-compact §1; spec document-tools §1 "Tab / Shift+Tab").
 *
 * Moving from one field to the next (Tab, Shift+Tab, the stepper's ‹ ›, a click on the next
 * field) slides the ring from the field it left to the one it lands on, on the `smooth` spring:
 * its position by `transform` and its size by `width` and `height` (a ring scaled from a text
 * line to a check box would thicken), so it never jumps or fades in place. The ring it leaves
 * records where it was on screen as it unmounts; the next one starts there if that was within
 * `HANDOFF_MS` (a Tab unmounts one and mounts the next in one commit; a click elsewhere a
 * moment later). A field opened from nowhere (the first Tab, a Forms panel row) has its ring
 * appear in place. The landing field is then scrolled into view smoothly, nearest edge first.
 *
 * Under reduced motion the ring is simply there and the scroll is instant (language.md §7.5).
 * At rest the ring has no transform, size or `will-change` inline (Q-2).
 */
import { useLayoutEffect, useRef } from 'react';

import { animateStyle, reducedMotion, type Styled } from '../motion';
import type { Box } from '../viewer/geometry';
import styles from './FormLayer.module.css';

/** A ring that unmounted this recently hands its place to the next one, ms. */
export const HANDOFF_MS = 400;

/** Where the last ring was on screen as it unmounted, and when. */
let last: { readonly rect: DOMRect; readonly at: number } | null = null;

/** Forgets the hand-off (tests). */
export function resetFieldRing(): void {
  last = null;
}

export function FieldRing({ box }: { readonly box: Box }) {
  const ref = useRef<HTMLSpanElement>(null);

  // The flight from the last ring, then the scroll that shows the field.
  useLayoutEffect(() => {
    const ring = ref.current;
    if (!ring) return undefined;
    const from = last && performance.now() - last.at <= HANDOFF_MS ? last.rect : null;
    last = null;
    const reduced = reducedMotion();
    if (from && !reduced) {
      const to = ring.getBoundingClientRect();
      if (to.width > 0 && to.height > 0) {
        const el = ring as Styled;
        animateStyle(el, 'transform', [from.left - to.left, from.top - to.top], [0, 0], {
          spring: 'smooth',
        });
        animateStyle(el, 'width', from.width, to.width, { spring: 'smooth' });
        animateStyle(el, 'height', from.height, to.height, { spring: 'smooth' });
      }
    }
    // After the page (if it changed) has been brought in: the nearest edge, smoothly.
    const frame = requestAnimationFrame(() => {
      if (!ring.isConnected) return;
      ring.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: reduced ? 'auto' : 'smooth',
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      // Still attached while React unmounts it: where it is now, for the next ring.
      if (ring.isConnected) last = { rect: ring.getBoundingClientRect(), at: performance.now() };
    };
  }, []);

  return (
    <span
      className={styles.ringBox}
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
      aria-hidden="true"
      data-field-ring=""
    >
      <span ref={ref} className={styles.ring} />
    </span>
  );
}
