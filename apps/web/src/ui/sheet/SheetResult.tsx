/**
 * The one result page (components/07-sheets.md §0 "Results and errors are visible", §2.1;
 * inventory 14.7's five result layouts become this one): a glyph, a title, a sentence and an
 * optional list of details, shown as a sheet's body once its work is done, with Done as the
 * sheet's primary. A success or a partial result is announced politely; a failure the person
 * must act on, assertively (§2.6, L§8). Colour is never the only signal: each tone has its
 * glyph and its words (A-19).
 */
import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';

import { announce } from '../../shell/announcer';
import styles from './SheetResult.module.css';

export type ResultTone = 'success' | 'info' | 'warning' | 'error';

const GLYPHS = {
  success: CircleCheck,
  info: Info,
  warning: TriangleAlert,
  error: CircleX,
} as const;

export function SheetResult({
  tone,
  title,
  body,
  details,
  children,
}: {
  readonly tone: ResultTone;
  readonly title: string;
  readonly body?: string | undefined;
  /** Lines under the sentence ("3 pages", "report-small.pdf · 1.1 MB"). */
  readonly details?: readonly ReactNode[] | undefined;
  /** Actions or more content under the result. */
  readonly children?: ReactNode;
}) {
  const Glyph = GLYPHS[tone];
  useEffect(() => {
    announce(body ? `${title} ${body}` : title, {
      politeness: tone === 'error' ? 'assertive' : 'polite',
    });
  }, [tone, title, body]);
  return (
    <section className={styles.result} data-tone={tone} data-testid="sheet-result">
      <Glyph aria-hidden="true" className={styles.glyph} />
      <h3 className={styles.title}>{title}</h3>
      {body ? <p className={styles.body}>{body}</p> : null}
      {details && details.length > 0 ? (
        <ul className={styles.details}>
          {details.map((detail, index) => (
            <li key={index}>{detail}</li>
          ))}
        </ul>
      ) : null}
      {children}
    </section>
  );
}
