/**
 * The review (plan bm-scan-plan §3 "Review strip"): the selected page large, the actions on it
 * (adjust corners, rotate, filter, retake, delete) and the strip of every captured page. Reorder
 * is a pair of buttons on the selected page and ⌥← / ⌥→ on a focused thumbnail; a drag on touch
 * is a later refinement (plan: "long-press and drag"). The strip is a plain list of buttons, so
 * it reads and tabs like any list.
 */
import type { KeyboardEvent } from 'react';

import { m } from '../i18n';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
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
        <div className={styles.actions}>
          <Segmented
            label={m.scan_filter()}
            value={selected.filter}
            onValueChange={(filter) => setFilter(selected.id, filter)}
            options={FILTERS.map((value) => ({ value, label: filterLabel(value) }))}
          />
          <div className={styles.row} role="group" aria-label={m.scan_title()}>
            <Button
              icon={<Icon name="crop" />}
              data-testid="scan-adjust"
              onClick={() => setView('adjust')}
            >
              {m.scan_adjust()}
            </Button>
            <Button
              icon={<Icon name="arrow-clockwise" />}
              data-testid="scan-rotate"
              onClick={() => rotatePage(selected.id)}
            >
              {m.scan_rotate()}
            </Button>
            <Button
              icon={<Icon name="scan" />}
              data-testid="scan-retake"
              onClick={() => retakePage(selected.id)}
            >
              {m.scan_retake()}
            </Button>
            <Button
              variant="danger"
              icon={<Icon name="trash" />}
              data-testid="scan-delete"
              onClick={() => removePage(selected.id)}
            >
              {m.scan_delete()}
            </Button>
          </div>
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
          <Button
            icon={<Icon name="caret-left" />}
            disabled={index <= 0}
            data-testid="scan-earlier"
            onClick={() => selected && movePage(selected.id, -1)}
          >
            {m.scan_earlier()}
          </Button>
          <Button
            icon={<Icon name="caret-right" />}
            disabled={index < 0 || index >= pages.length - 1}
            data-testid="scan-later"
            onClick={() => selected && movePage(selected.id, 1)}
          >
            {m.scan_later()}
          </Button>
          <Button
            icon={<Icon name="plus" />}
            data-testid="scan-another"
            onClick={() => setView('camera')}
          >
            {m.scan_another()}
          </Button>
        </div>
      </div>
    </div>
  );
}
