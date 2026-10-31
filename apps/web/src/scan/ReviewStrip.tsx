/**
 * The review (plan bm-scan-plan §3 "Review strip"): the selected page large, one row of icon
 * actions on it (adjust corners, rotate, retake, delete; names in their tooltips) beside a small
 * filter control, and the strip of every captured page with Move earlier / later and Scan another
 * as icons. Reorder is those two buttons and ⌥← / ⌥→ on a focused thumbnail; a drag on touch is a
 * known gap (PRD-34). The strip is a plain list of buttons, so it reads and tabs like any list.
 */
import type { KeyboardEvent } from 'react';

import { m } from '../i18n';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Segmented } from '../ui/Segmented';
import type { ScanFilter } from './encode';
import styles from './ReviewStrip.module.css';
import {
  FILTERS,
  movePage,
  removePage,
  retakePage,
  rotatePage,
  selectPage,
  type ScanPage,
  setFilter,
  setView,
} from './scan-store';

const filterLabel = (filter: ScanFilter): string =>
  filter === 'colour'
    ? m.scan_filter_colour()
    : filter === 'greyscale'
      ? m.scan_filter_greyscale()
      : filter === 'bw'
        ? m.scan_filter_bw()
        : m.scan_filter_photo();

export interface ReviewStripProps {
  readonly pages: readonly ScanPage[];
  readonly selected: ScanPage | undefined;
}

export function ReviewStrip({ pages, selected }: ReviewStripProps) {
  const index = selected ? pages.indexOf(selected) : -1;

  const onThumbKey = (page: ScanPage, event: KeyboardEvent<HTMLButtonElement>) => {
    if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    movePage(page.id, event.key === 'ArrowLeft' ? -1 : 1);
  };

  return (
    <div className={styles.review} data-testid="scan-review">
      <div className={styles.stage}>
        {selected?.preview ? (
          <img
            className={styles.page}
            src={selected.preview}
            alt={m.scan_page_n({ n: index + 1 })}
            data-testid="scan-preview"
          />
        ) : (
          <p className={styles.pending}>{m.scan_preview_pending()}</p>
        )}
      </div>

      {selected && (
        <div className={styles.tools}>
          <div className={styles.actions} role="group" aria-label={m.scan_title()}>
            <IconButton
              label={m.scan_adjust()}
              icon={<Icon name="crop" />}
              data-testid="scan-adjust"
              onClick={() => setView('adjust')}
            />
            <IconButton
              label={m.scan_rotate()}
              icon={<Icon name="arrow-clockwise" />}
              data-testid="scan-rotate"
              onClick={() => rotatePage(selected.id)}
            />
            <IconButton
              label={m.scan_retake()}
              icon={<Icon name="scan" />}
              data-testid="scan-retake"
              onClick={() => retakePage(selected.id)}
            />
            <IconButton
              label={m.scan_delete()}
              icon={<Icon name="trash" />}
              data-testid="scan-delete"
              onClick={() => removePage(selected.id)}
            />
          </div>
          <Segmented
            className={styles.filter}
            label={m.scan_filter()}
            value={selected.filter}
            onValueChange={(filter) => setFilter(selected.id, filter)}
            options={FILTERS.map((value) => ({ value, label: filterLabel(value) }))}
          />
        </div>
      )}

      <div className={styles.strip}>
        <ul className={styles.thumbs} aria-label={m.scan_pages()}>
          {pages.map((page, i) => (
            <li key={page.id}>
              <button
                type="button"
                // A page thumbnail is a picture to pick, not an action capsule (Q-14).
                // eslint-disable-next-line recto/q9-controls
                className={styles.thumb}
                aria-label={m.scan_page_n({ n: i + 1 })}
                aria-current={page.id === selected?.id ? 'true' : undefined}
                data-testid="scan-thumb"
                data-page={page.id}
                onClick={() => selectPage(page.id)}
                onKeyDown={(event) => onThumbKey(page, event)}
              >
                {page.preview && <img src={page.preview} alt="" draggable={false} />}
                <span className={styles.number}>{i + 1}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.move} role="group" aria-label={m.scan_pages()}>
          <IconButton
            label={m.scan_earlier()}
            icon={<Icon name="caret-left" />}
            disabled={index <= 0}
            data-testid="scan-earlier"
            onClick={() => selected && movePage(selected.id, -1)}
          />
          <IconButton
            label={m.scan_later()}
            icon={<Icon name="caret-right" />}
            disabled={index < 0 || index >= pages.length - 1}
            data-testid="scan-later"
            onClick={() => selected && movePage(selected.id, 1)}
          />
          <IconButton
            label={m.scan_another()}
            icon={<Icon name="plus" />}
            data-testid="scan-another"
            onClick={() => setView('camera')}
          />
        </div>
      </div>
    </div>
  );
}
