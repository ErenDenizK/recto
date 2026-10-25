/** Markdown parser (PRD-28): one test per construct. */
import { describe, expect, test } from 'vitest';

import { type InlineRun, type MdBlock, parseInline, parseMarkdown } from './markdown-parse';

const texts = (runs: readonly InlineRun[]) => runs.map((r) => r.text).join('');
const only = (md: string): MdBlock => {
  const blocks = parseMarkdown(md);
  expect(blocks).toHaveLength(1);
  return blocks[0] as MdBlock;
};
const flags = (r: InlineRun) =>
  `${r.text}|${r.bold ? 'b' : ''}${r.italic ? 'i' : ''}${r.code ? 'c' : ''}`;
const runsOf = (block: MdBlock) => (block as unknown as { runs: InlineRun[] }).runs;

describe('headings', () => {
  test('h1 to h6, with closing hashes', () => {
    for (let level = 1; level <= 6; level++) {
      const block = only(`${'#'.repeat(level)} Title ${'#'.repeat(level)}`);
      expect(block).toMatchObject({ kind: 'heading', level });
      expect(texts(runsOf(block))).toBe('Title');
    }
  });
  test('seven hashes and #tag are paragraphs', () => {
    expect(only('####### x').kind).toBe('paragraph');
    expect(only('#tag').kind).toBe('paragraph');
  });
  test('setext headings', () => {
    expect(only('Title\n=====')).toMatchObject({ kind: 'heading', level: 1 });
    expect(only('Title\n-----')).toMatchObject({ kind: 'heading', level: 2 });
  });
  test('--- after a blank line is a rule, not a setext h2', () => {
    expect(parseMarkdown('para\n\n---\n').map((b) => b.kind)).toEqual(['paragraph', 'rule']);
    expect(parseMarkdown('* * *').map((b) => b.kind)).toEqual(['rule']);
  });
});

describe('paragraphs', () => {
  test('lines join with a space', () => {
    expect(texts(runsOf(only('one\ntwo\n  three')))).toBe('one two three');
  });
  test('two trailing spaces or a backslash are a hard break', () => {
    expect(texts(runsOf(only('one  \ntwo')))).toBe('one\ntwo');
    expect(texts(runsOf(only('one\\\ntwo')))).toBe('one\ntwo');
  });
  test('a blank line separates paragraphs', () => {
    expect(parseMarkdown('a\n\nb').map((b) => b.kind)).toEqual(['paragraph', 'paragraph']);
  });
  test('a form feed is a page break', () => {
    expect(parseMarkdown('a\fb').map((b) => b.kind)).toEqual([
      'paragraph',
      'pagebreak',
      'paragraph',
    ]);
    expect(parseMarkdown('a\f').map((b) => b.kind)).toEqual(['paragraph']);
  });
});

describe('inline', () => {
  test('bold, italic, bold italic', () => {
    expect(parseInline('a **b** *c* ***d***').map(flags)).toEqual([
      'a |',
      'b|b',
      ' |',
      'c|i',
      ' |',
      'd|bi',
    ]);
  });
  test('underscore emphasis; snake_case_word stays literal', () => {
    expect(parseInline('_i_ and __b__').map(flags)).toEqual(['i|i', ' and |', 'b|b']);
    expect(parseInline('snake_case_word').map(flags)).toEqual(['snake_case_word|']);
  });
  test('unmatched delimiters stay literal', () => {
    expect(texts(parseInline('2 * 3 and *x'))).toBe('2 * 3 and *x');
  });
  test('code spans, with backticks inside, are not parsed further', () => {
    expect(parseInline('a `**x**` b').map(flags)).toEqual(['a |', '**x**|c', ' b|']);
    expect(parseInline('`` a`b ``').map(flags)).toEqual(['a`b|c']);
  });
  test('escapes', () => {
    expect(texts(parseInline('\\*not\\* \\# \\a'))).toBe('*not* # \\a');
  });
  test('links drop the title; the text can be styled', () => {
    expect(parseInline('see [**Recto** app](https://x.io/a_b "T") now')).toEqual([
      { text: 'see ', bold: false, italic: false, code: false },
      { text: 'Recto', bold: true, italic: false, code: false, href: 'https://x.io/a_b' },
      { text: ' app', bold: false, italic: false, code: false, href: 'https://x.io/a_b' },
      { text: ' now', bold: false, italic: false, code: false },
    ]);
  });
  test('autolinks and images', () => {
    expect(parseInline('<https://a.b/c> <mailto:x@y.z>').map((r) => [r.text, r.href])).toEqual([
      ['https://a.b/c', 'https://a.b/c'],
      [' ', undefined],
      ['x@y.z', 'mailto:x@y.z'],
    ]);
    expect(texts(parseInline('![the logo](a.png)'))).toBe('the logo');
  });
  test('a bracket without a destination is literal', () => {
    expect(texts(parseInline('[a] and [b](c'))).toBe('[a] and [b](c');
  });
});

interface Item {
  runs: InlineRun[];
  children: { items: Item[] }[];
}

describe('lists', () => {
  test('bullets with - * +', () => {
    for (const mark of ['-', '*', '+']) {
      const block = only(`${mark} a\n${mark} b`);
      expect(block).toMatchObject({ kind: 'list', ordered: false });
      expect((block as unknown as { items: unknown[] }).items).toHaveLength(2);
    }
  });
  test('numbered lists keep their start number, with . or )', () => {
    expect(only('1. a\n2. b')).toMatchObject({ ordered: true, start: 1 });
    expect(only('3) a\n4) b')).toMatchObject({ ordered: true, start: 3 });
  });
  test('nesting and continuation lines', () => {
    const block = only('- a\n  more of a\n  - b\n    - c\n- d') as unknown as { items: Item[] };
    expect(block.items.map((i) => texts(i.runs))).toEqual(['a more of a', 'd']);
    const nested = block.items[0]?.children[0];
    expect(nested?.items.map((i) => texts(i.runs))).toEqual(['b']);
    expect(nested?.items[0]?.children).toHaveLength(1);
  });
  test('a blank line keeps one list when the next line is an item', () => {
    expect(parseMarkdown('- a\n\n- b').map((b) => b.kind)).toEqual(['list']);
    expect(parseMarkdown('- a\n\npara').map((b) => b.kind)).toEqual(['list', 'paragraph']);
  });
});

describe('code and quotes', () => {
  test('a ~~~ fence keeps Markdown literal', () => {
    expect(only('~~~js\n# not a heading\n**x**\n~~~')).toEqual({
      kind: 'code',
      lines: ['# not a heading', '**x**'],
    });
  });
  test('an unclosed fence runs to the end', () => {
    expect(only('```\na\n\nb')).toEqual({ kind: 'code', lines: ['a', '', 'b'] });
  });
  test('a quote holds a list and lazy continuation', () => {
    const block = only('> intro\n> - a\n> - b') as { kind: 'quote'; blocks: MdBlock[] };
    expect(block.kind).toBe('quote');
    expect(block.blocks.map((b) => b.kind)).toEqual(['paragraph', 'list']);
    const lazy = only('> one\ntwo') as unknown as { blocks: MdBlock[] };
    expect(texts(runsOf(lazy.blocks[0] as MdBlock))).toBe('one two');
  });
});

describe('tables (PRD-30)', () => {
  const table = (md: string) => only(md) as Extract<MdBlock, { kind: 'table' }>;
  test('a header row, alignment from the delimiter row and padded body rows', () => {
    const t = table(
      '| Name | Qty | Note |\n|:-----|:---:|-----:|\n| a | 1 |\n| b | 2 | x | extra |',
    );
    expect(t.kind).toBe('table');
    expect(t.align).toEqual(['left', 'center', 'right']);
    expect(t.head.map(texts)).toEqual(['Name', 'Qty', 'Note']);
    expect(t.rows.map((r) => r.map(texts))).toEqual([
      ['a', '1', ''],
      ['b', '2', 'x'],
    ]);
  });
  test('outer pipes are optional, an escaped pipe stays in the cell, inline styles work', () => {
    const t = table('a | **b**\n--|--\nx \\| y | `z`');
    expect(t.head.map(texts)).toEqual(['a', 'b']);
    expect(t.head[1]?.[0]?.bold).toBe(true);
    expect(t.rows[0]?.map(texts)).toEqual(['x | y', 'z']);
  });
  test('a table ends at a blank line; text after it is a paragraph', () => {
    expect(parseMarkdown('| a |\n|---|\n| 1 |\n\nafter').map((b) => b.kind)).toEqual([
      'table',
      'paragraph',
    ]);
  });
  test('a following block line ends the table, even with a pipe in it', () => {
    for (const after of ['- a | b', '> x|y', '# T | u'])
      expect(parseMarkdown(`| a |\n|---|\n| 1 |\n${after}`).map((b) => b.kind)).toEqual([
        'table',
        after.startsWith('-') ? 'list' : after.startsWith('>') ? 'quote' : 'heading',
      ]);
  });
  test('only a single backslash escapes a pipe; an escaped backslash does not', () => {
    const t = table('| a | b |\n|---|---|\n| x \\\\| y | p \\| q |');
    expect(t.rows[0]?.map(texts)).toEqual(['x \\', 'y']);
    expect(table('| a |\n|---|\n| p \\| q |').rows[0]?.map(texts)).toEqual(['p | q']);
  });
  test('a pipe line without a matching delimiter row stays a paragraph', () => {
    expect(only('| a | b |\n|---|').kind).toBe('paragraph');
    expect(only('a | b').kind).toBe('paragraph');
  });
});
