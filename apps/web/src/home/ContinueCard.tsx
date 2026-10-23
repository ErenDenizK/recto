/**
 * Continue, "Where you left off" (R26 concept 4; Epic 3, 3b and 3c; DSN-66): one lit card at the
 * top of the Library and of the phone's Library with the last document read: the page you left
 * as its thumbnail, the name, "Page 4 of 8", a slim progress bar, the work still waiting (changes
 * not saved, signature fields to sign, open comments) and one primary "Continue", which opens the
 * file at the same page, zoom and scroll offset (`session/resume.ts`). Behind `?home=continue`.
 *
 * - **Which document.** The document read last that is still open (`useResumeStore`); with none
 *   open, the newest Recents row with a kept snapshot, whose place is read from the snapshot
 *   (`keptSummary`) and whose page is drawn from its kept bytes (`recentThumb`, one at a time).
 *   Neither: no card.
 * - **Motion.** The card rises 14 px at 97 % and fades in on the motion core's `smooth` and
 *   `quick` springs (`animateStyle`); under reduced motion the core keeps the fade alone (§7.5).
 *   The bar fills on `smooth` (`ProgressBar`).
 * - **Phone.** The same card at 72 × 96 with the button across its width (`variant="phone"`);
 *   `onResume` is the compact reader's way back (`compact-actions.ts`).
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useRecentsStore } from '../files/recents';
import { m } from '../i18n';
import { animateStyle } from '../motion/animate';
import { type ResumePoint, progressOf, useResumeStore } from '../session/resume';
import { isDocumentChanged } from '../session/session';
import { useReviewData } from '../shell/review/review-items';
import { useWorkspaceStore } from '../state/workspace-store';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import styles from './ContinueCard.module.css';
import { openRecent, resumeDocument } from './home-actions';
import { LibraryThumb } from './LibraryCard';
import lit from './lit.module.css';
import { ProgressBar } from './ProgressBar';
import { recentThumb, keptSummary } from './recent-thumbs';

/** The thumbnail's box, CSS px: the page you left, large enough to recognise. */
const THUMB = { desk: { width: 88, height: 116 }, phone: { width: 68, height: 90 } } as const;

type Variant = keyof typeof THUMB;

/** What waits in the document, for the lines under the bar. */
export interface Pending {
  readonly unsaved: boolean;
  readonly signatures: number;
  readonly comments: number;
}

/** Whether anything waits. */
export const hasPending = (p: Pending): boolean => p.unsaved || p.signatures > 0 || p.comments > 0;

interface Source {
  readonly title: string;
  readonly point: ResumePoint;
  readonly pending: Pending;
  readonly thumb: React.ReactNode;
  readonly resume: () => void;
}

export default function ContinueCard({
  variant = 'desk',
  onResume,
}: {
  readonly variant?: Variant;
  /** The edition's way to open an open document at its place (the phone's reader). */
  readonly onResume?: (id: DocumentId, point: ResumePoint) => void;
}) {
  const source = useSource(variant, onResume);
  const ref = useRef<HTMLElement>(null);
  const shown = source !== undefined;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    animateStyle(el, 'transform', [0, 14, 0.97], [0, 0, 1], { spring: 'smooth' });
    animateStyle(el, 'opacity', 0, 1, { spring: 'quick' });
  }, [shown]);
  if (source === undefined) return null;
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

/** The last document read that is open, else the newest kept Recents row; undefined: none. */
function useSource(
  variant: Variant,
  onResume: ((id: DocumentId, point: ResumePoint) => void) | undefined,
): Source | undefined {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const points = useResumeStore((s) => s.points);
  const last = useResumeStore((s) => s.last);
  const review = useReviewData();
  const id =
    last !== null && workspace.documents[last] !== undefined
      ? last
      : (workspace.activeDocument ?? undefined);
  const doc = id === undefined ? undefined : workspace.documents[id];
  const point = id === undefined ? undefined : points[id];
  const open = doc !== undefined && point !== undefined;
  const kept = useKept(!open);
  if (open) {
    const mine = review.items.filter((item) => item.documentId === doc.id);
    const page = doc.pages[Math.min(point.page, doc.pages.length - 1)];
    return {
      title: doc.title,
      point,
      pending: {
        unsaved: isDocumentChanged(doc.id),
        signatures: mine.filter(
          (i) => i.kind === 'field' && i.stop.field.kind === 'signature' && !i.stop.field.signature,
        ).length,
        comments: mine.filter((i) => i.kind === 'comment').length,
      },
      thumb: page ? <LibraryThumb workspace={workspace} page={page} box={THUMB[variant]} /> : null,
      resume: () => (onResume ?? resumeDocument)(doc.id, point),
    };
  }
  if (kept === undefined) return undefined;
  return {
    title: kept.title,
    point: kept.point,
    pending: { unsaved: kept.changed, signatures: 0, comments: 0 },
    thumb: <KeptThumb snapshotId={kept.snapshotId} page={kept.point.page} box={THUMB[variant]} />,
    resume: () => void openRecent(kept.entry),
  };
}

/** The newest Recents row with a kept snapshot, read once `wanted`. */
function useKept(wanted: boolean) {
  const entries = useRecentsStore((s) => s.entries);
  const entry = wanted ? entries.find((e) => e.kept !== undefined) : undefined;
  const snapshotId = entry?.kept?.snapshotId;
  const [found, setFound] = useState<{
    snapshotId: string;
    title: string;
    point: ResumePoint;
    changed: boolean;
  }>();
  useEffect(() => {
    if (snapshotId === undefined) return undefined;
    let cancelled = false;
    void keptSummary(snapshotId).then((summary) => {
      if (cancelled || summary === null) return;
      const { place } = summary;
      setFound({
        snapshotId,
        title: summary.title,
        changed: place.changed,
        point: {
          page: Math.min(place.page, Math.max(0, summary.pages - 1)),
          total: summary.pages,
          zoom: place.resume?.zoom ?? 1,
          fit: place.resume?.fit ?? 'width',
          offset: place.resume?.offset ?? 0,
          at: Date.now(),
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [snapshotId]);
  if (entry === undefined || found === undefined || found.snapshotId !== snapshotId)
    return undefined;
  return { ...found, entry };
}

/** A kept page drawn from its snapshot, once rendered. */
function KeptThumb({
  snapshotId,
  page,
  box,
}: {
  readonly snapshotId: string;
  readonly page: number;
  readonly box: { readonly width: number; readonly height: number };
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    void recentThumb(snapshotId, page, box).then((thumb) => {
      const host = hostRef.current;
      if (cancelled || !thumb || !host) return;
      const canvas = document.createElement('canvas');
      canvas.width = thumb.canvas.width;
      canvas.height = thumb.canvas.height;
      canvas.getContext('2d')?.drawImage(thumb.canvas, 0, 0);
      canvas.style.width = `${thumb.width}px`;
      canvas.style.height = `${thumb.height}px`;
      host.replaceChildren(canvas);
    });
    return () => {
      cancelled = true;
    };
  }, [snapshotId, page, box]);
  return (
    <div ref={hostRef} className={styles.kept} style={{ width: box.width, height: box.height }} />
  );
}
