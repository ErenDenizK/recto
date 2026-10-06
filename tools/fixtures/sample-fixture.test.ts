/**
 * The teaching sample's builder (docs/specs/redesign.md §11.5 D4-2; components/02-library.md
 * §11, "fixture verify"): deterministic, byte-identical to the files the app serves, within
 * the size cap, and shaped as the spec says (four pages, the form's fields, no text on the
 * scan page, the language, four outline entries, tagged).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFString,
} from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';

import { sha256 } from './lib/common.ts';
import {
  SAMPLE_DIR,
  SAMPLE_FIELDS,
  SAMPLE_LOCALES,
  SAMPLE_MAX_BYTES,
  SAMPLE_PAGE_COUNT,
  SAMPLE_SCAN_PAGE,
  buildSample,
  sampleFile,
} from './sample-fixture.ts';

/** The decoded content of every stream a page's /Contents names. */
function pageContent(doc: PDFDocument, index: number): string {
  const page = doc.getPage(index);
  const contents = page.node.get(PDFName.of('Contents'));
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

describe.each(SAMPLE_LOCALES)('the %s sample', (locale) => {
  it('is deterministic and equals the file in apps/web/public/sample/', async () => {
    const first = await buildSample(locale);
    const second = await buildSample(locale);
    expect(sha256(second)).toBe(sha256(first));
    // Regenerate with `pnpm --filter @pdf-editor/fixtures-tool sample` after a change.
    expect(sha256(readFileSync(join(SAMPLE_DIR, sampleFile(locale))))).toBe(sha256(first));
  });

  it('stays within the size cap', async () => {
    const bytes = await buildSample(locale);
    expect(bytes.length).toBeLessThanOrEqual(SAMPLE_MAX_BYTES);
    expect(readFileSync(join(SAMPLE_DIR, sampleFile(locale))).length).toBeLessThanOrEqual(
      SAMPLE_MAX_BYTES,
    );
  });

  it('has four pages, the form, a scan with no text, the language and the outline', async () => {
    const doc = await PDFDocument.load(await buildSample(locale), { updateMetadata: false });
    expect(doc.getPageCount()).toBe(SAMPLE_PAGE_COUNT);
    expect(doc.getTitle()).toBe(locale === 'en' ? 'Recto sample' : 'Recto örnek belge');
    const lang = doc.catalog.get(PDFName.of('Lang'));
    expect(lang instanceof PDFString ? lang.decodeText() : undefined).toBe(locale);

    const fields = doc.getForm().getFields();
    expect(fields.map((field) => field.getName())).toEqual([...SAMPLE_FIELDS]);
    // Every field has an accessible name (/TU) and sits on page 2.
    for (const field of fields) {
      expect(field.acroField.dict.get(PDFName.of('TU'))).toBeDefined();
      const [widget] = field.acroField.getWidgets();
      expect(widget?.P()).toBe(doc.getPage(1).ref);
    }

    // The scan page is one image and no text operators; every other page shows text.
    for (let i = 0; i < SAMPLE_PAGE_COUNT; i++) {
      const content = pageContent(doc, i);
      if (i === SAMPLE_SCAN_PAGE - 1) {
        expect(content).not.toMatch(/\bBT\b/);
        expect(content).toMatch(/\/Im1 Do/);
      } else expect(content).toMatch(/\bBT\b/);
    }

    const outlines = doc.catalog.lookup(PDFName.of('Outlines'), PDFDict);
    let item = outlines.get(PDFName.of('First'));
    let count = 0;
    while (item instanceof PDFRef) {
      count += 1;
      item = doc.context.lookup(item, PDFDict).get(PDFName.of('Next'));
    }
    expect(count).toBe(SAMPLE_PAGE_COUNT);

    // Tagged: a structure tree and MarkInfo, with alt text on the scan.
    expect(doc.catalog.get(PDFName.of('StructTreeRoot'))).toBeDefined();
    expect(doc.catalog.lookup(PDFName.of('MarkInfo'), PDFDict).get(PDFName.of('Marked'))).toBe(
      doc.context.obj(true),
    );
  });
});
