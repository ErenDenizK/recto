/**
 * Radio group (components/09-primitives.md §9): one of a few options that need a description
 * or an estimate (Save a copy's Size: Same as original · Smaller, about 1.1 MB; Batch outputs;
 * Crop scope). Two to four short options without descriptions use `ui/Segmented` instead.
 *
 * - One row of `--control-h` per option: a 16 px circle (20 px coarse), the label, an optional
 *   trailing estimate in tabular numerals, and an optional description line under the label
 *   (12/16, secondary). The `<label>` wraps the row, so the label chooses too.
 * - Off: the `--control-border` ring; on: a `--control-on` disc with a 6 px (8 px coarse)
 *   `--control-on-ink` centre that pops in on the select curve; reduced motion swaps.
 * - APG radio group: one Tab stop, the arrows move and choose. A disabled option keeps its
 *   reason as its description line.
 *
 * Base UI `RadioGroup` and `Radio` (the description is each radio's `aria-describedby`).
 */
import { Radio } from '@base-ui/react/radio';
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group';
import { useId } from 'react';

import styles from './RadioGroup.module.css';

export interface RadioOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** A line under the label; for a disabled option, why it is unavailable. */
  readonly description?: string | undefined;
  /** A trailing estimate in tabular numerals ("about 1.1 MB"). */
  readonly detail?: string | undefined;
  readonly disabled?: boolean | undefined;
}

export interface RadioGroupProps<T extends string> {
  readonly value: T;
  readonly onValueChange: (value: T) => void;
  readonly options: readonly RadioOption<T>[];
  /** The group's accessible name. */
  readonly label: string;
  readonly disabled?: boolean | undefined;
  readonly className?: string | undefined;
}

export function RadioGroup<T extends string>({
  value,
  onValueChange,
  options,
  label,
  disabled,
  className,
}: RadioGroupProps<T>) {
  const baseId = useId();
  return (
    <BaseRadioGroup
      aria-label={label}
      value={value}
      onValueChange={(next) => onValueChange(next)}
      disabled={disabled}
      className={[styles.group, className].filter(Boolean).join(' ')}
    >
      {options.map((option, index) => {
        const noteId = `${baseId}-${index}`;
        return (
          <label
            key={option.value}
            className={styles.row}
            data-disabled={disabled === true || option.disabled === true ? '' : undefined}
          >
            <Radio.Root
              value={option.value}
              disabled={option.disabled}
              aria-labelledby={`${noteId}-label`}
              aria-describedby={option.description ? noteId : undefined}
              className={styles.circle}
            >
              <Radio.Indicator className={styles.dot} />
            </Radio.Root>
            <span className={styles.text}>
              <span id={`${noteId}-label`} className={styles.label}>
                {option.label}
              </span>
              {option.description ? (
                <span id={noteId} className={styles.description}>
                  {option.description}
                </span>
              ) : null}
            </span>
            {option.detail ? <span className={styles.detail}>{option.detail}</span> : null}
          </label>
        );
      })}
    </BaseRadioGroup>
  );
}
