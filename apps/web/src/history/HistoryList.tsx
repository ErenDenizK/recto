/**
 * The History scrubber's list (08-feedback FB7, fine pointers): newest at the top, one row per
 * step with its time, label, page and (with several documents open) document; the current
 * step carries the check. A `listbox` with `aria-activedescendant`, so focus stays on the list
 * while the active row moves.
 *
 * | Key | Does |
 * |-----|------|
 * | ↑ ↓ | The newer / older step, previewed once the key settles (`preview.ts`) |
 * | Page Up · Page Down | Ten steps |
 * | Home · End | The newest · the oldest step |
 * | Enter | Keeps the active step |
 * | Esc | Restores the step the scrubber opened at (the popover's) |
 *
 * A click keeps the row clicked. The rule under the oldest step a reload keeps marks the
 * snapshot's tail (FB7 §2, flows.md §5.2), shown only while changes are kept on this device.
 * A time is shown once for a run of rows in the same minute (the rows below it leave the
 * column empty; each option's name still says its time). Steps that were undone, the future,
 * are dimmed against the past ones (FB7 §4).
 */
import { DEFAULT_HISTORY_TAIL } from '@pdf-editor/document-model';
import { type KeyboardEvent, type Ref, useEffect, useId, useRef } from 'react';

import { m } from '../i18n';
import { Icon } from '../ui/Icon';
import styles from './HistoryScrubber.module.css';
import type { ScrubberStep } from './labels';

export interface HistoryListProps {
  /** Newest first (`scrubberSteps`). */
  readonly steps: readonly ScrubberStep[];
  /** The entry index of the active row. */
  readonly active: number;
  /** The entry index of the present step when the tail is kept, else undefined. */
  readonly tailFrom: number | undefined;
  readonly onActiveChange: (index: number) => void;
  readonly onKeep: (index: number) => void;
  readonly listRef?: Ref<HTMLDivElement>;
}

const PAGE = 10;

export function HistoryList({
  steps,
  active,
  tailFrom,
  onActiveChange,
  onKeep,
  listRef,
}: HistoryListProps) {
  const id = useId();
  const rowsRef = useRef<HTMLDivElement>(null);
  const position = Math.max(
    0,
    steps.findIndex((step) => step.index === active),
  );
  const rowId = (index: number) => `${id}-step-${index}`;
  // The oldest step a reload keeps: the tail's undo steps end here.
  const oldestKept = tailFrom === undefined ? undefined : tailFrom - DEFAULT_HISTORY_TAIL;

  useEffect(() => {
    rowsRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const move = (to: number) => {
    const step = steps[Math.min(steps.length - 1, Math.max(0, to))];
    if (step && step.index !== active) onActiveChange(step.index);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, () => void> = {
      ArrowUp: () => move(position - 1),
      ArrowDown: () => move(position + 1),
      PageUp: () => move(position - PAGE),
      PageDown: () => move(position + PAGE),
      Home: () => move(0),
      End: () => move(steps.length - 1),
      Enter: () => onKeep(active),
      ' ': () => onKeep(active),
    };
    const run = keys[event.key];
    if (!run || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    run();
  };

  return (
    <div
      ref={listRef}
      role="listbox"
      tabIndex={0}
      aria-label={m.history_list_label()}
      aria-activedescendant={rowId(active)}
      className={styles.list}
      data-testid="history-list"
      onKeyDown={onKeyDown}
    >
      <div ref={rowsRef} role="presentation" className={styles.rows}>
        {steps.map((step, row) => (
          <div key={step.index} role="presentation" className={styles.rowWrap}>
            {/* Options are driven from the listbox via aria-activedescendant (APG); they take
                pointer input only and are never focused themselves. */}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
            <div
              id={rowId(step.index)}
              role="option"
              tabIndex={-1}
              aria-selected={step.index === active}
              aria-label={step.name}
              aria-current={step.state === 'present' ? 'step' : undefined}
              className={styles.row}
              data-index={step.index}
              data-state={step.state}
              data-active={step.index === active ? '' : undefined}
              onClick={() => onKeep(step.index)}
            >
              <span className={styles.time}>
                {steps[row - 1]?.time === step.time ? null : step.time}
              </span>
              <span className={styles.check} aria-hidden="true">
                {step.state === 'present' ? <Icon name="check" /> : null}
              </span>
              <span className={styles.label}>
                <span className={styles.labelText}>{step.label}</span>
                {step.page === undefined ? null : (
                  <span className={styles.meta}>{m.history_row_page({ page: step.page })}</span>
                )}
                {step.document === undefined ? null : (
                  <span className={styles.meta}>{step.document}</span>
                )}
              </span>
            </div>
            {step.index === oldestKept ? (
              // Hidden from the listbox's tree, where only options belong.
              <div className={styles.rule} aria-hidden="true">
                <span>{m.history_tail_rule()}</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
