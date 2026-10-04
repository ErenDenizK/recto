import { beforeEach, describe, expect, it } from 'vitest';

import {
  addSavedColour,
  noteRecentColour,
  RECENT_COLOURS_KEY,
  RECENT_MAX,
  recentColours,
  reloadColourLists,
  removeSavedColour,
  SAVED_COLOURS_KEY,
  SAVED_MAX,
  savedColours,
} from './saved-colours';

beforeEach(() => {
  reloadColourLists();
});

describe('saved colours', () => {
  it('adds at the end, once, up to twelve, and persists', () => {
    expect(addSavedColour('#1760ee')).toBe('added');
    expect(addSavedColour('1760EE')).toBe('exists');
    expect(addSavedColour('nope')).toBe('invalid');
    for (let i = 1; i < SAVED_MAX; i++) addSavedColour(`#0000${(i + 16).toString(16)}`);
    expect(savedColours()).toHaveLength(SAVED_MAX);
    expect(addSavedColour('#FFFFFF')).toBe('full');
    expect(JSON.parse(localStorage.getItem(SAVED_COLOURS_KEY)!)).toEqual(savedColours());
    reloadColourLists();
    expect(savedColours()[0]).toBe('#1760EE');
    removeSavedColour('#1760EE');
    expect(savedColours()).toHaveLength(SAVED_MAX - 1);
  });

  it('keeps only valid, distinct colours from storage', () => {
    localStorage.setItem(
      SAVED_COLOURS_KEY,
      JSON.stringify(['#abc', 42, 'red', '#AABBCC', '#123456']),
    );
    reloadColourLists();
    expect(savedColours()).toEqual(['#AABBCC', '#123456']);
    localStorage.setItem(SAVED_COLOURS_KEY, '{oops');
    reloadColourLists();
    expect(savedColours()).toEqual([]);
  });

  it('keeps the last six recents, newest first', () => {
    for (let i = 0; i < 8; i++) noteRecentColour(`#10101${i}`);
    noteRecentColour('#101013');
    expect(recentColours()).toHaveLength(RECENT_MAX);
    expect(recentColours()[0]).toBe('#101013');
    expect(new Set(recentColours()).size).toBe(RECENT_MAX);
    expect(JSON.parse(localStorage.getItem(RECENT_COLOURS_KEY)!)).toEqual(recentColours());
  });
});
