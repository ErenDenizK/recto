/**
 * The overlay scroll thumb (owner, R21 brief B-6; decisions GLS-24): the app's one scroll bar,
 * drawn over a touch reader's pages. Everywhere else the scroll bar is CSS
 * (`styles/scrollbars.css`); a reader on a coarse pointer hides its native indicator (the page
 * view reaches under the chrome, the phone's pages fill the screen), so this stands in for it.
 *
 * - **Look.** The CSS bar's thumb: a slim capsule in `--scroll-thumb` with its soft edge, no
 *   track, at the trailing edge of the box its parent gives it.
 * - **Shown** while the target scrolls, faded in over `--duration-fast` and out over
 *   `--duration-base` 900 ms after the last scroll. At rest it is transparent and nothing runs
 *   (MOT-4): no frame loop, only a timer after a scroll.
 * - **No layout during a scroll** (A-23): sizes are measured by a `ResizeObserver` on the target,
 *   its content and the track (which reports each once when observed); a scroll reads
 *   `scrollTop` and writes one `transform`.
 * - Decorative (`aria-hidden`, no pointer): keyboard and screen readers keep native scrolling,
 *   and a long document's page scrubber, where it shows, is the thumb a finger drags.
 *
 * Kept small on purpose: the phone edition's bundle has a few hundred bytes to spare.
 */
import { useEffect, useRef } from 'react';

import styles from './ScrollThumb.module.css';

/** The thumb fades out this long after the last scroll. */
export const SCROLL_THUMB_LINGER_MS = 900;

export function ScrollThumb({
  target,
  className = '',
}: {
  /** The scroller the thumb follows. */
  readonly target: HTMLElement | null;
  /** Places the track (its default is the parent's trailing edge). */
  readonly className?: string | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = ref.current;
    const thumb = track?.firstElementChild as HTMLElement | null | undefined;
    if (!target || !track || !thumb) return;
    // The scroll range and the thumb's travel, CSS px, as last measured.
    let range = 0;
    let travel = 0;
    let timer = 0;
    const place = () => {
      const at = range > 0 ? Math.min(1, target.scrollTop / range) : 0;
      thumb.style.transform = `translateY(${Math.round(at * travel)}px)`;
    };
    const measure = () => {
      const view = target.clientHeight;
      const room = track.clientHeight;
      range = target.scrollHeight - view;
      // The shortest thumb is 32 px, however long the content.
      const size = range > 0 ? Math.min(room, Math.max(32, (room * view) / (range + view))) : 0;
      travel = room - size;
      thumb.style.height = `${size}px`;
      place();
    };
    const onScroll = () => {
      if (range <= 0) return;
      place();
      if (!track.hasAttribute('data-shown')) track.setAttribute('data-shown', '');
      clearTimeout(timer);
      timer = window.setTimeout(() => track.removeAttribute('data-shown'), SCROLL_THUMB_LINGER_MS);
    };
    const resize = new ResizeObserver(measure);
    for (const el of [target, track, ...target.children]) resize.observe(el);
    target.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      resize.disconnect();
      target.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, [target]);

  return (
    <div ref={ref} className={`${styles.track} ${className}`} aria-hidden="true">
      <div className={styles.thumb} />
    </div>
  );
}
