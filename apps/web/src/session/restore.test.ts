/**
 * Restoring snapshots with the real engine (Vitest browser mode, PDFium): a session comes
 * back under the same ids with its 20 undo steps, at its place; a closed document reopens
 * from its kept record as one step; a damaged or incomplete snapshot fails only what it must;
 * the launch flow shows "Restored …", Start fresh closes and its Undo brings them back, and
 * Clear empties the store.
 */
import {
  type DocumentId,
  mergeDocuments,
  renameDocument,
  rotatePages,
} from '@pdf-editor/document-model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import outlineUrl from '../../../../test/fixtures/outline-named-dests.pdf?url';
import simpleUrl from '../../../../test/fixtures/simple-text.pdf?url';
import { fixtureFile, pngFile } from '../../test/store-harness';
import { getEngineService } from '../engine/engine-service';
import { useRecentsStore } from '../files/recents';
import { revertDocument } from '../files/revert';
import { openPdf } from '../shell/compact/compact-actions';
import { resetCompactStore } from '../shell/compact/compact-store';
import { openImagesAsDocument } from '../stage/section-operations';
import { resetInputPolicyStore, useInputPolicyStore } from '../state/input-policy-store';
import { lockOf, resetLockStore, useLockStore } from '../state/lock-store';
import { fileFactsOf, isInFile, markSaved, resetSavedMarks } from '../state/saved-store';
import { isMarkupOpen, surfaceOf, useUiStore } from '../state/ui-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import {
  type KeptRecordV1,
  parseKeptRecord,
  parseSessionManifest,
  type SessionManifestV1,
} from './format';
import {
  claimTabLock,
  keptRecordsOf,
  mergeKeptWorkspace,
  planLaunch,
  reopenKept,
  restoreSession,
} from './restore';
import {
  claimThisTab,
  clearKeptChanges,
  flushSession,
  reopenFromSnapshot,
  setSessionEnabled,
  startFresh,
  startSession,
  TAB_ID_KEY,
  undoStartFresh,
} from './session';
import { resetSessionStore, useSessionStore } from './session-store';
import { ChangeTracker, type PlaceState } from './snapshot';
import { memorySnapshotStorage } from './storage';
import { SnapshotWriter } from './writer';

const model = () => useWorkspaceStore.getState();

async function openFixtures(): Promise<DocumentId[]> {
  const { opened } = await model().openFiles([
    await fixtureFile(simpleUrl, 'simple-text.pdf'),
    await fixtureFile(outlineUrl, 'outline.pdf'),
  ]);
  return opened.map((o) => o.documentId);
}

/** `count` rotations of the first page of `doc`, one history step each. */
function rotate(doc: DocumentId, count: number): void {
  for (let i = 0; i < count; i++) {
    const page = model().workspace.documents[doc]?.pages[0]?.id;
    if (!page) throw new Error('no page');
    model().applyOperation((ws) => rotatePages(ws, [page], 90), `Rotate ${i}`);
  }
}

/** A writer over `storage` reading the live stores (as session.ts wires it). */
function writerFor(
  storage: ReturnType<typeof memorySnapshotStorage>,
  tracker = new ChangeTracker(),
) {
  tracker.observe(model().workspace);
  const places = (): PlaceState => ({
    destination: 'document',
    zoom: 1.25,
    fitMode: null,
    place: (id) => {
      const lock = lockOf(id);
      return {
        page: 1,
        view: id === model().workspace.activeDocument ? 'read' : 'arrange',
        mode: id === model().workspace.activeDocument ? 'edit' : 'read',
        ...(lock === undefined ? {} : { lock }),
        ...fileFactsOf(id),
      };
    },
    changed: (id) => tracker.changed(model().workspace, id),
  });
  return new SnapshotWriter({
    storage,
    tabId: 'old-tab',
    state: () => {
      const { history, files, blobs, editBlobs } = model();
      return { history, files, blobs, editBlobs };
    },
    places,
    sourceBytes: async (id) => {
      const result = await getEngineService().sourceBytes(id);
      return result.ok ? new Blob([result.value]) : undefined;
    },
  });
}

async function manifestOf(
  storage: ReturnType<typeof memorySnapshotStorage>,
): Promise<SessionManifestV1> {
  return parseSessionManifest(await storage.files.get('sessions/old-tab.json')?.text());
}

// Real PDFium: 25 steps, a snapshot and a restore take seconds when other files share the browser.
describe('session restore', { timeout: 40_000 }, () => {
  beforeEach(() => {
    resetWorkspace();
    resetSessionStore();
    useUiStore.setState({ docUi: {}, destination: 'document', zoom: 1 });
  });
  afterEach(() => {
    resetWorkspace();
    resetLockStore();
    resetInputPolicyStore();
    vi.restoreAllMocks();
  });

  it('brings a session back under the same ids, with 20 undo steps, at its place', async () => {
    const [a, b] = (await openFixtures()) as [DocumentId, DocumentId];
    rotate(a, 25);
    const storage = memorySnapshotStorage();
    const writer = writerFor(storage);
    writer.noteChange('content');
    await writer.flush();
    const manifest = await manifestOf(storage);
    const before = model().workspace;
    const sources = Object.keys(before.sources);

    resetWorkspace();
    expect(model().workspace.documentOrder).toEqual([]);
    const outcome = await restoreSession(storage, manifest);
    expect(outcome).toMatchObject({ restored: [a, b], failed: [], withHistory: true });
    const ws = model().workspace;
    expect(ws.documentOrder).toEqual(before.documentOrder);
    expect(ws.activeDocument).toBe(before.activeDocument);
    expect(Object.keys(ws.sources).sort()).toEqual([...sources].sort());
    expect(Object.keys(model().files).sort()).toEqual([...sources].sort());
    expect(model().files[sources[0] as never]?.name).toMatch(/\.pdf$/);
    // The engine has the bytes under the old ids: renders and export can read them.
    for (const id of sources)
      expect((await getEngineService().sourceBytes(id as never)).ok).toBe(true);
    // Place: zoom, Markup (M8's Edit, until D1-5) and each document's surface (the format's
    // 'read' is the page, 'arrange' the grid).
    const ui = useUiStore.getState();
    const other = before.documentOrder.find((id) => id !== before.activeDocument);
    expect(ui.zoom).toBe(1.25);
    expect(isMarkupOpen(ui, before.activeDocument)).toBe(true);
    expect(isMarkupOpen(ui, other)).toBe(false);
    expect(surfaceOf(ui, before.activeDocument)).toBe('page');
    expect(surfaceOf(ui, other)).toBe('grid');
    // Undo walks the 20 kept steps, and no further.
    expect(model().history.past).toHaveLength(20);
    for (let i = 0; i < 20; i++) expect(model().undo()).toBeDefined();
    expect(model().undo()).toBeUndefined();
    expect(model().workspace.documents[a]?.pages[0]?.rotation).toBe((5 * 90) % 360);
  });

  it('brings each document back with the lock it was kept with (redesign spec §7)', async () => {
    const [a, b] = (await openFixtures()) as [DocumentId, DocumentId];
    useLockStore.getState().lock(a, 'signed');
    const storage = memorySnapshotStorage();
    const writer = writerFor(storage);
    writer.noteChange('view');
    await writer.flush();
    const manifest = await manifestOf(storage);
    expect(manifest.documents.find((p) => p.id === a)?.lock).toBe('signed');
    expect(manifest.documents.find((p) => p.id === b)).not.toHaveProperty('lock');
    resetWorkspace();
    resetLockStore();
    // Restoring is not opening: "Open documents locked" does not lock the unlocked one.
    useInputPolicyStore.setState({ openDocumentsLocked: true });
    await restoreSession(storage, manifest);
    expect(lockOf(a)).toBe('signed');
    expect(lockOf(b)).toBeUndefined();
    // A lock the format does not know fails the record, as any other bad field.
    const bad = { ...manifest, documents: [{ ...manifest.documents[0], lock: 'edit' }] };
    expect(() => parseSessionManifest(JSON.parse(JSON.stringify(bad)))).toThrow(/lock/);
  });

  it('restores the documents that remain when a source is missing, without the tail', async () => {
    const [a, b] = (await openFixtures()) as [DocumentId, DocumentId];
    rotate(a, 2);
    const storage = memorySnapshotStorage();
    const writer = writerFor(storage);
    writer.noteChange('content');
    await writer.flush();
    const manifest = await manifestOf(storage);
    const bSource = model().workspace.documents[b]?.pages[0]?.ref;
    if (bSource?.kind !== 'source') throw new Error('no source');
    await storage.remove('sources', `${bSource.source}.pdf`);
    resetWorkspace();
    const outcome = await restoreSession(storage, manifest);
    expect(outcome.restored).toEqual([a]);
    expect(outcome.failed).toEqual(['outline']);
    expect(outcome.withHistory).toBe(false);
    expect(model().history.past).toHaveLength(0);
  });

  it('reports a damaged snapshot instead of throwing', async () => {
    await openFixtures();
    const storage = memorySnapshotStorage();
    const writer = writerFor(storage);
    writer.noteChange('content');
    await writer.flush();
    const manifest = await manifestOf(storage);
    resetWorkspace();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const damaged = { ...manifest, history: { ...manifest.history, present: 99 } };
    const outcome = await restoreSession(storage, damaged);
    expect(outcome.restored).toEqual([]);
    expect(outcome.failed.length).toBeGreaterThan(0);
    expect(model().workspace.documentOrder).toEqual([]);
  });

  it('the compact edition restores one document; the others become kept records', async () => {
    const [a, b] = (await openFixtures()) as [DocumentId, DocumentId];
    const storage = memorySnapshotStorage();
    const writer = writerFor(storage);
    writer.noteChange('content');
    await writer.flush();
    const manifest = await manifestOf(storage);
    resetWorkspace();
    const outcome = await restoreSession(storage, manifest, { only: a });
    expect(outcome.restored).toEqual([a]);
    expect(model().workspace.documentOrder).toEqual([a]);
    const records = keptRecordsOf(manifest, [b], 1);
    expect(records.map((r) => r.workspace.documents[0]?.id)).toEqual([b]);
  });

  it('reopens a closed document from its kept record as one Open step', async () => {
    const [a, b] = (await openFixtures()) as [DocumentId, DocumentId];
    rotate(b, 1);
    const storage = memorySnapshotStorage();
    const writer = writerFor(storage);
    writer.noteChange('content');
    await writer.flush();
    const before = model().workspace;
    model().closeDocument(b);
    writer.noteClosed(before, [b]);
    await writer.flush();
    expect(storage.files.has(`kept/kept-${b}.json`)).toBe(true);
    resetWorkspace();
    const result = await reopenKept(storage, `kept-${b}`);
    expect(result.ok).toBe(true);
    expect(model().workspace.documentOrder).toEqual([b]);
    // Kept unlocked, and "Open documents locked" is off: it opens unlocked.
    expect(lockOf(b)).toBeUndefined();
    expect(model().workspace.documents[b]?.pages[0]?.rotation).toBe(90);
    expect(model().history.present.label).toMatch(/^Open /);
    expect(model().undo()).toBeDefined();
    expect(model().workspace.documentOrder).toEqual([]);
    expect(a).toBeDefined();
    expect(await reopenKept(storage, 'kept-missing')).toEqual({ ok: false, reason: 'missing' });
  });

  it('a kept document reopens with its lock; with "Open documents locked" an unlocked one locks', async () => {
    const [a, b] = (await openFixtures()) as [DocumentId, DocumentId];
    useLockStore.getState().lock(a, 'user');
    const storage = memorySnapshotStorage();
    const writer = writerFor(storage);
    writer.noteChange('content');
    await writer.flush();
    const before = model().workspace;
    model().closeDocument(a);
    model().closeDocument(b);
    writer.noteClosed(before, [a, b]);
    await writer.flush();
    resetWorkspace();
    resetLockStore();
    useInputPolicyStore.setState({ openDocumentsLocked: true });
    expect((await reopenKept(storage, `kept-${a}`)).ok).toBe(true);
    expect((await reopenKept(storage, `kept-${b}`)).ok).toBe(true);
    expect(lockOf(a)).toBe('user');
    expect(lockOf(b)).toBe('default');
  });

  it('mergeKeptWorkspace adds only what the workspace lacks', async () => {
    const [a] = (await openFixtures()) as [DocumentId];
    const ws = model().workspace;
    expect(mergeKeptWorkspace(ws, ws)).toBe(ws);
    expect(ws.documents[a]).toBeDefined();
  });
});

describe('the launch flow', { timeout: 40_000 }, () => {
  beforeEach(() => {
    resetWorkspace();
    resetSessionStore();
    setSessionEnabled(true);
  });
  afterEach(() => {
    setSessionEnabled(false);
    resetWorkspace();
  });

  it('restores, offers Start fresh with Undo, keeps closed documents, and Clear empties it', async () => {
    const [a, b] = (await openFixtures()) as [DocumentId, DocumentId];
    rotate(a, 3);
    const storage = memorySnapshotStorage();
    const writer = writerFor(storage);
    writer.noteChange('content');
    await writer.flush();
    resetWorkspace();

    const stop = startSession({ edition: 'full', storage, tabId: 'new-tab' });
    try {
      await vi.waitFor(() => expect(document.documentElement.dataset.session).toBe('ready'), {
        timeout: 15_000,
      });
      expect(model().workspace.documentOrder).toEqual([a, b]);
      expect(useSessionStore.getState().notice).toMatchObject({
        kind: 'restored',
        documents: [a, b],
      });
      // The old tab's manifest gives way to this tab's once that is written (queued after the
      // launch, which never waits on a write).
      await vi.waitFor(() => {
        expect(storage.files.has('sessions/old-tab.json')).toBe(false);
        expect(storage.files.has('sessions/new-tab.json')).toBe(true);
      });

      startFresh();
      expect(model().workspace.documentOrder).toEqual([]);
      expect(useSessionStore.getState().notice).toEqual({ kind: 'started-fresh', count: 2 });
      // The closed documents are kept for Recents.
      await vi.waitFor(
        () => {
          expect(storage.files.has(`kept/kept-${a}.json`)).toBe(true);
          expect(storage.files.has(`kept/kept-${b}.json`)).toBe(true);
        },
        { timeout: 10_000 },
      );
      await vi.waitFor(() =>
        expect(
          useRecentsStore.getState().entries.some((e) => e.kept?.snapshotId === `kept-${a}`),
        ).toBe(true),
      );
      undoStartFresh();
      expect(model().workspace.documentOrder).toEqual([a, b]);
      expect(useSessionStore.getState().notice).toBeNull();

      expect(await clearKeptChanges()).toBe(true);
      expect([...storage.files.keys()]).toEqual([]);
      await vi.waitFor(() =>
        expect(useRecentsStore.getState().entries.some((e) => e.kept !== undefined)).toBe(false),
      );
    } finally {
      stop();
    }
  });

  it('a document and a combine of it, both closed, keep their snapshots in rows of their own', async () => {
    const storage = memorySnapshotStorage();
    const stop = startSession({ edition: 'full', storage, tabId: 'tab-combine' });
    try {
      await vi.waitFor(() => expect(document.documentElement.dataset.session).toBe('ready'), {
        timeout: 15_000,
      });
      const [a, b] = (await openFixtures()) as [DocumentId, DocumentId];
      model().applyOperation(
        (ws, ids) =>
          mergeDocuments(ws, { documentIds: [a, b], title: 'A + B', keepSources: true }, ids),
        'Combine',
      );
      const combined = model().workspace.documentOrder.find((id) => id !== a && id !== b);
      if (combined === undefined) throw new Error('no combined document');
      rotate(a, 1);
      model().closeDocument(a);
      await flushSession();
      model().closeDocument(combined);
      await flushSession();
      await vi.waitFor(() => {
        const rows = useRecentsStore.getState().entries;
        expect(rows.find((e) => e.kept?.snapshotId === `kept-${a}`)?.name).toBe('simple-text.pdf');
        expect(rows.find((e) => e.kept?.snapshotId === `kept-${combined}`)?.name).toBe('A + B.pdf');
      });
      await flushSession();
      expect(storage.files.has(`kept/kept-${a}.json`)).toBe(true);
      expect(storage.files.has(`kept/kept-${combined}.json`)).toBe(true);
    } finally {
      stop();
    }
  });

  it('a document whose source does not open at launch stays in Recents; a retry brings it back', async () => {
    const [a, b] = (await openFixtures()) as [DocumentId, DocumentId];
    rotate(b, 2);
    const storage = memorySnapshotStorage();
    const writer = writerFor(storage);
    writer.noteChange('content');
    await writer.flush();
    resetWorkspace();
    // The person presses Skip on the password prompt (or the engine fails) for outline.pdf.
    const service = getEngineService();
    const open = service.open.bind(service);
    const skipped = vi.spyOn(service, 'open').mockImplementation((file, ...rest) =>
      file.name === 'outline.pdf'
        ? Promise.resolve({
            ok: false as const,
            error: { code: 'password-cancelled' as const, message: 'Skipped' },
          })
        : open(file, ...rest),
    );
    const stop = startSession({ edition: 'full', storage, tabId: 'tab-failed' });
    try {
      await vi.waitFor(() => expect(document.documentElement.dataset.session).toBe('ready'), {
        timeout: 15_000,
      });
      expect(model().workspace.documentOrder).toEqual([a]);
      // The old manifest goes, but only once the document that failed is a kept record.
      await vi.waitFor(() => {
        expect(storage.files.has('sessions/old-tab.json')).toBe(false);
        expect(storage.files.has(`kept/kept-${b}.json`)).toBe(true);
      });
      await vi.waitFor(() =>
        expect(
          useRecentsStore.getState().entries.find((e) => e.kept?.snapshotId === `kept-${b}`)?.kept
            ?.changed,
        ).toBe(true),
      );
      // A reopen from Recents that fails the same way keeps the snapshot for the next try.
      expect(await reopenFromSnapshot(`kept-${b}`)).toEqual({
        ok: false,
        reason: 'failed',
        title: 'outline',
      });
      await flushSession();
      expect(storage.files.has(`kept/kept-${b}.json`)).toBe(true);
      expect(
        useRecentsStore.getState().entries.some((e) => e.kept?.snapshotId === `kept-${b}`),
      ).toBe(true);
      skipped.mockRestore();
      const again = await reopenFromSnapshot(`kept-${b}`);
      expect(again?.ok).toBe(true);
      expect(model().workspace.documents[b]?.pages[0]?.rotation).toBe(180);
    } finally {
      stop();
      vi.restoreAllMocks();
    }
  });

  /**
   * Changes `doc`, saves it in place (the saved mark, as `files/save.ts` sets it), keeps the
   * session, then reloads; `edit` may rewrite the kept manifest first.
   */
  async function savedInPlaceThenReloaded(
    change: (doc: DocumentId) => void,
    edit: (manifest: Record<string, unknown>) => void = () => undefined,
  ): Promise<{ doc: DocumentId; stop: () => void }> {
    const [doc] = (await openFixtures()) as [DocumentId, DocumentId];
    change(doc);
    markSaved(doc, { handleKept: true });
    expect(isInFile(model().workspace, doc)).toBe(true);
    const storage = memorySnapshotStorage();
    const writer = writerFor(storage);
    writer.noteChange('content');
    await writer.flush();
    const text = (await storage.files.get('sessions/old-tab.json')?.text()) ?? '';
    const manifest = JSON.parse(text) as Record<string, unknown>;
    edit(manifest);
    await storage.write('sessions', 'old-tab.json', new Blob([JSON.stringify(manifest)]));
    // The reload: the stores start empty.
    resetWorkspace();
    resetSavedMarks();
    const stop = startSession({ edition: 'full', storage, tabId: 'new-tab' });
    await vi.waitFor(() => expect(document.documentElement.dataset.session).toBe('ready'), {
      timeout: 15_000,
    });
    expect(model().workspace.documentOrder).toContain(doc);
    return { doc, stop };
  }

  it('Revert after a reload leaves the document unsaved when Save had written over its file', async () => {
    const { doc, stop } = await savedInPlaceThenReloaded((d) => rotate(d, 1));
    try {
      expect(await revertDocument(doc)).toBe(true);
      // The file holds the saved rotation; the reverted document is the opened bytes.
      expect(isInFile(model().workspace, doc)).toBe(false);
    } finally {
      stop();
    }
  });

  it('a snapshot from before the file facts were kept reads as written over (unknown)', async () => {
    // A renamed document restores as a pristine copy of its file, so it keeps its origin.
    const rename = (d: DocumentId) =>
      model().applyOperation((ws) => renameDocument(ws, d, 'Renamed'), 'Rename');
    const { doc, stop } = await savedInPlaceThenReloaded(rename, (manifest) => {
      for (const place of manifest.documents as Record<string, unknown>[]) {
        delete place.origins;
        delete place.writtenOver;
      }
    });
    try {
      expect(await revertDocument(doc)).toBe(true);
      expect(isInFile(model().workspace, doc)).toBe(false);
    } finally {
      stop();
    }
  });
});

describe('which tab restores which session', () => {
  /** A manifest with nothing in it: the plan reads only its header. */
  const manifest = (tabId: string, savedAt: number) =>
    JSON.stringify({
      format: 1,
      kind: 'session',
      tabId,
      savedAt,
      destination: 'document',
      zoom: 1,
      fitMode: null,
      history: {},
      documents: [],
      sources: [],
      blobs: [],
    });

  it('a reloaded tab restores its own session, not the one another tab closed last', async () => {
    const storage = memorySnapshotStorage();
    await storage.write('sessions', 'tab-b.json', manifest('tab-b', 1));
    await storage.write('sessions', 'tab-a.json', manifest('tab-a', 2));
    // Tab B reloads: it holds its own lock again before planning.
    const own = await planLaunch(storage, new Set(['tab-b']), 'tab-b');
    expect(own.restore?.tabId).toBe('tab-b');
    expect(own.orphans.map((o) => o.tabId)).toEqual(['tab-a']);
    // A new tab takes the newest session no open tab holds.
    const fresh = await planLaunch(storage, new Set(['tab-new']), 'tab-new');
    expect(fresh.restore?.tabId).toBe('tab-a');
    // A session another open tab holds is never touched.
    const held = await planLaunch(storage, new Set(['tab-a', 'tab-c']), 'tab-c');
    expect(held.restore?.tabId).toBe('tab-b');
    expect(held.orphans).toEqual([]);
  });

  it('only one tab can claim a session to restore it', async () => {
    const release = await claimTabLock('tab-claimed');
    expect(release).toBeDefined();
    // A second tab launching at the same moment finds it taken.
    expect(await claimTabLock('tab-claimed')).toBeUndefined();
    await release?.();
    const again = await claimTabLock('tab-claimed');
    expect(again).toBeDefined();
    await again?.();
  });

  it('keeps this tab’s id across a reload; a duplicated tab takes a new one', async () => {
    sessionStorage.removeItem(TAB_ID_KEY);
    const first = await claimThisTab();
    expect(sessionStorage.getItem(TAB_ID_KEY)).toBe(first.tabId);
    // The page goes away (a reload, a crash, Memory Saver) and comes back in the same tab.
    await first.release();
    const reloaded = await claimThisTab();
    expect(reloaded.tabId).toBe(first.tabId);
    // Duplicate tab copies sessionStorage while the first tab still lives.
    const duplicate = await claimThisTab();
    expect(duplicate.tabId).not.toBe(first.tabId);
    await reloaded.release();
    await duplicate.release();
    sessionStorage.removeItem(TAB_ID_KEY);
  });
});

describe('the compact edition’s one document at a time', { timeout: 40_000 }, () => {
  beforeEach(() => {
    resetWorkspace();
    resetSessionStore();
    setSessionEnabled(true);
  });
  afterEach(() => {
    setSessionEnabled(false);
    resetWorkspace();
  });

  async function kept(
    storage: ReturnType<typeof memorySnapshotStorage>,
    id: DocumentId,
  ): Promise<KeptRecordV1 | undefined> {
    const file = storage.files.get(`kept/kept-${id}.json`);
    return file === undefined ? undefined : parseKeptRecord(await file.text());
  }

  it('a document replaced by the next open is kept with its blobs, even one just opened', async () => {
    const storage = memorySnapshotStorage();
    const stop = startSession({ edition: 'compact', storage, tabId: 'tab-compact' });
    try {
      await vi.waitFor(() => expect(document.documentElement.dataset.session).toBe('ready'), {
        timeout: 15_000,
      });
      // An image document (as a document restored from the full edition may hold), stored.
      const image = (await openImagesAsDocument([await pngFile('photo.png')])) as DocumentId;
      await flushSession();
      expect(await openPdf(await fixtureFile(simpleUrl, 'simple-text.pdf'))).toBe(true);
      const simple = model().workspace.activeDocument as DocumentId;
      // Opened a moment ago, not stored yet: the next open replaces it at once.
      expect(await openPdf(await fixtureFile(outlineUrl, 'outline.pdf'))).toBe(true);
      await flushSession();
      const imageRecord = await kept(storage, image);
      expect(imageRecord?.blobs.map((b) => b.kind)).toEqual(['image']);
      for (const blob of imageRecord?.blobs ?? []) {
        expect(storage.files.has(`blobs/${blob.id}`)).toBe(true);
      }
      const simpleRecord = await kept(storage, simple);
      expect(simpleRecord?.sources.map((s) => s.name)).toEqual(['simple-text.pdf']);
      for (const source of simpleRecord?.sources ?? []) {
        expect(storage.files.has(`sources/${source.id}.pdf`)).toBe(true);
      }
    } finally {
      stop();
      resetCompactStore();
    }
  });
});
