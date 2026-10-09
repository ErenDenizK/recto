import { beforeEach, describe, expect, it } from 'vitest';

import {
  INK_RECENT_SHOWN,
  INK_RECENTS_STORAGE_KEY,
  inkRecents,
  noteInkLeft,
  reloadInkRecents,
  stripColours,
} from './ink-recents';

beforeEach(() => {
  localStorage.removeItem(INK_RECENTS_STORAGE_KEY);
  reloadInkRecents();
});

describe('ink recents (10-ink §2.1, G8)', () => {
  it('puts the colour a tool leaves first, never the one it takes, and persists per tool', () => {
    noteInkLeft('pen:2', '#db1c22', '#1760EE');
    noteInkLeft('pen:2', '#1760EE', '#123456');
    expect(inkRecents('pen:2')).toEqual(['#1760EE', '#DB1C22']);
    // Back to red: it leaves the list, the colour it left goes first.
    noteInkLeft('pen:2', '#123456', '#DB1C22');
    expect(inkRecents('pen:2')).toEqual(['#123456', '#1760EE']);
    // Another tool keeps its own.
    expect(inkRecents('pen:0')).toEqual([]);
    reloadInkRecents();
    expect(inkRecents('pen:2')).toEqual(['#123456', '#1760EE']);
  });

  it('ignores a pick of the same colour and an invalid one', () => {
    noteInkLeft('text', '#1A1A1A', '#1a1a1a');
    noteInkLeft('text', 'red', '#1A1A1A');
    expect(inkRecents('text')).toEqual([]);
  });

  it('shows at most four, leaving out the current colour', () => {
    const colours = ['#000001', '#000002', '#000003', '#000004', '#000005', '#000006'];
    for (let i = 0; i < colours.length - 1; i++) {
      noteInkLeft('shape', colours[i] as string, colours[i + 1] as string);
    }
    expect(inkRecents('shape')).toHaveLength(INK_RECENT_SHOWN + 1);
    expect(stripColours(inkRecents('shape'), '#000006')).toEqual([
      '#000005',
      '#000004',
      '#000003',
      '#000002',
    ]);
    expect(stripColours(inkRecents('shape'), '#000004')).toEqual([
      '#000005',
      '#000003',
      '#000002',
      '#000001',
    ]);
  });

  it('shows a pen its recents alone; a tool with no dock pens fills from its palette (G8)', () => {
    // A pen: its recents only, none before it has changed colour.
    expect(stripColours([], '#111111')).toEqual([]);
    expect(stripColours(['#CC2222', '#111111'], '#111111')).toEqual(['#CC2222']);
    // A shape, text box or note: its recents first, then its palette, never the current colour.
    const palette = ['#111111', '#00AA00', '#2222aa', '#7700AA', '#FF8800'];
    expect(stripColours(['#123456'], '#00AA00', palette)).toEqual([
      '#123456',
      '#111111',
      '#2222AA',
      '#7700AA',
    ]);
  });

  it('keeps only known tools and valid colours from storage', () => {
    localStorage.setItem(
      INK_RECENTS_STORAGE_KEY,
      JSON.stringify({
        'pen:1': ['#abcdef', 7, 'nope', '#ABCDEF', '#00ff00'],
        eraser: ['#111111'],
      }),
    );
    reloadInkRecents();
    expect(inkRecents('pen:1')).toEqual(['#ABCDEF', '#00FF00']);
    localStorage.setItem(INK_RECENTS_STORAGE_KEY, '[1,2]');
    reloadInkRecents();
    expect(inkRecents('pen:1')).toEqual([]);
  });
});
