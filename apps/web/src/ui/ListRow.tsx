/**
 * ListRow (system-audit-2026-10 §3.6, §3.8; quality-bar Q-9, Q-14): one pressable row of a list
 * in a panel, the sidebar's Review items (comments, fields, marks, words to check), Compare's
 * changes, a recognised page. One recipe instead of a hand-drawn `<button>` per panel, so every
 * list in the sidebar has the same height, radius, washes and focus.
 *
 * - An M row: at least `--control-h` high (32 fine, 44 coarse), `--radius-control` (10), padding
 *   6 × 8, body text, leading-aligned; the content is the caller's (a glyph, a title and lines
 *   under it, a trailing value). `align="start"` tops a multi-line row's glyph.
 * - States: a hover wash on fine pointers, the pressed wash, the inset two-band focus ring
 *   (`styles/focus.css`, rows in scrollers). `current` is the row the reader is on
 *   (`aria-current`): the current-row wash (`--accent-muted`, tokens.css' control block keeps
 *   lime for current rows), with tertiary text one step up so it stays AA on the wash.
 * - Disabled stays focusable and reads as disabled (`aria-disabled`); a press does nothing.
 */
import type { ComponentPropsWithRef, MouseEvent, ReactNode } from 'react';

import styles from './ListRow.module.css';

export interface ListRowProps extends Omit<ComponentPropsWithRef<'button'>, 'type' | 'disabled'> {
  /** The row the reader is on: `aria-current="true"` and the current-row wash. */
  readonly current?: boolean | undefined;
  /** Where a multi-line row's content sits on the cross axis. */
  readonly align?: 'center' | 'start';
  readonly disabled?: boolean | undefined;
  readonly children: ReactNode;
}

export function ListRow({
  current = false,
  align = 'center',
  disabled = false,
  className,
  onClick,
  children,
  ...rest
}: ListRowProps) {
  return (
    <button
      aria-current={current ? 'true' : undefined}
      aria-disabled={disabled || undefined}
      {...rest}
      type="button"
      className={[styles.row, className].filter(Boolean).join(' ')}
      data-align={align}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {children}
    </button>
  );
}
