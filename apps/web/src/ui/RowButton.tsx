/**
 * RowButton: a whole row that is one press target (components/09-primitives.md §2.3;
 * quality-bar Q-14; system-audit-2026-10 §3.6.1), for the lists whose row is the action: a
 * settings row that pushes a page, a disclosure row in a sheet, a Recents entry. It owns the
 * states and the caller owns the layout of its children (`className`):
 *
 * - no fill at rest; the hover wash on fine pointers and the pressed wash (`--surface-hover`,
 *   `--surface-active`), with the large press scale when `press` (a row that opens something
 *   big, like a document);
 * - the inset two-band focus ring (`styles/focus.css`), which follows the row's radius;
 * - the full width of its container, start-aligned text, the font of its row.
 *
 * `href` makes it a link out of the app (a new tab, never a referrer). Everything else passes
 * through to the element, so a disclosure sets `aria-expanded` and a list its roving keys.
 */
import type { ComponentPropsWithRef } from 'react';

import styles from './RowButton.module.css';

type ButtonProps = Omit<ComponentPropsWithRef<'button'>, 'type'> & {
  readonly href?: undefined;
  /** The large press scale (a row that opens a document). */
  readonly press?: boolean;
};

type LinkProps = ComponentPropsWithRef<'a'> & {
  readonly href: string;
  readonly press?: boolean;
};

export type RowButtonProps = ButtonProps | LinkProps;

export function RowButton(props: RowButtonProps) {
  if (props.href !== undefined) {
    const { className, press = false, children, ...rest } = props;
    return (
      <a
        target="_blank"
        rel="noreferrer"
        {...rest}
        className={[styles.row, className].filter(Boolean).join(' ')}
        data-press={press || undefined}
      >
        {children}
      </a>
    );
  }
  const { className, press = false, ...rest } = props;
  return (
    <button
      type="button"
      {...rest}
      className={[styles.row, className].filter(Boolean).join(' ')}
      data-press={press || undefined}
    />
  );
}
