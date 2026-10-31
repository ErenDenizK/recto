/**
 * The Fill & sign bar (R28 tools-visibility, DSN-75, in force): the capsule's content for the Fill & sign door, in place of the shared Markup palette.
 *
 * ```
 * ‹ 3/12 ›  │  ✑ Sign ▾  [saved signatures]  │  ▭ Date  │  ✓ Done
 * ```
 *
 * - **Field stepping** is the palette's stepper (`SignGroup.tsx` `FieldStepper`, `always`): the
 *   previous or next fillable field in tab order, opened so typing fills; the field is brought
 *   into view (`doors.ts` `revealStop`). A file without fields keeps the stepper, its buttons
 *   disabled and the hint "No fields" in the readout.
 * - **Signature** is the palette's Sign ▾ and its saved-signature chips, untouched
 *   (`SignButton`, `SignatureChips`): signing places freely on the page with or without fields.
 * - **Date** (`fill-bar-date.ts`): fills the focused empty text field, else arms today's date
 *   for a click on the page.
 * - **Done** is the palette's Done (`closeMarkupDoor`).
 *
 * It is the same capsule, material and row pieces as the palette (`MarkupPalette.module.css`);
 * Esc follows the palette's ladder (`palette-escape.ts`). Desktop and tablet; the phone has its
 * own edition (`shell/compact/mark/`).
 */
import { useLayoutEffect, useRef } from 'react';

import { m } from '../i18n';
import { centredRoom, snapToWholePixels } from '../ui/whole-pixels';
import { Icon } from '../ui/Icon';
import { closeMarkupDoor, revealStop } from './doors';
import { isDateStamp, putDate } from './fill-bar-date';
import { paletteEscape, usePageEscape } from './palette-escape';
import styles from './MarkupPalette.module.css';
import { useRovingTabindex } from './roving';
import { SignatureChips, SignButton, FieldStepper, fieldIndex } from './SignGroup';
import { PaletteButton } from './ToolButton';
import { activeStops } from '../forms/navigation';
import { useFormStore } from '../forms/form-store';
import { useToolStore } from '../viewer/tool-store';
import { useAnnotationStore } from '../annotations/annotation-store';

/** The palette's Done, shared with the fill bar (`item` is the capsule piece it morphs as). */
export function DoneButton({
  item = 'done',
  showLabel,
}: {
  readonly item?: string;
  readonly showLabel: boolean;
}) {
  return (
    <PaletteButton
      item={item}
      label={m.markup_done()}
      tooltip={m.markup_done_tooltip()}
      icon={<Icon name="check" />}
      showLabel={showLabel}
      className={styles.done}
      aria-description={m.markup_done_description()}
      data-markup-done=""
      onClick={() => closeMarkupDoor()}
    />
  );
}

/** After a step the focused field comes into view: the page, and the widget within it. */
function revealActiveField(): void {
  const active = useFormStore.getState().active;
  if (active === null) return;
  const stops = activeStops();
  const stop = stops[fieldIndex(stops, active)];
  if (stop !== undefined) revealStop(stop);
}

export function FillSignBar() {
  const rowRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const mode = useToolStore((s) => s.mode);
  const pending = useAnnotationStore((s) => s.pendingStamp);
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return undefined;
    return snapToWholePixels(el, 'width', { container: () => centredRoom(el, '[data-capsule]') });
  }, []);
  const roving = useRovingTabindex(
    rowRef,
    '[data-tool][aria-pressed="true"]',
    `${mode}|${pending?.kind ?? ''}`,
  );
  // Date armed: its one-shot image stamp is waiting for a click on the page.
  const dateArmed = mode === 'stamp' && isDateStamp(pending);
  usePageEscape();
  return (
    <div
      ref={contentRef}
      className={styles.content}
      data-markup-palette=""
      data-fill-bar=""
      data-annotation-keep=""
      data-palette-set="sign"
    >
      <div
        ref={rowRef}
        role="toolbar"
        aria-label={m.dock_fill_sign()}
        aria-orientation="horizontal"
        className={styles.row}
        onKeyDownCapture={paletteEscape}
        onKeyDown={roving.onKeyDown}
        onFocus={roving.onFocus}
      >
        <div className={styles.group}>
          <FieldStepper always hint={m.fillbar_no_fields()} onStep={revealActiveField} spaced />
        </div>
        <span className={styles.sep} aria-hidden="true" />
        <div className={styles.group}>
          <SignButton showLabel chipsShown />
          <SignatureChips item="chips" />
        </div>
        <span className={styles.sep} aria-hidden="true" />
        <div className={styles.group}>
          <PaletteButton
            item="date"
            label={m.fillbar_date()}
            tooltip={m.fillbar_date_tooltip()}
            icon={<Icon name="calendar-blank" filled={false} />}
            showLabel
            tool="date"
            aria-pressed={dateArmed}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void putDate()}
          />
        </div>
        <span className={styles.sep} aria-hidden="true" />
        <div className={styles.group}>
          <DoneButton showLabel />
        </div>
      </div>
    </div>
  );
}
