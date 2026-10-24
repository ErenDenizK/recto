import { afterEach, describe, expect, it } from 'vitest';

import {
  autoBloomSession,
  decideLabelsFlag,
  LABELS_SESSIONS_KEY,
  labelsEnabled,
  labelsSession,
  nextSessionCount,
  resetPaletteLabels,
} from './palette-labels';

describe('the labels flag', () => {
  it('is off by default', () => {
    expect(decideLabelsFlag('', null)).toBe(false);
  });
  it('follows the address, then the stored choice', () => {
    expect(decideLabelsFlag('?labels=1', null)).toBe(true);
    expect(decideLabelsFlag('?labels=0', '1')).toBe(false);
    expect(decideLabelsFlag('', '1')).toBe(true);
    expect(decideLabelsFlag('?labels=x', null)).toBe(false);
  });
});

describe('sessions and when to bloom', () => {
  it('counts from the stored value and ignores a bad one', () => {
    expect(nextSessionCount(null)).toBe(1);
    expect(nextSessionCount('1')).toBe(2);
    expect(nextSessionCount('abc')).toBe(1);
    expect(nextSessionCount('-4')).toBe(1);
  });
  it('blooms by itself in the first two sessions only', () => {
    expect([1, 2, 3, 9].map(autoBloomSession)).toEqual([true, true, false, false]);
  });
});

describe('the page-level reads', () => {
  afterEach(() => {
    resetPaletteLabels();
    localStorage.clear();
    history.replaceState(null, '', '/');
  });
  it('keeps the address choice in storage and counts a session once per page', () => {
    history.replaceState(null, '', '/?labels=1');
    expect(labelsEnabled()).toBe(true);
    expect(labelsSession()).toBe(1);
    expect(labelsSession()).toBe(1);
    expect(localStorage.getItem(LABELS_SESSIONS_KEY)).toBe('1');
    resetPaletteLabels();
    history.replaceState(null, '', '/');
    expect(labelsEnabled()).toBe(true);
    expect(labelsSession()).toBe(2);
    resetPaletteLabels();
    history.replaceState(null, '', '/?labels=0');
    expect(labelsEnabled()).toBe(false);
  });
});
