/**
 * The phone's selection bar (`design/phone-2026-10/README.md` §4–§5; code-audit risks: the
 * desktop AnnotationBar is too small for touch): a small M2 pill above the selected annotations
 * (below them when they touch the top of the page) with the one act a phone needs on a
 * selection, Delete, a 48 px target (Q-9's 44 px even under the page's fit scale, which the bar
 * shares as it sits on the page). Moving and scaling are the selection's own: a drag on it moves
 * it, its corner handles scale it (`touch-chrome.ts`). Style controls stay on the
 * full edition: the phone's pen, highlight and text pick their look before they write.
 * Installed in place of `AnnotationBar` through `annotations/selection-chrome.ts`.
 *
 * The pill keeps off the page's form fields (DSN-77): it takes the side of the selection, above
 * or below, where it covers no field target (the 44 px boxes the field layer taps), or the side
 * that covers the least, so a signature placed beside a field never hides it (the sample's
 * agreement page).
 */
import { deleteAnnotations } from '../../../annotations/actions';
import { annotationName, capitalize } from '../../../annotations/labels';
import { displayRect, rectToCss } from '../../../annotations/geometry';
import type { SelectionBarProps } from '../../../annotations/selection-chrome';
import { useSourceFields, widgetsOf } from '../../../forms/form-store';
import { m } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { type Box, userRectToCss } from '../../../viewer/geometry';
import { growTarget } from './fields/fill-flow';
import styles from './TouchBar.module.css';

/** The bar's height: a 48 px target inside 4 px of padding. */
const BAR_HEIGHT = 56;
/** Its width before it is laid out, for centring: the Delete pill. */
const BAR_WIDTH = 120;
/** The gap between the bar and the selection: clear of the handles' hit squares (38 px out). */
const GAP = 40;

/** The area of the overlap of two boxes, CSS px squared. */
function overlap(a: Box, b: Box): number {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * The bar's top edge: the first of `candidates` (best first) that covers no field box, else the
 * one that covers the least (DSN-77). With no fields it is the first.
 */
export function clearOfFields(
  candidates: readonly number[],
  x: number,
  fields: readonly Box[],
): number {
  const covered = (y: number) => {
    const bar = { left: x - BAR_WIDTH / 2, top: y, width: BAR_WIDTH, height: BAR_HEIGHT };
    return fields.reduce((sum, f) => sum + overlap(bar, f), 0);
  };
  let best = candidates[0] as number;
  let least = covered(best);
  for (const y of candidates.slice(1)) {
    if (least === 0) break;
    const area = covered(y);
    if (area < least) [best, least] = [y, area];
  }
  return best;
}

export function TouchBar({ target, annotations, frame }: SelectionBarProps) {
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  for (const a of annotations) {
    const box = rectToCss(frame, displayRect(frame, a));
    top = Math.min(top, box.top);
    bottom = Math.max(bottom, box.top + box.height);
    left = Math.min(left, box.left);
    right = Math.max(right, box.left + box.width);
  }
  const pageWidth =
    (frame.rotation === 90 || frame.rotation === 270 ? frame.size.height : frame.size.width) *
    frame.scale;
  const above = top - BAR_HEIGHT - GAP >= 0;
  const x = Math.min(Math.max((left + right) / 2, BAR_WIDTH / 2), pageWidth - BAR_WIDTH / 2);
  const fields: Box[] = [];
  for (const field of useSourceFields(target.source)) {
    for (const w of widgetsOf(field)) {
      if (w.pageIndex === target.pageIndex) fields.push(growTarget(userRectToCss(frame, w.rect)));
    }
  }
  const aboveY = top - BAR_HEIGHT - GAP;
  const belowY = bottom + GAP;
  const y = clearOfFields(above ? [aboveY, belowY] : [belowY], x, fields);
  const side = y === belowY ? 'below' : 'above';
  const locked = annotations.every((a) => a.flags?.locked);
  const first = annotations[0];
  const name =
    annotations.length === 1 && first
      ? capitalize(annotationName(first))
      : m.annot_count({ count: annotations.length });
  if (locked) return null;
  return (
    <div
      role="toolbar"
      aria-label={m.annot_bar_label({ name })}
      className={styles.bar}
      data-annotation-keep=""
      data-side={side}
      data-testid="compact-touch-bar"
      style={{ left: x, top: y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Button
        variant="quiet"
        className={styles.action}
        onClick={() =>
          void deleteAnnotations(
            target,
            annotations.map((a) => a.id),
          )
        }
      >
        <Icon name="trash" />
        {m.annot_delete()}
      </Button>
    </div>
  );
}
