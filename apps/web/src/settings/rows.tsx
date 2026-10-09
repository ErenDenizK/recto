/**
 * The Settings sheet's building blocks (components/07-sheets.md S3 §2, §8): a section with its
 * heading, a group (one tint well), and the row shapes every setting takes.
 *
 * - `Row` holds a control: a `Switch` (whose label is the row), a segmented control, a field,
 *   or a label with a value and one button. Rows that hold a bar of controls carry
 *   `data-bar="settings-row"`, so the control audit (quality-bar Q-9) checks them like any bar.
 * - `NavRow` pushes a page or follows a link: the whole row is one button, with its value and
 *   a caret (or ↗ for a link out of the app).
 *
 * Every row carries `data-row` with its id from `search-index.ts`: search filters by it, and
 * an opener's target is revealed and focused through it.
 */
import { type ReactNode, useId } from 'react';

import { m } from '../i18n';
import { Icon } from '../ui/Icon';
import styles from './Settings.module.css';

export function Section({
  id,
  title,
  label,
  children,
}: {
  /** The section's id (`search-index.ts`), for an opener that names it. */
  readonly id?: string;
  /** The visible heading; without one, `label` names the section for assistive technology. */
  readonly title: string | null;
  readonly label?: string;
  readonly children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      className={styles.section}
      data-section={id}
      aria-labelledby={title ? headingId : undefined}
      aria-label={title ? undefined : label}
    >
      {title ? (
        <h3 id={headingId} className={styles.heading}>
          {title}
        </h3>
      ) : null}
      <div className={styles.group}>{children}</div>
    </section>
  );
}

export function Row({
  id,
  bar = false,
  children,
}: {
  /** A `SettingsRowId`, or a list row's own key (a kept document). */
  readonly id: string;
  /** The row is a bar of controls (a value and a button, a segmented control, a field). */
  readonly bar?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.row} data-row={id} data-bar={bar ? 'settings-row' : undefined}>
      {children}
    </div>
  );
}

/**
 * A row's one shape (07 S3 §2): the name leading, with its description under it, and the value
 * and control trailing. `descriptionId` lets the control name the description as its own.
 */
export function Line({
  label,
  description,
  descriptionId,
  labelHidden = false,
  value,
  children,
}: {
  readonly label: ReactNode;
  /** A second line under the name. */
  readonly description?: ReactNode;
  readonly descriptionId?: string | undefined;
  /** The control carries the name itself (a field's own label): shown, not read twice. */
  readonly labelHidden?: boolean;
  readonly value?: ReactNode;
  readonly children?: ReactNode;
}) {
  const name = (
    <span className={styles.label} aria-hidden={labelHidden || undefined}>
      {label}
    </span>
  );
  return (
    <div className={styles.line}>
      {description ? (
        <span className={styles.text}>
          {name}
          <span id={descriptionId} className={styles.hint}>
            {description}
          </span>
        </span>
      ) : (
        name
      )}
      {value !== undefined ? <span className={styles.value}>{value}</span> : null}
      {children}
    </div>
  );
}

export function NavRow({
  id,
  label,
  value,
  hint,
  icon,
  onPress,
  href,
}: {
  /** A `SettingsRowId`, or a list row's own key (a kept document). */
  readonly id: string;
  readonly label: string;
  readonly value?: ReactNode;
  /** A second line (search lists the rows it found inside the page here). */
  readonly hint?: string | undefined;
  readonly icon?: ReactNode;
  /** Pushes the page (or runs the action). */
  readonly onPress?: () => void;
  /** A link out of the app: a new tab, never a referrer. */
  readonly href?: string;
}) {
  const content = (
    <>
      {icon}
      <span className={styles.navText}>
        <span className={styles.label}>{label}</span>
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </span>
      {value ? <span className={styles.value}>{value}</span> : null}
      {href ? (
        <Icon name="arrow-up-right" className={styles.caret} />
      ) : (
        <Icon name="caret-right" className={styles.caret} />
      )}
    </>
  );
  return (
    <div className={`${styles.row} ${styles.navRow}`} data-row={id}>
      {href ? (
        <a className={styles.nav} href={href} target="_blank" rel="noreferrer">
          {content}
          <span className="visually-hidden"> {m.about_new_tab()}</span>
        </a>
      ) : (
        <button
          type="button"
          // The whole row is the control (07 S3 §2: a navigation row pushes its page), drawn
          // by the group's row grammar rather than as a button inside it.
          // eslint-disable-next-line recto/q9-controls
          className={styles.nav}
          onClick={onPress}
        >
          {content}
        </button>
      )}
    </div>
  );
}
