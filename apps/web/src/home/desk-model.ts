/**
 * The desk's pure rules (DSN-87, `masa.md` §2.2, §2.4, §2.6, §3.3): which hero the slot holds,
 * which entry Continue stands for, which cover a tile shows, what a tile says and how it reads
 * aloud. No DOM and no stores, so the rules are unit-tested without a browser.
 */
import type { Cover, CoverKind } from './covers';
import { coverKey } from './covers';
import type { RecentEntry } from '../files/recents';

/** The hero slot waits this long for Recents before it shows the first-visit sample (§2.6). */
export const LOADING_FALLBACK_MS = 300;

export type HeroKind =
  /** Recents are being read: the slot holds its size with an empty lit card. */
  | 'holding'
  /** The Continue card. */
  | 'continue'
  /** The sample as a large card (first visit, or nothing to continue). */
  | 'sample'
  /** Nothing to put there: the slot collapses and the intents take the row. */
  | 'none';

export interface HeroInput {
  /** Recents have been read. */
  readonly loaded: boolean;
  /** The 300 ms wait for them is over. */
  readonly waited: boolean;
  /** Continue has a document to stand for. */
  readonly hasContinue: boolean;
  /** The sample is not open and not in Recents (`sampleOnScreen`). */
  readonly sampleFree: boolean;
}

/** What the hero slot holds (§2.2, §2.6). */
export function heroKind(input: HeroInput): HeroKind {
  if (input.hasContinue) return 'continue';
  if (!input.loaded && !input.waited) return 'holding';
  return input.sampleFree ? 'sample' : 'none';
}

/** The first visit: Recents read and empty, nothing open, nothing to continue. */
export function isFirstVisit(input: {
  readonly loaded: boolean;
  readonly recents: number;
  readonly open: number;
  readonly hasContinue: boolean;
}): boolean {
  return input.loaded && input.recents === 0 && input.open === 0 && !input.hasContinue;
}

/**
 * The entry Continue stands for when no open document does (§3.3): the newest with a place past
 * page 1. `entries` are newest first, as the store keeps them.
 */
export function continueEntry(entries: readonly RecentEntry[]): RecentEntry | undefined {
  return entries.find((e) => e.place !== undefined && e.place.page > 0 && e.place.total > 0);
}

/** The cover a tile or Continue draws: the page left once past page 1, else the first page. */
export function pickCover(
  entry: Pick<RecentEntry, 'name' | 'size' | 'place'>,
  covers: ReadonlyMap<string, Cover>,
): Cover | undefined {
  const kinds: readonly CoverKind[] =
    entry.place !== undefined && entry.place.page > 0 ? ['left', 'first'] : ['first'];
  for (const kind of kinds) {
    const cover = covers.get(coverKey(kind, entry));
    if (cover !== undefined) return cover;
  }
  return undefined;
}

/** Fraction read, 0..1, of an entry with a place; 0 when it has none. */
export function entryProgress(entry: Pick<RecentEntry, 'place'>): number {
  const place = entry.place;
  if (place === undefined || place.total <= 0) return 0;
  return Math.min(1, (place.page + 1) / place.total);
}

/** Whether the entry was read past its first page (it shows "Page 4 of 10", not "8 pages"). */
export const isRead = (entry: Pick<RecentEntry, 'place'>): boolean =>
  entry.place !== undefined && entry.place.page > 0 && entry.place.total > 0;

/** The columns a grid shows now: the children that share the first one's top edge. */
export function columnsOf(children: readonly { readonly offsetTop: number }[]): number {
  const first = children[0];
  if (first === undefined) return 1;
  return Math.max(1, children.filter((c) => c.offsetTop === first.offsetTop).length);
}
