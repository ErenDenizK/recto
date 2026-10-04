/**
 * A row of swatches (`10-ink.md` §5): one `radiogroup` on Base UI's `RadioGroup`, so the
 * row is one Tab stop and the arrows move and choose (APG radio group). The value is the
 * chosen swatch's colour, or null when the current colour is none of them (a custom colour
 * chosen in the colour panel): then no swatch is checked and the first takes the Tab stop.
 */
import { RadioGroup } from '@base-ui/react/radio-group';
import type { ReactNode } from 'react';

import styles from './Swatch.module.css';

export interface SwatchGroupProps {
  /** The chosen colour (`#RRGGBB` or `NO_FILL`), or null. */
  readonly value: string | null;
  readonly onValueChange: (value: string) => void;
  /** The group's accessible name ("Ink colour"). */
  readonly label: string;
  readonly disabled?: boolean | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

/** Case-insensitive match, so `#1a1a1a` checks the `#1A1A1A` swatch. */
function normal(value: string | null): string | null {
  return value === null ? null : value.startsWith('#') ? value.toUpperCase() : value;
}

export function SwatchGroup({
  value,
  onValueChange,
  label,
  disabled,
  className,
  children,
}: SwatchGroupProps) {
  return (
    <RadioGroup
      aria-label={label}
      value={normal(value)}
      onValueChange={(next) => onValueChange(String(next))}
      disabled={disabled}
      className={[styles.group, className].filter(Boolean).join(' ')}
    >
      {children}
    </RadioGroup>
  );
}
