/**
 * The paragraph editor's model over the text-edit corpus (craft spec §4.2, §4.7, §4.8;
 * `packages/engine/src/text-edit/edit-matrix.test.ts` runs the same pages at the engine
 * level): real paragraphs from `test/fixtures/text-edit-corpus/`, opened as the editor opens
 * them (`analyzeParagraphLayout` on the real engine), driven key by key through the model's
 * own operations (`insertText`, `deleteBackward`, `deleteForward`, `selectAll`, `moveTo`),
 * laid out by `relayout` after every key, then committed as `ParagraphEditor` commits
 * (`paragraphEdit`'s range, style and spans, with the layout shown) and read back.
 *
 * After every key, `caretLines` must stay sane: on every line the caret x positions never go
 * backwards, every visible character takes room (its next caret stop lies right of it), and
 * every character has a style of the layout input. After the commit, the page reads the typed
 * text (white space compared as one space) and the edited lines' glyph origins strictly
 * increase.
 *
 * Known failures are `test.fails` with the bug they reproduce (`KNOWN`).
 */
import wasmUrl from '@embedpdf/pdfium/pdfium.wasm?url';
import { sourceId, type SourceId } from '@pdf-editor/document-model';
import {
  createHostedEngine,
  createTextEditor,
  decideOverflow,
  type HostedTextEditor,
  layoutParagraph,
  type LocatedRun,
  type ParagraphBlock,
  PdfiumAdapter,
} from '@pdf-editor/engine';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import cidTurkishUrl from '../../../../test/fixtures/text-edit-corpus/cid-turkish.pdf?url';
import latexUrl from '../../../../test/fixtures/text-edit-corpus/latex-justified.pdf?url';
import perGlyphUrl from '../../../../test/fixtures/text-edit-corpus/per-glyph.pdf?url';
import spacingUrl from '../../../../test/fixtures/text-edit-corpus/spacing-ops.pdf?url';
import wordExportUrl from '../../../../test/fixtures/text-edit-corpus/word-export.pdf?url';
import wordTaggedUrl from '../../../../test/fixtures/text-edit-corpus/word-tagged.pdf?url';
import {
  caretLines,
  deleteBackward,
  deleteForward,
  initialState,
  insertText,
  type LayoutFunctions,
  moveTo,
  type ParagraphSetup,
  type ParagraphState,
  paragraphEdit,
  originalStylesOf,
  relayout,
  selectAll,
} from './paragraph-model';

const fns: LayoutFunctions = { layoutParagraph, decideOverflow };

let adapter: PdfiumAdapter;
let editor: HostedTextEditor;
let opened = 0;

beforeAll(async () => {
  const host = await createHostedEngine({ wasm: wasmUrl });
  adapter = new PdfiumAdapter({ wasmUrl, engineFactory: () => host.engine });
  editor = createTextEditor(host);
});

afterAll(async () => {
  await adapter.destroy();
});

const bytesByUrl = new Map<string, ArrayBuffer>();

async function open(url: string): Promise<SourceId> {
  let bytes = bytesByUrl.get(url);
  if (!bytes) {
    bytes = await (await fetch(url)).arrayBuffer();
    bytesByUrl.set(url, bytes);
  }
  const id = sourceId(`edit-matrix-${++opened}`);
  await adapter.open(id, bytes.slice(0));
  return id;
}

// ---------------------------------------------------------------------------
// Corpus and key scripts
// ---------------------------------------------------------------------------

interface Target {
  readonly file: string;
  readonly url: string;
  readonly paragraphs: readonly number[];
}

const TARGETS: readonly Target[] = [
  { file: 'word-export.pdf', url: wordExportUrl, paragraphs: [2, 3] },
  { file: 'per-glyph.pdf', url: perGlyphUrl, paragraphs: [0] },
  { file: 'cid-turkish.pdf', url: cidTurkishUrl, paragraphs: [1] },
  { file: 'spacing-ops.pdf', url: spacingUrl, paragraphs: [0] },
  { file: 'word-tagged.pdf', url: wordTaggedUrl, paragraphs: [1] },
  { file: 'latex-justified.pdf', url: latexUrl, paragraphs: [1] },
];

/** One key the mirror turns into a model operation. */
type Key =
  | { readonly kind: 'type'; readonly text: string }
  | { readonly kind: 'paste'; readonly text: string }
  | { readonly kind: 'backspace'; readonly unit?: 'word' }
  | { readonly kind: 'delete' }
  | { readonly kind: 'select-all' }
  | { readonly kind: 'caret'; readonly at: number };

function press(state: ParagraphState, key: Key): ParagraphState {
  switch (key.kind) {
    case 'type':
    case 'paste':
      return insertText(state, key.text);
    case 'backspace':
      return deleteBackward(state, key.unit ?? 'char');
    case 'delete':
      return deleteForward(state);
    case 'select-all':
      return selectAll(state);
    case 'caret':
      return moveTo(state, key.at, false);
  }
}

/** Typing `text` one character (code point) per key. */
const typing = (text: string): Key[] => Array.from(text).map((ch) => ({ kind: 'type', text: ch }));

function firstWordEnd(text: string): number {
  const m = /^\S+/u.exec(text);
  return m ? m[0].length : 0;
}

/** Where line 0's visible text ends (before the joining space or line break). */
function endOfFirstLine(block: ParagraphBlock): number | undefined {
  const [first, second] = block.lines;
  if (!first || !second) return undefined;
  return first.end === 'space' || first.end === 'forced' ? second.start - 1 : second.start;
}

const SCRIPTS: Record<string, (block: ParagraphBlock) => Key[] | undefined> = {
  'type-mid-word': (b) => {
    const at = Math.min(2, firstWordEnd(b.text));
    return [{ kind: 'caret', at }, ...typing('re')];
  },
  'type-at-end': (b) => [{ kind: 'caret', at: b.text.length }, ...typing(' and more')],
  'space-double': (b) => [{ kind: 'caret', at: firstWordEnd(b.text) }, ...typing('  ')],
  'backspace-line-start': (b) => {
    const second = b.lines[1];
    return second ? [{ kind: 'caret', at: second.start }, { kind: 'backspace' }] : undefined;
  },
  'delete-line-end': (b) => {
    const end = endOfFirstLine(b);
    return end === undefined ? undefined : [{ kind: 'caret', at: end }, { kind: 'delete' }];
  },
  'word-backspace': (b) => [
    { kind: 'caret', at: firstWordEnd(b.text) },
    { kind: 'backspace', unit: 'word' },
    ...typing('One'),
  ],
  'select-all-type': () => [{ kind: 'select-all' }, ...typing('New text here')],
  'select-all-delete-type': () => [
    { kind: 'select-all' },
    { kind: 'backspace' },
    ...typing('New text here'),
  ],
  'backspace-everything-type': (b) => [
    { kind: 'caret', at: b.text.length },
    ...Array.from({ length: Array.from(b.text).length }, (): Key => ({ kind: 'backspace' })),
    ...typing('New text here'),
  ],
  turkish: (b) => [{ kind: 'caret', at: firstWordEnd(b.text) }, ...typing(' ığüşöç İĞÜŞÖÇ')],
  'paste-newlines': (b) => [
    { kind: 'caret', at: firstWordEnd(b.text) },
    { kind: 'paste', text: ' pasted line one\npasted line two\n' },
  ],
};

/**
 * Known failures: `file#paragraph script` → the bug (each seen failing before it was listed).
 */
const KNOWN: Record<string, string> = {};

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const collapse = (text: string) => text.replace(/\s+/gu, ' ').trim();
const isBlank = (ch: string) => /^\s*$/u.test(ch);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** `caretLines` after a key: monotonic, every visible character takes room, known styles. */
function checkCarets(
  setup: ParagraphSetup,
  state: ParagraphState,
  step: string,
  out: string[],
): ReturnType<typeof relayout> {
  const laid = relayout(fns, setup, state);
  state.styles.forEach((style, i) => {
    if (!(style in setup.input.styles)) {
      out.push(
        `${step}: character ${i} "${state.text[i]}" has unknown style ${JSON.stringify(style)}`,
      );
    }
  });
  const lines = caretLines(setup, state, laid.layout);
  lines.forEach((line, li) => {
    const text = laid.layout.text;
    for (let k = 0; k + 1 < line.xs.length; k++) {
      const x0 = line.xs[k] ?? 0;
      const x1 = line.xs[k + 1] ?? 0;
      const ch = text[line.start + k] ?? '';
      if (x1 < x0 - 0.01) {
        out.push(`${step}: line ${li} caret goes back ${r2(x0)} → ${r2(x1)} after "${ch}"`);
        return;
      }
      // The trail unit of a surrogate pair shares its lead's x.
      const code = text.charCodeAt(line.start + k);
      if (!isBlank(ch) && !(code >= 0xd800 && code <= 0xdbff) && x1 - x0 < 0.01) {
        out.push(
          `${step}: line ${li} "${ch}" takes no room (caret ${r2(x0)} → ${r2(x1)}) in ${JSON.stringify(line.status)} line "${text.slice(line.start, line.end)}"`,
        );
        return;
      }
    }
  });
  return laid;
}

/** Glyph origins on each line of the edited area strictly increase (no bunching). */
function checkGlyphs(
  runs: readonly LocatedRun[],
  area: { x: number; y: number; width: number; height: number },
  out: string[],
): void {
  const lines = new Map<number, LocatedRun['glyphs'][number][]>();
  for (const run of runs) {
    for (const g of run.glyphs) {
      const { x, y } = g.origin;
      if (x < area.x - 1 || x > area.x + area.width + 1) continue;
      if (y < area.y - 1 || y > area.y + area.height + 1) continue;
      const key = Math.round(y * 2) / 2;
      lines.set(key, [...(lines.get(key) ?? []), g]);
    }
  }
  for (const [baseline, glyphs] of lines) {
    glyphs.sort((a, b) => a.origin.x - b.origin.x);
    for (let i = 1; i < glyphs.length; i++) {
      const a = glyphs[i - 1];
      const b = glyphs[i];
      if (!a || !b || isBlank(a.text) || isBlank(b.text)) continue;
      // A ligature (`fi`) reads as several characters on one box.
      if (Math.abs(a.rect.x - b.rect.x) < 0.01 && Math.abs(a.rect.width - b.rect.width) < 0.01) {
        continue;
      }
      if (b.origin.x - a.origin.x < 0.05) {
        out.push(
          `glyphs "${a.text}${b.text}" on baseline ${baseline} share x ${r2(a.origin.x)} (line "${glyphs.map((g) => g.text).join('')}")`,
        );
        return;
      }
    }
  }
}

async function runScript(
  target: Target,
  index: number,
  script: (block: ParagraphBlock) => Key[] | undefined,
): Promise<{ broken: string[] } | 'skip'> {
  const out: string[] = [];
  const source = await open(target.url);
  try {
    const blocks = await editor.analyzeParagraphs(source, 0);
    const block = blocks.find((b) => b.ref.index === index);
    if (!block || block.refusal)
      return { broken: [`paragraph ${index}: ${block?.refusal ?? 'missing'}`] };
    const keys = script(block);
    if (!keys) return 'skip';
    const analysis = await editor.analyzeParagraphLayout(block.ref);
    if (analysis.refusal) return { broken: [`layout refused: ${analysis.refusal}`] };
    const setup: ParagraphSetup = {
      block,
      input: analysis.input,
      paragraphGap: analysis.paragraphGap,
      gapBelow: analysis.gapBelow,
      pageRoom: analysis.pageRoom,
    };
    let state = initialState(setup.input, 0);
    let laid = checkCarets(setup, state, 'open', out);
    keys.forEach((key, k) => {
      state = press(state, key);
      if (out.length < 4) laid = checkCarets(setup, state, `key ${k + 1} (${key.kind})`, out);
      else laid = relayout(fns, setup, state);
    });
    const edit = paragraphEdit(setup.input.text, state, originalStylesOf(setup.input));
    if (!edit) return { broken: out };
    if (laid.layout.unsupported.length > 0) {
      out.push(`unsupported ${laid.layout.unsupported.join('')}`);
      return { broken: out };
    }
    if (laid.decision.kind === 'overflow') return { broken: out };
    try {
      const result = await editor.applyParagraphEdit(
        source,
        0,
        {
          ref: block.ref,
          text: state.text,
          caretSpan: { start: edit.start, end: edit.end },
          ...(edit.style === undefined ? {} : { style: edit.style }),
          ...(edit.spans === undefined ? {} : { spans: edit.spans }),
          layout: laid.layout,
        },
        { commit: true },
      );
      const page = collapse(
        (await editor.analyzeParagraphs(source, 0)).map((b) => b.text).join(' '),
      );
      if (!page.includes(collapse(state.text))) {
        out.push(
          `read-back lacks ${JSON.stringify(collapse(state.text))}; page reads ${JSON.stringify(page)}`,
        );
      }
      checkGlyphs(await editor.locateRuns(source, 0), result.box, out);
    } catch (error) {
      out.push(`write refused: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { broken: out };
  } finally {
    await adapter.close(source);
  }
}

for (const target of TARGETS) {
  describe(`paragraph model matrix: ${target.file}`, () => {
    for (const index of target.paragraphs) {
      for (const [name, script] of Object.entries(SCRIPTS)) {
        const key = `${target.file}#${index} ${name}`;
        const known = KNOWN[key];
        const run = known ? test.fails : test;
        run(`#${index} ${name}${known ? ` (known: ${known})` : ''}`, async () => {
          const outcome = await runScript(target, index, script);
          if (outcome === 'skip') return;
          if (outcome.broken.length > 0) {
            console.warn(`[model-matrix] ${key}\n  ${outcome.broken.join('\n  ')}`);
          }
          expect(outcome.broken, key).toEqual([]);
        });
      }
    }
  });
}
