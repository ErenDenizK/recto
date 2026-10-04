/**
 * Empty note (components/09-primitives.md §22): two quiet lines inside a panel or popover with
 * nothing to show ("No comments, marks or fields"; "No matches in report.pdf"). Large empty
 * states (the Library launcher) are the library family's.
 *
 * - The title 13/18 at 500 in the primary colour, the line 12/16 in the secondary colour, an
 *   optional quiet button under them, an optional 32 px glyph above; centred, at most 280 px
 *   wide. It fades in over 120 ms. Never the aurora.
 * - `status` makes it a live status, for a note that replaces results after a search.
 */
import type { ReactNode } from 'react';

import { Button } from './Button';
import styles from './EmptyNote.module.css';

export interface EmptyNoteProps {
  readonly title: string;
  /** One sentence that says what to do. */
  readonly body?: string | undefined;
  /** A 32 px glyph above the title. */
  readonly icon?: ReactNode;
  /** One quiet action under the lines ("Recognize text…"). */
  readonly action?: { readonly label: string; readonly onClick: () => void } | undefined;
  /** Announce it (`role="status"`): a note that replaces results after a search. */
  readonly status?: boolean | undefined;
}

export function EmptyNote({ title, body, icon, action, status = false }: EmptyNoteProps) {
  return (
    <div className={styles.note} role={status ? 'status' : undefined}>
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <p className={styles.title}>{title}</p>
      {body ? <p className={styles.body}>{body}</p> : null}
      {action ? (
        <Button variant="quiet" className={styles.action} onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
