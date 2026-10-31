/**
 * What the desk's Continue card stands for (DSN-87, `masa.md` §3.3). In order: the open
 * document read last (`ContinueCard.useOpenSource`, its page drawn live), else the newest
 * Recents entry with a place past page 1, whose page is the stored `left` cover (no PDFium, no
 * OPFS read) and whose press runs `openRecent`, then the exact resume from the entry's place.
 * Pending lines for a closed document: "Changes kept" when its snapshot holds changes; signature
 * fields and comments only for an open document.
 */
import { useMemo } from 'react';

import { type RecentEntry, useRecentsStore } from '../files/recents';
import { useLocale } from '../i18n';
import { type ResumePoint, useResumeStore } from '../session/resume';
import { type ReviewItem, useReviewData } from '../shell/review/review-items';
import { useWorkspaceStore } from '../state/workspace-store';
import { useOpenSource } from './ContinueCard';
import type { ContinueSource } from './ContinueView';
import type { Cover } from './covers';
import { continueEntry, pickCover } from './desk-model';
import { DeskCover } from './DeskCover';
import { openRecent, resumeDocument } from './home-actions';
import { relativeTime } from './home-model';
import { useNow } from './RecentList';

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

/** The place an entry was left at, as a resume point. */
export function pointOfEntry(entry: RecentEntry): ResumePoint | undefined {
  const { place } = entry;
  if (place === undefined) return undefined;
  return {
    page: place.page,
    total: place.total,
    zoom: place.zoom ?? 1,
    fit: place.fit ?? 'width',
    offset: place.offset ?? 0,
    at: place.at,
  };
}

/**
 * Opens a Recents entry at the place it was left. A kept snapshot already reopens at its zoom
 * and offset (`openRecent`); a plain reopen (handle or file dialog) opens at page 1, so the
 * stored place takes over once the document is there. The press calls `openRecent` first and
 * synchronously, so a permission prompt keeps the click's activation.
 */
export async function openEntryAtPlace(entry: RecentEntry): Promise<void> {
  const before = new Set(useWorkspaceStore.getState().workspace.documentOrder);
  await openRecent(entry);
  const point = pointOfEntry(entry);
  if (point === undefined) return;
  const workspace = useWorkspaceStore.getState().workspace;
  const opened = workspace.documentOrder.find((id) => !before.has(id));
  if (opened === undefined) return;
  if (useResumeStore.getState().points[opened]?.page === point.page) return;
  await resumeDocument(opened, point);
}

export function useDeskContinue(covers: ReadonlyMap<string, Cover>): ContinueSource | undefined {
  const base = useOpenSource('masa', (id, point) => void resumeDocument(id, point));
  const review = useReviewData();
  const entries = useRecentsStore((s) => s.entries);
  const locale = useLocale();
  const now = useNow();
  const open = base === undefined ? undefined : withReview(base, review.items);
  const entry = open === undefined ? continueEntry(entries) : undefined;
  return useMemo<ContinueSource | undefined>(() => {
    if (open !== undefined) return open;
    if (entry === undefined) return undefined;
    const point = pointOfEntry(entry);
    if (point === undefined) return undefined;
    return {
      title: entry.name,
      point,
      pending: { unsaved: entry.kept?.changed === true, signatures: 0, comments: 0 },
      thumb: <DeskCover cover={pickCover(entry, covers)} />,
      when: relativeTime(entry.place?.at ?? entry.openedAt, now, locale),
      resume: () => void openEntryAtPlace(entry),
    };
  }, [open, entry, covers, now, locale]);
}
