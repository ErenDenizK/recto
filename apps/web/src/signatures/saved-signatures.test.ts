/**
 * Saved signatures (spec redesign D0-11; MK-12 §9, MK-13 §9): validation field by field on
 * read, newest first, the cap of five (the oldest goes), a window that keeps nothing, rename,
 * remove and its Undo, Clear (final), an IndexedDB round trip, the rendered stamp of each
 * kind, and arming one as the one-shot signature tool.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAnnotationStore } from '../annotations/annotation-store';
import { useToolStore } from '../viewer/tool-store';
import {
  armedSavedSignature,
  armSavedSignature,
  clearSignatures,
  drawnInk,
  indexedDbSignatureBackend,
  loadSavedSignatures,
  memorySignatureBackend,
  parseSavedSignature,
  parseSignatureInk,
  removeSignature,
  renameSignature,
  renderInk,
  restoreSignature,
  SAVED_SIGNATURE_LIMIT,
  type SavedSignature,
  type SignatureBackend,
  saveSignature,
  setSignatureBackend,
  signatureLabel,
  useSavedSignatures,
} from './saved-signatures';

/** A 1 × 1 transparent PNG. */
const PNG_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const typed = (id: string, createdAt: number, extra: Partial<SavedSignature> = {}) => ({
  id,
  createdAt,
  name: '',
  kind: 'typed',
  text: `Ada ${id}`,
  ...extra,
});

let backend: SignatureBackend;

beforeEach(() => {
  backend = memorySignatureBackend();
  setSignatureBackend(backend);
});

afterEach(() => {
  setSignatureBackend(undefined);
  useToolStore.getState().setMode('select');
  useAnnotationStore.getState().setPendingStamp(null);
});

describe('validation on read', () => {
  it('reads each kind back', () => {
    expect(parseSavedSignature(typed('a', 1))).toMatchObject({ kind: 'typed', text: 'Ada a' });
    expect(
      parseSavedSignature({ id: 'b', createdAt: 2, kind: 'drawn', strokes: [[1, 2, 30, 40]] }),
    ).toMatchObject({ kind: 'drawn', name: '', strokes: [[1, 2, 30, 40]] });
    expect(
      parseSavedSignature({
        id: 'c',
        createdAt: 3,
        name: ' Initials ',
        kind: 'image',
        dataUrl: PNG_URL,
        width: 1,
        height: 1,
      }),
    ).toMatchObject({ kind: 'image', name: 'Initials', width: 1 });
  });

  it('refuses a record with any field wrong', () => {
    const bad: unknown[] = [
      null,
      'typed',
      typed('has space', 1),
      typed('a', Number.NaN),
      typed('a', -1),
      typed('a', 1, { name: 'x'.repeat(61) }),
      typed('a', 1, { text: '   ' }),
      { id: 'a', createdAt: 1, kind: 'drawn', strokes: [] },
      { id: 'a', createdAt: 1, kind: 'drawn', strokes: [[1, 2, 3]] },
      { id: 'a', createdAt: 1, kind: 'drawn', strokes: [[1, 2, 9999, 4]] },
      { id: 'a', createdAt: 1, kind: 'drawn', strokes: [[1, 'x']] },
      {
        id: 'a',
        createdAt: 1,
        kind: 'image',
        dataUrl: 'data:image/gif;base64,AAAA',
        width: 1,
        height: 1,
      },
      { id: 'a', createdAt: 1, kind: 'image', dataUrl: 'javascript:alert(1)', width: 1, height: 1 },
      { id: 'a', createdAt: 1, kind: 'image', dataUrl: PNG_URL, width: 0, height: 1 },
      { id: 'a', createdAt: 1, kind: 'image', dataUrl: PNG_URL, width: 1.5, height: 1 },
      { id: 'a', createdAt: 1, kind: 'svg' },
    ];
    for (const record of bad)
      expect(parseSavedSignature(record), JSON.stringify(record)).toBeNull();
  });

  it('keeps drawn points to a tenth of a pad unit', () => {
    const ink = drawnInk([
      [
        { x: 1.234, y: 5.678 },
        { x: 10.05, y: 20 },
      ],
      [],
    ]);
    expect(ink).toEqual({ kind: 'drawn', strokes: [[1.2, 5.7, 10.1, 20]] });
    expect(parseSignatureInk(ink)).toEqual(ink);
  });
});

describe('the store', () => {
  it('drops invalid records on load, deletes them, and keeps the newest five', async () => {
    backend = memorySignatureBackend([
      typed('a', 1),
      typed('b', 2),
      typed('c', 3),
      typed('d', 4),
      typed('e', 5),
      typed('f', 6),
      { id: 'broken', createdAt: 7, kind: 'typed' },
    ]);
    setSignatureBackend(backend);
    await loadSavedSignatures();
    const { signatures, status } = useSavedSignatures.getState();
    expect(status).toBe('ready');
    expect(signatures.map((s) => s.id)).toEqual(['f', 'e', 'd', 'c', 'b']);
    await saveSignature({ kind: 'typed', text: 'flush' });
    const stored = (await backend.list()) as SavedSignature[];
    expect(stored.map((s) => s.id)).not.toContain('broken');
    expect(stored.map((s) => s.id)).not.toContain('a');
  });

  it('keeps newest first, and a sixth replaces the oldest', async () => {
    const kept: string[] = [];
    for (let i = 0; i < SAVED_SIGNATURE_LIMIT + 1; i += 1) {
      const saved = await saveSignature({ kind: 'typed', text: `Name ${i}` });
      if (saved) kept.push(saved.id);
    }
    const { signatures } = useSavedSignatures.getState();
    expect(signatures).toHaveLength(SAVED_SIGNATURE_LIMIT);
    expect(signatures.map((s) => s.id)).toEqual(kept.slice(1).reverse());
    const stored = (await backend.list()) as SavedSignature[];
    expect(stored).toHaveLength(SAVED_SIGNATURE_LIMIT);
    expect(stored.map((s) => s.id)).not.toContain(kept[0]);
  });

  it('keeps nothing in a window without storage', async () => {
    setSignatureBackend(null);
    await loadSavedSignatures();
    expect(useSavedSignatures.getState().status).toBe('refused');
    expect(await saveSignature({ kind: 'typed', text: 'Ada' })).toBeNull();
    expect(useSavedSignatures.getState().signatures).toEqual([]);
  });

  it('stops keeping, and says so, when a write fails', async () => {
    setSignatureBackend({
      ...memorySignatureBackend(),
      put: () => Promise.reject(new Error('quota')),
    });
    expect(await saveSignature({ kind: 'typed', text: 'Ada' })).toBeNull();
    expect(useSavedSignatures.getState().status).toBe('refused');
  });

  it('renames, removes and puts back in place', async () => {
    const first = await saveSignature({ kind: 'typed', text: 'One' });
    const second = await saveSignature({ kind: 'typed', text: 'Two' }, 'Initials');
    if (!first || !second) throw new Error('not saved');
    expect(signatureLabel(second)).toBe('Initials');
    expect(signatureLabel(first)).toMatch(/^Signature, added /);

    await renameSignature(first.id, '  Full name ');
    expect(useSavedSignatures.getState().signatures[1]?.name).toBe('Full name');
    expect(((await backend.list()) as SavedSignature[]).find((s) => s.id === first.id)?.name).toBe(
      'Full name',
    );

    const removed = await removeSignature(first.id);
    expect(useSavedSignatures.getState().signatures.map((s) => s.id)).toEqual([second.id]);
    expect(await backend.list()).toHaveLength(1);
    if (!removed) throw new Error('not removed');
    await restoreSignature(removed);
    expect(useSavedSignatures.getState().signatures.map((s) => s.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(await backend.list()).toHaveLength(2);
  });

  it('Clear removes every saved signature for good', async () => {
    await saveSignature({ kind: 'typed', text: 'One' });
    await saveSignature({ kind: 'typed', text: 'Two' });
    expect(await clearSignatures()).toBe(true);
    expect(useSavedSignatures.getState().signatures).toEqual([]);
    expect(await backend.list()).toEqual([]);
    // A fresh page reads nothing back.
    setSignatureBackend(backend);
    await loadSavedSignatures();
    expect(useSavedSignatures.getState().signatures).toEqual([]);
  });
});

describe('IndexedDB', () => {
  it('round-trips records through a database made from nothing', async () => {
    const name = `pdf-editor:signatures:test-${crypto.randomUUID()}`;
    const db = indexedDbSignatureBackend(indexedDB, name);
    const record = parseSavedSignature({
      id: 'abc',
      createdAt: 5,
      kind: 'drawn',
      strokes: [[1, 2, 3, 4]],
    }) as SavedSignature;
    await db.put(record);
    await db.put(parseSavedSignature(typed('def', 6)) as SavedSignature);
    expect(((await db.list()) as SavedSignature[]).map((r) => r.id).sort()).toEqual(['abc', 'def']);
    await db.remove('abc');
    expect(((await db.list()) as SavedSignature[]).map((r) => r.id)).toEqual(['def']);
    await db.clear();
    expect(await db.list()).toEqual([]);
    indexedDB.deleteDatabase(name);
  });
});

describe('rendering and arming', () => {
  it('renders each kind as the image placed on a page', async () => {
    const drawn = await renderInk(
      drawnInk([
        [
          { x: 10, y: 10 },
          { x: 100, y: 60 },
        ],
      ]),
    );
    expect(drawn).toMatchObject({ kind: 'signature' });
    expect(drawn?.blob?.type).toBe('image/png');
    const word = await renderInk({ kind: 'typed', text: 'Ada' });
    expect(word?.blob?.type).toBe('image/png');
    expect(word?.width).toBeGreaterThan(word?.height ?? 0);
    const image = await renderInk({ kind: 'image', dataUrl: PNG_URL, width: 1, height: 1 });
    expect(image).toMatchObject({ kind: 'signature', width: 1, height: 1 });
    expect(image?.blob?.type).toBe('image/png');
    expect(new Uint8Array(await (image?.blob as Blob).arrayBuffer()).slice(1, 4)).toEqual(
      new Uint8Array([0x50, 0x4e, 0x47]),
    );
  });

  it('arms a saved signature as the one-shot signature tool, and knows which is armed', async () => {
    const one = await saveSignature({ kind: 'typed', text: 'One' });
    const two = await saveSignature({ kind: 'typed', text: 'Two' });
    if (!one || !two) throw new Error('not saved');
    expect(await armSavedSignature(one.id)).toBe(true);
    const { mode } = useToolStore.getState();
    const { pendingStamp } = useAnnotationStore.getState();
    expect(mode).toBe('signature');
    expect(pendingStamp?.kind).toBe('signature');
    expect(armedSavedSignature(mode, pendingStamp)).toBe(one.id);
    await armSavedSignature(two.id);
    expect(
      armedSavedSignature(useToolStore.getState().mode, useAnnotationStore.getState().pendingStamp),
    ).toBe(two.id);
    // The same stamp each time: arming again does not render again.
    const stamp = useAnnotationStore.getState().pendingStamp;
    await armSavedSignature(two.id);
    expect(useAnnotationStore.getState().pendingStamp).toBe(stamp);
    expect(armedSavedSignature('select', stamp)).toBeNull();
  });
});
