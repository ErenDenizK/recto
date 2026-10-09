/**
 * The palette's floating strip (owner feedback F3, which supersedes `10-ink` §2.2's "second row
 * inside the palette's glass"): the ink strip as its own small glass piece above the capsule,
 * hugging its content, so the palette stays one bar and no row of glass stands empty at either
 * side of the strip.
 *
 * - **Material.** The capsule's M2 (`mat mat-bar s8 c9 h8`), the pill radius, a 1 px rim; its
 *   height is one piece (--piece-h, 40 fine, 48 coarse) and its ends are concentric with the
 *   colour well and the readout. It is a sibling of the capsule, never inside it (Q-4: no glass
 *   in glass), and the dock's column sets it 8 px above the capsule.
 * - **Place.** Anchored to the capsule's leading edge (system-audit-2026-10 §3.7), not centred
 *   over it: with the strip's one layout, the well and the slider stay put between tools. It
 *   rides the capsule's edge as the capsule morphs and keeps --piece-inset from the band's ends.
 * - **Presence.** It rises in when a tool with options arms (opacity and the *tier rise*, 8 px
 *   and 0.98 about its bottom edge, on `--spring-smooth`, the capsule's morph spring, so strip
 *   and capsule move as one) and sinks back toward the capsule when Select or a disarm takes
 *   the strip away (on `--spring-quick`), `inert` and hidden from assistive technology from
 *   its first frame out.
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
import { snapToWholePixels } from '../ui/whole-pixels';
import { InkStrip, type StripKind } from './InkStrip';
import { paletteEscape } from './MarkupPalette';
import { SignatureChips } from './SignGroup';
import styles from './StripPiece.module.css';

/** What the piece holds: an armed tool's ink strip, or the Fill & sign door's chips. */
export type StripContent = StripKind | 'chips';

/**
 * How the piece comes in and goes (*tier rise*, language.md §7.3; G6): from 8 px lower and
 * 0.98 of its size, about its bottom edge (the capsule's side), so it rises out of the capsule
 * and sinks back into it. `[x, y, scaleX, scaleY]`.
 */
const AWAY = [0, 8, 0.98, 0.98] as const;
const HOME = [0, 0, 1, 1] as const;

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

  // The content's width rounds so the piece, held by its leading edge, rests on whole pixels.
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return undefined;
    return snapToWholePixels(inner, 'width');
  }, [present]);

  // The piece rests at the capsule's leading edge (system-audit-2026-10 §3.7), on a whole pixel
  // and inside the band less --piece-inset each side; it follows the capsule as it morphs.
  useLayoutEffect(() => {
    const el = ref.current;
    const dock = el?.parentElement;
    const capsule = dock?.querySelector<HTMLElement>('[data-capsule]');
    if (!el || !dock || !capsule) return undefined;
    const place = () => {
      const room = dock.getBoundingClientRect();
      const at = capsule.getBoundingClientRect().left - room.left;
      const inset = Number.parseFloat(getComputedStyle(el).getPropertyValue('--piece-inset')) || 0;
      const start = `${Math.round(Math.max(inset, Math.min(at, room.width - inset - el.offsetWidth)))}px`;
      if (el.style.getPropertyValue('--strip-start') !== start) {
        el.style.setProperty('--strip-start', start);
      }
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(capsule);
    observer.observe(dock);
    observer.observe(el);
    return () => observer.disconnect();
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
        const from = stopTransform(el)?.value ?? HOME;
        animateStyle(el, 'transform', from, AWAY, { spring: 'quick', keep: true });
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
        // On the capsule's own spring (its *bar morph*, `smooth`), so the two move as one.
        const start = was.leaving ? (stopTransform(el)?.value ?? AWAY) : AWAY;
        animateStyle(el, 'transform', start, HOME, { spring: 'smooth' });
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
