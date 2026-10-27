/**
 * My info store (BM-4, PRD-37): field parsing and limits, the T.C. Kimlik No checksum, a bad
 * field dropped while the rest stay, an IndexedDB round trip, a refused store, Forget, and no
 * network call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EMPTY_PROFILE,
  forgetMyInfo,
  fullNameOf,
  indexedDbMyInfoBackend,
  isValidNationalId,
  loadMyInfo,
  MY_INFO_FIELDS,
  MY_INFO_LIMITS,
  type MyInfoBackend,
  MyInfoError,
  memoryMyInfoBackend,
  parseMyInfo,
  saveMyInfo,
  setMyInfoBackend,
  useMyInfo,
} from './my-info';

const VALID_ID = '10000000146';

afterEach(() => {
  setMyInfoBackend(undefined);
  vi.restoreAllMocks();
});

describe('T.C. Kimlik No', () => {
  it('accepts numbers whose two check digits hold', () => {
    expect(isValidNationalId(VALID_ID)).toBe(true);
    expect(isValidNationalId('12345678950')).toBe(true);
  });
  it('rejects a wrong check digit, a leading zero, the wrong length and non-digits', () => {
    expect(isValidNationalId('10000000147')).toBe(false);
    expect(isValidNationalId('10000000156')).toBe(false);
    expect(isValidNationalId('00000000000')).toBe(false);
    expect(isValidNationalId('1000000014')).toBe(false);
    expect(isValidNationalId('100000001466')).toBe(false);
    expect(isValidNationalId('1000000014a')).toBe(false);
  });
});

describe('parse', () => {
  it('has the fifteen fields, each with a limit', () => {
    expect(MY_INFO_FIELDS).toHaveLength(15);
    for (const field of MY_INFO_FIELDS) expect(MY_INFO_LIMITS[field]).toBeGreaterThan(0);
  });
  it('trims, drops empty fields and over-long ones, and keeps the rest', () => {
    const profile = parseMyInfo({
      keepNationalId: false,
      fields: {
        givenName: '  Ayşe ',
        familyName: '   ',
        email: 'a'.repeat(MY_INFO_LIMITS.email + 1),
        tel: '+90 555 000 00 00',
        city: 42,
      },
    });
    expect(profile.fields).toEqual({ givenName: 'Ayşe', tel: '+90 555 000 00 00' });
  });
  it('drops a bad birth date, control characters and an invalid ID number only', () => {
    const profile = parseMyInfo({
      keepNationalId: true,
      fields: {
        birthDate: '2023-02-30',
        city: 'Ankara\u0000',
        street: 'Cadde 1',
        nationalId: '10000000147',
      },
    });
    expect(profile.fields).toEqual({ street: 'Cadde 1' });
    expect(
      parseMyInfo({ keepNationalId: false, fields: { birthDate: '1990-05-17' } }).fields,
    ).toEqual({ birthDate: '1990-05-17' });
  });
  it('never keeps the ID number unless the switch is on', () => {
    expect(parseMyInfo({ fields: { nationalId: VALID_ID } }).fields.nationalId).toBeUndefined();
    expect(
      parseMyInfo({ keepNationalId: true, fields: { nationalId: VALID_ID } }).fields.nationalId,
    ).toBe(VALID_ID);
  });
  it('reads garbage as an empty profile', () => {
    expect(parseMyInfo(null)).toBe(EMPTY_PROFILE);
    expect(parseMyInfo('x')).toBe(EMPTY_PROFILE);
    expect(parseMyInfo({ fields: 'x' }).fields).toEqual({});
  });
  it('derives the full name unless one is set', () => {
    expect(fullNameOf({ givenName: 'Ayşe', familyName: 'Yılmaz' })).toBe('Ayşe Yılmaz');
    expect(fullNameOf({ givenName: 'Ayşe', fullName: 'Ayşe N. Yılmaz' })).toBe('Ayşe N. Yılmaz');
  });
});

describe('store', () => {
  beforeEach(() => setMyInfoBackend(memoryMyInfoBackend()));

  it('starts loading, then ready and empty', async () => {
    expect(useMyInfo.getState().status).toBe('loading');
    await loadMyInfo();
    expect(useMyInfo.getState()).toMatchObject({ status: 'ready', profile: EMPTY_PROFILE });
  });

  it('saves and reads back through the backend', async () => {
    const backend = memoryMyInfoBackend();
    setMyInfoBackend(backend);
    const kept = await saveMyInfo({ fields: { givenName: ' Ayşe ', city: 'İzmir' } });
    expect(kept?.fields).toEqual({ givenName: 'Ayşe', city: 'İzmir' });
    setMyInfoBackend(backend);
    await loadMyInfo();
    expect(useMyInfo.getState().profile.fields).toEqual({ givenName: 'Ayşe', city: 'İzmir' });
  });

  it('drops a bad stored field, keeps the rest, and writes the clean record back', async () => {
    const backend = memoryMyInfoBackend({
      v: 1,
      keepNationalId: false,
      fields: { givenName: 'Ayşe', email: 'e'.repeat(500), birthDate: 'soon' },
    });
    setMyInfoBackend(backend);
    await loadMyInfo();
    expect(useMyInfo.getState().profile.fields).toEqual({ givenName: 'Ayşe' });
    await saveMyInfo({ fields: { givenName: 'Ayşe' } });
    expect(await backend.get()).toEqual({
      v: 1,
      keepNationalId: false,
      fields: { givenName: 'Ayşe' },
    });
  });

  it('rejects an invalid ID number when it is to be kept, and keeps nothing', async () => {
    await expect(
      saveMyInfo({ fields: { nationalId: '10000000147' }, keepNationalId: true }),
    ).rejects.toMatchObject({ code: 'invalid-national-id' });
    expect(useMyInfo.getState().profile.fields).toEqual({});
    const kept = await saveMyInfo({ fields: { nationalId: VALID_ID }, keepNationalId: true });
    expect(kept?.fields.nationalId).toBe(VALID_ID);
  });

  it('does not write the ID number when the switch is off', async () => {
    const backend = memoryMyInfoBackend();
    setMyInfoBackend(backend);
    await saveMyInfo({ fields: { nationalId: VALID_ID, city: 'Bursa' } });
    expect(JSON.stringify(await backend.get())).not.toContain(VALID_ID);
  });

  it('reports refused when there is no storage, and keeps nothing', async () => {
    setMyInfoBackend(null);
    await loadMyInfo();
    expect(useMyInfo.getState().status).toBe('refused');
    expect(await saveMyInfo({ fields: { city: 'Bursa' } })).toBeNull();
    expect(useMyInfo.getState().profile.fields).toEqual({});
  });

  it('reports refused when the backend fails to read or write', async () => {
    const failing: MyInfoBackend = {
      ...memoryMyInfoBackend(),
      get: () => Promise.reject(new Error('nope')),
    };
    setMyInfoBackend(failing);
    await loadMyInfo();
    expect(useMyInfo.getState().status).toBe('refused');

    setMyInfoBackend({ ...memoryMyInfoBackend(), put: () => Promise.reject(new Error('full')) });
    expect(await saveMyInfo({ fields: { city: 'Bursa' } })).toBeNull();
    expect(useMyInfo.getState().status).toBe('refused');
  });

  it('refuses to save while locked', async () => {
    setMyInfoBackend(
      memoryMyInfoBackend({ v: 1, lock: 'pbkdf2-aesgcm', salt: 'AA', iv: 'AA', data: 'AA' }),
    );
    await loadMyInfo();
    expect(useMyInfo.getState().status).toBe('locked');
    await expect(saveMyInfo({ fields: { city: 'x' } })).rejects.toBeInstanceOf(MyInfoError);
  });

  it('Forget clears memory and the backend', async () => {
    const backend = memoryMyInfoBackend();
    setMyInfoBackend(backend);
    await saveMyInfo({ fields: { givenName: 'Ayşe' } });
    expect(await forgetMyInfo()).toBe(true);
    expect(useMyInfo.getState()).toMatchObject({ profile: EMPTY_PROFILE, status: 'ready' });
    expect(await backend.get()).toBeUndefined();
  });
});

describe('IndexedDB', () => {
  const name = `pdf-editor:my-info:test-${Math.random().toString(36).slice(2)}`;

  it('round trips a record and Forget deletes the database', async () => {
    const backend = indexedDbMyInfoBackend(indexedDB, name);
    expect(await backend.get()).toBeUndefined();
    await backend.put({ v: 1, keepNationalId: false, fields: { givenName: 'Ayşe' } });
    expect(await backend.get()).toEqual({
      v: 1,
      keepNationalId: false,
      fields: { givenName: 'Ayşe' },
    });
    await backend.destroy();
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).not.toContain(name);
    expect(await backend.get()).toBeUndefined();
    await backend.destroy();
  });

  it('survives a save, a reload and Forget through the real store', async () => {
    const backend = indexedDbMyInfoBackend(indexedDB, `${name}-store`);
    setMyInfoBackend(backend);
    await saveMyInfo({ fields: { givenName: 'Ayşe', postalCode: '06100' } });
    setMyInfoBackend(indexedDbMyInfoBackend(indexedDB, `${name}-store`));
    await loadMyInfo();
    expect(useMyInfo.getState().profile.fields).toEqual({ givenName: 'Ayşe', postalCode: '06100' });
    expect(await forgetMyInfo()).toBe(true);
    setMyInfoBackend(indexedDbMyInfoBackend(indexedDB, `${name}-store`));
    await loadMyInfo();
    expect(useMyInfo.getState().profile.fields).toEqual({});
    await forgetMyInfo();
  });
});

describe('network', () => {
  it('makes no network call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const open = vi.spyOn(XMLHttpRequest.prototype, 'open');
    const send = vi.spyOn(XMLHttpRequest.prototype, 'send');
    const beacon = vi.spyOn(navigator, 'sendBeacon');
    setMyInfoBackend(memoryMyInfoBackend());
    await saveMyInfo({ fields: { givenName: 'Ayşe' }, keepNationalId: false });
    await forgetMyInfo();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
  });
});
