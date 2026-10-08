/**
 * The palette's floating strip (owner feedback F3, which supersedes `10-ink` §2.2's "second row
 * inside the palette's glass"): the ink strip as its own small glass piece above the capsule,
 * centred over it, hugging its content, so the palette stays one bar and no row of glass stands
 * empty at either side of the strip.
 *
 * - **Material.** The capsule's M2 (`mat mat-bar s9 c10 h8`), the pill radius, a 1 px rim; its
 *   height is one bar (44 fine, 56 coarse) and its ends are concentric with the colour well and
 *   the readout. It is a sibling of the capsule, never inside it (Q-4: no glass in glass), and
 *   the dock's column sets it 8 px above the capsule, which it rides as the capsule morphs.
 * - **Presence.** It rises in when a tool with options arms (opacity and a 6 px rise on
 *   `--spring-smooth`) and drops out when Select or a disarm takes the strip away (on
 *   `--spring-quick`), `inert` and hidden from assistive technology from its first frame out.
 *   A content asked back mid-exit rises in again from where it got to. Under reduced motion
 *   only the fade runs, within 150 ms (`animateStyle`, A-9).
 * - **Between tools** the piece morphs its own width on `--spring-smooth` (contained, Q-6) and
 *   the new content fades in, so a pen's strip turning into the eraser's never jumps.
 * - **Stroke fade** (MK-17): faded to 20 % with the capsule while a stroke is in progress.
 * - **Keys.** In the DOM after the capsule, so Tab goes from the tools into the strip; Esc runs
 *   the palette's ladder (`paletteEscape`). Focus inside a piece that leaves goes back to the
 *   palette's Tab stop rather than to the page.
 */
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';

import { animateStyle, type Motion, stopTransform } from '../motion/animate';
import { reducedMotion } from '../motion/reduced-motion';
import { duration, EASE } from '../motion/tokens';
import { centredRoom, snapToWholePixels } from '../ui/whole-pixels';
import { InkStrip, type StripKind } from './InkStrip';
import { paletteEscape } from './MarkupPalette';
import { SignatureChips } from './SignGroup';
import styles from './StripPiece.module.css';

/** What the piece holds: an armed tool's ink strip, or the Fill & sign door's chips. */
export type StripContent = StripKind | 'chips';

/** How far the piece rises as it comes in, and drops as it goes (px). */
const RISE = 6;

interface Seen {
  readonly shown: StripContent | null;
  readonly leaving: boolean;
}

export function StripPiece({
  content,
  stroking = false,
}: {
  /** What to show, or null to let the piece go. */
  readonly content: StripContent | null;
  readonly stroking?: boolean | undefined;
}): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  // The content drawn: the one asked for, or, while the piece goes, the one it had.
  const [shown, setShown] = useState<StripContent | null>(content);
  if (content !== null && content !== shown) setShown(content);
  const leaving = content === null && shown !== null;
  const present = shown !== null;
  const seen = useRef<Seen>({ shown: null, leaving: false });
  const fade = useRef<Motion | null>(null);
  const size = useRef<Motion | null>(null);
  // The width as last drawn (a width in flight included), read before a new content lays out.
  const drawn = useRef(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(() => {
      drawn.current = el.getBoundingClientRect().width;
    });
    observer.observe(el);
    drawn.current = el.getBoundingClientRect().width;
    return () => observer.disconnect();
  }, [present]);

  // The content's width rounds so the piece, centred over the capsule, rests on whole pixels.
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return undefined;
    return snapToWholePixels(inner, 'width', {
      container: () => centredRoom(inner, '[data-strip-piece]'),
    });
  }, [present]);

  useLayoutEffect(() => {
    const was = seen.current;
    seen.current = { shown, leaving };
    const el = ref.current;
    if (!el || shown === null) return;
    const reduced = reducedMotion();
    if (leaving && !was.leaving) {
      // Focus in the strip goes back to the palette's Tab stop, not to the page.
      if (el.contains(el.ownerDocument.activeElement)) {
        el.ownerDocument
          .querySelector<HTMLElement>('[data-markup-palette] [role="toolbar"] [tabindex="0"]')
          ?.focus({ preventScroll: true });
      }
      size.current?.stop();
      size.current = null;
      el.style.removeProperty('width');
      fade.current = animateStyle(el, 'opacity', fade.current?.value ?? 1, 0, {
        spring: 'quick',
        keep: true,
        onComplete: () => setShown(null),
      });
      if (!reduced) {
        const from = stopTransform(el)?.value ?? [0, 0];
        animateStyle(el, 'transform', from, [0, RISE], { spring: 'quick', keep: true });
      }
      return;
    }
    if (leaving) return;
    if (was.shown === null || was.leaving) {
      // Rising in: from nothing, or from where a leave had got to.
      const from = was.leaving ? (fade.current?.value ?? 0) : 0;
      fade.current = animateStyle(el, 'opacity', from, 1, {
        spring: 'smooth',
        onComplete: () => {
          fade.current = null;
        },
      });
      if (!reduced) {
        const start = was.leaving ? (stopTransform(el)?.value ?? [0, RISE]) : [0, RISE];
        animateStyle(el, 'transform', start, [0, 0], { spring: 'smooth' });
      } else {
        stopTransform(el);
      }
      return;
    }
    if (was.shown !== shown) {
      // Another tool's strip: the piece's own width moves, the new content fades in.
      const from = drawn.current;
      size.current?.stop();
      size.current = null;
      el.style.removeProperty('width');
      const to = el.getBoundingClientRect().width;
      if (!reduced && from > 0 && Math.abs(from - to) >= 0.5) {
        const motion = animateStyle(el, 'width', from, to, { spring: 'smooth' });
        size.current = motion;
        void motion.finished.then(() => {
          if (size.current === motion) size.current = null;
        });
      }
      innerRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: duration('base'),
        easing: EASE.out,
        fill: 'backwards',
      });
    }
  });

  if (shown === null) return null;
  return (
    <div
      ref={ref}
      className={styles.piece}
      data-strip-piece=""
      data-strip-content={shown}
      data-leaving={leaving ? '' : undefined}
      data-stroking={stroking ? '' : undefined}
      data-annotation-keep=""
      aria-hidden={leaving ? true : undefined}
      inert={leaving}
      onKeyDownCapture={paletteEscape}
    >
      <div ref={innerRef} className={styles.content}>
        {shown === 'chips' ? <SignatureChips /> : <InkStrip kind={shown} />}
      </div>
    </div>
  );
}
