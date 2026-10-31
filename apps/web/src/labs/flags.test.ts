/** The flag registry's resolution order and the Labs state's persistence (DSN-82). */
import { beforeEach, describe, expect, it } from 'vitest';

import { hasToast } from '../ui/Toast/toast';
import { decideHomeFlag, HOME_SEARCH_FLAG } from '../home/home-flags';
import { decidePaletteVariant } from '../markup/palette-variant';
import { anyFlagOnByAddress, LABS_FLAGS, resolveFlag } from './flags';
import {
  createRevealTap,
  dismissLabsToast,
  labsState,
  resetLabs,
  resetLabsStoreForTests,
  revealLabs,
  setLabsFlag,
} from './store';
import { LABS_KEY, labsStored, readLabs } from './stored';

const flag = (key: string) => {
  const found = LABS_FLAGS.find((f) => f.key === key);
  if (!found) throw new Error(key);
  return found;
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetLabsStoreForTests();
});

describe('resolveFlag', () => {
  it('goes address, then Labs toggle, then the flag’s own value, then the default', () => {
    const margin = flag('margin');
    expect(resolveFlag(margin, '', {}, null)).toEqual({ value: '0', source: 'default' });
    expect(resolveFlag(margin, '', {}, '1')).toEqual({ value: '1', source: 'own' });
    expect(resolveFlag(margin, '', { margin: '0' }, '1')).toEqual({ value: '0', source: 'labs' });
    expect(resolveFlag(margin, '?margin=1', { margin: '0' }, null)).toEqual({
      value: '1',
      source: 'url',
    });
    expect(resolveFlag(margin, '?margin=0', { margin: '1' }, '1').value).toBe('0');
  });

  it('turns a shared parameter on only with its own word', () => {
    expect(resolveFlag(flag('home-search'), '?home=search', {}, null).value).toBe('1');
    expect(resolveFlag(flag('home-continue'), '?home=search', {}, null).source).toBe('default');
    expect(resolveFlag(flag('open-light'), '?open=light', {}, null).value).toBe('1');
  });

  it('keeps a choice to its values and falls back to the default', () => {
    const palette = flag('palette');
    expect(resolveFlag(palette, '?palette=groups', {}, null).value).toBe('groups');
    expect(resolveFlag(palette, '?palette=nope', { palette: 'labels' }, null)).toEqual({
      value: 'labels',
      source: 'labs',
    });
    expect(resolveFlag(palette, '', {}, null).value).toBe('row');
    expect(resolveFlag(flag('top'), '', {}, null).value).toBe('split');
  });

  it('agrees with the readers on the Labs toggle', () => {
    expect(decidePaletteVariant('', 'groups')).toBe('groups');
    expect(decidePaletteVariant('?palette=row', 'groups')).toBe('row');
    expect(decideHomeFlag(HOME_SEARCH_FLAG, '', '1')).toBe(true);
    expect(decideHomeFlag(HOME_SEARCH_FLAG, '?home=0', '1')).toBe(false);
  });

  it('resolves the phone capsule: the address, then Labs, off by default', () => {
    const capsule = flag('phone-capsule');
    expect(resolveFlag(capsule, '', {}, null)).toEqual({ value: '0', source: 'default' });
    expect(resolveFlag(capsule, '?phonebar=1', {}, null)).toEqual({ value: '1', source: 'url' });
    expect(resolveFlag(capsule, '', { 'phone-capsule': '1' }, null).source).toBe('labs');
    expect(resolveFlag(capsule, '?phonebar=0', { 'phone-capsule': '1' }, null).value).toBe('0');
  });

  it('resolves the text view: the address, then Labs, off by default, on the phone', () => {
    const view = flag('text-view');
    expect(view.edition).toBe('compact');
    expect(resolveFlag(view, '', {}, null)).toEqual({ value: '0', source: 'default' });
    expect(resolveFlag(view, '?textview=1', {}, null)).toEqual({ value: '1', source: 'url' });
    expect(resolveFlag(view, '', { 'text-view': '1' }, null).source).toBe('labs');
    expect(resolveFlag(view, '?textview=0', { 'text-view': '1' }, null).value).toBe('0');
  });

  it('lists every parameter once per key', () => {
    expect(new Set(LABS_FLAGS.map((f) => f.key)).size).toBe(LABS_FLAGS.length);
  });
});

describe('anyFlagOnByAddress', () => {
  it('is true only when the address moves a flag off its default', () => {
    expect(anyFlagOnByAddress('')).toBe(false);
    expect(anyFlagOnByAddress('?margin=0&top=split')).toBe(false);
    expect(anyFlagOnByAddress('?margin=1')).toBe(true);
    expect(anyFlagOnByAddress('?top=capsule')).toBe(true);
    expect(anyFlagOnByAddress('?phonebar=1')).toBe(true);
    expect(anyFlagOnByAddress('?phonebar=0')).toBe(false);
  });
});

describe('the Labs state', () => {
  it('keeps toggles under one key and hands them to the readers', () => {
    expect(labsStored('margin', null)).toBeNull();
    setLabsFlag('margin', '1');
    expect(Object.keys(localStorage)).toEqual([LABS_KEY]);
    expect(labsStored('margin', '0')).toBe('1');
    expect(readLabs().flags).toEqual({ margin: '1' });
    resetLabsStoreForTests();
    expect(labsState().flags).toEqual({ margin: '1' });
  });

  it('reads damaged storage as nothing set', () => {
    localStorage.setItem(LABS_KEY, '{not json');
    expect(readLabs()).toEqual({ shown: false, flags: {} });
    localStorage.setItem(LABS_KEY, JSON.stringify({ shown: true, flags: { a: 1, b: '1' } }));
    expect(readLabs()).toEqual({ shown: true, flags: { b: '1' } });
  });

  it('resets the toggles and what flags kept themselves, but not the reveal', () => {
    localStorage.setItem('pdf-editor:margin:v1', '1');
    sessionStorage.setItem('pdf-editor:top:v1', 'capsule');
    localStorage.setItem(LABS_KEY, JSON.stringify({ shown: true, flags: { margin: '0' } }));
    resetLabsStoreForTests();
    resetLabs();
    expect(localStorage.getItem('pdf-editor:margin:v1')).toBeNull();
    expect(sessionStorage.getItem('pdf-editor:top:v1')).toBeNull();
    expect(readLabs()).toEqual({ shown: true, flags: {} });
  });
});

describe('createRevealTap', () => {
  it('reveals on the fifth tap in a row, not on slow ones', () => {
    let at = 0;
    const tap = createRevealTap(() => at);
    for (let i = 0; i < 4; i++) {
      at += 300;
      tap();
    }
    expect(labsState().shown).toBe(false);
    at += 5000; // too slow: starts again
    tap();
    expect(labsState().shown).toBe(false);
    for (let i = 0; i < 4; i++) {
      at += 300;
      tap();
    }
    expect(labsState().shown).toBe(true);
  });
});

describe('the Labs on toast', () => {
  it('goes when Settings closes', () => {
    revealLabs();
    expect(hasToast('labs-on')).toBe(true);
    dismissLabsToast();
    expect(hasToast('labs-on')).toBe(false);
  });
});
