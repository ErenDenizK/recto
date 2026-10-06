/**
 * Search field (09-primitives §13): Find, the command palette input, the Library filter. The
 * well of the text field (`Field.module.css`) with `magnifying-glass` 16 leading, an optional
 * count trailing in tabular numerals ("3 / 12", or "No results" in the secondary colour,
 * which is not an error), and a clear button once there is text.
 *
 * - `type="search"` and `enterkeyhint="search"`, with the browser's own cancel button and
 *   decorations removed (Q-14): the clear button is ours ("Clear search"), 24 px on fine
 *   pointers and 36 in a 44 px well on coarse, and it returns focus to the input.
 * - **Esc ladder.** The first Esc clears the text and keeps the key; on an empty field Esc
 *   passes on (the surface closes or the search ends).
 * - `onSearch` runs 150 ms after the last keystroke (and at once on clear); `onValueChange`
 *   follows every keystroke. Enter and Shift+Enter belong to the caller (`onKeyDown`).
 * - The count is shown only; the caller announces results in its own live region.
 */
import { type ComponentPropsWithRef, useEffect, useRef } from 'react';

import { m } from '../i18n';
import styles from './Field.module.css';
import { Icon } from './Icon';
import search from './SearchField.module.css';

/** How long typing pauses before the search runs (ms). */
export const SEARCH_DEBOUNCE_MS = 150;

type NativeInput = Omit<
  ComponentPropsWithRef<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'className' | 'children' | 'type' | 'size'
>;

export interface SearchFieldProps extends NativeInput {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  /** Runs after typing pauses for 150 ms, and at once when the field is cleared. */
  readonly onSearch?: ((value: string) => void) | undefined;
  /** The accessible name. */
  readonly label: string;
  /** "3 / 12" (shown, not spoken); with `noResults`, "No results". */
  readonly count?: string | undefined;
  readonly noResults?: boolean | undefined;
  readonly className?: string | undefined;
}

export function SearchField({
  value,
  onValueChange,
  onSearch,
  label,
  count,
  noResults = false,
  className,
  onKeyDown,
  ref,
  ...rest
}: SearchFieldProps) {
  const own = useRef<HTMLInputElement | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const change = (next: string, now = false) => {
    onValueChange(next);
    window.clearTimeout(timer.current);
    if (!onSearch) return;
    if (now) onSearch(next);
    else timer.current = window.setTimeout(() => onSearch(next), SEARCH_DEBOUNCE_MS);
  };

  const shownCount = noResults ? m.search_no_results() : count;

  return (
    <div
      className={[styles.well, search.well, className].filter(Boolean).join(' ')}
      data-disabled={rest.disabled ? '' : undefined}
    >
      <Icon name="magnifying-glass" className={search.glass} />
      <input
        {...rest}
        ref={(node) => {
          own.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        type="search"
        enterKeyHint="search"
        aria-label={label}
        className={[styles.input, search.input].join(' ')}
        value={value}
        onChange={(event) => change(event.currentTarget.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || event.key !== 'Escape' || value === '') return;
          event.preventDefault();
          event.stopPropagation();
          change('', true);
        }}
      />
      {shownCount ? (
        <span className={search.count} data-none={noResults ? '' : undefined} aria-hidden="true">
          {shownCount}
        </span>
      ) : null}
      {value !== '' ? (
        <button
          type="button"
          className={styles.wellButton}
          aria-label={m.search_clear()}
          disabled={rest.disabled}
          onClick={() => {
            change('', true);
            own.current?.focus();
          }}
        >
          <Icon name="x" />
        </button>
      ) : null}
    </div>
  );
}
