import { PDFDict, PDFDocument, PDFName, PDFString } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';

import { stripScripts } from './strip-scripts';

const js = (doc: PDFDocument, code: string) =>
  doc.context.obj({ Type: 'Action', S: 'JavaScript', JS: PDFString.of(code) });

/** A two-page PDF with an OpenAction script, catalog and page /AA, and a /Names /JavaScript tree. */
async function scripted(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const first = doc.addPage([200, 200]);
  doc.addPage([200, 200]);
  const { catalog, context } = doc;
  catalog.set(PDFName.of('OpenAction'), context.register(js(doc, 'app.alert("open")')));
  catalog.set(PDFName.of('AA'), context.obj({ WC: js(doc, 'app.alert("close")') }));
  first.node.set(PDFName.of('AA'), context.obj({ O: js(doc, 'app.alert("page")') }));
  const tree = context.obj({ Names: [PDFString.of('init'), context.register(js(doc, '1'))] });
  catalog.set(PDFName.of('Names'), context.obj({ JavaScript: context.register(tree) }));
  return doc.save();
}

describe('stripScripts (PRD-25)', () => {
  it('removes the OpenAction script, /AA and /Names /JavaScript from a copy', async () => {
    const input = await scripted();
    const before = input.slice();
    const { bytes, removed } = await stripScripts(input);
    expect(removed).toBe(4);
    expect(input).toEqual(before);

    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(2);
    expect(out.catalog.has(PDFName.of('OpenAction'))).toBe(false);
    expect(out.catalog.has(PDFName.of('AA'))).toBe(false);
    expect(out.catalog.has(PDFName.of('Names'))).toBe(false);
    expect(out.getPage(0).node.has(PDFName.of('AA'))).toBe(false);
    expect(new TextDecoder('latin1').decode(bytes)).not.toContain('app.alert');
  });

  it('keeps an OpenAction that only goes to a page, and returns clean bytes unchanged', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 200]);
    doc.catalog.set(PDFName.of('OpenAction'), doc.context.obj([page.ref, PDFName.of('Fit')]));
    const input = await doc.save();
    const { bytes, removed } = await stripScripts(input);
    expect(removed).toBe(0);
    expect(bytes).toEqual(input);
    const out = await PDFDocument.load(bytes);
    expect(out.catalog.get(PDFName.of('OpenAction'))).toBeDefined();
    expect(out.catalog.lookupMaybe(PDFName.of('Names'), PDFDict)).toBeUndefined();
  });
});
