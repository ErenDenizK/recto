/**
 * Text-edit robustness matrix (craft spec §4.3–§4.6, §10): every editable paragraph picked from
 * `test/fixtures/text-edit-corpus/` × a set of scripted edits, made the way the app makes them
 * (the overlay's layout from `analyzeParagraphLayout`, `layoutParagraph` + `decideOverflow`,
 * then `applyParagraphEdit` with that layout), written, read back and reopened.
 *
 * The edits are emulated here as one replacement of the original text (`LayoutEdit`), in the
 * style of the character before the change (the first span's style at the paragraph start), as
 * the app's model should hand them over; the model itself is exercised by
 * `apps/web/src/text-edit/edit-matrix.test.ts`.
 *
 * Invariants, each reported with its numbers (one test collects every broken one):
 * - layout: every visible character of a rewritten line has a positive advance in a known
 *   style; the runs of a line do not go backwards; the layout's text is the typed text; a
 *   deletion adds no line and typing one or two characters adds at most one;
 * - write: the edit is accepted; the page then holds the typed text (read-back normalisation:
 *   every run of white space, line breaks included, compares as one space, since text
 *   extraction rebuilds spaces from gaps); in the edited area, glyph origins on a line strictly
 *   increase, no two visible glyphs overlap by more than half the narrower one, no visible
 *   glyph has zero width, and no two lines are closer than 0.8 × the leading;
 * - untouched text: glyphs of other paragraphs and of kept lines stay within 0.01 pt; reused
 *   lines move by exactly their `dy` (the line-count change × leading);
 * - justified paragraphs: rewritten lines but the last end at the measure's right edge, no line
 *   passes it, and the paragraph reads back justified (three lines or more);
 * - reopen: the saved file, opened afresh, has a paragraph with the typed text.
 * An edit the overflow policy lets run over the block below (`overflow`, craft §4.6) is only
 * checked for the layout and the untouched glyphs: its lines interleave with that block's.
 *
 * Known failures are `test.fails` with the bug they reproduce (`KNOWN` below); a known
 * failure that starts passing fails the run, so the list stays honest.
 */
import type { Rect, SourceId } from '@pdf-editor/document-model';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import addressUrl from '../../../../test/fixtures/text-edit-corpus/address-boxes.pdf?url';
import cidTurkishUrl from '../../../../test/fixtures/text-edit-corpus/cid-turkish.pdf?url';
import latexUrl from '../../../../test/fixtures/text-edit-corpus/latex-justified.pdf?url';
import ocrUrl from '../../../../test/fixtures/text-edit-corpus/ocr-layer.pdf?url';
import perGlyphUrl from '../../../../test/fixtures/text-edit-corpus/per-glyph.pdf?url';
import rotatedUrl from '../../../../test/fixtures/text-edit-corpus/rotated-paragraph.pdf?url';
import spacingUrl from '../../../../test/fixtures/text-edit-corpus/spacing-ops.pdf?url';
import columnsUrl from '../../../../test/fixtures/text-edit-corpus/tight-columns.pdf?url';
import type3Url from '../../../../test/fixtures/text-edit-corpus/type3-line.pdf?url';
import wordExportUrl from '../../../../test/fixtures/text-edit-corpus/word-export.pdf?url';
import wordTaggedUrl from '../../../../test/fixtures/text-edit-corpus/word-tagged.pdf?url';
import type {
  LocatedRun,
  ParagraphBlock,
  ParagraphEditResult,
  ParagraphLayout,
  ParagraphLayoutAnalysis,
} from '../types';
import { type LayoutEdit, layoutParagraph } from './linebreak';
import { decideOverflow } from './overflow';
import { createHarness, fixture, type Harness } from './test-helpers';

/** Untouched glyphs may move by this much (points). */
const GLYPH_TOLERANCE = 0.01;

let h: Harness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.adapter.destroy();
});

// ---------------------------------------------------------------------------
// Corpus and scenarios
// ---------------------------------------------------------------------------

interface Target {
  readonly file: string;
  readonly url: string;
  /** Detected paragraph indices (`ParagraphBlock.ref.index`) to edit. */
  readonly paragraphs: readonly number[];
}

const TARGETS: readonly Target[] = [
  { file: 'word-export.pdf', url: wordExportUrl, paragraphs: [1, 2, 3] },
  { file: 'per-glyph.pdf', url: perGlyphUrl, paragraphs: [0, 1] },
  { file: 'cid-turkish.pdf', url: cidTurkishUrl, paragraphs: [1] },
  { file: 'spacing-ops.pdf', url: spacingUrl, paragraphs: [0, 1, 2, 3] },
  { file: 'rotated-paragraph.pdf', url: rotatedUrl, paragraphs: [1] },
  { file: 'type3-line.pdf', url: type3Url, paragraphs: [0, 2] },
  { file: 'word-tagged.pdf', url: wordTaggedUrl, paragraphs: [1] },
  { file: 'latex-justified.pdf', url: latexUrl, paragraphs: [1] },
  { file: 'address-boxes.pdf', url: addressUrl, paragraphs: [2] },
];

/** A replacement of the paragraph's text `[start, end)` by `text`. */
interface Replacement {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

interface Word {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

function wordsOf(text: string): Word[] {
  return [...text.matchAll(/[^\s]+/gu)].map((m) => ({
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
    text: m[0],
  }));
}

/** Words that start on line `i` of the block. */
function lineWords(block: ParagraphBlock, i: number): Word[] {
  const line = block.lines[i];
  if (!line) return [];
  const next = block.lines[i + 1]?.start ?? block.text.length;
  return wordsOf(block.text).filter((w) => w.start >= line.start && w.start < next);
}

/** Where line 0's visible text ends (before the joining space or line break). */
function endOfFirstLine(block: ParagraphBlock): number | undefined {
  const second = block.lines[1];
  const first = block.lines[0];
  if (!second || !first) return undefined;
  return first.end === 'space' || first.end === 'forced' ? second.start - 1 : second.start;
}

const LONG =
  ' and then, after a pause that seemed to last for most of the afternoon, everybody agreed that the whole matter should be written down once more in plain words, read aloud to the room and signed by all who were present';

/** The edits of the matrix: `undefined` when the paragraph has no place for it. */
const SCENARIOS: Record<string, (block: ParagraphBlock) => Replacement | undefined> = {
  'insert-mid-word': (b) => {
    const w = [...lineWords(b, 1), ...lineWords(b, 0)].find((x) => x.text.length >= 4);
    if (!w) return undefined;
    const at = w.start + 2;
    return { start: at, end: at, text: b.text[at - 1] ?? 'e' };
  },
  'insert-start': (b) => {
    const w = wordsOf(b.text)[0];
    return w ? { start: 0, end: 0, text: `${w.text} ` } : undefined;
  },
  'insert-end': (b) => {
    const w = lineWords(b, 0).find((x) => /^\p{L}+$/u.test(x.text));
    return w ? { start: b.text.length, end: b.text.length, text: ` ${w.text}` } : undefined;
  },
  'space-single': (b) => {
    const w = lineWords(b, 0).find((x) => x.text.length >= 4);
    if (!w) return undefined;
    const at = w.start + 2;
    return { start: at, end: at, text: ' ' };
  },
  'space-double': (b) => {
    const w = wordsOf(b.text)[0];
    if (!w || b.text[w.end] !== ' ') return undefined;
    return { start: w.end, end: w.end, text: ' ' };
  },
  'backspace-line-join': (b) => {
    const second = b.lines[1];
    if (!second || b.lines[0]?.end !== 'space') return undefined;
    return { start: second.start - 1, end: second.start, text: '' };
  },
  'delete-line-end-char': (b) => {
    const end = endOfFirstLine(b);
    return end === undefined ? undefined : { start: end - 1, end, text: '' };
  },
  'delete-first-char': () => ({ start: 0, end: 1, text: '' }),
  'delete-last-char': (b) => ({ start: b.text.length - 1, end: b.text.length, text: '' }),
  'delete-across-lines': (b) => {
    const last = lineWords(b, 0).at(-1);
    const first = lineWords(b, 1)[0];
    return last && first ? { start: last.start, end: first.end, text: '' } : undefined;
  },
  'replace-all': (b) => ({
    start: 0,
    end: b.text.length,
    text: 'A fresh sentence typed over the whole paragraph.',
  }),
  'delete-all': (b) => ({ start: 0, end: b.text.length, text: '' }),
  turkish: (b) => {
    const w = wordsOf(b.text)[0];
    return w ? { start: w.end, end: w.end, text: ' ğüşıöç İĞÜŞÖÇ' } : undefined;
  },
  'long-insert': (b) => {
    const w = lineWords(b, 0)[2] ?? wordsOf(b.text)[0];
    return w ? { start: w.end, end: w.end, text: LONG } : undefined;
  },
  'paste-tab': (b) => {
    const w = wordsOf(b.text)[1] ?? wordsOf(b.text)[0];
    return w ? { start: w.end, end: w.end, text: '\tafter' } : undefined;
  },
  'paste-newlines': (b) => {
    const w = wordsOf(b.text)[1] ?? wordsOf(b.text)[0];
    return w
      ? { start: w.end, end: w.end, text: ' pasted line one\npasted line two\n' }
      : undefined;
  },
};

/**
 * Known failures: `file#paragraph scenario` → the bug, as found by this matrix (each one was
 * seen failing before it was listed).
 */
const KNOWN: Record<string, string> = {};

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const collapse = (text: string) => text.replace(/\s+/gu, ' ').trim();
const isBlank = (ch: string) => /^\s*$/u.test(ch);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** One keystroke's layout as the overlay makes it (with the page's room). */
function overlayLayout(analysis: ParagraphLayoutAnalysis, edit: LayoutEdit) {
  const base = layoutParagraph(analysis.input, edit);
  return decideOverflow(
    base,
    {
      input: analysis.input,
      edit,
      paragraphGap: analysis.paragraphGap,
      pageRoom: analysis.pageRoom,
    },
    analysis.gapBelow,
  );
}

/** The style typed text takes at `offset`: the character before it, else the first span's. */
function styleAt(analysis: ParagraphLayoutAnalysis, offset: number): string | undefined {
  const spans = analysis.input.spans;
  const before = spans.find((s) => s.start < offset && offset <= s.end);
  return before?.style ?? spans[0]?.style;
}

/** Layout invariants: advances, run order, text. */
function checkLayout(
  analysis: ParagraphLayoutAnalysis,
  layout: ParagraphLayout,
  expected: string,
  out: string[],
): void {
  if (layout.text !== expected) {
    out.push(`layout text ${JSON.stringify(layout.text)} != typed ${JSON.stringify(expected)}`);
  }
  layout.lines.forEach((line, li) => {
    if (line.status !== 'rewritten') return;
    let prevEnd = Number.NEGATIVE_INFINITY;
    for (const run of line.runs) {
      const style = analysis.input.styles[run.style];
      if (!style) {
        out.push(`line ${li}: run "${run.text}" has unknown style ${JSON.stringify(run.style)}`);
        continue;
      }
      for (const ch of Array.from(run.text)) {
        if (isBlank(ch)) continue;
        const own = style.advances[ch]?.spaced;
        const sub = style.substitute?.advances[ch];
        const advance = run.font === undefined ? (own ?? sub) : (sub ?? own);
        if (!advance || advance <= 0) {
          out.push(
            `line ${li}: "${ch}" in run "${run.text}" (style ${run.style}) has advance ${advance}`,
          );
        }
      }
      if (run.x < prevEnd - 0.5) {
        out.push(`line ${li}: run "${run.text}" starts at ${r2(run.x)} before ${r2(prevEnd)}`);
      }
      prevEnd = run.x + run.width;
    }
  });
}

interface Glyph {
  readonly text: string;
  readonly x: number;
  readonly y: number;
}

function runKey(run: Pick<LocatedRun, 'objectPath' | 'charStart'>): string {
  return `${run.objectPath.join('/')}:${run.charStart}`;
}

/**
 * A justified paragraph's rewritten lines, but the last and those ending in a line break, end
 * at the measure's right edge (unless the layout says a line stayed ragged); the last line is
 * set at its natural width, short of the edge when there is room.
 */
function checkJustified(
  analysis: ParagraphLayoutAnalysis,
  layout: ParagraphLayout,
  out: string[],
): void {
  if (analysis.input.align !== 'justify' || layout.ragged) return;
  const right = analysis.input.measure.right;
  const last = layout.lines.length - 1;
  layout.lines.forEach((line, li) => {
    if (line.status !== 'rewritten') return;
    const end = line.x + line.width;
    const full = li < last && !line.forced && !line.overfull && /\s/u.test(line.text);
    if (full && Math.abs(end - right) > 0.5) {
      out.push(`justified line ${li} ends at ${r2(end)}, the measure at ${r2(right)}`);
    }
    if (li === last && line.justified) out.push(`last line ${li} is justified`);
    if (!line.overfull && end > right + 0.5) {
      out.push(`line ${li} ends at ${r2(end)}, past the measure ${r2(right)}`);
    }
  });
}

/** Glyphs the edit must leave in place, and the reused lines' glyphs where they must land. */
function expectedGlyphs(
  runs: readonly LocatedRun[],
  block: ParagraphBlock,
  result: ParagraphEditResult,
): Glyph[] {
  const mine = new Set(block.ref.runs.map((r) => r.objectPath[0] ?? -1));
  const out: Glyph[] = [];
  for (const run of runs) {
    if (mine.has(run.objectPath[0] ?? -1)) continue;
    for (const g of run.glyphs) out.push({ text: g.text, x: g.origin.x, y: g.origin.y });
  }
  const byKey = new Map(runs.map((r) => [runKey(r), r]));
  const n = { x: -block.direction.y, y: block.direction.x };
  for (const line of result.layout.lines) {
    if (line.status === 'rewritten' || line.source === undefined) continue;
    const source = block.lines[line.source];
    if (!source) continue;
    for (const span of source.spans) {
      const ref = block.ref.runs[span.run];
      const run = ref ? byKey.get(runKey(ref)) : undefined;
      for (const g of run?.glyphs.slice(span.glyphStart, span.glyphEnd) ?? []) {
        out.push({ text: g.text, x: g.origin.x - line.dy * n.x, y: g.origin.y - line.dy * n.y });
      }
    }
  }
  return out;
}

/** The expected glyph farthest from a drawn glyph with its text, and that distance. */
function worstDrift(
  expected: readonly Glyph[],
  runs: readonly LocatedRun[],
): { distance: number; glyph?: Glyph } {
  const drawn = new Map<string, Glyph[]>();
  for (const run of runs) {
    for (const g of run.glyphs) {
      const list = drawn.get(g.text) ?? [];
      list.push({ text: g.text, x: g.origin.x, y: g.origin.y });
      drawn.set(g.text, list);
    }
  }
  let worst: { distance: number; glyph?: Glyph } = { distance: 0 };
  for (const e of expected) {
    let best = Number.POSITIVE_INFINITY;
    for (const d of drawn.get(e.text) ?? []) {
      best = Math.min(best, Math.hypot(d.x - e.x, d.y - e.y));
    }
    if (best > worst.distance) worst = { distance: best, glyph: e };
  }
  return worst;
}

/**
 * Glyph geometry in the edited area after the write: per line (by baseline, in the paragraph's
 * text space), origins strictly increase, visible glyphs do not overlap by more than half the
 * narrower one and have a width, and lines keep 0.8 × the leading apart.
 */
function checkGlyphs(
  runs: readonly LocatedRun[],
  block: ParagraphBlock,
  area: { x: number; y: number; width: number; height: number },
  out: string[],
): void {
  const d = block.direction;
  const along = (p: { x: number; y: number }) => p.x * d.x + p.y * d.y;
  const across = (p: { x: number; y: number }) => -p.x * d.y + p.y * d.x;
  const inside = (p: { x: number; y: number }) =>
    p.x >= area.x - 1 &&
    p.x <= area.x + area.width + 1 &&
    p.y >= area.y - 1 &&
    p.y <= area.y + area.height + 1;
  const lines = new Map<number, { g: LocatedRun['glyphs'][number]; size: number }[]>();
  for (const run of runs) {
    if (run.renderMode === 3) continue;
    for (const g of run.glyphs) {
      if (!inside(g.origin)) continue;
      const key = Math.round(across(g.origin) * 2) / 2;
      const list = lines.get(key) ?? [];
      list.push({ g, size: run.fontSize });
      lines.set(key, list);
    }
  }
  const baselines = [...lines.keys()].sort((a, b) => b - a);
  for (let i = 1; i < baselines.length; i++) {
    const pitch = (baselines[i - 1] ?? 0) - (baselines[i] ?? 0);
    if (pitch < 0.8 * block.leading) {
      out.push(
        `lines at ${baselines[i - 1]} and ${baselines[i]} are ${r2(pitch)} pt apart (leading ${r2(block.leading)})`,
      );
    }
  }
  for (const [baseline, glyphs] of lines) {
    glyphs.sort((a, b) => along(a.g.origin) - along(b.g.origin));
    const text = glyphs.map((x) => x.g.text).join('');
    for (let i = 0; i < glyphs.length; i++) {
      const cur = glyphs[i];
      if (!cur || isBlank(cur.g.text)) continue;
      const w = Math.abs(cur.g.rect.width * d.x + cur.g.rect.height * d.y);
      if (w < 0.01) out.push(`line ${baseline}: "${cur.g.text}" has zero width in "${text}"`);
      const prev = glyphs[i - 1];
      if (!prev || isBlank(prev.g.text)) continue;
      // A ligature glyph (`fi`) reads as several characters on one box: not two glyphs.
      if (sameBox(prev.g.rect, cur.g.rect)) continue;
      const step = along(cur.g.origin) - along(prev.g.origin);
      if (step < 0.05) {
        out.push(
          `line ${baseline}: "${prev.g.text}${cur.g.text}" origins ${r2(step)} pt apart in "${text}"`,
        );
        continue;
      }
      const a0 = Math.min(
        along(prev.g.rect),
        along({ x: prev.g.rect.x + prev.g.rect.width, y: prev.g.rect.y + prev.g.rect.height }),
      );
      const a1 = Math.max(
        along(prev.g.rect),
        along({ x: prev.g.rect.x + prev.g.rect.width, y: prev.g.rect.y + prev.g.rect.height }),
      );
      const b0 = Math.min(
        along(cur.g.rect),
        along({ x: cur.g.rect.x + cur.g.rect.width, y: cur.g.rect.y + cur.g.rect.height }),
      );
      const b1 = Math.max(
        along(cur.g.rect),
        along({ x: cur.g.rect.x + cur.g.rect.width, y: cur.g.rect.y + cur.g.rect.height }),
      );
      const overlap = Math.min(a1, b1) - Math.max(a0, b0);
      const narrower = Math.min(a1 - a0, b1 - b0);
      if (narrower > 0.01 && overlap > 0.5 * narrower) {
        out.push(
          `line ${baseline}: "${prev.g.text}" and "${cur.g.text}" overlap ${r2(overlap)} of ${r2(narrower)} pt in "${text}"`,
        );
      }
    }
  }
}

function sameBox(a: Rect, b: Rect): boolean {
  return (
    Math.abs(a.x - b.x) < 0.01 &&
    Math.abs(a.y - b.y) < 0.01 &&
    Math.abs(a.width - b.width) < 0.01 &&
    Math.abs(a.height - b.height) < 0.01
  );
}

/** The page's paragraphs read as one string (blocks joined by a space), collapsed. */
async function pageParagraphText(source: SourceId): Promise<string> {
  const blocks = await h.editor.analyzeParagraphs(source, 0);
  return collapse(blocks.map((b) => b.text).join(' '));
}

/**
 * Runs one scenario and returns every broken invariant (empty: all held). Throws only when
 * the scenario does not apply to the paragraph.
 */
async function runScenario(
  target: Target,
  index: number,
  replacement: (block: ParagraphBlock) => Replacement | undefined,
): Promise<{ broken: string[]; decided?: string } | 'skip'> {
  const out: string[] = [];
  let decided: string | undefined;
  const report = () => ({ broken: out, ...(decided ? { decided } : {}) });
  const source = await h.open(await fixture(target.url));
  try {
    const blocks = await h.editor.analyzeParagraphs(source, 0);
    const block = blocks.find((b) => b.ref.index === index);
    if (!block) {
      out.push(`no paragraph ${index} (${blocks.length} detected)`);
      return report();
    }
    if (block.refusal) {
      out.push(`paragraph refused: ${block.refusal}`);
      return report();
    }
    const r = replacement(block);
    if (!r) return 'skip';
    const analysis = await h.editor.analyzeParagraphLayout(block.ref);
    if (analysis.refusal) {
      out.push(`layout refused: ${analysis.refusal}`);
      return report();
    }
    const typed = block.text.slice(0, r.start) + r.text + block.text.slice(r.end);
    const style = styleAt(analysis, r.start);
    const edit: LayoutEdit = { ...r, ...(style === undefined ? {} : { style }) };
    const decision = overlayLayout(analysis, edit);
    decided = decision.kind;
    checkLayout(analysis, decision.layout, typed, out);
    checkJustified(analysis, decision.layout, out);
    // Removing text never adds lines (unless it joins two words: the longer word may wrap);
    // a character or two adds at most one.
    const grown = decision.layout.lineDelta;
    const joins =
      /\s/u.test(block.text.slice(r.start, r.end)) &&
      !isBlank(block.text[r.start - 1] ?? ' ') &&
      !isBlank(block.text[r.end] ?? ' ');
    if ((r.text === '' && !joins && grown > 0) || (r.text.length <= 2 && grown > 1)) {
      out.push(
        `${r.text === '' ? 'a deletion' : `typing ${JSON.stringify(r.text)}`} grew the paragraph by ${grown} line(s) (${decision.kind})`,
      );
    }
    if (decision.layout.unsupported.length > 0) {
      out.push(`unsupported characters ${decision.layout.unsupported.join('')}`);
      return report();
    }
    if (decision.kind === 'overflow' && decision.offPage) {
      out.push('overflow: off the page');
      return report();
    }

    const runsBefore = await h.editor.locateRuns(source, 0);
    let result: ParagraphEditResult;
    try {
      result = await h.editor.applyParagraphEdit(
        source,
        0,
        {
          ref: block.ref,
          text: typed,
          caretSpan: { start: r.start, end: r.end },
          ...(style === undefined ? {} : { style }),
          layout: decision.layout,
        },
        { commit: true },
      );
    } catch (error) {
      out.push(`write refused: ${error instanceof Error ? error.message : String(error)}`);
      return report();
    }
    if (!result.committed) out.push('not committed');

    // Read-back on the page and after a save and reopen. An overflowing paragraph runs over
    // the block below by design (craft §4.6, with a warning): its lines interleave with that
    // block's, so neither the read-back nor the line geometry can be checked.
    const overflowing = decision.kind === 'overflow';
    const wanted = collapse(typed);
    const page = await pageParagraphText(source);
    if (!overflowing && !page.includes(wanted)) {
      out.push(`read-back lacks ${JSON.stringify(wanted)}; page reads ${JSON.stringify(page)}`);
    }
    // A justified paragraph of three lines or more reads back justified (unless the layout
    // left a line ragged: its gaps would have stretched past 1.5 × the natural gap).
    if (!overflowing && block.align === 'justify' && !decision.layout.ragged) {
      const after = (await h.editor.analyzeParagraphs(source, 0)).find(
        (b) => collapse(b.text) === wanted,
      );
      if (after && after.lines.length >= 3 && after.align !== 'justify') {
        const edges = after.lines.map((l) => `${r2(l.x0)}–${r2(l.x1)}`).join(', ');
        out.push(`read back as ${after.align}, was justify; line edges ${edges}`);
      }
    }
    const runsAfter = await h.editor.locateRuns(source, 0);
    if (!overflowing) checkGlyphs(runsAfter, block, result.box, out);
    const drift = worstDrift(expectedGlyphs(runsBefore, block, result), runsAfter);
    if (drift.distance > GLYPH_TOLERANCE) {
      out.push(
        `untouched glyph "${drift.glyph?.text}" at (${r2(drift.glyph?.x ?? 0)}, ${r2(drift.glyph?.y ?? 0)}) moved ${r2(drift.distance)} pt`,
      );
    }
    for (const line of result.layout.lines) {
      if (line.status !== 'reused' || line.source === undefined) continue;
      const original = analysis.input.lines[line.source];
      const moved = line.y - (original?.y ?? 0);
      if (Math.abs(moved - line.dy) > 0.01) {
        out.push(`reused line ${line.source}: dy ${r2(line.dy)} but y moved ${r2(moved)}`);
      }
    }
    const reopened = await h.open(await h.adapter.save(source));
    try {
      const again = await pageParagraphText(reopened);
      if (!overflowing && !again.includes(wanted)) {
        out.push(`reopened file lacks ${JSON.stringify(wanted)}; reads ${JSON.stringify(again)}`);
      }
    } finally {
      await h.adapter.close(reopened);
    }
    return report();
  } finally {
    await h.adapter.close(source);
  }
}

// ---------------------------------------------------------------------------
// The matrix
// ---------------------------------------------------------------------------

for (const target of TARGETS) {
  describe(`edit matrix: ${target.file}`, () => {
    for (const index of target.paragraphs) {
      for (const [scenario, replacement] of Object.entries(SCENARIOS)) {
        const key = `${target.file}#${index} ${scenario}`;
        const known = KNOWN[key];
        const run = known ? test.fails : test;
        run(`#${index} ${scenario}${known ? ` (known: ${known})` : ''}`, async () => {
          const outcome = await runScenario(target, index, replacement);
          if (outcome === 'skip') return;
          const { broken, decided } = outcome;
          if (broken.length > 0) {
            console.warn(
              `[edit-matrix] ${key} (${decided ?? 'no layout'})\n  ${broken.join('\n  ')}`,
            );
          }
          expect(broken, key).toEqual([]);
        });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// A word wider than the measure
// ---------------------------------------------------------------------------

/** A pasted word (a long URL, a compound) wider than any line of the corpus. */
const OVERLONG = `https://example.org/${'Donaudampfschifffahrtsgesellschaft'.repeat(4)}`;

describe('edit matrix: a word wider than the measure', () => {
  // Known: `layoutParagraph` sets a word wider than the measure as an overfull line that runs
  // past the measure's right edge (no break inside the word), and `decideOverflow` judges only
  // the height, so the editor shows it as fitting; the writer then refuses it
  // ("[text-edit:does-not-fit] (paragraph:off-page) … would be drawn outside the page") when
  // the preview runs and on commit. A narrower overlong word commits running into the margin
  // or the next column. Seen on every target of the matrix.
  test.fails('word-export.pdf#1: a pasted overlong word is broken at the measure and commits', async () => {
    const target = TARGETS.find((t) => t.file === 'word-export.pdf');
    if (!target) throw new Error('no word-export target');
    const outcome = await runScenario(target, 1, (block) => {
      const w = wordsOf(block.text)[0];
      return w ? { start: w.end, end: w.end, text: ` ${OVERLONG}` } : undefined;
    });
    expect(outcome).not.toBe('skip');
    if (outcome === 'skip') return;
    expect(outcome.broken).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Detection against the manifest
// ---------------------------------------------------------------------------

interface ManifestParagraph {
  readonly id: string;
  readonly lines: readonly string[];
  readonly align: string;
  readonly editable: boolean;
}

const DETECTION: Record<string, string> = {
  'word-export.pdf': wordExportUrl,
  'per-glyph.pdf': perGlyphUrl,
  'cid-turkish.pdf': cidTurkishUrl,
  'spacing-ops.pdf': spacingUrl,
  'rotated-paragraph.pdf': rotatedUrl,
  'tight-columns.pdf': columnsUrl,
  'type3-line.pdf': type3Url,
  'ocr-layer.pdf': ocrUrl,
};

/** Known detection failures: `file` → the bug. */
const KNOWN_DETECTION: Record<string, string> = {};

describe('edit matrix: detection matches the manifest', () => {
  for (const [file, url] of Object.entries(DETECTION)) {
    const known = KNOWN_DETECTION[file];
    const run = known ? test.fails : test;
    run(`${file}${known ? ` (known: ${known})` : ''}`, async () => {
      const manifest = (await (await fetch(manifestUrl)).json()) as {
        fixtures: { file: string; expect: { paragraphs?: ManifestParagraph[] } }[];
      };
      const entry = manifest.fixtures.find((f) => f.file === `text-edit-corpus/${file}`);
      const expected = entry?.expect.paragraphs ?? [];
      expect(expected.length, file).toBeGreaterThan(0);
      const source = await h.open(await fixture(url));
      const blocks = await h.editor.analyzeParagraphs(source, 0);
      await h.adapter.close(source);
      const broken: string[] = [];
      for (const p of expected) {
        const text = collapse(p.lines.join(' '));
        const block = blocks.find((b) => collapse(b.text) === text);
        if (!block) {
          broken.push(
            `${p.id}: no block reads ${JSON.stringify(text.slice(0, 60))}…; blocks: ${blocks
              .map((b) => JSON.stringify(collapse(b.text).slice(0, 40)))
              .join(', ')}`,
          );
          continue;
        }
        if (block.lines.length !== p.lines.length) {
          broken.push(`${p.id}: ${block.lines.length} lines, expected ${p.lines.length}`);
        }
        if (p.editable && block.refusal) broken.push(`${p.id}: refused (${block.refusal})`);
        if (!p.editable && !block.refusal) broken.push(`${p.id}: offered for editing`);
        if (p.lines.length > 1 && block.align !== p.align) {
          broken.push(`${p.id}: align ${block.align}, expected ${p.align}`);
        }
      }
      if (broken.length > 0)
        console.warn(`[edit-matrix] detection ${file}\n  ${broken.join('\n  ')}`);
      expect(broken, file).toEqual([]);
    });
  }
});

/** Commits `r` on paragraph `index` the way the app does; the text after the edit. */
async function commitReplacement(source: SourceId, index: number, r: Replacement): Promise<string> {
  const block = (await h.editor.analyzeParagraphs(source, 0)).find((b) => b.ref.index === index);
  if (!block) throw new Error(`no paragraph ${index}`);
  const analysis = await h.editor.analyzeParagraphLayout(block.ref);
  const typed = block.text.slice(0, r.start) + r.text + block.text.slice(r.end);
  const style = styleAt(analysis, r.start);
  const edit: LayoutEdit = { ...r, ...(style === undefined ? {} : { style }) };
  const decision = overlayLayout(analysis, edit);
  const result = await h.editor.applyParagraphEdit(
    source,
    0,
    {
      ref: block.ref,
      text: typed,
      caretSpan: { start: r.start, end: r.end },
      ...(style === undefined ? {} : { style }),
      layout: decision.layout,
    },
    { commit: true },
  );
  expect(result.committed).toBe(true);
  return typed;
}

describe('edit matrix: a double space survives commit, reopen and a second edit', () => {
  // A ragged one-line paragraph and a Word-style justified one (TJ offsets after spaces).
  for (const [file, url, index] of [
    ['word-export.pdf', wordExportUrl, 3],
    ['word-export.pdf', wordExportUrl, 1],
    ['spacing-ops.pdf', spacingUrl, 3],
  ] as const) {
    test(`${file}#${index}`, async () => {
      const source = await h.open(await fixture(url));
      try {
        const block = (await h.editor.analyzeParagraphs(source, 0))[index] as ParagraphBlock;
        const first = wordsOf(block.text)[0] as Word;
        // A second space after the first word.
        const typed = await commitReplacement(source, index, {
          start: first.end,
          end: first.end,
          text: ' ',
        });
        expect(typed).toContain(`${first.text}  `);
        const reopened = await h.open(await h.adapter.save(source));
        try {
          const again = (await h.editor.analyzeParagraphs(reopened, 0))[index] as ParagraphBlock;
          expect(again.text).toBe(typed);
          // A word typed right after the double space lands there; the double space stays.
          const at = first.end + 2;
          const second = await commitReplacement(reopened, index, {
            start: at,
            end: at,
            text: 'very ',
          });
          const read = (await h.editor.analyzeParagraphs(reopened, 0))[index] as ParagraphBlock;
          expect(read.text).toBe(second);
          expect(read.text.startsWith(`${first.text}  very `)).toBe(true);
        } finally {
          await h.adapter.close(reopened);
        }
      } finally {
        await h.adapter.close(source);
      }
    });
  }
});

describe('edit matrix: justified paragraphs rewrap with the natural word gap', () => {
  // Spaces stretched by TJ offsets (Word), Tw, or TJ in tight columns: the rewrap's word gap
  // is the font's space as the last line draws it (about ¼ em), not a stretched one.
  for (const [file, url] of [
    ['word-export.pdf', wordExportUrl],
    ['spacing-ops.pdf', spacingUrl],
    ['tight-columns.pdf', columnsUrl],
  ] as const) {
    test(file, async () => {
      const source = await h.open(await fixture(url));
      try {
        const blocks = await h.editor.analyzeParagraphs(source, 0);
        const justified = blocks.filter((b) => b.align === 'justify' && !b.refusal);
        expect(justified.length, file).toBeGreaterThan(0);
        for (const block of justified) {
          const analysis = await h.editor.analyzeParagraphLayout(block.ref);
          for (const style of Object.values(analysis.input.styles)) {
            expect(style.wordGap, `${file}#${block.ref.index}`).toBeLessThan(0.3 * block.size);
          }
        }
      } finally {
        await h.adapter.close(source);
      }
    });
  }
});

const manifestUrl = new URL('../../../../test/fixtures/manifest.json', import.meta.url).href;
