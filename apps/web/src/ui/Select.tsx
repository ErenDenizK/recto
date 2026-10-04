/**
 * Select (09-primitives §11): one value from a list too long for a segmented control, on Base
 * UI's `Select` (`combobox` trigger, `listbox` popup). It replaces the native `<select>`s of
 * today's chrome and dialogs, so no browser arrow or system popup leaks into Recto (Q-14).
 *
 * - **Trigger.** Field-like on a fill (`Select.module.css`), 32 / 44 px, the chosen label or
 *   the placeholder ("Choose…"), and `caret-up-down`. Numeric values are tabular.
 * - **Popup.** The menu recipe (`ui/Menu.module.css`): M4, radius 16, 32 / 44 px rows, a dot
 *   on the chosen row. On a fine pointer the chosen row opens over the trigger
 *   (`alignItemWithTrigger`, Base UI's default; it falls back to below the trigger when there
 *   is no room, and is off for touch). Typeahead, Enter or Space opens, Esc closes and focus
 *   returns to the trigger.
 * - **Empty.** With no options the trigger is disabled with the reason "No options".
 * - **Disabled.** `reason` says why, as a tooltip and the trigger's description (§2.3).
 *
 * The accessible name is `label`; a visible label beside it is the caller's, and it must not
 * be a `<label>` around the trigger (a press on it would open the list).
 */
import { Select as BaseSelect } from '@base-ui/react/select';
import { ChevronsUpDown } from 'lucide-react';
import type { Ref } from 'react';

import { m } from '../i18n';
import styles from './Select.module.css';
import { Tooltip } from './Tooltip';

export interface SelectOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly disabled?: boolean | undefined;
}

export interface SelectProps<T extends string> {
  /** The chosen value, or null for none (the placeholder shows). */
  readonly value: T | null;
  readonly onValueChange: (value: T) => void;
  readonly options: readonly SelectOption<T>[];
  /** The accessible name. */
  readonly label: string;
  /** Shown while nothing is chosen (default "Choose…"). */
  readonly placeholder?: string | undefined;
  readonly disabled?: boolean | undefined;
  /** Why it is disabled (tooltip and description). */
  readonly reason?: string | undefined;
  /** Fill the container's width. */
  readonly block?: boolean | undefined;
  /** Submits the value with a form. */
  readonly name?: string | undefined;
  readonly id?: string | undefined;
  /** The trigger, for a dialog's initial focus. */
  readonly triggerRef?: Ref<HTMLButtonElement> | undefined;
  readonly className?: string | undefined;
  readonly 'aria-describedby'?: string | undefined;
  readonly 'data-testid'?: string | undefined;
}

export function Select<T extends string>({
  value,
  onValueChange,
  options,
  label,
  placeholder,
  disabled = false,
  reason,
  block = false,
  name,
  id,
  triggerRef,
  className,
  'aria-describedby': describedBy,
  'data-testid': testId,
}: SelectProps<T>) {
  const empty = options.length === 0;
  const off = disabled || empty;
  const why = empty ? m.select_no_options() : reason;
  const chosen = options.some((option) => option.value === value) ? value : null;
  const items = options.map((option) => ({ value: option.value, label: option.label }));

  const trigger = (
    <BaseSelect.Trigger
      ref={triggerRef}
      className={[styles.trigger, className].filter(Boolean).join(' ')}
      aria-label={label}
      data-block={block ? '' : undefined}
      data-testid={testId}
      {...(id === undefined ? {} : { id })}
      {...(describedBy === undefined ? {} : { 'aria-describedby': describedBy })}
    >
      <BaseSelect.Value
        className={styles.value}
        placeholder={placeholder ?? m.select_placeholder()}
      />
      <BaseSelect.Icon className={styles.icon}>
        <ChevronsUpDown aria-hidden="true" />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  );

  return (
    <BaseSelect.Root<T>
      items={items}
      value={chosen}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
      disabled={off}
      {...(name === undefined ? {} : { name })}
    >
      {off && why ? (
        <Tooltip label={label} reason={why} disabled>
          {trigger}
        </Tooltip>
      ) : (
        trigger
      )}
      <BaseSelect.Portal>
        <BaseSelect.Positioner className={styles.positioner} sideOffset={4} collisionPadding={8}>
          <BaseSelect.Popup className={styles.popup}>
            <BaseSelect.List className={styles.list}>
              {options.map((option) => (
                <BaseSelect.Item
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  disabled={option.disabled}
                  className={styles.option}
                  data-value={option.value}
                >
                  <span className={styles.check} aria-hidden="true" />
                  <BaseSelect.ItemText className={styles.optionText}>
                    {option.label}
                  </BaseSelect.ItemText>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
