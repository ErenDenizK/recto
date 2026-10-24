/**
 * The margin map's pure rules (DSN-72): which outline entries it lists, which one is current,
 * and whether the margin has room for it. No DOM here; `MarginMap.tsx` measures and calls.
 */
import type { OutlineNode, PageId } from '@pdf-editor/document-model';

/** Nothing shows below this window width (px): narrow windows keep the page and nothing else. */
export const MIN_WINDOW = 1100;
/** The map never comes closer than this to the page (px). */
export const PAGE_GAP = 64;
/** The map is at least this wide (px); less room and it withdraws. */
export const MIN_WIDTH = 176;
/** ... and at most this wide. */
export const MAX_WIDTH = 288;
/** Distance from the free rectangle's edge (px). */
export const EDGE = 24;
/** Deepest outline level listed (1 = top level). */
export const MAX_LEVEL = 2;
/** The most entries listed. */
export const MAX_ENTRIES = 60;

type PageDestination = Extract<NonNullable<OutlineNode['destination']>, { readonly kind: 'page' }>;

export interface MapEntry {
  readonly key: string;
  readonly title: string;
  readonly level: number;
  /** Index of the page in the document. */
  readonly pageIndex: number;
  /** How far down the page the heading sits, 0 (top) to 1 (bottom). */
  readonly frac: number;
  readonly destination: PageDestination;
}

/**
 * The entries the map lists, in document order: levels up to `MAX_LEVEL` whose destination is
 * a page of this document. `heightOf` gives a page's height in points (for the position; an
 * upright page is assumed, a turned one reads as its top).
 */
export function mapEntries(
  outline: readonly OutlineNode[],
  pageIndexOf: (id: PageId) => number,
  heightOf: (index: number) => number,
): MapEntry[] {
  const out: MapEntry[] = [];
  const visit = (nodes: readonly OutlineNode[], level: number, prefix: string) => {
    nodes.forEach((node, i) => {
      if (out.length >= MAX_ENTRIES) return;
      const key = prefix === '' ? String(i) : `${prefix}.${i}`;
      const d = node.destination;
      if (d?.kind === 'page' && node.title.trim() !== '') {
        const pageIndex = pageIndexOf(d.page);
        if (pageIndex >= 0) {
          const top = d.view?.fit === 'xyz' ? d.view.top : undefined;
          const height = heightOf(pageIndex);
          const frac =
            top !== undefined && height > 0 ? Math.min(1, Math.max(0, 1 - top / height)) : 0;
          out.push({ key, title: node.title.trim(), level, pageIndex, frac, destination: d });
        }
      }
      if (level < MAX_LEVEL) visit(node.children, level + 1, key);
    });
  };
  visit(outline, 1, '');
  return out;
}

/**
 * The current entry: the last one whose place is at or above the reading position (the page's
 * index and how far down that page the reading line is). Before the first entry, none.
 */
export function currentEntry(
  entries: readonly MapEntry[],
  page: number,
  frac: number,
): MapEntry | undefined {
  let current: MapEntry | undefined;
  for (const entry of entries) {
    if (entry.pageIndex < page || (entry.pageIndex === page && entry.frac <= frac + 1e-6)) {
      current = entry;
    }
  }
  return current;
}

export interface MarginPlacement {
  readonly side: 'left' | 'right';
  /** Left edge and width of the map, px from the window's left. */
  readonly left: number;
  readonly width: number;
}

export interface MarginInput {
  readonly windowWidth: number;
  /** The free rectangle's left and right edges (px from the window's left). */
  readonly freeLeft: number;
  readonly freeRight: number;
  /** The rendered pages' union: left and right edges. Null when no page is drawn. */
  readonly pages: { readonly left: number; readonly right: number } | null;
  readonly entries: number;
}

/**
 * Where the map goes, or null when it withdraws: a narrow window, no outline entries, no page,
 * or too little margin left once the 64 px gap is kept (zoom in, or a panel, and the page
 * grows into the margin; zoom itself is never limited, DSN-60).
 */
export function placeMargin(input: MarginInput): MarginPlacement | null {
  if (input.windowWidth < MIN_WINDOW || input.entries === 0 || input.pages === null) return null;
  const leftRoom = input.pages.left - PAGE_GAP - (input.freeLeft + EDGE);
  const rightRoom = input.freeRight - EDGE - (input.pages.right + PAGE_GAP);
  // The left whenever it has the room (where the sidebar's Contents lives and reading starts);
  // the right only when the left is too narrow (a sidebar open) and the right has room.
  if (leftRoom >= MIN_WIDTH) {
    return { side: 'left', left: input.freeLeft + EDGE, width: Math.min(MAX_WIDTH, leftRoom) };
  }
  if (rightRoom < MIN_WIDTH) return null;
  return {
    side: 'right',
    left: input.pages.right + PAGE_GAP,
    width: Math.min(MAX_WIDTH, rightRoom),
  };
}
