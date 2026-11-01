/**
 * The Text view's bar (PRD-36 §2, DSN-84): the capsule's M2 pill in the place of the reader's
 * capsule, with Page view, the `n / N` button (the Go to page sheet), Find and Aa. It takes its
 * actions through props, so it knows nothing of the shell. Targets are 44 px (Q-9); there is no
 * markup here, the view is read-only (BM-15).
 */
import { formatNumber, m } from '../i18n';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Surface } from '../ui/Surface';
import { ReadingOptions } from './ReadingOptions';
import styles from './TextViewBar.module.css';

export interface TextViewBarProps {
  /** The page at the top of the column, 0-based. */
  readonly page: number;
  readonly pageCount: number;
  readonly onPageView: () => void;
  readonly onGoto: () => void;
  readonly onFind: () => void;
  /** Steps away (inert, faded) while another bar, Find's, takes its place. */
  readonly away?: boolean;
}

export function TextViewBar({
  page,
  pageCount,
  onPageView,
  onGoto,
  onFind,
  away = false,
}: TextViewBarProps) {
  const position = `${formatNumber(page + 1)} / ${formatNumber(pageCount)}`;
  return (
    <Surface
      tier="bar"
      sigma={10}
      className={styles.bar}
      data-away={away || undefined}
      inert={away}
      data-testid="text-view-bar"
    >
      <IconButton
        label={m.text_view_close()}
        icon={<Icon name="file-text" />}
        tooltipSide="top"
        onClick={onPageView}
        data-testid="text-view-page-view"
      />
      <Button
        variant="quiet"
        className={styles.position}
        style={{ minWidth: `calc(${2 * String(pageCount).length + 3}ch + 28px)` }}
        aria-label={`${m.goto_title()}, ${position}`}
        onClick={onGoto}
        data-testid="text-view-position"
      >
        {position}
      </Button>
      <IconButton
        label={m.compact_find()}
        icon={<Icon name="magnifying-glass" />}
        tooltipSide="top"
        onClick={onFind}
        data-testid="text-view-find"
      />
      <ReadingOptions />
    </Surface>
  );
}
