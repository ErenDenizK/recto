/**
 * Paragraph edits on real-world shapes (craft spec §4.3–§4.5, ADR-0020 §3): scripted edits
 * made the way the editor makes them (the overlay's layout, spans in the caret's style), then
 * read back. For each edit:
 * - the page's paragraph analysis holds the new text;
 * - no two drawn glyphs overlap (old and new text never sit on top of each other);
 * - every rewritten glyph is drawn where the layout placed it (the overlay showed it there);
 * - other paragraphs do not move.
 * Covered: an emptied paragraph (committed empty, and retyped after delete-all), inserts and
 * deletes at line boundaries, double spaces, Turkish letters in a Latin subset font, long input
 * that rewraps.
 */
import { PDFDocument } from '@cantoo/pdf-lib';
import type { SourceId } from '@pdf-editor/document-model';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import latexUrl from '../../../../test/fixtures/text-edit-corpus/latex-justified.pdf?url';
import twoColumnUrl from '../../../../test/fixtures/text-edit-corpus/two-column.pdf?url';
import wordUrl from '../../../../test/fixtures/text-edit-corpus/word-tagged.pdf?url';
import fontsUrl from '../../../../test/fixtures/text-edit-fonts.pdf?url';
import { toBuffer } from '../../test/helpers';
import type {
  LocatedRun,
  ParagraphBlock,
  ParagraphEdit,
  ParagraphEditResult,
  ParagraphLayoutAnalysis,
} from '../types';
import { type LayoutEdit, layoutParagraph } from './linebreak';
import { decideOverflow } from './overflow';
import { createHarness, fixture, type Harness, rawPdf } from './test-helpers';

let h: Harness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.adapter.destroy();
});

const THREE_LINES = [
  'BT /F1 12 Tf 1 0 0 1 40 250 Tm (The harbour master walked along the quay) Tj ET',
  'BT /F1 12 Tf 1 0 0 1 40 235.6 Tm (and counted the boats that came in with) Tj ET',
  'BT /F1 12 Tf 1 0 0 1 40 221.2 Tm (the evening tide.) Tj ET',
].join('\n');

/** The overlay's layout of one edit. */
function overlayLayout(analysis: ParagraphLayoutAnalysis, edit: LayoutEdit) {
  const base = layoutParagraph(analysis.input, edit);
  return decideOverflow(
    base,
    { input: analysis.input, edit, paragraphGap: analysis.paragraphGap },
    analysis.gapBelow,
  ).layout;
}

/** The style the editor types in at `start` (the character before, else after, else the first). */
function caretStyle(analysis: ParagraphLayoutAnalysis, start: number): string {
  const at = (i: number) => analysis.input.spans.find((s) => s.start <= i && i < s.end)?.style;
  return at(start - 1) ?? at(start) ?? analysis.input.spans[0]?.style ?? 's0';
}

/** The edit the editor commits: `inserted` over `[start, end)`, typed in the caret's style. */
function editorEdit(
  block: ParagraphBlock,
  analysis: ParagraphLayoutAnalysis,
  start: number,
  end: number,
  inserted: string,
): ParagraphEdit {
  const style = caretStyle(analysis, start);
  const spans = inserted.length > 0 ? [{ start: 0, end: inserted.length, style }] : undefined;
  const layoutEdit: LayoutEdit = { start, end, text: inserted, ...(spans ? { spans } : {}) };
  return {
    ref: block.ref,
    text: block.text.slice(0, start) + inserted + block.text.slice(end),
    caretSpan: { start, end },
    ...(spans ? { spans } : {}),
    layout: overlayLayout(analysis, layoutEdit),
  };
}

interface DrawnGlyph {
  readonly text: string;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly ox: number;
  readonly oy: number;
}

function drawnGlyphs(runs: readonly LocatedRun[]): DrawnGlyph[] {
  const out: DrawnGlyph[] = [];
  for (const run of runs) {
    for (const g of run.glyphs) {
      if (/^\s*$/u.test(g.text) || g.rect.width <= 0) continue;
      out.push({
        text: g.text,
        x0: g.rect.x,
        x1: g.rect.x + g.rect.width,
        y0: g.rect.y,
        y1: g.rect.y + g.rect.height,
        ox: g.origin.x,
        oy: g.origin.y,
      });
    }
  }
  return out;
}

/** Pairs of drawn glyphs whose boxes overlap by more than `share` of the narrower one. */
function overlaps(glyphs: readonly DrawnGlyph[], share = 0.4): string[] {
  const out: string[] = [];
  for (let i = 0; i < glyphs.length; i++) {
    const a = glyphs[i];
    if (!a) continue;
    for (let j = i + 1; j < glyphs.length; j++) {
      const b = glyphs[j];
      if (!b) continue;
      const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const hgt = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (w <= 0 || hgt <= 0) continue;
      const narrower = Math.min(a.x1 - a.x0, b.x1 - b.x0);
      const lower = Math.min(a.y1 - a.y0, b.y1 - b.y0);
      if (w > share * narrower && hgt > share * lower) {
        out.push(
          `"${a.text}"@${a.ox.toFixed(1)},${a.oy.toFixed(1)} × "${b.text}"@${b.ox.toFixed(1)},${b.oy.toFixed(1)}`,
        );
      }
    }
  }
  return out;
}

/** The glyph origins the layout planned for its rewritten lines (horizontal text). */
function plannedOrigins(
  block: ParagraphBlock,
  result: ParagraphEditResult,
): { text: string; x: number; y: number }[] {
  const top = block.lines[0]?.baseline ?? 0;
  const out: { text: string; x: number; y: number }[] = [];
  for (const line of result.layout.lines) {
    if (line.status !== 'rewritten') continue;
    for (const run of line.runs) {
      // Origins of the run's glyphs: the run's x plus the drawn advances (not known here);
      // only the first glyph of each run is pinned exactly.
      const first = Array.from(run.text).find((ch) => !/\s/u.test(ch));
      if (first === undefined) continue;
      const lead = run.text.indexOf(first);
      if (lead > 0) continue;
      out.push({ text: first, x: run.x, y: top - line.y });
    }
  }
  return out;
}

interface Probe {
  readonly source: SourceId;
  readonly block: ParagraphBlock;
  readonly edit: ParagraphEdit;
  readonly result: ParagraphEditResult;
  readonly runs: readonly LocatedRun[];
}

/** The paragraph text the analysis reads back (one space per word gap). */
/** The text as it reads back: tabs as spaces, a double space kept (`blocks.ts` step 9). */
const collapsed = (text: string) => text.replace(/\t/g, ' ').trim();

/** Edits paragraph `index` of `bytes` (opened) or of an open source (an edit after an edit). */
async function probe(
  name: string,
  bytes: ArrayBuffer | SourceId,
  index: number,
  script: (block: ParagraphBlock) => { start: number; end: number; inserted: string },
): Promise<Probe> {
  const source = typeof bytes === 'string' ? bytes : await h.open(bytes);
  const blocks = await h.editor.analyzeParagraphs(source, 0);
  const block = blocks[index];
  if (!block) throw new Error(`${name}: no paragraph ${index}`);
  const analysis = await h.editor.analyzeParagraphLayout(block.ref);
  expect(analysis.refusal, name).toBeUndefined();
  const { start, end, inserted } = script(block);
  const edit = editorEdit(block, analysis, start, end, inserted);
  const runsBefore = await h.editor.locateRuns(source, 0);
  const othersBefore = drawnGlyphs(
    runsBefore.filter((r) => !block.ref.runs.some((m) => sameObject(m, r))),
  );
  const overlapsBefore = overlaps(drawnGlyphs(runsBefore)).length;
  const result = await h.editor.applyParagraphEdit(source, 0, edit, { commit: true });
  const runs = await h.editor.locateRuns(source, 0);
  const after = await h.editor.analyzeParagraphs(source, 0);
  if (edit.text.trim() !== '') {
    expect(
      after.map((b) => b.text),
      `${name}: read back ${JSON.stringify(after.map((b) => b.text))} runs ${JSON.stringify(runs.map((r) => [r.text, r.glyphs[0]?.origin.x.toFixed(1), r.glyphs[0]?.origin.y.toFixed(1)]))}`,
    ).toContain(collapsed(edit.text));
  }
  // Nothing drawn on top of anything else (beyond what the page had).
  const glyphs = drawnGlyphs(runs);
  const now = overlaps(glyphs);
  expect(
    now.length,
    `${name}: overlapping glyphs ${now.slice(0, 6).join('; ')}`,
  ).toBeLessThanOrEqual(overlapsBefore);
  // Rewritten runs start where the overlay showed them.
  for (const p of plannedOrigins(block, result)) {
    const near = glyphs.some(
      (g) => g.text === p.text && Math.abs(g.ox - p.x) < 0.05 && Math.abs(g.oy - p.y) < 0.05,
    );
    expect(near, `${name}: "${p.text}" drawn at ${p.x.toFixed(2)},${p.y.toFixed(2)}`).toBe(true);
  }
  // Other paragraphs stay put.
  for (const g of othersBefore) {
    const kept = glyphs.some(
      (d) => d.text === g.text && Math.abs(d.ox - g.ox) < 0.01 && Math.abs(d.oy - g.oy) < 0.01,
    );
    expect(kept, `${name}: "${g.text}" at ${g.ox},${g.oy} kept`).toBe(true);
  }
  return { source, block, edit, result, runs };
}

function sameObject(
  a: { readonly objectPath: readonly number[] },
  b: { readonly objectPath: readonly number[] },
): boolean {
  return (
    a.objectPath.length === b.objectPath.length &&
    a.objectPath.every((v, i) => v === b.objectPath[i])
  );
}

const at = (b: ParagraphBlock, word: string, inserted: string, from = 0) => {
  const start = b.text.indexOf(word, from);
  if (start < 0) throw new Error(`"${word}" not in "${b.text}"`);
  return { start, end: start + word.length, inserted };
};

describe('what lies below a paragraph', () => {
  test('a graphic drawn inside a form XObject stops growth like one drawn on the page', async () => {
    // A rule 20 pt below the last baseline, drawn by a form (a stamped logo, a table rule).
    const rule = '40 196 300 2 re f';
    const page = await rawPdf({ size: [400, 300], content: `${THREE_LINES}\n${rule}` });
    // The same rule, drawn 30 pt higher in the form and moved down by the form's placement.
    const form = await rawPdf({
      size: [400, 300],
      content: `${THREE_LINES}\nq 1 0 0 1 0 -30 cm /Fm1 Do Q`,
      forms: { Fm1: '40 226 300 2 re f' },
    });
    const gaps: number[] = [];
    for (const bytes of [page, form]) {
      const source = await h.open(bytes);
      const [block] = await h.editor.analyzeParagraphs(source, 0);
      if (!block) throw new Error('no paragraph');
      gaps.push((await h.editor.analyzeParagraphLayout(block.ref)).gapBelow);
      await h.adapter.close(source);
    }
    expect(gaps[0]).toBeLessThan(25);
    expect(gaps[1]).toBeCloseTo(gaps[0] ?? 0, 3);
  });

  test('a form field below stops growth (a widget never moves, the text must not cover it)', async () => {
    const doc = await PDFDocument.load(await rawPdf({ size: [400, 300], content: THREE_LINES }));
    const field = doc.getForm().createTextField('name');
    field.addToPage(doc.getPage(0), { x: 40, y: 180, width: 200, height: 18 });
    const source = await h.open(toBuffer(await doc.save()));
    const [block] = await h.editor.analyzeParagraphs(source, 0);
    if (!block) throw new Error('no paragraph');
    const { gapBelow } = await h.editor.analyzeParagraphLayout(block.ref);
    // From the paragraph's ink (just below the last baseline, 221.2) to the field's top (198).
    expect(gapBelow).toBeLessThan(25);
    await h.adapter.close(source);
  });
});

describe('an emptied paragraph', () => {
  test('commits empty: the glyphs go and nothing else moves', async () => {
    const p = await probe(
      'empty',
      await rawPdf({ size: [400, 300], content: THREE_LINES }),
      0,
      (b) => ({
        start: 0,
        end: b.text.length,
        inserted: '',
      }),
    );
    expect(p.result.committed).toBe(true);
    expect(p.runs.map((r) => r.text).join('')).toBe('');
    await h.adapter.close(p.source);
  });

  test('delete all and retype: the new text is written in the paragraph’s style', async () => {
    const p = await probe(
      'retype',
      await rawPdf({ size: [400, 300], content: THREE_LINES }),
      0,
      (b) => ({ start: 0, end: b.text.length, inserted: 'Hello world, a new text here.' }),
    );
    expect(p.result.committed).toBe(true);
    expect(p.result.tier).toBe(2);
    await h.adapter.close(p.source);
  });

  test('delete all and retype in a corpus paragraph', async () => {
    const p = await probe('word retype', await fixture(wordUrl), 1, (b) => ({
      start: 0,
      end: b.text.length,
      inserted: 'A short replacement paragraph.',
    }));
    expect(p.result.committed).toBe(true);
    await h.adapter.close(p.source);
  });
});

describe('scripted edits on the corpus', () => {
  test('insert at the start of the second line', async () => {
    const p = await probe('line start insert', await fixture(wordUrl), 1, (b) => {
      const s = b.lines[1]?.start ?? 0;
      return { start: s, end: s, inserted: 'very ' };
    });
    expect(p.result.committed).toBe(true);
    await h.adapter.close(p.source);
  });

  test('delete across a line boundary', async () => {
    const p = await probe('line boundary delete', await fixture(wordUrl), 1, (b) => {
      const s = b.lines[1]?.start ?? 0;
      return { start: s - 4, end: s + 4, inserted: '' };
    });
    expect(p.result.committed).toBe(true);
    await h.adapter.close(p.source);
  });

  test('delete a word in the first line pulls text up', async () => {
    const p = await probe('first line delete', await fixture(twoColumnUrl), 4, (b) => {
      const first = b.lines[0]?.text ?? '';
      const word = first.split(' ')[1] ?? '';
      return at(b, `${word} `, '');
    });
    expect(p.result.committed).toBe(true);
    await h.adapter.close(p.source);
  });

  test('a double space', async () => {
    const p = await probe('double space', await fixture(wordUrl), 1, (b) => at(b, ' ', '  '));
    expect(p.result.committed).toBe(true);
    await h.adapter.close(p.source);
  });

  test('Turkish letters into a Latin subset font', async () => {
    const p = await probe('turkish', await fixture(latexUrl), 1, (b) =>
      at(b, 'pulley', 'ğİşçöü kasnak'),
    );
    expect(p.result.committed).toBe(true);
    await h.adapter.close(p.source);
  });

  test('long input that rewraps the paragraph', async () => {
    const p = await probe('long', await fixture(fontsUrl), 1, (b) =>
      at(
        b,
        'fox',
        'fox and then the whole crew of the harbour went home along the wall in the evening',
      ),
    );
    expect(p.result.committed).toBe(true);
    await h.adapter.close(p.source);
  });
});

/** Three lines of `words`, each drawn by `line(text, x, y)` (content operators). */
function shaped(line: (text: string, x: number, y: number) => string): string {
  const lines = [
    'The harbour master walked along the quay',
    'and counted the boats that came in with',
    'the evening tide.',
  ];
  return lines.map((text, i) => line(text, 40, 250 - i * 14.4)).join('\n');
}

/** Helvetica 12 pt advance of `text` (AFM widths of the letters the shapes use). */
const HELV: Record<string, number> = {
  ' ': 278,
  '.': 278,
  T: 611,
  a: 556,
  b: 556,
  c: 500,
  d: 556,
  e: 556,
  g: 556,
  h: 556,
  i: 222,
  k: 500,
  l: 222,
  m: 833,
  n: 556,
  o: 556,
  q: 556,
  r: 333,
  s: 500,
  t: 278,
  u: 556,
  v: 500,
  w: 722,
  y: 500,
};
const helvAdvance = (text: string) =>
  Array.from(text).reduce((sum, ch) => sum + ((HELV[ch] ?? 556) * 12) / 1000, 0);

/** Content shapes producers write (each draws the same three lines). */
const SHAPES: Readonly<Record<string, string>> = {
  'one Tj per line': THREE_LINES,
  'TJ with kerning': shaped((text, x, y) => {
    const parts = text.split(' ').map((w) => `(${w.slice(0, 1)}) 30 (${w.slice(1)} )`);
    return `BT /F1 12 Tf 1 0 0 1 ${x} ${y} Tm [${parts.join(' -10 ')}] TJ ET`;
  }),
  'one Td per word': shaped((text, x, y) => {
    const ops: string[] = [`BT /F1 12 Tf ${x} ${y} Td`];
    let prev = 0;
    let cursor = 0;
    for (const word of text.split(' ')) {
      ops.push(`${(cursor - prev).toFixed(3)} 0 Td (${word}) Tj`);
      prev = cursor;
      cursor += helvAdvance(`${word} `);
    }
    return `${ops.join(' ')} ET`;
  }),
  'one Tm per glyph': shaped((text, x, y) => {
    const ops: string[] = ['BT /F1 12 Tf'];
    let cursor = x;
    for (const ch of text) {
      if (ch !== ' ') ops.push(`1 0 0 1 ${cursor.toFixed(3)} ${y} Tm (${ch}) Tj`);
      cursor += helvAdvance(ch);
    }
    return `${ops.join(' ')} ET`;
  }),
  'letter and word spacing (Tc, Tw)': shaped(
    (text, x, y) => `BT /F1 11 Tf 0.4 Tc 1.5 Tw 1 0 0 1 ${x} ${y} Tm (${text}) Tj ET`,
  ),
  'horizontal scaling (Tz)': shaped(
    (text, x, y) => `BT /F1 12 Tf 85 Tz 1 0 0 1 ${x} ${y} Tm (${text}) Tj ET`,
  ),
  'one BT with T* lines': [
    'BT /F1 12 Tf 14.4 TL 1 0 0 1 40 250 Tm (The harbour master walked along the quay) Tj',
    'T* (and counted the boats that came in with) Tj T* (the evening tide.) Tj ET',
  ].join('\n'),
};

const SCRIPTS: Readonly<
  Record<string, (b: ParagraphBlock) => { start: number; end: number; inserted: string }>
> = {
  'a word inserted in line 1': (b) => at(b, 'master', 'old master'),
  'a word deleted in line 1': (b) => at(b, 'master ', ''),
  'a word deleted at the start of line 2': (b) => at(b, 'and ', ''),
  'line 1 deleted whole': (b) => ({ start: 0, end: b.lines[1]?.start ?? 0, inserted: '' }),
  'delete all and retype': (b) => ({ start: 0, end: b.text.length, inserted: 'New words here.' }),
  'Turkish letters': (b) => at(b, 'quay', 'iskele ğİş'),
  'a long insertion that adds lines': (b) =>
    at(
      b,
      'tide.',
      'tide, and then the whole crew went home along the harbour wall for a late supper by the fire.',
    ),
};

describe('content shapes × edits', () => {
  for (const [shape, content] of Object.entries(SHAPES)) {
    for (const [script, edit] of Object.entries(SCRIPTS)) {
      test(`${shape}: ${script}`, async () => {
        const bytes = await rawPdf({ size: [400, 300], content });
        const p = await probe(`${shape}: ${script}`, bytes, 0, edit);
        expect(p.result.committed).toBe(true);
        await h.adapter.close(p.source);
      });
    }
  }
});

describe('every editable paragraph of text-edit-fonts.pdf (WinAnsi, Identity-H subsets, TrueType)', () => {
  const scripts: Readonly<
    Record<string, (b: ParagraphBlock) => { start: number; end: number; inserted: string }>
  > = {
    'delete all and retype': (b) => ({ start: 0, end: b.text.length, inserted: 'Yeni metin.' }),
    'Turkish letters in the middle': (b) => {
      const mid = b.text.indexOf(' ', b.text.length >> 1);
      return { start: mid, end: mid, inserted: ' ğİşçöü' };
    },
    'a word deleted': (b) => at(b, 'quick ', ''),
  };
  test('each script on each paragraph', async () => {
    const bytes = await fixture(fontsUrl);
    const source = await h.open(bytes);
    const blocks = await h.editor.analyzeParagraphs(source, 0);
    const editable: number[] = [];
    for (const [i, b] of blocks.entries()) {
      if (b.refusal !== undefined || !b.text.includes('quick ')) continue;
      const analysis = await h.editor.analyzeParagraphLayout(b.ref);
      if (analysis.refusal === undefined) editable.push(i);
    }
    await h.adapter.close(source);
    expect(editable.length).toBeGreaterThanOrEqual(3);
    const failures: string[] = [];
    for (const i of editable) {
      for (const [name, script] of Object.entries(scripts)) {
        try {
          const p = await probe(`paragraph ${i}: ${name}`, bytes.slice(0), i, script);
          expect(p.result.committed, `paragraph ${i}: ${name}`).toBe(true);
          await h.adapter.close(p.source);
        } catch (error) {
          failures.push(
            `paragraph ${i} (${blocks[i]?.lines[0]?.spans[0]?.font.baseName}): ${name}: ${String(error).slice(0, 4000)}`,
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

/** Index of the paragraph that now reads `text`. */
async function indexOf(source: SourceId, text: string): Promise<number> {
  const blocks = await h.editor.analyzeParagraphs(source, 0);
  const index = blocks.findIndex((b) => b.text === collapsed(text));
  if (index < 0) {
    throw new Error(`no paragraph reads "${text}": ${blocks.map((b) => b.text).join(' | ')}`);
  }
  return index;
}

describe('an edit after an edit (the paragraph reopened)', () => {
  type Script = (b: ParagraphBlock) => { start: number; end: number; inserted: string };
  const cases: readonly {
    readonly name: string;
    readonly bytes: () => Promise<ArrayBuffer>;
    readonly index: number;
    readonly first: Script;
    readonly second: Script;
  }[] = [
    {
      name: 'retyped, then a word added',
      bytes: () => rawPdf({ size: [400, 300], content: THREE_LINES }),
      index: 0,
      first: (b) => ({ start: 0, end: b.text.length, inserted: 'Hello world.' }),
      second: (b) => at(b, 'world', 'wide world'),
    },
    {
      name: 'double space, then a word inserted after it',
      bytes: () => fixture(wordUrl),
      index: 1,
      first: (b) => at(b, ' ', '  '),
      second: (b) => at(b, 'ferry', 'old ferry'),
    },
    {
      name: 'Turkish letters, then more of them',
      bytes: () => fixture(latexUrl),
      index: 1,
      first: (b) => at(b, 'pulley', 'ğİşçöü kasnak'),
      second: (b) => at(b, 'kasnak', 'kasnağı şöyle'),
    },
    {
      name: 'a long rewrap, then a deletion in the first line',
      bytes: () => fixture(fontsUrl),
      index: 1,
      first: (b) =>
        at(b, 'fox', 'fox and then the whole crew of the harbour went home along the wall'),
      second: (b) => at(b, 'quick ', ''),
    },
  ];
  for (const c of cases) {
    test(c.name, async () => {
      const p = await probe(`${c.name} (1)`, await c.bytes(), c.index, c.first);
      const index = await indexOf(p.source, p.edit.text);
      const q = await probe(`${c.name} (2)`, p.source, index, c.second);
      expect(q.result.committed).toBe(true);
      await h.adapter.close(p.source);
    });
  }
});
