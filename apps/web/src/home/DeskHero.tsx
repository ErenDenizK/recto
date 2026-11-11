/**
 * The desk's hero slot (DSN-93, `home-recents.html`): the same size whether it holds Continue or
 * the sample, so the desk does not re-flow when the first document arrives.
 *
 * - **Continue** (`ContinueHero`): where you left off. The page is a real cover, 216 wide (190
 *   under 1280 px) at its true aspect; the serif title beside it, one meta line ("Page 2 of 4 ·
 *   2 h ago"), a 240 × 2 reading track in lime and the view's one primary, Continue.
 * - **Sample** (returning, nothing to continue): the Margin cover at the same size
 *   (`SampleCover`, so no engine starts), its serif name and "Try the sample" as a lime link.
 *   There is no filled primary. The whole hero is one press target (the link's ::after covers
 *   it). Offline before the sample was ever loaded it is dimmed with the reason (DSN-50), still
 *   focusable.
 * - **Holding** (Recents not read yet): a `--fill-ghost` rectangle at the cover's size, no
 *   text, no shimmer.
 *
 * Work waiting in the document (changes not saved, signature fields to sign, open comments) is
 * not drawn: it is part of Continue's accessible name.
 */
import { useId, useLayoutEffect, useRef } from 'react';

import { m } from '../i18n';
import { animateStyle } from '../motion/animate';
import { progressOf } from '../session/resume';
import { openSample } from '../sample/open-sample';
import { SampleCover } from '../sample/SampleCover';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { hasPending, type ContinueSource } from './ContinueView';
import type { HeroKind } from './desk-model';
import styles from './DeskHero.module.css';
import { ProgressBar } from './ProgressBar';
import { SAMPLE_NAME } from './sample-name';
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
  if (kind === 'continue' && source !== undefined)
    return <ContinueHero source={source} rise={rise} />;
  if (kind === 'sample') return <SampleHero />;
  if (kind === 'holding') {
    return <div className={styles.holding} data-testid="desk-hero-holding" aria-hidden="true" />;
  }
  return null;
}

/** What waits in the document, as words for Continue's accessible name. */
function pendingWords(source: ContinueSource): string[] {
  const { pending } = source;
  const words: string[] = [];
  if (pending.unsaved) words.push(m.continue_pending_unsaved());
  if (pending.signatures > 0) {
    words.push(m.continue_pending_signature({ count: pending.signatures }));
  }
  if (pending.comments > 0) words.push(m.continue_pending_comments({ count: pending.comments }));
  return words;
}

function ContinueHero({
  source,
  rise,
}: {
  readonly source: ContinueSource;
  readonly rise: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const headingId = useId();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !rise) return;
    animateStyle(el, 'transform', [0, 14, 0.97], [0, 0, 1], { spring: 'smooth' });
    animateStyle(el, 'opacity', 0, 1, { spring: 'quick' });
    // Once, on arrival: a later change of `rise` never replays it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { title, point } = source;
  const page = point.page + 1;
  const total = point.total;
  const named = m.continue_resume_named({ name: title, page, total });
  const label = hasPending(source.pending) ? [named, ...pendingWords(source)].join(', ') : named;
  return (
    <section
      ref={ref}
      className={styles.hero}
      data-variant="masa"
      data-testid="continue-card"
      aria-labelledby={headingId}
    >
      <div className={styles.cover} aria-hidden="true">
        {source.thumb}
      </div>
      <div className={styles.text}>
        <h2 id={headingId} className="visually-hidden">
          {m.continue_title()}
        </h2>
        <p className={styles.title} data-testid="continue-name">
          {title}
        </p>
        <p className={styles.meta} data-testid="continue-page">
          {source.when === undefined
            ? m.continue_page({ page, total })
            : m.desk_tile_meta_read({ page, total, time: source.when })}
        </p>
        <ProgressBar
          value={progressOf(point)}
          label={m.continue_progress()}
          className={styles.progress}
        />
        <Button
          variant="prominent"
          size="lg"
          className={styles.go}
          aria-label={label}
          data-testid="continue-resume"
          onClick={source.resume}
        >
          {m.continue_resume()}
        </Button>
      </div>
    </section>
  );
}

function SampleHero() {
  const available = useSampleAvailable();
  const lineId = useId();
  return (
    <section
      className={`${styles.hero} ${styles.sample}`}
      data-testid="desk-sample"
      data-unavailable={available ? undefined : true}
      aria-labelledby={`${lineId}-title`}
    >
      <span className={styles.cover} data-sample-cover="">
        <span className={styles.drawing} data-library-sheet="" aria-hidden="true">
          <SampleCover className={styles.drawingSvg} />
        </span>
      </span>
      <div className={styles.text}>
        <h2 id={`${lineId}-title`} className={styles.title}>
          {SAMPLE_NAME}
        </h2>
        {available ? null : (
          <p id={lineId} className={styles.meta}>
            {m.sample_offline()}
          </p>
        )}
        <button
          type="button"
          // hand-styled link; the whole hero is its press target
          // eslint-disable-next-line recto/q9-controls
          className={styles.try}
          aria-disabled={available ? undefined : true}
          aria-describedby={available ? undefined : lineId}
          data-testid="home-try-sample"
          onClick={() => {
            if (available) void openSample();
          }}
        >
          {m.home_try_sample()}
          <Icon name="arrow-up-right" size={16} />
        </button>
      </div>
    </section>
  );
}
