/**
 * Cover capture (DSN-87, `masa.md` §3.2): writes the covers of `covers.ts` and keeps where
 * reading stopped on the Recents entry. Started once by the session; loaded lazily so the
 * editor's first load carries the store and its readers alone.
 *
 * - **`first`**: when a file is recorded as opened (`onRecentRecorded`), page 1 of its source is
 *   rendered once at the cover scale through the running engine at `RENDER_PRIORITY.offscreen`
 *   (never ahead of a visible page), encoded as JPEG and written. A source that is encrypted
 *   stores none.
 * - **`left`**: when the page view is left (Home, the grid, another document), the page that was
 *   on screen is taken from the bitmap cache (`EngineService.preview`, synchronously: no engine
 *   work), drawn down into a canvas and encoded off the critical path. Only past page 1, and
 *   only for a document that is one file's pages.
 * - **Place**: the resume store's point for the open document, written to its Recents entry two
 *   seconds after the last change (the writer's rhythm).
 * - **Backfill**: on the full edition, at idle three seconds after the session starts, rows
 *   that hold a kept snapshot and have no `first` cover get one through `recent-thumbs.ts`,
 *   one at a time. Never on the phone, where it would start PDFium on the Library.
 */
import type {
  DocumentId,
  Rotation,
  SourceDocument,
  SourceId,
  SourcePageInfo,
  Workspace,
} from '@pdf-editor/document-model';

import { chooseBucket, getEngineService, RENDER_PRIORITY } from '../engine/engine-service';
import {
  onRecentRecorded,
  type RecentEntry,
  type RecentPlace,
  setRecentPlace,
  useRecentsStore,
} from '../files/recents';
import { useResumeStore } from '../session/resume';
import { snapshotStorage } from '../session/session';
import { useUiStore } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
import { useWorkspaceStore } from '../state/workspace-store';
import {
  type CoverKind,
  coverKey,
  type CoverRecord,
  prefetchCovers,
  watchCoverSweep,
  writeCover,
} from './covers';

/** A box to fit a page in, device pixels. */
export interface CoverBox {
  readonly width: number;
  readonly height: number;
}

/** `first`: 2× the large shelf box. `left`: 2× the Continue box (`masa.md` §3.1). */
export const FIRST_BOX: CoverBox = { width: 304, height: 400 };
export const LEFT_BOX: CoverBox = { width: 264, height: 344 };
/** JPEG on every engine: WebKit does not encode WebP. */
export const COVER_QUALITY = 0.8;

/** How long after the last change the place is written. */
const PLACE_DELAY_MS = 2000;
/** One leaving is one cover: a second within this long is the same leaving. */
const LEAVE_DEDUPE_MS = 1000;
/** The longest the `first` capture waits for the first visible page. */
const FIRST_PAGE_WAIT_MS = 5000;
/** The backfill waits this long after the session starts. */
const BACKFILL_DELAY_MS = 3000;

/** A finished image: JPEG bytes and the pixel size. */
export interface EncodedCover {
  readonly bytes: ArrayBuffer;
  readonly width: number;
  readonly height: number;
}

/**
 * Draws `source` (`width` × `height` pixels) down to fit `box` (never up) and encodes it as a
 * JPEG on a white ground: `OffscreenCanvas.convertToBlob`, else a canvas' `toBlob`. Null when no
 * 2D context or no encoder is there.
 */
export async function encodeCover(
  source: CanvasImageSource,
  width: number,
  height: number,
  box: CoverBox,
): Promise<EncodedCover | null> {
  if (width <= 0 || height <= 0) return null;
  const fit = Math.min(1, box.width / width, box.height / height);
  const w = Math.max(1, Math.round(width * fit));
  const h = Math.max(1, Math.round(height * fit));
  let blob: Blob | null;
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, w, h);
    context.drawImage(source, 0, 0, w, h);
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: COVER_QUALITY });
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, w, h);
    context.drawImage(source, 0, 0, w, h);
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', COVER_QUALITY),
    );
  }
  if (blob?.type !== 'image/jpeg') return null;
  return { bytes: await blob.arrayBuffer(), width: w, height: h };
}

async function store(
  kind: CoverKind,
  file: Pick<RecentEntry, 'name' | 'size'>,
  page: number,
  image: EncodedCover,
): Promise<void> {
  const record: CoverRecord = {
    key: coverKey(kind, file),
    kind,
    page,
    width: image.width,
    height: image.height,
    type: 'image/jpeg',
    bytes: image.bytes,
    at: Date.now(),
  };
  await writeCover(record);
}

// ---------------------------------------------------------------------------
// Which file a document is
// ---------------------------------------------------------------------------

/** The one source whose pages make up `documentId`, or undefined (a combine, images, blanks). */
function soleSource(ws: Workspace, documentId: DocumentId): SourceDocument | undefined {
  const doc = ws.documents[documentId];
  if (!doc || doc.pages.length === 0) return undefined;
  let id: SourceId | undefined;
  for (const page of doc.pages) {
    if (page.ref.kind !== 'source') return undefined;
    if (id !== undefined && id !== page.ref.source) return undefined;
    id = page.ref.source;
  }
  return id === undefined ? undefined : ws.sources[id];
}

/** The file a document came from, as Recents names it (name and size), or undefined. */
function fileOf(ws: Workspace, documentId: DocumentId): { name: string; size: number } | undefined {
  const source = soleSource(ws, documentId);
  return source === undefined ? undefined : { name: source.name, size: source.byteLength };
}

// ---------------------------------------------------------------------------
// first
// ---------------------------------------------------------------------------

/**
 * The source whose page 1 is the `first` cover of `file` (Recents knows a file by name and
 * size), or undefined: not open, or encrypted (its pages are never stored).
 */
export function firstCoverSource(
  sources: Workspace['sources'],
  file: Pick<RecentEntry, 'name' | 'size'>,
): SourceDocument | undefined {
  const source = Object.values(sources).find(
    (s) => s.name === file.name && s.byteLength === file.size,
  );
  return source === undefined || source.flags.encrypted || source.pages.length === 0
    ? undefined
    : source;
}

/**
 * Whether a stored `first` cover written at `at` still shows the file: it does when the file
 * is not newer than the cover. An unknown `lastModified` never skips.
 */
export function coverIsCurrent(at: number | undefined, lastModified: number | undefined): boolean {
  return at !== undefined && lastModified !== undefined && at > lastModified;
}

async function captureFirst(entry: RecentEntry, lastModified?: number): Promise<void> {
  const have = (await prefetchCovers()).find((c) => c.key === coverKey('first', entry));
  if (coverIsCurrent(have?.at, lastModified)) return;
  const source = firstCoverSource(useWorkspaceStore.getState().workspace.sources, entry);
  const info = source?.pages[0];
  if (!source || !info) return;
  const turned = (info.rotation / 90) % 2 === 1;
  const widthPt = turned ? info.size.height : info.size.width;
  const heightPt = turned ? info.size.width : info.size.height;
  const fit = Math.min(FIRST_BOX.width / widthPt, FIRST_BOX.height / heightPt);
  const result = await getEngineService().renderPage({
    sourceId: source.id,
    index: 0,
    rotation: 0,
    bucket: chooseBucket(fit, widthPt, heightPt),
    priority: RENDER_PRIORITY.offscreen,
  });
  if (!result.ok) return;
  // The cache owns the bitmap: draw it before anything else can evict it.
  const image = await encodeCover(
    result.value.bitmap,
    result.value.width,
    result.value.height,
    FIRST_BOX,
  );
  if (image) await store('first', entry, 0, image);
}

// ---------------------------------------------------------------------------
// left
// ---------------------------------------------------------------------------

/**
 * Takes the cover of the page `documentId` was left at. Synchronous up to the encode, so the
 * bitmap is read before the page view's DOM and cache move on.
 */
/** What a `left` cover of page `page` of `documentId` is made from, or undefined: none. */
export function leftTarget(
  ws: Workspace,
  documentId: DocumentId | null | undefined,
  page: number,
):
  | {
      readonly source: SourceDocument;
      readonly index: number;
      readonly rotation: Rotation;
      readonly info: SourcePageInfo;
    }
  | undefined {
  if (documentId === null || documentId === undefined || page <= 0) return undefined;
  const source = soleSource(ws, documentId);
  const virtual = ws.documents[documentId]?.pages[page];
  // An encrypted source stores none (the same rule as `first`).
  if (!source || virtual?.ref.kind !== 'source' || source.flags.encrypted) return undefined;
  const info = source.pages[virtual.ref.index];
  return info && { source, index: virtual.ref.index, rotation: virtual.rotation, info };
}

function captureLeft(ws: Workspace, documentId: DocumentId | null | undefined, page: number): void {
  const target = leftTarget(ws, documentId, page);
  if (!target) return;
  const { source, info, index, rotation } = target;
  const turned = ((info.rotation + rotation) / 90) % 2 === 1;
  const widthPt = turned ? info.size.height : info.size.width;
  const heightPt = turned ? info.size.width : info.size.height;
  const fit = Math.min(LEFT_BOX.width / widthPt, LEFT_BOX.height / heightPt);
  const cached = getEngineService().preview(
    source.id,
    index,
    rotation,
    chooseBucket(fit, widthPt, heightPt),
  );
  if (!cached || cached.width === 0) return;
  const file = { name: source.name, size: source.byteLength };
  void encodeCover(cached.bitmap, cached.width, cached.height, LEFT_BOX).then((image) => {
    if (image) return store('left', file, page, image);
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// place
// ---------------------------------------------------------------------------

/**
 * Keeps the open documents' places on their Recents rows: queued as the resume store changes
 * (the file is named then, so a document closed within the delay is not lost), written two
 * seconds after the last change, and at once when the page hides or the watch stops.
 * `resolve` names a document's file (the workspace's, in the app).
 */
export function watchPlaces(
  resolve: (id: DocumentId) => { name: string; size: number } | undefined = (id) =>
    fileOf(useWorkspaceStore.getState().workspace, id),
): () => void {
  let timer = 0;
  const pending = new Map<
    DocumentId,
    { readonly file: { name: string; size: number }; readonly place: RecentPlace }
  >();
  const flush = () => {
    window.clearTimeout(timer);
    for (const { file, place } of pending.values()) void setRecentPlace(file, place);
    pending.clear();
  };
  const off = useResumeStore.subscribe((state, previous) => {
    if (state.points === previous.points) return;
    for (const [key, point] of Object.entries(state.points)) {
      const id = key as DocumentId;
      if (previous.points[key] === point) continue;
      const file = resolve(id);
      if (!file) continue;
      pending.set(id, {
        file,
        place: {
          page: point.page,
          total: point.total,
          at: point.at,
          zoom: point.zoom,
          fit: point.fit,
          offset: point.offset,
        },
      });
    }
    window.clearTimeout(timer);
    timer = window.setTimeout(flush, PLACE_DELAY_MS);
  });
  const onHide = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  document.addEventListener('visibilitychange', onHide);
  return () => {
    off();
    document.removeEventListener('visibilitychange', onHide);
    flush();
  };
}

// ---------------------------------------------------------------------------
// Backfill
// ---------------------------------------------------------------------------

/** Rows with a kept snapshot and no `first` cover, rendered one at a time. */
async function backfill(isStopped: () => boolean): Promise<void> {
  const have = new Set((await prefetchCovers()).map((cover) => cover.key));
  const rows = useRecentsStore
    .getState()
    .entries.filter((e) => e.kept !== undefined && !have.has(coverKey('first', e)));
  const { recentThumb } = await import('./recent-thumbs');
  for (const row of rows) {
    if (isStopped() || !snapshotStorage() || row.kept === undefined) return;
    const thumb = await recentThumb(
      row.kept.snapshotId,
      0,
      { width: FIRST_BOX.width / 2, height: FIRST_BOX.height / 2 },
      2,
    );
    if (!thumb || isStopped()) continue;
    const image = await encodeCover(
      thumb.canvas,
      thumb.canvas.width,
      thumb.canvas.height,
      FIRST_BOX,
    );
    if (image) await store('first', row, 0, image);
  }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

/**
 * Resolves once the engine has a rendered page in its cache, i.e. the first visible page has
 * had its turn (`masa.md` §3.2: never ahead of it); gives up after `FIRST_PAGE_WAIT_MS`. The
 * engine has no per-page "painted" event, so the cache filling is the stand-in; the cover's own
 * render is `offscreen` priority besides.
 */
function afterFirstPage(): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now();
    const poll = () => {
      if (getEngineService().cacheStats.entries > 0 || Date.now() - started > FIRST_PAGE_WAIT_MS) {
        resolve();
      } else {
        window.setTimeout(poll, 100);
      }
    };
    poll();
  });
}

/** A file was recorded as opened: its `first` cover, once the first page has rendered. */
export function recordedCover(entry: RecentEntry, lastModified?: number): Promise<void> {
  return afterFirstPage().then(() => captureFirst(entry, lastModified).catch(() => undefined));
}

/** Starts the capture for this session; `compact` skips the backfill. Returns the stop. */
export function startCoverCapture(options: { readonly compact: boolean }): () => void {
  let stopped = false;
  const stopSweep = watchCoverSweep();
  onRecentRecorded((entry, lastModified) => {
    void afterFirstPage().then(() => {
      if (!stopped) void captureFirst(entry, lastModified).catch(() => undefined);
    });
  });
  const stopPlaces = watchPlaces();
  const leave = (ws: Workspace, documentId: DocumentId | null | undefined) =>
    captureLeft(ws, documentId, useViewStore.getState().currentPage);
  // A close moves both the destination and the active document: one cover per leaving.
  const taken = new Map<DocumentId, number>();
  const leaveOnce = (ws: Workspace, documentId: DocumentId | null | undefined) => {
    if (documentId === null || documentId === undefined) return;
    const now = Date.now();
    if (now - (taken.get(documentId) ?? 0) < LEAVE_DEDUPE_MS) return;
    taken.set(documentId, now);
    leave(ws, documentId);
  };
  const offUi = useUiStore.subscribe((state, previous) => {
    if (previous.destination === 'document' && state.destination !== 'document') {
      const { workspace } = useWorkspaceStore.getState();
      leaveOnce(workspace, workspace.activeDocument);
    }
  });
  const offWorkspace = useWorkspaceStore.subscribe((state, previous) => {
    const left = previous.workspace.activeDocument;
    // The document left may be closed by now: its sources are in the state before.
    if (state.workspace.activeDocument !== left) leaveOnce(previous.workspace, left);
  });
  let idle = 0;
  const wait = window.setTimeout(() => {
    if (options.compact || stopped) return;
    const run = () => void backfill(() => stopped).catch(() => undefined);
    if ('requestIdleCallback' in window) idle = window.requestIdleCallback(run);
    else run();
  }, BACKFILL_DELAY_MS);
  return () => {
    stopped = true;
    window.clearTimeout(wait);
    if (idle !== 0) window.cancelIdleCallback(idle);
    onRecentRecorded(undefined);
    stopPlaces();
    offUi();
    offWorkspace();
    stopSweep();
  };
}
