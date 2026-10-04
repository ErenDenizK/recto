import { afterEach, describe, expect, it } from 'vitest';

import {
  decideEdition,
  deviceEdition,
  EDITION_SESSION_KEY,
  type EditionEnvironment,
  getEdition,
  launchEdition,
  parseEdition,
  readEditionEnvironment,
  resetEditionForTests,
} from './edition';

const env = (overrides: Partial<EditionEnvironment> = {}): EditionEnvironment => ({
  coarse: false,
  screenWidth: 1440,
  screenHeight: 900,
  search: '',
  stored: undefined,
  ...overrides,
});

/**
 * A window stand-in: `matchMedia('(pointer: coarse)')`, `screen` and `location.search` are
 * whatever the test sets, and can change after launch (a rotation, a zoom).
 */
function fakeWindow(options: { coarse: boolean; width: number; height: number; search?: string }) {
  const state = { ...options };
  const storage = new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
  } as unknown as Storage;
  const root = document.createElement('html');
  const win = {
    matchMedia: (query: string) => ({ matches: query === '(pointer: coarse)' && state.coarse }),
    get screen() {
      return { width: state.width, height: state.height };
    },
    get location() {
      return { search: state.search ?? '' };
    },
    sessionStorage,
    document: { documentElement: root },
  } as unknown as Window;
  return { win, state, storage, root };
}

describe('the device rule (ADR-0033 §2.1)', () => {
  it.each([
    ['an iPhone in portrait', true, 390, 844, 'compact'],
    ['an iPhone on its side', true, 844, 390, 'compact'],
    ['a small Android phone', true, 360, 780, 'compact'],
    ['a 600 px Android tablet', true, 600, 960, 'full'],
    ['an iPad mini', true, 744, 1133, 'full'],
    ['an 820 px tablet', true, 820, 1180, 'full'],
    ['a touch laptop (fine primary pointer)', false, 1280, 800, 'full'],
    ['a desktop', false, 1920, 1080, 'full'],
    ['a narrow desktop window at 400 % zoom (screen still large)', false, 480, 270, 'full'],
  ] as const)('%s is %s', (_name, coarse, width, height, expected) => {
    expect(deviceEdition(coarse, width, height)).toBe(expected);
  });

  it('never makes a screen of unknown size compact', () => {
    expect(deviceEdition(true, 0, 0)).toBe('full');
  });
});

describe('the override', () => {
  it('parses only the two names', () => {
    expect(parseEdition('compact')).toBe('compact');
    expect(parseEdition('full')).toBe('full');
    expect(parseEdition('Compact')).toBeUndefined();
    expect(parseEdition('')).toBeUndefined();
    expect(parseEdition(null)).toBeUndefined();
  });

  it('the address beats the session, and the session beats the device', () => {
    const phone = { coarse: true, screenWidth: 390, screenHeight: 844 };
    expect(decideEdition(env(phone))).toEqual({ edition: 'compact' });
    expect(decideEdition(env({ ...phone, search: '?edition=full' }))).toEqual({
      edition: 'full',
      override: 'full',
    });
    expect(decideEdition(env({ ...phone, stored: 'full' }))).toEqual({
      edition: 'full',
      override: 'full',
    });
    expect(decideEdition(env({ search: '?edition=compact', stored: 'full' }))).toEqual({
      edition: 'compact',
      override: 'compact',
    });
    // An unknown value is ignored, not an override.
    expect(decideEdition(env({ ...phone, search: '?edition=tablet', stored: 'x' }))).toEqual({
      edition: 'compact',
    });
  });
});

describe('launch', () => {
  afterEach(() => {
    resetEditionForTests();
  });

  it('reads once: rotation, resizing and zoom never switch the edition', () => {
    const phone = fakeWindow({ coarse: true, width: 390, height: 844 });
    expect(launchEdition(phone.win)).toBe('compact');
    expect(phone.root.getAttribute('data-edition')).toBe('compact');
    // Rotation, then a zoom that a browser reports as a larger screen, then a mouse.
    phone.state.width = 844;
    phone.state.height = 390;
    expect(launchEdition(phone.win)).toBe('compact');
    phone.state.width = 1200;
    phone.state.height = 2000;
    phone.state.coarse = false;
    expect(launchEdition(phone.win)).toBe('compact');
    expect(getEdition()).toBe('compact');
  });

  it('a desktop stays full when its window shrinks to phone size', () => {
    const desktop = fakeWindow({ coarse: false, width: 1440, height: 900 });
    expect(launchEdition(desktop.win)).toBe('full');
    desktop.state.width = 320;
    desktop.state.height = 256;
    desktop.state.coarse = true;
    expect(getEdition()).toBe('full');
  });

  it('keeps an address override for the session only', () => {
    const phone = fakeWindow({ coarse: true, width: 390, height: 844, search: '?edition=full' });
    expect(launchEdition(phone.win)).toBe('full');
    expect(phone.storage.get(EDITION_SESSION_KEY)).toBe('full');
    expect(phone.root.getAttribute('data-edition')).toBe('full');

    // The next load of the same tab, without the parameter, keeps it.
    resetEditionForTests();
    phone.state.search = '';
    expect(launchEdition(phone.win)).toBe('full');

    // A desktop asked for the compact edition.
    resetEditionForTests();
    const desktop = fakeWindow({
      coarse: false,
      width: 1920,
      height: 1080,
      search: '?edition=compact',
    });
    expect(launchEdition(desktop.win)).toBe('compact');
    expect(desktop.storage.get(EDITION_SESSION_KEY)).toBe('compact');
  });

  it('survives storage that throws', () => {
    const phone = fakeWindow({ coarse: true, width: 390, height: 844, search: '?edition=full' });
    Object.defineProperty(phone.win, 'sessionStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    expect(readEditionEnvironment(phone.win).stored).toBeUndefined();
    expect(launchEdition(phone.win)).toBe('full');
  });

  it('reads this browser: the desktop test runner has a fine pointer, so it is full', () => {
    const read = readEditionEnvironment(window);
    expect(read.coarse).toBe(false);
    expect(read.screenWidth).toBe(screen.width);
    expect(deviceEdition(read.coarse, read.screenWidth, read.screenHeight)).toBe('full');
  });
});
