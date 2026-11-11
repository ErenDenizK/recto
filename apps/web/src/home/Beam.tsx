/**
 * Home's light (DSN-94): a static CSS beam that continues the sample cover's lamp across the
 * page. Three clipped, blurred layers, `aria-hidden`, behind the content, inside the Home
 * scroller (so it scrolls with it) and clipped to its box. Nothing animates.
 *
 * Each layer for a lamp at (x, y), length L, angle a, spread s and intensity i is a box
 * `left: x − L; top: y − h/2; width: L` rotated by `a − 180` degrees about its right edge, whose
 * inner fill is clipped to a thin wedge and painted with the beam's ramp (`Beam.module.css`):
 * body (h 2.2 s, blur 70, 0.22 i), mid (h s, blur 26, 0.38 i) and core (h 0.22 s, blur 3,
 * 0.75 i, its own ramp). Degrade 3 and 4 drop the body; Solid glass keeps the core only.
 *
 * - `recents`: the lamp sits 160 past the window's right edge and 80 above the last shelf line
 *   (`data-shelf-line`), L = width + 500, a 183.5, s 170, i 0.4.
 * - `first`: the lamp sits at (77.65 %, 53.4 %) of the sample cover (`data-beam-anchor`), L 1700,
 *   a 184.4, s 150, i 0.95.
 *
 * The lamp is measured, not guessed: it follows the shelf or the cover as they lay out, through
 * a ResizeObserver on the page, and writes three custom properties on the beam's own element, so
 * a resize repaints without a React render.
 */
import { useLayoutEffect, useRef } from 'react';

import styles from './Beam.module.css';

export type BeamKind = 'recents' | 'first';

/** The lamp's place on the sample cover, as the first visit's mockup sets it. */
const COVER_LAMP = { x: 0.7765, y: 0.534 } as const;

export function Beam({ kind }: { readonly kind: BeamKind }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    const page = root?.parentElement;
    if (!root || !page) return undefined;
    const place = () => {
      const box = root.getBoundingClientRect();
      let x = box.width + 160;
      let y = 400;
      let length = box.width + 500;
      if (kind === 'first') {
        const cover = page
          .querySelector<HTMLElement>('[data-beam-anchor]')
          ?.getBoundingClientRect();
        if (cover && cover.width > 0) {
          x = cover.left - box.left + COVER_LAMP.x * cover.width;
          y = cover.top - box.top + COVER_LAMP.y * cover.height;
        }
        length = 1700;
      } else {
        const lines = page.querySelectorAll<HTMLElement>('[data-shelf-line]');
        const stage = lines[lines.length - 1]?.parentElement;
        if (stage) {
          // The line is a mask on a stage that may hold several rows: the first row's foot.
          const foot = Number.parseFloat(getComputedStyle(stage).getPropertyValue('--cover-h'));
          y = stage.getBoundingClientRect().top - box.top + (foot || 224) - 80;
        } else {
          const hero = page.querySelector<HTMLElement>('[data-hero]')?.getBoundingClientRect();
          if (hero) y = hero.bottom - box.top + 96 + 224 - 80;
        }
      }
      root.style.setProperty('--lamp-x', `${x}px`);
      root.style.setProperty('--lamp-y', `${y}px`);
      root.style.setProperty('--beam-len', `${length}px`);
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(page);
    return () => observer.disconnect();
  }, [kind]);

  return (
    <div
      ref={ref}
      className={styles.beam}
      data-kind={kind}
      aria-hidden="true"
      data-testid="home-beam"
    >
      <div className={`${styles.layer} ${styles.body}`}>
        <div className={styles.fill} />
      </div>
      <div className={`${styles.layer} ${styles.mid}`}>
        <div className={styles.fill} />
      </div>
      <div className={`${styles.layer} ${styles.core}`}>
        <div className={`${styles.fill} ${styles.coreFill}`} />
      </div>
    </div>
  );
}
