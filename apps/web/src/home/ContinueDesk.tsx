/**
 * The full edition's Continue card (R26 concept 4, DSN-66): the document read last that is open
 * (`ContinueCard`'s source), else the newest Recents row with a kept snapshot, whose place is
 * read from the snapshot (`keptSummary`) and whose page is drawn from its kept bytes
 * (`recentThumb`, one at a time); a tap reopens it where it was left (`openRecent`). Neither:
 * no card. Loaded only behind `?home=continue`.
 */
import { useEffect, useRef, useState } from 'react';

import { useRecentsStore } from '../files/recents';
import type { ResumePoint } from '../session/resume';
import { type ReviewItem, useReviewData } from '../shell/review/review-items';
import { useOpenSource } from './ContinueCard';
import styles from './ContinueCard.module.css';
import { THUMB, type ContinueSource, ContinueView } from './ContinueView';
import { openRecent, resumeDocument } from './home-actions';
import { keptSummary, recentThumb } from './recent-thumbs';

/** The open document's waiting signature fields and comments, from the review list. */
function withReview(source: ContinueSource, items: readonly ReviewItem[]): ContinueSource {
  const mine = items.filter((item) => item.documentId === source.id);
  return {
    ...source,
    pending: {
      ...source.pending,
      signatures: mine.filter(
        (i) => i.kind === 'field' && i.stop.field.kind === 'signature' && !i.stop.field.signature,
      ).length,
      comments: mine.filter((i) => i.kind === 'comment').length,
    },
  };
}

export default function ContinueDesk() {
  const base = useOpenSource('desk', (id, point) => void resumeDocument(id, point));
  const review = useReviewData();
  const open = base === undefined ? undefined : withReview(base, review.items);
  const kept = useKept(open === undefined);
  const source: ContinueSource | undefined =
    open ??
    (kept === undefined
      ? undefined
      : {
          title: kept.title,
          point: kept.point,
          pending: { unsaved: kept.changed, signatures: 0, comments: 0 },
          thumb: <KeptThumb snapshotId={kept.snapshotId} page={kept.point.page} box={THUMB.desk} />,
          resume: () => void openRecent(kept.entry),
        });
  return source === undefined ? null : <ContinueView variant="desk" source={source} />;
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
