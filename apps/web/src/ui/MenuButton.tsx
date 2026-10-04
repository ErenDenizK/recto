/**
 * Menu button (09-primitives §11): a button that opens a menu of actions (Shapes ▾, Sign ▾,
 * More, Move to ▾), on Base UI's `Menu.Trigger` (`aria-haspopup="menu"`, `aria-expanded`).
 * It must sit inside a `Menu.Root`; the popup is the caller's, drawn with the menu recipe
 * (`ui/Menu.module.css`).
 *
 * The button is the Select trigger's shape (32 / 44 px, radius `--radius-control`) with the
 * label, an optional leading glyph and `caret-down` at 16 px. `standard` sits on a fill (on M3
 * to M5 and solid surfaces); `quiet` has none (bars on M1 and M2, 09 §3). While the menu is
 * open it keeps the pressed fill.
 */
import { Menu } from '@base-ui/react/menu';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

import styles from './MenuButton.module.css';

export interface MenuButtonProps {
  /** The visible label; also the accessible name unless `aria-label` is given. */
  readonly children: ReactNode;
  /** A 16 px glyph before the label. */
  readonly icon?: ReactNode;
  readonly variant?: 'standard' | 'quiet' | undefined;
  readonly disabled?: boolean | undefined;
  readonly className?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'data-testid'?: string | undefined;
}

export function MenuButton({
  children,
  icon,
  variant = 'standard',
  disabled = false,
  className,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: MenuButtonProps) {
  return (
    <Menu.Trigger
      className={[styles.button, className].filter(Boolean).join(' ')}
      data-variant={variant}
      disabled={disabled}
      data-testid={testId}
      {...(ariaLabel === undefined ? {} : { 'aria-label': ariaLabel })}
    >
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className={styles.label}>{children}</span>
      <ChevronDown className={styles.caret} aria-hidden="true" />
    </Menu.Trigger>
  );
}
