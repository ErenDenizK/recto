/**
 * Number field (09-primitives §14): exact numbers such as From and To pages, Start at, font
 * size, margins and DPI, on Base UI's `NumberField`. It replaces the native number inputs,
 * whose spinners and wheel behaviour differ per browser (Q-14).
 *
 * - **Fine pointers.** The well (`Field.module.css`, 32 px) with the value in tabular
 *   numerals, an optional unit after it ("pt", "%") and two 24 × 14 steppers stacked at the
 *   end. **Coarse:** `( − )[ 3 ]( + )`, two 44 px buttons beside the well.
 * - **Keys.** Up and Down step, Shift ten steps, PageUp and PageDown ten, Home and End go to
 *   the bounds; the wheel steps only while the field has focus. Enter commits, Esc restores
 *   the value it had when it took focus.
 * - **Bounds.** A stepper at a bound is disabled. A typed value out of range is clamped when
 *   the field loses focus, and the field says so for 4 s: "Enter a number from 1 to 12." and,
 *   to a screen reader, "Set to 12."
 * - **Locale.** Numbers are read and written in the active language: "1,5" in Turkish, and
 *   both separators are accepted while typing when unambiguous (Base UI's parser).
 */
import { NumberField as BaseNumberField } from '@base-ui/react/number-field';
import { ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react';
import { type FocusEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

import { formatNumber, getLocale, m } from '../i18n';
import field from './Field.module.css';
import styles from './NumberField.module.css';
import { useCoarsePointer } from './Slider';

/** How long the clamp message stays (ms). */
export const CLAMP_MESSAGE_MS = 4000;

export interface NumberFieldProps {
  readonly value: number | null;
  /** Every change: typing (when the text parses), steppers, keys, the wheel. */
  readonly onValueChange: (value: number | null) => void;
  /** On blur after typing, on stepper release and on Enter. */
  readonly onValueCommitted?: ((value: number | null) => void) | undefined;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly step?: number | undefined;
  readonly largeStep?: number | undefined;
  /** Shown after the value ("pt"). */
  readonly unit?: string | undefined;
  /** Formatting of the value (fraction digits). */
  readonly format?: Intl.NumberFormatOptions | undefined;
  /** The accessible name (and the visible label with `showLabel`). */
  readonly label: string;
  readonly showLabel?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly required?: boolean | undefined;
  readonly name?: string | undefined;
  readonly id?: string | undefined;
  readonly className?: string | undefined;
  readonly 'aria-describedby'?: string | undefined;
  readonly 'data-testid'?: string | undefined;
}

/** Reads typed text in the active locale (or with the other separator), for the clamp check. */
export function parseLocaleNumber(text: string, locale: string): number | null {
  const trimmed = text.trim().replace(/\s/g, '');
  if (trimmed === '') return null;
  const decimal = locale.startsWith('tr') ? ',' : '.';
  const group = decimal === ',' ? '.' : ',';
  let normal = trimmed;
  const hasDecimal = normal.includes(decimal);
  const hasGroup = normal.includes(group);
  if (hasDecimal && hasGroup) normal = normal.split(group).join('').replace(decimal, '.');
  else if (hasDecimal) normal = normal.replace(decimal, '.');
  else if (hasGroup) {
    // One "other" separator with one or two digits after it is a decimal ("1.5" in Turkish).
    const parts = normal.split(group);
    normal =
      parts.length === 2 && (parts[1]?.length ?? 0) < 3
        ? `${parts[0]}.${parts[1]}`
        : parts.join('');
  }
  const value = Number(normal.replace(/^−/, '-'));
  return Number.isFinite(value) ? value : null;
}

export function NumberField({
  value,
  onValueChange,
  onValueCommitted,
  min,
  max,
  step = 1,
  largeStep = 10,
  unit,
  format,
  label,
  showLabel = false,
  disabled = false,
  required = false,
  name,
  id,
  className,
  'aria-describedby': describedBy,
  'data-testid': testId,
}: NumberFieldProps) {
  const own = useId();
  const inputId = id ?? `${own}-input`;
  const messageId = `${own}-message`;
  const coarse = useCoarsePointer();
  const locale = getLocale();
  const [clamped, setClamped] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const atFocus = useRef<number | null>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onBlur = (event: FocusEvent<HTMLInputElement>) => {
    const typed = parseLocaleNumber(event.currentTarget.value, locale);
    if (typed === null) return;
    const bound =
      min !== undefined && typed < min ? min : max !== undefined && typed > max ? max : null;
    if (bound === null) return;
    setClamped(bound);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setClamped(null), CLAMP_MESSAGE_MS);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && atFocus.current !== value) {
      event.preventDefault();
      event.stopPropagation();
      onValueChange(atFocus.current);
      return;
    }
    if (event.key === 'Home' && min !== undefined) {
      event.preventDefault();
      onValueChange(min);
    } else if (event.key === 'End' && max !== undefined) {
      event.preventDefault();
      onValueChange(max);
    } else if (event.key === 'Enter') {
      onValueCommitted?.(value);
    }
  };

  const message =
    clamped !== null && min !== undefined && max !== undefined
      ? m.number_range({ min: formatNumber(min), max: formatNumber(max) })
      : null;

  const decrement = (
    <BaseNumberField.Decrement
      className={coarse ? `${styles.side} ${styles.before}` : styles.stepper}
      aria-label={m.number_decrease()}
    >
      {coarse ? <Minus aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
    </BaseNumberField.Decrement>
  );
  const increment = (
    <BaseNumberField.Increment
      className={coarse ? styles.side : styles.stepper}
      aria-label={m.number_increase()}
    >
      {coarse ? <Plus aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
    </BaseNumberField.Increment>
  );

  return (
    <div className={[field.field, styles.root, className].filter(Boolean).join(' ')}>
      {showLabel ? (
        <label htmlFor={inputId} className={field.label}>
          {label}
        </label>
      ) : null}
      <BaseNumberField.Root
        id={inputId}
        value={value}
        onValueChange={(next) => onValueChange(next)}
        onValueCommitted={(next) => onValueCommitted?.(next)}
        step={step}
        largeStep={largeStep}
        smallStep={step}
        allowWheelScrub
        locale={locale}
        disabled={disabled}
        required={required}
        className={styles.group}
        data-coarse={coarse ? '' : undefined}
        {...(min === undefined ? {} : { min })}
        {...(max === undefined ? {} : { max })}
        {...(format === undefined ? {} : { format })}
        {...(name === undefined ? {} : { name })}
      >
        <BaseNumberField.Group
          className={field.well}
          data-disabled={disabled ? '' : undefined}
          data-invalid={clamped !== null ? '' : undefined}
        >
          <BaseNumberField.Input
            className={`${field.input} ${styles.input}`}
            aria-label={showLabel ? undefined : label}
            aria-roledescription={m.number_field_role()}
            aria-describedby={
              [describedBy, message ? messageId : null].filter(Boolean).join(' ') || undefined
            }
            data-testid={testId}
            onFocus={() => {
              atFocus.current = value;
            }}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
          />
          {unit ? (
            <span className={styles.unit} aria-hidden="true">
              {unit}
            </span>
          ) : null}
          {coarse ? null : (
            <span className={styles.steppers}>
              {increment}
              {decrement}
            </span>
          )}
        </BaseNumberField.Group>
        {/* The input comes first, so a <label> around the field names the input; on coarse
            pointers − is drawn before the well (CSS order). */}
        {coarse ? decrement : null}
        {coarse ? increment : null}
      </BaseNumberField.Root>
      {message ? (
        <p id={messageId} className={field.description}>
          {message}
        </p>
      ) : null}
      <span className="visually-hidden" role="status">
        {clamped !== null ? m.number_set({ value: formatNumber(clamped) }) : ''}
      </span>
    </div>
  );
}
