/**
 * The page pill's moving text (docs/design/motion-2026-10/frame.md §4): the page number rolls
 * like an odometer and the zoom percentage cross-fades, so the pill never cuts from one value
 * to the next while the reader scrolls or zooms.
 *
 * - **Roll** (`Roll`): the number is laid out one tabular cell per character, right-aligned to
 *   the last value's length. A cell whose character changed rolls: the old one slides up and
 *   out of its cell while the new one comes up from below (down and in when the number fell),
 *   on `--spring-quick` with the entry fade. Only the cells that changed move, so 19 → 20 rolls
 *   both digits and 21 → 22 only the last. A change mid-roll starts the cell over from where
 *   the new character is drawn, never a frame of a stale one.
 * - **Fade** (`Fade`): the percentage's old text fades out over the new one, which fades in,
 *   on `--duration-fast`; the two share a cell, so the width is the new text's.
 * - The outgoing text is `aria-hidden`; the pill's name carries the value (`pillText`).
 * - **Reduced motion** (§7.5): no travel; the cells cross-fade (PagePill.module.css).
 */
import { type AnimationEvent, useState } from 'react';

import styles from './PagePill.module.css';

interface Previous {
  readonly value: string;
  /** +1: the number rose (old goes up), −1: it fell, per change. */
  readonly dir: 1 | -1;
  /** The value the last roll came from (drawn leaving), or null at rest. */
  readonly from: string | null;
  /** Counts changes, so a cell that rolls again restarts its animation. */
  readonly serial: number;
}

/** Which way `next` moved from `prev`: numbers compare by value, anything else rolls up. */
export function rollDirection(prev: string, next: string): 1 | -1 {
  const a = Number.parseInt(prev, 10);
  const b = Number.parseInt(next, 10);
  return Number.isFinite(a) && Number.isFinite(b) && b < a ? -1 : 1;
}

/**
 * The last value and how it changed (state derived from the prop during render), with `from`
 * null again once the leaving text's animation ended (`done`), so nothing stale stays in the
 * pill's text.
 */
function useChange(value: string): Previous & { readonly done: (event: AnimationEvent) => void } {
  const [change, setChange] = useState<Previous>({ value, dir: 1, from: null, serial: 0 });
  const [ended, setEnded] = useState(-1);
  let shown = change;
  if (change.value !== value) {
    shown = {
      value,
      dir: rollDirection(change.value, value),
      from: change.value,
      serial: change.serial + 1,
    };
    setChange(shown);
  }
  const serial = shown.serial;
  return {
    ...shown,
    from: ended === serial ? null : shown.from,
    // The leaving text goes when its fade has ended (its roll may end first, or at once).
    done: (event: AnimationEvent) => {
      if (event.animationName.includes('fade-out')) setEnded(serial);
    },
  };
}

/** The odometer: `value` one cell per character, changed cells rolling. */
export function Roll({ value }: { readonly value: string }) {
  const change = useChange(value);
  const from = change.from ?? value;
  const width = Math.max(value.length, from.length);
  // Right-aligned: the units cell is the last of both.
  const pad = (text: string) => text.padStart(width, ' ');
  const now = pad(value);
  const was = pad(from);
  return (
    <span className={styles.roll} data-dir={change.dir === 1 ? 'up' : 'down'}>
      {Array.from({ length: width }, (_, i) => now.charAt(i)).map((char, i) => {
        const old = was[i] ?? ' ';
        const rolled = change.from !== null && old !== char;
        if (!rolled && char === ' ') return null;
        return (
          <span key={i} className={styles.cell}>
            {rolled && old !== ' ' ? (
              <span
                key={`out-${change.serial}`}
                className={styles.out}
                data-roll-out=""
                aria-hidden="true"
                onAnimationEnd={change.done}
              >
                {old}
              </span>
            ) : null}
            <span
              key={rolled ? `in-${change.serial}` : 'still'}
              className={rolled ? styles.in : ''}
            >
              {char === ' ' ? '' : char}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** The cross-fade: the old text fading out over the new one. */
export function Fade({ value }: { readonly value: string }) {
  const change = useChange(value);
  return (
    <span className={styles.fade}>
      {change.from !== null ? (
        <span
          key={`out-${change.serial}`}
          className={styles.fadeOut}
          data-roll-out=""
          aria-hidden="true"
          onAnimationEnd={change.done}
        >
          {change.from}
        </span>
      ) : null}
      <span key={`in-${change.serial}`} className={change.from !== null ? styles.fadeIn : ''}>
        {value}
      </span>
    </span>
  );
}
