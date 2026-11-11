/**
 * A shelf's frame (DSN-93, `home-recents.html`): the section label, a slot for its quiet controls
 * on the right ("Show all", "Clear", "Select"), the covers' stage and the shelf line at their
 * foot (`Shelf.module.css`). The Open shelf (`LibraryGrid`) and the Recent shelf (`RecentShelf`)
 * are the same form; this holds what they share, and `useFirstRow`, the rule for "Show all":
 * one row of covers until the person asks for the rest.
 */
import {
  type ComponentPropsWithoutRef,
  type ReactNode,
  type RefObject,
  useEffect,
  useState,
} from 'react';

import { m } from '../i18n';
import { Icon } from '../ui/Icon';
import styles from './Shelf.module.css';
import { TEXT_SAFE_ATTR } from './text-safe';

export function Shelf({
  headingId,
  label,
  right,
  lit,
  testId,
  children,
}: {
  readonly headingId: string;
  readonly label: string;
  readonly right?: ReactNode;
  /** The lit line of the first visit (`--shelf-line-lit`). */
  readonly lit?: boolean;
  readonly testId?: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      className={styles.shelf}
      aria-labelledby={headingId}
      data-testid={testId}
      data-lit={lit === true ? '' : undefined}
    >
      <div className={styles.head} {...{ [TEXT_SAFE_ATTR]: '' }}>
        <h2 id={headingId} className={styles.label}>
          {label}
        </h2>
        <div className={styles.right}>{right}</div>
      </div>
      <div className={styles.stage}>
        {children}
        <span className={styles.line} aria-hidden="true" data-shelf-line="" />
      </div>
    </section>
  );
}

/** The shelf's quiet text control: 13 px tertiary, with a 44 px hit area on touch. */
export function ShelfText({ children, className, ...rest }: ComponentPropsWithoutRef<'button'>) {
  return (
    // The shelf text control: 13 px tertiary, no fill, not an action button's look.
    // eslint-disable-next-line recto/q9-controls
    <button type="button" {...rest} className={[styles.text, className].filter(Boolean).join(' ')}>
      {children}
    </button>
  );
}

/** "Show all ›": the shelf's toggle, shown only while some covers do not fit one row. */
export function ShowAll({
  expanded,
  onToggle,
}: {
  readonly expanded: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <ShelfText aria-expanded={expanded} data-testid="home-show-all" onClick={onToggle}>
      {m.home_show_all()}
      <Icon name="caret-right" />
    </ShelfText>
  );
}

/** The row's width before it is measured: the window less Home's two margins (`Desk.module.css`). */
function estimatedRowWidth(): number {
  const width = window.innerWidth;
  return width - 2 * Math.min(120, Math.max(64, (width - 1200) / 2));
}

/**
 * How many tiles of `widths`, `gap` apart, sit on the first line of a row `rowWidth` wide: at
 * least one, and with a pixel of slack, since a tile that fits only by rounding would wrap and a
 * wrapped tile in a collapsed row is a second row.
 */
export function firstRowFit(widths: readonly number[], gap: number, rowWidth: number): number {
  let used = 0;
  let fit = 0;
  for (const width of widths) {
    const next = used + (fit > 0 ? gap : 0) + width;
    if (fit > 0 && next > rowWidth - 1) break;
    used = next;
    fit += 1;
  }
  return fit;
}

/**
 * One row of covers until "Show all". The tiles' widths are known (a cover is as wide as its
 * height and aspect make it), so how many sit on the first line is arithmetic over the row's
 * width, with no measuring of the tiles: the rest are hidden (`hidden`: out of the layout, the
 * tab order and the arrow keys). The row's width starts as the window's estimate and is the
 * real one as soon as it is observed, so nothing wraps for a frame.
 */
export function useFirstRow(
  listRef: RefObject<HTMLElement | null>,
  widths: readonly number[],
  gap: number,
): {
  readonly expanded: boolean;
  readonly toggle: () => void;
  /** How many tiles are shown now. */
  readonly shown: number;
  /** Some tiles do not fit the first row. */
  readonly overflow: boolean;
} {
  const [expanded, setExpanded] = useState(false);
  const [rowWidth, setRowWidth] = useState(estimatedRowWidth);

  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setRowWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [listRef]);

  const fit = firstRowFit(widths, gap, rowWidth);
  const overflow = fit < widths.length;
  return {
    expanded,
    toggle: () => setExpanded((open) => !open),
    shown: expanded || !overflow ? widths.length : fit,
    overflow,
  };
}
