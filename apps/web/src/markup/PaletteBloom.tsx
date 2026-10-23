/**
 * The labels that bloom (R26 wow concept 6, DSN-71; `palette-labels.ts`): a label line under the
 * Markup palette's icons. While it is open the capsule is one label line taller (the capsule
 * follows its content's size on the smooth spring, MOT-18; with reduced motion it takes the size
 * at once and the labels only fade), each unlabelled icon shows its name under it, and the
 * groups' hairlines run the full height. Then the labels fade and the capsule settles back.
 *
 * Loaded lazily and only with the flag on. Everything here is drawn over what the palette
 * already renders: names come from the buttons' accessible names, positions from their boxes, so
 * the default row and the grouped palette (`?palette=groups`, whose group names are labels
 * already) both work, and nothing in the palette's own tree changes. The layer is `aria-hidden`:
 * the buttons keep their full names and tooltips, the labels truncate with an ellipsis in a slot
 * as wide as their button and its gap (Q-8: never under 11 px).
 */
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import styles from './PaletteBloom.module.css';
import {
  autoBloomSession,
  FADE_MS,
  HOLD_MS,
  labelsSession,
  REACH_QUIET_MS,
  SHOWN_MS,
} from './palette-labels';

type Phase = 'open' | 'fade' | 'idle';

interface Label {
  readonly text: string;
  readonly left: number;
  readonly width: number;
}

interface Layout {
  readonly labels: readonly Label[];
  readonly seps: readonly number[];
}

/** Press travel that still counts as holding in place (the 10 px slop of `ui/IconButton`). */
const HOLD_SLOP = 10;

/** The buttons without a name of their own and the hairlines between groups, in content space. */
function measure(content: HTMLElement): Layout {
  const origin = content.getBoundingClientRect();
  const labels: Label[] = [];
  const gap = Number.parseFloat(getComputedStyle(content).getPropertyValue('--palette-gap')) || 4;
  for (const el of content.querySelectorAll<HTMLElement>(
    '[role="toolbar"] button[data-size="bar"]:not([data-labelled])',
  )) {
    if (el.closest('[data-item="stepper"]')) continue;
    const text = el.getAttribute('aria-label') ?? '';
    if (text === '') continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0) continue;
    labels.push({ text, left: box.left - origin.left - gap / 2, width: box.width + gap });
  }
  const seps = [...content.querySelectorAll<HTMLElement>('[data-sep]')].map((el) => {
    const box = el.getBoundingClientRect();
    return box.left - origin.left + box.width / 2;
  });
  return { labels, seps };
}

export default function PaletteBloom({
  contentRef,
}: {
  readonly contentRef: RefObject<HTMLElement | null>;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [layout, setLayout] = useState<Layout>({ labels: [], seps: [] });
  const timers = useRef<number[]>([]);
  const lastBloom = useRef(0);
  const swallow = useRef(false);

  const clear = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };
  const bloom = useCallback(() => {
    clear();
    lastBloom.current = Date.now();
    setPhase('open');
    timers.current.push(
      window.setTimeout(() => setPhase('fade'), SHOWN_MS),
      window.setTimeout(() => setPhase('idle'), SHOWN_MS + FADE_MS),
    );
  }, []);

  // The first open and the reaching hand (first two sessions), and the press and hold (always).
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return undefined;
    const auto = autoBloomSession(labelsSession());
    if (auto) timers.current.push(window.setTimeout(bloom, 500));
    let hold = 0;
    let start: { x: number; y: number } | null = null;
    const reach = () => {
      if (auto && Date.now() - lastBloom.current > REACH_QUIET_MS) bloom();
    };
    const onEnter = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') reach();
    };
    const stopHold = () => {
      window.clearTimeout(hold);
      start = null;
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') reach();
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      // A choice tool's own long press opens its menu: leave those presses alone.
      if (event.target instanceof Element && event.target.closest('[aria-haspopup]')) return;
      start = { x: event.clientX, y: event.clientY };
      window.clearTimeout(hold);
      hold = window.setTimeout(() => {
        swallow.current = true;
        bloom();
      }, HOLD_MS);
    };
    const onMove = (event: PointerEvent) => {
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > HOLD_SLOP) {
        stopHold();
      }
    };
    // The release after a hold is not a tap on the tool under the finger.
    const onClick = (event: MouseEvent) => {
      if (!swallow.current) return;
      swallow.current = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const onUp = () => {
      stopHold();
      window.setTimeout(() => {
        swallow.current = false;
      }, 0);
    };
    content.addEventListener('pointerenter', onEnter);
    content.addEventListener('pointerdown', onDown);
    content.addEventListener('pointermove', onMove);
    content.addEventListener('pointerup', onUp);
    content.addEventListener('pointercancel', stopHold);
    content.addEventListener('click', onClick, true);
    return () => {
      content.removeEventListener('pointerenter', onEnter);
      content.removeEventListener('pointerdown', onDown);
      content.removeEventListener('pointermove', onMove);
      content.removeEventListener('pointerup', onUp);
      content.removeEventListener('pointercancel', stopHold);
      content.removeEventListener('click', onClick, true);
      stopHold();
      clear();
    };
  }, [contentRef, bloom]);

  // Positions follow the row while the labels show (a fold, a language change).
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (phase === 'idle' || !content) return undefined;
    const update = () => setLayout(measure(content));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(content);
    return () => observer.disconnect();
  }, [phase, contentRef]);

  if (phase === 'idle') return null;
  return (
    <div className={styles.strip} aria-hidden="true" data-bloom={phase}>
      {layout.seps.map((x) => (
        <span key={x} className={styles.sep} style={{ left: x }} />
      ))}
      <div className={styles.labels}>
        {layout.labels.map((label) => (
          <span
            key={`${label.left}`}
            className={styles.label}
            style={{ left: label.left, width: label.width }}
            title={label.text}
          >
            {label.text}
          </span>
        ))}
      </div>
    </div>
  );
}
