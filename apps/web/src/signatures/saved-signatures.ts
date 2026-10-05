/**
 * Saved signatures (ADR-0032 §2 item 10; flows.md §5.4; components/03-markup.md MK-12, MK-13;
 * 07-sheets.md S3 §6; spec redesign D0-11, X26): up to five signatures kept on this device, so
 * placing one is a press, not a drawing (J8A).
 *
 * - **Kinds** are the three today's signature tool makes: **drawn** (the pad's strokes, kept as
 *   vectors in pad units, 440 × 160), **typed** (the text, drawn in the UI font when used) and
 *   **image** (the picked PNG or JPEG as a data URL, with its pixel size). Each has an optional
 *   name; without one it is "Signature, added 3 Oct".
 * - **Storage.** IndexedDB database `pdf-editor:signatures:v1`, one record per signature. Every
 *   record is validated field by field on read (`parseSavedSignature`); an invalid one is
 *   dropped and deleted, and a list over the cap loses its oldest. Where IndexedDB is refused
 *   (some private windows) nothing is kept: `status` is `refused`, the chips are absent and New
 *   signature says so (MK-12 §4).
 * - **Order and cap.** Newest first; a sixth replaces the oldest (MK-13 §4).
 * - **Written only into the PDFs they sign.** Placing one copies its rendered image into the
 *   document as an edit blob (`useWorkspaceStore.editBlobs`, kept by D0-7's snapshots), so a
 *   kept snapshot never depends on this store: removing or clearing a saved signature leaves
 *   every placed one, and every restored session, as it was.
 * - **Arming** (MK-12 §6): `armSavedSignature` renders the signature once (cached per record)
 *   and arms it as the one-shot signature tool; `armedSavedSignature` reads which one is armed.
 */
import { create } from 'zustand';

import { type PendingStamp, useAnnotationStore } from '../annotations/annotation-store';
import { drawnSignature, typedSignature } from '../annotations/stamps';
import { getLocale, m } from '../i18n';
import { announce } from '../shell/announcer';
import { useToolStore } from '../viewer/tool-store';

/** The IndexedDB database (spec X26: the `pdf-editor` prefix, versioned). */
export const SAVED_SIGNATURES_DB = 'pdf-editor:signatures:v1';
const STORE = 'signatures';
const DB_VERSION = 1;

/** At most five per device (ADR-0032 §2 item 10). */
export const SAVED_SIGNATURE_LIMIT = 5;

/** The pad's own units: strokes are kept in them whatever size the pad is drawn at. */
export const PAD_WIDTH = 440;
export const PAD_HEIGHT = 160;

/** Limits a stored record must keep to be read back. */
export const NAME_MAX = 60;
export const TYPED_MAX = 80;
const STROKES_MAX = 400;
const POINTS_MAX = 20_000;
/** Strokes may leave the pad by a little (a pen lifted past its edge). */
const PAD_SLACK = 60;
/** A kept image's data URL stays under this many characters (about 2.2 MB of image). */
export const DATA_URL_MAX = 3_000_000;
const IMAGE_SIDE_MAX = 8192;

/** What a signature is made of. */
export type SignatureInk =
  | {
      readonly kind: 'drawn';
      /** Each stroke as flat x, y pairs in pad units, rounded to 0.1. */
      readonly strokes: readonly (readonly number[])[];
    }
  | { readonly kind: 'typed'; readonly text: string }
  | {
      readonly kind: 'image';
      /** `data:image/png;base64,…` or `data:image/jpeg;base64,…`. */
      readonly dataUrl: string;
      readonly width: number;
      readonly height: number;
    };

export type SavedSignature = SignatureInk & {
  readonly id: string;
  /** When it was kept (ms since the epoch); the list is newest first. */
  readonly createdAt: number;
  /** The person's name for it; empty when none was given. */
  readonly name: string;
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const DATA_URL = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function validStrokes(value: unknown): value is number[][] {
  if (!Array.isArray(value) || value.length === 0 || value.length > STROKES_MAX) return false;
  let points = 0;
  for (const stroke of value as unknown[]) {
    if (!Array.isArray(stroke) || stroke.length < 2 || stroke.length % 2 !== 0) return false;
    const coordinates = stroke as unknown[];
    points += stroke.length / 2;
    if (points > POINTS_MAX) return false;
    for (let i = 0; i < stroke.length; i += 2) {
      const x = coordinates[i];
      const y = coordinates[i + 1];
      if (!finite(x) || !finite(y)) return false;
      if (x < -PAD_SLACK || x > PAD_WIDTH + PAD_SLACK) return false;
      if (y < -PAD_SLACK || y > PAD_HEIGHT + PAD_SLACK) return false;
    }
  }
  return true;
}

const side = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= IMAGE_SIDE_MAX;

/** The ink of a record or of what New signature made, or null when it is not one. */
export function parseSignatureInk(value: unknown): SignatureInk | null {
  if (!isRecord(value)) return null;
  switch (value.kind) {
    case 'drawn':
      return validStrokes(value.strokes)
        ? { kind: 'drawn', strokes: value.strokes.map((s) => [...s]) }
        : null;
    case 'typed': {
      if (typeof value.text !== 'string') return null;
      const text = value.text.trim();
      return text.length > 0 && text.length <= TYPED_MAX ? { kind: 'typed', text } : null;
    }
    case 'image':
      return typeof value.dataUrl === 'string' &&
        value.dataUrl.length <= DATA_URL_MAX &&
        DATA_URL.test(value.dataUrl) &&
        side(value.width) &&
        side(value.height)
        ? { kind: 'image', dataUrl: value.dataUrl, width: value.width, height: value.height }
        : null;
    default:
      return null;
  }
}

/** A stored record as a saved signature, checked field by field; null when any is wrong. */
export function parseSavedSignature(value: unknown): SavedSignature | null {
  if (!isRecord(value)) return null;
  const { id, createdAt, name } = value;
  if (typeof id !== 'string' || !SAFE_ID.test(id)) return null;
  if (!finite(createdAt) || createdAt <= 0) return null;
  if (name !== undefined && (typeof name !== 'string' || name.length > NAME_MAX)) return null;
  const ink = parseSignatureInk(value);
  if (!ink) return null;
  return { ...ink, id, createdAt, name: (name ?? '').trim() };
}

/** Rounds a drawn signature's points to 0.1 pad units (what is kept). */
export function drawnInk(strokes: readonly (readonly { x: number; y: number }[])[]): SignatureInk {
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    kind: 'drawn',
    strokes: strokes
      .filter((s) => s.length > 0)
      .map((s) => s.flatMap((p) => [round(p.x), round(p.y)])),
  };
}

/** A drawn signature's strokes as points, for the pad and the renderer. */
export function strokePoints(ink: { readonly strokes: readonly (readonly number[])[] }) {
  return ink.strokes.map((stroke) => {
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i + 1 < stroke.length; i += 2) {
      points.push({ x: stroke[i] as number, y: stroke[i + 1] as number });
    }
    return points;
  });
}

// ---------------------------------------------------------------------------
// Backends
// ---------------------------------------------------------------------------

/** Where saved signatures live; tests pass their own. */
export interface SignatureBackend {
  list(): Promise<unknown[]>;
  put(signature: SavedSignature): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export function memorySignatureBackend(initial: readonly unknown[] = []): SignatureBackend {
  const records = new Map<string, unknown>();
  for (const record of initial) {
    if (isRecord(record) && typeof record.id === 'string') records.set(record.id, record);
  }
  return {
    list: () => Promise.resolve([...records.values()]),
    put: (signature) => {
      records.set(signature.id, signature);
      return Promise.resolve();
    },
    remove: (id) => {
      records.delete(id);
      return Promise.resolve();
    },
    clear: () => {
      records.clear();
      return Promise.resolve();
    },
  };
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

/**
 * The IndexedDB backend. The connection closes when another tab or a reset asks to upgrade or
 * delete the database, and reopens on the next use.
 */
export function indexedDbSignatureBackend(
  factory: IDBFactory = indexedDB,
  name: string = SAVED_SIGNATURES_DB,
): SignatureBackend {
  let connection: Promise<IDBDatabase> | undefined;
  const db = (): Promise<IDBDatabase> => {
    connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      const open = factory.open(name, DB_VERSION);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(STORE)) {
          open.result.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      open.onsuccess = () => {
        const result = open.result;
        result.onversionchange = () => {
          result.close();
          connection = undefined;
        };
        result.onclose = () => {
          connection = undefined;
        };
        resolve(result);
      };
      open.onerror = () => reject(open.error ?? new Error('IndexedDB open failed'));
      open.onblocked = () => reject(new Error('IndexedDB open blocked'));
    }).catch((error: unknown) => {
      connection = undefined;
      throw error;
    });
    return connection;
  };
  const write = async (run: (store: IDBObjectStore) => void): Promise<void> => {
    const tx = (await db()).transaction(STORE, 'readwrite');
    const done = transactionDone(tx);
    run(tx.objectStore(STORE));
    await done;
  };
  return {
    list: async () =>
      request((await db()).transaction(STORE, 'readonly').objectStore(STORE).getAll()),
    put: (signature) => write((store) => store.put({ ...signature })),
    remove: (id) => write((store) => store.delete(id)),
    clear: () => write((store) => store.clear()),
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export type SavedSignaturesStatus = 'loading' | 'ready' | 'refused';

interface SavedSignaturesState {
  /** Newest first, at most `SAVED_SIGNATURE_LIMIT`. */
  readonly signatures: readonly SavedSignature[];
  /** `refused`: this window keeps nothing (IndexedDB is unavailable or failed). */
  readonly status: SavedSignaturesStatus;
}

const INITIAL: SavedSignaturesState = { signatures: [], status: 'loading' };

export const useSavedSignatures = create<SavedSignaturesState>(() => INITIAL);

let backend: SignatureBackend | null | undefined;
let loading: Promise<void> | undefined;
/** Writes run one after another, so a cap never deletes what a later put just wrote. */
let queue: Promise<void> = Promise.resolve();
/** Bumped by every clear and backend change: a read begun earlier shows nothing. */
let generation = 0;

function defaultBackend(): SignatureBackend | null {
  try {
    if (typeof indexedDB !== 'undefined') return indexedDbSignatureBackend();
  } catch {
    // Refused: nothing is kept in this window.
  }
  return null;
}

const store = (): SignatureBackend | null => {
  if (backend === undefined) backend = defaultBackend();
  return backend;
};

/** Stored records that failed: the window stops keeping, and says so. */
function refuse(): void {
  backend = null;
  useSavedSignatures.setState({ status: 'refused' });
}

function enqueue(run: (target: SignatureBackend) => Promise<void>): Promise<boolean> {
  let ok = true;
  queue = queue
    .then(() => {
      const target = store();
      if (!target) {
        ok = false;
        return;
      }
      return run(target);
    })
    .catch(() => {
      ok = false;
      refuse();
    });
  return queue.then(() => ok);
}

/**
 * Uses `next` for storage from now on and forgets the loaded list (tests). `null` is a window
 * that keeps nothing.
 */
export function setSignatureBackend(next: SignatureBackend | null | undefined): void {
  backend = next;
  generation += 1;
  loading = undefined;
  queue = Promise.resolve();
  forgetStamps();
  useSavedSignatures.setState(INITIAL);
}

function sortNewestFirst(list: readonly SavedSignature[]): SavedSignature[] {
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Reads the stored signatures once per page (later calls share the first read). Invalid
 * records are dropped and deleted; a list over the cap loses its oldest.
 */
export function loadSavedSignatures(): Promise<void> {
  loading ??= (async () => {
    const started = generation;
    const target = store();
    if (!target) {
      useSavedSignatures.setState({ signatures: [], status: 'refused' });
      return;
    }
    let records: unknown[];
    try {
      records = await target.list();
    } catch {
      if (generation === started) refuse();
      return;
    }
    if (generation !== started) return;
    const valid: SavedSignature[] = [];
    const invalid: string[] = [];
    for (const record of records) {
      const signature = parseSavedSignature(record);
      if (signature) valid.push(signature);
      else if (isRecord(record) && typeof record.id === 'string') invalid.push(record.id);
    }
    const sorted = sortNewestFirst(valid);
    const over = sorted.splice(SAVED_SIGNATURE_LIMIT).map((s) => s.id);
    useSavedSignatures.setState({ signatures: sorted, status: 'ready' });
    const gone = [...invalid, ...over];
    if (gone.length > 0) {
      void enqueue(async (b) => {
        for (const id of gone) await b.remove(id);
      });
    }
  })();
  return loading;
}

const newId = (): string => globalThis.crypto.randomUUID().replaceAll('-', '');

function cleanName(name: string | undefined): string {
  return (name ?? '').trim().slice(0, NAME_MAX);
}

/**
 * Keeps a new signature, newest first; at the cap the oldest goes (MK-13 §4). Resolves to the
 * kept signature, or null when this window keeps nothing or the write failed.
 */
export async function saveSignature(
  ink: SignatureInk,
  name?: string,
): Promise<SavedSignature | null> {
  await loadSavedSignatures();
  const valid = parseSignatureInk(ink);
  if (!valid || useSavedSignatures.getState().status !== 'ready') return null;
  const { signatures } = useSavedSignatures.getState();
  const newest = signatures[0]?.createdAt ?? 0;
  const signature: SavedSignature = {
    ...valid,
    id: newId(),
    // Strictly after the newest, so two saved in one millisecond keep their order.
    createdAt: Math.max(Date.now(), newest + 1),
    name: cleanName(name),
  };
  const next = [signature, ...signatures];
  const dropped = next.splice(SAVED_SIGNATURE_LIMIT);
  useSavedSignatures.setState({ signatures: next });
  for (const old of dropped) forgetStamp(old.id);
  const ok = await enqueue(async (b) => {
    await b.put(signature);
    for (const old of dropped) await b.remove(old.id);
  });
  return ok ? signature : null;
}

/** Gives a saved signature a name (empty clears it). */
export async function renameSignature(id: string, name: string): Promise<boolean> {
  const { signatures } = useSavedSignatures.getState();
  const found = signatures.find((s) => s.id === id);
  if (!found) return false;
  const renamed: SavedSignature = { ...found, name: cleanName(name) };
  useSavedSignatures.setState({
    signatures: signatures.map((s) => (s.id === id ? renamed : s)),
  });
  return enqueue((b) => b.put(renamed));
}

/** Removes one; resolves to what was removed, for Undo (`restoreSignature`). */
export async function removeSignature(id: string): Promise<SavedSignature | null> {
  const { signatures } = useSavedSignatures.getState();
  const found = signatures.find((s) => s.id === id);
  if (!found) return null;
  useSavedSignatures.setState({ signatures: signatures.filter((s) => s.id !== id) });
  forgetStamp(id);
  await enqueue((b) => b.remove(id));
  return found;
}

/**
 * Puts a removed signature back in its place (the Undo of a removal). At the cap, which only
 * a signature kept meanwhile can cause, the oldest goes as for any new one.
 */
export async function restoreSignature(signature: SavedSignature): Promise<boolean> {
  const { signatures, status } = useSavedSignatures.getState();
  if (status !== 'ready' || signatures.some((s) => s.id === signature.id)) return false;
  const next = sortNewestFirst([...signatures, signature]);
  const dropped = next.splice(SAVED_SIGNATURE_LIMIT);
  useSavedSignatures.setState({ signatures: next });
  return enqueue(async (b) => {
    if (!dropped.includes(signature)) await b.put(signature);
    for (const old of dropped) if (old !== signature) await b.remove(old.id);
  });
}

/**
 * Deletes every saved signature on this device (Settings → Saved signatures → Remove all…).
 * Final: nothing is kept to undo it. Placed signatures stay in their documents.
 */
export async function clearSignatures(): Promise<boolean> {
  generation += 1;
  useSavedSignatures.setState((s) => ({ signatures: [], status: s.status }));
  forgetStamps();
  return enqueue((b) => b.clear());
}

// ---------------------------------------------------------------------------
// Rendering and arming
// ---------------------------------------------------------------------------

/** The ink colour every signature is drawn in today (the signature tool's navy). */
export const SIGNATURE_INK = '#1A237E';

function dataUrlBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const type = dataUrl.slice(5, dataUrl.indexOf(';'));
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** A signature's ink as the image placed on a page (PNG or JPEG; MK-13). */
export async function renderInk(ink: SignatureInk): Promise<PendingStamp | undefined> {
  switch (ink.kind) {
    case 'drawn':
      return drawnSignature(strokePoints(ink), SIGNATURE_INK);
    case 'typed':
      return typedSignature(ink.text, SIGNATURE_INK);
    case 'image':
      return {
        kind: 'signature',
        blob: dataUrlBlob(ink.dataUrl),
        width: ink.width,
        height: ink.height,
      };
  }
}

/** Rendered stamps by signature id: the same stamp each time, so the armed one is known. */
const stamps = new Map<string, Promise<PendingStamp | undefined>>();
const rendered = new Map<string, PendingStamp>();

function forgetStamp(id: string): void {
  stamps.delete(id);
  rendered.delete(id);
}

function forgetStamps(): void {
  stamps.clear();
  rendered.clear();
}

/** The stamp a saved signature places, rendered once. */
export function stampOfSignature(signature: SavedSignature): Promise<PendingStamp | undefined> {
  let stamp = stamps.get(signature.id);
  if (!stamp) {
    stamp = renderInk(signature).then((result) => {
      if (result) rendered.set(signature.id, result);
      return result;
    });
    stamps.set(signature.id, stamp);
  }
  return stamp;
}

/** Arms a stamp as the one-shot signature tool (MK-12 §6), as the old dialog's Use did. */
export function armSignatureStamp(stamp: PendingStamp): void {
  const annotations = useAnnotationStore.getState();
  annotations.setPendingStamp(stamp);
  annotations.select(null);
  useToolStore.getState().setMode('signature');
  announce(m.annot_place_signature());
}

/** Arms a saved signature: a click or drag on a page places it, then Select returns. */
export async function armSavedSignature(id: string): Promise<boolean> {
  const signature = useSavedSignatures.getState().signatures.find((s) => s.id === id);
  if (!signature) return false;
  const stamp = await stampOfSignature(signature);
  if (!stamp) return false;
  armSignatureStamp(stamp);
  return true;
}

/** The saved signature armed now, by id (its chip shows pressed), or null. */
export function armedSavedSignature(mode: string, pending: PendingStamp | null): string | null {
  if (mode !== 'signature' || !pending) return null;
  for (const [id, stamp] of rendered) if (stamp === pending) return id;
  return null;
}

/** "Signature, added 3 Oct", or the signature's own name. */
export function signatureLabel(signature: SavedSignature): string {
  if (signature.name) return signature.name;
  return m.signature_saved_label({ date: signatureDate(signature) });
}

/** The day a signature was kept, short: "3 Oct" / "3 Eki". */
export function signatureDate(signature: SavedSignature): string {
  return new Intl.DateTimeFormat(getLocale(), { day: 'numeric', month: 'short' }).format(
    signature.createdAt,
  );
}
