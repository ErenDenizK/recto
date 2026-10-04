/**
 * Chips (components/09-primitives.md §5): short choices and actions inside panels and bars
 * (Review filters, Pages · Bookmarks, saved signatures). Replace `shell/panels/RadioChips`.
 *
 * - A pill `--chip-h` high (28 px fine, 36 px coarse with a 44 px hit area), padding 10, a
 *   12/16 label at 500 (13/18 coarse), the count in tabular numerals in the secondary colour.
 * - At rest a `--control-fill` wash (none on today's floating glass, the M2 bars); selected is
 *   `--accent-muted` with a 1 px `--accent-line` ring and a leading check, so the state never
 *   rests on colour alone (A-19). Hover is one step; disabled the disabled colour.
 * - `ChipGroup` is a single choice with the APG radio-group keys: one Tab stop on the chosen
 *   chip, the arrows (and Home, End) move and choose. Its accessible names can say more than
 *   the label ("Marks, 2 items").
 * - `Chip` alone is a toggle (`pressed`, `aria-pressed`) or an action; `onRemove` adds a 16 px
 *   ✕ ("Remove: {name}") and makes Delete and Backspace on the focused chip remove it.
 */
import { Check, X } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useRef } from 'react';

import { m } from '../i18n';
import styles from './Chip.module.css';

export interface ChipOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** Shown after the label in tabular numerals. */
  readonly count?: string | undefined;
  /** The accessible name when it should say more than the label ("Marks, 2 items"). */
  readonly name?: string | undefined;
  readonly disabled?: boolean | undefined;
}

export interface ChipGroupProps<T extends string> {
  /** The group's accessible name. */
  readonly label: string;
  readonly chips: readonly ChipOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly className?: string | undefined;
}

const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

/** A row of chips with radio semantics (`role="radiogroup"`, APG radio group keys). */
export function ChipGroup<T extends string>({
  label,
  chips,
  value,
  onChange,
  className,
}: ChipGroupProps<T>) {
  const group = useRef<HTMLDivElement>(null);
  const enabled = chips.map((chip, index) => (chip.disabled ? -1 : index)).filter((i) => i >= 0);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!NAV_KEYS.has(event.key) || enabled.length === 0) return;
    const index = enabled.indexOf(chips.findIndex((chip) => chip.value === value));
    if (index < 0) return;
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = index;
    if (event.key === forwardKey || event.key === 'ArrowDown') next = (index + 1) % enabled.length;
    if (event.key === backKey || event.key === 'ArrowUp') {
      next = (index - 1 + enabled.length) % enabled.length;
    }
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = enabled.length - 1;
    const target = enabled[next];
    const chip = target === undefined ? undefined : chips[target];
    if (!chip || target === undefined) return;
    onChange(chip.value);
    group.current?.querySelectorAll<HTMLElement>('[role="radio"]')[target]?.focus();
  };

  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={label}
      className={[styles.group, className].filter(Boolean).join(' ')}
    >
      {chips.map((chip) => {
        const checked = chip.value === value;
        return (
          <button
            key={chip.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={chip.name}
            aria-disabled={chip.disabled === true ? true : undefined}
            tabIndex={checked ? 0 : -1}
            className={styles.chip}
            data-value={chip.value}
            onKeyDown={onKeyDown}
            onClick={() => {
              if (!checked && !chip.disabled) onChange(chip.value);
            }}
          >
            <ChipContent selected={checked} label={chip.label} count={chip.count} />
          </button>
        );
      })}
    </div>
  );
}

export interface ChipProps {
  readonly label: string;
  readonly count?: string | undefined;
  /** The accessible name when it should say more than the label. */
  readonly name?: string | undefined;
  /** A toggle when set (`aria-pressed`); an action chip when left out. */
  readonly pressed?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly onClick?: (() => void) | undefined;
  /** Adds the ✕ and the Delete and Backspace keys. */
  readonly onRemove?: (() => void) | undefined;
  readonly className?: string | undefined;
}

/** One chip: a toggle or an action, optionally removable. */
export function Chip({
  label,
  count,
  name,
  pressed,
  disabled = false,
  onClick,
  onRemove,
  className,
}: ChipProps) {
  const chip = (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={name}
      aria-disabled={disabled || undefined}
      className={[styles.chip, className].filter(Boolean).join(' ')}
      data-removable={onRemove ? '' : undefined}
      onClick={() => {
        if (!disabled) onClick?.();
      }}
      onKeyDown={(event) => {
        if (onRemove && !disabled && (event.key === 'Delete' || event.key === 'Backspace')) {
          event.preventDefault();
          onRemove();
        }
      }}
    >
      <ChipContent selected={pressed === true} label={label} count={count} />
    </button>
  );
  if (!onRemove) return chip;
  return (
    <span className={styles.removable}>
      {chip}
      <button
        type="button"
        className={styles.remove}
        aria-label={m.chip_remove({ name: name ?? label })}
        aria-disabled={disabled || undefined}
        tabIndex={-1}
        onClick={() => {
          if (!disabled) onRemove();
        }}
      >
        <X aria-hidden="true" />
      </button>
    </span>
  );
}

function ChipContent({
  selected,
  label,
  count,
}: {
  readonly selected: boolean;
  readonly label: string;
  readonly count: string | undefined;
}): ReactNode {
  return (
    <>
      {selected ? <Check className={styles.check} aria-hidden="true" /> : null}
      <span className={styles.label}>{label}</span>
      {count !== undefined ? <span className={styles.count}>{count}</span> : null}
    </>
  );
}
