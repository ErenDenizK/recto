/**
 * The teaching sample's builder (MOB-11, MOB-12; docs/design/sample-2026-10/technical.md §4):
 * for each language and edition, deterministic and byte-identical to the file the app serves,
 * within the caps, the manifest current, and shaped as the catalog says: its pages and
 * outline, the form's fields on the agreement page, no text on the scan page, the cover's
 * links to their pages, the language, tagged; and no full-only page in a phone file.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFString,
} from '@cantoo/pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';

import { sha256 } from './lib/common.ts';
import {
  SAMPLE_DIR,
  SAMPLE_EDITIONS,
  SAMPLE_LOCALES,
  SAMPLE_MANIFEST,
  SAMPLE_MAX_BYTES,
  buildSample,
  buildSamples,
  manifestText,
  sampleFile,
  sizeProblems,
} from './sample-fixture.ts';
import { COPY } from './sample/copy.ts';
import { NO_BREAK, lineProblems, mayBreakAt } from './sample/kit.ts';

let built: Awaited<ReturnType<typeof buildSamples>>;

beforeAll(async () => {
  built = await buildSamples();
}, 60_000);

/** The decoded content of every stream a page's /Contents names. */
function pageContent(doc: PDFDocument, index: number): string {
  const contents = doc.getPage(index).node.get(PDFName.of('Contents'));
  const refs =
    contents instanceof PDFArray ? contents.asArray() : contents === undefined ? [] : [contents];
  return refs
    .map((ref) => {
      const stream = doc.context.lookup(ref);
      if (!(stream instanceof PDFRawStream)) return '';
      const filter = stream.dict.get(PDFName.of('Filter'));
      const bytes = stream.getContents();
      return Buffer.from(filter ? inflateSync(bytes) : bytes).toString('latin1');
    })
    .join('\n');
}

const text = (value: unknown) =>
  value instanceof PDFString || value instanceof PDFHexString ? value.decodeText() : undefined;

describe('line breaks (MOB-15)', () => {
  /** Whether a line may break before each word of `phrase` but the first. */
  const breaks = (phrase: string) =>
    phrase.split(' ').flatMap((_, k, words) => (k === 0 ? [] : [mayBreakAt(words, k)]));

  it('never break inside a listed phrase, a number and its unit, a date or a shortcut', () => {
    for (const phrase of NO_BREAK) expect(breaks(phrase), phrase).not.toContain(true);
    // Each phrase with the breaks it allows (before word k), the critique's cases among them.
    const cases: [string, number[]][] = [
      ['from 1 January 2027.', []],
      ['1 Ocak 2027’den itibaren', [3]],
      ['climbed 112 steps every', [3]],
      ['within 30 days of', [3]],
      ['on page 3.', [1]],
      ['3. sayfada', []],
      ['Save (Ctrl+S; Cmd+S on a Mac) writes', [1, 6]],
      ['Ctrl+F’ye (Mac’te Cmd+F) basın', [1, 3]],
      ['keeps: a lamp', [1]],
      ['covers your piece in No. 07. We may print', [1, 2, 3, 4, 8]],
      ['Bir sayfayı basılı tutup sürükleyin', [1, 2, 4]],
      ['since 1987. Nevin', [1, 2]],
    ];
    for (const [phrase, allowed] of cases)
      expect(
        breaks(phrase).flatMap((ok, k) => (ok ? [k + 1] : [])),
        phrase,
      ).toEqual(allowed);
  });

  it('flag an orphan and a forbidden break', () => {
    expect(lineProblems([['one', 'two', 'three'], ['four.']], 0.12)).toHaveLength(1);
    expect(
      lineProblems(
        [
          ['from', '1'],
          ['January', '2027.'],
        ],
        0.5,
      ),
    ).toHaveLength(1);
    expect(
      lineProblems(
        [
          ['from', '1', 'January'],
          ['2027', 'on'],
        ],
        0.5,
      ),
    ).toHaveLength(1);
    expect(
      lineProblems(
        [
          ['one', 'two'],
          ['three', 'four.'],
        ],
        0.5,
      ),
    ).toEqual([]);
  });

  it.each(SAMPLE_LOCALES.flatMap((l) => SAMPLE_EDITIONS.map((e) => sampleFile(l, e))))(
    'hold in every paragraph %s sets: no short last line, no forbidden break',
    (file) => {
      const texts = built.texts.get(file) ?? [];
      expect(texts.length).toBeGreaterThan(20);
      const problems = texts.flatMap((t) =>
        lineProblems(t.lines, t.share).map((p) => `page ${t.page}: ${p}`),
      );
      expect(problems).toEqual([]);
    },
  );
});

describe('the four samples', () => {
  it('stay within the caps, each and together', () => {
    expect(sizeProblems(built.files)).toEqual([]);
  });

  it('match the committed manifest', () => {
    // Regenerate with `pnpm --filter @pdf-editor/fixtures-tool sample` after a change.
    expect(readFileSync(SAMPLE_MANIFEST, 'utf8')).toBe(manifestText(built.manifest));
  });

  it('send the feature page through Edit text, never a double-click (TXT-20)', () => {
    // In viewing a double-click selects a word (ADR-0029 §2.3), so a full-cut try slip that
    // promised one left the reader with a selected word and letters that ran as tool keys.
    expect(COPY.en.feature.tryLine.full).toMatch(/^Choose Edit text \(E\), then any paragraph/);
    expect(COPY.tr.feature.tryLine.full).toMatch(/^Metni düzenle’yi \(E\), ardından/);
    const fullLines = JSON.stringify(SAMPLE_LOCALES.map((l) => COPY[l])).match(/"full":"[^"]*"/g);
    expect(fullLines?.join('\n')).not.toMatch(/double-click|çift tıkla/i);
  });
});

describe.each(SAMPLE_LOCALES.flatMap((l) => SAMPLE_EDITIONS.map((e) => [l, e] as const)))(
  'the %s %s sample',
  (locale, edition) => {
    const file = sampleFile(locale, edition);
    const entry = () => {
      const found = built.manifest.files.find((f) => f.file === file);
      if (!found) throw new Error(`no manifest entry for ${file}`);
      return found;
    };
    const load = async () =>
      PDFDocument.load(built.files.get(file) as Uint8Array, { updateMetadata: false });

    it('is deterministic and equals the file in apps/web/public/sample/', async () => {
      const again = await buildSample(locale, edition);
      expect(sha256(again)).toBe(sha256(built.files.get(file) as Uint8Array));
      expect(sha256(readFileSync(join(SAMPLE_DIR, file)))).toBe(sha256(again));
      expect(again.length).toBeLessThanOrEqual(SAMPLE_MAX_BYTES[edition]);
    });

    it('has its pages, outline, language and title', async () => {
      const doc = await load();
      const m = entry();
      expect(doc.getPageCount()).toBe(m.pageCount);
      expect(m.pageCount).toBe(edition === 'full' ? 8 : 6);
      expect(doc.getTitle()).toBe(locale === 'en' ? 'Recto sample' : 'Recto örnek belge');
      expect(text(doc.catalog.get(PDFName.of('Lang')))).toBe(locale);
      const titles: string[] = [];
      let item = doc.catalog.lookup(PDFName.of('Outlines'), PDFDict).get(PDFName.of('First'));
      while (item instanceof PDFRef) {
        const dict = doc.context.lookup(item, PDFDict);
        titles.push(text(dict.get(PDFName.of('Title'))) ?? '');
        item = dict.get(PDFName.of('Next'));
      }
      expect(titles).toEqual(m.outline);
      if (edition === 'phone')
        for (const id of ['scan', 'invoice', 'flatplan']) expect(m.pages).not.toContain(id);
    });

    it('has the form on the agreement page, each field named for people', async () => {
      const doc = await load();
      const m = entry();
      const fields = doc.getForm().getFields();
      expect(fields.map((f) => f.getName())).toEqual(m.fields);
      for (const field of fields) {
        expect(field.acroField.dict.get(PDFName.of('TU'))).toBeDefined();
        for (const widget of field.acroField.getWidgets())
          expect(widget.P()).toBe(doc.getPage(m.formPage - 1).ref);
      }
    });

    it('has text on every page but the scan, which is one image', async () => {
      const doc = await load();
      const m = entry();
      for (let i = 0; i < m.pageCount; i++) {
        const content = pageContent(doc, i);
        if (m.scanPages.includes(i + 1)) {
          expect(content).not.toMatch(/\bBT\b/);
          expect(content).toMatch(/\/Im1 Do/);
        } else expect(content).toMatch(/\bBT\b/);
      }
      expect(m.scanPages).toEqual(edition === 'full' ? [6] : []);
    });

    it('links the cover lines to their pages', async () => {
      const doc = await load();
      const m = entry();
      const cover = doc.getPage(0);
      const targets = cover.node
        .Annots()
        ?.asArray()
        .map((ref) => doc.context.lookup(ref, PDFDict))
        .filter((a) => a.get(PDFName.of('Subtype')) === PDFName.of('Link'))
        .map((a) => {
          const dest = a.lookup(PDFName.of('Dest'), PDFArray);
          return doc.getPages().findIndex((p) => p.ref === dest.get(0)) + 1;
        });
      expect(targets).toEqual(m.coverLinks);
      expect(m.coverLinks).toEqual([3, 4, 5]);
    });

    it('clips every blended light (MOB-14: PDFium blends against a transparent page)', async () => {
      // direction-v2.md §5.4: a blended object must lie on a ground its page paints and be
      // clipped to it, or it draws against nothing (and costs a page-sized offscreen group).
      // The cover's scene is a Form XObject (MOB-15): its glows are held to the same rule.
      const doc = await load();
      let blendedPaints = 0;
      const check = (where: string, resources: PDFDict | undefined, content: string) => {
        const states = resources?.lookupMaybe(PDFName.of('ExtGState'), PDFDict);
        const blended = new Set(
          (states?.entries() ?? [])
            .filter(([, value]) => {
              const bm = doc.context.lookup(value, PDFDict).get(PDFName.of('BM'));
              return bm !== undefined && bm !== PDFName.of('Normal');
            })
            .map(([name]) => name.asString()),
        );
        const tokens = content.split(/\s+/);
        const clipped: boolean[] = [false];
        tokens.forEach((token, k) => {
          if (token === 'q') clipped.push(clipped.at(-1) ?? false);
          else if (token === 'Q') clipped.pop();
          else if (token === 'W' || token === 'W*') clipped[clipped.length - 1] = true;
          else if (token === 'gs' && blended.has(tokens[k - 1] ?? '')) {
            blendedPaints += 1;
            expect(clipped.at(-1), `${where}: ${tokens[k - 1]} outside a clip`).toBe(true);
          }
        });
      };
      const forms = new Set<PDFRawStream>();
      for (let i = 0; i < doc.getPageCount(); i++) {
        const resources = doc.getPage(i).node.Resources();
        check(`page ${i + 1}`, resources, pageContent(doc, i));
        const xobjects = resources?.lookupMaybe(PDFName.of('XObject'), PDFDict);
        for (const [, ref] of xobjects?.entries() ?? []) {
          const stream = doc.context.lookup(ref);
          const form = stream instanceof PDFRawStream ? stream : undefined;
          if (form?.dict.get(PDFName.of('Subtype')) === PDFName.of('Form')) forms.add(form);
        }
      }
      for (const form of forms)
        check(
          'a form',
          form.dict.lookupMaybe(PDFName.of('Resources'), PDFDict),
          Buffer.from(inflateSync(form.getContents())).toString('latin1'),
        );
      expect(forms.size).toBeGreaterThan(0);
      expect(blendedPaints).toBeGreaterThan(0);
    });

    it('is tagged', async () => {
      const doc = await load();
      expect(doc.catalog.get(PDFName.of('StructTreeRoot'))).toBeDefined();
      expect(doc.catalog.lookup(PDFName.of('MarkInfo'), PDFDict).get(PDFName.of('Marked'))).toBe(
        doc.context.obj(true),
      );
    });
  },
);
