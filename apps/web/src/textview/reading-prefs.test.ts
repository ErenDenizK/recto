/** The Text view's reading prefs (reading-prefs.ts): parse, clamp, keep, blocked storage. */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clampSize,
  DEFAULT_PREFS,
  parsePrefs,
  READING_PREFS_KEY,
  reloadReadingPrefs,
  setReadingPrefs,
  stepSize,
  TEXT_SIZES,
  useReadingPrefs,
} from './reading-prefs';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem(READING_PREFS_KEY);
  reloadReadingPrefs();
});

describe('parsing', () => {
  it('reads defaults from nothing, junk or the wrong shape', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{nope')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('[1]')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('"x"')).toEqual(DEFAULT_PREFS);
  });

  it('keeps valid fields and defaults the invalid ones', () => {
    expect(parsePrefs('{"size":5,"spacing":"loose","theme":"dark","face":"serif"}')).toEqual({
      size: 5,
      spacing: 'loose',
      theme: 'dark',
      face: 'serif',
    });
    expect(parsePrefs('{"size":99,"spacing":"huge","theme":1}')).toEqual({
      ...DEFAULT_PREFS,
      size: TEXT_SIZES.length - 1,
    });
  });

  it('clamps sizes to the seven steps', () => {
    expect(clampSize(-3)).toBe(0);
    expect(clampSize(2.6)).toBe(3);
    expect(clampSize(40)).toBe(6);
    expect(clampSize('x')).toBe(DEFAULT_PREFS.size);
    expect(clampSize(Number.NaN)).toBe(DEFAULT_PREFS.size);
    expect(TEXT_SIZES[DEFAULT_PREFS.size]).toBe(18);
  });
});

describe('the store', () => {
  it('keeps changes in localStorage and reads them back', () => {
    setReadingPrefs({ theme: 'dark', spacing: 'tight' });
    expect(JSON.parse(localStorage.getItem(READING_PREFS_KEY) ?? 'null')).toMatchObject({
      theme: 'dark',
      spacing: 'tight',
    });
    useReadingPrefs.setState(DEFAULT_PREFS);
    reloadReadingPrefs();
    expect(useReadingPrefs.getState().theme).toBe('dark');
  });

  it('steps the size and stops at both ends', () => {
    for (let i = 0; i < 10; i++) stepSize(1);
    expect(useReadingPrefs.getState().size).toBe(6);
    for (let i = 0; i < 10; i++) stepSize(-1);
    expect(useReadingPrefs.getState().size).toBe(0);
  });

  it('keeps the choice for the session when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(() => setReadingPrefs({ theme: 'light' })).not.toThrow();
    expect(useReadingPrefs.getState().theme).toBe('light');
    reloadReadingPrefs();
    expect(useReadingPrefs.getState()).toEqual(DEFAULT_PREFS);
  });
});
