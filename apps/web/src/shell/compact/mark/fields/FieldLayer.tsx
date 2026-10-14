/**
 * The phone's form field layer (MOB-1; research phone-2026-10/forms.md §2 "Phone-specific" 1–3),
 * mounted over each page in reading and editing alike (`registerCompactOverlay` with
 * `reading`), in its own chunk. It never imports the full edition's `FormLayer` (which brings
 * Home's actions and the tooltips) nor `forms/index.ts` (annotations): it reads the same form
 * store and fills through the same actions, so Undo, the session and the export need nothing.
 *
 * - **Targets of 44 px at least** (Q-9), centred on each widget: the sample's check box is 9 px
 *   at fit width. Where grown targets overlap, a press goes to the nearest widget
 *   (`nearestWidget`); the ring and the editor keep the widget's real box.
 * - **Live where the hit router says** (`viewer/hit-order.ts`): reading and editing with the
 *   chip off fill; a drawing or placing tool and Edit text win over the field (`null`);
 *   locked focuses and says so. A press on a target is the target's, never the reader's tap.
 * - **What a press does** is `fill-session.ts`'s: tick, open the flow, open Sign.
 * - **The open field**: its editor (`FieldEditors`, its own chunk, laid out at 16 px at least)
 *   with the shared ring, kept above the keyboard (`keepInView`); a check box or radio that
 *   ticks on draws `TickIn` until the page shows it. While the flow is open every fillable
 *   widget wears a faint wash, so the next one is easy to see; the fill bar rides on the
 *   keyboard from the layer of the page that holds the open field.
 */
import type { FormField } from '@pdf-editor/engine';
import { type MouseEvent, type PointerEvent, useEffect, useRef, useState } from 'react';
import { useSyncExternalStore } from 'react';

import { FieldRing } from '../../../../forms/FieldRing';
import { fieldLabel } from '../../../../forms/actions';
import {
  type ActiveField,
  isFillable,
  useFormStore,
  useSourceFields,
  widgetsOf,
} from '../../../../forms/form-store';
import { fillAndPaint, TickIn } from '../../../../forms/TickIn';
import { m } from '../../../../i18n';
import type { PageOverlayProps } from '../../../../stage/page-overlays';
import { type Box, userRectToCss } from '../../../../viewer/geometry';
import { isLive } from '../../../../viewer/hit-order';
import { usePageInput } from '../../../../viewer/input-state';
import { pageFrame } from '../../../../viewer/page-frame';
import { keepInView } from '../keyboard';
import { loadEditors, useEditors } from './editors';
import { FillBar } from './FillBar';
import { FILL_MIN_FONT_PX, growTarget, nearestWidget, takesKeyboard } from './fill-flow';
import { isFilling, moveFill, notePageScale, pressField, subscribeFilling } from './fill-session';
import styles from './FieldLayer.module.css';

interface Placed {
  readonly field: FormField;
  readonly widget: number;
  readonly box: Box;
  readonly exportValue: string | undefined;
}

const useFilling = () => useSyncExternalStore(subscribeFilling, isFilling, isFilling);

export function FieldLayer(props: PageOverlayProps) {
  const { sourceId, sourceIndex, pageId, pageIndex, cssScale } = props;
  const { state } = usePageInput();
  const fields = useSourceFields(sourceId);
  const ensureSource = useFormStore((s) => s.ensureSource);
  const active = useFormStore((s) => (s.active?.pageId === pageId ? s.active : null));
  const editors = useEditors();
  const filling = useFilling();
  const layerRef = useRef<HTMLDivElement>(null);
  const [ticks, setTicks] = useState<Readonly<Record<string, Promise<void>>>>({});

  useEffect(() => {
    if (sourceId !== undefined) ensureSource(sourceId);
  }, [sourceId, ensureSource]);
  useEffect(() => notePageScale(cssScale), [cssScale]);

  const placed: Placed[] = [];
  const frame = sourceId === undefined ? null : pageFrame(props);
  if (frame) {
    for (const field of fields) {
      widgetsOf(field).forEach((w, widget) => {
        if (w.pageIndex !== sourceIndex) return;
        placed.push({
          field,
          widget,
          box: userRectToCss(frame, w.rect),
          exportValue: w.exportValue,
        });
      });
    }
  }
  const typed = placed.some((p) => takesKeyboard(p.field));
  // A page with a text or choice field fetches the editors before its first tap.
  useEffect(() => {
    if (typed) void loadEditors().catch(() => undefined);
  }, [typed]);

  const editorOpen =
    active !== null &&
    editors !== null &&
    placed.some(
      (p) => p.field.name === active.name && p.widget === active.widget && takesKeyboard(p.field),
    );
  // The open editor stays between the top bar and the fill bar as the keyboard comes.
  useEffect(() => {
    if (!editorOpen) return;
    const editor = layerRef.current?.querySelector<HTMLElement>('[data-form-editor]');
    return editor ? keepInView(editor) : undefined;
  }, [editorOpen, active?.name, active?.widget]);

  if (sourceId === undefined || frame === null || placed.length === 0) return null;
  const live = isLive('form-widget', state);

  const hereOf = (p: Placed): ActiveField => ({
    source: sourceId,
    name: p.field.name,
    widget: p.widget,
    pageId,
  });
  const keyOf = (p: Placed) => `${p.field.name}#${p.widget}`;

  // A press while an editor is open keeps its focus (and the keyboard) until the click moves on.
  const keep = (event: PointerEvent) => {
    if (document.activeElement?.closest('[data-form-editor]')) event.preventDefault();
  };

  const press = (event: MouseEvent, index: number) => {
    // A pointer press goes to the nearest widget its target reaches; a key press to its own.
    let chosen = index;
    const layer = layerRef.current;
    if (event.detail > 0 && layer) {
      const r = layer.getBoundingClientRect();
      const near = nearestWidget(
        placed.map((p) => p.box),
        event.clientX - r.left,
        event.clientY - r.top,
      );
      if (near !== undefined) chosen = near;
    }
    const p = placed[chosen];
    if (!p) return;
    const here = hereOf(p);
    const at = event.detail > 0 ? { x: event.clientX, y: event.clientY } : centre(event);
    pressField(here, p.field, p.exportValue, at, (value) => {
      const until = fillAndPaint(here, value, widgetsOf(p.field)[p.widget]?.pageIndex);
      setTicks((t) => ({ ...t, [keyOf(p)]: until }));
      return until;
    });
  };

  const bar =
    active !== null && filling
      ? (() => {
          const p = placed.find((x) => x.field.name === active.name && x.widget === active.widget);
          return p ? <FillBar here={active} field={p.field} /> : null;
        })()
      : null;

  return (
    <div
      ref={layerRef}
      className={styles.layer}
      data-compact-field-layer={pageIndex}
      data-live={live || undefined}
      data-filling={filling || undefined}
      role="group"
      aria-label={m.forms_layer_label({ page: pageIndex + 1 })}
    >
      {placed.map((p, index) => {
        const isActive =
          active !== null && active.name === p.field.name && active.widget === p.widget;
        const until = ticks[keyOf(p)];
        const ring = isActive ? <FieldRing box={p.box} /> : null;
        const glyph =
          until !== undefined && (p.field.kind === 'checkbox' || p.field.kind === 'radio') ? (
            <TickIn
              box={p.box}
              kind={p.field.kind}
              until={until}
              onDone={() =>
                setTicks((t) => {
                  const { [keyOf(p)]: _done, ...rest } = t;
                  return rest;
                })
              }
            />
          ) : null;
        if (isActive && live && editors && takesKeyboard(p.field) && !p.field.readOnly) {
          const Editor =
            p.field.kind === 'text' || (p.field.kind === 'combobox' && p.field.editable)
              ? editors.TextEditor
              : editors.ChoiceEditor;
          return (
            <span key={keyOf(p)} className={styles.slot}>
              <Editor
                field={p.field}
                here={hereOf(p)}
                box={p.box}
                frame={frame}
                minFontPx={FILL_MIN_FONT_PX}
                onMove={moveFill}
              />
              {ring}
            </span>
          );
        }
        const target = growTarget(p.box);
        const label = fieldLabel(p.field);
        const on =
          p.field.kind === 'checkbox'
            ? p.field.value === true
            : p.field.kind === 'radio'
              ? p.exportValue !== undefined && p.field.value === p.exportValue
              : undefined;
        const role =
          p.field.kind === 'checkbox' ? 'checkbox' : p.field.kind === 'radio' ? 'radio' : undefined;
        const name =
          p.field.kind === 'radio'
            ? m.forms_radio_option({ name: label, option: p.exportValue ?? '' })
            : p.field.kind === 'signature'
              ? m.forms_signature_field({ name: label })
              : p.field.kind === 'button'
                ? `${label}: ${m.forms_button_not_run()}`
                : p.field.readOnly
                  ? m.forms_read_only({ name: label })
                  : label;
        return (
          <span key={keyOf(p)} className={styles.slot}>
            {filling && isFillable(p.field) ? (
              <span
                className={styles.wash}
                style={{
                  left: p.box.left,
                  top: p.box.top,
                  width: p.box.width,
                  height: p.box.height,
                }}
                aria-hidden="true"
              />
            ) : null}
            {/* The PDF's own widget, a hit target over the page (as the full edition's FormLayer):
                content, not chrome; nothing of it is drawn but the focus ring. */}
            <button
              type="button"
              // eslint-disable-next-line recto/q9-controls
              className={styles.target}
              style={{
                left: target.left,
                top: target.top,
                width: target.width,
                height: target.height,
              }}
              tabIndex={live ? 0 : -1}
              role={role}
              aria-checked={on}
              aria-label={name}
              aria-readonly={(role !== undefined && p.field.readOnly) || undefined}
              aria-disabled={
                p.field.kind === 'button' ||
                p.field.kind === 'unknown' ||
                (role === undefined && p.field.readOnly) ||
                undefined
              }
              data-fill-target=""
              data-page-id={pageId}
              data-field-name={p.field.name}
              data-field-kind={p.field.kind}
              data-active={isActive || undefined}
              data-annotation-keep=""
              onPointerDown={keep}
              onClick={(event) => press(event, index)}
            />
            {glyph}
            {ring}
          </span>
        );
      })}
      {bar}
    </div>
  );
}

FieldLayer.displayName = 'FieldLayer';

/** A key press's point: the middle of the control it pressed. */
function centre(event: MouseEvent): { x: number; y: number } {
  const r = event.currentTarget.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
