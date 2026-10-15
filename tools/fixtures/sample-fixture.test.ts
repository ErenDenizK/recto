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

describe('the four samples', () => {
  it('stay within the caps, each and together', () => {
    expect(sizeProblems(built.files)).toEqual([]);
  });

  it('match the committed manifest', () => {
    // Regenerate with `pnpm --filter @pdf-editor/fixtures-tool sample` after a change.
    expect(readFileSync(SAMPLE_MANIFEST, 'utf8')).toBe(manifestText(built.manifest));
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

    it('is tagged', async () => {
      const doc = await load();
      expect(doc.catalog.get(PDFName.of('StructTreeRoot'))).toBeDefined();
      expect(doc.catalog.lookup(PDFName.of('MarkInfo'), PDFDict).get(PDFName.of('Marked'))).toBe(
        doc.context.obj(true),
      );
    });
  },
);
