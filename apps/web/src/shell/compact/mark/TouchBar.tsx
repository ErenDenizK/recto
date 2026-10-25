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
 * or below, where it covers no field target (the 44 px boxes the field layer taps) and no check
 * box or radio label, or the side that covers the least (a field before a label), so a signature placed beside a field never hides it (the sample's
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
/** A covered field box weighs this many times a covered label of the same area. */
const FIELD_WEIGHT = 1000;
/** The gap between the bar and the selection: clear of the handles' hit squares (38 px out). */
const GAP = 40;

/** The area of the overlap of two boxes, CSS px squared. */
function overlap(a: Box, b: Box): number {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * The bar's top edge: the first of `candidates` (best first) that covers no field box and no
 * label, else the one that covers the least (DSN-77). A covered field box counts far more than a
 * covered label, so the bar hides a label before it hides a field. With neither it is the first.
 */
export function clearOfFields(
  candidates: readonly number[],
  x: number,
  fields: readonly Box[],
  labels: readonly Box[] = [],
): number {
  const covered = (y: number) => {
    const bar = { left: x - BAR_WIDTH / 2, top: y, width: BAR_WIDTH, height: BAR_HEIGHT };
    const area = (boxes: readonly Box[]) => boxes.reduce((sum, b) => sum + overlap(bar, b), 0);
    return area(fields) * FIELD_WEIGHT + area(labels);
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

/**
 * The bar's top edges to try, best first: above the selection, then below it, each only where
 * the whole bar stays on the page. When neither side fits, the above edge clamped onto the page.
 */
export function barSides(top: number, bottom: number, pageHeight: number): number[] {
  const aboveY = top - BAR_HEIGHT - GAP;
  const belowY = bottom + GAP;
  const sides: number[] = [];
  if (aboveY >= 0) sides.push(aboveY);
  if (belowY + BAR_HEIGHT <= pageHeight) sides.push(belowY);
  if (sides.length > 0) return sides;
  return [Math.max(0, Math.min(aboveY, pageHeight - BAR_HEIGHT))];
}

/**
 * Where a check box or radio's label sits for the bar: across the page to the right of its box
 * (the sample's consent line), so the bar keeps off the label too. Other fields have none.
 */
export function labelStrip(kind: string, box: Box, pageWidth: number): Box | null {
  if (kind !== 'checkbox' && kind !== 'radio') return null;
  const left = box.left + box.width;
  return pageWidth > left ? { ...box, left, width: pageWidth - left } : null;
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
  const turned = frame.rotation === 90 || frame.rotation === 270;
  const pageWidth = (turned ? frame.size.height : frame.size.width) * frame.scale;
  const pageHeight = (turned ? frame.size.width : frame.size.height) * frame.scale;
  const x = Math.min(Math.max((left + right) / 2, BAR_WIDTH / 2), pageWidth - BAR_WIDTH / 2);
  const fields: Box[] = [];
  const labels: Box[] = [];
  for (const field of useSourceFields(target.source)) {
    for (const w of widgetsOf(field)) {
      if (w.pageIndex !== target.pageIndex) continue;
      const box = growTarget(userRectToCss(frame, w.rect));
      fields.push(box);
      const label = labelStrip(field.kind, box, pageWidth);
      if (label) labels.push(label);
    }
  }
  const y = clearOfFields(barSides(top, bottom, pageHeight), x, fields, labels);
  const side = y > top ? 'below' : 'above';
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
