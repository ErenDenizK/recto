/**
 * Recents thumbnails (`02-library` 02.Q1): a row with a kept snapshot shows its first page at
 * 32 × 40, rendered on demand from the kept bytes when the row is visible; every other row keeps
 * the glyph. Nothing new is stored: the snapshot already holds the file (ADR-0032 §2.6), and the
 * rendered pixels live in memory for the session only.
 *
 * A render reads the kept record (`kept/<id>.json`) for the document's first page, opens that
 * page's source bytes (`sources/<id>.pdf`) in the engine under a fresh id, renders one small
 * bitmap, copies it into a canvas of its own and closes the source again, one row at a time.
 * The thumbnail is the page as the file has it (no engine edits replayed): a recognisable
 * picture, not a preview of the edits. No thumbnail (the glyph stays) for an encrypted source,
 * which might ask for its password, an image page, or anything that fails.
 */
import { deserializeWorkspace } from '@pdf-editor/document-model';

import { chooseBucket, getEngineService, RENDER_PRIORITY } from '../engine/engine-service';
import { parseKeptRecord, recordFile, sourceFile } from '../session/format';
import { snapshotStorage } from '../session/session';

/** The thumbnail box, CSS px (02.Q1). */
export const RECENT_THUMB = { width: 32, height: 40 } as const;

/** One finished thumbnail: a canvas of device pixels and its CSS size inside the box. */
export interface RecentThumb {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
}

const cache = new Map<string, Promise<RecentThumb | null>>();
let queue: Promise<unknown> = Promise.resolve();

/** The thumbnail of kept snapshot `snapshotId`, rendered once per session (null: glyph). */
export function recentThumb(snapshotId: string): Promise<RecentThumb | null> {
  const known = cache.get(snapshotId);
  if (known) return known;
  // Before the session has opened its storage there is nothing to read yet: ask again later
  // (the row asks once the session says it keeps documents) rather than remember "none".
  if (!snapshotStorage()) return Promise.resolve(null);
  // One render at a time, after the ones asked for before.
  const next = queue.then(() => render(snapshotId)).catch(() => null);
  queue = next;
  cache.set(snapshotId, next);
  return next;
}

/** Forgets every thumbnail (tests; Clear). */
export function resetRecentThumbs(): void {
  cache.clear();
}

async function render(snapshotId: string): Promise<RecentThumb | null> {
  const storage = snapshotStorage();
  if (!storage) return null;
  const recordBlob = await storage.read('kept', recordFile(snapshotId));
  if (!recordBlob) return null;
  const record = parseKeptRecord(JSON.parse(await recordBlob.text()));
  const ws = deserializeWorkspace(record.workspace);
  const page = ws.documents[record.place.id]?.pages[0];
  if (page?.ref.kind !== 'source') return null;
  const source = ws.sources[page.ref.source];
  const info = source?.pages[page.ref.index];
  if (!source || !info || source.flags.encrypted) return null;
  const bytes = await storage.read('sources', sourceFile(source.id));
  if (!bytes) return null;

  const engine = getEngineService();
  const opened = await engine.open(new File([bytes], source.name, { type: 'application/pdf' }));
  if (!opened.ok) return null;
  const id = opened.value.id;
  try {
    const turned = ((info.rotation + page.rotation) / 90) % 2 === 1;
    const widthPt = turned ? info.size.height : info.size.width;
    const heightPt = turned ? info.size.width : info.size.height;
    const fit = Math.min(RECENT_THUMB.width / widthPt, RECENT_THUMB.height / heightPt);
    const dpr = Math.max(1, globalThis.devicePixelRatio || 1);
    const result = await engine.renderPage({
      sourceId: id,
      index: page.ref.index,
      rotation: page.rotation,
      bucket: chooseBucket(fit * dpr, widthPt, heightPt),
      priority: RENDER_PRIORITY.offscreen,
    });
    if (!result.ok) return null;
    const width = Math.round(widthPt * fit);
    const height = Math.round(heightPt * fit);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(result.value.bitmap, 0, 0, canvas.width, canvas.height);
    return { canvas, width, height };
  } finally {
    void engine.close(id);
  }
}
