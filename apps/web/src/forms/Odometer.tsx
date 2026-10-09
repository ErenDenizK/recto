/**
 * An odometer readout (motion-2026-10 forms-compact §3): the field stepper's "3 / 12" and
 * "12 fields" (03-markup MK-14). Each character is a slot, aligned from the end so units stay
 * over units; when the text changes, every slot whose character changed rolls: the new one
 * comes in from below and the old one leaves upward when the number grows, the other way when
 * it shrinks, on the `quick` spring, the old one fading as it goes. The readout clips the
 * slots, so nothing spills above or below the line.
 *
 * Under reduced motion a changed slot fades in (100 ms) and the old one is simply gone.
 * The slots hold the text as it is, so a live region around it still reads it; the leaving
 * characters are hidden from assistive technology.
 */
import { useLayoutEffect, useRef } from 'react';

import { animateStyle, duration, EASE, reducedMotion } from '../motion';
import styles from './FormLayer.module.css';

const segmenter = new Intl.Segmenter();

/** The characters of `text` as a reader sees them (grapheme clusters). */
const glyphs = (text: string): string[] =>
  Array.from(segmenter.segment(text), (part) => part.segment);

/** The number a readout shows first ("3 / 12" → 3), for the roll's direction. */
function leading(text: string): number {
  const match = /\d+/.exec(text.replace(/[\s.,\u00a0\u202f]/g, ''));
  return match ? Number(match[0]) : 0;
}

export function Odometer({
  text,
  className,
}: {
  readonly text: string;
  readonly className?: string | undefined;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(text);
  const chars = glyphs(text);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = text;
    const root = ref.current;
    if (!root || before === text) return;
    const old = glyphs(before);
    const now = glyphs(text);
    const up = leading(text) >= leading(before) ? 1 : -1;
    const reduced = reducedMotion();
    const slots = [...root.querySelectorAll<HTMLElement>('[data-slot]')];
    slots.forEach((slot, i) => {
      // Slots are aligned from the end.
      const was = old[old.length - now.length + i];
      if (was === now[i] || typeof slot.animate !== 'function') return;
      const glyph = slot.firstElementChild as HTMLElement | null;
      if (!glyph) return;
      if (reduced) {
        glyph.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: duration('fast'),
          easing: EASE.out,
        });
        return;
      }
      const h = slot.offsetHeight || 16;
      animateStyle(glyph, 'transform', [0, h * up], [0, 0], { spring: 'quick' });
      if (was === undefined || was.trim() === '') return;
      const ghost = document.createElement('span');
      ghost.className = styles.odometerGhost ?? '';
      ghost.textContent = was;
      ghost.setAttribute('aria-hidden', 'true');
      slot.append(ghost);
      const leave = ghost.animate(
        [
          { transform: 'translateY(0)', opacity: 1 },
          { transform: `translateY(${-h * up}px)`, opacity: 0 },
        ],
        { duration: duration('base'), easing: EASE.exit, fill: 'forwards' },
      );
      leave.onfinish = leave.oncancel = () => ghost.remove();
    });
  }, [text]);

  return (
    <span ref={ref} className={[styles.odometer, className].filter(Boolean).join(' ')}>
      {chars.map((c, i) => (
        // Keyed from the end: "9 / 12" → "10 / 12" keeps "/ 12" in its slots.
        <span key={chars.length - i} className={styles.odometerSlot} data-slot="">
          <span className={styles.odometerGlyph}>{c}</span>
        </span>
      ))}
    </span>
  );
}
