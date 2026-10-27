/**
 * The My info lock (PRD-38): lock, unlock, a wrong passphrase that keeps the data, lock now,
 * remove the lock, the stored shape (fresh IV per write, nothing readable), Forget dropping the
 * key, and no network call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isLockRecord, isUnlocked, lock, lockNow, removeLock, unlock } from './my-info-lock';
import {
  forgetMyInfo,
  loadMyInfo,
  type MyInfoBackend,
  memoryMyInfoBackend,
  saveMyInfo,
  setMyInfoBackend,
  useMyInfo,
} from './my-info';

let backend: MyInfoBackend;

beforeEach(async () => {
  backend = memoryMyInfoBackend();
  setMyInfoBackend(backend);
  await saveMyInfo({ fields: { givenName: 'Ayşe', email: 'ayse@example.com' } });
});

afterEach(() => {
  setMyInfoBackend(undefined);
  vi.restoreAllMocks();
});

const stored = async () => (await backend.get()) as Record<string, unknown>;

describe('lock', () => {
  it('seals the stored record and shows nothing readable', async () => {
    await lock('correct horse');
    const record = await stored();
    expect(isLockRecord(record)).toBe(true);
    expect(record).toMatchObject({ v: 1, lock: 'pbkdf2-aesgcm' });
    expect(Object.keys(record).sort()).toEqual(['data', 'iv', 'lock', 'salt', 'v']);
    expect(JSON.stringify(record)).not.toMatch(/Ayşe|ayse@/);
    expect(atob(record.salt as string)).toHaveLength(16);
    expect(atob(record.iv as string)).toHaveLength(12);
    expect(useMyInfo.getState()).toMatchObject({ status: 'ready', lockEnabled: true });
    expect(isUnlocked()).toBe(true);
  });

  it('uses a fresh IV on every write and keeps the salt', async () => {
    await lock('correct horse');
    const first = await stored();
    await saveMyInfo({ fields: { givenName: 'Ayşe', city: 'İzmir' } });
    const second = await stored();
    expect(second.iv).not.toBe(first.iv);
    expect(second.salt).toBe(first.salt);
    expect(second.data).not.toBe(first.data);
  });

  it('refuses an empty passphrase and a second lock', async () => {
    await expect(lock('')).rejects.toMatchObject({ code: 'empty-passphrase' });
    await lock('pw');
    await expect(lock('pw')).rejects.toMatchObject({ code: 'already-locked' });
  });
});

describe('unlock', () => {
  it('lockNow empties memory, then the passphrase brings the profile back', async () => {
    await lock('correct horse');
    lockNow();
    expect(isUnlocked()).toBe(false);
    expect(useMyInfo.getState()).toMatchObject({ status: 'locked', lockEnabled: true });
    expect(useMyInfo.getState().profile.fields).toEqual({});
    await expect(saveMyInfo({ fields: { city: 'x' } })).rejects.toMatchObject({ code: 'locked' });
    await unlock('correct horse');
    expect(useMyInfo.getState().status).toBe('ready');
    expect(useMyInfo.getState().profile.fields).toEqual({
      givenName: 'Ayşe',
      email: 'ayse@example.com',
    });
  });

  it('opens after a page reload from the stored record', async () => {
    await lock('correct horse');
    setMyInfoBackend(backend);
    await loadMyInfo();
    expect(useMyInfo.getState().status).toBe('locked');
    await unlock('correct horse');
    expect(useMyInfo.getState().profile.fields.givenName).toBe('Ayşe');
  });

  it('a wrong passphrase rejects and keeps the data', async () => {
    await lock('correct horse');
    const before = await stored();
    lockNow();
    await expect(unlock('wrong')).rejects.toMatchObject({ code: 'wrong-passphrase' });
    expect(useMyInfo.getState().status).toBe('locked');
    expect(isUnlocked()).toBe(false);
    expect(await stored()).toEqual(before);
    await unlock('correct horse');
    expect(useMyInfo.getState().profile.fields.givenName).toBe('Ayşe');
  });

  it('refuses when nothing is locked', async () => {
    await expect(unlock('x')).rejects.toMatchObject({ code: 'not-locked' });
  });
});

describe('removeLock', () => {
  it('needs the right passphrase, then stores the record plain again', async () => {
    await lock('correct horse');
    await expect(removeLock('wrong')).rejects.toMatchObject({ code: 'wrong-passphrase' });
    expect(isLockRecord(await stored())).toBe(true);
    expect(useMyInfo.getState().lockEnabled).toBe(true);
    await removeLock('correct horse');
    expect(isUnlocked()).toBe(false);
    expect(useMyInfo.getState()).toMatchObject({ status: 'ready', lockEnabled: false });
    expect(await stored()).toMatchObject({ v: 1, fields: { givenName: 'Ayşe' } });
  });

  it('works while locked too', async () => {
    await lock('pw');
    lockNow();
    await removeLock('pw');
    expect(useMyInfo.getState().profile.fields.givenName).toBe('Ayşe');
  });
});

describe('forget and network', () => {
  it('Forget drops the key and the sealed record', async () => {
    await lock('pw');
    await forgetMyInfo();
    expect(isUnlocked()).toBe(false);
    expect(await backend.get()).toBeUndefined();
    expect(useMyInfo.getState()).toMatchObject({ status: 'ready', lockEnabled: false });
  });

  it('makes no network call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const open = vi.spyOn(XMLHttpRequest.prototype, 'open');
    const send = vi.spyOn(XMLHttpRequest.prototype, 'send');
    await lock('pw');
    lockNow();
    await unlock('pw');
    await removeLock('pw');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
