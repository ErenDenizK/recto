/**
 * Anchor grid: the 3 × 3 positions a page's content or a page mark is placed by (Resize pages'
 * anchor, S17; page furniture's position, S11), as a row's trailing control in a sheet
 * (system-audit-2026-10 §3.6.1). Nine S cells (`--control-h-sm`, 24 fine and 32 coarse) in a
 * well, the chosen one a filled dot on the pressed wash.
 *
 * A radio group with a roving tab stop (APG): the arrow keys move in two dimensions without
 * wrapping and choose, Home and End jump to the first and last position. Disabled, it keeps
 * its value and says so (`aria-disabled`).
 */
import { ANCHOR_POSITIONS, type Anchor } from '@pdf-editor/document-model';
import { type KeyboardEvent, useRef } from 'react';

import styles from './AnchorGrid.module.css';

export function AnchorGrid({
  value,
  disabled,
  labelledBy,
  names,
  onChange,
  'data-testid': testId,
}: {
  readonly value: Anchor;
  readonly disabled: boolean;
  /** The id of the element that names the group (a row's title). */
  readonly labelledBy: string;
  /** Each position's name, in the caller's words ("Top left", "Top centre"). */
  readonly names: (anchor: Anchor) => string;
  readonly onChange: (anchor: Anchor) => void;
  readonly 'data-testid'?: string | undefined;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = ANCHOR_POSITIONS.indexOf(value);

  const move = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const row = Math.floor(index / 3);
    const column = index % 3;
    let next: number;
    switch (event.key) {
      case 'ArrowLeft':
        next = column > 0 ? index - 1 : index;
        break;
      case 'ArrowRight':
        next = column < 2 ? index + 1 : index;
        break;
      case 'ArrowUp':
        next = row > 0 ? index - 3 : index;
        break;
      case 'ArrowDown':
        next = row < 2 ? index + 3 : index;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = 8;
        break;
      default:
        return;
    }
    event.preventDefault();
    const anchor = ANCHOR_POSITIONS[next];
    if (anchor === undefined) return;
    onChange(anchor);
    refs.current[next]?.focus();
  };

  return (
    <div
      className={styles.anchorGrid}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-disabled={disabled || undefined}
      data-testid={testId}
    >
      {ANCHOR_POSITIONS.map((anchor, i) => (
        <button
          key={anchor}
          ref={(element) => {
            refs.current[i] = element;
          }}
          type="button"
          role="radio"
          aria-checked={anchor === value}
          aria-label={names(anchor)}
          aria-disabled={disabled || undefined}
          tabIndex={anchor === value ? 0 : -1}
          className={styles.anchorCell}
          onKeyDown={move}
          onClick={() => {
            if (!disabled) onChange(anchor);
          }}
        >
          <span className={styles.anchorDot} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
