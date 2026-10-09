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
 * - `SheetRowButton` is a row that is one press target (`ui/RowButton`): a row that pushes a
 *   page or follows a link (a caret or ↗ trailing) or a disclosure (`aria-expanded` turns the
 *   caret down), its title and description leading and its value before the glyph. A
 *   disclosure's panel is the `SheetRow full` after it.
 * - Every part passes other attributes to its element (`data-*`, `aria-*`, `id`), so a sheet
 *   that finds its rows by an attribute (Settings' `data-row`) keeps it. A row's title carries
 *   `data-sheet-row-title`, where a test reads whether a label breaks inside a word (A-21).
 *
 *   <SheetGroup label="Format">
 *     <SheetRow title="Type" description="PDF keeps every page as it is">
 *       <Segmented … />
 *     </SheetRow>
 *     <SheetRow title="Size" value="1.2 MB" />
 *   </SheetGroup>
 */
import { type ComponentPropsWithRef, type HTMLAttributes, type ReactNode, useId } from 'react';

import { Icon } from '../Icon';
import { RowButton } from '../RowButton';
import styles from './SheetGroup.module.css';

/** The attributes a part passes to its element; its own props take precedence. */
type Rest<E extends HTMLElement> = Omit<HTMLAttributes<E>, 'title' | 'children' | 'className'> &
  Readonly<Record<`data-${string}`, string | undefined>>;

export interface SheetGroupProps extends Rest<HTMLElement> {
  /** The section label above the group; it names the group. */
  readonly label?: ReactNode;
  /** A note under the group, in footnote. */
  readonly footnote?: ReactNode;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

export function SheetGroup({ label, footnote, className, children, ...rest }: SheetGroupProps) {
  const labelId = useId();
  return (
    <section {...rest} className={[styles.section, className].filter(Boolean).join(' ')}>
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

export interface SheetRowProps extends Rest<HTMLDivElement> {
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
  children,
  ...rest
}: SheetRowProps) {
  const rowClass = [styles.row, className].filter(Boolean).join(' ');
  if (full) {
    return (
      <div {...rest} className={rowClass} data-full="" data-sheet-row="">
        {children}
      </div>
    );
  }
  const name =
    title === undefined ? null : labelFor === undefined ? (
      <span className={styles.title} data-sheet-row-title="">
        {title}
      </span>
    ) : (
      <label className={styles.title} htmlFor={labelFor} data-sheet-row-title="">
        {title}
      </label>
    );
  return (
    <div {...rest} className={rowClass} data-sheet-row="">
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

interface RowButtonText {
  /** The row's name, leading. */
  readonly title: ReactNode;
  /** A line under the title, in footnote. */
  readonly description?: ReactNode;
  /** A value before the trailing glyph: secondary, tabular, truncated. */
  readonly value?: ReactNode;
  /** A leading glyph, 16 px, in the secondary ink. */
  readonly icon?: ReactNode;
  readonly className?: string | undefined;
}

type RowAsButton = Omit<
  ComponentPropsWithRef<'button'>,
  'title' | 'type' | 'children' | 'value'
> & {
  readonly href?: undefined;
};

type RowAsLink = Omit<ComponentPropsWithRef<'a'>, 'title' | 'children'> & {
  readonly href: string;
  /** Read after the title: the link opens a new tab. */
  readonly newTab: string;
};

export type SheetRowButtonProps = RowButtonText & (RowAsButton | RowAsLink);

export function SheetRowButton(props: SheetRowButtonProps) {
  const { title, description, value, icon, className, ...rest } = props;
  const rowClass = [styles.row, styles.rowButton, className].filter(Boolean).join(' ');
  const content = (
    <>
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <span className={styles.text}>
        <span className={styles.title} data-sheet-row-title="">
          {title}
        </span>
        {description ? <span className={styles.description}>{description}</span> : null}
      </span>
      {value !== undefined ? <span className={styles.value}>{value}</span> : null}
      <Icon
        name={rest.href === undefined ? 'caret-right' : 'arrow-up-right'}
        className={styles.caret}
        aria-hidden="true"
      />
    </>
  );
  if (rest.href !== undefined) {
    const { newTab, ...link } = rest;
    return (
      <RowButton {...link} className={rowClass} data-sheet-row="">
        {content}
        <span className="visually-hidden"> {newTab}</span>
      </RowButton>
    );
  }
  return (
    <RowButton {...rest} className={rowClass} data-sheet-row="">
      {content}
    </RowButton>
  );
}
