/**
 * A single-line field inside a sheet (components/07-sheets.md §2.2–§2.4; 09-primitives §12):
 * a solid well (L§2.10: inputs are wells, never glass, quality-bar Q-4) `--control-h` high,
 * with the input boundary `--control-border` (spec X7), the inset focus ring, and an error
 * line under it (`x-circle` 16 and a sentence, `aria-invalid`, no red wash and no shake, §2.4).
 * Enter in it submits the sheet's form (§2.6). A trailing control (Show, a clear button) sits
 * inside the well.
 *
 * The field primitives of 09 §12 (Text, Search, Number) come with D0-3 part 2; this is the
 * sheet's own until then, and moves onto them when they land.
 */
import { CircleX } from 'lucide-react';
import { type ComponentPropsWithRef, type ReactNode, useId } from 'react';

import styles from './SheetField.module.css';

export interface SheetFieldProps
  extends Omit<ComponentPropsWithRef<'input'>, 'className' | 'children'> {
  readonly label: string;
  /** Shows the label above the well; otherwise it is the accessible name only. */
  readonly showLabel?: boolean;
  readonly error?: string | null | undefined;
  /** A glyph leading inside the well (search). */
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
}

export function SheetField({
  label,
  showLabel = false,
  error,
  leading,
  trailing,
  id,
  ...input
}: SheetFieldProps) {
  const ownId = useId();
  const fieldId = id ?? ownId;
  const errorId = `${fieldId}-error`;
  return (
    <div className={styles.field}>
      {showLabel ? (
        <label htmlFor={fieldId} className={styles.label}>
          {label}
        </label>
      ) : null}
      <div className={styles.well} data-invalid={error ? '' : undefined}>
        {leading ? <span className={styles.leading}>{leading}</span> : null}
        <input
          {...input}
          id={fieldId}
          className={styles.input}
          aria-label={showLabel ? undefined : label}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [input['aria-describedby'], error ? errorId : null].filter(Boolean).join(' ') ||
            undefined
          }
        />
        {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
      </div>
      {error ? (
        <p id={errorId} className={styles.error}>
          <CircleX aria-hidden="true" className={styles.errorGlyph} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
