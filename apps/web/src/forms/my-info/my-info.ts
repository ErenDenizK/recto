/**
 * My info (BM-4, PRD-37): one profile, "Me", kept on this device only, so a form can be filled
 * from it in one step. This module is the store; the optional lock is `my-info-lock.ts`.
 *
 * - **Fields.** Fourteen text fields plus the T.C. Kimlik No. Every one is optional and
 *   trimmed with a length limit. The ID number is off unless `keepNationalId` is set, and its
 *   checksum must hold (`isValidNationalId`).
 * - **Storage.** IndexedDB `pdf-editor:my-info:v1`, store `profile`, key `me`, shaped like
 *   `signatures/saved-signatures.ts`: a backend interface with a memory twin, a parse on read
 *   that drops a bad field and keeps the rest, writes one after another, and a status. Where
 *   IndexedDB is refused nothing is kept (`refused`).
 * - **Lock.** When the lock is on, the stored record is sealed (PRD-38) and `status` is
 *   `locked` until `unlock`. The sealing itself lives in `my-info-lock.ts`.
 * - **Never** goes into snapshots, Recents, export metadata, the clipboard, logs or the
 *   network. Nothing here imports the network, and nothing imports this module yet.
 * - **Forget** deletes the database and clears memory. It is final.
 */
import { create } from 'zustand';

/** The IndexedDB database (spec X26: the `pdf-editor` prefix, versioned). */
export const MY_INFO_DB = 'pdf-editor:my-info:v1';
const STORE = 'profile';
const KEY = 'me';
const DB_VERSION = 1;

/** Every field of the profile, in the order a form lists them. */
export const MY_INFO_FIELDS = [
  'givenName',
  'familyName',
  'fullName',
  'email',
  'tel',
  'birthDate',
  'street',
  'street2',
  'district',
  'city',
  'postalCode',
  'country',
  'organization',
  'jobTitle',
  'nationalId',
] as const;

export type MyInfoField = (typeof MY_INFO_FIELDS)[number];

/** Length limits, after trimming. */
export const MY_INFO_LIMITS: Readonly<Record<MyInfoField, number>> = {
  givenName: 60,
  familyName: 60,
  fullName: 120,
  email: 120,
  tel: 32,
  birthDate: 10,
  street: 120,
  street2: 120,
  district: 60,
  city: 60,
  postalCode: 16,
  country: 60,
  organization: 120,
  jobTitle: 80,
  nationalId: 11,
};

/** Only the fields that are set; an empty one is absent. */
export type MyInfoFields = Partial<Record<MyInfoField, string>>;

export interface MyInfoProfile {
  readonly fields: MyInfoFields;
  /** The "Keep my ID number" switch; without it `nationalId` is never kept. */
  readonly keepNationalId: boolean;
}

/** Why an operation was refused (typed codes; the UI words them). */
export type MyInfoErrorCode =
  | 'invalid-national-id'
  | 'locked'
  | 'refused'
  | 'wrong-passphrase'
  | 'not-locked'
  | 'already-locked'
  | 'empty-passphrase'
  | 'busy'
  | 'forgotten'
  | 'unavailable';

export class MyInfoError extends Error {
  readonly code: MyInfoErrorCode;
  constructor(code: MyInfoErrorCode) {
    super(code);
    this.name = 'MyInfoError';
    this.code = code;
  }
}

export const EMPTY_PROFILE: MyInfoProfile = { fields: {}, keepNationalId: false };

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
const CONTROL = /[\u0000-\u001f\u007f]/;

/**
 * The T.C. Kimlik No checksum: 11 digits, the first not 0,
 * d10 = ((d1+d3+d5+d7+d9) * 7 - (d2+d4+d6+d8)) mod 10 and d11 = (d1..d10) mod 10.
 */
export function isValidNationalId(value: string): boolean {
  if (!/^[1-9][0-9]{10}$/.test(value)) return false;
  const d = Array.from(value, Number);
  const odd =
    (d[0] as number) + (d[2] as number) + (d[4] as number) + (d[6] as number) + (d[8] as number);
  const even = (d[1] as number) + (d[3] as number) + (d[5] as number) + (d[7] as number);
  const tenth = (((odd * 7 - even) % 10) + 10) % 10;
  if (tenth !== d[9]) return false;
  const sum = d.slice(0, 10).reduce((a, b) => a + b, 0);
  return sum % 10 === d[10];
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 1 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** One field's value as kept (trimmed), or null when it is empty or invalid. */
export function parseMyInfoField(field: MyInfoField, value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text.length === 0 || text.length > MY_INFO_LIMITS[field] || CONTROL.test(text)) return null;
  if (field === 'birthDate' && !isIsoDate(text)) return null;
  if (field === 'nationalId' && !isValidNationalId(text)) return null;
  return text;
}

/** The fields of a record, each checked on its own: a bad one is dropped, the rest stay. */
export function parseMyInfoFields(value: unknown): MyInfoFields {
  if (!isRecord(value)) return {};
  const out: MyInfoFields = {};
  for (const field of MY_INFO_FIELDS) {
    const text = parseMyInfoField(field, value[field]);
    if (text !== null) out[field] = text;
  }
  return out;
}

/** A stored (or decrypted) profile, checked field by field. */
export function parseMyInfo(value: unknown): MyInfoProfile {
  if (!isRecord(value)) return EMPTY_PROFILE;
  const keepNationalId = value.keepNationalId === true;
  const fields = parseMyInfoFields(value.fields);
  if (!keepNationalId) delete fields.nationalId;
  return { fields, keepNationalId };
}

/** The full name: the one set, else the given and family names joined. */
export function fullNameOf(fields: MyInfoFields): string {
  return fields.fullName ?? [fields.givenName, fields.familyName].filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Backends
// ---------------------------------------------------------------------------

/** Where the profile lives; tests pass their own. The record is opaque here. */
export interface MyInfoBackend {
  get(): Promise<unknown>;
  put(record: unknown): Promise<void>;
  clear(): Promise<void>;
  /** Deletes the whole database (Forget). */
  destroy(): Promise<void>;
}

export function memoryMyInfoBackend(initial?: unknown): MyInfoBackend {
  let record: unknown = initial;
  return {
    get: () => Promise.resolve(record),
    put: (next) => {
      record = next;
      return Promise.resolve();
    },
    clear: () => {
      record = undefined;
      return Promise.resolve();
    },
    destroy: () => {
      record = undefined;
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

/** The database could not be opened: this window keeps nothing (as opposed to one failed write). */
export class StorageUnavailable extends Error {
  constructor(cause?: unknown) {
    super('storage-unavailable', { cause });
    this.name = 'StorageUnavailable';
  }
}

/** Deletes a database by name; resolves when it is gone, rejects when the delete fails. */
export function deleteMyInfoDatabase(
  factory: IDBFactory = indexedDB,
  name: string = MY_INFO_DB,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const del = factory.deleteDatabase(name);
    del.onsuccess = () => resolve();
    del.onerror = () => reject(del.error ?? new Error('IndexedDB delete failed'));
    // Blocked by another tab: its versionchange handler closes the connection and this goes on.
  });
}

/** The IndexedDB backend; the connection reopens after another tab or Forget closes it. */
export function indexedDbMyInfoBackend(
  factory: IDBFactory = indexedDB,
  name: string = MY_INFO_DB,
): MyInfoBackend {
  let connection: Promise<IDBDatabase> | undefined;
  const db = (): Promise<IDBDatabase> => {
    connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      let open: IDBOpenDBRequest;
      try {
        open = factory.open(name, DB_VERSION);
      } catch (error) {
        reject(new StorageUnavailable(error));
        return;
      }
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE);
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
      open.onerror = () => reject(new StorageUnavailable(open.error));
      open.onblocked = () => reject(new StorageUnavailable(new Error('IndexedDB open blocked')));
    }).catch((error: unknown) => {
      connection = undefined;
      throw error instanceof StorageUnavailable ? error : new StorageUnavailable(error);
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
    get: async (): Promise<unknown> =>
      request<unknown>((await db()).transaction(STORE, 'readonly').objectStore(STORE).get(KEY)),
    put: (record) => write((store) => void store.put(record, KEY)),
    clear: () => write((store) => void store.clear()),
    destroy: async () => {
      const open = connection;
      connection = undefined;
      if (open) {
        try {
          (await open).close();
        } catch {
          // It never opened; there is nothing to close.
        }
      }
      await deleteMyInfoDatabase(factory, name);
    },
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export type MyInfoStatus = 'loading' | 'ready' | 'refused' | 'locked';

interface MyInfoState {
  /** Empty while `loading`, `refused` or `locked`. */
  readonly profile: MyInfoProfile;
  /** `refused`: this window keeps nothing. `locked`: sealed, waiting for the passphrase. */
  readonly status: MyInfoStatus;
  /** The lock is on (sealed on disk), whether or not it is open now. */
  readonly lockEnabled: boolean;
  /** The last write failed (storage is still there); cleared by the next one that succeeds. */
  readonly writeError: boolean;
}

const INITIAL: MyInfoState = {
  profile: EMPTY_PROFILE,
  status: 'loading',
  lockEnabled: false,
  writeError: false,
};

export const useMyInfo = create<MyInfoState>(() => INITIAL);

/** What seals a profile while the lock is open (`my-info-lock.ts`). */
export interface Sealer {
  seal(plain: string): Promise<unknown>;
  /** Drops the key. */
  drop(): void;
}

let backend: MyInfoBackend | null | undefined;
let loading: Promise<void> | undefined;
let queue: Promise<void> = Promise.resolve();
/** Bumped by Forget and backend changes: a read begun earlier shows nothing. */
let generation = 0;
let sealer: Sealer | null = null;
/** The record last read or written while the lock is on. */
let sealed: unknown;

function defaultBackend(): MyInfoBackend | null {
  try {
    if (typeof indexedDB !== 'undefined') return indexedDbMyInfoBackend();
  } catch {
    // Refused: nothing is kept in this window.
  }
  return null;
}

const store = (): MyInfoBackend | null => {
  if (backend === undefined) backend = defaultBackend();
  return backend;
};

function refuse(): void {
  backend = null;
  useMyInfo.setState({ status: 'refused' });
}

/**
 * Runs a storage job after the ones before it. The job returns false when it chose not to write
 * (the world changed since it was queued). A failed open refuses storage; a failed write only
 * says so (`writeError`) and keeps the backend for the next try.
 */
function enqueue(run: (target: MyInfoBackend) => Promise<boolean | undefined>): Promise<boolean> {
  let ok = true;
  queue = queue
    .then(async () => {
      const target = store();
      if (!target) {
        ok = false;
        return;
      }
      if ((await run(target)) === false) {
        ok = false;
      } else if (useMyInfo.getState().writeError) {
        useMyInfo.setState({ writeError: false });
      }
    })
    .catch((error: unknown) => {
      ok = false;
      if (error instanceof StorageUnavailable) refuse();
      else useMyInfo.setState({ writeError: true });
    });
  return queue.then(() => ok);
}

/** Changes whenever Forget or a backend change makes earlier work stale. */
export const myInfoGeneration = (): number => generation;

/** Uses `next` for storage from now on and forgets what was loaded (tests). */
export function setMyInfoBackend(next: MyInfoBackend | null | undefined): void {
  sealer?.drop();
  sealer = null;
  sealed = undefined;
  backend = next;
  generation += 1;
  loading = undefined;
  queue = Promise.resolve();
  useMyInfo.setState(INITIAL);
}

function plainRecord(profile: MyInfoProfile): unknown {
  const fields = { ...profile.fields };
  if (!profile.keepNationalId) delete fields.nationalId;
  return { v: 1, fields, keepNationalId: profile.keepNationalId };
}

/** The plain text the lock seals. */
export const serializeMyInfo = (profile: MyInfoProfile): string =>
  JSON.stringify(plainRecord(profile));

/**
 * Writes the profile as it is now, sealed when the lock is open. What to write and how is fixed
 * when this is called; if Forget ran, the lock closed or the sealer changed before the job gets
 * its turn, it writes nothing (a stale job must never overwrite or recreate the record).
 */
function persist(): Promise<boolean> {
  const queued = generation;
  const { profile } = useMyInfo.getState();
  const seal = sealer;
  return enqueue(async (target) => {
    if (queued !== generation || seal !== sealer || useMyInfo.getState().status === 'locked') {
      return false;
    }
    if (seal) {
      const record = await seal.seal(serializeMyInfo(profile));
      if (queued !== generation || seal !== sealer) return false;
      await target.put(record);
      sealed = record;
    } else {
      await target.put(plainRecord(profile));
    }
    return true;
  });
}

/**
 * Reads the stored profile once per page (later calls share the first read). A bad field is
 * dropped and the cleaned record written back; a sealed record leaves the status `locked`.
 */
export function loadMyInfo(): Promise<void> {
  loading ??= (async () => {
    const started = generation;
    const target = store();
    if (!target) {
      useMyInfo.setState({ profile: EMPTY_PROFILE, status: 'refused' });
      return;
    }
    let record: unknown;
    try {
      record = await target.get();
    } catch {
      if (generation === started) refuse();
      return;
    }
    if (generation !== started) return;
    if (record === undefined) {
      useMyInfo.setState({ profile: EMPTY_PROFILE, status: 'ready', lockEnabled: false });
      return;
    }
    if (isRecord(record) && 'lock' in record) {
      sealed = record;
      useMyInfo.setState({ profile: EMPTY_PROFILE, status: 'locked', lockEnabled: true });
      return;
    }
    const profile = parseMyInfo(record);
    useMyInfo.setState({ profile, status: 'ready', lockEnabled: false });
    const clean = JSON.stringify(plainRecord(profile));
    if (JSON.stringify(record) !== clean) void persist();
  })();
  return loading;
}

/**
 * Keeps the profile. Resolves to what was kept, or null when this window keeps nothing or the
 * write failed (the profile is then held for this page only). Throws `locked` while sealed and
 * `invalid-national-id` when an ID number is kept but its checksum fails.
 */
export async function saveMyInfo(input: {
  readonly fields: Readonly<Record<string, unknown>>;
  readonly keepNationalId?: boolean;
}): Promise<MyInfoProfile | null> {
  const started = generation;
  await loadMyInfo();
  if (generation !== started) return null;
  const { status } = useMyInfo.getState();
  if (status === 'locked') throw new MyInfoError('locked');
  const keepNationalId = input.keepNationalId === true;
  const given = input.fields.nationalId;
  if (keepNationalId && typeof given === 'string' && given.trim() !== '') {
    if (!isValidNationalId(given.trim())) throw new MyInfoError('invalid-national-id');
  }
  const profile = parseMyInfo({ fields: input.fields, keepNationalId });
  if (status !== 'ready') return null;
  useMyInfo.setState({ profile });
  return (await persist()) ? profile : null;
}

/**
 * Forget: deletes the database and clears memory, the lock key included. Final. Fields already
 * filled into documents stay as they are. Resolves to false when the delete failed.
 */
export async function forgetMyInfo(): Promise<boolean> {
  generation += 1;
  sealer?.drop();
  sealer = null;
  sealed = undefined;
  const refused = useMyInfo.getState().status === 'refused';
  useMyInfo.setState({
    profile: EMPTY_PROFILE,
    status: refused ? 'refused' : 'ready',
    lockEnabled: false,
  });
  loading = Promise.resolve();
  let ok = true;
  queue = queue
    .then(async () => {
      const target = store();
      if (target) await target.destroy();
      // A refused window has no backend left, but the database may still exist: delete it.
      else if (typeof indexedDB !== 'undefined') await deleteMyInfoDatabase();
    })
    .catch((error: unknown) => {
      // A window that may not use IndexedDB at all never kept anything: nothing is left to delete.
      ok = error instanceof DOMException && error.name === 'SecurityError';
    });
  await queue;
  return ok;
}

// ---------------------------------------------------------------------------
// Seam for `my-info-lock.ts`
// ---------------------------------------------------------------------------

/** The sealed record on disk or last written, while the lock is on. */
export const sealedRecord = (): unknown => sealed;

/** Turns sealing on (a sealer) or off (null) and rewrites the record. */
export function setSealer(next: Sealer | null): Promise<boolean> {
  if (sealer && sealer !== next) sealer.drop();
  sealer = next;
  useMyInfo.setState({ lockEnabled: next !== null });
  return persist();
}

/** Opens the store with a decrypted profile (`unlock`) or after removing the lock. */
export function adoptProfile(profile: MyInfoProfile, next: Sealer | null): void {
  if (sealer && sealer !== next) sealer.drop();
  sealer = next;
  if (!next) sealed = undefined;
  useMyInfo.setState({ profile, status: 'ready', lockEnabled: next !== null });
}

/** Closes an open lock: the key and the profile leave memory, the sealed record stays. */
export function closeLock(): void {
  sealer?.drop();
  sealer = null;
  useMyInfo.setState({ profile: EMPTY_PROFILE, status: 'locked', lockEnabled: true });
}
