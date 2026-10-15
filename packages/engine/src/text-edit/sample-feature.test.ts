/**
 * The teaching sample's feature page edits well (MOB-11; docs/design/sample-2026-10/design.md
 * §4 page 3): in each of the four files (full and phone, English and Turkish), every designated
 * edit target is detected as one paragraph with the alignment it was set in (justified by TJ
 * offsets, TXT-10), tagged and with the tags stripped (a saved copy loses them, technical.md
 * §3); and the edits the page invites commit and read back: the planted corrections (a cat
 * that was a dog, 1906 that was 1904), a sentence added to the end of column 1 (grows into the
 * free lines and stays justified), words added mid-column, a deletion, a name in the byline.
 *
 * The edits are made the way the app makes them (the overlay's layout from
 * `analyzeParagraphLayout`, `layoutParagraph` + `decideOverflow`, the caret's style), as in
 * `edit-matrix.test.ts`.
 */
import { PDFDocument, PDFName } from '@cantoo/pdf-lib';
import type { SourceId } from '@pdf-editor/document-model';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import manifest from '../../../../apps/web/test/sample-manifest.json';
import enUrl from '../../../../apps/web/public/sample/recto-sample-en.pdf?url';
import phoneEnUrl from '../../../../apps/web/public/sample/recto-sample-phone-en.pdf?url';
import phoneTrUrl from '../../../../apps/web/public/sample/recto-sample-phone-tr.pdf?url';
import trUrl from '../../../../apps/web/public/sample/recto-sample-tr.pdf?url';
import type { ParagraphBlock, ParagraphEdit } from '../types';
import { type LayoutEdit, layoutParagraph } from './linebreak';
import { decideOverflow } from './overflow';
import { createHarness, fixture, type Harness } from './test-helpers';

const URLS: Record<string, string> = {
  'recto-sample-en.pdf': enUrl,
  'recto-sample-tr.pdf': trUrl,
  'recto-sample-phone-en.pdf': phoneEnUrl,
  'recto-sample-phone-tr.pdf': phoneTrUrl,
};

let h: Harness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.adapter.destroy();
});

const collapse = (text: string) => text.replace(/\s+/gu, ' ').trim();

type Entry = (typeof manifest.files)[number];

function target(blocks: readonly ParagraphBlock[], start: string): ParagraphBlock | undefined {
  return blocks.find((b) => collapse(b.text).startsWith(start));
}

/** The file with its structure tree removed, as a saved copy is (the assembler drops it). */
async function untagged(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  doc.catalog.delete(PDFName.of('StructTreeRoot'));
  doc.catalog.delete(PDFName.of('MarkInfo'));
  for (const page of doc.getPages()) page.node.delete(PDFName.of('StructParents'));
  const out = await doc.save({ useObjectStreams: false });
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

async function checkDetection(entry: Entry, bytes: ArrayBuffer, label: string): Promise<void> {
  const source = await h.open(bytes);
  try {
    const blocks = await h.editor.analyzeParagraphs(source, entry.featurePage - 1);
    const broken: string[] = [];
    for (const [key, t] of Object.entries(entry.edit)) {
      const block = target(blocks, t.start);
      if (!block) {
        broken.push(`${key}: no block starts "${t.start}"`);
        continue;
      }
      if (block.refusal) broken.push(`${key}: refused (${block.refusal})`);
      if (block.align !== t.align) broken.push(`${key}: ${block.align}, set ${t.align}`);
      if (block.lines.length !== t.lines)
        broken.push(`${key}: ${block.lines.length} lines, set ${t.lines}`);
    }
    expect(broken, `${entry.file} ${label}`).toEqual([]);
  } finally {
    await h.adapter.close(source);
  }
}

describe.each(manifest.files)('the sample $file, feature page', (entry) => {
  test('every edit target is one paragraph with its alignment (tagged)', async () => {
    await checkDetection(entry, await fixture(URLS[entry.file] as string), 'tagged');
  });

  test('and with the tags stripped, as after a saved copy', async () => {
    await checkDetection(
      entry,
      await untagged(await fixture(URLS[entry.file] as string)),
      'untagged',
    );
  });
});

// ---------------------------------------------------------------------------
// Edits
// ---------------------------------------------------------------------------

interface Scenario {
  readonly name: string;
  /** The paragraph's first words (as the manifest gives them) or a literal start. */
  readonly start: (entry: Entry) => string;
  readonly edit: (
    block: ParagraphBlock,
    locale: string,
  ) => { start: number; end: number; text: string };
  /** Decisions the overflow policy may take; the default is any but off-page overflow. */
  readonly decisions?: readonly string[];
  /** The paragraph reads back justified. */
  readonly justified?: boolean;
}

const replaceWord = (block: ParagraphBlock, word: string, by: string) => {
  const at = block.text.indexOf(word);
  if (at < 0) throw new Error(`"${word}" not in "${block.text}"`);
  return { start: at, end: at + word.length, text: by };
};

const SCENARIOS: readonly Scenario[] = [
  {
    name: 'P1: the planted error, a cat that was a dog (retype)',
    start: (e) => e.edit.p1?.start ?? '',
    edit: (b, l) =>
      l === 'tr' ? replaceWord(b, 'kediyle', 'köpekle') : replaceWord(b, 'cat', 'dog'),
    justified: true,
  },
  {
    name: 'P4: a sentence added to the end of column 1 grows into the free lines',
    start: (e) => e.edit.p4?.start ?? '',
    edit: (b, l) => ({
      start: b.text.length,
      end: b.text.length,
      text:
        l === 'tr'
          ? ' Martta kutu geldiğinden beri tek bir akşamı bile kaçırmadı.'
          : ' She has not missed an evening since the box arrived in March.',
    }),
    decisions: ['grow'],
    justified: true,
  },
  {
    name: 'P2: words added mid-column (tighten, or the overflow choice)',
    start: (e) => e.edit.p2?.start ?? '',
    edit: (b, l) => {
      const word = l === 'tr' ? 'rüzgârı,' : 'the wind,';
      const at = b.text.indexOf(word);
      return { start: at, end: at, text: l === 'tr' ? 'barometreyi, ' : 'the barometer, ' };
    },
  },
  {
    name: 'P5: a word deleted',
    start: (e) => e.edit.p5?.start ?? '',
    edit: (b, l) => replaceWord(b, l === 'tr' ? 'yumuşak ' : 'soft ', ''),
    justified: true,
  },
  {
    name: 'caption: 1906 that was 1904',
    start: (e) => (e.locale === 'tr' ? '1906’da yapılan' : 'The first-order lens'),
    edit: (b) => replaceWord(b, '1906', '1904'),
  },
  {
    name: 'byline: your name in it (typed in the bold span)',
    start: (e) => (e.locale === 'tr' ? 'Yazı Defne' : 'Words Defne'),
    edit: (b) => replaceWord(b, 'Defne Aras', 'Ada Rosen'),
  },
];

/** The style typed text takes: the character before the caret, else the first span's. */
function caretStyle(spans: readonly { start: number; end: number; style: string }[], at: number) {
  return (spans.find((s) => s.start < at && at <= s.end) ?? spans[0])?.style;
}

async function runEdit(entry: Entry, scenario: Scenario): Promise<string[]> {
  const out: string[] = [];
  const source: SourceId = await h.open(await fixture(URLS[entry.file] as string));
  const page = entry.featurePage - 1;
  try {
    const blocks = await h.editor.analyzeParagraphs(source, page);
    const block = target(blocks, scenario.start(entry));
    if (!block) return [`no block starts "${scenario.start(entry)}"`];
    const analysis = await h.editor.analyzeParagraphLayout(block.ref);
    if (analysis.refusal) return [`layout refused: ${analysis.refusal}`];
    const r = scenario.edit(block, entry.locale);
    const typed = block.text.slice(0, r.start) + r.text + block.text.slice(r.end);
    const style = caretStyle(analysis.input.spans, r.start);
    const layoutEdit: LayoutEdit = { ...r, ...(style === undefined ? {} : { style }) };
    const decision = decideOverflow(
      layoutParagraph(analysis.input, layoutEdit),
      {
        input: analysis.input,
        edit: layoutEdit,
        paragraphGap: analysis.paragraphGap,
        pageRoom: analysis.pageRoom,
      },
      analysis.gapBelow,
    );
    if (scenario.decisions && !scenario.decisions.includes(decision.kind))
      out.push(`decided ${decision.kind}, want ${scenario.decisions.join(' or ')}`);
    if (decision.kind === 'overflow' && decision.offPage) return [...out, 'overflow off the page'];
    if (decision.layout.unsupported.length > 0)
      out.push(`unsupported characters ${decision.layout.unsupported.join('')}`);
    const edit: ParagraphEdit = {
      ref: block.ref,
      text: typed,
      caretSpan: { start: r.start, end: r.end },
      ...(style === undefined ? {} : { style }),
      layout: decision.layout,
    };
    const result = await h.editor.applyParagraphEdit(source, page, edit, { commit: true });
    if (!result.committed) out.push('not committed');
    if (decision.kind === 'overflow') return out;
    const after = await h.editor.analyzeParagraphs(source, page);
    const back = after.find((b) => collapse(b.text) === collapse(typed));
    if (!back) {
      out.push(`read-back lacks ${JSON.stringify(collapse(typed))}`);
      return out;
    }
    // A justified paragraph reads back justified, unless the layout left a line ragged (its gaps
    // would have stretched past the paragraph's own cap, TXT-15), as in edit-matrix.test.ts.
    if (
      scenario.justified &&
      !decision.layout.ragged &&
      back.lines.length >= 3 &&
      back.align !== 'justify'
    )
      out.push(`read back as ${back.align}, was justify`);
    // And it survives a save and a reopen.
    const reopened = await h.open(await h.adapter.save(source));
    try {
      const again = await h.editor.analyzeParagraphs(reopened, page);
      if (!again.some((b) => collapse(b.text) === collapse(typed)))
        out.push('the reopened file lacks the edit');
    } finally {
      await h.adapter.close(reopened);
    }
    return out;
  } finally {
    await h.adapter.close(source);
  }
}

describe.each(manifest.files.filter((f) => f.edition === 'full' || f.locale === 'en'))(
  'the sample $file, editing the feature',
  (entry) => {
    for (const scenario of SCENARIOS) {
      test(scenario.name, async () => {
        expect(await runEdit(entry, scenario), `${entry.file}: ${scenario.name}`).toEqual([]);
      });
    }
  },
);
