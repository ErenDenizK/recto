/**
 * The optional lock on My info (PRD-38). WebCrypto only, no dependency: PBKDF2-SHA-256 with
 * 600,000 iterations and a 16-byte salt derives a non-extractable AES-GCM-256 key; every write
 * uses a fresh 12-byte IV. The stored record is `{v:1, lock:'pbkdf2-aesgcm', salt, iv, data}`
 * (base64). The key lives in this module's variable only: never stored, never exported, gone
 * with the tab or `lockNow()`. A wrong passphrase changes nothing; there is no recovery.
 */
import {
  adoptProfile,
  closeLock,
  MyInfoError,
  type MyInfoProfile,
  parseMyInfo,
  type Sealer,
  sealedRecord,
  setSealer,
  useMyInfo,
} from './my-info';

export const LOCK_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const AAD = new TextEncoder().encode('pdf-editor:my-info:v1');

export interface LockRecord {
  readonly v: 1;
  readonly lock: 'pbkdf2-aesgcm';
  readonly salt: string;
  readonly iv: string;
  readonly data: string;
}

/** The held key and the salt it came from; null while locked or when no lock is on. */
let held: { readonly key: CryptoKey; readonly salt: Uint8Array<ArrayBuffer> } | null = null;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return null;
  try {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function random(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Whether a stored record is a well-formed sealed one. */
export function isLockRecord(value: unknown): value is LockRecord {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    r.v === 1 &&
    r.lock === 'pbkdf2-aesgcm' &&
    typeof r.salt === 'string' &&
    fromBase64(r.salt)?.length === SALT_BYTES &&
    typeof r.iv === 'string' &&
    fromBase64(r.iv)?.length === IV_BYTES &&
    typeof r.data === 'string' &&
    fromBase64(r.data) !== null
  );
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  if (typeof crypto === 'undefined' || !crypto.subtle) throw new MyInfoError('unavailable');
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: LOCK_ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encrypt(
  key: CryptoKey,
  salt: Uint8Array<ArrayBuffer>,
  plain: string,
): Promise<LockRecord> {
  const iv = random(IV_BYTES);
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: AAD },
    key,
    new TextEncoder().encode(plain),
  );
  return {
    v: 1,
    lock: 'pbkdf2-aesgcm',
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(data)),
  };
}

/** Decrypts a record with a passphrase; throws `wrong-passphrase` when it does not open. */
async function open(
  record: LockRecord,
  passphrase: string,
): Promise<{ key: CryptoKey; salt: Uint8Array<ArrayBuffer>; profile: MyInfoProfile }> {
  const salt = fromBase64(record.salt);
  const iv = fromBase64(record.iv);
  const data = fromBase64(record.data);
  if (!salt || !iv || !data) throw new MyInfoError('wrong-passphrase');
  const key = await deriveKey(passphrase, salt);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: AAD },
      key,
      data,
    );
    const profile = parseMyInfo(JSON.parse(new TextDecoder().decode(plain)) as unknown);
    return { key, salt, profile };
  } catch {
    throw new MyInfoError('wrong-passphrase');
  }
}

function sealerFor(key: CryptoKey, salt: Uint8Array<ArrayBuffer>): Sealer {
  const mine = { key, salt };
  held = mine;
  return {
    seal: (plain) => encrypt(mine.key, mine.salt, plain),
    drop: () => {
      if (held === mine) held = null;
    },
  };
}

/** Whether the key is held now (the lock is on and open). */
export const isUnlocked = (): boolean => held !== null;

/** Turns the lock on: the profile is sealed with a key from `passphrase`. */
export async function lock(passphrase: string): Promise<void> {
  if (passphrase.length === 0) throw new MyInfoError('empty-passphrase');
  const state = useMyInfo.getState();
  if (state.lockEnabled) throw new MyInfoError('already-locked');
  if (state.status !== 'ready')
    throw new MyInfoError(state.status === 'locked' ? 'locked' : 'refused');
  const salt = random(SALT_BYTES);
  const key = await deriveKey(passphrase, salt);
  if (!(await setSealer(sealerFor(key, salt)))) {
    await setSealer(null);
    throw new MyInfoError('refused');
  }
}

/** Opens a locked store. A wrong passphrase rejects and keeps the data. */
export async function unlock(passphrase: string): Promise<void> {
  if (useMyInfo.getState().status !== 'locked') throw new MyInfoError('not-locked');
  const record = sealedRecord();
  if (!isLockRecord(record)) throw new MyInfoError('wrong-passphrase');
  const { key, salt, profile } = await open(record, passphrase);
  adoptProfile(profile, sealerFor(key, salt));
}

/** Closes an open lock now: the key and the profile leave memory. */
export function lockNow(): void {
  if (useMyInfo.getState().lockEnabled) closeLock();
}

/** Turns the lock off, after checking the passphrase; the record is stored plain again. */
export async function removeLock(passphrase: string): Promise<void> {
  const state = useMyInfo.getState();
  if (!state.lockEnabled) throw new MyInfoError('not-locked');
  const record = sealedRecord();
  if (!isLockRecord(record)) throw new MyInfoError('wrong-passphrase');
  const { profile } = await open(record, passphrase);
  adoptProfile(profile, null);
  if (!(await setSealer(null))) throw new MyInfoError('refused');
}
