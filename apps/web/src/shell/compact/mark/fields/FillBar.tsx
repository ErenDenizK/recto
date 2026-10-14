/**
 * The fill bar (MOB-1; research phone-2026-10/forms.md §3 idea 2, §4.2): the phone's Tab key,
 * riding on the keyboard while a form is filled, where the Text tool's Done rides
 * (`TextLayer.module.css`'s bar, the same M2 material and place): ‹ · the field's label over
 * "n of N" · › · Done. ‹ and › commit the field and move through every fillable field in
 * document order, wrapping; on a check box the keyboard is down and the line says "Tap to
 * tick". Done commits and ends the flow. A press on the bar keeps the editor's focus, so the
 * keyboard stays up from one field to the next.
 */
import type { FormField } from '@pdf-editor/engine';
import { createPortal } from 'react-dom';

import { fieldLabel } from '../../../../forms/actions';
import {
  type ActiveField,
  fieldStops,
  isFillable,
  useFormStore,
} from '../../../../forms/form-store';
import { m } from '../../../../i18n';
import { useActiveDocument } from '../../../../state/workspace-store';
import { Button } from '../../../../ui/Button';
import { Icon } from '../../../../ui/Icon';
import { IconButton } from '../../../../ui/IconButton';
import doneBar from '../TextLayer.module.css';
import { stopIndex, takesKeyboard } from './fill-flow';
import { doneFill, moveFill } from './fill-session';
import styles from './FieldLayer.module.css';

export function FillBar({
  here,
  field,
}: {
  readonly here: ActiveField;
  readonly field: FormField;
}) {
  const doc = useActiveDocument();
  const sources = useFormStore((s) => s.sources);
  const stops = doc ? fieldStops(doc, sources).filter((s) => isFillable(s.field)) : [];
  const index = stopIndex(stops, here);
  const count = index < 0 ? null : m.compact_fill_count({ n: index + 1, count: stops.length });
  const hint = takesKeyboard(field) ? null : m.compact_fill_tap_to_tick();
  const line = [count, hint].filter((x) => x !== null).join(' · ');
  const many = stops.length > 1 || (index < 0 && stops.length > 0);

  return createPortal(
    <div
      className={`${doneBar.bar} ${styles.bar}`}
      role="toolbar"
      aria-label={m.compact_fill_bar()}
      data-annotation-keep=""
      data-compact-chrome=""
      data-fill-keep=""
      data-testid="compact-fill-bar"
      onPointerDown={(event) => event.preventDefault()}
    >
      <IconButton
        label={m.compact_fill_prev()}
        icon={<Icon name="caret-left" />}
        tooltipSide="top"
        disabled={!many}
        data-testid="compact-fill-prev"
        onClick={() => moveFill(-1)}
      />
      <div className={styles.what} aria-live="polite">
        <span className={styles.label}>{fieldLabel(field)}</span>
        {line === '' ? null : <span className={styles.count}>{line}</span>}
      </div>
      <IconButton
        label={m.compact_fill_next()}
        icon={<Icon name="caret-right" />}
        tooltipSide="top"
        disabled={!many}
        data-testid="compact-fill-next"
        onClick={() => moveFill(1)}
      />
      <Button
        variant="prominent"
        className={doneBar.done}
        data-testid="compact-fill-done"
        onClick={doneFill}
      >
        {m.compact_done()}
      </Button>
    </div>,
    document.body,
  );
}
