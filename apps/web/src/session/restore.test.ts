/**
 * Restoring snapshots with the real engine (Vitest browser mode, PDFium): a session comes
 * back under the same ids with its 20 undo steps, at its place; a closed document reopens
 * from its kept record as one step; a damaged or incomplete snapshot fails only what it must;
 * the launch flow shows "Restored …", Start fresh closes and its Undo brings them back, and
 * Clear empties the store.
 */
import { type DocumentId, rotatePages } from '@pdf-editor/document-model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import outlineUrl from '../../../../test/fixtures/outline-named-dests.pdf?url';
import simpleUrl from '../../../../test/fixtures/simple-text.pdf?url';
import { fixtureFile } from '../../test/store-harness';
import { getEngineService } from '../engine/engine-service';
import { useRecentsStore } from '../files/recents';
import { useUiStore } from '../state/ui-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { parseSessionManifest, type SessionManifestV1 } from './format';
import { keptRecordsOf, mergeKeptWorkspace, reopenKept, restoreSession } from './restore';
import {
  clearKeptChanges,
  setSessionEnabled,
  startFresh,
  startSession,
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
    place: (id) => ({
      page: 1,
      view: 'read',
      mode: id === model().workspace.activeDocument ? 'edit' : 'read',
    }),
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

describe('session restore', () => {
  beforeEach(() => {
    resetWorkspace();
    resetSessionStore();
    useUiStore.setState({ documentMode: {}, lastView: {}, destination: 'document', zoom: 1 });
  });
  afterEach(() => {
    resetWorkspace();
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
    // Place: zoom and lock.
    expect(useUiStore.getState().zoom).toBe(1.25);
    expect(useUiStore.getState().documentMode[before.activeDocument as DocumentId]).toBe('edit');
    // Undo walks the 20 kept steps, and no further.
    expect(model().history.past).toHaveLength(20);
    for (let i = 0; i < 20; i++) expect(model().undo()).toBeDefined();
    expect(model().undo()).toBeUndefined();
    expect(model().workspace.documents[a]?.pages[0]?.rotation).toBe((5 * 90) % 360);
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
    expect(model().workspace.documents[b]?.pages[0]?.rotation).toBe(90);
    expect(model().history.present.label).toMatch(/^Open /);
    expect(model().undo()).toBeDefined();
    expect(model().workspace.documentOrder).toEqual([]);
    expect(a).toBeDefined();
    expect(await reopenKept(storage, 'kept-missing')).toEqual({ ok: false, reason: 'missing' });
  });

  it('mergeKeptWorkspace adds only what the workspace lacks', async () => {
    const [a] = (await openFixtures()) as [DocumentId];
    const ws = model().workspace;
    expect(mergeKeptWorkspace(ws, ws)).toBe(ws);
    expect(ws.documents[a]).toBeDefined();
  });
});

describe('the launch flow', () => {
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
      // The old tab's manifest gave way to this tab's.
      expect(storage.files.has('sessions/old-tab.json')).toBe(false);
      expect(storage.files.has('sessions/new-tab.json')).toBe(true);

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
});
