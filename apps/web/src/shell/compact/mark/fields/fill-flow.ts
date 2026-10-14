/**
 * The phone's form filling, the pure part (MOB-1; research phone-2026-10/forms.md §2, §4.1):
 * finger-sized targets around small widgets, which widget a press means where grown targets
 * overlap, what a press on a check box or radio sets, the order of the fill bar's stops, and
 * the zoom that shows a field's text at 16 px at least. Tested without a browser.
 */
import type { FormField } from '@pdf-editor/engine';

import type { ActiveField, FieldStop } from '../../../../forms/form-store';
import type { Box } from '../../../../viewer/geometry';

/** A field's target is at least this big, CSS px (Q-9; `NoteLayer`'s MIN_TARGET). */
export const MIN_TARGET = 44;
/** The font size a focused field is shown at least, CSS px: iOS zooms the page below it. */
export const FILL_MIN_FONT_PX = 16;
/** The reader zooms no further than this for a field (relative to fit width). */
export const FILL_MAX_ZOOM = 2.5;
/** Room kept on each side of a field the zoom fits to the screen's width, CSS px. */
const SIDE_ROOM = 16;

/** `box` grown about its centre to `min` on each side that is smaller. */
export function growTarget(box: Box, min: number = MIN_TARGET): Box {
  const width = Math.max(box.width, min);
  const height = Math.max(box.height, min);
  return {
    left: box.left + box.width / 2 - width / 2,
    top: box.top + box.height / 2 - height / 2,
    width,
    height,
  };
}

const inside = (b: Box, x: number, y: number) =>
  x >= b.left && x <= b.left + b.width && y >= b.top && y <= b.top + b.height;

/** How far (x, y) lies from `b`, 0 inside it. */
function distanceTo(b: Box, x: number, y: number): number {
  const dx = Math.max(b.left - x, 0, x - (b.left + b.width));
  const dy = Math.max(b.top - y, 0, y - (b.top + b.height));
  return Math.hypot(dx, dy);
}

/**
 * The widget a press at (x, y) means, among `boxes` (the widgets' real boxes, in one
 * coordinate space): of those whose grown target holds the point, the nearest (a press on a
 * widget itself is that widget's). Undefined when no target holds it.
 */
export function nearestWidget(
  boxes: readonly Box[],
  x: number,
  y: number,
  min: number = MIN_TARGET,
): number | undefined {
  let best: number | undefined;
  let bestDistance = Infinity;
  boxes.forEach((box, i) => {
    if (!inside(growTarget(box, min), x, y)) return;
    const d = distanceTo(box, x, y);
    if (d < bestDistance) {
      best = i;
      bestDistance = d;
    }
  });
  return best;
}

/**
 * What a press on a check box or radio sets (the full edition's `FieldWidget`): a check box
 * flips; a radio turns its option on and never off. Undefined: nothing to fill.
 */
export function toggleValue(
  field: FormField,
  exportValue: string | undefined,
): { readonly value: FormField['value'] } | undefined {
  if (field.readOnly) return undefined;
  if (field.kind === 'checkbox') return { value: field.value !== true };
  if (field.kind === 'radio') {
    if (exportValue === undefined || field.value === exportValue) return undefined;
    return { value: exportValue };
  }
  return undefined;
}

/** A field that takes the keyboard (or the system picker) rather than a tick. */
export function takesKeyboard(field: FormField): boolean {
  return field.kind === 'text' || field.kind === 'combobox' || field.kind === 'listbox';
}

/** Whether `stop` is the widget `here` names. */
export function isStop(stop: ActiveField, here: ActiveField): boolean {
  return (
    stop.source === here.source &&
    stop.fieldId === here.fieldId &&
    stop.name === here.name &&
    stop.widget === here.widget &&
    stop.pageId === here.pageId
  );
}

/** The index of `here` in `stops`, or -1. */
export function stopIndex(stops: readonly FieldStop[], here: ActiveField): number {
  return stops.findIndex((s) => isStop(s, here));
}

/**
 * The stop the fill bar's ‹ (-1) or › (1) goes to from `here`, wrapping round; undefined when
 * there is no other stop. From a field that is not a stop (read-only), › starts at the first.
 */
export function stepStop(
  stops: readonly FieldStop[],
  here: ActiveField,
  direction: 1 | -1,
): FieldStop | undefined {
  if (stops.length === 0) return undefined;
  const index = stopIndex(stops, here);
  if (index < 0) return direction > 0 ? stops[0] : stops[stops.length - 1];
  if (stops.length === 1) return undefined;
  return stops[(index + direction + stops.length) % stops.length];
}

/**
 * The reader's zoom (relative to fit width) that shows a field's text at `minPx` at least:
 * from `zoom`, where the text is `fontPx` and the field `widthPx` wide, up to `maxZoom`, and no
 * wider than the screen's width allows. Never below `zoom`: a field already readable stays.
 */
export function fieldZoom({
  zoom,
  fontPx,
  widthPx,
  viewWidth,
  minPx = FILL_MIN_FONT_PX,
  maxZoom = FILL_MAX_ZOOM,
}: {
  readonly zoom: number;
  readonly fontPx: number;
  readonly widthPx: number;
  readonly viewWidth: number;
  readonly minPx?: number;
  readonly maxZoom?: number;
}): number {
  if (!(fontPx > 0) || fontPx >= minPx) return zoom;
  const wanted = zoom * (minPx / fontPx);
  const fits = widthPx > 0 ? zoom * ((viewWidth - 2 * SIDE_ROOM) / widthPx) : wanted;
  return Math.max(zoom, Math.min(wanted, fits, maxZoom));
}
