/**
 * SheetGroup and SheetRow: the one body grammar of a sheet (system-audit-2026-10 §3.6.1, which
 * lifts Settings' recipe, 07-sheets S3 §2, into the primitive): inset grouped lists, so every
 * sheet reads as one app. Styles in `SheetGroup.module.css`.
 *
 * - `SheetGroup` is a section label (footnote 600, secondary, sentence case; it names the
 *   group for assistive tech) over a tint well of rows, with an optional footnote under it.
 * - `SheetRow` is one M row: a title, with an optional description under it, leading; a value
 *   (`value`, secondary text) or a control (`children`) trailing. With `full`, its children
 *   take the whole row instead: a field or a list inside the group. Never a bare field on the
 *   sheet (rule 4).
 * - `labelFor` makes the title the label of the trailing control's input.
 *
 *   <SheetGroup label="Format">
 *     <SheetRow title="Type" description="PDF keeps every page as it is">
 *       <Segmented … />
 *     </SheetRow>
 *     <SheetRow title="Size" value="1.2 MB" />
 *   </SheetGroup>
 */
import { type ReactNode, useId } from 'react';

import styles from './SheetGroup.module.css';

export interface SheetGroupProps {
  /** The section label above the group; it names the group. */
  readonly label?: ReactNode;
  /** A note under the group, in footnote. */
  readonly footnote?: ReactNode;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

export function SheetGroup({ label, footnote, className, children }: SheetGroupProps) {
  const labelId = useId();
  return (
    <section className={[styles.section, className].filter(Boolean).join(' ')}>
      {label ? (
        <h3 id={labelId} className={styles.label}>
          {label}
        </h3>
      ) : null}
      <div
        role="group"
        className={styles.group}
        aria-labelledby={label ? labelId : undefined}
        data-sheet-group=""
      >
        {children}
      </div>
      {footnote ? <p className={styles.footnote}>{footnote}</p> : null}
    </section>
  );
}

export interface SheetRowProps {
  /** The row's name, leading. */
  readonly title?: ReactNode;
  /** A line under the title, in footnote. */
  readonly description?: ReactNode;
  /** A value trailing in place of a control: secondary, tabular, truncated. */
  readonly value?: ReactNode;
  /** The id of the trailing control's input: the title becomes its label. */
  readonly labelFor?: string | undefined;
  /** The children take the whole row (a field, a list) instead of trailing. */
  readonly full?: boolean;
  readonly className?: string | undefined;
  readonly 'data-testid'?: string | undefined;
  /** The trailing control, or the row's content with `full`. */
  readonly children?: ReactNode;
}

export function SheetRow({
  title,
  description,
  value,
  labelFor,
  full = false,
  className,
  'data-testid': testId,
  children,
}: SheetRowProps) {
  const rowClass = [styles.row, className].filter(Boolean).join(' ');
  if (full) {
    return (
      <div className={rowClass} data-full="" data-sheet-row="" data-testid={testId}>
        {children}
      </div>
    );
  }
  const name =
    title === undefined ? null : labelFor === undefined ? (
      <span className={styles.title}>{title}</span>
    ) : (
      <label className={styles.title} htmlFor={labelFor}>
        {title}
      </label>
    );
  return (
    <div className={rowClass} data-sheet-row="" data-testid={testId}>
      <div className={styles.text}>
        {name}
        {description ? <span className={styles.description}>{description}</span> : null}
      </div>
      {value !== undefined || children !== undefined ? (
        <div className={styles.trailing}>
          {value !== undefined ? <span className={styles.value}>{value}</span> : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}
