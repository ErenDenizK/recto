/**
 * The desk's hero slot (DSN-87, `masa.md` §2.2, §2.6): the same size whether it holds the
 * Continue card or the sample, so the desk does not re-flow when the first document arrives.
 *
 * - **Continue** (`ContinueView`, `variant="masa"`): where you left off.
 * - **Sample** (first visit, or nothing to continue): a large static cover (`SampleCover`, so no
 *   engine starts), the name, one line and "Open the sample" as a standard button; the primary
 *   stays on Open files…. The whole card is one press target (the button's ::after covers it).
 *   Offline before the sample was ever loaded it is dimmed with the reason (DSN-50), still
 *   focusable.
 * - **Holding** (Recents not read yet): an empty lit card at the slot's size, no text, no
 *   shimmer.
 */
import { useId } from 'react';

import { m } from '../i18n';
import { openSample } from '../sample/open-sample';
import { SampleCover } from '../sample/SampleCover';
import { Button } from '../ui/Button';
import { ContinueView, type ContinueSource } from './ContinueView';
import type { HeroKind } from './desk-model';
import styles from './DeskHero.module.css';
import lit from './lit.module.css';
import { useSampleAvailable } from './use-sample-available';

export function DeskHero({
  kind,
  source,
  rise,
}: {
  readonly kind: HeroKind;
  readonly source: ContinueSource | undefined;
  readonly rise: boolean;
}) {
  if (kind === 'continue' && source !== undefined) {
    return <ContinueView variant="masa" source={source} rise={rise} />;
  }
  if (kind === 'sample') return <SampleHero />;
  if (kind === 'holding') {
    return (
      <div
        className={`${lit.lit} ${styles.hero} ${styles.holding}`}
        data-lit=""
        data-testid="desk-hero-holding"
        aria-hidden="true"
      />
    );
  }
  return null;
}

function SampleHero() {
  const available = useSampleAvailable();
  const lineId = useId();
  return (
    <section
      className={`${lit.lit} ${styles.hero} ${styles.sample}`}
      data-lit=""
      data-testid="desk-sample"
      data-unavailable={available ? undefined : true}
      aria-labelledby={`${lineId}-title`}
    >
      <span className={styles.cover} data-library-sheet="">
        <SampleCover className={styles.drawing} />
      </span>
      <div className={styles.text}>
        <h2 id={`${lineId}-title`} className={styles.title}>
          {m.cmd_try_sample()}
        </h2>
        <p id={lineId} className={styles.line}>
          {available ? m.library_sample_line() : m.sample_offline()}
        </p>
        <Button
          variant="standard"
          className={styles.open}
          aria-disabled={available ? undefined : true}
          aria-describedby={lineId}
          data-testid="desk-sample-open"
          onClick={() => {
            if (available) void openSample();
          }}
        >
          {m.desk_sample_open()}
        </Button>
      </div>
    </section>
  );
}
