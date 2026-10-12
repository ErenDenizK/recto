/**
 * The mirror's DOM maps (EDN-17): a DOM position anywhere in the mirror reads as a text offset
 * (element offsets, several nodes, an empty mirror, never inside a surrogate pair), a text
 * offset finds its node (a line break shows at the next line's start), and the lines are kept
 * in place as the text changes.
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  lineTexts,
  type MirrorLine,
  mirrorOffset,
  mirrorPosition,
  syncMirrorLines,
} from './mirror-dom';

const lines = (texts: readonly string[]): MirrorLine[] =>
  texts.map((text, i) => ({ text, top: i * 20, height: 20, left: 0, width: 100, size: 10 }));

function mirrorOf(texts: readonly string[]): HTMLElement {
  const mirror = document.createElement('div');
  document.body.append(mirror);
  syncMirrorLines(mirror, lines(texts), 16);
  return mirror;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('mirrorOffset', () => {
  it('reads text, element and mirror positions as text offsets', () => {
    const mirror = mirrorOf(['ab ', 'cd']);
    const [first, second] = [...mirror.querySelectorAll('span')].map((s) => s.firstChild as Text);
    expect(mirrorOffset(mirror, first ?? null, 2)).toBe(2);
    expect(mirrorOffset(mirror, second ?? null, 1)).toBe(4);
    expect(mirrorOffset(mirror, mirror, 0)).toBe(0);
    expect(mirrorOffset(mirror, mirror, 1)).toBe(3);
    expect(mirrorOffset(mirror, mirror, 2)).toBe(5);
    expect(mirrorOffset(mirror, mirror.lastChild, 0)).toBe(3);
    // A stale offset past a node's end is its end.
    expect(mirrorOffset(mirror, first ?? null, 9)).toBe(3);
  });

  it('is null outside the mirror and steps off a surrogate pair’s trail', () => {
    const mirror = mirrorOf(['a😀b']);
    expect(mirrorOffset(mirror, document.body, 0)).toBeNull();
    expect(mirrorOffset(mirror, null, 0)).toBeNull();
    const node = mirror.querySelector('span')?.firstChild ?? null;
    expect(mirrorOffset(mirror, node, 2)).toBe(1);
    expect(mirrorOffset(mirror, node, 3)).toBe(3);
  });

  it('reads an empty mirror as offset 0', () => {
    const mirror = document.createElement('div');
    document.body.append(mirror);
    expect(mirrorOffset(mirror, mirror, 0)).toBe(0);
  });
});

describe('mirrorPosition', () => {
  it('finds the node of an offset, a line break at the next line’s start', () => {
    const mirror = mirrorOf(['ab ', 'cd']);
    const [first, second] = [...mirror.querySelectorAll('span')].map((s) => s.firstChild);
    expect(mirrorPosition(mirror, 1)).toEqual({ node: first, offset: 1 });
    expect(mirrorPosition(mirror, 3)).toEqual({ node: second, offset: 0 });
    expect(mirrorPosition(mirror, 5)).toEqual({ node: second, offset: 2 });
    for (let at = 0; at <= 5; at++) {
      const { node, offset } = mirrorPosition(mirror, at);
      expect(mirrorOffset(mirror, node, offset)).toBe(at);
    }
  });

  it('places the caret in an emptied mirror', () => {
    const mirror = mirrorOf(['']);
    const { node, offset } = mirrorPosition(mirror, 0);
    expect(mirror.contains(node)).toBe(true);
    expect(mirrorOffset(mirror, node, offset)).toBe(0);
  });
});

describe('the mirror’s lines', () => {
  it('splits the text at each line’s next start, the last to the end', () => {
    expect(lineTexts('ab cd ef', [{ next: 3 }, { next: 6 }, { next: 8 }])).toEqual([
      'ab ',
      'cd ',
      'ef',
    ]);
    expect(lineTexts('ab\n', [{ next: 3 }, { next: 3 }])).toEqual(['ab\n', '']);
    expect(lineTexts('', [])).toEqual(['']);
  });

  it('keeps the nodes in place as the text changes, and replaces what is foreign', () => {
    const mirror = mirrorOf(['ab ', 'cd']);
    const node = mirror.querySelector('span')?.firstChild;
    expect(syncMirrorLines(mirror, lines(['abx ', 'cd']), 16)).toBe(true);
    expect(mirror.querySelector('span')?.firstChild).toBe(node);
    expect(mirror.textContent).toBe('abx cd');
    expect(syncMirrorLines(mirror, lines(['abx ', 'cd']), 16)).toBe(false);
    // A composition's leftovers (a stray node) go.
    mirror.firstChild?.appendChild(document.createTextNode('zz'));
    mirror.append(document.createElement('br'));
    expect(syncMirrorLines(mirror, lines(['abx ', 'cd']), 16)).toBe(true);
    expect(mirror.textContent).toBe('abx cd');
    expect(mirror.childNodes).toHaveLength(2);
    // Fewer lines drop the rest.
    syncMirrorLines(mirror, lines(['']), 16);
    expect(mirror.childNodes).toHaveLength(1);
    expect(mirror.textContent).toBe('');
  });
});
