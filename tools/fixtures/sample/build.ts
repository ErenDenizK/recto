/**
 * Builds one cut of the sample (MOB-12): the catalog filtered to an edition, folios, outline
 * and links numbered from the cut's own pages, tagged with `/Lang`, saved with object streams.
 * Deterministic: fixed Info dates, a trailer /ID and the scan's PRNG from the file name, fixed
 * subset tags.
 */
import { PDFDocument, PDFHexString, PDFName, type PDFPage } from '@cantoo/pdf-lib';
import { newDoc, save } from '../lib/build.ts';
import { withDeterministicRandom } from '../lib/common.ts';
import { pagesOf } from './catalog.ts';
import type { PageCtx, SampleEdition, SampleLocale } from './context.ts';
import { COPY } from './copy.ts';
import { PAGE_H, PAGE_W, type SetText, Structure, Writer, embedFaces, r2, textsOf } from './kit.ts';
import { scanPage } from './pages/scan.ts';

export const sampleFile = (locale: SampleLocale, edition: SampleEdition = 'full'): string =>
  edition === 'full' ? `recto-sample-${locale}.pdf` : `recto-sample-phone-${locale}.pdf`;

// What Document info shows as the sample's Creator and Producer.
const CREATOR = 'Recto';
const PRODUCER = 'Recto';

/** What the generator learned while drawing, for the manifest. */
export interface BuildNotes {
  readonly ids: readonly string[];
  readonly extras: Record<string, unknown>;
  /** Every paragraph as set, for the fixture test's line-break checks (MOB-15). */
  readonly texts: readonly SetText[];
}

export async function buildCut(
  locale: SampleLocale,
  edition: SampleEdition,
): Promise<{ bytes: Uint8Array; notes: BuildNotes }> {
  const file = sampleFile(locale, edition);
  return withDeterministicRandom(file, async () => {
    const copy = COPY[locale];
    const doc = await newDoc(copy.title);
    doc.setCreator(CREATOR);
    doc.setProducer(PRODUCER);
    doc.setAuthor('Recto');
    doc.setSubject(copy.subject);
    doc.setLanguage(copy.lang);
    doc.catalog.set(PDFName.of('ViewerPreferences'), doc.context.obj({ DisplayDocTitle: true }));
    doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
    const faces = await embedFaces(doc);
    const tags = new Structure(doc);
    const defs = pagesOf(edition);
    const ids = defs.map((d) => d.id);
    const pages = defs.map(() => doc.addPage([PAGE_W, PAGE_H]));
    const extras: Record<string, unknown> = {};
    const pageOf = (id: string) => {
      const i = ids.indexOf(id);
      return i < 0 ? undefined : i + 1;
    };
    defs.forEach((def, index) => {
      const page = pages[index] as PDFPage;
      const ctx: PageCtx = {
        w: new Writer(doc, faces, tags, page, index),
        doc,
        copy,
        locale,
        edition,
        n: index + 1,
        total: defs.length,
        ids,
        file,
        pageOf,
        pageRef: (id) => {
          const n = pageOf(id);
          return n === undefined ? undefined : pages[n - 1];
        },
      };
      if (def.scan) scanPage(ctx);
      else {
        const result = def.draw?.(ctx);
        if (result !== undefined) extras[def.id] = result;
      }
    });
    writeOutline(
      doc,
      ids.map((id) => copy.outline[id] ?? id),
    );
    tags.write(copy.lang);
    // Field appearances are made as each field is added (agreement.ts); none are remade at save.
    const bytes = await save(doc, file, { objectStreams: true, updateFieldAppearances: false });
    return { bytes, notes: { ids, extras, texts: textsOf(doc) } };
  });
}

function writeOutline(doc: PDFDocument, titles: readonly string[]): void {
  const ctx = doc.context;
  const root = ctx.nextRef();
  const refs = titles.map(() => ctx.nextRef());
  const pages = doc.getPages();
  titles.forEach((value, i) => {
    const page = pages[i];
    const ref = refs[i];
    if (!page || !ref) throw new Error(`outline: no page ${i + 1}`);
    const dict = ctx.obj({
      Title: PDFHexString.fromText(value),
      Parent: root,
      Dest: [page.ref, PDFName.of('XYZ'), null, r2(PAGE_H), null],
    });
    const prev = refs[i - 1];
    const next = refs[i + 1];
    if (prev) dict.set(PDFName.of('Prev'), prev);
    if (next) dict.set(PDFName.of('Next'), next);
    ctx.assign(ref, dict);
  });
  ctx.assign(
    root,
    ctx.obj({
      Type: 'Outlines',
      First: refs[0],
      Last: refs[refs.length - 1],
      Count: titles.length,
    }),
  );
  doc.catalog.set(PDFName.of('Outlines'), root);
}

export { PDFDocument };
