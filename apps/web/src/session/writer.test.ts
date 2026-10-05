/**
 * The snapshot writer (ADR-0032 §2.4, §2.7) over the memory store: within 2 s of a change,
 * sources and blobs written once, `persist()` asked once, closed documents kept for Recents,
 * retention, and a Clear that is final.
 */
import {
  addSource,
  type BlobId,
  closeDocument,
  createHistory,
  createSequentialIdGenerator,
  createWorkspace,
  deserializeHistoryTail,
  type DocumentId,
  type EngineEdit,
  type History,
  pushHistory,
  rotatePages,
  type SourceId,
  setPageOverlays,
  undo,
  type Workspace,
} from '@pdf-editor/document-model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseKeptRecord, parseSessionManifest } from './format';
import { type PlaceState, type SnapshotState } from './snapshot';
import { memorySnapshotStorage } from './storage';
import { SNAPSHOT_MAX_WAIT_MS, SnapshotWriter, type WriterDeps } from './writer';

const LETTER = { width: 612, height: 792 };
const FLAGS = {
  encrypted: false,
  repaired: false,
  hasAcroForm: false,
  hasXfa: false,
  hasSignatures: false,
  tagged: false,
  linearized: false,
};

function open(names: readonly string[]): { ws: Workspace; docs: DocumentId[] } {
  const ids = createSequentialIdGenerator('w');
  let ws = createWorkspace();
  const docs: DocumentId[] = [];
  for (const name of names) {
    const r = addSource(
      ws,
      {
        name,
        byteLength: 100,
        pageCount: 3,
        pages: [0, 1, 2].map(() => ({ size: LETTER, rotation: 0 as const })),
        fingerprint: `fp-${name}`,
        flags: FLAGS,
        metadata: { policy: 'explicit' },
        outline: [],
      },
      ids,
    );
    ws = r.workspace;
    docs.push(r.documentId);
  }
  return { ws, docs };
}

function stampEdit(source: SourceId, id: string, blob: string): EngineEdit {
  return {
    id,
    source,
    pageIndex: 0,
    kind: 'annotation.create',
    payload: { annotation: { id, image: { type: 'image/png', blob } } },
    inverse: { id: `${id}-inv`, source, pageIndex: 0, kind: 'annotation.delete', payload: null },
  };
}

interface Harness {
  readonly writer: SnapshotWriter;
  readonly storage: ReturnType<typeof memorySnapshotStorage>;
  readonly sourceReads: SourceId[];
  readonly persist: ReturnType<typeof vi.fn>;
  readonly kept: string[];
  readonly forgotten: string[];
  state: SnapshotState;
}

function harness(history: History, overrides: Partial<WriterDeps> = {}): Harness {
  const storage = memorySnapshotStorage();
  const sourceReads: SourceId[] = [];
  const persist = vi.fn(() => Promise.resolve(true));
  const kept: string[] = [];
  const forgotten: string[] = [];
  const h: Harness = {
    storage,
    sourceReads,
    persist,
    kept,
    forgotten,
    state: { history, files: {}, blobs: {}, editBlobs: {} },
    writer: undefined as unknown as SnapshotWriter,
  };
  const places: PlaceState = {
    destination: 'document',
    zoom: 1.5,
    fitMode: null,
    place: () => ({ page: 2, view: 'read', mode: 'edit' }),
    changed: () => true,
  };
  (h as { writer: SnapshotWriter }).writer = new SnapshotWriter({
    storage,
    tabId: 'tab-1',
    state: () => h.state,
    places: () => places,
    sourceBytes: (id) => {
      sourceReads.push(id);
      return Promise.resolve(new Blob([`%PDF-${id}`]));
    },
    persist,
    onKept: (record) => kept.push(record.id),
    onForgotten: (ids) => forgotten.push(...ids),
    ...overrides,
  });
  return h;
}

const keys = (h: Harness) => [...h.storage.files.keys()].sort();

describe('SnapshotWriter', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes within 2 s of a change, even while changes keep coming', async () => {
    const { ws } = open(['a.pdf']);
    const h = harness(createHistory(ws, 'Open', 0));
    for (let i = 0; i < 10; i++) {
      h.writer.noteChange('content');
      await vi.advanceTimersByTimeAsync(300);
    }
    // 3 s of changes every 300 ms: written by the 2 s mark, not after the last change only.
    expect(SNAPSHOT_MAX_WAIT_MS).toBeLessThanOrEqual(2000);
    await h.writer.whenIdle();
    expect(h.storage.files.has('sessions/tab-1.json')).toBe(true);
    expect(h.writer.pending).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    await h.writer.whenIdle();
    expect(h.writer.pending).toBe(false);
  });

  it('writes each source once, the manifest every time, and asks persist() once', async () => {
    const { ws, docs } = open(['a.pdf']);
    const doc = docs[0] as DocumentId;
    let history = createHistory(ws, 'Open', 0);
    const h = harness(history);
    h.writer.noteChange('content');
    await h.writer.flush();
    const page = ws.documents[doc]?.pages[0]?.id;
    if (!page) throw new Error('no page');
    history = pushHistory(history, rotatePages(ws, [page], 90), 'Rotate', { now: 1 });
    h.state = { ...h.state, history };
    h.writer.noteChange('content');
    await h.writer.flush();
    expect(h.sourceReads).toHaveLength(1);
    expect(h.persist).toHaveBeenCalledTimes(1);
    const manifest = parseSessionManifest(await h.storage.files.get('sessions/tab-1.json')?.text());
    expect(manifest.documents).toEqual([
      { id: doc, page: 2, view: 'read', mode: 'edit', changed: true },
    ]);
    expect(manifest.zoom).toBe(1.5);
    const restored = deserializeHistoryTail(manifest.history);
    expect(restored.past).toHaveLength(1);
    expect(undo(restored).present.label).toBe('Open');
  });

  it('never waits for persist(): a prompt nobody answers (Firefox) blocks no write', async () => {
    const { ws } = open(['a.pdf']);
    const status: boolean[] = [];
    const h = harness(createHistory(ws, 'Open', 0), {
      persist: () => new Promise<boolean>(() => undefined),
      onStatus: (s) => status.push(s.idle),
    });
    h.writer.noteChange('content');
    await h.writer.flush();
    expect(h.storage.files.has('sessions/tab-1.json')).toBe(true);
    expect(h.writer.idle).toBe(true);
    // A second write is not held up either.
    h.writer.noteChange('content');
    await h.writer.flush();
    expect(h.writer.idle).toBe(true);
    expect(status.at(-1)).toBe(true);
  });

  it('asks persist() only once a document has changes (ADR-0032 §2.4: at the first edit)', async () => {
    const { ws } = open(['a.pdf']);
    const persist = vi.fn(() => Promise.resolve(false));
    let changed = false;
    const h = harness(createHistory(ws, 'Open', 0), {
      persist,
      places: () => ({
        destination: 'document',
        zoom: 1,
        fitMode: null,
        place: () => ({ page: 0, view: 'read', mode: 'read' }),
        changed: () => changed,
      }),
    });
    h.writer.noteChange('content');
    await h.writer.flush();
    expect(persist).not.toHaveBeenCalled();
    changed = true;
    h.writer.noteChange('content');
    await h.writer.flush();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('does not write again when nothing changed (a hide after a write)', async () => {
    const { ws } = open(['a.pdf']);
    const h = harness(createHistory(ws, 'Open', 0));
    h.writer.noteChange('view');
    await h.writer.flush();
    const first = h.storage.files.get('sessions/tab-1.json');
    await h.writer.flush();
    expect(h.storage.files.get('sessions/tab-1.json')).toBe(first);
  });

  it('writes the edit blobs and image blobs the tail refers to', async () => {
    const { ws, docs } = open(['a.pdf']);
    const doc = docs[0] as DocumentId;
    const source = Object.keys(ws.sources)[0] as SourceId;
    const page = ws.documents[doc]?.pages[0]?.id;
    if (!page) throw new Error('no page');
    let history = createHistory(ws, 'Open', 0);
    const stamped = { ...ws, engineEdits: [stampEdit(source, 'e1', 'edit-sig')] };
    history = pushHistory(history, stamped, 'Signature', { now: 1 });
    const overlaid = setPageOverlays(
      stamped,
      [page],
      [
        {
          kind: 'image',
          layer: 'over',
          blob: 'img-1' as BlobId,
          anchor: 'center',
          offset: { x: 0, y: 0 },
          scale: 1,
          opacity: 1,
        },
      ],
    );
    history = pushHistory(history, overlaid, 'Image', { now: 2 });
    const h = harness(history);
    h.state = {
      history,
      files: {},
      blobs: {
        ['img-1' as BlobId]: {
          bytes: new Uint8Array([1, 2, 3]).buffer,
          type: 'image/png',
          width: 1,
          height: 1,
          name: 'x.png',
        },
      },
      editBlobs: { 'edit-sig': new Blob([new Uint8Array([9, 9])], { type: 'image/png' }) },
    };
    h.writer.noteChange('content');
    await h.writer.flush();
    expect(keys(h)).toEqual([
      'blobs/edit-sig',
      'blobs/img-1',
      'sessions/tab-1.json',
      `sources/${source}.pdf`,
    ]);
    const manifest = parseSessionManifest(await h.storage.files.get('sessions/tab-1.json')?.text());
    expect(manifest.blobs).toHaveLength(2);
    expect(manifest.blobs).toContainEqual({
      id: 'img-1',
      kind: 'image',
      type: 'image/png',
      width: 1,
      height: 1,
      name: 'x.png',
    });
    expect(manifest.blobs).toContainEqual({ id: 'edit-sig', kind: 'edit', type: 'image/png' });
  });

  it('keeps a closed document for Recents and forgets it when it comes back', async () => {
    const { ws, docs } = open(['a.pdf', 'b.pdf']);
    const [a, b] = docs as [DocumentId, DocumentId];
    const h = harness(createHistory(ws, 'Open', 0));
    h.writer.noteChange('content');
    await h.writer.flush();
    const closed = closeDocument(ws, b);
    h.state = { ...h.state, history: pushHistory(h.state.history, closed, 'Close', { now: 1 }) };
    h.writer.noteClosed(ws, [b]);
    await h.writer.flush();
    expect(h.kept).toEqual([`kept-${b}`]);
    const record = parseKeptRecord(await h.storage.files.get(`kept/kept-${b}.json`)?.text());
    expect(record.workspace.documents.map((d) => d.id)).toEqual([b]);
    expect(record.name).toBe('b.pdf');
    expect(record.place).toMatchObject({ id: b, page: 2, mode: 'edit' });
    expect(record.sources).toHaveLength(1);
    // The other document's source is not part of it.
    expect(record.workspace.sources.map((s) => s.name)).toEqual(['b.pdf']);
    h.writer.noteReopened([b]);
    await h.writer.flush();
    expect(h.storage.files.has(`kept/kept-${b}.json`)).toBe(false);
    expect(h.forgotten).toContain(`kept-${b}`);
    expect(a).toBeDefined();
  });

  it('writes a source again when another tab cleared the store', async () => {
    const { ws } = open(['a.pdf']);
    const h = harness(createHistory(ws, 'Open', 0));
    h.writer.noteChange('content');
    await h.writer.flush();
    await h.storage.clear();
    h.writer.noteChange('view');
    await h.writer.flush();
    expect(h.sourceReads).toHaveLength(2);
    expect(keys(h).filter((k) => k.startsWith('sources/'))).toHaveLength(1);
  });

  it('removes its manifest once no document is open', async () => {
    const { ws, docs } = open(['a.pdf']);
    const h = harness(createHistory(ws, 'Open', 0));
    h.writer.noteChange('content');
    await h.writer.flush();
    expect(h.storage.files.has('sessions/tab-1.json')).toBe(true);
    const empty = closeDocument(ws, docs[0] as DocumentId);
    h.state = { ...h.state, history: pushHistory(h.state.history, empty, 'Close', { now: 1 }) };
    h.writer.noteChange('content');
    await h.writer.flush();
    expect(h.storage.files.has('sessions/tab-1.json')).toBe(false);
  });

  it('Clear is final: a write queued before it never lands after it', async () => {
    const { ws, docs } = open(['a.pdf', 'b.pdf']);
    const h = harness(createHistory(ws, 'Open', 0));
    h.writer.noteChange('content');
    await h.writer.flush();
    h.writer.noteClosed(ws, [docs[1] as DocumentId]);
    // A change is pending (timer armed), and a write is queued, when Clear is pressed.
    h.writer.noteChange('content');
    const writing = h.writer.flush();
    h.writer.noteChange('view');
    const cleared = h.writer.clearAll();
    await writing;
    expect(await cleared).toBe(true);
    expect(keys(h)).toEqual([]);
    await vi.advanceTimersByTimeAsync(5000);
    await h.writer.flush();
    await h.writer.whenIdle();
    expect(keys(h)).toEqual([]);
    expect(h.writer.pending).toBe(false);
    // A new change is kept again.
    h.writer.noteChange('content');
    await h.writer.flush();
    expect(h.storage.files.has('sessions/tab-1.json')).toBe(true);
  });

  it('expires kept records past 30 days and tells Recents', async () => {
    const { ws } = open(['a.pdf']);
    const h = harness(createHistory(ws, 'Open', 0));
    const old = { id: 'kept-old', keptAt: Date.now() - 31 * 24 * 3600 * 1000 };
    await h.storage.write(
      'kept',
      'kept-old.json',
      JSON.stringify({
        format: 1,
        kind: 'kept',
        ...old,
        title: 'old.pdf',
        name: 'old.pdf',
        size: 1,
        pages: 1,
        workspace: { version: 1, sources: [], documents: [], engineEdits: [] },
        place: { id: 'd', page: 0, view: 'read', mode: 'read', changed: true },
        sources: [],
        blobs: [],
      }),
    );
    await h.writer.refresh();
    expect(h.storage.files.has('kept/kept-old.json')).toBe(false);
    expect(h.forgotten).toEqual(['kept-old']);
  });

  it('reports a failed write and tries again with the next flush', async () => {
    const { ws } = open(['a.pdf']);
    const h = harness(createHistory(ws, 'Open', 0));
    const write = vi.spyOn(h.storage, 'write').mockRejectedValueOnce(new Error('quota'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    h.writer.noteChange('content');
    await h.writer.flush();
    expect(h.writer.pending).toBe(true);
    await h.writer.flush();
    expect(h.writer.pending).toBe(false);
    expect(h.storage.files.has('sessions/tab-1.json')).toBe(true);
    write.mockRestore();
    warn.mockRestore();
  });
});
