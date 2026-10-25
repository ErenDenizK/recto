/**
 * Read aloud, the pure part (PRD-34): a page's engine text runs → one string in reading order
 * with a rectangle behind every character, the string cut into sentences, and a spoken word
 * (a speech boundary's char index) → the rectangles to ring on the page.
 *
 * Runs are taken in the engine's reading order, as Find and the text layer take them, and
 * joined with a space, so a sentence runs on across lines.
 */
import type { Rect } from '@pdf-editor/document-model';
import type { TextRun } from '@pdf-editor/engine';

/** A page's speakable text; `rects[i]` is the box behind `text[i]` (a joining space has none). */
export interface PageSpeech {
  readonly text: string;
  readonly rects: readonly (Rect | null)[];
  /** The run each character came from (a word across two runs rings one box per run). */
  readonly runs: readonly number[];
}

/** The page's runs as one string, a box behind each character. Runs without text are dropped. */
export function pageSpeech(runs: readonly TextRun[]): PageSpeech {
  let text = '';
  const rects: (Rect | null)[] = [];
  const owner: number[] = [];
  const push = (piece: string, rect: Rect | null, run: number) => {
    rects.push(...new Array<Rect | null>(piece.length).fill(rect));
    owner.push(...new Array<number>(piece.length).fill(run));
    text += piece;
  };
  runs.forEach((run, r) => {
    if (run.text === '') return;
    if (text !== '' && !/\s$/.test(text) && !/^\s/.test(run.text)) push(' ', null, r);
    if (run.glyphs.length === 0) {
      push(run.text, run.rect, r);
      return;
    }
    for (const glyph of run.glyphs) push(glyph.text, glyph.rect, r);
  });
  return { text, rects, runs: owner };
}

export interface Span {
  readonly start: number;
  /** Exclusive. */
  readonly end: number;
}

interface Segmenter {
  segment(input: string): Iterable<{ index: number; segment: string }>;
}
const segmenter = (locale: string, granularity: 'sentence' | 'word'): Segmenter | undefined =>
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(locale, { granularity })
    : undefined;

/** Sentences of `text` with something to say, in order; trailing spaces stay out of a span. */
export function sentences(text: string, locale = 'en'): Span[] {
  const found: Span[] = [];
  const pieces = segmenter(locale, 'sentence')?.segment(text);
  const cut = pieces
    ? [...pieces].map((p) => ({ index: p.index, segment: p.segment }))
    : [...text.matchAll(/[^.!?]+[.!?]*\s*/g)].map((p) => ({ index: p.index, segment: p[0] }));
  for (const { index, segment } of cut) {
    const trimmed = segment.trimEnd();
    const lead = trimmed.length - trimmed.trimStart().length;
    if (trimmed.trim() === '') continue;
    found.push({ start: index + lead, end: index + trimmed.length });
  }
  return found;
}

/** The word a speech boundary at `charIndex` of `text` names (`charLength` when the voice says). */
export function wordAt(text: string, charIndex: number, charLength?: number): Span | undefined {
  if (charIndex < 0 || charIndex >= text.length) return undefined;
  if (charLength !== undefined && charLength > 0) {
    return { start: charIndex, end: Math.min(text.length, charIndex + charLength) };
  }
  let start = charIndex;
  while (start > 0 && !/\s/.test(text.charAt(start - 1))) start--;
  let end = charIndex;
  while (end < text.length && !/\s/.test(text.charAt(end))) end++;
  return end > start ? { start, end } : undefined;
}

const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
};

/** The boxes to ring for the characters `[start, end)`: one per run the word touches. */
export function wordRects(speech: PageSpeech, start: number, end: number): Rect[] {
  const boxes = new Map<number, Rect>();
  for (let i = Math.max(0, start); i < Math.min(end, speech.rects.length); i++) {
    const rect = speech.rects[i];
    const run = speech.runs[i];
    if (!rect || run === undefined) continue;
    const held = boxes.get(run);
    boxes.set(run, held ? union(held, rect) : rect);
  }
  return [...boxes.values()];
}
