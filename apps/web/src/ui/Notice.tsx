/**
 * Notice, FB9 (components/08-feedback.md §10): a limit said plainly where a person might assume
 * more ("Marks hide nothing until you apply them.", "Recognized text may contain errors.").
 * One recipe replaces the hand-drawn boxes of the sheets and panels (inventory 14.6).
 *
 * - **Anatomy.** A 1 px hairline, `--radius-sm`, 8 × 12 padding; a 16 px glyph (`warning` for
 *   honesty, `info` for information) and footnote text at 500 in the primary colour. No fill,
 *   no stripe, no light: it reads on any host surface, glass or solid.
 * - **Tones.** `honesty` takes the warning hairline (`--warning-line`) and glyph; `info` the
 *   neutral control border and a secondary glyph.
 * - **More.** `more` adds a text button after the sentence ("Why?") that expands one paragraph;
 *   it reads "Less" while open and toggles `aria-expanded` (§10.4, §10.6).
 * - Static: `role="note"`, never announced on show (it is read with its surface); the glyph is
 *   `aria-hidden`. Forced colours draw the border in `CanvasText`.
 */
import { type ReactNode, useId, useState } from 'react';

import { m } from '../i18n';
import { Icon } from './Icon';
import styles from './Notice.module.css';

export interface NoticeProps {
  readonly tone?: 'honesty' | 'info';
  /** The sentence. */
  readonly children: ReactNode;
  /** A "Why?" disclosure: its label and the paragraph it expands. */
  readonly more?: { readonly label: string; readonly detail: ReactNode } | undefined;
  readonly className?: string | undefined;
  readonly testId?: string | undefined;
}

export function Notice({ tone = 'honesty', children, more, className, testId }: NoticeProps) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  return (
    <div
      className={[styles.notice, className].filter(Boolean).join(' ')}
      role="note"
      data-tone={tone}
      data-testid={testId}
    >
      <Icon name={tone === 'honesty' ? 'warning' : 'info'} className={styles.glyph} />
      <div className={styles.text}>
        <p>
          {children}
          {more ? (
            <>
              {' '}
              <button
                type="button"
                className={styles.more}
                aria-expanded={open}
                aria-controls={detailId}
                onClick={() => setOpen(!open)}
              >
                {open ? m.notice_less() : more.label}
              </button>
            </>
          ) : null}
        </p>
        {more ? (
          <p id={detailId} className={styles.detail} hidden={!open}>
            {more.detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}
