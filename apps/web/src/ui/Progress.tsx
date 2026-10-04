/**
 * Progress bar (components/09-primitives.md §24): determinate progress inside sheets and
 * dialogs (export, OCR, batch results). Toasts and the progress capsule are the feedback
 * family's (08); the activity glyph for busy controls is `ui/Activity`.
 *
 * - A 4 px pill as wide as its container, the label above it with the value at the end in
 *   tabular numerals ("Exporting… 40%" / "Dışa aktarılıyor… %40": the locale places the sign).
 * - Track `--control-track`, fill `--control-on` (n12), never the accent: progress is not the
 *   primary action. The fill grows by `scaleX` in 200 ms on the standard ease (*progress*), so
 *   nothing reflows while it moves.
 * - `value={null}` is indeterminate: a 30 % segment sweeps the track; under reduced motion it
 *   holds still and pulses its opacity over 1.6 s (A-9's progress exemption).
 * - The shown value changes at most every 200 ms (09 §24.6), so a fast job does not make the
 *   bar and its number flicker; the last value always lands.
 * - Base UI `Progress`: `role="progressbar"` with `aria-valuetext` "40 percent" / "yüzde 40"
 *   and the label as its name.
 */
import { Progress as BaseProgress } from '@base-ui/react/progress';
import { useEffect, useRef, useState } from 'react';

import { formatPercent, m } from '../i18n';
import styles from './Progress.module.css';

export interface ProgressProps {
  /** 0–100, or `null` while the amount of work is unknown. */
  readonly value: number | null;
  /** What is happening, as a verb with an ellipsis ("Exporting…"); also the bar's name. */
  readonly label: string;
  /** Hide the visible percentage (it stays in the accessible value). */
  readonly hideValue?: boolean;
  readonly className?: string | undefined;
}

/** 09-primitives §24.6: updates no faster than this. */
export const PROGRESS_THROTTLE_MS = 200;

/** `value`, changing at most once per `interval`; the latest value is never dropped. */
function useThrottled<T>(value: T, interval: number): T {
  const [shown, setShown] = useState(value);
  const last = useRef(0);
  useEffect(() => {
    const wait = last.current + interval - performance.now();
    if (wait <= 0) {
      last.current = performance.now();
      setShown(value);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      last.current = performance.now();
      setShown(value);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [value, interval]);
  return shown;
}

export function Progress({ value, label, hideValue = false, className }: ProgressProps) {
  const shown = useThrottled(
    value === null ? null : Math.min(100, Math.max(0, value)),
    PROGRESS_THROTTLE_MS,
  );
  const percent = shown === null ? null : Math.round(shown);
  return (
    <BaseProgress.Root
      value={shown}
      aria-label={label}
      getAriaValueText={() =>
        percent === null ? label : m.progress_value_text({ percent: String(percent) })
      }
      className={[styles.root, className].filter(Boolean).join(' ')}
    >
      <span className={styles.header} aria-hidden="true">
        <span className={styles.label}>{label}</span>
        {percent !== null && !hideValue ? (
          <span className={styles.value}>{formatPercent(percent / 100)}</span>
        ) : null}
      </span>
      <BaseProgress.Track className={styles.track}>
        <span
          className={styles.fill}
          style={percent === null ? undefined : { transform: `scaleX(${percent / 100})` }}
        />
      </BaseProgress.Track>
    </BaseProgress.Root>
  );
}
