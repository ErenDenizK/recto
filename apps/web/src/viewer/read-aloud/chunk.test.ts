import type { TextRun } from '@pdf-editor/engine';
import { describe, expect, it } from 'vitest';

import { pageSpeech, sentences, wordAt, wordRects } from './chunk';

const glyphs = (text: string, x: number, y: number) =>
  Array.from(text, (ch, i) => ({
    text: ch,
    rect: { x: x + i * 5, y, width: 5, height: 10 },
    fontSize: 10,
  }));
const run = (text: string, x: number, y: number): TextRun => ({
  text,
  rect: { x, y, width: text.length * 5, height: 10 },
  glyphs: glyphs(text, x, y),
});

describe('pageSpeech', () => {
  it('joins runs with a space and keeps a box behind each character', () => {
    const speech = pageSpeech([run('Hello', 0, 100), run('world.', 0, 80)]);
    expect(speech.text).toBe('Hello world.');
    expect(speech.rects[5]).toBeNull();
    expect(speech.rects[6]).toEqual({ x: 0, y: 80, width: 5, height: 10 });
  });

  it('does not double a space a run already carries', () => {
    expect(pageSpeech([run('Hi ', 0, 0), run('you', 20, 0)]).text).toBe('Hi you');
  });
});

describe('sentences', () => {
  it('cuts at sentence ends and drops the space between', () => {
    const text = 'One two. Three four! Five?';
    expect(sentences(text).map((s) => text.slice(s.start, s.end))).toEqual([
      'One two.',
      'Three four!',
      'Five?',
    ]);
  });

  it('survives a malformed language tag and an underscore tag', () => {
    expect(sentences('One. Two.', 'x!!')).toHaveLength(2);
    expect(sentences('One. Two.', 'en_US')).toHaveLength(2);
    expect(sentences('One. Two.', '')).toHaveLength(2);
  });

  it('cuts a very long sentence at a space', () => {
    const long = `${'word '.repeat(200)}end.`;
    const spans = sentences(long);
    expect(spans.length).toBeGreaterThan(2);
    for (const span of spans) expect(span.end - span.start).toBeLessThanOrEqual(300);
  });

  it('has none for blank text', () => {
    expect(sentences('  ')).toEqual([]);
  });
});

describe('wordAt', () => {
  it('widens a boundary to its word, or takes the length the voice gives', () => {
    expect(wordAt('Hello big world', 8)).toEqual({ start: 6, end: 9 });
    expect(wordAt('Hello big world', 6, 2)).toEqual({ start: 6, end: 8 });
    expect(wordAt('Hello', 9)).toBeUndefined();
  });
});

describe('wordRects', () => {
  it('unites the glyphs of a word per run', () => {
    const speech = pageSpeech([run('Hello', 0, 100), run('world', 0, 80)]);
    expect(wordRects(speech, 0, 5)).toEqual([{ x: 0, y: 100, width: 25, height: 10 }]);
    // "lo wo": the end of one run and the start of the next: two boxes.
    expect(wordRects(speech, 3, 8)).toHaveLength(2);
  });
});
