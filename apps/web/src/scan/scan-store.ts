/**
 * The scan sheet's state (plan bm-scan-plan §3): which view shows, the captured pages and the
 * choices on them. Pages keep the source picture as a JPEG `Blob` (never a raw frame, plan §2
 * "Memory on iPhone") and a small processed preview made by `Scanner` for the review; the corners
 * are in source pixels, ordered top left, top right, bottom right, bottom left.
 *
 * Rotating turns the page by moving the corner order a step (the page's top becomes the next
 * edge), so the warp needs no rotation of its own.
 */
import { create } from 'zustand';

import type { Quad, ScanFilter } from './encode';

export type ScanView = 'camera' | 'review' | 'adjust';

export interface ScanPage {
  readonly id: string;
  readonly source: Blob;
  /** Object URL of `source`, for the corner editor; revoked with the page. */
  readonly sourceUrl: string;
  readonly width: number;
  readonly height: number;
  readonly quad: Quad;
  readonly filter: ScanFilter;
  /** Bumped when the quad or filter changes, so the preview knows it is stale. */
  readonly rev: number;
  /** Object URL of the processed preview; '' until made. */
  readonly preview: string;
  readonly previewRev: number;
}

export const FILTERS: readonly ScanFilter[] = ['colour', 'greyscale', 'bw', 'photo'];
const FILTER_KEY = 'recto.scan.filter';

/** The filter chosen last on this device; Colour the first time (plan §6 question 1). */
function storedFilter(): ScanFilter {
  try {
    const value = localStorage.getItem(FILTER_KEY);
    return FILTERS.find((f) => f === value) ?? 'colour';
  } catch {
    return 'colour';
  }
}

/** The page's corners when nothing was found: the frame inset by 6 %. */
export function defaultQuad(width: number, height: number): Quad {
  const x = width * 0.06;
  const y = height * 0.06;
  return [
    { x, y },
    { x: width - x, y },
    { x: width - x, y: height - y },
    { x, y: height - y },
  ];
}

/** Normalised corners (0..1) to source pixels. */
export function toPixels(
  corners: readonly { readonly x: number; readonly y: number }[],
  width: number,
  height: number,
): Quad | null {
  const [a, b, c, d] = corners;
  if (!a || !b || !c || !d) return null;
  return [a, b, c, d].map((p) => ({ x: p.x * width, y: p.y * height })) as unknown as Quad;
}

/** A quarter turn clockwise: the page's left edge becomes its top. */
export function rotateQuad(quad: Quad): Quad {
  const [tl, tr, br, bl] = quad;
  return [bl, tl, tr, br];
}

/** `items` with the one at `from` moved to `to` (clamped to the list). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const target = Math.max(0, Math.min(next.length - 1, to));
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(target, 0, item);
  return next;
}

interface ScanState {
  readonly open: boolean;
  readonly view: ScanView;
  readonly pages: readonly ScanPage[];
  readonly selected: string | null;
  /** The page the next capture replaces. */
  readonly retaking: string | null;
  /** The filter new captures take. */
  readonly filter: ScanFilter;
  readonly auto: boolean;
}

const CLOSED: ScanState = {
  open: false,
  view: 'camera',
  pages: [],
  selected: null,
  retaking: null,
  filter: 'colour',
  auto: true,
};

export const useScanStore = create<ScanState>()(() => CLOSED);

const set = useScanStore.setState;
const get = useScanStore.getState;

const revokePreview = (page: ScanPage) => {
  if (page.preview) URL.revokeObjectURL(page.preview);
};
const revoke = (page: ScanPage) => {
  URL.revokeObjectURL(page.sourceUrl);
  revokePreview(page);
};

let counter = 0;

export function openScanSheet(): void {
  set({ ...CLOSED, open: true, filter: storedFilter() });
}

export function closeScanSheet(): void {
  get().pages.forEach(revoke);
  set({ ...CLOSED, filter: get().filter });
}

export function setAuto(auto: boolean): void {
  set({ auto });
}

export function setView(view: ScanView): void {
  set({ view });
}

export function selectPage(id: string): void {
  set({ selected: id });
}

/** Adds a captured page, or replaces the page being retaken, and selects it. */
export function addPage(input: {
  readonly source: Blob;
  readonly width: number;
  readonly height: number;
  readonly quad: Quad;
}): string {
  const { retaking, pages, filter } = get();
  const id = retaking ?? `scan-${++counter}`;
  const sourceUrl = URL.createObjectURL(input.source);
  const page: ScanPage = { id, ...input, sourceUrl, filter, rev: 1, preview: '', previewRev: 0 };
  const index = pages.findIndex((p) => p.id === retaking);
  const next = index < 0 ? [...pages, page] : pages.map((p, i) => (i === index ? page : p));
  if (index >= 0) revoke(pages[index] as ScanPage);
  set({ pages: next, selected: id, retaking: null });
  return id;
}

function update(id: string, change: (page: ScanPage) => Partial<ScanPage>): void {
  set({
    pages: get().pages.map((p) => (p.id === id ? { ...p, ...change(p), rev: p.rev + 1 } : p)),
  });
}

export const setQuad = (id: string, quad: Quad) => update(id, () => ({ quad }));
export const rotatePage = (id: string) => update(id, (p) => ({ quad: rotateQuad(p.quad) }));

/** Sets the page's filter, and the filter new captures take (kept on this device). */
export function setFilter(id: string, filter: ScanFilter): void {
  update(id, () => ({ filter }));
  set({ filter });
  try {
    localStorage.setItem(FILTER_KEY, filter);
  } catch {
    // Storage may be blocked; the choice then lasts for this visit.
  }
}

export function setPreview(id: string, rev: number, preview: string): void {
  const page = get().pages.find((p) => p.id === id);
  if (page?.rev !== rev) {
    URL.revokeObjectURL(preview);
    return;
  }
  revokePreview(page);
  set({ pages: get().pages.map((p) => (p.id === id ? { ...p, preview, previewRev: rev } : p)) });
}

export function removePage(id: string): void {
  const { pages, selected } = get();
  const index = pages.findIndex((p) => p.id === id);
  if (index < 0) return;
  revoke(pages[index] as ScanPage);
  const next = pages.filter((p) => p.id !== id);
  set({
    pages: next,
    selected: selected === id ? (next[Math.min(index, next.length - 1)]?.id ?? null) : selected,
    view: next.length === 0 ? 'camera' : get().view,
  });
}

export function movePage(id: string, delta: -1 | 1): void {
  const { pages } = get();
  const from = pages.findIndex((p) => p.id === id);
  if (from < 0) return;
  set({ pages: moveItem(pages, from, from + delta) });
}

/** Back to the camera; the next capture replaces `id`. */
export function retakePage(id: string): void {
  set({ retaking: id, view: 'camera' });
}
