/**
 * The activity glyph (components/09-primitives.md §24; language.md §7.3 *progress*, MC-33): a
 * rotating `circle-notch` for a busy button, field or count. It appears only after 400 ms, so a
 * job that ends sooner shows nothing at all (no spinner flash), and it is decorative: the host
 * carries `aria-busy` and its own words.
 *
 * - 16 px in rows and fine-pointer buttons, 20 px in bars and on a coarse pointer (`size`), the
 *   two icon sizes of quality-bar Q-9. Drawn as code (Q-12): a quarter arc on a faint full
 *   ring, in the current colour.
 * - One turn in 0.8 s, linear. Under reduced motion it stands still and pulses its opacity over
 *   1.6 s instead (A-9's progress exemption, language.md §7.5).
 */
import { useEffect, useState } from 'react';

import styles from './Activity.module.css';

export interface ActivityProps {
  /** Milliseconds before the glyph shows; 0 shows it at once. */
  readonly delay?: number;
  /** `sm` 16 px, `md` 20 px; `auto` follows the pointer density (16 fine, 20 coarse). */
  readonly size?: 'sm' | 'md' | 'auto';
  readonly className?: string | undefined;
}

/** The delay of 09 §24 and MC-33: nothing spins for a job shorter than this. */
export const ACTIVITY_DELAY_MS = 400;

export function Activity({ delay = ACTIVITY_DELAY_MS, size = 'auto', className }: ActivityProps) {
  const [shown, setShown] = useState(delay <= 0);
  useEffect(() => {
    if (delay <= 0) return undefined;
    const timer = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);
  if (!shown) return null;
  return (
    <svg
      className={[styles.activity, className].filter(Boolean).join(' ')}
      data-size={size}
      data-activity=""
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="10"
        cy="10"
        r="7.25"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="1.5"
      />
      <path
        d="M10 2.75a7.25 7.25 0 0 1 7.25 7.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
