/**
 * Find in document (spec §1): runs `PdfRenderer.search` in the engine worker for every
 * source the active document shows, maps source hits onto the document's pages (a source
 * page may appear several times, or not at all), streams them into the store as they
 * arrive, and keeps a current hit for Enter / F3 navigation. A new query cancels the
 * running search.
 */
import type {
  DocumentId,
  PageId,
  Rect,
  SourceId,
  VirtualDocument,
} from '@pdf-editor/document-model';
import type { SearchHit } from '@pdf-editor/engine';
import { create } from 'zustand';

import { handKeysTo } from '../commands/key-handoff';
import { getEngineService } from '../engine/engine-service';
import { revealWhenShown } from '../motion/catalogue';
import { reducedMotion } from '../motion/reduced-motion';
import { springEasing } from '../motion/springs';
import { EASE, SPRING_CSS_MS } from '../motion/tokens';
import { showOverlaySidebar } from '../shell/frame/frame-store';
import { frameClassOf } from '../shell/frame/size-class';
import { isPageView, useUiStore } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { afterJump } from './jump-landed';

export interface DocumentHit {
  /** Order of arrival; ties inside a page keep the engine's reading order. */
  readonly seq: number;
  readonly pageIndex: number;
  readonly pageId: PageId;
  readonly sourceId: SourceId;
  readonly rects: readonly Rect[];
  readonly context: string;
  /** Where the match sits in `context`, when the engine reports it. */
  readonly matchStart?: number;
  readonly matchLength?: number;
}

export type SearchStatus = 'idle' | 'searching' | 'done' | 'error';

export interface SearchOptions {
  readonly matchCase: boolean;
  readonly wholeWord: boolean;
}

interface SearchState extends SearchOptions {
  readonly query: string;
  readonly status: SearchStatus;
  readonly hits: readonly DocumentHit[];
  /** Index into `hits`, or -1. */
  readonly current: number;
  /**
   * The user moved to `current` (Enter, F3, a click). Until then the current hit follows the
   * reader's page as results stream in; afterwards it stays on the chosen match.
   */
  readonly currentChosen: boolean;
  readonly documentId: DocumentId | null;
  /** Milliseconds from start to the first hit and to completion (diagnostics, tests). */
  readonly timing: { readonly first?: number; readonly total?: number };
  /** Bumped to ask the search field to take focus (Mod+F). */
  readonly focusSerial: number;
  /** Source pages the running search has finished, and how many it will scan in all. */
  readonly scan: { readonly done: number; readonly total: number };
}

const INITIAL: SearchState = {
  query: '',
  matchCase: false,
  wholeWord: false,
  status: 'idle',
  hits: [],
  current: -1,
  currentChosen: false,
  documentId: null,
  timing: {},
  focusSerial: 0,
  scan: { done: 0, total: 0 },
};

export const useSearchStore = create<SearchState>()(() => INITIAL);

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Document page indices per `${sourceId}:${sourceIndex}`. */
export function sourcePageMap(doc: VirtualDocument): Map<string, number[]> {
  const map = new Map<string, number[]>();
  doc.pages.forEach((page, index) => {
    if (page.ref.kind !== 'source') return;
    const key = `${page.ref.source}:${page.ref.index}`;
    const list = map.get(key);
    if (list) list.push(index);
    else map.set(key, [index]);
  });
  return map;
}

/** Maps a source's hits onto document pages. `seq` continues from `firstSeq`. */
export function mapHits(
  doc: VirtualDocument,
  pages: ReadonlyMap<string, readonly number[]>,
  sourceId: SourceId,
  hits: readonly SearchHit[],
  firstSeq: number,
): DocumentHit[] {
  const out: DocumentHit[] = [];
  let seq = firstSeq;
  for (const hit of hits) {
    for (const pageIndex of pages.get(`${sourceId}:${hit.pageIndex}`) ?? []) {
      const page = doc.pages[pageIndex];
      if (!page) continue;
      const { matchStart, matchLength } = hit as SearchHit & {
        readonly matchStart?: number;
        readonly matchLength?: number;
      };
      out.push({
        seq: seq++,
        pageIndex,
        pageId: page.id,
        sourceId,
        rects: hit.rects,
        context: hit.context,
        ...(typeof matchStart === 'number' && typeof matchLength === 'number'
          ? { matchStart, matchLength }
          : {}),
      });
    }
  }
  return out;
}

/** Navigation order: by document page, then as the engine reported them. */
export function sortHits(hits: readonly DocumentHit[]): DocumentHit[] {
  return [...hits].sort((a, b) => a.pageIndex - b.pageIndex || a.seq - b.seq);
}

/** Next (+1) or previous (-1) hit index, wrapping; the first step from none picks an end. */
export function stepHit(current: number, count: number, direction: 1 | -1): number {
  if (count === 0) return -1;
  if (current < 0 || current >= count) return direction > 0 ? 0 : count - 1;
  return (current + direction + count) % count;
}

/** The first hit at or after `pageIndex` (wrapping), for starting from where the reader is. */
export function firstHitFrom(hits: readonly DocumentHit[], pageIndex: number): number {
  if (hits.length === 0) return -1;
  const index = hits.findIndex((hit) => hit.pageIndex >= pageIndex);
  return index < 0 ? 0 : index;
}

export interface HitGroup {
  readonly pageIndex: number;
  readonly pageId: PageId;
  /** `index` is the position in the flat, sorted hit list. */
  readonly hits: readonly { readonly index: number; readonly hit: DocumentHit }[];
}

/** Groups sorted hits by page, preserving order. */
export function groupHitsByPage(hits: readonly DocumentHit[]): HitGroup[] {
  const groups: {
    pageIndex: number;
    pageId: PageId;
    hits: { index: number; hit: DocumentHit }[];
  }[] = [];
  hits.forEach((hit, index) => {
    const last = groups[groups.length - 1];
    if (last?.pageIndex === hit.pageIndex) last.hits.push({ index, hit });
    else groups.push({ pageIndex: hit.pageIndex, pageId: hit.pageId, hits: [{ index, hit }] });
  });
  return groups;
}

/**
 * Lower-cases without changing the length, so an index in the folded text is an index in the
 * original: `toLocaleLowerCase` turns the Turkish İ into two code units ("i" and a combining
 * dot), which would shift every offset after it. İ folds to plain i, as Find matches it. What
 * does not fold (the "ﬁ" ligature against "fi", the dotless ı against "I") finds no match here and
 * falls back to the whole snippet, unemphasised; the engine's offsets are used when it has them.
 */
export function fold(text: string): string {
  let out = '';
  for (const ch of text) {
    const lower = ch === 'İ' ? 'i' : ch.toLowerCase();
    out += lower.length === ch.length ? lower : ch;
  }
  return out;
}

/**
 * Splits a context snippet around its match, for emphasis: at the engine's offsets when it
 * reports them, else at the first occurrence of the query. Whitespace runs are collapsed;
 * falls back to the whole snippet when nothing is found.
 */
export function splitContext(
  hit: Pick<DocumentHit, 'context' | 'matchStart' | 'matchLength'>,
  query: string,
  matchCase: boolean,
): { before: string; match: string; after: string } {
  const squash = (text: string) => text.replace(/\s+/g, ' ');
  const { context, matchStart, matchLength } = hit;
  if (
    matchStart !== undefined &&
    matchLength !== undefined &&
    matchStart >= 0 &&
    matchStart + matchLength <= context.length
  ) {
    return {
      before: squash(context.slice(0, matchStart)),
      match: squash(context.slice(matchStart, matchStart + matchLength)),
      after: squash(context.slice(matchStart + matchLength)),
    };
  }
  const text = squash(context);
  const needle = query.trim();
  if (needle === '') return { before: text, match: '', after: '' };
  const at = matchCase ? text.indexOf(needle) : fold(text).indexOf(fold(needle));
  if (at < 0) return { before: text, match: '', after: '' };
  return {
    before: text.slice(0, at),
    match: text.slice(at, at + needle.length),
    after: text.slice(at + needle.length),
  };
}

/** Whether two hits are the same match: same page and source, same rectangles. */
export function isSameHit(a: DocumentHit, b: DocumentHit): boolean {
  if (a.pageIndex !== b.pageIndex || a.sourceId !== b.sourceId) return false;
  if (a.rects.length !== b.rects.length) return false;
  return a.rects.every((r, i) => {
    const o = b.rects[i];
    return (
      o !== undefined &&
      Math.abs(r.x - o.x) < 0.01 &&
      Math.abs(r.y - o.y) < 0.01 &&
      Math.abs(r.width - o.width) < 0.01 &&
      Math.abs(r.height - o.height) < 0.01
    );
  });
}

/** Index of `hit` in `hits`: by `seq` when it still names the same match, else by identity. */
export function findSameHit(hits: readonly DocumentHit[], hit: DocumentHit): number {
  const bySeq = hits.findIndex((h) => h.seq === hit.seq);
  const candidate = hits[bySeq];
  if (candidate && isSameHit(candidate, hit)) return bySeq;
  return hits.findIndex((h) => isSameHit(h, hit));
}

/** Union of a hit's rects (to scroll it into view). */
export function hitBounds(hit: DocumentHit): Rect | undefined {
  if (hit.rects.length === 0) return undefined;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of hit.rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.width);
    y1 = Math.max(y1, r.y + r.height);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

let controller: AbortController | undefined;
/** Streaming results are merged into the store at most this often. */
const PUBLISH_INTERVAL_MS = 50;

function sourcesOf(doc: VirtualDocument): SourceId[] {
  const seen = new Set<SourceId>();
  for (const page of doc.pages) if (page.ref.kind === 'source') seen.add(page.ref.source);
  return [...seen];
}

/**
 * Starts a search of `doc` with the store's query and options, cancelling any running one.
 * `startPage` picks the first current hit (the reader's page). Resolves when done or
 * cancelled.
 */
export async function runSearch(doc: VirtualDocument | undefined, startPage = 0): Promise<void> {
  controller?.abort();
  const { query, matchCase, wholeWord } = useSearchStore.getState();
  const needle = query.trim();
  if (!doc || needle === '') {
    controller = undefined;
    useSearchStore.setState({
      status: 'idle',
      hits: [],
      current: -1,
      documentId: doc?.id ?? null,
      timing: {},
      scan: { done: 0, total: 0 },
    });
    return;
  }
  const own = new AbortController();
  controller = own;
  const started = performance.now();
  useSearchStore.setState({
    status: 'searching',
    hits: [],
    current: -1,
    currentChosen: false,
    documentId: doc.id,
    timing: {},
    scan: { done: 0, total: 0 },
  });
  const pages = sourcePageMap(doc);
  // Every source page is scanned once, however often the document shows it.
  let scanned = 0;
  const scanTotal = pages.size;
  let seq = 0;
  let lastPublish = 0;
  let collected: DocumentHit[] = [];
  let failed = false;

  const now = () => performance.now();
  let lastScanPublish = 0;
  const publishScan = () => {
    lastScanPublish = now();
    useSearchStore.setState({ scan: { done: scanned, total: scanTotal } });
  };
  // Every page moves the count: now when the last publish is old enough, else after a pause.
  let scanTimer: number | undefined;
  const touchScan = () => {
    if (scanTimer !== undefined) return;
    const wait = lastScanPublish + PUBLISH_INTERVAL_MS - now();
    if (wait <= 0) {
      publishScan();
      return;
    }
    scanTimer = window.setTimeout(() => {
      scanTimer = undefined;
      if (!own.signal.aborted) publishScan();
    }, wait);
  };
  const publish = (next: DocumentHit[]) => {
    if (own.signal.aborted) return;
    collected = sortHits(next);
    const state = useSearchStore.getState();
    const timing =
      state.timing.first === undefined && collected.length > 0
        ? { first: performance.now() - started }
        : state.timing;
    // Keep the current hit stable while results stream in; pick one once hits exist.
    const previous = state.currentChosen ? state.hits[state.current] : undefined;
    let current = previous ? findSameHit(collected, previous) : -1;
    if (current < 0) current = firstHitFrom(collected, startPage);
    useSearchStore.setState({
      hits: collected,
      current,
      timing,
      scan: { done: scanned, total: scanTotal },
    });
    lastScanPublish = now();
  };

  for (const sourceId of sourcesOf(doc)) {
    if (own.signal.aborted) return;
    const streamed: DocumentHit[] = [];
    const base = collected;
    // Streamed and final hits of this source get the same `seq`s (same engine order).
    const firstSeq = seq;
    const result = await getEngineService().search(
      sourceId,
      needle,
      { matchCase, wholeWord },
      own.signal,
      (hits, page) => {
        // Pages the document no longer shows (deleted, extracted) are scanned but not counted.
        if (pages.has(`${sourceId}:${page}`)) scanned++;
        touchScan();
        const mapped = mapHits(doc, pages, sourceId, hits, seq);
        if (mapped.length === 0) return;
        seq += mapped.length;
        streamed.push(...mapped);
        // The first hits show at once; later ones at most every PUBLISH_INTERVAL_MS, so a
        // long document does not re-sort and re-render once per page.
        if (collected.length === 0 || now() - lastPublish >= PUBLISH_INTERVAL_MS) {
          lastPublish = now();
          publish([...base, ...streamed]);
        }
      },
    );
    if (own.signal.aborted) return;
    if (!result.ok) {
      failed = true;
      continue;
    }
    // The complete list is authoritative (a streaming engine may have sent partials).
    const mapped = mapHits(doc, pages, sourceId, result.value, firstSeq);
    seq = firstSeq + mapped.length;
    publish([...base, ...mapped]);
  }
  if (own.signal.aborted) return;
  window.clearTimeout(scanTimer);
  controller = undefined;
  useSearchStore.setState((s) => ({
    status: failed && collected.length === 0 ? 'error' : 'done',
    scan: { done: scanTotal, total: scanTotal },
    timing: { ...s.timing, total: performance.now() - started },
  }));
}

export function setSearchQuery(query: string): void {
  useSearchStore.setState({ query });
}

export function setSearchOptions(options: Partial<SearchOptions>): void {
  useSearchStore.setState(options);
}

/** Moves the current hit; returns the new current hit. */
export function stepSearch(direction: 1 | -1): DocumentHit | undefined {
  const { hits, current } = useSearchStore.getState();
  const next = stepHit(current, hits.length, direction);
  useSearchStore.setState({ current: next, currentChosen: next >= 0 });
  return hits[next];
}

export function selectHit(index: number): DocumentHit | undefined {
  const { hits } = useSearchStore.getState();
  if (index < 0 || index >= hits.length) return undefined;
  useSearchStore.setState({ current: index, currentChosen: true });
  return hits[index];
}

/** Cancels any running search and forgets query and results (Esc). */
export function clearSearch(): void {
  controller?.abort();
  controller = undefined;
  useSearchStore.setState((s) => ({ ...INITIAL, focusSerial: s.focusSerial }));
}

export function requestSearchFocus(): void {
  useSearchStore.setState((s) => ({ focusSerial: s.focusSerial + 1 }));
}

/**
 * Shows a hit: Read mode, its page scrolled so the match is visible, then the hit flashes the
 * undo reveal's ring once it is laid out: the catalogue's *find step* (language.md §7.3, spec
 * 05.2; reduced motion: an instant scroll and a still ring).
 */
export function revealHit(hit: DocumentHit | undefined): void {
  if (!hit) return;
  const ui = useUiStore.getState();
  if (!isPageView(ui)) ui.showSurface('page');
  const bounds = hitBounds(hit);
  // A step: the hit rings itself, so the page takes no landing highlight.
  useViewStore
    .getState()
    .scrollToPage(
      hit.pageId,
      bounds === undefined ? { motion: 'step' } : { reveal: bounds, motion: 'step' },
    );
  // One hit is current, drawn by `SearchHighlights` once its page is laid out. The ring waits
  // for the eased scroll to land (motion-2026-10 viewer.md §1), and the hit pulses with it
  // (frame.md §3).
  const current = () => document.querySelector('[data-testid="search-highlights"] [data-current]');
  void afterJump()
    .then(() => revealWhenShown(current))
    .then((flash) => {
      if (flash) pulseHit(current());
    });
}

/** How much the current hit swells at the height of its pulse. */
const PULSE_SCALE = 1.18;

/**
 * The hit's pulse (motion-2026-10 frame.md §3; the bounce macOS gives a found word): the
 * highlight swells and settles once, in `--spring-pop`'s time, by the `scale`
 * property so its own placement is untouched. Nothing under reduced motion (the ring says it).
 */
function pulseHit(hit: Element | null): void {
  if (!(hit instanceof HTMLElement) || typeof hit.animate !== 'function' || reducedMotion()) return;
  // Out on the entry ease, home on the zero-bounce spring's curve, in `pop`'s time.
  const home = springEasing('quick').easing;
  hit.animate(
    [
      { scale: '1', easing: EASE.out },
      { scale: String(PULSE_SCALE), offset: 0.3, easing: home },
      { scale: '1' },
    ],
    { duration: SPRING_CSS_MS.pop },
  );
}

// ---------------------------------------------------------------------------
// Panel open / close (Mod+F, Esc)
// ---------------------------------------------------------------------------

/** The strip's Find entry while it is mounted (`shell/frame/FindEntry.tsx`, 01-frame F6). */
export interface FindEntryHandle {
  /** Opens the entry (laid over the strip below 1280 px) as Mod+F does: Esc returns to the page. */
  readonly open: () => void;
  readonly field: () => HTMLInputElement | null;
}

let findEntry: FindEntryHandle | undefined;

/** The Find entry registers how Mod+F reaches it; undefined when it unmounts. */
export function setFindEntry(entry: FindEntryHandle | undefined): void {
  findEntry = entry;
}

/**
 * A modal dialog is up: Find's fields leave Esc to it (a sheet a Mod+ key opened from the field
 * dismisses on Esc even before it has moved the focus in, INK-12).
 */
export const modalOpen = (): boolean => document.querySelector('[aria-modal="true"]') !== null;

/** Whether the document's strip has the Find entry: all but the tight bar, which folds into ⋯. */
const stripHasFind = () => !frameClassOf(window.innerWidth, window.innerHeight).tight;

/** The field takes the focus with its query selected, so typing replaces it (F6 §6). */
const selectQuery = (field: HTMLElement) => {
  if (field instanceof HTMLInputElement) field.select();
};

/**
 * Mod+F (01-frame F6 §6): focuses and selects the frame's Find entry, opening it over the strip
 * below 1280 px; without one (component tests), the Search panel as before. From the Library it
 * opens the active document, whose strip has the entry. The keys typed meanwhile go into the
 * field, however long the view change takes (MOT-17, `commands/key-handoff.ts`).
 */
export function openFind(): void {
  const ui = useUiStore.getState();
  const library = ui.destination === 'home';
  const id = useWorkspaceStore.getState().workspace.activeDocument;
  if (library && id !== undefined) ui.showDocument(id);
  // From the command palette Find takes over: the palette closes, and the field waits until it
  // has gone, as it hands the focus back where it was when it closes.
  const palette = ui.paletteOpen;
  if (palette) ui.setPaletteOpen(false);
  // No entry in the strip (component tests; the narrow compact bar, whose strip has ⋯ instead,
  // also once the Library has gone): the Search panel, as before, and nothing is held.
  if (!findEntry && !(library && stripHasFind())) {
    openSearchPanel();
    return;
  }
  // Leaving the Library, the entry mounts with the document's strip: it opens once it is there.
  let opened = false;
  handKeysTo(
    () => {
      if (!findEntry) return null;
      if (palette && document.querySelector('[aria-modal="true"]')) return null;
      if (!opened) {
        opened = true;
        findEntry.open();
      }
      return findEntry.field();
    },
    { onFocus: selectQuery },
  );
}

/** ⌕'s press (F6 §2): its field takes the focus and the keys once it shows, as Mod+F's. */
export function focusFindField(field: () => HTMLInputElement | null): void {
  handKeysTo(field, { onFocus: selectQuery });
}

/** Shows the Search panel in the left rail and focuses its field. */
export function openSearchPanel(): void {
  const ui = useUiStore.getState();
  if (!(ui.leftPanelOpen && ui.leftPanelView === 'find')) {
    useUiStore.setState({ leftPanelOpen: true, leftPanelView: 'find' });
  }
  // Laid over the page (medium), the sidebar shows once asked for: this asks.
  showOverlaySidebar(true);
  requestSearchFocus();
}

/** Moves to the next / previous hit and shows it. */
export function searchStep(direction: 1 | -1): void {
  revealHit(stepSearch(direction));
}
