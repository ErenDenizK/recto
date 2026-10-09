/**
 * A check box or radio button that is filled ticks in (motion-2026-10 forms-compact §2).
 *
 * PDFium draws the field's value into the page bitmap, a frame or a few after the fill is
 * committed. Until it has, a glyph in the page's ink stands on the widget: a check mark that
 * draws itself from its short stroke to its long one while it springs from 60 % on `pop`, or a
 * radio dot that pops from nothing. Once the page shows the value (`whenPainted`) the glyph
 * fades out over `--duration-fast` onto the page's own, so the box never goes blank between
 * the press and the paint, and nothing is drawn twice for longer than that fade.
 *
 * Under reduced motion the glyph fades in (100 ms) and out, without drawing or scaling.
 */
import type { SourceId } from '@pdf-editor/document-model';
import { useLayoutEffect, useRef } from 'react';

import { getEngineService } from '../engine/engine-service';
import { animateStyle, duration, EASE, reducedMotion } from '../motion';
import type { Box } from '../viewer/geometry';
import { whenPainted } from '../viewer/read-controller';
import { commitFieldValue, type FieldValue } from './actions';
import type { ActiveField } from './form-store';
import styles from './FormLayer.module.css';

/** What a created field (no source page to wait on) waits before the glyph goes, ms. */
const UNPAINTED_HOLD_MS = 400;

/** Commits `value` and resolves once the page bitmap shows it (or a short hold). */
export async function fillAndPaint(
  here: ActiveField,
  value: FieldValue,
  pageIndex: number | undefined,
): Promise<void> {
  const ok = await commitFieldValue(here, value);
  if (!ok || here.source === undefined || pageIndex === undefined) {
    await new Promise((resolve) => setTimeout(resolve, UNPAINTED_HOLD_MS));
    return;
  }
  const source: SourceId = here.source;
  await whenPainted(source, pageIndex, getEngineService().pageRevision(source, pageIndex));
}

export function TickIn({
  box,
  kind,
  until,
  onDone,
}: {
  readonly box: Box;
  readonly kind: 'checkbox' | 'radio';
  /** Resolves once the page shows the value. */
  readonly until: Promise<void>;
  readonly onDone: () => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const done = useRef(onDone);
  useLayoutEffect(() => {
    done.current = onDone;
  });

  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg || typeof svg.animate !== 'function') return undefined;
    const reduced = reducedMotion();
    if (reduced) {
      svg.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: duration('fast'),
        easing: EASE.out,
      });
    } else {
      animateStyle(svg, 'transform', [0, 0, 0.6, 0.6], [0, 0, 1, 1], {
        spring: 'pop',
      });
      const mark = svg.querySelector('path');
      mark?.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
        duration: duration('base'),
        easing: EASE.out,
      });
    }
    let live = true;
    void until.then(() => {
      if (!live) return;
      const out = svg.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: duration('fast'),
        easing: EASE.exit,
        fill: 'forwards',
      });
      out.onfinish = () => {
        if (live) done.current();
      };
    });
    return () => {
      live = false;
    };
  }, [until]);

  // A square on the widget's centre, 80 % of its shorter side.
  const side = Math.max(6, Math.min(box.width, box.height) * 0.8);
  const style = {
    left: box.left + box.width / 2 - side / 2,
    top: box.top + box.height / 2 - side / 2,
    width: side,
    height: side,
  };
  return (
    <svg
      ref={ref}
      className={styles.tick}
      style={style}
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-field-tick={kind}
    >
      {kind === 'checkbox' ? (
        <path
          d="M4.5 12.5 9.5 17.5 19.5 6.5"
          pathLength={1}
          strokeDasharray="1 1"
          strokeWidth={2.5}
        />
      ) : (
        <circle cx="12" cy="12" r="6" />
      )}
    </svg>
  );
}
