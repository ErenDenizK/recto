/**
 * The slim reading-progress bar of a Library card and the Continue card (R26 concept 4, DSN-66):
 * a 3 px track and a fill that grows to the page reached on the `smooth` spring (the CSS curve of
 * the motion core, `styles/motion.css`), from empty on arrival. Under reduced motion the spring
 * durations are 0 and the bar is simply there. Decorative on a card (its name says the page);
 * `label` makes it a progressbar for the Continue card.
 */
import { useEffect, useState } from 'react';

import styles from './ProgressBar.module.css';

export function ProgressBar({
  value,
  label,
  className,
}: {
  /** 0..1. */
  readonly value: number;
  readonly label?: string;
  readonly className?: string | undefined;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(frame);
  }, [value]);
  const percent = Math.round(value * 100);
  return (
    <span
      className={`${styles.track} ${className ?? ''}`}
      {...(label === undefined
        ? { 'aria-hidden': true }
        : {
            role: 'progressbar',
            'aria-label': label,
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': percent,
          })}
      data-testid="progress-bar"
      data-progress={percent}
    >
      <span className={styles.fill} style={{ transform: `scaleX(${shown})` }} />
    </span>
  );
}
