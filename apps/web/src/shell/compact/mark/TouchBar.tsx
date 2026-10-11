/**
 * The phone's selection bar (`design/phone-2026-10/README.md` §4–§5; code-audit risks: the
 * desktop AnnotationBar is too small for touch): a small M2 pill above the selected annotations
 * (below them when they touch the top of the page) with the one act a phone needs on a
 * selection, Delete, a 48 px target (Q-9's 44 px even under the page's fit scale, which the bar
 * shares as it sits on the page). Moving and scaling are the selection's own: a drag on it moves
 * it, its corner handles scale it (`touch-chrome.ts`). Style controls stay on the
 * full edition: the phone's pen, highlight and text pick their look before they write.
 * Installed in place of `AnnotationBar` through `annotations/selection-chrome.ts`.
 */
import { deleteAnnotations } from '../../../annotations/actions';
import { annotationName, capitalize } from '../../../annotations/labels';
import { displayRect, rectToCss } from '../../../annotations/geometry';
import type { SelectionBarProps } from '../../../annotations/selection-chrome';
import { m } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import styles from './TouchBar.module.css';

/** The bar's height: a 48 px target inside 4 px of padding. */
const BAR_HEIGHT = 56;
/** Its width before it is laid out, for centring: the Delete pill. */
const BAR_WIDTH = 120;
/** The gap between the bar and the selection: clear of the handles' hit squares (38 px out). */
const GAP = 40;

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
  const y = above ? top - BAR_HEIGHT - GAP : bottom + GAP;
  const x = Math.min(Math.max((left + right) / 2, BAR_WIDTH / 2), pageWidth - BAR_WIDTH / 2);
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
      data-side={above ? 'above' : 'below'}
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
