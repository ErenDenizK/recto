/**
 * Checkbox (components/09-primitives.md §8): an independent option in a form or a sheet ("Don't
 * ask again for this file", Save a copy's sections, Batch steps, Find's Match case). Settings
 * that apply at once are switches; PDF form checkboxes on the page are content, not this.
 *
 * - A row of `--control-h` with the box first and the label after it; the `<label>` wraps
 *   both, so the label toggles too. Box 16 px fine, 20 px coarse, radius 4.
 * - Off: a 1.5 px `--control-border` ring; on: a `--control-on` fill with a bold check in
 *   `--control-on-ink`; indeterminate shows a dash (`aria-checked="mixed"`). Neutral, like
 *   every on-state (09 §34 issue 1). The check pops on the select curve; reduced motion swaps.
 * - `error` (required and empty) turns the ring `--danger` and shows the message below, tied
 *   to the box by `aria-describedby` and `aria-invalid`.
 * - `CheckboxGroup` gives a set of boxes one name and, with a parent box, select-all.
 *
 * Base UI `Checkbox` and `CheckboxGroup`.
 */
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { CheckboxGroup as BaseCheckboxGroup } from '@base-ui/react/checkbox-group';
import { type ReactNode, useId } from 'react';

import styles from './Checkbox.module.css';

export interface CheckboxProps {
  /** Controlled state; inside a `CheckboxGroup` use `value` instead. */
  readonly checked?: boolean | undefined;
  readonly onCheckedChange?: ((checked: boolean) => void) | undefined;
  readonly indeterminate?: boolean | undefined;
  /** This box's value inside a `CheckboxGroup`. */
  readonly value?: string | undefined;
  /** The parent box of a `CheckboxGroup`: it checks and clears every child. */
  readonly parent?: boolean | undefined;
  readonly label: ReactNode;
  readonly description?: string | undefined;
  readonly disabled?: boolean | undefined;
  /** A message shown under the row when the box is in error (required and empty). */
  readonly error?: string | undefined;
  readonly className?: string | undefined;
}

export function Checkbox({
  checked,
  onCheckedChange,
  indeterminate,
  value,
  parent,
  label,
  description,
  disabled = false,
  error,
  className,
}: CheckboxProps) {
  const noteId = useId();
  const note = error ?? description;
  return (
    <span className={[styles.field, className].filter(Boolean).join(' ')}>
      <label className={styles.row} data-disabled={disabled || undefined}>
        <BaseCheckbox.Root
          {...(checked === undefined ? {} : { checked })}
          {...(onCheckedChange
            ? { onCheckedChange: (next: boolean) => onCheckedChange(next) }
            : {})}
          {...(value === undefined ? {} : { value })}
          indeterminate={indeterminate}
          parent={parent}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          className={styles.box}
          data-error={error ? '' : undefined}
        >
          <BaseCheckbox.Indicator className={styles.indicator} keepMounted>
            <svg className={styles.check} viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3.5 8.25 6.5 11.25 12.5 4.75"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <svg className={styles.dash} viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </BaseCheckbox.Indicator>
        </BaseCheckbox.Root>
        <span className={styles.label}>{label}</span>
      </label>
      {note ? (
        <span id={noteId} className={styles.note} data-error={error ? '' : undefined}>
          {note}
        </span>
      ) : null}
    </span>
  );
}

export interface CheckboxGroupProps {
  /** The values of the checked boxes. */
  readonly value: readonly string[];
  readonly onValueChange: (value: string[]) => void;
  /** Every child value, for the parent box's select-all. */
  readonly allValues?: readonly string[] | undefined;
  /** The group's accessible name. */
  readonly label: string;
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

export function CheckboxGroup({
  value,
  onValueChange,
  allValues,
  label,
  children,
  className,
}: CheckboxGroupProps) {
  return (
    <BaseCheckboxGroup
      aria-label={label}
      value={[...value]}
      onValueChange={(next) => onValueChange(next)}
      {...(allValues ? { allValues: [...allValues] } : {})}
      className={[styles.group, className].filter(Boolean).join(' ')}
    >
      {children}
    </BaseCheckboxGroup>
  );
}
