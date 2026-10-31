/**
 * The Continue card, "Where you left off" (R26 concept 4; Epic 3, 3b and 3c; DSN-66): one lit
 * card at the top of the Library and of the phone's Library with the last document read: the page
 * you left as its thumbnail, the name, "Page 4 of 8", a slim progress bar, the work still waiting
 * (changes not saved, signature fields to sign, open comments) and one primary "Continue", which
 * opens the file at the same page, zoom and scroll offset (`session/resume.ts`). Behind
 * `?home=continue`. This file only draws; `ContinueCard` (the open document, both editions) and
 * `ContinueDesk` (the full edition, which also reads a closed document kept for Recents) say
 * what it shows, so the phone's chunk carries neither Recents nor the Library's actions (EDN-10).
 *
 * - **Motion.** The card rises 14 px at 97 % and fades in on the motion core's `smooth` and
 *   `quick` springs (`animateStyle`); under reduced motion the core keeps the fade alone (§7.5).
 *   The bar fills on `smooth` (`ProgressBar`).
 * - **Phone.** The same card with a smaller page and the button across its width
 *   (`variant="phone"`).
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { useLayoutEffect, useRef } from 'react';

import { m } from '../i18n';
import { animateStyle } from '../motion/animate';
import { progressOf, type ResumePoint } from '../session/resume';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import styles from './ContinueCard.module.css';
import lit from './lit.module.css';
import { ProgressBar } from './ProgressBar';
import { setContinueShown } from './continue-shown';

/** The page's box, CSS px: the page you left, large enough to recognise. */
export const THUMB = {
  desk: { width: 88, height: 116 },
  /** The Masa desk's card (DSN-87): the page left, larger, 132 × 172. */
  masa: { width: 132, height: 172 },
  phone: { width: 68, height: 90 },
} as const;

export type ContinueVariant = keyof typeof THUMB;

/** What waits in the document, for the lines under the bar. */
export interface Pending {
  readonly unsaved: boolean;
  readonly signatures: number;
  readonly comments: number;
}

/** Whether anything waits. */
export const hasPending = (p: Pending): boolean => p.unsaved || p.signatures > 0 || p.comments > 0;

/** What the card shows. */
export interface ContinueSource {
  /** The open document, when it is one (the full edition counts what waits in it). */
  readonly id?: DocumentId;
  readonly title: string;
  readonly point: ResumePoint;
  readonly pending: Pending;
  readonly thumb: React.ReactNode;
  /** When it was read ("yesterday"), after the page line; the desk's card (DSN-87). */
  readonly when?: string | undefined;
  readonly resume: () => void;
}

export function ContinueView({
  variant,
  source,
  rise = true,
}: {
  readonly variant: ContinueVariant;
  readonly source: ContinueSource;
  /**
   * Whether the card rises in. The desk's first paint has no entrance (DSN-87, `masa.md` §4
   * rule 4): it passes false until the desk has painted, so only a card that arrives later rises.
   */
  readonly rise?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  // Continue holds the view's one lime while it shows (DSN-66).
  useLayoutEffect(() => {
    setContinueShown(true);
    return () => setContinueShown(false);
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !rise) return;
    animateStyle(el, 'transform', [0, 14, 0.97], [0, 0, 1], { spring: 'smooth' });
    animateStyle(el, 'opacity', 0, 1, { spring: 'quick' });
    // Once, on arrival: a later change of `rise` never replays it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { title, point, pending } = source;
  const page = point.page + 1;
  const total = point.total;
  return (
    <section
      ref={ref}
      className={`${lit.lit} ${styles.card}`}
      data-lit=""
      data-variant={variant}
      data-testid="continue-card"
      aria-labelledby="continue-heading"
    >
      <div className={styles.thumb} aria-hidden="true">
        {source.thumb}
      </div>
      <div className={styles.text}>
        <h2 id="continue-heading" className={styles.eyebrow}>
          {m.continue_title()}
        </h2>
        <p className={styles.name} data-testid="continue-name">
          {title}
        </p>
        <p className={styles.page} data-testid="continue-page">
          {m.continue_page({ page, total })}
          {source.when === undefined ? '' : ` · ${source.when}`}
        </p>
        <ProgressBar value={progressOf(point)} label={m.continue_progress()} />
        {hasPending(pending) ? <PendingLines pending={pending} /> : null}
      </div>
      <Button
        variant="prominent"
        size={variant === 'phone' ? 'lg' : 'md'}
        className={styles.go}
        aria-label={m.continue_resume_named({ name: title, page, total })}
        data-testid="continue-resume"
        onClick={source.resume}
      >
        {m.continue_resume()}
      </Button>
    </section>
  );
}

function PendingLines({ pending }: { readonly pending: Pending }) {
  return (
    <ul className={styles.pending} data-testid="continue-pending">
      {pending.unsaved ? (
        <li>
          <span className={styles.dot} aria-hidden="true" />
          {m.continue_pending_unsaved()}
        </li>
      ) : null}
      {pending.signatures > 0 ? (
        <li>
          <Icon name="signature" className={styles.glyph} />
          {m.continue_pending_signature({ count: pending.signatures })}
        </li>
      ) : null}
      {pending.comments > 0 ? (
        <li>
          <Icon name="chat-centered-text" className={styles.glyph} />
          {m.continue_pending_comments({ count: pending.comments })}
        </li>
      ) : null}
    </ul>
  );
}
